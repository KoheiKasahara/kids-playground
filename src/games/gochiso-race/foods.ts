// コースに おちている ごちそう。ちかくを とおると たべて てんすうに なる。
// 絵は art.ts が かく。

export type FoodKind =
  | 'apple' | 'strawberry' | 'banana'
  | 'onigiri' | 'donut'
  | 'burger' | 'pudding'
  | 'cake'
  | 'parfait'

export type Food = {
  kind: FoodKind
  name: string
  points: number
}

export const FOODS: Readonly<Record<FoodKind, Food>> = {
  apple: { kind: 'apple', name: 'りんご', points: 1 },
  strawberry: { kind: 'strawberry', name: 'いちご', points: 1 },
  banana: { kind: 'banana', name: 'バナナ', points: 1 },
  onigiri: { kind: 'onigiri', name: 'おにぎり', points: 2 },
  donut: { kind: 'donut', name: 'ドーナツ', points: 2 },
  burger: { kind: 'burger', name: 'ハンバーガー', points: 3 },
  pudding: { kind: 'pudding', name: 'プリン', points: 3 },
  cake: { kind: 'cake', name: 'ケーキ', points: 5 },
  parfait: { kind: 'parfait', name: 'とくだい パフェ', points: 10 },
}

export const FOOD_KINDS = Object.keys(FOODS) as FoodKind[]
