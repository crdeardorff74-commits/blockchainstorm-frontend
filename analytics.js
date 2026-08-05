/**
 * TANTЯO — Engagement analytics
 *
 * Measures the three things a CrazyGames Basic Launch trial is graded on
 * (playtime, retention, conversion) and — more importantly — the diagnostics
 * that say WHERE players are lost. See `CRAZYGAMES.md` at the umbrella root
 * for why each of these exists; the short version:
 *
 *   1. PLAYTIME. Nothing in page_visits measured time. This module keeps two
 *      clocks: `visible` (time on page, tab-hidden time excluded) and `play`
 *      (time with a game actually running and unpaused). Both are honest by
 *      construction — an idle backgrounded tab accrues neither.
 *   2. PER-GAME OUTCOME. /finished used to send an empty body, so every game
 *      collapsed into a counter. Each game now gets a row: duration, score,
 *      lines, level, pieces, settings, and how it ended.
 *   3. ABANDONMENT. 44% of starters ever reached a game over, and the other
 *      56% were invisible. A game row is written the moment play starts and
 *      upgraded on the way out, so quitting mid-game is now a recorded fact
 *      with a duration attached, not an absence of data.
 *
 * DELIVERY (the part that decides whether any of the above survives):
 * mobile glance-sessions are routinely shorter than a cold Render dyno's
 * first response, so "fire and hope" loses exactly the sessions we most want
 * to measure. Every payload is written to a localStorage queue BEFORE it is
 * sent and only removed on a 2xx; whatever is left over is flushed on the
 * next page load. Sends use `keepalive` (and `sendBeacon` on the final
 * pagehide) so an in-flight request survives the page going away.
 *
 * IDEMPOTENCE: because retries, out-of-order delivery and duplicate beacons
 * are all expected, the server merges whole state rather than applying
 * deltas — max() for counters, a one-way rank ladder for end_cause. Sending
 * the same payload five times is indistinguishable from sending it once.
 *
 * NOT TRACKED: AI demo games and replays. Both run with `gameRunning = true`
 * and would otherwise pour attract-mode time into the playtime average — the
 * call sites in game.js are all `!aiModeEnabled` gated.
 */
