# EvBox 工具箱

手环快应用工具箱，基于 **Ev 课程表（class-schedule）** 的核心架构重构而来。

- 包名：`com.application.watch.evbox`
- 应用名：EvBox工具箱
- 平台：`watch`（`minPlatformVersion 1050`）

## 一、已集成的工具

| 工具 | 页面 |
|------|------|
| 倒数日 | `pages/countdown-manage` |
| 农历 | `pages/lunar-calendar` |
| 计算器 | `pages/calculator` |
| 二维码生成 | `pages/qrcode-generator` |
| 震动自定义 | `pages/vibration-lab`、`pages/vibration-lab-v2` |
| 数据备份 | `pages/backup-restore` |
| 设备信息 | `pages/device-info` |
| 中文输入 | `pages/chinese-input` |
| 首页模板 | `pages/template-picker` |

首页入口宫格在 `src/pages/index/index.ux` 的 `TOOLS` 数组中维护，**新增工具只需追加一条**：

```js
var TOOLS = [
  { name: "倒数日", icon: "倒", uri: "/pages/countdown-manage" },
  // 新增：{ name: "计算器", icon: "计", uri: "/pages/calculator" }
]
```

新增页面后，记得在 `src/manifest.json` 的 `router.pages` 中注册。

### 倒数日（重点工具）

| 能力 | 说明 |
|------|------|
| 公历 / 农历双轨 | `src/lib/lunar.js` 离线换算（1900-2100），支持闰月；自动识别春节/中秋/端午/除夕等节日 |
| 重复规则 | 不重复 / 每周 / 每月 / 每年；**农历 + 每年 = 农历生日、节日自动顺延**（日期不存在时自动收敛，如腊月三十→廿九） |
| 钉首页大数字 | 列表每行「钉」即可置顶到首页 Hero 区，抬腕即见天数；首页开关在 `pages/homepage-settings` |
| 名称输入 | 走 `pages/chinese-input`（中文输入法），与"设置-昵称"同一条链路 |

- 数据层：`src/data/countdown.js`（storage key `countdownDays`，含旧数据自动迁移）
- 首页模块：`src/pages/index/modules/countdown-hero.js`（未钉时自动展示最近的一条）
- 编辑器为页内面板（公历/农历切换 + 年/月/日步进 + 重复规则），不再依赖系统弹窗输入日期

### 农历（`pages/lunar-calendar`）

三个视图，胶囊屏优先（设计见 `doc/新增工具设计-计算器与农历.md`）：

| 视图 | 内容 |
|------|------|
| 今日 | 农历月 36px + **农历日 48px** 大字、公历与星期、当日节日 chip、干支生肖、接下来 3 个节日（含剩余天数） |
| 本月 | 胶囊屏用**列表**（7 列网格每格仅 22px，低于可读底线）、圆屏/方屏用 7×6 网格（分帧挂载）；支持翻月、点某天跳「查日」 |
| 查日 | 年/月/日步进 + 公历↔农历切换 + 闰月 chip + 距今天数，可**一键存为倒数日**（农历默认每年重复） |

- 全部复用 `src/lib/lunar.js`（含干支/生肖/未来节日），不新增数据文件

### 计算器（`pages/calculator`）

- 键位 4×5（圆屏自动折成 5×4），键 40×52px（胶囊）/ 70×56px（方屏），每键**短震反馈**
- 大字号：结果 36-44px 自适应（越长越小，不低于 20px）、数字键 30-34px
- 内核抽为 `src/lib/calc.js`（纯函数、可单测）：不使用 `eval`、浮点收敛到 1e-10、除零/溢出安全
- 历史记录最近 20 条（storage `calc_history`），可点击回填；结果长按复制

### 首页工具区（三种显示模式）

设计规格见 `doc/胶囊屏首页美化设计-三模式.md`。模式切换行位于倒数日大数字与工具区之间：

| 模式 | 胶囊屏 | 说明 |
|------|--------|------|
| **图标模式**（默认） | **一行 2 列**（所有屏型都是 2 列） | PNG 图标：胶囊 **56 且不显示文字**（卡片 76×84）、方屏 56 + 名称 28px、圆屏 64 + 名称 30px |
| 列表模式 | 行 160×56 | 图标 28 + 名称 28px + › |
| 图文模式 | 卡片 160×72 | 图标 36 + 名称 26px + **实时摘要 22px** |

> 图标源为 **64×64** PNG（`tool_*` 共 14 张 / 23KB），显示尺寸永远 ≤ 源尺寸，避免放大发虚。

- 偏好存 `homepage_settings.toolViewMode`（`icon`/`list`/`rich`，缺省与非法值均落到 `icon`），首页设置页也可切换
- **`pages/tools` 工具页共用同一套三视图与同一个偏好**（切换任一侧，两侧同步）；胶囊屏图标模式同样 2 列
  - 工具页的切换按钮为**圆角矩形**（`border-radius: 10px`，高 46px，非椭圆）：选中=accent 实底 + 反色加粗文字，未选中=透明底 + `borderLight` 描边
  - 工具页只让 5 个工具参与切换（倒数日/农历/计算器/二维码/震动），「设备信息 / 设备ID诊断 / 已钉页面 / 黑屏检测」属于设置与诊断，固定列表展示在下方
- 图文摘要由 `src/pages/index/modules/tool-summaries.js` 统一供数（倒数日/农历/计算器/二维码/震动/备份/设备），**取不到就不渲染那一行**
- 工具入口在 `index.ux` 的 `TOOLS` 数组中维护，**每条必须带 `iconFile`**：

