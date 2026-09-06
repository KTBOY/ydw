# AGENTS.md

> 面向 AI 编码代理的项目说明。基于本仓库实际结构与踩坑经验整理，改动代码前请先通读「小程序特有约束」。

## 项目概述
- 微信小程序，基于 **TDesign 小程序 Starter（零售版）** 二次开发（`@tencent/tdesign-miniprogram-starter-retail`）。
- AppID：`wxebd883a58cd230c5`；基础库：`project.config.json` 中 `libVersion` 为 `3.8.9`（README 标注最低 `^2.6.5`）。
- 已在此基础上扩展了多个功能分包（工具集、星座、壁纸、游戏中心等）。

## 技术栈
- 视图层：WXML / WXSS / JS（部分 `.wxs`）；组件库 **tdesign-miniprogram**（优先用 `t-swiper`/`t-search`/`t-image`/`t-icon` 等，避免原生重复造轮子）。
- 依赖：`dayjs`、`node-xlsx`、`tslib`、`weapp-qrcode`（见 `package.json`）。
- 模块规范：源码使用 ES Module（`import`/`export`）。

## 环境与构建
1. `npm install`
2. 用**微信开发者工具**导入本工程（根目录）。
3. 工具菜单执行 **「构建 npm」**（生成/更新 `miniprogram_npm/`）。**每次增删依赖后都要重新构建 npm。**
- Node 建议 `>=14`。
- 常用脚本（`package.json`）：
  - `npm run lint` —— `eslint --cache --fix --ext .js`
  - `npm run check` —— `node config/eslintCheck.js`
  - `npm run prepare` —— 安装 husky 钩子
  - `npm run changelog` —— 生成 CHANGELOG

## 目录结构
```
app.js / app.json / app.wxss     入口与全局配置（pages / subPackages / preloadRule / window）
components/                      公共自定义组件（custom-tab-bar、menu、fund、game-center、url-copy...）
pages/                           主包页面（home、rj、phone、cg、goods/*、order/baidu、my_module/*）
config/                          基础配置与 eslint 检查脚本
model/                           mock 数据
services/                        请求接口封装
api/                             业务 API（bi/fund/video/xingzuo 等）
utils/                           工具库（util、common_utils、gameUtils、gameList/*、downLoadVideo...）
style/                           公共样式与 iconfont
i18n/                            多语言
asserts/                         静态资源（见下方“注意”，此目录名为拼写错误但已是约定）
miniprogram_npm/                 构建 npm 产物（勿手改）
packageA/ xingzuo/ bz/ game/     功能分包
```

## 分包（见 `app.json` 的 `subPackages`）
- `packageA/`：绑定、弹幕、量尺、二维码、视频下载、震动、基金页等工具集。
- `xingzuo/`：十二星座。
- `bz/`：壁纸。
- `game/`：游戏中心分包
  - `pages/list`：游戏下载库（数据源 `asserts/json/gemes.json`），`pages/detail`：网盘链接展示（复用 `/components/url-copy/url`）。
  - `pages/arrowEscape`：可玩小游戏「箭头逃脱」（Canvas 2D）。`levels.js`=100 关（逆向构造生成、全部可解）；`audio.js`=音效管理（音频池+静音开关）；`index.*`=主逻辑/渲染/动画（QQ 农场风格：静态场景走 OffscreenCanvas 离屏缓存，糖果质感箭头/星级/关卡选择，美术规格见 `pages/arrowEscape/DESIGN.md`）。
  - `pages/sudoku`：可玩小游戏「数独 · 雅集」（WXML 网格，**非 Canvas**，无原生层遮挡问题）。`core.js`=种子化确定性关卡生成器 + 位运算求解器（纯函数、可在 Node 单测唯一解/确定性）；`audio.js`=音效管理；进度/战绩/设置存 `wx.storage`（`sudokuSave`/`sudokuProgress`/`sudokuRecords`/`sudokuSettings`）；美术设计文档见 `pages/sudoku/DESIGN.md`；内置修改器在设置弹框内用 switch 开关直接启停（关闭主开关会复位作弊状态；用修改器赢的局不计战绩）。
  - `game/images/`、`game/audio/arrow/`、`game/audio/sudoku/`：游戏图片与音效（**放在分包以控制主包体积**）。
