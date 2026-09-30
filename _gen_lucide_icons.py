#!/usr/bin/env python3
"""从 Lucide 官方图标源下载官方 SVG，生成 dark / light 两套 PNG。

原则：**禁止自己重新绘制任何图形**。
本项目所有图标的形状数据（path / polygon 等）100% 来自 Lucide 官方发布源，
脚本只做三件事：

    1. 下载官方 SVG（本地缓存，支持离线重跑）
    2. 应用主题颜色（替换官方的 stroke="currentColor"）
    3. 用 rsvg-convert 光栅化为 32x32 PNG

说明：Lucide 是矢量图标库，官方只发布 SVG、不发布 PNG，因此不存在"官方 PNG
直链"可下载。上面第 3 步的光栅化是唯一本地步骤，且渲染的是官方图形数据本身。

依赖：
    brew install librsvg        # 提供 rsvg-convert
    python3（仅用标准库 urllib）

用法：
    python3 _gen_lucide_icons.py            # 正常生成两套图标
    python3 _gen_lucide_icons.py --offline  # 只用本地缓存，不联网
    python3 _gen_lucide_icons.py --preview  # 生成后打印 ASCII 预览用于肉眼校验
"""
import os
import re
import subprocess
import sys
import tempfile
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
ICONS_DIR = os.path.join(BASE, "src", "common", "icons")
CACHE_DIR = os.path.join(BASE, ".cache", "lucide-svg")
RSVG = "/opt/homebrew/bin/rsvg-convert"

SVG_SIZE = 32  # 导航图标输出边长（px）
# 首页工具图标输出边长：首页最大按 64px 显示（圆屏 2 列卡片），
# 源图必须 ≥ 显示尺寸，否则会被放大发虚，故取 64。
TOOL_SIZE = 64

# Lucide 官方版本号；改这里即可整体升级图标库版本
LUCIDE_VERSION = "latest"
# 多个 CDN 依次尝试，前一个失败自动回退到下一个
CDN_TEMPLATES = [
    "https://cdn.jsdelivr.net/npm/lucide-static@{v}/icons/{name}.svg",
    "https://unpkg.com/lucide-static@{v}/icons/{name}.svg",
]

# 项目文件名 -> Lucide 官方图标名（官方名可在 https://lucide.dev/icons/<name> 查到）
ICON_MAP = {
    "icon_arrow_left.png":   "arrow-left",
    "icon_arrow_right.png":  "arrow-right",
    "icon_back.png":         "chevron-left",
    "icon_chevron_down.png": "chevron-down",
    "icon_chevron_up.png":   "chevron-up",
    "icon_chevron_right.png": "chevron-right",
    "icon_home.png":         "house",
    "icon_plus.png":         "plus",
    "icon_swap.png":         "arrow-right-left",
    "icon_trash.png":        "trash-2",
}

# 主题配色：dark 主题用手环深色背景上的浅灰，light 主题用浅色背景上的深灰
COLORS = {
    "dark":  (200, 200, 200),
    "light": (60, 60, 60),
}

# 首页工具区图标 -> Lucide 官方图标名（首页三模式设计：doc/胶囊屏首页美化设计-三模式.md）
TOOL_ICONS = {
    "tool_countdown.png":  "calendar-days",
    "tool_lunar.png":      "moon-star",
    "tool_calculator.png": "calculator",
    "tool_qrcode.png":     "qr-code",
    "tool_vibrate.png":    "vibrate",
    "tool_backup.png":     "database-backup",
    "tool_device.png":     "watch",
    # 首页改造新增（doc/首页改造与新工具及同步器通信恢复设计.md）
    "tool_quote.png":      "quote",       # 每日一言
    "tool_answer.png":     "book-open",   # 答案之书
    "tool_exit.png":       "log-out",     # 退出快应用
}

# 工具图标配色：暗色主题用纯白（放在 card 底色上对比更强），亮色主题用深灰
TOOL_COLORS = {
    "dark":  (255, 255, 255),
    "light": (51, 51, 51),
}


def hex_color(rgb):
    return "#%02x%02x%02x" % rgb


