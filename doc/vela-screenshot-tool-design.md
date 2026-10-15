# Vela 模拟器可靠批量截图命令行工具 — 方案设计

> 目标：一键启动 Vela 模拟器，自动遍历 manifest 中登记的所有页面并截图，输出到按项目/版本组织的目录。**稳定第一，速度第二。**

---

## 〇、基础设施：基于 velajs-mcp 协议

### 0.1 已有基础设施

项目已配置 `velajs-mcp`（见 `.vscode/mcp.json`），底层使用 `@aiot-toolkit/emulator` (v2.0.5)，提供一套完整的模拟器调试协议，**统一使用 Vela MCP JSON-RPC 协议代替原始 adb 命令**：

| MCP 命令 | 用途 | 取代原始方法 |
|----------|------|-------------|
| `list_devices` / `select_devices` | 设备选择与管理 | 代替 `adb devices` + 手动筛选 |
| `list_emulators` / `close_all_emulators` | 模拟器生命周期 | 代替 `aiot emulator start/stop` |
| `build_project` / `get_build_settings` | 构建 rpk | 代替 `npm run build`，可指定平台 |
| `start_debug_ide` / `stop_debug` | 启动/停止调试会话 | 代替 `adb install` + `am start` |
| **`navigate`** | **直接路由跳转** | **代替 adb shell input tap（模拟点击）** |
| `take_screenshot` | 截图 | 代替 `adb exec-out screencap` |
| `get_snapshot` / `get_element` | UI 结构快照 | 代替 `uiautomator dump` |
| `execute_script` | 在应用上下文执行 JS | 代替文件系统 push + 重启 |
| `get_storage` | 读取 storage 数据 | 代替 adb shell cat 文件 |
| `get_console_logs` | 获取控制台日志 | 代替 `adb logcat` |
| `get_emulator_logs` | 获取模拟器系统日志 | 代替 `adb logcat -s` |
| `get_device_log` | 获取设备运行日志 | 调试页面加载失败 |

> **核心优势**：`navigate` + `execute_script` + `take_screenshot` 三个命令构成零点击全自动截图链路，无需任何 `adb shell input tap/swipe` 模拟操作。

### 0.2 通信方式

CLI 工具通过 **MCP JSON-RPC 协议** 与 `velajs-mcp` server 通信：

```
┌────────────────────┐     JSON-RPC (stdio/http)     ┌──────────────────┐
│  scripts/           │ ◄──────────────────────────► │  velajs-mcp       │
│  screenshot.js     │                               │  (npx velajs-mcp) │
│  (MCP Client)       │                               │  (MCP Server)     │
└────────────────────┘                               └────────┬─────────┘
                                                               │
                                                    ┌──────────▼─────────┐
                                                    │ @aiot-toolkit/      │
                                                    │ emulator (v2.0.5)   │
                                                    │ + @miwt/adb          │
                                                    └─────────────────────┘
```

CLI 内部封装一个轻量 `VelaMCPClient`，对上层模块提供异步 API：

```javascript
// scripts/screenshot/vela-mcp-client.js — 核心封装
const { spawn } = require('child_process');

class VelaMCPClient {
  constructor() {
    this.requestId = 0;
    this.pending = new Map();
  }

  async start() {
    this.proc = spawn('npx', ['-y', 'velajs-mcp'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    // 监听 stdout 解析 JSON-RPC response
    // ...
  }

  async call(method, params = {}) {
    const id = ++this.requestId;
    const request = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    this.proc.stdin.write(request + '\n');
    // 等待并返回对应 id 的响应
    // ...
  }

  // 便捷方法
  async navigate(pagePath) {
    return this.call('navigate', { pagePath });
  }

  async takeScreenshot() {
    return this.call('take_screenshot', {}); // 返回 base64 或文件路径
  }

  async executeScript(code) {
    return this.call('execute_script', { code });
  }

  async getSnapshot() {
    return this.call('get_snapshot', {});
  }

  async getConsoleLogs() {
    return this.call('get_console_logs', {});
  }

  async close() {
    await this.call('stop_debug', {});
    this.proc.kill();
  }
}
```

---

## 一、背景与目标

### 1.1 为什么需要这个工具？

EvBox 快应用有 20+ 个页面，每次发布前需要逐页验证 UI 是否正常。手动操作模拟器截图极其低效：

- 要手动启动模拟器 → 安装 rpk → 逐页点击 → 手动截图 → 手动改名归类
- 某些页面（如设置、激活）需要前置数据注入才能正常显示
- 手环/手表模拟器屏幕小，黑屏、加载失败等问题难以批量排查

因此需要一个**可靠、稳定、批量自动化**的截图 CLI 工具。

### 1.2 核心设计原则

| 优先级 | 原则 | 说明 |
|--------|------|------|
| P0 | **稳定可靠** | 模拟器启动超时重试、页面加载等待、黑屏检测、异常恢复 |
| P0 | **完整性** | 覆盖 manifest 中所有 `pages`，不遗漏 |
| P1 | **可配置** | 设备型号、版本包路径、输出目录、指定页面均可参数化 |
| P1 | **结果可追溯** | 截图文件名包含页面标题 + 版本号 + 时间戳 |
| P2 | **速度快** | 不截图第二屏、零模拟点击、减少不必要等待 |

