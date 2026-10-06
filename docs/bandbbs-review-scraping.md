# BandBBS 资源评论抓取备忘

## 目标页面

`https://www.bandbbs.cn/resources/7828/reviews#resflag`

- 平台：XenForo 2.3（`data-xf="2.3"`）
- 模板：`xfrm_resource_reviews`
- 评论数据直接渲染在 HTML 中，**不需要登录、不需要 JS 执行**

## 抓取命令

```bash
curl -s -L \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  "https://www.bandbbs.cn/resources/7828/reviews" \
  > reviews.html
```

- `-s`：静默模式，不显示进度条
- `-L`：跟随重定向
- `-H`：模拟浏览器 UA，避免被拒绝

## 页面 HTML 结构

### 资源信息区（页面顶部）

```html
<div class="contentRow-main">
  <a href="/members/4611408/" class="username " dir="auto" data-user-id="4611408">peipeijin</a>
  <h1 class="p-title-value">Ev课程表小米手环9 pro 方屏版</h1>
  <!-- 综合评分 -->
  <div class="res-star">
    <span>5.0</span>
  </div>
  <!-- 下载量 -->
  <span>423</span>
</div>
```

### 每条评论结构

```html
<div class="message-cell message-cell--main">
  <div class="message-attribution message-attribution--plain">
    <ul class="listInline listInline--bullet">
      <!-- 用户 -->
      <li class="message-attribution-user">
        <a href="/members/1912855/" class="username" dir="auto" data-user-id="1912855">xiaol6</a>
      </li>
      <!-- 星级 -->
      <li>
        <span class="ratingStars ratingStars--smaller" title="5.00 星">
          <span class="ratingStars-star ratingStars-star--full"></span>  <!-- 5个full=5星 -->
          <span class="u-srOnly">5.00 星</span>
        </span>
      </li>
      <!-- 时间和版本 -->
      <li><time datetime="2026-09-11T18:59:28+0800">2026-09-11</time></li>
      <li>版本: 1.4.193</li>
    </ul>
  </div>
  <!-- 评论正文 -->
  <div class="message-body">
    设置内很多二级界面显示有问题，如激活高级版，只有左上角小一块显示...
  </div>
  <!-- 作者回复（可选） -->
  <div class="message-responses">
    <div class="comment">
      <div class="comment-contentWrapper">
        <a class="username comment-user">peipeijin</a>
        <div class="comment-body">@xiaol6 感谢反馈！该问题已在最新版修复...</div>
      </div>
    </div>
  </div>
</div>
```

## 关键提取规则

| 数据 | 正则 / 选择器 | 示例值 |
|------|-------------|--------|
| 用户名 | `class="username"[^>]*>([^<]+)<` | `xiaol6` |
| 用户 ID | `data-user-id="(\d+)"` | `1912855` |
| 评分（文字） | `title="([\d.]+) 星"` | `5.00 星` |
| 评分（星星数）| `ratingStars-star--full` 出现次数 | 5 个 = 5 星 |
| 评论时间 | `datetime="([^"]+)"` | `2026-09-11T18:59:28+0800` |
| 版本号 | 在 `<li>版本: x.x.x</li>` 中 | `1.4.193` |
| 评论内容 | `<div class="message-body">(.*?)</div>` | 完整评论文本 |
| 作者回复 | `<div class="comment-body">(.*?)</div>` | 回复文本 |

## Python 解析示例

```python
import re

with open('reviews.html', 'r') as f:
    html = f.read()

# 提取所有评论块
articles = re.findall(r'<article[^>]*>.*?</article>', html, re.DOTALL)

for art in articles:
    username = re.findall(r'username[^>]*>([^<]+)<', art)
    rating_title = re.findall(r'title="([^"]*星)"', art)
    msg = re.findall(r'class="message-body">(.*?)</div>', art, re.DOTALL)
    comment = re.findall(r'class="comment-body">(.*?)</div>', art, re.DOTALL)

    if username:
        text = re.sub(r'<[^>]+>', '', msg[0]).strip() if msg else '(无文字)'
        print(f'用户: {username[0]}')
        print(f'评分: {rating_title[0] if rating_title else "?"}')
        print(f'内容: {text[:200]}')
        print('---')
```

## 实际抓取结果（2026-10-06）

资源：**Ev课程表小米手环9 pro 方屏版**（ID: 7828），作者 peipeijin

| # | 用户 | UID | 评分 | 日期 | 内容摘要 |
|---|------|-----|------|------|---------|
| 1 | xiaol6 | 1912855 | 5.00 | 2026-09-11 | 设置内很多二级界面显示有问题，如激活高级版... |
| 2 | lkrhash | 2121389 | 5.00 | 2026-09-06 | 主界面实机显示有问题 |

两条例均有作者 peipeijin 的回复。

## 注意事项

1. **无需登录**：评论页是公开的，游客即可访问全部内容
2. **无需 JS**：数据直接内嵌在 HTML 中，没有 SPA/CSR 渲染
3. **反爬宽松**：加一个正常的 User-Agent 即可，未遇到 Cloudflare 或验证码
4. **分页**：如果评论超过一页，URL 参数为 `?page=2`，需要遍历
5. **增量抓取**：建议本地记录已处理评论的 `review_id`（从链接 `/resources/7828/review/23163/` 中提取），避免重复处理
6. **时间格式**：`datetime` 属性是 ISO 8601 格式，带 `+0800` 时区偏移