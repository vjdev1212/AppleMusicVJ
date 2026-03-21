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
  Animated,
  Easing,
  Dimensions,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme, useAudioPlayer } from '../hooks';
import { usePlaylistStore, useSettingsStore, useGoogleDriveStore } from '../store';
import { SectionHeader, MiniPlayer, SongItem } from '../components';
import { Spacing, BorderRadius, FontSize } from '../constants/theme';
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

// ─── Theme Combos for Thumbnails ──────────────────────────────────────────────
// Each combo: [gradientStart, gradientEnd, iconName, iconTint]
const THEME_COMBOS: Array<{
  colors: [string, string];
  icon: string;
  pattern: 'diagonal' | 'radial' | 'solid';
}> = [
    { colors: ['#FF6B6B', '#C0392B'], icon: 'musical-notes', pattern: 'diagonal' },
    { colors: ['#4ECDC4', '#1ABC9C'], icon: 'headset', pattern: 'radial' },
    { colors: ['#A29BFE', '#6C5CE7'], icon: 'disc', pattern: 'diagonal' },
    { colors: ['#FD79A8', '#E84393'], icon: 'heart', pattern: 'solid' },
    { colors: ['#45B7D1', '#2980B9'], icon: 'radio', pattern: 'radial' },
    { colors: ['#FFEAA7', '#F39C12'], icon: 'star', pattern: 'diagonal' },
    { colors: ['#55EFC4', '#00B894'], icon: 'volume-high', pattern: 'solid' },
    { colors: ['#FAB1A0', '#E17055'], icon: 'mic', pattern: 'radial' },
    { colors: ['#74B9FF', '#0984E3'], icon: 'planet', pattern: 'diagonal' },
    { colors: ['#DDA0DD', '#9B59B6'], icon: 'sparkles', pattern: 'solid' },
    { colors: ['#F8B500', '#E67E22'], icon: 'musical-note', pattern: 'radial' },
    { colors: ['#00CED1', '#0097A7'], icon: 'infinite', pattern: 'diagonal' },
  ];

const getThemeCombo = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return THEME_COMBOS[Math.abs(hash) % THEME_COMBOS.length];
};

// ─── Floating Particle ────────────────────────────────────────────────────────
const FloatingParticle: React.FC<{ color: string; delay: number; size?: number }> = ({
  color,
  delay,
  size = 5,
}) => {
  const posY = useRef(new Animated.Value(SCREEN_HEIGHT * 0.7)).current;
  const posX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4 + Math.random() * 0.6)).current;

  useEffect(() => {
    const startX = Math.random() * SCREEN_WIDTH;
    const animate = () => {
      posX.setValue(startX + (Math.random() - 0.5) * 60);
      posY.setValue(SCREEN_HEIGHT * 0.85);
      Animated.parallel([
        Animated.timing(posY, {
          toValue: -60,
          duration: 5000 + Math.random() * 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: 500, useNativeDriver: true }),
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
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        top: 0,
        left: 0,
        opacity,
        transform: [{ translateY: posY }, { translateX: posX }, { scale }],
      }}
    />
  );
};

// ─── Animated Playlist Card ───────────────────────────────────────────────────
const AnimatedPlaylistCard: React.FC<{
  item: Playlist;
  index: number;
  colors: any;
  onPress: () => void;
}> = ({ item, index, colors, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const [imgError, setImgError] = useState(false);

  const combo = getThemeCombo(item.name);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: index * 90,
      tension: 55,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Shimmer loop
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 2,
        duration: 2200 + index * 300,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const onPressIn = () =>
    Animated.spring(pressAnim, { toValue: 0.94, useNativeDriver: true, tension: 200 }).start();
  const onPressOut = () =>
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, tension: 200 }).start();

  const shimmerX = shimmerAnim.interpolate({
    inputRange: [-1, 2],
    outputRange: [-180, 180],
  });

  const hasArtwork = !!item.artwork && !imgError;

  return (
    <Animated.View
      style={{
        opacity: scaleAnim,
        transform: [
          { scale: Animated.multiply(scaleAnim, pressAnim) },
          {
            translateY: scaleAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            }),
          },
        ],
        marginRight: Spacing.md,
      }}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.cardOuter}
      >
        <View style={styles.cardInner}>
          {/* Thumbnail */}
          <View style={styles.cardThumb}>
            {hasArtwork ? (
              <ImageBackground
                source={{ uri: item.artwork }}
                style={StyleSheet.absoluteFillObject}
                imageStyle={{ borderRadius: 0 }}
                onError={() => setImgError(true)}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.96)']}
                  style={StyleSheet.absoluteFillObject}
                />
              </ImageBackground>
            ) : (
              /* Theme combo thumbnail */
              <LinearGradient
                colors={combo.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              >
                {/* Decorative circle */}
                <View style={styles.thumbCircleLg} />
                <View style={styles.thumbCircleSm} />

                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.9)']}
                  style={StyleSheet.absoluteFillObject}
                />
              </LinearGradient>
            )}

            {/* Shimmer sweep */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shimmer,
                { transform: [{ translateX: shimmerX }, { rotate: '-18deg' }] },
              ]}
            />

            {/* Icon overlay (always shown) */}
            <View style={styles.cardIconWrap}>
              <Ionicons
                name={combo.icon as any}
                size={hasArtwork ? 22 : 36}
                color={hasArtwork ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.92)'}
              />
            </View>

            {/* Badge top-right */}
            <View style={styles.cardBadge}>
              <Ionicons name="musical-notes" size={9} color="#fff" />
              <Text style={styles.cardBadgeText}>{item.songs.length}</Text>
            </View>
          </View>

          {/* Card info */}
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: '#fff' }]} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.cardCount}>{item.songs.length} songs</Text>
            {/* Play button */}
            <View style={styles.cardPlayBtn}>
              <Ionicons name="play" size={18} color="#000" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Animated Greeting Card ───────────────────────────────────────────────────
