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
      {/* Background gradient */}
      <LinearGradient
        colors={isDark 
          ? ['rgba(255, 55, 95, 0.3)', 'rgba(0, 0, 0, 1)']
          : ['rgba(255, 45, 85, 0.2)', 'rgba(255, 255, 255, 1)']
        }
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : true} style={styles.backButton}>
          <Ionicons name="chevron-down" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Now Playing</Text>
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Artwork */}
      <View style={styles.artworkContainer}>
        <View
          style={[
            styles.artworkShadow,
            {
              shadowColor: colors.primary,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <View
            style={[
              styles.artwork,
              {
                width: ARTWORK_SIZE,
                height: ARTWORK_SIZE,
                backgroundColor: colors.surfaceSecondary,
              },
            ]}
          >
            {currentSong.artwork ? (
              <Image
                source={{ uri: currentSong.artwork }}
                style={[styles.artworkImage, { width: ARTWORK_SIZE, height: ARTWORK_SIZE }]}
                resizeMode="cover"
              />
            ) : (
              <Image
                source={{ uri: 'https://raw.githubusercontent.com/viki28593/assets/main/premium_music_note.png' }}
                style={[styles.artworkImage, { width: ARTWORK_SIZE, height: ARTWORK_SIZE }]}
                resizeMode="cover"
              />
            )}
          </View>
        </View>
      </View>

      {/* Song Info */}
      <View style={styles.songInfo}>
        <Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={1}>
          {currentSong.title}
        </Text>
        <Text style={[styles.songArtist, { color: colors.textSecondary }]} numberOfLines={1}>
          {currentSong.artist}
        </Text>
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
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.surfaceSecondary}
          thumbTintColor={colors.primary}
        />
        <View style={styles.timeContainer}>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {formatTime(progress)}
          </Text>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {formatTime(duration)}
          </Text>
        </View>
      </View>

      {/* Playback Controls */}
      <View style={styles.controls}>
        {/* Shuffle */}
        <TouchableOpacity onPress={toggleShuffle} style={styles.sideButton}>
          <Ionicons
            name="shuffle"
            size={24}
            color={shuffle ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Previous */}
        <TouchableOpacity onPress={skipToPrevious} style={styles.controlButton}>
          <Ionicons name="play-skip-back" size={32} color={colors.text} />
        </TouchableOpacity>

        {/* Play/Pause */}
        <TouchableOpacity
          onPress={togglePlayPause}
          style={[styles.playButton, { backgroundColor: colors.primary }]}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={36}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        {/* Next */}
        <TouchableOpacity onPress={skipToNext} style={styles.controlButton}>
          <Ionicons name="play-skip-forward" size={32} color={colors.text} />
        </TouchableOpacity>

        {/* Repeat */}
        <TouchableOpacity onPress={toggleRepeat} style={styles.sideButton}>
          <Ionicons
            name={getRepeatIcon()}
            size={24}
            color={repeat !== 'off' ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity style={styles.bottomButton}>
          <Ionicons name="heart-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomButton}>
          <Ionicons name="share-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomButton}>
          <Ionicons name="list-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
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
    paddingBottom: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  moreButton: {
    padding: Spacing.xs,
  },
  artworkContainer: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  artworkShadow: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  artwork: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  artworkImage: {
    borderRadius: BorderRadius.lg,
  },
  artworkPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songInfo: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  songTitle: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  songArtist: {
    fontSize: FontSize.lg,
    textAlign: 'center',
  },
  progressContainer: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -Spacing.sm,
  },
  timeText: {
    fontSize: FontSize.sm,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  sideButton: {
    padding: Spacing.md,
  },
  controlButton: {
    padding: Spacing.md,
    marginHorizontal: Spacing.sm,
  },
  playButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  bottomButton: {
    padding: Spacing.md,
  },
  noSongText: {
    fontSize: FontSize.lg,
    textAlign: 'center',
    marginTop: SCREEN_HEIGHT / 2 - 50,
  },
});
