# World Cup History · 项目交接文档

> 给接手这个项目的 Claude Code 或后续协作者。  
> 项目所有人：大角勇也（djyydata 站长） · 默认中文沟通

---

## 1 · 项目是什么

为 djyydata.com 制作一个**男足世界杯历史专题页**，作为 djyydata 旗下子专题。15 个页面，全部静态生成，使用 Tailwind CSS。预计 5 月中旬上线。

这个项目跟 djyydata 已有的 2026 世界杯预测页（djyydata-worldcup-2026）是**两个独立产品**：
- 本项目 = 1930–2022 历史数据库（不含 2026）
- djyydata-worldcup-2026 = 2026 赛事预测（不放在本项目里）
- 两者通过页面间链接互相导流

最终交付方：交给项目所有人的搭档负责接入 djyydata 站。

---

## 2 · 强约束（搭档已定）

| 决策 | 选择 |
|---|---|
| 页面形态 | **静态页面**，无后端、无运行时计算 |
| CSS | **Tailwind**（具体框架不限） |
| 双语 | djyydata 现有 i18n 系统（**搭档自己管**，本项目只需提供中英文案） |
| 文件结构 | **搭档管**（你产出代码即可，不要纠结目录） |
| 数据计算 | **ETL 一次跑完**，所有概率/排名/聚合预先算好成 JSON，页面只读不算 |
| 球员名翻译 | **搭档管**（你保留拉丁原名 Maradona / Pelé 即可，他后续刷一遍 LLM 配中文） |

---

## 3 · 数据源（两份）

### 3.1 Fjelstul World Cup Database

GitHub 公开仓库，27 张表，覆盖男女足全部 30 届 WC。**只用男足部分**。

- 仓库：https://github.com/jfjelstul/worldcup
- 拉取方式：克隆仓库，或直接下 `data-csv/` 文件夹
- 男足关键数字（已校验）：
  - 22 届 (1930–2022)
  - 964 场比赛
  - 2,720 进球
  - 80 个独立国家
- **许可证：CC-BY-SA 4.0**。最终页面 footer 必须包含：
  > Data: Joshua C. Fjelstul, "The Fjelstul World Cup Database v.1.2.0" (2023). https://github.com/jfjelstul/worldcup · CC-BY-SA 4.0

### 3.2 ELO 历史数据（项目所有人提供）

预先计算好的 1930–2022 全部 964 场 ELO 评分（赛前 + 赛后 + delta）。已转换为 JSON。

- 文件：`shared-data/elo_history.json`
- 每条记录 16 个字段：`match_id · date · year · home/away_team_en · home/away_iso · home/away_goals · home/away_elo_before · home/away_elo_after · home/away_elo_delta`
- **该数据 1930 年初始 ELO 是预先种子化的**（阿根廷 2071、乌拉圭 1971 等），不是冷启动 1500，所以早期赛事的"冷门"判断可信
- 注意：原 xlsx 含 `opening odds` 列但全为 NaN，已剔除

### 3.3 数据合并策略

两个数据源按 `(year, home_team_en, away_team_en)` 主键 join：
- Fjelstul 提供：球队详情、球员、教练、裁判、球场、阶段、奖项、进球时间分布、换人、犯规
- ELO 数据提供：每场比赛赛前/赛后评分

**国家代码对齐**：见 `shared-data/team_name_mapping.csv`，85 个国家 EN 名 → ISO3。已采用 Fjelstul 风格的足球编码（ENG/WAL/SCO/NIR 拆分英国，YUG/SCG/DDR/CSK/URS/FRG 用于历史已解体国）。**搭档需校审一遍**，特别注意 KSA（沙特）、CIV（科特迪瓦）、DEI（荷属东印度）这几个特殊编码。

---

## 4 · 15 个页面 · 数据表映射

| # | 页面 | 用到的核心表 / 数据 |
|---|---|---|
| 1 | 首页 | tournaments + matches + 前 3 名 upsets |
| 2 | 历届赛事列表 | tournaments + tournament_standings + host_countries |
| 3 | 单届详情（如 1986）| matches + goals + awards + award_winners + group_standings + stadiums + tournament_stages |
| 4 | 球队列表（80 国排行）| teams + qualified_teams + team_appearances + confederations |
| 5 | 球队 DNA 卡（如巴西）| team_appearances + goals + bookings + group_standings + players + squads |
| 6 | 比赛详情（分钟级）| matches + goals + bookings + substitutions + penalty_kicks + player_appearances + referee_appearances |
| 7 | 球员页（如 Pelé）| players + squads + player_appearances + goals + bookings + awards |
| 8 | 史上最大冷门 Top 50 | matches + ELO 反推 + 自定义算法 |
| 9 | 对阵预测器 | matches 历史交锋 + ELO（注意：本页**不含**任何 2026 预测，只展示历史 H2H） |
| 10 | 死亡之组排行 | groups + group_standings + qualified_teams + ELO |
| 11 | 主办国效应 | host_countries + tournament_standings |
| 12 | 球场页（240 座 + 地图）| stadiums + matches |
| 13 | 教练 / 裁判 | managers + manager_appointments + referees + referee_appointments |
| 14 | 奖项榜 | awards + award_winners + players |
| 15 | 数据下载 / 致谢页 | 完整 schema + Fjelstul CC-BY-SA 4.0 attribution |

