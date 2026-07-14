(() => {
  const MASTER_REFERENCE = {
    id: "whole-home",
    phase: "全屋大局觀",
    title: "環景與動線整合",
    path: "assets/mumu-home/p5-whole-home.jpg",
    filename: "沐沐居家-全屋大局觀-環景與動線.jpg"
  };

  const references = {
    p2: { id: "p2", phase: "P2", title: "公共區域 A", path: "assets/mumu-home/p2-public-a.jpg", filename: "沐沐居家-P2-公共區域A.jpg" },
    p3: { id: "p3", phase: "P3", title: "公共區域 B", path: "assets/mumu-home/p3-public-b.jpg", filename: "沐沐居家-P3-公共區域B.jpg" },
    p4: { id: "p4", phase: "P4", title: "房間全景 A", path: "assets/mumu-home/p4-private-a.jpg", filename: "沐沐居家-P4-房間全景A.jpg" },
    p5: { id: "p5", phase: "P5", title: "房間細節 B", path: "assets/mumu-home/p5-private-b.jpg", filename: "沐沐居家-P5-房間細節B.jpg" },
    p6: { id: "p6", phase: "P6", title: "房間細節與衛浴", path: "assets/mumu-home/p6-private-details.jpg", filename: "沐沐居家-P6-房間細節與衛浴.jpg" },
    p7: { id: "p7", phase: "P7", title: "房間另一側", path: "assets/mumu-home/p7-private-c.jpg", filename: "沐沐居家-P7-房間另一側.jpg" }
  };

  const sceneMap = {
    "沐沐奶油白房間": "p4",
    "玄關": "p2",
    "客廳": "p2",
    "餐桌區": "p2",
    "陽台": "p3",
    "更衣區": "p6",
    "衛浴外區": "p6"
  };

  function selectedSceneName() {
    return document.querySelector('[data-selector="scene"]')?.selectedOptions?.[0]?.textContent?.trim() || "";
  }

  function getActiveReferences() {
    const areaReference = references[sceneMap[selectedSceneName()]];
    return areaReference ? [MASTER_REFERENCE, areaReference] : [];
  }

  async function referenceToFile(reference) {
    const response = await fetch(reference.path);
    if (!response.ok) throw new Error(`無法讀取${reference.phase}居家設定圖`);
    return new File([await response.blob()], reference.filename, { type: "image/jpeg" });
  }

  async function getActiveFiles() {
    return Promise.all(getActiveReferences().map(referenceToFile));
  }

  function sync() {
    const status = document.querySelector("#homeReferenceStatus");
    if (!status) return;
    const scene = selectedSceneName();
    const active = getActiveReferences();
    status.textContent = active.length
      ? `目前場景：${scene}｜一鍵生圖會自動附上：全屋大局觀＋${active[1].phase} ${active[1].title}`
      : "選擇沐沐家場景後，網站會自動套用全屋大局觀與對應區域 P 圖。";
  }

  document.querySelector("#builderForm")?.addEventListener("change", (event) => {
    if (event.target?.dataset?.selector === "scene") sync();
  });

  window.mumuHomeReference = {
    getActiveReferences,
    getActiveFiles,
    hasActiveReference: () => getActiveReferences().length > 0,
    sync
  };
})();
