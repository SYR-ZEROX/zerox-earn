import { useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import { getGetCurrentUserQueryKey, useGetCurrentUser } from "@workspace/api-client-react";
import { AppShell } from "@/components/AppShell";
import { AuthPage } from "@/pages/auth-page";
import { AdminPage } from "@/pages/admin-page";
import { CashoutPage } from "@/pages/cashout-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { LeaderboardPage } from "@/pages/leaderboard-page";
import { OfferwallPage } from "@/pages/offerwall-page";
import { ProfilePage } from "@/pages/profile-page";
import NotFound from "@/pages/not-found";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="loading-screen" data-testid="status-loading">
      <span className="loading-mark"><span /></span>
      <p>Connecting to ZEROX EARN</p>
    </div>
  );
}

function ApiUnavailable() {
  return (
    <div className="loading-screen" data-testid="status-api-unavailable">
      <div className="connection-card">
        <span className="connection-icon">!</span>
        <h1>Connection interrupted</h1>
        <p>ZEROX EARN could not reach the account service. Refresh this page to try again.</p>
        <button className="primary-button" type="button" onClick={() => window.location.reload()} data-testid="button-retry">
          Retry connection
        </button>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <section className="page-content">
      <div className="empty-state">
        <h1>Admin access required</h1>
        <p>Your account does not have permission to view this page.</p>
      </div>
    </section>
  );
}

function AppRouter() {
  const [location, setLocation] = useLocation();
  const currentUser = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      retry: false,
      refetchOnWindowFocus: false,
    },
  });
  const errorStatus =
    typeof currentUser.error === "object" && currentUser.error !== null && "status" in currentUser.error
      ? Number(currentUser.error.status)
      : undefined;
  const user = currentUser.data;

  useEffect(() => {
    if (currentUser.isLoading) return;
    if (user && location === "/") setLocation("/dashboard");
    if (!user && errorStatus === 401 && location !== "/") setLocation("/");
  }, [currentUser.isLoading, errorStatus, location, setLocation, user]);

  if (currentUser.isLoading) return <LoadingScreen />;
  if (!user && errorStatus !== 401) return <ApiUnavailable />;
  if (!user) return <AuthPage />;
  if (location === "/") return <LoadingScreen />;

  return (
    <AppShell user={user}>
      <Switch>
        <Route path="/dashboard"><DashboardPage /></Route>
        <Route path="/cashout"><CashoutPage /></Route>
        <Route path="/leaderboard"><LeaderboardPage /></Route>
        <Route path="/profile"><ProfilePage /></Route>
        <Route path="/earn/mooffers"><OfferwallPage provider="mooffers" /></Route>
        <Route path="/earn/offery"><OfferwallPage provider="offery" /></Route>
        <Route path="/earn/upwall"><OfferwallPage provider="upwall" /></Route>
        <Route path="/earn/gimiwall"><OfferwallPage provider="gimiwall" /></Route>
        <Route path="/earn/revtoo"><OfferwallPage provider="revtoo" /></Route>
        <Route path="/admin">
          {user.role === "admin" ? <AdminPage /> : <AccessDenied />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <RoutedErrorBoundary>
            <AppRouter />
          </RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
