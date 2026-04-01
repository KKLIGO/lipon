import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import StatusBadge from './StatusBadge'
import { ASSIGNED_TO_OPTIONS, INDUSTRY_OPTIONS } from '../data/sampleData'

const PERIOD_OPTIONS = [
  { key: '', label: '全期間' },
  { key: '週間', label: '週間' },
  { key: '今月', label: '今月' },
  { key: '先月', label: '先月' },
  { key: 'Q', label: 'Q（四半期）' },
  { key: '年度', label: '年度' },
  { key: '月指定', label: '月指定' },
  { key: '自由', label: '自由設定' },
]

function getPeriodRange(period, customMonth, customFrom, customTo, qtr, qtrYear, fyYear) {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const y = now.getFullYear(), m = now.getMonth()
  if (period === '週間') {
    const from = new Date(now); from.setDate(from.getDate() - 7)
    return { from: from.toISOString().split('T')[0], to: todayStr }
  }
  if (period === '今月') {
    return { from: `${y}-${String(m+1).padStart(2,'0')}-01`, to: todayStr }
  }
  if (period === '先月') {
    const lm = m === 0 ? 11 : m - 1
    const ly = m === 0 ? y - 1 : y
    const lastDay = new Date(ly, lm + 1, 0).getDate()
    return {
      from: `${ly}-${String(lm+1).padStart(2,'0')}-01`,
      to: `${ly}-${String(lm+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    }
  }
  if (period === 'Q') {
    const q = qtr || Math.ceil((m + 1) / 3)
    const qy = qtrYear || y
    const qStartMonth = (q - 1) * 3
    const qEndMonth = q * 3
    const qStart = new Date(qy, qStartMonth, 1)
    const lastDay = new Date(qy, qEndMonth, 0).getDate()
    const qEndStr = `${qy}-${String(qEndMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    return { from: qStart.toISOString().split('T')[0], to: qEndStr < todayStr ? qEndStr : todayStr }
  }
  if (period === '年度') {
    const fy = fyYear || y
    return { from: `${fy}-01-01`, to: `${fy}-12-31` < todayStr ? `${fy}-12-31` : todayStr }
  }
  if (period === '月指定' && customMonth) {
    const [cy, cm] = customMonth.split('-').map(Number)
    const lastDay = new Date(cy, cm, 0).getDate()
    return { from: `${customMonth}-01`, to: `${customMonth}-${String(lastDay).padStart(2,'0')}` }
  }
  if (period === '自由' && customFrom) {
    return { from: customFrom, to: customTo || todayStr }
  }
  return null
}

// 前月・前Q比グロースフラグ計算
// yomi=スナップ予測, deal=実売上
// ratio = deal / yomi
//   >= 1.3 → growth（伸び大）
//   <= 0.7 かつ yomi>=30万 → decline（減少大）
function getGrowthFlag(c, yomiMap) {
  const yomi = yomiMap?.[c.id]
  const deal = Number(c.dealAmount) || 0
  if (yomi == null || yomi === 0) return null
  const ratio = deal / yomi
  if (ratio >= 1.3) return 'growth'
  if (ratio <= 0.7 && yomi >= 30) return 'decline'
  return null
}

const GROWTH_FLAGS = [
  { key: '', label: 'すべて' },
  { key: 'growth', label: '📈 伸び大', color: 'emerald' },
  { key: 'decline', label: '📉 減少大', color: 'red' },
]

const STATUSES = ['すべて', '商談中', '提案済', '成約', '失注', 'リード']
const PAGE_SIZE_OPTIONS = [25, 50, 100]
const FORECAST_COLORS = { A: 'bg-green-100 text-green-700', B: 'bg-blue-100 text-blue-700', C: 'bg-yellow-100 text-yellow-700', D: 'bg-gray-100 text-gray-500' }

function calcSalesSummary(customers) {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() // 0-indexed

  // Calendar year: January start
  const fyStartStr = `${y}-01-01`

  // Quarter start: 1Q=1-3月, 2Q=4-6月, 3Q=7-9月, 4Q=10-12月
  const currentQ = Math.ceil((m + 1) / 3)
  const qStartMonth = (currentQ - 1) * 3  // 0-indexed
  const qStart = new Date(y, qStartMonth, 1)
  const qStartStr = qStart.toISOString().split('T')[0]

  // This month
  const thisMonthStr = `${y}-${String(m + 1).padStart(2, '0')}`

  // Last month
  const lm = m === 0 ? 11 : m - 1
  const ly = m === 0 ? y - 1 : y
  const lastMonthStr = `${ly}-${String(lm + 1).padStart(2, '0')}`

  let thisMonthYomi = 0, thisMonthActual = 0, lastMonthActual = 0, quarterActual = 0, fyActual = 0

  customers.forEach(c => {
    const amt = Number(c.dealAmount) || 0
    if (!amt) return
    const updDate = c.updatedAt ? c.updatedAt.slice(0, 10) : ''
    const updMonth = updDate.slice(0, 7) // YYYY-MM
    const isWon = c.status === '成約'

    // ヨミ: active pipeline with forecast A or B
    if ((c.status === '商談中' || c.status === '提案済') && (c.forecast === 'A' || c.forecast === 'B')) {
      thisMonthYomi += amt
    }
    // 今月実績: won this month
    if (isWon && updMonth === thisMonthStr) thisMonthActual += amt
    // 先月実績: won last month
    if (isWon && updMonth === lastMonthStr) lastMonthActual += amt
    // 今Q: won since quarter start
    if (isWon && updDate >= qStartStr) quarterActual += amt
    // 今年度: won since fiscal year start
    if (isWon && updDate >= fyStartStr) fyActual += amt
  })

  return { thisMonthYomi, thisMonthActual, lastMonthActual, quarterActual, fyActual, thisMonthStr, lastMonthStr }
}

function SalesSummaryBar({ customers }) {
  const s = useMemo(() => calcSalesSummary(customers), [customers])
  const now = new Date()
  const qLabel = `Q${Math.ceil((now.getMonth() + 1) / 3)}`
  const fyLabel = `${now.getFullYear()}年`

  // メイン3項目（先月・Q・年度）を大きく、今月を小さく補足表示
  const main = [
    { label: '先月実績', sub: s.lastMonthStr.replace('-', '/'), value: s.lastMonthActual, color: 'slate', icon: '📅' },
    { label: `今${qLabel}`, sub: '四半期累計', value: s.quarterActual, color: 'purple', icon: '📈' },
    { label: fyLabel, sub: '年度累計', value: s.fyActual, color: 'orange', icon: '🏆' },
  ]
  const sub = [
    { label: '今月ヨミ', sub: 'A+Bヨミ', value: s.thisMonthYomi, color: 'blue', icon: '📊' },
    { label: '今月実績', sub: s.thisMonthStr.replace('-', '/'), value: s.thisMonthActual, color: 'green', icon: '✅' },
  ]
  const colorMap = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    purple: 'border-purple-200 bg-purple-50 text-purple-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
  }
  return (
    <div className="space-y-2">
      {/* メイン：先月・Q・年度 */}
      <div className="grid grid-cols-3 gap-2">
        {main.map(card => (
          <div key={card.label} className={`rounded-xl border-2 p-3 ${colorMap[card.color]}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">{card.icon}</span>
              <span className="text-xs font-bold">{card.label}</span>
            </div>
            <div className="text-2xl font-bold">
              {card.value > 0 ? card.value.toLocaleString() : '—'}
              {card.value > 0 && <span className="text-xs font-normal ml-1">万円</span>}
            </div>
            <div className="text-xs opacity-60 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>
      {/* サブ：今月ヨミ・今月実績 */}
      <div className="grid grid-cols-2 gap-2">
        {sub.map(card => (
          <div key={card.label} className={`rounded-lg border p-2.5 flex items-center gap-3 ${colorMap[card.color]}`}>
            <span className="text-lg">{card.icon}</span>
            <div>
              <div className="text-xs font-semibold">{card.label} <span className="opacity-60 font-normal">{card.sub}</span></div>
              <div className="text-lg font-bold leading-tight">
                {card.value > 0 ? card.value.toLocaleString() : '—'}
                {card.value > 0 && <span className="text-xs font-normal ml-1">万円</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

function exportCSV(rows) {
  const headers = ['会社名', '業種', '担当者', '役職', 'メール', '電話', 'ステータス', '担当営業', '次回アクション種別', '次回アクション日', 'メモ']
  const lines = [headers.join(','), ...rows.map(c => [
    `"${c.companyName}"`, `"${c.industry || ''}"`, `"${c.contactName}"`, `"${c.contactTitle || ''}"`,
    `"${c.email || ''}"`, `"${c.phone || ''}"`, `"${c.status}"`, `"${c.assignedTo || ''}"`,
    `"${c.nextAction?.type || ''}"`, `"${c.nextAction?.date || ''}"`, `"${(c.memo || '').replace(/"/g, '""')}"`
  ].join(','))]
  const bom = '\uFEFF'
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `顧客一覧_${new Date().toISOString().slice(0,10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

const REP_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1']

export default function CustomerList({ customers, onSelectCustomer, onAddCustomer, onDeleteCustomer, onBulkDelete, onBulkUpdateStatus, onBulkUpdateAssignedTo, initialFilter, currentUser }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(initialFilter?.status || 'すべて')
  const [industryFilter, setIndustryFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState(initialFilter?.rep || '')
  const [selectedRep, setSelectedRep] = useState(initialFilter?.rep || '全体')
  const [period, setPeriod] = useState(initialFilter?.period || '')
  const [customMonth, setCustomMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}` })
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [actionDateFrom, setActionDateFrom] = useState('')
  const [actionDateTo, setActionDateTo] = useState('')
  const [sortKey, setSortKey] = useState(initialFilter?.sort || 'yomiGap')
  const [sortDir, setSortDir] = useState('desc')
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [selected, setSelected] = useState(new Set())
  const [bulkAction, setBulkAction] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [growthFilter, setGrowthFilter] = useState('')
  const [repSearch, setRepSearch] = useState('')
  const [clQtr, setClQtr] = useState(() => Math.ceil((new Date().getMonth() + 1) / 3))
  const [clQtrYear, setClQtrYear] = useState(() => new Date().getFullYear())
  const [clYear, setClYear] = useState(() => new Date().getFullYear())
  const prevFilterRef = useRef(initialFilter)

  // initialFilterが変わったとき（ダッシュボードから遷移）に反映
  useEffect(() => {
    if (!initialFilter) return
    if (JSON.stringify(initialFilter) === JSON.stringify(prevFilterRef.current)) return
    prevFilterRef.current = initialFilter
    setStatusFilter(initialFilter.status || 'すべて')
    setSelectedRep(initialFilter.rep || '全体')
    setAssignedFilter(initialFilter.rep || '')
    setPeriod(initialFilter.period || '')
    if (initialFilter.sort) { setSortKey(initialFilter.sort); setSortDir('desc') }
    setCurrentPage(1)
  }, [initialFilter])

  // 動的担当者リスト
  const allReps = useMemo(() => {
    const reps = new Set()
    customers.forEach(c => { if (c.assignedTo) reps.add(c.assignedTo) })
    return ['全体', ...Array.from(reps).sort()]
  }, [customers])

  // ヨミスナップショットから customerId→yomi金額マップを作成
  const yomiMap = useMemo(() => {
    try {
      const snap = JSON.parse(localStorage.getItem('crm_yomi_snapshots_v1') || '{}')
      const map = {}
      Object.values(snap).forEach(monthData => {
        Object.values(monthData).forEach(snapshot => {
          ;(snapshot.entries || []).forEach(entry => {
            if (entry.customerId && entry.yomi != null) {
              // 同一顧客が複数スナップにある場合は最新を使う
              map[entry.customerId] = entry.yomi
            }
          })
        })
      })
      return map
    } catch { return {} }
  }, [])

  // 年間売上TOP10のIDセット（dealAmount上位10社）
  const top10Set = useMemo(() => {
    const sorted = [...customers]
      .filter(c => Number(c.dealAmount) > 0)
      .sort((a, b) => Number(b.dealAmount) - Number(a.dealAmount))
    return new Set(sorted.slice(0, 10).map(c => c.id))
  }, [customers])

  // 期間レンジ
  const periodRange = useMemo(() => getPeriodRange(period, customMonth, customFrom, customTo, clQtr, clQtrYear, clYear), [period, customMonth, customFrom, customTo, clQtr, clQtrYear, clYear])

  const filtered = useMemo(() => {
    let list = customers
    // 担当者タブ
    if (selectedRep !== '全体') list = list.filter(c => c.assignedTo === selectedRep)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c =>
        c.companyName.toLowerCase().includes(q) ||
        (c.contactName||'').toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.assignedTo && c.assignedTo.includes(q))
      )
    }
    if (statusFilter !== 'すべて') list = list.filter(c => c.status === statusFilter)
    if (industryFilter) list = list.filter(c => c.industry === industryFilter)
    if (assignedFilter && selectedRep === '全体') list = list.filter(c => c.assignedTo === assignedFilter)
    // 期間フィルター（updatedAt）
    if (periodRange) {
      list = list.filter(c => {
        const d = c.updatedAt ? c.updatedAt.slice(0,10) : ''
        return d >= periodRange.from && d <= periodRange.to
      })
    }
    if (actionDateFrom) list = list.filter(c => c.nextAction?.date && c.nextAction.date >= actionDateFrom)
    if (actionDateTo) list = list.filter(c => c.nextAction?.date && c.nextAction.date <= actionDateTo)
    // グロースフラグフィルター
    if (growthFilter) list = list.filter(c => getGrowthFlag(c, yomiMap) === growthFilter)

    list = [...list].sort((a, b) => {
      let aVal = a[sortKey] ?? ''
      let bVal = b[sortKey] ?? ''
      if (sortKey === 'nextActionDate') { aVal = a.nextAction?.date || ''; bVal = b.nextAction?.date || '' }
      if (sortKey === 'dealAmount') { aVal = Number(aVal)||0; bVal = Number(bVal)||0 }
      if (sortKey === 'yomiGap') {
        aVal = Math.abs((yomiMap[a.id] ?? 0) - (Number(a.dealAmount) || 0))
        bVal = Math.abs((yomiMap[b.id] ?? 0) - (Number(b.dealAmount) || 0))
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [customers, search, statusFilter, industryFilter, assignedFilter, selectedRep, periodRange, actionDateFrom, actionDateTo, sortKey, sortDir, yomiMap, growthFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleSort = useCallback((key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setCurrentPage(1)
  }, [sortKey])

  const handleFilterChange = useCallback((setter) => (e) => {
    setter(e.target.value); setCurrentPage(1); setSelected(new Set())
  }, [])

  // Selection
  const allPageIds = paged.map(c => c.id)
  const allPageSelected = allPageIds.length > 0 && allPageIds.every(id => selected.has(id))
  const somePageSelected = allPageIds.some(id => selected.has(id))

  function toggleSelectAll() {
    if (allPageSelected) {
      setSelected(s => { const n = new Set(s); allPageIds.forEach(id => n.delete(id)); return n })
    } else {
      setSelected(s => { const n = new Set(s); allPageIds.forEach(id => n.add(id)); return n })
    }
  }

  function toggleSelect(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function handleBulkExecute() {
    const ids = [...selected]
    if (ids.length === 0) return
    if (bulkAction === 'delete') {
      if (window.confirm(`選択した${ids.length}件を削除しますか？`)) {
        onBulkDelete(ids)
        setSelected(new Set())
      }
    } else if (bulkAction.startsWith('status:')) {
      const status = bulkAction.replace('status:', '')
      onBulkUpdateStatus(ids, status)
      setSelected(new Set())
    } else if (bulkAction.startsWith('assign:')) {
      const person = bulkAction.replace('assign:', '')
      onBulkUpdateAssignedTo(ids, person)
      setSelected(new Set())
    }
    setBulkAction('')
  }

  function clearFilters() {
    setSearch(''); setStatusFilter('すべて'); setIndustryFilter('')
    setAssignedFilter(''); setActionDateFrom(''); setActionDateTo('')
    setGrowthFilter(''); setCurrentPage(1); setSelected(new Set())
  }

  const hasActiveFilters = statusFilter !== 'すべて' || industryFilter || assignedFilter || actionDateFrom || actionDateTo || growthFilter

  function SortIcon({ col }) {
    if (sortKey !== col) return <span className="ml-1 text-gray-300">↕</span>
    return <span className="ml-1 text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const pageNumbers = useMemo(() => {
    const pages = []
    const delta = 2
    for (let i = Math.max(1, safePage - delta); i <= Math.min(totalPages, safePage + delta); i++) pages.push(i)
    return pages
  }, [safePage, totalPages])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">顧客一覧</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length}件表示 / 全{customers.length}件
            {selectedRep !== '全体' && <span className="ml-2 text-blue-600">・{selectedRep}</span>}
            {statusFilter !== 'すべて' && <span className="ml-1 text-purple-600">・{statusFilter}</span>}
            {period && <span className="ml-1 text-orange-600">・{PERIOD_OPTIONS.find(p=>p.key===period)?.label}</span>}
            {growthFilter === 'growth' && <span className="ml-1 text-emerald-600 font-medium">・📈 伸び大</span>}
            {growthFilter === 'decline' && <span className="ml-1 text-red-500 font-medium">・📉 減少大</span>}
            {selected.size > 0 && <span className="ml-2 text-blue-600 font-medium">{selected.size}件選択中</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportCSV(filtered)} className="btn-secondary flex items-center gap-1.5 text-sm">
            ⬇ CSV出力
          </button>
          <button onClick={onAddCustomer} className="btn-primary flex items-center gap-2">
            ＋ 顧客追加
          </button>
        </div>
      </div>

      {/* 担当者フィルター */}
      <div className="card p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 flex-shrink-0">担当者</span>
          {allReps.length > 8 && (
            <input
              type="text"
              value={repSearch}
              onChange={e => setRepSearch(e.target.value)}
              placeholder="名前で絞り込み..."
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-36 focus:outline-none focus:border-blue-400"
            />
          )}
          {selectedRep !== '全体' && (
            <button onClick={() => { setSelectedRep('全体'); setCurrentPage(1); setSelected(new Set()) }}
              className="text-xs text-gray-400 hover:text-gray-600 ml-auto flex-shrink-0">
              ✕ 絞込解除
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {allReps.filter(r => r === '全体' || !repSearch || r.includes(repSearch)).map((rep) => {
            const color = rep === '全体' ? '#6b7280' : REP_COLORS[(allReps.indexOf(rep) - 1) % REP_COLORS.length]
            const isSelected = selectedRep === rep
            return (
              <button key={rep}
                onClick={() => { setSelectedRep(rep); setCurrentPage(1); setSelected(new Set()) }}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  isSelected ? 'text-white border-transparent shadow-sm' : 'text-gray-600 bg-white border-gray-200 hover:border-gray-300'
                }`}
                style={isSelected ? { backgroundColor: color } : {}}>
                {rep !== '全体' && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.6)' : color }} />
                )}
                {rep === '全体' ? '🌐 全体' : rep}
              </button>
            )
          })}
        </div>
      </div>

      {/* 期間フィルター */}
      <div className="card p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-500 flex-shrink-0">期間</span>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => {
                  setPeriod(opt.key)
                  setCurrentPage(1)
                  const t = new Date()
                  if (opt.key === 'Q') { setClQtr(Math.ceil((t.getMonth() + 1) / 3)); setClQtrYear(t.getFullYear()) }
                  else if (opt.key === '年度') setClYear(t.getFullYear())
                }}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  period === opt.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
          {period === '年度' && (
            <div className="flex items-center gap-2">
              <button onClick={() => { setClYear(y => y - 1); setCurrentPage(1) }}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">◀</button>
              <span className="text-xs font-medium text-gray-700 min-w-[60px] text-center">{clYear}年</span>
              <button onClick={() => { setClYear(y => y + 1); setCurrentPage(1) }}
                disabled={clYear >= new Date().getFullYear()}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">▶</button>
            </div>
          )}
          {period === 'Q' && (
            <div className="flex items-center gap-2">
              <button onClick={() => { setClQtr(q => { if (q <= 1) { setClQtrYear(y => y - 1); return 4 } return q - 1 }); setCurrentPage(1) }}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">◀</button>
              <span className="text-xs font-medium text-gray-700 min-w-[80px] text-center">{clQtrYear}年 {clQtr}Q</span>
              <button onClick={() => { setClQtr(q => { if (q >= 4) { setClQtrYear(y => y + 1); return 1 } return q + 1 }); setCurrentPage(1) }}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">▶</button>
            </div>
          )}
          {period === '月指定' && (
            <input type="month" value={customMonth} onChange={e => { setCustomMonth(e.target.value); setCurrentPage(1) }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400" />
          )}
          {period === '自由' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400" />
              <span className="text-xs text-gray-400">〜</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400" />
            </div>
          )}
          {periodRange && (
            <span className="text-xs text-gray-400 ml-auto">📅 {periodRange.from} 〜 {periodRange.to}</span>
          )}
        </div>
      </div>

      {/* Sales Summary */}
      <SalesSummaryBar customers={selectedRep === '全体' ? customers : customers.filter(c => c.assignedTo === selectedRep)} />

      {/* Search + Quick filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); setSelected(new Set()) }}
              placeholder="会社名・担当者・メール・電話・担当営業で検索..."
              className="form-input pl-9"
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border transition-colors ${
              hasActiveFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            ⚙ 絞り込み{hasActiveFilters && <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full ml-1">ON</span>}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-700 px-2">✕ リセット</button>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setCurrentPage(1); setSelected(new Set()) }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
              {s !== 'すべて' && (
                <span className="ml-1 opacity-70">({customers.filter(c => c.status === s).length})</span>
              )}
            </button>
          ))}
        </div>

        {/* グロースフラグ フィルター */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
          <span className="text-xs text-gray-400 font-medium">前月・前Q比</span>
          {GROWTH_FLAGS.map(f => {
            const count = f.key
              ? customers.filter(c => getGrowthFlag(c, yomiMap) === f.key).length
              : customers.length
            const isActive = growthFilter === f.key
            const colorCls = f.key === 'growth'
              ? isActive ? 'bg-emerald-600 text-white border-emerald-600' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
              : f.key === 'decline'
              ? isActive ? 'bg-red-500 text-white border-red-500' : 'border-red-300 text-red-600 hover:bg-red-50'
              : isActive ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            return (
              <button key={f.key}
                onClick={() => { setGrowthFilter(f.key); setCurrentPage(1); setSelected(new Set()) }}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${colorCls}`}
              >
                {f.label}
                {f.key && <span className="ml-1 opacity-80">({count})</span>}
              </button>
            )
          })}
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-xs text-gray-500 mb-1">業種</label>
              <select value={industryFilter} onChange={handleFilterChange(setIndustryFilter)} className="form-select text-sm">
                <option value="">すべての業種</option>
                {INDUSTRY_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">担当営業</label>
              <select value={assignedFilter} onChange={handleFilterChange(setAssignedFilter)} className="form-select text-sm">
                <option value="">全員</option>
                {ASSIGNED_TO_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">次回アクション（From）</label>
              <input type="date" value={actionDateFrom} onChange={handleFilterChange(setActionDateFrom)} className="form-input text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">次回アクション（To）</label>
              <input type="date" value={actionDateTo} onChange={handleFilterChange(setActionDateTo)} className="form-input text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-blue-800">{selected.size}件選択中</span>
          <select
            value={bulkAction}
            onChange={e => setBulkAction(e.target.value)}
            className="text-sm border border-blue-300 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="">一括操作を選択...</option>
            <optgroup label="ステータス変更">
              {['リード', '商談中', '提案済', '成約', '失注'].map(s => (
                <option key={s} value={`status:${s}`}>→ {s}に変更</option>
              ))}
            </optgroup>
            <optgroup label="担当者変更">
              {ASSIGNED_TO_OPTIONS.map(a => (
                <option key={a} value={`assign:${a}`}>{a}に割り当て</option>
              ))}
            </optgroup>
            <optgroup label="削除">
              <option value="delete">選択した顧客を削除</option>
            </optgroup>
          </select>
          <button
            onClick={handleBulkExecute}
            disabled={!bulkAction}
            className="btn-primary text-sm py-1.5 disabled:opacity-40"
          >
            実行
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-gray-500 hover:text-gray-700 ml-auto">
            選択解除
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <span className="text-4xl mb-3">👥</span>
            <p className="text-base font-medium">顧客が見つかりません</p>
            <p className="text-sm mt-1">検索条件を変更するか、新規顧客を追加してください。</p>
            <button onClick={onAddCustomer} className="btn-primary mt-4">＋ 顧客を追加</button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="table-header w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={el => el && (el.indeterminate = somePageSelected && !allPageSelected)}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600"
                      />
                    </th>
                    <th className="table-header text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('companyName')}>
                      会社名<SortIcon col="companyName" />
                    </th>
                    <th className="table-header text-left">担当者</th>
                    <th className="table-header text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('status')}>
                      ステータス<SortIcon col="status" />
                    </th>
                    <th className="table-header text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('assignedTo')}>
                      担当営業<SortIcon col="assignedTo" />
                    </th>
                    <th className="table-header text-right cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('dealAmount')}>
                      売上（万円）<SortIcon col="dealAmount" />
                    </th>
                    <th className="table-header text-right cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('yomiGap')}>
                      ヨミ / 乖離<SortIcon col="yomiGap" />
                    </th>
                    <th className="table-header text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('nextActionDate')}>
                      次回アクション<SortIcon col="nextActionDate" />
                    </th>
                    <th className="table-header text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('updatedAt')}>
                      最終更新<SortIcon col="updatedAt" />
                    </th>
                    <th className="table-header w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map(c => {
                    const days = c.nextAction?.date ? getDaysUntil(c.nextAction.date) : null
                    const isOverdue = days !== null && days < 0
                    const isToday = days === 0
                    const isSoon = days !== null && days > 0 && days <= 3
                    const isSelected = selected.has(c.id)

                    return (
                      <tr
                        key={c.id}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="table-cell text-center w-10" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(c.id)}
                            className="rounded border-gray-300 text-blue-600"
                          />
                        </td>
                        <td className="table-cell" onClick={() => onSelectCustomer(c.id)}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-gray-900">{c.companyName}</span>
                            {top10Set.has(c.id) && (
                              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap leading-tight">🏅 TOP10</span>
                            )}
                            {getGrowthFlag(c, yomiMap) === 'growth' && (
                              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-300 px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap leading-tight">📈 伸び大</span>
                            )}
                            {getGrowthFlag(c, yomiMap) === 'decline' && (
                              <span className="text-xs bg-red-50 text-red-600 border border-red-300 px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap leading-tight">📉 減少大</span>
                            )}
                          </div>
                          {c.industry && <div className="text-xs text-gray-400 mt-0.5">{c.industry}</div>}
                        </td>
                        <td className="table-cell" onClick={() => onSelectCustomer(c.id)}>
                          <div className="text-gray-700 text-sm">{c.contactName}</div>
                          {c.contactTitle && <div className="text-xs text-gray-400">{c.contactTitle}</div>}
                        </td>
                        <td className="table-cell" onClick={() => onSelectCustomer(c.id)}>
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="table-cell" onClick={() => onSelectCustomer(c.id)}>
                          {c.assignedTo ? (
                            <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{c.assignedTo}</span>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>
                        <td className="table-cell text-right" onClick={() => onSelectCustomer(c.id)}>
                          {c.dealAmount ? (
                            <span className="text-sm font-semibold text-gray-800">
                              {Number(c.dealAmount).toLocaleString()}
                              <span className="text-xs font-normal text-gray-400 ml-0.5">万</span>
                            </span>
                          ) : <span className="text-gray-300 text-sm">—</span>}
                        </td>
                        <td className="table-cell text-right" onClick={() => onSelectCustomer(c.id)}>
                          {(() => {
                            const yomi = yomiMap[c.id]
                            const deal = Number(c.dealAmount) || 0
                            const gap = yomi != null ? yomi - deal : null
                            return (
                              <div className="flex flex-col items-end gap-0.5">
                                <div className="flex items-center gap-1">
                                  {c.forecast && (
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${FORECAST_COLORS[c.forecast] || 'bg-gray-100 text-gray-500'}`}>
                                      {c.forecast}
                                    </span>
                                  )}
                                  {yomi != null && <span className="text-xs text-gray-500">{yomi}万</span>}
                                </div>
                                {gap != null && (
                                  <span className={`text-xs font-bold ${gap > 30 ? 'text-red-500' : gap < -30 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                    {gap > 0 ? '▲' : gap < 0 ? '▼' : ''}
                                    {Math.abs(gap) > 0 ? `${Math.abs(gap)}万` : '±0'}
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                        </td>
                        <td className="table-cell" onClick={() => onSelectCustomer(c.id)}>
                          {c.nextAction?.date ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-500">{c.nextAction.type}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                                  {formatDate(c.nextAction.date)}
                                </span>
                                {isOverdue && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">期限切れ</span>}
                                {isToday && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">今日</span>}
                                {isSoon && <span className="text-xs bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded-full">{days}日後</span>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>
                        <td className="table-cell text-gray-500 text-sm" onClick={() => onSelectCustomer(c.id)}>
                          {formatDate(c.updatedAt?.split('T')[0])}
                        </td>
                        <td className="table-cell w-10" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => { if (window.confirm(`「${c.companyName}」を削除しますか？`)) onDeleteCustomer(c.id) }}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                            title="削除"
                          >🗑️</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>表示件数：</span>
                {PAGE_SIZE_OPTIONS.map(n => (
                  <button key={n} onClick={() => { setPageSize(n); setCurrentPage(1) }}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${pageSize === n ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}
                  >{n}件</button>
                ))}
              </div>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-gray-500 mr-2">
                  {(safePage - 1) * pageSize + 1}〜{Math.min(safePage * pageSize, filtered.length)} / {filtered.length}件
                </span>
                <button onClick={() => setCurrentPage(1)} disabled={safePage === 1}
                  className="p-1.5 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100 text-xs">«</button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                  className="p-1.5 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100 text-xs">‹</button>
                {pageNumbers.map(n => (
                  <button key={n} onClick={() => setCurrentPage(n)}
                    className={`px-3 py-1.5 rounded border text-xs font-medium transition-colors ${safePage === n ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-100'}`}
                  >{n}</button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  className="p-1.5 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100 text-xs">›</button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages}
                  className="p-1.5 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100 text-xs">»</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
