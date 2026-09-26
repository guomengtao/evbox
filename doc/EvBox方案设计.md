# EvBox 工具箱 — 方案设计文档（v3 · 基于真实源码实测）

> 基于 **Ev 课程表快应用**（`class-schedule`）的核心架构，打造通用快应用工具箱 + 可复用项目模板。
>
> **本版已 clone 源码并逐文件核对，所有结论均有代码依据，不再有"推测"。**
> 源码位置：`reference/class-schedule`（`git clone --depth 1`，仅作分析用，建议加入 `.gitignore` 或分析后删除）。

---

## 本次说明（v2 → v3）

| # | v2 的推测 | v3 实测结果 |
|---|-----------|-------------|
| 1 | 包名 `com.guomengtao.classschedule` | 实际为 **`com.application.watch.classschedule`** |
| 2 | 激活逻辑"推测包含 validation/storage/api" | 实际为单一文件 **`src/data/auth-store.js`**，纯本地 storage，无云端 API |
| 3 | 首页"可拖拽排序的栏目引擎" | 实际为 **固定模块开关制**（`homepage_settings.show*` 布尔）+ **`pinned_pages` 钉首页**（`{name,uri}` 数组） |
| 4 | interconnect 用途不明 | 实际**集中在 `src/app.ux` 一个自包含模块**，是 AstroBox 插件同步通道 |
| 5 | 工具箱要从零开发计算器/倒计时/二维码 | **倒数日、二维码生成、震动自定义、数据统计等已存在**，可直接复用 |
| 6 | 版本控制"可能是 OTA" | 实际为 **`scripts/bump-version.js`** 改 manifest + 生成 `src/data/version.js` |

---

## 一、项目概述

### 1.1 背景

`class-schedule`（Ev 课程表）是成熟的**手环快应用**，核心可复用资产：

- **高级版激活机制**：`src/data/auth-store.js`（试用 7 天 / 期限版 / 永久版 / 万能码 / 历史记录）
- **首页框架**：模块开关制（`homepage_settings`）+ 钉首页（`pinned_pages`）
- **interconnect 同步通道**：`src/app.ux`（AstroBox 插件 ↔ 手环），守门人权限模型 `SYNC_ACCESS`
- **工具集**：倒数日、二维码生成、震动自定义、设备信息、数据统计、黑屏检测
- **版本控制**：`scripts/bump-version.js` + `src/data/version.js`
- **图标工具链**：`generate-logo.py`、`_gen_icons_node.js`、`_gen_lucide_icons.py`、`ICON_PLATFORM_ANALYSIS.md`

现基于其核心架构创建 **EvBox 工具箱**，清理课程业务，沉淀通用模板与核心包。

### 1.2 目标

| 目标 | 说明 |
|------|------|
| 新应用 EvBox | 手环工具箱快应用 |
| 复用激活机制 | 完全复用 `auth-store.js`，仅改品牌文案 |
| 复用首页框架 | 保留模块开关 + 钉首页 |
| **去掉 interconnect** | 工具箱无外部宿主，通道整体移除（详见第三章） |
| 清理课程业务 | 删页面/组件/数据/权限 |
| 复用已有工具 | 倒数日、二维码、震动等直接迁入 |
| 通用模板化 | 清理后作为未来项目 starter |
| 核心代码包化 | 激活等抽为独立可复用包 |

---

## 二、真实架构分析（实测）

### 2.1 真实工程结构

```
class-schedule/
├── src/
│   ├── app.ux                      # ★ 应用入口（含 interconnect 同步 + resident 保活）
│   ├── manifest.json               # ★ 包名/版本/features/router 定义
│   ├── common/                     # 图标、header 样式、logo.ico
│   ├── components/
│   │   ├── InputMethod/            # 中文输入组件（含词典库）
│   │   ├── clock/  day-nav/
│   │   ├── premium-overlay.ux      # ★ 高级版遮罩
│   │   ├── pro-card.ux  unlock-dialog.ux
│   ├── data/                       # ★ 数据层（核心）
│   │   ├── auth-store.js           # ★★ 激活机制（16KB，纯本地）
│   │   ├── store.js                # ★ 存储门面（主题/字号/昵称/首页设置）
│   │   ├── database.js             # 课表数据（32KB，业务）
│   │   ├── pin-helper.js           # ★ 钉首页（pinned_pages）
│   │   ├── premium-overlay.js      # ★ 高级版遮罩控制
│   │   ├── storage-tables.js       # ★ 全部存储键清单（含 auth/backup）
│   │   ├── version.js              # ★ 版本号（构建时生成）
│   │   ├── products.js  schedule.js  schedule.json
│   │   ├── holiday-preset.js  holidays-2026.js  utils.js
│   ├── lib/
│   │   ├── crypto.js               # ★ 加密（激活校验用）
│   │   └── qrcode.js               # ★ 二维码生成库
│   ├── pages/                      # 40+ 页面（见 2.3）
│   ├── utils/device-uuid.js        # ★ 设备指纹（激活用）
│   └── i18n/
├── scripts/                        # 构建/版本/图标/数据脚本
│   ├── bump-version.js  build.js  build-log.js  data-keys.json
│   ├── generate-logo.py  batch_convert_icons.py
│   ├── check-storage.js  manage-auth.js  set-auth.js  switch-auth.sh
├── doc/  docs/                     # 132K + 3.4M 文档（含 QA 报告，可剔除）
├── lib/  patches/
├── package.json                    # aiot-toolkit 构建
├── storage-data.json               # 存储数据样例（8KB）
└── changelog / README / 大量 _*.js 临时分析脚本
```

