import React, { useState } from 'react'
import { ASSIGNED_TO_OPTIONS } from '../data/sampleData'

export const CONTACT_METHODS = ['電話', 'メール', 'LINE', '訪問', 'Web']
export const CONTACT_METHOD_ICONS = {
  '電話': '📞', 'メール': '📧', 'LINE': '💬', '訪問': '🏢', 'Web': '🌐',
}

export const CONTACT_TYPES = ['取材', '振返り', '商談']
export const CONTACT_TYPE_ICONS = {
  '取材': '🎤', '振返り': '🔄', '商談': '🤝',
}

export const ACTION_ICONS = {
  ...CONTACT_METHOD_ICONS,
  ...CONTACT_TYPE_ICONS,
  'その他': '📝',
}

const SATISFACTION_OPTIONS = [
  { value: '☀️', label: '☀️ 満足' },
  { value: '☁️', label: '☁️ 普通' },
  { value: '☔️', label: '☔️ 不満' },
]

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function HistoryForm({ companyName, defaultSalesRep, onSave, onCancel }) {
  const [form, setForm] = useState({
    contactMethod: '電話',
    contactTypes: [],
    date: getTodayStr(),
    content: '',
    contactPerson: '',       // お客さん側（自由記述）
    ligoParticipants: defaultSalesRep ? [defaultSalesRep] : [],  // LIGO参加者（複数選択）
    satisfaction: '',        // 応募/採用満足度
  })
  const [errors, setErrors] = useState({})
  const [ligoFreeText, setLigoFreeText] = useState('')

  function toggleType(t) {
    setForm(f => {
      const has = f.contactTypes.includes(t)
      return { ...f, contactTypes: has ? f.contactTypes.filter(x => x !== t) : [...f.contactTypes, t] }
    })
  }

  function toggleLigoParticipant(name) {
    setForm(f => {
      const has = f.ligoParticipants.includes(name)
      return { ...f, ligoParticipants: has ? f.ligoParticipants.filter(x => x !== name) : [...f.ligoParticipants, name] }
    })
  }

  function addLigoFreeText() {
    const name = ligoFreeText.trim()
    if (!name) return
    setForm(f => ({
      ...f,
      ligoParticipants: f.ligoParticipants.includes(name)
        ? f.ligoParticipants
        : [...f.ligoParticipants, name]
    }))
    setLigoFreeText('')
  }

  function validate() {
    const e = {}
    if (!form.content.trim()) e.content = '内容は必須です'
    if (!form.date) e.date = '日付は必須です'
    return e
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    onSave({
      contactMethod: form.contactMethod,
      contactTypes: form.contactTypes,
      type: form.contactMethod,   // backward compat
      date: form.date,
      content: form.content,
      contactPerson: form.contactPerson,
      ligoParticipants: form.ligoParticipants,
      satisfaction: form.satisfaction,
    })
  }

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">活動履歴を追加</h2>
            {companyName && <p className="text-sm text-gray-500 mt-0.5">{companyName}</p>}
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* 接触方法 — single select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">接触方法</label>
            <div className="grid grid-cols-5 gap-2">
              {CONTACT_METHODS.map(m => {
                const selected = form.contactMethod === m
                return (
                  <button key={m} type="button"
                    onClick={() => setForm(f => ({ ...f, contactMethod: m }))}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-all ${
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                    }`}
                  >
                    <span className="text-lg">{CONTACT_METHOD_ICONS[m]}</span>
                    <span>{m}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 接触内容 — multi select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              接触内容
              <span className="text-xs text-gray-400 font-normal ml-1">（複数選択可）</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CONTACT_TYPES.map(t => {
                const selected = form.contactTypes.includes(t)
                return (
                  <button key={t} type="button" onClick={() => toggleType(t)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      selected
                        ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-200'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
                    }`}
                  >
                    <span className="text-lg">{CONTACT_TYPE_ICONS[t]}</span>
                    <span>{t}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              実施日 <span className="text-red-500">*</span>
            </label>
            <input type="date" value={form.date} onChange={set('date')}
              className={`form-input ${errors.date ? 'border-red-400' : ''}`} />
            {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
          </div>

          {/* LIGO参加者 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              参加者名（LIGO側）
              <span className="text-xs text-gray-400 font-normal ml-1">（複数選択可）</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {ASSIGNED_TO_OPTIONS.map(name => {
                const selected = form.ligoParticipants.includes(name)
                return (
                  <button key={name} type="button" onClick={() => toggleLigoParticipant(name)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      selected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                    }`}>
                    {selected ? '✓ ' : ''}{name}
                  </button>
                )
              })}
            </div>
            {/* Free text for additional participants */}
            <div className="flex gap-2">
              <input type="text" value={ligoFreeText} onChange={e => setLigoFreeText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLigoFreeText() } }}
                placeholder="その他の参加者名を入力..."
                className="form-input text-sm flex-1" />
              <button type="button" onClick={addLigoFreeText}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">追加</button>
            </div>
            {/* Show free-text added participants not in ASSIGNED_TO_OPTIONS */}
            {form.ligoParticipants.filter(p => !ASSIGNED_TO_OPTIONS.includes(p)).map(p => (
              <span key={p} className="inline-flex items-center gap-1 mt-1 mr-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                {p}
                <button type="button" onClick={() => setForm(f => ({ ...f, ligoParticipants: f.ligoParticipants.filter(x => x !== p) }))}
                  className="text-blue-500 hover:text-blue-700 ml-0.5">✕</button>
              </span>
            ))}
          </div>

          {/* お客さん参加者 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              参加者名（お客さん側）
            </label>
            <input type="text" value={form.contactPerson} onChange={set('contactPerson')}
              placeholder="田中部長、鈴木様 など（複数の場合は「、」で区切り）"
              className="form-input text-sm" />
          </div>

          {/* 応募/採用満足度 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">応募/採用満足度</label>
            <div className="flex gap-3">
              {SATISFACTION_OPTIONS.map(({ value, label }) => (
                <button key={value} type="button"
                  onClick={() => setForm(f => ({ ...f, satisfaction: f.satisfaction === value ? '' : value }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                    form.satisfaction === value
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              内容 <span className="text-red-500">*</span>
            </label>
            <textarea value={form.content}
              onChange={e => {
                setForm(f => ({ ...f, content: e.target.value }))
                if (errors.content) setErrors(er => { const n = {...er}; delete n.content; return n })
              }}
              rows={4} placeholder="実施した内容、結果、顧客の反応など..."
              className={`form-input resize-none ${errors.content ? 'border-red-400' : ''}`} />
            {errors.content && <p className="text-red-500 text-xs mt-1">{errors.content}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onCancel} className="btn-secondary">キャンセル</button>
            <button type="submit" className="btn-primary">＋ 追加する</button>
          </div>
        </form>
      </div>
    </div>
  )
}
