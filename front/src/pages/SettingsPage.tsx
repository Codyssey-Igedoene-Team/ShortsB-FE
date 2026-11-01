import { useApp } from "../state/AppContext";
import type { Route } from "../app/routes";
import { Back, Icon } from "../components/UI";
export function SettingsPage() {
  const { state, go, logout, restartTest, authBusy, user } = useApp();
  const rows: [Route, string, string][] = [
    ["goals", "하루 목표", `${state.goal.value}페이지씩, 나의 속도로`],
    ["preferences", "읽기 취향", "오늘의 분위기와 읽고 싶은 책"],
    ["calendar", "독서 달력", "한 장씩 쌓아온 날들"],
    ["login", "로그인", "기존 회원 로그인 화면"],
    ["signup", "회원가입", "나의 책장 만들기"],
    ["about", "앱 안내", "본문·추천·기록 안내"],
  ];
  return (
    <section>
      <Back to="library" />
      <h1 className="page-title">설정</h1>
      {user && <p className="muted">{user.nickname || user.email}</p>}
      <div className="settings-list">
        {rows
          .filter(
            ([page]) =>
              !state.demoAccountComplete ||
              (page !== "login" && page !== "signup"),
          )
          .map(([page, title, sub]) => (
            <button key={page} onClick={() => go(page)}>
              <span>
                <strong>{title}</strong>
                <small>{sub}</small>
              </span>
              <Icon name="chevron" />
            </button>
          ))}
        {state.demoAccountComplete && (
          <button onClick={restartTest} disabled={authBusy}>
            <span>
              <strong>첫 로그인부터 테스트</strong>
              <small>기존 기록을 백업하고 로그인·첫 설정부터 시작해요.</small>
            </span>
            <Icon name="redo" />
          </button>
        )}
        {state.demoAccountComplete && (
          <button onClick={logout} disabled={authBusy}>
            <span>
              <strong>{authBusy ? "처리 중…" : "로그아웃"}</strong>
              <small>회원 기록은 보관하고 첫 체험의 1페이지로 돌아가요.</small>
            </span>
            <Icon name="chevron" />
          </button>
        )}
      </div>
      <p className="tiny muted footer-note">
        독서 기록은 이 브라우저에 저장돼요.
        <br />
        Google 계정으로 로그인하며, 독서 기록과 추천은 아직 이 브라우저에서
        관리해요.
      </p>
    </section>
  );
}
export function AboutPage() {
  return (
    <section>
      <Back to="settings" />
      <h1 className="page-title">shortB</h1>
      <div className="about-copy">
        <h2>하루의 틈을, 책 한 장으로</h2>
        <p>
          1~10페이지로 시작해 읽던 곳에서 이어 읽어요. 오늘의 분량과 책 한 권의
          완독은 따로 기록해요.
        </p>
        <h2>한국어로 읽는 고전</h2>
        <p>
          한국어 원문과 완성된 AI 번역을 제공해요. 번역 준비 중인 작품은 책장에
          담을 수 있고, 전문 번역이 준비되면 읽을 수 있어요. AI 번역은 전문
          번역가의 교열 전임을 표시해요.
        </p>
        <h2>추천은 시연 모드</h2>
        <p>
          입력한 요청·분위기·읽기 반응을 편집한 추천 근거와 연결해요. 실제 AI
          추천 API는 아직 연결하지 않았어요. 로그인은 Google 인증과 서버 세션을
          사용해요.
        </p>
        <h2>나의 기록</h2>
        <p>
          읽은 페이지·저장한 책·형광펜은 이 브라우저에 남아요. 달력의 발표용
          예시는 실제 기록과 분리돼요.
        </p>
        <h2>본문과 출처</h2>
        <p>
          책마다 원문 판본과 이용 안내를 확인할 수 있어요. 쪽수는 shortB 화면
          편집 기준이며 종이책과 달라요.
        </p>
      </div>
    </section>
  );
}
