// AI Worker v6.10.0 - Tuned parameters: earlier survival entry, lower hole tolerance
// Priorities: 1) Survival 2) No holes 3) Blob building (when safe) 4) Special events (when safe)
console.log("🤖 AI Worker v6.10.0 loaded - Tuned parameters");

const AI_VERSION = "6.10.0";

// ==================== TUNABLE PARAMETERS ====================
// All tunable parameters in one object for easy experimentation
const DEFAULT_CONFIG = {
    // Survival mode thresholds
    survivalEnterHeight: 9,
    survivalExitHeight: 7,
    survivalEnterHoles: 5,
    survivalExitHoles: 3,
    
    // Phase thresholds
    criticalHeight: 16,
    criticalHoles: 10,
    dangerHeight: 14,
    dangerHoles: 7,
    cautionHeight: 12,
    cautionHoles: 5,
    
    // Lookahead
    lookaheadDepth: 2,
    lookaheadDiscount: 0.6,
    
    // Blob building bonuses
    horizontalAdjacencyBonus: 16,
    verticalAdjacencyBonus: 4,
    tsunamiRowBonusMultiplier: 15,
    tsunamiEdgeExtensionBonus: 60,
    tsunamiMatchingColorBonus: 6,
    
    // Tsunami bonuses by width
    tsunamiImminentBonus: 180,
    tsunamiImminentPerExtra: 100,
    tsunamiAchievableBonus: 120,
    tsunamiAchievablePerQueue: 25,
    tsunamiNearCompleteBonus: 60,
    tsunamiNearCompletePerExtra: 20,
    tsunamiBuildingBonus: 30,
    tsunamiBuildingPerExtra: 15,
    
    // Line clear bonuses in survival mode
    survivalClear4Bonus: 600,
    survivalClear3Bonus: 400,
    survivalClear2Bonus: 250,
    survivalClear1Bonus: 150,
    
    // Height penalties
    survivalHeightMultiplier: 3.5,
    normalHeightMultiplier: 2.5,
    normalHeightThreshold: 8,
    
    // Hole penalties
    holePenaltyBase: 20,
    holePenaltyMedium: 50,
    holePenaltyHigh: 60,
    
    // Bumpiness
    bumpinessPenalty: 2.5,
    
    // Stacking penalty
    stackingPenaltyPerExcess: 12,
    stackingPenaltySmall: 5,
    stackingSurvivalMultiplier: 2,
    
    // Vertical I-piece penalties
    verticalISlightPenalty: 40,
    verticalIModeratePenalty: 120,
    verticalISeverePenalty: 200,
    verticalISurvivalExtraPenalty: 100,
    
    // Tower penalties
    towerThresholdSevere: 8,
    towerThresholdBad: 6,
    towerThresholdModerate: 4,
    towerPenaltySevere: 10,
    towerPenaltyBad: 6,
    towerPenaltyModerate: 3
};

// Current active config (can be modified for testing)
let config = { ...DEFAULT_CONFIG };

// Function to update config
function setConfig(newConfig) {
    config = { ...DEFAULT_CONFIG, ...newConfig };
    console.log('🔧 AI Config updated:', Object.keys(newConfig).join(', '));
}

// Function to get current config
function getConfig() {
    return { ...config };
}

// ==================== GLOBAL STATE ====================
let currentSkillLevel = 'tempest';
let pieceQueue = [];

// Survival mode state (hysteresis-based)
let inSurvivalMode = false;

// UFO easter egg state - when active, avoid clearing lines (unless dangerous)
let currentUfoActive = false;

// ==================== GAME RECORDING ====================
let gameRecording = {
    startTime: null,
    decisions: [],
    events: [],
    finalState: null,
    config: null  // Record which config was used
};

function startRecording() {
    // Reset survival mode and UFO state at game start
    inSurvivalMode = false;
    currentUfoActive = false;
    
    gameRecording = {
        version: AI_VERSION,
        startTime: Date.now(),
        skillLevel: currentSkillLevel,
        config: { ...config },  // Record the config used
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
        for (let x = 0; x < (board[y] ? board[y].length : 10); x++) {
            if (board[y] && board[y][x]) {
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
        for (let x = 0; x < (board[y] ? board[y].length : 10); x++) {
            if (board[y] && board[y][x]) {
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

function cloneBoard(board) {
    return board.map(row => row ? [...row] : new Array(10).fill(null));
}

function getColumnHeights(board, cols, rows) {
    const heights = new Array(cols).fill(0);
    for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
            if (board[row] && board[row][col]) {
                heights[col] = rows - row;
                break;
            }
        }
    }
    return heights;
}

function getStackHeight(board, rows) {
    for (let row = 0; row < rows; row++) {
        if (board[row] && board[row].some(cell => cell !== null)) {
            return rows - row;
        }
    }
    return 0;
}

function countHoles(board) {
    let holes = 0;
    const rows = board.length;
    const cols = board[0] ? board[0].length : 10;
    
    for (let col = 0; col < cols; col++) {
        let foundBlock = false;
        for (let row = 0; row < rows; row++) {
            if (board[row] && board[row][col]) {
                foundBlock = true;
            } else if (foundBlock) {
                holes++;
            }
        }
    }
    return holes;
}

function countColumnsWithHoles(board) {
    let count = 0;
    const rows = board.length;
    const cols = board[0] ? board[0].length : 10;
    
    for (let col = 0; col < cols; col++) {
        let foundBlock = false;
        for (let row = 0; row < rows; row++) {
            if (board[row] && board[row][col]) {
                foundBlock = true;
            } else if (foundBlock) {
                count++;
                break;
            }
        }
    }
    return count;
}

function getBumpiness(board) {
    const cols = board[0] ? board[0].length : 10;
    const rows = board.length;
    const heights = getColumnHeights(board, cols, rows);
    
    let bumpiness = 0;
    for (let i = 0; i < cols - 1; i++) {
        bumpiness += Math.abs(heights[i] - heights[i + 1]);
    }
    return bumpiness;
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
        
        if (!isDuplicate) rotations.push(rotated);
        current = rotated;
    }
    return rotations;
}

function isValidPosition(board, shape, x, y, cols, rows) {
    for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
            if (!shape[py][px]) continue;
            const bx = x + px;
            const by = y + py;
            if (bx < 0 || bx >= cols || by >= rows) return false;
            if (by >= 0 && board[by] && board[by][bx]) return false;
        }
    }
    return true;
}

function placePiece(board, shape, x, y, color) {
    const newBoard = cloneBoard(board);
    for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
            if (shape[py][px]) {
                const by = y + py;
                const bx = x + px;
                if (by >= 0 && by < newBoard.length && bx >= 0 && bx < 10) {
                    newBoard[by][bx] = color;
                }
            }
        }
    }
    return newBoard;
}

