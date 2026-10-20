import { useState } from "react";
import { Check, Clipboard, Clock3, Mail, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { getGetProfileQueryKey, useGetProfile } from "@workspace/api-client-react";
import { EmptyState, ErrorInline, formatCoins, formatDate, LoadingInline, PageHeader, StatusPill } from "@/components/blocks";

export function ProfilePage() {
  const profile = useGetProfile({
    query: { queryKey: getGetProfileQueryKey() },
  });
  const [copied, setCopied] = useState(false);

  async function copyId() {
    const id = profile.data?.user.id;
    if (!id) return;
    await navigator.clipboard.writeText(id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="page-content" data-testid="page-profile">
      <PageHeader eyebrow="YOUR ZEROX ACCOUNT" title="Profile & history" description="Account details, member ID, and your recent payout activity." />
      {profile.isLoading && <LoadingInline label="Loading profile…" />}
      {profile.isError && <ErrorInline message={profile.error.message} />}
      {profile.data && (
        <>
          <div className="profile-layout">
            <article className="profile-card">
              <div className="profile-card-head">
                <div className="profile-large-avatar">{profile.data.user.username.slice(0, 1).toUpperCase()}</div>
                <div>
                  <span className="eyebrow">ZEROX MEMBER</span>
                  <h2 data-testid="text-profile-username">{profile.data.user.username}</h2>
                  <span className="role-badge"><ShieldCheck size={13} /> {profile.data.user.role.toUpperCase()}</span>
                </div>
              </div>
              <div className="profile-detail-row"><span><Mail size={15} /> Email</span><strong data-testid="text-profile-email">{profile.data.user.email}</strong></div>
              <div className="profile-detail-row"><span><UserRound size={15} /> Member since</span><strong>{new Date(profile.data.user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong></div>
              <div className="profile-id-row">
                <div><span>UNIQUE SUBID</span><code data-testid="text-profile-subid">{profile.data.user.id}</code></div>
                <button className="icon-button profile-copy-button" onClick={copyId} type="button" aria-label="Copy SubID" data-testid="button-copy-profile-id">
                  {copied ? <Check size={16} /> : <Clipboard size={16} />}
                </button>
              </div>
            </article>
            <div className="profile-stat-stack">
              <article className="profile-stat">
                <span className="metric-icon"><WalletCards size={17} /></span>
                <small>ALL-TIME EARNED</small>
                <strong data-testid="text-profile-total-earned">{formatCoins(profile.data.totalEarned)} <span>ZX</span></strong>
              </article>
              <article className="profile-stat">
                <span className="metric-icon violet"><Clock3 size={17} /></span>
                <small>WITHDRAWALS</small>
                <strong>{profile.data.withdrawals.length} <span>REQUESTS</span></strong>
              </article>
            </div>
          </div>

          <div className="section-heading-row activity-heading">
            <div><span className="eyebrow">REDEMPTION RECORD</span><h2>Withdrawal history</h2></div>
            <span className="section-count">{profile.data.withdrawals.length} TOTAL</span>
          </div>
          {profile.data.withdrawals.length ? (
            <div className="activity-table">
              {profile.data.withdrawals.map((item) => (
                <div className="activity-row withdrawal-row" key={item.id} data-testid={`row-profile-withdrawal-${item.id}`}>
                  <span className="activity-kind-icon activity-withdrawal"><WalletCards size={16} /></span>
                  <div className="activity-copy"><strong>{item.method}</strong><small>{formatDate(item.createdAt)} · {item.destination}</small></div>
                  <strong className="withdrawal-amount">{formatCoins(item.amount)} ZX</strong>
                  <StatusPill status={item.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No withdrawal history" message="When you request a cashout, its status will be listed here." icon={WalletCards} />
          )}
        </>
      )}
    </section>
  );
}
