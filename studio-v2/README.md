# Prompt Lab 2.0 architecture

這個目錄只建立未來擴充骨架，不取代也不耦合 Prompt Lab 1.0。

## 目前狀態

- 所有 2.0 功能旗標預設為 `false`。
- 正式網站的畫面、提示詞組合、卡片 CRUD、圖片庫與一鍵生圖流程不會改變。
- Preview、AI 推薦、Layer、Renderer 與 Plugin 都只是介面或 Placeholder，尚未串接外部 API。

## 功能開關

功能定義集中在 `config.js`。測試單一模組時，可在 `bootstrap.js` 載入前設定：

```html
<script>
  window.MUMU_STUDIO_V2_FEATURE_OVERRIDES = {
    preview: true,
    assetManager: true
  };
</script>
```

沒有設定 override 時，頁面不會建立任何 2.0 UI。

## 邊界

- `core/`：資料契約、事件與模組生命週期。
- `modules/`：可個別開關的功能模組。
- `renderers/`：SVG / HTML Renderer Interface。
- `plugins/`：外部 AI Provider Adapter Interface。
- `bootstrap.js`：唯一啟動入口與公開 API。

後續正式開發功能時，每次只實作一個模組，並維持對 Prompt Lab 1.0 的單向、鬆耦合整合。
