const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js";
let s = fs.readFileSync(p, "utf8");
const old = "loadBandBBSPollLogs();\n    } catch (e) {\n      console.error('loadBandBBS failed:', e);\n    }";
const nw = "loadBandBBSPollLogs();\n    } catch (e) {\n      console.error('loadBandBBS failed:', e);\n      var tbody = document.getElementById('bbResourcesTable');\n      if (tbody) {\n        tbody.innerHTML = '<tr><td colspan=\"7\" class=\"empty\" style=\"color:#dc2626\">\\u52a0\\u8f7d\\u5931\\u8d25: ' + (e && e.message ? e.message : e) + '</td></tr>';\n      }\n    }";
if (s.indexOf(old) === -1) {
  console.log("NOT FOUND");
  const idx = s.indexOf("console.error('loadBandBBS failed");
  if (idx >= 0) console.log(JSON.stringify(s.slice(idx - 80, idx + 80)));
} else {
  s = s.replace(old, nw);
  fs.writeFileSync(p, s);
  console.log("FIXED");
}