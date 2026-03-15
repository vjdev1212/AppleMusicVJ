// Apple Music style theme constants

export const Colors = {
  light: {
    primary: '#FF2D55',
    secondary: '#AF52DE',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    surfaceSecondary: '#E5E5EA',
    text: '#000000',
    textSecondary: '#8E8E93',
    textTertiary: '#C7C7CC',
    border: '#C6C6C8',
    tabBar: '#F9F9F9',
    card: '#FFFFFF',
    miniPlayer: 'rgba(255, 255, 255, 0.95)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    gradientStart: '#FF2D55',
    gradientEnd: '#FF9500',
    playerBackground: '#F2F2F7',
  },
  dark: {
    primary: '#FF375F',
    secondary: '#BF5AF2',
    background: '#000000',
    surface: '#1C1C1E',
    surfaceSecondary: '#2C2C2E',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    textTertiary: '#48484A',
    border: '#38383A',
    tabBar: '#1C1C1E',
    card: '#1C1C1E',
    miniPlayer: 'rgba(28, 28, 30, 0.95)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    gradientStart: '#FF375F',
    gradientEnd: '#FF9F0A',
    playerBackground: '#1C1C1E',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 9999,
};

export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 34,
};

export const IconSize = {
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
  xxl: 44,
};

export const Animation = {
  fast: 150,
  normal: 300,
  slow: 500,
};

export const PlayerColors = {
  light: {
    gradient: ['#FF2D55', '#FF9500', '#FFCC00'],
    progress: '#FF2D55',
    progressBackground: '#E5E5EA',
  },
  dark: {
    gradient: ['#FF375F', '#FF9F0A', '#FFD60A'],
    progress: '#FF375F',
    progressBackground: '#38383A',
  },
};

// Default placeholder images
export const Placeholders = {
  albumArtwork: 'https://via.placeholder.com/300x300/1C1C1E/FFFFFF?text=Music',
  playlistArtwork: 'https://via.placeholder.com/300x300/FF2D55/FFFFFF?text=Playlist',
};
