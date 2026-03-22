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
  ImageBackground,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';

import { useTheme, useAudioPlayer } from '../hooks';
import { usePlaylistStore } from '../store/store_index';
import { MiniPlayer, SongItem } from '../components';
import { Spacing, FontSize, BorderRadius } from '../constants/theme';
import { googleDriveService } from '../services/googleDriveService';
import { Playlist, Song } from '../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type RootStackParamList = {
  Root: undefined;
  Player: undefined;
  Playlist: { playlist: Playlist };
  Settings: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Root'>;

// ─── Animated Card Component ─────────────────────────────────────────────────
const AnimatedPlaylistCard: React.FC<{
  item: Playlist;
  index: number;
  isSelected: boolean;
  colors: any;
  onPress: () => void;
  DEFAULT_PLAYLIST_IMAGE: string;
  getPlaylistColor: (name: string) => string[];
  getFallbackImage: (name: string) => string;
}> = ({ item, index, isSelected, colors, onPress, DEFAULT_PLAYLIST_IMAGE, getPlaylistColor, getFallbackImage }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const [imageError, setImageError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: index * 80,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (isSelected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: false }),
        ])
      ).start();

      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 2,
          duration: 1800,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      glowAnim.setValue(0);
      shimmerAnim.setValue(-1);
    }
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.spring(pressAnim, { toValue: 0.93, useNativeDriver: true, tension: 200 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, tension: 200 }).start();
  };

  const gradientColors = getPlaylistColor(item.name);
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [-1, 2],
    outputRange: [-SCREEN_WIDTH * 0.5, SCREEN_WIDTH * 0.5],
  });

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          opacity: scaleAnim,
          transform: [
            { scale: Animated.multiply(scaleAnim, pressAnim) },
            {
              translateY: scaleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [40, 0],
              }),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* Glow border when selected */}
        {isSelected && (
          <Animated.View
            style={[
              styles.glowBorder,
              {
                borderColor: colors.primary,
                opacity: glowAnim,
                shadowColor: colors.primary,
              },
            ]}
          />
        )}

        <View
          style={[
            styles.playlistCard,
            {
              backgroundColor: colors.surface,
              borderColor: isSelected ? colors.primary + '60' : 'transparent',
              borderWidth: isSelected ? 1.5 : 0,
            },
          ]}
        >
          {/* Artwork */}
          <View style={styles.artworkFrame}>
            {/* Main artwork → music icon fallback → gradient placeholder */}
            {!imageError ? (
              <Image
                source={{ uri: item.artwork || DEFAULT_PLAYLIST_IMAGE }}
                style={styles.artworkImage}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            ) : !fallbackError ? (
              /* Music-themed PNG fallback */
              <LinearGradient
                colors={getPlaylistColor(item.name) as [string, string]}
                style={styles.artworkImage}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Image
                  source={{ uri: getFallbackImage(item.name) }}
                  style={styles.fallbackIcon}
                  resizeMode="contain"
                  onError={() => setFallbackError(true)}
                />
              </LinearGradient>
            ) : (
              /* Final gradient + note icon fallback */
              <LinearGradient
                colors={getPlaylistColor(item.name) as [string, string]}
                style={[styles.artworkImage, styles.gradientFallback]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.noteFallbackContainer}>
                  <Text style={styles.noteFallbackEmoji}>🎵</Text>
                  <Text style={styles.noteFallbackName} numberOfLines={2}>
                    {item.name}
                  </Text>
                </View>
              </LinearGradient>
            )}

            {/* Gradient overlay on artwork */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.65)']}
              style={StyleSheet.absoluteFillObject}
            />

            {/* Shimmer effect when selected */}
            {isSelected && (
              <Animated.View
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    transform: [
                      { translateX: shimmerTranslate },
                      { rotate: '-15deg' },
                    ],
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    width: '50%',
                  },
                ]}
              />
            )}

            {/* Play / Check badge */}
            <View
              style={[
                styles.playBadge,
                {
                  backgroundColor: isSelected ? colors.primary : 'rgba(0,0,0,0.55)',
                  borderColor: isSelected ? colors.primary : 'rgba(255,255,255,0.2)',
                },
              ]}
            >
              <Ionicons
                name={isSelected ? 'checkmark' : 'play'}
                size={16}
                color="#FFF"
                style={isSelected ? undefined : { marginLeft: 2 }}
              />
            </View>

            {/* Song count pill */}
            <View style={styles.countPill}>
              <Ionicons name="musical-note" size={9} color="rgba(255,255,255,0.85)" />
              <Text style={styles.countPillText}>{item.songs.length}</Text>
            </View>
          </View>

          {/* Text info */}
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.cardMeta}>
              <View style={[styles.offlineDot, { backgroundColor: '#34C759' }]} />
              <Text style={[styles.cardMetaText, { color: colors.textSecondary }]}>
                {item.songs.length} songs
              </Text>
            </View>
          </View>

          {/* Bottom accent line when selected */}
          {isSelected && (
            <View style={[styles.selectedAccentLine, { backgroundColor: colors.primary }]} />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Floating Particle Component ─────────────────────────────────────────────
const FloatingParticle: React.FC<{ color: string; delay: number }> = ({ color, delay }) => {
  const posY = useRef(new Animated.Value(SCREEN_HEIGHT * 0.6)).current;
  const posX = useRef(new Animated.Value(Math.random() * SCREEN_WIDTH)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5 + Math.random() * 0.5)).current;

  useEffect(() => {
    const animate = () => {
      posX.setValue(Math.random() * SCREEN_WIDTH);
      posY.setValue(SCREEN_HEIGHT * 0.8);
      Animated.parallel([
        Animated.timing(posY, {
          toValue: -50,
          duration: 4000 + Math.random() * 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.35, duration: 600, useNativeDriver: true }),
          Animated.delay(2500),
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
      ]).start(animate);
    };
    const timer = setTimeout(animate, delay);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          backgroundColor: color,
          opacity,
          transform: [{ translateY: posY }, { translateX: posX }, { scale }],
        },
      ]}
    />
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const OfflineScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();

  const { loadPlaylist, currentSong } = useAudioPlayer();
  const { setPlaylists } = usePlaylistStore();

  const [offlinePlaylists, setOfflinePlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [displayedSongs, setDisplayedSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [totalSongs, setTotalSongs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const [expandAnim] = useState(() => new Animated.Value(0));
  const [progressAnim] = useState(() => new Animated.Value(0));
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const [headerAnim] = useState(() => new Animated.Value(0));
  const [titleSlideAnim] = useState(() => new Animated.Value(-30));
  const [backdropAnim] = useState(() => new Animated.Value(0));
  const sheetScaleAnim = useRef(new Animated.Value(0.96)).current;

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        await loadOfflinePlaylists();
        Animated.parallel([
          Animated.timing(headerAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(titleSlideAnim, {
            toValue: 0,
            tension: 60,
            friction: 12,
            useNativeDriver: true,
          }),
        ]).start();
      } catch {
        setError('Failed to load offline playlists');
      }
    };
    init();
  }, []);

  // Pulse for loading
  useEffect(() => {
    if (isLoading || songsLoading) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [isLoading, songsLoading]);

  // ── Data Loading ──────────────────────────────────────────────────────────
  const loadOfflinePlaylists = useCallback(async () => {
    setIsLoading(true);
    try {
      const localPlaylists = await googleDriveService.discoverLocalPlaylistsFast();
      if (localPlaylists) {
        setOfflinePlaylists(localPlaylists);
        setPlaylists(localPlaylists);
      }
    } catch {
      setOfflinePlaylists([]);
    } finally {
      setIsLoading(false);
    }
  }, [setPlaylists]);

  const lazyLoadSongs = useCallback(
    async (playlist: Playlist) => {
      setSelectedPlaylistId(playlist.id);
      setDisplayedSongs([]);
      setSongsLoading(true);
      setLoadProgress(0);
      setTotalSongs(playlist.songs.length);

      // Sheet open animation
      Animated.parallel([
        Animated.spring(expandAnim, {
          toValue: 1,
          tension: 60,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(sheetScaleAnim, {
          toValue: 1,
          tension: 55,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();

      progressAnim.setValue(0);

      for (let i = 0; i < playlist.songs.length; i++) {
        const song = playlist.songs[i];
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setDisplayedSongs(prev => [...prev, song]);

        Animated.timing(progressAnim, {
          toValue: (i + 1) / playlist.songs.length,
          duration: 160,
          useNativeDriver: false,
        }).start();

        setLoadProgress(i + 1);
        if (i < playlist.songs.length - 1) {
          await new Promise(r => setTimeout(r, 75));
        }
      }
      setSongsLoading(false);
    },
    [expandAnim, progressAnim, backdropAnim, sheetScaleAnim]
  );

  const closeExpanded = useCallback(() => {
    Animated.parallel([
      Animated.timing(expandAnim, {
        toValue: 0,
        duration: 360,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(sheetScaleAnim, {
        toValue: 0.96,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedPlaylistId(null);
      setDisplayedSongs([]);
    });
  }, [expandAnim, backdropAnim, sheetScaleAnim]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadOfflinePlaylists();
    setIsRefreshing(false);
  }, [loadOfflinePlaylists]);

  const handlePlaylistPress = (playlist: Playlist) => {
    if (selectedPlaylistId === playlist.id) {
      closeExpanded();
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      lazyLoadSongs(playlist);
    }
  };

  const handleSongPress = (song: Song, index: number) => {
    const playlist = offlinePlaylists.find(p => p.id === selectedPlaylistId);
    if (playlist) {
      loadPlaylist(playlist.songs, index);
      navigation.navigate('Player');
    }
  };

  const selectedPlaylist = offlinePlaylists.find(p => p.id === selectedPlaylistId);
  const totalOfflineSongs = offlinePlaylists.reduce((sum, p) => sum + p.songs.length, 0);

  const DEFAULT_PLAYLIST_IMAGE =
    'https://i.pinimg.com/736x/01/d1/b4/01d1b4547ce03c3ec499c827caac4a72.jpg';

  // Music-themed fallback PNG icons (Flaticon CDN — free for UI use)
  const MUSIC_FALLBACK_IMAGES = [
    'https://cdn-icons-png.flaticon.com/512/3844/3844724.png', // vinyl record
    'https://cdn-icons-png.flaticon.com/512/3480/3480864.png', // music note
    'https://cdn-icons-png.flaticon.com/512/2829/2829986.png', // headphones
    'https://cdn-icons-png.flaticon.com/512/3373/3373169.png', // guitar
    'https://cdn-icons-png.flaticon.com/512/1686/1686847.png', // cassette tape
    'https://cdn-icons-png.flaticon.com/512/4039/4039195.png', // microphone
    'https://cdn-icons-png.flaticon.com/512/2919/2919592.png', // piano
    'https://cdn-icons-png.flaticon.com/512/3601/3601645.png', // drum
  ];

  const getFallbackImage = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return MUSIC_FALLBACK_IMAGES[Math.abs(hash) % MUSIC_FALLBACK_IMAGES.length];
  };

  // Returns a vivid two-stop gradient pair per playlist name
  const getPlaylistColor = (name: string): string[] => {
    const pairs: string[][] = [
      ['#FF6B6B', '#C0392B'],
      ['#4ECDC4', '#1ABC9C'],
      ['#45B7D1', '#2980B9'],
      ['#A29BFE', '#6C5CE7'],
      ['#FD79A8', '#D63031'],
      ['#FFEAA7', '#FDCB6E'],
      ['#55EFC4', '#00B894'],
      ['#74B9FF', '#0984E3'],
      ['#FAB1A0', '#E17055'],
      ['#DDA0DD', '#9B59B6'],
      ['#F8B500', '#E67E22'],
      ['#00CED1', '#0097A7'],
      ['#FF69B4', '#C2185B'],
      ['#32CD32', '#27AE60'],
      ['#FF6348', '#D63031'],
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return pairs[Math.abs(hash) % pairs.length];
  };

  // ── Derived animated styles ───────────────────────────────────────────────
  const expandTranslateY = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT * 0.7, 0],
  });
  const expandOpacity = expandAnim.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1] });
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ── Render ────────────────────────────────────────────────────────────────
  const renderPlaylistItem = ({ item, index }: { item: Playlist; index: number }) => (
    <AnimatedPlaylistCard
      item={item}
      index={index}
      isSelected={selectedPlaylistId === item.id}
      colors={colors}
      onPress={() => handlePlaylistPress(item)}
      DEFAULT_PLAYLIST_IMAGE={DEFAULT_PLAYLIST_IMAGE}
      getPlaylistColor={getPlaylistColor}
      getFallbackImage={getFallbackImage}
    />
  );

  const renderSongItem = ({ item, index }: { item: Song; index: number }) => {
    const isLoaded = displayedSongs.some(s => s.id === item.id);
    if (!isLoaded) return null;
    return (
      <SongItem
        song={item}
        onPress={() => handleSongPress(item, index)}
        isPlaying={currentSong?.id === item.id}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Ambient floating particles */}
      {!isLoading && offlinePlaylists.length > 0 && (
        <>
          {[...Array(6)].map((_, i) => (
            <FloatingParticle
              key={i}
              color={colors.primary}
              delay={i * 700}
            />
          ))}
        </>
      )}

      {/* ── Header ── */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.sm,
            opacity: headerAnim,
          },
        ]}
      >
        <Animated.View style={{ transform: [{ translateY: titleSlideAnim }] }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Offline</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {totalOfflineSongs} songs ready
          </Text>
        </Animated.View>

        <View style={styles.headerRight}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: isLoading ? '#FF9500' : '#34C759' },
              ]}
            >
              <Ionicons
                name={isLoading ? 'cloud-download' : 'cloud-done'}
                size={13}
                color="#FFF"
              />
              <Text style={styles.statusPillText}>{isLoading ? 'Syncing' : 'Ready'}</Text>
            </View>
          </Animated.View>
        </View>
      </Animated.View>

      {/* ── Loading State ── */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <LinearGradient
              colors={[colors.primary + '30', colors.primary + '10']}
              style={styles.loadingOrb}
            >
              <Ionicons name="cloud-download-outline" size={52} color={colors.primary} />
            </LinearGradient>
          </Animated.View>
          <Text style={[styles.loadingTitle, { color: colors.text }]}>Syncing Library</Text>
          <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>
            Finding your offline songs…
          </Text>
        </View>
      ) : (
        /* ── Playlist Grid ── */
        <FlatList
          data={offlinePlaylists}
          keyExtractor={item => item.id}
          renderItem={renderPlaylistItem}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[styles.gridContent, { paddingBottom: currentSong ? 200 : 120 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <LinearGradient
                colors={isDark ? ['#1a1a2e', '#16213e'] : ['#f5f5f5', '#e8e8e8']}
                style={styles.emptyCard}
              >
                <Ionicons name="cloud-offline-outline" size={72} color={colors.primary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Offline Songs</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Download playlists from Google Drive{'\n'}to listen offline
                </Text>
                <TouchableOpacity
                  style={[styles.goToBtn, { backgroundColor: colors.primary }]}
                  onPress={() => navigation.navigate('Settings')}
                >
                  <Ionicons name="download-outline" size={18} color="#FFF" />
                  <Text style={styles.goToBtnText}>Go to Downloads</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          }
        />
      )}

      {/* ── Backdrop when sheet open ── */}
      {selectedPlaylist && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: 'rgba(0,0,0,0.45)',
              opacity: backdropAnim,
              zIndex: 99,
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={closeExpanded}
            activeOpacity={1}
          />
        </Animated.View>
      )}

      {/* ── Expanded Sheet ── */}
      {selectedPlaylist && (
        <Animated.View
          style={[
            styles.sheet,
            {
              opacity: expandOpacity,
              transform: [
                { translateY: expandTranslateY },
                { scale: sheetScaleAnim },
              ],
              zIndex: 100,
            },
          ]}
        >
          <LinearGradient
            colors={
              isDark
                ? ['rgba(28,28,32,0.99)', 'rgba(18,18,20,0.99)']
                : ['rgba(255,255,255,0.99)', 'rgba(242,242,247,0.99)']
            }
            style={styles.sheetInner}
          >
            {/* Drag handle */}
            <View style={styles.dragHandleRow}>
              <View style={[styles.dragHandle, { backgroundColor: colors.textTertiary }]} />
            </View>

            {/* Sheet header with artwork */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetArtworkWrap}>
                <Image
                  source={{ uri: selectedPlaylist.artwork || getFallbackImage(selectedPlaylist.name) }}
                  style={styles.sheetArtwork}
                  resizeMode="cover"
                  onError={(e) => {/* silently falls to tint */ }}
                  defaultSource={{ uri: getFallbackImage(selectedPlaylist.name) }}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.5)']}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>

              <View style={styles.sheetTitleBlock}>
                <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={2}>
                  {selectedPlaylist.name}
                </Text>
                <View style={styles.sheetMeta}>
                  <View style={styles.offlineDotLg} />
                  <Text style={[styles.sheetMetaText, { color: colors.textSecondary }]}>
                    {selectedPlaylist.songs.length} songs · Offline
                  </Text>
                </View>
              </View>

              <TouchableOpacity onPress={closeExpanded} style={styles.closeBtn}>
                <Ionicons name="chevron-down" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Progress bar */}
            {songsLoading && (
              <View style={styles.progressWrap}>
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: colors.surfaceSecondary },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.progressFill,
                      { width: progressWidth, backgroundColor: colors.primary },
                    ]}
                  />
                  {/* Glow tip */}
                  <Animated.View
                    style={[
                      styles.progressGlowTip,
                      {
                        left: progressWidth,
                        backgroundColor: colors.primary,
                        shadowColor: colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                  {loadProgress} / {totalSongs} loaded
                </Text>
              </View>
            )}

            {/* Play All */}
            <View style={styles.playAllRow}>
              <TouchableOpacity
                style={[styles.playAllBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (selectedPlaylist.songs.length > 0) {
                    loadPlaylist(selectedPlaylist.songs, 0);
                    navigation.navigate('Player');
                  }
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="play" size={20} color="#FFF" />
                <Text style={styles.playAllText}>Play All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shuffleBtn,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
                onPress={() => {
                  if (selectedPlaylist.songs.length > 0) {
                    const shuffled = [...selectedPlaylist.songs].sort(() => Math.random() - 0.5);
                    loadPlaylist(shuffled, 0);
                    navigation.navigate('Player');
                  }
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="shuffle" size={20} color={colors.primary} />
                <Text style={[styles.shuffleText, { color: colors.primary }]}>Shuffle</Text>
              </TouchableOpacity>
            </View>

            {/* Songs */}
            <FlatList
              data={selectedPlaylist.songs}
              keyExtractor={item => item.id}
              renderItem={renderSongItem}
              contentContainerStyle={styles.songsContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={5}
            />
          </LinearGradient>
        </Animated.View>
      )}

      {/* Mini Player */}
      {currentSong && (
        <View style={[styles.miniPlayerWrap, { bottom: 60 + insets.bottom }]}>
          <MiniPlayer onPress={() => navigation.navigate('Player')} />
        </View>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Fallback thumbnail
  fallbackIcon: {
    width: '65%',
    height: '65%',
    tintColor: 'rgba(255,255,255,0.92)',
  },
  gradientFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteFallbackContainer: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  noteFallbackEmoji: {
    fontSize: 32,
  },
  noteFallbackName: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // Particle
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    top: 0,
    left: 0,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: FontSize.md,
    marginTop: 3,
    fontWeight: '400',
  },
  headerRight: { alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 6 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  statusPillText: { color: '#FFF', fontSize: FontSize.sm, fontWeight: '700' },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingOrb: {
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTitle: { fontSize: FontSize.xl, fontWeight: '700', marginTop: 8 },
  loadingSubtitle: { fontSize: FontSize.md, textAlign: 'center' },

  // Grid
  gridRow: { justifyContent: 'space-between', paddingHorizontal: Spacing.md },
  gridContent: { paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm },

  // Playlist card
  cardWrapper: { width: '48%', marginBottom: Spacing.lg },
  glowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 10,
  },
  playlistCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 12,
      },
      android: { elevation: 5 },
    }),
  },
  artworkFrame: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  artworkImage: {
    width: '100%',
    height: '100%',
  },
  playBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countPillText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  cardInfo: { padding: Spacing.sm },
  cardName: { fontSize: FontSize.md, fontWeight: '700', marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  offlineDot: { width: 6, height: 6, borderRadius: 3 },
  cardMetaText: { fontSize: FontSize.sm },
  selectedAccentLine: {
    height: 3,
    width: '40%',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },

  // Empty
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg,
    gap: 12,
  },
  emptyTitle: { fontSize: FontSize.xxl, fontWeight: '700' },
  emptySubtitle: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },
  goToBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 25,
    gap: 8,
    marginTop: 4,
  },
  goToBtnText: { color: '#FFF', fontSize: FontSize.md, fontWeight: '600' },

  // Sheet
  sheet: {
    ...StyleSheet.absoluteFillObject,
    top: 90,
  },
  sheetInner: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  dragHandleRow: { alignItems: 'center', paddingVertical: 10 },
  dragHandle: { width: 38, height: 4, borderRadius: 2, opacity: 0.35 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  sheetArtworkWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    flexShrink: 0,
  },
  sheetArtwork: { width: '100%', height: '100%' },
  sheetTitleBlock: { flex: 1 },
  sheetTitle: { fontSize: FontSize.xl, fontWeight: '800', letterSpacing: -0.3 },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  offlineDotLg: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#34C759' },
  sheetMetaText: { fontSize: FontSize.sm },
  closeBtn: { padding: 4 },

  // Progress
  progressWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'visible',
    position: 'relative',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressGlowTip: {
    position: 'absolute',
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 6,
  },
  progressLabel: { fontSize: FontSize.sm, marginTop: 6, textAlign: 'right' },

  // Play all / Shuffle
  playAllRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  playAllBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 25,
    gap: 8,
  },
  playAllText: { color: '#FFF', fontSize: FontSize.md, fontWeight: '700' },
  shuffleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 25,
    gap: 8,
  },
  shuffleText: { fontSize: FontSize.md, fontWeight: '700' },

  // Songs
  songsContent: { paddingHorizontal: Spacing.md, paddingBottom: 160 },

  // Mini player
  miniPlayerWrap: { position: 'absolute', left: 0, right: 0 },
});