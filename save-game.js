/**
 * save-game.js — paused-game persistence ("Resume Game") for TANTЯO
 *
 * When the player pauses a game, a full snapshot of the game state is
 * written to localStorage. If they then leave (close the tab, kill the
 * PWA), the mode menu offers a Resume Game card on their next visit that
 * restores the board, current/next pieces, score, challenge state, and
 * the in-progress leaderboard recording exactly where they left off.
 *
 * Save lifecycle:
 *   - written every time the game becomes paused (P/Escape/pause button,
 *     tap, gamepad, or opening Settings mid-game) — game.js calls
 *     SaveGame.onPauseChanged() at every pause-state flip
 *   - cleared on unpause (so the save only exists while paused — no
 *     rewind-scumming), on game over, and when a fresh human game starts
 *   - resume re-enters through startGame(mode, resumeSave); startGame
 *     runs its full normal init, then calls SaveGame.applySnapshot() to
 *     overlay the saved state, and the resume lands in the paused state
 *     so the player can take stock before play continues
 *
 * Never saved: AI/tuning games, replays, and moments when a transient
 * animation is in flight (line clears, gravity, weather events, hard
 * drops) — restoring half-finished animation state isn't feasible, and
 * those windows last well under a second.
 *
 * Relies on game.js top-level bindings via the shared global lexical
 * scope (classic scripts) — this file must load AFTER game.js.
 */

