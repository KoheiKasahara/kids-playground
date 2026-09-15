// 「ぐるぐる すいしゃ」の ばめんの かたち。
// 円盤・シュート・すいしゃ・かんらんしゃの いちを ひとところに まとめ、
// シミュレーション（waterMaze）と えがく がわ（render）が おなじ数値を見るようにする。
// 長さの単位は すべて シミュレーション用グリッドの ます。

export const GRID_WIDTH = 120
export const GRID_HEIGHT = 180

/** 円形めいろの円盤。ここだけが まわる。 */
export const DISC = { x: 60, y: 52, radius: 46 } as const

/** まんなかの みずたまり。ここに 最初の水が入っている。 */
export const POOL_RADIUS = 10

/**
 * かべを置ける わっかの ばしょ。うちがわから 順に 0..4。
 * ステージは この番号を選び、すきま（gap）の角度だけを変える。
 * 半径の値を ステージごとに 変えられるようにはしない（水路の幅が
 * 変わると 水の流れやすさまで ステージごとに 変わってしまうため）。
 */
export const RING_SLOTS = [
  { inner: 10, outer: 13 },
  { inner: 18, outer: 21 },
  { inner: 26, outer: 29 },
  { inner: 34, outer: 37 },
  { inner: 43, outer: 46 },
] as const

/** 円盤から こぼれた水を すいしゃへ あつめる シュート（すべり台）。 */
export const CHUTE = {
  top: 96,
  bottom: 122,
  outerLeft: 8,
  outerRight: 112,
  mouthLeft: 52,
  mouthRight: 68,
  thickness: 3,
  /** 円盤の よこの かこいを 立てはじめる 高さ。 */
  wallTop: 20,
} as const

/** この行より下へ おちた水は すいしゃに とどいた ものとして数える。 */
export const CATCH_ROW = 131

/** みずぐるま。シュートの出口が ちょうど 左がわの はねに かかる。 */
export const WHEEL = { x: 68, y: 146, radius: 17, blades: 8 } as const

/** すいしゃが まわす かんらんしゃ。ゴンドラの数が そのまま クリア条件になる。 */
export const TOY = { x: 99, y: 138, radius: 14, gondolas: 6 } as const

/** 地面の高さ。すいしゃ・かんらんしゃの 台は ここまで のびる。 */
export const GROUND_ROW = 166

/** かんらんしゃ 1しゅうの あいだに みずぐるまが まわる回数。 */
export const GEAR_RATIO = 6

export const gridIndex = (x: number, y: number): number => y * GRID_WIDTH + x

/**
 * うごかない かべ（シュートと そのわき）を ぬりつぶした ます目を作る。
 * 円盤の かべは まわるので ここには 含めず、waterMaze が 回転から そのつど もとめる。
 */
export function buildFixedWalls(): Uint8Array {
  const walls = new Uint8Array(GRID_WIDTH * GRID_HEIGHT)
  const paint = (x: number, y: number) => {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return
    walls[gridIndex(x, y)] = 1
  }
  const board = (x0: number, x1: number) => {
    // 円盤の はしから シュートの出口まで、ななめの いたを 1ますずつ ぬる。
    const steps = Math.abs(x1 - x0)
    const direction = Math.sign(x1 - x0)
    for (let step = 0; step <= steps; step++) {
      const x = x0 + direction * step
      const y = CHUTE.top + Math.round((CHUTE.bottom - CHUTE.top) * (step / steps))
      for (let t = -1; t <= 1; t++) paint(x, y + t)
    }
  }
  board(CHUTE.outerLeft, CHUTE.mouthLeft)
  board(CHUTE.outerRight, CHUTE.mouthRight)
  // シュートの そとがわに かこいを立て、円盤から とび出した水も シュートへ もどす。
  for (let y = CHUTE.wallTop; y <= CHUTE.top; y++) {
    for (let t = -1; t <= 1; t++) {
      paint(CHUTE.outerLeft + t, y)
      paint(CHUTE.outerRight + t, y)
    }
  }
  return walls
}
