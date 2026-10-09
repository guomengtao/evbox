const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html";
let s = fs.readFileSync(p, "utf8");

const detailBlock = `
          <!-- Resource Detail View -->
          <div class="setting-block" style="margin-bottom:20px;display:none" id="bbDetailBlock">
            <h3 style="margin:0 0 12px">Resource Detail</h3>
            <div id="bbDetailResult" style="padding:16px;background:var(--card);border-radius:8px;min-height:60px">
            </div>
          </div>`;

const pollLogBlock = `
          <!-- Poll Records -->
          <div class="setting-block" style="margin-bottom:20px">
            <h3 style="margin:0 0 12px">Scrape Records (last 30)</h3>
            <div id="bbPollLogResult" style="padding:16px;background:var(--card);border-radius:8px;min-height:60px">
              <span class="muted">Loading...</span>
            </div>
          </div>`;

// Insert detail block after poll results and before send test dm
const marker1 = '<!-- Send Test DM -->';
if (s.indexOf(detailBlock) === -1) {
  s = s.replace(marker1, detailBlock + '\n' + marker1);
}

// Insert poll log block after send DM block and before panel close
const marker2 = '<div id="bbDmResult" style="margin-top:10px;font-size:0.8125rem"></div>\n          </div>\n        </div>';
if (s.indexOf(pollLogBlock) === -1) {
  s = s.replace(marker2, '<div id="bbDmResult" style="margin-top:10px;font-size:0.8125rem"></div>\n          </div>\n' + pollLogBlock + '\n        </div>');
}

// Update table header colspan from 7 to 7 (still 7 columns - resourceId, title, status, count, lastPoll, new, operations)
// That's fine, still 7 columns

fs.writeFileSync(p, s);
console.log("HTML_UPDATED");