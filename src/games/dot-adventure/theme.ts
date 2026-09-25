// ステージごとの 色。じめんは ひるの 色で つくり、ゆうやけ・よるは あとから 光で 色を のせる。

import type { PalmStyle, RockStyle, SlimeStyle, StoneStyle, TreeStyle } from './shapes'
import type { FriendDef, Theme } from './stages'

export type GroundPalette = {
  grass: readonly string[]
  dirt: readonly string[]
  sand: readonly string[]
  stone: readonly string[]
  bank: readonly string[]
  stoneWall: readonly string[]
  water: readonly string[]
  foam: string
  flowers: readonly (readonly [string, string])[]
  moss: readonly string[]
  wood: readonly string[]
}

export const GROUND: Record<string, GroundPalette> = {
  forest: {
    grass: ['#173f24', '#22582a', '#2f7430', '#45923a', '#68b048', '#98d060'],
    dirt: ['#3e2616', '#5c3a20', '#7c522c', '#9c6c3a', '#bc8a50', '#d8aa70'],
    sand: ['#a8845a', '#c8a070', '#dcbc88', '#ecd4a0', '#f8e8c0'],
    stone: ['#34323f', '#4c4a5a', '#666478', '#828098', '#a09eb4', '#c4c2d4'],
    bank: ['#24160c', '#3a2414', '#553620', '#6e4a2c'],
    stoneWall: ['#1c1a24', '#2c2a36', '#3e3c4a', '#525062'],
    water: ['#0f2a64', '#163c86', '#1e54a8', '#2a70c4', '#3c90dc', '#64b4ee', '#a4dcff'],
    foam: '#e8f8ff',
    flowers: [['#ffffff', '#ffe060'], ['#ff6a8a', '#ffe0a0'], ['#ffd23c', '#c86a10'], ['#a888ff', '#ffffff'], ['#ff5040', '#ffd060']],
    moss: ['#1f4a2a', '#2f6a34', '#4a8a3c'],
    wood: ['#2e1a0e', '#4c2e18', '#6e4624', '#926236', '#b4824c'],
  },
  beach: {
    grass: ['#1e4a24', '#2c642a', '#3e8030', '#5c9c3a', '#84bc4c', '#b0d86a'],
    dirt: ['#3e2616', '#5c3a20', '#7c522c', '#9c6c3a', '#bc8a50', '#d8aa70'],
    sand: ['#b08658', '#cca26c', '#e0bc84', '#eed29c', '#f8e6bc'],
    stone: ['#34323f', '#4c4a5a', '#666478', '#828098', '#a09eb4', '#c4c2d4'],
    bank: ['#6e5236', '#8e6c48', '#a8845a', '#c09a6c'],
    stoneWall: ['#1c1a24', '#2c2a36', '#3e3c4a', '#525062'],
    water: ['#0b2e5c', '#10407c', '#16589c', '#1e74b8', '#2c96cc', '#4cb8da', '#8ad8e8'],
    foam: '#f4fcff',
    flowers: [['#ffffff', '#ffe060'], ['#ff6a8a', '#ffe0a0']],
    moss: ['#1f4a2a', '#2f6a34', '#4a8a3c'],
    wood: ['#2e1a0e', '#4c2e18', '#6e4624', '#926236', '#b4824c'],
  },
  ruins: {
    grass: ['#143824', '#1e4e2c', '#2a6632', '#3c803a', '#58a048', '#80c05a'],
    dirt: ['#3e2616', '#5c3a20', '#7c522c', '#9c6c3a', '#bc8a50', '#d8aa70'],
    sand: ['#a8845a', '#c8a070', '#dcbc88', '#ecd4a0', '#f8e8c0'],
    stone: ['#2e2c3c', '#454358', '#5e5c74', '#7a7890', '#9896ac', '#bcbacc'],
    bank: ['#24160c', '#3a2414', '#553620', '#6e4a2c'],
    stoneWall: ['#16141e', '#24222e', '#34323f', '#46445a'],
    water: ['#0c2050', '#122e70', '#1a4290', '#2458ac', '#3474c4', '#5496dc', '#8cc4f4'],
    foam: '#d8ecff',
    flowers: [['#c8e0ff', '#ffffff'], ['#a888ff', '#ffffff']],
    moss: ['#1a4228', '#285c30', '#3c7a3a'],
    wood: ['#2e1a0e', '#4c2e18', '#6e4624', '#926236', '#b4824c'],
  },
}

