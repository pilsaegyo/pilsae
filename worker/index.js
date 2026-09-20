// v26.0-step3c: Cloudflare Git auto-deploy verification marker.
const GITHUB_API_VERSION = "2026-03-10";

const ADMIN_UI_SHELL = "<div class=\"admin-bootstrap\" hidden aria-hidden=\"true\">\n      <section id=\"channelHero\"></section>\n      <div id=\"heroBannerImage\"></div>\n      <div id=\"heroAvatar\"></div>\n      <span id=\"heroHandle\"></span>\n      <h1 id=\"mainTitle\"></h1>\n      <b id=\"heroTotal\"></b>\n      <strong id=\"videoCount\"></strong>\n      <input id=\"searchInput\" />\n      <select id=\"yearFilter\"><option value=\"\"></option></select>\n      <select id=\"typeFilter\"><option value=\"\"></option></select>\n      <select id=\"contentTypeFilter\"><option value=\"\"></option></select>\n      <select id=\"videoFormatFilter\"><option value=\"\"></option><option value=\"standard\"></option><option value=\"shorts\"></option></select>\n      <select id=\"sortFilter\"><option value=\"source-desc\"></option></select>\n      <div id=\"activeFilterChips\"></div>\n      <nav id=\"yearJumpBar\"></nav>\n      <div id=\"resultMeta\"></div>\n      <section id=\"loadingState\"></section>\n      <section id=\"videoGrid\"></section>\n      <button id=\"loadMoreBtn\"></button>\n      <section id=\"emptyState\"></section>\n      <button id=\"resetFilters\"></button>\n      <button id=\"emptyResetBtn\"></button>\n      <button id=\"clearSearchBtn\"></button>\n      <div id=\"searchSuggestions\"></div>\n      <button id=\"gridViewBtn\"></button>\n      <button id=\"listViewBtn\"></button>\n      <button id=\"timelineViewBtn\"></button>\n      <button id=\"mobileFilterToggle\"></button>\n      <button id=\"backToTopBtn\"></button>\n    </div>\n\n    <section id=\"adminPanel\" class=\"admin-panel\" hidden>\n      <div class=\"admin-mode-bar\">\n        <div class=\"admin-mode-label\">\n          <span>관리자 모드</span>\n          <span id=\"adminBuildVersion\" class=\"admin-build-version\" aria-label=\"현재 배포 빌드\"></span>\n        </div>\n        <div class=\"admin-mode-actions\">\n          <button id=\"adminLogoutBtn\" class=\"admin-logout-btn\" type=\"button\" hidden>로그아웃</button>\n          <a href=\"./\" class=\"admin-back-link\">일반 아카이브 보기</a>\n        </div>\n      </div>\n      <div class=\"admin-heading\">\n        <div>\n          <p class=\"eyebrow\">ARCHIVE ADMIN</p>\n          <h2>아카이브 관리자</h2>\n        </div>\n        <button id=\"closeAdmin\" type=\"button\" hidden aria-hidden=\"true\"></button>\n      </div>\n\n      <div class=\"admin-card admin-auth-card\">\n        <div class=\"admin-auth-lock-icon\" aria-hidden=\"true\">⌁</div>\n        <h3>관리자 인증</h3>\n        <p class=\"admin-help\">관리자 화면을 보려면 ADMIN_TOKEN 인증이 필요합니다.</p>\n        <div class=\"admin-row admin-login-row\">\n          <input id=\"adminTokenInput\" type=\"password\" autocomplete=\"current-password\" placeholder=\"ADMIN_TOKEN 입력\" />\n          <button id=\"saveAdminToken\" type=\"button\">관리자 로그인</button>\n        </div>\n        <div id=\"adminApiStatus\" class=\"admin-status\"></div>\n      </div>\n\n      <div class=\"admin-tabs\" role=\"tablist\" aria-label=\"관리자 메뉴\">\n        <button class=\"admin-tab active\" type=\"button\" role=\"tab\" aria-selected=\"true\" data-admin-tab=\"dashboard\">대시보드</button>\n        <button class=\"admin-tab\" type=\"button\" role=\"tab\" aria-selected=\"false\" data-admin-tab=\"sync\">영상 동기화</button>\n        <button class=\"admin-tab\" type=\"button\" role=\"tab\" aria-selected=\"false\" data-admin-tab=\"review\">날짜 검토 <span id=\"adminReviewTabCount\" class=\"admin-tab-count\">0</span></button>\n        <button class=\"admin-tab\" type=\"button\" role=\"tab\" aria-selected=\"false\" data-admin-tab=\"content\"><span class=\"admin-tab-icon\" aria-hidden=\"true\">♫</span> 콘텐츠 분류</button>\n        <button class=\"admin-tab\" type=\"button\" role=\"tab\" aria-selected=\"false\" data-admin-tab=\"history\">변경 이력</button>\n        <button class=\"admin-tab\" type=\"button\" role=\"tab\" aria-selected=\"false\" data-admin-tab=\"deploy\">배포</button>\n        <button class=\"admin-tab\" type=\"button\" role=\"tab\" aria-selected=\"false\" data-admin-tab=\"settings\">사이트 설정</button>\n      </div>\n\n      <div class=\"admin-tab-panel active\" data-admin-panel=\"dashboard\">\n        <div class=\"admin-deploy-summary-strip\" aria-label=\"현재 배포 정보\">\n          <div>\n            <span>현재 버전</span>\n            <strong id=\"dashBuildVersion\">-</strong>\n          </div>\n          <div>\n            <span>최근 배포</span>\n            <strong id=\"dashLastDeploy\">확인 중</strong>\n          </div>\n          <a id=\"dashDeployCommit\" class=\"admin-deploy-summary-link\" href=\"#\" target=\"_blank\" rel=\"noopener noreferrer\" hidden>커밋 보기</a>\n        </div>\n\n        <div class=\"admin-ops-status-row\">\n          <div id=\"adminSystemStatus\" class=\"admin-system-strip\" aria-label=\"시스템 상태\">\n            <div class=\"admin-system-title\">\n              <span class=\"admin-system-dot waiting\" id=\"systemOverallDot\" aria-hidden=\"true\"></span>\n              <strong>시스템</strong>\n              <span id=\"systemOverallText\">확인 중</span>\n            </div>\n            <div class=\"admin-system-items\">\n              <span data-system-item=\"api\"><i class=\"waiting\"></i>Admin API <b>확인 중</b></span>\n              <span data-system-item=\"github\"><i class=\"waiting\"></i>GitHub <b>확인 중</b></span>\n              <span data-system-item=\"youtube\"><i class=\"waiting\"></i>YouTube <b>확인 중</b></span>\n              <span data-system-item=\"worker\"><i class=\"waiting\"></i>Worker <b>확인 중</b></span>\n            </div>\n            <button id=\"refreshSystemStatus\" class=\"admin-system-refresh\" type=\"button\"\n              aria-label=\"시스템 상태 새로고침\" title=\"시스템 상태 새로고침\">\n              <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                <path d=\"M20 6v5h-5M4 18v-5h5M6.1 9A7 7 0 0 1 18.5 6.5L20 8M4 16l1.5 1.5A7 7 0 0 0 17.9 15\"/>\n              </svg>\n            </button>\n          </div>\n\n          <div id=\"adminNewReviewStrip\" class=\"admin-new-review-strip\" aria-label=\"이번 동기화 새 검토\">\n            <div>\n              <span class=\"admin-new-review-dot\" aria-hidden=\"true\"></span>\n              <strong id=\"newReviewHeading\">이번 동기화</strong>\n              <span id=\"newReviewTotal\">새 검토 0건</span>\n            </div>\n            <div id=\"newReviewBreakdown\" class=\"admin-new-review-breakdown\"></div>\n            <span id=\"newReviewOkay\" class=\"admin-new-review-ok\">자동 판별 완료</span>\n          </div>\n        </div>\n\n        <div class=\"admin-dashboard-grid\">\n          <div class=\"admin-dashboard-card\"><span>전체 영상</span><strong id=\"dashTotal\">0</strong></div>\n          <button class=\"admin-dashboard-card admin-dashboard-action\" type=\"button\" data-dashboard-route=\"review-all\"><span>날짜 검토 필요</span><strong id=\"dashReview\">0</strong><small>바로 확인</small></button>\n          <button class=\"admin-dashboard-card admin-dashboard-action\" type=\"button\" data-dashboard-route=\"review-description\"><span>설명 변경 재검토</span><strong id=\"dashDescription\">0</strong><small>바로 확인</small></button>\n          <button class=\"admin-dashboard-card admin-dashboard-action\" type=\"button\" data-dashboard-route=\"content-playlists\"><span>플레이리스트</span><strong id=\"dashPlaylists\">0</strong><small>바로 확인</small></button>\n          <button class=\"admin-dashboard-card admin-dashboard-action\" type=\"button\" data-dashboard-route=\"review-unknown\"><span>날짜 미확인</span><strong id=\"dashUnknown\">0</strong><small>바로 확인</small></button>\n          <button class=\"admin-dashboard-card admin-dashboard-card-wide admin-dashboard-action\" type=\"button\" data-dashboard-route=\"sync\"><span>최근 YouTube 동기화</span><strong id=\"dashLastSync\">기록 없음</strong><small>동기화 관리</small></button>\n        </div>\n\n        <div id=\"adminHealthCard\" class=\"admin-card admin-health-card\">\n          <div class=\"admin-review-heading\">\n            <div>\n              <h3>데이터 건강검사</h3>\n              <p class=\"admin-help\">공개 전에 확인하면 좋은 데이터 이상 항목을 자동으로 점검합니다.</p>\n            </div>\n            <div class=\"admin-heading-actions\">\n              <span id=\"adminHealthBadge\" class=\"admin-count-badge\">0건</span>\n              <button id=\"refreshAdminHealth\" class=\"admin-icon-button\" type=\"button\"\n                aria-label=\"건강검사 새로고침\" title=\"건강검사 새로고침\">\n                <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                  <path d=\"M20 6v5h-5M4 18v-5h5M6.1 9A7 7 0 0 1 18.5 6.5L20 8M4 16l1.5 1.5A7 7 0 0 0 17.9 15\"/>\n                </svg>\n              </button>\n            </div>\n          </div>\n          <div id=\"adminHealthCriteria\" class=\"admin-health-criteria\">\n            <div class=\"admin-health-criteria-title\">\n              <strong>검사 기준</strong>\n              <span>공개 데이터에 실제로 영향을 줄 수 있는 항목만 단계별로 표시합니다.</span>\n            </div>\n            <div class=\"admin-health-criteria-grid\">\n              <div class=\"health-criterion criterion-error\">\n                <b>오류</b>\n                <span>중복 ID · 잘못된 날짜 형식 · 존재하지 않거나 미래인 날짜</span>\n              </div>\n              <div class=\"health-criterion criterion-review\">\n                <b>검토</b>\n                <span>일반 영상 날짜 미확인 · 설명 변경 재검토 · 플레이리스트/영상 타입 확인</span>\n              </div>\n              <div class=\"health-criterion criterion-info\">\n                <b>정보</b>\n                <span>썸네일 또는 출처 등 보조 메타데이터 누락</span>\n              </div>\n            </div>\n          </div>\n          <div id=\"adminHealthSummary\" class=\"admin-health-summary\"></div>\n          <div id=\"adminHealthList\" class=\"admin-health-list\"></div>\n        </div>\n      </div>\n\n      <div class=\"admin-tab-panel\" data-admin-panel=\"sync\" hidden>\n        <div class=\"admin-card admin-sync-card\">\n          <div class=\"admin-section-heading\">\n            <div>\n              <span class=\"admin-section-kicker\">YOUTUBE SYNC</span>\n              <h3>YouTube 영상 정보 업데이트</h3>\n              <p class=\"admin-help\">YouTube의 최신 정보와 현재 데이터를 비교한 뒤 필요한 변경만 적용합니다.</p>\n            </div>\n            <span class=\"admin-section-note\">수동 날짜 · 콘텐츠 분류 유지</span>\n          </div>\n\n          <div class=\"admin-auto-sync-strip\" aria-label=\"자동 영상 동기화 일정\">\n            <div>\n              <span class=\"admin-auto-sync-dot\" id=\"adminAutoSyncDot\" aria-hidden=\"true\"></span>\n              <strong>자동 동기화</strong>\n              <span>매일 20:00</span>\n            </div>\n            <span id=\"adminAutoSyncNext\">다음 실행 계산 중</span>\n            <small id=\"adminAutoSyncState\">상태 확인 중</small>\n          </div>\n\n          <div class=\"admin-auto-sync-diagnostics\" aria-label=\"자동 동기화 진단\">\n            <div class=\"auto-sync-diagnostic-copy\">\n              <strong id=\"autoSyncDiagnosticTitle\">자동 실행 상태 확인 중</strong>\n              <small id=\"autoSyncDiagnosticDetail\">Worker 설정과 필수 연결 상태를 확인합니다.</small>\n            </div>\n            <div class=\"auto-sync-diagnostic-actions\">\n              <button id=\"refreshAutoSyncDiagnostics\" class=\"admin-small-button\" type=\"button\">상태 새로고침</button>\n              <button id=\"runAutoSyncNow\" class=\"admin-small-button primary\" type=\"button\">자동 동기화 지금 실행</button>\n            </div>\n          </div>\n\n          <div id=\"autoSyncRunStatus\" class=\"admin-status\"></div>\n\n          <div class=\"admin-auto-backup-strip\" aria-label=\"주간 자동 백업 일정\">\n            <div>\n              <span class=\"admin-auto-backup-dot\" aria-hidden=\"true\"></span>\n              <strong>주간 백업 ON</strong>\n              <span>매주 일요일 03:00</span>\n            </div>\n            <small>영상 · 사이트 설정 · 변경 이력 / 최근 4주 보관</small>\n          </div>\n\n          <div class=\"sync-summary admin-sync-summary\">\n            <div>\n              <span>현재 영상</span>\n              <strong id=\"adminCurrentTotal\">—</strong>\n              <small>공개 목록 기준</small>\n            </div>\n            <div>\n              <span>날짜 인식</span>\n              <strong id=\"adminParsedTotal\">—</strong>\n              <small>날짜가 확인된 영상</small>\n            </div>\n            <div>\n              <span>검토 필요</span>\n              <strong id=\"adminReviewTotal\">—</strong>\n              <small>날짜 확인이 필요한 영상</small>\n            </div>\n          </div>\n\n          <div class=\"admin-sync-flow\">\n            <div class=\"admin-sync-flow-step\">\n              <span class=\"admin-sync-step-no\">1</span>\n              <div>\n                <strong>변경사항 확인</strong>\n                <small>신규·제목·설명·삭제 후보를 먼저 비교합니다.</small>\n              </div>\n              <button id=\"previewYoutubeSync\" class=\"sync-button\" type=\"button\">미리보기</button>\n            </div>\n            <div class=\"admin-sync-flow-step\">\n              <span class=\"admin-sync-step-no\">2</span>\n              <div>\n                <strong>변경사항 적용</strong>\n                <small>미리보기 결과를 확인한 뒤 실제 데이터에 반영합니다.</small>\n              </div>\n              <button id=\"syncYoutubeVideos\" class=\"sync-apply-button\" type=\"button\" disabled>적용</button>\n            </div>\n          </div>\n\n          <div id=\"syncPreviewPanel\" class=\"sync-preview-panel\" hidden>\n            <div class=\"sync-preview-grid\">\n              <div><span>신규</span><strong id=\"syncPreviewAdded\">0</strong></div>\n              <div><span>제목 변경</span><strong id=\"syncPreviewTitle\">0</strong></div>\n              <div><span>설명 변경</span><strong id=\"syncPreviewDescription\">0</strong></div>\n              <div><span>삭제 후보</span><strong id=\"syncPreviewRemoved\">0</strong></div>\n              <div><span>변경 없음</span><strong id=\"syncPreviewUnchanged\">0</strong></div>\n            </div>\n            <div id=\"syncPreviewDetails\" class=\"sync-preview-details\"></div>\n          </div>\n\n          <div id=\"syncStatus\" class=\"admin-status\"></div>\n        </div>\n\n        <div class=\"admin-card admin-backup-card\">\n          <div class=\"admin-review-heading\">\n            <div>\n              <h3>안전 백업 · 복원 지점</h3>\n              <p class=\"admin-help\">최근 3개의 서버 백업을 유지합니다. YouTube 동기화 적용 직전에는 자동으로 복원 지점을 만듭니다.</p>\n            </div>\n            <button id=\"createAdminBackup\" class=\"admin-small-button\" type=\"button\">지금 백업 만들기</button>\n          </div>\n          <div id=\"adminBackupStatus\" class=\"admin-status\"></div>\n          <div id=\"adminBackupList\" class=\"admin-backup-list\">\n            <p class=\"admin-help\">복원 지점을 불러오는 중입니다.</p>\n          </div>\n        </div>\n      </div>\n\n      <div class=\"admin-tab-panel\" data-admin-panel=\"review\" hidden>\n        <div class=\"admin-review-overview\" id=\"adminReviewOverview\">\n          <div class=\"admin-review-overview-item\">\n            <span>날짜 확인 필요</span>\n            <strong id=\"adminReviewUnknownCount\">0</strong>\n          </div>\n          <div class=\"admin-review-overview-item description-change\">\n            <span>설명 변경 재검토</span>\n            <strong id=\"adminDescriptionChangeCount\">0</strong>\n          </div>\n          <div class=\"admin-review-complete\" id=\"adminReviewComplete\" hidden>\n            <span class=\"admin-review-complete-icon\">✓</span>\n            <div><strong>날짜 검토 완료</strong><small>현재 확인이 필요한 일반 영상이 없습니다.</small></div>\n          </div>\n        </div>\n\n        <div class=\"admin-card admin-review-card\">\n          <div class=\"admin-review-heading\">\n            <div>\n              <h3>날짜 확인 필요 영상</h3>\n              <p class=\"admin-help\">검토 이유별로 좁혀 보고, 우선순위가 높은 항목부터 처리할 수 있습니다.</p>\n            </div>\n            <span id=\"adminUnknownBadge\" class=\"admin-count-badge\">0개</span>\n          </div>\n\n          <div class=\"admin-review-queue-toolbar\">\n            <div id=\"adminReviewFilterChips\" class=\"admin-review-filter-chips\" role=\"group\" aria-label=\"날짜 검토 유형\">\n              <button type=\"button\" class=\"admin-review-filter-chip active\" data-review-filter=\"all\">전체 <b id=\"reviewFilterAllCount\">0</b></button>\n              <button type=\"button\" class=\"admin-review-filter-chip\" data-review-filter=\"description\">설명 변경 <b id=\"reviewFilterDescriptionCount\">0</b></button>\n              <button type=\"button\" class=\"admin-review-filter-chip\" data-review-filter=\"candidate\">날짜 후보 <b id=\"reviewFilterCandidateCount\">0</b></button>\n              <button type=\"button\" class=\"admin-review-filter-chip\" data-review-filter=\"date-like\">표기 확인 <b id=\"reviewFilterDateLikeCount\">0</b></button>\n              <button type=\"button\" class=\"admin-review-filter-chip\" data-review-filter=\"no-date\">날짜 정보 없음 <b id=\"reviewFilterNoDateCount\">0</b></button>\n            </div>\n            <label class=\"admin-review-sort\">\n              <span>정렬</span>\n              <select id=\"adminReviewSort\">\n                <option value=\"priority\">검토 우선순위순</option>\n                <option value=\"upload-desc\">최신 업로드순</option>\n                <option value=\"upload-asc\">오래된 업로드순</option>\n              </select>\n            </label>\n          </div>\n\n          <div id=\"adminUnknownList\" class=\"admin-unknown-list\"></div>\n        </div>\n\n        <div class=\"admin-card admin-review-card\">\n          <div class=\"admin-review-heading\">\n            <div>\n              <h3>연도 미지정 플레이리스트</h3>\n              <p class=\"admin-help\">정말 특정 연도가 없는 전체 모음만 이곳에 표시됩니다. 여러 연도에 걸친 플레이리스트는 콘텐츠 분류에서 ‘다년도로 지정’하면 날짜 검토 목록에서 제외됩니다.</p>\n            </div>\n            <span id=\"adminUndatedPlaylistBadge\" class=\"admin-count-badge\">0개</span>\n          </div>\n          <div id=\"adminUndatedPlaylistList\" class=\"admin-unknown-list\"></div>\n        </div>\n      </div>\n\n      <div class=\"admin-tab-panel\" data-admin-panel=\"content\" hidden>\n        <div class=\"admin-card admin-content-card\">\n          <div class=\"admin-section-heading admin-content-heading\">\n            <div>\n              <span class=\"admin-section-kicker\">CONTENT</span>\n              <h3>콘텐츠 분류</h3>\n              <p class=\"admin-help\">플레이리스트 범위와 일반 동영상/Shorts 타입을 한곳에서 관리합니다.</p>\n            </div>\n          </div>\n\n          <div class=\"admin-content-guide\">\n            <div>\n              <b>플레이리스트</b>\n              <span>여러 연도에 걸친 모음은 <strong>다년도</strong>, 특정 연도가 없는 모음은 <strong>연도 미지정</strong>으로 구분합니다.</span>\n            </div>\n            <div>\n              <b>영상 타입</b>\n              <span>자동 판별 결과가 애매한 영상만 확인해 일반 동영상 또는 Shorts로 확정합니다.</span>\n            </div>\n          </div>\n\n          <div class=\"admin-video-format-verify admin-video-format-verify-compact\">\n            <div class=\"admin-video-format-copy\">\n              <span class=\"admin-mini-label\">SHORTS CHECK</span>\n              <strong>YouTube Shorts 자동 확인</strong>\n              <p class=\"admin-help\">소량 진단 후 범위를 늘려 확인합니다. 각 단계가 정상일 때만 다음 단계가 활성화됩니다.</p>\n              <div class=\"admin-format-flow-text\" aria-label=\"Shorts 자동 확인 순서\">\n                <span>5개 진단</span><i>→</i><span>20개 테스트</span><i>→</i><span>전체 미리보기</span>\n              </div>\n            </div>\n            <div class=\"admin-video-format-stage-actions\">\n              <button id=\"adminVerifyVideoFormats5\" class=\"ghost-button\" type=\"button\">5개 진단</button>\n              <button id=\"adminVerifyVideoFormats20\" class=\"ghost-button\" type=\"button\" disabled>20개 테스트</button>\n              <button id=\"adminVerifyVideoFormatsAll\" class=\"ghost-button\" type=\"button\" disabled>전체 미리보기</button>\n            </div>\n          </div>\n          <div id=\"adminVideoFormatVerifyStatus\" class=\"admin-status\"></div>\n          <div id=\"adminVideoFormatDiagnostic\" class=\"admin-video-format-diagnostic\" hidden></div>\n          <div id=\"adminVideoFormatPreview\" class=\"admin-video-format-preview\" hidden></div>\n\n          <div class=\"admin-content-toolbar\">\n            <label class=\"admin-classify-search\">\n              <span>영상 찾기</span>\n              <input id=\"adminContentSearch\" type=\"search\" placeholder=\"제목으로 검색\" autocomplete=\"off\" />\n            </label>\n            <label class=\"admin-content-mode\">\n              <span>표시</span>\n              <select id=\"adminContentMode\">\n                <option value=\"all\">전체 후보</option>\n                <option value=\"playlists\">플레이리스트만</option>\n                <option value=\"candidates\">미분류 후보만</option>\n                <option value=\"video-format\">동영상 타입 관리</option>\n                <option value=\"video-format-review\">타입 확인 필요</option>\n              </select>\n            </label>\n          </div>\n\n          <div id=\"adminContentList\" class=\"admin-content-list\"></div>\n          <div class=\"admin-content-load-more-wrap\">\n            <button id=\"adminContentLoadMore\" class=\"admin-content-load-more\" type=\"button\" hidden>더보기</button>\n          </div>\n        </div>\n      </div>\n\n      <div class=\"admin-tab-panel\" data-admin-panel=\"history\" hidden>\n        <div class=\"admin-card admin-history-card\">\n          <div class=\"admin-review-heading\">\n            <div>\n              <h3>변경 이력</h3>\n              <p class=\"admin-help\">관리자에서 적용한 최근 변경을 최대 100건까지 간단히 확인합니다.</p>\n            </div>\n            <button id=\"refreshAdminHistory\" class=\"admin-icon-button\" type=\"button\"\n              aria-label=\"변경 이력 새로고침\" title=\"변경 이력 새로고침\">\n              <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                <path d=\"M20 6v5h-5M4 18v-5h5M6.1 9A7 7 0 0 1 18.5 6.5L20 8M4 16l1.5 1.5A7 7 0 0 0 17.9 15\"/>\n              </svg>\n            </button>\n          </div>\n          <div id=\"adminHistoryStatus\" class=\"admin-status\"></div>\n          <div id=\"adminHistoryList\" class=\"admin-history-list\">\n            <p class=\"admin-help\">변경 이력 탭을 열면 최근 기록을 불러옵니다.</p>\n          </div>\n        </div>\n      </div>\n\n      \n      <div class=\"admin-tab-panel\" data-admin-panel=\"deploy\" hidden>\n        <div class=\"admin-card admin-deploy-card\">\n          <div class=\"deploy-upload-box deploy-upload-box-first\">\n            <label id=\"deployDropZone\" class=\"deploy-file-button\" for=\"deployPatchZip\"\n              role=\"button\" tabindex=\"0\" aria-describedby=\"deployDropHint\">\n              <span class=\"deploy-file-icon\" aria-hidden=\"true\">ZIP</span>\n              <span>\n                <strong>배포 ZIP 선택</strong>\n                <small id=\"deployDropHint\">압축을 풀지 않고 그대로 선택하거나 이 영역에 끌어다 놓으세요.</small>\n              </span>\n            </label>\n            <input id=\"deployPatchZip\" type=\"file\" accept=\".zip,application/zip\" hidden />\n          </div>\n\n          <div id=\"deployPatchStatus\" class=\"admin-status\"></div>\n\n          <section id=\"deployPatchPreview\" class=\"deploy-preview\" hidden>\n            <div class=\"deploy-summary-grid\">\n              <div><span>파일명</span><strong id=\"deployZipName\">-</strong></div>\n              <div><span>ZIP 크기</span><strong id=\"deployZipSize\">-</strong></div>\n              <div><span>변경 파일</span><strong id=\"deployFileCount\">0개</strong></div>\n              <div><span>Worker</span><strong id=\"deployWorkerState\">변경 없음</strong></div>\n            </div>\n\n            <div id=\"deployValidationBanner\" class=\"deploy-validation-banner\"></div>\n            <div id=\"deployRepositoryInfo\" class=\"deploy-repository-info\" hidden>\n              <span>대상 저장소</span>\n              <strong id=\"deployRepoBranch\">-</strong>\n              <small id=\"deployHeadSha\">현재 HEAD 확인 중</small>\n            </div>\n\n            <div id=\"deployCommitResult\" class=\"deploy-commit-result\" hidden></div>\n\n            <section id=\"deployLiveStatus\" class=\"deploy-live-status\" hidden aria-live=\"polite\">\n              <div class=\"deploy-live-head\">\n                <div>\n                  <strong>배포 상태</strong>\n                  <small id=\"deployLiveVersion\">-</small>\n                </div>\n                <button id=\"refreshDeployStatusBtn\" class=\"admin-icon-button\" type=\"button\"\n                  aria-label=\"배포 상태 새로고침\" title=\"배포 상태 새로고침\">\n                  <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n                    <path d=\"M20 6v5h-5M4 18v-5h5M6.1 9A7 7 0 0 1 18.5 6.5L20 8M4 16l1.5 1.5A7 7 0 0 0 17.9 15\"/>\n                  </svg>\n                </button>\n              </div>\n              <div class=\"deploy-live-grid\">\n                <div class=\"deploy-live-item\" data-deploy-status=\"github\">\n                  <span class=\"deploy-live-dot\" aria-hidden=\"true\"></span>\n                  <div><strong>GitHub</strong><small>대기 중</small></div>\n                </div>\n                <div class=\"deploy-live-item\" data-deploy-status=\"site\">\n                  <span class=\"deploy-live-dot\" aria-hidden=\"true\"></span>\n                  <div><strong>사이트</strong><small>대기 중</small></div>\n                </div>\n                <div class=\"deploy-live-item\" data-deploy-status=\"worker\">\n                  <span class=\"deploy-live-dot\" aria-hidden=\"true\"></span>\n                  <div><strong>Admin Worker</strong><small>대기 중</small></div>\n                </div>\n              </div>\n              <p id=\"deployLiveSummary\" class=\"deploy-live-summary\"></p>\n            </section>\n\n            <div class=\"deploy-file-list-head\">\n              <strong>ZIP 내부 파일</strong>\n              <span id=\"deployAllowedCount\">0개 확인</span>\n            </div>\n            <div id=\"deployPatchFiles\" class=\"deploy-file-list\"></div>\n\n            <div class=\"deploy-next-step\">\n              <div>\n                <strong>검사한 ZIP을 GitHub에 한 번의 커밋으로 반영합니다.</strong>\n                <p id=\"deployCommitHint\">현재 브랜치 상태를 확인한 뒤 배포 버튼이 활성화됩니다.</p>\n              </div>\n              <button id=\"deployPatchCommitBtn\" type=\"button\" disabled>GitHub에 커밋하고 배포</button>\n            </div>\n          </section>\n        </div>\n      </div>\n\n<div class=\"admin-tab-panel\" data-admin-panel=\"settings\" hidden>\n        <div class=\"admin-card admin-settings-card\">\n          <div class=\"admin-settings-heading\">\n            <div>\n              <h3>사이트 설정</h3>\n              <p class=\"admin-help\">공개 화면의 기본 정보와 브라우저 아이콘을 관리합니다.</p>\n            </div>\n          </div>\n\n          <div class=\"settings-grid admin-settings-grid\">\n            <label class=\"admin-setting-field\">\n              <span>상단 타이틀</span>\n              <input id=\"titleInput\" type=\"text\" placeholder=\"날짜로 다시 찾는 영상 기록\" />\n            </label>\n            <label class=\"admin-setting-field\">\n              <span>YouTube 채널 핸들</span>\n              <input id=\"channelHandleInput\" type=\"text\" placeholder=\"@pilsae\" />\n            </label>\n\n            <div class=\"admin-setting-field wide\">\n              <span class=\"admin-setting-label\">파비콘</span>\n              <div class=\"admin-favicon-control\">\n                <div id=\"faviconPreview\" class=\"favicon-preview\">P</div>\n                <div class=\"admin-favicon-picker\">\n                  <div class=\"admin-file-picker-row\">\n                    <button id=\"faviconChooseBtn\" class=\"admin-file-select-btn\" type=\"button\">파일 선택</button>\n                    <span id=\"faviconFileName\" class=\"admin-file-name\">선택된 파일 없음</span>\n                  </div>\n                  <small>PNG · JPG · WebP · ICO / 200KB 이하 권장</small>\n                  <input id=\"faviconInput\" type=\"file\" accept=\"image/png,image/jpeg,image/webp,image/x-icon,.ico\" hidden />\n                </div>\n              </div>\n            </div>\n          </div>\n\n          <div class=\"admin-settings-footer\">\n            <button id=\"saveSiteSettings\" class=\"admin-primary-compact\" type=\"button\">사이트 설정 저장</button>\n            <div id=\"siteSettingsStatus\" class=\"admin-status\"></div>\n          </div>\n        </div>\n\n        <div class=\"admin-card admin-data-export-card\">\n          <div class=\"admin-data-export-copy\">\n            <div class=\"admin-data-export-icon\" aria-hidden=\"true\">JSON</div>\n            <div>\n              <h3>데이터 백업</h3>\n              <p class=\"admin-help\">현재 브라우저에서 읽은 영상 데이터를 JSON 파일로 내려받습니다.</p>\n            </div>\n          </div>\n          <button id=\"exportData\" class=\"admin-secondary-compact\" type=\"button\">JSON 내려받기</button>\n        </div>\n      </div>\n    </section>";

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env, origin),
      });
    }

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return jsonResponse({
          ok: true,
          youtubeConfigured: Boolean(env.YOUTUBE_API_KEY),
          githubConfigured: Boolean(env.GITHUB_TOKEN),
          adminConfigured: Boolean(env.ADMIN_TOKEN),
          repo: `${env.GITHUB_OWNER || "pilsaegyo"}/${env.GITHUB_REPO || "pilsae"}`,
          branch: env.GITHUB_BRANCH || "main",
          handle: env.YOUTUBE_HANDLE || "@pilsae",
        }, 200, env, origin);
      }

      if (url.pathname === "/admin-auth" && request.method === "GET") {
        requireAdmin(request, env);
        return jsonResponse({
          ok: true,
          authenticated: true
        }, 200, env, origin);
      }

      if (url.pathname === "/admin-ui-shell" && request.method === "GET") {
        requireAdmin(request, env);
        return htmlResponse(ADMIN_UI_SHELL, 200, env, origin);
      }


      if (url.pathname === "/auto-sync-diagnostics" && request.method === "GET") {
        requireAdmin(request, env);

        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";

        const [configResult, historyResult] = await Promise.allSettled([
          readGithubJsonFile({ env, owner, repo, branch, path:"site-config.json" }),
          readGithubJsonFile({ env, owner, repo, branch, path:"data/admin-history.json" })
        ]);

        const config = configResult.status === "fulfilled"
          ? (configResult.value || {})
          : {};

        const entries = historyResult.status === "fulfilled" &&
          Array.isArray(historyResult.value?.entries)
            ? historyResult.value.entries
            : [];

        const latestAutoApply = entries.find(entry =>
          ["auto_sync_apply", "auto_sync_test_apply"].includes(String(entry?.action || ""))
        ) || null;

        const prerequisites = {
          adminToken:Boolean(env.ADMIN_TOKEN),
          youtubeApiKey:Boolean(env.YOUTUBE_API_KEY),
          githubToken:Boolean(env.GITHUB_TOKEN)
        };

        return jsonResponse({
          ok:Object.values(prerequisites).every(Boolean),
          checkedAt:new Date().toISOString(),
          schedule:{
            cron:"0 11 * * *",
            timezone:"Asia/Seoul",
            localTime:"20:00",
            configSource:"worker/wrangler.jsonc"
          },
          observability:true,
          prerequisites,
          lastDataAppliedAt:String(config.syncedFromYoutubeAt || ""),
          lastAutoApply:latestAutoApply ? {
            action:String(latestAutoApply.action || ""),
            changedAt:String(latestAutoApply.changedAt || ""),
            after:latestAutoApply.after || {}
          } : null,
          note:"GitHub 반영과 공개 사이트 배포는 별도 단계입니다. Cron 실행 성공/실패는 Workers Logs에도 기록됩니다."
        }, 200, env, origin);
      }

      if (url.pathname === "/auto-sync-run" && request.method === "POST") {
        requireAdmin(request, env);
        const result = await runAutoYoutubeSync(env, {
          source:"manual-auto-test",
          scheduledTime:Date.now(),
          cron:"manual"
        });

        return jsonResponse({
          ok:true,
          manual:true,
          ...result
        }, 200, env, origin);
      }

      if (url.pathname === "/deploy-context" && request.method === "GET") {
        requireAdmin(request, env);

        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const head = await getGithubBranchHead({ env, owner, repo, branch });
        const latestCommit = await githubJsonFetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(head.objectSha)}`,
          { env }
        );

        return jsonResponse({
          ok:true,
          repo:`${owner}/${repo}`,
          branch,
          headSha:head.objectSha,
          headMessage:String(latestCommit?.commit?.message || "").split("\n")[0],
          headCommittedAt:String(
            latestCommit?.commit?.committer?.date ||
            latestCommit?.commit?.author?.date ||
            ""
          ),
          headUrl:String(latestCommit?.html_url || "")
        }, 200, env, origin);
      }

      if (url.pathname === "/deploy-runtime-info" && request.method === "GET") {
        requireAdmin(request, env);

        const metadata = env.CF_VERSION_METADATA || {};
        return jsonResponse({
          ok:true,
          versionId:String(metadata.id || ""),
          versionTag:String(metadata.tag || ""),
          versionTimestamp:String(metadata.timestamp || "")
        }, 200, env, origin);
      }

      if (url.pathname === "/system-status" && request.method === "GET") {
        requireAdmin(request, env);

        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const handle = env.YOUTUBE_HANDLE || "@pilsae";
        const metadata = env.CF_VERSION_METADATA || {};

        const githubStartedAt = Date.now();
        const youtubeStartedAt = Date.now();

        const githubPromise = env.GITHUB_TOKEN
          ? getGithubBranchHead({ env, owner, repo, branch })
          : Promise.reject(new Error("GITHUB_TOKEN이 없습니다."));

        const youtubePromise = env.YOUTUBE_API_KEY
          ? youtubeFetch("channels", {
              part:"id",
              forHandle:handle,
              maxResults:1
            }, env.YOUTUBE_API_KEY)
          : Promise.reject(new Error("YOUTUBE_API_KEY가 없습니다."));

        const [githubResult, youtubeResult] = await Promise.allSettled([
          githubPromise,
          youtubePromise
        ]);

        const github = githubResult.status === "fulfilled"
          ? {
              ok:true,
              latencyMs:Date.now() - githubStartedAt,
              detail:`${owner}/${repo} · ${branch}`,
              headSha:String(githubResult.value?.objectSha || "")
            }
          : {
              ok:false,
              latencyMs:Date.now() - githubStartedAt,
              detail:String(githubResult.reason?.message || "GitHub 연결 실패")
            };

        const youtubeData = youtubeResult.status === "fulfilled"
          ? youtubeResult.value
          : null;
        const youtubeFound = Boolean(youtubeData?.items?.length);

        const youtube = youtubeResult.status === "fulfilled" && youtubeFound
          ? {
              ok:true,
              latencyMs:Date.now() - youtubeStartedAt,
              detail:handle
            }
          : {
              ok:false,
              latencyMs:Date.now() - youtubeStartedAt,
              detail:youtubeResult.status === "rejected"
                ? String(youtubeResult.reason?.message || "YouTube API 연결 실패")
                : `${handle} 채널을 찾지 못했습니다.`
            };

        const workerStatus = {
          ok:true,
          versionId:String(metadata.id || ""),
          versionTag:String(metadata.tag || ""),
          versionTimestamp:String(metadata.timestamp || "")
        };

        return jsonResponse({
          ok:github.ok && youtube.ok,
          checkedAt:new Date().toISOString(),
          adminApi:{ ok:true },
          github,
          youtube,
          worker:workerStatus
        }, 200, env, origin);
      }

      if (url.pathname === "/deploy-patch" && request.method === "POST") {
        requireAdmin(request, env);

        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const body = await request.json();

        const expectedHeadSha = String(body.expectedHeadSha || "").trim();
        const patchHash = String(body.patchHash || "").trim();
        const message = String(body.message || "Deploy archive patch from admin").trim();
        const files = Array.isArray(body.files) ? body.files : [];

        if (!expectedHeadSha) {
          throw new HttpError(400, "ZIP 검사 기준 GitHub HEAD SHA가 필요합니다.");
        }

        if (!/^[a-f0-9]{64}$/i.test(patchHash)) {
          throw new HttpError(400, "ZIP 무결성 해시가 올바르지 않습니다.");
        }

        const normalizedFiles = validateDeployPatchFiles(files);

        const currentHead = await getGithubBranchHead({ env, owner, repo, branch });
        if (currentHead.objectSha !== expectedHeadSha) {
          throw new HttpError(
            409,
            "GitHub 브랜치가 ZIP 검사 이후 변경되었습니다. ZIP을 다시 선택해 최신 HEAD 기준으로 검사해 주세요."
          );
        }

        const result = await createGithubPatchCommit({
          env,
          owner,
          repo,
          branch,
          parentCommitSha:currentHead.objectSha,
          files:normalizedFiles,
          message
        });

        return jsonResponse({
          ok:true,
          repo:`${owner}/${repo}`,
          branch,
          fileCount:normalizedFiles.length,
          commitSha:result.commitSha,
          commitUrl:result.commitUrl,
          message,
          patchHash
        }, 200, env, origin);
      }

      if (url.pathname === "/admin-history" && request.method === "GET") {
        requireAdmin(request, env);
        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";

        const history = await readGithubJsonFile({
          env, owner, repo, branch, path: "data/admin-history.json"
        }) || { entries: [] };

        return jsonResponse({
          ok: true,
          entries: Array.isArray(history.entries) ? history.entries.slice(0, 100) : []
        }, 200, env, origin);
      }

      if (url.pathname === "/undo-admin-history" && request.method === "POST") {
        requireAdmin(request, env);

        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const body = await request.json();

        const historyId = String(body.historyId || "").trim();
        if (!historyId) {
          throw new HttpError(400, "되돌릴 변경 이력 ID가 필요합니다.");
        }

        const historyPayload = await readGithubJsonFile({
          env, owner, repo, branch, path: "data/admin-history.json"
        }) || { entries: [] };

        const historyEntries = Array.isArray(historyPayload.entries)
          ? historyPayload.entries
          : [];

        const entry = historyEntries.find(item => String(item?.id || "") === historyId);
        if (!entry) {
          throw new HttpError(404, "해당 변경 이력을 찾지 못했습니다.");
        }

        const undoableActions = new Set([
          "manual_date",
          "candidate_date",
          "ignore_candidate",
          "accept_description_date",
          "content_type",
          "playlist_scope",
          "video_format",
          "video_format_confirm"
        ]);

        if (!undoableActions.has(String(entry.action || "")) || !entry.videoId) {
          throw new HttpError(400, "이 변경 이력은 되돌리기를 지원하지 않습니다.");
        }

        const payload = await readGithubJsonFile({
          env, owner, repo, branch, path: "data/videos.json"
        });

        if (!payload || !Array.isArray(payload.videos)) {
          throw new HttpError(404, "videos.json을 찾지 못했습니다.");
        }

        const video = payload.videos.find(v => String(v.id) === String(entry.videoId));
        if (!video) {
          throw new HttpError(404, "변경 대상 영상을 찾지 못했습니다.");
        }

        // Safety guard: only undo when the fields touched by this history entry
        // still match the recorded "after" state. This prevents an older undo
        // from overwriting a newer administrator change.
        if (!historyEntryMatchesCurrentState(entry, video)) {
          throw new HttpError(
            409,
            "이 이력 이후 같은 항목이 다시 변경되어 자동 되돌리기를 할 수 없습니다. 최신 변경 이력을 확인해 주세요."
          );
        }

        const currentBeforeUndo = snapshotHistoryState(entry.action, video);
        applyHistoryBeforeState(entry, video);

        payload.generatedAt = new Date().toISOString();

        const result = await updateGithubFile({
          env,
          owner,
          repo,
          branch,
          path: "data/videos.json",
          contentText: JSON.stringify(payload, null, 2) + "\n",
          message: `Undo admin history ${historyId} for ${entry.videoId}`
        });

        await appendAdminHistory({
          env, owner, repo, branch,
          entry: {
            action: "undo",
            videoId: String(entry.videoId),
            title: String(video.title || entry.title || entry.videoId),
            before: currentBeforeUndo,
            after: snapshotHistoryState(entry.action, video),
            undoOf: historyId
          }
        });

        return jsonResponse({
          ok: true,
          historyId,
          videoId: String(entry.videoId),
          video,
          commitUrl: result.commit?.html_url || null
        }, 200, env, origin);
      }

      if (url.pathname === "/admin-backups" && request.method === "GET") {
        requireAdmin(request, env);
        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";

        const index = await readGithubJsonFile({
          env, owner, repo, branch, path: "data/admin-backups-index.json"
        }) || { backups: [] };

        return jsonResponse({
          ok: true,
          backups: Array.isArray(index.backups) ? index.backups.slice(0, 3) : []
        }, 200, env, origin);
      }

      if (url.pathname === "/create-admin-backup" && request.method === "POST") {
        requireAdmin(request, env);
        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const body = await request.json().catch(() => ({}));

        const currentPayload = await readGithubJsonFile({
          env, owner, repo, branch, path: "data/videos.json"
        });
        if (!currentPayload || !Array.isArray(currentPayload.videos)) {
          throw new HttpError(404, "videos.json을 찾지 못했습니다.");
        }

        const backup = await createAdminBackup({
          env, owner, repo, branch,
          currentPayload,
          reason: String(body.reason || "manual")
        });

        return jsonResponse({ ok: true, backup }, 200, env, origin);
      }

      if (url.pathname === "/restore-admin-backup" && request.method === "POST") {
        requireAdmin(request, env);
        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const body = await request.json().catch(() => ({}));
        const backupId = String(body.backupId || "").trim();

        if (!backupId) {
          throw new HttpError(400, "복원할 백업 ID가 필요합니다.");
        }

        const index = await readGithubJsonFile({
          env, owner, repo, branch, path: "data/admin-backups-index.json"
        }) || { backups: [] };
        const backups = Array.isArray(index.backups) ? index.backups : [];
        const target = backups.find(item => String(item.id || "") === backupId);

        if (!target?.path) {
          throw new HttpError(404, "선택한 복원 지점을 찾지 못했습니다.");
        }

        const snapshot = await readGithubJsonFile({
          env, owner, repo, branch, path: String(target.path)
        });
        if (!snapshot || !Array.isArray(snapshot.videos)) {
          throw new HttpError(500, "백업 데이터가 올바르지 않습니다.");
        }

        const currentPayload = await readGithubJsonFile({
          env, owner, repo, branch, path: "data/videos.json"
        });
        if (!currentPayload || !Array.isArray(currentPayload.videos)) {
          throw new HttpError(404, "현재 videos.json을 찾지 못했습니다.");
        }

        // Always preserve the state that is about to be replaced.
        const safetyBackup = await createAdminBackup({
          env, owner, repo, branch,
          currentPayload,
          reason: "before_restore",
          avoidSlot: Number(target.slot || 0)
        });

        const restoredPayload = {
          ...snapshot,
          generatedAt: new Date().toISOString()
        };

        const result = await updateGithubFile({
          env, owner, repo, branch,
          path: "data/videos.json",
          contentText: JSON.stringify(restoredPayload, null, 2) + "\n",
          message: `Restore video archive backup ${backupId}`
        });

        await appendAdminHistory({
          env, owner, repo, branch,
          entry: {
            action: "backup_restore",
            title: "데이터 백업 복원",
            before: {
              total: currentPayload.videos.length,
              safetyBackupId: safetyBackup.id
            },
            after: {
              total: restoredPayload.videos.length,
              restoredBackupId: backupId,
              restoredAt: target.createdAt || ""
            }
          }
        });

        return jsonResponse({
          ok: true,
          backupId,
          total: restoredPayload.videos.length,
          safetyBackup,
          commitUrl: result.commit?.html_url || null
        }, 200, env, origin);
      }

      if (url.pathname === "/channel-branding" && request.method === "GET") {
        if (!env.YOUTUBE_API_KEY) {
          throw new HttpError(500, "YOUTUBE_API_KEY Secret이 없습니다.");
        }

        const handle = env.YOUTUBE_HANDLE || "@pilsae";
        const cache = caches.default;
        const cacheKey = new Request(`${url.origin}/channel-branding-cache?handle=${encodeURIComponent(handle)}`);

        let cached = await cache.match(cacheKey);
        if (cached) {
          const headers = new Headers(cached.headers);
          headers.set("Access-Control-Allow-Origin", corsHeaders(env, origin)["Access-Control-Allow-Origin"]);
          headers.set("Vary", "Origin");
          return new Response(cached.body, { status: cached.status, headers });
        }

        const channel = await getChannel(handle, env.YOUTUBE_API_KEY);
        const branding = extractChannelBranding(channel, handle);

        const response = new Response(JSON.stringify({
          ok: true,
          channelId: channel.id,
          ...branding
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
            ...corsHeaders(env, origin),
          }
        });

        const cacheCopy = response.clone();
        const cacheHeaders = new Headers(cacheCopy.headers);
        cacheHeaders.delete("Access-Control-Allow-Origin");
        cacheHeaders.delete("Vary");
        await cache.put(cacheKey, new Response(cacheCopy.body, {
          status: cacheCopy.status,
          headers: cacheHeaders
        }));

        return response;
      }

      if (url.pathname === "/sync-videos" && request.method === "POST") {
        requireAdmin(request, env);
        const syncRequestBody = await request.json().catch(() => ({}));
        const previewOnly = syncRequestBody?.previewOnly === true;
        const syncSource = ["auto", "manual-auto-test"].includes(String(syncRequestBody?.syncSource || ""))
          ? String(syncRequestBody.syncSource)
          : "manual";

        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const handle = env.YOUTUBE_HANDLE || "@pilsae";

        if (!env.YOUTUBE_API_KEY) {
          throw new HttpError(500, "YOUTUBE_API_KEY Secret이 없습니다.");
        }
        if (!env.GITHUB_TOKEN) {
          throw new HttpError(500, "GITHUB_TOKEN Secret이 없습니다.");
        }

        const channel = await getChannel(handle, env.YOUTUBE_API_KEY);
        const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

        if (!uploadsPlaylistId) {
          throw new HttpError(502, "YouTube 업로드 재생목록을 찾지 못했습니다.");
        }

        const videoIds = await getAllUploadVideoIds(
          uploadsPlaylistId,
          env.YOUTUBE_API_KEY
        );

        const items = [];
        for (let i = 0; i < videoIds.length; i += 50) {
          const batch = videoIds.slice(i, i + 50);
          const videos = await getVideos(batch, env.YOUTUBE_API_KEY);
          items.push(...videos);
        }

        const existingPayload = await readGithubJsonFile({
          env, owner, repo, branch, path: "data/videos.json"
        }) || { videos: [] };
        const existingById = new Map((existingPayload.videos || []).map(v => [String(v.id), v]));
        const syncSeenAt = new Date().toISOString();

        const normalized = items
          .map(normalizeYoutubeVideo)
          .filter(Boolean)
          .map(video => {
            const old = existingById.get(String(video.id));
            if (!old) {
              return {
                ...video,
                firstSeenAt:syncSeenAt
              };
            }
            const manualDates = (old.dates || []).filter(d => d?.manual === true);
            const oldDescription = normalizeDescriptionForCompare(old.description || "");
            const newDescription = normalizeDescriptionForCompare(video.description || "");
            const descriptionChanged = oldDescription !== newDescription;
            const shouldReviewManualDate = manualDates.length > 0 && descriptionChanged;

            return {
              ...video,
              dates: shouldReviewManualDate ? [] : manualDates,
              previousManualDates: shouldReviewManualDate
                ? manualDates
                : (Array.isArray(old.previousManualDates) ? old.previousManualDates : []),
              manualDateReviewPending: shouldReviewManualDate
                ? true
                : old.manualDateReviewPending === true,
              descriptionChangedAfterManual: shouldReviewManualDate
                ? true
                : old.descriptionChangedAfterManual === true,
              ignoredDateCandidates: Array.isArray(old.ignoredDateCandidates) ? old.ignoredDateCandidates.map(String) : [],
              contentType: old.contentType === "playlist" ? "playlist" : "video",
              playlistCandidate: old.contentType === "playlist"
                ? false
                : (old.playlistCandidate === true || video.playlistCandidate === true),
              firstSeenAt: String(old.firstSeenAt || ""),
              url: /youtube\.com\/shorts\//i.test(String(old.url || ""))
                ? String(old.url)
                : video.url,
              playlistScope: old.playlistScope === "multi-year" ? "multi-year"
                : old.playlistScope === "undated" ? "undated"
                : "",
              videoFormat: ["manual", "confirmed", "youtube"].includes(old.videoFormatSource) && ["standard", "shorts"].includes(old.videoFormat)
                ? old.videoFormat
                : video.videoFormat,
              videoFormatSource: ["manual", "confirmed", "youtube"].includes(old.videoFormatSource)
                ? old.videoFormatSource
                : "auto",
              videoFormatConfidence: ["manual", "confirmed", "youtube"].includes(old.videoFormatSource)
                ? ""
                : (video.videoFormatConfidence || ""),
              videoFormatReason: old.videoFormatSource === "confirmed"
                ? (old.videoFormatReason || "관리자가 자동 판별 결과를 확인했습니다.")
                : old.videoFormatSource === "youtube"
                  ? (old.videoFormatReason || "YouTube 공개 페이지에서 Shorts 분류를 확인했습니다.")
                  : old.videoFormatSource === "manual"
                    ? ""
                    : (video.videoFormatReason || ""),
              parseStatus: shouldReviewManualDate
                ? "needs_review"
                : (manualDates.length ? "parsed" : video.parseStatus)
            };
          })
          .sort((a, b) =>
            String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""))
          );

        const payload = {
          videos: normalized,
          total: normalized.length,
          generatedAt: new Date().toISOString(),
          channel: {
            id: channel.id,
            title: channel.snippet?.title || "",
            handle,
            ...extractChannelBranding(channel, handle),
          },
        };

        const syncPreview = buildSyncPreview(existingPayload.videos || [], normalized);
        const syncChanged =
          Number(syncPreview.added || 0) +
          Number(syncPreview.titleChanged || 0) +
          Number(syncPreview.descriptionChanged || 0) +
          Number(syncPreview.removed || 0);

        if (previewOnly) {
          return jsonResponse({
            ok: true,
            preview: true,
            total: normalized.length,
            changed: syncChanged,
            ...syncPreview
          }, 200, env, origin);
        }

        if (["auto", "manual-auto-test"].includes(syncSource) && syncChanged <= 0) {
          return jsonResponse({
            ok: true,
            preview: false,
            applied: false,
            outcome: "no_changes",
            total: normalized.length,
            changed: 0,
            syncSource,
            ...syncPreview
          }, 200, env, origin);
        }

        // Create a restore point before replacing the archive with YouTube sync data.
        // If backup creation fails, the sync is aborted so the existing archive remains untouched.
        await createAdminBackup({
          env, owner, repo, branch,
          currentPayload: existingPayload,
          reason: "before_sync"
        });

        const result = await updateGithubFile({
          env,
          owner,
          repo,
          branch,
          path: "data/videos.json",
          contentText: JSON.stringify(payload, null, 2) + "\n",
          message: `Update YouTube video archive (${normalized.length} videos)`,
        });

        const existingConfig = await readGithubJsonFile({
          env, owner, repo, branch, path: "site-config.json"
        }) || {};

        const branding = extractChannelBranding(channel, handle);
        const mergedConfig = {
          ...existingConfig,

          // User-managed settings are never replaced by a YouTube sync.
          title: existingConfig.title || "날짜로 다시 찾는 영상 기록",
          channelHandle: existingConfig.channelHandle || handle,
          faviconDataUrl: existingConfig.faviconDataUrl || "",
          faviconUrl: existingConfig.faviconUrl || "./assets/favicon-p.png",
          adminApiUrl: existingConfig.adminApiUrl || `https://${new URL(request.url).host}`,

          // Only YouTube-owned branding is refreshed.
          channelTitle: branding.channelTitle || existingConfig.channelTitle || "",
          profileImageUrl: branding.profileImageUrl || existingConfig.profileImageUrl || "",
          bannerImageUrl: branding.bannerImageUrl || existingConfig.bannerImageUrl || "",

          updatedAt: new Date().toISOString(),
          syncedFromYoutubeAt: new Date().toISOString(),
        };

        const configResult = await updateGithubFile({
          env,
          owner,
          repo,
          branch,
          path: "site-config.json",
          contentText: JSON.stringify(mergedConfig, null, 2) + "\n",
          message: "Sync YouTube channel branding",
        });

        await appendAdminHistory({
          env, owner, repo, branch,
          entry: {
            action: syncSource === "auto"
              ? "auto_sync_apply"
              : syncSource === "manual-auto-test"
                ? "auto_sync_test_apply"
                : "sync_apply",
            title: syncSource === "auto"
              ? "YouTube 자동 동기화"
              : syncSource === "manual-auto-test"
                ? "YouTube 자동 동기화 수동 실행"
                : "YouTube 영상 동기화",
            before: { total: (existingPayload.videos || []).length },
            after: {
              total: normalized.length,
              added: syncPreview.added,
              titleChanged: syncPreview.titleChanged,
              descriptionChanged: syncPreview.descriptionChanged,
              removed: syncPreview.removed
            }
          }
        });

        return jsonResponse({
          ok: true,
          total: normalized.length,
          channelTitle: channel.snippet?.title || "",
          updatedAt: new Date().toISOString(),
          commitUrl: result.commit?.html_url || null,
          configCommitUrl: configResult.commit?.html_url || null,
          bannerImageUrl: mergedConfig.bannerImageUrl,
          profileImageUrl: mergedConfig.profileImageUrl,
          syncSource,
          applied: true,
          outcome: "applied",
          changed: syncChanged,
          ...syncPreview,
        }, 200, env, origin);
      }

      if (url.pathname === "/accept-description-date" && request.method === "POST") {
        requireAdmin(request, env);
        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const body = await request.json();

        const videoId = String(body.videoId || "").trim();
        if (!videoId) throw new HttpError(400, "영상 ID가 필요합니다.");

        const payload = await readGithubJsonFile({
          env, owner, repo, branch, path: "data/videos.json"
        });
        if (!payload || !Array.isArray(payload.videos)) {
          throw new HttpError(404, "videos.json을 찾지 못했습니다.");
        }

        const video = payload.videos.find(v => String(v.id) === videoId);
        if (!video) throw new HttpError(404, "해당 영상을 찾지 못했습니다.");
        const historyBefore = {
          previousManualDates: Array.isArray(video.previousManualDates) ? video.previousManualDates : [],
          dates: Array.isArray(video.dates) ? video.dates : []
        };

        video.manualDateReviewPending = false;
        video.descriptionChangedAfterManual = false;
        video.previousManualDates = [];
        payload.generatedAt = new Date().toISOString();

        const result = await updateGithubFile({
          env, owner, repo, branch, path: "data/videos.json",
          contentText: JSON.stringify(payload, null, 2) + "\n",
          message: `Accept description date for ${videoId}`
        });

        await appendAdminHistory({
          env, owner, repo, branch,
          entry: {
            action: "accept_description_date",
            videoId,
            title: video.title || videoId,
            before: historyBefore,
            after: { dates: video.dates || [] }
          }
        });

        return jsonResponse({
          ok: true,
          videoId,
          commitUrl: result.commit?.html_url || null
        }, 200, env, origin);
      }

      if (url.pathname === "/apply-date-overrides" && request.method === "POST") {
        requireAdmin(request, env);
        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const body = await request.json();

        const videoId = String(body.videoId || "").trim();
        const dates = Array.isArray(body.dates) ? body.dates : [];

        if (!videoId || !dates.length || dates.length > 20) {
          throw new HttpError(400, "적용할 날짜 목록이 올바르지 않습니다.");
        }

        const normalizedDates = dates.map(entry => {
          const sourceDate = String(entry?.sourceDate || "").trim();
          const precision = ["day","month","year"].includes(entry?.precision) ? entry.precision : "day";
          if (!/^(19|20)\d{2}-\d{2}-\d{2}$/.test(sourceDate)) {
            throw new HttpError(400, "날짜 형식이 올바르지 않습니다.");
          }
          return {
            sourceDate,
            source: "admin",
            precision,
            inferred: precision !== "day",
            manual: true
          };
        });

        const payload = await readGithubJsonFile({
          env, owner, repo, branch, path: "data/videos.json"
        });
        if (!payload || !Array.isArray(payload.videos)) {
          throw new HttpError(404, "videos.json을 찾지 못했습니다.");
        }

        const video = payload.videos.find(v => String(v.id) === videoId);
        if (!video) throw new HttpError(404, "해당 영상을 찾지 못했습니다.");

        const historyBeforeDates = Array.isArray(video.dates) ? video.dates : [];
        const currentDates = Array.isArray(video.dates) ? video.dates : [];
        const merged = [...currentDates];

        for (const entry of normalizedDates) {
          const key = `${entry.sourceDate}|${entry.precision}`;
          if (!merged.some(x => `${x.sourceDate}|${x.precision || "day"}` === key)) {
            merged.push(entry);
          }
        }

        video.dates = merged;
        video.sourceDate = merged[0]?.sourceDate || video.sourceDate || null;
        video.parseStatus = "parsed";
        video.manualDateReviewPending = false;
        video.descriptionChangedAfterManual = false;
        video.previousManualDates = [];
        payload.generatedAt = new Date().toISOString();

        const result = await updateGithubFile({
          env, owner, repo, branch, path: "data/videos.json",
          contentText: JSON.stringify(payload, null, 2) + "\n",
          message: `Apply ${normalizedDates.length} manual date override(s) to ${videoId}`
        });

        await appendAdminHistory({
          env, owner, repo, branch,
          entry: {
            action: "manual_date",
            videoId,
            title: video.title || videoId,
            before: historyBeforeDates,
            after: video.dates || []
          }
        });

        return jsonResponse({
          ok: true,
          videoId,
          dates: normalizedDates,
          commitUrl: result.commit?.html_url || null
        }, 200, env, origin);
      }

      if (url.pathname === "/apply-date-override" && request.method === "POST") {
        requireAdmin(request, env);
        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const body = await request.json();
        const videoId = String(body.videoId || "").trim();
        const sourceDate = String(body.sourceDate || "").trim();
        const precision = String(body.precision || "month").trim();
        const candidateKey = String(body.candidateKey || body.candidateRaw || "").trim();

        if (!videoId || !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate) || !["day","month","year"].includes(precision)) {
          throw new HttpError(400, "날짜 후보 적용 값이 올바르지 않습니다.");
        }

        const payload = await readGithubJsonFile({ env, owner, repo, branch, path: "data/videos.json" });
        if (!payload || !Array.isArray(payload.videos)) throw new HttpError(404, "videos.json을 찾지 못했습니다.");
        const video = payload.videos.find(v => String(v.id) === videoId);
        if (!video) throw new HttpError(404, "해당 영상을 찾지 못했습니다.");

        const historyBeforeDates = Array.isArray(video.dates) ? video.dates : [];
        const dates = Array.isArray(video.dates) ? video.dates : [];
        const manualEntry = { sourceDate, source: "admin", precision, inferred: precision !== "day", manual: true };
        if (!dates.some(d => d?.sourceDate === sourceDate && (d?.precision || "day") === precision)) dates.push(manualEntry);
        video.dates = dates;
        video.parseStatus = "parsed";
        video.manualDateReviewPending = false;
        video.descriptionChangedAfterManual = false;
        video.previousManualDates = [];
        if (candidateKey && Array.isArray(video.ignoredDateCandidates)) {
          video.ignoredDateCandidates = video.ignoredDateCandidates.filter(x => String(x) !== candidateKey);
        }
        payload.generatedAt = new Date().toISOString();

        const result = await updateGithubFile({
          env, owner, repo, branch, path: "data/videos.json",
          contentText: JSON.stringify(payload, null, 2) + "\n",
          message: `Apply date override for ${videoId}`
        });
        await appendAdminHistory({
          env, owner, repo, branch,
          entry: {
            action: "candidate_date",
            videoId,
            title: video.title || videoId,
            before: historyBeforeDates,
            after: video.dates || []
          }
        });
        return jsonResponse({ ok:true, videoId, sourceDate, precision, commitUrl:result.commit?.html_url || null }, 200, env, origin);
      }

      if (url.pathname === "/ignore-date-candidate" && request.method === "POST") {
        requireAdmin(request, env);
        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const body = await request.json();
        const videoId = String(body.videoId || "").trim();
        const candidateKey = String(body.candidateKey || body.candidateRaw || "").trim();
        if (!videoId || !candidateKey || candidateKey.length > 120) {
          throw new HttpError(400, "제외할 날짜 후보가 올바르지 않습니다.");
        }

        const payload = await readGithubJsonFile({ env, owner, repo, branch, path: "data/videos.json" });
        if (!payload || !Array.isArray(payload.videos)) throw new HttpError(404, "videos.json을 찾지 못했습니다.");
        const video = payload.videos.find(v => String(v.id) === videoId);
        if (!video) throw new HttpError(404, "해당 영상을 찾지 못했습니다.");
        const historyBeforeIgnored = Array.isArray(video.ignoredDateCandidates) ? video.ignoredDateCandidates.map(String) : [];
        video.ignoredDateCandidates = [...new Set([...(video.ignoredDateCandidates || []).map(String), candidateKey])];
        payload.generatedAt = new Date().toISOString();

        const result = await updateGithubFile({
          env, owner, repo, branch, path: "data/videos.json",
          contentText: JSON.stringify(payload, null, 2) + "\n",
          message: `Ignore date candidate for ${videoId}`
        });
        await appendAdminHistory({
          env, owner, repo, branch,
          entry: {
            action: "ignore_candidate",
            videoId,
            title: video.title || videoId,
            before: historyBeforeIgnored,
            after: video.ignoredDateCandidates || []
          }
        });
        return jsonResponse({ ok:true, videoId, candidateKey, commitUrl:result.commit?.html_url || null }, 200, env, origin);
      }

      if (url.pathname === "/set-playlist-scope" && request.method === "POST") {
        requireAdmin(request, env);
        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const body = await request.json();

        const videoId = String(body.videoId || "").trim();
        const playlistScope = String(body.playlistScope || "").trim();

        if (!videoId || !["multi-year", "undated"].includes(playlistScope)) {
          throw new HttpError(400, "플레이리스트 범위 값이 올바르지 않습니다.");
        }

        const payload = await readGithubJsonFile({
          env, owner, repo, branch, path: "data/videos.json"
        });
        if (!payload || !Array.isArray(payload.videos)) {
          throw new HttpError(404, "videos.json을 찾지 못했습니다.");
        }

        const video = payload.videos.find(v => String(v.id) === videoId);
        if (!video) throw new HttpError(404, "해당 영상을 찾지 못했습니다.");
        if (video.contentType !== "playlist") {
          throw new HttpError(400, "플레이리스트로 지정된 영상만 범위를 설정할 수 있습니다.");
        }

        const historyBeforeScope = video.playlistScope || "";
        video.playlistScope = playlistScope;
        payload.generatedAt = new Date().toISOString();

        const result = await updateGithubFile({
          env, owner, repo, branch, path: "data/videos.json",
          contentText: JSON.stringify(payload, null, 2) + "\n",
          message: `Set playlist scope ${playlistScope} for ${videoId}`
        });

        await appendAdminHistory({
          env, owner, repo, branch,
          entry: {
            action: "playlist_scope",
            videoId,
            title: video.title || videoId,
            before: historyBeforeScope,
            after: playlistScope
          }
        });

        return jsonResponse({
          ok: true,
          videoId,
          playlistScope,
          commitUrl: result.commit?.html_url || null
        }, 200, env, origin);
      }

      if (url.pathname === "/set-video-format" && request.method === "POST") {
        requireAdmin(request, env);
        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const body = await request.json();

        const videoId = String(body.videoId || "").trim();
        const videoFormat = String(body.videoFormat || "").trim();

        if (!videoId || !["standard", "shorts"].includes(videoFormat)) {
          throw new HttpError(400, "동영상 타입 값이 올바르지 않습니다.");
        }

        const payload = await readGithubJsonFile({
          env, owner, repo, branch, path: "data/videos.json"
        });
        if (!payload || !Array.isArray(payload.videos)) {
          throw new HttpError(404, "videos.json을 찾지 못했습니다.");
        }

        const video = payload.videos.find(v => String(v.id) === videoId);
        if (!video) throw new HttpError(404, "해당 영상을 찾지 못했습니다.");

        const before = {
          videoFormat: ["standard", "shorts"].includes(video.videoFormat)
            ? video.videoFormat
            : "standard",
          videoFormatSource: ["manual", "confirmed"].includes(video.videoFormatSource)
            ? video.videoFormatSource
            : "auto",
          videoFormatConfidence: String(video.videoFormatConfidence || ""),
          videoFormatReason: String(video.videoFormatReason || "")
        };

        video.videoFormat = videoFormat;
        video.videoFormatSource = "manual";
        video.videoFormatConfidence = "";
        video.videoFormatReason = "";
        payload.generatedAt = new Date().toISOString();

        const result = await updateGithubFile({
          env, owner, repo, branch, path: "data/videos.json",
          contentText: JSON.stringify(payload, null, 2) + "\n",
          message: `Set video format ${videoFormat} for ${videoId}`
        });

        await appendAdminHistory({
          env, owner, repo, branch,
          entry: {
            action: "video_format",
            videoId,
            title: video.title || videoId,
            before,
            after: {
              videoFormat: video.videoFormat,
              videoFormatSource: video.videoFormatSource,
              videoFormatConfidence: "",
              videoFormatReason: ""
            }
          }
        });

        return jsonResponse({
          ok: true,
          videoId,
          videoFormat,
          videoFormatSource: "manual",
          commitUrl: result.commit?.html_url || null
        }, 200, env, origin);
      }

      if (url.pathname === "/probe-video-formats" && request.method === "POST") {
        requireAdmin(request, env);

        const body = await request.json();
        const videoIds = Array.isArray(body.videoIds)
          ? [...new Set(body.videoIds.map(x => String(x || "").trim()).filter(Boolean))]
          : [];

        if (!videoIds.length) {
          throw new HttpError(400, "확인할 영상 ID가 없습니다.");
        }
        if (videoIds.length > 20) {
          throw new HttpError(400, "한 번에 최대 20개까지 확인할 수 있습니다.");
        }

        const results = await Promise.all(videoIds.map(probeYoutubeVideoFormat));
        return jsonResponse({ ok:true, results }, 200, env, origin);
      }

      if (url.pathname === "/apply-video-format-probes" && request.method === "POST") {
        requireAdmin(request, env);

        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const body = await request.json();

        const valid = (Array.isArray(body.results) ? body.results : [])
          .map(item => ({
            videoId:String(item?.videoId || "").trim(),
            videoFormat:String(item?.videoFormat || "").trim(),
            reason:String(item?.reason || "").trim()
          }))
          .filter(item => item.videoId && ["standard","shorts"].includes(item.videoFormat));

        if (!valid.length) {
          throw new HttpError(400, "저장할 자동 확인 결과가 없습니다.");
        }

        const payload = await readGithubJsonFile({
          env, owner, repo, branch, path:"data/videos.json"
        });

        if (!payload || !Array.isArray(payload.videos)) {
          throw new HttpError(404, "videos.json을 찾지 못했습니다.");
        }

        await createAdminBackup({
          env, owner, repo, branch,
          currentPayload: payload,
          reason: "before_format_verify"
        });

        const byId = new Map(valid.map(item => [item.videoId, item]));
        const applied = [];

        for (const video of payload.videos) {
          const item = byId.get(String(video.id));
          if (!item) continue;

          // Explicit human decisions always win.
          if (["manual", "confirmed"].includes(video.videoFormatSource)) continue;

          video.videoFormat = item.videoFormat;
          video.videoFormatSource = "youtube";
          video.videoFormatConfidence = "";
          video.videoFormatReason = item.reason ||
            "YouTube 공개 페이지에서 Shorts 분류를 확인했습니다.";

          applied.push({
            videoId:String(video.id),
            videoFormat:video.videoFormat,
            reason:video.videoFormatReason
          });
        }

        payload.generatedAt = new Date().toISOString();

        const result = await updateGithubFile({
          env, owner, repo, branch, path:"data/videos.json",
          contentText:JSON.stringify(payload, null, 2) + "\n",
          message:`Verify YouTube video formats (${applied.length})`
        });

        await appendAdminHistory({
          env, owner, repo, branch,
          entry:{
            action:"video_format_youtube_verify",
            title:"YouTube 동영상 타입 자동 확인",
            before:{ pending:valid.length },
            after:{
              applied:applied.length,
              shorts:applied.filter(x => x.videoFormat === "shorts").length,
              standard:applied.filter(x => x.videoFormat === "standard").length
            }
          }
        });

        return jsonResponse({
          ok:true,
          results:applied,
          commitUrl:result.commit?.html_url || null
        }, 200, env, origin);
      }

      if (url.pathname === "/confirm-video-format" && request.method === "POST") {
        requireAdmin(request, env);

        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const body = await request.json();
        const videoId = String(body.videoId || "").trim();
        const requestedFormat = String(body.videoFormat || "").trim();

        if (!videoId) {
          throw new HttpError(400, "확인할 영상 ID가 필요합니다.");
        }

        if (requestedFormat && !["standard", "shorts"].includes(requestedFormat)) {
          throw new HttpError(400, "확인할 동영상 타입 값이 올바르지 않습니다.");
        }

        const payload = await readGithubJsonFile({
          env, owner, repo, branch, path: "data/videos.json"
        });

        if (!payload || !Array.isArray(payload.videos)) {
          throw new HttpError(404, "videos.json을 찾지 못했습니다.");
        }

        const video = payload.videos.find(v => String(v.id) === videoId);
        if (!video) throw new HttpError(404, "해당 영상을 찾지 못했습니다.");

        const currentFormat = ["standard", "shorts"].includes(video.videoFormat)
          ? video.videoFormat
          : (["standard", "shorts"].includes(requestedFormat) ? requestedFormat : "");

        if (!currentFormat) {
          throw new HttpError(400, "현재 동영상 타입을 확인할 수 없습니다.");
        }

        const before = {
          videoFormat: currentFormat,
          videoFormatSource: ["manual", "confirmed"].includes(video.videoFormatSource)
            ? video.videoFormatSource
            : "auto",
          videoFormatConfidence: String(video.videoFormatConfidence || ""),
          videoFormatReason: String(video.videoFormatReason || "")
        };

        video.videoFormat = currentFormat;
        video.videoFormatSource = "confirmed";
        video.videoFormatConfidence = "";
        video.videoFormatReason = "관리자가 자동 판별 결과를 확인했습니다.";
        payload.generatedAt = new Date().toISOString();

        const result = await updateGithubFile({
          env, owner, repo, branch, path: "data/videos.json",
          contentText: JSON.stringify(payload, null, 2) + "\n",
          message: `Confirm video format ${video.videoFormat} for ${videoId}`
        });

        await appendAdminHistory({
          env, owner, repo, branch,
          entry: {
            action: "video_format_confirm",
            videoId,
            title: video.title || videoId,
            before,
            after: {
              videoFormat: video.videoFormat,
              videoFormatSource: "confirmed",
              videoFormatConfidence: "",
              videoFormatReason: video.videoFormatReason
            }
          }
        });

        return jsonResponse({
          ok: true,
          videoId,
          videoFormat: video.videoFormat,
          videoFormatSource: "confirmed",
          videoFormatReason: video.videoFormatReason,
          commitUrl: result.commit?.html_url || null
        }, 200, env, origin);
      }

      if (url.pathname === "/set-content-type" && request.method === "POST") {
        requireAdmin(request, env);
        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const body = await request.json();

        const videoId = String(body.videoId || "").trim();
        const contentType = String(body.contentType || "video").trim();

        if (!videoId || !["video", "playlist"].includes(contentType)) {
          throw new HttpError(400, "콘텐츠 유형 값이 올바르지 않습니다.");
        }

        const payload = await readGithubJsonFile({
          env, owner, repo, branch, path: "data/videos.json"
        });
        if (!payload || !Array.isArray(payload.videos)) {
          throw new HttpError(404, "videos.json을 찾지 못했습니다.");
        }

        const video = payload.videos.find(v => String(v.id) === videoId);
        if (!video) throw new HttpError(404, "해당 영상을 찾지 못했습니다.");

        const historyBeforeContent = {
          contentType: video.contentType || "video",
          playlistScope: video.playlistScope || ""
        };
        video.contentType = contentType;
        if (contentType === "playlist") {
          if (!["multi-year", "undated"].includes(video.playlistScope)) {
            video.playlistScope = Array.isArray(video.dates) && video.dates.length ? "" : "undated";
          }
        } else {
          video.playlistScope = "";
        }
        payload.generatedAt = new Date().toISOString();

        const result = await updateGithubFile({
          env, owner, repo, branch, path: "data/videos.json",
          contentText: JSON.stringify(payload, null, 2) + "\n",
          message: `${contentType === "playlist" ? "Mark playlist" : "Mark regular video"} ${videoId}`
        });

        await appendAdminHistory({
          env, owner, repo, branch,
          entry: {
            action: "content_type",
            videoId,
            title: video.title || videoId,
            before: historyBeforeContent,
            after: {
              contentType: video.contentType,
              playlistScope: video.playlistScope || ""
            }
          }
        });

        return jsonResponse({
          ok: true,
          videoId,
          contentType,
          commitUrl: result.commit?.html_url || null
        }, 200, env, origin);
      }

      if (url.pathname === "/update-site-config" && request.method === "POST") {
        requireAdmin(request, env);

        const owner = env.GITHUB_OWNER || "pilsaegyo";
        const repo = env.GITHUB_REPO || "pilsae";
        const branch = env.GITHUB_BRANCH || "main";
        const body = await request.json();

        const title = String(body.title || "").trim();
        const channelHandle = String(body.channelHandle || "@pilsae").trim();
        const faviconDataUrl = String(body.faviconDataUrl || "").trim();
        const adminApiUrl = String(body.adminApiUrl || "").trim();

        if (!title) {
          throw new HttpError(400, "사이트 타이틀을 입력해 주세요.");
        }
        if (title.length > 120) {
          throw new HttpError(400, "사이트 타이틀이 너무 깁니다.");
        }
        if (faviconDataUrl) {
          if (!/^data:image\/(png|jpeg|jpg|webp|x-icon|vnd\.microsoft\.icon);base64,/i.test(faviconDataUrl)) {
            throw new HttpError(400, "지원하지 않는 파비콘 형식입니다.");
          }
          if (faviconDataUrl.length > 300_000) {
            throw new HttpError(400, "파비콘 파일이 너무 큽니다. 200KB 이하를 권장합니다.");
          }
        }

        const existingConfig = await readGithubJsonFile({
          env, owner, repo, branch, path: "site-config.json"
        }) || {};

        const historyBeforeConfig = {
          title: existingConfig.title || "",
          channelHandle: existingConfig.channelHandle || "",
          faviconChanged: Boolean(existingConfig.faviconDataUrl)
        };

        const config = {
          ...existingConfig,
          title,
          channelHandle: channelHandle || existingConfig.channelHandle || "@pilsae",
          channelTitle: existingConfig.channelTitle || "",
          faviconDataUrl,
          faviconUrl: existingConfig.faviconUrl || "./assets/favicon-p.png",
          profileImageUrl: existingConfig.profileImageUrl || "",
          bannerImageUrl: existingConfig.bannerImageUrl || "",
          adminApiUrl: adminApiUrl || existingConfig.adminApiUrl || `https://${new URL(request.url).host}`,
          updatedAt: new Date().toISOString(),
        };

        const result = await updateGithubFile({
          env,
          owner,
          repo,
          branch,
          path: "site-config.json",
          contentText: JSON.stringify(config, null, 2) + "\n",
          message: "Update site configuration",
        });

        await appendAdminHistory({
          env, owner, repo, branch,
          entry: {
            action: "site_config",
            title: "사이트 설정",
            before: historyBeforeConfig,
            after: {
              title: config.title,
              channelHandle: config.channelHandle,
              faviconChanged: Boolean(config.faviconDataUrl)
            }
          }
        });

        return jsonResponse({
          ok: true,
          config,
          commitUrl: result.commit?.html_url || null,
        }, 200, env, origin);
      }

      return jsonResponse({ ok: false, error: "Not found" }, 404, env, origin);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      return jsonResponse({ ok: false, error: message }, status, env, origin);
    }
  },

  async scheduled(controller, env, ctx) {
    const cron = String(controller?.cron || "");

    console.log("[scheduled] received", {
      cron,
      scheduledAt:new Date(controller?.scheduledTime || Date.now()).toISOString()
    });

    if (cron === "0 18 * * 6") {
      await runWeeklyArchiveBackup(env, controller);
      return;
    }

    if (cron === "0 11 * * *") {
      await runScheduledYoutubeSync(env, controller);
      return;
    }

    throw new Error(`Unknown scheduled cron: ${cron}`);
  },
};

