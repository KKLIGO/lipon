import React, { useState, useEffect } from 'react'
import { ASSIGNED_TO_OPTIONS, INDUSTRY_OPTIONS } from '../data/sampleData'
import BusinessCardScanner from './BusinessCardScanner'
import { searchCompanyInfo } from '../hooks/useCompanySearch'

const STATUSES = ['リード', '商談中', '提案済', '成約', '失注']
const INDUSTRIES = INDUSTRY_OPTIONS
const FISCAL_MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const FORECAST_OPTIONS = [
  { value: 'A', label: 'A  ほぼ確実', color: 'bg-green-600' },
  { value: 'B', label: 'B  見込みあり', color: 'bg-blue-500' },
  { value: 'C', label: 'C  可能性あり', color: 'bg-yellow-500' },
  { value: 'D', label: 'D  要確認', color: 'bg-gray-400' },
]

const RELATIONSHIP_OPTIONS = [
  { value: '☀️', label: '☀️ 良好' },
  { value: '☁️', label: '☁️ 普通' },
  { value: '☔️', label: '☔️ 不調' },
]

const EMPTY_FORM = {
  companyName: '', contactName: '', contactTitle: '', email: '',
  phone: '', mobilePhone: '', lineId: '',
  status: 'リード', industry: '', assignedTo: '', memo: '',
  dealAmount: '', forecast: '', relationship: '',
  referralSource: '',
  lastPostingDate: '',
  // 会社基本情報
  website: '', recruitUrl: '', address: '', postalCode: '',
  fiscalYearEnd: '', founded: '', capital: '', employees: '',
  corporateNumber: '',
  // Indeed連携
  indeedUrl: '',
}

