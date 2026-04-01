import React, { useState, useRef } from 'react'

// Parse CSV text into array of objects
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cols[i] || '' })
    return obj
  }).filter(r => Object.values(r).some(v => v))
  return { headers, rows }
}

// Try to find a matching customer by company name (fuzzy)
function findMatch(customers, nameKey, row) {
  const raw = row[nameKey] || ''
  const name = raw.trim()
  if (!name) return null
  // Exact match first
  let match = customers.find(c => c.companyName === name)
  if (match) return match
  // Partial match
  match = customers.find(c =>
    c.companyName?.includes(name) || name.includes(c.companyName || '')
  )
  return match || null
}

const AMOUNT_KEYWORDS = ['売上', '金額', 'amount', '万円', '受注', '売り上げ', '請求']
const COMPANY_KEYWORDS = ['会社', '企業', 'company', '顧客', 'client', '社名']
const MONTH_KEYWORDS = ['月', 'month', '年月', '期間', '対象月']

function guessColumn(headers, keywords) {
  for (const kw of keywords) {
    const found = headers.find(h => h.toLowerCase().includes(kw.toLowerCase()))
    if (found) return found
  }
  return ''
}

export default function CsvImporter({ customers, onUpdateSales, onClose }) {
  const [step, setStep] = useState('upload') // upload → map → preview → done
  const [csvData, setCsvData] = useState(null)
  const [colCompany, setColCompany] = useState('')
  const [colAmount, setColAmount] = useState('')
  const [colMonth, setColMonth] = useState('')
  const [preview, setPreview] = useState([]) // { customer, row, newAmount, matched }
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef()

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target.result
      const data = parseCsv(text)
      setCsvData(data)
      // Auto-detect columns
      setColCompany(guessColumn(data.headers, COMPANY_KEYWORDS) || data.headers[0] || '')
      setColAmount(guessColumn(data.headers, AMOUNT_KEYWORDS) || '')
      setColMonth(guessColumn(data.headers, MONTH_KEYWORDS) || '')
      setStep('map')
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleBuildPreview() {
    if (!colCompany || !colAmount) return
    const rows = csvData.rows.map(row => {
      const matched = findMatch(customers, colCompany, row)
      const rawAmount = row[colAmount]?.replace(/[^0-9.]/g, '')
      const newAmount = rawAmount ? Number(rawAmount) : null
      return {
        companyName: row[colCompany] || '',
        month: colMonth ? row[colMonth] : '',
        newAmount,
        matched,
        import: !!matched && newAmount != null,
      }
    })
    setPreview(rows)
    setStep('preview')
  }

  function toggleRow(i) {
    setPreview(p => p.map((r, j) => j === i ? { ...r, import: !r.import } : r))
  }

  function handleImport() {
    const toImport = preview.filter(r => r.import && r.matched && r.newAmount != null)
    toImport.forEach(r => {
      onUpdateSales(r.matched.id, { dealAmount: r.newAmount })
    })
    setImportResult({ count: toImport.length, skipped: preview.length - toImport.length })
    setStep('done')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">📊 売上CSVインポート</h2>
            <p className="text-xs text-gray-500 mt-0.5">月次CSVから個社別売上を一括取込</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-gray-100">
          {[['upload','① ファイル選択'],['map','② 列マッピング'],['preview','③ 確認'],['done','✅ 完了']].map(([key, label], i) => (
            <React.Fragment key={key}>
              <span className={`text-xs font-medium px-2 py-1 rounded ${step === key ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
                {label}
              </span>
              {i < 3 && <span className="text-gray-300 text-xs">›</span>}
            </React.Fragment>
          ))}
        </div>

        <div className="p-6">

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                月次売上データのCSVファイルをアップロードしてください。<br/>
                「会社名」「売上金額（万円）」列が含まれているCSVに対応しています。
              </p>
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => fileRef.current?.click()}
              >
                <div className="text-4xl mb-3">📂</div>
                <p className="text-sm font-medium text-gray-700">クリックしてCSVを選択</p>
                <p className="text-xs text-gray-400 mt-1">.csv ファイル対応（文字コード: UTF-8 / Shift-JIS）</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />

              <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500 space-y-1">
                <p className="font-medium text-gray-700 mb-2">CSVフォーマット例：</p>
                <pre className="font-mono bg-white border border-gray-200 rounded p-2 text-xs overflow-x-auto">
{`会社名,売上金額（万円）,対象月
株式会社ABC,150,2026年3月
XYZ商事,80,2026年3月
株式会社山田製作所,200,2026年3月`}
                </pre>
              </div>
            </div>
          )}

          {/* Step 2: Column mapping */}
          {step === 'map' && csvData && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600">
                CSVの列をマッピングしてください。<strong>{csvData.rows.length}件</strong>のデータが読み込まれました。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🏢 会社名列 <span className="text-red-500">*</span>
                  </label>
                  <select value={colCompany} onChange={e => setColCompany(e.target.value)} className="form-input">
                    <option value="">選択してください</option>
                    {csvData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    💰 売上金額列 <span className="text-red-500">*</span>
                  </label>
                  <select value={colAmount} onChange={e => setColAmount(e.target.value)} className="form-input">
                    <option value="">選択してください</option>
                    {csvData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    📅 対象月列
                    <span className="text-xs text-gray-400 font-normal ml-1">（任意）</span>
                  </label>
                  <select value={colMonth} onChange={e => setColMonth(e.target.value)} className="form-input">
                    <option value="">なし</option>
                    {csvData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              {/* Preview of first 3 rows */}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>{csvData.headers.map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-600 font-medium">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {csvData.rows.slice(0, 3).map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {csvData.headers.map(h => (
                          <td key={h} className="px-3 py-2 text-gray-700">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setStep('upload')} className="btn-secondary">戻る</button>
                <button onClick={handleBuildPreview} disabled={!colCompany || !colAmount} className="btn-primary">
                  次へ →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  取込対象を確認してください。チェックを外すとスキップします。
                </p>
                <div className="flex gap-4 text-xs">
                  <span className="text-green-600">✅ マッチ: {preview.filter(r => r.matched).length}</span>
                  <span className="text-red-500">❌ 未マッチ: {preview.filter(r => !r.matched).length}</span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left w-8"></th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium">CSV社名</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium">マッチ顧客</th>
                      {colMonth && <th className="px-3 py-2 text-left text-gray-600 font-medium">対象月</th>}
                      <th className="px-3 py-2 text-right text-gray-600 font-medium">売上（万円）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className={`border-t border-gray-100 ${!row.matched ? 'bg-red-50' : ''}`}>
                        <td className="px-3 py-2">
                          {row.matched ? (
                            <input type="checkbox" checked={row.import} onChange={() => toggleRow(i)} />
                          ) : (
                            <span className="text-red-400">✕</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{row.companyName}</td>
                        <td className="px-3 py-2">
                          {row.matched
                            ? <span className="text-green-700 font-medium">{row.matched.companyName}</span>
                            : <span className="text-red-400">未登録</span>}
                        </td>
                        {colMonth && <td className="px-3 py-2 text-gray-500">{row.month}</td>}
                        <td className="px-3 py-2 text-right font-medium text-gray-900">
                          {row.newAmount != null ? row.newAmount.toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setStep('map')} className="btn-secondary">戻る</button>
                <button onClick={handleImport}
                  disabled={preview.filter(r => r.import).length === 0}
                  className="btn-primary">
                  {preview.filter(r => r.import).length}件を取込む
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && importResult && (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">取込完了</h3>
              <p className="text-gray-600 mb-1">
                <strong className="text-blue-600">{importResult.count}社</strong> の売上金額を更新しました
              </p>
              {importResult.skipped > 0 && (
                <p className="text-xs text-gray-400">{importResult.skipped}件はスキップ</p>
              )}
              <button onClick={onClose} className="btn-primary mt-6">閉じる</button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
