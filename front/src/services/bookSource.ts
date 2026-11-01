import type { Book } from "../domain/types";
import { books } from "../domain/catalog";

/** Frontend display models, not a proposed server response format. */
export type BookSummary = Pick<
  Book,
  | "id"
  | "book"
  | "author"
  | "description"
  | "workType"
  | "edition"
  | "editionLabel"
  | "available"
  | "totalPages"
> & { coverUrl?: string };
export type BookDetails = Omit<Book, "parts"> & { coverUrl?: string };
export type BookPageRequest = {
  bookId: string;
  edition: string;
  index: number;
};
export type BookPageData = BookPageRequest & {
  text: string;
  totalPages: number;
};

/** An API adapter can implement this interface once its contract is available. */
export interface BookSource {
  list(signal?: AbortSignal): Promise<BookSummary[]>;
  details(bookId: string, signal?: AbortSignal): Promise<BookDetails | null>;
  page(
    request: BookPageRequest,
    signal?: AbortSignal,
  ): Promise<BookPageData | null>;
}

export function createLocalBookSource(catalog: readonly Book[]): BookSource {
  const byId = new Map(catalog.map((book) => [book.id, book]));
  return {
    async list(signal) {
      signal?.throwIfAborted();
      return catalog.map(
        ({
          id,
          book,
          author,
          description,
          workType,
          edition,
          editionLabel,
          available,
          totalPages,
        }) => ({
          id,
          book,
          author,
          description,
          workType,
          edition,
          editionLabel,
          available,
          totalPages,
        }),
      );
    },
    async details(bookId, signal) {
      signal?.throwIfAborted();
      const book = byId.get(bookId);
      if (!book) return null;
      const { parts: _parts, ...details } = book;
      return structuredClone(details);
    },
    async page(request, signal) {
      signal?.throwIfAborted();
      if (!Number.isInteger(request.index) || request.index < 0)
        throw new RangeError("페이지 위치는 0 이상의 정수여야 합니다.");
      const book = byId.get(request.bookId);
      if (
        !book?.available ||
        book.edition !== request.edition ||
        request.index >= book.parts.length
      )
        return null;
      return {
        ...request,
        text: book.parts[request.index],
        totalPages: book.totalPages,
      };
    },
  };
}

// Local data remains the default. Importing this module makes no network requests.
export const localBookSource = createLocalBookSource(books);
