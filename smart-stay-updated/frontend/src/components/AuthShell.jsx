import { Building2, CheckCircle2, Sparkles, WalletCards, ShieldCheck, BarChart3 } from 'lucide-react'

const points = [
  { icon: WalletCards, title: 'Clear collections', text: 'Bills, dues and receipts in one calm workspace.' },
  { icon: ShieldCheck, title: 'Built for trust', text: 'Tenant-specific payment links with admin verification.' },
  { icon: BarChart3, title: 'Know your numbers', text: 'Simple monthly insights without spreadsheet confusion.' },
]

export default function AuthShell({ kicker, title, subtitle, children, footer }) {
  return (
    <main className="auth-canvas">
      <section className="relative hidden overflow-hidden px-10 py-9 lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-12">
        <div className="auth-grid pointer-events-none absolute inset-0"/>
        <div className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-indigo-600/25 blur-[100px]"/>
        <div className="pointer-events-none absolute -right-16 bottom-12 h-72 w-72 rounded-full bg-cyan-500/15 blur-[100px]"/>

        <div className="relative flex items-center gap-3">
          <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 via-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-950/40"><Building2 size={22}/><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-cyan-300 ring-2 ring-indigo-500"/></div>
          <div><p className="text-base font-black tracking-[-0.035em] text-white">Smart Stay</p><p className="text-[10px] font-bold uppercase tracking-[0.19em] text-slate-500">Property OS</p></div>
        </div>

        <div className="relative max-w-xl py-12">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-xs font-bold text-indigo-200"><Sparkles size={13}/>Made for modern property teams</div>
          <h1 className="max-w-lg text-balance text-4xl font-black leading-[1.12] tracking-[-0.05em] text-white xl:text-5xl">Run your property with clarity, not complexity.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-400">Rooms, tenants, collections and reports—designed to feel effortless from day one.</p>
          <div className="mt-9 grid gap-3 xl:grid-cols-3">
            {points.map(({ icon: Icon, title: pointTitle, text }) => (
              <div key={pointTitle} className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4 backdrop-blur">
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300"><Icon size={17}/></div>
                <p className="text-xs font-extrabold text-slate-200">{pointTitle}</p>
                <p className="mt-1.5 text-[11px] leading-5 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 size={14} className="text-emerald-400"/>Secure multi-property admin workspace</div>
      </section>

      <section className="relative flex items-center justify-center bg-[#f7f8fc] p-4 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-violet-200/30 blur-3xl"/>
        <div className="auth-card relative">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200"><Building2 size={20}/></div>
            <div><p className="text-sm font-black tracking-tight text-slate-950">Smart Stay</p><p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-indigo-500">Property OS</p></div>
          </div>
          <div className="mb-7">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo-500">{kicker}</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-[28px]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
          </div>
          {children}
          {footer && <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </section>
    </main>
  )
}
