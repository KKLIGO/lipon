import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useYomiManager, calcActual } from '../hooks/useYomiManager'
import StatusBadge from './StatusBadge'

const AI_KEY = 'crm_ai_key_v1'
function loadApiKey() { try { return localStorage.getItem(AI_KEY) || '' } catch { return '' } }

const FORECAST_OPTS = ['', 'A', 'B', 'C', 'D']
const FORECAST_COLORS = {
  A: 'bg-green-100 text-green-700 border-green-300',
  B: 'bg-blue-100 text-blue-700 border-blue-300',
  C: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  D: 'bg-gray-100 text-gray-600 border-gray-300',
}

function getMonthLabel(monthStr) {
  const [y, m] = monthStr.split('-')
  return `${y}年${parseInt(m)}月`
}

function getMonthStr(offsetMonths = 0) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offsetMonths)
  return d.toISOString().slice(0, 7)
}

// Claude AI streaming call
async function callClaude(apiKey, prompt, onChunk) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e?.error?.message || `HTTP ${res.status}`) }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n'); buf = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const d = line.slice(6).trim()
      if (d === '[DONE]') return
      try { const j = JSON.parse(d); if (j.delta?.text) onChunk(j.delta.text) } catch {}
    }
  }
}

// 顧客の特定月の売上を取得（repMonthlySales → monthlySales の順で参照）
function getMonthSales(c, monthStr) {
  const rep = c.repMonthlySales?.[monthStr]
  if (rep) return Math.round(rep / 10000)
  const billing = c.monthlySales?.[monthStr]
  if (billing) return Math.round(billing / 10000)
  return 0
}

