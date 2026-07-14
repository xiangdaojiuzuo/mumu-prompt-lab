const STORAGE_KEY = "mumu-prompt-manager-v2";
const CARD_SUPABASE_URL = "https://oeotcilwmjcvrryoenqb.supabase.co";
const CARD_SUPABASE_KEY = "sb_publishable_K_7F9bwnDLf-w9AbDd8elg_-yQaXpaj";
const CARD_TABLE = "prompt_cards";
const typeLabels = {
  character: "沐沐母卡",
  angle: "角度卡",
  expression: "表情卡",
  outfit: "服裝卡",
  scene: "場景卡",
};

const defaultCards = [
  {
    id: "character-mumu-official-v3",
    type: "character",
    name: "沐沐官方母卡 v3.0",
    positive: "沐沐，22歲明確成年東亞女性，163cm，日系甜感、自然學妹感。小圓臉、短下巴、柔和下顎線、大而自然有神的眼睛、自然蘋果肌，五官比例柔和年輕，乾淨淡妝。深棕色長直柔順頭髮，空氣瀏海。自然真實女性曲線，身體比例平衡，胸型以自然D罩杯比例為一致性基準，腰身自然收束但不過度纖細，整體具有真實厚度、柔和重量感與符合重力的身體線條。保持同一位沐沐的臉部幾何、臉型比例、眼距、眼型與整體角色辨識度一致",
    negative: "成熟阿姨感，成熟模特臉，歐美銳利五官，明星臉，名媛感，伸長臉型，長下巴，尖銳下顎，厭世臉，塑膠臉，過度幼化，未成年外觀，角色換臉，臉部漂移，眼距改變，身形縮水，胸型比例明顯改變，不自然極細腰，失真身體比例"
  },
  { id: "angle-front", type: "angle", name: "正面", positive: "正面視角，人物面向鏡頭，保持自然真實透視", negative: "擅自改成側面或背面，臉部透視變形" },
  { id: "angle-left45", type: "angle", name: "左45度", positive: "人物呈左側斜45度視角，保持左45度角度與自然臉部輪廓", negative: "擅自補成正面，切換右45度，角度漂移" },
  { id: "angle-right45", type: "angle", name: "右45度", positive: "人物呈右側斜45度視角，保持右45度角度與自然臉部輪廓", negative: "擅自補成正面，切換左45度，角度漂移" },
  { id: "angle-left-profile", type: "angle", name: "左側面", positive: "左側面視角，清楚保留側臉輪廓，鏡頭維持側面", negative: "擅自轉正面，右側面，鏡頭繞到人物正前方" },
  { id: "angle-right-profile", type: "angle", name: "右側面", positive: "右側面視角，清楚保留側臉輪廓，鏡頭維持側面", negative: "擅自轉正面，左側面，鏡頭繞到人物正前方" },
  { id: "expression-smile", type: "expression", name: "微笑", positive: "自然溫柔的甜甜微笑，眼神柔和，表情放鬆", negative: "僵硬假笑，誇張嘴型，空洞眼神" },
  { id: "expression-happy", type: "expression", name: "開心", positive: "明顯開心的表情，眼神明亮，帶自然活力與學妹感", negative: "表情僵硬，過度誇張，失控顏藝" },
  { id: "expression-surprised", type: "expression", name: "驚喜", positive: "自然驚喜的表情，眼睛微微睜大，情緒明亮真實", negative: "驚恐，恐怖表情，過度張嘴" },
  { id: "expression-aggrieved", type: "expression", name: "委屈", positive: "輕微委屈的表情，眼神柔軟，帶一點撒嬌感", negative: "嚎啕大哭，恐怖哭臉，五官扭曲" },
  { id: "expression-shy", type: "expression", name: "害羞", positive: "自然害羞的表情，眼神略帶閃躲，淡淡靦腆感", negative: "過度臉紅，低俗表情，誇張顏藝" },
  { id: "expression-coquettish", type: "expression", name: "撒嬌", positive: "自然可愛的撒嬌表情，溫暖眼神，親近的女友感", negative: "幼兒化，過度做作，誇張嘟嘴" },
  { id: "expression-focused", type: "expression", name: "專注", positive: "專注認真的神情，視線自然集中，表情平靜", negative: "呆滯，空洞眼神，憤怒皺眉" },
  { id: "expression-sleepy", type: "expression", name: "困", positive: "自然微睏的表情，眼神略微慵懶，保留清新柔和感", negative: "病態，憔悴，黑眼圈過重" },
  { id: "expression-laugh", type: "expression", name: "笑出聲", positive: "自然笑出聲的瞬間，開心活潑，表情生動且真實", negative: "嘴型崩壞，牙齒變形，失控顏藝" },
  { id: "outfit-official-v3", type: "outfit", name: "官方母卡穿搭 v3.0", positive: "白色羅紋背心，淺藍色襯衫自然披掛於外層，高腰牛仔短褲，白色休閒鞋；衣料呈現自然張力、皺褶與垂墜，符合身形與重力", negative: "服裝款式擅自改變，淺藍襯衫消失，不合理緊身塑膠布料，衣料黏死身體" },
  { id: "outfit-home", type: "outfit", name: "沐沐居家休閒", positive: "舒適自然的日系居家休閒穿搭，柔軟輕盈布料，乾淨簡約，保留沐沐年輕自然的生活感；衣料有真實皺褶、張力與垂墜", negative: "正式晚宴服，職業制服，過度華麗配件，塑膠感布料" },
  { id: "scene-cream-room", type: "scene", name: "沐沐奶油白房間", positive: "沐沐的奶油白房間，乾淨溫暖的日系生活空間，柔和自然光，米白與奶油色調，真實居家細節，背景不搶人物", negative: "豪華宮殿，陰暗恐怖房間，雜亂垃圾，過度空洞攝影棚" },
  { id: "scene-entry", type: "scene", name: "玄關", positive: "沐沐家玄關區域，乾淨自然的日系居家生活感，真實室內光線與生活細節", negative: "飯店大廳，商場，豪宅宮殿" },
  { id: "scene-living", type: "scene", name: "客廳", positive: "沐沐家客廳，溫暖乾淨、舒適自然的日系生活空間，柔和居家光線", negative: "攝影棚背景，辦公室，豪華宴會廳" },
  { id: "scene-dining", type: "scene", name: "餐桌區", positive: "沐沐家餐桌區，真實居家餐桌與生活細節，乾淨溫暖，自然室內光線", negative: "高級餐廳，宴會廳，空無一物" },
  { id: "scene-balcony", type: "scene", name: "陽台", positive: "沐沐家陽台，與居家空間連貫，自然日光與真實住宅生活感", negative: "飯店頂樓，豪華空中酒吧，奇幻場景" },
  { id: "scene-dressing", type: "scene", name: "更衣區", positive: "沐沐家的更衣區，乾淨整齊的衣物收納與穿搭生活細節，柔和室內光線", negative: "服飾店，伸展台，豪華精品店" },
  { id: "scene-bath-exterior", type: "scene", name: "衛浴外區", positive: "沐沐家衛浴外區，乾淨明亮、自然真實的住宅空間，柔和室內照明", negative: "公共澡堂，飯店SPA，陰暗空間" }
];

