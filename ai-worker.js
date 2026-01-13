// AI Worker v3.2 - Simplified single evaluation (2026-01-13)
/**
 * Radically simplified AI for TaNTЯiS
 * 
 * Single evaluation function with clear priorities:
 * 1. Don't create holes (devastating)
 * 2. Keep stack low
 * 3. Keep surface flat
 * 4. Build same-color blobs
 * 5. Extend wide blobs toward edges (tsunamis)
 */

let currentSkillLevel = 'tempest';
let pieceQueue = [];

// ==================== GAME RECORDING ====================
let gameRecording = {
    startTime: null,
    decisions: [],
    events: [],
    finalState: null
};

function startRecording() {
    gameRecording = {
        startTime: Date.now(),
        skillLevel: currentSkillLevel,
        decisions: [],
        events: [],
        finalState: null
    };
}

function recordDecision(board, piece, placements, chosen, stackHeight) {
    const sortedPlacements = [...placements].sort((a, b) => b.score - a.score);
    const topPlacements = sortedPlacements.slice(0, 5);
    
    const compressedBoard = [];
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x]) {
                compressedBoard.push({ x, y, c: board[y][x] });
            }
        }
    }
    
    gameRecording.decisions.push({
        time: Date.now() - gameRecording.startTime,
        board: compressedBoard,
        piece: { color: piece.color },
        stackHeight,
        top: topPlacements.map(p => ({ x: p.x, y: p.y, r: p.rotationIndex, s: p.score })),
        chosen: { x: chosen.x, y: chosen.y, r: chosen.rotationIndex, s: chosen.score }
    });
}

function recordEvent(type, data) {
    if (gameRecording.startTime) {
        gameRecording.events.push({
            time: Date.now() - gameRecording.startTime,
            type,
            ...data
        });
    }
}

function finalizeRecording(board, cause) {
    const compressedBoard = [];
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x]) {
                compressedBoard.push({ x, y, c: board[y][x] });
            }
        }
    }
    
    gameRecording.finalState = {
        board: compressedBoard,
        cause,
        duration: Date.now() - gameRecording.startTime,
        totalDecisions: gameRecording.decisions.length
    };
    
    return gameRecording;
}

function getRecording() {
    return gameRecording;
}

// ==================== UTILITY FUNCTIONS ====================

function getStackHeight(board, rows) {
    for (let y = 0; y < rows; y++) {
        if (board[y] && board[y].some(cell => cell !== null)) {
            return rows - y;
        }
    }
    return 0;
}

function countHoles(board) {
    let holes = 0;
    const rows = board.length;
    const cols = board[0] ? board[0].length : 10;
    
    for (let x = 0; x < cols; x++) {
        let foundBlock = false;
        for (let y = 0; y < rows; y++) {
            if (board[y] && board[y][x]) {
                foundBlock = true;
            } else if (foundBlock) {
                holes++;
            }
        }
    }
    return holes;
}

