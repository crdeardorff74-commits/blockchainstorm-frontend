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
 */
function countWells(board) {
    const cols = board[0].length;
    const heights = [];
    
    // Get column heights
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
    
    let wellScore = 0;
    for (let x = 0; x < cols; x++) {
        const leftHeight = x > 0 ? heights[x - 1] : 999;
        const rightHeight = x < cols - 1 ? heights[x + 1] : 999;
        const currentHeight = heights[x];
        
        // A well is where current column is lower than both neighbors
        const wellDepth = Math.min(leftHeight, rightHeight) - currentHeight;
        if (wellDepth > 0) {
            // Penalize deeper wells more heavily (quadratic)
            wellScore += wellDepth * wellDepth;
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
    const progress = width / cols;
    
    // Bonus for touching edges
    let edgeBonus = 0;
    if (minX === 0) edgeBonus += 0.15;
    if (maxX === cols - 1) edgeBonus += 0.15;
    if (minX === 0 && maxX === cols - 1) return 1.5; // Full width!
    
    return progress + edgeBonus;
}

/**
 * Check if queue colors could help complete a Tsunami for a blob
 */
function canCompleteTsunamiWithQueue(blob, cols) {
    if (!blob || blob.size < 4) return { canComplete: false, score: 0 };
    if (!pieceQueue || pieceQueue.length === 0) return { canComplete: false, score: 0 };
    
    const { width, minX, maxX } = getBlobWidth(blob, cols);
    
    // Already full width
    if (minX === 0 && maxX === cols - 1) return { canComplete: true, score: 5 };
    
    // Count matching colors in queue
    const matchingPieces = pieceQueue.filter(p => p && p.color === blob.color).length;
    
    // Estimate if we can reach full width
    const gapLeft = minX;
    const gapRight = cols - 1 - maxX;
    const totalGap = gapLeft + gapRight;
    
    // Each piece has ~4 blocks, estimate coverage potential
    const potentialCoverage = matchingPieces * 2; // Conservative estimate
    
    if (potentialCoverage >= totalGap) {
        // Higher score if closer to completion
        const completionScore = (width / cols) * matchingPieces;
        return { canComplete: true, score: completionScore };
    }
    
    return { canComplete: false, score: matchingPieces * 0.2 };
}

/**
 * Check for potential Black Hole setup (blob surrounded by another color)
 */
function getBlackHoleProgress(blobs, cols, rows) {
    if (blobs.length < 2) return { progress: 0, canComplete: false };
    
    let maxProgress = 0;
    let bestCanComplete = false;
    
    for (let i = 0; i < blobs.length; i++) {
        for (let j = 0; j < blobs.length; j++) {
            if (i === j) continue;
            if (blobs[i].color === blobs[j].color) continue;
            
            const inner = blobs[i];
            const outer = blobs[j];
            
            if (inner.size < 4 || outer.size < 6) continue;
            
            // Count how many sides of inner are adjacent to outer
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
            
            // Progress based on how surrounded the inner blob is
            const perimeterEstimate = inner.size * 2 + 2;
            const progress = adjacentCount / perimeterEstimate;
            
            // Check if queue could help complete this
            const outerMatches = pieceQueue ? pieceQueue.filter(p => p && p.color === outer.color).length : 0;
            const canComplete = progress > 0.5 && outerMatches >= 2;
            
            if (progress > maxProgress) {
                maxProgress = progress;
                bestCanComplete = canComplete;
            }
        }
    }
    
    return { progress: maxProgress, canComplete: bestCanComplete };
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
            score += progress * 2;
        }
    }
    
    // Black hole progress
    const blackHoleResult = getBlackHoleProgress(blobs, cols, rows);
    if (blackHoleResult.canComplete) {
        score += blackHoleResult.progress * 4;
    } else {
        score += blackHoleResult.progress * 1.5;
    }
    
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
    
    let score = 0;
    
    // === FIRST: Check for Tsunami opportunity - this overrides normal survival logic ===
    // If we can complete a Tsunami with the queue, prioritize it heavily!
    let bestTsunamiScore = 0;
    for (const blob of blobs) {
        if (blob.size >= 4) {
            const tsunamiResult = canCompleteTsunamiWithQueue(blob, cols);
            if (tsunamiResult.canComplete && tsunamiResult.score > bestTsunamiScore) {
                bestTsunamiScore = tsunamiResult.score;
            }
            
            // Also check current tsunami progress
            const progress = getTsunamiProgress(blob, cols);
            if (progress >= 1.0) {
                // Very close to tsunami - big bonus even in survival
                score += progress * 5;
            }
        }
    }
    
    // If there's a clear path to Tsunami, give significant bonus for color building
    if (bestTsunamiScore > 0) {
        score += bestTsunamiScore * 4;
        score += getColorAdjacency(board, shape, x, y, color, cols, rows) * 0.5;
    }
    
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

// ==================== MAIN EVALUATION ====================

function evaluateBoard(board, shape, x, y, color, cols, rows, linesCleared) {
    if (currentMode === 'colorBuilding') {
        return evaluateColorBuilding(board, shape, x, y, color, cols, rows, linesCleared);
    } else {
        return evaluateSurvival(board, shape, x, y, color, cols, rows, linesCleared);
    }
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
