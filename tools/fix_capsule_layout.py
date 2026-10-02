#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_capsule_layout.py — 修复 Vela 真机胶囊屏布局塌缩

背景
----
manifest 设 `designWidth: device-width`（1px = 1 物理px）。Vela **真机** runtime
会把「有 flex-direction: row 但缺 width 声明」的 div **塌缩到内容宽度**，
而 PC 模拟器宽容撑满 → 表现为「模拟器看着正常、真机拥挤 / 重叠 / 省略」。

同理，带 `lines: 1` 的 flex 子项若缺 `min-width: 0`，默认 `min-width: auto`
不会收缩到容器宽度以下，省略号不生效，文字压住相邻元素。

两种修法
--------
A. flex-direction: row 且块内**完全没有 width 声明** → 插入 `width: 100%;`
   （已有任何 width 的一律不动：按钮/图标本就该固定宽）
B. 块内有 `lines: 1` 但缺 `min-width` → 插入 `min-width: 0;`

⚠️ 实现约束（血泪教训，务必保留）
--------------------------------
第一版用 `re.sub` 回调 + 三捕获组，漏了左花括号捕获，
把 `.foo {` 写成 `.foo`，一次性损坏 137 处 CSS；
第二版用 `global n` 计数导致状态错乱，同样吞掉 `}`。
**正确做法：finditer 手工配对花括号、逐块拼接字符串，不用 sub 回调。**
"""
import re
import pathlib
import sys

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'src')
DRY = '--dry' in sys.argv

# 选择器 + 左花括号
SEL = re.compile(r'(\.[a-zA-Z][\w-]*(?:\s*,\s*\.[a-zA-Z][\w-]*)*)(\s*)\{')


def fix_block(inner: str):
    """对单个类定义块补属性，返回新块或 None（无需改）。"""
    lines = inner.split('\n')
    idx = None
    for i, ln in enumerate(lines):
        if re.search(r'flex-direction\s*:\s*row', ln):
            idx = i
            break

    if idx is not None and not re.search(r'\bwidth\s*:', inner):
        ind = re.match(r'\s*', lines[idx]).group(0)
        lines.insert(idx + 1, f'{ind}width: 100%;')

    for i, ln in enumerate(lines):
        if re.search(r'lines\s*:\s*1', ln) and not re.search(r'\bmin-width\s*:', inner):
            ind = re.match(r'\s*', ln).group(0)
            lines.insert(i + 1, f'{ind}min-width: 0;')
            break

    return '\n'.join(lines) if lines != inner.split('\n') else None


def process(txt: str, style_only: bool):
    if style_only:
        m = re.search(r'(<style>)(.*?)(</style>)', txt, re.S)
        if not m:
            return txt, 0
        body, off = m.group(2), m.start(2)
    else:
        body, off = txt, 0

    out, cur, n = [], 0, 0
    for sm in SEL.finditer(body):
        ob = sm.end() - 1
        cb = body.find('}', ob + 1)
        if cb == -1:
            continue
        new_inner = fix_block(body[ob + 1:cb])
        if new_inner is None:
            continue
        out.append(body[cur:ob + 1])      # 选择器 + '{'
        out.append(new_inner)             # 修好的块内容
        out.append('}')                   # 闭合花括号（关键：显式写回）
        cur = cb + 1
        n += 1

    if n == 0:
        return txt, 0
    out.append(body[cur:])
    return txt[:off] + ''.join(out) + txt[off + len(body):], n


def main():
    tf = th = 0
    for p in sorted(ROOT.rglob('*')):
        if p.suffix not in ('.ux', '.css'):
            continue
        txt = p.read_text(encoding='utf-8')
        new, n = process(txt, style_only=(p.suffix == '.ux'))
        if n:
            tf += 1
            th += n
            print(f'  {p}  {n} 处')
            if not DRY:
                p.write_text(new, encoding='utf-8')
    print(f'\n合计 {tf} 文件 / {th} 处' + ('（dry-run）' if DRY else ''))

    # 自检：括号配平 + 无缺花括号
    bad = 0
    for p in sorted(ROOT.rglob('*')):
        if p.suffix not in ('.ux', '.css'):
            continue
        t = p.read_text(encoding='utf-8')
        m = re.search(r'<style>(.*?)</style>', t, re.S)
        body = m.group(1) if m else (t if p.suffix == '.css' else '')
        if not body:
            continue
        miss = re.findall(r'\.[a-zA-Z][\w-]*\s*\n\s*[a-z-]+\s*:', body)
        if body.count('{') != body.count('}') or miss:
            bad += 1
            print(f'  ⚠️ {p}: {{={body.count("{")} }}={body.count("}")} 缺={len(miss)}')
    print('自检异常文件:', bad)


if __name__ == '__main__':
    main()
