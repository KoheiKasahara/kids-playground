export type OrigamiId = 'fox' | 'tulip' | 'boat'

export const ORIGAMI_TEMPLATES: readonly {
  id: OrigamiId
  name: string
  subtitle: string
  steps: readonly { instruction: string; hint: { x: number; y: number } }[]
}[] = [
  {
    id: 'fox',
    name: 'きつね',
    subtitle: 'ぴん！と おみみ',
    steps: [
      { instruction: 'うえを ぱたん！', hint: { x: 200, y: 88 } },
      { instruction: 'おみみを ひとつ', hint: { x: 115, y: 185 } },
      { instruction: 'もう ひとつ！', hint: { x: 285, y: 185 } },
    ],
  },
  {
    id: 'tulip',
    name: 'チューリップ',
    subtitle: 'ぱっと はなさこう',
    steps: [
      { instruction: 'したを ぱたん！', hint: { x: 200, y: 267 } },
      { instruction: 'はなびらを ひとつ', hint: { x: 121, y: 196 } },
      { instruction: 'もう ひとつ！', hint: { x: 279, y: 196 } },
    ],
  },
  {
    id: 'boat',
    name: 'ふね',
    subtitle: 'そよかぜで すいすい',
    steps: [
      { instruction: 'したを もちあげよう', hint: { x: 200, y: 277 } },
      { instruction: 'こっちも ぱたん！', hint: { x: 105, y: 164 } },
      { instruction: 'ほを たてよう！', hint: { x: 296, y: 160 } },
    ],
  },
]

export const PAPER_COLORS = [
  { id: 'peach', name: 'もも', main: '#f49679', light: '#ffd8bd', dark: '#d96551' },
  { id: 'sunshine', name: 'きいろ', main: '#f5c75b', light: '#ffecab', dark: '#daa036' },
  { id: 'rose', name: 'ピンク', main: '#ed88ac', light: '#ffcfdf', dark: '#cf5e8a' },
  { id: 'sky', name: 'みずいろ', main: '#79c4df', light: '#c9eaf5', dark: '#4d9dbf' },
  { id: 'lilac', name: 'むらさき', main: '#afa0df', light: '#e3dafa', dark: '#8872ba' },
  { id: 'mint', name: 'みどり', main: '#8ac9a6', light: '#d0edd6', dark: '#5b9e80' },
] as const

export type PaperColor = (typeof PAPER_COLORS)[number]