function clearLines(board) {
    const rows = board.length;
    const cols = board[0] ? board[0].length : 10;
    let linesCleared = 0;
    
    const newBoard = [];
    for (let row = 0; row < rows; row++) {
        if (board[row] && board[row].every(cell => cell !== null)) {
            linesCleared++;
        } else {
            newBoard.push(board[row] ? [...board[row]] : new Array(cols).fill(null));
        }
    }
    
    while (newBoard.length < rows) {
        newBoard.unshift(new Array(cols).fill(null));
    }
    
    return { board: newBoard, linesCleared };
}

function getDropY(board, shape, x, cols, rows) {
    let y = -shape.length + 1;
    while (isValidPosition(board, shape, x, y + 1, cols, rows)) {
        y++;
    }
    return y;
}

// ==================== ANALYSIS FUNCTIONS ====================

/**
 * Analyze I-piece wells (single column gaps that only I-pieces can fill)
 */
function analyzeIPieceWells(colHeights, cols) {
    const wells = [];
    
    for (let col = 0; col < cols; col++) {
        const colH = colHeights[col];
        const leftH = col > 0 ? colHeights[col - 1] : 20;
        const rightH = col < cols - 1 ? colHeights[col + 1] : 20;
        
        const wellDepth = Math.min(leftH, rightH) - colH;
        
        if (wellDepth >= 3) {
            wells.push({ col, depth: wellDepth });
        }
    }
    
    return wells;
}

/**
 * Analyze horizontal color runs for tsunami potential
 */
function analyzeColorRuns(board, cols, rows) {
    const runs = {};
    
    for (let row = 0; row < rows; row++) {
        if (!board[row]) continue;
        
        let runStart = -1;
        let runColor = null;
        
        for (let col = 0; col <= cols; col++) {
            const cell = col < cols ? board[row][col] : null;
            
            if (cell && cell === runColor) {
                // Continue run
            } else {
                // End current run if exists
                if (runColor && runStart >= 0) {
                    const width = col - runStart;
                    if (width >= 4) {
                        if (!runs[runColor] || runs[runColor].width < width) {
                            runs[runColor] = {
                                width,
                                row,
                                startX: runStart,
                                endX: col - 1,
                                touchesLeft: runStart === 0,
                                touchesRight: col === cols
                            };
                        }
                    }
                }
                // Start new run
                runStart = col;
                runColor = cell;
            }
        }
    }
    
    return runs;
}

/**
 * Detect edge vertical Z/S placement (creates unfillable patterns)
 */
function isEdgeVerticalProblem(shape, x, colHeights, cols) {
    const shapeHeight = shape.length;
    const shapeWidth = shape[0] ? shape[0].length : 0;
    
    // Vertical Z/S: height=3, width=2
    if (shapeHeight !== 3 || shapeWidth !== 2) return false;
    
    if (x === 0) {
        // Left edge - problem if col 0 >= col 1
        return colHeights[0] >= colHeights[1];
    } else if (x === cols - 2) {
        // Right edge - problem if col 9 >= col 8
        return colHeights[cols - 1] >= colHeights[cols - 2];
    }
    
    return false;
}

/**
 * Count overhangs (pieces with empty cells below)
 */
function countOverhangs(board, shape, x, y, rows) {
    let count = 0;
    let severe = 0;
    
    for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
            if (!shape[py][px]) continue;
            
            const bx = x + px;
            const by = y + py;
            
            if (by >= rows - 1) continue;
            
            // Count empty cells below this piece cell
            let emptyBelow = 0;
            for (let checkY = by + 1; checkY < rows; checkY++) {
                // Check if piece itself provides support
                let pieceSupport = false;
                for (let ppy = py + 1; ppy < shape.length; ppy++) {
                    if (shape[ppy] && shape[ppy][px]) {
                        pieceSupport = true;
                        break;
                    }
                }
                if (pieceSupport) break;
                
                if (board[checkY] && board[checkY][bx]) break;
                emptyBelow++;
            }
            
            if (emptyBelow > 0) {
                count++;
                if (emptyBelow >= 2) severe++;
            }
        }
    }
    
    return { count, severe };
}

/**
 * Count complete rows that would clear
 */
function countCompleteRows(board, rows) {
    let count = 0;
    for (let row = 0; row < rows; row++) {
        if (board[row] && board[row].every(cell => cell !== null)) {
            count++;
        }
    }
    return count;
}

/**
 * Count horizontal color adjacencies for the placed piece
 */
function countColorAdjacencies(board, shape, x, y, color, cols) {
    let horizontal = 0;
    let vertical = 0;
    
    for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
            if (!shape[py][px]) continue;
            
            const bx = x + px;
            const by = y + py;
            
            // Check left
            if (bx > 0 && by >= 0 && board[by] && board[by][bx - 1] === color) {
                horizontal++;
            }
            // Check right  
            if (bx < cols - 1 && by >= 0 && board[by] && board[by][bx + 1] === color) {
                horizontal++;
            }
            // Check above
            if (by > 0 && board[by - 1] && board[by - 1][bx] === color) {
                vertical++;
            }
            // Check below
            if (by < board.length - 1 && board[by + 1] && board[by + 1][bx] === color) {
                vertical++;
            }
        }
    }
    
    return { horizontal, vertical };
}

/**
 * Check for black hole potential (enclosed blob of same color)
 * A black hole forms when a color completely surrounds empty cells
 */
