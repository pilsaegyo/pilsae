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

      if (url.pathname === "/sync-videos" && request.method === "POST") {
        requireAdmin(request, env);

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

        const normalized = items
          .map(normalizeYoutubeVideo)
          .filter(Boolean)
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
          },
        };

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
          title: existingConfig.title || "날짜로 다시 찾는 영상 기록",
          channelHandle: existingConfig.channelHandle || handle,
          channelTitle: branding.channelTitle || existingConfig.channelTitle || "",
          faviconDataUrl: existingConfig.faviconDataUrl || "",
          faviconUrl: existingConfig.faviconUrl || "./assets/favicon-p.png",
          profileImageUrl: branding.profileImageUrl || existingConfig.profileImageUrl || "",
          bannerImageUrl: branding.bannerImageUrl || existingConfig.bannerImageUrl || "",
          adminApiUrl: existingConfig.adminApiUrl || `https://${new URL(request.url).host}`,
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

        return jsonResponse({
          ok: true,
          total: normalized.length,
          channelTitle: channel.snippet?.title || "",
          updatedAt: new Date().toISOString(),
          commitUrl: result.commit?.html_url || null,
          configCommitUrl: configResult.commit?.html_url || null,
          bannerImageUrl: mergedConfig.bannerImageUrl,
          profileImageUrl: mergedConfig.profileImageUrl,
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
    part: "snippet,status",
    id: ids.join(","),
  }, apiKey);

  return data.items || [];
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

  return {
    id: String(video.id),
    title: String(s.title || ""),
    description,
    source: firstUsefulLine(description),
    sourceDate: null,
    publishedAt: String(s.publishedAt || ""),
    thumbnail,
    parseStatus: "needs_review",
    dates: [],
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
  const content = String(data.content || "").replace(/
/g, "");
  if (!content) return null;
  return JSON.parse(fromBase64Utf8(content));
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
