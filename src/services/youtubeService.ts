import axios from 'axios';
import { Song } from '../types';

// Get YouTube API Key from settings (with fallback to default)
const getYoutubeApiKey = (): string => {
  try {
    return 'AIzaSyBb6sozj32MeGUsOAE_06peS7GH16CPLi8';
  } catch {
    return 'AIzaSyBb6sozj32MeGUsOAE_06peS7GH16CPLi8';
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PROXY CONFIGURATION
// Deploy proxy-server.js on Render.com and update this URL
// ─────────────────────────────────────────────────────────────────────────────
const PROXY_BASE_URL = 'https://yt-proxy-8tye.onrender.com';

export interface YouTubeSearchResult {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  duration?: string;
}

class YouTubeService {
  /**
   * Search for videos on YouTube.
   */
  async searchVideos(query: string): Promise<YouTubeSearchResult[]> {
    // Try proxy server first
    try {
      console.log(`[Search] Proxy search: "${query}"`);
      const response = await axios.get(`${PROXY_BASE_URL}/search`, {
        params: { q: query, limit: 20 },
        timeout: 30000,
      });

      if (response.data?.videos && Array.isArray(response.data.videos)) {
        console.log(`[Search] Found ${response.data.videos.length} results via proxy`);
        return response.data.videos.map((video: any) => ({
          id: video.id,
          title: video.title,
          thumbnail: video.thumbnail,
          channelTitle: video.channel,
          duration: this.formatDuration(video.duration),
        }));
      }
    } catch (error: any) {
      console.warn(`[Search] Proxy failed: ${error.message}`);
    }

    // Fallback to YouTube Data API
    try {
      const apiKey = getYoutubeApiKey();
      if (apiKey && !apiKey.includes('YOUR_')) {
        console.log(`[Search] YouTube API fallback: "${query}"`);
        return await this.searchWithYouTubeAPI(query, apiKey);
      }
    } catch (error: any) {
      console.warn(`[Search] YouTube API failed: ${error.message}`);
    }

    // Last fallback: Piped instances
    console.log('[Search] Trying Piped fallback...');
    return await this.fallbackSearch(query);
  }

  /**
   * Get audio stream URL for a YouTube video
   */
  async getAudioUrl(videoId: string, quality: 'low' | 'medium' | 'high' = 'high'): Promise<string | null> {
    // Try proxy server first with retry for cold starts
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Wake up proxy on first attempt
        if (attempt === 0) {
          axios.get(`${PROXY_BASE_URL}/health`, { timeout: 5000 }).catch(() => {});
        }

        console.log(`[Audio] Proxy attempt ${attempt + 1} for ${videoId}...`);
        const response = await axios.get(
          `${PROXY_BASE_URL}/audio/${videoId}`,
          { timeout: 60000 }
        );

        if (response.data?.url) {
          console.log('[Audio] ✓ Proxy success');
          return response.data.url;
        }
      } catch (error: any) {
        console.warn(`[Audio] Proxy attempt ${attempt + 1} failed: ${error.message}`);
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    // Fallback to Piped
    console.log('[Audio] Trying Piped fallback...');
    return await this.fallbackAudio(videoId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private: YouTube Data API Search
  // ─────────────────────────────────────────────────────────────────────────
  private async searchWithYouTubeAPI(query: string, apiKey: string): Promise<YouTubeSearchResult[]> {
    const BASE_URL = 'https://www.googleapis.com/youtube/v3';
    
    const response = await axios.get(`${BASE_URL}/search`, {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 20,
        key: apiKey,
      },
    });

    const videoIds = response.data.items
      .map((item: any) => item.id.videoId)
      .join(',');

    const detailsResponse = await axios.get(`${BASE_URL}/videos`, {
      params: {
        part: 'contentDetails,snippet',
        id: videoIds,
        key: apiKey,
      },
    });

    return detailsResponse.data.items.map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      channelTitle: item.snippet.channelTitle,
      duration: this.formatYouTubeDuration(item.contentDetails.duration),
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private: Fallback Search (Piped)
  // ─────────────────────────────────────────────────────────────────────────
  private async fallbackSearch(query: string): Promise<YouTubeSearchResult[]> {
    const pipedInstances = [
      'https://pipedapi.kavin.rocks',
      'https://api.piped.victr.me',
      'https://pipedapi.lunar.icu',
    ];

    for (const instance of pipedInstances) {
      try {
        console.log(`[Search] Trying Piped: ${instance}`);
        const response = await axios.get(`${instance}/search`, {
          params: { q: query, filter: 'videos' },
          timeout: 5000,
        });

        if (response.data?.items?.length > 0) {
          console.log(`[Search] ✓ Piped success: ${instance}`);
          return response.data.items.map((item: any) => ({
            id: item.url?.split('v=')[1] || item.url?.split('/').pop(),
            title: item.title,
            thumbnail: item.thumbnail,
            channelTitle: item.uploaderName,
            duration: this.formatSeconds(item.duration),
          }));
        }
      } catch (error: any) {
        console.warn(`[Search] Piped failed (${instance}): ${error.message}`);
      }
    }

    console.error('[Search] All fallbacks failed');
    return [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private: Fallback Audio (Piped)
  // ─────────────────────────────────────────────────────────────────────────
  private async fallbackAudio(videoId: string): Promise<string | null> {
    const pipedInstances = [
      'https://pipedapi.kavin.rocks',
      'https://api.piped.victr.me',
      'https://pipedapi.lunar.icu',
    ];

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: '*/*',
    };

    for (const instance of pipedInstances) {
      try {
        console.log(`[Audio] Trying Piped: ${instance}`);
        const response = await axios.get(`${instance}/streams/${videoId}`, {
          timeout: 8000,
          headers,
        });

        if (response.data?.audioStreams?.length > 0) {
          const best = response.data.audioStreams.sort(
            (a: any, b: any) => b.bitrate - a.bitrate
          )[0];
          console.log(`[Audio] ✓ Piped success: ${instance}`);
          return best.url;
        }
      } catch (error: any) {
        console.warn(`[Audio] Piped failed (${instance}): ${error.message}`);
      }
    }

    console.error('[Audio] All fallbacks failed');
    return null;
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

  private formatDuration(seconds: number): string {
    if (!seconds) return 'N/A';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private formatSeconds(seconds: number): string {
    if (!seconds) return 'N/A';
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
