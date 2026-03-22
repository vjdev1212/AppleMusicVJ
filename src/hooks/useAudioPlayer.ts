import { useEffect, useCallback } from 'react';
import { audioService } from '../services/audioService';
import { usePlayerStore, usePlaylistStore } from '../store/store_index';
import { Song } from '../types';

export const useAudioPlayer = () => {
  // ─── Granular selectors — each only re-renders when ITS value changes ────
  // Previously the whole hook subscribed to the full store, so every
  // currentTime tick (500 ms) caused every consumer to re-render.
  const currentSong = usePlayerStore(s => s.currentSong);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const currentTime = usePlayerStore(s => s.currentTime);
  const duration = usePlayerStore(s => s.duration);
  const queue = usePlayerStore(s => s.queue);
  const queueIndex = usePlayerStore(s => s.queueIndex);
  const shuffle = usePlayerStore(s => s.shuffle);
  const repeat = usePlayerStore(s => s.repeat);
  const volume = usePlayerStore(s => s.volume);

  // Store actions — these are stable references, safe to destructure
  const {
    setCurrentSong,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    playNext,
    playPrevious,
    setShuffle,
    setRepeat,
    setVolume,
  } = usePlayerStore.getState();

  const { addToRecentlyPlayed } = usePlaylistStore.getState();

  useEffect(() => {
    audioService.initialize();
    // Do NOT unload on unmount — audio must keep playing in background
  }, []);

  // ─── play / pause ─────────────────────────────────────────────────────────
  const play = useCallback(() => {
    audioService.play(); // state written synchronously inside audioService
  }, []);

  const pause = useCallback(() => {
    audioService.pause(); // state written synchronously inside audioService
  }, []);

  // Key fix: read isPlaying directly from store state at call-time instead of
  // closing over the stale hook value. This removes one full render cycle.
  const togglePlayPause = useCallback(() => {
    // play() and pause() now write isPlaying to the store immediately
    // (synchronously, before any await) so the icon flips on the same frame.
    // The status callback no longer owns isPlaying so there is no race.
    const playing = usePlayerStore.getState().isPlaying;
    if (playing) {
      audioService.pause();  // fire-and-forget — state already written inside
    } else {
      audioService.play();   // fire-and-forget — state already written inside
    }
  }, []);

  // ─── load ─────────────────────────────────────────────────────────────────
  const loadSong = useCallback(async (song: Song) => {
    // audioService.loadAndPlay() now sets currentSong, isPlaying:true,
    // currentTime:0, duration:0 immediately at its start — no need to
    // duplicate those writes here which caused a render before the audio
    // service had a chance to do it.
    await audioService.loadAndPlay(song);
    usePlaylistStore.getState().addToRecentlyPlayed(song);
  }, []);

  const loadPlaylist = useCallback(async (songs: Song[], startIndex: number = 0) => {
    if (songs.length === 0) return;
    usePlayerStore.setState({ queue: songs, queueIndex: startIndex });
    await loadSong(songs[startIndex]);
  }, [loadSong]);

  // ─── seek ─────────────────────────────────────────────────────────────────
  const seekTo = useCallback(async (position: number) => {
    await audioService.seekTo(position);
    usePlayerStore.setState({ currentTime: position });
  }, []);

  // ─── skip ─────────────────────────────────────────────────────────────────
  const skipToNext = useCallback(async () => {
    playNext();
    const { currentSong: song } = usePlayerStore.getState();
    if (song) await audioService.loadAndPlay(song);
  }, [playNext]);

  const skipToPrevious = useCallback(async () => {
    playPrevious();
    const { currentSong: song } = usePlayerStore.getState();
    if (song) await audioService.loadAndPlay(song);
  }, [playPrevious]);

  // ─── shuffle / repeat / volume ────────────────────────────────────────────
  const toggleShuffle = useCallback(() => {
    const current = usePlayerStore.getState().shuffle;
    setShuffle(!current);
  }, [setShuffle]);

  const toggleRepeat = useCallback(() => {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const current = usePlayerStore.getState().repeat;
    const next = modes[(modes.indexOf(current) + 1) % modes.length];
    setRepeat(next);
  }, [setRepeat]);

  const updateVolume = useCallback(async (newVolume: number) => {
    await audioService.setVolume(newVolume);
    setVolume(newVolume);
  }, [setVolume]);

  // ─── stop ─────────────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    await audioService.unload();
    usePlayerStore.setState({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    });
  }, []);

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
    stop,
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