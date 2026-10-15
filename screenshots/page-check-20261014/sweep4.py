#!/usr/bin/env python3
"""evbox 23 页面冷启动渲染扫描 v4（vela CLI 实例 + vela shot 截图）

依据 ev/class-schedule/docs/模拟器黑屏排查指南.md：
- `vela up xiaomi_band_pro --rpk ... --wait` 拉起 11000+ 实例池（与 EvEmuBuddy 13000+ 池互不互通）
- 截图走指南钦定的 `vela shot <id> out.png`（不解码，直接对 PNG 取 md5）
- 仍保留 entry 逐页切换 + 双冷启 + 全局帧溯源 + 进程消失轮询（应对引擎路由恢复竞态）
- 零 rm；pull 校验 + 重连重试

串口/端口由环境变量注入：VELA_ID / ADB_ADDR / ADB_SERIAL
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time

HOME = os.path.expanduser("~")
ADB = f"{HOME}/.vela/sdk/tools/adb/mac/adb"
VELA = f"{HOME}/.local/bin/vela"
VELA_ID = os.environ.get("VELA_ID", "xiaomi_band_pro-11000")
ADB_ADDR = os.environ.get("ADB_ADDR", "127.0.0.1:11001")
ADB_SERIAL = os.environ.get("ADB_SERIAL", "emulator-11000")
PKG = "com.application.watch.evbox"
MAN = f"/data/quickapp/app/{PKG}/manifest.json"
SRC_MAN = f"{HOME}/Documents/guomengtao/ev/evbox/src/manifest.json"
LOCAL_MAN = "/tmp/_sw4_man.json"
HOST_SHOT = "/tmp/_sw4_shot.png"
OUT = os.path.dirname(os.path.abspath(__file__))


def sh(args, t=60):
    try:
        return subprocess.run(args, capture_output=True, timeout=t)
    except subprocess.TimeoutExpired:
        return None


def adb(*args, t=60):
    return sh([ADB, "-s", ADB_SERIAL, *args], t)


def reconnect():
    sh([ADB, "connect", ADB_ADDR], 20)


def vela_shot(path):
    for _ in range(3):
        r = sh([VELA, "shot", VELA_ID, path], 60)
        if r and r.returncode == 0 and os.path.exists(path) and os.path.getsize(path) > 400:
            return True
        reconnect()
        time.sleep(1)
    return False


def set_entry(page):
    for _ in range(3):
        r = adb("pull", MAN, LOCAL_MAN)
        if r and r.returncode == 0 and os.path.exists(LOCAL_MAN) and os.path.getsize(LOCAL_MAN) > 100:
            break
        reconnect()
        time.sleep(1)
    else:
        return False
    try:
        d = json.load(open(LOCAL_MAN))
        d["router"]["entry"] = page
        json.dump(d, open(LOCAL_MAN, "w"), ensure_ascii=False)
    except Exception:
        return False
    for _ in range(3):
        r = adb("push", LOCAL_MAN, MAN)
        if r and r.returncode == 0:
            return True
        reconnect()
        time.sleep(1)
    return False


def app_running():
    r = adb("shell", "ps", t=20)
    if not r or r.returncode != 0:
        return None
    return "evbox" in r.stdout.decode(errors="ignore").lower()


def cold_stop():
    adb("shell", "am", "stop", PKG, t=20)
    blind = 0
    for _ in range(16):
        st = app_running()
        if st is False:
            return True
        if st is None:
            blind += 1
            if blind >= 2:
                break
        time.sleep(0.5)
    time.sleep(1.5)
    return False


def md5_of(path):
    return hashlib.md5(open(path, "rb").read()).hexdigest()[:8]


def main():
    pages = json.load(open(SRC_MAN))["router"]["pages"]
    pages = [p for p in pages if p != "pages/countdown-manage"] + ["pages/countdown-manage"]
    origin = {}
    if vela_shot(HOST_SHOT):
        m = md5_of(HOST_SHOT)
        origin[m] = "BASE(index)"
        shutil.copy(HOST_SHOT, f"{OUT}/p4-00-base.png")
        print(f"[base] md5={m}")
    else:
        print("[base] 首帧获取失败，检查实例/vela shot")
    rows = []
    for i, page in enumerate(pages, 1):
        name = page.split("/")[-1]
        runs = []
        for r in (1, 2):
            if not set_entry(page):
                runs.append(("NOENTRY", None))
                continue
            cold_stop()
            adb("shell", f"vapp app/{PKG} &", t=20)
            time.sleep(4)
            if not vela_shot(HOST_SHOT):
                runs.append(("NOFRAME", None))
                continue
            m = md5_of(HOST_SHOT)
            if m in origin:
                runs.append((m, f"same-as:{origin[m]}"))
            else:
                runs.append((m, "UNIQUE"))
                origin[m] = name
                shutil.copy(HOST_SHOT, f"{OUT}/p4-{i:02d}-{name}-r{r}.png")
        uniq = sum(1 for _, c in runs if c == "UNIQUE")
        if uniq == 2:
            verdict = "OK"
        elif uniq == 1:
            verdict = "OK~"
        elif any(c and c.startswith("same-as:") for _, c in runs):
            verdict = "REVERT->" + ",".join(sorted(
                {c.split(":", 1)[1] for _, c in runs if c and c.startswith("same-as:")}))
        else:
            verdict = "NOFRAME"
        print(f"[{i:02d}/23] {name:<20} r1={runs[0][0]}({runs[0][1]}) r2={runs[1][0]}({runs[1][1]}) => {verdict}", flush=True)
        rows.append((name, verdict))
    set_entry("pages/index")
    adb("shell", "am", "stop", PKG, t=20)
    print("=== SUMMARY ===")
    for n, v in rows:
        print(f"{n}\t{v}")
    print(f"OK/OK~={sum(1 for _, v in rows if v.startswith('OK'))}/23  "
          f"REVERT={sum(1 for _, v in rows if v.startswith('REVERT'))}  "
          f"NOFRAME={sum(1 for _, v in rows if v == 'NOFRAME')}")


if __name__ == "__main__":
    main()