```js
var TOOLS = [
  { id: "countdown", name: "倒数日", iconFile: "tool_countdown.png", uri: "/pages/countdown-manage" },
  // 名称控制在 ≤3 字（胶囊屏 2 列卡片单行放得下）
]
```

### 图标体系（PNG 双图）

- 目录：`src/common/icons/tools/{dark,light}/`（首页工具）与 `src/common/icons/{dark,light}/`（导航类，32×32）
- 生成：`python3 _gen_lucide_icons.py`（全部）/ `--tools`（仅工具图标）/ `--offline`（只用本地缓存）
  - 形状 100% 来自 Lucide 官方 SVG，**禁止自绘 path**；脚本只做「替换 stroke 颜色 → `rsvg-convert` 光栅化」
  - 本机 Python urllib 有 SSL 证书问题，可先用 curl 抓 SVG 到 `.cache/lucide-svg/` 再 `--offline`
- 配色：`dark` = `#ffffff`（8 套暗色主题）、`light` = `#333333`（晨光白/暖阳米）
- ⚠️ 页面必须提供 `iconTheme`（默认 `"dark"`）+ `onInit/onShow` 刷新，否则路径会变成 `.../undefined/...`，图标显示成「!」

## 一、推送到 GitHub（本机网络说明）

本机 `github.com:443` 被墙（`api.github.com` 可达），且不使用 SSH，因此**不走 `git push`**，改用 `scripts/gh-api-push.js` 经 GitHub REST API 镜像推送：

```bash
npm run push:api                              # = node scripts/gh-api-push.js
node scripts/gh-api-push.js -m "feat: xxx"     # 指定提交信息
node scripts/gh-api-push.js --dry-run          # 只统计待推送文件，不联网写入
node scripts/gh-api-push.js --force            # 覆盖式推送（非快进）
```

- 脚本把 `git ls-files`（含未提交改动，`git add -A` 等价范围）走 Git Data API：blobs → tree → commit → 移动 `main`。
- 凭据用 `gh auth token`（keyring），无需 VPN / SSH / PAT 明文。
- `origin` 指向 `https://github.com/guomengtao/evbox.git`（仅用于解析 owner/repo；实际推送走 API）。
- ⚠️ 提交在服务端创建、本机无法 `git fetch`，故本地 `main` 与 `origin/main` 的 **commit SHA 不同但文件树完全一致**（`git diff` 为空）。以后统一 `npm run push:api`，本地无需再 `git commit` 同名改动。

## 二、核心架构（复用自课程表项目）

### 激活机制

- 主文件：`src/data/auth-store.js`（纯本地 storage，无网络依赖）
- 存储键：`auth_data` / `master_usage` / `used_codes` / `used_redeem` / `premium_unlocked`
- 状态：试用 7 天 → 期限版 / 永久版；含每日提醒、激活历史
- 判断高级功能：`store.isPremiumUnlocked(cb)`
- ⚠️ 复用新项目时**必须更换** `auth-store.js` 中的 `MASTER_CODE.code`，避免万能码跨应用通用

### 首页框架

- 模块开关：`homepage_settings`，字段见 `src/pages/homepage-settings/homepage-settings.ux`
  - `showTime` 时钟、`showPinnedBar` 钉首页栏
- 钉首页：`src/data/pin-helper.js` → storage key `pinned_pages`，结构 `[{ name, uri }]`
- 主题与字号：`src/data/store.js`（`getTheme` / `setBaseFontSize`）

### 数据层

- `src/data/store.js`：主题、字号、昵称、钉首页、首页设置、激活状态
- `src/data/storage-tables.js`：全部 storage key 清单（数据契约）
- `src/data/premium-overlay.js`：高级版遮罩控制

## 三、架构说明

本项目**已移除 interconnect 同步通道**（原用于手机插件 ↔ 手环数据交换，工具箱无此场景），
同时移除了 `@system.resident` 开机常驻（原为同步消息保活）。

> 若未来要做闹钟/定时提醒，需要重新引入 `@system.resident`（后台保活），
> 但**仍不需要** interconnect（那是跨端通信，与本地后台能力是两件事）。

数据备份/迁移能力保留：`pages/backup-restore` 使用**本地多快照**（storage key `backup_list`），
不需要任何网络或跨端通道。

## 四、开发

```bash
npm install

# 开发预览（需 AIoT IDE 环境）
npm start

# 构建（自动 bump 版本号）
npm run build

# 发布（启用 JSC 字节码 + 重命名渠道包）
npm run release

# 代码检查
npm run lint
```

构建产物：`.temp_evbox/dist/`（调试包）与 `dist/`（发布包）。

签名：`/sign` 目录需自行准备（已加入 `.gitignore`）。

## 五、版本控制

- 版本号来源：`src/manifest.json` 的 `versionName` / `versionCode`
- `scripts/bump-version.js` 会自动 patch+1 并同步生成 `src/data/version.js`
- 渠道号：`version.js` 的 `channel` 字段

## 六、目录结构

```
src/
├── app.ux                  # 应用入口（初始化激活/字号迁移）
├── manifest.json           # 包名、版本、features、router
├── components/             # 高级版卡片/遮罩/输入法/时钟
├── data/                   # 核心数据层（激活、存储、钉首页）
├── lib/                    # crypto 加密、qrcode 二维码
├── pages/                  # 18 个页面
│   ├── welcome/ index/     # 入口与首页（工具宫格 + 钉首页）
│   ├── tools/              # 工具列表
│   └── ...                 # 各工具页
└── utils/                  # 设备指纹
```
