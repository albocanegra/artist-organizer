// Application configuration

export const PROVIDERS = {
  SPOTIFY: 'spotify',
  YOUTUBE: 'youtube',
};

// --- Spotify ---
export const SPOTIFY_CLIENT_ID = 'e21bf88870a94703bc0cdcf317075a5e';
export const SPOTIFY_SCOPES = 'user-follow-read playlist-read-private playlist-modify-private';

// Backward-compatible aliases
export const CLIENT_ID = SPOTIFY_CLIENT_ID;
export const REDIRECT_URI = 'https://albocanegra.github.io/spotify-organizer';
export const SCOPES = SPOTIFY_SCOPES;

// --- YouTube Music (via YouTube Data API v3) ---
// Create OAuth credentials at https://console.cloud.google.com/
// Enable YouTube Data API v3. Redirect URI is auto-detected from the page URL (see auth.js).
// Register this exact URI in Google Cloud → Credentials → Authorized redirect URIs:
//   https://albocanegra.github.io/spotify-organizer
export const YOUTUBE_CLIENT_ID = '123145098679-30tna8ocalh7f6mod262dchs6l3i088j.apps.googleusercontent.com';
export const YOUTUBE_SCOPES = 'https://www.googleapis.com/auth/youtube.force-ssl';

// Optional: Restrict access to specific user IDs (leave empty for public access)
export const ALLOWED_SPOTIFY_USER_IDS = [
  // 'your_spotify_user_id_here'
];
export const ALLOWED_YOUTUBE_USER_IDS = [
  // 'your_youtube_channel_id_here'
];

// Backward-compatible alias
export const ALLOWED_USER_IDS = ALLOWED_SPOTIFY_USER_IDS;

// Keep in sync with APP_CACHE_VERSION in index.html
export const APP_VERSION = 'v5.0.2';

// Playlist naming conventions (shared across providers)
export const CATEGORY_PREFIX = '🎸 ArtistOrganizer/';
export const DATA_PLAYLIST_PREFIX = '__ArtistOrganizer_Data';

// Description chunk sizes (Spotify ~300 chars; YouTube allows ~5000)
export const SPOTIFY_DESCRIPTION_MAX_LENGTH = 280;
export const YOUTUBE_DESCRIPTION_MAX_LENGTH = 4800;
export const DESCRIPTION_MAX_LENGTH = SPOTIFY_DESCRIPTION_MAX_LENGTH;
