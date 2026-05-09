import { useState, useEffect } from 'react'
import { getItems, createItem, deleteItem } from '../api/items'
import { useAuth } from '../context/AuthContext'
import '../App.css'
import './AdminPage.css'

const emptyForm = { title: '', description: '', price: '' }

export default function AdminPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    getItems()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await createItem({ ...form, price: parseFloat(form.price) || 0 })
      setForm(emptyForm)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este item?')) return
    try {
      await deleteItem(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="admin-page">
      <h1>Panel de administración</h1>
      <p className="admin-welcome">Bienvenido, {user?.username}</p>

      <section className="card admin-form">
        <h2>Nuevo item</h2>
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Título</label>
            <input name="title" value={form.title} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <input name="description" value={form.description} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Precio (S/.)</label>
            <input name="price" type="number" step="0.01" value={form.price} onChange={handleChange} required />
          </div>
          {error && <p className="error-msg" style={{ marginBottom: '1rem' }}>{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Crear item'}
          </button>
        </form>
      </section>

      <section className="admin-list">
        <h2>Items ({items.length})</h2>
        {loading ? (
          <p>Cargando...</p>
        ) : items.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>Sin items aún.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Descripción</th>
                <th>Precio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.title}</td>
                  <td>{item.description || '—'}</td>
                  <td>S/. {item.price.toFixed(2)}</td>
                  <td>
                    <button className="btn btn-danger" onClick={() => handleDelete(item.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
