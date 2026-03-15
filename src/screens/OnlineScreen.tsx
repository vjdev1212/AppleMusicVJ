import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks';
import { SectionHeader } from '../components';
import { Spacing, FontSize, BorderRadius } from '../constants/theme';

export const OnlineScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Online</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.placeholderContainer}>
          <Ionicons name="globe-outline" size={80} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Explore Music Online</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Connect with global music streaming services and discover new artists from around the world.
          </Text>
        </View>

        <SectionHeader title="Coming Soon" />
        <View style={styles.card}>
          <Ionicons name="radio-outline" size={24} color={colors.primary} />
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Live Radio</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>Listen to global stations 24/7</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Ionicons name="trending-up-outline" size={24} color={colors.primary} />
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Trending Charts</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>See what's hot today</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: 'bold',
  },
  content: {
    paddingBottom: Spacing.xxl,
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    marginTop: Spacing.lg,
  },
  description: {
    fontSize: FontSize.md,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  cardText: {
    marginLeft: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: FontSize.sm,
  },
});
