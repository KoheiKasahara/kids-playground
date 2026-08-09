import type { Country, Question } from './types';
import { CHOICE_COUNT, QUESTION_COUNT } from './types';

/**
 * Fisher–Yates シャッフル。引数の配列は変更せず、新しい配列を返す。
 */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * 母集団からランダムに重複なく最大 count 件を選ぶ。
 * count が母集団数より多い場合は、母集団の全件（シャッフル済み）を返す。
 */
export function pickRandom<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  return shuffle(items, random).slice(0, Math.max(0, count));
}

/**
 * 国データから、1ゲーム分の問題を生成する。
 *
 * - 正解国は questionCount 件、重複なく選ぶ（countries が足りない場合は作れるだけ）。
 * - 各問題の選択肢は正解1件 + 不正解 (CHOICE_COUNT - 1) 件で、同一問題内で重複しない。
 * - 選択肢の順序は random でシャッフルする。
 * - countries を破壊的に変更しない。
 */
export function generateQuestions(
  countries: readonly Country[],
  questionCount: number = QUESTION_COUNT,
  random: () => number = Math.random,
): Question[] {
  const answers = pickRandom(countries, questionCount, random);

  return answers.map((answer) => {
    const distractorPool = countries.filter((country) => country.id !== answer.id);
    const distractors = pickRandom(distractorPool, CHOICE_COUNT - 1, random);
    const choices = shuffle([answer, ...distractors], random);
    return { answer, choices };
  });
}
