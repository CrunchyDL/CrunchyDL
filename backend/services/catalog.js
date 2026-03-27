const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const axios = require('axios');

const ConfigService = require('./config');
const configService = new ConfigService();
const { setupDb } = require('../db');

class CatalogService {
  constructor() {
    this.tokenFilePath = path.join(__dirname, '..', 'multi-downloader-nx', 'config', 'cr_token.yml');
    this.apiBase = 'https://beta-api.crunchyroll.com';
    this.refreshPromise = null;
    this.cmsData = null;
  }

  async getMetadataLocale() {
    try {
      const db = await setupDb();
      const row = await db.get('SELECT value FROM settings WHERE `key` = ?', 'metadata_language');
      return row?.value || 'en-US';
    } catch (e) {
      return 'en-US';
    }
  }

  async getToken(forceRefresh = false) {
    try {
      if (forceRefresh || !fs.existsSync(this.tokenFilePath)) {
        if (!fs.existsSync(this.tokenFilePath)) {
          console.log('Token file not found, attempting anonymous authentication...');
          await this.doAnonymousAuth();
        } else if (forceRefresh) {
          const fileContents = fs.readFileSync(this.tokenFilePath, 'utf8');
          const data = yaml.load(fileContents);
          if (!data.refresh_token) {
            console.log('Forcing guest token refresh...');
            await this.doAnonymousAuth();
          } else {
            console.log('Existing user token found, skipping anonymous fallback.');
          }
        }
      }

      if (!fs.existsSync(this.tokenFilePath)) {
        return null;
      }

      let fileContents = fs.readFileSync(this.tokenFilePath, 'utf8');
      let data = yaml.load(fileContents);

      // Check for expiry (proactive refresh if within 30 seconds)
      const now = new Date();
      const expiry = data.expires ? new Date(data.expires) : null;

      if (expiry && (expiry.getTime() - now.getTime() < 30 * 1000)) {
        if (this.refreshPromise) {
          console.log('Token refresh already in progress, waiting...');
          await this.refreshPromise;
        } else {
          console.log('Token near expiry or expired, refreshing...');
          if (!data.refresh_token) {
            this.refreshPromise = this.doAnonymousAuth();
          } else {
            this.refreshPromise = this.refreshToken();
          }
          try {
            await this.refreshPromise;
          } finally {
            this.refreshPromise = null;
          }
        }

        // Final read after refresh
        if (fs.existsSync(this.tokenFilePath)) {
          fileContents = fs.readFileSync(this.tokenFilePath, 'utf8');
          data = yaml.load(fileContents);
        }
      }

      return data;
    } catch (e) {
      console.error('Error loading token:', e);
      return null;
    }
  }

  async getAuthStatus() {
    const data = await this.getToken();
    if (!data) return { authenticated: false, type: 'none' };
    const isUser = !!data.refresh_token;
    return {
      authenticated: true,
      type: isUser ? 'user' : 'guest',
      username: data.username || (isUser ? 'Premium User' : 'Anonymous Guest'),
      expires: data.expires
    };
  }

  async doAnonymousAuth() {
    try {
      // 1. Try to use stored credentials if available
      try {
        const db = await setupDb();
        const emailRow = await db.get('SELECT value FROM settings WHERE `key` = ?', 'crunchyroll_email');
        const passRow = await db.get('SELECT value FROM settings WHERE `key` = ?', 'crunchyroll_password');

        if (emailRow?.value && passRow?.value) {
          console.log('[Catalog] Found stored credentials, attempting automatic login...');
          try {
            const loginResult = await this.login({ username: emailRow.value, password: passRow.value });
            if (loginResult && loginResult.success) {
              console.log('[Catalog] Automatic login successful.');
              return;
            }
          } catch (loginErr) {
            console.error('[Catalog] Automatic login failed:', loginErr.message);
            // Fall through to anonymous
          }
        }
      } catch (dbErr) {
        console.error('[Catalog] Failed to check stored credentials in DB:', dbErr.message);
      }

      // 2. Anonymous Auth (Guest)
      // Updated credentials from multi-downloader-nx/modules/module.api-urls.ts
      const basic = 'bzd1b3d5N3E0bGdsdGJhdnloanE6bHFyakVUTng2Vzd1Um5wY0RtOHdSVmo4QkNoakMxZXI=';
      const userAgent = 'Crunchyroll/ANDROIDTV/3.58.0_22336 (Android 12; en-US; SHIELD Android TV Build/SR1A.211012.001)';

      const uuid = require('crypto').randomUUID();
      const decoded = Buffer.from(basic, 'base64').toString('utf8');
      const authData = new URLSearchParams({
        grant_type: 'client_id',
        scope: 'offline_access',
        client_id: decoded.split(':')[0],
        client_secret: decoded.split(':')[1],
        device_id: uuid,
        device_name: 'emu64xa',
        device_type: 'ANDROIDTV'
      }).toString();

      const response = await axios.post(`${this.apiBase}/auth/v1/token`, authData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'ETP-Anonymous-ID': uuid,
          'User-Agent': userAgent,
          'Accept': 'application/json',
          'Accept-Charset': 'UTF-8',
          'Request-Type': 'SignIn'
        }
      });

