const DEFAULT_TITLE = "날짜로 다시 찾는 영상 기록";
const STORAGE_VIEW = "pilsaeArchiveView";
const ADMIN_TOKEN_SESSION_KEY = "pilsaeAdminToken";

let siteConfig = {
  title: DEFAULT_TITLE,
  channelHandle: "@pilsae",
  channelTitle: "필새",
  faviconDataUrl: "",
  faviconUrl: "./assets/favicon-p.png",
  profileImageUrl: "",
  bannerImageUrl: "",
  adminApiUrl: "https://pilsae-admin-api.hyesung.workers.dev"
};

let videos = [];
const PAGE_SIZE = 60;
let visibleLimit = PAGE_SIZE;
let mobileSuggestionExpanded = false;
let lastSyncPreview = null;
let adminReviewFilter = "all";
let adminReviewSort = "priority";
let adminHistoryLoaded = false;
let adminHealthFilter = "all";
let adminContentMode = "all";
let adminContentVisibleLimit = 30;
let adminBackupsLoaded = false;
const $ = (sel) => document.querySelector(sel);

function escapeHTML(value="") {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function youtubeUrlFromId(id="") {
  return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : "";
}

function isAndroidMobile() {
  return /Android/i.test(navigator.userAgent || "");
}

function isIOSMobile() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

function openYoutubeVideo(event, videoId) {
  if (!videoId) return;

  const webUrl = youtubeUrlFromId(videoId);

  // Desktop keeps the normal new-tab YouTube behavior.
  if (!isAndroidMobile() && !isIOSMobile()) return;

  event.preventDefault();

  if (isAndroidMobile()) {
    const fallback = encodeURIComponent(webUrl);
    window.location.href =
      `intent://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` +
      `#Intent;scheme=https;package=com.google.android.youtube;` +
      `S.browser_fallback_url=${fallback};end`;
    return;
  }

  // iOS: try the YouTube app first, then fall back to the normal URL
  // if the app is not available.
  const appUrl = `youtube://watch?v=${encodeURIComponent(videoId)}`;
  window.location.href = appUrl;

  window.setTimeout(() => {
    if (!document.hidden) {
      window.location.href = webUrl;
    }
  }, 900);
}


function isExcludedVideo(v) {
  const title = String(v?.title || "").toLowerCase();

  const excludedTitlePatterns = [
    "ai 데뷔초 신혜성",
    "ai 신혜성"
  ];

  return excludedTitlePatterns.some(pattern => title.includes(pattern));
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isValidDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y &&
         dt.getUTCMonth() + 1 === m &&
         dt.getUTCDate() === d;
}

function normalizeTwoDigitYear(yy) {
  const n = Number(yy);
  // Archive context rule:
  // 00~29 => 2000~2029
  // 30~99 => 1930~1999
  return n <= 29 ? 2000 + n : 1900 + n;
}

function pushUniqueDate(list, entry) {
  if (!entry || !entry.sourceDate) return;
  const key = `${entry.sourceDate}|${entry.precision || "day"}|${entry.source || ""}`;
  if (!list.some(x =>
    `${x.sourceDate}|${x.precision || "day"}|${x.source || ""}` === key
  )) {
    list.push(entry);
  }
}

function removeHashtagsFromDescription(text="") {
  return String(text || "")
    // Remove hashtag tokens such as #1999, #2015-02-27, #신혜성
    // until whitespace or another # begins.
    .replace(/#[^\s#]+/g, " ");
}

function extractDatesFromText(text="") {
  const input = String(text || "");
  const found = [];

  const addDay = (y, m, d) => {
    y = Number(y); m = Number(m); d = Number(d);
    if (!isValidDate(y, m, d)) return;
    pushUniqueDate(found, {
      sourceDate: `${y}-${pad2(m)}-${pad2(d)}`,
      source: "",
      precision: "day",
      inferred: false
    });
  };

  const addMonth = (y, m) => {
    y = Number(y); m = Number(m);
    if (y < 1900 || y > 2099 || m < 1 || m > 12) return;
    pushUniqueDate(found, {
      sourceDate: `${y}-${pad2(m)}-01`,
      source: "",
      precision: "month",
      inferred: true
    });
  };

  const addYear = (y) => {
    y = Number(y);
    if (y < 1900 || y > 2099) return;
    pushUniqueDate(found, {
      sourceDate: `${y}-01-01`,
      source: "",
      precision: "year",
      inferred: true
    });
  };

  // 1) YYYY년 M월 D일
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)) {
    addDay(m[1], m[2], m[3]);
  }

  // 2) YYYY.MM.DD / YYYY-MM-DD / YYYY/MM/DD
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})(?!\d)/g)) {
    addDay(m[1], m[2], m[3]);
  }

  // 3) YY.MM.DD / YY-MM-DD / YY/MM/DD e.g. 08.11.08 => 2008-11-08
  for (const m of input.matchAll(/(?<!\d)(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})(?!\d)/g)) {
    addDay(normalizeTwoDigitYear(m[1]), m[2], m[3]);
  }

  // 4) YYYYMMDD
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/g)) {
    addDay(m[1], m[2], m[3]);
  }

  // 5) YYMMDD e.g. 150227, 010826, 981025
  for (const m of input.matchAll(/(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)/g)) {
    const y = normalizeTwoDigitYear(m[1]);
    addDay(y, m[2], m[3]);
  }

  // 6) YYYY년 M월
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})\s*년\s*(\d{1,2})\s*월(?!\s*\d+\s*일)/g)) {
    addMonth(m[1], m[2]);
  }

  // 7) YYYY.MM / YYYY-MM / YYYY/MM
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})[.\-/](\d{1,2})(?![.\-/]\d|\d)/g)) {
    addMonth(m[1], m[2]);
  }

  // 8) YYYY년 / YYYY년도
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})\s*년(?:도)?(?!\s*\d+\s*월)/g)) {
    addYear(m[1]);
  }

  return found;
}

function extractReviewDateCandidates(title="", description="", ignored=[]) {
  const ignoredSet = new Set((ignored || []).map(String));
  const found = [];

  const addCandidate = ({raw, sourceDate, precision, display, sourceLocation, context}) => {
    if (!raw || !sourceDate) return;
    const candidateKey = `${sourceLocation}|${raw}|${precision}`;

    // Backward compatibility: old v10 stored just the raw YYMM token.
    if (ignoredSet.has(candidateKey) || ignoredSet.has(raw)) return;

    if (found.some(x => x.candidateKey === candidateKey)) return;

    found.push({
      raw,
      candidateKey,
      sourceDate,
      precision,
      display,
      sourceLocation,
      context: String(context || "").trim()
    });
  };

  const inspectTitle = (text) => {
    const line = String(text || "").trim();
    if (!line) return;

    // TITLE: YY.MM.DD / YY-MM-DD / YY/MM/DD
    // Candidate only — title never auto-confirms a date.
    let m = line.match(/^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:$|\s+|[^\d])/);
    if (m) {
      const year = normalizeTwoDigitYear(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      if (isValidDate(year, month, day)) {
        addCandidate({
          raw: m[0].trim().replace(/[^\d./-]+$/,""),
          sourceDate: `${year}-${pad2(month)}-${pad2(day)}`,
          precision: "day",
          display: `${year}.${pad2(month)}.${pad2(day)}`,
          sourceLocation: "title",
          context: line
        });
      }
    }

    // TITLE: YYMMDD
    m = line.match(/^(\d{2})(\d{2})(\d{2})(?:$|\s+|[^\d])/);
    if (m) {
      const year = normalizeTwoDigitYear(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      if (isValidDate(year, month, day)) {
        addCandidate({
          raw: `${m[1]}${m[2]}${m[3]}`,
          sourceDate: `${year}-${pad2(month)}-${pad2(day)}`,
          precision: "day",
          display: `${year}.${pad2(month)}.${pad2(day)}`,
          sourceLocation: "title",
          context: line
        });
      }
    }

    // TITLE: explicit 4-digit year takes priority over YYMM.
    // e.g. "2007 콘텐츠 이름" => 2007년, NOT 2020.07.
    m = line.match(/^((?:19|20)\d{2})(?:$|\s+|[^\d])/);
    if (m) {
      const year = Number(m[1]);
      addCandidate({
        raw: m[1],
        sourceDate: `${year}-01-01`,
        precision: "year",
        display: `${year}년`,
        sourceLocation: "title",
        context: line
      });
      return;
    }

    // TITLE: YYMM — deliberately conservative.
    // Only at the very start and month must be 01~12.
    m = line.match(/^(\d{2})(0[1-9]|1[0-2])(?:$|\s+|[^\d])/);
    if (m) {
      const year = normalizeTwoDigitYear(m[1]);
      const month = Number(m[2]);
      addCandidate({
        raw: `${m[1]}${m[2]}`,
        sourceDate: `${year}-${pad2(month)}-01`,
        precision: "month",
        display: `${year}.${pad2(month)}`,
        sourceLocation: "title",
        context: line
      });
    }
  };

  const inspectDescription = (text) => {
    const input = removeHashtagsFromDescription(text || "");

    for (const rawLine of input.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;

      // Description YY.MM.DD is already auto-confirmed by extractDatesFromText().
      // We therefore only need conservative YYMM candidates here.
      const m = line.match(/^(\d{2})(0[1-9]|1[0-2])(?:$|\s+|[^\d])/);
      if (!m) continue;

      const year = normalizeTwoDigitYear(m[1]);
      const month = Number(m[2]);

      addCandidate({
        raw: `${m[1]}${m[2]}`,
        sourceDate: `${year}-${pad2(month)}-01`,
        precision: "month",
        display: `${year}.${pad2(month)}`,
        sourceLocation: "description",
        context: line
      });
    }
  };

  inspectTitle(title);
  inspectDescription(description);

  // Exact-day candidates are more informative than month candidates.
  const rank = { day: 2, month: 1 };
  return found.sort((a,b) => (rank[b.precision] || 0) - (rank[a.precision] || 0));
}

function candidateSourceLabel(sourceLocation="") {
  return sourceLocation === "title" ? "제목에서 발견" : "설명에서 발견";
}

function parseManualDateInput(value="") {
  const input = String(value || "").trim();

  let m = input.match(/^((?:19|20)\d{2})$/);
  if (m) {
    return {
      sourceDate: `${m[1]}-01-01`,
      precision: "year",
      display: `${m[1]}년`
    };
  }

  m = input.match(/^((?:19|20)\d{2})[.\-/](\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) {
      return {
        sourceDate: `${y}-${pad2(month)}-01`,
        precision: "month",
        display: `${y}.${pad2(month)}`
      };
    }
  }

  m = input.match(/^((?:19|20)\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (isValidDate(y, month, day)) {
      return {
        sourceDate: `${y}-${pad2(month)}-${pad2(day)}`,
        precision: "day",
        display: `${y}.${pad2(month)}.${pad2(day)}`
      };
    }
  }

  return null;
}

function parseManualDateList(value="") {
  const input = String(value || "").trim();
  if (!input) return [];

  // Multiple values: "2007, 2006" / "2007,2006"
  const parts = input.split(/\s*,\s*/).filter(Boolean);
  const parsed = parts.map(parseManualDateInput);

  if (parsed.some(x => !x)) return null;

  const deduped = [];
  const seen = new Set();
  for (const item of parsed) {
    const key = `${item.sourceDate}|${item.precision}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }
  return deduped;
}

function formatDuration(seconds=0) {
  const s = Number(seconds) || 0;
  if (!s) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h
    ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
    : `${m}:${String(sec).padStart(2,"0")}`;
}

function contentTypeLabel(value="video") {
  return value === "playlist" ? "플레이리스트" : "일반 영상";
}

function isMultiYearPlaylist(v) {
  if (!v || v.contentType !== "playlist") return false;

  // Explicit admin classification always wins.
  // This is important when a playlist still keeps historical date entries:
  // choosing "연도 미지정" must not be overridden merely because those
  // preserved dates span multiple years.
  if (v.playlistScope === "multi-year") return true;
  if (v.playlistScope === "undated") return false;

  // Only unclassified playlists fall back to automatic multi-year detection.
  return videoYears(v).length > 1;
}

function playlistScopeLabel(v) {
  if (!v || v.contentType !== "playlist") return "";
  if (isMultiYearPlaylist(v)) return "다년도 플레이리스트";
  if (v.playlistScope === "undated" || !(v.dates || []).length) return "연도 미지정";
  return "연도 지정";
}

function effectiveDateType(v) {
  return isMultiYearPlaylist(v) ? "mixed" : v.type;
}

function normalizeDateEntry(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    return {
      sourceDate: entry,
      source: "",
      precision: /^\d{4}-\d{2}-\d{2}$/.test(entry) ? "day" : "day",
      inferred: false
    };
  }
  if (typeof entry === "object") {
    return {
      sourceDate: String(entry.sourceDate || ""),
      source: String(entry.source || ""),
      precision: String(entry.precision || "day"),
      inferred: Boolean(entry.inferred),
      manual: Boolean(entry.manual)
    };
  }
  return null;
}

function mergeDateEntries(existing, extracted) {
  const merged = [];

  const add = (e) => {
    if (!e || !e.sourceDate) return;

    // If a more precise date already exists for same year/month, skip less precise one.
    const y = e.sourceDate.slice(0,4);
    const ym = e.sourceDate.slice(0,7);

    if (e.precision === "year" &&
        merged.some(x => x.sourceDate.startsWith(y) && x.precision !== "year")) {
      return;
    }

    if (e.precision === "month" &&
        merged.some(x => x.sourceDate.startsWith(ym) && x.precision === "day")) {
      return;
    }

    // Remove less precise entries if a more precise one is being added.
    if (e.precision === "day") {
      for (let i = merged.length - 1; i >= 0; i--) {
        const x = merged[i];
        if ((x.precision === "year" && x.sourceDate.startsWith(y)) ||
            (x.precision === "month" && x.sourceDate.startsWith(ym))) {
          merged.splice(i, 1);
        }
      }
    } else if (e.precision === "month") {
      for (let i = merged.length - 1; i >= 0; i--) {
        const x = merged[i];
        if (x.precision === "year" && x.sourceDate.startsWith(y)) {
          merged.splice(i, 1);
        }
      }
    }

    const key = `${e.sourceDate}|${e.precision || "day"}`;
    if (!merged.some(x => `${x.sourceDate}|${x.precision || "day"}` === key)) {
      merged.push({
        sourceDate: e.sourceDate,
        source: "",
        precision: e.precision || "day",
        inferred: Boolean(e.inferred),
        manual: Boolean(e.manual)
      });
    }
  };

  for (const e of existing || []) {
    const n = normalizeDateEntry(e);
    if (n && n.sourceDate) add(n);
  }

  for (const e of extracted || []) add(e);

  return merged;
}

function assessAutoVideoFormat({ title="", description="", durationSeconds=0, publishedAt="", currentFormat="", url="" }={}) {
  const duration = Number(durationSeconds || 0);
  const text = `${title} ${description}`.toLowerCase();
  const published = String(publishedAt || "").slice(0, 10);
  const savedUrl = String(url || "");

  if (/youtube\.com\/shorts\//i.test(savedUrl)) {
    return { format:"shorts", confidence:"high", reason:"저장된 YouTube 주소가 /shorts/ 형식" };
  }

  if (/(^|\s|#)shorts?\b/i.test(text)) {
    return { format:"shorts", confidence:"high", reason:"제목/설명에 Shorts 표기" };
  }
  if (duration > 0 && duration <= 60) {
    return { format:"shorts", confidence:"medium", reason:"재생시간 60초 이하" };
  }
  if (published >= "2024-10-15" && duration > 0 && duration <= 180) {
    return { format:"shorts", confidence:"low", reason:"2024-10-15 이후 · 3분 이하 · 화면비율 확인 필요" };
  }
  if (currentFormat === "shorts") {
    return { format:"shorts", confidence:"low", reason:"자동 Shorts 분류 · 근거 재확인 필요" };
  }
  return { format:"standard", confidence:"high", reason:"자동 기준상 일반동영상" };
}

function autoVideoFormat(input={}) {
  return assessAutoVideoFormat(input).format;
}

function normalizeVideoFormat(v) {
  if (v?.videoFormat === "shorts") return "shorts";
  if (v?.videoFormat === "standard") return "standard";
  return assessAutoVideoFormat({
    title:v?.title || "",
    description:v?.description || "",
    durationSeconds:v?.durationSeconds || 0,
    publishedAt:v?.publishedAt || "",
    url:v?.url || v?.youtubeUrl || ""
  }).format;
}

function videoFormatLabel(format) {
  return format === "shorts" ? "Shorts" : "일반 동영상";
}

function videoFormatAssessment(v) {
  if (v?.videoFormatSource === "manual") {
    return { status:"manual", label:"수동 지정", reason:"관리자가 동영상 타입을 직접 변경했습니다.", needsReview:false };
  }
  if (v?.videoFormatSource === "confirmed") {
    return { status:"confirmed", label:"확인 완료", reason:String(v?.videoFormatReason || "관리자가 자동 판별 결과를 확인했습니다."), needsReview:false };
  }
  if (v?.videoFormatSource === "youtube") {
    return { status:"youtube", label:"YouTube 확인", reason:String(v?.videoFormatReason || "YouTube 공개 페이지의 Shorts 분류값을 확인했습니다."), needsReview:false };
  }

  const savedConfidence = ["high","medium","low"].includes(v?.videoFormatConfidence)
    ? v.videoFormatConfidence : "";
  let confidence = savedConfidence;
  let reason = String(v?.videoFormatReason || "").trim();

  if (!confidence) {
    const fallback = assessAutoVideoFormat({
      title:v?.title || "",
      description:v?.description || "",
      durationSeconds:v?.durationSeconds || 0,
      publishedAt:v?.publishedAt || "",
      currentFormat:v?.videoFormat || "",
      url:v?.url || v?.youtubeUrl || ""
    });
    confidence = fallback.confidence;
    reason = fallback.reason;
  }

  if (confidence === "low") {
    return {
      status:"review",
      label:"확인 필요",
      reason:reason || "YouTube Data API 정보만으로 Shorts 여부를 확정하기 어렵습니다.",
      needsReview:true
    };
  }

  return {
    status:"auto",
    label:"자동 판별",
    reason:reason || "YouTube 메타데이터 기준으로 자동 판별했습니다.",
    needsReview:false
  };
}

function videoFormatAssessmentLabel(v) {
  return videoFormatAssessment(v).label;
}


function videoFormatIconHtml(v) {
  const isShorts = v?.videoFormat === "shorts";
  const label = isShorts ? "Shorts" : "일반 동영상";
  const icon = isShorts
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.1 3.7c1.1-1.6 3.3-2 4.9-.9l3 2.1c1.6 1.1 2 3.3.9 4.9l-1 1.4 1.1.8c1.6 1.1 2 3.3.9 4.9l-2.1 3c-1.1 1.6-3.3 2-4.9.9l-3-2.1c-1.6-1.1-2-3.3-.9-4.9l1-1.4-1.1-.8c-1.6-1.1-2-3.3-.9-4.9l2.1-3Z"/><path class="format-play" d="m10.5 8.8 4.3 3.2-4.3 3.2V8.8Z"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="3"/><path class="format-play" d="m10 9 5 3-5 3V9Z"/></svg>`;

  return `<span class="video-format-icon ${isShorts ? "is-shorts" : "is-standard"}"
    role="img" aria-label="${label}" title="${label}">${icon}</span>`;
}

function normalizeVideo(v, idx=0) {
  const existing = Array.isArray(v.dates)
    ? v.dates.map(normalizeDateEntry).filter(Boolean)
    : [];

  if (!existing.length && v.sourceDate) {
    existing.push({
      sourceDate: String(v.sourceDate),
      source: String(v.source || ""),
      precision: "day",
      inferred: false
    });
  }

  // Re-analyse ONLY the saved video description every load.
  // Title/source text must never affect date detection.
  const textToAnalyse = removeHashtagsFromDescription(v.description || "");

  const extracted = extractDatesFromText(textToAnalyse);
  const dateEntries = mergeDateEntries(existing, extracted);

  const validDates = dateEntries.map(d => d.sourceDate).filter(Boolean);
  const uniqueYears = [...new Set(validDates.map(d => d.slice(0,4)))];

  // "혼합 영상"은 서로 다른 연도가 실제로 섞인 경우에만 사용.
  // 같은 연도 안에서 날짜가 여러 개여도 해당 연도의 일반 영상으로 유지한다.
  let type = "unknown";
  if (uniqueYears.length > 1) type = "mixed";
  else if (uniqueYears.length === 1) type = "single";

  const sortDate = validDates.length
    ? [...validDates].sort().reverse()[0]
    : "";

  return {
    id: String(v.id || `video-${idx}`),
    title: String(v.title || "제목 없음"),
    description: String(v.description || ""),
    source: String(v.source || ""),
    sourceDate: v.sourceDate ? String(v.sourceDate) : "",
    publishedAt: v.publishedAt ? String(v.publishedAt) : "",
    thumbnail: String(v.thumbnail || ""),
    parseStatus: validDates.length ? "parsed" : String(v.parseStatus || ""),
    dates: dateEntries,
    manualDateReviewPending: v.manualDateReviewPending === true,
    previousManualDates: Array.isArray(v.previousManualDates)
      ? v.previousManualDates.map(normalizeDateEntry).filter(Boolean)
      : [],
    descriptionChangedAfterManual: v.descriptionChangedAfterManual === true,
    ignoredDateCandidates: Array.isArray(v.ignoredDateCandidates) ? v.ignoredDateCandidates.map(String) : [],
    contentType: v.contentType === "playlist" ? "playlist" : "video",
    playlistScope: v.playlistScope === "multi-year" ? "multi-year"
      : v.playlistScope === "undated" ? "undated"
      : "",
    durationSeconds: Number(v.durationSeconds || 0),
    duration: String(v.duration || ""),
    videoFormat: normalizeVideoFormat(v),
    videoFormatSource: ["manual", "confirmed", "youtube"].includes(v.videoFormatSource) ? v.videoFormatSource : "auto",
    videoFormatConfidence: ["high", "medium", "low"].includes(v.videoFormatConfidence)
      ? v.videoFormatConfidence
      : "",
    videoFormatReason: String(v.videoFormatReason || ""),
    dateCandidates: validDates.length ? [] : extractReviewDateCandidates(
      v.title || "",
      v.description || "",
      v.ignoredDateCandidates || []
    ),
    type,
    sortDate,
    url: String(v.url || v.youtubeUrl || "").trim() || youtubeUrlFromId(v.id)
  };
}

async function loadInitialData() {
  const res = await fetch("./data/videos.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`videos.json 로드 실패: ${res.status}`);

  const raw = await res.json();
  const list = Array.isArray(raw) ? raw : raw.videos;

  if (!Array.isArray(list)) {
    throw new Error("videos.json에서 videos 배열을 찾을 수 없습니다.");
  }

  videos = list
    .filter(v => !isExcludedVideo(v))
    .map(normalizeVideo);
}

async function loadSiteConfig() {
  try {
    const res = await fetch("./site-config.json", { cache: "no-store" });
    if (!res.ok) return;
    const cfg = await res.json();
    siteConfig = { ...siteConfig, ...cfg };
  } catch (err) {
    console.warn("site-config.json 로드 실패", err);
  }
}

async function loadLiveChannelBranding() {
  const base = String(siteConfig.adminApiUrl || "").replace(/\/$/, "");
  if (!base) return;

  try {
    const res = await fetch(`${base}/channel-branding`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.ok) return;

    // YouTube channels.list의 snippet.thumbnails.high URL을 그대로 사용.
    if (data.profileImageUrl) siteConfig.profileImageUrl = data.profileImageUrl;
    if (data.bannerImageUrl) siteConfig.bannerImageUrl = data.bannerImageUrl;
    if (data.channelTitle) siteConfig.channelTitle = data.channelTitle;
    if (data.channelHandle) siteConfig.channelHandle = data.channelHandle;

    applySiteConfig();
  } catch (err) {
    console.warn("YouTube 채널 브랜딩 실시간 로드 실패", err);
  }
}

function applySiteConfig() {
  const title = siteConfig.title || DEFAULT_TITLE;
  const mainTitle = $("#mainTitle");
  if (mainTitle) mainTitle.textContent = title;
  document.title = `${title} | 필새 영상 아카이브`;
  document.body.classList.remove("site-config-pending");

  const titleInput = $("#titleInput");
  if (titleInput) titleInput.value = title;

  const handle = siteConfig.channelHandle || "@pilsae";
  const handleInput = $("#channelHandleInput");
  if (handleInput) handleInput.value = handle;

  const adminHandle = $("#adminChannelHandle");
  if (adminHandle) adminHandle.textContent = handle;

  const brandHandle = document.querySelector(".brand-handle");
  if (brandHandle) brandHandle.textContent = handle;

  const heroHandle = $("#heroHandle");
  if (heroHandle) heroHandle.textContent = handle;

  const channelLink = document.querySelector(".channel-link");
  if (channelLink) {
    const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;
    channelLink.href = `https://www.youtube.com/${cleanHandle}`;
  }

  const favicon = $("#dynamicFavicon");
  const faviconHref = siteConfig.faviconDataUrl || siteConfig.faviconUrl || "data:,";
  if (favicon) favicon.href = faviconHref;

  const heroBanner = $("#heroBannerImage");
  if (heroBanner) {
    const bannerUrl = String(siteConfig.bannerImageUrl || "").trim();
    if (bannerUrl) {
      heroBanner.style.backgroundImage = `url("${bannerUrl.replace(/"/g, "%22")}")`;
      heroBanner.classList.add("has-image");
    } else {
      heroBanner.style.backgroundImage = "";
      heroBanner.classList.remove("has-image");
    }
  }

  const heroAvatar = $("#heroAvatar");
  if (heroAvatar) {
    const profileUrl = String(siteConfig.profileImageUrl || "").trim();
    heroAvatar.innerHTML = profileUrl
      ? `<img src="${escapeHTML(profileUrl)}" alt="${escapeHTML(handle)} 프로필 이미지" loading="lazy" />`
      : `<span class="hero-avatar-fallback">P</span>`;
  }

  renderFaviconPreview(siteConfig.faviconDataUrl || siteConfig.faviconUrl || "");
}

function renderFaviconPreview(dataUrl) {
  const box = $("#faviconPreview");
  if (!box) return;
  box.innerHTML = dataUrl
    ? `<img src="${escapeHTML(dataUrl)}" alt="파비콘 미리보기" />`
    : "P";
}

function getAdminToken() {
  const inputValue = $("#adminTokenInput")?.value?.trim() || "";
  return inputValue || sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || "";
}

function setAdminAuthenticated(authenticated) {
  if (!document.body.classList.contains("admin-page")) return;

  document.body.classList.toggle("admin-locked", !authenticated);
  document.body.classList.toggle("admin-authenticated", authenticated);

  const authCard = document.querySelector(".admin-auth-card");
  const logoutBtn = $("#adminLogoutBtn");

  if (authCard) authCard.hidden = authenticated;
  if (logoutBtn) logoutBtn.hidden = !authenticated;
}

async function verifyAdminToken({ silent=false }={}) {
  if (!document.body.classList.contains("admin-page")) return false;

  const token = $("#adminTokenInput")?.value?.trim()
    || sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY)
    || "";

  if (!token) {
    setAdminAuthenticated(false);
    return false;
  }

  const status = $("#adminApiStatus");
  if (!silent) setAdminStatus(status, "관리자 인증을 확인하는 중입니다…", "loading");

  try {
    if ($("#adminTokenInput")) $("#adminTokenInput").value = token;
    const data = await adminApi("/admin-auth", { method:"GET" });

    if (!data?.authenticated) throw new Error("관리자 인증에 실패했습니다.");

    sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, token);
    setAdminAuthenticated(true);
    setAdminStatus(status, "", "");
    return true;
  } catch (err) {
    sessionStorage.removeItem(ADMIN_TOKEN_SESSION_KEY);
    setAdminAuthenticated(false);
    if ($("#adminTokenInput")) $("#adminTokenInput").value = "";
    if (!silent) setAdminStatus(status, err.message, "error");
    return false;
  }
}

function setAdminStatus(el, message, type="") {
  if (!el) return;
  el.className = `admin-status ${type}`.trim();
  el.textContent = message || "";
}

async function adminApi(path, options={}) {
  const base = String(siteConfig.adminApiUrl || "").replace(/\/$/, "");
  if (!base) throw new Error("site-config.json의 adminApiUrl이 비어 있습니다.");

  const token = getAdminToken();
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("관리자 인증에 실패했습니다. 입력한 ADMIN_TOKEN과 Cloudflare Worker의 ADMIN_TOKEN이 같은지 확인해 주세요.");
    }
    throw new Error(data.error || `API 오류 (${res.status})`);
  }
  return data;
}

