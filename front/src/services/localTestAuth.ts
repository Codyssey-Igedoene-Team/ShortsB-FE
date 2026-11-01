import type { SessionUser } from "./authApi";

export const DEV_LOGIN_ENABLED = import.meta.env?.DEV === true;
export const LOCAL_TEST_SESSION_KEY = "shortb.local-test-session";
export const OAUTH_PENDING_KEY = "shortb.oauth-pending";
export const LOCAL_TEST_USER: SessionUser = {
  id: "local-test-user",
  email: "test@local.invalid",
  nickname: "테스트 사용자",
};

export function readLocalTestUser(
  storage: Pick<Storage, "getItem">,
  enabled: boolean,
): SessionUser | null {
  return enabled && storage.getItem(LOCAL_TEST_SESSION_KEY) === "active"
    ? LOCAL_TEST_USER
    : null;
}
