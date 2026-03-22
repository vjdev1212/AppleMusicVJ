import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { StyleSheet, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeScreen, SearchScreen, OnlineScreen, SettingsScreen, OfflineScreen } from '../screens';
import { useTheme } from '../hooks';
import { BorderRadius } from '../constants/theme';

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  YouTube: undefined;
  Offline: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

// Custom Tab Bar Background Component
const TabBarBackground = ({ isDark }: { isDark: boolean }) => (
  <BlurView
    intensity={isDark ? 80 : 100}
    tint={isDark ? 'dark' : 'light'}
    style={StyleSheet.absoluteFill}
  />
);

export const TabNavigator = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarTransparent: true,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: isDark ? 'rgba(20, 20, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            height: 65 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? 0 : 8,
            borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderTopWidth: 0.5,
          },
        ],
        tabBarBackground: () => <TabBarBackground isDark={isDark} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'YouTube') {
            iconName = focused ? 'logo-youtube' : 'logo-youtube';
          } else if (route.name === 'Offline') {
            iconName = focused ? 'cloud-offline' : 'cloud-offline-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'musical-notes';
          }

          return (
            <View style={styles.iconContainer}>
              <Ionicons name={iconName} size={24} color={color} />
              {focused && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Search',
          tabBarLabel: 'Search',
        }}
      />
      <Tab.Screen
        name="YouTube"
        component={OnlineScreen}
        options={{
          title: 'YouTube',
          tabBarLabel: 'YouTube',
        }}
      />
      <Tab.Screen
        name="Offline"
        component={OfflineScreen}
        options={{
          title: 'Offline',
          tabBarLabel: 'Downloads',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
    }),
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 28,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
