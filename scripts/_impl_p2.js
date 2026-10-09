// Phase 3+4: JS Chinese + merge sub-tabs + filter + send-reward button
const fs = require('fs');
const file = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js';
let s = fs.readFileSync(file, 'utf8');
let changes = [];

// ==== 1) Chinese-ify JS strings in loadBandBBS ====

// Table rows: Enabled/Disabled, Scrape/Detail/Delete
s = s.replace(
  "'<td>' + (c.enabled ? '<span style=\"color:#16a34a\">Enabled</span>' : '<span style=\"color:#dc2626\">Disabled</span>') + '</td>'",
  "'<td>' + (c.enabled ? '<span style=\"color:#16a34a\">启用</span>' : '<span style=\"color:#dc2626\">停用</span>') + '</td>'"
);
s = s.replace(
  "'<td style=\"white-space:nowrap\">' +\n              '<button class=\"btn btn-sm\" onclick=\"pollSingleBandBBS(' + c.resourceId + ', this)\" style=\"margin-right:4px\">Scrape</button>' +\n              '<button class=\"btn btn-sm\" onclick=\"showBandBBSDetail(' + c.resourceId + ', this)\">Detail</button>' +\n              '<button class=\"btn btn-sm\" onclick=\"deleteBandBBSResource(' + c.resourceId + ')\" style=\"color:#dc2626;margin-left:4px\">Delete</button></td>'",
  "'<td style=\"white-space:nowrap\">' +\n              '<button class=\"btn btn-sm\" onclick=\"pollSingleBandBBS(' + c.resourceId + ', this)\" style=\"margin-right:4px\">抓取</button>' +\n              '<button class=\"btn btn-sm\" onclick=\"showBandBBSDetail(' + c.resourceId + ')\" style=\"margin-right:4px\">详情</button>' +\n              '<button class=\"btn btn-sm\" onclick=\"sendRewardForResource(' + c.resourceId + ', this)\" style=\"margin-right:4px;color:#f59e0b\">发送奖励</button>' +\n              '<button class=\"btn btn-sm\" onclick=\"deleteBandBBSResource(' + c.resourceId + ')\" style=\"color:#dc2626\">删除</button></td>'"
);
changes.push('1: table row buttons Chinese + send reward');

// No resources message
s = s.replace("'No resources configured'", "'暂无资源配置'");
changes.push('2: no resources');

// loadBandBBS error message
s = s.replace("加载失败: ", "加载失败: ");
changes.push('3: error msg');

// ==== 2) Delete switchBandBBSTab function (no more sub-tabs) ====
const subTabStart = s.indexOf('function switchBandBBSTab(tab) {');
const subTabEnd = s.indexOf('    async function triggerBandBBSPoll() {');
if (subTabStart >= 0 && subTabEnd > subTabStart) {
  // Find the closing brace of switchBandBBSTab
  let depth = 0;
  let closeIdx = -1;
  for (let i = s.indexOf('{', subTabStart) + 1; i < subTabEnd; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      if (depth === 0) { closeIdx = i + 1; break; }
      depth--;
    }
  }
  if (closeIdx >= 0) {
    // Remove the function plus trailing whitespace/newlines
    let end = closeIdx;
    while (end < s.length && /\s/.test(s[end])) end++;
    s = s.slice(0, subTabStart) + s.slice(end);
    changes.push('4: switchBandBBSTab deleted');
  }
}
changes.push('4: switchBandBBSTab removed');

