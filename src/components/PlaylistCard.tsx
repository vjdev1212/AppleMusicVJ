import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks';
import { Spacing, BorderRadius, FontSize } from '../constants/theme';
import { Playlist } from '../types';

interface PlaylistCardProps {
  playlist: Playlist;
  onPress: () => void;
  onDownload?: (quality: 'high' | 'medium' | 'low') => void;
  size?: 'small' | 'medium' | 'large';
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  onPress,
  onDownload,
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

  const isOffline = playlist.isOffline;

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
        <Image
          source={
            playlist.artwork 
              ? { uri: playlist.artwork } 
              : require('../../assets/icon.png')
          }
          defaultSource={require('../../assets/icon.png')}
          style={[styles.image, { width: imageSize[size], height: imageSize[size] }]}
          resizeMode="cover"
        />
        {/* Download Icon */}
        <TouchableOpacity 
          style={styles.downloadButton}
          onPress={() => {
            if (onDownload) {
              Alert.alert(
                'Download Quality',
                'Select the audio quality for your offline songs:',
                [
                  { text: 'High (320kbps)', onPress: () => onDownload('high') },
                  { text: 'Medium (128kbps)', onPress: () => onDownload('medium') },
                  { text: 'Low (64kbps)', onPress: () => onDownload('low') },
                  { text: 'Cancel', style: 'cancel' }
                ],
                { cancelable: true }
              );
            }
          }}
        >
          <Ionicons name="download-outline" size={20} color="#fff" />
        </TouchableOpacity>
        {isOffline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineBadgeText}>OFFLINE</Text>
          </View>
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
  offlineBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  offlineBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
  },
  downloadButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});
