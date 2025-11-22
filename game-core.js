// ===== BLOCKCHAINSTORM CORE GAME =====
// Main game logic - depends on modules being loaded first
// Required modules: config.js, game-state.js, audio.js, render-utils.js, 
//                   blob-detection.js, piece-manager.js, storm-effects.js

// Get canvas references
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
const histogramCanvas = document.getElementById('histogramCanvas');
const histogramCtx = histogramCanvas.getContext('2d');

// Disable image smoothing for crisp pixels
nextCtx.imageSmoothingEnabled = false;
nextCtx.webkitImageSmoothingEnabled = false;
nextCtx.mozImageSmoothingEnabled = false;
nextCtx.msImageSmoothingEnabled = false;

// DOM element references
const modeMenu = document.getElementById('modeMenu');
const modeButtons = document.querySelectorAll('.mode-button');
const gameOverDiv = document.getElementById('gameOver');
const playAgainBtn = document.getElementById('playAgainBtn');
const scoreDisplay = document.getElementById('score');
const linesDisplay = document.getElementById('lines');
const levelDisplay = document.getElementById('level');
const strikesDisplay = document.getElementById('strikes');
const tsunamisDisplay = document.getElementById('tsunamis');
const blackHolesDisplay = document.getElementById('blackholes');
const finalScoreDisplay = document.getElementById('finalScore');
const finalStatsDisplay = document.getElementById('finalStats');

// Initialize histogram
function initHistogram() {
    GameState.histogramBars = {};
    GameState.histogramTargets = {};
    GameState.histogramPauseFrames = {};
    GameState.currentColorSet.forEach(color => {
        GameState.histogramBars[color] = 0;
        GameState.histogramTargets[color] = 0;
        GameState.histogramPauseFrames[color] = 0;
    });
    GameState.histogramMaxScale = 10;
    
    GameState.scoreHistogramBar = 0;
    GameState.scoreHistogramTarget = 0;
    GameState.scoreHistogramMaxScale = 1000;
    GameState.scoreHistogramPauseFrames = 0;
    
    const rulesPanel = histogramCanvas.parentElement;
    histogramCanvas.width = rulesPanel.clientWidth - 40;
    histogramCanvas.height = rulesPanel.clientHeight - 40;
}

// Update canvas size
function updateCanvasSize() {
    const targetHeight = window.innerHeight * 0.80;
    GameState.BLOCK_SIZE = Math.floor(targetHeight / GameState.ROWS);
    
    canvas.width = GameState.COLS * GameState.BLOCK_SIZE;
    canvas.height = GameState.ROWS * GameState.BLOCK_SIZE;
    
    nextCanvas.width = GameState.BLOCK_SIZE * 5;
    nextCanvas.height = GameState.BLOCK_SIZE * 5;
    
    if (GameState.gameRunning || !GameState.currentPiece) {
        drawBoard();
        if (GameState.currentPiece && GameState.currentPiece.shape) {
            drawPiece(GameState.currentPiece);
        }
        if (GameState.nextPiece) {
            drawNextPiece();
        }
    }
}

window.addEventListener('resize', updateCanvasSize);

// Drawing functions
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    StormEffects.drawStormParticles(ctx, canvas, GameState);
    
    const blobs = BlobDetection.getAllBlobs();
    blobs.forEach(blob => {
        if (!blob || !blob.positions || blob.positions.length === 0) return;
        
        const minX = Math.min(...blob.positions.map(p => p[0]));
        const maxX = Math.max(...blob.positions.map(p => p[0]));
        const spansWidth = (minX === 0 && maxX === GameState.COLS - 1);
        
        RenderUtils.drawSolidShape(ctx, blob.positions, blob.color, GameState.BLOCK_SIZE, spansWidth, GameState.faceOpacity);
    });
}

