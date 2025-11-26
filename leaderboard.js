// ===== LEADERBOARD MODULE =====
// All leaderboard-related functionality

// API Configuration
const API_URL = 'https://blockchainstorm.onrender.com/api';

// State
let currentLeaderboardMode = null;
let lastPlayerScore = null;
let lastScoreData = null;
let currentUser = null;
let isAnonymous = true;

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
    console.log('Is this score in the top 10?', isTopTen);
    
    if (isTopTen) {
        console.log('Score makes top 10! Showing name entry prompt...');
        promptForName(scoreData);
    } else {
        console.log('Score does not make top 10. Showing leaderboard only...');
        await displayLeaderboard('drizzle', testScore);
    }
};

// Fetch leaderboard for a specific difficulty
async function fetchLeaderboard(difficulty) {
    try {
        console.log(`Fetching leaderboard for ${difficulty} from ${API_URL}/leaderboard/blockchainstorm/${difficulty}/normal`);
        const response = await fetch(`${API_URL}/leaderboard/blockchainstorm/${difficulty}/normal`, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        console.log('Leaderboard data received:', data);
        return data.leaderboard || [];
    } catch (error) {
        console.error('Error fetching leaderboard, using local storage fallback:', error);
        return getLocalLeaderboard(difficulty);
    }
}

// Local storage fallback for leaderboard
function getLocalLeaderboard(difficulty) {
    const key = `blockchainstorm_leaderboard_${difficulty}`;
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
function saveLocalLeaderboard(difficulty, scores) {
    const key = `blockchainstorm_leaderboard_${difficulty}`;
    try {
        const topScores = scores.slice(0, 10);
        localStorage.setItem(key, JSON.stringify(topScores));
    } catch (e) {
        console.error('Error saving local leaderboard:', e);
    }
}

// Display leaderboard in the left panel
async function displayLeaderboard(difficulty, playerScore = null) {
    const rulesPanel = document.querySelector('.rules-panel');
    
    currentLeaderboardMode = difficulty;
    rulesPanel.style.display = 'none';
    
    let leaderboardContainer = document.getElementById('leaderboardDisplay');
    if (!leaderboardContainer) {
        leaderboardContainer = document.createElement('div');
        leaderboardContainer.id = 'leaderboardDisplay';
        leaderboardContainer.className = 'rules-panel';
        rulesPanel.parentNode.insertBefore(leaderboardContainer, rulesPanel);
    }
    
    leaderboardContainer.style.display = 'block';
    
    leaderboardContainer.innerHTML = `
        <div class="leaderboard-loading">
            Loading ${difficulty} leaderboard...
        </div>
    `;
    
    const scores = await fetchLeaderboard(difficulty);
    
    if (!scores) {
        leaderboardContainer.innerHTML = `
            <div class="leaderboard-error">
                Failed to load leaderboard.<br>
                Check your connection.
            </div>
        `;
        return;
    }
    
    if (scores.length === 0) {
        leaderboardContainer.innerHTML = `
            <div class="leaderboard-title">${getModeDisplayName(difficulty)} Leaderboard</div>
            <div class="leaderboard-loading">No scores yet. Be the first!</div>
        `;
        return;
    }
    
    let html = `
        <div class="leaderboard-title">${getModeDisplayName(difficulty)} Leaderboard</div>
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
        
        html += `
            <tr class="${rowClass}">
                <td class="rank">${index + 1}</td>
                <td class="name">${escapeHtml(entry.username)}${eventsStr}</td>
                <td class="score">₿${(entry.score / 10000000).toFixed(4)}</td>
                <td>${entry.lines}</td>
                <td>${entry.level}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    leaderboardContainer.innerHTML = html;
}

// Hide leaderboard and show rules again
function hideLeaderboard() {
    const leaderboardContainer = document.getElementById('leaderboardDisplay');
    const rulesPanel = document.querySelector('.rules-panel');
    
    if (leaderboardContainer) {
        leaderboardContainer.style.display = 'none';
    }
    
    if (rulesPanel) {
        rulesPanel.style.display = 'block';
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

// Check if score makes top 10
async function checkIfTopTen(difficulty, score) {
    console.log(`Checking if score ${score} makes top 10 for ${difficulty}`);
    const scores = await fetchLeaderboard(difficulty);
    
    if (!Array.isArray(scores)) {
        console.log('Scores is not an array:', scores);
        return true;
    }
    
    if (scores.length < 10) {
        console.log(`Only ${scores.length} scores, automatically top 10`);
        return true;
    }
    
    const lowestTopTen = scores[9].score;
    const result = score > lowestTopTen;
    console.log(`Lowest top 10 score: ${lowestTopTen}, player score: ${score}, makes top 10: ${result}`);
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
    
    // Clear any previous input
    input.value = '';
    
    // Focus after a slight delay to ensure visibility
    setTimeout(() => {
        input.focus();
        console.log('Input focused');
    }, 150);
    
    console.log('Input cleared and will be focused');
    
    // Remove any existing event listeners by cloning the button
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
    
    // Add submit handler
    const handleSubmit = async () => {
        const username = input.value.trim() || 'Anonymous';
        console.log('Submitting score with username:', username);
        
        // Hide the overlay
        overlay.style.display = 'none';
        
        // Save to local leaderboard
        const localScores = await fetchLeaderboard(scoreData.difficulty);
        
        const newEntry = {
            username: username,
            score: scoreData.score,
            lines: scoreData.lines,
            level: scoreData.level,
            strikes: scoreData.strikes || 0,
            tsunamis: scoreData.tsunamis || 0,
            blackholes: scoreData.blackholes || 0,
            played_at: new Date().toISOString()
        };
        
        const updatedScores = [...localScores, newEntry]
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
        
        saveLocalLeaderboard(scoreData.difficulty, updatedScores);
        console.log('Score saved to local leaderboard');
        
        // Try to submit to server
        try {
            const dataToSubmit = {
                ...scoreData,
                username: username
            };
            
            const response = await fetch(`${API_URL}/scores/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSubmit)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Score submitted successfully to server:', result);
            } else {
                console.error('Server submission failed (but saved locally):', response.status);
            }
        } catch (error) {
            console.error('Error submitting score to server (but saved locally):', error);
        }
        
        // Display leaderboard with player's score highlighted
        await displayLeaderboard(scoreData.difficulty, scoreData.score);
        
        // Show the game-over div so user can click Play Again
        const gameOverDiv = document.getElementById('gameOver');
        if (gameOverDiv) {
            gameOverDiv.style.display = 'block';
        }
    };
    
    newSubmitBtn.addEventListener('click', handleSubmit);
    console.log('Submit button click handler attached');
    
    input.addEventListener('keydown', (e) => {
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
    const leaderboardContainer = document.getElementById('leaderboardDisplay');
    const leaderboardVisible = leaderboardContainer && leaderboardContainer.style.display !== 'none';
    if (!leaderboardVisible || window.gameRunning) return;
    
    const modes = ['drizzle', 'downpour', 'hailstorm', 'blizzard', 'hurricane'];
    const currentIndex = modes.indexOf(currentLeaderboardMode);
    
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = (currentIndex - 1 + modes.length) % modes.length;
        displayLeaderboard(modes[newIndex], lastPlayerScore);
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = (currentIndex + 1) % modes.length;
        displayLeaderboard(modes[newIndex], lastPlayerScore);
    } else if (e.key === 'Enter') {
        e.preventDefault();
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
