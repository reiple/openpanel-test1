# 최신 검증 결과 (2026-10-20)

- OpenPanel API·Dashboard·Worker와 PostgreSQL·Redis·ClickHouse 기동 및 헬스체크 통과.
- 기존 데이터 볼륨의 DB 비밀번호를 환경 설정에 맞춰 동기화해 API 인증 오류 복구.
- 관리자 비밀번호를 환경 설정에 맞춰 동기화한 뒤 로그인과 인증된 Dashboard HTTP 200 확인. 사용자의 브라우저 로그인 완료 확인.
- 버튼 호버·키보드 포커스 시 OpenPanel 누적 클릭 팝업 구현. 전체 보관 기간, 메뉴·버튼별 집계, 5초 캐시, 실패 상태 표시.
- Chromium에서 실제 클릭 후 OpenPanel 누적 횟수 5→6, 호버 시 클릭 이벤트 미전송, 메뉴별 구분, 다이얼로그·비활성 페이지 버튼, Escape, 조회 실패 시 버튼 동작 확인.
- Vite 개발 서버와 빌드 미리보기에서 통계 API·팝업 확인.
- 단위 테스트 9개 통과, 프로덕션 빌드 통과. 번들 크기 경고는 남아 있음.
- 전체 모바일 동작, 모든 이벤트 유형 및 사용자 지정 보고서 작성은 별도 미검증.
- 환경 파일은 Git에서 제외하며 비밀번호·키를 커밋하지 않음.

아래는 위 검증 이전의 작업 기록입니다. Docker 접근 제한 등 과거 상태는 현재 상태를 뜻하지 않습니다.

---

# 작업 현황

작성일: 2026-10-20

표시 기준: `[x]` 완료 또는 확인됨, `[ ]` 미완료 또는 미검증.
구현된 기능과 실제 서비스에서 검증된 기능을 구분한다.

## 1. React 관리 화면

- [x] React + Vite + MUI 프로젝트 구성.
- [x] 왼쪽 사이드 메뉴와 오른쪽 메인 콘텐츠 레이아웃 구현.
- [x] 대시보드, 사용자 관리, 상품 관리 메뉴별 화면 전환 구현.
- [x] 각 화면에 테이블과 버튼 배치.
- [x] 검색, 항목 추가·삭제, 페이지 이동, 페이지 크기 변경 구현.
- [x] CSV 내보내기 구현.
- [x] 모바일 사이드 메뉴 구현.
- [x] 사용자 직접 패키지 설치 및 앱 실행 완료 보고.
- [x] 프로덕션 빌드 성공 확인.
- [ ] 브라우저에서 전체 화면·버튼·모바일 동작을 자동화 또는 수동 점검한 결과 기록.

현재 데이터는 브라우저 메모리의 샘플 데이터이며 새로고침 시 초기화된다. 서버 CRUD 및 데이터 영속 저장은 현재 구현 범위에 포함하지 않았다.

## 2. Git

- [x] Git 저장소 초기화 및 `main` 브랜치 확인.
- [x] 초기 커밋 확인: `029b548` — `feat: React Vite MUI 관리 화면 구현`.
- [x] `.gitignore`에 의존성, 빌드 결과물, 환경변수, 자격증명 폴더, 로그, 에디터 파일 제외 설정.
- [x] `package-lock.json` 추적 확인.
- [ ] OpenPanel 관련 변경 사항과 본 문서 커밋. 현재 초기 커밋 이후 변경 사항은 미커밋 상태.

원격 저장소는 등록되지 않았다. 원격 저장소 연결·푸시는 별도 요청 시 진행한다.

## 3. OpenPanel Docker 구성

- [x] 공식 자체 호스팅 구성을 참고해 공개 OpenPanel Analytics 2.x 이미지 기반 Compose 작성.
- [x] Caddy, PostgreSQL, Redis, ClickHouse, OpenPanel API·Dashboard·Worker 서비스 정의.
- [x] 데이터베이스 named volume, 서비스 healthcheck, 기동 의존성 설정.
- [x] OpenPanel 접속 포트를 `127.0.0.1:3001`로 설정.
- [x] 비밀번호, 쿠키·암호화 키, 조직·프로젝트·Client ID 생성 스크립트 작성.
- [x] `infra/openpanel/.env` 및 앱용 `.env.local` 생성 완료. 실제 비밀번호 값은 문서에 기록하지 않음.
- [x] 환경 파일의 Git 제외 확인.
- [x] 관리자 등록, 조직·프로젝트·브라우저 쓰기 전용 Client 연결 자동화 코드 작성.
- [x] 기존 환경 파일 및 ID 재사용 동작 확인.
- [x] Compose 설정 문법 검증 통과.
- [ ] Docker 이미지 다운로드 및 전체 컨테이너 기동.
- [ ] PostgreSQL·ClickHouse 마이그레이션 실제 성공 확인.
- [ ] 관리자 회원가입 API 및 조직·프로젝트·Client 자동 연결의 실제 성공 확인.
- [ ] OpenPanel 로그인 및 Test Panel 프로젝트 접근 확인.
- [ ] 컨테이너 재시작 후 데이터 유지 확인.

진행 제한: 에이전트 실행 환경에서 Docker 소켓 `/var/run/docker.sock` 접근이 거부되었다. `npm run openpanel:up`을 실제 시도했지만 권한 오류로 실패했다. 따라서 Docker 실행 이후 단계는 완료로 판단하지 않는다. 로컬에서 실행한 결과에 따라 이미지·API·DB 스키마 호환성 추가 수정이 필요할 수 있다.

## 4. 앱 통계 이벤트

