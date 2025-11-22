// ===== API AND LEADERBOARD MODULE =====
// Handles all API communication, leaderboard display, and score submission

const API_URL = 'https://blockchainstorm.onrender.com/api';
let gameStartTime = 0;
let currentLeaderboardMode = null;
let lastPlayerScore = null;
let lastScoreData = null;

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
    
    // Hide rules panel
    if (rulesPanel) {
        rulesPanel.style.display = 'none';
    }
    
    // Hide histogram canvas if visible
    const histogramCanvas = document.getElementById('histogramCanvas');
    if (histogramCanvas) {
        histogramCanvas.style.display = 'none';
    }
    
    let leaderboardContainer = document.getElementById('leaderboardContainer');
    if (!leaderboardContainer) {
        leaderboardContainer = document.createElement('div');
        leaderboardContainer.id = 'leaderboardContainer';
        leaderboardContainer.className = 'rules-panel';
        leaderboardContainer.style.cssText = `
            background: rgba(30, 60, 120, 0.35);
            padding: 2vh 1.5vw;
            border-radius: 1vh;
            color: white;
            width: 22vw;
            min-width: 22vw;
            max-width: 22vw;
            height: 85vh;
            box-sizing: border-box;
            overflow-y: auto;
            font-size: 1.6vh;
            display: flex;
            flex-direction: column;
            position: relative;
            flex-shrink: 0;
        `;
        // Insert leaderboard into the game container at the correct position
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer && rulesPanel) {
            gameContainer.insertBefore(leaderboardContainer, rulesPanel);
        } else if (rulesPanel && rulesPanel.parentNode) {
            rulesPanel.parentNode.insertBefore(leaderboardContainer, rulesPanel);
        }
    }
    
    leaderboardContainer.style.display = 'flex';
    leaderboardContainer.innerHTML = '<div style="text-align: center; padding: 2vh;">Loading...</div>';
    
    try {
        const scores = await fetchLeaderboard(difficulty);
        
        const modeDisplay = getModeDisplayName(difficulty);
        let html = `
            <div style="font-size: 2.2vh; font-weight: bold; margin-bottom: 1.5vh; text-align: center;">
                🏆 ${modeDisplay} Top 10
            </div>
        `;
        
        if (scores.length === 0) {
            html += `
                <div style="text-align: center; padding: 2vh; color: rgba(255,255,255,0.6);">
                    No scores yet. Be the first!
                </div>
            `;
        } else {
            html += '<div style="flex: 1; overflow-y: auto;">';
            scores.forEach((score, index) => {
                const isPlayerScore = playerScore !== null && 
                                     Math.abs(score.score - playerScore) < 100 &&
                                     index < 10;
                
                const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                const highlightStyle = isPlayerScore ? 
                    'background: rgba(255, 215, 0, 0.2); border-left: 3px solid gold; padding-left: 0.5vw;' : '';
                
                const username = escapeHtml(score.username || score.player_name || 'Anonymous');
                const formattedScore = formatAsBitcoin(score.score);
                
                html += `
                    <div style="margin-bottom: 1vh; padding: 0.5vh; ${highlightStyle}">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: bold; min-width: 2.5vw;">${rankEmoji}</span>
                            <span style="flex: 1; margin: 0 0.5vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${username}</span>
                            <span style="font-weight: bold; color: #FFD700;">${formattedScore}</span>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        html += `
            <button onclick="hideLeaderboard()" style="
                margin-top: 1.5vh;
                padding: 1vh 2vw;
                font-size: 1.6vh;
                background: #4CAF50;
                color: white;
                border: none;
                border-radius: 0.5vh;
                cursor: pointer;
                width: 100%;
            ">
                ← Back to Menu
            </button>
        `;
        
        leaderboardContainer.innerHTML = html;
        
    } catch (error) {
        console.error('Error displaying leaderboard:', error);
        leaderboardContainer.innerHTML = `
            <div style="text-align: center; padding: 2vh; color: rgba(255,100,100,0.8);">
                Error loading leaderboard
            </div>
            <button onclick="hideLeaderboard()" style="
                margin-top: 1.5vh;
                padding: 1vh 2vw;
                background: #4CAF50;
                color: white;
                border: none;
                border-radius: 0.5vh;
                cursor: pointer;
                width: 100%;
            ">
                ← Back to Menu
            </button>
        `;
    }
}

// Hide leaderboard and show rules again
function hideLeaderboard() {
    const leaderboardContainer = document.getElementById('leaderboardContainer');
    if (leaderboardContainer) {
        leaderboardContainer.style.display = 'none';
    }
    
    // Check if game is running by looking for histogram canvas
    const histogramCanvas = document.getElementById('histogramCanvas');
    const rulesPanel = document.querySelector('.rules-panel');
    
    // If histogram exists and was being used (game was running), show histogram
    // Otherwise show rules panel
    if (histogramCanvas && histogramCanvas.dataset.wasVisible === 'true') {
        histogramCanvas.style.display = 'block';
        if (rulesPanel) {
            rulesPanel.style.display = 'none';
        }
    } else {
        // Game not running, show rules panel
        if (rulesPanel) {
            rulesPanel.style.display = 'flex';
        }
        if (histogramCanvas) {
            histogramCanvas.style.display = 'none';
        }
    }
    
    currentLeaderboardMode = null;
    lastPlayerScore = null;
}

// Get display name for mode
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

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Check if score makes top 10
async function checkIfTopTen(difficulty, score) {
    try {
        const leaderboard = await fetchLeaderboard(difficulty);
        console.log('Checking top 10 for difficulty:', difficulty, 'score:', score);
        console.log('Current leaderboard:', leaderboard);
        
        if (leaderboard.length < 10) {
            console.log('Leaderboard has less than 10 entries, score qualifies');
            return true;
        }
        
        const lowestTopScore = leaderboard[9]?.score || 0;
        console.log('Lowest top 10 score:', lowestTopScore);
        const qualifies = score > lowestTopScore;
        console.log('Score qualifies:', qualifies);
        return qualifies;
    } catch (error) {
        console.error('Error checking top 10:', error);
        return false;
    }
}

// Prompt for player name
function promptForName(scoreData) {
    const overlay = document.createElement('div');
    overlay.id = 'namePromptOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 2000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    
    const prompt = document.createElement('div');
    prompt.style.cssText = `
        background: rgba(30, 60, 120, 0.95);
        padding: 30px;
        border-radius: 15px;
        border: 3px solid #FFD700;
        color: white;
        min-width: 350px;
        box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
        text-align: center;
    `;
    
    const formattedScore = formatAsBitcoin(scoreData.score);
    
    prompt.innerHTML = `
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 20px; color: #FFD700;">
            🎉 High Score! 🎉
        </div>
        <div style="font-size: 20px; margin-bottom: 20px;">
            ${formattedScore}
        </div>
        <div style="margin-bottom: 20px;">
            You made the top 10!<br>Enter your name:
        </div>
        <input type="text" id="playerNameInput" maxlength="20" 
            style="
                width: 100%;
                padding: 10px;
                font-size: 18px;
                border: 2px solid #FFD700;
                border-radius: 5px;
                background: rgba(0, 0, 0, 0.3);
                color: white;
                text-align: center;
                box-sizing: border-box;
            "
            placeholder="Enter your name"
        />
        <button id="submitNameBtn" style="
            margin-top: 20px;
            padding: 12px 30px;
            font-size: 18px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            width: 100%;
        ">
            Submit Score
        </button>
        <button id="skipNameBtn" style="
            margin-top: 10px;
            padding: 8px 20px;
            font-size: 14px;
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.6);
            border: none;
            border-radius: 5px;
            cursor: pointer;
            width: 100%;
        ">
            Skip (submit as Anonymous)
        </button>
    `;
    
    overlay.appendChild(prompt);
    document.body.appendChild(overlay);
    
    const input = document.getElementById('playerNameInput');
    const submitBtn = document.getElementById('submitNameBtn');
    const skipBtn = document.getElementById('skipNameBtn');
    
    input.focus();
    
    const handleSubmit = async () => {
        const username = input.value.trim() || 'Anonymous';
        submitBtn.disabled = true;
        skipBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        
        await submitNamedScore(username, scoreData);
        
        document.body.removeChild(overlay);
    };
    
    submitBtn.addEventListener('click', handleSubmit);
    skipBtn.addEventListener('click', handleSubmit);
    
    // Add Enter key support for input field
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    });
}

// Submit score with player name
async function submitNamedScore(username, scoreData) {
    try {
        console.log('Submitting score with username:', username);
        console.log('Score data:', scoreData);
        
        const payload = {
            ...scoreData,
            username: username
        };
        
        console.log('Sending payload:', payload);
        
        const response = await fetch(`${API_URL}/scores/submit`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Score submitted successfully:', result);
        
        saveLocalLeaderboard(scoreData.difficulty, [{
            username: username,
            score: scoreData.score,
            ...scoreData
        }]);
        
        await displayLeaderboard(scoreData.difficulty, scoreData.score);
        
    } catch (error) {
        console.error('Error submitting score:', error);
        alert('Failed to submit score to server. Score saved locally.');
        
        const localScores = getLocalLeaderboard(scoreData.difficulty);
        localScores.push({
            username: username,
            score: scoreData.score,
            ...scoreData
        });
        localScores.sort((a, b) => b.score - a.score);
        saveLocalLeaderboard(scoreData.difficulty, localScores);
        
        await displayLeaderboard(scoreData.difficulty, scoreData.score);
    }
}

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            return data.user;
        }
    } catch (error) {
        console.log('Not authenticated');
    }
    return null;
}

// Submit score to API
async function submitScore(gameData) {
    try {
        const response = await fetch(`${API_URL}/scores/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(gameData)
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Score submitted successfully:', data);
            return data;
        } else {
            console.error('Failed to submit score:', response.status);
        }
    } catch (error) {
        console.error('Error submitting score:', error);
    }
    return null;
}

