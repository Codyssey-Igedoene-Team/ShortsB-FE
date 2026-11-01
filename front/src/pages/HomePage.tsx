import { useState } from "react";
import { byId, recommend } from "../domain/catalog";
import { dayKey, dose, pending, goalStats } from "../domain/reading";
import { useApp } from "../state/AppContext";
import {
  BookCover,
  Button,
  ReadingPlan,
  DailyGoal,
  Icon,
  Progress,
  SaveButton,
} from "../components/UI";
export function HomePage() {
  const { state, go, start, resume, update } = useApp(),
    [seen, setSeen] = useState<string[]>([]),
    [fresh, setFresh] = useState(false);
  const active = fresh ? null : pending(state)[0],
    b = active ? byId.get(active.id)! : recommend(state, seen),
    offset = active ? active.cursor : b.guide.start,
    n = active ? active.end - active.cursor : dose(state, b, offset);
  return (
    <section className="book-home">
      <div className="book-spotlight">
        <button
          className="spotlight-cover"
          aria-label={`${b.book} 책 정보 보기`}
          onClick={() => go("book", b.id)}
        >
          <BookCover book={b} large />
        </button>
        <div className="spotlight-copy">
          {active && <small className="reading-state">이어 읽는 책</small>}
          <h1>{b.book}</h1>
          <p>{b.author}</p>
          <SaveButton book={b} />
        </div>
      </div>
      {active ? (
        <>
          <Progress book={b} />
        </>
      ) : (
        <section className="why-this-book">
          <div className="row">
            <h2>이 책을 권하는 이유</h2>
            <button className="text-button" onClick={() => go("preferences")}>
              취향 변경 <Icon name="settings" />
            </button>
          </div>
          <p>
            {state.profile?.thought &&
            !b.guide.keywords.some((k) => state.profile!.thought.includes(k))
              ? "선택한 분위기에서 읽어볼 이야기를 골랐어요. "
              : ""}
            {b.guide.reason}
          </p>
        </section>
      )}
      <div className="reading-action">
        <ReadingPlan book={b} start={offset} session={active || null} />
        <Button onClick={() => (active ? resume(b.id) : start(b.id))}>
          {goalStats(state).done && active?.mode !== "trial"
            ? "계속 읽기"
            : n === 1
              ? `${offset + 1}페이지 읽기`
              : `${offset + 1}페이지부터 ${offset + n}페이지까지 읽기`}
          <Icon name="book" />
        </Button>
        <p className="reading-note">
          {offset + 1}–{offset + n}쪽
        </p>
      </div>
      <DailyGoal />
      <div className="recommend-feedback">
        <button
          aria-pressed={state.feedback[b.id] === "like"}
          onClick={() =>
            update((s) => ({
              ...s,
              feedback: {
                ...s.feedback,
                [b.id]: s.feedback[b.id] === "like" ? "" : "like",
              },
            }))
          }
        >
          <Icon name="heart" />
          {state.feedback[b.id] === "like"
            ? "취향에 반영했어요"
            : "이런 책 좋아요"}
        </button>
        <button
          onClick={() => {
            setFresh(true);
            setSeen((s) => (s.length > 12 ? [b.id] : [...s, b.id]));
          }}
        >
          다른 책 보기
          <Icon name="redo" />
        </button>
      </div>
      <button className="journal-link" onClick={() => go("calendar")}>
        <span className="journal-icon">
          <Icon name="calendar" />
        </span>
        <span>
          <strong>
            {state.readLog.some((r) => r.day === dayKey())
              ? "오늘의 독서가 남았어요"
              : "한 페이지부터 기록해보세요"}
          </strong>
          <small>
            {state.readLog.length
              ? `지금까지 ${state.readLog.length}페이지를 읽었어요`
              : "읽은 날과 마음에 남은 책을 모아요"}
          </small>
        </span>
        <Icon name="chevron" />
      </button>
      <p className="tiny muted footer-note">
        준비된 작품과 읽기 기록을 활용한 추천 시연이에요.
      </p>
    </section>
  );
}