      const tokenData = response.data;
      tokenData.device_id = uuid;
      tokenData.expires = new Date(Date.now() + tokenData.expires_in * 1000);

      // Ensure config directory exists
      const configDir = path.dirname(this.tokenFilePath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.tokenFilePath, yaml.dump(tokenData));
      console.log('Anonymous authentication successful, token saved.');
    } catch (e) {
      console.error('Anonymous authentication failed:', e.response?.data || e.message);
    }
  }

  async refreshToken() {
    try {
      if (!fs.existsSync(this.tokenFilePath)) {
        throw new Error('Token file not found');
      }
      const fileContents = fs.readFileSync(this.tokenFilePath, 'utf8');
      const tokenData = yaml.load(fileContents);

      if (!tokenData || !tokenData.refresh_token) {
        throw new Error('No refresh token available');
      }

      const basic = 'bzd1b3d5N3E0bGdsdGJhdnloanE6bHFyakVUTng2Vzd1Um5wY0RtOHdSVmo4QkNoakMxZXI=';
      const userAgent = 'Crunchyroll/ANDROIDTV/3.58.0_22336 (Android 12; en-US; SHIELD Android TV Build/SR1A.211012.001)';
      const decoded = Buffer.from(basic, 'base64').toString('utf8');
      const client = decoded.split(':');
      const uuid = tokenData.device_id || require('crypto').randomUUID();
      const authData = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenData.refresh_token,
        scope: 'offline_access',
        client_id: client[0],
        client_secret: client[1],
        device_id: uuid,
        device_name: 'emu64xa',
        device_type: 'ANDROIDTV'
      }).toString();

      const response = await axios.post(`${this.apiBase}/auth/v1/token`, authData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'ETP-Anonymous-ID': uuid,
          'User-Agent': userAgent,
          'Accept': 'application/json',
          'Accept-Charset': 'UTF-8'
        }
      });

      const newTokenData = response.data;
      newTokenData.device_id = uuid;
      newTokenData.expires = new Date(Date.now() + newTokenData.expires_in * 1000);

      // Preserve username if it was there
      if (tokenData.username) {
        newTokenData.username = tokenData.username;
      }

      fs.writeFileSync(this.tokenFilePath, yaml.dump(newTokenData));
      console.log('Token refreshed successfully.');
      return newTokenData;
    } catch (e) {
      console.error('Token refresh failed:', e.response?.data || e.message);
      throw e;
    }
  }

  async login(credentials) {
    const { username, password, token } = credentials;
    const { spawn } = require('child_process');
    const cliPath = path.resolve(__dirname, '..', 'multi-downloader-nx', 'lib', 'index.js');

    return new Promise((resolve, reject) => {
      const args = ['--service', 'crunchy'];
      if (token) {
        args.push('--token', token);
      } else if (username && password) {
        args.push('--auth', '--username', username, '--password', password);
      } else {
        return reject(new Error('Credentials or token required'));
      }

      const child = spawn('node', [cliPath, ...args], {
        env: { ...process.env, contentDirectory: path.resolve(__dirname, '..', 'multi-downloader-nx') }
      });

      let output = '';
      child.stdout.on('data', (data) => {
        const str = data.toString();
        console.log(`Login stdout: ${str}`);
        output += str;
      });
      child.stderr.on('data', (data) => {
        const str = data.toString();
        console.error(`Login stderr: ${str}`);
        output += str;
      });

      child.on('close', (code) => {
        console.log(`Login process exited with code ${code}`);
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          reject(new Error(output || `Login failed with exit code ${code}`));
        }
      });
    });
  }

  async _getCmsCredentials() {
    const now = new Date();
    if (this.cmsData && this.cmsData.expires && new Date(this.cmsData.expires) > now) {
      return this.cmsData;
    }

    console.log('[Catalog] Fetching fresh CMS credentials...');
    const response = await this._request('get', `${this.apiBase}/index/v2`);
    this.cmsData = response.data.cms;
    // The policy usually expires, but we'll re-fetch if needed
    return this.cmsData;
  }

  async _request(method, url, options = {}) {
    let tokenData = await this.getToken();
    if (!tokenData) throw new Error('Not authenticated');

    const execute = async (token) => {
      const config = {
        method,
        url,
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Crunchyroll/ANDROIDTV/3.54.5_22304 (Android 12; en-US; SHIELD Android TV Build/SR1A.211012.001)'
        }
      };
      return await axios(config);
    };

    try {
      return await execute(tokenData.access_token);
    } catch (e) {
      const errorData = e.response?.data;
      if (errorData?.code === 'content.error.invalid_auth_token' || e.response?.status === 401) {
        if (!tokenData.refresh_token) {
          console.log('Invalid or expired guest token detected, forcing refresh...');
          tokenData = await this.getToken(true);
          if (tokenData) {
            return await execute(tokenData.access_token);
          }
        } else {
          console.log('User token expired, attempting refresh...');
          try {
            const newTokenData = await this.refreshToken();
            return await execute(newTokenData.access_token);
          } catch (refreshError) {
            console.error('User token refresh failed. Manual login required.');
            throw new Error('Tu sesión ha expirado. Por favor, inicia sesión de nuevo en la configuración.');
          }
        }
      }
      throw e;
    }
  }

  async getSeasonalCatalog(year, season) {
    const seasonTag = `${season.toLowerCase()}-${year}`;

    try {
      const locale = await this.getMetadataLocale();

      console.log(`[Catalog] Fetching Crunchyroll seasonal items for tag: ${seasonTag} (locale: ${locale})`);
      const response = await this._request('get', `${this.apiBase}/content/v2/discover/browse`, {
        params: {
          seasonal_tag: seasonTag,
          sort_by: 'popularity',
          n: 100,
          locale: locale
        }
      });

      const items = response.data.data || [];
      console.log(`[Catalog] Successfully fetched ${items.length} items from Crunchyroll.`);

      const enrichedItems = items.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        image: item.images?.poster_tall?.[0]?.[Math.floor(item.images.poster_tall[0].length / 2)]?.source || '/notFound.png',
        type: item.type,
        is_simulcast: item.series_metadata?.is_simulcast || false,
        availability_notes: item.series_metadata?.availability_notes || ''
      }));

      return await this._enrichWithLibraryStatus(enrichedItems);
    } catch (e) {
      console.error(`[Catalog] Error fetching catalog for ${seasonTag}:`, e.response?.data || e.message);
      throw e;
    }
  }

  async getBrowseCatalog({ sort = 'popularity', n = 100, start = 0 }) {
    try {
      const locale = await this.getMetadataLocale();

      console.log(`[Catalog] Fetching Crunchyroll browse catalog (sort: ${sort}, start: ${start}, locale: ${locale})`);
      const response = await this._request('get', `${this.apiBase}/content/v2/discover/browse`, {
        params: {
          sort_by: sort,
          n: n,
          start: start,
          locale: locale
        }
      });

      const items = response.data.data || [];
      console.log(`[Catalog] Successfully fetched ${items.length} browse items.`);

      const enrichedItems = items.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        image: item.images?.poster_tall?.[0]?.[Math.floor(item.images.poster_tall[0].length / 2)]?.source || '/notFound.png',
        type: item.type,
        is_simulcast: item.series_metadata?.is_simulcast || false,
        availability_notes: item.series_metadata?.availability_notes || ''
      }));

      return await this._enrichWithLibraryStatus(enrichedItems);
    } catch (e) {
      console.error(`[Catalog] Error fetching browse catalog:`, e.response?.data || e.message);
      throw e;
    }
  }

  async getSeriesDetails(seriesId) {
    try {
      // If seriesId is a slug (e.g. from AniList legacy URLs), resolve it to a UUID
      if (seriesId && !/^[A-Z0-9]{9}$/.test(seriesId)) {
        console.log(`[Catalog] Resolving slug "${seriesId}" to UUID...`);
        const searchResults = await this.searchSeries(seriesId);
        const match = searchResults.find(r => r.id && /^[A-Z0-9]{9}$/.test(r.id));
        if (match) {
          seriesId = match.id;
          console.log(`[Catalog] Slug resolved to ${seriesId}`);
        }
      }

      const locale = await this.getMetadataLocale();
      const cms = await this._getCmsCredentials();

      const seasonsResponse = await this._request('get', `${this.apiBase}/content/v2/cms/series/${seriesId}/seasons`, {
        params: {
          locale: locale,
          Policy: cms.policy,
          Signature: cms.signature,
          'Key-Pair-Id': cms.key_pair_id
        }
      });

      const seasons = seasonsResponse.data.data;

      return {
        id: seriesId,
        seasons: seasons.map(s => ({
          id: s.id, // En v2/cms este id ya es el GUID
          title: s.title,
          season_number: s.season_number,
          episode_count: s.episode_count,
          is_subbed: s.is_subbed,
          is_dubbed: s.is_dubbed
        }))
      };
    } catch (e) {
      console.log('Error fetching series details:', e.message);
      throw e;
    }
  }

  async getEpisodes(seasonId) {
    try {
      const locale = await this.getMetadataLocale();
      const cms = await this._getCmsCredentials();
      const response = await this._request('get', `${this.apiBase}/content/v2/cms/seasons/${seasonId}/episodes`, {
        params: {
          locale: locale,
          Policy: cms.policy,
          Signature: cms.signature,
          'Key-Pair-Id': cms.key_pair_id
        }
      });

      return response.data.data.map(ep => ({
        id: ep.id,
        title: ep.title,
        episode_number: ep.episode_number,
        season_id: ep.season_id,
        image: ep.images?.thumbnail?.[0]?.[Math.floor(ep.images.thumbnail[0].length / 2)]?.source || '/notFound.png',
        duration_ms: ep.duration_ms
      }));
    } catch (e) {
      console.error('Error fetching episodes:', e.message);
      throw e;
    }
  }

  async searchSeries(query) {
    try {
      const locale = await this.getMetadataLocale();

      const response = await this._request('get', `${this.apiBase}/content/v2/discover/search`, {
        params: {
          q: query,
          type: 'series',
          n: 5,
          locale: locale
        }
      });

      const items = response.data.data?.[0]?.items || [];
      const enrichedItems = items.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        image: item.images?.poster_tall?.[0]?.[Math.floor(item.images.poster_tall[0].length / 2)]?.source || '/notFound.png'
      }));

      return await this._enrichWithLibraryStatus(enrichedItems);
    } catch (e) {
      console.error('Error searching series:', e.response?.data || e.message);
      return [];
    }
  }

  async getSeriesInfo(seriesId) {
    try {
      // If seriesId is a slug (e.g. from AniList legacy URLs), resolve it to a UUID
      if (seriesId && !/^[A-Z0-9]{9}$/.test(seriesId)) {
        console.log(`[Catalog] Resolving slug "${seriesId}" to UUID for info...`);
        const searchResults = await this.searchSeries(seriesId);
        const match = searchResults.find(r => r.id && /^[A-Z0-9]{9}$/.test(r.id));
        if (match) {
          seriesId = match.id;
          console.log(`[Catalog] Slug resolved to ${seriesId} for info`);
        }
      }

      const locale = await this.getMetadataLocale();
      const cms = await this._getCmsCredentials();
      const response = await this._request('get', `${this.apiBase}/content/v2/cms/series/${seriesId}`, {
        params: {
          locale: locale,
          Policy: cms.policy,
          Signature: cms.signature,
          'Key-Pair-Id': cms.key_pair_id
        }
      });

      const item = response.data.data?.[0];
      if (!item) return null;

      return {
        id: item.id,
        title: item.title,
        description: item.description,
        image: item.images?.poster_tall?.[0]?.[Math.floor(item.images.poster_tall[0].length / 2)]?.source || '/notFound.png'
      };
    } catch (e) {
      console.error('Error fetching series info:', e.message);
      return null;
    }
  }

  async _enrichWithLibraryStatus(items) {
    if (!items || items.length === 0) return items;

    try {
      const db = await setupDb();
      // Get all local series IDs
      const localSeries = await db.all('SELECT crunchyroll_id, id FROM series');
      const localCrIds = new Set(localSeries.map(s => s.crunchyroll_id).filter(id => !!id));
      const localInternalIds = new Set(localSeries.map(s => s.id));

      return items.map(item => ({
        ...item,
        in_library: localCrIds.has(item.id) || localInternalIds.has(item.id)
      }));
    } catch (err) {
      console.error('[Catalog] Error enriching with library status:', err.message);
      return items;
    }
  }
}

module.exports = new CatalogService();
