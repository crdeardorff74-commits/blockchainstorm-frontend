/**
 * challenge_vertigo.js - Vertigo challenge for BLOCKCHaiNSTORM / TaNTRiS
 * 
 * The game board has a persistent slow oscillating tilt, zoom, and sway,
 * like playing on a rocking ship. Multiple sine waves at incommensurate
 * frequencies create organic, non-repeating motion.
 * 
 * Applied to #vertigoWrapper (parent of canvas) so it composes naturally
 * with all canvas-level transforms (nervous, thinner, longago, etc.)
 * without any combinatorial CSS.
 * 
 * Exports: window.ChallengeEffects.Vertigo
 */

(function() {
    'use strict';

    const Vertigo = (() => {
        let animFrameId = null;
        let wrapper = null;
        let startTime = 0;
        let active = false;

        // Oscillation components — incommensurate periods prevent repetition
        const WAVES = [
            // Rotation (degrees) — 3 overlapping waves
            { period: 7000,  amp: 3.0,  phase: 0   },
            { period: 11000, amp: 1.8,  phase: 1.3 },
            { period: 19000, amp: 0.8,  phase: 2.7 },
            // Scale — 2 overlapping waves
            { period: 9000,  amp: 0.06,  phase: 0.5 },
            { period: 15000, amp: 0.03, phase: 1.9 },
            // TranslateX (vw) — 2 overlapping waves
            { period: 13000, amp: 1.5,  phase: 0.8 },
            { period: 21000, amp: 0.8,  phase: 2.1 },
            // TranslateY (vh) — 2 overlapping waves
            { period: 17000, amp: 1.0,  phase: 1.6 },
            { period: 23000, amp: 0.5,  phase: 3.2 },
        ];

        // Ramp-in duration: effect builds over this many ms to avoid jarring start
        const RAMP_IN_MS = 3000;

        function animate() {
            if (!active || !wrapper) return;

            const elapsed = Date.now() - startTime;
            // Smooth ramp from 0-1 over RAMP_IN_MS
            const ramp = Math.min(elapsed / RAMP_IN_MS, 1.0);
            const ease = ramp * ramp * (3 - 2 * ramp); // smoothstep

            const t = elapsed;
            const w = WAVES;

            const rotate = ease * (
                w[0].amp * Math.sin(2 * Math.PI * t / w[0].period + w[0].phase) +
                w[1].amp * Math.sin(2 * Math.PI * t / w[1].period + w[1].phase) +
                w[2].amp * Math.sin(2 * Math.PI * t / w[2].period + w[2].phase)
            );

            const scale = 1.0 + ease * (
                w[3].amp * Math.sin(2 * Math.PI * t / w[3].period + w[3].phase) +
                w[4].amp * Math.sin(2 * Math.PI * t / w[4].period + w[4].phase)
            );

            const tx = ease * (
                w[5].amp * Math.sin(2 * Math.PI * t / w[5].period + w[5].phase) +
                w[6].amp * Math.sin(2 * Math.PI * t / w[6].period + w[6].phase)
            );

            const ty = ease * (
                w[7].amp * Math.sin(2 * Math.PI * t / w[7].period + w[7].phase) +
                w[8].amp * Math.sin(2 * Math.PI * t / w[8].period + w[8].phase)
            );

            wrapper.style.transform =
                'rotate(' + rotate.toFixed(3) + 'deg) scale(' + scale.toFixed(4) + ') translate(' + tx.toFixed(2) + 'vw, ' + ty.toFixed(2) + 'vh)';

            animFrameId = requestAnimationFrame(animate);
        }

        /**
         * Start the vertigo effect
         */
        function start() {
            if (active) return;
            wrapper = document.getElementById('vertigoWrapper');
            if (!wrapper) {
                Logger.warn('Vertigo: #vertigoWrapper not found');
                return;
            }
            active = true;
            startTime = Date.now();
            wrapper.style.transformOrigin = 'center center';
            wrapper.style.willChange = 'transform';
            Logger.info('Vertigo: oscillating tilt activated');
            animFrameId = requestAnimationFrame(animate);
        }

        /**
         * Stop the vertigo effect and reset transform
         */
        function stop() {
            active = false;
            if (animFrameId) {
                cancelAnimationFrame(animFrameId);
                animFrameId = null;
            }
            if (wrapper) {
                wrapper.style.transform = '';
                wrapper.style.willChange = '';
                wrapper.style.transformOrigin = '';
            }
            wrapper = null;
        }

        /**
         * Check if vertigo is currently running
         */
        function isActive() {
            return active;
        }

        return {
            start,
            stop,
            isActive
        };
    })();

    // Additive export
    window.ChallengeEffects = window.ChallengeEffects || {};
    window.ChallengeEffects.Vertigo = Vertigo;

})();
