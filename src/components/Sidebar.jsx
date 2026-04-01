import React from 'react'

const navItems = [
  { id: 'dashboard', label: 'ダッシュボード', icon: '🏠' },
  { id: 'customers', label: '顧客一覧', icon: '👥' },
  { id: 'yomi', label: 'ヨミ管理', icon: '📋' },
  { id: 'actions', label: '次回アクション管理', icon: '✅' },
]

export default function Sidebar({
  currentPage, currentUser, onNavigate, isOpen, onClose,
  onLogout, onOpenUserManagement, onQuickAddCustomer, onQuickLogActivity,
  onOpenCsvImporter, onOpenIndeed,
}) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-30 flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
          <img
            src="https://www.li-go.jp/wp-content/uploads/2023/04/cropped-icon-192x192.png"
            alt="LIGO"
            className="w-9 h-9 rounded-lg object-contain"
          />
          <div>
            <div className="text-base font-bold text-gray-900">LIPON</div>
            <div className="text-xs text-gray-500">顧客管理システム</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            メインメニュー
          </div>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); onClose() }}
              className={`sidebar-link w-full text-left ${currentPage === item.id ? 'active' : ''}`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}

          {/* Quick actions */}
          <div className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            クイックアクション
          </div>
          <button
            onClick={() => { onQuickLogActivity(); onClose() }}
            className="sidebar-link w-full text-left text-blue-600 hover:bg-blue-50"
          >
            <span className="text-base">📝</span>
            <span>活動を記録</span>
          </button>
          <button
            onClick={() => { onQuickAddCustomer(); onClose() }}
            className="sidebar-link w-full text-left text-green-600 hover:bg-green-50"
          >
            <span className="text-base">➕</span>
            <span>新規お客さん登録</span>
          </button>

          {/* Integrations */}
          <div className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            連携・取込
          </div>
          <button
            onClick={() => { onOpenCsvImporter(); onClose() }}
            className="sidebar-link w-full text-left text-orange-600 hover:bg-orange-50"
          >
            <span className="text-base">📊</span>
            <span>売上CSVインポート</span>
          </button>
          <button
            onClick={() => { onOpenIndeed(); onClose() }}
            className="sidebar-link w-full text-left"
          >
            <span className="text-base">🔵</span>
            <span>Indeed 連携</span>
          </button>

          {/* Admin */}
          {currentUser?.role === 'admin' && (
            <>
              <div className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                管理
              </div>
              <button
                onClick={() => { onOpenUserManagement(); onClose() }}
                className="sidebar-link w-full text-left"
              >
                <span className="text-base">👥</span>
                <span>ユーザー管理</span>
              </button>
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-gray-200">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              currentUser?.role === 'admin' ? 'bg-yellow-100' : 'bg-blue-100'
            }`}>
              <span className={`text-sm font-semibold ${
                currentUser?.role === 'admin' ? 'text-yellow-700' : 'text-blue-600'
              }`}>
                {currentUser?.displayName?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-700 truncate">{currentUser?.displayName || 'ユーザー'}</div>
              <div className="text-xs text-gray-400">{currentUser?.role === 'admin' ? '管理者' : '営業担当'}</div>
            </div>
            <button
              onClick={onLogout}
              title="ログアウト"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
