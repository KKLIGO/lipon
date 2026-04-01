import React, { useState, useRef, useCallback } from 'react'

// Japanese business card text parser
function parseBusinessCard(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const fullText = text

  // Email
  const emailMatch = fullText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i)
  const email = emailMatch?.[0] || ''

  // Phone (Japanese formats)
  const phoneMatch = fullText.match(
    /(?:Tel|TEL|電話|FAX|Fax)?[\s:：]*([0-9０-９]{2,4}[-−ー–][0-9０-９]{3,4}[-−ー–][0-9０-９]{4}|0[0-9０-９]{9,10})/
  )
  const phone = phoneMatch ? phoneMatch[1] || phoneMatch[0] : ''

  // Company name (look for corporate identifiers)
  const corpKeywords = [
    '株式会社', '合同会社', '有限会社', '一般社団法人', '医療法人', 'NPO法人',
    '一般財団法人', '公益財団法人', '公益社団法人', '学校法人', '独立行政法人',
    'Co.,Ltd', 'Inc.', 'Corp.', 'Ltd.',
  ]
  let companyName = ''
  for (const line of lines) {
    if (corpKeywords.some(kw => line.includes(kw))) {
      companyName = line.replace(/^[\s・|｜\-–—]+/, '').trim()
      break
    }
  }

  // Job title
  const titleKeywords = [
    '代表取締役', '取締役', '専務', '常務', '社長', '会長', '副社長',
    '本部長', '部長', '課長', '係長', '主任', '室長', '所長', '院長', '事務長',
    'CEO', 'CTO', 'COO', 'CFO', 'CMO', 'CIO', 'VP', 'SVP',
    'マネージャー', 'ディレクター', 'プロデューサー', 'エンジニア', 'コンサルタント',
    'パートナー', 'アソシエイト',
  ]
  let contactTitle = ''
  for (const line of lines) {
    if (titleKeywords.some(kw => line.includes(kw))) {
      contactTitle = line.trim()
      break
    }
  }

  // Person name: Japanese name heuristic
  // Filter out known non-name lines (company, email, phone, URL, title)
  const nonNamePatterns = [
    /@/, /\d{2,}/, /^http/, /株式|合同|有限|法人/,
    /部長|課長|社長|取締役|CEO|CTO|マネージャー|ディレクター/,
    /〒|\d{3}-\d{4}/, /TEL|FAX|Tel|Fax|電話/,
  ]
  let contactName = ''
  for (const line of lines) {
    const isNonName = nonNamePatterns.some(p => p.test(line))
    if (!isNonName && line.length >= 2 && line.length <= 15 &&
        /^[\u30A0-\u30FF\u3040-\u309F\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\s　a-zA-Z]+$/.test(line)) {
      // Skip if it looks like a department name
      if (!/部$|課$|室$|本部$|グループ$|チーム$/.test(line)) {
        contactName = line.replace(/\s+/g, ' ').trim()
        break
      }
    }
  }

  // URL / website
  const urlMatch = fullText.match(/https?:\/\/[^\s]+|www\.[^\s]+/)
  const website = urlMatch?.[0] || ''

  return { companyName, contactName, contactTitle, email, phone, website, rawText: text }
}

const SCAN_STATES = {
  IDLE: 'idle',
  PREVIEWING: 'previewing',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
}

