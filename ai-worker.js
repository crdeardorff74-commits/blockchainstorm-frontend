// AI Worker v4.7.0 - Fix run bonuses to only reward contributions + add overhang penalty
console.log("🤖 AI Worker v4.7.0 loaded - run bonuses now require piece contribution, overhang penalty added");

const AI_VERSION = "4.7.0";

/**
 * AI for TaNTЯiS / BLOCKCHaiNSTORM
 * 
 * Key insight from game analysis: Score DENSITY (points per line) matters more than survival.
 * Special events (tsunamis, volcanoes, black holes) use cubic scoring:
 *   - 20-block tsunami = 1.6M base points vs typical line clear = thousands
 *   - Holes aren't as bad here due to blob gravity / cascade filling
 * 
 * Priorities:
 * 1. Build toward special events (tsunamis, volcanoes, black holes)
 * 2. Avoid line clears when building toward specials
 * 3. Keep stack manageable (but accept temporary messiness for specials)
 * 4. Holes can fill via cascade - tolerate them when building specials
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

// ==================== VOLCANO DETECTION ====================
// Volcano requires: blob touching bottom + side edge, SURROUNDED by another color blob

/**
 * Check if a blob touches the bottom and a side edge
 * Returns: { touchesBottom, touchesLeft, touchesRight, touchesBothEdges }
 */
function getBlobEdgeContact(blob, cols, rows) {
    if (!blob || blob.positions.length === 0) {
        return { touchesBottom: false, touchesLeft: false, touchesRight: false, touchesBothEdges: false };
    }
    
    let touchesBottom = false, touchesLeft = false, touchesRight = false;
    
    for (const [x, y] of blob.positions) {
        if (y === rows - 1) touchesBottom = true;
        if (x === 0) touchesLeft = true;
        if (x === cols - 1) touchesRight = true;
    }
    
    return {
        touchesBottom,
        touchesLeft,
        touchesRight,
        touchesBothEdges: touchesBottom && (touchesLeft || touchesRight)
    };
}

/**
 * Check if innerBlob is surrounded by outerBlob (for volcano/black hole detection)
 * Surrounded means: every cell adjacent to innerBlob (not part of innerBlob) is either:
 *   - Part of outerBlob, OR
 *   - Outside the board
 */
function isBlobSurrounded(innerBlob, outerBlob, cols, rows) {
    if (!innerBlob || !outerBlob || innerBlob.positions.length === 0) return false;
    
    const innerSet = new Set(innerBlob.positions.map(([x, y]) => `${x},${y}`));
    const outerSet = new Set(outerBlob.positions.map(([x, y]) => `${x},${y}`));
    
    for (const [x, y] of innerBlob.positions) {
        const neighbors = [[x-1, y], [x+1, y], [x, y-1], [x, y+1]];
        for (const [nx, ny] of neighbors) {
            // Skip if this neighbor is part of innerBlob
            if (innerSet.has(`${nx},${ny}`)) continue;
            
            // Skip if outside board (edges count as "surrounded")
            if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
            
            // This neighbor must be part of outerBlob
            if (!outerSet.has(`${nx},${ny}`)) {
                return false;
            }
        }
    }
    
    return true;
}

/**
 * Find volcano potential in the board
 * Returns: { hasPotential, innerBlob, outerBlob, innerSize, progress }
 * Progress: 0-1 indicating how close to volcano (touching edges, surrounded %)
 */
function findVolcanoPotential(board, cols, rows) {
    const blobs = getAllBlobs(board, cols, rows);
    
    let bestPotential = { hasPotential: false, progress: 0, innerSize: 0 };
    
    for (const innerBlob of blobs) {
        const edgeContact = getBlobEdgeContact(innerBlob, cols, rows);
        
        // Must touch bottom + side edge for volcano
        if (!edgeContact.touchesBothEdges) continue;
        
        // Look for surrounding blob of different color
        for (const outerBlob of blobs) {
            if (outerBlob.color === innerBlob.color) continue;
            
            // Check if inner is surrounded by outer
            if (isBlobSurrounded(innerBlob, outerBlob, cols, rows)) {
                // Full volcano potential!
                const potential = {
                    hasPotential: true,
                    progress: 1.0,
                    innerBlob,
                    outerBlob,
                    innerSize: innerBlob.positions.length,
                    edgeType: edgeContact.touchesLeft ? 'left' : 'right'
                };
                if (potential.innerSize > bestPotential.innerSize) {
                    bestPotential = potential;
                }
            }
        }
        
        // Even if not fully surrounded, track progress toward volcano
        if (edgeContact.touchesBothEdges && innerBlob.positions.length >= 4) {
            // Partial progress - has edge contact, decent size
            const progress = 0.3 + (innerBlob.positions.length / 20) * 0.3;
            if (progress > bestPotential.progress && !bestPotential.hasPotential) {
                bestPotential = {
                    hasPotential: false,
                    progress: Math.min(0.6, progress),
                    innerSize: innerBlob.positions.length,
                    edgeType: edgeContact.touchesLeft ? 'left' : 'right'
                };
            }
        }
    }
    
    return bestPotential;
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

// ==================== OVERHANG DETECTION ====================
/**
 * Count how many cells of the placed piece are "overhanging" - 
 * i.e., placed over empty space that could trap holes.
 * Also detects problematic patterns like vertical Z/S at edges.
 */
function analyzeOverhangs(board, shape, x, y, cols, rows) {
    let overhangCount = 0;
    let severeOverhangs = 0;  // Cells with 2+ empty spaces below them
    let edgeVerticalProblem = false;
    
    // Detect the piece type by shape signature
    const shapeHeight = shape.length;
    const shapeWidth = shape[0] ? shape[0].length : 0;
    
    // Z/S pieces in vertical orientation have height=3, width=2
    const isVerticalZS = shapeHeight === 3 && shapeWidth === 2;
    
    // Check if this vertical Z/S is at an edge
    if (isVerticalZS) {
        if (x === 0 || x === cols - 2) {
            // Vertical Z/S at edge - this often creates trapped holes
            edgeVerticalProblem = true;
        }
    }
    
    // Check each cell of the placed piece
    for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
            if (!shape[py][px]) continue;
            
            const bx = x + px;
            const by = y + py;
            
            // Skip cells at the bottom of the board
            if (by >= rows - 1) continue;
            
            // Count empty cells directly below this piece cell
            let emptyBelow = 0;
            for (let checkY = by + 1; checkY < rows; checkY++) {
                // Check if this column position has support from the piece itself
                let pieceSupport = false;
                for (let ppy = py + 1; ppy < shape.length; ppy++) {
                    if (shape[ppy] && shape[ppy][px]) {
                        pieceSupport = true;
                        break;
                    }
                }
                if (pieceSupport) break;
                
                // Check board - if there's a block, stop counting
                if (board[checkY] && board[checkY][bx]) break;
                
                emptyBelow++;
            }
            
            if (emptyBelow > 0) {
                overhangCount++;
                if (emptyBelow >= 2) {
                    severeOverhangs++;
                }
            }
        }
    }
    
    return { overhangCount, severeOverhangs, edgeVerticalProblem };
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

