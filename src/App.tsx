import { AppProvider, useApp } from "./state/AppContext";
import { useTrial } from "./hooks/useTrial";
import { AppLayout } from "./layouts/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PageRouter } from "./app/PageRouter";
import type { Location } from "./app/routes";
import type { State } from "./domain/types";
import { resolveLocation } from "./app/routes";

function AppContent() {
  const { location, state } = useApp();
  useTrial();
  return (
    <AppLayout>
      <PageRouter page={resolveLocation(state, location).page} />
    </AppLayout>
  );
}
export function App({
  initialLocation,
  initialState,
}: {
  initialLocation?: Location;
  initialState?: State;
}) {
  return (
    <ErrorBoundary>
      <AppProvider
        initialLocation={initialLocation}
        initialState={initialState}
      >
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
