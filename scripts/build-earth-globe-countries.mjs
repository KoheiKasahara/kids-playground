import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'
import worldTopology from 'world-atlas/countries-50m.json' with { type: 'json' }

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceCountriesPath = path.join(
  projectRoot,
  'src/games/flag-quiz/data/countries.ts',
)
const generatedCountriesPath = path.join(
  projectRoot,
  'src/games/earth-globe/data/globeCountries.generated.ts',
)
const generatedNumericIdsPath = path.join(
  projectRoot,
  'src/games/earth-globe/data/countryNumericIds.ts',
)
const flagIconsPath = path.join(
  projectRoot,
  'node_modules/flag-icons/flags/4x3',
)
const publicFlagsPath = path.join(projectRoot, 'public/flags')
const antarcticaNumericId = 10
const recommendedGeneratedNameLength = 10
// 既存105か国の「アラブしゅちょうこくれんぽう」(14文字)を変更しないための上限。
const maxDisplayNameLength = 14
const cjkPattern = /[\u4E00-\u9FFF]/u

// 機械的な短縮だけでは意味を保ちにくい国・地域の表示名。
const displayNameOverrides = Object.freeze({
  ag: 'アンティグア',
  as: 'アメリカンサモア',
  ba: 'ボスニア',
  bn: 'ブルネイ',
  cd: 'コンゴみんしゅ',
  cf: 'ちゅうおうアフリカ',
  cg: 'コンゴ',
  fk: 'フォークランド',
  gs: 'サウスジョージア',
  hm: 'ハードとう',
  io: 'イギリスインドよう',
  kn: 'セントクリストファー',
  la: 'ラオス',
  md: 'モルドバ',
  mf: 'サン・マルタン',
  pf: 'フランスポリネシア',
  pm: 'サンピエールミクロン',
  sh: 'セントヘレナ',
  sx: 'シント・マールテン',
  sy: 'シリア',
  tc: 'タークス・カイコス',
  tf: 'フランスなんぽう',
  vc: 'セントビンセント',
  vg: 'イギリスヴァージン',
  vi: 'アメリカヴァージン',
})

const require = createRequire(import.meta.url)
const isoCountries = require('i18n-iso-countries')
isoCountries.registerLocale(require('i18n-iso-countries/langs/ja.json'))

function readLegacyCountries() {
  const source = fs.readFileSync(sourceCountriesPath, 'utf8')
  const records = new Map()
  const countryLinePattern = /^\s*\{\s*id:\s*'([^']+)',\s*nameJa:\s*'([^']*)'.*\bflag:\s*'([^']+)'/

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(countryLinePattern)
    if (match === null) continue

    const [, id, nameJa, flag] = match
    records.set(id, { nameJa, flag })
  }

  if (records.size === 0) {
    throw new Error(`既存国マスタを読み取れません: ${sourceCountriesPath}`)
  }

  return records
}

function numericIdsFromWorldAtlas() {
  const collection = feature(worldTopology, worldTopology.objects.countries)
  return [...new Set(
    collection.features
      .map((worldFeature) => worldFeature.id)
      .filter((id) => id !== undefined)
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0),
  )].sort((left, right) => left - right)
}

function stripFormalNameParts(name) {
  return name
    .replace(/（[^）]*）/gu, '')
    .replace(/人民民主共和国$/u, '')
    .replace(/民主共和国$/u, '')
    .replace(/共和国$/u, '')
    .replace(/王国$/u, '')
    .replace(/連邦$/u, '')
    .replace(/国$/u, '')
    .replace(/・アラブ$/u, '')
    .replace(/・$/u, '')
}

function replaceChildFriendlyTerms(name) {
  return name
    .replace(/香港/gu, 'ホンコン')
    .replace(/中央/gu, 'ちゅうおう')
    .replace(/赤道/gu, 'せきどう')
    .replace(/諸島/gu, 'しょとう')
    .replace(/島/gu, 'とう')
    .replace(/地域/gu, 'ちいき')
    .replace(/領/gu, 'りょう')
    .replace(/洋/gu, 'よう')
    .replace(/南/gu, 'みなみ')
    .replace(/北/gu, 'きた')
    .replace(/東/gu, 'ひがし')
    .replace(/西/gu, 'にし')
    .replace(/民主/gu, 'みんしゅ')
}

function formatGeneratedName(id, sourceName) {
  const override = displayNameOverrides[id]
  if (override !== undefined) return override

  return replaceChildFriendlyTerms(stripFormalNameParts(sourceName))
}

