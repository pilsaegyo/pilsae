# 필새 영상 아카이브 — 관리자 자동 동기화 버전

이 패키지는 공개 사이트 + 별도 Cloudflare Worker 관리자 API로 구성됩니다.

## 구조

- `index.html`
- `style.css`
- `script.js`
- `site-config.json`
- `data/videos.json`
- `worker/index.js`
- `worker/wrangler.jsonc`

## Worker가 하는 일

1. YouTube `channels.list`에서 `@pilsae` 채널을 찾음
2. 채널의 uploads playlist ID 확인
3. `playlistItems.list`를 50개씩 반복 호출해 전체 업로드 영상 ID 수집
4. `videos.list`로 실제 영상 제목/설명/게시일/썸네일 조회
5. `data/videos.json` 생성
6. GitHub Contents API로 기존 파일 SHA 조회 후 파일 교체
7. GitHub commit 생성 → 연결된 Cloudflare 배포 자동 시작

## 반드시 필요한 Worker Secret

- `YOUTUBE_API_KEY`
- `GITHUB_TOKEN`
- `ADMIN_TOKEN`

`ADMIN_TOKEN`은 직접 정한 긴 임의 문자열을 사용하세요.
예: 비밀번호 관리자가 생성한 32자 이상의 랜덤 문자열.

## 일반 Variables

- `GITHUB_OWNER=pilsaegyo`
- `GITHUB_REPO=pilsae`
- `GITHUB_BRANCH=main`
- `YOUTUBE_HANDLE=@pilsae`
- `ALLOWED_ORIGIN=https://pilsae.hyesung.workers.dev`

## 권장 Worker 이름

`pilsae-admin-api`

그러면 기본 주소는:
`https://pilsae-admin-api.hyesung.workers.dev`

사이트의 `site-config.json`도 이 주소를 기본값으로 사용합니다.

## 관리자 접속

공개 사이트 주소 뒤에:

`?admin=1`

예:
`https://pilsae.hyesung.workers.dev/?admin=1`

관리자 화면에서 `ADMIN_TOKEN`을 입력해 사용합니다.
토큰은 `sessionStorage`에만 저장되어 탭/브라우저 세션 종료 후 사라집니다.

## 날짜 분석

videos.json 자체는 YouTube 원본 제목/설명을 저장합니다.
날짜 판별은 기존 사이트 JS 규칙대로 화면 로드 시 description만 분석합니다.
해시태그 날짜는 제외합니다.

## 주의

- `YOUTUBE_API_KEY`, `GITHUB_TOKEN`, `ADMIN_TOKEN`은 절대 GitHub에 넣지 마세요.
- 세 Secret은 Cloudflare Worker Secret으로만 저장하세요.
- 별도 Worker를 새로 만들 경우 Secret은 Worker별 설정이므로 새 Worker에도 다시 등록해야 합니다.


## v2 변경사항
- ADMIN_TOKEN 입력값을 업데이트 버튼 클릭 시 자동 적용
- 별도로 '토큰 적용' 버튼을 누르지 않아도 됨
- 401 인증 실패 시 더 명확한 오류 메시지 표시


## 채널 브랜딩 헤더 반영
- 사이트 상단 hero 영역이 YouTube 채널 배너 이미지를 배경으로 사용합니다.
- 채널 프로필 이미지는 원형 아바타로 자동 반영됩니다.
- `YouTube 영상 정보 업데이트`를 누르면 `data/videos.json`뿐 아니라 `site-config.json`의 `bannerImageUrl`, `profileImageUrl`, `channelTitle`도 함께 갱신됩니다.
- 기본 파비콘은 `assets/favicon-p.png`(연보라 배경 + 흰색 P)입니다.


## v2 프로필 이미지 수정
- 프로필 이미지는 YouTube `channels.list`의 `snippet.thumbnails.high.url`을 그대로 사용함.
- 사이트가 열릴 때 `/channel-branding`에서 현재 채널 브랜딩을 한 번 더 읽으므로 `site-config.json`이 오래돼도 실제 채널 프로필이 우선 적용됨.
- `/channel-branding` 응답은 Worker에서 1시간 캐시해 API 쿼터 낭비를 줄임.
- P 이미지는 YouTube 프로필을 가져오지 못했을 때만 fallback으로 표시됨.
