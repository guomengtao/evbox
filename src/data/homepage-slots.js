/**
 * 首页槽位数据层 · v3
 *
 * 正本：docs/pages/core/index.md v3 ／ docs/pages/core/index-职责重定位分析-20261114.md
 *
 * 职责：把「产品默认推荐」与「用户钉选」收敛成同一份首页槽位列表。
 * 不新造推荐系统，继续复用 pin-helper.js 的 pinned_pages storage key；
 * 只新增一个独立配置 key（homepage_slot_config）存「被移除的默认项」与「首页显示数量」，
 * 刻意不塞进 homepage_settings —— 那个 key 被 settings / homepage-settings 多页全量读写，
 * 混进槽位配置容易被覆盖式写回冲掉。
 *
 * 约束：
 *  - 总槽位硬上限 6（防钉页数量失控）；
 *  - 首页只渲染前 slotLimit 个（默认 3，允许 2~4），其余仍在「管理首页」可见；
 *    ev-six 单屏 442px / 1.5 屏 735px 是硬预算，4 个卡约 742px 已到顶；
 *  - 默认项与用户钉项混排、不做视觉区分；默认项在前，钉项按钉的顺序追加；
 *  - 同一 uri 去重，避免默认推荐和用户手钉出现两次。
 */
var pinHelper = require("./pin-helper.js")

var CONFIG_KEY = "homepage_slot_config"
var MAX_TOTAL = 6

var DEFAULT_SLOTS = [
  { id: "countdown", name: "倒数日", uri: "/pages/countdown-manage", summaryKey: "countdown" },
  { id: "lunar", name: "农历", uri: "/pages/lunar-calendar", summaryKey: "lunar" },
  { id: "quote", name: "一言", uri: "/pages/daily-quote", summaryKey: "quote" }
]

/** 用户钉任意页时，尽量给它接上 tool-summaries.js 已有的实时摘要 */
var URI_SUMMARY = {
  "/pages/countdown-manage": "countdown",
  "/pages/lunar-calendar": "lunar",
  "/pages/calculator": "calculator",
  "/pages/qrcode-generator": "qrcode",
  "/pages/vibration-lab": "vibrate",
  "/pages/vibration-lab-v2": "vibrate",
  "/pages/daily-quote": "quote",
  "/pages/backup-restore": "backup",
  "/pages/device-info": "device"
}

function defaultConfig() {
  return { hidden: [], slotLimit: 3 }
}

function readConfig(callback) {
  var storage = require("@system.storage")
  storage.get({
    key: CONFIG_KEY,
    success: function(data) {
      var cfg = defaultConfig()
      if (data) {
        try {
          var parsed = JSON.parse(data)
          if (parsed && parsed.hidden && parsed.hidden.length) cfg.hidden = parsed.hidden
          if (parsed && parsed.slotLimit >= 2 && parsed.slotLimit <= 4) cfg.slotLimit = parsed.slotLimit
        } catch (e) {
          console.error("[homepage-slots] bad config, fallback: " + (e.message || e))
        }
      }
      callback(cfg)
    },
    fail: function() {
      callback(defaultConfig())
    }
  })
}

function writeConfig(cfg, callback) {
  var storage = require("@system.storage")
  storage.set({
    key: CONFIG_KEY,
    value: JSON.stringify(cfg),
    success: function() { if (callback) callback() },
    fail: function() { if (callback) callback() }
  })
}

function build(defaults, pinned, cfg) {
  var all = []
  var seen = {}
  for (var i = 0; i < defaults.length; i++) {
    var d = defaults[i]
    if (cfg.hidden.indexOf(d.id) >= 0) continue
    all.push({
      id: d.id,
      name: d.name,
      uri: d.uri,
      summaryKey: d.summaryKey,
      source: "default"
    })
    seen[d.uri] = true
  }
  for (var j = 0; j < pinned.length && all.length < MAX_TOTAL; j++) {
    var p = pinned[j]
    if (!p || !p.uri || seen[p.uri]) continue
    all.push({
      id: "pin:" + p.uri,
      name: p.name || "已钉页面",
      uri: p.uri,
      summaryKey: URI_SUMMARY[p.uri] || "",
      source: "pinned"
    })
    seen[p.uri] = true
  }
  return all
}

/**
 * callback({
 *   slots:  首页可见槽位（已截到 slotLimit）
 *   all:    全部槽位（管理首页用）
 *   pinned: 用户钉选原始列表
 *   total / limit / hidden
 * })
 */
function getSlots(callback) {
  readConfig(function(cfg) {
    pinHelper.getList(function(pinned) {
      var all = build(DEFAULT_SLOTS, pinned, cfg)
      callback({
        slots: all.slice(0, cfg.slotLimit),
        all: all,
        pinned: pinned || [],
        total: all.length,
        limit: cfg.slotLimit,
        hidden: cfg.hidden.slice(0)
      })
    })
  })
}

function hideDefault(id, callback) {
  readConfig(function(cfg) {
    if (cfg.hidden.indexOf(id) < 0) cfg.hidden.push(id)
    writeConfig(cfg, callback)
  })
}

function restoreDefaults(callback) {
  readConfig(function(cfg) {
    cfg.hidden = []
    writeConfig(cfg, callback)
  })
}

function setLimit(n, callback) {
  var limit = parseInt(n, 10)
  if (!(limit >= 2 && limit <= 4)) limit = 3
  readConfig(function(cfg) {
    cfg.slotLimit = limit
    writeConfig(cfg, callback)
  })
}

/**
 * 静默取消钉选。pin-helper.unpinPage 会弹 showToast，
 * 而 ev-six 禁系统浮层（会压住页面且无法被 OCR 验收），管理首页页改走这里。
 * 仍写同一个 pinned_pages key，其它页面读到的结果完全一致。
 */
function removePinned(uri, callback) {
  pinHelper.getList(function(list) {
    var out = []
    for (var i = 0; i < list.length; i++) {
      if (list[i].uri !== uri) out.push(list[i])
    }
    var storage = require("@system.storage")
    storage.set({
      key: "pinned_pages",
      value: JSON.stringify(out),
      success: function() { if (callback) callback() },
      fail: function() { if (callback) callback() }
    })
  })
}

module.exports = {
  getSlots: getSlots,
  hideDefault: hideDefault,
  restoreDefaults: restoreDefaults,
  setLimit: setLimit,
  removePinned: removePinned,
  getDefaults: function() { return DEFAULT_SLOTS },
  MAX_TOTAL: MAX_TOTAL
}
