import type { Ring } from './rings'

/**
 * ステージは「どの わっかに かべを置くか」と「すきまの角度」だけで むずかしさを決める。
 * すきまの角度は 画面の むきで、0=みぎ / 90=した / 180=ひだり / 270=うえ。
 * どのステージも はじめは すきまが 下を むいていない（回さないと 水が おちない）ようにする。
 */
export type Stage = {
  id: string
  name: string
  /** プレイ中に出す 1行ヒント。 */
  hint: string
  /** かんらんしゃを 1しゅう させるのに ひつような 水つぶの かず。 */
  need: number
  rings: readonly Ring[]
}

export const STAGES: readonly Stage[] = [
  {
    id: 'first',
    name: 'はじめての みずみち',
    hint: 'ぐるぐる まわして、すきまを したに むけよう',
    need: 170,
    rings: [
      { slot: 0, gaps: [{ center: 270, width: 44 }] },
      { slot: 2, gaps: [{ center: 250, width: 44 }] },
      { slot: 4, gaps: [{ center: 290, width: 44 }] },
    ],
  },
  {
    id: 'two-walls',
    name: 'かべが ふえた',
    hint: 'そとの すきままで、すこしずつ おろそう',
    need: 180,
    rings: [
      { slot: 0, gaps: [{ center: 300, width: 34 }] },
      { slot: 2, gaps: [{ center: 200, width: 34 }] },
      { slot: 4, gaps: [{ center: 20, width: 34 }] },
    ],
  },
  {
    id: 'four-rings',
    name: 'よっつの わっか',
    hint: 'みずが たまったら、つぎの すきまを したへ',
    need: 190,
    rings: [
      { slot: 0, gaps: [{ center: 250, width: 30 }] },
      { slot: 1, gaps: [{ center: 340, width: 30 }] },
      { slot: 3, gaps: [{ center: 170, width: 30 }] },
      { slot: 4, gaps: [{ center: 280, width: 30 }] },
    ],
  },
  {
    id: 'narrow',
    name: 'せまい すきま',
    hint: 'あわてず ゆっくり まわすと、みずが こぼれにくいよ',
    need: 190,
    rings: [
      { slot: 0, gaps: [{ center: 285, width: 26 }] },
      { slot: 1, gaps: [{ center: 195, width: 26 }] },
      { slot: 2, gaps: [{ center: 345, width: 26 }] },
      { slot: 3, gaps: [{ center: 240, width: 26 }] },
      { slot: 4, gaps: [{ center: 300, width: 26 }] },
    ],
  },
  {
    id: 'opposite',
    name: 'はんたいがわ',
    hint: 'すきまが とおい ときは、ぐるっと はんたいまで まわそう',
    need: 200,
    rings: [
      { slot: 0, gaps: [{ center: 270, width: 24 }] },
      { slot: 1, gaps: [{ center: 90, width: 24 }, { center: 270, width: 24 }] },
      { slot: 2, gaps: [{ center: 0, width: 24 }] },
      { slot: 3, gaps: [{ center: 180, width: 24 }] },
      { slot: 4, gaps: [{ center: 330, width: 24 }] },
    ],
  },
  {
    id: 'last',
    name: 'さいごの みずみち',
    hint: 'みずは のこらず とどけよう。かんらんしゃが まっているよ',
    need: 210,
    rings: [
      { slot: 0, gaps: [{ center: 260, width: 22 }] },
      { slot: 1, gaps: [{ center: 350, width: 22 }] },
      { slot: 2, gaps: [{ center: 140, width: 22 }, { center: 320, width: 22 }] },
      { slot: 3, gaps: [{ center: 30, width: 22 }] },
      { slot: 4, gaps: [{ center: 210, width: 22 }, { center: 30, width: 22 }] },
    ],
  },
]
