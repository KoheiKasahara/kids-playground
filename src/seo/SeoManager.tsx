// SPA遷移のたびにdocumentのメタ情報を切り替える経路。ゲームコンポーネント側からは
// DOMを直接触らせず、この1箇所（App.tsxでのマウント）だけがdocumentを更新する。

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { applyDocumentSeo } from './applyDocumentSeo'
import { resolvePageSeo } from './pageSeo'

export default function SeoManager(): null {
  const { pathname } = useLocation()

  useEffect(() => {
    applyDocumentSeo(document, resolvePageSeo(pathname))
  }, [pathname])

  // 描画物を持たないため、再レンダリングのコストを増やさない。
  return null
}
