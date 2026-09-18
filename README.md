# 필새 영상 아카이브 — 실제 videos.json 연결 버전

이 버전은 사용자가 제공한 `videos.json`을 **변환하지 않고 원본 구조 그대로** 사용합니다.

## 실제 JSON 구조
- 최상위: `{ "videos": [...], "total": 642 }`
- 각 영상의 `id`: YouTube 영상 ID
- 각 영상의 `thumbnail`: 썸네일 URL
- `dates`: `{ "sourceDate": "...", "source": "..." }` 객체 배열
- `parseStatus`: `parsed` 또는 `needs_review`

## 연결 방식
`script.js`가 `./data/videos.json`을 읽고:
- `id`로 YouTube 링크 자동 생성
- `thumbnail` 그대로 사용
- `dates`가 2개 이상이면 `혼합 영상`
- 날짜 1개면 `단일 날짜`
- 날짜가 없으면 `날짜 확인 필요`
- 연도 필터/검색에 `dates.sourceDate`, `dates.source`, description, source까지 포함

## 주의
정적 호스팅에서는 브라우저에서 관리자 화면으로 수정한 내용을 `data/videos.json` 파일 자체에 자동 저장할 수 없습니다.
실제 파일 수정/저장을 웹에서 하려면 별도 DB나 서버/API가 필요합니다.

현재 데이터 읽기/검색/필터/표시는 ChatGPT Sites 없이 독립적으로 동작합니다.

## 로컬 테스트
프로젝트 폴더에서:
`python -m http.server 8080`

브라우저:
`http://localhost:8080`
