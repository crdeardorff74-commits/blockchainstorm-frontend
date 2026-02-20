// ===== LEADERBOARD MODULE =====
// All leaderboard-related functionality

window.leaderboard = (function() {

// API Configuration
const API_URL = AppConfig.GAME_API;

// Minimum score to qualify for leaderboard (scores below this display as ₿0.0000)
const MIN_LEADERBOARD_SCORE = 500;

// State
let currentLeaderboardMode = null;
let currentLeaderboardGameMode = 'normal'; // Track if viewing normal or challenge leaderboard
let currentLeaderboardSkillLevel = 'tempest'; // Track current skill level
let lastPlayerScore = null;
let lastScoreData = null;
let currentUser = null;
let isAnonymous = true;
let isSubmittingScore = false; // Module-level flag to prevent duplicate submissions

// Profanity filter using regex
function censorProfanity(text) {
    // Common profanity patterns (case-insensitive)
    const profanityPatterns = [
        /f+u+c+k+\w*/gi,
        /\bs+h+i+t+\w*/gi,
        /\ba+s+s+(?:hole|hat|wipe)?\b/gi,
        /\bb+i+t+c+h+\w*/gi,
        /\bc+u+n+t+\w*/gi,
        /\bd+a+m+n+\w*/gi,
        /\bc+o+c+k+\w*/gi,
        /\bw+h+o+r+e+\w*/gi,
        /\bs+l+u+t+\w*/gi,
        /\bf+a+g+(?:got)?\w*/gi,
        /\bn+i+g+g+\w*/gi,
        /\br+e+t+a+r+d+\w*/gi,
        /\bt+w+a+t+\w*/gi,
        /\bp+u+s+s+y+\w*/gi,
        /\bp+a*e+d+o+\w*/gi,
        /\bc+h+o+m+o+\w*/gi,
        // Leetspeak variations
        /f[u\*@0]+[c\(k]+/gi,
        /\b[s\$5]+h[i1!]+t/gi,
        /\b[a@4]+[s\$5]+[s\$5]+/gi,
    ];
    
    let censored = text;
    for (const pattern of profanityPatterns) {
        censored = censored.replace(pattern, (match) => '*'.repeat(match.length));
    }
    return censored;
}

// Debug function to test high score system
window.testHighScore = async function(testScore = 1000000) {
    Logger.debug('Testing high score system with score:', testScore);
    const scoreData = {
        game: 'tantris',
        difficulty: 'drizzle',
        mode: 'normal',
        score: testScore,
        lines: 100,
        level: 10,
        strikes: 5,
        tsunamis: 3,
        blackholes: 2,
        volcanoes: 1,
        duration: 300,
        speedBonus: 1.0
    };
    
    const isTopTen = await checkIfTopTen('drizzle', testScore);
    Logger.debug('Is this score in the top 20?', isTopTen);
    
    if (isTopTen) {
        Logger.debug('Score makes top 20! Showing name entry prompt...');
        promptForName(scoreData);
    } else {
        Logger.debug('Score does not make top 20. Showing leaderboard only...');
        await displayLeaderboard('drizzle', testScore);
    }
};

/**
 * Fetches leaderboard data from the server for a specific difficulty, mode, and skill level.
 * Falls back to local storage if the server request fails or times out.
 * @async
 * @param {string} difficulty - The difficulty level (e.g., 'drizzle', 'downpour', 'hailstorm', 'blizzard', 'hurricane').
 * @param {string} [mode='normal'] - The game mode (e.g., 'normal', 'challenge', 'ai', 'ai-challenge').
 * @param {string} [skillLevel='tempest'] - The skill level filter for the leaderboard.
 * @returns {Promise<Array<Object>>} An array of leaderboard entry objects, sorted by score descending.
 */
async function fetchLeaderboard(difficulty, mode = 'normal', skillLevel = 'tempest') {
    try {
        Logger.info(`Fetching leaderboard for ${difficulty} (${mode}) skill:${skillLevel} from ${API_URL}/leaderboard/tantris/${difficulty}/${mode}?skill_level=${skillLevel}`);
        
        const response = await apiFetch(`${API_URL}/leaderboard/tantris/${difficulty}/${mode}?skill_level=${skillLevel}`, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-store',
            headers: { 'Accept': 'application/json' },
            timeout: 8000
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        Logger.info('Leaderboard data received:', data);
        return data.leaderboard || [];
    } catch (error) {
        if (error.name === 'AbortError') {
            Logger.error('Leaderboard fetch timed out, using local storage fallback');
        } else {
            Logger.error('Error fetching leaderboard, using local storage fallback:', error);
        }
        return getLocalLeaderboard(difficulty, mode, skillLevel);
    }
}

// Local storage fallback for leaderboard
function getLocalLeaderboard(difficulty, mode = 'normal', skillLevel = 'tempest') {
    const key = `tantris_leaderboard_${difficulty}_${mode}_${skillLevel}`;
    const stored = localStorage.getItem(key);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            Logger.error('Error parsing local leaderboard:', e);
            return [];
        }
    }
    return [];
}

// Save to local leaderboard
function saveLocalLeaderboard(difficulty, scores, mode = 'normal', skillLevel = 'tempest') {
    const key = `tantris_leaderboard_${difficulty}_${mode}_${skillLevel}`;
    try {
        const topScores = scores.slice(0, 20);
        localStorage.setItem(key, JSON.stringify(topScores));
    } catch (e) {
        Logger.error('Error saving local leaderboard:', e);
    }
}

/**
 * Displays the leaderboard in the left rules panel, replacing the rules/instructions content.
 * Fetches current scores from the server, renders them as an HTML table, and highlights
 * the player's score if provided.
 * @async
 * @param {string} difficulty - The difficulty level to display (e.g., 'drizzle', 'downpour').
 * @param {number|null} [playerScore=null] - The current player's score to highlight in the leaderboard, or null for no highlight.
 * @param {string} [mode='normal'] - The game mode (e.g., 'normal', 'challenge', 'ai-challenge').
 * @param {string} [skillLevel='tempest'] - The skill level filter for the leaderboard.
 * @returns {Promise<void>}
 */
async function displayLeaderboard(difficulty, playerScore = null, mode = 'normal', skillLevel = 'tempest') {
    const rulesPanel = document.querySelector('.rules-panel');
    const rulesInstructions = rulesPanel.querySelector('.rules-instructions');
    const histogramCanvas = document.getElementById('histogramCanvas');
    
    currentLeaderboardMode = difficulty;
    currentLeaderboardGameMode = mode; // Track current game mode (normal/challenge)
    currentLeaderboardSkillLevel = skillLevel; // Track current skill level
    
    // Remember the player's score for highlighting when redisplaying
    if (playerScore !== null) {
        lastPlayerScore = playerScore;
    }
    
    // Hide instructions and histogram
    if (rulesInstructions) rulesInstructions.style.display = 'none';
    if (histogramCanvas) histogramCanvas.style.display = 'none';
    
    // Update the view dropdown to show the correct leaderboard mode
    const viewSelect = document.getElementById('rulesPanelViewSelect');
    if (viewSelect) {
        viewSelect.value = 'leaderboard-' + mode;
        // Keep localStorage in sync so toggleUIElements reads the correct mode
        localStorage.setItem('rulesPanelView', 'leaderboard-' + mode);
    }
    
    // Get or create leaderboard content div inside rules-panel
    let leaderboardContent = document.getElementById('leaderboardContent');
    if (!leaderboardContent) {
        leaderboardContent = document.createElement('div');
        leaderboardContent.id = 'leaderboardContent';
        rulesPanel.appendChild(leaderboardContent);
    }
    
    leaderboardContent.style.display = 'block';
    
    leaderboardContent.innerHTML = `
        <div class="leaderboard-loading">
            Loading ${difficulty} leaderboard...
        </div>
    `;
    
    const scores = await fetchLeaderboard(difficulty, mode, skillLevel);
    
    if (!scores) {
        leaderboardContent.innerHTML = `
            <div class="leaderboard-error">
                Failed to load leaderboard.<br>
                Check your connection.
            </div>
        `;
        return;
    }
    
    if (scores.length === 0) {
        leaderboardContent.innerHTML = `
            <div class="leaderboard-loading">No scores yet. Be the first!</div>
        `;
        return;
    }
    
    let html = `
        <table class="leaderboard-table">
            <thead>
                <tr>
                    <th class="rank">#</th>
                    <th class="name">Name</th>
                    <th class="events-col">Events</th>
                    <th class="score">Score</th>
                    <th>Lines</th>
                    ${(mode === 'challenge' || mode === 'ai-challenge') ? '<th class="challenges-col">🎯</th>' : ''}
                    <th class="replay-col" title="Watch Replay">▶</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    scores.forEach((entry, index) => {
        // Type-safe exact match - convert both to numbers for comparison
        // Use lastPlayerScore if playerScore wasn't explicitly passed
        const entryScore = Number(entry.score);
        const scoreToHighlight = playerScore !== null ? playerScore : lastPlayerScore;
        const targetScore = Number(scoreToHighlight);
        const isPlayerScore = scoreToHighlight && entryScore === targetScore;
        if (isPlayerScore) {
            Logger.info(`🎯 Highlighting score at rank ${index + 1}: ${entryScore}`);
            window.lastLeaderboardRank = index + 1;
        }
        const rowClass = isPlayerScore ? 'player-score' : '';
        
        let events = [];
        if (entry.strikes > 0) events.push(`⚡${entry.strikes}`);
        if (entry.tsunamis > 0) events.push(`🌊${entry.tsunamis}`);
        if (entry.volcanoes > 0) {
            const superV = entry.superVolcanoes || 0;
            if (superV > 0) {
                events.push(`<span class="super-event-glow" title="Supervolcano x2 (${superV})">🌋${entry.volcanoes}</span>`);
            } else {
                events.push(`🌋${entry.volcanoes}`);
            }
        }
        if (entry.blackholes > 0) {
            const superBH = entry.supermassiveBlackHoles || 0;
            if (superBH > 0) {
                events.push(`<span class="super-event-glow" title="Supermassive Black Hole x2 (${superBH})">🕳️${entry.blackholes}</span>`);
            } else {
                events.push(`🕳️${entry.blackholes}`);
            }
        }
        
        // Format events in 2 rows: first 2 on line 1, rest on line 2
        let eventsHtml = '';
        if (events.length > 0) {
            const line1 = events.slice(0, 2).join(' ');
            const line2 = events.slice(2).join(' ');
            eventsHtml = `<span style="white-space:nowrap">${line1}</span>`;
            if (line2) {
                eventsHtml += `<br><span style="white-space:nowrap">${line2}</span>`;
            }
        }
        const eventsCell = `<td class="events-col">${eventsHtml}</td>`;
        
        // Build challenges display for challenge mode
        let challengesCell = '';
        let hasChallenge = false;
        let challengeNames = '';
        if (mode === 'challenge' || mode === 'ai-challenge') {
            const challenges = entry.challenges || [];
            if (challenges.length > 0) {
                challengeNames = challenges.map(c => getChallengeDisplayName(c)).join(', ');
                challengesCell = `<td class="challenges-col" data-challenges="${escapeHtml(challengeNames)}"><span class="challenge-count">${challenges.length}</span></td>`;
                hasChallenge = true;
            } else {
                challengesCell = '<td class="challenges-col">-</td>';
            }
        }
        
        // Get speed bonus (default to 1.0 for older entries)
        const speedBonus = entry.speedBonus || 1.0;
        
        // Build replay cell
        const youtubeGameScore = 2288519500; // Digeratist's ₿228.8519 game with no recording
        const isYoutubeGame = !entry.recording_id && entry.username === 'Digeratist' && entry.score === youtubeGameScore;
        let replayCell;
        if (entry.recording_id) {
            replayCell = `<td class="replay-col"><span class="replay-btn" data-recording-id="${entry.recording_id}" title="Watch replay">▶️</span></td>`;
        } else if (isYoutubeGame) {
            replayCell = `<td class="replay-col"><span class="replay-btn youtube-recording" title="Watch on YouTube">▶️</span></td>`;
        } else {
            replayCell = '<td class="replay-col"><span class="replay-btn no-recording" title="No recording available">▶️</span></td>';
        }
        
        // All rows can show tooltip (for speed bonus), add data attributes
        const rowClasses = [rowClass, 'has-tooltip', hasChallenge ? 'has-challenges' : ''].filter(c => c).join(' ');
        
        html += `
            <tr class="${rowClasses}" data-challenges="${hasChallenge ? escapeHtml(challengeNames) : ''}" data-speed-bonus="${speedBonus.toFixed(2)}">
                <td class="rank">${index + 1}</td>
                <td class="name">${escapeHtml(entry.username)}</td>
                ${eventsCell}
                <td class="score">₿${(entry.score / 10000000).toFixed(4)}</td>
                <td>${entry.lines}</td>
                ${challengesCell}
                ${replayCell}
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    leaderboardContent.innerHTML = html;
    attachReplayButtonListeners();
}

// Attach click listeners to replay buttons
function attachReplayButtonListeners() {
    const replayBtns = document.querySelectorAll('.replay-btn');
    replayBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const recordingId = btn.getAttribute('data-recording-id');
            if (recordingId) {
                await startReplay(recordingId);
            } else if (btn.classList.contains('youtube-recording')) {
                showYoutubeRecordingPopup();
            } else if (btn.classList.contains('no-recording')) {
                showNoRecordingPopup();
            }
        });
    });
}

