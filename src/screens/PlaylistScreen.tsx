import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme, useAudioPlayer } from '../hooks';
import { SongItem, MiniPlayer } from '../components';
import { Spacing, BorderRadius, FontSize } from '../constants/theme';
import { Playlist, Song } from '../types';
import { usePlayerStore } from '../store';
import { googleDriveService } from '../services/googleDriveService';

type RootStackParamList = {
  Root: undefined;
  Player: undefined;
  Playlist: { playlist: Playlist };
  Settings: undefined;
};

type PlaylistScreenRouteProp = RouteProp<RootStackParamList, 'Playlist'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Playlist'>;

export const PlaylistScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PlaylistScreenRouteProp>();

  const { playlist } = route.params;
  const { loadPlaylist, currentSong } = useAudioPlayer();
  const { currentSong: playingSong } = usePlayerStore();

  // Tracks which song index is currently being loaded to show inline spinner
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  const handlePlayAll = useCallback(() => {
    if (playlist.songs.length > 0) {
      loadPlaylist(playlist.songs, 0);
      navigation.navigate('Player');
    }
  }, [playlist.songs]);

  const handleShufflePlay = useCallback(() => {
    if (playlist.songs.length > 0) {
      const idx = Math.floor(Math.random() * playlist.songs.length);
      loadPlaylist(playlist.songs, idx);
      navigation.navigate('Player');
    }
  }, [playlist.songs]);

  const handleSongPress = useCallback(
    (song: Song, index: number) => {
      // If same song already playing — just go to player
      if (playingSong?.id === song.id) {
        navigation.navigate('Player');
        return;
      }

      // Show loading indicator on this row immediately
      setLoadingIndex(index);

      // Small defer so the loading state renders before loadPlaylist blocks
      requestAnimationFrame(() => {
        loadPlaylist(playlist.songs, index);
        // Navigate after one more frame so the player store is updated
        requestAnimationFrame(() => {
          setLoadingIndex(null);
          navigation.navigate('Player');
        });
      });
    },
    [playlist.songs, playingSong?.id]
  );

  const handleDownloadPlaylist = useCallback(() => {
    Alert.alert(
      'Download Playlist',
      `Download all ${playlist.songs.length} songs for offline playback?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            try {
              await googleDriveService.downloadPlaylistSongs(playlist);
              Alert.alert('Done', 'All songs downloaded.');
            } catch {
              Alert.alert('Error', 'Could not download playlist songs.');
            }
          },
        },
      ]
    );
  }, [playlist]);

  const renderHeader = () => (
    <View>
      {/* Gradient background */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(255,55,95,0.4)', 'rgba(0,0,0,1)']
            : ['rgba(255,45,85,0.3)', 'rgba(255,255,255,1)']
        }
        style={styles.headerGradient}
      />

      {/* Artwork + info */}
      <View style={styles.playlistInfo}>
        <View style={[styles.artworkContainer, { backgroundColor: colors.surfaceSecondary }]}>
          <Image
            source={
              playlist.artwork
                ? { uri: playlist.artwork }
                : require('../../assets/icon.png')
            }
            defaultSource={require('../../assets/icon.png')}
            style={styles.artwork}
            resizeMode="cover"
          />
        </View>

        <Text style={[styles.playlistName, { color: colors.text }]}>{playlist.name}</Text>

        {playlist.description && (
          <Text style={[styles.playlistDescription, { color: colors.textSecondary }]}>
            {playlist.description}
          </Text>
        )}

        <Text style={[styles.songCount, { color: colors.textSecondary }]}>
          {playlist.songs.length} songs
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handlePlayAll}
          style={[styles.playButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name="play" size={20} color="#fff" />
          <Text style={styles.playButtonText}>Play</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleShufflePlay}
          style={[styles.shuffleButton, { borderColor: colors.border }]}
          activeOpacity={0.8}
        >
          <Ionicons name="shuffle" size={20} color={colors.primary} />
          <Text style={[styles.shuffleButtonText, { color: colors.primary }]}>Shuffle</Text>
        </TouchableOpacity>
      </View>

      {/* Songs section title */}
      <View style={styles.songsHeader}>
        <Text style={[styles.songsHeaderText, { color: colors.text }]}>Songs</Text>
      </View>
    </View>
  );

  const renderSong = ({ item, index }: { item: Song; index: number }) => {
    const isLoading = loadingIndex === index;
    const isCurrentlyPlaying = playingSong?.id === item.id;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleSongPress(item, index)}
        disabled={loadingIndex !== null} // block double-taps while loading
      >
        <View style={isLoading ? styles.songRowLoading : undefined}>
          <SongItem
            song={item}
            onPress={() => handleSongPress(item, index)}
            isPlaying={isCurrentlyPlaying}
            showIndex
            index={index}
          />
          {/* Inline loading spinner overlaid on the row */}
          {isLoading && (
            <View style={styles.songLoadingOverlay}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Navigation header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity
          onPress={() =>
            navigation.canGoBack()
              ? navigation.goBack()
              : navigation.navigate('Root')
          }
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {playlist.name}
        </Text>

        <TouchableOpacity style={styles.moreButton} onPress={handleDownloadPlaylist}>
          <Ionicons name="download-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={playlist.songs}
        keyExtractor={item => item.id}
        renderItem={renderSong}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: playingSong ? 100 : Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header nav
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  backButton: { padding: Spacing.xs },
  headerTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: '600', textAlign: 'center', marginHorizontal: Spacing.md },
  moreButton: { padding: Spacing.xs },

  // Gradient
  headerGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },

  // Playlist info
  playlistInfo: { alignItems: 'center', paddingTop: Spacing.xxl, paddingHorizontal: Spacing.lg },
  artworkContainer: { width: 180, height: 180, borderRadius: BorderRadius.md, overflow: 'hidden', marginBottom: Spacing.lg },
  artwork: { width: 180, height: 180, borderRadius: BorderRadius.md },
  playlistName: { fontSize: FontSize.xxl, fontWeight: 'bold', textAlign: 'center', marginBottom: Spacing.xs },
  playlistDescription: { fontSize: FontSize.md, textAlign: 'center', marginBottom: Spacing.xs },
  songCount: { fontSize: FontSize.sm },

  // Actions
  actions: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg, gap: Spacing.md,
  },
  playButton: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.round, gap: Spacing.sm,
  },
  playButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
  shuffleButton: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.round, borderWidth: 1, gap: Spacing.sm,
  },
  shuffleButtonText: { fontSize: FontSize.md, fontWeight: '600' },

  // Songs header
  songsHeader: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  songsHeaderText: { fontSize: FontSize.lg, fontWeight: '600' },

  // Song row
  listContent: { paddingBottom: 100 },
  songRowLoading: { opacity: 0.5 },
  songLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: Spacing.lg,
  },
});