function drawPiece(piece, context = ctx, offsetX = 0, offsetY = 0) {
    if (!piece || !piece.shape || piece.shape.length === 0) return;
    
    const positions = [];
    piece.shape.forEach((row, y) => {
        if (row) {
            row.forEach((value, x) => {
                if (value) {
                    positions.push([piece.x + x + offsetX, piece.y + y + offsetY]);
                }
            });
        }
    });
    RenderUtils.drawSolidShape(context, positions, piece.color, GameState.BLOCK_SIZE, false, GameState.faceOpacity);
}

function drawNextPiece() {
    const wasSmoothing = nextCtx.imageSmoothingEnabled;
    nextCtx.imageSmoothingEnabled = false;
    
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    nextCtx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (GameState.nextPiece && GameState.nextPiece.shape && GameState.nextPiece.shape.length > 0) {
        const pieceWidth = GameState.nextPiece.shape[0].length;
        const pieceHeight = GameState.nextPiece.shape.length;
        
        const canvasBlocksX = nextCanvas.width / GameState.BLOCK_SIZE;
        const canvasBlocksY = nextCanvas.height / GameState.BLOCK_SIZE;
        
        const offsetX = (canvasBlocksX - pieceWidth) / 2;
        const offsetY = (canvasBlocksY - pieceHeight) / 2;
        
        const positions = [];
        GameState.nextPiece.shape.forEach((row, y) => {
            if (row) {
                row.forEach((value, x) => {
                    if (value) {
                        positions.push([x + offsetX, y + offsetY]);
                    }
                });
            }
        });
        RenderUtils.drawSolidShape(nextCtx, positions, GameState.nextPiece.color, GameState.BLOCK_SIZE, false, GameState.faceOpacity);
    }
    
    nextCtx.imageSmoothingEnabled = wasSmoothing;
}

// Update stats display
function updateStats() {
    scoreDisplay.textContent = RenderUtils.formatAsBitcoin(GameState.score);
    linesDisplay.textContent = GameState.lines;
    levelDisplay.textContent = GameState.level;
    strikesDisplay.textContent = GameState.strikeCount;
    tsunamisDisplay.textContent = GameState.tsunamiCount;
    blackHolesDisplay.textContent = GameState.blackHoleCount;
}

// Game loop
function update(time = 0) {
    if (!GameState.gameRunning) return;

    const deltaTime = time - (update.lastTime || 0);
    update.lastTime = time;
    
    if (!GameState.paused && !GameState.animatingLines && GameState.currentPiece) {
        GameState.dropCounter += deltaTime;
        if (GameState.dropCounter > GameState.dropInterval) {
            dropPiece();
            GameState.dropCounter = 0;
        }
    }

    if (!GameState.paused) {
        StormEffects.updateStormParticles();
    }
    
    drawBoard();
    if (GameState.currentPiece && GameState.currentPiece.shape) {
        drawPiece(GameState.currentPiece);
    }
    
    if (GameState.paused) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText('PAUSED', canvas.width / 2, canvas.height / 2);
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
        ctx.restore();
    }

    GameState.gameLoop = requestAnimationFrame(update);
}

// Drop piece
function dropPiece() {
    if (GameState.animatingLines || !GameState.currentPiece || !GameState.currentPiece.shape) return;
    
    GameState.currentPiece.y++;
    if (PieceManager.collides(GameState.currentPiece)) {
        GameState.currentPiece.y--;
        
        if (GameState.currentPiece.y <= 0) {
            gameOver();
            return;
        }
        
        AudioSystem.playSoundEffect('drop');
        PieceManager.mergePiece(GameState.currentPiece);
        
        if (GameState.nextPiece && GameState.nextPiece.shape) {
            GameState.currentPiece = GameState.nextPiece;
            GameState.nextPiece = PieceManager.createPiece();
            drawNextPiece();
        } else {
            gameOver();
        }
    }
}

// Hard drop
function hardDrop() {
    if (GameState.animatingLines || !GameState.currentPiece) return;
    
    while (!PieceManager.collides(GameState.currentPiece, 0, 1)) {
        GameState.currentPiece.y++;
    }
    dropPiece();
}

