// ゲーム一覧の単一情報源（Single Source of Truth）。
// ホームのカード表示、ビルド時の静的HTML生成（src/build/staticRoutePages.ts）、
// ルート存在テストがすべてこのファイルを参照する。
// 新しいゲームを追加するときは、この配列に1件追加するだけで
// ホームのカードと固有URLの静的ページ生成が同時に揃うようにする。

export type GameSeoDefinition = {
  /** <title> のゲーム部分。「ゲーム名｜短い説明」形式。サイト名は含めない（サイト名はpageSeoが付与する）。 */
  headline: string
  /** meta description。ゲームごとに固有の自然な日本語。 */
  description: string
  /** 既存資産に適した画像がある場合のみ設定する。無ければ共通OGP画像（DEFAULT_OG_IMAGE_PATH）を使う。 */
  ogImage?: string
}

// ゲームの主カテゴリ。現状は3種類のみで、増やす予定があるわけではないため
// 文字列リテラルのユニオンで十分（enumや動的な追加口は不要）。
export type GameCategoryId = 'flag' | 'learning' | 'threeD'

export type GameCategory = {
  /** 将来のカテゴリ一覧ページで見出しに使う日本語ラベル。 */
  label: string
  /** schema.org の applicationCategory。実態に合う値だけを持たせる。 */
  applicationCategory: string
}

export const GAME_CATEGORIES: Record<GameCategoryId, GameCategory> = {
  flag: { label: 'こっき', applicationCategory: 'GameApplication' },
  learning: { label: '知育', applicationCategory: 'EducationalApplication' },
  threeD: { label: '3D', applicationCategory: 'GameApplication' },
}

export type GameIntroDefinition = {
  /**
   * 主なあそびかた。1項目＝短い1文。
   * 概要文は seo.description をそのまま画面にも出すため、ここには書かない
   * （同じ文章をSEO用・本文用に二重管理しないための決まり）。
   */
  howToPlay: readonly string[]
}

export type GameCatalogEntry = {
  /** ゲームID。URLのslugと同じ値を使う。 */
  id: string
  slug: string
  title: string
  emoji: string
  // 必須にすることで、ゲーム追加時にSEO定義を書き忘れると型エラーになり、
  // 検索結果に表示されないゲームが生まれてしまう事態を防ぐ。
  seo: GameSeoDefinition
  // これは主カテゴリであり、こっき系にも3Dのゲームがあるように分類軸は本来複数ありうる。
  // 将来的に軸を増やしたくなった場合は、この category を壊さず別フィールドを足せばよい設計にしている。
  category: GameCategoryId
  // GameIntroコンポーネント（検索エンジン向けの本文）が使う、ゲームごとのあそびかた。
  intro: GameIntroDefinition
}

export const GAME_ROUTE_PREFIX = '/games'

export function gameRoutePath(slug: string): string {
  return `${GAME_ROUTE_PREFIX}/${slug}`
}