function getBumpiness(board) {
    const rows = board.length;
    const cols = board[0] ? board[0].length : 10;
    
    const heights = [];
    for (let x = 0; x < cols; x++) {
        let height = 0;
        for (let y = 0; y < rows; y++) {
            if (board[y] && board[y][x]) {
                height = rows - y;
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

function getColumnHeights(board, cols, rows) {
    const heights = [];
    for (let x = 0; x < cols; x++) {
        let height = 0;
        for (let y = 0; y < rows; y++) {
            if (board[y] && board[y][x]) {
                height = rows - y;
                break;
            }
        }
        heights.push(height);
    }
    return heights;
}

// Count same-color neighbors for the placed piece
function getColorAdjacency(board, shape, x, y, color, cols, rows) {
    let adjacent = 0;
    
    for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
            if (!shape[py][px]) continue;
            
            const boardX = x + px;
            const boardY = y + py;
            
            const neighbors = [
                [boardX - 1, boardY],
                [boardX + 1, boardY],
                [boardX, boardY - 1],
                [boardX, boardY + 1]
            ];
            
            for (const [nx, ny] of neighbors) {
                if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
                
                // Skip if this neighbor is part of the piece being placed
                let isPartOfPiece = false;
                for (let ppy = 0; ppy < shape.length; ppy++) {
                    for (let ppx = 0; ppx < shape[ppy].length; ppx++) {
                        if (shape[ppy][ppx] && x + ppx === nx && y + ppy === ny) {
                            isPartOfPiece = true;
                            break;
                        }
                    }
                    if (isPartOfPiece) break;
                }
                if (isPartOfPiece) continue;
                
                if (board[ny] && board[ny][nx] === color) {
                    adjacent++;
                }
            }
        }
    }
    return adjacent;
}

// Find all connected blobs
function getAllBlobs(board, cols, rows) {
    const visited = Array(rows).fill(null).map(() => Array(cols).fill(false));
    const blobs = [];
    
    function floodFill(startX, startY, color) {
        const positions = [];
        const stack = [[startX, startY]];
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            
            if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
            if (visited[y][x]) continue;
            if (!board[y] || board[y][x] !== color) continue;
            
            visited[y][x] = true;
            positions.push([x, y]);
            
            stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
        }
        
        return positions;
    }
    
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (board[y] && board[y][x] && !visited[y][x]) {
                const color = board[y][x];
                const positions = floodFill(x, y, color);
                if (positions.length > 0) {
                    blobs.push({ color, positions, size: positions.length });
                }
            }
        }
    }
    
    return blobs;
}

// Get blob width info
function getBlobWidth(blob, cols) {
    if (!blob || blob.positions.length === 0) return { width: 0, minX: cols, maxX: 0 };
    
    let minX = cols, maxX = 0;
    for (const [x, y] of blob.positions) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
    }
    
    return { width: maxX - minX + 1, minX, maxX };
}

// ==================== PLACEMENT HELPERS ====================

function dropPiece(board, shape, x, cols, rows) {
    let y = 0;
    while (isValidPosition(board, shape, x, y + 1, cols, rows)) {
        y++;
    }
    return y;
}

function isValidPosition(board, shape, x, y, cols, rows) {
    for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
            if (!shape[py][px]) continue;
            
            const boardX = x + px;
            const boardY = y + py;
            
            if (boardX < 0 || boardX >= cols) return false;
            if (boardY >= rows) return false;
            if (boardY >= 0 && board[boardY] && board[boardY][boardX]) return false;
        }
    }
    return true;
}

function placePiece(board, shape, x, y, color) {
    const newBoard = board.map(row => row ? [...row] : new Array(board[0].length).fill(null));
    
    for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
            if (shape[py][px]) {
                const boardY = y + py;
                const boardX = x + px;
                if (boardY >= 0 && boardY < newBoard.length) {
                    newBoard[boardY][boardX] = color;
                }
            }
        }
    }
    
    return newBoard;
}

function countCompleteLines(board) {
    let count = 0;
    for (const row of board) {
        if (row && row.every(cell => cell !== null)) {
            count++;
        }
    }
    return count;
}

// ==================== SINGLE EVALUATION FUNCTION ====================

