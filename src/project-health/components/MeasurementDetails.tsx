import { formatMeasuredAt, type DashboardViewModel } from '../dashboardData'

const REPOSITORY = 'https://github.com/KoheiKasahara/kids-playground'
const validSha = (value: string | null | undefined) => typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value) ? value : null
const runUrl = (value: string | null | undefined) => value && /^\d+$/.test(value) ? `${REPOSITORY}/actions/runs/${value}` : null

function Commit({ sha }: { sha: string | null }) {
  return sha ? <a href={`${REPOSITORY}/commit/${sha}`}>{sha.slice(0, 7)}</a> : <>未取得</>
}

export default function MeasurementDetails({ provenance }: { provenance: NonNullable<DashboardViewModel['provenance']> }) {
  const sourceSha = validSha(provenance.sourceSha)
  const publishedSha = validSha(provenance.publishedSha)
  const measurementUrl = runUrl(provenance.runId)
  const publishedUrl = runUrl(provenance.publishedRunId)
  return (
    <details className="ph-measurement">
      <summary>計測の根拠・対象バージョン</summary>
      <dl>
        <div><dt>この計測の実行ログ・レポート</dt><dd>{measurementUrl
          ? <a href={measurementUrl}>テスト結果・計測レポートを見る ↗</a> : '未取得'}</dd></div>
        <div><dt>計測対象コミット</dt><dd><Commit sha={sourceSha} /></dd></div>
        <div><dt>最終公開成功のコミット（計測時点）</dt><dd><Commit sha={publishedSha} /></dd></div>
        <div><dt>公開成功日時</dt><dd>{formatMeasuredAt(provenance.publishedAt)}
          {publishedUrl && <> · <a href={publishedUrl}>公開ログ ↗</a></>}</dd></div>
      </dl>
      <p>{sourceSha && publishedSha
        ? sourceSha === publishedSha ? '計測した版と最終公開成功の版は一致しています。' : '計測した版と最終公開成功の版が異なります。'
        : 'バージョンの一致は未確認です。古い履歴や取得失敗時は未取得と表示します。'}</p>
      <p>公開状況は計測時点の記録です。その後の公開は反映されません。</p>
    </details>
  )
}