- [x] OpenPanel HTTP Track API 전송 모듈 작성.
- [x] 최초 화면과 메뉴 전환의 `screen_view`, `menu_view` 이벤트 연결.
- [x] 화면별 안정적인 버튼 ID를 사용하는 `button_click` 이벤트 연결.
- [x] 목록 표시 시 `table_view` 이벤트 연결.
- [x] 메뉴, 버튼, 테이블, 조회 원인, 페이지·페이지 크기, 행 개수 속성 정의.
- [x] 메뉴 재선택 및 동일 화면 재렌더링에 따른 방문 중복 방지 로직 작성.
- [x] React StrictMode effect 중복 방지와 검색 입력 400ms 디바운스 로직 작성.
- [x] 이름·이메일·검색어·행 ID·CSV 내용을 이벤트에서 제외.
- [x] 통계 전송 실패가 화면 동작을 막지 않도록 처리.
- [x] 메뉴 방문 중복, 테이블 조회 구분, 버튼의 출발 화면, HTTP 요청 형식, 통계 서버 장애 처리 단위 테스트 5개 통과.
- [ ] 브라우저에서 각 메뉴·버튼·테이블의 실제 이벤트 전송 확인.
- [ ] CORS 허용 및 `/api/track` 요청의 정상 응답 확인.
- [ ] OpenPanel Realtime/Events에서 이벤트 수신 확인.
- [ ] 실제 사용자 동작 횟수와 집계 횟수 대조, StrictMode 환경의 중복 전송 여부 확인.

`table_view`는 현재 클라이언트 목록 표시 횟수이며 서버 API 조회 횟수가 아니다. 조회 원인은 `menu_enter`, `search`, `pagination`, `page_size`, `data_change`로 구분한다. `screen_view`와 `menu_view`는 같은 방문의 별도 이벤트이므로 합산하지 않는다. 실패한 이벤트의 재전송 기능은 구현하지 않았다.

## 5. OpenPanel 통계 보고서

- [x] README에 실행 방법, 로그인 정보 위치, 이벤트 및 집계 기준, 보고서 생성 방법 작성.
- [ ] 메뉴별 방문 보고서 생성: `menu_view`, Count, `menu` 기준 그룹.
- [ ] 화면별 버튼 클릭 보고서 생성: `button_click`, Count, `menu`·`button` 기준 그룹.
- [ ] 화면별 테이블 조회 보고서 생성: `table_view`, Count, `menu`·`reason` 기준 그룹.
- [ ] 생성한 보고서의 통계와 필터 동작 확인.

사용자 지정 보고서는 현재 자동 생성하지 않으며, OpenPanel 기동 후 Dashboard에서 생성해야 한다.

## 6. 확인된 검증 결과

아래 결과는 OpenPanel 연동 코드를 작성한 뒤 수행한 검증이다. 본 문서 작성 시 해당 검사를 다시 실행하지는 않았다.

| 검증 | 마지막 확인 결과 |
| --- | --- |
| `npm test` | 5개 통과 |
| `npm run build` | 성공 |
| `npm run openpanel:setup` | 환경 파일 생성 및 재실행 성공 |
| `npm run openpanel:config` | 성공 |
| `node --check scripts/openpanel.mjs` | 성공 |
| `node --check src/usePanelAnalytics.js` | 성공 |
| `git diff --check` | 통과 |
| 환경 파일 Git 제외 | 확인 |
| `npm run openpanel:up` | Docker 소켓 접근 권한 오류로 실패 |
| 브라우저 → OpenPanel 수집·집계 | 미검증 |

빌드 시 JavaScript 번들 약 505kB에 대한 크기 경고가 발생한다. 빌드는 성공했으며, 코드 분할 등 최적화는 진행하지 않았다.

## 7. 다음 진행 순서

1. Docker 접근이 가능한 로컬 터미널에서 `npm run openpanel:up` 실행.
2. `npm run openpanel:status`로 상태 확인. 실패 시 `npm run openpanel:logs`로 원인 확인.
3. 관리자 등록 후 프로젝트 연결만 실패했다면 원인을 수정하고 `npm run openpanel:bootstrap` 재실행.
4. `http://localhost:3001` 접속. 로그인 정보는 `infra/openpanel/.env`의 `OP_ADMIN_EMAIL`, `OP_ADMIN_PASSWORD` 사용.
5. 실행 중인 Vite를 종료한 뒤 `npm run dev`로 재시작하여 `.env.local` 반영.
6. 각 메뉴·버튼·테이블을 조작하고 브라우저 요청 및 OpenPanel 이벤트 수신 확인.
7. 위 세 가지 통계 보고서 생성 및 집계 결과 대조.
8. 검증 결과를 본 문서에 반영하고 변경 사항 커밋.

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `src/main.jsx` | 관리 화면과 버튼 추적 식별자 |
| `src/styles.css` | 화면 스타일 및 반응형 레이아웃 |
| `src/analytics.js` | 이벤트 집계 및 OpenPanel HTTP 전송 |
| `src/usePanelAnalytics.js` | React 화면·테이블·버튼 추적 연결 |
| `tests/analytics.test.js` | 이벤트 집계 및 장애 처리 테스트 |
| `infra/openpanel/compose.yaml` | OpenPanel Docker 서비스 구성 |
| `infra/openpanel/Caddyfile` | Dashboard 및 API 프록시 |
| `infra/openpanel/clickhouse/` | ClickHouse 설정 및 초기 DB 생성 |
| `scripts/openpanel.mjs` | 설정 생성, 기동·중지, 관리자·프로젝트 연결 |
| `.env.example` | 공개 브라우저 환경변수 예시 |
| `README.md` | 실행·운영·통계 확인 안내 |
