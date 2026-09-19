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

  // 3) YYYYMMDD
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/g)) {
    addDay(m[1], m[2], m[3]);
  }

  // 4) YYMMDD e.g. 150227, 010826, 981025
  for (const m of input.matchAll(/(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)/g)) {
    const y = normalizeTwoDigitYear(m[1]);
    addDay(y, m[2], m[3]);
  }

  // 5) YYYY년 M월
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})\s*년\s*(\d{1,2})\s*월(?!\s*\d+\s*일)/g)) {
    addMonth(m[1], m[2]);
  }

  // 6) YYYY.MM / YYYY-MM / YYYY/MM
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})[.\-/](\d{1,2})(?![.\-/]\d|\d)/g)) {
    addMonth(m[1], m[2]);
  }

  // 7) YYYY년 / YYYY년도
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})\s*년(?:도)?(?!\s*\d+\s*월)/g)) {
    addYear(m[1]);
  }

  return found;
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
      inferred: Boolean(entry.inferred)
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
        inferred: Boolean(e.inferred)
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
  const review = videos.filter(v => v.type === "unknown").length;
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

function typeLabel(type) {
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
    return `<span class="date-chip unknown-date-chip">날짜 미확인</span>`;
  }

  const years = videoYears(v);
  const isMobile = window.matchMedia("(max-width: 620px)").matches;
  const limit = isMobile ? 2 : 3;
  const displayItems = [];

  // 혼합영상은 먼저 연도 요약을 보여주고 세부 날짜를 이어서 표시.
  if (v.type === "mixed") {
    displayItems.push({
      html: `<span class="year-summary-chip">${years.map(escapeHTML).join(" · ")}</span>`,
      summary: true
    });
  }

  let prevYear = "";
  valid.forEach((d) => {
    const year = d.sourceDate.slice(0,4);
    const includeYear = v.type === "mixed" || year !== prevYear;
    displayItems.push({
      html: `<span class="date-chip">${escapeHTML(shortDisplayDate(d, includeYear))}</span>`,
      summary: false
    });
    prevYear = year;
  });

  const visible = displayItems.slice(0, limit);
  const hidden = displayItems.slice(limit);
  const key = escapeHTML(v.id);

  return visible.map(x => x.html).join("") +
    hidden.map(x => `<span class="date-extra" data-date-group="${key}" hidden>${x.html}</span>`).join("") +
    (hidden.length
      ? `<button class="date-more-btn" type="button" data-date-toggle="${key}" data-more-count="${hidden.length}">+${hidden.length}개</button>`
      : "");
}

