import {
  AREA_HEIGHT,
  AREA_WIDTH,
  PIN_RESTITUTION,
  WALL_RESTITUTION,
} from '../adventurePhysics'
import type { AdventureArea } from '../types'

/**
 * 出口矩形はエリアの下端を横切るように置く。
 * 物理側ではセンサーとして使い、見た目側では点線の出口として描くため、
 * エリアデータに出口の位置を残しておくと分岐やゴール位置を後から変更しやすい。
 */
const FULL_WIDTH_EXIT = {
  x: AREA_WIDTH / 2,
  y: AREA_HEIGHT - 12,
  width: AREA_WIDTH,
  height: 24,
}

/** 入口の上壁以外はデータへ書かず、物理側が全エリアへ自動生成する。 */
export const START_AREA_ID = 'sky'

/**
 * Phase 1 の4エリア。
 * origin は配列のindexから実行時に算出せず明示する。Phase 2で左下・右下・横方向へ
 * 配置を変えても、カメラと物理の両方がこのoriginを読むだけで済むようにするためである。
 *
 * 斜面・ピンの中心間隔は「ボール直径＋16px」を下限にした配置にしている。
 * ボールが一度に2つの障害物へ挟まらず、ゆっくり転がる余白を残すための値である。
 */
export const AREAS: readonly AdventureArea[] = [
  {
    id: 'sky',
    nameJa: 'そら',
    theme: 'sky',
    origin: { x: 0, y: 0 },
    objects: [
      // 入口から少し離した中央の雲の斜面。ボールを確実に受け、ゆるく右へ送る。
      { kind: 'wall', id: 'sky-slide-left', x: 240, y: 170, width: 300, height: 18, angle: 0.36, restitution: WALL_RESTITUTION },
      // 斜面を中央で受けてから反対向きへ送り、左右へ振れる落下ラインを作る。
      { kind: 'wall', id: 'sky-slide-right', x: 240, y: 360, width: 300, height: 18, angle: -0.36, restitution: WALL_RESTITUTION },
      // 3枚目は逆向きの中央斜面。出口へ向かう最後の向きを変える。
      { kind: 'wall', id: 'sky-slide-lower', x: 240, y: 550, width: 300, height: 18, angle: 0.36, restitution: WALL_RESTITUTION },
      { kind: 'pin', id: 'sky-cloud-1', x: 20, y: 80, radius: 16, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'sky-cloud-2', x: 460, y: 260, radius: 16, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'sky-cloud-3', x: 20, y: 640, radius: 16, restitution: PIN_RESTITUTION },
    ],
    exits: [{ id: 'sky-to-forest', ...FULL_WIDTH_EXIT, to: 'forest' }],
  },
  {
    id: 'forest',
    nameJa: 'もり',
    theme: 'forest',
    origin: { x: 0, y: AREA_HEIGHT },
    objects: [
      // 森は空と逆向きの丸太を中央で受け、大きく左右へ振るコースにする。
      { kind: 'wall', id: 'forest-log-right', x: 240, y: 170, width: 280, height: 22, angle: -0.36, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'forest-log-left', x: 240, y: 360, width: 280, height: 22, angle: 0.36, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'forest-log-right-lower', x: 240, y: 550, width: 280, height: 22, angle: -0.36, restitution: WALL_RESTITUTION },
      // キノコ風ピンは左右の端寄りに置き、丸太に当たったあと反対側へ戻す。
      { kind: 'pin', id: 'forest-mushroom-1', x: 460, y: 80, radius: 18, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'forest-mushroom-2', x: 20, y: 260, radius: 18, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'forest-mushroom-3', x: 460, y: 640, radius: 18, restitution: PIN_RESTITUTION },
    ],
    exits: [{ id: 'forest-to-cave', ...FULL_WIDTH_EXIT, to: 'cave' }],
  },
  {
    id: 'cave',
    nameJa: 'どうくつ',
    theme: 'cave',
    origin: { x: 0, y: AREA_HEIGHT * 2 },
    objects: [
      // 洞窟は中央の斜面を左右交互にし、森より少しだけ狭く感じるジグザグにする。
      { kind: 'wall', id: 'cave-slope-left', x: 240, y: 160, width: 220, height: 18, angle: 0.3, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-slope-right', x: 240, y: 330, width: 220, height: 18, angle: -0.3, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-slope-left-lower', x: 240, y: 500, width: 220, height: 18, angle: 0.3, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-slope-right-lower', x: 240, y: 650, width: 180, height: 18, angle: -0.2, restitution: WALL_RESTITUTION },
      { kind: 'pin', id: 'cave-rock-1', x: 20, y: 80, radius: 17, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'cave-rock-2', x: 460, y: 260, radius: 17, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'cave-rock-3', x: 20, y: 440, radius: 17, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'cave-rock-4', x: 460, y: 620, radius: 17, restitution: PIN_RESTITUTION },
    ],
    exits: [{ id: 'cave-to-goal', ...FULL_WIDTH_EXIT, to: 'goal' }],
  },
  {
    id: 'goal',
    nameJa: 'ゴール',
    theme: 'goal',
    origin: { x: 0, y: AREA_HEIGHT * 3 },
    objects: [
      // 上側の広い入口から中央へ集める、左右一対の漏斗の肩。
      { kind: 'wall', id: 'goal-funnel-left', x: 110, y: 250, width: 160, height: 18, angle: 0.35, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'goal-funnel-right', x: 370, y: 250, width: 160, height: 18, angle: -0.35, restitution: WALL_RESTITUTION },
      // 下側は中央の入口幅を残し、ボール直径より十分広い通路でセンサーへ導く。
      { kind: 'wall', id: 'goal-funnel-lower-left', x: 110, y: 505, width: 180, height: 18, angle: 0.55, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'goal-funnel-lower-right', x: 370, y: 505, width: 180, height: 18, angle: -0.55, restitution: WALL_RESTITUTION },
      { kind: 'pin', id: 'goal-spark', x: 240, y: 370, radius: 18, restitution: PIN_RESTITUTION },
      // 漏斗の外側へ落ちた場合も、左右の受け皿で中央センサーへ戻す。
      { kind: 'wall', id: 'goal-catch-left', x: 110, y: 660, width: 180, height: 18, angle: 0.35, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'goal-catch-right', x: 370, y: 660, width: 180, height: 18, angle: -0.35, restitution: WALL_RESTITUTION },
    ],
    exits: [{ id: 'goal-sensor', x: 240, y: 670, width: 120, height: 32, to: null }],
  },
]

const areaById = new Map(AREAS.map((area) => [area.id, area]))

/** id からエリアを引く。未知のidはデータ不整合なのでundefinedのまま返す。 */
export function findArea(id: string): AdventureArea | undefined {
  return areaById.get(id)
}
