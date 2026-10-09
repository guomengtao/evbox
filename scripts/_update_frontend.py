path = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js'
with open(path, 'r', encoding='utf-8') as f:
    s = f.read()

# Find the last closing brace (end of main function)
last_brace = s.rfind('}')
if last_brace < 0:
    print("ERROR: no closing brace")
else:
    new_functions = '''
  // ── Reward Pool Functions ──

  // Save reward message template
  async function saveRewardTemplate() {
    var template = document.getElementById('bbRewardTemplate').value.trim();
    var statusEl = document.getElementById('bbTemplateStatus');
    if (!template) { statusEl.textContent = 'Template cannot be empty'; return; }
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=reward-pool-save-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: template })
      });
      if (result && result.success) {
        statusEl.textContent = 'Saved';
        setTimeout(function() { statusEl.textContent = ''; }, 2000);
      } else {
        statusEl.textContent = 'Failed: ' + ((result && result.error) || 'unknown');
      }
    } catch (e) {
      statusEl.textContent = 'Error: ' + (e.message || e);
    }
  }

  // Batch import reward links
  async function importRewardLinks() {
    var linksText = document.getElementById('bbRewardImportArea').value.trim();
    var statusEl = document.getElementById('bbImportStatus');
    if (!linksText) { statusEl.textContent = 'Please paste redeem links first'; return; }
    statusEl.textContent = 'Importing...';
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=reward-pool-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: linksText })
      });
      if (result && result.success) {
        var msg = 'Imported ' + result.imported + ' new links';
        if (result.skipped) msg += ', skipped ' + result.skipped + ' duplicates';
        if (result.errors && result.errors.length) msg += ', ' + result.errors.length + ' errors';
        statusEl.textContent = msg;
        document.getElementById('bbRewardImportArea').value = '';
        loadPoolStats();
        loadRewardLog();
      } else {
        statusEl.textContent = 'Failed: ' + ((result && result.error) || 'unknown');
      }
    } catch (e) {
      statusEl.textContent = 'Error: ' + (e.message || e);
    }
  }

  // Load reward pool stats
  async function loadPoolStats() {
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=reward-pool-stats');
      if (result && result.success && result.data) {
        var d = result.data;
        document.getElementById('bbPoolTotal').textContent = d.total;
        document.getElementById('bbPoolUsed').textContent = d.assigned;
        document.getElementById('bbPoolRemaining').textContent = d.remaining;
      }
    } catch (e) {
      console.error('loadPoolStats failed:', e);
    }
  }

  // Load reward distribution log
  async function loadRewardLog() {
    var resourceFilter = document.getElementById('bbRewardLogResourceFilter');
    var statusFilter = document.getElementById('bbRewardLogStatusFilter');
    var table = document.getElementById('bbRewardLogTable');
    if (!table) return;
    table.innerHTML = '<span class="muted">Loading...</span>';

    var resourceId = resourceFilter ? resourceFilter.value : '';
    var status = statusFilter ? statusFilter.value : '';

    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=reward-log&resourceId=' + encodeURIComponent(resourceId) + '&status=' + encodeURIComponent(status));
      if (result && result.success && result.data) {
        var logs = result.data;
        // Populate resource filter
        if (resourceFilter) {
          var configResult = await api('/api/admin/catalog?kind=bandbbs&op=config');
          var configs = (configResult && configResult.success && configResult.data) ? configResult.data : [];
          var opts = '<option value="">All Resources</option>';
          for (var i = 0; i < configs.length; i++) {
            var c = configs[i];
            opts += '<option value="' + c.resourceId + '">#' + c.resourceId + ' - ' + (c.title || '') + '</option>';
          }
          resourceFilter.innerHTML = opts;
          if (resourceId) resourceFilter.value = resourceId;
        }

        if (!logs.length) {
          table.innerHTML = '<span class="muted">No reward records</span>';
          return;
        }
        var rows = '';
        for (var j = 0; j < logs.length; j++) {
          var l = logs[j];
          var badge = l.claimed ? '<span style="color:#16a34a;font-weight:600">Claimed</span>' : '<span style="color:#f59e0b">Unclaimed</span>';
          rows += '<tr>' +
            '<td style="font-size:0.75rem">' + (l.couponCode ? l.couponCode.substring(0, 8) + '...' : '-') + '</td>' +
            '<td>' + (l.assignedTo || '-') + '</td>' +
            '<td>#' + (l.resourceId || '-') + '</td>' +
            '<td>' + (l.reviewStars || '-') + '</td>' +
            '<td>' + badge + '</td>' +
            '<td style="font-size:0.75rem">' + (l.assignedAt || '-') + '</td>' +
            '<td style="font-size:0.75rem"><a href="' + (l.goUrl || '#') + '" target="_blank" style="color:var(--accent)">' + (l.goSlug || '-') + '</a></td>' +
            '</tr>';
        }
        table.innerHTML = '<div style="overflow-x:auto"><table><thead><tr><th>Code</th><th>User</th><th>Resource</th><th>Stars</th><th>Status</th><th>Assigned At</th><th>Go Link</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
      } else {
        table.innerHTML = '<span style="color:#dc2626">Failed to load</span>';
      }
    } catch (e) {
      table.innerHTML = '<span style="color:#dc2626">Error: ' + (e.message || e) + '</span>';
    }
  }

  // Initialize reward pool section
  loadPoolStats();
  loadRewardLog();
'''

    new_s = s[:last_brace] + '\n' + new_functions + '\n' + s[last_brace:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_s)
    print("OK: admin-bandbbs.js updated")