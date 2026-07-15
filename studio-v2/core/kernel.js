export class EventBus {
  #target = new EventTarget();

  on(type, listener, options) {
    this.#target.addEventListener(type, listener, options);
    return () => this.#target.removeEventListener(type, listener, options);
  }

  emit(type, detail) {
    this.#target.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

export class ModuleRegistry {
  #modules = new Map();
  #mounted = new Map();

  register(moduleDefinition) {
    if (!moduleDefinition?.id || typeof moduleDefinition.mount !== "function") {
      throw new TypeError("Studio module 必須包含 id 與 mount(context) 函式");
    }
    if (this.#modules.has(moduleDefinition.id)) throw new Error(`Studio module 已存在：${moduleDefinition.id}`);
    this.#modules.set(moduleDefinition.id, Object.freeze({ ...moduleDefinition }));
    return this;
  }

  async mountEnabled(flags, context) {
    for (const moduleDefinition of this.#modules.values()) {
      if (!flags[moduleDefinition.feature]) continue;
      const cleanup = await moduleDefinition.mount(context);
      this.#mounted.set(moduleDefinition.id, typeof cleanup === "function" ? cleanup : null);
    }
  }

  destroy() {
    [...this.#mounted.values()].reverse().forEach((cleanup) => cleanup?.());
    this.#mounted.clear();
  }

  status(flags) {
    return [...this.#modules.values()].map(({ id, feature, stage }) => ({
      id,
      feature,
      stage,
      enabled: Boolean(flags[feature]),
      mounted: this.#mounted.has(id),
    }));
  }
}

export class StudioKernel {
  constructor({ version, flags, modules, services = {} }) {
    this.version = version;
    this.flags = flags;
    this.modules = modules;
    this.services = Object.freeze({ ...services });
    this.events = new EventBus();
    this.started = false;
  }

  async start() {
    if (this.started) return this;
    this.started = true;
    await this.modules.mountEnabled(this.flags, {
      flags: this.flags,
      version: this.version,
      events: this.events,
      services: this.services,
      getRoot: () => this.#getOrCreateRoot(),
    });
    return this;
  }

  destroy() {
    this.modules.destroy();
    document.querySelector("[data-mumu-studio-v2-root]")?.remove();
    this.started = false;
  }

  getStatus() {
    return {
      version: this.version,
      flags: { ...this.flags },
      modules: this.modules.status(this.flags),
    };
  }

  #getOrCreateRoot() {
    let root = document.querySelector("[data-mumu-studio-v2-root]");
    if (root) return root;
    root = document.createElement("section");
    root.dataset.mumuStudioV2Root = "";
    root.className = "mumu-studio-v2 panel-card";
    root.setAttribute("aria-label", "Prompt Lab 2.0 實驗功能");
    document.querySelector(".workspace")?.after(root);
    return root;
  }
}
