# セットアップ

> この文書は長期的な設計・運用方針を扱う。個別機能の最新仕様は GitHub Issue、現在の詳細挙動・パラメータは実装コードとテストを正とする。

このリポジトリを手元で動かすための最低限の手順です。アプリの概要は [README.md](../README.md)、設計方針は [architecture.md](./architecture.md) を参照してください。

## 前提環境

- Node.js（CIが使用するメジャーバージョンに合わせる。`node -v` で確認）
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

```bash
npm run typecheck
```

## テスト

日常的な確認には、DOM描画を伴わない軽量なテストのみを実行するコマンドを使います。

```bash
npm run test:quick
```

すべてのテスト（時間のかかるものを含む）を実行する場合は次を使います。`npm test` は常にこちらと同じ範囲を実行します。

```bash
npm test
```

ファイルを保存するたびに関連テストを再実行したい場合は次を使います。

```bash
npm run test:watch
```

lint・型チェック・軽量テスト・buildをまとめて確認したいときは、専用のコマンドを使います。実行するコマンドの詳しい使い分けは [development-guidelines.md](./development-guidelines.md) を参照してください。

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
