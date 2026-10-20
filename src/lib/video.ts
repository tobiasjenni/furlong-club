import crypto from "node:crypto";
import type { Video } from "@prisma/client";

// Bunny Stream embed token authentication: sha256_hex(tokenKey + videoId + expires).
// https://docs.bunny.net/docs/stream-embed-token-authentication
export function bunnyEmbedUrl(videoId: string, libraryId: string, tokenKey: string, ttlSeconds = 3600, now = Date.now()) {
  const expires = Math.floor(now / 1000) + ttlSeconds;
  const token = crypto.createHash("sha256").update(tokenKey + videoId + expires).digest("hex");
  const params = new URLSearchParams({ token, expires: String(expires), autoplay: "false", preload: "true", responsive: "true" });
  return `https://iframe.mediadelivery.net/embed/${encodeURIComponent(libraryId)}/${encodeURIComponent(videoId)}?${params}`;
}

// Returns what the player should load, or null when the video has no playable source configured.
export function playback(video: Pick<Video, "bunnyVideoId" | "embedUrl">): { kind: "iframe" | "file"; src: string } | null {
  const libraryId = process.env.BUNNY_LIBRARY_ID;
  const tokenKey = process.env.BUNNY_TOKEN_KEY;
  if (video.bunnyVideoId && libraryId && tokenKey) {
    return { kind: "iframe", src: bunnyEmbedUrl(video.bunnyVideoId, libraryId, tokenKey) };
  }
  if (!video.embedUrl) return null;
  return { kind: /\.(mp4|webm)(\?|$)/i.test(video.embedUrl) ? "file" : "iframe", src: video.embedUrl };
}
