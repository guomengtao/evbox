// Phase 1 + 2: Chinese localization + merge sub-tabs into single view
const fs = require('fs');
const file = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html';
let s = fs.readFileSync(file, 'utf8');
let changes = [];

// ==== Phase 1: Chinese Localization ====

// 1) Sidebar: BandBBS → 米坛运营
s = s.replace('switchTab(\'bandbbs\')" data-tab="bandbbs"><i data-lucide="message-square" class="menu-icon"></i><span class="menu-text">BandBBS</span></a>',
  'switchTab(\'bandbbs\')" data-tab="bandbbs"><i data-lucide="message-square" class="menu-icon"></i><span class="menu-text">米坛运营</span></a>');
changes.push('1: sidebar 米坛运营');

// 2) TAB_META
s = s.replace('bandbbs: { title: \'BandBBS 社区运营\', sub: \'评论抓取 · 奖励私信 · 资源配置\' }',
  'bandbbs: { title: \'米坛运营\', sub: \'资源帖 · 星级评论 · 奖励发放\' }');
changes.push('2: TAB_META');

// 3) Panel title
s = s.replace('📡 BandBBS 社区运营', '📡 米坛运营');
changes.push('3: panel title');

// 4) Panel subtitle
s = s.replace('抓取BandBBS资源帖评论，自动发送奖励私信', '资源帖评论抓取 · 星级奖励发放');
changes.push('4: subtitle');

// 5) Stats labels
s = s.replace('<div class="label">监控资源帖</div>', '<div class="label">监控资源数</div>');
s = s.replace('<div class="label">已抓评论</div>', '<div class="label">已抓取评论</div>');
s = s.replace('<div class="label">已发奖励</div>', '<div class="label">已发放奖励</div>');
s = s.replace('<div class="label">上次抓取</div>', '<div class="label">上次抓取时间</div>');
changes.push('5: stats labels');

// 6) Input placeholders
s = s.replace('placeholder="Resource ID (e.g. 7828)"', 'placeholder="资源ID (例如 7828)"');
s = s.replace('placeholder="Title (optional)"', 'placeholder="标题 (选填)"');
changes.push('6: placeholders');

// 7) Table header Resource ID
s = s.replace('<th style="width:120px">Resource ID</th>', '<th style="width:120px">资源ID</th>');
changes.push('7: table header');

// 8) Poll records section
s = s.replace('<h3 style="margin:0 0 12px">Scrape Records (last 30)</h3>', '<h3 style="margin:0 0 12px">📜 抓取记录 (最近30条)</h3>');
s = s.replace('<span class="muted">Loading...</span>\n            </div>\n          </div>\n          </div>', '<span class="muted">加载中...</span>\n            </div>\n          </div>\n          </div>');
changes.push('8: poll records');

// 9) Button text - "Detail" → "详情", "Delete" → "删除"
// These are in JS so we handle them there

// ==== Phase 2: Merge sub-tabs ====

// 10) Remove sub-tab navigation bar
const navStart = '          <!-- BandBBS Sub Tabs -->';
const navEnd = '          <!-- Config Sub Tab -->\n          <div id="bbSubConfig">\n';
const navIdx = s.indexOf(navStart);
if (navIdx >= 0) {
  const endIdx = s.indexOf(navEnd, navIdx);
  if (endIdx >= 0) {
    s = s.slice(0, navIdx) + s.slice(endIdx + navEnd.length);
    changes.push('10: sub-tab nav removed');
    // Now we ALSO need to remove the bbSubConfig wrapper somehow
    // Actually the bbSubConfig div was part of the navEnd, so it's the starting point now
    // We need to find and close it properly
  }
}

// 11) Remove the bbSubConfig close tag + relocate bbSubDetail into main flow
// The structure now: navEnd consumed, so content starts right where it was.
// We need to find the closing </div> for bbSubConfig and the bbSubDetail section.

