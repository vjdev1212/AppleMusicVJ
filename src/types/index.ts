// Types for the music player app

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  artwork?: string;
  url: string;
  source: 'google-drive' | 'streaming-url' | 'youtube';
  fileId?: string; // Google Drive file ID
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  artwork?: string;
  songs: Song[];
  source: 'google-drive' | 'streaming' | 'favorites' | 'recently-played';
  folderId?: string; // Google Drive folder ID
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
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  backgroundPlayback: boolean;
  audioQuality: 'low' | 'medium' | 'high';
  cacheStreaming: boolean;
  streamingUrls: string[];
}

export interface RootState {
  player: PlayerState;
  googleDrive: GoogleDriveState;
  settings: AppSettings;
  playlists: Playlist[];
}
