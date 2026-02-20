/**
 * challenge_mercurial.js - Mercurial challenge for TaNTЯiS
 * 
 * The falling piece randomly changes color every 2-4 seconds while active.
 * A subtle sound plays on each color shift. Timer resets on each new piece.
 * 
 * Exports: window.ChallengeEffects.Mercurial
 */

(function() {
    'use strict';

    const Mercurial = (() => {
        let timer = 0;        // ms since last color change
        let interval = 0;     // ms until next change (2000-4000)

        // Game state interface — set via init()
        let gameRef = null;

        /**
         * Initialize with game state reference.
         * 
         * gameState shape:
         *   randomColor()   - returns a random color from the current set
         *   playRotateSound() - plays the subtle shift sound
         */
        function init(gameState) {
            gameRef = gameState;
            reset();
        }

        /**
         * Reset timer (new game, new piece, mode change).
         */
        function reset() {
            timer = 0;
            interval = 2000 + Math.random() * 2000;
        }

        /**
         * Tick the timer. Call once per frame with deltaTime in ms.
         * Returns a new color string if a shift occurs, null otherwise.
         */
        function update(deltaTime) {
            if (!gameRef) return null;

            timer += deltaTime;
            if (timer >= interval) {
                const newColor = gameRef.randomColor();
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
