const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html";
let s = fs.readFileSync(p, "utf8");
const anchor = 'id="bbPollLogResult" style="padding:16px;background:var(--card);border-radius:8px;min-height:60px">\n              <span class="muted">Loading...</span>\n            </div>\n          </div>\n        </div>';
const idx = s.indexOf(anchor);
if (idx === -1) { console.log("ANCHOR NOT FOUND"); process.exit(1); }
const insertAt = idx + anchor.length;
const panel = `

        <div class="panel" id="panel-bandbbs-detail">
          <div class="toolbar">
            <div>
              <h2 style="margin:0;display:flex;align-items:center;gap:8px">\ud83d\uddd1\ufe0f BandBBS \u8d44\u6e90\u8be6\u60c5</h2>
              <span class="muted" style="font-size:0.8125rem">\u67e5\u770b\u5355\u4e2a\u8d44\u6e90\u7684\u8bc4\u8bba\u3001\u661f\u7ea7\u4e0e\u5956\u52b1\u53d1\u653e\u72b6\u6001</span>
            </div>
            <span class="spacer"></span>
            <button class="btn btn-outline" onclick="loadBandBBSDetailTab()">\ud83d\udd04 \u5237\u65b0</button>
          </div>

          <div class="setting-block" style="margin-bottom:20px">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
              <label style="font-weight:600">\u9009\u62e9\u8d44\u6e90:</label>
              <select id="bbDetailResourceSelect" onchange="loadBandBBSDetail()" style="min-width:220px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)">
                <option value="">\u52a0\u8f7d\u4e2d...</option>
              </select>
              <button class="btn btn-sm" onclick="loadBandBBSDetail()">\ud83d\udcca \u67e5\u770b\u8be6\u60c5</button>
            </div>
            <div id="bbDetailResult2" style="padding:16px;background:var(--card);border-radius:8px;min-height:120px">
              <span class="muted">\u8bf7\u4e0a\u65b9\u9009\u62e9\u4e00\u4e2a\u8d44\u6e90\u67e5\u770b\u8be6\u60c5</span>
            </div>
          </div>
        </div>
`;
s = s.slice(0, insertAt) + panel + s.slice(insertAt);
fs.writeFileSync(p, s);
console.log("PANEL INSERTED");