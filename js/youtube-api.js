// YouTube Data API v3 wrapper (YouTube Music via channel subscriptions)

import {
  CATEGORY_PREFIX,
  DATA_PLAYLIST_PREFIX,
  YOUTUBE_DESCRIPTION_MAX_LENGTH,
} from './config.js';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function rateLimitedFetch(url, options, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
      console.log(`Rate limited, waiting ${retryAfter}s...`);
      await delay(retryAfter * 1000);
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}

async function fetchAllPages(baseUrl, token, getItems = data => data.items) {
  const results = [];
  let pageToken = null;

  do {
    const url = pageToken
      ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}pageToken=${pageToken}`
      : baseUrl;

    const response = await rateLimitedFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `YouTube API error (${response.status})`);
    }

    const data = await response.json();
    results.push(...(getItems(data) || []));
    pageToken = data.nextPageToken || null;

    if (pageToken) await delay(100);
  } while (pageToken);

  return results;
}

function normalizeArtist(channel) {
  const thumbs = channel.snippet?.thumbnails || {};
  const imageUrl = thumbs.medium?.url || thumbs.default?.url || null;

  return {
    id: channel.id,
    name: channel.snippet?.title || 'Unknown',
    images: imageUrl ? [{ url: imageUrl }] : [],
    external_urls: {
      youtube: `https://music.youtube.com/channel/${channel.id}`,
    },
  };
}

// ============================================
// USER & ARTISTS (channel subscriptions)
// ============================================

export async function getCurrentUser(token) {
  const response = await rateLimitedFetch(
    `${API_BASE}/channels?part=snippet&mine=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to get YouTube channel');
  }

  const data = await response.json();
  const channel = data.items?.[0];
  if (!channel) throw new Error('No YouTube channel found for this account');

  return {
    id: channel.id,
    display_name: channel.snippet?.title,
  };
}

export async function getFollowedArtists(token) {
  const subscriptions = await fetchAllPages(
    `${API_BASE}/subscriptions?part=snippet&mine=true&maxResults=50`,
    token
  );

  const channelIds = subscriptions
    .map(sub => sub.snippet?.resourceId?.channelId)
    .filter(Boolean);

  if (channelIds.length === 0) return [];

  const artists = [];
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const response = await rateLimitedFetch(
      `${API_BASE}/channels?part=snippet&id=${batch.join(',')}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to load channel details');
    }

    const data = await response.json();
    artists.push(...(data.items || []).map(normalizeArtist));
    await delay(100);
  }

  return artists.sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================
// PLAYLIST OPERATIONS
// ============================================

export async function getUserPlaylists(token) {
  return fetchAllPages(
    `${API_BASE}/playlists?part=snippet,status&mine=true&maxResults=50`,
    token
  );
}

async function createPlaylist(token, name, description) {
  const response = await rateLimitedFetch(`${API_BASE}/playlists?part=snippet,status`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      snippet: { title: name, description },
      status: { privacyStatus: 'private' },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create playlist');
  }

  return response.json();
}

async function updatePlaylistDescription(token, playlistId, description, title) {
  const response = await rateLimitedFetch(`${API_BASE}/playlists?part=snippet`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: playlistId,
      snippet: { title, description },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update playlist');
  }

  return response.json();
}

