import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Copy, Gift, Sparkles, Wallet, Zap } from "lucide-react";
import { Link } from "wouter";
import {
  getGetCurrentUserQueryKey,
  getGetDashboardQueryKey,
  useGetDashboard,
} from "@workspace/api-client-react";
import { EmptyState, ErrorInline, formatCoins, formatDate, LoadingInline, MetricCard, PageHeader } from "@/components/blocks";

const providerDescriptions: Record<string, string> = {
  mooffers: "A wide mix of surveys and app offers",
  offery: "Quick tasks with straightforward rewards",
  upwall: "Discover featured mobile experiences",
  gimiwall: "Fresh offers added regularly",
  revtoo: "Browse daily earning opportunities",
};

export function DashboardPage() {
  const queryClient = useQueryClient();
  const dashboard = useGetDashboard({
    query: {
      queryKey: getGetDashboardQueryKey(),
      refetchInterval: 30000,
      staleTime: 10000,
    },
  });
  const data = dashboard.data;

  useEffect(() => {
    if (data?.user) {
      queryClient.setQueryData(getGetCurrentUserQueryKey(), data.user);
    }
  }, [data?.user, queryClient]);

  async function copyUserId() {
    if (!data?.user.id) return;
    await navigator.clipboard.writeText(data.user.id);
  }

  return (
    <section className="page-content" data-testid="page-dashboard">
      {dashboard.isLoading && <LoadingInline label="Loading your earning dashboard…" />}
      {dashboard.isError && <ErrorInline message={dashboard.error.message} />}
      {data && (
        <>
          <PageHeader
            eyebrow="MEMBER DASHBOARD"
            title={`Good to see you, ${data.user.username}.`}
            description="Your next reward is only a few offers away."
            action={
              <div className="user-id-chip">
                <span>YOUR SUBID</span>
                <code data-testid="text-subid">{data.user.id}</code>
                <button type="button" onClick={copyUserId} aria-label="Copy user ID" data-testid="button-copy-subid"><Copy size={14} /></button>
              </div>
            }
          />

          <div className="dashboard-hero">
            <div className="dashboard-hero-copy">
              <span className="hero-label"><span className="live-pulse" /> EARNING OVERVIEW</span>
              <h2>Your activity<br />adds up.</h2>
              <p>Keep moving through offers to grow your balance and level.</p>
              <Link href="/cashout" className="secondary-button" data-testid="link-cashout-from-hero">Explore cashout options <ArrowUpRight size={15} /></Link>
            </div>
            <div className="hero-orbit" aria-hidden="true">
              <div className="orbit orbit-one" /><div className="orbit orbit-two" />
              <div className="orbit-center"><Zap size={36} fill="currentColor" /></div>
              <span className="orbit-tag orbit-tag-a">ZX / EARN</span>
              <span className="orbit-tag orbit-tag-b">LVL {data.user.level}</span>
            </div>
            <div className="hero-balance">
              <span>AVAILABLE BALANCE</span>
              <strong data-testid="text-dashboard-balance">{formatCoins(data.user.balance)} <small>ZX</small></strong>
              <div className="balance-rail"><span style={{ width: `${Math.min(100, data.user.xp % 1000 / 10)}%` }} /></div>
              <small>{data.user.xp.toLocaleString()} XP <i /> NEXT LEVEL {data.user.level + 1}</small>
            </div>
          </div>

          <div className="metric-grid">
            <MetricCard label="TOTAL EARNED" value={`${formatCoins(data.totalEarned)} ZX`} detail="All-time offer rewards" icon={Sparkles} accent="green" testId="card-total-earned" />
            <MetricCard label="PENDING CASHOUT" value={`${formatCoins(data.pendingWithdrawals)} ZX`} detail="In review with the team" icon={Wallet} accent="violet" testId="card-pending-cashout" />
            <MetricCard label="CURRENT LEVEL" value={`LVL ${data.user.level}`} detail={`${data.user.xp.toLocaleString()} XP earned`} icon={Zap} accent="blue" testId="card-current-level" />
          </div>

          <div className="section-heading-row">
            <div><span className="eyebrow">PICK YOUR NEXT TASK</span><h2>Offerwall partners</h2></div>
            <span className="section-count">{data.offerwalls.length} PARTNERS <span className="online-dot" /></span>
          </div>

          {data.offerwalls.length ? (
            <div className="offerwall-grid">
              {data.offerwalls.map((wall, index) => (
                <Link
                  href={`/earn/${wall.provider}`}
                  className={`offerwall-card offerwall-card-${index}`}
                  key={wall.provider}
                  data-testid={`card-offerwall-${wall.provider}`}
                >
                  <div className="offerwall-card-top">
                    <div className={`offerwall-symbol symbol-${wall.provider}`}>{wall.name.slice(0, 1)}</div>
                    <span className="offerwall-badge">{wall.badge}</span>
                  </div>
                  <h3>{wall.name}</h3>
                  <p>{providerDescriptions[wall.provider] ?? "Explore earning offers"}</p>
                  <div className="offerwall-card-bottom">
                    <span><span className="online-dot" /> ONLINE</span>
                    <span className="offerwall-arrow"><ArrowUpRight size={17} /></span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="Offerwalls are getting ready" message="Partner walls will appear here as soon as they're available." icon={Gift} />
          )}

          <div className="section-heading-row activity-heading">
            <div><span className="eyebrow">YOUR RECENT MOVEMENT</span><h2>Latest activity</h2></div>
            <Link href="/profile" className="text-link" data-testid="link-view-history">View history <ArrowUpRight size={15} /></Link>
          </div>
          {data.recentActivity.length ? (
            <div className="activity-table">
              {data.recentActivity.map((activity) => (
                <div className="activity-row" key={activity.id} data-testid={`row-activity-${activity.id}`}>
                  <span className={`activity-kind-icon activity-${activity.kind}`}><Gift size={16} /></span>
                  <div className="activity-copy"><strong>{activity.label}</strong><small>{formatDate(activity.createdAt)}</small></div>
                  <strong className={activity.amount >= 0 ? "amount-positive" : "amount-negative"}>{activity.amount > 0 ? "+" : ""}{formatCoins(activity.amount)} ZX</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Your earning history starts here" message="Once an offer is completed, your rewards will show up in this activity list." icon={Gift} />
          )}
        </>
      )}
    </section>
  );
}
