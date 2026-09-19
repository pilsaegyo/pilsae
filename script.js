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
  if (v.playlistScope === "multi-year") return true;
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
    dateCandidates: validDates.length ? [] : extractReviewDateCandidates(
      v.title || "",
      v.description || "",
      v.ignoredDateCandidates || []
    ),
    type,
    sortDate,
    url: youtubeUrlFromId(v.id)
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
  $("#mainTitle").textContent = title;
  document.title = `${title} | 필새 영상 아카이브`;

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
  if (inputValue) {
    sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, inputValue);
    return inputValue;
  }
  return sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || "";
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

function updateAdminSummary() {
  const total = videos.length;
  const review = videos.filter(v =>
    v.contentType !== "playlist" &&
    (v.type === "unknown" || v.manualDateReviewPending)
  ).length;
  const parsed = total - review;

  if ($("#adminCurrentTotal")) $("#adminCurrentTotal").textContent = `${total}개`;
  if ($("#adminParsedTotal")) $("#adminParsedTotal").textContent = `${parsed}개`;
  if ($("#adminReviewTotal")) $("#adminReviewTotal").textContent = `${review}개`;
}

function allYears() {
  const years = new Set();
  videos.forEach(v => v.dates.forEach(d => {
    const m = String(d.sourceDate || "").match(/\b(19|20)\d{2}\b/);
    if (m) years.add(m[0]);
  }));
  return [...years].sort((a,b) => Number(b) - Number(a));
}

