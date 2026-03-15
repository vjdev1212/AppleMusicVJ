import React from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  HomeScreen,
  PlayerScreen,
  PlaylistScreen,
  SettingsScreen,
} from './screens';
import { Playlist } from './types';

// Define navigation types
export type RootStackParamList = {
  Home: undefined;
  Player: undefined;
  Playlist: { playlist: Playlist };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppMain() {
  const systemColorScheme = useColorScheme();
  const navigationRef = React.useRef<NavigationContainerRef<RootStackParamList>>(null);

  return (
    <NavigationContainer
      ref={navigationRef}
    >
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
