#!/usr/bin/env python3
"""Send a BandBBS direct message via simulated login."""
import urllib.request, urllib.parse, http.cookiejar, re, ssl, os, sys, traceback, json

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
OUTPUT = "/Users/Banner/Documents/guomengtao/ev/evbox/_dm_send_result.txt"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

class BBSession:
    def __init__(self):
        self.cj = http.cookiejar.CookieJar()
        https_handler = urllib.request.HTTPSHandler(context=ctx)
        self.opener = urllib.request.build_opener(
            https_handler,
            urllib.request.HTTPCookieProcessor(self.cj),
            urllib.request.HTTPRedirectHandler()
        )

    def get(self, url, referer=None):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        if referer:
            req.add_header("Referer", referer)
        resp = self.opener.open(req, timeout=30)
        return resp.read().decode("utf-8", errors="replace"), resp.geturl()

    def post(self, url, data, referer=None):
        encoded = urllib.parse.urlencode(data).encode("utf-8")
        req = urllib.request.Request(url, data=encoded, headers={
            "User-Agent": UA,
            "Content-Type": "application/x-www-form-urlencoded"
        })
        if referer:
            req.add_header("Referer", referer)
        resp = self.opener.open(req, timeout=30)
        return resp.read().decode("utf-8", errors="replace"), resp.geturl()

out = open(OUTPUT, "w", encoding="utf-8")
def logf(msg):
    out.write(str(msg) + "\n")
    out.flush()
    print(msg, flush=True)

try:
    bb = BBSession()

    # Step 1: Login
    logf("=== Step 1: Login ===")
    html, _ = bb.get("https://www.bandbbs.cn/login")
    token = re.findall(r'name="_xfToken"\s+value="([^"]+)"', html)
    logf(f"CSRF token: {token[0][:40]}...")

    result, _ = bb.post("https://www.bandbbs.cn/login/login", {
        "login": "peipeijin@qq.com",
        "password": os.environ.get("BANDBBBS_PASSWORD", ""),
        "_xfToken": token[0],
        "_xfRedirect": "/",
        "remember": "1"
    }, referer="https://www.bandbbs.cn/login")
    logf(f"Login: data-logged-in={re.findall(r'data-logged-in=\"([^\"]+)\"', result)}")

    # Step 2: Fetch DM compose page for CSRF token
    logf("\n=== Step 2: Fetch DM compose page ===")
    dm_html, _ = bb.get("https://www.bandbbs.cn/direct-messages/add")
    logf(f"Page size: {len(dm_html)}")

    if "/login" in _:
        logf("FAIL: Not authenticated")
        sys.exit(1)

    dm_csrf = re.findall(r'name="_xfToken"\s+value="([^"]+)"', dm_html)
    logf(f"DM CSRF: {dm_csrf[0][:40] if dm_csrf else 'NOT FOUND'}...")

    attach_hash = re.findall(r'name="attachment_hash"\s+value="([^"]*)"', dm_html)
    logf(f"Attachment hash: {attach_hash[0][:50] if attach_hash else 'NOT FOUND'}...")

    attach_combined = re.findall(r'name="attachment_hash_combined"\s+value="([^"]*)"', dm_html)
    logf(f"Attachment combined: {attach_combined[0][:80] if attach_combined else 'NOT FOUND'}...")

    # Step 3: Send the DM
    logf("\n=== Step 3: POST DM ===")

    # Build the form data
    form_data = {
        "_xfToken": dm_csrf[0],
        "recipients": "peipeijin",
        "title": "私信1249",
        "message_html": "<p>666</p>",
        "message": "666",
        "timezone": "Asia/Shanghai",
        "open_invite": "0",
        "conversation_locked": "0",
    }
    if attach_hash:
        form_data["attachment_hash"] = attach_hash[0]
    if attach_combined:
        form_data["attachment_hash_combined"] = attach_combined[0]

    logf(f"Post URL: https://www.bandbbs.cn/direct-messages/add")
    logf(f"Form data: {json.dumps({k: v[:50] for k, v in form_data.items() if k != 'password'})}")

    dm_result, dm_result_url = bb.post(
        "https://www.bandbbs.cn/direct-messages/add",
        form_data,
        referer="https://www.bandbbs.cn/direct-messages/add"
    )

    logf(f"Result URL: {dm_result_url}")
    logf(f"Result size: {len(dm_result)}")

    # Check for success indicators
    logf(f"\n--- Result analysis ---")
    title_match = re.findall(r'<title>(.*?)</title>', dm_result)
    logf(f"Title: {title_match}")

    # Success: redirected to the conversation page
    if "/direct-messages/" in dm_result_url and "/add" not in dm_result_url:
        logf("SUCCESS: Redirected to conversation!")
    elif "私信1249" in dm_result:
        logf("SUCCESS: Title found in response!")
    elif title_match and "错误" not in str(title_match) and "error" not in str(title_match).lower():
        logf("SUCCESS: Seems like conversation page")

    # Check for errors
    errors = re.findall(r'class="[^"]*blockMessage[^"]*"[^>]*>(.*?)</div>', dm_result, re.DOTALL)
    for e in errors:
        txt = re.sub(r'<[^>]+>', ' ', e).strip()
        if txt:
            logf(f"Error: {txt[:200]}")

    notices = re.findall(r'class="[^"]*flashMessage[^"]*"[^>]*>(.*?)</div>', dm_result, re.DOTALL)
    for n in notices:
        txt = re.sub(r'<[^>]+>', ' ', n).strip()
        if txt:
            logf(f"Notice: {txt[:200]}")

    # If still on compose page, check for field errors
    field_errors = re.findall(r'class="[^"]*formRow-error[^"]*"[^>]*>(.*?)<', dm_result, re.DOTALL)
    for fe in field_errors:
        logf(f"Field error: {fe.strip()[:200]}")

    logf("\nDone.")

except Exception as e:
    logf(f"\nERROR: {e}")
    logf(traceback.format_exc())

finally:
    out.close()