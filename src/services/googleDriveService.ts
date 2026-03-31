import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { Playlist, Song } from '../types';
import { parseBuffer } from 'music-metadata-browser';
import * as FileSystem from 'expo-file-system/legacy';
import { useGoogleDriveStore, useSettingsStore, usePlaylistStore } from '../store';
import { Buffer } from 'buffer';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = '707441092866-71mnlkak61ms6llchle9d14i4n5gop9o.apps.googleusercontent.com';
const PROJECT_FULL_NAME = '@viki28593/apple-music-player';
const ACCESS_TOKEN_KEY = 'google_access_token';
const REFRESH_TOKEN_KEY = 'google_refresh_token';
const TOKEN_EXPIRY_KEY = 'google_token_expiry';
const EMAIL_KEY = 'google_email';

// ─── How many folders to scan in parallel ────────────────────────────────────
const PARALLEL_FOLDER_LIMIT = 4;

// ─── Tiny helper: run promises in batches ────────────────────────────────────
async function parallelBatch<T>(
  items: any[],
  limit: number,
  fn: (item: any) => Promise<T>
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

class GoogleDriveService {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null; // Unix ms
  private email: string | null = null;
  // Tracks an in-flight refresh so concurrent callers don't double-refresh
  private refreshPromise: Promise<boolean> | null = null;

  // ─── Auth ──────────────────────────────────────────────────────────────────

  async connect(): Promise<{ success: boolean; error?: string }> {
    try {
      const returnUrl = AuthSession.makeRedirectUri();
      const exactRedirectUri = `https://auth.expo.io/${PROJECT_FULL_NAME}`;

      // Request offline access so we get a refresh_token
      const googleAuthUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(exactRedirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(
          'https://www.googleapis.com/auth/drive.readonly profile email'
        )}` +
        `&prompt=select_account%20consent`;

      const proxyStartUrl =
        `${exactRedirectUri}/start?` +
        `authUrl=${encodeURIComponent(googleAuthUrl)}` +
        `&returnUrl=${encodeURIComponent(returnUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(proxyStartUrl, returnUrl);
      if (result.type !== 'success') {
        return { success: false, error: 'Authentication cancelled or failed.' };
      }

      const resultUrl = result.url;

      // Extract access token
      const accessMatch = resultUrl.match(/access_token=([^&]+)/);
      this.accessToken = accessMatch ? decodeURIComponent(accessMatch[1]) : null;

      // Extract expires_in (seconds) and compute absolute expiry
      const expiresMatch = resultUrl.match(/expires_in=([^&]+)/);
      const expiresIn = expiresMatch ? parseInt(expiresMatch[1], 10) : 3600;
      this.tokenExpiry = Date.now() + expiresIn * 1000 - 60_000; // 1 min buffer

      // Extract refresh token if present (implicit flow may not return one)
      const refreshMatch = resultUrl.match(/refresh_token=([^&]+)/);
      const refreshToken = refreshMatch ? decodeURIComponent(refreshMatch[1]) : null;

      if (!this.accessToken) {
        return { success: false, error: 'No access token received.' };
      }

      // Fetch email
      try {
        const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
        const data = await resp.json();
        this.email = data.email ?? 'user@gmail.com';
      } catch {
        this.email = 'user@gmail.com';
      }

      // Persist everything
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, this.accessToken!);
      await SecureStore.setItemAsync(TOKEN_EXPIRY_KEY, String(this.tokenExpiry));
      if (this.email) await SecureStore.setItemAsync(EMAIL_KEY, this.email);
      if (refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);

      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Google Drive connection error:', error);
      return { success: false, error: `Failed to connect: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
      await SecureStore.deleteItemAsync(EMAIL_KEY);
      this.accessToken = null;
      this.tokenExpiry = null;
      this.email = null;
    } catch (error) {
      console.error('[Auth] Error disconnecting:', error);
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (!token) return false;

      const expiryStr = await SecureStore.getItemAsync(TOKEN_EXPIRY_KEY);
      this.tokenExpiry = expiryStr ? parseInt(expiryStr, 10) : null;
      this.accessToken = token;

      const email = await SecureStore.getItemAsync(EMAIL_KEY);
      if (email) this.email = email;

      // If token looks expired, try refresh before making a real call
      if (this.isTokenExpired()) {
        const refreshed = await this.silentRefresh();
        if (!refreshed) {
          // Fall through to live verification below
        }
      }

      // Verify live
      const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (resp.status === 401) {
        // Try one silent refresh before giving up
        const refreshed = await this.silentRefresh();
        if (!refreshed) {
          await this.disconnect();
          return false;
        }
        // Verify once more
        const retry = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
        if (!retry.ok) {
          await this.disconnect();
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  // ─── Token Management ──────────────────────────────────────────────────────

  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return false;
    return Date.now() >= this.tokenExpiry;
  }

  /**
   * Attempt a silent token refresh using the stored refresh_token.
   * Returns true if a new access token was obtained, false otherwise.
   * Deduplicates concurrent calls so only ONE network request is made.
   */
  private async silentRefresh(): Promise<boolean> {
    // Deduplicate concurrent refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._doRefresh().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async _doRefresh(): Promise<boolean> {
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        console.warn('[Auth] No refresh token stored — cannot silent refresh');
        return false;
      }

      console.log('[Auth] Attempting silent token refresh...');
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:
          `client_id=${CLIENT_ID}` +
          `&refresh_token=${encodeURIComponent(refreshToken)}` +
          `&grant_type=refresh_token`,
      });

      if (!response.ok) {
        console.warn('[Auth] Refresh token exchange failed:', response.status);
        return false;
      }

      const data = await response.json();
      if (!data.access_token) return false;

      this.accessToken = data.access_token;
      const expiresIn = data.expires_in ?? 3600;
      this.tokenExpiry = Date.now() + expiresIn * 1000 - 60_000;

      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, this.accessToken!);
      await SecureStore.setItemAsync(TOKEN_EXPIRY_KEY, String(this.tokenExpiry));

      // Google may issue a new refresh token too
      if (data.refresh_token) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.refresh_token);
      }

      console.log('[Auth] ✓ Silent refresh succeeded');
      return true;
    } catch (err) {
      console.error('[Auth] Silent refresh error:', err);
      return false;
    }
  }

  /**
   * Returns a valid access token, refreshing silently if needed.
   * Use this everywhere instead of reading this.accessToken directly.
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.accessToken) {
      await this.isConnected();
    }

    if (this.isTokenExpired()) {
      const refreshed = await this.silentRefresh();
      if (!refreshed) {
        console.warn('[Auth] Could not refresh token — user may need to reconnect');
        return null;
      }
    }

    return this.accessToken;
  }

  async getEmail(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(EMAIL_KEY);
    } catch {
      return null;
    }
  }

  // ─── Authenticated fetch wrapper with auto-retry on 401 ───────────────────

  private async authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken();
    if (!token) throw new Error('Not authenticated. Please reconnect Google Drive.');

    const headers = {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(url, { ...options, headers });

    // One automatic retry after silent refresh on 401
    if (response.status === 401) {
      console.warn('[Auth] 401 received — attempting silent refresh and retry');
      const refreshed = await this.silentRefresh();
      if (refreshed && this.accessToken) {
        response = await fetch(url, {
          ...options,
          headers: { ...(options.headers ?? {}), Authorization: `Bearer ${this.accessToken}` },
        });
      } else {
        await this.disconnect();
        throw new Error('Google Drive session expired. Please reconnect.');
      }
    }

    return response;
  }

  // ─── Folder Listing ────────────────────────────────────────────────────────

  async getFolders(): Promise<{ id: string; name: string }[]> {
    const response = await this.authedFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        "mimeType='application/vnd.google-apps.folder' and trashed=false"
      )}&fields=files(id,name)&pageSize=100`
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.files || [];
  }

  // ─── Auto-scan ─────────────────────────────────────────────────────────────

  async autoScanMusicFolder(): Promise<Playlist[]> {
    const store = useGoogleDriveStore.getState();
    store.setScanning(true);
    store.setScanProgress(0);

    try {
      store.setScanStatus('Connecting to Google Drive...');
      const folders = await this.getFolders();

      if (folders.length === 0) {
        store.setScanStatus('No folders found in Google Drive');
        store.setScanning(false);
        return [];
      }

      store.setScanStatus(`Found ${folders.length} folders, searching for Music folder...`);

      const musicFolder = folders.find(f => f.name.toLowerCase() === 'music');
      if (!musicFolder) {
        store.setScanStatus('No "Music" folder found');
        store.setScanning(false);
        return [];
      }

      store.setScanStatus('Found Music folder, scanning playlists in parallel...');
      const playlists = await this.scanDrive(musicFolder.id, musicFolder.name);
      store.setScanStatus(`✓ Found ${playlists.length} playlists`);
      store.setScanning(false);
      return playlists;
    } catch (error) {
      console.error('[Scan] autoScanMusicFolder error:', error);
      store.setScanStatus('Error scanning Google Drive');
      store.setScanning(false);
      return [];
    }
  }

  // ─── Parallel Drive Scanner ────────────────────────────────────────────────

  /**
   * Recursively scan a folder for audio files, processing sub-folders
   * PARALLEL_FOLDER_LIMIT at a time instead of one-by-one.
   */
  async scanDrive(
    folderId: string,
    folderName: string,
    onProgress?: (done: number, total: number, itemName?: string) => void,
    _progressState?: { done: number; total: number }
  ): Promise<Playlist[]> {
    const store = useGoogleDriveStore.getState();

    // ── 1. Fetch sub-folders and audio files simultaneously ──
    store.setScanStatus(`Scanning: ${folderName}...`);

    const [folderRes, filesRes] = await Promise.all([
      this.authedFetch(
        `https://www.googleapis.com/drive/v3/files` +
        `?q=${encodeURIComponent(
          `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        )}&fields=files(id,name)&pageSize=100`
      ),
      this.authedFetch(
        `https://www.googleapis.com/drive/v3/files` +
        `?q=${encodeURIComponent(
          `'${folderId}' in parents and (mimeType contains 'audio/' or name contains '.mp3' or name contains '.m4a') and trashed=false`
        )}&fields=files(id,name,size,mimeType)&pageSize=1000`
      ),
    ]);

    const folderData = await folderRes.json();
    const filesData  = await filesRes.json();

    if (folderData.error) throw new Error(folderData.error.message);
    if (filesData.error)  throw new Error(filesData.error.message);

    const subFolders: { id: string; name: string }[] = folderData.files || [];
    const audioFiles: { id: string; name: string; size: string; mimeType: string }[] =
      filesData.files || [];

    // Initialise shared progress counter on the first call
    if (!_progressState && onProgress) {
      // We don't know the total yet; we'll increment total as we discover files
      _progressState = { done: 0, total: audioFiles.length };
    }
    if (_progressState) {
      // Add newly discovered audio files to total
      _progressState.total += audioFiles.length;
    }

    let playlists: Playlist[] = [];

    // ── 2. Recurse into sub-folders in parallel batches ──
    if (subFolders.length > 0) {
      store.setScanStatus(
        `Found ${subFolders.length} sub-folders in "${folderName}", scanning in parallel...`
      );

      const subResults = await parallelBatch<Playlist[]>(
        subFolders,
        PARALLEL_FOLDER_LIMIT,
        async (sub: { id: string; name: string }) => {
          try {
            return await this.scanDrive(sub.id, sub.name, onProgress, _progressState);
          } catch (err) {
            console.warn(`[Scan] Failed scanning sub-folder "${sub.name}":`, err);
            return [];
          }
        }
      );

      subResults.forEach(r => playlists.push(...r));
    }

    // ── 3. Process audio files in this folder ──
    if (audioFiles.length > 0) {
      store.setScanStatus(`Processing ${audioFiles.length} songs in "${folderName}"...`);

      const songs: Song[] = [];
      for (const file of audioFiles) {
        const song = await this.buildSong(file);
        songs.push(song);
        if (_progressState) {
          _progressState.done++;
          onProgress?.(_progressState.done, _progressState.total, file.name);
        }
      }

      const validSongs = songs.filter(Boolean);

      if (validSongs.length > 0) {
        playlists.push({
          id: `gdrive-${folderId}`,
          name: folderName,
          description: `Songs from Google Drive folder: ${folderName}`,
          songs: validSongs,
          source: 'google-drive',
          folderId,
          artwork: validSongs[0]?.artwork,
        });
      }
    }

    return playlists;
  }

  // ─── Build a single Song from a Drive file entry ──────────────────────────

  private async buildSong(file: {
    id: string;
    name: string;
    size?: string;
    mimeType?: string;
  }): Promise<Song> {
    // Derive title from filename; guarantee it's never an empty string
    let title  = (file.name.replace(/\.[^/.]+$/, '').trim()) || file.name || file.id;
    let artist   = 'Unknown Artist';
    let album    = '';
    let duration = 0;
    const streamingUrl = this.getStreamingUrl(file.id);
    let artwork =
      'https://raw.githubusercontent.com/viki28593/assets/main/premium_music_note.png';

    // ── ID3 tag parse from first 64KB ──
    try {
      const partialRes = await this.authedFetch(this.getStreamingUrl(file.id), {
        headers: { Range: 'bytes=0-65535' },
      });

      if (partialRes.ok) {
        const arrayBuffer = await partialRes.arrayBuffer();
        const metadata = await parseBuffer(Buffer.from(arrayBuffer));

        if (metadata.common) {
          if (metadata.common.title) title = metadata.common.title;
          if (metadata.common.artist) artist = metadata.common.artist;
          if (metadata.common.album) album = metadata.common.album;

          if (metadata.common.picture?.length) {
            const pic = metadata.common.picture[0];
            const base64 = Buffer.from(pic.data).toString('base64');
            artwork = `data:${pic.format};base64,${base64}`;
          }
        }

        if (metadata.format?.duration) {
          duration = metadata.format.duration * 1000;
        }
      }
    } catch (e) {
      console.warn(`[ID3] Tag parse failed for "${file.name}":`, e);
    }

    // ── iTunes fallback for missing metadata ──
    if (artist === 'Unknown Artist' || artwork.includes('premium_music_note')) {
      try {
        const searchTerm =
          artist !== 'Unknown Artist' ? `${artist} ${title}` : title;
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=song&limit=1`
        );
        const data = await res.json();
        if (data.results?.length) {
          const track = data.results[0];
          if (artist === 'Unknown Artist') artist = track.artistName;
          if (!album) album = track.collectionName ?? '';
          if (!duration) duration = track.trackTimeMillis ?? 0;
          if (artwork.includes('premium_music_note')) {
            artwork = track.artworkUrl100?.replace('100x100bb', '600x600bb') ?? artwork;
          }
        }
      } catch {
        // iTunes is optional — silently skip
      }
    }

    return {
      id:       file.id,
      title:    title  || file.name || file.id,   // triple-fallback: never empty
      artist:   artist || 'Unknown Artist',
      album,
      duration,
      url:      streamingUrl,                      // always the Drive streaming URL
      source:   'google-drive',
      fileId:   file.id,
      artwork,
    };
  }

  // ─── Download helpers (unchanged logic, authedFetch added) ────────────────

  async downloadPlaylistSongs(playlist: Playlist): Promise<void> {
    const store = useGoogleDriveStore.getState();
    store.setScanning(true);
    store.setScanProgress(0);

    const totalSongs = playlist.songs.length;
    if (totalSongs === 0) {
      store.setScanning(false);
      return;
    }

    let downloadedCount = 0;
    const playlistStore = usePlaylistStore.getState();

    for (const song of playlist.songs) {
      const localUri = await this.downloadSong(song, playlist.name);
      if (localUri) {
        song.localUri = localUri;
        playlistStore.updateSongInPlaylist(playlist.id, song.id, { localUri });
      }
      downloadedCount++;
      store.setScanProgress(downloadedCount / totalSongs);
    }

    store.setScanning(false);
    store.setScanProgress(1);
  }

  async downloadSong(song: Song, playlistName: string): Promise<string | undefined> {
    try {
      const { downloadPath } = useSettingsStore.getState();
      const sanitizedPlaylist = playlistName.replace(/[/\\?%*:|"<>]/g, '-');
      const sanitizedTitle = song.title.replace(/[/\\?%*:|"<>]/g, '-');
      const sanitizedArtist = song.artist.replace(/[/\\?%*:|"<>]/g, '-');

      const folderUri = `${FileSystem.documentDirectory}${downloadPath}${sanitizedPlaylist}/`;
      const fileName = `${sanitizedTitle} - ${sanitizedArtist}.mp3`;
      const fileUri = `${folderUri}${fileName}`;

      const dirInfo = await FileSystem.getInfoAsync(folderUri);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(folderUri, { intermediates: true });
      }

      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) return fileUri;

      // Use a fresh valid token for the download header
      const token = await this.getAccessToken();
      if (!token) throw new Error('No valid token for download');

      const downloadResult = await FileSystem.downloadAsync(song.url, fileUri, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return downloadResult.uri;
    } catch (error) {
      console.error('[Download] Failed to download song:', song.title, error);
      return undefined;
    }
  }

  async clearDownloads(): Promise<void> {
    try {
      const { downloadPath } = useSettingsStore.getState();
      const downloadsDir = `${FileSystem.documentDirectory}${downloadPath}`;
      const info = await FileSystem.getInfoAsync(downloadsDir);
      if (info.exists) await FileSystem.deleteAsync(downloadsDir);
    } catch (error) {
      console.error('[Download] Failed to clear downloads:', error);
    }
  }

  // ─── Local playlist discovery (unchanged) ─────────────────────────────────

  async discoverLocalPlaylistsFast(): Promise<Playlist[]> {
    try {
      const { downloadPath } = useSettingsStore.getState();
      const downloadsDir = `${FileSystem.documentDirectory}${downloadPath}`;
      const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
      if (!dirInfo.exists) return [];

      const folders = await FileSystem.readDirectoryAsync(downloadsDir);
      const playlists: Playlist[] = [];

      for (const folderName of folders) {
        const folderUri = `${downloadsDir}${folderName}/`;
        const folderInfo = await FileSystem.getInfoAsync(folderUri);

        if (folderInfo.isDirectory) {
          const files = await FileSystem.readDirectoryAsync(folderUri);
          const songs: Song[] = [];

          for (const fileName of files) {
            if (fileName.endsWith('.mp3') || fileName.endsWith('.m4a')) {
              const fileUri = `${folderUri}${fileName}`;
              let title = fileName.replace(/\.[^/.]+$/, '');
              let artist = 'Unknown Artist';

              const parts = title.split(' - ');
              if (parts.length > 1) {
                title = parts[0];
                artist = parts[1];
              }

              songs.push({
                id: `local-${folderName}-${fileName}`,
                title,
                artist,
                duration: 0,
                url: fileUri,
                localUri: fileUri,
                source: 'offline',
                artwork:
                  'https://raw.githubusercontent.com/viki28593/assets/main/premium_music_note.png',
              });
            }
          }

          if (songs.length > 0) {
            playlists.push({
              id: `offline-${folderName}`,
              name: folderName,
              description: 'Downloaded for offline playback',
              songs,
              source: 'offline',
              isOffline: true,
              artwork: songs[0].artwork,
            });
          }
        }
      }

      return playlists;
    } catch (error) {
      console.error('[Offline] discoverLocalPlaylistsFast error:', error);
      return [];
    }
  }

  async discoverLocalPlaylists(): Promise<Playlist[]> {
    try {
      const { downloadPath } = useSettingsStore.getState();
      const downloadsDir = `${FileSystem.documentDirectory}${downloadPath}`;
      const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
      if (!dirInfo.exists) return [];

      const folders = await FileSystem.readDirectoryAsync(downloadsDir);
      const playlists: Playlist[] = [];

      for (const folderName of folders) {
        const folderUri = `${downloadsDir}${folderName}/`;
        const folderInfo = await FileSystem.getInfoAsync(folderUri);

        if (folderInfo.isDirectory) {
          const files = await FileSystem.readDirectoryAsync(folderUri);
          const songs: Song[] = [];

          for (const fileName of files) {
            if (fileName.endsWith('.mp3') || fileName.endsWith('.m4a')) {
              const fileUri = `${folderUri}${fileName}`;
              let title = fileName.replace(/\.[^/.]+$/, '');
              let artist = 'Unknown Artist';
              let artwork: string | undefined;

              try {
                const fileData = await FileSystem.readAsStringAsync(fileUri, {
                  encoding: FileSystem.EncodingType.Base64,
                  length: 65536,
                });
                const buffer = Buffer.from(fileData, 'base64');
                const metadata = await parseBuffer(buffer);

                if (metadata.common) {
                  if (metadata.common.title) title = metadata.common.title;
                  if (metadata.common.artist) artist = metadata.common.artist;

                  if (metadata.common.picture?.length) {
                    const pic = metadata.common.picture[0];
                    const base64 = Buffer.from(pic.data).toString('base64');
                    artwork = `data:${pic.format};base64,${base64}`;
                  }
                }
              } catch {
                const parts = title.split(' - ');
                if (parts.length > 1) {
                  title = parts[0];
                  artist = parts[1];
                }
              }

              songs.push({
                id: `local-${folderName}-${fileName}`,
                title,
                artist,
                duration: 0,
                url: fileUri,
                localUri: fileUri,
                source: 'google-drive',
                artwork:
                  artwork ||
                  'https://raw.githubusercontent.com/viki28593/assets/main/premium_music_note.png',
              });
            }
          }

          if (songs.length > 0) {
            playlists.push({
              id: `offline-${folderName}`,
              name: folderName,
              description: 'Downloaded for offline playback',
              songs,
              source: 'google-drive',
              isOffline: true,
              artwork: songs[0].artwork,
            });
          }
        }
      }

      return playlists;
    } catch (error) {
      console.error('[Offline] discoverLocalPlaylists error:', error);
      return [];
    }
  }

  getStreamingUrl(fileId: string): string {
    return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }
}

export const googleDriveService = new GoogleDriveService();