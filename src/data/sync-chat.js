/**
 * 同步器留言（聊天）数据层
 *
 * storage key: sync_chat_list
 * 结构：[{ id, from: "phone"|"device", text, ts, read }]
 *
 * 设计约束（doc/首页改造与新工具及同步器通信恢复设计.md §6）：
 * - 上限 200 条，超出丢弃最旧的（手环存储与内存都紧）
 * - 这是**异步留言**不是即时聊天：插件 chat_push 推入、chat_pull 取走
 */

var CHAT_KEY = "sync_chat_list"
var CHAT_MAX = 200

function parseList(data) {
  var arr = []
  try {
    arr = data ? JSON.parse(data) : []
  } catch (e) {
    arr = []
  }
  if (!arr || !arr.length) return []
  return arr
}

function readList(cb) {
  var storage = require("@system.storage")
  storage.get({
    key: CHAT_KEY,
    success: function(data) {
      cb(parseList(data))
    },
    fail: function() {
      cb([])
    }
  })
}

function writeList(list, cb) {
  var storage = require("@system.storage")
  var arr = list && list.length ? list : []
  if (arr.length > CHAT_MAX) arr = arr.slice(arr.length - CHAT_MAX)
  storage.set({
    key: CHAT_KEY,
    value: JSON.stringify(arr),
    success: function() { if (cb) cb(arr) },
    fail: function() { if (cb) cb(arr) }
  })
}

/**
 * 追加一条消息
 * @param {string} from "phone"（同步器） | "device"（本机）
 */
function addMessage(from, text, cb) {
  if (!text) {
    if (cb) cb([])
    return
  }
  readList(function(list) {
    var ts = Date.now()
    list.push({
      id: String(ts) + "_" + Math.floor(Math.random() * 1000),
      from: from === "phone" ? "phone" : "device",
      text: String(text),
      ts: ts,
      read: from !== "phone"
    })
    writeList(list, cb)
  })
}

/** 插件推来的多条消息（from=phone，默认未读） */
function pushFromPhone(messages, cb) {
  var incoming = []
  if (messages && messages.length) {
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i]
      if (!m) continue
      var text = m.text !== undefined ? m.text : m
      if (!text) continue
      incoming.push(String(text))
    }
  }
  if (!incoming.length) {
    if (cb) cb(0)
    return
  }
  readList(function(list) {
    var base = Date.now()
    for (var i = 0; i < incoming.length; i++) {
      var ts = base + i
      list.push({
        id: String(ts) + "_p" + i,
        from: "phone",
        text: incoming[i],
        ts: ts,
        read: false
      })
    }
    writeList(list, function(saved) {
      if (cb) cb(incoming.length)
    })
  })
}

/** 把来自同步器的消息全部标记已读 */
function markAllRead(cb) {
  readList(function(list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].from === "phone") list[i].read = true
    }
    writeList(list, cb)
  })
}

/** 同步器发来且未读的条数 */
function unreadCount(cb) {
  readList(function(list) {
    var n = 0
    for (var i = 0; i < list.length; i++) {
      if (list[i].from === "phone" && !list[i].read) n++
    }
    cb(n)
  })
}

/** 供插件 chat_pull 拉取：本机发出且 ts > since 的消息 */
function deviceMessagesSince(since, cb) {
  var base = 0
  var parsed = parseInt(since, 10)
  if (!isNaN(parsed)) base = parsed
  readList(function(list) {
    var out = []
    for (var i = 0; i < list.length; i++) {
      var m = list[i]
      if (m.from === "device" && m.ts > base) {
        out.push({ id: m.id, text: m.text, ts: m.ts })
      }
    }
    cb(out)
  })
}

module.exports = {
  CHAT_KEY: CHAT_KEY,
  CHAT_MAX: CHAT_MAX,
  readList: readList,
  writeList: writeList,
  addMessage: addMessage,
  pushFromPhone: pushFromPhone,
  markAllRead: markAllRead,
  unreadCount: unreadCount,
  deviceMessagesSince: deviceMessagesSince
}
