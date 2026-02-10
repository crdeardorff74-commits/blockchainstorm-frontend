// ===== LEADERBOARD MODULE =====
// All leaderboard-related functionality

// API Configuration
const API_URL = 'https://blockchainstorm.onrender.com/api';

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
    console.log('Testing high score system with score:', testScore);
    const scoreData = {
        game: 'blockchainstorm',
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
    console.log('Is this score in the top 20?', isTopTen);
    
    if (isTopTen) {
        console.log('Score makes top 20! Showing name entry prompt...');
        promptForName(scoreData);
    } else {
        console.log('Score does not make top 20. Showing leaderboard only...');
        await displayLeaderboard('drizzle', testScore);
    }
};

// Fetch leaderboard for a specific difficulty and mode
async function fetchLeaderboard(difficulty, mode = 'normal', skillLevel = 'tempest') {
    try {
        console.log(`Fetching leaderboard for ${difficulty} (${mode}) skill:${skillLevel} from ${API_URL}/leaderboard/blockchainstorm/${difficulty}/${mode}?skill_level=${skillLevel}`);
        
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
        
        const response = await fetch(`${API_URL}/leaderboard/blockchainstorm/${difficulty}/${mode}?skill_level=${skillLevel}`, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-store', // Don't use cached responses
            headers: {
                'Accept': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        console.log('Leaderboard data received:', data);
        return data.leaderboard || [];
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('Leaderboard fetch timed out, using local storage fallback');
        } else {
            console.error('Error fetching leaderboard, using local storage fallback:', error);
        }
        return getLocalLeaderboard(difficulty, mode, skillLevel);
    }
}

// Local storage fallback for leaderboard
function getLocalLeaderboard(difficulty, mode = 'normal', skillLevel = 'tempest') {
    const key = `blockchainstorm_leaderboard_${difficulty}_${mode}_${skillLevel}`;
    const stored = localStorage.getItem(key);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Error parsing local leaderboard:', e);
            return [];
        }
    }
    return [];
}

// Save to local leaderboard
function saveLocalLeaderboard(difficulty, scores, mode = 'normal', skillLevel = 'tempest') {
    const key = `blockchainstorm_leaderboard_${difficulty}_${mode}_${skillLevel}`;
    try {
        const topScores = scores.slice(0, 20);
        localStorage.setItem(key, JSON.stringify(topScores));
    } catch (e) {
        console.error('Error saving local leaderboard:', e);
    }
}

// Display leaderboard in the left panel
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
    
    // Update the panel title to show leaderboard info and hide skill label
    const panelTitle = document.getElementById('rulesPanelTitle');
    const skillLevelLabel = document.getElementById('skillLevelLabel');
    if (panelTitle) {
        panelTitle.textContent = getModeDisplayName(difficulty);
        panelTitle.style.display = 'block';
    }
    if (skillLevelLabel) {
        skillLevelLabel.style.display = 'none';
    }
    
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
                    ${mode === 'challenge' ? '<th class="challenges-col">🎯</th>' : ''}
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
            console.log(`🎯 Highlighting score at rank ${index + 1}: ${entryScore}`);
        }
        const rowClass = isPlayerScore ? 'player-score' : '';
        
        let events = [];
        if (entry.strikes > 0) events.push(`⚡${entry.strikes}`);
        if (entry.tsunamis > 0) events.push(`🌊${entry.tsunamis}`);
        if (entry.volcanoes > 0) events.push(`🌋${entry.volcanoes}`);
        if (entry.blackholes > 0) events.push(`🕳️${entry.blackholes}`);
        
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
        if (mode === 'challenge') {
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
        const replayCell = entry.recording_id 
            ? `<td class="replay-col"><span class="replay-btn" data-recording-id="${entry.recording_id}" title="Watch replay">▶️</span></td>`
            : '<td class="replay-col"><span class="replay-btn no-recording" title="No recording available">▶️</span></td>';
        
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

// Fetch recording and start replay
async function startReplay(recordingId) {
    try {
        console.log(`🎬 Fetching recording ${recordingId}...`);
        
        const response = await fetch(`${API_URL}/recording/${recordingId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch recording: ${response.status}`);
        }
        
        const recording = await response.json();
        console.log('🎬 Recording loaded:', recording.username, recording.score, 'pts');
        
        // Call the game's replay function if available
        if (typeof window.startGameReplay === 'function') {
            window.startGameReplay(recording);
        } else {
            console.error('🎬 Replay function not available');
            alert('Replay feature not yet available');
        }
        
    } catch (error) {
        console.error('🎬 Failed to load recording:', error);
        alert('Failed to load recording');
    }
}