---

## 二、整体架构

```
┌──────────────────────────────────────────────────────────┐
│                   CLI 入口 (screenshot.js)                │
│   参数解析：--device, --version, --output, --pages       │
└────────────┬─────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────┐
│                   VelaMCPClient                          │
│   封装 velajs-mcp JSON-RPC 协议，提供统一异步 API        │
│   - navigate(), takeScreenshot(), executeScript(),       │
│   - getSnapshot(), getConsoleLogs(), close()             │
└────────────┬─────────────────────────────────────────────┘
             │
    ┌────────┴────────┬──────────────────┐
    │                 │                  │
┌───▼──────────┐ ┌───▼──────────┐ ┌─────▼────────────┐
│EmulatorMgr   │ │PageNavigator │ │ScreenshotEngine  │
│              │ │              │ │                  │
│ 模拟器生命   │ │ manifest解析 │ │ take_screenshot  │
│ 周期管理     │ │ navigate()   │ │ 黑屏/白屏检测    │
│ 启动/停止    │ │ executeScript│ │ 文件命名与保存   │
│ rpk安装      │ │ 数据注入     │ │ report.json      │
└──────────────┘ └──────────────┘ └──────────────────┘
```

---

## 三、命令行参数设计

```bash
node scripts/screenshot.js [options]
```

### 3.1 参数列表

| 参数 | 短参 | 类型 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--device` | `-d` | string | `10pro` | 目标设备型号：`9`, `10`, `10pro`, `10pro+` 等 |
| `--version` | `-v` | string | `latest` | rpk 版本号，`latest` 表示取 dist/ 下最新构建 |
| `--rpk` | `-r` | string | 自动查找 | 直接指定 .rpk 文件路径（优先级高于 --version） |
| `--output` | `-o` | string | `screenshots/` | 截图输出根目录 |
| `--pages` | `-p` | string | `all` | 指定页面：`all`, 页面 path 列表（逗号分隔），或 group 名 |
| `--group` | `-g` | string | 无 | 按 group 筛选，如 `实用工具` |
| `--retry` | | number | `2` | 单页截图失败重试次数 |
| `--timeout` | `-t` | number | `15000` | 页面加载超时（ms），navigate 后等待时间更短 |
| `--no-black-check` | | boolean | `false` | 跳过黑屏检测（加快速度，风险自负） |
| `--skip-second-screen` | | boolean | `true` | 跳过页面滚动/翻页后的第二屏截图 |
| `--skip-edit-pages` | | boolean | `false` | 跳过需要预置数据的编辑页（快速模式） |
| `--storage-data` | | string | `storage-data.json` | 预置 storage 数据文件路径 |
| `--verbose` | | boolean | `false` | 详细日志输出 |
| `--console-log` | | boolean | `false` | 每页截图后输出 console 日志（调试用） |

### 3.2 使用示例

```bash
# 默认：10pro 模拟器，最新版本，截所有页面
node scripts/screenshot.js

# 指定设备为 9
node scripts/screenshot.js --device 9

# 指定版本 + 只截"实用工具"分组
node scripts/screenshot.js -v 1.0.22 -g 实用工具

# 指定 rpk 文件 + 自定义输出目录
node scripts/screenshot.js --rpk ./dist/evbox-1.0.22.rpk -o ./release-screenshots/

# 只截指定页面（用于快速验证）
node scripts/screenshot.js -p pages/index,pages/tools,pages/calculator

# 快速模式：跳过黑屏检测 + 跳过第二屏 + 跳过编辑页
node scripts/screenshot.js --no-black-check --skip-second-screen --skip-edit-pages

# 自定义 storage 预置数据
node scripts/screenshot.js --storage-data ./test-data/storage-auth.json
```

---

## 四、核心模块设计

### 4.1 EmulatorManager — 模拟器管理

#### 职责

- 启动/停止 Vela 模拟器（通过 `velajs-mcp` 的 `list_emulators` / `close_all_emulators`）
- 选择目标设备型号
- 构建并安装 rpk 包
- 启动调试会话

#### 启动流程（全部通过 MCP 协议）

```
1. close_all_emulators        → 确保干净环境，关闭所有已有模拟器实例
   （可选：如果已有目标设备在运行 → 复用，跳过启动）

2. select_devices({ device: '10pro' })
   → 选择目标设备型号

3. build_project({ settings: 'release' })
   → 构建 rpk（如果未指定 --rpk）

4. start_debug_ide()
   → 启动调试会话（自动安装 rpk + 启动应用）
   → 等待会话就绪（轮询 get_debug_status 或 get_snapshot）

5. get_snapshot()
   → 确认首页已渲染，提取页面根节点存在
