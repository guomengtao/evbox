#!/usr/bin/env python3
"""evbox 23 页面「打开正常吗」全量验证 v2（2026-10-14，emulator-13002 / 小米手环 10 Pro 336x480）

v1 教训修复：
  - 稳定性判据加「与上一页 md5 不同」——v1 被引擎路由恢复的过渡帧骗过（index 假阳性）
  - adb 设备级错误（not found/offline/protocol fault/reset）也自动 reconnect 重试
    （v1 被 dd 挂死堵死 adbd；本机 EvEmuBuddy 似在周期性重启 adb server 抢连接）
  - countdown-manage 放最后测（v1 中它疑似把引擎挂死，隔离风险）
  - 黑屏时先点底缘唤醒再判（区分「屏灭了」和「真黑屏」）
"""
import hashlib
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.expanduser("~/Documents/guomengtao/ev/evbox/tools"))
import emu_shot  # noqa: E402

SERIAL = "emulator-13002"
PKG = "com.application.watch.evbox"
GUEST_MANIFEST = f"/data/quickapp/app/{PKG}/manifest.json"
OUT = os.path.expanduser("~/Documents/guomengtao/ev/evbox/screenshots/page-check-20261014")

# ── 小米手环 10 Pro：336x480 RGB565，stride=672B ──
emu_shot.W, emu_shot.H = 336, 480
emu_shot.STRIDE = emu_shot.W * 2
emu_shot.FRAME_BYTES = emu_shot.STRIDE * emu_shot.H
emu_shot.FB_TOTAL = emu_shot.FRAME_BYTES * 2
FRAME = emu_shot.FRAME_BYTES

DEVICE_ERRORS = ("not found", "offline", "protocol fault", "reset by peer",
                 "cannot connect", "Connection refused", "failed to get feature")

# countdown-manage 放最后（疑似挂引擎）
PAGES = [
    "welcome", "index", "tools",
    "lunar-calendar", "calculator", "daily-quote",
    "answer-book", "qrcode-generator", "vibration-lab", "vibration-lab-v2",
    "chinese-input",
    "settings", "homepage-settings", "pinned-pages", "sync-chat",
    "backup-restore", "activation", "device-info", "template-picker",
    "device-id-diagnosis", "black-screen-check",
    "donate",
    "countdown-manage",
]


def reconnect():
    subprocess.run([emu_shot.ADB, "connect", "127.0.0.1:13003"],
                   capture_output=True, timeout=10)
    time.sleep(1.5)


def adb(*args, timeout=30):
    last = None
    for attempt in range(3):
        try:
            r = subprocess.run([emu_shot.ADB, "-s", SERIAL, *args],
                               capture_output=True, timeout=timeout)
            err = r.stderr.decode(errors="ignore")
            if r.returncode == 0 or not any(k in err for k in DEVICE_ERRORS):
                return r
            last = RuntimeError(err.strip()[:100])
        except subprocess.TimeoutExpired as e:
            last = e
        print(f"    [adb retry {attempt + 1}] {args[0]} {args[1] if len(args) > 1 else ''}", flush=True)
        reconnect()
    raise last


def frame_read():
    """读 fb0 第 0 帧，返回 (md5, 非零字节数)。"""
    adb("shell", f"dd if=/dev/fb0 of=/tmp/_sw.raw bs={FRAME} count=2", timeout=15)
    adb("pull", "/tmp/_sw.raw", f"{OUT}/_sw.raw", timeout=15)
    adb("shell", "rm -f /tmp/_sw.raw")
    p = f"{OUT}/_sw.raw"
    d = open(p, "rb").read(FRAME)
    os.remove(p)
    return hashlib.md5(d).hexdigest(), sum(1 for b in d if b)


def wait_render(prev_md5, max_wait=26):
    """轮询到「非零 + 连续两帧一致 + 与上一页不同」才算稳定。"""
    t0 = time.time()
    last_md5 = None
    while time.time() - t0 < max_wait:
        md5, nz = frame_read()
        if nz > 2000 and md5 == last_md5 and md5 != prev_md5:
            return md5, nz, time.time() - t0
        last_md5 = md5
        time.sleep(1.2)
    md5, nz = frame_read()
    return md5, nz, time.time() - t0


def wake_and_reread():
    """黑屏补救：点屏幕底缘唤醒，再读一次。"""
    adb("shell", "emu", "event", "mouse", "168", "475", "0", "1")
    adb("shell", "emu", "event", "mouse", "168", "475", "0", "0")
    time.sleep(2.5)
    return frame_read()


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


def main():
    os.makedirs(OUT, exist_ok=True)
    adb("pull", GUEST_MANIFEST, f"{OUT}/_manifest.json")
    with open(f"{OUT}/_manifest.json", encoding="utf-8") as f:
        orig = json.load(f)
    orig_entry = orig["router"]["entry"]
    print(f"[base] serial={SERIAL} ver={orig.get('versionName')} entry={orig_entry}", flush=True)

    # 基线帧（当前画面），第一页必须与它不同
    try:
        base_md5, base_nz = frame_read()
        print(f"[base] frame md5={base_md5[:8]} nonzero={base_nz}", flush=True)
    except Exception as e:
        base_md5, base_nz = None, -1
        print(f"[base] frame read failed: {e}", flush=True)

    results = []
    prev_md5 = base_md5
    for i, page in enumerate(PAGES, 1):
        print(f"[{i}/{len(PAGES)}] {page} ...", flush=True)
        try:
            set_entry(page)
            restart_app()
            md5, nz, el = wait_render(prev_md5)
            if nz <= 2000:
                md5, nz = wake_and_reread()
            png = f"{OUT}/p2-{i:02d}-{page}.png"
            try:
                emu_shot.shot(png)
            except SystemExit:
                png = None
            if nz > 2000 and md5 != prev_md5:
                verdict = "OK"
            elif nz > 2000:
                verdict = "SUSPECT(与上页同帧·路由恢复?)"
            else:
                verdict = "BLACK"
            results.append({"page": page, "nonzero": nz, "elapsed": round(el, 1),
                            "md5": md5, "verdict": verdict, "png": png})
            print(f"    -> {verdict} nonzero={nz} {el:.1f}s md5={md5[:8] if md5 else '-'}", flush=True)
            prev_md5 = md5 if nz > 2000 else prev_md5
        except Exception as e:
            results.append({"page": page, "nonzero": -1, "elapsed": -1,
                            "md5": None, "verdict": f"ERROR:{type(e).__name__}", "png": None})
            print(f"    -> ERROR {e}", flush=True)
            reconnect()

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

    with open(f"{OUT}/result_v2.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=1)
    ok = sum(1 for r in results if r["verdict"] == "OK")
    print(f"[done] OK={ok}/{len(PAGES)} "
          f"SUSPECT={sum(1 for r in results if r['verdict'].startswith('SUSPECT'))} "
          f"BLACK={sum(1 for r in results if r['verdict'] == 'BLACK')} "
          f"ERR={sum(1 for r in results if r['verdict'].startswith('ERROR'))}", flush=True)


if __name__ == "__main__":
    main()
