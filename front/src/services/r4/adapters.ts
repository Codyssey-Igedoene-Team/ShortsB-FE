import type { Mood } from "../../domain/types";
import type {
  BookResponse,
  PageResponse,
  PreviewRequest,
  StoryType,
} from "./contracts";

export const storyTypeByMood: Record<Mood, StoryType> = {
  calm: "WARM",
  light: "HUMOR",
  deep: "THOUGHTFUL",
  any: "ANY",
};
export function toPreviewRequest(
  pageCount: number,
  mood: Mood,
  prompt = "",
): PreviewRequest {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 10)
    throw new RangeError("추천 발췌 요청은 1~10페이지입니다.");
  if (prompt.length > 2000)
    throw new RangeError("서버 프롬프트 상한은 UTF-16 2,000단위입니다.");
  return {
    requestedPageCount: String(pageCount),
    storyType: storyTypeByMood[mood],
    ...(prompt.trim() ? { prompt } : {}),
  };
}
export function pageNoFromIndex(index: number) {
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= Number.MAX_SAFE_INTEGER
  )
    throw new RangeError("프론트 페이지 위치가 올바르지 않습니다.");
  return index + 1;
}
/** Display-only projection; never invent guide text, full content or local IDs. */
export function toBookDisplay(book: BookResponse) {
  if (
    typeof book.bookId !== "string" ||
    !book.bookId ||
    typeof book.title !== "string" ||
    typeof book.author !== "string" ||
    typeof book.edition !== "string" ||
    !Number.isInteger(book.totalPageCount) ||
    book.totalPageCount < 1
  )
    throw new TypeError(
      "도서 응답의 ID·제목·저자·판본·전체 쪽수를 확인해주세요.",
    );
  return {
    id: book.bookId,
    book: book.title,
    author: book.author,
    totalPages: book.totalPageCount,
    edition: book.edition,
    editionLabel: book.editionLabel,
    translationNote: book.translationNote,
    sourceName: book.sourceName,
    source: book.sourceUrl,
    licenseURL: book.licenseUrl ?? undefined,
    licenseLabel: book.licenseLabel ?? undefined,
    credits: book.credits ?? undefined,
    textLanguage: book.language,
    workType: book.workType,
  };
}
export function toPageDisplay(page: PageResponse) {
  if (
    !Number.isInteger(page.pageNo) ||
    page.pageNo < 1 ||
    typeof page.content !== "string"
  )
    throw new TypeError("본문 응답의 페이지 번호와 내용을 확인해주세요.");
  return { index: page.pageNo - 1, text: page.content };
}
