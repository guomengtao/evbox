const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html";
const s = fs.readFileSync(p, "utf8");
const out = [];
// locate key anchors
const statsBar = s.indexOf('id="bandbbsStats"');
const configCmt = s.indexOf('<!-- Resource Config Section -->');
const pollRec = s.indexOf('bbPollLogResult');
const detailPanel = s.indexOf('id="panel-bandbbs-detail"');
out.push("statsBar:", statsBar);
out.push("configCmt:", configCmt);
out.push("pollRec:", pollRec);
out.push("detailPanel:", detailPanel);
// panel-bandbbs closing: after pollRec block. Find the structure around pollRec
out.push("--- around pollRec ---");
out.push(JSON.stringify(s.slice(pollRec-80, pollRec+320)));
// detail panel content and its closing before </main>
out.push("--- detailPanel region (from detailPanel-30) ---");
out.push(JSON.stringify(s.slice(detailPanel-30, detailPanel+760)));
fs.writeFileSync("/Users/Banner/Documents/guomengtao/ev/evbox/_probe_out2.txt", out.join("\n"));
console.log("written");