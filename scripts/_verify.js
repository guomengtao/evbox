const { execSync } = require("child_process");
const fs = require("fs");
const out = [];

function run(cmd) {
  try {
    const r = execSync(cmd, { timeout: 30000, encoding: "utf8", maxBuffer: 1024*1024 });
    out.push("=== " + cmd + " ===\n" + r.slice(0, 2000));
  } catch(e) {
    out.push("=== " + cmd + " ===\nERROR: " + (e.stderr || e.message || "").slice(0, 500));
  }
}

run('curl -s --max-time 20 "https://app-auth.gudq.com/api/admin/catalog?kind=bandbbs&op=stats"');
run('curl -s --max-time 20 "https://app-auth.gudq.com/api/admin/catalog?kind=bandbbs&op=resource-detail&resourceId=7828"');
run('curl -s --max-time 20 "https://app-auth.gudq.com/api/admin/catalog?kind=bandbbs&op=poll-logs&limit=5"');

fs.writeFileSync("/Users/Banner/Documents/guomengtao/ev/evbox/_verify_deploy.txt", out.join("\n\n"));
console.log("DONE - read _verify_deploy.txt");