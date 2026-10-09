const vm = require("vm");
const fs = require("fs");
const code = fs.readFileSync("/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js", "utf8");
let out = [];
try {
  new vm.Script(code);
  out.push("NO SYNTAX ERROR");
} catch (e) {
  out.push("MSG: " + e.message);
  out.push("LINE: " + e.lineNumber + " COL: " + e.columnNumber);
  const lines = code.split("\n");
  const ln = (e.lineNumber||1) - 1;
  const col = e.columnNumber||0;
  if (lines[ln] !== undefined) {
    out.push(">>> " + lines[ln]);
    out.push("    " + " ".repeat(Math.max(0,col-1)) + "^");
  }
}
fs.writeFileSync("/Users/Banner/Documents/guomengtao/ev/evbox/_dbg_out.txt", out.join("\n"));
console.log("done");