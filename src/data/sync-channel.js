/**
 * 与同步器（AstroBox 插件）的 interconnect 通信通道
 *
 * 移植自 reference/class-schedule/src/app.ux（59–598 行），scope 按 EvBox 工具箱语义重定义。
 * 协议见 doc/首页改造与新工具及同步器通信恢复设计.md §5.4 / §6.5。
 *
 * 移植时逐条避开的坑（来自参考工程 docs/Ev课程表接收接口改造方案.md）：
 * 1. 必须 interconnect.instance() 拿 connect，直接挂 interconnect.onmessage 不生效
 * 2. 回调数据在 data.data，不是 data
 * 3. connect.send 传 Object（框架序列化），传字符串会双重转义
 * 4. 禁用 ES6 可选链 ?.（会整段脚本不执行白屏），一律 var + &&
 * 5. 接收端对 string / object 两种报文形态都要兼容
 */

var store = require("./store.js")
var countdown = require("./countdown.js")
var chat = require("./sync-chat.js")
// 版本号唯一来源：与 EV 课程表的 syncCollectVersion() 同一套逻辑 —— 不要在报文里写死
var pkgVersion = require("./version.js")

var VERSION = 1
var ENABLED_KEY = "sync_channel_enabled"

// 守门人白名单：auth 永不外泄
var SYNC_ACCESS = {
  profile: { read: "always", write: true },
  countdown: { read: "always", write: true },
  homepage: { read: "always", write: true },
  chat: { read: "always", write: true },
  version: { read: "always", write: false },
  auth: { read: "never", write: false }
}

function canRead(scope) {
  var a = SYNC_ACCESS[scope]
  return !!a && a.read === "always"
}

function canWrite(scope) {
  var a = SYNC_ACCESS[scope]
  return !!a && a.write === true
}

var interconnect = null
try {
  interconnect = require("@system.interconnect")
} catch (e) {
  interconnect = null
}

var connect = null
var started = false

// ---------------- 开关（默认关闭，零耗电） ----------------

function isEnabled(cb) {
  var storage = require("@system.storage")
  storage.get({
    key: ENABLED_KEY,
    success: function(data) {
      cb(data === "1")
    },
    fail: function() {
      cb(false)
    }
  })
}

function setEnabled(on, cb) {
  var storage = require("@system.storage")
  storage.set({
    key: ENABLED_KEY,
    value: on ? "1" : "0",
    success: function() { if (cb) cb(true) },
    fail: function() { if (cb) cb(false) }
  })
}

// ---------------- 发送 ----------------

function send(payload) {
  if (!connect) return false
  try {
    connect.send({ data: payload })
    return true
  } catch (e) {
    return false
  }
}

// ---------------- 报文归一化（string / object 双兼容） ----------------

function normalize(raw) {
  var payload = raw
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload)
    } catch (e) {
      payload = null
    }
  }
  if (!payload || typeof payload !== "object") return {}
  return payload
}

// ---------------- 聚合读取（export） ----------------

function collect(scopes, cb) {
  var out = {}
  var list = []
  var i

  if (scopes && scopes.length) {
    for (i = 0; i < scopes.length; i++) {
      if (canRead(scopes[i])) list.push(scopes[i])
    }
  }
  if (!list.length) list = ["profile", "version"]

  var pending = 0
  var done = false
  function tick() {
    pending--
    if (pending <= 0 && !done) {
      done = true
      cb(out, list)
    }
  }

  for (i = 0; i < list.length; i++) {
    (function(scope) {
      pending++
      if (scope === "profile") {
        store.getNickname(function(name) {
          out.nickname = name || ""
          tick()
        })
      } else if (scope === "countdown") {
        countdown.loadList(function(items) {
          out.countdown = items || []
          tick()
        })
      } else if (scope === "homepage") {
        store.getHomepageSettings(function(s) {
          out.homepage = s || {}
          tick()
        })
      } else if (scope === "chat") {
        chat.readList(function(items) {
          out.chat = items || []
          tick()
        })
      } else if (scope === "version") {
        out.versionName = pkgVersion.versionName
        out.versionCode = pkgVersion.versionCode
        tick()
      } else {
        tick()
      }
    })(list[i])
  }

  if (pending === 0) cb(out, list)
}

// ---------------- 写入（update_settings / import） ----------------

