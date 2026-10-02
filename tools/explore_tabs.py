#!/usr/bin/env python3
"""探索工具/设置两个 tab：逐屏滚动截图，摸清所有入口坐标。"""
import sys, time
sys.path.insert(0, '/Users/Banner/Documents/guomengtao/ev/evbox/tools')
import emu_shot as e

OUT = '/tmp/evbox_shots'

def tap(x, y, wait=2.5):
    e.tap(x, y)
    time.sleep(wait)

def shot(name, wait=0.8):
    time.sleep(wait)
    e.shot(f'{OUT}/{name}.png')

def back(wait=2.0):
    tap(20, 45, wait)

def scroll(wait=2.0):
    e.swipe(96, 360, 96, 150)
    time.sleep(wait)

# ---- 复位到首页 ----
print('>> reset app')
e.stop(); time.sleep(1.5)
e.launch(26)
shot('index', 0.5)

# ---- 工具 tab：逐屏滚 ----
print('>> tools tab')
tap(48, 452)          # 底部 工具
shot('tools-1', 1.0)
scroll(); shot('tools-2')
scroll(); shot('tools-3')
scroll(); shot('tools-4')
scroll(); shot('tools-5')

# ---- 设置 tab ----
print('>> settings tab')
tap(143, 452, 3)
shot('settings-1', 1.0)
scroll(); shot('settings-2')
scroll(); shot('settings-3')
scroll(); shot('settings-4')

print('>> explore done')
