# SEL 情緒大飯店 Firebase 版

這是從 Apps Script + Google Sheets 移植到 GitHub + Firebase Firestore 的版本。

## 分開專案

請在同一個 Google 帳號下建立一個新的 Firebase project，專門給情緒大飯店使用。不要和人際導航員共用同一個 project，這樣 reads/writes 免費額度會分開計算。

## 需要貼入的設定

1. 到 Firebase Console 建立 Web App。
2. 複製 Firebase config。
3. 貼到 `firebase-config.js`。
4. 確認 `window.EMOTION_HOTEL_ADMIN_EMAILS` 裡有教師 Google 帳號。

## Firestore 資料結構

```text
hotels/{hotelId}
hotels/{hotelId}/access/{passcodeHash}
hotels/{hotelId}/rooms/{roomId}
hotels/{hotelId}/rooms/{roomId}/feedbacks/{feedbackId}
```

## 本機測試

```powershell
npx.cmd serve .
```

## 部署

```powershell
firebase deploy
```
