import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';

import { useTheme } from '../hooks';
import { useSettingsStore, useGoogleDriveStore } from '../store/store_index';
import { googleDriveService } from '../services/googleDriveService';
import { audioService } from '../services/audioService';
import { Spacing, BorderRadius, FontSize } from '../constants/theme';

interface DownloadedSong {
  title: string;
  downloaded: boolean;
  path?: string;
}

interface PlaylistDownload {
  playlistName: string;
  songs: DownloadedSong[];
  totalSongs: number;
  downloadedCount: number;
}

export const DownloadScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  
  const { downloadPath } = useSettingsStore();
  const { isScanning, scanProgress } = useGoogleDriveStore();
  
  const [loading, setLoading] = useState(false);
  const [downloads, setDownloads] = useState<PlaylistDownload[]>([]);
  const [totalStorageUsed, setTotalStorageUsed] = useState<string>('0 MB');
  
  // Load downloads when screen mounts
  useEffect(() => {
    loadDownloads();
  }, []);
  
  const loadDownloads = useCallback(async () => {
    setLoading(true);
    try {
      const downloadsDir = `${FileSystem.documentDirectory}${downloadPath}`;
      const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
      
      if (!dirInfo.exists) {
        setDownloads([]);
        setTotalStorageUsed('0 MB');
        setLoading(false);
        return;
      }
      
      // Read all folders in downloads directory
      const folders = await FileSystem.readDirectoryAsync(downloadsDir);
      const results: PlaylistDownload[] = [];
      let totalSize = 0;
      
      for (const folderName of folders) {
        const folderUri = `${downloadsDir}${folderName}/`;
        const folderInfo = await FileSystem.getInfoAsync(folderUri);
        
        if (folderInfo.isDirectory) {
          const files = await FileSystem.readDirectoryAsync(folderUri);
          const songs: DownloadedSong[] = [];
          let downloadedCount = 0;
          
          for (const fileName of files) {
            if (fileName.endsWith('.mp3') || fileName.endsWith('.m4a')) {
              const fileUri = `${folderUri}${fileName}`;
              const fileInfo = await FileSystem.getInfoAsync(fileUri);
              
              if (fileInfo.exists && fileInfo.size) {
                totalSize += fileInfo.size;
                downloadedCount++;
                songs.push({
                  title: fileName.replace(/\.[^/.]+$/, ''),
                  downloaded: true,
                  path: fileUri,
                });
              } else {
                songs.push({
                  title: fileName.replace(/\.[^/.]+$/, ''),
                  downloaded: false,
                });
              }
            }
          }
          
          if (songs.length > 0) {
            results.push({
              playlistName: folderName,
              songs,
              totalSongs: songs.length,
              downloadedCount,
            });
          }
        }
      }
      
      // Calculate total storage used
      const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
      setTotalStorageUsed(`${sizeInMB} MB`);
      
      if (results.length === 0) {
        setDownloads([{
          playlistName: 'No Audio Files Found',
          songs: [],
          totalSongs: 0,
          downloadedCount: 0,
        }]);
      } else {
        setDownloads(results);
      }
    } catch (error) {
      console.warn('[DownloadScreen] Error loading downloads:', error);
    } finally {
      setLoading(false);
    }
  }, [downloadPath]);
  
  const handleClearDownloads = () => {
    Alert.alert(
      'Clear Downloads',
      'Are you sure you want to delete all offline songs?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive', 
          onPress: async () => {
            await googleDriveService.clearDownloads();
            await audioService.clearCache();
            loadDownloads();
            Alert.alert('Success', 'Local storage and cache cleared.');
          }
        }
      ]
    );
  };
  
  const renderPlaylistItem = ({ item }: { item: PlaylistDownload }) => (
    <View style={[styles.playlistCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.playlistHeader}>
        <View style={styles.playlistInfo}>
          <Text style={[styles.playlistName, { color: colors.text }]}>
            {item.playlistName}
          </Text>
          <Text style={[styles.playlistCount, { color: colors.textSecondary }]}>
            {item.downloadedCount} / {item.totalSongs} songs
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: item.downloadedCount === item.totalSongs && item.totalSongs > 0 ? '#34C759' : '#FF9500' }
        ]}>
          <Text style={styles.statusText}>
            {item.downloadedCount === item.totalSongs && item.totalSongs > 0 ? 'Complete' : 'Partial'}
          </Text>
        </View>
      </View>
      
      {/* Songs List */}
      {item.songs.length > 0 && (
        <View style={styles.songsContainer}>
          {item.songs.slice(0, 5).map((song, index) => (
            <View key={index} style={styles.songRow}>
              <Ionicons 
                name={song.downloaded ? "checkmark-circle" : "close-circle"} 
                size={16} 
                color={song.downloaded ? '#34C759' : '#FF3B30'} 
              />
              <Text 
                style={[styles.songTitle, { color: colors.text }]} 
                numberOfLines={1}
              >
                {song.title}
              </Text>
            </View>
          ))}
          {item.songs.length > 5 && (
            <Text style={[styles.moreSongsText, { color: colors.textTertiary }]}>
              +{item.songs.length - 5} more songs
            </Text>
          )}
        </View>
      )}
    </View>
  );
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerContainer, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Downloads</Text>
          <TouchableOpacity 
            onPress={handleClearDownloads} 
            style={styles.clearButton}
          >
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Download Path Section */}
      <View style={[styles.pathSection, { backgroundColor: colors.surface }]}>
        <View style={styles.pathRow}>
          <Ionicons name="folder-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.pathLabel, { color: colors.textSecondary }]}>
            Download Path
          </Text>
        </View>
        <Text style={[styles.pathValue, { color: colors.text }]} numberOfLines={1}>
          {FileSystem.documentDirectory}{downloadPath}
        </Text>
      </View>
      
      {/* Active Download Progress */}
      {isScanning && (
        <View style={[styles.progressSection, { backgroundColor: colors.surface }]}>
          <View style={styles.progressHeader}>
            <Ionicons name="download" size={20} color={colors.primary} />
            <Text style={[styles.progressTitle, { color: colors.text }]}>
              Downloading...
            </Text>
            <Text style={[styles.progressPercent, { color: colors.primary }]}>
              {Math.round(scanProgress * 100)}%
            </Text>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
            <View 
              style={[
                styles.progressBarFill, 
                { backgroundColor: colors.primary, width: `${scanProgress * 100}%` }
              ]} 
            />
          </View>
          <Text style={[styles.progressSubtext, { color: colors.textSecondary }]}>
            {scanProgress < 1 ? 'Downloading songs to device...' : 'Finalizing...'}
          </Text>
        </View>
      )}
      
      {/* Total Storage */}
      <View style={[styles.storageSection, { backgroundColor: colors.surface }]}>
        <View style={styles.storageRow}>
          <Ionicons name="hardware-chip-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.storageLabel, { color: colors.textSecondary }]}>
            Total Storage Used
          </Text>
        </View>
        <Text style={[styles.storageValue, { color: colors.text }]}>
          {totalStorageUsed}
        </Text>
      </View>
      
      {/* Downloads List */}
      <View style={styles.listSection}>
        <Text style={[styles.listTitle, { color: colors.textSecondary }]}>
          Playlists
        </Text>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading downloads...
            </Text>
          </View>
        ) : (
          <FlatList
            data={downloads}
            keyExtractor={(item) => item.playlistName}
            renderItem={renderPlaylistItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="folder-open-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No downloads found
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                  Download songs from Google Drive to view them here
                </Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    marginLeft: Spacing.sm,
  },
  clearButton: {
    padding: Spacing.xs,
  },
  pathSection: {
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  pathLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  pathValue: {
    fontSize: FontSize.sm,
    paddingLeft: 28,
  },
  progressSection: {
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  progressTitle: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  progressPercent: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressSubtext: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  storageSection: {
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  storageLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  storageValue: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  listSection: {
    flex: 1,
    marginTop: Spacing.md,
  },
  listTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginLeft: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  listContent: {
    paddingBottom: Spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  loadingText: {
    fontSize: FontSize.md,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  playlistCard: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  playlistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  playlistCount: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  songsContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  songTitle: {
    flex: 1,
    fontSize: FontSize.sm,
  },
  moreSongsText: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
});
