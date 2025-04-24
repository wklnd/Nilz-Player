document.getElementById('minimizeBtn').addEventListener('click', () => {
    ipcRenderer.send('window-control', 'minimize');
});

document.getElementById('maximizeBtn').addEventListener('click', () => {
    ipcRenderer.send('window-control', 'maximize');
});

document.getElementById('closeBtn').addEventListener('click', () => {
    ipcRenderer.send('window-control', 'close');
});