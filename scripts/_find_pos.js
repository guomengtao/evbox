const fs = require('fs');
const file = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html';
let s = fs.readFileSync(file, 'utf8');

// Simple approach: the review section is inside bbTabBandbbs
// After the review section: </div>\n          </div>\n\n        </div>\n\n\n\n        </div>\n\n      </main>
// Find the review section's setting-block close and insert before the tab close

// Use a simple anchor that's unique: the bbReviewSection close followed by wrapper close
// The content between bbReviewTable and the next setting section is unique
// 
// Search for: "bbReviewSection" style=... followed by its close
const anchor = 'id="bbReviewSection"';
let idx = s.indexOf(anchor);
if (idx === -1) { console.log('NOT FOUND'); process.exit(1); }

// Count div depth from here. The setting-block div opens here.
// It will be closed by a matching </div>. The setting-block contains:
// - h3
// - bbFilterBar div 
// - bbReviewTable div
// Then closing: </div> for bbReviewTable, </div> for setting-block
// Then: </div> for wrapper, </div> for bbTabBandbbs
// 
// Let's find the FIRST </div> after the review table content that's at indentation level 10 spaces

// Actually let's just search for the end of this section
// Find '</div>\n\n        </div>\n\n\n\n        </div>'
// That's the close of some wrapper, then close of bbTabBandbbs

const wrapperClosePattern = '\n\n        </div>\n\n\n\n        </div>';
const wcpIdx = s.indexOf(wrapperClosePattern, idx);
console.log('wcpIdx:', wcpIdx);
if (wcpIdx >= 0) {
  console.log('CONTEXT:', JSON.stringify(s.substring(wcpIdx - 30, wcpIdx + 50)));
}