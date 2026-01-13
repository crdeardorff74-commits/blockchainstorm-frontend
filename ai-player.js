/**
 * AI Player Module for TaNTЯiS / BLOCKCHaiNSTORM
 * Plays the game automatically using heuristic-based evaluation
 * Uses Web Worker for computation to avoid UI freezes
 * 
 * Two-mode strategy:
 * 1) Color Building - Build large blobs, set up Tsunamis/Black Holes, avoid clearing lines
 * 2) Survival - Clear lines and reduce stack height
 * 
 * Mode switching based on stack height with hysteresis:
 * - Breeze/Tempest: Upper = 14, Lower = 8
 * - Maelstrom/Hurricane: Upper = 12, Lower = 7
 */

const AIPlayer = (() => {
    // Configuration
    let enabled = false;
    let thinking = false;
    let moveQueue = [];
    let lastMoveTime = 0;
    let moveDelay = 155; // ms between moves (adjustable for speed, default ~mid speed)
    let thinkDelay = 210; // ms to "think" before executing (default ~mid speed)
    
    // Web Worker for AI computation
    let worker = null;
    let workerReady = false;
    let pendingCallback = null;
    
    // Game state
    let currentSkillLevel = 'tempest';
    let pieceQueue = [];
    let currentMode = 'colorBuilding'; // Track mode for display/logging
    let currentStackHeight = 0; // Track stack height for debugging
    
    // Mode thresholds (reference - actual logic is in worker)
    const modeThresholds = {
        breeze: { upper: 12, lower: 6 },
        tempest: { upper: 12, lower: 6 },
        maelstrom: { upper: 10, lower: 5 },
        hurricane: { upper: 10, lower: 5 }
    };
    
    /**
     * Initialize the Web Worker
     */
    function initWorker() {
        if (worker) return;
        
        try {
            // Check if we're on file:// protocol - workers don't work there
            if (window.location.protocol === 'file:') {
                console.warn('🤖 Running from file:// - Web Workers disabled, using inline fallback');
                workerReady = false;
                return;
            }
            
            worker = new Worker('ai-worker.js');
            
            // Don't set workerReady until we get a response
            let initTimeout = setTimeout(() => {
                if (!workerReady) {
                    console.warn('🤖 Worker failed to respond, using inline fallback');
                    worker = null;
                }
            }, 2000);
            
            worker.onmessage = function(e) {
                // First message confirms worker is working
                if (!workerReady) {
                    workerReady = true;
                    clearTimeout(initTimeout);
                    console.log('🤖 AI Worker confirmed ready');
                }
                
                const { bestPlacement, mode, reset, stackHeight } = e.data;
                
                console.log(`🤖 AI received from worker: mode=${mode}, stackHeight=${stackHeight}`);
                
                // Track current mode for potential display
                if (mode) {
                    currentMode = mode;
                }
                
                // Track stack height for debugging
                if (typeof stackHeight === 'number') {
                    currentStackHeight = stackHeight;
                }
                
                if (pendingCallback && !reset) {
                    pendingCallback(bestPlacement);
                    pendingCallback = null;
                }
            };
            
            worker.onerror = function(e) {
                console.error('AI Worker error:', e.message);
                workerReady = false;
                worker = null;
                clearTimeout(initTimeout);
            };
            
            console.log('🤖 AI Worker initializing (Dual-Mode Strategy)...');
        } catch (e) {
            console.warn('🤖 Web Worker not available, using inline fallback:', e.message);
            workerReady = false;
        }
    }
    
    /**
     * Initialize the AI
     */
    function init(state) {
        initWorker();
        console.log('🤖 AI Player initialized (Dual-Mode: Color Building / Survival)');
    }
    
    /**
     * Set enabled state
     */
    function setEnabled(value) {
        enabled = value;
        if (value) {
            initWorker();
        }
    }
    
    /**
     * Check if AI is enabled
     */
    function isEnabled() {
        return enabled;
    }
    
    /**
     * Set move speed (1-10, where 10 is fastest)
     */
    function setSpeed(speed) {
        const normalizedSpeed = Math.max(1, Math.min(10, speed));
        moveDelay = 300 - (normalizedSpeed * 29); // 271ms to 10ms
        thinkDelay = 400 - (normalizedSpeed * 38); // 362ms to 20ms
    }
    
    /**
     * Set skill level
     */
    function setSkillLevel(level) {
        currentSkillLevel = level;
    }
    
    /**
     * Calculate moves needed to reach target placement
     */
    function calculateMoves(currentPiece, targetPlacement) {
        const moves = [];
        
        for (let i = 0; i < targetPlacement.rotationIndex; i++) {
            moves.push('rotate');
        }
        
        const xDiff = targetPlacement.x - currentPiece.x;
        
        if (xDiff < 0) {
            for (let i = 0; i < Math.abs(xDiff); i++) {
                moves.push('left');
            }
        } else if (xDiff > 0) {
            for (let i = 0; i < xDiff; i++) {
                moves.push('right');
            }
        }
        
        moves.push('drop');
        
        return moves;
    }
    
    // ============ INLINE FALLBACK (for file:// protocol) ============
    
    function fallbackCloneBoard(board) {
        return board.map(row => row ? [...row] : new Array(10).fill(null));
    }
    
    function fallbackGetAllRotations(shape) {
        const rotations = [shape];
        let current = shape;
        for (let i = 0; i < 3; i++) {
            const rotated = current[0].map((_, colIndex) =>
                current.map(row => row[colIndex]).reverse()
            );
            const isDuplicate = rotations.some(existing =>
                existing.length === rotated.length &&
                existing.every((row, y) => row.length === rotated[y].length && row.every((val, x) => val === rotated[y][x]))
            );
            if (!isDuplicate) rotations.push(rotated);
            current = rotated;
        }
        return rotations;
    }
    
    function fallbackIsValid(board, shape, x, y, cols, rows) {
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (!shape[py][px]) continue;
                const bx = x + px, by = y + py;
                if (bx < 0 || bx >= cols || by >= rows) return false;
                if (by >= 0 && board[by] && board[by][bx]) return false;
            }
        }
        return true;
    }
    
    function fallbackDrop(board, shape, x, cols, rows) {
        let y = -shape.length;
        while (fallbackIsValid(board, shape, x, y + 1, cols, rows)) y++;
        return y;
    }
    
    function fallbackPlace(board, shape, x, y, color) {
        const newBoard = fallbackCloneBoard(board);
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px]) {
                    const by = y + py, bx = x + px;
                    if (by >= 0 && by < newBoard.length && bx >= 0 && bx < newBoard[0].length) {
                        newBoard[by][bx] = color;
                    }
                }
            }
        }
        return newBoard;
    }
    
    function fallbackCountHoles(board) {
        let holes = 0;
        const cols = board[0].length;
        for (let x = 0; x < cols; x++) {
            let found = false;
            for (let y = 0; y < board.length; y++) {
                if (board[y] && board[y][x]) found = true;
                else if (found && board[y]) holes++;
            }
        }
        return holes;
    }
    
    function fallbackGetHeight(board, rows) {
        for (let y = 0; y < board.length; y++) {
            if (board[y] && board[y].some(c => c !== null)) return rows - y;
        }
        return 0;
    }
    
    function fallbackCountLines(board) {
        return board.filter(row => row && row.every(c => c !== null)).length;
    }
    
    function fallbackColorAdjacency(board, shape, x, y, color, cols, rows) {
        let adj = 0;
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (!shape[py][px]) continue;
                const bx = x + px, by = y + py;
                [[bx-1,by],[bx+1,by],[bx,by-1],[bx,by+1]].forEach(([nx,ny]) => {
                    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && board[ny] && board[ny][nx] === color) adj++;
                });
            }
        }
        return adj;
    }
    
    function fallbackEvaluate(board, shape, x, y, color, cols, rows, linesCleared) {
        const height = fallbackGetHeight(board, rows);
        const holes = fallbackCountHoles(board);
        const adj = fallbackColorAdjacency(board, shape, x, y, color, cols, rows);
        const thresholds = modeThresholds[currentSkillLevel] || modeThresholds.tempest;
        
        let score = 0;
        const headroom = thresholds.upper - height;
        const safetyRatio = Math.max(0, Math.min(1, headroom / thresholds.upper));
        
        if (currentMode === 'colorBuilding') {
            // Color building: context-dependent line clear handling
            if (headroom > 8) {
                score -= linesCleared * 3; // Safe - penalize clears
            } else if (headroom <= 4) {
                score += linesCleared * 2; // Danger - reward clears
            }
            
            score += adj * 0.6;
            
            // Scaled penalties based on safety
            const holePenalty = 0.8 + (1 - safetyRatio) * 1.5;
            score -= holes * holePenalty;
            score -= height * 0.2;
            
            // Graduated danger penalty
            if (headroom < 8) {
                const dangerLevel = (8 - headroom) / 8;
                score -= dangerLevel * dangerLevel * 15;
            }
        } else {
            // Survival: reward line clears, penalize height and holes
            score += linesCleared * linesCleared * 4;
            score -= height * 0.8;
            score -= holes * 2.5;
            score += adj * 0.15;
            
            // CRITICAL: Massive penalty for near-death placements
            if (height >= 19) {
                score -= 1000;
            } else if (height >= 18) {
                score -= 200;
            } else if (height >= 17) {
                score -= 50;
            }
        }
        
        return score;
    }
    
    /**
     * Fallback mode switching (mirrors worker logic)
     */
    function fallbackUpdateMode(board, rows) {
        const stackHeight = fallbackGetHeight(board, rows);
        const thresholds = modeThresholds[currentSkillLevel] || modeThresholds.tempest;
        
        currentStackHeight = stackHeight;
        
        if (currentMode === 'colorBuilding' && stackHeight >= thresholds.upper) {
            currentMode = 'survival';
            console.log(`🔴 FALLBACK: Switching to SURVIVAL (height ${stackHeight} >= ${thresholds.upper})`);
        } else if (currentMode === 'survival' && stackHeight <= thresholds.lower) {
            currentMode = 'colorBuilding';
            console.log(`🟢 FALLBACK: Switching to COLOR BUILDING (height ${stackHeight} <= ${thresholds.lower})`);
        }
    }
    
    function fallbackFindBest(board, piece, cols, rows) {
        // Update mode before finding best placement
        fallbackUpdateMode(board, rows);
        
        const rotations = fallbackGetAllRotations(piece.shape);
        let best = null;
        let bestScore = -Infinity;
        
        for (let ri = 0; ri < rotations.length; ri++) {
            const shape = rotations[ri];
            for (let x = -2; x < cols + 2; x++) {
                if (!fallbackIsValid(board, shape, x, 0, cols, rows) && !fallbackIsValid(board, shape, x, -shape.length, cols, rows)) continue;
                const y = fallbackDrop(board, shape, x, cols, rows);
                if (!fallbackIsValid(board, shape, x, y, cols, rows)) continue;
                
                // CRITICAL: Check if piece would extend above the board (game over)
                if (y < 0) {
                    // This placement would cause game over - skip or massive penalty
                    if (-10000 > bestScore) {
                        bestScore = -10000;
                        best = { x, y, rotationIndex: ri, shape, score: -10000 };
                    }
                    continue;
                }
                
                const newBoard = fallbackPlace(board, shape, x, y, piece.color);
                const linesBefore = fallbackCountLines(board);
                const linesAfter = fallbackCountLines(newBoard);
                const score = fallbackEvaluate(newBoard, shape, x, y, piece.color, cols, rows, linesAfter - linesBefore);
                
                if (score > bestScore) {
                    bestScore = score;
                    best = { x, y, rotationIndex: ri, shape, score };
                }
            }
        }
        return best;
    }
    
    // ============ END INLINE FALLBACK ============
    
    /**
     * Request best placement from worker (async)
     */
    function requestBestPlacement(board, piece, queue, cols, rows, callback) {
        if (!workerReady || !worker) {
            // Fallback: use inline synchronous calculation (fallbackFindBest calls fallbackUpdateMode)
            const best = fallbackFindBest(board, piece, cols, rows);
            console.log(`🤖 FALLBACK: mode=${currentMode}, stackHeight=${currentStackHeight}`);
            callback(best);
            return;
        }
        
        pendingCallback = callback;
        
        // Serialize data for worker
        worker.postMessage({
            board: board,
            piece: {
                shape: piece.shape,
                color: piece.color,
                x: piece.x,
                y: piece.y
            },
            queue: queue.map(p => p ? { shape: p.shape, color: p.color } : null).filter(Boolean),
            cols: cols,
            rows: rows,
            skillLevel: currentSkillLevel
        });
    }
    
    /**
     * Main AI update function - call each frame
     * gameState optional parameter includes: { earthquakeActive, earthquakePhase }
     */
    function update(board, currentPiece, nextPieceOrQueue, cols, rows, callbacks, gameState = {}) {
        if (!enabled || !currentPiece) return;
        
        // Always update mode and stack height on main thread for accurate display
        updateModeFromBoard(board, rows);
        
        const now = Date.now();
        const { earthquakeActive, earthquakePhase } = gameState;
        const duringEarthquake = earthquakeActive && (earthquakePhase === 'shake' || earthquakePhase === 'crack' || earthquakePhase === 'shift');
        
        // Execute queued moves
        if (moveQueue.length > 0) {
            if (now - lastMoveTime >= moveDelay) {
                const move = moveQueue.shift();
                
                // During earthquake, delay drop commands - position the piece but wait to drop
                if (duringEarthquake && move === 'drop') {
                    // Put the drop back so we remember to do it when earthquake ends
                    moveQueue.unshift('drop');
                    return;
                }
                
                executeMove(move, callbacks);
                lastMoveTime = now;
            }
            return;
        }
        
        // During earthquake with no moves queued, just wait for it to finish
        if (duringEarthquake) {
            return;
        }
        
        // Don't start thinking if already thinking
        if (thinking) return;
        
        thinking = true;
        
        // Handle both legacy single piece and new queue array
        if (Array.isArray(nextPieceOrQueue)) {
            pieceQueue = nextPieceOrQueue;
        } else {
            pieceQueue = nextPieceOrQueue ? [nextPieceOrQueue] : [];
        }
        
        // Small delay before thinking (feels more natural)
        setTimeout(() => {
            // Update skill level from global if available
            if (typeof window !== 'undefined' && window.skillLevel) {
                currentSkillLevel = window.skillLevel;
            }
            
            // Request placement from worker
            requestBestPlacement(board, currentPiece, pieceQueue, cols, rows, (bestPlacement) => {
                if (bestPlacement) {
                    moveQueue = calculateMoves(currentPiece, bestPlacement);
                } else {
                    moveQueue = ['drop'];
                }
                
                thinking = false;
                lastMoveTime = Date.now();
            });
        }, thinkDelay);
    }
    
    /**
     * Execute a single move
     */
    function executeMove(move, callbacks) {
        switch (move) {
            case 'left':
                if (callbacks.moveLeft) callbacks.moveLeft();
                break;
            case 'right':
                if (callbacks.moveRight) callbacks.moveRight();
                break;
            case 'rotate':
                if (callbacks.rotate) callbacks.rotate();
                break;
            case 'drop':
                if (callbacks.hardDrop) callbacks.hardDrop();
                break;
            case 'down':
                if (callbacks.softDrop) callbacks.softDrop();
                break;
        }
    }
    
    /**
     * Reset AI state
     */
    function reset() {
        moveQueue = [];
        pieceQueue = [];
        thinking = false;
        lastMoveTime = 0;
        pendingCallback = null;
        currentMode = 'colorBuilding'; // Reset to color building mode
        
        // Also reset worker's mode
        if (worker && workerReady) {
            worker.postMessage({ command: 'reset' });
        }
    }
    
    /**
     * Get current AI mode
     */
    function getMode() {
        return currentMode;
    }
    
    /**
     * Get current stack height (for debugging)
     */
    function getStackHeight() {
        return currentStackHeight;
    }
    
    /**
     * Calculate stack height directly (for when worker doesn't report it)
     */
    function calculateStackHeight(board, rows) {
        if (!board || board.length === 0) return 0;
        for (let y = 0; y < board.length; y++) {
            const row = board[y];
            if (row) {
                for (let x = 0; x < row.length; x++) {
                    if (row[x] !== null && row[x] !== undefined) {
                        return board.length - y;
                    }
                }
            }
        }
        return 0;
    }
    
    /**
     * Update mode based on stack height (main thread fallback)
     */
    function updateModeFromBoard(board, rows) {
        const stackHeight = calculateStackHeight(board, rows);
        currentStackHeight = stackHeight;
        
        const thresholds = modeThresholds[currentSkillLevel] || modeThresholds.tempest;
        
        if (currentMode === 'colorBuilding' && stackHeight >= thresholds.upper) {
            currentMode = 'survival';
            console.log(`🔴 AI SWITCHING TO SURVIVAL (height ${stackHeight} >= ${thresholds.upper})`);
        } else if (currentMode === 'survival' && stackHeight <= thresholds.lower) {
            currentMode = 'colorBuilding';
            console.log(`🟢 AI SWITCHING TO COLOR BUILDING (height ${stackHeight} <= ${thresholds.lower})`);
        }
    }
    
    /**
     * Terminate worker (cleanup)
     */
    function terminate() {
        if (worker) {
            worker.terminate();
            worker = null;
            workerReady = false;
        }
    }
    
    return {
        init,
        setEnabled,
        isEnabled,
        setSpeed,
        setSkillLevel,
        update,
        reset,
        terminate,
        getMode,
        getStackHeight,
        modeThresholds
    };
})();

window.AIPlayer = AIPlayer;
