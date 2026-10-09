const fs = require('fs');
const file = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js';
let s = fs.readFileSync(file, 'utf8');
const mark = 'async function showBandBBSDetail(rid, btnEl) {';
const start = s.indexOf(mark);
if (start < 0) throw new Error('dup not found');
const endMark = '  async function loadBandBBSPollLogs()';
const end = s.indexOf(endMark, start);
if (end < 0) throw new Error('end not found');
// remove from start up to (not including) endMark
s = s.slice(0, start) + s.slice(end);
// also clean leading blank line before old function if present
s = s.replace('}\n\n\n  async function loadBandBBSPollLogs()', '}\n\n  async function loadBandBBSPollLogs()');
fs.writeFileSync(file, s);
console.log('dup removed');