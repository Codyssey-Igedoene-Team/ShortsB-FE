import { useEffect, useRef, useState, type ReactNode } from "react";
import { byId, availableBooks } from "../domain/catalog";
import { addHighlight, readPages } from "../domain/reading";
import { useApp } from "../state/AppContext";
import { useReadingClock } from "../hooks/useReadingClock";
import { Button, Empty, Icon } from "../components/UI";
import type { Highlight } from "../domain/types";
import { GuestReadingEnd } from "./GuestReadingEnd";
export function ReaderPage() {
  const {
      state,
      update,
      next,
      previous,
      pause,
      go,
      start,
      resume,
      ready,
      location,
      notify,
    } = useApp(),
    a = state.active,
    b = a && byId.get(a.id),
    textRef = useRef<HTMLDivElement>(null),
    [draft, setDraft] = useState<Highlight | null>(null);
  useReadingClock();
  useEffect(() => {
    setDraft(null);
    if (a?.scrollY) window.scrollTo(0, a.scrollY);
  }, [a?.id, a?.cursor]);
  useEffect(() => {
    if (!ready || location.page !== "reader" || !state.demoAccountComplete)
      return;
    const chosen = byId.get(location.book || "");
    if (chosen?.available && state.active?.id !== chosen.id) {
      if (state.progress[chosen.id] && !state.progress[chosen.id].completed)
        resume(chosen.id);
      else start(chosen.id, 0, "book");
    }
  }, [ready, location.book]);
  useEffect(() => {
    if (!a) return;
    let timer: ReturnType<typeof setTimeout>;
    const savePosition = () => {
      const y = window.scrollY;
      update((s) => {
        if (
          !s.active ||
          s.active.id !== a.id ||
          s.active.cursor !== a.cursor ||
          s.active.token !== a.token
        )
          return s;
        const current = { ...s.active, scrollY: y };
        return {
          ...s,
          active: current,
          progress: { ...s.progress, [current.id]: current },
        };
      });
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(savePosition, 160);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", savePosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", savePosition);
    };
  }, [a?.id, a?.cursor]);
  if ((!a || !b?.available) && !state.demoAccountComplete)
    return <GuestReadingEnd />;
  if (!a || !b?.available)
    return (
      <Empty title="책 한 장을 펼쳐볼까요?">
        <Button onClick={() => start(availableBooks[0].id, 0)}>
          첫 페이지 읽기
        </Button>
      </Empty>
    );
  const text = b.parts[a.cursor],
    marks = state.highlights
      .filter(
        (h) =>
          h.bookId === b.id &&
          h.edition === b.edition &&
          h.index === a.cursor &&
          text.slice(h.start, h.end) === h.text,
      )
      .sort((x, y) => x.start - y.start);
  const nodes: ReactNode[] = [];
  let offset = 0;
  for (const mark of marks) {
    nodes.push(
      text.slice(offset, mark.start),
      <mark key={mark.id} title="저장한 문장">
        {mark.text}
      </mark>,
    );
    offset = mark.end;
  }
  nodes.push(text.slice(offset));
  const completedPages = readPages(state, b);
  const completesBook =
    completedPages.size + (completedPages.has(a.cursor) ? 0 : 1) ===
    b.totalPages;
  const select = () => {
    const selection = window.getSelection(),
      root = textRef.current;
    if (!selection?.rangeCount || selection.isCollapsed || !root) {
      setDraft(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (
      !root.contains(range.startContainer) ||
      !root.contains(range.endContainer)
    ) {
      setDraft(null);
      return;
    }
    const before = range.cloneRange();
    before.selectNodeContents(root);
    before.setEnd(range.startContainer, range.startOffset);
    const startOffset = before.toString().length,
      end = startOffset + range.toString().length,
      selected = text.slice(startOffset, end);
    setDraft(
      selected.trim()
        ? {
            id: crypto.randomUUID(),
            bookId: b.id,
            edition: b.edition,
            index: a.cursor,
            start: startOffset,
            end,
            text: selected,
          }
        : null,
    );
  };
  const saveMark = () => {
    if (!draft) return;
    const updated = addHighlight(state, draft);
    update(() => updated);
    setDraft(null);
    window.getSelection()?.removeAllRanges();
    notify(
      updated === state
        ? "이미 표시한 문장과 겹쳐요."
        : "문장을 책장에 담았어요.",
    );
  };
  return (
    <section className={"reader-page" + (state.fontLarge ? " large-type" : "")}>
      <div className="reader-top">
        <button
          className="icon-button"
          onClick={!state.demoAccountComplete ? () => go("login") : pause}
          aria-label={
            !state.demoAccountComplete ? "로그인" : "읽던 위치 저장하고 나가기"
          }
        >
          <Icon name={!state.demoAccountComplete ? "user" : "back"} />
        </button>
        <div>
          <strong>{b.book}</strong>
          <small>
            {a.mode === "trial"
              ? "체험 읽기 · 첫 두 페이지"
              : state.demoAccountComplete
                ? `오늘 분량 ${a.start + 1}–${a.end}쪽`
                : "게스트 독서"}
          </small>
        </div>
        <button
          className="icon-button"
          aria-label="본문 글자 크기 바꾸기"
          aria-pressed={state.fontLarge}
          onClick={() => update((s) => ({ ...s, fontLarge: !s.fontLarge }))}
        >
          <Icon name="type" />
        </button>
      </div>
      {!state.demoAccountComplete && (
        <div className="guest-account-actions" aria-label="계정 메뉴">
          <span>이야기를 계속 읽어보세요.</span>
          <button className="text-button" onClick={() => go("login")}>
            로그인
          </button>
          <button className="text-button" onClick={() => go("signup")}>
            회원가입
          </button>
        </div>
      )}
      <div className="reader-meta">
        <span>
          {b.author} · {b.editionLabel}
        </span>
        <span>
          현재 {a.cursor + 1} / {b.totalPages}쪽
        </span>
      </div>
      <article
        className="reader-paper"
        aria-label={`${b.book} ${a.cursor + 1}쪽`}
      >
        <div
          className="reader-text"
          tabIndex={0}
          ref={textRef}
          onPointerUp={select}
          onKeyUp={select}
        >
          {nodes}
        </div>
        <span className="page-number">{a.cursor + 1}</span>
      </article>
      <div className="reader-bottom">
        <p className="tiny muted">
          마음에 남는 문장을 선택해 형광펜으로 표시하세요.
        </p>
        <button className="text-button" onClick={() => go("source", b.id)}>
          판본과 출처 보기 ↗
        </button>
        <nav className="reader-pagination" aria-label="독서 페이지 이동">
          <Button
            secondary
            disabled={a.cursor === 0}
            onClick={() => {
              setDraft(null);
              previous();
            }}
          >
            <Icon name="back" />
            이전 페이지
          </Button>
          <Button
            onClick={() => {
              setDraft(null);
              next();
            }}
          >
            {a.cursor + 1 === a.end
              ? a.mode === "trial"
                ? "첫 두 장을 읽었어요"
                : state.demoAccountComplete
                  ? "오늘 분량 읽었어요"
                  : completesBook
                    ? "이 책을 다 읽었어요"
                    : "이 대목을 읽었어요"
              : "다음 페이지"}
            <Icon name="arrow" />
          </Button>
        </nav>
        <div className="reader-position" aria-live="polite" aria-atomic="true">
          <div>
            <span>현재 읽는 위치</span>
            <strong>
              {a.cursor + 1} / {b.totalPages}쪽
            </strong>
          </div>
          <progress
            value={a.cursor + 1}
            max={b.totalPages}
            aria-label="이 책에서 현재 읽는 위치"
          />
        </div>
        {state.demoAccountComplete && a.mode !== "trial" && (
          <button className="text-button centered" onClick={pause}>
            읽던 곳 저장하고 나가기
          </button>
        )}
      </div>
      {draft && (
        <div
          className="selection-toolbar"
          role="toolbar"
          aria-label="선택한 문장"
        >
          <button onPointerDown={(e) => e.preventDefault()} onClick={saveMark}>
            <Icon name="highlight" />
            형광펜
          </button>
          <button aria-label="문장 선택 닫기" onClick={() => setDraft(null)}>
            <Icon name="close" />
          </button>
        </div>
      )}
    </section>
  );
}
