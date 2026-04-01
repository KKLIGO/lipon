import React, { useState, useRef } from 'react'

const AI_KEY_STORAGE = 'crm_ai_key_v1'

function loadApiKey() {
  try { return localStorage.getItem(AI_KEY_STORAGE) || '' } catch { return '' }
}
function saveApiKey(key) {
  localStorage.setItem(AI_KEY_STORAGE, key)
}

// Build pipeline summary for AI
function buildPipelineSummary(customers, rep, period) {
  const fc = rep === '全体' ? customers : customers.filter(c => c.assignedTo === rep)
  const total = fc.length
  const byStatus = {}
  const byForecast = {}
  let totalDeal = 0, wonDeal = 0, pipelineDeal = 0, forecastABDeal = 0

  fc.forEach(c => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1
    if (c.forecast) byForecast[c.forecast] = (byForecast[c.forecast] || 0) + 1
    const amt = c.dealAmount ? Number(c.dealAmount) : 0
    totalDeal += amt
    if (c.status === '成約') wonDeal += amt
    if (c.status === '商談中' || c.status === '提案済') pipelineDeal += amt
    if (c.forecast === 'A' || c.forecast === 'B') forecastABDeal += amt
  })

  const pipeline = fc
    .filter(c => c.status !== '成約' && c.status !== '失注')
    .map(c => ({
      会社名: c.companyName,
      ステータス: c.status,
      担当: c.assignedTo || '未割当',
      売上_万円: c.dealAmount || 0,
      ヨミ: c.forecast || '未設定',
      関係性: c.relationship || '未設定',
      最終掲載日: c.lastPostingDate || '未設定',
    }))
    .sort((a, b) => b.売上_万円 - a.売上_万円)
    .slice(0, 20)

  return {
    期間: period,
    担当者: rep,
    顧客総数: total,
    ステータス内訳: byStatus,
    ヨミ内訳: byForecast,
    売上合計_万円: totalDeal,
    成約済_万円: wonDeal,
    パイプライン_万円: pipelineDeal,
    ABヨミ_万円: forecastABDeal,
    パイプライン詳細: pipeline,
  }
}

// Build activity summary for AI
function buildActivitySummary(customers, rep, period, fromStr, toStr) {
  const fc = rep === '全体' ? customers : customers.filter(c => c.assignedTo === rep)

  const allHistory = []
  fc.forEach(c => {
    (c.history || []).forEach(h => {
      if (h.date && h.date >= fromStr && h.date <= toStr) {
        allHistory.push({
          会社名: c.companyName,
          担当: c.assignedTo || '未割当',
          日付: h.date,
          接触方法: h.contactMethod || h.type || '不明',
          接触内容: Array.isArray(h.contactTypes) ? h.contactTypes.join('・') : (h.contactTypes || ''),
          参加者_LIGO: Array.isArray(h.ligoParticipants) ? h.ligoParticipants.join('・') : '',
          満足度: h.satisfaction || '',
          内容概要: h.content ? h.content.slice(0, 80) : '',
        })
      }
    })
  })

  // Aggregate
  const byMethod = {}, byType = {}, byRep = {}, byWeek = {}
  allHistory.forEach(h => {
    byMethod[h.接触方法] = (byMethod[h.接触方法] || 0) + 1
    if (h.接触内容) {
      h.接触内容.split('・').filter(Boolean).forEach(t => {
        byType[t] = (byType[t] || 0) + 1
      })
    }
    byRep[h.担当] = (byRep[h.担当] || 0) + 1
    const week = h.日付.slice(0, 7) // YYYY-MM
    byWeek[week] = (byWeek[week] || 0) + 1
  })

  return {
    期間: `${fromStr} 〜 ${toStr}`,
    担当者フィルタ: rep,
    総活動件数: allHistory.length,
    接触方法別: byMethod,
    接触内容別: byType,
    担当者別活動数: byRep,
    月別推移: byWeek,
    直近活動サンプル: allHistory.slice(-15).reverse(),
  }
}

// Call Claude API with streaming
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
      max_tokens: 1500,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        if (json.type === 'content_block_delta' && json.delta?.text) {
          onChunk(json.delta.text)
        }
      } catch {}
    }
  }
}

function AnalysisPanel({ title, icon, prompt, apiKey, disabled }) {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const resultRef = useRef('')

  async function run() {
    if (!apiKey || !prompt) return
    setLoading(true)
    setError('')
    setResult('')
    resultRef.current = ''
    try {
      await callClaude(apiKey, prompt, chunk => {
        resultRef.current += chunk
        setResult(resultRef.current)
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{icon} {title}</h3>
        <button onClick={run} disabled={loading || disabled}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
          {loading ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              分析中...
            </>
          ) : '✨ AI分析'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
          ❌ {error}
        </div>
      )}

      {result ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
          {result}
          {loading && <span className="inline-block w-2 h-4 bg-gray-400 ml-0.5 animate-pulse" />}
        </div>
      ) : !loading && (
        <div className="text-center py-6 text-gray-400 text-xs">
          「AI分析」ボタンを押すと分析を開始します
        </div>
      )}
    </div>
  )
}

