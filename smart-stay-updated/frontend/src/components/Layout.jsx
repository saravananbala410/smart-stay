import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, BedDouble, Users, WalletCards, BarChart3,
  LogOut, Building2, Activity, Sparkles, ShieldCheck,
} from 'lucide-react'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Home', desktop: 'Overview', helper: 'Live property pulse' },
  { to: '/rooms', icon: BedDouble, label: 'Rooms', desktop: 'Rooms & beds', helper: 'Inventory and rent' },
  { to: '/tenants', icon: Users, label: 'Tenants', desktop: 'Tenants', helper: 'People and records' },
  { to: '/payments', icon: WalletCards, label: 'Payments', desktop: 'Bills & payments', helper: 'Collections and dues' },
  { to: '/reports', icon: BarChart3, label: 'Reports', desktop: 'Reports', helper: 'Financial insights' },
]

const activeFor = (pathname, to) => to === '/' ? pathname === '/' : pathname.startsWith(to)

function BrandMark({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${compact ? 'h-10 w-10 rounded-xl' : 'h-12 w-12 rounded-2xl'} relative grid flex-shrink-0 place-items-center overflow-hidden bg-gradient-to-br from-indigo-400 via-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-950/30`}>
        <Building2 size={compact ? 18 : 22} strokeWidth={2.4}/>
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 ring-2 ring-indigo-500"/>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`${compact ? 'text-sm' : 'text-base'} font-black tracking-[-0.035em] text-white`}>Smart Stay</p>
          {!compact && <Sparkles size={12} className="text-cyan-300"/>}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Property OS</p>
      </div>
    </div>
  )
}

function DesktopSidebar() {
  const navigate = useNavigate()
  const hostelName = localStorage.getItem('hostel_name') || 'My Property'
  const logout = () => { localStorage.clear(); navigate('/login') }

  return (
    <aside className="relative hidden w-[272px] flex-shrink-0 flex-col overflow-hidden border-r border-white/5 bg-slate-950 text-white md:flex">
      <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl"/>
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl"/>

      <div className="relative px-6 pb-5 pt-7"><BrandMark/></div>

      <div className="relative mx-4 mb-6 rounded-2xl border border-white/10 bg-white/[0.055] p-3.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300 ring-1 ring-inset ring-indigo-400/20"><Activity size={17}/></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-200">{hostelName}</p>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"/>Workspace online</div>
          </div>
        </div>
      </div>

      <p className="relative px-7 pb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-600">Workspace</p>
      <nav className="relative flex-1 space-y-1.5 px-3.5" aria-label="Main navigation">
        {NAV.map(({ to, icon: Icon, desktop, helper }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `group flex min-h-[54px] items-center gap-3 rounded-2xl px-3.5 transition-all ${
              isActive
                ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-[0_12px_30px_-16px_rgba(99,102,241,0.95)] ring-1 ring-inset ring-white/10'
                : 'text-slate-400 hover:bg-white/[0.055] hover:text-white'
            }`}>
            {({ isActive }) => <>
              <div className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl transition-colors ${isActive ? 'bg-white/15' : 'bg-white/[0.035] group-hover:bg-white/[0.08]'}`}><Icon size={18} strokeWidth={2.1}/></div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-4">{desktop}</p>
                <p className={`mt-0.5 truncate text-[10px] ${isActive ? 'text-indigo-100' : 'text-slate-600 group-hover:text-slate-500'}`}>{helper}</p>
              </div>
            </>}
          </NavLink>
        ))}
      </nav>

      <div className="relative m-4 rounded-2xl border border-white/10 bg-white/[0.045] p-2">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-xs font-black text-white">A</div>
          <div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-200">Administrator</p><p className="text-[10px] text-slate-500">Full access</p></div>
          <ShieldCheck size={15} className="text-emerald-400"/>
        </div>
        <button onClick={logout} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"><LogOut size={15}/> Sign out</button>
      </div>
    </aside>
  )
}

function DesktopTopbar() {
  const location = useLocation()
  const current = NAV.find(item => activeFor(location.pathname, item.to))
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date())
  return (
    <header className="hidden min-h-20 items-center justify-between border-b border-slate-200/70 bg-white/60 px-7 backdrop-blur-xl md:flex lg:px-9">
      <div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-indigo-500">Admin workspace</p><p className="mt-1 text-sm font-bold text-slate-800">{current?.desktop || 'Smart Stay'}</p></div>
      <div className="flex items-center gap-3">
        <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm">{today}</span>
        <span className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200/70"><span className="h-2 w-2 rounded-full bg-emerald-500"/>Live</span>
      </div>
    </header>
  )
}

function MobileHeader() {
  const location = useLocation()
  const hostelName = localStorage.getItem('hostel_name') || 'Smart Stay'
  const current = NAV.find(item => activeFor(location.pathname, item.to))
  return (
    <header className="flex min-h-[68px] items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-xl md:hidden">
      <BrandMark compact/>
      <div className="min-w-0 text-right"><p className="max-w-[145px] truncate text-xs font-bold text-slate-800">{hostelName}</p><p className="mt-0.5 text-[10px] font-semibold text-indigo-500">{current?.desktop || 'Admin'}</p></div>
    </header>
  )
}

function MobileNav() {
  return (
    <nav className="safe-bottom fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[22px] border border-white/80 bg-white/90 px-1.5 pt-1.5 shadow-[0_22px_50px_-16px_rgba(15,23,42,0.35)] backdrop-blur-xl md:hidden" aria-label="Mobile navigation">
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === '/'}
          className={({ isActive }) => `relative flex min-h-[55px] flex-col items-center justify-center gap-1 rounded-2xl text-[9px] font-extrabold transition-all ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400 active:bg-slate-50'}`}>
          {({ isActive }) => <><Icon size={19} strokeWidth={isActive ? 2.5 : 2}/><span>{label}</span>{isActive && <span className="absolute -bottom-0.5 h-1 w-4 rounded-full bg-indigo-500"/>}</>}
        </NavLink>
      ))}
    </nav>
  )
}

export default function Layout() {
  return (
    <div className="flex h-[100dvh] min-h-screen overflow-hidden bg-[#f5f7fc]">
      <DesktopSidebar/>
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-violet-200/20 blur-3xl"/>
        <DesktopTopbar/>
        <MobileHeader/>
        <main className="relative flex-1 overflow-y-auto px-3.5 py-5 pb-28 sm:px-5 sm:py-6 md:px-7 md:py-7 lg:px-9 lg:py-8"><Outlet/></main>
      </div>
      <MobileNav/>
    </div>
  )
}
