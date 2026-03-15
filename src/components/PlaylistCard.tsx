import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useTheme } from '../hooks';
import { Spacing, BorderRadius, FontSize } from '../constants/theme';
import { Playlist } from '../types';

interface PlaylistCardProps {
  playlist: Playlist;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  onPress,
  size = 'medium',
}) => {
  const { colors } = useTheme();

  const cardSize = {
    small: { width: 140, height: 180 },
    medium: { width: 170, height: 220 },
    large: { width: 200, height: 260 },
  };

  const imageSize = {
    small: 120,
    medium: 150,
    large: 180,
  };

  const getSourceIcon = () => {
    switch (playlist.source) {
      case 'google-drive':
        return '📁';
      case 'streaming':
        return '🌐';
      case 'favorites':
        return '❤️';
      case 'recently-played':
        return '🕐';
      default:
        return '🎵';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          width: cardSize[size].width,
          backgroundColor: colors.card,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.imageContainer,
          {
            width: imageSize[size],
            height: imageSize[size],
            backgroundColor: colors.surfaceSecondary,
          },
        ]}
      >
        {playlist.artwork ? (
          <Image
            source={{ uri: playlist.artwork }}
            style={[styles.image, { width: imageSize[size], height: imageSize[size] }]}
            resizeMode="cover"
          />
        ) : (
          <Image
            source={{ uri: 'https://raw.githubusercontent.com/viki28593/assets/main/premium_music_note.png' }}
            style={[styles.image, { width: imageSize[size], height: imageSize[size] }]}
            resizeMode="cover"
          />
        )}
      </View>
      <Text
        style={[styles.title, { color: colors.text }]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {playlist.name}
      </Text>
      <Text
        style={[styles.subtitle, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {playlist.songs.length} songs
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: Spacing.md,
    marginBottom: Spacing.md,
  },
  imageContainer: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  image: {
    borderRadius: BorderRadius.md,
  },
  placeholder: {
    textAlign: 'center',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.sm,
  },
});