/**
 * Evaluate board and return detailed breakdown for analysis
 * Returns: { score, breakdown } where breakdown contains all individual factors
 */
function evaluateBoardWithBreakdown(board, shape, x, y, color, cols, rows) {
    const breakdown = {
        holes: { count: 0, penalty: 0 },
        height: { value: 0, penalty: 0 },
        bumpiness: { value: 0, penalty: 0 },
        wells: { count: 0, penalty: 0 },
        overhangs: { count: 0, severe: 0, edgeVertical: false, penalty: 0 },
        criticalHeight: { penalty: 0 },
        lineClears: { count: 0, bonus: 0 },
        tsunami: { potential: false, achievable: false, nearCompletion: false, imminent: false, width: 0, color: null, bonus: 0 },
        volcano: { potential: false, progress: 0, innerSize: 0, bonus: 0 },
        blob: { horizontalAdj: 0, verticalAdj: 0, bonus: 0 },
        runs: { bonus: 0 },
        edge: { bonus: 0 },
        queue: { matchingPieces: 0, bonus: 0 },
        classification: 'neutral' // 'defensive', 'offensive', 'opportunistic', 'survival'
    };
    
    let score = 0;
    
    const holes = countHoles(board);
    const stackHeight = getStackHeight(board, rows);
    const bumpiness = getBumpiness(board);
    const colHeights = getColumnHeights(board, cols, rows);
    
    breakdown.holes.count = holes;
    breakdown.height.value = stackHeight;
    breakdown.bumpiness.value = bumpiness;
    
    const isBreeze = currentSkillLevel === 'breeze';
    
    // ====== DANGER ZONE CHECK ======
    // Height-based zones for different behaviors
    const inDangerZone = stackHeight >= 12 || holes >= 8;
    const inCriticalZone = stackHeight >= 15 || holes >= 12; // Last 1/4 of well (15+ of 20)
    const inDeathZone = stackHeight >= 17 || holes >= 15;
    
    // ====== SPECIAL EVENT DETECTION ======
    const runs = getHorizontalRuns(board, cols, rows);
    const bestRuns = getBestRunsPerColor(runs);
    
    let hasTsunamiPotential = false;
    let tsunamiLikelyAchievable = false;  // Speculative - need more pieces
    let tsunamiNearCompletion = false;    // Opportunistic - can see pieces to finish
    let tsunamiImminent = false;          // Can complete with current + visible queue
    let bestTsunamiWidth = 0;
    let bestTsunamiColor = null;
    
    // Tsunami detection - different rules for completion vs building
    if (!isBreeze) {
        for (const runColor in bestRuns) {
            const run = bestRuns[runColor];
            const queueMatches = pieceQueue.filter(p => p && p.color === runColor).length;
            const blocksNeeded = 10 - run.width;  // Need 10-wide for tsunami
            
            // IMMINENT: Can complete with visible queue pieces
            // This is ALWAYS worth doing unless in death zone
            if (!inDeathZone) {
                if (run.width >= 10) {
                    tsunamiImminent = true;
                    tsunamiNearCompletion = true;
                } else if (run.width >= 8 && queueMatches >= blocksNeeded) {
                    // Width 8 + 2 matching in queue, or width 9 + 1 matching
                    tsunamiImminent = true;
                    tsunamiNearCompletion = true;
                } else if (run.width >= 9 && queueMatches >= 1) {
                    tsunamiImminent = true;
                    tsunamiNearCompletion = true;
                }
            }
            
            // NEAR COMPLETION: Very close, worth prioritizing even at moderate height
            // Allowed up to critical zone (height 15)
            if (!inCriticalZone) {
                if (run.width >= 9 || (run.width >= 8 && queueMatches >= 2)) {
                    tsunamiNearCompletion = true;
                }
            }
            
            // ACHIEVABLE: Good chance with a few more pieces - only at safe heights
            // This is speculative building, scale with height
            if (!inDangerZone) {
                if (run.width >= 9 || (run.width >= 8 && queueMatches >= 1) || (run.width >= 7 && queueMatches >= 2)) {
                    tsunamiLikelyAchievable = true;
                }
            }
            
            // POTENTIAL: Could become tsunami - most speculative
            const effectiveThreshold = queueMatches >= 2 ? 5 : (queueMatches >= 1 ? 6 : 7);
            if (run.width >= effectiveThreshold && !inCriticalZone) {
                hasTsunamiPotential = true;
                if (run.width > bestTsunamiWidth) {
                    bestTsunamiWidth = run.width;
                    bestTsunamiColor = runColor;
                }
            }
        }
    }
    
    breakdown.tsunami.potential = hasTsunamiPotential;
    breakdown.tsunami.achievable = tsunamiLikelyAchievable;
    breakdown.tsunami.nearCompletion = tsunamiNearCompletion;
    breakdown.tsunami.imminent = tsunamiImminent;
    breakdown.tsunami.width = bestTsunamiWidth;
    breakdown.tsunami.color = bestTsunamiColor;
    
    // Volcano detection - skip in danger zone (speculative building)
    let volcanoPotential = { hasPotential: false, progress: 0, innerSize: 0 };
    if (!isBreeze && !inDangerZone) {
        volcanoPotential = findVolcanoPotential(board, cols, rows);
    }
    breakdown.volcano.potential = volcanoPotential.hasPotential;
    breakdown.volcano.progress = volcanoPotential.progress;
    breakdown.volcano.innerSize = volcanoPotential.innerSize;
    
    // Building special event - includes imminent tsunamis even at higher heights
    const buildingSpecialEvent = tsunamiImminent || 
        (!inCriticalZone && (tsunamiLikelyAchievable || volcanoPotential.hasPotential));
    
    // ====== HOLE PENALTIES - CASCADE AWARE BUT NOT RECKLESS ======
    // Imminent tsunamis (can see the pieces) get most lenient treatment
    if (tsunamiImminent && holes <= 8) {
        breakdown.holes.penalty = holes * 2;  // Very lenient - we're about to score big
    } else if (tsunamiNearCompletion && holes <= 6) {
        breakdown.holes.penalty = holes * 3;
    } else if (buildingSpecialEvent && holes <= 8) {
        breakdown.holes.penalty = holes * 5;
    } else if (hasTsunamiPotential && holes <= 5) {
        breakdown.holes.penalty = holes * 6;
    } else {
        if (holes <= 2) {
            breakdown.holes.penalty = holes * 7;
        } else if (holes <= 5) {
            breakdown.holes.penalty = 14 + (holes - 2) * 10;
        } else {
            breakdown.holes.penalty = 44 + (holes - 5) * 18;
        }
    }
    score -= breakdown.holes.penalty;
    
    // ====== HEIGHT PENALTY ======
    if (buildingSpecialEvent && stackHeight < 17) {
        breakdown.height.penalty = stackHeight * 0.6;
    } else {
        breakdown.height.penalty = stackHeight * 1.0;
    }
    score -= breakdown.height.penalty;
    
    // ====== BUMPINESS ======
    if (buildingSpecialEvent) {
        breakdown.bumpiness.penalty = bumpiness * 0.3;
    } else {
        breakdown.bumpiness.penalty = bumpiness * 0.8;
    }
    score -= breakdown.bumpiness.penalty;
    
    // ====== DEEP WELLS ======
    let wellPenalty = 0;
    let wellCount = 0;
    for (let col = 0; col < cols; col++) {
        const leftHeight = col > 0 ? colHeights[col - 1] : colHeights[col];
        const rightHeight = col < cols - 1 ? colHeights[col + 1] : colHeights[col];
        const minNeighbor = Math.min(leftHeight, rightHeight);
        const wellDepth = minNeighbor - colHeights[col];
        if (wellDepth > 3) {
            wellPenalty += (wellDepth - 3) * 3;
            wellCount++;
        }
    }
    breakdown.wells.count = wellCount;
    breakdown.wells.penalty = wellPenalty;
    score -= wellPenalty;
    
    // ====== OVERHANG PENALTY ======
    // Penalize piece placements that create overhangs (cells over empty space)
    // This catches problematic vertical Z/S pieces at edges
    const overhangInfo = analyzeOverhangs(board, shape, x, y, cols, rows);
    breakdown.overhangs.count = overhangInfo.overhangCount;
    breakdown.overhangs.severe = overhangInfo.severeOverhangs;
    breakdown.overhangs.edgeVertical = overhangInfo.edgeVerticalProblem;
    
    // Base overhang penalty
    let overhangPenalty = overhangInfo.overhangCount * 8;
    
    // Extra penalty for severe overhangs (2+ empty below)
    overhangPenalty += overhangInfo.severeOverhangs * 15;
    
    // Significant extra penalty for vertical Z/S at edges - these almost always cause problems
    if (overhangInfo.edgeVerticalProblem) {
        overhangPenalty += 40;
    }
    
    // Don't apply full overhang penalty if tsunami is imminent and we're extending it
    if (tsunamiImminent && color === bestTsunamiColor) {
        overhangPenalty = Math.round(overhangPenalty * 0.3);
    } else if (buildingSpecialEvent) {
        overhangPenalty = Math.round(overhangPenalty * 0.6);
    }
    
    breakdown.overhangs.penalty = overhangPenalty;
    score -= overhangPenalty;
    
    // ====== CRITICAL HEIGHT ======
    // Less severe when tsunami is imminent - we're about to clear the board
    if (tsunamiImminent) {
        // Reduce penalties when we can see tsunami completion
        if (stackHeight >= 18) {
            breakdown.criticalHeight.penalty = 150;  // Still dangerous, but reduced
            breakdown.classification = 'survival';
        } else if (stackHeight >= 16) {
            breakdown.criticalHeight.penalty = 50;
        } else if (stackHeight >= 14) {
            breakdown.criticalHeight.penalty = 15;
        }
    } else {
        if (stackHeight >= 18) {
            breakdown.criticalHeight.penalty = 300;
            breakdown.classification = 'survival';
        } else if (stackHeight >= 16) {
            breakdown.criticalHeight.penalty = 100;
            breakdown.classification = 'defensive';
        } else if (stackHeight >= 14) {
            breakdown.criticalHeight.penalty = 30;
        } else if (stackHeight >= 12) {
            breakdown.criticalHeight.penalty = 10;
        }
    }
    score -= breakdown.criticalHeight.penalty;
    
    // ====== EMERGENCY HOLE PENALTY ======
    // Steep penalties to prevent death spirals
    // But reduce if tsunami is imminent - we're about to cascade-fill anyway
    const holeEmergencyMultiplier = tsunamiImminent ? 0.5 : 1.0;
    if (holes >= 12) {
        const emergencyPenalty = Math.round((holes - 11) * 25 * holeEmergencyMultiplier);
        breakdown.holes.penalty += emergencyPenalty;
        score -= emergencyPenalty;
    } else if (holes >= 8) {
        const emergencyPenalty = Math.round((holes - 7) * 10 * holeEmergencyMultiplier);
        breakdown.holes.penalty += emergencyPenalty;
        score -= emergencyPenalty;
    } else if (holes >= 5) {
        const emergencyPenalty = (holes - 4) * 4;
        breakdown.holes.penalty += emergencyPenalty;
        score -= emergencyPenalty;
    }
    
    // ====== LINE CLEARS ======
    let completeRows = 0;
    for (let row = 0; row < rows; row++) {
        if (board[row] && board[row].every(cell => cell !== null)) {
            completeRows++;
        }
    }
    breakdown.lineClears.count = completeRows;
    
    if (completeRows > 0) {
        if (stackHeight >= 17) {
            // Survival mode - always clear lines at extreme height
            breakdown.lineClears.bonus = completeRows * 200;
            breakdown.classification = 'survival';
        } else if (tsunamiImminent) {
            // DON'T clear lines that would break our imminent tsunami!
            // Strong penalty unless we're in extreme danger
            breakdown.lineClears.bonus = -completeRows * 100;
        } else if (stackHeight >= 15) {
            breakdown.lineClears.bonus = completeRows * 80;
            breakdown.classification = 'defensive';
        } else if (stackHeight >= 13) {
            if (tsunamiNearCompletion) {
                breakdown.lineClears.bonus = -completeRows * 30;
            } else if (tsunamiLikelyAchievable) {
                breakdown.lineClears.bonus = -completeRows * 15;
            } else {
                breakdown.lineClears.bonus = completeRows * 30;
            }
        } else if (currentUfoActive) {
            breakdown.lineClears.bonus = -completeRows * 50;
        } else if (tsunamiNearCompletion) {
            breakdown.lineClears.bonus = -completeRows * 80;
        } else if (tsunamiLikelyAchievable) {
            breakdown.lineClears.bonus = -completeRows * 50;
        } else if (hasTsunamiPotential) {
            breakdown.lineClears.bonus = -completeRows * 20;
        } else if (volcanoPotential.hasPotential) {
            breakdown.lineClears.bonus = -completeRows * 30;
        } else {
            // No special event building - reward line clears
            breakdown.lineClears.bonus = completeRows * 15;
        }
        score += breakdown.lineClears.bonus;
    }
    
    // ====== TSUNAMI BUILDING BONUS ======
    if (!isBreeze && hasTsunamiPotential && bestTsunamiColor && color === bestTsunamiColor) {
        const matchingInQueue = pieceQueue.filter(p => p && p.color === bestTsunamiColor).length;
        let tsunamiBonus = 15;
        
        if (bestTsunamiWidth >= 9) {
            tsunamiBonus += 50 + (bestTsunamiWidth - 9) * 30;
        } else if (bestTsunamiWidth >= 8) {
            tsunamiBonus += 25;
        } else if (bestTsunamiWidth >= 7) {
            tsunamiBonus += 10;
        }
        
        tsunamiBonus += matchingInQueue * 8;
        breakdown.tsunami.bonus = tsunamiBonus;
        score += breakdown.tsunami.bonus;
        
        if (!breakdown.classification || breakdown.classification === 'neutral') {
            breakdown.classification = 'offensive';
        }
    }
    
    // ====== VOLCANO BUILDING BONUS ======
    if (!isBreeze && volcanoPotential.hasPotential) {
        breakdown.volcano.bonus = 100 + volcanoPotential.innerSize * 10;
        score += breakdown.volcano.bonus;
        breakdown.classification = 'offensive';
    } else if (!isBreeze && volcanoPotential.progress > 0.3) {
        breakdown.volcano.bonus = volcanoPotential.progress * 30;
        score += breakdown.volcano.bonus;
    }
    
    // ====== BLOB BUILDING ======
    // Two types of bonuses:
    // 1. COMPLETION bonuses - for extending near-complete formations when queue supports it
    //    These should stay strong even at moderate heights (up to 15)
    // 2. SPECULATIVE bonuses - building blobs hoping good pieces come
    //    These should decrease with height
    
    // Speculative multiplier - decreases with height
    let speculativeMultiplier = 1.0;
    if (stackHeight >= 15) {
        speculativeMultiplier = 0;  // No speculative building in last 1/4
    } else if (stackHeight >= 13) {
        speculativeMultiplier = 0.25;
    } else if (stackHeight >= 10) {
        speculativeMultiplier = 0.5;
    } else if (stackHeight >= 7) {
        speculativeMultiplier = 0.75;
    }
    
    // Completion multiplier - stays strong when we can see pieces to finish
    // Only drops in death zone (height 17+)
    let completionMultiplier = inDeathZone ? 0.3 : 1.0;
    
    const canBuildBlobs = holes <= 10 && !inDeathZone;
    
    if (canBuildBlobs) {
        const runsAfter = getHorizontalRuns(board, cols, rows);
        
        // Get the rows that the piece occupies
        const pieceRows = new Set();
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px]) {
                    pieceRows.add(y + py);
                }
            }
        }
        
        // Adjacency bonuses (speculative)
        let horizontalAdj = 0;
        let verticalAdj = 0;
        
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (!shape[py][px]) continue;
                const bx = x + px;
                const by = y + py;
                
                if (bx > 0 && board[by] && board[by][bx - 1] === color) {
                    let partOfPiece = px > 0 && shape[py][px - 1];
                    if (!partOfPiece) horizontalAdj++;
                }
                
                if (bx < cols - 1 && board[by] && board[by][bx + 1] === color) {
                    let partOfPiece = px < shape[py].length - 1 && shape[py][px + 1];
                    if (!partOfPiece) horizontalAdj++;
                }
                
                if (by > 0 && board[by - 1] && board[by - 1][bx] === color) {
                    let partOfPiece = py > 0 && shape[py - 1] && shape[py - 1][px];
                    if (!partOfPiece) verticalAdj++;
                }
                
                if (by < rows - 1 && board[by + 1] && board[by + 1][bx] === color) {
                    let partOfPiece = py < shape.length - 1 && shape[py + 1] && shape[py + 1][px];
                    if (!partOfPiece) verticalAdj++;
                }
            }
        }
        
        breakdown.blob.horizontalAdj = horizontalAdj;
        breakdown.blob.verticalAdj = verticalAdj;
        
        if (isBreeze) {
            breakdown.blob.bonus = Math.round((horizontalAdj * 5 + verticalAdj * 5) * speculativeMultiplier);
            for (const run of runsAfter) {
                if (run.width >= 3 && run.color === color && pieceRows.has(run.row)) {
                    breakdown.blob.bonus += Math.round(run.width * 3 * speculativeMultiplier);
                }
            }
        } else {
            // SPECULATIVE: General adjacency bonuses (building blobs hoping for future pieces)
            breakdown.blob.bonus = Math.round((horizontalAdj * 8 + verticalAdj * 2) * speculativeMultiplier);
            
            // Wide horizontal run bonuses - ONLY for runs the piece actually contributes to
            // A piece contributes if: same color AND on the same row AND adjacent to or part of the run
            for (const run of runsAfter) {
                if (run.width >= 4) {
                    // Check if piece actually contributes to this run
                    const pieceContributesToRun = run.color === color && pieceRows.has(run.row);
                    
                    // Also check if piece is adjacent to a run of different color (blocking/extending consideration)
                    const pieceOnRunRow = pieceRows.has(run.row);
                    
                    // Only give bonuses if piece is same color AND on the run's row
                    if (!pieceContributesToRun) continue;
                    
                    const queueMatchesForRun = pieceQueue.filter(p => p && p.color === run.color).length;
                    const blocksToComplete = 10 - run.width;
                    
                    // Is this run completable with visible queue?
                    const isCompletable = run.width >= 8 && queueMatchesForRun >= blocksToComplete;
                    const isNearComplete = run.width >= 7 && queueMatchesForRun >= 2;
                    
                    // Use completion multiplier for completable runs, speculative for others
                    const runMult = (isCompletable || isNearComplete) ? completionMultiplier : speculativeMultiplier;
                    
                    let runBonus = run.width * 3;
                    if (run.touchesLeft) runBonus += run.width * 2;
                    if (run.touchesRight) runBonus += run.width * 2;
                    if (run.touchesLeft && run.touchesRight) {
                        runBonus += 400 + run.width * 15;
                        breakdown.classification = 'opportunistic';
                    }
                    // Already filtered to same color, so always apply the 1.5x
                    runBonus *= 1.5;
                    if (run.width >= 10) {
                        runBonus += (run.width - 9) * 40;
                    } else if (run.width >= 9) {
                        runBonus += 30;
                    } else if (run.width >= 8) {
                        runBonus += 15;
                    }
                    breakdown.runs.bonus += Math.round(runBonus * runMult);
                }
            }
            
            // Edge extension bonuses - only for runs of the piece's color that the piece touches
            const ourRuns = runsAfter.filter(r => r.color === color && pieceRows.has(r.row));
            for (const run of ourRuns) {
                if (run.width >= 4) {
                    const queueMatchesForRun = pieceQueue.filter(p => p && p.color === run.color).length;
                    const isCompletable = run.width >= 7 && queueMatchesForRun >= (10 - run.width);
                    const edgeMult = isCompletable ? completionMultiplier : speculativeMultiplier;
                    
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
                        breakdown.edge.bonus += Math.round(run.width * 5 * edgeMult);
                    }
                }
            }
            
            // Strategic edge placement and queue bonuses - only if piece is on the run's row
            const ourBestRun = bestRuns[color];
            if (ourBestRun && ourBestRun.width >= 5 && pieceRows.has(ourBestRun.row)) {
                const pieceMinX = x;
                const pieceMaxX = x + (shape[0] ? shape[0].length - 1 : 0);
                
                const queueMatches = pieceQueue.filter(p => p && p.color === color).length;
                const blocksNeeded = 10 - ourBestRun.width;
                const isCompletable = ourBestRun.width >= 7 && queueMatches >= blocksNeeded;
                
                // Edge extension uses completion multiplier if completable
                const edgeMult = isCompletable ? completionMultiplier : speculativeMultiplier;
                
                if (ourBestRun.touchesLeft && !ourBestRun.touchesRight && pieceMaxX >= ourBestRun.endX) {
                    breakdown.edge.bonus += Math.round((25 + ourBestRun.width * 3) * edgeMult);
                } else if (ourBestRun.touchesRight && !ourBestRun.touchesLeft && pieceMinX <= ourBestRun.startX) {
                    breakdown.edge.bonus += Math.round((25 + ourBestRun.width * 3) * edgeMult);
                } else if (!ourBestRun.touchesLeft && !ourBestRun.touchesRight) {
                    if (pieceMinX <= ourBestRun.startX || pieceMaxX >= ourBestRun.endX) {
                        breakdown.edge.bonus += Math.round((15 + ourBestRun.width) * edgeMult);
                    }
                }
                
                // Queue bonus - only if piece is contributing to this run
                breakdown.queue.matchingPieces = queueMatches;
                if (queueMatches >= 3) {
                    breakdown.queue.bonus = Math.round(ourBestRun.width * 6 * completionMultiplier);
                } else if (queueMatches >= 2) {
                    breakdown.queue.bonus = Math.round(ourBestRun.width * 4 * completionMultiplier);
                } else if (queueMatches >= 1) {
                    breakdown.queue.bonus = Math.round(ourBestRun.width * 2 * completionMultiplier);
                }
            }
        }
        
        score += breakdown.blob.bonus;
        score += breakdown.runs.bonus;
        score += breakdown.edge.bonus;
        score += breakdown.queue.bonus;
    }
    
    // Set default classification
    if (!breakdown.classification || breakdown.classification === 'neutral') {
        if (breakdown.blob.bonus > 20 || breakdown.runs.bonus > 30 || breakdown.volcano.bonus > 0) {
            breakdown.classification = 'offensive';
        } else if (breakdown.holes.penalty > 20 || breakdown.height.penalty > 15) {
            breakdown.classification = 'defensive';
        } else {
            breakdown.classification = 'neutral';
        }
    }
    
    return { score, breakdown };
}

