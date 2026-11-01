import { useCallback, useEffect, useState } from "react";
import {
  localBookSource,
  type BookSource,
  type BookPageRequest,
} from "../services/bookSource";

export type BookLoadState<T> = {
  status: "loading" | "success" | "error";
  data: T | null;
  error: string | null;
};

/** Cancel abandoned requests and never let an older response replace newer data. */
function useBookLoad<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<BookLoadState<T>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setState({ status: "loading", data: null, error: null });
    Promise.resolve()
      .then(() => load(controller.signal))
      .then((data) => {
        if (current) setState({ status: "success", data, error: null });
      })
      .catch(() => {
        if (current)
          setState({
            status: "error",
            data: null,
            error: "책 데이터를 불러오지 못했어요. 다시 시도해주세요.",
          });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [load, attempt]);
  return { ...state, retry };
}

export function useBooks(source: BookSource = localBookSource) {
  return useBookLoad(
    useCallback((signal: AbortSignal) => source.list(signal), [source]),
  );
}
export function useBookDetails(
  bookId: string,
  source: BookSource = localBookSource,
) {
  return useBookLoad(
    useCallback(
      (signal: AbortSignal) => source.details(bookId, signal),
      [source, bookId],
    ),
  );
}
export function useBookPage(
  request: BookPageRequest,
  source: BookSource = localBookSource,
) {
  const { bookId, edition, index } = request;
  return useBookLoad(
    useCallback(
      (signal: AbortSignal) => source.page({ bookId, edition, index }, signal),
      [source, bookId, edition, index],
    ),
  );
}
