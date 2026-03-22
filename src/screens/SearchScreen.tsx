import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  Animated,
  Easing,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme, useAudioPlayer } from '../hooks';
import { usePlaylistStore } from '../store/store_index';
import { SongItem } from '../components';
import { Spacing, BorderRadius, FontSize } from '../constants/theme';
import { Playlist, Song } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type RootStackParamList = {
  Root: undefined;
  Search: undefined;
  Player: undefined;
  Playlist: { playlist: Playlist };
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Theme Combos (same as HomeScreen) ───────────────────────────────────────
const THEME_COMBOS: Array<{ colors: [string, string]; icon: string }> = [
  { colors: ['#FF6B6B', '#C0392B'], icon: 'musical-notes' },
  { colors: ['#4ECDC4', '#1ABC9C'], icon: 'headset' },
  { colors: ['#A29BFE', '#6C5CE7'], icon: 'disc' },
  { colors: ['#FD79A8', '#E84393'], icon: 'heart' },
  { colors: ['#45B7D1', '#2980B9'], icon: 'radio' },
  { colors: ['#FFEAA7', '#F39C12'], icon: 'star' },
  { colors: ['#55EFC4', '#00B894'], icon: 'volume-high' },
  { colors: ['#FAB1A0', '#E17055'], icon: 'mic' },
  { colors: ['#74B9FF', '#0984E3'], icon: 'planet' },
  { colors: ['#DDA0DD', '#9B59B6'], icon: 'sparkles' },
  { colors: ['#F8B500', '#E67E22'], icon: 'musical-note' },
  { colors: ['#00CED1', '#0097A7'], icon: 'infinite' },
];

const getThemeCombo = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return THEME_COMBOS[Math.abs(hash) % THEME_COMBOS.length];
};

// ─── Floating Particle ────────────────────────────────────────────────────────
const FloatingParticle: React.FC<{ color: string; delay: number }> = ({ color, delay }) => {
  const posY = useRef(new Animated.Value(SCREEN_HEIGHT * 0.8)).current;
  const posX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4 + Math.random() * 0.6)).current;

  useEffect(() => {
    const startX = Math.random() * SCREEN_WIDTH;
    const animate = () => {
      posX.setValue(startX);
      posY.setValue(SCREEN_HEIGHT * 0.85);
      Animated.parallel([
        Animated.timing(posY, { toValue: -60, duration: 5000 + Math.random() * 3000, easing: Easing.linear, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.28, duration: 500, useNativeDriver: true }),
          Animated.delay(3000),
          Animated.timing(opacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ]),
      ]).start(animate);
    };
    const t = setTimeout(animate, delay);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', width: 5, height: 5, borderRadius: 2.5,
        backgroundColor: color, top: 0, left: 0,
        opacity, transform: [{ translateY: posY }, { translateX: posX }, { scale }],
      }}
    />
  );
};