function unknownReason(v) {
  if (v.type !== "unknown") return "";
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

function renderCard(v) {
  const thumb = v.thumbnail
    ? `<img src="${escapeHTML(v.thumbnail)}" alt="" loading="lazy" />`
    : `<div class="thumb-placeholder">썸네일 없음</div>`;

  return `
    <article class="video-card">
      <a class="thumb youtube-video-link" data-video-id="${escapeHTML(v.id)}" href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">
        ${thumb}
      </a>
      <div class="card-body">
        <div class="card-top">
          <h2 class="card-title"><a class="youtube-video-link" data-video-id="${escapeHTML(v.id)}" href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(v.title)}</a></h2>
          <span class="badge ${escapeHTML(v.type)}">${typeLabel(v.type)}</span>
        </div>

        <div class="dates">${renderDates(v)}</div>

        ${v.source ? `<p class="source">출처 · ${escapeHTML(v.source)}</p>` : ""}
        ${v.type === "unknown"
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
      ...searchableDates
    ].join(" ").toLowerCase();

    const qok = !q || haystack.includes(q);
    const yok = !year || v.dates.some(d => String(d.sourceDate || "").startsWith(year));
    const tok = !type || v.type === type;

    return qok && yok && tok;
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

function currentActiveFilters() {
  const filters = [];
  const q = $("#searchInput")?.value?.trim() || "";
  const year = $("#yearFilter")?.value || "";
  const type = $("#typeFilter")?.value || "";
  const sort = $("#sortFilter")?.value || "source-desc";

  if (q) filters.push({ key:"search", label:`검색: ${q}` });
  if (year) filters.push({ key:"year", label:`${year}년` });
  if (type) filters.push({ key:"type", label:typeLabel(type) });
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
  if (key === "sort") $("#sortFilter").value = "source-desc";
  visibleLimit = PAGE_SIZE;
  render();
}

function currentView() {
  return localStorage.getItem(STORAGE_VIEW) === "list" ? "list" : "grid";
}

function applyViewMode() {
  const mode = currentView();
  const grid = $("#videoGrid");
  const gridBtn = $("#gridViewBtn");
  const listBtn = $("#listViewBtn");

  if (!grid || !gridBtn || !listBtn) return;

  grid.classList.toggle("list-view", mode === "list");
  gridBtn.classList.toggle("active", mode === "grid");
  listBtn.classList.toggle("active", mode === "list");
}

function setViewMode(mode) {
  localStorage.setItem(STORAGE_VIEW, mode === "list" ? "list" : "grid");
  applyViewMode();
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

  const unknownCount = rows.filter(v => v.type === "unknown").length;
  $("#resultMeta").innerHTML = videos.length
    ? `<span class="result-total">전체 ${videos.length}개</span><span class="result-divider">·</span><strong>현재 결과 ${rows.length}개</strong>` +
      (unknownCount ? `<span class="result-submeta">· 날짜 미확인 ${unknownCount}개</span>` : "")
    : "";

  $("#videoGrid").innerHTML = visibleRows.map(renderCard).join("");
  $("#emptyState").hidden = rows.length !== 0;

  const moreBtn = $("#loadMoreBtn");
  if (moreBtn) {
    const remaining = rows.length - visibleRows.length;
    moreBtn.hidden = remaining <= 0;
    moreBtn.textContent = remaining > 0
      ? `더 보기 (${Math.min(PAGE_SIZE, remaining)}개)`
      : "더 보기";
  }

  applyViewMode();
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

function renderAdminUnknownList() {
  const wrap = $("#adminUnknownList");
  const badge = $("#adminUnknownBadge");
  if (!wrap) return;

  const unknown = videos.filter(v => v.type === "unknown");
  if (badge) badge.textContent = `${unknown.length}개`;

  if (!unknown.length) {
    wrap.innerHTML = `<p class="admin-help">현재 날짜 확인이 필요한 영상이 없습니다.</p>`;
    return;
  }

  wrap.innerHTML = unknown.map(v => `
    <article class="admin-unknown-item">
      <div class="admin-unknown-thumb">
        ${v.thumbnail ? `<img src="${escapeHTML(v.thumbnail)}" alt="" loading="lazy" />` : ""}
      </div>
      <div class="admin-unknown-body">
        <div class="admin-unknown-top">
          <strong>${escapeHTML(v.title)}</strong>
          <span class="admin-reason-badge">${escapeHTML(unknownReason(v))}</span>
        </div>
        <p>${escapeHTML(descriptionPreview(v.description))}</p>
        <a class="youtube-video-link admin-youtube-link" data-video-id="${escapeHTML(v.id)}" href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">YouTube에서 설명 확인</a>
      </div>
    </article>
  `).join("");
}

function setAdmin(open) {
  $("#adminPanel").hidden = !open;

  if (open) {
    location.hash = "admin";
    $("#adminPanel").scrollIntoView({ behavior: "smooth", block: "start" });
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
  document.addEventListener("click", (event) => {
    const dateToggle = event.target.closest("button[data-date-toggle]");
    if (dateToggle) {
      const key = dateToggle.dataset.dateToggle;
      const extras = [...document.querySelectorAll(`[data-date-group="${CSS.escape(key)}"]`)];
      const opening = extras.some(el => el.hidden);
      extras.forEach(el => el.hidden = !opening);
      dateToggle.textContent = opening ? "접기" : `+${dateToggle.dataset.moreCount}개`;
      return;
    }

    const filterChip = event.target.closest("button[data-clear-filter]");
    if (filterChip) {
      clearOneFilter(filterChip.dataset.clearFilter || "");
      return;
    }

    const link = event.target.closest("a.youtube-video-link");
    if (!link) return;
    openYoutubeVideo(event, link.dataset.videoId || "");
  });

  ["searchInput", "yearFilter", "typeFilter", "sortFilter"].forEach(id => {
    $("#" + id).addEventListener(
      id === "searchInput" ? "input" : "change",
      () => {
        visibleLimit = PAGE_SIZE;
        render();
      }
    );
  });

  $("#resetFilters").addEventListener("click", () => {
    $("#searchInput").value = "";
    $("#yearFilter").value = "";
    $("#typeFilter").value = "";
    $("#sortFilter").value = "source-desc";
    visibleLimit = PAGE_SIZE;
    render();
    const toolbarPanel = document.querySelector(".toolbar-panel");
    const mobileFilterToggle = $("#mobileFilterToggle");
    if (window.matchMedia("(max-width: 620px)").matches && toolbarPanel && mobileFilterToggle) {
      toolbarPanel.classList.remove("mobile-open");
      mobileFilterToggle.setAttribute("aria-expanded", "false");
    }
  });

  $("#loadMoreBtn").addEventListener("click", () => {
    visibleLimit += PAGE_SIZE;
    render();
  });

  $("#gridViewBtn").addEventListener("click", () => setViewMode("grid"));
  $("#listViewBtn").addEventListener("click", () => setViewMode("list"));

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
    $("#adminEntry").hidden = false;
  }

  $("#adminEntry").addEventListener("click", () => setAdmin(true));
  $("#closeAdmin").addEventListener("click", () => setAdmin(false));


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
            precision: "day",
            inferred: false
          }))
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
    bindEvents();
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