// ==== 3) Chinese-ify triggerBandBBSPoll ====
s = s.replace("btn.textContent = 'Polling...'", "btn.textContent = '抓取中...'");
s = s.replace("'<div style=\"color:#16a34a;font-weight:600;margin-bottom:8px\">Poll Complete</div>' +\n          '<div>New Reviews: <b>'", "'<div style=\"color:#16a34a;font-weight:600;margin-bottom:8px\">抓取完成</div>' +\n          '<div>新增评论: <b>'");
s = s.replace("r.rewards.sent + '</b> | Skipped: <b>' + r.rewards.skipped + '</b> | Errors: <b>' + r.rewards.errors", "r.rewards.sent + '</b> | 跳过: <b>' + r.rewards.skipped + '</b> | 错误: <b>' + r.rewards.errors");
s = s.replace("'<div style=\"margin-top:4px\">Duration: ' + r.duration + 'ms</div>'", "'<div style=\"margin-top:4px\">耗时: ' + r.duration + 'ms</div>'");
s = s.replace("'<span style=\"color:#dc2626\">Poll failed: ' + ((result && result.error) || 'Unknown error') + '</span>'", "'<span style=\"color:#dc2626\">抓取失败: ' + ((result && result.error) || '未知错误') + '</span>'");
s = s.replace("'<span style=\"color:#dc2626\">Request failed: ' + (e.message || e) + '</span>'", "'<span style=\"color:#dc2626\">请求失败: ' + (e.message || e) + '</span>'");
s = s.replace("btn.textContent = 'Manual Poll'", "btn.textContent = '▶️ 手动抓取'");
s = s.replace("Resource ' + rid + ': ' + (v.error ? '<span style=\"color:#dc2626\">Error: ' + v.error + '</span>'", "'#' + rid + ': ' + (v.error ? '<span style=\"color:#dc2626\">错误: ' + v.error + '</span>'");
changes.push('5: triggerBandBBSPoll Chinese');

// ==== 4) addBandBBSResource ====
s = s.replace("alert('Please enter a Resource ID')", "alert('请输入资源ID')");
s = s.replace("alert('Failed: ' + ((result && result.error) || 'Unknown'))", "alert('失败: ' + ((result && result.error) || '未知错误'))");
s = s.replace("alert('Error: ' + (e.message || e))", "alert('错误: ' + (e.message || e))");
s = s.replace("title: title || ('Resource ' + rid)", "title: title || ('资源帖 ' + rid)");
changes.push('6: addBandBBSResource Chinese');

// ==== 5) deleteBandBBSResource ====
s = s.replace("'Delete resource ' + rid + '?'", "'删除资源帖 ' + rid + '？'");
// The 'Failed: ' alert is already handled above

// ==== 6) sendBandBBSDM ====
s = s.replace("alert('Please fill all fields')", "alert('请填写所有字段')");
s = s.replace("btn.textContent = 'Sending...'", "btn.textContent = '发送中...'");
s = s.replace("'<span style=\"color:#16a34a\">DM sent to ' + recipient + ' (Conv ID: ' + (result.conversationId || '-') + ')</span>'", "'<span style=\"color:#16a34a\">已发送给 ' + recipient + ' (会话ID: ' + (result.conversationId || '-') + ')</span>'");
s = s.replace("'<span style=\"color:#dc2626\">Send failed: ' + ((result && result.error) || 'Unknown error') + '</span>'", "'<span style=\"color:#dc2626\">发送失败: ' + ((result && result.error) || '未知错误') + '</span>'");
s = s.replace("btn.textContent = 'Send DM'", "btn.textContent = '📨 发送'");
changes.push('7: sendBandBBSDM Chinese');

// ==== 7) pollSingleBandBBS ====
s = s.replace("btnEl.textContent = '...'", "btnEl.textContent = '抓取中...'");
s = s.replace("'<div style=\"color:#16a34a;font-weight:600;margin-bottom:8px\">Scrape Complete</div>'", "'<div style=\"color:#16a34a;font-weight:600;margin-bottom:8px\">抓取完成</div>'");
s = s.replace("'<div>Resource <b>' + rid + '</b> | New: <b>' + r.newReviews + '</b> | Sent: <b>' + r.rewards.sent + '</b> | Skipped: <b>' + r.rewards.skipped + '</b> | Errors: <b>' + r.rewards.errors + '</b></div>'", "'<div>资源 <b>' + rid + '</b> | 新增: <b>' + r.newReviews + '</b> | 已发: <b>' + r.rewards.sent + '</b> | 跳过: <b>' + r.rewards.skipped + '</b> | 错误: <b>' + r.rewards.errors + '</b></div>'");
s = s.replace("'<span style=\"color:#dc2626\">Scrape failed: ' + ((result && result.error) || 'Unknown') + '</span>'", "'<span style=\"color:#dc2626\">抓取失败: ' + ((result && result.error) || '未知') + '</span>'");
s = s.replace("if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Scrape'; }", "if (btnEl) { btnEl.disabled = false; btnEl.textContent = '抓取'; }");
changes.push('8: pollSingleBandBBS Chinese');

