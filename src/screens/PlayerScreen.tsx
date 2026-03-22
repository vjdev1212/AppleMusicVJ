import React, { useState, memo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, Dimensions, Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../hooks';
import { usePlayerStore } from '../store/store_index';
import { audioService } from '../services/audioService';
import { Spacing, FontSize } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARTWORK_SIZE = SCREEN_WIDTH - 60;

// ─── Source Badge — pure props, never re-renders unless source changes ────────
const SourceBadge: React.FC<{ source?: string }> = memo(({ source }) => {
  const isOffline = source === 'offline';
  const isYoutube = source === 'youtube';
  const icon  = isOffline ? 'cloud-offline' : isYoutube ? 'logo-youtube' : 'cloud-done';
  const label = isOffline ? 'Offline' : isYoutube ? 'YouTube' : 'Online';
  const bg    = isOffline ? 'rgba(255,149,0,0.18)' : isYoutube ? 'rgba(255,0,0,0.18)' : 'rgba(52,199,89,0.18)';
  const color = isOffline ? '#FF9500' : isYoutube ? '#FF0000' : '#34C759';
  return (
    <View style={[styles.sourceBadge, { backgroundColor: bg, borderColor: color + '55' }]}>
      <Ionicons name={icon as any} size={11} color={color} />
      <Text style={[styles.sourceBadgeText, { color }]}>{label}</Text>
    </View>
  );
});

// ─── Progress — ONLY component that subscribes to currentTime ─────────────────
const ProgressSection: React.FC = memo(() => {
  const currentTime = usePlayerStore(s => s.currentTime);
  const duration    = usePlayerStore(s => s.duration);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue,  setDragValue]  = useState(0);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.progressWrap}>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration || 1}
        value={isDragging ? dragValue : currentTime}
        onSlidingStart={() => setIsDragging(true)}
        onValueChange={setDragValue}
        onSlidingComplete={val => {
          setIsDragging(false);
          audioService.seekTo(val);
        }}
        minimumTrackTintColor="#FF0000"
        maximumTrackTintColor="rgba(255,255,255,0.2)"
        thumbTintColor="#FF0000"
      />
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{fmt(isDragging ? dragValue : currentTime)}</Text>
        <Text style={styles.timeText}>{fmt(duration)}</Text>
      </View>
    </View>
  );
});

// ─── Play/Pause — only subscribes to isPlaying ───────────────────────────────
const PlayPauseButton: React.FC<{ onPress: () => void }> = memo(({ onPress }) => {
  const isPlaying = usePlayerStore(s => s.isPlaying);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.playBtn}>
      <Ionicons
        name={isPlaying ? 'pause' : 'play'}
        size={46} color="#000"
        style={isPlaying ? undefined : { marginLeft: 4 }}
      />
    </TouchableOpacity>
  );
});

// ─── Shuffle — only subscribes to shuffle ────────────────────────────────────
const ShuffleBtn: React.FC<{ onPress: () => void }> = memo(({ onPress }) => {
  const shuffle = usePlayerStore(s => s.shuffle);
  return (
    <TouchableOpacity onPress={onPress} style={styles.sideBtn}
      hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
      <Ionicons name="shuffle" size={24}
        color={shuffle ? '#FF0000' : 'rgba(255,255,255,0.6)'} />
    </TouchableOpacity>
  );
});

// ─── Repeat — only subscribes to repeat ──────────────────────────────────────
const RepeatBtn: React.FC<{ onPress: () => void }> = memo(({ onPress }) => {
  const repeat = usePlayerStore(s => s.repeat);
  return (
    <TouchableOpacity onPress={onPress} style={styles.sideBtn}
      hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
      <Ionicons
        name={'repeat' as any} size={24}
        color={repeat !== 'off' ? '#FF0000' : 'rgba(255,255,255,0.6)'}
      />
      {repeat === 'one' && <Text style={styles.repeatDot}>1</Text>}
    </TouchableOpacity>
  );
});

