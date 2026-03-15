import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  Home: undefined;
  Player: undefined;
  Playlist: { playlist: Playlist };
  Settings: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  
  const { loadPlaylist, currentSong, isPlaying } = useAudioPlayer();
  
  const { playlists, recentlyPlayed, setPlaylists, favorites } = usePlaylistStore();
  const { streamingUrls } = useSettingsStore();
  const { isConnected: isGoogleDriveConnected, setConnected, lastScan, setLastScan } = useGoogleDriveStore();
  
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

  // Google Drive playlists
  const googleDrivePlaylists = playlists.filter(p => p.source === 'google-drive');
  
  // All playlists for display
  const allPlaylists = [
    ...googleDrivePlaylists,
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
      setPlaylists(playlists.filter(p => p.source !== 'google-drive'));
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
        renderItem={({ item }) => (
          <PlaylistCard
            playlist={item}
            onPress={() => handlePlaylistPress(item)}
          />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.playlistList}
      />
    );
  };

  const renderRecentlyPlayed = () => {
    if (recentlyPlayed.length === 0) return null;

    return (
      <>
        <SectionHeader title="Recently Played" />
        <View style={styles.recentlyPlayed}>
          {recentlyPlayed.slice(0, 5).map((song, index) => (
            <SongItem
              key={song.id}
              song={song}
              onPress={() => handleRecentlyPlayedPress(song, index)}
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
        <TouchableOpacity onPress={handleSettingsPress} style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </TouchableOpacity>
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
        {/* Apple Music-style header gradient */}
        <LinearGradient
          colors={isDark ? PlayerColors.dark.gradient as [string, string, string] : PlayerColors.light.gradient as [string, string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <Text style={styles.greeting}>Good {getGreeting()}</Text>
          <Text style={styles.headerSubtitle}>
            {lastScan ? `Last synced ${lastScan.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Your Music'}
          </Text>
        </LinearGradient>

        {/* Playlists Section */}
        <SectionHeader
          title={isGoogleDriveConnected ? 'Playlists' : 'Your Playlists'}
        />
        {renderPlaylistSection()}

        {/* Recently Played */}
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

      {/* Mini Player */}
      {currentSong && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <MiniPlayer onPress={handleMiniPlayerPress} />
        </View>
      )}
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: 'bold',
  },
  settingsButton: {
    padding: Spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerGradient: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  greeting: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: FontSize.lg,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  playlistList: {
    paddingHorizontal: Spacing.md,
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
});