const SaveGame = (() => {
    // Hardcoded 'tantro' prefix matches every other localStorage key in
    // this project (tantro_difficulty, tantro_track_optout, ...).
    const SAVE_KEY = 'tantro_paused_game_v1';

    const VALID_MODES = ['drizzle', 'downpour', 'hailstorm', 'blizzard', 'hurricane'];

    /**
     * True while any transient animation owns part of the game state.
     * Snapshots taken during these windows would restore into a broken
     * half-animated board, so save() refuses them.
     */
    function animationInFlight() {
        return animatingLines || pendingLineCheck || gravityAnimating || hardDropping ||
               tornadoActive || earthquakeActive ||
               blackHoleActive || blackHoleAnimating ||
               tsunamiActive || tsunamiAnimating ||
               volcanoActive || volcanoAnimating;
    }

    /**
     * Deep-copy a 2D grid (rows of primitives) for the snapshot.
     */
    function copyGrid(grid) {
        return grid.map(row => row.slice());
    }

    /**
     * Write the paused game to localStorage. No-op unless a human game is
     * running, paused, and animation-free.
     */
    function save() {
        if (!gameRunning || !paused) return;
        if (aiModeEnabled || aiTuningMode) return;
        if (typeof GameReplay !== 'undefined' && GameReplay.isActive()) return;
        if (gameOverPending || gameOverInProgress) return;
        if (!currentPiece || animationInFlight()) return;

        const now = Date.now();

        // Amnesia fade ages (ms since each cell was stamped) — saved so a
        // reload can't be used to un-fade the stack in Amnesia mode.
        let amnesiaAges = null;
        const amnesiaOn = challengeMode === 'amnesia' || activeChallenges.has('amnesia');
        if (amnesiaOn && window.ChallengeEffects && ChallengeEffects.Amnesia) {
            const stamps = ChallengeEffects.Amnesia.getStampGrid();
            amnesiaAges = stamps.map(row => row.map(s => (s === null ? null : now - s)));
        }

        const snap = {
            v: 1,
            gameVersion: PAGE_VERSION,
            savedAtMs: now,
            gameMode: gameMode,
            skillLevel: skillLevel,
            challengeMode: challengeMode,
            challenges: Array.from(activeChallenges),
            board: copyGrid(board),
            isRandomBlock: copyGrid(isRandomBlock),
            latticeBlocks: copyGrid(isLatticeBlock),
            amnesiaAges: amnesiaAges,
            currentPiece: currentPiece,
            nextPieceQueue: nextPieceQueue,
            score: score,
            lines: lines,
            level: level,
            currentGameLevel: currentGameLevel,
            strikeCount: strikeCount,
            tsunamiCount: tsunamiCount,
            blackHoleCount: blackHoleCount,
            volcanoCount: volcanoCount,
            supermassiveBlackHoleCount: supermassiveBlackHoleCount,
            superVolcanoCount: superVolcanoCount,
            tornadoTouchdownCount: tornadoTouchdownCount,
            weatherEventGracePeriod: weatherEventGracePeriod,
            speedBonusTotal: speedBonusTotal,
            speedBonusPieceCount: speedBonusPieceCount,
            speedBonusAverage: speedBonusAverage,
            // Music on/off ('none' = off) is NOT otherwise persisted — the
            // intro toggle resets to ON every page load, which would
            // silently re-enable music on a resumed game.
            musicValue: (musicSelect && typeof musicSelect.value === 'string') ? musicSelect.value : null,
            elapsedMs: now - gameStartTime,
            pieceElapsedMs: pieceSpawnTime > 0 ? now - pieceSpawnTime : 0,
            recorder: (typeof GameRecorder !== 'undefined' && GameRecorder.snapshot)
                ? GameRecorder.snapshot() : null
        };

        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
        } catch (e) {
            // Quota — the recording is far and away the heaviest field.
            // Drop it and retry: the resume still works; a fresh recording
            // starts at the resume point, so the eventual leaderboard
            // replay just begins mid-game.
            try {
                snap.recorder = null;
                snap.recorderDropped = true;
                localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
            } catch (e2) { /* storage truly unavailable — no resume */ }
        }
        refreshResumeUI();
    }

    /**
     * Read and validate the saved game. Returns null (and never throws)
     * on anything malformed — private mode, old formats, tampered data.
     */
    function load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return null;
            const snap = JSON.parse(raw);
            if (!snap || snap.v !== 1) return null;
            if (VALID_MODES.indexOf(snap.gameMode) === -1) return null;
            const cols = (snap.gameMode === 'blizzard' || snap.gameMode === 'hurricane') ? 12 : 10;
            if (!Array.isArray(snap.board) || snap.board.length !== 20) return null;
            if (!snap.board.every(row => Array.isArray(row) && row.length === cols)) return null;
            if (!snap.currentPiece || !Array.isArray(snap.currentPiece.shape)) return null;
            if (!Array.isArray(snap.nextPieceQueue)) return null;
            if (!(snap.score >= 0) || !(snap.lines >= 0) || !(snap.level >= 1)) return null;
            return snap;
        } catch (e) {
            return null;
        }
    }

    function clear() {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* private mode */ }
        refreshResumeUI();
    }

    /**
     * Called by game.js after every pause-state flip. Paused → snapshot;
     * unpaused → the save is spent (playing on invalidates it).
     */
    function onPauseChanged() {
        if (!gameRunning) return;
        // Replays and AI/tuning games run with gameRunning=true — their
        // pause flips must never touch (especially clear) a real game's save.
        if (typeof GameReplay !== 'undefined' && GameReplay.isActive()) return;
        if (aiModeEnabled || aiTuningMode) return;
        if (paused) save();
        else clear();
    }

    /**
     * Overlay the saved state onto a freshly initialized game. Called by
     * startGame(mode, resumeSave) after its normal init, so every module
     * (challenges, starfield, histogram, recorder) is already wired for
     * the right difficulty/challenge set — this only rewrites state.
     */
    function applySnapshot(snap) {
        const now = Date.now();

        // Grids are written cell-by-cell into the arrays initBoard()
        // created: isLatticeBlock ALIASES ChallengeEffects.Lattice.grid
        // and other modules hold references too, so never reassign them.
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                board[y][x] = snap.board[y][x];
                isRandomBlock[y][x] = !!(snap.isRandomBlock && snap.isRandomBlock[y] && snap.isRandomBlock[y][x]);
                isLatticeBlock[y][x] = !!(snap.latticeBlocks && snap.latticeBlocks[y] && snap.latticeBlocks[y][x]);
                fadingBlocks[y][x] = null;
            }
        }

        // Amnesia fade ages — re-anchor to now so time away didn't fade
        // anything, but the pre-pause fade progress is preserved.
        if (snap.amnesiaAges && window.ChallengeEffects && ChallengeEffects.Amnesia) {
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    const age = snap.amnesiaAges[y] ? snap.amnesiaAges[y][x] : null;
                    if (age !== null && age !== undefined) {
                        ChallengeEffects.Amnesia.restoreCell(x, y, now - age);
                    }
                }
            }
        }

        score = snap.score;
        lines = snap.lines;
        level = snap.level;
        currentGameLevel = snap.currentGameLevel || snap.level;
        StarfieldSystem.setCurrentGameLevel(currentGameLevel);
        strikeCount = snap.strikeCount || 0;
        tsunamiCount = snap.tsunamiCount || 0;
        blackHoleCount = snap.blackHoleCount || 0;
        volcanoCount = snap.volcanoCount || 0;
        supermassiveBlackHoleCount = snap.supermassiveBlackHoleCount || 0;
        superVolcanoCount = snap.superVolcanoCount || 0;
        tornadoTouchdownCount = snap.tornadoTouchdownCount || 0;
        weatherEventGracePeriod = snap.weatherEventGracePeriod || 0;
        speedBonusTotal = snap.speedBonusTotal || 0;
        speedBonusPieceCount = snap.speedBonusPieceCount || 0;
        speedBonusAverage = snap.speedBonusAverage || 1.0;
        dropInterval = calculateDropInterval(lines);
        gameStartTime = now - (snap.elapsedMs || 0);

        currentPiece = snap.currentPiece;
        nextPieceQueue = snap.nextPieceQueue;
        pieceSpawnTime = now - (snap.pieceElapsedMs || 0);
        smoothDropOffset = 0;

        // The startGame() flow just began a fresh recording with one
        // spawn entry — replace it with the saved timeline so the
        // eventual leaderboard replay covers the whole game. If the
        // recording was dropped for quota, the fresh one simply
        // continues from here.
        if (snap.recorder && typeof GameRecorder !== 'undefined' && GameRecorder.restoreSnapshot) {
            GameRecorder.restoreSnapshot(snap.recorder);
        }

        // startGame showed the Sun's stats card for a level-1 start;
        // stale for a mid-journey resume.
        if (currentGameLevel > 1) StarfieldSystem.hidePlanetStats();

        updateStats();
        drawNextPiece();
    }

    /**
     * Resume the saved game (from the intro screen or the mode menu).
     * Intro-screen resumes route through dismissIntroScreen so they get
     * the same audio-blessing/music/fullscreen treatment as a fresh
     * start. Either way the game lands paused, so the player unpauses
     * (tap / any key / gamepad) when ready.
     */
    function resume() {
        const snap = load();
        if (!snap) { refreshResumeUI(); return; }
        if (gameRunning) return;
        // Restore the music on/off state the game was paused with, BEFORE
        // the intro-dismissal flow reads musicSelect (it starts menu music
        // for non-'none' values). Skipped if the saved value no longer
        // exists in the dropdown (e.g. a retired playlist option).
        if (typeof snap.musicValue === 'string' && musicSelect &&
            Array.from(musicSelect.options).some(o => o.value === snap.musicValue)) {
            musicSelect.value = snap.musicValue;
            const introMusic = document.getElementById('introMusicCheckbox');
            if (introMusic) introMusic.checked = snap.musicValue !== 'none';
        }
        const overlay = document.getElementById('startOverlay');
        const introVisible = overlay && overlay.style.display !== 'none' &&
            window.getComputedStyle(overlay).display !== 'none';
        if (introVisible && typeof window.dismissIntroScreen === 'function') {
            window.dismissIntroScreen(snap);
        } else {
            startGame(snap.gameMode, snap);
            if (!paused) togglePause();
        }
    }

    /**
     * Show/hide both Resume rows (intro screen + mode menu) and paint
     * their detail lines.
     */
    function refreshResumeUI() {
        const snap = load();
        for (const prefix of ['menu', 'intro']) {
            const row = document.getElementById(prefix + 'ResumeRow');
            if (!row) continue;
            row.style.display = snap ? 'flex' : 'none';
            if (!snap) continue;
            const detailEl = document.getElementById(prefix + 'ResumeDetail');
            if (detailEl) {
                // Same ₿ format as the HUD score display (formatAsBitcoin
                // is a game.js top-level function, hoisted before we run)
                const scoreText = (typeof formatAsBitcoin === 'function')
                    ? formatAsBitcoin(snap.score)
                    : String(snap.score);
                let text = 'Score: ' + scoreText + ' · Level: ' + snap.level;
                try {
                    text = I18n.t('menu.resumeDetail', { score: scoreText, level: snap.level });
                } catch (e) { /* i18n not ready — English fallback above */ }
                detailEl.textContent = text;
            }
            const discardBtn = document.getElementById(prefix + 'ResumeDiscardBtn');
            if (discardBtn) {
                try {
                    discardBtn.title = I18n.t('menu.resumeDiscard');
                    discardBtn.setAttribute('aria-label', discardBtn.title);
                } catch (e) { /* keep HTML fallback */ }
            }
        }
    }

    // ── Button wiring, intro + menu rows (scripts run after the DOM is parsed) ──
    for (const prefix of ['menu', 'intro']) {
        const resumeBtn = document.getElementById(prefix + 'ResumeGameBtn');
        const discardBtn = document.getElementById(prefix + 'ResumeDiscardBtn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                resume();
            });
            resumeBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                resume();
            }, { passive: false });
        }
        if (discardBtn) {
            discardBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                clear();
            });
            discardBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                clear();
            }, { passive: false });
        }
    }
    refreshResumeUI();
    // Repaint after I18n.init picks the player's language (i18n.js
    // registered its DOMContentLoaded listener first, so it runs first) —
    // the detail line above may have painted with the English fallback.
    document.addEventListener('DOMContentLoaded', refreshResumeUI);

    return {
        save,
        load,
        clear,
        onPauseChanged,
        applySnapshot,
        resume,
        refreshResumeUI
    };
})();

// Window mirror for modules that use window.* guards
if (typeof window !== 'undefined') {
    window.SaveGame = SaveGame;
}
