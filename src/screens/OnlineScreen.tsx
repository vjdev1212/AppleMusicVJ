import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme, useAudioPlayer } from '../hooks';
import { Spacing, FontSize, BorderRadius } from '../constants/theme';
import { youtubeService, YouTubeSearchResult } from '../services/youtubeService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const OnlineScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { loadPlaylist } = useAudioPlayer();

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Lazy loading progress for audio URL fetching
  const [loadProgress, setLoadProgress] = useState(0);
  const [totalToLoad, setTotalToLoad] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setLoadProgress(0);
    setTotalToLoad(0);
    Keyboard.dismiss();
    
    try {
      const searchResults = await youtubeService.searchVideos(searchQuery);
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Play selected song with lazy loading for queue
  const playSong = async (selectedItem: YouTubeSearchResult) => {
    const startIndex = results.findIndex(r => r.id === selectedItem.id);
    
    // Show loading state
    setIsLoadingAudio(true);
    setLoadProgress(0);
    setTotalToLoad(results.length);
    
    try {
      // Get audio URL for selected song first
      const audioUrl = await youtubeService.getAudioUrl(selectedItem.id);
      setLoadProgress(1);
      
      if (audioUrl) {
        // Create queue with only the selected song URL initially
        const queue: any[] = results.map((item, index) => ({
          id: item.id,
          title: item.title,
          artist: item.channelTitle,
          url: item.id === selectedItem.id ? audioUrl : '',
          artwork: item.thumbnail,
          source: 'youtube',
          duration: 0,
        }));

        // Load playlist and start playing
        await loadPlaylist(queue, startIndex);
        
        // Preload remaining songs in background
        for (let i = 0; i < results.length; i++) {
          if (i !== startIndex && !queue[i].url) {
            try {
              const url = await youtubeService.getAudioUrl(results[i].id);
              if (url) {
                queue[i].url = url;
              }
            } catch (e) {
              // Ignore errors for preloading
            }
            setLoadProgress(i + 1);
          }
        }
      }
    } catch (error) {
      console.error('Playback error:', error);
    } finally {
      setIsLoadingAudio(false);
      setLoadProgress(0);
    }
  };

  const renderItem = ({ item }: { item: YouTubeSearchResult }) => (
    <TouchableOpacity 
      style={styles.songItem}
      onPress={() => playSong(item)}
      activeOpacity={0.7}
    >
      <View style={styles.thumbnailContainer}>
        <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
        <View style={styles.playOverlay}>
          <Ionicons name="play" size={20} color="#FFF" />
        </View>
      </View>
      
      <View style={styles.songDetails}>
        <Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.songMeta, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.channelTitle} • {item.duration}
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.moreButton}
        onPress={() => {/* Optional: Add to playlist */}}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Search Box */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>YouTube</Text>
        
        <View style={styles.searchContainer}>
          <BlurView 
            intensity={isDark ? 40 : 60} 
            tint={isDark ? 'dark' : 'light'} 
            style={styles.searchBar}
          >
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search YouTube Music..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {loading && <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />}
          </BlurView>
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="musical-notes" size={64} color={colors.primary + '40'} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {searchQuery ? 'No results found' : 'Explore Music'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Search for your favorite songs, artists or albums from YouTube
              </Text>
              
              {!searchQuery && (
                <View style={styles.suggestedContainer}>
                  {['Tamil melody songs', 'Anirudh latest', 'AR Rahman hits'].map((suggestion) => (
                    <TouchableOpacity 
                      key={suggestion}
                      style={[styles.suggestionChip, { backgroundColor: isDark ? colors.surface : colors.surfaceSecondary }]}
                      onPress={() => {
                        setSearchQuery(suggestion);
                        setTimeout(handleSearch, 100);
                      }}
                    >
                      <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
  },
  searchContainer: {
    height: 52,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    height: '100%',
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    height: '100%',
    fontWeight: '500',
  },
  loader: {
    marginLeft: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  thumbnailContainer: {
    position: 'relative',
    width: 120,
    height: 68,
    borderRadius: BorderRadius.md,
    backgroundColor: '#1c1c1e',
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  songDetails: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: 'center',
  },
  songTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
  },
  songMeta: {
    fontSize: FontSize.sm,
    letterSpacing: 0.2,
  },
  moreButton: {
    padding: Spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 55, 95, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxl,
    lineHeight: 20,
  },
  suggestedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    margin: 4,
  },
  suggestionText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
});
