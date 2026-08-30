# 塔罗占卜 · 设计稿交付说明

> 基准：375×812 设计稿（rpx = px × 2）· 字体 Noto Serif SC / 宋体 · v2.1 · 2026-08

## 文件清单

| 文件 | 内容 |
| --- | --- |
| `tarot-design-overview.png` | 全部页面 + 组件状态 + 规范 总览板 |
| `01-home-back.png` | 首页 · 未揭示（牌背态，轻触翻牌） |
| `02-home-revealed.png` | 首页 · 已揭示（牌面 + 铭牌 + 日期时间） |
| `03-history.png` | 历史 · 抽牌日历（✦ 标记抽牌日） |
| `04-profile.png` | 我的（统计 + 收藏/会员入口） |
| `05-saved.png` | 收藏之牌（三列网格） |
| `06-member.png` | 会员中心（权益卡 + 价格锚点） |
| `07-tabbar-states.png` | 底部按钮三态 + 切换爆发帧 + 动画时间轴 + 切图资源 |
| `08-spec-colors-type.png` | 规范 · 色彩与字体 |
| `09-spec-size-flow.png` | 规范 · 尺寸与交互结构 |
| `board.html` | 可交互查看的总览板源文件（浏览器直接打开） |

## 色彩

| 用途 | 值 |
| --- | --- |
| 背景（上→下） | `#0C0B0A` → `#070706` → `#060607` → `#071124` → `#04060E` |
| 蓝色光晕 | `rgba(30,62,118,.55)`（76% 高度处）/ `rgba(52,96,160,.5)`（右侧 72%） |
| 主金 / 亮金 | `#C9A84C` / `#E8D48B` |
| 光线金 / 描金边 | `#F6D884` / `#CAA45A` |
| 正文 / 次级 | `#E0DCD0` / `#8A8577` |
| 日期 / 时间 | `#B9C1CD` / `#CDBD8A` |
| 铭牌底 / 牌名带字 | `#07070A` / `#463A22` |

## 关键尺寸（rpx）

- 今日大卡 `477×767`；边框上19/侧32/下20；顶部卡名带高 56；四角雕花 58×58
- 底部铭牌：56% 宽，相对卡底边下探 46，双层描金（外 2rpx + 内嵌 5rpx）
- 两侧露卡 `142×812`（左右满贴屏幕边缘）
- 金币 `126×126`，间距 55，选中 scale 1.06，按下 scale 0.92；光线层外扩 36
- 底部标签 22rpx；日期 30rpx / 时间 27rpx；年份 31rpx（字距 10）

## 动画参数

| 名称 | 参数 | 说明 |
| --- | --- | --- |
| rays-spin | 22s linear infinite | 选中金币光线顺时针转动（2.2°线/13.5°隙） |
| rays-spin-rev | 34s linear infinite | 第二层稀疏光线反向转（1.6°/22.5°） |
| rays-pulse | 3.2s ease-in-out alternate | 光线呼吸 0.45→1 |
| rays-burst | 0.9s cubic-bezier(.16,.84,.44,1) | 切换瞬间光芒 scale .5→1.6 旋转 26° 淡出 |
| ring-burst | 0.75s ease-out | 切换瞬间金环 scale .6→1.75 淡出 |
| flip | 0.6s | 卡牌 rotateY 180° 翻面 |
| panel | 0.32s | 页面三面板 opacity + translateX(70rpx) |
| dealIn | 0.5s | 切月时新卡从上方落入 |

## 切图资源（`tarot/images/decor/`）

- `card-side-l/r.png` 两侧装饰卡（月徽/日徽）
- `rosette.png` 四角雕花（一张复用四角）
- `coin-home/history/profile.png` 金币选中态（金）
- `coin-home-gold / coin-profile-gold.png` 由暗币重着色的金色变体
- `coin-history-dark.png` 未选中暗银态
- 注：设计图顶部的暗色羽扇纹与文字重叠、无法干净切出，实现中省略（背景渐变已含光晕），如需还原需设计提供无字版素材。

## 待同步项

- 会员页代码文案 `Full Access` 应按设计稿改为「会员中心」。
- 真机注意：conic-gradient 光线在个别旧机型不支持时自动无光线降级，不影响布局。
