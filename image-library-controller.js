const IMAGE_NAME_MAP_PATH_V2 = "mumu-image-names.json";

function isActualCloudImage(name) {
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(name || "");
}

async function listActualCloudImages() {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${IMAGE_BUCKET}`, {
    method: "POST",
    headers: { ...storageHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 1000, offset: 0, sortBy: { column: "created_at", order: "desc" } })
  });
  if (!response.ok) throw new Error(`讀取圖片失敗：${await response.text()}`);
  const items = await response.json();
  const unique = new Map();
  items.forEach((item) => {
    if (!item?.name || !item.metadata || !isActualCloudImage(item.name)) return;
    if (!unique.has(item.name)) unique.set(item.name, item);
  });
  return [...unique.values()];
}

async function loadImageNameMapV2() {
  try {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${IMAGE_NAME_MAP_PATH_V2}?t=${Date.now()}`, {
      headers: storageHeaders,
      cache: "no-store"
    });
    if (!response.ok) {
      if (response.status === 400 || response.status === 404) return {};
      throw new Error(await response.text());
    }
    const data = await response.json();
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch (error) {
    console.warn("讀取圖片名稱表失敗", error);
    return {};
  }
}

async function saveImageNameMapV2(map) {
  const blob = new Blob([JSON.stringify(map)], { type: "application/json" });
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${IMAGE_NAME_MAP_PATH_V2}`, {
    method: "POST",
    headers: { ...storageHeaders, "Content-Type": "application/json", "x-upsert": "true" },
    body: blob
  });
  if (!response.ok) throw new Error(`儲存名稱失敗：${await response.text()}`);
}

getImages = async function() {
  const [items, names] = await Promise.all([listActualCloudImages(), loadImageNameMapV2()]);
  return items.map((item) => ({
    id: item.id || item.name,
    path: item.name,
    name: names[item.name] || displayName(item.name),
    createdAt: item.created_at
  }));
};

renderImages = async function() {
  imageGrid.innerHTML = '<p class="empty-images">正在讀取沐沐雲端圖片庫…</p>';
  const [images, names] = await Promise.all([getImages(), loadImageNameMapV2()]);

  if (!images.length) {
    imageGrid.innerHTML = '<p class="empty-images">雲端還沒有圖片。把真正的沐沐母卡丟進上面就好 😆</p>';
    return;
  }

  imageGrid.innerHTML = "";

  for (const item of images) {
    const url = await signedImageUrl(item.path);
    const card = document.createElement("article");
    card.className = "image-card";

    const img = document.createElement("img");
    img.src = url;
    img.alt = item.name;
    img.loading = "lazy";

    const body = document.createElement("div");
    body.className = "image-card-body";

    const name = document.createElement("input");
    name.value = item.name;
    name.readOnly = true;
    name.title = "雲端圖片名稱";
    name.setAttribute("aria-label", "圖片名稱");

    const actions = document.createElement("div");
    actions.className = "image-card-actions";

    const rename = document.createElement("button");
    rename.type = "button";
    rename.textContent = "改名";
    rename.addEventListener("click", async () => {
      if (name.readOnly) {
        name.readOnly = false;
        name.focus();
        name.select();
        rename.textContent = "儲存名稱";
        return;
      }

      const newName = name.value.trim().replace(/[\r\n]/g, " ").replace(/\s+/g, " ").slice(0, 80);
      if (!newName) {
        imageSaveStatus.textContent = "圖片名稱不能空白";
        return;
      }

      try {
        rename.disabled = true;
        imageSaveStatus.textContent = "正在儲存圖片名稱…";
        const latest = await loadImageNameMapV2();
        latest[item.path] = newName;
        await saveImageNameMapV2(latest);
        imageSaveStatus.textContent = "圖片名稱已儲存到雲端";
        await renderImages();
      } catch (error) {
        console.error(error);
        name.value = item.name;
        name.readOnly = true;
        rename.textContent = "改名";
        rename.disabled = false;
        imageSaveStatus.textContent = `圖片改名失敗：${error.message}`;
      }
    });

    const view = document.createElement("button");
    view.type = "button";
    view.textContent = "看大圖";
    view.addEventListener("click", () => window.open(url, "_blank"));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "刪除";
    remove.addEventListener("click", async () => {
      if (!confirm(`確定刪除「${item.name}」？`)) return;
      try {
        imageSaveStatus.textContent = "正在刪除雲端圖片…";
        await deleteImage(item.path);
        const latest = await loadImageNameMapV2();
        if (Object.prototype.hasOwnProperty.call(latest, item.path)) {
          delete latest[item.path];
          await saveImageNameMapV2(latest);
        }
        imageSaveStatus.textContent = "雲端圖片已刪除";
        await renderImages();
      } catch (error) {
        console.error(error);
        imageSaveStatus.textContent = `圖片刪除失敗：${error.message}`;
      }
    });

    actions.append(rename, view, remove);
    body.append(name, actions);
    card.append(img, body);
    imageGrid.append(card);
  }
};

renderImages().catch((error) => {
  console.error(error);
  imageGrid.innerHTML = `<p class="empty-images">圖片庫讀取失敗：${error.message}</p>`;
});
