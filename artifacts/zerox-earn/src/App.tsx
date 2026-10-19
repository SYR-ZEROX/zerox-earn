import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Banknote,
  BarChart3, Check, CheckCircle2, ChevronRight, CircleHelp, Coins, Copy, Crown, ExternalLink,
  Gift, Globe2, Home, LogOut, Medal, Menu, ShieldCheck, Sparkles, Trophy, UserRound,
  Users, Wallet, X, Zap,
} from 'lucide-react';
import {
  getGetAdminOfferwallsQueryKey, getGetAdminUsersQueryKey,
  getGetAdminWithdrawalsQueryKey, getGetCurrentUserQueryKey, getGetDashboardQueryKey,
  getGetMyWithdrawalsQueryKey, getGetOfferwallQueryKey, getGetOfferwallsQueryKey,
  getGetProfileQueryKey,
  useAdjustUserBalance, useCreateWithdrawal, useGetActivity, useGetAdminOfferwalls,
  useGetAdminUsers, useGetAdminWithdrawals, useGetCashoutOptions, useGetCurrentUser,
  useGetDashboard, useGetLeaderboard, useGetMyWithdrawals, useGetOfferwall,
  useGetPostbackInfo, useGetProfile, useLogin, useLogout,
  useRegister, useReviewWithdrawal, useUpdateOfferwall,
} from '@workspace/api-client-react';
import type {
  ActivityItem, AdminUser, LeaderboardEntry, Offerwall, ProviderSlug as Provider, Withdrawal,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();
const COOKIE_REQUEST = { credentials: 'include' as const };
const PROVIDERS: Provider[] = ['mooffers', 'offery', 'upwall', 'gimiwall', 'revtoo'];
const PROVIDER_LABELS: Record<Provider, string> = {
  mooffers: 'MoOffers', offery: 'OfferY', upwall: 'Upwall', gimiwall: 'Gimiwall', revtoo: 'RevToo',
};
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: Home },
  { href: '/cashout', label: 'Cashout', icon: Wallet },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/profile', label: 'My profile', icon: UserRound },
];
const money = (value?: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value ?? 0);
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

function Button({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`rounded-xl px-4 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 ${className}`} {...props}>{children}</button>;
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`surface rounded-2xl ${className}`}>{children}</section>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div>{eyebrow && <div className="mb-2 text-[11px] font-bold uppercase tracking-[.2em] text-emerald-400">{eyebrow}</div>}
      <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-50 md:text-[2.15rem]">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>}</div>
    {action}
  </div>;
}

function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => <div key={i} className="h-[68px] animate-pulse rounded-xl border border-slate-800/80 bg-slate-900/60" />)}
  </div>;
}

function QueryError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="rounded-xl border border-rose-900/60 bg-rose-950/25 p-5" role="alert" data-testid="status-query-error">
    <p className="text-sm text-rose-200">{message}</p><Button className="btn-quiet mt-4" onClick={retry} data-testid="button-retry">Try again</Button>
  </div>;
}

function EmptyState({ title, detail, icon: Icon = Gift }: { title: string; detail: string; icon?: typeof Gift }) {
  return <div className="flex flex-col items-center justify-center px-6 py-12 text-center" data-testid="state-empty">
    <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-slate-700 bg-slate-800/60 text-emerald-400"><Icon size={21} /></div>
    <h3 className="font-display text-base font-semibold text-slate-100">{title}</h3><p className="mt-1 max-w-sm text-sm text-slate-400">{detail}</p>
  </div>;
}

function Coin({ size = 16 }: { size?: number }) {
  return <span className="inline-grid place-items-center rounded-full bg-emerald-400/10 text-emerald-400" style={{ width: size + 8, height: size + 8 }}><Coins size={size} /></span>;
}

function StatusPill({ status }: { status: string }) {
  const color = status === 'approved' ? 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20'
    : status === 'rejected' ? 'text-rose-300 bg-rose-400/10 border-rose-400/20'
    : 'text-amber-200 bg-amber-300/10 border-amber-300/20';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${color}`} data-testid={`status-withdrawal-${status}`}>{status}</span>;
}

function RewardRow({ item }: { item: ActivityItem }) {
  const credited = item.amount >= 0;
  return <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 py-3.5 last:border-0" data-testid={`row-activity-${item.id}`}>
    <div className="flex min-w-0 items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${credited ? 'bg-emerald-400/10 text-emerald-400' : 'bg-slate-700/60 text-slate-300'}`}>
      {item.kind === 'withdrawal' ? <ArrowDownToLine size={16} /> : item.kind === 'adjustment' ? <Activity size={16} /> : <Zap size={16} />}
    </span><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-200" data-testid={`text-activity-label-${item.id}`}>{item.label}</p>
      <p className="mt-1 text-xs text-slate-500">{dateLabel(item.createdAt)} <span className="mx-1 text-slate-700">/</span> {item.kind}</p></div></div>
    <span className={`numeric whitespace-nowrap text-sm font-bold ${credited ? 'text-emerald-400' : 'text-slate-300'}`}>{credited ? '+' : ''}{money(item.amount)} ZX</span>
  </div>;
}