### 2.2 技术栈与构建（实测）

| 项 | 实测值 |
|----|--------|
| 构建工具 | `aiot-toolkit ^2.0.5` + `@aiot-toolkit/jsc`（JS 字节码，`--enable-jsc`） |
| 脚本 | `npm start`(开发 watch) / `npm run build` / `npm run release` / `npm run bump` |
| 包名 | `com.application.watch.classschedule` |
| 应用名 | `Ev课程表` |
| 版本 | `versionName 1.6.130` / `versionCode 959`，渠道 `t-9p-d` |
| 设备类型 | `watch`（手环），`minPlatformVersion 1050` |
| icon | `/logo.png` |
| features | router / storage / prompt / device / vibrator / request / app / **resident** / **interconnect** / clipboard / file |
| 入口页 | `pages/welcome` |

> **构建产物为 `.rpk` + JSC 字节码**，这对"独立包"方案很关键——见第五章。

### 2.3 核心资产盘点（页面级）

| 资产 | 路径 | 工具箱处置 |
|------|------|-----------|
| 激活 | `pages/activation`（36KB）+ `data/auth-store.js` + `lib/crypto.js` + `utils/device-uuid.js` | ✅ 保留 |
| 高级版遮罩 | `components/premium-overlay.ux` + `data/premium-overlay.js` + `pro-card.ux` + `unlock-dialog.ux` | ✅ 保留 |
| 首页 | `pages/index`（92KB，含 `modules/` 10 个模块） | ⭕ 改造 |
| 首页设置 | `pages/homepage-settings`（24KB） | ⭕ 改造 |
| 钉首页 | `pages/pinned-pages` + `data/pin-helper.js` | ✅ 保留（语义改"钉工具"） |
| 设置 | `pages/settings`（24KB） | ⭕ 改造 |
| **工具页** | `pages/tools`（8.5KB，工具入口列表） | ✅ **工具箱雏形，直接扩展** |
| **倒数日** | `pages/countdown-manage`（16KB） | ✅ **直接复用** |
| **二维码生成** | `pages/qrcode-generator`（20KB）+ `lib/qrcode.js` | ✅ **直接复用** |
| **震动自定义** | `pages/vibration-lab`（92KB）+ `vibration-lab-v2` | ✅ 复用 |
| 设备信息/诊断 | `pages/device-info`、`device-id-diagnosis` | ✅ 复用 |
| 数据统计 | `pages/statistics` | ✅ 复用 |
| 黑屏检测 | `pages/black-screen-check` | ⭕ 可选 |
| 备份恢复 | `pages/backup-restore`（24KB，纯本地 storage） | ✅ 复用 |
| 重置数据 | `pages/reset-data` | ✅ 复用 |
| 打赏 | `pages/donate` | ✅ 保留 |
| welcome | `pages/welcome` | ⭕ 改造文案 |
| 欢迎/引导 | — | 新增 |
| 课程类 | `detail`、`add-course`、`add-course-v2`、`course-manager(-v2)`、`schedule-manager`、`week-view`、`schedule-qrcode`、`workday-info`、`custom-content-edit`、`lab-*`、`statistics`(课表向) | ❌ 删除 |
| 输入法 | `components/InputMethod` + `pages/chinese-input` | ⭕ 按需（见 4.5） |
| Demo/诊断页 | `bs-demo1~5`、`header-demo1/2`、`test-area`、`capsule-hide-test`、`input-crash-diag` | ❌ 删除 |

### 2.4 激活机制实测（`src/data/auth-store.js`）

**纯本地 storage 实现，零网络、零 interconnect 依赖。**

存储键（来自 `storage-tables.js`）：

| key | 说明 |
|-----|------|
| `auth_data` | 激活主体：`installTime / isActivated / isPermanent / expireAt / activatedAt / productId / trialDays / history` |
| `master_usage` | 万能码按设备使用次数（`{deviceId: count}`） |
| `used_codes` | 已用激活码列表 |
| `used_redeem` | 已用兑换码列表 |
| `premium_unlocked` | 高级功能解锁状态（布尔，供各页判断） |

**状态机**（`buildStatus`）：`permanent`(永久) / `active`(剩余>3天) / `auth_expiring_soon`(≤3天) / `auth_expiring_critical`(≤1天) / `auth_expired` / `basic`(未激活)。

