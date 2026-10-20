import { Crown, Medal, Trophy } from "lucide-react";
import { getGetLeaderboardQueryKey, useGetLeaderboard } from "@workspace/api-client-react";
import { EmptyState, ErrorInline, formatCoins, LoadingInline, PageHeader } from "@/components/blocks";

export function LeaderboardPage() {
  const leaderboard = useGetLeaderboard({
    query: { queryKey: getGetLeaderboardQueryKey(), refetchInterval: 60000 },
  });
  const leaders = leaderboard.data ?? [];

  return (
    <section className="page-content" data-testid="page-leaderboard">
      <PageHeader eyebrow="COMMUNITY RANKINGS" title="Leaderboard" description="See how the community is stacking ZX Coins. Your next milestone is waiting." />
      {leaderboard.isLoading && <LoadingInline label="Loading top earners…" />}
      {leaderboard.isError && <ErrorInline message={leaderboard.error.message} />}
      {leaders.length > 0 && (
        <>
          <div className="leaderboard-podium">
            {[leaders[1], leaders[0], leaders[2]].filter(Boolean).map((leader) => {
              const top = leader.rank === 1;
              return (
                <div className={`podium-card podium-${leader.rank}`} key={leader.rank} data-testid={`podium-rank-${leader.rank}`}>
                  <span className="podium-crown">{top ? <Crown size={18} /> : <Medal size={18} />}</span>
                  <div className="podium-avatar">{leader.username.slice(0, 1).toUpperCase()}</div>
                  <strong>{leader.username}</strong>
                  <span className="podium-level">LEVEL {leader.level}</span>
                  <b>{formatCoins(leader.balance)} <small>ZX</small></b>
                  <span className="podium-rank-number">#{leader.rank}</span>
                </div>
              );
            })}
          </div>
          <div className="leaderboard-table">
            <div className="table-head"><span>RANK</span><span>MEMBER</span><span>LEVEL</span><span>BALANCE</span></div>
            {leaders.map((leader) => (
              <div className={`table-row ${leader.rank === 1 ? "table-row-top" : ""}`} key={leader.rank} data-testid={`row-leader-${leader.rank}`}>
                <span className="table-rank">{leader.rank === 1 ? <Trophy size={15} /> : `#${leader.rank}`}</span>
                <span className="table-member"><span className="member-avatar">{leader.username.slice(0, 1).toUpperCase()}</span><strong>{leader.username}</strong></span>
                <span className="table-level">LVL {leader.level}</span>
                <strong className="table-coins">{formatCoins(leader.balance)} <small>ZX</small></strong>
              </div>
            ))}
          </div>
        </>
      )}
      {!leaderboard.isLoading && !leaderboard.isError && !leaders.length && (
        <EmptyState title="The leaderboard is waiting" message="Be the first to earn a reward and claim the top spot." icon={Trophy} />
      )}
    </section>
  );
}
