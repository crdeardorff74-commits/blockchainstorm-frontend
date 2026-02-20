/**
 * challenge_phantom.js - Phantom challenge for TaNTЯiS
 * 
 * The board stack is invisible most of the time. When a piece is placed,
 * the stack flashes fully visible then quickly fades back to invisible.
 * The AI still has full board state — only the human is affected.
 * 
 * Exports: window.ChallengeEffects.Phantom
 */

(function() {
    'use strict';

    const Phantom = (() => {
        let opacity = 1.0;
        let fadeInterval = null;
        let fadeGeneration = 0; // Prevents stale setTimeout callbacks

        /** Reset to fully visible (new game, mode change). */
        function reset() {
            fadeGeneration++;
            if (fadeInterval) {
                clearInterval(fadeInterval);
                fadeInterval = null;
            }
            opacity = 1.0;
        }

        /**
         * Flash the stack visible then fade it out over 500ms.
         * Called when a piece is merged into the board.
         */
        function triggerFade() {
            fadeGeneration++;
            if (fadeInterval) {
                clearInterval(fadeInterval);
                fadeInterval = null;
            }

            opacity = 1.0;
            const gen = fadeGeneration;

            setTimeout(() => {
                if (gen !== fadeGeneration) return; // Stale callback
                const fadeStartTime = Date.now();
                const fadeDuration = 500;

                fadeInterval = setInterval(() => {
                    const elapsed = Date.now() - fadeStartTime;
                    const progress = Math.min(elapsed / fadeDuration, 1);
                    opacity = 1.0 - progress;

                    if (progress >= 1) {
                        clearInterval(fadeInterval);
                        fadeInterval = null;
                        opacity = 0;
                    }
                }, 16);
            }, 10);
        }

        /** Current stack opacity (0 = invisible, 1 = fully visible). */
        function getOpacity() {
            return opacity;
        }

        return { reset, triggerFade, getOpacity };
    })();

    window.ChallengeEffects = window.ChallengeEffects || {};
    window.ChallengeEffects.Phantom = Phantom;

})();
