import { createAudioPlayer, setAudioModeAsync, AudioPlayer, AudioStatus } from 'expo-audio';
import { AppState, AppStateStatus } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Song } from '../types';
import { googleDriveService } from './googleDriveService';
import { youtubeService } from './youtubeService';
import { usePlayerStore, useSettingsStore } from '../store';

const CACHE_DIR = `${FileSystem.cacheDirectory}music-cache/`;

class AudioService {
  private player: AudioPlayer | null = null;
  private currentSong: Song | null = null;
  private appStateSubscription: any;

  // ── Toggle lock ────────────────────────────────────────────────────────────
  // When the user taps play/pause we optimistically flip isPlaying in the store
  // immediately so the icon responds on the same frame. But the audio player
  // fires a playbackStatusUpdate every 500 ms and would overwrite that
  // optimistic value before the actual pause/play completes (~100–300 ms).
  // This flag suppresses isPlaying writes from the status callback for a short
  // window after every play() / pause() call.
  private _toggleLock = false;
  private _toggleLockTimer: ReturnType<typeof setTimeout> | null = null;
  // True during the window between loadAndPlay() start and player.play()
  // During this window status callbacks must not touch isPlaying
  private _isLoading = false;

  private lockToggle() {
    this._toggleLock = true;
    if (this._toggleLockTimer) clearTimeout(this._toggleLockTimer);
    // 600 ms is enough for the audio engine to settle; after that we let
    // status updates flow normally again.
    this._toggleLockTimer = setTimeout(() => {
      this._toggleLock = false;
    }, 400); // covers one 250ms tick cycle
  }

