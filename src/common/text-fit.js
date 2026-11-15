/**
 * 文案宽度计费与语义截句（ev-six 共用口径）
 *
 * 首页槽位摘要 / 全部工具列表 / 倒数日卡片都用这一份，避免三处各写一套导致
 * 口径漂移（同一句话在 A 页完整、在 B 页被裁成残句）。
 *
 * 规则来源：
 *  - ev-six 四档字号 44 / 30 / 28 / 24，本模块只算宽度不碰字号；
 *  - 宽度按 P 计费：汉字 1.0P / 拉丁数字 0.55P / 空格 0.3P；
 *    卡片内容宽 152px 时 24px 汉字 6 字 = 144px，故单行预算 6.0P；
 *  - 手册第 8 条「禁折行、禁省略号，一行一意，宁可删字」：
 *    只在标点边界截完整分句，绝不按字符硬裁；第一分句都装不下就返回空串。
 */
function pWidth(s) {
  var p = 0
  var str = String(s || "")
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i)
    if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) p += 0.55
    else if (c === 32) p += 0.3
    else p += 1.0
  }
  return p
}

/** 去点税：tool-summaries 的 " · " 换成空格，保留词间呼吸，不改原文案 */
function cleanSummary(text) {
  return String(text || "").split(" · ").join(" ").split("·").join(" ")
}

/**
 * 语义截句：只在标点／空格边界累加完整分句，超预算就整段停。
 * 返回原文前缀（保留分句间标点），保证读起来是完整语义。
 */
function clauseFit(text, maxP) {
  var s = cleanSummary(text)
  if (!s) return ""
  var out = ""
  var buf = ""
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i)
    buf += ch
    var isBreak = "，,。、；;：:！!？? ".indexOf(ch) >= 0
    if (!isBreak && i !== s.length - 1) continue
    if (pWidth(out) + pWidth(buf) > maxP) break
    out += buf
    buf = ""
  }
  if (buf && pWidth(out) + pWidth(buf) <= maxP) out += buf
  return out.replace(/[，,、；;：:\s]+$/, "")
}

/** 单行摘要：完整语义，最多 6P（24px 卡片一行） */
function fitSummary(text) {
  return clauseFit(text, 6.0)
}

/**
 * 名称按宽度硬裁（不带省略号）：只用于「名词类」短文本（倒数日标题、工具名）。
 * 与 clauseFit 的分工：句子必须在标点边界停（否则是残句），名词只需要塞得下，
 * 少一个字仍是完整词，多一个字就折行违规。
 */
function clampP(text, maxP) {
  var s = String(text || "")
  var out = ""
  for (var i = 0; i < s.length; i++) {
    if (pWidth(out + s.charAt(i)) > maxP) break
    out += s.charAt(i)
  }
  return out.replace(/[，,、；;：:\s]+$/, "")
}

/** 示例数据前缀：「示例：」不该让示例文案吃掉标题位宽度 */
function stripExamplePrefix(s) {
  return String(s || "").replace(/^示例[:：]\s*/, "")
}

module.exports = {
  pWidth: pWidth,
  cleanSummary: cleanSummary,
  clauseFit: clauseFit,
  fitSummary: fitSummary,
  stripExamplePrefix: stripExamplePrefix
}
