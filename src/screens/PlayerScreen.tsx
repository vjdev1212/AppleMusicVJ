import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  Easing,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';

import { useTheme, useAudioPlayer } from '../hooks';
import { usePlayerStore } from '../store';
import { Spacing, BorderRadius, FontSize } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ARTWORK_SIZE = SCREEN_WIDTH - 120;

export const PlayerScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  
  const {
    currentSong,
    isPlaying,
    shuffle,
    repeat,
    togglePlayPause,
    skipToNext,
    skipToPrevious,
    toggleShuffle,
    toggleRepeat,
  } = useAudioPlayer();

  // Background Animation
  const bgAnim = React.useRef(new Animated.Value(0)).current;
  
  // Visualizer Animations
  const bar1 = React.useRef(new Animated.Value(0.3)).current;
  const bar2 = React.useRef(new Animated.Value(0.6)).current;
  const bar3 = React.useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.timing(bgAnim, {
          toValue: 1,
          duration: 10000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      const createBarAnim = (anim: Animated.Value, duration: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.2, duration, useNativeDriver: true }),
          ])
        );
      };

      createBarAnim(bar1, 400).start();
      createBarAnim(bar2, 550).start();
      createBarAnim(bar3, 350).start();
    } else {
      bgAnim.stopAnimation();
      bar1.stopAnimation();
      bar2.stopAnimation();
      bar3.stopAnimation();
    }
  }, [isPlaying]);

  const bgStyle1 = {
    transform: [
      {
        rotate: bgAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
      { translateX: 50 },
    ],
  };

  const bgStyle2 = {
    transform: [
      {
        rotate: bgAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['360deg', '0deg'],
        }),
      },
      { translateX: -50 },
    ],
  };

  if (!currentSong) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.noSongText, { color: colors.textSecondary }]}>
          No song playing
        </Text>
      </View>
    );
  }

  const getRepeatIcon = (): any => {
    switch (repeat) {
      case 'one': return 'repeat-one';
      default: return 'repeat';
    }
  };

  // Three dot menu state
  const [showMenu, setShowMenu] = useState(false);
  const [menuAnimation] = useState(new Animated.Value(0));

  const toggleMenu = () => {
    if (showMenu) {
      Animated.timing(menuAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowMenu(false));
    } else {
      setShowMenu(true);
      Animated.timing(menuAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const menuTranslateY = menuAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });

  const menuOpacity = menuAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background Layer */}
      <View style={styles.backgroundContainer}>
        <Animated.View style={[styles.bgCircle, bgStyle1, { backgroundColor: colors.primary + '30' }]} />
        <Animated.View style={[styles.bgCircle, bgStyle2, { backgroundColor: '#4facfe30' }]} />
        <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
        <View style={[styles.backgroundOverlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
      </View>

      {/* Main UI */}
      <View style={styles.contentContainer}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
          <TouchableOpacity onPress={() => navigation.canGoBack() && navigation.goBack()} style={styles.headerIconButton}>
            <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerSubtitle}>PLAYING FROM</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {currentSong.source === 'youtube' ? 'YouTube Music' : 'Your Library'}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerIconButton} onPress={toggleMenu}>
            <Ionicons name="ellipsis-vertical" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Artwork */}
        <View style={styles.artworkContainer}>
          <View style={styles.artworkWrapper}>
            <Image
              source={
                currentSong.artwork 
                  ? { uri: currentSong.artwork } 
                  : require('../../assets/icon.png')
              }
              defaultSource={require('../../assets/icon.png')}
              style={styles.artworkImage}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Info */}
        <View style={styles.songInfoContainer}>
          <View style={styles.songTextContainer}>
            <Text style={styles.songTitle} numberOfLines={2}>{currentSong.title}</Text>
            <View style={styles.artistContainer}>
              <Text style={styles.songArtist} numberOfLines={1}>{currentSong.artist}</Text>
              {isPlaying && (
                <View style={styles.visualizer}>
                  <Animated.View style={[styles.visBar, { transform: [{ scaleY: bar1 }] }]} />
                  <Animated.View style={[styles.visBar, { transform: [{ scaleY: bar2 }] }]} />
                  <Animated.View style={[styles.visBar, { transform: [{ scaleY: bar3 }] }]} />
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.likeButton}>
            <Ionicons name="heart-outline" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Progress */}
        <ProgressSection />

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={toggleShuffle} style={styles.sideControl}>
            <Ionicons name="shuffle" size={24} color={shuffle ? '#FF0000' : 'rgba(255,255,255,0.7)'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={skipToPrevious} style={styles.mainControl}>
            <Ionicons name="play-skip-back" size={36} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseButton} activeOpacity={0.8}>
            <View style={styles.playPauseCircle}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={48} color="#000000" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={skipToNext} style={styles.mainControl}>
            <Ionicons name="play-skip-forward" size={36} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleRepeat} style={styles.sideControl}>
            <Ionicons name={(getRepeatIcon() === 'repeat-one' ? 'repeat-one' : 'repeat') as any} size={24} color={repeat !== 'off' ? '#FF0000' : 'rgba(255,255,255,0.7)'} />
            {repeat === 'one' && <Text style={styles.repeatBadge}>1</Text>}
          </TouchableOpacity>
        </View>

        {/* Bottom */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <TouchableOpacity style={styles.footerButton}>
            <Ionicons name="chatbubble-outline" size={22} color="rgba(255,255,255,0.7)" />
            <Text style={styles.footerButtonText}>Lyrics</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerButton}>
            <Ionicons name="list" size={22} color="rgba(255,255,255,0.7)" />
            <Text style={styles.footerButtonText}>Related</Text>
          </TouchableOpacity>
        </View>

        {/* Three Dot Menu Modal */}
        <Modal
          visible={showMenu}
          transparent
          animationType="fade"
          onRequestClose={toggleMenu}
        >
          <Pressable style={styles.menuOverlay} onPress={toggleMenu}>
            <Animated.View 
              style={[
                styles.menuContainer,
                { 
                  opacity: menuOpacity,
                  transform: [{ translateY: menuTranslateY }] 
                }
              ]}
            >
              <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.menuTitle, { color: colors.text }]}>Now Playing</Text>
                <TouchableOpacity onPress={toggleMenu} style={styles.menuCloseButton}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.menuContent}>
                {/* Song Info in Menu */}
                <View style={styles.menuSongInfo}>
                  <Image
                    source={
                      currentSong.artwork 
                        ? { uri: currentSong.artwork } 
                        : require('../../assets/icon.png')
                    }
                    style={styles.menuArtwork}
                  />
                  <View style={styles.menuSongText}>
                    <Text style={[styles.menuSongTitle, { color: colors.text }]} numberOfLines={1}>
                      {currentSong.title}
                    </Text>
                    <Text style={[styles.menuSongArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                      {currentSong.artist}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.menuItem}>
                  <Ionicons name="heart-outline" size={24} color={colors.text} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Add to Favorites</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.menuItem}>
                  <Ionicons name="list" size={24} color={colors.text} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Add to Playlist</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.menuItem}>
                  <Ionicons name="share-outline" size={24} color={colors.text} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Share</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.menuItem}>
                  <Ionicons name="information-circle-outline" size={24} color={colors.text} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Song Info</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.menuItem}>
                  <Ionicons name="albums-outline" size={24} color={colors.text} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Go to Album</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Pressable>
        </Modal>
      </View>
    </View>
  );
};

