# 子ども向けミニゲームWebアプリ 概要設計

## 1. 概要

子どもがスマートフォン・タブレット・PCなどで遊べる、シンプルなミニゲームWebアプリを作成する。

初期リリースの「国旗クイズ」に加え、「はたらくくるまクイズ」「さんすうクイズ」を実装する。はたらくくるまクイズの画面・URL・24車両・素材・検収条件は [WORKING_VEHICLE_QUIZ_DESIGN.md](WORKING_VEHICLE_QUIZ_DESIGN.md) を正とし、さんすうクイズの画面・URL・4演算×3むずかしさの出題プール・検収条件は [MATH_QUIZ_DESIGN.md](MATH_QUIZ_DESIGN.md) を正とする。国旗クイズには「パネルめくり」モード（国旗を覆う16枚のパネルを少しずつめくって国名を当てる）を追加しており、画面・URL・パネル仕様・得点計算・検収条件は [PANEL_FLAG_QUIZ_DESIGN.md](PANEL_FLAG_QUIZ_DESIGN.md) を正とする。国旗ボールを打ち出して得点ゾーンを競う「こっきピンボール」の画面・URL・盤面と物理パラメータ・得点仕様は [FLAG_PINBALL_DESIGN.md](FLAG_PINBALL_DESIGN.md) を正とする。国旗ボールを1個選び4エリアを操作せずに見守る「こっきコロコロぼうけん」のPhase 1仕様は [FLAG_ROLL_ADVENTURE_DESIGN.md](FLAG_ROLL_ADVENTURE_DESIGN.md) を正とする。新規ミニゲームの共通規約は [MINIGAME_DEVELOPMENT_GUIDELINES.md](MINIGAME_DEVELOPMENT_GUIDELINES.md) に定める。

将来的には、国旗クイズだけではなく以下のような簡易ゲームを追加できる構成とする。

- 国旗クイズ
- はたらくくるまクイズ
- さんすうクイズ
- こっきコロコロぼうけん
- どうぶつクイズ
- のりものクイズ
- ひらがなゲーム
- 神経衰弱などの簡易ゲーム

特定ゲーム専用アプリではなく、

**「子ども向けミニゲーム集」**

として拡張できる構成を採用する。

---

# 2. 基本方針

以下を基本方針とする。

- 静的Webアプリとして構築する
- GitHubでソースコードを管理する
- GitHub Pagesで公開できるようにする
- バックエンドは使用しない
- DBは使用しない
- APIへの依存を基本的に持たない
- React + TypeScriptを使用する
- PWAとしてインストール可能にする
- 通常のWebブラウザからも利用可能にする
- スマートフォン・タブレットでの利用を重視する
- 子どもが操作しやすいUIとする
- 将来的に複数ゲームを追加しやすい構成にする

---

# 3. 技術構成

| 項目 | 技術 |
| --- | --- |
| Frontend | React |
| Language | TypeScript |
| Build Tool | Vite |
| Routing | React Router |
| CSS | CSS / CSS Modules |
| データ | JSON / TypeScript |
| ローカル保存 | LocalStorage |
| PWA | vite-plugin-pwa |
| Unit Test | Vitest |
| Component Test | React Testing Library |
| E2E Test | Playwright（将来追加） |
| CI/CD | GitHub Actions |
| Hosting | GitHub Pages |

バックエンド、DB、外部APIは初期構成では使用しない。

---

# 4. PWA

アプリはPWA（Progressive Web App）に対応する。

## 4.1 目的

スマートフォン・タブレットのホーム画面から、通常のアプリに近い形で起動できるようにする。

子どもが利用する際にブラウザの

- アドレスバー
- タブ
- ブラウザメニュー

などを誤操作しにくくすることも目的とする。

## 4.2 表示モード

Web App Manifestでは以下を基本とする。

```json
{
  "display": "standalone"
}
```

ホーム画面から起動した場合は、ブラウザUIを極力表示しない。

## 4.3 通常ブラウザ利用

PWA化した場合でも、通常のWebサイトとして利用可能とする。

つまり同じURLについて、

- Chrome / Safariなどからアクセス
- ホーム画面へ追加してPWAとして起動

の両方に対応する。

## 4.4 オフライン

将来的にはService Workerを利用して、

- アプリ本体
- 国旗画像
- 効果音
- ゲームデータ

をキャッシュし、オフラインでも遊べる構成を目指す。

初期実装時から `vite-plugin-pwa` を導入する。

---

# 5. アプリ全体構成

