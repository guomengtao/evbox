# BandBBS 社区集成方案

> 在 app-auth 后台中新增 BandBBS 社区运营模块，支持评论收集、模拟登录、私信发送三大功能。
> 基于已验证的 `curl`/`urllib` 抓取方案，无需 Puppeteer/Playwright 等重型依赖。

---

## 1. 总体架构

```
┌──────────────────────────────────────────────────────────────┐
│                    Vercel Serverless                          │
│                                                              │
│  vercel.json crons:                                          │
│    "0 */2 * * *"  → /api/admin/catalog?kind=bandbbs&op=poll │
│                                                              │
│  api/admin/catalog.js  (dispatcher)                          │
│    └── kind=bandbbs → lib/bandbbs.js                         │
│                                                              │
│  lib/bandbbs.js  (core logic)                                │
│    ├── pollReviews()    收集评论 (定时)                       │
│    ├── sendDm()         发送私信 (手动)                       │
│    ├── login()          模拟登录                              │
│    └── getStats()       统计面板                              │
│                                                              │
│  admin_Dx23.html  (前端面板)                                  │
│    └── panel-bandbbs   社区运营面板                           │
└──────────────────────────────────────────────────────────────┘
```

**数据流**：
```
[Vercel Cron 每2小时]
      │
      ▼
/api/admin/catalog?kind=bandbbs&op=poll&cron=1
      │
      ▼
lib/bandbbs.js → 模拟登录 → 抓取评论 → 存入 Redis
      │
      ▼
admin_Dx23.html 面板 ← GET /api/admin/catalog?kind=bandbbs&op=stats
```

---

## 2. 三大功能模块

### 2.1 模块一：评论收集 (pollReviews)

**目标**：定期抓取 BandBBS 指定资源帖的用户评分和评论内容。

**实现方式**（已验证，纯 `curl`/`urllib`，无需 headless browser）：

```python
# 核心逻辑（Python 版本，已验证稳定）
# 1. 无需登录即可抓取评论页（public）
# 2. 解析 HTML 提取用户名、评分、内容、时间
# 3. 写入 Redis 供后台面板展示

# 抓取 URL
url = "https://www.bandbbs.cn/resources/{resource_id}/reviews"

# CSS 选择器模式（正则提取）
# 评分:  data-rating="N" 或 <span class="rating">中的数字
# 用户:  <a class="username" ...>
# 内容:  <article class="message-body"> 中的文本
# 时间:  <time datetime="ISO格式">
```

**关键点**：
- 评论页是**公开的**，无需登录即可抓取
- 只需要设置正确的 `User-Agent` 头
- SSL 证书验证需跳过（自签证书）

**存储结构**（Redis）：

```
bandbbs:reviews:{resource_id}          HASH
  field: "{user_id}"   →   JSON
  {
    "username": "...",
    "rating": 4,
    "star": "★★★★☆",
    "content": "...",
    "time": "2026-01-01T00:00:00",
    "fetched_at": "2026-01-01T12:00:00"
  }

bandbbs:reviews:index:{resource_id}     SET
  members: [user_id1, user_id2, ...]

bandbbs:resource:config                 HASH
  field: "{resource_id}"   →   JSON
  {
    "title": "帖子标题",
    "url": "https://www.bandbbs.cn/resources/NNNN/",
    "enabled": true,
    "last_poll_at": "..."
  }
```

### 2.2 模块二：模拟登录 (login)

**目标**：获取 BandBBS 登录态，为私信功能提供认证。

**实现方式**（已验证，纯 `urllib` + `http.cookiejar`）：

```python
# 登录流程（已验证稳定）
# 1. GET  /login                     → 提取 _xfToken (CSRF)
# 2. POST /login/login               → 带上账号密码 + _xfToken
# 3. 验证: 检查 Cookie 中 xf_user 或页面 data-logged-in="true"

# 登录参数
login_data = {
    "login":      "user@email.com",
    "password":   "password",
    "_xfToken":   token,        # 从登录页 HTML 提取
    "_xfRedirect": "/",
    "remember":   "1"
}
```

