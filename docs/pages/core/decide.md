# 帮助抉择

> 路由：pages/decide ｜ 源码：src/pages/decide/decide.ux

> 状态：**P0 已实现并编译验证**（2026-11-13 · `evtask-D-evevbox-261113-pbeqqv`）。按总纲 §3.22「先写骨架 → 再改代码 → 回填实测结论与坑 → 同一次提交带上」，本页实测结论已回填在 §7。
> 方案正本：`EvBox命名统一与帮助抉择工具-规划方案.md`（工作区，v7）；**ev-six 合规校正见该方案 §9，凡字号／位置／符号口径一律以 §9 为准**。
> 真机三屏验收尚未完成（见 §7.3），因此本页状态是「可编译可注册」，不是「已通过 ev-shapes 验收」。

---

## 1. 页面职责

从一组选项里公平地抽一个，把「抽」做得有仪式感。纯本地、无外部服务。工具箱 `tools.ux` 已加入口「抉择」，图标 `tool_decide.png`（dark／light 两套）。

**结果形态**（`drawRule.resultMode`，见方案 §3.7 / §3.8）：

| 形态 | 输出 | 分期 | P0 状态 |
|---|---|---|---|
| `single` | 1 个元素（默认） | P0 | ✅ 已实现 |
| `multi` / `partition` | 同集合挑 k 个 / 全覆盖分组 | P1–P2 | 未实现 |
| `combo` | 跨集合各抽一个拼成元组（如蔬菜＋水果＋粥） | P1 尾–P2 | 未实现 |

首页开关 `homepage_settings.showDecide` 与 `pinned_pages` 钉首页入口属 P1，P0 仅工具箱入口。

## 2. 界面结构（P0 实际实现）

一屏只做「抽」这一件事，四个视图用 `display` 绑定切换，共用同一个页头（返回键 30 + 居中标题 28px ≤2 字 + 等宽占位 30）：

```
┌ 抉择                            28px 页头 ┐
│ 当前卡组名                      28px 可点  │
│ ── 抽取舞台 138px ─────────────────────  │
│   spinning: 3 行窗口 / flip 单行 28px     │
│   done:     结果大字 44px lines 2         │
│ 抽一个 / 再抽一次               28px 主按钮│
│ 换卡组                          24px 次行 │
│ 我的卡组                        24px 次行 │
│ 内联状态条                      24px 固定 │
└──────────────────────────────────────┘
```

- **卡组视图**：两级 —— 先选 12 个分类（短名），再选该类下的卡组。P1 才做分类折叠／最近使用／收藏／搜索。
- **自定义视图**：逐项添加 → 保存并抽。手环无软键盘，复用 `pages/chinese-input` 的 storage 回传协议（见 §7.2 坑 3）。
- **动画**：`flip`（2 项，单行快速切换）与 `wheel`（≥3 项，3 行窗口程序驱动逐帧减速，最后停在预定结果）。统一状态机 `idle → spinning → done`，**结果在 `draw()` 里先定后演**；`onHide` 中断动画直接跳到结果，不改变结果。
- `compass` 组（11 组）P0 **降级为 wheel**，页内提示「暂用滚动」；罗盘／骰子／跑动属 P1。

## 3. 核心方法（P0 实际实现）

| 方法 | 职责 |
|---|---|
| `setDeck(deck)` | 装载卡组，按 `anim` 判定 flip／wheel，重置状态 |
| `draw()` / `tick()` / `finishDraw()` | 先定 `resultIndex`，再逐帧减速；到点强制落结果 |
| `buildWindow()` | 构造 3 行滚动窗口（中央高亮）或 flip 单行 |
| `buildCatList()` / `pickCat(idx)` / `selectDeck(idx)` | 两级卡组列表；分类用 `CAT_SHORT` 短名 |
| `addItem()` | 写 `chinese_input_*` 参数 → `router.push` 到中文输入页 |
| `checkInputResult()` / `parseText()` / `posOf()` | 回传解析：空格／逗号／顿号／分号拆分、去重、≤6P 过滤、上限 30 项 |
| `saveCustom()` / `clearCustom()` / `saveDraft()` / `loadDraft()` | 自定义卡组与草稿的 `@system.storage` 持久化 |
| `loadCustomDeck()` | 读回自定义卡组并追加「我的」分类 |