function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [message, setMessage] = useState('');
  const [loginValues, setLoginValues] = useState({ email: '', password: '' });
  const [registerValues, setRegisterValues] = useState({ username: '', email: '', password: '' });
  const login = useLogin({ request: COOKIE_REQUEST });
  const register = useRegister({ request: COOKIE_REQUEST });
  const currentUser = useGetCurrentUser({ request: COOKIE_REQUEST, query: { retry: false, queryKey: getGetCurrentUserQueryKey() } });
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  useEffect(() => { if (currentUser.data) setLocation('/dashboard'); }, [currentUser.data, setLocation]);

  const submit = (event: FormEvent) => {
    event.preventDefault(); setMessage('');
    const mutation = mode === 'login' ? login : register;
    const payload = mode === 'login' ? loginValues : registerValues;
    mutation.mutate({ data: payload } as never, {
      onSuccess: () => { void qc.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); setLocation('/dashboard'); },
      onError: (error) => setMessage(errorText(error)),
    });
  };
  const pending = login.isPending || register.isPending;
  return <main className="min-h-[100dvh] overflow-hidden bg-[#0b0e14] text-slate-50">
    <header className="glass-bar fixed inset-x-0 top-0 z-20 border-b border-slate-800/70">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 md:px-10">
        <Brand /><div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><ShieldCheck size={15} className="text-emerald-400" /> Rewards, tracked to the coin.</div>
      </div>
    </header>
    <div className="mx-auto grid min-h-[100dvh] max-w-[1440px] items-center gap-12 px-5 pb-12 pt-28 md:grid-cols-[1fr_440px] md:px-10 lg:gap-24">
      <div className="page-enter relative py-8 md:py-14">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[.07] px-3 py-1.5 text-xs font-semibold text-emerald-300"><Sparkles size={14} /> The earn hub for your next milestone</div>
        <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[1.04] tracking-[-.055em] text-slate-50 md:text-7xl">Every offer<br /><span className="text-emerald-400">moves you forward.</span></h1>
        <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">Complete partner offers, build your ZX Coin balance, and turn steady progress into a real cashout.</p>
        <div className="mt-11 grid max-w-[560px] grid-cols-3 gap-3">
          {[['01', 'Choose an offer'], ['02', 'Earn ZX Coins'], ['03', 'Cash out']].map(([n, t]) => <div key={n} className="border-l border-slate-700 pl-3"><span className="font-display text-xs font-bold text-emerald-400">{n}</span><p className="mt-1 text-xs text-slate-400">{t}</p></div>)}
        </div>
        <div className="pointer-events-none absolute -left-40 top-32 -z-0 h-72 w-72 rounded-full bg-emerald-400/[.04] blur-3xl" />
      </div>
      <Panel className="page-enter relative z-10 p-6 md:p-8" >
        <div className="mb-7 flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-[.18em] text-slate-500">{mode === 'login' ? 'Member access' : 'Start earning'}</div>
          <h2 className="mt-2 font-display text-2xl font-semibold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2></div><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/10 text-emerald-400"><Zap size={19} /></div></div>
        {currentUser.isLoading && <div className="mb-4 h-10 animate-pulse rounded-lg bg-slate-800" />}
        {message && <div className="mb-4 rounded-lg border border-rose-800/60 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-200" role="alert" data-testid="status-auth-error">{message}</div>}
        <form onSubmit={submit} className="space-y-4" data-testid="form-auth">
          {mode === 'register' && <label className="block text-sm text-slate-300">Username<input required minLength={3} maxLength={32} value={registerValues.username} onChange={e => setRegisterValues(v => ({ ...v, username: e.target.value }))} className="field mt-2" placeholder="Choose a username" autoComplete="username" data-testid="input-username" /></label>}
          <label className="block text-sm text-slate-300">Email address<input required type="email" value={mode === 'login' ? loginValues.email : registerValues.email} onChange={e => mode === 'login' ? setLoginValues(v => ({ ...v, email: e.target.value })) : setRegisterValues(v => ({ ...v, email: e.target.value }))} className="field mt-2" placeholder="you@example.com" autoComplete="email" data-testid="input-email" /></label>
          <label className="block text-sm text-slate-300">Password<input required minLength={mode === 'register' ? 10 : 1} type="password" value={mode === 'login' ? loginValues.password : registerValues.password} onChange={e => mode === 'login' ? setLoginValues(v => ({ ...v, password: e.target.value })) : setRegisterValues(v => ({ ...v, password: e.target.value }))} className="field mt-2" placeholder={mode === 'register' ? 'At least 10 characters' : 'Your password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} data-testid="input-password" /></label>
          <Button type="submit" disabled={pending} className="btn-primary mt-2 w-full py-3.5" data-testid="button-auth-submit">{pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></Button>
        </form>
        <div className="mt-6 text-center text-sm text-slate-500">{mode === 'login' ? 'New to ZEROX EARN?' : 'Already a member?'} <button className="ml-1 font-semibold text-emerald-400 hover:text-emerald-300" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage(''); }} data-testid="button-toggle-auth">{mode === 'login' ? 'Create account' : 'Sign in'}</button></div>
      </Panel>
    </div>
  </main>;
}

