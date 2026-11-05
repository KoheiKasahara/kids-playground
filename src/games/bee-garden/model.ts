export type Stage = { name: string; cells: readonly number[] }
// Each list describes a closed, orthogonally connected garden; the first cell is the hive.
export const STAGES: readonly Stage[] = [
  { name: 'ちいさな おにわ', cells: [5, 6, 10, 9] },
  { name: 'ながい おにわ', cells: [4, 5, 6, 10, 9, 8] },
  { name: 'ぐるっと おさんぽ', cells: [0, 1, 2, 6, 10, 9, 8, 4] },
  { name: 'わかれみち', cells: [0, 1, 2, 3, 7, 6, 5, 9, 8, 4] },
  { name: 'おはなの ひろば', cells: [0, 1, 2, 3, 7, 11, 10, 6, 5, 9, 8, 4] },
  { name: 'おおきな おにわ', cells: [0, 1, 2, 3, 7, 6, 5, 9, 10, 11, 15, 14, 13, 12, 8, 4] },
]
export function adjacent(a: number, b: number): boolean {
  return Math.abs(a % 4 - b % 4) + Math.abs(Math.floor(a / 4) - Math.floor(b / 4)) === 1
}
export function isComplete(stage: Stage, path: readonly number[]): boolean {
  return path.length === stage.cells.length + 1 && path.at(-1) === stage.cells[0]
}
export function moves(stage: Stage, path: readonly number[]): number[] {
  if (isComplete(stage, path)) return []
  return stage.cells.filter(cell => adjacent(path.at(-1)!, cell) &&
    (!path.includes(cell) || (cell === stage.cells[0] && path.length === stage.cells.length)))
}
export function solution(stage: Stage, path: readonly number[]): number[] | null {
  if (isComplete(stage, path)) return [...path]
  for (const cell of moves(stage, path)) {
    const result = solution(stage, [...path, cell])
    if (result) return result
  }
  return null
}
