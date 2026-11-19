# 《長夢一命》美術交接

風格：字為主嘅文字掛機 RPG。深藍夜色＋暖燈金。適合 iPhone，底部分頁六格，對比清晰。呢套係原創夜色介面，唔好套用《冒險者公會》嘅暖色木屋／像素／羊皮紙風。

`art/preview/phone-mockup.html` 只係離線預覽，**唔係正式入口**，請唔好將佢當 `index.html` 用。程式骨架由程式員負責，本目錄唔會建立或覆寫 `index.html`、`js/`。

---

## 檔案

```
art/
  palette.md              色板說明（hex、用途、WCAG 對比）
  palette.png             色票視覺一覽
  README.md               本說明
  icons/
    tab-action.png        行動（金色，96×96 透底）
    tab-bag.png           背包
    tab-skill.png         技能
    tab-quest.png         任務
    tab-log.png           紀錄
    tab-settings.png      設定
    muted/                同一套線稿嘅灰藍非活躍態
      tab-action.png
      tab-bag.png
      tab-skill.png
      tab-quest.png
      tab-log.png
      tab-settings.png
  preview/
    phone-mockup.html     iPhone 390×844 預覽（離線可開）
css/
  theme.css               色、字級、圓角、陰影、安全區變數
  layout.css              頂欄／主區／底 Tab／卡片／按鈕／列表
```

圖示全部用 PIL 程式繪製（8 倍線稿再縮小），唔係插畫、唔係像素。線色：活躍暖金 `#E2B65A`，非活躍灰藍 `#8B96AB`。

---

## 程式點樣引入 CSS

建議次序：

```html
<link rel="stylesheet" href="css/theme.css">
<link rel="stylesheet" href="css/layout.css">
```

若已有結構檔 `css/base.css`，請放喺 theme **之前**：

```html
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/theme.css">
<link rel="stylesheet" href="css/layout.css">
```

`theme.css` 會覆寫 `base.css` 嘅 `--cm-*`，亦會覆寫 `style.css` 嘅 `--bg`、`--ink`、`--gold` 等短名，所以後載入 theme 就可以換到正式色板。請**保留**程式已有嘅 `css/base.css`、`css/style.css`，唔好刪。若 `style.css` 同 `layout.css` 嘅版面規則打架，視覺以 `theme.css` + `layout.css` 為準；程式 DOM 用緊嘅結構 class（`.cm-app`、`.cm-nav` 等）請保留。

預覽頁嘅相對路徑（由 `art/preview/` 出發）係 `../../css/theme.css` 同 `../../css/layout.css`。

遊戲固定夜色，唔使寫淺色 `prefers-color-scheme` 分支。安全區用 `--safe-bottom: env(safe-area-inset-bottom)`（見 theme）。

---

## 圖示命名同放置

| 分頁 | 檔名 | 語義 |
| --- | --- | --- |
| 行動 | `tab-action.png` | 雙層向上折線（前進箭） |
| 背包 | `tab-bag.png` | 有蓋布袋 |
| 技能 | `tab-skill.png` | 圈內四角星／符 |
| 任務 | `tab-quest.png` | 旗桿同方旗 |
| 紀錄 | `tab-log.png` | 打開嘅書 |
| 設定 | `tab-settings.png` | 齒輪 |

活躍 Tab 用 `art/icons/tab-*.png`（金），非活躍用 `art/icons/muted/tab-*.png`（灰藍）。唔好用 CSS filter 去改色，兩套已經畫好，細圖更穩。

圖示而家放喺 `art/icons/`。程式若預留 `assets/icons/`，請 **copy 或 symlink**，唔好改藝術檔本身：

```bash
# 例子：喺專案根目錄
mkdir -p assets/icons
# 複製
cp art/icons/tab-*.png assets/icons/
cp -R art/icons/muted assets/icons/muted
# 或符號連結（開發期）
ln -sfn ../../art/icons/tab-action.png assets/icons/tab-action.png
```

正式 HTML 可以咁寫（路徑按你實際放置調整）：

```html
<button class="cmy-tab is-active">
  <img class="cmy-tab__icon" src="assets/icons/tab-action.png" alt="">
  <span class="cmy-tab__label">行動</span>
</button>
<button class="cmy-tab">
  <img class="cmy-tab__icon" src="assets/icons/muted/tab-bag.png" alt="">
  <span class="cmy-tab__label">背包</span>
</button>
```

切換分頁時，活躍項改用金色檔並加 `is-active`；其餘改回 `muted/` 並移除 `is-active`。圖示係裝飾性，請留空 `alt`，標籤文字已經說明分頁。

規格：96×96、RGBA 透底 PNG。介面顯示建議 24×24 CSS px（` --icon-size-tab`）。

---

## 版面 class（layout.css）

美術組件用 `cmy-` 前綴，避免同程式現有 `.topbar`、`.btn`、`.tabs` 撞名。

- 殼：`.cmy-app`
- 頂欄：`.cmy-topbar`、`.cmy-topbar__title`、`.cmy-topbar__sub`
- 狀態：`.cmy-status`、`.cmy-stat`、`.cmy-meter`
- 主區（可捲）：`.cmy-main`
- 日誌：`.cmy-log`、`.cmy-log__item`、`.cmy-log__meta`、`.cmy-log__body`
- 底欄：`.cmy-tabbar`、`.cmy-tab`、`.cmy-tab.is-active`
- 卡片／按鈕／列表：`.cmy-card`、`.cmy-btn`、`.cmy-btn--primary`、`.cmy-list`

主按鈕係金底墨字，觸控高度約 44px。正文 16px、行高 1.7。字體 stack：PingFang TC / Noto Sans TC / system-ui。

`layout.css` 末段有少量兼容規則：若用緊 `base.css` 嘅 `.cm-nav`，會改成六欄；`.cm-btn-primary` 會改成金底墨字。

---

## 色板摘要

- 夜空底 `#0D1424`　面板 `#161E30`　抬升 `#1C2540`　底欄 `#101828`
- 主文 `#F2F0EA`　次文 `#8B96AB`　弱化 `#7B869D`
- 暖燈金 `#E2B65A`　亮金 `#F0C56E`　金底墨字 `#1A1408`
- 邊線 `#2A3348`
- 成功 `#5E9A70`　警告 `#D19A4C`　危險 `#C47272`

詳細對比見 `palette.md`。主文對夜空約 16.1:1，次文約 6.2:1，金色約 9.7:1，全部達 AA 或以上。

---

## 其他注意

- 全部玩家可見文字用繁體中文。
- `art/icon.svg` 若已存在，係其他隊友嘅檔，今次交付冇改佢。底欄圖示以 `art/icons/*.png` 為準。
- 唔好把預覽裡嘅假資料（體力、金幣、日誌）當正式文案或數值。
