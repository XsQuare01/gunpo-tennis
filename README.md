# 코트 한눈에 — GitHub Pages + Cloudflare Workers

군포 시민체육광장 테니스장 1~9코트의 공개 예약 현황을 날짜별로 조회합니다.
ChatGPT/Sites 계정이나 서버에 의존하지 않는 독립 배포용 코드입니다.

```
GitHub Pages의 React 화면 → 본인 Cloudflare Worker → 군포 공개 예약 API
```

## 다른 PC나 GitHub로 옮기기

ZIP을 풀고 `package.json`이 보이는 `gunpo-tennis-pages-worker` 폴더에서 시작합니다.

- **로컬 실행** — 아래 명령으로 의존성을 설치하고 웹 화면과 조회 API를 띄웁니다.
- **GitHub 저장소** — 이 폴더의 내용을 저장소 최상위에 놓습니다. 숨김 폴더인 `.github/workflows/`에 배포 절차가 들어 있습니다.
- **본인 계정 배포** — [DEPLOY.md](DEPLOY.md)를 따라 Worker를 먼저 배포한 뒤, 발급된 주소를 GitHub 저장소 변수 `VITE_API_BASE_URL`에 입력합니다.

## 로컬 실행

Node.js 22 LTS 최신 버전 또는 Node 24가 필요합니다.

```sh
npm ci
npm run dev
```

http://127.0.0.1:5173 에 접속합니다.
한 명령으로 화면(5173)과 로컬 Worker(8787)가 실행됩니다.
Cloudflare 로그인이나 배포 계정 없이 로컬 실행이 가능합니다.
기본적으로 Vite가 /api 요청을 로컬 Worker로 전달합니다.

터미널 두 개에서 각각 실행하려면 npm run dev:api, npm run dev:web 을 사용합니다.
직접 CORS를 테스트하려면 .env.local에 VITE_API_BASE_URL=http://127.0.0.1:8787 을 넣습니다.
종료는 Ctrl+C입니다.

## 본인 계정에 배포

**[DEPLOY.md](DEPLOY.md)의 순서대로 진행합니다.**

- 프런트엔드: React + Vite, GitHub Pages에 정적 파일 배포
- API: Cloudflare Workers, 군포 공개 API만 조회
- 기본 허용 출처: https://xsquare01.github.io — 계정이 다르면 wrangler.jsonc에서 변경
- GitHub 저장소 이름은 자유롭게 선택 가능. 워크플로가 Pages 경로를 자동 계산
- 실제 Worker 주소가 없거나 예시 주소이면 프런트엔드 빌드가 명확한 오류로 중단됨

## 동작

- 날짜 상태와 시간 상태를 함께 확인해 예약 가능 여부를 판정합니다.
- 전체 최대 18회 요청을 순차 처리합니다(요청 간 300ms, 조회 전체 45초 예산).
- 정상 결과만 Cloudflare Cache API에 최대 30초간 보관합니다. 자동 반복 조회는 없습니다.
- 예약자 이름/예약 번호를 브라우저에 반환하거나 캐시에 보관하지 않습니다.
- 조회 실패와 예약 마감을 구분하고, 일부 조회 실패 시 나머지 코트 결과를 표시합니다.
- 공식 일별 조회가 빈 시간표를 반환하면 현재 화면에 예약 가능한 시간이 없다고 표시될 수 있습니다. 월간 현황은 자동으로 조회하지 않으므로 이 경우 공식 사이트의 **대관현황보기**에서 해당 코트와 시간을 확인하세요.
- 선택한 코트/날짜를 공식 사이트로 전달합니다. 실제 예약·결제는 공식 사이트에서 진행합니다.
- 원본 사이트의 응답 형식/접근 정책이 바뀌거나 원본 서버가 응답하지 않으면 조회가 중단될 수 있습니다.

## 검사

```sh
npm test
npm run check:worker
npm run build
```

build에는 실제 Worker 주소를 .env.local 또는 환경변수 VITE_API_BASE_URL로 제공해야 합니다.
Node 테스트는 외부 네트워크에 접속하지 않습니다.

## 비용

2026-10-28 공식 문서 기준, 공개 GitHub 저장소 + 표준 ubuntu-latest 실행기 + GitHub Pages,
Cloudflare Workers Free 및 기본 github.io/workers.dev 주소를 사용하면 무료 범위에서 운영할 수 있습니다.

- Workers Free: 계정 전체 하루 100,000 요청, 요청당 CPU 10ms, 외부 하위 요청 50회
- 한 번의 화면 조회는 Worker 요청 1회이며, 군포 API 최대 18회 호출은 하위 요청에 해당
- 네트워크 대기는 CPU 시간에 포함되지 않음. 실제 배포에서 CPU 한도에 걸리면 오류가 날 수 있음
- 일일 무료 요청 한도 초과 시 Error 1027로 제한됨
- 이 프로젝트는 유료 요금제 전환/도메인 구매를 수행하지 않음
- 이미 유료 Workers 계정이면 그 계정의 요금제가 적용됨. 코드로 무료 계정으로 바뀌지는 않음
- KV/D1/R2, Cron, 외부 분석 서비스, AI API 사용 없음. Worker 관측 로그는 기본 비활성화
- 공개 저장소의 표준 Actions 실행기는 무료. 프라이빗 저장소/유료 실행기는 요금 조건이 다름

[Workers 가격](https://developers.cloudflare.com/workers/platform/pricing/) ·
[Workers 한도](https://developers.cloudflare.com/workers/platform/limits/) ·
[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) ·
[GitHub Actions 요금](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

CORS는 브라우저 접근 규칙이며 사용자 인증이나 호출량 제한은 아닙니다.
API는 공개 예약 현황 전용이며, API 토큰은 프런트엔드에 넣지 않습니다.

## 이번 제공본 검증

2026-10-28 기준 Node 테스트 10개, TypeScript 검사, 정적 빌드, Worker 배포 dry-run을 통과했습니다.
로컬 정적 페이지의 /gunpo-tennis/ 경로에서 다른 포트의 Worker API를 호출하는 CORS 흐름과
11월 7일 1~9코트의 실제 조회, 시간 필터, 선택 상세 표시를 확인했습니다.
GitHub/Cloudflare 사용자 계정의 실제 배포는 수행하지 않았습니다.
