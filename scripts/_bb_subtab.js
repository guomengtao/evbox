const fs = require('fs');
const file = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html';
let s = fs.readFileSync(file, 'utf8');
let changed = [];

// ---------- A) Insert sub tab nav + open bbSubConfig before Stats Cards ----------
const statsMark = '          <!-- Stats Cards -->';
const statsIdx = s.indexOf(statsMark);
if (statsIdx < 0) throw new Error('Stats Cards anchor not found');
const navInsert = '' +
'          <!-- BandBBS Sub Tabs -->\n' +
'          <div class="logs-tabs" style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid var(--line,#e5e7eb);">\n' +
'            <button class="logs-tab active" onclick="switchBandBBSTab(\'config\')" id="bbTabConfig" style="padding: 8px 24px;border:none;background:none;font-size:0.875rem;font-weight:600;color: var(--accent-text);cursor:pointer;border-bottom:2px solid var(--accent);margin-bottom:-2px;transition:all 0.15s;">📋 资源配置</button>\n' +
'            <button class="logs-tab" onclick="switchBandBBSTab(\'detail\')" id="bbTabDetail" style="padding: 8px 24px;border:none;background:none;font-size:0.875rem;font-weight:600;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all 0.15s;">🖥️ 资源详情</button>\n' +
'          </div>\n' +
'\n' +
'          <!-- Config Sub Tab -->\n' +
'          <div id="bbSubConfig">\n' +
'\n';
s = s.slice(0, statsIdx) + navInsert + s.slice(statsIdx);
changed.push('A: nav+bbSubConfig inserted');

// ---------- B) Remove inline Resource Detail View (bbDetailBlock) ----------
const inlineStart = s.indexOf('          <!-- Resource Detail View -->');
if (inlineStart < 0) throw new Error('inline detail anchor not found');
const sendDM = s.indexOf('<!-- Send Test DM -->', inlineStart);
if (sendDM < 0) throw new Error('Send Test DM anchor not found');
s = s.slice(0, inlineStart) + s.slice(sendDM);
changed.push('B: inline bbDetailBlock removed');

// ---------- C) Close bbSubConfig + insert bbSubDetail before panel-bandbbs close ----------
const detailPanelIdx = s.indexOf('        <div class="panel" id="panel-bandbbs-detail">');
if (detailPanelIdx < 0) throw new Error('detail panel not found');
const panelCloseIdx = s.lastIndexOf('        </div>\n', detailPanelIdx);
if (panelCloseIdx < 0) throw new Error('panel-bandbbs close not found');
const subDetail = '' +
'          </div>\n' +
'\n' +
'          <!-- Detail Sub Tab -->\n' +
'          <div id="bbSubDetail" style="display:none">\n' +
'            <div class="setting-block" style="margin-bottom:20px">\n' +
'              <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">\n' +
'                <label style="font-weight:600">选择资源:</label>\n' +
'                <select id="bbDetailResourceSelect" onchange="loadBandBBSDetail()" style="min-width:220px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)">\n' +
'                  <option value="">加载中...</option>\n' +
'                </select>\n' +
'                <button class="btn btn-sm" onclick="loadBandBBSDetail()">📊 查看详情</button>\n' +
'                <button class="btn btn-sm btn-outline" onclick="loadBandBBSDetailTab()">🔄 刷新</button>\n' +
'              </div>\n' +
'              <div id="bbDetailResult2" style="padding:16px;background:var(--card);border-radius:8px;min-height:120px">\n' +
'                <span class="muted">请上方选择一个资源查看详情</span>\n' +
'              </div>\n' +
'            </div>\n' +
'          </div>\n' +
'\n';
s = s.slice(0, panelCloseIdx) + subDetail + s.slice(panelCloseIdx);
changed.push('C: bbSubConfig closed + bbSubDetail inserted');

// ---------- D) Remove standalone panel-bandbbs-detail ----------
const ds = s.indexOf('        <div class="panel" id="panel-bandbbs-detail">');
if (ds < 0) throw new Error('standalone detail panel not found');
const ndl = '\n        </div>';
const de = s.indexOf(ndl, ds);
if (de < 0) throw new Error('standalone detail close not found');
s = s.slice(0, ds) + s.slice(de + ndl.length);
changed.push('D: standalone detail panel removed');

fs.writeFileSync(file, s);
console.log('OK');
changed.forEach(function(c){ console.log(' - ' + c); });