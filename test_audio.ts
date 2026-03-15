import { createAudioPlayer } from 'expo-audio';

const player = createAudioPlayer('http://example.com/audio.mp3');
player.addListener('playbackStatusUpdate', (status) => {
    console.log(status);
});
