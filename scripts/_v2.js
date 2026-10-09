const { execSync } = require("child_process");
const fs = require("fs");
const out = [];
function run(cmd, cwd) {
  try {
    out.push("=== " + cmd + " ===\n" + execSync(cmd, { cwd: cwd, timeout: 20000, encoding: "utf8" }));
  } catch(e) {
    out.push("=== " + cmd + " ===\nERR: " + (e.stderr || e.message || ""));
  }
}
run("git log --oneline -3", "/Users/Banner/Documents/guomengtao/ev/app-auth");
run("git status --short", "/Users/Banner/Documents/guomengtao/ev/app-auth");
run('curl -s --max-time 15 "https://app-auth.gudq.com/api/admin/catalog?kind=bandbbs&op=resource-detail&resourceId=7828"', "/Users/Banner/Documents/guomengtao/ev/app-auth");
fs.writeFileSync("/Users/Banner/Documents/guomengtao/ev/evbox/_result.txt", out.join("\n\n"));
console.log("OK");