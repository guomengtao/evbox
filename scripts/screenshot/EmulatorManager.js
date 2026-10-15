var path = require("path")
var utils = require("./utils")

function EmulatorManager(mcpClient, adbClient, fbShot) {
  this.mcp = mcpClient
  this.adb = adbClient || null
  this.fbShot = fbShot || null
  this.verbose = false
}

// 返回 { adbOnline, mcpStarted, mcpAvailable }
EmulatorManager.prototype.ensureEmulatorReady = function (device, projectPath) {
  var self = this
  return self._prepareDevice(device, projectPath)
}

EmulatorManager.prototype._prepareDevice = function (device, projectPath) {
  var self = this
  projectPath = projectPath || path.join(__dirname, "..", "..")

  return self._probeAdbOnline()
    .then(function (adbOnline) {
      if (adbOnline) {
        console.log("[Emulator] adb device already online: " + (self.adb ? self.adb.serial : "n/a"))
        return { adbOnline: true, mcpStarted: false }
      }
      // 设备未上线：尝试用 MCP 冷启动（runtime 连不上也不致命，模拟器进程可能仍能拉起内核使 adb 可见）
      return self._startViaMcp(device, projectPath)
        .then(function () {
          return self._waitForAdbReady()
        })
        .then(function (online) {
          if (!online) {
            throw new Error("Emulator did not become adb-ready (neither MCP runtime nor adb device)")
          }
          return { adbOnline: true, mcpStarted: true }
        })
    })
}

EmulatorManager.prototype._probeAdbOnline = function () {
  var self = this
  if (!self.adb) return Promise.resolve(false)
  return self.adb.isOnline().catch(function () { return false })
}

EmulatorManager.prototype._startViaMcp = function (device, projectPath) {
  var self = this
  if (!self.mcp) return Promise.resolve()
  return self.mcp.startDebugCli({
    projectPath: projectPath,
    device: device,
    verbose: false
  }).catch(function (err) {
    // start_debug_cli 常因等不到 VelaJS runtime 而超时，但模拟器内核可能已在启动。
    // 这里的失败不致命，交由 adb 轮询判定。
    if (self.verbose) console.log("[Emulator] start_debug_cli returned but runtime unready: " + err.message)
    return null
  })
}

EmulatorManager.prototype._waitForAdbReady = function (timeoutMs) {
  var self = this
  timeoutMs = timeoutMs || 150000
  if (!self.adb) return Promise.resolve(false)

  var start = Date.now()
  function check() {
    if (Date.now() - start >= timeoutMs) return Promise.resolve(false)
    return self.adb.isOnline()
      .then(function (online) {
        if (online) return Promise.resolve(true)
        return utils.sleep(2000).then(check)
      })
  }
  return check()
}

// MCP 增强通道探测：navigate 首页成功则 MCP 可用（回到首屏）
EmulatorManager.prototype.probeMcpAvailable = function () {
  var self = this
  if (!self.mcp) return Promise.resolve(false)
  return self.mcp.navigate("pages/index")
    .then(function () { return utils.sleep(1200) })
    .then(function () { return self.mcp.getSnapshot() })
    .then(function (snap) {
      return !!(snap && snap.children && snap.children.length > 0)
    })
    .catch(function () { return false })
}

EmulatorManager.prototype.restartEmulator = function (device) {
  var self = this
  console.log("[Emulator] Restarting emulator...")
  var chain = Promise.resolve()
  if (self.mcp) {
    chain = chain.then(function () { return self.mcp.stopDebug().catch(function () {}) })
  }
  return chain
    .then(function () { return utils.sleep(3000) })
    .then(function () { return self._prepareDevice(device, null) })
}

EmulatorManager.prototype.cleanup = function () {
  var self = this
  console.log("[Emulator] Shutting down...")
  var chain = Promise.resolve()
  if (self.mcp) {
    chain = chain
      .then(function () { return self.mcp.stopDebug().catch(function () {}) })
      .then(function () { return utils.sleep(1000) })
      .then(function () { return self.mcp.close().catch(function () {}) })
  }
  return chain.then(function () {
    console.log("[Emulator] Shutdown complete")
  })
}

module.exports = EmulatorManager