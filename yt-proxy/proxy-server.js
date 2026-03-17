// proxy-server.js
// Deploy this on Render.com (free tier) or Railway.
//
// Setup:
//   npm init -y
//   npm install express yt-dlp-exec cors
//   node proxy-server.js
//
// On Render: set Start Command to "node proxy-server.js"
// yt-dlp binary is auto-downloaded by yt-dlp-exec on first run.

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
    const result = await ytDlp(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
      format: 'bestaudio[ext=m4a]/bestaudio/best',
    });

    const url = result.url || result.formats?.find((f) => f.acodec !== 'none')?.url;
    if (!url) return res.status(404).json({ error: 'No audio stream found' });

    res.json({ url, title: result.title, duration: result.duration });
  } catch (err) {
    console.error('yt-dlp error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));

// Add to proxy-server.js — self-ping every 14 minutes to prevent Render sleep
const https = require('https');
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
  setInterval(() => {
    https.get(`${RENDER_URL}/health`, (r) => {
      console.log('Self-ping:', r.statusCode);
    }).on('error', (e) => console.warn('Self-ping failed:', e.message));
  }, 14 * 60 * 1000); // every 14 minutes
}
