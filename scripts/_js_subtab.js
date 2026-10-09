const fs = require('fs');
const file = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js';
let s = fs.readFileSync(file, 'utf8');

// 1) Insert switchBandBBSTab before triggerBandBBSPoll
const trigMark = '  async function triggerBandBBSPoll() {';
const trigIdx = s.indexOf(trigMark);
if (trigIdx < 0) throw new Error('triggerBandBBSPoll not found');
const fn = '' +
'function switchBandBBSTab(tab) {\n' +
'    var cfg = document.getElementById(\'bbSubConfig\');\n' +
'    var det = document.getElementById(\'bbSubDetail\');\n' +
'    var tbCfg = document.getElementById(\'bbTabConfig\');\n' +
'    var tbDet = document.getElementById(\'bbTabDetail\');\n' +
'    if (tab === \'detail\') {\n' +
'      if (cfg) cfg.style.display = \'none\';\n' +
'      if (det) det.style.display = \'block\';\n' +
'      if (tbCfg) { tbCfg.style.color = \'var(--muted)\'; tbCfg.style.borderBottomColor = \'transparent\'; }\n' +
'      if (tbDet) { tbDet.style.color = \'var(--accent-text)\'; tbDet.style.borderBottomColor = \'var(--accent)\'; }\n' +
'      loadBandBBSDetailTab();\n' +
'    } else {\n' +
'      if (det) det.style.display = \'none\';\n' +
'      if (cfg) cfg.style.display = \'block\';\n' +
'      if (tbDet) { tbDet.style.color = \'var(--muted)\'; tbDet.style.borderBottomColor = \'transparent\'; }\n' +
'      if (tbCfg) { tbCfg.style.color = \'var(--accent-text)\'; tbCfg.style.borderBottomColor = \'var(--accent)\'; }\n' +
'    }\n' +
'  }\n' +
'\n' +
'  ';
s = s.slice(0, trigIdx) + fn + s.slice(trigIdx);
console.log('switchBandBBSTab inserted');

// 2) Rewrite showBandBBSDetail to jump to detail subtab
const sbStart = s.indexOf('async function showBandBBSDetail(rid, btnEl) {');
const sbEndMark = '\n\n  async function loadBandBBSPollLogs()';
if (sbStart < 0) throw new Error('showBandBBSDetail start not found');
const sbEnd = s.indexOf(sbEndMark, sbStart);
if (sbEnd < 0) throw new Error('showBandBBSDetail end not found');
const newShow = '' +
'async function showBandBBSDetail(rid) {\n' +
'  switchBandBBSTab(\'detail\');\n' +
'  var sel = document.getElementById(\'bbDetailResourceSelect\');\n' +
'  var box = document.getElementById(\'bbDetailResult2\');\n' +
'  if (!sel || !box) return;\n' +
'  if (box) box.innerHTML = \'<span class="muted">\\u52a0\\u8f7d\\u4e2d...</span>\';\n' +
'  try {\n' +
'    var result = await api(\'/api/admin/catalog?kind=bandbbs&op=config\');\n' +
'    var configs = (result && result.success && result.data) ? result.data : [];\n' +
'    var opts = \'<option value="">-- \\u8bf7\\u9009\\u62e9\\u8d44\\u6e90 --</option>\';\n' +
'    for (var i = 0; i < configs.length; i++) {\n' +
'      var c = configs[i];\n' +
'      opts += \'<option value="\' + c.resourceId + \'">#\' + c.resourceId + \' - \' + (c.title || \'\') + \'</option>\';\n' +
'    }\n' +
'    sel.innerHTML = opts;\n' +
'    sel.value = String(rid);\n' +
'    loadBandBBSDetail();\n' +
'  } catch (e) {\n' +
'    if (box) box.innerHTML = \'<span style="color:#dc2626">\\u8bf7\\u6c42\\u5931\\u8d25: \' + (e.message || e) + \'</span>\';\n' +
'  }\n' +
'}\n';
s = s.slice(0, sbStart) + newShow + s.slice(sbStart);
console.log('showBandBBSDetail rewritten');

fs.writeFileSync(file, s);
console.log('OK done');