// Hide leaderboard and show rules again
function hideLeaderboard() {
    const leaderboardContent = document.getElementById('leaderboardContent');
    const rulesInstructions = document.querySelector('.rules-instructions');
    const viewSelect = document.getElementById('rulesPanelViewSelect');
    const panelTitle = document.getElementById('rulesPanelTitle');
    const skillLevelLabel = document.getElementById('skillLevelLabel');
    
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
    
    // Hide the title and show skill label
    if (panelTitle) {
        panelTitle.style.display = 'none';
    }
    if (skillLevelLabel) {
        skillLevelLabel.style.display = 'inline';
    }
    
    currentLeaderboardMode = null;
}

// Get display name for a mode
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
        'sorandom': 'So Random',
        'combo': 'Combo'
    };
    return names[challenge] || challenge;
}

// Check if score makes top 20
async function checkIfTopTen(difficulty, score, mode = 'normal', skillLevel = 'tempest') {
    console.log(`Checking if score ${score} makes top 20 for ${difficulty} (${mode}) skill:${skillLevel}`);
    
    // Don't allow scores that display as ₿0.0000 on the leaderboard
    if (score < MIN_LEADERBOARD_SCORE) {
        console.log(`Score ${score} is below minimum ${MIN_LEADERBOARD_SCORE}, not eligible for leaderboard`);
        return false;
    }
    
    const scores = await fetchLeaderboard(difficulty, mode, skillLevel);
    
    if (!Array.isArray(scores)) {
        console.log('Scores is not an array:', scores);
        return true;
    }
    
    if (scores.length < 20) {
        console.log(`Only ${scores.length} scores, automatically top 20`);
        return true;
    }
    
    const lowestTopTen = scores[19].score;
    const result = score > lowestTopTen;
    console.log(`Lowest top 20 score: ${lowestTopTen}, player score: ${score}, makes top 20: ${result}`);
    return result;
}

