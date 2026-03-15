import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { Playlist, Song } from '../types';
import { parseBuffer } from 'music-metadata-browser';
import * as FileSystem from 'expo-file-system';


WebBrowser.maybeCompleteAuthSession();

// WEB Client ID from Google Cloud Console
const GOOGLE_WEB_CLIENT_ID =
  '706156834841-89cufgqr5n44h81utu4b9lg1dt3jk9mh.apps.googleusercontent.com';

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
        `client_id=${GOOGLE_WEB_CLIENT_ID}` +
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
    try {
      const folders = await this.getFolders();
      // Look for a folder named exactly "Music" (case-insensitive)
      const musicFolder = folders.find(f => f.name.toLowerCase() === 'music');
      
      if (musicFolder) {
        return await this.scanDrive(musicFolder.id, musicFolder.name);
      }
      
      // If we made it here, no Music folder was found. Just return empty.
      console.log('[Auth] No folder named "Music" found for auto-scan.');
      return [];
    } catch (error) {
      console.error('[Auth] Error in autoScanMusicFolder:', error);
      return []; // Return empty playlist array on error so app doesn't crash
    }
  }

  async scanDrive(folderId: string, folderName: string): Promise<Playlist[]> {
    if (!this.accessToken) {
       await this.isConnected();
       if (!this.accessToken) {
         throw new Error('Not connected to Google Drive');
       }
    }

    try {
      // Fetch sub-folders
      const folderQuery = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed=false`;
      const folderRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQuery)}&fields=files(id,name)&pageSize=100`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      const folderData = await folderRes.json();
      const subFolders = folderData.files || [];

      let playlists: Playlist[] = [];

      for (const sub of subFolders) {
        // recursively scan each sub-folder and append to our results
        const subPlaylists = await this.scanDrive(sub.id, sub.name);
        playlists.push(...subPlaylists);
      }

      // Fetch mp3/m4a/audio files in the selected folder
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
        // Sequence the promises to respect API rate limits smoothly
        const songs: Song[] = [];
        for (const file of files) {
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
