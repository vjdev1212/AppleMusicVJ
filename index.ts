import 'react-native-gesture-handler';
import { Buffer } from 'buffer';
import process from 'process';

// Polyfills for music-metadata and other node-based libs
global.Buffer = Buffer;
global.process = process;
if (!global.process.nextTick) {
  global.process.nextTick = (fn, ...args) => setImmediate(() => fn(...args));
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
