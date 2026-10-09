const fs = require("fs");
const p = "/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js";

// Read original
const s = fs.readFileSync(p, "utf8");

// Replace the delete button td with three buttons
const oldMarker = '<td><button class="btn btn-sm" onclick="deleteBandBBSResource';
const tIdx = s.indexOf(oldMarker);
if (tIdx === -1) { console.log("MARKER NOT FOUND"); process.exit(1); }

// Find the opening quote of the string literal
const q = String.fromCharCode(39);
const lineStart = s.lastIndexOf(q, tIdx);

// Find the end: </td>' +
const endMarker = "</td>" + q + " +";
const endIdx = s.indexOf(endMarker, tIdx);
if (endIdx === -1) { console.log("END NOT FOUND"); process.exit(1); }

const replacement =
  '<td style="white-space:nowrap">' + q + " +\n" +
  "              " + q + '<button class="btn btn-sm" onclick="pollSingleBandBBS(' + q + ' + c.resourceId + ' + q + ', this)" style="margin-right:4px">Scrape</button>' + q + " +\n" +
  "              " + q + '<button class="btn btn-sm" onclick="showBandBBSDetail(' + q + ' + c.resourceId + ' + q + ', this)">Detail</button>' + q + " +\n" +
  "              " + q + '<button class="btn btn-sm" onclick="deleteBandBBSResource(' + q + ' + c.resourceId + ' + q + ')" style="color:#dc2626;margin-left:4px">Delete</button></td>';

const newS = s.slice(0, lineStart) + replacement + s.slice(endIdx + endMarker.length);
fs.writeFileSync(p, newS);
console.log("BUTTONS_OK");