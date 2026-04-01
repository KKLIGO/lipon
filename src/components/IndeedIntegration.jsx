import React, { useState } from 'react'

const INDEED_KEY = 'crm_indeed_config_v1'

function loadConfig() {
  try { return JSON.parse(localStorage.getItem(INDEED_KEY) || '{}') } catch { return {} }
}
function saveConfig(cfg) {
  localStorage.setItem(INDEED_KEY, JSON.stringify(cfg))
}

// Parse RFC 2822 date string → "YYYY-MM-DD"
function parseJobDate(dateStr) {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  } catch { return null }
}

// Format date string for display
function fmtDate(iso) {
  if (!iso) return '未設定'
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
}

// Months elapsed since a date string
function monthsAgo(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  return Math.floor(diff / (30.44 * 86400000))
}

async function fetchIndeedJobs(publisherKey, companyName) {
  const params = new URLSearchParams({
    publisher: publisherKey,
    q: `"${companyName}"`,
    co: 'jp',
    l: '',
    sort: 'date',
    start: '0',
    limit: '10',
    fromage: '180',
    highlight: '0',
    filter: '1',
    v: '2',
    format: 'json',
  })
  const url = `https://api.indeed.com/ads/apisearch?${params}`
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return JSON.parse(data.contents)
}

function JobCard({ job }) {
  const dateStr = parseJobDate(job.date)
  return (
    <div className="p-3 border border-gray-200 rounded-lg">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{job.jobtitle}</p>
          <p className="text-xs text-gray-500 mt-0.5">{job.company} · {job.formattedLocation}</p>
          <p className="text-xs text-gray-400 mt-1">
            {dateStr ? fmtDate(dateStr) : job.formattedRelativeTime}
          </p>
        </div>
        <a href={job.url} target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 px-2 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50">
          Indeed →
        </a>
      </div>
      {job.snippet && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-2"
          dangerouslySetInnerHTML={{ __html: job.snippet }} />
      )}
    </div>
  )
}

