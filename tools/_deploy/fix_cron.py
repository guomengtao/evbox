#!/usr/bin/env python3
"""Fix cron schedule from 0 */12 * * * to 0 0 * * * (Hobby plan limit: 1/day)."""
import json, os

# 1) vercel.json
V = '/Users/Banner/Documents/guomengtao/ev/app-auth/vercel.json'
with open(V) as f:
    v = json.load(f)
for c in v.get('crons', []):
    if 'bandbbs' in c.get('path', ''):
        c['schedule'] = '0 0 * * *'
with open(V, 'w') as f:
    json.dump(v, f, indent=2, ensure_ascii=False)
print('vercel.json: schedule updated to 0 0 * * *')

# 2) admin-health.js
H = '/Users/Banner/Documents/guomengtao/ev/app-auth/lib/admin-health.js'
with open(H) as f:
    content = f.read()
content = content.replace('schedule: "0 */12 * * *"', 'schedule: "0 0 * * *"')
content = content.replace('every 12h and send', 'daily and send')
with open(H, 'w') as f:
    f.write(content)
print('admin-health.js: schedule and description updated')
print('DONE')