function formatAdminDateTime(value) {
  if (!value) return "기록 없음";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit"
  }).format(dt);
}

function adminReviewQueueVideos() {
  return videos.filter(v =>
    v.contentType !== "playlist" &&
    (v.type === "unknown" || v.manualDateReviewPending || v.descriptionChangedAfterManual)
  );
}

function adminHealthIssues() {
  const issues = [];
  const idCounts = new Map();

  videos.forEach(v => {
    const id = String(v.id || "");
    if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  });

  idCounts.forEach((count, id) => {
    if (count > 1) {
      issues.push({ type:"중복 ID", severity:"high", title:id, detail:`같은 YouTube ID가 ${count}번 존재합니다.` });
    }
  });

  const currentYear = new Date().getFullYear();

  videos.forEach(v => {
    const title = v.title || v.id || "제목 없음";

    if (!String(v.thumbnail || "").trim()) {
      issues.push({ type:"썸네일 없음", severity:"medium", videoId:v.id, title, detail:"썸네일 URL이 비어 있습니다." });
    }

    if (!String(v.source || "").trim()) {
      issues.push({ type:"출처 없음", severity:"low", videoId:v.id, title, detail:"출처 정보가 없습니다." });
    }

    if (v.contentType !== "playlist" && (v.type === "unknown" || !(v.dates || []).some(d => d?.sourceDate))) {
      issues.push({ type:"날짜 미확인", severity:"medium", videoId:v.id, title, detail:"일반 영상의 날짜가 확인되지 않았습니다." });
    }

    if (v.manualDateReviewPending || v.descriptionChangedAfterManual) {
      if (v.contentType === "playlist") {
        const hasConfirmedPlaylistScope =
          v.playlistScope === "multi-year" ||
          v.playlistScope === "undated";

        // Once an administrator explicitly confirms the playlist scope,
        // its old manual-date review state is no longer actionable.
        // Keep the underlying history, but remove it from dashboard health.
        if (!hasConfirmedPlaylistScope) {
          issues.push({
            type:"플레이리스트 설명 변경 확인",
            severity:"high",
            videoId:v.id,
            title,
            detail:"플레이리스트의 수동 날짜 지정 이후 설명이 변경되었습니다."
          });
        }
      } else {
        issues.push({
          type:"설명 변경 재검토",
          severity:"high",
          videoId:v.id,
          title,
          detail:"수동 날짜 지정 후 설명이 변경되어 재검토가 필요합니다."
        });
      }
    }

    for (const d of (v.dates || [])) {
      const raw = String(d?.sourceDate || "");
      const year = Number(raw.slice(0,4));
      if (raw && (!/^(19|20)\d{2}-\d{2}-\d{2}$/.test(raw) || year > currentYear + 1)) {
        issues.push({ type:"날짜 형식 확인", severity:"high", videoId:v.id, title, detail:`확인이 필요한 날짜: ${raw}` });
        break;
      }
    }

    if (v.contentType === "playlist" && !isMultiYearPlaylist(v) && v.playlistScope !== "undated" && v.type === "unknown") {
      issues.push({ type:"플레이리스트 분류 확인", severity:"low", videoId:v.id, title, detail:"다년도 또는 연도 미지정 분류를 확인해 주세요." });
    }
  });

  return issues;
}

function adminHealthRoute(issue) {
  const type = String(issue?.type || "");
  if (type === "날짜 미확인" || type === "설명 변경 재검토") return "review";
  if (type === "플레이리스트 분류 확인" || type === "플레이리스트 설명 변경 확인") return "content";
  return "";
}

function renderAdminDashboard() {
  if (!$("#dashTotal")) return;

  const total = videos.length;
  const reviewQueue = adminReviewQueueVideos();
  const review = reviewQueue.length;
  const descriptionReview = reviewQueue.filter(v =>
    v.manualDateReviewPending || v.descriptionChangedAfterManual
  ).length;
  const playlists = videos.filter(v => v.contentType === "playlist").length;
  const unknown = reviewQueue.filter(v =>
    v.type === "unknown" &&
    !(v.manualDateReviewPending || v.descriptionChangedAfterManual)
  ).length;

  $("#dashTotal").textContent = `${total}개`;
  $("#dashReview").textContent = `${review}개`;
  $("#dashDescription").textContent = `${descriptionReview}개`;
  $("#dashPlaylists").textContent = `${playlists}개`;
  $("#dashUnknown").textContent = `${unknown}개`;
  $("#dashLastSync").textContent = formatAdminDateTime(siteConfig.syncedFromYoutubeAt);

  const issues = adminHealthIssues();
  const badge = $("#adminHealthBadge");
  const summary = $("#adminHealthSummary");
  const list = $("#adminHealthList");

  if (badge) badge.textContent = `${issues.length}건`;

  if (summary) {
    const counts = new Map();
    issues.forEach(issue => counts.set(issue.type, (counts.get(issue.type) || 0) + 1));
    summary.innerHTML = issues.length
      ? `<button type="button" class="admin-health-chip ${adminHealthFilter === "all" ? "active" : ""}" data-health-filter="all">전체 <b>${issues.length}</b></button>` +
        [...counts.entries()].map(([type,count]) =>
          `<button type="button" class="admin-health-chip ${adminHealthFilter === type ? "active" : ""}" data-health-filter="${escapeHTML(type)}">${escapeHTML(type)} <b>${count}</b></button>`
        ).join("")
      : `<span class="admin-health-ok">✓ 현재 자동 점검에서 이상 항목이 없습니다.</span>`;
  }

  if (list) {
    const visibleIssues = adminHealthFilter === "all"
      ? issues
      : issues.filter(issue => issue.type === adminHealthFilter);

    list.innerHTML = visibleIssues.length
      ? visibleIssues.slice(0, 40).map(issue => {
          const route = adminHealthRoute(issue);
          return `
            <div class="admin-health-item severity-${escapeHTML(issue.severity)}">
              <span class="admin-health-type">${escapeHTML(issue.type)}</span>
              <div><strong>${escapeHTML(issue.title)}</strong><small>${escapeHTML(issue.detail)}</small></div>
              ${route ? `<button type="button" class="admin-health-go"
                data-health-route="${escapeHTML(route)}"
                data-health-video-id="${escapeHTML(issue.videoId || "")}"
                data-health-type="${escapeHTML(issue.type)}">바로 확인</button>` : ""}
            </div>
          `;
        }).join("") +
        (visibleIssues.length > 40 ? `<p class="admin-help">총 ${visibleIssues.length}건 중 앞 40건만 표시합니다.</p>` : "")
      : issues.length
        ? `<p class="admin-help">선택한 유형의 이상 항목이 없습니다.</p>`
        : "";
  }
}

function updateAdminSummary() {
  const total = videos.length;
  const review = adminReviewQueueVideos().length;
  const parsed = total - review;

  if ($("#adminCurrentTotal")) $("#adminCurrentTotal").textContent = `${total}개`;
  if ($("#adminParsedTotal")) $("#adminParsedTotal").textContent = `${parsed}개`;
  if ($("#adminReviewTotal")) $("#adminReviewTotal").textContent = `${review}개`;

  renderAdminDashboard();
}

function allYears() {
  const years = new Set();
  videos.forEach(v => v.dates.forEach(d => {
    const m = String(d.sourceDate || "").match(/\b(19|20)\d{2}\b/);
    if (m) years.add(m[0]);
  }));
  return [...years].sort((a,b) => Number(b) - Number(a));
}

function currentPublicFilterState() {
  return {
    q:($("#searchInput")?.value || "").trim().toLowerCase(),
    year:$("#yearFilter")?.value || "",
    type:$("#typeFilter")?.value || "",
    contentType:$("#contentTypeFilter")?.value || "",
    videoFormat:$("#videoFormatFilter")?.value || "",
    sortMode:$("#sortFilter")?.value || "source-desc"
  };
}

function publicSearchHaystack(v) {
  const searchableDates = (v.dates || []).flatMap(d => [
    d.sourceDate,
    d.source,
    displayDate(d)
  ]);

  return [
    v.title,
    v.description,
    v.source,
    v.parseStatus,
    contentTypeLabel(v.contentType),
    videoFormatLabel(v.videoFormat),
    isMultiYearPlaylist(v) ? "다년도 플레이리스트 혼합 연도" : "",
    ...searchableDates
  ].join(" ").toLowerCase();
}

function videoMatchesPublicFilters(v, state=currentPublicFilterState(), {ignoreYear=false}={}) {
  const qok = !state.q || publicSearchHaystack(v).includes(state.q);
  const yok = ignoreYear || !state.year ||
    (v.dates || []).some(d => String(d.sourceDate || "").startsWith(state.year));
  const tok = !state.type || effectiveDateType(v) === state.type;
  const cok = !state.contentType || v.contentType === state.contentType;
  const fok = !state.videoFormat || v.videoFormat === state.videoFormat;

  return qok && yok && tok && cok && fok;
}

function contextualYearRows() {
  const state = currentPublicFilterState();
  return videos.filter(v => videoMatchesPublicFilters(v, state, {ignoreYear:true}));
}

function yearVideoCounts(rows=contextualYearRows()) {
  const counts = new Map();

  rows.forEach(v => {
    const years = new Set(
      (v.dates || [])
        .map(d => String(d.sourceDate || "").slice(0,4))
        .filter(y => /^(19|20)\d{2}$/.test(y))
    );

    years.forEach(y => counts.set(y, (counts.get(y) || 0) + 1));
  });

  return counts;
}


function rebuildYearFilter() {
  const select = $("#yearFilter");
  if (!select) return;

  const current = select.value;
  const rows = contextualYearRows();
  const counts = yearVideoCounts(rows);

  // Keep every archive year available, but make each count reflect the
  // currently active non-year filters (e.g. Shorts, content/date type, search).
  const years = allYears();

  select.innerHTML = `<option value="">전체 연도 (${rows.length})</option>` +
    years.map(y => `<option value="${y}">${y} (${counts.get(y) || 0})</option>`).join("");

  if ([...select.options].some(o => o.value === current)) {
    select.value = current;
  }
}


function typeLabel(type, v=null) {
  if (v && isMultiYearPlaylist(v)) return "다년도";
  return type === "mixed" ? "혼합 영상"
       : type === "unknown" ? "날짜 확인 필요"
       : "단일 날짜";
}

function displayDate(d) {
  const raw = String(d.sourceDate || "");
  if (d.precision === "year") {
    return `${raw.slice(0,4)}년`;
  }
  if (d.precision === "month") {
    const [y, m] = raw.split("-");
    return `${y}.${m}`;
  }
  return raw;
}

function shortDisplayDate(d, includeYear=true) {
  const raw = String(d.sourceDate || "");
  if (d.precision === "year") return `${raw.slice(0,4)}년`;
  if (d.precision === "month") {
    const [y,m] = raw.split("-");
    return includeYear ? `${y}.${m}` : `${m}월`;
  }
  const [y,m,day] = raw.split("-");
  return includeYear ? `${y}.${m}.${day}` : `${m}.${day}`;
}

function videoYears(v) {
  return [...new Set(
    v.dates.map(d => String(d.sourceDate || "").slice(0,4))
      .filter(y => /^(19|20)\d{2}$/.test(y))
  )].sort((a,b) => Number(b)-Number(a));
}

