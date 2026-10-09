const fs = require('fs');
const file = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html';
let s = fs.readFileSync(file, 'utf8');

// Fix: Add missing </div> to close poll records setting-block before Review Detail Section
s = s.replace(
  '            </div>\n\n          <!-- Review Detail Section -->',
  '            </div>\n          </div>\n\n          <!-- Review Detail Section -->'
);

fs.writeFileSync(file, s);
console.log('Fixed poll records closing div');