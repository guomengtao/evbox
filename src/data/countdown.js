/**
 * 倒数日数据层 v3 —— 以 Ev倒数日（ev/countdown）数据层为骨架，并入 EvBox 独有字段。
 *
 * 为什么换骨架（2026-11-14）：
 *   EvBox 旧版是「裸数组 + 页面内弹层编辑器」，没有 id 稳定定位、没有颜色分类、
 *   没有正计时、没有进度；Ev倒数日 那套已经踩过一年坑（v1→v2 迁移、演示数据、
 *   农历快照、按 id 定位、进度口径），直接搬过来比在老代码上补更省。
 *
 * 存档结构（key: countdownDays.v3，版本化对象）：
 * {
 *   version: 3,
 *   items: [{
 *     id, title,
 *     date: "2027-06-07",              // 真源永远是公历日期串
 *     calendar: "solar" | "lunar",     // 录入时用的日历（决定卡片要不要显示农历行）
 *     lunar: { month, day, isLeap } ,  // 仅农历项
 *     mode: "down" | "up",             // 倒数 / 正计时
 *     repeat: "none"|"weekly"|"monthly"|"yearly",   // EvBox 独有
 *     enabled: true,                   // 首页显示
 *     pinnedHome: false,               // EvBox 独有：钉到首页大数字（互斥）
 *     color: "#4aa3d8",                // 分类色（6 选 1，空 = 主题兜底色）
 *     createdAt: 1690000000000,        // 进度条起点
 *     created: 1690000000000
 *   }]
 * }
 *
 * 迁移：读到 v2（{version:2,items}）或更早的裸数组 countdownDays 时自动升级到 v3，
 * 字段按「缺则补默认」归一，旧键保留不删（回滚安全，且旧版本误读也不会丢数据）。
 */
var lunar = require("../lib/lunar.js")

var KEY = "countdownDays.v3"
var V2_KEY = "countdownDays.v2"
var LEGACY_KEY = "countdownDays"

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

var MODE_DOWN = "down"
var MODE_UP = "up"
var MODE_LABELS = { down: "倒数", up: "正计时" }

// 6 个固定分类色：手环只有一列卡片，色相一多就互相吃掉区分度；
// 6 个足够分（生日/节日/考试/出行/缴费/纪念），深色浅色主题都经 adaptColor 校正过。
var COLORS = [
  { id: "blue", name: "海蓝", hex: "#4aa3d8" },
  { id: "mint", name: "薄荷", hex: "#3aa87a" },
  { id: "amber", name: "暖橙", hex: "#e0894a" },
  { id: "rose", name: "玫瑰", hex: "#dd6a94" },
  { id: "violet", name: "紫罗", hex: "#9179d6" },
  { id: "gold", name: "金黄", hex: "#c9a13c" }
]
var DEFAULT_COLOR = "#7ec8e3"

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

function todayStartMs() {
  return startOfDay(new Date()).getTime()
}

/** to - from，单位天 */
function diffDays(from, to) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000)
}

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

function clampDay(y, m, d) {
  var mx = lunar.solarMonthDays(y, m)
  if (d > mx) return mx
  return d < 1 ? 1 : d
}

function lunarMonthMaxDay(year, month, isLeap) {
  if (isLeap && lunar.leapMonth(year) === month) return lunar.leapDays(year)
  return lunar.monthDays(year, month)
}

// ---------------------------------------------------------------- 颜色

function hex2(s, i) {
  var hi = s.charCodeAt(i)
  var lo = s.charCodeAt(i + 1)
  hi = hi < 58 ? hi - 48 : hi - 87
  lo = lo < 58 ? lo - 48 : lo - 87
  return hi * 16 + lo
}

function rgbOf(hex) {
  var s = String(hex || "").replace("#", "")
  if (s.length !== 6) return null
  return { r: hex2(s, 0), g: hex2(s, 2), b: hex2(s, 4) }
}