export default worker;


async function runScheduledYoutubeSync(env, controller) {
  return runAutoYoutubeSync(env, {
    source:"auto",
    scheduledTime:controller?.scheduledTime || Date.now(),
    cron:String(controller?.cron || "0 11 * * *")
  });
}

async function runAutoYoutubeSync(env, {
  source="auto",
  scheduledTime=Date.now(),
  cron="0 11 * * *"
}={}) {
  const scheduledAt = new Date(scheduledTime || Date.now()).toISOString();

  if (!env.ADMIN_TOKEN) {
    const error = new Error("ADMIN_TOKEN Secret이 없습니다.");
    console.error("[auto-sync] failed", { scheduledAt, cron, source, error:error.message });
    throw error;
  }

  const selfUrl = String(
    env.ADMIN_API_SELF_URL || "https://pilsae-admin-api.hyesung.workers.dev"
  ).replace(/\\\/$/, "");

  const headers = {
    "Content-Type":"application/json",
    "Authorization":`Bearer ${env.ADMIN_TOKEN}`
  };

  try {
    const syncRequest = new Request(`${selfUrl}/sync-videos`, {
      method:"POST",
      headers,
      body:JSON.stringify({
        previewOnly:false,
        syncSource:source
      })
    });

    const syncResponse = await worker.fetch(syncRequest, env);
    const result = await syncResponse.json().catch(() => ({}));

    if (!syncResponse.ok || !result?.ok) {
      throw new Error(result?.error || `sync failed (${syncResponse.status})`);
    }

    if (result.outcome === "no_changes" || result.applied === false) {
      const noChange = {
        outcome:"no_changes",
        scheduledAt,
        cron,
        source,
        total:Number(result.total || 0),
        changed:0,
        added:Number(result.added || 0),
        titleChanged:Number(result.titleChanged || 0),
        descriptionChanged:Number(result.descriptionChanged || 0),
        removed:Number(result.removed || 0)
      };
      console.log("[auto-sync] no changes", noChange);
      return noChange;
    }

    const applied = {
      outcome:"applied",
      scheduledAt,
      cron,
      source,
      total:Number(result.total || 0),
      changed:Number(result.changed || (
        Number(result.added || 0) +
        Number(result.titleChanged || 0) +
        Number(result.descriptionChanged || 0) +
        Number(result.removed || 0)
      )),
      added:Number(result.added || 0),
      titleChanged:Number(result.titleChanged || 0),
      descriptionChanged:Number(result.descriptionChanged || 0),
      removed:Number(result.removed || 0),
      commitUrl:String(result.commitUrl || "")
    };

    console.log("[auto-sync] applied", applied);
    return applied;
  } catch (error) {
    const message = String(error?.message || error || "unknown error");
    console.error("[auto-sync] failed", {
      scheduledAt,
      cron,
      source,
      error:message
    });
    throw error;
  }
}