// ==== 8) Rewrite showBandBBSDetail - filter by resource, no tab switching ====
const showDetailStart = s.indexOf('async function showBandBBSDetail(rid) {');
// Find the old function end - it ends at the closing brace before 'async function loadBandBBSPollLogs'
const pollLogsStart = s.indexOf('async function loadBandBBSPollLogs() {');
if (showDetailStart >= 0 && pollLogsStart > showDetailStart) {
  // Find the exact end of showBandBBSDetail
  let oldFn = s.substring(showDetailStart, pollLogsStart);
  let braceDepth = 0;
  let fnEnd = -1;
  for (let i = oldFn.indexOf('{') + 1; i < oldFn.length; i++) {
    if (oldFn[i] === '{') braceDepth++;
    else if (oldFn[i] === '}') {
      if (braceDepth === 0) { fnEnd = i + 1; break; }
      braceDepth--;
    }
  }
  if (fnEnd > 0) {
    let endIdx = showDetailStart + fnEnd;
    // Skip trailing whitespace
    while (endIdx < s.length && /\s/.test(s[endIdx])) endIdx++;
    
    const newFn = `async function showBandBBSDetail(rid) {
      if (!rid) return;
      // 1) Populate filter dropdown + select this resource
      var sel = document.getElementById('bbDetailResourceSelect');
      if (!sel) return;
      try {
        var result = await api('/api/admin/catalog?kind=bandbbs&op=config');
        var configs = (result && result.success && result.data) ? result.data : [];
        var opts = '<option value="">全部资源</option>';
        for (var i = 0; i < configs.length; i++) {
          var c = configs[i];
          opts += '<option value="' + c.resourceId + '">#' + c.resourceId + ' - ' + (c.title || '') + '</option>';
        }
        sel.innerHTML = opts;
        sel.value = String(rid);
      } catch (e) { /* best-effort */ }
      // 2) Load reviews filtered by this resource
      filterBandBBSReviews();
      // 3) Scroll to the review section
      var reviewSection = document.getElementById('bbReviewSection');
      if (reviewSection) reviewSection.scrollIntoView({ behavior: 'smooth' });
    }
`;
    s = s.slice(0, showDetailStart) + newFn + s.slice(endIdx);
    changes.push('9: showBandBBSDetail rewritten');
  }
}

// ==== 9) loadBandBBSPollLogs - Chinese ====
s = s.replace("box.innerHTML = '<span class=\"muted\">No records yet</span>'", "box.innerHTML = '<span class=\"muted\">暂无记录</span>'");
s = s.replace("(l.mode==='cron'?'<span style=\"color:#f59e0b\">cron</span>'", "(l.mode==='cron'?'<span style=\"color:#f59e0b\">定时</span>'");
s = s.replace(":'<span style=\"color:#16a34a\">manual</span>'", ":'<span style=\"color:#16a34a\">手动</span>'");
// Table headers
const logsTableIdx = s.indexOf('<thead><tr><th>Time</th><th>Mode</th><th>Resources</th><th>New</th><th>Sent</th></tr></thead>');
if (logsTableIdx >= 0) {
  s = s.slice(0, logsTableIdx) + '<thead><tr><th>时间</th><th>模式</th><th>资源</th><th>新增</th><th>已发</th></tr></thead>' + s.slice(logsTableIdx + '<thead><tr><th>Time</th><th>Mode</th><th>Resources</th><th>New</th><th>Sent</th></tr></thead>'.length);
}
s = s.replace("box.innerHTML = '<span class=\"muted\">No records</span>'", "box.innerHTML = '<span class=\"muted\">暂无记录</span>'");
s = s.replace("box.innerHTML = '<span class=\"muted\">Failed</span>'", "box.innerHTML = '<span class=\"muted\">加载失败</span>'");
changes.push('10: loadBandBBSPollLogs Chinese');

