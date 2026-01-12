/**
 * AI Player Module for TaNTЯiS / BLOCKCHaiNSTORM
 * Plays the game automatically using heuristic-based evaluation
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
    let moveDelay = 50; // ms between moves (adjustable for speed)
    let thinkDelay = 100; // ms to "think" before executing
    
    // Weights for board evaluation (tuned for this game's mechanics)
    const weights = {
        // Standard Tetris factors
        aggregateHeight: -0.5,
        completeLines: 0.6,
        holes: -0.8,
        bumpiness: -0.15,
        
        // Game-specific factors
        colorBlobBonus: 0.5,        // Reward for larger same-color blobs
        tsunamiProgress: 1.0,       // Reward for blobs approaching full width
        envelopmentProgress: 0.8,   // Reward for surrounding patterns (black hole setup)
        colorAdjacency: 0.3,        // Reward for placing next to same color
        queueColorSynergy: 0.6,     // Reward for building blobs when matching colors are in queue
        
        // Survival factors
        maxHeightPenalty: -1.5,     // Penalty based on highest column
        nearDeathPenalty: -5.0,     // Severe penalty when very close to top
        lineClearUrgency: 2.0,      // Bonus for clearing lines when in danger
        
        perfectClear: 5.0           // Huge bonus for clearing entire board
    };
    
    // Store the piece queue for lookahead evaluation
    let pieceQueue = [];
    
    /**
     * Calculate danger level based on stack height (0 = safe, 1 = critical)
     */
    function getDangerLevel(board, rows) {
        let maxHeight = 0;
        const cols = board[0] ? board[0].length : 10;
        
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < board.length; y++) {
                if (board[y] && board[y][x]) {
                    const height = rows - y;
                    if (height > maxHeight) maxHeight = height;
                    break;
                }
            }
        }
        
        // Danger starts at 50% height, critical at 80%
        const safeHeight = rows * 0.5;
        const criticalHeight = rows * 0.8;
        
        if (maxHeight <= safeHeight) return 0;
        if (maxHeight >= criticalHeight) return 1;
        
        return (maxHeight - safeHeight) / (criticalHeight - safeHeight);
    }
    
    /**
     * Get maximum column height
     */
    function getMaxHeight(board, rows) {
        let maxHeight = 0;
        const cols = board[0] ? board[0].length : 10;
        
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < board.length; y++) {
                if (board[y] && board[y][x]) {
                    const height = rows - y;
                    if (height > maxHeight) maxHeight = height;
                    break;
                }
            }
        }
        return maxHeight;
    }
    
    // Game state references
    let gameState = null;
    let currentSkillLevel = 'tempest'; // Track skill level for special formation eligibility
    
    /**
     * Initialize the AI with game state references
     */
    function init(state) {
        gameState = state;
        console.log('🤖 AI Player initialized (Game-Aware Mode)');
    }
    
    /**
     * Update skill level (affects whether to pursue tsunamis/black holes)
     */
    function setSkillLevel(level) {
        currentSkillLevel = level;
    }
    
    /**
     * Enable/disable AI mode
     */
    function setEnabled(value) {
        enabled = value;
        if (enabled) {
            console.log('🤖 AI Mode ENABLED (Game-Aware)');
            moveQueue = [];
            thinking = false;
        } else {
            console.log('🤖 AI Mode DISABLED');
            moveQueue = [];
        }
    }
    
    function isEnabled() {
        return enabled;
    }
    
    /**
     * Set move speed (1-10, where 10 is fastest)
     */
    function setSpeed(speed) {
        const normalizedSpeed = Math.max(1, Math.min(10, speed));
        moveDelay = 150 - (normalizedSpeed * 14); // 136ms to 10ms
        thinkDelay = 200 - (normalizedSpeed * 18); // 182ms to 20ms
    }
    
    /**
     * Clone a 2D board array
     */
    function cloneBoard(board) {
        return board.map(row => [...row]);
    }
    
    /**
     * Rotate a shape clockwise
     */
    function rotateShape(shape) {
        return shape[0].map((_, i) => shape.map(row => row[i]).reverse());
    }
    
    /**
     * Get all unique rotations of a shape
     */
    function getAllRotations(shape) {
        const rotations = [shape];
        let current = shape;
        for (let i = 0; i < 3; i++) {
            current = rotateShape(current);
            const isUnique = !rotations.some(r => 
                r.length === current.length && 
                r[0].length === current[0].length &&
                r.every((row, y) => row.every((val, x) => val === current[y][x]))
            );
            if (isUnique) {
                rotations.push(current);
            }
        }
        return rotations;
    }
    
    /**
     * Check if a piece collides with the board or walls
     */
    function checkCollision(board, shape, x, y, cols, rows) {
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px]) {
                    const newX = x + px;
                    const newY = y + py;
                    if (newX < 0 || newX >= cols || newY >= rows) {
                        return true;
                    }
                    if (newY >= 0 && board[newY][newX]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    /**
     * Get the Y position where a piece would land
     */
    function getDropY(board, shape, x, cols, rows) {
        let y = -shape.length;
        while (!checkCollision(board, shape, x, y + 1, cols, rows)) {
            y++;
        }
        return y;
    }
    
    /**
     * Place a piece on the board (returns new board)
     */
    function placePiece(board, shape, x, y, color) {
        const newBoard = cloneBoard(board);
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px]) {
                    const boardY = y + py;
                    const boardX = x + px;
                    if (boardY >= 0 && boardY < newBoard.length && boardX >= 0 && boardX < newBoard[0].length) {
                        newBoard[boardY][boardX] = color;
                    }
                }
            }
        }
        return newBoard;
    }
    
    /**
     * Find all connected blobs of same color
     */
    function findBlob(board, x, y, color, visited, cols, rows) {
        const key = `${x},${y}`;
        if (visited.has(key) || x < 0 || x >= cols || y < 0 || y >= rows) return [];
        if (!board[y] || board[y][x] !== color) return [];
        
        visited.add(key);
        let blob = [[x, y]];
        
        blob = blob.concat(findBlob(board, x + 1, y, color, visited, cols, rows));
        blob = blob.concat(findBlob(board, x - 1, y, color, visited, cols, rows));
        blob = blob.concat(findBlob(board, x, y + 1, color, visited, cols, rows));
        blob = blob.concat(findBlob(board, x, y - 1, color, visited, cols, rows));
        
        return blob;
    }
    
    /**
     * Get all blobs on the board
     */
    function getAllBlobs(board, cols, rows) {
        const visited = new Set();
        const blobs = [];
        
        for (let y = 0; y < rows; y++) {
            if (!board[y]) continue;
            for (let x = 0; x < cols; x++) {
                const key = `${x},${y}`;
                if (!visited.has(key) && board[y][x]) {
                    const blob = findBlob(board, x, y, board[y][x], visited, cols, rows);
                    if (blob.length > 0) {
                        blobs.push({ positions: blob, color: board[y][x] });
                    }
                }
            }
        }
        return blobs;
    }
    
    /**
     * Calculate color blob score bonus
     */
    function getColorBlobScore(blobs) {
        let totalScore = 0;
        for (const blob of blobs) {
            // Bigger blobs score exponentially more
            const size = blob.positions.length;
            totalScore += size * size * 0.1; // Quadratic bonus for blob size
        }
        return totalScore;
    }
    
    /**
     * Check tsunami progress (how close blobs are to spanning full width)
     */
    function getTsunamiProgress(blobs, cols) {
        let maxProgress = 0;
        for (const blob of blobs) {
            const xs = blob.positions.map(p => p[0]);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const width = maxX - minX + 1;
            
            // Progress toward spanning full width
            const progress = width / cols;
            
            // Bonus if touching edges
            const touchesLeft = minX === 0;
            const touchesRight = maxX === cols - 1;
            let edgeBonus = 0;
            if (touchesLeft) edgeBonus += 0.2;
            if (touchesRight) edgeBonus += 0.2;
            if (touchesLeft && touchesRight) edgeBonus += 0.5; // Almost tsunami!
            
            const totalProgress = progress + edgeBonus;
            if (totalProgress > maxProgress) {
                maxProgress = totalProgress;
            }
        }
        return maxProgress;
    }
    
    /**
     * Check for potential black hole formations (one blob surrounded by another)
     */
    function getEnvelopmentProgress(blobs, cols, rows) {
        let maxProgress = 0;
        
        for (let i = 0; i < blobs.length; i++) {
            for (let j = 0; j < blobs.length; j++) {
                if (i === j || blobs[i].color === blobs[j].color) continue;
                
                const inner = blobs[i];
                const outer = blobs[j];
                
                // Count how many sides of inner blob are adjacent to outer blob
                const outerSet = new Set(outer.positions.map(p => `${p[0]},${p[1]}`));
                let adjacentCount = 0;
                let totalEdges = 0;
                
                for (const [x, y] of inner.positions) {
                    const neighbors = [[x-1,y], [x+1,y], [x,y-1], [x,y+1]];
                    for (const [nx, ny] of neighbors) {
                        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
                        const key = `${nx},${ny}`;
                        if (!inner.positions.some(p => p[0] === nx && p[1] === ny)) {
                            totalEdges++;
                            if (outerSet.has(key)) {
                                adjacentCount++;
                            }
                        }
                    }
                }
                
                if (totalEdges > 0) {
                    const progress = adjacentCount / totalEdges;
                    if (progress > maxProgress) {
                        maxProgress = progress;
                    }
                }
            }
        }
        return maxProgress;
    }
    
    /**
     * Count color adjacency bonus for piece placement
     */
    function getColorAdjacencyBonus(board, shape, x, y, color, cols, rows) {
        let adjacentSameColor = 0;
        
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (!shape[py][px]) continue;
                
                const boardX = x + px;
                const boardY = y + py;
                
                // Check all 4 neighbors
                const neighbors = [
                    [boardX - 1, boardY],
                    [boardX + 1, boardY],
                    [boardX, boardY - 1],
                    [boardX, boardY + 1]
                ];
                
                for (const [nx, ny] of neighbors) {
                    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
                    // Skip if this is part of the piece being placed
                    const isPartOfPiece = shape.some((row, ppy) => 
                        row.some((val, ppx) => val && x + ppx === nx && y + ppy === ny)
                    );
                    if (isPartOfPiece) continue;
                    
                    if (board[ny] && board[ny][nx] === color) {
                        adjacentSameColor++;
                    }
                }
            }
        }
        return adjacentSameColor;
    }
    
    /**
     * Analyze the piece queue to count colors
     */
    function getQueueColorCounts() {
        const colorCounts = {};
        for (const piece of pieceQueue) {
            if (piece && piece.color) {
                colorCounts[piece.color] = (colorCounts[piece.color] || 0) + 1;
            }
        }
        return colorCounts;
    }
    
    /**
     * Calculate synergy bonus based on queue colors and current blobs
     * Rewards building blobs when more matching colors are coming
     */
    function getQueueColorSynergy(blobs, placementColor) {
        if (pieceQueue.length === 0) return 0;
        
        const colorCounts = getQueueColorCounts();
        let synergyScore = 0;
        
        // Bonus for placing a color that has more pieces coming in the queue
        const upcomingMatches = colorCounts[placementColor] || 0;
        synergyScore += upcomingMatches * 0.5;
        
        // Bonus for existing blobs that have matching colors in the queue
        // Larger blobs with more upcoming matches are more valuable
        for (const blob of blobs) {
            const blobUpcoming = colorCounts[blob.color] || 0;
            if (blobUpcoming > 0) {
                // Synergy = blob size * number of matching pieces coming
                // This encourages building blobs when we can keep growing them
                synergyScore += (blob.size * blobUpcoming * 0.1);
                
                // Extra bonus for blobs that are close to tsunami (wide blobs)
                const minX = Math.min(...blob.positions.map(p => p[0]));
                const maxX = Math.max(...blob.positions.map(p => p[0]));
                const width = maxX - minX + 1;
                if (width >= 6 && blobUpcoming >= 2) {
                    synergyScore += width * 0.3; // Encourage wide blobs with matching colors coming
                }
            }
        }
        
        return synergyScore;
    }
    
    /**
     * Count complete lines in a board
     */
    function countCompleteLines(board) {
        let count = 0;
        for (let y = 0; y < board.length; y++) {
            if (board[y] && board[y].every(cell => cell !== null)) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * Calculate aggregate height of all columns
     */
    function getAggregateHeight(board) {
        let totalHeight = 0;
        const cols = board[0].length;
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < board.length; y++) {
                if (board[y] && board[y][x]) {
                    totalHeight += board.length - y;
                    break;
                }
            }
        }
        return totalHeight;
    }
    
    /**
     * Count holes
     */
    function countHoles(board) {
        let holes = 0;
        const cols = board[0].length;
        for (let x = 0; x < cols; x++) {
            let blockFound = false;
            for (let y = 0; y < board.length; y++) {
                if (board[y] && board[y][x]) {
                    blockFound = true;
                } else if (blockFound && board[y]) {
                    holes++;
                }
            }
        }
        return holes;
    }
    
    /**
     * Calculate bumpiness
     */
    function getBumpiness(board) {
        const cols = board[0].length;
        const heights = [];
        
        for (let x = 0; x < cols; x++) {
            let height = 0;
            for (let y = 0; y < board.length; y++) {
                if (board[y] && board[y][x]) {
                    height = board.length - y;
                    break;
                }
            }
            heights.push(height);
        }
        
        let bumpiness = 0;
        for (let i = 0; i < heights.length - 1; i++) {
            bumpiness += Math.abs(heights[i] - heights[i + 1]);
        }
        return bumpiness;
    }
    
    /**
     * Check if board is completely clear
     */
    function isPerfectClear(board) {
        return board.every(row => !row || row.every(cell => cell === null));
    }
    
    /**
     * Evaluate a board state with game-specific scoring and survival awareness
     */
    function evaluateBoard(board, shape, x, y, color, cols, rows, linesCleared) {
        const blobs = getAllBlobs(board, cols, rows);
        const maxHeight = getMaxHeight(board, rows);
        const dangerLevel = getDangerLevel(board, rows);
        
        let score = 0;
        
        // === SURVIVAL FACTORS (always important, critical when in danger) ===
        
        // Height penalty - scales with danger
        const heightPenalty = weights.maxHeightPenalty * maxHeight * (1 + dangerLevel * 2);
        score += heightPenalty;
        
        // Severe penalty when near death (top 4 rows have blocks)
        if (maxHeight >= rows - 4) {
            score += weights.nearDeathPenalty * (maxHeight - (rows - 4));
        }
        
        // Holes are always bad, worse when in danger
        score += weights.holes * countHoles(board) * (1 + dangerLevel);
        
        // Bumpiness penalty
        score += weights.bumpiness * getBumpiness(board);
        
        // Aggregate height
        score += weights.aggregateHeight * getAggregateHeight(board);
        
        // === LINE CLEARS (more valuable when in danger) ===
        const lineClearBonus = linesCleared * linesCleared * weights.completeLines;
        const urgencyMultiplier = 1 + (dangerLevel * weights.lineClearUrgency);
        score += lineClearBonus * urgencyMultiplier;
        
        // === GAME-SPECIFIC FACTORS (reduced when in danger) ===
        const safetyFactor = 1 - (dangerLevel * 0.7); // Reduce blob focus when in danger
        
        if (safetyFactor > 0.3) { // Only consider blob strategies when relatively safe
            // Color blob bonus
            score += weights.colorBlobBonus * getColorBlobScore(blobs) * safetyFactor;
            
            // Color adjacency for current placement
            score += weights.colorAdjacency * getColorAdjacencyBonus(board, shape, x, y, color, cols, rows) * safetyFactor;
            
            // Queue color synergy - reward building blobs when matching colors are coming
            if (pieceQueue.length > 0) {
                score += weights.queueColorSynergy * getQueueColorSynergy(blobs, color) * safetyFactor;
            }
            
            // Special formation progress (only in harder skill levels and when safe)
            if (currentSkillLevel !== 'breeze' && dangerLevel < 0.5) {
                score += weights.tsunamiProgress * getTsunamiProgress(blobs, cols) * safetyFactor;
                score += weights.envelopmentProgress * getEnvelopmentProgress(blobs, cols, rows) * safetyFactor;
            }
        }
        
        // Perfect clear bonus
        if (isPerfectClear(board)) {
            score += weights.perfectClear;
        }
        
        return score;
    }
    
    /**
     * Remove complete lines from board
     */
    function removeCompleteLines(board) {
        const newBoard = board.filter(row => !row || !row.every(cell => cell !== null));
        const linesRemoved = board.length - newBoard.length;
        for (let i = 0; i < linesRemoved; i++) {
            newBoard.unshift(new Array(board[0].length).fill(null));
        }
        return newBoard;
    }
    
    /**
     * Generate all possible placements for a piece
     */
    function generatePlacements(board, piece, cols, rows) {
        const placements = [];
        const rotations = getAllRotations(piece.shape);
        
        for (let rotationIndex = 0; rotationIndex < rotations.length; rotationIndex++) {
            const shape = rotations[rotationIndex];
            
            for (let x = -2; x < cols + 2; x++) {
                const y = getDropY(board, shape, x, cols, rows);
                
                if (checkCollision(board, shape, x, y, cols, rows)) continue;
                
                const newBoard = placePiece(board, shape, x, y, piece.color);
                const linesCleared = countCompleteLines(newBoard);
                const clearedBoard = removeCompleteLines(newBoard);
                const score = evaluateBoard(clearedBoard, shape, x, y, piece.color, cols, rows, linesCleared);
                
                placements.push({
                    x,
                    y,
                    rotationIndex,
                    shape,
                    score,
                    linesCleared
                });
            }
        }
        
        return placements;
    }
    
    /**
     * Find the best placement for a piece
     */
    function findBestPlacement(board, piece, cols, rows, nextPiece = null) {
        const placements = generatePlacements(board, piece, cols, rows);
        
        if (placements.length === 0) {
            return null;
        }
        
        // 2-ply lookahead if we have next piece
        if (nextPiece) {
            for (const placement of placements) {
                const newBoard = placePiece(board, placement.shape, placement.x, placement.y, piece.color);
                const clearedBoard = removeCompleteLines(newBoard);
                
                const nextPlacements = generatePlacements(clearedBoard, nextPiece, cols, rows);
                if (nextPlacements.length > 0) {
                    const bestNext = nextPlacements.reduce((a, b) => a.score > b.score ? a : b);
                    placement.combinedScore = placement.score + bestNext.score * 0.5;
                } else {
                    placement.combinedScore = placement.score - 100;
                }
            }
            
            return placements.reduce((a, b) => 
                (a.combinedScore || a.score) > (b.combinedScore || b.score) ? a : b
            );
        }
        
        return placements.reduce((a, b) => a.score > b.score ? a : b);
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
     * Main AI update function - call each frame
     * nextPieceOrQueue can be either a single piece (legacy) or an array of upcoming pieces
     */
    function update(board, currentPiece, nextPieceOrQueue, cols, rows, callbacks) {
        if (!enabled || !currentPiece) return;
        
        const now = Date.now();
        
        if (moveQueue.length > 0) {
            if (now - lastMoveTime >= moveDelay) {
                const move = moveQueue.shift();
                executeMove(move, callbacks);
                lastMoveTime = now;
            }
            return;
        }
        
        if (thinking) return;
        
        thinking = true;
        
        setTimeout(() => {
            // Update skill level from global if available
            if (typeof window !== 'undefined' && window.skillLevel) {
                currentSkillLevel = window.skillLevel;
            }
            
            // Handle both legacy single piece and new queue array
            let nextPiece = null;
            if (Array.isArray(nextPieceOrQueue)) {
                pieceQueue = nextPieceOrQueue;
                nextPiece = nextPieceOrQueue.length > 0 ? nextPieceOrQueue[0] : null;
            } else {
                pieceQueue = nextPieceOrQueue ? [nextPieceOrQueue] : [];
                nextPiece = nextPieceOrQueue;
            }
            
            const bestPlacement = findBestPlacement(board, currentPiece, cols, rows, nextPiece);
            
            if (bestPlacement) {
                moveQueue = calculateMoves(currentPiece, bestPlacement);
            } else {
                moveQueue = ['drop'];
            }
            
            thinking = false;
            lastMoveTime = Date.now();
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
    }
    
    return {
        init,
        setEnabled,
        isEnabled,
        setSpeed,
        setSkillLevel,
        update,
        reset,
        findBestPlacement,
        evaluateBoard,
        weights
    };
})();

window.AIPlayer = AIPlayer;