const ProgressSection: React.FC = () => {
  const currentTime = usePlayerStore(state => state.currentTime);
  const duration = usePlayerStore(state => state.duration);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  const formatTime = (ms: number): string => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const current = isDragging ? dragValue : currentTime;

  return (
    <View style={styles.progressContainer}>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration || 1}
        value={current}
        onSlidingStart={() => setIsDragging(true)}
        onValueChange={setDragValue}
        onSlidingComplete={async (val) => {
          const { audioService } = require('../services/audioService');
          await audioService.seekTo(val);
          setIsDragging(false);
        }}
        minimumTrackTintColor="#FF0000"
        maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
        thumbTintColor="#FF0000"
      />
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{formatTime(current)}</Text>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { flex: 1 },
  backgroundContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', overflow: 'hidden', zIndex: -1 },
  bgCircle: { position: 'absolute', width: SCREEN_WIDTH * 1.5, height: SCREEN_WIDTH * 1.5, borderRadius: SCREEN_WIDTH, top: -SCREEN_WIDTH * 0.5, left: -SCREEN_WIDTH * 0.25 },
  backgroundOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, height: 80 },
  headerIconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, alignItems: 'center' },
  headerSubtitle: { color: 'rgba(255, 255, 255, 0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  headerTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  artworkContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  artworkWrapper: { width: ARTWORK_SIZE, height: ARTWORK_SIZE, borderRadius: 16, overflow: 'hidden', elevation: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.6, shadowRadius: 25 },
  artworkImage: { width: '100%', height: '100%' },
  songInfoContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg },
  songTextContainer: { flex: 1 },
  songTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 6, lineHeight: 30 },
  songArtist: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 16, fontWeight: '500' },
  artistContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  visualizer: { flexDirection: 'row', alignItems: 'flex-end', height: 14, gap: 2, marginBottom: 2 },
  visBar: { width: 3, height: 12, backgroundColor: '#FF0000', borderRadius: 1.5 },
  likeButton: { marginLeft: Spacing.md },
  progressContainer: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  slider: { width: '100%', height: 30 },
  timeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -5 },
  timeText: { color: 'rgba(255, 255, 255, 0.5)', fontSize: 12, fontWeight: '500' },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  sideControl: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  mainControl: { padding: Spacing.sm },
  playPauseButton: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  playPauseCircle: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', paddingLeft: 4 },
  repeatBadge: { position: 'absolute', top: 10, right: 8, color: '#FF0000', fontSize: 9, fontWeight: '900' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: Spacing.md },
  footerButton: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.lg, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  footerButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', marginLeft: 6 },
  noSongText: { color: '#FFFFFF', fontSize: 18, textAlign: 'center', marginTop: SCREEN_HEIGHT / 2 },
  
  // Menu Styles
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  menuContainer: { backgroundColor: '#1c1c1e', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '70%' },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 0.5 },
  menuTitle: { fontSize: FontSize.lg, fontWeight: '600' },
  menuCloseButton: { padding: Spacing.xs },
  menuContent: { paddingHorizontal: Spacing.lg },
  menuSongInfo: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)', marginBottom: Spacing.sm },
  menuArtwork: { width: 60, height: 60, borderRadius: 8, marginRight: Spacing.md },
  menuSongText: { flex: 1 },
  menuSongTitle: { fontSize: FontSize.md, fontWeight: '600', marginBottom: 2 },
  menuSongArtist: { fontSize: FontSize.sm },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md },
  menuItemText: { fontSize: FontSize.md, marginLeft: Spacing.md },
});
