# kids-playground

子ども向けのミニゲーム集Webアプリです。スマートフォン・タブレット・PCのブラウザで遊べます。

## 特徴

- 幼児でも扱いやすいシンプルな操作・ひらがな中心のUI
- クイズ・パズル・物理演算・3Dなど、複数のタイプのミニゲームを収録
- スマートフォンでの利用を優先したレイアウト
- PWA対応で、オフラインでも遊べる
- バックエンドを持たない静的Webアプリ

収録しているミニゲームの一覧は、アプリ内のホーム画面から確認できます。

## 遊ぶ

```
https://kids.kasapg.com/
```

## 技術構成

- React / TypeScript / Vite
- React Router
- Vitest / React Testing Library / Playwright
- Three.js / Rapier（3D・3D物理）
- Matter.js（2D物理）
- GitHub Actions（CI / デプロイ）
- PWA（vite-plugin-pwa）

## ローカル開発

```bash
npm install
npm run dev
```

セットアップ・テスト・ビルドの詳細は [docs/setup.md](docs/setup.md) を参照してください。

## ドキュメント

- [docs/setup.md](docs/setup.md): 開発環境・コマンド
- [docs/architecture.md](docs/architecture.md): アーキテクチャ方針
- [docs/development-guidelines.md](docs/development-guidelines.md): ミニゲーム開発の共通規約
- [docs/credits.md](docs/credits.md): 素材の出典・ライセンス
- [docs/games/](docs/games/): 一部ミニゲームの設計メモ（全ゲーム分ではありません）

## ライセンス / クレジット

利用している素材の出典・ライセンスは [docs/credits.md](docs/credits.md) にまとめています。