**关键设计**：
- `MASTER_CODE`（万能码）硬编码在 `auth-store.js`，仅"已过期用户"可用，每设备限 30 次
- `DEFAULT_TRIAL_DAYS = 7`
- `FORCE_AUTH_MODE` 调试开关（可强制 standard/permanent/expire/months:N）
- 每日提醒 `needsDailyRemind` / `markRemindedToday`

> **复用结论**：`auth-store.js` 是**唯一需要参数化的核心文件**——把 `storageKey`、`MASTER_CODE`、品牌文案抽出即可，逻辑零改动。**不需要 interconnect，也不需要云端。**

### 2.5 首页栏目机制实测（重要修正）

首页**不是**"自由拖拽排序的栏目列表"，而是两层：

**第一层：固定模块开关**（`homepage_settings` → `pages/homepage-settings` 的 `show*` 布尔）

| 字段 | 默认 | 对应模块 |
|------|------|---------|
| `showQuickAdd` | true | `modules/quick-add.js` ✗课程业务 |
| `showStatusBar` | true | `modules/status-bar.js` |
| `showTime` | true | `modules/clock.js`（含 `timeFormat` 年月日时分秒开关） |
| `showPinnedBar` | true | `modules/pinned-pages.js` ★ |
| `showDayNavZong/Jin/Ming` | true | `modules/day-nav.js` ✗课程业务 |
| `showCustomContent` | false | `modules/custom-content.js` ✗课程业务 |
| `showFontSize` | false | 字号设置 |
| `showLabSection` | — | 实验室入口 |

index.ux 通过 `loadModule(name, require(...))` 加载：clock / quickAdd / dayNav / statusBar / customContent / pinnedPages / bottomButtons / classList / holiday。

**第二层：钉首页**（`pinned_pages`，来自 `src/data/pin-helper.js`）

```js
// pin-helper.js
var KEY = "pinned_pages"
// 结构：[{ name: "Ev课程表", uri: "/pages/index" }, ...]
// API: pinPage(name, uri) / unpinPage(uri) / isPinned(uri) / getList(cb)
```

> **改造要点**：第一层里凡是"课程业务模块"（quickAdd / dayNav / customContent / classList / holiday）**整体删除**；保留 statusBar / clock / pinnedBar。**工具箱的"入口自定义"能力主要由 `pinned_pages` 承担**——把候选 URI 换成工具页即可，机制完全复用。

### 2.6 数据存储层

`src/data/store.js`（25KB）是存储门面，导出：主题 `getTheme/setTheme/getAvailableThemes`、字号 `getBaseFontSize/setBaseFontSize`、昵称、首页设置 `getHomepageSettings/setHomepageSettings`、模板 `getHomepageTemplate`、`clearCache()` 等。`storage-tables.js` 集中登记全部 key，可作数据契约。

> `clearCache()` 注释明确：**备份恢复/恢复出厂直接写存储后必须调用**，否则读到过期数据——改造时注意保留。

---

## 三、interconnect 通道去留决策 ⭐（本次核心议题）

### 3.1 interconnect 到底是什么（实测）

它不是"应用内导入导出"，而是**手环快应用 ↔ 手机端插件（AstroBox 同步器）**的跨端消息通道。

实测位置：**全部集中在 `src/app.ux` 一个自包含模块**（约 500 行，59–598 行），包含：

| 部分 | 行号 | 作用 |
|------|------|------|
| `require("@system.interconnect")` | 59–65 | try/catch 引入，失败静默 |
| `SYNC_ACCESS` 权限表 | 259–267 | 守门人策略（read×write） |
| `SYNC_FIELD_DOMAIN` | 270–276 | 写权限字段→域映射 |
| `syncHandleImport` | 180–237 | 插件导入课表（写入 `allCourses_N`，写前备份到 `astrobox_sync_backup`） |
| `syncCollectScopes` / `syncHandleExport` | 332–452 | 按 scope 导出数据 |
| `syncHandleUpdateSettings` | 455–505 | 插件改昵称/首页/模板/字号 |
| `initSyncReceiver` | 507–598 | 绑定 `onmessage/onopen/onerror/onclose`，收到报文先落 `astrobox_sync_data` |

引入它的副作用：`app.ux` 里还引入了 **`@system.resident`**（14–57 行）并**开机自动常驻**，注释写明：

```
// 自动常驻保活：保证 interconnect 同步消息随时可收，无需用户手工开启「后台运行」
startResident()
initSyncReceiver()
```

### 3.2 结论：工具箱去掉 interconnect —— 可行且推荐 ✅

**理由**：interconnect 的**唯一消费者是手机端插件**。工具箱是手环本地工具集合，没有任何外部宿主程序要读写它 → 通道无使用场景。