// ─── PlayerScreen — ONLY re-renders when currentSong changes ─────────────────
export const PlayerScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();

  // Single subscription — renders only when song changes
  const currentSong = usePlayerStore(s => s.currentSong);
  const [showMenu, setShowMenu] = useState(false);

  // ── All actions read store state at call time — no closures over state ─────
  const onTogglePlay = useCallback(() => {
    if (usePlayerStore.getState().isPlaying) {
      audioService.pause();
    } else {
      audioService.play();
    }
  }, []);

  const onNext = useCallback(() => {
    usePlayerStore.getState().playNext();
    const next = usePlayerStore.getState().currentSong;
    if (next) audioService.loadAndPlay(next);
  }, []);

  const onPrev = useCallback(() => {
    usePlayerStore.getState().playPrevious();
    const prev = usePlayerStore.getState().currentSong;
    if (prev) audioService.loadAndPlay(prev);
  }, []);

  const onShuffle = useCallback(() => {
    const { shuffle, setShuffle } = usePlayerStore.getState();
    setShuffle(!shuffle);
  }, []);

  const onRepeat = useCallback(() => {
    const modes: Array<'off'|'all'|'one'> = ['off','all','one'];
    const { repeat, setRepeat } = usePlayerStore.getState();
    setRepeat(modes[(modes.indexOf(repeat) + 1) % modes.length]);
  }, []);

  if (!currentSong) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#1a0000','#000000']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.noSongWrap}>
          <Ionicons name="musical-notes-outline" size={56} color="rgba(255,0,0,0.35)" />
          <Text style={styles.noSongText}>No song playing</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2a0000','#120000','#000000']}
        start={{ x:0.5, y:0 }} end={{ x:0.5, y:1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() && navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top:12, bottom:12, left:12, right:12 }}
        >
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>PLAYING FROM</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentSong.source === 'youtube' ? 'YouTube Music' : 'Your Library'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setShowMenu(true)}
          hitSlop={{ top:12, bottom:12, left:12, right:12 }}
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Artwork */}
      <View style={styles.artworkSection}>
        <View style={styles.artworkCard}>
          <Image
            source={currentSong.artwork ? { uri: currentSong.artwork } : require('../../assets/icon.png')}
            defaultSource={require('../../assets/icon.png')}
            style={styles.artworkImg}
            resizeMode="cover"
          />
        </View>
      </View>

      {/* Song info */}
      <View style={styles.infoRow}>
        <View style={styles.infoText}>
          <Text style={styles.songTitle} numberOfLines={1}>{currentSong.title}</Text>
          <Text style={styles.songArtist} numberOfLines={1}>{currentSong.artist}</Text>
        </View>
        <TouchableOpacity style={styles.likeBtn} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
          <Ionicons name="heart-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Progress — isolated, only this re-renders on ticks */}
      <ProgressSection />

      {/* Controls */}
      <View style={styles.controls}>
        <ShuffleBtn    onPress={onShuffle} />
        <TouchableOpacity onPress={onPrev}
          hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
          <Ionicons name="play-skip-back" size={36} color="#fff" />
        </TouchableOpacity>
        <PlayPauseButton onPress={onTogglePlay} />
        <TouchableOpacity onPress={onNext}
          hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
          <Ionicons name="play-skip-forward" size={36} color="#fff" />
        </TouchableOpacity>
        <RepeatBtn onPress={onRepeat} />
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <SourceBadge source={currentSong.source} />
      </View>

      {/* Menu */}
      <Modal visible={showMenu} transparent animationType="slide"
        onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menuSheet}>
            <View style={styles.menuDragRow}>
              <View style={styles.menuDragHandle} />
            </View>
            <View style={[styles.menuPreview, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
              <View style={styles.menuThumb}>
                <Image
                  source={currentSong.artwork ? { uri: currentSong.artwork } : require('../../assets/icon.png')}
                  style={styles.menuThumbImg} resizeMode="cover"
                />
              </View>
              <View style={styles.menuSongText}>
                <Text style={styles.menuSongTitle} numberOfLines={1}>{currentSong.title}</Text>
                <Text style={styles.menuSongArtist} numberOfLines={1}>{currentSong.artist}</Text>
              </View>
              <SourceBadge source={currentSong.source} />
            </View>
            {[
              { icon:'heart-outline',              label:'Add to Favorites' },
              { icon:'list',                       label:'Add to Playlist' },
              { icon:'share-outline',              label:'Share' },
              { icon:'information-circle-outline', label:'Song Info' },
              { icon:'albums-outline',             label:'Go to Album' },
            ].map((item, i) => (
              <TouchableOpacity key={i} style={styles.menuItem}
                onPress={() => setShowMenu(false)} activeOpacity={0.7}>
                <View style={styles.menuItemIcon}>
                  <Ionicons name={item.icon as any} size={20} color="#FF0000" />
                </View>
                <Text style={styles.menuItemText}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#000' },
  noSongWrap: { flex:1, justifyContent:'center', alignItems:'center', gap:12 },
  noSongText: { color:'rgba(255,255,255,0.4)', fontSize: FontSize.lg, fontWeight:'600' },

  header:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  headerBtn:    { width:44, height:44, justifyContent:'center', alignItems:'center' },
  headerCenter: { flex:1, alignItems:'center' },
  headerLabel:  { color:'rgba(255,255,255,0.45)', fontSize:10, fontWeight:'700', letterSpacing:1.2, marginBottom:2 },
  headerTitle:  { color:'#fff', fontSize:14, fontWeight:'600' },

  artworkSection: { flex:1, justifyContent:'center', alignItems:'center', paddingHorizontal: Spacing.lg },
  artworkCard: {
    width: ARTWORK_SIZE, height: ARTWORK_SIZE, borderRadius:20, overflow:'hidden',
    shadowColor:'#000', shadowOffset:{width:0,height:16}, shadowOpacity:0.7, shadowRadius:30, elevation:20,
  },
  artworkImg: { width:'100%', height:'100%' },

  infoRow:    { flexDirection:'row', alignItems:'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  infoText:   { flex:1 },
  songTitle:  { color:'#fff', fontSize:22, fontWeight:'700', marginBottom:4, letterSpacing:-0.3 },
  songArtist: { color:'rgba(255,255,255,0.55)', fontSize:15, fontWeight:'500' },
  likeBtn:    { marginLeft: Spacing.md, padding:4 },

  progressWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  slider:       { width:'100%', height:30 },
  timeRow:      { flexDirection:'row', justifyContent:'space-between', marginTop:-4 },
  timeText:     { color:'rgba(255,255,255,0.4)', fontSize:12, fontWeight:'500' },

  controls: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  sideBtn:  { width:44, height:44, justifyContent:'center', alignItems:'center' },
  playBtn: {
    width:82, height:82, borderRadius:41, backgroundColor:'#fff',
    justifyContent:'center', alignItems:'center',
    shadowColor:'#fff', shadowOffset:{width:0,height:4}, shadowOpacity:0.18, shadowRadius:10, elevation:8,
  },
  repeatDot: { position:'absolute', top:8, right:6, color:'#FF0000', fontSize:9, fontWeight:'900' },

  footer: { alignItems:'center', paddingTop: Spacing.sm },

  sourceBadge:     { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:6, borderRadius:20, borderWidth:1 },
  sourceBadgeText: { fontSize:12, fontWeight:'700', letterSpacing:0.3 },

  menuOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'flex-end' },
  menuSheet:   { backgroundColor:'#1a0000', borderTopLeftRadius:24, borderTopRightRadius:24, paddingBottom:40 },
  menuDragRow: { alignItems:'center', paddingVertical:10 },
  menuDragHandle: { width:36, height:4, borderRadius:2, backgroundColor:'rgba(255,255,255,0.2)' },
  menuPreview: { flexDirection:'row', alignItems:'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth:1, marginBottom: Spacing.sm, gap: Spacing.md },
  menuThumb:      { width:52, height:52, borderRadius:10, overflow:'hidden', flexShrink:0 },
  menuThumbImg:   { width:'100%', height:'100%' },
  menuSongText:   { flex:1 },
  menuSongTitle:  { color:'#fff', fontSize: FontSize.md, fontWeight:'600', marginBottom:2 },
  menuSongArtist: { color:'rgba(255,255,255,0.45)', fontSize: FontSize.sm },
  menuItem: { flexDirection:'row', alignItems:'center', paddingHorizontal: Spacing.lg, paddingVertical:13, gap: Spacing.md },
  menuItemIcon: { width:38, height:38, borderRadius:10, backgroundColor:'rgba(255,0,0,0.12)', justifyContent:'center', alignItems:'center' },
  menuItemText: { flex:1, color:'#fff', fontSize: FontSize.md, fontWeight:'500' },
});