import { useState, useEffect } from 'react'
import { getItems } from '../api/items'
import '../../src/App.css'

export default function HomePage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getItems()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Cargando...</p>
  if (error) return <p className="error-msg">{error}</p>

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Bienvenido</h1>
      {items.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No hay items todavía.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {items.map((item) => (
            <div key={item.id} className="card">
              <h3>{item.title}</h3>
              {item.description && (
                <p style={{ marginTop: '.5rem', color: 'var(--color-text-muted)', fontSize: '.9rem' }}>
                  {item.description}
                </p>
              )}
              <p style={{ marginTop: '.75rem', fontWeight: 600 }}>S/. {item.price.toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
