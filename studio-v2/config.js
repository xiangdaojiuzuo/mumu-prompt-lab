export const STUDIO_V2_VERSION = "2.0.0-architecture";

export const FEATURE_DEFINITIONS = Object.freeze({
  visualCards: { label: "視覺化卡片", stage: "future" },
  preview: { label: "即時預覽", stage: "placeholder" },
  aiRecommendations: { label: "AI 智慧推薦", stage: "future" },
  layerManager: { label: "圖層系統", stage: "interface" },
  assetManager: { label: "素材庫", stage: "interface" },
  rendererInterfaces: { label: "SVG / HTML Renderer", stage: "interface" },
  pluginSystem: { label: "Plugin System", stage: "interface" },
  promptBuilderExtensions: { label: "Prompt Builder 擴充", stage: "future" },
});

export const DEFAULT_FEATURE_FLAGS = Object.freeze(
  Object.fromEntries(Object.keys(FEATURE_DEFINITIONS).map((key) => [key, false]))
);

/**
 * 正式環境預設全部關閉，確保 Prompt Lab 1.0 的畫面與流程完全不變。
 * 未來可在載入 bootstrap 前設定：
 * window.MUMU_STUDIO_V2_FEATURE_OVERRIDES = { preview: true };
 */
export function createFeatureFlags(overrides = globalThis.MUMU_STUDIO_V2_FEATURE_OVERRIDES) {
  const safeOverrides = overrides && typeof overrides === "object" ? overrides : {};
  return Object.freeze(Object.fromEntries(
    Object.keys(FEATURE_DEFINITIONS).map((key) => [
      key,
      typeof safeOverrides[key] === "boolean" ? safeOverrides[key] : DEFAULT_FEATURE_FLAGS[key],
    ])
  ));
}
