export type RegionId =
  | 'hokkaido'
  | 'tohoku'
  | 'kanto'
  | 'chubu'
  | 'kinki'
  | 'chugoku'
  | 'shikoku'
  | 'kyushuOkinawa'

export type PrefectureId =
  | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10'
  | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20'
  | '21' | '22' | '23' | '24' | '25' | '26' | '27' | '28' | '29' | '30'
  | '31' | '32' | '33' | '34' | '35' | '36' | '37' | '38' | '39' | '40'
  | '41' | '42' | '43' | '44' | '45' | '46' | '47'

export type Prefecture = {
  id: PrefectureId
  nameKanji: string
  nameHiragana: string
  region: RegionId
  mapFeatureName: string
}

const rows: readonly [PrefectureId, string, string, RegionId][] = [
  ['01', '北海道', 'ほっかいどう', 'hokkaido'], ['02', '青森県', 'あおもりけん', 'tohoku'],
  ['03', '岩手県', 'いわてけん', 'tohoku'], ['04', '宮城県', 'みやぎけん', 'tohoku'],
  ['05', '秋田県', 'あきたけん', 'tohoku'], ['06', '山形県', 'やまがたけん', 'tohoku'],
  ['07', '福島県', 'ふくしまけん', 'tohoku'], ['08', '茨城県', 'いばらきけん', 'kanto'],
  ['09', '栃木県', 'とちぎけん', 'kanto'], ['10', '群馬県', 'ぐんまけん', 'kanto'],
  ['11', '埼玉県', 'さいたまけん', 'kanto'], ['12', '千葉県', 'ちばけん', 'kanto'],
  ['13', '東京都', 'とうきょうと', 'kanto'], ['14', '神奈川県', 'かながわけん', 'kanto'],
  ['15', '新潟県', 'にいがたけん', 'chubu'], ['16', '富山県', 'とやまけん', 'chubu'],
  ['17', '石川県', 'いしかわけん', 'chubu'], ['18', '福井県', 'ふくいけん', 'chubu'],
  ['19', '山梨県', 'やまなしけん', 'chubu'], ['20', '長野県', 'ながのけん', 'chubu'],
  ['21', '岐阜県', 'ぎふけん', 'chubu'], ['22', '静岡県', 'しずおかけん', 'chubu'],
  ['23', '愛知県', 'あいちけん', 'chubu'], ['24', '三重県', 'みえけん', 'kinki'],
  ['25', '滋賀県', 'しがけん', 'kinki'], ['26', '京都府', 'きょうとふ', 'kinki'],
  ['27', '大阪府', 'おおさかふ', 'kinki'], ['28', '兵庫県', 'ひょうごけん', 'kinki'],
  ['29', '奈良県', 'ならけん', 'kinki'], ['30', '和歌山県', 'わかやまけん', 'kinki'],
  ['31', '鳥取県', 'とっとりけん', 'chugoku'], ['32', '島根県', 'しまねけん', 'chugoku'],
  ['33', '岡山県', 'おかやまけん', 'chugoku'], ['34', '広島県', 'ひろしまけん', 'chugoku'],
  ['35', '山口県', 'やまぐちけん', 'chugoku'], ['36', '徳島県', 'とくしまけん', 'shikoku'],
  ['37', '香川県', 'かがわけん', 'shikoku'], ['38', '愛媛県', 'えひめけん', 'shikoku'],
  ['39', '高知県', 'こうちけん', 'shikoku'], ['40', '福岡県', 'ふくおかけん', 'kyushuOkinawa'],
  ['41', '佐賀県', 'さがけん', 'kyushuOkinawa'], ['42', '長崎県', 'ながさきけん', 'kyushuOkinawa'],
  ['43', '熊本県', 'くまもとけん', 'kyushuOkinawa'], ['44', '大分県', 'おおいたけん', 'kyushuOkinawa'],
  ['45', '宮崎県', 'みやざきけん', 'kyushuOkinawa'], ['46', '鹿児島県', 'かごしまけん', 'kyushuOkinawa'],
  ['47', '沖縄県', 'おきなわけん', 'kyushuOkinawa'],
]

export const prefectures: readonly Prefecture[] = rows.map(([id, nameKanji, nameHiragana, region]) => ({
  id, nameKanji, nameHiragana, region, mapFeatureName: nameKanji,
}))

export const prefectureById = new Map(prefectures.map((prefecture) => [prefecture.id, prefecture]))