```

#### 就绪状态检测

```javascript
// 基于 MCP 的启动就绪检测
async function waitForAppReady(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snapshot = await mcpClient.getSnapshot();
    if (snapshot && snapshot.children && snapshot.children.length > 0) {
      // 二次确认：等 1.5s 再查一次
      await sleep(1500);
      const snapshot2 = await mcpClient.getSnapshot();
      if (snapshot2 && snapshot2.children && snapshot2.children.length > 0) {
        return true;
      }
    }
    await sleep(1000);
  }
  return false;
}
```

#### 失败处理

| 场景 | 策略 |
|------|------|
| 模拟器启动超时 | `close_all_emulators` → 等待 3s → 重试，最多 3 次 |
| rpk 安装失败 | `stop_debug` → `close_all_emulators` → 重新 `start_debug_ide` |
| 应用启动/首页渲染失败 | 通过 `get_emulator_logs` 检查系统日志 → 冷启动重试 |
| 连续 3 页截图黑屏 | 判定模拟器异常 → `stop_debug` → `close_all_emulators` → 从断点继续 |

---

### 4.2 PageNavigator — 页面导航

#### 职责

- 读取并解析 `manifest.json` 中的 `router.pages`
- 按 group 分组，确定截图顺序
- **通过 `navigate` 命令直接跳转页面（零点击）**
- 为编辑/设置类页面通过 `execute_script` 注入预置 storage 数据

#### manifest 解析

从 `manifest.json` 的 `router.pages` 提取页面清单：

```javascript
// manifest.json 中每个页面均标注了 group 和 name_cn
{
  "router": {
    "entry": "pages/index",
    "pages": {
      "pages/welcome": {
        "component": "welcome",
        "group": "核心主流程",
        "name_cn": "欢迎页"
      },
      "pages/index": {
        "component": "index",
        "group": "核心主流程",
        "name_cn": "首页"
      },
      "pages/activation": {
        "component": "activation",
        "group": "设置与系统",
        "name_cn": "激活"
      }
      // ... 更多页面
    }
  }
}
```

提取结果为：

```javascript
[
  { path: 'pages/welcome', component: 'welcome', group: '核心主流程', name_cn: '欢迎页' },
  { path: 'pages/index',    component: 'index',    group: '核心主流程', name_cn: '首页' },
  { path: 'pages/calculator', component: 'calculator', group: '实用工具', name_cn: '计算器' },
  { path: 'pages/activation',  component: 'activation',  group: '设置与系统', name_cn: '激活',
    requiresPreset: true,
    preset: { auth_data: { isActivated: true, isPermanent: true } }
  },
  // ...
]
```

#### 页面导航方式：直接路由跳转（核心设计）

使用 `velajs-mcp` 的 **`navigate`** 命令直接跳转页面路由，**完全不需要模拟点击**：

```javascript
// PageNavigator.navigateTo(pagePath)
async navigateTo(pagePath) {
  // 方式一：直接调用 navigate（MCP 原生支持）
  await mcpClient.navigate(pagePath);

  // 方式二（备选）：通过 execute_script 调用快应用 router.push
  // await mcpClient.executeScript(`
  //   router.push({ uri: '${pagePath}' });
  // `);
}
```

> **为什么 `navigate` 比模拟点击好？**
>
> | 对比维度 | navigate（MCP） | adb shell input tap |
> |----------|----------------|---------------------|
> | 稳定性 | 直接路由跳转，不受 UI 变化影响 | 依赖坐标，分辨率变化即失效 |
> | 速度 | 一次 RPC 调用，< 100ms | 需要计算坐标 + tap + 等待过渡动画 |
> | 可靠性 | 路由级跳转，必定到达目标页 | 可能点错、点歪、点击穿透 |
> | 维护成本 | 无需维护坐标表 | 每次 UI 改版都要重新适配坐标 |

#### 编辑页预置数据处理（通过 execute_script）

部分页面（如 `activation` 激活页、`settings` 设置页）依赖 storage 中的预置数据才能正常显示。使用 `execute_script` 在应用上下文直接写入 storage，**无需重启应用**：

```javascript
// scripts/screenshot/page-presets.js
const PAGE_PRESETS = {
  'pages/activation': {
    script: `
      const storage = require('@app-module/system.storage');
      storage.set({
        key: 'auth_data',
        value: JSON.stringify({
          installTime: Date.now(),
          isActivated: true,
          isPermanent: true,
          expireAt: null,
          activatedAt: Date.now(),
          trialDays: 7,
          productId: '0001',
          history: []
        }),
        success: function() { console.log('[screenshot] auth_data preset OK'); },
        fail: function() { console.error('[screenshot] auth_data preset FAIL'); }
      });
    `
  },
  'pages/backup-restore': {
    script: `
      const storage = require('@app-module/system.storage');
      storage.set({
        key: 'allCourses',
        value: JSON.stringify([{ name: '数学', room: '101', teacher: '张老师', day: 1, start: 1, duration: 2 }])
      });
      storage.set({
        key: 'scheduleNames',
        value: JSON.stringify(['默认课表'])
      });
      storage.set({
        key: 'currentScheduleIndex',
        value: '0'
      });
    `
  },
  'pages/homepage-settings': {
    script: `
      const storage = require('@app-module/system.storage');
      storage.set({
        key: 'homepage_settings',
        value: JSON.stringify({
          showCountdown: true,
          showCalculator: true,
          showQuote: true,
          showLunar: true
        })
      });
    `
  },
  'pages/pinned-pages': {
    script: `
      const storage = require('@app-module/system.storage');
      storage.set({
        key: 'pinned_pages',
        value: JSON.stringify([
          { name: '计算器', uri: 'pages/calculator' },
          { name: '倒数日', uri: 'pages/countdown-manage' },
          { name: '二维码', uri: 'pages/qrcode-generator' }
        ])
      });
    `
  }
};
```

注入流程（完全在应用运行时，无需重启）：

```
1. mcpClient.executeScript(preset.script)
   → 在应用 JS 上下文中直接写入 storage 数据