// ==== 10) loadBandBBSDetailTab - rewrite as loadBandBBSReviews (load all) ====
const detailTabStart = s.indexOf('async function loadBandBBSDetailTab() {');
// Find this function end
const loadDetailStart = s.indexOf('async function loadBandBBSDetail() {');
if (detailTabStart >= 0 && loadDetailStart > detailTabStart) {
  let fnBody = s.substring(detailTabStart, loadDetailStart);
  let depth = 0;
  let fnEnd = -1;
  for (let i = fnBody.indexOf('{') + 1; i < fnBody.length; i++) {
    if (fnBody[i] === '{') depth++;
    else if (fnBody[i] === '}') {
      if (depth === 0) { fnEnd = i + 1; break; }
      depth--;
    }
  }
  if (fnEnd > 0) {
    let endIdx = detailTabStart + fnEnd;
    while (endIdx < s.length && /\s/.test(s[endIdx])) endIdx++;
    
    const newFn = `async function loadBandBBSReviews() {
    // Load resource list into filter dropdown + show all reviews
    var sel = document.getElementById('bbDetailResourceSelect');
    var box = document.getElementById('bbReviewTable');
    if (!box) return;
    box.innerHTML = '<span class="muted">加载中...</span>';
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=config');
      if (result && result.success) {
        var configs = result.data || [];
        var opts = '<option value="">全部资源</option>';
        for (var i = 0; i < configs.length; i++) {
          var c = configs[i];
          opts += '<option value="' + c.resourceId + '">#' + c.resourceId + ' - ' + (c.title || '') + '</option>';
        }
        if (sel) { sel.innerHTML = opts; }
        // Load all reviews by default
        filterBandBBSReviews();
      } else if (box) {
        box.innerHTML = '<span style="color:#dc2626">加载资源列表失败</span>';
      }
    } catch (e) {
      if (box) box.innerHTML = '<span style="color:#dc2626">请求失败: ' + (e.message || e) + '</span>';
    }
  }
`;
    s = s.slice(0, detailTabStart) + newFn + s.slice(endIdx);
    changes.push('11: loadBandBBSDetailTab → loadBandBBSReviews');
  }
}

// ==== 11) loadBandBBSDetail - rewrite to support filtering all or one resource ====
const loadDStart = s.indexOf('async function loadBandBBSDetail() {');
// Find its end - it ends before the end of file
if (loadDStart >= 0) {
  // Find the end of this function + trailing whitespace
  let fnContent = s.substring(loadDStart);
  let depth = 0;
  let fnEnd = -1;
  let started = false;
  for (let i = 0; i < fnContent.length; i++) {
    if (fnContent[i] === '{') { started = true; depth++; }
    else if (fnContent[i] === '}') {
      if (started) depth--;
      if (started && depth === 0) { fnEnd = i + 1; break; }
    }
  }
  if (fnEnd > 0) {
    let endIdx = loadDStart + fnEnd;
    while (endIdx < s.length && /\s/.test(s[endIdx])) endIdx++;
    
    const newFn = `async function loadBandBBSReviewsByResource(rid, box) {
    // Load reviews for a specific resource (used by filterBandBBSReviews)
    box.innerHTML = '<span class="muted">加载中...</span>';
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=resource-detail&resourceId=' + encodeURIComponent(rid));
      if (!result || !result.success) {
        box.innerHTML = '<span style="color:#dc2626">失败: ' + ((result && result.error) || '未知') + '</span>';
        return [];
      }
      var d = result.data;
      var reviews = d.reviews || [];
      // Attach resourceId to each review for display
      for (var i = 0; i < reviews.length; i++) reviews[i]._resourceId = rid;
      return reviews;
    } catch (e) {
      box.innerHTML = '<span style="color:#dc2626">请求失败: ' + (e.message || e) + '</span>';
      return [];
    }
  }
`;
    s = s.slice(0, loadDStart) + newFn + s.slice(endIdx);
    changes.push('12: loadBandBBSDetail → loadBandBBSReviewsByResource');
  }
}