export default function AIAnalysis({ customers, selectedRep, periodMode, fromStr, toStr }) {
  const [apiKey, setApiKey] = useState(loadApiKey)
  const [apiKeyInput, setApiKeyInput] = useState(loadApiKey)
  const [showKey, setShowKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [analysisPeriod, setAnalysisPeriod] = useState('月間')

  function handleSaveKey() {
    saveApiKey(apiKeyInput)
    setApiKey(apiKeyInput)
    setKeySaved(true)
    setTimeout(() => setKeySaved(false), 2000)
  }

  // Determine period label for AI prompt
  const periodLabel = analysisPeriod === '週間' ? '直近7日間'
    : analysisPeriod === '月間' ? '今月'
    : 'Q（直近3ヶ月）'

  // Date range for activity analysis
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const actFromStr = analysisPeriod === '週間'
    ? new Date(today.getTime() - 6*86400000).toISOString().split('T')[0]
    : analysisPeriod === '月間'
    ? `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`
    : new Date(today.getFullYear(), today.getMonth()-2, 1).toISOString().split('T')[0]

  const pipelineData = buildPipelineSummary(customers, selectedRep, periodLabel)
  const activityData = buildActivitySummary(customers, selectedRep, periodLabel, actFromStr, todayStr)

  const salesPrompt = `あなたは優秀な営業コンサルタントです。以下のCRM パイプラインデータを分析し、売上予測と改善提案を日本語で行ってください。

【分析期間】${periodLabel}
【担当者】${selectedRep}

【パイプラインデータ】
${JSON.stringify(pipelineData, null, 2)}

以下の形式で分析してください：

## 📊 売上予測
- 今期予測売上（ABヨミベース）
- 楽観シナリオ / 悲観シナリオ

## 🔍 パイプライン評価
- 健全性スコア（5段階）とその根拠
- 注目すべき案件（上位3社）

## ⚠️ リスク要因
- 失注リスクの高い案件と理由

## 💡 アクション提案
- 売上向上のための具体的な次のアクション（3つ）

簡潔かつ具体的に回答してください。`

  const activityPrompt = `あなたは優秀な営業マネージャーです。以下の活動履歴データを分析し、行動パターンと改善提案を日本語で行ってください。

【分析期間】${periodLabel}
【担当者フィルタ】${selectedRep}

【活動データ】
${JSON.stringify(activityData, null, 2)}

以下の形式で分析してください：

## 📈 活動量の評価
- 活動件数の評価（多い/適切/少ない）
- 期間中のトレンド

## 🔍 行動パターン分析
- 接触方法の偏り・特徴
- 接触内容（取材/振返り/商談）のバランス
- 担当者別の違い（全体表示時）

## ⚠️ 課題・懸念点
- 活動が少ない時期や担当者
- 改善が必要なポイント

## 💡 改善提案
- 具体的な行動改善案（3つ）

簡潔かつ具体的に回答してください。`

  const disabled = !apiKey

  return (
    <div className="space-y-4">

      {/* API Key設定 */}
      <div className={`card p-4 ${!apiKey ? 'border-yellow-300 bg-yellow-50' : 'border-purple-200 bg-purple-50'}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-purple-700 font-semibold text-sm">🤖 Claude AI 設定</span>
          {apiKey && <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">✅ APIキー設定済み</span>}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder="sk-ant-api... (Anthropic APIキー)"
              className="form-input text-sm pr-10"
            />
            <button type="button" onClick={() => setShowKey(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
              {showKey ? '🙈' : '👁'}
            </button>
          </div>
          <button onClick={handleSaveKey} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
            {keySaved ? '✅ 保存' : '保存'}
          </button>
        </div>
        {!apiKey && (
          <p className="text-xs text-yellow-700 mt-2">
            ⚠️ Anthropic APIキーを設定するとAI分析が使用できます。
            <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="underline ml-1">APIキーを取得 →</a>
          </p>
        )}
      </div>

      {/* 期間選択 */}
      <div className="card p-3 flex items-center gap-3">
        <span className="text-xs font-medium text-gray-500">AI分析期間</span>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {['週間','月間','Q'].map(p => (
            <button key={p} onClick={() => setAnalysisPeriod(p)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                analysisPeriod === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>{p === 'Q' ? 'Q（四半期）' : p}</button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{periodLabel} · {selectedRep}</span>
      </div>

      {/* 売上予測 */}
      <AnalysisPanel
        title="売上予測"
        icon="💰"
        prompt={salesPrompt}
        apiKey={apiKey}
        disabled={disabled}
      />

      {/* 行動分析 */}
      <AnalysisPanel
        title={`行動パターン分析（${periodLabel}）`}
        icon="📈"
        prompt={activityPrompt}
        apiKey={apiKey}
        disabled={disabled}
      />

    </div>
  )
}
