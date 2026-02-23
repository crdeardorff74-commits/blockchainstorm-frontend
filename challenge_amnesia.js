/**
 * challenge_amnesia.js - Amnesia challenge for TANTЯO
 * 
 * Block colors slowly fade to white after placement, hiding their true color.
 * The underlying board color is never modified — blobs, scoring, and special
 * formations all work normally. The oldest cell in each blob determines fade
 * level, so new pieces joining an old blob instantly inherit its fade.
 * 
 * Exports: window.ChallengeEffects.Amnesia
 */

(function() {
    'use strict';

    // ========================================================================
    // AMNESIA CHALLENGE
    // Blocks maintain their real color for scoring/blob logic, but visually
    // fade toward white over time. Per-cell placement timestamps track age;
    // at render time the OLDEST cell in each blob determines the entire blob's
    // fade level, so new blocks joining an old blob instantly inherit its fade.
    // ========================================================================

    const Amnesia = (() => {
        // Configuration
        const FADE_DURATION_MS = 45000;  // 45 seconds to reach full white
        const MAX_BLEND = 0.93;          // Slight hint of original color remains

        // State: 2D grid of timestamps (null = no block or not yet stamped)
        let stampGrid = [];
        let rows = 0;
        let cols = 0;

        // Color blending cache (avoid re-parsing same color every frame)
        const colorCache = new Map();
        const MAX_CACHE = 200;

        /**
         * Parse a CSS color string to [r, g, b]
         */
        function parseColor(color) {
            if (colorCache.has(color)) return colorCache.get(color);

            let r = 0, g = 0, b = 0;

            if (color.startsWith('#')) {
                const hex = color.slice(1);
                if (hex.length === 3) {
                    r = parseInt(hex[0] + hex[0], 16);
                    g = parseInt(hex[1] + hex[1], 16);
                    b = parseInt(hex[2] + hex[2], 16);
                } else if (hex.length === 6) {
                    r = parseInt(hex.slice(0, 2), 16);
                    g = parseInt(hex.slice(2, 4), 16);
                    b = parseInt(hex.slice(4, 6), 16);
                }
            } else if (color.startsWith('rgb')) {
                const match = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
                if (match) {
                    r = parseInt(match[1]);
                    g = parseInt(match[2]);
                    b = parseInt(match[3]);
                }
            }

            const result = [r, g, b];
            if (colorCache.size > MAX_CACHE) colorCache.clear();
            colorCache.set(color, result);
            return result;
        }

        /**
         * Blend a color toward white by a given amount (0 = original, 1 = white)
         */
        function blendToWhite(color, amount) {
            if (amount <= 0.001) return color;
            const [r, g, b] = parseColor(color);
            const nr = Math.round(r + (255 - r) * amount);
            const ng = Math.round(g + (255 - g) * amount);
            const nb = Math.round(b + (255 - b) * amount);
            return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
        }

        /**
         * Initialize or reset the timestamp grid
         */
        function init(numRows, numCols) {
            rows = numRows;
            cols = numCols;
            stampGrid = Array.from({ length: rows }, () => Array(numCols).fill(null));
        }

        /**
         * Stamp a cell with the current time (called when a piece is placed)
         */
        function stampCell(x, y) {
            if (y >= 0 && y < rows && x >= 0 && x < cols) {
                stampGrid[y][x] = Date.now();
            }
        }

        /**
         * Clear timestamps for a row (called when rows are cleared)
         */
        function onRowCleared(row) {
            if (row >= 0 && row < rows) {
                for (let x = 0; x < cols; x++) {
                    stampGrid[row][x] = null;
                }
            }
        }

        /**
         * Clear a specific cell's timestamp
         */
        function clearCell(x, y) {
            if (y >= 0 && y < rows && x >= 0 && x < cols) {
                stampGrid[y][x] = null;
            }
        }

        /**
         * Get the display color for an entire blob, faded based on its oldest cell.
         * Any cell on the board that has no timestamp gets lazy-stamped here.
         * 
         * @param {string} originalColor - The blob's true color
         * @param {Array} positions - Array of [x, y] positions in the blob
         * @returns {string} The color blended toward white
         */
        function getBlobDisplayColor(originalColor, positions) {
            const now = Date.now();
            let oldestStamp = now;

            for (let i = 0; i < positions.length; i++) {
                const [x, y] = positions[i];
                if (y < 0 || y >= rows || x < 0 || x >= cols) continue;

                // Lazy stamp: if block exists but has no timestamp, stamp it now
                if (stampGrid[y][x] === null) {
                    stampGrid[y][x] = now;
                }

                if (stampGrid[y][x] < oldestStamp) {
                    oldestStamp = stampGrid[y][x];
                }
            }

            const age = now - oldestStamp;
            if (age <= 0) return originalColor;

            const progress = Math.min(age / FADE_DURATION_MS, 1.0);
            // Ease-in curve: fade starts slowly, accelerates
            const blend = progress * progress * MAX_BLEND;

            return blendToWhite(originalColor, blend);
        }

        /**
         * Get the raw timestamp grid (for gravity save/restore)
         */
        function getStampGrid() {
            return stampGrid;
        }

        /**
         * Restore a single cell's timestamp (after gravity)
         */
        function restoreCell(x, y, stamp) {
            if (y >= 0 && y < rows && x >= 0 && x < cols) {
                stampGrid[y][x] = stamp;
            }
        }

        return {
            init,
            stampCell,
            onRowCleared,
            clearCell,
            getBlobDisplayColor,
            blendToWhite,
            getStampGrid,
            restoreCell,
            FADE_DURATION_MS,
            MAX_BLEND
        };
    })();

    // ========================================================================
    // PUBLIC API — additive to allow multiple challenge modules
    // ========================================================================

    window.ChallengeEffects = window.ChallengeEffects || {};
    window.ChallengeEffects.Amnesia = Amnesia;

})();
