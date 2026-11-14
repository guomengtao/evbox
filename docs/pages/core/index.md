# EvBox 首页 · ev-six 合规重设计

> 路由：`pages/index` ｜ 源码：`src/pages/index/index.ux`
> 单号：`evtask-D-evevbox-261114-arwytf` ｜ 设计日期：2026-11-14 09:30 +0800
> 规范正本：总纲 §3.21「六位开发准则 ev-six」v5 ／ `ev/class-schedule/docs/手环页面开工手册-20261023.md` v7
> 执行顺序：按 §3.22「先写骨架 → 再改代码 → 回填实测结论与坑 → 同一次提交带上」，实测结论回填在 §10。

---

## 0. 一句话结论

**首页不再装工具全集，改为「状态 → 焦点 → 入口」三段式枢纽**：工具全集交给已有的 `pages/tools`，首页只留 4 个操作行；全页字号只出现 44 / 30 / 28 / 24 四档，横向 padding 归 12/8px，删除全部行内箭头、徽标、分隔符与 `text-overflow`。

## 1. 目标与范围

| 项 | 内容 |
|---|---|
| 目标 | 让首页在 192×490 手环（可视区仅 15.0×38.3mm）上真正可读，过 ev-six 提交前 14 条自检 |
| 改动文件 | `src/pages/index/index.ux`（template + style 全量重写，script 瘦身）＋ 本文档 |
| 不改 | `pages/tools` 三视图、`pages/homepage-settings` 设置项、三个首页数据模块、主题系统、路由表 |
| 兼容 | `showTime` / `showCountdown` / `showPinnedBar` 三个开关继续生效；`toolViewMode` 首页不再消费，仍由 `pages/tools` 消费 |

## 2. 现状审计（改前实测，2026-11-14 09:28 +0800）

对 `src/pages/index/index.ux` 静态扫描：

| 违规项 | 实测 | ev-six 要求 |
|---|---|---|
| `font-size` 分布 | 20px×43、18px×9、24px×8、22px×6、28px×5、26px×5、30px×3、16px×2、40/34/32px 各 1 | 只允许 44 / 30 / 28 / 24 四档 |
| 小于绝对下限 | 16px×2、18px×9、20px×43、22px×6 | 12~23px 全面禁用 |
| `text-overflow: ellipsis` | 13 处 | 禁止（会产生「…」，静默裁字） |
| 行内箭头 | `tool-row-arrow` → `icon_chevron_right.png` | 禁行内导航箭头 |
| 文字徽标 | `cd-hero-pin` 渲染「钉」 | 禁序号徽标与文字标签 |
| 页面左右 padding | `8px`（顶部 44px） | 页面 12px，卡片/行 ≤8px |
| `prompt.showToast` | 1 处（退出失败提示） | 页内禁用，改内联状态条 |
| 条件渲染 | `if` 指令 | 改 `display` 绑定（手册事故 #11：兄弟节点用 `if` 整页不渲染） |
| 一屏多事 | 时钟＋倒数日＋钉页＋**三种视图切换**＋10 个工具＋底部双按钮 | 一屏一件事 |
| 图标模式天然违规 | 2 列卡片宽 76px，3 字名 @24px 需 96px | 必然截断，无解，只能删 |

**结论：不是调字号能修的，必须重排信息架构。** 图标模式在 76px 卡片里 3 个 24px 汉字物理上放不下（96px > 76px），这是删掉三视图的硬理由，不是审美选择。

## 3. 信息架构（按手册 §二 第 1 步：先列裸文本）

按重要性排序，每行不带标点／徽标／箭头：

| # | 裸文本 | 用途 | 字号 |
|---|---|---|---|
| 1 | `09:24` | 当前时刻（状态大字） | 44 |
| 2 | `11月14日` | 日期（短格式） | 24 |
| 3 | `7` | 倒数日数字（焦点，可点） | 44 |
| 4 | `天` | 单位 | 24 |
| 5 | `项目截止` | 倒数日名称 | 24 |
| 6 | `全部工具` | P0 主操作 | 28 |
| 7 | `已钉页面` | 次操作 | 28 |
| 8 | `设置` | 次操作 | 28 |
| 9 | `退出` | 次操作 | 28 |
| 10 | `下滑查看` | 溢出时的滚动提示 | 24 |
| 11 | `手势返回` | 退出失败时的内联状态条 | 24 |

