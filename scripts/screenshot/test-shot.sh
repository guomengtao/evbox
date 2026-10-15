#!/bin/bash
cd /Users/Banner/Documents/guomengtao/ev/evbox

echo "=== Step 1: Check emu_shot.py exists ==="
ls -la tools/emu_shot.py

echo ""
echo "=== Step 2: Check ADB device ==="
~/.vela/sdk/tools/adb/mac/adb devices

echo ""
echo "=== Step 3: Take a quick screenshot via emu_shot.py ==="
python3 tools/emu_shot.py shot /tmp/evbox_test_shot.png
ls -la /tmp/evbox_test_shot.png

echo ""
echo "=== Step 4: Run batch screenshot (single page, no MCP wait) ==="
node scripts/screenshot.js --pages pages/index --no-black-check --verbose

echo ""
echo "=== Step 5: Check output ==="
find screenshots -name "*.png" -type f 2>/dev/null || echo "No screenshots found"
echo ""
echo "EXIT=$?"