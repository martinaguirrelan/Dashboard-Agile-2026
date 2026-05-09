import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const { isAdmin, user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar__brand">Mi App</Link>
      <div className="navbar__links">
        <Link to="/">Inicio</Link>
        {isAdmin ? (
          <>
            <Link to="/admin">Admin</Link>
            <span className="navbar__user">{user?.username}</span>
            <button className="navbar__logout" onClick={handleLogout}>Salir</button>
          </>
        ) : (
          <Link to="/login">Ingresar</Link>
        )}
      </div>
    </nav>
  )
}
