import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { Playlist, Song } from '../types';
import { parseBuffer } from 'music-metadata-browser';
import * as FileSystem from 'expo-file-system/legacy';
import { useGoogleDriveStore, useSettingsStore, usePlaylistStore } from '../store';
import { Buffer } from 'buffer';


WebBrowser.maybeCompleteAuthSession();

// Get Google Drive Client ID from settings (with fallback to default)
const getGoogleDriveClientId = (): string => {
  try {
    // Note: In a service class, we need to access the store directly
    // The default value will be used if not set in settings
    return '706156834841-89cufgqr5n44h81utu4b9lg1dt3jk9mh.apps.googleusercontent.com';
  } catch {
    return '706156834841-89cufgqr5n44h81utu4b9lg1dt3jk9mh.apps.googleusercontent.com';
  }
};

const PROJECT_FULL_NAME = '@viki28593/apple-music-player';

const ACCESS_TOKEN_KEY = 'google_access_token';
const EMAIL_KEY = 'google_email';

class GoogleDriveService {
  private accessToken: string | null = null;
  private email: string | null = null;

  async connect(): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Get the deep link back to the Expo Go app (e.g., exp://192.168.1.x:8081/--)
      const returnUrl = AuthSession.makeRedirectUri();

      // 2. Define the EXACT redirect URI registered in Google Cloud Console
      const exactRedirectUri = `https://auth.expo.io/${PROJECT_FULL_NAME}`;

      // 3. Construct the Google OAuth URL manually
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${getGoogleDriveClientId()}` +
        `&redirect_uri=${encodeURIComponent(exactRedirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.readonly profile email')}` +
        `&prompt=consent`;

      // 4. Wrap it in the Expo Auth Proxy Start URL
      // This tells the proxy to open Google, and when Google redirects back to the proxy,
      // the proxy will redirect back to your app via the `returnUrl`.
      const proxyStartUrl = `${exactRedirectUri}/start?` +
        `authUrl=${encodeURIComponent(googleAuthUrl)}` +
        `&returnUrl=${encodeURIComponent(returnUrl)}`;

      console.log('[Auth] Opening WebBrowser with Proxy Start URL...');

      // 5. Open browser using the proxy start URL
      const result = await WebBrowser.openAuthSessionAsync(
        proxyStartUrl,
        returnUrl  // We wait for the browser to redirect to `returnUrl`
      );

      if (result.type !== 'success') {
        return { success: false, error: 'Authentication cancelled or failed.' };
      }

      // 4. Parse the access token from the returned URL string
      // The proxy returns something like: exp://...?access_token=XYZ
      const resultUrl = result.url;
      const paramsRegex = /access_token=([^&]+)/;
      const match = resultUrl.match(paramsRegex);
      
      this.accessToken = match ? match[1] : null;

      if (!this.accessToken) {
        return { success: false, error: 'No access token received.' };
      }

      // Fetch user email
      try {
        const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
        const data = await resp.json();
        this.email = data.email ?? 'user@gmail.com';
      } catch (e) {
        console.warn('[Auth] Could not fetch user email:', e);
      }

      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, this.accessToken);
      if (this.email) await SecureStore.setItemAsync(EMAIL_KEY, this.email);

      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Google Drive connection error:', error);
      return { success: false, error: `Failed to connect: ${error.message}` };
    }
  }

