#!/usr/bin/env python3
"""Vela 模拟器截图 & 触摸注入工具（EvBox 截图专用）

截图原理：guest 内 /dev/fb0 为 192x490 RGB565，stride=384B，内含 2 帧双缓冲；
         取第 1 帧解码为 PNG。全程纯 stdlib，无外部依赖。

用法:
  emu_shot.py shot <out.png>
  emu_shot.py tap <x> <y> [--hold 0.08]
  emu_shot.py swipe <x1> <y1> <x2> <y2> [--ms 300]
  emu_shot.py launch            # 冷启动 EvBox
  emu_shot.py stop              # 停止 EvBox
"""
import os
import struct
import subprocess
import sys
import time
import zlib

HOME = os.path.expanduser("~")
ADB = f"{HOME}/.vela/sdk/tools/adb/mac/adb"
SERIAL = os.environ.get("VELA_SERIAL", "emulator-5554")
PKG = "com.application.watch.evbox"
FB = "/dev/fb0"
W, H = 192, 490
STRIDE = W * 2  # 384 字节/行，RGB565


def sh(args, timeout=30):
    return subprocess.run(args, capture_output=True, timeout=timeout)


def adb(*args, timeout=30):
    return sh([ADB, "-s", SERIAL, *args], timeout=timeout)


def emu(*args, timeout=15):
    return sh([ADB, "-s", SERIAL, "emu", *args], timeout=timeout)


FRAME_BYTES = STRIDE * H          # 单帧字节数
FB_TOTAL = FRAME_BYTES * 2        # 双缓冲，共 2 帧
GUEST_TMP = "/tmp/fbshot.raw"     # guest 内落盘中转文件


def grab_raw(path="/tmp/_fb.raw"):
    """读 framebuffer（先 dd 到 guest 文件再 pull）。

    为什么这么绕：
    - `adb shell cat /dev/fb0` 在 NuttX 上读完不返回 EOF，会永久阻塞；
      host 侧 timeout kill 掉后 guest 内的 cat 仍挂着，攒几次就把 adbd 的 shell 通道堵死
      （症状：后续 `adb shell echo` 也没响应，需 `adb reconnect` 才能恢复）。
    - `dd` 存在且支持 bs/count，可精确读满就退出，不留残留进程。这是唯一干净的读法。
    - NuttX 的 adbd 也不支持 exec-out 的 raw 透传（返回 0 字节）。
    """
    adb("shell", f"dd if={FB} of={GUEST_TMP} bs={FRAME_BYTES} count=2")
    r = adb("pull", GUEST_TMP, path)
    size = os.path.getsize(path) if os.path.exists(path) else 0
    if size < FRAME_BYTES:
        raise SystemExit(f"[emu_shot] framebuffer 读取不足: {size} < {FRAME_BYTES}\n{r.stderr.decode(errors='ignore')}")
    adb("shell", f"rm -f {GUEST_TMP}")
    return path


def decode(raw_path, out_png, frame=0):
    d = open(raw_path, "rb").read()
    frame_bytes = STRIDE * H
    off = frame * frame_bytes
    if len(d) < off + frame_bytes:
        # 数据不足时退回第 0 帧
        off = 0
        if len(d) < frame_bytes:
            raise SystemExit(f"[emu_shot] framebuffer 数据不足: {len(d)} < {frame_bytes}")
    raw = bytearray()
    for y in range(H):
        raw.append(0)
        base = off + y * STRIDE
        line = d[base:base + STRIDE]
        for x in range(W):
            v = line[x * 2] | (line[x * 2 + 1] << 8)
            raw.append(((v >> 11) & 0x1F) * 255 // 31)
            raw.append(((v >> 5) & 0x3F) * 255 // 63)
            raw.append((v & 0x1F) * 255 // 31)

    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data
                + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(bytes(raw), 6))
           + chunk(b"IEND", b""))
    with open(out_png, "wb") as f:
        f.write(png)
    return out_png


def shot(out_png, frame=0):
    decode(grab_raw(), out_png, frame)
    print(f"[emu_shot] {out_png}")
    return out_png


def _touch_down(x, y):
    emu("event", "send",
        f"EV_ABS:ABS_MT_POSITION_X:{x}", f"EV_ABS:ABS_MT_POSITION_Y:{y}",
        "EV_ABS:ABS_MT_TRACKING_ID:1", "EV_KEY:BTN_TOUCH:1",
        "EV_SYN:SYN_REPORT:0")


def _touch_up():
    emu("event", "send", "EV_ABS:ABS_MT_TRACKING_ID:-1",
        "EV_KEY:BTN_TOUCH:0", "EV_SYN:SYN_REPORT:0")


def tap(x, y, hold=0.12):
    """点击。

    ⚠️ 必须用 `emu event mouse X Y 0 1/0`（按下/抬起）。
    ABS_MT 触摸协议（event send EV_ABS:ABS_MT_*）在这台模拟器上不落到 UI，
    发了画面纹丝不动 —— 别再绕回去试。
    """
    emu("event", "mouse", str(x), str(y), "0", "1")
    time.sleep(hold)
    emu("event", "mouse", str(x), str(y), "0", "0")
    print(f"[emu_shot] tap {x},{y}")


def swipe(x1, y1, x2, y2, ms=350, steps=12):
    """滑动：mouse 按下 → 按住期间连续变坐标 → 抬起。"""
    emu("event", "mouse", str(x1), str(y1), "0", "1")
    time.sleep(0.06)
    for i in range(1, steps + 1):
        x = x1 + (x2 - x1) * i // steps
        y = y1 + (y2 - y1) * i // steps
        emu("event", "mouse", str(x), str(y), "0", "1")
        time.sleep(ms / 1000.0 / steps)
    time.sleep(0.05)
    emu("event", "mouse", str(x2), str(y2), "0", "0")
    print(f"[emu_shot] swipe {x1},{y1} -> {x2},{y2}")


def launch(wait=26):
    adb("shell", "am", "stop", PKG)
    adb("shell", f"vapp app/{PKG} &")
    print(f"[emu_shot] launched, wait {wait}s")
    time.sleep(wait)


def stop():
    adb("shell", "am", "stop", PKG)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "shot"
    a = sys.argv[2:]
    if cmd == "shot":
        shot(a[0] if a else "/tmp/shot.png")
    elif cmd == "tap":
        tap(int(a[0]), int(a[1]))
    elif cmd == "swipe":
        swipe(int(a[0]), int(a[1]), int(a[2]), int(a[3]))
    elif cmd == "launch":
        launch()
    elif cmd == "stop":
        stop()
    else:
        raise SystemExit(__doc__)