const Analytics = (() => {
    'use strict';

    const QUEUE_KEY = 'tantro_analytics_queue_v1';
    const QUEUE_MAX = 50;                       // oldest dropped past this
    const QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    // ── Backstop syncs ──
    // The exit beacon is not guaranteed. Closing the whole BROWSER (rather
    // than the tab) kills the process that would carry an in-flight
    // sendBeacon, so a cold Render dyno never receives it; the payload then
    // waits in the queue until the player's next visit, which may be never.
    // Crashes, OS kills and iOS swipe-aways lose it the same way.
    //
    // So the row is topped up WHILE the game is running, on an escalating
    // schedule: even a game whose exit is never heard from still carries a
    // real duration (a lower bound), instead of the 0s it was stamped with
    // at game start. Early steps are close together because most abandons
    // happen in the first minute — that is the whole thing being measured.
    // The schedule then stretches out, because the per-IP rate limiter is
    // shared by everyone behind a carrier NAT and a long, healthy session
    // needs no more than a periodic top-up.
    const HEARTBEAT_TICK_MS = 15000;
    const SYNC_STEPS_MS = [15000, 30000, 60000, 120000];  // last step repeats

    // ── State ────────────────────────────────────────────────────────────
    let enabled = true;
    let visitId = null;
    let gameIndex = 0;              // 1-based ordinal of the game in this visit
    let current = null;             // the game in progress, or null
    let firstStartMs = null;        // visible-ms elapsed when game 1 started
    let lastSyncedPlayMs = -1;
    let syncStep = 0;               // index into SYNC_STEPS_MS, reset per game
    let heartbeatTimer = null;
    let queue = [];

    /**
     * A stopwatch that only advances while explicitly running. Used instead
     * of (now - startedAt) everywhere because every clock here has to be
     * pausable: hidden tabs, paused games and settings overlays must not
     * accrue time.
     */
    function makeClock() {
        let accum = 0;
        let anchor = null;
        return {
            start() { if (anchor === null) anchor = Date.now(); },
            stop() {
                if (anchor !== null) { accum += Date.now() - anchor; anchor = null; }
            },
            ms() { return accum + (anchor !== null ? Date.now() - anchor : 0); },
            running() { return anchor !== null; }
        };
    }

    const visibleClock = makeClock();
    const playClock = makeClock();

    function isHidden() {
        return typeof document !== 'undefined' && document.visibilityState === 'hidden';
    }

    function uuid() {
        try {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        } catch (e) { /* fall through */ }
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }

    function secs(ms) { return Math.max(0, Math.round(ms / 1000)); }

    // ── Queue ────────────────────────────────────────────────────────────
    // Entries: { id, kind: 'game'|'session', visitId, body, ts }
    // `visitId` is null for anything produced before the visit POST answered
    // (a fast tap on a cold dyno); those get stamped by setVisitId().

    function loadQueue() {
        try {
            const raw = localStorage.getItem(QUEUE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            const cutoff = Date.now() - QUEUE_TTL_MS;
            // Stranded orphans can never be resolved: a null visitId means
            // THAT page load never got a visit row, and this load's visit is
            // a different row. Attaching them here would corrupt games-per-
            // session, so they're dropped rather than misfiled.
            return parsed.filter(e => e && e.ts > cutoff && e.visitId);
        } catch (e) {
            return [];
        }
    }

    function persistQueue() {
        try {
            if (queue.length > QUEUE_MAX) queue = queue.slice(queue.length - QUEUE_MAX);
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        } catch (e) {
            // Private mode / quota. In-memory queue still works for this page.
        }
    }

    function enqueue(kind, body) {
        // Only the newest session sync matters — it carries whole state, so
        // an older one is strictly redundant. Game rows are per-game and all
        // kept (each is keyed by its own clientGameId).
        if (kind === 'session') {
            queue = queue.filter(e => !(e.kind === 'session' && e.visitId === visitId));
        }
        const entry = { id: uuid(), kind: kind, visitId: visitId, body: body, ts: Date.now() };
        queue.push(entry);
        persistQueue();
        return entry;
    }

    function dequeue(id) {
        const before = queue.length;
        queue = queue.filter(e => e.id !== id);
        if (queue.length !== before) persistQueue();
    }

    function urlFor(entry) {
        return AppConfig.GAME_API + '/visit/' + entry.visitId +
            (entry.kind === 'game' ? '/game' : '/session');
    }

    /**
     * Send one queued entry. `final` marks the page-is-going-away path,
     * where sendBeacon is more reliable than fetch on iOS — at the cost of
     * no readable response, so the entry stays queued and is re-sent (and
     * server-side merged away) on the next load.
     */
    function send(entry, final) {
        if (!entry.visitId) return;
        const url = urlFor(entry);
        const payload = JSON.stringify(entry.body);

        if (final && typeof navigator !== 'undefined' && navigator.sendBeacon) {
            try {
                // Two constraints shape this line, and both are load-bearing:
                //   - POST, because sendBeacon cannot issue a PATCH (hence
                //     both endpoints accepting POST).
                //   - text/plain, because it is a CORS-safelisted content
                //     type. An application/json body would trigger a
                //     preflight, and a beacon fired during page teardown
                //     cannot complete one — the telemetry would silently
                //     vanish cross-origin, which is every real deployment.
                //     The back end parses these with force=True to match.
                const blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
                if (navigator.sendBeacon(url, blob)) return;
            } catch (e) { /* fall through to fetch */ }
        }

        try {
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true
            }).then(res => {
                if (!res) return;
                // 4xx (other than a retryable 429) means the server will
                // never accept this payload — drop it rather than let one
                // poison entry retry on every page load for a week. 5xx and
                // network failures stay queued.
                if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
                    dequeue(entry.id);
                }
            }).catch(() => { /* stays queued for the next flush */ });
        } catch (e) {
            // fetch itself threw (very old browser / keepalive body limit)
        }
    }

    function flushQueue(final) {
        if (!enabled) return;
        queue.slice().forEach(e => {
            if (e.visitId) send(e, final);
        });
    }

    // ── Payload builders ─────────────────────────────────────────────────

    function sessionBody() {
        return {
            sessionSeconds: secs(visibleClock.ms()),
            playSeconds: secs(playClock.ms()),
            timeToFirstStartSeconds: firstStartMs === null ? null : secs(firstStartMs),
            gamesStarted: gameIndex
        };
    }

    function gameBody(endCause) {
        if (!current) return null;
        return {
            clientGameId: current.id,
            gameIndex: current.index,
            difficulty: current.meta.difficulty || null,
            skillLevel: current.meta.skillLevel || null,
            mode: current.meta.mode || null,
            challenges: current.meta.challenges || [],
            resumed: !!current.meta.resumed,
            gameVersion: typeof PAGE_VERSION !== 'undefined' ? String(PAGE_VERSION) : null,
            durationSeconds: secs(current.clock.ms()),
            score: current.stats.score || 0,
            lines: current.stats.lines || 0,
            level: current.stats.level || 1,
            pieces: current.pieces || 0,
            endCause: endCause
        };
    }

    function syncSession(final) {
        if (!enabled) return;
        const entry = enqueue('session', sessionBody());
        lastSyncedPlayMs = playClock.ms();
        send(entry, final);
    }

    function syncGame(endCause, final) {
        if (!enabled || !current) return;
        const body = gameBody(endCause);
        if (!body) return;
        const entry = enqueue('game', body);
        send(entry, final);
    }

    // ── Lifecycle hooks (called from game.js) ────────────────────────────

    /** Stop tracking entirely (owner opt-out, headless browser, embed opt-out). */
    function disable() {
        enabled = false;
        queue = [];
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
        try { localStorage.removeItem(QUEUE_KEY); } catch (e) { /* private mode */ }
    }

    /**
     * Hand over the visit row id once the page-load POST answers. Anything
     * recorded before that point was queued with a null visitId; stamp it
     * now and flush, so a player who taps Start before the cold dyno replies
     * still lands their first game.
     */
    function setVisitId(id) {
        if (!enabled || !id || id < 0) return;
        visitId = id;
        let touched = false;
        queue.forEach(e => { if (!e.visitId) { e.visitId = id; touched = true; } });
        if (touched) persistQueue();
        flushQueue(false);
    }

    /**
     * A human game began. `meta` is the same settings object /started sends.
     * The row is written NOW rather than at game over — a session that starts
     * a game and vanishes is precisely the one worth measuring, and it is
     * also the one least likely to deliver an exit beacon.
     */
    function gameStarted(meta) {
        if (!enabled) return;
        // A game already in progress means the player restarted without a
        // game over. Close the old row out rather than orphaning it at
        // in_progress — that state is reserved for "we lost the beacon".
        if (current) {
            current.clock.stop();
            syncGame('abandoned', false);
            current = null;
        }
        gameIndex++;
        syncStep = 0;   // the close-together early steps matter most per game
        current = {
            id: uuid(),
            index: gameIndex,
            meta: meta || {},
            clock: makeClock(),
            pieces: 0,
            stats: { score: 0, lines: 0, level: 1 }
        };
        if (firstStartMs === null) firstStartMs = visibleClock.ms();
        if (!isHidden()) { current.clock.start(); playClock.start(); }
        syncGame('in_progress', false);
        syncSession(false);
        startHeartbeat();
    }

    /**
     * Cheap in-memory update, called from the piece-lock hook. Keeps a live
     * snapshot of score/lines/level so an abandonment beacon can report how
     * far the player actually got, not just how long they were there.
     */
    function piecePlaced(stats) {
        if (!enabled || !current) return;
        current.pieces++;
        if (stats) {
            current.stats.score = stats.score || 0;
            current.stats.lines = stats.lines || 0;
            current.stats.level = stats.level || 1;
        }
    }

    function gamePaused() {
        if (!enabled || !current) return;
        current.clock.stop();
        playClock.stop();
    }

    function gameResumed() {
        if (!enabled || !current || isHidden()) return;
        current.clock.start();
        playClock.start();
    }

    /** Game over. Upgrades the row from in_progress/abandoned to game_over. */
    function gameEnded(stats) {
        if (!enabled || !current) return;
        if (stats) {
            current.stats.score = stats.score != null ? stats.score : current.stats.score;
            current.stats.lines = stats.lines != null ? stats.lines : current.stats.lines;
            current.stats.level = stats.level != null ? stats.level : current.stats.level;
        }
        current.clock.stop();
        playClock.stop();
        syncGame('game_over', false);
        current = null;
        syncSession(false);
        stopHeartbeat();
    }

    // ── Page lifecycle ───────────────────────────────────────────────────

    function onHidden(final) {
        visibleClock.stop();
        if (current) {
            current.clock.stop();
            playClock.stop();
            // Provisional: if they come back and finish, game_over overwrites
            // this. If they never come back, `abandoned` plus the duration
            // already on the row is exactly the stuck-vs-bored signal.
            syncGame('abandoned', final);
        }
        syncSession(final);
        stopHeartbeat();
    }

    function onVisible() {
        visibleClock.start();
        if (current) { current.clock.start(); playClock.start(); startHeartbeat(); }
    }

    function startHeartbeat() {
        if (!enabled || heartbeatTimer || typeof setInterval !== 'function') return;
        heartbeatTimer = setInterval(() => {
            if (!current || isHidden()) return;
            // Escalating gap, so an idle-but-visible tab never re-POSTs
            // unchanged state and a long session doesn't chatter.
            const need = SYNC_STEPS_MS[Math.min(syncStep, SYNC_STEPS_MS.length - 1)];
            if (playClock.ms() - lastSyncedPlayMs < need) return;
            syncStep++;
            syncGame('in_progress', false);
            syncSession(false);
        }, HEARTBEAT_TICK_MS);
    }

    function stopHeartbeat() {
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    }

    function init() {
        // Owner opt-out and headless browsers never produce a visit row, so
        // they must not produce analytics rows either.
        if ((typeof IS_TRACKING_OPTED_OUT !== 'undefined' && IS_TRACKING_OPTED_OUT) ||
            (typeof navigator !== 'undefined' && navigator.webdriver)) {
            enabled = false;
            return;
        }
        queue = loadQueue();
        if (!isHidden()) visibleClock.start();

        if (typeof document !== 'undefined' && document.addEventListener) {
            document.addEventListener('visibilitychange', () => {
                if (isHidden()) onHidden(false); else onVisible();
            });
        }
        if (typeof window !== 'undefined' && window.addEventListener) {
            // pagehide is the last reliable hook on iOS (where unload never
            // fires). persisted=true means bfcache — the page may come back,
            // so the state we send is provisional exactly like a tab-hide.
            window.addEventListener('pagehide', () => onHidden(true));
        }
        // Stranded rows from a previous session (killed mid-flight, or a
        // sendBeacon we could never confirm). Server-side merge makes a
        // duplicate harmless.
        flushQueue(false);
    }

    /** Test/debug seam — the Node suite in tantro/tests asserts on this. */
    function getState() {
        return {
            enabled: enabled,
            visitId: visitId,
            gameIndex: gameIndex,
            hasCurrentGame: !!current,
            currentPieces: current ? current.pieces : 0,
            visibleMs: visibleClock.ms(),
            playMs: playClock.ms(),
            firstStartMs: firstStartMs,
            queueLength: queue.length,
            queue: queue.slice()
        };
    }

    return {
        init, disable, setVisitId,
        gameStarted, piecePlaced, gamePaused, gameResumed, gameEnded,
        getState,
        // Exposed for the page-lifecycle tests; game.js does not call these.
        _onHidden: onHidden, _onVisible: onVisible
    };
})();

if (typeof window !== 'undefined') window.Analytics = Analytics;

// Self-initialize on load, mirroring ErrorBoundary in config.js: the visible
// clock has to start at page load, which is before game.js runs. The
// localStorage opt-out and navigator.webdriver are both readable here; the
// itch-embed parent-frame opt-out is not, so game.js calls disable() for that
// case once it has evaluated it.
Analytics.init();

