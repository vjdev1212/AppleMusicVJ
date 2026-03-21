import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, useAudioPlayer } from '../hooks';
import { Spacing, BorderRadius, FontSize, Animation } from '../constants/theme';

interface MiniPlayerProps {
  onPress: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ onPress }) => {
  const { colors, isDark } = useTheme();
  const { currentSong, isPlaying, togglePlayPause, currentTime, duration, stop } = useAudioPlayer();

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handlePlayPause = (e: any) => {
    e.stopPropagation();
    if (togglePlayPause) {
      togglePlayPause();
    }
  };

  const handleClose = (e: any) => {
    e.stopPropagation();
    if (stop) {
      stop();
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={isDark 
          ? ['rgba(28, 28, 30, 0.95)', 'rgba(28, 28, 30, 0.9)']
          : ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.9)']
        }
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Progress bar at top */}
          <View style={[styles.progressContainer, { backgroundColor: colors.surfaceSecondary }]}>
            <View
              style={[
                styles.progress,
                {
                  backgroundColor: colors.primary,
                  width: `${progressPercent}%`,
                },
              ]}
            />
          </View>

          <View style={styles.mainContent}>
            {/* Artwork */}
            <View
              style={[
                styles.artworkContainer,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Image
                source={
                  currentSong.artwork 
                    ? { uri: currentSong.artwork } 
                    : require('../../assets/icon.png')
                }
                defaultSource={require('../../assets/icon.png')}
                style={styles.artwork}
                resizeMode="cover"
              />
            </View>

            {/* Song info */}
            <View style={styles.info}>
              <Text
                style={[styles.title, { color: colors.text }]}
                numberOfLines={1}
              >
                {currentSong.title}
              </Text>
              <Text
                style={[styles.artist, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {currentSong.artist}
              </Text>
            </View>

            {/* Play/Pause button */}
            <View style={styles.controls}>
              <TouchableOpacity
                style={[styles.playButton, { backgroundColor: colors.primary }]}
                onPress={handlePlayPause}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: 'rgba(128, 128, 128, 0.2)' }]}
                onPress={handleClose}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={isDark ? '#FFFFFF' : '#000000'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  progressContainer: {
    height: 2,
    width: '100%',
  },
  progress: {
    height: '100%',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  artworkContainer: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  artwork: {
    width: 46,
    height: 46,
  },
  info: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  artist: {
    fontSize: FontSize.sm,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
});
