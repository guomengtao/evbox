/**
 * 农历换算（1900-2100），纯离线、零依赖。
 *
 * 数据来源：通用农历压缩表 lunarInfo，每年一个 20 位整数：
 *   bit 16   : 闰月天数是否为 30 天
 *   bit 15-4 : 十二个月的大小（1 = 30 天，0 = 29 天）
 *   bit 3-0  : 闰月月份（0 = 该年无闰月）
 *
 * 用途：倒数日的「农历生日 / 农历节日」的日期换算与文案。
 */
var lunarInfo = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
  0x0d520                                                                                     // 2100
]

var MIN_YEAR = 1900
var MAX_YEAR = 2100

var MONTH_NAMES = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"]
var DAY_NAMES = [
  "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
]

// 农历节日：仅在展示层用于"中秋 · 农历八月十五"这类文案
var LUNAR_FESTIVAL = {
  "1-1": "春节",
  "1-15": "元宵",
  "2-2": "龙抬头",
  "5-5": "端午",
  "7-7": "七夕",
  "7-15": "中元",
  "8-15": "中秋",
  "9-9": "重阳",
  "12-8": "腊八",
  "12-23": "小年"
}

// 公历节日
var SOLAR_FESTIVAL = {
  "1-1": "元旦",
  "2-14": "情人节",
  "3-8": "妇女节",
  "5-1": "劳动节",
  "6-1": "儿童节",
  "10-1": "国庆节",
  "12-25": "圣诞节"
}

function isSupportedYear(y) {
  return y >= MIN_YEAR && y <= MAX_YEAR
}

/** 该农历年闰几月（0 = 无闰月） */
function leapMonth(y) {
  if (!isSupportedYear(y)) return 0
  return lunarInfo[y - MIN_YEAR] & 0xf
}

/** 该农历年闰月天数（无闰月为 0） */
function leapDays(y) {
  if (!leapMonth(y)) return 0
  return (lunarInfo[y - MIN_YEAR] & 0x10000) ? 30 : 29
}

/** 该农历年第 m 月（1-12，非闰月）的天数 */
function monthDays(y, m) {
  if (!isSupportedYear(y) || m < 1 || m > 12) return 29
  return (lunarInfo[y - MIN_YEAR] & (0x10000 >> m)) ? 30 : 29
}

/** 该农历年的总天数 */
function yearDays(y) {
  if (!isSupportedYear(y)) return 354
  var sum = 348
  for (var i = 0x8000; i > 0x8; i >>= 1) {
    if (lunarInfo[y - MIN_YEAR] & i) sum++
  }
  return sum + leapDays(y)
}

/** 公历天数（该年该月） */
function solarMonthDays(y, m) {
  if (m === 2) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28
  }
  if (m === 4 || m === 6 || m === 9 || m === 11) return 30
  return 31
}

function daysFromEpoch(y, m, d) {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(MIN_YEAR, 0, 31)) / 86400000)
}

/**
 * 公历 → 农历
 * @returns {{year, month, day, isLeap}}
 */
function solarToLunar(y, m, d) {
  if (!isSupportedYear(y)) return null
  var offset = daysFromEpoch(y, m, d)
  var i
  var temp = 0
  for (i = MIN_YEAR; i < MAX_YEAR && offset > 0; i++) {
    temp = yearDays(i)
    offset -= temp
  }
  if (offset < 0) {
    offset += temp
    i--
  }
  var year = i
  var leap = leapMonth(year)
  var isLeap = false
  for (i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === leap + 1 && !isLeap) {
      --i
      isLeap = true
      temp = leapDays(year)
    } else {
      temp = monthDays(year, i)
    }
    if (isLeap && i === leap + 1) isLeap = false
    offset -= temp
  }
  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeap) {
      isLeap = false
    } else {
      isLeap = true
      --i
    }
  }
  if (offset < 0) {
    offset += temp
    --i
  }
  return { year: year, month: i, day: offset + 1, isLeap: isLeap }
}

/**
 * 农历 → 公历（日期越界会自动收敛：三十 → 廿九、闰月不存在则退回平月）
 * @returns {{year, month, day, clamped, leapApplied}}
 */
function lunarToSolar(lYear, lMonth, lDay, isLeap) {
  if (!isSupportedYear(lYear)) return null
  var month = lMonth < 1 ? 1 : (lMonth > 12 ? 12 : lMonth)
  var leap = leapMonth(lYear)
  var leapApplied = false
  if (isLeap && leap === month) leapApplied = true

  var offset = 0
  for (var y = MIN_YEAR; y < lYear; y++) offset += yearDays(y)
  for (var m = 1; m < month; m++) {
    offset += monthDays(lYear, m)
    if (leap === m) offset += leapDays(lYear)
  }
  if (leapApplied) offset += monthDays(lYear, month)

  var maxDay = leapApplied ? leapDays(lYear) : monthDays(lYear, month)
  var day = lDay < 1 ? 1 : (lDay > maxDay ? maxDay : lDay)
  var clamped = day !== lDay
  offset += day - 1

  var ms = Date.UTC(MIN_YEAR, 0, 31) + offset * 86400000
  var t = new Date(ms)
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    clamped: clamped,
    leapApplied: leapApplied
  }
}

