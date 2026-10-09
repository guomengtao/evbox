const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html";
let s = fs.readFileSync(p, "utf8");
const marker = "bandbbs: { title: 'BandBBS 社区运营'";
const idx = s.indexOf(marker);
if (idx === -1) { console.log("META NOT FOUND"); process.exit(1); }
const lineStart = s.lastIndexOf("\n", idx) + 1;
const lineEnd = s.indexOf("\n", idx);
const line = s.slice(lineStart, lineEnd);
console.log("META LINE:", JSON.stringify(line));
const newMeta = "      'bandbbs-detail': { title: 'BandBBS 资源详情', sub: '\\u67e5\\u770b\\u5355\\u4e2a\\u8d44\\u6e90\\u7684\\u8bc4\\u8bba \\u00b7 \\u661f\\u7ea7 \\u00b7 \\u5956\\u52b1\\u53d1\\u653e\\u72b6\\u6001' },";
// insert at end of line after comma
s = s.slice(0, lineEnd + 1) + newMeta + "\n" + s.slice(lineEnd + 1);
fs.writeFileSync(p, s);
console.log("META INSERTED");