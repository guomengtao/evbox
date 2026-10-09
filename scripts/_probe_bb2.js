const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html";
const s = fs.readFileSync(p, "utf8");
const dIdx = s.indexOf('id="panel-bandbbs-detail"');
// show from panel-bandbbs close to detail panel start, and detail panel full to </main>
console.log("=== between bb poll records end and detail panel ===");
console.log(JSON.stringify(s.slice(191020, 191100)));
console.log("\n=== detail panel start ===");
console.log(JSON.stringify(s.slice(dIdx-20, dIdx+600)));