function evaluateBoard(board, shape, x, y, color, cols, rows) {
    let score = 0;
    
    const holes = countHoles(board);
    const stackHeight = getStackHeight(board, rows);
    const bumpiness = getBumpiness(board);
    const colHeights = getColumnHeights(board, cols, rows);
    
    const isBreeze = currentSkillLevel === 'breeze';
    
    // ====== DANGER ZONE CHECK ======
    // Height-based zones for different behaviors
    const inDangerZone = stackHeight >= 12 || holes >= 8;
    const inCriticalZone = stackHeight >= 15 || holes >= 12; // Last 1/4 of well
    const inDeathZone = stackHeight >= 17 || holes >= 15;
    
    // ====== SPECIAL EVENT DETECTION ======
    const runs = getHorizontalRuns(board, cols, rows);
    const bestRuns = getBestRunsPerColor(runs);
    
    // Tsunami detection - separate imminent from speculative
    let hasTsunamiPotential = false;
    let tsunamiLikelyAchievable = false;
    let tsunamiNearCompletion = false;
    let tsunamiImminent = false;
    let bestTsunamiWidth = 0;
    let bestTsunamiColor = null;
    
    if (!isBreeze) {
        for (const runColor in bestRuns) {
            const run = bestRuns[runColor];
            const queueMatches = pieceQueue.filter(p => p && p.color === runColor).length;
            const blocksNeeded = 10 - run.width;
            
            // IMMINENT: Can complete with visible queue (always allowed except death zone)
            if (!inDeathZone) {
                if (run.width >= 10 || 
                    (run.width >= 8 && queueMatches >= blocksNeeded) ||
                    (run.width >= 9 && queueMatches >= 1)) {
                    tsunamiImminent = true;
                    tsunamiNearCompletion = true;
                }
            }
            
            // NEAR COMPLETION: Very close (allowed up to critical zone)
            if (!inCriticalZone) {
                if (run.width >= 9 || (run.width >= 8 && queueMatches >= 2)) {
                    tsunamiNearCompletion = true;
                }
            }
            
            // ACHIEVABLE: Speculative (only at safe heights)
            if (!inDangerZone) {
                if (run.width >= 9 || (run.width >= 8 && queueMatches >= 1) || (run.width >= 7 && queueMatches >= 2)) {
                    tsunamiLikelyAchievable = true;
                }
            }
            
            // POTENTIAL: Most speculative
            const effectiveThreshold = queueMatches >= 2 ? 5 : (queueMatches >= 1 ? 6 : 7);
            if (run.width >= effectiveThreshold && !inCriticalZone) {
                hasTsunamiPotential = true;
                if (run.width > bestTsunamiWidth) {
                    bestTsunamiWidth = run.width;
                    bestTsunamiColor = runColor;
                }
            }
        }
    }
    
    // Volcano detection - skip in danger zone
    let volcanoPotential = { hasPotential: false, progress: 0, innerSize: 0 };
    if (!isBreeze && !inDangerZone) {
        volcanoPotential = findVolcanoPotential(board, cols, rows);
    }
    
    // Building special event - includes imminent tsunamis
    const buildingSpecialEvent = tsunamiImminent || 
        (!inCriticalZone && (tsunamiLikelyAchievable || volcanoPotential.hasPotential));
    
    // ====== HOLE PENALTIES - CASCADE AWARE BUT NOT RECKLESS ======
    if (tsunamiImminent && holes <= 8) {
        score -= holes * 2;  // Very lenient for imminent completion
    } else if (tsunamiNearCompletion && holes <= 6) {
        score -= holes * 3;
    } else if (buildingSpecialEvent && holes <= 8) {
        score -= holes * 5;
    } else if (hasTsunamiPotential && holes <= 5) {
        score -= holes * 6;
    } else {
        if (holes <= 2) {
            score -= holes * 7;
        } else if (holes <= 5) {
            score -= 14 + (holes - 2) * 10;
        } else {
            score -= 44 + (holes - 5) * 18;
        }
    }
    
    // ====== HEIGHT PENALTIES ======
    if (buildingSpecialEvent && stackHeight < 17) {
        score -= stackHeight * 0.6;
    } else {
        score -= stackHeight * 1.0;
    }
    
    // ====== BUMPINESS ======
    if (buildingSpecialEvent) {
        score -= bumpiness * 0.3;
    } else {
        score -= bumpiness * 0.8;
    }
    
    // ====== DEEP WELLS ======
    for (let col = 0; col < cols; col++) {
        const leftHeight = col > 0 ? colHeights[col - 1] : colHeights[col];
        const rightHeight = col < cols - 1 ? colHeights[col + 1] : colHeights[col];
        const minNeighbor = Math.min(leftHeight, rightHeight);
        const wellDepth = minNeighbor - colHeights[col];
        if (wellDepth > 3) {
            score -= (wellDepth - 3) * 3;
        }
    }
    
    // ====== OVERHANG PENALTY ======
    // Penalize piece placements that create overhangs (cells over empty space)
    const overhangInfo = analyzeOverhangs(board, shape, x, y, cols, rows);
    
    let overhangPenalty = overhangInfo.overhangCount * 8;
    overhangPenalty += overhangInfo.severeOverhangs * 15;
    
    // Significant extra penalty for vertical Z/S at edges
    if (overhangInfo.edgeVerticalProblem) {
        overhangPenalty += 40;
    }
    
    // Reduce penalty if building toward imminent tsunami
    if (tsunamiImminent && color === bestTsunamiColor) {
        overhangPenalty = Math.round(overhangPenalty * 0.3);
    } else if (buildingSpecialEvent) {
        overhangPenalty = Math.round(overhangPenalty * 0.6);
    }
    
    score -= overhangPenalty;
    
    // ====== CRITICAL HEIGHT ======
    // Less severe when tsunami is imminent
    if (tsunamiImminent) {
        if (stackHeight >= 18) {
            score -= 150;
        } else if (stackHeight >= 16) {
            score -= 50;
        } else if (stackHeight >= 14) {
            score -= 15;
        }
    } else {
        if (stackHeight >= 18) {
            score -= 300;
        } else if (stackHeight >= 16) {
            score -= 100;
        } else if (stackHeight >= 14) {
            score -= 30;
        } else if (stackHeight >= 12) {
            score -= 10;
        }
    }
    
    // ====== EMERGENCY HOLE PENALTY ======
    // Steep penalties, but reduced if tsunami is imminent
    const holeEmergencyMult = tsunamiImminent ? 0.5 : 1.0;
    if (holes >= 12) {
        score -= Math.round((holes - 11) * 25 * holeEmergencyMult);
    } else if (holes >= 8) {
        score -= Math.round((holes - 7) * 10 * holeEmergencyMult);
    } else if (holes >= 5) {
        score -= Math.round((holes - 4) * 4 * holeEmergencyMult);
    }
    
    // ====== LINE CLEARS ======
    let completeRows = 0;
    for (let row = 0; row < rows; row++) {
        if (board[row] && board[row].every(cell => cell !== null)) {
            completeRows++;
        }
    }
    
    if (completeRows > 0) {
        if (stackHeight >= 17) {
            // Critical emergency - must clear
            score += completeRows * 200;
        } else if (tsunamiImminent) {
            // DON'T clear lines that would break imminent tsunami!
            score -= completeRows * 100;
        } else if (stackHeight >= 15) {
            // Dangerous - clearing is strongly encouraged
            score += completeRows * 80;
        } else if (stackHeight >= 13) {
            if (tsunamiNearCompletion) {
                score -= completeRows * 30;
            } else if (tsunamiLikelyAchievable) {
                score -= completeRows * 15;
            } else {
                score += completeRows * 30;
            }
        } else if (currentUfoActive) {
            score -= completeRows * 50;
        } else if (tsunamiNearCompletion) {
            score -= completeRows * 80;
        } else if (tsunamiLikelyAchievable) {
            score -= completeRows * 50;
        } else if (hasTsunamiPotential) {
            score -= completeRows * 20;
        } else if (volcanoPotential.hasPotential) {
            score -= completeRows * 30;
        } else {
            // No special event building - reward line clears
            score += completeRows * 15;
        }
    }
    
    // ====== TSUNAMI BUILDING BONUSES ======
    if (!isBreeze && hasTsunamiPotential && bestTsunamiColor && color === bestTsunamiColor) {
        const matchingInQueue = pieceQueue.filter(p => p && p.color === bestTsunamiColor).length;
        
        // Base bonus for matching color
        let tsunamiBonus = 15;
        
        // Scale with width - exponential as we approach completion
        if (bestTsunamiWidth >= 9) {
            tsunamiBonus += 50 + (bestTsunamiWidth - 9) * 30;
        } else if (bestTsunamiWidth >= 8) {
            tsunamiBonus += 25;
        } else if (bestTsunamiWidth >= 7) {
            tsunamiBonus += 10;
        }
        
        // Queue support bonus
        tsunamiBonus += matchingInQueue * 8;
        
        score += tsunamiBonus;
    }
    
    // ====== VOLCANO BUILDING BONUSES ======
    if (!isBreeze && volcanoPotential.hasPotential) {
        // Full volcano ready - massive bonus
        score += 100 + volcanoPotential.innerSize * 10;
    } else if (!isBreeze && volcanoPotential.progress > 0.3) {
        // Building toward volcano
        score += volcanoPotential.progress * 30;
    }
    
    // ====== BLOB BUILDING ======
    // Separate speculative building (decreases with height) from completion (stays strong)
    let speculativeMultiplier = 1.0;
    if (stackHeight >= 15) {
        speculativeMultiplier = 0;
    } else if (stackHeight >= 13) {
        speculativeMultiplier = 0.25;
    } else if (stackHeight >= 10) {
        speculativeMultiplier = 0.5;
    } else if (stackHeight >= 7) {
        speculativeMultiplier = 0.75;
    }
    
    let completionMultiplier = inDeathZone ? 0.3 : 1.0;
    
    const canBuildBlobs = holes <= 10 && !inDeathZone;
    
    if (canBuildBlobs) {
        const runsAfter = getHorizontalRuns(board, cols, rows);
        
        // Get the rows that the piece occupies
        const pieceRows = new Set();
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px]) {
                    pieceRows.add(y + py);
                }
            }
        }
        
        // Adjacency bonuses (speculative)
        let horizontalAdj = 0;
        let verticalAdj = 0;
        
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (!shape[py][px]) continue;
                const bx = x + px;
                const by = y + py;
                
                if (bx > 0 && board[by] && board[by][bx - 1] === color) {
                    let partOfPiece = px > 0 && shape[py][px - 1];
                    if (!partOfPiece) horizontalAdj++;
                }
                
                if (bx < cols - 1 && board[by] && board[by][bx + 1] === color) {
                    let partOfPiece = px < shape[py].length - 1 && shape[py][px + 1];
                    if (!partOfPiece) horizontalAdj++;
                }
                
                if (by > 0 && board[by - 1] && board[by - 1][bx] === color) {
                    let partOfPiece = py > 0 && shape[py - 1] && shape[py - 1][px];
                    if (!partOfPiece) verticalAdj++;
                }
                
                if (by < rows - 1 && board[by + 1] && board[by + 1][bx] === color) {
                    let partOfPiece = py < shape.length - 1 && shape[py + 1] && shape[py + 1][px];
                    if (!partOfPiece) verticalAdj++;
                }
            }
        }
        
        if (isBreeze) {
            score += Math.round((horizontalAdj * 5 + verticalAdj * 5) * speculativeMultiplier);
            for (const run of runsAfter) {
                if (run.width >= 3 && run.color === color && pieceRows.has(run.row)) {
                    score += Math.round(run.width * 3 * speculativeMultiplier);
                }
            }
        } else {
            // Speculative adjacency
            score += Math.round((horizontalAdj * 8 + verticalAdj * 2) * speculativeMultiplier);
        
            // Wide horizontal run bonuses - ONLY for runs the piece actually contributes to
            for (const run of runsAfter) {
                if (run.width >= 4) {
                    // Only give bonuses if piece is same color AND on the run's row
                    if (run.color !== color || !pieceRows.has(run.row)) continue;
                    
                    const queueMatchesForRun = pieceQueue.filter(p => p && p.color === run.color).length;
                    const blocksToComplete = 10 - run.width;
                    const isCompletable = run.width >= 8 && queueMatchesForRun >= blocksToComplete;
                    const isNearComplete = run.width >= 7 && queueMatchesForRun >= 2;
                    const runMult = (isCompletable || isNearComplete) ? completionMultiplier : speculativeMultiplier;
                    
                    let runBonus = run.width * 3;
                    if (run.touchesLeft) runBonus += run.width * 2;
                    if (run.touchesRight) runBonus += run.width * 2;
                    if (run.touchesLeft && run.touchesRight) {
                        runBonus += 400 + run.width * 15;
                    }
                    // Already filtered to same color, so always apply the 1.5x
                    runBonus *= 1.5;
                    if (run.width >= 10) {
                        runBonus += (run.width - 9) * 40;
                    } else if (run.width >= 9) {
                        runBonus += 30;
                    } else if (run.width >= 8) {
                        runBonus += 15;
                    }
                    
                    score += Math.round(runBonus * runMult);
                }
            }
            
            // Edge extension bonuses - only for runs of piece's color that piece touches
            const ourRuns = runsAfter.filter(r => r.color === color && pieceRows.has(r.row));
            for (const run of ourRuns) {
                if (run.width >= 4) {
                    const queueMatchesForRun = pieceQueue.filter(p => p && p.color === run.color).length;
                    const isCompletable = run.width >= 7 && queueMatchesForRun >= (10 - run.width);
                    const edgeMult = isCompletable ? completionMultiplier : speculativeMultiplier;
                    
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
                        score += Math.round(run.width * 5 * edgeMult);
                    }
                }
            }
            
            // Strategic edge placement and queue bonuses - only if piece is on the run's row
            const pieceMinX = x;
            const pieceMaxX = x + (shape[0] ? shape[0].length - 1 : 0);
            
            const ourBestRun = bestRuns[color];
            // Only give bonuses if the piece is actually on the run's row
            if (ourBestRun && ourBestRun.width >= 5 && pieceRows.has(ourBestRun.row)) {
                const queueMatches = pieceQueue.filter(p => p && p.color === color).length;
                const blocksNeeded = 10 - ourBestRun.width;
                const isCompletable = ourBestRun.width >= 7 && queueMatches >= blocksNeeded;
                const edgeMult = isCompletable ? completionMultiplier : speculativeMultiplier;
                
                if (ourBestRun.touchesLeft && !ourBestRun.touchesRight && pieceMaxX >= ourBestRun.endX) {
                    score += Math.round((25 + ourBestRun.width * 3) * edgeMult);
                } else if (ourBestRun.touchesRight && !ourBestRun.touchesLeft && pieceMinX <= ourBestRun.startX) {
                    score += Math.round((25 + ourBestRun.width * 3) * edgeMult);
                } else if (!ourBestRun.touchesLeft && !ourBestRun.touchesRight) {
                    if (pieceMinX <= ourBestRun.startX || pieceMaxX >= ourBestRun.endX) {
                        score += Math.round((15 + ourBestRun.width) * edgeMult);
                    }
                }
                
                // Queue bonus only if piece is contributing to this run
                if (queueMatches >= 3) {
                    score += Math.round(ourBestRun.width * 6 * completionMultiplier);
                } else if (queueMatches >= 2) {
                    score += Math.round(ourBestRun.width * 4 * completionMultiplier);
                } else if (queueMatches >= 1) {
                    score += Math.round(ourBestRun.width * 2 * completionMultiplier);
                }
            }
            
            // Volcano-building: reward bottom-edge + side-edge placements
            const pieceMinY = y;
            const pieceMaxY = y + shape.length - 1;
            
            if (pieceMaxY === rows - 1) {
                if (pieceMinX === 0 || pieceMaxX === cols - 1) {
                    score += Math.round(10 * speculativeMultiplier);
                    if (volcanoPotential.progress > 0.2) {
                        score += Math.round(15 * speculativeMultiplier);
                    }
                }
            }
        }
    }
    
    return score;
}