// Prompt for player name when they get a high score
function promptForName(scoreData) {
    console.log('=== promptForName START ===');
    console.log('Score:', scoreData.score);
    console.log('Difficulty:', scoreData.difficulty);
    
    // Get elements
    const overlay = document.getElementById('nameEntryOverlay');
    const input = document.getElementById('nameEntryInput');
    const scoreDisplay = document.getElementById('nameEntryScore');
    const submitBtn = document.getElementById('nameEntrySubmit');
    
    console.log('Element lookup results:', {
        overlay: !!overlay,
        input: !!input,
        scoreDisplay: !!scoreDisplay,
        submitBtn: !!submitBtn
    });
    
    if (!overlay) {
        console.error('❌ CRITICAL: nameEntryOverlay element not found!');
        console.log('Checking DOM for all elements with IDs...');
        const allIds = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
        console.log('All IDs in document:', allIds);
        return;
    }
    
    if (!input || !scoreDisplay || !submitBtn) {
        console.error('❌ Missing required elements inside overlay!', {
            input: !!input,
            scoreDisplay: !!scoreDisplay,
            submitBtn: !!submitBtn
        });
        return;
    }
    
    console.log('✅ All required elements found');
    
    // Store score data for later submission
    lastScoreData = scoreData;
    
    // Display the score
    scoreDisplay.textContent = formatAsBitcoin(scoreData.score);
    console.log('Score display updated to:', scoreDisplay.textContent);
    
    // CRITICAL: Hide the game over div FIRST to prevent overlap
    const gameOverDiv = document.getElementById('gameOver');
    if (gameOverDiv) {
        gameOverDiv.style.display = 'none';
        console.log('Game over div hidden');
    }
    
    // Show overlay with maximum priority - FORCE ALL STYLES
    console.log('Setting overlay to display: flex');
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
        console.log('Overlay display style after timeout:', overlay.style.display);
        console.log('Overlay computed style after timeout:', window.getComputedStyle(overlay).display);
        console.log('Overlay visibility:', window.getComputedStyle(overlay).visibility);
        console.log('Overlay opacity:', window.getComputedStyle(overlay).opacity);
        console.log('Overlay z-index:', window.getComputedStyle(overlay).zIndex);
        if (overlay.style.display !== 'flex') {
            console.error('❌ WARNING: Overlay display changed unexpectedly! Forcing back to flex');
            overlay.style.setProperty('display', 'flex', 'important');
        }
    }, 100);
    
    console.log('Overlay display style is now:', overlay.style.display);
    console.log('Overlay computed style:', window.getComputedStyle(overlay).display);
    
    console.log('✅ Name entry overlay should now be visible');
    
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
    const savedUsername = localStorage.getItem('blockchainstorm_username');
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
            padding: 2px;
            box-sizing: border-box;
            z-index: 1000000;
            display: flex;
            flex-direction: column;
            gap: 0px;
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
            rowDiv.style.cssText = 'display:flex;justify-content:center;gap:2px;';
            
            // Add SHIFT key before Z row
            if (rowIndex === 3) {
                const shiftKey = document.createElement('button');
                shiftKey.textContent = '⇧';
                shiftKey.style.cssText = `
                    min-width: 40px;
                    height: 26px;
                    font-size: 16px;
                    border: none;
                    border-radius: 4px;
                    background: #555;
                    color: white;
                    cursor: pointer;
                    margin-right: 4px;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: rgba(255,215,0,0.3);
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
                    min-width: 24px;
                    height: 26px;
                    font-size: 14px;
                    font-weight: bold;
                    border: none;
                    border-radius: 4px;
                    background: #444;
                    color: white;
                    cursor: pointer;
                    flex: 1;
                    max-width: 32px;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: rgba(255,215,0,0.3);
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
                    min-width: 40px;
                    height: 26px;
                    font-size: 16px;
                    border: none;
                    border-radius: 4px;
                    background: #4CAF50;
                    color: white;
                    cursor: pointer;
                    margin-left: 4px;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: rgba(255,215,0,0.3);
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
                    min-width: 50px;
                    height: 26px;
                    font-size: 16px;
                    border: none;
                    border-radius: 4px;
                    background: #444;
                    color: white;
                    cursor: pointer;
                    margin-left: 4px;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: rgba(255,215,0,0.3);
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
                    min-width: 50px;
                    height: 26px;
                    font-size: 16px;
                    border: none;
                    border-radius: 4px;
                    background: #666;
                    color: white;
                    cursor: pointer;
                    margin-left: 4px;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: rgba(255,215,0,0.3);
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
            console.log('Input focused');
        }, 150);
    }
    
    console.log('Input setup complete, saved username:', savedUsername);
    
    // Add submit handler
    const handleSubmit = async () => {
        console.log('=== handleSubmit START ===');
        
        // Prevent double submission using module-level flag
        if (isSubmittingScore) {
            console.log('Already submitting, ignoring duplicate');
            return;
        }
        isSubmittingScore = true;
        newSubmitBtn.disabled = true;
        newSubmitBtn.textContent = 'Saving...';
        console.log('Button set to Saving...');
        
        const rawUsername = newInput.value.trim() || 'Anonymous';
        const username = censorProfanity(rawUsername);
        console.log('Submitting score with username:', username);
        
        // Save username for next time (save the raw input, not censored version)
        if (rawUsername !== 'Anonymous') {
            localStorage.setItem('blockchainstorm_username', rawUsername);
        }
        
        // Submit pending game recording with the entered username
        if (typeof window.submitPendingRecording === 'function') {
            window.submitPendingRecording(username);
        }
        
        // Hide overlay and keyboard immediately - don't leave user waiting
        overlay.style.display = 'none';
        const keyboard = document.getElementById('customKeyboard');
        if (keyboard) keyboard.style.display = 'none';
        console.log('Overlay hidden');
        
        // Don't save scores that display as ₿0.0000
        if (scoreData.score < MIN_LEADERBOARD_SCORE) {
            console.log(`Score ${scoreData.score} below minimum, not saving to leaderboard`);
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
            console.log('Got local scores:', localScores.length);
            
            const newEntry = {
                username: username,
                score: scoreData.score,
                lines: scoreData.lines,
                level: scoreData.level,
                strikes: scoreData.strikes || 0,
                tsunamis: scoreData.tsunamis || 0,
                volcanoes: scoreData.volcanoes || 0,
                blackholes: scoreData.blackholes || 0,
                challenges: scoreData.challenges || [],
                speedBonus: scoreData.speedBonus || 1.0,
                played_at: new Date().toISOString()
            };
            
            const updatedScores = [...localScores, newEntry]
                .sort((a, b) => b.score - a.score)
                .slice(0, 20);
            
            saveLocalLeaderboard(scoreData.difficulty, updatedScores, scoreData.mode);
            console.log('Score saved to local leaderboard');
            
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
                    language: typeof I18n !== 'undefined' ? I18n.getBrowserLanguage() : navigator.language || 'en',
                    deviceType: typeof DeviceDetection !== 'undefined' ? (DeviceDetection.isMobile ? 'phone' : DeviceDetection.isTablet ? 'tablet' : 'desktop') : 'unknown',
                    os: typeof detectOS === 'function' ? detectOS() : 'unknown'
                };
                
                try {
                    // Create abort controller for timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
                    
                    const response = await fetch(`${API_URL}/scores/submit`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(dataToSubmit),
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const result = await response.json();
                        console.log('Score submitted successfully to server:', result);
                        return true;
                    } else {
                        console.error('Server submission failed:', response.status);
                        throw new Error(`HTTP ${response.status}`);
                    }
                } catch (serverError) {
                    if (serverError.name === 'AbortError') {
                        console.error(`Server submission timed out (attempt ${retryCount + 1}/${maxRetries + 1})`);
                    } else {
                        console.error(`Error submitting score (attempt ${retryCount + 1}/${maxRetries + 1}):`, serverError.message);
                    }
                    
                    // Retry with exponential backoff
                    if (retryCount < maxRetries) {
                        const delay = Math.min(2000 * Math.pow(2, retryCount), 30000); // 2s, 4s, 8s, 16s, 30s
                        console.log(`Retrying in ${delay/1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return submitToServer(retryCount + 1, maxRetries);
                    } else {
                        console.error('All retry attempts failed. Score saved locally only.');
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
            
        } catch (error) {
            console.error('Error during score submission:', error);
        }
        
        // Always show the game-over div so user can click Play Again
        const gameOverDiv = document.getElementById('gameOver');
        if (gameOverDiv) {
            gameOverDiv.style.display = 'block';
        }
        
        // Reset submission flag for next game
        isSubmittingScore = false;
        console.log('=== handleSubmit END ===');
        
        // Notify game.js that score submission is complete (triggers credits animation)
        if (typeof window.onScoreSubmitted === 'function') {
            console.log('Calling window.onScoreSubmitted()');
            window.onScoreSubmitted();
        }
    };
    
    newSubmitBtn.addEventListener('click', handleSubmit);
    console.log('Submit button click handler attached');
    
    newInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    });
    console.log('Enter key handler attached to input');
    
    console.log('=== promptForName END ===');
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
        const response = await fetch(`${API_URL}/auth/me`, {
            credentials: 'include'
        });
        if (response.ok) {
            currentUser = await response.json();
            isAnonymous = false;
            console.log('User logged in:', currentUser.username);
        } else {
            isAnonymous = true;
        }
    } catch (error) {
        console.log('Not logged in or API unavailable');
        isAnonymous = true;
    }
}

