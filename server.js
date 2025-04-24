const express = require('express');
const axios = require('axios');
const Store = require('electron-store');
const app = express();
const store = new Store();
require('dotenv').config();

app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  if (!code) {
    res.send('No code found');
    return;
  }

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET,
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    store.set('access_token', response.data.access_token);
    store.set('refresh_token', response.data.refresh_token);
    
    console.log('Access Token saved.');
    res.send('Logged in! You can close this window.');
  } catch (error) {
    console.error('Error exchanging code for token:', error.response?.data || error.message);
    res.send('Error getting tokens.');
  }
});

app.listen(8888, () => {
  console.log('Listening on http://127.0.0.1:8888');
});