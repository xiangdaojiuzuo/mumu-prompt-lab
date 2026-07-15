export const ASSET_TYPES = Object.freeze([
  "expression",
  "outfit",
  "pose",
  "scene",
  "composition",
  "lighting",
  "accessory",
]);

export const LAYER_TYPES = Object.freeze(["character", "background", "foreground", "effect", "text"]);
export const PLUGIN_CAPABILITIES = Object.freeze(["chat", "recommend", "image.generate", "image.edit", "code"]);

function requiredText(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${fieldName} 必須是非空白文字`);
  return value.trim();
}

export function createAsset(input) {
  const type = requiredText(input?.type, "asset.type");
  if (!ASSET_TYPES.includes(type)) throw new TypeError(`不支援的素材類型：${type}`);
  return Object.freeze({
    id: requiredText(input.id, "asset.id"),
    type,
    title: requiredText(input.title, "asset.title"),
    description: String(input.description || "").trim(),
    thumbnail: String(input.thumbnail || "").trim(),
    tags: Object.freeze([...(input.tags || [])].map(String)),
    favorite: Boolean(input.favorite),
    payload: Object.freeze({ ...(input.payload || {}) }),
  });
}

export function createLayer(input) {
  const type = requiredText(input?.type, "layer.type");
  if (!LAYER_TYPES.includes(type)) throw new TypeError(`不支援的圖層類型：${type}`);
  return Object.freeze({
    id: requiredText(input.id, "layer.id"),
    type,
    name: requiredText(input.name, "layer.name"),
    visible: input.visible !== false,
    locked: Boolean(input.locked),
    source: input.source ?? null,
  });
}

export function assertPlugin(plugin) {
  requiredText(plugin?.id, "plugin.id");
  requiredText(plugin?.name, "plugin.name");
  if (!Array.isArray(plugin.capabilities)) throw new TypeError("plugin.capabilities 必須是陣列");
  const invalid = plugin.capabilities.find((capability) => !PLUGIN_CAPABILITIES.includes(capability));
  if (invalid) throw new TypeError(`不支援的 Plugin capability：${invalid}`);
  if (typeof plugin.connect !== "function") throw new TypeError("plugin.connect 必須是函式");
  return plugin;
}