// Submit score to backend
async function submitScore(gameData) {
    // Don't save scores that display as ₿0.0000
    if (gameData.score < MIN_LEADERBOARD_SCORE) {
        console.log(`Score ${gameData.score || 'unknown'} below minimum, not saving`);
        return false;
    }
    
    const scoreData = {
        game_name: 'blockchainstorm',
        difficulty: window.gameMode || 'downpour',
        mode: 'normal',
        score: gameData.score,
        lines: gameData.lines,
        level: gameData.level,
        strikes: gameData.strikes || 0,
        tsunamis: gameData.tsunamis || 0,
        volcanoes: gameData.volcanoes || 0,
        blackholes: gameData.blackholes || 0,
        duration_seconds: Math.floor(gameData.duration || 0)
    };
    
    try {
        const response = await fetch(`${API_URL}/scores/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(scoreData)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Score submitted:', result);
            
            if (isAnonymous && result.message && result.message.includes('register')) {
                console.log('Anonymous score saved. Register to claim it!');
            }
            
            return result;
        } else {
            console.error('Failed to submit score:', response.status);
        }
    } catch (error) {
        console.error('Error submitting score:', error);
    }
}

// Fetch leaderboard (deprecated - use fetchLeaderboard for full features)
// Kept for backwards compatibility
async function getLeaderboard(difficulty = 'downpour', mode = 'normal') {
    return fetchLeaderboard(difficulty, mode, 'tempest');
}

// HTML escape utility
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format score as Bitcoin
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

// Send game completion notification (for non-high-score games)
async function notifyGameCompletion(scoreData) {
    // Don't notify for scores that display as ₿0.0000
    if (scoreData.score < MIN_LEADERBOARD_SCORE) {
        console.log(`Score ${scoreData.score} below minimum, skipping notification`);
        return false;
    }
    
    try {
        // Add human-readable challenge names for the email
        const challengeNames = scoreData.challenges && scoreData.challenges.length > 0
            ? scoreData.challenges.map(c => getChallengeDisplayName(c)).join(', ')
            : null;
        
        const dataToSubmit = {
            ...scoreData,
            username: localStorage.getItem('blockchainstorm_username') || 'Anonymous',
            challengeNames: challengeNames,
            notifyOnly: true,  // Flag to indicate this is just a notification, not a leaderboard entry
            language: typeof I18n !== 'undefined' ? I18n.getBrowserLanguage() : navigator.language || 'en',
            deviceType: typeof DeviceDetection !== 'undefined' ? (DeviceDetection.isMobile ? 'phone' : DeviceDetection.isTablet ? 'tablet' : 'desktop') : 'unknown',
            os: typeof detectOS === 'function' ? detectOS() : 'unknown'
        };
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        // Use the same submit endpoint - backend will check notifyOnly flag
        const response = await fetch(`${API_URL}/scores/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSubmit),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            console.log('Game completion notification sent');
            return true;
        } else {
            console.log('Game notification endpoint returned:', response.status);
            return false;
        }
    } catch (error) {
        // Silently fail - this is just a notification, not critical
        console.log('Game completion notification failed (non-critical):', error.message);
        return false;
    }
}