- 首页底部 `custom-tab-bar` 是**内容切换器**（非真实分包跳转）：`currIndex` 0=首页(`menu`)、1=基金(`fund`)、2=游戏中心(`game-center` 组件)。凹槽默认 `mode="canvas"`（底栏剪影 + 相切凹唇 + 半圆缺口与圆钮在 canvas 2d 上**同帧**绘制，缺口真实镂空、页面背景任意；切 tab 用单个 rAF 补间驱动两者，缓动取 CSS ease 贝塞尔避免与图标 CSS 过渡脱节；画布上探 70rpx 容纳圆钮上半部，rAF 仅动画期间占用；`fillet-rpx` 可自定义凹唇半径，默认 28rpx、0 = 纯半圆；开发者工具模拟器 canvas 非同层会盖住 tab 项，自动降级为 concave 观感，真机不受影响）；`mode="concave"` 为旧版伪类光圈方案，要求 item `pageBg` 与页面背景同色。

## 代码规范
- **ESLint + Prettier**（`.eslintrc.js` extends `plugin:prettier/recommended`）：2 空格缩进、`linebreak-style: unix`、`prefer-const`、`eqeqeq`、`camelcase`、`no-console`（仅允许 `warn`/`error`）。
- 全局变量已在 eslint 中声明（`wx`/`App`/`Page`/`Component`/`getApp` 等），无需 import。
- ESLint 仅作用于 `.js`；`.wxml/.json/.css/.less` 由 Prettier 处理；`.wxs` 被忽略。
- 组件 `usingComponents` 用绝对路径（如 `/components/url-copy/url`）；分包页面可引用主包组件/工具（sub→main 允许）。
- 写文件时**不要输出行号前缀**，保持与周围代码一致的缩进与风格。

## 提交规范
- 使用 **Conventional Commits**（`commitlint` + `@commitlint/config-conventional`）。
- husky 钩子：`pre-commit` 跑 `lint-staged`（eslint --fix + prettier --write），`commit-msg` 校验提交信息。
- 未经用户明确要求，**不要擅自 `git commit`**。

## 验证方式
- 项目**无自动化测试**（`npm test` 为占位）。改动后：
  - JS（ESM）语法自检：把目标 `.js` 复制成临时 `.mjs` 后 `node --check`（因源码用 `import/export`，直接 `node --check .js` 会误报）。
  - JSON 用 `JSON.parse` 校验；关卡等数据可用 Node 脚本跑校验器（如「箭头逃脱」的可解性校验）。
  - 最终以**微信开发者工具编译 + 真机预览**为准（画布、音效、震动、原生组件层级只有真机/模拟器可验证）。

## ⚠️ 小程序特有约束（改动前必读）
1. **资源目录名是 `asserts/`（assets 的拼写错误，但已是既定约定）**，勿改名。游戏真实数据在 `asserts/json/gemes.json`；`utils/gameList/json.js` 为空/历史遗留。
2. **主包 → 分包资源**：主包页面/组件在分包下载前无法访问分包内文件。若主包组件要用分包资源（如首页 `game-center` 卡片用 `game/images/` 封面），需在 `app.json` 配 `preloadRule` 预下载（本项目已对 `pages/home/home` 预下载 `game`）。
3. **`<canvas type="2d">` 是原生组件**：同层渲染在部分机型失效时会盖住普通 `<view>` 弹窗。约定做法：弹窗显示时给 canvas 加 `hidden`，关闭后主动 `draw()` 重绘。
4. **Canvas 触摸坐标**：用 `touch.clientX/clientY` 减去画布 `boundingClientRect`（selector query `fields({rect:true})`）换算，**不要用 `touch.x/y`**（2D canvas 上常为 `undefined`）。
5. **Canvas 渲染循环**：仅在有动画时跑 `requestAnimationFrame`，空闲即停，避免持续占用 CPU/耗电。
6. **音效**：用 `wx.createInnerAudioContext()` 播放本地 WAV；高频音效用小音频池支持重叠；`obeyMuteSwitch=false` 并提供应用内静音开关；`onUnload` 释放。
7. **网络与外部资源**：微信要求配置**合法域名**白名单；境外资源（如 NASA/JPL）可能 403/防盗链。推荐**先下载再托管到自有 COS/OSS**（可配合 GitHub Actions 定时同步，零成本），小程序只读自家 CDN。
8. `miniprogram_npm/` 是构建产物，**不要手动编辑**。

## 新增页面 / 分包页
- 新页面：`pages/` 下建文件夹（`.js/.json/.wxml/.wxss`）→ 在 `app.json` 的 `pages` 数组登记 →（可选）在 `project.config.json` 的调试 condition 里加入口。
- 分包页：在对应分包目录下建页面 → 在 `app.json` 该分包的 `pages` 数组登记（路径相对分包 root）。
