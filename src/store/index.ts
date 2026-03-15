import { create } from 'zustand';
import { Song, Playlist, PlayerState, GoogleDriveState, AppSettings } from '../types';

interface PlayerStore extends PlayerState {
  setCurrentSong: (song: Song | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setQueue: (queue: Song[], startIndex?: number) => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeat: (repeat: 'off' | 'all' | 'one') => void;
  setVolume: (volume: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  togglePlayPause: () => void;
}

interface GoogleDriveStore extends GoogleDriveState {
  setConnected: (connected: boolean, accessToken?: string, refreshToken?: string, email?: string) => void;
  setDisconnected: () => void;
  setLastScan: (date: Date) => void;
}

interface SettingsStore extends AppSettings {
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setBackgroundPlayback: (enabled: boolean) => void;
  setAudioQuality: (quality: 'low' | 'medium' | 'high') => void;
  setCacheStreaming: (enabled: boolean) => void;
  addStreamingUrl: (url: string) => void;
  removeStreamingUrl: (url: string) => void;
}

interface PlaylistStore {
  playlists: Playlist[];
  recentlyPlayed: Song[];
  favorites: Song[];
  setPlaylists: (playlists: Playlist[]) => void;
  addPlaylist: (playlist: Playlist) => void;
  updatePlaylist: (id: string, updates: Partial<Playlist>) => void;
  removePlaylist: (id: string) => void;
  addToRecentlyPlayed: (song: Song) => void;
  addToFavorites: (song: Song) => void;
  removeFromFavorites: (songId: string) => void;
}

// Player Store
export const usePlayerStore = create<PlayerStore>()((set, get) => ({
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  queue: [],
  queueIndex: 0,
  shuffle: false,
  repeat: 'off',
  volume: 1,

  setCurrentSong: (song) => set({ currentSong: song }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  
  setQueue: (queue, startIndex = 0) => set({ 
    queue, 
    queueIndex: startIndex,
    currentSong: queue[startIndex] || null 
  }),
  
  addToQueue: (song) => set((state) => ({ 
    queue: [...state.queue, song] 
  })),
  
  removeFromQueue: (index) => set((state) => ({
    queue: state.queue.filter((_, i) => i !== index)
  })),
  
  clearQueue: () => set({ queue: [], queueIndex: 0, currentSong: null }),
  
  setShuffle: (shuffle) => set({ shuffle }),
  setRepeat: (repeat) => set({ repeat }),
  setVolume: (volume) => set({ volume }),
  
  playNext: () => {
    const { queue, queueIndex, shuffle, repeat } = get();
    if (queue.length === 0) return;

    let nextIndex = queueIndex + 1;
    
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0;
      } else {
        return;
      }
    }

    set({ 
      queueIndex: nextIndex,
      currentSong: queue[nextIndex],
      currentTime: 0
    });
  },
  
  playPrevious: () => {
    const { queue, queueIndex, currentTime } = get();
    if (queue.length === 0) return;

    // If more than 3 seconds in, restart current song
    if (currentTime > 3) {
      set({ currentTime: 0 });
      return;
    }

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }

    set({ 
      queueIndex: prevIndex,
      currentSong: queue[prevIndex],
      currentTime: 0
    });
  },
  
  togglePlayPause: () => {
    const { isPlaying } = get();
    set({ isPlaying: !isPlaying });
  },
}));

// Google Drive Store
export const useGoogleDriveStore = create<GoogleDriveStore>()((set) => ({
  isConnected: false,
  accessToken: null,
  refreshToken: null,
  email: null,
  lastScan: null,

  setConnected: (connected, accessToken, refreshToken, email) => set({ 
    isConnected: connected,
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
    email: email || null
  }),
  
  setDisconnected: () => set({ 
    isConnected: false,
    accessToken: null,
    refreshToken: null,
    email: null,
    lastScan: null
  }),
  
  setLastScan: (date) => set({ lastScan: date }),
}));

// Settings Store
export const useSettingsStore = create<SettingsStore>()((set) => ({
  theme: 'system',
  backgroundPlayback: true,
  audioQuality: 'high',
  cacheStreaming: false,
  streamingUrls: [],

  setTheme: (theme) => set({ theme }),
  setBackgroundPlayback: (backgroundPlayback) => set({ backgroundPlayback }),
  setAudioQuality: (audioQuality) => set({ audioQuality }),
  setCacheStreaming: (cacheStreaming) => set({ cacheStreaming }),
  
  addStreamingUrl: (url) => set((state) => ({
    streamingUrls: [...state.streamingUrls, url]
  })),
  
  removeStreamingUrl: (url) => set((state) => ({
    streamingUrls: state.streamingUrls.filter((u) => u !== url)
  })),
}));

// Playlist Store
export const usePlaylistStore = create<PlaylistStore>()((set) => ({
  playlists: [],
  recentlyPlayed: [],
  favorites: [],

  setPlaylists: (playlists) => set({ playlists }),
  
  addPlaylist: (playlist) => set((state) => ({
    playlists: [...state.playlists, playlist]
  })),
  
  updatePlaylist: (id, updates) => set((state) => ({
    playlists: state.playlists.map((p) => 
      p.id === id ? { ...p, ...updates } : p
    )
  })),
  
  removePlaylist: (id) => set((state) => ({
    playlists: state.playlists.filter((p) => p.id !== id)
  })),
  
  addToRecentlyPlayed: (song) => set((state) => {
    const filtered = state.recentlyPlayed.filter((s) => s.id !== song.id);
    return { 
      recentlyPlayed: [song, ...filtered].slice(0, 50) 
    };
  }),
  
  addToFavorites: (song) => set((state) => ({
    favorites: [...state.favorites, song]
  })),
  
  removeFromFavorites: (songId) => set((state) => ({
    favorites: state.favorites.filter((s) => s.id !== songId)
  })),
}));
