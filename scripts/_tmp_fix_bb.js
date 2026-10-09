const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js";
const s = fs.readFileSync(p, "utf8");

// Verify the target line exists
const marker = "deleteBandBBSResource";
const idx = s.indexOf(marker);
console.log("marker found at", idx);
if (idx === -1) process.exit(1);

// locate the <td> containing the delete button
const tIdx = s.lastIndexOf("<td><button", idx);
console.log("td idx", tIdx);
if (tIdx === -1) process.exit(1);
// start of that td string literal begins at the quote before <td>
const lineStart = s.lastIndexOf(String.fromCharCode(39), tIdx);
// end after </td>
const edEnd = s.indexOf("</td>" + String.fromCharCode(39), tIdx);
console.log("lineStart", lineStart, "edEnd", edEnd);
if (edEnd === -1) process.exit(1);

const q = String.fromCharCode(39);
const replacement =
  "<td style=\"white-space:nowrap\">" + q + " +\n" +
  "              " + q + "<button class=\"btn btn-sm\" onclick=\"pollSingleBandBBS(\\" + q + " + c.resourceId + " + q + ", this)\" style=\"margin-right:4px\">Scrape</button>" + q + " +\n" +
  "              " + q + "<button class=\"btn btn-sm\" onclick=\"showBandBBSDetail(\\" + q + " + c.resourceId + " + q + ", this)\">Detail</button>" + q + " +\n" +
  "              " + q + "<button class=\"btn btn-sm\" onclick=\"deleteBandBBSResource(\\" + q + " + c.resourceId + " + q + ")\" style=\"color:#dc2626;margin-left:4px\">Delete</button></td>";

const newS = s.slice(0, lineStart) + replacement + s.slice(edEnd + "</td>" .length + 1);
fs.writeFileSync(p, newS);
console.log("DONE");