async function deletePlaylist(token, playlistId) {
  const response = await rateLimitedFetch(
    `${API_BASE}/playlists?id=${playlistId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok && response.status !== 404) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to delete playlist');
  }
}

// ============================================
// CATEGORY PLAYLISTS
// ============================================

export async function createCategoryPlaylist(token, userId, categoryName) {
  const name = `${CATEGORY_PREFIX}${categoryName}`;
  const description = `Artists categorized as "${categoryName}" - managed by Artist Organizer`;
  return createPlaylist(token, name, description);
}

export async function deleteCategoryPlaylist(token, playlistId) {
  if (!playlistId) return;
  return deletePlaylist(token, playlistId);
}

export async function getCategoryPlaylists(token, userId) {
  const allPlaylists = await getUserPlaylists(token);
  const categoryPlaylists = {};

  allPlaylists
    .filter(p => p?.snippet?.title?.startsWith(CATEGORY_PREFIX))
    .forEach(p => {
      const categoryName = p.snippet.title.substring(CATEGORY_PREFIX.length);
      categoryPlaylists[categoryName] = p.id;
    });

  return categoryPlaylists;
}

// ============================================
// DATA STORAGE (chunked JSON in descriptions)
// ============================================

function chunkData(jsonString, maxLength) {
  const chunks = [];
  for (let i = 0; i < jsonString.length; i += maxLength) {
    chunks.push(jsonString.substring(i, i + maxLength));
  }
  return chunks;
}

function getDataPlaylistName(index) {
  return index === 0 ? DATA_PLAYLIST_PREFIX : `${DATA_PLAYLIST_PREFIX}_${index + 1}`;
}

function isValidDataPlaylistName(name) {
  if (name === DATA_PLAYLIST_PREFIX) return true;
  return new RegExp(`^${DATA_PLAYLIST_PREFIX}_(\\d+)$`).test(name);
}

function getDataPlaylistIndex(name) {
  if (name === DATA_PLAYLIST_PREFIX) return 0;
  const match = name.match(new RegExp(`^${DATA_PLAYLIST_PREFIX}_(\\d+)$`));
  if (match) return parseInt(match[1], 10) - 1;
  return -1;
}

export async function saveCategoriesToSpotify(token, userId, categories) {
  const jsonString = JSON.stringify(categories);
  const chunks = chunkData(jsonString, YOUTUBE_DESCRIPTION_MAX_LENGTH);

  const allPlaylists = await getUserPlaylists(token);
  const dataPlaylists = allPlaylists
    .filter(p => p?.snippet?.title?.startsWith(DATA_PLAYLIST_PREFIX))
    .sort((a, b) => a.snippet.title.localeCompare(b.snippet.title));

  for (let i = 0; i < chunks.length; i++) {
    const playlistName = getDataPlaylistName(i);
    const existing = dataPlaylists.find(p => p.snippet.title === playlistName);

    if (existing) {
      await updatePlaylistDescription(token, existing.id, chunks[i], playlistName);
    } else {
      await createPlaylist(token, playlistName, chunks[i]);
    }
    await delay(100);
  }

  for (let i = chunks.length; i < dataPlaylists.length; i++) {
    const playlistName = getDataPlaylistName(i);
    const toDelete = dataPlaylists.find(p => p.snippet.title === playlistName);
    if (toDelete) {
      await deletePlaylist(token, toDelete.id);
      await delay(100);
    }
  }
}

export async function loadCategoriesFromSpotify(token, userId) {
  const allPlaylists = await getUserPlaylists(token);

  const dataPlaylistRefs = allPlaylists
    .filter(p => isValidDataPlaylistName(p?.snippet?.title))
    .sort((a, b) => getDataPlaylistIndex(a.snippet.title) - getDataPlaylistIndex(b.snippet.title));

  if (dataPlaylistRefs.length === 0) return {};

  const descriptions = new Array(dataPlaylistRefs.length);
  for (const ref of dataPlaylistRefs) {
    const index = getDataPlaylistIndex(ref.snippet.title);
    descriptions[index] = ref.snippet?.description || '';
    await delay(50);
  }

  const jsonString = descriptions.filter(d => d !== undefined).join('');

  if (!jsonString || jsonString.trim() === '') return {};

  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse categories data:', e);
    return { _corrupted: true };
  }
}

export async function migrateFromOldFormat(_token, _userId) {
  return null;
}

export async function deleteOldPlaylists() {
  return undefined;
}

export async function resetAllData(token, userId) {
  const allPlaylists = await getUserPlaylists(token);

  const dataPlaylists = allPlaylists.filter(p =>
    p?.snippet?.title?.startsWith(DATA_PLAYLIST_PREFIX)
  );
  for (const playlist of dataPlaylists) {
    await deletePlaylist(token, playlist.id);
    await delay(200);
  }

  const categoryPlaylists = allPlaylists.filter(p =>
    p?.snippet?.title?.startsWith(CATEGORY_PREFIX)
  );
  for (const playlist of categoryPlaylists) {
    await deletePlaylist(token, playlist.id);
    await delay(200);
  }

  return { deletedData: dataPlaylists.length, deletedCategories: categoryPlaylists.length };
}
