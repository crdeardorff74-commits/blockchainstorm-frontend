// AI Worker v2.2 - Fixed bowl-stacking issue - Queue-aware tsunami/blackhole evaluation (2026-01-13)
/**
 * AI Worker for TaNTЯiS / BLOCKCHaiNSTORM
 * Runs placement calculations on a separate thread to avoid UI freezes
 * 
 * Two-mode strategy:
 * 1) Color Building - Build large blobs, set up Tsunamis/Black Holes, avoid clearing lines
 * 2) Survival - Clear lines and reduce stack height
 * 
 * Mode switching based on stack height with hysteresis
 */

let currentSkillLevel = 'tempest';
let pieceQueue = [];
let currentMode = 'colorBuilding'; // 'colorBuilding' or 'survival'
let lastStackHeight = 0; // Track stack height for debugging

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

function recordDecision(board, piece, placements, chosen, mode, stackHeight) {
    // Only record top 5 and bottom 2 placements to keep size manageable
    const sortedPlacements = [...placements].sort((a, b) => b.score - a.score);
    const topPlacements = sortedPlacements.slice(0, 5);
    const bottomPlacements = sortedPlacements.slice(-2);
    
    // Compress board to just occupied cells for smaller file size
    const compressedBoard = [];
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x]) {
                compressedBoard.push({ x, y, c: board[y][x] });
            }
        }
    }
    
    gameRecording.decisions.push({
        t: Date.now() - gameRecording.startTime, // Time offset
        mode,
        stackHeight,
        piece: { shape: piece.shape, color: piece.color },
        board: compressedBoard,
        top: topPlacements.map(p => ({ x: p.x, y: p.y, r: p.rotationIndex, s: Math.round(p.score * 100) / 100 })),
        bottom: bottomPlacements.map(p => ({ x: p.x, y: p.y, r: p.rotationIndex, s: Math.round(p.score * 100) / 100 })),
        chosen: { x: chosen.x, y: chosen.y, r: chosen.rotationIndex, s: Math.round(chosen.score * 100) / 100 }
    });
}

function recordEvent(type, data) {
    gameRecording.events.push({
        t: Date.now() - (gameRecording.startTime || Date.now()),
        type,
        ...data
    });
}

function finalizeRecording(board, cause) {
    // Compress final board state
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
        stackHeight: lastStackHeight,
        mode: currentMode,
        totalDecisions: gameRecording.decisions.length,
        duration: Date.now() - gameRecording.startTime
    };
    
    return gameRecording;
}

function getRecording() {
    return gameRecording;
}

// Row thresholds for mode switching (rows from bottom, 1-indexed)
// Upper = switch to survival, Lower = switch back to color building
const modeThresholds = {
    breeze: { upper: 12, lower: 6 },
    tempest: { upper: 12, lower: 6 },
    maelstrom: { upper: 10, lower: 5 },
    hurricane: { upper: 10, lower: 5 }
};

function cloneBoard(board) {
    return board.map(row => row ? [...row] : new Array(10).fill(null));
}

/**
 * Get the height of the tallest column (from bottom, 1-indexed)
 * Row 1 is the bottom row
 */
function getStackHeight(board, rows) {
    if (!board || board.length === 0) {
        console.log('🔍 getStackHeight: board is empty or null');
        return 0;
    }
    
    // Find the topmost row that has any blocks
    for (let y = 0; y < board.length; y++) {
        const row = board[y];
        if (row && Array.isArray(row)) {
            for (let x = 0; x < row.length; x++) {
                if (row[x] !== null && row[x] !== undefined) {
                    // Found a block - height is from this row to bottom
                    const height = board.length - y;
                    console.log(`🔍 getStackHeight: Found block at y=${y}, height=${height}, rows=${rows}, board.length=${board.length}`);
                    return height;
                }
            }
        }
    }
    console.log('🔍 getStackHeight: No blocks found, returning 0');
    return 0;
}

/**
 * Update mode based on stack height
 */
