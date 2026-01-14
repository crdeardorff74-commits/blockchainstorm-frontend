// AI Worker v4.3 - 4-ply lookahead, skill-level aware strategy (2026-01-14)
console.log("🤖 AI Worker v4.3 loaded - 4-ply lookahead, Breeze=blob focus, Tempest/Maelstrom=tsunami focus");

const AI_VERSION = "4.3";

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
let currentUfoActive = false; // Track UFO state for 42 lines easter egg

// ==================== GAME RECORDING ====================
let gameRecording = {
    startTime: null,
    decisions: [],
    events: [],
    finalState: null
};

function startRecording() {
    gameRecording = {
        version: AI_VERSION,
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

// ==================== HORIZONTAL CONNECTIVITY ANALYSIS ====================

/**
 * Analyze horizontal color runs in the board
 * Returns array of runs: { color, row, startX, endX, width, touchesLeft, touchesRight }
 */
function getHorizontalRuns(board, cols, rows) {
    const runs = [];
    
    for (let row = 0; row < rows; row++) {
        if (!board[row]) continue;
        
        let runStart = -1;
        let runColor = null;
        
        for (let x = 0; x <= cols; x++) {
            const cell = x < cols ? board[row][x] : null;
            
            if (cell === runColor && cell !== null) {
                // Continue current run
            } else {
                // End current run if exists
                if (runColor !== null && runStart >= 0) {
                    const width = x - runStart;
                    if (width >= 2) { // Only track runs of 2+
                        runs.push({
                            color: runColor,
                            row,
                            startX: runStart,
                            endX: x - 1,
                            width,
                            touchesLeft: runStart === 0,
                            touchesRight: x - 1 === cols - 1
                        });
                    }
                }
                // Start new run
                runStart = x;
                runColor = cell;
            }
        }
    }
    
    return runs;
}

/**
 * Find the best horizontal run for each color (widest, preferring edge-touching)
 */
function getBestRunsPerColor(runs) {
    const bestByColor = {};
    
    for (const run of runs) {
        const existing = bestByColor[run.color];
        if (!existing) {
            bestByColor[run.color] = run;
        } else {
            // Prefer wider runs, then edge-touching runs
            const existingScore = existing.width * 10 + (existing.touchesLeft ? 5 : 0) + (existing.touchesRight ? 5 : 0);
            const newScore = run.width * 10 + (run.touchesLeft ? 5 : 0) + (run.touchesRight ? 5 : 0);
            if (newScore > existingScore) {
                bestByColor[run.color] = run;
            }
        }
    }
    
    return bestByColor;
}

// ==================== SINGLE EVALUATION FUNCTION ====================

function evaluateBoard(board, shape, x, y, color, cols, rows) {
    let score = 0;
    
    const holes = countHoles(board);
    const stackHeight = getStackHeight(board, rows);
    const bumpiness = getBumpiness(board);
    const colHeights = getColumnHeights(board, cols, rows);
    
    // ====== CHECK TSUNAMI POTENTIAL FIRST ======
    // This affects how we penalize holes
    // NOTE: Breeze mode doesn't have tsunamis or black holes - focus on blob size instead
    const isBreeze = currentSkillLevel === 'breeze';
    
    const runs = getHorizontalRuns(board, cols, rows);
    const bestRuns = getBestRunsPerColor(runs);
    
    // Check if we have a promising tsunami in progress (only matters for non-Breeze)
    // Consider queue colors - if we have matching pieces coming, lower the threshold
    let hasTsunamiPotential = false;
    let tsunamiLikelyAchievable = false;
    let bestTsunamiWidth = 0;
    let bestTsunamiColor = null;
    
    if (!isBreeze) {
        for (const runColor in bestRuns) {
            const run = bestRuns[runColor];
            // Count matching pieces in queue for this color
            const queueMatches = pieceQueue.filter(p => p && p.color === runColor).length;
            // Lower threshold if we have matching pieces coming (6 with 2+ matches, 7 with 1+ match, 8 always)
            const effectiveThreshold = queueMatches >= 2 ? 6 : (queueMatches >= 1 ? 7 : 8);
            
            if (run.width >= effectiveThreshold) {
                hasTsunamiPotential = true;
                if (run.width > bestTsunamiWidth) {
                    bestTsunamiWidth = run.width;
                    bestTsunamiColor = runColor;
                }
            }
            
            // Tsunami is likely achievable if width >= 8 with queue support, or width >= 9
            if (run.width >= 9 || (run.width >= 8 && queueMatches >= 1) || (run.width >= 7 && queueMatches >= 2)) {
                tsunamiLikelyAchievable = true;
            }
        }
    }
    
    // ====== SURVIVAL PRIORITIES ======
    
    // 1. Holes - progressive penalty, BUT reduced if tsunami is likely
    // If tsunami is achievable, holes in the tsunami blob area don't matter
    if (tsunamiLikelyAchievable) {
        // Minimal hole penalty - tsunami will clear them
        score -= holes * 2;
    } else if (holes <= 2) {
        score -= holes * 8;
    } else if (holes <= 5) {
        score -= 16 + (holes - 2) * 12;
    } else {
        score -= 52 + (holes - 5) * 20;
    }
    
    // 2. Height penalty
    score -= stackHeight * 1.2;
    
    // 3. Bumpiness - also reduced if building tsunami
    if (tsunamiLikelyAchievable) {
        score -= bumpiness * 0.5;
    } else {
        score -= bumpiness * 1.2;
    }
    
    // 4. Deep wells
    for (let col = 0; col < cols; col++) {
        const leftHeight = col > 0 ? colHeights[col - 1] : colHeights[col];
        const rightHeight = col < cols - 1 ? colHeights[col + 1] : colHeights[col];
        const minNeighbor = Math.min(leftHeight, rightHeight);
        const wellDepth = minNeighbor - colHeights[col];
        if (wellDepth > 2) {
            score -= (wellDepth - 2) * 4;
        }
    }
    
    // 5. Severe height penalties
    if (stackHeight >= 18) {
        score -= 150;
    } else if (stackHeight >= 16) {
        score -= 40;
    } else if (stackHeight >= 14) {
        score -= 12;
    }
    
    // ====== LINE CLEARS ======
    let completeRows = 0;
    for (let row = 0; row < rows; row++) {
        if (board[row] && board[row].every(cell => cell !== null)) {
            completeRows++;
        }
    }
    
    if (completeRows > 0) {
        if (stackHeight >= 18) {
            // Critical - must clear
            score += completeRows * 100;
        } else if (stackHeight >= 16) {
            // Dangerous
            score += completeRows * 60;
        } else if (stackHeight >= 14) {
            // Risky
            score += completeRows * 30;
        } else if (currentUfoActive) {
            // UFO easter egg - avoid clears
            score -= completeRows * 40;
        } else if (hasTsunamiPotential) {
            // We're building toward a tsunami - penalize line clears that might disrupt it
            // The wider our best run, the more we want to avoid clearing
            score -= completeRows * (bestTsunamiWidth * 3);
        } else {
            // No tsunami potential, modest bonus for clearing
            score += completeRows * 5;
        }
    }
    
    // Bonus for placing piece that matches our best tsunami color (non-Breeze only)
    if (!isBreeze && hasTsunamiPotential && bestTsunamiColor && color === bestTsunamiColor) {
        const matchingInQueue = pieceQueue.filter(p => p && p.color === bestTsunamiColor).length;
        // Extra bonus scaled by how many matching pieces are coming
        score += 10 + (matchingInQueue * 5);
    }
    
    // ====== BLOB BUILDING ======
    // For Breeze: focus on general blob size and connectivity
    // For other modes: focus on horizontal runs for tsunamis
    
    if (stackHeight <= 16 && holes <= 3) {
        
        // Analyze horizontal runs after this placement
        const runsAfter = getHorizontalRuns(board, cols, rows);
        
        // 1. ADJACENCY - value same-color neighbors
        let horizontalAdj = 0;
        let verticalAdj = 0;
        
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (!shape[py][px]) continue;
                const bx = x + px;
                const by = y + py;
                
                // Check left neighbor (not part of piece)
                if (bx > 0 && board[by] && board[by][bx - 1] === color) {
                    // Make sure it's not part of the piece we're placing
                    let partOfPiece = false;
                    if (px > 0 && shape[py][px - 1]) partOfPiece = true;
                    if (!partOfPiece) horizontalAdj++;
                }
                
                // Check right neighbor
                if (bx < cols - 1 && board[by] && board[by][bx + 1] === color) {
                    let partOfPiece = false;
                    if (px < shape[py].length - 1 && shape[py][px + 1]) partOfPiece = true;
                    if (!partOfPiece) horizontalAdj++;
                }
                
                // Check vertical neighbors
                if (by > 0 && board[by - 1] && board[by - 1][bx] === color) {
                    let partOfPiece = false;
                    if (py > 0 && shape[py - 1] && shape[py - 1][px]) partOfPiece = true;
                    if (!partOfPiece) verticalAdj++;
                }
                if (by < rows - 1 && board[by + 1] && board[by + 1][bx] === color) {
                    let partOfPiece = false;
                    if (py < shape.length - 1 && shape[py + 1] && shape[py + 1][px]) partOfPiece = true;
                    if (!partOfPiece) verticalAdj++;
                }
            }
        }
        
        if (isBreeze) {
            // Breeze mode: value all adjacency equally for blob building
            score += horizontalAdj * 5;
            score += verticalAdj * 5;
            
            // Bonus for creating/extending larger blobs (use flood fill to measure)
            // For simplicity, reward runs of any orientation
            for (const run of runsAfter) {
                if (run.width >= 3 && run.color === color) {
                    score += run.width * 3;
                }
            }
        } else {
            // Non-Breeze: Horizontal adjacency worth 3x vertical (for tsunami building)
            score += horizontalAdj * 6;
            score += verticalAdj * 2;
        
            // 2. REWARD WIDE HORIZONTAL RUNS
            for (const run of runsAfter) {
                if (run.width >= 4) {
                    // Base bonus for run width
                    let runBonus = run.width * 2;
                    
                    // Bonus for touching edges (closer to tsunami)
                    if (run.touchesLeft) runBonus += run.width * 1.5;
                    if (run.touchesRight) runBonus += run.width * 1.5;
                    if (run.touchesLeft && run.touchesRight) {
                        // FULL SPAN - TSUNAMI! Massive bonus
                        runBonus += 300 + run.width * 10;
                    }
                    
                    // Extra bonus if this run involves our piece color
                    if (run.color === color) {
                        runBonus *= 1.5;
                    }
                    
                    // Scale bonus with width (exponential for near-tsunamis)
                    if (run.width >= 10) {
                        runBonus += (run.width - 9) * 30; // Big bonus for 10, 11, 12 wide
                    } else if (run.width >= 8) {
                        runBonus += (run.width - 7) * 15;
                    }
                    
                    score += runBonus;
                }
            }
            
            // 3. STRONGLY PREFER EXTENDING OUR OWN COLOR'S RUNS
            // Rather than penalizing blocking others, just make our own extensions very attractive
            const ourRuns = runsAfter.filter(r => r.color === color);
            for (const run of ourRuns) {
                if (run.width >= 4) {
                    // Did we extend an existing run? Check if piece is at the edge
                    const pieceMinX = x;
                    const pieceMaxX = x + (shape[0] ? shape[0].length - 1 : 0);
                    
                    // Check if piece cells are at the boundary of this run
                    let atRunEdge = false;
                    for (let py = 0; py < shape.length; py++) {
                        for (let px = 0; px < shape[py].length; px++) {
                            if (!shape[py][px]) continue;
                            const cellX = x + px;
                            const cellY = y + py;
                            if (cellY === run.row && (cellX === run.startX || cellX === run.endX)) {
                                atRunEdge = true;
                            }
                        }
                    }
                    
                    if (atRunEdge) {
                        // We extended a run - extra bonus
                        score += run.width * 4;
                    }
                }
            }
            
            // 4. PLACEMENT NEAR EDGES - prefer placing same color near board edges
            const pieceMinX = x;
            const pieceMaxX = x + (shape[0] ? shape[0].length - 1 : 0);
            
            // Check if we have an existing run of our color
            const ourBestRun = bestRuns[color];
            if (ourBestRun && ourBestRun.width >= 5) {
                // We have a decent run of our color - reward extending it toward edges
                if (ourBestRun.touchesLeft && !ourBestRun.touchesRight) {
                    // Run touches left, reward placing on right side to extend
                    if (pieceMaxX >= ourBestRun.endX) {
                        score += 20 + (ourBestRun.width * 2);
                    }
                } else if (ourBestRun.touchesRight && !ourBestRun.touchesLeft) {
                    // Run touches right, reward placing on left side
                    if (pieceMinX <= ourBestRun.startX) {
                        score += 20 + (ourBestRun.width * 2);
                    }
                } else if (!ourBestRun.touchesLeft && !ourBestRun.touchesRight) {
                    // Run in middle - reward extending toward either edge
                    if (pieceMinX <= ourBestRun.startX || pieceMaxX >= ourBestRun.endX) {
                        score += 10 + ourBestRun.width;
                    }
                }
            } else {
                // No significant run yet - small bonus for edge placement to start one
                if (pieceMinX === 0 || pieceMaxX === cols - 1) {
                    score += 5;
                }
            }
            
            // 5. QUEUE AWARENESS - if upcoming pieces match our tsunami color, boost confidence
            // Now considering all 4 pieces in the queue for better tsunami planning
            if (ourBestRun && ourBestRun.width >= 5) {
                const queueMatches = pieceQueue.filter(p => p && p.color === color).length;
                if (queueMatches >= 3) {
                    // 3+ matching pieces in queue - very confident about tsunami
                    score += ourBestRun.width * 5;
                } else if (queueMatches >= 2) {
                    score += ourBestRun.width * 3;
                } else if (queueMatches >= 1) {
                    score += ourBestRun.width * 1.5;
                }
            }
        } // end non-Breeze tsunami building
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
    
    // Use queue for 4-ply lookahead (current + 3 next pieces)
    // All 4 queue pieces are still considered for tsunami potential in evaluateBoard
    const nextPiece = queue && queue.length > 0 ? queue[0] : null;
    const thirdPiece = queue && queue.length > 1 ? queue[1] : null;
    const fourthPiece = queue && queue.length > 2 ? queue[2] : null;
    
    if (nextPiece) {
        // 4-ply lookahead: consider where next pieces can go
        for (const placement of placements) {
            const newBoard = placePiece(board, placement.shape, placement.x, placement.y, piece.color);
            const nextPlacements = generatePlacements(newBoard, nextPiece, cols, rows);
            
            if (nextPlacements.length > 0) {
                // Get top 5 next placements to limit computation
                const topNext = nextPlacements.sort((a, b) => b.score - a.score).slice(0, 5);
                
                let bestNextScore = -Infinity;
                
                for (const nextPlacement of topNext) {
                    let nextScore = nextPlacement.score;
                    
                    // 3-ply: look at third piece
                    if (thirdPiece) {
                        const nextBoard = placePiece(newBoard, nextPlacement.shape, nextPlacement.x, nextPlacement.y, nextPiece.color);
                        const thirdPlacements = generatePlacements(nextBoard, thirdPiece, cols, rows);
                        
                        if (thirdPlacements.length > 0) {
                            // Get top 4 third placements
                            const topThird = thirdPlacements.sort((a, b) => b.score - a.score).slice(0, 4);
                            let bestThirdScore = -Infinity;
                            
                            for (const thirdPlacement of topThird) {
                                let thirdScore = thirdPlacement.score;
                                
                                // 4-ply: look at fourth piece
                                if (fourthPiece) {
                                    const thirdBoard = placePiece(nextBoard, thirdPlacement.shape, thirdPlacement.x, thirdPlacement.y, thirdPiece.color);
                                    const fourthPlacements = generatePlacements(thirdBoard, fourthPiece, cols, rows);
                                    
                                    if (fourthPlacements.length > 0) {
                                        const bestFourth = fourthPlacements.reduce((a, b) => a.score > b.score ? a : b);
                                        thirdScore += bestFourth.score * 0.25; // 4th piece counts 25%
                                    }
                                }
                                
                                if (thirdScore > bestThirdScore) {
                                    bestThirdScore = thirdScore;
                                }
                            }
                            nextScore += bestThirdScore * 0.35; // 3rd piece counts 35%
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
    const { command, board, piece, queue, cols, rows, skillLevel, ufoActive, cause } = e.data;
    
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
    currentUfoActive = ufoActive || false;
    
    setTimeout(() => {
        const bestPlacement = findBestPlacement(board, piece, cols, rows, pieceQueue);
        const stackHeight = getStackHeight(board, rows);
        self.postMessage({ bestPlacement, stackHeight });
    }, 0);
};

// Send ready message immediately when worker loads
self.postMessage({ ready: true, version: AI_VERSION });
