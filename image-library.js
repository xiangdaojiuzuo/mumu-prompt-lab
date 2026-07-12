const IMAGE_DB_NAME = "mumu-prompt-images";
const IMAGE_DB_VERSION = 1;
const IMAGE_STORE = "images";
const imageInput = document.querySelector("#imageInput");
const imageGrid = document.querySelector("#imageGrid");
const imageDrop = document.querySelector("#imageDrop");

function openImageDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function imageStore(mode = "readonly") {
  const db = await openImageDb();
  return db.transaction(IMAGE_STORE, mode).objectStore(IMAGE_STORE);
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getImages() {
  const store = await imageStore();
  const images = await requestResult(store.getAll());
  return images.sort((a, b) => b.createdAt - a.createdAt);
}

async function addImages(files) {
  const valid = [...files].filter((file) => file.type.startsWith("image/"));
  if (!valid.length) return;
  const db = await openImageDb();
  const transaction = db.transaction(IMAGE_STORE, "readwrite");
  const store = transaction.objectStore(IMAGE_STORE);
  valid.forEach((file, index) => store.put({
    id: `image-${Date.now()}-${index}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    name: file.name.replace(/\.[^.]+$/, "") || "沐沐母卡",
    blob: file,
    createdAt: Date.now() + index
  }));
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  document.querySelector("#saveStatus").textContent = `已儲存 ${valid.length} 張圖片到這台裝置`;
  await renderImages();
}

async function renameImage(id, name) {
  const store = await imageStore("readwrite");
  const item = await requestResult(store.get(id));
  if (!item) return;
  item.name = name.trim() || "未命名母卡";
  await requestResult(store.put(item));
  document.querySelector("#saveStatus").textContent = "圖片名稱已保存";
}

async function deleteImage(id) {
  const store = await imageStore("readwrite");
  await requestResult(store.delete(id));
  document.querySelector("#saveStatus").textContent = "圖片已刪除";
  await renderImages();
}

async function renderImages() {
  const images = await getImages();
  if (!images.length) {
    imageGrid.innerHTML = '<p class="empty-images">還沒有圖片。把真正的沐沐母卡丟進上面就好 😆</p>';
    return;
  }
  imageGrid.innerHTML = "";
  images.forEach((item) => {
    const url = URL.createObjectURL(item.blob);
    const card = document.createElement("article");
    card.className = "image-card";
    const img = document.createElement("img");
    img.src = url;
    img.alt = item.name;
    img.onload = () => URL.revokeObjectURL(url);
    const body = document.createElement("div");
    body.className = "image-card-body";
    const name = document.createElement("input");
    name.value = item.name;
    name.setAttribute("aria-label", "圖片名稱");
    name.addEventListener("change", () => renameImage(item.id, name.value));
    const actions = document.createElement("div");
    actions.className = "image-card-actions";
    const view = document.createElement("button");
    view.type = "button";
    view.textContent = "看大圖";
    view.addEventListener("click", () => {
      const fullUrl = URL.createObjectURL(item.blob);
      window.open(fullUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(fullUrl), 60000);
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "刪除";
    remove.addEventListener("click", async () => {
      if (confirm(`確定刪除「${item.name}」？`)) await deleteImage(item.id);
    });
    actions.append(view, remove);
    body.append(name, actions);
    card.append(img, body);
    imageGrid.append(card);
  });
}

imageInput.addEventListener("change", async () => {
  await addImages(imageInput.files);
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
imageDrop.addEventListener("drop", async (event) => addImages(event.dataTransfer.files));

renderImages().catch(() => {
  imageGrid.innerHTML = '<p class="empty-images">瀏覽器無法開啟圖片儲存空間。</p>';
});