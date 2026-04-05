import { useState, useCallback } from 'react'

const STORAGE_KEY = 'crm_yomi_snapshots_v1'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}
function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// Get YYYY-MM for a given date offset
function getMonthStr(offsetMonths = 0) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMonths)
  return d.toISOString().slice(0, 7)
}

// Calculate actual sales for a given YYYY-MM from customer data
export function calcActual(customers, monthStr, assignedTo = null) {
  const list = assignedTo ? customers.filter(c => c.assignedTo === assignedTo) : customers
  return list.reduce((sum, c) => {
    if (c.status !== '成約') return sum
    const upd = c.updatedAt ? c.updatedAt.slice(0, 7) : ''
    if (upd === monthStr) return sum + (Number(c.dealAmount) || 0)
    return sum
  }, 0)
}

export function useYomiManager() {
  const [data, setData] = useState(load)
  // Working entries: { [customerId]: { yomiAmount, yomiRank, note } }
  const [workingEntries, setWorkingEntries] = useState({})
  const [isDirty, setIsDirty] = useState(false)

  const persist = useCallback((newData) => {
    save(newData)
    setData({ ...newData })
  }, [])

  // Get snapshots for a month
  const getSnapshots = useCallback((monthStr) => {
    return (load()[monthStr]?.snapshots || [])
  }, [])

  // Load working entries from latest snapshot of this month (or blank)
  const initWorkingEntries = useCallback((monthStr, customers, assignedTo = null) => {
    const snaps = load()[monthStr]?.snapshots || []
    const list = assignedTo ? customers.filter(c => c.assignedTo === assignedTo) : customers

    let map = {}
    if (snaps.length > 0) {
      const latest = snaps[snaps.length - 1]
      latest.entries.forEach(e => {
        map[e.customerId] = { yomiAmount: e.yomiAmount, yomiRank: e.yomiRank, note: e.note, juchuAmount: e.juchuAmount || '' }
      })
    } else {
      list.forEach(c => {
        if (c.status !== '失注') {
          map[c.id] = {
            yomiAmount: c.status !== '成約' ? (c.dealAmount ? String(c.dealAmount) : '') : '',
            yomiRank: c.forecast || '',
            note: '',
            juchuAmount: '',
          }
        }
      })
    }

    // repMonthlySales（受注金額）は常に顧客データから上書き（永続データが優先）
    list.forEach(c => {
      const rep = c.repMonthlySales?.[monthStr]
      if (map[c.id]) {
        map[c.id].juchuAmount = rep ? String(Math.round(rep / 10000)) : (map[c.id].juchuAmount || '')
      } else if (rep) {
        map[c.id] = { yomiAmount: '', yomiRank: '', note: '', juchuAmount: String(Math.round(rep / 10000)) }
      }
    })

    setWorkingEntries(map)
    setIsDirty(false)
  }, [])

  // Update a single entry
  const updateEntry = useCallback((customerId, field, value) => {
    setWorkingEntries(prev => ({
      ...prev,
      [customerId]: { ...(prev[customerId] || {}), [field]: value }
    }))
    setIsDirty(true)
  }, [])

  // Save current working entries as a new snapshot
  const saveSnapshot = useCallback((monthStr, customers, label = '') => {
    const prev = load()
    const monthData = prev[monthStr] || { snapshots: [] }
    const snaps = [...(monthData.snapshots || [])]

    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const weekNum = snaps.length + 1
    const snapLabel = label || `第${weekNum}週（${dateStr}）`

    // Build entries from workingEntries merged with customer info
    const entries = []
    customers.forEach(c => {
      const e = workingEntries[c.id]
      if (!e) return
      const amt = Number(e.yomiAmount) || 0
      const juchuAmt = Number(e.juchuAmount) || 0
      if (amt > 0 || e.note || juchuAmt > 0) {
        entries.push({
          customerId: c.id,
          companyName: c.companyName,
          assignedTo: c.assignedTo || '',
          status: c.status,
          yomiAmount: amt,
          yomiRank: e.yomiRank || '',
          note: e.note || '',
          juchuAmount: juchuAmt,
        })
      }
    })

    const totalYomi = entries.reduce((s, e) => s + e.yomiAmount, 0)

    snaps.push({ id: dateStr + '_' + weekNum, date: dateStr, label: snapLabel, entries, totalYomi })

    const updated = { ...prev, [monthStr]: { ...monthData, snapshots: snaps } }
    persist(updated)
    setIsDirty(false)
    return snapLabel
  }, [workingEntries, persist])

  // Delete a snapshot
  const deleteSnapshot = useCallback((monthStr, snapId) => {
    const prev = load()
    const monthData = prev[monthStr] || { snapshots: [] }
    const updated = {
      ...prev,
      [monthStr]: { ...monthData, snapshots: (monthData.snapshots || []).filter(s => s.id !== snapId) }
    }
    persist(updated)
  }, [persist])

  // Get variance data: first snapshot vs latest snapshot vs actual
  const getVariance = useCallback((monthStr, customers) => {
    const snaps = load()[monthStr]?.snapshots || []
    if (snaps.length === 0) return null

    const first = snaps[0]
    const latest = snaps[snaps.length - 1]

    // Build maps
    const firstMap = {}
    first.entries.forEach(e => { firstMap[e.customerId] = e })
    const latestMap = {}
    latest.entries.forEach(e => { latestMap[e.customerId] = e })

    // Actual: customers that are '成約' and updatedAt is in this month
    const actualMap = {}
    customers.forEach(c => {
      if (c.status === '成約') {
        const upd = c.updatedAt ? c.updatedAt.slice(0, 7) : ''
        if (upd === monthStr && (Number(c.dealAmount) || 0) > 0) {
          actualMap[c.id] = { customerId: c.id, companyName: c.companyName, assignedTo: c.assignedTo, actual: Number(c.dealAmount) }
        }
      }
    })

    return { first, latest, firstMap, latestMap, actualMap, snaps }
  }, [])

  return {
    workingEntries,
    isDirty,
    getSnapshots,
    initWorkingEntries,
    updateEntry,
    saveSnapshot,
    deleteSnapshot,
    getVariance,
  }
}