**Cookie 管理**：
- 使用 `http.cookiejar.CookieJar()` 自动管理
- 无需手动处理 Set-Cookie
- 登录态有效期：至少数小时

**关键点**：
- **必须设置 Referer** 头（`https://www.bandbbs.cn/login`）
- `Content-Type: application/x-www-form-urlencoded`
- SSL 验证需跳过
- 无验证码，纯表单 POST

### 2.3 模块三：私信发送 (sendDm)

**目标**：通过模拟登录向指定用户发送私信。

**实现方式**（已验证）：

```python
# 发送流程
# 1. login() 获取登录态
# 2. GET  /direct-messages/add     → 提取 _xfToken + attachment_hash_combined
# 3. POST /direct-messages/add     → 发送私信
# 4. 验证: 302 重定向到 /direct-messages/{id}/

# POST 参数（关键）
dm_data = {
    "_xfToken":                  csrf_token,       # 从 DM 页面提取
    "recipients":                "username",        # 直接填用户名！
    "title":                     "标题",
    "message_html":              "<p>内容</p>",     # HTML 版本
    "message":                   "内容",            # 纯文本版本
    "attachment_hash":           hash_value,        # 从页面提取
    "attachment_hash_combined":  combined_json,     # 从页面提取，JSON 字符串
    "open_invite":               "0",
    "conversation_locked":       "0",
}
```

**关键发现**：

| 发现 | 说明 |
|------|------|
| `recipients` | 虽然页面用了 tagify/token-input 组件，但直接填**用户名**字符串即可，不需要 JSON 数组格式 |
| `message` + `message_html` | 两个字段都要填，前者纯文本，后者 `<p>...</p>` |
| `attachment_hash_combined` | 每次请求值不同，必须从 DM 页面 HTML 提取 |
| 无验证码 | 全流程无验证码，纯表单 POST |
| 成功判断 | POST 后返回 302，Location 是 `/direct-messages/{conversation_id}/` |

---

## 3. 文件清单

### 3.1 新增文件

```
app-auth/
├── lib/
│   └── bandbbs.js                    ← 核心逻辑库（评论抓取 + 登录 + 私信）
│
├── api/admin/
│   └── bandbbs.js                    ← Vercel API route (kind=bandbbs 分派)
│                                      （可选，如果复用 catalog.js 则不需要）
│
└── docs/
    └── bandbbs-integration-plan.md   ← 本文档
```

### 3.2 修改文件

| 文件 | 修改内容 |
|------|---------|
| `api/admin/catalog.js` | 注册 `kind=bandbbs` 分派 |
| `lib/admin-health.js` | `DEFAULT_TASKS` 新增 `bandbbs-poll` 任务 |
| `vercel.json` | crons 新增 `bandbbs-poll` 定时触发 |
| `admin_Dx23.html` | 新增社区运营面板 `panel-bandbbs` |

---

## 4. 代码实现

### 4.1 lib/bandbbs.js — 核心库

