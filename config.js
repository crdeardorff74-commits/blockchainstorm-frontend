/**
 * Centralized configuration for BLOCKCHaiNSTORM / TaNTЯiS
 * All API endpoints, shared utilities, and external URLs in one place.
 * This file must be loaded before all other scripts.
 */
const AppConfig = {
    // Game API (leaderboard, scores, recordings, visits, bug reports, media proxy)
    GAME_API: 'https://blockchainstorm.onrender.com/api',

    // Auth & settings API (login, register, OAuth, settings sync)
    AUTH_API: 'https://official-intelligence-api.onrender.com',

    // GitHub release CDN for music and SFX (direct download, no proxy)
    GITHUB_RELEASES: 'https://github.com/crdeardorff74-commits/blockchainstorm-frontend/releases/download'
};

/**
 * Shared fetch wrapper with timeout, auth, and error handling.
 *
 * @param {string} url - The URL to fetch
 * @param {Object} [options] - Standard fetch options plus extras:
 * @param {number} [options.timeout] - Timeout in ms (default: 10000). 0 to disable.
 * @param {boolean} [options.auth] - If true, attach Bearer token from sessionStorage.
 * @param {boolean} [options.silent] - If true, catch and swallow all errors (returns null).
 * @returns {Promise<Response|null>} The fetch Response, or null if silent and failed.
 */
async function apiFetch(url, options = {}) {
    const { timeout = 10000, auth = false, silent = false, ...fetchOptions } = options;

    // Attach auth header if requested
    if (auth) {
        const token = sessionStorage.getItem('oi_token');
        if (token) {
            fetchOptions.headers = {
                ...fetchOptions.headers,
                'Authorization': `Bearer ${token}`
            };
        }
    }

    // Set up timeout via AbortController
    let controller, timeoutId;
    if (timeout > 0) {
        controller = new AbortController();
        // Preserve caller's signal if they passed one (rare, but safe)
        if (fetchOptions.signal) {
            fetchOptions.signal.addEventListener('abort', () => controller.abort());
        }
        fetchOptions.signal = controller.signal;
        timeoutId = setTimeout(() => controller.abort(), timeout);
    }

    try {
        const response = await fetch(url, fetchOptions);
        if (timeoutId) clearTimeout(timeoutId);
        return response;
    } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        if (silent) return null;
        throw error;
    }
}

/**
 * Lightweight logger with level control.
 * Set Logger.level to control verbosity:
 *   'debug' - everything (development)
 *   'info'  - info, warn, error (default in production)
 *   'warn'  - warn and error only
 *   'error' - errors only
 *   'off'   - silence all logging
 *
 * Usage: Logger.debug('message'), Logger.info('message'),
 *        Logger.warn('message'), Logger.error('message')
 *
 * Enable debug in browser console: Logger.level = 'debug'
 */
const Logger = {
    /** @type {'debug'|'info'|'warn'|'error'|'off'} */
    level: 'info',

    _levels: { debug: 0, info: 1, warn: 2, error: 3, off: 4 },

    _shouldLog(level) {
        return this._levels[level] >= this._levels[this.level];
    },

    /** Log debug-level messages (hidden in production by default). */
    debug(...args) {
        if (this._shouldLog('debug')) console.log(...args);
    },

    /** Log info-level messages (visible at 'info' and below). */
    info(...args) {
        if (this._shouldLog('info')) console.log(...args);
    },

    /** Log warnings (visible at 'warn' and below). */
    warn(...args) {
        if (this._shouldLog('warn')) console.warn(...args);
    },

    /** Log errors (always visible unless level is 'off'). */
    error(...args) {
        if (this._shouldLog('error')) console.error(...args);
    }
};
