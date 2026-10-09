const fs = require("fs");
const lines = fs.readFileSync("/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js", "utf8").split("\n");
let out = [];
for (let i = 27; i <= 35; i++) {
  const line = lines[i];
  if (line === undefined) continue;
  out.push("L" + (i + 1) + " len=" + line.length + " [" + JSON.stringify(line) + "]");
}
fs.writeFileSync("/Users/Banner/Documents/guomengtao/ev/evbox/_inspect_out.txt", out.join("\n"));
console.log("written");