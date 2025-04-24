const fs = require('fs');
const path = require('path');

const tokenFilePath = path.join(__dirname, 'token.json');

// Function to save the token
function saveToken(token) {
  const data = JSON.stringify({ access_token: token }, null, 2);
  fs.writeFileSync(tokenFilePath, data);
}

// Function to get the token
function getToken() {
  if (fs.existsSync(tokenFilePath)) {
    const rawData = fs.readFileSync(tokenFilePath);
    const tokenData = JSON.parse(rawData);
    return tokenData.access_token;
  }
  return null; // No token found
}

module.exports = { saveToken, getToken };