import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';

import { useTheme } from '../hooks';
import { useSettingsStore, useGoogleDriveStore, usePlaylistStore } from '../store';
import { googleDriveService } from '../services/googleDriveService';
import { audioService } from '../services/audioService';
import { Spacing, BorderRadius, FontSize } from '../constants/theme';
import { Song } from '../types';

export const SettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  
  const {
    theme,
    backgroundPlayback,
    audioQuality,
    cacheStreaming,
    streamingUrls,
    downloadPath,
    googleDriveClientId,
    youtubeApiKey,
    spotifyClientId,
    spotifyClientSecret,
    setTheme,
    setBackgroundPlayback,
    setAudioQuality,
    setCacheStreaming,
    setDownloadPath,
    addStreamingUrl,
    removeStreamingUrl,
    setGoogleDriveClientId,
    setYoutubeApiKey,
    setSpotifyClientId,
    setSpotifyClientSecret,
  } = useSettingsStore();
  
  const { isConnected, email, isScanning, scanProgress, setConnected, setDisconnected } = useGoogleDriveStore();
  const { setPlaylists, playlists } = usePlaylistStore();
  
  const [newUrl, setNewUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  
  // API Token State
  const [showApiTokenModal, setShowApiTokenModal] = useState(false);
  const [editingApiToken, setEditingApiToken] = useState<'googleDrive' | 'youtube' | 'spotify' | null>(null);
  const [apiTokenValue, setApiTokenValue] = useState('');
  const [apiTokenSecret, setApiTokenSecret] = useState('');
  
  // Folder Selection State
  const [folders, setFolders] = useState<{id: string; name: string}[]>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [fetchingFolders, setFetchingFolders] = useState(false);

  // Download Verification State
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [verifyingDownloads, setVerifyingDownloads] = useState(false);
  const [downloadVerificationResults, setDownloadVerificationResults] = useState<{
    playlistName: string;
    songs: { title: string; downloaded: boolean; path?: string }[];
    totalSongs: number;
    downloadedCount: number;
  }[]>([]);
  const [totalStorageUsed, setTotalStorageUsed] = useState<string>('0 MB');

  // Check connection status on mount
  useEffect(() => {
    const checkConnection = async () => {
      const connected = await googleDriveService.isConnected();
      if (connected) {
        setConnected(true);
      }
    };
    checkConnection();
  }, []);

  const handleGoogleDriveConnect = async () => {
    setConnecting(true);
    try {
      const result = await googleDriveService.connect();
      if (result.success) {
        setConnected(true);
        Alert.alert('Success', 'Connected to Google Drive');
      } else {
        Alert.alert('Error', result.error || 'Failed to connect');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to Google Drive');
    } finally {
      setConnecting(false);
    }
  };

  const handleGoogleDriveDisconnect = async () => {
    Alert.alert(
      'Disconnect Google Drive',
      'Are you sure you want to disconnect?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await googleDriveService.disconnect();
            setDisconnected();
            setPlaylists([]);
          },
        },
      ]
    );
  };

  const handleFetchFolders = async () => {
    setFetchingFolders(true);
    setShowFolderModal(true);
    try {
      const gFolders = await googleDriveService.getFolders();
      if (gFolders.length === 0) {
        setShowFolderModal(false);
        Alert.alert('No Folders', 'No folders found in your Google Drive or access is restricted.');
      } else {
        setFolders(gFolders);
      }
    } catch (error: any) {
      setShowFolderModal(false);
      Alert.alert('Error', error.message || 'Failed to fetch folders');
    } finally {
      setFetchingFolders(false);
    }
  };

  const handleScanFolder = async (folderId: string, folderName: string) => {
    setShowFolderModal(false);
    setScanning(true);
    try {
      const playlists = await googleDriveService.scanDrive(folderId, folderName);
      if (playlists.length > 0 && playlists[0].songs.length > 0) {
        setPlaylists(playlists);
        Alert.alert('Success', `Found ${playlists[0].songs.length} audio files in "${folderName}"`);
      } else {
        Alert.alert('Notice', `No audio files found in "${folderName}"`);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to scan folder');
    } finally {
      setScanning(false);
    }
  };

  const handleAddStreamUrl = () => {
    if (!newUrl.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }
    
    // Basic URL validation
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      Alert.alert('Error', 'URL must start with http:// or https://');
      return;
    }
    
    addStreamingUrl(newUrl.trim());
    setNewUrl('');
  };

  const handleRemoveStreamUrl = (url: string) => {
    Alert.alert(
      'Remove URL',
      'Are you sure you want to remove this streaming URL?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeStreamingUrl(url),
        },
      ]
    );
  };

  const handleClearDownloads = async () => {
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
            Alert.alert('Success', 'Local storage and cache cleared.');
          }
        }
      ]
    );
  };

  // API Token Functions
  const openApiTokenModal = (type: 'googleDrive' | 'youtube' | 'spotify') => {
    setEditingApiToken(type);
    if (type === 'googleDrive') {
      setApiTokenValue(googleDriveClientId);
    } else if (type === 'youtube') {
      setApiTokenValue(youtubeApiKey);
    } else if (type === 'spotify') {
      setApiTokenValue(spotifyClientId);
      setApiTokenSecret(spotifyClientSecret);
    }
    setShowApiTokenModal(true);
  };

  const saveApiToken = () => {
    if (editingApiToken === 'googleDrive') {
      setGoogleDriveClientId(apiTokenValue);
    } else if (editingApiToken === 'youtube') {
      setYoutubeApiKey(apiTokenValue);
    } else if (editingApiToken === 'spotify') {
      setSpotifyClientId(apiTokenValue);
      setSpotifyClientSecret(apiTokenSecret);
    }
    setShowApiTokenModal(false);
    setEditingApiToken(null);
    Alert.alert('Success', 'API token saved. Restart the app for changes to take effect.');
  };

  // Download Verification Functions
  const handleVerifyDownloads = useCallback(async () => {
    setVerifyingDownloads(true);
    setShowDownloadModal(true);
    setDownloadVerificationResults([]);
    
    try {
      const downloadsDir = `${FileSystem.documentDirectory}${downloadPath}`;
      const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
      
      if (!dirInfo.exists) {
        setDownloadVerificationResults([{
          playlistName: 'No Downloads',
          songs: [],
          totalSongs: 0,
          downloadedCount: 0,
        }]);
        setVerifyingDownloads(false);
        return;
      }

      // Read all folders in downloads directory
      const folders = await FileSystem.readDirectoryAsync(downloadsDir);
      const results: typeof downloadVerificationResults = [];
      let totalSize = 0;

      for (const folderName of folders) {
        const folderUri = `${downloadsDir}${folderName}/`;
        const folderInfo = await FileSystem.getInfoAsync(folderUri);
        
        if (folderInfo.isDirectory) {
          const files = await FileSystem.readDirectoryAsync(folderUri);
          const songs: { title: string; downloaded: boolean; path?: string }[] = [];
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
        setDownloadVerificationResults([{
          playlistName: 'No Audio Files Found',
          songs: [],
          totalSongs: 0,
          downloadedCount: 0,
        }]);
      } else {
        setDownloadVerificationResults(results);
      }
    } catch (error) {
      console.warn('[Verify] Error checking downloads:', error);
      Alert.alert('Error', 'Failed to verify downloads. Please try again.');
    } finally {
      setVerifyingDownloads(false);
    }
  }, [downloadPath]);

  const formatPath = (path: string): string => {
    // Simplify the path for display
    const parts = path.split('/');
    if (parts.length > 3) {
      return '...' + parts.slice(-3).join('/');
    }
    return path;
  };

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {title}
      </Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>
        {children}
      </View>
    </View>
  );

  const renderSettingRow = (
    label: string,
    value?: React.ReactNode,
    onPress?: () => void,
    isDestructive?: boolean
  ) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={[styles.settingLabel, { color: isDestructive ? '#FF3B30' : colors.text }]}>
        {label}
      </Text>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Full Area Header */}
      <View style={[styles.headerContainer, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home' as never)} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Google Drive Section */}
        {renderSection(
          'Google Drive',
          <>
            {isConnected ? (
              <>
                <View style={styles.connectionInfo}>
                  <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                  <View style={styles.connectionText}>
                    <Text style={[styles.connectedText, { color: colors.text }]}>
                      Connected
                    </Text>
                    <Text style={[styles.emailText, { color: colors.textSecondary }]}>
                      {email || 'vigneshmake28@gmail.com'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.settingRow} onPress={handleFetchFolders}>
                  <View style={styles.settingRowContent}>
                    <View style={[styles.iconContainer, { backgroundColor: '#4285F4' + '20' }]}>
                      <Ionicons name="folder" size={20} color="#4285F4" />
                    </View>
                    <View style={styles.settingTextContainer}>
                      <Text style={[styles.settingLabel, { color: colors.text }]}>Select Folder to Scan</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
                {scanning && (
                  <View style={styles.scanningContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.scanningText, { color: colors.textSecondary }]}>Scanning folder...</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.settingRow} onPress={handleGoogleDriveDisconnect}>
                  <View style={styles.settingRowContent}>
                    <View style={[styles.iconContainer, { backgroundColor: '#FF3B30' + '20' }]}>
                      <Ionicons name="log-out" size={20} color="#FF3B30" />
                    </View>
                    <View style={styles.settingTextContainer}>
                      <Text style={[styles.settingLabel, { color: '#FF3B30' }]}>Disconnect</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.notConnectedContainer}>
                  {/* Download Progress Indicator */}
                  {isScanning && (
                    <View style={[styles.progressContainer, { backgroundColor: colors.surfaceSecondary }]}>
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
                  {!isScanning && (
                    <View style={styles.notConnectedContent}>
                      <View style={[styles.notConnectedIcon, { backgroundColor: '#4285F4' + '20' }]}>
                        <Ionicons name="cloud" size={32} color="#4285F4" />
                      </View>
                      <Text style={[styles.notConnectedText, { color: colors.textSecondary }]}>
                        Connect your Google Drive to scan for MP3 files
                      </Text>
                    </View>
                  )}
                </View>
                {!isScanning && (
                  <TouchableOpacity
                    style={[styles.connectButton, { backgroundColor: colors.primary }]}
                    onPress={handleGoogleDriveConnect}
                    disabled={connecting}
                  >
                    <Ionicons name="logo-google" size={20} color="#FFFFFF" />
                    <Text style={styles.connectButtonText}>
                      {connecting ? 'Connecting...' : 'Connect Google Drive'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </>
        )}

        {/* Streaming URLs Section */}
        {renderSection(
          'Streaming URLs',
          <>
            <View style={styles.addUrlContainer}>
              <View style={[styles.urlInputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Ionicons name="link" size={18} color={colors.textTertiary} style={styles.urlInputIcon} />
                <TextInput
                  style={[
                    styles.urlInput,
                    { color: colors.text },
                  ]}
                  placeholder="Enter MP3 URL"
                  placeholderTextColor={colors.textTertiary}
                  value={newUrl}
                  onChangeText={setNewUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={handleAddStreamUrl}
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            {streamingUrls.map((url, index) => (
              <View key={index} style={styles.urlRow}>
                <Ionicons name="musical-note" size={16} color={colors.primary} />
                <Text
                  style={[styles.urlText, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {url}
                </Text>
                <TouchableOpacity
                  onPress={() => handleRemoveStreamUrl(url)}
                  style={styles.removeButton}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
            
            {streamingUrls.length === 0 && (
              <View style={styles.emptyUrlContainer}>
                <Ionicons name="link-outline" size={32} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                  No streaming URLs added
                </Text>
              </View>
            )}
          </>
        )}

        {/* API Tokens Section */}
        {renderSection(
          'API Configuration',
          <>
            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => openApiTokenModal('googleDrive')}
            >
              <View style={styles.settingRowContent}>
                <View style={[styles.iconContainer, { backgroundColor: '#4285F4' + '20' }]}>
                  <Ionicons name="cloud" size={20} color="#4285F4" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Google Drive</Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]} numberOfLines={1}>
                    {googleDriveClientId ? googleDriveClientId.substring(0, 30) + '...' : 'Not configured'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.settingRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
              onPress={() => openApiTokenModal('youtube')}
            >
              <View style={styles.settingRowContent}>
                <View style={[styles.iconContainer, { backgroundColor: '#FF0000' + '20' }]}>
                  <Ionicons name="logo-youtube" size={20} color="#FF0000" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>YouTube API</Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]} numberOfLines={1}>
                    {youtubeApiKey ? youtubeApiKey.substring(0, 30) + '...' : 'Not configured'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.settingRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
              onPress={() => openApiTokenModal('spotify')}
            >
              <View style={styles.settingRowContent}>
                <View style={[styles.iconContainer, { backgroundColor: '#1DB954' + '20' }]}>
                  <Ionicons name="musical-notes" size={20} color="#1DB954" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Spotify API</Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]} numberOfLines={1}>
                    {spotifyClientId ? spotifyClientId.substring(0, 30) + '...' : 'Not configured'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </>
        )}

        {/* Player Settings Section */}
        {renderSection(
          'Player Settings',
          <>
            <View style={styles.settingRow}>
              <View style={styles.settingRowContent}>
                <View style={[styles.iconContainer, { backgroundColor: '#5856D6' + '20' }]}>
                  <Ionicons name="play-circle" size={20} color="#5856D6" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Background Playback</Text>
                </View>
              </View>
              <Switch
                value={backgroundPlayback}
                onValueChange={setBackgroundPlayback}
                trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            
            <View style={[styles.settingRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <View style={styles.settingRowContent}>
                <View style={[styles.iconContainer, { backgroundColor: '#FF9500' + '20' }]}>
                  <Ionicons name="cloud-download" size={20} color="#FF9500" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Cache Streaming Songs</Text>
                </View>
              </View>
              <Switch
                value={cacheStreaming}
                onValueChange={setCacheStreaming}
                trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            
            <View style={[styles.settingRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <View style={styles.settingRowContent}>
                <View style={[styles.iconContainer, { backgroundColor: '#34C759' + '20' }]}>
                  <Ionicons name="headset" size={20} color="#34C759" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Audio Quality</Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                    {audioQuality === 'low' ? 'Low' : audioQuality === 'medium' ? 'Medium' : 'High'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.qualitySelector}
                onPress={() => {
                  const qualities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
                  const currentIndex = qualities.indexOf(audioQuality);
                  const nextQuality = qualities[(currentIndex + 1) % qualities.length];
                  setAudioQuality(nextQuality);
                }}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Storage & Downloads Section */}
        {renderSection(
          'Storage & Downloads',
          <>
            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => navigation.navigate('Downloads' as never)}
            >
              <View style={styles.settingRowContent}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="folder" size={20} color={colors.primary} />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Downloads</Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                    View downloaded songs and playlists
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </>
        )}

        {/* Appearance Section */}
        {renderSection(
          'Appearance',
          <>
            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => {
                const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
                const currentIndex = themes.indexOf(theme);
                const nextTheme = themes[(currentIndex + 1) % themes.length];
                setTheme(nextTheme);
              }}
            >
              <View style={styles.settingRowContent}>
                <View style={[styles.iconContainer, { backgroundColor: '#AF52DE' + '20' }]}>
                  <Ionicons name="moon" size={20} color="#AF52DE" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Theme</Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </>
        )}

        {/* About Section */}
        {renderSection(
          'About',
          <>
            <View style={styles.settingRow}>
              <View style={styles.settingRowContent}>
                <View style={[styles.iconContainer, { backgroundColor: '#007AFF' + '20' }]}>
                  <Ionicons name="information-circle" size={20} color="#007AFF" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Version</Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>1.0.0</Text>
                </View>
              </View>
            </View>
            <View style={[styles.settingRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <View style={styles.settingRowContent}>
                <View style={[styles.iconContainer, { backgroundColor: '#34C759' + '20' }]}>
                  <Ionicons name="code-slash" size={20} color="#34C759" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Built with</Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>React Native & Expo</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Folder Picker Modal */}
      <Modal
        visible={showFolderModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFolderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Select Folder</Text>
              <TouchableOpacity onPress={() => setShowFolderModal(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {fetchingFolders ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.scanningText, { color: colors.textSecondary }]}>Fetching folders...</Text>
              </View>
            ) : (
              <FlatList
                data={folders}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.folderItem, { borderBottomColor: colors.border }]}
                    onPress={() => handleScanFolder(item.id, item.name)}
                  >
                    <Ionicons name="folder" size={24} color={colors.primary} />
                    <Text style={[styles.folderName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No folders available.
                  </Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* API Token Modal */}
      <Modal
        visible={showApiTokenModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowApiTokenModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {editingApiToken === 'googleDrive' && 'Google Drive Client ID'}
                {editingApiToken === 'youtube' && 'YouTube API Key'}
                {editingApiToken === 'spotify' && 'Spotify API Credentials'}
              </Text>
              <TouchableOpacity onPress={() => setShowApiTokenModal(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.apiTokenHelp, { color: colors.textSecondary }]}>
              {editingApiToken === 'googleDrive' && 'Enter your Google Cloud Console Web Client ID'}
              {editingApiToken === 'youtube' && 'Enter your YouTube Data API v3 Key'}
              {editingApiToken === 'spotify' && 'Enter your Spotify Developer Client ID and Secret'}
            </Text>
            
            <TextInput
              style={[
                styles.apiTokenInput,
                {
                  backgroundColor: colors.surfaceSecondary,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder={editingApiToken === 'spotify' ? 'Client ID' : 'API Key / Client ID'}
              placeholderTextColor={colors.textTertiary}
              value={apiTokenValue}
              onChangeText={setApiTokenValue}
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            {editingApiToken === 'spotify' && (
              <TextInput
                style={[
                  styles.apiTokenInput,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    color: colors.text,
                    borderColor: colors.border,
                    marginTop: Spacing.md,
                  },
                ]}
                placeholder="Client Secret"
                placeholderTextColor={colors.textTertiary}
                value={apiTokenSecret}
                onChangeText={setApiTokenSecret}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}
            
            <TouchableOpacity
              style={[styles.saveApiTokenButton, { backgroundColor: colors.primary }]}
              onPress={saveApiToken}
            >
              <Text style={styles.saveApiTokenText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


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
    zIndex: 10,
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
    fontSize: FontSize.xl,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl + 80,
  },
  bottomSpacer: {
    height: 80,
    backgroundColor: '#1C1C1E',
  },
  section: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginLeft: Spacing.md,
  },
  sectionContent: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  settingLabel: {
    fontSize: FontSize.md,
    flex: 1,
  },
  settingValue: {
    fontSize: FontSize.md,
    color: '#8E8E93',
    marginRight: Spacing.xs,
  },
  connectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  connectionText: {
    marginLeft: Spacing.md,
  },
  connectedText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  emailText: {
    fontSize: FontSize.sm,
  },
  notConnectedContainer: {
    padding: Spacing.md,
  },
  notConnectedContent: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  notConnectedIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  progressContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  progressTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginLeft: Spacing.sm,
    flex: 1,
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
  notConnectedText: {
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  connectButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  addUrlContainer: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  urlInput: {
    flex: 1,
    height: 44,
    fontSize: FontSize.md,
  },
  urlInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
  },
  urlInputIcon: {
    marginRight: Spacing.sm,
  },
  emptyUrlContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  urlText: {
    flex: 1,
    fontSize: FontSize.sm,
  },
  removeButton: {
    padding: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    padding: Spacing.md,
  },
  qualitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qualityText: {
    fontSize: FontSize.md,
    marginRight: Spacing.xs,
  },
  scanningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  scanningText: {
    fontSize: FontSize.md,
    marginTop: Spacing.sm,
  },
  clearButton: {
    padding: Spacing.sm,
  },
  settingRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingDescription: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  pathContainer: {
    flex: 1,
  },
  pathHelp: {
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  pathInput: {
    fontSize: FontSize.sm,
    marginTop: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '70%',
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
    paddingBottom: Spacing.sm,
  },
  modalCloseButton: {
    padding: Spacing.sm,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  folderName: {
    flex: 1,
    marginLeft: Spacing.md,
    fontSize: FontSize.md,
  },
  verifyContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verifyInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  verifyHelp: {
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyLoadingText: {
    fontSize: FontSize.md,
    marginTop: Spacing.md,
  },
  apiTokenHelp: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  apiTokenInput: {
    height: 48,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
  },
  saveApiTokenButton: {
    height: 48,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveApiTokenText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  storageText: {
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  downloadResultCard: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  downloadResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  downloadResultInfo: {
    flex: 1,
  },
  downloadResultTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  downloadResultCount: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  downloadStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  downloadStatusText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  songPreviewList: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  songPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  songPreviewTitle: {
    flex: 1,
    fontSize: FontSize.sm,
  },
  moreSongsText: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  emptyVerifyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyVerifyText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptyVerifySubtext: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  downloadPathContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  downloadPathText: {
    fontSize: FontSize.sm,
    flex: 1,
  },
  activeDownloadContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  activeDownloadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  activeDownloadTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginLeft: Spacing.sm,
    flex: 1,
  },
  activeDownloadPercent: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  activeDownloadSubtext: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
