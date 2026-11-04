# 본인 계정 배포 안내

이 폴더 전체가 하나의 GitHub 저장소가 됩니다. 기존 Sites 배포와 연결할 필요가 없습니다.
설정 예시는 GitHub 계정 XsQuare01, 새 저장소 gunpo-tennis를 기준으로 합니다.

## 1. 계정과 저장소 준비

- GitHub에서 **공개(Public)** 저장소 gunpo-tennis를 만듭니다. GitHub Free에서 Pages를 무료로 쓰기 위한 조건입니다.
- Cloudflare에 로그인하고 Workers 요금제가 **Free**인지 확인합니다.
- 기본 github.io와 workers.dev 주소를 사용하면 도메인을 구매할 필요가 없습니다.
- 기존에 Workers Paid를 사용 중인 계정은 그 요금제가 적용되므로 먼저 계정의 요금제를 확인하세요.

## 2. 조회 API 배포

이 프로젝트 폴더에서 실행합니다.

```sh
npm ci
npx wrangler login
```

브라우저에서 본인 Cloudflare 계정으로 로그인합니다. 토큰을 코드나 채팅에 붙여 넣을 필요가 없습니다.
여러 Cloudflare 계정이 있다면 본인이 배포할 계정을 선택합니다.

wrangler.jsonc의 기본 vars를 확인합니다.

```json
"vars": {
  "ALLOWED_ORIGINS": "https://xsquare01.github.io"
}
```

이 값은 페이지의 **출처(origin)**입니다.
실제 페이지가 https://xsquare01.github.io/gunpo-tennis/ 이어도 /gunpo-tennis/를 넣지 않습니다.
https로 시작하는 도메인만 쓰고 마지막 /도 생략합니다.
여러 출처는 쉼표로 구분하며 와일드카드(*)는 쓰지 않습니다.
env.local 부분은 로컬 테스트 전용이므로 그대로 둡니다.

```sh
npm run deploy:api
```

출력되는 주소를 기록합니다. 형식은 다음과 같습니다.

```text
https://gunpo-tennis-api.본인하위도메인.workers.dev
```

해당 주소 뒤에 /health를 붙여 접속하면 {"ok":true,"service":"gunpo-tennis-api"}가 나옵니다.
배포 명령은 계정을 유료로 전환하지 않습니다.

## 3. GitHub Pages 설정

GitHub 저장소의 Settings → Secrets and variables → Actions → **Variables**에서:

| 이름 | 값 |
|---|---|
| VITE_API_BASE_URL | 2단계의 실제 Worker 주소 (https://…workers.dev) |

/api/availability 등의 경로를 붙이지 않습니다.
이 값은 공개 API 주소이며 비밀 토큰이 아닙니다.
Cloudflare API 토큰은 절대 VITE_ 변수에 넣지 마세요.

Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 선택합니다.

## 4. 소스 올리기

ZIP을 사용한다면 압축을 푼 프로젝트 폴더에서 시작합니다.
node_modules, dist, .env.local 등은 올리지 않습니다(.gitignore가 제외).
.github/workflows 폴더는 반드시 포함합니다.

```sh
git init -b main
git add .
git commit -m "Add tennis availability dashboard"
git remote add origin https://github.com/XsQuare01/gunpo-tennis.git
git push -u origin main
```

계정/저장소명이 다르면 remote 주소를 바꿉니다.
이미 초기화한 저장소라면 git init과 remote add는 생략하고 기존 remote를 확인합니다.
GitHub 인증은 본인이 평소 쓰는 GitHub 로그인 방법을 사용합니다.

main에 push하면 **Deploy GitHub Pages**가 자동 실행됩니다.
설정 전에 이미 push했다면 Variables와 Pages 설정을 완료한 뒤
Actions → Deploy GitHub Pages → Run workflow로 다시 실행합니다.

완료 후 Actions의 배포 링크 또는 Settings → Pages의 주소로 접속합니다.
예시 주소: https://xsquare01.github.io/gunpo-tennis/

저장소명이 XsQuare01.github.io라면 워크플로가 루트 경로 /를 자동 선택합니다.
다른 저장소명은 /저장소명/ 경로를 자동 사용합니다.

## 5. 배포 후 확인

1. 날짜를 선택하면 1~9코트가 표시되는지 확인합니다.
2. 예약 가능한 시간만 필터링해 봅니다.
3. 시간 선택 후 공식 사이트에 코트/날짜가 전달되는지 확인합니다.
4. 조회 시각과 공식 사이트의 현재 현황을 비교합니다.

무료 Worker의 CPU 한도와 원본 사이트의 해외 서버 접근 허용 여부는 실제 계정 배포 후 확인해야 합니다.
현재 제공된 코드는 로컬 빌드/Worker 실행과 공개 API 연동을 검증하는 용도이며,
사용자 계정에 실제 배포하기 전에는 해당 계정의 운영 결과가 확인된 것은 아닙니다.

## API 코드를 수정한 뒤

로컬 로그인 상태에서 npm run deploy:api를 다시 실행하면 됩니다.
화면 변경은 main push로 자동 반영됩니다.
ALLOWED_ORIGINS 변경도 Worker 재배포가 필요합니다.

선택 사항으로 **Deploy Cloudflare Worker** 워크플로를 수동 실행할 수 있습니다.
이 경우 GitHub Actions **Secrets**에 CLOUDFLARE_API_TOKEN과 CLOUDFLARE_ACCOUNT_ID를 설정합니다.
본인 계정의 Workers 배포에 필요한 권한만 가진 API 토큰을 Cloudflare에서 발급하세요.
[공식 GitHub Actions 배포 안내](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)

Worker 워크플로는 수동 실행만 지원하므로 소스를 push했다고 API가 자동 변경되지는 않습니다.

## 문제 해결

- 빌드가 VITE_API_BASE_URL 오류로 중단: 저장소의 Actions Variables와 실제 Worker 주소 확인
- 화면에서 API 연결 실패: Worker /health, ALLOWED_ORIGINS의 대소문자/https/포트/경로 확인
- 403: Pages의 실제 origin이 Worker 설정과 일치하지 않음
- 502: 군포 사이트의 조회 실패. 잠시 후 재조회하거나 공식 사이트에서 확인
- 1027: Workers Free 계정의 일일 요청 한도 초과
- 1102: CPU 등 Worker 자원 한도 초과. Cloudflare 대시보드에서 확인하고 코드 최적화 필요
- 설정을 바꿨는데 그대로: Worker 설정은 API 재배포, VITE_ 변수는 Pages 재빌드 필요

## 로컬에서 배포 형태 확인

터미널 하나에서 npm run dev:api를 실행합니다.
.env.local을 만들고 VITE_API_BASE_URL=http://127.0.0.1:8787 을 입력합니다.
다른 터미널에서 npm run build 후 npm run preview를 실행합니다.
http://127.0.0.1:4173 에서 정적 화면 → 다른 포트의 Worker API 호출을 확인할 수 있습니다.
.env.local은 Git에 포함되지 않습니다. GitHub Actions에서는 저장소 변수의 HTTPS 주소를 사용합니다.
