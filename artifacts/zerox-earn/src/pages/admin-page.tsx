import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Check,
  CheckCheck,
  Clipboard,
  Code2,
  Coins,
  Globe2,
  Search,
  Settings2,
  ShieldCheck,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCurrentUserQueryKey,
  getGetAdminOfferwallsQueryKey,
  getGetAdminUsersQueryKey,
  getGetAdminWithdrawalsQueryKey,
  getGetDashboardQueryKey,
  getGetOfferwallsQueryKey,
  getGetPostbackInfoQueryKey,
  getGetProfileQueryKey,
  getGetMyWithdrawalsQueryKey,
  useAdjustUserBalance,
  useGetAdminOfferwalls,
  useGetAdminUsers,
  useGetAdminWithdrawals,
  useGetPostbackInfo,
  useReviewWithdrawal,
  useUpdateOfferwall,
} from "@workspace/api-client-react";
import type { AdminUser, Offerwall, ProviderSlug } from "@workspace/api-client-react";
import { Form } from "@/components/ui/form";
import { EmptyState, ErrorInline, formatCoins, formatDate, LoadingInline, PageHeader, StatusPill } from "@/components/blocks";

type AdminTab = "offerwalls" | "users" | "withdrawals" | "postback";

const adjustmentSchema = z.object({
  amount: z.coerce.number().refine((value) => value !== 0, "Amount cannot be zero"),
  reason: z.string().min(2, "Add a short reason").max(200),
});

type AdjustmentValues = z.infer<typeof adjustmentSchema>;

function OfferwallEditor({ wall }: { wall: Offerwall }) {
  const queryClient = useQueryClient();
  const update = useUpdateOfferwall();
  const form = useForm<{ url: string }>({
    resolver: zodResolver(z.object({ url: z.string().max(2048) })),
    defaultValues: { url: wall.url ?? "" },
  });
  useEffect(() => {
    form.reset({ url: wall.url ?? "" });
  }, [form, wall.url]);

  return (
    <article className="admin-provider-card" data-testid={`admin-offerwall-${wall.provider}`}>
      <div className="admin-provider-heading">
        <span className={`offerwall-symbol symbol-${wall.provider}`}>{wall.name.slice(0, 1)}</span>
        <div><strong>{wall.name}</strong><small>{wall.online ? "Provider ready" : "Provider offline"}</small></div>
        <span className="online-dot" />
      </div>
      <Form {...form}>
        <form
          className="admin-url-form"
          onSubmit={form.handleSubmit((values) =>
            update.mutate(
              {
                params: { provider: wall.provider as ProviderSlug },
                data: { url: values.url.trim() || null },
              },
              {
                onSuccess: () => {
                  void queryClient.invalidateQueries({ queryKey: getGetAdminOfferwallsQueryKey() });
                  void queryClient.invalidateQueries({ queryKey: getGetOfferwallsQueryKey() });
                  void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
                },
              },
            ),
          )}
          noValidate
        >
          <label className="field-label" htmlFor={`offerwall-url-${wall.provider}`}>Offerwall iframe URL</label>
          <input
            id={`offerwall-url-${wall.provider}`}
            placeholder="https://partner.example/wall?subid={user_id}"
            {...form.register("url")}
            data-testid={`input-offerwall-url-${wall.provider}`}
          />
          <small className="field-note">Use <code>{"{user_id}"}</code> where the member SubID should be inserted. HTTPS only.</small>
          {update.error && <span className="field-error">{update.error.message}</span>}
          <button type="submit" className="secondary-button" disabled={update.isPending} data-testid={`button-save-offerwall-${wall.provider}`}>
            {update.isPending ? "Saving…" : "Save URL"}
          </button>
        </form>
      </Form>
    </article>
  );
}

