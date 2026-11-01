export type SessionUser = {
  id: string;
  email: string;
  nickname: string | null;
};

export class AuthApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "NETWORK_ERROR",
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

export function createAuthApi(baseUrl: string, fetcher: typeof fetch = fetch) {
  const base = baseUrl.replace(/\/$/, "");
  if (base && !/^https?:\/\/[^/]+/i.test(base))
    throw new Error("VITE_API_BASE_URL must be an HTTP(S) server URL.");
  async function request(path: string, init: RequestInit = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      return await fetcher(base + path, {
        ...init,
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });
    } catch {
      throw new AuthApiError(
        "서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
  async function failure(response: Response): Promise<never> {
    const body = (await response.json().catch(() => null)) || {};
    throw new AuthApiError(
      typeof body.message === "string"
        ? body.message
        : "인증 요청을 처리하지 못했어요.",
      response.status,
      typeof body.code === "string" ? body.code : "SERVER_ERROR",
    );
  }
  return {
    googleLoginUrl: base + "/oauth2/authorization/google",
    async me(): Promise<SessionUser | null> {
      const response = await request("/api/me");
      if (response.status === 401) return null;
      if (!response.ok) return failure(response);
      const user = await response.json().catch(() => null);
      if (
        !user ||
        typeof user.id !== "string" ||
        !user.id ||
        typeof user.email !== "string" ||
        !(user.nickname === null || typeof user.nickname === "string")
      )
        throw new AuthApiError(
          "로그인 정보를 확인하지 못했어요. 다시 시도해주세요.",
          0,
          "INVALID_RESPONSE",
        );
      return { id: user.id, email: user.email, nickname: user.nickname };
    },
    async logout(): Promise<void> {
      for (let attempt = 0; attempt < 2; attempt++) {
        const csrf = await request("/api/csrf");
        if (!csrf.ok) return failure(csrf);
        const { token, headerName } =
          (await csrf.json().catch(() => null)) || {};
        if (
          typeof token !== "string" ||
          !token ||
          headerName !== "X-CSRF-TOKEN"
        )
          throw new AuthApiError(
            "로그아웃 정보를 확인하지 못했어요. 다시 시도해주세요.",
            0,
            "INVALID_RESPONSE",
          );
        const response = await request("/api/logout", {
          method: "POST",
          headers: { [headerName]: token },
        });
        if (response.ok || response.status === 401) return;
        if (response.status === 403 && attempt === 0) {
          const error = await response
            .clone()
            .json()
            .catch(() => ({}));
          if (error?.code === "CSRF_INVALID") continue;
        }
        return failure(response);
      }
    },
  };
}

export const authApi = createAuthApi(
  import.meta.env?.VITE_API_BASE_URL ?? "http://localhost:8080",
);