function renderDates(v) {
  const valid = v.dates
    .filter(d => d.sourceDate)
    .sort((a,b) => b.sourceDate.localeCompare(a.sourceDate));

  if (!valid.length) {
    if (isMultiYearPlaylist(v)) {
      return `<span class="date-chip multiyear-date-chip">여러 연도 수록</span>`;
    }
    if (v.contentType === "playlist" && v.playlistScope === "undated") {
      return `<span class="date-chip playlist-undated-chip">연도 미지정</span>`;
    }
    return `<span class="date-chip unknown-date-chip">날짜 미확인</span>`;
  }

  const years = videoYears(v);
  const dateLimit = 3;
  const key = escapeHTML(v.id);

  const summary = v.type === "mixed"
    ? `<span class="year-summary-chip">${years.slice(0,6).map(escapeHTML).join(" · ")}${years.length > 6 ? ` · +${years.length - 6}` : ""}</span>`
    : "";

  let prevYear = "";
  const dateHtml = valid.map((d) => {
    const year = d.sourceDate.slice(0,4);
    const includeYear = v.type === "mixed" || year !== prevYear;
    prevYear = year;
    const label = shortDisplayDate(d, includeYear);
    return `<button class="date-chip date-context-link" type="button"
      data-context-date="${escapeHTML(displayDate(d))}"
      title="같은 날짜 영상 보기">${escapeHTML(label)}</button>`;
  });

  const visible = dateHtml.slice(0, dateLimit);
  const hidden = dateHtml.slice(dateLimit);

  const mobileFallbackSummary = !summary && hidden.length
    ? `<span class="mobile-date-summary-chip">${escapeHTML(years[0] ? `${years[0]}년 · 날짜 ${valid.length}개` : `날짜 ${valid.length}개`)}</span>`
    : "";

  const summaryRow = (summary || hidden.length)
    ? `<span class="date-summary-row">
        ${summary}
        ${mobileFallbackSummary}
        ${hidden.length ? `
          <button class="date-mobile-toggle" type="button"
            data-date-toggle="${key}"
            data-more-count="${hidden.length}"
            aria-expanded="false"
            aria-label="날짜 ${hidden.length}개 더보기">+${hidden.length}</button>
        ` : ""}
      </span>`
    : "";

  return summaryRow +
    `<span class="date-chip-grid">
      ${visible.join("")}
      ${hidden.map(html => `<span class="date-extra" data-date-group="${key}" hidden>${html}</span>`).join("")}
    </span>` +
    (hidden.length
      ? `<button class="date-more-btn date-more-desktop" type="button"
          data-date-toggle="${key}"
          data-more-count="${hidden.length}"
          aria-expanded="false">날짜 ${hidden.length}개 더보기</button>`
      : "");
}

function unknownReason(v) {
  if (v.manualDateReviewPending) return "수동 날짜 이후 설명 변경";
  if (v.type !== "unknown") return "";
  if (Array.isArray(v.dateCandidates) && v.dateCandidates.length) return "월 날짜 후보 있음";
  const raw = String(v.description || "");
  if (!raw.trim()) return "영상 설명 없음";

  const hashtagRemoved = removeHashtagsFromDescription(raw);
  const hashtagDateLike = /#(?:19|20)\d{2}(?:[-./]?\d{1,2})?(?:[-./]?\d{1,2})?\b|#\d{6,8}\b/.test(raw);
  if (hashtagDateLike && !extractDatesFromText(hashtagRemoved).length) {
    return "해시태그에만 날짜 표기가 있음";
  }

  const dateLike = /(?:19|20)\d{2}|\b\d{6,8}\b|\d{2,4}[-./]\d{1,2}/.test(hashtagRemoved);
  if (dateLike) return "날짜처럼 보이는 표기 확인 필요";
  return "설명에서 날짜 정보 찾지 못함";
}

function descriptionPreview(text, max=190) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "설명 없음";
  return clean.length > max ? clean.slice(0, max).trim() + "…" : clean;
}

function escapeRegExp(value="") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text, query) {
  const raw = String(text || "");
  const q = String(query || "").trim();
  if (!q) return escapeHTML(raw);

  const regex = new RegExp(`(${escapeRegExp(q)})`, "ig");
  return raw.split(regex).map((part, idx) =>
    idx % 2 === 1
      ? `<mark>${escapeHTML(part)}</mark>`
      : escapeHTML(part)
  ).join("");
}

function searchMatchReason(v, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return "";

  if (String(v.title || "").toLowerCase().includes(q)) return "제목 일치";

  const dateText = (v.dates || []).map(displayDate).join(" · ").toLowerCase();
  if (dateText.includes(q)) return "날짜 일치";

  if (String(v.source || "").toLowerCase().includes(q)) return "출처 일치";
  if (String(v.description || "").toLowerCase().includes(q)) return "설명 일치";

  return "";
}

function searchContextSnippet(v, query) {
  const q = String(query || "").trim();
  if (!q) return "";

  const candidates = [
    { label: "설명", text: v.description || "", radius: 110, className: "description-search-match" },
    { label: "출처", text: v.source || "", radius: 52, className: "" }
  ];

  const qLower = q.toLowerCase();
  for (const candidate of candidates) {
    const normalized = String(candidate.text || "").replace(/\s+/g, " ").trim();
    const idx = normalized.toLowerCase().indexOf(qLower);
    if (idx === -1) continue;

    const radius = candidate.radius || 52;
    const start = Math.max(0, idx - radius);
    const end = Math.min(normalized.length, idx + q.length + radius);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < normalized.length ? "…" : "";
    const snippet = normalized.slice(start, end);
    const extraClass = candidate.className ? ` ${candidate.className}` : "";
    return `<p class="search-match${extraClass}"><span>${candidate.label}</span>${prefix}${highlightMatch(snippet, q)}${suffix}</p>`;
  }

  const dateText = (v.dates || []).map(displayDate).join(" · ");
  if (dateText.toLowerCase().includes(qLower)) {
    return `<p class="search-match"><span>날짜</span>${highlightMatch(dateText, q)}</p>`;
  }

  return "";
}

function searchSuggestionItems(query) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) return [];

  const items = [];
  const seen = new Set();

  const add = (kind, label, value, meta="") => {
    const key = `${kind}|${value}`.toLowerCase();
    if (!value || seen.has(key)) return;
    seen.add(key);
    items.push({ kind, label, value, meta });
  };

  for (const v of videos) {
    if (items.length >= 12) break;

    if (String(v.title || "").toLowerCase().includes(q)) {
      add("제목", v.title, v.title, v.source || "");
    }

    if (v.source && String(v.source).toLowerCase().includes(q)) {
      add("출처", v.source, v.source, v.title || "");
    }

    for (const d of (v.dates || [])) {
      const dateLabel = displayDate(d);
      const raw = String(d.sourceDate || "");
      if (dateLabel.toLowerCase().includes(q) || raw.toLowerCase().includes(q)) {
        add("날짜", dateLabel, dateLabel, v.title || "");
      }
      if (items.length >= 12) break;
    }
  }

  // Prefer title matches, then date, then source.
  const rank = { "제목": 0, "날짜": 1, "출처": 2 };
  return items
    .sort((a,b) => (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9))
    .slice(0, 12);
}

function renderSearchSuggestions() {
  const input = $("#searchInput");
  const wrap = $("#searchSuggestions");
  if (!input || !wrap) return;

  const q = input.value.trim();
  const items = searchSuggestionItems(q);

  if (!items.length) {
    wrap.hidden = true;
    wrap.innerHTML = "";
    wrap.classList.remove("is-expanded");
    input.setAttribute("aria-expanded", "false");
    mobileSuggestionExpanded = false;
    return;
  }

  const isMobile = window.matchMedia("(max-width: 620px)").matches;
  const visibleItems = isMobile && !mobileSuggestionExpanded
    ? items.slice(0, 3)
    : items;
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  wrap.innerHTML = `
    <div class="search-suggestion-list">
      ${visibleItems.map((item, index) => `
        <button type="button" class="search-suggestion-item" role="option"
          data-search-suggestion="${escapeHTML(item.value)}" data-suggestion-index="${index}">
          <span class="search-suggestion-kind">${escapeHTML(item.kind)}</span>
          <span class="search-suggestion-copy">
            <strong>${highlightMatch(item.label, q)}</strong>
            ${item.meta ? `<small>${escapeHTML(item.meta)}</small>` : ""}
          </span>
        </button>
      `).join("")}
    </div>
    ${isMobile && items.length > 3 ? `
      <button type="button" class="search-suggestion-more" data-search-suggestion-more>
        ${mobileSuggestionExpanded ? "접기" : `${hiddenCount}개 더보기`}
      </button>
    ` : ""}
  `;

  wrap.hidden = false;
  wrap.classList.toggle("is-expanded", isMobile && mobileSuggestionExpanded);
  input.setAttribute("aria-expanded", "true");
}

function hideSearchSuggestions() {
  const wrap = $("#searchSuggestions");
  const input = $("#searchInput");
  mobileSuggestionExpanded = false;
  if (wrap) {
    wrap.hidden = true;
    wrap.classList.remove("is-expanded");
    wrap.querySelectorAll(".search-suggestion-item.is-active").forEach(el => el.classList.remove("is-active"));
  }
  if (input) input.setAttribute("aria-expanded", "false");
}

function updateSearchClearButton() {
  const btn = $("#clearSearchBtn");
  const input = $("#searchInput");
  if (!btn || !input) return;
  btn.hidden = !input.value.trim();
}

function moveSearchSuggestion(direction) {
  const wrap = $("#searchSuggestions");
  if (!wrap || wrap.hidden) return false;

  const items = [...wrap.querySelectorAll(".search-suggestion-item")];
  if (!items.length) return false;

  let index = items.findIndex(el => el.classList.contains("is-active"));
  index = index < 0
    ? (direction > 0 ? 0 : items.length - 1)
    : (index + direction + items.length) % items.length;

  items.forEach(el => el.classList.remove("is-active"));
  items[index].classList.add("is-active");
  items[index].scrollIntoView({ block:"nearest" });
  return true;
}

function applyActiveSearchSuggestion() {
  const active = $("#searchSuggestions")?.querySelector(".search-suggestion-item.is-active");
  if (!active) return false;

  $("#searchInput").value = active.dataset.searchSuggestion || "";
  updateSearchClearButton();
  visibleLimit = PAGE_SIZE;
  hideSearchSuggestions();
  syncUrlState({ replace:true });
  render();
  return true;
}

function resetPublicFilters() {
  $("#searchInput").value = "";
  $("#yearFilter").value = "";
  $("#typeFilter").value = "";
  $("#contentTypeFilter").value = "";
  $("#videoFormatFilter").value = "";
  $("#sortFilter").value = "source-desc";
  hideSearchSuggestions();
  updateSearchClearButton();
  visibleLimit = PAGE_SIZE;
  syncUrlState();
  render();

  // Individual filter/search changes keep the current scroll position.
  // Only a full reset returns the user to the top of the archive.
  window.scrollTo({ top: 0, behavior: "smooth" });

  const toolbarPanel = document.querySelector(".toolbar-panel");
  const mobileFilterToggle = $("#mobileFilterToggle");
  if (window.matchMedia("(max-width: 620px)").matches && toolbarPanel && mobileFilterToggle) {
    toolbarPanel.classList.remove("mobile-open");
    mobileFilterToggle.setAttribute("aria-expanded", "false");
  }
}

function renderCard(v) {
  const thumb = v.thumbnail
    ? `<img src="${escapeHTML(v.thumbnail)}" alt="" loading="lazy" />`
    : `<div class="thumb-placeholder">썸네일 없음</div>`;
  const q = $("#searchInput")?.value?.trim() || "";

  let statusBadge = "";
  if (v.contentType === "playlist") {
    const scope = isMultiYearPlaylist(v)
      ? "다년도"
      : (v.playlistScope === "undated" ? "연도 미지정" : "");
    statusBadge = `<span class="badge playlist">${scope ? `플레이리스트 · ${scope}` : "플레이리스트"}</span>`;
  } else if (effectiveDateType(v) === "mixed") {
    statusBadge = `<span class="badge mixed">혼합 연도</span>`;
  } else if (effectiveDateType(v) === "unknown") {
    statusBadge = `<span class="badge unknown">날짜 미확인</span>`;
  }

  return `
    <article class="video-card">
      <a class="thumb youtube-video-link" data-video-id="${escapeHTML(v.id)}" href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">
        ${thumb}
        ${statusBadge ? `<span class="thumb-status-badges">${statusBadge}</span>` : ""}
        ${videoFormatIconHtml(v)}
      </a>
      <div class="card-body">
        <div class="card-meta-row">
          <div class="dates ${(v.dates || []).filter(d => d.sourceDate).length > 1 ? "multi-date-grid" : ""}">${renderDates(v)}</div>
        </div>

        <h2 class="card-title"><a class="youtube-video-link" data-video-id="${escapeHTML(v.id)}" href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">${highlightMatch(v.title, q)}</a></h2>

        ${q && searchMatchReason(v, q) ? `<div class="search-match-reason">${escapeHTML(searchMatchReason(v, q))}</div>` : ""}
        ${searchContextSnippet(v, q)}
        ${v.source ? `<p class="source">출처 · <button type="button" class="source-context-link"
          data-context-source="${escapeHTML(v.source)}" title="같은 출처 영상 보기">${highlightMatch(v.source, q)}</button></p>` : ""}
        ${v.type === "unknown" && !isMultiYearPlaylist(v)
          ? `<p class="note">${escapeHTML(unknownReason(v))}</p>`
          : ""}

        <a class="card-link youtube-video-link" data-video-id="${escapeHTML(v.id)}" href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">
          YouTube에서 보기
        </a>
      </div>
    </article>
  `;
}

function searchRelevance(v, rawQuery) {
  const q = String(rawQuery || "").trim().toLowerCase();
  if (!q) return 0;

  const title = String(v.title || "").trim().toLowerCase();
  const source = String(v.source || "").trim().toLowerCase();
  const description = String(v.description || "").trim().toLowerCase();
  const dateValues = (v.dates || []).flatMap(d => [
    String(d.sourceDate || "").trim().toLowerCase(),
    String(displayDate(d) || "").trim().toLowerCase()
  ]).filter(Boolean);

  // Lower score = more relevant.
  if (title === q) return 0;
  if (title.startsWith(q)) return 1;
  if (title.includes(q)) return 2;
  if (dateValues.some(value => value === q)) return 3;
  if (dateValues.some(value => value.includes(q))) return 4;
  if (source === q) return 5;
  if (source.startsWith(q)) return 6;
  if (source.includes(q)) return 7;
  if (description.includes(q)) return 8;
  return 9;
}

function sortRowsByMode(rows, sortMode) {
  const sourceCompare = (a,b) => {
    const ad = a.sortDate || "";
    const bd = b.sortDate || "";
    if (!ad && !bd) return 0;
    if (!ad) return 1;
    if (!bd) return -1;
    return bd.localeCompare(ad);
  };

  const compareBySelectedSort = (a,b) => {
    if (sortMode === "source-asc") {
      const c = sourceCompare(a,b);
      return c === 0 ? String(a.publishedAt || "").localeCompare(String(b.publishedAt || "")) : -c;
    }
    if (sortMode === "upload-desc") {
      return String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
    }
    if (sortMode === "upload-asc") {
      return String(a.publishedAt || "").localeCompare(String(b.publishedAt || ""));
    }
    if (sortMode === "title-asc") {
      return String(a.title || "").localeCompare(String(b.title || ""), "ko");
    }

    const c = sourceCompare(a,b);
    return c || String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
  };

  return compareBySelectedSort;
}

function filteredVideos() {
  const state = currentPublicFilterState();
  const rows = videos.filter(v => videoMatchesPublicFilters(v, state));
  const compareBySelectedSort = sortRowsByMode(rows, state.sortMode);

  rows.sort((a,b) => {
    if (state.q) {
      const relevanceDiff = searchRelevance(a, state.q) - searchRelevance(b, state.q);
      if (relevanceDiff !== 0) return relevanceDiff;
    }
    return compareBySelectedSort(a,b);
  });

  return rows;
}

function readUrlState() {
  const params = new URLSearchParams(location.search);
  return {
    q: params.get("q") || "",
    year: params.get("year") || "",
    type: params.get("type") || "",
    content: params.get("content") || "",
    format: params.get("format") || "",
    sort: params.get("sort") || "source-desc",
    view: params.get("view") || ""
  };
}

function applyUrlStateToControls() {
  const state = readUrlState();
  if ($("#searchInput")) $("#searchInput").value = state.q;
  if ($("#yearFilter") && [...$("#yearFilter").options].some(o => o.value === state.year)) {
    $("#yearFilter").value = state.year;
  }
  if ($("#typeFilter") && [...$("#typeFilter").options].some(o => o.value === state.type)) {
    $("#typeFilter").value = state.type;
  }
  if ($("#contentTypeFilter") && [...$("#contentTypeFilter").options].some(o => o.value === state.content)) {
    $("#contentTypeFilter").value = state.content;
  }
  if ($("#videoFormatFilter") && [...$("#videoFormatFilter").options].some(o => o.value === state.format)) {
    $("#videoFormatFilter").value = state.format;
  }
  if ($("#sortFilter") && [...$("#sortFilter").options].some(o => o.value === state.sort)) {
    $("#sortFilter").value = state.sort;
  }
}

function syncUrlState({ replace=false, viewOverride="" }={}) {
  const params = new URLSearchParams();
  const q = $("#searchInput")?.value?.trim() || "";
  const year = $("#yearFilter")?.value || "";
  const type = $("#typeFilter")?.value || "";
  const content = $("#contentTypeFilter")?.value || "";
  const format = $("#videoFormatFilter")?.value || "";
  const sort = $("#sortFilter")?.value || "source-desc";
  const view = ["grid", "list", "timeline"].includes(viewOverride)
    ? viewOverride
    : currentView();

  if (q) params.set("q", q);
  if (year) params.set("year", year);
  if (type) params.set("type", type);
  if (content) params.set("content", content);
  if (format) params.set("format", format);
  if (sort !== "source-desc") params.set("sort", sort);
  if (view !== defaultViewMode()) params.set("view", view);
  if (location.hash === "#admin") params.set("admin", "1");

  const qs = params.toString();
  const next = `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`;
  const method = replace ? "replaceState" : "pushState";
  history[method]({}, "", next);
}

function currentActiveFilters() {
  const filters = [];
  const q = $("#searchInput")?.value?.trim() || "";
  const year = $("#yearFilter")?.value || "";
  const type = $("#typeFilter")?.value || "";
  const content = $("#contentTypeFilter")?.value || "";
  const format = $("#videoFormatFilter")?.value || "";
  const sort = $("#sortFilter")?.value || "source-desc";

  if (q) filters.push({ key:"search", label:`검색: ${q}` });
  if (year) filters.push({ key:"year", label:`${year}년` });
  if (type) filters.push({ key:"type", label:typeLabel(type) });
  if (content) filters.push({ key:"content", label:contentTypeLabel(content) });
  if (format) filters.push({ key:"format", label:`동영상 타입: ${videoFormatLabel(format)}` });
  if (sort !== "source-desc") {
    const option = $("#sortFilter")?.selectedOptions?.[0];
    filters.push({ key:"sort", label:option?.textContent || "정렬 변경" });
  }
  return filters;
}

function renderActiveFilterChips() {
  const wrap = $("#activeFilterChips");
  if (!wrap) return;
  const filters = currentActiveFilters();
  wrap.innerHTML = filters.map(f => `
    <button type="button" class="active-filter-chip" data-clear-filter="${escapeHTML(f.key)}">
      ${escapeHTML(f.label)} <span aria-hidden="true">×</span>
    </button>
  `).join("");
  wrap.hidden = filters.length === 0;
}

function clearOneFilter(key) {
  if (key === "search") $("#searchInput").value = "";
  if (key === "year") $("#yearFilter").value = "";
  if (key === "type") $("#typeFilter").value = "";
  if (key === "content") $("#contentTypeFilter").value = "";
  if (key === "format") $("#videoFormatFilter").value = "";
  if (key === "sort") $("#sortFilter").value = "source-desc";
  visibleLimit = PAGE_SIZE;
  syncUrlState();
  render();
}

function defaultViewMode() {
  return window.matchMedia("(max-width: 620px)").matches ? "list" : "grid";
}

function currentView() {
  const urlView = readUrlState().view;
  if (["grid", "list", "timeline"].includes(urlView)) return urlView;

  const saved = localStorage.getItem(STORAGE_VIEW);
  if (["grid", "list", "timeline"].includes(saved)) return saved;

  return defaultViewMode();
}

function applyViewMode() {
  const mode = currentView();
  const grid = $("#videoGrid");
  const gridBtn = $("#gridViewBtn");
  const listBtn = $("#listViewBtn");
  const timelineBtn = $("#timelineViewBtn");

  if (!grid || !gridBtn || !listBtn || !timelineBtn) return;

  grid.classList.toggle("list-view", mode === "list");
  grid.classList.toggle("timeline-view", mode === "timeline");
  gridBtn.classList.toggle("active", mode === "grid");
  listBtn.classList.toggle("active", mode === "list");
  timelineBtn.classList.toggle("active", mode === "timeline");
}

