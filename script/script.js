const { ipcRenderer } = require('electron');

let isPlaying = false;
let deviceId = null;
let currentItem = null;
let currentProgressMs = 0;

// 1. Grab your active device once at startup
async function initDevice() {
  const token = await ipcRenderer.invoke('get-access-token');
  if (!token) return;

  const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return console.error('Devices error', await res.json());

  const { devices } = await res.json();
  const active = devices.find(d => d.is_active) || devices[0];
  if (active) deviceId = active.id;
}

// 2. Core: fetch current state & render
async function refreshUI() {
  const token = await ipcRenderer.invoke('get-access-token');
  if (!token) return;

  const res = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 204) return render(null, false);
  if (!res.ok) return console.error('Playback error', await res.json());

  const { item, is_playing, progress_ms } = await res.json();
  currentItem = item; // Store the current song globally
  currentProgressMs = progress_ms; // Store the current progress globally
  render(item, is_playing);

  // Update the progress bar
  const progressBar = document.getElementById('progressBar');
  if (item) {
    progressBar.max = item.duration_ms; // Set the max to the song's duration
    progressBar.value = progress_ms;   // Set the current value to the playback position
  } else {
    progressBar.value = 0;
  }
}

// 2.5 Core: Volume init
async function initVolume() {
  const token = await ipcRenderer.invoke('get-access-token');
  if (!token) return;

  const res = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.ok) {
    const { device } = await res.json();
    const volume = device?.volume_percent || 50;
    document.getElementById('volumeSlider').value = volume;
  }
}

// Call initVolume during initialization
(async () => {
  await initDevice();
  await refreshUI();
  await initVolume();
})();

let progressInterval;

function startProgressUpdater() {
  clearInterval(progressInterval); // Clear any existing interval
  progressInterval = setInterval(() => {
    const progressBar = document.getElementById('progressBar');
    if (currentItem) {
      progressBar.max = currentItem.duration_ms; // Set the max to the song's duration
      currentProgressMs += 1000; // Increment progress by 1 second (1000 ms)
      progressBar.value = currentProgressMs; // Update the progress bar value
    } else {
      progressBar.value = 0;
    }
  }, 1000); // Update every 1 second
}

function stopProgressUpdater() {
  clearInterval(progressInterval);
}


// 3. Render helper
function render(item, playing) {
  const title = document.getElementById('songTitle');
  const artist = document.getElementById('songArtist');
  const art = document.getElementById('albumArt');
  const btn = document.getElementById('playPauseBtn');

  if (!item) {
    title.innerText = 'No song playing';
    artist.innerText = '';
    art.src = '';
    stopProgressUpdater();
  } else {
    title.innerText = item.name;
    artist.innerText = item.artists.map(a => a.name).join(', ');
    art.src = item.album.images[0]?.url || '';

    art.onload = () => {
      getDominantColor(art, (dominantColor) => {
        lastColor = dominantColor;
        startVanta(currentEffect, dominantColor);
      });
    };

    if (playing) {
      startProgressUpdater();
    } else {
      stopProgressUpdater();
    }
  }

  isPlaying = playing;
  btn.innerText = isPlaying ? '⏸' : '▶';
  btn.disabled = false;
}

// 4. Send play/pause/next/prev
let requestInFlight = false;
async function control(action) {
  if (requestInFlight) return;
  requestInFlight = true;

  const token = await ipcRenderer.invoke('get-access-token');
  if (!token) {
    requestInFlight = false;
    return;
  }

  const url = `https://api.spotify.com/v1/me/player/${action}`;
  const opts = {
    method: action === 'next' || action === 'previous' ? 'POST' : 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    ...(action !== 'next' && action !== 'previous' && {
      body: JSON.stringify({ device_ids: [deviceId] })
    })
  };

  const res = await fetch(url, opts);
  if (!res.ok) console.error(`${action} failed`, await res.json());

  // small delay so Spotify has time to actually change state
  await new Promise(r => setTimeout(r, 500));

  await refreshUI(); // TODO: If paused, refreshUI() will not update the bg
  requestInFlight = false;
}

// 5. Button wiring with optimistic UI & disable
document.getElementById('playPauseBtn').addEventListener('click', async () => {
    const btn = document.getElementById('playPauseBtn');
    if (requestInFlight) return;

    btn.disabled = true; // Disable the button to prevent multiple rapid clicks

    // Send the control request
    await control(!isPlaying ? 'play' : 'pause');

    // The refreshUI() within the control function will handle updating
    // the isPlaying state and the button icon based on the actual state.
});

document.getElementById('nextBtn').addEventListener('click', () => {
  control('next');
});
document.getElementById('prevBtn').addEventListener('click', () => {
  control('previous');
});

let debounceTimeout;

document.getElementById('volumeSlider').addEventListener('input', (event) => {
  const volume = event.target.value; // Get the volume level (0-100)

  // Clear the previous timeout
  clearTimeout(debounceTimeout);

  // Set a new timeout to delay the API call
  debounceTimeout = setTimeout(async () => {
    const token = await ipcRenderer.invoke('get-access-token');
    if (!token) return;

    const res = await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volume}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      console.error('Failed to set volume', await res.json());
    }
  }, 300); // Delay of 300ms
});

document.getElementById('progressBar').addEventListener('input', async (event) => {
  const seekPosition = event.target.value; // Get the desired position in milliseconds
  const token = await ipcRenderer.invoke('get-access-token');
  if (!token) return;

  const res = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${seekPosition}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    console.error('Failed to seek', await res.json());
  } else {
    currentProgressMs = parseInt(seekPosition, 10); // Update the global progress
  }
});

// Keyboard
document.addEventListener('keydown', async (event) => {
  if (event.code === 'Space') {
    event.preventDefault(); // Prevent the default browser behavior (e.g., scrolling)
    const btn = document.getElementById('playPauseBtn');
    if (requestInFlight) return;

    btn.disabled = true; // Disable the button to prevent multiple rapid actions

    // Toggle play/pause
    await control(!isPlaying ? 'play' : 'pause');

    // The refreshUI() within the control function will handle updating
    // the isPlaying state and the button icon based on the actual state.
  } else if (event.code === 'ArrowRight') {
    // Skip to the next track
    control('next');
  } else if (event.code === 'ArrowLeft') {
    // Go to the previous track
    control('previous');
  }
});

// Hide/Show UI elements with CTRL + H
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.code === 'KeyH') {
    event.preventDefault(); // Prevent default behavior for CTRL + H

    // Get the player container, controls, song details, and effect selector
    const playerContainer = document.getElementById('playerContainer');
    const controls = document.querySelectorAll('.control, #playPauseBtn, #nextBtn, #prevBtn, #volumeSlider');
    const songDetails = document.getElementById('songDetails');
    const effectSelector = document.getElementById('effectSelector');
    const progressBar = document.getElementById('progressBar');

    if (playerContainer) {
      // Toggle visibility of controls
      controls.forEach(control => {
        control.classList.toggle('hidden');
      });

      // Hide song details
      if (songDetails) {
        songDetails.classList.toggle('hidden');
      }

      if(progressBar) {
        progressBar.classList.toggle('hidden');
      }

      // Hide effect selector
      if (effectSelector) {
        effectSelector.classList.toggle('hidden');
      }

      // Ensure the album cover remains visible
      const albumArt = document.getElementById('albumArt');
      if (albumArt) {
        albumArt.classList.toggle('visible-only');
      }
    }
  }
});

// 6. Init on load
(async () => {
  await initDevice();
  await refreshUI();
  await initVolume();
})();