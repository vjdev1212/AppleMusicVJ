import React from 'react';
import { View, useColorScheme } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  HomeScreen,
  PlayerScreen,
  PlaylistScreen,
  SettingsScreen,
  DownloadScreen,
  SearchScreen,
  OnlineScreen,
} from './screens';
import { Playlist } from './types';
import { TabNavigator } from './navigation/TabNavigator';
import { useAudioPlayer } from './hooks';

// Define navigation types
export type RootStackParamList = {
  Root: undefined;
  Player: undefined;
  Playlist: { playlist: Playlist };
  Settings: undefined;
  Downloads: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppMain() {
  const systemColorScheme = useColorScheme();
  const navigationRef = React.useRef<NavigationContainerRef<RootStackParamList>>(null);
  const { currentSong } = useAudioPlayer();
  const [currentRoute, setCurrentRoute] = React.useState<string | undefined>('Root');

  const handleMiniPlayerPress = () => {
    navigationRef.current?.navigate('Player');
  };

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer
        ref={navigationRef}
        onStateChange={() => {
          const route = navigationRef.current?.getCurrentRoute();
          setCurrentRoute(route?.name);
        }}
      >
        <Stack.Navigator
          initialRouteName="Root"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="Root" component={TabNavigator} />
          <Stack.Screen 
            name="Player" 
            component={PlayerScreen}
            options={{
              animation: 'slide_from_bottom',
              presentation: 'modal',
            }}
          />
          <Stack.Screen 
            name="Playlist" 
            component={PlaylistScreen}
            options={{
              animation: 'fade',
            }}
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen 
            name="Downloads" 
            component={DownloadScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>

    </View>
  );
}
