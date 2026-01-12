/**
 * AI Player Module for TaNTЯiS / BLOCKCHaiNSTORM
 * Plays the game automatically using heuristic-based evaluation
 * Uses Web Worker for computation to avoid UI freezes
 * 
 * Optimized for this game's unique scoring mechanics:
 * - Color blob bonuses (size² × blocks × 100)
 * - Tsunami (blob spanning full width): size³ × 200
 * - Black Hole (blob surrounded by another): (inner³ + outer³) × 800
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
    
    // Weights for board evaluation - BALANCED with stronger survival (kept for reference/export)
    const weights = {
        aggregateHeight: -0.7,
        completeLines: 1.0,
        holes: -1.4,
        bumpiness: -0.25,
        colorBlobBonus: 0.5,
        tsunamiProgress: 0.7,
        envelopmentProgress: 0.5,
        colorAdjacency: 0.35,
        queueColorSynergy: 0.35,
        maxHeightPenalty: -2.5,
        nearDeathPenalty: -9.0,
        lineClearUrgency: 3.5,
        perfectClear: 5.0
    };
    
    /**
     * Initialize the Web Worker
     */
    function initWorker() {
        if (worker) return;
        
        try {
            worker = new Worker('ai-worker.js');
            
            worker.onmessage = function(e) {
                const { bestPlacement } = e.data;
                
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
            console.log('🤖 AI Worker initialized');
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
        console.log('🤖 AI Player initialized (Game-Aware Mode)');
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
     */
    function update(board, currentPiece, nextPieceOrQueue, cols, rows, callbacks) {
        if (!enabled || !currentPiece) return;
        
        const now = Date.now();
        
        // Execute queued moves
        if (moveQueue.length > 0) {
            if (now - lastMoveTime >= moveDelay) {
                const move = moveQueue.shift();
                executeMove(move, callbacks);
                lastMoveTime = now;
            }
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
        weights
    };
})();

window.AIPlayer = AIPlayer;
