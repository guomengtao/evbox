const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html";
const s = fs.readFileSync(p, "utf8");
const startMarker = '<div class="panel" id="panel-bandbbs">';
const endMarker = '</main>';
const startIdx = s.indexOf(startMarker);
const endIdx = s.indexOf(endMarker);
console.log("startIdx:", startIdx);
console.log("endIdx:", endIdx);
console.log("block len:", endIdx - startIdx);
// print the tail of the block (from panel-bandbbs-detail end to </main>)
const detailMarker = 'id="panel-bandbbs-detail"';
const dIdx = s.indexOf(detailMarker);
console.log("detailIdx:", dIdx);
// find the closing </div> of panel-bandbbs-detail followed by blank lines then </div> then </main>
const tail = s.slice(endIdx - 120, endIdx);
console.log("TAIL:", JSON.stringify(tail));