#!/usr/bin/env python3
"""EvBox 逐页截图采集器（2026-10-02 实战沉淀版）。

三条铁律（都是踩过坑的）：
  1. 每个页面前**冷启动复位**（am stop + vapp）。back 连点不可靠——欢迎页没有返回键，
     点空了后续点击全落空，整批图会串页。
  2. 截图前**探测黑屏**。冷启动约一半概率屏幕不亮，不探测会采到纯黑图。
  3. 长列表**先探测再点**。滚动有动量随机性，盲点会点空（表现：截出来还是列表页）。

用法:
  python3 capture_pages.py                    # 采全部
  python3 capture_pages.py lunar,backup       # 只采指定页
"""
import sys, time
sys.path.insert(0, '/Users/Banner/Documents/guomengtao/ev/evbox/tools')
import emu_shot as e

OUT = '/tmp/evbox_shots'
PROBE = '/tmp/_probe.raw'


def tap(x, y, w=2.5):
    e.tap(x, y); time.sleep(w)


def swipe(w=2.0):
    """滚动：一次约 210px，起点选内容区、避开标题栏与底部按钮。"""
    e.swipe(96, 360, 96, 150); time.sleep(w)


def is_black():
    """首帧非零字节太少 → 判为黑屏。"""
    e.grab_raw(PROBE)
    d = open(PROBE, 'rb').read()[:e.FRAME_BYTES]
    return sum(1 for b in d[::7] if b) < 20


def reset(max_try=4):
    """冷启动到首页（唯一确定状态），顺带把屏点亮。"""
    for i in range(max_try):
        e.stop(); time.sleep(1.5)
        e.launch(22); time.sleep(1)
        if not is_black():
            return True
        print(f'  [reset] 黑屏，唤醒 ({i+1})', flush=True)
        tap(96, 485, 2)          # 底缘空白处，避开可点区域
    return False


def safe_shot(name, tries=4):
    """截图前确认不黑；黑则唤醒重试。"""
    for i in range(tries):
        if not is_black():
            e.shot(f'{OUT}/{name}.png')
            print(f'  captured {name}', flush=True)
            return True
        print(f'  [{name}] 黑屏，唤醒重试 {i+1}', flush=True)
        tap(96, 485, 2)
    print(f'  {name} 仍黑屏，放弃', flush=True)
    return False


def job(kind, name, n_scroll, tx, ty):
    """kind: 'tools' | 'settings'；从首页直达容器页，滚动 n 次，点目标，截图。"""
    if not reset():
        print(f'  ERROR {name}: 屏幕点不亮', flush=True)
        return
    tap(48 if kind == 'tools' else 143, 452, 3)   # 首页底部：工具 / 设置
    for _ in range(n_scroll):
        swipe()
    tap(tx, ty)
    safe_shot(name)


# 坐标来自 shot_tools.py ruler 实测（工具页/设置页的滚动位置）。
# ⚠️ 滚动次数与坐标是绑定的：换 n_scroll 就必须重新用 ruler 量一遍目标行。
JOBS = [
    # 工具页（0 滚 = 首屏宫格）
    ('tools', 'countdown', 0, 48, 200),
    ('tools', 'lunar',     0, 143, 200),
    ('tools', 'calculator', 0, 48, 285),
    ('tools', 'quote',     0, 143, 285),
    ('tools', 'answer',    0, 48, 370),
    ('tools', 'qrcode',    0, 143, 370),
    # 工具页（1 滚）
    ('tools', 'vibration', 1, 48, 330),
    # 工具页（2 滚）
    ('tools', 'device-info', 2, 96, 225),
    # 工具页（3 滚）——诊断区
    ('tools', 'diagnosis',  3, 96, 130),
    ('tools', 'blackcheck', 3, 96, 415),
    # 设置页
    ('settings', 'homepageset', 1, 96, 250),   # 首页设置（未解锁会弹「解锁高级版」）
    ('settings', 'syncchat',    2, 96, 300),   # 同步器留言
    ('settings', 'backup',      3, 96, 368),   # 数据备份（未解锁弹提示）
    ('settings', 'activation',  3, 96, 450),   # 高级版
    ('settings', 'donate',      4, 96, 335),   # 打赏支持
    ('settings', 'welcome',     4, 96, 455),   # 欢迎页
]


def main():
    only = set(sys.argv[1].split(',')) if len(sys.argv) > 1 else None
    for kind, name, n, tx, ty in JOBS:
        if only and name not in only:
            continue
        print(f'>> {name}', flush=True)
        try:
            job(kind, name, n, tx, ty)
        except Exception as ex:
            print(f'  ERROR {name}: {ex}', flush=True)
    print('>> recover', flush=True)
    e.stop(); time.sleep(1.5); e.launch(22)
    print('ALL DONE', flush=True)


if __name__ == '__main__':
    main()
