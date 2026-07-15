import { STUDIO_V2_VERSION, FEATURE_DEFINITIONS, createFeatureFlags } from "./config.js";
import { ModuleRegistry, StudioKernel } from "./core/kernel.js";
import { AssetStore, LayerStore, PromptExtensionStore } from "./core/services.js";
import { RendererRegistry, svgRenderer, htmlRenderer } from "./renderers/registry.js";
import { PluginRegistry, PLANNED_PLUGIN_PROVIDERS } from "./plugins/registry.js";
import { registerPlannedModules } from "./modules/catalog.js";

const flags = createFeatureFlags();
const modules = registerPlannedModules(new ModuleRegistry(), FEATURE_DEFINITIONS);
const renderers = new RendererRegistry().register(svgRenderer).register(htmlRenderer);

const kernel = new StudioKernel({
  version: STUDIO_V2_VERSION,
  flags,
  modules,
  services: {
    assets: new AssetStore(),
    layers: new LayerStore(),
    prompts: new PromptExtensionStore(),
    plugins: new PluginRegistry(),
    renderers,
    plannedPluginProviders: PLANNED_PLUGIN_PROVIDERS,
  },
});

await kernel.start();

// 唯一公開入口；未來模組透過此入口協作，不直接耦合 Prompt Lab 1.0 的 app.js。
globalThis.mumuPromptStudioV2 = Object.freeze({
  version: STUDIO_V2_VERSION,
  getStatus: () => kernel.getStatus(),
  services: kernel.services,
});
