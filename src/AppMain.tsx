import React from 'react';
import { View, useColorScheme } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  HomeScreen,
  PlayerScreen,
  PlaylistScreen,
  SettingsScreen,
  SearchScreen,
  OnlineScreen,
} from './screens';
import { Playlist } from './types';
import { TabNavigator } from './navigation/TabNavigator';
import { MiniPlayer } from './components';
import { useAudioPlayer } from './hooks';

// Define navigation types
export type RootStackParamList = {
  MainTabs: undefined;
  Player: undefined;
  Playlist: { playlist: Playlist };
  Settings: undefined;
  Search: undefined;
  Online: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppMain() {
  const systemColorScheme = useColorScheme();
  const navigationRef = React.useRef<NavigationContainerRef<RootStackParamList>>(null);
  const { currentSong } = useAudioPlayer();

  const handleMiniPlayerPress = () => {
    navigationRef.current?.navigate('Player');
  };

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer
        ref={navigationRef}
      >
        <Stack.Navigator
          initialRouteName="MainTabs"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="MainTabs" component={TabNavigator} />
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
      
      {currentSong && (
        <View style={{ position: 'absolute', bottom: 60, left: 0, right: 0 }}>
          <MiniPlayer onPress={handleMiniPlayerPress} />
        </View>
      )}
    </View>
  );
}