export const TREE: Record<string, TreeStyle> = {
  forest: {
    leaves: ['#0c2a1e', '#143f26', '#1f5a2e', '#2f7834', '#4c9a3c', '#78bc4c', '#a8dc6a'],
    leafOutline: '#06140c',
    trunk: ['#24160c', '#3e2616', '#5e3c20', '#825630', '#a47444'],
    trunkOutline: '#120a04',
  },
  beach: {
    leaves: ['#0e2e1e', '#174428', '#225e30', '#327c36', '#4e9c40', '#7cbc50', '#a8d86c'],
    leafOutline: '#06140c',
    trunk: ['#24160c', '#3e2616', '#5e3c20', '#825630', '#a47444'],
    trunkOutline: '#120a04',
  },
  ruins: {
    leaves: ['#0a2420', '#10362a', '#1a4c32', '#28683a', '#3e8644', '#5ea452', '#88c46a'],
    leafOutline: '#04100c',
    trunk: ['#20140c', '#382214', '#56381e', '#76502c', '#96683c'],
    trunkOutline: '#100804',
  },
}

export const BERRY_BUSH = (stage: string): TreeStyle => ({ ...TREE[stage], fruit: stage === 'ruins' ? '#8ac8ff' : '#e8385a' })

export const ROCK: Record<string, RockStyle> = {
  forest: { ramp: ['#2a2c3a', '#43475a', '#62687e', '#868ea4', '#b0b8c8', '#d8dce6'], outline: '#12121a', moss: ['#2a5428', '#44803a', '#6aac4c'] },
  beach: { ramp: ['#2e2622', '#4a3c34', '#6a584a', '#8e7a64', '#b4a084', '#d8c8a8'], outline: '#16100c' },
  ruins: { ramp: ['#24222e', '#3a384a', '#545268', '#727088', '#9492a8', '#bcbacc'], outline: '#0e0c14', moss: ['#1a4228', '#2c6034', '#447c40'] },
}

export const PALM: PalmStyle = {
  trunk: ['#3a2414', '#5e3e22', '#86602e', '#aa8244', '#cca264'],
  trunkOutline: '#1a0e06',
  leaves: ['#0c3020', '#15482a', '#226432', '#348238', '#52a244', '#80c45a', '#b0e07a'],
  leafOutline: '#051a0e',
}

export const STONE: StoneStyle = {
  ramp: ['#24222e', '#3a384a', '#545268', '#727088', '#9492a8', '#bcbacc'],
  outline: '#0e0c14',
  moss: ['#1a4228', '#2c6034', '#447c40', '#5e9a4c'],
}

export const SLIME: Record<FriendDef['color'], SlimeStyle> = {
  blue: { ramp: ['#102c78', '#1a4cb0', '#2c74dc', '#52a2f4', '#8ccaff', '#c8ecff'], outline: '#0a1640', rim: '#7cc8ff' },
  pink: { ramp: ['#6a1440', '#a02460', '#d44488', '#f076a8', '#ffa8c8', '#ffd8e8'], outline: '#3a0822', rim: '#ffa0c8' },
  gold: { ramp: ['#6a3a04', '#a86a0c', '#dca018', '#f4c83c', '#ffe47a', '#fff6c0'], outline: '#3a1e02', rim: '#ffe890' },
  purple: { ramp: ['#2e1460', '#4a2494', '#6e3ec4', '#9a68e4', '#c49cff', '#e8d8ff'], outline: '#160832', rim: '#c8a8ff' },
  mint: { ramp: ['#0c4a3a', '#147058', '#22987a', '#3cc49c', '#7ae4c0', '#c0fae4'], outline: '#06261e', rim: '#90f4d0' },
  red: { ramp: ['#5a0c10', '#921a1c', '#cc3028', '#ec5a44', '#ff8c70', '#ffc4b0'], outline: '#2e0608', rim: '#ff9a80' },
}

export const SHARD_RAMP = ['#8a3a00', '#d07a10', '#ffbe30', '#ffe070', '#fff6c0', '#ffffff'] as const
export const SHARD_OUTLINE = '#5a1a00'

/** 光の 色あい。ambient は じめん ぜんたいに かける 色（かけ算）。 */
export const LIGHTING: Record<Theme, { ambient: string | null; top?: string; glow: number }> = {
  day: { ambient: null, glow: 0 },
  sunset: { ambient: '#ffb48c', top: '#ff7c64', glow: .45 },
  night: { ambient: '#232a58', glow: 1 },
}

