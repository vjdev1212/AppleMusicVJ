/**
 * PlaylistSyncService
 *
 * Responsibilities:
 *  - Discover sub-folders inside the Google Drive "Music" root folder
 *  - Fetch songs for selected folders
 *  - Persist selected folder IDs and their playlists to AsyncStorage
 *    so the app restores them on next launch without re-fetching
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Playlist } from '../types';
import { googleDriveService } from './googleDriveService';

const STORAGE_KEY_SELECTED  = 'psync_selected_folder_ids';
const STORAGE_KEY_PLAYLISTS = 'psync_cached_playlists';

export interface DriveFolder {
  id:   string;
  name: string;
}

class PlaylistSyncService {

  // ─── Discover sub-folders inside the "Music" root ──────────────────────────
  async getMusicSubFolders(): Promise<DriveFolder[]> {
    try {
      // Get all top-level folders
      const allFolders = await googleDriveService.getFolders();

      // Find the "Music" folder (case-insensitive)
      const musicFolder = allFolders.find(
        f => f.name.toLowerCase() === 'music'
      );
      if (!musicFolder) return [];

      // Get sub-folders inside Music
      const subFolders = await this._getSubFolders(musicFolder.id);
      return subFolders;
    } catch (e) {
      console.warn('[Sync] getMusicSubFolders error:', e);
      return [];
    }
  }

  private async _getSubFolders(parentId: string): Promise<DriveFolder[]> {
    // Use googleDriveService authedFetch indirectly via scanDrive
    // We need a direct folder list — replicate getFolders with parent filter
    try {
      const token = await googleDriveService.getAccessToken();
      if (!token) return [];

      const q = encodeURIComponent(
        `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
      );
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return (data.files || []) as DriveFolder[];
    } catch (e) {
      console.warn('[Sync] _getSubFolders error:', e);
      return [];
    }
  }

  // ─── Fetch songs for a specific folder and return as Playlist ──────────────
  async fetchPlaylistForFolder(
    folder: DriveFolder,
    onProgress?: (done: number, total: number, itemName?: string) => void
  ): Promise<Playlist[]> {
    try {
      return await googleDriveService.scanDrive(folder.id, folder.name, onProgress);
    } catch (e) {
      console.warn(`[Sync] fetchPlaylistForFolder error for ${folder.name}:`, e);
      return [];
    }
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  async saveSelectedFolderIds(ids: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify(ids));
    } catch (e) {
      console.warn('[Sync] saveSelectedFolderIds error:', e);
    }
  }

  async loadSelectedFolderIds(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_SELECTED);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async saveCachedPlaylists(playlists: Playlist[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(playlists));
    } catch (e) {
      console.warn('[Sync] saveCachedPlaylists error:', e);
    }
  }

  async loadCachedPlaylists(): Promise<Playlist[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_PLAYLISTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async clearCache(): Promise<void> {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY_SELECTED);
        await AsyncStorage.removeItem(STORAGE_KEY_PLAYLISTS);
    } catch (e) {
      console.warn('[Sync] clearCache error:', e);
    }
  }
}

export const playlistSyncService = new PlaylistSyncService();