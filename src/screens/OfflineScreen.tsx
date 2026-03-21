import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Animated,
  Dimensions,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme, useAudioPlayer } from '../hooks';
import { usePlaylistStore } from '../store';
import { MiniPlayer, SongItem } from '../components';
import { Spacing, FontSize, BorderRadius } from '../constants/theme';
import { googleDriveService } from '../services/googleDriveService';
import { Playlist, Song } from '../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAYLIST_CARD_WIDTH = SCREEN_WIDTH * 0.42;

type RootStackParamList = {
  Root: undefined;
  Player: undefined;
  Playlist: { playlist: Playlist };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Root'>;

export const OfflineScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  
  const { loadPlaylist, currentSong } = useAudioPlayer();
  const { setPlaylists } = usePlaylistStore();
  
  const [offlinePlaylists, setOfflinePlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Animated states
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [displayedSongs, setDisplayedSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [totalSongs, setTotalSongs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Animation values - using useState to maintain stable references
  const [expandAnim] = useState(() => new Animated.Value(0));
  const [progressAnim] = useState(() => new Animated.Value(0));
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const [headerAnim] = useState(() => new Animated.Value(0));

  // Load offline playlists on mount
  useEffect(() => {
    const init = async () => {
      try {
        await loadOfflinePlaylists();
        Animated.timing(headerAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      } catch (err) {
        setError('Failed to load offline playlists');
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pulse animation for loading indicator
  useEffect(() => {
    if (isLoading || songsLoading) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [isLoading, songsLoading, pulseAnim]);

  // Load offline playlists - using fast method for quick display
  const loadOfflinePlaylists = useCallback(async () => {
    setIsLoading(true);
    try {
      const localPlaylists = await googleDriveService.discoverLocalPlaylistsFast();
      if (localPlaylists) {
        setOfflinePlaylists(localPlaylists);
        setPlaylists(localPlaylists);
      }
    } catch (error) {
      console.warn('[Offline] Error loading playlists:', error);
      setOfflinePlaylists([]);
    } finally {
      setIsLoading(false);
    }
  }, [setPlaylists]);

  // Lazy load songs one by one with beautiful animation
  const lazyLoadSongs = useCallback(async (playlist: Playlist) => {
    // Animate expand
    Animated.spring(expandAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();

    setSelectedPlaylistId(playlist.id);
    setDisplayedSongs([]);
    setSongsLoading(true);
    setLoadProgress(0);
    setTotalSongs(playlist.songs.length);

    // Animate progress
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: false,
    }).start();

    // Load songs one by one with animation
    for (let i = 0; i < playlist.songs.length; i++) {
      const song = playlist.songs[i];
      
      // Add song with animation
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setDisplayedSongs(prev => [...prev, song]);
      
      // Update progress with animation
      const progress = (i + 1) / playlist.songs.length;
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 150,
        useNativeDriver: false,
      }).start();
      
      setLoadProgress(i + 1);
      
      // Small delay to visualize loading
      if (i < playlist.songs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 80));
      }
    }
    
    setSongsLoading(false);
  }, [expandAnim, progressAnim]);

  // Close expanded view
  const closeExpanded = useCallback(() => {
    Animated.timing(expandAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setSelectedPlaylistId(null);
      setDisplayedSongs([]);
    });
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadOfflinePlaylists();
    setIsRefreshing(false);
  }, [loadOfflinePlaylists]);

  // Handle playlist press
  const handlePlaylistPress = (playlist: Playlist) => {
    if (selectedPlaylistId === playlist.id) {
      closeExpanded();
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      lazyLoadSongs(playlist);
    }
  };

  // Handle song press
  const handleSongPress = (song: Song, index: number) => {
    const playlist = offlinePlaylists.find(p => p.id === selectedPlaylistId);
    if (playlist) {
      loadPlaylist(playlist.songs, index);
      navigation.navigate('Player');
    }
  };

  // Get selected playlist
  const selectedPlaylist = offlinePlaylists.find(p => p.id === selectedPlaylistId);

  // Animated values
  const expandTranslateY = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0],
  });
  
  const expandOpacity = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Calculate total offline songs
  const totalOfflineSongs = offlinePlaylists.reduce((sum, p) => sum + p.songs.length, 0);

  // Default playlist artwork image for offline playlists
  const DEFAULT_PLAYLIST_IMAGE = 'https://i.pinimg.com/736x/01/d1/b4/01d1b4547ce03c3ec499c827caac4a72.jpg';

  // Generate a color based on playlist name for placeholder
  const getPlaylistColor = (name: string): string => {
    const colors_array = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8B500', '#00CED1', '#FF69B4', '#32CD32', '#FF4500',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors_array[Math.abs(hash) % colors_array.length];
  };

  // Render playlist card with stunning modern UI
  const renderPlaylistItem = ({ item, index }: { item: Playlist; index: number }) => {
    const isSelected = selectedPlaylistId === item.id;
    const playlistColor = getPlaylistColor(item.name);

    const handlePress = () => {
      handlePlaylistPress(item);
    };

    return (
      <View style={styles.playlistCardWrapper}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePress}
        >
          <View style={[
            styles.playlistCard,
            { backgroundColor: isSelected ? colors.primary + '20' : colors.surface }
          ]}>
            <View style={styles.playlistArtworkContainer}>
              <Image 
                source={{ uri: item.artwork || DEFAULT_PLAYLIST_IMAGE }} 
                style={styles.playlistArtwork} 
              />
              <View style={[styles.playOverlay, { backgroundColor: isSelected ? colors.primary : 'rgba(0,0,0,0.4)' }]}>
                <Ionicons name={isSelected ? "checkmark" : "play"} size={28} color="#FFF" />
              </View>
              {item.songs.length > 0 && (
                <View style={[styles.songCountBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                  <Ionicons name="musical-note" size={10} color="#FFF" />
                  <Text style={styles.songCountText}>{item.songs.length}</Text>
                </View>
              )}
            </View>
            <View style={styles.playlistInfoContainer}>
              <Text style={[styles.playlistName, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.playlistMeta}>
                <Ionicons name="cloud-offline" size={12} color={colors.textTertiary} />
                <Text style={[styles.playlistDescription, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.songs.length} songs • Offline
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Render song item
  const renderSongItem = ({ item, index }: { item: Song; index: number }) => {
    const isLoaded = displayedSongs.some(s => s.id === item.id);

    if (!isLoaded) return null;

    return (
      <View>
        <SongItem
          song={item}
          onPress={() => handleSongPress(item, index)}
          isPlaying={currentSong?.id === item.id}
        />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Animated Header */}
      <Animated.View 
        style={[
          styles.header, 
          { 
            paddingTop: insets.top + Spacing.sm,
            opacity: headerAnim,
            transform: [{
              translateY: headerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              })
            }]
          }
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Offline</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {totalOfflineSongs} songs available
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, { backgroundColor: isLoading ? '#FF9500' : '#34C759' }]}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Ionicons 
                name={isLoading ? "cloud-download" : "cloud-done"} 
                size={14} 
                color="#FFF" 
              />
            </Animated.View>
            <Text style={styles.statusBadgeText}>
              {isLoading ? 'Syncing' : 'Ready'}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Loading State with Animation */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={[styles.loadingCircle, { borderColor: colors.primary }]}>
              <Ionicons name="cloud-download-outline" size={48} color={colors.primary} />
            </View>
          </Animated.View>
          <Text style={[styles.loadingTitle, { color: colors.text }]}>
            Syncing Library
          </Text>
          <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>
            Loading your offline songs...
          </Text>
        </View>
      ) : (
        <>
          {/* Playlist Grid */}
          <FlatList
            data={offlinePlaylists}
            keyExtractor={(item) => item.id}
            renderItem={renderPlaylistItem}
            numColumns={2}
            columnWrapperStyle={styles.playlistRow}
            contentContainerStyle={styles.playlistGrid}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <LinearGradient
                  colors={isDark ? ['#1a1a2e', '#16213e'] : ['#f5f5f5', '#e8e8e8']}
                  style={styles.emptyGradient}
                >
                  <View style={styles.emptyIconContainer}>
                    <Ionicons name="cloud-offline-outline" size={80} color={colors.primary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    No Offline Songs
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    Download playlists from Google Drive{'\n'}to listen offline
                  </Text>
                  <TouchableOpacity 
                    style={[styles.downloadButton, { backgroundColor: colors.primary }]}
                    onPress={() => navigation.navigate('Settings' as never)}
                  >
                    <Ionicons name="download-outline" size={20} color="#FFF" />
                    <Text style={styles.downloadButtonText}>Go to Downloads</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          />
        </>
      )}

      {/* Expanded Playlist Sheet */}
      {selectedPlaylist && (
        <Animated.View 
          style={[
            styles.expandedSheet,
            {
              opacity: expandOpacity,
              transform: [{ translateY: expandTranslateY }],
            }
          ]}
        >
          <LinearGradient
            colors={isDark 
              ? ['rgba(30,30,30,0.98)', 'rgba(20,20,20,0.98)'] 
              : ['rgba(255,255,255,0.98)', 'rgba(245,245,245,0.98)']
            }
            style={styles.expandedGradient}
          >
            {/* Drag Handle */}
            <View style={styles.dragHandleContainer}>
              <View style={[styles.dragHandle, { backgroundColor: colors.textTertiary }]} />
            </View>

            {/* Expanded Header */}
            <View style={styles.expandedHeader}>
              <View style={styles.expandedInfo}>
                <Image 
                  source={{ uri: selectedPlaylist.artwork || DEFAULT_PLAYLIST_IMAGE }} 
                  style={styles.expandedArtwork} 
                />
                <View style={styles.expandedTextContainer}>
                  <Text style={[styles.expandedTitle, { color: colors.text }]} numberOfLines={1}>
                    {selectedPlaylist.name}
                  </Text>
                  <Text style={[styles.expandedSubtitle, { color: colors.textSecondary }]}>
                    {selectedPlaylist.songs.length} songs • Offline
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeExpanded} style={styles.closeButton}>
                <Ionicons name="chevron-down" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Animated Progress Bar */}
            {songsLoading && (
              <View style={styles.progressSection}>
                <View style={[styles.progressBackground, { backgroundColor: colors.surfaceSecondary }]}>
                  <Animated.View 
                    style={[
                      styles.progressBarAnimated, 
                      { 
                        width: progressWidth, 
                        backgroundColor: colors.primary 
                      }
                    ]} 
                  />
                </View>
                <View style={styles.progressInfo}>
                  <View style={styles.progressDots}>
                    {[...Array(3)].map((_, i) => (
                      <Animated.View 
                        key={i}
                        style={[
                          styles.progressDot,
                          { backgroundColor: i < (loadProgress > 0 ? 1 : 0) ? colors.primary : colors.textTertiary }
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                    {loadProgress} / {totalSongs} synced
                  </Text>
                </View>
              </View>
            )}

            {/* Play All Button */}
            <View style={styles.playAllContainer}>
              <TouchableOpacity 
                style={[styles.playAllButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (selectedPlaylist.songs.length > 0) {
                    loadPlaylist(selectedPlaylist.songs, 0);
                    navigation.navigate('Player');
                  }
                }}
              >
                <Ionicons name="play" size={24} color="#FFF" />
                <Text style={styles.playAllButtonText}>Play All</Text>
              </TouchableOpacity>
            </View>

            {/* Songs List */}
            <FlatList
              data={selectedPlaylist.songs}
              keyExtractor={(item) => item.id}
              renderItem={renderSongItem}
              contentContainerStyle={styles.songsListContainer}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
            />
          </LinearGradient>
        </Animated.View>
      )}

      {/* Mini Player */}
      {currentSong && (
        <View style={[styles.miniPlayerContainer, { bottom: 60 + insets.bottom }]}>
          <MiniPlayer onPress={() => navigation.navigate('Player')} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: FontSize.md,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusBadgeText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  loadingTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  loadingSubtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  playlistRow: {
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  playlistGrid: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: 150,
  },
  playlistCardWrapper: {
    width: '48%',
    marginBottom: Spacing.md,
  },
  playlistCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  playlistArtworkContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  playlistArtwork: {
    width: '100%',
    height: '100%',
  },
  playlistArtworkPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistArtworkGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  artworkOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  artworkEmoji: {
    fontSize: 28,
  },
  playlistInfoContainer: {
    paddingTop: Spacing.sm,
  },
  playlistMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songCountBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  songCountText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  playlistName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  playlistDescription: {
    fontSize: FontSize.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyGradient: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 55, 95, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 25,
    gap: 8,
  },
  downloadButtonText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  expandedSheet: {
    ...StyleSheet.absoluteFillObject,
    top: 100,
    zIndex: 100,
  },
  expandedGradient: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  expandedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expandedArtworkContainer: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  expandedArtwork: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
  },
  expandedArtworkGradient: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedTextContainer: {
    flex: 1,
  },
  expandedTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  expandedSubtitle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  progressSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  progressBackground: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarAnimated: {
    height: '100%',
    borderRadius: 2,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 4,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    fontSize: FontSize.sm,
  },
  playAllContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: 25,
    gap: 8,
  },
  playAllButtonText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  songsListContainer: {
    paddingBottom: 150,
    paddingHorizontal: Spacing.md,
  },
  miniPlayerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
