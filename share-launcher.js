const SHARE_SUPABASE_URL = "https://oeotcilwmjcvrryoenqb.supabase.co";
const SHARE_SUPABASE_KEY = "sb_publishable_K_7F9bwnDLf-w9AbDd8elg_-yQaXpaj";
const SHARE_IMAGE_BUCKET = "mumu-images";
const SHARE_NAME_MAP_PATH = "mumu-image-names.json";

const prepareGenerationButton = document.querySelector("#prepareGenerationButton");
const shareStatus = document.querySelector("#copyStatus");

const shareHeaders = {
  apikey: SHARE_SUPABASE_KEY,
  Authorization: `Bearer ${SHARE_SUPABASE_KEY}`
};

async function shareListImages() {
  const response = await fetch(`${SHARE_SUPABASE_URL}/storage/v1/object/list/${SHARE_IMAGE_BUCKET}`, {
    method: "POST",
    headers: { ...shareHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 1000, offset: 0, sortBy: { column: "created_at", order: "desc" } })
  });
  if (!response.ok) throw new Error(`讀取母卡失敗：${await response.text()}`);
  const items = await response.json();
  return items.filter((item) => item?.name && item?.metadata && /\.(jpe?g|png|webp|gif|avif)$/i.test(item.name));
}

async function shareLoadNameMap() {
  const response = await fetch(`${SHARE_SUPABASE_URL}/storage/v1/object/${SHARE_IMAGE_BUCKET}/${SHARE_NAME_MAP_PATH}?t=${Date.now()}`, {
    headers: shareHeaders,
    cache: "no-store"
  });
  if (response.status === 400 || response.status === 404) return {};
  if (!response.ok) throw new Error(`讀取母卡名稱失敗：${await response.text()}`);
  return response.json();
}

function findOfficialReferences(items, names) {
  const named = items.map((item) => ({ ...item, displayName: names[item.name] || item.name }));
  const half = named.find((item) => /沐沐.*官方.*母卡.*v?3.*半身|半身.*母卡/i.test(item.displayName));
  const full = named.find((item) => /沐沐.*官方.*母卡.*v?3.*全身|全身.*母卡/i.test(item.displayName));
  return { half, full };
}

async function shareSignedUrl(path) {
  const response = await fetch(`${SHARE_SUPABASE_URL}/storage/v1/object/sign/${SHARE_IMAGE_BUCKET}/${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { ...shareHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 300 })
  });
  if (!response.ok) throw new Error(`準備母卡失敗：${await response.text()}`);
  const data = await response.json();
  const signedPath = data.signedURL || data.signedUrl || data.signed_url;
  if (!signedPath) throw new Error("Supabase 未回傳母卡網址");
  return signedPath.startsWith("http") ? signedPath : `${SHARE_SUPABASE_URL}/storage/v1${signedPath}`;
}

function extensionFromPath(path) {
  const match = path.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "jpg";
}

function mimeFromExtension(extension) {
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "avif") return "image/avif";
  return "image/jpeg";
}

async function referenceToFile(item, outputName) {
  const url = await shareSignedUrl(item.name);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`下載${outputName}失敗 (${response.status})`);
  const blob = await response.blob();
  const extension = extensionFromPath(item.name);
  return new File([blob], `${outputName}.${extension}`, { type: blob.type || mimeFromExtension(extension) });
}

async function copyPromptForShare(prompt) {
  await navigator.clipboard.writeText(prompt);
}

prepareGenerationButton?.addEventListener("click", async () => {
  const prompt = document.querySelector("#fullOutput")?.value?.trim();
  if (!prompt) {
    shareStatus.textContent = "目前沒有可用提示詞";
    return;
  }

  prepareGenerationButton.disabled = true;
  shareStatus.textContent = "正在準備半身＋全身母卡…";

  try {
    const [items, names] = await Promise.all([shareListImages(), shareLoadNameMap()]);
    const { half, full } = findOfficialReferences(items, names);
    const missing = [!half ? "半身母卡" : "", !full ? "全身母卡" : ""].filter(Boolean);
    if (missing.length) throw new Error(`找不到${missing.join("、")}；請確認圖片名稱包含「半身」或「全身」`);

    const files = await Promise.all([
      referenceToFile(half, "沐沐官方母卡V3-半身"),
      referenceToFile(full, "沐沐官方母卡V3-全身")
    ]);

    await copyPromptForShare(prompt);

    if (!navigator.share || !navigator.canShare?.({ files })) {
      throw new Error("這個瀏覽器不支援直接分享兩張母卡；完整提示詞已先複製");
    }

    shareStatus.textContent = "提示詞已複製；請在分享面板選 ChatGPT";
    await navigator.share({
      files,
      text: prompt,
      title: "沐沐生圖｜半身＋全身母卡"
    });
    shareStatus.textContent = "母卡已送到分享流程；提示詞也在剪貼簿";
  } catch (error) {
    if (error?.name === "AbortError") {
      shareStatus.textContent = "已取消分享；提示詞仍在剪貼簿";
    } else {
      console.error("準備生圖流程失敗", error);
      shareStatus.textContent = `準備生圖失敗：${error.message}`;
    }
  } finally {
    prepareGenerationButton.disabled = false;
  }
});
