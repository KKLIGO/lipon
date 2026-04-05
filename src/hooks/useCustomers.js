import { useState, useCallback } from 'react'
import { sampleCustomers } from '../data/sampleData'

const STORAGE_KEY = 'crm_customers_v2'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleCustomers))
  return sampleCustomers
}

export function useCustomers() {
  const [customers, setCustomers] = useState(() => loadFromStorage())

  const persist = useCallback((data) => {
    setCustomers(data)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [])

  const addCustomer = useCallback((data) => {
    const now = new Date().toISOString()
    const customer = { ...data, id: generateId(), history: [], createdAt: now, updatedAt: now }
    persist([customer, ...customers])
    return customer
  }, [customers, persist])

  const updateCustomer = useCallback((id, data) => {
    const now = new Date().toISOString()
    persist(customers.map(c => c.id === id ? { ...c, ...data, id, updatedAt: now } : c))
  }, [customers, persist])

  const deleteCustomer = useCallback((id) => {
    persist(customers.filter(c => c.id !== id))
  }, [customers, persist])

  const bulkDeleteCustomers = useCallback((ids) => {
    const set = new Set(ids)
    persist(customers.filter(c => !set.has(c.id)))
  }, [customers, persist])

  const bulkUpdateStatus = useCallback((ids, status) => {
    const set = new Set(ids)
    const now = new Date().toISOString()
    persist(customers.map(c => set.has(c.id) ? { ...c, status, updatedAt: now } : c))
  }, [customers, persist])

  const bulkUpdateAssignedTo = useCallback((ids, assignedTo) => {
    const set = new Set(ids)
    const now = new Date().toISOString()
    persist(customers.map(c => set.has(c.id) ? { ...c, assignedTo, updatedAt: now } : c))
  }, [customers, persist])

  const addHistoryEntry = useCallback((customerId, entry) => {
    const now = new Date().toISOString()
    const histEntry = { ...entry, id: generateId(), createdAt: now }
    persist(customers.map(c => {
      if (c.id !== customerId) return c
      return { ...c, history: [histEntry, ...(c.history || [])], updatedAt: now }
    }))
    return histEntry
  }, [customers, persist])

  const setNextAction = useCallback((customerId, action) => {
    const now = new Date().toISOString()
    persist(customers.map(c => c.id === customerId ? { ...c, nextAction: action, updatedAt: now } : c))
  }, [customers, persist])

  const clearNextAction = useCallback((customerId) => {
    const now = new Date().toISOString()
    persist(customers.map(c => c.id === customerId ? { ...c, nextAction: null, updatedAt: now } : c))
  }, [customers, persist])

  const getCustomer = useCallback((id) => {
    return customers.find(c => c.id === id)
  }, [customers])

  // 受注金額（repMonthlySales）を一括更新: repSalesMap = {customerId: amountInYen or 0}
  const updateRepMonthlySales = useCallback((monthStr, repSalesMap) => {
    persist(customers.map(c => {
      if (!(c.id in repSalesMap)) return c
      const amount = repSalesMap[c.id]
      const current = c.repMonthlySales || {}
      if (!amount) {
        const updated = { ...current }
        delete updated[monthStr]
        return { ...c, repMonthlySales: updated }
      }
      return { ...c, repMonthlySales: { ...current, [monthStr]: amount } }
    }))
  }, [customers, persist])

  return {
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
    updateRepMonthlySales,
  }
}