function evaluateBoard(board, shape, x, y, color, cols, rows) {
    let score = 0;
    
    const holes = countHoles(board);
    const stackHeight = getStackHeight(board, rows);
    const bumpiness = getBumpiness(board);
    const colHeights = getColumnHeights(board, cols, rows);
    const blobs = getAllBlobs(board, cols, rows);
    
    // ====== SURVIVAL PRIORITIES (always matter) ======
    
    // 1. Holes are devastating - each hole makes the game harder
    score -= holes * 15;
    
    // 2. Height penalty - keep stack low
    score -= stackHeight * 1.0;
    
    // 3. Bumpiness - flat surface is easier to manage
    score -= bumpiness * 0.5;
    
    // 4. Avoid bowl shapes - penalize if edges are much shorter than middle
    const edgeAvg = (colHeights[0] + colHeights[cols - 1]) / 2;
    const middleAvg = (colHeights[4] + colHeights[5]) / 2;
    if (middleAvg > edgeAvg + 4) {
        score -= (middleAvg - edgeAvg - 4) * 3;
    }
    
    // 5. Severe height penalties
    if (stackHeight >= 18) {
        score -= 200;
    } else if (stackHeight >= 16) {
        score -= 50;
    } else if (stackHeight >= 14) {
        score -= 15;
    }
    
    // ====== SCORING PRIORITIES (when not in danger) ======
    
    if (stackHeight <= 14 && holes <= 2) {
        // 6. Same-color adjacency - builds blobs
        const adjacency = getColorAdjacency(board, shape, x, y, color, cols, rows);
        score += adjacency * 1.5;
        
        // 7. Reward large blobs
        for (const blob of blobs) {
            if (blob.size >= 6) {
                score += blob.size * 0.3;
            }
        }
        
        // 8. TSUNAMI SETUP - big bonus for extending wide blobs toward edges
        for (const blob of blobs) {
            if (blob.size >= 12 && blob.color === color) {
                const { minX, maxX, width } = getBlobWidth(blob, cols);
                
                // Already spanning full width? TSUNAMI!
                if (minX === 0 && maxX === cols - 1) {
                    score += 200 + blob.size * 5;
                    continue;
                }
                
                // Check if OUR PIECE is at the edge of this blob
                // (meaning we just extended it toward an edge)
                const pieceMinX = x;
                const pieceMaxX = x + shape[0].length - 1;
                
                // Did we extend to the left edge?
                const extendedLeft = (pieceMinX === 0 && minX === 0 && maxX < cols - 1);
                // Did we extend to the right edge?  
                const extendedRight = (pieceMaxX === cols - 1 && maxX === cols - 1 && minX > 0);
                // Did we extend toward (but not reach) an edge?
                const extendedTowardLeft = (pieceMinX === minX && minX > 0 && minX <= 2);
                const extendedTowardRight = (pieceMaxX === maxX && maxX < cols - 1 && maxX >= cols - 3);
                
                if (extendedLeft || extendedRight || extendedTowardLeft || extendedTowardRight) {
                    // Count matching colors in queue for extra confidence
                    const queueMatches = pieceQueue.filter(p => p && p.color === color).length;
                    const queueBoost = queueMatches >= 2 ? 1.5 : 1.0;
                    
                    // Bonus based on how wide the blob is now
                    const gap = minX + (cols - 1 - maxX);
                    const extensionBonus = (10 - gap) * 20 * queueBoost;
                    score += extensionBonus;
                    
                    // Extra bonus for reaching edge
                    if (extendedLeft || extendedRight) {
                        score += 30;
                    }
                }
            }
            // Non-matching piece near a completable tsunami
            else if (blob.size >= 15 && blob.color !== color) {
                const { minX, maxX, width } = getBlobWidth(blob, cols);
                if (width >= 8) {
                    const queueMatches = pieceQueue.filter(p => p && p.color === blob.color).length;
                    if (queueMatches >= 2) {
                        const pieceMinX = x;
                        const pieceMaxX = x + shape[0].length - 1;
                        
                        // Penalty for blocking extension paths
                        const blocksLeft = minX > 0 && pieceMinX < minX;
                        const blocksRight = maxX < cols - 1 && pieceMaxX > maxX;
                        
                        if (blocksLeft || blocksRight) {
                            score -= 10; // Penalty for blocking
                        } else {
                            score += 3; // Small bonus for staying clear
                        }
                    }
                }
            }
        }
    }
    
    return score;
}

// ==================== PLACEMENT GENERATION ====================

function generatePlacements(board, piece, cols, rows) {
    const placements = [];
    const shape = piece.shape;
    const rotations = piece.rotations || [shape];
    
    for (let rotationIndex = 0; rotationIndex < rotations.length; rotationIndex++) {
        const rotatedShape = rotations[rotationIndex];
        const pieceWidth = rotatedShape[0].length;
        
        for (let x = 0; x <= cols - pieceWidth; x++) {
            const y = dropPiece(board, rotatedShape, x, cols, rows);
            
            if (!isValidPosition(board, rotatedShape, x, y, cols, rows)) continue;
            
            // Game over check
            if (y < 0) {
                placements.push({ x, y, rotationIndex, shape: rotatedShape, score: -10000 });
                continue;
            }
            
            const newBoard = placePiece(board, rotatedShape, x, y, piece.color);
            const score = evaluateBoard(newBoard, rotatedShape, x, y, piece.color, cols, rows);
            
            placements.push({ x, y, rotationIndex, shape: rotatedShape, score });
        }
    }
    
    return placements;
}

