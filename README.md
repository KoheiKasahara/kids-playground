# kids-playground

子ども向けのミニゲーム集Webアプリです。スマートフォン・タブレット・PCのブラウザで遊べます。

自由に白鍵・黒鍵をタップして演奏できる「ピアノであそぼう」も収録しています。

すきな形のブロックをえらんでマス目の盤面へならべる、幼児向けパズル「ブロックパズル」も収録しています。ブロックは落ちてこず、時間制限もゲームオーバーもありません。1マスのブロックがあるので、最後まで自分のペースで盤面をうめられます。

色をえらんでエリアをタップするだけで塗れる、幼児向けのぬりえ「うごくぬりえ」も収録しています。くるま・さかな・ちょうちょ・ロボット・ロケット・きょうりゅうの6つの題材から選べ、線からはみ出す心配がありません。

水そうの水をふやしたりへらしたりして、ぷかぷか浮かぶアヒルをゴールまではこぶ「ぷかぷかレスキュー」も収録しています。よこから見た2Dステージで、水がふえるとアヒルが浮かび、水がへると下がります。物理エンジンや流体シミュレーションは使わず、水位・水域・浮力をゲームロジックとして扱う軽量な実装です。

「こっきクイズ」「はたらくくるまクイズ」「さんすうクイズ」「都道府県クイズ」「せかい旅行クイズ」「こっきピンボール」「こっきコロコロぼうけん」「こっきころころめいろ」「こっきコロコロパズル」を収録しています。こっきクイズとはたらくくるまクイズは1ゲーム10問の4択クイズで、写真・図案から名前を答えるモードと、名前から写真・図案を答えるモードがあります。こっきクイズにはさらに、国旗を覆う16枚のパネルを少しずつめくって国名を当てる「パネルめくり」モードもあります。さんすうクイズはたしざん／ひきざん／かけざん／わりざんの4モードから選び、写真ではなく計算式（例: `3 ＋ 4 = ?`）を出題して答えの数値を4択で選びます。都道府県クイズは47都道府県から10問を出題し、形→名前・名前→形・日本地図から探す、の3モードで遊べます。せかい旅行クイズはアジア・ヨーロッパ・アフリカ・北アメリカ・南アメリカ・オセアニアから地域を選び、地図で光る国を4択で答えながら10か国を旅行します。こっきピンボールは国旗ボールを3個選んで打ち出し、物理演算(matter-js)で盤面を転がして得点ゾーンの点数を競う、正誤のないアクションゲームです。こっきコロコロぼうけんは国旗ボールを1個選び、4エリアのコースを操作せずに見守ってゴールを目指す、得点のない別ミニゲームです。こっきころころめいろは好きな国旗を1つ選び、スティック・矢印キー・スマホの傾き（ジャイロ）で盤面を傾けて、3D迷路（Rapierによる物理演算）の国旗ボールをゴールまで転がす、得点も正誤もないミニゲームです。こっきコロコロパズルは縦長の2Dボードへ横板・斜め板を置いてコースを作り、上から落とした国旗ボールを下のゴールまで導く、物理演算(matter-js)のパズルゲームです。つみきボウリングは玉を指でひっぱって離し、スリングショットの要領で積み木のタワーへ勢いよく打ち込んで崩す、3D物理演算(Three.js + Rapier)のアクショントイです。3投で倒した積み木の数を数えるだけで、正誤や失敗はありません。