2. await sleep(500)
   → 等待 storage 回调执行完毕

3. mcpClient.navigate(targetPagePath)
   → 导航到目标页面

4. await waitForPageStable()
   → 等待页面渲染稳定

5. mcpClient.takeScreenshot()
   → 截图
```

---

### 4.3 ScreenshotEngine — 截图引擎

#### 职责

- 执行屏幕截图（通过 `take_screenshot`）
- 黑屏/白屏检测
- 文件命名与保存

#### 截图流程（全 MCP 路径）

```
1. 等待页面渲染稳定
   使用 get_snapshot() 轮询，连续 2 次结果一致 → 判定稳定
   超时阈值：--timeout（默认 15s）

2. 执行截图
   mcpClient.takeScreenshot() → 返回 base64 编码的 PNG 数据

3. 将 base64 解码并写入临时文件
   Buffer.from(base64, 'base64') → fs.writeFile(tempPath)

4. 黑屏检测（见 4.4 节）

5. 若检测失败 → 等待 2s → 重试（最多 --retry 次）
   最后一次重试前先 navigate 到首页再跳回来（解决某些页面假死问题）

6. 文件命名与保存
   路径：{output}/{device}/{version}/{group}/{name_cn}_{version}_{timestamp}.png
   示例：screenshots/10pro/1.0.22/实用工具/计算器_1.0.22_20261005T103000.png

7. 可选：获取 console 日志保存到同名 .log 文件
   --console-log 时执行 get_console_logs()
```

#### 页面稳定检测（基于 get_snapshot）

```javascript
async function waitForPageStable(maxWaitMs = 15000) {
  const start = Date.now();
  let lastXml = null;
  let stableCount = 0;

  while (Date.now() - start < maxWaitMs) {
    const snapshot = await mcpClient.getSnapshot();
    if (!snapshot) { await sleep(500); continue; }

    const currentXml = JSON.stringify(snapshot);

    if (currentXml === lastXml) {
      stableCount++;
      if (stableCount >= 2) return true; // 连续 2 次一致 = 稳定
    } else {
      stableCount = 0;
      lastXml = currentXml;
    }
    await sleep(500);
  }
  return false; // 超时
}
```

---

### 4.4 BlackScreenDetector — 黑屏检测

#### 检测策略

对截图进行像素级分析，判断是否为黑屏/白屏/异常屏幕。

| 检测类型 | 判定标准 | 说明 |
|----------|----------|------|
| **纯黑屏** | 95%+ 像素 RGB 值 < 30 | 页面未加载、渲染失败 |
| **纯白屏** | 95%+ 像素 RGB 值 > 735 | JS 崩溃白屏、空页面 |
| **低信息屏** | 90%+ 像素为同一颜色 | 可能是启动页/过渡态，标记为 SUSPICIOUS |
| **正常屏** | 像素分布有足够方差 | 正常页面，接受截图 |

#### 实现（使用 pngjs，零原生依赖）

```javascript
const { PNG } = require('pngjs');
const fs = require('fs');

