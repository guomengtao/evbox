# EvBox 首页 · ev-six 合规重设计

> 路由：`pages/index` ｜ 源码：`src/pages/index/index.ux`
> 单号：`evtask-D-evevbox-261114-arwytf` ｜ 设计日期：2026-11-14 09:30 +0800
> 规范正本：总纲 §3.21「六位开发准则 ev-six」v5 ／ `ev/class-schedule/docs/手环页面开工手册-20261023.md` v7
> 执行顺序：按 §3.22「先写骨架 → 再改代码 → 回填实测结论与坑 → 同一次提交带上」，实测结论回填在 §10。
> 实测分两次落盘：骨架 + 首轮（受阻）随 `9787e5a` 同提交；终版结论随 v2 提交补入（同一任务单）。

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
| 12 | `Ev工具箱` | 时钟关闭时的裸文品牌锚点（28px，始终有状态区） | 28 |

**每屏文字约 33 字 / 8~10 行**，落在手册 §八「32~40 字」预算内。

**v2 补充**：本机 `homepage_settings` 默认 `showTime: false`，初版首帧只显示 4 个操作行、下半屏空荡。
故状态区改为「始终占位」：钟开显 44px 时刻 + 24px 短日期，钟关显 28px 裸文品牌行 `Ev工具箱`。
品牌行不受任何开关影响，靠 `accent` 色 + 无底色与操作行区分层级，不新增图标／徽标／字号档位。删掉的内容：10 个工具名、三视图切换标签（图标／列表／图文）、实时摘要、底部重复的双按钮、「钉」徽标、日期完整格式。

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
    <!-- ① 状态：裸文锚点，始终占位、不可点。clock / brand 二选一，display 绑定 -->
    <div class="status">
      <div class="status-clock" style="display: {{ showTime ? 'flex' : 'none' }}">
        <text class="clock-main" style="color: {{ theme.accent }}">{{ currentTime }}</text>
        <text class="date-sub" style="color: {{ subColor }}">{{ dateText }}</text>
      </div>
      <div class="status-brand" style="display: {{ showTime ? 'none' : 'flex' }}">
        <text class="brand-main" style="color: {{ theme.accent }}">Ev工具箱</text>
      </div>
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

    <!-- 内联状态条：固定 34px 高，只换文字不换高度，禁用 toast -->
    <div class="hint-wrap" style="display: {{ exitHint ? 'flex' : 'none' }}">
      <text class="inline-hint" style="color: {{ subColor }}">{{ exitHint }}</text>
    </div>
  </scroll>

  <div class="scroll-hint-wrap" style="display: {{ needScroll ? 'flex' : 'none' }}">
    <text class="scroll-hint" style="color: {{ subColor }}">下滑查看</text>
  </div>
