import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Home, Building2, Users, CreditCard, BarChart3, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

const nav = [
  { to: '/',         icon: Home,        label: 'Dashboard' },
  { to: '/rooms',    icon: Building2,   label: 'Rooms' },
  { to: '/tenants',  icon: Users,       label: 'Tenants' },
  { to: '/payments', icon: CreditCard,  label: 'Payments' },
  { to: '/reports',  icon: BarChart3,   label: 'Reports' },
]

export default function Layout() {
  const navigate = useNavigate()
  const hostelName = localStorage.getItem('hostel_name') || 'My Hostel'
  const [open, setOpen] = useState(false)

  const logout = () => {
    localStorage.clear()
    navigate('/login')
  }

  const Sidebar = ({ mobile }) => (
    <div className={`flex flex-col h-full bg-indigo-700 text-white ${mobile ? 'w-64' : 'w-64'}`}>
      <div className="p-5 border-b border-indigo-600">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏠</span>
          <div>
            <p className="font-bold text-lg leading-tight">Smart-Stay</p>
            <p className="text-indigo-200 text-xs truncate">{hostelName}</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to} to={to} end={to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
               ${isActive ? 'bg-white text-indigo-700 shadow' : 'text-indigo-100 hover:bg-indigo-600'}`
            }
          >
            <Icon size={18} /> {label}
          </NavLink>
        ))}
      </nav>
      <button onClick={logout}
        className="flex items-center gap-3 px-8 py-4 text-indigo-200 hover:text-white hover:bg-indigo-600 text-sm transition-all">
        <LogOut size={18} /> Logout
      </button>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-50"><Sidebar mobile /></div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm">
          <button onClick={() => setOpen(true)}><Menu size={22} className="text-indigo-700" /></button>
          <span className="font-bold text-indigo-700">🏠 Smart-Stay</span>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
