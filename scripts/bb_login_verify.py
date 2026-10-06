#!/usr/bin/env python3
"""Step 5: Verify login by visiting reviews page and a private area."""
import urllib.request, urllib.parse, http.cookiejar, re, ssl, os, traceback

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
OUTPUT = "/Users/Banner/Documents/guomengtao/ev/evbox/_login_verify_result.txt"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

class BBLogin:
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

try:
    with open(OUTPUT, "w", encoding="utf-8") as out:
        def log(msg):
            out.write(str(msg) + "\n")
            out.flush()

        bb = BBLogin()

        # Step 1: Login
        log("=== Login ===")
        html, _ = bb.get("https://www.bandbbs.cn/login")
        token = re.findall(r'name="_xfToken"\s+value="([^"]+)"', html)
        log(f"CSRF token: {token[0][:40] if token else 'FAIL'}...")

        result, final_url = bb.post("https://www.bandbbs.cn/login/login", {
            "login": "peipeijin@qq.com",
            "password": "2023370321030120074",
            "_xfToken": token[0],
            "_xfRedirect": "/",
            "remember": "1"
        }, referer="https://www.bandbbs.cn/login")
        log(f"Login result URL: {final_url}")
        log(f"data-logged-in: {re.findall(r'data-logged-in=\"([^\"]+)\"', result)}")

        # Step 2: Visit reviews page as logged-in user
        log("\n=== Visit resource reviews ===")
        reviews, rev_url = bb.get("https://www.bandbbs.cn/resources/7828/reviews")
        log(f"URL: {rev_url}")
        log(f"Page size: {len(reviews)}")

        # Check if we see edit/delete buttons (admin/author only features)
        admin_links = re.findall(r'href="[^"]*edit[^"]*review[^"]*"', reviews, re.IGNORECASE)
        log(f"Edit review links: {len(admin_links)}")

        # Check visitor panel (only visible to logged-in users)
        visitor_panel = re.findall(r'p-body-sidebar|block--messages|whats-new', reviews)
        log(f"Sidebar elements: {len(visitor_panel)}")

        # Check for "Your review" or edit capabilities
        your_review = re.findall(r'your.*review|edit.*review|delete.*review', reviews, re.IGNORECASE)
        log(f"Your review / edit refs: {your_review[:5]}")

        # Find username in nav (JS-free approach)
        username_nav = re.findall(r'p-navgroup-link--user[^>]*>.*?<span[^>]*>(.*?)</span>', reviews, re.DOTALL)
        log(f"Username in nav (method1): {username_nav}")

        # Find account avatar
        avatar = re.findall(r'class="[^"]*avatar[^"]*"[^>]*>.*?</a>', reviews, re.DOTALL)
        log(f"Avatar elements: {len(avatar)}")

        # Check notification bell count 
        alerts = re.findall(r'alerts.*?badge|badgeContainer.*?alert', reviews, re.IGNORECASE)
        log(f"Alert badges: {len(alerts)}")

        # Step 3: Visit account details
        log("\n=== Visit account details ===")
        acc, _ = bb.get("https://www.bandbbs.cn/account/account-details")
        log(f"Account details page size: {len(acc)}")
        title = re.findall(r'<title>(.*?)</title>', acc)
        log(f"Title: {title}")

        # Look for email
        email_field = re.findall(r'value="([^"]*@[^"]*)"', acc)
        log(f"Email fields: {email_field}")

        # Step 4: Cookies
        log("\n=== Final cookies ===")
        for c in bb.cj:
            if c.name in ('xf_user', 'xf_session', 'xf_csrf', 'xf_userinit'):
                log(f"  {c.name} = {c.value[:80]}...")

        # Step 5: Test persistence - second request without re-login
        log("\n=== Persistence test (2nd request) ===")
        reviews2, _ = bb.get("https://www.bandbbs.cn/resources/7828/reviews")
        log(f"Still logged in: {bool(re.findall(r'data-logged-in=\"true\"', reviews2))}")

        log("\nDone.")

except Exception as e:
    with open(OUTPUT + ".err", "w") as f:
        f.write(f"ERROR: {e}\n{traceback.format_exc()}")