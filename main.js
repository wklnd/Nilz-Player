const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

// Define the file path for tokens
const tokensFilePath = path.join(__dirname, 'tokens.json');

// Function to read tokens from the JSON file
function getToken() {
  try {
    const tokens = JSON.parse(fs.readFileSync(tokensFilePath, 'utf-8'));
    return tokens.access_token || null;
  } catch (error) {
    console.error('Error reading tokens:', error);
    return null;
  }
}

// Function to save tokens to the JSON file
function saveToken(accessToken, refreshToken) {
  const tokens = { access_token: accessToken, refresh_token: refreshToken };
  fs.writeFileSync(tokensFilePath, JSON.stringify(tokens, null, 2), 'utf-8');
  console.log('Tokens saved successfully');
}

let mainWindow;
let loginWindow;
let loginServer;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    center: true,
    autoHideMenuBar: true,
    titelBarStyle: 'hidden',
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // NOTE: contextIsolation false only for simplicity
    },
  });

  // Get the access token from the tokens.json file
  const accessToken = getToken();

  // If access token exists, load index.html (logged in)
  const startPage = accessToken ? 'index.html' : 'login.html';
  mainWindow.loadFile(path.join(__dirname, startPage));
  mainWindow.webContents.openDevTools();
}

ipcMain.on('start-spotify-login', () => {
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;
  const scope = 'user-read-private user-read-email user-read-currently-playing user-read-playback-state user-modify-playback-state user-read-playback-position playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private streaming user-read-playback-state user-read-currently-playing';

  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${client_id}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirect_uri)}`;

  loginWindow = new BrowserWindow({
    width: 500,
    height: 700,
    show: true,
    webPreferences: {
      nodeIntegration: false,
    },
  });

  loginWindow.loadURL(authUrl);

  // Create a temporary Express server
  const app = express();
  loginServer = app.listen(8888, () => {
    console.log('Listening on http://127.0.0.1:8888');
  });

  app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    if (!code) {
      return res.status(400).send('No code found');
    }
  
    try {
      const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: 'http://127.0.0.1:8888/callback',
        client_id: '98f120c279e048b087c8a25840eddf96',
        client_secret: '77a4d140c6e64382b508d02097d29c96',
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
  
      const accessToken = response.data.access_token;
      const refreshToken = response.data.refresh_token;
  
      // Save the tokens to the JSON file
      saveToken(accessToken, refreshToken);
  
      console.log('Access Token saved.');
  
      res.send('Logged in! You can close this window.');
  
      // Close the login window
      if (loginWindow) {
        loginWindow.close();
        loginWindow = null;
      }
  
      // Load index.html in the main window
      if (mainWindow) {
        mainWindow.loadFile(path.join(__dirname, 'index.html'));
      }
  
      // Close the Express server
      if (loginServer) {
        loginServer.close(() => {
          console.log('Login server closed.');
        });
      }
    } catch (error) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      res.status(500).send('Error getting tokens.');
    }
  });
});

// Handle fetching access token
ipcMain.handle('get-access-token', async () => {
  let accessToken = getToken(); // Get the current access token
  if (!accessToken) {
    console.log('Access token expired or missing. Refreshing...');
    accessToken = await refreshAccessToken(); // Refresh the token if it's missing or expired
  }
  return accessToken;
});

ipcMain.on('window-control', (event, action) => {
  const focusedWindow = BrowserWindow.getFocusedWindow(); // Correct usage
  if (!focusedWindow) return; // Ensure a window is focused

  if (action === 'minimize') {
    focusedWindow.minimize();
  } else if (action === 'maximize') {
    if (focusedWindow.isMaximized()) {
      focusedWindow.unmaximize();
    } else {
      focusedWindow.maximize();
    }
  } else if (action === 'close') {
    focusedWindow.close();
  }
});


async function refreshAccessToken() {
  try {
    const refreshToken = store.get('refresh_token'); // Retrieve the refresh token
    if (!refreshToken) {
      console.error('No refresh token available.');
      return null;
    }

    const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET,
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const newAccessToken = response.data.access_token;
    store.set('access_token', newAccessToken); // Save the new access token
    console.log('Access token refreshed successfully.');
    return newAccessToken;
  } catch (error) {
    console.error('Error refreshing access token:', error.response?.data || error.message);
    return null;
  }
}

function startTokenRefreshInterval() {
  const refreshInterval = 55 * 60 * 1000; // Refresh every 55 minutes
  setInterval(async () => {
    const newToken = await refreshAccessToken();
    if (newToken) {
      console.log('Token refreshed and updated.');
    }
  }, refreshInterval);
}

// Call this function after the app initializes
app.whenReady().then(() => {
  createMainWindow();
  startTokenRefreshInterval(); // Start the token refresh interval
});



app.whenReady().then(createMainWindow);