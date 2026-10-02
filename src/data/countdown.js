/**
 * 倒数日数据层（被「倒数日页」与「首页大数字模块」共用）
 *
 * 数据结构（storage key: countdownDays，数组）：
 * {
 *   id: "cd_1690..._1234",          // 稳定 ID
 *   title: "妈妈生日",
 *   calendar: "solar" | "lunar",    // 公历 或 农历
 *   date: "2027-06-07",             // 基准公历日期（农历项为首次/最近一次对应的公历日）
 *   lunar: { month: 3, day: 5, isLeap: false },  // 仅农历项
 *   repeat: "none" | "weekly" | "monthly" | "yearly",
 *   enabled: true,
 *   pinnedHome: false,              // 只能有一个为 true（钉到首页大数字）
 *   created: 1690000000000
 * }
 *
 * 兼容旧数据：旧的 { title, date, enabled } 会在 normalize 时补全字段。
 */
var lunar = require("../lib/lunar.js")

var KEY = "countdownDays"

var REPEAT_NONE = "none"
var REPEAT_WEEKLY = "weekly"
var REPEAT_MONTHLY = "monthly"
var REPEAT_YEARLY = "yearly"

var REPEAT_ORDER = [REPEAT_NONE, REPEAT_WEEKLY, REPEAT_MONTHLY, REPEAT_YEARLY]
var REPEAT_LABELS = {
  none: "不重复",
  weekly: "每周",
  monthly: "每月",
  yearly: "每年"
}

function pad2(n) {
  return n < 10 ? "0" + n : "" + n
}

function toKey(y, m, d) {
  return y + "-" + pad2(m) + "-" + pad2(d)
}

function parseKey(s) {
  if (!s || typeof s !== "string") return null
  var p = s.split("-")
  if (p.length !== 3) return null
  var y = parseInt(p[0], 10)
  var m = parseInt(p[1], 10)
  var d = parseInt(p[2], 10)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return { year: y, month: m, day: d }
}

function dateOf(o) {
  return new Date(o.year, o.month - 1, o.day)
}

function startOfDay(date) {
  var t = new Date(date.getTime())
  t.setHours(0, 0, 0, 0)
  return t
}

