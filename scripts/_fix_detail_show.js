const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js";
let s = fs.readFileSync(p, "utf8");
const old = "  async function showBandBBSDetail(rid, btnEl) {\n    var box = document.getElementById('bbDetailResult');\n    if (!box) return;\n    box.style.display = 'block';\n    box.innerHTML = '<span class=\"muted\">Loading detail...</span>';";
const nw = "  async function showBandBBSDetail(rid, btnEl) {\n    var block = document.getElementById('bbDetailBlock');\n    if (block) block.style.display = 'block';\n    var box = document.getElementById('bbDetailResult');\n    if (!box) return;\n    box.innerHTML = '<span class=\"muted\">Loading detail...</span>';";
if (s.indexOf(old) === -1) {
  console.log("NOT FOUND");
  // try with different whitespace
  console.log("Looking for...");
  const idx = s.indexOf("showBandBBSDetail");
  if (idx >= 0) {
    console.log(s.slice(idx, idx + 400));
  }
} else {
  s = s.replace(old, nw);
  fs.writeFileSync(p, s);
  console.log("FIXED");
}