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

  async initialize(): Promise<void> {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
        allowsRecording: false,
      });

      // Keep track of app state because lock screen sometimes needs refreshing
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

      // Ensure cache directory exists
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    // Optionally refresh metadata if needed, but usually Expo Audio handles it natively.
  };

  // Left empty since they are removed

  async loadAndPlay(song: Song): Promise<void> {
    try {
      if (this.player) {
        if (typeof this.player.clearLockScreenControls === 'function') {
           this.player.clearLockScreenControls();
        }
        this.player.pause(); // Prevents zombie sounds overlapping!
        this.player.remove();
        this.player = null;
      }

      this.currentSong = song;

      let songUrl = song.url;
      
      // Resolve YouTube URL if missing
      if (song.source === 'youtube' && !songUrl) {
        const { audioQuality } = useSettingsStore.getState();
        const resolvedUrl = await youtubeService.getAudioUrl(song.id, audioQuality);
        if (!resolvedUrl) {
          throw new Error('Could not resolve YouTube audio URL');
        }
        songUrl = resolvedUrl;
        // Optionally update the song object in the store/queue
        const { queue, queueIndex } = usePlayerStore.getState();
        if (queue[queueIndex] && queue[queueIndex].id === song.id) {
          const updatedQueue = [...queue];
          updatedQueue[queueIndex] = { ...queue[queueIndex], url: resolvedUrl };
          usePlayerStore.setState({ queue: updatedQueue });
        }
      }

      if (!songUrl) {
        throw new Error('Song URL is required');
      }

      let source: any = { uri: songUrl };
      
      // Set headers for playback to avoid 403/Forbidden from YouTube/CDNs
      if (song.source === 'youtube') {
        source = {
          uri: songUrl,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          }
        };
      } else if (song.source === 'google-drive') {
        // 1. Check PERMANENT local storage (from Sync)
        let localPath: string | null = null;
        if (song.localUri) {
          try {
            const info = await FileSystem.getInfoAsync(song.localUri);
            if (info.exists) {
              localPath = song.localUri;
            }
          } catch (e) {
            console.warn('[Audio] Failed to verify localUri:', e);
          }
        }

        // 2. Check JIT CACHE if not in permanent storage
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
          // 3. ONLY if not local, then check token and stream
          const token = await googleDriveService.getAccessToken();
          if (!token) {
            throw new Error('Google Drive access token missing and song not available offline. Please sign in.');
          }

          console.log('[Audio] Streaming from Drive:', song.title);
          source = {
            uri: songUrl,
            headers: { Authorization: `Bearer ${token}` }
          };
          
          // Trigger background cache
          this.cacheInBackground(song, token).catch(e => console.warn('[Cache] Background task failed:', e));
        }
      }

      // Create new expo-audio player
      this.player = createAudioPlayer(source, { 
        keepAudioSessionActive: true,
        updateInterval: 500
      });

      this.player.addListener('playbackStatusUpdate', this.handlePlaybackStatusUpdate.bind(this));
      
      this.player.play();

      // Set Lock Screen Metadata natively using expo-audio SDK 54!
      if (typeof this.player.setActiveForLockScreen === 'function') {
        this.player.setActiveForLockScreen(true, {
          title: song.title || 'Unknown Title',
          artist: song.artist || 'Unknown Artist',
          albumTitle: song.album || 'Apple Music',
          artworkUrl: song.artwork || 'https://raw.githubusercontent.com/expo/expo/main/templates/expo-template-blank/assets/icon.png',
        }, {
          showSeekBackward: true,
          showSeekForward: true,
        });
      }

    } catch (error) {
      console.error('Failed to load and play:', error);
      usePlayerStore.getState().setIsPlaying(false);
      throw error;
    }
  }

  private handlePlaybackStatusUpdate(status: AudioStatus): void {
    if (!status.isLoaded) {
      usePlayerStore.getState().setIsPlaying(false);
      return;
    }

    usePlayerStore.getState().setIsPlaying(status.playing);
    usePlayerStore.getState().setCurrentTime((status.currentTime || 0) * 1000);
    usePlayerStore.getState().setDuration((status.duration || 0) * 1000);

    if (status.didJustFinish) {
      // Auto-play the next song or loop based on globals!
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
      this.player.play();
    }
  }

  async pause(): Promise<void> {
    if (this.player) {
      this.player.pause();
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
      await this.player.seekTo(positionMillis / 1000); // expo-audio takes seconds!
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
    // Only cache Google Drive songs for now
    if (song.source !== 'google-drive') return;
    
    // Check if user enabled caching in settings
    const { cacheStreaming } = useSettingsStore.getState();
    if (!cacheStreaming) return;

    try {
      const dest = `${CACHE_DIR}${song.id}.mp3`;
      // Check again if it was downloaded while we were deciding
      const info = await FileSystem.getInfoAsync(dest);
      if (info.exists) return;

      console.log(`[Cache] Caching started for: ${song.title}`);
      await FileSystem.downloadAsync(song.url, dest, {
        headers: { Authorization: `Bearer ${token}` }
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
