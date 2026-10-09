const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js";
let s = fs.readFileSync(p, "utf8");
const target = ">Delete</button></td>\n              '</tr>';";
const repl = ">Delete</button></td>' +\n              '</tr>';";
if (s.indexOf(target) === -1) {
  console.log("TARGET NOT FOUND");
} else {
  s = s.replace(target, repl);
  fs.writeFileSync(p, s);
  console.log("FIXED");
}