# セットアップ & デバッグ手順

このリポジトリを手元で動かし、デバッグを始めるまでの手順をまとめた資料です。
アプリの概要は [README.md](../README.md)、設計は [DESIGN.md](./DESIGN.md) を参照してください。

---

## 1. 前提環境

| 項目 | 必要バージョン | 確認コマンド |
| --- | --- | --- |
| Node.js | **22 以上**（CI は 22 を使用） | `node -v` |
| npm | 10 以上（Node に同梱） | `npm -v` |
| Git | 任意のバージョン | `git --version` |

Node.js が入っていない場合は [nodejs.org](https://nodejs.org/) の LTS 版、または `winget install OpenJS.NodeJS.LTS` でインストールしてください。

ブラウザは Chrome / Edge を推奨します（DevTools のデバイスエミュレーションと PWA 検査を使うため）。

---

## 2. 初回セットアップ

### 2-1. 依存関係のインストール

```bash
npm install
```

`package-lock.json` の内容どおりに入れ直したい場合（CI と同じ挙動）は次を使います。

```bash
npm ci
```

インストールされる主なパッケージ:

- 実行時: `react` / `react-dom` / `react-router-dom`
- 開発時: `vite` / `typescript` / `@vitejs/plugin-react` / `vite-plugin-pwa` / `vitest` / `@testing-library/*` / `jsdom` / `eslint` 一式

### 2-2. 動作確認（ここまで通ればセットアップ完了）

```bash
npm run lint    # ESLint。エラーなしで終了すればOK
npm test        # Vitest。22 tests passed になればOK
npm run build   # tsc -b && vite build。dist/ が生成されればOK
```

---

## 3. 開発サーバーの起動（デバッグ開始）

```bash
npm run dev
```

- 既定で `http://localhost:5173/` が開けます（表示された URL を確認してください）。
- ファイルを保存すると自動で反映されます（HMR）。
- 停止は `Ctrl + C`。

### スマートフォン実機で確認する場合

```bash
npm run dev -- --host
```

表示された `Network:` の URL（例 `http://192.168.1.10:5173/`）に、同じ Wi-Fi につないだスマホからアクセスします。
Windows のファイアウォールでアクセスがブロックされる場合は、初回のダイアログで「プライベートネットワーク」を許可してください。

---

## 4. 画面と URL の対応

ルーティングは **HashRouter** を使用しているため、URL に `#` が入ります。

| 画面 | URL |
| --- | --- |
| ホーム（ゲーム一覧） | `http://localhost:5173/#/` |
| こっきクイズ 開始 | `http://localhost:5173/#/games/flag-quiz` |
| こっきクイズ プレイ | `http://localhost:5173/#/games/flag-quiz/play` |
| こっきクイズ 結果 | `http://localhost:5173/#/games/flag-quiz/result` |

> 結果画面は正解数を `location.state` で受け取る仕様です。
> URL に直接アクセスすると state が無いため、開始画面へ自動的にリダイレクトされます（仕様どおりの挙動です）。

---

## 5. デバッグの進め方

### 5-1. ブラウザ DevTools

`F12` で DevTools を開きます。

- **Console** … `console.log` と実行時エラーの確認
- **Elements** … CSS Modules 適用後のクラス名・スタイルの確認
- **Network** … 国旗 SVG（`/flags/xx.svg`）が 200 で取得できているかの確認
- **デバイスツールバー**（`Ctrl + Shift + M`）… 子ども向け UI の要である**スマホ縦画面の表示確認**。
  `iPhone SE (375×667)` や `Galaxy S8+ (360×740)` あたりで、
  - 国旗・選択肢・回答後の「つぎへ」バーが縦スクロールなしに収まるか
  - 横スクロールが発生しないか

  を確認してください。

  なお `env(safe-area-inset-*)`（ノッチ・ホームインジケータのぶんの余白）は
  DevTools のデバイスツールバーでは常に 0 になり、iPhone をホーム画面から
  全画面（standalone）で起動したときだけ値が入ります。PC で再現したいときは
  Console から `src/styles/tokens.css` の `--safe-*` を上書きしてください。

  ```js
  // iPhone 13 の全画面表示相当（縦）
  document.documentElement.style.setProperty('--safe-top', '47px')
  document.documentElement.style.setProperty('--safe-bottom', '34px')
  ```

### 5-2. ソースマップ付きブレークポイント

開発サーバーではソースマップが有効なので、DevTools の **Sources** タブで `src/` 配下の `.tsx` を直接開いてブレークポイントを置けます。

### 5-3. VS Code からのデバッグ（任意）

`.vscode/launch.json` を作成すると、VS Code から Chrome を起動してブレークポイントを張れます。

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug kids-playground",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src"
    }
  ]
}
```

`npm run dev` を起動した状態で `F5` を押します。

### 5-4. テストのデバッグ

```bash
npm run test:watch
```

ファイルを保存するたびに関連テストが再実行されます。特定ファイルだけ実行する場合:

```bash
npx vitest run src/games/flag-quiz/questionGenerator.test.ts
```

問題生成ロジック（`src/games/flag-quiz/questionGenerator.ts`）は React に依存しない純粋関数なので、
乱数関数 `random` を差し替えれば決定的に再現できます。実際のテストでは mulberry32 のシード付き乱数を注入しています。

---

## 6. ビルドと本番相当の確認

```bash
npm run build     # dist/ を生成（base は '/'）
npm run preview   # dist/ を http://localhost:4173/ で配信
```

**PWA（Service Worker・インストール）の確認は必ず `preview` 側で行ってください。**
開発サーバー（`npm run dev`）では Service Worker が有効化されないため、PWA の挙動を確認できません。

`npm run preview` 後、DevTools の **Application** タブで確認できる項目:

- Manifest … `display: standalone` / アイコン 192・512 が読めているか
- Service Workers … `sw.js` が activated になっているか
- アドレスバーのインストールアイコンから「アプリをインストール」できるか

> ブラウザによっては PWA のインストールに HTTPS が必要です。`localhost` は例外として許可されますが、
> スマホ実機での最終確認は GitHub Pages へデプロイした後に行うのが確実です。

### GitHub Pages 向けビルドをローカルで再現する

`GITHUB_PAGES=true` のときだけ base が `/kids-playground/` に切り替わります。

PowerShell:

```powershell
$env:GITHUB_PAGES = "true"
npm run build:pages
Remove-Item Env:\GITHUB_PAGES
```

コマンドプロンプト:

```cmd
set GITHUB_PAGES=true && npm run build:pages && set GITHUB_PAGES=
```

`dist/index.html` 内のアセットパスが `/kids-playground/...` になっていれば成功です。
なお、この状態で `npm run preview` すると `http://localhost:4173/kids-playground/` を開く必要があります。