**每屏文字约 33 字 / 8~10 行**，落在手册 §八「32~40 字」预算内。删掉的内容：10 个工具名、三视图切换标签（图标／列表／图文）、实时摘要、底部重复的双按钮、「钉」徽标、日期完整格式。

**为什么工具全集移出首页**：10 项 × 58px = 580px，加状态区与焦点区会超过 735px 的 1.5 屏硬上限；且「一屏一件事」。首页只做「去哪」，工具页做「做什么」。

## 4. 设计 Token

### 4.1 字号四档（唯一合法值）

| token | 字号 / 行高 | 用途 | 行高比 |
|---|---|---|---|
| `t44` | 44 / 60 | 状态大字、倒数日数字 | 1.36 |
| `t30` | 30 / 40 | 页面标题（本页无页头，未使用） | 1.33 |
| `t28` | 28 / 38 | 操作行主文字 | 1.36 |
| `t24` | 24 / 34 | 日期、单位、标题、提示、状态条 | 1.42 |

> 行高比落在 1.36~1.42 区间；`t30` 仅为四档完整性保留，本页不产生该尺寸节点。

### 4.2 宽度硬预算

```
屏 192px − 页面 padding 12×2 = 168px 内容宽
168px − 卡片 padding 8×2   = 152px 卡内宽
1 汉字渲染宽 ≈ 1.33 × 字号（手册 §4.0，v7 修订）
```

| 容器 | @28px | @24px |
|---|---|---|
| 168px 裸文 | 4 字 = 149px ✅ | 5 字 = 160px ✅ |
| 152px 卡内 | 4 字 = 149px（余 3px）✅ | 4 字 = 128px ✅ |

**横向 padding 一律不从这里买留白**：页面固定 12px、卡片/行固定 8px；呼吸感只从 `line-height`、纵向 padding、纵向 margin 买。

### 4.3 三级底色（表达可点性，替代箭头）

| 层级 | 取值 | 用在哪 |
|---|---|---|
| 裸文 `transparent` | `theme.bg` | 状态区（时钟／日期，不可点） |
| 卡片 `theme.card` | `#16213e`（深空蓝主题） | 焦点卡、三个次操作行 |
| 亮底 `theme.cardLight` | `#0f3460` | `全部工具` P0 主操作 |

配色沿用 `src/data/store.js` 的 `THEMES`，不新增主题；首页不引入图标。

### 4.4 对比度（WCAG AA）

| 前景 / 背景 | 比值 | 判定 |
|---|---|---|
| `#ffffff` / `#1a1a2e` | ≈15.8:1 | ✅ |
| `#ffffff` / `#16213e` | ≈14.9:1 | ✅ |
| `#ffffff` / `#0f3460` | ≈11.5:1 | ✅ |
| `#7ec8e3` / `#1a1a2e`（44px 大字） | ≈9.6:1 | ✅ |
| **`#888899` / `#1a1a2e`（原 `textSecondary`）** | **≈4.0:1** | ❌ **不足 4.5:1** |

因此新增派生 `subColor`：解析 `theme.bg` 相对亮度，深底取 `#a8a8bd`（≈7.4:1），浅底取 `#3a3a4e`（≈9.7:1）。**首页不直接用 `theme.textSecondary`**，避免把不可读的灰字带进新设计。

## 5. 位置计费实算（逐行）

按 `实际占宽 = P × 字号 × 1.33`：