function updateMode(board, rows) {
    const stackHeight = getStackHeight(board, rows);
    const thresholds = modeThresholds[currentSkillLevel] || modeThresholds.tempest;
    
    // Store for debugging
    lastStackHeight = stackHeight;
    
    if (currentMode === 'colorBuilding' && stackHeight >= thresholds.upper) {
        currentMode = 'survival';
    } else if (currentMode === 'survival' && stackHeight <= thresholds.lower) {
        currentMode = 'colorBuilding';
    }
    
    return currentMode;
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

function countCompleteLines(board) {
    let count = 0;
    for (let y = 0; y < board.length; y++) {
        if (board[y] && board[y].every(cell => cell !== null)) {
            count++;
        }
    }
    return count;
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

/**
 * Count deep wells (single-column gaps that are hard to fill)
 * A well is a column significantly lower than both neighbors
 * Also detects "canyon" patterns where a column is empty while neighbors are full deep down
 */
function countWells(board) {
    const rows = board.length;
    const cols = board[0].length;
    const heights = [];
    
    // Get column heights (from top)
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
    
    let wellScore = 0;
    
    for (let x = 0; x < cols; x++) {
        const leftHeight = x > 0 ? heights[x - 1] : 999;
        const rightHeight = x < cols - 1 ? heights[x + 1] : 999;
        const currentHeight = heights[x];
        
        // Basic well: current column is lower than both neighbors
        const wellDepth = Math.min(leftHeight, rightHeight) - currentHeight;
        if (wellDepth > 0) {
            // Penalize deeper wells MUCH more heavily (cubic for deep wells)
            if (wellDepth >= 4) {
                wellScore += wellDepth * wellDepth * wellDepth * 0.5; // Cubic for deep
            } else {
                wellScore += wellDepth * wellDepth; // Quadratic for shallow
            }
        }
        
        // Also check for "canyon" - column is empty while surrounded by blocks
        // Count how many cells in this column are empty while having blocks on both sides
        let canyonDepth = 0;
        for (let y = 0; y < rows; y++) {
            const isEmpty = !board[y] || !board[y][x];
            const hasLeftNeighbor = x > 0 && board[y] && board[y][x - 1];
            const hasRightNeighbor = x < cols - 1 && board[y] && board[y][x + 1];
            
            if (isEmpty && hasLeftNeighbor && hasRightNeighbor) {
                canyonDepth++;
            }
        }
        
        // Canyon penalty (very hard to fill narrow gaps with blocks on both sides)
        if (canyonDepth >= 2) {
            wellScore += canyonDepth * canyonDepth * 2;
        }
    }
    
    return wellScore;
}

/**
 * Get horizontal spread bonus for blobs (reward wide blobs over tall narrow ones)
 */
function getBlobSpreadBonus(blobs, cols) {
    let spreadBonus = 0;
    
    for (const blob of blobs) {
        if (blob.size < 4) continue;
        
        const { width, minX, maxX } = getBlobWidth(blob, cols);
        
        // Calculate blob height
        let minY = Infinity, maxY = -Infinity;
        for (const [x, y] of blob.positions) {
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        const height = maxY - minY + 1;
        
        // Reward width-to-height ratio (wider is better for tsunamis)
        if (height > 0) {
            const ratio = width / height;
            spreadBonus += ratio * blob.size * 0.1;
        }
        
        // Extra bonus for blobs touching edges (good tsunami setup)
        if (minX === 0 || maxX === cols - 1) {
            spreadBonus += blob.size * 0.05;
        }
    }
    
    return spreadBonus;
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

function removeCompleteLines(board) {
    const newBoard = board.filter(row => !row || !row.every(cell => cell !== null));
    const linesRemoved = board.length - newBoard.length;
    for (let i = 0; i < linesRemoved; i++) {
        newBoard.unshift(new Array(board[0].length).fill(null));
    }
    return newBoard;
}

/**
 * Get blob width and edge info for Tsunami progress
 */
function getBlobWidth(blob, cols) {
    if (!blob || blob.positions.length === 0) return { width: 0, minX: cols, maxX: 0 };
    
    let minX = cols, maxX = 0;
    for (const [x, y] of blob.positions) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
    }
    
    return { width: maxX - minX + 1, minX, maxX };
}

/**
 * Check how close a blob is to being a Tsunami (spanning full width)
 */
function getTsunamiProgress(blob, cols) {
    if (!blob || blob.size < 4) return 0;
    
    const { width, minX, maxX } = getBlobWidth(blob, cols);
    
    // Full width = tsunami!
    if (minX === 0 && maxX === cols - 1) return 10; // Massive bonus
    
    // Near-complete tsunamis get exponentially higher bonuses
    const progress = width / cols;
    
    // Bonus for touching edges
    let edgeBonus = 0;
    if (minX === 0) edgeBonus += 0.5;
    if (maxX === cols - 1) edgeBonus += 0.5;
    
    // Exponential bonus for near-completion (width 8+ is very valuable)
    let nearCompletionBonus = 0;
    if (width >= 9) {
        nearCompletionBonus = 5; // Only need 1 column!
    } else if (width >= 8) {
        nearCompletionBonus = 2; // Need 2 columns
    } else if (width >= 7) {
        nearCompletionBonus = 1;
    }
    
    // Size matters too - bigger blobs = more points when completed
    const sizeBonus = blob.size >= 20 ? 2 : (blob.size >= 10 ? 1 : 0);
    
    return progress + edgeBonus + nearCompletionBonus + sizeBonus;
}

/**
 * Check if queue colors could help complete a Tsunami for a blob
 */
function canCompleteTsunamiWithQueue(blob, cols) {
    if (!blob || blob.size < 4) return { canComplete: false, score: 0 };
    if (!pieceQueue || pieceQueue.length === 0) return { canComplete: false, score: 0 };
    
    const { width, minX, maxX } = getBlobWidth(blob, cols);
    
    // Already full width - immediate tsunami!
    if (minX === 0 && maxX === cols - 1) return { canComplete: true, score: 20 };
    
    // Count matching colors in queue
    const matchingPieces = pieceQueue.filter(p => p && p.color === blob.color).length;
    
    // Calculate gaps on each side
    const gapLeft = minX;
    const gapRight = cols - 1 - maxX;
    const totalGap = gapLeft + gapRight;
    
    // Each piece has ~4 blocks, but only some will extend the blob
    // Be more generous in estimation
    const potentialCoverage = matchingPieces * 3;
    
    if (potentialCoverage >= totalGap || totalGap <= 2) {
        // Can likely complete! Score based on how close we are
        let completionScore = 5; // Base score for completable tsunami
        
        // Bonus for being very close (only 1-2 columns needed)
        if (totalGap === 1) completionScore += 10;
        else if (totalGap === 2) completionScore += 5;
        
        // Bonus for blob size (bigger = more points when cleared)
        completionScore += Math.min(blob.size / 5, 4);
        
        // Bonus for matching pieces in queue
        completionScore += matchingPieces * 2;
        
        return { canComplete: true, score: completionScore };
    }
    
    // Not immediately completable but still valuable progress
    return { canComplete: false, score: matchingPieces * 0.5 + (width / cols) };
}

/**
 * Check for potential Black Hole setup (blob surrounded by another color)
 * Returns progress toward completion and whether queue can help complete it
 */
function getBlackHoleProgress(blobs, cols, rows) {
    if (blobs.length < 2) return { progress: 0, canComplete: false, bonus: 0 };
    
    let maxProgress = 0;
    let bestCanComplete = false;
    let bestBonus = 0;
    
    for (let i = 0; i < blobs.length; i++) {
        for (let j = 0; j < blobs.length; j++) {
            if (i === j) continue;
            if (blobs[i].color === blobs[j].color) continue;
            
            const inner = blobs[i];
            const outer = blobs[j];
            
            // Inner blob needs to be decent size for points, outer needs to be bigger
            if (inner.size < 4 || outer.size < 8) continue;
            
            // Count how many sides of inner are adjacent to outer
            let adjacentCount = 0;
            const outerSet = new Set(outer.positions.map(p => `${p[0]},${p[1]}`));
            
            // Also track which sides of inner are NOT adjacent (gaps to fill)
            let gapCount = 0;
            
            for (const [x, y] of inner.positions) {
                const neighbors = [[x-1,y], [x+1,y], [x,y-1], [x,y+1]];
                for (const [nx, ny] of neighbors) {
                    // Skip if neighbor is part of inner blob
                    if (inner.positions.some(p => p[0] === nx && p[1] === ny)) continue;
                    
                    if (outerSet.has(`${nx},${ny}`)) {
                        adjacentCount++;
                    } else if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                        gapCount++;
                    }
                }
            }
            
            // Progress based on how surrounded the inner blob is
            const totalPerimeter = adjacentCount + gapCount;
            if (totalPerimeter === 0) continue;
            
            const progress = adjacentCount / totalPerimeter;
            
            // Check queue for both inner and outer colors
            const outerInQueue = pieceQueue ? pieceQueue.filter(p => p && p.color === outer.color).length : 0;
            const innerInQueue = pieceQueue ? pieceQueue.filter(p => p && p.color === inner.color).length : 0;
            
            // Can complete if:
            // - Already >60% surrounded, OR
            // - >40% surrounded with 2+ outer colors in queue
            const canComplete = progress > 0.6 || (progress > 0.4 && outerInQueue >= 2);
            
            // Calculate bonus based on:
            // - Progress toward completion
            // - Size of blobs (bigger = more points)
            // - Queue support
            let bonus = progress * 5;
            
            if (canComplete) {
                // Bigger bonus when completion is likely
                bonus += 10;
                bonus += outerInQueue * 3;
                bonus += (inner.size + outer.size) * 0.2;
            }
            
            // Extra bonus if inner blob could grow (we have inner colors in queue)
            // Growing inner blob before triggering = more points!
            if (progress < 0.8 && innerInQueue >= 1) {
                bonus += innerInQueue * 2;
            }
            
            if (progress > maxProgress || (progress === maxProgress && bonus > bestBonus)) {
                maxProgress = progress;
                bestCanComplete = canComplete;
                bestBonus = bonus;
            }
        }
    }
    
    return { progress: maxProgress, canComplete: bestCanComplete, bonus: bestBonus };
}

/**
 * Get color adjacency bonus for a placement
 */
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

/**
 * Count matching colors in the piece queue
 */
function getQueueColorCount(color) {
    if (!pieceQueue || pieceQueue.length === 0) return 0;
    return pieceQueue.filter(p => p && p.color === color).length;
}

// ==================== COLOR BUILDING MODE ====================

function evaluateColorBuilding(board, shape, x, y, color, cols, rows, linesCleared) {
    const blobs = getAllBlobs(board, cols, rows);
    const stackHeight = getStackHeight(board, rows);
    const thresholds = modeThresholds[currentSkillLevel] || modeThresholds.tempest;
    
    // FIRST: Check if this placement completes a tsunami!
    // This should override almost all other considerations
    for (const blob of blobs) {
        if (blob.size >= 10) { // Minimum size for tsunami
            const { minX, maxX } = getBlobWidth(blob, cols);
            if (minX === 0 && maxX === cols - 1) {
                // TSUNAMI! Give massive bonus based on blob size
                // Tsunami scoring is size³ × 200, so a 20-block tsunami = 8000 × 200 = 1.6M base
                const tsunamiBonus = 100 + blob.size * 5;
                return tsunamiBonus; // Return immediately with high score
            }
        }
    }
    
    let score = 0;
    
    // Calculate how safe we are (0 = at threshold, 1 = very safe)
    const headroom = thresholds.upper - stackHeight;
    const safetyRatio = Math.max(0, Math.min(1, headroom / thresholds.upper));
    
    // Line clear handling - context dependent:
    // When safe (low stack): penalize clears to build blobs
    // When stack is high: reward clears to stay alive
    if (headroom > 8) {
        // Very safe - penalize line clears to focus on blob building
        score -= linesCleared * 3;
    } else if (headroom > 4) {
        // Getting higher - neutral on line clears
        // Don't penalize or reward
    } else {
        // Approaching danger - reward line clears
        score += linesCleared * 2;
    }
    
    // === Check for Tsunami/Black Hole opportunities with queue ===
    let bestTsunamiScore = 0;
    let hasTsunamiPath = false;
    let nearTsunamiBonus = 0;
    let bestTsunamiBlob = null;
    
    for (const blob of blobs) {
        if (blob.size >= 4) {
            const tsunamiResult = canCompleteTsunamiWithQueue(blob, cols);
            if (tsunamiResult.canComplete) {
                hasTsunamiPath = true;
                if (tsunamiResult.score > bestTsunamiScore) {
                    bestTsunamiScore = tsunamiResult.score;
                }
            }
            
            // Reward for tsunami progress on this blob
            const progress = getTsunamiProgress(blob, cols);
            score += progress * 3; // Increased multiplier
            
            // Track best tsunami candidate for extension bonus
            const { width, minX, maxX } = getBlobWidth(blob, cols);
            const gap = (minX > 0 ? minX : 0) + (maxX < cols - 1 ? cols - 1 - maxX : 0);
            
            if (blob.size >= 12 && width >= 6 && gap <= 4) {
                if (!bestTsunamiBlob || blob.size > bestTsunamiBlob.size) {
                    bestTsunamiBlob = { ...blob, width, minX, maxX, gap };
                }
            }
            
            // Extra bonus for near-completion (width 8 or 9)
            if (width >= 9 && blob.size >= 15) {
                nearTsunamiBonus = Math.max(nearTsunamiBonus, 30);
            } else if (width >= 8 && blob.size >= 12) {
                nearTsunamiBonus = Math.max(nearTsunamiBonus, 15);
            }
        }
    }
    
    score += nearTsunamiBonus;
    
    // TSUNAMI EXTENSION BONUS - reward placing pieces toward the gap!
    if (bestTsunamiBlob && color === bestTsunamiBlob.color) {
        const pieceMinX = x;
        const pieceMaxX = x + shape[0].length - 1;
        
        // Check if piece connects to the blob
        let connectsToBlob = false;
        if (pieceMaxX >= bestTsunamiBlob.minX - 1 && pieceMinX <= bestTsunamiBlob.maxX + 1) {
            const adj = getColorAdjacency(board, shape, x, y, color, cols, rows);
            if (adj > 0) {
                connectsToBlob = true;
            }
        }
        
        if (connectsToBlob) {
            // Count matching colors in queue for boost
            const queueMatches = pieceQueue ? pieceQueue.filter(p => p && p.color === bestTsunamiBlob.color).length : 0;
            const queueBoost = queueMatches >= 2 ? 1.5 : 1.0;
            
            const gapMultiplier = (5 - bestTsunamiBlob.gap) * 15 * queueBoost;
            
            let extensionBonus = 0;
            
            if (bestTsunamiBlob.minX > 0 && pieceMinX < bestTsunamiBlob.minX) {
                extensionBonus += gapMultiplier;
                if (pieceMinX === 0) extensionBonus += 40;
            }
            if (bestTsunamiBlob.maxX < cols - 1 && pieceMaxX > bestTsunamiBlob.maxX) {
                extensionBonus += gapMultiplier;
                if (pieceMaxX === cols - 1) extensionBonus += 40;
            }
            
            // Gap=1 completion bonus
            if (bestTsunamiBlob.gap === 1) {
                if (bestTsunamiBlob.minX > 0 && pieceMinX === 0) extensionBonus += 150;
                if (bestTsunamiBlob.maxX < cols - 1 && pieceMaxX === cols - 1) extensionBonus += 150;
            }
            
            score += extensionBonus;
        }
    }
    
    // Black hole progress - use the calculated bonus
    const blackHoleResult = getBlackHoleProgress(blobs, cols, rows);
    score += blackHoleResult.bonus;
    
    // If we have a path to Tsunami, give extra bonus for placements that help it
    if (hasTsunamiPath) {
        score += bestTsunamiScore * 2;
    }
    
    // Reward larger blobs (this is how we score points!)
    for (const blob of blobs) {
        if (blob.size >= 4) {
            // Quadratic bonus for blob size
            score += blob.size * blob.size * 0.1;
        }
    }
    
    // Reward horizontal blob spread (wider blobs are better for tsunamis)
    score += getBlobSpreadBonus(blobs, cols);
    
    // Color adjacency - reward placing next to same color
    score += getColorAdjacency(board, shape, x, y, color, cols, rows) * 0.6;
    
    // Bonus for placing colors that have more in queue (can keep building)
    const queueMatches = getQueueColorCount(color);
    score += queueMatches * 0.4;
    
    // Hole penalty - increases as stack gets higher (holes become more dangerous)
    const holePenaltyMultiplier = 0.8 + (1 - safetyRatio) * 1.5; // 0.8 to 2.3
    score -= countHoles(board) * holePenaltyMultiplier;
    
    // Bumpiness penalty - increases as stack gets higher
    const bumpinessPenaltyMultiplier = 0.3 + (1 - safetyRatio) * 0.4; // 0.3 to 0.7
    score -= getBumpiness(board) * bumpinessPenaltyMultiplier;
    
    // Well penalty - strongly discourage single-column gaps, especially when stack is high
    const wellPenaltyMultiplier = 0.5 + (1 - safetyRatio) * 1.0; // 0.5 to 1.5
    score -= countWells(board) * wellPenaltyMultiplier;
    
    // Graduated danger penalty - kicks in earlier and scales smoothly
    if (headroom < 8) {
        // Penalty that increases as we approach danger
        const dangerLevel = (8 - headroom) / 8; // 0 to 1
        score -= dangerLevel * dangerLevel * 15; // 0 to 15 points penalty
    }
    
    // Stack height penalty - always have some awareness of height
    score -= stackHeight * 0.2;
    
    if (typeof score !== 'number' || isNaN(score)) return 0;
    return score;
}

// ==================== SURVIVAL MODE ====================

function evaluateSurvival(board, shape, x, y, color, cols, rows, linesCleared) {
    const blobs = getAllBlobs(board, cols, rows);
    const stackHeight = getStackHeight(board, rows);
    const thresholds = modeThresholds[currentSkillLevel] || modeThresholds.tempest;
    
    // FIRST: Check if this placement completes a tsunami!
    // Even in survival, completing a tsunami is a big win (clears lots of blocks)
    for (const blob of blobs) {
        if (blob.size >= 10) {
            const { minX, maxX } = getBlobWidth(blob, cols);
            if (minX === 0 && maxX === cols - 1) {
                // TSUNAMI! This will clear a lot of blocks and save us
                const tsunamiBonus = 80 + blob.size * 4;
                return tsunamiBonus;
            }
        }
    }
    
    let score = 0;
    
    // === Check for near-Tsunami opportunities ===
    let bestTsunamiScore = 0;
    let nearTsunamiBonus = 0;
    let bestTsunamiBlob = null;
    
    for (const blob of blobs) {
        if (blob.size >= 4) {
            const tsunamiResult = canCompleteTsunamiWithQueue(blob, cols);
            if (tsunamiResult.canComplete && tsunamiResult.score > bestTsunamiScore) {
                bestTsunamiScore = tsunamiResult.score;
            }
            
            // Check for near-completion
            const { width, minX, maxX } = getBlobWidth(blob, cols);
            const gap = (minX > 0 ? minX : 0) + (maxX < cols - 1 ? cols - 1 - maxX : 0);
            const progress = getTsunamiProgress(blob, cols);
            
            // Track best tsunami candidate for extension bonus
            if (blob.size >= 12 && width >= 6 && gap <= 4) {
                if (!bestTsunamiBlob || blob.size > bestTsunamiBlob.size) {
                    bestTsunamiBlob = { ...blob, width, minX, maxX, gap };
                }
            }
            
            if (width >= 9 && blob.size >= 15) {
                nearTsunamiBonus = Math.max(nearTsunamiBonus, 25);
            } else if (width >= 8 && blob.size >= 12) {
                nearTsunamiBonus = Math.max(nearTsunamiBonus, 12);
            }
            
            if (progress >= 1.0) {
                score += progress * 5;
            }
        }
    }
    
    // TSUNAMI EXTENSION BONUS - critical for actually completing tsunamis!
    if (bestTsunamiBlob && color === bestTsunamiBlob.color) {
        const pieceMinX = x;
        const pieceMaxX = x + shape[0].length - 1;
        
        // Check if piece connects to the blob
        let connectsToBlob = false;
        if (pieceMaxX >= bestTsunamiBlob.minX - 1 && pieceMinX <= bestTsunamiBlob.maxX + 1) {
            const adj = getColorAdjacency(board, shape, x, y, color, cols, rows);
            if (adj > 0) {
                connectsToBlob = true;
            }
        }
        
        if (connectsToBlob) {
            // In survival, completing a tsunami is EXTREMELY valuable - it clears lots of blocks!
            const gapMultiplier = (5 - bestTsunamiBlob.gap) * 20; // gap=1: 80, gap=2: 60, gap=3: 40, gap=4: 20
            
            let extensionBonus = 0;
            
            if (bestTsunamiBlob.minX > 0 && pieceMinX < bestTsunamiBlob.minX) {
                extensionBonus += gapMultiplier;
                if (pieceMinX === 0) extensionBonus += 50;
            }
            if (bestTsunamiBlob.maxX < cols - 1 && pieceMaxX > bestTsunamiBlob.maxX) {
                extensionBonus += gapMultiplier;
                if (pieceMaxX === cols - 1) extensionBonus += 50;
            }
            
            // Gap=1 completion is HUGE in survival - this clears massive amounts
            if (bestTsunamiBlob.gap === 1) {
                if (bestTsunamiBlob.minX > 0 && pieceMinX === 0) extensionBonus += 200;
                if (bestTsunamiBlob.maxX < cols - 1 && pieceMaxX === cols - 1) extensionBonus += 200;
            }
            
            score += extensionBonus;
        }
    }
    
    // If there's a clear path to Tsunami, prioritize it even in survival
    if (bestTsunamiScore > 0) {
        score += bestTsunamiScore * 3;
        score += getColorAdjacency(board, shape, x, y, color, cols, rows) * 0.5;
    }
    
    score += nearTsunamiBonus;
    
    // === Normal survival logic ===
    
    // STRONGLY reward line clears
    score += linesCleared * linesCleared * 4;
    
    // Reward lower stack height
    score -= stackHeight * 0.8;
    
    // CRITICAL: Massive penalty for placements that would end the game or get very close
    // The board has 20 rows, pieces spawn at top - if stack is 18+, we're in extreme danger
    if (stackHeight >= 19) {
        score -= 1000; // Near-certain death
    } else if (stackHeight >= 18) {
        score -= 200; // Extreme danger
    } else if (stackHeight >= 17) {
        score -= 50; // High danger
    }
    
    // Strong hole penalty
    score -= countHoles(board) * 2.5;
    
    // Bumpiness penalty
    score -= getBumpiness(board) * 0.4;
    
    // Well penalty - avoid single-column gaps
    score -= countWells(board) * 0.5;
    
    // Aggregate height penalty
    score -= getAggregateHeight(board) * 0.15;
    
    // Still give small bonus for color adjacency (helps future blob building)
    if (bestTsunamiScore === 0) {
        score += getColorAdjacency(board, shape, x, y, color, cols, rows) * 0.15;
    }
    
    // Urgency bonus - more reward for clearing when stack is high
    const urgency = Math.max(0, stackHeight - thresholds.lower) / (thresholds.upper - thresholds.lower);
    score += linesCleared * urgency * 3;
    
    if (typeof score !== 'number' || isNaN(score)) return 0;
    return score;
}

// ==================== UNIFIED EVALUATION ====================
// SURVIVAL FIRST: Never compromise basic board health for color bonuses

function evaluateBoard(board, shape, x, y, color, cols, rows, linesCleared) {
    const blobs = getAllBlobs(board, cols, rows);
    const stackHeight = getStackHeight(board, rows);
    const holes = countHoles(board);
    const wells = countWells(board);
    const bumpiness = getBumpiness(board);
    
    let score = 0;
    
    // ========================================
    // PHASE 1: SURVIVAL (always applies, non-negotiable)
    // ========================================
    
    // Holes are DEVASTATING - each hole makes line clears harder
    score -= holes * 10;
    
    // Deep wells/canyons are almost as bad as holes
    score -= wells * 3;
    
    // Height penalty - keep the stack low
    score -= stackHeight * 0.8;
    
    // Bumpiness makes it hard to clear lines
    score -= bumpiness * 0.5;
    
    // LINE CLEARS: Context-dependent handling
    // When safe: PENALIZE clears to build blobs for tsunamis
    // When in danger: REWARD clears to survive
    const headroom = 20 - stackHeight;
    if (headroom > 10) {
        // Very safe (stack <= 9) - penalize line clears to focus on blob building
        score -= linesCleared * linesCleared * 3;
    } else if (headroom > 6) {
        // Moderately safe (stack 10-13) - slight penalty for clearing
        score -= linesCleared * 2;
    } else if (headroom > 3) {
        // Getting dangerous (stack 14-16) - small reward for clearing
        score += linesCleared * linesCleared * 2;
    } else {
        // Critical danger (stack 17+) - big reward for clearing
        score += linesCleared * linesCleared * 8;
    }
    
    // COMPACTNESS BONUS: Small reward for touching existing blocks
    // Reduced from 1.5 to 0.5 to prevent middle-stacking
    const touchingExisting = countTouchingCells(board, shape, x, y, cols, rows);
    score += touchingExisting * 0.5;
    
    // COLUMN BALANCE: Penalize placing in already-tall columns when short columns exist
    // This prevents bowl-shaped boards
    const colHeights = [];
    for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
            if (board[cy][cx] !== null) {
                colHeights.push(rows - cy);
                break;
            }
            if (cy === rows - 1) colHeights.push(0);
        }
    }
    
    // Find the column(s) this piece occupies
    const pieceMinX = x;
    const pieceMaxX = x + shape[0].length - 1;
    
    // Get the height of the tallest column this piece occupies
    let pieceColMaxHeight = 0;
    for (let cx = pieceMinX; cx <= pieceMaxX && cx < cols; cx++) {
        pieceColMaxHeight = Math.max(pieceColMaxHeight, colHeights[cx] || 0);
    }
    
    // Get the height of the shortest non-zero column (or 0 if all empty)
    const nonZeroHeights = colHeights.filter(h => h > 0);
    const minColHeight = nonZeroHeights.length > 0 ? Math.min(...nonZeroHeights) : 0;
    
    // Penalty for stacking on tall columns when short columns exist
    if (pieceColMaxHeight > minColHeight + 4 && minColHeight > 0) {
        score -= (pieceColMaxHeight - minColHeight - 4) * 2;
    }
    
    // Bonus for placing in empty or very short columns
    if (pieceColMaxHeight <= 2 && colHeights.some(h => h > 4)) {
        score += 5;
    }
    
    // Death zone penalties
    if (stackHeight >= 18) {
        score -= 500;
    } else if (stackHeight >= 16) {
        score -= 50;
    } else if (stackHeight >= 14) {
        score -= 10;
    }
    
    // ========================================
    // PHASE 2: CHECK FOR TSUNAMI/BLACK HOLE COMPLETION
    // ========================================
    
    // If this placement COMPLETES a tsunami, it's worth it
    for (const blob of blobs) {
        if (blob.size >= 10) {
            const { minX, maxX } = getBlobWidth(blob, cols);
            if (minX === 0 && maxX === cols - 1) {
                // TSUNAMI! Big bonus
                return score + 150 + blob.size * 3;
            }
        }
    }
    
    // Check for Black Hole completion/progress
    const blackHoleResult = getBlackHoleProgress(blobs, cols, rows);
    if (blackHoleResult.canComplete) {
        // If we can complete a black hole, give significant bonus
        score += blackHoleResult.bonus;
    }
    
    // ========================================
    // PHASE 3: COLOR BUILDING (when board is manageable)
    // ========================================
    
    // Add color bonuses if board is healthy enough to focus on building
    const isHealthy = holes <= 2 && stackHeight <= 14;
    const isModeratelyHealthy = holes <= 4 && stackHeight <= 16;
    
    if (isHealthy) {
        // Bonus for same-color adjacency (builds blobs)
        const adjacency = getColorAdjacency(board, shape, x, y, color, cols, rows);
        score += adjacency * 1.5;  // Increased significantly
        
        // Bonus for blob size - bigger blobs = more points from tsunamis
        for (const blob of blobs) {
            if (blob.size >= 4) {
                score += blob.size * 0.4;  // Doubled
                
                // Bonus for wide blobs (potential tsunamis)
                const { width } = getBlobWidth(blob, cols);
                if (width >= 5) {
                    score += (width - 4) * 4;  // +4 for width 5, +8 for 6, +12 for 7, +16 for 8, +20 for 9
                }
            }
        }
        
        // Black hole progress bonus when healthy
        if (!blackHoleResult.canComplete && blackHoleResult.progress > 0.3) {
            score += blackHoleResult.bonus * 0.5;
        }
    } else if (isModeratelyHealthy) {
        // Still give some color bonus when moderately healthy
        const adjacency = getColorAdjacency(board, shape, x, y, color, cols, rows);
        score += adjacency * 0.5;
        
        // Smaller blob bonus
        for (const blob of blobs) {
            if (blob.size >= 8) {
                score += blob.size * 0.2;
            }
        }
    }
    
    // ========================================
    // PHASE 4: NEAR-TSUNAMI BONUS (when close to spanning width)
    // ========================================
    
    // Find best tsunami candidate
    let bestTsunamiBlob = null;
    for (const blob of blobs) {
        if (blob.size >= 12) {
            const { width, minX, maxX } = getBlobWidth(blob, cols);
            const gap = (minX > 0 ? minX : 0) + (maxX < cols - 1 ? cols - 1 - maxX : 0);
            if (width >= 6 && gap <= 4) {
                if (!bestTsunamiBlob || blob.size > bestTsunamiBlob.size) {
                    bestTsunamiBlob = { ...blob, width, minX, maxX, gap };
                }
            }
        }
    }
    
    if (bestTsunamiBlob) {
        const pieceMinX = x;
        const pieceMaxX = x + shape[0].length - 1;
        
        // Count how many matching colors are in the queue (including current piece)
        const queueMatches = pieceQueue ? pieceQueue.filter(p => p && p.color === bestTsunamiBlob.color).length : 0;
        const currentMatches = color === bestTsunamiBlob.color ? 1 : 0;
        const totalMatching = queueMatches + currentMatches;
        
        // Estimate how many columns we can cover with matching pieces
        // Each piece covers ~2-3 columns of extension on average
        const estimatedCoverage = totalMatching * 2.5;
        const canLikelyComplete = estimatedCoverage >= bestTsunamiBlob.gap;
        
        // If this piece matches the tsunami blob color
        if (color === bestTsunamiBlob.color) {
            // Check if piece actually CONNECTS to the blob
            let connectsToBlob = false;
            
            if (pieceMaxX >= bestTsunamiBlob.minX - 1 && pieceMinX <= bestTsunamiBlob.maxX + 1) {
                const adj = getColorAdjacency(board, shape, x, y, color, cols, rows);
                if (adj > 0) {
                    connectsToBlob = true;
                }
            }
            
            if (connectsToBlob) {
                // Base multiplier scales with gap (closer = more urgent)
                const gapMultiplier = (5 - bestTsunamiBlob.gap) * 15; // gap=1: 60, gap=2: 45, gap=3: 30, gap=4: 15
                
                // Bonus multiplier if we have more matching pieces in queue
                const queueBoost = canLikelyComplete ? 1.5 : 1.0;
                
                let extensionBonus = 0;
                
                // Check if this placement extends toward the missing columns
                if (bestTsunamiBlob.minX > 0 && pieceMinX < bestTsunamiBlob.minX) {
                    extensionBonus += gapMultiplier * queueBoost;
                    if (pieceMinX === 0) {
                        extensionBonus += 40; // Reaches edge!
                    }
                }
                if (bestTsunamiBlob.maxX < cols - 1 && pieceMaxX > bestTsunamiBlob.maxX) {
                    extensionBonus += gapMultiplier * queueBoost;
                    if (pieceMaxX === cols - 1) {
                        extensionBonus += 40; // Reaches edge!
                    }
                }
                
                // MASSIVE bonus if this piece would complete the tsunami
                if (bestTsunamiBlob.gap === 1) {
                    const needsLeft = bestTsunamiBlob.minX > 0;
                    const needsRight = bestTsunamiBlob.maxX < cols - 1;
                    
                    if (needsLeft && pieceMinX === 0) {
                        extensionBonus += 200;
                    }
                    if (needsRight && pieceMaxX === cols - 1) {
                        extensionBonus += 200;
                    }
                }
                
                // Apply bonus if board isn't completely trashed
                if (holes <= 5) {
                    score += extensionBonus;
                }
            }
        } else if (canLikelyComplete && holes <= 3) {
            // Current piece doesn't match, but we have matching pieces coming!
            // Give a small bonus for placements that DON'T block the tsunami blob
            
            // Penalty for placing on top of or blocking the tsunami blob's extension paths
            const blocksLeftExtension = bestTsunamiBlob.minX > 0 && pieceMinX < bestTsunamiBlob.minX && pieceMaxX < bestTsunamiBlob.minX;
            const blocksRightExtension = bestTsunamiBlob.maxX < cols - 1 && pieceMinX > bestTsunamiBlob.maxX && pieceMaxX > bestTsunamiBlob.maxX;
            
            // Small bonus for NOT blocking the extension path
            if (!blocksLeftExtension && !blocksRightExtension) {
                score += queueMatches * 3; // Encourage preserving the opportunity
            }
        }
    }
    
    if (typeof score !== 'number' || isNaN(score)) return 0;
    return score;
}

