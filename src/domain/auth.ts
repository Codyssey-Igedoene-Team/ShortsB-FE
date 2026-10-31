import type { State } from "./types";

export const DEMO_USER = {
  id: "demo@shortb.com",
  password: "Shortb123!",
} as const;

/** Local demo credentials only; no password is written to browser storage. */
export function authenticateDemo(
  state: State,
  id: string,
  password: string,
): State | null {
  if (id.trim() !== DEMO_USER.id || password !== DEMO_USER.password)
    return null;
  return { ...state, demoAccountComplete: true, demoUserId: DEMO_USER.id };
}