// id/title/emoji は既存の src/pages/Home.tsx と同じ並び順・内容を維持する。
export const GAME_CATALOG: readonly GameCatalogEntry[] = [
  {
    id: 'flag-quiz',
    slug: 'flag-quiz',
    title: 'こっきクイズ',
    emoji: '🌏',
    seo: {
      headline: 'こっきクイズ｜世界の国旗を4択で当てる',
      description:
        '世界の国旗と国名を4択で当てる、10問の幼児向けクイズです。こっきからなまえ、なまえからこっき、パネルをめくって当てる3つのモードで、遊びながら世界の国をおぼえられます。',
    },
    category: 'flag',
    intro: {
      howToPlay: [
        'こたえを えらぶと せいかい・ふせいかいが すぐ わかるよ',
        'よみあげボタンで もんだいを こえで きけるよ',
        'パネルモードは めくる まいすうが すくないほど とくてんが たかいよ',
      ],
    },
  },
  {
    id: 'flag-pinball',
    slug: 'flag-pinball',
    title: 'こっきピンボール',
    emoji: '🎯',
    seo: {
      headline: 'こっきピンボール｜国旗ボールで点をねらう',
      description:
        'すきな国旗のボールを3こえらんで打ち出し、ピンやバンパーに当たりながら落ちる先の点をねらうピンボールあそびです。正解・不正解がないので、小さな子どもでも気軽に遊べます。',
    },
    category: 'flag',
    intro: {
      howToPlay: [
        '3こ えらぶか、ぜんぶ ながすかを えらべるよ',
        '盤面の しかけを タップすると うごかせるよ',
      ],
    },
  },
  {
    id: 'flag-roll-adventure',
    slug: 'flag-roll-adventure',
    title: 'こっきコロコロぼうけん',
    emoji: '🎢',
    seo: {
      headline: 'こっきコロコロぼうけん｜転がる国旗を見まもる',
      description:
        'えらんだ国旗のボールが、そら・もり・どうくつ・かわのコースを自動で転がっていくのを見まもるあそびです。どの出口に入ったかで次のエリアが変わり、ゴールまでの道のりが毎回変わります。',
    },
    category: 'flag',
    intro: {
      howToPlay: [
        'こっきを 1こ えらんで スタートを おすよ',
        'ボールが じぶんで ころがるのを ながめるだけで あそべるよ',
      ],
    },
  },
  {
    id: 'domino-flag',
    slug: 'domino-flag',
    title: 'こっきドミノ',
    emoji: '🁣',
    seo: {
      headline: 'こっきドミノ｜国旗のドミノをたおす',
      description:
        '国旗がえがかれたドミノをコースに並べて、いっきにたおして楽しむあそびです。みじかい・ながい・でっかいの3コースがあり、たおれていく国旗をながめながら旗の形や色に親しめます。',
    },
    category: 'flag',
    intro: {
      howToPlay: [
        'こっきを えらんでから 「スタート！」を おすよ',
        'たおれおわったら 「もういちど」で なんかいでも あそべるよ',
      ],
    },
  },
  {
    id: 'flag-roll-maze',
    slug: 'flag-roll-maze',
    title: 'こっきころころめいろ',
    emoji: '🌀',
    seo: {
      headline: 'こっきころころめいろ｜かたむけて転がす3Dめいろ',
      description:
        '画面をかたむけて国旗のボールを転がし、3Dのめいろのゴールまで運ぶあそびです。スティック操作とかたむけ操作に対応し、ステージごとにちがう仕掛けを楽しめます。',
    },
    category: 'flag',
    intro: {
      howToPlay: [
        'こっきと ステージを えらんでから スタートするよ',
        'あそんでいる とちゅうで そうさほうほうを きりかえられるよ',
      ],
    },
  },
  {
    id: 'flag-roll-puzzle',
    slug: 'flag-roll-puzzle',
    title: 'こっきコロコロパズル',
    emoji: '🧩',
    seo: {
      headline: 'こっきコロコロパズル｜板を置いて道をつくる',
      description:
        '盤面に板を置いて道をつくり、上から落ちてくる国旗のボールを下のゴールへみちびくパズルあそびです。正解のルートは1つではなく、何度でも置きなおして試せます。',
    },
    category: 'flag',
    intro: {
      howToPlay: [
        'ステージを 1つ えらんでから はじめるよ',
        '置いた板は ボタンで むきを かえられるよ',
      ],
    },
  },
  {
    id: 'vegetable-quiz',
    slug: 'vegetable-quiz',
    title: 'おやさいクイズ',
    emoji: '🥕',
    seo: {
      headline: 'おやさいクイズ｜やさいの名前を4択でおぼえる',
      description: 'やさいのイラストを見てなまえを答える、幼児向けの4択クイズです。なまえからイラストをえらぶモードもあり、身近なやさいを遊びながらおぼえられます。',
    },
    category: 'learning',
    intro: {
      howToPlay: [
        'こたえると せいかいが すぐ わかるよ',
        'さいごに なんもん せいかいしたかが でるよ',
        'よみあげボタンで もんだいを こえで きけるよ',
      ],
    },
  },
  {
    id: 'fruit-quiz',
    slug: 'fruit-quiz',
    title: 'くだものクイズ',
    emoji: '🍎',
    seo: {
      headline: 'くだものクイズ｜くだものの名前を4択でおぼえる',
      description:
        'くだもののイラストを見てなまえを答える、幼児向けの4択クイズです。なまえからイラストをえらぶモードもあり、身近なくだものを遊びながらおぼえられます。',
    },
    category: 'learning',
    intro: {
      howToPlay: [
        'こたえると せいかいが すぐ わかるよ',
        'さいごに なんもん せいかいしたかが でるよ',
        'よみあげボタンで もんだいを こえで きけるよ',
      ],
    },
  },
  {
    id: 'working-vehicle-quiz',
    slug: 'working-vehicle-quiz',
    title: 'はたらくくるまクイズ',
    emoji: '🚒',
    seo: {
      headline: 'はたらくくるまクイズ｜働く車を4択で当てる',
      description:
        'しょうぼうしゃやショベルカーなど、はたらくくるまのしゃしんとなまえを結びつける4択クイズです。しゃしんからなまえ、なまえからしゃしんの2つのモードで遊べます。',
    },
    category: 'learning',
    intro: {
      howToPlay: [
        'むずかしさを 3だんかいから えらべるよ',
        'よみあげボタンで もんだいを こえで きけるよ',
      ],
    },
  },
  {
    id: 'math-quiz',
    slug: 'math-quiz',
    title: 'さんすうクイズ',
    emoji: '🔢',
    seo: {
      headline: 'さんすうクイズ｜たしざん・ひきざん・かけざん・わりざん',
      description:
        'たしざん・ひきざん・かけざん・わりざんを、むずかしさをえらんで10問ずつ解くクイズです。数字が大きな4択ボタンなので、はじめて計算にふれる子どもでも遊べます。',
    },
    category: 'learning',
    intro: {
      howToPlay: [
        'しきを よみあげボタンで きいて こたえられるよ',
        'いま なんもんめかが バーで わかるよ',
      ],
    },
  },
  {
    id: 'color-mix-quiz',
    slug: 'color-mix-quiz',
    title: 'いろまぜクイズ',
    emoji: '🎨',
    seo: {
      headline: 'いろまぜクイズ｜絵の具をまぜた色を当てる',
      description: '絵の具をまぜたらどんな色になるかを、大きな色パネル4択からえらぶクイズです。文字が読めなくても色だけで答えられるので、未就学の子どもでも楽しめます。',
    },
    category: 'learning',
    intro: {
      howToPlay: [
        'いろを まぜる もんだいと、いろから ひく もんだいが あるよ',
        'よみあげボタンで もんだいを こえで きけるよ',
      ],
    },
  },
  {
    id: 'prefecture-quiz',
    slug: 'prefecture-quiz',
    title: '都道府県クイズ',
    emoji: '🗾',
    seo: {
      headline: '都道府県クイズ｜47都道府県の形と場所',
      description: '47都道府県のかたち・なまえ・場所を結びつけておぼえる10問クイズです。地方ごとに白地図へピースをはめる「パズル」でも遊べます。',
    },
    category: 'learning',
    intro: {
      howToPlay: [
        'クイズは かたち・なまえ・ちずの 3つの こたえかたが あるよ',
        'パズルは 7つの ちほうから えらべるよ',
      ],
    },
  },
  {
    id: 'world-travel-quiz',
    slug: 'world-travel-quiz',
    title: 'せかい旅行クイズ',
    emoji: '✈️',
    seo: {
      headline: 'せかい旅行クイズ｜地図で世界の国をめぐる',
      description:
        'アジアやヨーロッパなどの地域をえらび、世界地図で光っている国を4択で答えながら10か国をめぐるクイズです。最後に飛行機で通った道のりを地図でふりかえれます。',
    },
    category: 'learning',
    intro: {
      howToPlay: [
        'こたえかたを「こくめい」か「こっき」から えらべるよ',
        'よみあげボタンで もんだいを こえで きけるよ',
      ],
    },
  },
  {
    id: 'japan-travel-quiz',
    slug: 'japan-travel-quiz',
    title: 'にほん旅行クイズ',
    emoji: '🗾',
    seo: {
      headline: 'にほん旅行クイズ｜地図で日本を10県めぐる',
      description: '日本地図で光っている場所がどの県かを4択で答えながら、10けんを旅していくクイズです。旅をしながら、県のなまえと場所を自然におぼえられます。',
    },
    category: 'learning',
    intro: {
      howToPlay: [
        'こたえると ひこうきが つぎの けんへ とんでいくよ',
        'さいごに たびの コースを ちずで ふりかえれるよ',
        'よみあげボタンで もんだいを こえで きけるよ',
      ],
    },
  },
  {
    id: 'earth-globe',
    slug: 'earth-globe',
    title: 'ちきゅうぎ',
    emoji: '🌍',
    seo: {
      headline: 'ちきゅうぎ｜地球をまわして国をさがす',
      description: '3Dの地球儀を指でまわして、世界の国をさがしてながめられるあそびです。国をえらぶとなまえと国旗が出るので、クイズが苦手な子どもでも世界に親しめます。',
    },
    category: 'threeD',
    intro: {
      howToPlay: [
        'ズームボタンで ちかづいたり はなれたり できるよ',
        'リセットボタンで はじめの ばしょに もどせるよ',
      ],
    },
  },
  {
    id: 'planet-globe',
    slug: 'planet-globe',
    title: 'たいようけい',
    emoji: '🪐',
    seo: {
      headline: 'たいようけい｜太陽と惑星をさわってまわす',
      description: '太陽・地球・木星・土星など11の天体を、3Dでさわってまわせる宇宙あそびです。天体の表面にある特徴をタップすると、よみあげ付きの説明カードが出ます。',
    },
    category: 'threeD',
    intro: {
      howToPlay: [
        '「ひとつずつ」と「ぜんぶみる」を きりかえられるよ',
        '「ぜんぶみる」では ほしの うごきを とめたり うごかしたり できるよ',
      ],
    },
  },
  {
    id: 'rail-builder',
    slug: 'rail-builder',
    title: '3Dせんろづくり',
    emoji: '🚂',
    seo: {
      headline: '3Dせんろづくり｜線路をつないで電車を走らせる',
      description: '3Dの世界に線路をつないでコースをつくり、電車を走らせるあそびです。電車の数をふやしたり車庫を見たりしながら、自分だけの路線を自由に組み立てられます。',
    },
    category: 'threeD',
    intro: {
      howToPlay: [
        'ちょくせんや カーブの ピースを ついかできるよ',
        'いらない せんろは タップして けせるよ',
        'ズームボタンで カメラを ちかづけたり できるよ',
      ],
    },
  },
]

export function findGameBySlug(slug: string): GameCatalogEntry | undefined {
  return GAME_CATALOG.find((game) => game.slug === slug)
}
