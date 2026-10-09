const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/lib/bandbbs.js";
let s = fs.readFileSync(p, "utf8");
s = s.replace("{ success: true, detail: {", "{ success: true, data: {");
fs.writeFileSync(p, s);
console.log("FIXED");