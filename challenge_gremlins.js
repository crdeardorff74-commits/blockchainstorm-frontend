/**
 * challenge_gremlins.js - Gremlins challenge for BLOCKCHaiNSTORM / TaNTRiS
 * 
 * After every 1-3 lines cleared, a gremlin either adds a random block
 * above the stack or removes one from it (50/50 chance). Removed blocks
 * fade out with a sound effect before triggering gravity.
 * 
 * Gremlin-placed blocks render with silver edges (handled by drawSolidShape
 * in game.js via the isRandomBlock grid).
 * 
 * Exports: window.ChallengeEffects.Gremlins
 */

(function() {
    'use strict';

    const Gremlins = (() => {
        // State
        let counter = 0;          // Lines cleared since last gremlin event
        let nextTarget = 0;       // Lines needed to trigger next event
        let fadingBlocks = [];    // [{x, y, opacity, delay, color, pending}]

        // Game state interface — set via init()
        let gameRef = null;

        /**
         * Initialize with a reference object providing access to game state.
         * Call once at game start and on reset.
         * 
         * gameState shape:
         *   board        - 2D array [y][x]
         *   isRandomBlock - 2D array [y][x] tracking gremlin-placed blocks
         *   fadingBlocks  - 2D array [y][x] for grow-in animation
         *   ROWS, COLS   - board dimensions
         *   skillLevel    - current skill level string (for tsunami check)
         *   randomColor() - returns a random color from current set
         *   applyGravity() - triggers gravity after block removal
         *   audioContext  - Web Audio context
         *   soundEnabled() - returns whether sound is on
         *   recorder      - { isActive(), recordGremlinBlock(x,y,color), recordChallengeEvent(type,data) }
         */
        function init(gameState) {
            gameRef = gameState;
            reset();
        }

        /**
         * Reset gremlin state (new game, mode change, etc.)
         */
        function reset() {
            counter = 0;
            nextTarget = 1 + Math.random() * 2; // 1-3 lines
            fadingBlocks = [];
        }

        /**
         * Add lines to the gremlin counter.
         * Returns true if a gremlin event should trigger.
         */
        function addLines(count) {
            counter += count;
            return counter >= nextTarget;
        }

        /**
         * Trigger a gremlin event if enough lines have been cleared.
         * Checks counter internally; does nothing if not enough lines yet.
         */
        function trigger() {
            if (counter < nextTarget) return;
            if (Math.random() < 0.5) {
                createBlock();
            } else {
                scheduleRemoval();
            }
            counter = 0;
            nextTarget = 1 + Math.random() * 2;
        }

        /**
         * Place a random block in or near the stack.
         * Rules:
         *   - Up to 2 rows above the highest player-placed block (gremlins don't count)
         *   - Can fill empty spaces within the stack
         *   - Never completes a row, tsunami, black hole, or volcano
         */
        function createBlock() {
            if (!gameRef) return;
            const { board, isRandomBlock: isRandom, fadingBlocks: fadingGrid, ROWS, COLS } = gameRef;

            // Find topmost player-placed block (gremlin blocks excluded)
            let topPlayerRow = ROWS; // below board = no player blocks
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    if (board[y][x] && !isRandom[y][x]) {
                        topPlayerRow = y;
                        break;
                    }
                }
                if (topPlayerRow < ROWS) break;
            }

            if (topPlayerRow >= ROWS) return; // No player blocks on board

            // Valid range: up to 2 rows above topmost player block, down to bottom
            const minY = Math.max(0, topPlayerRow - 2);
            const maxY = ROWS - 1;

            // Build list of all empty candidate positions
            const candidates = [];
            for (let y = minY; y <= maxY; y++) {
                for (let x = 0; x < COLS; x++) {
                    if (!board[y][x]) {
                        candidates.push([x, y]);
                    }
                }
            }

            if (candidates.length === 0) return;

            // Shuffle candidates (Fisher-Yates)
            for (let i = candidates.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
            }

            // Pick a color first so validation is accurate
            const color = gameRef.randomColor();

            // Find first candidate that doesn't trigger a special formation
            for (const [x, y] of candidates) {
                if (wouldTriggerSpecial(x, y, color)) continue;

                board[y][x] = color;
                isRandom[y][x] = true;
                fadingGrid[y][x] = { opacity: 0.01, scale: 0.15 };

                const rec = gameRef.recorder;
                if (rec && rec.isActive()) {
                    rec.recordGremlinBlock(x, y, color);
                }
                return;
            }

            // All candidates would trigger specials — skip this gremlin event
        }

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
                if (enveloped(myBlob,mySet,nSet,ROWS,COLS) || enveloped(nBlob,nSet,mySet,ROWS,COLS)) {
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
                    if (volcanoEnveloped(myBlob,mySet,nSet,ROWS,COLS,tB,tL,tR)) {
                        board[y][x] = oldVal; return true;
                    }
                }
            }

            board[y][x] = oldVal;
            return false;
        }

        /** All 8-neighbors of inner are either inner or outer */
        function enveloped(inner, innerSet, outerSet, ROWS, COLS) {
            for (const [x,y] of inner) {
                for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
                    const nx=x+dx, ny=y+dy, key=`${nx},${ny}`;
                    if (nx<0||nx>=COLS||ny<0||ny>=ROWS) return false;
                    if (!innerSet.has(key) && !outerSet.has(key)) return false;
                }
            }
            return true;
        }

        /** Like enveloped but touched edges are exempt */
        function volcanoEnveloped(inner, innerSet, outerSet, ROWS, COLS, bot, lft, rgt) {
            for (const [x,y] of inner) {
                for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
                    const nx=x+dx, ny=y+dy, key=`${nx},${ny}`;
                    if (ny>=ROWS&&bot) continue;
                    if (nx<0&&lft) continue;
                    if (nx>=COLS&&rgt) continue;
                    if (nx<0||nx>=COLS||ny<0||ny>=ROWS) return false;
                    if (!innerSet.has(key) && !outerSet.has(key)) return false;
                }
            }
            return true;
        }

        /**
         * Schedule a gremlin attack (block removal after a delay).
         */
        function scheduleRemoval() {
            const delayFrames = Math.floor(60 + Math.random() * 60); // 1-2 seconds
            fadingBlocks.push({
                x: -1,
                y: -1,
                opacity: 1.0,
                delay: delayFrames,
                color: null,
                pending: true
            });
        }

        /**
         * Update all fading gremlin blocks. Call once per frame.
         */
        function update() {
            if (!gameRef) return;
            const { board, isRandomBlock: isRandom, fadingBlocks: fadingGrid, ROWS, COLS } = gameRef;

            for (let i = fadingBlocks.length - 1; i >= 0; i--) {
                const gremlin = fadingBlocks[i];

                // Handle delay countdown
                if (gremlin.delay > 0) {
                    gremlin.delay--;
                    if (gremlin.delay === 0 && gremlin.pending) {
                        // Find all filled positions NOW
                        const filled = [];
                        for (let y = 0; y < ROWS; y++) {
                            for (let x = 0; x < COLS; x++) {
                                if (board[y][x]) filled.push([x, y]);
                            }
                        }

                        if (filled.length === 0) {
                            fadingBlocks.splice(i, 1);
                            continue;
                        }

                        const [x, y] = filled[Math.floor(Math.random() * filled.length)];
                        gremlin.x = x;
                        gremlin.y = y;
                        gremlin.color = board[y][x];
                        gremlin.pending = false;

                        const rec = gameRef.recorder;
                        if (rec && rec.isActive()) {
                            rec.recordChallengeEvent('gremlin', { x, y, color: gremlin.color });
                        }

                        playGiggle();
                    }
                    continue;
                }

                if (gremlin.pending) {
                    fadingBlocks.splice(i, 1);
                    continue;
                }

                // Fade out (~60 frames / 1 second)
                gremlin.opacity -= 0.017;

                if (gremlin.opacity <= 0) {
                    board[gremlin.y][gremlin.x] = null;
                    isRandom[gremlin.y][gremlin.x] = false;
                    fadingGrid[gremlin.y][gremlin.x] = null;
                    fadingBlocks.splice(i, 1);
                    gameRef.applyGravity();
                }
            }
        }

        /**
         * Play the gremlin giggle sound effect.
         */
        function playGiggle() {
            if (!gameRef || !gameRef.soundEnabled()) return;
            const ctx = gameRef.audioContext;
            if (!ctx) return;

            // First giggle note - ascending
            setTimeout(() => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
                osc.type = 'square';
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.08);
            }, 0);

            // Second note - higher
            setTimeout(() => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(1000, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.08);
                osc.type = 'square';
                gain.gain.setValueAtTime(0.18, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.08);
            }, 90);

            // Third note - descending
            setTimeout(() => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(1300, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.10);
                osc.type = 'square';
                gain.gain.setValueAtTime(0.16, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.10);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.10);
            }, 180);
        }

        /**
         * Get the fading blocks array (for rendering in drawBoard).
         */
        function getFadingBlocks() {
            return fadingBlocks;
        }

        /**
         * Check if a cell is being faded by a gremlin.
         * Returns the gremlin entry if found, null otherwise.
         */
        function getFadingAt(x, y) {
            return fadingBlocks.find(g => g.x === x && g.y === y) || null;
        }

        return {
            init,
            reset,
            addLines,
            trigger,
            update,
            getFadingBlocks,
            getFadingAt,
            playGiggle
        };
    })();

    window.ChallengeEffects = window.ChallengeEffects || {};
    window.ChallengeEffects.Gremlins = Gremlins;

})();
