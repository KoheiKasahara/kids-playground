// PageSeo をDOMへ反映する処理。SPA遷移のたびにSeoManagerから呼ばれるため、
// 呼ぶたびに同種のタグが増えていく（重複する）ことがないよう、
// 既存タグがあれば更新・無ければ作成する「upsert」でheadを操作する。

import type { PageSeo } from './pageSeo'
import { serializeJsonLd } from './structuredData'

/** attr（'name' または 'property'）と key が一致する meta タグを1つに保ちながら content を反映する。 */
function upsertMeta(doc: Document, attr: 'name' | 'property', key: string, content: string): void {
  const tags = doc.head.querySelectorAll<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  // 何らかの理由で重複タグが既にある場合、2件目以降は取り除いて1件に集約する。
  for (let i = 1; i < tags.length; i += 1) {
    tags[i].remove()
  }
  if (tags.length > 0) {
    tags[0].setAttribute('content', content)
    return
  }
  const meta = doc.createElement('meta')
  meta.setAttribute(attr, key)
  meta.setAttribute('content', content)
  doc.head.appendChild(meta)
}

/** rel が一致する link タグを1つに保ちながら href を反映する。 */
function upsertLink(doc: Document, rel: string, href: string): void {
  const tags = doc.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)
  for (let i = 1; i < tags.length; i += 1) {
    tags[i].remove()
  }
  if (tags.length > 0) {
    tags[0].setAttribute('href', href)
    return
  }
  const link = doc.createElement('link')
  link.setAttribute('rel', rel)
  link.setAttribute('href', href)
  doc.head.appendChild(link)
}

/**
 * type="application/ld+json" の script タグを1つに保ちながら構造化データを反映する。
 * upsertMeta/upsertLinkと同じ「重複があれば集約・無ければ作成」の形にそろえている。
 * .textContent への代入だけを使い、.innerHTML は使わない。ここで扱う値は
 * serializeJsonLdが返すJSON文字列であり、.textContentならブラウザがHTMLとして
 * 解釈することはないため、値の中に何が入っていてもDOM注入（要素の混入）が起きない。
 */
function upsertJsonLd(doc: Document, json: string): void {
  const tags = doc.head.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')
  for (let i = 1; i < tags.length; i += 1) {
    tags[i].remove()
  }
  if (tags.length > 0) {
    tags[0].textContent = json
    return
  }
  const script = doc.createElement('script')
  script.setAttribute('type', 'application/ld+json')
  script.textContent = json
  doc.head.appendChild(script)
}

/**
 * PageSeo の内容を doc（通常は document）へ反映する。
 * 何度呼んでも同じ結果になる（冪等）ため、SPA遷移のたびに呼び出してよい。
 */
export function applyDocumentSeo(doc: Document, seo: PageSeo): void {
  doc.title = seo.title

  upsertMeta(doc, 'name', 'description', seo.description)
  upsertLink(doc, 'canonical', seo.canonicalUrl)

  // OGP・Twitterカードのtitle/description/imageは PageSeo の同じ値を使い回し、
  // 文言データを二重に持たないようにする。
  upsertMeta(doc, 'property', 'og:title', seo.title)
  upsertMeta(doc, 'property', 'og:description', seo.description)
  upsertMeta(doc, 'property', 'og:url', seo.canonicalUrl)
  upsertMeta(doc, 'property', 'og:type', seo.ogType)
  upsertMeta(doc, 'property', 'og:image', seo.ogImageUrl)

  upsertMeta(doc, 'name', 'twitter:card', 'summary')
  upsertMeta(doc, 'name', 'twitter:title', seo.title)
  upsertMeta(doc, 'name', 'twitter:description', seo.description)
  upsertMeta(doc, 'name', 'twitter:image', seo.ogImageUrl)

  upsertJsonLd(doc, serializeJsonLd(seo.jsonLd))
}
