#!/usr/bin/env python3
import urllib.request, urllib.parse, http.cookiejar, re, ssl, os, traceback

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
OUTPUT = "/Users/Banner/Documents/guomengtao/ev/evbox/_login_py_result.txt"

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
        log("=== Step 1: Fetch login page ===")
        try:
            html, final_url = bb.get("https://www.bandbbs.cn/login")
            log(f"Final URL: {final_url}")
            log(f"Page size: {len(html)}")
        except Exception as e:
            log(f"ERROR fetching login page: {e}")
            log(traceback.format_exc())
            html = ""

        token = re.findall(r'name="_xfToken"\s+value="([^"]+)"', html)
        log(f"CSRF token: {token[0][:40] if token else 'NOT FOUND'}...")

        for name, val in re.findall(r'<input type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"', html):
            log(f"  Hidden: {name} = {val[:50]}")

        captcha_refs = re.findall(r'(g-recaptcha|captcha|h-captcha|turnstile)', html, re.IGNORECASE)
        log(f"CAPTCHA indicators: {captcha_refs}")

        log("\n=== Step 2: POST login ===")
        if token:
            try:
                result, final_url = bb.post("https://www.bandbbs.cn/login/login", {
                    "login": "peipeijin@qq.com",
                    "password": os.environ.get("BANDBBBS_PASSWORD", ""),
                    "_xfToken": token[0],
                    "_xfRedirect": "/",
                    "remember": "1"
                }, referer="https://www.bandbbs.cn/login")
                log(f"Final URL: {final_url}")
                log(f"Body size: {len(result)}")
            except Exception as e:
                log(f"ERROR posting login: {e}")
                log(traceback.format_exc())
                result = ""
        else:
            log("SKIP: No CSRF token")
            result = ""

        for k, v in {
            "data-logged-in": re.findall(r'data-logged-in="([^"]*)"', result),
            "data-auth-user-id": re.findall(r'data-auth-user-id="(\d+)"', result),
            "username": re.findall(r'p-nav-username[^>]*>([^<]+)<', result),
            "title": re.findall(r'<title>(.*?)</title>', result),
        }.items():
            log(f"  {k}: {v}")

        for e in re.findall(r'class="[^"]*blockMessage[^"]*"[^>]*>(.*?)</div>', result, re.DOTALL):
            log(f"  Error: {re.sub(r'<[^>]+>', ' ', e).strip()[:200]}")

        for n in re.findall(r'class="[^"]*flashMessage[^"]*"[^>]*>(.*?)</div>', result, re.DOTALL):
            log(f"  Notice: {re.sub(r'<[^>]+>', ' ', n).strip()[:200]}")

        log("\n=== Step 3: Check /account/ page ===")
        try:
            acc, acc_url = bb.get("https://www.bandbbs.cn/account/")
            log(f"Final URL: {acc_url}")
            log(f"Body size: {len(acc)}")
            log(f"Title: {re.findall(r'<title>(.*?)</title>', acc)}")
            log(f"Username: {re.findall(r'p-nav-username[^>]*>([^<]+)<', acc)}")
            log(f"Has login form: {bool(re.findall(r'name=\"login\"', acc))}")
        except Exception as e:
            log(f"ERROR checking account: {e}")

        log("\n=== Step 4: Cookies ===")
        for cookie in bb.cj:
            log(f"  {cookie.name} = {cookie.value[:60]}... ({cookie.domain})")

        log("\nDone.")

except Exception as e:
    with open(OUTPUT + ".err", "w") as f:
        f.write(f"OUTER ERROR: {e}\n{traceback.format_exc()}")