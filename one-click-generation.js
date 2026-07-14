const oneClickGenerationButton = document.querySelector("#oneClickGenerationButton");
const oneClickStatus = document.querySelector("#copyStatus");
const identityModeInputs = document.querySelectorAll('input[name="identityMode"]');
const identityModeStatus = document.querySelector("#identityModeStatus");
const positiveOutput = document.querySelector("#positiveOutput");
const negativeOutput = document.querySelector("#negativeOutput");
const fullOutput = document.querySelector("#fullOutput");

const COMPACT_REFERENCE_SECTION = "【沐沐官方母卡 V3｜身份參考】請以已附上的半身母卡與全身母卡作為唯一身份參考。半身母卡鎖定臉部與五官辨識，全身母卡鎖定身形比例與整體角色一致性；兩張皆為同一位沐沐，不得更換人物或重新設計角色。";

let rawPromptSnapshot = { positive: "", negative: "", full: "" };
let applyingIdentityMode = false;

function currentIdentityMode() {
  return document.querySelector('input[name="identityMode"]:checked')?.value || "attached";
}

function removeSection(text, headingPrefix) {
  const start = text.indexOf(`\n\n${headingPrefix}`);
  if (start < 0) return text;
  const next = text.indexOf("\n\n【", start + 4);
  return `${text.slice(0, start)}${next >= 0 ? text.slice(next) : ""}`;
}

function compactAttachedPrompt(text) {
  if (!text) return "";
  let result = text;
  result = result.replace(/【沐沐官方母卡 V3｜雙母卡身份參考規則】[^\n]*(?=\n\n|$)/, COMPACT_REFERENCE_SECTION);
  result = removeSection(result, "【沐沐母卡｜");
  return result.trim();
}

function captureRawOutputs() {
  if (applyingIdentityMode) return;
  rawPromptSnapshot = {
    positive: positiveOutput?.value || "",
    negative: negativeOutput?.value || "",
    full: fullOutput?.value || ""
  };
}

function applyIdentityMode() {
  if (!positiveOutput || !negativeOutput || !fullOutput) return;
  applyingIdentityMode = true;
  const attached = currentIdentityMode() === "attached";

  positiveOutput.value = attached ? compactAttachedPrompt(rawPromptSnapshot.positive) : rawPromptSnapshot.positive;
  negativeOutput.value = rawPromptSnapshot.negative;
  fullOutput.value = attached ? compactAttachedPrompt(rawPromptSnapshot.full) : rawPromptSnapshot.full;

  if (identityModeStatus) {
    identityModeStatus.textContent = attached ? "🟢 已附母卡（推薦）" : "🔵 未附母卡（完整文字設定）";
  }
  applyingIdentityMode = false;
}

function refreshAfterBuilderChange() {
  window.setTimeout(() => {
    captureRawOutputs();
    applyIdentityMode();
  }, 0);
}

identityModeInputs.forEach((input) => input.addEventListener("change", applyIdentityMode));
document.querySelector("#builderForm")?.addEventListener("change", refreshAfterBuilderChange);
document.querySelector("#selectors")?.addEventListener("change", refreshAfterBuilderChange);
document.querySelector("#clearSelectionButton")?.addEventListener("click", refreshAfterBuilderChange);
document.querySelector("#resetDataButton")?.addEventListener("click", () => window.setTimeout(refreshAfterBuilderChange, 500));

// 覆蓋複製按鈕：已附母卡時複製精簡版；未附母卡時複製完整文字版。
document.querySelectorAll(".copy-button").forEach((button) => {
  button.addEventListener("click", async (event) => {
    event.stopImmediatePropagation();
    const key = button.dataset.copy;
    const prompt = {
      positive: positiveOutput?.value || "",
      negative: negativeOutput?.value || "",
      full: fullOutput?.value || ""
    }[key];
    await navigator.clipboard.writeText(prompt);
    oneClickStatus.textContent = currentIdentityMode() === "attached" ? "已複製已附母卡版提示詞" : "已複製未附母卡版提示詞";
    window.setTimeout(() => { oneClickStatus.textContent = ""; }, 1800);
  }, true);
});

oneClickGenerationButton?.addEventListener("click", async () => {
  const attachedInput = document.querySelector('input[name="identityMode"][value="attached"]');
  if (attachedInput) attachedInput.checked = true;
  applyIdentityMode();

  const prompt = fullOutput?.value?.trim();
  if (!prompt) {
    oneClickStatus.textContent = "目前沒有可用提示詞";
    return;
  }

  const peerReferenceFile = window.mumuPeerReference?.getFile?.() || null;
  const homeReferenceCount = window.mumuHomeReference?.getActiveReferences?.().length || 0;
  const referenceCount = 2 + homeReferenceCount + (peerReferenceFile ? 1 : 0);
  oneClickGenerationButton.disabled = true;
  oneClickStatus.textContent = `正在準備 ${referenceCount} 張參考圖…`;

  try {
    const [items, names] = await Promise.all([shareListImages(), shareLoadNameMap()]);
    const { half, full } = findOfficialReferences(items, names);
    const missing = [!half ? "半身母卡" : "", !full ? "全身母卡" : ""].filter(Boolean);
    if (missing.length) throw new Error(`找不到${missing.join("、")}；請確認圖片名稱包含「半身」或「全身」`);

    const files = await Promise.all([
      referenceToFile(full, "沐沐官方母卡V3-全身"),
      referenceToFile(half, "沐沐官方母卡V3-半身")
    ]);
    const homeReferenceFiles = await window.mumuHomeReference?.getActiveFiles?.() || [];
    files.push(...homeReferenceFiles);
    if (peerReferenceFile) {
      const extension = peerReferenceFile.name.includes(".") ? peerReferenceFile.name.split(".").pop() : "jpg";
      files.push(new File([peerReferenceFile], `網友參考圖.${extension}`, { type: peerReferenceFile.type, lastModified: peerReferenceFile.lastModified }));
    }

    await navigator.clipboard.writeText(prompt);

    if (!navigator.share || !navigator.canShare?.({ files })) {
      throw new Error(`這個瀏覽器不支援直接分享 ${files.length} 張參考圖；精簡提示詞已先複製`);
    }

    oneClickStatus.textContent = "精簡提示詞已複製；請在分享面板選 ChatGPT";
    await navigator.share({
      files,
      text: prompt,
      title: `沐沐生圖｜${files.length} 張參考圖`
    });
    oneClickStatus.textContent = `✅ ${files.length} 張參考圖已送出　📋 提示詞已複製　👉 到 ChatGPT 貼上即可`;
  } catch (error) {
    if (error?.name === "AbortError") {
      oneClickStatus.textContent = "已取消分享；精簡提示詞仍在剪貼簿";
    } else {
      console.error("一鍵生圖流程失敗", error);
      oneClickStatus.textContent = `一鍵生圖失敗：${error.message}`;
    }
  } finally {
    oneClickGenerationButton.disabled = false;
  }
});

// app.js 會非同步載入雲端卡片；等提示詞第一次出現後再套用預設的已附母卡模式。
const initialSync = window.setInterval(() => {
  if (!fullOutput?.value) return;
  window.clearInterval(initialSync);
  captureRawOutputs();
  applyIdentityMode();
}, 100);