function yearVideoCounts() {
  const counts = new Map();
  videos.forEach(v => {
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
  const current = select.value;

  const counts = new Map();
  videos.forEach(v => {
    const years = new Set(
      v.dates
        .map(d => String(d.sourceDate || "").slice(0,4))
        .filter(y => /^(19|20)\d{2}$/.test(y))
    );
    years.forEach(y => counts.set(y, (counts.get(y) || 0) + 1));
  });

  select.innerHTML = `<option value="">전체 연도</option>` +
    [...counts.keys()]
      .sort((a,b) => Number(b) - Number(a))
      .map(y => `<option value="${y}">${y} (${counts.get(y)})</option>`)
      .join("");

  if ([...select.options].some(o => o.value === current)) select.value = current;
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
  const isMobile = window.matchMedia("(max-width: 620px)").matches;
  const dateLimit = isMobile ? 2 : 3;
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

  return summary +
    visible.join("") +
    hidden.map(html => `<span class="date-extra" data-date-group="${key}" hidden>${html}</span>`).join("") +
    (hidden.length
      ? `<button class="date-more-btn" type="button" data-date-toggle="${key}" data-more-count="${hidden.length}">날짜 ${hidden.length}개 더보기</button>`
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
    { label: "설명", text: v.description || "" },
    { label: "출처", text: v.source || "" }
  ];

  const qLower = q.toLowerCase();
  for (const candidate of candidates) {
    const normalized = String(candidate.text || "").replace(/\s+/g, " ").trim();
    const idx = normalized.toLowerCase().indexOf(qLower);
    if (idx === -1) continue;

    const radius = 52;
    const start = Math.max(0, idx - radius);
    const end = Math.min(normalized.length, idx + q.length + radius);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < normalized.length ? "…" : "";
    const snippet = normalized.slice(start, end);
    return `<p class="search-match"><span>${candidate.label}</span>${prefix}${highlightMatch(snippet, q)}${suffix}</p>`;
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
    .slice(0, 6);
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
    input.setAttribute("aria-expanded", "false");
    return;
  }

  wrap.innerHTML = items.map((item, index) => `
    <button type="button" class="search-suggestion-item" role="option"
      data-search-suggestion="${escapeHTML(item.value)}" data-suggestion-index="${index}">
      <span class="search-suggestion-kind">${escapeHTML(item.kind)}</span>
      <span class="search-suggestion-copy">
        <strong>${highlightMatch(item.label, q)}</strong>
        ${item.meta ? `<small>${escapeHTML(item.meta)}</small>` : ""}
      </span>
    </button>
  `).join("");

  wrap.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function hideSearchSuggestions() {
  const wrap = $("#searchSuggestions");
  const input = $("#searchInput");
  if (wrap) {
    wrap.hidden = true;
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
  $("#sortFilter").value = "source-desc";
  hideSearchSuggestions();
  updateSearchClearButton();
  visibleLimit = PAGE_SIZE;
  syncUrlState();
  render();

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
      </a>
      <div class="card-body">
        <div class="card-meta-row">
          <div class="dates">${renderDates(v)}</div>
          ${statusBadge ? `<div class="card-badges">${statusBadge}</div>` : ""}
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

function filteredVideos() {
  const q = $("#searchInput").value.trim().toLowerCase();
  const year = $("#yearFilter").value;
  const type = $("#typeFilter").value;
  const contentType = $("#contentTypeFilter")?.value || "";
  const sortMode = $("#sortFilter")?.value || "source-desc";

  const rows = videos.filter(v => {
    const searchableDates = v.dates.flatMap(d => [
      d.sourceDate,
      d.source,
      displayDate(d)
    ]);

    const haystack = [
      v.title,
      v.description,
      v.source,
      v.parseStatus,
      contentTypeLabel(v.contentType),
      isMultiYearPlaylist(v) ? "다년도 플레이리스트 혼합 연도" : "",
      ...searchableDates
    ].join(" ").toLowerCase();

    const qok = !q || haystack.includes(q);
    const yok = !year || v.dates.some(d => String(d.sourceDate || "").startsWith(year));
    const tok = !type || effectiveDateType(v) === type;
    const cok = !contentType || v.contentType === contentType;

    return qok && yok && tok && cok;
  });

  const sourceCompare = (a,b) => {
    const ad = a.sortDate || "";
    const bd = b.sortDate || "";
    if (!ad && !bd) return 0;
    if (!ad) return 1;
    if (!bd) return -1;
    return bd.localeCompare(ad);
  };

  rows.sort((a,b) => {
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
  const sort = $("#sortFilter")?.value || "source-desc";
  const view = ["grid", "list", "timeline"].includes(viewOverride)
    ? viewOverride
    : currentView();

  if (q) params.set("q", q);
  if (year) params.set("year", year);
  if (type) params.set("type", type);
  if (content) params.set("content", content);
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
  const sort = $("#sortFilter")?.value || "source-desc";

  if (q) filters.push({ key:"search", label:`검색: ${q}` });
  if (year) filters.push({ key:"year", label:`${year}년` });
  if (type) filters.push({ key:"type", label:typeLabel(type) });
  if (content) filters.push({ key:"content", label:contentTypeLabel(content) });
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
  const extraCount = Math.max(0, (v.dates || []).filter(d => d?.sourceDate).length - 1);
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

  return `
    <article class="timeline-item ${escapeHTML(bucket.kind)}">
      <a class="timeline-thumb youtube-video-link" data-video-id="${escapeHTML(v.id)}" href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">
        ${v.thumbnail ? `<img src="${escapeHTML(v.thumbnail)}" alt="" loading="lazy" />` : ""}
      </a>
      <div class="timeline-item-body">
        <div class="timeline-item-date">
          ${escapeHTML(timelineDateLabel(primary))}
          ${extraCount ? `<span>외 ${extraCount}개 날짜</span>` : ""}
          ${precisionBadge}
        </div>
        <a class="timeline-title youtube-video-link" data-video-id="${escapeHTML(v.id)}" href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(v.title)}</a>
        ${v.type === "mixed" ? `<div class="timeline-years">${videoYears(v).map(escapeHTML).join(" · ")}</div>` : ""}
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

  const years = allYears();
  const counts = yearVideoCounts();
  const current = $("#yearFilter")?.value || "";
  bar.innerHTML = `
    <button type="button" class="year-jump-chip ${current ? "" : "active"}" data-year-jump="">
      <span>전체</span><small>${videos.length}</small>
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

function render() {
  $("#loadingState")?.setAttribute("hidden", "");

  $("#videoCount").textContent = `${videos.length}개`;

  const allUnknown = videos.filter(v => v.type === "unknown").length;
  const allKnown = videos.length - allUnknown;
  if ($("#heroTotal")) $("#heroTotal").textContent = `${videos.length}`;
  if ($("#heroKnown")) $("#heroKnown").textContent = `${allKnown}`;
  if ($("#heroUnknown")) $("#heroUnknown").textContent = `${allUnknown}`;

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
        ? `${active.map(x => x.label).join(" · ")} 조건에서는 결과가 없습니다.`
        : "검색어나 필터를 변경해 보세요.";
    }
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

function adminReviewItemHtml(v, {playlistUndated=false}={}) {
  return `
    <article class="admin-unknown-item">
      <div class="admin-unknown-thumb">
        ${v.thumbnail ? `<img src="${escapeHTML(v.thumbnail)}" alt="" loading="lazy" />` : ""}
      </div>
      <div class="admin-unknown-body">
        <div class="admin-unknown-top">
          <strong>${escapeHTML(v.title)}</strong>
          <div class="admin-review-badges">
            ${v.contentType === "playlist" ? `<span class="admin-content-badge playlist">플레이리스트</span>` : ""}
            <span class="admin-reason-badge">${escapeHTML(playlistUndated ? "연도 미지정" : unknownReason(v))}</span>
          </div>
        </div>
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

  const unknown = videos.filter(v =>
    v.contentType !== "playlist" &&
    (v.type === "unknown" || v.manualDateReviewPending)
  );
  const ordinaryUnknown = unknown.filter(v => !v.manualDateReviewPending);
  const descriptionChanges = unknown.filter(v => v.manualDateReviewPending);

  const undatedPlaylists = videos.filter(v =>
    v.contentType === "playlist" &&
    !isMultiYearPlaylist(v) &&
    (v.type === "unknown" || v.manualDateReviewPending)
  );

  if (badge) badge.textContent = `${unknown.length}개`;
  if (playlistBadge) playlistBadge.textContent = `${undatedPlaylists.length}개`;

  const unknownCountEl = $("#adminReviewUnknownCount");
  const descChangeEl = $("#adminDescriptionChangeCount");
  const completeEl = $("#adminReviewComplete");

  if (unknownCountEl) unknownCountEl.textContent = String(ordinaryUnknown.length);
  if (descChangeEl) descChangeEl.textContent = String(descriptionChanges.length);
  if (completeEl) completeEl.hidden = unknown.length !== 0;

  const tabCount = $("#adminReviewTabCount");
  if (tabCount) tabCount.textContent = String(unknown.length);

  wrap.innerHTML = unknown.length
    ? unknown.map(v => adminReviewItemHtml(v)).join("")
    : `<div class="admin-empty-complete"><span>✓</span><div><strong>정리 완료</strong><p>현재 날짜 확인이 필요한 일반 영상이 없습니다.</p></div></div>`;

  if (playlistWrap) {
    playlistWrap.innerHTML = undatedPlaylists.length
      ? undatedPlaylists.map(v => adminReviewItemHtml(v, {playlistUndated:true})).join("")
      : `<p class="admin-help">현재 연도 미지정 플레이리스트가 없습니다.</p>`;
  }

  renderAdminContentList();
}

function renderAdminContentList() {
  const wrap = $("#adminContentList");
  if (!wrap) return;

  const q = ($("#adminContentSearch")?.value || "").trim().toLowerCase();

  // Keep already-classified playlists visible for management.
  // For new playlist candidates, only surface videos 6 minutes or longer.
  let rows = videos.filter(v =>
    v.contentType === "playlist" ||
    Number(v.durationSeconds || 0) >= 360
  );

  if (q) {
    rows = rows.filter(v => `${v.title} ${v.description}`.toLowerCase().includes(q));
  } else {
    rows = rows
      .sort((a,b) => {
        if (a.contentType === "playlist" && b.contentType !== "playlist") return -1;
        if (a.contentType !== "playlist" && b.contentType === "playlist") return 1;
        return Number(b.durationSeconds || 0) - Number(a.durationSeconds || 0);
      })
      .slice(0, 30);
  }

  if (q) rows = rows.slice(0, 50);

  if (!rows.length) {
    wrap.innerHTML = `<p class="admin-help">6분 이상 영상 또는 기존 플레이리스트 중 검색 결과가 없습니다.</p>`;
    return;
  }

  wrap.innerHTML = rows.map(v => `
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
      </div>
    </div>
  `).join("");
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

    // When entering through ?admin=1, keep the clean query URL and show
    // the admin workspace at the top instead of making the user scroll.
    if (!queryAdmin && location.hash !== "#admin") {
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

function bindEvents() {
  document.addEventListener("click", async (event) => {
    const dateToggle = event.target.closest("button[data-date-toggle]");
    if (dateToggle) {
      const key = dateToggle.dataset.dateToggle;
      const extras = [...document.querySelectorAll(`[data-date-group="${CSS.escape(key)}"]`)];
      const opening = extras.some(el => el.hidden);
      extras.forEach(el => el.hidden = !opening);
      dateToggle.textContent = opening ? "날짜 접기" : `날짜 ${dateToggle.dataset.moreCount}개 더보기`;
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

    const contentToggle = event.target.closest("button[data-content-type-toggle]");
    if (contentToggle) {
      const videoId = contentToggle.dataset.contentTypeToggle || "";
      const contentType = contentToggle.dataset.nextContentType || "video";
      contentToggle.disabled = true;

      try {
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

    const suggestion = event.target.closest("button[data-search-suggestion]");
    if (suggestion) {
      $("#searchInput").value = suggestion.dataset.searchSuggestion || "";
      updateSearchClearButton();
      visibleLimit = PAGE_SIZE;
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

  ["searchInput", "yearFilter", "typeFilter", "contentTypeFilter", "sortFilter"].forEach(id => {
    $("#" + id).addEventListener(
      id === "searchInput" ? "input" : "change",
      () => {
        visibleLimit = PAGE_SIZE;
        syncUrlState({ replace: id === "searchInput" });
        render();
        if (id === "searchInput") {
          updateSearchClearButton();
          renderSearchSuggestions();
        }
      }
    );
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-field")) hideSearchSuggestions();
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
  $("#emptyResetBtn")?.addEventListener("click", resetPublicFilters);

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
      const tab = btn.dataset.adminTab || "sync";
      setAdminTab(tab);
      if (tab === "content") renderAdminContentList();
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

  const adminAllowed =
    new URLSearchParams(location.search).get("admin") === "1" ||
    location.hash === "#admin";

  if (adminAllowed) {
    const panel = $("#adminPanel");
    const main = document.querySelector("main.container");

    // Put the admin workspace at the very top in admin mode.
    if (panel && main && main.firstElementChild !== panel) {
      main.prepend(panel);
    }

    $("#adminEntry").hidden = false;
    setAdmin(true, { auto:true });
  }

  $("#adminEntry").addEventListener("click", () => {
    const panel = $("#adminPanel");
    const main = document.querySelector("main.container");
    if (panel && main && main.firstElementChild !== panel) {
      main.prepend(panel);
    }
    setAdmin(true);
  });
  $("#closeAdmin").addEventListener("click", () => setAdmin(false));


  const adminContentSearch = $("#adminContentSearch");
  if (adminContentSearch) {
    adminContentSearch.addEventListener("input", renderAdminContentList);
  }

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
  updateSearchClearButton();

  const savedAdminToken = getAdminToken();
  if ($("#adminTokenInput") && savedAdminToken) {
    $("#adminTokenInput").value = savedAdminToken;
  }

  $("#saveAdminToken").addEventListener("click", () => {
    const token = $("#adminTokenInput").value.trim();
    if (!token) {
      setAdminStatus($("#adminApiStatus"), "ADMIN_TOKEN을 입력해 주세요.", "error");
      return;
    }
    sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, token);
    setAdminStatus($("#adminApiStatus"), "관리자 토큰이 적용되었습니다.", "success");
  });

  $("#checkAdminApi").addEventListener("click", async () => {
    const status = $("#adminApiStatus");
    setAdminStatus(status, "Worker 연결을 확인하는 중입니다…", "loading");
    try {
      const data = await adminApi("/health", { method: "GET" });
      const ok = data.youtubeConfigured && data.githubConfigured && data.adminConfigured;
      setAdminStatus(
        status,
        ok
          ? `연결 정상 · ${data.repo} · ${data.handle}`
          : "Worker는 연결됐지만 필요한 Secret 중 일부가 없습니다.",
        ok ? "success" : "error"
      );
    } catch (err) {
      setAdminStatus(status, err.message, "error");
    }
  });

  let pendingFaviconDataUrl = "";

  $("#faviconInput").addEventListener("change", () => {
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

  $("#saveSiteSettings").addEventListener("click", async () => {
    const status = $("#siteSettingsStatus");
    const title = $("#titleInput").value.trim();
    const channelHandle = $("#channelHandleInput").value.trim() || "@pilsae";

    if (!getAdminToken()) {
      setAdminStatus(status, "먼저 ADMIN_TOKEN을 입력하고 '이 세션에서 사용'을 눌러 주세요.", "error");
      return;
    }

    setAdminStatus(status, "GitHub에 사이트 설정을 저장하는 중입니다…", "loading");

    try {
      const data = await adminApi("/update-site-config", {
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

  $("#syncYoutubeVideos").addEventListener("click", async () => {
    const button = $("#syncYoutubeVideos");
    const status = $("#syncStatus");

    if (!getAdminToken()) {
      setAdminStatus(status, "먼저 ADMIN_TOKEN을 입력하고 '이 세션에서 사용'을 눌러 주세요.", "error");
      return;
    }

    button.disabled = true;
    setAdminStatus(
      status,
      "YouTube에서 전체 영상 목록을 가져오고 GitHub videos.json을 교체하는 중입니다. 잠시 기다려 주세요…",
      "loading"
    );

    try {
      const data = await adminApi("/sync-videos", {
        method: "POST",
        body: "{}"
      });

      setAdminStatus(
        status,
        `업데이트 완료 · ${data.total}개 영상 · 채널 프로필/헤더 이미지 동기화 포함. Cloudflare 새 배포가 완료되면 새로고침해 주세요.`,
        "success"
      );
    } catch (err) {
      setAdminStatus(status, err.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  $("#exportData").addEventListener("click", () => {
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

  if (location.hash === "#admin") setAdmin(true);
})();