/** to - from，单位天（to 晚于 from 为正） */
function diffDays(from, to) {
  var a = startOfDay(from)
  var b = startOfDay(to)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/** 与今天比较：>0 未来、0 今天、<0 已过 */
function cmpToday(o, today) {
  return diffDays(today, dateOf(o))
}

function addDays(o, n) {
  var t = dateOf(o)
  t.setDate(t.getDate() + n)
  return { year: t.getFullYear(), month: t.getMonth() + 1, day: t.getDate() }
}

function genId() {
  return "cd_" + new Date().getTime() + "_" + Math.floor(Math.random() * 100000)
}

/** 公历日期夹取到该月合法范围 */
function clampDay(y, m, d) {
  var mx = lunar.solarMonthDays(y, m)
  if (d > mx) return mx
  return d < 1 ? 1 : d
}

/** 农历某年（闰）月的最大天数 */
function lunarMonthMaxDay(year, month, isLeap) {
  if (isLeap && lunar.leapMonth(year) === month) return lunar.leapDays(year)
  return lunar.monthDays(year, month)
}

// ---------------------------------------------------------------- 归一化

function normalizeItem(raw) {
  if (!raw || !raw.title) return null
  var item = {}
  item.id = raw.id || genId()
  item.title = String(raw.title)
  item.calendar = raw.calendar === "lunar" ? "lunar" : "solar"
  item.repeat = REPEAT_LABELS[raw.repeat] ? raw.repeat : REPEAT_NONE
  item.enabled = raw.enabled !== false
  item.pinnedHome = raw.pinnedHome === true
  item.created = raw.created || new Date().getTime()
  item.lunar = null

  var lm = raw.lunar
  if (lm && lm.month >= 1 && lm.month <= 12 && lm.day >= 1 && lm.day <= 30) {
    item.lunar = { month: lm.month, day: lm.day, isLeap: lm.isLeap === true }
  }

  var base = parseKey(raw.date)
  if (!base && item.lunar) {
    var s = lunar.lunarToSolar(new Date().getFullYear(), item.lunar.month, item.lunar.day, item.lunar.isLeap)
    if (s) base = { year: s.year, month: s.month, day: s.day }
  }
  if (!base) return null
  item.date = toKey(base.year, base.month, base.day)

  if (item.calendar === "lunar" && !item.lunar) {
    var l = lunar.solarToLunar(base.year, base.month, base.day)
    if (l) item.lunar = { month: l.month, day: l.day, isLeap: l.isLeap }
  }
  if (item.calendar === "solar") item.lunar = null
  return item
}

function normalizeList(arr) {
  var out = []
  if (!arr || !arr.length) return out
  for (var i = 0; i < arr.length; i++) {
    var it = normalizeItem(arr[i])
    if (it) out.push(it)
  }
  return out
}

/** 编辑器保存时用：把编辑态（年月日 + 类型 + 重复）变成完整 item */
function createItem(fields) {
  var today = startOfDay(new Date())
  var item = {
    id: fields.id || genId(),
    title: (fields.title || "").trim(),
    calendar: fields.calendar === "lunar" ? "lunar" : "solar",
    repeat: REPEAT_LABELS[fields.repeat] ? fields.repeat : REPEAT_NONE,
    enabled: fields.enabled !== false,
    pinnedHome: fields.pinnedHome === true,
    created: fields.created || new Date().getTime(),
    lunar: null,
    date: ""
  }
  if (!item.title) return null

  if (item.calendar === "lunar") {
    var month = Math.min(Math.max(fields.month || 1, 1), 12)
    var lunarYear = fields.year
    if (!lunarYear || lunarYear < lunar.MIN_YEAR || lunarYear > lunar.MAX_YEAR) {
      var cur = lunar.solarToLunar(today.getFullYear(), today.getMonth() + 1, today.getDate())
      lunarYear = cur ? cur.year : today.getFullYear()
    }
    var maxDay = lunarMonthMaxDay(lunarYear, month, fields.isLeap)
    var day = Math.min(Math.max(fields.day || 1, 1), maxDay)
    item.lunar = { month: month, day: day, isLeap: fields.isLeap === true }
    // 基准公历日期：所选农历年（一次性）或最近一次（重复时仅作兜底，推算以 lunar 为准）
    var s = lunar.lunarToSolar(lunarYear, month, day, item.lunar.isLeap)
    if (!s) s = lunar.lunarToSolar(today.getFullYear(), month, day, item.lunar.isLeap)
    item.date = s ? toKey(s.year, s.month, s.day) : toKey(today.getFullYear(), 1, 1)
  } else {
    var y = fields.year || today.getFullYear()
    var m = Math.min(Math.max(fields.month || 1, 1), 12)
    item.date = toKey(y, m, clampDay(y, m, fields.day || 1))
  }
  return item
}

// ---------------------------------------------------------------- 存储

/**
 * 示例数据（demo seeds）
 *
 * 2026-10-02 按用户反馈新增：首次使用（storage 为空）时写入 3 条示例，
 * 让用户打开就能看到效果，不必先自己录数据。
 *
 * 三条原则：
 *   1. 只在「从未写过数据」时播种一次 —— 用独立 SEED_FLAG 标记，
 *      用户自己清空列表后不会再次被塞回来。
 *   2. 名称一律带「示例」二字，界面上明确可辨，不会被误认为真实日程。
 *   3. 其中一条钉到首页，让首页大数字模块也有内容可显示。
 */
var SEED_FLAG = "countdownSeeded"

function buildDemoSeeds() {
  var today = startOfDay(new Date())
  var base = today.getTime()

  function at(offsetDays) {
    var t = new Date(base + offsetDays * 86400000)
    return {
      year: t.getFullYear(),
      month: t.getMonth() + 1,
      day: t.getDate()
    }
  }

  var d1 = at(30)
  var d2 = at(100)
  var d3 = at(365)

  var seeds = [
    createItem({ title: "示例：距离期末还有 30 天", year: d1.year, month: d1.month, day: d1.day, repeat: "none", pinnedHome: true }),
    createItem({ title: "示例：距离旅行出发 100 天", year: d2.year, month: d2.month, day: d2.day, repeat: "none" }),
    createItem({ title: "示例：年度总结 365 天", year: d3.year, month: d3.month, day: d3.day, repeat: "yearly" })
  ]

  var out = []
  for (var i = 0; i < seeds.length; i++) {
    if (seeds[i]) out.push(seeds[i])
  }
  return out
}

function loadList(cb) {
  var storage = require("@system.storage")
  storage.get({
    key: KEY,
    success: function(data) {
      var raw = []
      if (data) {
        try {
          raw = JSON.parse(data)
        } catch (e) {
          raw = []
        }
      }

      var list = normalizeList(raw)

      // 已有数据：绝不覆盖用户数据
      if (list.length > 0) {
        cb(list)
        return
      }

      // 空列表：查是否已播种过
      storage.get({
        key: SEED_FLAG,
        success: function(flag) {
          if (flag) { cb(list); return }   // 用户自己清空过，不再塞 demo
          var seeds = buildDemoSeeds()
          if (!seeds.length) { cb(list); return }
          saveList(seeds, function() {
            storage.set({ key: SEED_FLAG, value: "1", success: function() {}, fail: function() {} })
            cb(normalizeList(seeds))
          })
        },
        fail: function() { cb(list) }
      })
    },
    fail: function() {
      cb([])
    }
  })
}

function saveList(list, cb) {
  var storage = require("@system.storage")
  var clean = []
  for (var i = 0; i < list.length; i++) {
    var it = list[i]
    if (!it) continue
    clean.push({
      id: it.id,
      title: it.title,
      calendar: it.calendar,
      date: it.date,
      lunar: it.lunar || null,
      repeat: it.repeat || REPEAT_NONE,
      enabled: it.enabled !== false,
      pinnedHome: it.pinnedHome === true,
      created: it.created || 0
    })
  }
  storage.set({
    key: KEY,
    value: JSON.stringify(clean),
    success: function() {
      if (cb) cb()
    },
    fail: function() {
      if (cb) cb()
    }
  })
}

/** 钉到首页大数字（互斥：只有一个能被钉） */
function setPinned(list, id) {
  var out = []
  for (var i = 0; i < list.length; i++) {
    var it = {}
    for (var k in list[i]) {
      if (Object.prototype.hasOwnProperty.call(list[i], k)) it[k] = list[i][k]
    }
    it.pinnedHome = it.id === id ? !it.pinnedHome : false
    out.push(it)
  }
  return out
}

/** 彻底卸载：移除最后一条钉首页时清空钉标记由调用方负责 */
function removeAt(list, idx) {
  var out = []
  for (var i = 0; i < list.length; i++) {
    if (i !== idx) out.push(list[i])
  }
  return out
}

// ---------------------------------------------------------------- 计算

/** 农历项在指定农历年的公历日期 */
function lunarNextSolar(lu, lYear) {
  if (!lu) return null
  var isLeap = lu.isLeap === true && lunar.leapMonth(lYear) === lu.month
  var s = lunar.lunarToSolar(lYear, lu.month, lu.day, isLeap)
  if (!s) return null
  return { year: s.year, month: s.month, day: s.day }
}

/**
 * 下一次发生（含今天）
 * @returns {{year, month, day, daysLeft, isToday, repeat, lunar}}
 */
function nextOccurrence(item, today) {
  var now = startOfDay(today || new Date())
  var base = parseKey(item.date)
  if (!base) return null
  var repeat = item.repeat || REPEAT_NONE
  var res = null

  if (repeat === REPEAT_NONE) {
    res = base
  } else if (repeat === REPEAT_WEEKLY) {
    var diff = diffDays(dateOf(base), now)
    res = diff <= 0 ? base : addDays(base, Math.ceil(diff / 7) * 7)
  } else if (repeat === REPEAT_MONTHLY) {
    var day = base.day
    var y = now.getFullYear()
    var m = now.getMonth() + 1
    var cand = { year: y, month: m, day: clampDay(y, m, day) }
    if (cmpToday(cand, now) < 0) {
      m = m + 1
      if (m > 12) {
        m = 1
        y = y + 1
      }
      cand = { year: y, month: m, day: clampDay(y, m, day) }
    }
    res = cand
  } else {
    // 每年
    if (item.calendar === "lunar" && item.lunar) {
      var lt = lunar.solarToLunar(now.getFullYear(), now.getMonth() + 1, now.getDate())
      var ly = lt ? lt.year : now.getFullYear()
      var candL = lunarNextSolar(item.lunar, ly)
      if (!candL || cmpToday(candL, now) < 0) candL = lunarNextSolar(item.lunar, ly + 1)
      res = candL || base
    } else {
      var y2 = now.getFullYear()
      var cand2 = { year: y2, month: base.month, day: clampDay(y2, base.month, base.day) }
      if (cmpToday(cand2, now) < 0) {
        y2 = y2 + 1
        cand2 = { year: y2, month: base.month, day: clampDay(y2, base.month, base.day) }
      }
      res = cand2
    }
  }

  if (!res) return null
  var daysLeft = cmpToday(res, now)
  var l = lunar.solarToLunar(res.year, res.month, res.day)
  return {
    year: res.year,
    month: res.month,
    day: res.day,
    daysLeft: daysLeft,
    isToday: daysLeft === 0,
    repeat: repeat,
    lunar: l ? { year: l.year, month: l.month, day: l.day, isLeap: l.isLeap } : null
  }
}

/**
 * 给 UI 用的展示对象（不改动原 item）
 */
function decorateItem(item, today) {
  var next = nextOccurrence(item, today)
  var daysLeft = next ? next.daysLeft : 0
  var out = {
    id: item.id,
    title: item.title,
    calendar: item.calendar,
    repeat: item.repeat || REPEAT_NONE,
    repeatText: REPEAT_LABELS[item.repeat] || REPEAT_LABELS[REPEAT_NONE],
    enabled: item.enabled !== false,
    pinnedHome: item.pinnedHome === true,
    lunar: item.lunar || null,
    date: item.date,
    daysLeft: daysLeft,
    isToday: daysLeft === 0,
    isPast: daysLeft < 0,
    badgeText: daysLeft >= 0 ? (daysLeft > 999 ? "999+" : "" + daysLeft) : "已过",
    daysText: daysLeft > 0 ? "还有 " + daysLeft + " 天" : (daysLeft === 0 ? "就是今天" : "已过 " + (-daysLeft) + " 天"),
    dateText: "",
    nextText: "",
    nextDateText: "",
    festival: ""
  }

  if (item.calendar === "lunar" && item.lunar) {
    out.dateText = lunar.formatLunarWithPrefix(item.lunar)
  } else {
    var b = parseKey(item.date)
    out.dateText = b ? "公历 " + toKey(b.year, b.month, b.day) : item.date
  }

  if (next) {
    out.nextDateText = toKey(next.year, next.month, next.day)
    out.nextLunarText = next.lunar ? lunar.formatLunarWithPrefix(next.lunar) : ""
    out.festival = lunar.lunarFestival(next.lunar) || lunar.solarFestival(next.month, next.day)
    if (out.repeat !== REPEAT_NONE) {
      out.nextText = "下次 " + out.nextDateText + (out.festival ? " · " + out.festival : "")
    } else if (out.repeat === REPEAT_NONE && out.isPast && out.festival) {
      out.nextText = out.festival
    }
  }
  return out
}

function decorateList(list, today) {
  var out = []
  for (var i = 0; i < list.length; i++) {
    out.push(decorateItem(list[i], today))
  }
  return out
}

/** mode: "recent"（按临近程度） | "name"（按名称） */
function sortList(list, mode, today) {
  var arr = list.slice()
  if (mode === "name") {
    arr.sort(function(a, b) {
      return (a.title || "").localeCompare(b.title || "")
    })
  } else {
    var now = today || new Date()
    arr.sort(function(a, b) {
      var da = decorateItem(a, now)
      var db = decorateItem(b, now)
      var va = da.daysLeft < 0 ? 100000 + (-da.daysLeft) : da.daysLeft
      var vb = db.daysLeft < 0 ? 100000 + (-db.daysLeft) : db.daysLeft
      return va - vb
    })
  }
  return arr
}

/**
 * 首页大数字要展示的那一条：
 * ① 手动钉的优先；② 否则最近的未来项；③ 全部已过则取绝对值最小的
 */
function getHomeItem(list, today) {
  var now = today || new Date()
  var best = null
  var i
  for (i = 0; i < list.length; i++) {
    var it = list[i]
    if (!it || it.enabled === false) continue
    var d = decorateItem(it, now)
    if (d.pinnedHome) return d
    if (d.daysLeft >= 0 && (!best || d.daysLeft < best.daysLeft)) best = d
  }
  if (best) return best
  for (i = 0; i < list.length; i++) {
    var it2 = list[i]
    if (!it2 || it2.enabled === false) continue
    var d2 = decorateItem(it2, now)
    if (!best || Math.abs(d2.daysLeft) < Math.abs(best.daysLeft)) best = d2
  }
  return best
}

module.exports = {
  KEY: KEY,
  REPEAT_NONE: REPEAT_NONE,
  REPEAT_WEEKLY: REPEAT_WEEKLY,
  REPEAT_MONTHLY: REPEAT_MONTHLY,
  REPEAT_YEARLY: REPEAT_YEARLY,
  REPEAT_ORDER: REPEAT_ORDER,
  REPEAT_LABELS: REPEAT_LABELS,
  pad2: pad2,
  toKey: toKey,
  parseKey: parseKey,
  clampDay: clampDay,
  lunarMonthMaxDay: lunarMonthMaxDay,
  diffDays: diffDays,
  startOfDay: startOfDay,
  genId: genId,
  normalizeItem: normalizeItem,
  normalizeList: normalizeList,
  createItem: createItem,
  loadList: loadList,
  saveList: saveList,
  setPinned: setPinned,
  removeAt: removeAt,
  nextOccurrence: nextOccurrence,
  decorateItem: decorateItem,
  decorateList: decorateList,
  sortList: sortList,
  getHomeItem: getHomeItem
}
