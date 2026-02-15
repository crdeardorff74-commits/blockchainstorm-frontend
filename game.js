// Starfield System - imported from starfield.js
// The StarfieldSystem module handles: Stars, Sun, Planets, Asteroid Belt, UFO
console.log("🎮 Game v3.28 loaded - Tsunami push reconciliation for stacked blobs");

// Audio System - imported from audio.js
const { audioContext, startMusic, stopMusic, startMenuMusic, stopMenuMusic, playSoundEffect, playMP3SoundEffect, playEnhancedThunder, playThunder, playVolcanoRumble, playEarthquakeRumble, playEarthquakeCrack, playTsunamiWhoosh, startTornadoWind, stopTornadoWind, playSmallExplosion, getSongList, setHasPlayedGame, setGameInProgress, skipToNextSong, skipToPreviousSong, hasPreviousSong, resetShuffleQueue, setReplayTracks, clearReplayTracks, pauseCurrentMusic, resumeCurrentMusic, toggleMusicPause, isMusicPaused, getCurrentSongInfo, setOnSongChangeCallback, setOnPauseStateChangeCallback, insertFWordSong, insertFWordSongById, playBanjoWithMusicPause, setMusicVolume, getMusicVolume, setMusicMuted, isMusicMuted, toggleMusicMute, setSfxVolume, getSfxVolume, setSfxMuted, isSfxMuted, toggleSfxMute, skipToNextSongWithPurge, isSongPurged, getPurgedSongs, clearAllPurgedSongs, _dbg: _audioDbg, _getDbgLog: _getAudioDbgLog, markUserInteraction } = window.AudioSystem;

// Inject CSS for side panel adjustments to fit song info
(function injectSidePanelStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .side-panel {
            overflow: hidden;
            max-height: 100vh;
            box-sizing: border-box;
        }
        .side-panel .controls {
            font-size: 11px !important;
            line-height: 1.3 !important;
        }
        .side-panel .controls .control-row {
            margin: 2px 0 !important;
        }
        /* Controller-specific styling */
        #controllerControls {
            text-align: center;
        }
        #controllerControls .control-row {
            display: flex;
            justify-content: center;
            gap: 4px;
        }
        #controllerControls .control-key {
            display: inline-block;
            text-align: right;
            width: 110px;
        }
        #controllerControls .control-label {
            display: inline-block;
            text-align: left;
            width: 95px;
        }
        .controls.hidden-during-play,
        #controllerControls.hidden-during-play,
        select.hidden-during-play {
            display: none !important;
        }
        #planetStats {
            padding: 4px 8px !important;
            margin-top: 4px !important;
        }
        #songInfo {
            flex: 0 0 auto !important;
            height: auto !important;
            display: block !important;
            text-align: center !important;
            line-height: 0 !important;
            font-size: 0 !important;
        }
        #songInfo[style*="display: none"] {
            display: none !important;
        }
        #songInfo > div {
            padding: 0 !important;
        }
        #songInfo button {
            vertical-align: middle !important;
            box-sizing: border-box !important;
        }
        #songPrevBtn, #songPauseBtn, #songNextBtn {
            height: 2.4vh !important;
            min-height: 0 !important;
            margin: 0 !important;
        }
        .side-panel-bottom {
            flex-grow: 0 !important;
        }
        @media (max-width: 1024px) {
            #planetStats {
                font-size: max(1.8vh, 9px) !important;
            }
            #planetStatsContent div {
                font-size: max(1.8vh, 8px) !important;
            }
            #planetStatsContent div[style*="italic"] {
                font-size: max(1.5vh, 7px) !important;
            }
            #songInfo div:first-child {
                font-size: max(1.5vh, 7px) !important;
                line-height: 1.3 !important;
            }
            #songName {
                font-size: max(1.8vh, 9px) !important;
            }
        }
    `;
    document.head.appendChild(style);
})();

// Game state variables (synced with StarfieldSystem)
let currentGameLevel = 1;
let gameRunning = false;
let gameOverPending = false; // True when waiting for game over timeout
let cameraReversed = false;

// ============================================
// DEVICE DETECTION & TABLET MODE SYSTEM - imported from touch-controls.js
// ============================================

// Log capture system - FIFO queue for copying console logs
// Press CTRL+D to copy all captured logs to clipboard
const LOG_QUEUE_MAX_SIZE = 1000;
let logQueue = [];

// Override console.log to capture all logs
const originalConsoleLog = console.log;
console.log = function(...args) {
    // Call original console.log
    originalConsoleLog.apply(console, args);
    
    // Format the log message
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1); // Just time portion
    const message = args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');
    
    // Add to queue
    logQueue.push(`[${timestamp}] ${message}`);
    
    // Maintain FIFO - remove oldest if over limit
    if (logQueue.length > LOG_QUEUE_MAX_SIZE) {
        logQueue.shift();
    }
};

// Function to copy logs to clipboard
function copyLogsToClipboard() {
    const logText = logQueue.join('\n');
    
    // Copy to clipboard silently
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(logText).catch(() => {});
    }
    
    // Pause the game
    const wasRunning = gameRunning;
    if (wasRunning && !isPaused) {
        togglePause();
    }
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.85); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: #1a1a2e; border: 2px solid #00ff00; border-radius: 10px;
        padding: 30px; max-width: 500px; width: 90%; color: #00ff00;
        font-family: 'Press Start 2P', monospace;
    `;
    
    modal.innerHTML = `
        <h2 style="margin: 0 0 20px 0; font-size: 16px; text-align: center;">🐛 BUG REPORT</h2>
        <p style="font-size: 10px; margin-bottom: 15px; color: #aaa;">
            Describe what happened (optional):
        </p>
        <textarea id="bugDescription" style="
            width: 100%; height: 120px; background: #0a0a1a; border: 1px solid #00ff00;
            color: #fff; font-family: monospace; font-size: 12px; padding: 10px;
            resize: vertical; box-sizing: border-box;
        " placeholder="e.g., Blocks fell through each other when..."></textarea>
        <div style="display: flex; gap: 15px; margin-top: 20px; justify-content: center;">
            <button id="bugSubmit" style="
                background: #00ff00; color: #000; border: none; padding: 12px 24px;
                font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer;
            ">SUBMIT</button>
            <button id="bugCancel" style="
                background: #333; color: #fff; border: 1px solid #666; padding: 12px 24px;
                font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer;
            ">CANCEL</button>
        </div>
        <p style="font-size: 8px; margin-top: 15px; color: #666; text-align: center;">
            ${logQueue.length} log entries will be included
        </p>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const textarea = document.getElementById('bugDescription');
    textarea.focus();
    
    const closeModal = (submit) => {
        if (submit) {
            const description = textarea.value.trim();
            submitBugReport(logText, description);
        }
        overlay.remove();
        // Resume game if it was running
        if (wasRunning && isPaused) {
            togglePause();
        }
    };
    
    document.getElementById('bugSubmit').onclick = () => closeModal(true);
    document.getElementById('bugCancel').onclick = () => closeModal(false);
    
    // ESC to cancel
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal(false);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// Submit bug report to server
async function submitBugReport(debugLog, bugDescription, silent = false) {
    try {
        const token = localStorage.getItem('oi_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const payload = {
            debugLog: debugLog,
            bugDescription: bugDescription || null,
            score: score,
            lines: lines,
            level: level,
            difficulty: gameMode,
            skillLevel: skillLevel,
            mode: challengeMode,
            challenges: Array.from(activeChallenges),
            playerType: aiModeEnabled ? 'ai' : 'human',
            timestamp: new Date().toISOString()
        };
        
        const response = await fetch('https://blockchainstorm.onrender.com/api/bug-report', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });
        
        if (!silent) {
            showBugReportConfirmation(response.ok);
        }
    } catch (e) {
        console.error('Bug report submission failed:', e);
        if (!silent) showBugReportConfirmation(false);
    }
}

function showBugReportConfirmation(success) {
    const indicator = document.createElement('div');
    indicator.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        padding: 20px 40px; background: ${success ? 'rgba(0, 255, 0, 0.9)' : 'rgba(255, 0, 0, 0.9)'};
        color: white; font-size: 18px; font-weight: bold; border-radius: 10px; z-index: 10001;
        font-family: 'Press Start 2P', monospace;
    `;
    indicator.textContent = success ? '✅ Bug report submitted!' : '❌ Submission failed';
    document.body.appendChild(indicator);
    setTimeout(() => indicator.remove(), 2500);
}

// Function to capture canvas snapshot and copy to clipboard
function captureCanvasSnapshot() {
    try {
        // Create a temporary canvas with black background
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Fill with black background
        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw the game canvas on top
        tempCtx.drawImage(canvas, 0, 0);
        
        // Convert temporary canvas to blob
        tempCanvas.toBlob((blob) => {
            if (!blob) {
                originalConsoleLog('❌ Failed to create canvas snapshot');
                return;
            }
            
            // Try to copy using modern Clipboard API
            if (navigator.clipboard && navigator.clipboard.write) {
                const item = new ClipboardItem({ 'image/png': blob });
                navigator.clipboard.write([item]).then(() => {
                    originalConsoleLog('📸 Canvas snapshot copied to clipboard!');
                    
                    // Show visual indicator
                    const indicator = document.createElement('div');
                    indicator.style.position = 'fixed';
                    indicator.style.top = '50%';
                    indicator.style.left = '50%';
                    indicator.style.transform = 'translate(-50%, -50%)';
                    indicator.style.padding = '20px 40px';
                    indicator.style.background = 'rgba(0, 128, 255, 0.9)';
                }).catch((err) => {
                    originalConsoleLog('❌ Failed to copy canvas snapshot:', err);
                });
            } else {
                originalConsoleLog('❌ Clipboard API not supported');
            }
        }, 'image/png');
    } catch (err) {
        originalConsoleLog('❌ Error capturing canvas snapshot:', err);
    }
}

// ============================================
// GAMEPAD CONTROLLER SYSTEM - imported from gamepad.js
// ============================================

// Initialize gamepad support
GamepadController.init();

// Separate gamepad polling for menu/game-over states (when main game loop isn't running)
(function gamepadMenuPoll() {
    // Only poll when game is not running (game over screen, menu, etc.)
    if (!gameRunning) {
        GamepadController.update();
    }
    requestAnimationFrame(gamepadMenuPoll);
})();

// ============================================
// TOUCH CONTROLS EVENT HANDLERS
// ============================================

// Touch repeat settings + initTouchControls - imported from touch-controls.js

// Initialize tablet mode
try {
    TabletMode.init();
} catch (e) {
    console.error('TabletMode.init() error:', e instanceof Error ? e.message : e);
}

// Initialize starfield system
try {
    if (typeof StarfieldSystem !== 'undefined') {
        StarfieldSystem.init();
    }
} catch (e) {
    console.error('StarfieldSystem.init() error:', e);
}
// Note: setSoundCallback is called after soundToggle is defined (line ~820)

// Initialize touch controls (will be shown/hidden by tablet mode)
try {
    initTouchControls();
} catch (e) {
    console.error('initTouchControls() error:', e);
}

// Update tablet mode when gamepad connects/disconnects
window.addEventListener("gamepadconnected", () => {
    setTimeout(() => TabletMode.updateMode(), 100);
});

window.addEventListener("gamepaddisconnected", () => {
    setTimeout(() => TabletMode.updateMode(), 100);
});

// ============================================
// END TOUCH CONTROLS
// ============================================

// ============================================
// END GAMEPAD CONTROLLER SYSTEM
// ============================================

// Listen for =/+ key to copy logs
document.addEventListener('keydown', (e) => {
    // CTRL+D to copy console logs to clipboard
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        copyLogsToClipboard();
    }
    
    // CTRL+T to toggle tablet mode (for testing)
    if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        TabletMode.toggle();
    }
});



// Game code
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Canvas click handler for AI EXIT button
// Auto-focus name entry input when overlay becomes visible (fixes Android keyboard not appearing)
(function() {
    const nameOverlay = document.getElementById('nameEntryOverlay');
    const nameInput = document.getElementById('nameEntryInput');
    if (nameOverlay && nameInput) {
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.attributeName === 'style' || m.attributeName === 'class') {
                    const visible = nameOverlay.style.display !== 'none' && 
                                    window.getComputedStyle(nameOverlay).display !== 'none';
                    if (visible) {
                        // Exit fullscreen so Android keyboard can appear (mobile only)
                        if ((DeviceDetection.isMobile || DeviceDetection.isTablet) && (document.fullscreenElement || document.webkitFullscreenElement)) {
                            if (document.exitFullscreen) {
                                document.exitFullscreen().catch(() => {});
                            } else if (document.webkitExitFullscreen) {
                                document.webkitExitFullscreen();
                            }
                        }
                        // Delay focus to let Android settle the layout
                        setTimeout(() => {
                            nameInput.focus();
                            nameInput.click();
                        }, 400);
                    }
                }
            }
        });
        observer.observe(nameOverlay, { attributes: true, attributeFilter: ['style', 'class'] });
    }
})();

canvas.addEventListener('click', (e) => {
    if (!aiModeEnabled || !gameRunning || !window.aiExitBounds) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const bounds = window.aiExitBounds;
    if (x >= bounds.x && x <= bounds.x + bounds.width &&
        y >= bounds.y && y <= bounds.y + bounds.height) {
        exitAIGame();
    }
});

// Touch handler for AI EXIT button (click doesn't fire when touch preventDefault is used)
canvas.addEventListener('touchend', (e) => {
    if (!aiModeEnabled || !gameRunning || !window.aiExitBounds) return;
    
    const touch = e.changedTouches[0];
    if (!touch) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    const bounds = window.aiExitBounds;
    if (x >= bounds.x && x <= bounds.x + bounds.width &&
        y >= bounds.y && y <= bounds.y + bounds.height) {
        e.preventDefault();
        exitAIGame();
    }
});

const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
// Disable image smoothing for crisp pixels (prevents lines in fullscreen)
nextCtx.imageSmoothingEnabled = false;
nextCtx.webkitImageSmoothingEnabled = false;
nextCtx.mozImageSmoothingEnabled = false;
nextCtx.msImageSmoothingEnabled = false;

// AI Mode menu overlay (shows on main menu when AI mode enabled)
// Create a wrapper around the canvas for proper positioning
const canvasWrapper = document.createElement('div');
canvasWrapper.id = 'canvasWrapper';
canvasWrapper.style.cssText = 'position: relative; display: inline-block;';
canvas.parentNode.insertBefore(canvasWrapper, canvas);
canvasWrapper.appendChild(canvas);

const aiModeMenuOverlay = document.createElement('div');
aiModeMenuOverlay.id = 'aiModeMenuOverlay';
aiModeMenuOverlay.textContent = I18n.t('ai.modeOverlay');
aiModeMenuOverlay.style.cssText = `
    position: absolute;
    top: 1vh;
    left: 1vw;
    color: rgba(0, 255, 255, 0.8);
    font-family: Arial, sans-serif;
    font-size: max(1.5vh, 10px);
    font-weight: bold;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    z-index: 100;
    display: none;
`;
canvasWrapper.appendChild(aiModeMenuOverlay);

function updateAIModeMenuOverlay() {
    // Show overlay on menu when AI mode enabled, hide during gameplay
    if (aiModeEnabled && !gameRunning) {
        aiModeMenuOverlay.style.display = 'block';
    } else {
        aiModeMenuOverlay.style.display = 'none';
    }
}

const histogramCanvas = document.getElementById('histogramCanvas');
const histogramCtx = histogramCanvas.getContext('2d');
const modeMenu = document.getElementById('modeMenu');
const modeButtons = document.querySelectorAll('.mode-button');
const gameOverDiv = document.getElementById('gameOver');
const playAgainBtn = document.getElementById('playAgainBtn');

// End Credits System
let creditsAnimationId = null;
let creditsScrollY = 0;
let creditsContentHeight = 0;
let creditsMusicTimeoutId = null;
let aiAutoRestartTimerId = null;

// AI Tuning Mode - for automated parameter testing
let aiTuningMode = false;
let aiTuningConfig = null; // Current random config being tested
let aiTuningDifficulty = null; // Difficulty to use for all tuning games
let aiTuningSkillLevel = null; // Skill level to use for all tuning games
let aiTuningGamesPlayed = 0; // Counter for games played in tuning session (total)
let aiTuningPieceSequence = null; // Fixed piece sequence for fair comparison (captured from game 1 of each set)
let aiTuningPieceIndex = 0; // Current index in the fixed piece sequence
let aiTuningSetNumber = 1; // Current set number (resets pieces every 30 games)
let aiTuningGameInSet = 0; // Game number within current set (1-30)
const TUNING_GAMES_PER_SET = 30; // Number of games before resetting piece sequence

function getCreditsElements() {
    return {
        overlay: document.getElementById('creditsOverlay'),
        scroll: document.getElementById('creditsScroll')
    };
}

function startCreditsAnimation() {
    console.log('startCreditsAnimation called');
    
    const { overlay: creditsOverlay, scroll: creditsScroll } = getCreditsElements();
    console.log('creditsOverlay:', creditsOverlay);
    console.log('creditsScroll:', creditsScroll);
    
    if (!creditsOverlay || !creditsScroll) {
        console.error('Credits elements not found! creditsOverlay:', creditsOverlay, 'creditsScroll:', creditsScroll);
        return;
    }
    
    // Set the game title based on branding
    const gameTitleDiv = document.getElementById('gameTitle');
    if (gameTitleDiv) {
        const isTantris = (window.GAME_TITLE || '').toUpperCase().includes('TANT');
        if (isTantris) {
            gameTitleDiv.innerHTML = 'T<span class="credits-ai">a</span>NTЯ<span class="credits-ai">i</span>S';
        } else {
            gameTitleDiv.innerHTML = '₿LOCKCH<span class="credits-ai">ai</span>NSTOЯM';
        }
    }
    
    // Hide settings button during end credits
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) settingsBtn.style.display = 'none';
    
    // Get the height of the screen
    const screenHeight = window.innerHeight;
    
    // Show the overlay FIRST so we can measure content height
    creditsOverlay.style.display = 'block';
    
    // Start off-screen initially
    creditsScrollY = screenHeight;
    creditsScroll.style.top = creditsScrollY + 'px';
    
    // Use requestAnimationFrame to ensure DOM is rendered before measuring
    requestAnimationFrame(() => {
        // Now get content height (must be after display:block and render)
        const creditsContent = creditsScroll.querySelector('.credits-content');
        creditsContentHeight = creditsContent ? creditsContent.offsetHeight : 0;
        console.log('Credits content height:', creditsContentHeight, 'Screen height:', screenHeight);
        
        if (creditsContentHeight === 0) {
            console.error('Credits content height is 0! creditsContent:', creditsContent);
            return;
        }
        
        // Animate the scroll
        function animateCredits() {
            creditsScrollY -= 0.5; // Scroll speed (pixels per frame)
            creditsScroll.style.top = creditsScrollY + 'px';
            
            // Stop when all content has scrolled past the top (bottom of content reaches top of screen)
            if (creditsScrollY + creditsContentHeight > 0) {
                creditsAnimationId = requestAnimationFrame(animateCredits);
            } else {
                // Animation complete - stop but keep overlay visible
                console.log('Credits animation complete');
                creditsAnimationId = null;
            }
        }
        
        creditsAnimationId = requestAnimationFrame(animateCredits);
    });
}

function stopCreditsAnimation() {
    if (creditsAnimationId) {
        cancelAnimationFrame(creditsAnimationId);
        creditsAnimationId = null;
    }
    const { overlay: creditsOverlay } = getCreditsElements();
    if (creditsOverlay) {
        creditsOverlay.style.display = 'none';
    }
    // Show settings button again
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) settingsBtn.style.display = 'block';
    // Also cancel pending music start
    if (creditsMusicTimeoutId) {
        clearTimeout(creditsMusicTimeoutId);
        creditsMusicTimeoutId = null;
    }
}

// Snowflake bitmaps now handled by StormEffects module (storm-effects.js)

// Dynamic canvas sizing based on viewport
let BLOCK_SIZE = 35;
let nextDisplayBaseSize = 180; // Updated by updateCanvasSize

function updateCanvasSize() {
    // Calculate block size based on viewport height
    // At narrow viewports header is hidden, so use more vertical space
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isNarrow = vw <= 1100;
    const isPerspective = canvas.classList.contains('longago-mode') || canvas.classList.contains('comingsoon-mode');
    const isPhone = isNarrow && vh <= 500;
    const heightPercent = isNarrow ? 0.99 : 0.95;
    const targetHeight = vh * heightPercent;
    let blockFromHeight = Math.floor(targetHeight / ROWS);
    
    // Also constrain by available width (viewport minus panels)
    // At narrow viewports, panels use flex:1 regardless of tablet mode
    const estPanelPercent = isNarrow ? 0.20 : (TabletMode.enabled ? 0.33 : 0.23);
    const estPanelMinWidth = isNarrow ? 80 : (TabletMode.enabled ? 280 : 180);
    const estPanelWidth = Math.max(estPanelMinWidth, vw * estPanelPercent);
    const gapSpace = isNarrow ? (vw * 0.012) : (vw * 0.08);
    // Perspective modes need extra margin on phones so panels don't overlap
    const perspectiveMargin = 0;
    const availableWidth = vw - (2 * estPanelWidth) - gapSpace - perspectiveMargin;
    const blockFromWidth = Math.floor(availableWidth / COLS);
    
    BLOCK_SIZE = Math.max(10, Math.min(blockFromHeight, blockFromWidth));
    
    // Desktop: make the well 3% smaller for better panel balance
    if (!isNarrow) {
        BLOCK_SIZE = Math.floor(BLOCK_SIZE * 0.97);
    }
    
    // Update main canvas
    canvas.width = COLS * BLOCK_SIZE;
    canvas.height = ROWS * BLOCK_SIZE;
    
    // Check if Thicker mode is active and adjust CSS dimensions
    const isThickerMode = challengeMode === 'thicker' || activeChallenges.has('thicker');
    if (isThickerMode) {
        // Set CSS dimensions to create actual layout space
        canvas.style.width = (canvas.width * 1.2) + 'px';
        canvas.style.height = (canvas.height * 0.667) + 'px';
    } else {
        // Reset to auto for normal modes
        canvas.style.width = '';
        canvas.style.height = '';
    }
    
    // Constrain mode menu to canvas width so buttons don't overflow
    const modeMenu = document.getElementById('modeMenu');
    if (modeMenu) {
        modeMenu.style.maxWidth = canvas.width + 'px';
        modeMenu.style.left = '50%';
        modeMenu.style.transform = 'translateX(-50%)';
    }
    
    // Update next piece canvas to be responsive
    // Use the side panel's actual width as reference
    const sidePanelEl = document.querySelector('.side-panel');
    const sidePanelWidth = sidePanelEl ? sidePanelEl.getBoundingClientRect().width : 220;
    const nextDisplaySize = Math.min(180, sidePanelWidth * 0.8, window.innerHeight * 0.22);
    nextDisplayBaseSize = nextDisplaySize;
    const nextDisplayWidth = nextDisplaySize;
    const nextDisplayHeight = nextDisplaySize;
    
    // Make canvas larger to accommodate the piece queue extending up and right
    const nextCanvasScale = 2.5;
    nextCanvas.width = nextDisplayWidth * nextCanvasScale;
    nextCanvas.height = nextDisplayHeight * nextCanvasScale;
    
    // Position canvas so visible area (lower-left) aligns with original position
    // Canvas extends up and to the right from there
    nextCanvas.style.width = (nextDisplayWidth * nextCanvasScale) + 'px';
    nextCanvas.style.height = (nextDisplayHeight * nextCanvasScale) + 'px';
    nextCanvas.style.position = 'absolute';
    nextCanvas.style.bottom = '0';
    nextCanvas.style.left = '0';
    
    // Update wrapper size to match
    const nextWrapper = document.querySelector('.next-canvas-wrapper');
    if (nextWrapper) {
        nextWrapper.style.width = nextDisplayWidth + 'px';
        nextWrapper.style.height = nextDisplayHeight + 'px';
    }
    
    // Update side panel positions based on canvas width
    const rulesPanel = document.querySelector('.rules-panel');
    const sidePanel = document.querySelector('.side-panel');
    
    const viewportWidth = window.innerWidth;
    
    // At narrow viewports, let CSS flexbox handle layout instead of JS positioning
    if (viewportWidth <= 1100) {
        if (rulesPanel) rulesPanel.style.left = '';
        if (sidePanel) sidePanel.style.right = '';
    } else {
        // Use getBoundingClientRect to get the actual rendered size including CSS transforms
        const canvasRect = canvas.getBoundingClientRect();
        const canvasDisplayWidth = canvasRect.width;
        
        // Calculate panel width (22vw normal, 33vw tablet mode - 50% wider)
        const panelWidthPercent = TabletMode.enabled ? 0.33 : 0.22;
        const panelWidth = viewportWidth * panelWidthPercent;
        
        // Desired gap between canvas and panels (2.5vw for better spacing)
        const desiredGap = viewportWidth * 0.025;
        
        // Calculate how much space is available on each side
        const totalSpace = viewportWidth - canvasDisplayWidth;
        const spacePerSide = totalSpace / 2;
        
        // Calculate panel positions
        // Left panel: space on left side - panel width - gap
        const leftPanelLeft = spacePerSide - panelWidth - desiredGap;
        
        // Right panel: same as left (symmetric)
        const rightPanelRight = spacePerSide - panelWidth - desiredGap;
        
        // Position panels (but don't push them off screen)
        if (rulesPanel) {
            rulesPanel.style.left = Math.max(0, leftPanelLeft) + 'px';
        }
        
        if (sidePanel) {
            sidePanel.style.right = Math.max(0, rightPanelRight) + 'px';
        }
    }
    
    // Redraw if game is running (but NOT during initialization)
    if (gameRunning && currentPiece) {
        drawBoard();
        if (currentPiece && currentPiece.shape) {
            if (hardDropping) {
                const pixelOffset = hardDropPixelY - (currentPiece.y * BLOCK_SIZE);
                drawPiece(currentPiece, ctx, 0, 0, pixelOffset);
            } else {
                drawPiece(currentPiece);
            }
        }
        if (nextPieceQueue.length > 0) {
            drawNextPiece();
        }
    }
    
    // Update StormEffects with new BLOCK_SIZE so liquid pools reposition correctly
    StormEffects.updateGameState({ BLOCK_SIZE: BLOCK_SIZE, COLS: COLS, ROWS: ROWS });
}

window.addEventListener('resize', updateCanvasSize);
window.updateCanvasSize = updateCanvasSize; // Expose for leaderboard positioning

// Also update on fullscreen change (resize may not fire on all browsers)
document.addEventListener('fullscreenchange', () => {
    setTimeout(updateCanvasSize, 100); // Small delay to let layout settle
});
document.addEventListener('webkitfullscreenchange', () => {
    setTimeout(updateCanvasSize, 100);
});

// Fullscreen cursor auto-hide functionality
let cursorHideTimeout = null;
const CURSOR_HIDE_DELAY = 2000; // Hide cursor after 2 seconds of inactivity

function showCursor() {
    document.body.style.cursor = 'auto';
    if (cursorHideTimeout) {
        clearTimeout(cursorHideTimeout);
    }
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        cursorHideTimeout = setTimeout(() => {
            document.body.style.cursor = 'none';
        }, CURSOR_HIDE_DELAY);
    }
}

function handleFullscreenCursor() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        // Entering fullscreen - start cursor hide timer
        showCursor();
    } else {
        // Exiting fullscreen - restore cursor
        if (cursorHideTimeout) {
            clearTimeout(cursorHideTimeout);
            cursorHideTimeout = null;
        }
        document.body.style.cursor = 'auto';
    }
}

document.addEventListener('fullscreenchange', handleFullscreenCursor);
document.addEventListener('webkitfullscreenchange', handleFullscreenCursor);
document.addEventListener('mousemove', showCursor);

const scoreDisplay = document.getElementById('score');
const linesDisplay = document.getElementById('lines');
const levelDisplay = document.getElementById('level');
const strikesDisplay = document.getElementById('strikes');
const tsunamisDisplay = document.getElementById('tsunamis');
const blackHolesDisplay = document.getElementById('blackholes');
const volcanoesDisplay = document.getElementById('volcanoes');
const finalScoreDisplay = document.getElementById('finalScore');
const finalStatsDisplay = document.getElementById('finalStats');
const planetStatsDiv = document.getElementById('planetStats');
const planetStatsContent = document.getElementById('planetStatsContent');
// Sound toggle removed - now controlled by volume/mute in side panel
// Create fake toggle that's always "on" so existing code works
const soundToggle = { checked: true };
const musicSelect = document.getElementById('musicSelect');

// Update special events display based on skill level
// Breeze: Only Strikes
// Tempest: Strikes, Tsunamis, Black Holes (no Volcanoes)
// Maelstrom: All (Strikes, Tsunamis, Black Holes, Volcanoes)
function updateSpecialEventsDisplay(level) {
    const strikesRow = document.getElementById('strikesRow');
    const tsunamisRow = document.getElementById('tsunamisRow');
    const blackholesRow = document.getElementById('blackholesRow');
    const volcanoesRow = document.getElementById('volcanoesRow');
    
    if (level === 'breeze') {
        if (strikesRow) strikesRow.style.display = '';
        if (tsunamisRow) tsunamisRow.style.display = 'none';
        if (blackholesRow) blackholesRow.style.display = 'none';
        if (volcanoesRow) volcanoesRow.style.display = 'none';
    } else if (level === 'tempest') {
        if (strikesRow) strikesRow.style.display = '';
        if (tsunamisRow) tsunamisRow.style.display = '';
        if (blackholesRow) blackholesRow.style.display = '';
        if (volcanoesRow) volcanoesRow.style.display = 'none';
    } else { // maelstrom
        if (strikesRow) strikesRow.style.display = '';
        if (tsunamisRow) tsunamisRow.style.display = '';
        if (blackholesRow) blackholesRow.style.display = '';
        if (volcanoesRow) volcanoesRow.style.display = '';
    }
}

// Song info display - created dynamically
let songInfoElement = null;

function createSongInfoElement() {
    // Find the side panel to add song info to
    const sidePanel = document.querySelector('.side-panel');
    if (!sidePanel) return;
    
    // Check if element already exists - still update its content
    if (document.getElementById('songInfo')) {
        songInfoElement = document.getElementById('songInfo');
        // Move to side panel if it's inside bottom wrapper
        if (songInfoElement.parentNode !== sidePanel) {
            sidePanel.appendChild(songInfoElement);
        }
        // Update styles and content in case code has changed
        songInfoElement.style.cssText = `
            margin-top: 0.5vh;
            padding: 0.6vh 0.9vw;
            background: rgba(26, 26, 46, 0.95);
            border-radius: 0.6vh;
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #aaa;
            text-align: center;
            display: none;
        `;
        return;
    }
    
    // Create song info container
    songInfoElement = document.createElement('div');
    songInfoElement.id = 'songInfo';
    songInfoElement.style.cssText = `
        margin-top: 0.5vh;
        padding: 0.6vh 0.9vw;
        background: rgba(26, 26, 46, 0.95);
        border-radius: 0.6vh;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #aaa;
        text-align: center;
        display: none;
    `;
    
    songInfoElement.innerHTML = `
        <div style="color: #888; font-size: max(1.2vh, 7px); line-height: 1.3; text-transform: uppercase; letter-spacing: 0.05vh;">♪ NOW PLAYING ♪</div>
        <div id="songName" style="color: #e0e0e0; font-size: max(1.5vh, 7px); word-wrap: break-word; line-height: 1.3;"></div>
        <div style="display: flex; justify-content: center; align-items: center; gap: 0.8vh; font-size: 0; line-height: 0; margin-top: 0.4vh;">
            <button id="songPrevBtn" style="background: #2a2a3a; border: 1px solid rgba(255,255,255,0.1); color: #666; padding: 0.3vh 0.8vh; border-radius: 0.4vh; cursor: default; font-size: 1.2vh; opacity: 0.5; line-height: 1;" title="Previous song (SHIFT+←)" disabled>⏮&#xFE0E;</button>
            <button id="songPauseBtn" style="background: #2a2a3a; border: 1px solid rgba(255,255,255,0.1); color: #aaa; padding: 0.3vh 0.8vh; border-radius: 0.4vh; cursor: pointer; font-size: 1.2vh; line-height: 1;" title="Pause/Resume music">⏸&#xFE0E;</button>
            <button id="songNextBtn" style="background: #2a2a3a; border: 1px solid rgba(255,255,255,0.1); color: #aaa; padding: 0.3vh 0.8vh; border-radius: 0.4vh; cursor: pointer; font-size: 1.2vh; line-height: 1;" title="Next song (SHIFT+→)">⏭&#xFE0E;</button>
        </div>
    `;
    
    // Append directly to side panel (not inside bottom wrapper to avoid flex stretching)
    sidePanel.appendChild(songInfoElement);
    
    // Add click handlers for the buttons
    const prevBtn = document.getElementById('songPrevBtn');
    const nextBtn = document.getElementById('songNextBtn');
    const pauseBtn = document.getElementById('songPauseBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (GameReplay.isActive()) return; // Don't allow during replay
            if (typeof skipToPreviousSong === 'function') {
                skipToPreviousSong();
            }
        });
        // Hover effect (only when enabled)
        prevBtn.addEventListener('mouseenter', () => { 
            if (!prevBtn.disabled) {
                prevBtn.style.background = 'rgba(255,255,255,0.2)'; 
                prevBtn.style.color = '#fff'; 
            }
        });
        prevBtn.addEventListener('mouseleave', () => { 
            if (!prevBtn.disabled) {
                prevBtn.style.background = 'rgba(255,255,255,0.1)'; 
                prevBtn.style.color = '#aaa'; 
            }
        });
    }
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            if (typeof toggleMusicPause === 'function') {
                const isPaused = toggleMusicPause();
                pauseBtn.textContent = isPaused ? '▶\uFE0E' : '⏸\uFE0E';
            }
        });
        // Hover effect
        pauseBtn.addEventListener('mouseenter', () => { pauseBtn.style.background = 'rgba(255,255,255,0.2)'; pauseBtn.style.color = '#fff'; });
        pauseBtn.addEventListener('mouseleave', () => { pauseBtn.style.background = 'rgba(255,255,255,0.1)'; pauseBtn.style.color = '#aaa'; });
    }
    
    if (nextBtn) {
        // Hold detection for indefinite purge
        let holdTimeout = null;
        let holdTriggered = false;
        const HOLD_DURATION = 800; // ms to trigger hold
        
        const startHold = (e) => {
            if (GameReplay.isActive()) return;
            holdTriggered = false;
            holdTimeout = setTimeout(() => {
                holdTriggered = true;
                // Indefinite purge
                const songInfo = getCurrentSongInfo();
                if (songInfo && typeof skipToNextSongWithPurge === 'function') {
                    const result = skipToNextSongWithPurge('indefinite');
                    if (result.purgeInfo) {
                        showPurgeNotification(result.purgeInfo.songName, 'indefinite');
                        updateMusicDropdownPurgeIndicators();
                    }
                }
            }, HOLD_DURATION);
        };
        
        const cancelHold = (e) => {
            if (holdTimeout) {
                clearTimeout(holdTimeout);
                holdTimeout = null;
            }
        };
        
        const handleClick = (e) => {
            if (GameReplay.isActive()) return;
            if (holdTriggered) {
                // Already handled by hold
                holdTriggered = false;
                return;
            }
            cancelHold();
            
            // Determine purge type based on current song time
            const songInfo = getCurrentSongInfo();
            if (songInfo && typeof skipToNextSongWithPurge === 'function') {
                const currentTime = songInfo.currentTime || 0;
                let purgeType;
                if (currentTime < 30) {
                    purgeType = 'short'; // 1 week
                } else {
                    purgeType = 'long'; // 3 days
                }
                const result = skipToNextSongWithPurge(purgeType);
                // Only show notification for short purge (before 30 sec)
                if (result.purgeInfo && purgeType === 'short') {
                    showPurgeNotification(result.purgeInfo.songName, 'week');
                }
                // Update dropdown indicators
                if (result.purgeInfo) {
                    updateMusicDropdownPurgeIndicators();
                }
            } else if (typeof skipToNextSong === 'function') {
                skipToNextSong();
            }
        };
        
        // Mouse events
        nextBtn.addEventListener('mousedown', startHold);
        nextBtn.addEventListener('mouseup', handleClick);
        nextBtn.addEventListener('mouseleave', cancelHold);
        
        // Touch events for mobile
        nextBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startHold(e);
        });
        nextBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleClick(e);
        });
        nextBtn.addEventListener('touchcancel', cancelHold);
        
        // Hover effect
        nextBtn.addEventListener('mouseenter', () => { nextBtn.style.background = 'rgba(255,255,255,0.2)'; nextBtn.style.color = '#fff'; });
        nextBtn.addEventListener('mouseleave', () => { nextBtn.style.background = 'rgba(255,255,255,0.1)'; nextBtn.style.color = '#aaa'; });
    }
    
    // Adjust panel content to fit with song info
    adjustPanelForSongInfo();
}

function adjustPanelForSongInfo() {
    // Make controls section more compact to fit song info
    const controls = document.querySelector('.controls');
    if (controls) {
        controls.style.fontSize = '11px';
        controls.style.lineHeight = '1.3';
    }
    
    // Compact the planet stats if present
    const planetStats = document.getElementById('planetStats');
    if (planetStats) {
        planetStats.style.padding = '8px';
        planetStats.style.marginTop = '8px';
    }
}

// Show purge notification popup in side panel (where planet stats is)
function showPurgeNotification(songName, duration) {
    // Remove any existing notification
    const existing = document.getElementById('purgeNotification');
    if (existing) existing.remove();
    
    // Hide planet stats temporarily
    const planetStats = document.getElementById('planetStats');
    if (planetStats) {
        planetStats.style.display = 'none';
    }
    
    // Find side panel to insert notification
    const sidePanel = document.querySelector('.side-panel');
    if (!sidePanel) return;
    
    const notification = document.createElement('div');
    notification.id = 'purgeNotification';
    notification.style.cssText = `
        background: rgba(0, 0, 0, 0.85);
        border: 1px solid #ff6b6b;
        border-radius: 0.5vh;
        padding: 1vh 0.8vw;
        margin-top: 1vh;
        text-align: center;
        animation: purgeNotifFade 3s ease-in-out forwards;
        font-size: 0.85em;
    `;
    
    let message;
    if (duration === 'indefinite') {
        message = `<span style="color: #ff6b6b;">🚫</span>
            <span style="color: #fff;">"${songName}"</span><br>
            <span style="color: #ff6b6b;">purged indefinitely</span>`;
    } else if (duration === 'week') {
        message = `<span style="color: #ffaa00;">⏭️</span>
            <span style="color: #fff;">"${songName}"</span><br>
            <span style="color: #ffaa00;">purged for 1 week</span><br>
            <span style="color: #888; font-size: 0.8em;">
                Hold ⏭ to purge indefinitely
            </span>`;
    }
    
    notification.innerHTML = message;
    
    // Insert where planet stats is (above song info)
    const songInfo = document.getElementById('songInfo');
    if (planetStats && planetStats.parentNode) {
        // Insert in place of planet stats
        planetStats.parentNode.insertBefore(notification, planetStats);
    } else if (songInfo) {
        // Insert before song info
        songInfo.parentNode.insertBefore(notification, songInfo);
    } else {
        sidePanel.appendChild(notification);
    }
    
    // Add animation keyframes if not already present
    if (!document.getElementById('purgeNotificationStyles')) {
        const style = document.createElement('style');
        style.id = 'purgeNotificationStyles';
        style.textContent = `
            @keyframes purgeNotifFade {
                0% { opacity: 0; }
                15% { opacity: 1; }
                85% { opacity: 1; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Remove after animation and restore planet stats (only if game still running)
    setTimeout(() => {
        if (notification.parentNode) notification.remove();
        if (gameRunning && planetStats && planetStats.querySelector('#planetStatsContent')?.innerHTML) {
            planetStats.style.display = 'block';
        }
    }, 3000);
}

// Update music dropdown to show purged songs with asterisk
function updateMusicDropdownPurgeIndicators() {
    const musicSelect = document.getElementById('musicSelect');
    const introMusicSelect = document.getElementById('introMusicSelect');
    
    if (!musicSelect) return;
    
    const purgedSongs = typeof getPurgedSongs === 'function' ? getPurgedSongs() : [];
    const purgedIds = new Set(purgedSongs.map(p => p.songId));
    
    // Update both dropdowns
    [musicSelect, introMusicSelect].forEach(select => {
        if (!select) return;
        
        Array.from(select.options).forEach(option => {
            const songId = option.value;
            // Skip special options
            if (songId === 'shuffle' || songId === 'none' || option.disabled) return;
            
            // Get original text (remove any existing asterisk)
            let text = option.getAttribute('data-original-text') || option.textContent;
            if (!option.getAttribute('data-original-text')) {
                option.setAttribute('data-original-text', text);
            }
            
            // Add or remove asterisk
            if (purgedIds.has(songId)) {
                option.textContent = text + ' *';
                option.style.color = '#888';
            } else {
                option.textContent = text;
                option.style.color = '';
            }
        });
    });
    
    // Update or create the purge info section in settings
    updatePurgeInfoInSettings(purgedSongs.length);
}

// Update purge info section in settings
function updatePurgeInfoInSettings(purgeCount) {
    const musicSelect = document.getElementById('musicSelect');
    if (!musicSelect) return;
    
    const settingsOption = musicSelect.closest('.settings-option');
    if (!settingsOption) return;
    
    // Find or create the purge info div
    let purgeInfo = document.getElementById('purgeInfoSection');
    
    if (purgeCount > 0) {
        if (!purgeInfo) {
            purgeInfo = document.createElement('div');
            purgeInfo.id = 'purgeInfoSection';
            purgeInfo.style.cssText = `
                font-size: 0.75em;
                color: #888;
                margin-top: 0.5vh;
                padding: 0.5vh 0;
            `;
            settingsOption.appendChild(purgeInfo);
        }
        purgeInfo.innerHTML = `
            <span style="color: #ffaa00;">* = purged song (skipped in shuffle)</span><br>
            <a href="#" id="unpurgeAllLink" style="color: #6b9fff; text-decoration: underline; cursor: pointer;">
                Un-purge all ${purgeCount} song${purgeCount > 1 ? 's' : ''}
            </a>
        `;
        
        // Add click handler for un-purge link
        const unpurgeLink = document.getElementById('unpurgeAllLink');
        if (unpurgeLink) {
            unpurgeLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof clearAllPurgedSongs === 'function') {
                    clearAllPurgedSongs();
                    updateMusicDropdownPurgeIndicators();
                }
            });
        }
    } else if (purgeInfo) {
        purgeInfo.remove();
    }
}

// Create volume controls dynamically
function createVolumeControls() {
    // Find the side panel
    const sidePanel = document.querySelector('.side-panel');
    if (!sidePanel) return;
    
    // Check if already exists
    if (document.getElementById('volumeControls')) return;
    
    // Find music select to insert after it
    const musicSelect = document.getElementById('musicSelect');
    const musicParent = musicSelect?.parentElement?.parentElement;
    
    // Create volume controls container
    const volumeControls = document.createElement('div');
    volumeControls.id = 'volumeControls';
    volumeControls.style.cssText = `
        margin-top: 0.5vh;
        padding: 0.5vh 0.3vw;
    `;
    
    volumeControls.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5vw; margin-bottom: 0.6vh;">
            <button id="musicMuteBtn" style="background: none; border: 1px solid rgba(255,255,255,0.2); color: #aaa; padding: 0.3vh 0.5vw; border-radius: 0.3vh; cursor: pointer; font-size: 1.2vh;" title="Mute/Unmute Music">🔊</button>
            <label style="font-size: max(1vh, 9px); color: #888; flex-shrink: 0;">MUSIC</label>
            <input type="range" id="musicVolumeSlider" min="0" max="100" value="${getMusicVolume() * 100}" style="flex: 1; height: 0.8vh; cursor: pointer;">
            <span id="musicVolumeDisplay" style="font-size: max(1vh, 9px); color: #aaa; min-width: 2.5vw; text-align: right;">${Math.round(getMusicVolume() * 100)}%</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5vw;">
            <button id="sfxMuteBtn" style="background: none; border: 1px solid rgba(255,255,255,0.2); color: #aaa; padding: 0.3vh 0.5vw; border-radius: 0.3vh; cursor: pointer; font-size: 1.2vh;" title="Mute/Unmute Sound Effects">🔊</button>
            <label style="font-size: max(1vh, 9px); color: #888; flex-shrink: 0;">SFX</label>
            <input type="range" id="sfxVolumeSlider" min="0" max="100" value="${getSfxVolume() * 100}" style="flex: 1; height: 0.8vh; cursor: pointer;">
            <span id="sfxVolumeDisplay" style="font-size: max(1vh, 9px); color: #aaa; min-width: 2.5vw; text-align: right;">${Math.round(getSfxVolume() * 100)}%</span>
        </div>
    `;
    
    // Insert after music select option or at the end of side panel
    if (musicParent && musicParent.nextSibling) {
        // Remove the divider below Music since volume controls follow it
        musicParent.style.borderBottom = 'none';
        musicParent.parentNode.insertBefore(volumeControls, musicParent.nextSibling);
    } else {
        sidePanel.appendChild(volumeControls);
    }
    
    // Set up event listeners
    const musicVolumeSlider = document.getElementById('musicVolumeSlider');
    const sfxVolumeSlider = document.getElementById('sfxVolumeSlider');
    const musicMuteBtn = document.getElementById('musicMuteBtn');
    const sfxMuteBtn = document.getElementById('sfxMuteBtn');
    const musicVolumeDisplay = document.getElementById('musicVolumeDisplay');
    const sfxVolumeDisplay = document.getElementById('sfxVolumeDisplay');
    
    musicVolumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        setMusicVolume(volume);
        musicVolumeDisplay.textContent = `${e.target.value}%`;
        updateMuteButtonIcon(musicMuteBtn, isMusicMuted());
    });
    
    sfxVolumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        setSfxVolume(volume);
        sfxVolumeDisplay.textContent = `${e.target.value}%`;
        updateMuteButtonIcon(sfxMuteBtn, isSfxMuted());
    });
    
    musicMuteBtn.addEventListener('click', () => {
        toggleMusicMute();
        updateMuteButtonIcon(musicMuteBtn, isMusicMuted());
    });
    
    sfxMuteBtn.addEventListener('click', () => {
        toggleSfxMute();
        updateMuteButtonIcon(sfxMuteBtn, isSfxMuted());
    });
    
    // Set initial mute button states
    updateMuteButtonIcon(musicMuteBtn, isMusicMuted());
    updateMuteButtonIcon(sfxMuteBtn, isSfxMuted());
}

function updateMuteButtonIcon(button, isMuted) {
    if (button) {
        button.textContent = isMuted ? '🔇' : '🔊';
        button.style.color = isMuted ? '#ff6666' : '#aaa';
    }
}

function updateSongInfoDisplay(songInfo) {
    if (!songInfoElement) {
        createSongInfoElement();
    }
    if (!songInfoElement) return;
    
    if (!songInfo) {
        songInfoElement.style.display = 'none';
        // Reset browser tab title when no song playing
        document.title = window.GAME_TITLE || 'TaNTЯiS';
        return;
    }
    
    songInfoElement.style.display = 'flex';
    
    const songNameEl = document.getElementById('songName');
    const songDurationEl = document.getElementById('songDuration');
    const prevBtn = document.getElementById('songPrevBtn');
    const pauseBtn = document.getElementById('songPauseBtn');
    
    if (songNameEl) {
        songNameEl.textContent = songInfo.name;
    }
    
    // Update browser tab title with current song
    const gameTitle = window.GAME_TITLE || 'TaNTЯiS';
    document.title = `${gameTitle} - ${songInfo.name}`;
    
    if (songDurationEl && songInfo.duration > 0) {
        const minutes = Math.floor(songInfo.duration / 60);
        const seconds = Math.floor(songInfo.duration % 60);
        songDurationEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else if (songDurationEl) {
        songDurationEl.textContent = '';
    }
    
    // Update previous button state based on song history
    if (prevBtn) {
        const canGoPrev = typeof hasPreviousSong === 'function' && hasPreviousSong();
        if (canGoPrev) {
            prevBtn.disabled = false;
            prevBtn.style.opacity = '1';
            prevBtn.style.color = '#aaa';
            prevBtn.style.cursor = 'pointer';
        } else {
            prevBtn.disabled = true;
            prevBtn.style.opacity = '0.5';
            prevBtn.style.color = '#555';
            prevBtn.style.cursor = 'default';
        }
    }
    
    // Update pause button state
    if (pauseBtn) {
        const isPaused = typeof isMusicPaused === 'function' && isMusicPaused();
        pauseBtn.textContent = isPaused ? '▶\uFE0E' : '⏸\uFE0E';
    }
}

// Set up the song change callback
if (typeof setOnSongChangeCallback === 'function') {
    setOnSongChangeCallback(updateSongInfoDisplay);
}

// Set up the pause state change callback (for earbud/media key controls)
if (typeof setOnPauseStateChangeCallback === 'function') {
    setOnPauseStateChangeCallback((isPaused) => {
        const pauseBtn = document.getElementById('songPauseBtn');
        if (pauseBtn) {
            pauseBtn.textContent = isPaused ? '▶\uFE0E' : '⏸\uFE0E';
        }
    });
}
// trainingWheelsToggle removed - shadow is now standard (use Shadowless challenge for +4% bonus)
const stormEffectsToggle = document.getElementById('stormEffectsToggle');

// Initialize StormEffects module (board reference passed later via updateGameState)
if (typeof StormEffects !== 'undefined') {
    StormEffects.init({
        canvas: canvas,
        ctx: ctx,
        board: null, // Will be set via updateGameState when game starts
        stormEffectsToggle: stormEffectsToggle
    });
}

const settingsBtn = document.getElementById('settingsBtn');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const opacitySlider = document.getElementById('opacitySlider');
const starSpeedSlider = document.getElementById('starSpeedSlider');
const minimalistToggle = document.getElementById('minimalistToggle');
const minimalistOption = document.getElementById('minimalistOption');
let minimalistMode = false;

// AI Mode
const aiModeToggle = document.getElementById('aiModeToggle');
// Initialize from localStorage (more reliable than browser form restoration)
const savedAiMode = localStorage.getItem('aiModeEnabled');
let aiModeEnabled = savedAiMode === 'true';
// Sync checkbox to match
if (aiModeToggle) aiModeToggle.checked = aiModeEnabled;
const aiSpeedSlider = document.getElementById('aiSpeedSlider');

// Helper function to determine the correct leaderboard mode based on AI and challenge settings
function getLeaderboardMode() {
    const isChallenge = challengeMode !== 'normal';
    if (aiModeEnabled) {
        return isChallenge ? 'ai-challenge' : 'ai';
    }
    return isChallenge ? 'challenge' : 'normal';
}

let ROWS = 20;
let COLS = 10;

// Connect StarfieldSystem sound callback now that soundToggle is defined
StarfieldSystem.setSoundCallback(playSoundEffect, soundToggle);

// Set up UFO swoop callback for 42 lines easter egg
StarfieldSystem.setUFOSwoopCallback(() => {
    // During replay, use the recorded F Word song; otherwise pick random and record it
    if (GameReplay.isActive() && GameReplay.getFWordSongId()) {
        insertFWordSongById(GameReplay.getFWordSongId());
        console.log('🛸 UFO delivered recorded song:', GameReplay.getFWordSongId());
    } else {
        // Queue a random F Word song and record which one was selected
        const selectedSong = insertFWordSong();
        if (window.GameRecorder && window.GameRecorder.isActive()) {
            window.GameRecorder.recordFWordSong(selectedSong.id);
        }
        console.log('🛸 UFO delivered special song!');
    }
    
    // Play banjo sound effect, then skip to the F Word song when banjo finishes
    playBanjoWithMusicPause(soundToggle, () => {
        // After banjo finishes, immediately skip to the queued F Word song
        skipToNextSong();
        console.log('🎵 Skipped to F Word song after banjo');
    });
});

// Initialize Color Palette Dropdown
function initPaletteDropdown() {
    const dropdownBtn = document.getElementById('paletteDropdownBtn');
    const dropdownMenu = document.getElementById('paletteDropdownMenu');
    const palettePreview = document.getElementById('palettePreview');
    const paletteDropdown = document.getElementById('paletteDropdown');
    
    if (!dropdownBtn || !dropdownMenu || !palettePreview || typeof ColorPalettes === 'undefined') {
        console.warn('Palette dropdown elements not found or ColorPalettes not loaded');
        return;
    }
    
    // Prevent label click behavior on the dropdown container
    if (paletteDropdown) {
        paletteDropdown.addEventListener('click', (e) => {
            e.preventDefault();
        });
    }
    
    // Populate dropdown menu
    const categories = ColorPalettes.getPalettesByCategory();
    const categoryOrder = ColorPalettes.getCategoryOrder();
    
    dropdownMenu.innerHTML = '';
    categoryOrder.forEach(category => {
        const palettes = categories[category];
        if (!palettes || palettes.length === 0) return;
        
        // Category header
        const header = document.createElement('div');
        header.className = 'palette-category-header';
        header.textContent = category;
        dropdownMenu.appendChild(header);
        
        // Palette options
        palettes.forEach(palette => {
            const option = document.createElement('div');
            option.className = 'palette-option';
            if (palette.id === currentPaletteId) {
                option.classList.add('selected');
            }
            option.dataset.paletteId = palette.id;
            
            // Color swatches
            const colorRow = document.createElement('div');
            colorRow.className = 'palette-color-row';
            palette.colors.forEach(color => {
                const swatch = document.createElement('div');
                swatch.className = 'palette-color-swatch';
                swatch.style.backgroundColor = color;
                colorRow.appendChild(swatch);
            });
            
            // Name
            const name = document.createElement('span');
            name.className = 'palette-option-name';
            name.textContent = palette.name;
            
            option.appendChild(colorRow);
            option.appendChild(name);
            
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                selectPalette(palette.id);
                dropdownMenu.style.display = 'none';
            });
            
            dropdownMenu.appendChild(option);
        });
    });
    
    // Update preview for current palette
    updatePalettePreview();
    
    // Toggle dropdown
    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const isOpen = dropdownMenu.style.display === 'block';
        dropdownMenu.style.display = isOpen ? 'none' : 'block';
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.style.display = 'none';
        }
    });
}

function updatePalettePreview() {
    const palettePreview = document.getElementById('palettePreview');
    const paletteNameDisplay = document.getElementById('paletteNameDisplay');
    if (!palettePreview || typeof ColorPalettes === 'undefined') return;
    
    const colors = ColorPalettes.getColors(currentPaletteId);
    const paletteName = ColorPalettes.getPaletteName(currentPaletteId);
    
    palettePreview.innerHTML = '';
    colors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'palette-color-swatch';
        swatch.style.backgroundColor = color;
        palettePreview.appendChild(swatch);
    });
    
    if (paletteNameDisplay) {
        paletteNameDisplay.textContent = paletteName;
    }
}

function selectPalette(paletteId) {
    // Update selection in dropdown
    const dropdownMenu = document.getElementById('paletteDropdownMenu');
    if (dropdownMenu) {
        dropdownMenu.querySelectorAll('.palette-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.paletteId === paletteId);
        });
    }
    
    // Update colors
    initColorsFromPalette(paletteId);
    
    // Update preview
    updatePalettePreview();
    
    // Update histogram if it exists
    if (typeof Histogram !== 'undefined' && Histogram.init) {
        const histogramCanvas = document.getElementById('histogramCanvas');
        if (histogramCanvas) {
            Histogram.init({ canvas: histogramCanvas, colorSet: currentColorSet });
        }
    }
    
    console.log('🎨 Palette changed to:', paletteId);
}

// Initialize palette dropdown when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPaletteDropdown);
} else {
    initPaletteDropdown();
}

// Developer mode (activated by center-clicking "Don't Panic!")
let developerMode = false;

// AI Mode indicator element (for developer mode)
let aiModeIndicator = null;

// AI mode indicator is now drawn directly on canvas - these functions are kept for compatibility
function createAIModeIndicator() {
    // No longer needed - AI mode indicator drawn on canvas
}

function exitAIGame() {
    if (!aiModeEnabled) return;
    console.log('🤖 AI game cancelled by user');
    
    // Stop the game loop
    gameRunning = false;
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = null;
    }
    
    // Stop AI player
    if (typeof AIPlayer !== 'undefined') {
        AIPlayer.setEnabled(false);
    }
    
    // Stop music and timers
    cancelAIAutoRestartTimer();
    stopMusic();
    GamepadController.stopVibration(); // Stop any controller haptic feedback
    
    // Hide sun/planets and planet stats
    if (typeof StarfieldSystem !== 'undefined') {
        StarfieldSystem.setGameRunning(false);
        StarfieldSystem.hidePlanetStats();
    }
    const planetStats = document.getElementById('planetStats');
    const planetStatsLeft = document.getElementById('planetStatsLeft');
    if (planetStats) planetStats.style.display = 'none';
    if (planetStatsLeft) planetStatsLeft.style.display = 'none';
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset board
    initBoard();
    
    // Clear pieces
    currentPiece = null;
    nextPieceQueue = [];
    
    // Hide game over, show menu
    gameOverDiv.style.display = 'none';
    modeMenu.classList.remove('hidden');
    document.body.classList.remove('game-started');
    toggleUIElements(true);
    
    // Clear exit bounds
    window.aiExitBounds = null;
    
    // Show AI mode overlay on menu
    updateAIModeMenuOverlay();
}

function updateAIModeIndicator() {
    // No longer needed - AI mode indicator drawn on canvas
}

// Game mode configuration
let gameMode = null;
// Initialize skillLevel from localStorage (more reliable than browser form restoration)
const savedSkillLevel = localStorage.getItem('skillLevel');
let skillLevel = savedSkillLevel || 'tempest'; // 'breeze', 'tempest', 'maelstrom'
window.skillLevel = skillLevel; // Expose globally for AI
// Sync select to match
const skillLevelSelectInit = document.getElementById('skillLevelSelect');
if (skillLevelSelectInit) skillLevelSelectInit.value = skillLevel;
let lastPlayedMode = null; // Track the last played mode for menu selection

const SHAPES = {
    I: [[1,1,1,1]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1]],
    S: [[0,1,1],[1,1,0]],
    Z: [[1,1,0],[0,1,1]],
    J: [[1,0,0],[1,1,1]],
    L: [[0,0,1],[1,1,1]]
};

// Extended shapes for Blizzard/Hurricane modes (5-block pieces)
const EXTENDED_SHAPES = {
    ...SHAPES,
    I5: [[1,1,1,1,1]],                    // 5-long I piece
    Plus: [[0,1,0],[1,1,1],[0,1,0]],      // Plus/cross shape
    W: [[1,0,0],[1,1,0],[0,1,1]],         // W shape
    U: [[1,0,1],[1,1,1]],                 // U shape
    P: [[1,1],[1,1],[1,0]],               // P shape (3 high)
    F: [[0,1,1],[1,1,0],[0,1,0]],         // F shape
    L5: [[1,0],[1,0],[1,0],[1,1]],        // L pentomino (4 high)
    N: [[0,1],[1,1],[1,0],[1,0]],         // N shape
    T5: [[1,1,1],[0,1,0],[0,1,0]],        // T pentomino (tall T)
    V: [[1,0,0],[1,0,0],[1,1,1]],         // V shape
    Y: [[0,1],[1,1],[0,1],[0,1]],         // Y shape
    Z5: [[1,1,0],[0,1,0],[0,1,1]]         // Z pentomino
};

// Blizzard shapes - moderate difficulty pentominoes
const BLIZZARD_SHAPES = {
    ...SHAPES,
    I5: [[1,1,1,1,1]],                    // 5-long I piece
    U: [[1,0,1],[1,1,1]],                 // U shape
    P: [[1,1],[1,1],[1,0]],               // P shape (3 high)
    L5: [[1,0],[1,0],[1,0],[1,1]],        // L pentomino (4 high)
    N: [[0,1],[1,1],[1,0],[1,0]],         // N shape
    T5: [[1,1,1],[0,1,0],[0,1,0]],        // T pentomino (tall T)
    V: [[1,0,0],[1,0,0],[1,1,1]]          // V shape
};

// Current palette ID - stored in localStorage
let currentPaletteId = localStorage.getItem('tantris_palette') || 'classic';

// Dynamic COLORS and COLOR_SETS based on selected palette
let COLORS = [];
let COLOR_SETS = {};

// Initialize colors from palette
function initColorsFromPalette(paletteId) {
    if (typeof ColorPalettes === 'undefined') {
        // Fallback to classic colors if ColorPalettes not loaded yet
        COLORS = ['#FF6B6B', '#FFA07A', '#F7DC6F', '#52B788', '#45B7D1', '#85C1E2', '#BB8FCE', '#FFB3D9'];
        COLOR_SETS = {
            4: ['#FF6B6B', '#F7DC6F', '#52B788', '#45B7D1'],
            5: ['#FF6B6B', '#F7DC6F', '#52B788', '#45B7D1', '#BB8FCE'],
            6: ['#FF6B6B', '#FFA07A', '#F7DC6F', '#52B788', '#45B7D1', '#BB8FCE'],
            7: ['#FF6B6B', '#FFA07A', '#F7DC6F', '#52B788', '#45B7D1', '#BB8FCE', '#FFB3D9'],
            8: COLORS
        };
        return;
    }
    
    currentPaletteId = paletteId;
    COLORS = ColorPalettes.getColors(paletteId);
    COLOR_SETS = ColorPalettes.getColorSets(paletteId);
    
    // Save to localStorage (skip during AI mode to preserve user preference)
    if (!aiModeEnabled) {
        localStorage.setItem('tantris_palette', paletteId);
    }
    
    // Update currentColorSet based on current game mode
    updateCurrentColorSet();
}

// Initialize with saved palette
initColorsFromPalette(currentPaletteId);

// Update currentColorSet based on current game mode
function updateCurrentColorSet() {
    if (!gameMode) return;
    
    switch(gameMode) {
        case 'drizzle':
            currentColorSet = COLOR_SETS[4];
            break;
        case 'downpour':
            currentColorSet = COLOR_SETS[6];
            break;
        case 'hailstorm':
            currentColorSet = COLOR_SETS[8];
            break;
        case 'blizzard':
            currentColorSet = COLOR_SETS[5];
            break;
        case 'hurricane':
            currentColorSet = COLOR_SETS[7];
            break;
        default:
            currentColorSet = COLORS;
    }
}

let currentColorSet = COLORS; // Initialize after COLORS is defined

// Speed Bonus tracking variables
let speedBonusTotal = 0; // Sum of all individual piece speed bonuses
let speedBonusPieceCount = 0; // Number of pieces placed
let speedBonusAverage = 1.0; // Running average (displayed and applied to score)
let pieceSpawnTime = 0; // Timestamp when current piece spawned

// Storm Particle System - Now handled by StormEffects module (storm-effects.js)
// Variables stormParticles, liquidPools, splashParticles, MAX_STORM_PARTICLES moved to module

// Tornado System
let tornadoActive = false;
let tornadoY = 0; // Current Y position of tornado tip
let tornadoX = 0; // X position (center column)
let tornadoRotation = 0; // Rotation angle for visual effect
let tornadoSpeed = 1.5; // Pixels per frame descending (slowed to half)
let tornadoPickedBlob = null; // Blob currently being lifted
let tornadoState = 'descending'; // 'descending', 'lifting', 'carrying', 'dropping', 'dissipating'
let tornadoDropTargetX = 0; // Where to drop the blob
let tornadoLiftStartY = 0; // Where lift started
let tornadoBlobRotation = 0; // Rotation of the lifted blob
let tornadoVerticalRotation = 0; // Rotation around vertical axis (for 3D effect)
let tornadoOrbitStartTime = null; // When blob started orbiting
let tornadoOrbitRadius = 0; // Distance from tornado center
let tornadoOrbitAngle = 0; // Current angle around tornado
let tornadoLiftHeight = 0; // Current height of blob as it climbs
let tornadoDropStartY = 0; // Y position when dropping starts
let tornadoDropVelocity = 0; // Velocity when blob is falling
let tornadoFinalPositions = null; // Pre-calculated final grid positions for dropped blob
let tornadoFinalCenterX = null; // Final center X in pixels
let tornadoFinalCenterY = null; // Final center Y in pixels
let tornadoFadeProgress = 0; // 0 to 1 for dissipation animation
let tornadoSnakeVelocity = 0; // Current horizontal velocity
let tornadoSnakeDirection = 1; // 1 or -1
let tornadoSnakeChangeCounter = 0; // Frames until direction change
let tornadoParticles = []; // Swirling particles around tornado

let disintegrationParticles = []; // Particles for blob explosion

// Earthquake state
let earthquakeActive = false;
let earthquakePhase = 'shake'; // 'shake' (2s horizontal shake), 'crack', 'shift', 'done'
let earthquakeShakeProgress = 0;
let earthquakeShakeIntensity = 0; // Used for horizontal shaking throughout earthquake
let earthquakeCrack = []; // Array of {x, y, edge} points forming the crack
let earthquakeCrackProgress = 0;
let earthquakeCrackMap = new Map(); // Map of Y -> X position for fast lookup
let earthquakeShiftProgress = 0;
let earthquakeLeftBlocks = []; // Blocks on left side of crack
let earthquakeRightBlocks = []; // Blocks on right side of crack
let earthquakeShiftType = 'both'; // 'both', 'left', 'right' - determines which side(s) move

// Weather event grace period - lines cleared since last tornado/earthquake ended
let weatherEventGracePeriod = 0;
const WEATHER_GRACE_LINES = 4; // Lines that must be cleared before next weather event

// Black Hole Animation System
let blackHoleActive = false;
let blackHoleAnimating = false;
let blackHoleCenterX = 0;
let blackHoleCenterY = 0;
let blackHoleBlocks = []; // Blocks to be sucked in: {x, y, color, distance, pulled}
let blackHoleStartTime = 0;
let blackHoleDuration = 2500; // 2.5 seconds for full animation
let blackHoleShakeIntensity = 0;
let blackHoleInnerBlob = null;
let blackHoleOuterBlob = null;

// Replay System State - managed by replay.js (window.GameReplay)

// Falling Blocks Animation System
let fallingBlocks = []; // Blocks that are animating falling: {x, y, targetY, color, progress, isRandom}
let gravityAnimating = false;

// Tsunami Animation System
let tsunamiActive = false;
let tsunamiAnimating = false;
let tsunamiBlob = null;
let tsunamiBlocks = []; // Blocks collapsing: {x, y, color, targetY, currentY, removed}
let tsunamiPushedBlocks = []; // Blocks above tsunami that get pushed up
let tsunamiStartTime = 0;
let tsunamiDuration = 2000; // 2 seconds
let tsunamiWobbleIntensity = 0;

// Volcano Animation System
let volcanoActive = false;
let volcanoAnimating = false;
let volcanoPhase = 'warming'; // 'warming' (vibration + color change), 'erupting' (projectiles)
let volcanoLavaBlob = null; // The blob that turned to lava
let volcanoLavaColor = '#FF4500'; // Intense glowing red-orange (OrangeRed)
let volcanoEruptionColumn = -1; // Which column to erupt through
let volcanoEdgeType = ''; // Which edge(s) the lava blob is against: 'left', 'right', 'bottom', or combinations
let volcanoProjectiles = []; // Lava blocks flying: {x, y, vx, vy, gravity, color, landed}
let volcanoStartTime = 0;
let volcanoWarmingDuration = 3000; // 3 seconds of warming/vibration before eruption
let volcanoEruptionDuration = 2000; // 2 seconds of eruption
let volcanoVibrateOffset = { x: 0, y: 0 }; // Current vibration offset for warming phase
let volcanoColorProgress = 0; // 0 to 1, tracks color transition during warming
let volcanoOriginalColor = null; // Store original color to transition from
let volcanoProjectilesSpawned = 0; // Track how many projectiles have been spawned
let volcanoTargetProjectiles = 0; // How many projectiles to spawn (matches blob size)


// Get pulsing lava color (oscillates between darker and brighter)
function getLavaColor() {
    // Pulse over 2 seconds (slower, more dramatic)
    const pulse = Math.sin(Date.now() / 1000) * 0.5 + 0.5; // 0.0 to 1.0
    
    // Base color: #FF4500 (255, 69, 0)
    const baseR = 255;
    const baseG = 69;
    const baseB = 0;
    
    // Oscillate between 70% and 130% brightness
    const minBrightness = 0.7;
    const maxBrightness = 1.3;
    const brightness = minBrightness + pulse * (maxBrightness - minBrightness);
    
    // Apply brightness
    const r = Math.min(255, Math.round(baseR * brightness));
    const g = Math.min(255, Math.round(baseG * brightness));
    const b = Math.min(255, Math.round(baseB * brightness));
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function triggerBlackHole(innerBlob, outerBlob) {
    // Calculate center of black hole (center of inner blob)
    const innerXs = innerBlob.positions.map(p => p[0]);
    const innerYs = innerBlob.positions.map(p => p[1]);
    blackHoleCenterX = (Math.min(...innerXs) + Math.max(...innerXs)) / 2;
    blackHoleCenterY = (Math.min(...innerYs) + Math.max(...innerYs)) / 2;
    
    // Store references
    blackHoleInnerBlob = innerBlob;
    blackHoleOuterBlob = outerBlob;
    
    // Remove inner blob from board immediately (we'll render it as dark vortex)
    innerBlob.positions.forEach(([x, y]) => {
        board[y][x] = null;
        isRandomBlock[y][x] = false;
        fadingBlocks[y][x] = null;
    });
    
    // Create list of all blocks to animate (only outer blob gets sucked in)
    blackHoleBlocks = [];
    
    // Add outer blob blocks (these get sucked in)
    outerBlob.positions.forEach(([x, y]) => {
        const dx = x - blackHoleCenterX;
        const dy = y - blackHoleCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        blackHoleBlocks.push({
            x, y,
            color: outerBlob.color,
            distance,
            isInner: false,
            animating: false,
            removed: false,
            pullProgress: 0,
            currentX: x,
            currentY: y,
            startX: x,
            startY: y,
            scale: 1,
            rotation: 0
        });
    });
    
    // Sort by distance (farthest first)
    blackHoleBlocks.sort((a, b) => b.distance - a.distance);
    
    blackHoleActive = true;
    blackHoleAnimating = true;
    blackHoleStartTime = Date.now();
    blackHoleShakeIntensity = 8; // pixels
    
    // Add visual effect
    canvas.classList.add('blackhole-active');
    playEnhancedThunder(soundToggle);
    
    // Start controller haptic feedback (continuous rumble)
    GamepadController.startContinuousRumble(0.4, 0.7);
}

function createDisintegrationExplosion(blob) {
    // Create particles for each block in the blob
    blob.positions.forEach(([x, y]) => {
        const blockCenterX = x * BLOCK_SIZE + BLOCK_SIZE / 2;
        const blockCenterY = y * BLOCK_SIZE + BLOCK_SIZE / 2;
        
        // Create 12-16 particles per block
        const particleCount = 12 + Math.floor(Math.random() * 5);
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.random() * Math.PI * 2);
            const speed = 2 + Math.random() * 4;
            const size = 3 + Math.random() * 5;
            
            disintegrationParticles.push({
                x: blockCenterX,
                y: blockCenterY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1, // Slight upward bias
                size: size,
                color: blob.color,
                opacity: 1,
                life: 1, // 0 to 1
                decay: 0.015 + Math.random() * 0.01,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3
            });
        }
    });
}

function updateDisintegrationParticles() {
    disintegrationParticles = disintegrationParticles.filter(p => {
        // Apply physics
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // Gravity
        p.vx *= 0.98; // Air resistance
        p.rotation += p.rotationSpeed;
        
        // Fade out
        p.life -= p.decay;
        p.opacity = p.life;
        
        return p.life > 0;
    });
}

function drawDisintegrationParticles() {
    disintegrationParticles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        
        // Draw as small square chunks
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        
        // Add some darker edge for depth
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
        
        ctx.restore();
    });
}

function updateBlackHoleAnimation() {
    if (!blackHoleAnimating) return;
    
    const elapsed = Date.now() - blackHoleStartTime;
    const progress = Math.min(elapsed / blackHoleDuration, 1);
    
    // Shake intensity decreases over time
    blackHoleShakeIntensity = 8 * (1 - progress * 0.5);
    
    // Update each block's animation state
    blackHoleBlocks.forEach((block, index) => {
        // Each block starts being pulled at different times
        const blockStartDelay = (index / blackHoleBlocks.length) * 0.7; // First 70% of animation
        const blockProgress = Math.max(0, Math.min(1, (progress - blockStartDelay) / 0.3)); // 30% duration per block
        
        if (blockProgress > 0 && !block.animating) {
            block.animating = true;
            block.startX = block.x;
            block.startY = block.y;
        }
        
        if (block.animating) {
            block.pullProgress = blockProgress;
            
            // Spiral path to center
            const spiralRotations = 2; // 2 full rotations as it spirals in
            const angle = blockProgress * Math.PI * 2 * spiralRotations;
            
            // Distance from center decreases
            const startDist = block.distance;
            const currentDist = startDist * (1 - blockProgress);
            
            // Calculate position (spiral inward)
            const centerX = blackHoleCenterX;
            const centerY = blackHoleCenterY;
            const dx = block.startX - centerX;
            const dy = block.startY - centerY;
            const startAngle = Math.atan2(dy, dx);
            
            block.currentX = centerX + Math.cos(startAngle + angle) * currentDist;
            block.currentY = centerY + Math.sin(startAngle + angle) * currentDist;
            
            // Scale decreases as it approaches center
            block.scale = 1 - blockProgress;
            
            // Rotation increases
            block.rotation = angle;
            
            // Remove from board once it reaches the center
            if (blockProgress >= 1 && !block.removed) {
                block.removed = true;
                if (board[block.y] && board[block.y][block.x]) {
                    board[block.y][block.x] = null;
                    isRandomBlock[block.y][block.x] = false;
                    fadingBlocks[block.y][block.x] = null;
                }
            }
        }
    });
    
    // Animation complete
    if (progress >= 1) {
        console.log('🕳️ Black hole animation complete');
        blackHoleAnimating = false;
        blackHoleActive = false;
        blackHoleShakeIntensity = 0;
        canvas.classList.remove('blackhole-active');
        
        // Stop controller haptic feedback
        GamepadController.stopVibration();
        
        // During replay, skip the next board sync
        if (GameReplay.isActive()) {
            GameReplay.setSkipNextSync(true);
            console.log('🎬 Will skip next board sync (black hole just finished)');
        }
        
        console.log('🕳️ Black hole calling applyGravity()');
        // Apply gravity after black hole
        applyGravity();
        // Note: checkForSpecialFormations will be called after gravity animation completes
    }
}

function drawBlackHole() {
    if (!blackHoleActive) return;
    
    ctx.save();
    
    // Note: The vortex is now drawn BEHIND blocks in drawBoard()
    // Here we only draw the animating outer blocks (spiraling and shrinking)
    
    blackHoleBlocks.forEach(block => {
        if (block.animating && !block.removed && block.scale > 0.05) {
            ctx.save();
            
            const px = block.currentX * BLOCK_SIZE;
            const py = block.currentY * BLOCK_SIZE;
            const centerX = px + BLOCK_SIZE / 2;
            const centerY = py + BLOCK_SIZE / 2;
            
            // Translate to center, rotate and scale
            ctx.translate(centerX, centerY);
            ctx.rotate(block.rotation);
            ctx.scale(block.scale, block.scale);
            ctx.translate(-centerX, -centerY);
            
            // Fade as it approaches center
            ctx.globalAlpha = block.scale;
            
            // Draw the block
            drawSolidShape(ctx, [[block.currentX, block.currentY]], block.color, BLOCK_SIZE, false, getFaceOpacity());
            
            ctx.restore();
            
            // Add trailing particles
            if (Math.random() < 0.3 && block.pullProgress < 0.9) {
                disintegrationParticles.push({
                    x: px + BLOCK_SIZE / 2,
                    y: py + BLOCK_SIZE / 2,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    size: 2 + Math.random() * 3,
                    color: block.color,
                    opacity: 0.8,
                    life: 0.8,
                    decay: 0.03,
                    gravity: 0,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() - 0.5) * 0.3
                });
            }
        }
    });
    ctx.restore();
}

// ============================================
// VOLCANO SYSTEM
// ============================================

function triggerVolcano(lavaBlob, eruptionColumn, edgeType = 'bottom') {
    console.log('🌋 Volcano triggered! Starting warming phase...', 'Lava blob size:', lavaBlob.positions.length, 'Eruption column:', eruptionColumn, 'Edge:', edgeType);
    
    volcanoActive = true;
    volcanoAnimating = true;
    volcanoPhase = 'warming'; // Start with warming phase
    volcanoLavaBlob = lavaBlob;
    volcanoEruptionColumn = eruptionColumn;
    volcanoEdgeType = edgeType;
    volcanoStartTime = Date.now();
    volcanoProjectiles = [];
    volcanoVibrateOffset = { x: 0, y: 0 };
    volcanoColorProgress = 0;
    volcanoProjectilesSpawned = 0; // Reset counter
    volcanoTargetProjectiles = lavaBlob.positions.length; // Set target to blob size
    
    // Store the original color of the lava blob for gradual transition
    if (lavaBlob.positions.length > 0) {
        const [x, y] = lavaBlob.positions[0];
        volcanoOriginalColor = board[y][x];
    }
    
    // DON'T remove blocks yet - they stay on board during warming
    // They'll be removed when eruption phase starts
    
    // Play continuous rumble sound to indicate volcano is warming up
    playVolcanoRumble(soundToggle);
    
    // Start controller haptic feedback (building rumble)
    GamepadController.startVolcanoRumble();
}

function updateVolcanoAnimation() {
    if (!volcanoAnimating) return;
    
    const elapsed = Date.now() - volcanoStartTime;
    
    if (volcanoPhase === 'warming') {
        // WARMING PHASE: Vibrate and gradually change color
        const warmingProgress = Math.min(elapsed / volcanoWarmingDuration, 1);
        volcanoColorProgress = warmingProgress;
        
        // Vibration gets more intense as it heats up
        const intensity = 2 + warmingProgress * 6; // 2 to 8 pixels
        const frequency = 0.02 + warmingProgress * 0.03; // Faster vibration over time
        volcanoVibrateOffset.x = Math.sin(Date.now() * frequency) * intensity;
        volcanoVibrateOffset.y = Math.cos(Date.now() * frequency * 1.3) * intensity;
        
        // When warming completes, transition to eruption phase
        if (warmingProgress >= 1) {
            console.log('🌋 Warming complete! Starting eruption...', 'Blob size:', volcanoLavaBlob.positions.length);
            volcanoPhase = 'erupting';
            volcanoStartTime = Date.now(); // Reset timer for eruption phase
            volcanoVibrateOffset = { x: 0, y: 0 }; // Stop vibrating
            
            // Eruption haptic burst
            GamepadController.vibrateVolcanoEruption();
            
            // === VOLCANO SCORING - Applied when eruption starts ===
            // This timing gives visual feedback (lava shooting) before score jumps
            const lavaSize = volcanoLavaBlob.positions.length;
            let lavaPoints = lavaSize * lavaSize * lavaSize * 500;
            
            // Apply SUPERVOLCANO bonus (x2) if tsunami was also detected
            if (volcanoIsSuper) {
                lavaPoints *= 2;
                showSuperEventBonus('superVolcano');
                console.log(`🌋🌊 SUPERVOLCANO x2! Points doubled!`);
                volcanoIsSuper = false; // Reset flag after use
            }
            
            // Apply CASCADE BONUS if this volcano was triggered by gravity from another special event
            let cascadeMultiplier = 1;
            if (cascadeLevel > 0) {
                cascadeMultiplier = cascadeLevel + 1;  // cascade 1 = 2x, cascade 2 = 3x, etc.
                lavaPoints *= cascadeMultiplier;
                showCascadeBonus(cascadeMultiplier);
                console.log(`🌋 VOLCANO CASCADE BONUS! x${cascadeMultiplier}`);
            }
            
            const finalVolcanoScore = applyScoreModifiers(lavaPoints * level);
            score += finalVolcanoScore;
            
            // Update histogram
            Histogram.updateWithBlob(volcanoLavaColor, lavaSize);
            Histogram.updateWithScore(finalVolcanoScore);
            
            updateStats();
            // === END VOLCANO SCORING ===
            
            // Clear the eruption column above lava (but keep lava blob visible)
            const colX = volcanoEruptionColumn;
            const lavaMaxY = Math.max(...volcanoLavaBlob.positions.map(p => p[1]));
            
            // Sort lava blob positions by Y (bottom to top) for sequential removal
            volcanoLavaBlob.positions.sort((a, b) => b[1] - a[1]); // Highest Y (bottom) first
            
            // Disintegrate blocks in eruption column above lava
            for (let y = 0; y < lavaMaxY; y++) {
                if (board[y] && board[y][colX]) {
                    // Create disintegration particles
                    for (let i = 0; i < 3; i++) {
                        disintegrationParticles.push({
                            x: colX * BLOCK_SIZE + Math.random() * BLOCK_SIZE,
                            y: y * BLOCK_SIZE + Math.random() * BLOCK_SIZE,
                            vx: (Math.random() - 0.5) * 4,
                            vy: (Math.random() - 0.5) * 4 - 2, // Slight upward bias
                            size: 2 + Math.random() * 4,
                            color: board[y][colX],
                            opacity: 1,
                            life: 1,
                            decay: 0.02,
                            gravity: 0.15,
                            rotation: Math.random() * Math.PI * 2,
                            rotationSpeed: (Math.random() - 0.5) * 0.2
                        });
                    }
                    board[y][colX] = null;
                    isRandomBlock[y][colX] = false;
                }
            }
            
            // Play explosion sound
            playSoundEffect('explosion', soundToggle);
        }
        
    } else if (volcanoPhase === 'erupting') {
        // ERUPTING PHASE: Spawn projectiles and update physics
        
        // Spawn projectiles at a fixed rate (one every 150ms) regardless of blob size
        const spawnInterval = 150; // ms between spawns
        const targetSpawnedByNow = Math.floor(elapsed / spawnInterval);
        
        // Spawn any missing projectiles (up to the total blob size)
        while (volcanoProjectilesSpawned < targetSpawnedByNow && volcanoProjectilesSpawned < volcanoTargetProjectiles) {
            spawnLavaProjectile();
            volcanoProjectilesSpawned++;
        }
        
        // Update projectiles
        volcanoProjectiles = volcanoProjectiles.filter(p => {
            // Check if projectile is sliding down a wall
            if (p.slidingWall) {
                // Store previous position for sweep collision
                const prevY = p.y;
                
                // Just fall straight down along the wall
                p.vy += p.gravity;
                p.y += p.vy;
                p.vx = 0; // No horizontal movement while sliding
                
                // Determine the grid column for this wall
                const wallGridX = p.slidingWall === 'left' ? 0 : COLS - 1;
                p.x = wallGridX * BLOCK_SIZE + BLOCK_SIZE / 2;
                
                // Check if we've hit bottom
                if (p.y >= ROWS * BLOCK_SIZE) {
                    // Find the lowest empty spot in the wall column
                    for (let y = ROWS - 1; y >= 0; y--) {
                        if (!board[y][wallGridX]) {
                            board[y][wallGridX] = volcanoLavaColor;
                            isRandomBlock[y][wallGridX] = false;
                            p.landed = true;
                            playSoundEffect('drop', soundToggle);
                            break;
                        }
                    }
                    return false;
                }
                
                // SWEEP COLLISION for wall sliding - check all rows passed through
                const prevGridY = Math.floor(prevY / BLOCK_SIZE);
                const currGridY = Math.floor(p.y / BLOCK_SIZE);
                
                for (let checkY = Math.max(0, prevGridY); checkY <= Math.min(ROWS - 1, currGridY); checkY++) {
                    if (board[checkY] && board[checkY][wallGridX]) {
                        // Found a block - land on top of it
                        const landY = checkY - 1;
                        if (landY >= 0 && !board[landY][wallGridX]) {
                            board[landY][wallGridX] = volcanoLavaColor;
                            isRandomBlock[landY][wallGridX] = false;
                            p.landed = true;
                            playSoundEffect('drop', soundToggle);
                            return false;
                        }
                    }
                }
                
                return true; // Keep sliding
            }
            
            // Normal projectile physics (not sliding)
            // Apply gravity
            p.vy += p.gravity;
            
            // Store previous position for sweep collision
            const prevY = p.y;
            
            // Update position
            p.x += p.vx;
            p.y += p.vy;
            
            // Check if projectile hit the left or right wall - start sliding
            if (p.x < BLOCK_SIZE / 2) {
                p.slidingWall = 'left';
                p.x = BLOCK_SIZE / 2;
                p.vx = 0;
                return true; // Continue to slide
            } else if (p.x > (COLS - 1) * BLOCK_SIZE + BLOCK_SIZE / 2) {
                p.slidingWall = 'right';
                p.x = (COLS - 1) * BLOCK_SIZE + BLOCK_SIZE / 2;
                p.vx = 0;
                return true; // Continue to slide
            }
            
            // Check if landed on board or bottom
            let gridX = Math.round(p.x / BLOCK_SIZE);
            const gridY = Math.round(p.y / BLOCK_SIZE);
            
            // Clamp gridX to valid columns
            gridX = Math.max(0, Math.min(COLS - 1, gridX));
            
            // Helper function to find ANY empty spot on the board (searches all columns)
            const findAnyEmptySpot = () => {
                // First try the target column
                for (let y = ROWS - 1; y >= 0; y--) {
                    if (!board[y][gridX]) {
                        return { x: gridX, y: y };
                    }
                }
                // If target column is full, search outward from it
                for (let offset = 1; offset < COLS; offset++) {
                    // Try left
                    const leftX = gridX - offset;
                    if (leftX >= 0) {
                        for (let y = ROWS - 1; y >= 0; y--) {
                            if (!board[y][leftX]) {
                                return { x: leftX, y: y };
                            }
                        }
                    }
                    // Try right
                    const rightX = gridX + offset;
                    if (rightX < COLS) {
                        for (let y = ROWS - 1; y >= 0; y--) {
                            if (!board[y][rightX]) {
                                return { x: rightX, y: y };
                            }
                        }
                    }
                }
                return null; // Board is completely full
            };
            
            // If below board, place it in an empty spot
            if (p.y >= ROWS * BLOCK_SIZE) {
                const spot = findAnyEmptySpot();
                if (spot) {
                    board[spot.y][spot.x] = volcanoLavaColor;
                    isRandomBlock[spot.y][spot.x] = false;
                    p.landed = true;
                    playSoundEffect('drop', soundToggle);
                }
                return false; // Remove projectile (landed or board full)
            }
            
            // SWEEP COLLISION: Check all grid cells between previous and current position
            // This prevents projectiles from passing through blocks when moving fast
            if (p.vy > 0 && gridX >= 0 && gridX < COLS) {
                const prevGridY = Math.floor(prevY / BLOCK_SIZE);
                const currGridY = Math.floor(p.y / BLOCK_SIZE);
                
                // Check each row the projectile passed through
                for (let checkY = Math.max(0, prevGridY); checkY <= Math.min(ROWS - 1, currGridY); checkY++) {
                    // Check if there's a block at this position
                    if (board[checkY] && board[checkY][gridX]) {
                        // Found a block - land on top of it (one row above)
                        const landY = checkY - 1;
                        if (landY >= 0 && !board[landY][gridX]) {
                            board[landY][gridX] = volcanoLavaColor;
                            isRandomBlock[landY][gridX] = false;
                            p.landed = true;
                            playSoundEffect('drop', soundToggle);
                            return false;
                        } else {
                            // Can't land there, find another spot
                            const spot = findAnyEmptySpot();
                            if (spot) {
                                board[spot.y][spot.x] = volcanoLavaColor;
                                isRandomBlock[spot.y][spot.x] = false;
                                p.landed = true;
                                playSoundEffect('drop', soundToggle);
                            }
                            return false;
                        }
                    }
                }
            }
            
            return true; // Keep projectile
        });
        
        // Eruption completes when all blocks have been ejected AND all projectiles have landed
        const allBlocksEjected = volcanoProjectilesSpawned >= volcanoTargetProjectiles;
        const allProjectilesLanded = volcanoProjectiles.length === 0;
        
        if (allBlocksEjected && allProjectilesLanded) {
            console.log('🌋 Volcano eruption complete, applying gravity');
            volcanoAnimating = false;
            volcanoActive = false;
            volcanoPhase = 'warming'; // Reset for next volcano
            // During replay, skip the next board sync
            if (GameReplay.isActive()) {
                GameReplay.setSkipNextSync(true);
                console.log('🎬 Will skip next board sync (volcano just finished)');
            }
            applyGravity();
        }
    }
}

function spawnLavaProjectile() {
    if (!volcanoLavaBlob || volcanoEruptionColumn < 0) return;
    if (volcanoLavaBlob.positions.length === 0) return;
    
    // Get the bottom-most block from the lava blob (already sorted bottom-first)
    const [blockX, blockY] = volcanoLavaBlob.positions[0];
    
    // Remove this block from the board
    if (board[blockY] && board[blockY][blockX]) {
        board[blockY][blockX] = null;
        isRandomBlock[blockY][blockX] = false;
        if (fadingBlocks[blockY]) fadingBlocks[blockY][blockX] = null;
    }
    
    // Remove from positions array
    volcanoLavaBlob.positions.shift();
    
    // Find the top of the remaining lava in the eruption column for spawn point
    const lavaInColumn = volcanoLavaBlob.positions.filter(([x, y]) => x === volcanoEruptionColumn);
    let spawnY;
    if (lavaInColumn.length > 0) {
        const topY = Math.min(...lavaInColumn.map(p => p[1]));
        spawnY = topY * BLOCK_SIZE;
    } else {
        // Use the removed block's position
        spawnY = blockY * BLOCK_SIZE;
    }
    
    // Spawn from top of lava blob (or the eruption column)
    const spawnX = volcanoEruptionColumn * BLOCK_SIZE + BLOCK_SIZE / 2;
    
    let direction, vx, vy;
    
    // During replay, use recorded projectile values
    const _replayProj = GameReplay.isActive() ? GameReplay.consumeLavaProjectile() : null;
    if (_replayProj) {
        vx = _replayProj.vx;
        vy = _replayProj.vy;
    } else {
        // Normal gameplay: generate random values
        // Determine horizontal direction based on which edge the volcano is against
        if (volcanoEdgeType.includes('left') && !volcanoEdgeType.includes('right')) {
            // Against left wall - shoot right only
            direction = 1;
        } else if (volcanoEdgeType.includes('right') && !volcanoEdgeType.includes('left')) {
            // Against right wall - shoot left only
            direction = -1;
        } else {
            // Against bottom only, or in a corner - random direction
            direction = Math.random() < 0.5 ? -1 : 1;
        }
        
        // Launch velocity - high arcing trajectories with lots of variation
        vx = direction * (0.5 + Math.random() * 2.5); // 0.5-3 pixels/frame horizontal (narrower arcs)
        vy = -(11 + Math.random() * 6); // -11 to -17 pixels/frame vertical (reduced from -16 to -26)
        
        // Record the projectile for replay
        if (typeof GameRecorder !== 'undefined' && GameRecorder.isActive()) {
            GameRecorder.recordLavaProjectile(vx, vy);
        }
    }
    
    volcanoProjectiles.push({
        x: spawnX,
        y: spawnY,
        vx: vx,
        vy: vy,
        gravity: 0.35, // Slightly higher gravity for nice arcs
        color: volcanoLavaColor,
        landed: false,
        slidingWall: null // null, 'left', or 'right' - when hitting a wall edge
    });
    
    console.log('🌋 Projectile spawned, remaining lava blocks:', volcanoLavaBlob.positions.length);
}

function drawVolcano() {
    if (!volcanoActive && !volcanoAnimating) return;
    
    ctx.save();
    
    if (volcanoPhase === 'warming') {
        // WARMING PHASE: Draw the lava blob vibrating and changing color
        if (!volcanoLavaBlob) return;
        
        // Interpolate between original color and lava color
        const progress = volcanoColorProgress;
        
        // Parse original color (assuming hex format #RRGGBB)
        let startColor = { r: 255, g: 100, b: 100 }; // Default reddish
        if (volcanoOriginalColor && volcanoOriginalColor.startsWith('#')) {
            const hex = volcanoOriginalColor.replace('#', '');
            // Use substring instead of deprecated substr
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            
            // Validate to prevent NaN
            if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                startColor = { r, g, b };
            }
        }
        
        // Parse lava color #FF4500
        const endColor = { r: 255, g: 69, b: 0 };
        
        // Interpolate with validation
        const currentR = Math.floor(startColor.r + (endColor.r - startColor.r) * progress);
        const currentG = Math.floor(startColor.g + (endColor.g - startColor.g) * progress);
        const currentB = Math.floor(startColor.b + (endColor.b - startColor.b) * progress);
        
        // Ensure no NaN values
        const validR = isNaN(currentR) ? 255 : Math.max(0, Math.min(255, currentR));
        const validG = isNaN(currentG) ? 100 : Math.max(0, Math.min(255, currentG));
        const validB = isNaN(currentB) ? 100 : Math.max(0, Math.min(255, currentB));
        
        // Convert to hex format (not rgb) so it works with adjustBrightness
        const currentColor = `#${validR.toString(16).padStart(2, '0')}${validG.toString(16).padStart(2, '0')}${validB.toString(16).padStart(2, '0')}`;

        
        // Apply vibration offset
        ctx.translate(volcanoVibrateOffset.x, volcanoVibrateOffset.y);
        
        // Draw the lava blob with gradually changing color
        const positions = volcanoLavaBlob.positions.map(([x, y]) => [x, y]);
        drawSolidShape(ctx, positions, currentColor, BLOCK_SIZE, false, getFaceOpacity(), false);
        
        // Add glow effect that intensifies as it heats up
        if (progress > 0.3) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = (progress - 0.3) * 0.6; // Fade in from 30% to 100%
            
            // Draw glowing halo around the blob
            positions.forEach(([x, y]) => {
                const gradient = ctx.createRadialGradient(
                    x * BLOCK_SIZE + BLOCK_SIZE / 2,
                    y * BLOCK_SIZE + BLOCK_SIZE / 2,
                    BLOCK_SIZE * 0.3,
                    x * BLOCK_SIZE + BLOCK_SIZE / 2,
                    y * BLOCK_SIZE + BLOCK_SIZE / 2,
                    BLOCK_SIZE * 1.2
                );
                gradient.addColorStop(0, currentColor);
                gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(
                    x * BLOCK_SIZE - BLOCK_SIZE * 0.2,
                    y * BLOCK_SIZE - BLOCK_SIZE * 0.2,
                    BLOCK_SIZE * 1.4,
                    BLOCK_SIZE * 1.4
                );
            });
            ctx.restore();
        }
        
        // Remove vibration translation
        ctx.translate(-volcanoVibrateOffset.x, -volcanoVibrateOffset.y);
        
    } else if (volcanoPhase === 'erupting') {
        // ERUPTING PHASE: Draw remaining lava blob and flying projectiles
        
        // Get current pulsing lava color
        const lavaColor = getLavaColor();
        
        // Draw remaining lava blob (deteriorating from bottom up)
        if (volcanoLavaBlob && volcanoLavaBlob.positions.length > 0) {
            const positions = volcanoLavaBlob.positions.map(([x, y]) => [x, y]);
            drawSolidShape(ctx, positions, lavaColor, BLOCK_SIZE, false, getFaceOpacity(), false);
            
            // Add glow effect
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.5;
            positions.forEach(([x, y]) => {
                const gradient = ctx.createRadialGradient(
                    x * BLOCK_SIZE + BLOCK_SIZE / 2,
                    y * BLOCK_SIZE + BLOCK_SIZE / 2,
                    BLOCK_SIZE * 0.3,
                    x * BLOCK_SIZE + BLOCK_SIZE / 2,
                    y * BLOCK_SIZE + BLOCK_SIZE / 2,
                    BLOCK_SIZE * 1.2
                );
                gradient.addColorStop(0, lavaColor);
                gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(
                    x * BLOCK_SIZE - BLOCK_SIZE * 0.2,
                    y * BLOCK_SIZE - BLOCK_SIZE * 0.2,
                    BLOCK_SIZE * 1.4,
                    BLOCK_SIZE * 1.4
                );
            });
            ctx.restore();
        }
        
        // Draw flying lava projectiles
        volcanoProjectiles.forEach(p => {
            const px = p.x - BLOCK_SIZE / 2;
            const py = p.y - BLOCK_SIZE / 2;
            
            // Trailing glow
            ctx.save();
            ctx.globalAlpha = 0.4;
            const gradient = ctx.createRadialGradient(
                p.x, p.y, 0,
                p.x, p.y, BLOCK_SIZE * 0.6
            );
            gradient.addColorStop(0, lavaColor);
            gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(px - BLOCK_SIZE * 0.2, py - BLOCK_SIZE * 0.2, BLOCK_SIZE * 1.4, BLOCK_SIZE * 1.4);
            ctx.restore();
            
            // Draw solid projectile
            ctx.globalAlpha = 1;
            ctx.fillStyle = lavaColor;
            ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
            
            // Bright center highlight (also pulse)
            const brightHex = lavaColor.replace('#', '');
            const r = Math.min(255, parseInt(brightHex.substring(0, 2), 16) + 40);
            const g = Math.min(255, parseInt(brightHex.substring(2, 4), 16) + 40);
            const b = Math.min(255, parseInt(brightHex.substring(4, 6), 16));
            const brightColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            
            ctx.fillStyle = brightColor;
            ctx.fillRect(px + BLOCK_SIZE * 0.25, py + BLOCK_SIZE * 0.25, BLOCK_SIZE * 0.5, BLOCK_SIZE * 0.5);
        });
    }
    
    ctx.restore();
}

function detectVolcanoes(blobs) {
    // Returns array of {lavaBlob, outerBlob, eruptionColumn, edgeType} where lavaBlob touches any edge and is enveloped
    const volcanoes = [];
    
    for (let i = 0; i < blobs.length; i++) {
        const inner = blobs[i];
        
        // Skip blobs that are already lava-colored (prevents chain reactions from landed lava)
        if (inner.color === volcanoLavaColor) continue;
        
        // Check if ANY block in the blob is touching an edge of the well
        const touchesBottom = inner.positions.some(([x, y]) => y === ROWS - 1);
        const touchesLeft = inner.positions.some(([x, y]) => x === 0);
        const touchesRight = inner.positions.some(([x, y]) => x === COLS - 1);
        const touchesEdge = touchesBottom || touchesLeft || touchesRight;
        
        if (!touchesEdge) continue; // Not touching any edge
        
        // Determine which edge(s) are touched for eruption direction
        let edgeType = '';
        if (touchesLeft) edgeType += 'left';
        if (touchesRight) edgeType += 'right';
        if (touchesBottom) edgeType += 'bottom';
        
        // Check if enveloped by another blob (with special volcano rules)
        for (let j = 0; j < blobs.length; j++) {
            if (i === j) continue;
            
            const outer = blobs[j];
            
            if (isBlobEnvelopedForVolcano(inner, outer, edgeType)) {
                // Found volcano! Choose random column from inner blob for eruption
                const innerColumns = [...new Set(inner.positions.map(p => p[0]))];
                const eruptionColumn = innerColumns[Math.floor(Math.random() * innerColumns.length)];
                
                volcanoes.push({
                    lavaBlob: inner,
                    outerBlob: outer,
                    eruptionColumn: eruptionColumn,
                    edgeType: edgeType
                });
                
                break; // One volcano per inner blob
            }
        }
    }
    
    return volcanoes;
}

function isBlobEnvelopedForVolcano(innerBlob, outerBlob, edgeType) {
    // Special envelopment check for volcano: allows specified edges to be well walls
    const outerSet = new Set(outerBlob.positions.map(p => `${p[0]},${p[1]}`));
    const innerSet = new Set(innerBlob.positions.map(p => `${p[0]},${p[1]}`));
    
    for (const [x, y] of innerBlob.positions) {
        const adjacents = [
            [x-1, y],   // left
            [x+1, y],   // right
            [x, y-1],   // top
            [x, y+1]    // bottom
        ];
        
        for (const [ax, ay] of adjacents) {
            const key = `${ax},${ay}`;
            
            // Special cases for volcano: edges touching well walls are allowed
            // Bottom edge touching well floor
            if (ay >= ROWS && edgeType.includes('bottom')) {
                continue; // Bottom edge touching well floor is allowed
            }
            
            // Left edge touching left wall
            if (ax < 0 && edgeType.includes('left')) {
                continue; // Left edge touching left wall is allowed
            }
            
            // Right edge touching right wall
            if (ax >= COLS && edgeType.includes('right')) {
                continue; // Right edge touching right wall is allowed
            }
            
            // If adjacent position is OUT OF BOUNDS and not an allowed edge, NOT enveloped
            if (ax < 0 || ax >= COLS || ay < 0 || ay >= ROWS) {
                return false;
            }
            
            // Adjacent is in bounds - check if it's part of outer or inner blob
            const isOuter = outerSet.has(key);
            const isInner = innerSet.has(key);
            
            // If it's neither outer nor inner, then inner is NOT enveloped
            if (!isOuter && !isInner) {
                return false;
            }
        }
    }
    
    // All adjacent cells (except allowed edges) are either outer blob or inner blob
    return true;
}

// ============================================
// END VOLCANO SYSTEM
// ============================================

function triggerTsunamiAnimation(blob) {
    tsunamiBlob = blob;
    tsunamiBlocks = [];
    
    // Find center Y and bounds of the blob
    const allY = blob.positions.map(p => p[1]);
    const centerY = (Math.min(...allY) + Math.max(...allY)) / 2;
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    
    // Store the original blob positions (integers)
    blob.positions.forEach(([x, y]) => {
        tsunamiBlocks.push({
            x: x,
            y: y,
            color: blob.color
        });
    });
    
    // Store blob info for animation
    tsunamiBlob.centerY = centerY;
    tsunamiBlob.minY = minY;
    tsunamiBlob.maxY = maxY;
    tsunamiBlob.originalHeight = maxY - minY + 1;
    
    // Find all blocks that need to be pushed up
    // A block needs to be pushed if there's ANY tsunami block below it in the same column
    // (because that tsunami block will expand upward and hit it)
    tsunamiPushedBlocks = [];
    
    // Create a set of tsunami positions for fast lookup
    const tsunamiPositions = new Set();
    blob.positions.forEach(([x, y]) => {
        tsunamiPositions.add(`${x},${y}`);
    });
    
    console.log('Tsunami color:', blob.color);
    console.log('Tsunami positions:', blob.positions.length, 'blocks');
    console.log('Analyzing which blocks need to be pushed (with interlocking detection)...');
    
    // Track which cells we've already processed for blob detection
    const processed = Array(ROWS).fill(null).map(() => Array(COLS).fill(false));
    
    // Mark tsunami blocks as processed so we don't include them
    blob.positions.forEach(([x, y]) => {
        processed[y][x] = true;
    });
    
    // Find connected sections - normal flood fill
    function findConnectedSection(startX, startY, color) {
        const section = [];
        const stack = [[startX, startY]];
        const visited = new Set();
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${x},${y}`;
            
            if (visited.has(key)) continue;
            visited.add(key);
            
            if (y < 0 || y >= ROWS || x < 0 || x >= COLS) continue;
            if (!board[y] || board[y][x] === null) continue;
            if (processed[y][x]) continue;
            if (board[y][x] !== color) continue;
            
            processed[y][x] = true;
            section.push({
                x: x,
                y: y,
                color: color,
                isRandom: isRandomBlock[y][x]
            });
            
            stack.push([x + 1, y]);
            stack.push([x - 1, y]);
            stack.push([x, y + 1]);
            stack.push([x, y - 1]);
        }
        
        return section;
    }
    
    // Helper: get tsunami height directly below a position
    // Returns 0 if there are any other blocks between this position and the tsunami
    function getTsunamiHeightBelow(x, y) {
        for (let checkY = y + 1; checkY < ROWS; checkY++) {
            // If we hit a non-tsunami block first, this position is NOT directly on tsunami
            if (board[checkY] && board[checkY][x] !== null && !tsunamiPositions.has(`${x},${checkY}`)) {
                return 0;
            }
            // If we hit tsunami, return the height
            if (tsunamiPositions.has(`${x},${checkY}`)) {
                return maxY - checkY + 1;
            }
        }
        return 0;
    }
    
    // STEP 1: Find all non-tsunami blobs
    console.log('=== Step 1: Finding all blobs ===');
    const allBlobs = [];
    let blobId = 0;
    
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y] && board[y][x] !== null && !processed[y][x]) {
                const section = findConnectedSection(x, y, board[y][x]);
                if (section.length > 0) {
                    allBlobs.push({
                        id: `blob_${blobId++}`,
                        color: section[0].color,
                        blocks: section,
                        positions: section.map(b => ({ x: b.x, y: b.y }))
                    });
                }
            }
        }
    }
    console.log(`  Found ${allBlobs.length} blobs`);
    
    // STEP 2: Detect interlocking blobs (same algorithm as gravity)
    console.log('=== Step 2: Detecting interlocking blobs ===');
    
    const parent = new Map();
    allBlobs.forEach(b => parent.set(b.id, b.id));
    
    function find(id) {
        if (parent.get(id) !== id) {
            parent.set(id, find(parent.get(id)));
        }
        return parent.get(id);
    }
    
    function union(id1, id2) {
        const root1 = find(id1);
        const root2 = find(id2);
        if (root1 !== root2) {
            parent.set(root1, root2);
            return true;
        }
        return false;
    }
    
    // Pre-compute column data for each blob
    const blobColumns = new Map();
    allBlobs.forEach(b => {
        const columns = new Map();
        b.positions.forEach(pos => {
            if (!columns.has(pos.x)) columns.set(pos.x, []);
            columns.get(pos.x).push(pos.y);
        });
        blobColumns.set(b.id, columns);
    });
    
    // Check all pairs of blobs for interlocking
    // For tsunami push, we only care about TRUE interlocking (one blob wraps around another)
    // Simple vertical stacking is handled by cascade detection, not interlocking
    for (let i = 0; i < allBlobs.length; i++) {
        const blobA = allBlobs[i];
        const columnsA = blobColumns.get(blobA.id);
        
        for (let j = i + 1; j < allBlobs.length; j++) {
            const blobB = allBlobs[j];
            const columnsB = blobColumns.get(blobB.id);
            
            let isInterlocked = false;
            
            for (let [colX, rowsA] of columnsA) {
                const rowsB = columnsB.get(colX);
                if (!rowsB || rowsB.length === 0) continue;
                
                const minYA = Math.min(...rowsA);
                const maxYA = Math.max(...rowsA);
                const minYB = Math.min(...rowsB);
                const maxYB = Math.max(...rowsB);
                
                // Only check for TRUE wrapping (one blob contains another in this column)
                // This catches the "S sitting inside a C" case
                if ((minYB < minYA && maxYB > maxYA) || (minYA < minYB && maxYA > maxYB)) {
                    isInterlocked = true;
                    console.log(`  🔗 True interlock: ${blobA.color} and ${blobB.color} wrap in col ${colX}`);
                    break;
                }
                
                // Also check if they actually OVERLAP (share rows), not just adjacent
                // overlap > 0 means they truly share vertical space
                const overlap = Math.min(maxYA, maxYB) - Math.max(minYA, minYB);
                if (overlap > 0) {
                    isInterlocked = true;
                    console.log(`  🔗 Overlap interlock: ${blobA.color} and ${blobB.color} overlap in col ${colX}`);
                    break;
                }
                // Note: overlap == 0 means touching, overlap == -1 means adjacent
                // Neither of these count as interlocking for tsunami push
            }
            
            if (isInterlocked) {
                union(blobA.id, blobB.id);
            }
        }
    }
    
    // Build blob groups from union-find
    const blobGroups = new Map();
    allBlobs.forEach(b => {
        const root = find(b.id);
        if (!blobGroups.has(root)) blobGroups.set(root, []);
        blobGroups.get(root).push(b);
    });
    
    console.log(`  Found ${blobGroups.size} blob groups (including singles)`);
    
    // STEP 3: Calculate push for each blob group
    console.log('=== Step 3: Calculating push distances ===');
    
    // Track push amount for each position (for cascading)
    const pushAmountAt = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    
    // Helper: get push amount of block directly below a position
    function getPushAmountBelow(x, y) {
        if (y + 1 < ROWS) {
            return pushAmountAt[y + 1][x];
        }
        return 0;
    }
    
    const groupsToPush = [];
    
    // PASS 1: Find groups directly on tsunami
    console.log('--- Pass 1: Groups directly on tsunami ---');
    const processedGroups = new Set();
    
    blobGroups.forEach((groupBlobs, groupId) => {
        // Calculate max push needed by any block in this entire group
        let maxPush = 0;
        
        groupBlobs.forEach(b => {
            b.blocks.forEach(block => {
                const push = getTsunamiHeightBelow(block.x, block.y);
                maxPush = Math.max(maxPush, push);
            });
        });
        
        if (maxPush > 0) {
            processedGroups.add(groupId);
            
            const allBlocks = [];
            groupBlobs.forEach(b => {
                b.blocks.forEach(block => {
                    pushAmountAt[block.y][block.x] = maxPush;
                    allBlocks.push(block);
                });
            });
            
            console.log(`  Group [${groupBlobs.map(b => b.color).join('+')}]: ${allBlocks.length} blocks, push=${maxPush}`);
            groupsToPush.push({ blocks: allBlocks, pushAmount: maxPush });
        }
    });
    
    // PASS 2+: Find groups sitting on pushed blocks (cascading)
    let pass = 2;
    let foundNew = true;
    
    while (foundNew) {
        foundNew = false;
        console.log(`--- Pass ${pass}: Cascading ---`);
        
        blobGroups.forEach((groupBlobs, groupId) => {
            if (processedGroups.has(groupId)) return;
            
            // Check if any block in this group sits on a pushed block
            let maxPush = 0;
            
            groupBlobs.forEach(b => {
                b.blocks.forEach(block => {
                    const tsunamiPush = getTsunamiHeightBelow(block.x, block.y);
                    const cascadePush = getPushAmountBelow(block.x, block.y);
                    maxPush = Math.max(maxPush, tsunamiPush, cascadePush);
                });
            });
            
            if (maxPush > 0) {
                processedGroups.add(groupId);
                
                const allBlocks = [];
                groupBlobs.forEach(b => {
                    b.blocks.forEach(block => {
                        pushAmountAt[block.y][block.x] = maxPush;
                        allBlocks.push(block);
                    });
                });
                
                console.log(`  Group [${groupBlobs.map(b => b.color).join('+')}]: ${allBlocks.length} blocks, push=${maxPush} (cascade)`);
                groupsToPush.push({ blocks: allBlocks, pushAmount: maxPush });
                foundNew = true;
            }
        });
        
        pass++;
        if (pass > 20) {
            console.warn('Tsunami cascade detection exceeded 20 passes, stopping');
            break;
        }
    }
    
    // RECONCILIATION PASS: Check if any pushed group is also sitting on another pushed group
    // with a larger push distance, and if so, inherit that larger distance
    console.log('=== Reconciliation: Checking for larger push distances from neighbors ===');
    let reconciliationChanged = true;
    let reconciliationPass = 0;
    
    while (reconciliationChanged && reconciliationPass < 20) {
        reconciliationChanged = false;
        reconciliationPass++;
        
        groupsToPush.forEach(group => {
            let maxNeighborPush = group.pushAmount;
            
            // Check if any block in this group sits directly on another pushed block
            group.blocks.forEach(block => {
                const pushBelow = getPushAmountBelow(block.x, block.y);
                if (pushBelow > maxNeighborPush) {
                    maxNeighborPush = pushBelow;
                }
            });
            
            if (maxNeighborPush > group.pushAmount) {
                console.log(`  Reconciliation: Group push ${group.pushAmount} -> ${maxNeighborPush}`);
                group.pushAmount = maxNeighborPush;
                
                // Update pushAmountAt for this group's blocks
                group.blocks.forEach(block => {
                    pushAmountAt[block.y][block.x] = maxNeighborPush;
                });
                
                reconciliationChanged = true;
            }
        });
    }
    
    if (reconciliationPass > 1) {
        console.log(`  Reconciliation completed in ${reconciliationPass} passes`);
    }
    
    // Now push all blocks from all groups
    groupsToPush.forEach(group => {
        group.blocks.forEach(block => {
            tsunamiPushedBlocks.push({
                ...block,
                tsunamiHeightBelow: group.pushAmount
            });
            // Remove from board temporarily
            board[block.y][block.x] = null;
            isRandomBlock[block.y][block.x] = false;
        });
    });
    
    console.log(`Total groups to push: ${groupsToPush.length}`);
    console.log(`Total blocks to push: ${tsunamiPushedBlocks.length}`);
    
    // Remove tsunami blocks from board immediately (we'll animate them)
    blob.positions.forEach(([x, y]) => {
        board[y][x] = null;
        isRandomBlock[y][x] = false;
        fadingBlocks[y][x] = null;
    });
    
    tsunamiActive = true;
    tsunamiAnimating = true;
    tsunamiStartTime = Date.now();
    tsunamiWobbleIntensity = 6; // pixels of vertical wobble
    tsunamiDuration = 2083; // Longer duration for surge + collapse (120% speed)
    
    // Reset AI to prevent it from using stale board state calculations
    if (typeof AIPlayer !== 'undefined') {
        AIPlayer.reset();
    }
    
    // Visual effects
    canvas.classList.add('tsunami-active');
    playSoundEffect('gold', soundToggle);
    const avgY = blob.positions.reduce((s, p) => s + p[1], 0) / blob.positions.length;
    triggerTsunami(avgY * BLOCK_SIZE);
    
    // Start controller haptic feedback (wave pattern)
    GamepadController.startTsunamiRumble();
}

function updateTsunamiAnimation() {
    if (!tsunamiAnimating) return;
    
    const elapsed = Date.now() - tsunamiStartTime;
    const progress = Math.min(elapsed / tsunamiDuration, 1);
    
    // Wobble intensity decreases over time
    tsunamiWobbleIntensity = 6 * (1 - progress * 0.5);
    
    // Two phases: surge (0-0.4) and collapse (0.4-1.0)
    const surgePhaseEnd = 0.4;
    
    if (progress <= surgePhaseEnd) {
        // SURGE PHASE: expand upward to 1.667x height (2/3 of original expansion)
        const surgeProgress = progress / surgePhaseEnd; // 0 to 1
        const easeProgress = 1 - Math.pow(1 - surgeProgress, 2); // Ease out quad
        tsunamiBlob.currentScale = 1 + easeProgress * 0.667; // 1.0 to 1.667
        
        // Calculate push distance for blocks above
        // Blocks need to be pushed by exactly the expansion amount
        const maxPush = tsunamiBlob.originalHeight * BLOCK_SIZE * 0.667;
        tsunamiBlob.pushDistance = easeProgress * maxPush;
        
        if (Math.random() < 0.01) { // Log occasionally to avoid spam
            console.log(`Surge: scale=${tsunamiBlob.currentScale.toFixed(2)}, pushDistance=${tsunamiBlob.pushDistance.toFixed(1)}px (${(tsunamiBlob.pushDistance/BLOCK_SIZE).toFixed(1)} blocks)`);
        }
    } else {
        // COLLAPSE PHASE: shrink downward from top to bottom (scale down from bottom anchor)
        const collapseProgress = (progress - surgePhaseEnd) / (1 - surgePhaseEnd); // 0 to 1
        const easeProgress = Math.pow(collapseProgress, 2); // Ease in quad
        tsunamiBlob.currentScale = 1.667 - easeProgress * 1.667; // 1.667 to 0.0
        
        // Blocks fall back smoothly as tsunami collapses
        const maxPush = tsunamiBlob.originalHeight * BLOCK_SIZE * 0.667;
        tsunamiBlob.pushDistance = maxPush * (1 - easeProgress);
    }
    
    // Animation complete
    if (progress >= 1) {
        tsunamiAnimating = false;
        tsunamiActive = false;
        tsunamiWobbleIntensity = 0;
        canvas.classList.remove('tsunami-active');
        
        // Stop controller haptic feedback (should already be stopped, but ensure cleanup)
        GamepadController.stopVibration();
        
        // During replay, skip the next board sync
        if (GameReplay.isActive()) {
            GameReplay.setSkipNextSync(true);
            console.log('🎬 Will skip next board sync (tsunami just finished)');
        }
        
        // Put pushed blocks back on board at their original positions
        // They will then fall naturally with gravity (potentially reconnecting with other blocks)
        console.log('=== TSUNAMI COMPLETE - PLACING BLOCKS BACK ===');
        let placedCount = 0;
        let skippedCount = 0;
        
        tsunamiPushedBlocks.forEach(block => {
            // Place block back at its original position
            if (block.y >= 0 && block.y < ROWS && board[block.y] && board[block.y][block.x] === null) {
                board[block.y][block.x] = block.color;
                isRandomBlock[block.y][block.x] = block.isRandom || false;
                placedCount++;
                console.log(`  Placed block at (${block.x}, ${block.y}), color: ${block.color}`);
            } else {
                skippedCount++;
                console.log(`  SKIPPED block at (${block.x}, ${block.y}) - position occupied or invalid`);
            }
        });
        
        console.log(`Placed ${placedCount} blocks, skipped ${skippedCount} blocks`);
        
        // Clear tsunami data AFTER placing blocks to avoid flicker
        tsunamiPushedBlocks = [];
        tsunamiBlob = null;
        tsunamiBlocks = [];
        
        // Apply multi-pass gravity to let everything settle
        // This will cause the pushed blocks to fall properly through multiple passes
        applyGravity();
        // Note: checkForSpecialFormations will be called after gravity animation completes
    }
}

function drawTsunami() {
    if (!tsunamiActive || !tsunamiAnimating || !tsunamiBlob) return;
    
    const elapsed = Date.now() - tsunamiStartTime;
    const progress = Math.min(elapsed / tsunamiDuration, 1);
    
    const currentScale = tsunamiBlob.currentScale || 1;
    const pushDistance = tsunamiBlob.pushDistance || 0;
    
    ctx.save();
    
    // Draw pushed blocks as connected sections
    // Group blocks by color to draw connected sections together
    ctx.globalAlpha = 1;
    
    // Group pushed blocks by color
    const blocksByColor = {};
    tsunamiPushedBlocks.forEach(block => {
        if (!blocksByColor[block.color]) {
            blocksByColor[block.color] = [];
        }
        blocksByColor[block.color].push(block);
    });
    
    // Draw each color group as potentially multiple connected sections
    Object.entries(blocksByColor).forEach(([color, blocks]) => {
        // For each color, group by push amount, then find connected components within each push group
        const byPushAmount = {};
        blocks.forEach(block => {
            const key = block.tsunamiHeightBelow || 0;
            if (!byPushAmount[key]) {
                byPushAmount[key] = [];
            }
            byPushAmount[key].push(block);
        });
        
        // For each push-amount group, find connected components and draw each separately
        Object.entries(byPushAmount).forEach(([pushAmount, groupBlocks]) => {
            const visited = new Set();
            
            groupBlocks.forEach(startBlock => {
                const key = `${startBlock.x},${startBlock.y}`;
                if (visited.has(key)) return;
                
                // Find all blocks connected to this one via flood fill
                const connectedSection = [];
                const stack = [startBlock];
                
                while (stack.length > 0) {
                    const block = stack.pop();
                    const blockKey = `${block.x},${block.y}`;
                    
                    if (visited.has(blockKey)) continue;
                    visited.add(blockKey);
                    connectedSection.push(block);
                    
                    // Find adjacent blocks in the same push group
                    groupBlocks.forEach(other => {
                        const otherKey = `${other.x},${other.y}`;
                        if (visited.has(otherKey)) return;
                        
                        const dx = Math.abs(other.x - block.x);
                        const dy = Math.abs(other.y - block.y);
                        
                        if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
                            stack.push(other);
                        }
                    });
                }
                
                // Draw this connected section (normal rendering, not gold)
                if (connectedSection.length > 0) {
                    const positions = connectedSection.map(block => {
                        const individualPush = (block.tsunamiHeightBelow || 0) * BLOCK_SIZE;
                        const progressMultiplier = pushDistance / (tsunamiBlob.originalHeight * BLOCK_SIZE);
                        // Add 10% safety margin to ensure blocks stay above tsunami
                        const adjustedPush = individualPush * progressMultiplier * 1.1;
                        const pushedY = block.y - adjustedPush / BLOCK_SIZE;
                        return [block.x, pushedY];
                    });
                    
                    drawSolidShape(ctx, positions, color, BLOCK_SIZE, false, getFaceOpacity());
                }
            });
        });
    });
    
    // Calculate the anchor point (BOTTOM of blob - surge upward from bottom)
    const bottomPixelY = tsunamiBlob.maxY * BLOCK_SIZE + BLOCK_SIZE; // Bottom edge of blob
    
    // Apply transform to scale upward from bottom
    ctx.translate(0, bottomPixelY);
    ctx.scale(1, currentScale);
    ctx.translate(0, -bottomPixelY);
    
    // Fade during collapse phase only (after 40% progress)
    const surgePhaseEnd = 0.4;
    if (progress > surgePhaseEnd) {
        const collapseProgress = (progress - surgePhaseEnd) / (1 - surgePhaseEnd);
        const alpha = 1 - collapseProgress * 0.7;
        ctx.globalAlpha = Math.max(0.3, alpha);
    } else {
        ctx.globalAlpha = 1;
    }
    
    // Draw tsunami blob as a solid shape with gold edges
    const positions = tsunamiBlocks.map(block => [block.x, block.y]);
    drawSolidShape(ctx, positions, tsunamiBlob.color, BLOCK_SIZE, true, getFaceOpacity());
    
    ctx.restore();
    
    // Add trailing particles during collapse
    if (Math.random() < 0.2 && progress > surgePhaseEnd) {
        const randomBlock = tsunamiBlocks[Math.floor(Math.random() * tsunamiBlocks.length)];
        if (randomBlock) {
            const px = randomBlock.x * BLOCK_SIZE;
            const py = randomBlock.y * BLOCK_SIZE;
            const bottomPixelY = tsunamiBlob.maxY * BLOCK_SIZE + BLOCK_SIZE;
            const transformedY = bottomPixelY + (py + BLOCK_SIZE / 2 - bottomPixelY) * currentScale;
            
            disintegrationParticles.push({
                x: px + BLOCK_SIZE / 2 + (Math.random() - 0.5) * BLOCK_SIZE,
                y: transformedY,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 2,
                size: 2 + Math.random() * 3,
                color: tsunamiBlob.color,
                opacity: 0.6,
                life: 0.6,
                decay: 0.04,
                gravity: 0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3
            });
        }
    }
}

function spawnTornado() {
    if (tornadoActive || !gameRunning || paused) return;
    
    // During normal play (not replay), also check for earthquake and grace period
    if (!GameReplay.isActive()) {
        if (earthquakeActive) {
            console.log('🌪️ Tornado blocked - earthquake in progress');
            return;
        }
        if (weatherEventGracePeriod > 0) {
            console.log('🌪️ Tornado blocked - grace period active:', weatherEventGracePeriod, 'lines remaining');
            return;
        }
    }
    
    tornadoActive = true;
    tornadoY = 0;
    tornadoSpeed = 8; // Ensure consistent speed for recording and replay
    tornadoRotation = 0;
    tornadoState = 'descending';
    tornadoPickedBlob = null;
    tornadoParticles = [];
    tornadoDropTargetX = 0;
    tornadoBlobRotation = 0;
    tornadoVerticalRotation = 0;
    tornadoSnakeVelocity = 0;
    tornadoOrbitStartTime = null;
    tornadoOrbitRadius = 0;
    tornadoOrbitAngle = 0;
    tornadoLiftHeight = 0;
    tornadoDropStartY = 0;
    tornadoDropVelocity = 0;
    tornadoFinalPositions = null;
    tornadoFinalCenterX = null;
    tornadoFinalCenterY = null;
    tornadoFadeProgress = 0;
    
    // During replay (v2.0), use recorded values
    const _replayTornadoSpawn = GameReplay.isActive() ? GameReplay.consumeTornadoSpawnData() : null;
    if (_replayTornadoSpawn) {
        tornadoX = _replayTornadoSpawn.x;
        tornadoSnakeDirection = _replayTornadoSpawn.snakeDirection;
        tornadoSnakeChangeCounter = _replayTornadoSpawn.snakeChangeCounter;
    } else if (!GameReplay.isActive()) {
        // Not replaying - generate random values and record
        tornadoX = (Math.random() * (COLS - 2) + 1) * BLOCK_SIZE + BLOCK_SIZE / 2;
        tornadoSnakeDirection = Math.random() < 0.5 ? 1 : -1;
        tornadoSnakeChangeCounter = Math.floor(Math.random() * 30 + 20);
        
        // Record tornado spawn for playback
        if (window.GameRecorder && window.GameRecorder.isActive()) {
            window.GameRecorder.recordTornadoSpawn(tornadoX, tornadoSnakeDirection, tornadoSnakeChangeCounter);
        }
    }
    
    // Create initial swirling particles
    for (let i = 0; i < 50; i++) {
        const angle = (i / 50) * Math.PI * 2;
        const radius = 20 + Math.random() * 30;
        tornadoParticles.push({
            angle: angle,
            radius: radius,
            speed: 0.1 + Math.random() * 0.1,
            opacity: 0.3 + Math.random() * 0.4
        });
    }
    
    startTornadoWind(soundToggle); // Start continuous wind sound
    console.log('🌪️ Tornado spawned!');
}

// Calculate drop interval based on number of lines cleared
function calculateDropInterval(linesCleared) {
    if (aiModeEnabled) {
        // AI mode: no floor - let game loop speed be the limit
        // Formula goes negative around 124 lines, Math.max(0,...) keeps it non-negative
        return Math.max(0, 1000 - (linesCleared * 8.1));
    }
    // Human mode: standard progression, 10ms floor (was 20ms)
    return Math.max(10, 1000 - (linesCleared * 8.1));
}

// Calculate effective lock delay based on lines cleared
// Starts at 500ms, begins decaying after speed maxes out (~122 lines), bottoms at 100ms
function calculateLockDelayTime(linesCleared) {
    const SPEED_MAX_LINES = 122; // Lines where drop speed hits minimum (1000 - 122*8.1 ≈ 10ms)
    const LOCK_DECAY_RANGE = 80; // Lines over which lock delay decays to minimum
    
    if (linesCleared <= SPEED_MAX_LINES) {
        return BASE_LOCK_DELAY_TIME;
    }
    
    // Linear decay from BASE to MIN over LOCK_DECAY_RANGE lines after speed maxes
    const linesOverMax = linesCleared - SPEED_MAX_LINES;
    const decayProgress = Math.min(1, linesOverMax / LOCK_DECAY_RANGE);
    const lockDelay = BASE_LOCK_DELAY_TIME - (BASE_LOCK_DELAY_TIME - MIN_LOCK_DELAY_TIME) * decayProgress;
    
    return Math.max(MIN_LOCK_DELAY_TIME, lockDelay);
}

// Calculate the maximum time for a piece to drop from top to bottom naturally
function calculateMaxDropTime() {
    // Time = number of rows × current drop interval
    return ROWS * dropInterval;
}

// Calculate speed bonus for a piece based on how quickly it was placed
// Returns value between 0.0 (piece reached bottom naturally) and 2.0 (instant placement)
function calculatePieceSpeedBonus(placementTime) {
    if (pieceSpawnTime === 0) return 1.0; // Fallback if spawn time wasn't set
    
    const elapsedTime = placementTime - pieceSpawnTime;
    const maxDropTime = calculateMaxDropTime();
    
    // Linear interpolation: 2.0 at 0 time, 0.0 at maxDropTime
    const bonus = Math.max(0, 2.0 - (2.0 * elapsedTime / maxDropTime));
    return bonus;
}

// Record speed bonus for a placed piece and update running average
function recordPieceSpeedBonus(bonus) {
    speedBonusTotal += bonus;
    speedBonusPieceCount++;
    speedBonusAverage = speedBonusTotal / speedBonusPieceCount;
}

// Developer mode function: Advance to next planet
function advanceToNextPlanet() {
    console.log('advanceToNextPlanet called, gameRunning:', gameRunning, 'paused:', paused);
    if (!gameRunning || paused) return;
    
    const planets = StarfieldSystem.getPlanets();
    console.log('Current level:', level, 'Planets:', planets);
    
    // Find the next planet level
    const currentPlanet = planets.find(p => p.level === level);
    const nextPlanet = planets.find(p => p.level > level);
    
    console.log('Current planet:', currentPlanet, 'Next planet:', nextPlanet);
    
    if (nextPlanet) {
        // Advance to next planet's level
        level = nextPlanet.level;
        currentGameLevel = level; StarfieldSystem.setCurrentGameLevel(level);
        lines = (level - 1) * 11; // Update lines to match level
        dropInterval = calculateDropInterval(lines);
        updateStats();
        console.log(`🪐 Advanced to ${nextPlanet.name} (Level ${level})`);
    } else {
        console.log('Already at the last planet!');
    }
}

// Earthquake effect
function spawnEarthquake() {
    if (earthquakeActive || !gameRunning || paused) return;
    
    // During normal play (not replay), also check for tornado and grace period
    if (!GameReplay.isActive()) {
        if (tornadoActive) {
            console.log('🌍 Earthquake blocked - tornado in progress');
            return;
        }
        if (weatherEventGracePeriod > 0) {
            console.log('🌍 Earthquake blocked - grace period active:', weatherEventGracePeriod, 'lines remaining');
            return;
        }
    }
    
    // Check if there's enough of a stack (tallest block must be above row 15, i.e., row 0-15)
    let tallestRow = ROWS;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] !== null) {
                tallestRow = Math.min(tallestRow, y);
                break;
            }
        }
        if (tallestRow < ROWS) break;
    }
    
    // If tallest block is in bottom 4 rows (rows 16-19), don't trigger
    if (tallestRow >= ROWS - 4) {
        console.log('🚫 Not enough stack height for earthquake (tallest row:', tallestRow, ')');
        return;
    }
    
    console.log('🌍 Earthquake triggered! Tallest row:', tallestRow);
    earthquakeActive = true;
    earthquakePhase = 'shake'; // Start with shaking, crack appears after delay
    earthquakeShakeProgress = 0;
    earthquakeShakeIntensity = 6; // Horizontal shaking intensity
    earthquakeCrack = [];
    earthquakeCrackMap.clear();
    earthquakeCrackProgress = 0;
    earthquakeShiftProgress = 0;
    earthquakeLeftBlocks = [];
    earthquakeRightBlocks = [];
    
    // Pre-generate crack and shift type at spawn time (for deterministic replay)
    // generateEarthquakeCrack() handles replay by using recorded data if available
    generateEarthquakeCrack();
    
    if (GameReplay.isActive()) {
        // During replay, use recorded shift type
        const _replayShift = GameReplay.consumeEarthquakeShiftType();
        if (_replayShift) {
            earthquakeShiftType = _replayShift;
            console.log('🌍 Earthquake shift type from recording:', earthquakeShiftType);
        }
    } else {
        // Not replaying - generate random shift type
        const rand = Math.random();
        if (rand < 0.333) {
            earthquakeShiftType = 'both';
        } else if (rand < 0.666) {
            earthquakeShiftType = 'left';
        } else {
            earthquakeShiftType = 'right';
        }
        console.log('🌍 Pre-generated shift type:', earthquakeShiftType);
        
        // Record earthquake at spawn time with all data
        if (window.GameRecorder && window.GameRecorder.isActive()) {
            window.GameRecorder.recordEarthquake(earthquakeCrack, earthquakeShiftType);
        }
    }
    
    // Play continuous rumble sound to indicate earthquake starting
    playEarthquakeRumble(soundToggle);
    
    // Start controller haptic feedback
    GamepadController.startEarthquakeRumble();
}

function updateTornado() {
    if (!tornadoActive) return;
    
    tornadoRotation += 0.2; // Spin the tornado
    
    // Update particle positions (spiral)
    tornadoParticles.forEach(p => {
        p.angle += p.speed;
    });
    
    if (tornadoState === 'descending') {
        tornadoY += tornadoSpeed;
        
        // Subtle random snaking - more natural drift
        tornadoSnakeChangeCounter--;
        
        if (tornadoSnakeChangeCounter <= 0) {
            // During replay, use recorded values; otherwise generate random
            const _replayDir = GameReplay.isActive() ? GameReplay.consumeTornadoDirChange() : null;
            if (_replayDir) {
                tornadoSnakeDirection = _replayDir.newDirection;
                tornadoSnakeChangeCounter = _replayDir.newCounter;
            } else {
                // Randomly change direction
                if (Math.random() < 0.3) {
                    tornadoSnakeDirection *= -1;
                }
                tornadoSnakeChangeCounter = Math.floor(Math.random() * 30 + 20);
                
                // Record direction change for playback
                if (window.GameRecorder && window.GameRecorder.isActive()) {
                    window.GameRecorder.recordTornadoDirection(tornadoSnakeDirection, tornadoSnakeChangeCounter);
                }
            }
        }
        
        // Gradually accelerate/decelerate in current direction
        const maxSpeed = 1.5; // Much more subtle max speed
        tornadoSnakeVelocity += tornadoSnakeDirection * 0.05;
        tornadoSnakeVelocity = Math.max(-maxSpeed, Math.min(maxSpeed, tornadoSnakeVelocity));
        
        // Apply velocity with some damping
        tornadoX += tornadoSnakeVelocity;
        tornadoSnakeVelocity *= 0.98; // Gentle damping
        
        // Soft bounce off walls instead of hard clamp
        if (tornadoX < BLOCK_SIZE * 1.5) {
            tornadoSnakeDirection = 1;
            tornadoSnakeVelocity = 0.5;
        } else if (tornadoX > canvas.width - BLOCK_SIZE * 1.5) {
            tornadoSnakeDirection = -1;
            tornadoSnakeVelocity = -0.5;
        }
        
        // Keep within bounds
        tornadoX = Math.max(BLOCK_SIZE, Math.min(canvas.width - BLOCK_SIZE, tornadoX));
        
        // Check if tornado touched a blob or bottom
        const tornadoRow = Math.floor(tornadoY / BLOCK_SIZE);
        const tornadoCol = Math.floor(tornadoX / BLOCK_SIZE);
        
        // Check if hit bottom
        if (tornadoRow >= ROWS) {
            // Touched bottom - TOUCHDOWN BONUS!
            score *= 2;
            updateStats();
            canvas.classList.add('touchdown-active');
            playSoundEffect('gold', soundToggle);
            GamepadController.vibrateTornadoImpact(false); // Touchdown celebration
            setTimeout(() => canvas.classList.remove('touchdown-active'), 1000);
            tornadoActive = false;
            weatherEventGracePeriod = WEATHER_GRACE_LINES; // Start grace period
            // During replay, skip the next board sync
            if (GameReplay.isActive()) {
                GameReplay.setSkipNextSync(true);
                console.log('🎬 Will skip next board sync (tornado touchdown just finished)');
            }
            stopTornadoWind(); // Stop the wind sound
            return;
        }
        
        // Check if hit a blob
        if (tornadoRow >= 0 && tornadoRow < ROWS && tornadoCol >= 0 && tornadoCol < COLS) {
            const cell = board[tornadoRow][tornadoCol];
            if (cell !== null) {
                // Hit a blob! Find the full blob
                const blobs = getAllBlobs();
                const hitBlob = blobs.find(b => 
                    b.positions.some(([x, y]) => x === tornadoCol && y === tornadoRow)
                );
                
                if (hitBlob) {
                    // Check if blob can be lifted (not locked by other blobs)
                    if (canLiftBlob(hitBlob)) {
                        // Pick it up!
                        tornadoPickedBlob = {
                            color: hitBlob.color,
                            positions: hitBlob.positions.map(([x, y]) => [x, y]) // Clone positions
                        };
                        tornadoLiftStartY = tornadoY;
                        tornadoBlobRotation = 0;
                        tornadoVerticalRotation = 0;
                        tornadoDropStartY = 0;
                        
                        // Remove blob from board
                        hitBlob.positions.forEach(([x, y]) => {
                            board[y][x] = null;
                            isRandomBlock[y][x] = false;
                            fadingBlocks[y][x] = null;
                        });
                        
                        tornadoState = 'lifting';
                        playSoundEffect('rotate', soundToggle); // Pickup sound
                    } else {
                        // Disintegrate it (no points) - create explosion!
                        createDisintegrationExplosion(hitBlob);
                        GamepadController.vibrateTornadoImpact(true); // Destruction impact
                        
                        hitBlob.positions.forEach(([x, y]) => {
                            board[y][x] = null;
                            isRandomBlock[y][x] = false;
                            fadingBlocks[y][x] = null;
                        });
                        playSmallExplosion(soundToggle); // Explosion sound for destroyed blob
                        
                        // Apply gravity after removing the blob
                        applyGravity();
                        
                        tornadoState = 'dissipating';
                        tornadoFadeProgress = 0;
                    }
                }
            }
        }
    } else if (tornadoState === 'lifting') {
        // Blob climbs up the tornado while orbiting around it
        
        // Initialize orbit tracking
        if (!tornadoOrbitStartTime) {
            tornadoOrbitStartTime = Date.now();
            tornadoOrbitRadius = 30; // Start close
            tornadoLiftHeight = tornadoY; // Start at pickup point
            tornadoVerticalRotation = 0;
            tornadoOrbitAngle = 0;
        }
        
        const orbitTime = Date.now() - tornadoOrbitStartTime;
        const orbitDuration = 3000; // 3 seconds to climb and orbit
        const liftProgress = Math.min(orbitTime / orbitDuration, 1.0);
        
        // Blob climbs up the tornado from pickup point to top
        const targetHeight = canvas.height * 0.25; // Climb to 1/4 from top
        tornadoLiftHeight = tornadoY - (tornadoY - targetHeight) * liftProgress;
        
        // Gradually expand orbit radius as it climbs
        tornadoOrbitRadius = 30 + liftProgress * 40;
        
        // Smooth incremental orbit rotation
        tornadoOrbitAngle += 0.08;
        
        // Spin the blob as it orbits
        tornadoBlobRotation += 0.12;
        tornadoVerticalRotation += 0.08; // Spin around vertical axis too
        
        if (liftProgress >= 1.0) {
            // Reached top - fling free!
            tornadoState = 'carrying';
            
            // During replay, use recorded drop target; otherwise generate random
            const _replayDrop = GameReplay.isActive() ? GameReplay.consumeTornadoDrop() : null;
            if (_replayDrop) {
                tornadoDropTargetX = _replayDrop.targetX;
            } else {
                // Pick random drop column INSIDE the well
                const blobWidth = Math.max(...tornadoPickedBlob.positions.map(p => p[0])) - 
                                 Math.min(...tornadoPickedBlob.positions.map(p => p[0])) + 1;
                const maxDropCol = COLS - blobWidth;
                tornadoDropTargetX = Math.floor(Math.random() * maxDropCol + blobWidth / 2) * BLOCK_SIZE + BLOCK_SIZE / 2;
                
                // Record drop target for playback
                if (window.GameRecorder && window.GameRecorder.isActive()) {
                    window.GameRecorder.recordTornadoDrop(tornadoDropTargetX);
                }
            }
            tornadoOrbitStartTime = Date.now();
        }
    } else if (tornadoState === 'carrying') {
        // Blob flung free - moves to drop target while still orbiting (but orbit fades out)
        const dx = tornadoDropTargetX - tornadoX;
        tornadoBlobRotation += 0.12;
        tornadoVerticalRotation += 0.08;
        
        // Continue orbiting but fade it out
        if (!tornadoOrbitStartTime) tornadoOrbitStartTime = Date.now();
        const carryTime = Date.now() - tornadoOrbitStartTime;
        
        // Smooth incremental orbit, gradually slowing
        tornadoOrbitAngle += 0.08 * (tornadoOrbitRadius / 70);
        
        // Gradually reduce orbit radius (blob breaking free)
        tornadoOrbitRadius = Math.max(0, 70 - carryTime / 20);
        
        if (Math.abs(dx) > 5) {
            tornadoX += Math.sign(dx) * 5;
        } else {
            tornadoX = tornadoDropTargetX;
            tornadoState = 'dropping';
            tornadoOrbitRadius = 0; // Fully broken free
            tornadoDropStartY = tornadoLiftHeight; // Start falling from lift height
            tornadoDropVelocity = 0; // Reset velocity for gravity
            tornadoFinalPositions = null; // Will be calculated on first dropping update
        }
    } else if (tornadoState === 'dropping') {
        // Blob breaks free from orbit and falls with gravity
        
        // Pre-calculate exact final positions at start of drop (once only)
        // This ensures animation matches actual placement
        if (tornadoPickedBlob && !tornadoFinalPositions) {
            const dropCol = Math.floor(tornadoX / BLOCK_SIZE);
            const minX = Math.min(...tornadoPickedBlob.positions.map(p => p[0]));
            const maxX = Math.max(...tornadoPickedBlob.positions.map(p => p[0]));
            const maxY = Math.max(...tornadoPickedBlob.positions.map(p => p[1]));
            
            // Calculate offset same as dropBlobAt
            const blobCenterX = Math.floor((minX + maxX) / 2);
            let offsetX = dropCol - blobCenterX;
            
            // Clamp to ensure blob stays within bounds
            if (minX + offsetX < 0) {
                offsetX = -minX;
            }
            if (maxX + offsetX >= COLS) {
                offsetX = COLS - 1 - maxX;
            }
            
            // Build a set of positions occupied by the current falling piece
            const currentPiecePositions = new Set();
            if (currentPiece && currentPiece.shape) {
                for (let py = 0; py < currentPiece.shape.length; py++) {
                    for (let px = 0; px < currentPiece.shape[py].length; px++) {
                        if (currentPiece.shape[py][px]) {
                            const pieceX = currentPiece.x + px;
                            const pieceY = currentPiece.y + py;
                            currentPiecePositions.add(`${pieceX},${pieceY}`);
                        }
                    }
                }
            }
            
            // Find lowest valid Y position (check both board AND current piece)
            let finalY = ROWS - 1;
            for (let testY = ROWS - 1; testY >= 0; testY--) {
                let canPlace = true;
                for (const [bx, by] of tornadoPickedBlob.positions) {
                    const newX = bx + offsetX;
                    const newY = testY - (maxY - by);
                    
                    if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) {
                        canPlace = false;
                        break;
                    }
                    // Check collision with existing blocks on board
                    if (board[newY][newX] !== null) {
                        canPlace = false;
                        break;
                    }
                    // Check collision with current falling piece
                    if (currentPiecePositions.has(`${newX},${newY}`)) {
                        canPlace = false;
                        break;
                    }
                }
                if (canPlace) {
                    finalY = testY;
                    break;
                }
            }
            
            // Store final positions for each block
            tornadoFinalPositions = tornadoPickedBlob.positions.map(([bx, by]) => ({
                x: bx + offsetX,
                y: finalY - (maxY - by)
            }));
            
            // Calculate the center of final positions in pixels for animation target
            const finalMinX = Math.min(...tornadoFinalPositions.map(p => p.x));
            const finalMaxX = Math.max(...tornadoFinalPositions.map(p => p.x));
            const finalMinY = Math.min(...tornadoFinalPositions.map(p => p.y));
            const finalMaxY = Math.max(...tornadoFinalPositions.map(p => p.y));
            
            tornadoFinalCenterX = ((finalMinX + finalMaxX) / 2 + 0.5) * BLOCK_SIZE;
            tornadoFinalCenterY = ((finalMinY + finalMaxY) / 2 + 0.5) * BLOCK_SIZE;
            
            // Snap X to final position immediately (blob falls straight down)
            tornadoX = tornadoFinalCenterX;
        }
        
        // Fall with acceleration (gravity)
        tornadoDropVelocity += 0.5;
        tornadoDropStartY += tornadoDropVelocity;
        
        // Gradually slow rotation as it falls
        tornadoBlobRotation += Math.max(0.02, 0.15 - tornadoDropVelocity * 0.005);
        tornadoVerticalRotation += Math.max(0.01, 0.1 - tornadoDropVelocity * 0.003);
        
        // Reset orbit tracking
        tornadoOrbitAngle = 0;
        tornadoOrbitRadius = 0;
        
        // Check if blob should land
        if (tornadoPickedBlob && tornadoFinalPositions && tornadoFinalCenterY) {
            if (tornadoDropStartY >= tornadoFinalCenterY) {
                // ALWAYS recalculate final positions at landing time
                // This handles cases where lines were cleared during the drop animation
                console.log('🌪️ Recalculating final positions at landing time...');
                
                const maxY = Math.max(...tornadoPickedBlob.positions.map(p => p[1]));
                const minX = Math.min(...tornadoPickedBlob.positions.map(p => p[0]));
                const maxX = Math.max(...tornadoPickedBlob.positions.map(p => p[0]));
                const blobCenterX = Math.floor((minX + maxX) / 2);
                const dropCol = Math.floor(tornadoX / BLOCK_SIZE);
                let offsetX = dropCol - blobCenterX;
                
                if (minX + offsetX < 0) offsetX = -minX;
                if (maxX + offsetX >= COLS) offsetX = COLS - 1 - maxX;
                
                // Build a set of positions occupied by the current falling piece
                const currentPiecePositions = new Set();
                if (currentPiece && currentPiece.shape) {
                    for (let py = 0; py < currentPiece.shape.length; py++) {
                        for (let px = 0; px < currentPiece.shape[py].length; px++) {
                            if (currentPiece.shape[py][px]) {
                                const pieceX = currentPiece.x + px;
                                const pieceY = currentPiece.y + py;
                                currentPiecePositions.add(`${pieceX},${pieceY}`);
                            }
                        }
                    }
                }
                
                // Find valid position avoiding both board and current piece
                let finalY = ROWS - 1;
                for (let testY = ROWS - 1; testY >= 0; testY--) {
                    let canPlace = true;
                    for (const [bx, by] of tornadoPickedBlob.positions) {
                        const newX = bx + offsetX;
                        const newY = testY - (maxY - by);
                        
                        if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) {
                            canPlace = false;
                            break;
                        }
                        if (board[newY][newX] !== null) {
                            canPlace = false;
                            break;
                        }
                        if (currentPiecePositions.has(`${newX},${newY}`)) {
                            canPlace = false;
                            break;
                        }
                    }
                    if (canPlace) {
                        finalY = testY;
                        break;
                    }
                }
                
                // Update final positions with fresh calculation
                tornadoFinalPositions = tornadoPickedBlob.positions.map(([bx, by]) => ({
                    x: bx + offsetX,
                    y: finalY - (maxY - by)
                }));
                
                // Place blocks at freshly calculated positions
                for (let i = 0; i < tornadoPickedBlob.positions.length; i++) {
                    const finalPos = tornadoFinalPositions[i];
                    if (finalPos.x >= 0 && finalPos.x < COLS && finalPos.y >= 0 && finalPos.y < ROWS) {
                        board[finalPos.y][finalPos.x] = tornadoPickedBlob.color;
                        isRandomBlock[finalPos.y][finalPos.x] = false;
                        fadingBlocks[finalPos.y][finalPos.x] = null;
                    }
                }
                
                playSoundEffect('drop', soundToggle);
                clearLines();
                
                tornadoPickedBlob = null;
                tornadoFinalPositions = null;
                tornadoFinalCenterX = null;
                tornadoFinalCenterY = null;
                tornadoDropVelocity = 0;
                tornadoState = 'dissipating';
                tornadoFadeProgress = 0;
            }
        }
    } else if (tornadoState === 'dissipating') {
        // Tornado gradually gets thinner and disappears
        tornadoFadeProgress += 0.02; // Takes ~50 frames (about 0.8 seconds)
        
        if (tornadoFadeProgress >= 1.0) {
            tornadoActive = false;
            weatherEventGracePeriod = WEATHER_GRACE_LINES; // Start grace period
            // During replay, skip the next board sync
            if (GameReplay.isActive()) {
                GameReplay.setSkipNextSync(true);
                console.log('🎬 Will skip next board sync (tornado just finished)');
            }
            stopTornadoWind(); // Stop the wind sound
        }
    }
}

function canLiftBlob(blob) {
    // A blob can be lifted if NO OTHER blobs are resting on top of it
    // Check each block in the blob to see if there's a different blob directly above
    
    const blobSet = new Set(blob.positions.map(([x, y]) => `${x},${y}`));
    
    for (const [x, y] of blob.positions) {
        // Check the cell directly ABOVE this block
        if (y - 1 >= 0) {
            const cellAbove = board[y - 1][x];
            
            // If there's a block above...
            if (cellAbove !== null) {
                // Check if it's part of THIS blob
                const isSameBlob = blobSet.has(`${x},${y - 1}`);
                
                // If it's a DIFFERENT blob above, this blob is supporting it - LOCKED
                if (!isSameBlob) {
                    return false;
                }
            }
        }
    }
    
    // No different-colored blocks found resting on top - can lift!
    return true;
}

function dropBlobAt(blob, centerCol) {
    // Find the blob's bounding box
    const minX = Math.min(...blob.positions.map(p => p[0]));
    const maxX = Math.max(...blob.positions.map(p => p[0]));
    const minY = Math.min(...blob.positions.map(p => p[1]));
    const maxY = Math.max(...blob.positions.map(p => p[1]));
    const blobWidth = maxX - minX + 1;
    
    // Calculate offset to place blob at target column, ensuring it fits
    const blobCenterX = Math.floor((minX + maxX) / 2);
    let offsetX = centerCol - blobCenterX;
    
    // Clamp to ensure blob stays within bounds
    // Check left edge
    if (minX + offsetX < 0) {
        offsetX = -minX;
    }
    // Check right edge
    if (maxX + offsetX >= COLS) {
        offsetX = COLS - 1 - maxX;
    }
    
    // Find lowest valid Y position for the blob
    let finalY = ROWS - 1;
    for (let testY = ROWS - 1; testY >= 0; testY--) {
        let canPlace = true;
        for (const [bx, by] of blob.positions) {
            const newX = bx + offsetX;
            const newY = testY - (maxY - by);
            
            // Check bounds
            if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) {
                canPlace = false;
                break;
            }
            
            // Check collision with existing blocks
            if (board[newY][newX] !== null) {
                canPlace = false;
                break;
            }
        }
        
        if (canPlace) {
            finalY = testY;
            break;
        }
    }
    
    // Place the blob (with bounds check as safety)
    for (const [bx, by] of blob.positions) {
        const newX = bx + offsetX;
        const newY = finalY - (maxY - by);
        
        if (newX >= 0 && newX < COLS && newY >= 0 && newY < ROWS) {
            board[newY][newX] = blob.color;
            isRandomBlock[newY][newX] = false;
            fadingBlocks[newY][newX] = null;
        }
    }
}

function drawTornado() {
    if (!tornadoActive) return;
    
    ctx.save();
    
    const height = Math.max(5, tornadoY);
    
    // Apply dissipation fade
    const fadeFactor = tornadoState === 'dissipating' ? (1 - tornadoFadeProgress) : 1.0;
    const topWidth = 75 * fadeFactor;
    const bottomWidth = 10 * fadeFactor;
    
    // Smooth width function - no noise
    const getWidth = (progress) => {
        const baseEased = 1 - Math.pow(1 - progress, 2.5);
        return topWidth - (topWidth - bottomWidth) * baseEased;
    };
    
    // Calculate bend at a given progress - smooth, gentle curves
    const getBend = (progress) => {
        const bend1 = Math.sin(tornadoRotation * 0.4 + progress * Math.PI * 0.5) * 8;
        const bend2 = Math.sin(tornadoRotation * 0.2 + progress * Math.PI * 0.8) * 4;
        return bend1 + bend2;
    };
    
    // Draw the main funnel FIRST
    const baseOpacity = tornadoState === 'dissipating' ? 0.75 * (1 - tornadoFadeProgress * 0.5) : 0.75;
    
    // Single smooth funnel shape with gradient
    ctx.globalAlpha = baseOpacity;
    
    const gradient = ctx.createLinearGradient(tornadoX - topWidth, 0, tornadoX + topWidth, 0);
    gradient.addColorStop(0, '#5a5550');
    gradient.addColorStop(0.3, '#7a7570');
    gradient.addColorStop(0.5, '#8a8580');
    gradient.addColorStop(0.7, '#7a7570');
    gradient.addColorStop(1, '#5a5550');
    
    ctx.beginPath();
    
    // Left edge - smooth curve
    for (let y = 0; y <= height; y += 2) {
        const progress = y / height;
        const width = getWidth(progress);
        const bend = getBend(progress);
        const x = tornadoX - width + bend;
        
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    
    // Smooth bottom - flat elliptical curve (not too rounded)
    const bottomBend = getBend(1.0);
    const bw = getWidth(1.0);
    // Draw a flattened ellipse arc for the bottom
    ctx.ellipse(tornadoX + bottomBend, height, bw, bw * 0.25, 0, Math.PI, 0, true);
    
    // Right edge - smooth curve
    for (let y = height; y >= 0; y -= 2) {
        const progress = y / height;
        const width = getWidth(progress);
        const bend = getBend(progress);
        const x = tornadoX + width + bend;
        ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw debris cloud AFTER funnel so it covers the bottom
    // Cloud grows as tornado approaches ground
    const groundLevel = canvas.height; // Where touchdown happens
    const cloudStartHeight = groundLevel * 0.15; // Start showing cloud when tornado is 15% down
    
    if (height > cloudStartHeight) {
        const debrisCenterX = tornadoX + bottomBend;
        const debrisBaseY = height;
        
        // Calculate progress from when cloud starts appearing to touchdown
        // 0 = just started appearing, 1 = touched down
        const cloudProgress = Math.min(1, (height - cloudStartHeight) / (groundLevel - cloudStartHeight));
        
        // Size and opacity scale with progress
        const sizeScale = 0.2 + cloudProgress * 0.8; // Start at 20% size, grow to 100%
        const opacityScale = 0.1 + cloudProgress * 0.9; // Start at 10% opacity, grow to 100%
        
        const cloudOpacity = tornadoState === 'dissipating' ? opacityScale * (1 - tornadoFadeProgress) : opacityScale;
        ctx.globalAlpha = cloudOpacity;
        
        // Layer multiple organic puffs - more dense at center
        // Inner layer - dense, bright, covers the tube bottom
        for (let i = 0; i < 8; i++) {
            const puffPhase = tornadoRotation * 0.3 + i * 0.8;
            const puffDist = (8 + Math.sin(puffPhase * 1.5) * 6) * sizeScale;
            const puffX = debrisCenterX + Math.cos(puffPhase * 1.7 + i) * puffDist;
            const puffY = debrisBaseY - 2 * sizeScale + Math.sin(puffPhase * 0.9) * 4 * sizeScale;
            const puffSize = (18 + Math.sin(puffPhase * 0.6) * 5) * sizeScale;
            
            const puffGrad = ctx.createRadialGradient(puffX, puffY, 0, puffX, puffY, puffSize);
            puffGrad.addColorStop(0, 'rgba(150, 143, 135, 0.95)');
            puffGrad.addColorStop(0.4, 'rgba(135, 128, 120, 0.7)');
            puffGrad.addColorStop(0.7, 'rgba(120, 113, 105, 0.3)');
            puffGrad.addColorStop(1, 'rgba(105, 98, 90, 0)');
            
            ctx.fillStyle = puffGrad;
            ctx.beginPath();
            ctx.arc(puffX, puffY, puffSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Middle layer - medium spread
        for (let i = 0; i < 10; i++) {
            const puffPhase = tornadoRotation * 0.35 + i * 0.65;
            const puffDist = (20 + Math.sin(puffPhase * 1.3) * 12) * sizeScale;
            const puffX = debrisCenterX + Math.cos(puffPhase * 1.9 + i * 0.5) * puffDist;
            const puffY = debrisBaseY - 3 * sizeScale + Math.sin(puffPhase * 0.7) * 6 * sizeScale;
            const puffSize = (22 + Math.sin(puffPhase * 0.8) * 7) * sizeScale;
            
            const puffGrad = ctx.createRadialGradient(puffX, puffY, 0, puffX, puffY, puffSize);
            puffGrad.addColorStop(0, 'rgba(140, 133, 125, 0.6)');
            puffGrad.addColorStop(0.5, 'rgba(125, 118, 110, 0.35)');
            puffGrad.addColorStop(1, 'rgba(110, 103, 95, 0)');
            
            ctx.fillStyle = puffGrad;
            ctx.beginPath();
            ctx.arc(puffX, puffY, puffSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Outer layer - sparse, faint
        for (let i = 0; i < 6; i++) {
            const puffPhase = tornadoRotation * 0.25 + i * 1.1;
            const puffDist = (35 + Math.sin(puffPhase) * 15) * sizeScale;
            const puffX = debrisCenterX + Math.cos(puffPhase * 2.1 + i) * puffDist;
            const puffY = debrisBaseY - 5 * sizeScale + Math.sin(puffPhase * 0.6) * 8 * sizeScale;
            const puffSize = (25 + Math.sin(puffPhase * 0.5) * 8) * sizeScale;
            
            const puffGrad = ctx.createRadialGradient(puffX, puffY, 0, puffX, puffY, puffSize);
            puffGrad.addColorStop(0, 'rgba(130, 123, 115, 0.35)');
            puffGrad.addColorStop(0.6, 'rgba(115, 108, 100, 0.15)');
            puffGrad.addColorStop(1, 'rgba(100, 93, 85, 0)');
            
            ctx.fillStyle = puffGrad;
            ctx.beginPath();
            ctx.arc(puffX, puffY, puffSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Draw carried blob if lifting, carrying, or dropping
    if (tornadoPickedBlob && tornadoState !== 'descending') {
        const minX = Math.min(...tornadoPickedBlob.positions.map(p => p[0]));
        const maxX = Math.max(...tornadoPickedBlob.positions.map(p => p[0]));
        const minY = Math.min(...tornadoPickedBlob.positions.map(p => p[1]));
        const maxY = Math.max(...tornadoPickedBlob.positions.map(p => p[1]));
        // Use floor for X center to match dropBlobAt
        const blobCenterX = Math.floor((minX + maxX) / 2);
        const blobCenterY = (minY + maxY) / 2;
        
        // Calculate blob position based on state
        let blobDrawX, blobDrawY, blobAlpha;
        
        if (tornadoState === 'lifting') {
            // Blob climbs up tornado while orbiting
            const orbitX = Math.cos(tornadoOrbitAngle) * tornadoOrbitRadius;
            const orbitZ = Math.sin(tornadoOrbitAngle) * tornadoOrbitRadius; // Z depth
            
            blobDrawX = tornadoX + orbitX;
            blobDrawY = tornadoLiftHeight; // Climbs from pickup point to top
            
            // Fade blob when behind tornado (negative Z)
            blobAlpha = orbitZ < 0 ? 0.3 : 1.0;
        } else if (tornadoState === 'carrying') {
            // Blob flung free, orbit fading out
            const orbitX = Math.cos(tornadoOrbitAngle) * tornadoOrbitRadius;
            const orbitZ = Math.sin(tornadoOrbitAngle) * tornadoOrbitRadius;
            
            blobDrawX = tornadoX + orbitX;
            blobDrawY = tornadoLiftHeight; // Stay at top height
            
            blobAlpha = orbitZ < 0 ? 0.3 : 1.0;
        } else {
            // Dropping - use pre-calculated final X, animate Y
            blobDrawX = tornadoFinalCenterX || tornadoX;
            blobDrawY = tornadoDropStartY;
            blobAlpha = 1.0;
        }
        
        ctx.save();
        
        // Apply 3D rotation effect around vertical axis using canvas scaling
        // This simulates the blob spinning in 3D space
        const scaleX = Math.cos(tornadoVerticalRotation); // Horizontal compression when rotating
        const adjustedAlpha = blobAlpha * (0.6 + Math.abs(scaleX) * 0.4); // Fade slightly when edge-on
        
        ctx.globalAlpha = adjustedAlpha;
        
        // Translate to blob center
        const centerPixelX = blobDrawX;
        const centerPixelY = blobDrawY;
        
        ctx.translate(centerPixelX, centerPixelY);
        
        // Apply 3D rotation by scaling X axis (simulates rotation around Y axis)
        ctx.scale(scaleX, 1);
        
        // Apply flat rotation
        ctx.rotate(tornadoBlobRotation);
        
        // Translate back
        ctx.translate(-centerPixelX, -centerPixelY);
        
        // For dropping state, use pre-calculated final positions for perfect alignment
        let positions;
        if (tornadoState === 'dropping' && tornadoFinalPositions) {
            // Calculate offset from final center to current animated position
            const finalCenterY = tornadoFinalCenterY || blobDrawY;
            const yOffset = (blobDrawY - finalCenterY) / BLOCK_SIZE;
            
            positions = tornadoFinalPositions.map(pos => [
                pos.x,
                pos.y + yOffset
            ]);
        } else {
            // Calculate screen positions for each block
            const centerGridX = blobDrawX / BLOCK_SIZE;
            const centerGridY = blobDrawY / BLOCK_SIZE - 0.5;
            
            positions = tornadoPickedBlob.positions.map(([bx, by]) => {
                const relX = bx - blobCenterX;
                const relY = by - blobCenterY;
                
                const screenX = Math.floor(centerGridX + relX);
                const screenY = Math.floor(centerGridY + relY + 0.5);
                return [screenX, screenY];
            });
        }
        
        drawSolidShape(ctx, positions, tornadoPickedBlob.color, BLOCK_SIZE, false, 0.9);
        
        ctx.restore();
    }
    
    ctx.restore();
}

function updateEarthquake() {
    if (!earthquakeActive) return;
    
    if (earthquakePhase === 'shake') {
        earthquakeShakeProgress++;
        
        // Shake horizontally for 120 frames (2 seconds at 60fps) before crack appears
        if (earthquakeShakeProgress >= 120) {
            earthquakePhase = 'crack';
            earthquakeShakeProgress = 0;
            
            // Crack path was pre-generated at spawn time
            // Just play the crack sound as animation begins
            playEarthquakeCrack(soundToggle);
        }
    } else if (earthquakePhase === 'crack') {
        earthquakeCrackProgress += 0.05; // Very slow crack growth - 20 frames per segment
        
        // Crack animation completes when we've drawn the full crack
        if (earthquakeCrackProgress >= earthquakeCrack.length) {
            earthquakePhase = 'shift';
            earthquakeShiftProgress = 0;
            
            // Determine which blocks are on left vs right of crack
            splitBlocksByCrack();
        }
    } else if (earthquakePhase === 'shift') {
        earthquakeShiftProgress++;
        
        // Shift for 60 frames (doubled from 30)
        if (earthquakeShiftProgress >= 60) {
            console.log('🌍 Earthquake shift complete, applying changes to board');
            earthquakePhase = 'done';
            
            // Apply the shift to the board
            applyEarthquakeShift();
            
            // CRITICAL FIX: After earthquake shift, blocks may have moved into currentPiece's space
            // Push the piece up until it's no longer colliding
            if (currentPiece && collides(currentPiece)) {
                console.log('🌍 Earthquake shifted blocks into current piece location - pushing piece up');
                let safetyCounter = 0;
                while (collides(currentPiece) && safetyCounter < 10) {
                    currentPiece.y--;
                    safetyCounter++;
                }
                if (safetyCounter >= 10) {
                    console.log('🌍 Could not find safe position for piece after earthquake');
                }
            }
            
            console.log('🌍 Earthquake complete, applying gravity');
            // Check for line clears and apply gravity
            applyGravity();
            
            earthquakeActive = false;
            weatherEventGracePeriod = WEATHER_GRACE_LINES; // Start grace period
            console.log('🌍 Earthquake finished, earthquakeActive = false');
            
            // During replay, skip the next board sync since the snapshot was captured
            // before the earthquake completed in the original game
            if (GameReplay.isActive()) {
                GameReplay.setSkipNextSync(true);
                console.log('🎬 Will skip next board sync (earthquake just finished)');
            }
            
            // Stop controller haptic feedback
            GamepadController.stopVibration();
        }
    }
}

function generateEarthquakeCrack() {
    // During replay (v2.0), use recorded crack from piece data
    const _replayCrack = GameReplay.isActive() ? GameReplay.consumeEarthquakeCrack() : null;
    if (_replayCrack) {
        earthquakeCrack = _replayCrack;
        earthquakeCrackMap.clear();
        earthquakeCrack.forEach(pt => {
            earthquakeCrackMap.set(pt.y, pt.x);
        });
        console.log('🌍 Earthquake crack loaded from recording:', earthquakeCrack.length, 'points');
        return;
    }
    
    // Find the bottom and top of the stack
    let bottomY = ROWS - 1;
    let topY = 0;
    
    for (let y = ROWS - 1; y >= 0; y--) {
        let hasBlock = board[y].some(cell => cell !== null);
        if (hasBlock) {
            bottomY = y;
            break;
        }
    }
    
    for (let y = 0; y < ROWS; y++) {
        let hasBlock = board[y].some(cell => cell !== null);
        if (hasBlock) {
            topY = y;
            break;
        }
    }
    
    // Find the left and right boundaries for each row
    const rowBounds = [];
    for (let y = topY; y <= bottomY; y++) {
        let leftmost = COLS;
        let rightmost = -1;
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] !== null) {
                leftmost = Math.min(leftmost, x);
                rightmost = Math.max(rightmost, x);
            }
        }
        rowBounds[y] = { left: leftmost, right: rightmost, hasBlocks: rightmost >= 0 };
    }
    
    // Start crack at middle column, at the bottom
    let currentX = Math.floor(COLS / 2);
    let currentY = bottomY;
    
    // Clamp starting position to be within the bottom row's blocks
    if (rowBounds[currentY].hasBlocks) {
        const { left, right } = rowBounds[currentY];
        const mid = Math.floor((left + right) / 2);
        // Position the crack to split the row roughly in half
        currentX = Math.max(left + 1, Math.min(right, mid));
    }
    
    earthquakeCrack = [];
    
    // Track the current direction tendency (-1 for left, 0 for straight, 1 for right)
    let currentDirection = 0;
    let rowsSinceLastChange = 0;
    
    // Move up from bottom to top, creating a jagged path
    while (currentY >= topY) {
        // Only add point if this row has blocks
        if (rowBounds[currentY].hasBlocks) {
            // Clamp currentX to be within this row's block boundaries
            const { left, right } = rowBounds[currentY];
            // Keep crack between blocks (at least 1 block on each side when possible)
            const minX = Math.max(1, left + 1);
            const maxX = Math.min(COLS - 1, right);
            currentX = Math.max(minX, Math.min(maxX, currentX));
            
            earthquakeCrack.push({x: currentX, y: currentY, edge: 'vertical'});
        }
        
        // Move up one row
        currentY--;
        if (currentY < topY) break;
        
        rowsSinceLastChange++;
        
        // Decision logic for crack movement
        if (currentDirection === 0) {
            // Currently going straight - 30% chance to start jogging
            if (Math.random() < 0.3) {
                currentDirection = Math.random() < 0.5 ? -1 : 1;
                rowsSinceLastChange = 0;
            }
        } else {
            // Currently jogging in a direction
            if (rowsSinceLastChange < 2) {
                // Keep going in same direction for at least 2 rows
            } else if (rowsSinceLastChange >= 4) {
                // After 4+ rows, likely to straighten out or change
                const rand = Math.random();
                if (rand < 0.4) {
                    currentDirection = 0; // Go straight
                    rowsSinceLastChange = 0;
                } else if (rand < 0.5) {
                    currentDirection *= -1; // Reverse direction
                    rowsSinceLastChange = 0;
                }
            } else {
                // 2-3 rows in: small chance to change
                if (Math.random() < 0.15) {
                    currentDirection = 0; // Go straight
                    rowsSinceLastChange = 0;
                }
            }
        }
        
        // Apply the direction (if not going straight)
        if (currentDirection !== 0 && rowBounds[currentY] && rowBounds[currentY].hasBlocks) {
            const newX = currentX + currentDirection;
            const { left, right } = rowBounds[currentY];
            const minX = Math.max(1, left + 1);
            const maxX = Math.min(COLS - 1, right);
            
            // Check if new position is within bounds
            if (newX >= minX && newX <= maxX) {
                currentX = newX;
            } else {
                // Hit boundary - reverse direction
                if (newX < minX) {
                    currentDirection = 1; // Force right
                } else {
                    currentDirection = -1; // Force left
                }
                rowsSinceLastChange = 0;
            }
        }
    }
    
    // Add final top point
    earthquakeCrack.push({x: currentX, y: topY, edge: 'vertical'});
    
    // Build crack position map for fast lookup during blob detection
    earthquakeCrackMap.clear();
    earthquakeCrack.forEach(pt => {
        earthquakeCrackMap.set(pt.y, pt.x);
    });
    
    console.log('🌍 Earthquake crack generated:', earthquakeCrack.length, 'points from y', bottomY, 'to', topY);
}

function splitBlocksByCrack() {
    earthquakeLeftBlocks = [];
    earthquakeRightBlocks = [];
    
    // Shift type is already set at spawn time (in spawnEarthquake)
    // Just use the pre-determined earthquakeShiftType
    console.log('🌍 Using earthquake shift type:', earthquakeShiftType);
    
    // Build a map of which column the crack is at for each row
    const crackPositions = new Map();
    earthquakeCrack.forEach(pt => {
        // Accept points with edge='vertical' OR missing edge (for backwards compatibility with old recordings)
        if (pt.edge === 'vertical' || pt.edge === undefined) {
            // For vertical edges, the crack separates columns at x-1 (left) and x (right)
            if (!crackPositions.has(pt.y)) {
                crackPositions.set(pt.y, pt.x);
            }
        }
    });
    
    // For each row with blocks, split by crack position
    for (let y = 0; y < ROWS; y++) {
        // Find crack X position at this Y (default to middle if not found)
        const crackX = crackPositions.get(y) || Math.floor(COLS / 2);
        
        // Left side: columns 0 to crackX-1
        for (let x = 0; x < crackX; x++) {
            if (board[y][x] !== null) {
                earthquakeLeftBlocks.push({x, y, color: board[y][x]});
            }
        }
        
        // Right side: columns crackX to COLS-1
        for (let x = crackX; x < COLS; x++) {
            if (board[y][x] !== null) {
                earthquakeRightBlocks.push({x, y, color: board[y][x]});
            }
        }
    }
    
    console.log('🌍 Split blocks: Left:', earthquakeLeftBlocks.length, 'Right:', earthquakeRightBlocks.length);
}

function applyEarthquakeShift() {
    console.log('🌍 Applying earthquake shift... Type:', earthquakeShiftType);
    
    // Save the isRandomBlock state for blocks that will be moved
    const blockStates = new Map();
    earthquakeLeftBlocks.forEach(block => {
        const key = `${block.x},${block.y}`;
        blockStates.set(key, {
            isRandom: (isRandomBlock[block.y] && isRandomBlock[block.y][block.x]) || false
        });
    });
    earthquakeRightBlocks.forEach(block => {
        const key = `${block.x},${block.y}`;
        blockStates.set(key, {
            isRandom: (isRandomBlock[block.y] && isRandomBlock[block.y][block.x]) || false
        });
    });
    
    // Clear the board and isRandomBlock
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            board[y][x] = null;
            if (isRandomBlock[y]) {
                isRandomBlock[y][x] = false;
            }
        }
    }
    
    // Place left blocks - shift left only if shiftType is 'both' or 'left'
    earthquakeLeftBlocks.forEach(block => {
        const shiftLeft = (earthquakeShiftType === 'both' || earthquakeShiftType === 'left');
        const newX = shiftLeft ? block.x - 1 : block.x;
        if (newX >= 0) {
            board[block.y][newX] = block.color;
            const key = `${block.x},${block.y}`;
            const state = blockStates.get(key);
            if (state && state.isRandom) {
                isRandomBlock[block.y][newX] = true;
            }
        }
        // If newX < 0, block falls off the edge
    });
    
    // Place right blocks - shift right only if shiftType is 'both' or 'right'
    earthquakeRightBlocks.forEach(block => {
        const shiftRight = (earthquakeShiftType === 'both' || earthquakeShiftType === 'right');
        const newX = shiftRight ? block.x + 1 : block.x;
        if (newX < COLS) {
            board[block.y][newX] = block.color;
            const key = `${block.x},${block.y}`;
            const state = blockStates.get(key);
            if (state && state.isRandom) {
                isRandomBlock[block.y][newX] = true;
            }
        }
        // If newX >= COLS, block falls off the edge
    });
    
    console.log('🌍 Earthquake shift applied!');
}


function drawEarthquake() {
    if (!earthquakeActive) return;
    
    ctx.save();
    
    if (earthquakePhase === 'shake') {
        // During shake phase, just shake the screen - normal rendering happens in main loop
        // No special drawing needed here
    } else if (earthquakePhase === 'crack' || earthquakePhase === 'shift') {
        // Clear canvas and draw background (same as drawBoard)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(30, 60, 120, 0.25)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw storm particles behind gameplay
        StormEffects.draw();
        
        if (earthquakePhase === 'crack') {
        // During crack phase, render as SEGMENTED BLOBS
        // The crack acts as a barrier, so blobs are split even if same color
        const blobs = getAllBlobsFromBoard(board);
        
        // Draw all blobs with their proper shapes (normal opacity)
        blobs.forEach(blob => {
            drawSolidShape(ctx, blob.positions, blob.color, BLOCK_SIZE, false, getFaceOpacity(), false);
        });
        
        // Draw dark edges along the crack boundaries
        // Only show edges where blobs are actually being separated
        const visibleSegments = Math.floor(earthquakeCrackProgress);
        
        if (visibleSegments > 0) {
            ctx.save();
            
            // Draw base dark crack
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            
            // Draw a single continuous crack line along the fault path
            // Draw one line AT the boundary, not on both sides
            
            for (let i = 0; i < visibleSegments && i < earthquakeCrack.length; i++) {
                const pt = earthquakeCrack[i];
                const y = pt.y;
                const crackX = pt.x;
                
                const leftX = crackX - 1;
                const rightX = crackX;
                
                // Check if there are blocks on either side
                const leftExists = leftX >= 0 && board[y] && board[y][leftX] !== null;
                const rightExists = rightX < COLS && board[y] && board[y][rightX] !== null;
                
                // Draw single vertical line at the crack boundary (between the two columns)
                if (leftExists || rightExists) {
                    // Draw base dark line exactly at the boundary between columns
                    const boundaryX = crackX * BLOCK_SIZE;
                    ctx.fillRect(boundaryX - 2.5, y * BLOCK_SIZE, 5, BLOCK_SIZE);
                }
                
                // Handle horizontal segments when the crack jogs
                if (i > 0) {
                    const prevPt = earthquakeCrack[i - 1];
                    if (prevPt.x !== pt.x) {
                        // The crack jogged horizontally
                        const prevY = prevPt.y;
                        const currY = pt.y;
                        const startX = prevPt.x;
                        const endX = pt.x;
                        
                        // Determine the span of the horizontal segment
                        // It should connect the two vertical segments
                        const minX = Math.min(startX, endX);
                        const maxX = Math.max(startX, endX);
                        
                        // Draw horizontal line at the boundary between rows
                        const boundaryY = currY * BLOCK_SIZE + BLOCK_SIZE; // Bottom edge of upper row
                        
                        // Only draw in the blocks BETWEEN the two vertical crack lines
                        // Start from minX, end before maxX (don't include the endpoint columns)
                        for (let jx = minX; jx < maxX; jx++) {
                            const blockAbove = board[currY] && board[currY][jx] !== null;
                            const blockBelow = board[prevY] && board[prevY][jx] !== null;
                            
                            if (blockAbove || blockBelow) {
                                const blockX = jx * BLOCK_SIZE;
                                ctx.fillRect(blockX, boundaryY - 2.5, BLOCK_SIZE, 5);
                            }
                        }
                    }
                }
            }
            
            // Now add random red lava/magma streaks inside the crack!
            ctx.globalCompositeOperation = 'lighten'; // Makes reds glow over black
            
            for (let i = 0; i < visibleSegments && i < earthquakeCrack.length; i++) {
                const pt = earthquakeCrack[i];
                const y = pt.y;
                const crackX = pt.x;
                const boundaryX = crackX * BLOCK_SIZE;
                
                // Only draw red lava where blocks actually exist
                const leftX = crackX - 1;
                const rightX = crackX;
                const leftExists = leftX >= 0 && board[y] && board[y][leftX] !== null;
                const rightExists = rightX < COLS && board[y] && board[y][rightX] !== null;
                
                // Random chance of lava streak in this segment (70% chance - MORE RED!)
                // But ONLY if there are blocks on at least one side
                if ((leftExists || rightExists) && Math.random() < 0.7) {
                    // Varying red colors for lava effect - brighter and more intense
                    const redIntensity = 200 + Math.floor(Math.random() * 55); // 200-255 (brighter!)
                    const orangeShift = Math.floor(Math.random() * 120); // 0-120 for orange tint
                    const alpha = 0.6 + Math.random() * 0.4; // 0.6-1.0 transparency (more opaque)
                    
                    ctx.fillStyle = `rgba(${redIntensity}, ${orangeShift}, 0, ${alpha})`;
                    
                    // Random height for this streak (partial or full block height)
                    const streakHeight = BLOCK_SIZE * (0.3 + Math.random() * 0.7);
                    const streakY = y * BLOCK_SIZE + Math.random() * (BLOCK_SIZE - streakHeight);
                    
                    // Draw red streak - now THICKER (3px instead of 1.5px)
                    ctx.fillRect(boundaryX - 1.5, streakY, 3, streakHeight);
                    
                    // Sometimes add a glow effect (30% of streaks - increased from 20%)
                    if (Math.random() < 0.3) {
                        ctx.shadowBlur = 6;
                        ctx.shadowColor = '#FF4500';
                        ctx.fillRect(boundaryX - 1.5, streakY, 3, streakHeight);
                        ctx.shadowBlur = 0;
                    }
                }
            }
            
            ctx.globalCompositeOperation = 'source-over'; // Reset to normal blending
            ctx.restore();
        }
    } else if (earthquakePhase === 'shift') {
        // During shift, physically separate the blobs with SMOOTH interpolation
        const shiftProgress = earthquakeShiftProgress / 60; // 0 to 1 (doubled duration)
        
        // Calculate shift amounts based on shift type
        const leftShiftAmount = (earthquakeShiftType === 'both' || earthquakeShiftType === 'left') ? -shiftProgress * BLOCK_SIZE : 0;
        const rightShiftAmount = (earthquakeShiftType === 'both' || earthquakeShiftType === 'right') ? shiftProgress * BLOCK_SIZE : 0;
        
        // Draw left blobs - shift them smoothly to the left (if applicable)
        ctx.save();
        ctx.translate(leftShiftAmount, 0);
        const leftBlobs = [];
        const visited = new Set();
        
        // Build blobs only from left side blocks
        earthquakeLeftBlocks.forEach(block => {
            const key = `${block.x},${block.y}`;
            if (!visited.has(key)) {
                const blob = [];
                const stack = [block];
                const leftSet = new Set(earthquakeLeftBlocks.map(b => `${b.x},${b.y}`));
                
                while (stack.length > 0) {
                    const curr = stack.pop();
                    const currKey = `${curr.x},${curr.y}`;
                    if (visited.has(currKey)) continue;
                    if (!leftSet.has(currKey)) continue;
                    if (board[curr.y][curr.x] !== block.color) continue;
                    
                    visited.add(currKey);
                    blob.push([curr.x, curr.y]);
                    
                    // Add neighbors
                    stack.push({x: curr.x + 1, y: curr.y, color: block.color});
                    stack.push({x: curr.x - 1, y: curr.y, color: block.color});
                    stack.push({x: curr.x, y: curr.y + 1, color: block.color});
                    stack.push({x: curr.x, y: curr.y - 1, color: block.color});
                }
                
                if (blob.length > 0) {
                    leftBlobs.push({positions: blob, color: block.color});
                }
            }
        });
        
        leftBlobs.forEach(blob => {
            drawSolidShape(ctx, blob.positions, blob.color, BLOCK_SIZE, false, getFaceOpacity(), false);
        });
        ctx.restore();
        
        // Draw right blobs - shift them smoothly to the right (if applicable)
        ctx.save();
        ctx.translate(rightShiftAmount, 0);
        const rightBlobs = [];
        visited.clear();
        
        // Build blobs only from right side blocks
        earthquakeRightBlocks.forEach(block => {
            const key = `${block.x},${block.y}`;
            if (!visited.has(key)) {
                const blob = [];
                const stack = [block];
                const rightSet = new Set(earthquakeRightBlocks.map(b => `${b.x},${b.y}`));
                
                while (stack.length > 0) {
                    const curr = stack.pop();
                    const currKey = `${curr.x},${curr.y}`;
                    if (visited.has(currKey)) continue;
                    if (!rightSet.has(currKey)) continue;
                    if (board[curr.y][curr.x] !== block.color) continue;
                    
                    visited.add(currKey);
                    blob.push([curr.x, curr.y]);
                    
                    // Add neighbors
                    stack.push({x: curr.x + 1, y: curr.y, color: block.color});
                    stack.push({x: curr.x - 1, y: curr.y, color: block.color});
                    stack.push({x: curr.x, y: curr.y + 1, color: block.color});
                    stack.push({x: curr.x, y: curr.y - 1, color: block.color});
                }
                
                if (blob.length > 0) {
                    rightBlobs.push({positions: blob, color: block.color});
                }
            }
        });
        
        rightBlobs.forEach(blob => {
            drawSolidShape(ctx, blob.positions, blob.color, BLOCK_SIZE, false, getFaceOpacity(), false);
        });
        ctx.restore();
        }
    }
    
    ctx.restore();
}

// Helper to check if crack separates two horizontally adjacent cells
function isCrackBetween(x1, y1, x2, y2) {
    // Only check horizontal adjacency (crack is vertical)
    if (y1 !== y2) return false;
    if (Math.abs(x2 - x1) !== 1) return false;
    
    // During earthquake CRACK phase, check if crack separates these cells
    if (earthquakeActive && earthquakePhase === 'crack' && earthquakeCrack.length > 0) {
        const y = y1;
        
        // Check if this row is within the visible crack progress
        // The crack grows from bottom to top, so we need to find if this Y 
        // is covered by the visible portion
        const visibleCrackLength = Math.floor(earthquakeCrackProgress);
        
        // Check if any visible crack point is at this Y level
        let crackX = null;
        for (let i = 0; i < visibleCrackLength && i < earthquakeCrack.length; i++) {
            const pt = earthquakeCrack[i];
            if (pt.y === y) {
                crackX = pt.x;
                break;
            }
        }
        
        if (crackX !== null) {
            // The crack at position X separates column X-1 (left) from column X (right)
            // Check if x1 and x2 are on opposite sides of the crack
            const leftX = Math.min(x1, x2);
            const rightX = Math.max(x1, x2);
            
            // If leftX is < crackX and rightX is >= crackX, they're separated
            if (leftX < crackX && rightX >= crackX) {
                return true;
            }
        }
    }
    
    return false;
}

// Helper to get blobs from a specific board state
function getAllBlobsFromBoard(boardState, compoundMarkers = null) {
    const visited = Array(ROWS).fill(null).map(() => Array(COLS).fill(false));
    const blobs = [];
    
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (boardState[y][x] !== null && !visited[y][x]) {
                const color = boardState[y][x];
                const blob = [];
                
                // Get compound marker for this starting position (if any)
                const startMarker = compoundMarkers ? compoundMarkers.get(`${x},${y}`) : null;
                
                // Flood fill to find connected blocks of same color
                // BUT respect the crack as a barrier AND compound blob boundaries
                const stack = [[x, y]];
                while (stack.length > 0) {
                    const [cx, cy] = stack.pop();
                    
                    if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) continue;
                    if (visited[cy][cx] || boardState[cy][cx] !== color) continue;
                    
                    // If compound markers exist, enforce marker boundaries
                    if (compoundMarkers) {
                        const cellMarker = compoundMarkers.get(`${cx},${cy}`);
                        // Blocks can only merge if they have the SAME marker state:
                        // - Both have the same non-null marker, OR
                        // - Both have no marker (null/undefined)
                        if (startMarker !== cellMarker) continue;
                    }
                    
                    visited[cy][cx] = true;
                    blob.push([cx, cy]);
                    
                    // Check 4 adjacent cells, but don't cross the crack
                    const neighbors = [
                        [cx + 1, cy],
                        [cx - 1, cy],
                        [cx, cy + 1],
                        [cx, cy - 1]
                    ];
                    
                    for (const [nx, ny] of neighbors) {
                        // Don't add neighbor if crack separates it from current cell
                        if (!isCrackBetween(cx, cy, nx, ny)) {
                            stack.push([nx, ny]);
                        }
                    }
                }
                
                if (blob.length > 0) {
                    blobs.push({ color, positions: blob });
                }
            }
        }
    }
    
    return blobs;
}

function areInterlocked(blob1, blob2) {
    // Check if blob1 and blob2 share any column where their Y ranges overlap
    // This indicates physical dependency that requires moving together
    
    console.log(`      🔍 Checking interlocking: ${blob1.color} (${blob1.positions.length} blocks) vs ${blob2.color} (${blob2.positions.length} blocks)`);
    
    // Get column spans for each blob
    const cols1 = new Set(blob1.positions.map(p => p[0]));
    const cols2 = new Set(blob2.positions.map(p => p[0]));
    
    // Find columns where both blobs exist
    const sharedCols = [...cols1].filter(c => cols2.has(c));
    
    if (sharedCols.length === 0) {
        console.log(`      ❌ No shared columns - cannot be interlocked`);
        return false; // No overlap in columns
    }
    
    console.log(`      ✓ Shared columns: [${sharedCols.join(', ')}]`);
    
    for (const col of sharedCols) {
        // Get Y positions for each blob in this column
        const ys1 = blob1.positions.filter(p => p[0] === col).map(p => p[1]).sort((a, b) => a - b);
        const ys2 = blob2.positions.filter(p => p[0] === col).map(p => p[1]).sort((a, b) => a - b);
        
        if (ys1.length > 0 && ys2.length > 0) {
            const min1 = ys1[0];
            const max1 = ys1[ys1.length - 1];
            const min2 = ys2[0];
            const max2 = ys2[ys2.length - 1];
            
            console.log(`      📊 Column ${col}: blob1 Y-range [${min1}-${max1}], blob2 Y-range [${min2}-${max2}]`);
            
            // Check if Y ranges overlap OR are adjacent (touching)
            // overlap = -1 means adjacent, >= 0 means overlapping
            const overlap = Math.min(max1, max2) - Math.max(min1, min2);
            if (overlap >= -1) {
                const relationship = overlap >= 0 ? 'overlap' : 'are adjacent';
                console.log(`    🔗 Interlocked: Y ranges ${relationship} (overlap=${overlap}) in column ${col}`);
                return true;
            }
        }
    }
    
    console.log(`      ❌ Shared columns but not adjacent or overlapping - not interlocked`);
    return false;
}

function mergeInterlockedBlobs(blobs) {
    // Merge blobs that are interlocked into combined units
    const merged = [];
    const used = new Set();
    
    for (let i = 0; i < blobs.length; i++) {
        if (used.has(i)) continue;
        
        let combinedBlob = {
            colors: [blobs[i].color],
            positions: [...blobs[i].positions],
            isCompound: false
        };
        
        // Check if this blob is interlocked with any other blob
        for (let j = i + 1; j < blobs.length; j++) {
            if (used.has(j)) continue;
            
            if (areInterlocked(
                { color: combinedBlob.colors[0], positions: combinedBlob.positions },
                blobs[j]
            )) {
                // Merge blob j into our combined blob
                combinedBlob.positions.push(...blobs[j].positions);
                combinedBlob.colors.push(blobs[j].color);
                combinedBlob.isCompound = true;
                used.add(j);
                console.log(`  🔀 Merging interlocked blobs: ${combinedBlob.colors.join(' + ')}`);
            }
        }
        
        // Use the first color as the primary color (for display purposes)
        combinedBlob.color = combinedBlob.colors[0];
        merged.push(combinedBlob);
        used.add(i);
    }
    
    return merged;
}

// Storm particle system moved to StormEffects module (storm-effects.js)
// Functions: createStormParticle, createSplash, checkCollisionWithBlocks, createHailBounce,
// createLiquidDrip, updateLiquidPoolsAfterGravity, updateDrippingLiquids, drawDrippingLiquids,
// updateStormParticles, drawStormParticles

let board = [];
let isRandomBlock = []; // Track blocks placed by Gremlins challenge (rendered with silver edges)
// Lattice mode: grid managed by challenge_lattice.js (ChallengeEffects.Lattice)
let isLatticeBlock = []; // Alias to ChallengeEffects.Lattice.grid — reassigned on init
let fadingBlocks = []; // Track blocks that are fading in with their opacity and scale
let currentPiece = null;
let nextPieceQueue = []; // Queue of next 4 pieces
const NEXT_PIECE_COUNT = 4; // Number of pieces to show in preview

// Helper function to get next piece from queue (for backwards compatibility)
function getNextPiece() {
    return nextPieceQueue.length > 0 ? nextPieceQueue[0] : null;
}

// Helper function to consume next piece and add new one to queue
function consumeNextPiece() {
    const piece = nextPieceQueue.shift();
    // Add new piece to end of queue
    nextPieceQueue.push(createPiece());
    return piece;
}

// Helper function to initialize the piece queue
function initPieceQueue() {
    nextPieceQueue = [];
    for (let i = 0; i < NEXT_PIECE_COUNT; i++) {
        nextPieceQueue.push(createPiece());
    }
}
let score = 0;
let lines = 0;
let level = 1;

// Custom key repeat system - overrides browser's default repeat behavior
const customKeyRepeat = {
    keys: new Map(),      // Track which keys are pressed
    timers: new Map(),    // Track repeat timers
    initialDelay: 200,    // 200ms before repeat starts
    repeatRate: 40        // 40ms between repeats
};

// Shadow (training wheels) is now standard - no penalty
// Shadowless challenge mode adds 4% bonus instead
function applyTrainingWheelsPenalty(points) {
    return points; // No longer applies a penalty
}

// Helper function to calculate challenge mode multiplier based on difficulty
function getChallengeModeMultiplier() {
    if (challengeMode === 'normal') {
        return 1.0; // No bonus
    }
    
    // Visual-only challenges give 0% bonus in AI mode (AI doesn't experience visual effects)
    const visualOnlyChallenges = new Set([
        'stranger',    // Screen rotation - AI has direct board access
        'dyslexic',    // Control swap - AI places directly
        'phantom',     // Stack fades - AI has full board state
        'oz',          // Grayscale pieces - AI knows colors
        'longago',     // 3D perspective tilt - visual only
        'comingsoon',  // 3D perspective tilt - visual only
        'nervous',     // Screen vibration - visual only
        'shadowless',  // Hides landing shadow - AI calculates positions
        'amnesia',     // Color memory fade - AI has full board state
        'vertigo',     // Screen sway - visual only, AI has direct board access
        'carrie',      // Blood rain - visual distraction only
        'nokings'      // Poo rain - visual distraction only
    ]);
    
    // Challenge bonuses (only applied for non-visual challenges in AI mode)
    const challengeBonuses = {
        'stranger': 0.07,     // 7%
        'dyslexic': 0.06,     // 6%
        'phantom': 0.07,      // 7%
        'gremlins': 0.06,     // 6%
        'rubber': 0.05,       // 5%
        'oz': 0.05,           // 5%
        'lattice': 0.05,      // 5%
        'yesand': 0.05,       // 5%
        'sixseven': 0.04,     // 4%
        'longago': 0.04,      // 4%
        'comingsoon': 0.04,   // 4%
        'thinner': 0.04,      // 4%
        'mercurial': 0.04,    // 4%
        'shadowless': 0.02,   // 2%
        'amnesia': 0.06,      // 6% - can't see colors for blob building
        'vertigo': 0.02,      // 2% - disorienting sway
        'thicker': 0.03,      // 3%
        'carrie': 0.03,       // 3%
        'nokings': 0.03,      // 3%
        'nervous': 0.02       // 2%
    };
    
    if (challengeMode === 'combo') {
        let totalBonus = 0;
        activeChallenges.forEach(challenge => {
            // Skip visual-only challenges in AI mode
            if (aiModeEnabled && visualOnlyChallenges.has(challenge)) {
                return;
            }
            totalBonus += challengeBonuses[challenge] || 0.05;
        });
        return 1.0 + totalBonus;
    } else {
        // Single challenge mode
        // In AI mode, visual-only challenges get 0% bonus
        if (aiModeEnabled && visualOnlyChallenges.has(challengeMode)) {
            return 1.0;
        }
        return 1.0 + (challengeBonuses[challengeMode] || 0.05);
    }
}

// Helper function to apply all score modifiers (Training Wheels penalty + Challenge multiplier + Speed Bonus)
function applyScoreModifiers(points) {
    // First apply Training Wheels penalty if active
    let modifiedPoints = applyTrainingWheelsPenalty(points);
    
    // Then apply challenge mode multiplier
    modifiedPoints = Math.floor(modifiedPoints * getChallengeModeMultiplier());
    
    // Finally apply speed bonus multiplier
    modifiedPoints = Math.floor(modifiedPoints * speedBonusAverage);
    
    return modifiedPoints;
}

// Special event counters for leaderboard
let strikeCount = 0;
let tsunamiCount = 0;

// Cascade bonus tracking
let cascadeLevel = 0; // 0 = initial clear (1x), 1 = first cascade (2x), 2 = second cascade (3x), etc.
let cascadeBonusDisplay = null; // { text, startTime, duration }
let blackHoleCount = 0;
let volcanoCount = 0;
let supermassiveBlackHoleCount = 0;
let superVolcanoCount = 0;
let volcanoIsSuper = false; // Flag for delayed volcano scoring (x2 when tsunami also detected)

// Challenge modes
let challengeMode = 'normal'; // 'normal', 'stranger', 'phantom', 'rubber', 'oz', 'thinner', 'thicker', 'nervous', 'amnesia', 'vertigo', 'combo'
let activeChallenges = new Set(); // For combo mode
// Phantom mode: state managed by challenge_phantom.js (ChallengeEffects.Phantom)
// Rubber & Glue mode: state managed by challenge_rubber.js (ChallengeEffects.Rubber)
let nervousVibrateOffset = 0; // Current Y offset for nervous mode vibration

// Six Seven mode variables
// Six Seven mode: state managed by challenge_sixseven.js (ChallengeEffects.SixSeven)

// Gremlins mode: state managed by challenge_gremlins.js (ChallengeEffects.Gremlins)


// Mercurial mode: state managed by challenge_mercurial.js (ChallengeEffects.Mercurial)

// gameRunning is declared in starfield section
let paused = false; StarfieldSystem.setPaused(false);
let justPaused = false; // Flag to prevent immediate unpause from tap handler

// Toggle pause state
function togglePause() {
    if (!gameRunning) return;
    
    const settingsBtn = document.getElementById('settingsBtn');
    const musicSelect = document.getElementById('musicSelect');
    const pauseBtn = document.getElementById('pauseBtn');
    const songPauseBtn = document.getElementById('songPauseBtn');
    
    if (paused) {
        // Unpause
        paused = false;
        StarfieldSystem.setPaused(false);
        if (settingsBtn) settingsBtn.classList.add('hidden-during-play');
        // Show pause button again (only in tablet mode)
        if (pauseBtn && TabletMode.enabled) pauseBtn.style.display = 'block';
        // Resume music if it was playing
        if (musicSelect && musicSelect.value !== 'none') {
            if (typeof isMusicPaused === 'function' && isMusicPaused()) {
                resumeCurrentMusic();
                if (songPauseBtn) songPauseBtn.textContent = '⏸\uFE0E';
            } else {
                startMusic(gameMode, musicSelect);
            }
        }
    } else {
        // Pause
        captureCanvasSnapshot();
        paused = true;
        justPaused = true;
        setTimeout(() => { justPaused = false; }, 300); // Prevent immediate unpause
        StarfieldSystem.setPaused(true);
        if (settingsBtn) settingsBtn.classList.remove('hidden-during-play');
        // Hide pause button while paused
        if (pauseBtn) pauseBtn.style.display = 'none';
        // Pause music instead of stopping it
        if (typeof pauseCurrentMusic === 'function') {
            pauseCurrentMusic();
            if (songPauseBtn) songPauseBtn.textContent = '▶\uFE0E';
        } else {
            stopMusic();
        }
    }
}

let faceOpacity = 0.42; // Default 42% opacity - the answer to life, the universe, and everything!
let wasPausedBeforeSettings = false;
var gameLoop = null;
let dropCounter = 0;
let dropInterval = 1000;
let lockDelayCounter = 0; // Time spent resting on stack
let lockDelayActive = false; // Whether piece is currently in lock delay
const BASE_LOCK_DELAY_TIME = 500; // Initial 500ms grace period when piece lands
const MIN_LOCK_DELAY_TIME = 100; // Minimum lock delay at very high lines
let lockDelayResets = 0; // Number of times lock delay has been reset by movement
const MAX_LOCK_DELAY_RESETS = 15; // Maximum resets before piece must lock
const LOCK_DELAY_DECAY = 0.85; // Each reset reduces remaining grace period to 85%
let animatingLines = false;
let pendingLineCheck = false; // Flag to trigger another clearLines check after current animation
let lineAnimations = [];
let lightningEffects = [];
let triggeredTsunamis = new Set(); // Track tsunamis that have already triggered

function initBoard() {
    board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
    isRandomBlock = Array(ROWS).fill().map(() => Array(COLS).fill(false));
    if (window.ChallengeEffects && ChallengeEffects.Lattice) {
        ChallengeEffects.Lattice.init(ROWS, COLS);
        isLatticeBlock = ChallengeEffects.Lattice.grid;
    } else {
        isLatticeBlock = Array(ROWS).fill().map(() => Array(COLS).fill(false));
    }
    fadingBlocks = Array(ROWS).fill().map(() => Array(COLS).fill(null));
    if (window.ChallengeEffects && ChallengeEffects.Amnesia) ChallengeEffects.Amnesia.init(ROWS, COLS);
}

function getFaceOpacity() {
    return faceOpacity;
}

/**
 * Get the display color for a blob, applying amnesia fade if active.
 * Handles lava color conversion and amnesia white-blend in one place.
 */
function getDisplayColorForBlob(blob) {
    let color = blob.color === volcanoLavaColor ? getLavaColor() : blob.color;
    const isAmnesiaActive = challengeMode === 'amnesia' || activeChallenges.has('amnesia');
    if (isAmnesiaActive && window.ChallengeEffects) {
        color = ChallengeEffects.Amnesia.getBlobDisplayColor(color, blob.positions);
    }
    return color;
}

function randomColor() {
    return currentColorSet[Math.floor(Math.random() * currentColorSet.length)];
}


// v2.0: During replay, pieces come from GameReplay.spawnPiece() not createPiece()

function createPiece() {
    // v2.0: During replay, pieces come from spawnReplayPiece() not createPiece()
    // This function is only used for normal gameplay
    
    // TUNING MODE game 2+ within set: Use fixed piece sequence for fair comparison
    if (aiTuningMode && aiTuningGameInSet > 1 && aiTuningPieceSequence) {
        if (aiTuningPieceIndex < aiTuningPieceSequence.length) {
            const fixedPiece = aiTuningPieceSequence[aiTuningPieceIndex++];
            const shapeSet = getShapeSetForType(fixedPiece.type);
            const shape = shapeSet[fixedPiece.type];
            const pieceHeight = shape.length;
            
            return {
                shape: shape,
                type: fixedPiece.type,
                color: fixedPiece.color,
                x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
                y: -pieceHeight
            };
        }
        // Sequence exhausted - this game survived longer than any before!
        // Fall through to generate random piece, which will be added to sequence below
        console.log(`🔧 TUNING: Set #${aiTuningSetNumber} Game #${aiTuningGameInSet} exceeded sequence (${aiTuningPieceSequence.length} pieces) - extending...`);
    }
    
    // Normal random piece generation
    let shapeSet;
    let type;
    
    if (gameMode === 'blizzard' || gameMode === 'hurricane') {
        // 75% tetrominoes, 25% pentominoes
        const tetrominoKeys = Object.keys(SHAPES); // Standard 4-block pieces
        const fullShapeSet = gameMode === 'blizzard' ? BLIZZARD_SHAPES : EXTENDED_SHAPES;
        const pentominoKeys = Object.keys(fullShapeSet).filter(k => !SHAPES[k]); // Only 5-block pieces
        
        if (Math.random() < 0.75) {
            // Pick a tetromino
            type = tetrominoKeys[Math.floor(Math.random() * tetrominoKeys.length)];
            shapeSet = SHAPES;
        } else {
            // Pick a pentomino
            type = pentominoKeys[Math.floor(Math.random() * pentominoKeys.length)];
            shapeSet = fullShapeSet;
        }
    } else {
        shapeSet = SHAPES; // Standard 4-block shapes only
        const shapes = Object.keys(shapeSet);
        type = shapes[Math.floor(Math.random() * shapes.length)];
    }
    
    const shape = shapeSet[type];
    const pieceHeight = shape.length;
    const color = randomColor();
    
    const piece = {
        shape: shape,
        type: type,
        color: color,
        x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
        y: -pieceHeight  // Spawn completely above the well
    };
    
    // TUNING MODE: Capture pieces to extend the sequence
    // Game 1: Captures all pieces
    // Game 2+: Only captures pieces that exceed the current sequence length
    if (aiTuningMode && aiTuningPieceSequence) {
        aiTuningPieceSequence.push({ type: type, color: color });
        aiTuningPieceIndex++; // Keep index in sync with sequence length
    }
    
    return piece;
}

// Helper to get the correct shape set for a piece type
function getShapeSetForType(type) {
    if (SHAPES[type]) return SHAPES;
    if (typeof BLIZZARD_SHAPES !== 'undefined' && BLIZZARD_SHAPES[type]) return BLIZZARD_SHAPES;
    if (typeof EXTENDED_SHAPES !== 'undefined' && EXTENDED_SHAPES[type]) return EXTENDED_SHAPES;
    return SHAPES; // fallback
}

function playBloopSound() {
    if (!soundToggle.checked) return;
    
    // Create a "bloop" sound - descending pitch with round tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Start at higher pitch and descend
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.15);
    
    oscillator.type = 'sine'; // Round, bloop-like tone
    
    // Quick attack and decay
    gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
}

function updateFadingBlocks() {
    // Animate fading blocks
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const fade = fadingBlocks[y][x];
            if (fade && fade.scale < 1) {
                fade.opacity += 0.04; // Fade faster - reaches 1.0 in ~25 frames
                fade.scale += 0.03;   // Grow faster - reaches 1.0 in ~28 frames (continues growing after opacity is full)
                
                if (fade.scale >= 1) {
                    fade.opacity = 1;
                    fade.scale = 1;
                    fadingBlocks[y][x] = null; // Done fading
                    playBloopSound(); // Play sound when fully grown
                } else if (fade.opacity > 1) {
                    fade.opacity = 1; // Cap opacity at 1.0
                }
            }
        }
    }
}

function adjustBrightness(color, factor) {
    // Handle non-hex colors (like rgb() strings) by returning them unchanged
    if (!color || !color.startsWith('#')) {
        console.warn('adjustBrightness received non-hex color:', color);
        return color || '#808080'; // Return gray as fallback
    }
    
    // Parse hex color
    const hex = color.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    
    // Validate parsed values
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        console.warn('adjustBrightness failed to parse color:', color);
        return '#808080'; // Return gray as fallback
    }
    
    // Adjust brightness
    r = Math.min(255, Math.max(0, Math.floor(r * factor)));
    g = Math.min(255, Math.max(0, Math.floor(g * factor)));
    b = Math.min(255, Math.max(0, Math.floor(b * factor)));
    
    // Convert back to hex
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function drawSolidShape(ctx, positions, color, blockSize = BLOCK_SIZE, useGold = false, faceOpacity = 1.0, useSilver = false) {
    if (positions.length === 0) return;
    
    if (useGold) {
        console.log(`✨ Drawing blob with GOLD edges! positions=${positions.length}, color=${color}`);
    }
    // Silver edges for gremlin-placed blocks

    ctx.save();

    // Round Y positions for adjacency checking to handle fractional positions during animations
    // This prevents segmentation when blocks are pushed to fractional Y coordinates
    const posSet = new Set(positions.map(p => `${p[0]},${Math.round(p[1])}`));
    const b = Math.floor(blockSize * 0.2);

    // Create edge colors from the base color - just the 5 colors total
    // Parse the base color and create lighter/darker versions
    const baseColor = color;
    
    let topColor, leftColor, bottomColor, rightColor;
    
    if (useSilver) {
        // Silver edges for gremlin-placed blocks
        topColor = '#E8E8E8';      // Light silver
        leftColor = '#D3D3D3';     // Silver
        bottomColor = '#A9A9A9';   // Dark gray
        rightColor = '#808080';    // Gray
    } else if (useGold) {
        // Gold edges for spanning blobs
        topColor = '#FFD700';      // Gold
        leftColor = '#FFC700';     // Slightly darker gold
        bottomColor = '#DAA520';   // Goldenrod (darker)
        rightColor = '#B8860B';    // Dark goldenrod
    } else {
        // Create lighter shade for top and left (highlighted edges)
        const lightShade = adjustBrightness(color, 1.3);
        const mediumLightShade = adjustBrightness(color, 1.15);
        
        // Create darker shade for bottom and right (shadow edges)
        const darkShade = adjustBrightness(color, 0.7);
        const mediumDarkShade = adjustBrightness(color, 0.85);
        
        topColor = lightShade;
        leftColor = mediumLightShade;
        bottomColor = darkShade;
        rightColor = mediumDarkShade;
    }

    positions.forEach(([x, y]) => {
        const px = x * blockSize;
        const py = y * blockSize;

        // Round y for adjacency checks to match posSet keys (handles fractional positions)
        const ry = Math.round(y);
        const T = posSet.has(`${x},${ry-1}`);
        const B = posSet.has(`${x},${ry+1}`);
        const L = posSet.has(`${x-1},${ry}`);
        const R = posSet.has(`${x+1},${ry}`);
        const TL = posSet.has(`${x-1},${ry-1}`);
        const TR = posSet.has(`${x+1},${ry-1}`);
        const BL = posSet.has(`${x-1},${ry+1}`);
        const BR = posSet.has(`${x+1},${ry+1}`);

        // Draw main face with optional transparency
        // Multiply faceOpacity with the current globalAlpha (for fade effects)
        const currentAlpha = ctx.globalAlpha;
        ctx.globalAlpha = currentAlpha * faceOpacity;
        ctx.fillStyle = color;
        ctx.fillRect(px, py, blockSize, blockSize);
        ctx.globalAlpha = currentAlpha; // Restore to parent's alpha

        // Draw edges with gradients for depth
        // IMPORTANT: Edge rectangles only exclude corner areas when those corners will be drawn
        // This prevents both gaps (when corners aren't drawn) and overlaps (when they are)
        if (!T) {
            // Top edge - only exclude corners if they'll actually be drawn
            const topGradient = ctx.createLinearGradient(px, py, px, py + b);
            topGradient.addColorStop(0, topColor);
            topGradient.addColorStop(1, adjustBrightness(topColor, 0.85));
            ctx.fillStyle = topGradient;
            // Adjust start and width based on whether corner triangles will be drawn
            const leftCornerExists = !L;  // Top-left outer corner exists if left edge is exposed
            const rightCornerExists = !R; // Top-right outer corner exists if right edge is exposed
            const startX = leftCornerExists ? px + b : px;
            const width = blockSize - (leftCornerExists ? b : 0) - (rightCornerExists ? b : 0);
            ctx.fillRect(startX, py, width, b);
        }
        if (!L) {
            // Left edge - only exclude corners if they'll actually be drawn
            const leftGradient = ctx.createLinearGradient(px, py, px + b, py);
            leftGradient.addColorStop(0, leftColor);
            leftGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = leftGradient;
            const topCornerExists = !T;    // Top-left outer corner exists if top edge is exposed
            const bottomCornerExists = !B; // Bottom-left outer corner exists if bottom edge is exposed
            const startY = topCornerExists ? py + b : py;
            const height = blockSize - (topCornerExists ? b : 0) - (bottomCornerExists ? b : 0);
            ctx.fillRect(px, startY, b, height);
        }
        if (!B) {
            // Bottom edge - only exclude corners if they'll actually be drawn
            const bottomGradient = ctx.createLinearGradient(px, py + blockSize - b, px, py + blockSize);
            bottomGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
            bottomGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = bottomGradient;
            const leftCornerExists = !L;  // Bottom-left outer corner exists if left edge is exposed
            const rightCornerExists = !R; // Bottom-right outer corner exists if right edge is exposed
            const startX = leftCornerExists ? px + b : px;
            const width = blockSize - (leftCornerExists ? b : 0) - (rightCornerExists ? b : 0);
            ctx.fillRect(startX, py + blockSize - b, width, b);
        }
        if (!R) {
            // Right edge - only exclude corners if they'll actually be drawn
            const rightGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize, py);
            rightGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
            rightGradient.addColorStop(1, rightColor);
            ctx.fillStyle = rightGradient;
            const topCornerExists = !T;    // Top-right outer corner exists if top edge is exposed
            const bottomCornerExists = !B; // Bottom-right outer corner exists if bottom edge is exposed
            const startY = topCornerExists ? py + b : py;
            const height = blockSize - (topCornerExists ? b : 0) - (bottomCornerExists ? b : 0);
            ctx.fillRect(px + blockSize - b, startY, b, height);
        }

        // Outer corners - two triangles, one for each edge (with gradients)
        if (!T && !L) {
            // Top side triangle - matches top edge gradient exactly
            const topCornerGradient = ctx.createLinearGradient(px, py, px, py + b);
            topCornerGradient.addColorStop(0, topColor);
            topCornerGradient.addColorStop(1, adjustBrightness(topColor, 0.85));
            ctx.fillStyle = topCornerGradient;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + b, py);
            ctx.lineTo(px + b, py + b);
            ctx.closePath();
            ctx.fill();
            // Left side triangle - matches left edge gradient exactly
            const leftCornerGradient = ctx.createLinearGradient(px, py, px + b, py);
            leftCornerGradient.addColorStop(0, leftColor);
            leftCornerGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = leftCornerGradient;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px, py + b);
            ctx.lineTo(px + b, py + b);
            ctx.closePath();
            ctx.fill();
        }
        if (!T && !R) {
            // Top side triangle - matches top edge gradient exactly
            const topRightCornerGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize - b, py + b);
            topRightCornerGradient.addColorStop(0, topColor);
            topRightCornerGradient.addColorStop(1, adjustBrightness(topColor, 0.85));
            ctx.fillStyle = topRightCornerGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py);
            ctx.lineTo(px + blockSize - b, py);
            ctx.lineTo(px + blockSize - b, py + b);
            ctx.closePath();
            ctx.fill();
            // Right side triangle - matches right edge gradient exactly
            const rightCornerGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize, py);
            rightCornerGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
            rightCornerGradient.addColorStop(1, rightColor);
            ctx.fillStyle = rightCornerGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py);
            ctx.lineTo(px + blockSize, py + b);
            ctx.lineTo(px + blockSize - b, py + b);
            ctx.closePath();
            ctx.fill();
        }
        if (!B && !L) {
            // Left side triangle - matches left edge gradient exactly
            const leftBottomGradient = ctx.createLinearGradient(px, py + blockSize - b, px + b, py + blockSize - b);
            leftBottomGradient.addColorStop(0, leftColor);
            leftBottomGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = leftBottomGradient;
            ctx.beginPath();
            ctx.moveTo(px, py + blockSize);
            ctx.lineTo(px, py + blockSize - b);
            ctx.lineTo(px + b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
            // Bottom side triangle - matches bottom edge gradient exactly
            const bottomLeftGradient = ctx.createLinearGradient(px, py + blockSize - b, px, py + blockSize);
            bottomLeftGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
            bottomLeftGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = bottomLeftGradient;
            ctx.beginPath();
            ctx.moveTo(px, py + blockSize);
            ctx.lineTo(px + b, py + blockSize);
            ctx.lineTo(px + b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
        }
        if (!B && !R) {
            // Bottom side triangle - matches bottom edge gradient exactly
            const bottomRightGradient = ctx.createLinearGradient(px + blockSize - b, py + blockSize - b, px + blockSize - b, py + blockSize);
            bottomRightGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
            bottomRightGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = bottomRightGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py + blockSize);
            ctx.lineTo(px + blockSize - b, py + blockSize);
            ctx.lineTo(px + blockSize - b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
            // Right side triangle - matches right edge gradient exactly
            const rightBottomGradient = ctx.createLinearGradient(px + blockSize - b, py + blockSize - b, px + blockSize, py + blockSize - b);
            rightBottomGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
            rightBottomGradient.addColorStop(1, rightColor);
            ctx.fillStyle = rightBottomGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py + blockSize);
            ctx.lineTo(px + blockSize, py + blockSize - b);
            ctx.lineTo(px + blockSize - b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
        }

        // Inner corners - TWO triangles meeting at 45 degrees with edge colors and gradients
        if (T && L && !TL) {
            // Left-facing triangle - matches left edge gradient exactly  
            const innerLeftGradient = ctx.createLinearGradient(px, py, px + b, py);
            innerLeftGradient.addColorStop(0, leftColor);
            innerLeftGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = innerLeftGradient;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + b, py);
            ctx.lineTo(px + b, py + b);
            ctx.closePath();
            ctx.fill();
            
            // Top-facing triangle - matches top edge gradient exactly
            const innerTopGradient = ctx.createLinearGradient(px, py, px, py + b);
            innerTopGradient.addColorStop(0, topColor);
            innerTopGradient.addColorStop(1, adjustBrightness(topColor, 0.85));
            ctx.fillStyle = innerTopGradient;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px, py + b);
            ctx.lineTo(px + b, py + b);
            ctx.closePath();
            ctx.fill();
        }
        if (T && R && !TR) {
            // Right-facing triangle - matches right edge gradient exactly
            const innerRightGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize, py);
            innerRightGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
            innerRightGradient.addColorStop(1, rightColor);
            ctx.fillStyle = innerRightGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py);
            ctx.lineTo(px + blockSize - b, py);
            ctx.lineTo(px + blockSize - b, py + b);
            ctx.closePath();
            ctx.fill();
            
            // Top-facing triangle - matches top edge gradient exactly
            const innerTopRightGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize - b, py + b);
            innerTopRightGradient.addColorStop(0, topColor);
            innerTopRightGradient.addColorStop(1, adjustBrightness(topColor, 0.85));
            ctx.fillStyle = innerTopRightGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py);
            ctx.lineTo(px + blockSize, py + b);
            ctx.lineTo(px + blockSize - b, py + b);
            ctx.closePath();
            ctx.fill();
        }
        if (B && L && !BL) {
            // Bottom-facing triangle - matches bottom edge gradient exactly
            const innerBottomLeftGradient = ctx.createLinearGradient(px, py + blockSize - b, px, py + blockSize);
            innerBottomLeftGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
            innerBottomLeftGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = innerBottomLeftGradient;
            ctx.beginPath();
            ctx.moveTo(px, py + blockSize);
            ctx.lineTo(px, py + blockSize - b);
            ctx.lineTo(px + b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
            
            // Left-facing triangle - matches left edge gradient exactly
            const innerLeftBottomGradient = ctx.createLinearGradient(px, py + blockSize - b, px + b, py + blockSize - b);
            innerLeftBottomGradient.addColorStop(0, leftColor);
            innerLeftBottomGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = innerLeftBottomGradient;
            ctx.beginPath();
            ctx.moveTo(px, py + blockSize);
            ctx.lineTo(px + b, py + blockSize);
            ctx.lineTo(px + b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
        }
        if (B && R && !BR) {
            // Bottom-facing triangle - matches bottom edge gradient exactly
            const innerBottomRightGradient = ctx.createLinearGradient(px + blockSize - b, py + blockSize - b, px + blockSize - b, py + blockSize);
            innerBottomRightGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
            innerBottomRightGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = innerBottomRightGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py + blockSize);
            ctx.lineTo(px + blockSize, py + blockSize - b);
            ctx.lineTo(px + blockSize - b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
            
            // Right-facing triangle - matches right edge gradient exactly
            const innerRightBottomGradient = ctx.createLinearGradient(px + blockSize - b, py + blockSize - b, px + blockSize, py + blockSize - b);
            innerRightBottomGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
            innerRightBottomGradient.addColorStop(1, rightColor);
            ctx.fillStyle = innerRightBottomGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py + blockSize);
            ctx.lineTo(px + blockSize - b, py + blockSize);
            ctx.lineTo(px + blockSize - b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
        }
    });

    ctx.restore();
}

function findBlob(x, y, color, visited = new Set()) {
    const key = `${x},${y}`;
    if (visited.has(key) || x < 0 || x >= COLS || y < 0 || y >= ROWS) return [];
    if (!board[y][x] || board[y][x] !== color) return [];

    visited.add(key);
    let blob = [[x, y]];

    blob = blob.concat(findBlob(x + 1, y, color, visited));
    blob = blob.concat(findBlob(x - 1, y, color, visited));
    blob = blob.concat(findBlob(x, y + 1, color, visited));
    blob = blob.concat(findBlob(x, y - 1, color, visited));

    return blob;
}

function getAllBlobs() {
    // Validate board exists and is properly initialized
    if (!board || !Array.isArray(board) || board.length === 0) {
        return [];
    }
    
    const visited = new Set();
    const blobs = [];

    for (let y = 0; y < ROWS; y++) {
        // Validate this row exists
        if (!board[y] || !Array.isArray(board[y])) continue;
        
        for (let x = 0; x < COLS; x++) {
            const key = `${x},${y}`;
            if (!visited.has(key) && board[y][x]) {
                const blob = findBlob(x, y, board[y][x], visited);
                if (blob.length > 0) {
                    blobs.push({ positions: blob, color: board[y][x] });
                }
            }
        }
    }

    return blobs;
}

function detectBlackHoles(blobs) {
    // Returns array of {outerBlob, innerBlob} pairs where outer envelops inner
    const blackHoles = [];
    
    for (let i = 0; i < blobs.length; i++) {
        for (let j = 0; j < blobs.length; j++) {
            if (i === j) continue;
            
            const outer = blobs[i];
            const inner = blobs[j];
            
            // Check if inner blob is completely surrounded by outer blob
            if (isBlobEnveloped(inner, outer)) {
                blackHoles.push({
                    outerBlob: outer,
                    innerBlob: inner
                });
            }
        }
    }
    
    return blackHoles;
}

function isBlobEnveloped(innerBlob, outerBlob) {
    // Create a set of outer blob positions for fast lookup
    const outerSet = new Set(outerBlob.positions.map(p => `${p[0]},${p[1]}`));
    const innerSet = new Set(innerBlob.positions.map(p => `${p[0]},${p[1]}`));
    
    // For each block in inner blob, check if ALL 8 adjacent positions (including diagonals)
    // are either part of outer blob OR part of inner blob
    // If ANY adjacent is out of bounds OR empty space, it's NOT enveloped
    for (const [x, y] of innerBlob.positions) {
        const adjacents = [
            [x-1, y],     // left
            [x+1, y],     // right
            [x, y-1],     // top
            [x, y+1],     // bottom
            [x-1, y-1],   // top-left corner
            [x+1, y-1],   // top-right corner
            [x-1, y+1],   // bottom-left corner
            [x+1, y+1]    // bottom-right corner
        ];
        
        for (const [ax, ay] of adjacents) {
            const key = `${ax},${ay}`;
            
            // If adjacent position is OUT OF BOUNDS, inner blob is NOT enveloped
            // (it's touching a wall/edge)
            if (ax < 0 || ax >= COLS || ay < 0 || ay >= ROWS) {
                return false;
            }
            
            // Adjacent is in bounds - check if it's part of outer or inner blob
            const isOuter = outerSet.has(key);
            const isInner = innerSet.has(key);
            
            // If it's neither outer nor inner, then inner is NOT enveloped
            if (!isOuter && !isInner) {
                return false;
            }
        }
    }
    
    // All adjacent cells (including diagonals) are either outer blob or inner blob, 
    // and none touch the walls - it's truly enveloped!
    return true;
}

function drawCanvasBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!minimalistMode) {
        ctx.fillStyle = 'rgba(30, 60, 120, 0.25)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawBoard() {
    // Fully clear the canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Then draw the background (matching CSS background transparency) - skip in minimalist mode
    if (!minimalistMode) {
        ctx.fillStyle = 'rgba(30, 60, 120, 0.25)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Draw storm particles BEFORE blocks (behind gameplay)
    StormEffects.draw();
    
    // If game is paused, skip drawing the stack (but still draw background effects above)
    if (paused) {
        return;
    }
    
    // Draw black hole vortex BEHIND the blocks
    if (blackHoleActive && blackHoleInnerBlob) {
        const centerPixelX = blackHoleCenterX * BLOCK_SIZE + BLOCK_SIZE / 2;
        const centerPixelY = blackHoleCenterY * BLOCK_SIZE + BLOCK_SIZE / 2;
        
        const elapsed = Date.now() - blackHoleStartTime;
        const pulse = Math.sin(elapsed / 200) * 0.15 + 0.85; // Pulsating effect
        
        // Calculate bounds of inner blob to determine vortex size
        const innerXs = blackHoleInnerBlob.positions.map(p => p[0]);
        const innerYs = blackHoleInnerBlob.positions.map(p => p[1]);
        const minX = Math.min(...innerXs);
        const maxX = Math.max(...innerXs);
        const minY = Math.min(...innerYs);
        const maxY = Math.max(...innerYs);
        const blobWidth = (maxX - minX + 1) * BLOCK_SIZE;
        const blobHeight = (maxY - minY + 1) * BLOCK_SIZE;
        const maxRadius = Math.max(blobWidth, blobHeight) * 0.8;
        
        ctx.save();
        
        // Draw large radial gradient vortex (behind blocks)
        const gradient = ctx.createRadialGradient(
            centerPixelX, centerPixelY, 0,
            centerPixelX, centerPixelY, maxRadius
        );
        gradient.addColorStop(0, '#000000');      // Pure black center
        gradient.addColorStop(0.3, '#0a0010');    // Very dark purple
        gradient.addColorStop(0.5, '#1a0033');    // Dark purple
        gradient.addColorStop(0.7, '#4b0082');    // Indigo
        gradient.addColorStop(0.85, '#8b00ff');   // Bright purple
        gradient.addColorStop(1, 'rgba(139, 0, 255, 0)'); // Transparent purple edge
        
        ctx.fillStyle = gradient;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(centerPixelX, centerPixelY, maxRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Add rotating swirl effect
        const swirl = (elapsed / 100) % (Math.PI * 2);
        ctx.globalAlpha = 0.4 * pulse;
        ctx.strokeStyle = '#8b00ff';
        ctx.lineWidth = 3;
        
        // Draw multiple spiral arms
        for (let arm = 0; arm < 3; arm++) {
            ctx.beginPath();
            const armOffset = (Math.PI * 2 / 3) * arm;
            for (let i = 0; i < 50; i++) {
                const progress = i / 50;
                const angle = swirl + armOffset + progress * Math.PI * 4;
                const radius = progress * maxRadius * 0.7;
                const x = centerPixelX + Math.cos(angle) * radius;
                const y = centerPixelY + Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        // Add inner glow ring
        ctx.globalAlpha = 0.6 * pulse;
        ctx.strokeStyle = '#4b0082';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(centerPixelX, centerPixelY, maxRadius * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }

    // Create a set of falling block positions to skip during board rendering
    const fallingBlockSet = new Set();
    if (gravityAnimating) {
        // During gravity animation, skip target positions (blocks cleared from board already)
        fallingBlocks.forEach(fb => {
            fallingBlockSet.add(`${fb.x},${fb.targetY}`);
        });
    }

    const blobs = getAllBlobs();
    
    // Apply phantom mode opacity to the stack (not the current piece)
    const isPhantomMode = challengeMode === 'phantom' || activeChallenges.has('phantom');
    if (isPhantomMode && window.ChallengeEffects && ChallengeEffects.Phantom) {
        ctx.save();
        ctx.globalAlpha = ChallengeEffects.Phantom.getOpacity();
    }
    
    blobs.forEach(blob => {
        // Validate blob has positions array with valid entries
        if (!blob || !blob.positions || !Array.isArray(blob.positions) || blob.positions.length === 0) {
            return;
        }
        
        // Additional validation: ensure all positions are valid arrays
        let validPositions = blob.positions.filter(p => Array.isArray(p) && p.length >= 2);
        if (validPositions.length === 0) {
            return;
        }
        
        // Filter out positions that are being animated (gravity or line clear)
        if (fallingBlockSet.size > 0) {
            validPositions = validPositions.filter(p => !fallingBlockSet.has(`${p[0]},${p[1]}`));
            if (validPositions.length === 0) {
                return;
            }
        }
        
        // Separate gremlin-placed blocks, lattice blocks, and normal blocks
        const randomBlockPositions = [];
        const latticeBlockPositions = [];
        const normalBlockPositions = [];
        
        validPositions.forEach(([x, y]) => {
            if (isRandomBlock[y] && isRandomBlock[y][x]) {
                randomBlockPositions.push([x, y]);
            } else if (isLatticeBlock[y] && isLatticeBlock[y][x]) {
                latticeBlockPositions.push([x, y]);
            } else {
                normalBlockPositions.push([x, y]);
            }
        });
        
        // Check if any blocks in this blob are fading - find minimum opacity and collect fading blocks
        let minFadeOpacity = 1.0;
        const fadingBlocksInBlob = [];
        for (const pos of validPositions) {
            const [x, y] = pos;
            const fade = fadingBlocks[y] && fadingBlocks[y][x];
            if (fade && fade.opacity < 1) {
                minFadeOpacity = Math.min(minFadeOpacity, fade.opacity);
                fadingBlocksInBlob.push({ x, y, fade });
            }
        }
        
        // Check if blob spans from left edge (x=0) to right edge (x=COLS-1)
        const minX = Math.min(...validPositions.map(p => p[0]));
        const maxX = Math.max(...validPositions.map(p => p[0]));
        // Only show gold tsunami edges in Tempest/Maelstrom modes
        const spansWidth = (minX === 0 && maxX === COLS - 1) && skillLevel !== 'breeze';
        
        if (spansWidth) {
            console.log(`🌊 TSUNAMI BLOB DETECTED! minX=${minX}, maxX=${maxX}, COLS=${COLS}, color=${blob.color}, size=${validPositions.length}`);
        }
        
        // Note: Gold border is drawn for spanning blobs, but actual tsunami
        // triggering is handled by checkForSpecialFormations()
        
        // If there are fading blocks, we need to handle them specially to avoid overlap artifacts
        if (fadingBlocksInBlob.length > 0) {
            // Draw non-fading normal blocks first
            const nonFadingNormalPositions = normalBlockPositions.filter(p => {
                const [x, y] = p;
                const fade = fadingBlocks[y] && fadingBlocks[y][x];
                return !fade || fade.opacity >= 1;
            });
            if (nonFadingNormalPositions.length > 0) {
                const displayColor = getDisplayColorForBlob(blob);
                
                // Check if any of these blocks are being removed by gremlins
                const gremlinAffectedBlocks = [];
                const normalGremlinBlocks = [];
                
                nonFadingNormalPositions.forEach(([x, y]) => {
                    const gremlin = window.ChallengeEffects && ChallengeEffects.Gremlins ? ChallengeEffects.Gremlins.getFadingAt(x, y) : null;
                    if (gremlin && gremlin.delay === 0) {
                        gremlinAffectedBlocks.push({ pos: [x, y], opacity: gremlin.opacity });
                    } else {
                        normalGremlinBlocks.push([x, y]);
                    }
                });
                
                // Draw normal blocks (not affected by gremlins)
                if (normalGremlinBlocks.length > 0) {
                    drawSolidShape(ctx, normalGremlinBlocks, displayColor, BLOCK_SIZE, spansWidth, getFaceOpacity(), false);
                }
                
                // Draw gremlin-affected blocks with fading opacity
                gremlinAffectedBlocks.forEach(({ pos, opacity }) => {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    drawSolidShape(ctx, [pos], displayColor, BLOCK_SIZE, spansWidth, getFaceOpacity(), false);
                    ctx.restore();
                });
            }
            
            // Draw non-fading gremlin-placed blocks with silver
            const nonFadingRandomPositions = randomBlockPositions.filter(p => {
                const [x, y] = p;
                const fade = fadingBlocks[y] && fadingBlocks[y][x];
                return !fade || fade.opacity >= 1;
            });
            if (nonFadingRandomPositions.length > 0) {
                const displayColor = getDisplayColorForBlob(blob);
                
                // Check if any of these blocks are being removed by gremlins
                const gremlinAffectedRandomBlocks = [];
                const normalRandomBlocks = [];
                
                nonFadingRandomPositions.forEach(([x, y]) => {
                    const gremlin = window.ChallengeEffects && ChallengeEffects.Gremlins ? ChallengeEffects.Gremlins.getFadingAt(x, y) : null;
                    if (gremlin && gremlin.delay === 0) {
                        gremlinAffectedRandomBlocks.push({ pos: [x, y], opacity: gremlin.opacity });
                    } else {
                        normalRandomBlocks.push([x, y]);
                    }
                });
                
                // Draw normal random blocks (not affected by gremlins)
                if (normalRandomBlocks.length > 0) {
                    drawSolidShape(ctx, normalRandomBlocks, displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                }
                
                // Draw gremlin-affected random blocks with fading opacity
                gremlinAffectedRandomBlocks.forEach(({ pos, opacity }) => {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    drawSolidShape(ctx, [pos], displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                    ctx.restore();
                });
            }
            
            // Draw non-fading lattice blocks with silver
            const nonFadingLatticePositions = latticeBlockPositions.filter(p => {
                const [x, y] = p;
                const fade = fadingBlocks[y] && fadingBlocks[y][x];
                return !fade || fade.opacity >= 1;
            });
            if (nonFadingLatticePositions.length > 0) {
                const displayColor = getDisplayColorForBlob(blob);
                
                // Check if any of these blocks are being removed by gremlins
                const gremlinAffectedLatticeBlocks = [];
                const normalLatticeBlocks = [];
                
                nonFadingLatticePositions.forEach(([x, y]) => {
                    const gremlin = window.ChallengeEffects && ChallengeEffects.Gremlins ? ChallengeEffects.Gremlins.getFadingAt(x, y) : null;
                    if (gremlin && gremlin.delay === 0) {
                        gremlinAffectedLatticeBlocks.push({ pos: [x, y], opacity: gremlin.opacity });
                    } else {
                        normalLatticeBlocks.push([x, y]);
                    }
                });
                
                // Draw normal lattice blocks (not affected by gremlins)
                if (normalLatticeBlocks.length > 0) {
                    drawSolidShape(ctx, normalLatticeBlocks, displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                }
                
                // Draw gremlin-affected lattice blocks with fading opacity
                gremlinAffectedLatticeBlocks.forEach(({ pos, opacity }) => {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    drawSolidShape(ctx, [pos], displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                    ctx.restore();
                });
            }
            
            // Group fading blocks by opacity level to draw them as merged shapes (avoids overlap artifacts)
            const fadingBlocksByOpacity = new Map();
            fadingBlocksInBlob.forEach(({x, y, fade}) => {
                // Round opacity to avoid too many groups
                const opacityKey = Math.round(fade.opacity * 20) / 20; // Round to nearest 0.05
                const scaleKey = Math.round(fade.scale * 20) / 20;
                const key = `${opacityKey}_${scaleKey}`;
                
                if (!fadingBlocksByOpacity.has(key)) {
                    fadingBlocksByOpacity.set(key, {
                        opacity: fade.opacity,
                        scale: fade.scale,
                        positions: []
                    });
                }
                fadingBlocksByOpacity.get(key).positions.push([x, y]);
            });
            
            // Draw each group of fading blocks as a single merged shape
            fadingBlocksByOpacity.forEach(group => {
                ctx.save();
                ctx.globalAlpha = group.opacity;
                
                if (Math.abs(group.scale - 1.0) > 0.01) {
                    // Apply scaling for the entire group
                    const centerX = group.positions.reduce((sum, p) => sum + p[0], 0) / group.positions.length;
                    const centerY = group.positions.reduce((sum, p) => sum + p[1], 0) / group.positions.length;
                    const scaleCenterX = (centerX + 0.5) * BLOCK_SIZE;
                    const scaleCenterY = (centerY + 0.5) * BLOCK_SIZE;
                    
                    ctx.translate(scaleCenterX, scaleCenterY);
                    ctx.scale(group.scale, group.scale);
                    ctx.translate(-scaleCenterX, -scaleCenterY);
                }
                
                // Separate positions into normal, random, and lattice blocks
                const normalPositions = [];
                const randomPositions = [];
                const latticePositions = [];
                group.positions.forEach(([x, y]) => {
                    if (isRandomBlock[y] && isRandomBlock[y][x]) {
                        randomPositions.push([x, y]);
                    } else if (isLatticeBlock[y] && isLatticeBlock[y][x]) {
                        latticePositions.push([x, y]);
                    } else {
                        normalPositions.push([x, y]);
                    }
                });
                
                // Draw as merged shapes to avoid overlap artifacts
                const displayColor = getDisplayColorForBlob(blob);
                if (normalPositions.length > 0) {
                    drawSolidShape(ctx, normalPositions, displayColor, BLOCK_SIZE, false, getFaceOpacity(), false);
                }
                if (randomPositions.length > 0) {
                    drawSolidShape(ctx, randomPositions, displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                }
                if (latticePositions.length > 0) {
                    drawSolidShape(ctx, latticePositions, displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                }
                
                ctx.restore();
            });
        } else {
            // No fading blocks
            // Draw normal blocks
            if (normalBlockPositions.length > 0) {
                const displayColor = getDisplayColorForBlob(blob);
                
                // Check if any blocks are being removed by gremlins
                const gremlinAffectedBlocks = [];
                const normalGremlinBlocks = [];
                
                normalBlockPositions.forEach(([x, y]) => {
                    const gremlin = window.ChallengeEffects && ChallengeEffects.Gremlins ? ChallengeEffects.Gremlins.getFadingAt(x, y) : null;
                    if (gremlin && gremlin.delay === 0) {
                        gremlinAffectedBlocks.push({ pos: [x, y], opacity: gremlin.opacity });
                    } else {
                        normalGremlinBlocks.push([x, y]);
                    }
                });
                
                // Draw normal blocks (not affected by gremlins)
                if (normalGremlinBlocks.length > 0) {
                    drawSolidShape(ctx, normalGremlinBlocks, displayColor, BLOCK_SIZE, spansWidth, getFaceOpacity(), false);
                }
                
                // Draw gremlin-affected blocks with fading opacity
                gremlinAffectedBlocks.forEach(({ pos, opacity }) => {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    drawSolidShape(ctx, [pos], displayColor, BLOCK_SIZE, spansWidth, getFaceOpacity(), false);
                    ctx.restore();
                });
            }
            // Draw gremlin-placed blocks with silver
            if (randomBlockPositions.length > 0) {
                const displayColor = getDisplayColorForBlob(blob);
                
                // Check if any blocks are being removed by gremlins
                const gremlinAffectedRandomBlocks = [];
                const normalRandomBlocks = [];
                
                randomBlockPositions.forEach(([x, y]) => {
                    const gremlin = window.ChallengeEffects && ChallengeEffects.Gremlins ? ChallengeEffects.Gremlins.getFadingAt(x, y) : null;
                    if (gremlin && gremlin.delay === 0) {
                        gremlinAffectedRandomBlocks.push({ pos: [x, y], opacity: gremlin.opacity });
                    } else {
                        normalRandomBlocks.push([x, y]);
                    }
                });
                
                // Draw normal random blocks (not affected by gremlins)
                if (normalRandomBlocks.length > 0) {
                    drawSolidShape(ctx, normalRandomBlocks, displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                }
                
                // Draw gremlin-affected random blocks with fading opacity
                gremlinAffectedRandomBlocks.forEach(({ pos, opacity }) => {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    drawSolidShape(ctx, [pos], displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                    ctx.restore();
                });
            }
            // Draw lattice blocks with silver
            if (latticeBlockPositions.length > 0) {
                const displayColor = getDisplayColorForBlob(blob);
                
                // Check if any blocks are being removed by gremlins
                const gremlinAffectedLatticeBlocks = [];
                const normalLatticeBlocks = [];
                
                latticeBlockPositions.forEach(([x, y]) => {
                    const gremlin = window.ChallengeEffects && ChallengeEffects.Gremlins ? ChallengeEffects.Gremlins.getFadingAt(x, y) : null;
                    if (gremlin && gremlin.delay === 0) {
                        gremlinAffectedLatticeBlocks.push({ pos: [x, y], opacity: gremlin.opacity });
                    } else {
                        normalLatticeBlocks.push([x, y]);
                    }
                });
                
                // Draw normal lattice blocks (not affected by gremlins)
                if (normalLatticeBlocks.length > 0) {
                    drawSolidShape(ctx, normalLatticeBlocks, displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                }
                
                // Draw gremlin-affected lattice blocks with fading opacity
                gremlinAffectedLatticeBlocks.forEach(({ pos, opacity }) => {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    drawSolidShape(ctx, [pos], displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                    ctx.restore();
                });
            }
        }
    });
    
    // Restore context if phantom mode was applied
    if (isPhantomMode) {
        ctx.restore();
    }

    // Draw lightning effects
    if (lightningEffects.length > 0) {
        console.log(`🌩️ Drawing ${lightningEffects.length} lightning effects`);
    }
    lightningEffects = lightningEffects.filter(lightning => {
        const elapsed = Date.now() - lightning.startTime;
        const progress = elapsed / lightning.duration;
        
        if (progress >= 1) return false;
        
        console.log(`⚡ Rendering lightning at x=${lightning.x}, segments=${lightning.segments.length}, progress=${progress.toFixed(2)}`);
        
        const baseAlpha = 1 - progress;
        
        // Check if Stranger mode is active for red lightning
        const strangerActive = challengeMode === 'stranger' || activeChallenges.has('stranger');
        const glowColor = strangerActive ? '#FF0000' : '#00FFFF';
        const innerGlowColor = strangerActive ? '#FF8888' : '#88FFFF';
        const coreColor = '#FFFFFF';
        
        // Draw outer glow layers (multiple passes for more intense glow)
        ctx.save();
        
        // Outermost glow - wide and soft
        ctx.globalAlpha = baseAlpha * 0.15;
        ctx.strokeStyle = glowColor;
        ctx.shadowBlur = 60;
        ctx.shadowColor = glowColor;
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.moveTo(lightning.x, 0);
        for (let i = 0; i < lightning.segments.length; i++) {
            ctx.lineTo(lightning.segments[i].x, lightning.segments[i].y);
        }
        ctx.stroke();
        lightning.branches.forEach(branch => {
            ctx.beginPath();
            ctx.moveTo(branch.startX, branch.startY);
            for (let i = 0; i < branch.segments.length; i++) {
                ctx.lineTo(branch.segments[i].x, branch.segments[i].y);
            }
            ctx.stroke();
        });
        
        // Middle glow
        ctx.globalAlpha = baseAlpha * 0.3;
        ctx.shadowBlur = 35;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(lightning.x, 0);
        for (let i = 0; i < lightning.segments.length; i++) {
            ctx.lineTo(lightning.segments[i].x, lightning.segments[i].y);
        }
        ctx.stroke();
        lightning.branches.forEach(branch => {
            ctx.beginPath();
            ctx.moveTo(branch.startX, branch.startY);
            for (let i = 0; i < branch.segments.length; i++) {
                ctx.lineTo(branch.segments[i].x, branch.segments[i].y);
            }
            ctx.stroke();
        });
        
        // Inner glow
        ctx.globalAlpha = baseAlpha * 0.5;
        ctx.strokeStyle = innerGlowColor;
        ctx.shadowBlur = 20;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(lightning.x, 0);
        for (let i = 0; i < lightning.segments.length; i++) {
            ctx.lineTo(lightning.segments[i].x, lightning.segments[i].y);
        }
        ctx.stroke();
        lightning.branches.forEach(branch => {
            ctx.beginPath();
            ctx.moveTo(branch.startX, branch.startY);
            for (let i = 0; i < branch.segments.length; i++) {
                ctx.lineTo(branch.segments[i].x, branch.segments[i].y);
            }
            ctx.stroke();
        });
        
        // Main bolt (bright white core)
        ctx.globalAlpha = baseAlpha;
        ctx.strokeStyle = coreColor;
        ctx.shadowBlur = 15;
        ctx.shadowColor = coreColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(lightning.x, 0);
        for (let i = 0; i < lightning.segments.length; i++) {
            ctx.lineTo(lightning.segments[i].x, lightning.segments[i].y);
        }
        ctx.stroke();
        
        // Branch bolts (thinner white core)
        ctx.lineWidth = 2;
        lightning.branches.forEach(branch => {
            ctx.beginPath();
            ctx.moveTo(branch.startX, branch.startY);
            for (let i = 0; i < branch.segments.length; i++) {
                ctx.lineTo(branch.segments[i].x, branch.segments[i].y);
            }
            ctx.stroke();
        });
        
        ctx.restore();
        
        return true;
    });

    lineAnimations.forEach(anim => {
        anim.cells.forEach(cell => {
            if (!cell.removed) {
                ctx.globalAlpha = cell.alpha;
                drawSolidShape(ctx, [[cell.x, cell.y]], cell.color);
                ctx.globalAlpha = 1;
            }
        });
    });
}

function triggerTsunami(targetY) {
    // Add golden border effect
    canvas.classList.add('tsunami-active');
    
    // Multiple lightning strikes for tsunami! (visual only - no thunder sound)
    const numStrikes = 5 + Math.floor(Math.random() * 3); // 5-7 strikes
    
    for (let i = 0; i < numStrikes; i++) {
        setTimeout(() => {
            triggerLightning(targetY + (Math.random() - 0.5) * 100, false); // false = no sound
        }, i * 150); // Stagger the strikes
    }
    
    // Wet, whooshy wave sound for tsunami
    playTsunamiWhoosh(soundToggle);
    
    // Remove golden border after all strikes complete and a brief delay
    setTimeout(() => {
        canvas.classList.remove('tsunami-active');
    }, numStrikes * 150 + 1000); // After all strikes plus 1 second
}

function triggerLightning(targetY, playSound = true) {
    // Find the actual top of the stack (highest row with any blocks)
    let stackTopY = ROWS * BLOCK_SIZE; // Default to bottom if no blocks
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y] && board[y][x]) {
                stackTopY = y * BLOCK_SIZE;
                break;
            }
        }
        if (stackTopY < ROWS * BLOCK_SIZE) break;
    }
    
    // Lightning should reach at least to the stack top, or the provided targetY, whichever is lower on screen
    const effectiveTargetY = Math.max(stackTopY, Math.min(targetY, ROWS * BLOCK_SIZE));
    
    console.log(`⚡🌩️ triggerLightning called! targetY=${targetY}, stackTopY=${stackTopY}, effectiveTargetY=${effectiveTargetY}`);
    
    // Single lightning strike (used for Strike bonus and as part of Tsunami)
    const centerX = canvas.width / 2 + (Math.random() - 0.5) * 150; // More horizontal spread
    const segments = [];
    let currentX = centerX;
    let currentY = 0;
    
    // Create jagged main lightning path - more dramatic with more segments
    while (currentY < effectiveTargetY) {
        currentY += 15 + Math.random() * 25; // Smaller steps = more jagged
        currentX += (Math.random() - 0.5) * 60; // More horizontal variation
        currentX = Math.max(20, Math.min(canvas.width - 20, currentX));
        segments.push({ x: currentX, y: Math.min(currentY, effectiveTargetY) });
    }
    
    // Create branch bolts - more of them for drama
    const branches = [];
    const numBranches = 4 + Math.floor(Math.random() * 4); // 4-7 branches
    
    for (let b = 0; b < numBranches; b++) {
        // Pick a random point on the main bolt to branch from
        const branchPoint = Math.floor(Math.random() * (segments.length - 2)) + 1;
        const startX = segments[branchPoint].x;
        const startY = segments[branchPoint].y;
        
        const branchSegments = [];
        let branchX = startX;
        let branchY = startY;
        const branchLength = 60 + Math.random() * 120; // Longer branches
        const branchDirection = (Math.random() > 0.5) ? 1 : -1; // Left or right
        
        while (branchY < startY + branchLength && branchY < canvas.height) {
            branchY += 12 + Math.random() * 20;
            branchX += branchDirection * (8 + Math.random() * 25);
            branchX = Math.max(10, Math.min(canvas.width - 10, branchX));
            branchSegments.push({ x: branchX, y: branchY });
        }
        
        branches.push({
            startX: startX,
            startY: startY,
            segments: branchSegments
        });
    }
    
    const lightningObj = {
        x: centerX,
        targetY: effectiveTargetY,
        segments: segments,
        branches: branches,
        startTime: Date.now(),
        duration: 600 // Slightly longer duration
    };
    
    lightningEffects.push(lightningObj);
    console.log(`⚡ Lightning object created and added to array. Array length: ${lightningEffects.length}, segments: ${segments.length}, branches: ${branches.length}`);
    
    // Play dramatic thunder crack (optional - disabled for tsunami visual-only lightning)
    if (playSound) {
        playEnhancedThunder(soundToggle);
    }
}

function drawPiece(piece, context = ctx, offsetX = 0, offsetY = 0, pixelOffsetY = 0) {
    if (!piece || !piece.shape || piece.shape.length === 0) return;
    
    const positions = [];
    piece.shape.forEach((row, y) => {
        if (row) {
            row.forEach((value, x) => {
                if (value) {
                    // Use fractional Y position for smooth rendering
                    const yPos = piece.y + y + offsetY + (pixelOffsetY / BLOCK_SIZE);
                    positions.push([piece.x + x + offsetX, yPos]);
                }
            });
        }
    });
    
    // Check if Oz mode is active (grayscale until landing)
    const isOzMode = challengeMode === 'oz' || activeChallenges.has('oz');
    const displayColor = (isOzMode && window.ChallengeEffects && ChallengeEffects.Oz) ? ChallengeEffects.Oz.toGrayscale(piece.color) : piece.color;
    
    drawSolidShape(context, positions, displayColor, BLOCK_SIZE, false, getFaceOpacity());
}

// Oz mode: grayscale conversion managed by challenge_oz.js (ChallengeEffects.Oz)

function drawNextPiece() {
    // Save and restore image smoothing state
    const wasSmoothing = nextCtx.imageSmoothingEnabled;
    nextCtx.imageSmoothingEnabled = false;
    
    // Fully clear the canvas first
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    // The visible area is the lower-left portion (responsive size)
    const visibleWidth = nextDisplayBaseSize;
    const visibleHeight = nextDisplayBaseSize;
    const visibleX = 0;
    const visibleY = nextCanvas.height - visibleHeight;
    
    // No background fill needed - wrapper provides the background

    // Draw pieces from back to front (furthest first, so closest renders on top)
    for (let i = nextPieceQueue.length - 1; i >= 0; i--) {
        const piece = nextPieceQueue[i];
        if (!piece || !piece.shape || piece.shape.length === 0 || !piece.shape[0]) continue;
        
        // Calculate scale based on position in queue (1.0 for first, smaller for others)
        // Pieces get progressively smaller as they go back
        const scale = 1.0 - (i * 0.22); // 1.0, 0.82, 0.64, 0.46
        
        // Calculate offset - pieces move up and to the right as they go back
        // Different right shift percentages for each piece position
        const rightShiftPercents = [0, 0.6, 0.46, 0.32]; // #1 stays put, #2=60%, #3=46%, #4=32%
        const cumulativeRightShift = rightShiftPercents.slice(0, i + 1).reduce((sum, p) => sum + p, 0);
        const offsetX = cumulativeRightShift * visibleWidth;  // Shift right
        const offsetY = -i * visibleHeight * 0.32; // Shift up
        
        // Calculate opacity - pieces fade as they go back
        const opacity = 1.0 - (i * 0.15); // 1.0, 0.85, 0.70, 0.55
        
        // Calculate the actual size of the piece in blocks
        const pieceWidth = piece.shape[0].length;
        const pieceHeight = piece.shape.length;
        
        // For giant pieces (6-7 segments), scale down to fit
        const isGiantPiece = piece.type && piece.type.startsWith('giant');
        const gridSize = isGiantPiece ? 7 : 5;
        
        // Calculate block size based on VISIBLE area size, grid, and perspective scale
        const baseBlockSize = Math.floor(Math.min(visibleWidth, visibleHeight) / gridSize);
        const nextBlockSize = Math.floor(baseBlockSize * scale);
        
        // Calculate the total pixel size of the piece
        const pieceTotalWidth = pieceWidth * nextBlockSize;
        const pieceTotalHeight = pieceHeight * nextBlockSize;
        
        // Position first piece centered in visible area (lower-left of canvas)
        // Others offset up and to the right from there
        const baseCenterX = visibleX + (visibleWidth - pieceWidth * baseBlockSize) / 2;
        const baseCenterY = visibleY + (visibleHeight - pieceHeight * baseBlockSize) / 2;
        
        const pixelOffsetX = Math.floor(baseCenterX + offsetX + (pieceWidth * baseBlockSize - pieceTotalWidth) / 2);
        const pixelOffsetY = Math.floor(baseCenterY + offsetY + (pieceHeight * baseBlockSize - pieceTotalHeight) / 2);
        
        // Save context state and translate to position the piece
        nextCtx.save();
        nextCtx.globalAlpha = opacity;
        nextCtx.translate(pixelOffsetX, pixelOffsetY);
        
        // Collect all positions for the piece
        const positions = [];
        piece.shape.forEach((row, y) => {
            if (row) {
                row.forEach((value, x) => {
                    if (value) {
                        positions.push([x, y]);
                    }
                });
            }
        });
        
        // Draw as a single connected shape
        drawSolidShape(nextCtx, positions, piece.color, nextBlockSize, false, getFaceOpacity() * opacity);
        
        // Restore context state
        nextCtx.restore();
    }
    
    // Restore smoothing state
    nextCtx.imageSmoothingEnabled = wasSmoothing;
}

// Draw cascade bonus notification in the upper third of the well
function drawCascadeBonus() {
    if (!cascadeBonusDisplay) return;
    
    const elapsed = Date.now() - cascadeBonusDisplay.startTime;
    if (elapsed > cascadeBonusDisplay.duration) {
        cascadeBonusDisplay = null;
        return;
    }
    
    // Fade in quickly, hold, then fade out
    const fadeInTime = 200;
    const fadeOutTime = 400;
    const holdTime = cascadeBonusDisplay.duration - fadeInTime - fadeOutTime;
    
    let alpha;
    if (elapsed < fadeInTime) {
        alpha = elapsed / fadeInTime;
    } else if (elapsed < fadeInTime + holdTime) {
        alpha = 1;
    } else {
        alpha = 1 - (elapsed - fadeInTime - holdTime) / fadeOutTime;
    }
    
    // Scale animation - pop in effect
    let scale = 1;
    if (elapsed < fadeInTime) {
        scale = 0.5 + 0.6 * (elapsed / fadeInTime); // Start at 0.5, overshoot to 1.1
        if (scale > 1) scale = 1 + (1.1 - scale) * 0.5; // Bounce back
    }
    
    ctx.save();
    ctx.globalAlpha = alpha;
    
    // Position in upper third of the well
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 6; // Upper third
    
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    
    // Draw glowing text - size scales with canvas width, increases with multiplier
    const text = cascadeBonusDisplay.text;
    const canvasW = canvas.width;
    const baseSize = Math.max(12, Math.min(24, canvasW / 15));
    const sizeIncrease = Math.max(0, 2 * (cascadeBonusDisplay.multiplier - 2));
    const fontSize = baseSize + sizeIncrease;
    ctx.font = `bold ${fontSize}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Glow effect
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FFD700';
    ctx.fillText(text, 0, 0);
    
    // Brighter inner text
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, 0, 0);
    
    ctx.restore();
}

// Trigger cascade bonus display
function showCascadeBonus(multiplier) {
    cascadeBonusDisplay = {
        text: I18n.t('misc.cascadeBonus', { multiplier: multiplier }),
        multiplier: multiplier,
        startTime: Date.now(),
        duration: 1500
    };
    console.log(`🔥 Cascade Bonus x${multiplier}!`);
    
    // Play LineClear sound effect 'multiplier' times in succession
    // Start with a small delay, then space them out for clear distinction
    for (let i = 0; i < multiplier; i++) {
        setTimeout(() => {
            playSoundEffect('line', soundToggle);
        }, 50 + i * 200); // Start at 50ms, then 200ms apart
    }
}

// Trigger super event bonus display (Supermassive Black Hole or Supervolcano)
function showSuperEventBonus(type) {
    const text = type === 'supermassiveBlackHole' 
        ? I18n.t('misc.supermassiveBlackHole')
        : I18n.t('misc.superVolcano');
    cascadeBonusDisplay = {
        text: text,
        multiplier: 2,
        startTime: Date.now(),
        duration: 2000
    };
    console.log(`🔥 ${text}!`);
    
    // Play two LineClear sounds for the x2
    playSoundEffect('line', soundToggle);
    setTimeout(() => playSoundEffect('line', soundToggle), 200);
}


function collides(piece, offsetX = 0, offsetY = 0) {
    if (!piece || !piece.shape) return true;
    
    return piece.shape.some((row, y) => {
        return row.some((value, x) => {
            if (value) {
                const newX = piece.x + x + offsetX;
                const newY = piece.y + y + offsetY;
                return newX < 0 || newX >= COLS || newY >= ROWS ||
                       (newY >= 0 && board[newY][newX]);
            }
            return false;
        });
    });
}

function getShadowYPosition(piece) {
    if (!piece || !piece.shape) return piece.y;
    
    let shadowY = piece.y;
    // Keep moving down until we hit something
    while (!collides(piece, 0, shadowY - piece.y + 1)) {
        shadowY++;
    }
    return shadowY;
}

function drawShadowPiece(piece) {
    if (!piece || !piece.shape || piece.shape.length === 0) return;
    
    // Check for shadowless challenge mode - shadow is standard, only hide if shadowless active
    const isShadowless = challengeMode === 'shadowless' || activeChallenges.has('shadowless');
    if (isShadowless) return;
    
    const shadowY = getShadowYPosition(piece);
    
    // Don't draw shadow if it's in the same position as the current piece
    if (shadowY === piece.y) return;
    
    // Draw simple solid shadow blocks with very low opacity
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#FFFFFF';
    
    piece.shape.forEach((row, y) => {
        if (row) {
            row.forEach((value, x) => {
                if (value) {
                    const px = (piece.x + x) * BLOCK_SIZE;
                    const py = (shadowY + y) * BLOCK_SIZE;
                    ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
                }
            });
        }
    });
    
    // Draw border only on outer edges with slightly higher opacity (lighter gray)
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    
    piece.shape.forEach((row, y) => {
        if (row) {
            row.forEach((value, x) => {
                if (value) {
                    const px = (piece.x + x) * BLOCK_SIZE;
                    const py = (shadowY + y) * BLOCK_SIZE;
                    
                    // Check adjacent blocks to determine outer edges
                    const hasTop = y > 0 && row && piece.shape[y-1] && piece.shape[y-1][x];
                    const hasBottom = y < piece.shape.length - 1 && piece.shape[y+1] && piece.shape[y+1][x];
                    const hasLeft = x > 0 && row[x-1];
                    const hasRight = x < row.length - 1 && row[x+1];
                    
                    // Draw only outer edges
                    ctx.beginPath();
                    if (!hasTop) {
                        ctx.moveTo(px, py);
                        ctx.lineTo(px + BLOCK_SIZE, py);
                    }
                    if (!hasBottom) {
                        ctx.moveTo(px, py + BLOCK_SIZE);
                        ctx.lineTo(px + BLOCK_SIZE, py + BLOCK_SIZE);
                    }
                    if (!hasLeft) {
                        ctx.moveTo(px, py);
                        ctx.lineTo(px, py + BLOCK_SIZE);
                    }
                    if (!hasRight) {
                        ctx.moveTo(px + BLOCK_SIZE, py);
                        ctx.lineTo(px + BLOCK_SIZE, py + BLOCK_SIZE);
                    }
                    ctx.stroke();
                }
            });
        }
    });
    
    ctx.restore();
}

function mergePiece() {
    if (!currentPiece || !currentPiece.shape) return;
    
    // Reset cascade level for new piece placement
    cascadeLevel = 0;
    
    // Record speed bonus for this piece
    const pieceBonus = calculatePieceSpeedBonus(Date.now());
    recordPieceSpeedBonus(pieceBonus);
    
    // Check for Rubber & Glue mode (either standalone or in combo)
    const isRubberMode = challengeMode === 'rubber' || activeChallenges.has('rubber');
    
    if (isRubberMode) {
        // First check if this placement would trigger special events
        // If so, don't bounce regardless of color touching
        if (wouldTriggerSpecialEvent(currentPiece)) {
            console.log('🎯 Special event detected - piece will stick (no bounce)');
            // Fall through to normal merge
        } else {
            // Check if piece touches any same-colored blob ("glue")
            let touchesSameColor = false;
            currentPiece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        const boardY = currentPiece.y + y;
                        const boardX = currentPiece.x + x;
                        if (boardY >= 0) {
                            // Check adjacent cells for same color
                            const checkPositions = [
                                [boardX - 1, boardY], [boardX + 1, boardY],
                                [boardX, boardY - 1], [boardX, boardY + 1]
                            ];
                            for (let [checkX, checkY] of checkPositions) {
                                if (checkX >= 0 && checkX < COLS && checkY >= 0 && checkY < ROWS) {
                                    if (board[checkY][checkX] === currentPiece.color) {
                                        touchesSameColor = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (touchesSameColor) return;
                });
            });
            
            // If doesn't touch same color and won't trigger events, BOUNCE! ("rubber")
            if (!touchesSameColor) {
                if (window.ChallengeEffects && ChallengeEffects.Rubber) {
                    ChallengeEffects.Rubber.triggerBounce(currentPiece);
                }
                currentPiece = null;
                return; // Don't merge the piece
            }
        }
    }
    
    // Normal merge
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const boardY = currentPiece.y + y;
                const boardX = currentPiece.x + x;
                if (boardY >= 0) {
                    board[boardY][boardX] = currentPiece.color;
                    isRandomBlock[boardY][boardX] = false; // Mark as player-placed
                    isLatticeBlock[boardY][boardX] = false; // Player-placed blocks are not lattice blocks
                }
            }
        });
    });
    
    // Amnesia mode: stamp placement times for newly placed blocks
    const isAmnesiaMode = challengeMode === 'amnesia' || activeChallenges.has('amnesia');
    if (isAmnesiaMode && window.ChallengeEffects) {
        currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    const boardY = currentPiece.y + y;
                    const boardX = currentPiece.x + x;
                    if (boardY >= 0) {
                        ChallengeEffects.Amnesia.stampCell(boardX, boardY);
                    }
                }
            });
        });
    }
    
    // Yes, And... mode: Spawn random limbs after piece lands
    const isYesAndMode = challengeMode === 'yesand' || activeChallenges.has('yesand');
    if (isYesAndMode && window.ChallengeEffects && ChallengeEffects.YesAnd) {
        ChallengeEffects.YesAnd.spawnLimbs(currentPiece);
    } else if (window.ChallengeEffects && ChallengeEffects.YesAnd) {
        ChallengeEffects.YesAnd.clearSpawnFlag();
    }
    
    // Trigger Phantom mode fade (either standalone or in combo)
    const isPhantomMode = challengeMode === 'phantom' || activeChallenges.has('phantom');
    if (isPhantomMode && window.ChallengeEffects && ChallengeEffects.Phantom) {
        ChallengeEffects.Phantom.triggerFade();
    }
}

// ============================================
// CHALLENGE MODE FUNCTIONS
// ============================================

// Yes, And... mode: state managed by challenge_yesand.js (ChallengeEffects.YesAnd)

function wouldTriggerSpecialEvent(piece) {
    // Temporarily place the piece on a copy of the board to check for events
    const testBoard = board.map(row => [...row]);
    
    // Place piece on test board
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const boardY = piece.y + y;
                const boardX = piece.x + x;
                if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
                    testBoard[boardY][boardX] = piece.color;
                }
            }
        });
    });
    
    // Check for completed lines
    for (let y = 0; y < ROWS; y++) {
        if (testBoard[y] && testBoard[y].every(cell => cell !== null)) {
            console.log('🚫 Bounce prevented: Would complete line at row ' + y);
            return true; // Would complete a line
        }
    }
    
    // Check for tsunamis (blob spanning full width)
    const blobs = getAllBlobsFromBoard(testBoard);
    for (const blob of blobs) {
        const xPositions = blob.positions.map(p => p[0]);
        const uniqueX = [...new Set(xPositions)];
        if (uniqueX.length === COLS) {
            console.log('🚫 Bounce prevented: Would trigger tsunami');
            return true; // Would trigger tsunami
        }
    }
    
    // Check for black holes (one blob enveloping another)
    const blackHoles = detectBlackHoles(blobs);
    if (blackHoles.length > 0) {
        console.log('🚫 Bounce prevented: Would trigger black hole');
        return true; // Would trigger black hole
    }
    
    return false; // No special events would trigger
}

// Rubber bounce functions moved to challenge_rubber.js (ChallengeEffects.Rubber)

function rotateShape(shape) {
    const rows = shape.length;
    const cols = shape[0].length;
    const rotated = Array(cols).fill().map(() => Array(rows).fill(0));
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            rotated[x][rows - 1 - y] = shape[y][x];
        }
    }
    return rotated;
}


// ============================================
// END CHALLENGE MODE FUNCTIONS
// ============================================

function animateClearLines(completedRows) {
    const animation = { cells: [], startTime: Date.now(), duration: 500 };

    completedRows.forEach(row => {
        const centerX = COLS / 2;
        for (let x = 0; x < COLS; x++) {
            if (board[row][x]) {
                animation.cells.push({
                    x: x,
                    y: row,
                    color: board[row][x],
                    distance: Math.abs(x - centerX),
                    removed: false,
                    alpha: 1
                });
            }
        }
    });

    animation.cells.sort((a, b) => a.distance - b.distance);
    lineAnimations.push(animation);
    return animation;
}

/**
 * Animate line clear during replay using recorded cell data
 * @param {Array} cells - Array of {x, y, c (color)}
 */
// animateReplayClearLines moved to replay.js (GameReplay.animateClearLines)

function updateLineAnimations() {
    const now = Date.now();
    lineAnimations = lineAnimations.filter(anim => {
        const elapsed = now - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1);

        anim.cells.forEach((cell, index) => {
            const cellProgress = Math.max(0, progress - (index / anim.cells.length) * 0.5) * 2;
            if (cellProgress >= 1) {
                cell.removed = true;
            } else {
                cell.alpha = 1 - cellProgress;
            }
        });

        return progress < 1;
    });
    
    // During replay, reset animatingLines when all animations complete
    if (GameReplay.isActive() && lineAnimations.length === 0) {
        animatingLines = false;
    }
}

function checkForSpecialFormations() {
    // Check for special formations immediately after piece placement
    // Priority: Volcano > Black Hole > Tsunami
    // BUT: tsunami is always checked alongside volcano/black hole for super variants
    
    const allBlobs = getAllBlobs();
    let foundVolcano = false;
    let foundTsunami = false;
    let foundBlackHole = false;
    let volcanoData = [];
    let tsunamiBlobs = [];
    let blackHoleData = [];
    
    // Check for Volcanoes (blob at bottom completely enveloped by another)
    // Skip if a volcano is already active to prevent duplicate counting
    // Only in Maelstrom skill level
    if (!volcanoActive && skillLevel === 'maelstrom') {
        const volcanoes = detectVolcanoes(allBlobs);
        if (volcanoes.length > 0) {
            foundVolcano = true;
            volcanoData = volcanoes;
        }
    }
    
    // Check for Black Holes (one blob enveloping another of different color)
    // Skip if a black hole is already active to prevent duplicate counting
    // Only in Tempest and Maelstrom skill levels
    if (!foundVolcano && !blackHoleActive && skillLevel !== 'breeze') {
        const blackHoles = detectBlackHoles(allBlobs);
        if (blackHoles.length > 0) {
            foundBlackHole = true;
            blackHoleData = blackHoles;
        }
    }
    
    // ALWAYS check for Tsunamis when a volcano or black hole is found (for super variants)
    // Also check standalone tsunamis when no volcano/black hole found
    if (!tsunamiAnimating && skillLevel !== 'breeze') {
        allBlobs.forEach(blob => {
            const minX = Math.min(...blob.positions.map(p => p[0]));
            const maxX = Math.max(...blob.positions.map(p => p[0]));
            const spansWidth = (minX === 0 && maxX === COLS - 1);
            if (spansWidth) {
                foundTsunami = true;
                tsunamiBlobs.push(blob);
            }
        });
    }
    
    // Determine super variants (simultaneous tsunami + volcano/black hole)
    const isSuperVolcano = foundVolcano && foundTsunami;
    const isSupermassiveBlackHole = foundBlackHole && foundTsunami;
    
    // If we found special formations, trigger them immediately
    // Priority: Volcano > Black Hole > Tsunami (but tsunami detected for super checks above)
    if (foundVolcano) {
        // Trigger volcano animation for the first one
        const v = volcanoData[0];
        
        // Set super flag for delayed volcano scoring
        volcanoIsSuper = isSuperVolcano;
        if (isSuperVolcano) {
            superVolcanoCount++;
            console.log('🌋🌊 SUPERVOLCANO! Tsunami also detected - points will be doubled!');
        }
        
        // Start the volcano warming phase
        // (Column clearing will happen when warming transitions to eruption)
        triggerVolcano(v.lavaBlob, v.eruptionColumn, v.edgeType);
        volcanoCount++;
        
        // Record event for AI analysis
        if (aiModeEnabled && typeof AIPlayer !== 'undefined' && AIPlayer.recordEvent) {
            AIPlayer.recordEvent('volcano', { count: volcanoCount, column: v.eruptionColumn, isSuper: isSuperVolcano });
        }
        // Record detailed volcano data for replay (both AI and human games)
        if (typeof GameRecorder !== 'undefined' && GameRecorder.isActive()) {
            GameRecorder.recordEvent('volcano', { count: volcanoCount, column: v.eruptionColumn, blobSize: v.lavaBlob.positions.length, isSuper: isSuperVolcano });
            GameRecorder.recordVolcanoEruption(v.eruptionColumn, v.edgeType);
        }
        
        // NOTE: Score and histogram update delayed until eruption phase starts
        // This gives visual feedback (lava shooting out) before score jumps
        // Super volcano x2 bonus message will also be shown at eruption time
        
    } else if (foundBlackHole) {
            // Trigger black hole animation for the first one
            const bh = blackHoleData[0];
            triggerBlackHole(bh.innerBlob, bh.outerBlob);
            blackHoleCount++;
            
            if (isSupermassiveBlackHole) {
                supermassiveBlackHoleCount++;
                console.log('🕳️🌊 SUPERMASSIVE BLACK HOLE! Tsunami also detected - points doubled!');
            }
            
            // Record event for AI analysis
            if (aiModeEnabled && typeof AIPlayer !== 'undefined' && AIPlayer.recordEvent) {
                AIPlayer.recordEvent('blackHole', { count: blackHoleCount, innerSize: bh.innerBlob.positions.length, outerSize: bh.outerBlob.positions.length, isSupermassive: isSupermassiveBlackHole });
            }
            // Record detailed black hole data for replay (both AI and human games)
            if (typeof GameRecorder !== 'undefined' && GameRecorder.isActive()) {
                GameRecorder.recordEvent('blackHole', { count: blackHoleCount, innerSize: bh.innerBlob.positions.length, outerSize: bh.outerBlob.positions.length, isSupermassive: isSupermassiveBlackHole });
            }
            
            // Score calculation - BLACK HOLE SCORING:
            // Inner blob (black hole core): size³ × 800
            // Outer blob (sucked in): size³ × 800
            // Both blobs score equally at 800× multiplier (hardest achievement!)
            const outerSize = bh.outerBlob.positions.length;
            const innerSize = bh.innerBlob.positions.length;
            const innerPoints = innerSize * innerSize * innerSize * 800;
            const outerPoints = outerSize * outerSize * outerSize * 800;
            let blackHolePoints = innerPoints + outerPoints;
            
            // Apply SUPERMASSIVE bonus (x2) if tsunami was also detected
            if (isSupermassiveBlackHole) {
                blackHolePoints *= 2;
                showSuperEventBonus('supermassiveBlackHole');
                console.log(`🕳️🌊 SUPERMASSIVE BLACK HOLE x2! Points doubled!`);
            }
            
            // Apply CASCADE BONUS if this black hole was triggered by gravity from another special event
            let cascadeMultiplier = 1;
            if (cascadeLevel > 0) {
                cascadeMultiplier = cascadeLevel + 1;  // cascade 1 = 2x, cascade 2 = 3x, etc.
                blackHolePoints *= cascadeMultiplier;
                showCascadeBonus(cascadeMultiplier);
                console.log(`🕳️ BLACK HOLE CASCADE BONUS! x${cascadeMultiplier}`);
            }
            
            const finalBlackHoleScore = applyScoreModifiers(blackHolePoints * level);
            score += finalBlackHoleScore;
            
            // Update histograms
            Histogram.updateWithBlob(bh.outerBlob.color, outerSize);
            Histogram.updateWithBlob(bh.innerBlob.color, innerSize);
            Histogram.updateWithScore(finalBlackHoleScore);
            
            updateStats();
            
        } else if (foundTsunami) {
            // Standalone tsunami (no volcano or black hole simultaneously)
            // Trigger tsunami animation for the first one
            const blob = tsunamiBlobs[0];
            
            // Trigger visual effects (lightning and border)
            const avgY = blob.positions.reduce((sum, p) => sum + p[1], 0) / blob.positions.length;
            triggerTsunami(avgY * BLOCK_SIZE);
            
            // Trigger the actual clearing animation
            triggerTsunamiAnimation(blob);
            tsunamiCount++;
            
            // Record event for AI analysis
            if (aiModeEnabled && typeof AIPlayer !== 'undefined' && AIPlayer.recordEvent) {
                AIPlayer.recordEvent('tsunami', { count: tsunamiCount, blobSize: blob.positions.length });
            }
            // Record detailed tsunami data for replay (both AI and human games)
            if (typeof GameRecorder !== 'undefined' && GameRecorder.isActive()) {
                GameRecorder.recordEvent('tsunami', { count: tsunamiCount, blobSize: blob.positions.length });
            }
            
            // Score calculation - TSUNAMI SCORING:
            // Points = (blob size)³ × 200
            const blobSize = blob.positions.length;
            let tsunamiPoints = blobSize * blobSize * blobSize * 200;
            
            // Apply CASCADE BONUS if this tsunami was triggered by gravity from another special event
            let cascadeMultiplier = 1;
            if (cascadeLevel > 0) {
                cascadeMultiplier = cascadeLevel + 1;  // cascade 1 = 2x, cascade 2 = 3x, etc.
                tsunamiPoints *= cascadeMultiplier;
                showCascadeBonus(cascadeMultiplier);
                console.log(`🌊 TSUNAMI CASCADE BONUS! x${cascadeMultiplier}`);
            }
            
            const finalTsunamiScore = applyScoreModifiers(tsunamiPoints * level);
            score += finalTsunamiScore;
            
            // Update histograms
            Histogram.updateWithBlob(blob.color, blobSize);
            Histogram.updateWithScore(finalTsunamiScore);
            
            updateStats();
        }
}

// ============================================================================
// BLOCKCHAINSTORM - COMPLETE GRAVITY SYSTEM (V2 - REWRITE)
// ============================================================================
// Algorithm:
// 1. Create phantom board
// 2. Identify all blobs with unique IDs and starting positions
// 3. Detect interlocking (blobs that wrap around each other in columns)
// 4. Phase 1: Move compound (interlocked) blobs together
// 5. Phase 2: Move individual blobs independently
// 6. Record journey destinations
// 7. Animate from start to destination
// ============================================================================

/**
 * STEP 1: Create a complete copy of the board
 */
function createPhantomBoard(sourceBoard, sourceIsRandom, sourceIsLattice) {
    console.log('📋 STEP 1: Creating phantom board...');
    
    const phantom = {
        board: sourceBoard.map(row => [...row]),
        isRandom: sourceIsRandom.map(row => row ? [...row] : Array(COLS).fill(false)),
        isLattice: sourceIsLattice.map(row => row ? [...row] : Array(COLS).fill(false))
    };
    
    // Count non-null blocks
    let blockCount = 0;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (phantom.board[y][x] !== null) blockCount++;
        }
    }
    
    console.log(`  ✓ Phantom board created with ${blockCount} blocks`);
    return phantom;
}

/**
 * STEP 2: Identify every unique color blob on the phantom board
 * Returns array of blob objects with unique IDs
 */
function identifyAllBlobs(phantom) {
    console.log('\n📋 STEP 2: Identifying all blobs...');
    
    const visited = Array(ROWS).fill(null).map(() => Array(COLS).fill(false));
    const blobs = [];
    let blobIdCounter = 0;
    
    // Flood fill to find connected same-color blocks
    function floodFill(startX, startY, color) {
        const positions = [];
        const stack = [[startX, startY]];
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            
            // Bounds check
            if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
            
            // Already visited or different color
            if (visited[y][x] || phantom.board[y][x] !== color) continue;
            
            visited[y][x] = true;
            positions.push({x, y});
            
            // Check all 4 directions
            stack.push([x + 1, y]);
            stack.push([x - 1, y]);
            stack.push([x, y + 1]);
            stack.push([x, y - 1]);
        }
        
        return positions;
    }
    
    // Scan the board for unvisited blocks
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (!visited[y][x] && phantom.board[y][x] !== null) {
                const color = phantom.board[y][x];
                const positions = floodFill(x, y, color);
                
                if (positions.length > 0) {
                    // Filter out lattice-only blobs
                    const hasNonLattice = positions.some(pos => 
                        !phantom.isLattice[pos.y] || !phantom.isLattice[pos.y][pos.x]
                    );
                    
                    // Filter out gremlin-placed blocks
                    const nonRandomPositions = positions.filter(pos =>
                        !phantom.isRandom[pos.y] || !phantom.isRandom[pos.y][pos.x]
                    );
                    
                    if (hasNonLattice && nonRandomPositions.length > 0) {
                        const blobId = `blob_${blobIdCounter++}`;
                        
                        // Store blob data
                        const blob = {
                            id: blobId,
                            color: color,
                            positions: nonRandomPositions,
                            startPositions: nonRandomPositions.map(p => ({...p})), // Deep copy for journey
                            isCompound: false,
                            compoundWith: []
                        };
                        
                        blobs.push(blob);
                        
                        const posStr = positions.length > 5 
                            ? positions.slice(0,3).map(p=>`(${p.x},${p.y})`).join(',')+'...' 
                            : positions.map(p=>`(${p.x},${p.y})`).join(',');
                        console.log(`  Blob ${blobId}: ${nonRandomPositions.length} blocks, color=${color}, positions=${posStr}`);
                    }
                }
            }
        }
    }
    
    console.log(`  ✓ Found ${blobs.length} unique blobs`);
    return blobs;
}

/**
 * STEP 3: Check for interlocking blobs
 * A blob interlocks with another if there exists a column where:
 * - Both blobs have blocks in that column, AND
 * - Their Y ranges OVERLAP (not just touch, but actually share vertical space)
 * This prevents blobs from falling through each other during multi-pass gravity
 */
function detectInterlocking(blobs) {
    console.log('\n📋 STEP 3: Detecting interlocking blobs...');
    
    // Use Union-Find for transitive closure
    const parent = new Map();
    blobs.forEach(blob => parent.set(blob.id, blob.id));
    
    function find(id) {
        if (parent.get(id) !== id) {
            parent.set(id, find(parent.get(id)));
        }
        return parent.get(id);
    }
    
    function union(id1, id2) {
        const root1 = find(id1);
        const root2 = find(id2);
        if (root1 !== root2) {
            parent.set(root1, root2);
            return true;
        }
        return false;
    }
    
    // Pre-compute column data for each blob
    const blobColumns = new Map();
    blobs.forEach(blob => {
        const columns = new Map();
        blob.positions.forEach(pos => {
            if (!columns.has(pos.x)) columns.set(pos.x, []);
            columns.get(pos.x).push(pos.y);
        });
        blobColumns.set(blob.id, columns);
        
        // Debug: show all columns each blob occupies
        const colList = [...columns.keys()].sort((a,b) => a-b);
        console.log(`  📍 ${blob.id} (${blob.color.substring(0,7)}): cols [${colList.join(',')}]`);
    });
    
    // Check all pairs of blobs for interlocking
    for (let i = 0; i < blobs.length; i++) {
        const blobA = blobs[i];
        const columnsA = blobColumns.get(blobA.id);
        
        for (let j = i + 1; j < blobs.length; j++) {
            const blobB = blobs[j];
            const columnsB = blobColumns.get(blobB.id);
            
            let isInterlocked = false;
            let reason = '';
            
            // Check each column that blobA occupies
            for (let [colX, rowsA] of columnsA) {
                const rowsB = columnsB.get(colX);
                if (!rowsB || rowsB.length === 0) continue;
                
                // Found a shared column - log it
                console.log(`  🔍 ${blobA.id} vs ${blobB.id} share col ${colX}: A=[${rowsA.sort((a,b)=>a-b).join(',')}] B=[${rowsB.sort((a,b)=>a-b).join(',')}]`);
                
                const minYA = Math.min(...rowsA);
                const maxYA = Math.max(...rowsA);
                const minYB = Math.min(...rowsB);
                const maxYB = Math.max(...rowsB);
                
                // Check if blobB wraps around blobA (strict containment)
                if (minYB < minYA && maxYB > maxYA) {
                    isInterlocked = true;
                    reason = `${blobB.id} wraps around ${blobA.id} in column ${colX}`;
                    break;
                }
                
                // Check if blobA wraps around blobB (strict containment)
                if (minYA < minYB && maxYA > maxYB) {
                    isInterlocked = true;
                    reason = `${blobA.id} wraps around ${blobB.id} in column ${colX}`;
                    break;
                }
                
                // NEW: Check if Y ranges OVERLAP or are ADJACENT
                // Two ranges [minA, maxA] and [minB, maxB] overlap if:
                // minA <= maxB AND minB <= maxA
                // They're ADJACENT if one ends where the other begins (e.g., rows 8-9 and 10-11)
                // overlap = -1 means adjacent, >= 0 means overlapping
                const overlap = Math.min(maxYA, maxYB) - Math.max(minYA, minYB);
                console.log(`      overlap = min(${maxYA},${maxYB}) - max(${minYA},${minYB}) = ${overlap}`);
                if (overlap >= -1) {
                    // They share at least one row OR are directly adjacent in this column
                    isInterlocked = true;
                    const relationship = overlap >= 0 ? 'overlap' : 'are adjacent';
                    reason = `${blobA.id} and ${blobB.id} ${relationship} in column ${colX} (Y ranges [${minYA}-${maxYA}] and [${minYB}-${maxYB}])`;
                    break;
                }
            }
            
            if (isInterlocked) {
                union(blobA.id, blobB.id);
                console.log(`  🔗 Interlocking detected: ${reason}`);
            }
        }
    }
    
    // Build compound groups from union-find
    const groups = new Map();
    blobs.forEach(blob => {
        const root = find(blob.id);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(blob);
    });
    
    // Filter to only groups with multiple blobs and mark them
    const compoundGroups = [];
    groups.forEach((groupBlobs, root) => {
        if (groupBlobs.length > 1) {
            groupBlobs.forEach(blob => {
                blob.isCompound = true;
                blob.compoundWith = groupBlobs.filter(b => b.id !== blob.id).map(b => b.id);
            });
            
            compoundGroups.push(groupBlobs);
            console.log(`  ✓ Compound group created: ${groupBlobs.map(b => b.id).join(' + ')}`);
        }
    });
    
    console.log(`  ✓ Found ${compoundGroups.length} compound blob groups`);
    return compoundGroups;
}

/**
 * Calculate how far a set of blocks can fall
 * Returns the minimum fall distance across all columns
 */
function calculateFallDistance(positions, phantom) {
    let minFall = ROWS;
    
    // Group positions by column and find the lowest block in each
    const columnBottoms = new Map();
    positions.forEach(pos => {
        if (!columnBottoms.has(pos.x) || pos.y > columnBottoms.get(pos.x)) {
            columnBottoms.set(pos.x, pos.y);
        }
    });
    
    // Check each column
    for (let [x, bottomY] of columnBottoms) {
        let fall = 0;
        
        // Count empty spaces below
        for (let y = bottomY + 1; y < ROWS; y++) {
            // Check if this position is part of our blob (blob wraps around)
            const isOurBlock = positions.some(p => p.x === x && p.y === y);
            
            if (isOurBlock) {
                // Skip - this is part of our own blob
                continue;
            }
            
            if (phantom.board[y][x] !== null) {
                // Hit an obstacle
                break;
            }
            
            fall++;
        }
        
        minFall = Math.min(minFall, fall);
    }
    
    return minFall;
}

/**
 * Move a blob on the phantom board
 */
function moveBlob(blob, fallDistance, phantom) {
    // Remove from current positions
    blob.positions.forEach(pos => {
        phantom.board[pos.y][pos.x] = null;
        phantom.isRandom[pos.y][pos.x] = false;
        phantom.isLattice[pos.y][pos.x] = false;
    });
    
    // Move to new positions
    const newPositions = [];
    blob.positions.forEach(pos => {
        const newPos = {x: pos.x, y: pos.y + fallDistance};
        newPositions.push(newPos);
        phantom.board[newPos.y][newPos.x] = blob.color;
    });
    
    blob.positions = newPositions;
}

/**
 * STEP 4: Phase 1 - Move compound blobs together
 */
function runPhase1(blobs, compoundGroups, phantom) {
    console.log('\n📋 STEP 4: PHASE 1 - Moving compound blobs together...');
    
    let pass = 0;
    let somethingMoved = true;
    
    while (somethingMoved && pass < 100) {
        pass++;
        somethingMoved = false;
        
        console.log(`\n  🔄 Phase 1 Pass ${pass}:`);
        
        // Sort blobs from bottom to top
        const sortedBlobs = [...blobs].sort((a, b) => {
            const maxYA = Math.max(...a.positions.map(p => p.y));
            const maxYB = Math.max(...b.positions.map(p => p.y));
            return maxYB - maxYA; // Bottom first
        });
        
        // Track which blobs we've already processed as part of a compound
        const processed = new Set();
        
        sortedBlobs.forEach((blob, index) => {
            if (processed.has(blob.id)) return;
            
            if (blob.isCompound) {
                // Get all blobs in this compound
                const compoundBlobs = blobs.filter(b => 
                    b.id === blob.id || (blob.compoundWith && blob.compoundWith.includes(b.id))
                );
                
                // Mark as processed
                compoundBlobs.forEach(b => processed.add(b.id));
                
                // Combine all positions
                const allPositions = [];
                compoundBlobs.forEach(b => allPositions.push(...b.positions));
                
                // Calculate fall distance for the compound unit
                const fall = calculateFallDistance(allPositions, phantom);
                
                if (fall > 0) {
                    somethingMoved = true;
                    const blobIds = compoundBlobs.map(b => b.id).join('+');
                    console.log(`    Compound (${blobIds}): Falling ${fall} rows together (${allPositions.length} blocks)`);
                    
                    // CRITICAL: Move compound blobs in two phases to prevent phantom corruption
                    // Phase A: Remove ALL blobs from old positions first
                    compoundBlobs.forEach(b => {
                        b.positions.forEach(pos => {
                            phantom.board[pos.y][pos.x] = null;
                            phantom.isRandom[pos.y][pos.x] = false;
                            phantom.isLattice[pos.y][pos.x] = false;
                        });
                    });
                    
                    // Phase B: Add ALL blobs to new positions
                    compoundBlobs.forEach(b => {
                        const newPositions = [];
                        b.positions.forEach(pos => {
                            const newPos = {x: pos.x, y: pos.y + fall};
                            newPositions.push(newPos);
                            phantom.board[newPos.y][newPos.x] = b.color;
                        });
                        b.positions = newPositions;
                    });
                }
            } else {
                // Individual blob
                processed.add(blob.id);
                const fall = calculateFallDistance(blob.positions, phantom);
                
                if (fall > 0) {
                    somethingMoved = true;
                    console.log(`    Blob ${blob.id}: Falling ${fall} rows (${blob.positions.length} blocks)`);
                    moveBlob(blob, fall, phantom);
                }
            }
        });
    }
    
    console.log(`  ✓ Phase 1 complete after ${pass} passes`);
}

/**
 * STEP 5: Phase 2 - Move individual blobs independently
 */
function runPhase2(blobs, phantom) {
    console.log('\n📋 STEP 5: PHASE 2 - Moving individual blobs independently...');
    
    let pass = 0;
    let somethingMoved = true;
    
    while (somethingMoved && pass < 100) {
        pass++;
        somethingMoved = false;
        
        console.log(`\n  🔄 Phase 2 Pass ${pass}:`);
        
        // Sort blobs from bottom to top
        const sortedBlobs = [...blobs].sort((a, b) => {
            const maxYA = Math.max(...a.positions.map(p => p.y));
            const maxYB = Math.max(...b.positions.map(p => p.y));
            return maxYB - maxYA; // Bottom first
        });
        
        sortedBlobs.forEach((blob, index) => {
            // Phase 2: Allow all blobs to settle further into gaps
            // The phantom board should correctly block them from falling through other blobs
            const fall = calculateFallDistance(blob.positions, phantom);
            
            if (fall > 0) {
                somethingMoved = true;
                console.log(`    Blob ${blob.id}: Falling ${fall} more rows (${blob.positions.length} blocks)`);
                moveBlob(blob, fall, phantom);
            }
        });
    }
    
    console.log(`  ✓ Phase 2 complete after ${pass} passes`);
}

/**
 * STEP 6: Record journey destinations
 */
function recordJourneys(blobs) {
    console.log('\n📋 STEP 6: Recording journey destinations...');
    
    blobs.forEach(blob => {
        const startY = Math.min(...blob.startPositions.map(p => p.y));
        const endY = Math.min(...blob.positions.map(p => p.y));
        const distance = endY - startY;
        
        console.log(`  Journey ${blob.id}: Start Y=${startY}, End Y=${endY}, Distance=${distance} rows`);
    });
    
    console.log(`  ✓ Recorded ${blobs.length} journey destinations`);
}

/**
 * STEP 7: Create animation data
 */
function createAnimations(blobs) {
    console.log('\n📋 STEP 7: Creating animation data...');
    
    const animations = [];
    
    blobs.forEach(blob => {
        // Only animate blobs that actually moved
        const startY = blob.startPositions[0].y;
        const endY = blob.positions[0].y;
        const distance = endY - startY;
        
        if (distance > 0) {
            animations.push({
                blobId: blob.id,
                color: blob.color,
                startPositions: blob.startPositions,
                endPositions: blob.positions,
                distance: distance
            });
        }
    });
    
    console.log(`  ✓ Created ${animations.length} animations`);
    return animations;
}

/**
 * Start the gravity animation
 */
function startGravityAnimation(animations) {
    console.log('🎬 Starting gravity animation...');
    
    // Save amnesia timestamps before clearing source positions
    // (stored temporarily on animation objects, transferred to fallingBlocks below)
    const amnesiaStamps = new Map();
    if (window.ChallengeEffects && ChallengeEffects.Amnesia) {
        const grid = ChallengeEffects.Amnesia.getStampGrid();
        animations.forEach(anim => {
            anim.startPositions.forEach(pos => {
                if (grid[pos.y] && grid[pos.y][pos.x] !== null) {
                    amnesiaStamps.set(`${pos.x},${pos.y}`, grid[pos.y][pos.x]);
                }
            });
        });
    }
    
    // Clear blocks from their original positions on the real board
    animations.forEach(anim => {
        anim.startPositions.forEach(pos => {
            board[pos.y][pos.x] = null;
            isRandomBlock[pos.y][pos.x] = false;
            isLatticeBlock[pos.y][pos.x] = false;
        });
    });
    
    // Set up falling blocks for animation
    fallingBlocks = [];
    animations.forEach(anim => {
        anim.startPositions.forEach((startPos, idx) => {
            const endPos = anim.endPositions[idx];
            
            fallingBlocks.push({
                x: startPos.x,
                startY: startPos.y,
                currentY: startPos.y * BLOCK_SIZE,
                targetY: endPos.y,
                targetYPixels: endPos.y * BLOCK_SIZE,
                color: anim.color,
                velocity: 0,
                done: false,
                blobId: anim.blobId,
                isRandom: false
            });
        });
    });
    
    gravityAnimating = true;
    
    // Transfer saved amnesia timestamps to falling blocks
    if (amnesiaStamps.size > 0) {
        fallingBlocks.forEach(block => {
            const stamp = amnesiaStamps.get(`${block.x},${block.startY}`);
            if (stamp !== undefined) block._amnesiaStamp = stamp;
        });
    }
    
    console.log(`  ✓ Animation started with ${fallingBlocks.length} falling blocks`);
}

/**
 * MAIN GRAVITY FUNCTION - REPLACES runTwoPhaseGravity()
 */
function runTwoPhaseGravity() {
    // CRITICAL: Prevent concurrent gravity operations
    if (gravityAnimating) {
        console.log('⚠️ runTwoPhaseGravity called while gravity already animating - aborting');
        return;
    }
    
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 GRAVITY SYSTEM V2 - COMPLETE REWRITE');
    console.log('═══════════════════════════════════════════════════════════');
    
    fallingBlocks = [];
    gravityAnimating = false; // Will be set to true if there are animations
    
    // STEP 1: Create phantom board
    const phantom = createPhantomBoard(board, isRandomBlock, isLatticeBlock);
    
    // STEP 2: Identify all blobs with unique IDs
    const blobs = identifyAllBlobs(phantom);
    
    if (blobs.length === 0) {
        console.log('✓ No blobs to move - gravity complete');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Update liquid pools even if no gravity
        StormEffects.updateLiquidPoolsAfterGravity();
        
        // Check for special formations
        checkForSpecialFormations();
        
        // Check for line clears
        clearLines();
        return;
    }
    
    // STEP 3: Detect interlocking
    const compoundGroups = detectInterlocking(blobs);
    
    // STEP 4: Phase 1 - Compound blobs move together
    runPhase1(blobs, compoundGroups, phantom);
    
    // STEP 5: Phase 2 - Individual blobs move independently
    runPhase2(blobs, phantom);
    
    // STEP 6: Record journey destinations
    recordJourneys(blobs);
    
    // STEP 7: Create animations
    const animations = createAnimations(blobs);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`✓ GRAVITY SIMULATION COMPLETE`);
    console.log(`  Total blobs: ${blobs.length}`);
    console.log(`  Compound groups: ${compoundGroups.length}`);
    console.log(`  Animations: ${animations.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Start the animation
    if (animations.length > 0) {
        startGravityAnimation(animations);
    } else {
        // No animations, so update board immediately
        gravityAnimating = false;
        
        // SAFETY CHECK: Even with no animations, check for floating blocks
        if (detectAndFixFloatingBlocks()) {
            return; // Don't continue - gravity re-run will handle the rest
        }
        
        // Update liquid pools
        StormEffects.updateLiquidPoolsAfterGravity();
        
        // Check for special formations
        checkForSpecialFormations();
        
        // Check for line clears
        clearLines();
    }
}

function applyGravity() {
    // CRITICAL: Prevent concurrent gravity operations
    // Multiple systems can call applyGravity (tsunamis, black holes, tornadoes, gremlins, etc.)
    // If gravity is already running, defer this call until it completes
    if (gravityAnimating) {
        console.log('⏸️ applyGravity deferred - gravity already animating');
        // Schedule a retry after current gravity completes
        setTimeout(() => {
            if (!gravityAnimating && !animatingLines) {
                console.log('🔄 Running deferred applyGravity');
                runTwoPhaseGravity();
            }
        }, 100);
        return;
    }
    
    if (animatingLines) {
        console.log('⏸️ applyGravity deferred - lines animating');
        // Don't schedule retry - clearLines will call gravity when it completes
        return;
    }
    
    // This function is called by tsunamis, black holes, volcanoes, gremlins, etc.
    // It now uses the shared two-phase gravity system
    runTwoPhaseGravity();
}
    
function updateFallingBlocks() {
    if (!gravityAnimating || fallingBlocks.length === 0) return;
    
    // Use consistent gravity (Mercury level = 0.38x Earth) regardless of current planet
    // This prevents confusing fast cascades on high-gravity planets like the Sun
    const gravityMultiplier = 0.38; // Mercury/Mars gravity
    
    // Base gravity and velocity for Earth (gravity = 1.0)
    const baseGravity = 0.45;
    const baseMaxVelocity = 4.5;
    
    // Scale gravity and terminal velocity by the fixed gravity multiplier
    // BUT enforce a minimum gravity floor so animations don't take forever
    const minGravity = 1.2; // Minimum gravity to keep animations reasonable
    const minMaxVelocity = 12.0; // Minimum max velocity
    const gravity = Math.max(baseGravity * gravityMultiplier, minGravity);
    const maxVelocity = Math.max(baseMaxVelocity * gravityMultiplier, minMaxVelocity);
    
    let allDone = true;
    
    // Debug logging
    if (fallingBlocks.length > 0 && fallingBlocks[0].velocity < 1) {
        console.log(`Falling: blocks=${fallingBlocks.length}, gravity=${gravity.toFixed(2)} (${gravityMultiplier}x Earth), velocity=${fallingBlocks[0].velocity.toFixed(2)}, currentY=${fallingBlocks[0].currentY.toFixed(1)}, targetY=${fallingBlocks[0].targetYPixels}`);
    }
    
    fallingBlocks.forEach(block => {
        if (block.done) return;
        
        // Apply gravity
        block.velocity = Math.min(block.velocity + gravity, maxVelocity);
        block.currentY += block.velocity;
        
        // Check if reached target
        if (block.currentY >= block.targetYPixels) {
            block.currentY = block.targetYPixels;
            block.done = true;
            // DON'T place on board yet - wait until ALL blocks are done
        } else {
            allDone = false;
        }
    });
    
    // Animation complete - NOW place ALL blocks at once
    if (allDone) {
        // Place all landed blocks on the board simultaneously
        fallingBlocks.forEach(block => {
            board[block.targetY][block.x] = block.color;
            isRandomBlock[block.targetY][block.x] = block.isRandom;
        });
        
        if (window.ChallengeEffects && ChallengeEffects.Amnesia) {
            fallingBlocks.forEach(block => {
                if (block._amnesiaStamp !== undefined) {
                    ChallengeEffects.Amnesia.restoreCell(block.x, block.targetY, block._amnesiaStamp);
                }
            });
        }
        
        gravityAnimating = false;
        fallingBlocks = [];
        
        // Update liquid pools after blocks have fallen
        StormEffects.updateLiquidPoolsAfterGravity();
        
        // SAFETY CHECK: Detect pathological floating blocks (complete empty rows)
        // If detected, gravity will be re-run asynchronously
        if (detectAndFixFloatingBlocks()) {
            return; // Don't continue - gravity re-run will handle the rest
        }
        
        // CRITICAL FIX: After gravity, blocks may have fallen into currentPiece's space
        // Push the piece up until it's no longer colliding
        if (currentPiece && collides(currentPiece)) {
            console.log('🎬 Gravity moved blocks into current piece location - pushing piece up');
            let safetyCounter = 0;
            while (collides(currentPiece) && safetyCounter < 10) {
                currentPiece.y--;
                safetyCounter++;
            }
            if (safetyCounter >= 10) {
                console.log('🎬 Could not find safe position for piece after gravity');
            }
        }
        
        // Increment cascade level for gravity-triggered formations and clears
        // This must happen BEFORE checkForSpecialFormations so cascaded tsunamis/black holes get bonus
        cascadeLevel++;
        
        // Check for black holes and tsunamis after gravity settles
        checkForSpecialFormations();
        
        // DON'T call applyGravity here - the multi-pass simulation already handled everything!
        // Just check for line clears
        clearLines();
    }
}

/**
 * Detect and fix floating blocks that should have fallen but didn't
 * This is a SAFETY NET for race conditions - only triggers in pathological cases
 * where there's a complete empty row separating blocks from the floor.
 * Does NOT touch normal holes within blobs.
 * Returns true if floating blocks were found and fixed
 */
function detectAndFixFloatingBlocks() {
    // Look for a completely empty row that has blocks above it
    // This indicates a catastrophic gravity failure
    
    let emptyRowWithBlocksAbove = -1;
    
    for (let y = ROWS - 1; y >= 1; y--) {
        // Check if this row is completely empty
        let rowIsEmpty = true;
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] !== null) {
                rowIsEmpty = false;
                break;
            }
        }
        
        if (rowIsEmpty) {
            // Check if there are any blocks above this row
            let hasBlocksAbove = false;
            for (let checkY = y - 1; checkY >= 0; checkY--) {
                for (let x = 0; x < COLS; x++) {
                    if (board[checkY][x] !== null) {
                        hasBlocksAbove = true;
                        break;
                    }
                }
                if (hasBlocksAbove) break;
            }
            
            if (hasBlocksAbove) {
                // Also check that there are blocks or floor BELOW this empty row
                // (to confirm this is actually a gap, not just the top of the board)
                let hasBlocksOrFloorBelow = (y === ROWS - 1); // Floor counts
                if (!hasBlocksOrFloorBelow) {
                    for (let checkY = y + 1; checkY < ROWS; checkY++) {
                        for (let x = 0; x < COLS; x++) {
                            if (board[checkY][x] !== null) {
                                hasBlocksOrFloorBelow = true;
                                break;
                            }
                        }
                        if (hasBlocksOrFloorBelow) break;
                    }
                }
                
                if (hasBlocksOrFloorBelow) {
                    emptyRowWithBlocksAbove = y;
                    break; // Found the gap
                }
            }
        }
    }
    
    if (emptyRowWithBlocksAbove === -1) {
        return false; // No pathological floating detected
    }
    
    console.log(`🚨 GRAVITY BUG DETECTED: Empty row ${emptyRowWithBlocksAbove} with blocks above! Re-running gravity...`);
    
    // Don't try to fix it ourselves - just re-run the proper gravity system
    // This ensures blob-based physics are respected
    setTimeout(() => {
        if (!gravityAnimating && !animatingLines) {
            runTwoPhaseGravity();
        }
    }, 50);
    
    return true;
}

function drawFallingBlocks() {
    if (!gravityAnimating || fallingBlocks.length === 0) return;
    
    ctx.save();
    
    // Apply phantom mode opacity to falling blocks too
    const isPhantomMode = challengeMode === 'phantom' || activeChallenges.has('phantom');
    if (isPhantomMode && window.ChallengeEffects && ChallengeEffects.Phantom) {
        ctx.globalAlpha = ChallengeEffects.Phantom.getOpacity();
    }
    
    // Group blocks by blobId and color to draw them as connected shapes
    const blobGroups = {};
    fallingBlocks.forEach(block => {
        // Draw ALL blocks in the fallingBlocks array, even if done
        // They'll be removed from the array when animation fully completes
        const key = `${block.blobId}_${block.color}`;
        if (!blobGroups[key]) {
            blobGroups[key] = {
                color: block.color,
                blocks: [],
                velocity: block.velocity,
                originalPositions: [] // Store original relative positions
            };
        }
        blobGroups[key].blocks.push(block);
    });
    
    // Draw each blob group as a connected shape
    Object.values(blobGroups).forEach(group => {
        // Calculate the Y offset based on the current animation progress
        // Find the top block (smallest startY) to use as reference
        const topBlock = group.blocks.reduce((top, b) => 
            b.startY < top.startY ? b : top, group.blocks[0]);
        
        // Calculate how far the top block has fallen (in pixels)
        const yOffset = topBlock.currentY - (topBlock.startY * BLOCK_SIZE);
        
        // Maintain each block's original relative position while applying the fall offset
        const positions = group.blocks.map(b => {
            const relativeY = b.startY + (yOffset / BLOCK_SIZE);
            return [b.x, relativeY];
        });
        
        // Check if any blocks are gremlin-placed blocks
        const hasRandomBlocks = group.blocks.some(b => b.isRandom);
        
        // Use pulsing color for lava blocks
        let displayColor = group.color === volcanoLavaColor ? getLavaColor() : group.color;
        
        // Apply amnesia fade to falling blocks based on their saved timestamps
        const isAmnesiaFalling = challengeMode === 'amnesia' || activeChallenges.has('amnesia');
        if (isAmnesiaFalling && window.ChallengeEffects) {
            let oldestStamp = Date.now();
            group.blocks.forEach(b => {
                if (b._amnesiaStamp !== undefined && b._amnesiaStamp < oldestStamp) {
                    oldestStamp = b._amnesiaStamp;
                }
            });
            const age = Date.now() - oldestStamp;
            if (age > 0) {
                const progress = Math.min(age / ChallengeEffects.Amnesia.FADE_DURATION_MS, 1.0);
                const blend = progress * progress * ChallengeEffects.Amnesia.MAX_BLEND;
                displayColor = ChallengeEffects.Amnesia.blendToWhite(displayColor, blend);
            }
        }
        
        // Draw main blob
        // In phantom mode, parent context already has opacity set
        if (!isPhantomMode) {
            ctx.globalAlpha = 1;
        }
        drawSolidShape(ctx, positions, displayColor, BLOCK_SIZE, false, getFaceOpacity(), hasRandomBlocks);
        
        // Add slight motion blur trail for fast-moving blobs
        if (group.velocity > 3) { // Velocity is now in pixels per frame
            ctx.globalAlpha = 0.3;
            const trailYOffset = yOffset - group.velocity * 0.3;
            const trailPositions = group.blocks.map(b => {
                const relativeY = b.startY + (trailYOffset / BLOCK_SIZE);
                return [b.x, relativeY];
            });
            drawSolidShape(ctx, trailPositions, displayColor, BLOCK_SIZE, false, getFaceOpacity(), hasRandomBlocks);
        }
    });
    
    ctx.restore();
}

function clearLines() {
    // CRITICAL: Don't check for line clears while blocks are falling!
    // The multi-pass simulation already calculated everything, so we must
    // wait for all blocks to land before checking for new clears
    if (gravityAnimating) {
        console.log('⏸️ Skipping clearLines - blocks still falling');
        return;
    }
    
    // Don't clear lines during earthquake - let the earthquake finish first
    if (earthquakeActive) {
        console.log('⏸️ Skipping clearLines - earthquake in progress');
        return;
    }
    
    // Don't start a new line clear while one is already animating
    // This prevents race conditions when tornado drops pieces during line clears
    // Set a flag to check again after the current animation completes
    if (animatingLines) {
        console.log('⏸️ Deferring clearLines - line animation in progress');
        pendingLineCheck = true;
        return;
    }
    
    const blobsBefore = getAllBlobs();
    const completedRows = [];
    
    for (let y = ROWS - 1; y >= 0; y--) {
        // Defensive check: ensure row exists and is valid
        if (board[y] && Array.isArray(board[y]) && board[y].length === COLS) {
            // Check if all cells in this row are filled (non-null)
            let isComplete = true;
            for (let x = 0; x < COLS; x++) {
                if (board[y][x] === null || board[y][x] === undefined) {
                    isComplete = false;
                    break;
                }
            }
            if (isComplete) {
                completedRows.push(y);
            }
        }
    }

    if (completedRows.length > 0) {
        animatingLines = true;
        
        // Pre-calculate which effects to play (before clearing rows)
        const blobsBeforeForCheck = getAllBlobs();
        let willHaveGoldBlob = false;
        let willHaveBlackHole = false;
        let tsunamiBlobs = []; // Track which blobs are tsunamis
        let blackHoleBlobs = []; // Track black hole pairs
        
        // Detect black holes first (one blob enveloping another)
        // Only in Tempest and Maelstrom skill levels
        if (skillLevel !== 'breeze') {
            const blackHoles = detectBlackHoles(blobsBeforeForCheck);
            blackHoles.forEach(bh => {
                // Only count as black hole if inner blob has blocks in completed rows
                const innerBlocksInRows = bh.innerBlob.positions.filter(pos => completedRows.includes(pos[1])).length;
                if (innerBlocksInRows > 0) {
                    willHaveBlackHole = true;
                    blackHoleBlobs.push(bh);
                }
            });
        }
        
        // Check if any blob spans the width (tsunamis)
        // Only in Tempest and Maelstrom skill levels
        if (skillLevel !== 'breeze') {
            blobsBeforeForCheck.forEach(blob => {
                const blocksInRows = blob.positions.filter(pos => completedRows.includes(pos[1])).length;
                if (blocksInRows === 0) return;
                
                const minX = Math.min(...blob.positions.map(p => p[0]));
                const maxX = Math.max(...blob.positions.map(p => p[0]));
                const spansWidth = (minX === 0 && maxX === COLS - 1);
                if (spansWidth) {
                    willHaveGoldBlob = true;
                    tsunamiBlobs.push(blob);
                }
            });
        }
        
        const isStrike = completedRows.length >= 4;
        
        // Play appropriate sound/effect immediately as animation starts
        // Priority: Strike > Black Hole > Tsunami > Normal
        if (isStrike) {
            triggerLightning(300); // Single strike for 4 lines
            strikeCount++;
            
            // Record event for AI analysis
            if (aiModeEnabled && typeof AIPlayer !== 'undefined' && AIPlayer.recordEvent) {
                AIPlayer.recordEvent('strike', { count: strikeCount, linesCleared: completedRows.length });
            }
            // Record strike event for replay (both AI and human games)
            if (typeof GameRecorder !== 'undefined' && GameRecorder.isActive()) {
                GameRecorder.recordEvent('strike', { count: strikeCount, linesCleared: completedRows.length });
            }
        } else if (willHaveBlackHole) {
            // Black hole takes priority - purple/dark effect
            canvas.classList.add('blackhole-active');
            playEnhancedThunder(soundToggle); // Dramatic sound
            // Play LineClear sound 4 times for black hole
            for (let i = 0; i < 4; i++) {
                setTimeout(() => {
                    playSoundEffect('line', soundToggle);
                }, 100 + i * 200);
            }
            setTimeout(() => {
                canvas.classList.remove('blackhole-active');
            }, 1000);
        } else if (willHaveGoldBlob) {
            // Add golden border during tsunami blob clearing
            canvas.classList.add('tsunami-active');
            playSoundEffect('gold', soundToggle);
            // Play LineClear sound 4 times for tsunami
            for (let i = 0; i < 4; i++) {
                setTimeout(() => {
                    playSoundEffect('line', soundToggle);
                }, 100 + i * 200);
            }
            // Remove border after animation
            setTimeout(() => {
                canvas.classList.remove('tsunami-active');
            }, 1000);
        } else {
            // Only play regular line clear sound if this is NOT a cascade
            // (cascade bonus will play the sound multiple times)
            if (cascadeLevel === 0) {
                playSoundEffect('line', soundToggle);
            }
        }
        
        // Calculate histogram and score updates immediately (before animation completes)
        let pointsEarned = 0;
        let hadGoldBlob = false;
        let hadBlackHole = false;
        
        // Process BLACK HOLES first (highest priority)
        blackHoleBlobs.forEach(bh => {
            const innerSize = bh.innerBlob.positions.length;
            const outerSize = bh.outerBlob.positions.length;
            
            // Update histograms
            Histogram.updateWithBlob(bh.innerBlob.color, innerSize);
            Histogram.updateWithBlob(bh.outerBlob.color, outerSize);
            
            // BLACK HOLE SCORING:
            // Inner blob (black hole core): size³ × 100 × 2
            // Outer blob (sucked in): size³ × 100
            const innerPoints = innerSize * innerSize * innerSize * 100 * 2;
            const outerPoints = outerSize * outerSize * outerSize * 100;
            
            pointsEarned += innerPoints + outerPoints;
            hadBlackHole = true;
            
            // Remove ALL blocks from both blobs
            bh.innerBlob.positions.forEach(([bx, by]) => {
                board[by][bx] = null;
                isRandomBlock[by][bx] = false;
                fadingBlocks[by][bx] = null;
            });
            bh.outerBlob.positions.forEach(([bx, by]) => {
                board[by][bx] = null;
                isRandomBlock[by][bx] = false;
                fadingBlocks[by][bx] = null;
            });
        });
        
        // Count how many lava segments are in the completed rows
        // Each lava segment doubles the entire line clear score
        let lavaSegmentCount = 0;
        blobsBefore.forEach(beforeBlob => {
            if (beforeBlob.color === volcanoLavaColor) {
                const blocksInCompletedRows = beforeBlob.positions.filter(pos => completedRows.includes(pos[1])).length;
                if (blocksInCompletedRows > 0) {
                    lavaSegmentCount++;
                }
            }
        });
        
        // Process remaining blobs (excluding black hole blobs)
        blobsBefore.forEach(beforeBlob => {
            // Skip if this blob was part of a black hole
            // Compare by color and positions, not object reference
            const isBlackHoleBlob = blackHoleBlobs.some(bh => {
                const matchesInner = bh.innerBlob.color === beforeBlob.color &&
                    bh.innerBlob.positions.length === beforeBlob.positions.length &&
                    bh.innerBlob.positions.every(([x, y]) => 
                        beforeBlob.positions.some(([bx, by]) => bx === x && by === y)
                    );
                const matchesOuter = bh.outerBlob.color === beforeBlob.color &&
                    bh.outerBlob.positions.length === beforeBlob.positions.length &&
                    bh.outerBlob.positions.every(([x, y]) => 
                        beforeBlob.positions.some(([bx, by]) => bx === x && by === y)
                    );
                return matchesInner || matchesOuter;
            });
            if (isBlackHoleBlob) return;
            
            const beforeSize = beforeBlob.positions.length;
            
            // Check if this blob spanned the width
            const minX = Math.min(...beforeBlob.positions.map(p => p[0]));
            const maxX = Math.max(...beforeBlob.positions.map(p => p[0]));
            const wasSpanning = (minX === 0 && maxX === COLS - 1);
            
            // Check how many blocks are in completed rows
            let blocksInCompletedRows = beforeBlob.positions.filter(pos => completedRows.includes(pos[1])).length;
            
            if (blocksInCompletedRows > 0) {
                // Update histogram with blob size being cleared
                Histogram.updateWithBlob(beforeBlob.color, beforeSize);
                
                let blobPoints;
                
                if (wasSpanning && skillLevel !== 'breeze') {
                    // TSUNAMI: Clear entire blob and score ALL blocks
                    // Points = (original blob size)³ × 200
                    blobPoints = beforeSize * beforeSize * beforeSize * 200;
                    hadGoldBlob = true;
                    
                    // Mark ALL blocks in tsunami blob for removal
                    beforeBlob.positions.forEach(([bx, by]) => {
                        board[by][bx] = null;
                        isRandomBlock[by][bx] = false;
                        fadingBlocks[by][bx] = null;
                    });
                } else {
                    // Normal blob: Only score blocks in completed rows
                    // Points = (original blob size)² × blocks removed × 100
                    // (Lava multiplier applied to entire line clear later)
                    blobPoints = beforeSize * beforeSize * blocksInCompletedRows * 100;
                }
                
                pointsEarned += blobPoints;
            }
        });
        
        // Apply lava multiplier to entire line clear
        // Each lava segment doubles the score (1 segment = 2x, 2 segments = 4x, 3 segments = 8x, etc.)
        if (lavaSegmentCount > 0) {
            const lavaMultiplier = Math.pow(2, lavaSegmentCount);
            pointsEarned *= lavaMultiplier;
            console.log(`🌋 Lava multiplier: ${lavaSegmentCount} segments = ${lavaMultiplier}x points!`);
        }
        
        // Apply strike bonus
        if (isStrike) {
            pointsEarned *= 2;
        }
        
        // Apply cascade bonus (cascadeLevel 0 = no bonus, 1 = 2x, 2 = 3x, etc.)
        if (cascadeLevel > 0) {
            const cascadeMultiplier = cascadeLevel + 1;
            pointsEarned *= cascadeMultiplier;
            showCascadeBonus(cascadeMultiplier);
        }
        
        const scoreIncrease = applyScoreModifiers(pointsEarned * level);
        score += scoreIncrease;
        
        // Haptic feedback based on score earned
        GamepadController.vibrateLineClear(scoreIncrease);
        
        // Update score histogram immediately
        Histogram.updateWithScore(scoreIncrease);
        
        lines += completedRows.length;
        
        // Decrement weather event grace period
        if (weatherEventGracePeriod > 0) {
            weatherEventGracePeriod = Math.max(0, weatherEventGracePeriod - completedRows.length);
            if (weatherEventGracePeriod === 0) {
                console.log('🌤️ Weather event grace period ended');
            }
        }
        
        // Record line clear event for replay (both AI and human games)
        // Include cell data so animation can work without reading from board
        if (typeof GameRecorder !== 'undefined' && GameRecorder.isActive()) {
            const cellData = [];
            completedRows.forEach(row => {
                for (let x = 0; x < COLS; x++) {
                    if (board[row] && board[row][x]) {
                        cellData.push({ x: x, y: row, c: board[row][x] });
                    }
                }
            });
            GameRecorder.recordEvent('linesClear', { 
                linesCleared: completedRows.length, 
                totalLines: lines,
                level: level,
                rows: completedRows, // Include which rows were cleared
                cells: cellData // Cell colors for animation
            });
        }
        
        // Check for 42 lines easter egg
        if (lines === 42 && !StarfieldSystem.isUFOActive()) {
            StarfieldSystem.triggerUFO();
        }
        
        // If UFO is active and lines changed from 42, make it leave
        if (StarfieldSystem.isUFOActive() && lines !== 42) {
            StarfieldSystem.departUFO();
        }
        
        // Update Six Seven counter
        const isSixSevenMode = challengeMode === 'sixseven' || activeChallenges.has('sixseven');
        if (isSixSevenMode && window.ChallengeEffects && ChallengeEffects.SixSeven) {
            ChallengeEffects.SixSeven.addLines(completedRows.length);
        }
        
        // Update Gremlins counter
        const isGremlinsMode = challengeMode === 'gremlins' || activeChallenges.has('gremlins');
        if (isGremlinsMode && window.ChallengeEffects && ChallengeEffects.Gremlins) {
            ChallengeEffects.Gremlins.addLines(completedRows.length);
        }
        
        const oldLevel = level;
        level = Math.min(11, Math.floor(lines / 11) + 1); // Spinal Tap tribute - this one goes to 11!
        currentGameLevel = level; StarfieldSystem.setCurrentGameLevel(level); // Update starfield journey
        dropInterval = calculateDropInterval(lines);
        
        // Spinal Tap tribute - this one goes to 11!
        if (oldLevel < 11 && level >= 11) {
            console.log("🎸 This one goes to 11! 🎸");
        }
        
        updateStats();
        
        // Animate cleared lines PLUS all special blob blocks
        const cellsToAnimate = [];
        
        // Add completed row cells
        completedRows.forEach(row => {
            const centerX = COLS / 2;
            for (let x = 0; x < COLS; x++) {
                if (board[row][x]) {
                    cellsToAnimate.push({
                        x: x,
                        y: row,
                        color: board[row][x],
                        distance: Math.abs(x - centerX),
                        removed: false,
                        alpha: 1
                    });
                }
            }
        });
        
        // Add ALL black hole blob cells (both inner and outer)
        blackHoleBlobs.forEach(bh => {
            const centerX = COLS / 2;
            const centerRow = completedRows[0] || 10;
            
            // Animate inner blob (black hole core) with special marker
            bh.innerBlob.positions.forEach(([bx, by]) => {
                if (!completedRows.includes(by)) {
                    cellsToAnimate.push({
                        x: bx,
                        y: by,
                        color: bh.innerBlob.color,
                        distance: Math.abs(bx - centerX) + Math.abs(by - centerRow) * 0.3,
                        removed: false,
                        alpha: 1,
                        isBlackHole: true
                    });
                }
            });
            
            // Animate outer blob (sucked into black hole)
            bh.outerBlob.positions.forEach(([bx, by]) => {
                if (!completedRows.includes(by)) {
                    cellsToAnimate.push({
                        x: bx,
                        y: by,
                        color: bh.outerBlob.color,
                        distance: Math.abs(bx - centerX) + Math.abs(by - centerRow) * 0.3,
                        removed: false,
                        alpha: 1,
                        isBlackHole: true
                    });
                }
            });
        });
        
        // Add ALL tsunami blob cells (even those not in completed rows)
        tsunamiBlobs.forEach(blob => {
            blob.positions.forEach(([bx, by]) => {
                // Only add if not already in completedRows or black hole
                const alreadyAdded = cellsToAnimate.some(c => c.x === bx && c.y === by);
                if (!completedRows.includes(by) && !alreadyAdded) {
                    const centerX = COLS / 2;
                    cellsToAnimate.push({
                        x: bx,
                        y: by,
                        color: blob.color,
                        distance: Math.abs(bx - centerX) + Math.abs(by - (completedRows[0] || 10)) * 0.5,
                        removed: false,
                        alpha: 1,
                        isTsunami: true
                    });
                }
            });
        });
        
        // Create animation with all cells
        const animation = { 
            cells: cellsToAnimate, 
            startTime: Date.now(), 
            duration: 500 
        };
        animation.cells.sort((a, b) => a.distance - b.distance);
        lineAnimations.push(animation);

        setTimeout(() => {
            const sortedRows = completedRows.sort((a, b) => b - a);
            
            console.log(`🎯 Clearing ${sortedRows.length} rows`);
            
            // FIRST: Clear the completed row blocks
            sortedRows.forEach(row => {
                for (let x = 0; x < COLS; x++) {
                    board[row][x] = null;
                    isRandomBlock[row][x] = false;
                    isLatticeBlock[row][x] = false;
                    fadingBlocks[row][x] = null;
                }
                if (window.ChallengeEffects && ChallengeEffects.Amnesia) ChallengeEffects.Amnesia.onRowCleared(row);
            });
            
            // SECOND: Adjust liquidPools for cleared rows (handled by StormEffects module)
            StormEffects.adjustPoolsForClearedRows(sortedRows);
            
            // Use the shared two-phase gravity system
            runTwoPhaseGravity();

            animatingLines = false;
            
            // Check if another clearLines was requested during the animation
            // (e.g., tornado dropped a piece that completed a line)
            if (pendingLineCheck) {
                pendingLineCheck = false;
                console.log('🔄 Processing deferred line check');
                clearLines();
                return; // Don't spawn weather events if we're doing another clear
            }
            
            // Check for tornado/earthquake with difficulty-based probability
            // Only in Maelstrom skill level
            // Wait 1 second after lines clear, then check probability
            // Skip during replay - random events are replayed from recording
            setTimeout(() => {
                if (!gameRunning || paused || GameReplay.isActive()) return;
                
                // Tornadoes and earthquakes only occur in Maelstrom mode
                if (skillLevel !== 'maelstrom') return;
                
                // Determine base probability based on difficulty level
                let eventProbability = 0;
                switch(gameMode) {
                    case 'drizzle': eventProbability = 0.04; break; // 4%
                    case 'downpour': eventProbability = 0.08; break; // 8%
                    case 'hailstorm': eventProbability = 0.12; break; // 12%
                    case 'blizzard': eventProbability = 0.10; break; // 10%
                    case 'hurricane': eventProbability = 0.14; break; // 14%
                }
                
                // Multiply by player's speed bonus (faster play = more events)
                eventProbability *= speedBonusAverage;
                
                // Check if event should occur
                if (Math.random() < eventProbability) {
                    // 66% tornado, 34% earthquake
                    if (Math.random() < 0.66) {
                        spawnTornado();
                    } else {
                        spawnEarthquake();
                    }
                }
            }, 1000);
        }, 500);
    }
}

function rotatePiece() {
    if (!currentPiece || !currentPiece.shape || !Array.isArray(currentPiece.shape) || currentPiece.shape.length === 0) return;
    if (!currentPiece.shape[0] || !Array.isArray(currentPiece.shape[0]) || currentPiece.shape[0].length === 0) return;
    // Prevent rotation during earthquake shift phase (but allow during replay - board syncs at next piece)
    if (earthquakeActive && earthquakePhase === 'shift' && !GameReplay.isActive()) return;
    
    // Additional validation: check if all rows exist and have content
    if (!currentPiece.shape.every(row => row && Array.isArray(row) && row.length > 0)) return;
    
    try {
        const rotated = currentPiece.shape[0].map((_, i) =>
            currentPiece.shape.map(row => row[i]).reverse()
        );
        const previous = currentPiece.shape;
        const originalX = currentPiece.x;
        currentPiece.shape = rotated;
        
        // Wall kick: try original position, then shift left/right up to 2 spaces
        const kicks = [0, -1, 1, -2, 2];
        let rotationSuccessful = false;
        
        for (const kick of kicks) {
            currentPiece.x = originalX + kick;
            if (!collides(currentPiece)) {
                rotationSuccessful = true;
                // Update rotation index
                currentPiece.rotationIndex = ((currentPiece.rotationIndex || 0) + 1) % 4;
                playSoundEffect('rotate', soundToggle);
                // Decaying lock delay reset - each reset is less effective
                if (lockDelayActive && lockDelayResets < MAX_LOCK_DELAY_RESETS) {
                    lockDelayCounter = Math.floor(lockDelayCounter * (1 - LOCK_DELAY_DECAY));
                    lockDelayResets++;
                }
                // Record input for replay
                if (window.GameRecorder && window.GameRecorder.isActive()) {
                    window.GameRecorder.recordInput('rotate', {
                        x: currentPiece.x,
                        y: currentPiece.y,
                        rotation: currentPiece.rotationIndex
                    });
                }
                break;
            }
        }
        
        if (!rotationSuccessful) {
            currentPiece.shape = previous;
            currentPiece.x = originalX;
        }
    } catch (error) {
        // Silently fail and keep the current rotation
    }
}

function rotatePieceCounterClockwise() {
    if (!currentPiece || !currentPiece.shape || !Array.isArray(currentPiece.shape) || currentPiece.shape.length === 0) return;
    if (!currentPiece.shape[0] || !Array.isArray(currentPiece.shape[0]) || currentPiece.shape[0].length === 0) return;
    // Prevent rotation during earthquake shift phase (but allow during replay - board syncs at next piece)
    if (earthquakeActive && earthquakePhase === 'shift' && !GameReplay.isActive()) return;
    
    // Additional validation: check if all rows exist and have content
    if (!currentPiece.shape.every(row => row && Array.isArray(row) && row.length > 0)) return;
    
    try {
        // Counter-clockwise is the opposite of clockwise
        // Clockwise: transpose then reverse each row
        // Counter-clockwise: reverse each row then transpose
        const reversed = currentPiece.shape.map(row => [...row].reverse());
        const rotated = reversed[0].map((_, i) =>
            reversed.map(row => row[i])
        );
        const previous = currentPiece.shape;
        const originalX = currentPiece.x;
        currentPiece.shape = rotated;
        
        // Wall kick: try original position, then shift left/right up to 2 spaces
        const kicks = [0, -1, 1, -2, 2];
        let rotationSuccessful = false;
        
        for (const kick of kicks) {
            currentPiece.x = originalX + kick;
            if (!collides(currentPiece)) {
                rotationSuccessful = true;
                // Update rotation index (CCW = -1, wrap around)
                currentPiece.rotationIndex = ((currentPiece.rotationIndex || 0) + 3) % 4;
                playSoundEffect('rotate', soundToggle);
                // Decaying lock delay reset - each reset is less effective
                if (lockDelayActive && lockDelayResets < MAX_LOCK_DELAY_RESETS) {
                    lockDelayCounter = Math.floor(lockDelayCounter * (1 - LOCK_DELAY_DECAY));
                    lockDelayResets++;
                }
                // Record input for replay
                if (window.GameRecorder && window.GameRecorder.isActive()) {
                    window.GameRecorder.recordInput('rotateCCW', {
                        x: currentPiece.x,
                        y: currentPiece.y,
                        rotation: currentPiece.rotationIndex
                    });
                }
                break;
            }
        }
        
        if (!rotationSuccessful) {
            currentPiece.shape = previous;
            currentPiece.x = originalX;
        }
    } catch (error) {
        // Silently fail and keep the current rotation
    }
}

function movePiece(dir) {
    if (!currentPiece) return;
    // Prevent movement during earthquake shift phase (but allow during replay - board syncs at next piece)
    if (earthquakeActive && earthquakePhase === 'shift' && !GameReplay.isActive()) return;
    
    // Check if controls should be swapped (Stranger XOR Dyslexic)
    const strangerActive = challengeMode === 'stranger' || activeChallenges.has('stranger');
    const dyslexicActive = challengeMode === 'dyslexic' || activeChallenges.has('dyslexic');
    const shouldSwap = strangerActive !== dyslexicActive; // XOR: swap if exactly one is active
    
    const actualDir = shouldSwap ? -dir : dir;
    
    currentPiece.x += actualDir;
    if (collides(currentPiece)) {
        currentPiece.x -= actualDir;
    } else {
        playSoundEffect('move', soundToggle);
        // Decaying lock delay reset - each reset is less effective
        if (lockDelayActive && lockDelayResets < MAX_LOCK_DELAY_RESETS) {
            lockDelayCounter = Math.floor(lockDelayCounter * (1 - LOCK_DELAY_DECAY));
            lockDelayResets++;
        }
        // Record input for replay
        if (window.GameRecorder && window.GameRecorder.isActive()) {
            window.GameRecorder.recordInput(dir > 0 ? 'right' : 'left', {
                x: currentPiece.x,
                y: currentPiece.y,
                rotation: currentPiece.rotationIndex || 0
            });
        }
    }
}

function dropPiece() {
    // During replay, allow drop even if animations are in progress
    // The board will sync at the next piece anyway
    if (!GameReplay.isActive()) {
        if (animatingLines || gravityAnimating || !currentPiece || !currentPiece.shape || gameOverPending) return;
    } else {
        // During replay, only block if no piece
        if (!currentPiece || !currentPiece.shape || gameOverPending) return;
    }
    // Prevent dropping during earthquake shift phase (but allow during replay - board syncs at next piece)
    if (earthquakeActive && earthquakePhase === 'shift' && !GameReplay.isActive()) return;
    
    // Check if piece is already resting (would collide if moved down)
    const wasAlreadyResting = collides(currentPiece, 0, 1);
    
    currentPiece.y++;
    if (collides(currentPiece)) {
        currentPiece.y--;
        
        // If piece was already resting and lock delay is active, don't lock yet
        // (let the update loop handle the lock delay timing)
        if (wasAlreadyResting && lockDelayActive) {
            return;
        }
        
        // During replay, don't lock if there are still inputs pending for this piece
        if (GameReplay.hasPendingInputs()) {
                // Still have inputs to process - activate lock delay to wait
                if (!lockDelayActive) {
                    lockDelayActive = true;
                    lockDelayCounter = 0;
                }
                return; // Don't lock yet
        }
        
        // Check if any block of the piece extends beyond the top of the well
        const extendsAboveTop = currentPiece.shape.some((row, dy) => {
            return row.some((value, dx) => {
                if (value) {
                    const blockY = currentPiece.y + dy;
                    return blockY < 0;
                }
                return false;
            });
        });
        
        if (extendsAboveTop) {
            // During replay, check if we should resync instead of ending
            if (GameReplay.tryResyncOnGameOver()) {
                return; // Resync successful, continue replay
            }
            // Merge visible parts of the piece to the board so they remain visible
            mergePiece();
            currentPiece = null;
            gameOver();
            return;
        }
        
        // Check if piece at current position still overlaps with existing blocks
        // This triggers game over if the piece couldn't escape the spawn collision
        if (collides(currentPiece)) {
            // During replay, check if we should resync instead of ending
            if (GameReplay.tryResyncOnGameOver()) {
                return; // Resync successful, continue replay
            }
            // Merge the piece so it's visible in final state (may overlap, but better than disappearing)
            mergePiece();
            currentPiece = null;
            gameOver();
            return;
        }
        
        playSoundEffect('drop', soundToggle);
        
        // Record human move before merging (captures final position)
        // For human games, also get AI shadow evaluation for comparison
        if (!aiModeEnabled && typeof GameRecorder !== 'undefined' && GameRecorder.isActive()) {
            const moveData = {
                hardDrop: hardDropping,
                thinkTime: pieceSpawnTime ? Date.now() - pieceSpawnTime : 0
            };
            
            // Record placement synchronously (before piece index advances)
            GameRecorder.recordMove(currentPiece, board, moveData, null);
            
            // Get AI shadow evaluation asynchronously (add to correct piece by captured index)
            if (typeof AIPlayer !== 'undefined' && AIPlayer.shadowEvaluate) {
                const pieceSnapshot = {
                    x: currentPiece.x,
                    y: currentPiece.y,
                    rotationIndex: currentPiece.rotationIndex || 0,
                    color: currentPiece.color,
                    type: currentPiece.type,
                    shape: currentPiece.shape
                };
                const boardSnapshot = board.map(row => row ? [...row] : null);
                const capturedPieceIndex = GameRecorder.getCurrentPieceIndex();
                
                AIPlayer.shadowEvaluate(boardSnapshot, pieceSnapshot, nextPieceQueue, COLS, ROWS)
                    .then(aiShadow => {
                        GameRecorder.addAIShadow(capturedPieceIndex, pieceSnapshot, aiShadow);
                    })
                    .catch(() => {});
            }
        }
        
        // Record AI move with decision metadata (for AI games using GameRecorder)
        if (aiModeEnabled && typeof GameRecorder !== 'undefined' && GameRecorder.isActive()) {
            const moveData = {
                hardDrop: true, // AI always hard drops
                thinkTime: pieceSpawnTime ? Date.now() - pieceSpawnTime : 0
            };
            
            // Get the decision metadata from the last AI calculation
            const decisionMeta = typeof AIPlayer !== 'undefined' ? AIPlayer.getLastDecisionMeta() : null;
            
            // Record move and decision metadata
            GameRecorder.recordMove(currentPiece, board, moveData, null);
            if (decisionMeta) {
                GameRecorder.recordAIDecision(decisionMeta);
            }
        }
        
        mergePiece();
        
        // If Yes, And... mode spawned a limb, delay the line check so player can see the limb appear
        const yesAndLimb = window.ChallengeEffects && ChallengeEffects.YesAnd && ChallengeEffects.YesAnd.didSpawnLimb();
        if (yesAndLimb) {
            setTimeout(() => {
                // Check for Tsunamis and Black Holes AFTER limb is visible
                checkForSpecialFormations();
                clearLines();
                ChallengeEffects.YesAnd.clearSpawnFlag();
            }, 400); // 400ms delay to let the limb fade in
        } else {
            // Check for Tsunamis and Black Holes IMMEDIATELY after piece placement
            checkForSpecialFormations();
            clearLines();
        }
        
        if (GameReplay.isActive()) {
            // During replay, advance to next piece from replay data
            GameReplay.advancePiece();
        } else if (nextPieceQueue.length > 0 && nextPieceQueue[0] && nextPieceQueue[0].shape) {
            // Normal play: Spawn the next piece from queue
            currentPiece = nextPieceQueue.shift();
            
            // Note: We don't check for collision at spawn anymore.
            // The player should have a chance to move the piece to safety.
            // Game over only triggers when a piece LOCKS while extending above the playfield.
            
            // Record spawn time for speed bonus calculation
            pieceSpawnTime = Date.now();
            
            // Record piece spawn for v2.0 piece-relative timing
            if (typeof GameRecorder !== 'undefined' && GameRecorder.isActive()) {
                GameRecorder.recordPieceSpawn(currentPiece, board);
            }
            
            // Mercurial mode: Reset timer for new piece
            if (window.ChallengeEffects && ChallengeEffects.Mercurial) ChallengeEffects.Mercurial.reset();
            
            // Check if Six Seven mode should spawn a giant piece
            const isSixSevenMode = challengeMode === 'sixseven' || activeChallenges.has('sixseven');
            let sixSevenPiece = null;
            if (isSixSevenMode && window.ChallengeEffects && ChallengeEffects.SixSeven) {
                sixSevenPiece = ChallengeEffects.SixSeven.trySpawn();
            }
            if (sixSevenPiece) {
                nextPieceQueue.push(sixSevenPiece);
            } else {
                // Create normal piece and add to end of queue
                nextPieceQueue.push(createPiece());
            }
            
            drawNextPiece();
            
            // Gremlins mode: Add or remove random blocks (50/50 chance)
            const isGremlinsMode = challengeMode === 'gremlins' || activeChallenges.has('gremlins');
            if (isGremlinsMode && window.ChallengeEffects && ChallengeEffects.Gremlins) {
                ChallengeEffects.Gremlins.trigger();  // checks counter internally, fires if ready
            }
        } else {
            // During replay, check if we should resync instead of ending
            if (GameReplay.tryResyncOnGameOver()) {
                return; // Resync successful, continue replay
            }
            currentPiece = null; // Clear piece before game over
            gameOver();
        }
    }
}

// Hard drop animation state
let hardDropping = false;
let hardDropVelocity = 0;
let hardDropPixelY = 0; // Track pixel position for smooth visual animation
let hardDropStartY = 0; // Grid Y position when hard drop started

function hardDrop() {
    // During replay, allow hardDrop even if animations are in progress
    // The board will sync at the next piece anyway
    if (!GameReplay.isActive()) {
        if (animatingLines || gravityAnimating || !currentPiece || hardDropping) return;
    } else {
        // During replay, only block if no piece or already dropping
        if (!currentPiece || hardDropping) return;
    }
    // Prevent hard drop during earthquake shift phase (but allow during replay - board syncs at next piece)
    if (earthquakeActive && earthquakePhase === 'shift' && !GameReplay.isActive()) return;
    
    // Record input for replay BEFORE starting drop
    if (window.GameRecorder && window.GameRecorder.isActive()) {
        window.GameRecorder.recordInput('hardDrop', {
            x: currentPiece.x,
            y: currentPiece.y,
            rotation: currentPiece.rotationIndex || 0
        });
    }
    
    // Start animated drop
    hardDropping = true;
    hardDropVelocity = 0;
    hardDropStartY = currentPiece.y;
    hardDropPixelY = currentPiece.y * BLOCK_SIZE; // Start at current position in pixels
    
    playSoundEffect('move', soundToggle); // Initial sound
}

function updateHardDrop() {
    if (!hardDropping || !currentPiece) return;
    
    // SAFETY: Stop hard drop if gravity animation started (but not during replay)
    // This prevents race conditions at high speeds in normal gameplay
    // During replay, let the hard drop continue - board will sync at next piece
    if (!GameReplay.isActive() && (gravityAnimating || animatingLines)) {
        console.log('⚠️ Hard drop interrupted - gravity/line animation in progress');
        hardDropping = false;
        hardDropVelocity = 0;
        hardDropPixelY = 0;
        return;
    }
    
    // Fast hard drop speed
    const hardDropAcceleration = 50;
    const hardDropMaxVelocity = 500;
    
    // Apply acceleration
    hardDropVelocity = Math.min(hardDropVelocity + hardDropAcceleration, hardDropMaxVelocity);
    
    // Update pixel position
    hardDropPixelY += hardDropVelocity;
    
    // Calculate the target grid Y based on pixel position
    const targetGridY = Math.floor(hardDropPixelY / BLOCK_SIZE);
    
    // Move piece grid position to catch up with visual position (for collision detection)
    while (currentPiece.y < targetGridY) {
        if (!collides(currentPiece, 0, 1)) {
            currentPiece.y++;
        } else {
            // Hit something - stop hard drop and place piece
            hardDropping = false;
            hardDropVelocity = 0;
            hardDropPixelY = 0;
            dropPiece();
            return;
        }
    }
    
    // Check if we've hit something at the current position
    if (collides(currentPiece, 0, 1)) {
        // Snap visual to final grid position
        hardDropPixelY = currentPiece.y * BLOCK_SIZE;
        hardDropping = false;
        hardDropVelocity = 0;
        dropPiece();
    }
}

function formatAsBitcoin(points) {
    // Convert points to Bitcoin, divide by 10000 to trim last 4 digits
    const btc = points / 10000000;
    return '₿' + btc.toFixed(4);
}

function updateStats() {
    scoreDisplay.textContent = formatAsBitcoin(score);
    linesDisplay.textContent = lines;
    levelDisplay.textContent = level;
    strikesDisplay.textContent = strikeCount;
    tsunamisDisplay.textContent = tsunamiCount;
    blackHolesDisplay.textContent = blackHoleCount;
    volcanoesDisplay.textContent = volcanoCount;
}

// Show planet statistics

// Toggle visibility of instructions, controls, and settings button
function toggleUIElements(show) {
    const rulesInstructions = document.querySelector('.rules-instructions');
    const histogramCanvas = document.getElementById('histogramCanvas');
    const leaderboardContent = document.getElementById('leaderboardContent');
    const controls = document.querySelector('.controls');
    const controllerControls = document.getElementById('controllerControls');
    const settingsBtn = document.getElementById('settingsBtn');
    const nextPieceSection = document.getElementById('nextPieceSection');
    const titles = document.querySelectorAll('.title');
    const pauseBtn = document.getElementById('pauseBtn');
    const planetStatsLeft = document.getElementById('planetStatsLeft');
    const skillLevelSelect = document.getElementById('skillLevelSelect');
    const rulesPanelViewSelect = document.getElementById('rulesPanelViewSelect');
    
    // Check if leaderboard is currently visible
    const leaderboardVisible = leaderboardContent && leaderboardContent.style.display !== 'none';
    
    if (show) {
        // Show instructions and controls, hide histogram, show title
        // Respect user's saved preference for which panel to show
        const savedView = localStorage.getItem('rulesPanelView') || 'rules';
        if (savedView.startsWith('leaderboard-')) {
            // Show leaderboard
            rulesInstructions.style.display = 'none';
            if (window.leaderboard) {
                // Parse mode from view value
                let lbMode = 'normal';
                if (savedView === 'leaderboard-challenge') lbMode = 'challenge';
                else if (savedView === 'leaderboard-ai') lbMode = 'ai';
                else if (savedView === 'leaderboard-ai-challenge') lbMode = 'ai-challenge';
                window.leaderboard.displayLeaderboard(gameMode || 'drizzle', null, lbMode, skillLevel);
            }
        } else {
            // Show instructions (default)
            if (!leaderboardVisible) {
                rulesInstructions.style.display = 'block';
            }
        }
        if (controls) controls.classList.remove('hidden-during-play');
        if (controllerControls) controllerControls.classList.remove('hidden-during-play');
        settingsBtn.classList.remove('hidden-during-play');
        if (skillLevelSelect) skillLevelSelect.classList.remove('hidden-during-play');
        if (rulesPanelViewSelect) rulesPanelViewSelect.classList.remove('hidden-during-play');
        histogramCanvas.style.display = 'none';
        titles.forEach(title => title.style.display = '');
        
        // Hide tablet mode gameplay elements on menu
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (planetStatsLeft) planetStatsLeft.style.display = 'none';
        
        // Show gesture guide on menu if tablet mode
        const gestureGuide = document.getElementById('gestureGuide');
        if (gestureGuide && TabletMode.enabled) gestureGuide.style.display = 'block';
        
        // Hide planet stats on menu (tablet mode hides it)
        const planetStats = document.getElementById('planetStats');
        if (planetStats && TabletMode.enabled) planetStats.style.display = 'none';
    } else {
        // Hide instructions and controls, show histogram, hide title
        rulesInstructions.style.display = 'none';
        // Also hide leaderboard when game starts
        if (leaderboardContent) leaderboardContent.style.display = 'none';
        if (controls) controls.classList.add('hidden-during-play');
        if (controllerControls) controllerControls.classList.add('hidden-during-play');
        settingsBtn.classList.add('hidden-during-play');
        if (skillLevelSelect) skillLevelSelect.classList.add('hidden-during-play');
        if (rulesPanelViewSelect) rulesPanelViewSelect.classList.add('hidden-during-play');
        histogramCanvas.style.display = 'block';
        titles.forEach(title => title.style.display = 'none');
        
        // Show tablet mode gameplay elements during game
        if (TabletMode.enabled) {
            if (pauseBtn) pauseBtn.style.display = 'block';
        }
        // Always hide left planet stats during gameplay
        if (planetStatsLeft) planetStatsLeft.style.display = 'none';
        
        // Hide gesture guide during gameplay
        const gestureGuide = document.getElementById('gestureGuide');
        if (gestureGuide) gestureGuide.style.display = 'none';
    }
}

async function gameOver() {
    // During replay, just show completion - don't submit scores or record
    if (GameReplay.isActive()) {
        console.log('🎬 Game over during replay - showing completion');
        gameRunning = false;
        GameReplay.showComplete();
        return;
    }
    
    gameRunning = false; StarfieldSystem.setGameRunning(false);
    setGameInProgress(false); // Notify audio system game ended
    gameOverPending = false; // Reset the pending flag
    
    // Record that visitor finished a game (once per visit)
    if (window._visitId && !window._visitFinishRecorded) {
        window._visitFinishRecorded = true;
        fetch(`https://blockchainstorm.onrender.com/api/visit/${window._visitId}/finished`, {
            method: 'PATCH'
        }).catch(() => {});
    }
    document.body.classList.remove('game-running');
    cancelAnimationFrame(gameLoop);
    stopMusic();
    stopTornadoWind(); // Stop tornado wind sound if active
    GamepadController.stopVibration(); // Stop any controller haptic feedback
    setHasPlayedGame(true); // Switch menu music to End Credits version
    playSoundEffect('gameover', soundToggle);
    StarfieldSystem.hidePlanetStats();
    
    // Hide AI mode indicator
    if (aiModeIndicator) aiModeIndicator.style.display = 'none';
    
    // Stop AI recording and offer download + submit to server
    if (aiModeEnabled && typeof AIPlayer !== 'undefined' && AIPlayer.isRecording && AIPlayer.isRecording()) {
        const aiPlayerRecording = await AIPlayer.stopRecording(board, 'game_over');
        if (aiPlayerRecording && aiPlayerRecording.decisions && aiPlayerRecording.decisions.length > 0) {
            console.log(`🎬 AIPlayer Recording complete: ${aiPlayerRecording.decisions.length} decisions recorded`);
        }
    }
    
    // Stop GameRecorder (unified recording for both human and AI games)
    let pendingRecording = null;
    let tuningRecordingData = null; // Store for tuning mode
    if (typeof GameRecorder !== 'undefined' && GameRecorder.isActive()) {
        const finalStats = {
            score: score,
            lines: lines,
            level: level,
            strikes: strikeCount,
            tsunamis: tsunamiCount,
            blackholes: blackHoleCount,
            volcanoes: volcanoCount,
            supermassiveBlackHoles: supermassiveBlackHoleCount,
            superVolcanoes: superVolcanoCount,
            board: board,
            endCause: 'game_over'
        };
        
        // Add tuning config to finalStats if in tuning mode
        if (aiTuningMode && aiTuningConfig) {
            finalStats.tuningConfig = aiTuningConfig;
            finalStats.tuningSetNumber = aiTuningSetNumber;
            finalStats.tuningGameInSet = aiTuningGameInSet;
            finalStats.tuningGameNumber = aiTuningGamesPlayed;
            finalStats.tuningPiecesUsed = aiTuningPieceIndex;
            finalStats.tuningSequenceLength = aiTuningPieceSequence ? aiTuningPieceSequence.length : 0;
            finalStats.tuningExceededSequence = aiTuningPieceIndex > (aiTuningPieceSequence ? aiTuningPieceSequence.length : 0);
        }
        
        const recording = GameRecorder.stopRecording(finalStats);
        // v2.0 uses pieceData instead of moves
        const hasPieceData = recording && recording.pieceData && recording.pieceData.length > 0;
        if (hasPieceData && score > 0) {
            const playerTypeLabel = aiModeEnabled ? 'AI' : 'Human';
            const shadowInfo = recording.finalStats?.humanVsAI ? 
                ` (${recording.finalStats.humanVsAI.matchRate} AI match)` : '';
            console.log(`📹 ${playerTypeLabel} Recording complete: ${recording.pieceData.length} pieces${shadowInfo}`);
            
            if (aiModeEnabled) {
                // Store recording data for tuning mode or normal submission
                tuningRecordingData = {
                    recording: recording,
                    gameData: {
                        username: '🤖 Claude',
                        game: 'blockchainstorm',
                        playerType: 'ai',
                        difficulty: gameMode,
                        skillLevel: skillLevel,
                        mode: challengeMode !== 'normal' ? 'challenge' : 'normal',
                        challenges: Array.from(activeChallenges),
                        speedBonus: speedBonusAverage,
                        score: score,
                        lines: lines,
                        level: level,
                        strikes: strikeCount,
                        tsunamis: tsunamiCount,
                        blackholes: blackHoleCount,
                        volcanoes: volcanoCount,
                        supermassiveBlackHoles: supermassiveBlackHoleCount,
                        superVolcanoes: superVolcanoCount,
                        durationSeconds: Math.floor((recording.finalStats?.duration || 0) / 1000),
                        endCause: 'game_over',
                        tuningConfig: aiTuningMode ? aiTuningConfig : undefined,
                        tuningSetNumber: aiTuningMode ? aiTuningSetNumber : undefined,
                        tuningGameInSet: aiTuningMode ? aiTuningGameInSet : undefined,
                        tuningGameNumber: aiTuningMode ? aiTuningGamesPlayed : undefined
                    }
                };
                
                // In tuning mode, don't submit yet - wait to check leaderboard
                if (!aiTuningMode) {
                    GameRecorder.submitRecording(recording, tuningRecordingData.gameData);
                    console.log('📤 AI Recording submitted to server');
                }
            } else {
                // Human games: Store recording data for submission after name entry
                pendingRecording = {
                    recording: recording,
                    gameData: {
                        game: 'blockchainstorm',
                        playerType: 'human',
                        difficulty: gameMode,
                        skillLevel: skillLevel,
                        mode: challengeMode !== 'normal' ? 'challenge' : 'normal',
                        challenges: Array.from(activeChallenges),
                        speedBonus: speedBonusAverage,
                        score: score,
                        lines: lines,
                        level: level,
                        strikes: strikeCount,
                        tsunamis: tsunamiCount,
                        blackholes: blackHoleCount,
                        volcanoes: volcanoCount,
                        supermassiveBlackHoles: supermassiveBlackHoleCount,
                        superVolcanoes: superVolcanoCount,
                        durationSeconds: Math.floor((recording.finalStats?.duration || 0) / 1000),
                        endCause: 'game_over',
                        debugLog: logQueue.join('\n')
                    }
                };
                window.pendingGameRecording = pendingRecording;
            }
        }
    }
    
    // Stop any ongoing controller haptic feedback
    GamepadController.stopVibration();
    
    // Clear all touch repeat timers
    touchRepeat.timers.forEach((timerObj, element) => {
        if (timerObj.initial) clearTimeout(timerObj.initial);
        if (timerObj.repeat) clearInterval(timerObj.repeat);
    });
    touchRepeat.timers.clear();
    
    finalScoreDisplay.textContent = I18n.t('gameOver.finalScore', { score: formatAsBitcoin(score) });
    
    // Display special event statistics
    let statsHTML = I18n.t('gameOver.lines', { lines: lines, level: level }) + '<br>';
    if (aiModeEnabled) {
        statsHTML += `<br><span style="color: #00ffff;">${I18n.t('gameOver.aiMode')}</span><br>`;
    }
    if (strikeCount > 0 || tsunamiCount > 0 || volcanoCount > 0 || blackHoleCount > 0) {
        statsHTML += '<br>';
        if (strikeCount > 0) statsHTML += I18n.t('gameOver.strikes', { count: strikeCount }) + '<br>';
        if (tsunamiCount > 0) statsHTML += I18n.t('gameOver.tsunamis', { count: tsunamiCount }) + '<br>';
        if (volcanoCount > 0) {
            statsHTML += I18n.t('gameOver.volcanoes', { count: volcanoCount });
            if (superVolcanoCount > 0) statsHTML += ` (${superVolcanoCount} 🌋🌊)`;
            statsHTML += '<br>';
        }
        if (blackHoleCount > 0) {
            statsHTML += I18n.t('gameOver.blackHoles', { count: blackHoleCount });
            if (supermassiveBlackHoleCount > 0) statsHTML += ` (${supermassiveBlackHoleCount} 🕳️🌊)`;
            statsHTML += '<br>';
        }
    }
    finalStatsDisplay.innerHTML = statsHTML;
    
    toggleUIElements(true);
    
    // Determine if this is a challenge mode game
    const isChallenge = challengeMode !== 'normal';
    
    // Build list of active challenges
    let challengesList = [];
    if (isChallenge) {
        if (challengeMode === 'combo') {
            // Combo mode - list all active challenges
            challengesList = Array.from(activeChallenges);
        } else {
            // Single challenge mode
            challengesList = [challengeMode];
        }
    }
    
    // Prepare score data for submission
    const scoreData = {
        game: 'blockchainstorm',
        gameTitle: window.GAME_TITLE || 'BLOCKCHaiNSTOЯM',
        difficulty: gameMode,
        mode: isChallenge ? 'challenge' : 'normal',
        skillLevel: skillLevel,
        score: score,
        lines: lines,
        level: level,
        strikes: strikeCount,
        tsunamis: tsunamiCount,
        blackholes: blackHoleCount,
        volcanoes: volcanoCount || 0,
        supermassiveBlackHoles: supermassiveBlackHoleCount,
        superVolcanoes: superVolcanoCount,
        duration: Math.floor((Date.now() - gameStartTime) / 1000),
        challengeType: isChallenge ? challengeMode : null, // Track main challenge mode
        challenges: challengesList, // Track all active challenges
        speedBonus: speedBonusAverage // Speed bonus multiplier (0.0 - 2.0)
    };
    
    
    // Check if score makes top 20 (but not in AI mode)
    console.log('Checking if score makes top 20...');
    
    // AI Mode: Handle differently based on tuning mode
    if (aiModeEnabled && window.leaderboard) {
        const aiMode = isChallenge ? 'ai-challenge' : 'ai';
        scoreData.mode = aiMode;
        
        // TUNING MODE: Special handling
        if (aiTuningMode) {
            console.log(`🔧 TUNING MODE: Set #${aiTuningSetNumber} Game #${aiTuningGameInSet} complete - Score: ${score}, Lines: ${lines}`);
            
            // Always download the recording for analysis
            if (tuningRecordingData) {
                const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/[/,: ]+/g, '-');
                const filename = `tuning_${aiTuningDifficulty}_${aiTuningSkillLevel}_game_${aiTuningSetNumber}_${aiTuningGameInSet}_${score}_${timestamp}.json`;
                const fullRecording = {
                    ...tuningRecordingData.gameData,
                    recording_data: tuningRecordingData.recording
                };
                downloadRecordingJSON(fullRecording, filename);
            }
            
            // Check if makes leaderboard - only submit if it does (but skip email notification)
            const makesLeaderboard = await window.leaderboard.checkIfTopTen(gameMode, score, aiMode, skillLevel);
            if (makesLeaderboard && tuningRecordingData) {
                console.log('🔧 TUNING: Score makes leaderboard! Submitting (no email)...');
                scoreData.skipNotification = true;
                await window.leaderboard.submitAIScore(scoreData);
                tuningRecordingData.gameData.skipNotification = true;
                GameRecorder.submitRecording(tuningRecordingData.recording, tuningRecordingData.gameData);
            } else {
                console.log('🔧 TUNING: Score does not make leaderboard, skipping submission');
            }
            
            // Brief pause then auto-restart with new config (no game over screen)
            setTimeout(() => {
                if (aiTuningMode) {
                    startTuningGame();
                }
            }, 500);
            
            return;
        }
        
        // Normal AI mode (not tuning)
        console.log(`AI Mode: Auto-submitting score as "🤖 Claude" (mode: ${aiMode})`);
        await window.leaderboard.submitAIScore(scoreData);
        showGameOverScreen();
        await window.leaderboard.displayLeaderboard(gameMode, score, aiMode, skillLevel);
        
        // Start auto-restart timer for AI mode (10 seconds)
        startAIAutoRestartTimer();
        return;
    }
    
    const isTopTen = !aiModeEnabled && window.leaderboard ? await window.leaderboard.checkIfTopTen(gameMode, score, scoreData.mode, skillLevel) : false;
    console.log('Is top twenty:', isTopTen);
    
    if (isTopTen && window.leaderboard) {
        // DON'T show game over div yet - go to name prompt first
        // Credits and music will start after score submission via onScoreSubmitted callback
        console.log('Score is top 20! Showing name entry prompt...');
        gameOverDiv.style.display = 'none';
        
        // Pass callback if leaderboard supports it, also set up fallback detection
        window.leaderboard.promptForName(scoreData, onScoreSubmitted);
        
        // Fallback: Watch for leaderboard popup to close if callback isn't called
        startLeaderboardCloseDetection();
    } else {
        // Score didn't make top 20, show game over div, credits, and music immediately
        console.log('Score did not make top 20, displaying game over and leaderboard');
        showGameOverScreen();
        if (window.leaderboard) {
            await window.leaderboard.displayLeaderboard(gameMode, score, scoreData.mode, skillLevel);
            // Send notification for non-high-score game completion
            window.leaderboard.notifyGameCompletion(scoreData);
        }
        // Submit pending recording with stored username or Anonymous
        if (typeof window.submitPendingRecording === 'function') {
            const storedUsername = localStorage.getItem('blockchainstorm_username') || 'Anonymous';
            window.submitPendingRecording(storedUsername);
        }
    }
}

// Called after high score submission is complete
let scoreSubmittedHandled = false;

function onScoreSubmitted() {
    if (scoreSubmittedHandled) {
        console.log('onScoreSubmitted already handled, skipping');
        return;
    }
    scoreSubmittedHandled = true;
    
    console.log('=== onScoreSubmitted called ===');
    stopLeaderboardCloseDetection();
    showGameOverScreen();
    console.log('=== onScoreSubmitted complete ===');
}

// Expose globally so leaderboard.js can call it
window.onScoreSubmitted = onScoreSubmitted;

// Function for leaderboard.js to call when submitting a high score with a name
window.submitPendingRecording = function(username) {
    if (window.pendingGameRecording && typeof GameRecorder !== 'undefined') {
        const pending = window.pendingGameRecording;
        pending.gameData.username = username || 'Anonymous';
        console.log(`📤 Submitting recording with username: ${pending.gameData.username}`);
        GameRecorder.submitRecording(pending.recording, pending.gameData);
        window.pendingGameRecording = null;
    }
};

// Fallback detection for when leaderboard popup closes
let leaderboardCloseInterval = null;
let leaderboardCloseObserver = null;
let leaderboardTimeoutId = null;

function startLeaderboardCloseDetection() {
    // Stop any existing detection
    stopLeaderboardCloseDetection();
    
    // Method 1: Timeout fallback - show game over after 2 minutes no matter what
    // This is a safety net for edge cases; normally onScoreSubmitted is called after name entry
    leaderboardTimeoutId = setTimeout(() => {
        console.log('Leaderboard timeout reached');
        console.log('gameOverDiv.style.display:', gameOverDiv.style.display);
        console.log('gameRunning:', gameRunning);
        
        // Always call onScoreSubmitted on timeout - even if game over is showing,
        // we need to start the credits animation
        if (!gameRunning) {
            console.log('Calling onScoreSubmitted from timeout');
            onScoreSubmitted();
        } else {
            console.log('Game is running, skipping onScoreSubmitted');
        }
    }, 120000); // 2 minute timeout - gives user time to enter name
    
    // Method 2: Poll for leaderboard overlay disappearing
    leaderboardCloseInterval = setInterval(() => {
        const leaderboardOverlay = document.querySelector('.leaderboard-overlay, .name-entry-overlay, [class*="leaderboard"][class*="overlay"]');
        const namePrompt = document.querySelector('.name-prompt, .score-entry, [class*="name"][class*="prompt"]');
        
        // If neither popup is visible and game over screen isn't showing yet
        if (!leaderboardOverlay && !namePrompt && gameOverDiv.style.display !== 'block') {
            // Check if we're not in a game (gameRunning would be true if we started a new game)
            if (!gameRunning && !modeMenu.classList.contains('hidden') === false) {
                console.log('Leaderboard popup closed (detected via polling)');
                onScoreSubmitted();
            }
        }
    }, 500);
    
    // Method 3: MutationObserver to watch for DOM changes
    leaderboardCloseObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.removedNodes) {
                if (node.nodeType === 1) { // Element node
                    const isLeaderboardPopup = node.classList && (
                        node.classList.contains('leaderboard-overlay') ||
                        node.classList.contains('name-entry-overlay') ||
                        node.classList.contains('name-prompt')
                    );
                    if (isLeaderboardPopup && gameOverDiv.style.display !== 'block') {
                        console.log('Leaderboard popup closed (detected via MutationObserver)');
                        onScoreSubmitted();
                        return;
                    }
                }
            }
        }
    });
    
    leaderboardCloseObserver.observe(document.body, { childList: true, subtree: true });
}

function stopLeaderboardCloseDetection() {
    if (leaderboardCloseInterval) {
        clearInterval(leaderboardCloseInterval);
        leaderboardCloseInterval = null;
    }
    if (leaderboardCloseObserver) {
        leaderboardCloseObserver.disconnect();
        leaderboardCloseObserver = null;
    }
    if (leaderboardTimeoutId) {
        clearTimeout(leaderboardTimeoutId);
        leaderboardTimeoutId = null;
    }
}

// Show game over popup, start credits animation, and play end credits music
function showGameOverScreen() {
    console.log('showGameOverScreen called');
    console.log('gameOverDiv:', gameOverDiv);
    
    // Hide planet stats when showing game over screen
    StarfieldSystem.hidePlanetStats();
    
    gameOverDiv.style.display = 'block';
    updateShareLinks();
    
    console.log('About to call startCreditsAnimation');
    startCreditsAnimation();
    console.log('startCreditsAnimation returned');
    
    // Delay music start by 3 seconds after credits begin
    creditsMusicTimeoutId = setTimeout(() => {
        console.log('Starting credits music after 3 second delay');
        // Stop any existing menu music and restart with end credits
        stopMenuMusic();
        startMenuMusic(musicSelect); // This will play End Credits version since hasPlayedGame is true
        creditsMusicTimeoutId = null;
    }, 3000);
}

// AI Auto-restart functionality
const AI_DIFFICULTY_OPTIONS = ['drizzle', 'downpour', 'hailstorm', 'blizzard', 'hurricane'];
const AI_SKILL_OPTIONS = ['breeze', 'tempest', 'maelstrom'];

// All challenge types for AI random selection
const AI_CHALLENGE_POOL = [
    'stranger', 'dyslexic', 'phantom', 'rubber', 'oz', 'thinner',
    'nervous', 'sixseven', 'gremlins', 'lattice', 'yesand', 'mercurial',
    'shadowless', 'amnesia', 'vertigo', 'carrie', 'nokings',
    'longago', 'comingsoon'
];
// thicker excluded: wider board changes game mode category

function randomizeAIChallenges() {
    // Uncheck all combo checkboxes
    document.querySelectorAll('.combo-checkbox-option input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    // 30% normal, 40% single challenge, 30% combo (2-4 challenges)
    const roll = Math.random();
    if (roll < 0.30) {
        console.log('🤖 AI Challenge: Normal (no challenges)');
        return;
    }
    
    // Shuffle pool
    const pool = [...AI_CHALLENGE_POOL];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    
    const count = roll < 0.70 ? 1 : Math.floor(Math.random() * 3) + 2; // 1 or 2-4
    const selected = [];
    
    for (const challenge of pool) {
        if (selected.length >= count) break;
        // Enforce mutual exclusivity: longago and comingsoon
        if (challenge === 'comingsoon' && selected.includes('longago')) continue;
        if (challenge === 'longago' && selected.includes('comingsoon')) continue;
        selected.push(challenge);
    }
    
    // Check the corresponding combo checkboxes
    const idMap = {
        'stranger': 'comboStranger', 'dyslexic': 'comboDyslexic', 'phantom': 'comboPhantom',
        'rubber': 'comboRubber', 'oz': 'comboOz', 'thinner': 'comboThinner',
        'thicker': 'comboThicker', 'nervous': 'comboNervous', 'carrie': 'comboCarrie',
        'nokings': 'comboNokings', 'longago': 'comboLongAgo', 'comingsoon': 'comboComingSoon',
        'sixseven': 'comboSixSeven', 'gremlins': 'comboGremlins', 'lattice': 'comboLattice',
        'yesand': 'comboYesAnd', 'mercurial': 'comboMercurial', 'shadowless': 'comboShadowless',
        'amnesia': 'comboAmnesia', 'vertigo': 'comboVertigo'
    };
    
    selected.forEach(ch => {
        const el = document.getElementById(idMap[ch]);
        if (el) el.checked = true;
    });
    
    console.log(`🤖 AI Challenge: ${selected.length > 1 ? 'Combo' : 'Single'} - ${selected.join(', ')}`);
}

function startAIAutoRestartTimer() {
    // Clear any existing timer
    cancelAIAutoRestartTimer();
    
    console.log('🤖 AI Auto-restart: Starting 10 second countdown...');
    
    aiAutoRestartTimerId = setTimeout(() => {
        if (!aiModeEnabled) {
            console.log('🤖 AI Auto-restart: AI mode disabled, cancelling');
            return;
        }
        
        // Randomly select difficulty and skill level
        const randomDifficulty = AI_DIFFICULTY_OPTIONS[Math.floor(Math.random() * AI_DIFFICULTY_OPTIONS.length)];
        const randomSkill = AI_SKILL_OPTIONS[Math.floor(Math.random() * AI_SKILL_OPTIONS.length)];
        
        // Randomly select challenges
        randomizeAIChallenges();
        
        // Randomly select a color palette
        if (typeof ColorPalettes !== 'undefined') {
            const categories = ColorPalettes.getPalettesByCategory();
            const allPaletteIds = [];
            for (const cat of Object.values(categories)) {
                cat.forEach(p => allPaletteIds.push(p.id));
            }
            if (allPaletteIds.length > 0) {
                const randomPalette = allPaletteIds[Math.floor(Math.random() * allPaletteIds.length)];
                selectPalette(randomPalette);
                console.log(`🤖 AI Auto-restart: Palette → ${randomPalette}`);
            }
        }
        
        console.log(`🤖 AI Auto-restart: Starting new game with ${randomDifficulty} / ${randomSkill}`);
        
        // Set the skill level globally (both local var and window for AI player)
        skillLevel = randomSkill;
        window.skillLevel = randomSkill;
        
        // Update all skill level UI selects
        const skillLevelSelect = document.getElementById('skillLevelSelect');
        const introSkillLevelSelect = document.getElementById('introSkillLevelSelect');
        if (skillLevelSelect) skillLevelSelect.value = randomSkill;
        if (introSkillLevelSelect) introSkillLevelSelect.value = randomSkill;
        if (typeof updateSkillLevelButton === 'function') updateSkillLevelButton();
        
        // Update special events display for new skill level
        updateSpecialEventsDisplay(randomSkill);
        
        // Hide game over screen and leaderboard
        gameOverDiv.style.display = 'none';
        if (window.leaderboard && window.leaderboard.hideLeaderboard) {
            window.leaderboard.hideLeaderboard();
        }
        
        // Stop credits
        stopCreditsAnimation();
        
        // Start new game with random difficulty
        startGame(randomDifficulty);
        
        aiAutoRestartTimerId = null;
    }, 10000);
}

function cancelAIAutoRestartTimer() {
    if (aiAutoRestartTimerId) {
        clearTimeout(aiAutoRestartTimerId);
        aiAutoRestartTimerId = null;
        console.log('🤖 AI Auto-restart: Timer cancelled');
    }
}

// ==================== AI TUNING MODE ====================
// Generate a random valid AI configuration for testing
function generateRandomTuningConfig() {
    // Helper to pick random value from range
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randFloat = (min, max, decimals = 1) => {
        const val = Math.random() * (max - min) + min;
        return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
    };
    
    // Generate survival thresholds with valid hysteresis (enter > exit)
    const survivalEnterHeight = randInt(8, 14);
    const survivalExitHeight = randInt(5, survivalEnterHeight - 1);
    const survivalEnterHoles = randInt(6, 15);
    const survivalExitHoles = randInt(2, survivalEnterHoles - 1);
    
    return {
        // Survival mode thresholds (with valid hysteresis)
        survivalEnterHeight,
        survivalExitHeight,
        survivalEnterHoles,
        survivalExitHoles,
        
        // Phase thresholds
        criticalHeight: randInt(14, 18),
        criticalHoles: randInt(8, 15),
        dangerHeight: randInt(12, 16),
        dangerHoles: randInt(5, 10),
        cautionHeight: randInt(10, 14),
        cautionHoles: randInt(3, 8),
        
        // Lookahead (lookaheadDepth fixed at 6, not randomized)
        lookaheadDiscount: randFloat(0.5, 1.0),
        
        // Blob building bonuses
        horizontalAdjacencyBonus: randInt(8, 25),
        verticalAdjacencyBonus: randInt(2, 8),
        tsunamiRowBonusMultiplier: randInt(10, 25),
        tsunamiEdgeExtensionBonus: randInt(50, 120),
        tsunamiMatchingColorBonus: randInt(3, 12),
        
        // Tsunami bonuses by width
        tsunamiImminentBonus: randInt(200, 500),
        tsunamiImminentPerExtra: randInt(100, 250),
        tsunamiAchievableBonus: randInt(150, 350),
        tsunamiAchievablePerQueue: randInt(25, 80),
        tsunamiNearCompleteBonus: randInt(80, 200),
        tsunamiNearCompletePerExtra: randInt(15, 60),
        tsunamiBuildingBonus: randInt(30, 100),
        tsunamiBuildingPerExtra: randInt(10, 40),
        tsunamiWastePenaltyW8: randInt(100, 250),
        tsunamiWastePenaltyW7: randInt(50, 150),
        
        // Black hole bonuses
        blackHoleNearCompleteBonus: randInt(60, 200),
        blackHoleBuildingBonus: randInt(30, 120),
        blackHoleEarlyBonus: randInt(15, 60),
        blackHoleSizeMultiplier: randInt(3, 12),
        blackHoleCautionScale: randFloat(0.4, 0.9),
        
        // Line clear bonuses in survival mode
        survivalClear4Bonus: randInt(400, 900),
        survivalClear3Bonus: randInt(250, 600),
        survivalClear2Bonus: randInt(150, 400),
        survivalClear1Bonus: randInt(80, 250),
        
        // Height penalties
        survivalHeightMultiplier: randFloat(2.0, 5.0),
        normalHeightMultiplier: randFloat(1.5, 4.0),
        normalHeightThreshold: randInt(6, 12),
        
        // Hole penalties
        holePenaltyBase: randInt(10, 35),
        holePenaltyMedium: randInt(35, 80),
        holePenaltyHigh: randInt(45, 100),
        
        // Bumpiness
        bumpinessPenalty: randFloat(1.5, 5.0),
        
        // Stacking penalty
        stackingPenaltyPerExcess: randInt(8, 20),
        stackingPenaltySmall: randInt(3, 10),
        stackingSurvivalMultiplier: randFloat(1.5, 3.0),
        
        // Vertical I-piece penalties
        verticalISlightPenalty: randInt(20, 80),
        verticalIModeratePenalty: randInt(80, 180),
        verticalISeverePenalty: randInt(150, 300),
        verticalISurvivalExtraPenalty: randInt(60, 180),
        
        // Tower penalties
        towerThresholdSevere: randInt(6, 12),
        towerThresholdBad: randInt(4, 8),
        towerThresholdModerate: randInt(2, 6),
        towerPenaltySevere: randInt(6, 18),
        towerPenaltyBad: randInt(4, 12),
        towerPenaltyModerate: randInt(2, 6)
    };
}

// Start AI tuning mode
function startAITuningMode(difficulty, skill) {
    aiTuningMode = true;
    aiTuningDifficulty = difficulty;
    aiTuningSkillLevel = skill;
    aiTuningGamesPlayed = 0;
    aiTuningPieceSequence = null; // Will be captured during game 1 of each set
    aiTuningPieceIndex = 0;
    aiTuningSetNumber = 1;
    aiTuningGameInSet = 0;
    
    console.log(`🔧 AI TUNING MODE STARTED - ${difficulty} / ${skill}`);
    console.log(`🔧 Each set runs ${TUNING_GAMES_PER_SET} games with the same piece sequence.`);
    console.log('🔧 Click STOP indicator to end tuning session.');
    
    // Show tuning mode indicator
    showTuningModeIndicator();
    
    // Start first game
    startTuningGame();
}

// Stop AI tuning mode
function stopAITuningMode() {
    aiTuningMode = false;
    aiTuningConfig = null;
    aiTuningDifficulty = null;
    aiTuningSkillLevel = null;
    aiTuningPieceSequence = null; // Clear piece sequence
    aiTuningPieceIndex = 0;
    aiTuningSetNumber = 1;
    aiTuningGameInSet = 0;
    
    console.log(`🔧 AI TUNING MODE STOPPED after ${aiTuningGamesPlayed} games`);
    
    // Hide tuning mode indicator
    hideTuningModeIndicator();
    
    // Cancel any pending restart
    cancelAIAutoRestartTimer();
}

// Start a single tuning game with random config
function startTuningGame() {
    if (!aiTuningMode) return;
    
    aiTuningGamesPlayed++;
    aiTuningGameInSet++;
    aiTuningPieceIndex = 0; // Reset piece index for this game
    
    // Check if we need to start a new set (every TUNING_GAMES_PER_SET games)
    if (aiTuningGameInSet > TUNING_GAMES_PER_SET) {
        aiTuningSetNumber++;
        aiTuningGameInSet = 1;
        aiTuningPieceSequence = null; // Clear to capture new sequence
        console.log(`🔧 STARTING NEW SET #${aiTuningSetNumber} - will capture new piece sequence`);
    }
    
    // Game 1 of each set: Initialize empty sequence to capture pieces
    // Game 2+ of set: Keep existing sequence for replay
    if (aiTuningGameInSet === 1) {
        aiTuningPieceSequence = []; // Will be populated as pieces are created
        console.log(`🔧 SET #${aiTuningSetNumber} GAME #${aiTuningGameInSet}: Capturing piece sequence...`);
    } else {
        console.log(`🔧 SET #${aiTuningSetNumber} GAME #${aiTuningGameInSet}: Using captured sequence (${aiTuningPieceSequence.length} pieces)`);
    }
    
    // Generate new random config
    aiTuningConfig = generateRandomTuningConfig();
    
    console.log(`🔧 Config:`, aiTuningConfig);
    
    // Send config to AI worker
    if (typeof AIPlayer !== 'undefined' && AIPlayer.setConfig) {
        AIPlayer.setConfig(aiTuningConfig);
    }
    
    // Set skill level
    skillLevel = aiTuningSkillLevel;
    window.skillLevel = aiTuningSkillLevel;
    
    // Hide game over screen
    gameOverDiv.style.display = 'none';
    if (window.leaderboard && window.leaderboard.hideLeaderboard) {
        window.leaderboard.hideLeaderboard();
    }
    stopCreditsAnimation();
    
    // Update tuning indicator
    updateTuningModeIndicator();
    
    // Start the game
    startGame(aiTuningDifficulty);
}

// Show tuning mode indicator overlay
function showTuningModeIndicator() {
    let indicator = document.getElementById('tuningModeIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'tuningModeIndicator';
        indicator.style.cssText = `
            position: fixed;
            top: 1vh;
            left: 1vw;
            background: rgba(255, 165, 0, 0.9);
            color: black;
            padding: 1vh 2vw;
            border-radius: 1vh;
            font-family: monospace;
            font-size: 1.8vh;
            z-index: 10001;
            cursor: pointer;
            box-shadow: 0 0 10px rgba(255, 165, 0, 0.5);
        `;
        indicator.innerHTML = '🔧 TUNING MODE<br><span id="tuningSetCount">Set #1</span> - <span id="tuningGameCount">Game #1</span><br><span id="tuningPieceStatus">Capturing pieces...</span><br><span style="color: #600; font-weight: bold;">[CLICK TO STOP]</span>';
        indicator.addEventListener('click', () => {
            stopAITuningMode();
        });
        document.body.appendChild(indicator);
    }
    indicator.style.display = 'block';
}

// Update tuning mode indicator
function updateTuningModeIndicator() {
    const setSpan = document.getElementById('tuningSetCount');
    const countSpan = document.getElementById('tuningGameCount');
    const statusSpan = document.getElementById('tuningPieceStatus');
    if (setSpan) {
        setSpan.textContent = `Set #${aiTuningSetNumber}`;
    }
    if (countSpan) {
        countSpan.textContent = `Game #${aiTuningGameInSet}`;
    }
    if (statusSpan) {
        if (aiTuningGameInSet === 1) {
            statusSpan.textContent = 'Capturing pieces...';
            statusSpan.style.color = '#600';
        } else {
            const pieceCount = aiTuningPieceSequence ? aiTuningPieceSequence.length : 0;
            statusSpan.textContent = `Replaying ${pieceCount} pieces`;
            statusSpan.style.color = '#060';
        }
    }
}

// Hide tuning mode indicator
function hideTuningModeIndicator() {
    const indicator = document.getElementById('tuningModeIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// Download recording as JSON file
function downloadRecordingJSON(recording, filename) {
    const jsonStr = JSON.stringify(recording, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`📥 Downloaded: ${filename}`);
}

function update(time = 0) {
    if (!gameRunning || gameOverPending) return;

    const deltaTime = time - (update.lastTime || 0);
    update.lastTime = time;
    
    // Deterministic replay mode: process recorded inputs instead of AI or keyboard
    if (GameReplay.isActive()) {
        GameReplay.processInputs();
    }
    
    // AI Mode: Let AI control the game (but not during replay)
    if (!GameReplay.isActive() && aiModeEnabled && !paused && currentPiece && !hardDropping && !animatingLines && !gravityAnimating && !tsunamiAnimating && typeof AIPlayer !== 'undefined') {
        AIPlayer.setSkillLevel(skillLevel);
        // Pass the full queue so AI can plan ahead based on upcoming colors
        // Also pass earthquake state so AI can hold off during earthquakes
        // Pass UFO state so AI can avoid clearing lines during easter egg
        // Pass tuning mode so AI can skip UFO soft-drop behavior
        AIPlayer.update(board, currentPiece, nextPieceQueue, COLS, ROWS, {
            moveLeft: () => movePiece(-1),
            moveRight: () => movePiece(1),
            rotate: () => rotatePiece(),
            hardDrop: () => hardDrop(),
            softDrop: () => dropPiece()
        }, {
            earthquakeActive: earthquakeActive,
            earthquakePhase: earthquakePhase,
            ufoActive: StarfieldSystem.isUFOActive(),
            tuningMode: aiTuningMode
        });
    }
    
    // Update AI mode indicator (developer mode only) - update every frame
    // Don't show during replay
    if (!GameReplay.isActive() && aiModeEnabled && typeof AIPlayer !== 'undefined') {
        updateAIModeIndicator();
    }
    
    // Update hard drop animation
    if (!paused && hardDropping) {
        updateHardDrop();
    }
    
    // Don't drop pieces during black hole or tsunami animation or hard drop or earthquake shift or gravity
    // During replay, bypass most animation checks since board syncs at piece boundaries
    const earthquakeShiftActive = earthquakeActive && earthquakePhase === 'shift' && !GameReplay.isActive();
    const blockDropForAnimations = !GameReplay.isActive() && (animatingLines || gravityAnimating || blackHoleAnimating || tsunamiAnimating);
    if (!paused && !blockDropForAnimations && !hardDropping && !earthquakeShiftActive && currentPiece) {
        // Check if piece is resting on the stack (would collide if moved down)
        const isResting = collides(currentPiece, 0, 1);
        
        if (isResting) {
            // Piece is resting - use lock delay system
            if (!lockDelayActive) {
                // Just landed - start lock delay
                lockDelayActive = true;
                lockDelayCounter = 0;
            }
            lockDelayCounter += deltaTime;
            
            // Calculate effective lock delay (decays as lines increase)
            const effectiveLockDelay = calculateLockDelayTime(lines);
            
            // Only lock after lock delay time has elapsed
            if (lockDelayCounter >= effectiveLockDelay) {
                // During replay, don't lock if there are still inputs pending for this piece
                if (GameReplay.hasPendingInputs()) {
                        // Still have inputs to process - don't lock yet
                        // Cap lock delay counter to prevent runaway values
                        lockDelayCounter = effectiveLockDelay;
                        // Don't return here! Just skip the lock, let animations continue
                } else if (GameReplay.isActive()) {
                        // All inputs processed - reset lock delay and lock the piece
                        lockDelayActive = false;
                        lockDelayCounter = 0;
                        lockDelayResets = 0;
                        dropPiece();
                        dropCounter = 0;
                } else {
                    // Not in replay, or no piece data - normal lock
                    lockDelayActive = false;
                    lockDelayCounter = 0;
                    lockDelayResets = 0;
                    dropPiece();
                    dropCounter = 0;
                }
            }
        } else {
            // Piece is not resting - use normal drop timing
            lockDelayActive = false;
            lockDelayCounter = 0;
            lockDelayResets = 0; // Reset when piece leaves the stack
            
            dropCounter += deltaTime;
            if (dropCounter > dropInterval) {
                dropPiece();
                dropCounter = 0;
            }
        }
    }
    
    // If current piece is null (bounced away), spawn new piece
    if (!paused && !currentPiece && nextPieceQueue.length > 0 && window.ChallengeEffects && ChallengeEffects.Rubber && ChallengeEffects.Rubber.count() > 0) {
        currentPiece = nextPieceQueue.shift();
        
        // Note: We don't check for collision at spawn anymore.
        // The player should have a chance to move the piece to safety.
        // Game over only triggers when a piece LOCKS while extending above the playfield.
        
        // Record spawn time for speed bonus calculation
        pieceSpawnTime = Date.now();
        
        // Record piece spawn for v2.0 piece-relative timing
        if (typeof GameRecorder !== 'undefined' && GameRecorder.isActive()) {
            GameRecorder.recordPieceSpawn(currentPiece, board);
        }
        
        // Mercurial mode: Reset timer for new piece
        if (window.ChallengeEffects && ChallengeEffects.Mercurial) ChallengeEffects.Mercurial.reset();
        
        // Check if Six Seven mode should spawn a giant piece
        const isSixSevenMode = challengeMode === 'sixseven' || activeChallenges.has('sixseven');
        let sixSevenPiece = null;
        if (isSixSevenMode && window.ChallengeEffects && ChallengeEffects.SixSeven) {
            sixSevenPiece = ChallengeEffects.SixSeven.trySpawn();
        }
        if (sixSevenPiece) {
            nextPieceQueue.push(sixSevenPiece);
        } else {
            nextPieceQueue.push(createPiece());
        }
        
        drawNextPiece();
    }

    updateLineAnimations();
    if (!paused) {
        // Mercurial mode: Change piece color every 2-4 seconds
        const isMercurialMode = challengeMode === 'mercurial' || activeChallenges.has('mercurial');
        if (isMercurialMode && currentPiece && !hardDropping && window.ChallengeEffects && ChallengeEffects.Mercurial) {
            const newColor = ChallengeEffects.Mercurial.update(deltaTime);
            if (newColor) currentPiece.color = newColor;
        }
        
        updateFadingBlocks();
        if (window.ChallengeEffects && ChallengeEffects.Gremlins) ChallengeEffects.Gremlins.update();
        StormEffects.updateGameState({ gameRunning, paused, board }); // Pass current state
        StormEffects.update(); // Update storm particles (includes dripping liquids)
        updateTornado(); // Update tornado
        StarfieldSystem.updateUFO(); // Update UFO animation (42 lines easter egg)
        updateEarthquake(); // Update earthquake
        updateDisintegrationParticles(); // Update explosion particles
        updateBlackHoleAnimation(); // Update black hole animation
        updateTsunamiAnimation(); // Update tsunami animation
        updateVolcanoAnimation(); // Update volcano animation
        updateFallingBlocks(); // Update falling blocks from gravity
        if (window.ChallengeEffects && ChallengeEffects.Rubber) ChallengeEffects.Rubber.update(); // Update bouncing pieces (Rubber & Glue mode)
        if (!GameReplay.isActive()) {
            GamepadController.update(); // Update gamepad controller input (skip during replay)
        }
    }
    
    // Apply horizontal earthquake shake during shake, crack and shift phases
    if (earthquakeActive && (earthquakePhase === 'shake' || earthquakePhase === 'crack' || earthquakePhase === 'shift')) {
        const shakeX = (Math.random() - 0.5) * earthquakeShakeIntensity * 2;
        ctx.save();
        ctx.translate(shakeX, 0);
    }
    
    // Apply screen shake during black hole
    if (blackHoleAnimating && blackHoleShakeIntensity > 0) {
        const shakeX = (Math.random() - 0.5) * blackHoleShakeIntensity;
        const shakeY = (Math.random() - 0.5) * blackHoleShakeIntensity;
        if (!earthquakeActive) {
            ctx.save();
        }
        ctx.translate(shakeX, shakeY);
    }
    
    // Apply vertical wobble during tsunami
    if (tsunamiAnimating && tsunamiWobbleIntensity > 0) {
        const wobbleY = Math.sin(Date.now() / 100) * tsunamiWobbleIntensity;
        if (!blackHoleAnimating && !earthquakeActive) { // Don't double-save if black hole or earthquake is also active
            ctx.save();
        }
        ctx.translate(0, wobbleY);
    }
    
    // Apply nervous mode vibration (constant random vertical shake)
    const isNervousMode = challengeMode === 'nervous' || activeChallenges.has('nervous');
    
    // Apply or remove nervous shake CSS class to canvas
    if (isNervousMode && !paused) {
        canvas.classList.add('nervous-active');
    } else {
        canvas.classList.remove('nervous-active');
    }
    
    // No longer need canvas translation for nervous mode
    
    // Draw board and blocks
    if (earthquakeActive && earthquakePhase === 'shift') {
        // During shift, earthquake handles all rendering
        drawEarthquake();
    } else if (earthquakeActive && earthquakePhase === 'crack') {
        // During crack, earthquake draws board + dark seams
        drawEarthquake();
    } else {
        // Normal rendering (including shake phase)
        drawBoard();
        drawFallingBlocks();
    }
    
    drawTsunami(); // Draw tsunami collapsing blocks
    drawVolcano(); // Draw volcano lava and projectiles
    drawTornado(); // Draw tornado on top of board
    drawDisintegrationParticles(); // Draw explosion particles on top
    drawCascadeBonus(); // Draw cascade bonus notification
    if (window.ChallengeEffects && ChallengeEffects.Rubber) ChallengeEffects.Rubber.draw(); // Draw bouncing pieces (Rubber & Glue mode)
    if (currentPiece && currentPiece.shape) {
        drawShadowPiece(currentPiece);
        // During hard drop, use smooth pixel-based rendering
        if (hardDropping) {
            const pixelOffset = hardDropPixelY - (currentPiece.y * BLOCK_SIZE);
            drawPiece(currentPiece, ctx, 0, 0, pixelOffset);
        } else {
            drawPiece(currentPiece);
        }
    }
    
    // Draw dripping liquids ON TOP of everything (obscuring the stack)
    StormEffects.drawLiquidsOnTop();
    
    // Remove tsunami wobble transform
    if (tsunamiAnimating && tsunamiWobbleIntensity > 0) {
        if (!blackHoleAnimating && !earthquakeActive) { // Only restore if we saved (not both active)
            ctx.restore();
        }
    }
    
    // No longer need to restore for nervous mode - using CSS animation instead
    
    // Remove black hole shake transform
    if (blackHoleAnimating && blackHoleShakeIntensity > 0) {
        if (!earthquakeActive) {
            ctx.restore();
        }
    }
    
    // Remove earthquake shake transform
    if (earthquakeActive && (earthquakePhase === 'shake' || earthquakePhase === 'crack' || earthquakePhase === 'shift')) {
        ctx.restore();
    }
    
    // Update and draw histogram
    Histogram.updateConfig({
        faceOpacity: faceOpacity,
        minimalistMode: minimalistMode,
        speedBonusAverage: speedBonusAverage,
        gameRunning: gameRunning
    });
    if (!paused) {
        Histogram.update();
    }
    Histogram.draw();
    
    // Draw pause indicator
    if (paused) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.font = `bold ${Math.min(48, canvas.width * 0.18)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const pausedText = typeof I18n !== 'undefined' ? I18n.t('misc.paused') : 'PAUSED';
        ctx.strokeText(pausedText, canvas.width / 2, canvas.height / 2);
        ctx.fillText(pausedText, canvas.width / 2, canvas.height / 2);
        ctx.restore();
    }
    
    // Draw AI mode indicator
    if (aiModeEnabled && !paused) {
        ctx.save();
        ctx.font = 'bold 14px Arial';
        ctx.textBaseline = 'top';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        
        // Draw AI MODE on left (with Scoring/Survival state)
        ctx.textAlign = 'left';
        const survivalActive = typeof AIPlayer !== 'undefined' && AIPlayer.getSurvivalMode && AIPlayer.getSurvivalMode();
        const aiModeText = survivalActive ? '🤖 AI Mode - Survival' : '🤖 AI Mode - Scoring';
        ctx.fillStyle = survivalActive ? 'rgba(255, 100, 100, 0.9)' : 'rgba(0, 255, 255, 0.8)';
        ctx.strokeText(aiModeText, 10, 10);
        ctx.fillText(aiModeText, 10, 10);
        
        // Draw EXIT on right (clickable)
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 107, 107, 0.9)';
        ctx.strokeText('EXIT ✕', canvas.width - 10, 10);
        ctx.fillText('EXIT ✕', canvas.width - 10, 10);
        // Store EXIT bounds for click detection
        window.aiExitBounds = {
            x: canvas.width - 70,
            y: 0,
            width: 70,
            height: 25
        };
        ctx.restore();
    }

    gameLoop = requestAnimationFrame(update);
}

function startGame(mode) {
    // Record that visitor actually started a game (once per visit)
    if (window._visitId) {
        if (!window._visitStartRecorded) {
            window._visitStartRecorded = true;
        }
        fetch(`https://blockchainstorm.onrender.com/api/visit/${window._visitId}/started`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                difficulty: mode || null,
                skillLevel: typeof skillLevel !== 'undefined' ? skillLevel : null,
                mode: aiModeEnabled ? 'ai' : (challengeMode && challengeMode !== 'normal' ? 'challenge' : 'normal'),
                challenges: typeof activeChallenges !== 'undefined' ? [...activeChallenges] : []
            })
        }).catch(() => {});
    }
    // Request fullscreen on mobile if not already fullscreen (fallback if intro screen didn't trigger it)
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const fsCheckbox = document.getElementById('introFullscreenCheckbox');
        if (DeviceDetection.isMobile || DeviceDetection.isTablet || 
            (fsCheckbox && fsCheckbox.checked)) {
            try {
                const elem = document.documentElement;
                if (elem.requestFullscreen) {
                    elem.requestFullscreen().catch(() => {});
                } else if (elem.webkitRequestFullscreen) {
                    elem.webkitRequestFullscreen();
                }
            } catch (e) {
                // Silently handle fullscreen errors
            }
        }
    }
    
    // Save selected difficulty to localStorage for persistence
    localStorage.setItem('tantris_difficulty', mode);
    
    // Clear the highlighted score from previous game
    if (window.leaderboard && window.leaderboard.clearLastPlayerScore) {
        window.leaderboard.clearLastPlayerScore();
    }
    
    // Reset replay state in case we're starting after a replay
    if (GameReplay.isActive()) GameReplay.stop();
    
    // Stop any running credits animation
    stopCreditsAnimation();
    stopLeaderboardCloseDetection();
    cancelAIAutoRestartTimer(); // Cancel any pending AI auto-restart
    scoreSubmittedHandled = false; // Reset for new game
    
    // If tuning mode was active but this isn't a tuning restart, stop tuning mode
    // (This handles cases where user manually starts a game while tuning was running)
    if (aiTuningMode && !aiTuningConfig) {
        stopAITuningMode();
    }
    
    // Reset AI player state
    if (typeof AIPlayer !== 'undefined') {
        AIPlayer.reset();
        // Initialize AI worker even for human games (needed for shadow evaluation)
        AIPlayer.init();
        AIPlayer.setSkillLevel(skillLevel);
        AIPlayer.setEnabled(aiModeEnabled); // Re-enable if AI mode is on
        
        // TUNING MODE: Apply config AFTER reset/init (otherwise it gets wiped)
        if (aiTuningMode && aiTuningConfig && AIPlayer.setConfig) {
            console.log('🔧 Applying tuning config after init');
            AIPlayer.setConfig(aiTuningConfig);
        }
        
        // Start recording if AI mode is enabled
        if (aiModeEnabled && AIPlayer.startRecording) {
            AIPlayer.startRecording();
        }
    }
    
    // Start game recording (for both human and AI games via GameRecorder)
    if (typeof GameRecorder !== 'undefined') {
        GameRecorder.startRecording({
            gameVersion: '3.28',
            playerType: aiModeEnabled ? 'ai' : 'human',
            difficulty: mode,
            skillLevel: skillLevel,
            palette: currentPaletteId,
            mode: challengeMode !== 'normal' ? 'challenge' : 'normal',
            challenges: challengeMode === 'combo' ? Array.from(activeChallenges) : 
                        challengeMode !== 'normal' ? [challengeMode] : [],
            speedBonus: 1.0,
            // Visual settings for accurate playback
            visualSettings: {
                faceOpacity: faceOpacity,
                stormEffects: stormEffectsToggle ? stormEffectsToggle.checked : true,
                cameraReversed: cameraReversed,
                starSpeed: starSpeedSlider ? parseFloat(starSpeedSlider.value) : 1.0,
                minimalistMode: minimalistMode
            }
        });
    }
    
    // Hide leaderboard if it was shown
    if (window.leaderboard && window.leaderboard.hideLeaderboard) {
        window.leaderboard.hideLeaderboard();
    }
    
			gameStartTime = Date.now(); 
    gameMode = mode;
    lastPlayedMode = mode; // Remember this mode for next time
    
    // CRITICAL: Clear the canvas immediately to remove any leftover rendering
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // If in developer mode, turn off music
    if (developerMode && musicSelect.value !== 'none') {
        musicSelect.value = 'none';
        musicSelect.dispatchEvent(new Event('change'));
        console.log('🔇 Developer Mode: Music disabled');
    }
    
    // Clean up any active canvas classes
    canvas.classList.remove('nervous-active', 'tsunami-active', 'blackhole-active', 'touchdown-active');
    if (window.ChallengeEffects && ChallengeEffects.Vertigo) ChallengeEffects.Vertigo.stop();
    
    // Configure game based on mode
    switch(mode) {
        case 'drizzle':
            // Easier mode - 4 colors (max contrast)
            COLS = 10;
            dropInterval = 1000;
            currentColorSet = COLOR_SETS[4];
            break;
        case 'downpour':
            // Standard mode - 6 colors (max contrast)
            COLS = 10;
            dropInterval = 1000;
            currentColorSet = COLOR_SETS[6];
            break;
        case 'hailstorm':
            // 8 colors - all colors
            COLS = 10;
            dropInterval = 1000;
            currentColorSet = COLOR_SETS[8];
            break;
        case 'blizzard':
            // 12 wide + 5-block pieces - 5 colors (max contrast)
            COLS = 12;
            dropInterval = 1000;
            currentColorSet = COLOR_SETS[5];
            break;
        case 'hurricane':
            // 12 wide + 5-block pieces - 7 colors (max contrast)
            COLS = 12;
            dropInterval = 1000;
            currentColorSet = COLOR_SETS[7];
            break;
    }
    
    // Update canvas size for the selected mode
    updateCanvasSize();
    
    // Clear any existing pieces before initializing board
    currentPiece = null;
    nextPieceQueue = [];
    
    // CRITICAL: Re-derive challenge state from checkbox UI to prevent stale carryover
    activeChallenges.clear();
    document.querySelectorAll('.combo-checkbox-option input[type="checkbox"]:checked').forEach(cb => {
        activeChallenges.add(cb.value);
    });
    if (activeChallenges.size === 0) {
        challengeMode = 'normal';
    } else if (activeChallenges.size === 1) {
        challengeMode = Array.from(activeChallenges)[0];
    } else {
        challengeMode = 'combo';
    }
    console.log('🎮 Challenge state from checkboxes:', challengeMode, Array.from(activeChallenges));
    applyChallengeMode(challengeMode);
    
    // CRITICAL: Clear any keyboard state from previous game
    console.log('⌨️  Clearing keyboard state');
    console.log('  Keys pressed before clear:', Array.from(customKeyRepeat.keys.keys()));
    console.log('  hardDropping before clear:', hardDropping);
    
    // Clear hard drop state
    hardDropping = false;
    hardDropVelocity = 0;
    hardDropPixelY = 0;
    hardDropStartY = 0;
    
    // Clear all pressed keys
    customKeyRepeat.keys.clear();
    
    // Clear and cancel all keyboard timers
    customKeyRepeat.timers.forEach((timer, key) => {
        clearInterval(timer);
        clearTimeout(timer);
    });
    customKeyRepeat.timers.clear();
    
    // Clear all touch repeat timers
    touchRepeat.timers.forEach((timerObj, element) => {
        if (timerObj.initial) clearTimeout(timerObj.initial);
        if (timerObj.repeat) clearInterval(timerObj.repeat);
    });
    touchRepeat.timers.clear();
    
    console.log('  Keys pressed after clear:', Array.from(customKeyRepeat.keys.keys()));
    
    console.log('🎮 After reset:');
    console.log('  challengeMode:', challengeMode);
    console.log('  activeChallenges:', Array.from(activeChallenges));
    
    initBoard();
    
    // Explicitly clear the board arrays again to be absolutely sure
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            board[y][x] = null;
            isRandomBlock[y][x] = false;
            isLatticeBlock[y][x] = false;
            fadingBlocks[y][x] = null;
        }
    }
    
    // Debug: Count how many blocks are on the board
    let blockCount = 0;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] !== null) blockCount++;
        }
    }
    console.log('🧹 Board cleared - block count:', blockCount);
    
    score = 0;
    lines = 0;
    level = 1;
    strikeCount = 0;
    tsunamiCount = 0;
    blackHoleCount = 0;
    cascadeLevel = 0;
    cascadeBonusDisplay = null;
    gameStartTime = Date.now(); // Track game duration
    volcanoCount = 0;
    supermassiveBlackHoleCount = 0;
    superVolcanoCount = 0;
    volcanoIsSuper = false;
    currentGameLevel = 1; StarfieldSystem.setCurrentGameLevel(1); // Reset starfield journey
    StarfieldSystem.reset(); // Reset all starfield state (planets, asteroids, journey)
    lineAnimations = [];
    animatingLines = false;
    pendingLineCheck = false;
    if (window.ChallengeEffects && ChallengeEffects.YesAnd) ChallengeEffects.YesAnd.reset();
    paused = false; StarfieldSystem.setPaused(false);
    triggeredTsunamis.clear();
    
    // Reset tornado state
    tornadoActive = false;
    stopTornadoWind(); // Make sure wind sound stops
    tornadoState = 'descending';
    tornadoY = 0;
    tornadoX = 0;
    tornadoSpeed = 8;
    tornadoCol = 0;
    
    tornadoRow = 0;
    tornadoRotation = 0;
    tornadoPickedBlob = null;
    tornadoLiftStartY = 0;
    tornadoLiftHeight = 0;
    tornadoOrbitAngle = 0;
    tornadoOrbitRadius = 0;
    tornadoOrbitStartTime = 0;
    tornadoBlobRotation = 0;
    tornadoVerticalRotation = 0;
    tornadoDropTargetX = 0;
    tornadoDropStartY = 0;
    tornadoDropVelocity = 0;
    tornadoFinalPositions = null;
    tornadoFinalCenterX = null;
    tornadoFinalCenterY = null;
    
    // Reset earthquake state
    earthquakeActive = false;
    earthquakePhase = 'shake'; // Reset to shake phase
    earthquakeShakeProgress = 0;
    earthquakeCrack = [];
    earthquakeCrackMap.clear();
    earthquakeCrackProgress = 0;
    earthquakeShiftProgress = 0;
    earthquakeLeftBlocks = [];
    earthquakeRightBlocks = [];
    tornadoFadeProgress = 0;
    tornadoParticles = [];
    
    // Reset weather event grace period
    weatherEventGracePeriod = 0;
    
    // Reset black hole state
    blackHoleActive = false;
    blackHoleAnimating = false;
    blackHoleBlocks = [];
    blackHoleShakeIntensity = 0;
    blackHoleInnerBlob = null;
    blackHoleOuterBlob = null;
    
    // Reset falling blocks state
    fallingBlocks = [];
    gravityAnimating = false;
    
    // Reset tsunami state
    tsunamiActive = false;
    tsunamiAnimating = false;
    tsunamiBlob = null;
    tsunamiBlocks = [];
    tsunamiPushedBlocks = [];
    tsunamiWobbleIntensity = 0;
    
    // Reset volcano state
    volcanoActive = false;
    volcanoAnimating = false;
    volcanoLavaBlob = null;
    volcanoEruptionColumn = -1;
    volcanoProjectiles = [];
    
    // Hide planet stats
    StarfieldSystem.hidePlanetStats();
    
    // Show Sun stats at level 1
    const planets = StarfieldSystem.getPlanets();
    const sun = planets.find(p => p.isSun);
    if (sun) {
        StarfieldSystem.showPlanetStats(sun);
    }
    
    // Initialize histogram module for current color set
    Histogram.init({
        canvas: histogramCanvas,
        colorSet: currentColorSet
    });
    StormEffects.reset(); // Clear storm particles, splash particles, and liquid pools
    StormEffects.updateGameState({
        gameMode: gameMode,
        challengeMode: challengeMode,
        activeChallenges: activeChallenges,
        gameRunning: true,
        paused: false,
        BLOCK_SIZE: BLOCK_SIZE,
        ROWS: ROWS,
        COLS: COLS,
        board: board
    });
    
    // Reset speed bonus tracking
    speedBonusTotal = 0;
    speedBonusPieceCount = 0;
    speedBonusAverage = 1.0;
    pieceSpawnTime = 0;
    
    // Reset lock delay state
    lockDelayCounter = 0;
    lockDelayActive = false;
    lockDelayResets = 0;
    
    updateStats();
    
    // Initialize new Challenge mode variables
    if (window.ChallengeEffects && ChallengeEffects.SixSeven) {
        ChallengeEffects.SixSeven.init({ get COLS() { return COLS; }, randomColor });
    }
    
    // Initialize Gremlins module with game state interface
    if (window.ChallengeEffects && ChallengeEffects.Gremlins) {
        ChallengeEffects.Gremlins.init({
            get board() { return board; },
            get isRandomBlock() { return isRandomBlock; },
            get fadingBlocks() { return fadingBlocks; },
            get ROWS() { return ROWS; },
            get COLS() { return COLS; },
            get skillLevel() { return skillLevel; },
            randomColor,
            applyGravity,
            get audioContext() { return audioContext; },
            soundEnabled: () => soundToggle.checked,
            recorder: {
                isActive: () => window.GameRecorder && window.GameRecorder.isActive(),
                recordGremlinBlock: (x, y, c) => window.GameRecorder && window.GameRecorder.recordGremlinBlock(x, y, c),
                recordChallengeEvent: (t, d) => window.GameRecorder && window.GameRecorder.recordChallengeEvent(t, d)
            }
        });
    }
    
    // Initialize Mercurial module
    if (window.ChallengeEffects && ChallengeEffects.Mercurial) {
        ChallengeEffects.Mercurial.init({
            randomColor,
            playRotateSound: () => playSoundEffect('rotate', soundToggle)
        });
    }
    
    // Initialize Yes, And... module
    if (window.ChallengeEffects && ChallengeEffects.YesAnd) {
        ChallengeEffects.YesAnd.init({
            get ROWS() { return ROWS; }, get COLS() { return COLS; },
            get board() { return board; }, get isRandomBlock() { return isRandomBlock; },
            get fadingBlocks() { return fadingBlocks; },
            getAllBlobs,
            playSoundEffect: (name) => playSoundEffect(name, soundToggle)
        });
    }
    
    // Initialize Rubber & Glue module
    if (window.ChallengeEffects && ChallengeEffects.Rubber) {
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
    
    // Lattice mode: Pre-fill bottom half with random blocks
    const isLatticeMode = challengeMode === 'lattice' || activeChallenges.has('lattice');
    if (isLatticeMode && window.ChallengeEffects && ChallengeEffects.Lattice) {
        ChallengeEffects.Lattice.fillBoard(board, isRandomBlock, randomColor);
    }
    
    currentPiece = createPiece();
    pieceSpawnTime = Date.now(); // Record spawn time for speed bonus
    
    // Record piece spawn for v2.0 piece-relative timing
    if (typeof GameRecorder !== 'undefined' && GameRecorder.isActive()) {
        GameRecorder.recordPieceSpawn(currentPiece, board);
    }
    
    // Initialize the next piece queue with 4 pieces
    nextPieceQueue = [];
    for (let i = 0; i < NEXT_PIECE_COUNT; i++) {
        nextPieceQueue.push(createPiece());
    }
    drawNextPiece();
    
    gameRunning = true; StarfieldSystem.setGameRunning(true);
    setGameInProgress(true); // Notify audio system game is in progress
    gameOverPending = false; // Reset game over pending flag
    document.body.classList.add('game-running');
    document.body.classList.add('game-started');
    gameOverDiv.style.display = 'none';
    modeMenu.classList.add('hidden');
    toggleUIElements(false); // Hide UI elements when game starts
    updateAIModeMenuOverlay(); // Hide menu overlay during gameplay
    stopMenuMusic();
    
    // Create song info display element if not exists
    createSongInfoElement();
    
    // Create volume controls if not exists
    createVolumeControls();
    
    // Update music dropdown purge indicators
    updateMusicDropdownPurgeIndicators();
    
    startMusic(gameMode, musicSelect);
    
    
    // Update song display after a short delay (to let audio load)
    setTimeout(() => {
        const songInfo = getCurrentSongInfo();
        if (songInfo) updateSongInfoDisplay(songInfo);
    }, 100);
    
    update();
}

// Comprehensive keyboard handler
document.addEventListener('keydown', e => {
    // F11, PageUp, PageDown - Toggle fullscreen (anytime)
    if (e.key === 'F11' || e.key === 'PageUp' || e.key === 'PageDown') {
        e.preventDefault();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen().catch(err => {
                    // Silently handle fullscreen errors (permissions, etc.)
                });
            }
        }
        return;
    }
    
    // Handle P key to pause menu music when not in game
    if (!gameRunning && (e.key === 'p' || e.key === 'P' || e.key === 'Pause' || e.key === 'Break')) {
        if (typeof toggleMusicPause === 'function') {
            const isPaused = toggleMusicPause();
            const songPauseBtn = document.getElementById('songPauseBtn');
            if (songPauseBtn) songPauseBtn.textContent = isPaused ? '▶\uFE0E' : '⏸\uFE0E';
        }
        return;
    }
    
    // GAME CONTROLS - Only when game is running
    if (gameRunning) {
        // If paused, any key (except F11/PageUp/PageDown) unpauses
        // But NOT during replay - use replay controls instead
        if (paused && !GameReplay.isActive()) {
            e.preventDefault();
            paused = false; StarfieldSystem.setPaused(false);
            settingsBtn.classList.add('hidden-during-play');
            // Show pause button again (only in tablet mode)
            const pauseBtn = document.getElementById('pauseBtn');
            if (pauseBtn && TabletMode.enabled) pauseBtn.style.display = 'block';
            // Resume music if it was paused, or start if not
            if (musicSelect.value !== 'none') {
                if (typeof isMusicPaused === 'function' && isMusicPaused()) {
                    resumeCurrentMusic();
                    const songPauseBtn = document.getElementById('songPauseBtn');
                    if (songPauseBtn) songPauseBtn.textContent = '⏸\uFE0E';
                } else {
                    startMusic(gameMode, musicSelect);
                }
            }
            return;
        }
        
        // During replay pause, only allow spacebar to toggle pause
        if (GameReplay.isActive() && GameReplay.isPaused()) {
            if (e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                GameReplay.togglePause();
            }
            return;
        }
        
        // Handle pause with P, Pause, or Break keys
        if (e.key === 'p' || e.key === 'P' || e.key === 'Pause' || e.key === 'Break') {
            e.preventDefault();
            
            // Capture snapshot before pausing
            captureCanvasSnapshot();
            
            paused = true; StarfieldSystem.setPaused(true);
            justPaused = true;
            setTimeout(() => { justPaused = false; }, 300);
            settingsBtn.classList.remove('hidden-during-play');
            // Hide pause button while paused
            const pauseBtn = document.getElementById('pauseBtn');
            if (pauseBtn) pauseBtn.style.display = 'none';
            // Pause music instead of stopping it
            if (typeof pauseCurrentMusic === 'function') {
                pauseCurrentMusic();
                const songPauseBtn = document.getElementById('songPauseBtn');
                if (songPauseBtn) songPauseBtn.textContent = '▶\uFE0E';
            } else {
                stopMusic();
            }
            return;
        }
        
        // Escape key - exit AI game in progress
        if (e.key === 'Escape' && aiModeEnabled) {
            e.preventDefault();
            exitAIGame();
            return;
        }
        
        // SHIFT key - Spawn tornado (developer mode only)
        if (e.key === 'Shift' && developerMode) {
            e.preventDefault();
            spawnTornado();
            return;
        }
        
        // TAB key - Advance to next planet (developer mode only)
        if (e.key === 'Tab' && developerMode) {
            e.preventDefault();
            advanceToNextPlanet();
            return;
        }
        
        // TILDE/BACKTICK key - Spawn earthquake (developer mode only)
        if ((e.key === '`' || e.key === '~') && developerMode) {
            e.preventDefault();
            spawnEarthquake();
            return;
        }
        
        // U key - Trigger UFO (developer mode only)
        if ((e.key === 'u' || e.key === 'U') && developerMode) {
            e.preventDefault();
            StarfieldSystem.triggerUFO();
            return;
        }
        
        // Backspace key - Trigger lightning (developer mode only)
        if (e.key === 'Backspace' && developerMode) {
            e.preventDefault();
            triggerLightning(300);
            return;
        }
        
        // Music controls: SHIFT+Arrow or CTRL+Arrow to skip songs
        if ((e.shiftKey || e.ctrlKey) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            e.preventDefault();
            // Don't allow manual skips during replay
            if (GameReplay.isActive()) return;
            
            if (e.key === 'ArrowRight') {
                skipToNextSong();
            } else if (e.key === 'ArrowLeft') {
                skipToPreviousSong();
            }
            return;
        }
        
        // During replay, ignore player input (inputs come from recording)
        if (paused || !currentPiece || GameReplay.isActive()) return;

        // Custom key repeat system - ignore browser's repeat events entirely
        if (e.repeat) {
            e.preventDefault();
            return; // Ignore all browser repeat events
        }
        
        // Build game control keys dynamically from ControlsConfig
        const gameControlKeys = {};
        const actionHandlers = {
            'moveLeft': () => movePiece(-1),
            'moveRight': () => movePiece(1),
            'softDrop': () => {
                dropPiece();
                // Record soft drop input for replay
                if (window.GameRecorder && window.GameRecorder.isActive() && currentPiece) {
                    window.GameRecorder.recordInput('softDrop', {
                        x: currentPiece.x,
                        y: currentPiece.y,
                        rotation: currentPiece.rotationIndex || 0
                    });
                }
            },
            'hardDrop': () => hardDrop(),
            'rotateCW': () => rotatePiece(),
            'rotateCCW': () => rotatePieceCounterClockwise()
        };
        
        // Map configured keys to actions
        if (typeof ControlsConfig !== 'undefined' && ControlsConfig.keyboard) {
            for (const [action, keys] of Object.entries(ControlsConfig.keyboard)) {
                if (actionHandlers[action]) {
                    keys.forEach(key => {
                        gameControlKeys[key] = actionHandlers[action];
                    });
                }
            }
        } else {
            // Fallback to hardcoded controls if ControlsConfig not available
            Object.assign(gameControlKeys, {
                'ArrowLeft': actionHandlers.moveLeft,
                'ArrowRight': actionHandlers.moveRight,
                'ArrowDown': actionHandlers.softDrop,
                'ArrowUp': actionHandlers.rotateCW,
                '4': actionHandlers.moveLeft,
                '6': actionHandlers.moveRight,
                '2': actionHandlers.softDrop,
                '5': actionHandlers.rotateCCW,
                'Clear': actionHandlers.rotateCCW,
                '8': actionHandlers.rotateCW,
                '0': actionHandlers.hardDrop,
                'Insert': actionHandlers.hardDrop,
                ' ': actionHandlers.hardDrop
            });
        }
        
        // Check if this is a game control key
        if (gameControlKeys[e.key] && !customKeyRepeat.keys.has(e.key)) {
            e.preventDefault();
            
            // Mark key as pressed
            customKeyRepeat.keys.set(e.key, true);
            
            // Execute action immediately on first press
            gameControlKeys[e.key]();
            
            // Set up initial delay before repeating (except for hard drop)
            const isHardDrop = typeof ControlsConfig !== 'undefined' && ControlsConfig.keyboard
                ? ControlsConfig.keyboard.hardDrop.includes(e.key)
                : (e.key === ' ' || e.key === '0' || e.key === 'Insert');
            
            if (!isHardDrop) {
                const initialTimer = setTimeout(() => {
                    // Start repeating at specified rate
                    const repeatTimer = setInterval(() => {
                        if (customKeyRepeat.keys.has(e.key) && !paused && currentPiece) {
                            gameControlKeys[e.key]();
                        } else {
                            clearInterval(repeatTimer);
                            customKeyRepeat.timers.delete(e.key);
                        }
                    }, customKeyRepeat.repeatRate);
                    
                    customKeyRepeat.timers.set(e.key, repeatTimer);
                }, customKeyRepeat.initialDelay);
                
                customKeyRepeat.timers.set(e.key + '_init', initialTimer);
            }
        }

        return;
    }
    
    // MENU NAVIGATION - When mode menu is visible
    // Capture menu state at start of handler (before other handlers might change it)
    const menuWasVisible = !modeMenu.classList.contains('hidden');
    if (menuWasVisible) {
        if (e.key === 'Enter') {
            e.preventDefault();
            closeAllMenuPopups();
            const mode = modeButtonsArray[selectedModeIndex].getAttribute('data-mode');
            startGame(mode);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            // Close any open selection modals
            const slModal = document.getElementById('skillLevelModalOverlay');
            const dModal = document.getElementById('difficultyModalOverlay');
            if (slModal) slModal.style.display = 'none';
            if (dModal) dModal.style.display = 'none';
        }
        return;
    }
    
    // GAME OVER - Enter to play again
    if (gameOverDiv.style.display === 'block') {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopImmediatePropagation(); // Prevent other handlers from also processing this
            playAgainBtn.click();
        }
    }
});

// Keyup handler to clear custom repeat state and timers
document.addEventListener('keyup', e => {
    // Clear state for this key
    customKeyRepeat.keys.delete(e.key);
    
    // Clear any active timers for this key
    if (customKeyRepeat.timers.has(e.key)) {
        clearInterval(customKeyRepeat.timers.get(e.key));
        customKeyRepeat.timers.delete(e.key);
    }
    if (customKeyRepeat.timers.has(e.key + '_init')) {
        clearTimeout(customKeyRepeat.timers.get(e.key + '_init'));
        customKeyRepeat.timers.delete(e.key + '_init');
    }
});

// Mode selection handlers
modeButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        const mode = button.getAttribute('data-mode');
        
        // SHIFT+click in AI mode = start Tuning Mode
        if (event.shiftKey && aiModeEnabled) {
            console.log('🔧 SHIFT+click detected - starting AI Tuning Mode');
            startAITuningMode(mode, skillLevel);
            return;
        }
        
        startGame(mode);
    });
});

// Keyboard navigation setup for mode menu
// Load saved difficulty preference from localStorage
const savedDifficulty = localStorage.getItem('tantris_difficulty');
let selectedModeIndex = 0;
const modeButtonsArray = Array.from(modeButtons);

// If a saved difficulty exists, find its index
if (savedDifficulty) {
    const savedIndex = modeButtonsArray.findIndex(btn => btn.getAttribute('data-mode') === savedDifficulty);
    if (savedIndex >= 0) {
        selectedModeIndex = savedIndex;
    }
}

function updateSelectedMode() {
    modeButtonsArray.forEach((btn, index) => {
        if (index === selectedModeIndex) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
    
    // Update difficulty menu button label
    if (typeof updateDifficultyButton === 'function') {
        updateDifficultyButton();
    }
    
    // Update leaderboard to match selected difficulty if visible
    const leaderboardContent = document.getElementById('leaderboardContent');
    if (leaderboardContent && leaderboardContent.style.display !== 'none' && window.leaderboard) {
        const selectedMode = modeButtonsArray[selectedModeIndex].getAttribute('data-mode');
        // Read the leaderboard mode from the dropdown (source of truth) rather than challengeMode
        const viewSelect = document.getElementById('rulesPanelViewSelect');
        let lbMode = 'normal';
        if (viewSelect) {
            const view = viewSelect.value;
            if (view === 'leaderboard-challenge') lbMode = 'challenge';
            else if (view === 'leaderboard-ai') lbMode = 'ai';
            else if (view === 'leaderboard-ai-challenge') lbMode = 'ai-challenge';
        }
        window.leaderboard.displayLeaderboard(selectedMode, null, lbMode, skillLevel);
    }
}

// Initialize first button as selected
updateSelectedMode();

// Initialize volume controls
createVolumeControls();

// Rules panel view toggle handler
const rulesPanelViewSelect = document.getElementById('rulesPanelViewSelect');
if (rulesPanelViewSelect) {
    // Restore saved preference
    const savedView = localStorage.getItem('rulesPanelView');
    if (savedView) {
        rulesPanelViewSelect.value = savedView;
        // Trigger the view change immediately
        if (savedView.startsWith('leaderboard-')) {
            const rulesInstructions = document.querySelector('.rules-instructions');
            if (rulesInstructions) rulesInstructions.style.display = 'none';
            if (window.leaderboard) {
                // Parse mode from view value: leaderboard-normal, leaderboard-challenge, leaderboard-ai, leaderboard-ai-challenge
                let lbMode = 'normal';
                if (savedView === 'leaderboard-challenge') lbMode = 'challenge';
                else if (savedView === 'leaderboard-ai') lbMode = 'ai';
                else if (savedView === 'leaderboard-ai-challenge') lbMode = 'ai-challenge';
                const selectedMode = modeButtonsArray[selectedModeIndex]?.getAttribute('data-mode') || 'drizzle';
                window.leaderboard.displayLeaderboard(selectedMode, null, lbMode, skillLevel);
            }
        }
    }
    
    rulesPanelViewSelect.addEventListener('change', () => {
        const view = rulesPanelViewSelect.value;
        const rulesInstructions = document.querySelector('.rules-instructions');
        const leaderboardContent = document.getElementById('leaderboardContent');
        
        // Save preference
        localStorage.setItem('rulesPanelView', view);
        
        if (view.startsWith('leaderboard-')) {
            // Show leaderboard, hide rules
            if (rulesInstructions) rulesInstructions.style.display = 'none';
            if (window.leaderboard) {
                // Parse mode from view value
                let lbMode = 'normal';
                if (view === 'leaderboard-challenge') lbMode = 'challenge';
                else if (view === 'leaderboard-ai') lbMode = 'ai';
                else if (view === 'leaderboard-ai-challenge') lbMode = 'ai-challenge';
                const selectedMode = modeButtonsArray[selectedModeIndex]?.getAttribute('data-mode') || 'drizzle';
                window.leaderboard.displayLeaderboard(selectedMode, null, lbMode, skillLevel);
            }
        } else {
            // Show rules, hide leaderboard
            if (leaderboardContent) leaderboardContent.style.display = 'none';
            if (rulesInstructions) rulesInstructions.style.display = 'block';
        }
    });
}

// ─── Share Popup Logic ───
let sessionPlayAgainCount = 0;

function getShareURL() {
    return 'https://tantris.official-intelligence.art/';
}

function getShareText() {
    return I18n.t('share.text');
}

function updateShareLinks() {
    const url = encodeURIComponent(getShareURL());
    const text = encodeURIComponent(getShareText());
    
    const twitter = document.getElementById('shareTwitter');
    const facebook = document.getElementById('shareFacebook');
    const reddit = document.getElementById('shareReddit');
    const whatsapp = document.getElementById('shareWhatsApp');
    const telegram = document.getElementById('shareTelegram');
    
    if (twitter) twitter.href = `https://x.com/intent/tweet?text=${text}&url=${url}`;
    if (facebook) facebook.href = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    if (reddit) reddit.href = `https://www.reddit.com/submit?url=${url}&title=${text}`;
    if (whatsapp) whatsapp.href = `https://wa.me/?text=${text}%20${url}`;
    if (telegram) telegram.href = `https://t.me/share/url?url=${url}&text=${text}`;
    
    // Game-over share icons (same URLs)
    const goTwitter = document.getElementById('goShareTwitter');
    const goFacebook = document.getElementById('goShareFacebook');
    const goReddit = document.getElementById('goShareReddit');
    const goWhatsApp = document.getElementById('goShareWhatsApp');
    const goTelegram = document.getElementById('goShareTelegram');
    
    if (goTwitter) goTwitter.href = `https://x.com/intent/tweet?text=${text}&url=${url}`;
    if (goFacebook) goFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    if (goReddit) goReddit.href = `https://www.reddit.com/submit?url=${url}&title=${text}`;
    if (goWhatsApp) goWhatsApp.href = `https://wa.me/?text=${text}%20${url}`;
    if (goTelegram) goTelegram.href = `https://t.me/share/url?url=${url}&text=${text}`;
}

function trackShareClick(platform) {
    if (window._visitId) {
        fetch(`https://blockchainstorm.onrender.com/api/visit/${window._visitId}/shared`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: platform })
        }).catch(() => {});
    }
}

function showSharePopup() {
    if (localStorage.getItem('tantris_share_dismissed') === 'true') return false;
    
    const overlay = document.getElementById('shareOverlay');
    if (!overlay) return false;
    
    updateShareLinks();
    overlay.classList.add('active');
    return true;
}

function hideSharePopup() {
    const overlay = document.getElementById('shareOverlay');
    if (overlay) overlay.classList.remove('active');
}

// Wire up share popup buttons
document.addEventListener('DOMContentLoaded', () => {
    const shareCloseBtn = document.getElementById('shareCloseBtn');
    const shareDismissBtn = document.getElementById('shareDismissBtn');
    const shareCopyLink = document.getElementById('shareCopyLink');
    const shareOverlay = document.getElementById('shareOverlay');
    
    if (shareCloseBtn) shareCloseBtn.addEventListener('click', hideSharePopup);
    
    if (shareDismissBtn) {
        shareDismissBtn.addEventListener('click', () => {
            localStorage.setItem('tantris_share_dismissed', 'true');
            hideSharePopup();
        });
    }
    
    if (shareCopyLink) {
        shareCopyLink.addEventListener('click', (e) => {
            e.preventDefault();
            trackShareClick('copylink');
            navigator.clipboard.writeText(getShareURL()).then(() => {
                const span = shareCopyLink.querySelector('span');
                if (span) {
                    span.textContent = I18n.t('share.copied');
                    setTimeout(() => { span.textContent = I18n.t('share.copyLink'); }, 2000);
                }
            });
        });
    }
    
    // Track social share clicks
    const shareButtons = {
        'shareTwitter': 'twitter',
        'shareFacebook': 'facebook',
        'shareReddit': 'reddit',
        'shareWhatsApp': 'whatsapp',
        'shareTelegram': 'telegram'
    };
    Object.entries(shareButtons).forEach(([id, platform]) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => trackShareClick(platform));
    });
    
    // Game-over share icon tracking + copy link
    const goShareButtons = {
        'goShareTwitter': 'twitter',
        'goShareFacebook': 'facebook',
        'goShareReddit': 'reddit',
        'goShareWhatsApp': 'whatsapp',
        'goShareTelegram': 'telegram'
    };
    Object.entries(goShareButtons).forEach(([id, platform]) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => trackShareClick(platform));
    });
    
    const goShareCopyLink = document.getElementById('goShareCopyLink');
    if (goShareCopyLink) {
        goShareCopyLink.addEventListener('click', (e) => {
            e.preventDefault();
            trackShareClick('copylink');
            navigator.clipboard.writeText(getShareURL()).then(() => {
                const svg = goShareCopyLink.querySelector('svg');
                if (svg) {
                    const origFill = svg.style.fill;
                    svg.style.fill = '#4CAF50';
                    setTimeout(() => { svg.style.fill = origFill; }, 1500);
                }
            });
        });
    }
    
    // Close on overlay background click
    if (shareOverlay) {
        shareOverlay.addEventListener('click', (e) => {
            if (e.target === shareOverlay) hideSharePopup();
        });
    }
});

playAgainBtn.addEventListener('click', () => {
    sessionPlayAgainCount++;
    if (sessionPlayAgainCount === 2) {
        showSharePopup();
    }
    
    stopCreditsAnimation();
    stopLeaderboardCloseDetection();
    cancelAIAutoRestartTimer(); // Cancel AI auto-restart if pending
    gameOverDiv.style.display = 'none';
    modeMenu.classList.remove('hidden');
    document.body.classList.remove('game-started');
    toggleUIElements(true); // Show UI elements when returning to menu
    
    // Update menu dropdown buttons
    if (typeof updateSkillLevelButton === 'function') updateSkillLevelButton();
    if (typeof updateDifficultyButton === 'function') updateDifficultyButton();
    
    // Hide planet stats
    StarfieldSystem.hidePlanetStats();
    const planetStats = document.getElementById('planetStats');
    const planetStatsLeft = document.getElementById('planetStatsLeft');
    if (planetStats) planetStats.style.display = 'none';
    if (planetStatsLeft) planetStatsLeft.style.display = 'none';
    
    // Clear pieces from previous game
    currentPiece = null;
    nextPieceQueue = [];
    
    // Reset canvas to standard width in case we were in Blizzard/Hurricane
    COLS = 10;
    updateCanvasSize();
    
    // CRITICAL: Clear the canvas to remove any leftover rendering
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Initialize empty board
    initBoard();
    
    // Explicitly clear ALL board arrays to ensure no leftover pieces
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            board[y][x] = null;
            isRandomBlock[y][x] = false;
            isLatticeBlock[y][x] = false;
            fadingBlocks[y][x] = null;
        }
    }
    
    // Don't call drawBoard() here - it draws the semi-transparent background
    // The canvas has already been cleared above, leave it transparent for menu
    
    // Reset to intro music mode and restart menu music
    stopMenuMusic();
    setHasPlayedGame(false);
    startMenuMusic(musicSelect);
    
    // Select the last played mode
    if (lastPlayedMode) {
        const modeIndex = modeButtonsArray.findIndex(btn => btn.getAttribute('data-mode') === lastPlayedMode);
        if (modeIndex !== -1) {
            selectedModeIndex = modeIndex;
        } else {
            selectedModeIndex = 0;
        }
    } else {
        selectedModeIndex = 0;
    }
    updateSelectedMode();
    
    // Show AI mode overlay if enabled
    updateAIModeMenuOverlay();
});

// Settings popup handlers
settingsBtn.addEventListener('click', () => {
    wasPausedBeforeSettings = paused;
    if (gameRunning && !paused) {
        // Capture snapshot before pausing
        captureCanvasSnapshot();
        
        paused = true; StarfieldSystem.setPaused(true);
        justPaused = true;
        setTimeout(() => { justPaused = false; }, 300);
        // Hide pause button while settings is open
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) pauseBtn.style.display = 'none';
        // Don't toggle UI - keep histogram visible
        stopMusic(); // stopMusic() already checks internally if music is playing
    }
    settingsOverlay.style.display = 'flex';
    // Update controls config UI
    if (typeof ControlsConfig !== 'undefined' && ControlsConfig.updateUI) {
        ControlsConfig.updateUI();
    }
    // Update music dropdown purge indicators
    updateMusicDropdownPurgeIndicators();
});

settingsCloseBtn.addEventListener('click', () => {
    settingsOverlay.style.display = 'none';
    if (gameRunning && !wasPausedBeforeSettings) {
        paused = false; StarfieldSystem.setPaused(false);
        // Show pause button again (only in tablet mode)
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn && TabletMode.enabled) pauseBtn.style.display = 'block';
        // Don't toggle UI - keep histogram visible
        if (musicSelect.value !== 'none') {
            startMusic(gameMode, musicSelect);
        }
    }
});

// Close settings when clicking outside the popup
settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) {
        settingsCloseBtn.click();
    }
});

opacitySlider.addEventListener('input', (e) => {
    faceOpacity = parseFloat(e.target.value) / 100; // Convert 0-100 to 0-1
    const opacityDisplay = document.getElementById('opacityDisplay');
    if (opacityDisplay) {
        opacityDisplay.textContent = `${e.target.value}%`;
    }
});

cameraOrientationToggle.addEventListener('change', (e) => {
    cameraReversed = e.target.checked;
    StarfieldSystem.setCameraReversed(cameraReversed);
    // Reset planet animations when camera changes
    StarfieldSystem.setPlanetAnimations({});
});

starSpeedSlider.addEventListener('input', (e) => {
    const speed = parseFloat(e.target.value);
    if (speed === 0) {
        // Turn stars off completely at minimum
        if (StarfieldSystem.setStarsEnabled) {
            StarfieldSystem.setStarsEnabled(false);
        }
    } else {
        // Turn stars on and set speed
        if (StarfieldSystem.setStarsEnabled) {
            StarfieldSystem.setStarsEnabled(true);
        }
        StarfieldSystem.setStarSpeed(speed);
    }
});

// Minimalist mode toggle (Developer only)
minimalistToggle.addEventListener('change', (e) => {
    minimalistMode = e.target.checked;
    applyMinimalistMode();
    StarfieldSystem.setMinimalistMode(minimalistMode);
});

function applyMinimalistMode() {
    if (minimalistMode) {
        document.body.classList.add('minimalist-mode');
    } else {
        document.body.classList.remove('minimalist-mode');
    }
    // Redraw canvas background with new transparency
    drawCanvasBackground();
    if (gameRunning) {
        drawBoard();
    }
}

// AI Mode toggle
if (aiModeToggle) {
    // Show/hide speed slider based on initial state (aiModeEnabled already set from localStorage)
    const aiSpeedOptionInit = document.getElementById('aiSpeedOption');
    if (aiSpeedOptionInit) {
        aiSpeedOptionInit.style.display = aiModeEnabled ? 'block' : 'none';
    }
    if (typeof AIPlayer !== 'undefined') {
        AIPlayer.setEnabled(aiModeEnabled);
    }
    if (aiModeEnabled) {
        console.log('🤖 AI Mode: ENABLED (restored from settings)');
    }
    
    // Show AI mode overlay on menu if enabled
    updateAIModeMenuOverlay();
    
    aiModeToggle.addEventListener('change', (e) => {
        aiModeEnabled = e.target.checked;
        localStorage.setItem('aiModeEnabled', aiModeEnabled);
        if (typeof AIPlayer !== 'undefined') {
            AIPlayer.setEnabled(aiModeEnabled);
        }
        // Cancel auto-restart timer if AI mode is disabled
        if (!aiModeEnabled) {
            cancelAIAutoRestartTimer();
            // Also stop tuning mode if it was running
            if (aiTuningMode) {
                stopAITuningMode();
            }
            // Restore user's saved palette
            const savedPalette = localStorage.getItem('tantris_palette') || 'classic';
            if (savedPalette !== currentPaletteId) {
                selectPalette(savedPalette);
            }
        }
        // Show/hide speed slider
        const aiSpeedOption = document.getElementById('aiSpeedOption');
        if (aiSpeedOption) {
            aiSpeedOption.style.display = e.target.checked ? 'block' : 'none';
        }
        console.log('🤖 AI Mode:', aiModeEnabled ? 'ENABLED' : 'DISABLED');
        
        // Refresh leaderboard to show AI or normal leaderboard
        const leaderboardContent = document.getElementById('leaderboardContent');
        if (leaderboardContent && leaderboardContent.style.display !== 'none' && window.leaderboard) {
            const selectedMode = modeButtonsArray[selectedModeIndex].getAttribute('data-mode');
            window.leaderboard.displayLeaderboard(selectedMode, null, getLeaderboardMode(), skillLevel);
        }
        
        // Update menu overlay
        updateAIModeMenuOverlay();
    });
}

// AI Speed slider
if (aiSpeedSlider) {
    aiSpeedSlider.addEventListener('input', (e) => {
        const speed = parseInt(e.target.value);
        if (typeof AIPlayer !== 'undefined') {
            AIPlayer.setSpeed(speed);
        }
        console.log('🤖 AI Speed:', speed);
    });
}

musicSelect.addEventListener('change', (e) => {
    // Ignore programmatic changes during intro dismiss
    if (window._dismissingIntro) return;
    if (e.target.value === 'none') {
        stopMusic();
        stopMenuMusic();
    } else {
        // When changing music selection, start the selected track
        if (gameRunning) {
            stopMusic(); // Stop current track first
            startMusic(gameMode, musicSelect);
        } else {
            // On menu - stop menu music and play selected track as preview
            stopMenuMusic();
            stopMusic();
            startMusic(null, musicSelect);
        }
    }
});

// Challenge mode handlers
const challengeSelectBtn = document.getElementById('challengeSelectBtn');
const comboModalOverlay = document.getElementById('comboModalOverlay');
const comboApplyBtn = document.getElementById('comboApplyBtn');
const comboCancelBtn = document.getElementById('comboCancelBtn');
const comboStranger = document.getElementById('comboStranger');
const comboDyslexic = document.getElementById('comboDyslexic');
const comboPhantom = document.getElementById('comboPhantom');
const comboRubber = document.getElementById('comboRubber');
const comboOz = document.getElementById('comboOz');
const comboThinner = document.getElementById('comboThinner');
const comboThicker = document.getElementById('comboThicker');
const comboNervous = document.getElementById('comboNervous');
const comboCarrie = document.getElementById('comboCarrie');
const comboNokings = document.getElementById('comboNokings');
const comboLongAgo = document.getElementById('comboLongAgo');
const comboComingSoon = document.getElementById('comboComingSoon');
const comboSixSeven = document.getElementById('comboSixSeven');
const comboGremlins = document.getElementById('comboGremlins');
const comboLattice = document.getElementById('comboLattice');
const comboYesAnd = document.getElementById('comboYesAnd');
const comboMercurial = document.getElementById('comboMercurial');
const comboShadowless = document.getElementById('comboShadowless');
const comboAmnesia = document.getElementById('comboAmnesia');
const comboVertigo = document.getElementById('comboVertigo');
const comboBonusPercent = document.getElementById('comboBonusPercent');

// Function to update combo bonus display
function updateComboBonusDisplay() {
    // Define bonus percentages for each challenge based on difficulty
    const challengeBonuses = {
        'stranger': 7,     // Upside down
        'dyslexic': 6,     // Reversed controls
        'phantom': 7,      // Invisible stack
        'gremlins': 6,     // Random disappearing blocks
        'rubber': 5,       // Bouncing pieces
        'oz': 5,           // Grayscale until landing
        'lattice': 5,      // Pre-filled blocks
        'yesand': 5,       // Random extra blocks
        'mercurial': 4,    // Color-shifting pieces
        'sixseven': 4,     // Occasional giant pieces
        'longago': 4,      // Perspective distortion
        'comingsoon': 4,   // Reverse perspective
        'thinner': 4,      // Visual compression
        'shadowless': 3,   // No shadow guide
        'thicker': 3,      // Wider well (easier)
        'carrie': 3,       // Visual distraction
        'nokings': 3,      // Visual distraction
        'nervous': 2,      // Minor vibration - lowest difficulty
        'amnesia': 6,      // Color memory fade
        'vertigo': 2       // Disorienting sway
    };
    
    // Map checkboxes to their challenge types
    const checkboxMap = [
        { checkbox: comboStranger, type: 'stranger' },
        { checkbox: comboDyslexic, type: 'dyslexic' },
        { checkbox: comboPhantom, type: 'phantom' },
        { checkbox: comboRubber, type: 'rubber' },
        { checkbox: comboOz, type: 'oz' },
        { checkbox: comboThinner, type: 'thinner' },
        { checkbox: comboThicker, type: 'thicker' },
        { checkbox: comboCarrie, type: 'carrie' },
        { checkbox: comboNokings, type: 'nokings' },
        { checkbox: comboLongAgo, type: 'longago' },
        { checkbox: comboComingSoon, type: 'comingsoon' },
        { checkbox: comboNervous, type: 'nervous' },
        { checkbox: comboSixSeven, type: 'sixseven' },
        { checkbox: comboGremlins, type: 'gremlins' },
        { checkbox: comboLattice, type: 'lattice' },
        { checkbox: comboYesAnd, type: 'yesand' },
        { checkbox: comboMercurial, type: 'mercurial' },
        { checkbox: comboShadowless, type: 'shadowless' },
        { checkbox: comboAmnesia, type: 'amnesia' },
        { checkbox: comboVertigo, type: 'vertigo' }
    ].filter(item => item.checkbox); // Filter out null checkboxes
    
    // Calculate total bonus
    let totalBonus = 0;
    checkboxMap.forEach(item => {
        if (item.checkbox.checked) {
            totalBonus += challengeBonuses[item.type];
        }
    });
    
    comboBonusPercent.textContent = totalBonus + '%';
}

// Add change listeners to all combo checkboxes to update bonus display
[comboStranger, comboDyslexic, comboPhantom, comboRubber, comboOz,
 comboThinner, comboThicker, comboCarrie, comboNokings,
 comboLongAgo, comboComingSoon, comboNervous, comboSixSeven, comboGremlins,
 comboLattice, comboYesAnd, comboMercurial, comboShadowless, comboAmnesia, comboVertigo].filter(cb => cb).forEach(checkbox => {
    checkbox.addEventListener('change', () => { updateComboBonusDisplay(); updateComboHighlights(); });
});

// Mutual exclusivity: Long Ago and Coming Soon cannot both be selected
comboLongAgo.addEventListener('change', (e) => {
    if (e.target.checked && comboComingSoon.checked) {
        comboComingSoon.checked = false;
    }
    updateComboBonusDisplay();
    updateComboHighlights();
});

comboComingSoon.addEventListener('change', (e) => {
    if (e.target.checked && comboLongAgo.checked) {
        comboLongAgo.checked = false;
    }
    updateComboBonusDisplay();
    updateComboHighlights();
});

// Mutual exclusivity: Thinner and Thicker cannot both be selected
comboThinner.addEventListener('change', (e) => {
    if (e.target.checked && comboThicker.checked) {
        comboThicker.checked = false;
    }
    updateComboBonusDisplay();
    updateComboHighlights();
});

comboThicker.addEventListener('change', (e) => {
    if (e.target.checked && comboThinner.checked) {
        comboThinner.checked = false;
    }
    updateComboBonusDisplay();
    updateComboHighlights();
});

// Helper function to populate combo modal checkboxes
function populateComboModal() {
    // Restore activeChallenges for single challenge modes (applyChallengeMode clears it for non-combo)
    if (activeChallenges.size === 0 && challengeMode && challengeMode !== 'normal' && challengeMode !== 'combo') {
        activeChallenges.add(challengeMode);
    }
    comboStranger.checked = activeChallenges.has('stranger');
    comboDyslexic.checked = activeChallenges.has('dyslexic');
    comboPhantom.checked = activeChallenges.has('phantom');
    comboRubber.checked = activeChallenges.has('rubber');
    comboOz.checked = activeChallenges.has('oz');
    comboThinner.checked = activeChallenges.has('thinner');
    comboThicker.checked = activeChallenges.has('thicker');
    comboNervous.checked = activeChallenges.has('nervous');
    comboCarrie.checked = activeChallenges.has('carrie');
    comboNokings.checked = activeChallenges.has('nokings');
    comboLongAgo.checked = activeChallenges.has('longago');
    comboComingSoon.checked = activeChallenges.has('comingsoon');
    comboSixSeven.checked = activeChallenges.has('sixseven');
    comboGremlins.checked = activeChallenges.has('gremlins');
    comboLattice.checked = activeChallenges.has('lattice');
    comboYesAnd.checked = activeChallenges.has('yesand');
    if (comboMercurial) comboMercurial.checked = activeChallenges.has('mercurial');
    if (comboShadowless) comboShadowless.checked = activeChallenges.has('shadowless');
    if (comboAmnesia) comboAmnesia.checked = activeChallenges.has('amnesia');
    if (comboVertigo) comboVertigo.checked = activeChallenges.has('vertigo');
    updateComboBonusDisplay();
    updateComboHighlights();
}

// Sync .checked class on combo-checkbox-option elements
function updateComboHighlights() {
    document.querySelectorAll('.combo-checkbox-option').forEach(option => {
        const cb = option.querySelector('input[type="checkbox"]');
        if (cb) {
            option.classList.toggle('checked', cb.checked);
        }
    });
}

// Make entire combo-checkbox-option clickable (not just the label)
document.querySelectorAll('.combo-checkbox-option').forEach(option => {
    option.addEventListener('click', (e) => {
        // Don't double-toggle if they clicked the label/toggle directly
        if (e.target.closest('label') || e.target.closest('.toggle-switch')) return;
        const cb = option.querySelector('input[type="checkbox"]');
        if (cb) {
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
});

// Challenge display names for the button label
const challengeDisplayNames = {
    'normal': 'Normal',
    'stranger': 'Stranger',
    'dyslexic': 'Dyslexic',
    'phantom': 'Phantom',
    'rubber': 'Rubber & Glue',
    'oz': 'Oz',
    'thinner': 'Thinner',
    'thicker': 'Thicker',
    'carrie': 'Carrie',
    'nokings': 'No Kings',
    'longago': 'Long Ago...',
    'comingsoon': 'Coming Soon...',
    'nervous': 'Nervous',
    'sixseven': 'Six Seven',
    'gremlins': 'Gremlins',
    'lattice': 'Lattice',
    'yesand': 'Yes, And...',
    'mercurial': 'Mercurial',
	'shadowless': 'Shadowless',
	'amnesia': 'Amnesia',
	'vertigo': 'Vertigo',
    'combo': 'Combo'
};

// Function to update the button label based on current selection
function updateChallengeButtonLabel() {
    let label;
    if (challengeMode === 'normal' && activeChallenges.size === 0) {
        label = I18n.t('challenge.normal');
    } else if (challengeMode === 'combo' || activeChallenges.size > 1) {
        // Show count of challenges
        const names = Array.from(activeChallenges).map(c => challengeDisplayNames[c] || c);
        if (names.length <= 2) {
            label = names.join(' + ');
        } else {
            label = I18n.t('challenge.challenges', { count: names.length });
        }
    } else if (activeChallenges.size === 1) {
        const mode = Array.from(activeChallenges)[0];
        label = challengeDisplayNames[mode] || mode;
    } else {
        label = challengeDisplayNames[challengeMode] || challengeMode;
    }
    challengeSelectBtn.textContent = label;
    const introBtn = document.getElementById('introChallengeBtn');
    if (introBtn) introBtn.textContent = label;
}

// Button click opens the combo modal
challengeSelectBtn.addEventListener('click', () => {
    populateComboModal();
    comboModalOverlay.style.display = 'flex';
});

comboApplyBtn.addEventListener('click', () => {
    // Collect selected challenges
    activeChallenges.clear();
    if (comboStranger.checked) activeChallenges.add('stranger');
    if (comboDyslexic.checked) activeChallenges.add('dyslexic');
    if (comboPhantom.checked) activeChallenges.add('phantom');
    if (comboRubber.checked) activeChallenges.add('rubber');
    if (comboOz.checked) activeChallenges.add('oz');
    if (comboThinner.checked) activeChallenges.add('thinner');
    if (comboThicker.checked) activeChallenges.add('thicker');
    if (comboNervous.checked) activeChallenges.add('nervous');
    if (comboCarrie.checked) activeChallenges.add('carrie');
    if (comboNokings.checked) activeChallenges.add('nokings');
    if (comboLongAgo.checked) activeChallenges.add('longago');
    if (comboComingSoon.checked) activeChallenges.add('comingsoon');
    if (comboSixSeven.checked) activeChallenges.add('sixseven');
    if (comboGremlins.checked) activeChallenges.add('gremlins');
    if (comboLattice.checked) activeChallenges.add('lattice');
    if (comboYesAnd.checked) activeChallenges.add('yesand');
    if (comboMercurial && comboMercurial.checked) activeChallenges.add('mercurial');
    if (comboShadowless && comboShadowless.checked) activeChallenges.add('shadowless');
    if (comboAmnesia && comboAmnesia.checked) activeChallenges.add('amnesia');
    if (comboVertigo && comboVertigo.checked) activeChallenges.add('vertigo');
    
    // Determine challenge mode based on selection count
    if (activeChallenges.size === 0) {
        challengeMode = 'normal';
    } else if (activeChallenges.size === 1) {
        challengeMode = Array.from(activeChallenges)[0];
    } else {
        challengeMode = 'combo';
    }
    
    applyChallengeMode(challengeMode);
    updateChallengeButtonLabel();
    comboModalOverlay.style.display = 'none';
    
    // Refresh leaderboard to show correct mode
    const leaderboardContent = document.getElementById('leaderboardContent');
    if (leaderboardContent && leaderboardContent.style.display !== 'none' && window.leaderboard) {
        const selectedMode = modeButtonsArray[selectedModeIndex].getAttribute('data-mode');
        window.leaderboard.displayLeaderboard(selectedMode, null, getLeaderboardMode(), skillLevel);
    }
    
    console.log('🎯 Challenges applied:', challengeMode, Array.from(activeChallenges));
});

comboCancelBtn.addEventListener('click', () => {
    comboModalOverlay.style.display = 'none';
    
    // Refresh leaderboard to match current mode
    const leaderboardContent = document.getElementById('leaderboardContent');
    if (leaderboardContent && leaderboardContent.style.display !== 'none' && window.leaderboard) {
        const selectedMode = modeButtonsArray[selectedModeIndex].getAttribute('data-mode');
        window.leaderboard.displayLeaderboard(selectedMode, null, getLeaderboardMode(), skillLevel);
    }
});

// Close combo modal when clicking outside
comboModalOverlay.addEventListener('click', (e) => {
    if (e.target === comboModalOverlay) {
        comboCancelBtn.click();
    }
});

// ─── Menu Dropdown Buttons (Skill Level & Difficulty) ───
const skillLevelMenuBtn = document.getElementById('skillLevelMenuBtn');
const difficultyMenuBtn = document.getElementById('difficultyMenuBtn');
const menuStartGameBtn = document.getElementById('menuStartGameBtn');
const skillLevelModalOverlay = document.getElementById('skillLevelModalOverlay');
const difficultyModalOverlay = document.getElementById('difficultyModalOverlay');

function closeAllMenuPopups() {
    // No longer needed for simple popups, but kept for compatibility
}

// Button label update functions
function updateSkillLevelButton() {
    const names = { 'breeze': '🌥️ Breeze', 'tempest': '🌊 Tempest', 'maelstrom': '🌪️ Maelstrom' };
    const label = names[skillLevel] || '🌊 Tempest';
    const btn = document.getElementById('skillLevelMenuBtn');
    const introBtn = document.getElementById('introSkillLevelBtn');
    if (btn) btn.textContent = label;
    if (introBtn) introBtn.textContent = label;
}

function updateDifficultyButton() {
    const names = { 'drizzle': '🌧️ Drizzle', 'downpour': '⛈️ Downpour', 'hailstorm': '🧊 Hailstorm', 'blizzard': '❄️ Blizzard', 'hurricane': '🌀 Hurricane' };
    const currentMode = modeButtonsArray[selectedModeIndex]?.getAttribute('data-mode') || 'downpour';
    const label = names[currentMode] || '⛈️ Downpour';
    const btn = document.getElementById('difficultyMenuBtn');
    const introBtn = document.getElementById('introDifficultyBtn');
    if (btn) btn.textContent = label;
    if (introBtn) introBtn.textContent = label;
}

// ─── Skill Level Modal ───
function updateSkillLevelModal() {
    if (!skillLevelModalOverlay) return;
    skillLevelModalOverlay.querySelectorAll('.selection-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.skill === skillLevel);
    });
}

if (skillLevelMenuBtn) {
    skillLevelMenuBtn.addEventListener('click', () => {
        updateSkillLevelModal();
        skillLevelModalOverlay.style.display = 'flex';
    });
}

if (skillLevelModalOverlay) {
    // Click option to select and close
    skillLevelModalOverlay.querySelectorAll('.selection-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const level = opt.dataset.skill;
            if (level) {
                // Call setSkillLevel directly (exposed globally)
                if (window.setSkillLevel) {
                    window.setSkillLevel(level);
                }
                updateSkillLevelButton();
                skillLevelModalOverlay.style.display = 'none';
                // Refresh leaderboard if visible
                const leaderboardContent = document.getElementById('leaderboardContent');
                if (leaderboardContent && leaderboardContent.style.display !== 'none' && window.leaderboard) {
                    const selectedMode = modeButtonsArray[selectedModeIndex]?.getAttribute('data-mode') || 'drizzle';
                    window.leaderboard.displayLeaderboard(selectedMode, null, getLeaderboardMode(), level);
                }
            }
        });
    });
    // Click outside to close
    skillLevelModalOverlay.addEventListener('click', (e) => {
        if (e.target === skillLevelModalOverlay) {
            skillLevelModalOverlay.style.display = 'none';
        }
    });
}

// ─── Difficulty Modal ───
function updateDifficultyModal() {
    if (!difficultyModalOverlay) return;
    const currentMode = modeButtonsArray[selectedModeIndex]?.getAttribute('data-mode') || 'downpour';
    difficultyModalOverlay.querySelectorAll('.selection-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.mode === currentMode);
    });
}

if (difficultyMenuBtn) {
    difficultyMenuBtn.addEventListener('click', () => {
        updateDifficultyModal();
        difficultyModalOverlay.style.display = 'flex';
    });
}

if (difficultyModalOverlay) {
    // Click option to select and close
    difficultyModalOverlay.querySelectorAll('.selection-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const mode = opt.dataset.mode;
            if (mode) {
                const idx = modeButtonsArray.findIndex(btn => btn.getAttribute('data-mode') === mode);
                if (idx >= 0) {
                    selectedModeIndex = idx;
                    updateSelectedMode();
                }
                localStorage.setItem('tantris_difficulty', mode);
                updateDifficultyButton();
                difficultyModalOverlay.style.display = 'none';
            }
        });
    });
    // Click outside to close
    difficultyModalOverlay.addEventListener('click', (e) => {
        if (e.target === difficultyModalOverlay) {
            difficultyModalOverlay.style.display = 'none';
        }
    });
}

// START GAME button in mode menu
if (menuStartGameBtn) {
    menuStartGameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = modeButtonsArray[selectedModeIndex]?.getAttribute('data-mode') || 'downpour';
        if (e.shiftKey && aiModeEnabled) {
            startAITuningMode(mode, skillLevel);
            return;
        }
        startGame(mode);
    });
    menuStartGameBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mode = modeButtonsArray[selectedModeIndex]?.getAttribute('data-mode') || 'downpour';
        startGame(mode);
    }, { passive: false });
}

// ─── Intro Screen Dropdown Buttons ───
const introSkillLevelBtn = document.getElementById('introSkillLevelBtn');
const introDifficultyBtn = document.getElementById('introDifficultyBtn');
const introChallengeBtn = document.getElementById('introChallengeBtn');

if (introSkillLevelBtn) {
    introSkillLevelBtn.addEventListener('click', () => {
        updateSkillLevelModal();
        skillLevelModalOverlay.style.display = 'flex';
    });
}
if (introDifficultyBtn) {
    introDifficultyBtn.addEventListener('click', () => {
        updateDifficultyModal();
        difficultyModalOverlay.style.display = 'flex';
    });
}
if (introChallengeBtn) {
    introChallengeBtn.addEventListener('click', () => {
        populateComboModal();
        document.getElementById('comboModalOverlay').style.display = 'flex';
    });
}

// Initialize menu button labels
updateSkillLevelButton();
updateDifficultyButton();

function applyChallengeMode(mode) {
    // Remove all challenge effects first
    document.documentElement.classList.remove('stranger-mode');
    StarfieldSystem.setStrangerMode(false);
    canvas.classList.remove('thinner-mode', 'thicker-mode', 'longago-mode', 'comingsoon-mode', 'nervous-active');
    
    if (window.ChallengeEffects && ChallengeEffects.Rubber) ChallengeEffects.Rubber.reset();
    if (window.ChallengeEffects && ChallengeEffects.Phantom) ChallengeEffects.Phantom.reset();
    nervousVibrateOffset = 0; // Reset vibration
    StormEffects.reset(); // Clear blood/poo rain effects
    if (window.ChallengeEffects && ChallengeEffects.Vertigo) ChallengeEffects.Vertigo.stop();
    
    // Clear activeChallenges if not in combo mode
    if (mode !== 'combo') {
        activeChallenges.clear();
    }
    
    challengeMode = mode;
    
    // Apply effects based on mode
    if (mode === 'stranger' || activeChallenges.has('stranger')) {
        document.documentElement.classList.add('stranger-mode');
        StarfieldSystem.setStrangerMode(true);
        console.log('🙃 STRANGER MODE: Upside-down activated!');
    }
    
    if (mode === 'phantom' || activeChallenges.has('phantom')) {
        if (window.ChallengeEffects && ChallengeEffects.Phantom) ChallengeEffects.Phantom.triggerFade();
        console.log('👻 PHANTOM MODE: Invisible stack activated!');
    }
    
    if (mode === 'rubber' || activeChallenges.has('rubber')) {
        console.log('🏀 RUBBER & GLUE MODE: Bouncing activated!');
    }
    
    if (mode === 'oz' || activeChallenges.has('oz')) {
        console.log('🌈 OZ MODE: Grayscale until landing activated!');
    }
    
    if (mode === 'thinner' || activeChallenges.has('thinner')) {
        canvas.classList.add('thinner-mode');
        console.log('📏 THINNER MODE: Skinny well activated!');
    }
    
    if (mode === 'thicker' || activeChallenges.has('thicker')) {
        canvas.classList.add('thicker-mode');
        console.log('📐 THICKER MODE: Wide well activated!');
        // updateCanvasSize will be called at the end of this function
    }
    
    if (mode === 'nervous' || activeChallenges.has('nervous')) {
        console.log('😰 NERVOUS MODE: Vibrating well activated!');
    }
    
    if (mode === 'sixseven' || activeChallenges.has('sixseven')) {
        console.log('6️⃣7️⃣ SIX SEVEN MODE: Giant pieces activated!');
    }
    
    if (mode === 'gremlins' || activeChallenges.has('gremlins')) {
        console.log('👹 GREMLINS MODE: Random disappearing activated!');
    }
    
    if (mode === 'lattice' || activeChallenges.has('lattice')) {
        console.log('🔲 LATTICE MODE: Pre-filled blocks activated!');
    }
    
    if (mode === 'longago' || activeChallenges.has('longago')) {
        canvas.classList.add('longago-mode');
        console.log('⭐ LONG AGO MODE: Star Wars perspective activated!');
        // Need to update after transform is applied
        setTimeout(() => updateCanvasSize(), 0);
    }
    
    if (mode === 'comingsoon' || activeChallenges.has('comingsoon')) {
        canvas.classList.add('comingsoon-mode');
        console.log('🔮 COMING SOON MODE: Reverse perspective activated!');
        // Need to update after transform is applied
        setTimeout(() => updateCanvasSize(), 0);
    }
    
    if (mode === 'amnesia' || activeChallenges.has('amnesia')) {
        if (window.ChallengeEffects && ChallengeEffects.Amnesia) ChallengeEffects.Amnesia.init(ROWS, COLS);        console.log('🧠 AMNESIA MODE: Color memory fade activated!');
    }
    
    if (mode === 'vertigo' || activeChallenges.has('vertigo')) {
        if (window.ChallengeEffects && ChallengeEffects.Vertigo) ChallengeEffects.Vertigo.start();
    } else {
        if (window.ChallengeEffects && ChallengeEffects.Vertigo) ChallengeEffects.Vertigo.stop();
    }
    
    if (mode === 'normal') {
        console.log('✅ NORMAL MODE: All challenges disabled');
    }
    
    // Update canvas size after all challenge modes are applied
    // This ensures Thicker mode dimensions are properly set/reset
    updateCanvasSize();
}

// Initialize canvas size
updateCanvasSize();
drawBoard();
// Ensure canvas has background even on menu
drawCanvasBackground();

// Initialize UI elements to show state (settings button visible, etc.)
toggleUIElements(true);

// Initialize music dropdown purge indicators on page load
updateMusicDropdownPurgeIndicators();

// Handle start overlay - required for audio autoplay
const startOverlay = document.getElementById('startOverlay');

// Apply pulse animation only to "Don't Panic!"
const dontPanicText = document.getElementById('dontPanicText');
if (dontPanicText) {
    // Switch from data-i18n (textContent) to data-i18n-html (innerHTML) for line break support
    const i18nKey = dontPanicText.getAttribute('data-i18n');
    if (i18nKey) {
        dontPanicText.removeAttribute('data-i18n');
        dontPanicText.setAttribute('data-i18n-html', i18nKey);
        // Re-apply translation as innerHTML now that we've switched
        if (typeof I18n !== 'undefined') {
            dontPanicText.innerHTML = I18n.t(i18nKey);
        }
    }
    dontPanicText.style.animation = 'pulse 2s ease-in-out infinite';

    // Center-click (mouse wheel button) or right-click on "Don't Panic!" to activate developer mode
    dontPanicText.addEventListener('mousedown', (e) => {
        if (e.button === 1 || e.button === 2) { // Middle mouse button or right-click
            e.preventDefault();
            developerMode = !developerMode;
            // Visual feedback
            dontPanicText.style.color = developerMode ? '#FFD700' : '';
            console.log(developerMode ? 
                '🛠️ Developer Mode ACTIVATED - Music will be disabled when starting games' : 
                '👤 Developer Mode DEACTIVATED');
            
            // Immediately turn off music if developer mode is activated
            if (developerMode && musicSelect.value !== 'none') {
                musicSelect.value = 'none';
                musicSelect.dispatchEvent(new Event('change'));
                console.log('🔇 Developer Mode: Music disabled');
            }
        }
    });

    // Prevent context menu on "Don't Panic!" text
    dontPanicText.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

// Initialize start overlay
if (startOverlay) {
    // Track page visit — requires human interaction to filter bots
    // Skip tracking if ?track=false is in the URL or navigator.webdriver is set (headless browsers)
    const _trackingEnabled = new URLSearchParams(window.location.search).get('track') !== 'false' && !navigator.webdriver;
    let _visitId = null;
    window._visitId = null;
    const _visitLoadTime = Date.now();
    let _visitRecorded = false;
    let _interactionDetected = false;

    const _recordVisit = async function() {
        if (_interactionDetected || !_trackingEnabled) return;
        _interactionDetected = true;
        // Remove interaction listeners once triggered
        ['mousemove', 'scroll', 'touchstart', 'keydown', 'click'].forEach(evt =>
            document.removeEventListener(evt, _recordVisit)
        );
        try {
            const res = await fetch('https://blockchainstorm.onrender.com/api/visit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    referrer: document.referrer || null,
                    userAgent: navigator.userAgent || null,
                    language: (typeof I18n !== 'undefined' ? I18n.getBrowserLanguage() : navigator.language) || null,
                    screenWidth: screen.width,
                    screenHeight: screen.height,
                    deviceType: DeviceDetection.isMobile ? 'phone' : DeviceDetection.isTablet ? 'tablet' : 'desktop',
                    os: detectOS()
                })
            });
            if (res.ok) {
                const data = await res.json();
                _visitId = data.visit_id;
                window._visitId = data.visit_id;
                _visitRecorded = true;
            }
        } catch (e) {
            // Non-critical, silently ignore
        }
    }

    // Listen for any human interaction to start tracking
    if (_trackingEnabled) {
        ['mousemove', 'scroll', 'touchstart', 'keydown', 'click'].forEach(evt =>
            document.addEventListener(evt, _recordVisit, { once: false, passive: true })
        );
    }

    // Get intro screen elements
    const startGameBtn = document.getElementById('startGameBtn');
    const introFullscreenCheckbox = document.getElementById('introFullscreenCheckbox');
    const introMusicCheckbox = document.getElementById('introMusicCheckbox');
    
    // Default Full Screen ON for phones
    // Default Full Screen ON for phones
    if (introFullscreenCheckbox && DeviceDetection.isMobile) {
        introFullscreenCheckbox.checked = true;
    }
    
    // Show fullscreen hint for mobile users not in fullscreen/standalone mode
    (function showFullscreenHint() {
        const hint = document.getElementById('fullscreenHint');
        if (!hint) return;
        
        const isStandalone = window.navigator.standalone || 
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches;
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        if (isStandalone || isFullscreen || !isTouch) return;
        
        const ua = navigator.userAgent;
        const isIOS = /iphone|ipad|ipod/i.test(ua) || 
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 2);
        const isAndroid = /android/i.test(ua);
        
        if (isIOS) {
            hint.innerHTML = I18n.t('intro.fullscreenHint.ios');
        } else if (isAndroid) {
            hint.innerHTML = I18n.t('intro.fullscreenHint.android');
        } else {
            hint.innerHTML = I18n.t('intro.fullscreenHint.generic');
        }
        hint.style.display = 'block';
        
        // Hide Music/Full Screen toggles on phones — they'll use settings instead
        if (DeviceDetection.isMobile) {
            const togglesRow = document.querySelector('.intro-toggles-row');
            if (togglesRow) togglesRow.style.display = 'none';
        }
    })();
    
    // Sync intro music toggle with settings music select on load
    if (introMusicCheckbox && musicSelect) {
        // Sync initial state: checked = any music, unchecked = none
        introMusicCheckbox.checked = musicSelect.value !== 'none';
        
        // When intro toggle changes, sync to settings
        introMusicCheckbox.addEventListener('change', () => {
            musicSelect.value = introMusicCheckbox.checked ? 'shuffle' : 'none';
        });
        
        // When settings select changes, sync back to intro toggle
        musicSelect.addEventListener('change', () => {
            introMusicCheckbox.checked = musicSelect.value !== 'none';
        });
    }
    // Sync skill level selectors (intro, settings)
    const introSkillLevelSelect = document.getElementById('introSkillLevelSelect');
    const skillLevelSelect = document.getElementById('skillLevelSelect');
    
    // Sync all selects to the saved skill level from localStorage
    if (introSkillLevelSelect) introSkillLevelSelect.value = skillLevel;
    if (skillLevelSelect) skillLevelSelect.value = skillLevel;
    
    // Function to update rules display based on skill level
    const updateRulesForSkillLevel = function(level) {
        const goalText = document.getElementById('rulesGoalText');
        const tsunamiSection = document.getElementById('rulesTsunamiSection');
        const volcanoSection = document.getElementById('rulesVolcanoSection');
        const blackHoleSection = document.getElementById('rulesBlackHoleSection');
        const tsunamiScoring = document.getElementById('rulesTsunamiScoring');
        const volcanoScoring = document.getElementById('rulesVolcanoScoring');
        const blackHoleScoring = document.getElementById('rulesBlackHoleScoring');
        const speedBonusText = document.getElementById('rulesSpeedBonusText');
        
        if (level === 'breeze') {
            // Breeze: No disasters at all
            if (goalText) goalText.innerHTML = I18n.t('rules.goal');
            if (tsunamiSection) tsunamiSection.style.display = 'none';
            if (volcanoSection) volcanoSection.style.display = 'none';
            if (blackHoleSection) blackHoleSection.style.display = 'none';
            if (tsunamiScoring) tsunamiScoring.style.display = 'none';
            if (volcanoScoring) volcanoScoring.style.display = 'none';
            if (blackHoleScoring) blackHoleScoring.style.display = 'none';
            if (speedBonusText) speedBonusText.innerHTML = I18n.t('rules.speedBonusSimple');
        } else if (level === 'tempest') {
            // Tempest: Tsunamis and Black Holes only
            if (goalText) goalText.innerHTML = I18n.t('rules.goal');
            if (tsunamiSection) tsunamiSection.style.display = 'block';
            if (volcanoSection) volcanoSection.style.display = 'none';
            if (blackHoleSection) blackHoleSection.style.display = 'block';
            if (tsunamiScoring) tsunamiScoring.style.display = 'block';
            if (volcanoScoring) volcanoScoring.style.display = 'none';
            if (blackHoleScoring) blackHoleScoring.style.display = 'block';
            if (speedBonusText) speedBonusText.innerHTML = I18n.t('rules.speedBonusSimple');
        } else {
            // Maelstrom: Everything
            if (goalText) goalText.innerHTML = I18n.t('rules.goalMaelstrom');
            if (tsunamiSection) tsunamiSection.style.display = 'block';
            if (volcanoSection) volcanoSection.style.display = 'block';
            if (blackHoleSection) blackHoleSection.style.display = 'block';
            if (tsunamiScoring) tsunamiScoring.style.display = 'block';
            if (volcanoScoring) volcanoScoring.style.display = 'block';
            if (blackHoleScoring) blackHoleScoring.style.display = 'block';
            if (speedBonusText) speedBonusText.innerHTML = I18n.t('rules.speedBonus');
        }
    }
    
    // Function to sync all skill level selectors and update game state
    const setSkillLevel = function(level) {
        skillLevel = level;
        window.skillLevel = level; // Expose globally for AI
        localStorage.setItem('skillLevel', level);
        if (introSkillLevelSelect) introSkillLevelSelect.value = level;
        if (skillLevelSelect) skillLevelSelect.value = level;
        updateRulesForSkillLevel(level);
        updateSpecialEventsDisplay(level);
        // Update menu button
        if (typeof updateSkillLevelButton === 'function') updateSkillLevelButton();
        console.log('🎮 Skill level set to:', level);
    }
    window.setSkillLevel = setSkillLevel;
    
    // Wire up skill level selectors
    if (introSkillLevelSelect) {
        introSkillLevelSelect.addEventListener('change', () => setSkillLevel(introSkillLevelSelect.value));
    }
    if (skillLevelSelect) {
        skillLevelSelect.addEventListener('change', () => setSkillLevel(skillLevelSelect.value));
    }
    
    // Initialize with saved skill level (updates rules display and special events)
    updateRulesForSkillLevel(skillLevel);
    updateSpecialEventsDisplay(skillLevel);
    
    // Check login status and show/hide login button
    const checkIntroLoginStatus = function() {
        // Check if user is logged in via oi_token (from auth.js)
        const isLoggedIn = !!localStorage.getItem('oi_token');
        const btn = document.getElementById('introLoginBtn');
        if (btn) {
            btn.classList.toggle('hidden', isLoggedIn);
        }
    }
    checkIntroLoginStatus();
    
    // Login button handler - use auth.js showLoginModal
    const introLoginBtnEl = document.getElementById('introLoginBtn');
    if (introLoginBtnEl) {
        introLoginBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof showLoginModal === 'function') {
                showLoginModal();
            } else {
                // Fallback if auth.js not loaded
                window.location.href = 'https://official-intelligence.art/?login=1';
            }
        });
    }
    
    // Start Game button handler
    let introScreenDismissed = false;
    const dismissIntroScreen = function() {
        // Guard against double-fire (touchend + synthetic click on iOS)
        if (introScreenDismissed) return;
        introScreenDismissed = true;
        window._dismissingIntro = true;
        
        // Record play click
        const timeToPlay = (Date.now() - _visitLoadTime) / 1000;
        if (_trackingEnabled) {
            if (_visitId) {
                // Visit already recorded, just mark as played
                fetch(`https://blockchainstorm.onrender.com/api/visit/${_visitId}/played`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ timeToPlay })
                }).catch(() => {});
            } else if (!_visitRecorded) {
                // Visit POST may still be in-flight or user clicked Play as first interaction
                (async () => {
                    try {
                        // Ensure visit is recorded first
                        if (!_interactionDetected) {
                            _interactionDetected = true;
                            ['mousemove', 'scroll', 'touchstart', 'keydown', 'click'].forEach(evt =>
                                document.removeEventListener(evt, _recordVisit)
                            );
                        }
                        const res = await fetch('https://blockchainstorm.onrender.com/api/visit', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                referrer: document.referrer || null,
                                userAgent: navigator.userAgent || null,
                                language: (typeof I18n !== 'undefined' ? I18n.getBrowserLanguage() : navigator.language) || null,
                                screenWidth: screen.width,
                                screenHeight: screen.height,
                                deviceType: DeviceDetection.isMobile ? 'phone' : DeviceDetection.isTablet ? 'tablet' : 'desktop',
                                os: detectOS()
                            })
                        });
                        if (res.ok) {
                            const data = await res.json();
                            _visitId = data.visit_id;
                            window._visitId = data.visit_id;
                            _visitRecorded = true;
                            fetch(`https://blockchainstorm.onrender.com/api/visit/${data.visit_id}/played`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ timeToPlay })
                            }).catch(() => {});
                        }
                    } catch (e) {}
                })();
            }
        }
        // Mark that user has interacted (gates audio system)
        markUserInteraction();
        
        // Resume audioContext first — since music now plays asynchronously via fetch→blob,
        // we don't need to race against the user-activation token.
        // The page's "activated" state persists for all future media playback.
        _audioDbg('dismissIntro: audioContext.state=' + audioContext.state);
        if (audioContext.state === 'suspended') {
            _audioDbg('dismissIntro: calling audioContext.resume()');
            audioContext.resume().then(() => _audioDbg('dismissIntro: resume() resolved, state=' + audioContext.state))
                .catch(e => _audioDbg('dismissIntro: resume() FAILED: ' + e.message));
        }
        
        // Start menu music (fetches MP3 as blob, then plays)
        stopMusic();
        _audioDbg('dismissIntro: musicSelect.value=' + musicSelect.value);
        if (musicSelect.value !== 'none') {
            _audioDbg('dismissIntro: calling startMenuMusic()');
            startMenuMusic(musicSelect);
        }
        // FULLSCREEN LAST
        const wantFullscreen = (introFullscreenCheckbox && introFullscreenCheckbox.checked) ||
            DeviceDetection.isMobile || DeviceDetection.isTablet;
        if (wantFullscreen) {
            try {
                const elem = document.documentElement;
                if (elem.requestFullscreen) {
                    elem.requestFullscreen().catch(() => {});
                } else if (elem.webkitRequestFullscreen) {
                    elem.webkitRequestFullscreen();
                } else if (elem.msRequestFullscreen) {
                    elem.msRequestFullscreen();
                }
            } catch (e) {
                // Silently handle fullscreen errors (permissions, unsupported, etc.)
            }
        }
        // Hide the main menu so it doesn't flash during fade
        const modeMenuEl = document.getElementById('modeMenu');
        if (modeMenuEl) modeMenuEl.classList.add('hidden');
        // Fade overlay out visually but keep it in the DOM for 400ms to absorb
        // ghost taps that iOS generates after touchend (~300ms delay).
        startOverlay.style.opacity = '0';
        startOverlay.style.transition = 'opacity 0.15s';
        // Start game immediately
        const mode = modeButtonsArray[selectedModeIndex]?.getAttribute('data-mode') || 'downpour';
        startGame(mode);
        setTimeout(() => {
            startOverlay.style.display = 'none';
            window._dismissingIntro = false;
        }, 400);
        
    }
    
    if (startGameBtn) {
        startGameBtn.addEventListener('click', (e) => {
            _audioDbg('startGameBtn CLICK fired');
            e.stopPropagation();
            dismissIntroScreen();
        });
    }
    
    // Development bypass: Right-click + Shift/Ctrl to disable domain validation
    if (startGameBtn) {
        startGameBtn.addEventListener('contextmenu', (e) => {
            if (e.shiftKey || e.ctrlKey) {
                e.preventDefault();
                if (typeof RenderUtils !== 'undefined' && RenderUtils._dbg) {
                    RenderUtils._dbg();
                    console.log('🔓 Development mode enabled');
                }
            }
        });
    }

    // Add touchend for mobile Safari/Android for the start button
    if (startGameBtn) {
        startGameBtn.addEventListener('touchend', (e) => {
            _audioDbg('startGameBtn TOUCHEND fired');
            e.preventDefault();
            e.stopPropagation();
            dismissIntroScreen();
        }, { passive: false });
    }
}

// Also allow keyboard to start the game (Enter or Space)
document.addEventListener('keydown', (e) => {
    if (startOverlay && startOverlay.style.display !== 'none') {
        // Only start on Enter or Space key
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const startGameBtn = document.getElementById('startGameBtn');
            if (startGameBtn) {
                startGameBtn.click();
            }
        }
    }
}, { once: true });

// Initialize high score system
console.log(`🏆 ${window.GAME_TITLE || 'BLOCKCHaiNSTORM'} High Score System Initialized`);
console.log('💡 To test high score prompt in console, type: testHighScore(1000000)');
console.log('📊 Leaderboard uses server if available, falls back to local storage');

// Tap anywhere to unpause (for tablet mode)
let unpauseHandled = false;
const handleUnpauseTap = (e) => {
    if (!gameRunning || !paused || justPaused) return;
    if (unpauseHandled) return;
    
    // Don't unpause if clicking on settings button, settings overlay, pause button, or replay controls
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const pauseBtn = document.getElementById('pauseBtn');
    const replayPauseBtn = document.getElementById('replayPauseBtn');
    const replayStopBtn = document.getElementById('replayStopBtn');
    
    if (settingsBtn && settingsBtn.contains(e.target)) return;
    if (settingsOverlay && settingsOverlay.contains(e.target)) return;
    if (settingsOverlay && settingsOverlay.style.display === 'flex') return;
    if (pauseBtn && pauseBtn.contains(e.target)) return;
    if (replayPauseBtn && replayPauseBtn.contains(e.target)) return;
    if (replayStopBtn && replayStopBtn.contains(e.target)) return;
    
    // During replay, don't allow tap-to-unpause (use replay controls instead)
    if (GameReplay.isActive()) return;
    
    // Prevent double-firing from both touchend and click
    unpauseHandled = true;
    setTimeout(() => { unpauseHandled = false; }, 300);
    
    // Unpause
    togglePause();
};

document.addEventListener('click', handleUnpauseTap);
document.addEventListener('touchend', handleUnpauseTap);
console.log('🎬 Replay system initialized');// Replay system extracted to replay.js (window.GameReplay)
