import { Link, useLocation } from 'react-router-dom'
import { findGameBySlug, GAME_ROUTE_PREFIX } from '../games/gameCatalog'
import styles from './GameIntro.module.css'

// '/games/<slug>' の直後の1セグメントだけを取り出す。resolvePageSeo（src/seo/pageSeo.ts）の
// GAME_SLUG_PATTERN とは異なり、ここでは「ちょうどゲームルートに一致するか」だけを見たいので
// サブパスを持つ文字列にはマッチさせない（$で終端する）。
const GAME_ROOT_PATTERN = new RegExp(`^${GAME_ROUTE_PREFIX}/([^/]+)$`)

/**
 * ゲームルートURL（例: /games/planet-globe）にだけ表示する、検索エンジン向けの本文セクション。
 *
 * App.tsx にこの1箇所だけをマウントし、17個の各ゲームコンポーネントには一切手を入れない
 * （HARD CONSTRAINTS）。これにより、新しいゲームを gameCatalog.ts に追加するだけで
 * このセクションも自動的に付いてくる。
 *
 * 表示をゲームルートURLだけに絞っているのは2つの理由から:
 * 1. 遊んでいる最中の画面（むずかしさ選択・プレイ・結果）に文章を足すと操作の邪魔になる。
 * 2. 検索エンジンがインデックスするのは各ゲームのルートURL（canonicalUrl・sitemap.xmlに
 *    載っているURL）だけであり、そこにだけ本文があれば検索結果としては十分。
 */
export default function GameIntro() {
  const { pathname } = useLocation()

  // 末尾スラッシュを正規化する（'/games/planet-globe/' も同じゲームルートとして扱う）。
  // '/' 自体は正規化不要（GAME_ROOT_PATTERNにそもそもマッチしない）。
  const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  const match = normalizedPath.match(GAME_ROOT_PATTERN)
  const entry = match ? findGameBySlug(match[1]) : undefined
  if (!entry) return null

  return (
    <section className={styles.intro} aria-labelledby="game-intro-heading">
      {/*
       * 見出しの文言に絶対にゲーム名を含めないこと。
       * src/seo/seoNavigation.test.tsx は screen.findByRole('heading', { name: /たいようけい/ }) の
       * ように正規表現でゲームのh1を探しており、ここの見出しに同じゲーム名が入ると
       * 一致する見出しが2つになって findByRole が例外を投げる。
       * 「このゲームについて」という総称のまま固定しておく。
       */}
      <h2 id="game-intro-heading" className={styles.heading}>
        このゲームについて
      </h2>
      <p className={styles.summary}>{entry.seo.description}</p>
      <h3 className={styles.subHeading}>あそびかた</h3>
      <ul className={styles.list}>
        {entry.intro.howToPlay.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {/*
       * 今日の「もどる」操作は全ゲームでJSの<button onClick={navigate('/')}>になっており、
       * ゲームページからクロールできる出口リンクが1つも無い（＝クローラがトップへ戻れない）。
       * ここだけは本物の<a href="/">として描画し、ゲームページからトップへ辿れる
       * 唯一のクローラブルな内部リンクにする。
       */}
      <p className={styles.link}>
        <Link to="/">ほかのゲームを みる</Link>
      </p>
    </section>
  )
}