| 行 | 文本 | P 计算 | P | 字号 | 实宽 | 容器 | 判定 |
|---|---|---|---|---|---|---|---|
| 时钟 | `09:24` | 4×0.55 + 0.5(冒号) | 2.70 | 44 | 158px | 168 | ✅ 余 10px |
| 日期 | `11月14日` | 4×0.55 + 2×1.0 | 4.20 | 24 | 134px | 168 | ✅ 余 34px |
| 数字 | `7` | 1×0.55 | 0.55 | 44 | 32px | 152 | ✅ |
| 单位 | `天` | 1.0 | 1.00 | 24 | 32px | 152 | ✅ |
| 焦点标题 | `项目截止` | 4×1.0 | 4.00 | 24 | 128px | 152 | ✅ 余 24px |
| 主操作 | `全部工具` | 4×1.0 | 4.00 | 28 | 149px | 152 | ✅ 余 3px（贴边） |
| 次操作 | `已钉页面` | 4×1.0 | 4.00 | 28 | 149px | 152 | ✅ 余 3px |
| 次操作 | `设置` | 2×1.0 | 2.00 | 28 | 75px | 152 | ✅ |
| 次操作 | `退出` | 2×1.0 | 2.00 | 28 | 75px | 152 | ✅ |
| 滚动提示 | `下滑查看` | 4×1.0 | 4.00 | 24 | 128px | 168 | ✅ |
| 状态条 | `手势返回` | 4×1.0 | 4.00 | 24 | 128px | 168 | ✅ |

**全部 ≤6P，最长行 4.2P。** 所有文案控制在 4 字以内，`11月14日` 是唯一超过 4 字符的行但只有 4.2P @24。

**数据驱动文案的兜底**：倒数日标题与钉页名由用户自定义，可能超 4 字。所有单行 `<text>` 加 `lines: 1` 且**不加 `text-overflow`**（手册 §3.1 认可的防折行兜底），文案预算写进 §8；不靠缩字号解决。

## 6. 组件骨架

```html
<div class="page" style="background-color: {{ theme.bg }}">
  <scroll class="content" scroll-y="true">
    <!-- ① 状态：裸文，无底色，不可点 -->
    <div class="status" style="display: {{ showTime ? 'flex' : 'none' }}">
      <text class="clock-main" style="color: {{ theme.accent }}">{{ currentTime }}</text>
      <text class="date-sub" style="color: {{ subColor }}">{{ dateText }}</text>
    </div>

    <!-- ② 焦点：card，可点进倒数日 -->
    <div class="focus" onclick="openCountdown"
         style="display: {{ showCountdown && hasCountdown ? 'flex' : 'none' }}; background-color: {{ theme.card }}">
      <div class="focus-num-row">
        <text class="num-main" style="color: {{ theme.accent }}">{{ cdBadge }}</text>
        <text class="num-unit" style="color: {{ subColor }}">{{ cdUnit }}</text>
      </div>
      <text class="focus-title" style="color: {{ theme.text }}">{{ cdTitle }}</text>
    </div>

    <!-- ③ 入口：亮底 = P0，卡片 = 次操作；无箭头、无图标 -->
    <div class="action action-primary" onclick="openTools" style="background-color: {{ theme.cardLight }}">
      <text class="action-text" style="color: {{ theme.text }}">全部工具</text>
    </div>
    <div class="action" onclick="openPinned" style="background-color: {{ theme.card }}">
      <text class="action-text" style="color: {{ theme.text }}">已钉页面</text>
    </div>
    <div class="action" onclick="openSettings" style="background-color: {{ theme.card }}">
      <text class="action-text" style="color: {{ theme.text }}">设置</text>
    </div>
    <div class="action" onclick="exitBox" style="background-color: {{ theme.card }}">
      <text class="action-text" style="color: {{ theme.text }}">退出</text>
    </div>

    <!-- 内联状态条：固定高度 34px，只换文字不换高度，禁用 toast -->
    <text class="inline-hint" style="display: {{ exitHint ? 'flex' : 'none' }}; color: {{ subColor }}">{{ exitHint }}</text>
  </scroll>

  <text class="scroll-hint" style="display: {{ needScroll ? 'flex' : 'none' }}; color: {{ subColor }}">下滑查看</text>
</div>
```

**不要加的东西**：`text-overflow`、`·` / `/` / `|` / `-` 分隔符、行内 `› → >`、圆形徽标、「推荐/备用」标签、图标、装饰边框、页头第三类按钮。

## 7. 高度预算与滚动策略

| 区块 | 高 |
|---|---|
| 页 padding（32 top + 16 bottom） | 48 |
| 状态区（60 + 34 + 12 margin） | 106 |
| 焦点卡（60 + 34 + 12×2 padding + 10 margin） | 128 |
| 4 个操作行（58×4 + 10×3 margin） | 262 |
| 合计（全开） | **544px** |

