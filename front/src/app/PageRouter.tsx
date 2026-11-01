import type { ComponentType } from "react";
import type { Route } from "./routes";
import { Brand } from "../components/UI";
import { HomePage } from "../pages/HomePage";
import { SearchPage } from "../pages/SearchPage";
import { BookPage, SourcePage } from "../pages/BookPage";
import { ReaderPage } from "../pages/ReaderPage";
import { AuthPage } from "../pages/AuthPages";
import { SetupPage, PreferencesPage, GoalsPage } from "../pages/SetupPages";
import { LibraryPage, HighlightsPage } from "../pages/LibraryPage";
import { CalendarPage } from "../pages/CalendarPage";
import {
  TrialDonePage,
  CompletionPage,
  DiscoverPage,
} from "../pages/CompletionPages";
import { SettingsPage, AboutPage } from "../pages/SettingsPage";

function OpeningPage() {
  return (
    <div className="loading-page">
      <Brand />
      <p>이야기를 펼치는 중이에요.</p>
    </div>
  );
}
function TrialPage() {
  return (
    <div className="loading-page">
      <Brand />
      <p>첫 두 페이지를 펼치고 있어요.</p>
    </div>
  );
}
const pages: Record<Route, ComponentType> = {
  index: OpeningPage,
  trial: TrialPage,
  home: HomePage,
  search: SearchPage,
  book: BookPage,
  reader: ReaderPage,
  setup: SetupPage,
  preferences: PreferencesPage,
  goals: GoalsPage,
  library: LibraryPage,
  highlights: HighlightsPage,
  calendar: CalendarPage,
  "trial-done": TrialDonePage,
  complete: CompletionPage,
  discover: DiscoverPage,
  settings: SettingsPage,
  source: SourcePage,
  about: AboutPage,
  login: AuthPage,
  signup: AuthPage,
};
export function PageRouter({ page }: { page: Route }) {
  const Page = pages[page];
  return <Page key={page} />;
}