export default function CustomerForm({ customer, onSave, onCancel, customers = [] }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [showScanner, setShowScanner] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState(null)
  const [activeTab, setActiveTab] = useState('basic')

  useEffect(() => {
    if (customer) {
      setForm({
        companyName: customer.companyName || '',
        contactName: customer.contactName || '',
        contactTitle: customer.contactTitle || '',
        email: customer.email || '',
        phone: customer.phone || '',
        mobilePhone: customer.mobilePhone || '',
        lineId: customer.lineId || '',
        status: customer.status || 'リード',
        industry: customer.industry || '',
        assignedTo: customer.assignedTo || '',
        memo: customer.memo || '',
        dealAmount: customer.dealAmount != null ? String(customer.dealAmount) : '',
        forecast: customer.forecast || '',
        relationship: customer.relationship || '',
        referralSource: customer.referralSource || '',
        lastPostingDate: customer.lastPostingDate || '',
        website: customer.website || '',
        recruitUrl: customer.recruitUrl || '',
        address: customer.address || '',
        postalCode: customer.postalCode || '',
        fiscalYearEnd: customer.fiscalYearEnd || '',
        founded: customer.founded || '',
        capital: customer.capital || '',
        employees: customer.employees || '',
        corporateNumber: customer.corporateNumber || '',
        indeedUrl: customer.indeedUrl || '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
    setSearchResult(null)
  }, [customer])

  function validate() {
    const e = {}
    if (!form.companyName.trim()) e.companyName = '会社名は必須です'
    if (!form.contactName.trim()) e.contactName = '担当者名は必須です'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = '有効なメールアドレスを入力してください'
    }
    return e
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    onSave({
      ...form,
      dealAmount: form.dealAmount !== '' ? Number(form.dealAmount) : null,
    })
  }

  function set(field) {
    return e => {
      setForm(f => ({ ...f, [field]: e.target.value }))
      if (errors[field]) setErrors(err => { const n = { ...err }; delete n[field]; return n })
    }
  }

  function handleScanApply(data) {
    setForm(f => ({
      ...f,
      companyName: data.companyName || f.companyName,
      contactName: data.contactName || f.contactName,
      contactTitle: data.contactTitle || f.contactTitle,
      email: data.email || f.email,
      phone: data.phone || f.phone,
    }))
    setShowScanner(false)
    setErrors({})
  }

  async function handleAutoSearch() {
    if (!form.companyName.trim()) {
      setErrors(e => ({ ...e, companyName: '会社名を入力してから検索してください' }))
      return
    }
    setSearching(true)
    setSearchResult(null)
    try {
      const result = await searchCompanyInfo(form.companyName)
      setSearchResult(result)
      if (result?.found) setActiveTab('company')
    } finally {
      setSearching(false)
    }
  }

  function applySearchResult() {
    if (!searchResult?.found) return
    setForm(f => ({
      ...f,
      website: searchResult.website || f.website,
      address: searchResult.address || f.address,
      postalCode: searchResult.postalCode || f.postalCode,
      founded: searchResult.founded || f.founded,
      capital: searchResult.capital || f.capital,
      employees: searchResult.employees || f.employees,
      fiscalYearEnd: searchResult.fiscalYearEnd || f.fiscalYearEnd,
      industry: searchResult.industry
        ? (INDUSTRIES.find(i => searchResult.industry.includes(i.split('・')[0])) || f.industry)
        : f.industry,
    }))
    setSearchResult(null)
  }

  const title = customer ? '顧客情報を編集' : '新規顧客を追加'

  return (
    <>
    {showScanner && (
      <BusinessCardScanner onApply={handleScanApply} onClose={() => setShowScanner(false)} />
    )}
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-2">
            {!customer && (
              <button type="button" onClick={() => setShowScanner(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">
                📇 名刺から読み込む
              </button>
            )}
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {[['basic', '👤 基本情報'], ['company', '🏢 会社情報']].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* ===== TAB: 基本情報 ===== */}
          {activeTab === 'basic' && (
            <>
              {/* Company name + Auto search */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    会社名 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input type="text" value={form.companyName} onChange={set('companyName')}
                      placeholder="株式会社〇〇"
                      className={`form-input flex-1 ${errors.companyName ? 'border-red-400' : ''}`} />
                    <button type="button" onClick={handleAutoSearch} disabled={searching}
                      title="会社情報をWebから自動取得"
                      className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm hover:bg-green-100 transition-colors disabled:opacity-50 whitespace-nowrap flex-shrink-0">
                      {searching ? '🔍…' : '🌐 自動取得'}
                    </button>
                  </div>
                  {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">業種</label>
                  <select value={form.industry} onChange={set('industry')} className="form-select">
                    <option value="">選択してください</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              {/* Web search result banner */}
              {searchResult && (
                <div className={`rounded-lg border p-4 text-sm ${searchResult.found ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  {searchResult.found ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-green-800">
                            ✅ Wikipedia で「{searchResult.pageTitle}」が見つかりました
                          </p>
                          <div className="mt-2 space-y-1 text-xs text-green-700">
                            {searchResult.address && <p>📍 {searchResult.address}</p>}
                            {searchResult.website && <p>🌐 {searchResult.website}</p>}
                            {searchResult.fiscalYearEnd && <p>📅 決算期：{searchResult.fiscalYearEnd}</p>}
                            {searchResult.founded && <p>🏛 設立：{searchResult.founded}</p>}
                            {searchResult.employees && <p>👥 従業員：{searchResult.employees}</p>}
                            {searchResult.capital && <p>💴 資本金：{searchResult.capital}</p>}
                          </div>
                        </div>
                        <button type="button" onClick={applySearchResult}
                          className="flex-shrink-0 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                          反映する
                        </button>
                      </div>
                      {searchResult.pageUrl && (
                        <a href={searchResult.pageUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-green-600 hover:underline mt-2 inline-block">
                          Wikipediaで確認 →
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-yellow-800">
                      ⚠️ Wikipediaで会社情報が見つかりませんでした。手動で入力してください。
                      {searchResult.error && <span className="block text-xs mt-1">{searchResult.error}</span>}
                    </p>
                  )}
                  <button type="button" onClick={() => setSearchResult(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 mt-2 block">閉じる</button>
                </div>
              )}

              {/* Contact name + title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    担当者名 <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={form.contactName} onChange={set('contactName')}
                    placeholder="山田 太郎"
                    className={`form-input ${errors.contactName ? 'border-red-400' : ''}`} />
                  {errors.contactName && <p className="text-red-500 text-xs mt-1">{errors.contactName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">役職</label>
                  <input type="text" value={form.contactTitle} onChange={set('contactTitle')}
                    placeholder="営業部長" className="form-input" />
                </div>
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                  <input type="email" value={form.email} onChange={set('email')}
                    placeholder="yamada@example.com"
                    className={`form-input ${errors.email ? 'border-red-400' : ''}`} />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">📞 電話番号</label>
                  <input type="tel" value={form.phone} onChange={set('phone')}
                    placeholder="03-1234-5678" className="form-input" />
                </div>
              </div>

              {/* Mobile + LINE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">📱 携帯番号</label>
                  <input type="tel" value={form.mobilePhone} onChange={set('mobilePhone')}
                    placeholder="090-1234-5678" className="form-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    💬 LINE ID
                    <span className="text-xs text-gray-400 font-normal ml-1">（トーク取込用）</span>
                  </label>
                  <input type="text" value={form.lineId} onChange={set('lineId')}
                    placeholder="yamada_line など" className="form-input" />
                </div>
              </div>

              {/* Assigned to */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">担当営業</label>
                <select value={form.assignedTo} onChange={set('assignedTo')} className="form-select">
                  <option value="">選択してください</option>
                  {ASSIGNED_TO_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* Referral source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  🤝 きっかけ / ご紹介元
                  <span className="text-xs text-gray-400 font-normal ml-1">（顧客名 or 自由記述）</span>
                </label>
                <input
                  type="text"
                  list="referral-datalist"
                  value={form.referralSource}
                  onChange={set('referralSource')}
                  placeholder="紹介会社名 or 展示会・SNS など"
                  className="form-input"
                />
                <datalist id="referral-datalist">
                  {customers
                    .filter(c => c.companyName && c.id !== customer?.id)
                    .map(c => (
                      <option key={c.id} value={c.companyName} />
                    ))}
                </datalist>
              </div>

              {/* Last posting date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📅 最終掲載日
                  <span className="text-xs text-gray-400 font-normal ml-1">（Indeed等 最後に求人掲載した日）</span>
                </label>
                <input type="date" value={form.lastPostingDate} onChange={set('lastPostingDate')}
                  className="form-input" />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                <div className="flex gap-2 flex-wrap">
                  {STATUSES.map(s => (
                    <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        form.status === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                      }`}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Relationship */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">顧客関係性</label>
                <div className="flex gap-3">
                  {RELATIONSHIP_OPTIONS.map(({ value, label }) => (
                    <button key={value} type="button"
                      onClick={() => setForm(f => ({ ...f, relationship: f.relationship === value ? '' : value }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                        form.relationship === value
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Deal amount + Forecast (ヨミ) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    💰 売上金額（万円）
                  </label>
                  <input type="number" value={form.dealAmount} onChange={set('dealAmount')}
                    placeholder="500" min="0" className="form-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📊 ヨミ（受注確度）
                  </label>
                  <div className="flex gap-2">
                    {FORECAST_OPTIONS.map(({ value, label, color }) => (
                      <button key={value} type="button"
                        onClick={() => setForm(f => ({ ...f, forecast: f.forecast === value ? '' : value }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                          form.forecast === value
                            ? `${color} text-white border-transparent`
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                        }`}>
                        {value}
                      </button>
                    ))}
                  </div>
                  {form.forecast && (
                    <p className="text-xs text-gray-500 mt-1">
                      {FORECAST_OPTIONS.find(f => f.value === form.forecast)?.label}
                    </p>
                  )}
                </div>
              </div>

              {/* Memo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
                <textarea value={form.memo} onChange={set('memo')} rows={3}
                  placeholder="商談の背景、特記事項など..." className="form-input resize-none" />
              </div>
            </>
          )}

          {/* ===== TAB: 会社情報 ===== */}
          {activeTab === 'company' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">会社の基本情報を入力してください（任意）</p>
                <button type="button" onClick={handleAutoSearch} disabled={searching}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm hover:bg-green-100 disabled:opacity-50">
                  {searching ? '⏳ 検索中...' : '🌐 Webから自動取得'}
                </button>
              </div>

              {searchResult?.found && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start justify-between gap-3">
                  <p className="text-sm text-green-800">✅ 「{searchResult.pageTitle}」の情報が取得されました</p>
                  <button type="button" onClick={applySearchResult}
                    className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium flex-shrink-0">
                    フォームに反映
                  </button>
                </div>
              )}

              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🌐 会社HP</label>
                <input type="url" value={form.website} onChange={set('website')}
                  placeholder="https://www.example.co.jp" className="form-input" />
              </div>

              {/* Recruit URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📋 採用HP <span className="text-xs text-blue-500 font-normal ml-1">更新を自動検知</span></label>
                <input type="url" value={form.recruitUrl || ''} onChange={set('recruitUrl')}
                  placeholder="https://recruit.example.co.jp" className="form-input" />
              </div>

              {/* Address */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
                  <input type="text" value={form.postalCode} onChange={set('postalCode')}
                    placeholder="100-0001" className="form-input" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">📍 住所（本社所在地）</label>
                  <input type="text" value={form.address} onChange={set('address')}
                    placeholder="東京都千代田区〇〇1-2-3" className="form-input" />
                </div>
              </div>

              {/* Fiscal year + Founded */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">📅 決算期</label>
                  <select value={form.fiscalYearEnd} onChange={set('fiscalYearEnd')} className="form-select">
                    <option value="">選択してください</option>
                    {FISCAL_MONTHS.map(m => <option key={m} value={m}>{m}末</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">🏛 設立年</label>
                  <input type="text" value={form.founded} onChange={set('founded')}
                    placeholder="2005年" className="form-input" />
                </div>
              </div>

              {/* Capital + Employees */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">💴 資本金</label>
                  <input type="text" value={form.capital} onChange={set('capital')}
                    placeholder="1億円" className="form-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">👥 従業員数</label>
                  <input type="text" value={form.employees} onChange={set('employees')}
                    placeholder="500名" className="form-input" />
                </div>
              </div>

              {/* Corporate number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  🔢 法人番号
                  <span className="text-xs text-gray-400 font-normal ml-1">（13桁）</span>
                </label>
                <div className="flex gap-2">
                  <input type="text" value={form.corporateNumber} onChange={e => {
                    const v = e.target.value.replace(/[^\d]/g, '').slice(0, 13)
                    setForm(f => ({ ...f, corporateNumber: v }))
                  }}
                    placeholder="1234567890123" maxLength={13}
                    className={`form-input flex-1 font-mono ${form.corporateNumber && form.corporateNumber.length !== 13 ? 'border-yellow-400' : ''}`} />
                  <button type="button"
                    onClick={() => window.open(`https://www.houjin-bangou.nta.go.jp/search/addr/?number=${form.corporateNumber || ''}&name=${encodeURIComponent(form.companyName || '')}`, '_blank')}
                    title="国税庁法人番号公表サイトで検索"
                    className="px-3 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm hover:bg-orange-100 transition-colors whitespace-nowrap flex-shrink-0">
                    🏛 NTAで検索
                  </button>
                </div>
                {form.corporateNumber && form.corporateNumber.length !== 13 && (
                  <p className="text-xs text-yellow-600 mt-1">法人番号は13桁です（現在{form.corporateNumber.length}桁）</p>
                )}
                {form.corporateNumber?.length === 13 && (
                  <a href={`https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=${form.corporateNumber}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                    国税庁サイトで確認 →
                  </a>
                )}
              </div>

              {/* Indeed URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  🔵 Indeed 企業ページURL
                  <span className="text-xs text-gray-400 font-normal ml-1">（採用主ページ）</span>
                </label>
                <div className="flex gap-2">
                  <input type="url" value={form.indeedUrl} onChange={set('indeedUrl')}
                    placeholder="https://jp.indeed.com/cmp/会社名スラッグ"
                    className="form-input flex-1" />
                  <button type="button"
                    onClick={() => window.open(`https://jp.indeed.com/jobs?q=${encodeURIComponent(form.companyName || '')}&l=`, '_blank')}
                    title="Indeed で会社名検索"
                    className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm hover:bg-blue-100 transition-colors whitespace-nowrap flex-shrink-0">
                    🔍 Indeed検索
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Indeed企業ページURLを貼り付けるか、右ボタンでIndeed検索して確認してください
                </p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onCancel} className="btn-secondary">キャンセル</button>
            <button type="submit" className="btn-primary">💾 保存する</button>
          </div>
        </form>
      </div>
    </div>
    </>
  )
}
