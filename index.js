const express = require('express');
const { google } = require('googleapis');
const session = require('cookie-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

const cors = require('cors');
app.use(cors({ origin: 'https://seoscientist.vercel.app', credentials: true }));

app.use(session({
  name: 'session',
  keys: ['secret'],
  maxAge: 24 * 60 * 60 * 1000,
  cookie: {
    secure: true,
    sameSite: 'None',
    domain: 'seoscientist-backend.onrender.com',
    path: '/'// important for cross-domain cookies
  }
}));

// OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];

// Step 1: Redirect user to Google login
app.get('/auth', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  res.redirect(url);
});

// Step 2: Handle Google callback
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  const { tokens } = await oauth2Client.getToken(code);
  req.session.tokens = tokens;

  // ✅ Redirect to a same-origin page to allow cookie to be set
  res.redirect('/post-auth-redirect');
});

// ✅ Step 2.5: Local page sets cookie first, then redirects to frontend
app.get('/post-auth-redirect', (req, res) => {
  res.send(`
    <html>
      <body>
        <script>
          // Now that session is set on the same domain, safely redirect to frontend
          window.location.href = 'https://seoscientist.vercel.app?auth=success';
        </script>
      </body>
    </html>
  `);
});

// Step 3: Query Search Console API
app.get('/search-analytics', async (req, res) => {
  console.log('SESSION:', req.session); // 👈 For debugging
  if (!req.session.tokens) return res.status(401).send('Not authenticated');

  oauth2Client.setCredentials(req.session.tokens);
  const searchConsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

  try {
    const response = await searchConsole.searchanalytics.query({
      siteUrl: 'https://seoscientist.agency/',
      requestBody: {
        startDate: '2025-02-09',
        endDate: '2025-05-08',
        dimensions: ['query','page', 'device', 'country'],
        rowLimit: 1000
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).send('Failed to fetch data');
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
