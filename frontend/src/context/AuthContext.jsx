import { createContext, useContext, useState, useCallback } from 'react'
import { login as apiLogin } from '../api/auth'

const AuthContext = createContext(null)

const TOKEN_KEY = 'admin_token'
const USER_KEY = 'admin_user'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  })

  const login = useCallback(async (username, password) => {
    const data = await apiLogin(username, password)
    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify({ username: data.username }))
    setToken(data.access_token)
    setUser({ username: data.username })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, isAdmin: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
