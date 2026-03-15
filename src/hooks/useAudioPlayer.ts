import { useEffect, useCallback } from 'react';
import { audioService } from '../services/audioService';
import { usePlayerStore, usePlaylistStore } from '../store';
import { Song } from '../types';

export const useAudioPlayer = () => {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    queue,
    queueIndex,
    shuffle,
    repeat,
    volume,
    setCurrentSong,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    playNext,
    playPrevious,
    setShuffle,
    setRepeat,
    setVolume,
  } = usePlayerStore();

  const { addToRecentlyPlayed } = usePlaylistStore();

  useEffect(() => {
    // Initialize audio service
    audioService.initialize();

    // Callbacks are now natively linked to Zustand in AudioService directly!


    return () => {
      // audioService.unload(); // Do not unload on unmount so audio plays in the background
    };
  }, []);

  const play = useCallback(async () => {
    await audioService.play();
    setIsPlaying(true);
  }, [setIsPlaying]);

  const pause = useCallback(async () => {
    await audioService.pause();
    setIsPlaying(false);
  }, [setIsPlaying]);

  const togglePlayPause = useCallback(async () => {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  const loadSong = useCallback(async (song: Song) => {
    setCurrentSong(song);
    setCurrentTime(0);
    setDuration(0);
    
    await audioService.loadAndPlay(song);
    setIsPlaying(true);
    
    // Add to recently played
    addToRecentlyPlayed(song);
  }, [setCurrentSong, setCurrentTime, setDuration, setIsPlaying, addToRecentlyPlayed]);

  const loadPlaylist = useCallback(async (songs: Song[], startIndex: number = 0) => {
    if (songs.length === 0) return;
    
    usePlayerStore.setState({ queue: songs, queueIndex: startIndex });
    await loadSong(songs[startIndex]);
  }, [loadSong]);

  const seekTo = useCallback(async (position: number) => {
    await audioService.seekTo(position);
    setCurrentTime(position);
  }, [setCurrentTime]);

  const skipToNext = useCallback(async () => {
    playNext();
    const { currentSong: song } = usePlayerStore.getState();
    if (song) {
      await audioService.loadAndPlay(song);
    }
  }, [playNext]);

  const skipToPrevious = useCallback(async () => {
    playPrevious();
    const { currentSong: song } = usePlayerStore.getState();
    if (song) {
      await audioService.loadAndPlay(song);
    }
  }, [playPrevious]);

  const toggleShuffle = useCallback(() => {
    setShuffle(!shuffle);
  }, [shuffle, setShuffle]);

  const toggleRepeat = useCallback(() => {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeat);
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeat(modes[nextIndex]);
  }, [repeat, setRepeat]);

  const updateVolume = useCallback(async (newVolume: number) => {
    await audioService.setVolume(newVolume);
    setVolume(newVolume);
  }, [setVolume]);

  return {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    queue,
    queueIndex,
    shuffle,
    repeat,
    volume,
    play,
    pause,
    togglePlayPause,
    loadSong,
    loadPlaylist,
    seekTo,
    skipToNext,
    skipToPrevious,
    toggleShuffle,
    toggleRepeat,
    updateVolume,
  };
};