/** 只接受调色板内的值：旧数据/被改过的存储一律回落空串（= 主题兜底色） */
function normalizeColor(hex) {
  var s = String(hex || "").toLowerCase()
  for (var i = 0; i < COLORS.length; i++) {
    if (COLORS[i].hex.toLowerCase() === s) return COLORS[i].hex
  }
  return ""
}

function colorOf(item) {
  return normalizeColor(item && item.color) || DEFAULT_COLOR
}

/** 色块底（低透明度）：叠在页面底色上，深浅主题都只留一层薄色 */
function tintColor(hex, alpha) {
  var c = rgbOf(hex) || rgbOf(DEFAULT_COLOR)
  return "rgba(" + c.r + "," + c.g + "," + c.b + "," + alpha + ")"
}

/** 文字/进度条用色：深色主题往白提亮、浅色主题往黑压暗 */
function adaptColor(hex, isLight) {
  var c = rgbOf(hex) || rgbOf(DEFAULT_COLOR)
  var t = 0.32
  var target = isLight ? 0 : 255
  var r = Math.round(c.r + (target - c.r) * t)
  var g = Math.round(c.g + (target - c.g) * t)
  var b = Math.round(c.b + (target - c.b) * t)
  return "rgb(" + r + "," + g + "," + b + ")"
}

// ---------------------------------------------------------------- 归一化

/** 无 createdAt 的旧数据回填起点：目标日前 90 天（进度条一开始有一小段，不像假数据） */
function backfillCreatedAt(dateStr) {
  var target = parseKey(dateStr)
  if (!target) return new Date().getTime()
  var ms = dateOf(target).getTime() - 90 * 86400000
  return ms > 0 ? ms : new Date().getTime()
}

