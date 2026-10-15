#!/usr/bin/env python3
"""evbox 23 页面「打开正常吗」全量验证（2026-10-14）

方法（entry 逐页切换法，零点击）：
  每页：pull guest manifest.json → 改 router.entry=pages/<page> → push 回
        → am stop + vapp 冷启动 → 轮询 fb0 等渲染稳定 → 截图 + 判活
判定：
  nonzero > 1000 字节 = 有渲染内容 → ✅
  nonzero <= 1000    = 黑屏/空帧   → ⚠️（注意：设置类二级页当 entry 会启动即退，
                                    此为 entry 直入的已知局限，需点击导航复验，不等于页面坏）
"""
import hashlib
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.expanduser("~/Documents/guomengtao/ev/evbox/tools"))
import emu_shot  # noqa: E402  复用实测过的 fb0 读取/解码

SERIAL = "emulator-13004"
emu_shot.SERIAL = SERIAL
PKG = "com.application.watch.evbox"
GUEST_MANIFEST = f"/data/quickapp/app/{PKG}/manifest.json"
OUT = os.path.expanduser("~/Documents/guomengtao/ev/evbox/screenshots/page-check-20261014")
FRAME = emu_shot.STRIDE * emu_shot.H  # 188160

PAGES = [
    "welcome", "index", "tools",
    "countdown-manage", "lunar-calendar", "calculator", "daily-quote",
    "answer-book", "qrcode-generator", "vibration-lab", "vibration-lab-v2",
    "chinese-input",
    "settings", "homepage-settings", "pinned-pages", "sync-chat",
    "backup-restore", "activation", "device-info", "template-picker",
    "device-id-diagnosis", "black-screen-check",
    "donate",
]


def adb(*args, timeout=40):
    return subprocess.run([emu_shot.ADB, "-s", SERIAL, *args],
                          capture_output=True, timeout=timeout)


def frame_nonzero():
    """读当前 fb0 第 0 帧，返回非零字节数（失败返回 -1）。"""
    try:
        adb("shell", f"dd if=/dev/fb0 of=/tmp/_sw.raw bs={FRAME} count=2", timeout=20)
        r = adb("pull", "/tmp/_sw.raw", f"{OUT}/_sw.raw", timeout=20)
        adb("shell", "rm -f /tmp/_sw.raw")
        p = f"{OUT}/_sw.raw"
        if not os.path.exists(p):
            return -1
        d = open(p, "rb").read(FRAME)
        os.remove(p)
        return sum(1 for b in d if b)
    except Exception:
        return -1


def set_entry(page):
    adb("pull", GUEST_MANIFEST, f"{OUT}/_manifest.json")
    with open(f"{OUT}/_manifest.json", encoding="utf-8") as f:
        d = json.load(f)
    d["router"]["entry"] = f"pages/{page}"
    with open(f"{OUT}/_manifest.json", "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False)
    adb("push", f"{OUT}/_manifest.json", GUEST_MANIFEST)


def restart_app():
    adb("shell", "am", "stop", PKG)
    adb("shell", f"vapp app/{PKG} &")


def wait_render(max_wait=28):
    """轮询 fb0：非零且连续两次读数一致 → 渲染稳定。返回 (nonzero, elapsed)。"""
    t0 = time.time()
    last = -1
    while time.time() - t0 < max_wait:
        nz = frame_nonzero()
        if nz > 1000 and nz == last:
            return nz, time.time() - t0
        last = nz
        time.sleep(1.5)
    return frame_nonzero(), time.time() - t0


def main():
    os.makedirs(OUT, exist_ok=True)
    # 基线：确认当前 entry 和整体渲染能力
    adb("pull", GUEST_MANIFEST, f"{OUT}/_manifest.json")
    orig_entry = json.load(open(f"{OUT}/_manifest.json", encoding="utf-8"))["router"]["entry"]
    print(f"[base] guest entry={orig_entry}", flush=True)

    results = []
    for i, page in enumerate(PAGES, 1):
        print(f"[{i}/{len(PAGES)}] {page} ...", flush=True)
        try:
            set_entry(page)
            restart_app()
            nz, el = wait_render()
            png = f"{OUT}/{i:02d}-{page}.png"
            try:
                emu_shot.shot(png)
                md5 = hashlib.md5(open(png, "rb").read()).hexdigest()[:8]
            except SystemExit:
                png, md5 = None, "SHOT_FAIL"
            verdict = "OK" if nz > 1000 else "BLACK"
            results.append({"page": page, "nonzero": nz, "elapsed": round(el, 1),
                            "md5": md5, "verdict": verdict, "png": png})
            print(f"    -> {verdict} nonzero={nz} {el:.1f}s md5={md5}", flush=True)
        except Exception as e:
            results.append({"page": page, "nonzero": -1, "elapsed": -1,
                            "md5": "ERROR", "verdict": f"ERROR:{e}", "png": None})
            print(f"    -> ERROR {e}", flush=True)

    # 还原 entry
    try:
        with open(f"{OUT}/_manifest.json", encoding="utf-8") as f:
            d = json.load(f)
        d["router"]["entry"] = orig_entry
        with open(f"{OUT}/_manifest.json", "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False)
        adb("push", f"{OUT}/_manifest.json", GUEST_MANIFEST)
        print(f"[restore] entry -> {orig_entry}", flush=True)
    except Exception as e:
        print(f"[restore] FAILED {e}", flush=True)

    with open(f"{OUT}/result.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=1)
    ok = sum(1 for r in results if r["verdict"] == "OK")
    print(f"[done] {ok}/{len(PAGES)} rendered OK", flush=True)


if __name__ == "__main__":
    main()
