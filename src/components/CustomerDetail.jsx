import React, { useState } from 'react'
import StatusBadge from './StatusBadge'
import ActionForm from './ActionForm'
import HistoryForm, { ACTION_ICONS, CONTACT_METHOD_ICONS, CONTACT_TYPE_ICONS } from './HistoryForm'
import CustomerForm from './CustomerForm'

const FORECAST_LABELS = { A: 'A ほぼ確実', B: 'B 見込みあり', C: 'C 可能性あり', D: 'D 要確認' }
const FORECAST_COLORS = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-yellow-100 text-yellow-800',
  D: 'bg-gray-100 text-gray-700',
}
const RELATIONSHIP_LABELS = { '☀️': '☀️ 良好', '☁️': '☁️ 普通', '☔️': '☔️ 不調' }
const RELATIONSHIP_COLORS = {
  '☀️': 'bg-yellow-50 text-yellow-800 border border-yellow-200',
  '☁️': 'bg-gray-50 text-gray-700 border border-gray-200',
  '☔️': 'bg-blue-50 text-blue-800 border border-blue-200',
}

function getTypeLabel(type) {
  if (!type) return ''
  if (Array.isArray(type)) return type.join('・')
  return type
}

function getTypeIcon(type) {
  if (!type) return '📝'
  if (Array.isArray(type)) return ACTION_ICONS[type[0]] || '📝'
  return ACTION_ICONS[type] || '📝'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr.split('T')[0])
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

function InfoRow({ icon, label, value, link }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-gray-400 flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-400 block">{label}</span>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer"
            className="text-blue-600 hover:underline break-all">{value}</a>
        ) : (
          <span className="text-gray-800 break-all">{value}</span>
        )}
      </div>
    </div>
  )
}