- セットアップ・デバッグ手順の詳細は [docs/SETUP.md](docs/SETUP.md) を参照してください。
- 設計の詳細は [docs/DESIGN.md](docs/DESIGN.md) を参照してください。
- ミニゲーム追加の規約は [docs/MINIGAME_DEVELOPMENT_GUIDELINES.md](docs/MINIGAME_DEVELOPMENT_GUIDELINES.md) を参照してください。
- ピアノであそぼうの詳細は [docs/PIANO_PLAY_DESIGN.md](docs/PIANO_PLAY_DESIGN.md) を参照してください。
- はたらくくるまクイズの詳細は [docs/WORKING_VEHICLE_QUIZ_DESIGN.md](docs/WORKING_VEHICLE_QUIZ_DESIGN.md) を参照してください。
- さんすうクイズの詳細は [docs/MATH_QUIZ_DESIGN.md](docs/MATH_QUIZ_DESIGN.md) を参照してください。
- こっきクイズ「パネルめくり」モードの詳細は [docs/PANEL_FLAG_QUIZ_DESIGN.md](docs/PANEL_FLAG_QUIZ_DESIGN.md) を参照してください。
- 都道府県クイズの設計は [docs/PREFECTURE_QUIZ_DESIGN.md](docs/PREFECTURE_QUIZ_DESIGN.md) を参照してください。
- いろまぜクイズの設計は [docs/COLOR_MIX_QUIZ_DESIGN.md](docs/COLOR_MIX_QUIZ_DESIGN.md) を参照してください。
- せかい旅行クイズの設計は [docs/WORLD_TRAVEL_QUIZ_DESIGN.md](docs/WORLD_TRAVEL_QUIZ_DESIGN.md) を参照してください。
- こっきピンボールの設計は [docs/FLAG_PINBALL_DESIGN.md](docs/FLAG_PINBALL_DESIGN.md) を参照してください。
- こっきコロコロぼうけんの設計は [docs/FLAG_ROLL_ADVENTURE_DESIGN.md](docs/FLAG_ROLL_ADVENTURE_DESIGN.md) を参照してください。
- こっきころころめいろの設計は [docs/FLAG_ROLL_MAZE_DESIGN.md](docs/FLAG_ROLL_MAZE_DESIGN.md) を参照してください。
- こっきコロコロパズルの設計は [docs/FLAG_ROLL_PUZZLE_DESIGN.md](docs/FLAG_ROLL_PUZZLE_DESIGN.md) を参照してください。
- つみきボウリングの設計は [docs/TSUMIKI_BOWLING_DESIGN.md](docs/TSUMIKI_BOWLING_DESIGN.md) を参照してください。
- うごくぬりえの設計は [docs/COLOR_PAINT_PUZZLE_DESIGN.md](docs/COLOR_PAINT_PUZZLE_DESIGN.md) を参照してください。
- ブロックパズルの設計は [docs/BLOCK_PUZZLE_DESIGN.md](docs/BLOCK_PUZZLE_DESIGN.md) を参照してください。
- ぷかぷかレスキューの設計は [docs/PUKUPUKA_RESCUE_DESIGN.md](docs/PUKUPUKA_RESCUE_DESIGN.md) を参照してください。

