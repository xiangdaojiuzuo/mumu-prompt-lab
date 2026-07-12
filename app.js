const STORAGE_KEY = "mumu-prompt-manager-v1";
const typeLabels = {
  character: "沐沐母卡",
  angle: "角度卡",
  expression: "表情卡",
  outfit: "服裝卡",
  scene: "場景卡",
};

const defaultCards = [
  { id: "character-soft", type: "character", name: "沐沐柔甜母卡", positive: "沐沐，甜美溫柔的年輕女性角色，柔順長髮，清澈眼神，細緻五官，乾淨自然膚色，親切可愛氣質，角色辨識度一致", negative: "五官變形，角色不一致，過度成熟，過度幼化" },
  { id: "angle-front", type: "angle", name: "正面半身", positive: "正面視角，半身構圖，角色置中，鏡頭自然平視", negative: "奇怪視角，裁切頭部，構圖歪斜" },
  { id: "expression-smile", type: "expression", name: "甜甜微笑", positive: "自然甜美微笑，眼神溫柔，表情放鬆且有親和力", negative: "僵硬表情，誇張笑容，空洞眼神" },
  { id: "outfit-dress", type: "outfit", name: "白色洋裝", positive: "白色簡約洋裝，柔軟布料，清新乾淨，優雅可愛", negative: "服裝破損，過度暴露，不合理配件" },
  { id: "scene-room", type: "scene", name: "晨光房間", positive: "溫暖晨光灑入的乾淨房間，柔和陰影，舒適生活感，背景簡潔", negative: "背景雜亂，低光噪點，陰暗壓迫" },
];

const platformHints = {
  ChatGPT: "請以清楚分段的方式輸出，保留角色一致性與細節描述。",
  Grok: "請使用直接、精準且容易複製到生成工具的提示詞格式。",
  Flow: "請強調場景連貫、鏡頭語言與視覺氛圍。",
  Veo: "請強調影片動作、鏡頭運動、時間節奏與穩定畫面。",
};

const modeHints = {
  image: {
    label: "生圖",
    positive: "高品質，細節豐富，柔和光影，清晰構圖，精緻視覺效果",
    negative: "低品質，模糊，噪點，比例錯誤，多餘手指，肢體扭曲，文字浮水印",
  },
  video: {
    label: "生影片",
    positive: "自然動作，穩定鏡頭，流暢運動，電影感光影，連貫時間節奏，角色一致性高",
    negative: "畫面閃爍，臉部漂移，手部變形，動作破碎，鏡頭晃動，角色外觀跳變",
  },
};

let state = loadState();

const selectors = document.querySelector("#selectors");
const cardLists = document.querySelector("#cardLists");
const cardType = document.querySelector("#cardType");
const saveStatus = document.querySelector("#saveStatus");
const copyStatus = document.querySelector("#copyStatus");

function loadState() {
  const fallback = { cards: defaultCards, selections: {}, mode: "image", platform: "ChatGPT" };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return stored?.cards ? { ...fallback, ...stored } : fallback;
  } catch {
    return fallback;
  }
}

function persist(message = "資料已自動保存") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveStatus.textContent = message;
}

function byType(type) {
  return state.cards.filter((card) => card.type === type);
}

function selectedCards() {
  return Object.keys(typeLabels).map((type) => state.cards.find((card) => card.id === state.selections[type])).filter(Boolean);
}

function buildPrompt() {
  const cards = selectedCards();
  const mode = modeHints[state.mode];
  const platform = state.platform;
  const positiveParts = [
    `模式：${mode.label}`,
    `平台：${platform}`,
    platformHints[platform],
    ...cards.map((card) => card.positive),
    mode.positive,
  ].filter(Boolean);
  const negativeParts = [...cards.map((card) => card.negative), mode.negative].filter(Boolean);
  const positive = positiveParts.join("，\n");
  const negative = negativeParts.join("，\n");
  return { positive, negative, full: `正向提示詞：\n${positive}\n\n負向提示詞：\n${negative}` };
}

function renderSelectors() {
  selectors.innerHTML = Object.entries(typeLabels).map(([type, label]) => {
    const options = byType(type).map((card) => `<option value="${card.id}" ${state.selections[type] === card.id ? "selected" : ""}>${escapeHtml(card.name)}</option>`).join("");
    return `<label>${label}<select data-selector="${type}"><option value="">不選擇</option>${options}</select></label>`;
  }).join("");
}

