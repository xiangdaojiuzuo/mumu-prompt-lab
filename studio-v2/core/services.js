import { createAsset, createLayer } from "./contracts.js";

export class AssetStore {
  #assets = new Map();

  add(assetInput) {
    const asset = createAsset(assetInput);
    this.#assets.set(asset.id, asset);
    return asset;
  }

  list({ type, search = "", favorite } = {}) {
    const keyword = search.trim().toLocaleLowerCase("zh-Hant");
    return [...this.#assets.values()].filter((asset) => {
      if (type && asset.type !== type) return false;
      if (typeof favorite === "boolean" && asset.favorite !== favorite) return false;
      if (!keyword) return true;
      return [asset.title, asset.description, ...asset.tags].join(" ").toLocaleLowerCase("zh-Hant").includes(keyword);
    });
  }

  remove(id) {
    return this.#assets.delete(String(id));
  }
}

export class LayerStore {
  #layers = [];

  add(layerInput) {
    const layer = createLayer(layerInput);
    if (this.#layers.some((item) => item.id === layer.id)) throw new Error(`圖層已存在：${layer.id}`);
    this.#layers.push(layer);
    return layer;
  }

  list() {
    return [...this.#layers];
  }

  remove(id) {
    const index = this.#layers.findIndex((layer) => layer.id === String(id));
    if (index < 0) return false;
    this.#layers.splice(index, 1);
    return true;
  }
}

export class PromptExtensionStore {
  #history = [];
  #favorites = new Set();
  #templates = new Map();

  addHistory(entry) {
    this.#history.unshift(Object.freeze({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...entry }));
    return this.#history[0];
  }

  listHistory() {
    return [...this.#history];
  }

  setFavorite(id, favorite = true) {
    favorite ? this.#favorites.add(String(id)) : this.#favorites.delete(String(id));
  }

  saveTemplate(name, data) {
    this.#templates.set(String(name), structuredClone(data));
  }

  exportJSON() {
    return JSON.stringify({ history: this.#history, favorites: [...this.#favorites], templates: [...this.#templates] }, null, 2);
  }
}
