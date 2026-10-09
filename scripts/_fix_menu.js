const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html";
let s = fs.readFileSync(p, "utf8");
const marker = "onclick=\"switchTab('bandbbs')\"";
const idx = s.indexOf(marker);
if (idx === -1) { console.log("MARKER NOT FOUND"); process.exit(1); }
// find the line start
let lineStart = s.lastIndexOf("\n", idx) + 1;
let lineEnd = s.indexOf("\n", idx);
let line = s.slice(lineStart, lineEnd);
console.log("FOUND LINE:", JSON.stringify(line));
// Build insertion right after the bandbbs <li> line (which ends with </a></li>)
const liEnd = line.indexOf("</a></li>");
if (liEnd === -1) { console.log("LI END NOT FOUND"); process.exit(1); }
const insertAt = lineStart + liEnd + "</a></li>".length;
const separator = "\n        ";
const newLi = '<li><a href="javascript:void(0)" onclick="switchTab(\'bandbbs-detail\')" data-tab="bandbbs-detail"><i data-lucide="messages-square" class="menu-icon"></i><span class="menu-text">BandBBS 资源详情</span></a></li>';
s = s.slice(0, insertAt) + separator + newLi + s.slice(insertAt);
fs.writeFileSync(p, s);
console.log("INSERTED");