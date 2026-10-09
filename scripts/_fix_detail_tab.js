const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js";
let s = fs.readFileSync(p, "utf8");
s = s.replace(/\s+$/, "");
s += `\n

  async function loadBandBBSDetailTab() {
    var sel = document.getElementById('bbDetailResourceSelect');
    var box = document.getElementById('bbDetailResult2');
    if (box) box.innerHTML = '<span class="muted">\u52a0\u8f7d\u4e2d...</span>';
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=config');
      if (result && result.success) {
        var configs = result.data || [];
        var opts = '<option value="">-- \u8bf7\u9009\u62e9\u8d44\u6e90 --</option>';
        for (var i = 0; i < configs.length; i++) {
          var c = configs[i];
          opts += '<option value="' + c.resourceId + '">#' + c.resourceId + ' - ' + (c.title || '') + '</option>';
        }
        if (sel) { sel.innerHTML = opts; }
        if (box) box.innerHTML = '<span class="muted">\u8bf7\u4e0a\u65b9\u9009\u62e9\u4e00\u4e2a\u8d44\u6e90\u67e5\u770b\u8be6\u60c5</span>';
        if (sel && sel.value) loadBandBBSDetail();
      } else if (box) {
        box.innerHTML = '<span style="color:#dc2626">\u52a0\u8f7d\u5931\u8d25: ' + ((result && result.error) || 'Unknown') + '</span>';
      }
    } catch (e) {
      if (box) box.innerHTML = '<span style="color:#dc2626">\u8bf7\u6c42\u5931\u8d25: ' + (e.message || e) + '</span>';
    }
  }

  async function loadBandBBSDetail() {
    var sel = document.getElementById('bbDetailResourceSelect');
    var box = document.getElementById('bbDetailResult2');
    if (!sel || !box) return;
    var rid = sel.value;
    if (!rid) { box.innerHTML = '<span class="muted">\u8bf7\u5148\u9009\u62e9\u4e00\u4e2a\u8d44\u6e90</span>'; return; }
    box.innerHTML = '<span class="muted">\u52a0\u8f7d\u8be6\u60c5...</span>';
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=resource-detail&resourceId=' + encodeURIComponent(rid));
      if (!result || !result.success) {
        box.innerHTML = '<span style="color:#dc2626">\u5931\u8d25: ' + ((result && result.error) || 'Unknown') + '</span>';
        return;
      }
      var d = result.data;
      var rows = '';
      var reviews = d.reviews || [];
      if (!reviews.length) {
        rows = '<tr><td colspan="5" class="empty">\u6682\u65e0\u8bc4\u8bba</td></tr>';
      } else {
        for (var i = 0; i < reviews.length; i++) {
          var rv = reviews[i];
          var badge = rv.rewarded ? '<span style="color:#16a34a;font-weight:600">Rewarded</span>' : '<span style="color:#9ca3af">Not rewarded</span>';
          rows += '<tr>' +
            '<td>' + (rv.username || '-') + '</td>' +
            '<td>' + ((rv.stars !== undefined && rv.stars !== null) ? rv.stars : (rv.rating || '-')) + '</td>' +
            '<td style="max-width:360px;white-space:pre-wrap">' + (rv.content || '-') + '</td>' +
            '<td style="font-size:0.75rem">' + (rv.time || '-') + '</td>' +
            '<td>' + badge + '</td></tr>';
        }
      }
      box.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">' +
        '<h3 style="margin:0">Resource #' + d.resourceId + ' - ' + (d.title || '') + '</h3>' +
        '<span class="muted" style="font-size:0.8125rem">\u5df2\u53d1\u5956\u52b1: ' + (d.rewardedCount || 0) + ' | \u4e0a\u6b21\u6293\u53d6: ' + (d.lastPollAt || '-') + ' | \u65b0\u589e: ' + (d.lastPollNew || 0) + '</span></div>' +
        '<div style="overflow-x:auto"><table><thead><tr><th>Username</th><th>Rating</th><th>Content</th><th>Time</th><th>Reward</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    } catch (e) {
      box.innerHTML = '<span style="color:#dc2626">\u8bf7\u6c42\u5931\u8d25: ' + (e.message || e) + '</span>';
    }
  }
`;
fs.writeFileSync(p, s);
console.log("FUNCTIONS APPENDED");