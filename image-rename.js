const IMAGE_NAME_MAP_PATH = "mumu-image-names.json";
let cloudImageNameMap = {};

function isCloudImageFile(name) {
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(name || "");
}

async function listCloudObjects() {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${IMAGE_BUCKET}`, {
    method: "POST",
    headers: { ...storageHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 1000, offset: 0, sortBy: { column: "created_at", order: "desc" } })
  });
  if (!response.ok) throw new Error(`讀取圖片失敗：${await response.text()}`);
  return response.json();
}

async function loadCloudImageNameMap() {
  try {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${IMAGE_NAME_MAP_PATH}?t=${Date.now()}`, {
      headers: storageHeaders,
      cache: "no-store"
    });
    if (!response.ok) {
      if (response.status === 400 || response.status === 404) return {};
      throw new Error(await response.text());
    }
    const data = await response.json();
    return data && typeof data === "object" ? data : {};
  } catch (error) {
    console.warn("讀取圖片名稱表失敗", error);
    return {};
  }
}

async function saveCloudImageNameMap(map) {
  const blob = new Blob([JSON.stringify(map)], { type: "application/json" });
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${IMAGE_NAME_MAP_PATH}`, {
    method: "POST",
    headers: { ...storageHeaders, "Content-Type": "application/json", "x-upsert": "true" },
    body: blob
  });
  if (!response.ok) throw new Error(`儲存名稱失敗：${await response.text()}`);
}

getImages = async function() {
  const [items, names] = await Promise.all([listCloudObjects(), loadCloudImageNameMap()]);
  cloudImageNameMap = names;
  return items
    .filter((item) => item.name && item.metadata && isCloudImageFile(item.name))
    .map((item) => ({
      id: item.id || item.name,
      path: item.name,
      name: names[item.name] || displayName(item.name),
      createdAt: item.created_at
    }));
};

async function enableCloudImageRename() {
  const images = await getImages();
  const cards = [...imageGrid.querySelectorAll(".image-card")];
  cards.forEach((card, index) => {
    const input = card.querySelector("input");
    const actions = card.querySelector(".image-card-actions");
    const item = images[index];
    if (!input || !actions || !item || actions.querySelector(".rename-image-button")) return;

    const rename = document.createElement("button");
    rename.type = "button";
    rename.className = "rename-image-button";
    rename.textContent = "改名";
    rename.addEventListener("click", async () => {
      if (input.readOnly) {
        input.readOnly = false;
        input.focus();
        input.select();
        rename.textContent = "儲存名稱";
        return;
      }

      const newName = input.value.trim().replace(/[\r\n]/g, " ").replace(/\s+/g, " ").slice(0, 80);
      if (!newName) {
        imageSaveStatus.textContent = "圖片名稱不能空白";
        return;
      }

      try {
        imageSaveStatus.textContent = "正在儲存圖片名稱…";
        rename.disabled = true;
        const latestMap = await loadCloudImageNameMap();
        latestMap[item.path] = newName;
        await saveCloudImageNameMap(latestMap);
        cloudImageNameMap = latestMap;
        imageSaveStatus.textContent = "圖片名稱已儲存到雲端";
        await renderImages();
      } catch (error) {
        console.error(error);
        input.value = item.name;
        input.readOnly = true;
        rename.textContent = "改名";
        rename.disabled = false;
        imageSaveStatus.textContent = `圖片改名失敗：${error.message}`;
      }
    });
    actions.prepend(rename);
  });
}

const renameObserver = new MutationObserver(() => {
  enableCloudImageRename().catch((error) => console.error(error));
});
renameObserver.observe(imageGrid, { childList: true });

renderImages()
  .then(() => enableCloudImageRename())
  .catch((error) => console.error(error));