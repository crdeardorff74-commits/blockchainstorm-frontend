/**
 * replay.js - Deterministic Replay System for TaNTЯiS
 *
 * Replays recorded games by running an actual game with recorded pieces
 * and inputs injected at timestamps. Supports board snapshot syncing,
 * special event replay (tornado, earthquake, volcano), and music track
 * sequencing.
 *
 * Accesses game globals directly (board, currentPiece, score, etc.)
 * since they are already global in game.js.
 *
 * Exports: GameReplay
 */

const GameReplay = (function () {
    'use strict';

    // ==================== PRIVATE STATE ====================

    let replayActive = false;
    let replayPaused = false;
    let replayData = null;
    let replaySavedAIMode = false;
    let replaySavedChallengeMode = 'normal';
    let replaySavedActiveChallenges = new Set();
    let replaySavedVisualSettings = {
        faceOpacity: 0.42,
        stormEffects: true,
        cameraReversed: false,
        starSpeed: 1.0,
        minimalistMode: false,
        palette: 'classic'
    };

    // v2.0 Piece-indexed replay state
    let replayPieceData = [];
    let replayPieceIndex = 0;
    let replayPieceSpawnTime = 0;
    let replayPieceElapsedTime = 0;
    let replayInputIndex = 0;
    let replayRandomEventIndex = 0;
    let replayMusicTracks = [];
    let replayMusicIndex = 0;
    let replayGameStartTime = 0;
    let replayFWordSongId = null;
    let replayCompleteShown = false;

    // Replay timing speedup: inputs executed faster than recorded to prevent drift
    let replayInputSpeedup = 1.0 / 0.95;

    // Special event replay data
    let replayEarthquakeCrack = null;
    let replayEarthquakeShiftType = null;
    let replaySkipNextSync = false;
    let replayTornadoSpawnData = null;
    let replayTornadoDirChanges = [];
    let replayTornadoDirIndex = 0;
    let replayTornadoDrops = [];
    let replayTornadoDropIndex = 0;
    let replayLavaProjectiles = [];
    let replayLavaProjectileIndex = 0;

    // Gravity animation tracking
    let replayGravityBoardLocked = false;
    let replayAnimatingCells = new Set();

    // ==================== STATE ACCESSORS ====================

    function isActive() { return replayActive; }
    function isPaused() { return replayPaused; }

    function getFWordSongId() { return replayFWordSongId; }

    function setSkipNextSync(val) { replaySkipNextSync = !!val; }

    function hasPendingInputs() {
        if (!replayActive) return false;
        if (replayPieceIndex >= replayPieceData.length) return false;
        const entry = replayPieceData[replayPieceIndex];
        return entry && replayInputIndex < entry.inputs.length;
    }

    /** Returns {vx, vy} or null. Advances index. */
    function consumeLavaProjectile() {
        if (replayLavaProjectileIndex < replayLavaProjectiles.length) {
            const proj = replayLavaProjectiles[replayLavaProjectileIndex++];
            Logger.debug('🌋 Replay: Using recorded projectile', replayLavaProjectileIndex,
                'vx:', proj.vx.toFixed(2), 'vy:', proj.vy.toFixed(2));
            return proj;
        }
        return null;
    }

    /** Returns {x, snakeDirection, snakeChangeCounter} or null. Clears after use. */
    function consumeTornadoSpawnData() {
        if (replayTornadoSpawnData) {
            const d = replayTornadoSpawnData;
            replayTornadoSpawnData = null;
            return d;
        }
        return null;
    }

    /** Returns {newDirection, newCounter} or null. Advances index. */
    function consumeTornadoDirChange() {
        if (replayTornadoDirIndex < replayTornadoDirChanges.length) {
            return replayTornadoDirChanges[replayTornadoDirIndex++];
        }
        return null;
    }

    /** Returns {targetX} or null. Advances index. */
    function consumeTornadoDrop() {
        if (replayTornadoDropIndex < replayTornadoDrops.length) {
            return replayTornadoDrops[replayTornadoDropIndex++];
        }
        return null;
    }

    /** Returns crack array or null. Clears after use. */
    function consumeEarthquakeCrack() {
        if (replayEarthquakeCrack) {
            const c = replayEarthquakeCrack;
            replayEarthquakeCrack = null;
            return c;
        }
        return null;
    }

    /** Returns shift type string or null. Clears after use. */
    function consumeEarthquakeShiftType() {
        if (replayEarthquakeShiftType) {
            const s = replayEarthquakeShiftType;
            replayEarthquakeShiftType = null;
            return s;
        }
        return null;
    }

    // ==================== DECOMPRESS HELPER ====================

    function decompressKeyframeBoard(compressed, rows, cols) {
        const newBoard = Array.from({ length: rows }, () => Array(cols).fill(null));
        if (!compressed) return newBoard;
        compressed.forEach(cell => {
            if (cell.y >= 0 && cell.y < rows && cell.x >= 0 && cell.x < cols) {
                newBoard[cell.y][cell.x] = cell.c;
            }
        });
        return newBoard;
    }

    // ==================== START REPLAY ====================

    function start(recording) {
      try {
        Logger.info('🎬 Starting deterministic replay (v2.0):', recording.username, recording.difficulty, recording.skill_level);

        const recData = recording.recording_data;
        if (!recData) {
            Logger.error('🎬 No recording data');
            alert('This recording does not contain replay data.');
            return;
        }

        const isV2 = recData.version === '2.0' && recData.pieceData;
        if (!isV2) {
            Logger.error('🎬 Recording is not v2.0 format - cannot replay');
            alert('This recording uses an older format that is no longer supported.');
            return;
        }

        Logger.info('🎬 v2.0 recording has:', recData.pieceData.length, 'pieces');

        // Store replay data
        replayData = recording;

        // Set up piece-indexed replay data
        replayPieceData = (recData.pieceData || []).map(p => ({
            ...p,
            inputs: p.inputs || [],
            randomEvents: p.randomEvents || [],
            events: p.events || []
        }));
        replayPieceIndex = 0;
        replayInputIndex = 0;
        replayRandomEventIndex = 0;
        replayPieceSpawnTime = 0;
        replayPieceElapsedTime = 0;
        replayInputSpeedup = 1.0 / 0.95;

        replayMusicTracks = recData.musicTracks || [];
        replayMusicIndex = 0;
        replayGameStartTime = 0;
        replayFWordSongId = recData.fWordSongId || null;

        // Clear special event replay arrays
        replayTornadoSpawnData = null;
        replayTornadoDirChanges = [];
        replayTornadoDirIndex = 0;
        replayTornadoDrops = [];
        replayTornadoDropIndex = 0;
        replayLavaProjectiles = [];
        replayLavaProjectileIndex = 0;
        replayEarthquakeCrack = null;
        replayEarthquakeShiftType = null;
        replaySkipNextSync = false;

        replayPaused = false;

        // Hide any existing overlays/menus
        if (gameOverDiv) gameOverDiv.style.display = 'none';
        if (modeMenu) modeMenu.classList.add('hidden');
        if (startOverlay) startOverlay.style.display = 'none';

        if (window.leaderboard && window.leaderboard.hideLeaderboard) {
            window.leaderboard.hideLeaderboard();
        }

        // Configure game mode from recording
        gameMode = recording.difficulty;
        skillLevel = recording.skill_level;
        window.skillLevel = recording.skill_level;

        // Set palette from recording
        if (recData.palette && typeof ColorPalettes !== 'undefined') {
            replaySavedVisualSettings.palette = currentPaletteId;
            initColorsFromPalette(recData.palette);
            updatePalettePreview();
        }

        // Save current visual settings
        replaySavedVisualSettings.faceOpacity = faceOpacity;
        replaySavedVisualSettings.stormEffects = stormEffectsToggle ? stormEffectsToggle.checked : true;
        replaySavedVisualSettings.cameraReversed = cameraReversed;
        replaySavedVisualSettings.starSpeed = starSpeedSlider ? parseFloat(starSpeedSlider.value) : 1.0;
        replaySavedVisualSettings.minimalistMode = minimalistMode;

        // Apply recorded visual settings
        const vs = recData.visualSettings || {};

        if (vs.faceOpacity !== undefined) {
            faceOpacity = vs.faceOpacity;
            if (opacitySlider) opacitySlider.value = Math.round(faceOpacity * 100);
        }
        if (vs.stormEffects !== undefined && stormEffectsToggle) {
            stormEffectsToggle.checked = vs.stormEffects;
        }
        if (vs.cameraReversed !== undefined) {
            cameraReversed = vs.cameraReversed;
            if (typeof StarfieldSystem !== 'undefined') StarfieldSystem.setCameraReversed(cameraReversed);
            const ct = document.getElementById('cameraOrientationToggle');
            if (ct) ct.checked = cameraReversed;
        }
        if (vs.starSpeed !== undefined) {
            if (starSpeedSlider) starSpeedSlider.value = vs.starSpeed;
            if (typeof StarfieldSystem !== 'undefined') {
                if (vs.starSpeed === 0) StarfieldSystem.setStarsEnabled(false);
                else { StarfieldSystem.setStarsEnabled(true); StarfieldSystem.setStarSpeed(vs.starSpeed); }
            }
        }
        if (vs.minimalistMode !== undefined) {
            minimalistMode = vs.minimalistMode;
            if (minimalistToggle) minimalistToggle.checked = minimalistMode;
            if (typeof applyMinimalistMode === 'function') applyMinimalistMode();
            if (typeof StarfieldSystem !== 'undefined') StarfieldSystem.setMinimalistMode(minimalistMode);
        }

        COLS = (gameMode === 'blizzard' || gameMode === 'hurricane') ? 12 : 10;
        updateCanvasSize();

        // Save challenge mode state
        replaySavedChallengeMode = challengeMode;
        replaySavedActiveChallenges = new Set(activeChallenges);

        // Set challenge mode from recording
        activeChallenges.clear();
        if (recData.challenges && recData.challenges.length > 0) {
            recData.challenges.forEach(c => activeChallenges.add(c));
            challengeMode = recData.challenges.length > 1 ? 'combo' : recData.challenges[0];
        } else {
            challengeMode = 'normal';
        }

        // Apply challenge visual effects
        document.documentElement.classList.remove('stranger-mode');
        StarfieldSystem.setStrangerMode(false);
        canvas.classList.remove('thinner-mode', 'thicker-mode', 'longago-mode', 'comingsoon-mode', 'nervous-active');
        if (window.ChallengeEffects && ChallengeEffects.Rubber) {
            ChallengeEffects.Rubber.reset();
            // Must init with game state ref — replay may run before startGame() is ever called
            ChallengeEffects.Rubber.init({
                get ROWS() { return ROWS; }, get COLS() { return COLS; },
                get board() { return board; }, get isRandomBlock() { return isRandomBlock; },
                getCtx: () => ctx,
                getBlockSize: () => BLOCK_SIZE,
                getFaceOpacity,
                drawSolidShape,
                playSoundEffect: (name) => playSoundEffect(name, soundToggle),
                applyGravity,
                isYesAndActive: () => {
                    const ym = challengeMode === 'yesand' || activeChallenges.has('yesand');
                    return ym && window.ChallengeEffects && !!ChallengeEffects.YesAnd;
                },
                spawnYesAndLimbs: (piece) => ChallengeEffects.YesAnd && ChallengeEffects.YesAnd.spawnLimbs(piece)
            });
        }
        if (window.ChallengeEffects && ChallengeEffects.Phantom) ChallengeEffects.Phantom.reset();
        // Init all gameRef-dependent challenge modules (replay may run before startGame)
        if (window.ChallengeEffects && ChallengeEffects.SixSeven) {
            ChallengeEffects.SixSeven.init({ get COLS() { return COLS; }, randomColor });
        }
        if (window.ChallengeEffects && ChallengeEffects.Gremlins) {
            ChallengeEffects.Gremlins.init({
                get board() { return board; }, get isRandomBlock() { return isRandomBlock; },
                get fadingBlocks() { return fadingBlocks; },
                get ROWS() { return ROWS; }, get COLS() { return COLS; },
                get skillLevel() { return skillLevel; },
                randomColor, applyGravity,
                get audioContext() { return audioContext; },
                soundEnabled: () => soundToggle.checked,
                recorder: {
                    isActive: () => window.GameRecorder && window.GameRecorder.isActive(),
                    recordGremlinBlock: (x, y, c) => window.GameRecorder && window.GameRecorder.recordGremlinBlock(x, y, c),
                    recordChallengeEvent: (t, d) => window.GameRecorder && window.GameRecorder.recordChallengeEvent(t, d)
                }
            });
        }
        if (window.ChallengeEffects && ChallengeEffects.Mercurial) {
            ChallengeEffects.Mercurial.init({
                randomColor,
                playRotateSound: () => playSoundEffect('rotate', soundToggle)
            });
        }
        if (window.ChallengeEffects && ChallengeEffects.YesAnd) {
            ChallengeEffects.YesAnd.init({
                get ROWS() { return ROWS; }, get COLS() { return COLS; },
                get board() { return board; }, get isRandomBlock() { return isRandomBlock; },
                get fadingBlocks() { return fadingBlocks; },
                get skillLevel() { return skillLevel; },
                getAllBlobs,
                playSoundEffect: (name) => playSoundEffect(name, soundToggle)
            });
        }
        nervousVibrateOffset = 0;
        StormEffects.reset();
        if (window.ChallengeEffects && ChallengeEffects.Vertigo) ChallengeEffects.Vertigo.stop();

        if (challengeMode === 'stranger' || activeChallenges.has('stranger')) {
            document.documentElement.classList.add('stranger-mode');
            StarfieldSystem.setStrangerMode(true);
        }
        if (challengeMode === 'phantom' || activeChallenges.has('phantom')) {
            if (window.ChallengeEffects && ChallengeEffects.Phantom) ChallengeEffects.Phantom.triggerFade();
        }
        if (challengeMode === 'thinner' || activeChallenges.has('thinner')) canvas.classList.add('thinner-mode');
        if (challengeMode === 'thicker' || activeChallenges.has('thicker')) canvas.classList.add('thicker-mode');
        if (challengeMode === 'longago' || activeChallenges.has('longago')) canvas.classList.add('longago-mode');
        if (challengeMode === 'comingsoon' || activeChallenges.has('comingsoon')) canvas.classList.add('comingsoon-mode');
        if (challengeMode === 'vertigo' || activeChallenges.has('vertigo')) {
            if (window.ChallengeEffects && ChallengeEffects.Vertigo) ChallengeEffects.Vertigo.start();
        }

        // Set replay active BEFORE starting game
        replayActive = true;
        replayCompleteShown = false;

        // Disable AI mode during replay
        replaySavedAIMode = aiModeEnabled;
        aiModeEnabled = false;

        // Reset game state
        board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        isRandomBlock = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
        if (window.ChallengeEffects && ChallengeEffects.Lattice) {
            ChallengeEffects.Lattice.init(ROWS, COLS);
            isLatticeBlock = ChallengeEffects.Lattice.grid;
        } else {
            isLatticeBlock = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
        }
        fadingBlocks = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        if (window.ChallengeEffects && ChallengeEffects.Amnesia) ChallengeEffects.Amnesia.init(ROWS, COLS);
        score = 0; lines = 0; level = 1;
        strikeCount = 0; tsunamiCount = 0; blackHoleCount = 0; volcanoCount = 0;
        supermassiveBlackHoleCount = 0; superVolcanoCount = 0; volcanoIsSuper = false;
        dropCounter = 0; dropInterval = 1000; gameOverPending = false;
        updateStats();

        // Clear active animations
        tsunamiAnimating = false; blackHoleAnimating = false; blackHoleActive = false;
        volcanoAnimating = false; gravityAnimating = false;
        fallingBlocks = []; animatingLines = false; lineAnimations = [];

        // Reset earthquake state
        earthquakeActive = false; earthquakePhase = 'shake';
        earthquakeShakeProgress = 0; earthquakeShakeIntensity = 0;
        earthquakeCrack = []; earthquakeCrackProgress = 0; earthquakeCrackMap.clear();
        earthquakeShiftProgress = 0; earthquakeLeftBlocks = []; earthquakeRightBlocks = [];

        // Reset tornado state
        tornadoActive = false; tornadoState = 'descending'; tornadoSpeed = 8;
        tornadoY = 0; tornadoX = 0;
        tornadoPickedBlob = null; tornadoFinalPositions = null;
        tornadoFinalCenterX = null; tornadoFinalCenterY = null;
        tornadoFadeProgress = 0; tornadoSnakeVelocity = 0;
        tornadoSnakeDirection = 1; tornadoSnakeChangeCounter = 0;
        tornadoParticles = [];
        tornadoLiftStartY = 0; tornadoLiftHeight = 0;
        tornadoOrbitAngle = 0; tornadoOrbitRadius = 0; tornadoOrbitStartTime = null;
        tornadoBlobRotation = 0; tornadoVerticalRotation = 0;
        tornadoDropTargetX = 0; tornadoDropStartY = 0; tornadoDropVelocity = 0;
        if (typeof stopTornadoWind === 'function') stopTornadoWind();

        // Reset volcano state
        volcanoActive = false; volcanoProjectiles = [];

        // Spawn first piece
        spawnPiece();

        // Start game running
        gameRunning = true;
        currentGameLevel = 1;
        StarfieldSystem.setCurrentGameLevel(1);
        StarfieldSystem.reset();
        StarfieldSystem.hidePlanetStats();
        StarfieldSystem.setGameRunning(true);
        setGameInProgress(true);
        document.body.classList.add('game-running');
        document.body.classList.add('game-started');
        gameOverDiv.style.display = 'none';
        modeMenu.classList.add('hidden');
        toggleUIElements(false);
        stopMenuMusic();

        // Initialize histogram for replay
        Histogram.init({ canvas: histogramCanvas, colorSet: currentColorSet });

        // Set up recorded music tracks
        if (replayMusicTracks && replayMusicTracks.length > 0) {
            setReplayTracks(replayMusicTracks);
        } else {
            resetShuffleQueue();
        }
        startMusic(gameMode, musicSelect);

        // Reset timing state
        replayGameStartTime = Date.now();
        update.lastTime = 0;
        dropCounter = 0;
        lockDelayCounter = 0;
        lockDelayActive = false;

        showUI();

        gameLoop = requestAnimationFrame(update);
        Logger.info('🎬 v2.0 replay started - game is running');

      } catch (err) {
        Logger.error('🛡️ Error starting replay:', err);
        alert('Failed to start replay. The recording data may be corrupted.');
        stop();
      }
    }

    // ==================== SPAWN PIECE ====================

    function spawnPiece() {
        if (replayPieceIndex >= replayPieceData.length) {
            Logger.debug('🎬 No more pieces to spawn');
            return false;
        }

        const pieceEntry = replayPieceData[replayPieceIndex];

        // Board sync from snapshot
        const skipSyncForAnimation = volcanoAnimating || earthquakeActive || tornadoActive ||
                                    tsunamiAnimating || blackHoleAnimating || gravityAnimating;
        const skipSyncForJustFinished = replaySkipNextSync;

        if (skipSyncForJustFinished) replaySkipNextSync = false;

        if (pieceEntry.boardSnapshot && !skipSyncForAnimation && !skipSyncForJustFinished) {
            const snapshotBoard = decompressKeyframeBoard(pieceEntry.boardSnapshot, ROWS, COLS);
            let differences = 0;
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    if (board[y][x] !== snapshotBoard[y][x]) {
                        differences++;
                        board[y][x] = snapshotBoard[y][x];
                    }
                }
            }
            if (differences > 0) {
                Logger.debug('🎬 Board synced from snapshot at piece', replayPieceIndex, '- fixed', differences, 'cells');
                if (differences > 2) {
                    showSyncIndicator();
                    replayInputSpeedup *= 1.02;
                    Logger.debug('🎬 Replay speedup increased to', (replayInputSpeedup * 100).toFixed(1) + '%');
                }
            }
            
            // Reconstruct lattice grid from first board snapshot
            // At piece 0, all non-null cells are lattice blocks (no player pieces yet)
            const isLatticeMode = challengeMode === 'lattice' || activeChallenges.has('lattice');
            if (replayPieceIndex === 0 && isLatticeMode && window.ChallengeEffects && ChallengeEffects.Lattice) {
                let latticeCount = 0;
                for (let y = 0; y < ROWS; y++) {
                    for (let x = 0; x < COLS; x++) {
                        if (board[y][x] !== null) {
                            isLatticeBlock[y][x] = true;
                            latticeCount++;
                        }
                    }
                }
                Logger.debug('🎬 Reconstructed lattice grid from snapshot:', latticeCount, 'blocks');
            }
        } else if (pieceEntry.boardSnapshot && (skipSyncForAnimation || skipSyncForJustFinished)) {
            let reason;
            if (skipSyncForJustFinished) reason = 'special event just finished';
            else if (volcanoAnimating) reason = 'volcano animation';
            else if (earthquakeActive) reason = 'earthquake animation';
            else if (tornadoActive) reason = 'tornado animation';
            else if (tsunamiAnimating) reason = 'tsunami animation';
            else if (blackHoleAnimating) reason = 'black hole animation';
            else if (gravityAnimating) reason = 'gravity animation';
            else reason = 'animation in progress';
            Logger.debug('🎬 Skipping board sync -', reason);
        }

        // Create piece from recorded data
        const shapeSet = getShapeSetForType(pieceEntry.type);
        const shape = shapeSet[pieceEntry.type] || SHAPES[pieceEntry.type] || SHAPES['T'];

        currentPiece = {
            type: pieceEntry.type,
            color: pieceEntry.color,
            shape: shape,
            x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
            y: -2,
            rotationIndex: 0
        };

        // Populate nextPieceQueue for display
        nextPieceQueue = [];
        for (let i = 1; i <= NEXT_PIECE_COUNT && replayPieceIndex + i < replayPieceData.length; i++) {
            const up = replayPieceData[replayPieceIndex + i];
            const upSet = getShapeSetForType(up.type);
            const upShape = upSet[up.type] || SHAPES[up.type] || SHAPES['T'];
            nextPieceQueue.push({ type: up.type, color: up.color, shape: upShape, x: 0, y: 0, rotationIndex: 0 });
        }
        drawNextPiece();

        // Reset piece timing
        replayPieceSpawnTime = Date.now();
        replayPieceElapsedTime = 0;
        replayInputIndex = 0;
        replayRandomEventIndex = 0;
        pieceSpawnTime = Date.now();

        Logger.debug('🎬 Spawned piece', replayPieceIndex, ':', pieceEntry.type, pieceEntry.color);
        return true;
    }

    // ==================== PROCESS INPUTS ====================

    function processInputs() {
        if (!replayActive || replayPaused || !currentPiece) return;
        if (replayPieceIndex >= replayPieceData.length) return;

        const pieceEntry = replayPieceData[replayPieceIndex];
        if (!pieceEntry) return;

        replayPieceElapsedTime = (Date.now() - replayPieceSpawnTime) * replayInputSpeedup;

        // Debug stuck piece
        if (replayPieceElapsedTime > 10000 && !pieceEntry._stuckLogged) {
            Logger.debug('🎬 Piece', replayPieceIndex, 'stuck for', replayPieceElapsedTime, 'ms');
            Logger.debug('  Type:', pieceEntry.type, 'Inputs:', pieceEntry.inputs.length, 'Processed:', replayInputIndex);
            Logger.debug('  currentPiece pos:', currentPiece?.x, currentPiece?.y);
            Logger.debug('  hardDropping:', hardDropping, 'animatingLines:', animatingLines, 'gravityAnimating:', gravityAnimating);
            pieceEntry._stuckLogged = true;
        }

        // Force advance if stuck 30+ seconds
        const allInputsProcessed = replayInputIndex >= pieceEntry.inputs.length;
        if (allInputsProcessed && replayPieceElapsedTime > 30000 && currentPiece && !hardDropping) {
            Logger.error('🎬 FORCE ADVANCING: Piece', replayPieceIndex, 'stuck for 30+ seconds');
            mergePiece();
            clearLines();
            advancePiece();
            return;
        }

        // Process inputs for this piece
        while (replayInputIndex < pieceEntry.inputs.length &&
               pieceEntry.inputs[replayInputIndex].t <= replayPieceElapsedTime) {
            const input = pieceEntry.inputs[replayInputIndex];
            switch (input.type) {
                case 'left': movePiece(-1); break;
                case 'right': movePiece(1); break;
                case 'rotate': rotatePiece(); break;
                case 'rotateCCW': rotatePieceCounterClockwise(); break;
                case 'softDrop': dropPiece(); break;
                case 'hardDrop': hardDrop(); break;
            }
            replayInputIndex++;
        }

        // Process random events
        while (replayRandomEventIndex < pieceEntry.randomEvents.length &&
               pieceEntry.randomEvents[replayRandomEventIndex].t <= replayPieceElapsedTime) {

            const event = pieceEntry.randomEvents[replayRandomEventIndex];

            if (event.type === 'gremlin_block' || event.type === 'hail_block') {
                if (board[event.y] && !board[event.y][event.x]) {
                    board[event.y][event.x] = event.color;
                    isRandomBlock[event.y][event.x] = true;
                    fadingBlocks[event.y][event.x] = { opacity: 0.01, scale: 0.15 };
                }
            } else if (event.type === 'challenge_gremlin') {
                if (board[event.y] && !board[event.y][event.x]) {
                    board[event.y][event.x] = event.color;
                    isRandomBlock[event.y][event.x] = true;
                    fadingBlocks[event.y][event.x] = { opacity: 0.01, scale: 0.15 };
                }
            } else if (event.type === 'yesand_limb') {
                if (board[event.y] && !board[event.y][event.x]) {
                    board[event.y][event.x] = event.color;
                    isRandomBlock[event.y][event.x] = false;
                    fadingBlocks[event.y][event.x] = { opacity: 0.01, scale: 0.15 };
                    playSoundEffect('yesand', soundToggle);
                }
            } else if (event.type === 'mercurial_color') {
                if (currentPiece) {
                    currentPiece.color = event.color;
                    playSoundEffect('rotate', soundToggle);
                }
            } else if (event.type === 'tornado_spawn') {
                Logger.debug('🎬 Replay: Spawning tornado');
                replayTornadoSpawnData = {
                    x: event.x,
                    snakeDirection: event.direction,
                    snakeChangeCounter: event.snakeChangeCounter || 30
                };
                spawnTornado();
            } else if (event.type === 'tornado_direction') {
                replayTornadoDirChanges.push({
                    newDirection: event.direction,
                    newCounter: event.velocity || 30
                });
            } else if (event.type === 'tornado_drop') {
                replayTornadoDrops.push({ targetX: event.targetX });
            } else if (event.type === 'earthquake') {
                Logger.debug('🎬 Replay: Spawning earthquake');
                if (event.crack) {
                    replayEarthquakeCrack = event.crack;
                    replayEarthquakeShiftType = event.shiftType;
                }
                spawnEarthquake();
            } else if (event.type === 'volcano') {
                Logger.debug('🎬 Replay: Volcano event at column', event.column);
                // Pre-queue ALL lava_projectile events for this piece NOW
                for (let i = replayRandomEventIndex + 1; i < pieceEntry.randomEvents.length; i++) {
                    const futureEvent = pieceEntry.randomEvents[i];
                    if (futureEvent.type === 'lava_projectile') {
                        replayLavaProjectiles.push({ vx: futureEvent.vx, vy: futureEvent.vy });
                        Logger.debug('🎬 Replay: Pre-queued lava projectile', replayLavaProjectiles.length);
                    }
                }
            } else if (event.type === 'lava_projectile') {
                const alreadyQueued = replayLavaProjectiles.length > replayLavaProjectileIndex;
                if (!alreadyQueued) {
                    replayLavaProjectiles.push({ vx: event.vx, vy: event.vy });
                }
            }

            replayRandomEventIndex++;
        }

        // Process music track changes (global timing)
        const globalElapsed = Date.now() - replayGameStartTime;
        while (replayMusicIndex < replayMusicTracks.length &&
               replayMusicTracks[replayMusicIndex].t <= globalElapsed) {
            if (replayMusicIndex > 0) {
                Logger.debug('🎬 Replay: Music change to', replayMusicTracks[replayMusicIndex].trackName);
                skipToNextSong();
            }
            replayMusicIndex++;
        }

        // Check if all pieces done
        const allPiecesDone = replayPieceIndex >= replayPieceData.length - 1 &&
                              replayInputIndex >= pieceEntry.inputs.length;
        const gameEnded = gameOverPending || !gameRunning;

        if (allPiecesDone && gameEnded) {
            setTimeout(() => {
                if (replayActive && !replayCompleteShown) {
                    Logger.info('🎬 Replay complete!');
                    showComplete();
                }
            }, 500);
        }
    }

    // ==================== ADVANCE / RESYNC ====================

    function advancePiece() {
        if (!replayActive) return;
        replayPieceIndex++;
        if (replayPieceIndex < replayPieceData.length) {
            spawnPiece();
        } else {
            Logger.info('🎬 All pieces replayed');
            setTimeout(() => {
                if (replayActive && !replayCompleteShown) showComplete();
            }, 500);
        }
    }

    function tryResyncOnGameOver() {
        if (!replayActive) return false;
        if (replayPieceIndex + 1 < replayPieceData.length) {
            Logger.debug('🎬 DESYNC DETECTED: Game over triggered but recording has more pieces.');
            Logger.debug('🎬 Resyncing to piece', replayPieceIndex + 1, 'of', replayPieceData.length);
            replayPieceIndex++;
            spawnPiece();
            return true;
        }
        return false;
    }

    // ==================== UI ====================

    function showSyncIndicator() {
        const existing = document.getElementById('replaySyncIndicator');
        if (existing) existing.remove();

        const indicator = document.createElement('div');
        indicator.id = 'replaySyncIndicator';
        indicator.innerHTML = '🔄 RESYNCING';
        indicator.style.cssText = `
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 165, 0, 0.9); color: #000;
            padding: 1vh 2vw; border-radius: 1vh;
            font-family: Arial, sans-serif; font-size: 2vh; font-weight: bold;
            z-index: 1001; animation: replaySyncPulse 0.5s ease-out;
            pointer-events: none;
        `;

        if (!document.getElementById('replaySyncStyles')) {
            const style = document.createElement('style');
            style.id = 'replaySyncStyles';
            style.textContent = `
                @keyframes replaySyncPulse {
                    0% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(indicator);
        setTimeout(() => {
            indicator.style.transition = 'opacity 0.3s ease-out';
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 300);
        }, 700);
    }

    function showUI() {
        const existing = document.getElementById('replayControls');
        if (existing) existing.remove();

        const controls = document.createElement('div');
        controls.id = 'replayControls';
        controls.innerHTML = `
            <div style="position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
                        background: rgba(0,0,0,0.8); padding: 8px 20px; border-radius: 8px;
                        display: flex; gap: 15px; align-items: center; z-index: 1000;
                        font-family: Arial, sans-serif; color: white; font-size: 14px;">
                <span style="color: #ff6b6b; font-weight: bold;">🎬 REPLAY</span>
                <span id="replayPlayerName" style="color: #4ecdc4;">${replayData?.username || 'Unknown'}</span>
                <button id="replayPauseBtn" style="background: #333; border: 1px solid #666; color: white;
                        padding: 0 10px; margin: 0; border-radius: 4px; cursor: pointer; font-size: 14px;
                        height: 26px; box-sizing: border-box;">⏸️</button>
                <button id="replayStopBtn" style="background: #c0392b; border: none; color: white;
                        padding: 0 10px; margin: 0; border-radius: 4px; cursor: pointer; font-size: 14px;
                        height: 26px; box-sizing: border-box;">⏹️ Stop</button>
            </div>
        `;
        document.body.appendChild(controls);
        document.getElementById('replayPauseBtn').onclick = togglePause;
        document.getElementById('replayStopBtn').onclick = stop;
    }

    function togglePause() {
        replayPaused = !replayPaused;
        const btn = document.getElementById('replayPauseBtn');
        if (btn) btn.textContent = replayPaused ? '▶️' : '⏸️';

        if (replayPaused) {
            paused = true;
            StarfieldSystem.setPaused(true);
            if (typeof pauseCurrentMusic === 'function') pauseCurrentMusic();
        } else {
            replayPieceSpawnTime = Date.now() - replayPieceElapsedTime;
            paused = false;
            StarfieldSystem.setPaused(false);
            if (typeof resumeCurrentMusic === 'function') resumeCurrentMusic();
        }
    }

    function showComplete() {
        if (replayCompleteShown) return;
        replayCompleteShown = true;

        const finalStats = replayData?.recording_data?.finalStats;
        if (finalStats) {
            score = finalStats.score || 0;
            lines = finalStats.lines || 0;
            level = finalStats.level || 1;
            strikeCount = finalStats.strikes || 0;
            tsunamiCount = finalStats.tsunamis || 0;
            blackHoleCount = finalStats.blackHoles || 0;
            volcanoCount = finalStats.volcanoes || 0;

            scoreDisplay.textContent = formatAsBitcoin(score);
            linesDisplay.textContent = lines;
            levelDisplay.textContent = level;
            strikesDisplay.textContent = strikeCount;
            tsunamisDisplay.textContent = tsunamiCount;
            blackHolesDisplay.textContent = blackHoleCount;
            volcanoesDisplay.textContent = volcanoCount;
        }

        gameRunning = false;
        GamepadController.stopVibration();
        stopMusic();
        stopTornadoWind();

        const pauseBtn = document.getElementById('replayPauseBtn');
        const stopBtn = document.getElementById('replayStopBtn');

        if (pauseBtn) {
            pauseBtn.disabled = true;
            pauseBtn.style.opacity = '0.5';
            pauseBtn.style.cursor = 'not-allowed';
        }

        if (stopBtn) {
            stopBtn.innerHTML = '🔄 Replay';
            stopBtn.style.background = '#27ae60';
            stopBtn.onclick = restart;
        }

        if (!document.getElementById('replayExitBtn')) {
            const container = document.querySelector('#replayControls > div');
            if (container) {
                const exitBtn = document.createElement('button');
                exitBtn.id = 'replayExitBtn';
                exitBtn.innerHTML = '✕ Exit';
                exitBtn.style.cssText = `
                    background: #c0392b; border: none; color: white;
                    padding: 0 10px; margin: 0; border-radius: 4px; cursor: pointer;
                    font-size: 14px; height: 26px; box-sizing: border-box;
                `;
                exitBtn.onclick = stop;
                container.appendChild(exitBtn);
            }
        }

        Logger.info('🎬 Replay complete');
    }

    // ==================== RESTART / STOP ====================

    function restart() {
        if (!replayData) return;
        Logger.info('🎬 Restarting replay...');
        const recording = replayData;
        replayActive = false;
        replayCompleteShown = false;
        gameRunning = false;
        const existing = document.getElementById('replayControls');
        if (existing) existing.remove();
        setTimeout(() => { start(recording); }, 100);
    }

    function stop() {
        replayActive = false;
        replayPaused = false;
        replayData = null;
        replayCompleteShown = false;

        clearReplayTracks();
        aiModeEnabled = replaySavedAIMode;

        // Restore visual settings
        faceOpacity = replaySavedVisualSettings.faceOpacity;
        if (opacitySlider) opacitySlider.value = Math.round(faceOpacity * 100);
        if (stormEffectsToggle) stormEffectsToggle.checked = replaySavedVisualSettings.stormEffects;

        cameraReversed = replaySavedVisualSettings.cameraReversed;
        if (typeof StarfieldSystem !== 'undefined') StarfieldSystem.setCameraReversed(cameraReversed);
        const ct = document.getElementById('cameraOrientationToggle');
        if (ct) ct.checked = cameraReversed;

        if (starSpeedSlider) {
            starSpeedSlider.value = replaySavedVisualSettings.starSpeed;
            if (typeof StarfieldSystem !== 'undefined') {
                if (replaySavedVisualSettings.starSpeed === 0) StarfieldSystem.setStarsEnabled(false);
                else { StarfieldSystem.setStarsEnabled(true); StarfieldSystem.setStarSpeed(replaySavedVisualSettings.starSpeed); }
            }
        }

        minimalistMode = replaySavedVisualSettings.minimalistMode;
        if (minimalistToggle) minimalistToggle.checked = minimalistMode;
        if (typeof applyMinimalistMode === 'function') applyMinimalistMode();
        if (typeof StarfieldSystem !== 'undefined') StarfieldSystem.setMinimalistMode(minimalistMode);

        if (replaySavedVisualSettings.palette && typeof ColorPalettes !== 'undefined') {
            initColorsFromPalette(replaySavedVisualSettings.palette);
            updatePalettePreview();
        }

        // Reset replay state
        replayPieceData = []; replayPieceIndex = 0;
        replayInputIndex = 0; replayRandomEventIndex = 0;
        replayPieceSpawnTime = 0; replayPieceElapsedTime = 0;
        replayInputSpeedup = 1.0 / 0.95;
        replayMusicTracks = []; replayMusicIndex = 0;
        replayGameStartTime = 0; replayFWordSongId = null;
        replayEarthquakeCrack = null; replayEarthquakeShiftType = null;
        replaySkipNextSync = false;
        replayTornadoSpawnData = null;
        replayTornadoDirChanges = []; replayTornadoDirIndex = 0;
        replayTornadoDrops = []; replayTornadoDropIndex = 0;
        replayLavaProjectiles = []; replayLavaProjectileIndex = 0;

        // Cancel active animations
        tsunamiAnimating = false; blackHoleAnimating = false; blackHoleActive = false;
        volcanoAnimating = false; volcanoActive = false; volcanoProjectiles = [];
        gravityAnimating = false; earthquakeActive = false;

        // Full earthquake state reset
        earthquakePhase = 'shake'; earthquakeShakeProgress = 0; earthquakeShakeIntensity = 0;
        earthquakeCrack = []; earthquakeCrackProgress = 0; earthquakeCrackMap.clear();
        earthquakeShiftProgress = 0; earthquakeLeftBlocks = []; earthquakeRightBlocks = [];

        // Full tornado state reset
        tornadoActive = false; tornadoState = 'descending';
        tornadoPickedBlob = null; tornadoFinalPositions = null;
        tornadoFinalCenterX = null; tornadoFinalCenterY = null;
        tornadoFadeProgress = 0; tornadoSnakeVelocity = 0; tornadoParticles = [];
        stopTornadoWind();
        fallingBlocks = []; animatingLines = false; lineAnimations = [];

        // Remove UI
        const controls = document.getElementById('replayControls');
        if (controls) controls.remove();
        const syncIndicator = document.getElementById('replaySyncIndicator');
        if (syncIndicator) syncIndicator.remove();

        // Reset game state
        gameRunning = false; StarfieldSystem.setGameRunning(false);
        currentPiece = null;
        board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        if (window.ChallengeEffects && ChallengeEffects.Amnesia) ChallengeEffects.Amnesia.init(ROWS, COLS);
        score = 0; lines = 0; level = 1;
        strikeCount = 0; tsunamiCount = 0; blackHoleCount = 0; volcanoCount = 0;
        supermassiveBlackHoleCount = 0; superVolcanoCount = 0; volcanoIsSuper = false;

        // Restore challenge mode
        challengeMode = replaySavedChallengeMode;
        activeChallenges = new Set(replaySavedActiveChallenges);
        document.documentElement.classList.remove('stranger-mode');
        StarfieldSystem.setStrangerMode(false);
        canvas.classList.remove('thinner-mode', 'thicker-mode', 'longago-mode', 'comingsoon-mode', 'nervous-active');
        if (window.ChallengeEffects && ChallengeEffects.Rubber) ChallengeEffects.Rubber.reset();
        if (window.ChallengeEffects && ChallengeEffects.Phantom) ChallengeEffects.Phantom.reset();
        nervousVibrateOffset = 0;
        StormEffects.reset();
        if (window.ChallengeEffects && ChallengeEffects.Vertigo) ChallengeEffects.Vertigo.stop();
        updateChallengeButtonLabel();

        // Reset displays
        scoreDisplay.textContent = formatAsBitcoin(0);
        linesDisplay.textContent = '0';
        levelDisplay.textContent = '1';
        strikesDisplay.textContent = '0';
        tsunamisDisplay.textContent = '0';
        blackHolesDisplay.textContent = '0';
        volcanoesDisplay.textContent = '0';

        // Show mode menu
        modeMenu.classList.remove('hidden');
        document.body.classList.remove('game-running');
        document.body.classList.remove('game-started');
        toggleUIElements(true);
        setGameInProgress(false);
        stopMusic();
        GamepadController.stopVibration();
        startMenuMusic(musicSelect);

        StarfieldSystem.hidePlanetStats();
        const planetStats = document.getElementById('planetStats');
        const planetStatsLeft = document.getElementById('planetStatsLeft');
        if (planetStats) planetStats.style.display = 'none';
        if (planetStatsLeft) planetStatsLeft.style.display = 'none';
        if (aiModeIndicator) aiModeIndicator.style.display = 'none';

        COLS = 10;
        updateCanvasSize();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        Logger.info('🎬 Replay stopped');
    }

    // ==================== DISPLAY / DRAW HELPERS ====================

    function updateDisplays() {
        scoreDisplay.textContent = formatAsBitcoin(score);
        linesDisplay.textContent = lines;
        levelDisplay.textContent = level;
        strikesDisplay.textContent = strikeCount;
        tsunamisDisplay.textContent = tsunamiCount;
        blackHolesDisplay.textContent = blackHoleCount;
        volcanoesDisplay.textContent = volcanoCount;
    }

    function triggerGravity(blobs) {
        if (!blobs || blobs.length === 0) return;
        replayGravityBoardLocked = true;
        replayAnimatingCells = new Set();
        fallingBlocks = [];
        blobs.forEach(blob => {
            blob.positions.forEach(pos => {
                replayAnimatingCells.add(`${pos.x},${pos.sy}`);
                fallingBlocks.push({
                    x: pos.x,
                    startY: pos.sy,
                    currentY: pos.sy * BLOCK_SIZE,
                    targetY: pos.ey,
                    targetYPixels: pos.ey * BLOCK_SIZE,
                    color: blob.color,
                    velocity: 0,
                    done: false,
                    blobId: blob.id,
                    isRandom: false
                });
            });
        });
        gravityAnimating = true;
    }

    function drawPiece(piece) {
        if (!piece || !piece.shape) return;
        const positions = [];
        piece.shape.forEach((row, y) => {
            if (row) {
                row.forEach((value, x) => {
                    if (value) positions.push([piece.x + x, piece.y + y]);
                });
            }
        });
        drawSolidShape(ctx, positions, piece.color, BLOCK_SIZE, false, getFaceOpacity());
    }

    function animateClearLines(cells) {
        const animation = { cells: [], startTime: Date.now(), duration: 500 };
        const centerX = COLS / 2;
        cells.forEach(cell => {
            animation.cells.push({
                x: cell.x, y: cell.y, color: cell.c,
                distance: Math.abs(cell.x - centerX),
                removed: false, alpha: 1
            });
        });
        animation.cells.sort((a, b) => a.distance - b.distance);
        lineAnimations.push(animation);
        return animation;
    }

    // ==================== PUBLIC API ====================

    const GameReplay = {
        // State queries
        isActive,
        isPaused,
        hasPendingInputs,

        // State setters
        setSkipNextSync,

        // Consume recorded event data
        getFWordSongId,
        consumeLavaProjectile,
        consumeTornadoSpawnData,
        consumeTornadoDirChange,
        consumeTornadoDrop,
        consumeEarthquakeCrack,
        consumeEarthquakeShiftType,

        // Actions
        start,
        stop,
        restart,
        togglePause,
        advancePiece,
        processInputs,
        tryResyncOnGameOver: tryResyncOnGameOver,
        showComplete,
        updateDisplays,
        triggerGravity,
        drawPiece,
        animateClearLines
    };

    return GameReplay;

})();