async function detectBlackScreen(imagePath) {
  const png = PNG.sync.read(fs.readFileSync(imagePath));
  const { width, height, data } = png;

  const totalPixels = width * height;
  let blackPixels = 0;
  let whitePixels = 0;
  const colorBuckets = new Map();

  // 采样检测：每 4 像素取 1 个（手表截图 ~454x454 ≈ 206K 像素，采样后 ≈ 51K）
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = r + g + b;

    if (brightness < 30) blackPixels++;
    if (brightness > 735) whitePixels++;

    const bucket = `${Math.floor(r / 32)}_${Math.floor(g / 32)}_${Math.floor(b / 32)}`;
    colorBuckets.set(bucket, (colorBuckets.get(bucket) || 0) + 1);
  }

  const sampledPixels = Math.floor(totalPixels / 4);
  const blackRatio = blackPixels / sampledPixels;
  const whiteRatio = whitePixels / sampledPixels;

  let maxBucketCount = 0;
  for (const count of colorBuckets.values()) {
    if (count > maxBucketCount) maxBucketCount = count;
  }
  const dominantRatio = maxBucketCount / sampledPixels;

  if (blackRatio > 0.95) return { status: 'BLACK', blackRatio };
  if (whiteRatio > 0.95) return { status: 'WHITE', whiteRatio };
  if (dominantRatio > 0.90) return { status: 'SUSPICIOUS', blackRatio, whiteRatio, dominantRatio };
  return { status: 'OK', blackRatio, whiteRatio, dominantRatio };
}
```

> **建议默认使用 `pngjs`**（零原生依赖，稳定可靠）。`sharp` 更快但需要编译原生模块，作为可选升级。

---

## 五、输出目录结构

```
screenshots/
├── 10pro/
│   ├── 1.0.22/
│   │   ├── 核心主流程/
│   │   │   ├── 欢迎页_1.0.22_20261005T103000.png
│   │   │   ├── 首页_1.0.22_20261005T103002.png
│   │   │   └── 工具_1.0.22_20261005T103004.png
│   │   ├── 实用工具/
│   │   │   ├── 计算器_1.0.22_20261005T103006.png
│   │   │   ├── 农历_1.0.22_20261005T103008.png
│   │   │   ├── 倒数日管理_1.0.22_20261005T103010.png
│   │   │   └── ...
│   │   ├── 设置与系统/
│   │   │   ├── 设置_1.0.22_20261005T103020.png
│   │   │   └── ...
│   │   └── report.json          # 截图汇总报告
│   └── 1.0.23/
│       └── ...
├── 9/
│   └── 1.0.22/
│       └── ...
└── latest -> 10pro/1.0.22/      # 软链指向最新一次截图
```

### report.json 格式

```json
{
  "tool": "vela-screenshot",
  "timestamp": "2026-10-05T10:30:00.000Z",
  "device": "10pro",
  "version": "1.0.22",
  "totalPages": 22,
  "successCount": 20,
  "failedCount": 2,
  "skippedCount": 0,
  "blackScreenCount": 1,
  "results": [
    {
      "page": "pages/welcome",
      "name_cn": "欢迎页",
      "group": "核心主流程",
      "status": "OK",
      "file": "核心主流程/欢迎页_1.0.22_20261005T103000.png",
      "duration_ms": 2200,
      "retries": 0
    },
    {
      "page": "pages/activation",
      "name_cn": "激活",
      "group": "设置与系统",
      "status": "BLACK",
      "file": "设置与系统/激活_1.0.22_FAILED_20261005T103030.png",
      "duration_ms": 25000,
      "retries": 3,
      "error": "Black screen detected after 3 retries"
    }
  ]
}
```

---

## 六、稳定性保障措施

### 6.1 启动阶段

```
1. close_all_emulators → 确保干净环境
2. select_devices → 选择目标设备
3. build_project 或检查 rpk 是否存在
4. start_debug_ide → 启动调试会话
   超时 120s → close_all_emulators → 重试（最多 3 次）
5. waitForAppReady → 轮询 get_snapshot 确认首页渲染
```

### 6.2 截图阶段

```
1. 每页截图前：mcpClient 心跳检测（ping 或 get_debug_status）
   通信失败 → 尝试重连 velajs-mcp server → 失败则标记后续页面 FAILED
2. navigate + waitForPageStable（超时 --timeout ms）
3. take_screenshot + 黑屏检测
4. 黑屏 → 等 1.5s → 重试 navigate + 截图（最多 --retry 次）
   重试前先 navigate 回首页再跳回来（解决缓存问题）
5. 连续 3 页黑屏 → 判定模拟器整体异常
   → stop_debug → close_all_emulators → 重启 → 断点续传
```

### 6.3 异常恢复

```
process.on('SIGINT',  cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', async (err) => {
  console.error('Fatal:', err.message);
  await cleanup();
  process.exit(1);
});