function analyzeBlackHolePotential(board, cols, rows) {
    // For each color, check if it forms a closed loop
    const colorBlobs = {};
    
    for (let row = 0; row < rows; row++) {
        if (!board[row]) continue;
        for (let col = 0; col < cols; col++) {
            const color = board[row][col];
            if (!color) continue;
            
            if (!colorBlobs[color]) {
                colorBlobs[color] = { cells: [], minX: cols, maxX: 0, minY: rows, maxY: 0 };
            }
            
            colorBlobs[color].cells.push({ x: col, y: row });
            colorBlobs[color].minX = Math.min(colorBlobs[color].minX, col);
            colorBlobs[color].maxX = Math.max(colorBlobs[color].maxX, col);
            colorBlobs[color].minY = Math.min(colorBlobs[color].minY, row);
            colorBlobs[color].maxY = Math.max(colorBlobs[color].maxY, row);
        }
    }
    
    let bestPotential = null;
    
    for (const color in colorBlobs) {
        const blob = colorBlobs[color];
        const width = blob.maxX - blob.minX + 1;
        const height = blob.maxY - blob.minY + 1;
        
        // Need at least 3x3 area to potentially form a black hole
        if (width < 3 || height < 3) continue;
        
        // Count perimeter cells vs interior
        const perimeterCount = blob.cells.filter(c => 
            c.x === blob.minX || c.x === blob.maxX || 
            c.y === blob.minY || c.y === blob.maxY
        ).length;
        
        // Estimate enclosure progress
        const expectedPerimeter = 2 * width + 2 * height - 4;
        const progress = perimeterCount / expectedPerimeter;
        
        if (progress >= 0.5 && (!bestPotential || progress > bestPotential.progress)) {
            bestPotential = { color, progress, width, height };
        }
    }
    
    return bestPotential;
}

/**
 * Check if tsunami survives a line clear
 */
function checkTsunamiAfterClear(board, tsunamiColor, cols, rows) {
    const { board: clearedBoard } = clearLines(board);
    const newRuns = analyzeColorRuns(clearedBoard, cols, rows);
    const newRun = newRuns[tsunamiColor];
    
    return {
        survives: newRun && newRun.width >= 6,
        newWidth: newRun ? newRun.width : 0
    };
}

/**
 * Calculate post-tsunami heights (what heights would be after tsunami clears)
 * This helps avoid building tall stacks of non-tsunami-colored cells
 */
function analyzePostTsunamiHeights(board, tsunamiColor, cols, rows) {
    if (!tsunamiColor) return null;
    
    const postHeights = new Array(cols).fill(0);
    
    for (let col = 0; col < cols; col++) {
        // Count cells that would survive (not tsunami color)
        let survivingHeight = 0;
        for (let row = 0; row < rows; row++) {
            if (board[row] && board[row][col] && board[row][col] !== tsunamiColor) {
                survivingHeight++;
            }
        }
        postHeights[col] = survivingHeight;
    }
    
    return {
        heights: postHeights,
        maxHeight: Math.max(...postHeights),
        totalSurviving: postHeights.reduce((a, b) => a + b, 0)
    };
}

// ==================== MAIN EVALUATION FUNCTION ====================

/**
 * Evaluate a board state after piece placement
 * Returns { score, breakdown }
 */
