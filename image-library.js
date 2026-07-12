const SUPABASE_URL = "https://oeotcilwmjcvrryoenqb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_K_7F9bwnDLf-w9AbDd8elg_-yQaXpaj";
const IMAGE_BUCKET = "mumu-images";

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
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${IMAGE_BUCKET}`, {
    method: "POST",
    headers: { ...storageHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 1000, offset: 0, sortBy: { column: "created_at", order: "desc" } })
  });
  if (!response.ok) throw new Error(`讀取圖片失敗：${await response.text()}`);
  const items = await response.json();
  return items.filter((item) => item.name && item.metadata).map((item) => ({
    id: item.id || item.name,
    path: item.name,
    name: displayName(item.name),
    createdAt: item.created_at
  }));
}

async function addImages(files) {
  const valid = [...files].filter((file) => file.type.startsWith("image/"));
  if (!valid.length) return;
  imageSaveStatus.textContent = `正在上傳 ${valid.length} 張圖片到雲端…`;
  let uploaded = 0;
  for (const file of valid) {
    const path = safeFileName(file);
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${encodeURIComponent(path)}`, {
      method: "POST",
      headers: { ...storageHeaders, "Content-Type": file.type, "x-upsert": "false" },
      body: file
    });
    if (!response.ok) throw new Error(`上傳失敗：${await response.text()}`);
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
        imageSaveStatus.textContent = "雲端圖片已刪除";
        await renderImages();
      } catch (error) {
        console.error(error);
        imageSaveStatus.textContent = `圖片刪除失敗：${error.message}`;
      }
    });
    actions.append(view, remove);
    body.append(name, actions);
    card.append(img, body);
    imageGrid.append(card);
  }
}

async function handleFiles(files) {
  try {
    await addImages(files);
  } catch (error) {
    console.error(error);
    imageSaveStatus.textContent = `圖片處理失敗：${error.message}`;
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