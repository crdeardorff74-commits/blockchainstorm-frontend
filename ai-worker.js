// AI Worker v6.0.0 - Complete Rewrite
// Priorities: 1) Survival 2) No holes 3) Blob building 4) Special events
console.log("🤖 AI Worker v6.0.0 loaded - Complete rewrite with cleaner evaluation");

const AI_VERSION = "6.0.0";

// ==================== GLOBAL STATE ====================
let currentSkillLevel = 'tempest';
let pieceQueue = [];

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
    
    // ===== GAME PHASE =====
    // Determines how aggressive or defensive to play
    let phase = 'safe';
    if (stackHeight >= 16 || holes >= 10) {
        phase = 'critical';
    } else if (stackHeight >= 14 || holes >= 7) {
        phase = 'danger';
    } else if (stackHeight >= 12 || holes >= 5) {
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
    const tsunamiWorthBuilding = bestTsunamiWidth >= 7 && holes <= 4 && phase !== 'critical';
    
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
    let heightPenalty = stackHeight * 1.8;
    
    // Exponential increase at dangerous heights
    if (stackHeight >= 16) {
        heightPenalty += (stackHeight - 15) * 30;
    } else if (stackHeight >= 14) {
        heightPenalty += (stackHeight - 13) * 15;
    } else if (stackHeight >= 12) {
        heightPenalty += (stackHeight - 11) * 8;
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
    
    // Reduce for imminent tsunami
    if (tsunamiImminent && color === bestTsunamiColor) {
        overhangPenalty = Math.round(overhangPenalty * 0.3);
    }
    
    score -= overhangPenalty;
    if (breakdown) breakdown.overhangs.penalty = overhangPenalty;
    
    // ----- LINE CLEAR HANDLING -----
    let lineClearBonus = 0;
    
    if (completeRows > 0) {
        // In critical/danger phase: always reward line clears
        if (phase === 'critical') {
            lineClearBonus = completeRows * 300;
            if (breakdown) breakdown.classification = 'survival';
        } else if (phase === 'danger') {
            lineClearBonus = completeRows * 200;
            if (breakdown) breakdown.classification = 'defensive';
        } else if (phase === 'caution') {
            lineClearBonus = completeRows * 120;
        } else {
            // Safe phase: line clears are good, but don't sacrifice tsunami
            if (tsunamiWorthBuilding && !tsunamiImminent) {
                // Check if this clear would destroy the tsunami
                const survivalCheck = checkTsunamiAfterClear(board, bestTsunamiColor, cols, rows);
                
                if (!survivalCheck.survives && bestTsunamiWidth >= 7) {
                    // Line clear destroys tsunami progress - penalty
                    lineClearBonus = -completeRows * 30;
                } else if (survivalCheck.newWidth < bestTsunamiWidth - 1) {
                    // Significant damage to tsunami
                    lineClearBonus = completeRows * 40;
                } else {
                    lineClearBonus = completeRows * 80;
                }
            } else {
                lineClearBonus = completeRows * 100;
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
    let blobBonus = 0;
    
    if (!isBreeze && phase !== 'critical') {
        // Horizontal adjacency is much more valuable than vertical
        blobBonus = adjacencies.horizontal * 8 + adjacencies.vertical * 2;
        
        // Bonus for contributing to existing color run
        if (bestTsunamiColor && color === bestTsunamiColor && tsunamiRun) {
            // Check if piece is on or adjacent to the run's row
            const pieceTopRow = y;
            const pieceBottomRow = y + shape.length - 1;
            
            if (tsunamiRun.row >= pieceTopRow && tsunamiRun.row <= pieceBottomRow) {
                // Piece is on the tsunami row - nice bonus
                blobBonus += bestTsunamiWidth * 5;
                
                // Extra for extending the run
                const pieceMinX = x;
                const pieceMaxX = x + (shape[0]?.length || 1) - 1;
                
                if (pieceMinX <= tsunamiRun.startX && !tsunamiRun.touchesLeft) {
                    blobBonus += 25;
                }
                if (pieceMaxX >= tsunamiRun.endX && !tsunamiRun.touchesRight) {
                    blobBonus += 25;
                }
            }
        }
        
        // Scale down in caution phase
        if (phase === 'caution') {
            blobBonus = Math.round(blobBonus * 0.5);
        }
    }
    
    score += blobBonus;
    if (breakdown) breakdown.blob.bonus = blobBonus;
    
    // ----- TSUNAMI BONUS -----
    let tsunamiBonus = 0;
    
    if (!isBreeze && tsunamiWorthBuilding && color === bestTsunamiColor) {
        if (tsunamiImminent) {
            tsunamiBonus = 80 + (bestTsunamiWidth - 9) * 50;
            if (breakdown) breakdown.classification = 'offensive';
        } else if (tsunamiAchievable) {
            tsunamiBonus = 40 + matchingInQueue * 10;
        } else if (bestTsunamiWidth >= 7) {
            tsunamiBonus = 20;
        }
        
        // Reduce if foundation is unstable (will die after tsunami clears)
        if (heightImbalance >= 8 || (heightImbalance >= 6 && iPieceWells.length >= 2)) {
            tsunamiBonus = Math.round(tsunamiBonus * 0.3);
        }
    }
    
    score += tsunamiBonus;
    if (breakdown) breakdown.tsunami.bonus = tsunamiBonus;
    
    // ----- BLACK HOLE BONUS -----
    let blackHoleBonus = 0;
    
    if (!isBreeze && blackHolePotential && phase !== 'critical') {
        // Check if piece color matches black hole color
        if (color === blackHolePotential.color) {
            // Bonus based on progress toward enclosure
            if (blackHolePotential.progress >= 0.8) {
                blackHoleBonus = 60;
            } else if (blackHolePotential.progress >= 0.6) {
                blackHoleBonus = 30;
            } else {
                blackHoleBonus = 15;
            }
            
            // Scale with size of potential black hole
            blackHoleBonus += blackHolePotential.width * 3 + blackHolePotential.height * 3;
        }
        
        // Reduce in caution phase
        if (phase === 'caution') {
            blackHoleBonus = Math.round(blackHoleBonus * 0.5);
        }
    }
    
    score += blackHoleBonus;
    if (breakdown) breakdown.blackHole.bonus = blackHoleBonus;
    
    // ----- I-PIECE WELL FILL BONUS -----
    // Strongly reward placing I-pieces into wells
    const isVerticalI = shape.length === 4 && shape.every(row => row.length === 1 && row[0]);
    if (isVerticalI && iPieceWells.length > 0) {
        // Check if we're filling a well
        const wellAtX = iPieceWells.find(w => w.col === x);
        if (wellAtX) {
            score += 50 + wellAtX.depth * 20;
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
    const placements = generatePlacements(board, piece, cols, rows, captureDecisionMeta);
    
    if (placements.length === 0) {
        return captureDecisionMeta ? { placement: null, decisionMeta: null } : null;
    }
    
    // 4-ply lookahead: evaluate with next 3 pieces in queue
    const lookaheadDepth = Math.min(3, queue.length);
    
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
            const discount = Math.pow(0.7, depth + 1);
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
    const { board, piece, cols, rows, queue, skillLevel, captureDecisionMeta, requestId, command } = e.data;
    
    // Handle reset command
    if (command === 'reset') {
        currentSkillLevel = 'tempest';
        pieceQueue = [];
        self.postMessage({ reset: true });
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
    
    // Main placement request
    if (board && piece) {
        // Update globals
        if (skillLevel) currentSkillLevel = skillLevel;
        if (queue) pieceQueue = queue;
        
        const result = findBestPlacement(board, piece, cols, rows, queue || [], captureDecisionMeta);
        
        if (captureDecisionMeta) {
            self.postMessage({
                bestPlacement: result.placement,
                decisionMeta: result.decisionMeta,
                requestId: requestId
            });
        } else {
            self.postMessage({
                bestPlacement: result,
                requestId: requestId
            });
        }
    }
};

// Ready signal
self.postMessage({ ready: true, version: AI_VERSION });
