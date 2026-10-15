var spawn = require("child_process").spawn
var readline = require("readline")

function VelaMCPClient() {
  this.proc = null
  this.requestId = 0
  this.pending = new Map()
  this.logPrefix = "[VelaMCP]"
  this.verbose = false
  this.deviceId = null
  this.avdId = null
}

VelaMCPClient.prototype.start = function (timeoutMs) {
  var self = this
  timeoutMs = timeoutMs || 120000

  return new Promise(function (resolve, reject) {
    var settled = false

    function settle(err, result) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (err) reject(err)
      else resolve(result)
    }

    var timer = setTimeout(function () {
      settle(new Error("velajs-mcp start timeout (" + timeoutMs + "ms)"))
    }, timeoutMs)

    self.proc = spawn("npx", ["-y", "velajs-mcp"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: Object.assign({}, process.env, { NODE_NO_WARNINGS: "1" })
    })
    self._setupLineReader()

    var outputBuf = ""

    self.proc.stdout.on("data", function (chunk) {
      var text = chunk.toString()
      outputBuf += text
      if (!settled && outputBuf.indexOf("MCP server ready") !== -1) {
        if (self.verbose) console.log(self.logPrefix + " ready")
        self._initialize().then(function () {
          if (self.verbose) console.log(self.logPrefix + " initialized")
          settle(null, true)
        }).catch(function (err) {
          settle(err)
        })
      }
    })

    self.proc.stderr.on("data", function (chunk) {
      var text = chunk.toString()
      if (self.verbose) {
        process.stderr.write(self.logPrefix + " stderr: " + text)
      }
      if (!settled && text.indexOf("MCP server ready") !== -1) {
        if (self.verbose) console.log(self.logPrefix + " ready")
        self._initialize().then(function () {
          if (self.verbose) console.log(self.logPrefix + " initialized")
          settle(null, true)
        }).catch(function (err) {
          settle(err)
        })
      }
    })

    self.proc.on("error", function (err) {
      settle(new Error("Failed to spawn velajs-mcp: " + err.message))
    })

    self.proc.on("exit", function (code, signal) {
      if (!settled) {
        settle(new Error("velajs-mcp exited early code=" + code + " signal=" + signal))
      }
      if (self.verbose) {
        console.log(self.logPrefix + " exited code=" + code + " signal=" + signal)
      }
      self.proc = null
      var exitErr = new Error("velajs-mcp exited code=" + code)
      var entries = self.pending.entries()
      var entry
      while ((entry = entries.next()) && !entry.done) {
        var pending = entry.value[1]
        if (pending && pending.reject) pending.reject(exitErr)
      }
      self.pending.clear()
    })
  })
}

VelaMCPClient.prototype._initialize = function () {
  var self = this
  return self.call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "evbox-screenshot", version: "1.0.0" }
  }).then(function (result) {
    if (self.verbose) console.log(self.logPrefix + " server: " + (result.serverInfo || {}).name)
    try {
      self.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n")
    } catch (_e) {}
    return result
  })
}

VelaMCPClient.prototype._setupLineReader = function () {
  var self = this
  var rl = readline.createInterface({
    input: self.proc.stdout,
    crlfDelay: Infinity
  })

  rl.on("line", function (line) {
    line = line.trim()
    if (!line) return

    try {
      var msg = JSON.parse(line)
      if (msg.id && self.pending.has(msg.id)) {
        var pending = self.pending.get(msg.id)
        self.pending.delete(msg.id)
        clearTimeout(pending.timer)
        if (msg.error) {
          pending.reject(new Error(msg.error.message || JSON.stringify(msg.error)))
        } else {
          pending.resolve(msg.result)
        }
      }
    } catch (_e) {
    }
  })
}

VelaMCPClient.prototype.call = function (method, params) {
  var self = this
  params = params || {}

  return new Promise(function (resolve, reject) {
    if (!self.proc) {
      return reject(new Error("MCP client not started"))
    }

    var id = ++self.requestId
    var request = JSON.stringify({
      jsonrpc: "2.0",
      id: id,
      method: method,
      params: params
    })

    var timeoutMs = method === "tools/call" ? 60000 : 30000
    var timer = setTimeout(function () {
      if (self.pending.has(id)) {
        self.pending.delete(id)
        reject(new Error("MCP call timeout: " + method + " (" + timeoutMs + "ms)"))
      }
    }, timeoutMs)

    self.pending.set(id, { resolve: resolve, reject: reject, timer: timer })

    if (self.verbose) {
      console.log(self.logPrefix + " -> " + method + " " + JSON.stringify(params).substring(0, 120))
    }

    self.proc.stdin.write(request + "\n")
  })
}

VelaMCPClient.prototype.callTool = function (name, args) {
  var self = this
  args = args || {}
  if (self.deviceId && args.deviceId === undefined && name !== "list_emulators") {
    args.deviceId = self.deviceId
  }
  return self.call("tools/call", { name: name, arguments: args }).then(function (result) {
    var content = result.content || []
    var isError = result.isError === true
    var lastText = ""
    for (var i = 0; i < content.length; i++) {
      if (content[i].type === "text") {
        lastText = content[i].text || ""
      }
    }
    if (isError) {
      throw new Error("Tool " + name + " error: " + lastText)
    }
    try {
      return JSON.parse(lastText)
    } catch (_e) {
      return lastText
    }
  })
}

VelaMCPClient.prototype.setDevice = function (deviceId, avdId) {
  this.deviceId = deviceId
  if (avdId) this.avdId = avdId
}

VelaMCPClient.prototype.close = function () {
  var self = this
  return new Promise(function (resolve) {
    if (!self.proc) {
      resolve()
      return
    }

    var timer = setTimeout(function () {
      if (self.proc) self.proc.kill("SIGKILL")
      resolve()
    }, 5000)

    self.proc.on("exit", function () {
      clearTimeout(timer)
      resolve()
    })

    try { self.proc.stdin.end() } catch (_e) {}
    self.proc.kill("SIGTERM")
  })
}

// --- Core tools ---

VelaMCPClient.prototype.navigate = function (pagePath) {
  return this.callTool("navigate", { url: pagePath })
}

VelaMCPClient.prototype.takeScreenshot = function () {
  var args = {}
  if (this.avdId) args.avdId = this.avdId
  return this.callTool("take_screenshot", args)
}

VelaMCPClient.prototype.executeScript = function (code) {
  return this.callTool("execute_script", { expression: code })
}

VelaMCPClient.prototype.getSnapshot = function () {
  return this.callTool("get_snapshot", {})
}

VelaMCPClient.prototype.getConsoleLogs = function () {
  return this.callTool("get_console_logs", {})
}

// --- Emulator lifecycle ---

VelaMCPClient.prototype.listEmulators = function () {
  return this.callTool("list_emulators", {})
}

VelaMCPClient.prototype.startDebugCli = function (args) {
  return this.callTool("start_debug_cli", args || {})
}

VelaMCPClient.prototype.stopDebug = function () {
  return this.callTool("stop_debug", {})
}

VelaMCPClient.prototype.getEmulatorLogs = function (limit) {
  return this.callTool("get_emulator_logs", { limit: limit || 50 })
}

VelaMCPClient.prototype.getOutputLogs = function (limit) {
  return this.callTool("get_output_logs", { limit: limit || 50 })
}

module.exports = VelaMCPClient