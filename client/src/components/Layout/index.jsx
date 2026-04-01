import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { FiHome, FiHeart, FiSettings, FiMusic, FiBookOpen, FiBarChart2 } from 'react-icons/fi'
import LanguageSwitcher from './LanguageSwitcher'
import './Layout.css'

const navItems = [
  { to: '/', label: 'Início', icon: FiHome },
  { to: '/stories', label: 'Contos', icon: FiBookOpen },
  { to: '/songs', label: 'Músicas', icon: FiMusic },
  { to: '/favorites', label: 'Favoritos', icon: FiHeart },
  { to: '/report', label: 'Relatório', icon: FiBarChart2 },
  { to: '/settings', label: 'Ajustes', icon: FiSettings },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="layout">
      {/* Sidebar - Desktop */}
      <aside className="sidebar">
        <div className="sidebar__logo">3L</div>
        <nav className="sidebar__nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
              }
              end={item.to === '/'}
            >
              <span className="sidebar__link-icon">
                <item.icon />
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          <LanguageSwitcher />
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="layout__content">
        <Outlet />
      </main>

      {/* Bottom nav - Mobile */}
      <nav className="mobile-nav">
        <div className="mobile-lang-bar">
          <LanguageSwitcher compact />
        </div>
        <div className="mobile-nav__inner">
          {navItems.map((item) => {
            const isActive =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`mobile-nav__link ${isActive ? 'mobile-nav__link--active' : ''}`}
                end={item.to === '/'}
              >
                <span className="mobile-nav__link-icon">
                  <item.icon />
                </span>
                {item.label}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