---

## 5 · 设计系统

### 5.1 整体调性

**编辑型数据库**（参考：FT、Bloomberg、The Pudding）。  
不是体育门户的炫技花哨。冷感配色 + 大量留白 + 有节制地用一两个强调色。

### 5.2 颜色（Tailwind 类名）

| 用途 | 类 |
|---|---|
| 主背景 | `bg-white dark:bg-neutral-950` |
| 次背景（卡片填色）| `bg-neutral-50 dark:bg-neutral-900` |
| 边框 | `border-neutral-200 dark:border-neutral-800` |
| 主文字 | `text-neutral-900 dark:text-neutral-100` |
| 次文字 | `text-neutral-600 dark:text-neutral-400` |
| 三级文字 | `text-neutral-400` |
| 冷门 / 强调 | `text-orange-700 / bg-orange-600` |
| 链接 / 信息 | `text-blue-700 / bg-blue-50` |
| 数据条（强势方）| `bg-blue-700` |
| 数据条（弱势方）| `bg-orange-600` |

### 5.3 字体

- 默认 sans-serif 系统字体栈（含 PingFang SC / Microsoft YaHei 兜底中文）
- **大年份 hero**（如 1986、巴西名字）使用 `font-serif`（Georgia / Songti SC）
- 字重只用 400（regular）和 500（medium），**禁用 600/700**，太重压不住编辑感

### 5.4 布局

- 页面主内容 `max-w-2xl mx-auto`（672px）
- 页内 padding `px-6 py-8`
- 节与节之间 `mt-8` / `pt-5 border-t`
- 卡片 `border border-neutral-200 rounded-xl p-4`
- 数据网格 `grid grid-cols-2 sm:grid-cols-4 gap-2.5`（22 届网格用 `grid-cols-6 sm:grid-cols-11`）

### 5.5 组件模式

- **数据条**：`flex items-center gap-2` + 小标签 + flex-1 进度条 + 右侧数字
- **趋势卡片**：年份 + 比赛 + 比分 + 冷门指数 + 1-2 句注解
- **时间轴**：横向 SVG，事件用色块标记，跨半场用空白断开

### 5.6 双语模式

每个文本元素加 `data-i18n="key.path"` 属性，翻译表见 `i18n.json`。  
**搭档会把这套接到他们 djyydata 现有 i18n 系统**，不需要本项目内实现切换逻辑。但为方便预览，每页 HTML 可以包含一段简单 JS 实现切换（参考 `01-homepage/index.html` 末尾的 DEV ONLY 脚本）。

翻译范围：
- ✅ UI 标签、章节标题、阶段名（小组赛/决赛）、国家名
- ❌ 数字、ISO 代码、年份、球员名（保留拉丁原名）

---

## 6 · 关键算法

### 6.1 ELO → 胜率反推

ELO 已经给定。从 ELO 差算赛前 P(W/D/L) 用经典公式：

```python
def elo_to_prob(elo_a, elo_b, draw_factor=0.28):
    """
    返回 (P_a_win, P_draw, P_b_win)。
    draw_factor 是平局基础概率，根据 World Football Elo Ratings 经验值。
    """
    diff = elo_a - elo_b
    p_a_logistic = 1 / (1 + 10 ** (-diff / 400))
    # 用 Dixon-Coles 风格调整出平局
    p_draw = draw_factor * (1 - abs(diff) / 1500)
    p_draw = max(0.10, min(0.32, p_draw))  # 钳位
    p_a = p_a_logistic - p_draw / 2
    p_b = 1 - p_a_logistic - p_draw / 2
    # 防负
    if p_a < 0: p_a, p_b = 0, p_b + p_a
    if p_b < 0: p_b, p_a = 0, p_a + p_b
    return p_a, p_draw, p_b
```

### 6.2 双指标冷门指数（page #8 核心）

通过对真实数据的检验发现：单一"P(输家赢)"指标会**漏掉 2014 BRA-GER 1:7**（两队 ELO 几乎相等，1-7 的爆冷在比分而非胜负），因此需要双指标：

```python
def upset_score(match):
    """
    总冷门指数 = 70% × 胜负冷门 + 30% × 比分冷门
    """
    p_w, p_d, p_l = elo_to_prob(match.winner_elo_before, match.loser_elo_before)
    
    # 维度 A：胜负冷门 = 输家原本胜率 ×100
    win_loss_upset = p_l * 100
    
    # 维度 B：比分冷门 = 实际净胜球 vs 期望净胜球的标准化偏差
    # 期望净胜球 ≈ ELO 差 / 200（经验近似）
    expected_diff = (match.winner_elo_before - match.loser_elo_before) / 200
    actual_diff = match.winner_goals - match.loser_goals
    score_upset = max(0, (actual_diff - expected_diff) / 4) * 100  # 钳位归一
    score_upset = min(100, score_upset)
    
    return round(0.7 * win_loss_upset + 0.3 * score_upset)
```

