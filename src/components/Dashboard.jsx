import React, { useMemo, useState } from 'react'
import AIAnalysis from './AIAnalysis'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts'
import StatusBadge from './StatusBadge'

const STATUS_COLORS = {
  '商談中': '#3b82f6', '提案済': '#8b5cf6', '成約': '#10b981',
  '失注': '#ef4444', 'リード': '#f59e0b',
}
const FORECAST_COLORS = { A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#94a3b8' }
const FORECAST_LABELS = { A: 'A ほぼ確実', B: 'B 見込み', C: 'C 可能性', D: 'D 要確認' }
const REP_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4',
  '#84cc16','#f97316','#ec4899','#14b8a6','#a855f7','#eab308',
  '#0ea5e9','#22c55e','#dc2626','#7c3aed','#d97706','#059669','#db2777','#2563eb']
const CONTACT_METHOD_ICONS = { '電話':'📞','メール':'📧','LINE':'💬','訪問':'🏢','Web':'🌐','その他':'📝' }

const VIEWS = [
  { key: 'summary', label: '📊 サマリー' },
  { key: 'pipeline', label: '🔄 パイプライン' },
  { key: 'activity', label: '📈 活動量' },
  { key: 'alert', label: '⚠️ アラート' },
  { key: 'ai', label: '🤖 AI分析' },
]
const PERIOD_OPTIONS = [
  { key: '月間', label: '月間' },
  { key: 'Q', label: 'Q（四半期）' },
  { key: '年度', label: '年度' },
  { key: '月', label: '月指定' },
  { key: '自由', label: '自由設定' },
]

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
}
function getDaysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr); target.setHours(0,0,0,0)
  return Math.round((target - today) / 86400000)
}

