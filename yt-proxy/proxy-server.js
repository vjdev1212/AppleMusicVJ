// proxy-server.js - Improved version
const express = require('express');
const ytDlp = require('yt-dlp-exec');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/audio/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  try {
    // Get direct audio URL with best quality
    const result = await ytDlp(`https://www.youtube.com/watch?v=${videoId}`, {
      noWarnings: true,
      noCallHome: true,
      format: 'bestaudio[ext=m4a]/bestaudio/best',
      getUrl: true,  // This gets direct URL instead of JSON
    });

    // ytDlp with getUrl returns direct URL string
    if (result && typeof result === 'string' && result.startsWith('http')) {
      return res.json({ url: result, title: videoId });
    }

    // Fallback: try JSON mode
    const jsonResult = await ytDlp(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      format: 'bestaudio[ext=m4a]/bestaudio/best',
    });

    // Try to find direct audio URL in formats
    const audioFormat = jsonResult.formats?.find((f) => f.audioCodec && f.url);
    if (audioFormat?.url) {
      return res.json({ url: audioFormat.url, title: jsonResult.title });
    }

    return res.status(404).json({ error: 'No audio stream found' });
  } catch (err) {
    console.error('yt-dlp error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
