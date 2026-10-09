const fs = require('fs');
const path = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html';
let s = fs.readFileSync(path, 'utf8');

// Find the unique line with bbReviewTable
const lines = s.split('\n');
let foundIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('id="bbReviewTable"')) {
    foundIdx = i;
    break;
  }
}

if (foundIdx < 0) {
  console.error('NOT FOUND');
  process.exit(1);
}

// From foundIdx, find the wrapper close div (line with 8 spaces + </div>)
// after the setting-block close (line with 10 spaces + </div>)
// The sequence is:
// foundIdx:   <div id="bbReviewTable"...
// foundIdx+1:   <span class="muted">...
// foundIdx+2:   </div> (12 spaces indented - close bbReviewTable)
// foundIdx+3:   </div> (10 spaces indented - close setting-block)
// foundIdx+4:   (empty)
// foundIdx+5:   </div> (8 spaces indented - close wrapper)
// foundIdx+6:   (empty)
// foundIdx+7:   (empty)
// foundIdx+8:   (empty)
// foundIdx+9:   </div> (8 spaces - close bbTabBandbbs)

// We want to insert after foundIdx+5 (the wrapper close)
const insertAfter = foundIdx + 5;
console.log('Insert after line', insertAfter + 1, ':', JSON.stringify(lines[insertAfter]));

const rewardHTML = `
          <!-- Star Review Reward Pool -->
          <div class="setting-block" id="bbRewardPoolSection" style="margin-bottom:20px">
            <h3 style="margin:0 0 12px">⭐ 星评奖励池</h3>
            
            <!-- Reward Product Info -->
            <div style="padding:12px;background:var(--card);border-radius:8px;margin-bottom:12px">
              <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
                <span style="font-weight:600">奖励商品:</span>
                <span>EV课程表永久高级版（0元购）</span>
              </div>
            </div>

            <!-- Reward Message Template -->
            <div style="padding:12px;background:var(--card);border-radius:8px;margin-bottom:12px">
              <label style="font-weight:600;display:block;margin-bottom:6px">奖励话术模板</label>
              <textarea id="bbRewardTemplate" style="width:100%;height:60px;padding:8px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink);resize:vertical">感谢您给予五星好评，特赠送您一个 Ev课程表永久高级版，点击链接去爱发电领取：</textarea>
              <div style="margin-top:6px;display:flex;gap:8px">
                <button class="btn btn-sm" onclick="saveRewardTemplate()">保存话术</button>
                <span id="bbTemplateStatus" style="font-size:0.75rem;color:var(--muted)"></span>
              </div>
            </div>

            <!-- Batch Import -->
            <div style="padding:12px;background:var(--card);border-radius:8px;margin-bottom:12px">
              <label style="font-weight:600;display:block;margin-bottom:6px">📥 批量导入奖励链接</label>
              <textarea id="bbRewardImportArea" placeholder="每行一个爱发电兑换链接&#10;例如:&#10;https://afdian.com/redeem/c6f06ac8a8e711f191c420&#10;https://afdian.com/redeem/c6f0174ea8e711f18c5210" style="width:100%;height:120px;padding:8px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink);resize:vertical;font-family:monospace;font-size:0.75rem"></textarea>
              <div style="margin-top:6px;display:flex;gap:8px;align-items:center">
                <button class="btn btn-sm btn-primary" onclick="importRewardLinks()">批量导入</button>
                <span id="bbImportStatus" style="font-size:0.75rem;color:var(--muted)"></span>
              </div>
            </div>

            <!-- Pool Stats -->
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;padding:10px;background:var(--surface);border-radius:8px" id="bbPoolStats">
              <span>奖励池库存: <b id="bbPoolTotal">-</b> 个</span>
              <span>已使用: <b id="bbPoolUsed">-</b> 个</span>
              <span>剩余: <b id="bbPoolRemaining">-</b> 个</span>
            </div>

            <!-- Reward Log Table with Filter -->
            <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px;background:var(--surface);border-radius:8px">
              <label style="font-weight:600;white-space:nowrap">筛选:</label>
              <select id="bbRewardLogResourceFilter" onchange="loadRewardLog()" style="min-width:160px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)">
                <option value="">全部资源</option>
              </select>
              <select id="bbRewardLogStatusFilter" onchange="loadRewardLog()" style="min-width:140px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)">
                <option value="">全部状态</option>
                <option value="claimed">已领取</option>
                <option value="unclaimed">未领取</option>
              </select>
            </div>
            <div id="bbRewardLogTable" style="padding:16px;background:var(--card);border-radius:8px;min-height:80px">
              <span class="muted">加载中...</span>
            </div>
          </div>
`;

// Insert after the wrapper close div
lines.splice(insertAfter + 1, 0, ...rewardHTML.split('\n').filter(l => l !== ''));
s = lines.join('\n');
fs.writeFileSync(path, s);
console.log('Done. Reward pool section inserted.');