var spawn = require("child_process").execFile
var os = require("os")
var path = require("path")
var fs = require("fs")
var utils = require("./utils")

var DEFAULT_ADB_DIR = path.join(os.homedir(), ".vela", "sdk", "tools", "adb", "mac", "adb")
var DEFAULT_SERIAL = "emulator-5554"
var DEFAULT_PKG = "com.application.watch.evbox"

function findAdb() {
  var candidates = []
  if (process.env.VELA_ADB) candidates.push(process.env.VELA_ADB)
  candidates.push(DEFAULT_ADB_DIR)
  candidates.push(path.join(os.homedir(), ".vela", "sdk", "tools", "adb", "linux", "adb"))
  candidates.push("adb")
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i].indexOf("/") !== -1 && fs.existsSync(candidates[i])) {
      return candidates[i]
    }
  }
  return candidates[0]
}

function AdbClient(options) {
  options = options || {}
  this.adb = options.adbPath || findAdb()
  this.serial = options.serial || process.env.VELA_SERIAL || DEFAULT_SERIAL
  this.pkg = options.pkg || DEFAULT_PKG
  this.verbose = options.verbose || false
}

AdbClient.prototype.exec = function (args, timeoutMs) {
  var self = this
  timeoutMs = timeoutMs || 15000
  return new Promise(function (resolve, reject) {
    spawn(self.adb, (self.serial ? ["-s", self.serial] : []).concat(args), {
      maxBuffer: 64 * 1024 * 1024,
      timeout: timeoutMs
    }, function (err, stdout, stderr) {
      if (err) {
        var msg = String(stderr || err.message || "").trim()
        return reject(new Error("adb " + args[0] + " failed: " + msg))
      }
      resolve(stdout)
    })
  })
}

AdbClient.prototype.listDevices = function () {
  var self = this
  return new Promise(function (resolve) {
    spawn(self.adb, ["devices"], { maxBuffer: 1024 * 1024, timeout: 10000 },
      function (err, stdout) {
        if (err) return resolve([])
        var lines = String(stdout || "").split("\n")
        var devices = []
        for (var i = 1; i < lines.length; i++) {
          var parts = lines[i].trim().split(/\s+/)
          if (parts.length >= 2 && parts[1] === "device") {
            devices.push(parts[0])
          }
        }
        resolve(devices)
      })
  })
}

AdbClient.prototype.isOnline = function () {
  var self = this
  return self.listDevices().then(function (devices) {
    return devices.indexOf(self.serial) !== -1
  })
}

AdbClient.prototype.shell = function (cmd, timeoutMs) {
  return this.exec(["shell", cmd], timeoutMs)
}

AdbClient.prototype.coldStart = function (waitMs) {
  var self = this
  waitMs = waitMs || 22
  return self.shell("am stop " + self.pkg)
    .catch(function () {})
    .then(function () { return utils.sleep(1200) })
    .then(function () { return self.shell("vapp app/" + self.pkg + " &") })
    .then(function () { return utils.sleep(waitMs * 1000) })
}

AdbClient.prototype.readFramebuffer = function (tmpGuestPath) {
  var self = this
  var guest = tmpGuestPath || "/tmp/fbshot.raw"
  var local = path.join(os.tmpdir(), "_fbshot_" + Date.now() + ".raw")
  return self.shell("dd if=/dev/fb0 of=" + guest + " bs=384 count=980")
    .catch(function () {
      return self.shell("dd if=/dev/fb0 of=" + guest + " bs=188160 count=1")
    })
    .then(function () { return self.exec(["pull", guest, local]) })
    .then(function () {
      return self.shell("rm -f " + guest).catch(function () {})
    })
    .then(function () {
      var buf = null
      if (fs.existsSync(local)) {
        buf = fs.readFileSync(local)
        fs.unlinkSync(local)
      }
      return buf
    })
}

AdbClient.prototype.tap = function (x, y, holdMs) {
  var self = this
  holdMs = holdMs == null ? 120 : holdMs
  return self.exec(["emu", "event", "mouse", String(x), String(y), "0", "1"])
    .then(function () { return utils.sleep(holdMs / 1000) })
    .then(function () { return self.exec(["emu", "event", "mouse", String(x), String(y), "0", "0"]) })
}

AdbClient.prototype.swipe = function (x1, y1, x2, y2, ms, steps) {
  var self = this
  ms = ms || 350
  steps = steps || 12
  return self.exec(["emu", "event", "mouse", String(x1), String(y1), "0", "1"])
    .then(function () { return utils.sleep(60) })
    .then(function () {
      var chain = Promise.resolve()
      for (var i = 1; i <= steps; i++) {
        (function (i) {
          var x = x1 + (x2 - x1) * i / steps
          var y = y1 + (y2 - y1) * i / steps
          chain = chain.then(function () {
            return self.exec(["emu", "event", "mouse", String(Math.round(x)), String(Math.round(y)), "0", "1"])
          }).then(function () { return utils.sleep(ms / 1000 / steps) })
        })(i)
      }
      return chain
    })
    .then(function () {
      return self.exec(["emu", "event", "mouse", String(x2), String(y2), "0", "0"])
    })
}

module.exports = AdbClient