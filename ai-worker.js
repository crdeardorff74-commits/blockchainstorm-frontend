/**
 * AI Worker for TaNTЯiS / BLOCKCHaiNSTORM
 * Runs placement calculations on a separate thread to avoid UI freezes
 */

// Weights for board evaluation - BALANCED: survival + blob building
const weights = {
    aggregateHeight: -0.6,      // Moderate height penalty
    completeLines: 0.8,         // Good reward for clearing lines
    holes: -1.2,                // Strong hole penalty
    bumpiness: -0.2,            // Moderate bumpiness penalty
    colorBlobBonus: 0.6,        // Good blob bonus - this is how we score!
    tsunamiProgress: 0.8,       // Reward for wide blobs
    envelopmentProgress: 0.6,   // Reward for surrounding patterns
    colorAdjacency: 0.4,        // Good reward for same color adjacency
    queueColorSynergy: 0.4,     // Moderate synergy bonus
    maxHeightPenalty: -2.0,     // Strong but not extreme height penalty
    nearDeathPenalty: -8.0,     // Severe penalty when near top
    lineClearUrgency: 3.0,      // Good bonus for clearing when in danger
    perfectClear: 5.0
};

let currentSkillLevel = 'tempest';
let pieceQueue = [];

function cloneBoard(board) {
    return board.map(row => row ? [...row] : new Array(10).fill(null));
}

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
    
    // Danger starts at 40% height, critical at 70%
    const safeHeight = rows * 0.40;
    const criticalHeight = rows * 0.70;
    
    if (maxHeight <= safeHeight) return 0;
    if (maxHeight >= criticalHeight) return 1;
    
    return (maxHeight - safeHeight) / (criticalHeight - safeHeight);
}

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

function getAllRotations(shape) {
    const rotations = [shape];
    let current = shape;
    
    for (let i = 0; i < 3; i++) {
        const rotated = current[0].map((_, colIndex) =>
            current.map(row => row[colIndex]).reverse()
        );
        
        const isDuplicate = rotations.some(existing =>
            existing.length === rotated.length &&
            existing.every((row, y) =>
                row.length === rotated[y].length &&
                row.every((val, x) => val === rotated[y][x])
            )
        );
        
        if (!isDuplicate) {
            rotations.push(rotated);
        }
        current = rotated;
    }
    
    return rotations;
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

function dropPiece(board, shape, x, cols, rows) {
    let y = -shape.length;
    while (isValidPosition(board, shape, x, y + 1, cols, rows)) {
        y++;
    }
    return y;
}

function getAllBlobs(board, cols, rows) {
    const visited = new Set();
    const blobs = [];
    
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            if (!board[y] || !board[y][x]) continue;
            
            const color = board[y][x];
            const blob = { color, positions: [], size: 0 };
            const queue = [[x, y]];
            
            while (queue.length > 0) {
                const [cx, cy] = queue.shift();
                const ckey = `${cx},${cy}`;
                if (visited.has(ckey)) continue;
                if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) continue;
                if (!board[cy] || board[cy][cx] !== color) continue;
                
                visited.add(ckey);
                blob.positions.push([cx, cy]);
                blob.size++;
                
                queue.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]);
            }
            
            if (blob.size > 0) {
                blobs.push(blob);
            }
        }
    }
    
    return blobs;
}

function getColorBlobScore(blobs) {
    let score = 0;
    for (const blob of blobs) {
        if (blob.size >= 4) {
            score += blob.size * blob.size * 0.1;
        }
    }
    return score;
}

