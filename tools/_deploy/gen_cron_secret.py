#!/usr/bin/env python3
"""Generate CRON_SECRET and add to .env and Vercel env vars."""
import subprocess, os, random, string

# Generate a random secret
secret = 'cron_' + ''.join(random.choices(string.ascii_letters + string.digits, k=32))
print('Generated CRON_SECRET:', secret)

# Add to .env
ENV = '/Users/Banner/Documents/guomengtao/ev/app-auth/.env'
with open(ENV, 'r') as f:
    content = f.read()
if 'CRON_SECRET' in content:
    print('CRON_SECRET already in .env')
else:
    with open(ENV, 'a') as f:
        f.write('\n# Cron job authentication secret\nCRON_SECRET=' + secret + '\n')
    print('Added CRON_SECRET to .env')

# Save for Vercel CLI
with open('/Users/Banner/Documents/guomengtao/ev/evbox/_deploy/_cron_secret.txt', 'w') as f:
    f.write(secret)
print('Secret saved to _cron_secret.txt for Vercel CLI')