def fetch_official_svg(icon_name, offline=False):
    """下载 Lucide 官方 SVG，返回文本。失败直接抛错——绝不回退到自己绘制。"""
    cache_path = os.path.join(CACHE_DIR, icon_name + ".svg")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            return f.read()

    if offline:
        raise RuntimeError("离线模式下缓存缺失: %s" % cache_path)

    last_err = None
    for tpl in CDN_TEMPLATES:
        url = tpl.format(v=LUCIDE_VERSION, name=icon_name)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "class-schedule-icons"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                if resp.status != 200:
                    last_err = "HTTP %s" % resp.status
                    continue
                body = resp.read().decode("utf-8")
        except Exception as e:              # noqa: BLE001 - 只用于回退下一个 CDN
            last_err = str(e)
            continue
        if "<svg" not in body:
            last_err = "响应不是 SVG"
            continue
        os.makedirs(CACHE_DIR, exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as f:
            f.write(body)
        return body

    raise RuntimeError("无法从 Lucide 官方源下载 %s.svg（%s）" % (icon_name, last_err))


def apply_theme_color(svg_text, color_hex):
    """把官方 SVG 的 currentColor 换成主题色，并去掉 class 以免渲染器差异。"""
    out = svg_text.replace('stroke="currentColor"', 'stroke="%s"' % color_hex)
    out = out.replace("stroke='currentColor'", "stroke='%s'" % color_hex)
    out = out.replace('fill="currentColor"', 'fill="%s"' % color_hex)
    out = out.replace("fill='currentColor'", "fill='%s'" % color_hex)
    out = re.sub(r'\sclass="lucide[^"]*"', "", out)
    return out


def rasterize(svg_text, output_path, size=SVG_SIZE):
    """用 rsvg-convert 把 SVG 光栅化为 PNG。"""
    if not os.path.exists(RSVG):
        raise RuntimeError("缺少 rsvg-convert，请先执行: brew install librsvg")
    with tempfile.NamedTemporaryFile(suffix=".svg", mode="w", delete=False, encoding="utf-8") as f:
        f.write(svg_text)
        svg_path = f.name
    try:
        result = subprocess.run(
            [RSVG, "-f", "png", "-w", str(size), "-h", str(size), svg_path, "-o", output_path],
            capture_output=True, timeout=20,
        )
        if result.returncode != 0:
            raise RuntimeError("rsvg-convert 失败: %s" % result.stderr.decode().strip())
    finally:
        os.unlink(svg_path)


def ascii_preview(path, width=24):
    """终端 ASCII 预览，便于不用看图也能校验图形是否正确。"""
    try:
        from PIL import Image
    except ImportError:
        return "(未安装 Pillow，跳过预览)"
    img = Image.open(path).convert("RGBA")
    img = img.resize((width, width // 2))
    px = img.load()
    lines = []
    for y in range(img.height):
        row = ""
        for x in range(img.width):
            a = px[x, y][3]
            row += "#" if a > 170 else ("+" if a > 60 else ".")
        lines.append(row)
    return "\n".join(lines)


def main():
    offline = "--offline" in sys.argv
    preview = "--preview" in sys.argv
    only_tools = "--tools" in sys.argv

    groups = [
        {
            "label": "导航图标",
            "map": ICON_MAP,
            "dir": ICONS_DIR,
            "size": SVG_SIZE,
            "colors": COLORS,
            "skip": only_tools,
        },
        {
            "label": "首页工具图标",
            "map": TOOL_ICONS,
            "dir": os.path.join(ICONS_DIR, "tools"),
            "size": TOOL_SIZE,
            "colors": TOOL_COLORS,
            "skip": False,
        },
    ]

    for group in groups:
        if group["skip"]:
            continue
        print("== %s（%dpx，%d 个）==" % (group["label"], group["size"], len(group["map"])))
        for theme in ("dark", "light"):
            theme_dir = os.path.join(group["dir"], theme)
            os.makedirs(theme_dir, exist_ok=True)
            color_hex = hex_color(group["colors"][theme])

            for filename, lucide_name in group["map"].items():
                svg_text = fetch_official_svg(lucide_name, offline=offline)
                svg_text = apply_theme_color(svg_text, color_hex)
                output = os.path.join(theme_dir, filename)
                rasterize(svg_text, output, size=group["size"])
                rel = os.path.relpath(output, BASE)
                print("OK: %s (%dB) <- lucide/%s.svg" % (rel, os.path.getsize(output), lucide_name))
                if preview and theme == "dark":
                    print(ascii_preview(output))
                    print()
        print()

    print("Done! 全部图标均来自 Lucide 官方 SVG（%s），本脚本不绘制任何图形。" % LUCIDE_VERSION)


if __name__ == "__main__":
    main()
