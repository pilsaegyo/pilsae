const DEFAULT_TITLE = "날짜로 다시 찾는 영상 기록";
const STORAGE_TITLE = "pilsaeArchiveTitle";
const STORAGE_VIEW = "pilsaeArchiveView";

let videos = [];
const $ = (sel) => document.querySelector(sel);

function escapeHTML(value="") {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function youtubeUrlFromId(id="") {
  return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : "";
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

function currentTitle() {
  return localStorage.getItem(STORAGE_TITLE) || DEFAULT_TITLE;
}

function applyTitle() {
  $("#mainTitle").textContent = currentTitle();
  if ($("#titleInput")) $("#titleInput").value = currentTitle();
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
  select.innerHTML = `<option value="">전체 연도</option>` +
    allYears().map(y => `<option value="${y}">${y}</option>`).join("");
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

function renderDates(v) {
  const valid = v.dates
    .filter(d => d.sourceDate)
    .sort((a,b) => b.sourceDate.localeCompare(a.sourceDate));

  if (!valid.length) {
    return `<span class="date-chip">날짜 미확인</span>`;
  }

  // Same year appears once only.
  // Within a year, prefer day > month > year; if same precision, latest value wins.
  const rank = { day: 3, month: 2, year: 1 };
  const byYear = new Map();

  for (const d of valid) {
    const year = d.sourceDate.slice(0,4);
    const prev = byYear.get(year);

    if (!prev) {
      byYear.set(year, d);
      continue;
    }

    const curRank = rank[d.precision] || 0;
    const prevRank = rank[prev.precision] || 0;

    if (curRank > prevRank ||
        (curRank === prevRank && d.sourceDate > prev.sourceDate)) {
      byYear.set(year, d);
    }
  }

  return [...byYear.values()]
    .sort((a,b) => b.sourceDate.localeCompare(a.sourceDate))
    .map(d => `<span class="date-chip">${escapeHTML(displayDate(d))}</span>`)
    .join("");
}

function renderCard(v) {
  const thumb = v.thumbnail
    ? `<img src="${escapeHTML(v.thumbnail)}" alt="" loading="lazy" />`
    : `<div class="thumb-placeholder">썸네일 없음</div>`;

  return `
    <article class="video-card">
      <a class="thumb" href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">
        ${thumb}
      </a>
      <div class="card-body">
        <div class="card-top">
          <h2 class="card-title">${escapeHTML(v.title)}</h2>
          <span class="badge ${escapeHTML(v.type)}">${typeLabel(v.type)}</span>
        </div>

        <div class="dates">${renderDates(v)}</div>

        ${v.source ? `<p class="source">출처 · ${escapeHTML(v.source)}</p>` : ""}
        ${v.type === "unknown"
          ? `<p class="note">정확한 날짜 확인 필요</p>`
          : ""}

        <a class="card-link" href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">
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

  return videos
    .filter(v => {
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
    })
    .sort((a, b) => {
      // Primary: archive/source date descending.
      const ad = a.sortDate || "";
      const bd = b.sortDate || "";
      if (ad !== bd) return bd.localeCompare(ad);

      // Secondary: upload date descending.
      return String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
    });
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
  $("#videoCount").textContent = `${videos.length}개`;

  const rows = filteredVideos();
  $("#resultMeta").textContent =
    videos.length ? `${rows.length}개의 영상 표시 중` : "";

  $("#videoGrid").innerHTML = rows.map(renderCard).join("");
  $("#emptyState").hidden = rows.length !== 0;

  applyViewMode();
  renderAdminList();
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
  ["searchInput", "yearFilter", "typeFilter"].forEach(id => {
    $("#" + id).addEventListener(
      id === "searchInput" ? "input" : "change",
      render
    );
  });

  $("#gridViewBtn").addEventListener("click", () => setViewMode("grid"));
  $("#listViewBtn").addEventListener("click", () => setViewMode("list"));

  $("#adminEntry").addEventListener("click", () => setAdmin(true));
  $("#closeAdmin").addEventListener("click", () => setAdmin(false));

  $("#saveTitle").addEventListener("click", () => {
    const value = $("#titleInput").value.trim();
    if (!value) return;
    localStorage.setItem(STORAGE_TITLE, value);
    applyTitle();
  });

  $("#resetTitle").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_TITLE);
    applyTitle();
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

  $("#importFile").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const raw = JSON.parse(await file.text());
      const list = Array.isArray(raw) ? raw : raw.videos;
      if (!Array.isArray(list)) {
        throw new Error("videos 배열을 찾을 수 없습니다.");
      }

      videos = list
        .filter(v => !isExcludedVideo(v))
        .map(normalizeVideo);
      rebuildYearFilter();
      render();

      alert("JSON을 읽었습니다. 이 정적 버전에서는 파일 자체가 서버에 자동 저장되지는 않습니다.");
    } catch (err) {
      alert("JSON을 불러오지 못했습니다: " + err.message);
    } finally {
      e.target.value = "";
    }
  });

  const formCard = $("#videoForm")?.closest(".admin-card");
  if (formCard) formCard.hidden = true;

  const clearBtn = $("#clearLocalData");
  if (clearBtn) clearBtn.hidden = true;
}

(async function init() {
  applyTitle();

  try {
    await loadInitialData();
  } catch (err) {
    console.error(err);
    $("#resultMeta").textContent =
      "videos.json을 불러오지 못했습니다. 로컬에서는 웹서버로 실행해 주세요.";
  }

  rebuildYearFilter();
  bindEvents();
  render();

  if (location.hash === "#admin") setAdmin(true);
})();
