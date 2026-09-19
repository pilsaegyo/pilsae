const GITHUB_API_VERSION = "2026-03-10";

export default {
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
          "video_format"
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

        const normalized = items
          .map(normalizeYoutubeVideo)
          .filter(Boolean)
          .map(video => {
            const old = existingById.get(String(video.id));
            if (!old) return video;
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
              playlistScope: old.playlistScope === "multi-year" ? "multi-year"
                : old.playlistScope === "undated" ? "undated"
                : "",
              videoFormat: old.videoFormatSource === "manual" && ["standard", "shorts"].includes(old.videoFormat)
                ? old.videoFormat
                : video.videoFormat,
              videoFormatSource: old.videoFormatSource === "manual"
                ? "manual"
                : "auto",
              videoFormatConfidence: old.videoFormatSource === "manual"
                ? ""
                : (video.videoFormatConfidence || ""),
              videoFormatReason: old.videoFormatSource === "manual"
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

        if (previewOnly) {
          return jsonResponse({
            ok: true,
            preview: true,
            total: normalized.length,
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
            action: "sync_apply",
            title: "YouTube 영상 동기화",
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
          videoFormatSource: video.videoFormatSource === "manual" ? "manual" : "auto"
        };

        video.videoFormat = videoFormat;
        video.videoFormatSource = "manual";
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
              videoFormatSource: video.videoFormatSource
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
};

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
    duration,
    durationSeconds,
    videoFormat: formatAssessment.format,
    videoFormatSource: "auto",
    videoFormatConfidence: formatAssessment.confidence,
    videoFormatReason: formatAssessment.reason,
    parseStatus: "needs_review",
    contentType: "video",
    playlistScope: "",
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

  if (kind === "video_format") {
    return {
      videoFormat: ["standard", "shorts"].includes(video.videoFormat)
        ? video.videoFormat
        : "standard",
      videoFormatSource: video.videoFormatSource === "manual" ? "manual" : "auto"
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

  if (action === "video_format") {
    const prior = before && typeof before === "object" ? before : {};
    video.videoFormat = prior.videoFormat === "shorts" ? "shorts" : "standard";
    video.videoFormatSource = prior.videoFormatSource === "manual" ? "manual" : "auto";
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
