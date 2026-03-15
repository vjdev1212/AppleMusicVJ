import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
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

type RootStackParamList = {
  Home: undefined;
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

  const handlePlayAll = () => {
    if (playlist.songs.length > 0) {
      loadPlaylist(playlist.songs, 0);
      navigation.navigate('Player');
    }
  };

  const handleShufflePlay = () => {
    if (playlist.songs.length > 0) {
      const randomIndex = Math.floor(Math.random() * playlist.songs.length);
      loadPlaylist(playlist.songs, randomIndex);
      navigation.navigate('Player');
    }
  };

  const handleSongPress = (song: Song, index: number) => {
    loadPlaylist(playlist.songs, index);
    navigation.navigate('Player');
  };

  const renderHeader = () => (
    <View>
      {/* Header Gradient Background */}
      <LinearGradient
        colors={isDark 
          ? ['rgba(255, 55, 95, 0.4)', 'rgba(0, 0, 0, 1)']
          : ['rgba(255, 45, 85, 0.3)', 'rgba(255, 255, 255, 1)']
        }
        style={styles.headerGradient}
      />

      {/* Playlist Info */}
      <View style={styles.playlistInfo}>
        <View
          style={[
            styles.artworkContainer,
            { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          {playlist.artwork ? (
            <Image
              source={{ uri: playlist.artwork }}
              style={styles.artwork}
              resizeMode="cover"
            />
          ) : (
            <Image
              source={{ uri: 'https://raw.githubusercontent.com/viki28593/assets/main/premium_music_note.png' }}
              style={styles.artwork}
              resizeMode="cover"
            />
          )}
        </View>
        
        <Text style={[styles.playlistName, { color: colors.text }]}>
          {playlist.name}
        </Text>
        
        {playlist.description && (
          <Text style={[styles.playlistDescription, { color: colors.textSecondary }]}>
            {playlist.description}
          </Text>
        )}
        
        <Text style={[styles.songCount, { color: colors.textSecondary }]}>
          {playlist.songs.length} songs
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handlePlayAll}
          style={[styles.playButton, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="play" size={20} color="#FFFFFF" />
          <Text style={styles.playButtonText}>Play</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={handleShufflePlay}
          style={[styles.shuffleButton, { borderColor: colors.border }]}
        >
          <Ionicons name="shuffle" size={20} color={colors.primary} />
          <Text style={[styles.shuffleButtonText, { color: colors.primary }]}>
            Shuffle
          </Text>
        </TouchableOpacity>
      </View>

      {/* Songs Header */}
      <View style={styles.songsHeader}>
        <Text style={[styles.songsHeaderText, { color: colors.text }]}>
          Songs
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Navigation */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home' as never)} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {playlist.name}
        </Text>
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={playlist.songs}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <SongItem
            song={item}
            onPress={() => handleSongPress(item, index)}
            isPlaying={playingSong?.id === item.id}
            showIndex
            index={index}
          />
        )}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: playingSong ? 100 : Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      />
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
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: Spacing.md,
  },
  moreButton: {
    padding: Spacing.xs,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  playlistInfo: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  artworkContainer: {
    width: 180,
    height: 180,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  artwork: {
    width: 180,
    height: 180,
    borderRadius: BorderRadius.md,
  },
  playlistName: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  playlistDescription: {
    fontSize: FontSize.md,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  songCount: {
    fontSize: FontSize.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.round,
    gap: Spacing.sm,
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  shuffleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  shuffleButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  songsHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  songsHeaderText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 100,
  },
});