function showNoRecordingPopup() {
    let popup = document.getElementById('noRecordingPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'noRecordingPopup';
        popup.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95); color: #aaa; padding: 24px 32px;
            border-radius: 8px; font-size: 16px; z-index: 100001;
            border: 2px solid #555; box-shadow: 0 4px 20px rgba(0,0,0,0.7);
            text-align: center; max-width: 90vw;
        `;
        popup.innerHTML = `
            <div style="margin-bottom: 16px;">This game was played before recording/playback became available.</div>
            <button onclick="this.parentElement.style.display='none'" style="
                background: #333; color: #aaa; border: 1px solid #555;
                padding: 8px 24px; border-radius: 4px; cursor: pointer; font-size: 14px;
            ">OK</button>
        `;
        document.body.appendChild(popup);
    }
    popup.style.display = 'block';
}

function showYoutubeRecordingPopup() {
    let popup = document.getElementById('youtubeRecordingPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'youtubeRecordingPopup';
        popup.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95); color: #aaa; padding: 24px 32px;
            border-radius: 8px; font-size: 16px; z-index: 100001;
            border: 2px solid #555; box-shadow: 0 4px 20px rgba(0,0,0,0.7);
            text-align: center; max-width: 90vw;
        `;
        popup.innerHTML = `
            <div style="margin-bottom: 16px; line-height: 1.6;">
                A playback recording for this game is not available, as the score was so high that
                submission was unsuccessful, exposing a flaw in the database. A video of the game
                is available on YouTube:
            </div>
            <a href="https://www.youtube.com/watch?v=UJLXsKeiKzk&t=627s" target="_blank" rel="noopener" style="
                color: #FFD700; text-decoration: underline; font-size: 16px;
            ">Watch on YouTube ▶</a>
            <div style="margin-top: 16px;">
                <button onclick="this.parentElement.parentElement.style.display='none'" style="
                    background: #333; color: #aaa; border: 1px solid #555;
                    padding: 8px 24px; border-radius: 4px; cursor: pointer; font-size: 14px;
                ">OK</button>
            </div>
        `;
        document.body.appendChild(popup);
    }
    popup.style.display = 'block';
}