const platformHints = {
  ChatGPT: "使用自然繁體中文完整描述；優先維持沐沐身份、臉部與身形一致性，不要擅自替換人物設定。",
  Grok: "使用直接、精準、可直接貼入生成器的完整提示詞；鎖定人物身份與身形，不擅自刪減關鍵設定。",
  Flow: "以影片生成邏輯描述；明確固定人物、鏡頭角度、動作先後與場景連續性，避免模型自行補正視角。",
  Veo: "以時間順序描述動作與鏡頭；強調角色一致、自然物理動態、穩定臉部與連續畫面。",
};

const modeHints = {
  image: {
    label: "生圖",
    positive: "超寫實攝影，Photorealistic，Ultra realistic，Japanese lifestyle photography，documentary realism，真實皮膚紋理，自然光影，真實衣料物理，清晰構圖，人物身份一致性優先",
    negative: "低品質，模糊，噪點，過度磨皮，塑膠皮膚，AI感，卡通化，比例錯誤，多餘手指，手部變形，肢體扭曲，文字，浮水印，重複人物",
  },
  video: {
    label: "生影片",
    positive: "自然連續動作，真實物理與重力，穩定鏡頭，流暢運動，角色身份全程一致，臉部穩定，髮絲與衣料自然動態，電影感但保留真實生活攝影質感",
    negative: "畫面閃爍，臉部漂移，換臉，人物變形，手部變形，動作破碎，瞬間位移，鏡頭亂繞，擅自補正面，角色外觀跳變，服裝突變，場景跳變",
  },
};