function setViewMode(mode) {
  const normalized = ["grid", "list", "timeline"].includes(mode) ? mode : defaultViewMode();

  localStorage.setItem(STORAGE_VIEW, normalized);

  // The URL may still contain the previous view mode.
  // Write the newly clicked mode first so currentView() immediately sees it.
  syncUrlState({ viewOverride: normalized });

  visibleLimit = PAGE_SIZE;
  render();
}

function timelinePrimaryEntry(v) {
  const entries = (v.dates || [])
    .filter(d => d?.sourceDate)
    .sort((a,b) => String(b.sourceDate).localeCompare(String(a.sourceDate)));
  return entries[0] || null;
}

function timelinePrimaryDate(v) {
  return timelinePrimaryEntry(v)?.sourceDate || "";
}

function timelineMonthLabel(month) {
  return `${Number(month)}월`;
}

function timelineDateLabel(entry) {
  if (!entry?.sourceDate) return "날짜 미확인";
  const raw = String(entry.sourceDate);

  if (entry.precision === "year") {
    return `${raw.slice(0,4)}년`;
  }

  if (entry.precision === "month") {
    const [y,m] = raw.split("-");
    return `${y}.${m} · 일자 미상`;
  }

  return raw.replace(/-/g, ".");
}

function timelineBucket(v) {
  // An explicitly multi-year playlist belongs in the separate playlist bucket
  // even when an old/single representative date (e.g. 2001) already exists.
  if (isMultiYearPlaylist(v)) {
    return { kind: "playlist-multiyear", year: "", month: "", entry: null };
  }

  const primary = timelinePrimaryEntry(v);
  if (!primary) {
    return v.contentType === "playlist"
      ? { kind: "playlist-undated", year: "", month: "", entry: null }
      : { kind: "unknown", year: "", month: "", entry: null };
  }

  const year = primary.sourceDate.slice(0,4);

  if (primary.precision === "year") {
    return { kind: "year-only", year, month: "", entry: primary };
  }

  const month = primary.sourceDate.slice(5,7);
  return {
    kind: primary.precision === "month" ? "month-only" : "dated",
    year,
    month,
    entry: primary
  };
}

function timelineItemHtml(v, bucket) {
  const primary = bucket.entry;
  const dateCount = (v.dates || []).filter(d => d?.sourceDate).length;
  const extraCount = Math.max(0, dateCount - 1);
  const years = videoYears(v);

  const precisionBadge = bucket.kind === "month-only"
    ? `<span class="precision-badge month-only">일자 미상</span>`
    : bucket.kind === "year-only"
      ? `<span class="precision-badge year-only">월·일 미상</span>`
      : bucket.kind === "playlist-multiyear"
        ? `<span class="precision-badge playlist-multiyear">다년도</span>`
      : bucket.kind === "playlist-undated"
        ? `<span class="precision-badge playlist-undated">연도 미지정</span>`
      : bucket.kind === "unknown"
        ? `<span class="precision-badge unknown">날짜 미확인</span>`
        : "";

  const primaryLabel = bucket.kind === "playlist-multiyear"
    ? "여러 연도 수록"
    : bucket.kind === "playlist-undated"
      ? "연도 미지정"
      : timelineDateLabel(primary);

  const extraDateHtml =
    bucket.kind === "playlist-multiyear" || bucket.kind === "playlist-undated" || bucket.kind === "unknown"
      ? ""
      : (extraCount ? `<span>외 ${extraCount}개 날짜</span>` : "");

  const yearSummaryHtml =
    (bucket.kind === "playlist-multiyear" || v.type === "mixed") && years.length
      ? `<div class="timeline-years">${years.map(escapeHTML).join(" · ")}</div>`
      : "";

  return `
    <article class="timeline-item ${escapeHTML(bucket.kind)}">
      <a class="timeline-thumb youtube-video-link" data-video-id="${escapeHTML(v.id)}" href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">
        ${v.thumbnail ? `<img src="${escapeHTML(v.thumbnail)}" alt="" loading="lazy" />` : ""}
        ${videoFormatIconHtml(v)}
      </a>
      <div class="timeline-item-body">
        <div class="timeline-item-date">
          ${escapeHTML(primaryLabel)}
          ${extraDateHtml}
          ${precisionBadge}
        </div>
        <a class="timeline-title youtube-video-link" data-video-id="${escapeHTML(v.id)}" href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(v.title)}</a>
        ${v.source ? `<div class="timeline-source">출처 · ${escapeHTML(v.source)}</div>` : ""}
        ${yearSummaryHtml}
      </div>
    </article>`;
}

function renderTimeline(rows) {
  const yearGroups = new Map();
  const multiYearPlaylists = [];
  const undatedPlaylists = [];
  const unknown = [];

  for (const v of rows) {
    const bucket = timelineBucket(v);

    if (bucket.kind === "playlist-multiyear") {
      multiYearPlaylists.push({ v, bucket });
      continue;
    }

    if (bucket.kind === "playlist-undated") {
      undatedPlaylists.push({ v, bucket });
      continue;
    }

    if (bucket.kind === "unknown") {
      unknown.push({ v, bucket });
      continue;
    }

    if (!yearGroups.has(bucket.year)) {
      yearGroups.set(bucket.year, {
        months: new Map(),
        yearOnly: []
      });
    }

    const group = yearGroups.get(bucket.year);

    if (bucket.kind === "year-only") {
      group.yearOnly.push({ v, bucket });
      continue;
    }

    if (!group.months.has(bucket.month)) {
      group.months.set(bucket.month, []);
    }

    group.months.get(bucket.month).push({ v, bucket });
  }

  const parts = [];
  const years = [...yearGroups.keys()].sort((a,b) => Number(b) - Number(a));

  for (const year of years) {
    const group = yearGroups.get(year);
    const monthCount = [...group.months.values()].reduce((sum, arr) => sum + arr.length, 0);
    const totalCount = monthCount + group.yearOnly.length;

    const monthEntries = [...group.months.keys()]
      .sort((a,b) => Number(a) - Number(b))
      .map(month => ({
        month,
        count: group.months.get(month).length
      }));

    parts.push(`
      <section class="timeline-year" data-timeline-year="${escapeHTML(year)}">
        <div class="timeline-year-heading">
          <h2>${escapeHTML(year)}</h2>
          <span>${totalCount}개</span>
        </div>
        ${monthEntries.length ? `
          <nav class="timeline-month-nav" aria-label="${escapeHTML(year)}년 월별 이동">
            ${monthEntries.map(({month,count}) => `
              <button type="button" class="timeline-month-jump"
                data-timeline-month-jump="${escapeHTML(year)}-${escapeHTML(month)}">
                <span>${Number(month)}월</span><small>${count}</small>
              </button>
            `).join("")}
            ${group.yearOnly.length ? `
              <button type="button" class="timeline-month-jump"
                data-timeline-month-jump="${escapeHTML(year)}-year-only">
                <span>연도만</span><small>${group.yearOnly.length}</small>
              </button>
            ` : ""}
          </nav>
        ` : ""}
    `);

    for (const month of [...group.months.keys()].sort((a,b) => Number(b) - Number(a))) {
      const items = group.months.get(month)
        .sort((a,b) => timelinePrimaryDate(b.v).localeCompare(timelinePrimaryDate(a.v)));

      parts.push(`
        <div class="timeline-month" id="timeline-${escapeHTML(year)}-${escapeHTML(month)}">
          <h3>${escapeHTML(timelineMonthLabel(month))}</h3>
          <div class="timeline-items">
            ${items.map(({v,bucket}) => timelineItemHtml(v, bucket)).join("")}
          </div>
        </div>
      `);
    }

    if (group.yearOnly.length) {
      const items = group.yearOnly.sort((a,b) => a.v.title.localeCompare(b.v.title, "ko"));
      parts.push(`
        <div class="timeline-month timeline-year-only-group" id="timeline-${escapeHTML(year)}-year-only">
          <h3>연도만 확인</h3>
          <div class="timeline-items">
            ${items.map(({v,bucket}) => timelineItemHtml(v, bucket)).join("")}
          </div>
        </div>
      `);
    }

    parts.push(`</section>`);
  }

  const playlistTotal = multiYearPlaylists.length + undatedPlaylists.length;
  if (playlistTotal) {
    parts.push(`
      <section class="timeline-year timeline-playlists timeline-playlist-hub">
        <div class="timeline-year-heading">
          <div>
            <h2>플레이리스트</h2>
            <p class="timeline-section-note">날짜 아카이브와 별도로 모아보는 플레이리스트 영역입니다.</p>
          </div>
          <span>${playlistTotal}개</span>
        </div>

        ${multiYearPlaylists.length ? `
          <div class="timeline-month timeline-playlist-multiyear-group">
            <h3>다년도 플레이리스트 <small>${multiYearPlaylists.length}개</small></h3>
            <div class="timeline-items">
              ${multiYearPlaylists
                .sort((a,b) => a.v.title.localeCompare(b.v.title, "ko"))
                .map(({v,bucket}) => timelineItemHtml(v, bucket)).join("")}
            </div>
          </div>
        ` : ""}

        ${undatedPlaylists.length ? `
          <div class="timeline-month timeline-playlist-undated-group">
            <h3>연도 미지정 플레이리스트 <small>${undatedPlaylists.length}개</small></h3>
            <div class="timeline-items">
              ${undatedPlaylists
                .sort((a,b) => a.v.title.localeCompare(b.v.title, "ko"))
                .map(({v,bucket}) => timelineItemHtml(v, bucket)).join("")}
            </div>
          </div>
        ` : ""}
      </section>
    `);
  }

  if (unknown.length) {
    parts.push(`
      <section class="timeline-year timeline-unknown">
        <div class="timeline-year-heading">
          <h2>날짜 미확인</h2>
          <span>${unknown.length}개</span>
        </div>
        <div class="timeline-month timeline-unknown-group">
          <h3>확인 필요</h3>
          <div class="timeline-items">
            ${unknown.map(({v,bucket}) => timelineItemHtml(v, bucket)).join("")}
          </div>
        </div>
      </section>
    `);
  }

  return parts.join("");
}

function renderYearJumpBar() {
  const bar = $("#yearJumpBar");
  if (!bar) return;

  const mode = currentView();
  if (mode !== "timeline") {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }

  const contextualRows = contextualYearRows();
  const counts = yearVideoCounts(contextualRows);
  const current = $("#yearFilter")?.value || "";

  // Only show years that actually contain results under the other active
  // filters. If the currently selected year reaches 0, keep it visible so
  // the user can understand why the result is empty and remove it.
  const years = allYears().filter(y => (counts.get(y) || 0) > 0 || y === current);

  bar.innerHTML = `
    <button type="button" class="year-jump-chip ${current ? "" : "active"}" data-year-jump="">
      <span>전체</span><small>${contextualRows.length}</small>
    </button>
    ${years.map(y => `<button type="button" class="year-jump-chip ${current === y ? "active" : ""}" data-year-jump="${escapeHTML(y)}"><span>${escapeHTML(y)}</span><small>${counts.get(y) || 0}</small></button>`).join("")}
  `;
  bar.hidden = false;
}


function scrollTimelineYearIntoView(year) {
  if (!year) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const target = [...document.querySelectorAll(".timeline-year-heading h2")]
    .find(el => el.textContent.trim() === year)?.closest(".timeline-year");
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderEmptyStateActions() {
  const wrap = $("#emptyStateActions");
  if (!wrap) return;

  const q = $("#searchInput")?.value?.trim() || "";
  const year = $("#yearFilter")?.value || "";
  const type = $("#typeFilter")?.value || "";
  const content = $("#contentTypeFilter")?.value || "";
  const format = $("#videoFormatFilter")?.value || "";

  const actions = [];

  if (q) {
    actions.push(`<button type="button" class="empty-secondary-btn" data-empty-action="clear-search">검색어 지우기</button>`);
  }
  if (year) {
    actions.push(`<button type="button" class="empty-secondary-btn" data-empty-action="clear-year">${escapeHTML(year)}년 해제</button>`);
  }
  if (type) {
    actions.push(`<button type="button" class="empty-secondary-btn" data-empty-action="clear-type">날짜 유형 해제</button>`);
  }
  if (content) {
    actions.push(`<button type="button" class="empty-secondary-btn" data-empty-action="clear-content">콘텐츠 유형 해제</button>`);
  }
  if (format) {
    actions.push(`<button type="button" class="empty-secondary-btn" data-empty-action="clear-format">동영상 타입 해제</button>`);
  }

  actions.push(`<button id="emptyResetBtn" class="empty-reset-btn" type="button" data-empty-action="reset-all">전체 보기</button>`);
  wrap.innerHTML = actions.join("");
}

function render() {
  $("#loadingState")?.setAttribute("hidden", "");

  $("#videoCount").textContent = `${videos.length}개`;

  const allUnknown = videos.filter(v => v.type === "unknown").length;
  const allKnown = videos.length - allUnknown;
  if ($("#heroTotal")) $("#heroTotal").textContent = `${videos.length}`;
  if ($("#heroKnown")) $("#heroKnown").textContent = `${allKnown}`;
  if ($("#heroUnknown")) $("#heroUnknown").textContent = `${allUnknown}`;

  // Year counts are contextual: they reflect every active filter except
  // the year itself, so the number on a year chip matches the result count
  // you will get after selecting that year.
  rebuildYearFilter();

  const activeFilterCount = currentActiveFilters().length;
  const filterCountEl = $("#activeFilterCount");
  if (filterCountEl) {
    filterCountEl.textContent = String(activeFilterCount);
    filterCountEl.hidden = activeFilterCount === 0;
  }

  renderActiveFilterChips();
  const rows = filteredVideos();
  const visibleRows = rows.slice(0, visibleLimit);

  // Public result summary intentionally excludes internal date-review counts.
  // This also avoids mismatches where a multi-year playlist has raw type=unknown
  // but is correctly treated as mixed by the public filters.
  $("#resultMeta").innerHTML = videos.length
    ? `<span class="result-total">전체 ${videos.length}개</span><span class="result-divider">·</span><strong>현재 결과 ${rows.length}개</strong>`
    : "";

  const mode = currentView();
  $("#videoGrid").innerHTML = mode === "timeline"
    ? renderTimeline(rows)
    : visibleRows.map(renderCard).join("");
  $("#emptyState").hidden = rows.length !== 0;
  if (!rows.length) {
    const detail = $("#emptyStateDetail");
    const active = currentActiveFilters();
    if (detail) {
      detail.textContent = active.length
        ? `${active.map(x => x.label).join(" · ")} 조건에서는 결과가 없습니다. 아래 조건을 하나씩 풀어보세요.`
        : "검색어나 필터를 변경해 보세요.";
    }
    renderEmptyStateActions();
  }

  const moreBtn = $("#loadMoreBtn");
  if (moreBtn) {
    if (mode === "timeline") {
      moreBtn.hidden = true;
    } else {
      const remaining = rows.length - visibleRows.length;
      moreBtn.hidden = remaining <= 0;
      moreBtn.textContent = remaining > 0
        ? `더 보기 (${Math.min(PAGE_SIZE, remaining)}개)`
        : "더 보기";
    }
  }

  applyViewMode();
  renderYearJumpBar();
  renderAdminList();
  renderAdminUnknownList();
  updateAdminSummary();
}

function renderAdminList() {
  const list = $("#adminList");
  if (!list) return;

  if (!videos.length) {
    list.innerHTML = `<p class="admin-help">현재 영상 데이터가 없습니다.</p>`;
    return;
  }

  list.innerHTML = videos.slice(0, 100).map(v => `
    <div class="admin-item">
      <div>
        <strong>${escapeHTML(v.title)}</strong><br>
        <small>${escapeHTML(
          v.dates.map(displayDate).filter(Boolean).join(", ") || "날짜 없음"
        )} · ${typeLabel(v.type)}</small>
      </div>
    </div>
  `).join("") +
  (videos.length > 100
    ? `<p class="admin-help">관리자 목록은 성능을 위해 앞 100개만 표시합니다. 전체 ${videos.length}개입니다.</p>`
    : "");
}

function manualDateControl(v) {
  return `
    <div class="manual-date-box">
      <div>
        <span class="manual-date-label">직접 날짜 입력</span>
        <small>연도 <b>2007</b> · 여러 연도 <b>2007, 2006</b> · 연월 <b>2007.05</b> · 날짜 <b>2007.05.21</b></small>
      </div>
      <div class="manual-date-row">
        <input type="text" inputmode="numeric" data-manual-date-input="${escapeHTML(v.id)}" placeholder="YYYY / YYYY.MM / YYYY.MM.DD" />
        <button type="button" data-manual-date-apply="${escapeHTML(v.id)}">적용</button>
      </div>
    </div>
  `;
}

function adminReviewReason(v) {
  if (v.manualDateReviewPending || v.descriptionChangedAfterManual) {
    return { key:"description", label:"설명 변경 재검토", priority:0 };
  }

  if (Array.isArray(v.dateCandidates) && v.dateCandidates.length) {
    return { key:"candidate", label:"날짜 후보 있음", priority:1 };
  }

  const reason = unknownReason(v);
  if (reason === "날짜처럼 보이는 표기 확인 필요" || reason === "해시태그에만 날짜 표기가 있음") {
    return { key:"date-like", label:"날짜 표기 확인", priority:2 };
  }

  return { key:"no-date", label:"날짜 정보 없음", priority:3 };
}

function adminReviewReasonDetail(v) {
  const reason = adminReviewReason(v);

  if (reason.key === "description") {
    const previous = (v.previousManualDates || []).map(displayDate).filter(Boolean).join(", ");
    const next = (v.dates || []).map(displayDate).filter(Boolean).join(", ");
    if (previous && next) return `이전 수동 날짜 ${previous} · 새 설명 인식 ${next}`;
    if (previous) return `이전 수동 날짜 ${previous} · 새 설명에서는 날짜 미인식`;
    return "수동 날짜 지정 이후 영상 설명이 변경되었습니다.";
  }

  if (reason.key === "candidate") {
    const candidate = v.dateCandidates?.[0];
    return candidate ? `${candidateSourceLabel(candidate.sourceLocation)}에서 ${candidate.display} 후보를 찾았습니다.` : "적용 가능한 날짜 후보가 있습니다.";
  }

  if (reason.key === "date-like") {
    return unknownReason(v);
  }

  return "설명에서 자동으로 인식할 수 있는 날짜를 찾지 못했습니다.";
}

function adminReviewItemHtml(v, {playlistUndated=false}={}) {
  return `
    <article class="admin-unknown-item" data-review-item-id="${escapeHTML(v.id)}">
      <div class="admin-unknown-thumb">
        ${v.thumbnail ? `<img src="${escapeHTML(v.thumbnail)}" alt="" loading="lazy" />` : ""}
      </div>
      <div class="admin-unknown-body">
        <div class="admin-unknown-top">
          <strong>${escapeHTML(v.title)}</strong>
          <div class="admin-review-badges">
            ${v.contentType === "playlist" ? `<span class="admin-content-badge playlist">플레이리스트</span>` : ""}
            <span class="admin-reason-badge">${escapeHTML(playlistUndated ? "연도 미지정" : adminReviewReason(v).label)}</span>
          </div>
        </div>
        ${!playlistUndated ? `<div class="admin-review-reason-detail">${escapeHTML(adminReviewReasonDetail(v))}</div>` : ""}
        <p>${escapeHTML(descriptionPreview(v.description))}</p>
        ${!playlistUndated ? (v.dateCandidates || []).map(c => `
          <div class="date-candidate-box">
            <div class="date-candidate-info">
              <div class="date-candidate-heading">
                <span class="date-candidate-label">날짜 후보</span>
                <span class="candidate-source-badge ${escapeHTML(c.sourceLocation)}">${escapeHTML(candidateSourceLabel(c.sourceLocation))}</span>
              </div>
              <strong>${escapeHTML(c.display)}</strong>
              <small>원문 ${escapeHTML(c.raw)} · ${escapeHTML(c.context)}</small>
            </div>
            <div class="date-candidate-actions">
              <button type="button" class="candidate-apply-btn"
                data-candidate-apply="${escapeHTML(v.id)}"
                data-candidate-date="${escapeHTML(c.sourceDate)}"
                data-candidate-precision="${escapeHTML(c.precision)}"
                data-candidate-key="${escapeHTML(c.candidateKey)}">${escapeHTML(c.display)}로 적용</button>
              <button type="button" class="candidate-ignore-btn"
                data-candidate-ignore="${escapeHTML(v.id)}"
                data-candidate-key="${escapeHTML(c.candidateKey)}">날짜 아님</button>
            </div>
          </div>`).join("") : ""}
        ${v.manualDateReviewPending ? `
          <div class="description-change-review">
            <div class="description-change-head">
              <span>설명 변경 감지</span>
              <strong>기존 수동 날짜를 보류했습니다.</strong>
            </div>
            ${v.previousManualDates?.length ? `
              <small>이전 수동 날짜: ${escapeHTML(v.previousManualDates.map(displayDate).filter(Boolean).join(", "))}</small>
            ` : ""}
            ${v.dates?.length ? `
              <small>새 설명에서 인식된 날짜: ${escapeHTML(v.dates.map(displayDate).filter(Boolean).join(", "))}</small>
              <button type="button" class="accept-description-date-btn" data-accept-description-date="${escapeHTML(v.id)}">새 설명 날짜 사용</button>
            ` : `
              <small>새 설명에서는 날짜를 찾지 못했습니다. 아래에서 날짜를 다시 입력해 주세요.</small>
            `}
          </div>
        ` : ""}
        ${manualDateControl(v)}
        <div class="admin-review-links">
          <a class="youtube-video-link admin-youtube-link" data-video-id="${escapeHTML(v.id)}" href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">YouTube에서 확인</a>
          <span class="candidate-status" data-candidate-status="${escapeHTML(v.id)}"></span>
        </div>
      </div>
    </article>
  `;
}

function renderAdminUnknownList() {
  const wrap = $("#adminUnknownList");
  const badge = $("#adminUnknownBadge");
  const playlistWrap = $("#adminUndatedPlaylistList");
  const playlistBadge = $("#adminUndatedPlaylistBadge");
  if (!wrap) return;

  const unknown = adminReviewQueueVideos();

  const categorized = unknown.map(v => ({ v, reason: adminReviewReason(v) }));
  const ordinaryUnknown = unknown.filter(v =>
    !(v.manualDateReviewPending || v.descriptionChangedAfterManual)
  );
  const descriptionChanges = unknown.filter(v =>
    v.manualDateReviewPending || v.descriptionChangedAfterManual
  );

  const counts = {
    all: categorized.length,
    description: categorized.filter(x => x.reason.key === "description").length,
    candidate: categorized.filter(x => x.reason.key === "candidate").length,
    "date-like": categorized.filter(x => x.reason.key === "date-like").length,
    "no-date": categorized.filter(x => x.reason.key === "no-date").length
  };

  const setCount = (id, value) => {
    const el = $(id);
    if (el) el.textContent = String(value);
  };
  setCount("#reviewFilterAllCount", counts.all);
  setCount("#reviewFilterDescriptionCount", counts.description);
  setCount("#reviewFilterCandidateCount", counts.candidate);
  setCount("#reviewFilterDateLikeCount", counts["date-like"]);
  setCount("#reviewFilterNoDateCount", counts["no-date"]);

  document.querySelectorAll("[data-review-filter]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.reviewFilter === adminReviewFilter);
  });
  if ($("#adminReviewSort")) $("#adminReviewSort").value = adminReviewSort;

  let visible = categorized.filter(x =>
    adminReviewFilter === "all" || x.reason.key === adminReviewFilter
  );

  visible.sort((a,b) => {
    if (adminReviewSort === "upload-desc") {
      return String(b.v.publishedAt || "").localeCompare(String(a.v.publishedAt || ""));
    }
    if (adminReviewSort === "upload-asc") {
      return String(a.v.publishedAt || "").localeCompare(String(b.v.publishedAt || ""));
    }

    const p = a.reason.priority - b.reason.priority;
    if (p !== 0) return p;
    return String(b.v.publishedAt || "").localeCompare(String(a.v.publishedAt || ""));
  });

  const undatedPlaylists = videos.filter(v =>
    v.contentType === "playlist" &&
    !isMultiYearPlaylist(v) &&
    (v.type === "unknown" || v.manualDateReviewPending)
  );

  if (badge) {
    badge.textContent = adminReviewFilter === "all"
      ? `${unknown.length}개`
      : `${visible.length} / ${unknown.length}개`;
  }
  if (playlistBadge) playlistBadge.textContent = `${undatedPlaylists.length}개`;

  const unknownCountEl = $("#adminReviewUnknownCount");
  const descChangeEl = $("#adminDescriptionChangeCount");
  const completeEl = $("#adminReviewComplete");

  if (unknownCountEl) unknownCountEl.textContent = String(ordinaryUnknown.length);
  if (descChangeEl) descChangeEl.textContent = String(descriptionChanges.length);
  if (completeEl) completeEl.hidden = unknown.length !== 0;

  const tabCount = $("#adminReviewTabCount");
  if (tabCount) tabCount.textContent = String(unknown.length);

  wrap.innerHTML = visible.length
    ? visible.map(({v}) => adminReviewItemHtml(v)).join("")
    : unknown.length
      ? `<div class="admin-empty-complete muted"><span>–</span><div><strong>해당 유형의 검토 항목이 없습니다.</strong><p>다른 검토 유형을 선택해 주세요.</p></div></div>`
      : `<div class="admin-empty-complete"><span>✓</span><div><strong>정리 완료</strong><p>현재 날짜 확인이 필요한 일반 영상이 없습니다.</p></div></div>`;

  if (playlistWrap) {
    playlistWrap.innerHTML = undatedPlaylists.length
      ? undatedPlaylists.map(v => adminReviewItemHtml(v, {playlistUndated:true})).join("")
      : `<p class="admin-help">현재 연도 미지정 플레이리스트가 없습니다.</p>`;
  }

  renderAdminContentList();
}
let adminVideoFormatPreviewResults = [];
const VIDEO_FORMAT_PREVIEW_CACHE_KEY = "pilsae_video_format_preview_cache_v1";