function findBestPlacement(board, piece, cols, rows, queue) {
    const placements = generatePlacements(board, piece, cols, rows);
    
    if (placements.length === 0) {
        return null;
    }
    
    let bestPlacement;
    
    // Use queue for 2-ply lookahead if available
    const nextPiece = queue && queue.length > 0 ? queue[0] : null;
    const thirdPiece = queue && queue.length > 1 ? queue[1] : null;
    
    if (nextPiece) {
        // 2-ply lookahead: consider where next piece can go
        for (const placement of placements) {
            const newBoard = placePiece(board, placement.shape, placement.x, placement.y, piece.color);
            const nextPlacements = generatePlacements(newBoard, nextPiece, cols, rows);
            
            if (nextPlacements.length > 0) {
                // Get top 6 next placements to limit computation
                const topNext = nextPlacements.sort((a, b) => b.score - a.score).slice(0, 6);
                
                let bestNextScore = -Infinity;
                
                for (const nextPlacement of topNext) {
                    let nextScore = nextPlacement.score;
                    
                    // 3-ply: look one more piece ahead (lighter weight)
                    if (thirdPiece) {
                        const nextBoard = placePiece(newBoard, nextPlacement.shape, nextPlacement.x, nextPlacement.y, nextPiece.color);
                        const thirdPlacements = generatePlacements(nextBoard, thirdPiece, cols, rows);
                        
                        if (thirdPlacements.length > 0) {
                            const bestThird = thirdPlacements.reduce((a, b) => a.score > b.score ? a : b);
                            nextScore += bestThird.score * 0.3; // 3rd piece counts 30%
                        }
                    }
                    
                    if (nextScore > bestNextScore) {
                        bestNextScore = nextScore;
                    }
                }
                
                // Combined score: current + 50% of best future
                placement.combinedScore = placement.score + bestNextScore * 0.5;
            } else {
                // Can't place next piece = bad
                placement.combinedScore = placement.score - 100;
            }
        }
        
        bestPlacement = placements.reduce((a, b) => 
            (a.combinedScore || a.score) > (b.combinedScore || b.score) ? a : b
        );
    } else {
        // No queue, just pick best immediate score
        bestPlacement = placements.reduce((a, b) => a.score > b.score ? a : b);
    }
    
    // Record decision
    const stackHeight = getStackHeight(board, rows);
    if (gameRecording.startTime) {
        recordDecision(board, piece, placements, bestPlacement, stackHeight);
    }
    
    return bestPlacement;
}

// ==================== MESSAGE HANDLER ====================

self.onmessage = function(e) {
    const { command, board, piece, queue, cols, rows, skillLevel, cause } = e.data;
    
    if (command === 'reset') {
        self.postMessage({ reset: true });
        return;
    }
    
    if (command === 'startRecording') {
        startRecording();
        gameRecording.skillLevel = skillLevel || currentSkillLevel;
        self.postMessage({ recordingStarted: true });
        return;
    }
    
    if (command === 'stopRecording') {
        if (board) {
            const recording = finalizeRecording(board, cause || 'manual_stop');
            self.postMessage({ recordingStopped: true, recording });
        } else {
            self.postMessage({ recordingStopped: true, recording: getRecording() });
        }
        return;
    }
    
    if (command === 'getRecording') {
        self.postMessage({ recording: getRecording() });
        return;
    }
    
    if (command === 'recordEvent') {
        recordEvent(e.data.eventType, e.data.eventData || {});
        return;
    }
    
    currentSkillLevel = skillLevel || 'tempest';
    pieceQueue = queue || [];
    
    setTimeout(() => {
        const bestPlacement = findBestPlacement(board, piece, cols, rows, pieceQueue);
        const stackHeight = getStackHeight(board, rows);
        self.postMessage({ bestPlacement, stackHeight });
    }, 0);
};
