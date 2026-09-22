# プロジェクトの健康状態

公開ページは `/project-health/`。公開中のアプリ数と主カテゴリの内訳は
`src/games/gameCatalog.ts` から自動集計し、アプリの追加に追従する。

それ以外の指標は毎日午前3時（日本時間）に開始する Nightly の計測結果。
`project-health-history` ブランチの `public/project-health/history.json` を読む。
ページを開いても計測やテストは再実行しない。

| 指標 | 対象・読み方 |
| --- | --- |
| 計測時のアプリ数 | Nightly のチェックアウトに含まれたアプリ数。公開中の一覧とは更新時点が異なる |
| 単体・画面テスト | slow を含む Vitest 全件の成功数 / 総件数 |
| ブラウザ動作テスト | 全アプリの初期表示・縦横画面・代表3D等の成功数 / 総ケース数。再試行で成功したケースは要確認 |
| 依存関係の脆弱性 | npm audit のパッケージ件数。開発用を含む。重大・高は要対応、中以下は要確認 |
| 表示速度・アクセシビリティ | ホーム画面の Lighthouse 自動検査。全アプリの評価ではない。対象・閾値は `.project-health.json` |
| 初期読込のJS・CSS | Vite manifest の静的依存を辿った gzip 換算量。各アプリの遅延読込を含めない |
| 全アプリのJS・CSS容量 | 圧縮前の合計。画像・音声・3Dモデルを含めない |
| オフライン保存容量 | PWA precache の重複URLを除いた圧縮前の容量とファイル数。画像・音声・3Dモデルも含む |
| 定期チェック・公開処理 | 計測時点で取得した実行結果。リアルタイムの実行状況は GitHub Actions を参照 |

アプリ追加で増える総容量とオフライン保存容量の前回比は中立表示にし、
初期読込量の増加と区別する。グラフは直近12回、右側の値は最新回。
欠測を以前の値やゼロに置き換えない。

古い履歴に追加指標がない場合は「未計測」と表示する。履歴の手動補完は不要で、
次回 Nightly から成功数、重大度別件数、初期読込量などが記録される。
測定結果が48時間以上古い場合や日時不明の場合は注意を表示する。
通信エラーと初回の空履歴は別々に表示し、未計測の項目がある状態を正常と判定しない。

ローカル検証:

```bash
npx vitest run src/project-health scripts/project-health
npm run build
npx playwright test e2e/project-health.smoke.spec.ts
```

ビルド後は `npm run preview` で `/project-health/` を表示できる。
開発サーバーでは `/src/project-health/index.html` でリポジトリの履歴を読み込む。
