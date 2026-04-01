import { useState, useCallback } from 'react'

const STORAGE_KEY = 'crm_hp_snapshots_v1'
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours minimum between auto-checks

function loadSnapshots() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}
function saveSnapshots(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// Simple hash of text content
function hashText(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0
  }
  return (h >>> 0).toString(36)
}

// Fetch page text via allorigins proxy, extract meaningful text
async function fetchPageHash(url) {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&timestamp=${Date.now()}`
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const html = json.contents || ''

  // Parse HTML and extract visible text (strip scripts/styles)
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  // Remove script, style, nav, footer elements
  doc.querySelectorAll('script,style,noscript,nav,footer,header,iframe').forEach(el => el.remove())
  // Get text from body
  const text = (doc.body?.innerText || doc.body?.textContent || '').replace(/\s+/g, ' ').trim()
  return { hash: hashText(text), length: text.length }
}

export function useHPMonitor() {
  const [snapshots, setSnapshots] = useState(loadSnapshots)
  const [checking, setChecking] = useState({}) // { [customerId_type]: true }
  const [errors, setErrors] = useState({})

  const persist = useCallback((data) => {
    saveSnapshots(data)
    setSnapshots({ ...data })
  }, [])

  // Check a single URL for a customer
  const checkUrl = useCallback(async (customerId, type, url) => {
    const key = `${customerId}_${type}`
    if (!url) return
    setChecking(c => ({ ...c, [key]: true }))
    setErrors(e => { const n = { ...e }; delete n[key]; return n })

    try {
      const { hash, length } = await fetchPageHash(url)
      const prev = loadSnapshots()
      const entry = prev[customerId] || {}
      const prevHash = entry[`${type}Hash`]
      const now = new Date().toISOString()

      const changed = prevHash !== undefined && prevHash !== hash
      const isNew = prevHash === undefined

      const updated = {
        ...prev,
        [customerId]: {
          ...entry,
          [`${type}Hash`]: hash,
          [`${type}Length`]: length,
          [`${type}CheckedAt`]: now,
          [`${type}Changed`]: changed ? now : (isNew ? null : entry[`${type}Changed`]),
          [`${type}ChangedPrev`]: changed ? prevHash : entry[`${type}ChangedPrev`],
        },
      }
      persist(updated)
    } catch (e) {
      setErrors(prev => ({ ...prev, [key]: e.message }))
    } finally {
      setChecking(c => { const n = { ...c }; delete n[key]; return n })
    }
  }, [persist])

  // Dismiss (mark as read) a change
  const dismissChange = useCallback((customerId, type) => {
    const prev = loadSnapshots()
    const entry = prev[customerId] || {}
    const updated = {
      ...prev,
      [customerId]: {
        ...entry,
        [`${type}Changed`]: null,
        [`${type}ChangedPrev`]: null,
      },
    }
    persist(updated)
  }, [persist])

  // Dismiss all changes for a customer
  const dismissAll = useCallback((customerId) => {
    const prev = loadSnapshots()
    const entry = prev[customerId] || {}
    const updated = {
      ...prev,
      [customerId]: {
        ...entry,
        websiteChanged: null, websiteChangedPrev: null,
        recruitChanged: null, recruitChangedPrev: null,
      },
    }
    persist(updated)
  }, [persist])

  // Check all customers that have URLs and haven't been checked recently
  const checkAll = useCallback(async (customers, force = false) => {
    const prev = loadSnapshots()
    const now = Date.now()
    const targets = []

    customers.forEach(c => {
      if (c.website) {
        const lastCheck = prev[c.id]?.websiteCheckedAt
        if (force || !lastCheck || now - new Date(lastCheck).getTime() > RECHECK_INTERVAL_MS) {
          targets.push({ customerId: c.id, type: 'website', url: c.website })
        }
      }
      if (c.recruitUrl) {
        const lastCheck = prev[c.id]?.recruitCheckedAt
        if (force || !lastCheck || now - new Date(lastCheck).getTime() > RECHECK_INTERVAL_MS) {
          targets.push({ customerId: c.id, type: 'recruit', url: c.recruitUrl })
        }
      }
    })

    // Check concurrently in batches of 3
    for (let i = 0; i < targets.length; i += 3) {
      const batch = targets.slice(i, i + 3)
      await Promise.allSettled(batch.map(t => checkUrl(t.customerId, t.type, t.url)))
    }
  }, [checkUrl])

  // Get changed customers list
  const getChangedCustomers = useCallback((customers) => {
    const snaps = loadSnapshots()
    return customers
      .map(c => {
        const s = snaps[c.id] || {}
        const changes = []
        if (s.websiteChanged) changes.push({ type: 'website', label: '会社HP', changedAt: s.websiteChanged, url: c.website })
        if (s.recruitChanged) changes.push({ type: 'recruit', label: '採用HP', changedAt: s.recruitChanged, url: c.recruitUrl })
        return changes.length > 0 ? { ...c, hpChanges: changes } : null
      })
      .filter(Boolean)
  }, [])

  // Get snapshot info for a customer
  const getSnapshot = useCallback((customerId) => {
    return loadSnapshots()[customerId] || {}
  }, [])

  // Count total unchecked changes
  const changedCount = Object.values(snapshots).reduce((n, s) => {
    return n + (s.websiteChanged ? 1 : 0) + (s.recruitChanged ? 1 : 0)
  }, 0)

  return {
    snapshots,
    checking,
    errors,
    changedCount,
    checkUrl,
    checkAll,
    dismissChange,
    dismissAll,
    getChangedCustomers,
    getSnapshot,
  }
}
