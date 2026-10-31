import { defaults, migrate, LEGACY_KEY, STORAGE_KEY } from "./reading";
import type { State } from "./types";
import { DEMO_USER } from "./auth";

export const ACCOUNT_STORAGE_KEY = `${STORAGE_KEY}.account.${DEMO_USER.id}`;

export type StoragePort = Pick<Storage, "getItem" | "setItem">;

/** Keep corrupt bytes recoverable before allowing any new state to overwrite them. */
export function restore(storage: StoragePort): {
  state: State;
  canWrite: boolean;
  warning: boolean;
} {
  let warning = false;
  for (const key of [STORAGE_KEY, LEGACY_KEY]) {
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      return { state: defaults(), canWrite: false, warning: true };
    }
    if (!raw) continue;
    try {
      return { state: migrate(JSON.parse(raw)), canWrite: true, warning };
    } catch {
      warning = true;
      try {
        storage.setItem(`${key}.recovery.${Date.now()}`, raw);
      } catch {
        return { state: defaults(), canWrite: false, warning: true };
      }
    }
  }
  return { state: defaults(), canWrite: true, warning };
}

export function persist(storage: StoragePort, state: State): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Keep member records separate from the fresh, signed-out reading session. */
export function logoutToGuest(
  storage: StoragePort,
  state: State,
): State | null {
  try {
    storage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    return null;
  }
  const guest = defaults();
  return persist(storage, guest) ? guest : null;
}

/** Call only after credentials have been checked. */
export function restoreAccount(storage: StoragePort): State | null {
  try {
    const raw = storage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return null;
    const state = migrate(JSON.parse(raw));
    return state.demoAccountComplete && state.demoUserId === DEMO_USER.id
      ? state
      : null;
  } catch {
    return null;
  }
}
