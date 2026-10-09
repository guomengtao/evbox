#!/bin/bash
set -e
echo "=== Step 1: Copy admin-bandbbs.js ==="
cp /Users/Banner/Documents/guomengtao/ev/evbox/_deploy/admin-bandbbs.js /Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js
echo "OK: $(wc -c < /Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js) bytes"

echo "=== Step 2: Add script tag to admin_Dx23.html ==="
HTML=/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html
if grep -q "admin-bandbbs.js" "$HTML"; then
  echo "SKIP: Script tag already exists"
else
  # Insert before </body>
  sed -i '' 's|</body>|<script src="admin-bandbbs.js"></script>\
</body>|' "$HTML"
  echo "OK: Script tag added"
fi

echo "=== Step 3: Verify all pieces ==="
echo "--- admin-health.js bandbbs task ---"
grep -c "bandbbs-poll" /Users/Banner/Documents/guomengtao/ev/app-auth/lib/admin-health.js && echo "OK" || echo "MISSING"

echo "--- catalog.js bandbbs handler ---"
grep -c "handleBandBBS" /Users/Banner/Documents/guomengtao/ev/app-auth/api/admin/catalog.js && echo "OK" || echo "MISSING"

echo "--- bandbbs.js library ---"
ls -la /Users/Banner/Documents/guomengtao/ev/app-auth/lib/bandbbs.js

echo "--- vercel.json cron ---"
grep -c "bandbbs" /Users/Banner/Documents/guomengtao/ev/app-auth/vercel.json && echo "OK" || echo "MISSING"

echo "--- admin_Dx23 panel ---"
grep -c "panel-bandbbs" "$HTML" && echo "OK" || echo "MISSING"
grep -c "admin-bandbbs.js" "$HTML" && echo "OK" || echo "MISSING"

echo "=== ALL DONE ==="