---

## 7. GitHub へ反映して公開するまで

1. リポジトリの **Settings → Pages → Source** を **「GitHub Actions」** に設定する（初回のみ・手動作業）
2. `main` ブランチに push する

   ```bash
   git add .
   git commit -m "初期リリース: 国旗クイズ"
   git push origin main
   ```

3. GitHub の **Actions** タブでワークフローの進行を確認する
   （`npm ci` → `lint` → `test` → `build:pages` → Pages デプロイ の順に実行されます）
4. 完了後、`https://<ユーザー名>.github.io/kids-playground/` で公開されます

> リポジトリ名を `kids-playground` 以外に変更した場合は、`vite.config.ts` の `base` の値も合わせて変更してください。

---

## 8. よくあるトラブル

| 症状 | 原因と対処 |
| --- | --- |
| `npm install` が権限エラーで失敗する | `node_modules` が中途半端な状態で残っている。削除してから `npm install` を再実行 |
| 国旗画像が表示されない（404） | `public/flags/` に 100 個の SVG があるか確認。`Country.flag` は `flags/xx.svg` のような **base 相対パス**（先頭スラッシュなし）である必要がある |
| GitHub Pages でアセットが 404 | `GITHUB_PAGES` 環境変数なしでビルドしている。CI の `build:pages` ステップの `env` 設定を確認 |
| 結果画面を開くと開始画面に戻される | 仕様どおりの挙動（`location.state` が無いため）。プレイ画面から 10 問回答して到達してください |
| 変更が画面に反映されない | Service Worker が古いキャッシュを返している可能性。DevTools → Application → Service Workers → **Unregister** 後にリロード（またはハードリロード `Ctrl + Shift + R`） |
| `npm test` が jsdom 関連で落ちる | `npm install` が中途半端。`node_modules` を消して `npm ci` で入れ直す |
| ポート 5173 が使用中 | 別の Vite が起動中。`npm run dev -- --port 5174` で回避 |

---

## 9. よく使うコマンド早見表

| 目的 | コマンド |
| --- | --- |
| 依存インストール | `npm install` |
| 開発サーバー起動 | `npm run dev` |
| スマホ実機確認 | `npm run dev -- --host` |
| Lint | `npm run lint` |
| テスト（1回） | `npm test` |
| テスト（監視） | `npm run test:watch` |
| ビルド | `npm run build` |
| ビルド結果の確認 | `npm run preview` |
| Pages 向けビルド | `GITHUB_PAGES=true npm run build:pages` |
