import axios from 'axios';
import ytdl from 'react-native-ytdl';

const YOUTUBE_API_KEY = 'AIzaSyBb6sozj32MeGUsOAE_06peS7GH16CPLi8';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeSearchResult {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  duration?: string;
}

class YouTubeService {

  // ─────────────────────────────────────────────────────────────────────────
  // Search using YouTube Data API v3 directly
  // ─────────────────────────────────────────────────────────────────────────
  async searchVideos(query: string): Promise<YouTubeSearchResult[]> {
    try {
      console.log(`[Search] Query: "${query}"`);

      const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
        params: {
          part: 'snippet',
          q: query,
          type: 'video',
          maxResults: 20,
          key: YOUTUBE_API_KEY,
          videoCategoryId: '10',
        },
        timeout: 10000,
      });

      const videoIds = searchResponse.data.items
        .map((i: any) => i.id.videoId)
        .join(',');

      const detailsResponse = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
        params: {
          part: 'contentDetails,snippet',
          id: videoIds,
          key: YOUTUBE_API_KEY,
        },
        timeout: 10000,
      });

      const results = detailsResponse.data.items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        thumbnail:
          item.snippet.thumbnails.high?.url ||
          item.snippet.thumbnails.default?.url,
        channelTitle: item.snippet.channelTitle,
        duration: this.formatYouTubeDuration(item.contentDetails.duration),
      }));

      console.log(`[Search] Found ${results.length} results`);
      return results;

    } catch (error: any) {
      console.error(`[Search] Failed: ${error.message}`);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Get audio URL using react-native-ytdl directly
  // ─────────────────────────────────────────────────────────────────────────
  async getAudioUrl(videoId: string): Promise<string | null> {
    try {
      console.log(`[Audio] Fetching: ${videoId}`);

      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const info = await ytdl.getInfo(videoUrl);

      console.log(`[Audio] Total formats: ${info.formats.length}`);

      // Try audio only first
      let formats = ytdl.filterFormats(info.formats, 'audioonly');
      console.log(`[Audio] Audio-only formats: ${formats.length}`);

      // If no audio-only, get formats with audio
      if (!formats || formats.length === 0) {
        formats = info.formats.filter((f: any) =>
          f.hasAudio === true || f.audioBitrate > 0
        );
        console.log(`[Audio] Formats with audio: ${formats.length}`);
      }

      // Last resort - use any format
      if (!formats || formats.length === 0) {
        formats = info.formats;
        console.log(`[Audio] Using any format: ${formats.length}`);
      }

      if (formats.length === 0) {
        console.error('[Audio] No formats found at all');
        return null;
      }

      // Log available formats for debugging
      formats.slice(0, 5).forEach((f: any, i: number) => {
        console.log(`[Audio] Format ${i}: mimeType=${f.mimeType} bitrate=${f.audioBitrate} hasUrl=${!!f.url}`);
      });

      // Pick best quality
      const best = formats.sort(
        (a: any, b: any) => (b.audioBitrate || 0) - (a.audioBitrate || 0)
      )[0];

      if (!best?.url) {
        console.error('[Audio] Best format has no URL');
        return null;
      }

      console.log(`[Audio] ✓ Success: ${best.mimeType} @ ${best.audioBitrate}kbps`);
      return best.url;

    } catch (error: any) {
      console.error(`[Audio] Failed: ${error.message}`);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────
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
}

export const youtubeService = new YouTubeService();