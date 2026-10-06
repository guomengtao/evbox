#!/bin/bash
OUT=/Users/Banner/Documents/guomengtao/ev/evbox/_login_result.txt
exec > "$OUT" 2>&1

rm -f /tmp/bb_c.txt
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

echo "=== Step 1: Fetch login page ==="
LOGIN_HTML=$(curl -s -L -c /tmp/bb_c.txt -H "User-Agent: $UA" 'https://www.bandbbs.cn/login')
echo "Page size: ${#LOGIN_HTML}"

TOKEN=$(echo "$LOGIN_HTML" | grep -oP 'name="_xfToken"\s+value="\K[^"]+')
echo "CSRF Token found: $([ -n "$TOKEN" ] && echo "YES (${TOKEN:0:40}...)" || echo "NO")"

echo ""
echo "=== Hidden fields on login form ==="
echo "$LOGIN_HTML" | grep -oP '<input type="hidden"[^>]*name="\K[^"]+' | sort -u

echo ""
echo "=== Form action ==="
echo "$LOGIN_HTML" | grep -oP '<form[^>]*action="\K[^"]+'

echo ""
echo "=== CAPTCHA related ==="
echo "$LOGIN_HTML" | grep -oP '(captcha|CAPTCHA)[^"]*"[^"]*"[^"]*"' | head -5

echo ""
echo "=== Step 2: POST login ==="
LOGIN_RESULT=$(curl -s -L -w '\nHTTP_CODE:%{http_code}' \
  -c /tmp/bb_c.txt -b /tmp/bb_c.txt \
  -H "User-Agent: $UA" \
  -H "Referer: https://www.bandbbs.cn/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "login=peipeijin@qq.com" \
  --data-urlencode "password=2023370321030120074" \
  --data-urlencode "_xfToken=$TOKEN" \
  --data-urlencode "_xfRedirect=/" \
  --data-urlencode "remember=1" \
  'https://www.bandbbs.cn/login/login')

HTTP_CODE=$(echo "$LOGIN_RESULT" | tail -1 | grep -oP 'HTTP_CODE:\K\d+')
BODY=$(echo "$LOGIN_RESULT" | head -n -1)
echo "HTTP code: $HTTP_CODE"
echo "Body size: ${#BODY}"

echo ""
echo "=== Login status indicators ==="
echo "data-logged-in: $(echo "$BODY" | grep -oP 'data-logged-in="\K[^"]+')"
echo "data-auth-user-id: $(echo "$BODY" | grep -oP 'data-auth-user-id="\K[^"]+')"
echo "Page title: $(echo "$BODY" | grep -oP '<title>\K[^<]+')"

echo ""
echo "=== Error messages ==="
echo "$BODY" | grep -oP 'class="[^"]*blockMessage[^"]*"[^>]*>\K[^<]+' | sed 's/<[^>]*>//g'

echo ""
echo "=== Alert/notice messages ==="
echo "$BODY" | grep -oP 'class="[^"]*flashMessage[^"]*"[^>]*>.*?</div>' | sed 's/<[^>]*>//g' | head -3

echo ""
echo "=== Cookie file after login ==="
cat /tmp/bb_c.txt | grep -v '^#' | grep -v '^$'

echo ""
echo "=== Step 3: Visit account page ==="
ACC=$(curl -s -L -w '\nHTTP_CODE:%{http_code}' -b /tmp/bb_c.txt -H "User-Agent: $UA" 'https://www.bandbbs.cn/account/')
ACC_CODE=$(echo "$ACC" | tail -1 | grep -oP 'HTTP_CODE:\K\d+')
ACC_BODY=$(echo "$ACC" | head -n -1)
echo "HTTP code: $ACC_CODE"
echo "Page title: $(echo "$ACC_BODY" | grep -oP '<title>\K[^<]+')"
echo "Username in nav: $(echo "$ACC_BODY" | grep -oP 'p-nav-username[^>]*>\K[^<]+')"
echo "Contains login form: $(echo "$ACC_BODY" | grep -c 'name="login"')"

echo ""
echo "=== Done ==="