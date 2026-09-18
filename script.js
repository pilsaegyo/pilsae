const DEFAULT_TITLE = "날짜로 다시 찾는 영상 기록";
const STORAGE_TITLE = "pilsaeArchiveTitle";

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

function extractDatesFromText(text="") {
  const input = String(text || "");
  const found = [];

  const addDay = (y, m, d, raw="") => {
    y = Number(y); m = Number(m); d = Number(d);
    if (!isValidDate(y, m, d)) return;
    pushUniqueDate(found, {
      sourceDate: `${y}-${pad2(m)}-${pad2(d)}`,
      source: raw.trim(),
      precision: "day",
      inferred: false
    });
  };

  const addMonth = (y, m, raw="") => {
    y = Number(y); m = Number(m);
    if (y < 1900 || y > 2099 || m < 1 || m > 12) return;
    pushUniqueDate(found, {
      sourceDate: `${y}-${pad2(m)}-01`,
      source: raw.trim(),
      precision: "month",
      inferred: true
    });
  };

  const addYear = (y, raw="") => {
    y = Number(y);
    if (y < 1900 || y > 2099) return;
    pushUniqueDate(found, {
      sourceDate: `${y}-01-01`,
      source: raw.trim(),
      precision: "year",
      inferred: true
    });
  };

  // 1) YYYY년 M월 D일
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)) {
    addDay(m[1], m[2], m[3], m[0]);
  }

  // 2) YYYY.MM.DD / YYYY-MM-DD / YYYY/MM/DD
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})(?!\d)/g)) {
    addDay(m[1], m[2], m[3], m[0]);
  }

  // 3) YYYYMMDD
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/g)) {
    addDay(m[1], m[2], m[3], m[0]);
  }

  // 4) YYMMDD e.g. 150227, 010826, 990626
  for (const m of input.matchAll(/(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)/g)) {
    const y = normalizeTwoDigitYear(m[1]);
    addDay(y, m[2], m[3], m[0]);
  }

  // 5) YYYY년 M월 (day unknown)
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})\s*년\s*(\d{1,2})\s*월(?!\s*\d)/g)) {
    addMonth(m[1], m[2], m[0]);
  }

  // 6) YYYY.MM / YYYY-MM / YYYY/MM (day unknown)
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})[.\-/](\d{1,2})(?![.\-/]\d|\d)/g)) {
    addMonth(m[1], m[2], m[0]);
  }

  // 7) Explicit 4-digit year with backtick: 1999`, 2000`
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})\s*[`´’']/g)) {
    addYear(m[1], m[0]);
  }

  // 8) 2-digit year with backtick: 99`, 00`
  for (const m of input.matchAll(/(?<!\d)(\d{2})\s*[`´’'](?!\d)/g)) {
    addYear(normalizeTwoDigitYear(m[1]), m[0]);
  }

  // 9) YYYY년 / YYYY년도
  for (const m of input.matchAll(/(?<!\d)((?:19|20)\d{2})\s*년(?:도)?(?!\s*\d+\s*월)/g)) {
    addYear(m[1], m[0]);
  }

  // 10) YY년도 / YY년 (e.g. 99년도 방송)
  for (const m of input.matchAll(/(?<!\d)(\d{2})\s*년(?:도)?(?!\s*\d+\s*월)/g)) {
    addYear(normalizeTwoDigitYear(m[1]), m[0]);
  }

  // Prefer more precise entries when same year/month/day prefix collides.
  const precisionRank = { day: 3, month: 2, year: 1 };
  found.sort((a, b) => {
    const da = a.sourceDate.localeCompare(b.sourceDate);
    if (da !== 0) return da;
    return (precisionRank[b.precision] || 0) - (precisionRank[a.precision] || 0);
  });

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

  for (const e of existing || []) {
    const n = normalizeDateEntry(e);
    if (n && n.sourceDate) pushUniqueDate(merged, n);
  }

  // Avoid adding year-only/month-only inference if a more precise date
  // for the same year/month already exists.
  for (const e of extracted || []) {
    if (!e?.sourceDate) continue;

    const y = e.sourceDate.slice(0,4);
    const ym = e.sourceDate.slice(0,7);

    if (e.precision === "year") {
      if (merged.some(x => x.sourceDate.startsWith(y))) continue;
    }
    if (e.precision === "month") {
      if (merged.some(x => x.sourceDate.startsWith(ym) && x.precision === "day")) continue;
    }

    pushUniqueDate(merged, e);
  }

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

  // Re-analyse the complete saved description + source + title every load.
  const textToAnalyse = [
    v.description || "",
    v.source || "",
    v.title || ""
  ].join("\n");

  const extracted = extractDatesFromText(textToAnalyse);
  const dateEntries = mergeDateEntries(existing, extracted);

  const validDates = dateEntries.map(d => d.sourceDate).filter(Boolean);

  let type = "unknown";
  if (validDates.length > 1) type = "mixed";
  else if (validDates.length === 1) type = "single";

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

  videos = list.map(normalizeVideo);
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
  if (d.precision === "year") return `${raw.slice(0,4)}년`;
  if (d.precision === "month") {
    const [y,m] = raw.split("-");
    return `${y}.${m}`;
  }
  return raw;
}

function renderDates(v) {
  if (!v.dates.length || !v.dates.some(d => d.sourceDate)) {
    return `<span class="date-chip">날짜 미확인</span>`;
  }

  return v.dates
    .filter(d => d.sourceDate)
    .sort((a,b) => b.sourceDate.localeCompare(a.sourceDate))
    .map(d => {
      const dateLabel = displayDate(d);
      const sourceLabel = d.source && d.source !== dateLabel
        ? ` · ${d.source}`
        : "";
      return `<span class="date-chip">${escapeHTML(dateLabel + sourceLabel)}</span>`;
    })
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

function render() {
  $("#videoCount").textContent = `${videos.length}개`;

  const rows = filteredVideos();
  $("#resultMeta").textContent =
    videos.length ? `${rows.length}개의 영상 표시 중` : "";

  $("#videoGrid").innerHTML = rows.map(renderCard).join("");
  $("#emptyState").hidden = rows.length !== 0;

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
            source: d.source,
            precision: d.precision,
            inferred: d.inferred
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

      videos = list.map(normalizeVideo);
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