// Fetch recording and start replay
async function startReplay(recordingId) {
    try {
        Logger.info(`🎬 Fetching recording ${recordingId}...`);
        
        const response = await apiFetch(`${API_URL}/recording/${recordingId}`, { timeout: 15000 });
        if (!response.ok) {
            throw new Error(`Failed to fetch recording: ${response.status}`);
        }
        
        const recording = await response.json();
        Logger.info('🎬 Recording loaded:', recording.username, recording.score, 'pts');
        
        // Call the game's replay function if available
        if (typeof GameReplay !== 'undefined' && GameReplay.start) {
            GameReplay.start(recording);
        } else {
            Logger.error('🎬 Replay function not available');
            alert('Replay feature not yet available');
        }
        
    } catch (error) {
        Logger.error('🎬 Failed to load recording:', error);
        alert('Failed to load recording');
    }
}

/**
 * Hides the leaderboard panel and restores the rules/instructions view.
 * Resets the view dropdown to "How to Play" and clears the current leaderboard mode.
 * @returns {void}
 */
function hideLeaderboard() {
    const leaderboardContent = document.getElementById('leaderboardContent');
    const rulesInstructions = document.querySelector('.rules-instructions');
    const viewSelect = document.getElementById('rulesPanelViewSelect');
    
    if (leaderboardContent) {
        leaderboardContent.style.display = 'none';
    }
    
    if (rulesInstructions) {
        rulesInstructions.style.display = 'block';
    }
    
    // Reset the view dropdown to "How to Play"
    if (viewSelect) {
        viewSelect.value = 'rules';
    }
    
    currentLeaderboardMode = null;
}

/**
 * Returns the human-readable display name (with emoji) for a given difficulty mode.
 * @param {string} mode - The internal difficulty mode key (e.g., 'drizzle', 'downpour', 'hailstorm', 'blizzard', 'hurricane').
 * @returns {string} The display name with emoji prefix, or the raw mode string if not found.
 */
function getModeDisplayName(mode) {
    const names = {
        'drizzle': '🌧️ Drizzle',
        'downpour': '⛈️ Downpour',
        'hailstorm': '🧊 Hailstorm',
        'blizzard': '❄️ Blizzard',
        'hurricane': '🌀 Hurricane'
    };
    return names[mode] || mode;
}

// Get display name for a challenge
function getChallengeDisplayName(challenge) {
    const names = {
        'stranger': 'Stranger',
        'dyslexic': 'Dyslexic',
        'phantom': 'Phantom',
        'gremlins': 'Gremlins',
        'rubber': 'Rubber & Glue',
        'oz': 'Oz',
        'lattice': 'Lattice',
        'yesand': 'Yes, And...',
        'sixseven': 'Six Seven',
        'longago': 'Long Ago...',
        'comingsoon': 'Coming Soon...',
        'thinner': 'Thinner',
        'thicker': 'Thicker',
        'nervous': 'Nervous',
        'carrie': 'Carrie',
        'nokings': 'No Kings',
        'mercurial': 'Mercurial',
        'shadowless': 'Shadowless',
        'amnesia': 'Amnesia',
        'vertigo': 'Vertigo'
    };
    return names[challenge] || challenge.charAt(0).toUpperCase() + challenge.slice(1);
}

/**
 * Checks whether a given score qualifies for the top 20 on the leaderboard.
 * Returns false for scores below the minimum leaderboard threshold.
 * @async
 * @param {string} difficulty - The difficulty level to check against (e.g., 'drizzle', 'downpour').
 * @param {number} score - The player's score to evaluate.
 * @param {string} [mode='normal'] - The game mode (e.g., 'normal', 'challenge').
 * @param {string} [skillLevel='tempest'] - The skill level filter for the leaderboard.
 * @returns {Promise<boolean>} True if the score qualifies for the top 20, false otherwise.
 */
