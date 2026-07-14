const oneClickGenerationButton = document.querySelector("#oneClickGenerationButton");
const oneClickStatus = document.querySelector("#copyStatus");

function buildAttachedReferencePrompt(fullPrompt) {
  const characterStart = fullPrompt.indexOf("\n\n【沐沐母卡｜");
  if (characterStart < 0) return fullPrompt.trim();

  const nextSection = fullPrompt.indexOf("\n\n【", characterStart + 4);
  const before = fullPrompt.slice(0, characterStart);
  const after = nextSection >= 0 ? fullPrompt.slice(nextSection) : "";
  return `${before}${after}`.trim();
}

oneClickGenerationButton?.addEventListener("click", async () => {
  const fullPrompt = document.querySelector("#fullOutput")?.value?.trim();
  if (!fullPrompt) {
    oneClickStatus.textContent = "目前沒有可用提示詞";
    return;
  }

  oneClickGenerationButton.disabled = true;
  oneClickStatus.textContent = "正在準備半身＋全身母卡…";

  try {
    const [items, names] = await Promise.all([shareListImages(), shareLoadNameMap()]);
    const { half, full } = findOfficialReferences(items, names);
    const missing = [!half ? "半身母卡" : "", !full ? "全身母卡" : ""].filter(Boolean);
    if (missing.length) throw new Error(`找不到${missing.join("、")}；請確認圖片名稱包含「半身」或「全身」`);

    const files = await Promise.all([
      referenceToFile(half, "沐沐官方母卡V3-半身"),
      referenceToFile(full, "沐沐官方母卡V3-全身")
    ]);

    const compactPrompt = buildAttachedReferencePrompt(fullPrompt);
    await navigator.clipboard.writeText(compactPrompt);

    if (!navigator.share || !navigator.canShare?.({ files })) {
      throw new Error("這個瀏覽器不支援直接分享兩張母卡；精簡提示詞已先複製");
    }

    oneClickStatus.textContent = "精簡提示詞已複製；請在分享面板選 ChatGPT";
    await navigator.share({
      files,
      text: compactPrompt,
      title: "沐沐生圖｜半身＋全身母卡"
    });
    oneClickStatus.textContent = "✅ 母卡已送出　📋 提示詞已複製　👉 到 ChatGPT 貼上即可";
  } catch (error) {
    if (error?.name === "AbortError") {
      oneClickStatus.textContent = "已取消分享；精簡提示詞仍在剪貼簿";
    } else {
      console.error("一鍵生圖流程失敗", error);
      oneClickStatus.textContent = `一鍵生圖失敗：${error.message}`;
    }
  } finally {
    oneClickGenerationButton.disabled = false;
  }
});