アプリ起動時にはゲーム選択画面を表示する。

```text
ミニゲーム

├─ 国旗クイズ
├─ はたらくくるまクイズ
├─ さんすうクイズ
├─ どうぶつクイズ    （将来）
├─ のりものクイズ    （将来）
├─ ひらがなゲーム    （将来）
└─ その他ゲーム      （将来）
```

現行版では国旗クイズ、はたらくくるまクイズ、さんすうクイズを選択可能とする。

---

# 6. 基本画面遷移

基本的なゲームの画面遷移は以下とする。

```text
ホーム
  ↓
ゲーム選択
  ↓
ゲーム設定
  ↓
ゲームプレイ
  ↓
結果
  ↓
┌─────────────┐
│ もういちど  │
│ ホームへ    │
└─────────────┘
```

国旗クイズの場合は以下。

```text
ホーム
  ↓
国旗クイズ
  ↓
モード選択（こっき→なまえ / なまえ→こっき）
  ↓
むずかしさ選択（かんたん / ふつう / むずかしい）
  ↓
10問出題
  ↓
結果
```

結果画面からは「もういちど（同じモード・むずかしさ）」「べつの むずかしさ（むずかしさ選択へ）」
「べつの クイズ（モード選択へ）」「ホームへ」の4つに遷移できる。

---

# 7. URL構成

React Routerを使用する。

例：

```text
/
└─ ホーム

/games/flag-quiz
└─ 国旗クイズ モード選択（こっき→なまえ / なまえ→こっき）

/games/flag-quiz/flag-to-name
└─ 国旗クイズ むずかしさ選択（こっき → なまえ）

/games/flag-quiz/flag-to-name/:level/play
└─ 国旗クイズプレイ（こっき → なまえ、:level は easy / normal / hard）

/games/flag-quiz/flag-to-name/:level/result
└─ 国旗クイズ結果（こっき → なまえ）

/games/flag-quiz/name-to-flag
└─ 国旗クイズ むずかしさ選択（なまえ → こっき）

/games/flag-quiz/name-to-flag/:level/play
└─ 国旗クイズプレイ（なまえ → こっき、:level は easy / normal / hard）

/games/flag-quiz/name-to-flag/:level/result
└─ 国旗クイズ結果（なまえ → こっき）

/games/flag-quiz/panel-flag
└─ 国旗クイズ むずかしさ選択（パネルめくり）

/games/flag-quiz/panel-flag/:level/play
└─ 国旗クイズプレイ（パネルめくり、:level は easy / normal / hard）

/games/flag-quiz/panel-flag/:level/result
└─ 国旗クイズ結果（パネルめくり）

/games/flag-pinball
└─ こっきピンボール ボール選択（3個えらぶ）

/games/flag-pinball/play
└─ こっきピンボール プレイ（3球射出、むずかしさ選択なし）

/games/flag-pinball/result
└─ こっきピンボール 結果

/games/flag-roll-adventure
└─ こっきコロコロぼうけん 国旗選択（1個えらぶ）

/games/flag-roll-adventure/play
└─ こっきコロコロぼうけん プレイ（4エリアを見守る）

/games/flag-roll-adventure/goal
└─ こっきコロコロぼうけん ゴール（選んだ国旗と国名）
```

`:level` は `easy` / `normal` / `hard` 以外の値だった場合、そのモードのむずかしさ選択画面へ
リダイレクトする（URL直打ちなどの不正な値に対するフォールバック）。

むずかしさ追加前の旧URL（`/games/flag-quiz/play`, `/games/flag-quiz/flag-to-name/play`,
`/games/flag-quiz/name-to-flag/play`, 各 `/result`）は、ブックマークやPWAホーム画面
ショートカットの互換のためリダイレクトとして残す。むずかしさ追加前は全105か国が出題対象
だったため、`/play` 系はすべて `hard`（むずかしい）へ倒す。`/result` 系は結果がstate
（正解数など）に依存し復元できないため、モード選択画面（`/games/flag-quiz`）へ遷移させる。

将来的には、

```text
/games/animal-quiz
/games/number-game
/games/memory-game
```

などを追加する。

GitHub PagesでReact Routerを利用する際のリロード・404対策については、実装時に考慮する。

---

# 8. 国旗クイズ

## 8.1 基本ゲーム

国旗を表示し、対応する国名を選択する。

例：

```text
        🇯🇵

     この国はどこ？

┌─────────┐ ┌─────────┐
│   日本   │ │   韓国   │
└─────────┘ └─────────┘

┌─────────┐ ┌─────────┐
│   中国   │ │   タイ   │
└─────────┘ └─────────┘
```

