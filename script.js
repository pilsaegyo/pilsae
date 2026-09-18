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

function normalizeDateEntry(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    return { sourceDate: entry, source: "" };
  }
  if (typeof entry === "object") {
    return {
      sourceDate: String(entry.sourceDate || ""),
      source: String(entry.source || "")
    };
  }
  return null;
}

function normalizeVideo(v, idx=0) {
  const dateEntries = Array.isArray(v.dates)
    ? v.dates.map(normalizeDateEntry).filter(Boolean)
    : [];

  // Fallback to top-level sourceDate when dates[] is empty.
  if (!dateEntries.length && v.sourceDate) {
    dateEntries.push({
      sourceDate: String(v.sourceDate),
      source: String(v.source || "")
    });
  }

  const validDates = dateEntries.map(d => d.sourceDate).filter(Boolean);

  let type = "unknown";
  if (validDates.length > 1) type = "mixed";
  else if (validDates.length === 1) type = "single";

  return {
    id: String(v.id || `video-${idx}`),
    title: String(v.title || "제목 없음"),
    description: String(v.description || ""),
    source: String(v.source || ""),
    sourceDate: v.sourceDate ? String(v.sourceDate) : "",
    publishedAt: v.publishedAt ? String(v.publishedAt) : "",
    thumbnail: String(v.thumbnail || ""),
    parseStatus: String(v.parseStatus || ""),
    dates: dateEntries,
    type,
    url: youtubeUrlFromId(v.id)
  };
}

async function loadInitialData() {
  const res = await fetch("./data/videos.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`videos.json 로드 실패: ${res.status}`);

  const raw = await res.json();

  // Supports both:
  // 1) { "videos": [...], "total": 642 }
  // 2) [...]
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

function renderDates(v) {
  if (!v.dates.length || !v.dates.some(d => d.sourceDate)) {
    return `<span class="date-chip">날짜 미확인</span>`;
  }

  return v.dates
    .filter(d => d.sourceDate)
    .map(d => {
      const label = d.source
        ? `${d.sourceDate} · ${d.source}`
        : d.sourceDate;
      return `<span class="date-chip">${escapeHTML(label)}</span>`;
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
        ${v.parseStatus === "needs_review"
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

  return videos.filter(v => {
    const searchableDates = v.dates.flatMap(d => [d.sourceDate, d.source]);
    const haystack = [
      v.title,
      v.description,
      v.source,
      v.parseStatus,
      ...searchableDates
    ].join(" ").toLowerCase();

    const qok = !q || haystack.includes(q);
    const yok = !year || v.dates.some(d => String(d.sourceDate || "").includes(year));
    const tok = !type || v.type === type;

    return qok && yok && tok;
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
          v.dates.map(d => d.sourceDate).filter(Boolean).join(", ") || "날짜 없음"
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

  // Export in the SAME structure as the uploaded JSON:
  // { videos: [...], total: N }
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
          parseStatus: v.parseStatus,
          dates: v.dates
        })),
        total: videos.length
      },
      "videos.json"
    );
  });

  // Import also accepts the original {videos:[...]} structure.
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

  // Static hosting can't physically overwrite data/videos.json from browser.
  // Hide functions that imply server-side persistence.
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