```javascript
// lib/bandbbs.js — BandBBS 社区运营核心库
// 功能：模拟登录、评论抓取、私信发送
// 依赖：Node.js 内置 http/https 模块（零外部依赖）

var https = require("https");
var http = require("http");
var url = require("url");

// ── 配置 ──
var BASE_URL = "https://www.bandbbs.cn";
var UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var REDIS_PREFIX = "bandbbs:";

// ── SSL 处理（自签证书跳过）──
var agent = new https.Agent({ rejectUnauthorized: false });

// ── Cookie 容器 ──
var cookieJar = "";

// ── HTTP GET ──
async function httpGet(theUrl, referer) {
    return new Promise(function(resolve, reject) {
        var u = url.parse(theUrl);
        var mod = u.protocol === "https:" ? https : http;
        var opts = {
            hostname: u.hostname,
            port: u.port,
            path: u.path,
            method: "GET",
            agent: u.protocol === "https:" ? agent : undefined,
            headers: {
                "User-Agent": UA,
                "Cookie": cookieJar,
            }
        };
        if (referer) opts.headers["Referer"] = referer;
        var req = mod.request(opts, function(res) {
            // 收集 set-cookie
            var c = res.headers["set-cookie"];
            if (c) {
                if (Array.isArray(c)) c = c.join("; ");
                cookieJar = updateCookieJar(cookieJar, c);
            }
            var body = "";
            res.on("data", function(d) { body += d; });
            res.on("end", function() {
                resolve({ body: body, statusCode: res.statusCode, headers: res.headers });
            });
        });
        req.on("error", reject);
        req.end();
    });
}

// ── HTTP POST ──
async function httpPost(theUrl, data, referer) {
    return new Promise(function(resolve, reject) {
        var u = url.parse(theUrl);
        var mod = u.protocol === "https:" ? https : http;
        var postData = new URLSearchParams(data).toString();
        var opts = {
            hostname: u.hostname,
            port: u.port,
            path: u.path,
            method: "POST",
            agent: u.protocol === "https:" ? agent : undefined,
            headers: {
                "User-Agent": UA,
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(postData),
                "Cookie": cookieJar,
            }
        };
        if (referer) opts.headers["Referer"] = referer;
        var req = mod.request(opts, function(res) {
            var c = res.headers["set-cookie"];
            if (c) {
                if (Array.isArray(c)) c = c.join("; ");
                cookieJar = updateCookieJar(cookieJar, c);
            }
            var body = "";
            res.on("data", function(d) { body += d; });
            res.on("end", function() {
                resolve({ body: body, statusCode: res.statusCode, headers: res.headers });
            });
        });
        req.on("error", reject);
        req.write(postData);
        req.end();
    });
}

function updateCookieJar(oldJar, setCookie) {
    if (!setCookie) return oldJar;
    var cookies = oldJar ? oldJar.split("; ").filter(Boolean) : [];
    var kv = setCookie.split(";")[0].trim();
    var eq = kv.indexOf("=");
    if (eq > 0) {
        var key = kv.substring(0, eq);
        var val = kv.substring(eq + 1);
        cookies = cookies.filter(function(c) { return !c.startsWith(key + "="); });
        cookies.push(key + "=" + val);
    }
    return cookies.join("; ");
}

// ── 提取 CSRF Token ──
function extractToken(html) {
    var m = html.match(/name="_xfToken"\s+value="([^"]+)"/);
    return m ? m[1] : null;
}

// ── 1) 模拟登录 ──
async function login(email, password) {
    cookieJar = "";
    var loginPage = await httpGet(BASE_URL + "/login");
    var token = extractToken(loginPage.body);
    if (!token) return { success: false, error: "no CSRF token" };

    var result = await httpPost(BASE_URL + "/login/login", {
        login: email,
        password: password,
        _xfToken: token,
        _xfRedirect: "/",
        remember: "1",
    }, BASE_URL + "/login");

    var loggedIn = result.body.indexOf('data-logged-in="true"') !== -1;
    return { success: loggedIn, cookieJar: cookieJar, token: token };
}

// ── 2) 获取评论 ──
async function fetchReviews(resourceId) {
    var pageUrl = BASE_URL + "/resources/" + resourceId + "/reviews";
    var result = await httpGet(pageUrl);
    var html = result.body;

    var reviews = [];
    // 正则提取每条评论
    var reviewBlocks = html.match(/<article[^>]*class="[^"]*review[^"]*"[^>]*>[\s\S]*?<\/article>/gi);
    if (!reviewBlocks) reviewBlocks = [];
    reviewBlocks.forEach(function(block) {
        var username = (block.match(/<a[^>]*class="[^"]*username[^"]*"[^>]*>([^<]+)<\/a>/i) || [])[1] || "";
        var rating = (block.match(/data-rating="(\d+)"/i) || [])[1] || "0";
        var content = (block.match(/<div[^>]*class="[^"]*bbWrapper[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || [])[1] || "";
        var time = (block.match(/datetime="([^"]+)"/i) || [])[1] || "";
        content = content.replace(/<[^>]+>/g, "").trim();
        reviews.push({
            username: username.trim(),
            rating: parseInt(rating, 10),
            content: content,
            time: time,
            stars: "★".repeat(parseInt(rating, 10)) + "☆".repeat(5 - parseInt(rating, 10)),
        });
    });
    return reviews;
}

// ── 3) 发送私信 ──
async function sendDm(email, password, recipient, title, message) {
    // 步骤1：登录
    var loginResult = await login(email, password);
    if (!loginResult.success) return loginResult;
    var loginCsrf = loginResult.token;

    // 步骤2：获取 DM 页面
    var dmPage = await httpGet(BASE_URL + "/direct-messages/add", BASE_URL + "/login");
    if (dmPage.body.indexOf("/login") !== -1) {
        return { success: false, error: "not authenticated after login" };
    }
    var dmCsrf = extractToken(dmPage.body);
    var attachHash = (dmPage.body.match(/name="attachment_hash"\s+value="([^"]*)"/) || [])[1] || "";
    var attachCombined = (dmPage.body.match(/name="attachment_hash_combined"\s+value="([^"]*)"/) || [])[1] || "";

    if (!dmCsrf) return { success: false, error: "no DM CSRF token" };

    // 步骤3：发送
    var postData = {
        _xfToken: dmCsrf,
        recipients: recipient,
        title: title,
        message_html: "<p>" + message + "</p>",
        message: message,
        open_invite: "0",
        conversation_locked: "0",
    };
    if (attachHash) postData.attachment_hash = attachHash;
    if (attachCombined) postData.attachment_hash_combined = attachCombined;

    var sent = await httpPost(
        BASE_URL + "/direct-messages/add",
        postData,
        BASE_URL + "/direct-messages/add"
    );

    // 验证：302 重定向或页面标题含标题
    var location = sent.headers.location || "";
    var success = location.indexOf("/direct-messages/") !== -1 && location.indexOf("/add") === -1;
    if (!success) {
        var titleMatch = (sent.body.match(/<title>([^<]+)<\/title>/) || [])[1] || "";
        success = titleMatch.indexOf(title) !== -1;
    }

    // 提取 conversation id
    var convId = (location.match(/\/direct-messages\/(\d+)/) || [])[1] || "";
    return {
        success: success,
        conversationId: convId,
        conversationUrl: location ? (BASE_URL + location) : "",
    };
}

// ── 导出 ──
module.exports = {
    login: login,
    fetchReviews: fetchReviews,
    sendDm: sendDm,
};
```

