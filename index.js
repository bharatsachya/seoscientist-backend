const express = require('express');
const { google } = require('googleapis');
const session = require('cookie-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

const cors = require('cors');
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));


// OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];

app.use(session({
  name: 'session',
  keys: ['secret'],
  maxAge: 24 * 60 * 60 * 1000
}));

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
  res.send('Authentication successful! You can now call /search-analytics');
  // Optionally redirect to a frontend page
  res.redirect('http://localhost:5173');
  
});

// Step 3: Query Search Console API
app.get('/search-analytics', async (req, res) => {
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