export default function CustomerDetail({
  customer, customers = [], onBack, onUpdate, onDelete, onAddHistory, onSetNextAction, onClearNextAction,
}) {
  const [showActionForm, setShowActionForm] = useState(false)
  const [showHistoryForm, setShowHistoryForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)

  if (!customer) return null

  const { nextAction, history = [] } = customer
  const days = nextAction?.date ? getDaysUntil(nextAction.date) : null
  const isOverdue = days !== null && days < 0
  const overdueDays = isOverdue ? Math.abs(days) : 0

  function handleSaveAction(data) { onSetNextAction(customer.id, data); setShowActionForm(false) }
  function handleAddHistory(data) { onAddHistory(customer.id, data); setShowHistoryForm(false) }
  function handleUpdate(data) { onUpdate(customer.id, data); setShowEditForm(false) }

  const hasCompanyInfo = customer.website || customer.address || customer.fiscalYearEnd ||
    customer.founded || customer.capital || customer.employees ||
    customer.corporateNumber || customer.indeedUrl

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="btn-secondary px-3 py-2 mt-0.5">← 一覧へ</button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{customer.companyName}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <StatusBadge status={customer.status} />
              {customer.industry && <span className="text-sm text-gray-500">{customer.industry}</span>}
              {customer.assignedTo && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  担当：{customer.assignedTo}
                </span>
              )}
              {customer.relationship && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RELATIONSHIP_COLORS[customer.relationship] || 'bg-gray-50 text-gray-700'}`}>
                  {RELATIONSHIP_LABELS[customer.relationship] || customer.relationship}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setShowEditForm(true)} className="btn-secondary text-sm px-3 py-1.5">✏️ 編集</button>
          <button onClick={() => { if (window.confirm(`「${customer.companyName}」を削除しますか？`)) onDelete(customer.id) }}
            className="btn-danger text-sm px-3 py-1.5">🗑️</button>
        </div>
      </div>

      {/* ⚠️ 対応もれアラート */}
      {isOverdue && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">🚨</span>
          <div className="flex-1">
            <p className="font-semibold text-red-800">次回アクションが {overdueDays}日 超過しています</p>
            <p className="text-sm text-red-600 mt-0.5">
              {getTypeLabel(nextAction?.type)}（予定日：{formatDate(nextAction.date)}）が未対応です。早急に対応してください。
            </p>
          </div>
          <button onClick={() => setShowActionForm(true)}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex-shrink-0">
            今すぐ対応
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Next Action + History */}
        <div className="lg:col-span-2 space-y-5">
          {/* Next action */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">次回アクション</h2>
              <div className="flex gap-2">
                {nextAction && (
                  <button onClick={() => onClearNextAction(customer.id)}
                    className="text-xs text-gray-400 hover:text-red-500 px-2 py-1">クリア</button>
                )}
                <button onClick={() => setShowActionForm(true)} className="btn-primary text-xs px-3 py-1.5">
                  {nextAction ? '✏️ 変更' : '＋ 設定'}
                </button>
              </div>
            </div>
            {nextAction ? (
              <div className={`flex items-start gap-4 p-4 rounded-lg border-2 ${
                isOverdue ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'
              }`}>
                <div className="text-3xl">{getTypeIcon(nextAction.type)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-semibold text-gray-800">{getTypeLabel(nextAction.type)}</span>
                    <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-blue-700'}`}>
                      {formatDate(nextAction.date)}
                    </span>
                    {isOverdue && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{overdueDays}日超過</span>}
                    {days === 0 && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">今日</span>}
                    {days === 1 && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">明日</span>}
                  </div>
                  {nextAction.memo && <p className="text-sm text-gray-600 mt-1.5">{nextAction.memo}</p>}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <span className="text-3xl mb-2">📅</span>
                <p className="text-sm">次回アクションが設定されていません</p>
                <button onClick={() => setShowActionForm(true)} className="btn-primary text-sm mt-3">
                  ＋ アクションを設定
                </button>
              </div>
            )}
          </div>

          {/* Activity history */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">
                活動履歴 <span className="text-sm font-normal text-gray-400 ml-1">({history.length}件)</span>
              </h2>
              <button onClick={() => setShowHistoryForm(true)} className="btn-primary text-xs px-3 py-1.5">
                ＋ 記録追加
              </button>
            </div>
            <div className="p-5">
              {history.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-gray-400">
                  <span className="text-3xl mb-2">📋</span>
                  <p className="text-sm">活動履歴がありません</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                  <div className="space-y-5">
                    {history.map((h, idx) => (
                      <div key={h.id || idx} className="flex gap-4 relative">
                        <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center z-10 flex-shrink-0">
                          <span className="text-base">
                            {h.contactMethod ? (CONTACT_METHOD_ICONS[h.contactMethod] || '📝') : getTypeIcon(h.type)}
                          </span>
                        </div>
                        <div className="flex-1 pb-1">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            {/* 接触方法 */}
                            <span className="text-sm font-semibold text-gray-800">
                              {h.contactMethod || getTypeLabel(h.type)}
                            </span>
                            {/* 接触内容タグ */}
                            {h.contactTypes && h.contactTypes.length > 0 && h.contactTypes.map(ct => (
                              <span key={ct} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                                {CONTACT_TYPE_ICONS[ct]} {ct}
                              </span>
                            ))}
                            <span className="text-xs text-gray-500">{formatDate(h.date)}</span>
                            {/* LIGO参加者 */}
                            {h.ligoParticipants && h.ligoParticipants.length > 0 && h.ligoParticipants.map(p => (
                              <span key={p} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                                🏢 {p}
                              </span>
                            ))}
                            {/* 後方互換: 旧 salesRep フィールド */}
                            {!h.ligoParticipants && h.salesRep && (
                              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                                🏢 {h.salesRep}
                              </span>
                            )}
                            {/* お客さん参加者 */}
                            {h.contactPerson && (
                              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                👤 {h.contactPerson}
                              </span>
                            )}
                            {/* 満足度 */}
                            {h.satisfaction && (
                              <span className="text-sm" title="応募/採用満足度">{h.satisfaction}</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">
                            {h.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Contact + Company Info + Meta */}
        <div className="space-y-5">
          {/* Contact info */}
          <div className="card p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">担当者情報</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-sm">{customer.contactName?.charAt(0) || '?'}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{customer.contactName}</div>
                  {customer.contactTitle && <div className="text-xs text-gray-500">{customer.contactTitle}</div>}
                </div>
              </div>
              {customer.email && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">📧</span>
                  <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline break-all">{customer.email}</a>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">📞</span>
                  <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">{customer.phone}</a>
                </div>
              )}
              {customer.mobilePhone && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">📱</span>
                  <a href={`tel:${customer.mobilePhone}`} className="text-blue-600 hover:underline">{customer.mobilePhone}</a>
                </div>
              )}
              {customer.lineId && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">💬</span>
                  <span className="text-gray-700">LINE: <span className="font-medium">{customer.lineId}</span></span>
                </div>
              )}
              {customer.assignedTo && (
                <div className="flex items-center gap-2 text-sm pt-2 border-t border-gray-100 mt-2">
                  <span className="text-gray-400">👔</span>
                  <span className="text-gray-600">担当営業：<span className="font-medium text-gray-800">{customer.assignedTo}</span></span>
                </div>
              )}
              {(customer.dealAmount != null || customer.forecast) && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mt-2 flex-wrap">
                  {customer.dealAmount != null && customer.dealAmount !== '' && (
                    <span className="text-sm text-gray-700">
                      💰 <span className="font-semibold text-gray-900">{Number(customer.dealAmount).toLocaleString()}万円</span>
                    </span>
                  )}
                  {customer.forecast && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${FORECAST_COLORS[customer.forecast] || 'bg-gray-100 text-gray-700'}`}>
                      {FORECAST_LABELS[customer.forecast] || customer.forecast}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 月次売上推移グラフ */}
          {customer.monthlySales && Object.keys(customer.monthlySales).length > 0 && (() => {
            const entries = Object.entries(customer.monthlySales).sort(([a],[b]) => a.localeCompare(b))
            const values = entries.map(([,v]) => Number(v))
            const maxVal = Math.max(...values)
            const total = values.reduce((s,v) => s+v, 0)
            const avg = Math.round(total / values.length)
            return (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-gray-900">📈 月次売上推移</h2>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>累計 <span className="font-bold text-gray-800">{(total/10000).toLocaleString(undefined,{maximumFractionDigits:1})}万円</span></span>
                    <span>平均 <span className="font-bold text-gray-800">{(avg/10000).toLocaleString(undefined,{maximumFractionDigits:1})}万円/月</span></span>
                  </div>
                </div>
                <div className="flex items-end gap-1 h-20">
                  {entries.map(([month, val], i) => {
                    const pct = maxVal > 0 ? (Number(val) / maxVal) * 100 : 0
                    const prev = i > 0 ? values[i-1] : null
                    const trend = prev != null ? (Number(val) > prev ? 'up' : Number(val) < prev ? 'down' : 'flat') : 'flat'
                    const color = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#3b82f6'
                    return (
                      <div key={month} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                        <div className="w-full rounded-t transition-all duration-300 min-h-[2px]"
                          style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: color, opacity: 0.8 }} />
                        <div className="text-gray-400 text-center leading-tight" style={{fontSize:'9px'}}>{month.slice(5)}</div>
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {month}: {(Number(val)/10000).toLocaleString(undefined,{maximumFractionDigits:1})}万円
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="text-xs text-gray-400 mt-1">{entries[0]?.[0]} 〜 {entries[entries.length-1]?.[0]}（{entries.length}ヶ月）</div>
              </div>
            )
          })()}

          {/* Company basic info */}
          {hasCompanyInfo && (
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">会社基本情報</h2>
              <div className="space-y-3">
                {(customer.postalCode || customer.address) && (
                  <InfoRow icon="📍" label="住所"
                    value={[customer.postalCode && `〒${customer.postalCode}`, customer.address].filter(Boolean).join(' ')} />
                )}
                <InfoRow icon="🌐" label="Webサイト" value={customer.website}
                  link={customer.website} />
                <InfoRow icon="📅" label="決算期" value={customer.fiscalYearEnd ? `${customer.fiscalYearEnd}末` : ''} />
                <InfoRow icon="🏛" label="設立" value={customer.founded} />
                <InfoRow icon="💴" label="資本金" value={customer.capital} />
                <InfoRow icon="👥" label="従業員数" value={customer.employees} />
                {customer.corporateNumber && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-gray-400 flex-shrink-0 mt-0.5">🔢</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-gray-400 block">法人番号</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-800 font-mono">{customer.corporateNumber}</span>
                        <a href={`https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=${customer.corporateNumber}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-orange-500 hover:text-orange-700 border border-orange-200 rounded px-1.5 py-0.5 hover:bg-orange-50 transition-colors">
                          🏛 NTA
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                {customer.indeedUrl && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-gray-400 flex-shrink-0 mt-0.5">🔵</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-gray-400 block">Indeed企業ページ</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <a href={customer.indeedUrl} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all text-xs">{customer.indeedUrl}</a>
                        <a href={customer.indeedUrl} target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700 transition-colors">
                          開く →
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                {!customer.indeedUrl && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-gray-400 flex-shrink-0 mt-0.5">🔵</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-gray-400 block">Indeed</span>
                      <a href={`https://jp.indeed.com/jobs?q=${encodeURIComponent(customer.companyName)}&l=`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline">
                        Indeed で求人を検索 →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Memo */}
          {customer.memo && (
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-3">メモ</h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{customer.memo}</p>
            </div>
          )}

          {/* Meta */}
          <div className="card p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">登録情報</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">登録日</span>
                <span className="text-gray-800">{formatDate(customer.createdAt?.split('T')[0])}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">最終更新</span>
                <span className="text-gray-800">{formatDate(customer.updatedAt?.split('T')[0])}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">活動件数</span>
                <span className="text-gray-800">{history.length}件</span>
              </div>
              {isOverdue && (
                <div className="flex justify-between pt-1 border-t border-red-100">
                  <span className="text-red-500 font-medium">対応もれ</span>
                  <span className="text-red-600 font-semibold">{overdueDays}日超過</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showActionForm && (
        <ActionForm action={nextAction} companyName={customer.companyName}
          onSave={handleSaveAction} onCancel={() => setShowActionForm(false)} />
      )}
      {showHistoryForm && (
        <HistoryForm companyName={customer.companyName}
          defaultSalesRep={customer.assignedTo}
          onSave={handleAddHistory} onCancel={() => setShowHistoryForm(false)} />
      )}
      {showEditForm && (
        <CustomerForm customer={customer} customers={customers} onSave={handleUpdate} onCancel={() => setShowEditForm(false)} />
      )}
    </div>
  )
}
