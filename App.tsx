import React, { useEffect, useState } from 'react';
import { StatusBar, View, ActivityIndicator, StyleSheet, Text, Image } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Simple loading screen
function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <Image 
        source={require('./assets/icon.png')} 
        style={{ width: 120, height: 120, borderRadius: 24, marginBottom: 20 }} 
      />
      <ActivityIndicator size="large" color="#FF2D55" />
      <Text style={styles.loadingText}>Loading Apple Music...</Text>
    </View>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait for runtime to initialize
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <LoadingScreen />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // Lazy load the main app after runtime is ready
  const MainApp = require('./src/AppMain').default;
  
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <MainApp />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  loadingText: {
    color: '#000',
    marginTop: 16,
    fontSize: 16,
  },
});