function normalizeItem(raw) {
  if (!raw) return null
  var title = String(raw.title || "").replace(/^\s+|\s+$/g, "")
  if (!title) return null
  var item = {}
  item.id = raw.id ? String(raw.id) : genId()
  item.title = title
  item.calendar = raw.calendar === "lunar" ? "lunar" : "solar"
  item.mode = raw.mode === "up" ? "up" : "down"
  item.repeat = REPEAT_LABELS[raw.repeat] ? raw.repeat : REPEAT_NONE
  item.enabled = raw.enabled !== false
  item.pinnedHome = raw.pinnedHome === true
  item.color = normalizeColor(raw.color)
  item.created = (raw.created && isFinite(Number(raw.created))) ? Number(raw.created) : new Date().getTime()
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

  item.createdAt = (raw.createdAt && isFinite(Number(raw.createdAt)))
    ? Number(raw.createdAt)
    : backfillCreatedAt(item.date)
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

/** 编辑器保存时用：编辑态（年月日 + 类型 + 重复 + 颜色 + 模式）→ 完整 item */
function createItem(fields) {
  if (!fields) return null
  var today = startOfDay(new Date())
  var title = String(fields.title || "").replace(/^\s+|\s+$/g, "")
  if (!title) return null

  var item = {
    id: fields.id || genId(),
    title: title,
    calendar: fields.calendar === "lunar" ? "lunar" : "solar",
    mode: fields.mode === "up" ? "up" : "down",
    repeat: REPEAT_LABELS[fields.repeat] ? fields.repeat : REPEAT_NONE,
    enabled: fields.enabled !== false,
    pinnedHome: fields.pinnedHome === true,
    color: normalizeColor(fields.color),
    createdAt: (fields.createdAt && isFinite(Number(fields.createdAt))) ? Number(fields.createdAt) : new Date().getTime(),
    created: (fields.created && isFinite(Number(fields.created))) ? Number(fields.created) : new Date().getTime(),
    lunar: null,
    date: ""
  }

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

// ---------------------------------------------------------------- 演示数据

/**
 * 首次使用播种 3 条：一条只讲一件事 ——
 *   期末冲刺 → 未来目标（倒数 + 进度条）
 *   旅行出发 → 远期倒数
 *   背单词   → 正计时（N 天前）
 * 标题一律 ≤5 字（卡片标题列只有 6P，长名会把数字挤掉）。
 * 只在「从未写过数据」时播一次，用独立标记，用户自己清空后不再塞回。
 */
var SEED_FLAG = "countdownSeeded.v3"

function offsetDateStr(offsetDays) {
  var t = new Date(todayStartMs() + offsetDays * 86400000)
  return { year: t.getFullYear(), month: t.getMonth() + 1, day: t.getDate() }
}

function buildDemoSeeds() {
  var d1 = offsetDateStr(30)
  var d2 = offsetDateStr(100)
  var d3 = offsetDateStr(-100)
  var out = []
  var a = createItem({
    title: "期末冲刺", year: d1.year, month: d1.month, day: d1.day,
    color: "#e0894a", pinnedHome: true, createdAt: todayStartMs() - 60 * 86400000
  })
  var b = createItem({
    title: "旅行出发", year: d2.year, month: d2.month, day: d2.day, color: "#4aa3d8"
  })
  var c = createItem({
    title: "背单词", year: d3.year, month: d3.month, day: d3.day,
    color: "#3aa87a", mode: "up", createdAt: todayStartMs() - 100 * 86400000
  })
  if (a) out.push(a)
  if (b) out.push(b)
  if (c) out.push(c)
  return out
}

// ---------------------------------------------------------------- 存储

function emptyObject() {
  return { version: 3, items: [] }
}

function saveList(list, cb) {
  var storage = require("@system.storage")
  var clean = []
  for (var i = 0; i < list.length; i++) {
    var it = normalizeItem(list[i])
    if (it) clean.push(it)
  }
  var obj = emptyObject()
  obj.items = clean
  storage.set({
    key: KEY,
    value: JSON.stringify(obj),
    success: function() { if (cb) cb() },
    fail: function() { if (cb) cb() }
  })
}

/**
 * 读取：v3 → v2 → 裸数组（逐级回落并升级落盘）。
 * 判据放在「值是否为空」而不是回调分支上：Vela 的 storage.get 在键不存在时
 * 可能走 success("") 而不是 fail()。
 */
function loadList(cb) {
  var storage = require("@system.storage")

  function seedIfNeeded(items) {
    storage.get({
      key: SEED_FLAG,
      success: function(flag) {
        if (flag) { cb(items); return }
        var seeds = buildDemoSeeds()
        if (!seeds.length) { cb(items); return }
        saveList(seeds, function() {
          storage.set({ key: SEED_FLAG, value: "1", success: function() {}, fail: function() {} })
          cb(normalizeList(seeds))
        })
      },
      fail: function() { cb(items) }
    })
  }

  function readLegacy() {
    storage.get({
      key: LEGACY_KEY,
      success: function(data) {
        var raw = []
        if (data) {
          try { raw = JSON.parse(data) } catch (e) { raw = [] }
        }
        var items = normalizeList(Array.isArray(raw) ? raw : [])
        if (!items.length) { seedIfNeeded(items); return }
        saveList(items, function() { cb(items) })
      },
      fail: function() { seedIfNeeded([]) }
    })
  }

  function readV2() {
    storage.get({
      key: V2_KEY,
      success: function(data) {
        if (!data) { readLegacy(); return }
        try {
          var obj = JSON.parse(data)
          var items = normalizeList(Array.isArray(obj.items) ? obj.items : [])
          if (!items.length) { readLegacy(); return }
          saveList(items, function() { cb(items) })
        } catch (e) {
          readLegacy()
        }
      },
      fail: function() { readLegacy() }
    })
  }

  storage.get({
    key: KEY,
    success: function(data) {
      if (!data) { readV2(); return }
      try {
        var obj = JSON.parse(data)
        var items = normalizeList(Array.isArray(obj.items) ? obj.items : [])
        if (!items.length) { seedIfNeeded(items); return }
        cb(items)
      } catch (e) {
        readV2()
      }
    },
    fail: function() { readV2() }
  })
}

/** 钉到首页大数字（互斥：只有一个能被钉） */
function setPinned(list, id) {
  var out = []
  for (var i = 0; i < list.length; i++) {
    var src = list[i]
    var it = {}
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) it[k] = src[k]
    }
    it.pinnedHome = it.id === id ? !it.pinnedHome : false
    out.push(it)
  }
  return out
}