### 4.2 api/admin/catalog.js — 注册分派

在现有 `catalog.js` 中增加一行：

```javascript
var bandbbs = require("../../lib/bandbbs.js");  // ← 新增

module.exports = async (req, res) => {
  var kind = (req.query && req.query.kind) || "";
  if (kind === "go") return goLinks(req, res);
  if (kind === "products") return products(req, res);
  if (kind === "health") return health(req, res);
  if (kind === "bandbbs") return handleBandBBS(req, res);  // ← 新增
  return res.status(404).json({ success: false, error: "unknown kind: " + kind });
};

// ── BandBBS 处理器 ──
async function handleBandBBS(req, res) {
    var { query, body } = req;
    var op = (query && query.op) || "stats";

    // 鉴权：读写操作需要管理员
    if (op === "send-dm" || op === "config") {
        var auth = requireAuth(req);
        if (!auth || !auth.authorized) return res.status(401).json({ success: false, error: "unauthorized" });
    }

    try {
        switch (op) {
            case "stats": {
                var redis = require("../../lib/redis");
                var stats = await bandbbs.getStats(redis);
                return res.json({ success: true, data: stats });
            }
            case "poll": {
                var redis = require("../../lib/redis");
                var resourceIds = query && query.resources ? String(query.resources).split(",") : null;
                var result = await bandbbs.pollReviews(redis, resourceIds);
                return res.json(result);
            }
            case "send-dm": {
                var { recipient, title, message } = body || {};
                if (!recipient || !title || !message) {
                    return res.status(400).json({ success: false, error: "缺少必要参数" });
                }
                var result = await bandbbs.sendDm(recipient, title, message);
                return res.json(result);
            }
            case "config": {
                var redis = require("../../lib/redis");
                var config = await bandbbs.getConfig(redis);
                return res.json({ success: true, data: config });
            }
            default:
                return res.status(400).json({ success: false, error: "unknown op: " + op });
        }
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message || String(e) });
    }
}
```

