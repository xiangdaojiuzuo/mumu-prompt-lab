function imagePathFromDisplayName(name, items) {
  return items.find((item) => displayName(item.name) === name)?.name || null;
}

function renamedImagePath(oldPath, newName) {
  const extension = oldPath.match(/\.[^.]+$/)?.[0]?.toLowerCase() || ".jpg";
  const clean = newName.trim().replace(/[\\/:*?"<>|#%]/g, "-").replace(/\s+/g, " ").slice(0, 80);
  if (!clean) throw new Error("圖片名稱不能空白");
  return `${clean}${extension}`;
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

    const originalDisplayName = input.value;
    const oldPath = imagePathFromDisplayName(originalDisplayName, items);
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
        if (newPath === oldPath) {
          input.readOnly = true;
          rename.textContent = "改名";
          return;
        }
        imageSaveStatus.textContent = "正在更新雲端圖片名稱…";
        rename.disabled = true;
        await renameCloudImage(oldPath, newPath);
        imageSaveStatus.textContent = "雲端圖片名稱已更新";
        await renderImages();
      } catch (error) {
        console.error(error);
        input.value = originalDisplayName;
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
enableCloudImageRename().catch((error) => console.error(error));