function evaluateBoard(board, shape, x, y, color, cols, rows, includeBreakdown = false) {
    const isBreeze = currentSkillLevel === 'breeze';
    
    // ===== BOARD METRICS =====
    const colHeights = getColumnHeights(board, cols, rows);
    const stackHeight = Math.max(...colHeights);
    const minHeight = Math.min(...colHeights);
    const heightImbalance = stackHeight - minHeight;
    const holes = countHoles(board);
    const columnsWithHoles = countColumnsWithHoles(board);
    const bumpiness = getBumpiness(board);
    const completeRows = countCompleteRows(board, rows);
    const iPieceWells = analyzeIPieceWells(colHeights, cols);
    const colorRuns = analyzeColorRuns(board, cols, rows);
    const overhangs = countOverhangs(board, shape, x, y, rows);
    const edgeVertical = isEdgeVerticalProblem(shape, x, colHeights, cols);
    const adjacencies = countColorAdjacencies(board, shape, x, y, color, cols);
    
    // NOTE: Survival mode is determined ONCE in findBestPlacement() based on
    // the actual board state, not here during individual placement evaluation.
    // The global inSurvivalMode is read but not modified here.
    
    // ===== GAME PHASE =====
    // Phase is more granular than survival mode
    let phase = 'safe';
    if (stackHeight >= config.criticalHeight || holes >= config.criticalHoles) {
        phase = 'critical';
    } else if (stackHeight >= config.dangerHeight || holes >= config.dangerHoles) {
        phase = 'danger';
    } else if (stackHeight >= config.cautionHeight || holes >= config.cautionHoles) {
        phase = 'caution';
    }
    
    // ===== TSUNAMI DETECTION =====
    let bestTsunamiWidth = 0;
    let bestTsunamiColor = null;
    let tsunamiRun = null;
    
    if (!isBreeze) {
        for (const runColor in colorRuns) {
            const run = colorRuns[runColor];
            if (run.width > bestTsunamiWidth) {
                bestTsunamiWidth = run.width;
                bestTsunamiColor = runColor;
                tsunamiRun = run;
            }
        }
    }
    
    // Check ALL 4 queue pieces for tsunami achievability (not just 3)
    const matchingInQueue = pieceQueue.filter(p => p && p.color === bestTsunamiColor).length;
    const blocksNeeded = 10 - bestTsunamiWidth;
    const tsunamiImminent = bestTsunamiWidth >= 9;
    const tsunamiAchievable = bestTsunamiWidth >= 7 && matchingInQueue >= blocksNeeded;
    
    // In survival mode: only pursue if imminent (direct path to completion)
    // Otherwise: start building at width 5+
    const tsunamiWorthBuilding = inSurvivalMode 
        ? (tsunamiImminent && holes <= 6)  // In survival, only if imminent
        : (bestTsunamiWidth >= 5 && holes <= 4 && phase !== 'critical');
    
    const tsunamiNearComplete = bestTsunamiWidth >= 7;
    
    // ===== POST-TSUNAMI HEIGHT ANALYSIS =====
    // When building tsunami, penalize placements that leave tall non-tsunami stacks
    const postTsunamiInfo = (bestTsunamiWidth >= 7 && bestTsunamiColor) 
        ? analyzePostTsunamiHeights(board, bestTsunamiColor, cols, rows)
        : null;
    
    // ===== BLACK HOLE DETECTION =====
    const blackHolePotential = !isBreeze ? analyzeBlackHolePotential(board, cols, rows) : null;
    
    // ===== SCORING =====
    let score = 0;
    const breakdown = includeBreakdown ? {
        holes: { count: holes, penalty: 0 },
        height: { value: stackHeight, penalty: 0 },
        bumpiness: { value: bumpiness, penalty: 0 },
        wells: { count: iPieceWells.length, penalty: 0 },
        overhangs: { count: overhangs.count, severe: overhangs.severe, edgeVertical, penalty: 0 },
        lineClears: { count: completeRows, bonus: 0 },
        blob: { horizontal: adjacencies.horizontal, vertical: adjacencies.vertical, bonus: 0 },
        tsunami: { width: bestTsunamiWidth, color: bestTsunamiColor, imminent: tsunamiImminent, bonus: 0 },
        blackHole: { potential: blackHolePotential, bonus: 0 },
        phase,
        survivalMode: inSurvivalMode,
        ufoActive: currentUfoActive,
        classification: 'neutral'
    } : null;
    
    // ----- HOLE PENALTY (CRITICAL) -----
    // Holes are the #1 killer. Heavily penalize, especially early game.
    let holePenalty = 0;
    
    if (holes > 0) {
        // Base penalty per hole
        if (holes <= 3) {
            holePenalty = holes * 40;
        } else if (holes <= 6) {
            holePenalty = 120 + (holes - 3) * 50;
        } else if (holes <= 10) {
            holePenalty = 270 + (holes - 6) * 60;
        } else {
            holePenalty = 510 + (holes - 10) * 80;
        }
        
        // Extra penalty for holes in multiple columns (harder to clear)
        if (columnsWithHoles >= 3) {
            holePenalty += columnsWithHoles * 20;
        }
        
        // MASSIVE extra penalty for creating holes at low stack heights
        // These holes will persist for the entire game
        if (stackHeight <= 6) {
            holePenalty += holes * 80;
        } else if (stackHeight <= 10) {
            holePenalty += holes * 40;
        }
        
        // Reduce penalty slightly if tsunami is imminent (holes will clear)
        if (tsunamiImminent && color === bestTsunamiColor) {
            holePenalty = Math.round(holePenalty * 0.5);
        } else if (tsunamiAchievable && color === bestTsunamiColor) {
            holePenalty = Math.round(holePenalty * 0.7);
        }
    }
    
    score -= holePenalty;
    if (breakdown) breakdown.holes.penalty = holePenalty;
    
    // ----- HEIGHT PENALTY -----
    // Don't penalize low stacks too much - we want the board to build up naturally
    let heightPenalty = 0;
    
    if (inSurvivalMode) {
        // SURVIVAL MODE: Strong penalty at all heights to drive stack down
        heightPenalty = stackHeight * 3.5;
        
        // Exponential increase at dangerous heights
        if (stackHeight >= 16) {
            heightPenalty += (stackHeight - 15) * 40;
        } else if (stackHeight >= 14) {
            heightPenalty += (stackHeight - 13) * 20;
        } else if (stackHeight >= 12) {
            heightPenalty += (stackHeight - 11) * 10;
        }
    } else {
        // NORMAL MODE: Only penalize above a reasonable height
        // Allow stack to naturally reach 6-8 before penalties kick in
        if (stackHeight > 8) {
            heightPenalty = (stackHeight - 8) * 2.5;
        }
        
        // Exponential increase at dangerous heights
        if (stackHeight >= 16) {
            heightPenalty += (stackHeight - 15) * 30;
        } else if (stackHeight >= 14) {
            heightPenalty += (stackHeight - 13) * 15;
        } else if (stackHeight >= 12) {
            heightPenalty += (stackHeight - 11) * 8;
        }
    }
    
    score -= heightPenalty;
    if (breakdown) breakdown.height.penalty = heightPenalty;
    
    // ----- BUMPINESS PENALTY -----
    let bumpinessPenalty = bumpiness * 2.5;
    
    // Higher penalty at dangerous heights
    if (stackHeight >= 14) {
        bumpinessPenalty *= 1.5;
    } else if (stackHeight >= 12) {
        bumpinessPenalty *= 1.25;
    }
    
    score -= bumpinessPenalty;
    if (breakdown) breakdown.bumpiness.penalty = bumpinessPenalty;
    
    // ----- TOWER PENALTY -----
    // Penalize columns that are much taller than the median
    // This prevents vertical stacking that creates isolated towers
    let towerPenalty = 0;
    
    // Sort heights to find median
    const sortedHeights = [...colHeights].sort((a, b) => a - b);
    const medianHeight = sortedHeights[Math.floor(cols / 2)];
    
    for (let col = 0; col < cols; col++) {
        const h = colHeights[col];
        
        // Check excess above median
        const excessFromMedian = h - medianHeight;
        
        if (excessFromMedian >= 8) {
            // Severe tower - very dangerous
            towerPenalty += excessFromMedian * 10;
        } else if (excessFromMedian >= 6) {
            // Bad tower
            towerPenalty += excessFromMedian * 6;
        } else if (excessFromMedian >= 4) {
            // Moderate tower
            towerPenalty += excessFromMedian * 3;
        }
        
        // Also check against immediate neighbors (original logic)
        const leftH = col > 0 ? colHeights[col - 1] : 0;
        const rightH = col < cols - 1 ? colHeights[col + 1] : 0;
        const avgNeighbor = (leftH + rightH) / 2;
        const excessFromNeighbor = h - avgNeighbor;
        
        if (excessFromNeighbor >= 6) {
            towerPenalty += excessFromNeighbor * 4;
        }
    }
    
    // Extra penalty if max height is getting dangerous
    if (stackHeight >= 14 && towerPenalty > 0) {
        towerPenalty *= 1.5;
    }
    
    score -= towerPenalty;
    
    // ----- UNNECESSARY STACKING PENALTY -----
    // Penalize placing pieces that result in columns much taller than neighbors
    // This prevents pointlessly adding height when horizontal/flat placements exist
    let stackingPenalty = 0;
    
    // Check each column the piece occupies
    for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
            if (shape[py][px]) {
                const col = x + px;
                if (col >= 0 && col < cols) {
                    const colH = colHeights[col];  // Height AFTER placement
                    const leftH = col > 0 ? colHeights[col - 1] : colH;
                    const rightH = col < cols - 1 ? colHeights[col + 1] : colH;
                    const avgNeighbor = (leftH + rightH) / 2;
                    
                    // If this column is now taller than neighbors, the piece added unnecessary height
                    const excessHeight = colH - avgNeighbor;
                    if (excessHeight > 2) {
                        stackingPenalty += excessHeight * 12;
                    } else if (excessHeight > 0) {
                        stackingPenalty += excessHeight * 5;
                    }
                }
            }
        }
    }
    
    // Increase penalty in survival mode - stacking is deadly
    if (inSurvivalMode && stackingPenalty > 0) {
        stackingPenalty *= 2.0;
    }
    
    score -= stackingPenalty;
    
    // ----- I-PIECE WELL PENALTY -----
    let wellPenalty = 0;
    
    for (const well of iPieceWells) {
        // Penalty scales with depth - deeper wells are much worse
        if (well.depth >= 8) {
            wellPenalty += 200 + (well.depth - 8) * 50;
        } else if (well.depth >= 6) {
            wellPenalty += 100 + (well.depth - 6) * 50;
        } else if (well.depth >= 4) {
            wellPenalty += 50 + (well.depth - 4) * 25;
        } else {
            wellPenalty += 30;
        }
    }
    
    // Extra penalty for multiple wells (need multiple I-pieces)
    if (iPieceWells.length >= 2) {
        wellPenalty += iPieceWells.length * 50;
    }
    
    // Reduce if I-piece in queue
    // Check if I-piece in queue (reduces well urgency)
    // Detect I-piece by shape: 1x4 or 4x1
    const isIPiece = (p) => {
        if (!p || !p.shape) return false;
        const h = p.shape.length;
        const w = p.shape[0] ? p.shape[0].length : 0;
        return (h === 4 && w === 1) || (h === 1 && w === 4);
    };
    const hasIPieceInQueue = pieceQueue.some(isIPiece);
    if (hasIPieceInQueue && iPieceWells.length === 1 && iPieceWells[0].depth <= 6) {
        wellPenalty = Math.round(wellPenalty * 0.6);
    }
    
    score -= wellPenalty;
    if (breakdown) breakdown.wells.penalty = wellPenalty;
    
    // ----- OVERHANG PENALTY -----
    let overhangPenalty = overhangs.count * 20 + overhangs.severe * 30;
    
    // MASSIVE penalty for edge vertical Z/S - these create unfillable patterns
    if (edgeVertical) {
        if (stackHeight >= 14) {
            overhangPenalty += 400;
        } else if (stackHeight >= 12) {
            overhangPenalty += 250;
        } else if (stackHeight >= 10) {
            overhangPenalty += 180;
        } else {
            overhangPenalty += 120;
        }
    }
    
    // Penalty for vertical S/Z pieces
    // Vertical S/Z adds 3 height vs horizontal's 2 height
    // Penalize especially when creating overhangs (which become holes)
    const isVerticalSZ = shape.length === 3 && shape[0].length === 2;
    if (isVerticalSZ) {
        // Check if this creates overhangs (holes underneath the piece)
        if (overhangs.count > 0) {
            // Significant penalty - horizontal would create same hole but less height
            overhangPenalty += 70;
            
            // Extra penalty at higher stacks - vertical stacking is more dangerous
            if (stackHeight >= 14) {
                overhangPenalty += 80;
            } else if (stackHeight >= 12) {
                overhangPenalty += 50;
            } else if (stackHeight >= 8) {
                overhangPenalty += 25;
            }
        } else {
            // Small penalty even for clean vertical placement - adds more height
            overhangPenalty += 10;
        }
    }
    
    // Reduce for imminent tsunami
    if (tsunamiImminent && color === bestTsunamiColor) {
        overhangPenalty = Math.round(overhangPenalty * 0.3);
    }
    
    score -= overhangPenalty;
    if (breakdown) breakdown.overhangs.penalty = overhangPenalty;
    
    // ----- LINE CLEAR HANDLING -----
    let lineClearBonus = 0;
    
    if (completeRows > 0) {
        // UFO EASTER EGG: When UFO is active, avoid clearing lines to let it complete
        // Only bypass for TRULY critical situations (high stack AND critical phase)
        // We want to let the UFO easter egg play out unless death is imminent
        const ufoTrulyCritical = (phase === 'critical' && stackHeight >= 15) || stackHeight >= 17;
        if (currentUfoActive && !ufoTrulyCritical) {
            // UFO is circling! Heavily penalize line clears to preserve the 42 line count
            lineClearBonus = -300 * completeRows;
            if (breakdown) breakdown.classification = 'ufo_preserve';
        }
        // SURVIVAL MODE: Always heavily reward line clears
        else if (inSurvivalMode) {
            // In survival mode, line clears are CRITICAL
            // More lines = exponentially better (clearing 4 is way better than 4x clearing 1)
            if (completeRows >= 4) {
                lineClearBonus = 600;  // Tetris in survival is amazing
            } else if (completeRows >= 3) {
                lineClearBonus = 400;
            } else if (completeRows >= 2) {
                lineClearBonus = 250;
            } else {
                lineClearBonus = 150;
            }
            if (breakdown) breakdown.classification = 'survival';
        }
        // NOT in survival mode - consider phase and tsunami protection
        else if (phase === 'critical') {
            lineClearBonus = completeRows * 300;
            if (breakdown) breakdown.classification = 'survival';
        } else if (phase === 'danger') {
            lineClearBonus = completeRows * 200;
            if (breakdown) breakdown.classification = 'defensive';
        } else if (phase === 'caution') {
            lineClearBonus = completeRows * 120;
        } else {
            // Safe phase: line clears are good, but don't sacrifice tsunami progress
            if (tsunamiWorthBuilding && !tsunamiImminent) {
                // Check if this clear would destroy the tsunami
                const survivalCheck = checkTsunamiAfterClear(board, bestTsunamiColor, cols, rows);
                
                if (!survivalCheck.survives && bestTsunamiWidth >= 5) {
                    // Line clear destroys tsunami progress - penalty proportional to width
                    const widthPenalty = (bestTsunamiWidth - 4) * 15;
                    lineClearBonus = -completeRows * widthPenalty;
                } else if (survivalCheck.newWidth < bestTsunamiWidth - 1) {
                    // Significant damage to tsunami - reduced bonus
                    lineClearBonus = completeRows * 30;
                } else {
                    // Tsunami survives - moderate bonus
                    lineClearBonus = completeRows * 60;
                }
            } else {
                // No tsunami to protect - but don't over-incentivize clearing at low stacks
                // Allow the board to build up naturally before rewarding clears
                if (stackHeight <= 6) {
                    // Stack is very low - minimal bonus, let it build up
                    lineClearBonus = completeRows * 20;
                } else if (stackHeight <= 8) {
                    // Stack is moderate - small bonus
                    lineClearBonus = completeRows * 50;
                } else {
                    // Stack is getting taller - normal bonus
                    lineClearBonus = completeRows * 100;
                }
            }
        }
        
        // Reduce bonus if this creates edge vertical problem
        if (edgeVertical) {
            lineClearBonus = Math.round(lineClearBonus * 0.2);
        }
    }
    
    score += lineClearBonus;
    if (breakdown) breakdown.lineClears.bonus = lineClearBonus;
    
    // ----- BLOB BUILDING BONUS -----
    // Reward horizontal color adjacency (builds toward tsunamis)
    // In survival mode: only use as tie-breaker (very small values)
    // In Breeze mode: small tie-breaker bonus (no special events, but prefer grouping)
    // Outside survival mode: AGGRESSIVE bonus to encourage blob building
    let blobBonus = 0;
    
    if (isBreeze) {
        // BREEZE MODE: Small tie-breaker bonus only
        // Makes the game more visually interesting even without special events
        blobBonus = adjacencies.horizontal * 0.3 + adjacencies.vertical * 0.1;
    } else if (inSurvivalMode) {
        // SURVIVAL MODE: Minimal blob bonus (tie-breaker only)
        // Still prefer bigger blobs when all else is equal, but don't sacrifice anything for it
        blobBonus = adjacencies.horizontal * 0.5 + adjacencies.vertical * 0.1;
    } else if (phase !== 'critical') {
        // NORMAL MODE: Aggressive blob building bonus
        // Horizontal adjacency is much more valuable than vertical
        blobBonus = adjacencies.horizontal * 18 + adjacencies.vertical * 4;
        
        // Bonus for contributing to existing color run
        if (bestTsunamiColor && color === bestTsunamiColor && tsunamiRun) {
            // Check if piece is on or adjacent to the run's row
            const pieceTopRow = y;
            const pieceBottomRow = y + shape.length - 1;
            
            if (tsunamiRun.row >= pieceTopRow && tsunamiRun.row <= pieceBottomRow) {
                // Piece is on the tsunami row - scale bonus with current width
                blobBonus += bestTsunamiWidth * 15;
                
                // Extra for extending the run
                const pieceMinX = x;
                const pieceMaxX = x + (shape[0]?.length || 1) - 1;
                
                if (pieceMinX <= tsunamiRun.startX && !tsunamiRun.touchesLeft) {
                    blobBonus += 60;
                }
                if (pieceMaxX >= tsunamiRun.endX && !tsunamiRun.touchesRight) {
                    blobBonus += 60;
                }
            } else {
                // Not on tsunami row, but matching color - still some bonus
                blobBonus += bestTsunamiWidth * 6;
            }
        }
        
        // Scale down in caution phase (but not as much as before)
        if (phase === 'caution') {
            blobBonus = Math.round(blobBonus * 0.75);
        }
    }
    
    score += blobBonus;
    if (breakdown) breakdown.blob.bonus = blobBonus;
    
    // ----- TSUNAMI BONUS -----
    let tsunamiBonus = 0;
    
    if (!isBreeze && tsunamiWorthBuilding && color === bestTsunamiColor) {
        if (tsunamiImminent) {
            // Width 9+: Very close to completion - big bonus
            tsunamiBonus = 180 + (bestTsunamiWidth - 9) * 100;
            if (breakdown) breakdown.classification = 'offensive';
        } else if (tsunamiAchievable) {
            // Width 7+ with pieces in queue to complete
            tsunamiBonus = 120 + matchingInQueue * 25;
        } else if (tsunamiNearComplete) {
            // Width 7-8: significant bonus
            tsunamiBonus = 60 + (bestTsunamiWidth - 6) * 20;
        } else if (bestTsunamiWidth >= 5) {
            // Width 5-6: meaningful bonus to encourage building
            tsunamiBonus = 30 + (bestTsunamiWidth - 4) * 15;
        }
        
        // Reduce if foundation is unstable (will die after tsunami clears)
        if (heightImbalance >= 8 || (heightImbalance >= 6 && iPieceWells.length >= 2)) {
            tsunamiBonus = Math.round(tsunamiBonus * 0.3);
        }
    }
    
    score += tsunamiBonus;
    if (breakdown) breakdown.tsunami.bonus = tsunamiBonus;
    
    // ----- POST-TSUNAMI HEIGHT PENALTY -----
    // When building a tsunami, penalize placements that leave tall non-tsunami stacks
    // These will remain after the tsunami clears and can cause death
    let postTsunamiPenalty = 0;
    
    if (postTsunamiInfo && tsunamiWorthBuilding && color !== bestTsunamiColor) {
        // This piece is NOT tsunami color - it will survive the clear
        // Penalize heavily if it's being placed in a column with already-high post-tsunami height
        
        // Calculate which columns this piece touches
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px]) {
                    const col = x + px;
                    if (col >= 0 && col < cols) {
                        const currentPostHeight = postTsunamiInfo.heights[col];
                        
                        // Penalize based on how tall the post-tsunami stack would be
                        if (currentPostHeight >= 10) {
                            postTsunamiPenalty += 60;  // Dangerous - this could kill us
                        } else if (currentPostHeight >= 7) {
                            postTsunamiPenalty += 30;  // Getting risky
                        } else if (currentPostHeight >= 4) {
                            postTsunamiPenalty += 10;  // Minor concern
                        }
                    }
                }
            }
        }
        
        // Extra penalty if max post-tsunami height is already high
        if (postTsunamiInfo.maxHeight >= 12) {
            postTsunamiPenalty += 100;  // Critical - tsunami won't save us
        } else if (postTsunamiInfo.maxHeight >= 10) {
            postTsunamiPenalty += 50;
        }
    }
    
    score -= postTsunamiPenalty;
    if (breakdown) {
        breakdown.postTsunami = { 
            maxHeight: postTsunamiInfo?.maxHeight || 0, 
            penalty: postTsunamiPenalty 
        };
    }
    
    // ----- BLACK HOLE BONUS -----
    let blackHoleBonus = 0;
    
    // In survival mode: only pursue black holes if nearly complete (direct path)
    // Outside survival mode: aggressively pursue based on progress
    const blackHoleNearComplete = blackHolePotential && blackHolePotential.progress >= 0.8;
    const shouldPursueBlackHole = !isBreeze && blackHolePotential && 
        (inSurvivalMode ? blackHoleNearComplete : phase !== 'critical');
    
    if (shouldPursueBlackHole) {
        // Check if piece color matches black hole color
        if (color === blackHolePotential.color) {
            // Bonus based on progress toward enclosure
            if (blackHolePotential.progress >= 0.8) {
                blackHoleBonus = 120;
            } else if (blackHolePotential.progress >= 0.6) {
                blackHoleBonus = 60;
            } else if (blackHolePotential.progress >= 0.5) {
                blackHoleBonus = 30;
            }
            
            // Scale with size of potential black hole
            blackHoleBonus += blackHolePotential.width * 6 + blackHolePotential.height * 6;
        }
        
        // Reduce in caution phase (but not in survival mode pursuing near-complete)
        if (phase === 'caution' && !inSurvivalMode) {
            blackHoleBonus = Math.round(blackHoleBonus * 0.6);
        }
    }
    
    score += blackHoleBonus;
    if (breakdown) breakdown.blackHole.bonus = blackHoleBonus;
    
    // ----- I-PIECE HANDLING -----
    // Vertical I-pieces should ONLY be used to fill wells/gaps
    // Horizontal I-pieces are almost always better (add 1 height vs 4)
    const isVerticalI = shape.length === 4 && shape.every(row => row.length === 1 && row[0]);
    const isHorizontalI = shape.length === 1 && shape[0].length === 4;
    
    if (isVerticalI) {
        // colHeights is AFTER placement, so the vertical I already added 4 to this column
        // Check if the result is good (column at or below neighbors) or bad (column above neighbors)
        const placedCol = x;
        const currentH = colHeights[placedCol];  // Height AFTER placing vertical I
        const leftH = placedCol > 0 ? colHeights[placedCol - 1] : currentH;
        const rightH = placedCol < cols - 1 ? colHeights[placedCol + 1] : currentH;
        const neighborAvg = (leftH + rightH) / 2;
        
        // If column is now at or below neighbor average, we filled a gap - good!
        // If column is now above neighbors, we stacked on top - bad!
        const excessAboveNeighbors = currentH - neighborAvg;
        
        if (excessAboveNeighbors <= 0) {
            // Good: filled a gap, column is now level or below neighbors
            score += 60;
        } else if (excessAboveNeighbors <= 2) {
            // Slight excess - minor penalty
            score -= 40;
        } else if (excessAboveNeighbors <= 4) {
            // Moderate excess - this was a bad vertical placement
            score -= 120;
        } else {
            // Severe excess - terrible vertical placement, created a tower
            score -= 200;
            
            // Even worse in survival mode
            if (inSurvivalMode) {
                score -= 100;
            }
        }
    }
    
    // ----- EDGE FILL BONUS -----
    // Reward filling low edges
    const leftEdgeDepth = colHeights[1] - colHeights[0];
    const rightEdgeDepth = colHeights[cols - 2] - colHeights[cols - 1];
    
    let touchesCol0 = false;
    let touchesCol9 = false;
    for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
            if (shape[py][px]) {
                if (x + px === 0) touchesCol0 = true;
                if (x + px === cols - 1) touchesCol9 = true;
            }
        }
    }
    
    if (touchesCol0 && leftEdgeDepth >= 3) {
        score += 15 + leftEdgeDepth * 5;
    }
    if (touchesCol9 && rightEdgeDepth >= 3) {
        score += 15 + rightEdgeDepth * 5;
    }
    
    // ----- SURVIVAL FILL BONUS -----
    // When stack is getting dangerous, reward filling the lowest columns
    if (phase === 'danger' || phase === 'critical') {
        let survivalBonus = 0;
        
        // Check if piece fills low columns
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px]) {
                    const col = x + px;
                    const colDepth = stackHeight - colHeights[col];
                    
                    // Bonus for filling columns that are significantly below max
                    if (colDepth >= 4) {
                        survivalBonus += colDepth * 8;
                    }
                }
            }
        }
        
        if (phase === 'critical') {
            survivalBonus *= 2;
        }
        
        score += survivalBonus;
    }
    
    // ----- SET CLASSIFICATION -----
    if (breakdown && breakdown.classification === 'neutral') {
        if (blobBonus > 30 || tsunamiBonus > 0) {
            breakdown.classification = 'offensive';
        } else if (holePenalty > 50 || phase !== 'safe') {
            breakdown.classification = 'defensive';
        }
    }
    
    return includeBreakdown ? { score, breakdown } : score;
}

