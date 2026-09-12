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
    id: 'piano-play',
    slug: 'piano-play',
    title: 'ピアノであそぼう',
    emoji: '🎹',
    seo: {
      headline: 'ピアノであそぼう｜大きな鍵盤で自由演奏',
      description:
        '大きな白鍵と黒鍵をタップして、自由に音を鳴らせる幼児向けのピアノあそびです。得点や失敗はなく、スマホ・タブレット・パソコンですぐに演奏を楽しめます。',
    },
    category: 'learning',
    intro: {
      howToPlay: [
        'しろい けんばんも くろい けんばんも おせるよ',
        'いくつかの けんばんを いっしょに おしてみよう',
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
    id: 'koma-battle',
    slug: 'koma-battle',
    title: 'コマバトル',
    emoji: '🌀',
    seo: {
      headline: 'コマバトル｜3Dのコマをまわして対戦する',
      description: '3Dの円形スタジアムで2このコマをまわして戦うあそびです。勢いよくぶつかりあったコマが、だんだん失速してぐらつき、たおれるまでを物理シミュレーションで楽しめます。',
    },
    category: 'threeD',
    intro: {
      howToPlay: [
        '2この コマで たいせんするよ',
        '「まわせ！」を おすと じどうで バトルするよ',
        'さきに たおれたり とまったり したほうが まけだよ',
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
  {
    id: 'marble-course',
    slug: 'marble-course',
    title: '3Dビーだまコースづくり',
    emoji: '🔮',
    seo: {
      headline: '3Dビーだまコースづくり｜パーツをつないで転がそう',
      description: 'まっすぐ・坂道・カーブ・分岐・ゴールを自由につなぐ、幼児向けの3Dビー玉あそびです。高さの違うコースを組み立て、ビー玉が重力で転がったり跳ねたりする様子を楽しめます。',
    },
    category: 'threeD',
    intro: {
      howToPlay: [
        'したの パーツを タップするか ドラッグして つなごう',
        'パーツを えらんで「まわす」で むきを かえられるよ',
        '「ビーだま ころがす！」で スタート。なんどでも あそべるよ',
      ],
    },
  },
  {
    id: 'car-road-builder',
    slug: 'car-road-builder',
    title: 'くるまのみちづくり',
    emoji: '🚗',
    seo: {
      headline: 'くるまのみちづくり｜道をつないで車を走らせる',
      description: 'まっすぐな道やカーブをマス目に置いてつなぎ、くるまをスタートからゴールまで走らせる幼児向けの道づくりあそびです。',
    },
    category: 'learning',
    intro: {
      howToPlay: [
        'パーツを えらんで ばんめんに おけるよ',
        '45どずつ まわして みちの つなぎめを あわせよう',
        '「しゅっぱつ」で くるまが はしるよ',
      ],
    },
  },
  {
    id: 'car-builder',
    slug: 'car-builder',
    title: '3Dクルマづくり',
    emoji: '🚙',
    seo: {
      headline: '3Dクルマづくり｜自分だけの車をつくる',
      description:
        'ボディ・タイヤ・カラー・やねなど8つのカテゴリをえらんで、3Dのくるまを自由につくれるあそびです。えらんだしゅんかんに車の見た目が変わり、指でまわして見られます。',
    },
    category: 'threeD',
    intro: {
      howToPlay: [
        'ゆびで ドラッグすると くるまが まわるよ',
        'したの 8つの ボタンから えらべるよ',
        'えらんだ しゅんかん くるまが かわるよ',
      ],
    },
  },
  {
    id: 'color-paint-puzzle',
    slug: 'color-paint-puzzle',
    title: 'うごくぬりえ',
    emoji: '🖍️',
    seo: {
      headline: 'うごくぬりえ｜でんしゃ・ひこうき・ふねなど9つのぬりえ',
      description:
        'くるま・でんしゃ・ひこうき・ふねなど9つの絵から題材をえらび、色をえらんでタップするだけで塗れる幼児向けのぬりえです。線からはみ出す心配がないので、はじめてのぬりえにも向いています。',
    },
    category: 'learning',
    intro: {
      howToPlay: [
        'いろを えらんで、ぬりたい ばしょを タップするよ',
        'えを きりかえても、ぬった いろは のこるよ',
        '「やりなおし」で いまの えだけ まっさらに もどせるよ',
      ],
    },
  },
  {
    id: 'tsumiki-bowling',
    slug: 'tsumiki-bowling',
    title: 'つみきボウリング',
    emoji: '🎳',
    seo: {
      headline: 'つみきボウリング｜たまを打ち込んで積み木をくずす',
      description:
        '3Dのレーンでねらう方向をさわって玉を発射し、つみきをくずす幼児向けの物理あそびです。重い玉で押す、はずむ玉で上をねらう、小さい玉ですき間を通す。玉をかえて同じ配置を3回試せます。',
    },
    category: 'threeD',
    intro: {
      howToPlay: [
        'ねらう ほうを さわって はなすと とんでいくよ',
        'たまを かえると とびかたが かわるよ',
        '3かい なげたら、たおした かずが でるよ',
      ],
    },
  },
  {
    id: 'block-puzzle',
    slug: 'block-puzzle',
    title: 'ブロックパズル',
    emoji: '🧩',
    seo: {
      headline: 'ブロックパズル｜すきな形をならべてマスをうめる',
      description:
        '1マス・2マス・ながいぼう・しかく・T・L・J・S・Zのブロックから すきな形をえらんで、マス目の盤面へ自由にならべる幼児向けパズルです。ブロックは落ちてこず、時間制限もゲームオーバーもないので、じっくり考えてならべられます。',
    },
    category: 'learning',
    intro: {
      howToPlay: [
        'したの かたちから すきな ブロックを えらぶよ',
        'ばんめんを タップすると そこに ブロックが おかれるよ',
        'おいたあとも まわす・うごかす・けすが できるよ',
      ],
    },
  },
  {
    id: 'pukupuka-rescue',
    slug: 'pukupuka-rescue',
    title: 'ぷかぷかレスキュー',
    emoji: '🛟',
    seo: {
      headline: 'ぷかぷかレスキュー｜じゃぐちで水をふやしてアヒルをゴールへ',
      description:
        'よこから見た水そうの じゃぐちを おして水をふやし、ぷかぷか浮かぶアヒルをゴールの浮き輪まではこぶ幼児向けのゲームです。じゃぐちを おすと水が出て水位が上がり、アヒルが浮かび上がる仕組みを、指でさわるだけで確かめられます。',
    },
    category: 'learning',
    intro: {
      howToPlay: [
        'じゃぐちを おすと アヒルが うかんで あがるよ',
        'かべを こえたら せんを あけて みずを へらそう',
        'ゴールの うきわに とどいたら クリアだよ',
      ],
    },
  },
  {
    id: 'animal-bath',
    slug: 'animal-bath',
    title: 'どうぶつのおふろ',
    emoji: '🛁',
    category: 'learning',
    seo: {
      headline: 'どうぶつのおふろ｜なでて洗うどうぶつのお世話あそび',
      description: '泥んこの犬・うさぎ・くまを、せっけん・シャワー・タオルでぴかぴかにする幼児向けのお世話あそびです。指でなでたりタップしたりすると、汚れが泡に、泡がしずくに変わります。時間制限も失敗もなく、4歳から自分のペースで楽しめます。',
    },
    intro: {
      howToPlay: [
        'あらいたい どうぶつを タップしてね',
        'どろんこや あわ、しずくを ゆびで なでてね',
        'ぜんぶ きれいに なったら、つぎの どうぐへ！',
      ],
    },
  },
  {
    id: 'snowball-roll',
    slug: 'snowball-roll',
    title: 'ゆきだまころころ',
    emoji: '❄️',
    category: 'threeD',
    seo: {
      headline: 'ゆきだまころころ｜雪玉を転がして大きくする3Dあそび',
      description: '雪の広場で雪玉を転がし、どんぐりやプレゼントをくっつけて大きくする幼児向け3Dゲームです。大きくなると雪だるま、木、車まで集められます。時間制限もゲームオーバーもなく、指一本で成長と収集を楽しめます。',
    },
    intro: {
      howToPlay: ['ひろばを さわって、ゆびを うごかすと ころがるよ', 'ちいさいものを くっつけて おおきく しよう', 'メーターが いっぱいに なったら だいせいこう！'],
    },
  },
  {
    id: 'magic-sandbox',
    slug: 'magic-sandbox',
    title: 'まほうのすなば',
    emoji: '🏜️',
    category: 'learning',
    seo: {
      headline: 'まほうのすなば｜砂と水とたねをまぜる自由あそび',
      description: '指でなぞって砂・水・石・たねをふらせる幼児向けの砂場あそびです。砂山に水をかけたり、石で水路を作ったり、湿った砂にたねをまいて花を育てたり。正解も時間制限もなく、自由に変化を楽しめます。',
    },
    intro: {
      howToPlay: ['そざいを えらんで、すなばを なぞってね', 'すなに みずを かけて、たねを まいてみよう', '「ゆらす」で さらさら。「けす」で トンネルも つくれるよ'],
    },
  },
  {
    id: 'puni-slime',
    slug: 'puni-slime',
    title: 'ぷにぷにスライム',
    emoji: '🫠',
    category: 'learning',
    seo: {
      headline: 'ぷにぷにスライム｜のばしてつぶす感触あそび',
      description: 'ぷにぷにのスライムを指で引っ張って、つぶして楽しむ幼児向けの感触あそびです。6つのかたち・3つの色・2つのやわらかさを選べ、コップやおさらに乗せるとその形に変わります。',
    },
    intro: {
      howToPlay: ['スライムを ひっぱって はなすと ぷるぷる！', 'かたちを えらんだり「ぺったん」で つぶしたり できるよ', 'コップや おさらに のせると、その かたちに かわるよ'],
    },
  },
  {
    id: 'bento-builder',
    slug: 'bento-builder',
    title: '3Dおべんとうづくり',
    emoji: '🍱',
    category: 'threeD',
    seo: {
      headline: '3Dおべんとうづくり｜おかずをつめる自由なおままごと',
      description: '好きな形と色のお弁当箱に、おにぎり・からあげ・えびフライ・ブロッコリーなど14種類のおかずを自由につめる幼児向け3Dゲームです。指で動かして、まわして、自分だけのお弁当を作れます。正解も時間制限もありません。',
    },
    intro: {
      howToPlay: [
        'すきな はこと いろを えらんで「つくる！」',
        'おかずを タップして いれたら、ゆびで うごかしてね',
        '「できた！」で ながめよう。「なおす」で つづけられるよ',
      ],
    },
  },
  {
    id: 'train-journey',
    slug: 'train-journey',
    title: 'でんしゃの たび',
    emoji: '🚂',
    category: 'threeD',
    seo: {
      headline: 'でんしゃの たび｜橋とトンネルを走る3D電車あそび',
      description: '新幹線・機関車・貨物列車を選んで、立体的な線路を自動で走る様子を楽しむ幼児向け3Dゲームです。ポイントを切り替えると、高架の橋や森のトンネルへ。駅でひとやすみしたり、加速や汽笛で自由に遊べます。',
    },
    intro: {
      howToPlay: [
        'すきな でんしゃを えらんで「しゅっぱつ！」',
        '「ポイント」で、はしと トンネルの みちを きりかえよう',
        '「かそく！」で びゅーん！「ぜんたい」で コースを ながめよう',
      ],
    },
  },
  {
    id: 'circuit-racing',
    slug: 'circuit-racing',
    title: 'サーキットレース',
    emoji: '🏎️',
    seo: {
      headline: 'サーキットレース｜好きな車と色で3Dレースを楽しむ',
      description: 'スポーツカー・SUV・コンパクトカーから好きな車と色を選んで、サーキットを自動で走る様子を楽しむ幼児向け3Dゲームです。追走・固定・フリーカメラで、車ごとの速さや曲がり方の違いを眺められます。',
    },
    category: 'threeD',
    intro: {
      howToPlay: [
        'すきな くるまと いろを えらんで スタート！',
        'くるまは じどうで はしるよ。カメラを かえて みてね',
        'やすむ ボタンで ひとやすみ。なんどでも あそべるよ',
      ],
    },
  },
  {
    id: 'oekaki-korokoro',
    slug: 'oekaki-korokoro',
    title: 'おえかきコロコロ',
    emoji: '🎨',
    category: 'learning',
    seo: {
      headline: 'おえかきコロコロ｜スタンプともようで自由におえかき',
      description: 'お花や星などのスタンプをローラーのように転がして、自由にもようを描く幼児向けのおえかきあそびです。好きな色や紙を選び、自分だけの絵を楽しめます。正解も時間制限もありません。',
    },
    intro: {
      howToPlay: ['もようと いろを えらぼう', 'ゆびで なぞると もようが コロコロ！', '「できた！」で すてきな えを おいわいしよう'],
    },
  },
  {
    id: 'draw-goal',
    slug: 'draw-goal',
    title: 'かいてゴール！',
    emoji: '✏️',
    category: 'learning',
    seo: {
      headline: 'かいてゴール！｜描いた道でボールを導く物理パズル',
      description: '指で描いた線が動かない道や橋になり、ボールを大きなゴールへ導く幼児向け物理パズルです。坂・橋・段差・はずむ床に加えて、かぜ・ワープ・ボーナスの星があるステージも楽しめます。何度でも描き直せます。',
    },
    intro: {
      howToPlay: ['ステージを えらんで、せんで みちを かこう', 'せんは なんぼんでも かけるよ。スタートで ボールが コロコロ！', 'ほしを ひろって ゴールに はいったら クリア。なんどでも やりなおせるよ'],
    },
  },
  {
    id: 'crane-game',
    slug: 'crane-game',
    title: 'クレーンゲーム',
    emoji: '🧸',
    category: 'threeD',
    seo: {
      headline: 'クレーンゲーム｜アームでぬいぐるみをキャッチ',
      description: 'アームを よこ・おくへ動かしてねらいを決め、ぬいぐるみやカプセルをつかむ3Dクレーンゲームです。景品は物理演算で動くので、つかみ方によってはすべり落ちます。',
    },
    intro: {
      howToPlay: [
        'よこ・おくの ボタンで アームを うごかすよ',
        'つかむを おすと アームが おりて けいひんを つかむよ',
        'あなの うえで はなすと けいひんが とれるよ',
      ],
    },
  },
]

export function findGameBySlug(slug: string): GameCatalogEntry | undefined {
  return GAME_CATALOG.find((game) => game.slug === slug)
}