4択形式を基本とする。

---

# 9. 初期ゲーム仕様

初期リリースでは以下を実装する。

## 出題形式

4択クイズ。

## 問題数

1ゲーム10問。

## 基本モード

### 国旗 → 国名

国旗を表示して国名を選択する。

```text
🇯🇵

この国はどこ？

日本
中国
韓国
タイ
```

### 国名 → 国旗

実装済み。国名を表示して、対応する国旗を4択（2列×2行）から選択する。

```text
「にほん」はどれ？

🇨🇳 🇯🇵
🇰🇷 🇹🇭
```

### パネルめくり

実装済み。国旗を覆う4×4＝16枚のパネルを「もう1まい めくる！」ボタンで少しずつめくりながら、対応する国名を4択から選択する。少ない枚数で当てるほど得点が高い（詳細は [PANEL_FLAG_QUIZ_DESIGN.md](PANEL_FLAG_QUIZ_DESIGN.md)）。

```text
┌─┬─┬─┬─┐
├─┼─┼─┼─┤   この くにの なまえは？
├─┼─┼─┼─┤
└─┴─┴─┴─┘   にほん   かんこく
             ちゅうごく タイ
```

---

# 10. 正解表示

回答後、正解・不正解を分かりやすく表示する。

正解例：

```text
🎉 せいかい！

🇯🇵

にほん

⭐
```

不正解の場合も、正しい国旗・国名が分かるようにする。

子ども向けのため、

- 色
- アイコン
- アニメーション
- 効果音

などによって直感的に結果が分かるUIを検討する。

---

# 11. 難易度

実装済み。モード選択のあと、むずかしさ選択画面（かんたん / ふつう / むずかしい）を挟む。

難易度は選択肢の難しさではなく、

**出題対象となる国の数**

によって調整する。選択肢数はどのむずかしさでも4択のまま変えない。

各国データ（`Country`）に「その国が最初に出題対象になるむずかしさ」を表す
`level: QuizLevel`（`'easy' | 'normal' | 'hard'`）を持たせ、
「指定したむずかしさ以下のランクすべて」を出題対象とする
（かんたん ⊂ ふつう ⊂ むずかしい）。

## かんたん

よく知っている代表的な20か国。

例：

```text
日本
アメリカ
中国
韓国
イギリス
フランス
ドイツ
イタリア
カナダ
ブラジル
```

## ふつう

かんたんの20か国に25か国を加えた、45か国。

## むずかしい

世界中の105か国すべてを対象とする。

---

# 12. 地域別モード

将来的には地域別の出題にも対応する。

例：

```text
世界全部
アジア
ヨーロッパ
北アメリカ
南アメリカ
アフリカ
オセアニア
```

---

# 13. 国データ

国情報はReactコンポーネントへ直接記述せず、ゲームデータとして分離する。

例：

```ts
type Country = {
  id: string;
  nameJa: string;
  nameEn: string;
  continent: Continent;
  flag: string;
};
```

例：

```json
{
  "id": "jp",
  "nameJa": "にほん",
  "nameEn": "Japan",
  "continent": "asia",
  "flag": "/flags/jp.svg"
}
```

---

# 14. 国旗画像

国旗画像はアプリ内の静的リソースとして保持する。

例：

```text
public/
└─ flags/
   ├─ jp.svg
   ├─ us.svg
   ├─ kr.svg
   ├─ cn.svg
   └─ ...
```

外部APIから国旗画像を取得する構成にはしない。

これにより、

- API障害の影響を受けない
- オフライン利用しやすい
- GitHub Pagesのみで完結する

というメリットを得る。

国旗画像のライセンスについては、採用する画像データセットを決定する際に確認する。

---

# 15. 問題生成

国データと問題生成ロジックを分離する。

```text
countries
    ↓
QuestionGenerator
    ↓
FlagQuiz
    ↓
QuestionView
    ↓
ResultView
```

問題生成処理では、

1. 正解となる国を選択
2. 不正解候補を選択
3. 4択を生成
4. 選択肢をシャッフル

する。

同一問題内で同じ国が複数選択肢に含まれないようにする。

1ゲーム内で同じ問題が重複しないことを基本とする。

---

# 16. ゲーム共通機能

ゲーム固有処理と共通機能を分離する。

共通化候補：

```text
スコア
問題数
正解数
効果音
設定
結果画面
ゲーム開始
ゲーム終了
もう一度遊ぶ
ホームへ戻る
```

