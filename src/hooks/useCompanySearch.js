/**
 * Wikipedia（日本語版）を使った会社情報の自動取得フック
 * - CORS対応：Wikipedia APIは origin=* をサポート
 * - 認証不要・無料
 */

function cleanWiki(text) {
  if (!text) return ''
  return text
    .replace(/\[\[([^\]|]+)\|[^\]]*\]\]/g, '$1')   // [[リンクテキスト|表示]] → リンクテキスト
    .replace(/\[\[([^\]]+)\]\]/g, '$1')              // [[リンク]] → リンク
    .replace(/\{\{[^{}]*\}\}/g, '')                  // {{テンプレート}} 除去
    .replace(/<[^>]+>/g, '')                         // HTMLタグ除去
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractField(infobox, keys) {
  for (const key of keys) {
    const re = new RegExp(`\\|\\s*${key}\\s*=\\s*([^|}\n]+)`)
    const m = infobox.match(re)
    if (m) return cleanWiki(m[1])
  }
  return ''
}

function parseInfobox(wikitext) {
  // 会社情報テンプレートを抽出
  const match = wikitext.match(/\{\{(?:会社情報|Infobox company)[^]*?\n\}\}/)
  if (!match) return null
  const box = match[0]

  const address = extractField(box, ['本社所在地', '所在地', 'headquarters'])
  const website = extractField(box, ['URL', 'ホームページ', 'homepage', 'website'])
  const founded = extractField(box, ['設立', '設立年月日', '創業', 'founded'])
  const capital = extractField(box, ['資本金', 'capital'])
  const employees = extractField(box, ['従業員数', '従業員', 'num_employees'])
  const fiscalYearEnd = extractField(box, ['決算期', '決算月'])
  const industry = extractField(box, ['業種', '産業', 'industry'])
  const revenue = extractField(box, ['売上高', '収益', 'revenue'])
  const representative = extractField(box, ['代表者', '代表取締役'])

  // 決算期を月数字に変換
  let fiscalMonth = ''
  const fmMatch = fiscalYearEnd.match(/(\d{1,2})月/)
  if (fmMatch) fiscalMonth = fmMatch[1] + '月'
  else if (fiscalYearEnd) fiscalMonth = fiscalYearEnd

  // URLを整形
  let cleanUrl = website.replace(/^\[|\]$/g, '').split(' ')[0]
  if (cleanUrl && !cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl

  return {
    address: address.replace(/^〒?\d{3}-\d{4}\s*/, '').trim() || address,
    postalCode: (address.match(/〒?(\d{3}-\d{4})/) || [])[1] || '',
    website: cleanUrl,
    founded: founded.replace(/年.*/, '年').trim(),
    capital,
    employees: employees.replace(/\s*\(.*?\)/, '').trim(),
    fiscalYearEnd: fiscalMonth,
    industry,
    revenue,
    representative,
    rawAddress: address,
  }
}

export async function searchCompanyInfo(companyName) {
  if (!companyName?.trim()) return null

  try {
    // Step 1: ページ検索
    const searchUrl = `https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(companyName)}&srlimit=3&format=json&origin=*`
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) })
    const searchData = await searchRes.json()

    const results = searchData.query?.search || []
    if (results.length === 0) return { found: false, source: 'Wikipedia' }

    // 会社名に最も近いものを選択
    const bestResult = results.find(r =>
      r.title.includes(companyName.replace(/株式会社|合同会社|有限会社/g, '').trim()) ||
      r.snippet.includes('企業') || r.snippet.includes('会社')
    ) || results[0]

    // Step 2: ページ本文（wikitext）を取得
    const contentUrl = `https://ja.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&format=json&titles=${encodeURIComponent(bestResult.title)}&origin=*`
    const contentRes = await fetch(contentUrl, { signal: AbortSignal.timeout(8000) })
    const contentData = await contentRes.json()

    const pages = contentData.query?.pages || {}
    const page = Object.values(pages)[0]
    const wikitext = page?.revisions?.[0]?.['*'] || ''

    const info = parseInfobox(wikitext)

    if (!info) {
      // インフォボックスが無くても会社名・URLなどを返す
      const urlMatch = wikitext.match(/https?:\/\/[^\s\]|}]+/)
      return {
        found: true,
        source: 'Wikipedia',
        pageTitle: bestResult.title,
        website: urlMatch?.[0] || '',
        snippet: cleanWiki(bestResult.snippet.replace(/<[^>]+>/g, '')),
      }
    }

    return {
      found: true,
      source: 'Wikipedia',
      pageTitle: bestResult.title,
      pageUrl: `https://ja.wikipedia.org/wiki/${encodeURIComponent(bestResult.title)}`,
      ...info,
    }
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return { found: false, error: 'タイムアウト。ネットワーク接続を確認してください。' }
    }
    return { found: false, error: '検索中にエラーが発生しました。' }
  }
}