const MUMU_V3_DUAL_REFERENCE = "【沐沐官方母卡 V3｜雙母卡身份參考規則】請同時使用母卡圖片庫中的沐沐官方母卡 V3 半身照與全身照，兩張皆為同一位沐沐的身份參考。半身母卡優先鎖定臉部身份、臉部幾何、臉型比例、眼型、眼距、五官與空氣瀏海；全身母卡優先鎖定深棕長髮、身形比例、整體曲線、腿身比例與角色整體辨識度。不得將兩張參考圖理解為兩位不同人物，不得混合生成新人物，不得擅自換臉或改變沐沐身份。";
const HOME_REFERENCE_RULES = "【沐沐家官方設定圖｜場景一致性規則】檔名以「沐沐居家」開頭的圖片皆為沐沐家既有官方設定，不是一般靈感圖。全屋大局觀圖負責鎖定格局、空間關係與生活動線；區域 P 圖負責鎖定本次場景的家具、配色、燈光、視角與細節。必須維持奶油白、木質、粉色點綴、溫暖柔和且有生活感的同一個沐沐家，不得重新設計成另一間住宅。";
const PEER_REFERENCE_RULES = "【網友參考圖｜模仿規則】檔名為「網友參考圖」的圖片只用來參考並重現其服裝款式與配色、姿勢與動作、鏡頭角度、取景構圖、場景配置及整體氛圍。最終人物必須完整替換為沐沐，以沐沐半身母卡鎖定臉部身份、全身母卡鎖定髮型與身形比例；不得保留、混合或套用網友圖人物的臉部、五官、身份與身形。若同時附有沐沐家官方設定圖，場景以沐沐家設定為準，網友圖只參考人物相關的服裝、姿勢、動作與鏡頭構圖。";

let state = loadLocalState();
const selectors = document.querySelector("#selectors");
const cardLists = document.querySelector("#cardLists");
const cardType = document.querySelector("#cardType");
const saveStatus = document.querySelector("#saveStatus");
const copyStatus = document.querySelector("#copyStatus");

const cardHeaders = {
  apikey: CARD_SUPABASE_KEY,
  Authorization: `Bearer ${CARD_SUPABASE_KEY}`,
  "Content-Type": "application/json"
};

function loadLocalState() {
  const fallback = { cards: [], selections: {}, mode: "image", platform: "ChatGPT" };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...fallback, selections: stored?.selections || {}, mode: stored?.mode || "image", platform: stored?.platform || "ChatGPT" };
  } catch {
    return fallback;
  }
}

function persistLocal(message = "選擇已保存") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ selections: state.selections, mode: state.mode, platform: state.platform }));
  saveStatus.textContent = message;
}

function normalizeCard(card) { return { ...card, id: String(card.id), negative: card.negative || "" }; }

