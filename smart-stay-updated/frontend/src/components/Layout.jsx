import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Building2, Users, Wallet, BarChart3, LogOut, Menu, X, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import FeedbackWidget from './FeedbackWidget'

const NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard',  color: 'text-blue-500' },
  { to: '/rooms',    icon: Building2,       label: 'Rooms',      color: 'text-violet-500' },
  { to: '/tenants',  icon: Users,           label: 'Tenants',    color: 'text-emerald-500' },
  { to: '/payments', icon: Wallet,          label: 'Payments',   color: 'text-amber-500' },
  { to: '/reports',  icon: BarChart3,       label: 'Reports',    color: 'text-rose-500' },
]

function SidebarContent({ onClose }) {
  const navigate  = useNavigate()
  const hostelName = localStorage.getItem('hostel_name') || 'My Hostel'

  const logout = () => { localStorage.clear(); navigate('/login') }

  return (
    <div className="flex flex-col h-full w-64 bg-white border-r border-slate-100">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-white text-lg">🏠</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-sm leading-tight">Smart-Stay</p>
            <p className="text-slate-400 text-xs truncate">{hostelName}</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 px-3 pb-2">Menu</p>
        {NAV.map(({ to, icon: Icon, label, color }) => (
          <NavLink
            key={to} to={to} end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="flex items-center gap-3">
                  <Icon size={17} className={isActive ? 'text-blue-600' : color} />
                  {label}
                </span>
                {isActive && <ChevronRight size={14} className="text-blue-400" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-slate-100">
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all">
          <LogOut size={17} /> Sign out
        </button>
      </div>
    </div>
  )
}

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // Page title from path
  const pageLabel = NAV.find(n => n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to))?.label || ''

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative z-50">
            <SidebarContent onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar — mobile only */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3.5 bg-white border-b border-slate-100 shadow-sm">
          <button onClick={() => setDrawerOpen(true)}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs">🏠</span>
            </div>
            <span className="font-bold text-slate-900 text-sm">Smart-Stay</span>
          </div>
          {pageLabel && <span className="ml-auto text-xs text-slate-400 font-medium">{pageLabel}</span>}
        </div>

        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-6">
          <Outlet />
        </main>
        <FeedbackWidget />
      </div>
    </div>
  )
}