function renderOutputs() {
  const prompt = buildPrompt();
  document.querySelector("#positiveOutput").value = prompt.positive;
  document.querySelector("#negativeOutput").value = prompt.negative;
  document.querySelector("#fullOutput").value = prompt.full;
}

function renderCardTypes() {
  cardType.innerHTML = Object.entries(typeLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
}

function renderCardLists() {
  cardLists.innerHTML = Object.entries(typeLabels).map(([type, label]) => {
    const items = byType(type).map((card) => `
      <div class="item">
        <strong>${escapeHtml(card.name)}</strong>
        <p>${escapeHtml(card.positive)}</p>
        <div class="item-actions">
          <button type="button" data-edit="${card.id}">編輯</button>
          <button type="button" data-delete="${card.id}">刪除</button>
        </div>
      </div>`).join("") || `<p>尚無卡片</p>`;
    return `<section class="card-list"><h3>${label}</h3>${items}</section>`;
  }).join("");
}

function renderAll() {
  document.querySelector(`[name="mode"][value="${state.mode}"]`).checked = true;
  document.querySelector("#platformSelect").value = state.platform;
  renderSelectors();
  renderOutputs();
  renderCardTypes();
  renderCardLists();
}

function resetForm() {
  document.querySelector("#cardId").value = "";
  document.querySelector("#cardForm").reset();
  document.querySelector("#cardType").disabled = false;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

selectors.addEventListener("change", (event) => {
  const type = event.target.dataset.selector;
  if (!type) return;
  state.selections[type] = event.target.value;
  persist();
  renderOutputs();
});

document.querySelector("#builderForm").addEventListener("change", (event) => {
  if (event.target.name === "mode") state.mode = event.target.value;
  if (event.target.name === "platform") state.platform = event.target.value;
  persist();
  renderOutputs();
});

document.querySelectorAll(".copy-button").forEach((button) => button.addEventListener("click", async () => {
  const prompt = buildPrompt();
  await navigator.clipboard.writeText(prompt[button.dataset.copy]);
  copyStatus.textContent = "已複製到剪貼簿";
  setTimeout(() => copyStatus.textContent = "", 1800);
}));

document.querySelector("#clearSelectionButton").addEventListener("click", () => {
  state.selections = {};
  persist("已清空目前選擇");
  renderAll();
});

document.querySelector("#resetDataButton").addEventListener("click", () => {
  if (!confirm("確定要重設為預設資料？這會覆蓋目前卡片。")) return;
  state = { cards: defaultCards, selections: {}, mode: "image", platform: "ChatGPT" };
  persist("已重設預設資料");
  resetForm();
  renderAll();
});

document.querySelector("#cardForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#cardId").value || `card-${Date.now()}`;
  const card = {
    id,
    type: document.querySelector("#cardType").value,
    name: document.querySelector("#cardName").value.trim(),
    positive: document.querySelector("#cardPositive").value.trim(),
    negative: document.querySelector("#cardNegative").value.trim(),
  };
  const index = state.cards.findIndex((item) => item.id === id);
  if (index >= 0) state.cards[index] = card; else state.cards.push(card);
  persist("卡片已保存");
  resetForm();
  renderAll();
});

document.querySelector("#cancelEditButton").addEventListener("click", resetForm);

cardLists.addEventListener("click", (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) {
    const card = state.cards.find((item) => item.id === editId);
    document.querySelector("#cardId").value = card.id;
    document.querySelector("#cardType").value = card.type;
    document.querySelector("#cardType").disabled = true;
    document.querySelector("#cardName").value = card.name;
    document.querySelector("#cardPositive").value = card.positive;
    document.querySelector("#cardNegative").value = card.negative || "";
    window.scrollTo({ top: document.querySelector("#cardForm").offsetTop - 24, behavior: "smooth" });
  }
  if (deleteId && confirm("確定要刪除此卡片？")) {
    state.cards = state.cards.filter((item) => item.id !== deleteId);
    Object.keys(state.selections).forEach((type) => { if (state.selections[type] === deleteId) state.selections[type] = ""; });
    persist("卡片已刪除");
    renderAll();
  }
});

renderAll();
persist("資料已就緒");