> 骨架期写的 `loadDecks()` / `runAnimation()` / `deleteDeck()` / `drawRule` 属 P1 接口，P0 未实现；`src/lib/crypto.js` 随机源也留到 P1（P0 用 `Math.random()`）。

## 4. 数据字段

P0 实际使用的子集：`id` / `title` / `cat` / `items` / `anim` / `hint`。

方案定义的完整卡组模型（`deckId` / `category` / `source` / `mode` / `groups` / `animation` / `visualHint` / `allowRepeat` / `filters` / `drawRule`）与 `drawRule`（`resultMode` / `pickCount` / `replace` / `groupSize` / `groupMode` / `groupLabels` / `slots`，全部可选）属 P1+，字段命名保持方案原样，实现时不得与 `mode` 混淆。

预设数据 `src/data/decks/preset-decks.json`：12 类 / **88 组**，屏显 `title` 一律 ≤6P 且不含禁符号；`anim` 直接标记 P0 实际动画，`hint=compass` 仅作 P1 语义标记。餐饮 300 项独立 `preset-food.json`（P1），不计入 88 组。

## 5. ev-six 坑位清单（仍然有效）

1. **ev-six 是硬铁律，不是建议**：字号只有 `44 / 30 / 28 / 24` 四档，**24px 绝对下限**，12–23px 一律禁用；一行 ≤6P（汉字 1.0 / 拉丁数字 0.55 / 空格 0.3 / 全角标点 0.5 / 徽标 1.0，无免费字符）。`src/common/ev-six-tokens.css` 是规范正本；**P0 页面把四档 class 内联写在 `.ux` 的 `<style>` 里**（快应用 `.ux` 不支持跨文件 `@import`，工程既有页面全部内联），两处口径必须同步，改一处要改另一处。
2. **留白只从高度买**：页面左右 padding 12px（内容宽 168px），卡片／行 ≤8px；横向 padding 直接扣位置预算，实测曾把文案截成「购买兑换」且不报错。
3. **禁符号三件套**：禁箭头、禁分隔符（分隔点带空格 = 1.1P）、禁序号徽标与「推荐／备用」标签。可点性靠**底色三级层次**（裸文／卡片／亮底）。预设 JSON 的 `title` 已按此口径取名（如「要不要」而非「要/不要」）。
4. **放不下时**：删内容 → 换行／拆页 → 抬 `line-height`（44→60 / 30→40 / 28→38 / 24→34）→ 纵向 padding → 纵向 margin；**绝不压字号**。
5. **屏型**：pill 192×490（内容宽 168px）／rect 336×480／circle 466×466。大屏只调 padding 与舞台高度，不缩字号、不放大字号。compass 上限 v7 收紧为**圆屏 ≤8 项、胶囊屏 ≤4 项**，12 项组回退 wheel。
6. **验收**：提交前过 `ev/class-schedule/docs/手环页面开工手册-20261023.md` §六 14 条自检；按总纲 §3.24 **ev-shapes 三屏同包并排**（pill / rect / circle），逐屏标版本；交付写「ev-six 通过 / 违 N 项」。
7. **路由 WIP 已裁定**：`src/manifest.json` 与 `src/data/version.js` 的他人版本号 WIP（1.0.63 / 64）按提交纪律**拆两个提交**处置 —— 先原样入库他人 WIP，再提交本页改动，未代为发布半成品、也未把两者混进同一提交。

## 6. P0 未实现项（明确边界）

罗盘／骰子／跑动动画、`drawRule` 多人抽取与分组、combo 组合抽取、餐饮 300 项与四筛选、最近使用／收藏／搜索、`pinned_pages` 钉首页、首页开关、历史记录、简化动画开关、文本串导入导出、真机三屏截图验收。

## 7. 实测结论与坑（2026-11-13 回填）

### 7.1 编译与产物