/**
 * Count how many cells of the placed piece touch existing blocks
 * This rewards compact placements
 */
function countTouchingCells(board, shape, x, y, cols, rows) {
    let touching = 0;
    
    for (let sy = 0; sy < shape.length; sy++) {
        for (let sx = 0; sx < shape[sy].length; sx++) {
            if (!shape[sy][sx]) continue;
            
            const bx = x + sx;
            const by = y + sy;
            
            // Check all 4 neighbors for existing blocks
            const neighbors = [
                [bx - 1, by], [bx + 1, by],
                [bx, by - 1], [bx, by + 1]
            ];
            
            for (const [nx, ny] of neighbors) {
                // Skip if out of bounds or below the board
                if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
                
                // Check if there's an existing block at this neighbor position
                // (not from the current piece being placed)
                if (board[ny] && board[ny][nx]) {
                    touching++;
                }
            }
        }
    }
    
    return touching;
}

/**
 * Check if a piece placement is adjacent to cells of a specific color
 */
function isAdjacentToBlob(board, shape, x, y, targetColor, cols, rows) {
    for (let sy = 0; sy < shape.length; sy++) {
        for (let sx = 0; sx < shape[sy].length; sx++) {
            if (shape[sy][sx]) {
                const bx = x + sx;
                const by = y + sy;
                // Check all 4 neighbors
                for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                    const nx = bx + dx;
                    const ny = by + dy;
                    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                        if (board[ny] && board[ny][nx] === targetColor) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    return false;
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
            
            // CRITICAL: Check if piece would extend above the board (game over condition)
            // If y is negative, some part of the piece is above row 0
            if (y < 0) {
                // This placement would cause game over - give massive penalty
                placements.push({
                    x, y, rotationIndex, shape, score: -10000
                });
                continue;
            }
            
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

function findBestPlacement(board, piece, cols, rows, queue) {
    // Update mode based on current stack height BEFORE evaluating
    updateMode(board, rows);
    
    const placements = generatePlacements(board, piece, cols, rows);
    
    if (placements.length === 0) {
        return null;
    }
    
    let bestPlacement;
    
    const nextPiece = queue && queue.length > 0 ? queue[0] : null;
    const thirdPiece = queue && queue.length > 1 ? queue[1] : null;
    
    // 3-ply lookahead if we have pieces in queue
    if (nextPiece) {
        for (const placement of placements) {
            const newBoard = placePiece(board, placement.shape, placement.x, placement.y, piece.color);
            const clearedBoard = removeCompleteLines(newBoard);
            
            const nextPlacements = generatePlacements(clearedBoard, nextPiece, cols, rows);
            
            if (nextPlacements.length > 0) {
                // Sort and take top 8 placements for 2nd ply (performance optimization)
                const topNextPlacements = nextPlacements
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 8);
                
                let bestNextScore = -Infinity;
                
                for (const nextPlacement of topNextPlacements) {
                    let nextCombinedScore = nextPlacement.score;
                    
                    // 3rd ply if we have a third piece
                    if (thirdPiece) {
                        const nextBoard = placePiece(clearedBoard, nextPlacement.shape, nextPlacement.x, nextPlacement.y, nextPiece.color);
                        const nextClearedBoard = removeCompleteLines(nextBoard);
                        
                        const thirdPlacements = generatePlacements(nextClearedBoard, thirdPiece, cols, rows);
                        
                        if (thirdPlacements.length > 0) {
                            const bestThird = thirdPlacements.reduce((a, b) => a.score > b.score ? a : b);
                            // Weight: 3rd piece contributes 0.25
                            nextCombinedScore = nextPlacement.score + bestThird.score * 0.25;
                        } else {
                            nextCombinedScore = nextPlacement.score - 50;
                        }
                    }
                    
                    if (nextCombinedScore > bestNextScore) {
                        bestNextScore = nextCombinedScore;
                    }
                }
                
                // Weight: 2nd piece contributes 0.5
                placement.combinedScore = placement.score + bestNextScore * 0.5;
            } else {
                placement.combinedScore = placement.score - 100;
            }
        }
        
        bestPlacement = placements.reduce((a, b) => 
            (a.combinedScore || a.score) > (b.combinedScore || b.score) ? a : b
        );
    } else {
        bestPlacement = placements.reduce((a, b) => a.score > b.score ? a : b);
    }
    
    // Record this decision if recording is active
    if (gameRecording.startTime) {
        recordDecision(board, piece, placements, bestPlacement, currentMode, lastStackHeight);
    }
    
    return bestPlacement;
}

// Handle messages from main thread
self.onmessage = function(e) {
    const { command, board, piece, queue, cols, rows, skillLevel, cause } = e.data;
    
    // Handle reset command
    if (command === 'reset') {
        currentMode = 'colorBuilding';
        lastStackHeight = 0;
        self.postMessage({ reset: true, mode: currentMode });
        return;
    }
    
    // Handle recording commands
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
    
    // Use setTimeout to yield to other tasks and reduce priority
    setTimeout(() => {
        const bestPlacement = findBestPlacement(board, piece, cols, rows, pieceQueue);
        self.postMessage({ bestPlacement, mode: currentMode, stackHeight: lastStackHeight });
    }, 0);
};