async function cleanup() {
  console.log('\nCleaning up...');
  try { await mcpClient.call('stop_debug', {}); } catch (_) {}
  try { await mcpClient.call('close_all_emulators', {}); } catch (_) {}
  try { mcpClient.proc.kill(); } catch (_) {}
  console.log('Emulator closed.');
}
```

---

## 七、速度优化策略

| 优化项 | 说明 | 核心手段 |
|--------|------|----------|
| **零模拟点击** | 全程 `navigate` 路由跳转，无 `input tap/swipe` | `navigate` MCP 命令 |
| **无重启注入** | `execute_script` 在线写入 storage，无需重启 | `execute_script` MCP 命令 |
| **跳过第二屏** | 默认 `--skip-second-screen`，不截滚动后内容 | 节省 50% 时间 |
| **黑屏检测采样** | 每 4 像素取 1 个，不是逐像素 | 检测 < 150ms |
| **页面稳定检测优化** | `get_snapshot` 间隔 500ms，连续 2 次一致即通过 | 平均等待 1-2s |
| **启动复用** | 同一批次截图复用同一个调试会话 | 节省 30-60s 启动时间 |
| **串行执行** | 默认串行保证稳定性，不做并行截图 | 稳定第一 |

### 页面截图循环伪代码

```javascript
async function runScreenshotLoop(pages) {
  const results = [];

  for (const page of pages) {
    const start = Date.now();
    let retries = 0;
    let status = 'OK';

    // 1. 若需要预置数据，先注入
    if (page.requiresPreset && page.preset) {
      await mcpClient.executeScript(page.preset.script);
      await sleep(500);
    }

    // 2. 导航到目标页
    await mcpClient.navigate(page.path);

    // 3. 等待页面稳定
    const stable = await waitForPageStable(timeout);
    if (!stable) {
      status = 'TIMEOUT';
      results.push({ page: page.path, name_cn: page.name_cn, status, duration_ms: Date.now() - start, retries });
      continue;
    }

    // 4. 截图 + 黑屏检测
    for (retries = 0; retries <= maxRetries; retries++) {
      const { base64 } = await mcpClient.takeScreenshot();
      const buf = Buffer.from(base64, 'base64');
      const tmpPath = path.join(tmpDir, `${page.component}.png`);
      fs.writeFileSync(tmpPath, buf);

      const blackResult = await detectBlackScreen(tmpPath);
      if (blackResult.status === 'OK') {
        // 成功：移动到正式目录
        const destPath = buildDestPath(page, version);
        fs.renameSync(tmpPath, destPath);
        break;
      }

      // 黑屏：等 1.5s 重试
      await sleep(1500);
      // 最后一次重试前 navigate 回首页再回来
      if (retries === maxRetries) {
        await mcpClient.navigate('pages/index');
        await sleep(1000);
        await mcpClient.navigate(page.path);
        await sleep(2000);
      }
    }

    if (retries > maxRetries) {
      status = 'BLACK';
      // 保留失败截图供人工审查
      const failPath = buildDestPath(page, version, '_FAILED');
      fs.renameSync(tmpPath, failPath);
    }

    results.push({
      page: page.path,
      name_cn: page.name_cn,
      group: page.group,
      status,
      file: path.relative(outputRoot, status === 'OK' ? destPath : failPath),
      duration_ms: Date.now() - start,
      retries
    });
  }

  return results;
}
```

---

## 八、文件结构

```
scripts/
├── screenshot.js                 # CLI 入口，参数解析，流程编排
├── screenshot/
│   ├── vela-mcp-client.js        # ★ VelaMCPClient 封装（JSON-RPC 通信）
│   ├── EmulatorManager.js        # 模拟器生命周期管理（基于 MCP）
│   ├── PageNavigator.js          # manifest 解析 + navigate 跳转
│   ├── ScreenshotEngine.js       # take_screenshot + 文件保存
│   ├── BlackScreenDetector.js    # 黑屏/白屏/异常屏检测（pngjs）
│   ├── page-presets.js           # ★ 编辑页预置脚本注册表
│   ├── ReportGenerator.js        # report.json 生成
│   └── utils.js                  # sleep, retry, log 等公共工具
```

---

## 九、依赖

### 运行时依赖

| 依赖 | 用途 | 安装方式 |
|------|------|----------|
| `velajs-mcp` | Vela 模拟器调试协议（MCP Server） | `npx -y velajs-mcp`（按需启动） |
| `pngjs` | PNG 像素解析（黑屏检测） | `npm install pngjs` |

### Node.js 标准库

- `child_process` — 启动/管理 `npx velajs-mcp` 子进程
- `fs` / `fs/promises` — 文件读写、目录创建
- `path` — 路径处理
- `readline` — 逐行读取 MCP server stdout（JSON-RPC 响应）

> **设计目标：最少第三方依赖。** 只有 `pngjs` 一个 npm 依赖 + 一个按需 npx 的 `velajs-mcp`。

---

## 十、使用流程（完整示例）

```bash
# 1. 确认环境（velajs-mcp 通过 npx 自动拉取）
npx -y velajs-mcp --version

# 2. 先构建一个版本
npm run release
# → dist/evbox-1.0.22.rpk

# 3. 执行截图（默认：10pro，最新版，全部页面）
node scripts/screenshot.js

# 输出示例：
# [EmulatorManager] Starting emulator (10pro)...
# [EmulatorManager] Emulator ready. (18.2s)
# [PageNavigator] Loaded 22 pages from manifest.json
# [PageNavigator] Groups: 核心主流程(3), 实用工具(9), 设置与系统(8), 实验室工具(2), 其他(1)
# [Screenshot] [1/22] pages/welcome (欢迎页) ... OK  (2.1s)
# [Screenshot] [2/22] pages/index (首页)     ... OK  (1.8s)
# [Screenshot] [3/22] pages/tools (工具)     ... OK  (2.3s)
# ...
# [Screenshot] [22/22] pages/donate (打赏支持) ... OK  (1.9s)
# [Report] 20/22 OK, 2 FAILED, 0 SKIPPED
# [Report] saved to screenshots/10pro/1.0.22/report.json

# 4. 快速重截某个分组
node scripts/screenshot.js -g 实用工具

# 5. 快速重截某几个页面
node scripts/screenshot.js -p pages/calculator,pages/lunar-calendar

