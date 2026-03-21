import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks';
import { Spacing, BorderRadius, FontSize } from '../constants/theme';
import { Song } from '../types';

interface SongItemProps {
  song: Song;
  onPress: () => void;
  isPlaying?: boolean;
  showIndex?: boolean;
  index?: number;
  onMorePress?: () => void;
}

export const SongItem: React.FC<SongItemProps> = ({
  song,
  onPress,
  isPlaying = false,
  showIndex = false,
  index,
  onMorePress,
}) => {
  const { colors } = useTheme();

  const formatDuration = (ms: number): string => {
    if (!ms) return '--:--';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: isPlaying ? colors.surface : 'transparent' },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {showIndex && index !== undefined && (
        <Text style={[styles.index, { color: colors.textSecondary }]}>
          {index + 1}
        </Text>
      )}
      
      <View
        style={[
          styles.artworkContainer,
          { backgroundColor: colors.surfaceSecondary },
        ]}
      >
        <Image
          source={
            song.artwork 
              ? { uri: song.artwork } 
              : require('../../assets/icon.png')
          }
          defaultSource={require('../../assets/icon.png')}
          style={styles.artwork}
          resizeMode="cover"
        />
        {isPlaying && (
          <View style={styles.playingIndicator}>
            <Ionicons name="volume-high" size={16} color={colors.primary} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text
          style={[
            styles.title,
            { color: isPlaying ? colors.primary : colors.text },
          ]}
          numberOfLines={1}
        >
          {song.title}
        </Text>
        <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
          {song.artist}
        </Text>
      </View>

      <Text style={[styles.duration, { color: colors.textSecondary }]}>
        {formatDuration(song.duration)}
      </Text>

      {onMorePress && (
        <TouchableOpacity onPress={onMorePress} style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  index: {
    width: 30,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  artworkContainer: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    position: 'relative',
  },
  artwork: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.sm,
  },
  playingIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  artist: {
    fontSize: FontSize.sm,
  },
  duration: {
    fontSize: FontSize.sm,
    marginLeft: Spacing.sm,
  },
  moreButton: {
    padding: Spacing.sm,
  },
});
