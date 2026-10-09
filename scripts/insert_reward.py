import os

file_path = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html'

reward_html = '''          <!-- Star Review Reward Pool -->
          <div class="setting-block" id="bbRewardPoolSection" style="margin-bottom:20px">
            <h3 style="margin:0 0 12px">Star Review Reward Pool</h3>
            
            <div style="padding:12px;background:var(--card);border-radius:8px;margin-bottom:12px">
              <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
                <span style="font-weight:600">Reward Product:</span>
                <span>EV Schedule Pro (0 yuan purchase)</span>
              </div>
            </div>

            <div style="padding:12px;background:var(--card);border-radius:8px;margin-bottom:12px">
              <label style="font-weight:600;display:block;margin-bottom:6px">Reward Message Template</label>
              <textarea id="bbRewardTemplate" style="width:100%;height:60px;padding:8px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink);resize:vertical">Thank you for your 5-star review! Here is a free EV Schedule Pro as a gift. Click the link to claim on Aifadian:</textarea>
              <div style="margin-top:6px;display:flex;gap:8px">
                <button class="btn btn-sm" onclick="saveRewardTemplate()">Save Template</button>
                <span id="bbTemplateStatus" style="font-size:0.75rem;color:var(--muted)"></span>
              </div>
            </div>

            <div style="padding:12px;background:var(--card);border-radius:8px;margin-bottom:12px">
              <label style="font-weight:600;display:block;margin-bottom:6px">Batch Import Reward Links</label>
              <textarea id="bbRewardImportArea" placeholder="One Aifadian redeem link per line&#10;Example:&#10;https://afdian.com/redeem/c6f06ac8a8e711f191c420&#10;https://afdian.com/redeem/c6f0174ea8e711f18c5210" style="width:100%;height:120px;padding:8px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink);resize:vertical;font-family:monospace;font-size:0.75rem"></textarea>
              <div style="margin-top:6px;display:flex;gap:8px;align-items:center">
                <button class="btn btn-sm btn-primary" onclick="importRewardLinks()">Batch Import</button>
                <span id="bbImportStatus" style="font-size:0.75rem;color:var(--muted)"></span>
              </div>
            </div>

            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;padding:10px;background:var(--surface);border-radius:8px" id="bbPoolStats">
              <span>Pool Stock: <b id="bbPoolTotal">-</b></span>
              <span>Used: <b id="bbPoolUsed">-</b></span>
              <span>Remaining: <b id="bbPoolRemaining">-</b></span>
            </div>

            <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px;background:var(--surface);border-radius:8px">
              <label style="font-weight:600;white-space:nowrap">Filter:</label>
              <select id="bbRewardLogResourceFilter" onchange="loadRewardLog()" style="min-width:160px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)">
                <option value="">All Resources</option>
              </select>
              <select id="bbRewardLogStatusFilter" onchange="loadRewardLog()" style="min-width:140px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)">
                <option value="">All Status</option>
                <option value="claimed">Claimed</option>
                <option value="unclaimed">Unclaimed</option>
              </select>
            </div>
            <div id="bbRewardLogTable" style="padding:16px;background:var(--card);border-radius:8px;min-height:80px">
              <span class="muted">Loading...</span>
            </div>
          </div>
'''

with open(file_path, 'r', encoding='utf-8') as f:
    s = f.read()

# Find the marker: after the wrapper close div before the bbTabBandbbs close
# Pattern: line with 8 spaces + </div> + empty + empty + empty + line with 8 spaces + </div>
# We insert after the first </div> (8 spaces)
import re

# Find the exact pattern
pattern = r'(id="bbReviewTable".*?</div>\s*</div>\s*</div>)\s*\n\s*\n\s*\n\s*(</div>)'

match = re.search(pattern, s, re.DOTALL)
if match:
    insert_pos = match.start(2)
    new_s = s[:insert_pos] + '\n' + reward_html + '\n' + s[insert_pos:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_s)
    print("OK: reward pool section inserted")
else:
    print("FAIL: pattern not found")
    # Debug: find bbReviewTable position
    idx = s.find('bbReviewTable')
    if idx >= 0:
        print("bbReviewTable found at index", idx)
        print("Context around it:")
        print(repr(s[idx:idx+500]))
    else:
        print("bbReviewTable NOT FOUND at all")