const moduleCopy = {
  visualCards: ["視覺化卡片", "表情、服裝、場景、動作、構圖、光線與配件卡的 Grid / List View 預留區。"],
  preview: ["Preview", "人物＋服裝＋表情＋背景的即時預覽預留區。"],
  aiRecommendations: ["AI 幫我搭配", "推薦介面已預留，尚未連接任何 AI。"],
  layerManager: ["Layer Manager", "人物、背景、前景、特效與文字圖層介面預留區。"],
  assetManager: ["Asset Manager", "素材搜尋、分類、收藏與 Tag 介面預留區。"],
  rendererInterfaces: ["Renderer Interfaces", "SVG Renderer 與 HTML Renderer 目前只建立介面。"],
  pluginSystem: ["Plugin System", "GPT、GPT Image、Codex、Grok、Gemini、Claude 接頭預留區。"],
  promptBuilderExtensions: ["Prompt Builder 2.0", "History、Favorite、Version、Template、Import、Export、JSON 預留區。"],
};

function placeholderModule(feature, stage) {
  return {
    id: `studio-v2-${feature}`,
    feature,
    stage,
    mount({ getRoot }) {
      const root = getRoot();
      const [title, description] = moduleCopy[feature];
      const article = document.createElement("article");
      article.className = "studio-v2-placeholder";
      article.dataset.studioV2Module = feature;
      article.innerHTML = `<p class="eyebrow">Prompt Lab 2.0</p><h2>${title}</h2><p>${description}</p><small>目前為架構預留，不會影響 Prompt Lab 1.0。</small>`;
      root.append(article);
      return () => article.remove();
    },
  };
}

export function registerPlannedModules(registry, definitions) {
  Object.entries(definitions).forEach(([feature, metadata]) => registry.register(placeholderModule(feature, metadata.stage)));
  return registry;
}
