import axios from 'axios';
import { Song } from '../types';

// ⚠️  Move this to an environment variable before shipping to production
const YOUTUBE_API_KEY = 'AIzaSyBb6sozj32MeGUsOAE_06peS7GH16CPLi8';
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

// ─────────────────────────────────────────────────────────────────────────────
// ACTION REQUIRED: Deploy proxy-server.js (included alongside this file) on
// Render.com (free tier) and paste your URL below.
// e.g. 'https://my-yt-proxy.onrender.com'
// Without this, audio playback will not work — all client-side ytdl libraries
// are currently broken due to YouTube's signature changes.
// ─────────────────────────────────────────────────────────────────────────────
const SELF_HOSTED_PROXY_URL = 'https://yt-proxy-8tye.onrender.com'; // <-- paste your Render URL here

export interface YouTubeSearchResult {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  duration?: string;
}

class YouTubeService {
  /**
   * Search for music-related videos on YouTube.
   * Primary: YouTube Data API v3
   * Fallback: Piped → Invidious public instances
   */
  async searchVideos(query: string): Promise<YouTubeSearchResult[]> {
    try {
      if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY.includes('YOUR_')) {
        console.warn('[Search] No API key — using fallback search.');
        return this.fallbackSearch(query);
      }

      console.log(`[Search] YouTube API: "${query}"`);
      const response = await axios.get(`${BASE_URL}/search`, {
        params: {
          part: 'snippet',
          q: query,
          type: 'video',
          maxResults: 20,
          key: YOUTUBE_API_KEY,
        },
      });
      console.log('[Search] Found', response.data.items?.length, 'items');

      const videoIds = response.data.items
        .map((item: any) => item.id.videoId)
        .join(',');

      const detailsResponse = await axios.get(`${BASE_URL}/videos`, {
        params: {
          part: 'contentDetails,snippet',
          id: videoIds,
          key: YOUTUBE_API_KEY,
        },
      });

      return detailsResponse.data.items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        thumbnail:
          item.snippet.thumbnails.high?.url ||
          item.snippet.thumbnails.default?.url,
        channelTitle: item.snippet.channelTitle,
        duration: this.formatYouTubeDuration(item.contentDetails.duration),
      }));
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error?.message || error.message;
      const errorReason =
        error.response?.data?.error?.errors?.[0]?.reason || 'unknown';
      console.error('[Search] API failed:', errorMsg, '| Reason:', errorReason);

      if (error.response?.status === 403) {
        console.warn('[Search] 403 — check YouTube Data API v3 is enabled and key has no restrictions.');
      }

      return this.fallbackSearch(query);
    }
  }

  /**
   * Get a playable audio stream URL for a YouTube video.
   *
   * Strategy (in order):
   *   1. Self-hosted yt-dlp proxy  ← most reliable, set SELF_HOSTED_PROXY_URL
   *   2. Piped public instances
   *   3. Invidious public instances
   *
   * NOTE: client-side ytdl libraries (expo-ytdl, react-native-ytdl) are
   * intentionally removed — both are currently broken due to YouTube's
   * signature changes and neither package is actively maintained.
   */
  async getAudioUrl(videoId: string): Promise<string | null> {
    // ── Strategy 1: self-hosted yt-dlp proxy ──────────────────────────────
    if (SELF_HOSTED_PROXY_URL) {
      try {
        console.log('[Audio] Waking proxy...');
        // Ping health endpoint first to wake Render free tier (fire and forget)
        axios.get(`${SELF_HOSTED_PROXY_URL}/health`, { timeout: 30000 }).catch(() => {});

        console.log('[Audio] Fetching audio URL from proxy...');
        const response = await axios.get(
          `${SELF_HOSTED_PROXY_URL}/audio/${videoId}`,
          { timeout: 30000 }  // 30s to handle cold start
        );
        if (response.data?.url) {
          console.log('[Audio] ✓ Self-hosted proxy');
          return response.data.url;
        }
      } catch (e: any) {
        console.warn('[Audio] Proxy failed:', e.message);
      }
    } else {
      console.warn(
        '[Audio] SELF_HOSTED_PROXY_URL is not set. ' +
        'Deploy proxy-server.js on Render.com and set the URL to fix audio playback.'
      );
    }

    // ── Strategy 2: Piped public instances ────────────────────────────────
    const pipedInstances = [
      'https://pipedapi.marcomat.ch',
      'https://pipedapi.hostux.net',
      'https://pipedapi.reiturns.com',
      'https://pipedapi.astartes.nl',
      'https://piped-api.garudalinux.org',
      'https://pipedapi.aeong.one',
      'https://api.piped.victr.me',
      'https://pipedapi.kavin.rocks',
      'https://pipedapi.lunar.icu',
    ];

    const commonHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      Accept: '*/*',
      Referer: 'https://piped.video/',
    };

    for (const instance of pipedInstances) {
      try {
        console.log(`[Audio] Trying Piped: ${instance}`);
        const response = await axios.get(`${instance}/streams/${videoId}`, {
          timeout: 6000,
          headers: commonHeaders,
        });

        if (response.data?.audioStreams?.length > 0) {
          const best = response.data.audioStreams.sort(
            (a: any, b: any) => b.bitrate - a.bitrate
          )[0];
          console.log(`[Audio] ✓ Piped: ${instance}`);
          return best.url;
        }
      } catch (e: any) {
        console.warn(
          `[Audio] Piped failed (${instance}): ${e.response?.status || e.message}`
        );
      }
    }

    // ── Strategy 3: Invidious public instances ────────────────────────────
    const invidiousInstances = [
      'https://iv.ggtyler.dev',
      'https://invidious.no',
      'https://invidious.projectsegfau.lt',
      'https://yewtu.be',
    ];

    for (const instance of invidiousInstances) {
      try {
        console.log(`[Audio] Trying Invidious: ${instance}`);
        const response = await axios.get(
          `${instance}/api/v1/videos/${videoId}`,
          {
            timeout: 6000,
            headers: { ...commonHeaders, Referer: instance },
          }
        );

        if (response.data?.adaptiveFormats) {
          const audioOnly = response.data.adaptiveFormats.filter((f: any) =>
            f.type?.startsWith('audio/')
          );
          if (audioOnly.length > 0) {
            const best = audioOnly.sort(
              (a: any, b: any) => parseInt(b.bitrate) - parseInt(a.bitrate)
            )[0];
            console.log(`[Audio] ✓ Invidious: ${instance}`);
            return best.url;
          }
        }
      } catch (e: any) {
        console.warn(
          `[Audio] Invidious failed (${instance}): ${e.response?.status || e.message}`
        );
      }
    }

    console.error('[Audio] All strategies failed for videoId:', videoId);
    return null;
  }

  // ── Private: fallback search ─────────────────────────────────────────────

  private async fallbackSearch(query: string): Promise<YouTubeSearchResult[]> {
    const pipedInstances = [
      'https://pipedapi.kavin.rocks',
      'https://api.piped.victr.me',
      'https://pipedapi.lunar.icu',
      'https://api-piped.mha.fi',
      'https://pipedapi.colatube.org',
      'https://pipedapi.adminforge.de',
    ];

    const invidiousInstances = [
      'https://yewtu.be',
      'https://invidious.no',
      'https://iv.ggtyler.dev',
      'https://invidious.flokinet.to',
      'https://invidious.drgns.space',
      'https://invidious.sethforprivacy.com',
    ];

    for (const instance of pipedInstances) {
      try {
        console.log(`[Search] Trying Piped: ${instance}`);
        const response = await axios.get(`${instance}/search`, {
          params: { q: query, filter: 'videos' },
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 4000,
        });

        if (response.data?.items?.length > 0) {
          console.log(`[Search] ✓ Piped: ${instance}`);
          return response.data.items.map((item: any) => ({
            id: item.url.split('v=')[1] || item.url.split('/').pop(),
            title: item.title,
            thumbnail: item.thumbnail,
            channelTitle: item.uploaderName,
            duration: this.formatSeconds(item.duration),
          }));
        }
      } catch (e: any) {
        console.warn(`[Search] Piped failed (${instance}): ${e.message}`);
      }
    }

    for (const instance of invidiousInstances) {
      try {
        console.log(`[Search] Trying Invidious: ${instance}`);
        const response = await axios.get(`${instance}/api/v1/search`, {
          params: { q: query, type: 'video' },
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 4000,
        });

        if (Array.isArray(response.data) && response.data.length > 0) {
          console.log(`[Search] ✓ Invidious: ${instance}`);
          return response.data.map((item: any) => {
            let thumb = '';
            if (item.videoThumbnails?.length > 0) {
              thumb =
                item.videoThumbnails.find((t: any) => t.quality === 'high')
                  ?.url || item.videoThumbnails[0].url;
            }
            if (thumb && thumb.startsWith('/')) thumb = `${instance}${thumb}`;
            return {
              id: item.videoId,
              title: item.title,
              thumbnail: thumb,
              channelTitle: item.author,
              duration: this.formatSeconds(item.lengthSeconds),
            };
          });
        }
      } catch (e: any) {
        console.warn(`[Search] Invidious failed (${instance}): ${e.message}`);
      }
    }

    console.error('[Search] All fallbacks failed.');
    return [];
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private formatYouTubeDuration(duration: string): string {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return '0:00';
    const h = match[1] ? parseInt(match[1], 10) : 0;
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const s = match[3] ? parseInt(match[3], 10) : 0;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private formatSeconds(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

export const youtubeService = new YouTubeService();
