/**
 * Centralized configuration for BLOCKCHaiNSTORM / TaNTЯiS
 * All API endpoints and external URLs in one place.
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
