# RouteCalc — Google Maps 多路線距離計算與可視化

一個使用 **Next.js 15 + TypeScript + Tailwind CSS** 構建的多路線距離計算系統。
輸入出發基準點與多個目標地點，即時計算路線距離並在地圖上同步可視化。

## 功能特色

- 🗺️ **多路線可視化**：在 OpenStreetMap 地圖上同時繪製多條彩色路線
- 📍 **彈性輸入**：支援標準門牌地址或 GPS 座標（lat,lng）
- 🔒 **API 金鑰安全**：Google Maps API Key 嚴格存放於後端，前端完全無法存取
- ⚡ **Kill Switch**：額度耗盡時後端立即攔截所有請求（HTTP 429），防止產生費用
- 📊 **額度監控**：即時顯示 API 使用量進度條，剩餘 10% 時自動彈出預警
- 🌙 **深色/淺色模式**：完整 RWD + Dark/Light Mode 支援
- 📥 **CSV 匯出**：一鍵匯出計算結果

## 系統架構

```
Browser (Frontend)          Node.js Backend              Google APIs
──────────────────          ───────────────              ───────────
/maps page            POST /api/maps/calculate  ──►  Directions API
  QuotaDashboard  ──►  GET /api/maps/quota            Geocoding API
  MapView (OSM)         Kill Switch Check
  ResultsTable     POST /api/maps/quota/reset
```

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

```bash
cp .env.local.example .env.local
```

編輯 `.env.local`，填入您的 Google Maps API Key：

```env
GOOGLE_MAPS_API_KEY=your_real_api_key_here
```

### 3. Google Cloud Console 設定

在 [Google Cloud Console](https://console.cloud.google.com/) 確認以下項目：

- ✅ 已綁定付款帳戶（即使使用免費額度也需要）
- ✅ 已啟用 **Directions API**
- ✅ 已啟用 **Geocoding API**
- ✅ API Key 限制設定正確（Application restrictions 選 `None` 或 IP）

### 4. 啟動開發伺服器

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)

## 技術棧

| 類別 | 技術 |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Map | Leaflet + OpenStreetMap (CDN) |
| Icons | Lucide React |
| Route Data | Google Maps Directions API (server-side) |

## API 端點

| 方法 | 路徑 | 說明 |
|---|---|---|
| `POST` | `/api/maps/calculate` | 計算多條路線（含 Kill Switch） |
| `GET` | `/api/maps/quota` | 取得當前 API 額度狀態 |
| `POST` | `/api/maps/quota/reset` | 重置額度計數器（管理員用） |

## 額度管理

- 預設限制：**40,000 次**（約等於 $200 免費額度）
- 可透過 `MAPS_QUOTA_LIMIT` 環境變數調整
- 達到上限後，所有計算請求將被後端強制阻擋

## License

MIT
