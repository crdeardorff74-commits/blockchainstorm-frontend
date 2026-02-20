/**
 * challenge_sixseven.js - Six Seven challenge for TaNTЯiS
 * 
 * After every 6 or 7 lines cleared, a giant hexomino (6-block) or
 * heptomino (7-block) piece is injected into the next-piece queue.
 * 
 * Exports: window.ChallengeEffects.SixSeven
 */

(function() {
    'use strict';

    // Hexomino shapes (6 blocks)
    const HEXOMINO_SHAPES = [
        { name: 'I6', shape: [[1,1,1,1,1,1]] },
        { name: 'Rect', shape: [[1,1,1],[1,1,1]] },
        { name: 'L6', shape: [[1,0,0],[1,0,0],[1,0,0],[1,1,1]] },
        { name: 'J6', shape: [[0,0,1],[0,0,1],[0,0,1],[1,1,1]] },
        { name: 'T6', shape: [[1,1,1,1],[0,1,0,0],[0,1,0,0]] },
        { name: 'Plus6', shape: [[0,1,0],[1,1,1],[0,1,0],[0,1,0]] },
        { name: 'Y6', shape: [[0,1],[1,1],[0,1],[0,1],[0,1]] },
        { name: 'P6', shape: [[1,1],[1,1],[1,0],[1,0]] },
        { name: 'S6', shape: [[0,1,1],[0,1,0],[0,1,0],[1,1,0]] },
        { name: 'C6', shape: [[1,1],[1,0],[1,0],[1,1]] },
        { name: 'Z6', shape: [[1,1,0,0],[0,1,0,0],[0,1,1,1]] },
        { name: 'W6', shape: [[1,0,0],[1,1,0],[0,1,1],[0,0,1]] }
    ];

    // Heptomino shapes (7 blocks)
    const HEPTOMINO_SHAPES = [
        { name: 'I7', shape: [[1,1,1,1,1,1,1]] },
        { name: 'L7', shape: [[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,1,1]] },
        { name: 'J7', shape: [[0,0,1],[0,0,1],[0,0,1],[0,0,1],[1,1,1]] },
        { name: 'T7', shape: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0]] },
        { name: 'Plus7', shape: [[0,1,0],[0,1,0],[1,1,1],[0,1,0],[0,1,0]] },
        { name: 'Y7', shape: [[0,1],[0,1],[1,1],[0,1],[0,1],[0,1]] },
        { name: 'U7', shape: [[1,0,1],[1,0,1],[1,1,1]] },
        { name: 'P7', shape: [[1,1],[1,1],[1,0],[1,0],[1,0]] },
        { name: 'S7', shape: [[0,0,1,1],[0,0,1,0],[0,1,1,0],[1,1,0,0]] },
        { name: 'W7', shape: [[1,0,0],[1,1,0],[0,1,0],[0,1,1],[0,0,1]] },
        { name: 'F7', shape: [[0,1,1],[0,1,0],[1,1,0],[0,1,0],[0,1,0]] },
        { name: 'H7', shape: [[1,0,1],[1,1,1],[1,0,1]] }
    ];

    const SixSeven = (() => {
        let counter = 0;      // Lines cleared since last giant piece
        let nextTarget = 0;   // 6 or 7
        let nextSize = 0;     // Size of next giant piece

        let gameRef = null;

        /**
         * Initialize with game state reference.
         * 
         * gameState shape:
         *   COLS          - board width
         *   randomColor() - returns a random color
         */
        function init(gameState) {
            gameRef = gameState;
            reset();
        }

        /** Reset counters (new game, mode change). */
        function reset() {
            counter = 0;
            nextTarget = Math.random() < 0.5 ? 6 : 7;
            nextSize = nextTarget;
        }

        /** Add cleared lines to counter. */
        function addLines(count) {
            counter += count;
        }

        /**
         * Check if a giant piece should spawn. If so, returns the piece object.
         * Returns null if not ready yet.
         */
        function trySpawn() {
            if (!gameRef || counter < nextTarget || nextSize <= 0) return null;

            const piece = createGiantPiece(nextSize);
            counter = 0;
            nextTarget = Math.random() < 0.5 ? 6 : 7;
            nextSize = nextTarget;
            return piece;
        }

        /** Create a giant piece of the given segment count. */
        function createGiantPiece(segmentCount) {
            const color = gameRef.randomColor();
            const shapes = segmentCount === 6 ? HEXOMINO_SHAPES : HEPTOMINO_SHAPES;
            const shapeData = shapes[Math.floor(Math.random() * shapes.length)];
            const pieceHeight = shapeData.shape.length;
            return {
                shape: shapeData.shape,
                type: 'giant' + segmentCount,
                color: color,
                x: Math.floor(gameRef.COLS / 2) - Math.floor(shapeData.shape[0].length / 2),
                y: -pieceHeight
            };
        }

        return { init, reset, addLines, trySpawn };
    })();

    window.ChallengeEffects = window.ChallengeEffects || {};
    window.ChallengeEffects.SixSeven = SixSeven;

})();