**去掉的收益**：
1. `app.ux` 从 ~660 行降到 ~60 行（保留 init 初始化逻辑）
2. 移除开机常驻保活 → **省电**（对工具类应用尤其重要）
3. 移除 2 个 feature 声明，减少系统权限面
4. 移除 2 个诊断用 storage key
5. `SYNC_ACCESS` 守门人模型整体不需要，安全面收窄

**去掉的成本：≈ 0**——因为它是自包含的，不与激活、首页、存储耦合。

### 3.3 interconnect ≠ resident（关键提醒）⚠️

这是最容易搞错的一点：

| 能力 | 作用 | 工具箱是否需要 |
|------|------|---------------|
| `@system.interconnect` | 与手机插件跨端通信 | ❌ 不需要 |
| `@system.resident` | 快应用后台常驻保活 | ⚠️ **看是否有"定时/提醒"类工具** |

`app.ux` 里 resident 是"为接收同步消息而常驻"。**去掉 interconnect 后，resident 的唯一存在理由消失**——除非工具箱要做**闹钟 / 定时提醒 / 后台倒计时检查**。

> 所以决策要拆成两步：**① 去 interconnect（确定）；② resident 是否保留，取决于闹钟功能（见 3.4）。**

### 3.4 "闹钟、日记等有数据的工具"分析

用户关注点：有持久化数据的工具，是否需要 interconnect？**要区分两种需求：**

| 需求 | 例子 | 需要什么 | 需要 interconnect？ |
|------|------|---------|-------------------|
| **A. 本机持久化** | 日记正文、倒计时事件、闹钟列表、单位换算历史 | `@system.storage` | ❌ 不需要 |
| **B. 本机后台运行** | 闹钟到点提醒、定时震动 | `@system.resident` + `@system.vibrator` | ❌ 不需要（这是本地能力） |
| **C. 跨端交换** | 在**手机 App**上编辑手环闹钟/日记、云端同步 | `@system.interconnect` | ✅ 需要 |
| **D. 设备迁移/备份** | 换手环、恢复出厂前导出数据 | storage 快照 / **二维码** / 文本码 | ❌ 不需要 |

**逐项结论**：

1. **日记 / 便签 / 倒计时 / 单位换算历史**（A 类）
   - 全部只需 `@system.storage`。现有 `countdown-manage` 就是活生生的范例（纯 storage，无 interconnect）。
   - → **不需要 interconnect。**

2. **闹钟**（B 类，最需要注意）
   - 手环快应用一般**没有系统级闹钟 API**，要做"到点提醒"只能靠 `resident` 常驻 + 定时器 + `vibrator` 震动。
   - 这需要 **resident**，但**仍然不需要 interconnect**。
   - → 决定"是否保留 resident"的关键就是**闹钟功能要不要做**。若只做"倒计时展示"（打开才看），连 resident 都不用。

3. **"导入导出 / 数据备份"**（D 类）
   - **与 interconnect 无关**。实测 `pages/backup-restore` 是**纯 `@system.storage` 多快照**实现：
     - key `backup_list`、`data_backup`、`last_backup_time`
     - 备份 = 把一批 storage key 的值打包存成快照；恢复 = 写回并 `store.clearCache()`
   - 跨设备迁移的替代方案：复用 `src/lib/qrcode.js` 做**二维码导出/导入**（现有 `pages/schedule-qrcode` 就是课表二维码，机制可照搬）。
   - → **不需要 interconnect。**

4. **只有 C 类**（要在手环之外的后台/App 里读写这些数据）才真正需要 interconnect。
   - 若工具箱未来要做"手机端 App 管理手环日记"，届时再接入即可。

### 3.5 interconnect 移除清单（精确到文件）

| 文件 | 删除内容 |
|------|---------|
| `src/app.ux` | `require("@system.interconnect")`(59–65)；`SYNC_*` 常量与全部 sync 函数(67–598)；`initSyncReceiver()`；`onCreate` 中 `initSyncReceiver()`(643) |
| `src/app.ux` | `require("@system.resident")`(14–20)、`startResident/stopResident`(22–57)、`onCreate` 中 `startResident()`(642)、`initBackgroundRunning`(646–652) —— **仅当不做闹钟时** |
| `src/manifest.json` | `features` 中 `system.interconnect`(37)、`system.resident`(34)、`system.clipboard`(40，若无复制需求)、`system.file`(43，若无文件需求) |
| `src/data/storage-tables.js` | `astrobox_sync_data`、`astrobox_sync_backup` 两条 key |
| `src/data/database.js` | `resetCache()`（原为同步导入后刷新用）可保留（备份恢复也用） |

> **建议做法（不删而抽）**：把 `app.ux` 中 59–598 行整块抽成 `src/bridge/sync-receiver.js`，工具箱**默认不 require**；同步能力保留在 `@evbox/bridge-sync` 包里（见第五章）。未来某项目要用，引入即可，零重写。

### 3.6 决策建议