function readVideoFormatPreviewCache() {
  try {
    const raw = sessionStorage.getItem(VIDEO_FORMAT_PREVIEW_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeVideoFormatPreviewCache(cache) {
  try {
    sessionStorage.setItem(
      VIDEO_FORMAT_PREVIEW_CACHE_KEY,
      JSON.stringify(cache || {})
    );
  } catch {}
}

function cachedVideoFormatProbeResults() {
  const cache = readVideoFormatPreviewCache();
  return Object.values(cache).filter(item =>
    item &&
    item.videoId &&
    ["standard", "shorts"].includes(item.videoFormat)
  );
}

function cacheSuccessfulVideoFormatProbes(results=[]) {
  const cache = readVideoFormatPreviewCache();

  for (const item of results) {
    if (!item?.videoId || !["standard", "shorts"].includes(item.videoFormat)) continue;

    cache[String(item.videoId)] = {
      videoId: String(item.videoId),
      videoFormat: item.videoFormat === "shorts" ? "shorts" : "standard",
      reason: String(item.reason || "YouTube 자동 확인 성공")
    };
  }

  writeVideoFormatPreviewCache(cache);
}

function removeVideoFormatProbeCache(videoIds=[]) {
  const cache = readVideoFormatPreviewCache();

  for (const id of videoIds) {
    delete cache[String(id)];
  }

  writeVideoFormatPreviewCache(cache);
}

function pendingVideoFormatTargets() {
  const cachedIds = new Set(
    cachedVideoFormatProbeResults().map(item => String(item.videoId))
  );

  return videos.filter(v =>
    videoFormatAssessment(v).needsReview &&
    !cachedIds.has(String(v.id))
  );
}

function videoFormatProbeProgress() {
  const allTargets = videos.filter(v => videoFormatAssessment(v).needsReview);
  const cachedIds = new Set(
    cachedVideoFormatProbeResults().map(item => String(item.videoId))
  );

  const cachedCount = allTargets.filter(v => cachedIds.has(String(v.id))).length;

  return {
    total: allTargets.length,
    cached: cachedCount,
    remaining: Math.max(0, allTargets.length - cachedCount)
  };
}

const adminVideoFormatSampleLimits = {
  shorts: 12,
  standard: 12,
  unresolved: 12
};

function videoFormatPreviewSortKey(item) {
  const v = videos.find(x => x.id === item.videoId);
  return {
    duration: Number(v?.durationSeconds || 0),
    publishedAt: String(v?.publishedAt || ""),
    title: String(v?.title || "")
  };
}

function stratifiedVideoFormatSample(items, limit) {
  if (items.length <= limit) return [...items];

  const enriched = items.map(item => {
    const meta = videoFormatPreviewSortKey(item);
    const durationBucket =
      meta.duration <= 60 ? "0-60"
      : meta.duration <= 120 ? "61-120"
      : meta.duration <= 180 ? "121-180"
      : "181+";

    const year = meta.publishedAt.slice(0,4) || "unknown";
    return { item, meta, group: `${durationBucket}|${year}` };
  });

  const groups = new Map();
  for (const row of enriched) {
    if (!groups.has(row.group)) groups.set(row.group, []);
    groups.get(row.group).push(row);
  }

  for (const rows of groups.values()) {
    rows.sort((a,b) =>
      b.meta.publishedAt.localeCompare(a.meta.publishedAt) ||
      a.meta.duration - b.meta.duration ||
      a.meta.title.localeCompare(b.meta.title)
    );
  }

  const orderedGroups = [...groups.values()]
    .sort((a,b) => b.length - a.length);

  const picked = [];
  let round = 0;

  while (picked.length < limit) {
    let added = false;

    for (const rows of orderedGroups) {
      if (rows[round]) {
        picked.push(rows[round].item);
        added = true;
        if (picked.length >= limit) break;
      }
    }

    if (!added) break;
    round += 1;
  }

  return picked;
}

function videoFormatPreviewSampleHtml(items, label, emptyText, key) {
  const limit = adminVideoFormatSampleLimits[key] || 12;
  const rows = stratifiedVideoFormatSample(items, limit);
  const remaining = Math.max(0, items.length - rows.length);

  if (!rows.length) {
    return `
      <section class="format-preview-group">
        <div class="format-preview-heading">
          <strong>${escapeHTML(label)}</strong>
          <span>0개</span>
        </div>
        <p class="admin-help">${escapeHTML(emptyText)}</p>
      </section>
    `;
  }

  return `
    <section class="format-preview-group">
      <div class="format-preview-heading">
        <strong>${escapeHTML(label)}</strong>
        <span>${items.length}개 · 샘플 ${rows.length}개</span>
      </div>

      <div class="format-preview-list">
        ${rows.map(item => {
          const v = videos.find(x => x.id === item.videoId);
          return `
            <div class="format-preview-item">
              <div class="format-preview-thumb">
                ${v?.thumbnail ? `<img src="${escapeHTML(v.thumbnail)}" alt="" loading="lazy" />` : ""}
              </div>
              <div class="format-preview-copy">
                <strong>${escapeHTML(v?.title || item.videoId)}</strong>
                <small>
                  ${escapeHTML(videoFormatLabel(item.videoFormat))}
                  ${v?.durationSeconds ? ` · ${escapeHTML(formatDuration(v.durationSeconds))}` : ""}
                  ${v?.publishedAt ? ` · ${escapeHTML(String(v.publishedAt).slice(0,10))}` : ""}
                </small>
                <small>${escapeHTML(item.reason || "")}</small>
              </div>
              ${v?.url ? `
                <a class="format-preview-open youtube-video-link"
                  data-video-id="${escapeHTML(v.id)}"
                  href="${escapeHTML(v.url)}"
                  target="_blank"
                  rel="noopener noreferrer">영상 보기</a>
              ` : ""}
            </div>
          `;
        }).join("")}
      </div>

      ${remaining ? `
        <button type="button"
          class="format-preview-more"
          data-format-preview-more="${escapeHTML(key)}">
          샘플 더보기 (+${Math.min(12, remaining)}개)
        </button>
      ` : ""}
    </section>
  `;
}

function renderVideoFormatPreview(results=[]) {
  const wrap = $("#adminVideoFormatPreview");
  if (!wrap) return;

  adminVideoFormatPreviewResults = Array.isArray(results) ? results : [];

  const shorts = adminVideoFormatPreviewResults.filter(x => x.videoFormat === "shorts");
  const standard = adminVideoFormatPreviewResults.filter(x => x.videoFormat === "standard");
  const unresolved = adminVideoFormatPreviewResults.filter(
    x => !["standard","shorts"].includes(x.videoFormat)
  );

  const applyable = shorts.length + standard.length;
  const reviewedSampleCount =
    Math.min(adminVideoFormatSampleLimits.shorts, shorts.length) +
    Math.min(adminVideoFormatSampleLimits.standard, standard.length) +
    Math.min(adminVideoFormatSampleLimits.unresolved, unresolved.length);

  wrap.innerHTML = `
    <div class="format-preview-summary">
      <div>
        <span>검사 결과</span>
        <strong>${adminVideoFormatPreviewResults.length}개</strong>
      </div>
      <div>
        <span>Shorts</span>
        <strong>${shorts.length}개</strong>
      </div>
      <div>
        <span>일반동영상</span>
        <strong>${standard.length}개</strong>
      </div>
      <div>
        <span>판별불가</span>
        <strong>${unresolved.length}개</strong>
      </div>
    </div>

    <div class="format-preview-note">
      재생시간과 업로드 연도가 섞이도록 샘플을 분산해서 보여줍니다.
      현재 화면에서 최대 ${reviewedSampleCount}개 샘플을 확인 중입니다.
      필요하면 각 분류의 ‘샘플 더보기’를 눌러 12개씩 추가로 확인하세요.
    </div>

    ${videoFormatPreviewSampleHtml(shorts, "Shorts 샘플", "Shorts로 판별된 영상이 없습니다.", "shorts")}
    ${videoFormatPreviewSampleHtml(standard, "일반동영상 샘플", "일반동영상으로 판별된 영상이 없습니다.", "standard")}
    ${videoFormatPreviewSampleHtml(unresolved, "판별불가 샘플", "판별불가 영상이 없습니다.", "unresolved")}

    <div class="format-preview-actions">
      <div class="format-preview-reviewed-count">
        샘플 확인 가능 수 · ${reviewedSampleCount}개
      </div>
      <button type="button"
        id="adminApplyVideoFormatPreview"
        class="ghost-button format-preview-apply"
        ${applyable ? "" : "disabled"}>
        확인 결과 ${applyable}개 일괄 적용
      </button>
      <button type="button"
        id="adminClearVideoFormatPreview"
        class="ghost-button">
        미리보기 닫기
      </button>
    </div>
  `;

  wrap.hidden = false;
}

function wait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function probeVideoFormatBatchWithRetry(videoIds, {
  attempts=3,
  retryDelayMs=1200
}={}) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await adminApi("/probe-video-formats", {
        method: "POST",
        body: JSON.stringify({ videoIds })
      });
    } catch (err) {
      lastError = err;

      if (attempt < attempts) {
        await wait(retryDelayMs * attempt);
      }
    }
  }

  throw lastError || new Error("자동 확인 요청에 실패했습니다.");
}

let adminVideoFormatDiagnosticStage = 0;

function diagnosticSampleTargets(targets, limit) {
  if (targets.length <= limit) return [...targets];

  const sampleItems = stratifiedVideoFormatSample(
    targets.map(v => ({ videoId:v.id, videoFormat:v.videoFormat || "" })),
    limit
  );

  const byId = new Map(targets.map(v => [String(v.id), v]));
  return sampleItems.map(item => byId.get(String(item.videoId))).filter(Boolean);
}

function renderVideoFormatDiagnostic({
  stage=0,
  total=0,
  checked=0,
  resolved=0,
  unresolved=0,
  networkFailed=0,
  canContinue=false,
  message=""
}={}) {
  const wrap = $("#adminVideoFormatDiagnostic");
  if (!wrap) return;

  const rate = checked ? Math.round((resolved / checked) * 100) : 0;

  wrap.innerHTML = `
    <div class="format-diagnostic-grid">
      <div><span>단계</span><strong>${stage || "-"}</strong></div>
      <div><span>검사</span><strong>${checked}/${total || checked}</strong></div>
      <div><span>판별 성공</span><strong>${resolved}</strong></div>
      <div><span>판별불가</span><strong>${unresolved}</strong></div>
      <div><span>네트워크 실패</span><strong>${networkFailed}</strong></div>
      <div><span>성공률</span><strong>${rate}%</strong></div>
    </div>
    <p class="format-diagnostic-message ${canContinue ? "ok" : "warn"}">${escapeHTML(message)}</p>
  `;
  wrap.hidden = false;
}

async function runVideoFormatDiagnostic(limit, stage) {
  const status = $("#adminVideoFormatVerifyStatus");
  const targets = pendingVideoFormatTargets();
  const stage5 = $("#adminVerifyVideoFormats5");
  const stage20 = $("#adminVerifyVideoFormats20");
  const stageAll = $("#adminVerifyVideoFormatsAll");

  if (!targets.length) {
    setAdminStatus(status, "현재 자동 확인이 필요한 영상이 없습니다.", "success");
    return;
  }

  const sampleTargets = diagnosticSampleTargets(
    targets,
    Math.min(limit, targets.length)
  );

  [stage5, stage20, stageAll].forEach(btn => {
    if (btn) btn.disabled = true;
  });

  const results = [];
  let networkFailed = 0;

  try {
    const batchSize = 5;

    for (let i = 0; i < sampleTargets.length; i += batchSize) {
      const batch = sampleTargets.slice(i, i + batchSize);

      setAdminStatus(
        status,
        `${stage}단계 진단 중… ${Math.min(i + batch.length, sampleTargets.length)}/${sampleTargets.length}`,
        "loading"
      );

      try {
        const data = await probeVideoFormatBatchWithRetry(
          batch.map(v => v.id),
          { attempts:3, retryDelayMs:1200 }
        );

        const received = Array.isArray(data.results) ? data.results : [];
        results.push(...received);
        cacheSuccessfulVideoFormatProbes(received);

        const got = new Set(received.map(x => String(x.videoId || "")));
        for (const v of batch) {
          if (!got.has(String(v.id))) {
            results.push({
              videoId:v.id,
              videoFormat:"",
              reason:"자동 확인 응답 누락"
            });
          }
        }
      } catch (err) {
        networkFailed += batch.length;
        for (const v of batch) {
          results.push({
            videoId:v.id,
            videoFormat:"",
            reason:"자동 확인 네트워크 실패"
          });
        }
      }

      if (i + batchSize < sampleTargets.length) {
        await wait(400);
      }
    }

    const resolved = results.filter(
      x => ["standard","shorts"].includes(x.videoFormat)
    ).length;
    const unresolved = results.length - resolved;

    let canContinue = false;
    let message = "";

    if (stage === 1) {
      canContinue =
        networkFailed === 0 &&
        resolved >= Math.max(3, Math.ceil(results.length * 0.6));

      message = canContinue
        ? "5개 진단이 정상입니다. 20개 테스트로 범위를 넓혀도 됩니다."
        : "5개 진단에서 실패/판별불가 비율이 높습니다. 전체 검사는 아직 실행하지 않는 것이 안전합니다.";

      adminVideoFormatDiagnosticStage = canContinue ? 1 : 0;

      if (stage5) stage5.disabled = false;
      if (stage20) stage20.disabled = !canContinue;
      if (stageAll) stageAll.disabled = true;
    } else {
      canContinue =
        networkFailed <= 1 &&
        resolved >= Math.ceil(results.length * 0.8);

      message = canContinue
        ? "20개 테스트 결과가 안정적입니다. 이제 전체 미리보기를 실행할 수 있습니다."
        : "20개 테스트에서 안정성이 충분하지 않습니다. 전체 미리보기는 잠금 상태로 유지합니다.";

      adminVideoFormatDiagnosticStage = canContinue ? 2 : 1;

      if (stage5) stage5.disabled = false;
      if (stage20) stage20.disabled = false;
      if (stageAll) stageAll.disabled = !canContinue;
    }

    renderVideoFormatDiagnostic({
      stage,
      total:sampleTargets.length,
      checked:results.length,
      resolved,
      unresolved,
      networkFailed,
      canContinue,
      message
    });

    const progress = videoFormatProbeProgress();

    setAdminStatus(
      status,
      `${stage}단계 완료 · 판별 성공 ${resolved} · 판별불가 ${unresolved} · 네트워크 실패 ${networkFailed}` +
        ` · 미리 판별 ${progress.cached}개 · 남은 검사 ${progress.remaining}개`,
      canContinue ? "success" : "error"
    );
  } catch (err) {
    if (stage5) stage5.disabled = false;
    if (stage20) stage20.disabled = adminVideoFormatDiagnosticStage < 1;
    if (stageAll) stageAll.disabled = adminVideoFormatDiagnosticStage < 2;
    setAdminStatus(status, `${stage}단계 진단 오류: ${err.message}`, "error");
  }
}

