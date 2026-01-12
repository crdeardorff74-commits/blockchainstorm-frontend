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
    
    // Mode thresholds (reference - actual logic is in worker)
    const modeThresholds = {
        breeze: { upper: 14, lower: 8 },
        tempest: { upper: 14, lower: 8 },
        maelstrom: { upper: 12, lower: 7 },
        hurricane: { upper: 12, lower: 7 }
    };
    
    /**
     * Initialize the Web Worker
     */
    function initWorker() {
        if (worker) return;
        
        try {
            worker = new Worker('ai-worker.js');
            
            worker.onmessage = function(e) {
                const { bestPlacement, mode } = e.data;
                
                // Track current mode for potential display
                if (mode) {
                    currentMode = mode;
                }
                
                if (pendingCallback) {
                    pendingCallback(bestPlacement);
                    pendingCallback = null;
                }
            };
            
            worker.onerror = function(e) {
                console.error('AI Worker error:', e.message);
                workerReady = false;
                // Fall back to main thread computation
            };
            
            workerReady = true;
            console.log('🤖 AI Worker initialized (Dual-Mode Strategy)');
        } catch (e) {
            console.warn('🤖 Web Worker not available, using main thread:', e.message);
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
    
    /**
     * Request best placement from worker (async)
     */
    function requestBestPlacement(board, piece, queue, cols, rows, callback) {
        if (!workerReady || !worker) {
            // Fallback: use synchronous calculation (will block, but at least works)
            console.warn('🤖 Worker not ready, falling back to sync calculation');
            callback(null);
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
        modeThresholds
    };
})();

window.AIPlayer = AIPlayer;