// ==================== PLACEMENT GENERATION ====================

function generatePlacements(board, piece, cols, rows, captureBreakdown = false) {
    const rotations = getAllRotations(piece.shape);
    const placements = [];
    
    for (let rotationIndex = 0; rotationIndex < rotations.length; rotationIndex++) {
        const rotatedShape = rotations[rotationIndex];
        const shapeWidth = rotatedShape[0] ? rotatedShape[0].length : 1;
        
        for (let x = 0; x <= cols - shapeWidth; x++) {
            const y = getDropY(board, rotatedShape, x, cols, rows);
            
            if (!isValidPosition(board, rotatedShape, x, y, cols, rows)) continue;
            
            const newBoard = placePiece(board, rotatedShape, x, y, piece.color);
            
            if (captureBreakdown) {
                const { score, breakdown } = evaluateBoard(newBoard, rotatedShape, x, y, piece.color, cols, rows, true);
                placements.push({ x, y, rotationIndex, shape: rotatedShape, score, breakdown });
            } else {
                const score = evaluateBoard(newBoard, rotatedShape, x, y, piece.color, cols, rows, false);
                placements.push({ x, y, rotationIndex, shape: rotatedShape, score });
            }
        }
    }
    
    return placements;
}

// ==================== LOOKAHEAD ====================

