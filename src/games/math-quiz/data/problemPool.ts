import type { QuizLevel } from '../../quiz-core/types'
import type { MathOperation, MathProblem } from '../types'

/** 1問分の計算データを組み立てる。id は演算・左辺・右辺から決まる安定キー。 */
function makeProblem(operation: MathOperation, left: number, right: number, answer: number): MathProblem {
  return { id: `${operation}-${left}-${right}`, operation, left, right, answer }
}

/** たしざん: left + right <= maxSum を満たす 0以上の整数の組を全列挙する。 */
function addSumProblems(maxSum: number): MathProblem[] {
  const problems: MathProblem[] = []
  for (let left = 0; left <= maxSum; left += 1) {
    for (let right = 0; right <= maxSum - left; right += 1) {
      problems.push(makeProblem('add', left, right, left + right))
    }
  }
  return problems
}

/** たしざん むずかしい: 2けたどうし (0〜99) を全列挙する。 */
function addHardProblems(): MathProblem[] {
  const problems: MathProblem[] = []
  for (let left = 0; left <= 99; left += 1) {
    for (let right = 0; right <= 99; right += 1) {
      problems.push(makeProblem('add', left, right, left + right))
    }
  }
  return problems
}

/** ひきざん: 0 <= right <= left <= max を満たす組を全列挙する。答えは必ず0以上になる。 */
function subProblems(max: number): MathProblem[] {
  const problems: MathProblem[] = []
  for (let left = 0; left <= max; left += 1) {
    for (let right = 0; right <= left; right += 1) {
      problems.push(makeProblem('sub', left, right, left - right))
    }
  }
  return problems
}

/** かけざん: left, right がともに 1〜max の組を全列挙する。 */
function mulSquareProblems(max: number): MathProblem[] {
  const problems: MathProblem[] = []
  for (let left = 1; left <= max; left += 1) {
    for (let right = 1; right <= max; right += 1) {
      problems.push(makeProblem('mul', left, right, left * right))
    }
  }
  return problems
}

/** かけざん むずかしい: 2けた (1〜99) × 1けた (1〜9) を全列挙する。 */
function mulHardProblems(): MathProblem[] {
  const problems: MathProblem[] = []
  for (let left = 1; left <= 99; left += 1) {
    for (let right = 1; right <= 9; right += 1) {
      problems.push(makeProblem('mul', left, right, left * right))
    }
  }
  return problems
}

/** わりざん: わる数・商がともに 1〜max の組から、あまりのない left を逆算して全列挙する。 */
function divSquareProblems(max: number): MathProblem[] {
  const problems: MathProblem[] = []
  for (let right = 1; right <= max; right += 1) {
    for (let quotient = 1; quotient <= max; quotient += 1) {
      problems.push(makeProblem('div', right * quotient, right, quotient))
    }
  }
  return problems
}

/** わりざん むずかしい: わる数 1〜9、商は right * quotient <= 99 を満たす範囲で全列挙する。 */
function divHardProblems(): MathProblem[] {
  const problems: MathProblem[] = []
  for (let right = 1; right <= 9; right += 1) {
    for (let quotient = 1; right * quotient <= 99; quotient += 1) {
      problems.push(makeProblem('div', right * quotient, right, quotient))
    }
  }
  return problems
}

/**
 * 演算・むずかしさごとの出題プールの作り方。
 * 毎回ランダム生成して重複を弾くのではなく全列挙してから抽選することで、
 * 「1ゲーム内で正解問題が重複しない」ことが構造的に保証される。
 * easy ⊂ normal ⊂ hard になるように各範囲を定義している。
 */
const POOL_BUILDERS: Record<MathOperation, Record<QuizLevel, () => MathProblem[]>> = {
  add: {
    easy: () => addSumProblems(10),
    normal: () => addSumProblems(20),
    hard: addHardProblems,
  },
  sub: {
    easy: () => subProblems(10),
    normal: () => subProblems(20),
    hard: () => subProblems(99),
  },
  mul: {
    easy: () => mulSquareProblems(5),
    normal: () => mulSquareProblems(9),
    hard: mulHardProblems,
  },
  div: {
    easy: () => divSquareProblems(5),
    normal: () => divSquareProblems(9),
    hard: divHardProblems,
  },
}

/**
 * 一度作ったプールを使い回すためのキャッシュ。
 * 全プールを合計すると17,024件になるため、モジュール読み込み時にまとめて作ると
 * さんすうクイズを遊ばない利用者のアプリ起動まで重くなる。実際に遊ぶ演算・むずかしさの
 * ぶんだけを初回アクセス時に作る。
 */
const poolCache = new Map<string, readonly MathProblem[]>()

/**
 * 指定した演算・むずかしさの計算を、重複なく全列挙した出題プールを返す。生成順は決定的。
 * 戻り値は共有されるキャッシュなので readonly とし、呼び出し側で並べ替えないようにする
 * （quiz-core の shuffle / pickRandom はコピーを返すのでそのまま渡してよい）。
 */
export function problemsFor(operation: MathOperation, level: QuizLevel): readonly MathProblem[] {
  const key = `${operation}-${level}`
  const cached = poolCache.get(key)
  if (cached) return cached

  const built = POOL_BUILDERS[operation][level]()
  poolCache.set(key, built)
  return built
}
