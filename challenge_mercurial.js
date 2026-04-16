/**
 * challenge_mercurial.js - Mercurial challenge for TANTЯO
 *
 * The falling piece randomly changes color every 2-4 seconds while active.
 * Color cycling is limited to half the available colors for the level,
 * always including the piece's original color. This prevents players from
 * exploiting rapid cycling to cherry-pick colors for Tsunamis.
 * A subtle sound plays on each color shift. Timer resets on each new piece.
 *
 * Exports: window.ChallengeEffects.Mercurial
 */

(function() {
    'use strict';

    const Mercurial = (() => {
        let timer = 0;        // ms since last color change
        let interval = 0;     // ms until next change (2000-4000)
        let colorPool = null; // limited subset of colors for this piece

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
         * Reset timer (new game, new piece, mode change).
         * pieceColor: the current piece's color so we can build the pool.
         */
        function reset(pieceColor) {
            timer = 0;
            interval = 2000 + Math.random() * 2000;
            if (gameRef && pieceColor) {
                colorPool = buildColorPool(pieceColor);
            } else {
                colorPool = null;
            }
        }

        /**
         * Pick a random color from this piece's limited pool.
         */
        function poolRandomColor() {
            if (colorPool && colorPool.length > 0) {
                return colorPool[Math.floor(Math.random() * colorPool.length)];
            }
            // Fallback to full set if pool wasn't built
            return gameRef.randomColor();
        }

        /**
         * Tick the timer. Call once per frame with deltaTime in ms.
         * Returns a new color string if a shift occurs, null otherwise.
         */
        function update(deltaTime) {
            if (!gameRef) return null;

            timer += deltaTime;
            if (timer >= interval) {
                const newColor = poolRandomColor();
                interval = 2000 + Math.random() * 2000;
                timer = 0;
                gameRef.playRotateSound();

                // Record for replay
                if (gameRef.recorder && gameRef.recorder.isActive()) {
                    gameRef.recorder.recordChallengeEvent('mercurial_color', { color: newColor });
                }

                return newColor;
            }
            return null;
        }

        return {
            init,
            reset,
            update
        };
    })();

    window.ChallengeEffects = window.ChallengeEffects || {};
    window.ChallengeEffects.Mercurial = Mercurial;

})();
