import { assertPlugin } from "../core/contracts.js";

export class PluginRegistry {
  #plugins = new Map();

  register(plugin) {
    assertPlugin(plugin);
    if (this.#plugins.has(plugin.id)) throw new Error(`Plugin 已存在：${plugin.id}`);
    this.#plugins.set(plugin.id, plugin);
    return this;
  }

  get(id) {
    return this.#plugins.get(String(id)) || null;
  }

  findByCapability(capability) {
    return [...this.#plugins.values()].filter((plugin) => plugin.capabilities.includes(capability));
  }

  list() {
    return [...this.#plugins.values()].map(({ id, name, capabilities }) => ({ id, name, capabilities: [...capabilities] }));
  }
}

export const PLANNED_PLUGIN_PROVIDERS = Object.freeze(["OpenAI GPT", "GPT Image", "Codex", "Grok", "Gemini", "Claude"]);
