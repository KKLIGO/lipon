import React, { useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import CustomerList from './components/CustomerList'
import CustomerDetail from './components/CustomerDetail'
import ActionManager from './components/ActionManager'
import CustomerForm from './components/CustomerForm'
import LoginScreen from './components/LoginScreen'
import UserManagement from './components/UserManagement'
import HistoryForm from './components/HistoryForm'
import CsvImporter from './components/CsvImporter'
import IndeedIntegration from './components/IndeedIntegration'
import YomiManager from './components/YomiManager'
import { useCustomers } from './hooks/useCustomers'
import { useAuth } from './hooks/useAuth'
import { useHPMonitor } from './hooks/useHPMonitor'

function QuickLogModal({ customers, currentUser, onSave, onClose }) {
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const filtered = customers.filter(c =>
    c.companyName?.includes(search) || c.contactName?.includes(search)
  ).slice(0, 20)

  if (selectedCustomer) {
    return (
      <HistoryForm
        companyName={selectedCustomer.companyName}
        defaultSalesRep={currentUser?.assignedTo || currentUser?.displayName}
        onSave={data => { onSave(selectedCustomer.id, data); onClose() }}
        onCancel={() => setSelectedCustomer(null)}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">活動を記録</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-4 border-b border-gray-100">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="会社名・担当者名で検索..."
            className="form-input text-sm"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">顧客が見つかりません</p>
          ) : (
            filtered.map(c => (
              <button key={c.id} onClick={() => setSelectedCustomer(c)}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-blue-50 transition-colors">
                <div className="text-sm font-medium text-gray-900">{c.companyName}</div>
                {c.contactName && <div className="text-xs text-gray-500 mt-0.5">{c.contactName}</div>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { currentUser, users, login, logout, addUser, updateUser, deleteUser, resetToDefaults } = useAuth()

  const [page, setPage] = useState('dashboard')
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [listFilter, setListFilter] = useState({ status: 'すべて', rep: '', period: '' })
  const [showAddForm, setShowAddForm] = useState(false)
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [showQuickLog, setShowQuickLog] = useState(false)
  const [showCsvImporter, setShowCsvImporter] = useState(false)
  const [showIndeed, setShowIndeed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const {
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    bulkDeleteCustomers,
    bulkUpdateStatus,
    bulkUpdateAssignedTo,
    addHistoryEntry,
    setNextAction,
    clearNextAction,
    getCustomer,
  } = useCustomers()

  const hpMonitor = useHPMonitor()

  if (!currentUser) {
    return <LoginScreen onLogin={login} />
  }

  function handleSelectCustomer(id) {
    setSelectedCustomerId(id)
    setPage('detail')
  }

  function handleAddCustomer(data) {
    addCustomer(data)
    setShowAddForm(false)
  }

  function handleDeleteCustomer(id) {
    deleteCustomer(id)
    if (page === 'detail' && selectedCustomerId === id) {
      setPage('customers')
      setSelectedCustomerId(null)
    }
  }

  function handleNavigate(p) {
    setPage(p)
    if (p !== 'detail') setSelectedCustomerId(null)
  }

  function handleNavigateToList(filter = {}) {
    setListFilter(f => ({ ...f, ...filter }))
    setPage('customers')
    setSelectedCustomerId(null)
  }

  const selectedCustomer = selectedCustomerId ? getCustomer(selectedCustomerId) : null

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        currentPage={page === 'detail' ? 'customers' : page}
        currentUser={currentUser}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={logout}
        onOpenUserManagement={() => setShowUserManagement(true)}
        onQuickAddCustomer={() => setShowAddForm(true)}
        onQuickLogActivity={() => setShowQuickLog(true)}
        onOpenCsvImporter={() => setShowCsvImporter(true)}
        onOpenIndeed={() => setShowIndeed(true)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3.5 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            ☰
          </button>
          <h2 className="font-semibold text-gray-700 text-sm lg:text-base">
            {page === 'dashboard' && 'ダッシュボード'}
            {page === 'customers' && '顧客一覧'}
            {page === 'detail' && (selectedCustomer?.companyName || '顧客詳細')}
            {page === 'actions' && '次回アクション管理'}
            {page === 'yomi' && '📋 ヨミ管理'}
          </h2>
          {page === 'detail' && (
            <div className="flex items-center gap-1 text-sm text-gray-400 ml-1">
              <button
                onClick={() => handleNavigate('customers')}
                className="hover:text-blue-600 transition-colors"
              >
                顧客一覧
              </button>
              <span>/</span>
              <span className="text-gray-700">{selectedCustomer?.companyName}</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-400 hidden sm:block">
              {customers.length}社登録中
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {page === 'dashboard' && (
            <Dashboard
              customers={customers}
              onNavigate={handleNavigate}
              onSelectCustomer={handleSelectCustomer}
              hpMonitor={hpMonitor}
              onNavigateToList={handleNavigateToList}
            />
          )}

          {page === 'customers' && (
            <CustomerList
              customers={customers}
              onSelectCustomer={handleSelectCustomer}
              onAddCustomer={() => setShowAddForm(true)}
              onDeleteCustomer={handleDeleteCustomer}
              onBulkDelete={bulkDeleteCustomers}
              onBulkUpdateStatus={bulkUpdateStatus}
              onBulkUpdateAssignedTo={bulkUpdateAssignedTo}
              initialFilter={listFilter}
              currentUser={currentUser}
            />
          )}

          {page === 'detail' && selectedCustomer && (
            <CustomerDetail
              customer={selectedCustomer}
              customers={customers}
              onBack={() => handleNavigate('customers')}
              onUpdate={updateCustomer}
              onDelete={handleDeleteCustomer}
              onAddHistory={addHistoryEntry}
              onSetNextAction={setNextAction}
              onClearNextAction={clearNextAction}
            />
          )}

          {page === 'actions' && (
            <ActionManager
              customers={customers}
              onSetNextAction={setNextAction}
              onClearNextAction={clearNextAction}
              onSelectCustomer={handleSelectCustomer}
            />
          )}

          {page === 'yomi' && (
            <YomiManager
              customers={customers}
              currentUser={currentUser}
            />
          )}
        </main>
      </div>

      {showAddForm && (
        <CustomerForm
          customer={null}
          customers={customers}
          onSave={handleAddCustomer}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {showUserManagement && (
        <UserManagement
          users={users}
          currentUser={currentUser}
          onAdd={addUser}
          onUpdate={updateUser}
          onDelete={deleteUser}
          onResetDefaults={resetToDefaults}
          onClose={() => setShowUserManagement(false)}
        />
      )}

      {showQuickLog && (
        <QuickLogModal
          customers={customers}
          currentUser={currentUser}
          onSave={addHistoryEntry}
          onClose={() => setShowQuickLog(false)}
        />
      )}

      {showCsvImporter && (
        <CsvImporter
          customers={customers}
          onUpdateSales={(id, data) => updateCustomer(id, data)}
          onClose={() => setShowCsvImporter(false)}
        />
      )}

      {showIndeed && (
        <IndeedIntegration
          customers={customers}
          onUpdateCustomer={updateCustomer}
          onClose={() => setShowIndeed(false)}
        />
      )}
    </div>
  )
}
