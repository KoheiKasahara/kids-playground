# セットアップ

> この文書は長期的な設計・運用方針を扱う。個別機能の最新仕様は GitHub Issue、現在の詳細挙動・パラメータは実装コードとテストを正とする。

このリポジトリを手元で動かすための最低限の手順です。アプリの概要は [README.md](../README.md)、設計方針は [architecture.md](./architecture.md) を参照してください。

## 前提環境

- Node.js（CIと同じメジャーバージョンを `.nvmrc` に、対応範囲を `package.json` の `engines` に記載。`node -v` で確認）
- npm（Nodeに同梱。`npm -v` で確認）
- Git

ブラウザは Chrome / Edge など、DevTools のデバイスエミュレーションと PWA 検査ができるものを推奨します。

## 依存関係のインストール

```bash
npm install
```

`package-lock.json` の内容どおりに入れ直したい場合（CIと同じ挙動）は次を使います。

```bash
npm ci
```

## ローカルでの起動

```bash
npm run dev
```

表示されたURL（通常は `http://localhost:5173/`）をブラウザで開きます。ファイルを保存すると自動で反映されます。

スマートフォン実機で確認する場合は次のようにホストを開放します。

```bash
npm run dev -- --host
```

表示される `Network:` のURLに、同じネットワークに接続した端末からアクセスします。

## Lint

```bash
npm run lint
```

## 型チェック

`tsc` は `@typescript/native` の別名で導入した TypeScript 7 を使います。
TypeScript 6 の Compiler API が必要な ESLint と依存境界検査には、
[Microsoft の移行手順](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)に従い `typescript` を `@typescript/typescript6` の別名として残しています。

```bash
npm run typecheck
```

## テスト

日常的な確認には、通常のunit（node）とDOM（jsdom）テストを実行する次のコマンドを使います。長時間の物理試行はFull側で実行します。

```bash
npm run test:quick
```

すべてのVitestテスト（時間のかかるものを含む）を実行する場合は次を使います。E2Eと依存境界検査は別コマンドです。

```bash
npm test
```

ファイルを保存するたびに関連テストを再実行したい場合は次を使います。

```bash
npm run test:watch
```

lint（依存境界検査を含む）・型チェック・Quick・buildをまとめて実行するコマンドは `npm run verify`、QuickをFullに置き換えたものは `npm run verify:full` です。**どちらもE2Eを含みません。**

### 変更別の検証

作業中は `npm run test:game -- src/games/<game-id>` などで対象を絞って確認し、完了前には次の表を適用します。複数行に該当する変更は必要な検証を合わせ、同じ検証を重複実行しません。関連テストはファイル名だけでなく参照元への影響から選びます。

| 変更内容 | 完了前の検証 |
| --- | --- |
| Markdownのみ | 記述と実装・コマンドの整合、リンク先、`git diff --check`。実行コードに変更がなければアプリテストは不要 |
| 単独ゲームのロジック・データ・保存・UI | `npm run verify`。既存例外で他ゲームから参照されている場合は参照元も対象にする。表示・操作の変更は狭い縦画面で確認し、該当する既存E2Eがあれば実行 |
| ゲーム追加・カタログ・ルート | `npm run verify` と `npm run test:e2e`。追加ゲームは `npx playwright test e2e/all-games.smoke.spec.ts --grep <game-id>` で実ブラウザの入口も確認 |
| 共通UI・音声・保存・共通ロジック | `npm run verify` と `npm run test:e2e`。利用側の代表操作を確認。音の変更は既存の音量テストも対象にする |
| 物理・シミュレーション・3D資源管理 | `npm run verify` に加え、影響するゲームのFullテストを `npm run test:game -- src/games/<game-id>` で実行。該当する実操作E2Eと退出・再入場を確認。共通物理基盤への影響が広い場合は `npm run verify:full` を使う |
| PWA・静的ページ生成・素材キャッシュ | `npm run verify` と `npm run test:e2e`。ビルド後のpreviewで、対象素材のオフライン利用と更新時の進行維持を確認 |
| 依存境界検査・例外定義 | `npm run verify`（検査器自身のテストを含む）。例外変更時は参照元・参照先の関連テストも確認 |
| E2E・テスト設定・検証を変えるCIやpackage scripts・依存更新 | `npm run verify:full` と `npm run test:e2e:nightly`。Nightlyと同じ全E2Eを変更の公開前に先行確認 |

E2Eは **最新の `npm run build` の後** に実行します。初回は `npx playwright install chromium` でブラウザを用意します。`npm run test:e2e` は通常CIの選抜smoke、`npm run test:e2e:nightly` は全E2Eです。既存previewを再利用する場合も最新の成果物であることを確認してください。

依存境界だけを確認するときは `npm run check:boundaries`、検査器の回帰テストは `npm run test:boundaries` です。規則と例外の扱いは [開発規約](./development-guidelines.md#依存境界と既存例外) を参照してください。

環境上実行できない検証があれば、未実施のコマンド・理由・残る確認事項を報告します。テスト削除・skip・検査範囲の縮小で成功扱いにしません。

## ビルドとプレビュー

```bash
npm run build     # dist/ を生成
npm run preview   # ビルド結果をローカルで配信
```

PWA（Service Worker・インストール）の挙動確認は、開発サーバーではなく `npm run preview` 側で行ってください。開発サーバーでは Service Worker が有効化されないため、PWA固有の挙動を確認できません。

## デバッグ時の注意

- ソースマップが有効なため、DevTools の Sources タブから `src/` 配下のファイルへ直接ブレークポイントを置けます。
- 画面レイアウトはスマートフォンの縦画面を主対象としているため、デバイスツールバーで縦長の狭い画面を確認してください。
- Service Worker が古いキャッシュを返している場合は、DevTools の Application タブから登録解除してからリロードしてください。
