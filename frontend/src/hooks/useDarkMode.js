import { useState, useEffect, useCallback } from 'react'

/**
 * Hook para manejar el tema oscuro
 * Persiste la preferencia en localStorage y aplica clase a document
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('dashboard-dark-mode')
      return saved ? JSON.parse(saved) : false
    } catch {
      return false
    }
  })

  // Aplicar clase al documento cuando cambia el estado
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    try {
      localStorage.setItem('dashboard-dark-mode', JSON.stringify(isDark))
    } catch {}
  }, [isDark])

  const toggle = useCallback(() => setIsDark(prev => !prev), [])

  return [isDark, toggle]
}
