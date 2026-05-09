# SEL 情緒大飯店 Firebase 版

這是從 Apps Script + Google Sheets 移植到 GitHub Pages + Firebase Firestore 的版本。

## 版本

- `v1`: 目前穩定版，已保留 Firebase、Google 登入、建立飯店、學生入住、房間牆、同儕回饋、教師後台與樓層 `1000F` 到 `B18`。
- `v2`: 暖光飯店風視覺升級版，規劃只改 UI、美術資產與文案，不改 Firebase 資料結構。

## 快速回到 v1

若 v2 視覺不滿意，優先用 revert 回復 v2 視覺提交，保留 Git 歷史：

```powershell
git revert <v2-commit-sha>
git push origin main
```

也可以查看 v1 穩定點：

```powershell
git checkout v1
```

## Firebase 專案

情緒大飯店使用獨立 Firebase project，避免和其他教學工具共用 Firestore reads/writes 額度。

## Firestore 資料結構

```text
hotels/{hotelId}
hotels/{hotelId}/access/{passcodeHash}
hotels/{hotelId}/rooms/{roomId}
hotels/{hotelId}/rooms/{roomId}/feedbacks/{feedbackId}
```

## 本機測試

可使用任一靜態伺服器預覽，例如：

```powershell
npx.cmd serve .
```

## 部署

GitHub Pages 從 `main` branch 發布。Firebase rules 可由 Firebase Console 或 CLI 部署。
