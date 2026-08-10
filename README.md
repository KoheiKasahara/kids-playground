# kids-playground

子ども向けのミニゲーム集Webアプリです。スマートフォン・タブレット・PCのブラウザで遊べます。

「こっきクイズ」と「はたらくくるまクイズ」を収録しています。どちらも1ゲーム10問の4択クイズで、写真・図案から名前を答えるモードと、名前から写真・図案を答えるモードがあります。かんたん／ふつう／むずかしいの3段階から選べます。

- セットアップ・デバッグ手順の詳細は [docs/SETUP.md](docs/SETUP.md) を参照してください。
- 設計の詳細は [docs/DESIGN.md](docs/DESIGN.md) を参照してください。
- ミニゲーム追加の規約は [docs/MINIGAME_DEVELOPMENT_GUIDELINES.md](docs/MINIGAME_DEVELOPMENT_GUIDELINES.md) を参照してください。
- はたらくくるまクイズの詳細は [docs/WORKING_VEHICLE_QUIZ_DESIGN.md](docs/WORKING_VEHICLE_QUIZ_DESIGN.md) を参照してください。

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

共通問題生成、国旗・車両データと難易度、両ゲームの画面遷移・2モード・10問完了、ホームとルーティングの重要挙動を検証します。

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
- `vite-plugin-pwa` が生成するService Worker（`sw.js`）が、アプリ本体のJS/CSS/HTML、国旗SVG、はたらくくるま写真などの静的リソースをキャッシュします。

## 画像の出典・ライセンス

`public/flags/` の国旗SVGは [flag-icons](https://github.com/lipis/flag-icons)（MIT License）由来、`public/vehicles/` の24写真はWikimedia Commonsの再配布可能な原作由来です。素材ごとの出典、作者、ライセンス、加工内容は [docs/CREDITS.md](docs/CREDITS.md) を参照してください。

## ディレクトリ構成

```text
src/
├─ app/
│  ├─ App.tsx        # ルーティングのエントリ (useRoutes)
│  └─ routes.tsx      # ルート定義
├─ pages/
│  └─ Home.tsx        # ホーム（ゲーム選択）画面
├─ games/
│  ├─ quiz-core/       # ID付き4択クイズの基本型・問題生成
│  ├─ flag-quiz/       # 国旗クイズ（ゲーム固有の画面・ロジック・データ）
│  │  ├─ FlagQuizStart.tsx      # モード選択画面
│  │  ├─ FlagQuizLevelSelect.tsx # むずかしさ選択画面
│  │  ├─ FlagQuizPlay.tsx       # プレイ画面（2モード共用）
│  │  ├─ FlagQuizResult.tsx     # 結果画面（2モード共用）
│  │  ├─ questionGenerator.ts   # 共通問題生成への互換ラッパー
│  │  ├─ types.ts
│  │  └─ data/countries.ts # 国データ（100か国）
│  └─ working-vehicle-quiz/ # はたらくくるまクイズ（24車両・2モード）
├─ components/         # ゲーム間で共通のUI部品 (BigButton, ProgressBar など)
├─ styles/             # グローバルCSS・デザイントークン
└─ test/setup.ts        # Vitestのテストセットアップ

public/
├─ flags/               # 国旗SVG（flag-icons由来）
├─ vehicles/            # はたらくくるま写真（WebP、24枚）
└─ icons/               # PWAアイコン

docs/
├─ DESIGN.md                         # 概要設計書
├─ WORKING_VEHICLE_QUIZ_DESIGN.md    # はたらくくるまクイズ基本設計
├─ MINIGAME_DEVELOPMENT_GUIDELINES.md # ミニゲーム開発規約
├─ SETUP.md                          # セットアップ・デバッグ手順
└─ CREDITS.md                        # 素材のクレジット・ライセンス表記
```

新しいゲームを追加する場合は `games/<game-name>/` 以下にまとめ、既存ゲームへの影響を抑える方針です。

## 今後追加予定の機能

初期リリースでは以下は対象外としています（詳細は [docs/DESIGN.md](docs/DESIGN.md) 参照）。

- 地域別モード（アジア／ヨーロッパなど）
- 効果音
- スコア履歴・LocalStorageへの保存
- 苦手な国旗を中心に出題するモード
- お気に入り国旗
- オフライン対応の強化
- Playwrightを使ったE2Eテスト
- その他のミニゲーム（かずクイズ、どうぶつクイズ、ひらがなゲーム、神経衰弱など）
