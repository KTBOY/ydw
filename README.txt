塔罗占卜动态图标 / Sprite Sheet

文件说明
- tarot-divination-icon.png：静态高清图标，透明背景。
- tarot-divination-sprite.png：微信小程序可用的横向精灵图。每格 128×128px；28 个独立动画帧，末尾额外重复第 1 帧以便循环收口，所以共 29 格。
- tarot-divination-sprite-grid.png：28 帧预览排版（7 列 × 4 行），方便检查/二次编辑。
- tarot-divination-preview.gif：循环动图预览。
- tarot-divination-preview.png：APNG 预览，保留完整透明度。

微信小程序接入
1. 将 tarot-divination-sprite.png 放到小程序项目的 /assets/ 目录。
2. 将 tarot-icon.wxml 放入需要展示图标的页面。
3. 将 tarot-icon.wxss 合并到页面样式中。

注意：示例用 Sprite Sheet + steps(28) 播放。目标基础尺寸为 128rpx；可同时调整 width/height、background-size 和 background-position。若需最稳妥兼容不同小程序基础库/组件，可使用 GIF 预览文件作为普通 image 资源，但需要在目标机型上实测动画播放表现。
