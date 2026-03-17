import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Slider from '@react-native-community/slider';

import { useTheme, useAudioPlayer } from '../hooks';
import { Spacing, BorderRadius, FontSize, PlayerColors } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ARTWORK_SIZE = SCREEN_WIDTH - 80;

export const PlayerScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    shuffle,
    repeat,
    togglePlayPause,
    seekTo,
    skipToNext,
    skipToPrevious,
    toggleShuffle,
    toggleRepeat,
  } = useAudioPlayer();

  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  if (!currentSong) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.noSongText, { color: colors.textSecondary }]}>
          No song playing
        </Text>
      </View>
    );
  }

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSliderChange = (value: number) => {
    setDragValue(value);
  };

  const handleSliderComplete = (value: number) => {
    seekTo(value);
    setIsDragging(false);
  };

  const progress = isDragging ? dragValue : currentTime;

  const getRepeatIcon = (): any => {
    switch (repeat) {
      case 'one':
        return 'repeat-one';
      default:
        return 'repeat';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background */}
      <View style={[styles.background, { backgroundColor: '#000000' }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : true} style={styles.headerIconButton}>
          <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerSubtitle}>PLAYING FROM</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentSong.source === 'youtube' ? 'YouTube Music' : 'Your Library'}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerIconButton}>
          <Ionicons name="ellipsis-vertical" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Artwork */}
      <View style={styles.artworkContainer}>
        <View style={styles.artworkWrapper}>
          <Image
            source={{ uri: currentSong.artwork || 'https://raw.githubusercontent.com/viki28593/assets/main/premium_music_note.png' }}
            style={styles.artworkImage}
            resizeMode="cover"
          />
        </View>
      </View>

      {/* Song Info & Like */}
      <View style={styles.songInfoContainer}>
        <View style={styles.songTextContainer}>
          <Text style={styles.songTitle} numberOfLines={2}>
            {currentSong.title}
          </Text>
          <Text style={styles.songArtist} numberOfLines={1}>
            {currentSong.artist}
          </Text>
        </View>
        <TouchableOpacity style={styles.likeButton}>
          <Ionicons name="heart-outline" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration || 1}
          value={progress}
          onSlidingStart={() => setIsDragging(true)}
          onValueChange={handleSliderChange}
          onSlidingComplete={handleSliderComplete}
          minimumTrackTintColor="#FF0000" // YT Music Red
          maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
          thumbTintColor="#FF0000"
        />
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>{formatTime(progress)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>

      {/* Playback Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={toggleShuffle} style={styles.sideControl}>
          <Ionicons
            name="shuffle"
            size={24}
            color={shuffle ? '#FF0000' : 'rgba(255,255,255,0.7)'}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={skipToPrevious} style={styles.mainControl}>
          <Ionicons name="play-skip-back" size={36} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={togglePlayPause}
          style={styles.playPauseButton}
        >
          <View style={styles.playPauseCircle}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={48}
              color="#000000"
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={skipToNext} style={styles.mainControl}>
          <Ionicons name="play-skip-forward" size={36} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleRepeat} style={styles.sideControl}>
          <Ionicons
            name={getRepeatIcon() === 'repeat-one' ? 'repeat-outline' : 'repeat'}
            size={24}
            color={repeat !== 'off' ? '#FF0000' : 'rgba(255,255,255,0.7)'}
          />
          {repeat === 'one' && <Text style={styles.repeatBadge}>1</Text>}
        </TouchableOpacity>
      </View>

      {/* Bottom Shortcuts */}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    height: 80,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  artworkContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  artworkWrapper: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  artworkImage: {
    width: '100%',
    height: '100%',
  },
  songInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  songTextContainer: {
    flex: 1,
  },
  songTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 30,
  },
  songArtist: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '500',
  },
  likeButton: {
    marginLeft: Spacing.md,
  },
  progressContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  slider: {
    width: '100%',
    height: 30,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -5,
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  sideControl: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mainControl: {
    padding: Spacing.sm,
  },
  playPauseButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseCircle: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4, // Visual centering for play icon
  },
  repeatBadge: {
    position: 'absolute',
    top: 10,
    right: 8,
    color: '#FF0000',
    fontSize: 9,
    fontWeight: '900',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  footerButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  noSongText: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: SCREEN_HEIGHT / 2,
  },
});