function monthText(month, isLeap) {
  var name = MONTH_NAMES[month - 1] || (month + "")
  return (isLeap ? "闰" : "") + name + "月"
}

function dayText(day) {
  return DAY_NAMES[day - 1] || (day + "")
}

/** "三月初五" / "闰二月初一" */
function formatLunar(l) {
  if (!l) return ""
  return monthText(l.month, l.isLeap) + dayText(l.day)
}

/** "农历三月初五" */
function formatLunarWithPrefix(l) {
  if (!l) return ""
  return "农历" + formatLunar(l)
}

/** 农历节日名（含除夕），无则返回 "" */
function lunarFestival(l) {
  if (!l) return ""
  if (l.month === 12 && !l.isLeap && l.day === monthDays(l.year, 12)) return "除夕"
  return LUNAR_FESTIVAL[l.month + "-" + l.day] || ""
}

/** 公历节日名，无则返回 "" */
function solarFestival(m, d) {
  return SOLAR_FESTIVAL[m + "-" + d] || ""
}

// ---------------------------------------------------------------- 干支 / 生肖

var GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
var ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]
var ZODIAC = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"]

function modPositive(n, m) {
  return ((n % m) + m) % m
}

/** 农历年 → 干支，如 "丙午" */
function ganZhi(lYear) {
  if (!lYear) return ""
  return GAN[modPositive(lYear - 4, 10)] + ZHI[modPositive(lYear - 4, 12)]
}

/** 农历年 → 生肖，如 "马" */
function zodiac(lYear) {
  if (!lYear) return ""
  return ZODIAC[modPositive(lYear - 4, 12)]
}

/**
 * 未来节日（公历节日 + 农历节日/除夕），按临近程度排序
 * @returns {Array<{name, year, month, day, daysLeft, kind}>}
 */
function upcomingFestivals(from, limit) {
  var today = from ? new Date(from.getTime()) : new Date()
  today.setHours(0, 0, 0, 0)
  var tMs = today.getTime()
  var out = []
  var key

  function pushIfFuture(y, m, d, name, kind) {
    if (!y || !m || !d) return
    var t = new Date(y, m - 1, d, 0, 0, 0, 0)
    var diff = Math.round((t.getTime() - tMs) / 86400000)
    if (diff < 0) return
    for (var i = 0; i < out.length; i++) {
      if (out[i].name === name && out[i].year === y && out[i].month === m && out[i].day === d) return
    }
    out.push({ name: name, year: y, month: m, day: d, daysLeft: diff, kind: kind })
  }

  var solarYear = today.getFullYear()
  for (var i = 0; i < 2; i++) {
    for (key in SOLAR_FESTIVAL) {
      if (!Object.prototype.hasOwnProperty.call(SOLAR_FESTIVAL, key)) continue
      var p = key.split("-")
      pushIfFuture(solarYear + i, parseInt(p[0], 10), parseInt(p[1], 10), SOLAR_FESTIVAL[key], "solar")
    }
  }

  var cur = solarToLunar(solarYear, today.getMonth() + 1, today.getDate())
  var lYear = cur ? cur.year : solarYear
  for (var j = 0; j < 2; j++) {
    var ly = lYear + j
    for (key in LUNAR_FESTIVAL) {
      if (!Object.prototype.hasOwnProperty.call(LUNAR_FESTIVAL, key)) continue
      var p2 = key.split("-")
      var s = lunarToSolar(ly, parseInt(p2[0], 10), parseInt(p2[1], 10), false)
      if (s) pushIfFuture(s.year, s.month, s.day, LUNAR_FESTIVAL[key], "lunar")
    }
    var lastDay = monthDays(ly, 12)
    var s2 = lunarToSolar(ly, 12, lastDay, false)
    if (s2) pushIfFuture(s2.year, s2.month, s2.day, "除夕", "lunar")
  }

  out.sort(function(a, b) {
    return a.daysLeft - b.daysLeft
  })
  return out.slice(0, limit || 3)
}

module.exports = {
  MIN_YEAR: MIN_YEAR,
  MAX_YEAR: MAX_YEAR,
  isSupportedYear: isSupportedYear,
  leapMonth: leapMonth,
  leapDays: leapDays,
  monthDays: monthDays,
  yearDays: yearDays,
  solarMonthDays: solarMonthDays,
  solarToLunar: solarToLunar,
  lunarToSolar: lunarToSolar,
  formatLunar: formatLunar,
  formatLunarWithPrefix: formatLunarWithPrefix,
  lunarFestival: lunarFestival,
  solarFestival: solarFestival,
  ganZhi: ganZhi,
  zodiac: zodiac,
  upcomingFestivals: upcomingFestivals,
  monthText: monthText,
  dayText: dayText
}