const GreetingCard: React.FC<{
  colors: any;
  isDark: boolean;
  lastScan: Date | null;
  isScanning: boolean;
  scanProgress: number;
  scanStatus: string | null;
}> = ({ colors, isDark, lastScan, isScanning, scanProgress, scanStatus }) => {
  const slideAnim = useRef(new Animated.Value(-40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const iconSpinAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const greeting = getGreeting();

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    // Icon idle pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: scanProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [scanProgress]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const iconName =
    greeting === 'Morning' ? 'sunny' : greeting === 'Afternoon' ? 'partly-sunny' : 'moon';

  return (
    <Animated.View
      style={[
        styles.greetingWrap,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <LinearGradient
        colors={isDark ? ['#1c1c20', '#111113'] : ['#f2f2f7', '#ffffff']}
        style={styles.greetingCard}
      >
        {/* Decorative background circle */}
        <View style={[styles.greetingBgCircle, { backgroundColor: colors.primary + '12' }]} />

        <View style={styles.greetingRow}>
          <View style={styles.greetingText}>
            <Text style={[styles.greetingLabel, { color: colors.primary }]}>
              {greeting.toUpperCase()}
            </Text>
            <Text style={[styles.greetingTitle, { color: colors.text }]}>
              Welcome back, Viki
            </Text>
            <Text style={[styles.greetingSubtitle, { color: colors.textSecondary }]}>
              {lastScan
                ? `Last synced ${lastScan.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Ready for some music?'}
            </Text>

            {isScanning && (
              <View style={styles.progressWrap}>
                <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
                  <Animated.View
                    style={[styles.progressFill, { width: progressWidth, backgroundColor: colors.primary }]}
                  />
                  {/* Glow tip */}
                  <Animated.View
                    style={[styles.progressTip, { left: progressWidth, backgroundColor: colors.primary, shadowColor: colors.primary }]}
                  />
                </View>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                  {scanStatus || `Syncing ${Math.round(scanProgress * 100)}%`}
                </Text>
              </View>
            )}
          </View>

          <Animated.View style={[styles.greetingIconCircle, { backgroundColor: colors.primary + '18', transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name={iconName as any} size={34} color={colors.primary} />
          </Animated.View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

// ─── Animated Section Header ──────────────────────────────────────────────────
const AnimatedSectionHeader: React.FC<{
  title: string;
  delay?: number;
  colors: any;
  rightElement?: React.ReactNode;
}> = ({ title, delay = 0, colors, rightElement }) => {
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, delay, tension: 70, friction: 10, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[styles.sectionHeaderRow, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {rightElement}
    </Animated.View>
  );
};

// ─── Animated Song Row ────────────────────────────────────────────────────────
const AnimatedSongRow: React.FC<{
  children: React.ReactNode;
  index: number;
}> = ({ children, index }) => {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, delay: index * 60, tension: 65, friction: 10, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
      {children}
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const HomeScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();

  const { loadPlaylist, currentSong, isPlaying } = useAudioPlayer();
  const { playlists, recentlyPlayed, setPlaylists, favorites } = usePlaylistStore();
  const { streamingUrls } = useSettingsStore();
  const {
    isConnected: isGoogleDriveConnected,
    setConnected,
    lastScan,
    setLastScan,
    isScanning,
    scanProgress,
    scanStatus,
  } = useGoogleDriveStore();

  const [refreshing, setRefreshing] = useState(false);
  const headerFadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-24)).current;

  // Streaming playlist
  const streamingPlaylist: Playlist = {
    id: 'streaming-playlist',
    name: 'Streaming',
    description: 'Custom streaming URLs',
    songs: streamingUrls.map((url, i) => ({
      id: `stream-${i}`,
      title: `Stream ${i + 1}`,
      artist: 'Unknown Artist',
      duration: 180000,
      url,
      source: 'streaming-url',
    })),
    source: 'streaming',
  };

  const googleDrivePlaylists = playlists.filter(p => p.source === 'google-drive');
  const allPlaylists = [
    ...googleDrivePlaylists,
    ...(streamingUrls.length > 0 ? [streamingPlaylist] : []),
    ...playlists.filter(p => p.source === 'favorites'),
  ];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(headerSlideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
    ]).start();

    const checkGoogleDrive = async () => {
      const connected = await googleDriveService.isConnected();
      if (connected) {
        setConnected(true);
        try {
          const musicPlaylist = await googleDriveService.autoScanMusicFolder();
          if (musicPlaylist.length > 0) setPlaylists(musicPlaylist);
        } catch { }
        finally { setLastScan(new Date()); }
      } else {
        setConnected(false);
        setPlaylists([]);
      }
    };
    checkGoogleDrive();
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const connected = await googleDriveService.isConnected();
    if (connected) {
      setConnected(true);
      try {
        const musicPlaylist = await googleDriveService.autoScanMusicFolder();
        if (musicPlaylist.length > 0)
          setPlaylists([...playlists.filter(p => !p.id.startsWith('gdrive-')), ...musicPlaylist]);
      } catch { }
      finally { setLastScan(new Date()); }
    } else {
      setConnected(false);
      setPlaylists([]);
    }
    setRefreshing(false);
  }, [playlists, setPlaylists]);

  const handlePlaylistPress = (playlist: Playlist) =>
    navigation.navigate('Playlist', { playlist });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Ambient particles */}
      {allPlaylists.length > 0 &&
        [...Array(7)].map((_, i) => (
          <FloatingParticle
            key={i}
            color={colors.primary}
            delay={i * 600}
            size={4 + (i % 3)}
          />
        ))}

      {/* ── Header ── */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.sm,
            opacity: headerFadeAnim,
            transform: [{ translateY: headerSlideAnim }],
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>Library</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.profileBtn}>
            <Image
              source={{ uri: 'https://i.pravatar.cc/100?u=viki' }}
              style={styles.profileImg}
            />
            {/* Online dot */}
            <View style={[styles.profileOnlineDot, { backgroundColor: isGoogleDriveConnected ? '#34C759' : '#FF3B30' }]} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: currentSong ? 140 : Spacing.xxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* Greeting */}
        <GreetingCard
          colors={colors}
          isDark={isDark}
          lastScan={lastScan}
          isScanning={isScanning}
          scanProgress={scanProgress}
          scanStatus={scanStatus}
        />

        {/* Playlists */}
        <AnimatedSectionHeader
          title="Playlists"
          delay={150}
          colors={colors}
          rightElement={
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: isGoogleDriveConnected ? '#34C759' : '#FF3B30' }]} />
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                {isGoogleDriveConnected ? 'Online' : 'No Drive'}
              </Text>
            </View>
          }
        />

        {allPlaylists.length === 0 ? (
          <Animated.View
            style={[
              styles.emptyState,
              {
                opacity: headerFadeAnim,
                transform: [{
                  translateY: headerFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }),
                }],
              },
            ]}
          >
            <LinearGradient
              colors={isDark ? ['#1c1c20', '#111113'] : ['#f2f2f7', '#e5e5ea']}
              style={styles.emptyCard}
            >
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="musical-notes-outline" size={52} color={colors.primary} />
              </View>
              <Text style={[styles.emptyText, { color: colors.text }]}>No playlists yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Add streaming URLs or connect{'\n'}Google Drive in Settings
              </Text>
            </LinearGradient>
          </Animated.View>
        ) : (
          <FlatList
            horizontal
            data={allPlaylists}
            keyExtractor={item => item.id}
            renderItem={({ item, index }) => (
              <AnimatedPlaylistCard
                item={item}
                index={index}
                colors={colors}
                onPress={() => handlePlaylistPress(item)}
              />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.playlistList}
          />
        )}

        {/* Recently Played */}
        {recentlyPlayed.length > 0 && (
          <>
            <AnimatedSectionHeader title="Recently Played" delay={250} colors={colors} />
            <View style={styles.songList}>
              {recentlyPlayed.slice(0, 5).map((song, index) => (
                <AnimatedSongRow key={song.id} index={index}>
                  <SongItem
                    song={song}
                    onPress={() => {
                      loadPlaylist(recentlyPlayed, index);
                      navigation.navigate('Player');
                    }}
                    isPlaying={currentSong?.id === song.id}
                  />
                </AnimatedSongRow>
              ))}
            </View>
          </>
        )}

        {/* Favorites */}
        {favorites.length > 0 && (
          <>
            <AnimatedSectionHeader title="Favorites" delay={350} colors={colors} />
            <View style={styles.songList}>
              {favorites.slice(0, 5).map((song, index) => (
                <AnimatedSongRow key={song.id} index={index}>
                  <SongItem
                    song={song}
                    onPress={() => {
                      loadPlaylist(favorites, index);
                      navigation.navigate('Player');
                    }}
                    isPlaying={currentSong?.id === song.id}
                  />
                </AnimatedSongRow>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Mini Player */}
      {currentSong && (
        <View style={[styles.miniPlayerWrap, { bottom: 60 + insets.bottom }]}>
          <MiniPlayer onPress={() => navigation.navigate('Player')} />
        </View>
      )}
    </View>
  );
};

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  profileBtn: { position: 'relative' },
  profileImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  profileOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#fff',
  },

  // Greeting
  greetingWrap: { paddingHorizontal: Spacing.md, marginBottom: Spacing.lg },
  greetingCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.1)',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16 },
      android: { elevation: 4 },
    }),
  },
  greetingBgCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -40,
    top: -50,
  },
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greetingText: { flex: 1, marginRight: Spacing.md },
  greetingLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 4 },
  greetingTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  greetingSubtitle: { fontSize: FontSize.sm, opacity: 0.8 },
  greetingIconCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Progress (inside greeting)
  progressWrap: { marginTop: Spacing.sm },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'visible',
    position: 'relative',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressTip: {
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
  progressLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, marginTop: 5, textAlign: 'right' },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: '800', letterSpacing: -0.3 },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Playlist list
  playlistList: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.md,
  },

  // Playlist card
  cardOuter: {
    width: 158,
    height: 210,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 14 },
      android: { elevation: 6 },
    }),
  },
  cardInner: { flex: 1, borderRadius: BorderRadius.xl, overflow: 'hidden', backgroundColor: '#222' },
  cardThumb: { flex: 1, position: 'relative', overflow: 'hidden' },
  thumbCircleLg: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -30,
    right: -30,
  },
  thumbCircleSm: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: 20,
    left: -20,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 55,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  cardIconWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  cardBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.sm,
  },
  cardName: { fontSize: FontSize.md, fontWeight: '800', letterSpacing: -0.2, marginBottom: 2 },
  cardCount: { color: 'rgba(255,255,255,0.65)', fontSize: FontSize.sm },
  cardPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: Spacing.xs,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },

  // Songs
  songList: { marginBottom: Spacing.md },

  // Empty
  emptyState: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  emptyCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.1)',
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyText: { fontSize: FontSize.lg, fontWeight: '700' },
  emptySubtext: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22, opacity: 0.8 },

  // Mini player
  miniPlayerWrap: { position: 'absolute', left: 0, right: 0 },

  // Scroll
  scrollView: { flex: 1 },
});