async function previewAllPendingVideoFormats() {
  const button = $("#adminVerifyVideoFormatsAll");
  const status = $("#adminVideoFormatVerifyStatus");
  if (!button || !status) return;

  const targets = pendingVideoFormatTargets();

  if (adminVideoFormatDiagnosticStage < 2) {
    setAdminStatus(
      status,
      "먼저 5개 진단과 20개 테스트를 통과해야 전체 미리보기를 실행할 수 있습니다.",
      "error"
    );
    return;
  }

  if (!targets.length) {
    const cached = cachedVideoFormatProbeResults();

    if (cached.length) {
      renderVideoFormatPreview(cached);
      const progress = videoFormatProbeProgress();
      setAdminStatus(
        status,
        `추가 검사할 영상이 없습니다. 미리 판별 ${progress.cached}개 결과를 확인하고 일괄 적용할 수 있습니다.`,
        "success"
      );
    } else {
      setAdminStatus(status, "현재 자동 확인이 필요한 영상이 없습니다.", "success");
      $("#adminVideoFormatPreview")?.setAttribute("hidden", "");
    }
    return;
  }

  button.disabled = true;
  adminVideoFormatPreviewResults = [];
  adminVideoFormatSampleLimits.shorts = 12;
  adminVideoFormatSampleLimits.standard = 12;
  adminVideoFormatSampleLimits.unresolved = 12;

  // YouTube 공개 페이지를 여러 개 동시에 확인하면 일시적으로
  // 네트워크/Worker fetch가 끊길 수 있어 작은 묶음으로 나눠 처리한다.
  const batchSize = 5;
  const results = [...cachedVideoFormatProbeResults()];
  let failedBatches = 0;
  let processed = 0;

  try {
    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      const ids = batch.map(v => v.id);

      setAdminStatus(
        status,
        `미리보기 검사 중… ${Math.min(processed + batch.length, targets.length)}/${targets.length}` +
          ` · 미리 판별 ${cachedVideoFormatProbeResults().length}개` +
          (failedBatches ? ` · 재시도 실패 묶음 ${failedBatches}개` : ""),
        "loading"
      );

      try {
        const data = await probeVideoFormatBatchWithRetry(ids, {
          attempts: 3,
          retryDelayMs: 1200
        });

        const received = Array.isArray(data.results) ? data.results : [];
        const receivedIds = new Set(received.map(x => String(x.videoId || "")));

        results.push(...received);
        cacheSuccessfulVideoFormatProbes(received);

        // 응답에서 누락된 영상도 미리보기 자체는 계속 진행하도록 판별불가로 남긴다.
        for (const v of batch) {
          if (!receivedIds.has(String(v.id))) {
            results.push({
              videoId: v.id,
              videoFormat: "",
              reason: "자동 확인 응답 누락 · 다시 시도 필요"
            });
          }
        }
      } catch (err) {
        failedBatches += 1;

        // 한 묶음이 실패해도 300개 전체 검사를 중단하지 않는다.
        for (const v of batch) {
          results.push({
            videoId: v.id,
            videoFormat: "",
            reason: `자동 확인 네트워크 실패 · 다시 시도 필요`
          });
        }
      }

      processed += batch.length;

      // 연속 요청으로 YouTube/Worker 쪽이 과부하되지 않도록 짧게 쉬어간다.
      if (i + batchSize < targets.length) {
        await wait(350);
      }
    }

    renderVideoFormatPreview(results);

    const shorts = results.filter(x => x.videoFormat === "shorts").length;
    const standard = results.filter(x => x.videoFormat === "standard").length;
    const unresolved = results.length - shorts - standard;

    const suffix = failedBatches
      ? ` · 네트워크 실패 묶음 ${failedBatches}개는 판별불가로 남김`
      : "";

    const progress = videoFormatProbeProgress();

    setAdminStatus(
      status,
      `미리보기 완료 · Shorts ${shorts}개 · 일반동영상 ${standard}개 · 판별불가 ${unresolved}개` +
        ` · 미리 판별 ${progress.cached}개 · 남은 검사 ${progress.remaining}개${suffix}`,
      "success"
    );
  } catch (err) {
    setAdminStatus(status, `미리보기 검사 중 오류: ${err.message}`, "error");
  } finally {
    button.disabled = false;
  }
}

async function applyVideoFormatPreview() {
  const status = $("#adminVideoFormatVerifyStatus");
  const button = $("#adminApplyVideoFormatPreview");
  const applyable = adminVideoFormatPreviewResults.filter(
    x => ["standard","shorts"].includes(x.videoFormat)
  );

  if (!applyable.length) {
    setAdminStatus(status, "적용할 자동 확인 결과가 없습니다.", "error");
    return;
  }

  const shorts = applyable.filter(x => x.videoFormat === "shorts").length;
  const standard = applyable.length - shorts;

  const ok = window.confirm(
    `미리보기 결과 ${applyable.length}개를 실제 데이터에 적용할까요?\n\n` +
    `Shorts ${shorts}개 · 일반동영상 ${standard}개\n\n` +
    `적용 직전에 자동 백업을 생성합니다.`
  );
  if (!ok) return;

  if (button) button.disabled = true;
  setAdminStatus(status, `확인 결과 ${applyable.length}개 저장 중…`, "loading");

  try {
    const applied = await adminApi("/apply-video-format-probes", {
      method: "POST",
      body: JSON.stringify({ results: applyable })
    });

    const appliedMap = new Map(
      (applied.results || []).map(item => [String(item.videoId), item])
    );

    removeVideoFormatProbeCache([...appliedMap.keys()]);

    videos.forEach(v => {
      const item = appliedMap.get(String(v.id));
      if (!item) return;

      v.videoFormat = item.videoFormat === "shorts" ? "shorts" : "standard";
      v.videoFormatSource = "youtube";
      v.videoFormatConfidence = "";
      v.videoFormatReason = item.reason ||
        "YouTube 공개 페이지에서 Shorts 분류를 확인했습니다.";
    });

    adminHistoryLoaded = false;
    adminBackupsLoaded = false;

    const unresolved = adminVideoFormatPreviewResults.filter(
      x => !["standard","shorts"].includes(x.videoFormat)
    );

    render();
    renderAdminContentList();

    if (unresolved.length) {
      renderVideoFormatPreview(unresolved);
    } else {
      const preview = $("#adminVideoFormatPreview");
      if (preview) {
        preview.hidden = true;
        preview.innerHTML = "";
      }
      adminVideoFormatPreviewResults = [];
    }

    const remaining = videos.filter(v => videoFormatAssessment(v).needsReview).length;
    setAdminStatus(
      status,
      `일괄 적용 완료 · ${applied.results?.length || 0}개 반영 · 남은 확인 필요 ${remaining}개`,
      "success"
    );
  } catch (err) {
    setAdminStatus(status, `일괄 적용 중 오류: ${err.message}`, "error");
  } finally {
    if (button) button.disabled = false;
  }
}


function renderAdminContentList() {
  const progressStatus = $("#adminVideoFormatVerifyStatus");
  if (progressStatus && !progressStatus.textContent.trim()) {
    const progress = videoFormatProbeProgress();
    if (progress.total) {
      progressStatus.textContent =
        `전체 후보 ${progress.total}개 · 미리 판별 ${progress.cached}개 · 남은 검사 ${progress.remaining}개`;
    }
  }

  const wrap = $("#adminContentList");
  const loadMoreBtn = $("#adminContentLoadMore");
  if (!wrap) return;

  const q = ($("#adminContentSearch")?.value || "").trim().toLowerCase();

  // Keep already-classified playlists visible for management.
  // Video-format mode shows the full archive because Shorts can be very short.
  let rows = ["video-format", "video-format-review"].includes(adminContentMode)
    ? [...videos]
    : videos.filter(v =>
        v.contentType === "playlist" ||
        Number(v.durationSeconds || 0) >= 360
      );

  if (adminContentMode === "playlists") {
    rows = rows.filter(v => v.contentType === "playlist");
  } else if (adminContentMode === "candidates") {
    rows = rows.filter(v => v.contentType !== "playlist");
  } else if (adminContentMode === "video-format-review") {
    rows = rows.filter(v => videoFormatAssessment(v).needsReview);
  }

  if ($("#adminContentMode")) $("#adminContentMode").value = adminContentMode;

  if (q) {
    rows = rows.filter(v => `${v.title} ${v.description}`.toLowerCase().includes(q));
  }

  rows.sort((a,b) => {
    if (["video-format", "video-format-review"].includes(adminContentMode)) {
      const ac = videoFormatAssessment(a);
      const bc = videoFormatAssessment(b);
      if (ac.needsReview !== bc.needsReview) return ac.needsReview ? -1 : 1;
      if (a.videoFormat === "shorts" && b.videoFormat !== "shorts") return -1;
      if (a.videoFormat !== "shorts" && b.videoFormat === "shorts") return 1;
      return String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
    }
    if (a.contentType === "playlist" && b.contentType !== "playlist") return -1;
    if (a.contentType !== "playlist" && b.contentType === "playlist") return 1;
    return Number(b.durationSeconds || 0) - Number(a.durationSeconds || 0);
  });

  if (!rows.length) {
    wrap.innerHTML = `<p class="admin-help">조건에 맞는 영상이 없습니다.</p>`;
    if (loadMoreBtn) loadMoreBtn.hidden = true;
    return;
  }

  const visibleRows = rows.slice(0, adminContentVisibleLimit);
  wrap.innerHTML = visibleRows.map(v => `
    <div class="admin-content-item">
      <div class="admin-content-thumb">${v.thumbnail ? `<img src="${escapeHTML(v.thumbnail)}" alt="" loading="lazy" />` : ""}</div>
      <div class="admin-content-copy">
        <strong>${escapeHTML(v.title)}</strong>
        <small>
          ${isMultiYearPlaylist(v)
            ? `다년도 플레이리스트${v.dates.length ? ` · 기존 대표 날짜 ${escapeHTML(v.dates.map(displayDate).filter(Boolean).join(", "))}` : ""}`
            : escapeHTML(v.dates.map(displayDate).filter(Boolean).join(", ") || "날짜 없음")}
          ${v.durationSeconds ? ` · ${escapeHTML(formatDuration(v.durationSeconds))}` : ""}
        </small>
      </div>
      <div class="admin-content-actions">
        <button type="button"
          class="content-action-btn content-type-toggle ${v.contentType === "playlist" ? "is-playlist" : ""}"
          data-content-type-toggle="${escapeHTML(v.id)}"
          data-next-content-type="${v.contentType === "playlist" ? "video" : "playlist"}">
          <span class="content-action-icon" aria-hidden="true">${v.contentType === "playlist" ? "✓" : "♫"}</span>
          <span>${v.contentType === "playlist" ? "플레이리스트 해제" : "플레이리스트로 지정"}</span>
        </button>
        ${v.contentType === "playlist" ? `
          <div class="playlist-scope-block">
            <div class="playlist-scope-current">
              <span>현재 분류</span>
              <strong>${escapeHTML(playlistScopeLabel(v))}</strong>
            </div>
            <div class="playlist-scope-actions">
              <button type="button"
                class="content-action-btn playlist-scope-btn ${isMultiYearPlaylist(v) ? "active" : ""}"
                data-playlist-scope="${escapeHTML(v.id)}"
                data-playlist-scope-value="multi-year">
                <span class="content-action-icon" aria-hidden="true">⇄</span>
                <span>다년도로 지정</span>
              </button>
              <button type="button"
                class="content-action-btn playlist-scope-btn ${!isMultiYearPlaylist(v) && v.playlistScope === "undated" ? "active" : ""}"
                data-playlist-scope="${escapeHTML(v.id)}"
                data-playlist-scope-value="undated">
                <span class="content-action-icon" aria-hidden="true">?</span>
                <span>연도 미지정</span>
              </button>
            </div>
          </div>
        ` : ""}
        <div class="video-format-admin-block">
          ${(() => {
            const assessment = videoFormatAssessment(v);
            const prefix = assessment.needsReview ? "확인 사유" : "판별 근거";
            return `
              <div class="playlist-scope-current video-format-current">
                <span>동영상 타입 · ${escapeHTML(assessment.label)}</span>
                <strong>${escapeHTML(videoFormatLabel(v.videoFormat))}</strong>
                <small class="video-format-reason ${assessment.needsReview ? "needs-review" : ""}">
                  ${escapeHTML(prefix)} · ${escapeHTML(assessment.reason)}
                </small>
              </div>
              ${v.videoFormatSource === "auto" && assessment.needsReview ? `
                <button type="button"
                  class="content-action-btn video-format-confirm-btn ${assessment.needsReview ? "attention" : ""}"
                  data-video-format-confirm="${escapeHTML(v.id)}">
                  <span class="content-action-icon" aria-hidden="true">✓</span>
                  <span>현재 판별 확정</span>
                </button>
              ` : ""}
            `;
          })()}
          <div class="playlist-scope-actions">
            <button type="button"
              class="content-action-btn video-format-btn ${v.videoFormat === "standard" ? "active" : ""}"
              data-video-format="${escapeHTML(v.id)}"
              data-video-format-value="standard">
              <span class="content-action-icon" aria-hidden="true">▻</span>
              <span>일반동영상</span>
            </button>
            <button type="button"
              class="content-action-btn video-format-btn ${v.videoFormat === "shorts" ? "active" : ""}"
              data-video-format="${escapeHTML(v.id)}"
              data-video-format-value="shorts">
              <span class="content-action-icon" aria-hidden="true">ϟ</span>
              <span>Shorts</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join("");

  if (loadMoreBtn) {
    const remaining = rows.length - visibleRows.length;
    loadMoreBtn.hidden = remaining <= 0;
    loadMoreBtn.textContent = remaining > 0
      ? `더보기 (${Math.min(30, remaining)}개)`
      : "더보기";
  }
}

function adminHistoryActionLabel(action) {
  const labels = {
    sync_apply: "YouTube 동기화",
    manual_date: "수동 날짜 적용",
    candidate_date: "날짜 후보 적용",
    ignore_candidate: "날짜 후보 제외",
    accept_description_date: "새 설명 날짜 사용",
    content_type: "콘텐츠 유형 변경",
    playlist_scope: "플레이리스트 범위 변경",
    site_config: "사이트 설정 변경",
    undo: "변경 되돌리기",
    backup_restore: "백업 복원",
    video_format: "동영상 타입 변경",
    video_format_confirm: "동영상 타입 확인",
    video_format_youtube_verify: "YouTube 타입 자동 확인"
  };
  return labels[action] || action || "관리자 변경";
}

function adminHistoryValueText(value) {
  if (value == null || value === "") return "없음";
  if (Array.isArray(value)) {
    return value.map(x => {
      if (typeof x === "object" && x?.sourceDate) return x.sourceDate;
      return String(x);
    }).join(", ") || "없음";
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([k,v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v ?? "")}`)
      .join(" · ");
  }
  return String(value);
}

function canUndoAdminHistoryEntry(entry) {
  return [
    "manual_date",
    "candidate_date",
    "ignore_candidate",
    "accept_description_date",
    "content_type",
    "playlist_scope",
    "video_format",
    "video_format_confirm"
  ].includes(String(entry?.action || "")) && Boolean(entry?.videoId);
}

function adminUndoSummary(entry) {
  const action = String(entry?.action || "");
  if (action === "manual_date" || action === "candidate_date" || action === "accept_description_date") {
    return "이 영상의 날짜 관련 상태를 변경 전으로 되돌립니다.";
  }
  if (action === "ignore_candidate") {
    return "무시한 날짜 후보 상태를 변경 전으로 되돌립니다.";
  }
  if (action === "content_type") {
    return "영상/플레이리스트 분류를 변경 전으로 되돌립니다.";
  }
  if (action === "playlist_scope") {
    return "플레이리스트 범위를 변경 전으로 되돌립니다.";
  }
  if (action === "video_format") {
    return "일반동영상/Shorts 타입을 변경 전으로 되돌립니다.";
  }
  if (action === "video_format_confirm") {
    return "관리자 확인 상태를 자동 판별 상태로 되돌립니다.";
  }
  return "이 변경을 이전 상태로 되돌립니다.";
}

function renderAdminHistory(entries=[]) {
  const wrap = $("#adminHistoryList");
  if (!wrap) return;

  if (!entries.length) {
    wrap.innerHTML = `<div class="admin-empty-complete muted"><span>–</span><div><strong>아직 저장된 변경 이력이 없습니다.</strong><p>날짜 적용이나 콘텐츠 분류 변경부터 기록됩니다.</p></div></div>`;
    return;
  }

  wrap.innerHTML = entries.map(entry => `
    <div class="admin-history-item ${entry.action === "undo" ? "is-undo" : ""}">
      <div class="admin-history-meta">
        <span class="admin-history-action">${escapeHTML(adminHistoryActionLabel(entry.action))}</span>
        <time>${escapeHTML(formatAdminDateTime(entry.changedAt))}</time>
      </div>
      <div class="admin-history-body">
        <div class="admin-history-title-row">
          <div>
            <strong>${escapeHTML(entry.title || entry.videoId || "사이트 설정")}</strong>
            ${entry.videoId ? `<small class="admin-history-video-id">영상 ID · ${escapeHTML(entry.videoId)}</small>` : ""}
          </div>
          ${canUndoAdminHistoryEntry(entry)
            ? `<button type="button" class="admin-history-undo-btn"
                data-admin-history-undo="${escapeHTML(entry.id || "")}"
                data-admin-history-title="${escapeHTML(entry.title || entry.videoId || "해당 영상")}"
                data-admin-history-summary="${escapeHTML(adminUndoSummary(entry))}">
                되돌리기
              </button>`
            : ""}
        </div>
        <div class="admin-history-change">
          <span><b>이전</b> ${escapeHTML(adminHistoryValueText(entry.before))}</span>
          <span><b>변경</b> ${escapeHTML(adminHistoryValueText(entry.after))}</span>
        </div>
      </div>
    </div>
  `).join("");
}


async function loadAdminHistory({ force=false }={}) {
  const status = $("#adminHistoryStatus");
  if (!$("#adminHistoryList")) return;
  if (adminHistoryLoaded && !force) return;

  if (!getAdminToken()) {
    setAdminStatus(status, "변경 이력을 보려면 먼저 ADMIN_TOKEN을 적용해 주세요.", "error");
    return;
  }

  setAdminStatus(status, "최근 변경 이력을 불러오는 중입니다…", "loading");

  try {
    const data = await adminApi("/admin-history", { method:"GET" });
    renderAdminHistory(Array.isArray(data.entries) ? data.entries : []);
    adminHistoryLoaded = true;
    setAdminStatus(status, `최근 ${Array.isArray(data.entries) ? data.entries.length : 0}건을 불러왔습니다.`, "success");
  } catch (err) {
    setAdminStatus(status, err.message, "error");
  }
}

function backupReasonLabel(reason) {
  const labels = {
    manual: "수동 백업",
    before_sync: "YouTube 동기화 직전",
    before_restore: "복원 실행 직전"
  };
  return labels[String(reason || "")] || "관리자 백업";
}

function renderAdminBackups(backups=[]) {
  const wrap = $("#adminBackupList");
  if (!wrap) return;

  if (!backups.length) {
    wrap.innerHTML = `<div class="admin-empty-complete muted"><span>–</span><div><strong>아직 복원 지점이 없습니다.</strong><p>지금 백업을 만들거나 다음 YouTube 동기화 적용 시 자동 생성됩니다.</p></div></div>`;
    return;
  }

  wrap.innerHTML = backups.map(item => `
    <div class="admin-backup-item">
      <div>
        <strong>${escapeHTML(backupReasonLabel(item.reason))}</strong>
        <small>${escapeHTML(formatAdminDateTime(item.createdAt))} · 영상 ${Number(item.total || 0)}개</small>
      </div>
      <button type="button" class="admin-backup-restore-btn"
        data-backup-restore="${escapeHTML(item.id || "")}">
        이 시점으로 복원
      </button>
    </div>
  `).join("");
}

