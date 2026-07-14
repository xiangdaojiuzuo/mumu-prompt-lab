(() => {
  const input = document.querySelector("#peerReferenceInput");
  const drop = document.querySelector("#peerReferenceDrop");
  const preview = document.querySelector("#peerReferencePreview");
  const image = document.querySelector("#peerReferenceImage");
  const name = document.querySelector("#peerReferenceName");
  const removeButton = document.querySelector("#peerReferenceRemove");
  let currentFile = null;
  let previewUrl = "";

  function refreshPrompt() {
    document.querySelector("#builderForm")?.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function clearPreviewUrl() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
  }

  function setFile(file) {
    if (!file?.type?.startsWith("image/")) {
      window.alert("請選擇 JPG、PNG、WEBP 等圖片檔案。");
      return;
    }
    clearPreviewUrl();
    currentFile = file;
    previewUrl = URL.createObjectURL(file);
    image.src = previewUrl;
    name.textContent = file.name;
    drop.hidden = true;
    preview.hidden = false;
    input.value = "";
    refreshPrompt();
  }

  function removeFile() {
    clearPreviewUrl();
    currentFile = null;
    image.removeAttribute("src");
    name.textContent = "";
    preview.hidden = true;
    drop.hidden = false;
    input.value = "";
    refreshPrompt();
  }

  input?.addEventListener("change", () => setFile(input.files?.[0]));
  removeButton?.addEventListener("click", removeFile);

  ["dragenter", "dragover"].forEach((type) => drop?.addEventListener(type, (event) => {
    event.preventDefault();
    drop.classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach((type) => drop?.addEventListener(type, (event) => {
    event.preventDefault();
    drop.classList.remove("dragging");
  }));
  drop?.addEventListener("drop", (event) => setFile(event.dataTransfer?.files?.[0]));
  window.addEventListener("beforeunload", clearPreviewUrl);

  window.mumuPeerReference = {
    getFile: () => currentFile,
    hasFile: () => Boolean(currentFile)
  };
})();