### 4.3 vercel.json — 定时任务

在 `crons` 数组中新增：

```json
{
    "path": "/api/admin/catalog?kind=bandbbs&op=poll&cron=1",
    "schedule": "0 */2 * * *"
}
```

**说明**：每 2 小时的整点执行（0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22），对配置中所有 enabled 的资源帖抓取评论。

> Vercel Hobby 计划限制：最多 2 个 cron 不同调度。如需更多，可与现有 cron 合并到一个 handler 中统一调度。

### 4.4 lib/admin-health.js — 注册默认任务

在 `DEFAULT_TASKS` 数组中新增：

```javascript
{
    id: "bandbbs-poll",
    name: "BandBBS 评论收集",
    description: "每2小时自动抓取 BandBBS 社区帖子的用户评分和评论",
    schedule: "0 */2 * * *",
    enabled: true,
    vercelPath: "/api/admin/catalog?kind=bandbbs&op=poll&cron=1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
},
```

### 4.5 admin_Dx23.html — 前端面板

在 sidebar-menu 中新增导航项：

```html
<li class="menu-separator"><hr></li>
<li><a href="javascript:void(0)" onclick="switchTab('bandbbs')" data-tab="bandbbs">
    <i data-lucide="message-square" class="menu-icon"></i>
    <span class="menu-text">社区运营</span>
</a></li>
```

在 `panel-devices` 之后新增面板 HTML：

```html
<div class="panel" id="panel-bandbbs">
    <!-- 子标签页 -->
    <div class="logs-tabs" style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid var(--line,#e5e7eb);">
        <button class="logs-tab active" onclick="switchBandbbsTab('overview')" id="bbTabOverview"
            style="padding:8px 24px;border:none;background:none;font-size:0.875rem;font-weight:600;color:var(--accent-text);cursor:pointer;border-bottom:2px solid var(--accent);margin-bottom:-2px;">
            📊 评论概览
        </button>
        <button class="logs-tab" onclick="switchBandbbsTab('dm')" id="bbTabDm"
            style="padding:8px 24px;border:none;background:none;font-size:0.875rem;font-weight:600;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;">
            ✉️ 发送私信
        </button>
        <button class="logs-tab" onclick="switchBandbbsTab('config')" id="bbTabConfig"
            style="padding:8px 24px;border:none;background:none;font-size:0.875rem;font-weight:600;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;">
            ⚙️ 抓取配置
        </button>
    </div>

    <!-- 子页面：评论概览 -->
    <div id="bbSubOverview">
        <div class="toolbar" style="margin-bottom:16px;">
            <h2>评论概览</h2>
            <button class="btn btn-primary" onclick="bandbbsPollNow()">🔄 立即抓取</button>
        </div>
        <div class="stats-bar" id="bbStats" style="margin-bottom:16px;">
            <!-- JS 动态渲染统计卡片 -->
        </div>
        <table class="data-table" id="bbReviewsTable">
            <thead><tr>
                <th>用户</th><th>评分</th><th>内容</th><th>时间</th><th>来源帖子</th>
            </tr></thead>
            <tbody id="bbReviewsBody"></tbody>
        </table>
    </div>

    <!-- 子页面：发送私信 -->
    <div id="bbSubDm" style="display:none;">
        <div class="toolbar" style="margin-bottom:16px;">
            <h2>发送私信</h2>
        </div>
        <div style="max-width:600px;">
            <div class="form-group">
                <label>收件人用户名</label>
                <input type="text" id="bbDmRecipient" class="input" placeholder="输入 BandBBS 用户名">
            </div>
            <div class="form-group">
                <label>标题</label>
                <input type="text" id="bbDmTitle" class="input" placeholder="私信标题">
            </div>
            <div class="form-group">
                <label>内容</label>
                <textarea id="bbDmMessage" class="textarea" rows="5" placeholder="私信内容"></textarea>
            </div>
            <button class="btn btn-primary" onclick="bandbbsSendDm()">📨 发送私信</button>
            <div id="bbDmResult" style="margin-top:12px;"></div>
        </div>
    </div>

    <!-- 子页面：抓取配置 -->
    <div id="bbSubConfig" style="display:none;">
        <div class="toolbar" style="margin-bottom:16px;">
            <h2>抓取配置</h2>
            <button class="btn btn-primary" onclick="bandbbsAddResource()">+ 添加帖子</button>
        </div>
        <table class="data-table" id="bbConfigTable">
            <thead><tr>
                <th>帖子ID</th><th>标题</th><th>URL</th><th>状态</th><th>最后抓取</th><th>操作</th>
            </tr></thead>
            <tbody id="bbConfigBody"></tbody>
        </table>
        <div id="bbAddResourceForm" style="display:none;margin-top:16px;max-width:400px;">
            <div class="form-group">
                <label>帖子 Resource ID</label>
                <input type="text" id="bbNewResourceId" class="input" placeholder="例如: 7828">
            </div>
            <div class="form-group">
                <label>标题（可选）</label>
                <input type="text" id="bbNewResourceTitle" class="input" placeholder="帖子标题">
            </div>
            <button class="btn btn-primary" onclick="bandbbsSaveResource()">保存</button>
        </div>
    </div>
</div>
```