```
① interconnect：工具箱确定移除（抽为可选 Bridge 包，默认不装）
② resident   ：仅当"闹钟/定时提醒"立项时才保留；否则一并移除
③ 备份/迁移  ：用纯本地快照 + 二维码导出（复用 lib/qrcode.js），不依赖 interconnect
④ 预留       ：Bridge 接口保留空实现，未来接回成本 ≈ 0
```

---

## 四、EvBox 改造方案

### 4.1 总体策略

```
class-schedule ──清理──→ evbox-template ──加功能──→ EvBox 工具箱
        │                     │
        ├─抽取─→ @evbox/core-activation      └─→ 未来项目 A / B
        └─抽取─→ @evbox/bridge-sync（可选，默认不装）
```

### 4.2 删除清单（实测版）

| 类别 | 具体内容 |
|------|---------|
| 课程页面 | `detail`、`add-course`、`add-course-v2`、`course-manager`、`course-manager-v2`、`schedule-manager`、`week-view`、`schedule-qrcode`、`workday-info`、`custom-content-edit`、`lab-add-course`、`lab-edit-course` |
| Demo/诊断页 | `bs-demo1`~`bs-demo5`、`header-demo1`、`header-demo2`、`test-area`、`capsule-hide-test`、`input-crash-diag` |
| 首页模块 | `modules/quick-add.js`、`modules/day-nav.js`、`modules/custom-content.js`、`modules/class-list.js`、`modules/holiday.js`、`modules/week-indicator.js`、`modules/bottom-buttons.js`（底部按钮若为课程操作） |
| 数据层 | `data/database.js`、`data/schedule.js`、`data/schedule.json`、`data/holiday-preset.js`、`data/holidays-2026.js` |
| 同步通道 | `app.ux` 内 interconnect 模块；`SYNC_ACCESS`；`astrobox_sync_*` keys |
| 首页设置项 | `showQuickAdd`、`showDayNavZong/Jin/Ming`、`showCustomContent`、`showLabSection`（课程态）、`className` 相关 |
| manifest | `system.interconnect`、`system.resident`(视闹钟)、课程相关 router 页 |
| 工程垃圾 | 根目录 `_*.js`、`_*.sh`、`*.py`（图标脚本除外）、`fix_*.py`、`audit_*.py`、`docs/`(3.4M QA 报告)、`storage-data.json` |

### 4.3 保留清单

| 类别 | 内容 | 改造 |
|------|------|------|
| 激活 | `auth-store.js` + `activation` 页 + `crypto.js` + `device-uuid.js` + `premium-overlay*` + `pro-card.ux` + `unlock-dialog.ux` | 参数化 storageKey / 品牌文案 |
| 首页 | `index`（保留 clock/statusBar/pinned 模块）+ `homepage-settings` | 删课程开关，加工具开关 |
| 钉首页 | `pin-helper.js` + `pinned-pages` | 候选 URI 换工具页 |
| 设置 | `settings` | 更新项 |
| 存储 | `store.js` + `storage-tables.js` | 删课程 key |
| 备份 | `backup-restore` + `reset-data` | 保留（高级功能） |
| 版本 | `bump-version.js` + `version.js` + `build.js` | 保留 |
| 工具 | `tools` + `countdown-manage` + `qrcode-generator` + `lib/qrcode.js` + `vibration-lab*` + `device-info` + `statistics` + `donate` | 直接复用 |
| 图标 | `generate-logo.js`（新，零依赖绘制 EvBox 工具箱图标）+ `batch_convert_icons.py` + `ICON_PLATFORM_ANALYSIS.md` | 生成 EvBox 图标 |

### 4.4 首页重新规划（按真实机制）

**模块开关（`homepage_settings`）改造后：**

| 新字段 | 默认 | 对应模块 | 来源 |
|--------|------|---------|------|
| `showStatusBar` | true | `status-bar.js` | 复用 |
| `showTime` | true | `clock.js` | 复用 |
| `showPinnedBar` | true | `pinned-pages.js` | 复用（核心入口） |
| `showToolGrid` 🆕 | true | `tool-grid.js` 🆕 | 新增（工具宫格） |
| ~~`showQuickAdd`~~ | — | — | 删除 |
| ~~`showDayNav*`~~ | — | — | 删除 |
| ~~`showCustomContent`~~ | — | — | 删除 |

**钉首页（`pinned_pages`）语义重定义**：
- 数据结构不变：`[{ name, uri }]`
- 候选集合换为工具页：`/pages/calculator`、`/pages/countdown-manage`、`/pages/converter`、`/pages/qrcode-generator`、`/pages/note` ...
- 用户仍可自由钉/取消钉 → **"首页自定义"能力 100% 保留**

### 4.5 工具功能规划

