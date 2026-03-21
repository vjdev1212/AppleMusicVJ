import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme, useAudioPlayer } from '../hooks';
import { usePlaylistStore, useSettingsStore, useGoogleDriveStore } from '../store';
import { PlaylistCard, SectionHeader, MiniPlayer, SongItem } from '../components';
import { Spacing, BorderRadius, FontSize, PlayerColors } from '../constants/theme';
import { googleDriveService } from '../services/googleDriveService';
import { Playlist, Song } from '../types';

type RootStackParamList = {
  Root: undefined;
  Player: undefined;
  Playlist: { playlist: Playlist };
  Settings: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Root'>;

// Interface for offline download tracking
interface OfflineDownloadInfo {
  playlistId: string;
  playlistName: string;
  songId: string;
  songTitle: string;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress: number;
}

export const HomeScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  
  const { loadPlaylist, currentSong, isPlaying } = useAudioPlayer();
  
  const { playlists, recentlyPlayed, setPlaylists, favorites } = usePlaylistStore();
  const { streamingUrls, downloadPath } = useSettingsStore();
  const { isConnected: isGoogleDriveConnected, setConnected, lastScan, setLastScan, isScanning, scanProgress, scanStatus, setScanStatus } = useGoogleDriveStore();
  
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Create streaming playlist from URLs
  const streamingPlaylist: Playlist = {
    id: 'streaming-playlist',
    name: 'Streaming',
    description: 'Custom streaming URLs',
    songs: streamingUrls.map((url, index) => ({
      id: `stream-${index}`,
      title: `Stream ${index + 1}`,
      artist: 'Unknown Artist',
      duration: 180000,
      url,
      source: 'streaming-url',
    })),
    source: 'streaming',
  };

  // Google Drive playlists (only online - exclude local/offline playlists)
  const googleDrivePlaylists = playlists.filter(p => p.source === 'google-drive');
  
  // Online playlists only - exclude offline/local playlists from Home screen
  const onlinePlaylistsOnly = googleDrivePlaylists;
  
  // All playlists for display (online only - no offline playlists)
  const allPlaylists = [
    ...onlinePlaylistsOnly,
    ...(streamingUrls.length > 0 ? [streamingPlaylist] : []),
    ...playlists.filter(p => p.source === 'favorites'),
  ];



  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    
    // Check Google Drive connection
    const connected = await googleDriveService.isConnected();
    if (connected) {
      setConnected(true);
      // Auto-scan a "Music" folder if it exists
      try {
        const musicPlaylist = await googleDriveService.autoScanMusicFolder();
        if (musicPlaylist.length > 0) {
          setPlaylists([...playlists.filter(p => !p.id.startsWith('gdrive-')), ...musicPlaylist]);
        }
      } catch (err) {
        console.warn('Auto scan failed:', err);
      } finally {
        setLastScan(new Date());
      }
    } else {
      setConnected(false);
      // Don't load local playlists in HomeScreen - only show online content
      setPlaylists([]);
    }
    
    setRefreshing(false);
  }, [playlists, setPlaylists]);

  // Load Google Drive on mount if previously connected
  useEffect(() => {
    const checkGoogleDrive = async () => {
      const connected = await googleDriveService.isConnected();
      if (connected) {
        setConnected(true);
        // Automatically check if there is a "Music" folder on startup
        try {
          const musicPlaylist = await googleDriveService.autoScanMusicFolder();
          if (musicPlaylist.length > 0) {
             // Overwrite current google drive playlists with this one initially
             setPlaylists(musicPlaylist);
          }
        } catch (err) {
          console.warn('Auto scan on mount failed:', err);
        } finally {
          setLastScan(new Date());
        }
      } else {
        setConnected(false);
        // Don't auto-load local playlists in HomeScreen - only show online content
        setPlaylists([]);
      }
    };
    
    checkGoogleDrive();
  }, []);

  const handlePlaylistPress = (playlist: Playlist) => {
    navigation.navigate('Playlist', { playlist });
  };

  const handleRecentlyPlayedPress = (song: Song, index: number) => {
    loadPlaylist(recentlyPlayed, index);
    navigation.navigate('Player');
  };

  const handleMiniPlayerPress = () => {
    navigation.navigate('Player');
  };

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  const renderPlaylistSection = () => {
    if (allPlaylists.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No playlists yet
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
            Add streaming URLs or connect Google Drive in Settings
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        horizontal
        data={allPlaylists}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.largePlaylistCard, { backgroundColor: getPlaylistColor(index) }]}
            onPress={() => handlePlaylistPress(item)}
            activeOpacity={0.8}
          >
            <ImageBackground
              source={{ uri: item.artwork || getPlaylistArtwork(item.name) }}
              style={styles.largePlaylistImage}
              imageStyle={styles.largePlaylistImageInner}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
                style={styles.largePlaylistGradient}
              >
                <View style={styles.largePlaylistTop}>
                  <View style={styles.largePlaylistBadge}>
                    <Ionicons name="musical-notes" size={10} color="#fff" />
                    <Text style={styles.largePlaylistBadgeText}>{item.songs.length}</Text>
                  </View>
                </View>
                <View style={styles.largePlaylistInfo}>
                  <Text style={styles.largePlaylistName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.largePlaylistCount}>
                    {item.songs.length} songs
                  </Text>
                  <View style={styles.largePlayButton}>
                    <Ionicons name="play" size={20} color="#000" />
                  </View>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.largePlaylistList}
      />
    );
  };

  // Generate consistent colors for playlist cards
  const getPlaylistColor = (index: number): string => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
      '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
    ];
    return colors[index % colors.length];
  };

  // Get artwork based on playlist name
  const getPlaylistArtwork = (name: string): string => {
    const artworks: { [key: string]: string } = {
      'favorites': 'https://i.pinimg.com/736x/01/d1/b4/01d1b4547ce03c3ec499c827caac4a72.jpg',
      'recently played': 'https://i.pinimg.com/736x/8b/94/2f/8b942f5ba6bc1bfd2f113125a570d6d3.jpg',
      'default': 'https://i.pinimg.com/736x/01/d1/b4/01d1b4547ce03c3ec499c827caac4a72.jpg'
    };
    const key = Object.keys(artworks).find(k => name.toLowerCase().includes(k));
    return key ? artworks[key] : artworks['default'];
  };

  const renderRecentlyPlayed = () => {
    if (recentlyPlayed.length === 0) return null;

    const displaySongs = recentlyPlayed.slice(0, 5);
    
    if (displaySongs.length === 0) return null;

    return (
      <>
        <SectionHeader title='Recently Played' />
        <View style={styles.recentlyPlayed}>
          {displaySongs.map((song, index) => (
            <SongItem
              key={song.id}
              song={song}
              onPress={() => {
                loadPlaylist(recentlyPlayed, index);
                navigation.navigate('Player');
              }}
              isPlaying={currentSong?.id === song.id}
            />
          ))}
        </View>
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Library</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.profileButton}>
            <Image 
              source={{ uri: 'https://i.pravatar.cc/100?u=viki' }} 
              style={styles.profileImage}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: currentSong ? 100 : Spacing.xxl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Apple Music-style Greeting Card */}
        <View style={styles.greetingCardContainer}>
          <LinearGradient
            colors={isDark ? ['#1e1e1e', '#000000'] : ['#f0f0f0', '#ffffff']}
            style={styles.greetingCard}
          >
            <View style={styles.greetingContent}>
              <View style={styles.greetingTextSection}>
                <Text style={[styles.greetingLabel, { color: colors.primary }]}>{getGreeting().toUpperCase()}</Text>
                <Text style={[styles.greetingTitle, { color: colors.text }]}>Welcome back, Viki</Text>
                <Text style={[styles.greetingSubtitle, { color: colors.textSecondary }]}>
                  {lastScan ? `Last synced ${lastScan?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Ready for some music?'}
                </Text>
                {/* Sync Progress Bar - Below Last Synced Text */}
                {isScanning && (
                  <View style={styles.progressBarWrapper}>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBackground, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                        <View 
                          style={[
                            styles.progressBar, 
                            { 
                              width: `${scanProgress * 100}%`, 
                              backgroundColor: colors.primary 
                            }
                          ]} 
                        />
                      </View>
                      <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                        {scanStatus || `Syncing: ${Math.round(scanProgress * 100)}%`}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              <View style={[styles.greetingIconCircle, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons 
                  name={getGreeting() === 'Morning' ? 'sunny' : getGreeting() === 'Afternoon' ? 'partly-sunny' : 'moon'} 
                  size={32} 
                  color={colors.primary} 
                />
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Playlists Section */}
        <SectionHeader
          title={isGoogleDriveConnected ? 'Playlists' : 'Playlists'}
          rightElement={
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: isGoogleDriveConnected ? '#34C759' : '#FF3B30' }]} />
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                {isGoogleDriveConnected ? 'Online' : 'No Drive'}
              </Text>
            </View>
          }
        />
        {renderPlaylistSection()}

        {/* Recently Played / Offline Songs */}
        {renderRecentlyPlayed()}

        {/* Favorites Section */}
        {favorites.length > 0 && (
          <>
            <SectionHeader title="Favorites" />
            <View style={styles.recentlyPlayed}>
              {favorites.slice(0, 5).map((song, index) => (
                <SongItem
                  key={song.id}
                  song={song}
                  onPress={() => {
                    loadPlaylist(favorites, index);
                    navigation.navigate('Player');
                  }}
                  isPlaying={currentSong?.id === song.id}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

    </View>
  );
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xxxl || 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  offlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.round,
    gap: 6,
    marginRight: 4,
  },
  offlineToggleText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  offlineLoadingIndicator: {
    marginLeft: 2,
  },
  settingsButton: {
    padding: Spacing.xs,
  },
  profileButton: {
    marginLeft: Spacing.xs,
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  greetingCardContainer: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  greetingCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  greetingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingTextSection: {
    flex: 1,
  },
  greetingLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  greetingSubtitle: {
    fontSize: FontSize.sm,
    opacity: 0.8,
  },
  greetingIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistList: {
    paddingHorizontal: Spacing.md,
  },
  largePlaylistList: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  largePlaylistCard: {
    width: 160,
    height: 200,
    marginRight: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  largePlaylistImage: {
    width: '100%',
    height: '100%',
  },
  largePlaylistImageInner: {
    borderRadius: BorderRadius.lg,
  },
  largePlaylistGradient: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  largePlaylistTop: {
    alignItems: 'flex-end',
  },
  largePlaylistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  largePlaylistBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  largePlaylistInfo: {
    marginTop: 'auto',
  },
  largePlaylistName: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  largePlaylistCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  largePlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  recentlyPlayed: {
    marginBottom: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: FontSize.md,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  progressBarWrapper: {
    marginTop: Spacing.sm,
  },
  progressBarContainer: {
    padding: Spacing.sm,
  },
  progressBackground: {
    height: 5,
    borderRadius: 2.5,
    width: '100%',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2.5,
  },
  progressText: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