function Brand() {
  return <Link href="/" className="group inline-flex items-center gap-2.5 text-slate-50 no-underline" data-testid="link-brand">
    <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-emerald-400 text-[#07130e]"><Zap size={18} fill="currentColor" /></span>
    <span className="font-display text-lg font-bold tracking-[-.055em]">ZEROX<span className="ml-1 text-emerald-400">EARN</span></span>
  </Link>;
}

function AppShell({ children }: { children: ReactNode }) {
  const userQuery = useGetCurrentUser({ request: COOKIE_REQUEST, query: { retry: false, queryKey: getGetCurrentUserQueryKey() } });
  const logout = useLogout({ request: COOKIE_REQUEST });
  const qc = useQueryClient();
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  if (userQuery.isLoading) return <div className="min-h-[100dvh] bg-[#0b0e14] p-6"><div className="mx-auto max-w-6xl"><div className="h-14 animate-pulse rounded-2xl bg-slate-900" /><div className="mt-8 h-48 animate-pulse rounded-2xl bg-slate-900" /></div></div>;
  if (!userQuery.data) return <div className="grid min-h-[100dvh] place-items-center bg-[#0b0e14] px-5 text-center"><div><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-slate-700 bg-slate-900 text-emerald-400"><ShieldCheck size={24} /></div><h1 className="font-display text-2xl font-semibold text-slate-100">Sign in to continue</h1><p className="mt-2 text-sm text-slate-400">Your balance and progress are waiting for you.</p><Link href="/" className="btn-primary mt-5 inline-flex rounded-xl px-5 py-3 text-sm font-bold no-underline" data-testid="link-signin">Go to sign in <ArrowRight className="ml-2" size={16} /></Link></div></div>;
  const user = userQuery.data;
  const items = user.role === 'admin' ? [...NAV_ITEMS, { href: '/admin', label: 'Admin console', icon: ShieldCheck }] : NAV_ITEMS;
  const logoutNow = () => logout.mutate(undefined, { onSuccess: () => { void qc.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); setLocation('/'); } });
  return <div className="min-h-[100dvh] bg-[#0b0e14] text-slate-100">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-slate-800/80 bg-[#0d1118] px-4 py-6 lg:flex">
      <Brand /><div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">Member space</div>
      <nav className="mt-3 space-y-1" aria-label="Main navigation">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link flex items-center gap-3 rounded-xl px-3 py-3 text-sm no-underline ${location === href || location.startsWith(href + '/') ? 'active' : ''}`} data-testid={`link-nav-${href.slice(1).replace('/', '-')}`}><Icon size={17} /><span>{label}</span>{href === '/admin' && <span className="ml-auto rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold text-violet-300">STAFF</span>}</Link>)}</nav>
      <div className="mt-auto"><Panel className="mb-4 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-violet-300"><Sparkles size={14} /> YOUR LEVEL</div><div className="mt-2 flex items-end justify-between"><span className="font-display text-2xl font-semibold">LVL {user.level}</span><span className="text-xs text-slate-500">{money(user.xp)} XP</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(7, user.xp % 100)}%` }} /></div></Panel>
        <div className="flex items-center gap-3 rounded-xl px-2 py-2"><div className="grid h-9 w-9 place-items-center rounded-full border border-slate-700 bg-slate-800 text-sm font-bold text-slate-200">{user.username.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{user.username}</div><div className="text-xs text-slate-500">{user.role === 'admin' ? 'Administrator' : 'Member'}</div></div><button onClick={logoutNow} disabled={logout.isPending} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200" aria-label="Sign out" data-testid="button-logout"><LogOut size={16} /></button></div>
      </div>
    </aside>
    <header className="glass-bar sticky top-0 z-20 border-b border-slate-800/80 lg:hidden">
      <div className="flex h-[64px] items-center justify-between px-4"><Brand /><button className="rounded-lg border border-slate-700 p-2 text-slate-300" onClick={() => setMenuOpen(v => !v)} aria-label="Toggle navigation" data-testid="button-mobile-menu">{menuOpen ? <X size={19} /> : <Menu size={19} />}</button></div>
      {menuOpen && <nav className="border-t border-slate-800 px-3 py-2">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-300 no-underline hover:bg-slate-800" data-testid={`link-mobile-${href.slice(1)}`}><Icon size={16} />{label}</Link>)}<button onClick={logoutNow} className="flex w-full items-center gap-3 px-3 py-3 text-sm text-slate-400" data-testid="button-mobile-logout"><LogOut size={16} />Sign out</button></nav>}
    </header>
    <main className="lg:pl-[248px]"><div className="mx-auto max-w-[1440px] px-4 pb-12 pt-7 md:px-8 md:pt-9 xl:px-12">
      <div className="mb-7 hidden items-center justify-between border-b border-slate-800/60 pb-5 lg:flex">
        <div className="text-xs text-slate-500">Workspace <ChevronRight className="mx-1 inline" size={12} /> <span className="text-slate-300">{items.find(i => location === i.href || location.startsWith(i.href + '/'))?.label ?? 'Earn'}</span></div>
        <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-400"><Coin size={13} /> <span className="numeric font-semibold text-emerald-400">{money(user.balance)} ZX</span></div>
      </div>
      <div className="page-enter">{children}</div>
    </div></main>
  </div>;
}

function DashboardPage() {
  const q = useGetDashboard({ request: COOKIE_REQUEST });
  const activity = useGetActivity({ request: COOKIE_REQUEST });
  const d = q.data;
  if (q.isLoading) return <><PageHeading title="Your earning dashboard" description="Your next milestone starts with one good offer." /><LoadingBlock rows={4} /></>;
  if (q.isError || !d) return <QueryError message={errorText(q.error)} retry={() => void q.refetch()} />;
  const progress = Math.min(100, Math.max(4, (d.user.xp % 100)));
  return <div data-testid="dashboard-content">
    <PageHeading eyebrow="Your earning dashboard" title={`Good to see you, ${d.user.username}.`} description="Every completed offer brings your next reward closer." action={<Link href="/cashout" className="btn-quiet inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold no-underline" data-testid="link-dashboard-cashout"><Wallet size={16} /> Cash out <ArrowUpRight size={14} /></Link>} />
    <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
      <Panel className="surface-hover relative overflow-hidden p-6 md:p-8">
        <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border border-emerald-400/[.08]" /><div className="absolute -right-2 -top-10 h-44 w-44 rounded-full border border-emerald-400/[.07]" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.17em] text-slate-400"><Wallet size={15} /> Available balance</div>
            <div className="numeric mt-4 text-5xl font-semibold tracking-[-.06em] text-emerald-400 md:text-6xl" data-testid="text-balance">{money(d.user.balance)}<span className="ml-2 text-xl font-medium tracking-normal text-emerald-400/65">ZX</span></div>
            <p className="mt-3 text-sm text-slate-500">Total earned <span className="ml-1 font-semibold text-slate-300">{money(d.totalEarned)} ZX</span></p>
          </div>
          <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[.07] px-4 py-3"><div className="flex items-center gap-2 text-xs font-semibold text-violet-300"><Crown size={15} /> CURRENT LEVEL</div><div className="mt-1 font-display text-3xl font-semibold text-slate-50">Level {d.user.level}</div></div>
        </div>
        <div className="relative mt-8 border-t border-slate-700/70 pt-5">
          <div className="mb-2 flex justify-between text-xs"><span className="font-semibold text-slate-300">Progress to level {d.user.level + 1}</span><span className="numeric text-violet-300">{money(d.user.xp)} XP</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-slate-500">Keep earning to fill your progress bar.</p>
        </div>
      </Panel>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-1">
        <Panel className="surface-hover p-5"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><BarChart3 size={15} /> Total earned</div><div className="numeric mt-3 text-3xl font-semibold text-slate-50">{money(d.totalEarned)} <span className="text-sm font-medium text-slate-500">ZX</span></div><div className="mt-2 text-xs text-emerald-400">All-time rewards</div></Panel>
        <Panel className="surface-hover p-5"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><ArrowDownToLine size={15} /> In review</div><div className="numeric mt-3 text-3xl font-semibold text-slate-50">{money(d.pendingWithdrawals)} <span className="text-sm font-medium text-slate-500">ZX</span></div><div className="mt-2 text-xs text-slate-500">Pending withdrawals</div></Panel>
      </div>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
      <Panel className="p-5 md:p-6"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-lg font-semibold">Partner offerwalls</h2><p className="mt-1 text-xs text-slate-500">Choose a provider and start earning.</p></div><Globe2 size={19} className="text-emerald-400" /></div>
        {d.offerwalls.length ? <div className="grid gap-2 sm:grid-cols-2">{d.offerwalls.map((wall, i) => <OfferwallCard key={wall.provider} wall={wall} index={i} />)}</div> : <EmptyState title="No offerwalls available" detail="Offer partners will appear here once configured." />}</Panel>
      <Panel className="p-5 md:p-6"><div className="mb-2 flex items-center justify-between"><div><h2 className="font-display text-lg font-semibold">Recent rewards</h2><p className="mt-1 text-xs text-slate-500">The latest changes to your balance.</p></div><Activity size={18} className="text-slate-500" /></div>
        {activity.isLoading ? <LoadingBlock rows={3} /> : activity.isError ? <QueryError message={errorText(activity.error)} retry={() => void activity.refetch()} /> : activity.data?.length ? <div>{activity.data.slice(0, 5).map(row => <RewardRow key={row.id} item={row} />)}</div> : <EmptyState title="Your story starts here" detail="Complete your first offer and your rewards will show up here." />}</Panel>
    </div>
  </div>;
}

function OfferwallCard({ wall, index }: { wall: Offerwall; index: number }) {
  const active = wall.online && Boolean(wall.launchUrl || wall.url);
  const href = `/earn/${wall.provider}`;
  return <Link href={href} className={`surface-hover flex items-center gap-3 rounded-xl border border-slate-800/80 bg-[#111720] p-3.5 no-underline ${active ? 'hover:border-emerald-400/40' : 'opacity-65'}`} data-testid={`card-offerwall-${wall.provider}`}>
    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${index % 2 ? 'bg-violet-500/15 text-violet-300' : 'bg-emerald-400/10 text-emerald-400'}`}><span className="font-display text-sm font-bold">{wall.name.slice(0, 1).toUpperCase()}</span></div>
    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-slate-100">{wall.name}</p><span className={`h-1.5 w-1.5 rounded-full ${wall.online ? 'bg-emerald-400' : 'bg-slate-600'}`} /></div><p className="mt-1 truncate text-xs text-slate-500">{wall.badge || (wall.online ? 'Available now' : 'Offline')}</p></div>
    <ChevronRight size={16} className="text-slate-600" />
  </Link>;
}

function ProviderPage() {
  const params = useParams<{ provider: string }>();
  const provider = (params.provider ?? 'mooffers') as Provider;
  const validProvider = PROVIDERS.includes(provider);
  const q = useGetOfferwall(provider, { request: COOKIE_REQUEST, query: { enabled: validProvider, queryKey: getGetOfferwallQueryKey(provider) } });
  const wall = q.data;
  if (!validProvider) return <EmptyState title="Provider not found" detail="This offerwall is not part of the available provider list." icon={CircleHelp} />;
  if (q.isLoading) return <><PageHeading title={PROVIDER_LABELS[provider]} description="Loading partner offers." /><div className="h-[420px] animate-pulse rounded-2xl bg-slate-900" /></>;
  if (q.isError || !wall) return <QueryError message={errorText(q.error)} retry={() => void q.refetch()} />;
  const launch = wall.launchUrl || wall.url;
  return <div>
    <PageHeading eyebrow="Earn with a partner" title={wall.name || PROVIDER_LABELS[provider]} description="Complete an offer on the partner site. Eligible rewards will be credited to your ZEROX EARN balance." action={<Link href="/dashboard" className="btn-quiet inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold no-underline" data-testid="link-back-dashboard"><ArrowLeft size={15} /> All earning options</Link>} />
    {!wall.online || !launch ? <Panel className="p-4 md:p-8"><EmptyState title="This partner is offline" detail="This offerwall isn't accepting visits right now. Check another provider from your dashboard." icon={Globe2} /></Panel> :
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4"><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-emerald-400" /><span className="text-sm font-semibold">{wall.name}</span><span className="text-xs text-slate-500">{wall.badge}</span></div><a href={launch} target="_blank" rel="noreferrer" className="btn-quiet inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold no-underline" data-testid="link-open-provider">Open in new tab <ExternalLink size={13} /></a></div>
        <iframe title={`${wall.name} offerwall`} src={launch} className="h-[70vh] min-h-[480px] w-full border-0 bg-[#10151e]" data-testid={`frame-provider-${provider}`} referrerPolicy="strict-origin-when-cross-origin" />
      </Panel>}
  </div>;
}

function CashoutPage() {
  const qc = useQueryClient();
  const optionsQ = useGetCashoutOptions({ request: COOKIE_REQUEST });
  const userQ = useGetCurrentUser({ request: COOKIE_REQUEST });
  const withdrawalsQ = useGetMyWithdrawals({ request: COOKIE_REQUEST });
  const create = useCreateWithdrawal({ request: COOKIE_REQUEST });
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [notice, setNotice] = useState('');
  const options = optionsQ.data ?? [];
  const chosen = options.find(o => o.id === method);
  useEffect(() => { if (!method && options.length) setMethod(options[0].id); }, [method, options]);
  const submit = (event: FormEvent) => {
    event.preventDefault(); setNotice('');
    const amountNum = Number(amount);
    if (!chosen || amountNum < chosen.minimum) { setNotice(`Minimum request for this method is ${money(chosen?.minimum)} ZX.`); return; }
    if (amountNum > (userQ.data?.balance ?? 0)) { setNotice('Your request cannot exceed your available balance.'); return; }
    create.mutate({ data: { method, amount: amountNum, destination: destination.trim() } }, {
      onSuccess: () => { setNotice('Withdrawal request submitted.'); setAmount(''); setDestination(''); void qc.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); void qc.invalidateQueries({ queryKey: getGetMyWithdrawalsQueryKey() }); void qc.invalidateQueries({ queryKey: getGetProfileQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); },
      onError: err => setNotice(errorText(err)),
    });
  };
  return <div><PageHeading eyebrow="Turn rewards into value" title="Cash out your ZX Coins." description="Choose a payout method, enter your destination, and submit a withdrawal request." />
    <div className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
      <Panel className="p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-lg font-semibold">Request a withdrawal</h2><p className="mt-1 text-xs text-slate-500">Available balance</p></div><div className="text-right"><div className="numeric text-2xl font-semibold text-emerald-400">{money(userQ.data?.balance)} ZX</div></div></div>
        {optionsQ.isLoading ? <LoadingBlock rows={3} /> : optionsQ.isError ? <QueryError message={errorText(optionsQ.error)} retry={() => void optionsQ.refetch()} /> : options.length === 0 ? <EmptyState title="No payout methods" detail="Cashout options will appear here when available." icon={Banknote} /> : <form onSubmit={submit} className="space-y-4" data-testid="form-withdrawal">
          <label className="block text-sm font-medium text-slate-300">Payout method<select required value={method} onChange={e => setMethod(e.target.value)} className="field mt-2" data-testid="select-cashout-method">{options.map(o => <option key={o.id} value={o.id}>{o.name} — minimum {money(o.minimum)} ZX</option>)}</select></label>
          {chosen && <div className="rounded-xl border border-slate-800 bg-slate-900/65 px-4 py-3"><div className="text-xs font-semibold text-slate-200">{chosen.category}</div><p className="mt-1 text-xs leading-5 text-slate-500">{chosen.description}</p></div>}
          <label className="block text-sm font-medium text-slate-300">Amount in ZX Coins<input required type="number" min={chosen?.minimum ?? 0.01} max={userQ.data?.balance} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="field mt-2" placeholder="0.00" data-testid="input-withdrawal-amount" /></label>
          <label className="block text-sm font-medium text-slate-300">Payout destination<input required minLength={2} maxLength={256} value={destination} onChange={e => setDestination(e.target.value)} className="field mt-2" placeholder="Email, wallet address, or account details" data-testid="input-withdrawal-destination" /></label>
          {notice && <div className={`rounded-lg border px-3 py-2.5 text-sm ${notice.includes('submitted') ? 'border-emerald-800 bg-emerald-950/30 text-emerald-200' : 'border-amber-800/60 bg-amber-950/20 text-amber-200'}`} role="status" data-testid="status-cashout">{notice}</div>}
          <Button type="submit" disabled={create.isPending || !userQ.data} className="btn-primary w-full py-3" data-testid="button-submit-withdrawal">{create.isPending ? 'Submitting…' : 'Request cashout'} <ArrowRight size={16} /></Button>
        </form>}
      </Panel>
      <Panel className="p-5 md:p-6"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-lg font-semibold">Withdrawal history</h2><p className="mt-1 text-xs text-slate-500">Track each request from submission to review.</p></div><ArrowDownToLine size={18} className="text-slate-500" /></div>
        {withdrawalsQ.isLoading ? <LoadingBlock rows={4} /> : withdrawalsQ.isError ? <QueryError message={errorText(withdrawalsQ.error)} retry={() => void withdrawalsQ.refetch()} /> : withdrawalsQ.data?.length ? <div className="divide-y divide-slate-800/80">{withdrawalsQ.data.map((w: Withdrawal) => <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-4" data-testid={`row-withdrawal-${w.id}`}><div><div className="text-sm font-semibold text-slate-200">{w.method}</div><div className="mt-1 text-xs text-slate-500">{dateLabel(w.createdAt)} · {w.destination}</div></div><div className="text-right"><div className="numeric mb-1 text-sm font-bold text-slate-100">{money(w.amount)} ZX</div><StatusPill status={w.status} /></div></div>)}</div> : <EmptyState title="No withdrawals yet" detail="Your cashout requests and their review status will be listed here." icon={Wallet} />}</Panel>
    </div>
  </div>;
}

function LeaderboardPage() {
  const q = useGetLeaderboard({ request: COOKIE_REQUEST });
  const userQ = useGetCurrentUser({ request: COOKIE_REQUEST });
  const rows = q.data ?? [];
  return <div><PageHeading eyebrow="The community" title="Leaderboard" description="The members moving their balances forward, one offer at a time." action={<div className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/[.07] px-3.5 py-2.5 text-xs font-semibold text-violet-200"><Trophy size={15} /> All-time earners</div>} />
    <Panel className="overflow-hidden"><div className="grid grid-cols-[68px_1fr_95px_120px] gap-3 border-b border-slate-800 bg-slate-900/50 px-4 py-3 text-[10px] font-bold uppercase tracking-[.15em] text-slate-500 sm:grid-cols-[80px_1fr_120px_150px] sm:px-6"><span>Rank</span><span>Member</span><span className="text-right">Level</span><span className="text-right">Balance</span></div>
      {q.isLoading ? <div className="p-5"><LoadingBlock rows={6} /></div> : q.isError ? <div className="p-5"><QueryError message={errorText(q.error)} retry={() => void q.refetch()} /></div> : rows.length ? rows.map((row: LeaderboardEntry, index) => <div key={`${row.rank}-${row.username}`} className={`table-row grid grid-cols-[68px_1fr_95px_120px] items-center gap-3 border-b border-slate-800/60 px-4 py-4 last:border-0 sm:grid-cols-[80px_1fr_120px_150px] sm:px-6 ${row.username === userQ.data?.username ? 'bg-emerald-400/[.045]' : ''}`} data-testid={`row-leaderboard-${row.rank}`}>
        <span className={`font-display text-lg font-bold ${row.rank === 1 ? 'text-amber-300' : row.rank === 2 ? 'text-slate-300' : row.rank === 3 ? 'text-orange-300' : 'text-slate-500'}`}>{row.rank <= 3 ? <Medal className="inline mr-1" size={16} /> : '#'}{row.rank <= 3 ? '' : row.rank}</span>
        <span className="flex min-w-0 items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${index < 3 ? 'bg-violet-500/15 text-violet-200' : 'bg-slate-800 text-slate-300'}`}>{row.username.slice(0, 1).toUpperCase()}</span><span className="truncate text-sm font-semibold text-slate-200">{row.username}{row.username === userQ.data?.username && <span className="ml-2 text-[10px] text-emerald-400">YOU</span>}</span></span>
        <span className="text-right text-sm text-violet-300">LVL {row.level}</span><span className="numeric text-right text-sm font-bold text-emerald-400">{money(row.balance)} ZX</span>
      </div>) : <EmptyState title="No rankings yet" detail="The leaderboard will take shape as members complete offers." icon={Trophy} />}</Panel>
    <p className="mt-3 text-right text-[11px] text-slate-600">Rankings update with member balances.</p>
  </div>;
}

