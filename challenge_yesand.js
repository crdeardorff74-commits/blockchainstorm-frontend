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
                console.log('🎭 Yes, And... found no available spaces for limbs');
                spawnedLimb = false;
                return false;
            }

            // Pick one random adjacent space
            const idx = Math.floor(Math.random() * adjacentSpaces.length);
            const [limbX, limbY] = adjacentSpaces[idx];

            // Place the limb with fade-in animation
            board[limbY][limbX] = targetBlob.color;
            isRandomBlock[limbY][limbX] = false;
            fadingBlocks[limbY][limbX] = { opacity: 0.01, scale: 0.15 };

            gameRef.playSoundEffect('yesand');
            console.log(`🎭 Yes, And... spawned limb at [${limbX}, ${limbY}]`);

            spawnedLimb = true;
            return true;
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
