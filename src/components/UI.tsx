import type { CSSProperties, ReactNode } from "react";
import coverData from "../data/covers.json";
import { useApp } from "../state/AppContext";
import type { Route } from "../app/routes";
import {
  dose,
  estimated,
  goalStats,
  readPages,
  changeReadingDose,
} from "../domain/reading";
import { workLabel } from "../domain/catalog";
import type { Book, Goal, Session } from "../domain/types";
const paths: Record<string, string> = {
  book: "M3 4c3-1 6 0 9 2 3-2 6-3 9-2v16c-3-1-6 0-9 2-3-2-6-3-9-2V4m9 2v16",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  bookmark: "M6 3h12v19l-6-4-6 4V3",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  back: "M20 12H4m6-6-6 6 6 6",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M8 15v6",
  user: "M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0M4 22v-3a8 8 0 0 1 16 0v3",
  calendar: "M4 5h16v16H4V5m0 5h16M8 2v6m8-6v6",
  chevron: "m9 5 7 7-7 7",
  down: "m6 9 6 6 6-6",
  heart: "M12 21 3 12C-3 4 8 0 12 7c4-7 15-3 9 5z",
  highlight: "m4 17 9-12 6 5-9 12H4v-5m-1 6h9",
  mail: "M3 5h18v14H3V5m0 1 9 7 9-7",
  redo: "M20 10a8 8 0 1 0-1 7M20 4v6h-6",
  type: "M3 4h18M12 4v17M8 21h8",
};
export function Icon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg
      className={"icon " + className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.book} />
    </svg>
  );
}
export function Brand() {
  return (
    <span className="wordmark">
      <span>shortB</span>
      <i aria-hidden="true" />
    </span>
  );
}
export function BookCover({
  book: b,
  large = false,
}: {
  book: Book;
  large?: boolean;
}) {
  const [bg, fg, accent, drawing] =
    (coverData as Record<string, string[]>)[b.id] || coverData["spring-spring"];
  return (
    <span
      className={"book-cover" + (large ? " large" : "")}
      style={
        {
          "--cover-bg": bg,
          "--cover-fg": fg,
          "--cover-accent": accent,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <svg
        className="cover-art"
        viewBox="0 0 160 220"
        dangerouslySetInnerHTML={{ __html: drawing }}
      />
      <strong>{b.book}</strong>
      <small>{b.author}</small>
      <i>shortB</i>
    </span>
  );
}
export function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      className={secondary ? "button secondary" : "button primary"}
      onClick={onClick}
      type={type}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Back({ to = "home", title }: { to?: Route; title?: string }) {
  const { go, location } = useApp();
  return (
    <div className="page-back">
      <button
        className="icon-button"
        aria-label="이전 화면"
        onClick={() => go(to, location.book)}
      >
        <Icon name="back" />
      </button>
      <span>{title}</span>
    </div>
  );
}
export function Header() {
  const { go } = useApp();
  return (
    <header className="topbar">
      <button
        className="brand-button"
        aria-label="shortB 오늘 읽기로"
        onClick={() => go("home")}
      >
        <Brand />
      </button>
    </header>
  );
}
export function DailyGoal() {
  const { state, go } = useApp(),
    g = goalStats(state);
  const unit = "쪽",
    remaining = Math.max(0, g.value - g.current);
  return (
    <button
      className={"daily-goal" + (g.done ? " is-complete" : "")}
      onClick={() => go("goals")}
      aria-label={`오늘 ${g.current}/${g.value}${unit} 읽음, 목표 변경`}
    >
      <span className="daily-goal-heading">
        <span>오늘의 독서</span>
        <span className="daily-goal-edit">
          목표 변경
          <Icon name="chevron" />
        </span>
      </span>
      <span className="daily-goal-body">
        <strong>
          {g.current}
          <span>
            {" "}
            / {g.value}
            {unit}
          </span>
        </strong>
        <span className="daily-goal-status">
          {g.done ? (
            <>
              <Icon name="check" />
              오늘 목표 완료
            </>
          ) : (
            `${remaining}${unit} 더 읽으면 목표 완료`
          )}
        </span>
      </span>
      <span className="daily-goal-line" aria-hidden="true">
        <span style={{ width: `${g.ratio * 100}%` }} />
      </span>
    </button>
  );
}
export function BottomNav() {
  const { location, go } = useApp();
  return (
    <nav className="bottomnav" aria-label="주요 메뉴">
      {(
        [
          ["home", "오늘 읽기", "book"],
          ["search", "책 찾기", "search"],
          ["library", "나의 책장", "bookmark"],
        ] as const
      ).map(([page, label, icon]) => (
        <button
          key={page}
          onClick={() => go(page)}
          aria-current={location.page === page ? "page" : undefined}
        >
          <Icon name={icon} />
          {label}
        </button>
      ))}
    </nav>
  );
}
export function SaveButton({ book: b }: { book: Book }) {
  const { state, update } = useApp(),
    saved = state.saved.includes(b.id);
  return (
    <button
      className="save-book"
      aria-pressed={saved}
      onClick={() =>
        update((s) => ({
          ...s,
          saved: saved
            ? s.saved.filter((id) => id !== b.id)
            : [...new Set([...s.saved, b.id])],
        }))
      }
    >
      <Icon name={saved ? "check" : "bookmark"} />
      {saved ? "담았어요" : "책장에 담기"}
    </button>
  );
}
export function Progress({ book: b }: { book: Book }) {
  const { state } = useApp(),
    n = readPages(state, b).size;
  return (
    <div className="reading-progress">
      <div>
        <span>
          {n} / {b.totalPages} 페이지
        </span>
        <strong>
          {b.totalPages ? Math.floor((n / b.totalPages) * 100) : 0}%
        </strong>
      </div>
      <progress
        value={n}
        max={b.totalPages || 1}
        aria-label={`${b.book} 읽은 페이지`}
      />
    </div>
  );
}
export function DosePicker({
  book: b,
  start = 0,
  session,
}: {
  book: Book;
  start?: number;
  session?: Session | null;
}) {
  const { state, update } = useApp(),
    n = session ? session.end - session.cursor : dose(state, b, start),
    max = Math.min(10, b.totalPages - start);
  return (
    <div className="reading-dose">
      <label>
        읽을 분량
        <select
          value={n}
          disabled={session?.mode === "trial"}
          aria-label="오늘 읽을 페이지 수"
          onChange={(e) =>
            update((s) =>
              session
                ? changeReadingDose(s, b.id, Number(e.target.value))
                : {
                    ...s,
                    pageCount: Number(e.target.value),
                    manualDose: true,
                  },
            )
          }
        >
          {n > max && (
            <option value={n} disabled>
              현재 남은 {n}페이지
            </option>
          )}
          {Array.from({ length: max }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}페이지
            </option>
          ))}
        </select>
      </label>
      <small>약 {estimated(b.parts.slice(start, start + n).join(" "))}분</small>
    </div>
  );
}
export function GoalPicker({
  goal,
  onChange,
}: {
  goal: Goal;
  onChange: (g: Goal) => void;
}) {
  const values = [1, 3, 5, 10];
  return (
    <div className="goal-picker">
      <div
        className="goal-options"
        role="group"
        aria-label="하루 목표 페이지 수"
        style={{ gridTemplateColumns: `repeat(${values.length},1fr)` }}
      >
        {values.map((value) => (
          <button
            key={value}
            aria-pressed={goal.value === value}
            onClick={() => onChange({ unit: "pages", value })}
          >
            <strong>{value}</strong>
            <small>페이지</small>
          </button>
        ))}
      </div>
      <p className="muted small">한 페이지씩, 읽고 넘긴 만큼 쌓여요.</p>
    </div>
  );
}
export function Scene({ book: b }: { book: Book }) {
  return (
    <article className="scene-preview">
      <div className="row">
        <span>오늘 펼칠 장면</span>
        <small>{b.guide.start + 1}쪽</small>
      </div>
      <h3>{b.guide.scene}</h3>
      <blockquote>{b.guide.anchor}</blockquote>
      <p className="tiny muted">
        본문 일부 · 읽기를 누르면 한 페이지 전체가 열려요.
      </p>
    </article>
  );
}
export function BookRow({
  book: b,
  children,
}: {
  book: Book;
  children?: ReactNode;
}) {
  const { go } = useApp();
  return (
    <article className="book-row">
      <button
        className="cover-button"
        aria-label={`${b.book} 책 정보`}
        onClick={() => go("book", b.id)}
      >
        <BookCover book={b} />
      </button>
      <div>
        <button className="book-row-title" onClick={() => go("book", b.id)}>
          {b.book}
        </button>
        <p>{b.author}</p>
        <small>
          {workLabel(b)} · {b.editionLabel}
        </small>
        {children}
      </div>
      <button
        className="icon-button"
        aria-label={`${b.book} 열기`}
        onClick={() => go("book", b.id)}
      >
        <Icon name="chevron" />
      </button>
    </article>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon name="book" />
      <h2>{title}</h2>
      {children}
    </div>
  );
}