async function checkIfTopTen(difficulty, score, mode = 'normal', skillLevel = 'tempest') {
    Logger.debug(`Checking if score ${score} makes top 20 for ${difficulty} (${mode}) skill:${skillLevel}`);
    
    // Don't allow scores that display as ₿0.0000 on the leaderboard
    if (score < MIN_LEADERBOARD_SCORE) {
        Logger.debug(`Score ${score} is below minimum ${MIN_LEADERBOARD_SCORE}, not eligible for leaderboard`);
        return false;
    }
    
    const scores = await fetchLeaderboard(difficulty, mode, skillLevel);
    
    if (!Array.isArray(scores)) {
        Logger.debug('Scores is not an array:', scores);
        return true;
    }
    
    if (scores.length < 20) {
        Logger.debug(`Only ${scores.length} scores, automatically top 20`);
        return true;
    }
    
    const lowestTopTen = scores[19].score;
    const result = score > lowestTopTen;
    Logger.debug(`Lowest top 20 score: ${lowestTopTen}, player score: ${score}, makes top 20: ${result}`);
    return result;
}

/**
 * Shows the name entry overlay for players who achieved a high score.
 * Pre-fills the input with the previously saved username if available.
 * On submission, saves the score locally, submits to the server with retries,
 * and then displays the updated leaderboard with the player's score highlighted.
 * @param {Object} scoreData - The game score data object.
 * @param {number} scoreData.score - The player's final score.
 * @param {string} scoreData.difficulty - The difficulty level played.
 * @param {string} scoreData.mode - The game mode (e.g., 'normal', 'challenge').
 * @param {number} scoreData.lines - Total lines cleared.
 * @param {number} scoreData.level - Final level reached.
 * @param {number} [scoreData.strikes] - Number of lightning strike events.
 * @param {number} [scoreData.tsunamis] - Number of tsunami events.
 * @param {number} [scoreData.volcanoes] - Number of volcano events.
 * @param {number} [scoreData.blackholes] - Number of black hole events.
 * @param {number} [scoreData.supermassiveBlackHoles] - Number of supermassive black hole events.
 * @param {number} [scoreData.superVolcanoes] - Number of super volcano events.
 * @param {Array<string>} [scoreData.challenges] - List of active challenge IDs.
 * @param {number} [scoreData.speedBonus] - Speed bonus multiplier.
 * @param {string} [scoreData.skillLevel] - The skill level setting.
 * @returns {void}
 */
