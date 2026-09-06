Page({
  data: {
    tabs: ["今日推荐", "轻氛围", "抽象光影", "古风", "明星偶像", "可爱治愈"],
    currentTab: 0,
    leftList: [], // 左列图片
    rightList: [], // 右列图片
    leftH: 0, // 左列总高度
    rightH: 0, // 右列总高度
    loading: false, // 是否正在加载
  },

  // 页面初始化，加载瀑布流图片
  onLoad() {
    this.loadMore();
  },

  // 切换Tab时，重新加载相关内容
  switchTab(e) {
    this.setData({
      currentTab: e.currentTarget.dataset.index,
      leftList: [],
      rightList: [],
      leftH: 0,
      rightH: 0
    });
    this.loadMore();
  },

  // 加载更多图片
  async loadMore() {
    if (this.data.loading) return; // 防止重复加载
    this.setData({
      loading: true
    });

    // 模拟获取图片（真实环境会是 API 调用）
    const res = await this.fetchWallpapers(); // 替换为你自己的 API 调用

    res.forEach(url => {
      let fakeH = 400 + Math.random() * 200; // 假设图片的随机高度
      // 确定插入左列还是右列
      if (this.data.leftH <= this.data.rightH) {
        this.setData({
          leftList: [...this.data.leftList, url],
          leftH: this.data.leftH + fakeH
        });
      } else {
        this.setData({
          rightList: [...this.data.rightList, url],
          rightH: this.data.rightH + fakeH
        });
      }
    });

    this.setData({
      loading: false
    });
  },

  // 模拟 API 获取壁纸图片 URL (实际可以调用你自己的 API)
  async fetchWallpapers() {
    // 这里使用纯数组的格式（从你的 API 返回）
    return [
      "https://tvax3.sinaimg.cn/large/0072Vf1pgy1foxlo0cwkej31kw0w0dzj.jpg",
      "https://tvax3.sinaimg.cn/large/0072Vf1pgy1foxkd5scpnj31kw0w0h93.jpg",
      "https://tvax3.sinaimg.cn/large/0072Vf1pgy1foxli80mamj31hc0u0kcw.jpg",
      "https://tvax3.sinaimg.cn/large/0072Vf1pgy1foxlhdcvy8j31hc0u07iz.jpg",
      "https://tvax3.sinaimg.cn/large/a15b4afegy1fmvjf7mg26j21hc0u0ne6.jpg"
    ];
  },

  // 滚动到页面底部，加载更多
  onReachBottom() {
    this.loadMore();
  }
});