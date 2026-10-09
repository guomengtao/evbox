#!/usr/bin/env python3
"""Add BandBBS community operations panel to admin_Dx23.html"""

TARGET = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html'

with open(TARGET, 'r') as f:
    content = f.read()

# ── 1) Add sidebar menu item ──
old_sidebar = '<li><a href="javascript:void(0)" onclick="switchTab(\'settings\')" data-tab="settings"><i data-lucide="settings" class="menu-icon"></i><span class="menu-text">设置</span></a></li>'
new_sidebar = '''<li class="menu-separator"><hr></li>
        <li><a href="javascript:void(0)" onclick="switchTab('bandbbs')" data-tab="bandbbs"><i data-lucide="message-square" class="menu-icon"></i><span class="menu-text">BandBBS</span></a></li>
        <li><a href="javascript:void(0)" onclick="switchTab('settings')" data-tab="settings"><i data-lucide="settings" class="menu-icon"></i><span class="menu-text">设置</span></a></li>'''

if old_sidebar in content:
    content = content.replace(old_sidebar, new_sidebar)
    print('OK: sidebar menu item added')
else:
    print('FAIL: sidebar old string not found')

# ── 2) Add TAB_META entry ──
old_meta = "devices: { title: '已授权设备', sub: '查看并撤销桌面客户端（EvNotifier）的长期访问令牌' },"
new_meta = old_meta + "\n      bandbbs: { title: 'BandBBS 社区运营', sub: '评论抓取 · 奖励私信 · 资源配置' },"

if old_meta in content:
    content = content.replace(old_meta, new_meta)
    print('OK: TAB_META entry added')
else:
    print('FAIL: TAB_META old string not found')

# ── 3) Add switchTab handler ──
old_tab_handler = "if (tab === 'devices') loadDevices();"
new_tab_handler = old_tab_handler + "\n      if (tab === 'bandbbs') loadBandBBS();"

if old_tab_handler in content:
    content = content.replace(old_tab_handler, new_tab_handler)
    print('OK: switchTab handler added')
else:
    print('FAIL: switchTab old string not found')

# ── 4) Add bandbbs panel ──
old_panel_end = '        </div>\n        </div>\n\n      </main>'
bandbbs_panel = '''        </div>

        <div class="panel" id="panel-bandbbs">
          <div class="toolbar">
            <div>
              <h2 style="margin:0;display:flex;align-items:center;gap:8px">📡 BandBBS 社区运营</h2>
              <span class="muted" style="font-size:0.8125rem">抓取BandBBS资源帖评论，自动发送奖励私信</span>
            </div>
            <span class="spacer"></span>
            <div style="display:flex;align-items:center;gap:12px">
              <button class="btn btn-outline" onclick="loadBandBBS()">🔄 刷新</button>
              <button class="btn btn-primary" onclick="triggerBandBBSPoll()" id="btnPoll" style="background:var(--accent-bg);color:var(--accent-text)">▶️ 手动抓取</button>
            </div>
          </div>

          <!-- Stats Cards -->
          <div class="stats-bar" id="bandbbsStats" style="margin-bottom:20px">
            <div class="stat-card">
              <div class="number" id="bbStatResources">-</div>
              <div class="label">监控资源帖</div>
            </div>
            <div class="stat-card">
              <div class="number" id="bbStatReviews">-</div>
              <div class="label">已抓评论</div>
            </div>
            <div class="stat-card">
              <div class="number" id="bbStatRewards">-</div>
              <div class="label">已发奖励</div>
            </div>
            <div class="stat-card">
              <div class="number" id="bbStatLastPoll">-</div>
              <div class="label">上次抓取</div>
            </div>
          </div>

          <!-- Resource Config Section -->
          <div class="setting-block" style="margin-bottom:20px">
            <h3 style="margin:0 0 12px">📋 资源帖配置</h3>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
              <input type="text" id="bbResourceId" placeholder="Resource ID (e.g. 7828)" style="width:180px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)">
              <input type="text" id="bbResourceTitle" placeholder="Title (optional)" style="width:200px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)">
              <button class="btn btn-sm" onclick="addBandBBSResource()">➕ 添加</button>
            </div>
            <div style="overflow-x:auto">
              <table>
                <thead>
                  <tr>
                    <th style="width:120px">Resource ID</th>
                    <th>标题</th>
                    <th style="width:80px">状态</th>
                    <th style="width:120px">评论数</th>
                    <th style="width:150px">上次抓取</th>
                    <th style="width:140px">新增评论</th>
                    <th style="width:80px">操作</th>
                  </tr>
                </thead>
                <tbody id="bbResourcesTable">
                  <tr><td colspan="7" class="empty">加载中...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Poll Results -->
          <div class="setting-block" style="margin-bottom:20px">
            <h3 style="margin:0 0 12px">📊 最近抓取结果</h3>
            <div id="bbPollResult" style="padding:16px;background:var(--card);border-radius:8px;min-height:60px">
              <span class="muted">尚未执行抓取，点击"手动抓取"按钮开始</span>
            </div>
          </div>

          <!-- Send Test DM -->
          <div class="setting-block">
            <h3 style="margin:0 0 12px">✉️ 发送测试私信</h3>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <input type="text" id="bbDmRecipient" placeholder="收信人用户名" value="peipeijin" style="width:160px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)">
              <input type="text" id="bbDmTitle" placeholder="标题" value="Reward Test" style="width:160px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)">
              <input type="text" id="bbDmMessage" placeholder="内容" value="This is a test reward message from BandBBS integration." style="width:300px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)">
              <button class="btn btn-sm" onclick="sendBandBBSDM()" id="btnSendDm">📨 发送</button>
            </div>
            <div id="bbDmResult" style="margin-top:10px;font-size:0.8125rem"></div>
          </div>
        </div>

        </div>

      </main>'''