# 6. 对比两个版本的截图
diff screenshots/10pro/1.0.21/ screenshots/10pro/1.0.22/
```

---

## 十一、开发计划

| 阶段 | 内容 | 关键技术点 | 预计产出 |
|------|------|-----------|----------|
| **Phase 1** | VelaMCPClient 封装 | JSON-RPC 通信、子进程管理 | 能成功调用 `navigate` / `take_screenshot` |
| **Phase 2** | EmulatorManager | `close_all_emulators` / `select_devices` / `start_debug_ide` | 模拟器一键启动 |
| **Phase 3** | PageNavigator | manifest 解析 + `navigate` | 自动遍历所有页面 |
| **Phase 4** | ScreenshotEngine | `take_screenshot` + 文件命名保存 | 截图落地到规范目录 |
| **Phase 5** | BlackScreenDetector | pngjs 像素分析 | 黑屏自动检测 + 重试 |
| **Phase 6** | page-presets | `execute_script` 自动注入 storage | 编辑页正常截图 |
| **Phase 7** | CLI 完善 + report.json | 参数解析、进度展示、汇总报告 | 完整命令行体验 |
| **Phase 8** | 全量测试 | 22 个页面全量截图 + 异常恢复 | 稳定跑通 |

---

## 十二、多态截图支持（Multi-State Screenshot）

### 12.1 设计动机

同一个页面在不同数据/配置状态下，UI 可能截然不同：

| 页面 | 状态 A | 状态 B | 状态 C |
|------|--------|--------|--------|
| `homepage-settings`（首页设置） | 全部开关关闭（空状态） | 全部开关打开（满状态） | — |
| `backup-restore`（备份恢复） | 无数据可备份 | 有大量课程数据 | — |
| `pinned-pages`（已钉页面） | 无钉选页面（空列表） | 多个钉选页面 | — |
| `countdown-manage`（倒数日） | 无倒数日 | 有 3 个倒数日 | 有 10 个跨年倒数日 |
| 所有页面 × 模板 | `blue` 深空蓝 | `dark` 暗夜黑 | `purple` 暗紫魅影 |
| 所有页面 × 模板 | `green` 翡翠绿 | `red` 珊瑚红 | `gray` 深空灰 |
| 所有页面 × 模板 | `light` 晨光白 | `warm` 暖阳米 | `forest` 墨绿护眼 |

**核心**：只要定义了不同 state 对应的 storage 预设，多态截图就是同一个循环跑 N 遍。

### 12.2 页面 × 状态矩阵

```javascript
// 每个页面可定义多个 state，每个 state 有独立的 storage 预设
const PAGE_STATES = {
  'pages/homepage-settings': {
    states: {
      '空状态': {
        script: `
          const s = require('@app-module/system.storage');
          s.set({ key: 'homepage_settings', value: JSON.stringify({
            showCountdown: false, showCalculator: false,
            showQuote: false, showLunar: false, showQuickAdd: false
          }) });
        `
      },
      '满状态': {
        script: `
          const s = require('@app-module/system.storage');
          s.set({ key: 'homepage_settings', value: JSON.stringify({
            showCountdown: true, showCalculator: true,
            showQuote: true, showLunar: true, showQuickAdd: true
          }) });
        `
      }
    }
  },
  'pages/backup-restore': {
    states: {
      '无数据': {
        script: `
          const s = require('@app-module/system.storage');
          s.set({ key: 'allCourses', value: '[]' });
          s.set({ key: 'scheduleNames', value: '[]' });
        `
      },
      '有数据': {
        script: `
          const s = require('@app-module/system.storage');
          s.set({ key: 'allCourses', value: JSON.stringify([...]) });
          s.set({ key: 'scheduleNames', value: JSON.stringify(['语文课表','数学课表']) });
        `
      }
    }
  },
  'pages/pinned-pages': {
    states: {
      '空列表': { script: "require('@app-module/system.storage').set({key:'pinned_pages',value:'[]'})" },
      '有钉选': {
        script: `
          require('@app-module/system.storage').set({
            key: 'pinned_pages',
            value: JSON.stringify([
              {name:'计算器',uri:'pages/calculator'},
              {name:'倒数日',uri:'pages/countdown-manage'},
              {name:'二维码',uri:'pages/qrcode-generator'}
            ])
          });
        `
      }
    }
  }
};
```

### 12.3 全局模板/主题状态（Theme Matrix）

项目有 **9 种配色主题** + `homepage_template` 模板：

| 主题 key | 中文名 | 色调风格 |
|----------|--------|----------|
| `blue` | 深空蓝 | 默认主题，深蓝底色 |
| `green` | 翡翠绿 | 深绿底色 |
| `red` | 珊瑚红 | 深红底色 |
| `dark` | 暗夜黑 | 纯黑底色 |
| `gray` | 深空灰 | 深灰底色 |
| `purple` | 暗紫魅影 | 深紫底色 |
| `light` | 晨光白 | 白底日间模式 |
| `warm` | 暖阳米 | 米白暖色调 |
| `forest` | 墨绿护眼 | 护眼深绿 |

这些主题通过 storage key `appTheme` 控制，切换后所有页面的 `bg`、`card`、`accent`、`text` 等色值全局变化，因此需要为**关键页面**（至少首页、工具页、设置页）在每种主题下截图。

```javascript
// 全局主题注入脚本
function themeScript(themeKey) {
  return `
    const s = require('@app-module/system.storage');
    s.set({ key: 'appTheme', value: '${themeKey}' });
  `;
}
```

### 12.4 --states 参数设计

```bash
# 默认：单状态截图（仅 baseline / 空白状态）
node scripts/screenshot.js

# 指定预定义状态组合
node scripts/screenshot.js --states data        # 仅数据态：空/满
node scripts/screenshot.js --states theme       # 仅主题态：9 个 theme 轮换
node scripts/screenshot.js --states data,theme  # 数据态 + 主题态 全矩阵
node scripts/screenshot.js --states all         # 全部状态组合

