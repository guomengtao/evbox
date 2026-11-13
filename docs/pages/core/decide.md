# 帮助抉择

> 路由：pages/decide ｜ 源码：src/pages/decide/decide.ux

> 状态：**骨架先行**（2026-11-13 · `evtask-D-evevbox-261113-pbeqqv`）。按总纲 §3.22「先写骨架 → 再改代码 → 回填实测结论与坑 → 同一次提交带上」，本页代码完成后须回填实测结论，与代码同一次提交。
> 方案正本：`EvBox命名统一与帮助抉择工具-规划方案.md`（工作区，v7）；**ev-six 合规校正见该方案 §9，凡字号／位置／符号口径一律以 §9 为准**。

---

## 页面职责

从一组选项里公平地抽「一个或几个」，把「抽」做得有仪式感。纯本地、无外部服务。工具箱新增栏目，首页开关 `homepage_settings.showDecide`（默认关），`pinned_pages` 可钉快捷入口。

**结果形态**（`drawRule.resultMode`，见方案 §3.7 / §3.8）：

| 形态 | 输出 | 分期 |
|---|---|---|
| `single` | 1 个元素（默认） | P0 |
| `multi` / `partition` | 同集合挑 k 个 / 全覆盖分组 | P1–P2 |
| `combo` | 跨集合各抽一个拼成元组（如蔬菜＋水果＋粥） | P1 尾–P2 |

## 界面结构（P0）

```
┌ 帮助抉择                      30px 标题 ┐
│ 最近使用 8 组 / 收藏 / 搜索   24px 次级 │
│ + 我的卡组                    28px 操作行│
│ ── 卡组列表（分类折叠）      28px 每行  │
│ ── 抽签动画区                          │
│   picker 上下滚动 / flip 翻转           │
│ ── 结果区                    44px 主结果│
│ 再来一次                      28px 操作行│
└──────────────────────────────────────┘
```

- 卡组列表：分类折叠 → 最近使用 8 组置顶 → 收藏 → 搜索；「+ 我的卡组」固定首屏顶部。
- 自定义三步用例：`+ 我的卡组` → 每行一个选项（如 `唱歌` / `不唱歌`）→ `保存并抽`，零配置出结果。
- 结果页：结果大字 + 卡组名 + 「再来一次」；`allowRepeat=false` 时排除上次结果。

## 核心方法（待实现）

| 方法 | 职责 |
|---|---|
| `loadDecks()` | 载入 `src/data/decks/preset-decks.json`（88 组），合并本地自定义卡组 |
| `parseCustom(text)` | 按换行／逗号／顿号／空格／中文分号解析，去空行去重 |
| `draw(deck, drawRule)` | 复用 `src/lib/crypto.js` 随机源；**结果先定后演** |
| `runAnimation(kind, result)` | 统一状态机 `idle → spinning → decelerating → reveal → done` |
| `saveDeck(deck)` / `deleteDeck(id)` | 本地持久化、最近使用置顶 |

## 数据字段

卡组：`deckId` / `title` / `category` / `source` / `mode` / `items` / `groups` / `animation` / `visualHint` / `allowRepeat` / `filters` / `drawRule`。
`drawRule`：`resultMode` / `pickCount` / `replace` / `groupSize` / `groupMode` / `groupLabels` / `slots`，**全部可选**；省略 `resultMode` 时按 `pickCount` 推断，保证向后兼容。

预设数据 `src/data/decks/preset-decks.json`：12 类 / **88 组**，屏显 `title` 一律 ≤6P 且不含禁符号；餐饮 300 项独立 `preset-food.json`（P1），不计入 88 组。

## 注意事项（坑）

1. **ev-six 是硬铁律，不是建议**：字号只有 `44 / 30 / 28 / 24` 四档，**24px 绝对下限**，12–23px 一律禁用；一行 ≤6P（汉字 1.0 / 拉丁数字 0.55 / 空格 0.3 / 全角标点 0.5 / 徽标 1.0，无免费字符），7P 硬极限且整行 24px。样式统一走 `src/common/ev-six-tokens.css`，**禁止在页面里散写 `font-size`**。
2. **留白只从高度买**：页面左右 padding 12px（内容宽 168px），卡片／行 ≤8px；横向 padding 直接扣位置预算，实测曾把文案截成「购买兑换」且不报错。
3. **禁符号三件套**：禁箭头 `› → >`、禁分隔符 `· / | -`（`·` 带空格 = 1.1P，一个点等于一个汉字）、禁序号徽标与「推荐／备用」标签。可点性靠**底色三级层次**（裸文／卡片／亮底）。预设 JSON 的 `title` 已按此口径取名（如「要不要」而非「要/不要」）。
4. **放不下时**：删内容 → 换行／拆页 → 抬 `line-height` 1.36–1.42 → 纵向 padding → 纵向 margin；**绝不压字号**。每屏文字预算 48–60 字（8–10 行 × 6P），超 8 行拆页。
5. **屏型**：pill 192×490（内容宽 168px）／rect 336×480／circle 466×466。大屏禁止等比放大（屏高反而少 10px）。compass 上限 v7 收紧为**圆屏 ≤8 项、胶囊屏 ≤4 项**，12 项组（星座／生肖／月份）回退 wheel。
6. **验收**：提交前过 `ev/class-schedule/docs/手环页面开工手册-20261023.md` §六 14 条自检；按总纲 §3.24 **ev-shapes 三屏同包并排**（pill / rect / circle），逐屏标版本；交付写「ev-six 通过 / 违 N 项」。
7. **路由注册待裁定**：`src/manifest.json` 与 `src/data/version.js` 存在他人未提交的版本号 WIP（1.0.63 / 64，无活跃认领），本页 `router.pages` 注册须在 WIP 处置后单独处理，**不代为发布他人改动**。

## 实测结论与坑（待回填）

> P0 代码完成后回填：编译命令、三屏截图路径、字号扫描结果、P 预算走查、踩坑记录。此栏为空时本页不算交付完成。
