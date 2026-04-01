import React, { useState } from 'react'
import { ASSIGNED_TO_OPTIONS } from '../data/sampleData'

const ROLES = [
  { value: 'admin', label: '管理者' },
  { value: 'user', label: '一般ユーザー' },
]

function UserForm({ user, onSave, onCancel }) {
  const [form, setForm] = useState({
    displayName: user?.displayName || '',
    username: user?.username || '',
    password: '',
    role: user?.role || 'user',
    assignedTo: user?.assignedTo || '',
  })
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!form.displayName.trim()) e.displayName = '表示名は必須です'
    if (!form.username.trim()) e.username = 'ユーザーIDは必須です'
    if (!user && !form.password.trim()) e.password = 'パスワードは必須です'
    return e
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    const data = { ...form }
    if (!data.password) delete data.password
    if (!data.assignedTo) data.assignedTo = null
    onSave(data)
  }

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {user ? 'ユーザー編集' : 'ユーザー追加'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              表示名 <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.displayName} onChange={set('displayName')}
              className={`form-input ${errors.displayName ? 'border-red-400' : ''}`}
              placeholder="田中 太郎" />
            {errors.displayName && <p className="text-red-500 text-xs mt-1">{errors.displayName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ユーザーID <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.username} onChange={set('username')}
              className={`form-input ${errors.username ? 'border-red-400' : ''}`}
              placeholder="tanaka" />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード {!user && <span className="text-red-500">*</span>}
              {user && <span className="text-xs text-gray-400 font-normal ml-1">（空欄で変更なし）</span>}
            </label>
            <input type="password" value={form.password} onChange={set('password')}
              className={`form-input ${errors.password ? 'border-red-400' : ''}`}
              placeholder={user ? '変更する場合のみ入力' : 'パスワード'} />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">権限</label>
            <div className="flex gap-3">
              {ROLES.map(r => (
                <button key={r.value} type="button"
                  onClick={() => setForm(f => ({ ...f, role: r.value }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                    form.role === r.value
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}>
                  {r.value === 'admin' ? '👑 ' : '👤 '}{r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              担当者名（顧客との紐付け）
              <span className="text-xs text-gray-400 font-normal ml-1">（任意）</span>
            </label>
            <select value={form.assignedTo} onChange={set('assignedTo')} className="form-input">
              <option value="">未設定</option>
              {ASSIGNED_TO_OPTIONS.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onCancel} className="btn-secondary">キャンセル</button>
            <button type="submit" className="btn-primary">
              {user ? '保存する' : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 初期パスワード表（ユーザーIDと同じ、adminはligo2026）
const INITIAL_PASSWORDS = {
  admin: 'ligo2026',
  toyota: 'toyota',
  kimura: 'kimura',
  kataoka: 'kataoka',
  nagatsuma: 'nagatsuma',
  okada: 'okada',
  kodama: 'kodama',
  aima: 'aima',
}

export default function UserManagement({ users, currentUser, onAdd, onUpdate, onDelete, onResetDefaults, onClose }) {
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [showPasswords, setShowPasswords] = useState(false)
  const [copied, setCopied] = useState('')

  function copyToClipboard(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(''), 1500)
    })
  }

  function handleSave(data) {
    if (editingUser) {
      onUpdate(editingUser.id, data)
    } else {
      onAdd(data)
    }
    setShowForm(false)
    setEditingUser(null)
  }

  function handleEdit(user) {
    setEditingUser(user)
    setShowForm(true)
  }

  function handleDelete(user) {
    if (deleteConfirm === user.id) {
      onDelete(user.id)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(user.id)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">👥 ユーザー管理</h2>
            <p className="text-xs text-gray-500 mt-0.5">各担当者のID・パスワードを管理</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditingUser(null); setShowForm(true) }}
              className="btn-primary text-sm px-3 py-1.5">
              ＋ ユーザー追加
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl ml-2">✕</button>
          </div>
        </div>

        {/* パスワード一覧カード */}
        <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-800">🔑 初期ログイン情報</span>
            <button onClick={() => setShowPasswords(v => !v)}
              className="text-xs text-blue-600 hover:text-blue-800 underline">
              {showPasswords ? '隠す' : '表示する'}
            </button>
          </div>
          {showPasswords && (
            <div className="space-y-1.5 mt-2">
              {users.map(u => {
                const initPwd = INITIAL_PASSWORDS[u.username] || u.username
                const copyKey = `${u.id}_pwd`
                return (
                  <div key={u.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                    <span className="text-xs font-medium text-gray-700 w-24 truncate">{u.displayName}</span>
                    <span className="text-xs text-gray-400 w-24">ID: <span className="font-mono text-gray-700">{u.username}</span></span>
                    <span className="text-xs text-gray-400 flex-1">PW: <span className="font-mono text-gray-700">{initPwd}</span></span>
                    <button onClick={() => copyToClipboard(`ID: ${u.username} / PW: ${initPwd}`, copyKey)}
                      className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0">
                      {copied === copyKey ? '✅ コピー済み' : '📋 コピー'}
                    </button>
                  </div>
                )
              })}
              <p className="text-xs text-blue-600 mt-2">※ 初回ログイン後、各自でパスワードを変更してください</p>
            </div>
          )}
        </div>

        <div className="p-6 space-y-3">
          {users.map(user => (
            <div key={user.id}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                user.role === 'admin' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {user.displayName?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 text-sm">{user.displayName}</span>
                  {user.role === 'admin' && (
                    <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded font-medium">👑 管理者</span>
                  )}
                  {user.id === currentUser?.id && (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">ログイン中</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3">
                  <span>ID: <span className="font-mono text-gray-700">{user.username}</span></span>
                  {user.assignedTo && <span>担当顧客: <span className="text-gray-700">{user.assignedTo}</span></span>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => handleEdit(user)}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
                  編集
                </button>
                {user.id !== currentUser?.id && (
                  <button onClick={() => handleDelete(user)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      deleteConfirm === user.id
                        ? 'bg-red-500 text-white border-red-500'
                        : 'text-red-500 border-red-200 hover:bg-red-50'
                    }`}>
                    {deleteConfirm === user.id ? '確認削除' : '削除'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          <button onClick={onResetDefaults}
            className="w-full py-2 text-xs text-gray-400 border border-gray-200 rounded-lg hover:bg-gray-50">
            デフォルトユーザーにリセット
          </button>
        </div>
      </div>

      {showForm && (
        <UserForm
          user={editingUser}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingUser(null) }}
        />
      )}
    </div>
  )
}
