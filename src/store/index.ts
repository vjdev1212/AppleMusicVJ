import { create } from 'zustand';
import { Song, Playlist, PlayerState, GoogleDriveState, AppSettings } from '../types';
import { DriveFolder } from '../services/playlistSyncService';

// ─── Player Store ─────────────────────────────────────────────────────────────
interface PlayerStore extends PlayerState {
  setCurrentSong:  (song: Song | null) => void;
  setIsPlaying:    (isPlaying: boolean) => void;
  setCurrentTime:  (time: number) => void;
  setDuration:     (duration: number) => void;
  setQueue:        (queue: Song[], startIndex?: number) => void;
  addToQueue:      (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue:      () => void;
  setShuffle:      (shuffle: boolean) => void;
  setRepeat:       (repeat: 'off' | 'all' | 'one') => void;
  setVolume:       (volume: number) => void;
  playNext:        () => void;
  playPrevious:    () => void;
  togglePlayPause: () => void;
}

// ─── Google Drive Store ───────────────────────────────────────────────────────
interface GoogleDriveStore extends GoogleDriveState {
  setConnected:    (connected: boolean, accessToken?: string, refreshToken?: string, email?: string) => void;
  setDisconnected: () => void;
  setLastScan:     (date: Date) => void;
  setScanning:     (isScanning: boolean) => void;
  setScanProgress: (progress: number) => void;
  setScanStatus:   (status: string) => void;
}

// ─── Settings Store ───────────────────────────────────────────────────────────
interface SettingsStore extends AppSettings {
  setTheme:             (theme: 'light' | 'dark' | 'system') => void;
  setBackgroundPlayback:(enabled: boolean) => void;
  setAudioQuality:      (quality: 'low' | 'medium' | 'high') => void;
  setCacheStreaming:     (enabled: boolean) => void;
  setOfflineMode:       (enabled: boolean) => void;
  setDownloadPath:      (path: string) => void;
  addStreamingUrl:      (url: string) => void;
  removeStreamingUrl:   (url: string) => void;
  setGoogleDriveClientId:(clientId: string) => void;
  setYoutubeApiKey:     (apiKey: string) => void;
  setSpotifyClientId:   (clientId: string) => void;
  setSpotifyClientSecret:(secret: string) => void;
  testUser:             string;
  setTestUser:          (email: string) => void;
}

// ─── Playlist Store ───────────────────────────────────────────────────────────
interface PlaylistStore {
  playlists:        Playlist[];
  recentlyPlayed:   Song[];
  favorites:        Song[];
  setPlaylists:     (playlists: Playlist[]) => void;
  addPlaylist:      (playlist: Playlist) => void;
  updatePlaylist:   (id: string, updates: Partial<Playlist>) => void;
  removePlaylist:   (id: string) => void;
  addToRecentlyPlayed:(song: Song) => void;
  addToFavorites:   (song: Song) => void;
  removeFromFavorites:(songId: string) => void;
  addSongToPlaylist:(playlistId: string, song: Song) => void;
  updateSongInPlaylist:(playlistId: string, songId: string, updates: Partial<Song>) => void;
}

// ─── Sync Store — persisted folder selection & cached playlists ───────────────
export interface SyncStore {
  // Available sub-folders inside Google Drive "Music" folder
  availableFolders:    DriveFolder[];
  // Folder IDs the user has selected (persisted across launches)
  selectedFolderIds:   string[];
  // Playlists loaded for selected folders (persisted across launches)
  syncedPlaylists:     Playlist[];
  // Loading states
  isFetchingFolders:   boolean;
  isSyncingFolder:     string | null;  // folder ID currently syncing, null = idle
  syncProgress:        number;         // 0–1

