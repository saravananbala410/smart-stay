import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, BedDouble, Users, WalletCards, BarChart3, LogOut, Building2 } from 'lucide-react'

const NAV = [
  { to: '/',         icon: LayoutDashboard,     label: 'Home',     desktop: 'Overview' },
  { to: '/rooms',    icon: BedDouble,           label: 'Rooms',    desktop: 'Rooms & beds' },
  { to: '/tenants',  icon: Users,               label: 'Tenants',  desktop: 'Tenants' },
  { to: '/payments', icon: WalletCards,         label: 'Payments', desktop: 'Bills & payments' },
  { to: '/reports',  icon: BarChart3, label: 'Reports',  desktop: 'Reports' },
]

const activeFor = (pathname, to) => to === '/' ? pathname === '/' : pathname.startsWith(to)

function DesktopSidebar() {
  const navigate = useNavigate()
  const hostelName = localStorage.getItem('hostel_name') || 'My Hostel'

  const logout = () => {
    localStorage.clear()
    navigate('/login')
  }

  return (
    <aside className="hidden md:flex w-[272px] flex-shrink-0 flex-col bg-[#073c34] text-white">
      <div className="px-6 pt-7 pb-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f0b35a] text-[#073c34] shadow-lg shadow-black/10">
            <Building2 size={21} strokeWidth={2.4}/>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200/70">Smart Stay</p>
            <p className="truncate text-[15px] font-bold text-white">{hostelName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4" aria-label="Main navigation">
        {NAV.map(({ to, icon: Icon, desktop }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-all ${
              isActive ? 'bg-white text-[#073c34] shadow-sm' : 'text-emerald-50/70 hover:bg-white/10 hover:text-white'
            }`}>
            <Icon size={19} strokeWidth={2}/>
            <span>{desktop}</span>
          </NavLink>
        ))}
      </nav>

      <div className="m-4 rounded-2xl bg-white/10 p-3">
        <p className="px-2 pb-2 text-[11px] leading-4 text-emerald-100/60">Secure admin workspace</p>
        <button onClick={logout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-emerald-50/80 hover:bg-white/10 hover:text-white">
          <LogOut size={18}/> Sign out
        </button>
      </div>
    </aside>
  )
}

function MobileHeader() {
  const location = useLocation()
  const hostelName = localStorage.getItem('hostel_name') || 'Smart Stay'
  const current = NAV.find(item => activeFor(location.pathname, item.to))
  return (
    <header className="flex min-h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur md:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-[#073c34] text-[#f0b35a]">
          <Building2 size={17}/>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{hostelName}</p>
          <p className="text-[11px] font-semibold text-slate-400">{current?.desktop || 'Admin'}</p>
        </div>
      </div>
      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-800">Admin</span>
    </header>
  )
}

function MobileNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pt-1.5 shadow-[0_-12px_30px_-24px_rgba(6,78,59,0.55)] backdrop-blur md:hidden" aria-label="Mobile navigation">
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === '/'}
          className={({ isActive }) => `flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition-colors ${
            isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-400'
          }`}>
          <Icon size={19} strokeWidth={2}/>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default function Layout() {
  return (
    <div className="flex h-[100dvh] min-h-screen overflow-hidden bg-[#f6f5ef]">
      <DesktopSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto px-3 py-4 pb-24 sm:px-5 sm:py-6 sm:pb-24 md:px-7 md:py-7 lg:px-9">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