function applySettings(payload, cb) {
  var pending = 0
  var hasWork = false
  var failed = false

  function tick() {
    pending--
    if (pending <= 0) {
      cb(!failed, failed ? "write failed" : "")
    }
  }

  // 昵称：带表单事件对象容错（插件可能传 {type:"change", value:"xxx"}）
  var nick = payload.nickname
  if (nick !== undefined && nick !== null && canWrite("profile")) {
    if (typeof nick === "object" && nick.value !== undefined) nick = nick.value
    hasWork = true
    pending++
    store.setNickname(String(nick), function() {
      tick()
    })
  }

  // 首页设置：读-改-写，避免被插件报文整段覆盖
  var hp = payload.homepage
  if (hp !== undefined && hp !== null && typeof hp === "object" && canWrite("homepage")) {
    hasWork = true
    pending++
    store.getHomepageSettings(function(cur) {
      var merged = {}
      var k
      for (k in cur) {
        if (Object.prototype.hasOwnProperty.call(cur, k)) merged[k] = cur[k]
      }
      for (k in hp) {
        if (Object.prototype.hasOwnProperty.call(hp, k)) merged[k] = hp[k]
      }
      store.setHomepageSettings(merged, function() {
        tick()
      })
    })
  }

  if (!hasWork) cb(false, "no known field")
}

// ---------------- 分发 ----------------

function handle(raw, reply) {
  var payload = normalize(raw)
  var action = payload.action

  if (action === "ping") {
    reply({
      ok: true, action: "ping", pong: true,
      version: VERSION,
      // ⚠️ 原来写死 "1.0.8"/9，和真实版本不一样 → 手机端显示错版本号。
      //    统一从 data/version.js 读（与 EV 课程表一致）。
      versionName: pkgVersion.versionName,
      versionCode: pkgVersion.versionCode
    })
    return
  }

  if (action === "export") {
    collect(payload.scopes, function(data, scopes) {
      reply({ ok: true, action: "export", version: VERSION, scopes: scopes, data: data })
    })
    return
  }

  if (action === "update_settings") {
    applySettings(payload, function(ok, reason) {
      if (ok) reply({ ok: true, action: "update_settings" })
      else reply({ ok: false, action: "update_settings", reason: reason || "write failed" })
    })
    return
  }

  if (action === "chat_pull") {
    chat.deviceMessagesSince(payload.since, function(messages) {
      reply({ ok: true, action: "chat_pull", messages: messages })
    })
    return
  }

  if (action === "chat_push") {
    chat.pushFromPhone(payload.messages, function(count) {
      reply({ ok: true, action: "chat_push", count: count })
    })
    return
  }

  // 不带 action 一律按 import 处理（与参考工程一致）
  applySettings(payload, function(ok, reason) {
    if (ok) reply({ ok: true, action: "import" })
    else reply({ ok: false, action: "import", reason: reason || "no known field" })
  })
}

// ---------------- 生命周期 ----------------

function setup() {
  if (started) return false
  if (!interconnect) return false

  isEnabled(function(on) {
    if (!on) return
    try {
      connect = interconnect.instance()
    } catch (e) {
      connect = null
      return
    }
    if (!connect) return
    started = true

    connect.onmessage = function(e) {
      var raw = null
      if (e && e.data !== undefined) raw = e.data
      else raw = e
      handle(raw, function(res) {
        send(res)
      })
    }
    connect.onopen = function() {}
    connect.onerror = function() {}
    connect.onclose = function() {}
  })
  return true
}

function teardown() {
  started = false
  connect = null
}

/** 通道状态：available(平台支持) / started(已建立) / connected(1已连接 2断开 0未知) */
function getState(cb) {
  if (!connect) {
    cb({ available: !!interconnect, started: started, connected: 0 })
    return
  }
  try {
    connect.getReadyState({
      success: function(res) {
        var s = 0
        if (res && res.readyState) s = res.readyState
        cb({ available: true, started: started, connected: s })
      },
      fail: function() {
        cb({ available: true, started: started, connected: 0 })
      }
    })
  } catch (e) {
    cb({ available: !!interconnect, started: started, connected: 0 })
  }
}

module.exports = {
  VERSION: VERSION,
  ENABLED_KEY: ENABLED_KEY,
  SYNC_ACCESS: SYNC_ACCESS,
  canRead: canRead,
  canWrite: canWrite,
  isEnabled: isEnabled,
  setEnabled: setEnabled,
  setup: setup,
  teardown: teardown,
  send: send,
  handle: handle,
  getState: getState
}
