const fs = require('fs');
const file = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js';
let s = fs.readFileSync(file, 'utf8');

// Fix the broken line
const broken = "resourcesHtml += '<div style=\"margin:4px 0\">'#' + rid + ': ' + (v.error ? '<span style=\"color:#dc2626\">错误: ' + v.error + '</span>' : v.count + ' reviews (' + (v.title || '') + ')') + '</div>';";
const fixed = "resourcesHtml += '<div style=\"margin:4px 0\">#' + rid + ': ' + (v.error ? '<span style=\"color:#dc2626\">错误: ' + v.error + '</span>' : v.count + ' reviews (' + (v.title || '') + ')') + '</div>';";

const idx = s.indexOf(broken);
if (idx >= 0) {
  s = s.slice(0, idx) + fixed + s.slice(idx + broken.length);
  console.log('Fixed broken line');
} else {
  console.log('Broken line not found, searching...');
  // Search for the pattern more loosely
  const lines = s.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("'>'#' + rid + ':'")) {
      console.log('Found at line ' + (i+1) + ': ' + lines[i].substring(0, 80));
      lines[i] = lines[i].replace("'>'#' + rid", "'>#' + rid");
      s = lines.join('\n');
      console.log('Fixed!');
      break;
    }
  }
}

fs.writeFileSync(file, s);
console.log('Done');