function encodeDisplayName(name) {
  const bytes = new TextEncoder().encode(name.trim());
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeDisplayName(value) {
  try {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

const originalDisplayName = displayName;
displayName = function(path) {
  const match = path.match(/^mumu-name-([A-Za-z0-9_-]+)-\d+(\.[^.]+)$/);
  if (match) return decodeDisplayName(match[1]) || originalDisplayName(path);
  return originalDisplayName(path);
};

function imagePathFromDisplayName(name, items) {
  return items.find((item) => displayName(item.name) === name)?.name || null;
}

function renamedImagePath(oldPath, newName) {
  const extension = oldPath.match(/\.[^.]+$/)?.[0]?.toLowerCase() || ".jpg";
  const clean = newName.trim().replace(/[\r\n]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  if (!clean) throw new Error("圖片名稱不能空白");
  return `mumu-name-${encodeDisplayName(clean)}-${Date.now()}${extension}`;
}

async function renameCloudImage(oldPath, newPath) {
  const sourceUrl = await signedImageUrl(oldPath);
  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) throw new Error(`讀取原圖失敗：${await sourceResponse.text()}`);
  const blob = await sourceResponse.blob();

  const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${encodeURIComponent(newPath)}`, {
    method: "POST",
    headers: { ...storageHeaders, "Content-Type": blob.type || "application/octet-stream", "x-upsert": "false" },
    body: blob
  });
  if (!uploadResponse.ok) throw new Error(`建立新名稱失敗：${await uploadResponse.text()}`);

  try {
    await deleteImage(oldPath);
  } catch (error) {
    await deleteImage(newPath).catch(() => {});
    throw error;
  }
}

async function enableCloudImageRename() {
  const items = await getImages();
  imageGrid.querySelectorAll(".image-card").forEach((card) => {
    const input = card.querySelector("input");
    const actions = card.querySelector(".image-card-actions");
    if (!input || !actions || actions.querySelector(".rename-image-button")) return;

    const originalDisplayNameValue = input.value;
    const oldPath = imagePathFromDisplayName(originalDisplayNameValue, items);
    if (!oldPath) return;

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

      try {
        const newPath = renamedImagePath(oldPath, input.value);
        imageSaveStatus.textContent = "正在更新雲端圖片名稱…";
        rename.disabled = true;
        await renameCloudImage(oldPath, newPath);
        imageSaveStatus.textContent = "雲端圖片名稱已更新";
        await renderImages();
      } catch (error) {
        console.error(error);
        input.value = originalDisplayNameValue;
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