// ==== 12) Add filterBandBBSReviews function + sendRewardForResource ====
const appendIdx = s.lastIndexOf('}');
if (appendIdx >= 0) {
  const newFns = `

  async function filterBandBBSReviews() {
    var sel = document.getElementById('bbDetailResourceSelect');
    var statusFilter = document.getElementById('bbRewardFilter');
    var box = document.getElementById('bbReviewTable');
    if (!box) return;
    var rid = sel ? sel.value : '';
    var statusVal = statusFilter ? statusFilter.value : '';
    box.innerHTML = '<span class="muted">加载中...</span>';
    
    try {
      var configResult = await api('/api/admin/catalog?kind=bandbbs&op=config');
      var configs = (configResult && configResult.success && configResult.data) ? configResult.data : [];
      
      // If a specific resource selected, load only that one; else load all
      var allReviews = [];
      if (rid) {
        allReviews = await loadBandBBSReviewsByResource(rid, box);
      } else {
        // Load all resources' reviews
        for (var i = 0; i < configs.length; i++) {
          var c = configs[i];
          var rvs = await loadBandBBSReviewsByResource(c.resourceId, box);
          allReviews = allReviews.concat(rvs);
        }
      }
      
      // Apply reward status filter
      if (statusVal === 'rewarded') {
        allReviews = allReviews.filter(function(r) { return r.rewarded; });
      } else if (statusVal === 'not_rewarded') {
        allReviews = allReviews.filter(function(r) { return !r.rewarded; });
      }
      
      // Render table
      if (!allReviews.length) {
        box.innerHTML = '<span class="muted">暂无评论数据</span>';
        return;
      }
      
      var rows = '';
      for (var j = 0; j < allReviews.length; j++) {
        var rv = allReviews[j];
        var badge = rv.rewarded ? '<span style="color:#16a34a;font-weight:600">已发放</span>' : '<span style="color:#9ca3af">未发放</span>';
        var starsHtml = '';
        var starCount = (rv.stars !== undefined && rv.stars !== null) ? Number(rv.stars) : 0;
        for (var k = 0; k < 5; k++) starsHtml += k < starCount ? '★' : '☆';
        rows += '<tr>' +
          '<td style="font-size:0.75rem">#' + (rv._resourceId || '-') + '</td>' +
          '<td>' + (rv.username || '-') + '</td>' +
          '<td style="color:#f59e0b">' + starsHtml + '</td>' +
          '<td style="max-width:300px;white-space:pre-wrap;font-size:0.8125rem">' + (rv.content || '-') + '</td>' +
          '<td style="font-size:0.75rem">' + (rv.time || '-') + '</td>' +
          '<td>' + badge + '</td></tr>';
      }
      box.innerHTML = '<div style="overflow-x:auto"><table><thead><tr><th>资源</th><th>用户名</th><th>星级</th><th>内容</th><th>时间</th><th>奖励状态</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    } catch (e) {
      box.innerHTML = '<span style="color:#dc2626">加载失败: ' + (e.message || e) + '</span>';
    }
  }

  async function sendRewardForResource(rid, btnEl) {
    if (!confirm('确定要给资源帖 #' + rid + ' 的所有未奖励五星评论发送奖励私信吗？')) return;
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '发送中...'; }
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=send-rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: rid })
      });
      var box = document.getElementById('bbPollResult');
      if (result && result.success) {
        box.innerHTML = '<div style="color:#16a34a;font-weight:600;margin-bottom:8px">奖励发送完成</div>' +
          '<div>资源 <b>#' + rid + '</b> | 已发送: <b>' + (result.sent || 0) + '</b> | 跳过: <b>' + (result.skipped || 0) + '</b> | 错误: <b>' + (result.errors || 0) + '</b></div>';
        if (result.notEnough) {
          box.innerHTML += '<div style="color:#f59e0b;margin-top:4px">⚠️ 奖励池链接不足，还有 ' + result.notEnough + ' 条评论未发送</div>';
        }
      } else {
        box.innerHTML = '<span style="color:#dc2626">发送失败: ' + ((result && result.error) || '未知错误') + '</span>';
      }
    } catch (e) {
      document.getElementById('bbPollResult').innerHTML = '<span style="color:#dc2626">请求失败: ' + (e.message || e) + '</span>';
    }
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = '发送奖励'; }
    loadBandBBS();
    filterBandBBSReviews();
  }

  // Auto-load reviews when panel opens
  loadBandBBSReviews();
`;
  s = s.slice(0, appendIdx) + newFns + s.slice(appendIdx);
  changes.push('13: filterBandBBSReviews + sendRewardForResource added');
}

fs.writeFileSync(file, s);
changes.forEach(function(c) { console.log(' - ' + c); });

// Syntax check
try {
  new Function(s);
  console.log('OK JS done - syntax valid');
} catch(e) {
  console.log('SYNTAX ERROR: ' + e.message);
}

// Verify key items
console.log('Has sendRewardForResource: ' + (s.indexOf('sendRewardForResource') >= 0));
console.log('Has filterBandBBSReviews: ' + (s.indexOf('filterBandBBSReviews') >= 0));
console.log('Has loadBandBBSReviews: ' + (s.indexOf('loadBandBBSReviews') >= 0));
console.log('No switchBandBBSTab: ' + (s.indexOf('switchBandBBSTab') < 0));
console.log('No bbDetailResult2: ' + (s.indexOf('bbDetailResult2') < 0));