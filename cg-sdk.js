/**
 * cg-sdk.js — CrazyGames HTML5 SDK (v3) wrapper. Ported from Circuitousness.
 *
 * ONLY active on crazygames.com origins (IS_CRAZYGAMES from config.js).
 * Everywhere else this module is a pure no-op facade: no SDK script is
 * injected, no external request is made, and every method returns
 * immediately — other sites are byte-for-byte unaffected at runtime.
 *
 * What it feeds CrazyGames (Basic Launch: optional; Full Launch: required):
 *   loadingStart/Stop   — their measured load time ("loads in <10s" is an
 *                         explicit benchmark; the first gameplayStart also
 *                         determines the game's initial loading size).
 *   gameplayStart/Stop  — tells their site when active play is happening
 *                         so it defers resource-intensive work; also their
 *                         engagement signal.
 *   happytime()         — page-level celebration (confetti). Their docs say
 *                         to use it SPARINGLY — we fire it only when a run
 *                         ranks on the global top-20 leaderboard.
 *
 * Timing: the SDK script loads async from their CDN, so game code may call
 * gameplayStart() before init resolves. The facade therefore tracks desired
 * state in booleans and RECONCILES once the SDK is ready — events aren't
 * queued, only the latest state is replayed, which is all the SDK cares about.
 *
 * Call sites (game.js):
 *   startGame()   → gameplayStart (human games only — the AI demo loop and
 *                   replays fire nothing)
 *   gameOver()    → gameplayStop
 *   togglePause() → overlayPause / overlayResume
 *   top-20 rank   → happytime (the isTopTen branch before name entry)
 */
const CgSdk = (() => {
    const active = (typeof IS_CRAZYGAMES !== 'undefined' && IS_CRAZYGAMES);

    let sdk = null;               // window.CrazyGames.SDK once init() resolves
    let playing = false;          // our belief: is gameplay active right now
    let pausedByOverlay = false;  // gameplay suspended by pause/modal
    let loadingStopped = false;   // loadingStop already reported (dedupe)

    // Every SDK call is best-effort: a CDN hiccup or API change must never
    // break the game itself, so everything routes through this guard.
    function call(fn) {
        if (!sdk) return;
        try { fn(); } catch (e) { /* SDK failure is never fatal */ }
    }

    function gameplayStart() {
        if (playing && !pausedByOverlay) return;
        playing = true;
        pausedByOverlay = false;
        call(() => sdk.game.gameplayStart());
    }
    function gameplayStop() {
        if (!playing) return;
        playing = false;
        // Already reported stopped while paused — don't double-fire.
        const alreadyStopped = pausedByOverlay;
        pausedByOverlay = false;
        if (!alreadyStopped) call(() => sdk.game.gameplayStop());
    }
    // Pause/modal overlays that suspend play WITHOUT ending the run. Safe to
    // call from the menu too: overlayPause no-ops unless gameplay was active.
    function overlayPause() {
        if (!playing || pausedByOverlay) return;
        pausedByOverlay = true;
        call(() => sdk.game.gameplayStop());
    }
    function overlayResume() {
        if (!pausedByOverlay) return;
        pausedByOverlay = false;
        if (playing) call(() => sdk.game.gameplayStart());
    }
    function happytime() {
        call(() => sdk.game.happytime());
    }
    function loadingStop() {
        if (loadingStopped) return;
        loadingStopped = true;
        call(() => sdk.game.loadingStop());
    }

    if (active) {
        // "Loading finished" = all static assets in (window load). If the
        // SDK initializes after load already fired, the reconcile below
        // reports start+stop back-to-back — still accurate: loading IS
        // over by then.
        if (document.readyState !== 'complete') {
            window.addEventListener('load', () => loadingStop());
        }

        const s = document.createElement('script');
        s.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
        s.async = true;
        s.onload = async () => {
            try {
                if (!window.CrazyGames || !window.CrazyGames.SDK) return;
                await window.CrazyGames.SDK.init();
                sdk = window.CrazyGames.SDK;
            } catch (e) {
                return; // SDK unavailable — facade stays inert
            }
            // Reconcile current state now that calls can actually go out.
            // Order matters: loading events first so the first
            // gameplayStart (= their loading-size marker) lands after them.
            call(() => sdk.game.loadingStart());
            if (loadingStopped || document.readyState === 'complete') {
                loadingStopped = true;
                call(() => sdk.game.loadingStop());
            }
            if (playing && !pausedByOverlay) {
                call(() => sdk.game.gameplayStart());
            }
            // Container mute button → audio.js's external-mute layer (a
            // volume-0 override that outranks the in-game toggles, per CG's
            // rule, without touching the player's saved settings). Initial
            // state first — the player may have muted the container on a
            // previous game — then live changes via the settings listener.
            // Requires the "supports muting audio through SDK" box CHECKED
            // on the CG submission form.
            const applyMuteSetting = (settings) => {
                const m = !!(settings && settings.muteAudio);
                if (typeof AudioSystem !== 'undefined' && AudioSystem.setExternalMuted) {
                    AudioSystem.setExternalMuted(m);
                }
            };
            call(() => applyMuteSetting(sdk.game.settings));
            call(() => sdk.game.addSettingsChangeListener(applyMuteSetting));
        };
        document.head.appendChild(s);
    }

    return { gameplayStart, gameplayStop, overlayPause, overlayResume, happytime };
})();
