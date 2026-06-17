# 🎸 Artist Organizer

Organize your followed artists into custom categories. Connect with **Spotify** or **YouTube Music**.

**Live app:** https://albocanegra.github.io/spotify-organizer

## Features

- 📂 Create custom categories for your followed artists
- 🎵 Works with Spotify or YouTube Music (choose at login)
- 🔄 Syncs across devices via private playlists in your music account
- ⚡ Instant UI updates (background sync)
- 🔒 Private playlists (only you can see them)

## How It Works

1. Connect with Spotify or YouTube Music
2. Create categories (e.g., Rock, Jazz, Electronic)
3. Move artists between categories
4. Categories are stored as private playlists in your connected account

Each provider keeps its own data — Spotify categories and YouTube categories are independent.

### Spotify

- Artists come from artists you follow on Spotify
- Category data is stored in private playlist descriptions (chunked due to Spotify's ~300 character limit)

### YouTube Music

- Artists come from **subscribed YouTube channels** (via YouTube Data API v3)
- Category data is stored in private YouTube playlist descriptions (larger chunks, ~4800 characters)
- If you have multiple YouTube profiles (e.g., one for videos, one for music), **select your music channel** when Google prompts you during login. The API is per-channel — profiles are not mixed.

## Tech Stack

- Vanilla JavaScript + React (via CDN)
- Spotify Web API + YouTube Data API v3
- OAuth 2.0 with PKCE (no backend, no client secrets in the browser)
- GitHub Pages hosting

## Setup Your Own Instance

### 1. Spotify (optional)

1. Create an app at [developer.spotify.com](https://developer.spotify.com/dashboard)
2. Add this redirect URI: `https://albocanegra.github.io/spotify-organizer` (no trailing slash)
3. Set `SPOTIFY_CLIENT_ID` in `js/config.js`

### 2. YouTube Music (optional)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **YouTube Data API v3**
3. Configure the **OAuth consent screen**
4. Create credentials → **OAuth client ID** → **Web application**
5. Add this **exact** authorized redirect URI (no trailing slash):

   ```
   https://albocanegra.github.io/spotify-organizer
   ```

   The app auto-detects the redirect URI from the current page URL. Google requires a character-for-character match — if you see `redirect_uri_mismatch`, compare this URI to what is listed in [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).

6. Set `YOUTUBE_CLIENT_ID` in `js/config.js`

You only need the **Client ID** — do not put the client secret in `config.js`. This app uses PKCE in the browser, same as Spotify.

For local development, add your local URL as a redirect URI too (e.g. `http://localhost:5500`) and open the app from that same origin.

### 3. Deploy

Deploy to GitHub Pages. At least one provider must be configured for login to work.

**On every release**, bump the cache version in two places (GitHub Pages caches JS aggressively; only `app.js` was busted before v5.0.1, which caused stale `config.js` loads):

1. `APP_CACHE_VERSION` in `index.html` — also auto-generates the import map for all modules listed in `JS_MODULES`
2. `APP_VERSION` in `js/config.js` — shown in the UI

When adding a new file under `js/`, add its filename to the `JS_MODULES` array in `index.html`.

## Security

- OAuth 2.0 with PKCE — no client secrets exposed in frontend code
- Minimal scopes requested per provider
- All playlists created are private
- Optional: restrict access to specific user IDs in `config.js`

## Restricting Access

To limit who can use your instance, edit `js/config.js`:

```javascript
export const ALLOWED_SPOTIFY_USER_IDS = [
  'your_spotify_user_id'
];

export const ALLOWED_YOUTUBE_USER_IDS = [
  'your_youtube_channel_id'
];
```

Leave either array empty to allow all users for that provider.

## File Structure

```
├── index.html          # App shell
└── js/
    ├── config.js       # Provider credentials and settings
    ├── auth.js         # OAuth (Spotify + Google)
    ├── spotify-api.js  # Spotify API calls
    ├── youtube-api.js  # YouTube Data API calls
    ├── app.js          # React UI component
    └── utils.js        # Utility functions
```

## License

MIT