function findBestPlacement(board, piece, cols, rows, queue, captureDecisionMeta = false) {
    // UPDATE SURVIVAL MODE based on CURRENT board state (before any placements)
    // This ensures consistent behavior for all placement evaluations
    const currentHeights = getColumnHeights(board, cols, rows);
    const currentStackHeight = Math.max(...currentHeights);
    const currentHoles = countHoles(board);
    
    // Enter survival mode on high stack OR too many holes
    // Exit only when BOTH stack is low AND holes are cleared
    if (currentStackHeight >= config.survivalEnterHeight || currentHoles >= config.survivalEnterHoles) {
        inSurvivalMode = true;
    } else if (currentStackHeight <= config.survivalExitHeight && currentHoles <= config.survivalExitHoles) {
        inSurvivalMode = false;
    }
    // Otherwise maintain current state (hysteresis)
    
    const placements = generatePlacements(board, piece, cols, rows, captureDecisionMeta);
    
    if (placements.length === 0) {
        return captureDecisionMeta ? { placement: null, decisionMeta: null } : null;
    }
    
    // Configurable lookahead depth
    const lookaheadDepth = Math.min(config.lookaheadDepth, queue.length);
    
    for (const placement of placements) {
        let lookaheadScore = 0;
        let currentBoard = placePiece(board, placement.shape, placement.x, placement.y, piece.color);
        
        // Clear lines after placement
        const clearResult = clearLines(currentBoard);
        currentBoard = clearResult.board;
        
        // Evaluate future placements
        for (let depth = 0; depth < lookaheadDepth; depth++) {
            const nextPiece = queue[depth];
            if (!nextPiece) break;
            
            const nextPlacements = generatePlacements(currentBoard, nextPiece, cols, rows, false);
            if (nextPlacements.length === 0) {
                // Game over in lookahead - very bad
                lookaheadScore -= 1000;
                break;
            }
            
            // Find best next placement
            let bestNextScore = -Infinity;
            let bestNextPlacement = null;
            
            for (const np of nextPlacements) {
                if (np.score > bestNextScore) {
                    bestNextScore = np.score;
                    bestNextPlacement = np;
                }
            }
            
            // Weight future moves less (discount factor)
            const discount = Math.pow(config.lookaheadDiscount, depth + 1);
            lookaheadScore += bestNextScore * discount;
            
            // Update board for next iteration
            if (bestNextPlacement) {
                currentBoard = placePiece(currentBoard, bestNextPlacement.shape, bestNextPlacement.x, bestNextPlacement.y, nextPiece.color);
                const nextClear = clearLines(currentBoard);
                currentBoard = nextClear.board;
            }
        }
        
        placement.combinedScore = placement.score + lookaheadScore;
    }
    
    // Sort by combined score
    placements.sort((a, b) => b.combinedScore - a.combinedScore);
    
    const bestPlacement = placements[0];
    
    if (captureDecisionMeta) {
        const decisionMeta = {
            chosen: {
                x: bestPlacement.x,
                rotation: bestPlacement.rotationIndex,
                immediateScore: bestPlacement.score,
                combinedScore: bestPlacement.combinedScore,
                breakdown: bestPlacement.breakdown,
                classification: bestPlacement.breakdown?.classification || 'neutral'
            },
            alts: placements.slice(1, 4).map(p => ({
                x: p.x,
                rotation: p.rotationIndex,
                immediateScore: p.score,
                combinedScore: p.combinedScore,
                classification: p.breakdown?.classification || 'neutral'
            })),
            diff: placements.length > 1 ? bestPlacement.combinedScore - placements[1].combinedScore : 0
        };
        
        return { placement: bestPlacement, decisionMeta };
    }
    
    return bestPlacement;
}

