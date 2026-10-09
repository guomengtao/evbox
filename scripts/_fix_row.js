const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js";
let s = fs.readFileSync(p, "utf8");
s = s.replace("\n              <td style=\"white-space:nowrap\">' +", "\n              '<td style=\"white-space:nowrap\">' +");
fs.writeFileSync(p, s);
console.log("FIXED");