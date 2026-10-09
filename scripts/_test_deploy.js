const { execSync } = require("child_process");
const fs = require("fs");
try {
  const r = execSync('curl -s --max-time 15 "https://app-auth.gudq.com/api/admin/catalog?kind=bandbbs&op=config"', { encoding: "utf8", timeout: 20000 });
  fs.writeFileSync("/Users/Banner/Documents/guomengtao/ev/evbox/_cfg_test.txt", r);
  console.log("OK, len=" + r.length);
} catch(e) {
  console.log("ERR: " + e.message);
}