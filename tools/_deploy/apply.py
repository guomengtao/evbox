#!/usr/bin/env python3
"""Apply all BandBBS patches to app-auth. Writes log to _apply_log.txt in same dir."""
import sys, os, json, traceback

LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_apply_log.txt')
AUTH = '/Users/Banner/Documents/guomengtao/ev/app-auth'

def log(msg):
    with open(LOG, 'a') as f:
        f.write(msg + '\n')
    print(msg)

log('=== BandBBS Patcher ===')

# 1) catalog.js
try:
    p = os.path.join(AUTH, 'api/admin/catalog.js')
    new_content = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'catalog.js')).read()
    with open(p, 'w') as f:
        f.write(new_content)
    log('OK: catalog.js written (%d bytes)' % len(new_content))
except Exception as e:
    log('FAIL: catalog.js - %s' % traceback.format_exc())

# 2) vercel.json
try:
    p = os.path.join(AUTH, 'vercel.json')
    new_content = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vercel.json')).read()
    with open(p, 'w') as f:
        f.write(new_content)
    log('OK: vercel.json written (%d bytes)' % len(new_content))
except Exception as e:
    log('FAIL: vercel.json - %s' % traceback.format_exc())

# 3) Copy bandbbs_lib.js
try:
    src = '/Users/Banner/Documents/guomengtao/ev/evbox/scripts/bandbbs_lib.js'
    dst = os.path.join(AUTH, 'lib/bandbbs.js')
    content = open(src).read()
    with open(dst, 'w') as f:
        f.write(content)
    log('OK: bandbbs.js copied (%d bytes)' % len(content))
except Exception as e:
    log('FAIL: bandbbs.js - %s' % traceback.format_exc())

# 4) admin-health.js - add bandbbs-poll task
try:
    p = os.path.join(AUTH, 'lib/admin-health.js')
    with open(p, 'r') as f:
        content = f.read()
    new_task = '''  {
    id: "bandbbs-poll",
    name: "BandBBS Review Collect & Reward",
    description: "Poll BandBBS resource reviews every 12h and send reward DMs for new reviews",
    schedule: "0 */12 * * *",
    enabled: true,
    vercelPath: "/api/admin/catalog?kind=bandbbs&op=poll&cron=1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
'''
    idx = content.rfind('  ];')
    if idx > 0:
        content2 = content[:idx] + new_task + content[idx:]
        with open(p, 'w') as f:
            f.write(content2)
        log('OK: admin-health.js patched (was %d bytes, now %d bytes)' % (len(content), len(content2)))
    else:
        log('FAIL: admin-health.js - could not find closing bracket')
except Exception as e:
    log('FAIL: admin-health.js - %s' % traceback.format_exc())

log('=== Done ===')