function getTsunamiProgress(blobs, cols) {
    let maxProgress = 0;
    for (const blob of blobs) {
        if (blob.size < 4) continue;
        
        let minX = cols, maxX = 0;
        for (const [x, y] of blob.positions) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
        }
        
        const width = maxX - minX + 1;
        const progress = width / cols;
        
        let edgeBonus = 0;
        if (minX === 0) edgeBonus += 0.2;
        if (maxX === cols - 1) edgeBonus += 0.2;
        if (minX === 0 && maxX === cols - 1) edgeBonus += 0.5;
        
        const totalProgress = progress + edgeBonus;
        if (totalProgress > maxProgress) maxProgress = totalProgress;
    }
    return maxProgress;
}

function getEnvelopmentProgress(blobs, cols, rows) {
    if (blobs.length < 2) return 0;
    
    let maxProgress = 0;
    for (let i = 0; i < blobs.length; i++) {
        for (let j = 0; j < blobs.length; j++) {
            if (i === j) continue;
            if (blobs[i].color === blobs[j].color) continue;
            
            const inner = blobs[i];
            const outer = blobs[j];
            
            if (inner.size < 4 || outer.size < 4) continue;
            
            let adjacentCount = 0;
            const outerSet = new Set(outer.positions.map(p => `${p[0]},${p[1]}`));
            
            for (const [x, y] of inner.positions) {
                const neighbors = [[x-1,y], [x+1,y], [x,y-1], [x,y+1]];
                for (const [nx, ny] of neighbors) {
                    if (outerSet.has(`${nx},${ny}`)) {
                        adjacentCount++;
                    }
                }
            }
            
            const progress = adjacentCount / (inner.size * 2);
            if (progress > maxProgress) maxProgress = progress;
        }
    }
    return maxProgress;
}