单屏可用 442px（490 − 32 − 16），544px 超一屏 → 走 **1.5 屏**（≤735px）＋ 底部 `下滑查看` 滚动提示，**不压字号**。

`needScroll` 由 JS 按开关与 `hasCountdown` 动态算：全开 544（true）／仅状态 416（false）／仅焦点 438（false）／都关 310（false）。内容不足一屏时不显示提示，避免噪音。

## 8. 兼容性与行为变更

| 项 | 处理 |
|---|---|
| `modules/clock.js` | 保留 `updateClock` / `startClockTimer` / `stopClockTimer` 接口。**首页强制 `timeFormat = {hour, minute, second:false}`**：带秒 `09:24:31` = 4.3P @44 = 252px 超 168px，带完整日期更是 12.3P，物理上放不下，故首页只显示 `HH:MM`。 |
| `dateText` | 页面自行生成 `M月D日`（`11月14日`），`onShow` 刷新，不使用 `currentTime` 里的日期部分。 |
| `modules/countdown-hero.js` | 保留 `loadCountdownHero` / `openCountdown` / `cdBadge` / `cdUnit` / `cdTitle`。**不渲染 `cdSubText`**（模块内 `dateText + " · " + nextText` 含禁用的 `·`）。 |
| `modules/pinned-pages.js` | 保留 `loadPinnedPages` / `openPinnedPage`，但首页改为单个「已钉页面」入口跳 `/pages/pinned-pages`，不再平铺钉页标签（避免行数不可控）。 |
| `homepage_settings.toolViewMode` | 首页不再读取；`pages/tools` 仍消费，数据不破坏。 |
| `showTime` / `showCountdown` | 继续生效（`display` 绑定切换）。 |
| `showPinnedBar` | 不再控制首页渲染，保留读取以兼容设置页。 |
| 退出 | `utils.exitApp()` 失败 → 内联状态条 `手势返回`，**移除 `prompt.showToast`**。 |
| 方法名 | 避开 `fail` / `success` / `complete` / `callback`（手册事故 #12 静默失败）。 |
| 屏型 | 胶囊屏 `@media (shape: capsule)` 仅把顶部 padding 从 32 抬到 40 留圆角安全区，不动横向 padding。 |

## 9. 验收清单（提交前 14 条）

- [ ] 1. 每行 P ≤ 6（最长 4.2P）
- [ ] 2. `font-size` 只出现 44 / 30 / 28 / 24，无 12~23px
- [ ] 3. 行高比 1.36~1.42
- [ ] 4. 无 `·` `/` `|` `-` 作分隔
- [ ] 5. 内容区无 `›` `→` `>` 行内箭头
- [ ] 6. 无圆形徽标、无「推荐 / 备用 / 次选」标签
- [ ] 7. 主信息行动宾短语，行尾余量 ≤1P
- [ ] 8. 无折行、无 `...` / `…`（OCR 比对源码文本节点）
- [ ] 9. 卡片左右 padding ≤8px；页面左右 padding = 12px
- [ ] 10. 内容 ≤735px，溢出时有滚动提示，未压字号
- [ ] 11. 无二维码（本页不涉及）
- [ ] 12. 无设备 ID / URL 正文（本页不涉及）
- [ ] 13. 页内无 `prompt.showToast`
- [ ] 14. 条件渲染用 `display` 绑定不用 `if`；方法名避开保留字

**命令**：

```bash
cd /Users/Banner/Documents/guomengtao/ev/evbox
grep -nE "font-size: (1[0-9]|2[0-3]|2[5-7]|2[9]|3[1-9]|4[0-3]|4[5-9])px" src/pages/index/index.ux
grep -n "text-overflow\|›\|→\|showToast\|if={{" src/pages/index/index.ux
npm run build
```

**截图**：模拟器默认实例 `xiaomi_band`（`emulator-5554`），**必须带机身外壳**：

```bash
python3 /Users/Banner/Documents/guomengtao/ev/ev-emubuddy/emubuddy_core.py \
  shot emulator-5554 <绝对路径>.png --frame
```