// ==================== MESSAGE HANDLER ====================

self.onmessage = function(e) {
    const { command, board, piece, cols, rows, queue, skillLevel, ufoActive, cause, requestId, captureDecisionMeta } = e.data;
    
    // Handle reset command
    if (command === 'reset') {
        currentSkillLevel = 'tempest';
        pieceQueue = [];
        inSurvivalMode = false;
        currentUfoActive = false;
        config = { ...DEFAULT_CONFIG };  // Reset config to defaults
        self.postMessage({ reset: true });
        return;
    }
    
    // Handle setConfig command - update tunable parameters
    if (command === 'setConfig') {
        const newConfig = e.data.config || {};
        setConfig(newConfig);
        self.postMessage({ configSet: true, config: getConfig() });
        return;
    }
    
    // Handle getConfig command - return current configuration
    if (command === 'getConfig') {
        self.postMessage({ config: getConfig(), defaultConfig: DEFAULT_CONFIG });
        return;
    }
    
    // Handle startRecording command
    if (command === 'startRecording') {
        startRecording();
        gameRecording.skillLevel = skillLevel || currentSkillLevel;
        self.postMessage({ recordingStarted: true });
        return;
    }
    
    // Handle stopRecording command
    if (command === 'stopRecording') {
        if (board) {
            const recording = finalizeRecording(board, cause || 'manual_stop');
            self.postMessage({ recordingStopped: true, recording });
        } else {
            self.postMessage({ recordingStopped: true, recording: getRecording() });
        }
        return;
    }
    
    // Handle getRecording command
    if (command === 'getRecording') {
        self.postMessage({ recording: getRecording() });
        return;
    }
    
    // Handle recordEvent command
    if (command === 'recordEvent') {
        recordEvent(e.data.eventType, e.data.eventData || {});
        return;
    }
    
    // Handle ping
    if (e.data.type === 'ping') {
        self.postMessage({ type: 'pong' });
        return;
    }
    
    // Handle setSkillLevel
    if (e.data.type === 'setSkillLevel') {
        currentSkillLevel = e.data.skillLevel;
        self.postMessage({ type: 'skillLevelSet', skillLevel: currentSkillLevel });
        return;
    }
    
    // Shadow evaluation - calculate what AI would do without recording or executing
    if (command === 'shadowEvaluate') {
        currentSkillLevel = skillLevel || 'tempest';
        pieceQueue = queue || [];
        
        setTimeout(() => {
            const result = findBestPlacement(board, piece, cols, rows, pieceQueue, true);
            self.postMessage({ 
                shadowResponse: true,
                decisionMeta: result ? result.decisionMeta : null
            });
        }, 0);
        return;
    }
    
    // Main placement request
    if (board && piece) {
        // Update globals
        if (skillLevel) currentSkillLevel = skillLevel;
        if (queue) pieceQueue = queue;
        currentUfoActive = ufoActive || false;  // Update UFO state from message
        
        const shouldCapture = captureDecisionMeta || false;
        
        setTimeout(() => {
            const result = findBestPlacement(board, piece, cols, rows, queue || [], shouldCapture);
            const stackHeight = getStackHeight(board, rows);
            
            if (shouldCapture && result) {
                self.postMessage({
                    bestPlacement: result.placement,
                    stackHeight,
                    survivalMode: inSurvivalMode,
                    decisionMeta: result.decisionMeta,
                    requestId: requestId
                });
            } else {
                self.postMessage({
                    bestPlacement: result,
                    stackHeight,
                    survivalMode: inSurvivalMode,
                    requestId: requestId
                });
            }
        }, 0);
    }
};

// Ready signal
self.postMessage({ ready: true, version: AI_VERSION });