function getColorAdjacencyBonus(board, shape, x, y, color, cols, rows) {
    let adjacentSameColor = 0;
    
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

function getQueueColorCounts() {
    const colorCounts = {};
    if (!pieceQueue || pieceQueue.length === 0) return colorCounts;
    
    for (const piece of pieceQueue) {
        if (piece && piece.color) {
            colorCounts[piece.color] = (colorCounts[piece.color] || 0) + 1;
        }
    }
    return colorCounts;
}

function getQueueColorSynergy(blobs, placementColor) {
    if (!pieceQueue || pieceQueue.length === 0) return 0;
    if (!blobs || blobs.length === 0) return 0;
    
    try {
        const colorCounts = getQueueColorCounts();
        let synergyScore = 0;
        
        const upcomingMatches = colorCounts[placementColor] || 0;
        synergyScore += upcomingMatches * 0.3;
        
        for (const blob of blobs) {
            if (!blob || !blob.positions || blob.positions.length === 0) continue;
            
            const blobUpcoming = colorCounts[blob.color] || 0;
            if (blobUpcoming > 0 && blob.size > 0) {
                synergyScore += Math.min(blob.size * blobUpcoming * 0.05, 2.0);
            }
        }
        
        return synergyScore;
    } catch (e) {
        return 0;
    }
}

function countCompleteLines(board) {
    let count = 0;
    for (let y = 0; y < board.length; y++) {
        if (board[y] && board[y].every(cell => cell !== null)) {
            count++;
        }
    }
    return count;
}

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

function isPerfectClear(board) {
    return board.every(row => !row || row.every(cell => cell === null));
}

function removeCompleteLines(board) {
    const newBoard = board.filter(row => !row || !row.every(cell => cell !== null));
    const linesRemoved = board.length - newBoard.length;
    for (let i = 0; i < linesRemoved; i++) {
        newBoard.unshift(new Array(board[0].length).fill(null));
    }
    return newBoard;
}

function evaluateBoard(board, shape, x, y, color, cols, rows, linesCleared) {
    const blobs = getAllBlobs(board, cols, rows);
    const maxHeight = getMaxHeight(board, rows);
    const dangerLevel = getDangerLevel(board, rows);
    
    let score = 0;
    
    // Height penalty scales with danger
    const heightPenalty = weights.maxHeightPenalty * maxHeight * (1 + dangerLevel * 2);
    score += heightPenalty;
    
    // Near-death penalty (top 5 rows)
    if (maxHeight >= rows - 5) {
        score += weights.nearDeathPenalty * (maxHeight - (rows - 5));
    }
    
    // Holes are bad, worse when in danger
    score += weights.holes * countHoles(board) * (1 + dangerLevel * 1.5);
    score += weights.bumpiness * getBumpiness(board);
    score += weights.aggregateHeight * getAggregateHeight(board);
    
    // Line clears are valuable, more so when in danger
    const lineClearBonus = linesCleared * linesCleared * weights.completeLines;
    const urgencyMultiplier = 1 + (dangerLevel * weights.lineClearUrgency);
    score += lineClearBonus * urgencyMultiplier;
    
    // Safety factor - gradually reduce blob focus as danger increases
    const safetyFactor = Math.max(0, 1 - (dangerLevel * 0.9));
    
    // Consider blob strategies when reasonably safe (safetyFactor > 0.2)
    if (safetyFactor > 0.2) {
        score += weights.colorBlobBonus * getColorBlobScore(blobs) * safetyFactor;
        score += weights.colorAdjacency * getColorAdjacencyBonus(board, shape, x, y, color, cols, rows) * safetyFactor;
        
        if (pieceQueue && pieceQueue.length > 0) {
            const synergy = getQueueColorSynergy(blobs, color);
            if (typeof synergy === 'number' && !isNaN(synergy)) {
                score += weights.queueColorSynergy * synergy * safetyFactor;
            }
        }
        
        // Pursue special formations when safe (dangerLevel < 0.5)
        if (currentSkillLevel !== 'breeze' && dangerLevel < 0.5) {
            score += weights.tsunamiProgress * getTsunamiProgress(blobs, cols) * safetyFactor;
            score += weights.envelopmentProgress * getEnvelopmentProgress(blobs, cols, rows) * safetyFactor;
        }
    }
    
    if (isPerfectClear(board)) {
        score += weights.perfectClear;
    }
    
    if (typeof score !== 'number' || isNaN(score)) {
        return 0;
    }
    
    return score;
}

function generatePlacements(board, piece, cols, rows) {
    const placements = [];
    const rotations = getAllRotations(piece.shape);
    
    for (let rotationIndex = 0; rotationIndex < rotations.length; rotationIndex++) {
        const shape = rotations[rotationIndex];
        
        for (let x = -2; x < cols + 2; x++) {
            if (!isValidPosition(board, shape, x, -shape.length, cols, rows) &&
                !isValidPosition(board, shape, x, 0, cols, rows)) {
                continue;
            }
            
            const y = dropPiece(board, shape, x, cols, rows);
            
            if (!isValidPosition(board, shape, x, y, cols, rows)) continue;
            
            const newBoard = placePiece(board, shape, x, y, piece.color);
            const linesBefore = countCompleteLines(board);
            const linesAfter = countCompleteLines(newBoard);
            const linesCleared = linesAfter - linesBefore;
            
            const clearedBoard = removeCompleteLines(newBoard);
            const score = evaluateBoard(clearedBoard, shape, x, y, piece.color, cols, rows, linesCleared);
            
            placements.push({
                x, y, rotationIndex, shape, score
            });
        }
    }
    
    return placements;
}

function findBestPlacement(board, piece, cols, rows, nextPiece) {
    const placements = generatePlacements(board, piece, cols, rows);
    
    if (placements.length === 0) {
        return null;
    }
    
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

// Handle messages from main thread
self.onmessage = function(e) {
    const { board, piece, queue, cols, rows, skillLevel } = e.data;
    
    currentSkillLevel = skillLevel || 'tempest';
    pieceQueue = queue || [];
    
    const nextPiece = pieceQueue.length > 0 ? pieceQueue[0] : null;
    const bestPlacement = findBestPlacement(board, piece, cols, rows, nextPiece);
    
    self.postMessage({ bestPlacement });
};
