var execSync = require("child_process").execSync
var path = require("path")
var fs = require("fs")

var EMU_SHOT = path.join(__dirname, "..", "..", "tools", "emu_shot.py")

function EmuShotCli(options) {
  options = options || {}
  this.verbose = options.verbose || false
}

EmuShotCli.prototype._run = function (args, timeout) {
  timeout = timeout || 30000
  var cmd = "python3 " + EMU_SHOT + " " + args.join(" ")
  if (this.verbose) console.log("  [emu_shot] " + cmd)
  return execSync(cmd, { encoding: "utf-8", timeout: timeout, stdio: "pipe", maxBuffer: 1024 * 1024 })
}

EmuShotCli.prototype.shot = function (outPath) {
  var dir = path.dirname(outPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  this._run(["shot", outPath])
  return outPath
}

EmuShotCli.prototype.tap = function (x, y, hold) {
  var args = ["tap", String(x), String(y)]
  if (hold !== undefined) args.push("--hold", String(hold))
  this._run(args)
}

EmuShotCli.prototype.swipe = function (x1, y1, x2, y2, ms) {
  var args = ["swipe", String(x1), String(y1), String(x2), String(y2)]
  if (ms !== undefined) args.push("--ms", String(ms))
  this._run(args)
}

EmuShotCli.prototype.launch = function () {
  this._run(["launch"], 60000)
}

EmuShotCli.prototype.stop = function () {
  try { this._run(["stop"], 10000) } catch (_e) {}
}

module.exports = EmuShotCli