// ─── Animated Playlist Result Card ────────────────────────────────────────────
const PlaylistResultCard: React.FC<{
  item: Playlist;
  index: number;
  colors: any;
  onPress: () => void;
}> = ({ item, index, colors, onPress }) => {
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const [imgError, setImgError] = useState(false);
  const combo = getThemeCombo(item.name);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, delay: index * 80, tension: 55, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.timing(shimmerAnim, { toValue: 2, duration: 2000 + index * 200, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  const onPressIn = () => Animated.spring(pressAnim, { toValue: 0.94, useNativeDriver: true, tension: 200 }).start();
  const onPressOut = () => Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, tension: 200 }).start();

  const shimmerX = shimmerAnim.interpolate({ inputRange: [-1, 2], outputRange: [-160, 160] });
  const hasArtwork = !!item.artwork && !imgError;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }, { scale: pressAnim }], marginBottom: Spacing.sm }}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View style={[styles.playlistRow, { backgroundColor: colors.surface }]}>
          {/* Thumbnail */}
          <View style={styles.playlistThumb}>
            {hasArtwork ? (
              <>
                <Image source={{ uri: item.artwork }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" onError={() => setImgError(true)} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)']} style={StyleSheet.absoluteFillObject} />
              </>
            ) : (
              <LinearGradient colors={combo.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject}>
                <View style={styles.thumbCircle} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)']} style={StyleSheet.absoluteFillObject} />
              </LinearGradient>
            )}

            {/* Shimmer */}
            <Animated.View pointerEvents="none" style={[styles.shimmer, { transform: [{ translateX: shimmerX }, { rotate: '-18deg' }] }]} />

            {/* Icon */}
            <View style={styles.thumbIconWrap}>
              <Ionicons name={combo.icon as any} size={hasArtwork ? 16 : 26} color="rgba(255,255,255,0.85)" />
            </View>
          </View>

          {/* Info */}
          <View style={styles.playlistRowInfo}>
            <Text style={[styles.playlistRowName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <View style={styles.playlistRowMeta}>
              <View style={[styles.onlineDot, { backgroundColor: '#34C759' }]} />
              <Text style={[styles.playlistRowCount, { color: colors.textSecondary }]}>
                {item.songs.length} songs · Online
              </Text>
            </View>
          </View>

          {/* Arrow */}
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Animated Song Row ────────────────────────────────────────────────────────
const AnimatedSongRow: React.FC<{ children: React.ReactNode; index: number }> = ({ children, index }) => {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, delay: index * 55, tension: 65, friction: 10, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 55, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
      {children}
    </Animated.View>
  );
};

// ─── Category Card ────────────────────────────────────────────────────────────
const CategoryCard: React.FC<{
  label: string;
  index: number;
  colors: any;
  onPress: () => void;
}> = ({ label, index, colors, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const combo = getThemeCombo(label);

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, delay: index * 70, tension: 60, friction: 8, useNativeDriver: true }).start();
  }, []);

  const onPressIn = () => Animated.spring(pressAnim, { toValue: 0.92, useNativeDriver: true, tension: 200 }).start();
  const onPressOut = () => Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, tension: 200 }).start();

  return (
    <Animated.View style={[styles.categoryWrapper, { opacity: scaleAnim, transform: [{ scale: Animated.multiply(scaleAnim, pressAnim) }, { translateY: scaleAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <LinearGradient colors={combo.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.categoryCard}>
          <View style={styles.categoryCircle} />
          <Ionicons name={combo.icon as any} size={28} color="rgba(255,255,255,0.35)" style={styles.categoryBgIcon} />
          <Text style={styles.categoryText}>{label}</Text>
          <Ionicons name={combo.icon as any} size={18} color="rgba(255,255,255,0.9)" />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const SearchScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { playlists } = usePlaylistStore();
  const { currentSong, loadPlaylist } = useAudioPlayer();

  const [searchQuery, setSearchQuery] = useState('');
  const headerFadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-20)).current;
  const searchBarAnim = useRef(new Animated.Value(0)).current;
  const searchFocusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerSlideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
      Animated.timing(searchBarAnim, { toValue: 1, duration: 500, delay: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  const onSearchFocus = () =>
    Animated.spring(searchFocusAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: false }).start();
  const onSearchBlur = () =>
    Animated.spring(searchFocusAnim, { toValue: 0, tension: 100, friction: 8, useNativeDriver: false }).start();

  const searchBorderColor = searchFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(128,128,128,0.15)', colors.primary],
  });

  // ── Only online (Google Drive) playlists ──────────────────────────────────
  const onlinePlaylists = useMemo(
    () => playlists.filter(p => p.source === 'google-drive'),
    [playlists]
  );

  const filteredPlaylists = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return onlinePlaylists.filter(
      p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
    );
  }, [onlinePlaylists, searchQuery]);

  // All unique songs from online playlists only
  const allOnlineSongs = useMemo(() => {
    const songs: Song[] = [];
    onlinePlaylists.forEach(p => {
      p.songs.forEach(s => {
        if (!songs.find(item => item.id === s.id)) songs.push(s);
      });
    });
    return songs;
  }, [onlinePlaylists]);

  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allOnlineSongs.filter(
      s => s.title.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q)
    );
  }, [allOnlineSongs, searchQuery]);

  const hasResults = filteredPlaylists.length > 0 || filteredSongs.length > 0;

  const handlePlaylistPress = (playlist: Playlist) =>
    navigation.navigate('Playlist', { playlist });

  const handleSongPress = (song: Song) => {
    const playlist = onlinePlaylists.find(p => p.songs.some(s => s.id === song.id));
    if (playlist) {
      const idx = playlist.songs.findIndex(s => s.id === song.id);
      loadPlaylist(playlist.songs, idx);
    } else {
      loadPlaylist([song], 0);
    }
    navigation.navigate('Player');
  };

  const handleSongMorePress = (song: Song) => {
    const { addSongToPlaylist } = usePlaylistStore.getState();
    const offlinePlaylists = playlists.filter(p => p.isOffline);
    if (offlinePlaylists.length === 0) {
      Alert.alert('No Playlists', "You don't have any offline playlists to add to.");
      return;
    }
    Alert.alert('Add to Playlist', 'Select a playlist:', [
      ...offlinePlaylists.map((pl: Playlist) => ({
        text: pl.name,
        onPress: () => {
          addSongToPlaylist(pl.id, song);
          Alert.alert('Added', `${song.title} → ${pl.name}`);
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const CATEGORIES = ['Tamil', 'Hindi', 'English', 'Melody', 'Beats', 'Romantic'];

  // ── Render ────────────────────────────────────────────────────────────────
  const renderBody = () => {
    // No query → Browse categories
    if (!searchQuery.trim()) {
      return (
        <View style={styles.browseWrap}>
          <Animated.Text
            style={[
              styles.browseTitle,
              {
                color: colors.text, opacity: headerFadeAnim,
                transform: [{ translateY: headerSlideAnim }]
              },
            ]}
          >
            Browse
          </Animated.Text>
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((cat, i) => (
              <CategoryCard
                key={cat}
                label={cat}
                index={i}
                colors={colors}
                onPress={() => setSearchQuery(cat)}
              />
            ))}
          </View>
        </View>
      );
    }

    // Has query but no results
    if (!hasResults) {
      return (
        <Animated.View style={[styles.emptyState, { opacity: headerFadeAnim }]}>
          <LinearGradient
            colors={isDark ? ['#1c1c20', '#111113'] : ['#f2f2f7', '#e5e5ea']}
            style={styles.emptyCard}
          >
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="search-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              No results for "{searchQuery}"
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Try searching a different song or playlist name
            </Text>
          </LinearGradient>
        </Animated.View>
      );
    }

    // Results
    return (
      <View>
        {/* Playlists */}
        {filteredPlaylists.length > 0 && (
          <View style={styles.section}>
            <Animated.Text style={[styles.sectionTitle, { color: colors.text, opacity: headerFadeAnim }]}>
              Playlists
            </Animated.Text>
            {filteredPlaylists.map((item, index) => (
              <PlaylistResultCard
                key={item.id}
                item={item}
                index={index}
                colors={colors}
                onPress={() => handlePlaylistPress(item)}
              />
            ))}
          </View>
        )}

        {/* Songs */}
        {filteredSongs.length > 0 && (
          <View style={styles.section}>
            <Animated.Text style={[styles.sectionTitle, { color: colors.text, opacity: headerFadeAnim }]}>
              Songs · {filteredSongs.length} found
            </Animated.Text>
            {filteredSongs.slice(0, 15).map((song, index) => (
              <AnimatedSongRow key={song.id} index={index}>
                <SongItem
                  song={song}
                  onPress={() => handleSongPress(song)}
                  isPlaying={currentSong?.id === song.id}
                  onMorePress={() => handleSongMorePress(song)}
                />
              </AnimatedSongRow>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>

        {/* Ambient particles */}
        {[...Array(5)].map((_, i) => (
          <FloatingParticle key={i} color={colors.primary} delay={i * 700} />
        ))}

        {/* ── Header ── */}
        <Animated.View
          style={[
            styles.header,
            { paddingTop: insets.top + Spacing.sm, opacity: headerFadeAnim, transform: [{ translateY: headerSlideAnim }] },
          ]}
        >
          <Text style={[styles.headerTitle, { color: colors.text }]}>Search</Text>

          {/* Search bar */}
          <Animated.View style={[styles.searchBarWrap, { borderColor: searchBorderColor, opacity: searchBarAnim }]}>
            <BlurView intensity={isDark ? 30 : 50} tint={isDark ? 'dark' : 'light'} style={styles.searchBlur}>
              <Ionicons name="search" size={19} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Songs, artists, playlists…"
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={onSearchFocus}
                onBlur={onSearchBlur}
                autoCorrect={false}
                clearButtonMode="always"
                returnKeyType="search"
              />
              {searchQuery.length > 0 && Platform.OS === 'android' && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </BlurView>
          </Animated.View>
        </Animated.View>

        {/* ── Body ── */}
        <FlatList
          data={[{ id: 'body' }]}
          keyExtractor={item => item.id}
          renderItem={() => renderBody()}
          contentContainerStyle={{ paddingBottom: currentSong ? 160 : 100, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </TouchableWithoutFeedback>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: Spacing.md,
  },

  // Search bar
  searchBarWrap: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  searchBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    height: '100%',
    fontWeight: '500',
  },

  // Browse
  browseWrap: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  browseTitle: { fontSize: FontSize.xxl, fontWeight: '800', letterSpacing: -0.4, marginBottom: Spacing.md },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.sm },
  categoryWrapper: { width: '48%' },
  categoryCard: {
    height: 90,
    borderRadius: BorderRadius.xl,
    justifyContent: 'flex-end',
    padding: Spacing.md,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  categoryCircle: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)', top: -30, right: -20,
  },
  categoryBgIcon: { position: 'absolute', top: 10, right: 10 },
  categoryText: { color: '#fff', fontSize: FontSize.md, fontWeight: '800', letterSpacing: -0.2 },

  // Sections
  section: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: '800', letterSpacing: -0.3, marginBottom: Spacing.sm },

  // Playlist row card
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    padding: Spacing.sm,
    gap: Spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  playlistThumb: {
    width: 58,
    height: 58,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  },
  thumbCircle: {
    position: 'absolute', width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.1)', top: -15, right: -15,
  },
  thumbIconWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  shimmer: {
    position: 'absolute', top: 0, bottom: 0, width: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  playlistRowInfo: { flex: 1 },
  playlistRowName: { fontSize: FontSize.md, fontWeight: '700', marginBottom: 4 },
  playlistRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  playlistRowCount: { fontSize: FontSize.sm },

  // Empty
  emptyState: { paddingHorizontal: Spacing.md, paddingTop: 40 },
  emptyCard: {
    alignItems: 'center', padding: Spacing.xl, borderRadius: BorderRadius.xl,
    gap: 12, borderWidth: 1, borderColor: 'rgba(128,128,128,0.1)',
  },
  emptyIconCircle: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  emptyText: { fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center' },
  emptySubtext: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22, opacity: 0.8 },
});