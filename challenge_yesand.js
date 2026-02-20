/**
 * challenge_yesand.js - Yes, And... challenge for BLOCKCHaiNSTORM / TaNTRiS
 * 
 * After each piece lands, a random extra block ("limb") spawns adjacent
 * to the blob the piece joined, extending it in a random direction.
 * A short delay is applied before line-clearing so the player can see
 * the limb appear. The limb fades in with a scale+opacity animation.
 * 
 * Exports: window.ChallengeEffects.YesAnd
 */

(function() {
    'use strict';

    const YesAnd = (() => {
        let spawnedLimb = false;  // True when a limb was spawned this turn
        let gameRef = null;

        /**
         * Initialize with game state reference.
         * 
         * gameState shape:
         *   ROWS, COLS            - board dimensions
         *   board                 - 2D grid of colors (null = empty)
         *   isRandomBlock         - 2D grid tracking gremlin-placed blocks
         *   fadingBlocks          - 2D grid of fade-in animation state
         *   getAllBlobs()          - returns array of { color, positions }
         *   playSoundEffect(name) - plays a named sound effect
         */
        function init(gameState) {
            gameRef = gameState;
            reset();
        }

        /** Reset state (new game, mode change). */
        function reset() {
            spawnedLimb = false;
        }

        /**
         * Whether the last piece placement spawned a limb.
         * When true, line-clearing should be delayed ~400ms.
         */
        function didSpawnLimb() {
            return spawnedLimb;
        }

        /** Clear the spawned-limb flag (call after delayed line check). */
        function clearSpawnFlag() {
            spawnedLimb = false;
        }

        /**
         * Attempt to spawn a limb adjacent to the blob a piece just joined.
         * Call immediately after mergePiece().
         * 
         * @param {Object} piece - The piece that was just placed
         * @returns {boolean} True if a limb was spawned
         */

        /**
         * Check if placing a block at (x, y) with the given color would trigger
         * a row clear, tsunami, black hole, or volcano.
         */
        function wouldTriggerSpecial(x, y, color) {
            const { board, ROWS, COLS, skillLevel } = gameRef;

            // 1. Row completion check
            let filledInRow = 0;
            for (let col = 0; col < COLS; col++) {
                if (col === x || board[y][col] !== null) filledInRow++;
            }
            if (filledInRow >= COLS) return true;

            // 2. Temporarily place for blob analysis
            const oldVal = board[y][x];
            board[y][x] = color;

            function bfs(sx, sy, c) {
                const blob = [];
                const visited = new Set();
                const stack = [[sx, sy]];
                while (stack.length > 0) {
                    const [bx, by] = stack.pop();
                    const key = `${bx},${by}`;
                    if (visited.has(key)) continue;
                    if (bx < 0 || bx >= COLS || by < 0 || by >= ROWS) continue;
                    if (board[by][bx] !== c) continue;
                    visited.add(key);
                    blob.push([bx, by]);
                    stack.push([bx+1,by],[bx-1,by],[bx,by+1],[bx,by-1]);
                }
                return blob;
            }

            function enveloped(inner, innerSet, outerSet) {
                const dirs8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
                for (const [ix, iy] of inner) {
                    for (const [dx, dy] of dirs8) {
                        const nx = ix+dx, ny = iy+dy, key = `${nx},${ny}`;
                        if (nx<0||nx>=COLS||ny<0||ny>=ROWS) return false;
                        if (!innerSet.has(key) && !outerSet.has(key)) return false;
                    }
                }
                return true;
            }

            function volcanoEnveloped(inner, innerSet, outerSet, tB, tL, tR) {
                const dirs8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
                for (const [ix, iy] of inner) {
                    for (const [dx, dy] of dirs8) {
                        const nx = ix+dx, ny = iy+dy, key = `${nx},${ny}`;
                        if (ny>=ROWS&&tB) continue;
                        if (nx<0&&tL) continue;
                        if (nx>=COLS&&tR) continue;
                        if (nx<0||nx>=COLS||ny<0||ny>=ROWS) return false;
                        if (!innerSet.has(key) && !outerSet.has(key)) return false;
                    }
                }
                return true;
            }

            // 3. Tsunami: blob spans full width
            const myBlob = bfs(x, y, color);
            let mnX = COLS, mxX = -1;
            for (const [bx] of myBlob) { if (bx < mnX) mnX = bx; if (bx > mxX) mxX = bx; }
            if (mnX === 0 && mxX === COLS - 1 && skillLevel !== 'breeze') {
                board[y][x] = oldVal; return true;
            }

            // 4. Black hole: check envelopment in both directions
            const mySet = new Set(myBlob.map(p => `${p[0]},${p[1]}`));
            const neighborColors = new Set();
            const dirs8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
            for (const [bx, by] of myBlob) {
                for (const [dx, dy] of dirs8) {
                    const nx = bx+dx, ny = by+dy;
                    if (nx>=0 && nx<COLS && ny>=0 && ny<ROWS && board[ny][nx] !== null && board[ny][nx] !== color)
                        neighborColors.add(board[ny][nx]);
                }
            }

            for (const nc of neighborColors) {
                let sx=-1, sy=-1;
                findSeed: for (const [bx,by] of myBlob) {
                    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                        const nx=bx+dx, ny=by+dy;
                        if (nx>=0&&nx<COLS&&ny>=0&&ny<ROWS&&board[ny][nx]===nc) { sx=nx;sy=ny;break findSeed; }
                    }
                }
                if (sx<0) continue;
                const nBlob = bfs(sx, sy, nc);
                const nSet = new Set(nBlob.map(p=>`${p[0]},${p[1]}`));
                if (enveloped(myBlob,mySet,nSet) || enveloped(nBlob,nSet,mySet)) {
                    board[y][x] = oldVal; return true;
                }
            }

            // 5. Volcano: edge-touching blob enveloped by neighbor
            const tB = myBlob.some(([,by])=>by===ROWS-1);
            const tL = myBlob.some(([bx])=>bx===0);
            const tR = myBlob.some(([bx])=>bx===COLS-1);
            if (tB||tL||tR) {
                for (const nc of neighborColors) {
                    let sx=-1,sy=-1;
                    findSeed2: for (const [bx,by] of myBlob) {
                        for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                            const nx=bx+dx,ny=by+dy;
                            if (nx>=0&&nx<COLS&&ny>=0&&ny<ROWS&&board[ny][nx]===nc) { sx=nx;sy=ny;break findSeed2; }
                        }
                    }
                    if (sx<0) continue;
                    const nBlob = bfs(sx,sy,nc);
                    const nSet = new Set(nBlob.map(p=>`${p[0]},${p[1]}`));
                    if (volcanoEnveloped(myBlob,mySet,nSet,tB,tL,tR)) {
                        board[y][x] = oldVal; return true;
                    }
                }
            }

            board[y][x] = oldVal;
            return false;
        }

        function spawnLimbs(piece) {
            if (!gameRef) return false;

            const { ROWS, COLS, board, isRandomBlock, fadingBlocks } = gameRef;
            const blobs = gameRef.getAllBlobs();
            let targetBlob = null;

            // Find which blob contains any of the piece's blocks
            for (const blob of blobs) {
                const containsPieceBlock = blob.positions.some(([bx, by]) => {
                    return piece.shape.some((row, y) => {
                        return row.some((value, x) => {
                            if (!value) return false;
                            return (piece.x + x) === bx && (piece.y + y) === by;
                        });
                    });
                });

                if (containsPieceBlock) {
                    targetBlob = blob;
                    break;
                }
            }

            if (!targetBlob || targetBlob.positions.length === 0) {
                spawnedLimb = false;
                return false;
            }

            // Collect all empty spaces adjacent to the blob
            const adjacentSpaces = [];
            const checked = new Set();

            for (const [bx, by] of targetBlob.positions) {
                for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
                    const ax = bx + dx;
                    const ay = by + dy;
                    const key = `${ax},${ay}`;

                    if (ax >= 0 && ax < COLS &&
                        ay >= 0 && ay < ROWS &&
                        board[ay][ax] === null &&
                        !checked.has(key)) {
                        adjacentSpaces.push([ax, ay]);
                        checked.add(key);
                    }
                }
            }

            if (adjacentSpaces.length === 0) {
                Logger.info('🎭 Yes, And... found no available spaces for limbs');
                spawnedLimb = false;
                return false;
            }

            // Shuffle candidates (Fisher-Yates)
            for (let i = adjacentSpaces.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [adjacentSpaces[i], adjacentSpaces[j]] = [adjacentSpaces[j], adjacentSpaces[i]];
            }

            // Find first candidate that won't trigger a special formation
            const color = targetBlob.color;
            for (const [limbX, limbY] of adjacentSpaces) {
                if (wouldTriggerSpecial(limbX, limbY, color)) continue;

                // Place the limb with fade-in animation
                board[limbY][limbX] = color;
                isRandomBlock[limbY][limbX] = false;
                fadingBlocks[limbY][limbX] = { opacity: 0.01, scale: 0.15 };

                // Record for replay
                const rec = gameRef.recorder;
                if (rec && rec.isActive()) {
                    rec.recordChallengeEvent('yesand_limb', { x: limbX, y: limbY, color: color });
                }

                gameRef.playSoundEffect('yesand');
                Logger.info(`🎭 Yes, And... spawned limb at [${limbX}, ${limbY}]`);

                spawnedLimb = true;
                return true;
            }

            // All candidates would trigger specials — skip
            Logger.info('🎭 Yes, And... all candidates would trigger specials, skipping');
            spawnedLimb = false;
            return false;
        }

        return {
            init,
            reset,
            didSpawnLimb,
            clearSpawnFlag,
            spawnLimbs
        };
    })();

    window.ChallengeEffects = window.ChallengeEffects || {};
    window.ChallengeEffects.YesAnd = YesAnd;

})();
