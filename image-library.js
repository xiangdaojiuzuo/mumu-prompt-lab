const SUPABASE_URL = "https://oeotcilwmjcvrryoenqb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_K_7F9bwnDLf-w9AbDd8elg_-yQaXpaj";
const IMAGE_BUCKET = "mumu-images";
const IMAGE_NAME_MAP_PATH = "mumu-image-names.json";

const imageInput = document.querySelector("#imageInput");
const imageGrid = document.querySelector("#imageGrid");
const imageDrop = document.querySelector("#imageDrop");
const imageSaveStatus = document.querySelector("#saveStatus");

const storageHeaders = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
};

function safeFileName(file) {
  const extension = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() || ".jpg";
  return `mumu-${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}${extension}`;
}

function displayName(path) {
  return path.replace(/\.[^.]+$/, "").replace(/^mumu-\d+-/, "沐沐母卡-");
}

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

async function loadImageNameMap() {
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
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch (error) {
    console.warn("讀取圖片名稱表失敗", error);
    return {};
  }
}

async function saveImageNameMap(map) {
  const blob = new Blob([JSON.stringify(map)], { type: "application/json" });
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${IMAGE_NAME_MAP_PATH}`, {
    method: "POST",
    headers: { ...storageHeaders, "Content-Type": "application/json", "x-upsert": "true" },
    body: blob
  });
  if (!response.ok) throw new Error(`儲存名稱失敗：${await response.text()}`);
}

async function signedImageUrl(path) {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${IMAGE_BUCKET}/${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { ...storageHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 3600 })
  });
  if (!response.ok) throw new Error(`建立圖片網址失敗：${await response.text()}`);
  const data = await response.json();
  const signedPath = data.signedURL || data.signedUrl || data.signed_url;
  if (!signedPath) throw new Error("Supabase 未回傳圖片網址");
  return signedPath.startsWith("http") ? signedPath : `${SUPABASE_URL}/storage/v1${signedPath}`;
}

async function getImages() {
  const [items, names] = await Promise.all([listActualCloudImages(), loadImageNameMap()]);
  return items.map((item) => ({
    id: item.id || item.name,
    path: item.name,
    name: names[item.name] || displayName(item.name),
    createdAt: item.created_at
  }));
}

function uploadImageFile(file, path) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${encodeURIComponent(path)}`;
    xhr.open("POST", url, true);
    xhr.setRequestHeader("apikey", SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("Authorization", `Bearer ${SUPABASE_PUBLISHABLE_KEY}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Storage upload 失敗 (${xhr.status})：${xhr.responseText || "Supabase 未回傳錯誤內容"}`));
    };
    xhr.onerror = () => reject(new Error("Storage upload 網路連線失敗；請確認 Supabase 連線後再試"));
    xhr.onabort = () => reject(new Error("Storage upload 已取消"));
    xhr.ontimeout = () => reject(new Error("Storage upload 逾時"));
    xhr.timeout = 120000;
    xhr.send(file);
  });
}

async function addImages(files) {
  const valid = [...files].filter((file) => file.type.startsWith("image/"));
  if (!valid.length) return;
  imageSaveStatus.textContent = `正在上傳 ${valid.length} 張圖片到雲端…`;
  let uploaded = 0;
  for (const file of valid) {
    const path = safeFileName(file);
    imageSaveStatus.textContent = `正在上傳圖片 ${uploaded + 1}/${valid.length} 到 Storage…`;
    await uploadImageFile(file, path);
    uploaded += 1;
  }
  imageSaveStatus.textContent = `已上傳 ${uploaded} 張圖片到沐沐雲端圖片庫`;
  await renderImages();
}

async function deleteImage(path) {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${encodeURIComponent(path)}`, {
    method: "DELETE",
    headers: storageHeaders
  });
  if (!response.ok) throw new Error(`刪除失敗：${await response.text()}`);
}

async function renderImages() {
  imageGrid.innerHTML = '<p class="empty-images">正在讀取沐沐雲端圖片庫…</p>';
  const images = await getImages();
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
        const latest = await loadImageNameMap();
        latest[item.path] = newName;
        await saveImageNameMap(latest);
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
        const latest = await loadImageNameMap();
        if (Object.prototype.hasOwnProperty.call(latest, item.path)) {
          delete latest[item.path];
          await saveImageNameMap(latest);
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
}

async function handleFiles(files) {
  try {
    await addImages(files);
  } catch (error) {
    console.error("母卡圖片上傳流程失敗", error);
    imageSaveStatus.textContent = `圖片上傳失敗：${error.message}`;
  }
}

imageInput.addEventListener("change", async () => {
  await handleFiles(imageInput.files);
  imageInput.value = "";
});

["dragenter", "dragover"].forEach((type) => imageDrop.addEventListener(type, (event) => {
  event.preventDefault();
  imageDrop.classList.add("dragging");
}));

["dragleave", "drop"].forEach((type) => imageDrop.addEventListener(type, (event) => {
  event.preventDefault();
  imageDrop.classList.remove("dragging");
}));

imageDrop.addEventListener("drop", async (event) => handleFiles(event.dataTransfer.files));

renderImages().catch((error) => {
  console.error(error);
  imageGrid.innerHTML = `<p class="empty-images">圖片庫讀取失敗：${error.message}</p>`;
});