async function cardRequest(path = "", options = {}) {
  const response = await fetch(`${CARD_SUPABASE_URL}/rest/v1/${CARD_TABLE}${path}`, {
    ...options,
    headers: { ...cardHeaders, ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(await response.text());
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function loadCloudCards() {
  let cards = await cardRequest("?select=id,type,name,positive,negative&order=id.asc");
  if (!cards.length) {
    saveStatus.textContent = "正在建立沐沐官方雲端卡片…";
    const seed = defaultCards.map(({ type, name, positive, negative }) => ({ type, name, positive, negative }));
    cards = await cardRequest("", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(seed) });
  }
  state.cards = cards.map(normalizeCard);
  Object.keys(state.selections).forEach((type) => {
    if (!state.cards.some((card) => card.id === String(state.selections[type]))) state.selections[type] = "";
  });
  persistLocal("沐沐雲端卡片已同步");
}

function byType(type) { return state.cards.filter((card) => card.type === type); }
function selectedCards() { return Object.keys(typeLabels).map((type) => state.cards.find((card) => card.id === String(state.selections[type]))).filter(Boolean); }
function isOfficialMumuV3(card) { return card?.type === "character" && /沐沐官方母卡\s*v?3(?:\.0)?/i.test(card.name || ""); }

function buildPrompt() {
  const cards = selectedCards();
  const mode = modeHints[state.mode];
  const platform = state.platform;
  const characterCard = cards.find((card) => card.type === "character");
  const positiveParts = [
    `【用途】${mode.label}｜${platform}`,
    `【平台規則】${platformHints[platform]}`,
    isOfficialMumuV3(characterCard) ? MUMU_V3_DUAL_REFERENCE : "",
    window.mumuHomeReference?.hasActiveReference?.() ? HOME_REFERENCE_RULES : "",
    window.mumuPeerReference?.hasFile?.() ? PEER_REFERENCE_RULES : "",
    ...cards.map((card) => `【${typeLabels[card.type]}｜${card.name}】${card.positive}`),
    `【${mode.label}品質與穩定規則】${mode.positive}`,
  ].filter(Boolean);
  const negativeParts = [...cards.map((card) => card.negative), mode.negative].filter(Boolean);
  const positive = positiveParts.join("\n\n");
  const negative = [...new Set(negativeParts.join("，").split("，").map((part) => part.trim()).filter(Boolean))].join("，");
  return { positive, negative, full: `正向提示詞：\n${positive}\n\n負向提示詞：\n${negative}` };
}

function renderSelectors() {
  const selectorField = (type) => {
    const options = byType(type).map((card) => `<option value="${card.id}" ${String(state.selections[type] || "") === card.id ? "selected" : ""}>${escapeHtml(card.name)}</option>`).join("");
    return `<label>${typeLabels[type]}<select data-selector="${type}"><option value="">不選擇</option>${options}</select></label>`;
  };
  const blocks = [
    { key: "character", step: 2, icon: "👤", title: "人物", types: ["character", "angle"] },
    { key: "expression", step: 3, icon: "😊", title: "表情", types: ["expression"] },
    { key: "outfit", step: 4, icon: "👗", title: "服裝", types: ["outfit"] },
    { key: "scene", step: 5, icon: "🌸", title: "場景", types: ["scene"] },
  ];
  const openByDefault = !window.matchMedia("(max-width: 560px)").matches;
  selectors.innerHTML = blocks.map((block) => `
    <details class="studio-block studio-block-${block.key}" data-studio-block="${block.key}" ${openByDefault ? "open" : ""}>
      <summary><span class="studio-summary-copy"><span class="studio-block-title"><span class="studio-step" aria-hidden="true">${block.step}</span><span><span aria-hidden="true">${block.icon}</span> ${block.title}</span></span><small id="studioSummary-${block.key}" class="studio-summary">尚未選擇</small></span><span class="studio-chevron" aria-hidden="true"></span></summary>
      <div class="studio-block-content studio-selector-content">${block.types.map(selectorField).join("")}</div>
    </details>`).join("");
}

function selectedCardName(type) {
  return state.cards.find((card) => card.id === String(state.selections[type] || ""))?.name || "";
}

function setStudioSummary(key, value) {
  const summary = document.querySelector(`#studioSummary-${key}`);
  if (summary) summary.textContent = value || "尚未選擇";
}

function updateStudioSummaries() {
  const identityMode = document.querySelector('input[name="identityMode"]:checked')?.value === "unattached" ? "未附母卡" : "已附母卡";
  setStudioSummary("settings", `${modeHints[state.mode].label}｜${state.platform}｜${identityMode}`);
  setStudioSummary("character", [selectedCardName("character"), selectedCardName("angle")].filter(Boolean).join("｜"));
  setStudioSummary("expression", selectedCardName("expression"));
  setStudioSummary("outfit", selectedCardName("outfit"));
  setStudioSummary("scene", selectedCardName("scene"));
  setStudioSummary("quality", `${modeHints[state.mode].label}品質｜自動套用`);
}

function applyAccordionDefaults() {
  const mobile = window.matchMedia("(max-width: 560px)").matches;
  const blocks = [...document.querySelectorAll("#builderForm .studio-block")];
  blocks.forEach((block, index) => { block.open = mobile ? index === 0 : true; });
}

function renderOutputs() {
  const prompt = buildPrompt();
  document.querySelector("#positiveOutput").value = prompt.positive;
  document.querySelector("#negativeOutput").value = prompt.negative;
  document.querySelector("#fullOutput").value = prompt.full;
}

function renderCardTypes() { cardType.innerHTML = Object.entries(typeLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join(""); }

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
  renderSelectors(); renderOutputs(); renderCardTypes(); renderCardLists(); updateStudioSummaries(); window.mumuHomeReference?.sync?.();
}

function resetForm() {
  document.querySelector("#cardId").value = "";
  document.querySelector("#cardForm").reset();
  document.querySelector("#cardType").disabled = false;
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

selectors.addEventListener("change", (event) => {
  const type = event.target.dataset.selector;
  if (!type) return;
  state.selections[type] = event.target.value;
  persistLocal(); renderOutputs(); updateStudioSummaries();
});

document.querySelector("#builderForm").addEventListener("toggle", (event) => {
  const openedBlock = event.target;
  if (!openedBlock.matches?.(".studio-block") || !openedBlock.open || !window.matchMedia("(max-width: 560px)").matches) return;
  document.querySelectorAll("#builderForm .studio-block").forEach((block) => {
    if (block !== openedBlock) block.open = false;
  });
}, true);

window.matchMedia("(max-width: 560px)").addEventListener("change", applyAccordionDefaults);

document.querySelector("#builderForm").addEventListener("change", (event) => {
  if (event.target.name === "mode") state.mode = event.target.value;
  if (event.target.name === "platform") state.platform = event.target.value;
  persistLocal(); renderOutputs(); updateStudioSummaries();
});

document.querySelectorAll(".copy-button").forEach((button) => button.addEventListener("click", async () => {
  const prompt = buildPrompt();
  await navigator.clipboard.writeText(prompt[button.dataset.copy]);
  copyStatus.textContent = "已複製到剪貼簿";
  setTimeout(() => copyStatus.textContent = "", 1800);
}));

document.querySelector("#clearSelectionButton").addEventListener("click", () => {
  state.selections = {}; persistLocal("已清空目前選擇"); renderAll();
});

document.querySelector("#resetDataButton").addEventListener("click", async () => {
  if (!confirm("確定要重設為預設資料？這會覆蓋雲端卡片。")) return;
  try {
    saveStatus.textContent = "正在重設沐沐雲端卡片…";
    await cardRequest("?id=gt.0", { method: "DELETE" });
    const seed = defaultCards.map(({ type, name, positive, negative }) => ({ type, name, positive, negative }));
    const cards = await cardRequest("", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(seed) });
    state.cards = cards.map(normalizeCard);
    state.selections = {};
    persistLocal("已重設為沐沐官方雲端資料"); resetForm(); renderAll();
  } catch (error) {
    console.error(error);
    saveStatus.textContent = `重設失敗：${error.message}`;
  }
});

document.querySelector("#cardForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.querySelector("#cardId").value;
  const card = {
    type: document.querySelector("#cardType").value,
    name: document.querySelector("#cardName").value.trim(),
    positive: document.querySelector("#cardPositive").value.trim(),
    negative: document.querySelector("#cardNegative").value.trim(),
  };
  try {
    saveStatus.textContent = id ? "正在更新雲端卡片…" : "正在新增雲端卡片…";
    let saved;
    if (id) {
      saved = await cardRequest(`?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(card) });
      const index = state.cards.findIndex((item) => item.id === id);
      if (index >= 0 && saved[0]) state.cards[index] = normalizeCard(saved[0]);
    } else {
      saved = await cardRequest("", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(card) });
      if (saved[0]) state.cards.push(normalizeCard(saved[0]));
    }
    saveStatus.textContent = "雲端卡片已保存";
    resetForm(); renderAll();
  } catch (error) {
    console.error(error);
    saveStatus.textContent = `卡片保存失敗：${error.message}`;
  }
});

document.querySelector("#cancelEditButton").addEventListener("click", resetForm);

cardLists.addEventListener("click", async (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) {
    const card = state.cards.find((item) => item.id === editId);
    if (!card) return;
    document.querySelector("#cardId").value = card.id;
    document.querySelector("#cardType").value = card.type;
    document.querySelector("#cardType").disabled = true;
    document.querySelector("#cardName").value = card.name;
    document.querySelector("#cardPositive").value = card.positive;
    document.querySelector("#cardNegative").value = card.negative || "";
    window.scrollTo({ top: document.querySelector("#cardForm").offsetTop - 24, behavior: "smooth" });
  }
  if (deleteId && confirm("確定要刪除此卡片？")) {
    try {
      saveStatus.textContent = "正在刪除雲端卡片…";
      await cardRequest(`?id=eq.${encodeURIComponent(deleteId)}`, { method: "DELETE" });
      state.cards = state.cards.filter((item) => item.id !== deleteId);
      Object.keys(state.selections).forEach((type) => { if (String(state.selections[type]) === deleteId) state.selections[type] = ""; });
      persistLocal("雲端卡片已刪除"); renderAll();
    } catch (error) {
      console.error(error);
      saveStatus.textContent = `卡片刪除失敗：${error.message}`;
    }
  }
});

async function initialize() {
  saveStatus.textContent = "正在同步沐沐雲端卡片…";
  try {
    await loadCloudCards();
    renderAll();
    applyAccordionDefaults();
  } catch (error) {
    console.error(error);
    state.cards = defaultCards;
    renderAll();
    applyAccordionDefaults();
    saveStatus.textContent = `雲端卡片讀取失敗：${error.message}`;
  }
}

initialize();