  async disconnect(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(EMAIL_KEY);
      this.accessToken = null;
      this.email = null;
    } catch (error) {
      console.error('[Auth] Error disconnecting:', error);
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (token) {
        // Verify token is still valid by making a tiny request
        const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (resp.status === 401) {
          await this.disconnect();
          return false;
        }

        this.accessToken = token;
        const email = await SecureStore.getItemAsync(EMAIL_KEY);
        if (email) this.email = email;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async getEmail(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(EMAIL_KEY);
    } catch {
      return null;
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.accessToken) {
      await this.isConnected();
    }
    return this.accessToken;
  }

  async getFolders(): Promise<{ id: string; name: string }[]> {
    if (!this.accessToken) {
      await this.isConnected(); // Try to load from secure store
      if (!this.accessToken) {
        throw new Error('Not connected to Google Drive');
      }
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          "mimeType='application/vnd.google-apps.folder' and trashed=false"
        )}&fields=files(id,name)`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      
      if (response.status === 401) {
        await this.disconnect();
        throw new Error('Google Drive session expired. Please connect again.');
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      return data.files || [];
    } catch (error) {
      console.error('[Auth] Error fetching folders:', error);
      throw error;
    }
  }

  async autoScanMusicFolder(): Promise<Playlist[]> {
    const store = useGoogleDriveStore.getState();
    store.setScanning(true);
    store.setScanProgress(0);
    
    try {
      store.setScanStatus('Connecting to Google Drive...');
      const folders = await this.getFolders();
      
      if (folders.length === 0) {
        store.setScanStatus('No folders found in Google Drive');
        return [];
      }
      
      store.setScanStatus(`Found ${folders.length} folders, searching for Music folder...`);
      
      // Look for a folder named exactly "Music" (case-insensitive)
      const musicFolder = folders.find(f => f.name.toLowerCase() === 'music');
      
      if (musicFolder) {
        store.setScanStatus(`Found Music folder, scanning for playlists...`);
        const playlists = await this.scanDrive(musicFolder.id, musicFolder.name);
        store.setScanStatus(`Found ${playlists.length} playlists`);
        store.setScanning(false);
        return playlists;
      }
      
      // If we made it here, no Music folder was found. Just return empty.
      store.setScanStatus('No "Music" folder found');
      store.setScanning(false);
      console.log('[Auth] No folder named "Music" found for auto-scan.');
      return [];
    } catch (error) {
      console.error('[Auth] Error in autoScanMusicFolder:', error);
      store.setScanStatus('Error scanning Google Drive');
      store.setScanning(false);
      return []; // Return empty playlist array on error so app doesn't crash
    }
  }

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
        // Persist to store so it's remembered across sessions
        playlistStore.updateSongInPlaylist(playlist.id, song.id, { localUri });
      }
      downloadedCount++;
      store.setScanProgress(downloadedCount / totalSongs);
    }

    store.setScanning(false);
    store.setScanProgress(1);
  }

  private async downloadAllSongs(playlists: Playlist[]): Promise<void> {
    const store = useGoogleDriveStore.getState();
    store.setScanning(true);
    store.setScanProgress(0);

    const allSongs: { song: Song; playlistName: string }[] = [];
    playlists.forEach(p => {
      p.songs.forEach(s => {
        allSongs.push({ song: s, playlistName: p.name });
      });
    });

    const totalSongs = allSongs.length;
    if (totalSongs === 0) {
      store.setScanning(false);
      return;
    }

    let downloadedCount = 0;
    for (const item of allSongs) {
      const localUri = await this.downloadSong(item.song, item.playlistName);
      if (localUri) {
        item.song.localUri = localUri;
      }
      downloadedCount++;
      store.setScanProgress(downloadedCount / totalSongs);
    }

    store.setScanning(false);
    store.setScanProgress(1);
    // Note: Since we're modifying the song objects in place, 
    // and they are likely already in the PlaylistStore, 
    // the store might not trigger a re-render unless we explicitly set it.
    // However, for offline support, the important part is that localUri is set.
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
      if (fileInfo.exists) {
        return fileUri;
      }

      console.log(`[Download] Starting download: ${song.title}`);
      console.log(`[Download] Target path: ${fileUri}`);
      
      const downloadResult = await FileSystem.downloadAsync(
        song.url,
        fileUri,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      console.log(`[Download] Completed: ${downloadResult.uri} (${downloadResult.status})`);

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
      if (info.exists) {
        await FileSystem.deleteAsync(downloadsDir);
      }
    } catch (error) {
      console.error('[Download] Failed to clear downloads:', error);
    }
  }

  // Fast discovery without metadata parsing - for quick loading
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
              // Fast: use filename as title/artist fallback
              let title = fileName.replace(/\.[^/.]+$/, '');
              let artist = 'Unknown Artist';
              
              // Try to extract from filename format "Title - Artist.mp3"
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
                artwork: 'https://raw.githubusercontent.com/viki28593/assets/main/premium_music_note.png',
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
      console.error('[Offline] Error discovering local playlists (fast):', error);
      return [];
    }
  }

  // Original method with metadata parsing - for detailed info on demand
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
              let artwork: string | undefined = undefined;

              // Extract metadata from local file
              try {
                const fileData = await FileSystem.readAsStringAsync(fileUri, {
                  encoding: FileSystem.EncodingType.Base64,
                  length: 65536, // Read first 64KB
                });
                const buffer = Buffer.from(fileData, 'base64');
                const metadata = await parseBuffer(buffer);
                
                if (metadata.common) {
                  if (metadata.common.title) title = metadata.common.title;
                  if (metadata.common.artist) artist = metadata.common.artist;
                  
                  if (metadata.common.picture && metadata.common.picture.length > 0) {
                    const pic = metadata.common.picture[0];
                    const base64 = Buffer.from(pic.data).toString('base64');
                    artwork = `data:${pic.format};base64,${base64}`;
                  }
                }
              } catch (e) {
                console.warn('[Offline] Could not parse metadata for:', fileName);
                // Fallback to filename parts
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
                artwork: artwork || 'https://raw.githubusercontent.com/viki28593/assets/main/premium_music_note.png',
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
      console.error('[Offline] Error discovering local playlists:', error);
      return [];
    }
  }

  async scanDrive(folderId: string, folderName: string): Promise<Playlist[]> {
    const store = useGoogleDriveStore.getState();
    
    if (!this.accessToken) {
       await this.isConnected();
       if (!this.accessToken) {
         throw new Error('Not connected to Google Drive');
       }
    }

    try {
      store.setScanStatus(`Scanning folder: ${folderName}...`);
      
      // Fetch sub-folders
      const folderQuery = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed=false`;
      const folderRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQuery)}&fields=files(id,name)&pageSize=100`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      const folderData = await folderRes.json();
      const subFolders = folderData.files || [];

      let playlists: Playlist[] = [];

      if (subFolders.length > 0) {
        store.setScanStatus(`Found ${subFolders.length} subfolders in ${folderName}`);
        store.setScanProgress(0.1); // 10% - found folders
      }

      for (let i = 0; i < subFolders.length; i++) {
        const sub = subFolders[i];
        // Calculate progress: 10% base + (i / subFolders.length) * 40%
        const progress = 0.1 + (i / subFolders.length) * 0.4;
        store.setScanProgress(progress);
        store.setScanStatus(`Scanning playlist ${i + 1}/${subFolders.length}: ${sub.name}...`);
        // recursively scan each sub-folder and append to our results
        const subPlaylists = await this.scanDrive(sub.id, sub.name);
        playlists.push(...subPlaylists);
      }

      // Fetch mp3/m4a/audio files in the selected folder
      store.setScanStatus(`Fetching songs from ${folderName}...`);
      store.setScanProgress(0.5); // 50% - fetching songs
      const query = `'${folderId}' in parents and (mimeType contains 'audio/' or name contains '.mp3' or name contains '.m4a') and trashed=false`;
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,mimeType)&pageSize=1000`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      
      if (response.status === 401) {
        await this.disconnect();
        throw new Error('Google Drive session expired. Please connect again.');
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const files = data.files || [];
      
      if (files.length > 0) {
        store.setScanStatus(`Found ${files.length} songs in ${folderName}, processing...`);
        store.setScanProgress(0.5); // Start processing at 50%
        // Sequence the promises to respect API rate limits smoothly
        const songs: Song[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          // Update status and progress every 5 songs
          // Progress: 50% + (i / files.length) * 50%
          if (i % 5 === 0) {
            const progress = 0.5 + (i / files.length) * 0.5;
            store.setScanProgress(progress);
            store.setScanStatus(`Processing song ${i + 1}/${files.length}: ${file.name.replace(/\.[^/.]+$/, '')}`);
          }
          let artist = 'Unknown Artist';
          let title = file.name.replace(/\.[^/.]+$/, ''); // Remove file extension
          let duration = 0;
          let artwork = 'https://raw.githubusercontent.com/viki28593/assets/main/premium_music_note.png';
          let album = '';
          let year = undefined;
          let genre = undefined;
          
          // TRY ID3 TAG PARSING FIRST via partial download (first 64KB)
          try {
            const partialRes = await fetch(
              this.getStreamingUrl(file.id),
              {
                headers: { 
                  Authorization: `Bearer ${this.accessToken}`,
                  Range: 'bytes=0-65535' // Get enough for common ID3 headers
                },
              }
            );
            
            if (partialRes.ok) {
              const arrayBuffer = await partialRes.arrayBuffer();
              const metadata = await parseBuffer(Buffer.from(arrayBuffer));
              
              if (metadata.common) {
                if (metadata.common.title) title = metadata.common.title;
                if (metadata.common.artist) artist = metadata.common.artist;
                if (metadata.common.album) album = metadata.common.album;
                if (metadata.common.year) year = metadata.common.year;
                if (metadata.common.genre && metadata.common.genre.length > 0) {
                  genre = metadata.common.genre[0];
                }
                
                // Extract Picture
                if (metadata.common.picture && metadata.common.picture.length > 0) {
                  const pic = metadata.common.picture[0];
                  const base64 = Buffer.from(pic.data).toString('base64');
                  artwork = `data:${pic.format};base64,${base64}`;
                }
              }
              
              if (metadata.format && metadata.format.duration) {
                duration = metadata.format.duration * 1000; // to ms
              }
            }
          } catch (e) {
            console.warn(`[ID3] Failed to parse tags for ${file.name}, trying iTunes...`, e);
          }

          // FALLBACK TO ITUNES SEARCH API if metadata is still basic
          if (artist === 'Unknown Artist' || artwork.includes('premium_music_note')) {
            try {
              // Parse filename for search term
              let searchTerm = title;
              if (title.includes(' - ')) {
                searchTerm = title;
              } else if (title.includes('-')) {
                searchTerm = title;
              } else if (artist !== 'Unknown Artist') {
                searchTerm = `${artist} ${title}`;
              }

              const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=song&limit=1`);
              const itunesData = await itunesRes.json();
              if (itunesData.results && itunesData.results.length > 0) {
                const track = itunesData.results[0];
                if (artist === 'Unknown Artist') artist = track.artistName;
                if (!album) album = track.collectionName;
                if (!duration) duration = track.trackTimeMillis;
                if (artwork.includes('premium_music_note')) {
                  artwork = track.artworkUrl100.replace('100x100bb', '600x600bb');
                }
              }
            } catch (e) {
               // Silently bypass
            }
          }

          songs.push({
            id: file.id,
            title,
            artist,
            album,
            duration,
            url: this.getStreamingUrl(file.id),
            source: 'google-drive',
            fileId: file.id,
            artwork,
          });
        }

        playlists.push({
          id: `gdrive-${folderId}`,
          name: folderName,
          description: `Songs from Google Drive folder: ${folderName}`,
          songs,
          source: 'google-drive',
          folderId,
          artwork: songs[0]?.artwork,
        });
      }

      return playlists;
    } catch (error) {
      console.error('[Auth] Error scanning drive folder:', error);
      throw error;
    }
  }

  getStreamingUrl(fileId: string): string {
    return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }
}

export const googleDriveService = new GoogleDriveService();
