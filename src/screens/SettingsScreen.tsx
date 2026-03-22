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
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';

import { useTheme } from '../hooks';
import { useSettingsStore, useGoogleDriveStore, usePlaylistStore } from '../store/store_index';
import { googleDriveService } from '../services/googleDriveService';
import { audioService } from '../services/audioService';
import { Spacing, BorderRadius, FontSize } from '../constants/theme';
import { Song } from '../types';

// ─── Static project constants (never need to change in code) ─────────────────
const PROJECT_NAME = 'AppleMusicPlayer';
const PROJECT_FULL_NAME = '@viki28593/apple-music-player';
const REDIRECT_URI = `https://auth.expo.io/@viki28593/apple-music-player`;
const DEFAULT_CLIENT_ID = '707441092866-71mnlkak61ms6llchle9d14i4n5gop9o.apps.googleusercontent.com';

// ─── Editable token types ─────────────────────────────────────────────────────
type ApiTokenType = 'googleDrive' | 'youtube' | 'spotify' | 'testUser';

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
    testUser,
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
    setTestUser,
  } = useSettingsStore();

  const { isConnected, email, isScanning, scanProgress, setConnected, setDisconnected } = useGoogleDriveStore();
  const { setPlaylists } = usePlaylistStore();

  const [newUrl, setNewUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);

  // API Token Modal State
  const [showApiTokenModal, setShowApiTokenModal] = useState(false);
  const [editingApiToken, setEditingApiToken] = useState<ApiTokenType | null>(null);
  const [apiTokenValue, setApiTokenValue] = useState('');
  const [apiTokenSecret, setApiTokenSecret] = useState('');

  // Folder Selection State
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [fetchingFolders, setFetchingFolders] = useState(false);

  // Project Info Modal State
  const [showProjectInfoModal, setShowProjectInfoModal] = useState(false);

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

  // ─── Derived display values ───────────────────────────────────────────────
  const activeClientId = (googleDriveClientId && googleDriveClientId.trim().length > 0)
    ? googleDriveClientId.trim()
    : DEFAULT_CLIENT_ID;

  const displayTestUser = (testUser && testUser.trim().length > 0)
    ? testUser.trim()
    : 'Not configured';

  // ─── On mount ────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkConnection = async () => {
      const connected = await googleDriveService.isConnected();
      if (connected) setConnected(true);
    };
    checkConnection();
  }, []);

  // ─── Google Drive handlers ────────────────────────────────────────────────

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
    Alert.alert('Disconnect Google Drive', 'Are you sure you want to disconnect?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive', onPress: async () => {
          await googleDriveService.disconnect();
          setDisconnected();
          setPlaylists([]);
        },
      },
    ]);
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
      const scannedPlaylists = await googleDriveService.scanDrive(folderId, folderName);
      if (scannedPlaylists.length > 0 && scannedPlaylists[0].songs.length > 0) {
        setPlaylists(scannedPlaylists);
        Alert.alert('Success', `Found ${scannedPlaylists[0].songs.length} audio files in "${folderName}"`);
      } else {
        Alert.alert('Notice', `No audio files found in "${folderName}"`);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to scan folder');
    } finally {
      setScanning(false);
    }
  };

  // ─── Streaming URL handlers ───────────────────────────────────────────────

  const handleAddStreamUrl = () => {
    if (!newUrl.trim()) { Alert.alert('Error', 'Please enter a valid URL'); return; }
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      Alert.alert('Error', 'URL must start with http:// or https://'); return;
    }
    addStreamingUrl(newUrl.trim());
    setNewUrl('');
  };

  const handleRemoveStreamUrl = (url: string) => {
    Alert.alert('Remove URL', 'Are you sure you want to remove this streaming URL?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeStreamingUrl(url) },
    ]);
  };

  // ─── Download handlers ────────────────────────────────────────────────────

  const handleClearDownloads = async () => {
    Alert.alert('Clear Downloads', 'Are you sure you want to delete all offline songs?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          await googleDriveService.clearDownloads();
          await audioService.clearCache();
          Alert.alert('Success', 'Local storage and cache cleared.');
        }
      }
    ]);
  };

  const handleVerifyDownloads = useCallback(async () => {
    setVerifyingDownloads(true);
    setShowDownloadModal(true);
    setDownloadVerificationResults([]);
    try {
      const downloadsDir = `${FileSystem.documentDirectory}${downloadPath}`;
      const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
      if (!dirInfo.exists) {
        setDownloadVerificationResults([{ playlistName: 'No Downloads', songs: [], totalSongs: 0, downloadedCount: 0 }]);
        setVerifyingDownloads(false);
        return;
      }
      const folderList = await FileSystem.readDirectoryAsync(downloadsDir);
      const results: typeof downloadVerificationResults = [];
      let totalSize = 0;
      for (const folderName of folderList) {
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
                songs.push({ title: fileName.replace(/\.[^/.]+$/, ''), downloaded: true, path: fileUri });
              } else {
                songs.push({ title: fileName.replace(/\.[^/.]+$/, ''), downloaded: false });
              }
            }
          }
          if (songs.length > 0) results.push({ playlistName: folderName, songs, totalSongs: songs.length, downloadedCount });
        }
      }
      setTotalStorageUsed(`${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
      setDownloadVerificationResults(results.length === 0
        ? [{ playlistName: 'No Audio Files Found', songs: [], totalSongs: 0, downloadedCount: 0 }]
        : results
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to verify downloads. Please try again.');
    } finally {
      setVerifyingDownloads(false);
    }
  }, [downloadPath]);

  // ─── Clipboard ────────────────────────────────────────────────────────────

  const handleCopyToClipboard = (value: string, label: string) => {
    Clipboard.setString(value);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  // ─── API Token Modal ──────────────────────────────────────────────────────

  const openApiTokenModal = (type: ApiTokenType) => {
    setEditingApiToken(type);
    setApiTokenSecret('');
    if (type === 'googleDrive') {
      setApiTokenValue(googleDriveClientId || DEFAULT_CLIENT_ID);
    } else if (type === 'youtube') {
      setApiTokenValue(youtubeApiKey || '');
    } else if (type === 'spotify') {
      setApiTokenValue(spotifyClientId || '');
      setApiTokenSecret(spotifyClientSecret || '');
    } else if (type === 'testUser') {
      setApiTokenValue(testUser || '');
    }
    setShowApiTokenModal(true);
  };

  const saveApiToken = () => {
    if (editingApiToken === 'googleDrive') {
      setGoogleDriveClientId(apiTokenValue.trim());
    } else if (editingApiToken === 'youtube') {
      setYoutubeApiKey(apiTokenValue.trim());
    } else if (editingApiToken === 'spotify') {
      setSpotifyClientId(apiTokenValue.trim());
      setSpotifyClientSecret(apiTokenSecret.trim());
    } else if (editingApiToken === 'testUser') {
      setTestUser(apiTokenValue.trim());
    }
    setShowApiTokenModal(false);
    setEditingApiToken(null);
    Alert.alert('Saved', 'Configuration saved successfully.');
  };

  // ─── Modal text helpers ───────────────────────────────────────────────────

  const getModalTitle = (): string => {
    switch (editingApiToken) {
      case 'googleDrive': return 'Google Drive Client ID';
      case 'youtube': return 'YouTube API Key';
      case 'spotify': return 'Spotify API Credentials';
      case 'testUser': return 'Test User Email';
      default: return '';
    }
  };

  const getModalHelp = (): string => {
    switch (editingApiToken) {
      case 'googleDrive':
        return 'Paste your OAuth 2.0 Web Client ID from Google Cloud Console. It ends with .apps.googleusercontent.com';
      case 'youtube':
        return 'Enter your YouTube Data API v3 Key from Google Cloud Console';
      case 'spotify':
        return 'Enter your Spotify Developer Client ID and Secret from the Spotify Dashboard';
      case 'testUser':
        return 'Enter the Gmail address you added as a Test User in your Google Cloud Console OAuth consent screen. This is the account that can sign in during development.';
      default:
        return '';
    }
  };

  const getModalPlaceholder = (): string => {
    switch (editingApiToken) {
      case 'googleDrive': return 'xxxxxx.apps.googleusercontent.com';
      case 'youtube': return 'AIzaSy...';
      case 'spotify': return 'Client ID';
      case 'testUser': return 'yourname@gmail.com';
      default: return 'Enter value';
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>{children}</View>
    </View>
  );

  const renderInfoRow = (
    icon: string,
    iconColor: string,
    label: string,
    value: string,
    copyable = true,
    isLast = false
  ) => (
    <View style={[
      styles.infoRow,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }
    ]}>
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.infoTextContainer}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1} selectable>
          {value}
        </Text>
      </View>
      {copyable && (
        <TouchableOpacity
          style={[styles.copyButton, { backgroundColor: colors.surfaceSecondary }]}
          onPress={() => handleCopyToClipboard(value, label)}
        >
          <Ionicons name="copy-outline" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );

  // ─── UI ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── Header ── */}
      <View style={[styles.headerContainer, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home' as never)}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ════════════════ Google Drive ════════════════ */}
        {renderSection('Google Drive', <>
          {isConnected ? (
            <>
              <View style={styles.connectionInfo}>
                <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                <View style={styles.connectionText}>
                  <Text style={[styles.connectedText, { color: colors.text }]}>Connected</Text>
                  <Text style={[styles.emailText, { color: colors.textSecondary }]}>
                    {email || displayTestUser}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.settingRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                onPress={handleFetchFolders}
              >
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

              <TouchableOpacity
                style={[styles.settingRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                onPress={handleGoogleDriveDisconnect}
              >
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
                {isScanning ? (
                  <View style={[styles.progressContainer, { backgroundColor: colors.surfaceSecondary }]}>
                    <View style={styles.progressHeader}>
                      <Ionicons name="download" size={20} color={colors.primary} />
                      <Text style={[styles.progressTitle, { color: colors.text }]}>Downloading...</Text>
                      <Text style={[styles.progressPercent, { color: colors.primary }]}>
                        {Math.round(scanProgress * 100)}%
                      </Text>
                    </View>
                    <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                      <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${scanProgress * 100}%` as any }]} />
                    </View>
                    <Text style={[styles.progressSubtext, { color: colors.textSecondary }]}>
                      {scanProgress < 1 ? 'Downloading songs to device...' : 'Finalizing...'}
                    </Text>
                  </View>
                ) : (
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
        </>)}

        {/* ════════════════ Project Info ════════════════ */}
        {renderSection('Project Info', <>
          <TouchableOpacity style={styles.settingRow} onPress={() => setShowProjectInfoModal(true)}>
            <View style={styles.settingRowContent}>
              <View style={[styles.iconContainer, { backgroundColor: '#4285F4' + '20' }]}>
                <Ionicons name="information-circle" size={20} color="#4285F4" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Project Info</Text>
                <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                  Client ID, Redirect URI, Test User & more
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </>)}



        {/* ════════════════ Streaming URLs ════════════════ */}
        {renderSection('Streaming URLs', <>
          <View style={styles.addUrlContainer}>
            <View style={[styles.urlInputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Ionicons name="link" size={18} color={colors.textTertiary} style={styles.urlInputIcon} />
              <TextInput
                style={[styles.urlInput, { color: colors.text }]}
                placeholder="Enter MP3 URL"
                placeholderTextColor={colors.textTertiary}
                value={newUrl}
                onChangeText={setNewUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={handleAddStreamUrl}>
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {streamingUrls.map((url, index) => (
            <View key={index} style={styles.urlRow}>
              <Ionicons name="musical-note" size={16} color={colors.primary} />
              <Text style={[styles.urlText, { color: colors.text }]} numberOfLines={1}>{url}</Text>
              <TouchableOpacity onPress={() => handleRemoveStreamUrl(url)} style={styles.removeButton}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          ))}
          {streamingUrls.length === 0 && (
            <View style={styles.emptyUrlContainer}>
              <Ionicons name="link-outline" size={32} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No streaming URLs added</Text>
            </View>
          )}
        </>)}

        {/* ════════════════ Player Settings ════════════════ */}
        {renderSection('Player Settings', <>
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
                const nextQuality = qualities[(qualities.indexOf(audioQuality) + 1) % qualities.length];
                setAudioQuality(nextQuality);
              }}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </>)}

        {/* ════════════════ Storage & Downloads ════════════════ */}
        {renderSection('Storage & Downloads', <>
          <TouchableOpacity style={styles.settingRow} onPress={() => navigation.navigate('Downloads' as never)}>
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
        </>)}

        {/* ════════════════ Appearance ════════════════ */}
        {renderSection('Appearance', <>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => {
              const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
              const nextTheme = themes[(themes.indexOf(theme) + 1) % themes.length];
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
        </>)}

        {/* ════════════════ About ════════════════ */}
        {renderSection('About', <>
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
        </>)}

      </ScrollView>

      {/* ════════════════ Project Info Modal ════════════════ */}
      <Modal visible={showProjectInfoModal} animationType="slide" transparent onRequestClose={() => setShowProjectInfoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Project Info</Text>
              <TouchableOpacity onPress={() => setShowProjectInfoModal(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* ── Static info ── */}
              {/* Project Name */}
              <View style={[styles.infoRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                <View style={[styles.iconContainer, { backgroundColor: '#4285F4' + '20' }]}>
                  <Ionicons name="apps" size={18} color="#4285F4" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Project Name</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]} selectable>{PROJECT_NAME}</Text>
                </View>
              </View>

              {/* Expo Slug */}
              <View style={[styles.infoRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                <View style={[styles.iconContainer, { backgroundColor: '#FF9500' + '20' }]}>
                  <Ionicons name="code-slash" size={18} color="#FF9500" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Expo Slug</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]} selectable>{PROJECT_FULL_NAME}</Text>
                </View>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary }]}
                  onPress={() => { Clipboard.setString(PROJECT_FULL_NAME); Alert.alert('Copied', 'Expo slug copied'); }}>
                  <Ionicons name="copy-outline" size={15} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Redirect URI */}
              <View style={[styles.infoRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                <View style={[styles.iconContainer, { backgroundColor: '#FF9500' + '20' }]}>
                  <Ionicons name="link" size={18} color="#FF9500" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Redirect URI</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1} selectable>{REDIRECT_URI}</Text>
                </View>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary }]}
                  onPress={() => { Clipboard.setString(REDIRECT_URI); Alert.alert('Copied', 'Redirect URI copied'); }}>
                  <Ionicons name="copy-outline" size={15} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* ── Configurable items (copy + edit) ── */}
              {/* Client ID (Google Drive) */}
              <View style={[styles.infoRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                <View style={[styles.iconContainer, { backgroundColor: '#AF52DE' + '20' }]}>
                  <Ionicons name="key" size={18} color="#AF52DE" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Client ID (Google Drive)</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1} selectable>{activeClientId}</Text>
                </View>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary }]}
                  onPress={() => { Clipboard.setString(activeClientId); Alert.alert('Copied', 'Client ID copied'); }}>
                  <Ionicons name="copy-outline" size={15} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, marginLeft: 6 }]}
                  onPress={() => { setShowProjectInfoModal(false); setTimeout(() => openApiTokenModal('googleDrive'), 300); }}>
                  <Ionicons name="create-outline" size={15} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Test User Email */}
              <View style={[styles.infoRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                <View style={[styles.iconContainer, { backgroundColor: '#34C759' + '20' }]}>
                  <Ionicons name="person-circle" size={18} color="#34C759" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Test User Email</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]} selectable>{displayTestUser}</Text>
                </View>
                {testUser ? (
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => { Clipboard.setString(testUser); Alert.alert('Copied', 'Email copied'); }}>
                    <Ionicons name="copy-outline" size={15} color={colors.primary} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, marginLeft: 6 }]}
                  onPress={() => { setShowProjectInfoModal(false); setTimeout(() => openApiTokenModal('testUser'), 300); }}>
                  <Ionicons name="create-outline" size={15} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* YouTube API Key */}
              <View style={[styles.infoRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                <View style={[styles.iconContainer, { backgroundColor: '#FF0000' + '20' }]}>
                  <Ionicons name="logo-youtube" size={18} color="#FF0000" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>YouTube API Key</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1} selectable>
                    {youtubeApiKey || 'Not configured'}
                  </Text>
                </View>
                {youtubeApiKey ? (
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => { Clipboard.setString(youtubeApiKey); Alert.alert('Copied', 'YouTube API key copied'); }}>
                    <Ionicons name="copy-outline" size={15} color={colors.primary} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, marginLeft: 6 }]}
                  onPress={() => { setShowProjectInfoModal(false); setTimeout(() => openApiTokenModal('youtube'), 300); }}>
                  <Ionicons name="create-outline" size={15} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Spotify Client ID */}
              <View style={[styles.infoRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                <View style={[styles.iconContainer, { backgroundColor: '#1DB954' + '20' }]}>
                  <Ionicons name="musical-notes" size={18} color="#1DB954" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Spotify Client ID</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1} selectable>
                    {spotifyClientId || 'Not configured'}
                  </Text>
                </View>
                {spotifyClientId ? (
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => { Clipboard.setString(spotifyClientId); Alert.alert('Copied', 'Spotify Client ID copied'); }}>
                    <Ionicons name="copy-outline" size={15} color={colors.primary} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, marginLeft: 6 }]}
                  onPress={() => { setShowProjectInfoModal(false); setTimeout(() => openApiTokenModal('spotify'), 300); }}>
                  <Ionicons name="create-outline" size={15} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Spotify Client Secret */}
              <View style={styles.infoRow}>
                <View style={[styles.iconContainer, { backgroundColor: '#1DB954' + '20' }]}>
                  <Ionicons name="lock-closed" size={18} color="#1DB954" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Spotify Client Secret</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1} selectable>
                    {spotifyClientSecret ? '••••••••••••••••' : 'Not configured'}
                  </Text>
                </View>
                {spotifyClientSecret ? (
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => { Clipboard.setString(spotifyClientSecret); Alert.alert('Copied', 'Spotify secret copied'); }}>
                    <Ionicons name="copy-outline" size={15} color={colors.primary} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, marginLeft: 6 }]}
                  onPress={() => { setShowProjectInfoModal(false); setTimeout(() => openApiTokenModal('spotify'), 300); }}>
                  <Ionicons name="create-outline" size={15} color={colors.primary} />
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════════════════ Folder Picker Modal ════════════════ */}
      <Modal visible={showFolderModal} animationType="slide" transparent onRequestClose={() => setShowFolderModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Folder</Text>
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
                    <Text style={[styles.folderName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No folders available.</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ════════════════ API Config Modal ════════════════ */}
      <Modal visible={showApiTokenModal} animationType="slide" transparent onRequestClose={() => setShowApiTokenModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{getModalTitle()}</Text>
              <TouchableOpacity onPress={() => setShowApiTokenModal(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.apiTokenHelp, { color: colors.textSecondary }]}>
              {getModalHelp()}
            </Text>

            {/* Redirect URI reminder — Google Drive only */}
            {editingApiToken === 'googleDrive' && (
              <View style={[styles.redirectUriBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View style={styles.redirectUriHeader}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                  <Text style={[styles.redirectUriLabel, { color: colors.textSecondary }]}>
                    Add this as Authorised Redirect URI in Google Cloud:
                  </Text>
                </View>
                <View style={styles.redirectUriRow}>
                  <Text style={[styles.redirectUriValue, { color: colors.text }]} numberOfLines={1}>
                    {REDIRECT_URI}
                  </Text>
                  <TouchableOpacity onPress={() => handleCopyToClipboard(REDIRECT_URI, 'Redirect URI')}>
                    <Ionicons name="copy-outline" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Primary input */}
            <TextInput
              style={[styles.apiTokenInput, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
              placeholder={getModalPlaceholder()}
              placeholderTextColor={colors.textTertiary}
              value={apiTokenValue}
              onChangeText={setApiTokenValue}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={editingApiToken === 'testUser' ? 'email-address' : 'default'}
            />

            {/* Spotify secret */}
            {editingApiToken === 'spotify' && (
              <TextInput
                style={[styles.apiTokenInput, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border, marginTop: Spacing.sm }]}
                placeholder="Client Secret"
                placeholderTextColor={colors.textTertiary}
                value={apiTokenSecret}
                onChangeText={setApiTokenSecret}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}

            {/* Reset to default — Google Drive only */}
            {editingApiToken === 'googleDrive' && (
              <TouchableOpacity
                style={[styles.resetButton, { borderColor: colors.border }]}
                onPress={() => setApiTokenValue(DEFAULT_CLIENT_ID)}
              >
                <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.resetButtonText, { color: colors.textSecondary }]}>Reset to Default</Text>
              </TouchableOpacity>
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
  container: { flex: 1 },
  headerContainer: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', zIndex: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backButton: { padding: Spacing.xs },
  headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xxl + 80 },

  section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.md },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '600', textTransform: 'uppercase', marginBottom: Spacing.sm, marginLeft: Spacing.md },
  sectionContent: { borderRadius: BorderRadius.md, overflow: 'hidden' },

  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.md },
  settingLabel: { fontSize: FontSize.md, flex: 1 },
  settingValue: { fontSize: FontSize.md, color: '#8E8E93', marginRight: Spacing.xs },
  settingRowContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingTextContainer: { flex: 1 },
  settingDescription: { fontSize: FontSize.sm, marginTop: 2 },
  iconContainer: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },

  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.md },
  infoTextContainer: { flex: 1 },
  infoLabel: { fontSize: FontSize.xs, fontWeight: '500', marginBottom: 2 },
  infoValue: { fontSize: FontSize.sm },
  copyButton: { padding: 6, borderRadius: 6, marginLeft: Spacing.sm },
  iconBtn: { padding: 6, borderRadius: 6, marginLeft: 4 },

  connectionInfo: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  connectionText: { marginLeft: Spacing.md },
  connectedText: { fontSize: FontSize.md, fontWeight: '600' },
  emailText: { fontSize: FontSize.sm },
  notConnectedContainer: { padding: Spacing.md },
  notConnectedContent: { alignItems: 'center', paddingVertical: Spacing.lg },
  notConnectedIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  notConnectedText: { fontSize: FontSize.md, textAlign: 'center' },
  connectButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: Spacing.md, marginHorizontal: Spacing.md, marginBottom: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm },
  connectButtonText: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: '600' },

  progressContainer: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  progressTitle: { fontSize: FontSize.md, fontWeight: '600', marginLeft: Spacing.sm, flex: 1 },
  progressPercent: { fontSize: FontSize.md, fontWeight: '700' },
  progressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: Spacing.sm },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressSubtext: { fontSize: FontSize.sm, textAlign: 'center' },

  addUrlContainer: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm },
  urlInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, borderWidth: 1 },
  urlInputIcon: { marginRight: Spacing.sm },
  urlInput: { flex: 1, height: 44, fontSize: FontSize.md },
  addButton: { width: 44, height: 44, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center' },
  urlRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.2)' },
  urlText: { flex: 1, fontSize: FontSize.sm },
  removeButton: { padding: Spacing.sm },
  emptyUrlContainer: { alignItems: 'center', paddingVertical: Spacing.lg },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center', padding: Spacing.md },

  qualitySelector: { flexDirection: 'row', alignItems: 'center' },
  scanningContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  scanningText: { fontSize: FontSize.md, marginTop: Spacing.sm },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { height: '75%', borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg, padding: Spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)', paddingBottom: Spacing.sm },
  modalTitle: { fontSize: FontSize.xl, fontWeight: 'bold' },
  modalCloseButton: { padding: Spacing.sm },
  modalLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  folderItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  folderName: { flex: 1, marginLeft: Spacing.md, fontSize: FontSize.md },

  apiTokenHelp: { fontSize: FontSize.sm, marginBottom: Spacing.md, lineHeight: 20 },
  apiTokenInput: { height: 48, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, fontSize: FontSize.sm, borderWidth: 1, marginBottom: Spacing.sm },
  redirectUriBox: { borderRadius: BorderRadius.sm, borderWidth: 1, padding: Spacing.sm, marginBottom: Spacing.md },
  redirectUriHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  redirectUriLabel: { fontSize: FontSize.xs, flex: 1 },
  redirectUriRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  redirectUriValue: { fontSize: FontSize.xs, flex: 1, marginRight: Spacing.sm },
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: BorderRadius.sm, borderWidth: 1, marginBottom: Spacing.sm },
  resetButtonText: { fontSize: FontSize.sm },
  saveApiTokenButton: { height: 48, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.sm },
  saveApiTokenText: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: '600' },

  // Kept for compatibility
  pathContainer: { flex: 1 },
  pathHelp: { fontSize: FontSize.xs, marginTop: 4 },
  pathInput: { fontSize: FontSize.sm, marginTop: 8, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.sm },
  verifyContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verifyInfo: { flex: 1, marginRight: Spacing.md },
  verifyHelp: { fontSize: FontSize.xs, marginTop: 4 },
  verifyButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, gap: 6 },
  verifyButtonText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: '600' },
  verifyLoadingText: { fontSize: FontSize.md, marginTop: Spacing.md },
  storageText: { fontSize: FontSize.sm, marginTop: 4 },
  downloadResultCard: { marginHorizontal: Spacing.md, marginVertical: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
  downloadResultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  downloadResultInfo: { flex: 1 },
  downloadResultTitle: { fontSize: FontSize.md, fontWeight: '600' },
  downloadResultCount: { fontSize: FontSize.sm, marginTop: 2 },
  downloadStatusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  downloadStatusText: { color: '#FFFFFF', fontSize: FontSize.xs, fontWeight: '600' },
  songPreviewList: { marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.2)' },
  songPreviewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  songPreviewTitle: { flex: 1, fontSize: FontSize.sm },
  moreSongsText: { fontSize: FontSize.sm, marginTop: Spacing.xs, fontStyle: 'italic' },
  emptyVerifyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.xxl * 2 },
  emptyVerifyText: { fontSize: FontSize.lg, fontWeight: '600', marginTop: Spacing.md },
  emptyVerifySubtext: { fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.sm, paddingHorizontal: Spacing.lg },
  downloadPathContainer: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.sm, marginBottom: Spacing.md, gap: Spacing.sm },
  downloadPathText: { fontSize: FontSize.sm, flex: 1 },
  activeDownloadContainer: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md, borderWidth: 1 },
  activeDownloadHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  activeDownloadTitle: { fontSize: FontSize.md, fontWeight: '600', marginLeft: Spacing.sm, flex: 1 },
  activeDownloadPercent: { fontSize: FontSize.md, fontWeight: '700' },
  activeDownloadSubtext: { fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xs },
  bottomSpacer: { height: 80 },
  clearButton: { padding: Spacing.sm },
});