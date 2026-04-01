import React, { useState } from 'react'
import { useEffect } from 'react'

export default function LoginScreen({ onLogin }) {
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Yuji+Syuku&display=swap'
    document.head.appendChild(link)
    return () => document.head.removeChild(link)
  }, [])

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = onLogin(username, password)
    if (!result.ok) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col items-center justify-center p-4">
      <div
        className="text-5xl md:text-7xl mb-8 text-center drop-shadow-lg"
        style={{ fontFamily: "'Yuji Syuku', serif", color: '#e91e8c', fontWeight: 700, WebkitTextStroke: '1px #e91e8c' }}
      >
        ようこそ！熱狂様！
      </div>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <img
            src="https://www.li-go.jp/wp-content/uploads/2023/04/cropped-icon-192x192.png"
            alt="LIGO"
            className="w-11 h-11 rounded-xl object-contain"
          />
          <div>
            <div className="text-lg font-bold text-gray-900">LIPON</div>
            <div className="text-xs text-gray-500">顧客管理システム</div>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-1">ログイン</h2>
        <p className="text-sm text-gray-500 mb-6">IDとパスワードを入力してください</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ユーザーID</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              className="form-input"
              placeholder="ユーザーIDを入力"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              className="form-input"
              placeholder="パスワードを入力"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-2.5 text-sm font-semibold"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}

