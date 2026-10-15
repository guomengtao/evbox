var fs = require("fs")
var path = require("path")
var utils = require("./utils")

// 参考 tools/emu_shot.py：192x490 RGB565 双缓冲，stride=384B(192*2)
var DEFAULT_W = 192
var DEFAULT_H = 490

function FbScreenshot(adbClient, options) {
  this.adb = adbClient
  options = options || {}
  this.width = options.width || DEFAULT_W
  this.height = options.height || DEFAULT_H
  this.stride = options.stride || this.width * 2
  this.frameBytes = this.stride * this.height
}

// 从 framebuffer 原始数据解码为 PNG。frame=0 取第 1 帧（双缓冲）
// 返回 { black: bool, path, width, height }
FbScreenshot.prototype.capture = function (outPngPath, frame) {
  var self = this
  frame = frame || 0
  return self.adb.readFramebuffer().then(function (raw) {
    if (!raw || raw.length < self.frameBytes) {
      return { black: true, path: null, error: "framebuffer insufficient: " + (raw ? raw.length : 0) + " < " + self.frameBytes }
    }
    var off = frame * self.frameBytes
    if (raw.length < off + self.frameBytes) off = 0

    var result = decodeRgb565(raw, off, self.width, self.height, self.stride)
    utils.ensureDir(path.dirname(outPngPath))
    fs.writeFileSync(outPngPath, result.png)
    return {
      black: result.black,
      path: outPngPath,
      width: self.width,
      height: self.height
    }
  })
}

// 判断屏幕当前是否基本为黑屏（轻量采样：stride 步长抽样首帧）
FbScreenshot.prototype.isBlack = function () {
  var self = this
  return self.adb.readFramebuffer().then(function (raw) {
    if (!raw || raw.length < self.frameBytes) return true
    var nonZero = 0
    for (var i = 0; i < self.frameBytes; i += 64) {
      if (raw[i] !== 0) nonZero++
    }
    return nonZero < 20
  })
}

function decodeRgb565(raw, off, width, height, stride) {
  var png = require("pngjs").PNG
  var pngInst = new png({ width: width, height: height })

  var idx = 0
  var nonZero = 0
  var total = width * height

  for (var y = 0; y < height; y++) {
    var base = off + y * stride
    for (var x = 0; x < width; x++) {
      var p = base + x * 2
      var v = raw[p] | (raw[p + 1] << 8)
      var r = ((v >> 11) & 0x1F) * 255 / 31
      var g = ((v >> 5) & 0x3F) * 255 / 63
      var b = (v & 0x1F) * 255 / 31
      pngInst.data[idx] = r
      pngInst.data[idx + 1] = g
      pngInst.data[idx + 2] = b
      pngInst.data[idx + 3] = 255
      if (r + g + b > 30) nonZero++
      idx += 4
    }
  }

  var buf = png.sync.write(pngInst)
  return { png: buf, black: (total > 0 && nonZero < total * 0.02) }
}

module.exports = FbScreenshot