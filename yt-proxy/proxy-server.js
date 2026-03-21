// proxy-server.js - YouTube Search + Audio Proxy using Piped API
// No yt-dlp needed! Uses Piped API which handles YouTube authentication
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Piped API instances (fallback list)
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.victr.me',
  'https://pipedapi.lunar.icu',
  'https://api-piped.mha.fi',
];

let currentInstance = PIPED_INSTANCES[0];

// Helper to try different Piped instances
async function fetchWithFallback(endpoint, params = {}) {
  const errors = [];
  
  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await axios.get(`${instance}${endpoint}`, {
        params,
        timeout: 10000,
      });
      currentInstance = instance;
      return response.data;
    } catch (err) {
      errors.push(`${instance}: ${err.message}`);
    }
  }
  
  throw new Error(`All Piped instances failed: ${errors.join(', ')}`);
}

// Search YouTube videos
app.get('/search', async (req, res) => {
  const { q, limit = 10 } = req.query;
  
  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    console.log(`[Search] Query: "${q}"`);
    
    const data = await fetchWithFallback('/search', { 
      q, 
      filter: 'videos',
      limit: parseInt(limit)
    });

    const videos = (data.items || []).map((video) => ({
      id: video.id,
      title: video.title,
      thumbnail: video.thumbnail || `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`,
      duration: video.duration || 0,
      channel: video.uploaderName || video.channel,
      views: video.views,
      uploaded: video.uploadedDate,
    }));

    console.log(`[Search] Found ${videos.length} videos`);
    res.json({ videos });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get audio stream URL for a video
app.get('/audio/:videoId', async (req, res) => {
  const { videoId } = req.params;
  
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  try {
    console.log(`[Audio] Fetching: ${videoId}`);
    
    const data = await fetchWithFallback(`/streams/${videoId}`);

    if (!data.audioStreams || data.audioStreams.length === 0) {
      return res.status(404).json({ error: 'No audio stream found' });
    }

    // Sort by bitrate to get best quality
    const audioStreams = data.audioStreams.sort((a, b) => b.bitrate - a.bitrate);
    const bestAudio = audioStreams[0];

    // Also get video info
    const videoInfo = {
      url: bestAudio.url,
      title: data.title,
      thumbnail: data.thumbnailUrl,
      channel: data.uploader,
      duration: data.duration,
      bitrate: bestAudio.bitrate,
      quality: bestAudio.quality,
      codec: bestAudio.audioCodec,
    };

    console.log(`[Audio] Success: ${data.title}`);
    res.json(videoInfo);
  } catch (err) {
    console.error('Audio error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get video info
app.get('/info/:videoId', async (req, res) => {
  const { videoId } = req.params;
  
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  try {
    const data = await fetchWithFallback(`/streams/${videoId}`);
    
    res.json({
      title: data.title,
      description: data.description,
      thumbnail: data.thumbnailUrl,
      channel: data.uploader,
      views: data.views,
      duration: data.duration,
      uploadDate: data.uploadDate,
    });
  } catch (err) {
    console.error('Info error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (_, res) => {
  res.json({ 
    status: 'ok', 
    currentInstance,
    timestamp: new Date().toISOString() 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎵 YouTube Proxy running on port ${PORT}`);
  console.log(`   Using Piped API: ${currentInstance}`);
  console.log(`   - Search: GET /search?q=query`);
  console.log(`   - Audio:  GET /audio/:videoId`);
  console.log(`   - Health: GET /health`);
});
