import type { Country, QuizLevel } from '../types';
import { LEVEL_RANK } from '../types';
import { countries } from '../../shared/countries/countries';

// 国のマスタデータは国旗を使う複数のゲームで共有するため共通レイヤーに置く。
// こっきクイズ内からは、これまでどおりこのファイル経由で参照する。
export { countries };

/**
 * 指定した難易度「以下」のランクの国をすべて返す（かんたん ⊂ ふつう ⊂ むずかしい）。
 * countries を破壊的に変更しない。
 */
export function countriesForLevel(level: QuizLevel): readonly Country[] {
  return countries.filter((country) => LEVEL_RANK[country.level] <= LEVEL_RANK[level]);
}
