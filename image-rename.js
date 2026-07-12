function imagePathFromDisplayName(name, items) {
  return items.find((item) => displayName(item.name) === name)?.name || null;
}

function renamedImagePath(oldPath, newName) {
  const extension = oldPath.match(/\.[^.]+$/)?.[0]?.toLowerCase() || ".jpg";
  const clean = newName.trim().replace(/[\\/:*?"<>|#%]/g, "-").replace(/\s+/g, " ").slice(0, 80);
  if (!clean) throw new Error("圖片名稱不能空白");
  return `${clean}${extension}`;
}

async function moveCloudImage(oldPath, newPath) {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/move`, {
    method: "POST",
    headers: { ...storageHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: IMAGE_BUCKET, sourceKey: oldPath, destinationKey: newPath })
  });
  if (!response.ok) throw new Error(`改名失敗：${await response.text()}`);
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
        await moveCloudImage(oldPath, newPath);
        imageSaveStatus.textContent = "雲端圖片名稱已更新";
        await renderImages();
      } catch (error) {
        console.error(error);
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