按检验，这个公式给出：
- 1950 USA vs ENG → 92（典型胜负冷门）
- 2014 BRA vs GER 1:7 → 88（典型比分冷门）
- 2002 SEN vs FRA → 86
- 2022 KSA vs ARG → 85
- 2002 KOR vs ITA → 84

跟民间排行榜大体一致。

### 6.3 H2H 历史交锋（page #9）

简单聚合，不需要算法，只需要 group by 两国 ISO 计算总场次/胜/平/负/进球。

---

## 7 · 已完成的工作

### 7.1 文件清单（World Cup history 文件夹应该有这些）

```
World Cup history/
├── HANDOFF.md                     ← 本文档
├── shared-data/
│   ├── _source_elo.xlsx           ← 项目所有人原始 ELO 数据
│   ├── elo_history.json           ← 已转换 · 964 行 · 17 个字段
│   ├── team_name_mapping.csv      ← 85 国 ISO3 映射 · 待搭档审
│   └── convert_elo.py             ← 复刻脚本
└── 01-homepage/                   ← 页面 #1 已交付（作为模板参考）
    ├── index.html                 ← Tailwind 完整页面 + 预览 i18n script
    ├── data-needs.md              ← 数据接口规约
    └── i18n.json                  ← 中英文案表
```

### 7.2 设计共识

通过迭代 mockup 已经定下来的几件事：

1. **不放图片**。所有视觉用 SVG / CSS 数据可视化做。版权和性能都好处理
2. **首页结构**：顶部导航 → 4 格关键数据 → 史上最大冷门 Top 3（前 2 张展开 + 第 3 张折叠预览）→ 22 届网格 → 2026 出口链接
3. **历届列表用横向行而非卡片**，扫读密度更高
4. **球队 DNA 页**用横向数据条 + 进球时间分布柱状图（巴西在加时下半场进球数峰值是数据故事）
5. **比赛详情页**用 90 分钟 SVG 时间轴展示进球/换人/红黄牌
6. **所有页面顶部相同的导航条** + 右上角语言切换按钮

---

## 8 · 工作流（重要）

项目所有人采用迭代节奏：

1. Claude Code 给出**视觉 mockup**（HTML 单文件，能浏览器直接打开）
2. 项目所有人审视效果
3. 确认/调整
4. 进入下一页
5. **全部 15 页都过完后**，再一次性打包所有 HTML / data-needs / i18n.json

这意味着：**不要每页都立刻产出 i18n.json 和 data-needs.md** —— 先把视觉做对，到最后冲刺阶段再批量整理交付文件。

唯一例外：`01-homepage/` 已经按全套交付（作为模板存在）。

---

## 9 · 下一步要做什么

**当前在做：页面 #2 历届赛事列表**

要求：
- 22 届列表，每行展示：年份（大字）/ 主办国 + 球场数 / 冠军 ISO+名 / 亚军 ISO+名 / 球队数 / 进球数
- 顶部年代筛选（10 年代分组）
- 可按年份/冠军/进球数/上座率排序
- 点击单届跳到该届详情页（页面 #3 模板）

数据从 Fjelstul `tournaments` + `tournament_standings` + `host_countries` 三张表 join。

**视觉先做出来给项目所有人看，再继续 #3。**

---

## 10 · 还没拍板的小事

这些等具体做到时再定，不阻塞：

- **Page 12 球场页要不要地图**：240 座球场分布在 30+ 国家。简单方案是按主办国分组列表，复杂方案是 D3 世界地图+点。先按列表做，搭档觉得不够再升级
- **Page 14 奖项页颗粒度**：`awards` 只有 8 项，`award_winners` 200 条。可能合并到一页，也可能按奖项分页
- **黑暗模式默认**：djyydata 是否有黑暗模式？所有 Tailwind 类已经带 `dark:` 前缀，准备就绪

---

## 11 · 字典 / 共享资源

后续 ETL 会用到的共享资源（还没做，等接手者根据需要建）：

- `data/dict/teams.json` — 80 国 ISO 代码 ↔ 中英文名 ↔ 大洲 ↔ FIFA 加入年份
- `data/dict/stages.json` — 阶段名（group / R16 / QF / SF / F / 3rd / opener）↔ 中英文
- `data/dict/tournaments.json` — 22 届（年 + 主办 + 冠军 + 中英短名）

中文翻译可以由 Claude Code 一次性生成英文 → 中文，项目所有人审一遍即可。

---

**结束。有任何前提条件不清楚的，问项目所有人，不要靠猜。**