  async initialize(): Promise<void> {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
        allowsRecording: false,
      });

      this.appStateSubscription = AppState.addEventListener(
        'change',
        this.handleAppStateChange
      );

      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  private handleAppStateChange = (_nextAppState: AppStateStatus) => {
    // Expo Audio handles lock screen natively — nothing needed here.
  };

  async loadAndPlay(song: Song): Promise<void> {
    try {
      // ── Tell the UI immediately: new song is loading, show pause icon ──────
      // Previously isPlaying was only set at the end of this method, so during
      // the entire loading window (network fetch, token refresh, etc.) the icon
      // showed "play" even though a song was about to start.
      usePlayerStore.setState({
        currentSong: song,
        isPlaying: true,   // show pause icon immediately
        currentTime: 0,
        duration: 0,
      });
      this._isLoading = true; // suppress status-callback interference

      if (this.player) {
        if (typeof this.player.clearLockScreenControls === 'function') {
          this.player.clearLockScreenControls();
        }
        this.player.pause();
        this.player.remove();
        this.player = null;
      }

      this.currentSong = song;

      let songUrl = song.url;

      // Resolve YouTube URL if missing
      if (song.source === 'youtube' && !songUrl) {
        const resolvedUrl = await youtubeService.getAudioUrl(song.id);
        if (!resolvedUrl) throw new Error('Could not resolve YouTube audio URL');
        songUrl = resolvedUrl;

        const { queue, queueIndex } = usePlayerStore.getState();
        if (queue[queueIndex]?.id === song.id) {
          const updatedQueue = [...queue];
          updatedQueue[queueIndex] = { ...queue[queueIndex], url: resolvedUrl };
          usePlayerStore.setState({ queue: updatedQueue });
        }
      }

      if (!songUrl) throw new Error('Song URL is required');

      let source: any = { uri: songUrl };

      if (song.source === 'youtube') {
        source = {
          uri: songUrl,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          },
        };
      } else if (song.source === 'google-drive') {
        let localPath: string | null = null;

        if (song.localUri) {
          try {
            const info = await FileSystem.getInfoAsync(song.localUri);
            if (info.exists) localPath = song.localUri;
          } catch (e) {
            console.warn('[Audio] Failed to verify localUri:', e);
          }
        }

        if (!localPath) {
          const cached = await this.getCachedUri(song.id);
          if (cached) {
            localPath = cached;
            console.log('[Audio] Playing from JIT cache:', song.title);
          }
        }

        if (localPath) {
          source = { uri: localPath };
        } else {
          const token = await googleDriveService.getAccessToken();
          if (!token) {
            throw new Error(
              'Google Drive access token missing and song not available offline. Please sign in.'
            );
          }
          console.log('[Audio] Streaming from Drive:', song.title);
          source = {
            uri: songUrl,
            headers: { Authorization: `Bearer ${token}` },
          };
          this.cacheInBackground(song, token).catch(e =>
            console.warn('[Cache] Background task failed:', e)
          );
        }
      }

      this.player = createAudioPlayer(source, {
        keepAudioSessionActive: true,
        updateInterval: 500,
      });

      this.player.addListener(
        'playbackStatusUpdate',
        this.handlePlaybackStatusUpdate.bind(this)
      );

      this.player.play();
      this._isLoading = false; // player started — allow status updates

      if (typeof this.player.setActiveForLockScreen === 'function') {
        this.player.setActiveForLockScreen(
          true,
          {
            title: song.title || 'Unknown Title',
            artist: song.artist || 'Unknown Artist',
            albumTitle: song.album || 'Apple Music',
            artworkUrl:
              song.artwork ||
              'https://raw.githubusercontent.com/expo/expo/main/templates/expo-template-blank/assets/icon.png',
          },
          {
            showSeekBackward: true,
            showSeekForward: true,
          }
        );
      }
    } catch (error) {
      console.error('Failed to load and play:', error);
      this._isLoading = false;
      usePlayerStore.setState({ isPlaying: false });
      throw error;
    }
  }

  private handlePlaybackStatusUpdate(status: AudioStatus): void {
    // ── isPlaying is NEVER written from here during normal playback ──────────
    // The store owns isPlaying. play() and pause() write it directly and
    // immediately. Letting the status callback also write it caused 500ms–4s
    // lag because the callback fires async and overwrites the optimistic flip.
    //
    // We only write isPlaying in two edge cases:
    //   1. Song fails to load (isLoaded = false)
    //   2. Song finishes naturally (didJustFinish)

    if (!status.isLoaded) {
      // During initial load the player briefly reports isLoaded:false —
      // ignore it so we don't flip the icon back to "play" while buffering.
      // Only treat it as a real error if we're not in the middle of loading.
      if (!this._isLoading) {
        usePlayerStore.getState().setIsPlaying(false);
      }
      return;
    }

    // Sync isPlaying with actual player state — but only when not in a
    // manual play/pause toggle window (lock prevents the tick from fighting
    // the optimistic icon flip we set in play() and pause())
    if (!this._toggleLock) {
      usePlayerStore.getState().setIsPlaying(status.playing);
    }
    usePlayerStore.getState().setCurrentTime((status.currentTime || 0) * 1000);
    usePlayerStore.getState().setDuration((status.duration || 0) * 1000);

    if (status.didJustFinish) {
      // Edge case 2: natural end of song
      const { repeat, playNext, currentSong } = usePlayerStore.getState();

      if (repeat === 'one') {
        this.seekTo(0);
        this.play();
        return;
      }

      playNext();
      const nextSong = usePlayerStore.getState().currentSong;
      if (nextSong && (!currentSong || nextSong.id !== currentSong.id)) {
        this.loadAndPlay(nextSong);
      }
    }
  }

  async play(): Promise<void> {
    if (this.player) {
      this.lockToggle();                          // block status ticks for 400ms
      this.player.play();
      usePlayerStore.setState({ isPlaying: true }); // instant icon flip
    }
  }

  async pause(): Promise<void> {
    if (this.player) {
      this.lockToggle();                           // block status ticks for 400ms
      this.player.pause();
      usePlayerStore.setState({ isPlaying: false }); // instant icon flip
    }
  }

  async stop(): Promise<void> {
    if (this.player) {
      this.player.pause();
      await this.player.seekTo(0);
    }
  }

  async seekTo(positionMillis: number): Promise<void> {
    if (this.player) {
      await this.player.seekTo(positionMillis / 1000);
    }
  }

  async setVolume(volume: number): Promise<void> {
    if (this.player) {
      this.player.volume = volume;
    }
  }

  async getPosition(): Promise<number> {
    if (this.player && this.player.isLoaded) {
      return this.player.currentTime * 1000;
    }
    return 0;
  }

  async getDuration(): Promise<number> {
    if (this.player && this.player.isLoaded) {
      return this.player.duration * 1000;
    }
    return 0;
  }

  async isPlaying(): Promise<boolean> {
    if (this.player && this.player.isLoaded) {
      return this.player.playing;
    }
    return false;
  }

  private async getCachedUri(songId: string): Promise<string | null> {
    const fileUri = `${CACHE_DIR}${songId}.mp3`;
    const info = await FileSystem.getInfoAsync(fileUri);
    return info.exists ? fileUri : null;
  }

  private async cacheInBackground(song: Song, token: string): Promise<void> {
    if (song.source !== 'google-drive') return;

    const { cacheStreaming } = useSettingsStore.getState();
    if (!cacheStreaming) return;

    try {
      const dest = `${CACHE_DIR}${song.id}.mp3`;
      const info = await FileSystem.getInfoAsync(dest);
      if (info.exists) return;

      console.log(`[Cache] Caching started for: ${song.title}`);
      await FileSystem.downloadAsync(song.url, dest, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`[Cache] ✓ Cached: ${song.title}`);
    } catch (e) {
      console.warn(`[Cache] Failed for ${song.title}:`, e);
    }
  }

  getCurrentSong(): Song | null {
    return this.currentSong;
  }

  async clearCache(): Promise<void> {
    try {
      const info = await FileSystem.getInfoAsync(CACHE_DIR);
      if (info.exists) {
        await FileSystem.deleteAsync(CACHE_DIR);
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }
      console.log('[Cache] Cache cleared');
    } catch (e) {
      console.warn('[Cache] Failed to clear cache:', e);
    }
  }

  async unload(): Promise<void> {
    if (this.player) {
      if (typeof this.player.clearLockScreenControls === 'function') {
        this.player.clearLockScreenControls();
      }
      this.player.pause();
      this.player.remove();
      this.player = null;
      this.currentSong = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }
}

export const audioService = new AudioService();