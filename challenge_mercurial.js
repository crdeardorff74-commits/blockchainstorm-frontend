/**
 * challenge_mercurial.js - Mercurial challenge for TANTЯO
 *
 * Each time the piece drops a row, there is a chance it changes color.
 * The base probability is ~10% per row, so at slow speeds changes are
 * infrequent, while at high speeds (many rows/sec) they happen more often.
 *
 * Color cycling is limited to half the available colors for the level,
 * always including the piece's original color. This prevents players from
 * exploiting cycling to cherry-pick colors for Tsunamis.
 *
 * A subtle sound plays on each color shift. Pool resets on each new piece.
 *
 * Exports: window.ChallengeEffects.Mercurial
 */

(function() {
    'use strict';

    const Mercurial = (() => {
        const CHANGE_CHANCE = 0.10; // 10% chance per row drop
        let colorPool = null;       // limited subset of colors for this piece

        // Game state interface — set via init()
        let gameRef = null;

        /**
         * Initialize with game state reference.
         *
         * gameState shape:
         *   randomColor()       - returns a random color from the current set
         *   getColorSet()       - returns the current level's full color array
         *   playRotateSound()   - plays the subtle shift sound
         */
        function init(gameState) {
            gameRef = gameState;
            reset();
        }

        /**
         * Build a limited color pool: half the level's colors (min 2),
         * always including the piece's current color.
         */
        function buildColorPool(pieceColor) {
            const fullSet = gameRef.getColorSet();
            const poolSize = Math.max(2, Math.floor(fullSet.length / 2));

            // Start with the piece's own color
            const pool = [pieceColor];

            // Fill remaining slots with random picks from the rest
            const others = fullSet.filter(c => c !== pieceColor);
            for (let i = others.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [others[i], others[j]] = [others[j], others[i]];
            }
            for (let i = 0; i < poolSize - 1 && i < others.length; i++) {
                pool.push(others[i]);
            }

            return pool;
        }

        /**
         * Reset for new piece / new game / mode change.
         * pieceColor: the current piece's color so we can build the pool.
         */
        function reset(pieceColor) {
            if (gameRef && pieceColor) {
                colorPool = buildColorPool(pieceColor);
            } else {
                colorPool = null;
            }
        }

        /**
         * Pick a random color from this piece's limited pool,
         * excluding the given color so every change is visible.
         */
        function poolRandomColor(excludeColor) {
            let candidates = colorPool && colorPool.length > 1
                ? colorPool.filter(c => c !== excludeColor)
                : colorPool;
            if (candidates && candidates.length > 0) {
                return candidates[Math.floor(Math.random() * candidates.length)];
            }
            // Fallback to full set if pool wasn't built
            return gameRef.randomColor();
        }

        /**
         * Called each time the piece drops one row.
         * Rolls a probability check; returns a new color string on
         * success, null otherwise. currentColor is the piece's current
         * color so we always pick a different one.
         */
        function onRowDrop(currentColor) {
            if (!gameRef) return null;

            if (Math.random() < CHANGE_CHANCE) {
                const newColor = poolRandomColor(currentColor);
                gameRef.playRotateSound();

                // Record for replay
                if (gameRef.recorder && gameRef.recorder.isActive()) {
                    gameRef.recorder.recordChallengeEvent('mercurial_color', { color: newColor });
                }

                return newColor;
            }
            return null;
        }

        /**
         * Legacy update() — no longer used for timing, kept as no-op
         * so existing call sites don't error.
         */
        function update() {
            return null;
        }

        return {
            init,
            reset,
            update,
            onRowDrop
        };
    })();

    window.ChallengeEffects = window.ChallengeEffects || {};
    window.ChallengeEffects.Mercurial = Mercurial;

})();