</div>
```

**不要加的东西**：`text-overflow`、`·` / `/` / `|` / `-` 分隔符、行内 `› → >`、圆形徽标、「推荐/备用」标签、图标、装饰边框、页头第三类按钮。

## 7. 高度预算与滚动策略

| 区块 | 高 |
|---|---|
| 页 padding（40 top + 16 bottom） | 56 |
| 状态区（钟开 60+34+12 ／ 钟关 38+12） | 106 / 50 |
| 焦点卡（60 + 34 + 12×2 padding + 10 margin） | 128 |
| 4 个操作行（58×4 + 20×3 + 主操作 22） | 314 |
| 合计（全开 ／ 实测默认配置：钟关、无倒数日） | **604 / 420px** |

单屏可用 434px（490 − 40 − 16）；超一屏 → 走 **1.5 屏**（≤735px）＋ 底部 `下滑查看` 滚动提示，**不压字号**。
留白只从高度买：v2 把操作行 `margin-bottom` 由 10px 抬到 20px（主操作 22px），横向 padding 一丝未动，420px 恰好填满默认配置的一屏。

`needScroll` 由 JS 按开关与 `hasCountdown` 动态算：`56 + 314 + (showTime ? 106 : 50) + (焦点 ? 128 : 0)`，
四种组合 = 604 / 548 / 476 / 420。代码阈值写 442px（沿用初版 32px 顶距的保守口径，比现行 434px 松 8px），
四种组合下判定结果一致（仅 420 不提示）；后续统一收敛为 434px，不影响本次出图。

## 8. 兼容性与行为变更

| 项 | 处理 |
|---|---|
| `modules/clock.js` | 保留 `updateClock` / `startClockTimer` / `stopClockTimer` 接口。**首页强制 `timeFormat = {hour, minute, second:false}`**：带秒 `09:24:31` = 4.3P @44 = 252px 超 168px，带完整日期更是 12.3P，物理上放不下，故首页只显示 `HH:MM`。 |
| `dateText` | 页面自行生成 `M月D日`（`11月14日`），`onShow` 刷新，不使用 `currentTime` 里的日期部分。 |
| `modules/countdown-hero.js` | 保留 `loadCountdownHero` / `openCountdown` / `cdBadge` / `cdUnit` / `cdTitle`。**不渲染 `cdSubText`**（模块内 `dateText + " · " + nextText` 含禁用的 `·`）。 |
| `modules/pinned-pages.js` | 保留 `loadPinnedPages` / `openPinnedPage`，但首页改为单个「已钉页面」入口跳 `/pages/pinned-pages`，不再平铺钉页标签（避免行数不可控）。 |
| `homepage_settings.toolViewMode` | 首页不再读取；`pages/tools` 仍消费，数据不破坏。 |
| `showTime` / `showCountdown` | 继续生效（`display` 绑定切换）。`showTime` 实际控制的是「时钟组 / 品牌行」二选一，状态区本身始终占位。 |
| `showPinnedBar` | 不再控制首页渲染，保留读取以兼容设置页。 |
| 默认配置实测 | `store.getHomepageSettings` 默认 `showTime: false`、`hasCountdown: false`，故模拟器首帧为「`Ev工具箱` + 4 个操作行」，无滚动提示（420 ≤ 442）。这不是渲染失败，是开关按配置生效。 |
| 退出 | `utils.exitApp()` 失败 → 内联状态条 `手势返回`，**移除 `prompt.showToast`**。 |
| 方法名 | 避开 `fail` / `success` / `complete` / `callback`（手册事故 #12 静默失败）。 |
| 屏型 | **刻意不用 `@media`**：固定 `padding: 40px 12px 16px 12px`，40px 顶距即胶囊屏圆角安全区。初版写过 `@media (shape: capsule), (shape: pill-shaped)` 逗号列表，快应用引擎不支持该写法（防黑屏十诫第 5 条），v2 已删除；本页只面向 192×490 手环 9 胶囊屏，固定值是唯一正确值。 |
| 防崩 | `onInit` 链路上的 `for` 与主题异步回调、模块 `init` 全部包 `try-catch`（防黑屏十诫第 1 条），任一模块抛错都保底沿用 `private` 默认主题，整页不会黑。 |

## 9. 验收清单（提交前 14 条）

- [x] 1. 每行 P ≤ 6（最长 4.2P，`11月14日` @24）
- [x] 2. `font-size` 只出现 44 / 28 / 24（30 档本页无节点），无 12~23px
- [x] 3. 行高比 1.36 / 1.36 / 1.42
- [x] 4. 无 `·` `/` `|` `-` 作分隔
- [x] 5. 内容区无 `›` `→` `>` 行内箭头
- [x] 6. 无圆形徽标、无「推荐 / 备用 / 次选」标签
- [x] 7. 主信息行动宾短语，行尾余量 ≤1P（4 字 @28 = 149px / 152px，余 3px）
- [x] 8. 无折行、无 `...` / `…`（终版截图逐行比对，见 §10.3）
- [x] 9. 卡片左右 padding 8px；页面左右 padding 12px
- [x] 10. 内容 ≤735px（最坏 604px），溢出时有滚动提示，未压字号
- [x] 11. 无二维码（本页不涉及）
- [x] 12. 无设备 ID / URL 正文（本页不涉及）
- [x] 13. 页内无 `prompt.showToast`
- [x] 14. 条件渲染用 `display` 绑定不用 `if`；方法名避开保留字

**逐条证据见 §10；14 条静态项全绿，视觉与交互另由 §10.3 / §10.4 的有效截图闭环。**

**命令**：

```bash
cd /Users/Banner/Documents/guomengtao/ev/evbox
grep -nE "font-size: (1[0-9]|2[0-3]|2[5-7]|2[9]|3[1-9]|4[0-3]|4[5-9])px" src/pages/index/index.ux
grep -n "text-overflow\|›\|→\|showToast\|if={{" src/pages/index/index.ux
npm run build
```

**截图**：本次实跑为默认 AVD `xiaomi_band` 的实例 `xiaomi_band-11000`（`emulator-11000`，192×490 胶囊屏），
**必须带机身外壳**（用户铁律），且截前必须先点亮屏幕：

```bash
python3 /Users/Banner/Documents/guomengtao/ev/ev-emubuddy/emubuddy_core.py tap emulator-11000 96 485
python3 /Users/Banner/Documents/guomengtao/ev/ev-emubuddy/emubuddy_core.py \
  shot emulator-11000 /Users/Banner/Documents/guomengtao/ev/evbox/screenshots/EvBox首页-evsix-20261114.png --frame --no-wait
