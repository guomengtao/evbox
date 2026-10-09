const fs = require('fs');
const file = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html';
let s = fs.readFileSync(file, 'utf8');

// Find the unique comment + section end
const oldSection = `          <!-- Review Detail Section -->
          <div class="setting-block" id="bbReviewSection" style="margin-bottom:20px">
            <h3 style="margin:0 0 12px">`;
const idx = s.indexOf(oldSection);
console.log('Found at index:', idx);
if (idx >= 0) {
  console.log('Context after:', JSON.stringify(s.substring(idx + oldSection.length, idx + oldSection.length + 300)));
}