function KpiCard({ icon, label, value, sub, color='blue', alert=false, onClick }) {
  const colors = { blue:'bg-blue-100 text-blue-600', green:'bg-green-100 text-green-600',
    red:'bg-red-100 text-red-600', yellow:'bg-yellow-100 text-yellow-600', purple:'bg-purple-100 text-purple-600' }
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`card p-3 sm:p-4 text-left w-full ${alert && value > 0 ? 'border-l-4 border-red-400' : ''} ${onClick ? 'hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group' : ''}`}>
      <div className="flex items-start gap-2 sm:gap-3">
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-sm sm:text-base flex-shrink-0 ${colors[color]}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className={`text-lg sm:text-xl font-bold ${alert && value > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          <div className="text-xs text-gray-500 leading-tight mt-0.5 break-keep">{label}</div>
          {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
          {onClick && <div className="text-xs text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">→ 顧客一覧で確認</div>}
        </div>
      </div>
    </Tag>
  )
}

export default function Dashboard({ customers, onNavigate, onSelectCustomer, hpMonitor, onNavigateToList }) {
  const [selectedRep, setSelectedRep] = useState('全体')
  const [activeView, setActiveView] = useState('summary')
  const [periodMode, setPeriodMode] = useState('月間')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [fiscalYear, setFiscalYear] = useState(() => new Date().getFullYear())
  const [selectedQuarter, setSelectedQuarter] = useState(() => Math.ceil((new Date().getMonth() + 1) / 3))
  const [selectedQuarterYear, setSelectedQuarterYear] = useState(() => new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1)
  const [selectedMonthYear, setSelectedMonthYear] = useState(() => new Date().getFullYear())
  const [repSearch, setRepSearch] = useState('')

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekEndStr = new Date(today.getTime() + 7*86400000).toISOString().split('T')[0]
  const thirtyStr = new Date(today.getTime() + 30*86400000).toISOString().split('T')[0]

  // All reps from actual data (dynamic — supports 20+ reps)
  const allReps = useMemo(() => {
    const reps = new Set()
    customers.forEach(c => { if (c.assignedTo) reps.add(c.assignedTo) })
    return ['全体', ...Array.from(reps).sort()]
  }, [customers])

  // Period range
  const { fromStr, toStr, trendBuckets } = useMemo(() => {
    let fromS, toS = todayStr

    if (periodMode === '週間') {
      const d = new Date(today); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0)
      fromS = d.toISOString().split('T')[0]
    } else if (periodMode === '月間') {
      const d = new Date(today); d.setDate(1); d.setHours(0,0,0,0)
      fromS = d.toISOString().split('T')[0]
    } else if (periodMode === 'Q') {
      const qStart = (selectedQuarter - 1) * 3 + 1
      const qEnd = selectedQuarter * 3
      fromS = `${selectedQuarterYear}-${String(qStart).padStart(2,'0')}-01`
      const lastDay = new Date(selectedQuarterYear, qEnd, 0).getDate()
      const qEndStr = `${selectedQuarterYear}-${String(qEnd).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
      toS = qEndStr < todayStr ? qEndStr : todayStr
    } else if (periodMode === '年度') {
      fromS = `${fiscalYear}-01-01`
      const fyEnd = `${fiscalYear}-12-31`
      toS = fyEnd < todayStr ? fyEnd : todayStr
    } else if (periodMode === '月') {
      const m = String(selectedMonth).padStart(2,'0')
      fromS = `${selectedMonthYear}-${m}-01`
      const lastDay = new Date(selectedMonthYear, selectedMonth, 0).getDate()
      const mEnd = `${selectedMonthYear}-${m}-${String(lastDay).padStart(2,'0')}`
      toS = mEnd < todayStr ? mEnd : todayStr
    } else {
      fromS = customFrom || '2000-01-01'
      toS = customTo || todayStr
    }

    // Build trend buckets
    let buckets = []
    if (periodMode === '週間') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0]
        buckets.push({ key, label: `${d.getMonth()+1}/${d.getDate()}`, count: 0, matchFn: h => h.date === key })
      }
    } else if (periodMode === '月間' || periodMode === '月') {
      // Weekly buckets within the month
      const refDate = periodMode === '月' ? new Date(selectedMonthYear, selectedMonth - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1)
      const year = refDate.getFullYear(), month = refDate.getMonth()
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      for (let w = 0; w < 5; w++) {
        const startDay = w * 7 + 1
        if (startDay > daysInMonth) break
        const endDay = Math.min(startDay + 6, daysInMonth)
        const startStr = `${year}-${String(month+1).padStart(2,'0')}-${String(startDay).padStart(2,'0')}`
        const endStr = `${year}-${String(month+1).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`
        buckets.push({ key: startStr, label: `${month+1}/${startDay}〜`, count: 0, matchFn: h => h.date >= startStr && h.date <= endStr })
      }
    } else if (periodMode === '年度') {
      // Monthly buckets for 12 months of calendar year (Jan–Dec)
      for (let i = 0; i < 12; i++) {
        const d = new Date(fiscalYear, i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        buckets.push({ key, label: `${d.getMonth()+1}月`, count: 0, matchFn: h => h.date?.startsWith(key) })
      }
    } else if (periodMode === 'Q') {
      // Fixed quarter buckets (3 months)
      const qStart = (selectedQuarter - 1) * 3
      for (let i = 0; i < 3; i++) {
        const m = qStart + i + 1
        const key = `${selectedQuarterYear}-${String(m).padStart(2,'0')}`
        buckets.push({ key, label: `${m}月`, count: 0, matchFn: h => h.date?.startsWith(key) })
      }
    } else {
      // Monthly buckets (free)
      const months = (() => {
        if (!customFrom) return 6
        const from = new Date(customFrom), to = customTo ? new Date(customTo) : new Date()
        return Math.max(1, Math.ceil((to - from) / (30 * 86400000)))
      })()
      for (let i = Math.min(months, 12) - 1; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        buckets.push({ key, label: `${d.getMonth()+1}月`, count: 0, matchFn: h => h.date?.startsWith(key) })
      }
    }

    return { fromStr: fromS, toStr: toS, trendBuckets: buckets }
  }, [periodMode, customFrom, customTo, fiscalYear, selectedMonth, selectedMonthYear, selectedQuarter, selectedQuarterYear, todayStr])

  // Filter customers by rep
  const fc = useMemo(() =>
    selectedRep === '全体' ? customers : customers.filter(c => c.assignedTo === selectedRep),
    [customers, selectedRep]
  )

  // Filter history by period
  function historyInPeriod(history) {
    return (history || []).filter(h => h.date && h.date >= fromStr && h.date <= toStr)
  }

  // 期間内売上を計算するヘルパー
  function salesInPeriod(c) {
    // 月次データがある場合はそちらを優先（YYYY-MM キー）
    if (c.monthlySales && Object.keys(c.monthlySales).length > 0) {
      const fromM = fromStr.slice(0, 7)
      const toM = toStr.slice(0, 7)
      return Object.entries(c.monthlySales).reduce((sum, [m, v]) => (m >= fromM && m <= toM ? sum + v : sum), 0) / 10000
    }
    // 年次データ（annualSales）: その年の全期間（1/1〜12/31）がperiod内に含まれる年のみ合算
    if (c.annualSales && Object.keys(c.annualSales).length > 0) {
      return Object.entries(c.annualSales).reduce((sum, [y, v]) => {
        const yearStart = `${y}-01-01`
        const yearEnd = `${y}-12-31`
        // 年全体がperiod範囲内に収まる場合のみカウント
        if (yearStart >= fromStr && yearEnd <= toStr) return sum + v
        return sum
      }, 0) / 10000
    }
    return 0
  }

  // Snapshot KPIs (一部period対応)
  const stats = useMemo(() => {
    const total = fc.length
    const active = fc.filter(c => c.status === '商談中' || c.status === '提案済').length
    const won = fc.filter(c => c.status === '成約').length
    const overdue = fc.filter(c => c.nextAction?.date && c.nextAction.date < todayStr).length
    const weekActions = fc.filter(c => c.nextAction?.date && c.nextAction.date >= todayStr && c.nextAction.date <= weekEndStr).length
    const totalDeal = fc.reduce((s, c) => s + salesInPeriod(c), 0)
    const wonDeal = fc.filter(c => c.status === '成約').reduce((s, c) => s + salesInPeriod(c), 0)
    const pipelineDeal = fc.filter(c => c.status === '商談中' || c.status === '提案済').reduce((s, c) => s + salesInPeriod(c), 0)
    const forecastAB = fc.filter(c => c.forecast === 'A' || c.forecast === 'B').reduce((s, c) => s + salesInPeriod(c), 0)
    const periodCompanies = fc.filter(c => salesInPeriod(c) > 0).length
    const leads = fc.filter(c => c.status === 'リード').length
    const existing = fc.filter(c => c.status === '成約').length
    const prospect = fc.filter(c => c.status === '見込み').length
    return { total, active, won, overdue, weekActions, totalDeal: Math.round(totalDeal), wonDeal: Math.round(wonDeal), pipelineDeal: Math.round(pipelineDeal), forecastAB: Math.round(forecastAB), periodCompanies, leads, existing, prospect }
  }, [fc, todayStr, weekEndStr, fromStr, toStr])

  // Period-filtered activity KPIs
  const periodStats = useMemo(() => {
    let totalAct = 0
    fc.forEach(c => { totalAct += historyInPeriod(c.history).length })
    return { totalAct }
  }, [fc, fromStr, toStr])

  const statusData = useMemo(() => {
    const counts = {}
    fc.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [fc])

  const forecastData = useMemo(() => {
    const data = { A:{count:0,amount:0}, B:{count:0,amount:0}, C:{count:0,amount:0}, D:{count:0,amount:0} }
    fc.forEach(c => {
      if (c.forecast && data[c.forecast]) {
        data[c.forecast].count++
        data[c.forecast].amount += Math.round(salesInPeriod(c))
      }
    })
    return ['A','B','C','D'].map(k => ({ key:k, label:FORECAST_LABELS[k], color:FORECAST_COLORS[k], ...data[k] }))
  }, [fc, fromStr, toStr])

  const relationshipData = useMemo(() => {
    const counts = { '☀️':0, '☁️':0, '☔️':0 }
    fc.forEach(c => { if (counts[c.relationship] !== undefined) counts[c.relationship]++ })
    return [
      { name:'☀️ 良好', value:counts['☀️'], color:'#f59e0b' },
      { name:'☁️ 普通', value:counts['☁️'], color:'#94a3b8' },
      { name:'☔️ 不調', value:counts['☔️'], color:'#3b82f6' },
    ].filter(d => d.value > 0)
  }, [fc])

  const satisfactionData = useMemo(() => {
    const counts = { '☀️':0, '☁️':0, '☔️':0 }
    fc.forEach(c => {
      historyInPeriod(c.history).forEach(h => {
        if (h.satisfaction && counts[h.satisfaction] !== undefined) counts[h.satisfaction]++
      })
    })
    return [
      { name:'☀️ 満足', value:counts['☀️'], color:'#f59e0b' },
      { name:'☁️ 普通', value:counts['☁️'], color:'#94a3b8' },
      { name:'☔️ 不満', value:counts['☔️'], color:'#3b82f6' },
    ].filter(d => d.value > 0)
  }, [fc, fromStr, toStr])

  // Activity trend (period-filtered)
  const activityTrend = useMemo(() => {
    const buckets = trendBuckets.map(b => ({ ...b }))
    fc.forEach(c => {
      historyInPeriod(c.history).forEach(h => {
        const b = buckets.find(b => b.matchFn(h))
        if (b) b.count++
      })
    })
    return buckets
  }, [fc, trendBuckets, fromStr, toStr])

  const methodData = useMemo(() => {
    const counts = {}
    fc.forEach(c => {
      historyInPeriod(c.history).forEach(h => {
        const m = h.contactMethod || h.type || 'その他'
        counts[m] = (counts[m] || 0) + 1
      })
    })
    return Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([name,value]) => ({ name, value }))
  }, [fc, fromStr, toStr])

  const repData = useMemo(() => {
    const map = {}
    customers.forEach(c => {
      const rep = c.assignedTo || '未割当'
      if (!map[rep]) map[rep] = { rep, customers:0, activities:0, periodActivities:0, won:0, deal:0, overdue:0, active:0 }
      map[rep].customers++
      map[rep].activities += c.history?.length || 0
      map[rep].periodActivities += historyInPeriod(c.history).length
      if (c.status === '成約') map[rep].won++
      if (c.status === '商談中' || c.status === '提案済') map[rep].active++
      if (c.nextAction?.date && c.nextAction.date < todayStr) map[rep].overdue++
      map[rep].deal += Math.round(salesInPeriod(c))
    })
    return Object.values(map).sort((a,b) => b.deal - a.deal)
  }, [customers, todayStr, fromStr, toStr])

  const pipelineData = useMemo(() => {
    const map = {}
    fc.forEach(c => {
      if (!map[c.status]) map[c.status] = { status:c.status, count:0, amount:0 }
      map[c.status].count++
      map[c.status].amount += salesInPeriod(c)
    })
    return ['リード','商談中','提案済','成約','失注'].filter(s => map[s])
      .map(s => ({ ...map[s], color:STATUS_COLORS[s] }))
  }, [fc])

  const upcomingActions = useMemo(() =>
    fc.filter(c => c.nextAction?.date && c.nextAction.date >= todayStr && c.nextAction.date <= thirtyStr)
      .sort((a,b) => a.nextAction.date.localeCompare(b.nextAction.date)),
    [fc, todayStr, thirtyStr]
  )
  const overdueList = useMemo(() =>
    fc.filter(c => c.nextAction?.date && c.nextAction.date < todayStr)
      .sort((a,b) => a.nextAction.date.localeCompare(b.nextAction.date)),
    [fc, todayStr]
  )

  // 最終掲載日アラート — days since lastPostingDate
  const POSTING_ALERT_THRESHOLDS = [
    { months: 1,  label: '1ヶ月',  color: 'yellow' },
    { months: 2,  label: '2ヶ月',  color: 'orange' },
    { months: 3,  label: '3ヶ月',  color: 'red'    },
    { months: 6,  label: '6ヶ月',  color: 'red'    },
    { months: 12, label: '12ヶ月', color: 'red'    },
  ]
  const postingAlertData = useMemo(() => {
    const now = new Date(todayStr)
    return fc
      .filter(c => c.lastPostingDate)
      .map(c => {
        const posted = new Date(c.lastPostingDate)
        const diffMs = now - posted
        const diffDays = Math.floor(diffMs / 86400000)
        const diffMonths = diffDays / 30.44
        return { ...c, diffDays, diffMonths }
      })
      .filter(c => c.diffMonths >= 1)
      .sort((a, b) => b.diffMonths - a.diffMonths)
  }, [fc, todayStr])

  const [postingAlertFilter, setPostingAlertFilter] = useState(1)

  const selectedRepIdx = allReps.indexOf(selectedRep)
  const selectedRepColor = selectedRep === '全体' ? '#6b7280' : REP_COLORS[(selectedRepIdx - 1) % REP_COLORS.length]

  // Period label for display
  const periodLabel = periodMode === '自由'
    ? (customFrom || customTo ? `${customFrom || '〜'} 〜 ${customTo || todayStr}` : '全期間')
    : periodMode === '週間' ? '今週（7日間）'
    : periodMode === '月間' ? `${today.getMonth()+1}月`
    : periodMode === '年度' ? `${fiscalYear}年（1〜12月）`
    : periodMode === '月' ? `${selectedMonthYear}年${selectedMonth}月`
    : `${selectedQuarterYear}年 ${selectedQuarter}Q（${(selectedQuarter-1)*3+1}〜${selectedQuarter*3}月）`

  // Filtered reps for search
  const filteredReps = allReps.filter(r => r === '全体' || r.includes(repSearch))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {today.getFullYear()}年{today.getMonth()+1}月{today.getDate()}日 現在
        </p>
      </div>

      {/* Rep selector — scrollable, supports 20+ */}
      <div className="card p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 flex-shrink-0">担当者</span>
          <select
            value={selectedRep}
            onChange={e => setSelectedRep(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400 bg-white flex-shrink-0"
          >
            {allReps.map(rep => (
              <option key={rep} value={rep}>{rep}</option>
            ))}
          </select>
          {selectedRep !== '全体' && (
            <button onClick={() => setSelectedRep('全体')}
              className="text-xs text-gray-400 hover:text-gray-600 ml-auto flex-shrink-0">
              ✕ 絞込解除
            </button>
          )}
        </div>
      </div>

      {/* Period filter */}
      <div className="card p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-500 flex-shrink-0">期間</span>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
            {PERIOD_OPTIONS.map(p => (
              <button key={p.key} onClick={() => {
                  setPeriodMode(p.key)
                  const t = new Date()
                  if (p.key === 'Q') { setSelectedQuarter(Math.ceil((t.getMonth()+1)/3)); setSelectedQuarterYear(t.getFullYear()) }
                  else if (p.key === '年度') setFiscalYear(t.getFullYear())
                  else if (p.key === '月') { setSelectedMonth(t.getMonth()+1); setSelectedMonthYear(t.getFullYear()) }
                }}
                className={`flex-shrink-0 whitespace-nowrap px-3 py-1 rounded text-xs font-medium transition-all ${
                  periodMode === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          {periodMode === '年度' && (
            <div className="flex items-center gap-2">
              <button onClick={() => setFiscalYear(y => y - 1)}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">◀</button>
              <span className="text-xs font-medium text-gray-700 min-w-[60px] text-center">{fiscalYear}年</span>
              <button onClick={() => setFiscalYear(y => y + 1)}
                disabled={fiscalYear >= today.getFullYear()}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">▶</button>
            </div>
          )}
          {periodMode === 'Q' && (
            <div className="flex items-center gap-2">
              <button onClick={() => { if (selectedQuarter === 1) { setSelectedQuarter(4); setSelectedQuarterYear(y => y - 1) } else setSelectedQuarter(q => q - 1) }}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">◀</button>
              <span className="text-xs font-medium text-gray-700 min-w-[80px] text-center">{selectedQuarterYear}年 {selectedQuarter}Q</span>
              <button onClick={() => { if (selectedQuarter === 4) { setSelectedQuarter(1); setSelectedQuarterYear(y => y + 1) } else setSelectedQuarter(q => q + 1) }}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">▶</button>
            </div>
          )}
          {periodMode === '月' && (
            <div className="flex items-center gap-1 flex-wrap">
              <select value={selectedMonthYear} onChange={e => setSelectedMonthYear(Number(e.target.value))}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400">
                {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
              <div className="flex gap-0.5 flex-wrap">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <button key={m} onClick={() => setSelectedMonth(m)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                      selectedMonth === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {m}月
                  </button>
                ))}
              </div>
            </div>
          )}
          {periodMode === '自由' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400" />
              <span className="text-xs text-gray-400">〜</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                max={todayStr}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400" />
            </div>
          )}
          <span className="text-xs text-gray-400 ml-auto">{periodLabel}</span>
        </div>
      </div>

      {/* View Tabs */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-max min-w-full sm:w-fit sm:min-w-0">
          {VIEWS.map(v => {
            const isAlert = v.key === 'alert'
            const hpBadge = isAlert && hpMonitor ? hpMonitor.changedCount : 0
            return (
              <button key={v.key} onClick={() => setActiveView(v.key)}
                className={`relative flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeView === v.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {v.label}
                {hpBadge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full font-bold">
                    {hpBadge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ===== SUMMARY ===== */}
      {activeView === 'summary' && (
        <div className="space-y-5">

          {/* ヒーロー売上バナー */}
          <div className="rounded-2xl p-6 text-white relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1a56db 60%, #7c3aed 100%)' }}>
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 0%, transparent 60%)' }} />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6">
              {/* メイン：期間売上 */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-xs font-semibold uppercase tracking-widest text-blue-200">売上合計</div>
                  <span className="text-xs bg-white/20 text-blue-100 rounded-full px-2 py-0.5">{periodLabel}</span>
                </div>
                <div className="text-5xl font-black tracking-tight leading-none">
                  {stats.totalDeal.toLocaleString()}
                  <span className="text-2xl font-bold ml-2 text-blue-200">万円</span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-sm text-blue-100 flex-wrap">
                  <span>🎯 リード {stats.leads}社</span>
                  <span className="opacity-50">|</span>
                  <span>💡 見込み {stats.prospect}社</span>
                  <span className="opacity-50">|</span>
                  <span>🏆 既存 {stats.existing}社</span>
                  {selectedRep !== '全体' && <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs">{selectedRep}</span>}
                </div>
              </div>
              {/* サブ数値：取引社数 */}
              <div className="flex gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="text-xs text-blue-200 mb-1">取引社数</div>
                  <div className="text-2xl font-bold">{stats.periodCompanies.toLocaleString()}</div>
                  <div className="text-xs text-blue-300">社</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon="🎯" label="リード数" value={stats.leads} color="yellow"
              sub={`全体の${stats.total > 0 ? Math.round(stats.leads/stats.total*100) : 0}%`}
              onClick={onNavigateToList ? () => onNavigateToList({ status: 'リード', rep: selectedRep === '全体' ? '' : selectedRep }) : undefined} />
            <KpiCard icon="💡" label="見込み数" value={stats.prospect} color="purple"
              sub={`全体の${stats.total > 0 ? Math.round(stats.prospect/stats.total*100) : 0}%`}
              onClick={onNavigateToList ? () => onNavigateToList({ status: '見込み', rep: selectedRep === '全体' ? '' : selectedRep }) : undefined} />
            <KpiCard icon="🏆" label="既存顧客数" value={stats.existing} color="green"
              sub={`全体の${stats.total > 0 ? Math.round(stats.existing/stats.total*100) : 0}%`}
              onClick={onNavigateToList ? () => onNavigateToList({ status: '成約', rep: selectedRep === '全体' ? '' : selectedRep }) : undefined} />
            <KpiCard icon="💰" label="期間売上" value={`${stats.totalDeal.toLocaleString()}万円`} color="blue"
              sub={periodLabel} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon="📋" label={`活動件数`} sub={periodLabel} value={periodStats.totalAct} color="blue" />
            <KpiCard icon="📅" label="今週アクション" value={stats.weekActions} color="purple" />
            <KpiCard icon="⚠️" label="期限切れ" value={stats.overdue} color="red" alert />
            <KpiCard icon="📊" label="1社平均活動"
              value={stats.total > 0 ? (fc.reduce((s,c) => s+(c.history?.length||0),0)/stats.total).toFixed(1) : '0'}
              color="blue" />
          </div>


          {/* ABCD */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">ABCDヨミ集計</h2>
              {forecastData.reduce((s,f) => s+f.amount, 0) > 0 && (
                <span className="text-sm text-gray-500">合計 <span className="font-semibold text-gray-800">{forecastData.reduce((s,f)=>s+f.amount,0).toLocaleString()}万円</span></span>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {forecastData.map(f => (
                <div key={f.key} className="rounded-xl p-4 border-2" style={{ borderColor:f.color+'40', backgroundColor:f.color+'10' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-sm" style={{ backgroundColor:f.color }}>{f.key}</span>
                    <span className="text-xs text-gray-600">{f.label}</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{f.count}<span className="text-sm font-normal text-gray-500 ml-1">社</span></div>
                  {f.amount > 0 && <div className="text-xs text-gray-500 mt-1">{f.amount.toLocaleString()}万円</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== PIPELINE ===== */}
      {activeView === 'pipeline' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">ステータスパイプライン</h2>
            <div className="space-y-3">
              {pipelineData.map(p => {
                const maxCount = Math.max(...pipelineData.map(d => d.count), 1)
                return (
                  <div key={p.status} className="flex items-center gap-4">
                    <div className="w-16 flex-shrink-0"><StatusBadge status={p.status} /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-800">{p.count}社</span>
                        {p.amount > 0 && <span className="text-xs text-gray-500">{p.amount.toLocaleString()}万円</span>}
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-4">
                        <div className="h-4 rounded-full flex items-center justify-end pr-2"
                          style={{ width:`${(p.count/maxCount)*100}%`, backgroundColor:p.color }}>
                          {p.count > 0 && <span className="text-white text-xs font-medium">{p.count}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">ヨミ別 件数</h2>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={forecastData} margin={{ top:5, right:10, left:-10, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="key" tick={{ fontSize:12 }} />
                  <YAxis tick={{ fontSize:11 }} />
                  <Tooltip formatter={(v) => [`${v}社`, '件数']} />
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {forecastData.map(f => <Cell key={f.key} fill={f.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">ヨミ別 売上金額（万円）</h2>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={forecastData} margin={{ top:5, right:10, left:-10, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="key" tick={{ fontSize:12 }} />
                  <YAxis tick={{ fontSize:11 }} />
                  <Tooltip formatter={(v) => [`${v.toLocaleString()}万円`, '金額']} />
                  <Bar dataKey="amount" radius={[4,4,0,0]}>
                    {forecastData.map(f => <Cell key={f.key} fill={f.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {selectedRep === '全体' && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                担当別 売上金額（万円）
                <span className="text-xs text-gray-400 font-normal ml-2">{periodLabel}</span>
              </h2>
              <ResponsiveContainer width="100%" height={Math.max(180, repData.length * 36)}>
                <BarChart data={repData} layout="vertical" margin={{ top:5, right:60, left:55, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize:11 }} />
                  <YAxis type="category" dataKey="rep" tick={{ fontSize:11 }} width={55} />
                  <Tooltip formatter={(v) => [`${v.toLocaleString()}万円`, '売上金額']} />
                  <Bar dataKey="deal" radius={[0,4,4,0]} label={{ position:'right', fontSize:10, formatter:(v)=>v>0?`${v.toLocaleString()}万`:'' }}>
                    {repData.map((_,i) => <Cell key={i} fill={REP_COLORS[i%REP_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {selectedRep === '全体' && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                担当別パフォーマンス
                <span className="text-xs text-gray-400 font-normal ml-2">活動件数は{periodLabel}</span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['担当者','顧客数','商談中','成約',`活動(${periodLabel})`, '期限切れ','売上(万円)'].map(h => (
                        <th key={h} className="text-left py-2 px-2 text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {repData.map((r, i) => (
                      <tr key={r.rep} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedRep(r.rep)}>
                        <td className="py-2.5 px-2 font-medium text-gray-800">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor:REP_COLORS[i%REP_COLORS.length] }} />
                            {r.rep}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-gray-600">{r.customers}</td>
                        <td className="py-2.5 px-2 text-blue-600 font-medium">{r.active}</td>
                        <td className="py-2.5 px-2 text-green-600 font-medium">{r.won}</td>
                        <td className="py-2.5 px-2 text-gray-700 font-semibold">{r.periodActivities}</td>
                        <td className="py-2.5 px-2">
                          {r.overdue > 0
                            ? <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">{r.overdue}件</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 px-2 font-medium text-gray-800">{r.deal > 0 ? r.deal.toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== ACTIVITY ===== */}
      {activeView === 'activity' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              活動件数トレンド
              <span className="text-xs text-gray-400 font-normal ml-2">（{periodLabel}）</span>
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={activityTrend} margin={{ top:5, right:20, left:-10, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize:11 }} />
                <YAxis tick={{ fontSize:11 }} />
                <Tooltip formatter={(v) => [`${v}件`, '活動件数']} />
                <Bar dataKey="count" radius={[4,4,0,0]} fill={selectedRepColor} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">接触方法 内訳 <span className="text-xs text-gray-400 font-normal">（{periodLabel}）</span></h2>
              {methodData.length > 0 ? (
                <div className="space-y-2.5">
                  {methodData.map((m, i) => {
                    const total = methodData.reduce((s,d) => s+d.value, 0)
                    return (
                      <div key={m.name} className="flex items-center gap-3">
                        <span className="text-lg flex-shrink-0">{CONTACT_METHOD_ICONS[m.name]||'📝'}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-700 font-medium">{m.name}</span>
                            <span className="text-gray-500">{m.value}件 ({Math.round(m.value/total*100)}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full" style={{ width:`${(m.value/total)*100}%`, backgroundColor:REP_COLORS[i%REP_COLORS.length] }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : <div className="h-32 flex items-center justify-center text-gray-400 text-sm">期間内の活動なし</div>}
            </div>

            {selectedRep === '全体' ? (
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">担当別 活動件数 <span className="text-xs text-gray-400 font-normal">（{periodLabel}）</span></h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={repData} layout="vertical" margin={{ top:5, right:30, left:55, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize:11 }} />
                    <YAxis type="category" dataKey="rep" tick={{ fontSize:11 }} width={50} />
                    <Tooltip formatter={(v) => [`${v}件`, '活動件数']} />
                    <Bar dataKey="periodActivities" radius={[0,4,4,0]}>
                      {repData.map((_,i) => <Cell key={i} fill={REP_COLORS[i%REP_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">応募/採用満足度 <span className="text-xs text-gray-400 font-normal">（{periodLabel}）</span></h2>
                {satisfactionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={satisfactionData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {satisfactionData.map(e => <Cell key={e.name} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v,n) => [`${v}件`, n]} />
                      <Legend formatter={v => <span className="text-xs">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-40 flex items-center justify-center text-gray-400 text-sm">期間内の記録なし</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== ALERT ===== */}
      {activeView === 'alert' && (
        <div className="space-y-5">

          {/* HP更新アラート */}
          {hpMonitor && (() => {
            const changedCustomers = hpMonitor.getChangedCustomers(fc)
            const isCheckingAny = Object.keys(hpMonitor.checking).length > 0
            const urlTargets = fc.filter(c => c.website || c.recruitUrl)
            return (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold text-gray-900">🔔 HP更新アラート</h2>
                    {changedCustomers.length > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
                        {changedCustomers.reduce((n,c) => n + c.hpChanges.length, 0)}件更新
                      </span>
                    )}
                    <span className="text-xs text-gray-400">監視対象: {urlTargets.length}社</span>
                  </div>
                  <button
                    onClick={() => hpMonitor.checkAll(fc, true)}
                    disabled={isCheckingAny || urlTargets.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {isCheckingAny ? (
                      <><span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />チェック中...</>
                    ) : '🔍 全件チェック'}
                  </button>
                </div>

                {urlTargets.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <div className="text-2xl mb-2">🌐</div>
                    <div className="text-sm">顧客に「会社HP」または「採用HP」のURLを登録してください</div>
                  </div>
                ) : changedCustomers.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <div className="text-2xl mb-2">✅</div>
                    <div className="text-sm">更新検知なし</div>
                    <div className="text-xs mt-1">「全件チェック」で最新の状態を確認できます</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {changedCustomers.map(c => (
                      <div key={c.id} className="border border-orange-200 bg-orange-50 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <button onClick={() => onSelectCustomer(c.id)}
                              className="text-sm font-semibold text-gray-900 hover:text-blue-700 text-left">
                              {c.companyName}
                            </button>
                            <div className="text-xs text-gray-500 mt-0.5">担当: {c.assignedTo || '未割当'}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {c.hpChanges.map(ch => (
                                <div key={ch.type} className="flex items-center gap-2 bg-white border border-orange-300 rounded-lg px-2 py-1">
                                  <span className="text-xs font-medium text-orange-700">📄 {ch.label}が更新されました</span>
                                  <span className="text-xs text-gray-400">{new Date(ch.changedAt).toLocaleDateString('ja-JP')}</span>
                                  {ch.url && (
                                    <a href={ch.url} target="_blank" rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline">確認 →</a>
                                  )}
                                  <button onClick={() => hpMonitor.dismissChange(c.id, ch.type)}
                                    className="text-xs text-gray-400 hover:text-gray-600 ml-1">✕</button>
                                </div>
                              ))}
                            </div>
                          </div>
                          <button onClick={() => hpMonitor.dismissAll(c.id)}
                            className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">全て既読</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Per-customer check status */}
                {urlTargets.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">▸ 個別チェック状況</summary>
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                      {urlTargets.map(c => {
                        const snap = hpMonitor.getSnapshot(c.id)
                        const wsKey = `${c.id}_website`
                        const rKey = `${c.id}_recruit`
                        return (
                          <div key={c.id} className="flex items-center gap-2 text-xs text-gray-500 p-1.5 hover:bg-gray-50 rounded-lg">
                            <span className="flex-1 font-medium truncate">{c.companyName}</span>
                            {c.website && (
                              <div className="flex items-center gap-1">
                                <span>🌐</span>
                                {hpMonitor.checking[wsKey] ? (
                                  <span className="text-blue-500 animate-pulse">確認中…</span>
                                ) : snap.websiteCheckedAt ? (
                                  <span className={snap.websiteChanged ? 'text-orange-600 font-semibold' : 'text-green-600'}>
                                    {snap.websiteChanged ? '更新あり' : '変化なし'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">未確認</span>
                                )}
                                <button onClick={() => hpMonitor.checkUrl(c.id, 'website', c.website)}
                                  disabled={!!hpMonitor.checking[wsKey]}
                                  className="text-blue-500 hover:text-blue-700 disabled:opacity-40 text-xs">🔄</button>
                              </div>
                            )}
                            {c.recruitUrl && (
                              <div className="flex items-center gap-1">
                                <span>📋</span>
                                {hpMonitor.checking[rKey] ? (
                                  <span className="text-blue-500 animate-pulse">確認中…</span>
                                ) : snap.recruitCheckedAt ? (
                                  <span className={snap.recruitChanged ? 'text-orange-600 font-semibold' : 'text-green-600'}>
                                    {snap.recruitChanged ? '更新あり' : '変化なし'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">未確認</span>
                                )}
                                <button onClick={() => hpMonitor.checkUrl(c.id, 'recruit', c.recruitUrl)}
                                  disabled={!!hpMonitor.checking[rKey]}
                                  className="text-blue-500 hover:text-blue-700 disabled:opacity-40 text-xs">🔄</button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </details>
                )}
              </div>
            )
          })()}

          {/* 最終掲載日アラート */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <h2 className="text-sm font-semibold text-gray-900">📅 最終掲載日アラート</h2>
              <div className="flex gap-1 flex-wrap">
                {POSTING_ALERT_THRESHOLDS.map(({ months, label }) => {
                  const count = postingAlertData.filter(c => c.diffMonths >= months).length
                  const active = postingAlertFilter === months
                  return (
                    <button key={months} onClick={() => setPostingAlertFilter(months)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        active
                          ? months >= 3 ? 'bg-red-500 text-white border-red-500'
                            : months >= 2 ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-yellow-500 text-white border-yellow-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}>
                      {label}以上
                      {count > 0 && (
                        <span className={`ml-1 ${active ? 'text-white' : months >= 3 ? 'text-red-500' : months >= 2 ? 'text-orange-500' : 'text-yellow-600'} font-bold`}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {(() => {
              const filtered = postingAlertData.filter(c => c.diffMonths >= postingAlertFilter)
              if (filtered.length === 0) {
                return (
                  <div className="flex flex-col items-center py-8 text-gray-400">
                    <span className="text-3xl mb-2">✅</span>
                    <span className="text-sm">
                      {postingAlertFilter}ヶ月以上経過した掲載なし
                    </span>
                    {postingAlertData.length === 0 && (
                      <span className="text-xs mt-1">※顧客に「最終掲載日」を設定してください</span>
                    )}
                  </div>
                )
              }
              return (
                <div className="space-y-2">
                  {filtered.map(c => {
                    const months = Math.floor(c.diffMonths)
                    const urgency = months >= 6 ? 'red' : months >= 3 ? 'orange' : months >= 2 ? 'yellow' : 'gray'
                    const urgencyClass = {
                      red: 'border-red-200 hover:bg-red-50',
                      orange: 'border-orange-200 hover:bg-orange-50',
                      yellow: 'border-yellow-200 hover:bg-yellow-50',
                      gray: 'border-gray-200 hover:bg-gray-50',
                    }[urgency]
                    const badgeClass = {
                      red: 'bg-red-100 text-red-700',
                      orange: 'bg-orange-100 text-orange-700',
                      yellow: 'bg-yellow-100 text-yellow-700',
                      gray: 'bg-gray-100 text-gray-600',
                    }[urgency]
                    return (
                      <button key={c.id} onClick={() => onSelectCustomer(c.id)}
                        className={`w-full text-left flex items-center gap-4 p-3 rounded-lg border transition-colors ${urgencyClass}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-800">{c.companyName}</span>
                            <StatusBadge status={c.status} />
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            担当: {c.assignedTo || '未割当'}
                            {c.forecast && <span className="ml-2">ヨミ: {c.forecast}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-gray-400">{formatDate(c.lastPostingDate)}</div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badgeClass}`}>
                            {months}ヶ月経過
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-red-700 mb-3">
              ⚠️ 対応もれ
              <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{overdueList.length}件</span>
            </h2>
            {overdueList.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-gray-400">
                <span className="text-3xl mb-2">✅</span><span className="text-sm">対応もれはありません</span>
              </div>
            ) : (
              <div className="space-y-2">
                {overdueList.map(c => {
                  const days = Math.abs(getDaysUntil(c.nextAction.date))
                  return (
                    <button key={c.id} onClick={() => onSelectCustomer(c.id)}
                      className="w-full text-left flex items-center gap-4 p-3 rounded-lg hover:bg-red-50 border border-red-100 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">{c.companyName}</span>
                          <StatusBadge status={c.status} />
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {Array.isArray(c.nextAction.type)?c.nextAction.type.join('・'):c.nextAction.type} · {c.assignedTo||'未割当'}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-gray-500">{formatDate(c.nextAction.date)}</div>
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">{days}日超過</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                今後30日のアクション
                <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{upcomingActions.length}件</span>
              </h2>
              <button onClick={() => onNavigate('actions')} className="text-xs text-blue-600 hover:text-blue-800 font-medium">アクション管理 →</button>
            </div>
            {upcomingActions.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-gray-400">
                <span className="text-3xl mb-2">📅</span><span className="text-sm">予定はありません</span>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingActions.map(c => {
                  const days = getDaysUntil(c.nextAction.date)
                  return (
                    <button key={c.id} onClick={() => onSelectCustomer(c.id)}
                      className="w-full text-left flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">{c.companyName}</span>
                          <StatusBadge status={c.status} />
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {Array.isArray(c.nextAction.type)?c.nextAction.type.join('・'):c.nextAction.type} · {c.assignedTo||'未割当'}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-gray-600">{formatDate(c.nextAction.date)}</div>
                        {days === 0 && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">今日</span>}
                        {days === 1 && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">明日</span>}
                        {days > 1 && days <= 7 && <span className="text-xs bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded-full">今週</span>}
                        {days > 7 && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{days}日後</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'ai' && (
        <AIAnalysis
          customers={fc}
          selectedRep={selectedRep}
          periodMode={periodMode}
          fromStr={fromStr}
          toStr={toStr}
        />
      )}
    </div>
  )
}