  setAvailableFolders:  (folders: DriveFolder[]) => void;
  setSelectedFolderIds: (ids: string[]) => void;
  addSelectedFolderId:  (id: string) => void;
  setSyncedPlaylists:   (playlists: Playlist[]) => void;
  addSyncedPlaylist:    (playlist: Playlist) => void;
  setIsFetchingFolders: (v: boolean) => void;
  setIsSyncingFolder:   (folderId: string | null) => void;
  setSyncProgress:      (v: number) => void;
}

// ─── Store implementations ───────────────────────────────────────────────────

export const usePlayerStore = create<PlayerStore>()((set, get) => ({
  currentSong: null,
  isPlaying:   false,
  currentTime: 0,
  duration:    0,
  queue:       [],
  queueIndex:  0,
  shuffle:     false,
  repeat:      'off',
  volume:      1,

  setCurrentSong:  (song)        => set({ currentSong: song }),
  setIsPlaying:    (isPlaying)   => set({ isPlaying }),
  setCurrentTime:  (currentTime) => set({ currentTime }),
  setDuration:     (duration)    => set({ duration }),

  setQueue: (queue, startIndex = 0) => set({
    queue,
    queueIndex:  startIndex,
    currentSong: queue[startIndex] || null,
  }),

  addToQueue:      (song)  => set(s => ({ queue: [...s.queue, song] })),
  removeFromQueue: (index) => set(s => ({ queue: s.queue.filter((_, i) => i !== index) })),
  clearQueue:      ()      => set({ queue: [], queueIndex: 0, currentSong: null }),
  setShuffle:      (shuffle) => set({ shuffle }),
  setRepeat:       (repeat)  => set({ repeat }),
  setVolume:       (volume)  => set({ volume }),

  playNext: () => {
    const { queue, queueIndex, shuffle, repeat } = get();
    if (!queue.length) return;
    let next = queueIndex + 1;
    if (shuffle) {
      next = Math.floor(Math.random() * queue.length);
    } else if (next >= queue.length) {
      if (repeat === 'all') next = 0;
      else return;
    }
    set({ queueIndex: next, currentSong: queue[next], currentTime: 0 });
  },

  playPrevious: () => {
    const { queue, queueIndex, currentTime } = get();
    if (!queue.length) return;
    if (currentTime > 3000) { set({ currentTime: 0 }); return; }
    const prev = queueIndex > 0 ? queueIndex - 1 : queue.length - 1;
    set({ queueIndex: prev, currentSong: queue[prev], currentTime: 0 });
  },

  togglePlayPause: () => set(s => ({ isPlaying: !s.isPlaying })),
}));

export const useGoogleDriveStore = create<GoogleDriveStore>()((set) => ({
  isConnected:  false,
  accessToken:  null,
  refreshToken: null,
  email:        null,
  lastScan:     null,
  isScanning:   false,
  scanProgress: 0,
  scanStatus:   '',

  setConnected: (connected, accessToken, refreshToken, email) => set({
    isConnected:  connected,
    accessToken:  accessToken  || null,
    refreshToken: refreshToken || null,
    email:        email        || null,
  }),
  setDisconnected: () => set({
    isConnected: false, accessToken: null,
    refreshToken: null, email: null, lastScan: null,
  }),
  setLastScan:     (date)       => set({ lastScan: date }),
  setScanning:     (isScanning) => set({ isScanning }),
  setScanProgress: (scanProgress) => set({ scanProgress }),
  setScanStatus:   (scanStatus)   => set({ scanStatus }),
}));

export const useSettingsStore = create<SettingsStore>()((set) => ({
  theme:              'system',
  backgroundPlayback: true,
  audioQuality:       'high',
  cacheStreaming:     false,
  isOfflineMode:      true,
  downloadPath:       'downloads/',
  streamingUrls:      [],
  googleDriveClientId:'706156834841-89cufgqr5n44h81utu4b9lg1dt3jk9mh.apps.googleusercontent.com',
  youtubeApiKey:      'AIzaSyBb6sozj32MeGUsOAE_06peS7GH16CPLi8',
  spotifyClientId:    '',
  spotifyClientSecret:'',
  testUser:           '',

  setTheme:              (theme)             => set({ theme }),
  setBackgroundPlayback: (backgroundPlayback)=> set({ backgroundPlayback }),
  setAudioQuality:       (audioQuality)      => set({ audioQuality }),
  setCacheStreaming:      (cacheStreaming)     => set({ cacheStreaming }),
  setOfflineMode:        (isOfflineMode)      => set({ isOfflineMode }),
  setDownloadPath:       (downloadPath)       => set({ downloadPath }),
  addStreamingUrl:    (url) => set(s => ({ streamingUrls: [...s.streamingUrls, url] })),
  removeStreamingUrl: (url) => set(s => ({ streamingUrls: s.streamingUrls.filter(u => u !== url) })),
  setGoogleDriveClientId: (googleDriveClientId) => set({ googleDriveClientId }),
  setYoutubeApiKey:       (youtubeApiKey)        => set({ youtubeApiKey }),
  setSpotifyClientId:     (spotifyClientId)       => set({ spotifyClientId }),
  setSpotifyClientSecret: (spotifyClientSecret)   => set({ spotifyClientSecret }),
  setTestUser:            (testUser)              => set({ testUser }),
}));

export const usePlaylistStore = create<PlaylistStore>()((set) => ({
  playlists:      [],
  recentlyPlayed: [],
  favorites:      [],

  setPlaylists: (playlists) => set({ playlists }),
  addPlaylist:  (playlist)  => set(s => ({ playlists: [...s.playlists, playlist] })),

  updatePlaylist: (id, updates) => set(s => ({
    playlists: s.playlists.map(p => p.id === id ? { ...p, ...updates } : p),
  })),
  removePlaylist: (id) => set(s => ({
    playlists: s.playlists.filter(p => p.id !== id),
  })),

  addToRecentlyPlayed: (song) => set(s => {
    const filtered = s.recentlyPlayed.filter(x => x.id !== song.id);
    return { recentlyPlayed: [song, ...filtered].slice(0, 50) };
  }),
  addToFavorites:    (song)   => set(s => ({ favorites: [...s.favorites, song] })),
  removeFromFavorites:(songId) => set(s => ({ favorites: s.favorites.filter(x => x.id !== songId) })),

  addSongToPlaylist: (playlistId, song) => set(s => ({
    playlists: s.playlists.map(p =>
      p.id === playlistId ? { ...p, songs: [...p.songs, song] } : p
    ),
  })),
  updateSongInPlaylist: (playlistId, songId, updates) => set(s => ({
    playlists: s.playlists.map(p =>
      p.id === playlistId
        ? { ...p, songs: p.songs.map(song => song.id === songId ? { ...song, ...updates } : song) }
        : p
    ),
  })),
}));

// ─── Sync Store ───────────────────────────────────────────────────────────────
export const useSyncStore = create<SyncStore>()((set) => ({
  availableFolders:  [],
  selectedFolderIds: [],
  syncedPlaylists:   [],
  isFetchingFolders: false,
  isSyncingFolder:   null,
  syncProgress:      0,

  setAvailableFolders:  (folders)   => set({ availableFolders: folders }),
  setSelectedFolderIds: (ids)       => set({ selectedFolderIds: ids }),
  addSelectedFolderId:  (id)        => set(s => ({
    selectedFolderIds: s.selectedFolderIds.includes(id)
      ? s.selectedFolderIds
      : [...s.selectedFolderIds, id],
  })),
  setSyncedPlaylists:   (playlists) => set({ syncedPlaylists: playlists }),
  addSyncedPlaylist:    (playlist)  => set(s => {
    // Replace if already exists, otherwise append
    const exists = s.syncedPlaylists.some(p => p.id === playlist.id);
    return {
      syncedPlaylists: exists
        ? s.syncedPlaylists.map(p => p.id === playlist.id ? playlist : p)
        : [...s.syncedPlaylists, playlist],
    };
  }),
  setIsFetchingFolders: (v) => set({ isFetchingFolders: v }),
  setIsSyncingFolder:   (v) => set({ isSyncingFolder: v }),
  setSyncProgress:      (v) => set({ syncProgress: v }),
}));
