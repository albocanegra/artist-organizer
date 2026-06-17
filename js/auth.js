// OAuth authentication (Spotify + YouTube Music via Google)

import { generateRandomString, sha256, base64encode } from './utils.js';
import {
  PROVIDERS,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_SCOPES,
  YOUTUBE_CLIENT_ID,
  YOUTUBE_SCOPES,
} from './config.js';

const PROVIDER_CONFIG = {
  [PROVIDERS.SPOTIFY]: {
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    clientId: SPOTIFY_CLIENT_ID,
    scope: SPOTIFY_SCOPES,
    tokenKey: 'spotify_access_token',
    expiryKey: 'spotify_token_expiry',
    refreshKey: 'spotify_refresh_token',
  },
  [PROVIDERS.YOUTUBE]: {
    clientId: YOUTUBE_CLIENT_ID,
    scope: YOUTUBE_SCOPES,
    tokenKey: 'youtube_access_token',
    expiryKey: 'youtube_token_expiry',
  },
};

let googleScriptPromise = null;

function getProviderConfig(provider) {
  const config = PROVIDER_CONFIG[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);
  return config;
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

// Derive redirect URI from the current page (Spotify OAuth).
export function getRedirectUri() {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/index\.html$/i, '');
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return `${url.origin}${url.pathname}`;
}

export function getActiveProvider() {
  return localStorage.getItem('auth_provider');
}

export function setActiveProvider(provider) {
  localStorage.setItem('auth_provider', provider);
}

function storeYouTubeToken(accessToken, expiresIn = 3599) {
  const config = getProviderConfig(PROVIDERS.YOUTUBE);
  const expiryTime = Date.now() + (expiresIn * 1000);
  localStorage.setItem(config.tokenKey, accessToken);
  localStorage.setItem(config.expiryKey, expiryTime.toString());
  setActiveProvider(PROVIDERS.YOUTUBE);
}

// YouTube: Google Identity Services token client (no client secret, works on static sites).
function initiateYouTubeLogin() {
  const config = getProviderConfig(PROVIDERS.YOUTUBE);

  return loadGoogleIdentityScript().then(() => new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: config.scope,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        storeYouTubeToken(response.access_token, response.expires_in);
        resolve(response.access_token);
      },
    });
    client.requestAccessToken({ prompt: 'consent select_account' });
  }));
}

function initiateSpotifyLogin() {
  const config = getProviderConfig(PROVIDERS.SPOTIFY);

  const codeVerifier = generateRandomString(64);

  return sha256(codeVerifier).then(hashed => {
    const codeChallenge = base64encode(hashed);

    localStorage.setItem('code_verifier', codeVerifier);
    localStorage.setItem('oauth_provider', PROVIDERS.SPOTIFY);

    const redirectUri = getRedirectUri();
    localStorage.setItem('oauth_redirect_uri', redirectUri);

    const authUrl = new URL(config.authUrl);
    authUrl.search = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: config.scope,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    }).toString();

    window.location.href = authUrl.toString();
  });
}

export async function initiateLogin(provider) {
  const config = getProviderConfig(provider);

  if (!config.clientId) {
    throw new Error(
      provider === PROVIDERS.YOUTUBE
        ? 'YouTube Client ID is not configured. Add YOUTUBE_CLIENT_ID in js/config.js'
        : 'Spotify Client ID is not configured'
    );
  }

  if (provider === PROVIDERS.YOUTUBE) {
    return initiateYouTubeLogin();
  }

  await initiateSpotifyLogin();
}

export async function exchangeCodeForToken(code, provider) {
  if (provider === PROVIDERS.YOUTUBE) {
    throw new Error('YouTube uses Google Identity Services and does not exchange authorization codes in the browser');
  }

  const config = getProviderConfig(provider);
  const codeVerifier = localStorage.getItem('code_verifier');
  const redirectUri = localStorage.getItem('oauth_redirect_uri') || getRedirectUri();

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  const data = await response.json();

  if (data.access_token) {
    const expiryTime = Date.now() + (data.expires_in * 1000);
    localStorage.setItem(config.tokenKey, data.access_token);
    localStorage.setItem(config.expiryKey, expiryTime.toString());
    if (data.refresh_token) {
      localStorage.setItem(config.refreshKey, data.refresh_token);
    }
    setActiveProvider(provider);

    localStorage.removeItem('code_verifier');
    localStorage.removeItem('oauth_provider');
    localStorage.removeItem('oauth_redirect_uri');
    window.history.replaceState({}, document.title, window.location.pathname);

    return data.access_token;
  }

  throw new Error(data.error_description || data.error || 'Failed to get access token');
}

export function getStoredToken(provider) {
  const config = getProviderConfig(provider);
  const token = localStorage.getItem(config.tokenKey);
  const expiry = localStorage.getItem(config.expiryKey);

  if (token && expiry && Date.now() < parseInt(expiry, 10)) {
    return token;
  }

  return null;
}

export function clearAuth(provider) {
  if (provider === PROVIDERS.SPOTIFY || !provider) {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expiry');
    localStorage.removeItem('spotify_refresh_token');
  }
  if (provider === PROVIDERS.YOUTUBE || !provider) {
    localStorage.removeItem('youtube_access_token');
    localStorage.removeItem('youtube_token_expiry');
    localStorage.removeItem('youtube_refresh_token');
  }
  if (!provider) {
    localStorage.removeItem('auth_provider');
    localStorage.removeItem('code_verifier');
    localStorage.removeItem('oauth_provider');
    localStorage.removeItem('oauth_redirect_uri');
  }
}
