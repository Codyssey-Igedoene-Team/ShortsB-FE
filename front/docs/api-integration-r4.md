# R4 API 연결 준비

사용자가 제공한 `api-docs.yaml`을 같은 폴더에 원본 그대로 보관했습니다. 실제 서버에는 접속하지 않았습니다.

## 현재 상태

현재 책 데이터·화면·추천·독서 기록은 그대로 로컬 구현을 사용합니다. 새 클라이언트는 화면에서 호출하거나 자동 활성화하지 않습니다. 테스트 로그인과 OAuth 버튼을 누를 때만 실제 인증을 시작하는 흐름도 유지합니다.

- `src/services/r4/contracts.ts`: 명세의 요청·응답 데이터 형식.
- `src/services/r4/contentApi.ts`: 아래 경로에 대한 명시적 호출 함수. 생성·import만으로는 통신하지 않습니다.
- `src/services/r4/adapters.ts`: 분위기 카드 변환, 프론트 0-based 위치와 서버 1-based 쪽수 변환, 도서·본문의 표시용 변환.
- 기존 `authApi.ts`: 명세와 같은 Google 이동, `/api/me`, `/api/csrf`, `/api/logout`을 사용합니다.

| 함수 | 명세의 요청 |
| --- | --- |
| getBook | GET /api/books/{bookId} |
| createPreview | POST /api/previews |
| getPreview | GET /api/previews/{previewId} |
| getContrast | POST /api/previews/{previewId}/contrast |
| startReading | POST /api/reading-sessions |
| getReading | GET /api/reading-sessions/{sessionId} |
| getCurrentReading | GET /api/reading-sessions/current?bookId=… |
| getPage | GET /api/reading-sessions/{sessionId}/pages/{pageNo} |
| saveProgress | PATCH /api/reading-sessions/{sessionId}/progress |
| completeReading | POST /api/reading-sessions/{sessionId}/complete |

모든 요청은 세션 쿠키를 포함합니다. 상태 변경 요청은 `/api/csrf`에서 토큰을 조회한 뒤 전송합니다. 오류에는 HTTP 상태와 서버 code/message를 보관합니다. 204 최근 독서 없음은 `null`, 200 대비 없음은 `available: false`로 처리합니다. 401·404·503을 정상 빈 데이터로 바꾸지 않습니다. 409에서는 `current`를 오류에 남겨 화면에서 검토하도록 하며, version만 바꿔 재전송하거나 저장·추천 요청을 자동 재시도하지 않습니다.

## 실제 연결 전에 확인할 명세 차이

1. **숫자 필드 타입**: `PreviewRequest.requestedPageCount`와 `Progress.pageNo`·`position`이 스키마에서는 `string`인데 설명·예시는 JSON 숫자입니다. 현재 요청 타입과 변환은 스키마의 문자열을 기준으로 준비했습니다. 실제 서버에서 허용하는 형식을 확인하고 명세 또는 변환을 맞춰야 합니다. 도서·세션 ID와 version은 명세대로 문자열을 유지합니다.
2. **도서 목록 API 없음**: `GET /api/books`를 임의로 만들지 않았습니다. 기존 `BookSource.list()`를 서버 조회로 교체할 수는 없습니다. 현재 명세는 추천 발췌 응답에서 얻은 서비스 내부 bookId로 상세·전체 독서를 조회하는 흐름입니다. 로컬 ID `waiting` 등을 내부 숫자 ID로 간주하지 않습니다.
3. **본문 조회는 독서 세션 기반**: bookId·edition만으로 본문을 요청하는 API가 없습니다. 전체 독서를 시작해 받은 sessionId로 페이지를 요청해야 하므로 기존 로컬 `BookSource.page()`와 바로 교체하지 않습니다.
4. **발췌와 전체 독서 분리**: 요청 10쪽과 실제 8쪽을 각각 보관해야 합니다. 발췌를 읽은 양은 전체 독서 진행률에 합산하지 않습니다. 전체 독서는 현재 위치·최대 위치·version·완료 상태를 별도로 관리해야 합니다. 오늘 목표 달성과 책 전체 완료도 다릅니다.
5. **데이터가 없는 필드**: R4 도서 응답에는 표지 URL·목차·현재 프론트의 추천 guide가 없습니다. 표시 변환에서 추천 이유나 본문을 임의 생성하지 않습니다. 현재 로컬 Book 객체에 강제 대입하지 않습니다.
6. **취향·일일 목표 API 없음**: 학생 등 생활 유형과 일일 목표 저장은 계속 로컬입니다. 추천 요청의 카드는 calm→WARM, light→HUMOR, deep→THOUGHTFUL, any→ANY로 변환합니다. 서버 프롬프트 상한 2,000 UTF-16 단위와 별개로 현재 UI의 100자 제한은 유지합니다.
7. **응답 검증**: JSON 형식 오류와 도서·본문 표시용 필수값은 검사하지만, 전체 응답의 모든 중첩 필드를 검증하는 JSON Schema 검증기는 아직 없습니다. 명세의 여러 응답 필드도 required로 지정되어 있지 않으므로 실제 응답 샘플 확인 후 검증 범위를 확정해야 합니다.

서버 접속이 가능해지면 숫자 필드 타입부터 확인한 뒤, 추천→발췌→도서 상세→전체 독서·진도 저장→완료를 하나의 내부 ID 흐름으로 연결합니다. 그 전까지 기존 화면의 데이터를 서버 응답으로 덮어쓰지 않습니다.