function buildCountries(numericIds, legacyCountries) {
  const nameOwners = new Map()
  for (const [id, country] of legacyCountries) {
    const previousOwner = nameOwners.get(country.nameJa)
    if (previousOwner !== undefined) {
      throw new Error(`既存国マスタの日本語名が重複しています: ${previousOwner}, ${id}`)
    }
    nameOwners.set(country.nameJa, id)
  }

  const records = numericIds
    .filter((numericId) => numericId !== antarcticaNumericId)
    .map((numericId) => {
      const numericCode = String(numericId).padStart(3, '0')
      const alpha2 = isoCountries.numericToAlpha2(numericCode)
      if (typeof alpha2 !== 'string') {
        throw new Error(`ISO alpha-2へ変換できません: ${numericCode}`)
      }

      const id = alpha2.toLowerCase()
      const legacyCountry = legacyCountries.get(id)
      const sourceName = isoCountries.getName(alpha2, 'ja')
      const flag = legacyCountry?.flag ?? `flags/${id}.svg`

      if (typeof sourceName !== 'string' || sourceName.trim() === '') {
        throw new Error(`日本語国名を取得できません: ${numericCode} (${alpha2})`)
      }
      const nameJa = legacyCountry?.nameJa ?? formatGeneratedName(id, sourceName)
      if (typeof nameJa !== 'string' || nameJa.trim() === '') {
        throw new Error(`表示用日本語国名を生成できません: ${numericCode} (${alpha2})`)
      }

      if (cjkPattern.test(nameJa)) {
        throw new Error(`表示名に漢字が残っています: ${id} (${nameJa})`)
      }
      const nameLength = [...nameJa].length
      if (nameLength > maxDisplayNameLength) {
        throw new Error(`表示名が長すぎます: ${id} (${nameLength}文字, ${nameJa})`)
      }
      if (legacyCountry === undefined && nameLength > recommendedGeneratedNameLength) {
        throw new Error(`生成表示名にオーバーライドが必要です: ${id} (${nameLength}文字, ${nameJa})`)
      }

      const previousOwner = nameOwners.get(nameJa)
      if (legacyCountry === undefined && previousOwner !== undefined) {
        throw new Error(`生成後の日本語名が重複しています: ${previousOwner}, ${id} (${nameJa})`)
      }
      if (previousOwner === undefined) nameOwners.set(nameJa, id)

      const sourceFlagPath = path.join(flagIconsPath, `${id}.svg`)
      if (!fs.existsSync(sourceFlagPath)) {
        throw new Error(`flag-iconsの国旗がありません: ${sourceFlagPath}`)
      }

      return { id, nameJa, flag, numericId }
    })

  const ids = new Set(records.map((record) => record.id))
  if (ids.size !== records.length) throw new Error('生成するalpha-2が重複しています')

  for (const [id, legacyCountry] of legacyCountries) {
    const generatedCountry = records.find((record) => record.id === id)
    if (generatedCountry === undefined) {
      throw new Error(`既存国マスタの国がworld-atlasにありません: ${id}`)
    }
    if (
      generatedCountry.nameJa !== legacyCountry.nameJa
      || generatedCountry.flag !== legacyCountry.flag
    ) {
      throw new Error(`既存国マスタの表記が上書きされます: ${id}`)
    }
  }

  return records
}

function renderCountryNumericIds(countries) {
  return [
    '/**',
    ' * 自動生成ファイルです。手で編集しないでください。',
    ' * 生成: npm run build:earth-globe-countries',
    ' */',
    'export const countryNumericIds: Record<string, number> = {',
    ...countries.map(({ id, numericId }) => `  ${JSON.stringify(id)}: ${numericId},`),
    '}',
    '',
  ].join('\n')
}

function renderGlobeCountries(countries) {
  return [
    '/**',
    ' * 自動生成ファイルです。手で編集しないでください。',
    ' * 生成: npm run build:earth-globe-countries',
    ' */',
    "import type { GlobeCountry } from '../types'",
    '',
    'export const generatedGlobeCountries: readonly GlobeCountry[] = [',
    ...countries.map((country) => `  ${JSON.stringify(country)},`),
    ']',
    '',
  ].join('\n')
}

function copyMissingFlags(countries) {
  fs.mkdirSync(publicFlagsPath, { recursive: true })
  let copiedCount = 0

  for (const country of countries) {
    const fileName = `${country.id}.svg`
    const sourcePath = path.join(flagIconsPath, fileName)
    const destinationPath = path.join(publicFlagsPath, fileName)

    // 既存旗は他ゲームも参照するため、存在する場合は内容を変更しない。
    if (fs.existsSync(destinationPath)) continue
    fs.copyFileSync(sourcePath, destinationPath)
    copiedCount += 1
  }

  return copiedCount
}

const legacyCountries = readLegacyCountries()
const numericIds = numericIdsFromWorldAtlas()
const countries = buildCountries(numericIds, legacyCountries)
const copiedFlagCount = copyMissingFlags(countries)

fs.writeFileSync(
  generatedNumericIdsPath,
  renderCountryNumericIds(countries),
  'utf8',
)
fs.writeFileSync(
  generatedCountriesPath,
  renderGlobeCountries(countries),
  'utf8',
)

console.log(`ちきゅうぎ対応国データを生成しました: ${countries.length}か国`)
console.log(`追加した国旗SVG: ${copiedFlagCount}件（既存ファイルは維持）`)