async function loadAdminBackups({ force=false }={}) {
  if (!$("#adminBackupList")) return;
  if (adminBackupsLoaded && !force) return;

  const status = $("#adminBackupStatus");
  try {
    const data = await adminApi("/admin-backups", { method:"GET" });
    renderAdminBackups(Array.isArray(data.backups) ? data.backups : []);
    adminBackupsLoaded = true;
    setAdminStatus(status, "", "");
  } catch (err) {
    setAdminStatus(status, err.message, "error");
  }
}

function focusAdminReviewVideo(videoId) {
  if (!videoId) return;
  window.setTimeout(() => {
    const item = document.querySelector(`[data-review-item-id="${CSS.escape(videoId)}"]`);
    if (!item) return;
    item.classList.add("admin-focus-item");
    item.scrollIntoView({ behavior:"smooth", block:"center" });
    window.setTimeout(() => item.classList.remove("admin-focus-item"), 2200);
  }, 40);
}

function routeAdminAction(route, { videoId="", healthType="" }={}) {
  if (route === "review-all") {
    adminReviewFilter = "all";
    setAdminTab("review");
    renderAdminUnknownList();
    return;
  }

  if (route === "review-description") {
    adminReviewFilter = "description";
    setAdminTab("review");
    renderAdminUnknownList();
    return;
  }

  if (route === "review-unknown") {
    adminReviewFilter = "all";
    setAdminTab("review");
    renderAdminUnknownList();
    return;
  }

  if (route === "content-playlists") {
    adminContentMode = "playlists";
    adminContentVisibleLimit = 30;
    if ($("#adminContentSearch")) $("#adminContentSearch").value = "";
    setAdminTab("content");
    renderAdminContentList();
    return;
  }

  if (route === "sync") {
    setAdminTab("sync");
    loadAdminBackups();
    return;
  }

  if (route === "review") {
    const v = videos.find(item => String(item.id) === String(videoId));
    adminReviewFilter = healthType === "설명 변경 재검토"
      ? "description"
      : (v ? adminReviewReason(v).key : "all");
    setAdminTab("review");
    renderAdminUnknownList();
    focusAdminReviewVideo(videoId);
    return;
  }

  if (route === "content") {
    adminContentMode = "playlists";
    const v = videos.find(item => String(item.id) === String(videoId));
    if ($("#adminContentSearch")) $("#adminContentSearch").value = v?.title || "";
    setAdminTab("content");
    renderAdminContentList();
  }
}

function setAdminTab(tabName) {
  document.querySelectorAll("[data-admin-tab]").forEach(btn => {
    const active = btn.dataset.adminTab === tabName;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-admin-panel]").forEach(panel => {
    const active = panel.dataset.adminPanel === tabName;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

function setAdmin(open, { auto=false }={}) {
  const panel = $("#adminPanel");
  if (!panel) return;

  panel.hidden = !open;
  document.body.classList.toggle("admin-mode-open", open);

  if (open) {
    const params = new URLSearchParams(location.search);
    const queryAdmin = params.get("admin") === "1";
    const dedicatedAdmin = /\/admin\/?$/.test(location.pathname);

    if (!dedicatedAdmin && !queryAdmin && location.hash !== "#admin") {
      location.hash = "admin";
    }

    if (!auto) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } else if (location.hash === "#admin") {
    history.replaceState(null, "", location.pathname + location.search);
  }
}

function downloadJSON(data, filename) {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

function setSiteHelp(open) {
  const panel = $("#siteHelpPanel");
  const backdrop = $("#siteHelpBackdrop");
  const button = $("#siteHelpBtn");
  if (!panel || !button) return;

  panel.hidden = !open;
  if (backdrop) backdrop.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("site-help-open", open);

  if (open) {
    window.setTimeout(() => $("#siteHelpClose")?.focus(), 0);
  } else {
    button.focus({ preventScroll:true });
  }
}

function renderSyncPreview(data) {
  const panel = $("#syncPreviewPanel");
  if (!panel || !data) return;

  lastSyncPreview = data;
  panel.hidden = false;

  $("#syncPreviewAdded").textContent = String(data.added || 0);
  $("#syncPreviewTitle").textContent = String(data.titleChanged || 0);
  $("#syncPreviewDescription").textContent = String(data.descriptionChanged || 0);
  $("#syncPreviewRemoved").textContent = String(data.removed || 0);
  $("#syncPreviewUnchanged").textContent = String(data.unchanged || 0);

  const details = $("#syncPreviewDetails");
  if (details) {
    const rows = Array.isArray(data.changes) ? data.changes : [];
    details.innerHTML = rows.length
      ? rows.slice(0, 30).map(change => `
          <div class="sync-preview-item">
            <span class="sync-preview-kind">${escapeHTML(change.kind || "변경")}</span>
            <div>
              <strong>${escapeHTML(change.title || change.id || "제목 없음")}</strong>
              ${change.before ? `<small>이전: ${escapeHTML(change.before)}</small>` : ""}
              ${change.after ? `<small>변경: ${escapeHTML(change.after)}</small>` : ""}
            </div>
          </div>
        `).join("") + (rows.length > 30 ? `<p class="admin-help">상세 변경 ${rows.length}건 중 앞 30건만 표시합니다.</p>` : "")
      : `<p class="admin-help">변경되는 영상이 없습니다.</p>`;
  }

  const applyBtn = $("#syncYoutubeVideos");
  if (applyBtn) applyBtn.disabled = false;
}

function resetSyncPreview() {
  lastSyncPreview = null;
  const panel = $("#syncPreviewPanel");
  const applyBtn = $("#syncYoutubeVideos");
  if (panel) panel.hidden = true;
  if (applyBtn) applyBtn.disabled = true;
}



function updateCompactDateTypeLabel(compact) {
  const select = $("#typeFilter");
  if (!select) return;
  const option = [...select.options].find(o => o.value === "");
  if (option) option.textContent = compact ? "전체 날짜" : "전체 날짜 유형";
}

function setupCompactStickyToolbar() {
  const toolbar = document.querySelector(".toolbar-panel");
  if (!toolbar || document.body.classList.contains("admin-page")) return;

  const sentinel = document.createElement("span");
  sentinel.className = "toolbar-sticky-sentinel";
  sentinel.setAttribute("aria-hidden", "true");

  const placeholder = document.createElement("div");
  placeholder.className = "toolbar-fixed-placeholder";
  placeholder.hidden = true;

  toolbar.before(sentinel);
  toolbar.before(placeholder);

  let compact = false;
  let normalOuterHeight = 0;
  let resizeTimer = 0;

  const measureNormalHeight = () => {
    if (compact) return;
    const rect = toolbar.getBoundingClientRect();
    const styles = getComputedStyle(toolbar);
    normalOuterHeight = Math.ceil(rect.height + (parseFloat(styles.marginBottom) || 0));
    placeholder.style.height = `${normalOuterHeight}px`;
  };

  const setCompact = (next) => {
    if (compact === next) return;
    compact = next;

    if (compact) {
      if (!normalOuterHeight) measureNormalHeight();
      placeholder.style.height = `${normalOuterHeight}px`;
      placeholder.hidden = false;
      toolbar.classList.add("is-compact-sticky");
      document.body.classList.add("compact-toolbar-active");
    } else {
      toolbar.classList.remove("is-compact-sticky");
      document.body.classList.remove("compact-toolbar-active");
      placeholder.hidden = true;
      window.requestAnimationFrame(measureNormalHeight);
    }

    updateCompactDateTypeLabel(compact);
  };

  const observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    const desktop = window.matchMedia("(min-width: 621px)").matches;

    if (!desktop) {
      setCompact(false);
      return;
    }

    const passedHeader = entry.boundingClientRect.top <= 72;
    setCompact(!entry.isIntersecting && passedHeader);
  }, {
    root:null,
    threshold:0,
    rootMargin:"-72px 0px 0px 0px"
  });

  measureNormalHeight();
  observer.observe(sentinel);

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!window.matchMedia("(min-width: 621px)").matches) setCompact(false);
      measureNormalHeight();
    }, 140);
  });
}