// Get leaderboard from API
async function getLeaderboard(difficulty = 'downpour', mode = 'normal') {
    try {
        const response = await fetch(
            `${API_URL}/leaderboard/blockchainstorm/${difficulty}/${mode}`
        );
        if (response.ok) {
            const data = await response.json();
            return data.leaderboard;
        }
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
    }
    return [];
}

// Export functions for use in other modules
window.GameAPI = {
    fetchLeaderboard,
    displayLeaderboard,
    hideLeaderboard,
    checkIfTopTen,
    promptForName,
    submitNamedScore,
    checkAuth,
    submitScore,
    getLeaderboard,
    setGameStartTime: (time) => { gameStartTime = time; },
    getGameStartTime: () => gameStartTime,
    getCurrentLeaderboardMode: () => currentLeaderboardMode,
    getLastPlayerScore: () => lastPlayerScore,
    setLastPlayerScore: (score) => { lastPlayerScore = score; },
    getLastScoreData: () => lastScoreData,
    setLastScoreData: (data) => { lastScoreData = data; },
    // Helper to track histogram visibility state
    markHistogramVisible: () => {
        const histogramCanvas = document.getElementById('histogramCanvas');
        if (histogramCanvas) {
            histogramCanvas.dataset.wasVisible = 'true';
        }
    },
    markHistogramHidden: () => {
        const histogramCanvas = document.getElementById('histogramCanvas');
        if (histogramCanvas) {
            histogramCanvas.dataset.wasVisible = 'false';
        }
    }
};