前端 JS 函数：

```javascript
// ── BandBBS 面板逻辑 ──
function switchBandbbsTab(sub) {
    // 切换子标签页样式
    document.querySelectorAll('#panel-bandbbs .logs-tab').forEach(function(t) {
        t.style.color = 'var(--muted)';
        t.style.borderBottom = '2px solid transparent';
    });
    var tabBtn = document.getElementById('bbTab' + sub.charAt(0).toUpperCase() + sub.slice(1));
    if (tabBtn) {
        tabBtn.style.color = 'var(--accent-text)';
        tabBtn.style.borderBottom = '2px solid var(--accent)';
    }
    // 切换子页面
    ['overview','dm','config'].forEach(function(s) {
        var el = document.getElementById('bbSub' + s.charAt(0).toUpperCase() + s.slice(1));
        if (el) el.style.display = (s === sub) ? '' : 'none';
    });
    if (sub === 'overview') bandbbsLoadStats();
    if (sub === 'config') bandbbsLoadConfig();
}

async function bandbbsLoadStats() {
    try {
        var r = await fetch('/api/admin/catalog?kind=bandbbs&op=stats');
        var d = await r.json();
        if (d.success) renderBandbbsStats(d.data);
    } catch(e) { console.error(e); }
}

async function bandbbsPollNow() {
    var btn = event.target;
    btn.disabled = true;
    btn.textContent = '抓取中...';
    try {
        var r = await fetch('/api/admin/catalog?kind=bandbbs&op=poll', { method: 'POST' });
        var d = await r.json();
        alert(d.success ? '抓取完成！' : '抓取失败: ' + (d.error || ''));
        bandbbsLoadStats();
    } catch(e) { alert('请求失败: ' + e.message); }
    finally { btn.disabled = false; btn.textContent = '立即抓取'; }
}

async function bandbbsSendDm() {
    var recipient = document.getElementById('bbDmRecipient').value.trim();
    var title = document.getElementById('bbDmTitle').value.trim();
    var message = document.getElementById('bbDmMessage').value.trim();
    if (!recipient || !title || !message) {
        alert('请填写所有字段');
        return;
    }
    var resDiv = document.getElementById('bbDmResult');
    resDiv.innerHTML = '发送中...';
    try {
        var r = await fetch('/api/admin/catalog?kind=bandbbs&op=send-dm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient: recipient, title: title, message: message })
        });
        var d = await r.json();
        if (d.success) {
            resDiv.innerHTML = '<div class="success">发送成功！会话: ' + d.conversationUrl + '</div>';
        } else {
            resDiv.innerHTML = '<div class="error">发送失败: ' + (d.error || '') + '</div>';
        }
    } catch(e) {
        resDiv.innerHTML = '<div class="error">请求失败: ' + e.message + '</div>';
    }
}
```

---

## 5. 定时任务分析

### 5.1 现有 cron 基础设施评估

app-auth 项目已有成熟的 cron 管理基础设施：

