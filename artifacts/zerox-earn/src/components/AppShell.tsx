import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ChevronDown,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  Trophy,
  UserRound,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  getGetLiveFeedQueryKey,
  useGetLiveFeed,
  useLogout,
  type AuthUser,
} from "@workspace/api-client-react";
import { BrandLogo } from "@/components/BrandLogo";

const earnLinks = [
  { name: "MoOffers", slug: "mooffers", badge: "POPULAR" },
  { name: "Offery", slug: "offery", badge: "FAST PAY" },
  { name: "Upwall", slug: "upwall", badge: "+20%" },
  { name: "Gimiwall", slug: "gimiwall", badge: "NEW" },
  { name: "Revtoo", slug: "revtoo", badge: "DAILY" },
] as const;

const mainLinks = [
  { href: "/dashboard", label: "Dashboard / Earn", icon: LayoutDashboard },
  { href: "/cashout", label: "Cashout / Shop", icon: Wallet },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/profile", label: "Profile & History", icon: UserRound },
];

function amountText(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function AppShell({
  user,
  children,
}: {
  user: AuthUser;
  children: ReactNode;
}) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const queryClient = useQueryClient();
  const logout = useLogout();
  const feedQuery = useGetLiveFeed({
    query: {
      queryKey: getGetLiveFeedQueryKey(),
      refetchInterval: 30000,
      staleTime: 15000,
    },
  });
  const feed = useMemo(() => {
    const items = feedQuery.data ?? [];
    if (!items.length) return [];
    return [...items, ...items];
  }, [feedQuery.data]);

  function signOut() {
    logout.mutate(
      undefined,
      {
        onSuccess: () => {
          queryClient.clear();
          setAccountOpen(false);
          setLocation("/");
        },
      },
    );
  }

  const navClasses = `sidebar ${mobileOpen ? "sidebar-open" : ""}`;

  return (
    <div className="app-frame" data-testid="layout-app">
      <aside className={navClasses} aria-label="Main navigation">
        <div className="sidebar-brand">
          <BrandLogo />
          <button className="mobile-close icon-button" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation">
            <X size={18} />
          </button>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user.username.slice(0, 1).toUpperCase()}</div>
          <div className="sidebar-user-copy">
            <strong data-testid="text-sidebar-username">{user.username}</strong>
            <span><span className="online-dot" /> LEVEL {user.level} MEMBER</span>
          </div>
          <span className="vip-chip">ZX</span>
        </div>

        <nav className="side-nav">
          <p className="nav-overline">MAIN MENU</p>
          {mainLinks.map((item) => {
            const Icon = item.icon;
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? "active" : ""}`}
                onClick={() => setMobileOpen(false)}
                data-testid={`link-${item.href.slice(1).replaceAll("/", "-")}`}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{item.label}</span>
                {active && <span className="nav-active-mark" />}
              </Link>
            );
          })}

          <p className="nav-overline nav-spaced">OFFERWALL PARTNERS</p>
          {earnLinks.map((item) => {
            const href = `/earn/${item.slug}`;
            const active = location === href;
            return (
              <Link
                key={item.slug}
                href={href}
                className={`nav-link partner-link ${active ? "active" : ""}`}
                onClick={() => setMobileOpen(false)}
                data-testid={`link-earn-${item.slug}`}
              >
                <span className={`partner-dot partner-dot-${item.slug}`} />
                <span>{item.name}</span>
                <small>{item.badge}</small>
              </Link>
            );
          })}

          {user.role === "admin" && (
            <>
              <p className="nav-overline nav-spaced">MANAGEMENT</p>
              <Link
                href="/admin"
                className={`nav-link ${location === "/admin" ? "active" : ""}`}
                onClick={() => setMobileOpen(false)}
                data-testid="link-admin"
              >
                <Settings2 size={17} strokeWidth={1.8} />
                <span>Admin Control Panel</span>
              </Link>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-help-icon"><Activity size={15} /></div>
          <div><strong>Need a hand?</strong><span>Help center coming soon</span></div>
        </div>
      </aside>

      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} data-testid="button-navigation-scrim" />}

      <div className="app-main">
        <div className="live-strip" aria-label="Recent community rewards" data-testid="feed-live">
          <div className="live-strip-label"><span className="live-pulse" /> LIVE EARNINGS</div>
          <div className="live-strip-window">
            {feed.length > 0 ? (
              <div className="live-strip-track">
                {feed.map((item, index) => (
                  <span className="live-feed-item" key={`${item.username}-${item.createdAt}-${index}`} data-testid={`feed-item-${index}`}>
                    <strong>{item.username}</strong> earned <b>{amountText(item.amount)} ZX</b> from <span>{item.provider}</span>
                    <i />
                  </span>
                ))}
              </div>
            ) : (
              <span className="feed-empty">Latest member rewards will appear here</span>
            )}
          </div>
          <span className="live-strip-count"><CircleDollarSign size={14} /> {feedQuery.data?.length ?? 0} RECENT</span>
        </div>

        <header className="topbar">
          <button className="mobile-menu icon-button" type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)} data-testid="button-open-navigation">
            <Menu size={19} />
          </button>
          <BrandLogo className="topbar-brand" />
          <div className="topbar-level">
            <div className="level-label"><span>LEVEL {user.level}</span><small>{user.xp.toLocaleString()} XP</small></div>
            <div className="level-progress"><span style={{ width: `${Math.min(100, user.xp % 1000 / 10)}%` }} /></div>
          </div>
          <div className="topbar-balance">
            <span className="balance-glyph"><Zap size={14} fill="currentColor" /></span>
            <div><small>YOUR BALANCE</small><strong data-testid="text-topbar-balance">{amountText(user.balance)} <span>ZX</span></strong></div>
          </div>
          <div className="account-menu-wrap">
            <button className="account-button" type="button" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)} data-testid="button-account-menu">
              <span className="topbar-avatar">{user.username.slice(0, 1).toUpperCase()}</span>
              <span className="account-button-copy"><strong>{user.username}</strong><small>{user.role === "admin" ? "ADMIN" : "MEMBER"}</small></span>
              <ChevronDown size={15} />
            </button>
            {accountOpen && (
              <div className="account-dropdown">
                <Link href="/profile" onClick={() => setAccountOpen(false)}><UserRound size={15} /> Profile</Link>
                <button type="button" onClick={signOut} disabled={logout.isPending} data-testid="button-logout">
                  <LogOut size={15} /> {logout.isPending ? "Signing out..." : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="page-main">{children}</main>
      </div>
    </div>
  );
}