if old_panel_end in content:
    content = content.replace(old_panel_end, bandbbs_panel)
    print('OK: bandbbs panel added')
else:
    print('FAIL: panel end old string not found')

# ── 5) Add JavaScript functions ──
# Find the closing </script> tag and add functions before it
old_script_end = '  </script>\n</body>'
bandbbs_js = '''
  // ── BandBBS Community Operations ──
  async function loadBandBBS() {
    try {
      var data = await api('/api/admin/catalog?kind=bandbbs&op=stats');
      if (data && data.success && data.data) {
        var s = data.data;
        document.getElementById('bbStatResources').textContent = s.resources || 0;
        document.getElementById('bbStatReviews').textContent = s.totalReviews || 0;
        document.getElementById('bbStatRewards').textContent = s.totalRewarded || 0;
        document.getElementById('bbStatLastPoll').textContent = s.lastPoll || '-';
      }

      var configData = await api('/api/admin/catalog?kind=bandbbs&op=config');
      if (configData && configData.success && configData.data) {
        var configs = configData.data;
        var tbody = document.getElementById('bbResourcesTable');
        if (!configs || !configs.length) {
          tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无配置，请添加资源帖</td></tr>';
        } else {
          var rows = '';
          for (var i = 0; i < configs.length; i++) {
            var c = configs[i];
            rows += '<tr>' +
              '<td>' + (c.resourceId || '-') + '</td>' +
              '<td>' + (c.title || '-') + '</td>' +
              '<td>' + (c.enabled ? '<span style="color:#16a34a">启用</span>' : '<span style="color:#dc2626">禁用</span>') + '</td>' +
              '<td>' + (typeof c.lastPollCount === 'number' ? c.lastPollCount : '-') + '</td>' +
              '<td style="font-size:0.75rem">' + (c.lastPollAt || '-') + '</td>' +
              '<td>' + (typeof c.lastPollNew === 'number' ? '<span style="color:#16a34a">+' + c.lastPollNew + '</span>' : '-') + '</td>' +
              '<td><button class="btn btn-sm" onclick="deleteBandBBSResource(\'' + c.resourceId + '\')" style="color:#dc2626">删除</button></td>' +
              '</tr>';
          }
          tbody.innerHTML = rows;
        }
      }
    } catch (e) {
      console.error('loadBandBBS failed:', e);
      document.getElementById('bbPollResult').innerHTML = '<span style="color:#dc2626">加载失败: ' + (e.message || e) + '</span>';
    }
  }

  async function triggerBandBBSPoll() {
    var btn = document.getElementById('btnPoll');
    btn.disabled = true;
    btn.textContent = '⏳ 抓取中...';
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=poll');
      var box = document.getElementById('bbPollResult');
      if (result && result.success) {
        var r = result.results;
        var resourcesHtml = '';
        var resourceKeys = Object.keys(r.resources || {});
        for (var i = 0; i < resourceKeys.length; i++) {
          var rid = resourceKeys[i];
          var v = r.resources[rid];
          resourcesHtml += '<div style="margin:4px 0">📄 Resource ' + rid + ': ' + (v.error ? '<span style="color:#dc2626">Error: ' + v.error + '</span>' : v.count + ' reviews (' + (v.title || '') + ')') + '</div>';
        }
        box.innerHTML = '<div style="color:#16a34a;font-weight:600;margin-bottom:8px">✅ 抓取完成</div>' +
          '<div>新评论: <b>' + r.newReviews + '</b> | 奖励发送: <b>' + r.rewards.sent + '</b> | 跳过: <b>' + r.rewards.skipped + '</b> | 错误: <b>' + r.rewards.errors + '</b></div>' +
          '<div style="margin-top:4px">耗时: ' + r.duration + 'ms</div>' +
          '<div style="margin-top:8px">' + resourcesHtml + '</div>';
      } else {
        box.innerHTML = '<span style="color:#dc2626">抓取失败: ' + ((result && result.error) || 'Unknown error') + '</span>';
      }
    } catch (e) {
      document.getElementById('bbPollResult').innerHTML = '<span style="color:#dc2626">请求失败: ' + (e.message || e) + '</span>';
    }
    btn.disabled = false;
    btn.textContent = '▶️ 手动抓取';
    loadBandBBS();
  }

  async function addBandBBSResource() {
    var rid = document.getElementById('bbResourceId').value.trim();
    var title = document.getElementById('bbResourceTitle').value.trim();
    if (!rid) { alert('Please enter a Resource ID'); return; }
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=config-save&resourceId=' + encodeURIComponent(rid), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: rid, title: title || ('Resource ' + rid), enabled: true })
      });
      if (result && result.success) {
        document.getElementById('bbResourceId').value = '';
        document.getElementById('bbResourceTitle').value = '';
        loadBandBBS();
      } else {
        alert('Failed: ' + ((result && result.error) || 'Unknown'));
      }
    } catch (e) {
      alert('Error: ' + (e.message || e));
    }
  }

  async function deleteBandBBSResource(rid) {
    if (!confirm('Delete resource ' + rid + '?')) return;
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=config-delete&resourceId=' + encodeURIComponent(rid));
      if (result && result.success) {
        loadBandBBS();
      } else {
        alert('Failed: ' + ((result && result.error) || 'Unknown'));
      }
    } catch (e) {
      alert('Error: ' + (e.message || e));
    }
  }

  async function sendBandBBSDM() {
    var recipient = document.getElementById('bbDmRecipient').value.trim();
    var title = document.getElementById('bbDmTitle').value.trim();
    var message = document.getElementById('bbDmMessage').value.trim();
    if (!recipient || !title || !message) { alert('Please fill all fields'); return; }
    var btn = document.getElementById('btnSendDm');
    btn.disabled = true;
    btn.textContent = '⏳ 发送中...';
    try {
      var result = await api('/api/admin/catalog?kind=bandbbs&op=send-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: recipient, title: title, message: message })
      });
      var resultBox = document.getElementById('bbDmResult');
      if (result && result.success) {
        resultBox.innerHTML = '<span style="color:#16a34a">✅ 私信已发送给 ' + recipient + ' (会话ID: ' + (result.conversationId || '-') + ')</span>';
      } else {
        resultBox.innerHTML = '<span style="color:#dc2626">❌ 发送失败: ' + ((result && result.error) || 'Unknown error') + '</span>';
      }
    } catch (e) {
      document.getElementById('bbDmResult').innerHTML = '<span style="color:#dc2626">❌ 请求失败: ' + (e.message || e) + '</span>';
    }
    btn.disabled = false;
    btn.textContent = '📨 发送';
  }
  </script>
</body>'''

if old_script_end in content:
    content = content.replace(old_script_end, bandbbs_js)
    print('OK: JavaScript functions added')
else:
    print('FAIL: script end old string not found')

# Write back
with open(TARGET, 'w') as f:
    f.write(content)

print('DONE: admin_Dx23.html patched successfully')