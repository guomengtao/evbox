const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html";
let s = fs.readFileSync(p, "utf8");

// ---- 1. Remove sidebar menu item (bandbbs-detail) ----
const menuStart = '        <li><a href="javascript:void(0)" onclick="switchTab(\'bandbbs-detail\')"';
const menuLiStart = s.indexOf(menuStart);
if (menuLiStart === -1) { console.log("MENU NOT FOUND"); process.exit(1); }
const menuLiEnd = s.indexOf("</a></li>", menuLiStart) + "</a></li>".length;
const menuLi = s.slice(menuLiStart, menuLiEnd);
console.log("menuLi:", JSON.stringify(menuLi));
// remove line (from line start to end of line)
const menuLineStart = s.lastIndexOf("\n", menuLiStart) + 1;
const menuLineEnd = s.indexOf("\n", menuLiEnd);
s = s.slice(0, menuLineStart) + s.slice(menuLineEnd + 1);

// ---- 2. Remove TAB_META row (bandbbs-detail) ----
const metaIdx = s.indexOf("'bandbbs-detail': { title");
if (metaIdx === -1) { console.log("META NOT FOUND"); process.exit(1); }
const metaLineStart = s.lastIndexOf("\n", metaIdx) + 1;
const metaLineEnd = s.indexOf("\n", metaIdx);
s = s.slice(0, metaLineStart) + s.slice(metaLineEnd + 1);

// ---- 3. Remove switchTab hook ----
const hook = "if (tab === 'bandbbs-detail') loadBandBBSDetailTab();\n      ";
if (s.indexOf(hook) === -1) { console.log("HOOK NOT FOUND"); process.exit(1); }
s = s.replace(hook, "");

fs.writeFileSync(p, s);
console.log("STEP1 done (menu/meta/hook removed)");

// Now handle the panel restructure in a second pass (run this file again won't work, so keep separate)