| 工具 | 状态 | 说明 |
|------|------|------|
| 倒数日 | ✅ **已有** | `pages/countdown-manage`，直接迁入 |
| 二维码生成 | ✅ **已有** | `pages/qrcode-generator` + `lib/qrcode.js` |
| 震动自定义 | ✅ **已有** | `vibration-lab` |
| 设备信息/统计 | ✅ **已有** | `device-info`、`statistics` |
| 数据备份 | ✅ **已有** | `backup-restore` |
| 计算器 | 🆕 开发 | 手环小屏，建议"基础四则 + 历史" |
| 单位换算 | 🆕 开发 | 长度/重量/温度/时间 |
| 随机数 | 🆕 开发 | 骰子/抽签 |
| 便签/日记 | 🆕 开发 | 纯 storage；中文输入可复用 `components/InputMethod` |
| 倒计时（计时器） | 🆕 开发 | 与"倒数日"区分：这是秒级计时 |
| 闹钟 | ⚠️ 待定 | 需 `resident`；决定 resident 去留 |
| 秒表 | 🆕 开发 | 无持久化需求 |
| 汇率 | ⚠️ 需网络 | 需 `system.request`，可离线汇率表 |

> **中文输入**：`components/InputMethod` + `lib` 词典体积不小（含 arc/full/t9/horizontal 多套）。便签/日记若要中文输入则保留，否则删除以瘦身。

### 4.6 包名 / 品牌 / 图标（实测旧值 → 新值）

| 项 | 实测旧值 | 建议新值 |
|----|---------|---------|
| `package` | `com.application.watch.classschedule` | `com.application.watch.evbox` |
| `name` | `Ev课程表` | `EvBox工具箱` |
| `versionName` | `1.6.130` | **`1.0.0` 重新起算** |
| `versionCode` | `959` | **`1` 重新起算** |
| `icon` | `/logo.png` | 新 EvBox 图标 |
| 激活 storageKey | `auth_data` / `master_usage` / `used_codes` / `used_redeem` / `premium_unlocked` | 保持同名（天然隔离，因应用独立）或加 `evbox_` 前缀 |
| `MASTER_CODE.code` | `202656183702` | **换新码**（避免跨应用通用） |
| 激活文案 | "Ev课程表高级版" | "EvBox 高级版" |
| channel | `t-9p-d` | 自定义（如 `evbox-d`） |

> 注：快应用**同一设备上不同 `package` 的 storage 相互隔离**，故 key 名可沿用；但激活码/万能码必须换，否则同一码在两个应用都能激活。

---

## 五、独立包仓库方案

### 5.1 包划分（基于实测依赖）

```
evbox-workspace/
├── packages/
│   ├── core-activation/   # @evbox/core-activation
│   │   ├── auth-store.js      ← 参数化自 src/data/auth-store.js
│   │   ├── crypto.js          ← src/lib/crypto.js
│   │   ├── device-uuid.js     ← src/utils/device-uuid.js
│   │   └── premium-overlay.js ← src/data/premium-overlay.js
│   ├── core-base/         # @evbox/core-base
│   │   ├── store.js           ← src/data/store.js（去课程）
│   │   ├── storage-tables.js
│   │   └── version.js
│   ├── core-homepage/     # @evbox/core-homepage
│   │   ├── pin-helper.js
│   │   └── homepage-settings 逻辑
│   └── bridge-sync/       # @evbox/bridge-sync（可选，默认不装）
│       └── sync-receiver.js   ← 抽自 app.ux 59–598 行
├── apps/
│   ├── evbox/             # EvBox 工具箱
│   └── future-app/
└── pnpm-workspace.yaml
```

### 5.2 快应用的特殊约束（实测相关）⚠️

| 约束 | 影响 | 应对 |
|------|------|------|
| 构建工具为 `aiot-toolkit`，产出 `.rpk` + JSC 字节码 | 无标准 npm 打包链，node_modules 依赖需被内联编译 | 用 **workspace 源码引用**（`require` 相对路径）而非运行时 npm 解析；构建前用脚本把包源码拷进 `src/` |
| 代码是 `require`（CommonJS）而非 ESM | 包入口需兼容 CJS | 包统一用 `module.exports` |
| 无 TS 编译链 | 不能直接发 TS 包 | 包用纯 JS（与现有一致） |

> **因此推荐路径：** 包化 ≠ 发 npm。第一阶段用 **mono-repo + 同步脚本把 `packages/*/` 软链或拷贝进 `apps/evbox/src/`**，构建时内联。这样既单点维护，又不破坏 aiot 构建。

### 5.3 方案对比与推荐

| 方案 | 适配度 | 说明 |
|------|-------|------|
| A. npm 私有包 | ⚠️ 低 | 快应用构建不友好，需额外内联步骤 |
| B. Git Submodule | ✅ 中 | 可行，但子模块 + aiot 构建易踩坑 |
| **C. Mono-repo + 源码内联脚本** | ✅ **高（推荐）** | 单仓多包，构建前同步到 `src/` |
| D. 手动 cp 脚本 | ⭕ 过渡 | 简单但易漏 |

**推荐**：**C 为主，初期用 D 过渡**；不建议 A。

