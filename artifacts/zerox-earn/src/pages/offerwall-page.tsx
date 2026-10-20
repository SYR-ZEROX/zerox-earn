import { useState } from "react";
import { ArrowUpRight, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import {
  getGetCurrentUserQueryKey,
  getGetOfferwallQueryKey,
  useGetCurrentUser,
  useGetOfferwall,
  type ProviderSlug,
} from "@workspace/api-client-react";
import { EmptyState, ErrorInline, LoadingInline, PageHeader } from "@/components/blocks";

const providerNames: Record<ProviderSlug, string> = {
  mooffers: "MoOffers",
  offery: "Offery",
  upwall: "Upwall",
  gimiwall: "Gimiwall",
  revtoo: "Revtoo",
};

export function OfferwallPage({ provider }: { provider: ProviderSlug }) {
  const [reloadKey, setReloadKey] = useState(0);
  const wall = useGetOfferwall(provider, {
    query: { queryKey: getGetOfferwallQueryKey(provider), staleTime: 0 },
  });
  const user = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() },
  });
  const title = wall.data?.name ?? providerNames[provider];

  return (
    <section className="page-content" data-testid={`page-offerwall-${provider}`}>
      {wall.isLoading && <LoadingInline label={`Loading ${title}…`} />}
      {wall.isError && <ErrorInline message={wall.error.message} />}
      {wall.data && (
        <>
          <PageHeader
            eyebrow="OFFERWALL PARTNER"
            title={title}
            description="Complete partner offers and earn ZX Coins directly to your account."
            action={
              <button
                type="button"
                className="secondary-button reload-wall"
                onClick={() => setReloadKey((key) => key + 1)}
                data-testid="button-reload-wall"
              >
                <RefreshCw size={15} /> Reload wall
              </button>
            }
          />
          <div className="offerwall-status-strip">
            <div className="provider-status"><span className="online-dot" /><strong>{wall.data.online ? "ONLINE" : "OFFLINE"}</strong><small>PARTNER STATUS</small></div>
            <div className="provider-id"><span>YOUR SUBID</span><code data-testid="text-offerwall-subid">{user.data?.id ?? "Loading…"}</code></div>
            {wall.data.launchUrl && (
              <a className="text-link provider-open-link" href={wall.data.launchUrl} target="_blank" rel="noreferrer" data-testid="link-open-wall-new-tab">
                Open in new tab <ExternalLink size={14} />
              </a>
            )}
          </div>
          {wall.data.launchUrl ? (
            <div className="iframe-wrap" key={reloadKey} data-testid="offerwall-frame">
              <div className="iframe-topline"><span><span className="online-dot" /> SECURE PARTNER CONNECTION</span><ShieldCheck size={15} /></div>
              <iframe
                key={`${wall.data.launchUrl}-${reloadKey}`}
                src={wall.data.launchUrl}
                title={`${title} offerwall`}
                className="offerwall-iframe"
                sandbox="allow-forms allow-scripts allow-same-origin"
                referrerPolicy="strict-origin-when-cross-origin"
                data-testid="iframe-offerwall"
              />
            </div>
          ) : (
            <div className="offerwall-placeholder" data-testid="state-offerwall-unconfigured">
              <div className="placeholder-grid" aria-hidden="true" />
              <div className="placeholder-content">
                <div className="placeholder-emblem"><span>{title.slice(0, 1)}</span></div>
                <span className="eyebrow">PARTNER CONNECTION READY</span>
                <h2>{title} is almost ready.</h2>
                <p>Your SubID is ready. An admin can connect this partner URL from the control panel.</p>
                <div className="placeholder-id"><small>YOUR SUBID</small><code>{user.data?.id ?? "Loading…"}</code></div>
                {user.data?.role === "admin" && (
                  <Link href="/admin" className="primary-button" data-testid="link-configure-wall">
                    Configure partner <ArrowUpRight size={15} />
                  </Link>
                )}
                <small className="placeholder-footnote">Offerwall URL for {title} can be configured in the Admin Panel</small>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