// Game over
function gameOver() {
    GameState.gameRunning = false;
    cancelAnimationFrame(GameState.gameLoop);
    AudioSystem.playSoundEffect('gameover');
    
    finalScoreDisplay.textContent = `Final Score: ${RenderUtils.formatAsBitcoin(GameState.score)}`;
    
    let statsHTML = `Lines: ${GameState.lines} | Level: ${GameState.level}<br>`;
    if (GameState.strikeCount > 0 || GameState.tsunamiCount > 0 || GameState.blackHoleCount > 0) {
        statsHTML += '<br>';
        if (GameState.strikeCount > 0) statsHTML += `⚡ Strikes: ${GameState.strikeCount}<br>`;
        if (GameState.tsunamiCount > 0) statsHTML += `🌊 Tsunamis: ${GameState.tsunamiCount}<br>`;
        if (GameState.blackHoleCount > 0) statsHTML += `🕳️ Black Holes: ${GameState.blackHoleCount}<br>`;
    }
    finalStatsDisplay.innerHTML = statsHTML;
    
    gameOverDiv.style.display = 'block';
}

// Start game
function startGame(mode) {
    GameState.gameMode = mode;
    GameState.lastPlayedMode = mode;
    
    const config = MODE_CONFIG[mode];
    GameState.COLS = config.cols;
    GameState.hailstormEnabled = config.hailstorm;
    GameState.currentColorSet = COLORS.slice(0, config.colorCount);
    
    updateCanvasSize();
    GameState.reset();
    initHistogram();
    updateStats();
    
    GameState.currentPiece = PieceManager.createPiece();
    GameState.nextPiece = PieceManager.createPiece();
    drawNextPiece();
    
    GameState.gameRunning = true;
    gameOverDiv.style.display = 'none';
    modeMenu.classList.add('hidden');
    
    update();
}

// Event handlers
modeButtons.forEach(button => {
    button.addEventListener('click', () => {
        const mode = button.getAttribute('data-mode');
        startGame(mode);
    });
});

playAgainBtn.addEventListener('click', () => {
    gameOverDiv.style.display = 'none';
    modeMenu.classList.remove('hidden');
    GameState.COLS = 10;
    updateCanvasSize();
    GameState.initBoard();
    drawBoard();
});

// Keyboard controls
document.addEventListener('keydown', e => {
    if (e.key === 'F11' || e.key === 'PageUp' || e.key === 'PageDown') {
        e.preventDefault();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen().catch(() => {});
        }
        return;
    }
    
    if (GameState.gameRunning) {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Pause') {
            e.preventDefault();
            GameState.paused = !GameState.paused;
            return;
        }
        
        if (GameState.paused || !GameState.currentPiece) return;

        switch(e.key) {
            case 'ArrowLeft':
                PieceManager.movePiece(GameState.currentPiece, -1);
                break;
            case 'ArrowRight':
                PieceManager.movePiece(GameState.currentPiece, 1);
                break;
            case 'ArrowDown':
                dropPiece();
                break;
            case 'ArrowUp':
                PieceManager.rotatePiece(GameState.currentPiece);
                break;
            case ' ':
                e.preventDefault();
                hardDrop();
                break;
        }
    }
});

// Initialize
console.log('🎮 Initializing BLOCKCHaiNSTORM...');
console.log('Config loaded:', typeof COLORS !== 'undefined');
console.log('GameState loaded:', typeof GameState !== 'undefined');
console.log('AudioSystem loaded:', typeof AudioSystem !== 'undefined');
console.log('RenderUtils loaded:', typeof RenderUtils !== 'undefined');
console.log('BlobDetection loaded:', typeof BlobDetection !== 'undefined');
console.log('PieceManager loaded:', typeof PieceManager !== 'undefined');
console.log('StormEffects loaded:', typeof StormEffects !== 'undefined');

try {
    updateCanvasSize();
    drawBoard();
    console.log('✅ Game initialized successfully!');
} catch (error) {
    console.error('❌ Initialization error:', error);
}