# 指定某个页面按指定主题截图
node scripts/screenshot.js --states theme --theme-filter blue,dark,purple

# 通过外部文件自定义状态
node scripts/screenshot.js --states-file ./screenshot-states.json
```

### 12.5 输出目录结构（含多态）

有 `--states` 时，输出增加一级 state 目录：

```
screenshots/
├── 10pro/1.0.22/
│   ├── baseline/                    # 默认单态（无 --states 时）
│   │   ├── 核心主流程/
│   │   │   ├── 欢迎页_1.0.22_20261005T103000.png
│   │   │   └── ...
│   │   └── report.json
│   ├── data_state/                  # --states data
│   │   ├── 空状态/
│   │   │   ├── 设置与系统/
│   │   │   │   ├── 首页设置_空状态_1.0.22.png
│   │   │   │   └── 备份恢复_空状态_1.0.22.png
│   │   │   └── ...
│   │   ├── 满状态/
│   │   │   └── ...
│   │   └── report.json
│   └── theme_state/                 # --states theme
│       ├── blue_深空蓝/
│       │   ├── 核心主流程/
│       │   │   ├── 首页_blue_1.0.22.png
│       │   │   └── ...
│       │   └── ...
│       ├── dark_暗夜黑/
│       ├── light_晨光白/
│       ├── purple_暗紫魅影/
│       │   ... (共 9 个主题)
│       └── report.json
```

文件命名规则：`{name_cn}_{state_name}_{version}_{timestamp}.png`

### 12.6 多态截图性能估算

| 模式 | 页数 | 状态数 | 总截图 | 预估耗时 |
|------|------|--------|--------|----------|
| 默认（baseline） | 22 | 1 | 22 | ~60s |
| 数据态 | 4 个有意义的页面 × 2 态 | — | +8 | ~20s |
| 主题态（全 9 主题 × 3 关键页） | 3 | 9 | 27 | ~80s |
| 主题态（全 9 主题 × 全 22 页） | 22 | 9 | 198 | ~10min |
| 全组合（3 关键页 × 2 数据态 × 9 主题） | 3 | 18 | 54 | ~3min |

> **建议**：日常迭代用 baseline（60s），发版前跑 `--states data,theme --theme-filter blue,dark,light,purple`（约 80 张，3min）。全量全主题组合（198 张）仅在大版本发布前手动执行。

### 12.7 实现要点

由于 `execute_script` 可以在**同一个调试会话内热切换** storage 数据，多态截图只需在原循环外再套一层 state 循环：

```javascript
// 外层：state 循环
for (const stateGroup of stateGroups) {
  console.log(`\n[State] ${stateGroup.name}`);

  // 内层：page 循环（与原逻辑完全相同）
  for (const page of pages) {
    // 1. 注入该 state 的 storage 预设
    const script = getStateScript(page.path, stateGroup);
    if (script) await mcpClient.executeScript(script);

    // 2. navigate + wait + screenshot（与原逻辑一致）
    await mcpClient.navigate(page.path);
    await waitForPageStable(timeout);
    const { base64 } = await mcpClient.takeScreenshot();
    // ...

    // 3. 文件命名附带 state 名称
    saveScreenshot(base64, { page, state: stateGroup.key, version });
  }
}
```

无需重启模拟器，无需重新安装 rpk。一个 `start_debug_ide` 会话从头跑到尾。

---

## 十三、关键设计决策对比

| 决策点 | 传统方案（adb） | 本方案（MCP） | 优势 |
|--------|----------------|--------------|------|
| 页面跳转 | `adb shell input tap x y` | `navigate(pagePath)` | 零坐标、零点击、路由级跳转 |
| 截图 | `adb exec-out screencap -p` | `take_screenshot()` | 无需解析 raw 流，直接拿 base64 |
| UI 检测 | `uiautomator dump` | `get_snapshot()` | 结构化 JSON，无需解析 XML |
| 数据注入 | `adb push` 文件 + 重启应用 | `execute_script()` | 在线写入，无需重启 |
| 日志 | `adb logcat` | `get_console_logs()` | 仅应用日志，无需 grep 过滤 |
| 设备管理 | `adb devices` + `aiot emulator start` | `list_emulators` + `select_devices` | 统一协议，类型安全 |

---

## 十四、潜在风险与对策

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| `velajs-mcp` 某些命令不稳定 | 中 | 高 | 每个 MCP 调用加超时 + 重试；关键路径保留 adb 回退 |
| `navigate` 不适用于某些非路由页面 | 低 | 中 | 对无路由页面标记 `navigable: false`，跳过或通过首页跳转 |
| `execute_script` 注入后页面未刷新 | 低 | 中 | 注入后 `navigate` 到首页再跳回目标页，强制重新渲染 |
| `take_screenshot` 返回数据过大 | 低 | 低 | 表盘截图 ~454x454，PNG < 100KB，不成问题 |
| MCP server 进程意外退出 | 中 | 高 | 主进程监控子进程 exit 事件，自动重启 server + 恢复截图进度 |