/** ShortSB OpenAPI R4. This wire format is separate from the local app state. */
export type StoryType = "WARM" | "HUMOR" | "THOUGHTFUL" | "ANY";
export type BookResponse = {
  bookId: string;
  title: string;
  author: string;
  totalPageCount: number;
  edition: string;
  editionLabel: string;
  language: string;
  workType: string;
  sourceName: string;
  sourceUrl: string;
  licenseUrl: string | null;
  licenseLabel: string | null;
  credits: string | null;
  translationNote: string;
};
export type PageResponse = { pageNo: number; content: string };
export type PreviewRequest = {
  // R4 schema says string, while examples use JSON numbers. Confirm before live use.
  requestedPageCount: string;
  storyType: StoryType;
  prompt?: string | null;
};
export type PreviewResponse = {
  previewId: string;
  book: BookResponse;
  requestedPageCount: number;
  actualPageCount: number;
  startPageNo: number;
  endPageNo: number;
  storyType: StoryType;
  recommendationType: string;
  matchedPageNo: number | null;
  reason: string;
  pages: PageResponse[];
};
export type EvidenceReference = {
  bookId: string;
  startPageNo: number;
  endPageNo: number;
  quote: string;
};
export type ContrastResult = {
  relationId: string;
  contrastAxis: string;
  contrastAxisLabel: string;
  commonTopic: string;
  reason: string;
  requestedPageCount: number;
  actualPageCount: number;
  book: BookResponse;
  startPageNo: number;
  endPageNo: number;
  sourceEvidence: EvidenceReference;
  targetEvidence: EvidenceReference;
  pages: PageResponse[];
};
export type ContrastResponse = {
  available: boolean;
  sourcePreviewId: string;
  reasonCode: string | null;
  contrast: ContrastResult | null;
};
export type ReadingResponse = {
  sessionId: string;
  book: BookResponse;
  currentPageNo: number;
  currentPosition: number;
  furthestPageNo: number;
  furthestPosition: number;
  progressPercent: number;
  status: "reading" | "paused" | "completed";
  version: string;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
};
export type Start = { bookId: string };
export type Complete = { version: string };
export type Progress = {
  // R4 declares pageNo/position as strings; examples describe numeric JSON values.
  pageNo: string;
  position: string;
  version: string;
  status: "reading" | "paused";
};
export type ApiError = { code: string; message: string };
export type ReadingConflictResponse = ApiError & { current?: ReadingResponse };