```
vercel.json crons:
  0 3 * * *  →  /api/afdian?kind=query          (爱发电订单同步)
  0 4 * * *  →  /api/admin/catalog?kind=health&section=backup&cron=1  (数据库备份)
  0 5 * * *  →  /api/admin/catalog?kind=health&section=sync&cron=1    (多路同步)

Redis 中的 cron 管理:
  auth:cron:config           cron 任务配置（DEFAULT_TASKS + 自定义）
  auth:cron:stats:{id}       每个任务的运行统计
  auth:cron:list             cron 任务 ID 列表
  auth:cron:run_logs         运行日志 (最新 100 条)
```

### 5.2 Vercel Hobby 限制

| 限制项 | 值 |
|--------|-----|
| 最大 cron 任务数 | 2 个不同调度（Hobby）/ 5 个（Pro） |
| 每次执行超时 | 10 秒（Hobby）/ 60 秒（Pro） |
| 月执行次数 | 无明确限制 |

### 5.3 建议方案

**方案 A：独立 cron（推荐，如果额度允许）**
```json
{ "path": "/api/admin/catalog?kind=bandbbs&op=poll&cron=1", "schedule": "0 */2 * * *" }
```
- 优点：独立调度，灵活可控
- 缺点：占用一个 cron 配额

**方案 B：并入现有 cron 合并执行（备用）**
在 `api/admin/catalog?kind=health&section=backup` 中追加 `&alsoPoll=1` 参数，在 health 备份的同时顺手执行评论收集。
- 优点：不占用额外配额
- 缺点：与备份耦合，不够优雅

---

## 6. 环境变量

在 Vercel 环境变量中配置 BandBBS 账号（后端自动读取，不暴露在前端 HTML）：

```
BANDBBS_EMAIL=<登录邮箱>
BANDBBS_PASSWORD=<登录密码>
```

`lib/bandbbs.js` 中读取：
```javascript
var EMAIL = process.env.BANDBBS_EMAIL || "";
var PASSWORD = process.env.BANDBBS_PASSWORD || "";
```

---

## 7. 实施步骤

| 步骤 | 内容 | 涉及文件 |
|------|------|---------|
| 1 | 创建 `lib/bandbbs.js` 核心库 | 新建 |
| 2 | 在 `api/admin/catalog.js` 注册 `kind=bandbbs` 分派 | 修改 |
| 3 | 在 `vercel.json` 添加 cron 定时任务 | 修改 |
| 4 | 在 `lib/admin-health.js` 注册默认任务（系统面板可见） | 修改 |
| 5 | 在 `admin_Dx23.html` 添加社区运营面板 | 修改 |
| 6 | 配置 Vercel 环境变量 `BANDBBS_EMAIL` / `BANDBBS_PASSWORD` | 运维 |
| 7 | 部署到 Vercel，通过后台面板手动触发首次抓取验证 | 测试 |

---

## 8. 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vercel                                   │
│                                                                 │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐ │
│  │ Vercel Cron  │   │  Serverless API   │   │  Static HTML  │ │
│  │ 0 */2 * * *  │──▶│  /api/admin/      │   │  admin_Dx23   │ │
│  │              │   │  catalog?kind=    │◀──│  .html         │ │
│  └──────────────┘   │  bandbbs&op=poll  │   │               │ │
│                     └────────┬─────────┘   └───────────────┘ │
│                              │                                │
│                     ┌────────▼─────────┐                      │
│                     │  lib/bandbbs.js  │                      │
│                     │                  │                      │
│                     │ ├ login()        │                      │
│                     │ ├ fetchReviews() │                      │
│                     │ ├ pollReviews()  │                      │
│                     │ ├ sendDm()       │                      │
│                     │ └ getStats()     │                      │
│                     └────────┬─────────┘                      │
│                              │                                │
│          ┌───────────────────┼───────────────────┐            │
│          │                   │                   │            │
│  ┌───────▼───────┐   ┌──────▼───────┐   ┌───────▼─────────┐ │
│  │  Upstash Redis│   │  BandBBS.cn  │   │  Supabase/Neon  │ │
│  │  (评论缓存)    │   │  (抓取目标)   │   │  (日志/备份)    │ │
│  └───────────────┘   └──────────────┘   └─────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```