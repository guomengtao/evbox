const fs = require('fs');
const s = fs.readFileSync('/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html', 'utf8');
const marker = '<div id="bbReviewTable"';
const idx = s.indexOf(marker);
let out = 'Found at index: ' + idx + '\n';
out += 'Context after (500 chars): ' + JSON.stringify(s.substring(idx, idx + 500)) + '\n';

// Find the closing </div> patterns after the review section
const closeDiv1 = '</div>\n          </div>\n\n        </div>';
const idx1 = s.indexOf(closeDiv1, idx);
out += 'closeDiv1 idx after review: ' + idx1 + '\n';

// Try to find with more flexible approach
const lines = s.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('id="bbReviewTable"')) {
    out += 'bbReviewTable at line ' + (i+1) + '\n';
    for (let j = i; j < Math.min(i + 20, lines.length); j++) {
      out += '  ' + (j+1) + ': ' + JSON.stringify(lines[j]) + '\n';
    }
    break;
  }
}

fs.writeFileSync('/Users/Banner/Documents/guomengtao/ev/evbox/_debug_output.txt', out);
console.log('Written to _debug_output.txt');