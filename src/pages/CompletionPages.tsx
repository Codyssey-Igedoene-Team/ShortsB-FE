import { byId, availableBooks, nextRelations } from "../domain/catalog";
import {
  dose,
  goalStats,
  readPages,
  resume as getResume,
} from "../domain/reading";
import { useApp } from "../state/AppContext";
import { RecommendationCard } from "../components/RecommendationCard";
import { GuestReadingEnd } from "./GuestReadingEnd";
import {
  Back,
  BookCover,
  Button,
  Empty,
  Icon,
  Progress,
  Scene,
} from "../components/UI";
export function TrialDonePage() {
  const { state, go, continueReading } = useApp(),
    b = byId.get(state.intro?.bookId || "") || availableBooks[0];
  return (
    <section className="trial-done">
      <span className="large-check">
        <Icon name="check" />
      </span>
      <h1 className="page-title">
        첫 두 장,
        <br />
        벌써 읽었네요.
      </h1>
      <p className="muted">
        {b.book}와 보낸 짧은 시간.
        <br />
        로그인하면 오늘 읽기, 책 찾기와 나의 책장을 이용할 수 있어요.
      </p>
      <div className="done-book">
        <BookCover book={b} large />
      </div>
      <Button onClick={() => go("signup")}>
        나의 책장 만들기
        <Icon name="arrow" />
      </Button>
      <Button secondary onClick={() => go("login")}>
        이미 계정이 있어요 · 로그인
      </Button>
      <button className="text-button centered" onClick={continueReading}>
        나중에 할게요 · 계속 읽기
      </button>
    </section>
  );
}
export function CompletionPage() {
  const { state, go, resume } = useApp(),
    a = state.finished,
    b = a && byId.get(a.id);
  if (!state.demoAccountComplete) return <GuestReadingEnd />;
  if (!a || !b)
    return (
      <Empty title="한 장부터 시작해볼까요?">
        <Button onClick={() => go("home")}>오늘 읽기</Button>
      </Empty>
    );
  const full = readPages(state, b).size === b.totalPages,
    g = goalStats(state);
  return (
    <section className="completion-page">
      <span className="large-check">
        <Icon name="check" />
      </span>
      <h1 className="page-title">
        {full ? (
          <>
            한 권을,
            <br />
            끝까지 읽었어요.
          </>
        ) : (
          <>
            오늘 {a.end - a.start}페이지,
            <br />잘 읽었어요.
          </>
        )}
      </h1>
      <p className="muted">
        {b.book} · {a.start + 1}–{a.end}쪽
      </p>
      <Progress book={b} />
      <p className="small goal-celebration">
        {g.done
          ? "오늘의 독서 목표도 채웠어요."
          : `오늘 목표 ${g.current} / ${g.value}페이지`}
      </p>
      {getResume(state, b.id) && (
        <Button onClick={() => resume(b.id)}>
          이 책 이어 읽기
          <Icon name="book" />
        </Button>
      )}
      <RecommendationCard from={b.id} />
      <Button secondary onClick={() => go("home")}>
        오늘 읽기로
      </Button>
    </section>
  );
}
export function DiscoverPage() {
  const { state, location, go, start, continueReading } = useApp(),
    from =
      byId.get(location.book || state.finished?.id || "") || availableBooks[0],
    r = nextRelations(state, from.id)[0];
  if (!r)
    return (
      <section>
        <Back to="complete" />
        <Empty title="새롭게 연결할 대목은 여기까지예요.">
          <p>방금 읽은 책으로 다시 돌아가지 않아요.</p>
          <Button
            onClick={() => go(state.demoAccountComplete ? "search" : "login")}
          >
            {state.demoAccountComplete ? "다른 책 찾아보기" : "로그인"}
          </Button>
          {!state.demoAccountComplete && (
            <Button secondary onClick={continueReading}>
              읽던 이야기로 돌아가기
            </Button>
          )}
        </Empty>
      </section>
    );
  const b = byId.get(r.target)!;
  return (
    <section>
      <Back to="complete" title={r.kind} />
      <h1 className="page-title">{r.title}</h1>
      <p className="body-copy">{r.reason}</p>
      <div className="contrast-comparison">
        <div>
          <small>{from.book}</small>
          <strong>{r.fromLabel}</strong>
        </div>
        <span>↔</span>
        <div>
          <small>{b.book}</small>
          <strong>{r.toLabel}</strong>
        </div>
      </div>
      <Scene book={b} />
      <details className="home-preview">
        <summary>
          이 장면의 앞이야기
          <Icon name="down" />
        </summary>
        <p>{b.guide.context}</p>
      </details>
      <Button
        onClick={() => {
          const current = nextRelations(state, from.id).find(
            (x) => x.target === b.id,
          );
          if (!current) {
            go("complete", from.id);
            return;
          }
          const a = state.progress[from.id];
          start(b.id, b.guide.start, "excerpt", [
            ...(a?.recommendationTrail || []),
            from.id,
          ]);
        }}
      >
        이 대목 {dose(state, b, b.guide.start)}페이지 읽기
        <Icon name="arrow" />
      </Button>
      <p className="tiny muted centered">
        작품 속 장면을 연결한 shortB의 해석이에요.
      </p>
      {!state.demoAccountComplete && (
        <div className="guest-account-actions" aria-label="계정 메뉴">
          <button className="text-button" onClick={() => go("login")}>
            로그인
          </button>
          <button className="text-button" onClick={() => go("signup")}>
            회원가입
          </button>
        </div>
      )}
    </section>
  );
}