// Find: </div>  </div>  <!-- Detail Sub Tab --> (the bbSubConfig close marker before Detail Sub Tab)
const cfgClose = '          </div>\n          </div>\n\n          <!-- Detail Sub Tab -->';
const cfgIdx = s.indexOf(cfgClose);
if (cfgIdx >= 0) {
  // Replace with just a transition
  s = s.slice(0, cfgIdx) + '\n          <!-- Review Detail Section -->\n          <div class="setting-block" id="bbReviewSection" style="margin-bottom:20px">\n            <h3 style="margin:0 0 12px">🖥️ 评论详情</h3>\n            ' + s.slice(cfgIdx + cfgClose.length);
  changes.push('11: bbSubConfig close + review section');
}

// 12) Now deal with the bbSubDetail area - convert it to be always visible
// Find the bbSubDetail div and remove display:none, move it into the review section
// Current: <div id="bbSubDetail" style="display:none">
s = s.replace('<div id="bbSubDetail" style="display:none">\n            <div class="setting-block" style="margin-bottom:20px">\n              <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">\n                <label style="font-weight:600">选择资源:</label>',
  '<!-- Filter Bar -->\n            <div id="bbFilterBar" style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;padding:10px;background:var(--surface);border-radius:8px;border:1px solid var(--line)">\n              <label style="font-weight:600;white-space:nowrap">筛选:</label>');
changes.push('12: bbSubDetail → filter bar start');

// Replace select options
s = s.replace('<select id="bbDetailResourceSelect" onchange="loadBandBBSDetail()" style="min-width:220px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)">\n                  <option value="">加载中...</option>\n                </select>',
  '<select id="bbDetailResourceSelect" onchange="filterBandBBSReviews()" style="min-width:180px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)">\n              <option value="">全部资源</option>\n            </select>\n            <select id="bbRewardFilter" onchange="filterBandBBSReviews()" style="min-width:140px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)">\n              <option value="">全部状态</option>\n              <option value="rewarded">已发放</option>\n              <option value="not_rewarded">未发放</option>\n            </select>');
changes.push('13: filter selects updated');

// Remove the "查看详情" button line and the "刷新" button, replace with a collapse toggle
const btnDetail = '                <button class="btn btn-sm" onclick="loadBandBBSDetail()">📊 查看详情</button>\n';
const btnRefresh = '                <button class="btn btn-sm btn-outline" onclick="loadBandBBSDetailTab()">🔄 刷新</button>\n';
s = s.replace(btnDetail, '');
s = s.replace(btnRefresh, '');
changes.push('14: removed detail/refresh buttons');

// Close the filter bar properly
const filterClose = '              </div>\n              <div id="bbDetailResult2"';
const fcIdx = s.indexOf(filterClose);
if (fcIdx >= 0) {
  s = s.slice(0, fcIdx) + '              </div>\n' + s.slice(fcIdx + '              </div>\n'.length);
  changes.push('15: filter bar closed');
}

// Now fix the bbDetailResult2 → make it the review table container, and remove the extra wrapper divs
s = s.replace('id="bbDetailResult2"', 'id="bbReviewTable"');
s = s.replace('<span class="muted">请上方选择一个资源查看详情</span>', '<span class="muted">加载评论数据...</span>');

// Remove the extra closing divs from old bbSubDetail structure
// The structure was: <div id="bbSubDetail"> <div class="setting-block"> [content] </div> </div>
// We already opened a new setting-block wrapper, so we need to close it
const rvEnd = '<span class="muted">加载评论数据...</span>\n              </div>\n            </div>\n          </div>\n\n        </div>';
s = s.replace(rvEnd, '<span class="muted">加载评论数据...</span>\n            </div>\n          </div>\n\n        </div>');
changes.push('16: review section restructured');

// Verify with key markers
const hasSidebar = s.indexOf('米坛运营') >= 0;
const hasMeta = s.indexOf('title: \'米坛运营\'') >= 0;
const hasFilter = s.indexOf('bbFilterBar') >= 0;
const hasReviewSection = s.indexOf('bbReviewSection') >= 0;
const noSubTabs = s.indexOf('BandBBS Sub Tabs') < 0;

changes.push('VERIFY: sidebar=' + hasSidebar + ' meta=' + hasMeta + ' filter=' + hasFilter + ' review=' + hasReviewSection + ' noSubtabs=' + noSubTabs);

fs.writeFileSync(file, s);
changes.forEach(function(c) { console.log(' - ' + c); });
console.log('OK HTML done');