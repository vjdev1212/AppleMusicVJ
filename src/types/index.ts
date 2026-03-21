// Types for the music player app

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  artwork?: string;
  url: string;
  source: 'google-drive' | 'streaming-url' | 'youtube' | 'offline';
  fileId?: string; // Google Drive file ID
  localUri?: string; // Local file system URI
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  artwork?: string;
  songs: Song[];
  source: 'google-drive' | 'streaming' | 'favorites' | 'recently-played' | 'offline';
  folderId?: string; // Google Drive folder ID
  isOffline?: boolean;
}

export interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: Song[];
  queueIndex: number;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  volume: number;
}

export interface GoogleDriveState {
  isConnected: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
  lastScan: Date | null;
  isScanning: boolean;
  scanProgress: number; // 0 to 1
  scanStatus: string; // Detailed status message
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  backgroundPlayback: boolean;
  audioQuality: 'low' | 'medium' | 'high';
  cacheStreaming: boolean;
  isOfflineMode: boolean;
  downloadPath: string;
  streamingUrls: string[];
  // API Tokens
  googleDriveClientId: string;
  youtubeApiKey: string;
  spotifyClientId: string;
  spotifyClientSecret: string;
}

export interface RootState {
  player: PlayerState;
  googleDrive: GoogleDriveState;
  settings: AppSettings;
  playlists: Playlist[];
}
