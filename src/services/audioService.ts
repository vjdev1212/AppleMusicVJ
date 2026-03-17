import { createAudioPlayer, setAudioModeAsync, AudioPlayer, AudioStatus } from 'expo-audio';
import { AppState, AppStateStatus } from 'react-native';
import { Song } from '../types';
import { googleDriveService } from './googleDriveService';
import { youtubeService } from './youtubeService';
import { usePlayerStore } from '../store';

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
        const resolvedUrl = await youtubeService.getAudioUrl(song.id);
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
      
      if (song.source === 'google-drive') {
        const token = await googleDriveService.getAccessToken();
        if (!token) {
           throw new Error('Google Drive access token missing. Please sign in again.');
        }
        source = {
          uri: songUrl,
          headers: {
            Authorization: `Bearer ${token}`
          }
        };
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

  getCurrentSong(): Song | null {
    return this.currentSong;
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
