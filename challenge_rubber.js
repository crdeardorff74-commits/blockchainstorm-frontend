/**
 * challenge_rubber.js - Rubber & Glue challenge for BLOCKCHaiNSTORM / TaNTRiS
 *
 * Pieces that land without touching the same color bounce off instead
 * of sticking. Bounce physics include vertical/horizontal velocity
 * based on landing surface analysis, wall bouncing, and spin.
 * Pieces only "glue" (stick) when they touch a matching color blob
 * or would trigger a special event.
 *
 * Exports: window.ChallengeEffects.Rubber
 */

(function () {
    'use strict';

    const Rubber = (() => {
        let bouncingPieces = [];
        let gameRef = null;

        /**
         * Initialize with game state reference.
         *
         * gameState shape:
         *   ROWS, COLS               - board dimensions
         *   board                    - 2D color grid
         *   isRandomBlock            - 2D gremlin-placed tracker
         *   getCtx()                 - returns canvas 2D context
         *   getBlockSize()           - returns current BLOCK_SIZE
         *   getFaceOpacity()         - returns current face opacity
         *   drawSolidShape(ctx, pos, color, bs, gold, opacity) - render helper
         *   playSoundEffect(name)    - plays a named SFX
         *   applyGravity()           - full gravity pass
         *   isYesAndActive()         - true when Yes,And… mode is on
         *   spawnYesAndLimbs(piece)  - delegate to YesAnd module
         */
        function init(gs) {
            gameRef = gs;
            bouncingPieces = [];
        }

        /** Clear all bouncing pieces (mode change / reset / replay). */
        function reset() {
            bouncingPieces = [];
        }

        /** Number of pieces currently in the air. */
        function count() {
            return bouncingPieces.length;
        }

        // ------------------------------------------------------------------
        // TRIGGER
        // ------------------------------------------------------------------

        /**
         * Launch the given piece into a bounce arc.
         * @param {Object} piece - currentPiece at the moment of landing
         */
        function triggerBounce(piece) {
            console.log('🏀 BOUNCE! Piece doesn\'t touch same color');

            const landing = _analyzeLandingSurface(piece);
            const blobSize = landing.totalSupportBlocks;

            const baseVy = -0.4;
            const sizeMul = Math.sqrt(blobSize) * 0.15;
            const vy = baseVy - sizeMul;

            let vx = 0;
            if (landing.overhangLeft > 0 && landing.overhangRight === 0) {
                vx = -0.1 * landing.overhangLeft;
            } else if (landing.overhangRight > 0 && landing.overhangLeft === 0) {
                vx = 0.1 * landing.overhangRight;
            } else if (landing.overhangLeft > 0 && landing.overhangRight > 0) {
                vx = 0.075 * (landing.overhangRight - landing.overhangLeft);
            }

            console.log(`🎯 Bounce physics: height=${(-vy).toFixed(2)} (from ${blobSize} blocks), horizontal=${vx.toFixed(2)}`);

            bouncingPieces.push({
                shape: piece.shape,
                color: piece.color,
                x: piece.x,
                y: piece.y,
                vy,
                vx,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 4,
                gravity: 0.08,
                bounceCount: 0,
                maxBounces: blobSize > 10 ? 2 : 1
            });

            gameRef.playSoundEffect('drop');
        }

        // ------------------------------------------------------------------
        // PHYSICS UPDATE  (call once per frame)
        // ------------------------------------------------------------------

        function update() {
            if (!gameRef) return;
            const { ROWS, COLS, board } = gameRef;

            bouncingPieces = bouncingPieces.filter(piece => {
                piece.vy += piece.gravity;
                piece.y += piece.vy;
                piece.x += piece.vx;
                piece.rotation += piece.rotationSpeed;

                // Horizontal wall bounce
                let minX = Infinity, maxX = -Infinity;
                piece.shape.forEach((row, sy) => {
                    row.forEach((v, sx) => {
                        if (v) {
                            const bx = piece.x + sx;
                            if (bx < minX) minX = bx;
                            if (bx > maxX) maxX = bx;
                        }
                    });
                });

                if (minX < 0) {
                    piece.x -= minX;
                    piece.vx = Math.abs(piece.vx) * 0.5;
                } else if (maxX >= COLS) {
                    piece.x -= (maxX - COLS + 1);
                    piece.vx = -Math.abs(piece.vx) * 0.5;
                }

                // Collision when falling
                if (piece.vy > 0) {
                    if (_checkCollision(piece)) {
                        piece.y = Math.floor(piece.y);
                        piece.x = Math.round(piece.x);
                        piece.bounceCount++;

                        if (piece.bounceCount >= piece.maxBounces) {
                            if (_isValidPosition(piece)) {
                                _merge(piece);
                            } else if (!_findValidLanding(piece)) {
                                console.log('⚠️ Bounce piece could not find valid landing - removing');
                            }
                            return false;
                        } else {
                            piece.vy = -0.8;
                            piece.vx = (Math.random() - 0.5) * 0.1;
                            piece.rotationSpeed = (Math.random() - 0.5) * 3;
                            gameRef.playSoundEffect('drop');
                        }
                    }
                }

                return piece.y <= ROWS + 5;
            });
        }

        // ------------------------------------------------------------------
        // DRAW  (call once per frame after update)
        // ------------------------------------------------------------------

        function draw() {
            if (!gameRef || bouncingPieces.length === 0) return;
            const ctx = gameRef.getCtx();
            const bs = gameRef.getBlockSize();

            bouncingPieces.forEach(piece => {
                ctx.save();
                const rx = Math.round(piece.x);
                const ry = Math.round(piece.y);
                const sw = piece.shape[0].length;
                const sh = piece.shape.length;
                const cx = rx + sw / 2;
                const cy = ry + sh / 2;

                ctx.translate(cx * bs, cy * bs);
                ctx.rotate(piece.rotation * Math.PI / 180);
                ctx.translate(-cx * bs, -cy * bs);

                const positions = [];
                piece.shape.forEach((row, y) => {
                    row.forEach((v, x) => {
                        if (v) positions.push([rx + x, ry + y]);
                    });
                });

                ctx.globalAlpha = 0.95;
                gameRef.drawSolidShape(ctx, positions, piece.color, bs, false, gameRef.getFaceOpacity());
                ctx.restore();
            });
        }

        // ------------------------------------------------------------------
        // INTERNAL HELPERS
        // ------------------------------------------------------------------

        function _analyzeLandingSurface(piece) {
            const { ROWS, COLS, board } = gameRef;
            const analysis = { totalSupportBlocks: 0, overhangLeft: 0, overhangRight: 0, supportingColors: new Set() };
            const positions = [];
            let minX = Infinity, maxX = -Infinity;

            piece.shape.forEach((row, y) => {
                row.forEach((v, x) => {
                    if (v) {
                        const bx = piece.x + x, by = piece.y + y;
                        positions.push({ x: bx, y: by });
                        if (bx < minX) minX = bx;
                        if (bx > maxX) maxX = bx;
                    }
                });
            });

            const supportMap = new Map();
            for (let x = minX; x <= maxX; x++) supportMap.set(x, false);

            positions.forEach(pos => {
                const below = pos.y + 1;
                if (below >= ROWS) {
                    supportMap.set(pos.x, true);
                    analysis.totalSupportBlocks++;
                } else if (below >= 0 && pos.x >= 0 && pos.x < COLS && board[below][pos.x]) {
                    supportMap.set(pos.x, true);
                    analysis.totalSupportBlocks++;
                    analysis.supportingColors.add(board[below][pos.x]);
                    const blob = _floodFill(pos.x, below, board[below][pos.x]);
                    analysis.totalSupportBlocks += Math.floor(blob.size / 2);
                }
            });

            for (let x = minX; x <= maxX; x++) {
                if (positions.some(p => p.x === x) && !supportMap.get(x)) {
                    if (x < (minX + maxX) / 2) analysis.overhangLeft++;
                    else analysis.overhangRight++;
                }
            }
            analysis.totalSupportBlocks = Math.max(1, analysis.totalSupportBlocks);
            return analysis;
        }

        function _floodFill(sx, sy, color) {
            const { ROWS, COLS, board } = gameRef;
            const visited = new Set();
            const stack = [[sx, sy]];
            while (stack.length > 0) {
                const [x, y] = stack.pop();
                const key = `${x},${y}`;
                if (visited.has(key)) continue;
                if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
                if (board[y][x] !== color) continue;
                visited.add(key);
                stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
            }
            return visited;
        }

        function _checkCollision(piece) {
            const { ROWS, COLS, board } = gameRef;
            for (let y = 0; y < piece.shape.length; y++) {
                for (let x = 0; x < piece.shape[y].length; x++) {
                    if (!piece.shape[y][x]) continue;
                    const by = Math.floor(piece.y + y);
                    const bx = Math.floor(piece.x + x);
                    if (by >= ROWS - 1) return true;
                    if (by >= -1 && by < ROWS - 1 && bx >= 0 && bx < COLS && by + 1 >= 0 && by + 1 < ROWS && board[by + 1][bx]) return true;
                }
            }
            return false;
        }

        function _isValidPosition(piece) {
            const { ROWS, COLS, board } = gameRef;
            for (let y = 0; y < piece.shape.length; y++) {
                for (let x = 0; x < piece.shape[y].length; x++) {
                    if (!piece.shape[y][x]) continue;
                    const by = Math.floor(piece.y + y);
                    const bx = Math.floor(piece.x + x);
                    if (bx < 0 || bx >= COLS || by >= ROWS) return false;
                    if (by >= 0 && board[by][bx]) return false;
                }
            }
            return true;
        }

        function _findValidLanding(piece) {
            const { COLS } = gameRef;
            const origX = piece.x, origY = piece.y;

            while (piece.y < gameRef.ROWS && !_checkCollision(piece)) piece.y += 0.5;
            if (piece.y > origY) piece.y = Math.floor(piece.y);

            for (let off = 0; off <= 2; off++) {
                for (const dir of [1, -1]) {
                    if (off === 0 && dir === -1) continue;
                    piece.x = origX + off * dir;

                    let mn = Infinity, mx = -Infinity;
                    piece.shape.forEach((row, sy) => row.forEach((v, sx) => {
                        if (v) { const bx = piece.x + sx; if (bx < mn) mn = bx; if (bx > mx) mx = bx; }
                    }));

                    if (mn >= 0 && mx < COLS && _isValidPosition(piece)) {
                        _merge(piece);
                        return true;
                    }
                }
            }
            piece.x = origX;
            piece.y = origY;
            return false;
        }

        function _merge(piece) {
            const { ROWS, COLS, board, isRandomBlock } = gameRef;
            let shape = piece.shape;
            let fx = Math.round(piece.x), fy = Math.round(piece.y);

            if (fx < 0) fx = 0;
            if (fx + shape[0].length > COLS) fx = COLS - shape[0].length;

            // Search for valid Y
            let validY = fy, found = false;
            for (let dist = 0; dist < 10; dist++) {
                for (const candidate of dist === 0 ? [fy] : [fy - dist, fy + dist]) {
                    let ok = true;
                    for (let y = 0; y < shape.length && ok; y++) {
                        for (let x = 0; x < shape[y].length && ok; x++) {
                            if (!shape[y][x]) continue;
                            const bx = fx + x, by = candidate + y;
                            if (bx < 0 || bx >= COLS || by < 0 || by >= ROWS || board[by][bx]) ok = false;
                        }
                    }
                    if (ok) { validY = candidate; found = true; break; }
                }
                if (found) break;
            }

            if (!found) {
                console.log('⚠️ No valid position found, placing at top of well');
                validY = 0;
                for (let y = 0; y < shape.length; y++) {
                    for (let x = 0; x < shape[y].length; x++) {
                        if (shape[y][x]) {
                            const bx = fx + x, by = validY + y;
                            if (bx >= 0 && bx < COLS && by >= 0 && by < ROWS && board[by][bx]) board[by][bx] = null;
                        }
                    }
                }
            }
            fy = validY;

            let placed = 0;
            for (let y = 0; y < shape.length; y++) {
                for (let x = 0; x < shape[y].length; x++) {
                    if (shape[y][x]) {
                        const bx = fx + x, by = fy + y;
                        if (bx >= 0 && bx < COLS && by >= 0 && by < ROWS) {
                            board[by][bx] = piece.color;
                            isRandomBlock[by][bx] = false;
                            placed++;
                        }
                    }
                }
            }
            console.log(`🎯 Bouncing piece merged (${placed} blocks)`);

            // Yes, And… limb after bounce
            if (gameRef.isYesAndActive()) {
                gameRef.spawnYesAndLimbs({ shape, x: fx, y: fy, color: piece.color });
            }

            gameRef.applyGravity();
        }

        return { init, reset, count, triggerBounce, update, draw };
    })();

    window.ChallengeEffects = window.ChallengeEffects || {};
    window.ChallengeEffects.Rubber = Rubber;
})();