async function runWeeklyArchiveBackup(env, controller) {
  const scheduledAt = new Date(controller?.scheduledTime || Date.now()).toISOString();
  const cron = String(controller?.cron || "0 18 * * 6");

  const owner = env.GITHUB_OWNER || "pilsaegyo";
  const repo = env.GITHUB_REPO || "pilsae";
  const branch = env.GITHUB_BRANCH || "main";

  if (!env.GITHUB_TOKEN) {
    console.error("[weekly-backup] GITHUB_TOKEN is missing", { scheduledAt, cron });
    return;
  }

  try {
    const [videosPayload, siteConfigPayload, historyPayload] = await Promise.all([
      readGithubJsonFile({ env, owner, repo, branch, path:"data/videos.json" }),
      readGithubJsonFile({ env, owner, repo, branch, path:"site-config.json" }),
      readGithubJsonFile({ env, owner, repo, branch, path:"data/admin-history.json" })
    ]);

    if (!videosPayload || !Array.isArray(videosPayload.videos)) {
      throw new Error("videos.json을 읽지 못했습니다.");
    }

    const backup = await createWeeklyArchiveBackup({
      env,
      owner,
      repo,
      branch,
      videosPayload,
      siteConfigPayload:siteConfigPayload || {},
      historyPayload:historyPayload || { entries:[] }
    });

    console.log("[weekly-backup] completed", {
      scheduledAt,
      cron,
      id:backup.id,
      slot:backup.slot,
      total:backup.total
    });
  } catch (error) {
    console.error("[weekly-backup] failed", {
      scheduledAt,
      cron,
      error:String(error?.message || error || "unknown error")
    });
    throw error;
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) {
    throw new HttpError(500, "ADMIN_TOKEN Secret이 없습니다.");
  }

  const auth = request.headers.get("Authorization") || "";
  const expected = `Bearer ${env.ADMIN_TOKEN}`;

  if (auth !== expected) {
    throw new HttpError(401, "관리자 인증에 실패했습니다.");
  }
}

