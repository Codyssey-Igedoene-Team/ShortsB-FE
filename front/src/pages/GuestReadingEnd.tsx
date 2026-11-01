import { Brand, BookCover, Button, Icon } from "../components/UI";
import { byId, nextRelations } from "../domain/catalog";
import { RecommendationCard } from "../components/RecommendationCard";
import { guestReadingTarget, readPages } from "../domain/reading";
import { useApp } from "../state/AppContext";

export function GuestReadingEnd() {
  const { state, go, continueReading } = useApp();
  const finished = state.finished;
  const book = finished?.completed ? byId.get(finished.id) : undefined;
  const count = book ? readPages(state, book).size : 0;
  const complete = !!book && count === book.totalPages;
  const target = guestReadingTarget(state);
  const relation = book && nextRelations(state, book.id)[0];

  return (
    <section className="guest-end" aria-labelledby="guest-end-title">
      <header className="guest-end-header">
        <Brand />
        <span>게스트 독서</span>
      </header>
      <div className="guest-end-intro">
        <span className="guest-end-symbol" aria-hidden="true">
          <Icon name={complete ? "check" : "book"} />
        </span>
        <p className="guest-end-eyebrow">
          {book ? "이야기와 함께한 시간" : "잠깐의 틈, 한 편의 이야기"}
        </p>
        <h1 id="guest-end-title">
          {complete ? (
            <>
              한 권의 마지막 장까지,
              <br />잘 읽었어요.
            </>
          ) : book ? (
            <>
              여기까지 읽었어요.
              <br />
              다음 장도 함께할까요?
            </>
          ) : (
            <>
              다음 이야기를
              <br />
              만나볼까요?
            </>
          )}
        </h1>
        <p className="guest-end-description">
          {complete
            ? relation?.kind === "다시 읽기 추천"
              ? "준비된 대목들을 모두 만났다면, 마음에 남은 이야기를 다시 읽어보세요."
              : "잠시 여운을 느끼고, 새로운 이야기를 펼쳐보세요."
            : "마음이 가는 만큼, 편하게 읽어보세요."}
        </p>
        {book && (
          <div className="guest-end-record">
            <BookCover book={book} />
            <div>
              <strong>{book.book}</strong>
              <span>{book.author}</span>
              <small>
                {complete
                  ? `${count}쪽 · 완독`
                  : `${count} / ${book.totalPages}쪽 읽음`}
              </small>
            </div>
            {complete && (
              <span className="guest-end-done">
                <Icon name="check" />
                완독
              </span>
            )}
          </div>
        )}
      </div>
      {target && (!relation || target.book.id === book?.id) && (
        <section className="guest-next" aria-labelledby="guest-next-title">
          <div className="guest-next-heading">
            <h2 id="guest-next-title">
              {target.start > 0
                ? "아직 남아 있는 이야기"
                : "이어서 만날 이야기"}
            </h2>
            <span>
              {target.start > 0 ? `${target.start + 1}쪽부터` : "새로운 한 권"}
            </span>
          </div>
          <div className="guest-next-book">
            <BookCover book={target.book} />
            <div>
              <h3>{target.book.book}</h3>
              <p className="guest-next-author">{target.book.author}</p>
              <p className="guest-next-reason">{target.book.guide.reason}</p>
            </div>
          </div>
          <Button onClick={continueReading}>
            {target.start > 0 ? "이 책 계속 읽기" : "다음 책 펼치기"}
            <Icon name="arrow" />
          </Button>
          <p className="guest-next-note">로그인 없이 계속 읽을 수 있어요.</p>
        </section>
      )}
      {book && <RecommendationCard from={book.id} />}
      <aside
        className="guest-end-account"
        aria-labelledby="guest-account-title"
      >
        <span className="guest-end-account-icon" aria-hidden="true">
          <Icon name="bookmark" />
        </span>
        <h2 id="guest-account-title">읽은 이야기를 나의 책장에</h2>
        <p>
          로그인하고 오늘 읽기, 책 찾기,
          <br />
          나의 책장도 함께 이용해보세요.
        </p>
        <div>
          <button onClick={() => go("login")}>로그인</button>
          <button onClick={() => go("signup")}>
            회원가입 <Icon name="arrow" />
          </button>
        </div>
      </aside>
      <p className="guest-end-footer">한 장씩, 나의 속도로.</p>
    </section>
  );
}
