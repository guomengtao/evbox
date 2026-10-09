#!/usr/bin/env python3
"""Copy admin-bandbbs.js and add script tag to admin_Dx23.html"""
import shutil, os

# 1) Copy JS file
src = '/Users/Banner/Documents/guomengtao/ev/evbox/_deploy/admin-bandbbs.js'
dst = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin-bandbbs.js'
shutil.copy2(src, dst)
print('Copied:', os.path.getsize(dst), 'bytes')

# 2) Add script tag to admin_Dx23.html
html_path = '/Users/Banner/Documents/guomengtao/ev/app-auth/admin_Dx23.html'
with open(html_path, 'r') as f:
    content = f.read()

old = '</body>'
new = '<script src="admin-bandbbs.js"></script>\n</body>'

if 'admin-bandbbs.js' in content:
    print('SKIP: Script tag already exists')
elif old in content:
    content = content.replace(old, new, 1)
    with open(html_path, 'w') as f:
        f.write(content)
    print('OK: Script tag added to admin_Dx23.html')
else:
    print('FAIL: </body> not found')

print('DONE')