import type {
  BookResponse,
  PageResponse,
  PreviewRequest,
  PreviewResponse,
  ContrastResponse,
  Start,
  Complete,
  Progress,
  ReadingResponse,
  ReadingConflictResponse,
} from "./contracts";

export class ContentApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public current?: ReadingResponse,
  ) {
    super(message);
    this.name = "ContentApiError";
  }
}

const segment = (id: string) => {
  if (!id) throw new TypeError("ID가 필요합니다.");
  return encodeURIComponent(id);
};

/** Dormant until called explicitly. Creating/importing a client sends no requests. */
export function createContentApi(
  baseUrl = import.meta.env?.VITE_API_BASE_URL ?? "http://localhost:8080",
  fetcher: typeof fetch = fetch,
) {
  const base = baseUrl.replace(/\/$/, "");
  async function send<T>(
    path: string,
    method: string,
    body: unknown,
    signal?: AbortSignal,
    emptyIsNull = false,
  ): Promise<T> {
    signal?.throwIfAborted();
    let headers: Record<string, string> = {};
    if (method !== "GET") {
      const csrf = await send<{ token: string; headerName: string }>(
        "/api/csrf",
        "GET",
        undefined,
        signal,
      );
      if (!csrf.token || csrf.headerName !== "X-CSRF-TOKEN")
        throw new ContentApiError(
          "요청 인증 정보를 확인하지 못했어요.",
          0,
          "INVALID_CSRF_RESPONSE",
        );
      headers = { [csrf.headerName]: csrf.token };
    }
    signal?.throwIfAborted();
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetcher(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status === 204 && emptyIsNull) return null as T;
      const payload = await response.json().catch((error) => {
        if (controller.signal.aborted) throw error;
        return null;
      });
      if (!response.ok) {
        const error = (payload || {}) as Partial<ReadingConflictResponse>;
        throw new ContentApiError(
          typeof error.message === "string"
            ? error.message
            : "책 데이터를 요청하지 못했어요.",
          response.status,
          typeof error.code === "string" ? error.code : "HTTP_ERROR",
          error.current,
        );
      }
      if (payload === null || typeof payload !== "object")
        throw new ContentApiError(
          "서버 응답 형식을 확인하지 못했어요.",
          response.status,
          "INVALID_RESPONSE",
        );
      return payload as T;
    } catch (error) {
      if (signal?.aborted)
        throw signal.reason ?? new DOMException("Aborted", "AbortError");
      if (error instanceof ContentApiError) throw error;
      throw new ContentApiError(
        "책 서버에 연결하지 못했어요. 다시 시도해주세요.",
        0,
        controller.signal.aborted ? "TIMEOUT" : "NETWORK_ERROR",
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
  return {
    getBook: (bookId: string, signal?: AbortSignal) =>
      send<BookResponse>(
        `/api/books/${segment(bookId)}`,
        "GET",
        undefined,
        signal,
      ),
    createPreview: (request: PreviewRequest, signal?: AbortSignal) =>
      send<PreviewResponse>("/api/previews", "POST", request, signal),
    getPreview: (previewId: string, signal?: AbortSignal) =>
      send<PreviewResponse>(
        `/api/previews/${segment(previewId)}`,
        "GET",
        undefined,
        signal,
      ),
    getContrast: (previewId: string, signal?: AbortSignal) =>
      send<ContrastResponse>(
        `/api/previews/${segment(previewId)}/contrast`,
        "POST",
        undefined,
        signal,
      ),
    startReading: (request: Start, signal?: AbortSignal) =>
      send<ReadingResponse>("/api/reading-sessions", "POST", request, signal),
    getReading: (sessionId: string, signal?: AbortSignal) =>
      send<ReadingResponse>(
        `/api/reading-sessions/${segment(sessionId)}`,
        "GET",
        undefined,
        signal,
      ),
    getCurrentReading: (bookId?: string, signal?: AbortSignal) =>
      send<ReadingResponse | null>(
        `/api/reading-sessions/current${bookId === undefined ? "" : `?bookId=${segment(bookId)}`}`,
        "GET",
        undefined,
        signal,
        true,
      ),
    getPage: (sessionId: string, pageNo: number, signal?: AbortSignal) => {
      if (!Number.isInteger(pageNo) || pageNo < 1)
        throw new RangeError("서버 페이지 번호는 1 이상의 정수입니다.");
      return send<PageResponse>(
        `/api/reading-sessions/${segment(sessionId)}/pages/${pageNo}`,
        "GET",
        undefined,
        signal,
      );
    },
    saveProgress: (
      sessionId: string,
      request: Progress,
      signal?: AbortSignal,
    ) =>
      send<ReadingResponse>(
        `/api/reading-sessions/${segment(sessionId)}/progress`,
        "PATCH",
        request,
        signal,
      ),
    completeReading: (
      sessionId: string,
      request: Complete,
      signal?: AbortSignal,
    ) =>
      send<ReadingResponse>(
        `/api/reading-sessions/${segment(sessionId)}/complete`,
        "POST",
        request,
        signal,
      ),
  };
}
