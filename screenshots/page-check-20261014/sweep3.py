#!/usr/bin/env python3
"""evbox 23 页面冷启动渲染扫描 v3（emulator-13002 / 小米手环10 Pro 336x480）

修复 v2 实测坑:
1. pull 静默失败->落盘缺失后脚本崩        : grab() 校验 size>=FRAME 否则重连重试(3次)
2. 回合内 rm 累计 50 触发安全删除门禁砍断   : 全程零 rm，单 tmp 路径覆盖写
3. 隔页复读骗过判据(引擎路由恢复竞态)       : 全局 origin 帧溯源 + BASE/welcome 回落帧识别

判定口径:
  OK    两次冷启都渲染出本站独立帧
  OK~   仅一次独立帧(另一次回落)——页面能渲染，但冷启动不稳定
  REVERT两次都回落已知页(→welcome/→index)——引擎路由恢复劫持，本方法无法判定
  DUP   两次都与他页同帧
countdown-manage 置末(13004 实测其作 entry 会挂引擎)。
"""
import hashlib
import json
import os
import struct
import subprocess
import sys
import time
import zlib

HOME = os.path.expanduser("~")
ADB = f"{HOME}/.vela/sdk/tools/adb/mac/adb"
SER = "emulator-13002"
ADDR = "127.0.0.1:13003"
PKG = "com.application.watch.evbox"
MAN = f"/data/quickapp/app/{PKG}/manifest.json"
SRC_MAN = f"{HOME}/Documents/guomengtao/ev/evbox/src/manifest.json"
GUEST_RAW = "/tmp/_sw3.raw"
HOST_RAW = "/tmp/_sw3_host.raw"
LOCAL_MAN = "/tmp/_sw3_man.json"
W, H = 336, 480
FRAME = W * 2 * H  # 322560
OUT = os.path.dirname(os.path.abspath(__file__))


def sh(args, t=40):
    try:
        return subprocess.run(args, capture_output=True, timeout=t)
    except subprocess.TimeoutExpired:
        return None


def adb(*args, t=40):
    return sh([ADB, "-s", SER, *args], t)


def reconnect():
    sh([ADB, "connect", ADDR], 20)


def set_entry(page):
    """改 guest manifest 的 router.entry，带回滚重试。"""
    ok = False
    for _ in range(3):
        r = adb("pull", MAN, LOCAL_MAN)
        if r and r.returncode == 0 and os.path.exists(LOCAL_MAN) and os.path.getsize(LOCAL_MAN) > 100:
            ok = True
            break
        reconnect()
        time.sleep(1)
    if not ok:
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
    """am stop 后轮询等到进程真正消失，消除'旧任务还活着被恢复'的竞态。"""
    adb("shell", "am", "stop", PKG, t=20)
    blind = 0
    for _ in range(16):
        st = app_running()
        if st is False:
            return True
        if st is None:
            blind += 1
            if blind >= 2:
                break  # ps 不可用，放弃轮询走固定等待
        time.sleep(0.5)
    time.sleep(1.5)
    return False


def grab():
    for _ in range(3):
        adb("shell", f"dd if=/dev/fb0 of={GUEST_RAW} bs={FRAME} count=1", t=40)
        adb("pull", GUEST_RAW, HOST_RAW, t=40)
        if os.path.exists(HOST_RAW) and os.path.getsize(HOST_RAW) >= FRAME:
            with open(HOST_RAW, "rb") as f:
                return f.read(FRAME)
        reconnect()
        time.sleep(1)
    return None


def md5_of(raw):
    return hashlib.md5(raw).hexdigest()[:8]


def to_png(raw, path):
    buf = bytearray()
    stride = W * 2
    for y in range(H):
        buf.append(0)
        line = raw[y * stride:(y + 1) * stride]
        for x in range(W):
            v = line[x * 2] | (line[x * 2 + 1] << 8)
            buf.append(((v >> 11) & 0x1F) * 255 // 31)
            buf.append(((v >> 5) & 0x3F) * 255 // 63)
            buf.append((v & 0x1F) * 255 // 31)

    def chunk(t, d):
        return (struct.pack(">I", len(d)) + t + d
                + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(bytes(buf), 6))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)


def main():
    pages = json.load(open(SRC_MAN))["router"]["pages"]
    pages = [p for p in pages if p != "pages/countdown-manage"] + ["pages/countdown-manage"]
    origin = {}  # md5 -> 首次产出该帧的页面名

    base = grab()
    if base:
        m = md5_of(base)
        origin[m] = "BASE(index)"
        to_png(base, f"{OUT}/p3-00-base.png")
        print(f"[base] md5={m}")

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
            raw = grab()
            if raw is None:
                runs.append(("NOFRAME", None))
                continue
            m = md5_of(raw)
            if m in origin:
                runs.append((m, f"same-as:{origin[m]}"))
            else:
                runs.append((m, "UNIQUE"))
                origin[m] = name
                to_png(raw, f"{OUT}/p3-{i:02d}-{name}-r{r}.png")
        uniq = sum(1 for _, c in runs if c == "UNIQUE")
        if uniq == 2:
            verdict = "OK"
        elif uniq == 1:
            verdict = "OK~"
        else:
            targets = sorted({c.split(":", 1)[1] for _, c in runs
                              if c and c.startswith("same-as:")})
            verdict = ("REVERT->" + ",".join(targets)) if targets else "NOFRAME"
        line = f"[{i:02d}/23] {name:<20} r1={runs[0][0]}({runs[0][1]}) r2={runs[1][0]}({runs[1][1]}) => {verdict}"
        print(line, flush=True)
        rows.append((name, verdict))

    # 还原 entry，留干净环境
    set_entry("pages/index")
    adb("shell", "am", "stop", PKG, t=20)
    print("=== SUMMARY ===")
    for name, v in rows:
        print(f"{name}\t{v}")
    ok = sum(1 for _, v in rows if v.startswith("OK"))
    print(f"OK/OK~={ok}/23  REVERT={sum(1 for _,v in rows if v.startswith('REVERT'))}  NOFRAME={sum(1 for _,v in rows if v=='NOFRAME')}")


if __name__ == "__main__":
    main()
