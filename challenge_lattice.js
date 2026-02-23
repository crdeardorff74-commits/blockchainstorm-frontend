/**
 * challenge_lattice.js - Lattice challenge for TANTЯO
 * 
 * Pre-fills the bottom half of the board with random scattered blocks
 * at game start. Lattice blocks are rendered with silver edges and are
 * immune to gravity until absorbed into a player-placed blob.
 * 
 * The module owns the isLatticeBlock grid. After calling init(), retrieve
 * the grid via .grid and assign it to your local reference so existing
 * board-level code can access it directly.
 * 
 * Exports: window.ChallengeEffects.Lattice
 */

(function() {
    'use strict';

    const Lattice = (() => {
        let grid = [];   // 2D boolean grid: true = lattice block
        let rows = 0;
        let cols = 0;

        /**
         * Initialize / reset the lattice grid.
         * Call at each game start before fillBoard().
         */
        function init(numRows, numCols) {
            rows = numRows;
            cols = numCols;
            grid = Array.from({ length: rows }, () => Array(numCols).fill(false));
        }

        /**
         * Pre-fill the bottom half of the board with random lattice blocks.
         * 
         * @param {Array}    board        - The game board (2D color grid)
         * @param {Array}    isRandomBlock - Gremlin-placed block tracker grid
         * @param {Function} randomColor  - Returns a random block color
         */
        function fillBoard(board, isRandomBlock, randomColor) {
            const halfRows = Math.floor(rows / 2);

            for (let y = halfRows; y < rows; y++) {
                const blocksThisLine = Math.floor(Math.random() * 3) + 3; // 3-5 blocks
                const positions = [];

                while (positions.length < blocksThisLine) {
                    const x = Math.floor(Math.random() * cols);
                    if (!positions.includes(x)) {
                        positions.push(x);
                    }
                }

                positions.forEach(x => {
                    board[y][x] = randomColor();
                    isRandomBlock[y][x] = false;
                    grid[y][x] = true;
                });
            }

            Logger.info('⚠️ LATTICE MODE ACTIVE - Filled bottom half with blocks!');
        }

        /**
         * Mark a cell as not-lattice (e.g. when player places a block,
         * or when a row is cleared / gravity moves blocks).
         */
        function clearCell(x, y) {
            if (y >= 0 && y < rows && x >= 0 && x < cols) {
                grid[y][x] = false;
            }
        }

        /**
         * Check whether a cell is a lattice block.
         */
        function isLattice(x, y) {
            return y >= 0 && y < rows && x >= 0 && x < cols && grid[y] && grid[y][x];
        }

        /**
         * Direct access to the grid array.
         * Assign to a local variable for use in tight render loops:
         *   isLatticeBlock = ChallengeEffects.Lattice.grid;
         */
        return {
            init,
            fillBoard,
            clearCell,
            isLattice,
            get grid() { return grid; }
        };
    })();

    window.ChallengeEffects = window.ChallengeEffects || {};
    window.ChallengeEffects.Lattice = Lattice;

})();