function CompanyIndeedSearch({ customer, publisherKey, onUpdatePosting }) {
  const [jobs, setJobs] = useState(null)
  const [latestDate, setLatestDate] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function search() {
    setLoading(true)
    setError('')
    setJobs(null)
    setLatestDate(null)
    try {
      const data = await fetchIndeedJobs(publisherKey, customer.companyName)
      const results = data.results || []
      setJobs(results)
      // Find most recent posting date
      const dates = results
        .map(j => parseJobDate(j.date))
        .filter(Boolean)
        .sort()
        .reverse()
      if (dates.length > 0) setLatestDate(dates[0])
    } catch (e) {
      setError('取得失敗: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSaveDate() {
    if (!latestDate) return
    onUpdatePosting(customer.id, latestDate)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const mo = monthsAgo(latestDate)

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={search} disabled={loading || !publisherKey}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm hover:bg-blue-100 disabled:opacity-50">
          {loading ? '🔍 取得中...' : '🔍 Indeed求人を取得'}
        </button>

        {/* Latest date banner */}
        {latestDate && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
            <span className="text-xs text-green-800 font-medium">
              最終掲載日: {fmtDate(latestDate)}
              {mo !== null && (
                <span className={`ml-1 font-bold ${mo >= 3 ? 'text-red-600' : mo >= 1 ? 'text-yellow-600' : 'text-green-700'}`}>
                  （{mo}ヶ月前）
                </span>
              )}
            </span>
            <button onClick={handleSaveDate}
              className={`text-xs px-2 py-0.5 rounded-lg font-medium transition-colors ${
                saved ? 'bg-green-500 text-white' : 'bg-white text-green-700 border border-green-300 hover:bg-green-100'
              }`}>
              {saved ? '✅ 保存済' : '顧客に保存'}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {jobs !== null && (
        <div className="space-y-2">
          {jobs.length === 0
            ? <p className="text-xs text-gray-400 py-2">求人が見つかりませんでした（過去6ヶ月）</p>
            : jobs.map((job, i) => <JobCard key={i} job={job} />)
          }
        </div>
      )}
    </div>
  )
}

export default function IndeedIntegration({ customers, onUpdateCustomer, onClose }) {
  const [config, setConfig] = useState(loadConfig)
  const [publisherKey, setPublisherKey] = useState(config.publisherKey || '')
  const [saved, setSaved] = useState(false)
  const [searchCompany, setSearchCompany] = useState('')
  const [activeCompany, setActiveCompany] = useState(null)
  const [bulkProgress, setBulkProgress] = useState(null) // { done, total, results }

  function handleSaveKey() {
    const cfg = { publisherKey }
    saveConfig(cfg)
    setConfig(cfg)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleUpdatePosting(customerId, dateStr) {
    onUpdateCustomer(customerId, { lastPostingDate: dateStr })
  }

  // Bulk fetch: iterate all customers with a delay to avoid rate limiting
  async function handleBulkFetch() {
    if (!config.publisherKey) return
    const targets = customers.filter(c => c.companyName)
    setBulkProgress({ done: 0, total: targets.length, results: [] })
    const results = []
    for (let i = 0; i < targets.length; i++) {
      const c = targets[i]
      try {
        const data = await fetchIndeedJobs(config.publisherKey, c.companyName)
        const dates = (data.results || [])
          .map(j => parseJobDate(j.date))
          .filter(Boolean).sort().reverse()
        const latestDate = dates[0] || null
        if (latestDate) {
          onUpdateCustomer(c.id, { lastPostingDate: latestDate })
          results.push({ companyName: c.companyName, date: latestDate, ok: true })
        } else {
          results.push({ companyName: c.companyName, date: null, ok: false })
        }
      } catch {
        results.push({ companyName: c.companyName, date: null, ok: false, err: true })
      }
      setBulkProgress({ done: i + 1, total: targets.length, results: [...results] })
      // Small delay to avoid rate limiting
      if (i < targets.length - 1) await new Promise(r => setTimeout(r, 500))
    }
  }

  const filteredCustomers = customers.filter(c =>
    !searchCompany || c.companyName?.includes(searchCompany)
  ).slice(0, 50)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Indeed 連携</h2>
            <p className="text-xs text-gray-500 mt-0.5">Indeed APIから最終掲載日を自動取得</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-6 space-y-6">

          {/* API Key */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-blue-900">🔑 Indeed Publisher API 設定</h3>
            <p className="text-xs text-blue-700">
              Indeed Publisher IDを入力すると、求人情報・最終掲載日を自動取得できます。
              <a href="https://ads.indeed.com/jobroll/xmlfeed" target="_blank" rel="noopener noreferrer"
                className="underline ml-1">Publisher IDを取得 →</a>
            </p>
            <div className="flex gap-2">
              <input type="text" value={publisherKey} onChange={e => setPublisherKey(e.target.value)}
                placeholder="Publisher ID（例：1234567890123456）"
                className="form-input flex-1 text-sm" />
              <button onClick={handleSaveKey} className="btn-primary text-sm px-4">
                {saved ? '✅ 保存' : '保存'}
              </button>
            </div>
            {!config.publisherKey && (
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                ⚠️ Publisher IDが未設定です。設定後に最終掲載日の自動取得が使えます。
              </p>
            )}
          </div>

          {/* Bulk fetch */}
          {config.publisherKey && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">🔄 一括取得</h3>
                  <p className="text-xs text-gray-500 mt-0.5">全顧客の最終掲載日をIndeedから一括更新</p>
                </div>
                <button
                  onClick={handleBulkFetch}
                  disabled={!!bulkProgress && bulkProgress.done < bulkProgress.total}
                  className="btn-primary text-sm px-4 disabled:opacity-50">
                  {bulkProgress && bulkProgress.done < bulkProgress.total
                    ? `取得中 ${bulkProgress.done}/${bulkProgress.total}`
                    : '一括取得を開始'}
                </button>
              </div>

              {bulkProgress && (
                <>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all"
                      style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {bulkProgress.results.slice(-10).reverse().map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={r.ok ? 'text-green-500' : 'text-gray-400'}>
                          {r.ok ? '✅' : r.err ? '❌' : '—'}
                        </span>
                        <span className="text-gray-700 truncate flex-1">{r.companyName}</span>
                        {r.date && <span className="text-gray-500 flex-shrink-0">{fmtDate(r.date)}</span>}
                        {!r.ok && !r.err && <span className="text-gray-400 flex-shrink-0">掲載なし</span>}
                      </div>
                    ))}
                  </div>
                  {bulkProgress.done === bulkProgress.total && (
                    <p className="text-xs text-green-700 font-medium mt-2">
                      ✅ 完了: {bulkProgress.results.filter(r => r.ok).length}社を更新しました
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Per-company search */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-sm font-semibold text-gray-900">顧客別 求人検索</h3>
              <input type="text" value={searchCompany} onChange={e => setSearchCompany(e.target.value)}
                placeholder="会社名で絞り込み..."
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400 flex-1" />
            </div>

            <div className="space-y-2">
              {filteredCustomers.map(c => {
                const mo = monthsAgo(c.lastPostingDate)
                return (
                  <div key={c.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setActiveCompany(activeCompany === c.id ? null : c.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900">{c.companyName}</span>
                        {c.assignedTo && <span className="text-xs text-gray-400 ml-2">担当: {c.assignedTo}</span>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.lastPostingDate ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            mo >= 6 ? 'bg-red-100 text-red-700'
                            : mo >= 3 ? 'bg-orange-100 text-orange-700'
                            : mo >= 1 ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                          }`}>
                            {fmtDate(c.lastPostingDate)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">掲載日未取得</span>
                        )}
                        <span className="text-gray-400 text-xs">{activeCompany === c.id ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {activeCompany === c.id && (
                      <div className="px-4 pb-4 border-t border-gray-100">
                        <CompanyIndeedSearch
                          customer={c}
                          publisherKey={config.publisherKey}
                          onUpdatePosting={handleUpdatePosting}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
              {filteredCustomers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">顧客が見つかりません</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
