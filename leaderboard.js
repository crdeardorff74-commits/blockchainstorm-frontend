// ===== LEADERBOARD MODULE =====
// All leaderboard-related functionality

// API Configuration
const API_URL = 'https://blockchainstorm.onrender.com/api';

// State
let currentLeaderboardMode = null;
let currentLeaderboardGameMode = 'normal'; // Track if viewing normal or challenge leaderboard
let lastPlayerScore = null;
let lastScoreData = null;
let currentUser = null;
let isAnonymous = true;

// Profanity filter using regex
function censorProfanity(text) {
    // Common profanity patterns (case-insensitive)
    const profanityPatterns = [
        /\bf+u+c+k+\w*/gi,
        /\bs+h+i+t+\w*/gi,
        /\ba+s+s+(?:hole|hat|wipe)?\b/gi,
        /\bb+i+t+c+h+\w*/gi,
        /\bc+u+n+t+\w*/gi,
        /\bd+a+m+n+\w*/gi,
        /\bd+i+c+k+\w*/gi,
        /\bp+i+s+s+\w*/gi,
        /\bc+o+c+k+\w*/gi,
        /\bw+h+o+r+e+\w*/gi,
        /\bs+l+u+t+\w*/gi,
        /\bf+a+g+(?:got)?\w*/gi,
        /\bn+i+g+g+\w*/gi,
        /\br+e+t+a+r+d+\w*/gi,
        /\bt+w+a+t+\w*/gi,
        /\bp+u+s+s+y+\w*/gi,
        /\bb+a+s+t+a+r+d+\w*/gi,
        // Leetspeak variations
        /\bf[u\*@0]+[c\(k]+/gi,
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
        duration: 300
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
async function fetchLeaderboard(difficulty, mode = 'normal') {
    try {
        console.log(`Fetching leaderboard for ${difficulty} (${mode}) from ${API_URL}/leaderboard/blockchainstorm/${difficulty}/${mode}`);
        
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
        
        const response = await fetch(`${API_URL}/leaderboard/blockchainstorm/${difficulty}/${mode}`, {
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
        return getLocalLeaderboard(difficulty, mode);
    }
}

// Local storage fallback for leaderboard
function getLocalLeaderboard(difficulty, mode = 'normal') {
    const key = `blockchainstorm_leaderboard_${difficulty}_${mode}`;
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
function saveLocalLeaderboard(difficulty, scores, mode = 'normal') {
    const key = `blockchainstorm_leaderboard_${difficulty}_${mode}`;
    try {
        const topScores = scores.slice(0, 20);
        localStorage.setItem(key, JSON.stringify(topScores));
    } catch (e) {
        console.error('Error saving local leaderboard:', e);
    }
}

// Display leaderboard in the left panel
async function displayLeaderboard(difficulty, playerScore = null, mode = 'normal') {
    const rulesPanel = document.querySelector('.rules-panel');
    const rulesInstructions = rulesPanel.querySelector('.rules-instructions');
    const histogramCanvas = document.getElementById('histogramCanvas');
    
    currentLeaderboardMode = difficulty;
    currentLeaderboardGameMode = mode; // Track current game mode (normal/challenge)
    
    // Hide instructions and histogram
    if (rulesInstructions) rulesInstructions.style.display = 'none';
    if (histogramCanvas) histogramCanvas.style.display = 'none';
    
    // Get or create leaderboard content div inside rules-panel
    let leaderboardContent = document.getElementById('leaderboardContent');
    if (!leaderboardContent) {
        leaderboardContent = document.createElement('div');
        leaderboardContent.id = 'leaderboardContent';
        rulesPanel.appendChild(leaderboardContent);
    }
    
    leaderboardContent.style.display = 'block';
    
    const modeLabel = mode === 'challenge' ? ' (Challenge)' : '';
    
    leaderboardContent.innerHTML = `
        <div class="leaderboard-loading">
            Loading ${difficulty}${modeLabel} leaderboard...
        </div>
    `;
    
    const scores = await fetchLeaderboard(difficulty, mode);
    
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
            <div class="leaderboard-title">${getModeDisplayName(difficulty)} Leaderboard${modeLabel}</div>
            <div class="leaderboard-loading">No scores yet. Be the first!</div>
        `;
        return;
    }
    
    let html = `
        <div class="leaderboard-title">${getModeDisplayName(difficulty)} Leaderboard${modeLabel}</div>
        <div class="leaderboard-mode-selector">
            Use <strong>↑↓</strong> arrows to browse difficulties
            <br>
            Press <strong>Enter</strong> to play again
        </div>
        <table class="leaderboard-table">
            <thead>
                <tr>
                    <th class="rank">#</th>
                    <th class="name">Name</th>
                    <th class="score">Score</th>
                    <th>Lines</th>
                    <th>Level</th>
                    ${mode === 'challenge' ? '<th class="challenges-col">🎯</th>' : ''}
                </tr>
            </thead>
            <tbody>
    `;
    
    scores.forEach((entry, index) => {
        const isPlayerScore = playerScore && Math.abs(entry.score - playerScore) < 100;
        const rowClass = isPlayerScore ? 'player-score' : '';
        
        let events = [];
        if (entry.strikes > 0) events.push(`⚡${entry.strikes}`);
        if (entry.tsunamis > 0) events.push(`🌊${entry.tsunamis}`);
        if (entry.blackholes > 0) events.push(`🕳️${entry.blackholes}`);
        const eventsStr = events.length > 0 ? `<br><span class="special-events">${events.join(' ')}</span>` : '';
        
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
        
        const rowClasses = [rowClass, hasChallenge ? 'has-challenges' : ''].filter(c => c).join(' ');
        
        html += `
            <tr class="${rowClasses}">
                <td class="rank">${index + 1}</td>
                <td class="name">${escapeHtml(entry.username)}${eventsStr}</td>
                <td class="score">₿${(entry.score / 10000000).toFixed(4)}</td>
                <td>${entry.lines}</td>
                <td>${entry.level}</td>
                ${challengesCell}
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    leaderboardContent.innerHTML = html;
}

// Hide leaderboard and show rules again
function hideLeaderboard() {
    const leaderboardContent = document.getElementById('leaderboardContent');
    const rulesInstructions = document.querySelector('.rules-instructions');
    
    if (leaderboardContent) {
        leaderboardContent.style.display = 'none';
    }
    
    if (rulesInstructions) {
        rulesInstructions.style.display = 'block';
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
        'phantom': 'Phantom Zone',
        'gremlins': 'Gremlins',
        'rubber': 'Rubber Blocks',
        'oz': 'Land of Oz',
        'lattice': 'Lattice',
        'yesand': 'Yes, And...',
        'sixseven': '6s and 7s',
        'longago': 'Long Ago',
        'comingsoon': 'Coming Soon',
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
async function checkIfTopTen(difficulty, score, mode = 'normal') {
    console.log(`Checking if score ${score} makes top 20 for ${difficulty} (${mode})`);
    
    // Don't allow 0 scores on the leaderboard
    if (score <= 0) {
        console.log('Score is 0 or negative, not eligible for leaderboard');
        return false;
    }
    
    const scores = await fetchLeaderboard(difficulty, mode);
    
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
    
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    // Pre-fill with saved username if available
    const savedUsername = localStorage.getItem('blockchainstorm_username');
    newInput.value = savedUsername || '';
    
    // Focus after a slight delay to ensure visibility
    setTimeout(() => {
        newInput.focus();
        // If there's a saved name, select it so user can easily change it
        if (savedUsername) {
            newInput.select();
        }
        console.log('Input focused');
    }, 150);
    
    console.log('Input setup complete, saved username:', savedUsername);
    
    // Guard against double submission
    let isSubmitting = false;
    
    // Add submit handler
    const handleSubmit = async () => {
        console.log('=== handleSubmit START ===');
        
        // Prevent double submission
        if (isSubmitting) {
            console.log('Already submitting, ignoring duplicate');
            return;
        }
        isSubmitting = true;
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
        
        // Hide overlay immediately - don't leave user waiting
        overlay.style.display = 'none';
        console.log('Overlay hidden');
        
        // Don't save 0 scores
        if (scoreData.score <= 0) {
            console.log('Score is 0, not saving to leaderboard');
            const gameOverDiv = document.getElementById('gameOver');
            if (gameOverDiv) {
                gameOverDiv.style.display = 'block';
            }
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
                blackholes: scoreData.blackholes || 0,
                challenges: scoreData.challenges || [],
                played_at: new Date().toISOString()
            };
            
            const updatedScores = [...localScores, newEntry]
                .sort((a, b) => b.score - a.score)
                .slice(0, 20);
            
            saveLocalLeaderboard(scoreData.difficulty, updatedScores, scoreData.mode);
            console.log('Score saved to local leaderboard');
            
            // Try to submit to server with retries
            const submitToServer = async (retryCount = 0, maxRetries = 5) => {
                const dataToSubmit = {
                    ...scoreData,
                    username: username
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
            await displayLeaderboard(scoreData.difficulty, scoreData.score, scoreData.mode);
            
        } catch (error) {
            console.error('Error during score submission:', error);
        }
        
        // Always show the game-over div so user can click Play Again
        const gameOverDiv = document.getElementById('gameOver');
        if (gameOverDiv) {
            gameOverDiv.style.display = 'block';
        }
        console.log('=== handleSubmit END ===');
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
    const scoreData = {
        game_name: 'blockchainstorm',
        difficulty: window.gameMode || 'downpour',
        mode: 'normal',
        score: gameData.score,
        lines: gameData.lines,
        level: gameData.level,
        strikes: gameData.strikes || 0,
        tsunamis: gameData.tsunamis || 0,
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

// Fetch leaderboard
async function getLeaderboard(difficulty = 'downpour', mode = 'normal') {
    try {
        const response = await fetch(
            `${API_URL}/leaderboard/blockchainstorm/${difficulty}/${mode}`
        );
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
    }
    return [];
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
        const row = e.target.closest('tr.has-challenges');
        
        if (row) {
            if (row !== currentRow) {
                currentRow = row;
                const challengeCell = row.querySelector('[data-challenges]');
                if (challengeCell) {
                    const challengeData = challengeCell.getAttribute('data-challenges');
                    if (challengeData) {
                        challengeTooltip.textContent = challengeData;
                        challengeTooltip.style.display = 'block';
                    }
                }
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

// Export functions for use in game.js
window.leaderboard = {
    displayLeaderboard,
    hideLeaderboard,
    checkIfTopTen,
    promptForName,
    submitScore,
    getLeaderboard,
    fetchLeaderboard,
    getModeDisplayName
};
