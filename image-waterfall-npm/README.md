# image-waterfall

> 微信小程序通用「图片瀑布流」组件 —— **预留高度防抖动 + 骨架屏 + 淡入 + 多列分配 + 触底加载**。

不依赖任何第三方库或 UI 框架，纯原生 `<image>` 实现。通过 CSS 变量即可主题化，适配深色 / 浅色页面。

## 特性

- **零布局抖动**：图片返回前用「确定性宽高比」预留高度，加载前后高度一致，彻底消除 CLS 跳动。
- **高端骨架屏**：底色 + 斜向流光 + 中心微光，图片加载完成后平滑淡入。
- **多列瀑布流**：支持任意列数（默认 2 列），按「最矮列优先」分配，排布均衡。
- **触底加载 & 切换重建**：内置无限滚动事件；切换分类/搜索时整体原子替换并自动回到顶部（无中间空白闪烁）。
- **加载失败回退**：可配置回退字段（如缩略图），失败自动降级，避免骨架一直转。
- **数据灵活**：数组元素可为对象（可配置取值字段）或直接是图片 URL 字符串。
- **主题化**：通过 CSS 自定义属性控制圆角、间距、卡片背景、骨架配色、标题样式等。

## 安装

### 方式一：npm（推荐）

```bash
npm i miniprogram-image-waterfall
```

安装后在微信开发者工具执行「工具 → 构建 npm」，然后在页面/组件的 `.json` 注册：

```json
{
  "usingComponents": {
    "image-waterfall": "miniprogram-image-waterfall/image-waterfall/image-waterfall"
  }
}
```

### 方式二：手动拷贝

将 `image-waterfall/` 目录拷贝到项目的 `components/` 下，在页面或组件的 `.json` 中注册：

```json
{
  "usingComponents": {
    "image-waterfall": "/components/image-waterfall/image-waterfall"
  }
}
```

> 组件根节点是一个 `scroll-view`，高度取父容器。请给它一个确定高度（如在 flex 纵向布局中设 `flex:1; min-height:0`）。

## 快速使用

```html
<view class="page">
  <image-waterfall
    class="flow"
    list="{{list}}"
    reset-token="{{token}}"
    image-key="url"
    title-key="name"
    bind:itemtap="onItemTap"
    bind:loadmore="onLoadMore"
  >
    <!-- 默认插槽渲染在列表底部：放 loading / 空态 / 没有更多 -->
    <view wx:if="{{loading}}" class="tip">加载中…</view>
  </image-waterfall>
</view>
```

```css
.page { height: 100vh; display: flex; flex-direction: column; }
.flow { flex: 1; min-height: 0; }
```

```js
Page({
  data: { list: [], token: 0, loading: false },

  onLoad() { this.reload() },

  async reload() {
    const data = await fetchData(/* page 1 */)
    // 切换分类/搜索：更新数据并「改变 reset-token」触发重建+回顶
    this.setData({ list: data, token: this.data.token + 1 })
  },

  onLoadMore() {
    // 加载更多：往 list 尾部追加，组件自动增量渲染
    fetchData(/* next page */).then((more) => {
      this.setData({ list: this.data.list.concat(more) })
    })
  },

  onItemTap(e) {
    const item = e.detail.item // 原始数据项
    // 跳转详情等
  },
})
```

### 约定（重要）

- **加载更多** → 往 `list` 尾部 `concat` 新数据，`reset-token` 保持不变，组件只渲染新增部分。
- **切换分类 / 搜索** → 更新 `list` 的同时**改变 `reset-token`**（如 +1），组件整体重建并回到顶部。

## 属性 Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `list` | Array | `[]` | 数据源，元素为对象或图片 URL 字符串 |
| `columns` | Number | `2` | 列数 |
| `gap` | Number | `20` | 间距(rpx)，用于外边距/列间距/卡片下边距 |
| `image-key` | String | `src` | 取图片 URL 的字段名（元素为字符串时忽略） |
| `fallback-key` | String | `thumb` | 图片加载失败时回退的字段名 |
| `title-key` | String | `title` | 标题字段名 |
| `show-title` | Boolean | `true` | 是否展示标题 |
| `ratios` | Array | 内置 | 预留宽高比集合，如 `[0.72,1,1.3]`；越多档错落越丰富 |
| `reset-token` | any | `0` | 值变化即整体重建并回到顶部 |
| `lower-threshold` | Number | `120` | 触底触发距离(px) |

## 事件 Events

| 事件 | 触发时机 | `event.detail` |
|---|---|---|
| `itemtap` | 点击某张图 | `{ item, index }`，`item` 为原始数据项 |
| `loadmore` | 滚动触底 | 无（父组件负责取下一页并追加到 `list`） |

## 插槽 Slots

- **默认插槽**：渲染在瀑布流底部（滚动容器内），用于放置 `加载中` / `空状态` / `没有更多` 等提示。

## 主题（CSS 变量）

自定义属性会穿透组件边界，在**父级**给组件设置即可生效：

```css
.flow {
  --wf-radius: 16rpx;
  --wf-card-bg: #0f1526;
  --wf-card-border: 1rpx solid rgba(255,255,255,.06);
  --wf-skeleton-base: #121a2e;
  --wf-skeleton-shine: rgba(255,255,255,.07);
  --wf-skeleton-glow: rgba(59,130,246,.22);
  --wf-fade: .45s;
  --wf-title-color: #cbd5e1;
  --wf-title-size: 22rpx;
}
```

| 变量 | 默认值 | 说明 |
|---|---|---|
| `--wf-gap` | 取 `gap` 属性 | 间距 |
| `--wf-radius` | `16rpx` | 卡片圆角 |
| `--wf-card-bg` | `transparent` | 卡片背景 |
| `--wf-card-border` | 无 | 卡片边框 |
| `--wf-skeleton-base` | `#edf0f5` | 骨架底色 |
| `--wf-skeleton-shine` | `rgba(255,255,255,.55)` | 骨架流光色 |
| `--wf-skeleton-glow` | `rgba(0,0,0,.05)` | 骨架中心微光 |
| `--wf-fade` | `.45s` | 图片淡入时长 |
| `--wf-title-color` | `#333` | 标题颜色 |
| `--wf-title-size` | `24rpx` | 标题字号 |

## 数据格式

元素既可以是对象，也可以是字符串：

```js
// 对象（可配置字段名）
{ url: 'https://.../large.jpg', thumb: 'https://.../thumb.jpg', name: '标题', /* ...任意业务字段 */ }
// 字符串（直接作为图片地址）
'https://.../pic.jpg'
```

`itemtap` 返回的 `item` 即原始元素，业务字段原样透传。

## 说明与取舍

- 组件采用 `mode="aspectFill"` 填充预留框，因此**会按预留宽高比轻微裁切**。这是在「无真实尺寸也要零抖动」前提下的取舍，缩略图流场景观感最佳。
- 若接口能提供真实宽高，可自行扩展：把每项真实比例传入并跳过 `ratios` 随机档，即可做到不裁切且不抖动。
- 动画均基于 `transform` / `opacity`，GPU 合成，长列表滚动流畅。

## 兼容性

- 依赖 `scroll-view`、原生 `image` 的 `lazy-load` / `mode="aspectFill"`、CSS 自定义属性与 `@keyframes`，主流基础库均支持。

## License

MIT