function UserBalanceRow({ user, onUpdated }: { user: AdminUser; onUpdated: () => void }) {
  const adjustment = useAdjustUserBalance();
  const form = useForm<AdjustmentValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { amount: 0, reason: "" },
  });
  return (
    <article className="admin-user-row" data-testid={`admin-user-${user.id}`}>
      <div className="admin-user-info">
        <span className="member-avatar">{user.username.slice(0, 1).toUpperCase()}</span>
        <div><strong>{user.username}</strong><small>{user.email}</small><code>{user.id}</code></div>
      </div>
      <div className="admin-user-balance"><small>AVAILABLE</small><strong>{formatCoins(user.balance)} ZX</strong><span>LVL {user.level}</span></div>
      <Form {...form}>
        <form
          className="balance-adjust-form"
          onSubmit={form.handleSubmit((values) =>
            adjustment.mutate(
              { userId: user.id, data: values },
              {
                onSuccess: () => {
                  form.reset({ amount: 0, reason: "" });
                  onUpdated();
                },
              },
            ),
          )}
          noValidate
        >
          <input type="number" step="0.01" placeholder="+/- ZX" {...form.register("amount")} aria-label={`Balance adjustment for ${user.username}`} data-testid={`input-adjust-balance-${user.id}`} />
          <input placeholder="Reason" {...form.register("reason")} aria-label={`Reason for ${user.username}`} data-testid={`input-adjust-reason-${user.id}`} />
          <button className="small-primary-button" type="submit" disabled={adjustment.isPending} data-testid={`button-adjust-balance-${user.id}`}>
            <Coins size={14} /> Apply
          </button>
        </form>
      </Form>
      {adjustment.error && <span className="field-error balance-error">{adjustment.error.message}</span>}
    </article>
  );
}

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("offerwalls");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const offerwalls = useGetAdminOfferwalls({
    query: { queryKey: getGetAdminOfferwallsQueryKey() },
  });
  const users = useGetAdminUsers({
    query: { queryKey: getGetAdminUsersQueryKey() },
  });
  const withdrawals = useGetAdminWithdrawals({
    query: { queryKey: getGetAdminWithdrawalsQueryKey() },
  });
  const postback = useGetPostbackInfo({
    query: { queryKey: getGetPostbackInfoQueryKey() },
  });
  const review = useReviewWithdrawal();

  const visibleUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return users.data ?? [];
    return (users.data ?? []).filter((user) =>
      `${user.username} ${user.email} ${user.id}`.toLowerCase().includes(normalized),
    );
  }, [search, users.data]);

  function refreshAdminData() {
    void queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetAdminWithdrawalsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetMyWithdrawalsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
  }

  async function copyPostback() {
    if (!postback.data?.url) return;
    await navigator.clipboard.writeText(postback.data.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function decideWithdrawal(withdrawalId: number, status: "approved" | "rejected") {
    review.mutate(
      { withdrawalId, data: { status } },
      {
        onSuccess: () => {
          refreshAdminData();
          void queryClient.invalidateQueries({ queryKey: getGetAdminWithdrawalsQueryKey() });
        },
      },
    );
  }

  const tabs = [
    { id: "offerwalls" as const, label: "Offerwalls", icon: Globe2 },
    { id: "users" as const, label: "Users", icon: UsersRound },
    { id: "withdrawals" as const, label: "Withdrawals", icon: WalletCards },
    { id: "postback" as const, label: "Postback API", icon: Code2 },
  ];

  return (
    <section className="page-content" data-testid="page-admin">
      <PageHeader eyebrow="SITE OPERATIONS" title="Admin control panel" description="Manage partner connections, member balances, payouts, and reward callbacks." action={<span className="admin-secure-badge"><ShieldCheck size={15} /> ADMIN ACCESS</span>} />
      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)} role="tab" aria-selected={tab === id} data-testid={`tab-admin-${id}`}>
            <Icon size={16} /> {label}
            {id === "withdrawals" && (withdrawals.data?.filter((item) => item.status === "pending").length ?? 0) > 0 && <span className="tab-count">{withdrawals.data?.filter((item) => item.status === "pending").length}</span>}
          </button>
        ))}
      </div>

      {tab === "offerwalls" && (
        <div className="admin-section">
          <div className="admin-section-heading"><div><span className="eyebrow">PARTNER CONFIGURATION</span><h2>Offerwall URLs</h2></div><span className="section-count">5 PROVIDERS</span></div>
          {offerwalls.isLoading && <LoadingInline label="Loading provider settings…" />}
          {offerwalls.isError && <ErrorInline message={offerwalls.error.message} />}
          <div className="admin-provider-grid">
            {offerwalls.data?.map((wall) => <OfferwallEditor key={wall.provider} wall={wall} />)}
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="admin-section">
          <div className="admin-section-heading">
            <div><span className="eyebrow">MEMBER ACCOUNTS</span><h2>Manage user balances</h2></div>
            <label className="admin-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search username, email, or SubID" data-testid="input-search-users" /></label>
          </div>
          {users.isLoading && <LoadingInline label="Loading member accounts…" />}
          {users.isError && <ErrorInline message={users.error.message} />}
          <div className="admin-user-list">
            {visibleUsers.map((user) => <UserBalanceRow key={user.id} user={user} onUpdated={refreshAdminData} />)}
          </div>
          {!users.isLoading && !visibleUsers.length && <EmptyState title="No matching users" message="Try a different username, email address, or SubID." icon={UsersRound} />}
        </div>
      )}

      {tab === "withdrawals" && (
        <div className="admin-section">
          <div className="admin-section-heading"><div><span className="eyebrow">PAYOUT QUEUE</span><h2>Withdrawal requests</h2></div><span className="section-count">{withdrawals.data?.filter((item) => item.status === "pending").length ?? 0} PENDING</span></div>
          {withdrawals.isLoading && <LoadingInline label="Loading payout queue…" />}
          {withdrawals.isError && <ErrorInline message={withdrawals.error.message} />}
          {review.error && <ErrorInline message={review.error.message} />}
          {withdrawals.data?.length ? (
            <div className="admin-withdrawal-list">
              {withdrawals.data.map((item) => (
                <article className="admin-withdrawal-card" key={item.id} data-testid={`admin-withdrawal-${item.id}`}>
                  <div className="admin-withdrawal-user"><span className="member-avatar">{item.username.slice(0, 1).toUpperCase()}</span><div><strong>{item.username}</strong><small>{item.email}</small></div></div>
                  <div className="admin-withdrawal-main"><strong>{item.method}</strong><small>{item.destination}</small><small>{formatDate(item.createdAt)}</small></div>
                  <div className="admin-withdrawal-amount"><small>REQUESTED</small><strong>{formatCoins(item.amount)} ZX</strong></div>
                  <StatusPill status={item.status} />
                  {item.status === "pending" && (
                    <div className="review-actions">
                      <button className="approve-button" type="button" onClick={() => decideWithdrawal(item.id, "approved")} disabled={review.isPending} data-testid={`button-approve-withdrawal-${item.id}`}><CheckCheck size={14} /> Approve</button>
                      <button className="reject-button" type="button" onClick={() => decideWithdrawal(item.id, "rejected")} disabled={review.isPending} data-testid={`button-reject-withdrawal-${item.id}`}><X size={14} /> Reject</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : !withdrawals.isLoading && <EmptyState title="No withdrawal requests" message="New requests from members will appear here." icon={WalletCards} />}
        </div>
      )}

      {tab === "postback" && (
        <div className="admin-section">
          <div className="admin-section-heading"><div><span className="eyebrow">REWARD CALLBACKS</span><h2>Universal postback</h2></div><span className="postback-live"><span className="online-dot" /> READY</span></div>
          {postback.isLoading && <LoadingInline label="Loading endpoint details…" />}
          {postback.isError && <ErrorInline message={postback.error.message} />}
          {postback.data && (
            <div className="postback-panel">
              <div className="postback-icon"><Code2 size={22} /></div>
              <div><h3>Credit verified offer rewards</h3><p>Add this endpoint to each offerwall's server-to-server postback settings. Each unique transaction is credited once.</p></div>
              <label className="field-label" htmlFor="postback-url">POSTBACK URL</label>
              <div className="postback-copy-row">
                <input id="postback-url" readOnly value={postback.data.url} data-testid="input-postback-url" />
                <button type="button" className="secondary-button" onClick={copyPostback} data-testid="button-copy-postback">
                  {copied ? <Check size={15} /> : <Clipboard size={15} />} {copied ? "Copied" : "Copy URL"}
                </button>
              </div>
              <div className="postback-template-note"><ShieldCheck size={15} /><span>{postback.data.macroHelp}</span></div>
              <div className="postback-method-row"><span>METHOD</span><code>GET or POST</code><span>REWARD FORMAT</span><code>ZX Coins</code><span>IDEMPOTENCY</span><code>tx_id</code></div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
