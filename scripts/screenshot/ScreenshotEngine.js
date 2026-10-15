var fs = require("fs")
var path = require("path")
var utils = require("./utils")
var BlackScreenDetector = require("./BlackScreenDetector")

function ScreenshotEngine(mcpClient, adbClient, fbShot) {
  this.mcp = mcpClient
  this.adb = adbClient || null
  this.fbShot = fbShot || null
  this.detector = new BlackScreenDetector()
  this.verbose = false
  this.outputRoot = ""
  this.device = ""
  this.version = ""
  this.stateName = ""
  this.useAdbFallback = false
}

ScreenshotEngine.prototype.configure = function (outputRoot, device, version, stateName) {
  this.outputRoot = outputRoot
  this.device = device
  this.version = version || "latest"
  this.stateName = stateName || "baseline"
}

ScreenshotEngine.prototype.capture = function (page, options) {
  var self = this
  options = options || {}
  var maxRetries = options.maxRetries || 2
  var enableBlackCheck = options.enableBlackCheck !== false
  var timeoutMs = options.timeoutMs || 15000

  var timestamp = utils.formatTimestamp()

  return self._waitForPageStable(timeoutMs)
    .then(function (stable) {
      if (!stable) {
        return {
          status: "TIMEOUT",
          file: null,
          duration_ms: timeoutMs,
          retries: 0,
          error: "Page did not stabilize within " + timeoutMs + "ms"
        }
      }

      return self._captureWithRetry(page, {
        maxRetries: maxRetries,
        enableBlackCheck: enableBlackCheck,
        timestamp: timestamp,
        retries: 0
      })
    })
}

ScreenshotEngine.prototype._captureWithRetry = function (page, options) {
  var self = this

  return self._doCapture()
    .then(function (result) {
      if (result.status === "OK" || !options.enableBlackCheck) {
        return result
      }
      if (options.retries >= options.maxRetries) {
        return result
      }

      if (self.verbose) {
        console.log("  [Retry " + (options.retries + 1) + "/" + options.maxRetries + "] " + result.status)
      }

      return utils.sleep(1500)
        .then(function () {
          if (options.retries === options.maxRetries - 1) {
            return self.mcp.navigate("pages/index")
              .then(function () { return utils.sleep(1000) })
              .then(function () { return self.mcp.navigate(page.path) })
              .then(function () { return utils.sleep(2000) })
          }
          return Promise.resolve()
        })
        .then(function () {
          var nextOptions = {
            maxRetries: options.maxRetries,
            enableBlackCheck: options.enableBlackCheck,
            timestamp: options.timestamp,
            retries: options.retries + 1
          }
          return self._captureWithRetry(page, nextOptions)
        })
    })

  function _doCapture() {
    return self._grabToFile()
      .then(function (grab) {
        var destPath = grab.path
        var relativePath = self._buildRelativePath(page, options.timestamp, "")

        // grab 已经写到了按页面结构计算的路径
        if (grab.wroteToDest) {
          relativePath = grab.relativePath
          destPath = grab.path
        }

        if (!options.enableBlackCheck) {
          return {
            status: "OK",
            file: relativePath,
            retries: options.retries
          }
        }

        var detection = self.detector.detect(destPath)
        if (detection.status === "OK") {
          return {
            status: "OK",
            file: relativePath,
            retries: options.retries,
            detection: detection
          }
        }

        if (options.retries >= options.maxRetries) {
          var failRelativePath = self._buildRelativePath(page, options.timestamp, "_FAILED")
          var failPath = path.join(self.outputRoot, failRelativePath)
          utils.ensureDir(path.dirname(failPath))
          fs.renameSync(destPath, failPath)
          return {
            status: detection.status,
            file: failRelativePath,
            retries: options.retries,
            detection: detection,
            error: detection.status + " screen detected after " + (options.retries + 1) + " attempts"
          }
        }

        return { status: detection.status, retries: options.retries }
      })
  }

  // 统一截图入口：优先 MCP take_screenshot，失败或 adb 模式回退 framebuffer
  function _grabToFile() {
    var destPath = path.join(self.outputRoot, self._buildRelativePath(page, options.timestamp, ""))
    utils.ensureDir(path.dirname(destPath))

    if (self.useAdbFallback || !self.mcp) {
      return _grabViaFb(destPath).then(function (p) {
        return { path: p, wroteToDest: true, relativePath: self._buildRelativePath(page, options.timestamp, ""), adb: true }
      })
    }

    return self.mcp.takeScreenshot()
      .then(function (result) {
        var base64 = result.base64 || result.data || result
        if (!base64) throw new Error("empty screenshot result")
        var buf = Buffer.from(base64, "base64")
        fs.writeFileSync(destPath, buf)
        return { path: destPath, wroteToDest: true, relativePath: self._buildRelativePath(page, options.timestamp, ""), adb: false }
      })
      .catch(function (err) {
        if (!self.fbShot) throw err
        if (self.verbose) console.log("  [FbFallback] MCP screenshot failed, using framebuffer: " + err.message)
        return _grabViaFb(destPath).then(function (p) {
          return { path: p, wroteToDest: true, relativePath: self._buildRelativePath(page, options.timestamp, ""), adb: true }
        })
      })
  }

  function _grabViaFb(destPath) {
    if (!self.fbShot) return Promise.reject(new Error("framebuffer screenshot unavailable"))
    return self.fbShot.capture(destPath, 0)
      .then(function (fb) {
        if (!fb.path) throw new Error(fb.error || "framebuffer capture returned no image")
        return fb.path
      })
  }
}

ScreenshotEngine.prototype._waitForPageStable = function (maxWaitMs) {
  var self = this
  var start = Date.now()
  var lastXml = null
  var stableCount = 0

  // adb 模式没有 DOM 快照：用固定稳定等待代替
  if (self.useAdbFallback || !self.mcp) {
    return utils.sleep(Math.min(maxWaitMs, 2500)).then(function () { return true })
  }

  function check() {
    if (Date.now() - start >= maxWaitMs) return Promise.resolve(false)
    return self.mcp.getSnapshot()
      .then(function (snapshot) {
        if (!snapshot) return utils.sleep(500).then(check)
        var currentXml = JSON.stringify(snapshot)
        if (currentXml === lastXml) {
          stableCount++
          if (stableCount >= 2) return true
        } else {
          stableCount = 0
          lastXml = currentXml
        }
        return utils.sleep(500).then(check)
      })
      .catch(function () {
        return utils.sleep(500).then(check)
      })
  }

  return check()
}

ScreenshotEngine.prototype._buildRelativePath = function (page, timestamp, suffix) {
  var statePart = this.stateName ? this.stateName + "/" : ""
  var group = utils.sanitizeFilename(page.group)
  var name = utils.sanitizeFilename(page.name_cn)
  var filename = name + "_" + this.version + (suffix || "") + "_" + timestamp + ".png"
  return path.join(this.device, this.version, statePart + group, filename)
}

module.exports = ScreenshotEngine