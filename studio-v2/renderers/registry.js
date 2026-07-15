export class RendererRegistry {
  #renderers = new Map();

  register(renderer) {
    if (!renderer?.id || typeof renderer.canRender !== "function" || typeof renderer.render !== "function") {
      throw new TypeError("Renderer 必須包含 id、canRender() 與 render() 介面");
    }
    this.#renderers.set(renderer.id, renderer);
    return this;
  }

  find(format) {
    return [...this.#renderers.values()].find((renderer) => renderer.canRender(format)) || null;
  }
}

function interfaceOnlyRenderer(id, format) {
  return Object.freeze({
    id,
    stage: "interface",
    canRender: (candidate) => candidate === format,
    async render() {
      throw new Error(`${id} 目前只建立 Interface，尚未啟用內容解析`);
    },
  });
}

export const svgRenderer = interfaceOnlyRenderer("svg-renderer", "svg");
export const htmlRenderer = interfaceOnlyRenderer("html-renderer", "html");