function promptForName(scoreData) {
    Logger.debug('=== promptForName START ===');
    Logger.debug('Score:', scoreData.score);
    Logger.debug('Difficulty:', scoreData.difficulty);
    
    // Get elements
    const overlay = document.getElementById('nameEntryOverlay');
    const input = document.getElementById('nameEntryInput');
    const scoreDisplay = document.getElementById('nameEntryScore');
    const submitBtn = document.getElementById('nameEntrySubmit');
    
    Logger.debug('Element lookup results:', {
        overlay: !!overlay,
        input: !!input,
        scoreDisplay: !!scoreDisplay,
        submitBtn: !!submitBtn
    });
    
    if (!overlay) {
        Logger.error('❌ CRITICAL: nameEntryOverlay element not found!');
        Logger.debug('Checking DOM for all elements with IDs...');
        const allIds = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
        Logger.debug('All IDs in document:', allIds);
        return;
    }
    
    if (!input || !scoreDisplay || !submitBtn) {
        Logger.error('❌ Missing required elements inside overlay!', {
            input: !!input,
            scoreDisplay: !!scoreDisplay,
            submitBtn: !!submitBtn
        });
        return;
    }
    
    Logger.debug('✅ All required elements found');
    
    // Store score data for later submission
    lastScoreData = scoreData;
    
    // Display the score
    scoreDisplay.textContent = formatAsBitcoin(scoreData.score);
    Logger.debug('Score display updated to:', scoreDisplay.textContent);
    
    // CRITICAL: Hide the game over div FIRST to prevent overlap
    const gameOverDiv = document.getElementById('gameOver');
    if (gameOverDiv) {
        gameOverDiv.style.display = 'none';
        Logger.debug('Game over div hidden');
    }
    
    // Show overlay with maximum priority - FORCE ALL STYLES
    Logger.debug('Setting overlay to display: flex');
    overlay.style.setProperty('display', 'flex', 'important');
    overlay.style.setProperty('visibility', 'visible', 'important');
    overlay.style.setProperty('opacity', '1', 'important');
    overlay.style.setProperty('z-index', '999999', 'important');
    overlay.style.setProperty('pointer-events', 'all', 'important');
    
    // Remove any hidden class if present
    overlay.classList.remove('hidden');
    
    // Force a reflow to ensure the style is applied
    overlay.offsetHeight;
    
    // Double-check the overlay is visible
    setTimeout(() => {
        Logger.debug('Overlay display style after timeout:', overlay.style.display);
        Logger.debug('Overlay computed style after timeout:', window.getComputedStyle(overlay).display);
        Logger.debug('Overlay visibility:', window.getComputedStyle(overlay).visibility);
        Logger.debug('Overlay opacity:', window.getComputedStyle(overlay).opacity);
        Logger.debug('Overlay z-index:', window.getComputedStyle(overlay).zIndex);
        if (overlay.style.display !== 'flex') {
            Logger.error('❌ WARNING: Overlay display changed unexpectedly! Forcing back to flex');
            overlay.style.setProperty('display', 'flex', 'important');
        }
    }, 100);
    
    Logger.debug('Overlay display style is now:', overlay.style.display);
    Logger.debug('Overlay computed style:', window.getComputedStyle(overlay).display);
    
    Logger.debug('✅ Name entry overlay should now be visible');
    
    // Remove any existing event listeners by cloning the elements
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
    
    // Reset button state (may have been "Saving..." from previous submission)
    newSubmitBtn.textContent = 'Submit Score';
    newSubmitBtn.disabled = false;
    
    // Create a completely fresh input element (cloning may carry over problematic attributes)
    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.id = 'nameEntryInput';
    newInput.className = 'name-entry-input';
    newInput.placeholder = window.navigator.standalone ? 'Tap keyboard below' : 'Enter your name';
    newInput.maxLength = 20;
    newInput.readOnly = window.navigator.standalone ? true : false; // Prevent system keyboard only in standalone mode
    input.parentNode.replaceChild(newInput, input);
    
    // Pre-fill with saved username if available
    const savedUsername = localStorage.getItem('tantris_username');
    newInput.value = savedUsername || '';
    
    // Create custom on-screen keyboard (only for standalone iOS apps where system keyboard doesn't work)
    if (window.navigator.standalone) {
        // Always remove and recreate keyboard to ensure it references the current input
        let keyboard = document.getElementById('customKeyboard');
        if (keyboard) {
            keyboard.remove();
        }
        
        keyboard = document.createElement('div');
        keyboard.id = 'customKeyboard';
        keyboard.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            background: #222;
            padding: 2px 2px 6px 2px;
            box-sizing: border-box;
            z-index: 1000000;
            display: flex;
            flex-direction: column;
            gap: 2px;
            border-top: 2px solid #FFD700;
        `;
        
        // Helper to get current input element
        const getInput = () => document.getElementById('nameEntryInput');
        
        const rows = [
            '1234567890',
            'qwertyuiop',
            'asdfghjkl',
            'zxcvbnm'
        ];
        
        let isShifted = false;
        const letterKeys = [];
        
        rows.forEach((row, rowIndex) => {
            const rowDiv = document.createElement('div');
            rowDiv.style.cssText = 'display:flex;justify-content:center;gap:3px;';
            
            // Add SHIFT key before Z row
            if (rowIndex === 3) {
                const shiftKey = document.createElement('button');
                shiftKey.textContent = '⇧';
                shiftKey.style.cssText = `
                    min-width: 44px;
                    height: 38px;
                    font-size: 18px;
                    border: none;
                    border-radius: 4px;
                    background: #555;
                    color: white;
                    cursor: pointer;
                    margin-right: 4px;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: rgba(255,215,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    line-height: 1;
                `;
                const toggleShift = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    isShifted = !isShifted;
                    shiftKey.style.background = isShifted ? '#4CAF50' : '#555';
                    letterKeys.forEach(k => {
                        k.textContent = isShifted ? k.dataset.char.toUpperCase() : k.dataset.char.toLowerCase();
                    });
                };
                shiftKey.addEventListener('touchend', toggleShift);
                shiftKey.addEventListener('click', toggleShift);
                rowDiv.appendChild(shiftKey);
            }
            
            row.split('').forEach(char => {
                const key = document.createElement('button');
                const isLetter = /[a-z]/i.test(char);
                key.textContent = char;
                if (isLetter) {
                    key.dataset.char = char;
                    letterKeys.push(key);
                }
                key.style.cssText = `
                    min-width: 28px;
                    height: 38px;
                    font-size: 16px;
                    font-weight: bold;
                    border: none;
                    border-radius: 4px;
                    background: #444;
                    color: white;
                    cursor: pointer;
                    flex: 1;
                    max-width: 42px;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: rgba(255,215,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    line-height: 1;
                `;
                const addChar = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const input = getInput();
                    if (input && input.value.length < 20) {
                        const c = isLetter ? (isShifted ? char.toUpperCase() : char.toLowerCase()) : char;
                        input.value += c;
                    }
                };
                key.addEventListener('touchend', addChar);
                key.addEventListener('click', addChar);
                rowDiv.appendChild(key);
            });
            
            // Add ENTER to ASDFGHJKL row (after L)
            if (rowIndex === 2) {
                const enterKey = document.createElement('button');
                enterKey.textContent = '↵';
                enterKey.style.cssText = `
                    min-width: 44px;
                    height: 38px;
                    font-size: 18px;
                    border: none;
                    border-radius: 4px;
                    background: #4CAF50;
                    color: white;
                    cursor: pointer;
                    margin-left: 4px;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: rgba(255,215,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    line-height: 1;
                `;
                let enterHandled = false;
                const handleEnter = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (enterHandled) return;
                    enterHandled = true;
                    setTimeout(() => { enterHandled = false; }, 300);
                    newSubmitBtn.click();
                };
                enterKey.addEventListener('touchend', handleEnter);
                enterKey.addEventListener('click', handleEnter);
                rowDiv.appendChild(enterKey);
            }
            
            // Add space and backspace to last row (after M)
            if (rowIndex === 3) {
                const spaceBar = document.createElement('button');
                spaceBar.textContent = '␣';
                spaceBar.style.cssText = `
                    min-width: 54px;
                    height: 38px;
                    font-size: 18px;
                    border: none;
                    border-radius: 4px;
                    background: #444;
                    color: white;
                    cursor: pointer;
                    margin-left: 4px;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: rgba(255,215,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    line-height: 1;
                `;
                spaceBar.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const input = getInput();
                    if (input && input.value.length < 20) {
                        input.value += ' ';
                    }
                });
                spaceBar.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const input = getInput();
                    if (input && input.value.length < 20) {
                        input.value += ' ';
                    }
                });
                rowDiv.appendChild(spaceBar);
                
                const backspace = document.createElement('button');
                backspace.textContent = '⌫';
                backspace.style.cssText = `
                    min-width: 54px;
                    height: 38px;
                    font-size: 18px;
                    border: none;
                    border-radius: 4px;
                    background: #666;
                    color: white;
                    cursor: pointer;
                    margin-left: 4px;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: rgba(255,215,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    line-height: 1;
                `;
                backspace.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const input = getInput();
                    if (input) input.value = input.value.slice(0, -1);
                });
                backspace.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const input = getInput();
                    if (input) input.value = input.value.slice(0, -1);
                });
                rowDiv.appendChild(backspace);
            }
            
            keyboard.appendChild(rowDiv);
        });
        
        document.body.appendChild(keyboard);
    }
    
    // Remove debug elements
    const debugDiv = document.getElementById('tabletDebug');
    if (debugDiv) debugDiv.remove();
    const testInput = document.getElementById('testInput');
    if (testInput) testInput.remove();
    
    // Focus the input for non-standalone mode (PC/browser)
    // Don't call focus() on iOS standalone - it prevents keyboard from appearing
    if (!window.navigator.standalone) {
        setTimeout(() => {
            newInput.focus();
            // If there's a saved name, select it so user can easily change it
            if (savedUsername) {
                newInput.select();
            }
            Logger.debug('Input focused');
        }, 150);
    }
    
    Logger.debug('Input setup complete, saved username:', savedUsername);
    
    // Add submit handler
    const handleSubmit = async () => {
        Logger.debug('=== handleSubmit START ===');
        
        // Prevent double submission using module-level flag
        if (isSubmittingScore) {
            Logger.debug('Already submitting, ignoring duplicate');
            return;
        }
        isSubmittingScore = true;
        newSubmitBtn.disabled = true;
        newSubmitBtn.textContent = 'Saving...';
        Logger.debug('Button set to Saving...');
        
        const rawUsername = newInput.value.trim() || 'Anonymous';
        const username = censorProfanity(rawUsername);
        Logger.debug('Submitting score with username:', username);
        
        // Save username for next time (save the raw input, not censored version)
        if (rawUsername !== 'Anonymous') {
            localStorage.setItem('tantris_username', rawUsername);
        }
        
        // Submit pending game recording with the entered username
        if (typeof window.submitPendingRecording === 'function') {
            window.submitPendingRecording(username);
        }
        
        // Hide overlay and keyboard immediately - don't leave user waiting
        overlay.style.display = 'none';
        const keyboard = document.getElementById('customKeyboard');
        if (keyboard) keyboard.style.display = 'none';
        Logger.debug('Overlay hidden');
        
        // Don't save scores that display as ₿0.0000
        if (scoreData.score < MIN_LEADERBOARD_SCORE) {
            Logger.debug(`Score ${scoreData.score} below minimum, not saving to leaderboard`);
            const gameOverDiv = document.getElementById('gameOver');
            if (gameOverDiv) {
                gameOverDiv.style.display = 'block';
            }
            isSubmittingScore = false;
            return;
        }
        
        try {
            // Save to local leaderboard first using local data only (no network)
            const localScores = getLocalLeaderboard(scoreData.difficulty, scoreData.mode);
            Logger.debug('Got local scores:', localScores.length);
            
            const newEntry = {
                username: username,
                score: scoreData.score,
                lines: scoreData.lines,
                level: scoreData.level,
                strikes: scoreData.strikes || 0,
                tsunamis: scoreData.tsunamis || 0,
                volcanoes: scoreData.volcanoes || 0,
                blackholes: scoreData.blackholes || 0,
                supermassiveBlackHoles: scoreData.supermassiveBlackHoles || 0,
                superVolcanoes: scoreData.superVolcanoes || 0,
                challenges: scoreData.challenges || [],
                speedBonus: scoreData.speedBonus || 1.0,
                played_at: new Date().toISOString()
            };
            
            const updatedScores = [...localScores, newEntry]
                .sort((a, b) => b.score - a.score)
                .slice(0, 20);
            
            saveLocalLeaderboard(scoreData.difficulty, updatedScores, scoreData.mode);
            Logger.debug('Score saved to local leaderboard');
            
            // Set rank immediately from local data (before async server call)
            const localRank = updatedScores.findIndex(s => s.score === scoreData.score && s.username === username) + 1;
            if (localRank > 0) {
                window.lastLeaderboardRank = localRank;
            }
            
            // Try to submit to server with retries
            const submitToServer = async (retryCount = 0, maxRetries = 5) => {
                // Add human-readable challenge names for the email
                const challengeNames = scoreData.challenges && scoreData.challenges.length > 0
                    ? scoreData.challenges.map(c => getChallengeDisplayName(c)).join(', ')
                    : null;
                
                const dataToSubmit = {
                    ...scoreData,
                    username: username,
                    challengeNames: challengeNames, // Include readable names for email
                    skipNotification: new URLSearchParams(window.location.search).get('track') === 'false',
                    language: typeof I18n !== 'undefined' ? I18n.getBrowserLanguage() : navigator.language || 'en',
                    deviceType: typeof DeviceDetection !== 'undefined' ? (DeviceDetection.isMobile ? 'phone' : DeviceDetection.isTablet ? 'tablet' : 'desktop') : 'unknown',
                    os: typeof detectOS === 'function' ? detectOS() : 'unknown'
                };
                
                try {
                    const response = await apiFetch(`${API_URL}/scores/submit`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dataToSubmit),
                        timeout: 15000
                    });

                    if (response.ok) {
                        const result = await response.json();
                        Logger.info('Score submitted successfully to server:', result);
                        return true;
                    } else {
                        Logger.error('Server submission failed:', response.status);
                        throw new Error(`HTTP ${response.status}`);
                    }
                } catch (serverError) {
                    if (serverError.name === 'AbortError') {
                        Logger.error(`Server submission timed out (attempt ${retryCount + 1}/${maxRetries + 1})`);
                    } else {
                        Logger.error(`Error submitting score (attempt ${retryCount + 1}/${maxRetries + 1}):`, serverError.message);
                    }
                    
                    // Retry with exponential backoff
                    if (retryCount < maxRetries) {
                        const delay = Math.min(2000 * Math.pow(2, retryCount), 30000); // 2s, 4s, 8s, 16s, 30s
                        Logger.info(`Retrying in ${delay/1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return submitToServer(retryCount + 1, maxRetries);
                    } else {
                        Logger.error('All retry attempts failed. Score saved locally only.');
                        return false;
                    }
                }
            };
            
            // Fire off server submission and wait for it before showing leaderboard
            await submitToServer();
            
            // Small delay to ensure server has processed the score before fetching
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Display leaderboard with player's score highlighted
            await displayLeaderboard(scoreData.difficulty, scoreData.score, scoreData.mode, scoreData.skillLevel || 'tempest');
            
            // Update rank display if game over screen already showing (race condition fallback)
            if (window.lastLeaderboardRank) {
                const finalStats = document.getElementById('finalStats');
                if (finalStats) {
                    const existing = finalStats.querySelector('.rank-display');
                    const rankSpan = `<span class="rank-display" style="color: #FFD700; font-size: 1.2em;">🏆 Leaderboard Rank: #${window.lastLeaderboardRank}</span>`;
                    if (existing) {
                        existing.outerHTML = rankSpan;
                    } else {
                        finalStats.innerHTML += `<br>${rankSpan}<br>`;
                    }
                }
            }
            
        } catch (error) {
            Logger.error('Error during score submission:', error);
        }
        
        // Always show the game-over div so user can click Play Again
        const gameOverDiv = document.getElementById('gameOver');
        if (gameOverDiv) {
            gameOverDiv.style.display = 'block';
        }
        
        // Reset submission flag for next game
        isSubmittingScore = false;
        Logger.debug('=== handleSubmit END ===');
        
        // Notify game.js that score submission is complete (triggers credits animation)
        if (typeof window.onScoreSubmitted === 'function') {
            Logger.debug('Calling window.onScoreSubmitted()');
            window.onScoreSubmitted();
        }
    };
    
    newSubmitBtn.addEventListener('click', handleSubmit);
    Logger.debug('Submit button click handler attached');
    
    newInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    });
    Logger.debug('Enter key handler attached to input');
    
    Logger.debug('=== promptForName END ===');
}