| 项 | 结果 |
|---|---|
| 命令 | `./node_modules/.bin/aiot build`（**刻意不走 `npm run build`**，见坑 4） |
| 结果 | `✅ build success: 3520ms`，`BUILD_PIPE_RC=0` |
| 产物 | `dist/com.application.watch.evbox.debug.1.0.63.rpk`（215 文件 / 729K） |
| rpk 内页 | `pages/decide/decide.js` 171574 B；`tool_decide.png` dark 602 B / light 616 B |
| JSON require | 生效：`build/pages/decide/decide.js` 已内联「要不要」「东南西北」等预设 |
| 存量告警 | `index.ux` 的 `formatDateShort` 未使用、`qrcode-generator.ux` 的 `DEFAULT_ITEM` 未使用；均与本页无关，未改动 |

### 7.2 踩坑记录

1. **裸 `git commit` 被 `ev-author` 署名门禁拦下**（署名邮箱必须是本会话 UUID/SID）。正确姿势：`zsh ~/Documents/guomengtao/tools/hooks/ev-commit.sh -m "..."`，它只注入 `GIT_AUTHOR_*` / `GIT_COMMITTER_*` 并透传参数，**不会自动 `git add`**，所以可以精确控制暂存区做拆分提交。
2. **他人 WIP 拆分**：提交 A 只 `git add src/manifest.json src/data/version.js`（此时 manifest 尚未加路由），提交后再改路由。提交 A 的 message 被 `ev-tidy` 的 WIP 对账钩子重写成 `[WIP] release: …`，内容仍是那两个文件的版本 bump（3 增 3 删），未夹带我的代码。
3. **手环无软键盘**：全库检索只有 `<input type="button">`，没有任何 `<textarea>` / 文本输入框。自定义选项改走 `pages/chinese-input` 的既有协议：写 `chinese_input_title` / `placeholder` / `value` / `maxlen` / `return_key` → `router.push` → `onShow` 读 `decide_add_item` 并删除。中间结果另存 `decide_draft_items` 防页面栈重建丢草稿。
4. **`npm run build` 会撞 WIP**：其 `prebuild` 会跑 `scripts/bump-version.js`，直接写 `manifest.json` 与 `version.js`。改用 `aiot build` 绕开，既不重复 bump 也不 clean 掉已有产物。
5. **分类名超宽**：`categories` 原名有 5–6 字（如「社交点名分组」），@28 需 186–223px，远超 168px 容器。按 ev-six「删字不缩字号」加 `CAT_SHORT` 12 个 2 字短名，仅用于屏显，JSON 原名不动。
6. **WIP 闸门**：脏文件超 8 分钟会锁住其他文件的读写。先把已落盘的三层基础提交释放，后续读写才解锁；这是流程约束，不是代码问题。
7. **条件渲染**：严格用 `display: {{ ... }}`（7 处），全页 0 个 `if` 指令 —— 手册事故 #11 记录多个兄弟节点用 `if` 会导致整页静默不渲染。

### 7.3 ev-six 静态校验与未闭环项

扫描口径：CSS 字号集合、行高按手册映射表严格比对、模板 `<text>` 静态文本 + 脚本中文字符串字面量（合计 38 条）逐条算 P 与禁符号、88 组预设全量复查、条件渲染／toast／`text-overflow`／保留方法名。

| 判据 | 结果 |
|---|---|
| 字号集合 | `{44, 28, 24}` ⊆ 四档，非法值 0 |
| 行高 | 44→60 / 28→38 / 24→34，全部匹配 |
| 屏显文案 | 38 条，最大 **5.30P**，禁符号 0，超 6P 0 |
| 条件渲染 | `display` 绑定 7 处，`if` 0 处 |
| 其他 | toast 0、`text-overflow` 0、保留方法名 0、卡片左右 padding ≤8 |
| 数据 | 88 组 / 12 类，标题与项全量合规 |
| **结论** | **ev-six 静态口径通过，违 0 项** |

**未闭环**：真机 ev-shapes 三屏（pill / rect / circle）同包并排截图**未做**。共享模拟器环境自 11-09 起「显示未激活／帧缓冲全 0／adb 瞬时 not found」的环境级阻塞未恢复，事故记录见 `ev/ev-fleet/docs/并发会话抢占-ev-shapes截图失败-错误登记与防试错手册.md` §7。因此字号与行距的**真机观感**（尤其 44px 结果大字 `lines:2` 的折行位置、pill 屏一屏是否放得下 438px 内容）仍未实测，不得据静态校验声称已通过 §3.24 验收。环境恢复后按手册 §5.1 领独占票，单会话重跑三屏并逐屏回填版本。