function findIndexById(items, id) {
  if (!items || !items.length) return -1
  var target = String(id)
  for (var i = 0; i < items.length; i++) {
    if (String(items[i].id) === target) return i
  }
  return -1
}

/** 按 id 存在则更新、不存在则追加，返回新数组（不原地改） */
function upsert(items, item) {
  var list = (items || []).slice()
  var idx = findIndexById(list, item && item.id)
  if (idx >= 0) list[idx] = item
  else list.push(item)
  return list
}

function removeById(items, id) {
  var out = []
  var idx = findIndexById(items, id)
  for (var i = 0; i < items.length; i++) {
    if (i !== idx) out.push(items[i])
  }
  return out
}

// ---------------------------------------------------------------- 计算

function lunarNextSolar(lu, lYear) {
  if (!lu) return null
  var isLeap = lu.isLeap === true && lunar.leapMonth(lYear) === lu.month
  var s = lunar.lunarToSolar(lYear, lu.month, lu.day, isLeap)
  if (!s) return null
  return { year: s.year, month: s.month, day: s.day }
}

/** 下一次发生（含今天）；repeat 只影响「算哪一天」，不改落盘 date */
function nextOccurrence(item, today) {
  var now = startOfDay(today || new Date())
  var base = parseKey(item && item.date)
  if (!base) return null
  var repeat = (item && item.repeat) || REPEAT_NONE
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
      if (m > 12) { m = 1; y = y + 1 }
      cand = { year: y, month: m, day: clampDay(y, m, day) }
    }
    res = cand
  } else {
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
 * 进度 0..1：从 createdAt 走到目标日。正计时（up）不画进度条 ——
 * 「已经坚持 N 天」没有可参照的终点，画个恒满的条只是噪音。
 */
function progressOf(item) {
  if (!item || item.mode === "up") return -1
  // 重复条目（每年/每月/每周）不画进度：base date 可能是好几年前的一天，
  // 拿它当终点会算出恒 100% 的假进度；正确做法要按「本轮发生日」重算，
  // 而每轮起点无意义（每年重复的生日没有「从哪天开始等」）。
  if (item.repeat && item.repeat !== REPEAT_NONE) return -1
  var target = parseKey(item.date)
  if (!target) return -1
  var end = dateOf(target).getTime()
  var start = (item.createdAt && isFinite(item.createdAt)) ? item.createdAt : backfillCreatedAt(item.date)
  var total = end - start
  if (total <= 0) return 1
  var p = (todayStartMs() - start) / total
  if (p < 0) return 0
  return p > 1 ? 1 : p
}

/** 状态：今天 / 进行中 / 已结束 */
function statusOf(item) {
  var d = item.daysLeft
  if (d === undefined || d === null) {
    var next = nextOccurrence(item, new Date())
    d = next ? next.daysLeft : 0
  }
  if (d < 0) return "done"
  if (d === 0) return "today"
  return "active"
}

/**
 * 给 UI 用的展示对象（不改动原 item）。文案口径：
 *   ev-six 禁「还有」「已经」这类要占整行的引导词，数字 + 单位两个词就带了方向：
 *     天后 = 未来（倒数）  天前 = 过去（正计时 / 已过期）  今天 = 当天
 */
function decorateItem(item, today) {
  var next = nextOccurrence(item, today)
  var daysLeft = next ? next.daysLeft : 0
  var isToday = daysLeft === 0
  var abs = daysLeft < 0 ? -daysLeft : daysLeft
  var colorHex = colorOf(item)
  var p = progressOf(item)

  var out = {
    id: item.id,
    title: item.title,
    calendar: item.calendar,
    mode: item.mode === "up" ? "up" : "down",
    repeat: item.repeat || REPEAT_NONE,
    repeatText: REPEAT_LABELS[item.repeat] || REPEAT_LABELS[REPEAT_NONE],
    enabled: item.enabled !== false,
    pinnedHome: item.pinnedHome === true,
    color: colorHex,
    lunar: item.lunar || null,
    date: item.date,
    daysLeft: daysLeft,
    isToday: isToday,
    isPast: daysLeft < 0,
    numText: isToday ? "今天" : "" + abs,
    unitText: isToday ? "" : (daysLeft > 0 ? "天后" : "天前"),
    daysText: isToday ? "就是今天" : (daysLeft > 0 ? "还有 " + abs + " 天" : "已过 " + abs + " 天"),
    badgeText: daysLeft >= 0 ? (daysLeft > 999 ? "999+" : "" + daysLeft) : "已过",
    progressPct: p < 0 ? -1 : Math.round(p * 100),
    dateText: "",
    nextText: "",
    nextDateText: "",
    lunarText: "",
    festival: ""
  }

  if (item.calendar === "lunar" && item.lunar) {
    out.dateText = lunar.formatLunarWithPrefix(item.lunar)
  } else {
    out.dateText = item.date
  }

  if (next) {
    out.nextDateText = toKey(next.year, next.month, next.day)
    out.lunarText = next.lunar ? lunar.formatLunarWithPrefix(next.lunar) : ""
    out.festival = lunar.lunarFestival(next.lunar) || lunar.solarFestival(next.month, next.day)
    if (out.repeat !== REPEAT_NONE) {
      out.nextText = "下次 " + out.nextDateText + (out.festival ? " " + out.festival : "")
    } else if (out.isPast && out.festival) {
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
    return arr
  }
  var now = today || new Date()
  var cache = {}
  function val(it) {
    var d = cache[it.id]
    if (!d) {
      d = decorateItem(it, now)
      cache[it.id] = d
    }
    return d.daysLeft < 0 ? 100000 + (-d.daysLeft) : d.daysLeft
  }
  arr.sort(function(a, b) {
    return val(a) - val(b)
  })
  return arr
}

/**
 * 首页大数字要展示的那一条：
 * ① 手动钉的优先 ② 否则最近的未来项 ③ 全部已过则取绝对值最小的
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
  V2_KEY: V2_KEY,
  LEGACY_KEY: LEGACY_KEY,
  REPEAT_NONE: REPEAT_NONE,
  REPEAT_WEEKLY: REPEAT_WEEKLY,
  REPEAT_MONTHLY: REPEAT_MONTHLY,
  REPEAT_YEARLY: REPEAT_YEARLY,
  REPEAT_ORDER: REPEAT_ORDER,
  REPEAT_LABELS: REPEAT_LABELS,
  MODE_DOWN: MODE_DOWN,
  MODE_UP: MODE_UP,
  MODE_LABELS: MODE_LABELS,
  COLORS: COLORS,
  DEFAULT_COLOR: DEFAULT_COLOR,
  normalizeColor: normalizeColor,
  colorOf: colorOf,
  tintColor: tintColor,
  adaptColor: adaptColor,
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
  findIndexById: findIndexById,
  upsert: upsert,
  removeById: removeById,
  removeAt: removeById,
  nextOccurrence: nextOccurrence,
  progressOf: progressOf,
  statusOf: statusOf,
  decorateItem: decorateItem,
  decorateList: decorateList,
  sortList: sortList,
  getHomeItem: getHomeItem
}