export default function YomiManager({ customers, currentUser, onUpdateRepSales }) {
  const [selectedMonth, setSelectedMonth] = useState(getMonthStr(0))
  const [selectedRep, setSelectedRep] = useState(currentUser?.role !== 'admin' ? (currentUser?.assignedTo || '') : '')
  const [showHistory, setShowHistory] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [activeTab, setActiveTab] = useState('input') // 'input' | 'review'
  const aiRef = useRef('')

  const mgr = useYomiManager()

  // Available reps
  const allReps = useMemo(() => {
    const s = new Set()
    customers.forEach(c => { if (c.assignedTo) s.add(c.assignedTo) })
    return Array.from(s).sort()
  }, [customers])

  // Filter customers for selected rep & active statuses
  const targetCustomers = useMemo(() => {
    let list = customers.filter(c => c.status !== '失注')
    if (selectedRep) list = list.filter(c => c.assignedTo === selectedRep)
    return list.sort((a, b) => {
      const rank = { '商談中': 0, '提案済': 1, 'リード': 2, '成約': 3 }
      return (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
    })
  }, [customers, selectedRep])

  // Previous months actuals
  const prevMonth1 = getMonthStr(-1)
  const prevMonth2 = getMonthStr(-2)
  const actual1 = useMemo(() => calcActual(customers, prevMonth1, selectedRep || null), [customers, prevMonth1, selectedRep])
  const actual2 = useMemo(() => calcActual(customers, prevMonth2, selectedRep || null), [customers, prevMonth2, selectedRep])

  // Snapshots
  const snapshots = mgr.getSnapshots(selectedMonth)

  // Init working entries when month/rep changes
  useEffect(() => {
    mgr.initWorkingEntries(selectedMonth, targetCustomers, selectedRep || null)
  }, [selectedMonth, selectedRep])

  // Total yomi from working entries
  const totalYomi = useMemo(() => {
    return targetCustomers.reduce((s, c) => {
      const e = mgr.workingEntries[c.id]
      return s + (Number(e?.yomiAmount) || 0)
    }, 0)
  }, [targetCustomers, mgr.workingEntries])

  // Month actual (current month - from '成約' data)
  const currentActual = useMemo(() => calcActual(customers, selectedMonth, selectedRep || null), [customers, selectedMonth, selectedRep])

  function handleSaveSnapshot() {
    const label = mgr.saveSnapshot(selectedMonth, targetCustomers)

    // 受注金額（juchuAmount）を顧客の repMonthlySales に一括保存
    if (onUpdateRepSales) {
      const repSalesMap = {}
      targetCustomers.forEach(c => {
        const e = mgr.workingEntries[c.id]
        if (!e) return
        const amt = Number(e.juchuAmount)
        if (amt > 0) {
          repSalesMap[c.id] = amt * 10000
        } else if (e.juchuAmount === '' && c.repMonthlySales?.[selectedMonth]) {
          repSalesMap[c.id] = 0 // クリア
        }
      })
      if (Object.keys(repSalesMap).length > 0) {
        onUpdateRepSales(selectedMonth, repSalesMap)
      }
    }

    setSaveMsg(`✅ 「${label}」として保存しました`)
    setTimeout(() => setSaveMsg(''), 3000)
  }

  // Variance data for review tab
  const variance = useMemo(() => mgr.getVariance(selectedMonth, customers), [selectedMonth, customers, snapshots.length])

  async function handleAIReview() {
    const apiKey = loadApiKey()
    if (!apiKey) { setAiError('AIキーが未設定です。ダッシュボードのAI分析タブで設定してください。'); return }
    if (!variance) { setAiError('スナップショットがありません'); return }

    const { first, latest, firstMap, latestMap, actualMap, snaps } = variance

    // Build prompt data
    const repLabel = selectedRep || '全体'
    const monthLabel = getMonthLabel(selectedMonth)

    const firstTotal = first.totalYomi
    const latestTotal = latest.totalYomi
    const actualTotal = Object.values(actualMap).reduce((s, e) => s + e.actual, 0)

    // Per-customer comparison
    const allIds = new Set([
      ...Object.keys(firstMap),
      ...Object.keys(latestMap),
      ...Object.keys(actualMap),
    ])
    const rows = []
    allIds.forEach(id => {
      const f = firstMap[id]
      const l = latestMap[id]
      const a = actualMap[id]
      rows.push({
        会社名: f?.companyName || l?.companyName || a?.companyName || id,
        月初ヨミ: f?.yomiAmount || 0,
        月末ヨミ: l?.yomiAmount || 0,
        実績: a?.actual || 0,
        月初ランク: f?.yomiRank || '-',
        月末ランク: l?.yomiRank || '-',
        月初メモ: f?.note || '',
        月末メモ: l?.note || '',
      })
    })

    const weeklyTrend = snaps.map(s => ({ 週: s.label, ヨミ合計: s.totalYomi }))

    const prompt = `あなたは優秀な営業コンサルタントです。以下の月次ヨミ管理データを分析し、振返りレポートを作成してください。

【対象月】${monthLabel}
【担当者】${repLabel}

【集計サマリー】
- 月初ヨミ（第1週）: ${firstTotal}万円
- 月末ヨミ（最終週）: ${latestTotal}万円
- 今月実績（成約済）: ${actualTotal}万円
- 月初比ギャップ: ${actualTotal - firstTotal}万円（${actualTotal >= firstTotal ? '超過 ✅' : '未達 ⚠️'}）

【週次ヨミ推移】
${JSON.stringify(weeklyTrend, null, 2)}

【顧客別ヨミ vs 実績】
${JSON.stringify(rows.slice(0, 20), null, 2)}

以下の形式で振返りレポートを作成してください：

## 📊 月次サマリー
- ヨミ精度（実績/月初ヨミ）の評価
- 月中でのヨミの変化（上振れ/下振れ傾向）

## ✅ 良かった点
- 具体的に2〜3点

## ⚠️ 課題・ズレの原因分析
- ギャップが生じた主な要因（案件ごとに具体的に）
- 見込み判断の傾向（楽観的 or 悲観的）

## 💡 来月への改善提案
- ヨミ精度向上のための具体的なアクション（3点）
- 重点フォロー推奨案件

簡潔かつ具体的に回答してください（約400〜600字）`

    setAiLoading(true)
    setAiError('')
    setAiResult('')
    aiRef.current = ''
    try {
      await callClaude(apiKey, prompt, chunk => {
        aiRef.current += chunk
        setAiResult(aiRef.current)
      })
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  // Month options (current + 5 past months)
  const monthOptions = Array.from({ length: 6 }, (_, i) => getMonthStr(-i))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 ヨミ管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">週次ヨミ入力・月次振返り</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="form-select text-sm">
            {monthOptions.map(m => (
              <option key={m} value={m}>{getMonthLabel(m)}{m === getMonthStr(0) ? '（今月）' : ''}</option>
            ))}
          </select>
          {currentUser?.role === 'admin' && (
            <select value={selectedRep} onChange={e => setSelectedRep(e.target.value)}
              className="form-select text-sm">
              <option value="">全担当者</option>
              {allReps.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'input', label: '📝 ヨミ入力' },
          { key: 'review', label: '🔍 月次振返り' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            {t.key === 'review' && snapshots.length > 0 && (
              <span className="ml-1.5 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">{snapshots.length}件</span>
            )}
          </button>
        ))}
      </div>

      {/* ===== INPUT TAB ===== */}
      {activeTab === 'input' && (
        <div className="space-y-4">

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-3 border-blue-200 bg-blue-50">
              <div className="text-xs font-medium text-blue-600 mb-1">📊 今月ヨミ合計</div>
              <div className="text-2xl font-bold text-blue-700">{totalYomi > 0 ? totalYomi.toLocaleString() : '—'}<span className="text-xs font-normal ml-1">万円</span></div>
            </div>
            <div className="card p-3 border-green-200 bg-green-50">
              <div className="text-xs font-medium text-green-600 mb-1">✅ 今月実績（成約）</div>
              <div className="text-2xl font-bold text-green-700">{currentActual > 0 ? currentActual.toLocaleString() : '—'}<span className="text-xs font-normal ml-1">万円</span></div>
            </div>
            <div className="card p-3 border-gray-200 bg-gray-50">
              <div className="text-xs font-medium text-gray-500 mb-1">📅 先月実績 {getMonthLabel(prevMonth1)}</div>
              <div className="text-2xl font-bold text-gray-700">{actual1 > 0 ? actual1.toLocaleString() : '—'}<span className="text-xs font-normal ml-1">万円</span></div>
            </div>
            <div className="card p-3 border-gray-200 bg-gray-50">
              <div className="text-xs font-medium text-gray-400 mb-1">📅 先々月 {getMonthLabel(prevMonth2)}</div>
              <div className="text-2xl font-bold text-gray-500">{actual2 > 0 ? actual2.toLocaleString() : '—'}<span className="text-xs font-normal ml-1">万円</span></div>
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={handleSaveSnapshot}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 shadow-sm transition-colors">
              💾 今週のヨミを保存
            </button>
            {saveMsg && <span className="text-sm text-green-600 font-medium animate-pulse">{saveMsg}</span>}
            {mgr.isDirty && !saveMsg && <span className="text-xs text-orange-500">※ 未保存の変更があります</span>}
            {snapshots.length > 0 && (
              <button onClick={() => setShowHistory(h => !h)}
                className="text-sm text-gray-500 hover:text-gray-700 underline">
                {showHistory ? '▲ 履歴を閉じる' : `▼ 保存済み履歴 (${snapshots.length}件)`}
              </button>
            )}
          </div>

          {/* History */}
          {showHistory && snapshots.length > 0 && (
            <div className="card p-4 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">保存済みスナップショット</h3>
              <div className="space-y-2">
                {[...snapshots].reverse().map(snap => (
                  <div key={snap.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-4">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-800">{snap.label}</span>
                      <span className="text-xs text-gray-400 ml-3">{snap.date}</span>
                    </div>
                    <span className="text-sm font-bold text-blue-600">{snap.totalYomi.toLocaleString()} 万円</span>
                    <span className="text-xs text-gray-400">{snap.entries.length}件</span>
                    <button onClick={() => { if (window.confirm('このスナップショットを削除しますか？')) mgr.deleteSnapshot(selectedMonth, snap.id) }}
                      className="text-gray-300 hover:text-red-500 text-xs transition-colors">🗑</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Editable table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="table-header text-left min-w-[160px]">会社名</th>
                    {!selectedRep && <th className="table-header text-left">担当</th>}
                    <th className="table-header text-center">ステータス</th>
                    <th className="table-header text-right text-gray-400 text-xs">{getMonthLabel(prevMonth2)}<br/>実績</th>
                    <th className="table-header text-right text-gray-500 text-xs">{getMonthLabel(prevMonth1)}<br/>実績</th>
                    <th className="table-header text-right text-blue-600 text-xs">{getMonthLabel(selectedMonth)}<br/>ヨミ（万円）</th>
                    <th className="table-header text-center text-blue-600 text-xs">ランク</th>
                    <th className="table-header text-right text-green-600 text-xs">{getMonthLabel(selectedMonth)}<br/>受注金額</th>
                    <th className="table-header text-left text-xs">メモ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {targetCustomers.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-gray-400 text-sm">対象顧客なし</td></tr>
                  ) : targetCustomers.map(c => {
                    const e = mgr.workingEntries[c.id] || {}
                    const isWon = c.status === '成約'
                    const prevAmt1 = getMonthSales(c, prevMonth1)
                    const prevAmt2 = getMonthSales(c, prevMonth2)

                    return (
                      <tr key={c.id} className={`${isWon ? 'bg-green-50' : 'hover:bg-blue-50/30'} transition-colors`}>
                        <td className="table-cell">
                          <div className="font-semibold text-gray-900 text-sm">{c.companyName}</div>
                          {c.industry && <div className="text-xs text-gray-400">{c.industry}</div>}
                        </td>
                        {!selectedRep && (
                          <td className="table-cell">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c.assignedTo || '—'}</span>
                          </td>
                        )}
                        <td className="table-cell text-center">
                          <StatusBadge status={c.status} />
                        </td>
                        {/* 先々月実績 */}
                        <td className="table-cell text-right">
                          {prevAmt2 > 0 ? (
                            <span className="text-xs text-gray-400">{prevAmt2.toLocaleString()}万</span>
                          ) : <span className="text-gray-200 text-xs">—</span>}
                        </td>
                        {/* 先月実績 */}
                        <td className="table-cell text-right">
                          {prevAmt1 > 0 ? (
                            <span className="text-sm font-semibold text-gray-600">{prevAmt1.toLocaleString()}万</span>
                          ) : <span className="text-gray-200 text-xs">—</span>}
                        </td>
                        {/* ヨミ入力（商談中・見込みのみ） */}
                        <td className="table-cell">
                          <input
                            type="number"
                            min="0"
                            value={e.yomiAmount || ''}
                            onChange={ev => mgr.updateEntry(c.id, 'yomiAmount', ev.target.value)}
                            disabled={isWon}
                            placeholder="0"
                            className="w-24 text-right px-2 py-1 border border-gray-200 rounded-lg text-sm font-medium focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none disabled:bg-gray-50 disabled:text-gray-400 ml-auto block"
                          />
                        </td>
                        {/* ランク */}
                        <td className="table-cell text-center">
                          <div className="flex gap-1 justify-center">
                            {FORECAST_OPTS.filter(o => o).map(rank => (
                              <button key={rank}
                                onClick={() => mgr.updateEntry(c.id, 'yomiRank', e.yomiRank === rank ? '' : rank)}
                                disabled={isWon}
                                className={`w-7 h-7 rounded-lg text-xs font-bold border transition-all ${
                                  e.yomiRank === rank
                                    ? FORECAST_COLORS[rank]
                                    : 'border-gray-200 text-gray-300 hover:border-gray-400'
                                } disabled:opacity-40`}>
                                {rank}
                              </button>
                            ))}
                          </div>
                        </td>
                        {/* 受注金額（全ステータスで入力可） */}
                        <td className="table-cell">
                          <input
                            type="number"
                            min="0"
                            value={e.juchuAmount || ''}
                            onChange={ev => mgr.updateEntry(c.id, 'juchuAmount', ev.target.value)}
                            placeholder="0"
                            className={`w-24 text-right px-2 py-1 border rounded-lg text-sm font-medium focus:ring-1 outline-none ml-auto block transition-colors ${
                              isWon
                                ? 'border-green-300 bg-green-50 text-green-700 focus:border-green-400 focus:ring-green-200'
                                : 'border-gray-200 focus:border-green-400 focus:ring-green-200'
                            }`}
                          />
                        </td>
                        {/* メモ */}
                        <td className="table-cell">
                          <input
                            type="text"
                            value={e.note || ''}
                            onChange={ev => mgr.updateEntry(c.id, 'note', ev.target.value)}
                            disabled={isWon}
                            placeholder="備考（阻害要因・特記事項）"
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-600 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none disabled:bg-gray-50"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Footer total */}
                <tfoot>
                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td colSpan={!selectedRep ? 5 : 4} className="table-cell text-right text-sm font-semibold text-blue-700">合計</td>
                    <td className="table-cell text-right text-sm font-bold text-blue-700">
                      {totalYomi > 0 ? `${totalYomi.toLocaleString()} 万円` : '—'}
                    </td>
                    <td></td>
                    <td className="table-cell text-right text-sm font-bold text-green-700">
                      {(() => {
                        const total = targetCustomers.reduce((s, c) => {
                          const e = mgr.workingEntries[c.id]
                          return s + (Number(e?.juchuAmount) || 0)
                        }, 0)
                        return total > 0 ? `${total.toLocaleString()} 万円` : '—'
                      })()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== REVIEW TAB ===== */}
      {activeTab === 'review' && (
        <div className="space-y-4">
          {!variance ? (
            <div className="card p-10 text-center text-gray-400">
              <div className="text-3xl mb-3">📋</div>
              <p className="text-sm">まだスナップショットがありません。</p>
              <p className="text-xs mt-1">「ヨミ入力」タブで「今週のヨミを保存」してください。</p>
            </div>
          ) : (() => {
            const { first, latest, firstMap, latestMap, actualMap, snaps } = variance
            const actualTotal = Object.values(actualMap).reduce((s, e) => s + e.actual, 0)
            const gap = actualTotal - first.totalYomi
            const accuracy = first.totalYomi > 0 ? Math.round(actualTotal / first.totalYomi * 100) : null

            return (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="card p-3 bg-gray-50 border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">📍 月初ヨミ（{first.label}）</div>
                    <div className="text-xl font-bold text-gray-700">{first.totalYomi.toLocaleString()}<span className="text-xs font-normal ml-1">万円</span></div>
                  </div>
                  <div className="card p-3 bg-blue-50 border-blue-200">
                    <div className="text-xs text-blue-600 mb-1">📊 最新ヨミ（{latest.label}）</div>
                    <div className="text-xl font-bold text-blue-700">{latest.totalYomi.toLocaleString()}<span className="text-xs font-normal ml-1">万円</span></div>
                  </div>
                  <div className="card p-3 bg-green-50 border-green-200">
                    <div className="text-xs text-green-600 mb-1">✅ 今月実績</div>
                    <div className="text-xl font-bold text-green-700">{actualTotal > 0 ? actualTotal.toLocaleString() : '—'}<span className="text-xs font-normal ml-1">万円</span></div>
                  </div>
                  <div className={`card p-3 border-2 ${gap >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                    <div className="text-xs font-medium mb-1" style={{color: gap >= 0 ? '#15803d' : '#b91c1c'}}>
                      {gap >= 0 ? '✅ 超過' : '⚠️ 未達'} vs 月初
                    </div>
                    <div className={`text-xl font-bold ${gap >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {gap >= 0 ? '+' : ''}{gap.toLocaleString()}<span className="text-xs font-normal ml-1">万円</span>
                    </div>
                    {accuracy !== null && (
                      <div className="text-xs mt-0.5" style={{color: gap >= 0 ? '#15803d' : '#b91c1c'}}>
                        達成率 {accuracy}%
                      </div>
                    )}
                  </div>
                </div>

                {/* Weekly trend */}
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">📈 週次ヨミ推移</h3>
                  <div className="flex items-end gap-3 overflow-x-auto pb-2">
                    {snaps.map((snap, i) => {
                      const max = Math.max(...snaps.map(s => s.totalYomi), actualTotal, 1)
                      const h = Math.round((snap.totalYomi / max) * 80)
                      return (
                        <div key={snap.id} className="flex flex-col items-center flex-shrink-0 min-w-[64px]">
                          <span className="text-xs text-gray-500 mb-1">{snap.totalYomi > 0 ? snap.totalYomi.toLocaleString() : '0'}万</span>
                          <div className="w-12 bg-blue-200 rounded-t-md transition-all" style={{height: `${h}px`, minHeight: '4px'}} />
                          <span className="text-xs text-gray-400 mt-1 text-center leading-tight">{snap.label.split('（')[0]}</span>
                          <span className="text-xs text-gray-300">{snap.date}</span>
                        </div>
                      )
                    })}
                    {/* Actual bar */}
                    {actualTotal > 0 && (() => {
                      const max = Math.max(...snaps.map(s => s.totalYomi), actualTotal, 1)
                      const h = Math.round((actualTotal / max) * 80)
                      return (
                        <div className="flex flex-col items-center flex-shrink-0 min-w-[64px]">
                          <span className="text-xs text-green-600 font-semibold mb-1">{actualTotal.toLocaleString()}万</span>
                          <div className="w-12 bg-green-400 rounded-t-md" style={{height: `${h}px`, minHeight: '4px'}} />
                          <span className="text-xs text-green-600 font-medium mt-1">実績</span>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Per-customer variance table */}
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-800">顧客別 ヨミ vs 実績</h3>
                    <span className="text-xs text-gray-400">月初ヨミと実績の比較</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="table-header text-left">会社名</th>
                          <th className="table-header text-right text-gray-500">月初ヨミ</th>
                          <th className="table-header text-right text-blue-600">最新ヨミ</th>
                          <th className="table-header text-right text-green-600">実績</th>
                          <th className="table-header text-right">差異</th>
                          <th className="table-header text-left">メモ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(() => {
                          const allIds = [...new Set([...Object.keys(firstMap), ...Object.keys(latestMap), ...Object.keys(actualMap)])]
                          return allIds.map(id => {
                            const f = firstMap[id] || {}
                            const l = latestMap[id] || {}
                            const a = actualMap[id] || {}
                            const diff = (a.actual || 0) - (f.yomiAmount || 0)
                            const name = f.companyName || l.companyName || a.companyName || id
                            return (
                              <tr key={id} className={diff > 0 ? 'bg-green-50/30' : diff < 0 ? 'bg-red-50/20' : ''}>
                                <td className="table-cell">
                                  <span className="text-sm font-medium text-gray-800">{name}</span>
                                  {(f.yomiRank || l.yomiRank) && (
                                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded border ${FORECAST_COLORS[l.yomiRank || f.yomiRank] || 'bg-gray-100 border-gray-200 text-gray-500'}`}>
                                      {l.yomiRank || f.yomiRank}
                                    </span>
                                  )}
                                </td>
                                <td className="table-cell text-right text-sm text-gray-500">
                                  {f.yomiAmount ? `${Number(f.yomiAmount).toLocaleString()}万` : '—'}
                                </td>
                                <td className="table-cell text-right text-sm text-blue-600">
                                  {l.yomiAmount ? `${Number(l.yomiAmount).toLocaleString()}万` : '—'}
                                </td>
                                <td className="table-cell text-right text-sm font-semibold text-green-700">
                                  {a.actual ? `${a.actual.toLocaleString()}万` : '—'}
                                </td>
                                <td className="table-cell text-right">
                                  {f.yomiAmount ? (
                                    <span className={`text-xs font-semibold ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                      {diff > 0 ? '+' : ''}{diff.toLocaleString()}万
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="table-cell text-xs text-gray-400">
                                  {l.note || f.note || '—'}
                                </td>
                              </tr>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* AI Review */}
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">🤖 AI振返りレポート</h3>
                    <button onClick={handleAIReview} disabled={aiLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
                      {aiLoading ? (
                        <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />生成中...</>
                      ) : '✨ AI振返りを生成'}
                    </button>
                  </div>
                  {aiError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 mb-3">❌ {aiError}</div>}
                  {aiResult ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {aiResult}
                      {aiLoading && <span className="inline-block w-2 h-4 bg-gray-400 ml-0.5 animate-pulse" />}
                    </div>
                  ) : !aiLoading && (
                    <p className="text-xs text-gray-400 text-center py-4">
                      「AI振返りを生成」を押すと、ヨミのズレ分析・原因分析・来月改善提案をAIが自動生成します
                    </p>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