### 5.4 核心包接口设计（参数化）

```js
// @evbox/core-activation
var activation = require('@evbox/core-activation').create({
  appId: 'evbox',                  // 区分项目
  storageKeys: {                   // 存储隔离
    auth: 'auth_data',
    masterUsage: 'master_usage',
    usedCodes: 'used_codes',
    usedRedeem: 'used_redeem'
  },
  trialDays: 7,
  masterCode: { code: '新码', duration: 1, maxUsesPerDevice: 30 },
  brand: 'EvBox 高级版'
})

activation.checkStatus(function (status) { /* ... */ })
activation.markActivated(days, code, redeem, cb)
activation.isPremiumUnlocked(cb)
```

**原则**：配置化（appId/keys/code/brand 注入）、无 UI 依赖、状态隔离、semver、自带测试。

---

## 六、版本控制（实测流程）

### 6.1 现有机制

```
scripts/bump-version.js:
  1. 读 src/manifest.json
  2. versionName patch+1，versionCode+1
  3. 写回 manifest.json
  4. 生成 src/data/version.js: { versionName, versionCode, channel }
  5. 保留原 channel
```

- `npm run prebuild` → 自动 bump
- `npm run release` → `aiot release --enable-jsc` + `scripts/rename-rpk.js`
- `version.js` 被 `app.ux` 的 `syncCollectVersion()` 读取（去掉 interconnect 后此函数删除，但 `version.js` 仍可用于"关于页"）

### 6.2 EvBox 沿用与隔离

| 项 | 处理 |
|----|------|
| `bump-version.js` | **原样复用** |
| `versionName` | 从 `1.0.0` 重新起算（不继承 1.6.130） |
| `versionCode` | 从 `1` 重新起算（避免与原应用市场记录冲突） |
| `channel` | 改为 EvBox 专属（如 `evbox-d`） |
| Git 分支 | `main` / `develop` / `feat/*` / `fix/*` 沿用 |

---

## 七、通用模板沉淀

### 7.1 打 tag

清理完成、加工具功能**之前**：

```bash
git tag v0.1.0-template && git push origin v0.1.0-template
```

### 7.2 模板边界

| 含（Core + 骨架） | 不含（业务） |
|------------------|-------------|
| 激活全流程（参数化） | 任何具体工具页 |
| 首页模块开关框架 + 钉首页 | 课程表任何页面/模块 |
| `store.js` + `storage-tables.js` | `database.js` / `schedule.*` |
| 备份恢复 / 重置数据 | 课程数据 key |
| 版本控制脚本 | 业务图标/文案 |
| 图标生成工具链 | — |
| `bridge-sync`（可选包） | 默认不引入 |

---

## 八、实施步骤

### 阶段一：清理（1–2 天）

| 步骤 | 任务 |
|------|------|
| 1 | clone 为 `evbox` 新仓库，改 origin |
| 2 | 删课程页面/模块/数据层（§4.2） |
| 3 | 删 interconnect + resident（§3.5） |
| 4 | 改包名/应用名/图标/版本起点/万能码/文案 |
| 5 | 删根目录临时脚本、`docs/` |
| 6 | 打 `v0.1.0-template` tag |
| 7 | 验证可构建运行 |

### 阶段二：核心包抽取（1–2 天）

| 步骤 | 任务 |
|------|------|
| 1 | 建 mono-repo `packages/` |
| 2 | 抽 `core-activation`（参数化） |
| 3 | 抽 `core-base` / `core-homepage` |
| 4 | 抽 `bridge-sync`（默认不装） |
| 5 | 写内联同步脚本 + SDK 文档 |

### 阶段三：工具开发（3–5 天）

| 步骤 | 任务 |
|------|------|
| 1 | 首页 `tool-grid` 模块 + 首页设置改造 |
| 2 | 钉首页候选换工具 |
| 3 | 计算器 / 单位换算 / 随机数 / 秒表 |
| 4 | 便签（含中文输入决策） |
| 5 | 闹钟立项决策（决定 resident） |
| 6 | 高级功能门控（premium_unlocked） |

### 阶段四：测试发布（1–2 天）

功能测试 / 激活流程 / 首页与钉首页 / 各表盘形状（`@media shape: circle/capsule/pill-shaped`）/ 打包发布。

---

## 九、风险与注意事项

| 风险 | 应对 |
|------|------|
| 各表盘形状适配（圆屏/胶囊）| 现有 CSS 已用 `@media (shape: ...)`，新页面需照做 |
| JSC 字节码与动态 require | 避免运行时动态路径 require，保持静态 `require` |
| 清理不彻底残留课程引用 | 全局搜索 `course`/`schedule`/`课` 确认 |
| 万能码跨应用通用 | 换新 `MASTER_CODE.code` |
| 备份恢复后读到缓存 | 必须调 `store.clearCache()` |
| 中文输入组件体积大 | 按是否做便签决策 |
| resident 耗电 | 不做闹钟即移除 |
| 签名证书 | `.gitignore` 已忽略 `/sign`，需重新生成 EvBox 专属证书 |