// Keyboard navigation for leaderboards
document.addEventListener('keydown', (e) => {
    const leaderboardContent = document.getElementById('leaderboardContent');
    const leaderboardVisible = leaderboardContent && leaderboardContent.style.display !== 'none';
    const modeMenu = document.getElementById('modeMenu');
    const menuVisible = modeMenu && !modeMenu.classList.contains('hidden');
    
    // Don't handle if leaderboard not visible, game running, or menu is showing
    if (!leaderboardVisible || window.gameRunning || menuVisible) return;
    
    const modes = ['drizzle', 'downpour', 'hailstorm', 'blizzard', 'hurricane'];
    const currentIndex = modes.indexOf(currentLeaderboardMode);
    
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = (currentIndex - 1 + modes.length) % modes.length;
        displayLeaderboard(modes[newIndex], lastPlayerScore, currentLeaderboardGameMode);
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = (currentIndex + 1) % modes.length;
        displayLeaderboard(modes[newIndex], lastPlayerScore, currentLeaderboardGameMode);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation(); // Prevent game.js handler from also processing this
        // Go to menu instead of starting game directly
        const playAgainBtn = document.getElementById('playAgainBtn');
        if (playAgainBtn) {
            playAgainBtn.click();
        }
    }
});

// Check if user is logged in
async function checkAuth() {
    try {
        const response = await apiFetch(`${API_URL}/auth/me`, {
            credentials: 'include'
        });
        if (response.ok) {
            currentUser = await response.json();
            isAnonymous = false;
            Logger.info('User logged in:', currentUser.username);
        } else {
            isAnonymous = true;
        }
    } catch (error) {
        Logger.info('Not logged in or API unavailable');
        isAnonymous = true;
    }
}