ゲーム結果の基本型：

```ts
type GameResult = {
  score: number;
  correctCount: number;
  totalCount: number;
};
```

ただし、初期段階では過度な抽象化を行わない。

必要になったタイミングで共通化する。

---

# 17. LocalStorage

サーバー・DBは使用せず、端末内に保存する情報についてはLocalStorageを使用する。

将来的には以下を保存できるようにする。

```text
最高スコア
プレイ回数
正解数
国ごとの正解数
国ごとの不正解数
苦手な国
お気に入り
ゲーム設定
効果音設定
```

国旗クイズ進捗データ例：

```ts
type FlagQuizProgress = {
  playCount: number;
  highScore: number;

  countryStats: Record<
    string,
    {
      correct: number;
      incorrect: number;
    }
  >;
};
```

---

# 18. 将来の学習機能

LocalStorageに蓄積したデータを利用して、

```text
にがてな国旗だけクイズ
よく間違える国旗
まだ正解していない国旗
お気に入り国旗
```

などのモードを追加できるようにする。

---

# 19. 子ども向けUI

主な利用者が子どもであるため、一般的なWebサイトとは異なるUI設計を行う。

## 基本方針

- ボタンを大きくする
- タップ領域を広くする
- 小さい文字を極力使わない
- 難しい漢字を極力使わない
- ひらがなを積極的に使用する
- 国旗を大きく表示する
- 誤タップしにくい余白を確保する
- スマートフォン縦画面でも遊べる
- タブレットにも対応する
- 操作説明を極力減らす
- 文字を読めなくてもある程度操作できるようにする

---

# 20. 効果音

将来的に以下の効果音を追加する。

```text
正解
不正解
ボタン
ゲーム開始
ゲーム終了
```

音量ON/OFF設定を用意する。

音声ファイルはアプリ内の静的リソースとして保持する。

```text
public/
└─ sounds/
   ├─ correct.mp3
   ├─ incorrect.mp3
   └─ ...
```

---

# 21. ディレクトリ構成

想定構成：

```text
src/
├─ app/
│  ├─ App.tsx
│  └─ routes.tsx
│
├─ games/
│  ├─ flag-quiz/
│  │  ├─ FlagQuiz.tsx
│  │  ├─ FlagQuizMenu.tsx
│  │  ├─ FlagQuestion.tsx
│  │  ├─ FlagResult.tsx
│  │  ├─ questionGenerator.ts
│  │  ├─ types.ts
│  │  │
│  │  └─ data/
│  │     └─ countries.json
│  │
│  ├─ flag-pinball/
│  │  ├─ FlagPinballSelect.tsx  # ボール選択画面
│  │  ├─ FlagPinballPlay.tsx    # プレイ画面
│  │  ├─ FlagPinballResult.tsx  # 結果画面
│  │  ├─ usePinballEngine.ts    # matter-jsをヘッドレスで回すフック
│  │  ├─ boardLayout.ts         # 盤面・得点ゾーンの論理座標データ
│  │  └─ data/pinballFlags.ts   # 選択画面に並べる国旗ボール（flag-quizのCountryを再利用）
│  │
│  └─ ...
│
├─ components/
│  ├─ GameButton.tsx
│  ├─ GameResult.tsx
│  ├─ Score.tsx
│  └─ BackButton.tsx
│
├─ hooks/
│  ├─ useSound.ts
│  └─ useGameScore.ts
│
├─ storage/
│  └─ gameStorage.ts
│
├─ assets/
│  ├─ images/
│  └─ sounds/
│
└─ styles/
```

ゲームごとの処理は、

```text
games/<game-name>/
```

以下にまとめる。

これにより新しいゲームを追加するときに既存ゲームへの影響を減らす。

---

# 22. アーキテクチャ

大まかには以下の構成とする。

```text
┌────────────────────────────┐
│            UI              │
│ Question / Result / Menu   │
├────────────────────────────┤
│        Game Logic          │
│ QuestionGenerator          │
├────────────────────────────┤
│         Game Data          │
│ countries.json             │
├────────────────────────────┤
│      Shared Game Core      │
│ Score / Sound / Settings   │
├────────────────────────────┤
│          Storage           │
│ LocalStorage               │
└────────────────────────────┘
```

---

# 23. テスト

## Unit Test

Vitestを使用する。

特に問題生成処理についてテストする。

例：

- 正解が選択肢に含まれる
- 選択肢が4つ生成される
- 選択肢が重複しない
- 出題対象外の国が含まれない
- 1ゲーム内で問題が重複しない