function ProfilePage() {
  const q = useGetProfile({ request: COOKIE_REQUEST });
  if (q.isLoading) return <><PageHeading title="My profile" description="Your account details and withdrawal history." /><LoadingBlock rows={5} /></>;
  if (q.isError || !q.data) return <QueryError message={errorText(q.error)} retry={() => void q.refetch()} />;
  const { user, withdrawals, totalEarned } = q.data;
  return <div><PageHeading eyebrow="Account" title="My profile" description="A clear view of your membership and payouts." />
    <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
      <div className="space-y-5">
        <Panel className="p-5 md:p-6"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 font-display text-xl font-bold text-emerald-300">{user.username.slice(0, 1).toUpperCase()}</div><div><h2 className="font-display text-xl font-semibold">{user.username}</h2><p className="mt-1 text-sm text-slate-500">{user.email}</p></div></div>
          <div className="mt-6 space-y-3 border-t border-slate-800 pt-5"><ProfileField label="Account ID" value={user.id} test="text-profile-id" /><ProfileField label="Member since" value={dateLabel(user.createdAt)} test="text-profile-created" /><ProfileField label="Account role" value={user.role} test="text-profile-role" /></div></Panel>
        <Panel className="grid grid-cols-2 divide-x divide-slate-800 p-5"><div className="pr-4"><div className="text-xs text-slate-500">Lifetime earned</div><div className="numeric mt-2 text-2xl font-semibold text-emerald-400">{money(totalEarned)}<span className="ml-1 text-xs text-slate-500">ZX</span></div></div><div className="pl-4"><div className="text-xs text-slate-500">Current level</div><div className="numeric mt-2 text-2xl font-semibold text-violet-300">LVL {user.level}</div><div className="mt-1 text-xs text-slate-600">{money(user.xp)} XP</div></div></Panel>
      </div>
      <Panel className="p-5 md:p-6"><div className="mb-2 flex items-center justify-between"><div><h2 className="font-display text-lg font-semibold">Withdrawal history</h2><p className="mt-1 text-xs text-slate-500">Every payout request on your account.</p></div><Banknote size={18} className="text-slate-500" /></div>
        {withdrawals.length ? <div className="mt-3 divide-y divide-slate-800/80">{withdrawals.map(w => <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-4" data-testid={`row-profile-withdrawal-${w.id}`}><div><p className="text-sm font-semibold text-slate-200">{w.method}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(w.createdAt)} · {w.destination}</p></div><div className="text-right"><p className="numeric mb-1 text-sm font-bold">{money(w.amount)} ZX</p><StatusPill status={w.status} /></div></div>)}</div> : <EmptyState title="No payout activity" detail="When you request a cashout, its status will appear here." icon={Wallet} />}
      </Panel>
    </div>
  </div>;
}

function ProfileField({ label, value, test }: { label: string; value: string; test: string }) {
  return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">{label}</span><span className="max-w-[65%] truncate text-right font-medium text-slate-200" data-testid={test}>{value}</span></div>;
}

function AdminPage() {
  const currentUser = useGetCurrentUser({ request: COOKIE_REQUEST });
  const [activeTab, setActiveTab] = useState<'offerwalls' | 'users' | 'withdrawals' | 'postback'>('offerwalls');
  const tabs = [
    ['offerwalls', 'Offerwalls', Globe2], ['users', 'Members', Users], ['withdrawals', 'Withdrawals', Banknote], ['postback', 'Postback URL', Activity],
  ] as const;
  if (currentUser.data?.role !== 'admin') return <Panel className="p-8"><EmptyState title="Staff access required" detail="This workspace is available to administrator accounts only." icon={ShieldCheck} /></Panel>;
  return <div><PageHeading eyebrow="Staff workspace" title="Admin console" description="Configure partner links, manage member balances, and review payout requests." />
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-[#10151e] p-1.5">
      {tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setActiveTab(id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold ${activeTab === id ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:text-slate-200'}`} data-testid={`button-admin-tab-${id}`}><Icon size={14} />{label}</button>)}
    </div>
    {activeTab === 'offerwalls' && <AdminOfferwalls />}
    {activeTab === 'users' && <AdminUsers />}
    {activeTab === 'withdrawals' && <AdminWithdrawals />}
    {activeTab === 'postback' && <PostbackPanel />}
  </div>;
}

function AdminOfferwalls() {
  const query = useGetAdminOfferwalls({ request: COOKIE_REQUEST });
  const qc = useQueryClient();
  const update = useUpdateOfferwall({ request: COOKIE_REQUEST });
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  useEffect(() => { if (query.data) setUrls(Object.fromEntries(query.data.map(w => [w.provider, w.url ?? '']))); }, [query.data]);
  if (query.isLoading) return <Panel className="p-5"><LoadingBlock rows={5} /></Panel>;
  if (query.isError) return <QueryError message={errorText(query.error)} retry={() => void query.refetch()} />;
  const save = (wall: Offerwall) => update.mutate({ params: { provider: wall.provider }, data: { url: urls[wall.provider]?.trim() || null } }, { onSuccess: () => { setMessage(`${wall.name} settings saved.`); void qc.invalidateQueries({ queryKey: getGetAdminOfferwallsQueryKey() }); void qc.invalidateQueries({ queryKey: getGetOfferwallsQueryKey() }); }, onError: e => setMessage(errorText(e)) });
  return <Panel className="p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-lg font-semibold">Partner configuration</h2><p className="mt-1 text-xs text-slate-500">Set the provider destination URL. Leave blank to disable.</p></div><Globe2 size={18} className="text-emerald-400" /></div>
    {message && <p className="mb-4 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300" role="status" data-testid="status-admin-offerwall">{message}</p>}
    <div className="space-y-3">{query.data?.map(wall => <div key={wall.provider} className="rounded-xl border border-slate-800 bg-[#111720] p-4" data-testid={`card-admin-offerwall-${wall.provider}`}>
      <div className="mb-3 flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-slate-100">{wall.name}</div><div className="mt-1 text-xs text-slate-500">{wall.provider} · {wall.online ? 'Online' : 'Offline'}</div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${wall.online ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>{wall.online ? 'ACTIVE' : 'DISABLED'}</span></div>
      <div className="flex flex-col gap-2 sm:flex-row"><input type="url" value={urls[wall.provider] ?? ''} onChange={e => setUrls(v => ({ ...v, [wall.provider]: e.target.value }))} className="field min-w-0 flex-1 text-sm" placeholder="https://partner.example/offerwall" data-testid={`input-offerwall-url-${wall.provider}`} /><Button disabled={update.isPending} onClick={() => save(wall)} className="btn-quiet shrink-0" data-testid={`button-save-offerwall-${wall.provider}`}>{update.isPending ? 'Saving…' : 'Save URL'}</Button></div>
    </div>)}</div>
  </Panel>;
}

function AdminUsers() {
  const query = useGetAdminUsers({ request: COOKIE_REQUEST });
  const qc = useQueryClient();
  const adjust = useAdjustUserBalance({ request: COOKIE_REQUEST });
  const [form, setForm] = useState<Record<string, { amount: string; reason: string }>>({});
  const [message, setMessage] = useState('');
  if (query.isLoading) return <Panel className="p-5"><LoadingBlock rows={5} /></Panel>;
  if (query.isError) return <QueryError message={errorText(query.error)} retry={() => void query.refetch()} />;
  const fields = (u: AdminUser) => form[u.id] ?? { amount: '', reason: '' };
  const submit = (event: FormEvent, user: AdminUser) => {
    event.preventDefault(); const val = fields(user);
    if (!val.reason.trim() || Number(val.amount) === 0) return;
    adjust.mutate({ userId: user.id, data: { amount: Number(val.amount), reason: val.reason.trim() } }, {
      onSuccess: () => { setMessage(`Balance updated for ${user.username}.`); setForm(prev => ({ ...prev, [user.id]: { amount: '', reason: '' } })); void qc.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); void qc.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }); },
      onError: err => setMessage(errorText(err)),
    });
  };
  return <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><h2 className="font-display text-lg font-semibold">Member balances</h2><p className="mt-1 text-xs text-slate-500">Adjust a member's balance with a recorded reason.</p></div><Users size={18} className="text-violet-300" /></div>
    {message && <div className="mx-5 mt-4 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300" role="status" data-testid="status-admin-user">{message}</div>}
    {query.data?.length ? <div className="divide-y divide-slate-800/80">{query.data.map(user => <form key={user.id} onSubmit={e => submit(e, user)} className="grid gap-3 p-4 md:grid-cols-[1fr_130px_1.15fr_auto] md:items-center md:px-5" data-testid={`row-admin-user-${user.id}`}>
      <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-slate-100">{user.username}</span>{user.role === 'admin' && <BadgeCheck size={14} className="text-violet-300" />}</div><div className="truncate text-xs text-slate-500">{user.email}</div></div>
      <div><div className="text-[10px] uppercase tracking-wide text-slate-600">Balance</div><div className="numeric mt-1 text-sm font-semibold text-emerald-400">{money(user.balance)} ZX</div></div>
      <div className="flex gap-2"><input type="number" step="0.01" value={fields(user).amount} onChange={e => setForm(v => ({ ...v, [user.id]: { ...fields(user), amount: e.target.value } }))} className="field w-[108px] px-3 py-2 text-xs" placeholder="+ / − ZX" aria-label={`Balance adjustment for ${user.username}`} data-testid={`input-adjust-amount-${user.id}`} /><input value={fields(user).reason} onChange={e => setForm(v => ({ ...v, [user.id]: { ...fields(user), reason: e.target.value } }))} className="field min-w-0 px-3 py-2 text-xs" placeholder="Reason (required)" aria-label={`Adjustment reason for ${user.username}`} data-testid={`input-adjust-reason-${user.id}`} /></div>
      <Button type="submit" disabled={adjust.isPending || !fields(user).amount || !fields(user).reason.trim()} className="btn-quiet w-full md:w-auto" data-testid={`button-adjust-user-${user.id}`}>{adjust.isPending ? 'Saving…' : 'Adjust'}</Button>
    </form>)}</div> : <EmptyState title="No member accounts" detail="Member accounts will be shown here." icon={Users} />}
  </Panel>;
}

function AdminWithdrawals() {
  const query = useGetAdminWithdrawals({ request: COOKIE_REQUEST });
  const qc = useQueryClient();
  const review = useReviewWithdrawal({ request: COOKIE_REQUEST });
  const [message, setMessage] = useState('');
  if (query.isLoading) return <Panel className="p-5"><LoadingBlock rows={5} /></Panel>;
  if (query.isError) return <QueryError message={errorText(query.error)} retry={() => void query.refetch()} />;
  const decide = (id: number, status: 'approved' | 'rejected') => review.mutate({ withdrawalId: id, data: { status } }, { onSuccess: () => { setMessage(`Withdrawal ${status}.`); void qc.invalidateQueries({ queryKey: getGetAdminWithdrawalsQueryKey() }); void qc.invalidateQueries({ queryKey: getGetMyWithdrawalsQueryKey() }); void qc.invalidateQueries({ queryKey: getGetProfileQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); }, onError: e => setMessage(errorText(e)) });
  return <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><h2 className="font-display text-lg font-semibold">Withdrawal review</h2><p className="mt-1 text-xs text-slate-500">Review requests and record a decision.</p></div><Banknote size={18} className="text-emerald-400" /></div>
    {message && <div className="mx-5 mt-4 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300" role="status" data-testid="status-admin-withdrawal">{message}</div>}
    {query.data?.length ? <div className="divide-y divide-slate-800/80">{query.data.map(w => <div key={w.id} className="grid gap-4 p-4 md:grid-cols-[1fr_auto_auto] md:items-center md:px-5" data-testid={`row-admin-withdrawal-${w.id}`}>
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-slate-100">{w.username}</span><span className="text-xs text-slate-500">{w.email}</span><StatusPill status={w.status} /></div><div className="mt-1 truncate text-xs text-slate-500">{w.method} · {w.destination} · {dateLabel(w.createdAt)}</div></div>
      <div className="numeric text-lg font-semibold text-slate-100">{money(w.amount)} <span className="text-xs text-slate-500">ZX</span></div>
      {w.status === 'pending' ? <div className="flex gap-2"><Button disabled={review.isPending} onClick={() => decide(w.id, 'rejected')} className="btn-quiet px-3 text-xs text-rose-200" data-testid={`button-reject-withdrawal-${w.id}`}>Reject</Button><Button disabled={review.isPending} onClick={() => decide(w.id, 'approved')} className="btn-primary px-3 text-xs" data-testid={`button-approve-withdrawal-${w.id}`}><Check size={14} /> Approve</Button></div> : <span className="text-xs text-slate-600">{w.reviewedAt ? `Reviewed ${dateLabel(w.reviewedAt)}` : 'Reviewed'}</span>}
    </div>)}</div> : <EmptyState title="Queue is clear" detail="New withdrawal requests will appear here for review." icon={CheckCircle2} />}
  </Panel>;
}

function PostbackPanel() {
  const query = useGetPostbackInfo({ request: COOKIE_REQUEST });
  const [copied, setCopied] = useState(false);
  if (query.isLoading) return <Panel className="p-5"><LoadingBlock rows={3} /></Panel>;
  if (query.isError || !query.data) return <QueryError message={errorText(query.error)} retry={() => void query.refetch()} />;
  const info = query.data;
  const copy = async () => { await navigator.clipboard.writeText(info.template); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  return <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
    <Panel className="p-5 md:p-6"><div className="mb-5 flex items-start justify-between"><div><h2 className="font-display text-lg font-semibold">Secure postback endpoint</h2><p className="mt-1 text-xs text-slate-500">Use this server-to-server URL in your partner configuration.</p></div><ShieldCheck size={19} className="text-emerald-400" /></div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Endpoint URL</label><div className="mt-2 break-all rounded-xl border border-slate-800 bg-[#0d1219] p-3 font-mono text-xs leading-6 text-emerald-300" data-testid="text-postback-url">{info.url}</div>
      <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Provider URL template</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 break-all rounded-xl border border-slate-800 bg-[#0d1219] p-3 font-mono text-xs leading-6 text-slate-300" data-testid="text-postback-template">{info.template}</code><Button onClick={copy} className="btn-quiet self-start sm:self-stretch" data-testid="button-copy-postback">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy template'}</Button></div>
    </Panel>
    <Panel className="p-5 md:p-6"><div className="flex items-center gap-2 text-violet-300"><CircleHelp size={17} /><h2 className="font-display text-lg font-semibold text-slate-100">Macro reference</h2></div><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-400" data-testid="text-postback-macro-help">{info.macroHelp}</p><div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-400/[.045] p-4 text-xs leading-5 text-amber-100/70">Keep your secret value private. Do not place the postback secret in public-facing page code.</div></Panel>
  </div>;
}

function NotFound() {
  return <div className="grid min-h-[55vh] place-items-center text-center"><div><p className="font-display text-5xl font-semibold text-slate-100">404</p><p className="mt-2 text-slate-400">This page isn't in your earning hub.</p><Link href="/dashboard" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 no-underline" data-testid="link-not-found-home"><ArrowLeft size={15} /> Return to dashboard</Link></div></div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={AuthPage} />
    <Route path="/dashboard"><AppShell><DashboardPage /></AppShell></Route>
    <Route path="/cashout"><AppShell><CashoutPage /></AppShell></Route>
    <Route path="/leaderboard"><AppShell><LeaderboardPage /></AppShell></Route>
    <Route path="/profile"><AppShell><ProfilePage /></AppShell></Route>
    <Route path="/earn/:provider"><AppShell><ProviderPage /></AppShell></Route>
    <Route path="/admin"><AppShell><AdminPage /></AppShell></Route>
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
