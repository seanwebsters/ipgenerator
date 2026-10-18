import { getObject } from "../storage";

/**
 * YouTube Data API v3 (videos.insert, resumable upload) and YouTube Analytics
 * API v2 (reports.query). Docs:
 *   https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
 *   https://developers.google.com/youtube/v3/docs/videos#resource
 *   https://developers.google.com/youtube/analytics/reference/reports/query
 * Requires YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
 * (scopes youtube.upload + yt-analytics.readonly).
 */

export function youtubeConfigured() {
  return !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN);
}

export async function accessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth token refresh failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export interface YouTubeUpload {
  videoKey: string;
  title: string;
  description: string;
  tags: string[];
  privacyStatus: "private" | "unlisted" | "public";
  madeForKids: boolean;
}

export async function uploadVideo(u: YouTubeUpload): Promise<{ id: string; url: string; raw: unknown }> {
  const token = await accessToken();
  const video = await getObject(u.videoKey);
  const meta = {
    snippet: { title: u.title.slice(0, 100), description: u.description.slice(0, 4900), tags: u.tags.slice(0, 15), categoryId: "1" },
    // containsSyntheticMedia: YouTube's altered/synthetic content disclosure.
    status: { privacyStatus: u.privacyStatus, selfDeclaredMadeForKids: u.madeForKids, containsSyntheticMedia: true },
  };
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-length": String(video.length),
      "x-upload-content-type": "video/mp4",
    },
    body: JSON.stringify(meta),
  });
  if (!init.ok) throw new Error(`YouTube upload init failed (${init.status}): ${(await init.text()).slice(0, 400)}`);
  const location = init.headers.get("location");
  if (!location) throw new Error("YouTube did not return a resumable upload URL.");
  const put = await fetch(location, { method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(video.length) }, body: new Uint8Array(video) });
  if (!put.ok) throw new Error(`YouTube upload failed (${put.status}): ${(await put.text()).slice(0, 400)}`);
  const json = (await put.json()) as { id: string };
  return { id: json.id, url: `https://www.youtube.com/watch?v=${json.id}`, raw: json };
}

export interface YouTubeMetrics {
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  shares: number;
  likes: number;
}

export async function videoMetrics(videoId: string, since: Date): Promise<YouTubeMetrics | null> {
  const token = await accessToken();
  const d = (x: Date) => x.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    ids: "channel==MINE",
    startDate: d(since),
    endDate: d(new Date()),
    metrics: "views,estimatedMinutesWatched,averageViewDuration,shares,likes",
    filters: `video==${videoId}`,
  });
  const res = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`YouTube Analytics ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { columnHeaders: { name: string }[]; rows?: number[][] };
  if (!json.rows?.length) return null;
  const row = json.rows[0];
  const col = (n: string) => Number(row[json.columnHeaders.findIndex((h) => h.name === n)] ?? 0);
  return { views: col("views"), estimatedMinutesWatched: col("estimatedMinutesWatched"), averageViewDuration: col("averageViewDuration"), shares: col("shares"), likes: col("likes") };
}
