import { Brand } from "../components/UI";
import { useApp } from "../state/AppContext";
import { DEV_LOGIN_ENABLED } from "../services/localTestAuth";

export function AuthPage() {
  const {
    location,
    go,
    login,
    continueReading,
    authBusy,
    authStatus,
    authError,
    refreshSession,
    testLogin,
  } = useApp();
  const signup = location.page === "signup";
  return (
    <section className="auth-page">
      <div className="auth-top">
        <button
          className="brand-button"
          aria-label="shortB 시작 화면"
          onClick={continueReading}
        >
          <Brand />
        </button>
        <button
          className="text-button"
          onClick={() => go(signup ? "login" : "signup")}
        >
          {signup ? "로그인" : "회원가입"}
        </button>
      </div>
      <div className="auth-copy">
        <h1>
          {signup ? (
            <>
              한 장씩 쌓일,
              <br />
              당신의 이야기.
            </>
          ) : (
            <>
              다시 만나서
              <br />
              반가워요.
            </>
          )}
        </h1>
        <p>
          {signup
            ? "소셜 계정으로 간편하게 시작해보세요."
            : "로그인하고 읽던 이야기와 나의 책장을 이어가세요."}
        </p>
      </div>
      {authStatus === "checking" && (
        <p role="status">
          로그인 상태를 확인하고 있어요. 책은 로그인 없이 읽을 수 있어요.
        </p>
      )}
      {authStatus === "error" && (
        <div className="notice-box" role="alert">
          <p>{authError}</p>
          <p>로그인 서버 연결과 관계없이 책은 계속 읽을 수 있어요.</p>
          <button className="text-button" onClick={() => void refreshSession()}>
            다시 확인하기
          </button>
        </div>
      )}
      <div className="providers">
        <button className="provider google" onClick={login} disabled={authBusy}>
          <span aria-hidden="true">G</span>
          {authBusy ? "Google로 이동 중…" : "Google로 계속하기"}
        </button>
        <button className="provider kakao" disabled>
          <span aria-hidden="true">●</span>카카오로 계속하기 · 준비 중
        </button>
        <button className="provider apple" disabled>
          <span aria-hidden="true">●</span>Apple로 계속하기 · 준비 중
        </button>
      </div>
      <p className="auth-note">
        처음 로그인하면 계정이 만들어져요. 현재는 Google 로그인을 지원해요.
      </p>
      {DEV_LOGIN_ENABLED && (
        <div className="notice-box">
          <button
            className="button secondary"
            onClick={testLogin}
            disabled={authBusy}
          >
            테스트 로그인
          </button>
          <p className="auth-note">
            백엔드 없이 목표 설정과 회원 화면을 확인할 수 있어요.
          </p>
        </div>
      )}
      <button className="text-button centered" onClick={continueReading}>
        로그인하지 않고 계속 읽기
      </button>
    </section>
  );
}
