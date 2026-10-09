# Fix TEST_MODE reference in catalog.js
path = '/Users/Banner/Documents/guomengtao/ev/app-auth/api/admin/catalog.js'
with open(path, 'r', encoding='utf-8') as f:
    s = f.read()

s = s.replace(
    "bandbbs.sendRewards(require(\"../../lib/redis\"), rid, TEST_MODE)",
    "bandbbs.sendRewards(require(\"../../lib/redis\"), rid, true)"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(s)
print("Fixed TEST_MODE in catalog.js")