const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js";
let s = fs.readFileSync(p, "utf8");

const extra = `

  async function pollSingleBandBBS(rid, btnEl) {
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '...'; }
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=single-poll&resourceId=' + encodeURIComponent(rid));
      var box = document.getElementById('bbPollResult');
      if (result && result.success) {
        var r = result.results;
        var keys = Object.keys(r.resources || {});
        var h = '';
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i], v = r.resources[k];
          h += '<div style="margin:4px 0">#' + k + ': ' + (v.error ? '<span style="color:#dc2626">Error: ' + v.error + '</span>' : v.count + ' reviews') + '</div>';
        }
        box.innerHTML = '<div style="color:#16a34a;font-weight:600;margin-bottom:8px">Scrape Complete</div>' +
          '<div>Resource <b>' + rid + '</b> | New: <b>' + r.newReviews + '</b> | Sent: <b>' + r.rewards.sent + '</b> | Skipped: <b>' + r.rewards.skipped + '</b> | Errors: <b>' + r.rewards.errors + '</b></div>' +
          '<div style="margin-top:4px">' + r.duration + 'ms</div><div style="margin-top:8px">' + h + '</div>';
      } else {
        box.innerHTML = '<span style="color:#dc2626">Scrape failed: ' + ((result && result.error) || 'Unknown') + '</span>';
      }
    } catch (e) {
      document.getElementById('bbPollResult').innerHTML = '<span style="color:#dc2626">Request failed: ' + (e.message || e) + '</span>';
    }
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Scrape'; }
    loadBandBBS();
  }

  async function showBandBBSDetail(rid, btnEl) {
    var box = document.getElementById('bbDetailResult');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = '<span class="muted">Loading detail...</span>';
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=resource-detail&resourceId=' + encodeURIComponent(rid));
      if (result && result.success) {
        var d = result.data;
        var rows = '';
        var reviews = d.reviews || [];
        if (!reviews.length) {
          rows = '<tr><td colspan="5" class="empty">No reviews stored yet</td></tr>';
        } else {
          for (var i = 0; i < reviews.length; i++) {
            var rv = reviews[i];
            var badge = rv.rewarded ? '<span style="color:#16a34a;font-weight:600">Rewarded</span>' : '<span style="color:#9ca3af">Not rewarded</span>';
            rows += '<tr>' +
              '<td>' + (rv.username || '-') + '</td>' +
              '<td>' + (rv.stars || (rv.rating || '-')) + '</td>' +
              '<td style="max-width:320px;white-space:pre-wrap">' + (rv.content || '-') + '</td>' +
              '<td style="font-size:0.75rem">' + (rv.time || '-') + '</td>' +
              '<td>' + badge + '</td></tr>';
          }
        }
        box.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
          '<h3 style="margin:0">Resource #' + d.resourceId + ' - ' + (d.title || '') + '</h3>' +
          '<span class="muted" style="font-size:0.8125rem">Last poll: ' + (d.lastPollAt || '-') + ' | New: ' + (d.lastPollNew || 0) + '</span></div>' +
          '<div style="overflow-x:auto"><table><thead><tr><th>Username</th><th>Rating</th><th>Content</th><th>Time</th><th>Reward</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
      } else {
        box.innerHTML = '<span style="color:#dc2626">Failed: ' + ((result && result.error) || 'Unknown') + '</span>';
      }
    } catch (e) {
      box.innerHTML = '<span style="color:#dc2626">Request failed: ' + (e.message || e) + '</span>';
    }
  }

  async function loadBandBBSPollLogs() {
    var box = document.getElementById('bbPollLogResult');
    if (!box) return;
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=poll-logs&limit=30');
      if (result && result.success) {
        var logs = result.data || [];
        if (!logs || !logs.length) { box.innerHTML = '<span class="muted">No records yet</span>'; return; }
        var rows = '';
        for (var i = 0; i < logs.length; i++) {
          var l = logs[i];
          var sum = (l.resources || []).map(function(x){ return '#'+x.resourceId+' ('+(x.count||0)+' reviews, new '+(x.newCount||0)+', sent '+(x.sent||0)+')'; }).join(', ');
          rows += '<tr><td style="font-size:0.75rem">'+(l.at||'-')+'</td><td>'+(l.mode==='cron'?'<span style="color:#f59e0b">cron</span>':'<span style="color:#16a34a">manual</span>')+'</td><td style="max-width:400px">'+(sum||'-')+'</td><td>'+(l.newReviews||0)+'</td><td>'+(l.rewardsSent||0)+'</td></tr>';
        }
        box.innerHTML = '<div style="overflow-x:auto"><table><thead><tr><th>Time</th><th>Mode</th><th>Resources</th><th>New</th><th>Sent</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
      } else { box.innerHTML = '<span class="muted">No records</span>'; }
    } catch (e) { box.innerHTML = '<span class="muted">Failed</span>'; }
  }
`;

// Add loadBandBBSPollLogs call to loadBandBBS
const marker1 = "    } catch (e) {\n      console.error('loadBandBBS failed:', e);";
const repl1 = "    loadBandBBSPollLogs();\n" + marker1;
if (s.indexOf(repl1) === -1) {
  s = s.replace(marker1, repl1);
}

s = s + extra;
fs.writeFileSync(p, s);
console.log("JS_UPDATED");