export default function BusinessCardScanner({ onApply, onClose }) {
  const [state, setState] = useState(SCAN_STATES.IDLE)
  const [imageUrl, setImageUrl] = useState(null)
  const [progress, setProgress] = useState(0)
  const [parsed, setParsed] = useState(null)
  const [rawText, setRawText] = useState('')
  const [showRaw, setShowRaw] = useState(false)
  const [editFields, setEditFields] = useState({})
  const [errorMsg, setErrorMsg] = useState('')
  const fileRef = useRef()

  const handleFile = useCallback(async (file) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setState(SCAN_STATES.PROCESSING)
    setProgress(0)

    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker(['jpn', 'eng'], 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
          }
        },
      })
      const { data: { text } } = await worker.recognize(url)
      await worker.terminate()

      setRawText(text)
      const result = parseBusinessCard(text)
      setParsed(result)
      setEditFields({
        companyName: result.companyName,
        contactName: result.contactName,
        contactTitle: result.contactTitle,
        email: result.email,
        phone: result.phone,
      })
      setState(SCAN_STATES.DONE)
    } catch (err) {
      console.error('OCR error:', err)
      setErrorMsg('OCR処理中にエラーが発生しました。')
      setState(SCAN_STATES.ERROR)
    }
  }, [])

  function handleInputChange(e) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleApply() {
    onApply({
      companyName: editFields.companyName || '',
      contactName: editFields.contactName || '',
      contactTitle: editFields.contactTitle || '',
      email: editFields.email || '',
      phone: editFields.phone || '',
    })
  }

  function setField(key) {
    return e => setEditFields(f => ({ ...f, [key]: e.target.value }))
  }

  function reset() {
    setState(SCAN_STATES.IDLE)
    setImageUrl(null)
    setParsed(null)
    setRawText('')
    setProgress(0)
    setEditFields({})
    setErrorMsg('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-xl">📇</span>
            <h2 className="text-lg font-semibold text-gray-900">名刺スキャン</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* IDLE: Camera/File picker */}
          {state === SCAN_STATES.IDLE && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                名刺の写真を撮影または選択してください。OCRで文字を読み取り、顧客情報を自動入力します。
              </p>

              {/* Camera button (mobile) */}
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-blue-300 rounded-xl p-8 cursor-pointer hover:bg-blue-50 transition-colors">
                <span className="text-5xl">📷</span>
                <div className="text-center">
                  <p className="font-semibold text-blue-700">カメラで撮影 / 画像を選択</p>
                  <p className="text-xs text-gray-400 mt-1">スマートフォンではカメラが起動します</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleInputChange}
                  className="hidden"
                />
              </label>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative text-center"><span className="bg-white px-3 text-xs text-gray-400">または</span></div>
              </div>

              <label className="flex items-center justify-center gap-2 btn-secondary cursor-pointer w-full">
                <span>🖼️</span>
                <span>ファイルから選択（PC）</span>
                <input type="file" accept="image/*" onChange={handleInputChange} className="hidden" />
              </label>
            </div>
          )}

          {/* PROCESSING: OCR in progress */}
          {state === SCAN_STATES.PROCESSING && (
            <div className="space-y-4">
              {imageUrl && (
                <img src={imageUrl} alt="名刺" className="w-full max-h-48 object-contain rounded-lg border border-gray-200" />
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-2">
                    <span className="animate-spin inline-block">⏳</span>
                    文字を読み取り中...（日本語OCR処理中）
                  </span>
                  <span className="font-medium text-blue-600">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">初回は言語データのダウンロードに時間がかかる場合があります</p>
              </div>
            </div>
          )}

          {/* ERROR */}
          {state === SCAN_STATES.ERROR && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                ⚠️ {errorMsg}
              </div>
              <button onClick={reset} className="btn-secondary w-full">もう一度試す</button>
            </div>
          )}

          {/* DONE: Show parsed results */}
          {state === SCAN_STATES.DONE && (
            <div className="space-y-4">
              {/* Image preview */}
              {imageUrl && (
                <img src={imageUrl} alt="名刺" className="w-full max-h-36 object-contain rounded-lg border border-gray-200 bg-gray-50" />
              )}

              {/* Success indicator */}
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-700">
                <span>✅</span>
                <span>文字の読み取りが完了しました。内容を確認・修正してください。</span>
              </div>

              {/* Editable parsed fields */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">読み取り結果（修正可）</h3>

                {[
                  { key: 'companyName', label: '会社名', placeholder: '株式会社〇〇' },
                  { key: 'contactName', label: '担当者名', placeholder: '山田 太郎' },
                  { key: 'contactTitle', label: '役職', placeholder: '営業部長' },
                  { key: 'email', label: 'メール', placeholder: 'yamada@example.com' },
                  { key: 'phone', label: '電話番号', placeholder: '03-1234-5678' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input
                      type="text"
                      value={editFields[key] || ''}
                      onChange={setField(key)}
                      placeholder={placeholder}
                      className="form-input text-sm"
                    />
                  </div>
                ))}
              </div>

              {/* Raw text toggle */}
              <button
                onClick={() => setShowRaw(v => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                {showRaw ? '▲' : '▼'} OCR生テキストを{showRaw ? '隠す' : '見る'}
              </button>
              {showRaw && (
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">
                  {rawText || '（テキストなし）'}
                </pre>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button onClick={reset} className="btn-secondary flex-1">
                  やり直す
                </button>
                <button onClick={handleApply} className="btn-primary flex-1">
                  📋 この情報を使う
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
