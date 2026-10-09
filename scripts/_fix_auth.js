const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/api/admin/catalog.js";
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  'if (op === "send-dm" || op === "config-save" || op === "config-delete" || op === "poll") {',
  'if (op === "send-dm" || op === "config-save" || op === "config-delete" || op === "poll" || op === "single-poll") {'
);
fs.writeFileSync(p, s);
console.log("AUTH_FIXED");