// ==================== PLACEMENT GENERATION ====================

function generatePlacements(board, piece, cols, rows, captureBreakdown = false) {
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
            
            if (captureBreakdown) {
                const { score, breakdown } = evaluateBoardWithBreakdown(newBoard, rotatedShape, x, y, piece.color, cols, rows);
                placements.push({ x, y, rotationIndex, shape: rotatedShape, score, breakdown });
            } else {
                const score = evaluateBoard(newBoard, rotatedShape, x, y, piece.color, cols, rows);
                placements.push({ x, y, rotationIndex, shape: rotatedShape, score });
            }
        }
    }
    
    return placements;
}

function findBestPlacement(board, piece, cols, rows, queue, captureDecisionMeta = false) {
    // Use breakdown capture for decision metadata
    const placements = generatePlacements(board, piece, cols, rows, captureDecisionMeta);
    
    if (placements.length === 0) {
        return captureDecisionMeta ? { placement: null, decisionMeta: null } : null;
    }
    
    let bestPlacement;
    
    // Use queue for 2-ply lookahead (current + 1 next piece)
    // Reduced from 4-ply for performance with volcano detection
    // All 4 queue pieces are still considered for tsunami potential in evaluateBoard
    const nextPiece = queue && queue.length > 0 ? queue[0] : null;
    
    if (nextPiece) {
        // 2-ply lookahead: consider where next piece can go
        for (const placement of placements) {
            const newBoard = placePiece(board, placement.shape, placement.x, placement.y, piece.color);
            const nextPlacements = generatePlacements(newBoard, nextPiece, cols, rows);
            
            if (nextPlacements.length > 0) {
                // Get best next placement
                const bestNext = nextPlacements.reduce((a, b) => a.score > b.score ? a : b);
                placement.combinedScore = placement.score + bestNext.score * 0.5; // Next piece counts 50%
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
    
    // Build decision metadata if requested
    if (captureDecisionMeta) {
        const sortedPlacements = [...placements].sort((a, b) => 
            (b.combinedScore || b.score) - (a.combinedScore || a.score)
        );
        
        const secondBest = sortedPlacements.length > 1 ? sortedPlacements[1] : null;
        const scoreDifferential = secondBest ? 
            (bestPlacement.combinedScore || bestPlacement.score) - (secondBest.combinedScore || secondBest.score) : null;
        
        // Get board metrics
        const holes = countHoles(board);
        const bumpiness = getBumpiness(board);
        
        const decisionMeta = {
            chosen: {
                x: bestPlacement.x,
                y: bestPlacement.y,
                rotation: bestPlacement.rotationIndex,
                immediateScore: Math.round(bestPlacement.score * 100) / 100,
                combinedScore: bestPlacement.combinedScore ? Math.round(bestPlacement.combinedScore * 100) / 100 : null,
                breakdown: bestPlacement.breakdown || null,
                classification: bestPlacement.breakdown?.classification || 'unknown'
            },
            alternatives: sortedPlacements.slice(1, 4).map(p => ({
                x: p.x,
                y: p.y,
                rotation: p.rotationIndex,
                immediateScore: Math.round(p.score * 100) / 100,
                combinedScore: p.combinedScore ? Math.round(p.combinedScore * 100) / 100 : null,
                classification: p.breakdown?.classification || 'unknown'
            })),
            scoreDifferential: scoreDifferential ? Math.round(scoreDifferential * 100) / 100 : null,
            boardMetrics: {
                stackHeight,
                holes,
                bumpiness
            },
            lookahead: {
                depth: nextPiece ? 2 : 1,
                queueColors: queue ? queue.map(p => p?.color || null) : []
            },
            candidatesEvaluated: placements.length,
            skillLevel: currentSkillLevel
        };
        
        return { placement: bestPlacement, decisionMeta };
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
    
    // Shadow evaluation - calculate what AI would do without recording or executing
    if (command === 'shadowEvaluate') {
        currentSkillLevel = skillLevel || 'tempest';
        pieceQueue = queue || [];
        currentUfoActive = ufoActive || false;
        
        setTimeout(() => {
            const result = findBestPlacement(board, piece, cols, rows, pieceQueue, true);
            self.postMessage({ 
                shadowResponse: true,
                decisionMeta: result ? result.decisionMeta : null
            });
        }, 0);
        return;
    }
    
    currentSkillLevel = skillLevel || 'tempest';
    pieceQueue = queue || [];
    currentUfoActive = ufoActive || false;
    
    // Check if decision metadata is requested
    const captureDecisionMeta = e.data.captureDecisionMeta || false;
    
    setTimeout(() => {
        const result = findBestPlacement(board, piece, cols, rows, pieceQueue, captureDecisionMeta);
        const stackHeight = getStackHeight(board, rows);
        
        if (captureDecisionMeta && result) {
            self.postMessage({ 
                bestPlacement: result.placement, 
                stackHeight,
                decisionMeta: result.decisionMeta
            });
        } else {
            self.postMessage({ bestPlacement: result, stackHeight });
        }
    }, 0);
};

// Send ready message immediately when worker loads
self.postMessage({ ready: true, version: AI_VERSION });
