import { createAudioPlayer, setAudioModeAsync, AudioPlayer, AudioStatus } from 'expo-audio';
import { AppState } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Song } from '../types';
import { googleDriveService } from './googleDriveService';
import { youtubeService } from './youtubeService';
import { usePlayerStore, useSettingsStore } from '../store/store_index';

const CACHE_DIR = `${FileSystem.cacheDirectory}music-cache/`;

class AudioService {
  private player:  AudioPlayer | null = null;
  private song:    Song | null = null;
  private appSub:  any = null;

  // Simple debounce: ignore status-driven isPlaying writes for 500ms after
  // a manual play/pause so the icon doesn't flicker back.
  private _lockUntil = 0;
  private _lock() { this._lockUntil = Date.now() + 500; }
  private _locked() { return Date.now() < this._lockUntil; }

  // ─── Init ──────────────────────────────────────────────────────────────────
  async initialize(): Promise<void> {
    try {
      await setAudioModeAsync({
        playsInSilentMode:      true,
        shouldPlayInBackground: true,
        interruptionMode:       'doNotMix',
        allowsRecording:        false,
      });
      this.appSub = AppState.addEventListener('change', () => {});
      const info = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    } catch (e) {
      console.error('[Audio] initialize error:', e);
    }
  }

  // ─── Load & Play ───────────────────────────────────────────────────────────
  async loadAndPlay(song: Song): Promise<void> {
    try {
      // 1. Update store immediately so UI shows new song + pause icon right away
      usePlayerStore.setState({ currentSong: song, isPlaying: true, currentTime: 0, duration: 0 });
      this._lock(); // prevent status ticks from overwriting isPlaying during load

      // 2. Tear down old player
      if (this.player) {
        try { this.player.pause(); } catch {}
        try { this.player.remove(); } catch {}
        this.player = null;
      }
      this.song = song;

      // 3. Resolve source
      const source = await this._resolveSource(song);

      // 4. Create player
      this.player = createAudioPlayer(source, {
        keepAudioSessionActive: true,
        updateInterval: 1000, // 1s ticks — only needed for progress bar
      });
      this.player.addListener('playbackStatusUpdate', this._onStatus.bind(this));
      this.player.play();

      // 5. Lock screen metadata
      if (typeof this.player.setActiveForLockScreen === 'function') {
        this.player.setActiveForLockScreen(true, {
          title:      song.title  || 'Unknown',
          artist:     song.artist || 'Unknown',
          albumTitle: song.album  || '',
          artworkUrl: song.artwork || '',
        }, { showSeekBackward: true, showSeekForward: true });
      }
    } catch (err) {
      console.error('[Audio] loadAndPlay error:', err);
      usePlayerStore.setState({ isPlaying: false });
    }
  }

  private async _resolveSource(song: Song): Promise<any> {
    let url = song.url;

    if (song.source === 'youtube') {
      if (!url) {
        const resolved = await youtubeService.getAudioUrl(song.id);
        if (!resolved) throw new Error('Could not resolve YouTube URL');
        url = resolved;
        // Update queue entry
        const { queue, queueIndex } = usePlayerStore.getState();
        if (queue[queueIndex]?.id === song.id) {
          const q = [...queue];
          q[queueIndex] = { ...q[queueIndex], url };
          usePlayerStore.setState({ queue: q });
        }
      }
      return {
        uri: url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      };
    }

    if (song.source === 'google-drive') {
      // Check local file first
      if (song.localUri) {
        try {
          const info = await FileSystem.getInfoAsync(song.localUri);
          if (info.exists) return { uri: song.localUri };
        } catch {}
      }
      // Check JIT cache
      const cached = await this._getCached(song.id);
      if (cached) return { uri: cached };

      // Stream with token
      const token = await googleDriveService.getAccessToken();
      if (!token) throw new Error('No Google Drive token');
      // Background cache
      this._cacheInBg(song, token);
      return { uri: url, headers: { Authorization: `Bearer ${token}` } };
    }

    // offline / streaming-url / default
    return { uri: url };
  }

  // ─── Status callback — batched single setState ────────────────────────────
  private _onStatus(status: AudioStatus): void {
    if (!status.isLoaded) return; // ignore pre-load ticks

    const update: Record<string, any> = {
      currentTime: (status.currentTime || 0) * 1000,
      duration:    (status.duration    || 0) * 1000,
    };

    // Only sync isPlaying from engine when not in manual-toggle lock window
    if (!this._locked()) {
      update.isPlaying = status.playing;
    }

    // Single setState = single re-render
    usePlayerStore.setState(update);

    if (status.didJustFinish) this._onFinish();
  }

  private _onFinish(): void {
    const { repeat, playNext, currentSong } = usePlayerStore.getState();
    if (repeat === 'one') {
      this.seekTo(0);
      this.play();
      return;
    }
    playNext();
    const next = usePlayerStore.getState().currentSong;
    if (next && next.id !== currentSong?.id) this.loadAndPlay(next);
  }

  // ─── Controls ─────────────────────────────────────────────────────────────
  play(): void {
    if (!this.player) return;
    this._lock();
    this.player.play();
    usePlayerStore.setState({ isPlaying: true });
  }

  pause(): void {
    if (!this.player) return;
    this._lock();
    this.player.pause();
    usePlayerStore.setState({ isPlaying: false });
  }

  async seekTo(ms: number): Promise<void> {
    if (this.player) await this.player.seekTo(ms / 1000);
  }

  async setVolume(v: number): Promise<void> {
    if (this.player) this.player.volume = v;
  }

  async unload(): Promise<void> {
    if (this.player) {
      try { this.player.pause(); } catch {}
      try { this.player.remove(); } catch {}
      this.player = null;
    }
    this.song = null;
    if (this.appSub) { this.appSub.remove(); this.appSub = null; }
  }

  async clearCache(): Promise<void> {
    try {
      const info = await FileSystem.getInfoAsync(CACHE_DIR);
      if (info.exists) {
        await FileSystem.deleteAsync(CACHE_DIR);
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }
    } catch {}
  }

  getCurrentSong(): Song | null { return this.song; }

  // ─── Cache helpers ────────────────────────────────────────────────────────
  private async _getCached(id: string): Promise<string | null> {
    const uri = `${CACHE_DIR}${id}.mp3`;
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? uri : null;
  }

  private async _cacheInBg(song: Song, token: string): Promise<void> {
    if (!useSettingsStore.getState().cacheStreaming) return;
    try {
      const dest = `${CACHE_DIR}${song.id}.mp3`;
      if ((await FileSystem.getInfoAsync(dest)).exists) return;
      await FileSystem.downloadAsync(song.url, dest, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  }
}

export const audioService = new AudioService();