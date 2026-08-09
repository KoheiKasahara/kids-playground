import { describe, expect, it } from 'vitest';
import type { Country } from './types';
import { CHOICE_COUNT, QUESTION_COUNT } from './types';
import { generateQuestions } from './questionGenerator';

/**
 * シード付きの決定的な疑似乱数生成器 (mulberry32)。
 * テストのフレークを避けるため Math.random の代わりに注入する。
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCountries(count: number): Country[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    nameJa: `くに${i}`,
    nameEn: `Country${i}`,
    continent: 'asia',
    flag: `flags/c${i}.svg`,
  }));
}

const sampleCountries = makeCountries(30);

describe('generateQuestions', () => {
  it('デフォルトの問題数 (QUESTION_COUNT) だけ問題を生成する', () => {
    const questions = generateQuestions(sampleCountries, QUESTION_COUNT, createSeededRandom(1));
    expect(questions).toHaveLength(QUESTION_COUNT);
  });

  it('1ゲーム内で正解国が重複しない', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const questions = generateQuestions(sampleCountries, QUESTION_COUNT, createSeededRandom(seed));
      const answerIds = questions.map((q) => q.answer.id);
      expect(new Set(answerIds).size).toBe(answerIds.length);
    }
  });

  it('各問題の選択肢がちょうど4つ (CHOICE_COUNT)', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const questions = generateQuestions(sampleCountries, QUESTION_COUNT, createSeededRandom(seed));
      for (const q of questions) {
        expect(q.choices).toHaveLength(CHOICE_COUNT);
      }
    }
  });

  it('同一問題内で選択肢が重複しない', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const questions = generateQuestions(sampleCountries, QUESTION_COUNT, createSeededRandom(seed));
      for (const q of questions) {
        const ids = q.choices.map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it('正解が選択肢に含まれ、かつちょうど1つだけである', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const questions = generateQuestions(sampleCountries, QUESTION_COUNT, createSeededRandom(seed));
      for (const q of questions) {
        const matches = q.choices.filter((c) => c.id === q.answer.id);
        expect(matches).toHaveLength(1);
      }
    }
  });

  it('選択肢がすべて母集団に含まれる国である', () => {
    const validIds = new Set(sampleCountries.map((c) => c.id));
    for (let seed = 0; seed < 200; seed += 1) {
      const questions = generateQuestions(sampleCountries, QUESTION_COUNT, createSeededRandom(seed));
      for (const q of questions) {
        for (const choice of q.choices) {
          expect(validIds.has(choice.id)).toBe(true);
        }
      }
    }
  });

  it('正解位置が固定でない (多数回生成すると4通りすべてのインデックスが現れる)', () => {
    const seenIndices = new Set<number>();
    for (let seed = 0; seed < 200; seed += 1) {
      const questions = generateQuestions(sampleCountries, QUESTION_COUNT, createSeededRandom(seed));
      for (const q of questions) {
        seenIndices.add(q.choices.findIndex((c) => c.id === q.answer.id));
      }
    }
    expect(seenIndices).toEqual(new Set([0, 1, 2, 3]));
  });

  it('入力配列を破壊的に変更しない', () => {
    const original = makeCountries(30);
    const copy = original.map((c) => ({ ...c }));
    generateQuestions(original, QUESTION_COUNT, createSeededRandom(42));
    expect(original).toEqual(copy);
    expect(original).toHaveLength(30);
  });

  it('母集団が questionCount より少ない場合でもエラーにならず、作れるだけ生成する', () => {
    const smallCountries = makeCountries(5);
    expect(() =>
      generateQuestions(smallCountries, QUESTION_COUNT, createSeededRandom(7)),
    ).not.toThrow();
    const questions = generateQuestions(smallCountries, QUESTION_COUNT, createSeededRandom(7));
    expect(questions.length).toBe(5);
    for (const q of questions) {
      // 母集団が少ないため選択肢は最大でも母集団数までしか作れない
      expect(q.choices.length).toBeLessThanOrEqual(CHOICE_COUNT);
      expect(q.choices.length).toBeGreaterThan(0);
      const ids = q.choices.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain(q.answer.id);
    }
  });

  it('実データ (30か国) でも QUESTION_COUNT 問・CHOICE_COUNT 択で生成できる', () => {
    const questions = generateQuestions(sampleCountries, QUESTION_COUNT, createSeededRandom(123));
    expect(questions).toHaveLength(QUESTION_COUNT);
    for (const q of questions) {
      expect(q.choices).toHaveLength(CHOICE_COUNT);
    }
  });
});
