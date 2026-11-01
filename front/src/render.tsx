import { renderToString } from "react-dom/server";
import { App } from "./App";
import { routes, type Route } from "./app/routes";
import { availableBooks } from "./domain/catalog";
import { defaults, startSession } from "./domain/reading";
export { routes };
export function render(page: Route) {
  let state = defaults();
  if (page === "reader")
    state = startSession(state, availableBooks[0].id, {
      start: 0,
      mode: "book",
      now: 1,
    });
  const initialLocation = { page },
    initialState = state;
  return {
    html: renderToString(
      <App initialLocation={initialLocation} initialState={initialState} />,
    ),
    data: { initialLocation, initialState },
  };
}
