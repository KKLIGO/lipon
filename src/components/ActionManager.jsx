import React, { useState, useMemo } from 'react'
import StatusBadge from './StatusBadge'
import ActionForm from './ActionForm'

const ACTION_ICONS = {
  '電話': '📞',
  'メール': '📧',
  '訪問': '🏢',
  'オンライン商談': '💻',
  '提案書送付': '📄',
  '見積送付': '💰',
  'その他': '📝',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

const FILTER_OPTIONS = [
  { id: 'upcoming', label: '予定あり' },
  { id: 'overdue', label: '期限切れ' },
  { id: 'all', label: 'すべて' },
  { id: 'none', label: '未設定' },
]

export default function ActionManager({ customers, onSetNextAction, onClearNextAction, onSelectCustomer }) {
  const [filter, setFilter] = useState('upcoming')
  const [typeFilter, setTypeFilter] = useState('すべて')
  const [editingCustomer, setEditingCustomer] = useState(null)

  const actionTypes = ['すべて', ...Object.keys(ACTION_ICONS)]
  const today = new Date().toISOString().split('T')[0]

  const filtered = useMemo(() => {
    let list = customers
    if (filter === 'upcoming') {
      list = list.filter(c => c.nextAction?.date && c.nextAction.date >= today)
    } else if (filter === 'overdue') {
      list = list.filter(c => c.nextAction?.date && c.nextAction.date < today)
    } else if (filter === 'none') {
      list = list.filter(c => !c.nextAction)
    }
    if (typeFilter !== 'すべて') {
      list = list.filter(c => c.nextAction?.type === typeFilter)
    }
    return [...list].sort((a, b) => {
      const aDate = a.nextAction?.date || '9999-99-99'
      const bDate = b.nextAction?.date || '9999-99-99'
      return aDate.localeCompare(bDate)
    })
  }, [customers, filter, typeFilter, today])

  const counts = useMemo(() => ({
    upcoming: customers.filter(c => c.nextAction?.date && c.nextAction.date >= today).length,
    overdue: customers.filter(c => c.nextAction?.date && c.nextAction.date < today).length,
    all: customers.length,
    none: customers.filter(c => !c.nextAction).length,
  }), [customers, today])

  function handleSaveAction(customerId, data) {
    onSetNextAction(customerId, data)
    setEditingCustomer(null)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">次回アクション管理</h1>
        <p className="text-sm text-gray-500 mt-1">全顧客の次回アクションを管理します</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => setFilter(opt.id)}
            className={`card p-4 text-left transition-all ${
              filter === opt.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
            }`}
          >
            <div className={`text-xl font-bold ${
              opt.id === 'overdue' && counts.overdue > 0 ? 'text-red-600' :
              filter === opt.id ? 'text-blue-600' : 'text-gray-900'
            }`}>
              {counts[opt.id]}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{opt.label}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === opt.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label} ({counts[opt.id]})
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="form-select text-sm w-auto"
          >
            {actionTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Action cards */}
      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-gray-400">
          <span className="text-4xl mb-3">✅</span>
          <p className="text-base font-medium">該当する顧客はありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const days = c.nextAction?.date ? getDaysUntil(c.nextAction.date) : null
            const isOverdue = days !== null && days < 0

            return (
              <div key={c.id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  {/* Action icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isOverdue ? 'bg-red-100' : c.nextAction ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <span className="text-xl">
                      {c.nextAction ? (ACTION_ICONS[c.nextAction.type] || '📝') : '—'}
                    </span>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <button
                        onClick={() => onSelectCustomer(c.id)}
                        className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {c.companyName}
                      </button>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="text-xs text-gray-500 mb-1.5">{c.contactName} {c.contactTitle && `（${c.contactTitle}）`}</div>

                    {c.nextAction ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-700">{c.nextAction.type}</span>
                        <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-blue-700'}`}>
                          {formatDate(c.nextAction.date)}
                        </span>
                        {isOverdue && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {Math.abs(days)}日超過
                          </span>
                        )}
                        {days === 0 && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">今日</span>
                        )}
                        {days === 1 && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">明日</span>
                        )}
                        {c.nextAction.memo && (
                          <span className="text-xs text-gray-500 truncate max-w-48">— {c.nextAction.memo}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">次回アクション未設定</span>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setEditingCustomer(c)}
                      className="btn-secondary text-xs px-2.5 py-1.5"
                    >
                      {c.nextAction ? '✏️ 変更' : '＋ 設定'}
                    </button>
                    {c.nextAction && (
                      <button
                        onClick={() => onClearNextAction(c.id)}
                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1.5"
                        title="クリア"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editingCustomer && (
        <ActionForm
          action={editingCustomer.nextAction}
          companyName={editingCustomer.companyName}
          onSave={(data) => handleSaveAction(editingCustomer.id, data)}
          onCancel={() => setEditingCustomer(null)}
        />
      )}
    </div>
  )
}
