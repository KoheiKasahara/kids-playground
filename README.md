# kids-playground

子ども向けのミニゲーム集Webアプリです。スマートフォン・タブレット・PCのブラウザで遊べます。

初期リリースでは「こっきクイズ（国旗クイズ）」を実装しています。4択クイズで1ゲーム10問、「こっきを みて なまえを こたえる」モードと「なまえを みて こっきを こたえる」モードの2種類から選べます。今後、他のミニゲームも追加していく予定です。

- セットアップ・デバッグ手順の詳細は [docs/SETUP.md](docs/SETUP.md) を参照してください。
- 設計の詳細は [docs/DESIGN.md](docs/DESIGN.md) を参照してください。

## 技術構成

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)（ビルドツール）
- [React Router](https://reactrouter.com/)（`HashRouter`）
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)（PWA対応）
- [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/react)（Unit / Componentテスト）
- [GitHub Actions](https://docs.github.com/actions)（CI / デプロイ）
- [GitHub Pages](https://pages.github.com/)（ホスティング）

バックエンド・DB・外部APIは使用しない、静的Webアプリとして構築しています。

## ローカルでの起動方法

```bash
npm install
npm run dev
```

`npm run dev` 実行後、表示されるURL（通常は `http://localhost:5173/`）をブラウザで開いてください。

## テスト

```bash
npm test          # 一度だけ実行 (vitest run)
npm run test:watch  # ウォッチモードで実行 (vitest)
```

`questionGenerator.ts` の問題生成ロジックに対するUnit Testと、`FlagQuizPlay`（こっき → なまえモード、旧URLからのリダイレクトを含む）/ `NameToFlagPlay.test.tsx`（なまえ → こっきモード）/ `Home` など画面の挙動に対するComponent Test（React Testing Library）が含まれます。

## ビルド

```bash
npm run build       # 通常ビルド（base path は '/'）
npm run preview     # ビルド結果をローカルでプレビュー
```

GitHub Pages用にビルドする場合は、`GITHUB_PAGES` 環境変数を指定します。

```bash
npm run build:pages
```

`GITHUB_PAGES=true` のときは `vite.config.ts` 内で base path が `/kids-playground/` に切り替わります（未設定時は `/`）。

## Lint

```bash
npm run lint
```

## GitHub Pages での公開

公開URLは以下になります（`<ユーザー名>` は実際のGitHubユーザー名に置き換えてください）。

```
https://<ユーザー名>.github.io/kids-playground/
```

- `.github/workflows/ci.yml` は push / pull request のたびに lint・test・`build:pages`（`GITHUB_PAGES=true`）を実行し、`main` ブランチへのpush時のみ GitHub Pages へ自動デプロイします。
- リポジトリ側の設定として、**Settings → Pages → Source を「GitHub Actions」に設定する**必要があります（この設定がないとデプロイが反映されません）。
- ルーティングには `HashRouter` を採用しています。GitHub Pagesは静的ホスティングでサーバー側ルーティングを持たないため、`BrowserRouter` だと `/games/flag-quiz/play` のようなパスを直接リロードした際に404になりますが、`HashRouter`（URLが `#/games/flag-quiz/play` の形になる）であればどのページをリロードしても404になりません。

## PWA

- Web App Manifestで `display: "standalone"` を指定しており、スマートフォン・タブレットのホーム画面に追加すると、ブラウザUI（アドレスバーなど）を抑えたアプリのような見た目で起動できます。
- ホーム画面に追加しなくても、通常のWebブラウザ（Chrome / Safari など）からそのままアクセスして遊べます。
- `vite-plugin-pwa` が生成するService Worker（`sw.js`）が、アプリ本体のJS/CSS/HTMLや国旗画像などの静的リソースをキャッシュします。

## 国旗画像の出典・ライセンス

`public/flags/` の国旗SVGは [flag-icons](https://github.com/lipis/flag-icons)（MIT License）から取得しています。詳細・ライセンス全文は [docs/CREDITS.md](docs/CREDITS.md) を参照してください。flag-icons本体は `package.json` の依存関係には追加せず、必要な国旗SVGファイルのみを同梱しています。

## ディレクトリ構成

```text
src/
├─ app/
│  ├─ App.tsx        # ルーティングのエントリ (useRoutes)
│  └─ routes.tsx      # ルート定義
├─ pages/
│  └─ Home.tsx        # ホーム（ゲーム選択）画面
├─ games/
│  └─ flag-quiz/       # 国旗クイズ（ゲーム固有の画面・ロジック・データ）
│     ├─ FlagQuizStart.tsx      # モード選択画面（こっき→なまえ / なまえ→こっき）
│     ├─ FlagQuizPlay.tsx       # プレイ画面（2モード共用、mode propで出し分け）
│     ├─ FlagQuizResult.tsx     # 結果画面（2モード共用、mode propで出し分け）
│     ├─ FlagImage.tsx
│     ├─ questionGenerator.ts   # 問題生成ロジック（Unit Test対象、モードに依存しない）
│     ├─ types.ts
│     └─ data/countries.ts      # 国データ（31か国）
├─ components/         # ゲーム間で共通のUI部品 (BigButton, ProgressBar など)
├─ styles/             # グローバルCSS・デザイントークン
└─ test/setup.ts        # Vitestのテストセットアップ

public/
├─ flags/               # 国旗SVG（flag-icons由来）
└─ icons/                # PWAアイコン

docs/
├─ DESIGN.md            # 概要設計書
├─ SETUP.md             # セットアップ・デバッグ手順
└─ CREDITS.md           # 素材のクレジット・ライセンス表記
```

新しいゲームを追加する場合は `games/<game-name>/` 以下にまとめ、既存ゲームへの影響を抑える方針です。

## 今後追加予定の機能

初期リリースでは以下は対象外としています（詳細は [docs/DESIGN.md](docs/DESIGN.md) 参照）。

- 難易度（出題対象国の数によるかんたん／ふつう／むずかしい）
- 地域別モード（アジア／ヨーロッパなど）
- 効果音
- スコア履歴・LocalStorageへの保存
- 苦手な国旗を中心に出題するモード
- お気に入り国旗
- オフライン対応の強化
- Playwrightを使ったE2Eテスト
- こっきクイズ以外のミニゲーム（かずクイズ、どうぶつクイズ、のりものクイズ、ひらがなゲーム、神経衰弱など）
