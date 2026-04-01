import { useState, useEffect } from 'react'

const USERS_KEY = 'crm_users_v1'
const SESSION_KEY = 'crm_session_v1'

// Simple hash (client-side demo — not for production use)
function hashPwd(pwd) {
  const s = pwd + '_crm_ligo'
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0
  }
  return (h >>> 0).toString(36)
}

const DEFAULT_USERS = [
  { id: 'admin',    displayName: '管理者（長妻）', username: 'admin',    passwordHash: hashPwd('ligo2026'),  role: 'admin', assignedTo: '長妻 潤' },
  { id: 'toyota',   displayName: '豊田 剛史',     username: 'toyota',   passwordHash: hashPwd('toyota'),    role: 'user',  assignedTo: '豊田 剛史' },
  { id: 'kimura',   displayName: '木村 亮介',     username: 'kimura',   passwordHash: hashPwd('kimura'),    role: 'user',  assignedTo: '木村 亮介' },
  { id: 'kataoka',  displayName: '片岡 仙充',     username: 'kataoka',  passwordHash: hashPwd('kataoka'),   role: 'user',  assignedTo: '片岡 仙充' },
  { id: 'nagatsuma',displayName: '長妻 潤',       username: 'nagatsuma',passwordHash: hashPwd('nagatsuma'), role: 'user',  assignedTo: '長妻 潤' },
  { id: 'okada',    displayName: '岡田 明日香',   username: 'okada',    passwordHash: hashPwd('okada'),     role: 'user',  assignedTo: '岡田 明日香' },
  { id: 'kodama',   displayName: '小玉 一華',     username: 'kodama',   passwordHash: hashPwd('kodama'),    role: 'user',  assignedTo: '小玉 一華' },
  { id: 'aima',     displayName: '相間 雄仁',     username: 'aima',     passwordHash: hashPwd('aima'),      role: 'user',  assignedTo: '相間 雄仁' },
]

function loadUsers() {
  try {
    const stored = localStorage.getItem(USERS_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return DEFAULT_USERS
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function loadSession() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

function saveSession(user) {
  if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
  else sessionStorage.removeItem(SESSION_KEY)
}

export function useAuth() {
  const [users, setUsers] = useState(loadUsers)
  const [currentUser, setCurrentUser] = useState(loadSession)

  // Initialize default users if none stored
  useEffect(() => {
    if (!localStorage.getItem(USERS_KEY)) saveUsers(DEFAULT_USERS)
  }, [])

  function login(username, password) {
    const user = users.find(u => u.username === username && u.passwordHash === hashPwd(password))
    if (!user) return { ok: false, error: 'IDまたはパスワードが違います' }
    const session = { id: user.id, displayName: user.displayName, username: user.username, role: user.role, assignedTo: user.assignedTo }
    setCurrentUser(session)
    saveSession(session)
    return { ok: true }
  }

  function logout() {
    setCurrentUser(null)
    saveSession(null)
  }

  function addUser(data) {
    const newUser = {
      id: crypto.randomUUID(),
      displayName: data.displayName,
      username: data.username,
      passwordHash: hashPwd(data.password),
      role: data.role || 'user',
      assignedTo: data.assignedTo || null,
    }
    const updated = [...users, newUser]
    setUsers(updated)
    saveUsers(updated)
  }

  function updateUser(id, data) {
    const updated = users.map(u => u.id === id ? {
      ...u,
      displayName: data.displayName ?? u.displayName,
      username: data.username ?? u.username,
      passwordHash: data.password ? hashPwd(data.password) : u.passwordHash,
      role: data.role ?? u.role,
      assignedTo: data.assignedTo !== undefined ? data.assignedTo : u.assignedTo,
    } : u)
    setUsers(updated)
    saveUsers(updated)
    // Update session if editing self
    if (currentUser?.id === id) {
      const me = updated.find(u => u.id === id)
      const session = { id: me.id, displayName: me.displayName, username: me.username, role: me.role, assignedTo: me.assignedTo }
      setCurrentUser(session)
      saveSession(session)
    }
  }

  function deleteUser(id) {
    const updated = users.filter(u => u.id !== id)
    setUsers(updated)
    saveUsers(updated)
  }

  function resetToDefaults() {
    saveUsers(DEFAULT_USERS)
    setUsers(DEFAULT_USERS)
  }

  return { currentUser, users, login, logout, addUser, updateUser, deleteUser, resetToDefaults }
}
