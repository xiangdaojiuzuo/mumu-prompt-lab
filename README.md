# mumu-prompt-lab

一個可直接使用的繁體中文單頁網頁：「沐沐提示詞管理器」。

## 功能

- 模式切換：生圖 / 生影片
- 平台選擇：ChatGPT、Grok、Flow、Veo
- 選擇沐沐母卡、角度卡、表情卡、服裝卡、場景卡
- 即時產生正向提示詞、負向提示詞與完整提示詞
- 一鍵複製提示詞
- 清空目前選擇與重設預設資料
- 新增、編輯、刪除卡片
- 使用 localStorage 保存資料，重新整理後仍保留
- 支援桌面與手機版面

## Prompt Lab 2.0 擴充骨架

`studio-v2/` 已建立獨立的模組化架構、功能開關、素材與圖層資料契約、Renderer Interface、Plugin Interface，以及 Prompt Builder 擴充資料層。所有 2.0 功能預設關閉，因此不會改變目前 Prompt Lab 1.0 的畫面與操作流程。

詳細邊界與啟用方式請見 `studio-v2/README.md`。

## 預覽方式

在專案根目錄執行：

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

接著開啟：

```text
http://127.0.0.1:4173/
```
