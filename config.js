/**
 * Centralized configuration for TaNTЯiS
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

/**
 * Global Error Boundary
 * Catches uncaught exceptions and unhandled promise rejections.
 * Logs them via Logger, shows a non-intrusive notification on first
 * occurrence, and (for logged-in users) reports to the bug-report endpoint.
 */
const ErrorBoundary = {
    /** @type {number} Max errors to report per session (prevent flood) */
    MAX_REPORTS: 5,
    /** @type {number} Errors reported so far this session */
    _reportCount: 0,
    /** @type {boolean} Whether the on-screen toast has been shown */
    _toastShown: false,
    /** @type {Set<string>} Dedup: fingerprints we've already reported */
    _seen: new Set(),

    /**
     * Initialize global error listeners. Call once, as early as possible.
     */
    init() {
        window.addEventListener('error', (event) => {
            this._handle({
                message: event.message,
                source: event.filename,
                line: event.lineno,
                col: event.colno,
                stack: event.error && event.error.stack,
                type: 'uncaught_error'
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason;
            this._handle({
                message: reason instanceof Error ? reason.message : String(reason),
                stack: reason instanceof Error ? reason.stack : undefined,
                type: 'unhandled_rejection'
            });
        });

        Logger.info('🛡️ Error boundary initialized');
    },

    /**
     * Internal handler shared by both listeners.
     * @param {{message:string, source?:string, line?:number, col?:number, stack?:string, type:string}} info
     */
    _handle(info) {
        // Build a short fingerprint so we don't double-report the same error
        const fingerprint = `${info.message}|${info.source || ''}|${info.line || ''}`;
        if (this._seen.has(fingerprint)) return;
        this._seen.add(fingerprint);

        // Always log locally
        Logger.error(`🛡️ [${info.type}] ${info.message}`,
            info.source ? `\n   at ${info.source}:${info.line}:${info.col}` : '',
            info.stack ? `\n${info.stack}` : '');

        // Show a small, non-intrusive toast once per session
        if (!this._toastShown) {
            this._toastShown = true;
            this._showToast();
        }

        // Report to server (fire-and-forget, capped)
        this._report(info);
    },

    /**
     * Show a brief, auto-dismissing toast so the player knows
     * something went wrong (without breaking immersion).
     */
    _showToast() {
        const toast = document.createElement('div');
        toast.textContent = 'A background error occurred — the game should still work.';
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 60, 60, 0.85)',
            color: '#fff',
            padding: '8px 18px',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            zIndex: '99999',
            pointerEvents: 'none',
            opacity: '0',
            transition: 'opacity 0.3s'
        });
        document.body.appendChild(toast);
        // Fade in
        requestAnimationFrame(() => { toast.style.opacity = '1'; });
        // Fade out after 5 s
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 5000);
    },

    /**
     * Fire-and-forget error report to the server.
     * Only for logged-in users; capped at MAX_REPORTS per session.
     * @param {{message:string, source?:string, line?:number, col?:number, stack?:string, type:string}} info
     */
    async _report(info) {
        if (this._reportCount >= this.MAX_REPORTS) return;
        if (!sessionStorage.getItem('oi_token')) return;

        this._reportCount++;
        try {
            await apiFetch(`${AppConfig.GAME_API}/bug-report`, {
                method: 'POST',
                auth: true,
                silent: true,
                timeout: 5000,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `[Auto] ${info.type}: ${info.message}`.slice(0, 200),
                    description: [
                        `Type: ${info.type}`,
                        info.source ? `Source: ${info.source}:${info.line}:${info.col}` : null,
                        info.stack ? `Stack:\n${info.stack}` : null,
                        `URL: ${window.location.href}`,
                        `UA: ${navigator.userAgent}`
                    ].filter(Boolean).join('\n\n'),
                    category: 'auto_error'
                })
            });
        } catch (_) {
            // Swallow — we must never let error reporting itself cause errors
        }
    }
};

// Initialize immediately (config.js loads before everything else)
ErrorBoundary.init();
