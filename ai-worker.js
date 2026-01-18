// AI Worker v5.19.0 - Foundation penalty: extra hole penalty at low stack heights
console.log("🤖 AI Worker v5.19.0 loaded - Foundation penalty for early holes, stack-based tsunami lookahead");

const AI_VERSION = "5.19.0";

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
 * 
 * @param colHeights - optional array of column heights to determine if edge placement helps or hurts
 */
function analyzeOverhangs(board, shape, x, y, cols, rows, colHeights = null) {
    let overhangCount = 0;
    let severeOverhangs = 0;  // Cells with 2+ empty spaces below them
    let edgeVerticalProblem = false;
    
    // Detect the piece type by shape signature
    const shapeHeight = shape.length;
    const shapeWidth = shape[0] ? shape[0].length : 0;
    
    // Z/S pieces in vertical orientation have height=3, width=2
    const isVerticalZS = shapeHeight === 3 && shapeWidth === 2;
    
    // Check if this vertical Z/S is at an edge AND would create a problem
    // Key insight: only penalize if edge is HIGHER than adjacent (creates overhang)
    // Don't penalize if edge is LOWER (fills a gap - that's good!)
    if (isVerticalZS && colHeights) {
        if (x === 0) {
            // Left edge - only a problem if col 0 >= col 1 (would create overhang)
            if (colHeights[0] >= colHeights[1]) {
                edgeVerticalProblem = true;
            }
        } else if (x === cols - 2) {
            // Right edge - only a problem if col 9 >= col 8
            if (colHeights[cols - 1] >= colHeights[cols - 2]) {
                edgeVerticalProblem = true;
            }
        }
    } else if (isVerticalZS && !colHeights) {
        // Fallback if no height info - be conservative
        if (x === 0 || x === cols - 2) {
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
 * Simulate placing a piece and clearing lines, return the resulting board state
 * Used for tsunami lookahead - checking if a placement would destroy a tsunami opportunity
 */
function simulatePlacementWithLineClear(board, shape, x, y, color, cols, rows) {
    // Deep copy the board
    const newBoard = [];
    for (let row = 0; row < rows; row++) {
        newBoard[row] = board[row] ? [...board[row]] : new Array(cols).fill(null);
    }
    
    // Place the piece
    for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
            if (shape[py][px]) {
                const bx = x + px;
                const by = y + py;
                if (by >= 0 && by < rows && bx >= 0 && bx < cols) {
                    newBoard[by][bx] = color;
                }
            }
        }
    }
    
    // Check for and clear complete lines
    let linesCleared = 0;
    const linesToClear = [];
    
    for (let row = 0; row < rows; row++) {
        if (newBoard[row] && newBoard[row].every(cell => cell !== null)) {
            linesToClear.push(row);
            linesCleared++;
        }
    }
    
    // Clear lines (shift rows down)
    if (linesCleared > 0) {
        // Remove cleared rows and add empty rows at top
        const clearedBoard = [];
        for (let row = 0; row < rows; row++) {
            if (!linesToClear.includes(row)) {
                clearedBoard.push(newBoard[row]);
            }
        }
        // Add empty rows at top
        while (clearedBoard.length < rows) {
            clearedBoard.unshift(new Array(cols).fill(null));
        }
        return { board: clearedBoard, linesCleared };
    }
    
    return { board: newBoard, linesCleared: 0 };
}

/**
 * Check if a tsunami run survives after simulated line clear
 * Returns { survives: boolean, newWidth: number, newRow: number }
 */
function checkTsunamiAfterLineClear(simulatedBoard, tsunamiColor, originalRun, cols, rows) {
    // Find the best run of tsunamiColor in the simulated board
    let bestRun = null;
    
    for (let row = 0; row < rows; row++) {
        if (!simulatedBoard[row]) continue;
        
        let runStart = -1;
        for (let col = 0; col <= cols; col++) {
            const cell = col < cols ? simulatedBoard[row][col] : null;
            if (cell === tsunamiColor) {
                if (runStart < 0) runStart = col;
            } else {
                if (runStart >= 0) {
                    const width = col - runStart;
                    if (!bestRun || width > bestRun.width) {
                        bestRun = { row, startX: runStart, width, endX: col - 1 };
                    }
                }
                runStart = -1;
            }
        }
    }
    
    if (!bestRun) {
        return { survives: false, newWidth: 0, newRow: -1 };
    }
    
    // Check if the extension path is still clear
    const leftClear = bestRun.startX === 0 || 
        (simulatedBoard[bestRun.row] && simulatedBoard[bestRun.row][bestRun.startX - 1] === null);
    const rightClear = bestRun.endX === cols - 1 || 
        (simulatedBoard[bestRun.row] && simulatedBoard[bestRun.row][bestRun.endX + 1] === null);
    
    const canComplete = (leftClear || bestRun.startX === 0) || (rightClear || bestRun.endX === cols - 1);
    
    return { 
        survives: bestRun.width >= originalRun.width - 1 && canComplete,  // Allow 1 cell loss
        newWidth: bestRun.width, 
        newRow: bestRun.row 
    };
}

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
        wells: { count: 0, penalty: 0, deepest: 0 },
        edgeWells: { leftDepth: 0, rightDepth: 0, penalty: 0, fillBonus: 0 },
        iPieceWells: { worstDepth: 0, worstCol: -1, count: 0, penalty: 0 },
        overhangs: { count: 0, severe: 0, edgeVertical: false, penalty: 0 },
        criticalHeight: { penalty: 0 },
        lineClears: { count: 0, bonus: 0, tsunamiSurvives: true, postClearWidth: 0, destroysTsunami: false },
        tsunami: { potential: false, achievable: false, nearCompletion: false, imminent: false, width: 0, color: null, bonus: 0, blockingPenalty: 0, expanding: false, earlyCompletion: false, completing: false },
        volcano: { potential: false, progress: 0, innerSize: 0, bonus: 0 },
        blob: { horizontalAdj: 0, verticalAdj: 0, bonus: 0 },
        runs: { bonus: 0 },
        edge: { bonus: 0 },
        queue: { matchingPieces: 0, bonus: 0 },
        survivalFill: 0,
        verticalPenalty: 0,
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
    // LOWERED hole thresholds - holes are more dangerous than previously thought
    const inDangerZone = stackHeight >= 12 || holes >= 5;  // Was 8
    const inCriticalZone = stackHeight >= 15 || holes >= 8; // Was 12
    const inDeathZone = stackHeight >= 17 || holes >= 12;   // Was 15
    
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
            
            // IMPORTANT: Current piece counts as a match if it's the same color!
            const currentPieceMatches = (color === runColor) ? 1 : 0;
            const totalMatches = queueMatches + currentPieceMatches;
            
            // IMMINENT: Can complete with current piece + visible queue pieces
            // This is ALWAYS worth doing - including at high stacks! Completing clears board!
            // Only skip in death zone if run is still small
            if (run.width >= 10) {
                tsunamiImminent = true;
                tsunamiNearCompletion = true;
            } else if (run.width >= 9 && totalMatches >= 1) {
                // Width 9 + 1 matching = can complete
                tsunamiImminent = true;
                tsunamiNearCompletion = true;
            } else if (run.width >= 8 && totalMatches >= blocksNeeded) {
                // Width 8 + 2 matching (current + queue)
                tsunamiImminent = true;
                tsunamiNearCompletion = true;
            } else if (!inDeathZone && run.width >= 8 && totalMatches >= 1) {
                // Width 8 + 1 matching - getting close
                tsunamiNearCompletion = true;
            }
            
            // NEAR COMPLETION: Very close, worth prioritizing even at moderate height
            // Allow at critical zone if run is already wide (8+)
            if (run.width >= 9 || (run.width >= 8 && totalMatches >= 2)) {
                tsunamiNearCompletion = true;
            } else if (!inCriticalZone && run.width >= 8 && totalMatches >= 1) {
                tsunamiNearCompletion = true;
            }
            
            // ACHIEVABLE: Good chance with a few more pieces - only at safe heights
            // This is speculative building, scale with height
            if (!inDangerZone) {
                if (run.width >= 9 || (run.width >= 8 && totalMatches >= 1) || (run.width >= 7 && totalMatches >= 2)) {
                    tsunamiLikelyAchievable = true;
                }
            }
            
            // POTENTIAL: Could become tsunami - most speculative
            // Lower threshold for edge-touching runs - they're more valuable
            // Also lower threshold when current piece matches
            let effectiveThreshold;
            if (run.touchesRight || run.touchesLeft) {
                // Edge-touching runs are more valuable - lower threshold
                effectiveThreshold = totalMatches >= 2 ? 4 : (totalMatches >= 1 ? 5 : 6);
            } else {
                effectiveThreshold = totalMatches >= 2 ? 5 : (totalMatches >= 1 ? 6 : 7);
            }
            
            // ALWAYS track the best run - needed for blocking penalty and completion bonuses
            if (run.width >= effectiveThreshold) {
                const currentBonus = currentPieceMatches ? 0.5 : 0;
                const effectiveWidth = run.width + currentBonus;
                if (effectiveWidth > bestTsunamiWidth) {
                    bestTsunamiWidth = run.width;
                    bestTsunamiColor = runColor;
                }
                
                // Grant potential bonuses based on width AND height
                // Wide runs (8+) get potential even at high stacks - completing saves the game!
                if (run.width >= 8) {
                    hasTsunamiPotential = true;  // Always for wide runs
                } else if (!inCriticalZone) {
                    hasTsunamiPotential = true;  // Smaller runs only at safe heights
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
    
    // ====== HOLE PENALTIES - SURVIVAL CRITICAL ======
    // Holes prevent line clears - the #1 survival problem
    // RADICAL CHANGE: Only reduce for truly IMMINENT tsunamis, not "potential"
    
    // First, count holes per column to detect "scattered" patterns
    const holesPerCol = new Array(cols).fill(0);
    for (let col = 0; col < cols; col++) {
        let foundBlock = false;
        for (let row = 0; row < rows; row++) {
            if (board[row] && board[row][col]) {
                foundBlock = true;
            } else if (foundBlock && board[row]) {
                holesPerCol[col]++;
            }
        }
    }
    const columnsWithHoles = holesPerCol.filter(h => h > 0).length;
    
    // Base hole penalty - ONLY reduce for imminent tsunamis
    if (tsunamiImminent && holes <= 4) {
        // Can see the pieces to complete - some leniency
        breakdown.holes.penalty = holes * 6;
    } else if (tsunamiNearCompletion && holes <= 3 && stackHeight < 12) {
        // Very close to completion at safe height
        breakdown.holes.penalty = holes * 8;
    } else {
        // NO REDUCTION for "potential" or "achievable" - SURVIVAL FIRST
        // Quadratic scaling for many holes
        if (holes <= 2) {
            breakdown.holes.penalty = holes * 15;  // Increased from 12
        } else if (holes <= 5) {
            breakdown.holes.penalty = 30 + (holes - 2) * 20;  // Increased
        } else if (holes <= 10) {
            breakdown.holes.penalty = 90 + (holes - 5) * 25;  // Increased
        } else {
            // Many holes - catastrophic
            breakdown.holes.penalty = 215 + (holes - 10) * 30;
        }
    }
    
    // SCATTERED HOLES PENALTY - having holes in multiple columns is worse
    // Each additional column with holes makes recovery exponentially harder
    if (columnsWithHoles >= 5) {
        // Disaster - holes spread across 5+ columns, very hard to fill
        breakdown.holes.penalty += columnsWithHoles * columnsWithHoles * 4;  // 5cols=100, 7cols=196, 8cols=256
    } else if (columnsWithHoles >= 3) {
        // Multiple columns with holes - penalize
        breakdown.holes.penalty += columnsWithHoles * 12;
    }
    
    // FOUNDATION PENALTY - holes at LOW stack are devastating!
    // You're building your foundation wrong - this will compound throughout the game
    if (stackHeight <= 6 && holes > 0) {
        // MASSIVE penalty for any holes during foundation building
        breakdown.holes.penalty += holes * 25;  // Extra 25 per hole
        if (columnsWithHoles >= 2) {
            breakdown.holes.penalty += columnsWithHoles * 15;  // Extra for scattered
        }
    } else if (stackHeight <= 10 && holes > 1) {
        // Still penalize holes in early-mid game
        breakdown.holes.penalty += (holes - 1) * 15;
    }
    
    // Extra penalty at high stacks - holes are more deadly
    if (stackHeight >= 14 && holes > 1) {
        breakdown.holes.penalty = Math.round(breakdown.holes.penalty * 1.8);
    } else if (stackHeight >= 12 && holes > 2) {
        breakdown.holes.penalty = Math.round(breakdown.holes.penalty * 1.4);
    }
    
    breakdown.holes.penalty = Math.round(breakdown.holes.penalty);
    score -= breakdown.holes.penalty;
    
    // ====== HEIGHT PENALTY ======
    // Height is the #1 survival factor - MASSIVE penalty
    let heightMultiplier = 2.5;  // Was 1.5 - DRASTICALLY increased
    
    // Only reduce for truly imminent tsunamis with clean board
    if (tsunamiImminent && holes <= 2) {
        heightMultiplier = 1.0;
    }
    // NO reduction for anything else
    
    // Additional penalty scaling for dangerous heights
    if (stackHeight >= 16) {
        heightMultiplier *= 2.5;
    } else if (stackHeight >= 14) {
        heightMultiplier *= 2.0;
    } else if (stackHeight >= 12) {
        heightMultiplier *= 1.5;
    } else if (stackHeight >= 10) {
        heightMultiplier *= 1.2;
    }
    
    breakdown.height.penalty = stackHeight * heightMultiplier;
    score -= breakdown.height.penalty;
    
    // ====== BUMPINESS ======
    // Bumpiness prevents line clears - MASSIVE penalty
    // DRASTICALLY INCREASED - flat surfaces are essential for survival
    let bumpinessMultiplier = 3.0;  // Was 1.5 - DOUBLED AGAIN
    
    // Only reduce for truly imminent tsunamis with clean board
    if (tsunamiImminent && holes <= 2 && stackHeight < 12) {
        bumpinessMultiplier = 1.0;  // Still penalize, just less
    }
    // NO reduction for anything else
    
    // Scale up at dangerous heights
    if (stackHeight >= 16) {
        bumpinessMultiplier = Math.max(bumpinessMultiplier, 6.0);
    } else if (stackHeight >= 14) {
        bumpinessMultiplier = Math.max(bumpinessMultiplier, 5.0);
    } else if (stackHeight >= 12) {
        bumpinessMultiplier = Math.max(bumpinessMultiplier, 4.0);
    } else if (stackHeight >= 10) {
        bumpinessMultiplier = Math.max(bumpinessMultiplier, 3.5);
    }
    
    breakdown.bumpiness.penalty = bumpiness * bumpinessMultiplier;
    score -= breakdown.bumpiness.penalty;
    
    // ====== DEEP WELLS ======
    // Heavily penalize deep wells - they're death traps at high stacks
    // INCREASED penalties to prevent wells from forming
    let wellPenalty = 0;
    let wellCount = 0;
    let deepestWell = 0;
    for (let col = 0; col < cols; col++) {
        const leftHeight = col > 0 ? colHeights[col - 1] : colHeights[col];
        const rightHeight = col < cols - 1 ? colHeights[col + 1] : colHeights[col];
        const minNeighbor = Math.min(leftHeight, rightHeight);
        const wellDepth = minNeighbor - colHeights[col];
        deepestWell = Math.max(deepestWell, wellDepth);
        if (wellDepth > 2) {
            // Exponential penalty for deep wells - INCREASED base
            let thisWellPenalty = wellDepth * wellDepth * 1.5;  // Was just wellDepth^2
            
            // Extra penalty at high stacks
            if (stackHeight >= 14) {
                thisWellPenalty *= 2.5;  // Was 2
            } else if (stackHeight >= 12) {
                thisWellPenalty *= 1.8;  // Was 1.5
            } else if (stackHeight >= 8) {
                thisWellPenalty *= 1.3;  // NEW: penalize even at medium stacks
            }
            
            wellPenalty += thisWellPenalty;
            wellCount++;
        }
    }
    breakdown.wells.count = wellCount;
    breakdown.wells.penalty = wellPenalty;
    breakdown.wells.deepest = deepestWell;
    score -= wellPenalty;
    
    // ====== EDGE WELL DISPARITY PENALTY ======
    // Penalize when edge columns (0 and 9) are much lower than the middle
    // This creates I-piece dependency which is a death sentence
    // SIGNIFICANTLY INCREASED - the AI was leaving edges empty too often
    const middleAvgHeight = (colHeights[2] + colHeights[3] + colHeights[4] + colHeights[5] + colHeights[6] + colHeights[7]) / 6;
    const leftEdgeDepth = Math.max(0, middleAvgHeight - colHeights[0]);
    const rightEdgeDepth = Math.max(0, middleAvgHeight - colHeights[9]);
    
    breakdown.edgeWells.leftDepth = Math.round(leftEdgeDepth * 10) / 10;
    breakdown.edgeWells.rightDepth = Math.round(rightEdgeDepth * 10) / 10;
    
    // Progressive penalty - kick in earlier and be much stronger
    let edgeWellPenalty = 0;
    
    // Left edge penalty - QUADRATIC scaling for depth
    if (leftEdgeDepth > 6) {
        // Severe: 6+ blocks lower - quadratic penalty
        edgeWellPenalty += leftEdgeDepth * leftEdgeDepth * 2;  // 6->72, 8->128, 10->200
    } else if (leftEdgeDepth > 3) {
        // Moderate: starting to get dangerous
        edgeWellPenalty += (leftEdgeDepth - 3) * 12;  // 4->12, 5->24, 6->36
    } else if (leftEdgeDepth > 1) {
        // Mild: start discouraging early
        edgeWellPenalty += (leftEdgeDepth - 1) * 5;  // 2->5, 3->10
    }
    
    // Right edge penalty (same logic)
    if (rightEdgeDepth > 6) {
        edgeWellPenalty += rightEdgeDepth * rightEdgeDepth * 2;
    } else if (rightEdgeDepth > 3) {
        edgeWellPenalty += (rightEdgeDepth - 3) * 12;
    } else if (rightEdgeDepth > 1) {
        edgeWellPenalty += (rightEdgeDepth - 1) * 5;
    }
    
    // Extra penalty if BOTH edges are deep - you're really stuck
    if (leftEdgeDepth > 4 && rightEdgeDepth > 4) {
        edgeWellPenalty += 40;
    }
    
    // Reduce penalty slightly if building tsunami (horizontal building is natural)
    // But don't reduce too much - edge wells are still bad
    if (tsunamiNearCompletion) {
        edgeWellPenalty = Math.round(edgeWellPenalty * 0.6);
    } else if (hasTsunamiPotential) {
        edgeWellPenalty = Math.round(edgeWellPenalty * 0.8);
    }
    
    breakdown.edgeWells.penalty = edgeWellPenalty;
    score -= edgeWellPenalty;
    
    // ====== I-PIECE DEPENDENCY PENALTY (Single-Column Wells) ======
    // Single-column wells can ONLY be filled by I-pieces (14% chance per piece)
    // This is separate from edge wells - any column can create I-piece dependency
    // The deeper the well, the more I-pieces needed, exponentially more dangerous
    
    let iPieceDependencyPenalty = 0;
    let worstWellDepth = 0;
    let worstWellCol = -1;
    let totalWellDepth = 0;
    let wellCount2 = 0;
    
    // Check if I-piece is in visible queue (reduces urgency)
    const hasIPieceInQueue = pieceQueue.some(p => p && p.type === 'I');
    
    for (let col = 0; col < cols; col++) {
        const colH = colHeights[col];
        // For edges, treat wall as height 20 (infinite)
        const leftH = col > 0 ? colHeights[col - 1] : 20;
        const rightH = col < cols - 1 ? colHeights[col + 1] : 20;
        
        // Single-column well depth is how much lower this column is than BOTH neighbors
        const wellDepth = Math.min(leftH, rightH) - colH;
        
        if (wellDepth >= 3) {
            wellCount2++;
            totalWellDepth += wellDepth;
            
            if (wellDepth > worstWellDepth) {
                worstWellDepth = wellDepth;
                worstWellCol = col;
            }
            
            // Exponential penalty based on depth
            // Depth 3: minor (needs part of one I-piece) = 15
            // Depth 4: moderate (one I-piece) = 40  
            // Depth 5-7: serious (might need 2 I-pieces) = 80-160
            // Depth 8+: critical (multiple I-pieces, likely death) = 200+
            if (wellDepth >= 8) {
                // Critical: likely death without multiple I-pieces
                iPieceDependencyPenalty += 150 + (wellDepth - 8) * 30;
            } else if (wellDepth >= 6) {
                // Very dangerous
                iPieceDependencyPenalty += 60 + (wellDepth - 6) * 40;
            } else if (wellDepth >= 4) {
                // Dangerous - full I-piece needed
                iPieceDependencyPenalty += 25 + (wellDepth - 4) * 15;
            } else {
                // Depth 3: concerning but manageable
                iPieceDependencyPenalty += 12;
            }
        }
    }
    
    // Extra penalty for multiple single-column wells (multiple I-pieces needed simultaneously)
    if (wellCount2 >= 2) {
        iPieceDependencyPenalty += wellCount2 * 25;
    }
    
    // Reduce penalty if I-piece is visible in queue
    if (hasIPieceInQueue && worstWellDepth <= 6) {
        iPieceDependencyPenalty = Math.round(iPieceDependencyPenalty * 0.5);
    } else if (hasIPieceInQueue) {
        // Still reduce but less for very deep wells
        iPieceDependencyPenalty = Math.round(iPieceDependencyPenalty * 0.7);
    }
    
    // Don't penalize during imminent tsunami - we're about to clear anyway
    if (tsunamiImminent) {
        iPieceDependencyPenalty = Math.round(iPieceDependencyPenalty * 0.3);
    }
    
    breakdown.iPieceWells = {
        worstDepth: worstWellDepth,
        worstCol: worstWellCol,
        count: wellCount2,
        penalty: iPieceDependencyPenalty
    };
    score -= iPieceDependencyPenalty;
    
    // ====== EDGE FILL BONUS ======
    // Actively reward placements that touch edge columns when they need filling
    // This complements the edge well penalty by making edge placements attractive
    let edgeFillBonus = 0;
    
    // Check which columns the piece touches
    let touchesCol0 = false;
    let touchesCol9 = false;
    for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
            if (shape[py][px]) {
                const col = x + px;
                if (col === 0) touchesCol0 = true;
                if (col === cols - 1) touchesCol9 = true;
            }
        }
    }
    
    // Bonus for filling left edge when it's lower than middle
    if (touchesCol0 && leftEdgeDepth > 2) {
        // Progressive bonus based on how much lower the edge is
        if (leftEdgeDepth > 8) {
            edgeFillBonus += 40 + (leftEdgeDepth - 8) * 5;  // Strong incentive for deep gaps
        } else if (leftEdgeDepth > 5) {
            edgeFillBonus += 20 + (leftEdgeDepth - 5) * 4;
        } else {
            edgeFillBonus += (leftEdgeDepth - 2) * 4;
        }
    }
    
    // Bonus for filling right edge when it's lower than middle
    if (touchesCol9 && rightEdgeDepth > 2) {
        if (rightEdgeDepth > 8) {
            edgeFillBonus += 40 + (rightEdgeDepth - 8) * 5;
        } else if (rightEdgeDepth > 5) {
            edgeFillBonus += 20 + (rightEdgeDepth - 5) * 4;
        } else {
            edgeFillBonus += (rightEdgeDepth - 2) * 4;
        }
    }
    
    breakdown.edgeWells.fillBonus = edgeFillBonus;
    score += edgeFillBonus;
    
    // ====== SURVIVAL FILL BONUS ======
    // At high stacks, HEAVILY reward placements that fill the lowest columns
    // This overrides blob-building concerns - survival is paramount
    let survivalFillBonus = 0;
    
    if (stackHeight >= 12) {
        // Find the minimum height column(s)
        const minHeight = Math.min(...colHeights);
        const maxHeight = Math.max(...colHeights);
        const heightDiff = maxHeight - minHeight;
        
        // Check which columns the piece touches and what heights they have
        let lowestColTouched = -1;
        let lowestColHeight = 999;
        let pieceCellsInLowCols = 0;
        
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px]) {
                    const col = x + px;
                    if (col >= 0 && col < cols) {
                        if (colHeights[col] < lowestColHeight) {
                            lowestColHeight = colHeights[col];
                            lowestColTouched = col;
                        }
                        // Count cells going into low columns (within 2 of min)
                        if (colHeights[col] <= minHeight + 2) {
                            pieceCellsInLowCols++;
                        }
                    }
                }
            }
        }
        
        // Bonus scales with: how low the column is, how high the stack is, how big the gap is
        if (lowestColTouched >= 0 && heightDiff >= 4) {
            const colDepth = maxHeight - lowestColHeight;  // How much lower than max
            
            // Base bonus for touching low columns
            let fillBonus = 0;
            if (colDepth >= 8) {
                fillBonus = 80 + (colDepth - 8) * 15;
            } else if (colDepth >= 6) {
                fillBonus = 50 + (colDepth - 6) * 15;
            } else if (colDepth >= 4) {
                fillBonus = 20 + (colDepth - 4) * 15;
            }
            
            // Multiply by number of cells going into low columns
            fillBonus *= (1 + pieceCellsInLowCols * 0.25);
            
            // Scale up dramatically at dangerous heights
            if (stackHeight >= 17) {
                fillBonus *= 3;  // SURVIVAL MODE - triple the bonus
            } else if (stackHeight >= 15) {
                fillBonus *= 2;
            } else if (stackHeight >= 13) {
                fillBonus *= 1.5;
            }
            
            survivalFillBonus = Math.round(fillBonus);
        }
    }
    
    breakdown.survivalFill = survivalFillBonus;
    score += survivalFillBonus;
    
    // ====== VERTICAL PIECE PENALTY AT HIGH STACKS ======
    // Tall vertical placements are DEADLY at high stacks - they make the situation worse
    // Detect piece orientation: height > width = vertical
    const pieceHeight = shape.length;
    const pieceWidth = shape[0] ? shape[0].length : 1;
    const isVerticalPlacement = pieceHeight > pieceWidth;
    
    let verticalPenalty = 0;
    if (isVerticalPlacement && stackHeight >= 14) {
        // Extra height this piece adds vertically
        const extraHeight = pieceHeight - 1;  // -1 because it fills at least one row
        
        // At high stacks, vertical pieces are catastrophic
        if (stackHeight >= 18) {
            verticalPenalty = extraHeight * 150;  // DEATH ZONE - massive penalty
        } else if (stackHeight >= 16) {
            verticalPenalty = extraHeight * 100;
        } else if (stackHeight >= 14) {
            verticalPenalty = extraHeight * 50;
        }
        
        // Extra penalty if piece lands in the highest column
        const pieceTopY = y;
        const pieceTopRow = pieceTopY;
        if (pieceTopRow <= 2) {
            // Piece is near the very top - extremely dangerous
            verticalPenalty *= 2;
        } else if (pieceTopRow <= 4) {
            verticalPenalty *= 1.5;
        }
    }
    
    breakdown.verticalPenalty = verticalPenalty;
    score -= verticalPenalty;
    
    // ====== OVERHANG PENALTY ======
    // Penalize piece placements that create overhangs (cells over empty space)
    // This catches problematic vertical Z/S pieces at edges
    const overhangInfo = analyzeOverhangs(board, shape, x, y, cols, rows, colHeights);
    breakdown.overhangs.count = overhangInfo.overhangCount;
    breakdown.overhangs.severe = overhangInfo.severeOverhangs;
    breakdown.overhangs.edgeVertical = overhangInfo.edgeVerticalProblem;
    
    // Base overhang penalty - INCREASED to compete with fill bonuses
    // Each overhang creates a cell that must be filled before clearing lines
    let overhangPenalty = overhangInfo.overhangCount * 25;  // Was 12
    
    // Extra penalty for severe overhangs (2+ empty below) - creates unfillable patterns
    overhangPenalty += overhangInfo.severeOverhangs * 40;  // Was 20
    
    // Scale overhang penalty with stack height - overhangs are more costly when stack is high
    if (stackHeight >= 14) {
        overhangPenalty = Math.round(overhangPenalty * 1.5);
    } else if (stackHeight >= 12) {
        overhangPenalty = Math.round(overhangPenalty * 1.25);
    }
    
    // MASSIVE penalty for vertical Z/S at edges - these create unfillable patterns
    // Scale with stack height - at high stacks this is catastrophic
    if (overhangInfo.edgeVerticalProblem) {
        let edgePenalty = 120;  // Base penalty increased from 80
        
        // Scale with stack height - higher stacks = more dangerous
        if (stackHeight >= 16) {
            edgePenalty = 300;  // Near death - absolutely terrible
        } else if (stackHeight >= 14) {
            edgePenalty = 220;  // Critical - very bad
        } else if (stackHeight >= 12) {
            edgePenalty = 170;  // Danger zone - quite bad
        } else if (stackHeight >= 10) {
            edgePenalty = 140;  // Getting risky
        }
        
        overhangPenalty += edgePenalty;
    }
    
    // Reduce overhang penalty if building toward special events (creating holes is acceptable)
    // BUT only reduce if this piece actually contributes to the blob/tsunami
    if (tsunamiImminent && color === bestTsunamiColor) {
        // Extending imminent tsunami - overhangs are fine
        overhangPenalty = Math.round(overhangPenalty * 0.2);
    } else if (buildingSpecialEvent && color === bestTsunamiColor) {
        // Building tsunami with matching color - some reduction
        overhangPenalty = Math.round(overhangPenalty * 0.5);
    } else if (buildingSpecialEvent) {
        // Building special event but wrong color - less reduction
        overhangPenalty = Math.round(overhangPenalty * 0.7);
    }
    // If NOT building special event, full penalty applies
    
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
    
    // ====== LINE CLEAR TSUNAMI SURVIVAL CHECK ======
    // If line clears would happen and we're building a tsunami, simulate and check if it survives
    let tsunamiSurvivesLineClear = true;
    let tsunamiDestroyedByLineClear = false;
    
    if (completeRows > 0 && hasTsunamiPotential && bestTsunamiColor && bestTsunamiWidth >= 6) {
        const tsunamiRun = bestRuns[bestTsunamiColor];
        if (tsunamiRun) {
            // Simulate the placement and line clear
            const simulation = simulatePlacementWithLineClear(board, shape, x, y, color, cols, rows);
            
            if (simulation.linesCleared > 0) {
                // Check if tsunami survives
                const survivalCheck = checkTsunamiAfterLineClear(
                    simulation.board, 
                    bestTsunamiColor, 
                    tsunamiRun, 
                    cols, 
                    rows
                );
                
                tsunamiSurvivesLineClear = survivalCheck.survives;
                tsunamiDestroyedByLineClear = !survivalCheck.survives && bestTsunamiWidth >= 7;
                
                breakdown.lineClears.tsunamiSurvives = tsunamiSurvivesLineClear;
                breakdown.lineClears.postClearWidth = survivalCheck.newWidth;
            }
        }
    }
    
    if (completeRows > 0) {
        // LINE CLEARS ARE SURVIVAL - HEAVILY reward them
        // Only avoid clearing if tsunami is worth pursuing at this stack height
        
        // Use same stack-based lookahead as tsunami building
        let minWidthForPenalty = 6;
        if (stackHeight > 14) {
            minWidthForPenalty = 9;
        } else if (stackHeight > 10) {
            minWidthForPenalty = 8;
        } else if (stackHeight > 6) {
            minWidthForPenalty = 7;
        }
        
        const tsunamiWorthProtecting = bestTsunamiWidth >= minWidthForPenalty && holes <= 2;
        
        if (stackHeight >= 14) {
            // Danger zone - always clear lines
            breakdown.lineClears.bonus = completeRows * 300;
            breakdown.classification = 'survival';
        } else if (stackHeight >= 12) {
            // Getting risky - strongly prefer clearing
            breakdown.lineClears.bonus = completeRows * 200;
            breakdown.classification = 'defensive';
        } else if (tsunamiWorthProtecting && !tsunamiSurvivesLineClear) {
            // Only avoid clearing if tsunami is worth it at this stack height
            breakdown.lineClears.bonus = -completeRows * 50;
        } else if (stackHeight >= 10) {
            // Medium stack - reward clearing
            breakdown.lineClears.bonus = completeRows * 150;
        } else {
            // Normal play - HEAVILY REWARD LINE CLEARS
            breakdown.lineClears.bonus = completeRows * 100;
        }
        score += breakdown.lineClears.bonus;
    }
    
    // ====== TSUNAMI BUILDING BONUS ======
    // Stack-based lookahead: be more aggressive when safe, conservative when in danger
    // Stack > 14: only 1 piece away (width 9)
    // Stack > 10: only 2 pieces away (width 8+)
    // Stack > 6: only 3 pieces away (width 7+)
    // Stack <= 6: all 4 pieces (width 6+)
    let minTsunamiWidth = 6;  // Default: consider all queue pieces
    if (stackHeight > 14) {
        minTsunamiWidth = 9;  // Only 1 piece away
    } else if (stackHeight > 10) {
        minTsunamiWidth = 8;  // Only 2 pieces away
    } else if (stackHeight > 6) {
        minTsunamiWidth = 7;  // Only 3 pieces away
    }
    
    const tsunamiWorthPursuing = bestTsunamiWidth >= minTsunamiWidth;
    
    if (!isBreeze && tsunamiWorthPursuing && bestTsunamiColor && color === bestTsunamiColor && holes <= 2) {
        const matchingInQueue = pieceQueue.filter(p => p && p.color === bestTsunamiColor).length;
        const tsunamiRun = bestRuns[bestTsunamiColor];
        
        // Base bonus scales with how close we are to completion
        let tsunamiBonus = 0;
        if (bestTsunamiWidth >= 9) {
            tsunamiBonus = 80 + (bestTsunamiWidth - 9) * 40;  // 80 for width 9, 120 for width 10
        } else if (bestTsunamiWidth >= 8) {
            tsunamiBonus = 40;
        } else if (bestTsunamiWidth >= 7) {
            tsunamiBonus = 20;
        } else if (bestTsunamiWidth >= 6) {
            tsunamiBonus = 10;
        }
        
        tsunamiBonus += matchingInQueue * 5;
        
        // ====== TSUNAMI COMPLETION/EXTENSION BONUS ======
        // Give MASSIVE bonus for placements that actually extend the run toward completion
        if (tsunamiRun) {
            const extensionCols = [];
            if (tsunamiRun.startX > 0) extensionCols.push(tsunamiRun.startX - 1);
            if (tsunamiRun.endX < cols - 1) extensionCols.push(tsunamiRun.endX + 1);
            
            // Check where piece cells land relative to the run
            let cellsInExtension = 0;  // Would extend tsunami width
            let cellsOnRun = 0;        // Would expand tsunami height (same columns, adjacent rows)
            
            for (let py = 0; py < shape.length; py++) {
                for (let px = 0; px < shape[py].length; px++) {
                    if (shape[py][px]) {
                        const cellCol = x + px;
                        const cellRow = y + py;
                        
                        // Check if in extension column AND near the run row (would extend width)
                        if (extensionCols.includes(cellCol) && 
                            Math.abs(cellRow - tsunamiRun.row) <= 2) {
                            cellsInExtension++;
                        }
                        
                        // Check if on top of run (would expand height)
                        if (cellCol >= tsunamiRun.startX && cellCol <= tsunamiRun.endX &&
                            (cellRow === tsunamiRun.row - 1 || cellRow === tsunamiRun.row + 1)) {
                            cellsOnRun++;
                        }
                    }
                }
            }
            
            // ====== EXTENSION BONUS (Moving toward completion) ======
            // This is CRITICAL: reward extending the run width
            if (cellsInExtension > 0) {
                // Big bonus for extending - this is how tsunamis get completed!
                let extensionBonus = cellsInExtension * 40;
                
                // Even bigger bonus if this would complete (width + extension >= 10)
                const potentialWidth = bestTsunamiWidth + cellsInExtension;
                if (potentialWidth >= 10) {
                    // COMPLETION BONUS - this triggers the tsunami!
                    extensionBonus += 100;
                    breakdown.tsunami.completing = true;
                }
                
                // ====== EXPANSION STRATEGY (delay if more pieces coming) ======
                // Only delay completion if: more matching pieces AND not in danger AND run already wide
                if (potentialWidth >= 10 && matchingInQueue >= 1 && !inDangerZone && bestTsunamiWidth >= 9) {
                    // Reduce the completion bonus to favor expansion
                    // But don't make it negative - completing is still good!
                    extensionBonus -= matchingInQueue * 30;
                    extensionBonus = Math.max(extensionBonus, 50); // Still good to complete
                    breakdown.tsunami.earlyCompletion = true;
                }
                
                tsunamiBonus += extensionBonus;
            }
            
            // ====== HEIGHT EXPANSION BONUS ======
            // Reward expanding the blob height (only if not also extending)
            if (cellsOnRun > 0 && cellsInExtension === 0 && matchingInQueue >= 1 && !inDangerZone) {
                const expansionBonus = cellsOnRun * 15 + matchingInQueue * 10;
                tsunamiBonus += expansionBonus;
                breakdown.tsunami.expanding = true;
            }
        }
        
        breakdown.tsunami.bonus = tsunamiBonus;
        score += breakdown.tsunami.bonus;
        
        if (!breakdown.classification || breakdown.classification === 'neutral') {
            breakdown.classification = 'offensive';
        }
    }
    
    // ====== TSUNAMI BLOCKING PENALTY ======
    // If we're building a tsunami and this piece is NOT the tsunami color,
    // penalize placements that block the extension columns
    // CRITICAL: Blocking matters even if stacking high - it prevents tsunami pieces from reaching that column!
    // NOTE: We check bestTsunamiColor instead of hasTsunamiPotential because we track runs even at high stacks
    if (!isBreeze && bestTsunamiColor && color !== bestTsunamiColor) {
        const tsunamiRun = bestRuns[bestTsunamiColor];
        if (tsunamiRun) {
            const matchingInQueue = pieceQueue.filter(p => p && p.color === bestTsunamiColor).length;
            
            // Apply blocking penalty if we have pieces to continue OR run is already wide
            if (matchingInQueue >= 1 || bestTsunamiWidth >= 7) {
                const tsunamiRow = tsunamiRun.row;
                
                // Extension columns are those needed to complete the tsunami
                const extensionCols = [];
                if (tsunamiRun.startX > 0) {
                    for (let col = tsunamiRun.startX - 1; col >= 0; col--) {
                        extensionCols.push(col);
                        if (extensionCols.length >= 3) break;
                    }
                }
                if (tsunamiRun.endX < cols - 1) {
                    for (let col = tsunamiRun.endX + 1; col < cols; col++) {
                        extensionCols.push(col);
                        if (extensionCols.length >= 6) break;
                    }
                }
                
                // Check if piece cells are in extension columns
                // ANY non-tsunami piece in extension column is bad because it wastes space
                // that could be used by tsunami pieces
                let cellsInExtension = 0;
                let directBlockingCells = 0;  // At or near tsunami row level
                
                for (let py = 0; py < shape.length; py++) {
                    for (let px = 0; px < shape[py].length; px++) {
                        if (shape[py][px]) {
                            const cellCol = x + px;
                            const cellRow = y + py;
                            
                            if (extensionCols.includes(cellCol)) {
                                cellsInExtension++;
                                
                                // Check if at/near tsunami row level
                                const rowDiff = Math.abs(cellRow - tsunamiRow);
                                if (rowDiff <= 3) {
                                    directBlockingCells++;
                                }
                            }
                        }
                    }
                }
                
                if (cellsInExtension > 0) {
                    let blockingPenalty = 0;
                    
                    // Base penalty for any non-tsunami piece in extension column
                    // This wastes space that tsunami pieces need
                    const basePenalty = bestTsunamiWidth >= 8 ? 12 : (bestTsunamiWidth >= 7 ? 8 : 5);
                    blockingPenalty += cellsInExtension * basePenalty;
                    
                    // Extra penalty for direct blocking (at tsunami row level)
                    if (directBlockingCells > 0) {
                        if (tsunamiImminent || tsunamiNearCompletion) {
                            blockingPenalty += directBlockingCells * 25;
                        } else if (tsunamiLikelyAchievable || bestTsunamiWidth >= 8) {
                            blockingPenalty += directBlockingCells * 15;
                        } else {
                            blockingPenalty += directBlockingCells * 10;
                        }
                    }
                    
                    // Extra penalty if matching pieces are waiting in queue
                    // They need those extension columns!
                    blockingPenalty += matchingInQueue * cellsInExtension * 10;
                    
                    breakdown.tsunami.blockingPenalty = blockingPenalty;
                    score -= blockingPenalty;
                }
            }
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
    // ====== DANGER ZONE CHECK ======
    // Height-based zones for different behaviors
    // LOWERED hole thresholds - holes are more dangerous
    const inDangerZone = stackHeight >= 12 || holes >= 5;  // Was 8
    const inCriticalZone = stackHeight >= 15 || holes >= 8; // Was 12
    const inDeathZone = stackHeight >= 17 || holes >= 12;   // Was 15
    
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
            
            // IMPORTANT: Current piece counts as a match if it's the same color!
            const currentPieceMatches = (color === runColor) ? 1 : 0;
            const totalMatches = queueMatches + currentPieceMatches;
            
            // IMMINENT: Can complete with current piece + visible queue (always allowed except death zone)
            // IMMINENT: Can complete - including at high stacks! Completing clears board!
            if (run.width >= 10) {
                tsunamiImminent = true;
                tsunamiNearCompletion = true;
            } else if (run.width >= 9 && totalMatches >= 1) {
                tsunamiImminent = true;
                tsunamiNearCompletion = true;
            } else if (run.width >= 8 && totalMatches >= blocksNeeded) {
                tsunamiImminent = true;
                tsunamiNearCompletion = true;
            } else if (!inDeathZone && run.width >= 8 && totalMatches >= 1) {
                tsunamiNearCompletion = true;
            }
            
            // NEAR COMPLETION: Very close, worth prioritizing
            if (run.width >= 9 || (run.width >= 8 && totalMatches >= 2)) {
                tsunamiNearCompletion = true;
            } else if (!inCriticalZone && run.width >= 8 && totalMatches >= 1) {
                tsunamiNearCompletion = true;
            }
            
            // ACHIEVABLE: Speculative (only at safe heights)
            if (!inDangerZone) {
                if (run.width >= 9 || (run.width >= 8 && totalMatches >= 1) || (run.width >= 7 && totalMatches >= 2)) {
                    tsunamiLikelyAchievable = true;
                }
            }
            
            // POTENTIAL: Most speculative
            let effectiveThreshold;
            if (run.touchesRight || run.touchesLeft) {
                effectiveThreshold = totalMatches >= 2 ? 4 : (totalMatches >= 1 ? 5 : 6);
            } else {
                effectiveThreshold = totalMatches >= 2 ? 5 : (totalMatches >= 1 ? 6 : 7);
            }
            
            // ALWAYS track best run, wide runs (8+) get potential even at high stacks
            if (run.width >= effectiveThreshold) {
                const currentBonus = currentPieceMatches ? 0.5 : 0;
                const effectiveWidth = run.width + currentBonus;
                if (effectiveWidth > bestTsunamiWidth) {
                    bestTsunamiWidth = run.width;
                    bestTsunamiColor = runColor;
                }
                
                if (run.width >= 8) {
                    hasTsunamiPotential = true;
                } else if (!inCriticalZone) {
                    hasTsunamiPotential = true;
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
    
    // ====== HOLE PENALTIES - SURVIVAL CRITICAL ======
    // Simplified scattered hole detection
    let columnsWithHoles = 0;
    for (let col = 0; col < cols; col++) {
        let foundBlock = false;
        for (let row = 0; row < rows; row++) {
            if (board[row] && board[row][col]) {
                foundBlock = true;
            } else if (foundBlock && board[row]) {
                columnsWithHoles++;
                break;  // Just count columns, not total holes per column
            }
        }
    }
    
    let holePenalty = 0;
    // ONLY reduce for imminent tsunamis
    if (tsunamiImminent && holes <= 4) {
        holePenalty = holes * 6;
    } else if (tsunamiNearCompletion && holes <= 3 && stackHeight < 12) {
        holePenalty = holes * 8;
    } else {
        // NO REDUCTION for "potential" - SURVIVAL FIRST
        if (holes <= 2) {
            holePenalty = holes * 15;
        } else if (holes <= 5) {
            holePenalty = 30 + (holes - 2) * 20;
        } else if (holes <= 10) {
            holePenalty = 90 + (holes - 5) * 25;
        } else {
            holePenalty = 215 + (holes - 10) * 30;
        }
    }
    
    // Scattered holes penalty
    if (columnsWithHoles >= 5) {
        holePenalty += columnsWithHoles * columnsWithHoles * 4;
    } else if (columnsWithHoles >= 3) {
        holePenalty += columnsWithHoles * 12;
    }
    
    // FOUNDATION PENALTY - holes at LOW stack are devastating!
    if (stackHeight <= 6 && holes > 0) {
        holePenalty += holes * 25;
        if (columnsWithHoles >= 2) {
            holePenalty += columnsWithHoles * 15;
        }
    } else if (stackHeight <= 10 && holes > 1) {
        holePenalty += (holes - 1) * 15;
    }
    
    // Extra at high stacks
    if (stackHeight >= 14 && holes > 1) {
        holePenalty = Math.round(holePenalty * 1.8);
    } else if (stackHeight >= 12 && holes > 2) {
        holePenalty = Math.round(holePenalty * 1.4);
    }
    
    score -= holePenalty;
    
    // ====== HEIGHT PENALTIES ======
    // Height is the #1 survival factor - MASSIVE penalty
    let heightMultiplier = 2.5;  // DRASTICALLY increased
    
    // Only reduce for truly imminent tsunamis with clean board
    if (tsunamiImminent && holes <= 2) {
        heightMultiplier = 1.0;
    }
    
    // Additional penalty scaling for dangerous heights
    if (stackHeight >= 16) {
        heightMultiplier *= 2.5;
    } else if (stackHeight >= 14) {
        heightMultiplier *= 2.0;
    } else if (stackHeight >= 12) {
        heightMultiplier *= 1.5;
    } else if (stackHeight >= 10) {
        heightMultiplier *= 1.2;
    }
    
    score -= stackHeight * heightMultiplier;
    
    // ====== BUMPINESS ======
    // Bumpiness prevents line clears - MASSIVE penalty
    let bumpinessMultiplier = 3.0;  // DRASTICALLY increased
    
    // Only reduce for truly imminent tsunamis with clean board
    if (tsunamiImminent && holes <= 2 && stackHeight < 12) {
        bumpinessMultiplier = 1.0;
    }
    
    // Scale up at dangerous heights
    if (stackHeight >= 16) {
        bumpinessMultiplier = Math.max(bumpinessMultiplier, 6.0);
    } else if (stackHeight >= 14) {
        bumpinessMultiplier = Math.max(bumpinessMultiplier, 5.0);
    } else if (stackHeight >= 12) {
        bumpinessMultiplier = Math.max(bumpinessMultiplier, 4.0);
    } else if (stackHeight >= 10) {
        bumpinessMultiplier = Math.max(bumpinessMultiplier, 3.5);
    }
    
    score -= bumpiness * bumpinessMultiplier;
    
    // ====== DEEP WELLS ======
    // Quadratic penalty for deep wells, scaled by height - INCREASED
    for (let col = 0; col < cols; col++) {
        const leftHeight = col > 0 ? colHeights[col - 1] : colHeights[col];
        const rightHeight = col < cols - 1 ? colHeights[col + 1] : colHeights[col];
        const minNeighbor = Math.min(leftHeight, rightHeight);
        const wellDepth = minNeighbor - colHeights[col];
        if (wellDepth > 2) {
            let thisWellPenalty = wellDepth * wellDepth * 1.5;  // Was just wellDepth^2
            if (stackHeight >= 14) {
                thisWellPenalty *= 2.5;  // Was 2
            } else if (stackHeight >= 12) {
                thisWellPenalty *= 1.8;  // Was 1.5
            } else if (stackHeight >= 8) {
                thisWellPenalty *= 1.3;  // NEW
            }
            score -= thisWellPenalty;
        }
    }
    
    // ====== SURVIVAL FILL BONUS ======
    if (stackHeight >= 12) {
        const minHeight = Math.min(...colHeights);
        const maxHeight = Math.max(...colHeights);
        const heightDiff = maxHeight - minHeight;
        
        if (heightDiff >= 4) {
            let lowestColHeight = 999;
            let pieceCellsInLowCols = 0;
            
            for (let py = 0; py < shape.length; py++) {
                for (let px = 0; px < shape[py].length; px++) {
                    if (shape[py][px]) {
                        const col = x + px;
                        if (col >= 0 && col < cols) {
                            if (colHeights[col] < lowestColHeight) {
                                lowestColHeight = colHeights[col];
                            }
                            if (colHeights[col] <= minHeight + 2) {
                                pieceCellsInLowCols++;
                            }
                        }
                    }
                }
            }
            
            if (lowestColHeight < 999) {
                const colDepth = maxHeight - lowestColHeight;
                let fillBonus = 0;
                if (colDepth >= 8) {
                    fillBonus = 80 + (colDepth - 8) * 15;
                } else if (colDepth >= 6) {
                    fillBonus = 50 + (colDepth - 6) * 15;
                } else if (colDepth >= 4) {
                    fillBonus = 20 + (colDepth - 4) * 15;
                }
                
                fillBonus *= (1 + pieceCellsInLowCols * 0.25);
                
                if (stackHeight >= 17) {
                    fillBonus *= 3;
                } else if (stackHeight >= 15) {
                    fillBonus *= 2;
                } else if (stackHeight >= 13) {
                    fillBonus *= 1.5;
                }
                
                score += Math.round(fillBonus);
            }
        }
    }
    
    // ====== VERTICAL PIECE PENALTY AT HIGH STACKS ======
    const pieceHeight = shape.length;
    const pieceWidth = shape[0] ? shape[0].length : 1;
    const isVerticalPlacement = pieceHeight > pieceWidth;
    
    if (isVerticalPlacement && stackHeight >= 14) {
        const extraHeight = pieceHeight - 1;
        let verticalPenalty = 0;
        
        if (stackHeight >= 18) {
            verticalPenalty = extraHeight * 150;
        } else if (stackHeight >= 16) {
            verticalPenalty = extraHeight * 100;
        } else if (stackHeight >= 14) {
            verticalPenalty = extraHeight * 50;
        }
        
        if (y <= 2) {
            verticalPenalty *= 2;
        } else if (y <= 4) {
            verticalPenalty *= 1.5;
        }
        
        score -= verticalPenalty;
    }
    
    // ====== EDGE WELL DISPARITY PENALTY ======
    // Penalize when edge columns (0 and 9) are much lower than the middle
    // This creates I-piece dependency which is a death sentence
    // SIGNIFICANTLY INCREASED - the AI was leaving edges empty too often
    const middleAvgHeight = (colHeights[2] + colHeights[3] + colHeights[4] + colHeights[5] + colHeights[6] + colHeights[7]) / 6;
    const leftEdgeDepth = Math.max(0, middleAvgHeight - colHeights[0]);
    const rightEdgeDepth = Math.max(0, middleAvgHeight - colHeights[9]);
    
    let edgeWellPenalty = 0;
    
    // Left edge penalty - QUADRATIC scaling for depth
    if (leftEdgeDepth > 6) {
        edgeWellPenalty += leftEdgeDepth * leftEdgeDepth * 2;
    } else if (leftEdgeDepth > 3) {
        edgeWellPenalty += (leftEdgeDepth - 3) * 12;
    } else if (leftEdgeDepth > 1) {
        edgeWellPenalty += (leftEdgeDepth - 1) * 5;
    }
    
    // Right edge penalty
    if (rightEdgeDepth > 6) {
        edgeWellPenalty += rightEdgeDepth * rightEdgeDepth * 2;
    } else if (rightEdgeDepth > 3) {
        edgeWellPenalty += (rightEdgeDepth - 3) * 12;
    } else if (rightEdgeDepth > 1) {
        edgeWellPenalty += (rightEdgeDepth - 1) * 5;
    }
    
    // Extra penalty if BOTH edges are deep
    if (leftEdgeDepth > 4 && rightEdgeDepth > 4) {
        edgeWellPenalty += 40;
    }
    
    // Reduce penalty slightly if building tsunami
    if (tsunamiNearCompletion) {
        edgeWellPenalty = Math.round(edgeWellPenalty * 0.6);
    } else if (hasTsunamiPotential) {
        edgeWellPenalty = Math.round(edgeWellPenalty * 0.8);
    }
    
    score -= edgeWellPenalty;
    
    // ====== I-PIECE DEPENDENCY PENALTY (Single-Column Wells) ======
    // Single-column wells can ONLY be filled by I-pieces (14% chance per piece)
    let iPieceDependencyPenalty = 0;
    let worstWellDepth = 0;
    let wellCount2 = 0;
    
    // Check if I-piece is in visible queue (reduces urgency)
    const hasIPieceInQueue = pieceQueue.some(p => p && p.type === 'I');
    
    for (let col = 0; col < cols; col++) {
        const colH = colHeights[col];
        const leftH = col > 0 ? colHeights[col - 1] : 20;
        const rightH = col < cols - 1 ? colHeights[col + 1] : 20;
        const wellDepth = Math.min(leftH, rightH) - colH;
        
        if (wellDepth >= 3) {
            wellCount2++;
            if (wellDepth > worstWellDepth) {
                worstWellDepth = wellDepth;
            }
            
            if (wellDepth >= 8) {
                iPieceDependencyPenalty += 150 + (wellDepth - 8) * 30;
            } else if (wellDepth >= 6) {
                iPieceDependencyPenalty += 60 + (wellDepth - 6) * 40;
            } else if (wellDepth >= 4) {
                iPieceDependencyPenalty += 25 + (wellDepth - 4) * 15;
            } else {
                iPieceDependencyPenalty += 12;
            }
        }
    }
    
    if (wellCount2 >= 2) {
        iPieceDependencyPenalty += wellCount2 * 25;
    }
    
    if (hasIPieceInQueue && worstWellDepth <= 6) {
        iPieceDependencyPenalty = Math.round(iPieceDependencyPenalty * 0.5);
    } else if (hasIPieceInQueue) {
        iPieceDependencyPenalty = Math.round(iPieceDependencyPenalty * 0.7);
    }
    
    if (tsunamiImminent) {
        iPieceDependencyPenalty = Math.round(iPieceDependencyPenalty * 0.3);
    }
    
    score -= iPieceDependencyPenalty;
    
    // ====== EDGE FILL BONUS ======
    // Actively reward placements that touch edge columns when they need filling
    let edgeFillBonus = 0;
    
    // Check which columns the piece touches
    let touchesCol0 = false;
    let touchesCol9 = false;
    for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
            if (shape[py][px]) {
                const col = x + px;
                if (col === 0) touchesCol0 = true;
                if (col === cols - 1) touchesCol9 = true;
            }
        }
    }
    
    // Bonus for filling left edge when it's lower than middle
    if (touchesCol0 && leftEdgeDepth > 2) {
        if (leftEdgeDepth > 8) {
            edgeFillBonus += 40 + (leftEdgeDepth - 8) * 5;
        } else if (leftEdgeDepth > 5) {
            edgeFillBonus += 20 + (leftEdgeDepth - 5) * 4;
        } else {
            edgeFillBonus += (leftEdgeDepth - 2) * 4;
        }
    }
    
    // Bonus for filling right edge when it's lower than middle
    if (touchesCol9 && rightEdgeDepth > 2) {
        if (rightEdgeDepth > 8) {
            edgeFillBonus += 40 + (rightEdgeDepth - 8) * 5;
        } else if (rightEdgeDepth > 5) {
            edgeFillBonus += 20 + (rightEdgeDepth - 5) * 4;
        } else {
            edgeFillBonus += (rightEdgeDepth - 2) * 4;
        }
    }
    
    score += edgeFillBonus;
    
    // ====== OVERHANG PENALTY ======
    // Penalize piece placements that create overhangs (cells over empty space)
    const overhangInfo = analyzeOverhangs(board, shape, x, y, cols, rows, colHeights);
    
    let overhangPenalty = overhangInfo.overhangCount * 12;
    overhangPenalty += overhangInfo.severeOverhangs * 20;
    
    // MASSIVE penalty for vertical Z/S at edges - scale with height
    if (overhangInfo.edgeVerticalProblem) {
        let edgePenalty = 80;
        if (stackHeight >= 16) {
            edgePenalty = 200;
        } else if (stackHeight >= 14) {
            edgePenalty = 150;
        } else if (stackHeight >= 12) {
            edgePenalty = 120;
        } else if (stackHeight >= 10) {
            edgePenalty = 100;
        }
        overhangPenalty += edgePenalty;
    }
    
    // Reduce penalty if building toward imminent tsunami
    if (tsunamiImminent && color === bestTsunamiColor) {
        overhangPenalty = Math.round(overhangPenalty * 0.2);
    } else if (buildingSpecialEvent && color === bestTsunamiColor) {
        overhangPenalty = Math.round(overhangPenalty * 0.5);
    } else if (buildingSpecialEvent) {
        overhangPenalty = Math.round(overhangPenalty * 0.7);
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
        // LINE CLEARS ARE SURVIVAL - HEAVILY reward them
        // Use stack-based lookahead for tsunami consideration
        let minWidthForPenalty = 6;
        if (stackHeight > 14) {
            minWidthForPenalty = 9;
        } else if (stackHeight > 10) {
            minWidthForPenalty = 8;
        } else if (stackHeight > 6) {
            minWidthForPenalty = 7;
        }
        
        const tsunamiWorthProtecting = bestTsunamiWidth >= minWidthForPenalty && holes <= 2;
        
        if (stackHeight >= 14) {
            score += completeRows * 300;  // Danger zone
        } else if (stackHeight >= 12) {
            score += completeRows * 200;  // Getting risky
        } else if (tsunamiWorthProtecting && stackHeight < 10) {
            score -= completeRows * 50;  // Protect tsunami if worth it
        } else if (stackHeight >= 10) {
            score += completeRows * 150;  // Medium stack
        } else {
            // Normal play - HEAVILY REWARD LINE CLEARS
            score += completeRows * 100;
        }
    }
    
    // ====== TSUNAMI BUILDING BONUSES ======
    // Stack-based lookahead: aggressive when safe, conservative when in danger
    let minTsunamiWidth = 6;
    if (stackHeight > 14) {
        minTsunamiWidth = 9;
    } else if (stackHeight > 10) {
        minTsunamiWidth = 8;
    } else if (stackHeight > 6) {
        minTsunamiWidth = 7;
    }
    
    const tsunamiWorthPursuing = bestTsunamiWidth >= minTsunamiWidth;
    
    if (!isBreeze && tsunamiWorthPursuing && bestTsunamiColor && color === bestTsunamiColor && holes <= 2) {
        const matchingInQueue = pieceQueue.filter(p => p && p.color === bestTsunamiColor).length;
        const tsunamiRun = bestRuns[bestTsunamiColor];
        
        // Base bonus scales with how close we are
        let tsunamiBonus = 0;
        if (bestTsunamiWidth >= 9) {
            tsunamiBonus = 80 + (bestTsunamiWidth - 9) * 40;
        } else if (bestTsunamiWidth >= 8) {
            tsunamiBonus = 40;
        } else if (bestTsunamiWidth >= 7) {
            tsunamiBonus = 20;
        } else if (bestTsunamiWidth >= 6) {
            tsunamiBonus = 10;
        }
        
        tsunamiBonus += matchingInQueue * 5;
        
        // ====== TSUNAMI COMPLETION/EXTENSION BONUS ======
        if (tsunamiRun) {
            const extensionCols = [];
            if (tsunamiRun.startX > 0) extensionCols.push(tsunamiRun.startX - 1);
            if (tsunamiRun.endX < cols - 1) extensionCols.push(tsunamiRun.endX + 1);
            
            let cellsInExtension = 0;
            let cellsOnRun = 0;
            
            for (let py = 0; py < shape.length; py++) {
                for (let px = 0; px < shape[py].length; px++) {
                    if (shape[py][px]) {
                        const cellCol = x + px;
                        const cellRow = y + py;
                        
                        if (extensionCols.includes(cellCol) && 
                            Math.abs(cellRow - tsunamiRun.row) <= 2) {
                            cellsInExtension++;
                        }
                        
                        if (cellCol >= tsunamiRun.startX && cellCol <= tsunamiRun.endX &&
                            (cellRow === tsunamiRun.row - 1 || cellRow === tsunamiRun.row + 1)) {
                            cellsOnRun++;
                        }
                    }
                }
            }
            
            // EXTENSION BONUS - reward extending the run width
            if (cellsInExtension > 0) {
                let extensionBonus = cellsInExtension * 40;
                
                // COMPLETION BONUS if this would complete the tsunami
                const potentialWidth = bestTsunamiWidth + cellsInExtension;
                if (potentialWidth >= 10) {
                    extensionBonus += 100;
                }
                
                // Only delay completion if more pieces AND safe height AND run already wide
                if (potentialWidth >= 10 && matchingInQueue >= 1 && !inDangerZone && bestTsunamiWidth >= 9) {
                    extensionBonus -= matchingInQueue * 30;
                    extensionBonus = Math.max(extensionBonus, 50);
                }
                
                tsunamiBonus += extensionBonus;
            }
            
            // HEIGHT EXPANSION BONUS (only if not also extending)
            if (cellsOnRun > 0 && cellsInExtension === 0 && matchingInQueue >= 1 && !inDangerZone) {
                tsunamiBonus += cellsOnRun * 15 + matchingInQueue * 10;
            }
        }
        
        score += tsunamiBonus;
    }
    
    // ====== TSUNAMI BLOCKING PENALTY ======
    // Penalize non-tsunami-color pieces that block extension columns
    // Check bestTsunamiColor instead of hasTsunamiPotential to block even at high stacks
    if (!isBreeze && bestTsunamiColor && color !== bestTsunamiColor) {
        const tsunamiRun = bestRuns[bestTsunamiColor];
        if (tsunamiRun) {
            const matchingInQueue = pieceQueue.filter(p => p && p.color === bestTsunamiColor).length;
            
            if (matchingInQueue >= 1 || bestTsunamiWidth >= 7) {
                const tsunamiRow = tsunamiRun.row;
                
                const extensionCols = [];
                if (tsunamiRun.startX > 0) {
                    for (let col = tsunamiRun.startX - 1; col >= 0 && extensionCols.length < 3; col--) {
                        extensionCols.push(col);
                    }
                }
                if (tsunamiRun.endX < cols - 1) {
                    for (let col = tsunamiRun.endX + 1; col < cols && extensionCols.length < 6; col++) {
                        extensionCols.push(col);
                    }
                }
                
                let cellsInExtension = 0;
                let directBlockingCells = 0;
                
                for (let py = 0; py < shape.length; py++) {
                    for (let px = 0; px < shape[py].length; px++) {
                        if (shape[py][px]) {
                            const cellCol = x + px;
                            const cellRow = y + py;
                            
                            if (extensionCols.includes(cellCol)) {
                                cellsInExtension++;
                                if (Math.abs(cellRow - tsunamiRow) <= 3) {
                                    directBlockingCells++;
                                }
                            }
                        }
                    }
                }
                
                if (cellsInExtension > 0) {
                    let blockingPenalty = 0;
                    const basePenalty = bestTsunamiWidth >= 8 ? 12 : (bestTsunamiWidth >= 7 ? 8 : 5);
                    blockingPenalty += cellsInExtension * basePenalty;
                    
                    if (directBlockingCells > 0) {
                        if (tsunamiImminent || tsunamiNearCompletion || bestTsunamiWidth >= 8) {
                            blockingPenalty += directBlockingCells * 15;
                        } else {
                            blockingPenalty += directBlockingCells * 10;
                        }
                    }
                    
                    blockingPenalty += matchingInQueue * cellsInExtension * 10;
                    score -= blockingPenalty;
                }
            }
        }
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
