// packageA/pages/fundSearch/fundSearch.js
import { baseRanking } from "../../../api/fund.api";

const SEARCH_HISTORY_KEY = "fund_search_history";

const RANKING_FALLBACK = [
  { code: "014352", name: "东方创新成长混合A", type: "2026-04-08", netValue: "1.3228", dayChange: 11.1 },
  { code: "014353", name: "东方创新成长混合C", type: "2026-04-08", netValue: "1.2943", dayChange: 11.1 },
  { code: "009317", name: "金信核心竞争力混合A", type: "2026-04-08", netValue: "1.2652", dayChange: 10.7 },
  { code: "020064", name: "西部利得科技创新混合A", type: "2026-04-08", netValue: "1.801", dayChange: 10.15 },
  { code: "020065", name: "西部利得科技创新混合C", type: "2026-04-08", netValue: "1.7844", dayChange: 10.14 },
  { code: "016388", name: "汇安均衡成长混合A", type: "2026-04-08", netValue: "1.6669", dayChange: 9.98 },
  { code: "016389", name: "汇安均衡成长混合C", type: "2026-04-08", netValue: "1.6484", dayChange: 9.98 },
  { code: "005358", name: "东方阿尔法精选混合A", type: "2026-04-08", netValue: "0.8224", dayChange: 9.89 },
  { code: "005359", name: "东方阿尔法精选混合C", type: "2026-04-08", netValue: "0.79", dayChange: 9.87 },
  { code: "018463", name: "德邦稳盈增长灵活配置混合C", type: "2026-04-08", netValue: "1.0201", dayChange: 9.23 },
  { code: "004260", name: "德邦稳盈增长灵活配置混合A", type: "2026-04-08", netValue: "1.0346", dayChange: 9.23 },
  { code: "013721", name: "信澳景气优选混合A", type: "2026-04-08", netValue: "2.0001", dayChange: 9.22 },
  { code: "013722", name: "信澳景气优选混合C", type: "2026-04-08", netValue: "1.9327", dayChange: 9.22 },
  { code: "001252", name: "中海进取收益混合", type: "2026-04-08", netValue: "1.257", dayChange: 9.21 },
  { code: "026476", name: "西部利得创新驱动鑫选混合发起C", type: "2026-04-08", netValue: "1.1229", dayChange: 9.2 },
];

function pickRankingList(response) {
  const candidates = [
    response?.data?.ranking,
    response?.data?.data?.ranking,
    response?.ranking,
    response?.data,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    if (Array.isArray(candidates[i])) {
      return candidates[i];
    }
  }
  return [];
}

function normalizeRankingItem(item, index) {
  const dayChangeNumber = Number(item?.dayChange);
  const safeDayChange = Number.isFinite(dayChangeNumber) ? dayChangeNumber : 0;
  const dayChangeText = `${safeDayChange >= 0 ? "+" : ""}${safeDayChange.toFixed(2)}%`;
  const changeClass = safeDayChange > 0 ? "up" : safeDayChange < 0 ? "down" : "flat";
  const rankClass = index < 3 ? `top-${index + 1}` : "normal";

  return {
    rank: index + 1,
    rankClass,
    changeClass,
    code: String(item?.code || "--"),
    name: String(item?.name || "--"),
    type: String(item?.type || "--"),
    netValue: String(item?.netValue ?? "--"),
    dayChangeText,
  };
}

Page({
  data: {
    searchValue: "",
    loading: false,
    noResult: false,
    errorMsg: "",
    updateDate: "",
    hotWords: [],
    searchHistory: [],
    rankingList: [],
    renderRanking: [],
  },

  onLoad() {
    this.initPage();
  },

  async initPage() {
    this.loadSearchHistory();
    await this.fetchRanking();
  },

  async fetchRanking() {
    this.setData({
      loading: true,
      errorMsg: "",
    });

    try {
      const response = await baseRanking();
      const ranking = pickRankingList(response);
      const source = ranking.length ? ranking : RANKING_FALLBACK;
      this.applyRanking(source);
    } catch (error) {
      console.error("fund ranking fetch failed:", error);
      this.applyRanking(RANKING_FALLBACK);
      this.setData({
        errorMsg: "接口加载失败，已展示本地数据",
      });
    } finally {
      this.setData({
        loading: false,
      });
    }
  },

  applyRanking(source) {
    const rankingList = source.map((item, index) => normalizeRankingItem(item, index));
    const hotWords = rankingList.slice(0, 8).map((item) => item.name);
    const updateDate = rankingList[0]?.type || "";

    this.setData({
      rankingList,
      hotWords,
      updateDate,
    });
    this.updateRenderList(this.data.searchValue);
  },

  updateRenderList(keyword = "") {
    const text = String(keyword || "").trim();
    const keywordLower = text.toLowerCase();
    const renderRanking = text
      ? this.data.rankingList.filter((item) => {
          const nameText = String(item.name || "").toLowerCase();
          const codeText = String(item.code || "");
          return nameText.includes(keywordLower) || codeText.includes(text);
        })
      : this.data.rankingList;

    this.setData({
      renderRanking,
      noResult: !this.data.loading && !renderRanking.length,
    });
  },

  onSearchInput(e) {
    const searchValue = e.detail.value || "";
    this.setData({ searchValue });
    this.updateRenderList(searchValue);
  },

  onSearchConfirm() {
    this.submitSearch();
  },

  onSearchSubmit() {
    this.submitSearch();
  },

  submitSearch() {
    const keyword = this.data.searchValue.trim();
    this.updateRenderList(keyword);
    if (keyword) {
      this.pushHistory(keyword);
    }
  },

  onTapHotWord(e) {
    const word = e.currentTarget.dataset.word || "";
    if (!word) {
      return;
    }
    this.setData({
      searchValue: word,
    });
    this.updateRenderList(word);
    this.pushHistory(word);
  },

  onTapHistoryWord(e) {
    const word = e.currentTarget.dataset.word || "";
    if (!word) {
      return;
    }
    this.setData({
      searchValue: word,
    });
    this.updateRenderList(word);
  },

  onTapRankingItem(e) {
    const name = e.currentTarget.dataset.name || "";
    if (name) {
      this.pushHistory(name);
    }
  },

  onClearHistory() {
    this.setData({
      searchHistory: [],
    });
    wx.removeStorageSync(SEARCH_HISTORY_KEY);
  },

  loadSearchHistory() {
    const history = wx.getStorageSync(SEARCH_HISTORY_KEY);
    this.setData({
      searchHistory: Array.isArray(history) ? history : [],
    });
  },

  pushHistory(keyword) {
    const safeKeyword = String(keyword || "").trim();
    if (!safeKeyword) {
      return;
    }

    const mergedHistory = [safeKeyword, ...this.data.searchHistory.filter((item) => item !== safeKeyword)].slice(0, 10);
    this.setData({
      searchHistory: mergedHistory,
    });
    wx.setStorageSync(SEARCH_HISTORY_KEY, mergedHistory);
  },
});