function corsHeaders(env, origin) {
  const allowed = env.ALLOWED_ORIGIN || "https://pilsae.hyesung.workers.dev";
  const allowOrigin = origin === allowed ? origin : allowed;

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

function jsonResponse(data, status, env, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(env, origin),
    },
  });
}

function htmlResponse(html, status, env, origin) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      ...corsHeaders(env, origin),
    },
  });
}

async function youtubeFetch(path, params, apiKey) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok) {
    const message =
      data?.error?.message ||
      `YouTube API 오류 (${res.status})`;
    throw new HttpError(502, message);
  }

  return data;
}

async function getChannel(handle, apiKey) {
  const data = await youtubeFetch("channels", {
    part: "snippet,contentDetails,brandingSettings",
    forHandle: handle,
  }, apiKey);

  const channel = data.items?.[0];
  if (!channel) {
    throw new HttpError(404, `YouTube 채널을 찾지 못했습니다: ${handle}`);
  }
  return channel;
}

async function getAllUploadVideoIds(playlistId, apiKey) {
  const ids = [];
  let pageToken = "";

  do {
    const data = await youtubeFetch("playlistItems", {
      part: "contentDetails",
      playlistId,
      maxResults: 50,
      pageToken,
    }, apiKey);

    for (const item of data.items || []) {
      const id = item.contentDetails?.videoId;
      if (id) ids.push(id);
    }

    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return [...new Set(ids)];
}

async function getVideos(ids, apiKey) {
  if (!ids.length) return [];

  const data = await youtubeFetch("videos", {
    part: "snippet,status,contentDetails",
    id: ids.join(","),
  }, apiKey);

  return data.items || [];
}

function normalizeDescriptionForCompare(value="") {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function parseIso8601Duration(value="") {
  const m = String(value || "").match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const days = Number(m[1] || 0);
  const hours = Number(m[2] || 0);
  const minutes = Number(m[3] || 0);
  const seconds = Number(m[4] || 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function detectYoutubeVideoFormat(video) {
  const snippet = video?.snippet || {};
  const duration = String(video?.contentDetails?.duration || "");
  const durationSeconds = parseIso8601Duration(duration);
  const publishedAt = String(snippet.publishedAt || "");
  const text = [
    snippet.title || "",
    snippet.description || "",
    ...(Array.isArray(snippet.tags) ? snippet.tags : [])
  ].join(" ").toLowerCase();

  if (/(^|\s|#)shorts?\b/i.test(text)) {
    return { format:"shorts", confidence:"high", reason:"YouTube 메타데이터에 Shorts 표기" };
  }
  if (durationSeconds > 0 && durationSeconds <= 60) {
    return { format:"shorts", confidence:"medium", reason:"재생시간 60초 이하" };
  }
  if (publishedAt.slice(0,10) >= "2024-10-15" && durationSeconds > 0 && durationSeconds <= 180) {
    return { format:"shorts", confidence:"low", reason:"2024-10-15 이후 · 3분 이하 · 화면비율 확인 필요" };
  }
  return { format:"standard", confidence:"high", reason:"자동 기준상 일반동영상" };
}

function extractYoutubeShortsEligibility(html="") {
  const match = String(html || "").match(/"isShortsEligible"\s*:\s*(true|false)/);
  return match ? match[1] === "true" : null;
}

async function probeYoutubeVideoFormat(videoId) {
  const id = String(videoId || "").trim();

  try {
    const response = await fetch(
      `https://www.youtube.com/watch?v=${encodeURIComponent(id)}&hl=en`,
      {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PilsaeArchive/1.0)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.8"
        }
      }
    );

    if (!response.ok) {
      return { videoId:id, videoFormat:"", reason:`YouTube 응답 ${response.status}` };
    }

    const html = await response.text();
    const eligible = extractYoutubeShortsEligibility(html);

    if (eligible === true) {
      return {
        videoId:id,
        videoFormat:"shorts",
        reason:"YouTube 공개 페이지에서 Shorts 분류 확인"
      };
    }

    if (eligible === false) {
      return {
        videoId:id,
        videoFormat:"standard",
        reason:"YouTube 공개 페이지에서 일반동영상 분류 확인"
      };
    }

    return {
      videoId:id,
      videoFormat:"",
      reason:"YouTube 페이지에서 Shorts 분류값을 찾지 못함"
    };
  } catch (error) {
    return {
      videoId:id,
      videoFormat:"",
      reason:`YouTube 확인 실패: ${String(error?.message || error)}`
    };
  }
}


function detectPlaylistCandidate(title="", description="") {
  const text = `${title} ${description}`.toLowerCase();
  return [
    "플레이리스트",
    "playlist",
    "노래 모음",
    "노래모음",
    "곡 모음",
    "곡모음",
    "전곡",
    "모음집",
    "合集"
  ].some(keyword => text.includes(keyword));
}

function normalizeYoutubeVideo(video) {
  if (!video?.id || !video?.snippet) return null;

  const s = video.snippet;
  const thumbnail =
    s.thumbnails?.maxres?.url ||
    s.thumbnails?.standard?.url ||
    s.thumbnails?.high?.url ||
    s.thumbnails?.medium?.url ||
    s.thumbnails?.default?.url ||
    "";

  const description = String(s.description || "");
  const duration = String(video.contentDetails?.duration || "");
  const durationSeconds = parseIso8601Duration(duration);
  const formatAssessment = detectYoutubeVideoFormat(video);

  return {
    id: String(video.id),
    title: String(s.title || ""),
    description,
    source: firstUsefulLine(description),
    sourceDate: null,
    publishedAt: String(s.publishedAt || ""),
    thumbnail,
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`,
    duration,
    durationSeconds,
    videoFormat: formatAssessment.format,
    videoFormatSource: "auto",
    videoFormatConfidence: formatAssessment.confidence,
    videoFormatReason: formatAssessment.reason,
    parseStatus: "needs_review",
    contentType: "video",
    playlistScope: "",
    playlistCandidate: detectPlaylistCandidate(s.title || "", description),
    firstSeenAt: "",
    dates: [],
    ignoredDateCandidates: [],
  };
}

function firstUsefulLine(description) {
  const lines = String(description || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  return lines.find((line) => !line.startsWith("#")) || "";
}

function extractChannelBranding(channel, handle) {
  const snippet = channel?.snippet || {};
  const brandingImage = channel?.brandingSettings?.image || {};

  const profileImageUrl =
    snippet.thumbnails?.high?.url ||
    snippet.thumbnails?.medium?.url ||
    snippet.thumbnails?.default?.url ||
    "";

  const bannerImageUrl =
    brandingImage.bannerExternalUrl ||
    brandingImage.bannerTvHighImageUrl ||
    brandingImage.bannerTvImageUrl ||
    brandingImage.bannerTabletLowImageUrl ||
    brandingImage.bannerTabletImageUrl ||
    brandingImage.bannerMobileExtraHdImageUrl ||
    brandingImage.bannerMobileHdImageUrl ||
    brandingImage.bannerMobileLowImageUrl ||
    brandingImage.bannerMobileImageUrl ||
    "";

  return {
    channelTitle: String(snippet.title || ""),
    channelHandle: handle,
    profileImageUrl,
    bannerImageUrl,
  };
}

function compactPreviewText(value, max=90) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

function buildSyncPreview(existingVideos, nextVideos) {
  const existingById = new Map((existingVideos || []).map(v => [String(v.id), v]));
  const nextById = new Map((nextVideos || []).map(v => [String(v.id), v]));
  const changes = [];

  let added = 0;
  let titleChanged = 0;
  let descriptionChanged = 0;
  let unchanged = 0;

  for (const next of (nextVideos || [])) {
    const old = existingById.get(String(next.id));

    if (!old) {
      added += 1;
      changes.push({
        kind: "신규",
        id: String(next.id || ""),
        title: String(next.title || "")
      });
      continue;
    }

    let changed = false;

    if (String(old.title || "") !== String(next.title || "")) {
      titleChanged += 1;
      changed = true;
      changes.push({
        kind: "제목 변경",
        id: String(next.id || ""),
        title: String(next.title || ""),
        before: compactPreviewText(old.title),
        after: compactPreviewText(next.title)
      });
    }

    if (normalizeDescriptionForCompare(old.description || "") !== normalizeDescriptionForCompare(next.description || "")) {
      descriptionChanged += 1;
      changed = true;
      changes.push({
        kind: "설명 변경",
        id: String(next.id || ""),
        title: String(next.title || old.title || ""),
        before: compactPreviewText(old.description),
        after: compactPreviewText(next.description)
      });
    }

    if (!changed) unchanged += 1;
  }

  let removed = 0;
  for (const old of (existingVideos || [])) {
    if (!nextById.has(String(old.id))) {
      removed += 1;
      changes.push({
        kind: "삭제 후보",
        id: String(old.id || ""),
        title: String(old.title || "")
      });
    }
  }

  return {
    added,
    titleChanged,
    descriptionChanged,
    removed,
    unchanged,
    changes
  };
}

async function createAdminBackup({
  env,
  owner,
  repo,
  branch,
  currentPayload,
  reason = "manual",
  avoidSlot = 0
}) {
  if (!currentPayload || !Array.isArray(currentPayload.videos)) {
    throw new HttpError(400, "백업할 영상 데이터가 올바르지 않습니다.");
  }

  const indexPath = "data/admin-backups-index.json";
  const currentIndex = await readGithubJsonFile({
    env, owner, repo, branch, path: indexPath
  }) || { nextSlot: 1, backups: [] };

  const existing = Array.isArray(currentIndex.backups)
    ? currentIndex.backups
    : [];

  let slot = Number(currentIndex.nextSlot || 1);
  if (![1,2,3].includes(slot)) slot = 1;

  if (avoidSlot && slot === avoidSlot) {
    slot = slot % 3 + 1;
  }

  const createdAt = new Date().toISOString();
  const id = `${Date.now()}-${slot}`;
  const path = `data/backups/videos-${slot}.json`;

  await updateGithubFile({
    env,
    owner,
    repo,
    branch,
    path,
    contentText: JSON.stringify(currentPayload, null, 2) + "\n",
    message: `Create admin backup slot ${slot}`
  });

  const backup = {
    id,
    slot,
    path,
    reason: ["manual", "before_sync", "before_restore"].includes(reason) ? reason : "manual",
    createdAt,
    total: currentPayload.videos.length
  };

  const backups = [
    backup,
    ...existing.filter(item => Number(item.slot || 0) !== slot)
  ]
    .sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 3);

  let nextSlot = slot % 3 + 1;
  if (avoidSlot && nextSlot === avoidSlot) {
    nextSlot = nextSlot % 3 + 1;
  }

  await updateGithubFile({
    env,
    owner,
    repo,
    branch,
    path: indexPath,
    contentText: JSON.stringify({
      backups,
      nextSlot,
      updatedAt: createdAt
    }, null, 2) + "\n",
    message: `Update admin backup index slot ${slot}`
  });

  return backup;
}


async function createWeeklyArchiveBackup({
  env,
  owner,
  repo,
  branch,
  videosPayload,
  siteConfigPayload,
  historyPayload
}) {
  const indexPath = "data/weekly-backups-index.json";
  const currentIndex = await readGithubJsonFile({
    env, owner, repo, branch, path:indexPath
  }) || { nextSlot:1, backups:[] };

  const existing = Array.isArray(currentIndex.backups)
    ? currentIndex.backups
    : [];

  let slot = Number(currentIndex.nextSlot || 1);
  if (![1,2,3,4].includes(slot)) slot = 1;

  const createdAt = new Date().toISOString();
  const id = `weekly-${Date.now()}-${slot}`;
  const path = `data/weekly-backups/weekly-${slot}.json`;

  const snapshot = {
    backupType:"weekly_full",
    createdAt,
    videos:videosPayload,
    siteConfig:siteConfigPayload || {},
    adminHistory:historyPayload || { entries:[] }
  };

  await updateGithubFile({
    env,
    owner,
    repo,
    branch,
    path,
    contentText:JSON.stringify(snapshot, null, 2) + "\n",
    message:`Create weekly archive backup slot ${slot}`
  });

  const backup = {
    id,
    slot,
    path,
    reason:"weekly",
    createdAt,
    total:Array.isArray(videosPayload?.videos) ? videosPayload.videos.length : 0
  };

  const backups = [
    backup,
    ...existing.filter(item => Number(item.slot || 0) !== slot)
  ]
    .sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 4);

  const nextSlot = slot % 4 + 1;

  await updateGithubFile({
    env,
    owner,
    repo,
    branch,
    path:indexPath,
    contentText:JSON.stringify({
      backups,
      nextSlot,
      updatedAt:createdAt
    }, null, 2) + "\n",
    message:`Update weekly backup index slot ${slot}`
  });

  return backup;
}

function normalizedComparable(value) {
  if (Array.isArray(value)) {
    return value.map(item => normalizedComparable(item));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      // Ignore volatile / derived values that do not define the admin action.
      if (["updatedAt", "generatedAt"].includes(key)) continue;
      out[key] = normalizedComparable(value[key]);
    }
    return out;
  }
  return value ?? null;
}

function sameHistoryValue(a, b) {
  return JSON.stringify(normalizedComparable(a)) === JSON.stringify(normalizedComparable(b));
}

function snapshotHistoryState(action, video) {
  const kind = String(action || "");

  if (kind === "manual_date" || kind === "candidate_date") {
    return Array.isArray(video.dates) ? video.dates : [];
  }

  if (kind === "ignore_candidate") {
    return Array.isArray(video.ignoredDateCandidates)
      ? video.ignoredDateCandidates.map(String)
      : [];
  }

  if (kind === "accept_description_date") {
    return {
      previousManualDates: Array.isArray(video.previousManualDates) ? video.previousManualDates : [],
      dates: Array.isArray(video.dates) ? video.dates : []
    };
  }

  if (kind === "content_type") {
    return {
      contentType: video.contentType || "video",
      playlistScope: video.playlistScope || ""
    };
  }

  if (kind === "playlist_scope") {
    return video.playlistScope || "";
  }

  if (kind === "video_format" || kind === "video_format_confirm") {
    return {
      videoFormat: ["standard", "shorts"].includes(video.videoFormat)
        ? video.videoFormat
        : "standard",
      videoFormatSource: ["manual", "confirmed"].includes(video.videoFormatSource)
        ? video.videoFormatSource
        : "auto",
      videoFormatConfidence: String(video.videoFormatConfidence || ""),
      videoFormatReason: String(video.videoFormatReason || "")
    };
  }

  return null;
}

function historyEntryMatchesCurrentState(entry, video) {
  return sameHistoryValue(snapshotHistoryState(entry.action, video), entry.after);
}

function applyHistoryBeforeState(entry, video) {
  const action = String(entry.action || "");
  const before = entry.before;

  if (action === "manual_date" || action === "candidate_date") {
    video.dates = Array.isArray(before) ? before : [];
    video.parseStatus = video.dates.length ? "parsed" : "needs_review";
    video.manualDateReviewPending = false;
    video.descriptionChangedAfterManual = false;
    return;
  }

  if (action === "ignore_candidate") {
    video.ignoredDateCandidates = Array.isArray(before) ? before.map(String) : [];
    return;
  }

  if (action === "accept_description_date") {
    const prior = before && typeof before === "object" ? before : {};
    video.previousManualDates = Array.isArray(prior.previousManualDates)
      ? prior.previousManualDates
      : [];
    video.dates = Array.isArray(prior.dates) ? prior.dates : [];
    video.manualDateReviewPending = true;
    video.descriptionChangedAfterManual = true;
    video.parseStatus = "needs_review";
    return;
  }

  if (action === "content_type") {
    const prior = before && typeof before === "object" ? before : {};
    video.contentType = prior.contentType === "playlist" ? "playlist" : "video";
    video.playlistScope = ["multi-year", "undated"].includes(prior.playlistScope)
      ? prior.playlistScope
      : "";
    return;
  }

  if (action === "playlist_scope") {
    video.playlistScope = ["multi-year", "undated"].includes(before) ? before : "";
    return;
  }

  if (action === "video_format" || action === "video_format_confirm") {
    const prior = before && typeof before === "object" ? before : {};
    video.videoFormat = prior.videoFormat === "shorts" ? "shorts" : "standard";
    video.videoFormatSource = ["manual", "confirmed"].includes(prior.videoFormatSource)
      ? prior.videoFormatSource
      : "auto";
    video.videoFormatConfidence = String(prior.videoFormatConfidence || "");
    video.videoFormatReason = String(prior.videoFormatReason || "");
    return;
  }

  throw new HttpError(400, "지원하지 않는 되돌리기 작업입니다.");
}

async function appendAdminHistory({ env, owner, repo, branch, entry }) {
  try {
    const current = await readGithubJsonFile({
      env, owner, repo, branch, path: "data/admin-history.json"
    }) || { entries: [] };

    const entries = Array.isArray(current.entries) ? current.entries : [];
    const now = new Date().toISOString();
    const normalizedEntry = {
      id: typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      action: String(entry?.action || "admin_change"),
      videoId: String(entry?.videoId || ""),
      title: String(entry?.title || ""),
      before: entry?.before ?? null,
      after: entry?.after ?? null,
      undoOf: String(entry?.undoOf || ""),
      changedAt: now
    };

    const payload = {
      entries: [normalizedEntry, ...entries].slice(0, 100),
      updatedAt: now
    };

    await updateGithubFile({
      env,
      owner,
      repo,
      branch,
      path: "data/admin-history.json",
      contentText: JSON.stringify(payload, null, 2) + "\n",
      message: `Record admin history: ${normalizedEntry.action}`
    });
  } catch (err) {
    // The primary admin action has already succeeded. History is best-effort
    // and must not turn a successful data change into a failed UI response.
    console.warn("admin history write failed", err);
  }
}


const DEPLOY_PATCH_ALLOWED_FILES = new Set([
  "index.html",
  "script.js",
  "style.css",
  "README.md",
  "README_ADMIN_SYNC.md",
  "admin/index.html",
  "worker/index.js",
  "worker/wrangler.jsonc"
]);

function githubHeaders(env) {
  return {
    "Accept":"application/vnd.github+json",
    "Authorization":`Bearer ${env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version":GITHUB_API_VERSION,
    "User-Agent":"pilsae-archive-worker"
  };
}

function validateDeployPatchFiles(files) {
  if (!Array.isArray(files) || !files.length) {
    throw new HttpError(400, "배포할 파일이 없습니다.");
  }
  if (files.length > DEPLOY_PATCH_ALLOWED_FILES.size) {
    throw new HttpError(400, "배포 파일 수가 허용 범위를 초과했습니다.");
  }

  const seen = new Set();
  let totalBytes = 0;

  return files.map(item => {
    const path = String(item?.path || "").replace(/\\/g, "/").replace(/^\/+/, "");
    const contentText = String(item?.contentText ?? "");

    if (
      !path ||
      path.includes("../") ||
      path.startsWith(".") ||
      !DEPLOY_PATCH_ALLOWED_FILES.has(path)
    ) {
      throw new HttpError(400, `배포가 허용되지 않은 파일입니다: ${path || "(빈 경로)"}`);
    }

    if (seen.has(path)) {
      throw new HttpError(400, `중복 파일이 포함되어 있습니다: ${path}`);
    }
    seen.add(path);

    const bytes = new TextEncoder().encode(contentText).byteLength;
    if (bytes > 2 * 1024 * 1024) {
      throw new HttpError(413, `${path} 파일이 2MB를 초과합니다.`);
    }

    totalBytes += bytes;
    if (totalBytes > 6 * 1024 * 1024) {
      throw new HttpError(413, "배포 파일 전체 크기가 6MB를 초과합니다.");
    }

    return { path, contentText };
  });
}

async function getGithubBranchHead({ env, owner, repo, branch }) {
  const headers = githubHeaders(env);
  const refUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`;

  const refRes = await fetch(refUrl, { headers });
  const refData = await refRes.json().catch(() => ({}));

  if (!refRes.ok) {
    throw new HttpError(
      refRes.status,
      refData?.message || `GitHub 브랜치 조회 실패 (${refRes.status})`
    );
  }

  const objectSha = String(refData?.object?.sha || "");
  if (!objectSha) {
    throw new HttpError(500, "GitHub 브랜치 HEAD SHA를 확인하지 못했습니다.");
  }

  return {
    refSha:String(refData?.node_id || ""),
    objectSha
  };
}

async function githubJsonFetch(url, { env, method="GET", body }={}) {
  const res = await fetch(url, {
    method,
    headers:{
      ...githubHeaders(env),
      ...(body ? {"Content-Type":"application/json"} : {})
    },
    body:body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new HttpError(
      res.status,
      data?.message || `GitHub API 오류 (${res.status})`
    );
  }

  return data;
}

async function createGithubPatchCommit({
  env,
  owner,
  repo,
  branch,
  parentCommitSha,
  files,
  message
}) {
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const parentCommit = await githubJsonFetch(
    `${base}/git/commits/${encodeURIComponent(parentCommitSha)}`,
    { env }
  );

  const baseTreeSha = String(parentCommit?.tree?.sha || "");
  if (!baseTreeSha) {
    throw new HttpError(500, "기준 Git tree SHA를 확인하지 못했습니다.");
  }

  const treeItems = [];

  for (const file of files) {
    const blob = await githubJsonFetch(
      `${base}/git/blobs`,
      {
        env,
        method:"POST",
        body:{
          content:toBase64Utf8(file.contentText),
          encoding:"base64"
        }
      }
    );

    if (!blob?.sha) {
      throw new HttpError(500, `${file.path} Git blob 생성에 실패했습니다.`);
    }

    treeItems.push({
      path:file.path,
      mode:"100644",
      type:"blob",
      sha:blob.sha
    });
  }

  const tree = await githubJsonFetch(
    `${base}/git/trees`,
    {
      env,
      method:"POST",
      body:{
        base_tree:baseTreeSha,
        tree:treeItems
      }
    }
  );

  if (!tree?.sha) {
    throw new HttpError(500, "Git tree 생성에 실패했습니다.");
  }

  const commit = await githubJsonFetch(
    `${base}/git/commits`,
    {
      env,
      method:"POST",
      body:{
        message,
        tree:tree.sha,
        parents:[parentCommitSha]
      }
    }
  );

  if (!commit?.sha) {
    throw new HttpError(500, "Git commit 생성에 실패했습니다.");
  }

  // Re-check branch HEAD immediately before advancing the ref.
  // This is the final optimistic-lock guard against overwriting another commit.
  const latest = await getGithubBranchHead({ env, owner, repo, branch });
  if (latest.objectSha !== parentCommitSha) {
    throw new HttpError(
      409,
      "GitHub 브랜치가 배포 준비 중 변경되었습니다. 다시 검사한 후 배포해 주세요."
    );
  }

  const ref = await githubJsonFetch(
    `${base}/git/refs/heads/${encodeURIComponent(branch)}`,
    {
      env,
      method:"PATCH",
      body:{
        sha:commit.sha,
        force:false
      }
    }
  );

  return {
    commitSha:commit.sha,
    commitUrl:`https://github.com/${owner}/${repo}/commit/${commit.sha}`,
    ref
  };
}

async function readGithubJsonFile({ env, owner, repo, branch, path }) {
  const apiPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${apiPath}?ref=${encodeURIComponent(branch)}`;

  const headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "pilsae-archive-worker",
  };

  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new HttpError(res.status, `GitHub 설정 파일 조회 실패: ${text}`);
  }

  const data = await res.json();
  const content = String(data.content || "").replace(/\n/g, "");
  if (!content) return null;

  const decoded = fromBase64Utf8(content);

  try {
    return JSON.parse(decoded);
  } catch (err) {
    // v22/v22.1 could accidentally append the two literal characters "\\n"
    // after admin-history.json. Recover that specific trailing artifact so the
    // history screen can open again, then the next history write will save
    // valid JSON with a real newline.
    const repaired = decoded.replace(/\\n\s*$/, "").trimEnd();
    if (repaired !== decoded) {
      return JSON.parse(repaired);
    }
    throw err;
  }
}

function fromBase64Utf8(base64) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function updateGithubFile({
  env,
  owner,
  repo,
  branch,
  path,
  contentText,
  message,
}) {
  const apiPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${apiPath}`;

  const headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "pilsae-archive-worker",
  };

  let sha = undefined;

  const currentRes = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
    headers,
  });

  if (currentRes.ok) {
    const current = await currentRes.json();
    sha = current.sha;
  } else if (currentRes.status !== 404) {
    const text = await currentRes.text();
    throw new HttpError(
      currentRes.status,
      `GitHub 기존 파일 조회 실패: ${text}`
    );
  }

  const body = {
    message,
    content: toBase64Utf8(contentText),
    branch,
  };

  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new HttpError(
      res.status,
      data?.message || `GitHub 업데이트 실패 (${res.status})`
    );
  }

  return data;
}

function toBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}