## Component Test

React Testing Libraryを使用する。

例：

- 問題が表示される
- 回答できる
- 正解表示される
- 次の問題へ進める
- 結果画面へ遷移する

## E2E Test

Playwrightを将来的に導入する。

代表的なシナリオ：

```text
ホーム
↓
国旗クイズ開始
↓
10問回答
↓
結果表示
↓
もう一度遊ぶ
```

---

# 24. GitHub Actions

GitHub Actionsを利用する。

基本的には以下を実行する。

```text
npm install
↓
lint
↓
unit test
↓
build
↓
GitHub Pages deploy
```

mainブランチへのマージ後、自動的にGitHub Pagesへデプロイできる構成を目指す。

---

# 25. 初期リリース範囲

最初からすべて実装しない。

初期リリースは以下に限定する。

## 必須

- React + TypeScript + Vite
- GitHub Pages
- PWA
- ホーム画面
- 国旗クイズ
- 国旗 → 国名
- 国名 → 国旗（初期リリース後に追加）
- 難易度（かんたん / ふつう / むずかしい、初期リリース後に追加）
- 4択
- 1ゲーム10問
- 正解 / 不正解表示
- 結果画面
- もう一度遊ぶ
- ホームへ戻る
- スマートフォン対応
- タブレット対応
- 基本的なUnit Test
- GitHub Actions

## 初期リリースでは必須にしない

- 地域別モード
- 効果音
- スコア履歴
- 苦手国旗
- お気に入り
- オフライン完全対応
- Playwright
- その他ミニゲーム

---

# 26. 将来拡張

想定している拡張：

## 国旗クイズ

「国旗 → 国名」「国名 → 国旗」「4択」「難易度別（かんたん / ふつう / むずかしい）」は実装済み。
今後は以下を拡張予定。

```text
2択
地域別
連続正解チャレンジ
苦手国旗
お気に入り国旗
```

## ミニゲーム追加

```text
ひらがな
どうぶつ
のりもの
神経衰弱
その他簡易ゲーム
```

---

# 27. 設計上の重要方針

以下を特に重視する。

## シンプルにする

個人利用・子ども向けアプリであるため、必要以上に複雑なアーキテクチャを採用しない。

## 過度に共通化しない

将来的にゲームを追加する予定ではあるが、最初から巨大なゲームフレームワークは作らない。

まず国旗クイズを完成させる。

複数ゲームで同じ処理が必要になった段階で共通化する。

## ゲーム固有処理を分離する

各ゲームは、

```text
games/<game-name>/
```

以下で可能な限り完結させる。

## データとロジックを分離する

国情報などのマスタデータと、問題生成ロジックを分離する。

## 静的サイトとして完結させる

可能な限り、

```text
GitHub
+
GitHub Actions
+
GitHub Pages
```

のみで運用できる構成とする。

---

# 28. 初期完成イメージ

```text
PWA起動

      ↓

┌─────────────────┐
│   ミニゲーム     │
│                 │
│   🌏 国旗クイズ  │
└─────────────────┘

      ↓

┌─────────────────┐
│      🇯🇵        │
│                 │
│ この国はどこ？  │
│                 │
│ 日本     韓国   │
│ 中国     タイ   │
└─────────────────┘

      ↓

┌─────────────────┐
│ 🎉 せいかい！   │
│                 │
│      🇯🇵        │
│                 │
│     にほん      │
└─────────────────┘

      ↓

10問終了

      ↓

┌─────────────────┐
│     けっか      │
│                 │
│   8 / 10問！    │
│                 │
│  もういちど     │
│  ホームへ       │
└─────────────────┘
```

---

# 29. 開発優先順位

以下の順番で実装する。

1. React + TypeScript + Viteプロジェクト作成
2. GitHub Pages公開環境構築
3. PWA設定
4. React Router設定
5. ホーム画面
6. 国データ作成
7. 国旗画像配置
8. 問題生成ロジック
9. 国旗クイズ画面
10. 回答判定
11. 10問進行処理
12. 結果画面
13. Unit Test
14. Component Test
15. GitHub Actions
16. スマートフォン / タブレット調整

ここまでを初期リリースとする。

その後、

1. 効果音
2. LocalStorage
3. 地域別
4. 苦手国旗
5. オフライン対応強化
6. Playwright
7. 他のミニゲーム

の順で拡張を検討する（「国名 → 国旗」「難易度（かんたん / ふつう / むずかしい）」は実装済み）。