## 10. 实测结论回填

### 10.1 L0 静态自检（2026-11-14 09:34 +0800）✅ 通过

| 检查 | 结果 |
|---|---|
| `font-size` 分布 | 24px×5、28px×1、44px×2，**只有三档，无 12~23px，无第五档** |
| 非法字号扫描 | 0 命中 |
| `text-overflow` / `showToast` / `if=` / `›` / `→` / `chevron` / `border-bottom` | 仅命中注释里的说明文字，**代码 0 处** |
| 横向 padding | `.page 32px 12px 16px 12px`、`.focus 12px 8px`、`.action 10px 8px` ✅ |
| 文件体积 | 1733 行 → **401 行**（清掉 1381 行旧样式与三视图模板） |

### 10.2 L1 构建验证（2026-11-14 09:34 +0800）✅ 通过

`npm run build` → `build success: 12981ms`，产物
`dist/com.application.watch.evbox.release.1.0.64.rpk`（778,683 B）。
包体自检：241 条目、`pages/*.jsc` 24 个、含 `pages/index/index.jsc`（41,605 B），
包内 manifest `1.0.64 / 65 / entry=pages/index` ✅ 无「缺 pages」坏包特征。
唯一告警是无关的 `qrcode-generator.ux` 未使用变量。

### 10.3 L2 模拟器视觉验收（2026-11-14 09:37 +0800）⚠️ 受阻

默认实例 `xiaomi_band-11000`（AVD `xiaomi_band` / `emulator-11000`，192×490 胶囊屏，
唯一在跑实例，未触碰 `evc-xiaomi_band-buddy-1`）。

装载链按技能执行：`am stop` → push rpk → `unzip -o` → `vapp app/<pkg>` 前台驻留。
截到 `screenshots/EvBox首页-evsix-20261114.png`（带机身外壳，画布 281×820），
但 fb0 首帧 **188160 字节全零**，OCR 无文字，属黑屏无效证据。

**排障过程与已排除项**（避免下一轮重复踩）：

1. 初次推包后 guest `pages/index/` 同时存在 `index.js`（旧明文）与 `index.jsc`（新字节码）
   → 按技能「明文遮蔽」把 `index.js` 改名；
2. ps 显示同 AVD 上挤了 **4~5 个 vapp 会话**（`quickapp` 空壳、`evbox`×2、`classschedule`×2）
   互抢前台 → `am stop` 全部包名；
3. guest 根目录还有 **`app.js` 明文**（旧 debug 包残留）会遮蔽新的 `app.jsc`
   → 连同整套 `pages_old_20261114/` 一并改名后重新 `unzip -o`，
   现在根目录只剩 `app.jsc`、首页只剩 `index.jsc`，已无遮蔽；
4. 重新前台拉起后，30 秒内 10 次 fb0 探测仍恒为 0。

**按技能「黑屏排查顺序」第 4 步判读**：包已装（guest manifest 1.0.64 / entry=pages/index）、
真包名 `vapp` 进程在跑、adb/guest 都正常，唯独画面恒 0 —— 符合
「这台新起实例的渲染管线未预热」特征，而非「包没装」。
技能记载的唯一能出图样本是「很早之前遗留、早已被渲染预热过」的实例。
**结论：本次 L2 视觉验收受环境限制未完成，不能声称真机通过。**
静态与构建证据充分，OCR 比对与点击交互列为待补项（见 §10.4）。

### 10.4 待补

- [ ] 换已预热实例或用 `vela up` 起干净实例重采首页截图（需 EvFleet 票据，`vela tap` 已被票据闸拦）
- [ ] OCR 比对源码文本节点，确认无截断／省略号／折行
- [ ] 点击「全部工具」验证主交互（`vela tap` 需先 `fleet request`）
- [ ] 有效截图须非空（≥2KB）且带机身外壳，替换当前黑屏废片

## 11. 版本

| 版本 | 日期 | 变更 |
|---|---|---|
| v1 | 2026-11-14 09:30 +0800 | 首版骨架：现状审计、信息架构、token、位置计费、组件骨架、验收清单 |