// Submit AI score automatically (no popup)
async function submitAIScore(scoreData) {
    console.log('=== submitAIScore START ===');
    
    // Don't save scores that display as ₿0.0000
    if (scoreData.score < MIN_LEADERBOARD_SCORE) {
        console.log(`AI score ${scoreData.score} below minimum, not saving`);
        return false;
    }
    
    const dataToSubmit = {
        ...scoreData,
        username: '🤖 Claude',
        skipNotification: scoreData.skipNotification || false, // Pass through notification flag
        language: typeof I18n !== 'undefined' ? I18n.getBrowserLanguage() : navigator.language || 'en',
        deviceType: typeof DeviceDetection !== 'undefined' ? (DeviceDetection.isMobile ? 'phone' : DeviceDetection.isTablet ? 'tablet' : 'desktop') : 'unknown',
        os: typeof detectOS === 'function' ? detectOS() : 'unknown'
        // mode is already set in scoreData ('ai' or 'ai-challenge')
    };
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(`${API_URL}/scores/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSubmit),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const result = await response.json();
            console.log('AI score submitted successfully:', result);
            return true;
        } else {
            console.error('AI score submission failed:', response.status);
            return false;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('AI score submission timed out');
        } else {
            console.error('Error submitting AI score:', error);
        }
        return false;
    }
}

// Clear the last player score (call when starting a new game)
function clearLastPlayerScore() {
    lastPlayerScore = null;
}

// Export functions for use in game.js
window.leaderboard = {
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