/**
 * Submits a game score to the backend server. Scores below the minimum
 * leaderboard threshold are silently ignored.
 * @async
 * @param {Object} gameData - The game data to submit.
 * @param {number} gameData.score - The player's final score.
 * @param {number} gameData.lines - Total lines cleared.
 * @param {number} gameData.level - Final level reached.
 * @param {number} [gameData.strikes] - Number of lightning strike events.
 * @param {number} [gameData.tsunamis] - Number of tsunami events.
 * @param {number} [gameData.volcanoes] - Number of volcano events.
 * @param {number} [gameData.blackholes] - Number of black hole events.
 * @param {number} [gameData.supermassiveBlackHoles] - Number of supermassive black hole events.
 * @param {number} [gameData.superVolcanoes] - Number of super volcano events.
 * @param {number} [gameData.duration] - Game duration in seconds.
 * @returns {Promise<Object|false|undefined>} The server response object on success, false if below minimum score, or undefined on error.
 */
async function submitScore(gameData) {
    // Don't save scores that display as ₿0.0000
    if (gameData.score < MIN_LEADERBOARD_SCORE) {
        Logger.debug(`Score ${gameData.score || 'unknown'} below minimum, not saving`);
        return false;
    }
    
    // Skip email notifications when ?track=false
    const suppressEmail = new URLSearchParams(window.location.search).get('track') === 'false';
    
    const scoreData = {
        game_name: 'tantris',
        difficulty: window.gameMode || 'downpour',
        mode: 'normal',
        score: gameData.score,
        lines: gameData.lines,
        level: gameData.level,
        strikes: gameData.strikes || 0,
        tsunamis: gameData.tsunamis || 0,
        volcanoes: gameData.volcanoes || 0,
        blackholes: gameData.blackholes || 0,
        supermassive_blackholes: gameData.supermassiveBlackHoles || 0,
        super_volcanoes: gameData.superVolcanoes || 0,
        duration_seconds: Math.floor(gameData.duration || 0),
        skipNotification: suppressEmail
    };
    
    try {
        const response = await apiFetch(`${API_URL}/scores/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(scoreData)
        });
        
        if (response.ok) {
            const result = await response.json();
            Logger.info('Score submitted:', result);
            
            if (isAnonymous && result.message && result.message.includes('register')) {
                Logger.info('Anonymous score saved. Register to claim it!');
            }
            
            return result;
        } else {
            Logger.error('Failed to submit score:', response.status);
        }
    } catch (error) {
        Logger.error('Error submitting score:', error);
    }
}

/**
 * Fetches leaderboard data for a given difficulty and mode.
 * @deprecated Use {@link fetchLeaderboard} instead, which supports the skillLevel parameter.
 * @async
 * @param {string} [difficulty='downpour'] - The difficulty level to fetch.
 * @param {string} [mode='normal'] - The game mode to fetch.
 * @returns {Promise<Array<Object>>} An array of leaderboard entry objects.
 */
async function getLeaderboard(difficulty = 'downpour', mode = 'normal') {
    return fetchLeaderboard(difficulty, mode, 'tempest');
}

/**
 * Escapes HTML special characters in a string to prevent XSS attacks.
 * Uses the browser's built-in DOM text encoding via a temporary div element.
 * @param {string} text - The raw text string to escape.
 * @returns {string} The HTML-escaped string safe for insertion into the DOM.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Formats a numeric score as a Bitcoin-style currency string.
 * Divides the score by 10,000,000 and prefixes with the Bitcoin symbol.
 * @param {number} points - The raw score in points (e.g., 10000000 becomes "₿1.0000").
 * @returns {string} The formatted string (e.g., "₿1.0000").
 */
function formatAsBitcoin(points) {
    const btc = points / 10000000;
    return '₿' + btc.toFixed(4);
}

// Initialize auth check on load
checkAuth();

// Challenge tooltip handler - ensure DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const challengeTooltip = document.createElement('div');
    challengeTooltip.id = 'challengeTooltip';
    challengeTooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.95);
        color: #FFD700;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: bold;
        white-space: nowrap;
        z-index: 100000;
        border: 2px solid #FFD700;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        pointer-events: none;
        display: none;
    `;
    document.body.appendChild(challengeTooltip);

    let currentRow = null;

    document.addEventListener('mousemove', (e) => {
        const row = e.target.closest('tr.has-tooltip');
        const isOverReplayBtn = e.target.closest('.replay-btn');
        
        if (row && !isOverReplayBtn) {
            if (row !== currentRow) {
                currentRow = row;
                const challengeData = row.getAttribute('data-challenges');
                const speedBonus = row.getAttribute('data-speed-bonus') || '1.00';
                
                // Build tooltip text
                let tooltipText = '';
                if (challengeData && challengeData.trim() !== '') {
                    tooltipText = `${challengeData} | Speed: ${speedBonus}x`;
                } else {
                    tooltipText = `Speed: ${speedBonus}x`;
                }
                
                challengeTooltip.textContent = tooltipText;
                challengeTooltip.style.display = 'block';
            }
            // Update position
            challengeTooltip.style.left = (e.clientX + 15) + 'px';
            challengeTooltip.style.top = (e.clientY + 15) + 'px';
        } else {
            if (currentRow) {
                currentRow = null;
                challengeTooltip.style.display = 'none';
            }
        }
    });
});

/**
 * Sends a game completion notification to the server for games that did not
 * achieve a high score. Uses the same submit endpoint with a `notifyOnly` flag
 * so the backend sends an email notification without creating a leaderboard entry.
 * Fails silently since notifications are non-critical.
 * @async
 * @param {Object} scoreData - The game score data object.
 * @param {number} scoreData.score - The player's final score.
 * @param {string} scoreData.difficulty - The difficulty level played.
 * @param {string} scoreData.mode - The game mode.
 * @param {number} scoreData.lines - Total lines cleared.
 * @param {number} scoreData.level - Final level reached.
 * @param {Array<string>} [scoreData.challenges] - List of active challenge IDs.
 * @returns {Promise<boolean>} True if the notification was sent successfully, false otherwise.
 */
async function notifyGameCompletion(scoreData) {
    // Don't notify for scores that display as ₿0.0000
    if (scoreData.score < MIN_LEADERBOARD_SCORE) {
        Logger.debug(`Score ${scoreData.score} below minimum, skipping notification`);
        return false;
    }
    
    try {
        // Add human-readable challenge names for the email
        const challengeNames = scoreData.challenges && scoreData.challenges.length > 0
            ? scoreData.challenges.map(c => getChallengeDisplayName(c)).join(', ')
            : null;
        
        const dataToSubmit = {
            ...scoreData,
            username: localStorage.getItem('tantris_username') || 'Anonymous',
            challengeNames: challengeNames,
            notifyOnly: true,  // Flag to indicate this is just a notification, not a leaderboard entry
            skipNotification: new URLSearchParams(window.location.search).get('track') === 'false',
            language: typeof I18n !== 'undefined' ? I18n.getBrowserLanguage() : navigator.language || 'en',
            deviceType: typeof DeviceDetection !== 'undefined' ? (DeviceDetection.isMobile ? 'phone' : DeviceDetection.isTablet ? 'tablet' : 'desktop') : 'unknown',
            os: typeof detectOS === 'function' ? detectOS() : 'unknown'
        };
        
        // Use the same submit endpoint - backend will check notifyOnly flag
        const response = await apiFetch(`${API_URL}/scores/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSubmit),
            timeout: 10000
        });

        if (response.ok) {
            Logger.info('Game completion notification sent');
            return true;
        } else {
            Logger.info('Game notification endpoint returned:', response.status);
            return false;
        }
    } catch (error) {
        // Silently fail - this is just a notification, not critical
        Logger.info('Game completion notification failed (non-critical):', error.message);
        return false;
    }
}

/**
 * Submits an AI player's score automatically without showing a name entry popup.
 * The username is always set to the robot emoji Claude name. Scores below the
 * minimum leaderboard threshold are silently ignored.
 * @async
 * @param {Object} scoreData - The AI game score data object.
 * @param {number} scoreData.score - The AI player's final score.
 * @param {string} scoreData.difficulty - The difficulty level played.
 * @param {string} scoreData.mode - The game mode (e.g., 'ai', 'ai-challenge').
 * @param {number} scoreData.lines - Total lines cleared.
 * @param {number} scoreData.level - Final level reached.
 * @param {boolean} [scoreData.skipNotification] - Whether to suppress email notifications.
 * @returns {Promise<boolean>} True if the score was submitted successfully, false otherwise.
 */
async function submitAIScore(scoreData) {
    Logger.debug('=== submitAIScore START ===');
    
    // Don't save scores that display as ₿0.0000
    if (scoreData.score < MIN_LEADERBOARD_SCORE) {
        Logger.debug(`AI score ${scoreData.score} below minimum, not saving`);
        return false;
    }
    
    const dataToSubmit = {
        ...scoreData,
        username: '🤖 Claude',
        skipNotification: scoreData.skipNotification || new URLSearchParams(window.location.search).get('track') === 'false', // Pass through notification flag
        language: typeof I18n !== 'undefined' ? I18n.getBrowserLanguage() : navigator.language || 'en',
        deviceType: typeof DeviceDetection !== 'undefined' ? (DeviceDetection.isMobile ? 'phone' : DeviceDetection.isTablet ? 'tablet' : 'desktop') : 'unknown',
        os: typeof detectOS === 'function' ? detectOS() : 'unknown'
        // mode is already set in scoreData ('ai' or 'ai-challenge')
    };
    
    try {
        const response = await apiFetch(`${API_URL}/scores/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSubmit),
            timeout: 15000
        });

        if (response.ok) {
            const result = await response.json();
            Logger.info('AI score submitted successfully:', result);
            return true;
        } else {
            Logger.error('AI score submission failed:', response.status);
            return false;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            Logger.error('AI score submission timed out');
        } else {
            Logger.error('Error submitting AI score:', error);
        }
        return false;
    }
}

/**
 * Clears the stored last player score used for leaderboard highlighting.
 * Should be called when starting a new game to prevent stale score highlights.
 * @returns {void}
 */
function clearLastPlayerScore() {
    lastPlayerScore = null;
}

// Public API
return {
    displayLeaderboard,
    hideLeaderboard,
    checkIfTopTen,
    promptForName,
    submitScore,
    submitAIScore,
    getLeaderboard,
    fetchLeaderboard,
    getModeDisplayName,
    notifyGameCompletion,
    clearLastPlayerScore
};

})(); // end leaderboard IIFE