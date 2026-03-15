import React, { useState, useEffect } from 'react';
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

import { useTheme } from '../hooks';
import { useSettingsStore, useGoogleDriveStore, usePlaylistStore } from '../store';
import { googleDriveService } from '../services/googleDriveService';
import { Spacing, BorderRadius, FontSize } from '../constants/theme';

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
    setTheme,
    setBackgroundPlayback,
    setAudioQuality,
    setCacheStreaming,
    addStreamingUrl,
    removeStreamingUrl,
  } = useSettingsStore();
  
  const { isConnected, email, setConnected, setDisconnected } = useGoogleDriveStore();
  const { setPlaylists } = usePlaylistStore();
  
  const [newUrl, setNewUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  
  // Folder Selection State
  const [folders, setFolders] = useState<{id: string; name: string}[]>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [fetchingFolders, setFetchingFolders] = useState(false);

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
                {renderSettingRow('Select Folder to Scan', undefined, handleFetchFolders, false)}
                {scanning && (
                  <View style={styles.scanningContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.scanningText, { color: colors.textSecondary }]}>Scanning folder...</Text>
                  </View>
                )}
                {renderSettingRow(
                  'Disconnect',
                  undefined,
                  handleGoogleDriveDisconnect,
                  true
                )}
              </>
            ) : (
              <>
                <View style={styles.notConnectedContainer}>
                  <Text style={[styles.notConnectedText, { color: colors.textSecondary }]}>
                    Connect your Google Drive to scan for MP3 files
                  </Text>
                </View>
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
              </>
            )}
          </>
        )}

        {/* Account Details Section */}
        {renderSection(
          'Account Details',
          <>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Expo Username</Text>
              <Text style={styles.settingValue}>viki28593</Text>
            </View>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Apple Music Connect</Text>
              <Text style={styles.settingValue}>Not Linked</Text>
            </View>
          </>
        )}

        {/* Streaming URLs Section */}
        {renderSection(
          'Streaming URLs',
          <>
            <View style={styles.addUrlContainer}>
              <TextInput
                style={[
                  styles.urlInput,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Enter MP3 URL"
                placeholderTextColor={colors.textTertiary}
                value={newUrl}
                onChangeText={setNewUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={handleAddStreamUrl}
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            {streamingUrls.map((url, index) => (
              <View key={index} style={styles.urlRow}>
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
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                No streaming URLs added
              </Text>
            )}
          </>
        )}

        {/* Player Settings Section */}
        {renderSection(
          'Player Settings',
          <>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Background Playback
              </Text>
              <Switch
                value={backgroundPlayback}
                onValueChange={setBackgroundPlayback}
                trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            
            <View style={[styles.settingRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Cache Streaming Songs
              </Text>
              <Switch
                value={cacheStreaming}
                onValueChange={setCacheStreaming}
                trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            
            <View style={[styles.settingRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Audio Quality
              </Text>
              <TouchableOpacity style={styles.qualitySelector}>
                <Text style={[styles.qualityText, { color: colors.textSecondary }]}>
                  {audioQuality === 'low' ? 'Low' : audioQuality === 'medium' ? 'Medium' : 'High'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Appearance Section */}
        {renderSection(
          'Appearance',
          <>
            {renderSettingRow(
              'Theme',
              theme.charAt(0).toUpperCase() + theme.slice(1),
              () => {
                const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
                const currentIndex = themes.indexOf(theme);
                const nextTheme = themes[(currentIndex + 1) % themes.length];
                setTheme(nextTheme);
              }
            )}
          </>
        )}

        {/* About Section */}
        {renderSection(
          'About',
          <>
            {renderSettingRow('Version', '1.0.0')}
            {renderSettingRow('Built with', 'React Native & Expo')}
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
    paddingBottom: Spacing.xxl,
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
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    borderWidth: 1,
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
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
});