function bindEvents() {
  $("#siteHelpBtn")?.addEventListener("click", () => {
    const panel = $("#siteHelpPanel");
    setSiteHelp(Boolean(panel?.hidden));
  });

  $("#siteHelpClose")?.addEventListener("click", () => setSiteHelp(false));
  $("#siteHelpBackdrop")?.addEventListener("click", () => setSiteHelp(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#siteHelpPanel")?.hidden) {
      setSiteHelp(false);
    }
  });

  document.addEventListener("click", async (event) => {
    const helpPanel = $("#siteHelpPanel");
    if (helpPanel && !helpPanel.hidden) {
      const insideHelp = event.target.closest("#siteHelpPanel");
      const helpButton = event.target.closest("#siteHelpBtn");
      if (!insideHelp && !helpButton && !window.matchMedia("(max-width: 620px)").matches) {
        setSiteHelp(false);
      }
    }

    const undoHistoryButton = event.target.closest("button[data-admin-history-undo]");
    if (undoHistoryButton) {
      const historyId = undoHistoryButton.dataset.adminHistoryUndo || "";
      const title = undoHistoryButton.dataset.adminHistoryTitle || "해당 영상";
      const summary = undoHistoryButton.dataset.adminHistorySummary || "이 변경을 이전 상태로 되돌립니다.";

      if (!historyId) return;

      const ok = window.confirm(`${title}\n\n${summary}\n\n되돌리기를 실행할까요?`);
      if (!ok) return;

      const historyStatus = $("#adminHistoryStatus");
      undoHistoryButton.disabled = true;
      setAdminStatus(historyStatus, "이전 상태로 되돌리는 중입니다…", "loading");

      try {
        const data = await adminApi("/undo-admin-history", {
          method: "POST",
          body: JSON.stringify({ historyId })
        });

        if (data.video) {
          const normalized = normalizeVideo(data.video);
          const index = videos.findIndex(v => String(v.id) === String(normalized.id));
          if (index >= 0) videos[index] = normalized;
          else videos.push(normalized);
          render();
        }

        adminHistoryLoaded = false;
        await loadAdminHistory({ force:true });
        setAdminStatus(historyStatus, "변경을 이전 상태로 되돌렸습니다.", "success");
      } catch (err) {
        setAdminStatus(historyStatus, err.message, "error");
        undoHistoryButton.disabled = false;
      }
      return;
    }

    const emptyAction = event.target.closest("button[data-empty-action]");
    if (emptyAction) {
      const action = emptyAction.dataset.emptyAction || "";

      if (action === "clear-search") {
        $("#searchInput").value = "";
        hideSearchSuggestions();
        updateSearchClearButton();
      } else if (action === "clear-year") {
        $("#yearFilter").value = "";
      } else if (action === "clear-type") {
        $("#typeFilter").value = "";
      } else if (action === "clear-content") {
        $("#contentTypeFilter").value = "";
      } else if (action === "clear-format") {
        $("#videoFormatFilter").value = "";
      } else if (action === "reset-all") {
        resetPublicFilters();
        return;
      }

      visibleLimit = PAGE_SIZE;
      syncUrlState();
      render();
      return;
    }

    const dateToggle = event.target.closest("button[data-date-toggle]");
    if (dateToggle) {
      const key = dateToggle.dataset.dateToggle;
      const extras = [...document.querySelectorAll(`[data-date-group="${CSS.escape(key)}"]`)];
      const opening = extras.some(el => el.hidden);

      extras.forEach(el => el.hidden = !opening);

      const datesWrap = dateToggle.closest(".dates");
      datesWrap?.classList.toggle("is-date-expanded", opening);

      const toggles = [...document.querySelectorAll(`button[data-date-toggle="${CSS.escape(key)}"]`)];
      toggles.forEach(btn => {
        const count = btn.dataset.moreCount || "";

        btn.setAttribute("aria-expanded", opening ? "true" : "false");

        if (btn.classList.contains("date-mobile-toggle")) {
          btn.textContent = opening ? "−" : `+${count}`;
          btn.setAttribute(
            "aria-label",
            opening ? "날짜 접기" : `날짜 ${count}개 더보기`
          );
        } else {
          btn.textContent = opening
            ? "날짜 접기"
            : `날짜 ${count}개 더보기`;
        }
      });

      return;
    }

    const filterChip = event.target.closest("button[data-clear-filter]");
    if (filterChip) {
      clearOneFilter(filterChip.dataset.clearFilter || "");
      return;
    }

    const acceptDescriptionDate = event.target.closest("button[data-accept-description-date]");
    if (acceptDescriptionDate) {
      const videoId = acceptDescriptionDate.dataset.acceptDescriptionDate || "";
      const status = document.querySelector(`[data-candidate-status="${CSS.escape(videoId)}"]`);
      acceptDescriptionDate.disabled = true;
      if (status) status.textContent = "새 설명 날짜 적용 중…";

      try {
        adminHistoryLoaded = false;
        await adminApi("/accept-description-date", {
          method: "POST",
          body: JSON.stringify({ videoId })
        });

        const v = videos.find(x => x.id === videoId);
        if (v) {
          v.manualDateReviewPending = false;
          v.descriptionChangedAfterManual = false;
          v.previousManualDates = [];
        }
        render();
        if (status) status.textContent = "새 설명 날짜를 기준으로 사용합니다.";
      } catch (err) {
        acceptDescriptionDate.disabled = false;
        if (status) status.textContent = err.message;
      }
      return;
    }

    const manualDateApply = event.target.closest("button[data-manual-date-apply]");
    if (manualDateApply) {
      const videoId = manualDateApply.dataset.manualDateApply || "";
      const input = document.querySelector(`[data-manual-date-input="${CSS.escape(videoId)}"]`);
      const status = document.querySelector(`[data-candidate-status="${CSS.escape(videoId)}"]`);
      const parsedList = parseManualDateList(input?.value || "");

      if (!parsedList || !parsedList.length) {
        if (status) status.textContent = "형식을 확인해 주세요: 2007 / 2007, 2006 / 2007.05 / 2007.05.21";
        input?.focus();
        return;
      }

      manualDateApply.disabled = true;
      const displayText = parsedList.map(x => x.display).join(", ");
      if (status) status.textContent = `${displayText} 적용 중…`;

      try {
        adminHistoryLoaded = false;
        await adminApi("/apply-date-overrides", {
          method: "POST",
          body: JSON.stringify({
            videoId,
            dates: parsedList.map(x => ({
              sourceDate: x.sourceDate,
              precision: x.precision
            }))
          })
        });

        const v = videos.find(x => x.id === videoId);
        if (v) {
          const additions = parsedList.map(parsed => ({
            sourceDate: parsed.sourceDate,
            source: "admin",
            precision: parsed.precision,
            inferred: parsed.precision !== "day",
            manual: true
          }));
          v.dates = mergeDateEntries(v.dates, additions);
          const years = [...new Set(v.dates.map(d => d.sourceDate.slice(0,4)))];
          v.type = years.length > 1 ? "mixed" : "single";
          v.sortDate = [...v.dates.map(d => d.sourceDate)].sort().reverse()[0] || "";
          v.parseStatus = "parsed";
          v.dateCandidates = [];
          v.manualDateReviewPending = false;
          v.descriptionChangedAfterManual = false;
          v.previousManualDates = [];
        }
        render();
        if (status) status.textContent = `${displayText} 적용 완료 · ${parsedList.length > 1 ? "혼합 연도 분류 반영" : "배포 후 전체 사이트에 반영"}`;
      } catch (err) {
        manualDateApply.disabled = false;
        if (status) status.textContent = err.message;
      }
      return;
    }

    const playlistScopeBtn = event.target.closest("button[data-playlist-scope]");
    if (playlistScopeBtn) {
      const videoId = playlistScopeBtn.dataset.playlistScope || "";
      const playlistScope = playlistScopeBtn.dataset.playlistScopeValue || "";
      playlistScopeBtn.disabled = true;

      try {
        adminHistoryLoaded = false;
        await adminApi("/set-playlist-scope", {
          method: "POST",
          body: JSON.stringify({ videoId, playlistScope })
        });
        const v = videos.find(x => x.id === videoId);
        if (v) v.playlistScope = playlistScope;
        render();
        renderAdminContentList();
      } catch (err) {
        playlistScopeBtn.disabled = false;
        alert(err.message);
      }
      return;
    }

    const formatPreviewMoreBtn = event.target.closest("button[data-format-preview-more]");
    if (formatPreviewMoreBtn) {
      const key = formatPreviewMoreBtn.dataset.formatPreviewMore || "";
      if (Object.prototype.hasOwnProperty.call(adminVideoFormatSampleLimits, key)) {
        adminVideoFormatSampleLimits[key] += 12;
        renderVideoFormatPreview(adminVideoFormatPreviewResults);
      }
      return;
    }

    const applyVideoFormatPreviewBtn = event.target.closest("#adminApplyVideoFormatPreview");
    if (applyVideoFormatPreviewBtn) {
      await applyVideoFormatPreview();
      return;
    }

    const clearVideoFormatPreviewBtn = event.target.closest("#adminClearVideoFormatPreview");
    if (clearVideoFormatPreviewBtn) {
      adminVideoFormatPreviewResults = [];
      const preview = $("#adminVideoFormatPreview");
      if (preview) {
        preview.hidden = true;
        preview.innerHTML = "";
      }
      setAdminStatus($("#adminVideoFormatVerifyStatus"), "미리보기를 닫았습니다.", "");
      return;
    }

    const videoFormatConfirmBtn = event.target.closest("button[data-video-format-confirm]");
    if (videoFormatConfirmBtn) {
      const videoId = videoFormatConfirmBtn.dataset.videoFormatConfirm || "";
      videoFormatConfirmBtn.disabled = true;

      try {
        adminHistoryLoaded = false;
        const currentVideo = videos.find(x => x.id === videoId);
        const currentFormat = currentVideo?.videoFormat === "shorts" ? "shorts" : "standard";

        const data = await adminApi("/confirm-video-format", {
          method: "POST",
          body: JSON.stringify({ videoId, videoFormat: currentFormat })
        });

        const v = videos.find(x => x.id === videoId);
        removeVideoFormatProbeCache([videoId]);
        if (v) {
          v.videoFormat = data.videoFormat === "shorts" ? "shorts" : "standard";
          v.videoFormatSource = "confirmed";
          v.videoFormatConfidence = "";
          v.videoFormatReason = data.videoFormatReason || "관리자가 자동 판별 결과를 확인했습니다.";
        }

        render();
        renderAdminContentList();
      } catch (err) {
        videoFormatConfirmBtn.disabled = false;
        alert(err.message);
      }
      return;
    }

    const videoFormatBtn = event.target.closest("button[data-video-format]");
    if (videoFormatBtn) {
      const videoId = videoFormatBtn.dataset.videoFormat || "";
      const videoFormat = videoFormatBtn.dataset.videoFormatValue || "standard";
      videoFormatBtn.disabled = true;

      try {
        adminHistoryLoaded = false;
        const data = await adminApi("/set-video-format", {
          method: "POST",
          body: JSON.stringify({ videoId, videoFormat })
        });

        const v = videos.find(x => x.id === videoId);
        removeVideoFormatProbeCache([videoId]);
        if (v) {
          v.videoFormat = data.videoFormat === "shorts" ? "shorts" : "standard";
          v.videoFormatSource = "manual";
          v.videoFormatConfidence = "";
          v.videoFormatReason = "";
        }
        render();
        renderAdminContentList();
      } catch (err) {
        videoFormatBtn.disabled = false;
        alert(err.message);
      }
      return;
    }

    const contentToggle = event.target.closest("button[data-content-type-toggle]");
    if (contentToggle) {
      const videoId = contentToggle.dataset.contentTypeToggle || "";
      const contentType = contentToggle.dataset.nextContentType || "video";
      contentToggle.disabled = true;

      try {
        adminHistoryLoaded = false;
        await adminApi("/set-content-type", {
          method: "POST",
          body: JSON.stringify({ videoId, contentType })
        });
        const v = videos.find(x => x.id === videoId);
        if (v) {
          v.contentType = contentType === "playlist" ? "playlist" : "video";
          if (v.contentType === "playlist" && !v.playlistScope && !(v.dates || []).length) {
            v.playlistScope = "undated";
          }
          if (v.contentType !== "playlist") v.playlistScope = "";
        }
        render();
      } catch (err) {
        contentToggle.disabled = false;
        alert(err.message);
      }
      return;
    }

    const candidateApply = event.target.closest("button[data-candidate-apply]");
    if (candidateApply) {
      const videoId = candidateApply.dataset.candidateApply || "";
      const sourceDate = candidateApply.dataset.candidateDate || "";
      const precision = candidateApply.dataset.candidatePrecision || "month";
      const candidateKey = candidateApply.dataset.candidateKey || "";
      const status = document.querySelector(`[data-candidate-status="${CSS.escape(videoId)}"]`);

      candidateApply.disabled = true;
      if (status) status.textContent = "GitHub에 적용 중…";
      try {
        adminHistoryLoaded = false;
        await adminApi("/apply-date-override", {
          method: "POST",
          body: JSON.stringify({ videoId, sourceDate, precision, candidateKey })
        });

        const v = videos.find(x => x.id === videoId);
        if (v) {
          v.dates = mergeDateEntries(v.dates, [{
            sourceDate,
            source:"admin",
            precision,
            inferred: precision !== "day",
            manual:true
          }]);
          v.type = "single";
          v.sortDate = sourceDate;
          v.parseStatus = "parsed";
          v.dateCandidates = [];
          v.manualDateReviewPending = false;
          v.descriptionChangedAfterManual = false;
          v.previousManualDates = [];
        }
        render();
        if (status) status.textContent = "적용 완료 · 배포 후 전체 사이트에 반영";
      } catch (err) {
        candidateApply.disabled = false;
        if (status) status.textContent = err.message;
      }
      return;
    }

    const candidateIgnore = event.target.closest("button[data-candidate-ignore]");
    if (candidateIgnore) {
      const videoId = candidateIgnore.dataset.candidateIgnore || "";
      const candidateKey = candidateIgnore.dataset.candidateKey || "";
      const status = document.querySelector(`[data-candidate-status="${CSS.escape(videoId)}"]`);

      candidateIgnore.disabled = true;
      if (status) status.textContent = "후보 제외 저장 중…";
      try {
        adminHistoryLoaded = false;
        await adminApi("/ignore-date-candidate", {
          method: "POST",
          body: JSON.stringify({ videoId, candidateKey })
        });
        const v = videos.find(x => x.id === videoId);
        if (v) {
          v.ignoredDateCandidates = [...new Set([...(v.ignoredDateCandidates || []), candidateKey])];
          v.dateCandidates = extractReviewDateCandidates(
            v.title || "",
            v.description || "",
            v.ignoredDateCandidates
          );
        }
        render();
      } catch (err) {
        candidateIgnore.disabled = false;
        if (status) status.textContent = err.message;
      }
      return;
    }

    const dateContext = event.target.closest("button[data-context-date]");
    if (dateContext) {
      $("#searchInput").value = dateContext.dataset.contextDate || "";
      updateSearchClearButton();
      visibleLimit = PAGE_SIZE;
      hideSearchSuggestions();
      syncUrlState({ replace:true });
      render();
      document.querySelector(".toolbar-panel")?.scrollIntoView({ behavior:"smooth", block:"start" });
      return;
    }

    const sourceContext = event.target.closest("button[data-context-source]");
    if (sourceContext) {
      $("#searchInput").value = sourceContext.dataset.contextSource || "";
      updateSearchClearButton();
      visibleLimit = PAGE_SIZE;
      hideSearchSuggestions();
      syncUrlState({ replace:true });
      render();
      document.querySelector(".toolbar-panel")?.scrollIntoView({ behavior:"smooth", block:"start" });
      return;
    }

    const monthJump = event.target.closest("button[data-timeline-month-jump]");
    if (monthJump) {
      const id = `timeline-${monthJump.dataset.timelineMonthJump || ""}`;
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior:"smooth", block:"start" });
      }
      return;
    }

    const suggestionMore = event.target.closest("button[data-search-suggestion-more]");
    if (suggestionMore) {
      mobileSuggestionExpanded = !mobileSuggestionExpanded;
      renderSearchSuggestions();
      return;
    }

    const suggestion = event.target.closest("button[data-search-suggestion]");
    if (suggestion) {
      $("#searchInput").value = suggestion.dataset.searchSuggestion || "";
      updateSearchClearButton();
      visibleLimit = PAGE_SIZE;
      mobileSuggestionExpanded = false;
      hideSearchSuggestions();
      syncUrlState({ replace:true });
      render();
      return;
    }


    const yearJump = event.target.closest("button[data-year-jump]");
    if (yearJump) {
      const year = yearJump.dataset.yearJump || "";
      $("#yearFilter").value = year;
      visibleLimit = PAGE_SIZE;
      syncUrlState();
      render();
      window.setTimeout(() => scrollTimelineYearIntoView(year), 30);
      return;
    }

    const link = event.target.closest("a.youtube-video-link");
    if (!link) return;
    openYoutubeVideo(event, link.dataset.videoId || "");
  });

  ["searchInput", "yearFilter", "typeFilter", "contentTypeFilter", "videoFormatFilter", "sortFilter"].forEach(id => {
    $("#" + id).addEventListener(
      id === "searchInput" ? "input" : "change",
      () => {
        visibleLimit = PAGE_SIZE;
        syncUrlState({ replace: id === "searchInput" });
        render();
        if (id === "searchInput") {
          mobileSuggestionExpanded = false;
          updateSearchClearButton();
          renderSearchSuggestions();
        }
      }
    );
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 620px)").matches && mobileSuggestionExpanded) {
      mobileSuggestionExpanded = false;
      if (!$("#searchSuggestions")?.hidden) renderSearchSuggestions();
    }
  });

  document.addEventListener("click", (event) => {
    const searchField = document.querySelector(".search-field");
    const suggestions = $("#searchSuggestions");
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];

    // "더보기" re-renders #searchSuggestions during this same click event.
    // Use the event's original propagation path instead of only event.target.closest(),
    // because the clicked button may already have been detached from the DOM.
    const insideSearchField =
      (searchField && path.includes(searchField)) ||
      Boolean(event.target.closest?.(".search-field"));
    const insideSuggestions =
      (suggestions && path.includes(suggestions)) ||
      Boolean(event.target.closest?.("#searchSuggestions")) ||
      Boolean(event.target.closest?.("[data-search-suggestion-more]"));

    if (!insideSearchField && !insideSuggestions) {
      hideSearchSuggestions();
    }
  });

  $("#searchInput").addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      if (moveSearchSuggestion(1)) event.preventDefault();
      return;
    }
    if (event.key === "ArrowUp") {
      if (moveSearchSuggestion(-1)) event.preventDefault();
      return;
    }
    if (event.key === "Enter") {
      if (applyActiveSearchSuggestion()) event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      hideSearchSuggestions();
      $("#searchInput").blur();
    }
  });

  $("#resetFilters").addEventListener("click", resetPublicFilters);

  $("#clearSearchBtn")?.addEventListener("click", () => {
    $("#searchInput").value = "";
    updateSearchClearButton();
    hideSearchSuggestions();
    visibleLimit = PAGE_SIZE;
    syncUrlState({ replace:true });
    render();
    $("#searchInput").focus();
  });

  $("#loadMoreBtn").addEventListener("click", () => {
    visibleLimit += PAGE_SIZE;
    render();
  });

  $("#gridViewBtn").addEventListener("click", () => setViewMode("grid"));
  $("#listViewBtn").addEventListener("click", () => setViewMode("list"));
  $("#timelineViewBtn").addEventListener("click", () => setViewMode("timeline"));

  document.querySelectorAll("[data-admin-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.adminTab || "dashboard";
      setAdminTab(tab);
      if (tab === "content") renderAdminContentList();
      if (tab === "history") loadAdminHistory();
      if (tab === "sync") loadAdminBackups();
    });
  });

  window.addEventListener("popstate", () => {
    applyUrlStateToControls();
    visibleLimit = PAGE_SIZE;
    render();
  });

  const mobileFilterToggle = $("#mobileFilterToggle");
  const toolbarPanel = document.querySelector(".toolbar-panel");
  if (mobileFilterToggle && toolbarPanel) {
    mobileFilterToggle.addEventListener("click", () => {
      const open = !toolbarPanel.classList.contains("mobile-open");
      toolbarPanel.classList.toggle("mobile-open", open);
      mobileFilterToggle.setAttribute("aria-expanded", String(open));
    });
  }

  const isAdminPage = /\/admin\/?$/.test(location.pathname);
  const legacyAdminRequest =
    new URLSearchParams(location.search).get("admin") === "1" ||
    location.hash === "#admin";

  // Old bookmarks such as /?admin=1 now move to the dedicated admin page.
  if (legacyAdminRequest && !isAdminPage) {
    location.replace("./admin/");
    return;
  }

  if (isAdminPage) {
    const panel = $("#adminPanel");
    const main = document.querySelector("main.container");

    if (panel && main && main.firstElementChild !== panel) {
      main.prepend(panel);
    }

    setAdmin(true, { auto:true });
  }

  $("#adminEntry")?.addEventListener("click", () => {
    location.href = "./admin/";
  });
  $("#closeAdmin")?.addEventListener("click", () => {
    if (isAdminPage) location.href = "./";
    else setAdmin(false);
  });


  $("#adminVerifyVideoFormats5")?.addEventListener("click", () => runVideoFormatDiagnostic(5, 1));
  $("#adminVerifyVideoFormats20")?.addEventListener("click", () => runVideoFormatDiagnostic(20, 2));
  $("#adminVerifyVideoFormatsAll")?.addEventListener("click", previewAllPendingVideoFormats);

  const adminContentSearch = $("#adminContentSearch");
  if (adminContentSearch) {
    adminContentSearch.addEventListener("input", () => {
      adminContentVisibleLimit = 30;
      renderAdminContentList();
    });
  }

  $("#adminContentMode")?.addEventListener("change", (event) => {
    adminContentMode = event.target.value || "all";
    adminContentVisibleLimit = 30;
    renderAdminContentList();
  });

  $("#adminContentLoadMore")?.addEventListener("click", () => {
    adminContentVisibleLimit += 30;
    renderAdminContentList();
  });

  document.addEventListener("click", (event) => {
    const dashboardAction = event.target.closest("[data-dashboard-route]");
    if (dashboardAction) {
      routeAdminAction(dashboardAction.dataset.dashboardRoute || "");
      return;
    }

    const healthFilter = event.target.closest("[data-health-filter]");
    if (healthFilter) {
      adminHealthFilter = healthFilter.dataset.healthFilter || "all";
      renderAdminDashboard();
      return;
    }

    const healthRoute = event.target.closest("[data-health-route]");
    if (healthRoute) {
      routeAdminAction(healthRoute.dataset.healthRoute || "", {
        videoId: healthRoute.dataset.healthVideoId || "",
        healthType: healthRoute.dataset.healthType || ""
      });
      return;
    }

    const restoreButton = event.target.closest("[data-backup-restore]");
    if (restoreButton) {
      const backupId = restoreButton.dataset.backupRestore || "";
      if (!backupId) return;

      const ok = window.confirm("선택한 복원 지점으로 videos.json을 되돌립니다.\n\n현재 상태도 복원 직전에 자동 백업됩니다. 계속할까요?");
      if (!ok) return;

      const status = $("#adminBackupStatus");
      restoreButton.disabled = true;
      setAdminStatus(status, "복원 중입니다…", "loading");

      (async () => {
        try {
          await adminApi("/restore-admin-backup", {
            method:"POST",
            body: JSON.stringify({ backupId })
          });
          adminHistoryLoaded = false;
          adminBackupsLoaded = false;
          setAdminStatus(status, "복원 완료. 최신 데이터를 다시 불러옵니다…", "success");
          window.setTimeout(() => location.reload(), 500);
        } catch (err) {
          restoreButton.disabled = false;
          setAdminStatus(status, err.message, "error");
        }
      })();
      return;
    }
  });

  $("#createAdminBackup")?.addEventListener("click", async () => {
    const button = $("#createAdminBackup");
    const status = $("#adminBackupStatus");
    button.disabled = true;
    setAdminStatus(status, "현재 상태를 백업하는 중입니다…", "loading");
    try {
      await adminApi("/create-admin-backup", {
        method:"POST",
        body: JSON.stringify({ reason:"manual" })
      });
      adminBackupsLoaded = false;
      await loadAdminBackups({ force:true });
      setAdminStatus(status, "복원 지점을 만들었습니다.", "success");
    } catch (err) {
      setAdminStatus(status, err.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  document.querySelectorAll("[data-review-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      adminReviewFilter = btn.dataset.reviewFilter || "all";
      renderAdminUnknownList();
    });
  });

  $("#adminReviewSort")?.addEventListener("change", (event) => {
    adminReviewSort = event.target.value || "priority";
    renderAdminUnknownList();
  });

  $("#refreshAdminHealth")?.addEventListener("click", () => {
    adminHealthFilter = "all";
    renderAdminDashboard();
  });

  $("#refreshAdminHistory")?.addEventListener("click", () => loadAdminHistory({ force:true }));

  const backToTopBtn = $("#backToTopBtn");
  const updateBackToTop = () => {
    if (!backToTopBtn) return;
    backToTopBtn.hidden = window.scrollY < 700 || document.body.classList.contains("admin-mode-open");
  };
  window.addEventListener("scroll", updateBackToTop, { passive:true });
  backToTopBtn?.addEventListener("click", () => {
    window.scrollTo({ top:0, behavior:"smooth" });
  });
  updateBackToTop();
  setupCompactStickyToolbar();
  updateSearchClearButton();

  const savedAdminToken = sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || "";
  if ($("#adminTokenInput") && savedAdminToken) {
    $("#adminTokenInput").value = savedAdminToken;
  }

  $("#saveAdminToken")?.addEventListener("click", async () => {
    const token = $("#adminTokenInput")?.value?.trim() || "";
    if (!token) {
      setAdminStatus($("#adminApiStatus"), "ADMIN_TOKEN을 입력해 주세요.", "error");
      return;
    }

    const button = $("#saveAdminToken");
    button.disabled = true;
    try {
      await verifyAdminToken();
    } finally {
      button.disabled = false;
    }
  });

  $("#adminTokenInput")?.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    $("#saveAdminToken")?.click();
  });

  $("#adminLogoutBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem(ADMIN_TOKEN_SESSION_KEY);
    if ($("#adminTokenInput")) $("#adminTokenInput").value = "";
    adminHistoryLoaded = false;
    adminBackupsLoaded = false;
    setAdminAuthenticated(false);
    setAdminStatus($("#adminApiStatus"), "로그아웃되었습니다.", "success");
    window.scrollTo({ top:0, behavior:"smooth" });
  });

  if (document.body.classList.contains("admin-page")) {
    setAdminAuthenticated(false);
    if (savedAdminToken) {
      verifyAdminToken({ silent:true });
    }
  }

  let pendingFaviconDataUrl = "";

  $("#faviconInput")?.addEventListener("change", () => {
    const file = $("#faviconInput").files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      setAdminStatus($("#siteSettingsStatus"), "파비콘은 200KB 이하를 권장합니다.", "error");
      $("#faviconInput").value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      pendingFaviconDataUrl = String(reader.result || "");
      renderFaviconPreview(pendingFaviconDataUrl);
    };
    reader.readAsDataURL(file);
  });

  $("#saveSiteSettings")?.addEventListener("click", async () => {
    const status = $("#siteSettingsStatus");
    const title = $("#titleInput").value.trim();
    const channelHandle = $("#channelHandleInput").value.trim() || "@pilsae";

    if (!getAdminToken()) {
      setAdminStatus(status, "먼저 ADMIN_TOKEN을 입력하고 '이 세션에서 사용'을 눌러 주세요.", "error");
      return;
    }

    setAdminStatus(status, "GitHub에 사이트 설정을 저장하는 중입니다…", "loading");

    try {
      const data = adminHistoryLoaded = false;
      await adminApi("/update-site-config", {
        method: "POST",
        body: JSON.stringify({
          title,
          channelHandle,
          faviconDataUrl: pendingFaviconDataUrl || siteConfig.faviconDataUrl || "",
          adminApiUrl: siteConfig.adminApiUrl
        })
      });

      siteConfig = { ...siteConfig, ...data.config };
      pendingFaviconDataUrl = "";
      applySiteConfig();
      setAdminStatus(
        status,
        "저장 완료. GitHub commit 후 Cloudflare가 새 배포를 시작합니다.",
        "success"
      );
    } catch (err) {
      setAdminStatus(status, err.message, "error");
    }
  });

  $("#previewYoutubeSync")?.addEventListener("click", async () => {
    const button = $("#previewYoutubeSync");
    const status = $("#syncStatus");

    if (!getAdminToken()) {
      setAdminStatus(status, "먼저 ADMIN_TOKEN을 입력하고 '이 세션에서 사용'을 눌러 주세요.", "error");
      return;
    }

    button.disabled = true;
    resetSyncPreview();
    setAdminStatus(status, "YouTube 최신 상태와 현재 데이터를 비교하는 중입니다…", "loading");

    try {
      const data = await adminApi("/sync-videos", {
        method: "POST",
        body: JSON.stringify({ previewOnly:true })
      });

      renderSyncPreview(data);
      const changed = Number(data.added || 0) + Number(data.titleChanged || 0) +
        Number(data.descriptionChanged || 0) + Number(data.removed || 0);

      setAdminStatus(
        status,
        changed
          ? `미리보기 완료 · 변경 대상 ${changed}건. 내용을 확인한 뒤 '변경사항 적용'을 눌러 주세요.`
          : "미리보기 완료 · 현재 YouTube와 동일하여 적용할 변경사항이 없습니다.",
        changed ? "success" : "success"
      );

      if (!changed && $("#syncYoutubeVideos")) $("#syncYoutubeVideos").disabled = true;
    } catch (err) {
      setAdminStatus(status, err.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  $("#syncYoutubeVideos")?.addEventListener("click", async () => {
    const button = $("#syncYoutubeVideos");
    const status = $("#syncStatus");

    if (!getAdminToken()) {
      setAdminStatus(status, "먼저 ADMIN_TOKEN을 입력하고 '이 세션에서 사용'을 눌러 주세요.", "error");
      return;
    }

    if (!lastSyncPreview) {
      setAdminStatus(status, "먼저 변경사항 미리보기를 실행해 주세요.", "error");
      return;
    }

    button.disabled = true;
    setAdminStatus(
      status,
      "확인한 변경사항을 GitHub videos.json에 적용하는 중입니다. 잠시 기다려 주세요…",
      "loading"
    );

    try {
      adminHistoryLoaded = false;
      const data = await adminApi("/sync-videos", {
        method: "POST",
        body: JSON.stringify({ previewOnly:false })
      });

      setAdminStatus(
        status,
        `업데이트 완료 · ${data.total}개 영상 · 채널 프로필/헤더 이미지 동기화 포함. Cloudflare 새 배포가 완료되면 새로고침해 주세요.`,
        "success"
      );
      resetSyncPreview();
    } catch (err) {
      setAdminStatus(status, err.message, "error");
      button.disabled = false;
    }
  });

  $("#exportData")?.addEventListener("click", () => {
    downloadJSON(
      {
        videos: videos.map(v => ({
          id: v.id,
          title: v.title,
          description: v.description,
          source: v.source,
          sourceDate: v.sourceDate || null,
          publishedAt: v.publishedAt,
          thumbnail: v.thumbnail,
          parseStatus: v.type === "unknown" ? "needs_review" : "parsed",
          dates: v.dates.map(d => ({
            sourceDate: d.sourceDate,
            source: "",
            precision: d.precision || "day",
            inferred: Boolean(d.inferred),
            manual: Boolean(d.manual)
          })),
          ignoredDateCandidates: v.ignoredDateCandidates || []
        })),
        total: videos.length
      },
      "videos.json"
    );
  });

}

(async function init() {
  await loadSiteConfig();
  applySiteConfig();
  loadLiveChannelBranding();
  $("#emptyState").hidden = true;

  try {
    await loadInitialData();
    rebuildYearFilter();
    applyUrlStateToControls();
    bindEvents();
    syncUrlState({ replace: true });
    render();
  } catch (err) {
    console.error(err);
    $("#loadingState")?.setAttribute("hidden", "");
    $("#resultMeta").textContent = "영상 목록을 불러오지 못했습니다.";
    $("#emptyState").hidden = false;
    $("#emptyState").innerHTML =
      `<strong>데이터를 불러오지 못했습니다.</strong><p>잠시 후 새로고침해 주세요.</p>`;
  }

  if (location.hash === "#admin" && $("#adminPanel")) setAdmin(true);
})();