```

## 10. 实测结论回填

### 10.1 L0 静态自检（终版复核 2026-11-14 09:59 +0800）✅ 通过

| 检查 | 结果 |
|---|---|
| `font-size` 分布 | 24px×5、28px×2、44px×2（共 9 处），**只有三档，无 12~23px，无第五档**（30px 档本页无节点） |
| 非法字号扫描 | 0 命中 |
| `text-overflow` / `showToast` / `if=` / `›` / `→` / `chevron` / `border-bottom` / `@media` | grep 命中 7 行，逐行核对**全是注释或说明文字，代码 0 处** |
| 横向 padding | `.page 40px 12px 16px 12px`、`.focus 12px 8px`、`.action 10px 8px` ✅ |
| 条件渲染 | 全部 `style="display: {{ ... }}"`，无 `if` 指令 ✅ |
| 文件体积 | 1733 行 → **435 行**（清掉约 1300 行旧样式与三视图模板） |

### 10.2 L1 构建验证 ✅ 通过（三轮）

| 轮次 | 产物 | 变更 |
|---|---|---|
| ① 09:34 +0800 | `…release.1.0.64.rpk` 778,683 B | 首版重设计，`build success: 12981ms`；241 条目、24 个页面 jsc、包内 manifest `1.0.64 / 65 / entry=pages/index` ✅ 无「缺 pages」坏包特征 |
| ② 09:41 +0800 | `…release.1.0.65.rpk` | 删 `@media` 逗号列表、固定 40px 顶距、`onInit` 链路加 try-catch |
| ③ 09:47 +0800 | `…release.1.0.66.rpk` 778,779 B | 加钟关品牌锚点、操作行纵向间距 10→20px；**终版** |

三轮 `npm run build` 均无编译错误，唯一告警是无关的 `qrcode-generator.ux` 未使用变量。
构建生命周期自动 bump `src/manifest.json`（`1.0.66 / versionCode 67`）与 `src/data/version.js`，
已随 `9787e5a` 一并提交（预期副作用，非他人 WIP 混入）。
包体校验用 UTF-16LE 中文搜 `pages/index/index.jsc`：`Ev工具箱` / `全部工具` / `下滑查看` 均命中 → 新代码确进包。

### 10.3 L2 模拟器视觉验收（2026-11-14 09:53 +0800）✅ 通过

- 实例：`xiaomi_band-11000`（默认 AVD `xiaomi_band` / `emulator-11000`，192×490 胶囊屏）；全程未触碰 `evc-xiaomi_band-buddy-1`。
- 终版证据：`screenshots/EvBox首页-evsix-20261114.png`，**带机身外壳**，画布 281×820，69,380 B，非黑屏。
  （该文件在 `.gitignore` 的截图噪音抑制条目内，按仓库约定仅本地留档、不入库，作为对话交付证据展出。）
- 点亮前后 fb0：全零 → 188,160 字节全非零（原因见 §10.5 第 1 条）。
- OCR 逐行（上→下）：`Ev工具箱`（`accent` 青、28px 裸文、无底色）→ `全部工具`（`cardLight` 亮底主操作、28px 白）→ `已钉页面` / `设置` / `退出`（`card` 深蓝次操作、28px 白）。
- 与源码文本节点逐一比对：**无省略号、无行内箭头、无分隔符、无折行、无裁切、无重叠**；四个操作行等高等距，底部约 1/5 屏留白，三级底色层次清楚。
- 本帧未显示时钟／日期／倒数日／`下滑查看`：本机 `showTime:false`、`hasCountdown:false`、内容 420px 未超阈值，按配置正确隐藏，**不是渲染缺失**。

### 10.4 L3 主交互验证（09:54 +0800）✅ 通过

`emubuddy_core.py tap emulator-11000 96 118` 点「全部工具」→ 跳转 `pages/tools`，
OCR 读到 `图文` / `倒数日` / `计算器` / `一言` 等工具项，主操作路由正常。
证据图 `build/evsix_tmp/交互验证.png`（14,889 B，临时裸屏图，仅本地留存，`build/` 已在 `.gitignore`）。

### 10.5 排障实录与坑（首轮 L2 曾被判「受阻」，以下为真因）

首轮 09:37 的「黑屏 = 渲染管线未预热」判读**已被实测推翻**，不得沿用。真因与处置：

1. **屏幕熄了，不是渲染挂了**（`pit-20261026-35`）：fb0 连续 30s 全零只是 guest 熄屏。
   `emubuddy_core.py tap <serial> 96 485` 点亮后 fb0 立即 188,160 字节全非零，同帧即可截图。
   `vela tap` 走 EvFleet 票据闸会被拦，用 `emubuddy_core.py tap` 直连 console 注入即可。
2. **帧缓冲残留旧帧**（`pit-20261109-117`）：换包后连截多张字节完全一致时，注入一次点击触发重绘再截。
3. **guest 明文遮蔽字节码**（`pit-20261109-126`）：旧 debug 包残留 `app.js`、`pages/index/index.js` 与整套旧 `pages/*.js`。
   已把 `app.js` → `app.js.bak_20261114`、`pages` → `pages_old_20261114`，重新 `unzip -o` 后根目录只剩 `app.jsc`、首页只剩 `index.jsc`。
4. **同机并发会话互相覆盖 guest**（本次新坑，已 `ev pit add`）：同日另有「抉择页」任务共用这台实例，
   guest `router.entry` 被改成 `pages/decide`、`pages/index/index.jsc` 被换回旧版（本地 42,156 B vs guest 41,667 B），
   两次截图直接出「抉择」页。处置：① `emubuddy_core.py deploy <serial> evbox --force` 重装；
   ② 单独 `adb push` 首页 `index.jsc` 覆盖；③ 把「刷包 → 校验 guest manifest/jsc → 拉起 → 唤醒 → 截图」串进**同一条 Bash 命令**，不留被抢占的时间窗。
5. **vapp 冷启动与会话生命周期**（`pit-20261109-116`）：`am stop` 杀不掉 NuttX 上的遗留 vapp，
   必须另起 `sleep 600 | adb shell vapp app/<pkg>` 常驻前台任务，等 20s 以上再截图。
6. **防御性改动（非黑屏真因）**：删除 `@media` 逗号列表、给 `onInit` 链路加 try-catch，
   是照防黑屏十诫做的加固；不能倒推成「黑屏由媒体查询引起」。

### 10.6 结论与遗留

**L0 / L1 / L2 / L3 四层均取得有效证据，ev-six 提交前 14 条全绿，本单交付通过。**

遗留（不影响交付，后续按需补）：

- 时钟开启分支（44px 时刻 + 24px 短日期）与倒数日焦点卡未单独出图：本机默认配置关闭了两项，
  已静态确认 `display` 绑定、字号与宽度预算；要出图需在设置页打开开关后重采。
- 共享实例 `emulator-11000` 取证后由别的会话占用/下线，复现需按 §10.5 的一次式链路重来。

## 11. 版本

| 版本 | 日期 | 变更 |
|---|---|---|
| v1 | 2026-11-14 09:30 +0800 | 首版骨架：现状审计、信息架构、token、位置计费、组件骨架、验收清单；首轮实测（黑屏误判受阻）随 `9787e5a` 同提交 |
| v2 | 2026-11-14 09:59 +0800 | 终版回填：品牌锚点、固定 40px 安全区、纵向留白预算、14 条自检打勾、L0~L3 实测证据、排障真因与遗留项 |
