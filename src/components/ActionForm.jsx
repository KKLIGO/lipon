import React, { useState, useEffect } from 'react'

const ACTION_TYPES = [
  '電話', 'メール', '訪問', 'オンライン商談',
  '商談', '取材', '振返り',
  '提案書送付', '見積送付', 'その他',
]

const ACTION_ICONS = {
  '電話': '📞', 'メール': '📧', '訪問': '🏢', 'オンライン商談': '💻',
  '商談': '🤝', '取材': '🎤', '振返り': '🔄',
  '提案書送付': '📄', '見積送付': '💰', 'その他': '📝',
}

function getTodayStr() {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

export default function ActionForm({ action, companyName, onSave, onCancel }) {
  const [form, setForm] = useState({
    type: '電話',
    date: getTodayStr(),
    memo: '',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (action) {
      setForm({
        type: action.type || '電話',
        date: action.date || getTodayStr(),
        memo: action.memo || '',
      })
    } else {
      setForm({ type: '電話', date: getTodayStr(), memo: '' })
    }
    setErrors({})
  }, [action])

  function validate() {
    const e = {}
    if (!form.date) e.date = '日付は必須です'
    return e
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSave(form)
  }

  const title = action ? '次回アクションを編集' : '次回アクションを設定'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {companyName && (
              <p className="text-sm text-gray-500 mt-0.5">{companyName}</p>
            )}
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">アクション種別</label>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {ACTION_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    form.type === t
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <span className="text-xl">{ACTION_ICONS[t]}</span>
                  <span>{t}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              実施予定日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.date}
              onChange={e => {
                setForm(f => ({ ...f, date: e.target.value }))
                if (errors.date) setErrors(er => { const n = { ...er }; delete n.date; return n })
              }}
              className={`form-input ${errors.date ? 'border-red-400' : ''}`}
            />
            {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
          </div>

          {/* Memo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
            <textarea
              value={form.memo}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              rows={3}
              placeholder="アクションの内容・目的など..."
              className="form-input resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onCancel} className="btn-secondary">
              キャンセル
            </button>
            <button type="submit" className="btn-primary">
              💾 設定する
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