---

## 十、总结

```
                ┌──────────────────────────┐
                │  class-schedule 课程表     │  (实测：包名 com.application.watch.classschedule)
                └────────────┬─────────────┘
                             │ ①删课程业务 ②去interconnect ③换品牌
                             ▼
                ┌──────────────────────────┐
                │   evbox-template          │  ← 未来项目 starter (tag v0.1.0-template)
                └────────────┬─────────────┘
                             │ ④加工具
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
 ┌─────────────┐   ┌──────────────────┐   ┌──────────────┐
 │ @evbox/core │   │  EvBox 工具箱     │   │  未来项目      │
 │ -activation │◄──│ 计算器/倒计时/    │   │  复用 Core    │
 │ -base       │   │ 单位换算/便签…    │   │              │
 │ -homepage   │   │ （倒数日/二维码/  │   └──────────────┘
 │ -bridge(可选)│   │  震动 已现成）    │
 └─────────────┘   └──────────────────┘
```

**核心结论（本次）**：
1. **interconnect 可以去掉**——它只服务于手机端插件，工具箱无消费者；移除成本≈0，且省电。
2. **注意 interconnect ≠ resident**——闹钟/定时提醒需要 resident（本地能力），与 interconnect 无关。
3. **备份/导入导出不需要 interconnect**——现有 `backup-restore` 是纯本地 storage 快照；跨设备可用二维码（`lib/qrcode.js`）实现。
4. **日记/倒数日等有数据的工具**——纯 `storage` 足够，现有 `countdown-manage` 即范例。
5. **只有"在手环之外读写工具箱数据"才需要 interconnect**——属产品决策，可按需预留 `@evbox/bridge-sync`。
6. **激活机制 100% 本地**（`auth-store.js`），复用只需参数化，是稳定资产。

---

## 十一、实施记录（2026-09-26，阶段一已完成）

### 11.1 已完成

| 项 | 结果 |
|----|------|
| 源码分析 | clone 至 `reference/class-schedule`（shallow），逐文件核对，消除全部"推测" |
| 项目骨架 | 创建 `evbox/`（排除 `.git` / `docs/` / 临时脚本），已 `git init` 为独立仓库 |
| 页面清理 | 43 → **18** 个页面，删除全部课程 / demo / 诊断页 |
| 数据层 | 删除 `database.js`、`schedule.js`、`schedule.json`、`holiday-preset.js`、`holidays-2026.js` |
| 首页重写 | `index.ux` 1692 → **1189** 行，改为「时钟 + 钉首页栏 + 工具宫格 + 底部按钮」 |
| **interconnect** | 从 `app.ux` 整体移除；`@system.resident` 保活一并移除；manifest 移除对应 features |
| 激活机制 | `auth-store.js` 完整保留（仍内嵌，未参数化） |
| 品牌 | 包名 `com.application.watch.evbox`、名 "EvBox工具箱"、`1.0.0` / `versionCode 1` |
| 首页设置 | 改为「时钟 / 字号 / 钉首页」三项，课程开关全删 |
| 设置页 | 去除周课表、隐藏周末、重置数据、课程字号等课程项 |
| 存储表 | `storage-tables.js` 精简为工具箱 key |
| 文案去课程化 | 高级版权益、i18n、products、备份页 |
| 修复 | `backup-restore.ux` 首行脏数据 `rinuo@qq.com`（会导致编译失败） |
| **构建验证** | ✅ `npx aiot build` 通过，产出 `com.application.watch.evbox.debug.1.0.0.rpk`（4.4s） |

### 11.2 验证结果

- 课程关键词**零残留**（仅输入法词典含"课程"一词，属通用词库）
- 全部页面跳转引用（19 个）与实际页面（18 个）**完全一致**，无死链
- 全部 `.js` 通过 `node --check`；`manifest.json` 与 i18n JSON 合法
- 无 `.ux` 首行异常

### 11.3 遗留事项（下一步）

| # | 事项 | 说明 |
|---|------|------|
| 1 | 激活模块包化 | 仍内嵌 `src/data/auth-store.js`；需按第五章抽为 `@evbox/core-activation`，**并更换 `MASTER_CODE.code`** |
| 2 | 新工具开发 | 计算器 / 单位换算 / 随机数 / 便签 / 秒表 |
| 3 | 钉首页入口 | `pinned_pages` 机制已保留，但工具页缺「钉本页」按钮 |
| 4 | index.ux 死样式 | `.class-grid-*`、`.quick-add`、`.holiday-*` 等约 400 行未使用 CSS（不影响构建） |
| 5 | 闹钟决策 | 若做闹钟/定时提醒，需重新引入 `@system.resident`（仍不需要 interconnect） |
| 6 | 模板 tag | 未打 `v0.1.0-template`；git 已 init 但未提交 |
