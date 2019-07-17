import fs = require('fs');
import readline = require('readline');
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const SCOPE = 'https://www.googleapis.com/auth/drive';
const TOKEN_PATH = './credentials.json';

/**
 * Authorize a client with credentials, then call the Google Drive API.
 * @param {function} callback The callback to call with the authorized client.
 */
export function call(callback: (err: string, client: OAuth2Client) => void): void {
  // Load client secrets from a local file.
  fs.readFile('./client_secret.json', 'utf8', (err, content) => {
    if (err) {
      console.log('Error loading client secret file:', err.message);
      callback(err.message, null);
    } else {
      authorize(JSON.parse(content), callback);
    }
  });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials: any, callback: (err: string, client: OAuth2Client) => void): void {
  const clientSecret = credentials.installed.client_secret;
  const clientId = credentials.installed.client_id;
  const redirectUris = credentials.installed.redirect_uris;
  const oAuth2Client = new google.auth.OAuth2(
    clientId, clientSecret, redirectUris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, 'utf8', (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(null, oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client: OAuth2Client, callback: (err: string, client: OAuth2Client) => void): void {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPE
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return callback(err.message, null);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(null, oAuth2Client);
    });
  });
}
