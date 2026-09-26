/**
 * 计算器内核（纯函数，无 UI / 无 @system 依赖，便于单测）
 *
 * 设计要点：
 * - 不使用 eval / Function（JSC 字节码环境不适用）
 * - 浮点结果统一收敛到 1e-10，避免 0.30000000000000004 这类脏值
 * - 除法先判 0，绝不产生 Infinity / NaN
 */

var MAX_DIGITS = 12

/** 浮点收敛：消除二进制浮点误差 */
function round10(v) {
  if (!isFinite(v)) return 0
  return Math.round(v * 1e10) / 1e10
}

function toNum(s) {
  var v = parseFloat(s)
  return isNaN(v) ? 0 : v
}

/** 数字 → 显示字符串（超长自动转科学计数法，保留 4 位小数） */
function fmtNum(v) {
  if (!isFinite(v)) return "0"
  var r = round10(v)
  var s = "" + r
  if (s.indexOf("e") >= 0) {
    var e = r.toExponential ? r.toExponential(4) : s
    s = e.replace("e+", "e")
  }
  return s
}

/** 有效数字位数（不含符号与小数点） */
function digitCount(s) {
  return (s || "").replace("-", "").replace(".", "").length
}

function canAppendDigit(s) {
  return digitCount(s) < MAX_DIGITS
}

/**
 * 二元运算
 * @returns {{ok: true, value: number} | {ok: false, error: string}}
 */
function applyOp(a, b, op) {
  var v = 0
  if (op === "+") v = a + b
  else if (op === "−") v = a - b
  else if (op === "×") v = a * b
  else if (op === "÷") {
    if (b === 0) return { ok: false, error: "不能除以 0" }
    v = a / b
  } else {
    return { ok: false, error: "未知运算符" }
  }
  if (!isFinite(v)) return { ok: false, error: "结果超出范围" }
  return { ok: true, value: round10(v) }
}

module.exports = {
  MAX_DIGITS: MAX_DIGITS,
  round10: round10,
  toNum: toNum,
  fmtNum: fmtNum,
  digitCount: digitCount,
  canAppendDigit: canAppendDigit,
  applyOp: applyOp
}
