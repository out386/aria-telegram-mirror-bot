import fs = require('fs');
import readline = require('readline');
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import http = require('http');
import url = require('url');

const SCOPE = 'https://www.googleapis.com/auth/drive';
const TOKEN_PATH = './credentials.json';
const AUTH_LISTEN_URL = 'http://localhost:6590/tg-m-bot-oauth';

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
  const creds = credentials.web;
  if (creds) {
    const invalidRedirectUri = `Missing redirect_uris, or wrong endpoint. While creating a client ID in the
      Cloud Console, make sure you add "http://localhost/tg-m-bot-oauth:6590" in the Authorized redirect URIs section.`;
    const clientSecret = creds.client_secret;
    const clientId = creds.client_id;
    const redirectUris = creds.redirect_uris;

    if (redirectUris && redirectUris.length > 0 && redirectUris[0] === AUTH_LISTEN_URL) {
      const oAuth2Client = new google.auth.OAuth2(
        clientId, clientSecret, redirectUris[0]);

      // Check if we have previously stored a token.
      fs.readFile(TOKEN_PATH, 'utf8', (err, token) => {
        if (err) return getAccessToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(null, oAuth2Client);
      });
    } else {
      throw new Error(invalidRedirectUri);
    }
  } else {
    throw new Error('Malformed client_secret.json. Please check the the README and client_secret.json');
  }
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


  const server = http
    .createServer(async (req, res) => {
      if (req.url.indexOf('/tg-m-bot-oauth') > -1) {
        const qs = new url.URL(req.url, AUTH_LISTEN_URL)
          .searchParams;
        if (qs && qs.get('code')) {
          res.end(
            'Authentication successful! Please return to the console.'
          );
          server.close();

          const tokenResp = await oAuth2Client.getToken(qs.get('code'));
          console.log(tokenResp.tokens);
          oAuth2Client.setCredentials(tokenResp.tokens);
          // Store the token to disk for later program executions
          fs.writeFile(TOKEN_PATH, JSON.stringify(tokenResp.tokens), (err) => {
            if (err) console.error(err.message);
            console.log('Token stored to', TOKEN_PATH);
          });
          callback(null, oAuth2Client);
        } else {
          res.end('Invalid code');
        }
      } else {
        res.statusCode = 404;
        res.end();
      }
    }).listen(6590, "localhost", () => console.log("Waiting for code"));

}
