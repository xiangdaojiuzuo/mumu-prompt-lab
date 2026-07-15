import assert from "node:assert/strict";
import { DEFAULT_FEATURE_FLAGS, FEATURE_DEFINITIONS, createFeatureFlags } from "../studio-v2/config.js";
import { createAsset, createLayer } from "../studio-v2/core/contracts.js";
import { ModuleRegistry, StudioKernel } from "../studio-v2/core/kernel.js";
import { AssetStore, LayerStore } from "../studio-v2/core/services.js";
import { registerPlannedModules } from "../studio-v2/modules/catalog.js";
import { PluginRegistry } from "../studio-v2/plugins/registry.js";
import { RendererRegistry, svgRenderer, htmlRenderer } from "../studio-v2/renderers/registry.js";

assert.equal(Object.keys(DEFAULT_FEATURE_FLAGS).length, Object.keys(FEATURE_DEFINITIONS).length);
assert.ok(Object.values(DEFAULT_FEATURE_FLAGS).every((enabled) => enabled === false));
assert.equal(createFeatureFlags({ preview: true, unknown: true }).preview, true);
assert.equal("unknown" in createFeatureFlags({ unknown: true }), false);

const asset = createAsset({ id: "scene-beach", type: "scene", title: "海邊", tags: ["夏日"] });
const assets = new AssetStore();
assets.add(asset);
assert.equal(assets.list({ search: "夏日" }).length, 1);

const layers = new LayerStore();
layers.add(createLayer({ id: "character", type: "character", name: "沐沐" }));
assert.equal(layers.list().length, 1);

const plugins = new PluginRegistry();
plugins.register({ id: "test", name: "Test", capabilities: ["chat"], connect: async () => ({}) });
assert.equal(plugins.findByCapability("chat").length, 1);

const renderers = new RendererRegistry().register(svgRenderer).register(htmlRenderer);
assert.equal(renderers.find("svg")?.id, "svg-renderer");
assert.equal(renderers.find("html")?.id, "html-renderer");

const modules = registerPlannedModules(new ModuleRegistry(), FEATURE_DEFINITIONS);
const kernel = new StudioKernel({ version: "test", flags: DEFAULT_FEATURE_FLAGS, modules });
await kernel.start();
assert.equal(kernel.getStatus().modules.length, Object.keys(FEATURE_DEFINITIONS).length);
assert.ok(kernel.getStatus().modules.every((module) => module.enabled === false && module.mounted === false));

console.log("Prompt Lab 2.0 architecture smoke test passed");