## 技術構成

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)（ビルドツール）
- [React Router](https://reactrouter.com/)（`BrowserRouter`）
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

共通問題生成、国旗・車両データと難易度、さんすうの出題プールと誤答生成、各ゲームの画面遷移・モード・10問完了、ホームとルーティングの重要挙動を検証します。

## ビルド

```bash
npm run build       # dist/ を生成（base path は '/'）
npm run preview     # ビルド結果をローカルでプレビュー
```

## Lint

```bash
npm run lint
```

## GitHub Pages（カスタムドメイン）での公開

カスタムドメイン直下で公開しているため、公開URLは以下になります。

```
https://kids.kasapg.com/
```

- `.github/workflows/ci.yml` は push / pull request のたびに lint・test・`build`を実行し、`main` ブランチへのpush時のみ GitHub Pages へ自動デプロイします。
- リポジトリ側の設定として、**Settings → Pages → Source を「GitHub Actions」に設定する**必要があります（この設定がないとデプロイが反映されません）。
- ルーティングには `BrowserRouter` を採用しています。各ゲームは `https://kids.kasapg.com/games/<game-id>` という固有のパスURLを持ち、検索エンジンにインデックスされます。GitHub Pagesは静的ホスティングでサーバー側ルーティングを持たないため、ビルド時（`src/build/staticRoutePages.ts`）にゲームごとの静的HTMLファイル（`games/<slug>/index.html` と `games/<slug>.html`）と、それより深い階層のURL向けのSPAフォールバックとして `404.html` を生成しています。これにより `/games/flag-quiz` の直接アクセスやリロードは実体のHTMLとして200で返り、`/games/flag-quiz/flag-to-name/hard/play` のような深いURLは `404.html`（中身は `index.html` と同じ）が返ってクライアント側ルーティングで正しい画面を描画します。オンライン中のページ遷移はService Workerの `navigateFallback` が引き続きカバーします。旧`HashRouter`時代のブックマーク（`#/games/flag-quiz` のような形）は `src/app/legacyHashRedirect.ts` により新しいパスURLへ自動的に書き換えられます。
- ページごとのSEOメタ情報（title・description・canonical・OGP・Twitterカード）は `src/games/gameCatalog.ts` の各ゲームエントリーが持つ `seo`（`headline`/`description`）を単一情報源としています。`seo` は必須項目のため、新しいゲームを `GAME_CATALOG` に追加するときに書き忘れると型エラーになります。SPA遷移中は `src/seo/SeoManager.tsx` が `useLocation()` の変化を検知して `document` のメタタグを更新し、ビルド時は `src/build/staticRoutePages.ts` が同じ文言をゲームごとの静的HTMLへ焼き込みます（`/games/<slug>` 配下のサブURLはすべて、そのゲームのルートURLへcanonicalが正規化されます）。URLの組み立ては `src/seo/siteMeta.ts` の `absoluteUrl` に集約しています。
- `sitemap.xml` は `src/build/sitemap.ts` がビルド時に `GAME_CATALOG` と `buildGameSeo` のcanonicalから生成し、`dist/sitemap.xml` として出力します。canonicalと同じ関数からURLを取るため両者は必ず一致し、ゲーム追加時の更新漏れも起きません。実際の更新日を継続的に保守できないため `lastmod` は出力していません。`public/robots.txt` は `https://kids.kasapg.com/sitemap.xml` を案内しつつ、`Disallow` は置かずすべての公開ページのクロールを許可しています。
- 構造化データ（JSON-LD, schema.org）は `src/seo/structuredData.ts` が組み立てます。ホームは `WebSite` ノード1つ、各ゲームページは `WebSite` / `WebApplication` / `BreadcrumbList` の3ノードを持つグラフで、`PageSeo.jsonLd`（`src/seo/pageSeo.ts`）として他のメタ情報と一緒に運ばれます。SPA遷移中は `applyDocumentSeo.ts` が `<script type="application/ld+json">` を1個に保ったままupsertし、ビルド時は `staticRoutePages.ts` が各静的HTMLの `</head>` 直前へ焼き込みます（`index.html`/`404.html`もこの経路を通るため、トップ相当のグラフが乗ります）。実在しない評価・価格・作者情報（`aggregateRating`/`review`/`offers`/`author` など）は意図的に一切含めていません。
- 各ゲームルートURL（`/games/<slug>`）には、`src/components/GameIntro.tsx` が検索エンジン向けの本文セクション（概要文とあそびかたの箇条書き、トップへの通常リンク）を1箇所のマウントから自動的に付与します。むずかしさ選択・プレイ・結果などのより深いURLやホームには表示しません。あそびかたの文言は `GAME_CATALOG` の各エントリーの `intro.howToPlay` を単一情報源としています。

## PWA

- Web App Manifestで `display: "standalone"` を指定しており、スマートフォン・タブレットのホーム画面に追加すると、ブラウザUI（アドレスバーなど）を抑えたアプリのような見た目で起動できます。
- ホーム画面に追加しなくても、通常のWebブラウザ（Chrome / Safari など）からそのままアクセスして遊べます。
- `vite-plugin-pwa` が生成するService Worker（`sw.js`）が、アプリ本体のJS/CSS/HTML、国旗SVG、はたらくくるまイラスト、都道府県GeoJSONなどの静的リソースをキャッシュします。
- 更新方式は `registerType: 'prompt'` です。新しいバージョンが見つかっても、遊んでいる最中に勝手にリロードされることはありません。画面下部に「あたらしい バージョンが あります」というトーストが表示され、「こうしんする」を押したときだけ更新が反映されます（クイズの途中で進行が消えるのを防ぐため）。
- 更新確認（`registration.update()`）は、アプリ起動時・タブがバックグラウンドから復帰したとき・60分ごとに自動で行われます。確認するだけで、反映は上記のとおりユーザー操作が必要です。

## 画像の出典・ライセンス

`public/flags/` の国旗SVGは [flag-icons](https://github.com/lipis/flag-icons)（MIT License）由来です。素材ごとの出典、作者、ライセンス、加工内容は [docs/CREDITS.md](docs/CREDITS.md) を参照してください。はたらくくるまクイズ・おやさいクイズなどのイラスト画像はアプリ向けに用意したオリジナル素材です。

## ディレクトリ構成

```text
src/
├─ app/
│  ├─ App.tsx              # ルーティングのエントリ (useRoutes)
│  ├─ routes.tsx            # ルート定義
│  └─ legacyHashRedirect.ts # 旧HashRouter URL（#/games/...）をパスURLへ書き換える互換処理
├─ build/
│  ├─ staticRoutePages.ts   # ビルド時にゲームごとの静的HTMLと404.htmlを生成するViteプラグイン
│  └─ sitemap.ts            # ビルド時にpageSeo由来のURLからsitemap.xmlを生成するViteプラグイン
├─ seo/
│  ├─ siteMeta.ts           # SITE_ORIGIN/SITE_NAMEとURL組み立て(absoluteUrl)の単一情報源
│  ├─ pageSeo.ts             # pathnameからPageSeo(title/description/canonicalなど)を解決する純粋関数
│  ├─ applyDocumentSeo.ts    # PageSeoをdocumentのmeta/linkタグへupsertする(タグを増やさない)
│  └─ SeoManager.tsx         # SPA遷移のたびにapplyDocumentSeoを呼ぶ、描画物を持たないコンポーネント
├─ pages/
│  └─ Home.tsx        # ホーム（ゲーム選択）画面
├─ games/
│  ├─ gameCatalog.ts   # ゲーム一覧の単一情報源（ホーム表示・静的ページ生成・テストで共有）
│  ├─ quiz-core/       # ID付き4択クイズの基本型・問題生成
│  ├─ flag-quiz/       # 国旗クイズ（ゲーム固有の画面・ロジック・データ）
│  │  ├─ FlagQuizStart.tsx      # モード選択画面（3モード）
│  │  ├─ FlagQuizLevelSelect.tsx # むずかしさ選択画面（3モード共用）
│  │  ├─ FlagQuizPlay.tsx       # プレイ画面（flagToName/nameToFlagの2モード共用）
│  │  ├─ FlagQuizResult.tsx     # 結果画面（3モード共用、得点表示は任意）
│  │  ├─ PanelFlagQuizPlay.tsx  # パネルめくりモードのプレイ画面
│  │  ├─ PanelFlag.tsx          # 国旗の上に16枚のパネルを重ねて表示
│  │  ├─ panelScore.ts          # パネルめくりモードの得点計算
│  │  ├─ questionGenerator.ts   # 共通問題生成への互換ラッパー
│  │  ├─ types.ts
│  │  └─ data/countries.ts # 国データ（105か国）
│  ├─ working-vehicle-quiz/ # はたらくくるまクイズ（30車両・2モード）
│  ├─ math-quiz/        # さんすうクイズ（4演算×3むずかしさ、出題は計算式）
│  ├─ flag-pinball/     # こっきピンボール（国旗ボール40種・matter-jsによる物理演算）
│  ├─ flag-roll-adventure/ # こっきコロコロぼうけん（4エリア・固定カメラの見守りコース）
│  ├─ flag-roll-maze/   # こっきころころめいろ（傾き操作で転がす3D迷路・Rapierによる物理演算）
│  ├─ flag-roll-puzzle/ # こっきコロコロパズル（板を置いてゴールへ導く2Dパズル・matter-jsによる物理演算）
│  └─ pukupuka-rescue/ # ぷかぷかレスキュー（水位を変えてアヒルをゴールへ運ぶ2Dゲーム・SVG）
├─ components/         # ゲーム間で共通のUI部品 (BigButton, ProgressBar など)
│  └─ flag-ball/        # こっきピンボール／こっきコロコロぼうけん共通の国旗ボール
├─ styles/             # グローバルCSS・デザイントークン
└─ test/setup.ts        # Vitestのテストセットアップ

public/
├─ flags/               # 国旗SVG（flag-icons由来）
├─ images/
│  ├─ working-vehicles/ # はたらくくるまイラスト（PNG、30枚）
│  ├─ vegetables/       # おやさいイラスト（PNG）
│  └─ fruits/           # くだものイラスト（PNG）
└─ icons/               # PWAアイコン

docs/
├─ DESIGN.md                         # 概要設計書
├─ WORKING_VEHICLE_QUIZ_DESIGN.md    # はたらくくるまクイズ基本設計
├─ MATH_QUIZ_DESIGN.md               # さんすうクイズ基本設計
├─ PANEL_FLAG_QUIZ_DESIGN.md         # こっきクイズ「パネルめくり」モード基本設計
├─ COLOR_MIX_QUIZ_DESIGN.md          # いろまぜクイズ基本設計
├─ FLAG_PINBALL_DESIGN.md            # こっきピンボール基本設計
├─ FLAG_ROLL_ADVENTURE_DESIGN.md     # こっきコロコロぼうけんPhase 1基本設計
├─ FLAG_ROLL_MAZE_DESIGN.md          # こっきころころめいろ基本設計（Phase 3まで）
├─ PUKUPUKA_RESCUE_DESIGN.md         # ぷかぷかレスキューPhase 1基本設計
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
- その他のミニゲーム（どうぶつクイズ、ひらがなゲーム、神経衰弱など）
