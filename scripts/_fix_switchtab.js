const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html";
let s = fs.readFileSync(p, "utf8");
const marker = "if (tab === 'bandbbs') loadBandBBS();";
if (s.indexOf(marker) === -1) { console.log("LOADLINE NOT FOUND"); process.exit(1); }
const nw = "if (tab === 'bandbbs') loadBandBBS();\n      if (tab === 'bandbbs-detail') loadBandBBSDetailTab();";
s = s.split(marker).join(nw);
fs.writeFileSync(p, s);
console.log("SWITCH HOOK ADDED");