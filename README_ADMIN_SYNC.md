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


## v4 모바일 헤더
- 620px 이하에서는 채널 배너 이미지를 감춤
- 프로필 이미지를 72px로 축소하고 제목과 가로 배치
- 모바일 상단 여백과 제목 크기를 줄여 영상 목록 접근 속도를 개선함
- 태블릿 구간에서는 배너 높이를 170px로 축소함


## v5 디자인 개선
- 전체 톤을 화이트 + 연보라 아카이브 스타일로 정돈
- 채널 헤더에 전체 영상 / 날짜 인식 / 확인 필요 요약 배지 추가
- 검색·연도·유형·정렬을 하나의 필터 패널로 통합
- 모바일에서는 배너를 숨기고 프로필/제목을 더 작게 표시
- 모바일 필터는 검색창만 기본 노출하고 나머지는 `필터` 버튼으로 펼침
- 활성화된 필터 개수를 필터 버튼에 표시
- 영상 카드, 목록형, 버튼, 관리자 카드까지 라벤더 계열로 통일


## v6 수정
- Android 모바일에서 영상 썸네일/제목/YouTube 버튼 클릭 시 YouTube 앱을 우선 실행함.
- iPhone/iPad에서도 YouTube 앱 URL을 우선 시도하고, 앱이 없으면 웹 YouTube로 이동함.
- `170113`, `170112`, `170114`, `170115`처럼 같은 연도에 여러 정확한 날짜가 있어도 모두 표시함.
- `혼합 영상` 판정도 이제 '연도가 여러 개인 영상'이 아니라 '서로 다른 날짜가 2개 이상인 영상' 기준임.
- 동일 날짜의 중복 표기만 제거함.


## v7 통합 개선
- 혼합영상은 서로 다른 연도가 2개 이상일 때만 분류함. 같은 연도 내 여러 날짜는 해당 연도 영상으로 유지함.
- 같은 연도 날짜는 연도를 반복하지 않고 압축 표시하며, 많은 날짜는 `+N개`로 접어둠.
- 혼합영상은 먼저 연도 요약을 보여주고 세부 날짜를 펼쳐볼 수 있음.
- 혼합영상도 포함된 각 연도 필터 결과에 정상 노출됨.
- 제목/설명/출처/날짜 모두 검색 대상임.
- 활성 필터 칩과 개별 해제 기능 추가.
- 결과 영역에서 `전체 N개 · 현재 결과 N개`를 명확히 구분함.
- 모바일은 헤더 통계를 전체 영상 하나만 남기고 더 압축함.
- 관리자 화면에 날짜 미확인 영상 전용 검토 목록, 미확인 사유, 설명 미리보기, YouTube 원본 링크 추가.
- 실제 YouTube 설명을 OAuth로 수정하는 기능은 다음 단계로 보류함.


## v7.1 날짜 접기 버그 수정
- `hidden` 속성이 `.date-extra { display: contents }`에 의해 무시되던 문제 수정.
- 데스크톱은 날짜 3개까지만 기본 표시, 나머지는 `+N개`.
- 모바일은 날짜 2개까지만 기본 표시, 나머지는 `+N개`.
- `+N개` 클릭 시 전체 펼침, `접기` 클릭 시 다시 축소.
- 카드형/목록형 모두 동일하게 적용.


## v8 구조 개선
- 카드형 / 목록형 / 연도·월 아카이브형의 3가지 보기 제공.
- 아카이브형은 각 영상을 대표 원본 날짜 기준으로 연도 → 월 순으로 묶어 보여줌.
- 혼합영상은 서로 다른 연도가 2개 이상일 때만 분류.
- 혼합영상 카드의 긴 연도 목록은 최대 6개까지만 요약하고, 날짜는 데스크톱 3개 / 모바일 2개까지만 기본 노출.
- 날짜 더보기 버튼은 연도 요약과 별개로 실제 숨겨진 날짜 개수만 표시.
- 관리자 화면은 `영상 동기화 / 날짜 검토 / 사이트 설정` 탭으로 분리.
- YouTube 설명 직접 수정(OAuth)은 이번 버전에서 제외.


## v8.1 날짜 정확도별 아카이브 그룹화
- `day`: 정확한 날짜의 해당 월에 배치.
- `month`: 해당 월에 배치하고 `일자 미상` 표시.
- `year`: 1월로 넣지 않고 해당 연도 하단의 `연도만 확인` 영역에 배치.
- `unknown`: 전체 아카이브 마지막의 `날짜 미확인` 영역에 배치.
- 연도만 있는 영상은 내부적으로 YYYY-01-01을 저장해도 화면 그룹화는 `precision` 기준으로 처리하므로 1월 영상으로 오해되지 않음.
