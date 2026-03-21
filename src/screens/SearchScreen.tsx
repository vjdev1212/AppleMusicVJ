import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Text,
  FlatList,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme, useAudioPlayer } from '../hooks';
import { usePlaylistStore } from '../store';
import { PlaylistCard, SectionHeader, SongItem } from '../components';
import { Spacing, BorderRadius, FontSize } from '../constants/theme';
import { Playlist, Song } from '../types';

type RootStackParamList = {
  Root: undefined;
  Search: undefined;
  Online: undefined;
  Player: undefined;
  Playlist: { playlist: Playlist };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const SearchScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { playlists } = usePlaylistStore();
  const { currentSong, loadPlaylist } = useAudioPlayer();
  
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPlaylists = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return playlists.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.description?.toLowerCase().includes(query)
    );
  }, [playlists, searchQuery]);

  const allSongs = useMemo(() => {
    const songs: Song[] = [];
    playlists.forEach(p => {
      p.songs.forEach(s => {
        if (!songs.find(item => item.id === s.id)) {
          songs.push(s);
        }
      });
    });
    return songs;
  }, [playlists]);

  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return allSongs.filter(s => 
      s.title.toLowerCase().includes(query) || 
      s.artist?.toLowerCase().includes(query)
    );
  }, [allSongs, searchQuery]);

  const handlePlaylistPress = (playlist: Playlist) => {
    navigation.navigate('Playlist', { playlist });
  };

  const handleSongPress = (song: Song) => {
    // Find the playlist this song belongs to or create a temporary one
    const playlist = playlists.find(p => p.songs.some(s => s.id === song.id));
    if (playlist) {
      const songIndex = playlist.songs.findIndex(s => s.id === song.id);
      loadPlaylist(playlist.songs, songIndex);
    } else {
      loadPlaylist([song], 0);
    }
    navigation.navigate('Player');
  };

  const handleSongMorePress = (song: Song) => {
    const offlinePlaylists = playlists.filter(p => p.isOffline);
    if (offlinePlaylists.length === 0) {
      Alert.alert('No Playlists', 'You don\'t have any offline playlists to add to.');
      return;
    }

    const { addSongToPlaylist } = usePlaylistStore.getState();
    
    Alert.alert(
      'Add to Playlist',
      'Select a playlist to add this song to:',
      [
        ...offlinePlaylists.map((pl: Playlist) => ({
          text: pl.name,
          onPress: () => {
            addSongToPlaylist(pl.id, song);
            Alert.alert('Success', `Added ${song.title} to ${pl.name}`);
          }
        })),
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const renderEmptyState = () => {
    if (searchQuery.trim()) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No results for "{searchQuery}"
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
            Check the spelling or try a different search term.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.browseContainer}>
        <SectionHeader title="Browse Categories" />
        <View style={styles.categoriesGrid}>
          {['Rock', 'Pop', 'Hip-Hop', 'Jazz', 'Electronic', 'Classical'].map((category) => (
            <TouchableOpacity 
              key={category}
              style={[styles.categoryCard, { backgroundColor: isDark ? colors.surface : colors.border }]}
              onPress={() => setSearchQuery(category)}
            >
              <Text style={[styles.categoryText, { color: colors.text }]}>{category}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Search</Text>
          
          <BlurView intensity={isDark ? 30 : 50} tint={isDark ? 'dark' : 'light'} style={styles.searchBarContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Playlists, Artists, Songs..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              clearButtonMode="always"
            />
          </BlurView>
        </View>

        <FlatList
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: currentSong ? 160 : 100 }
          ]}
          data={searchQuery.trim() ? [{ id: 'results' }] : []}
          ListEmptyComponent={renderEmptyState}
          keyExtractor={(item) => item.id}
          renderItem={() => (
            <View>
              {filteredPlaylists.length > 0 && (
                <>
                  <SectionHeader title="Playlists" />
                  <FlatList
                    horizontal
                    data={filteredPlaylists}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <PlaylistCard
                        playlist={item}
                        onPress={() => handlePlaylistPress(item)}
                      />
                    )}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.playlistsHorizontal}
                  />
                </>
              )}

              {filteredSongs.length > 0 && (
                <>
                  <SectionHeader title="Songs" />
                  <View style={styles.songsList}>
                    {filteredSongs.slice(0, 10).map((song) => (
                      <SongItem
                        key={song.id}
                        song={song}
                        onPress={() => handleSongPress(song)}
                        isPlaying={currentSong?.id === song.id}
                        onMorePress={() => handleSongMorePress(song)}
                      />
                    ))}
                  </View>
                </>
              )}
            </View>
          )}
        />
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  searchIcon: {
    marginRight: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    height: '100%',
  },
  listContent: {
    flexGrow: 1,
  },
  playlistsHorizontal: {
    paddingHorizontal: Spacing.md,
  },
  songsList: {
    marginTop: Spacing.xs,
  },
  browseContainer: {
    paddingTop: Spacing.md,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    height: 100,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  categoryText: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FontSize.md,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
