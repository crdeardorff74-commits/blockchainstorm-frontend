/**
 * challenge_oz.js - Oz challenge for TaNTЯiS
 *
 * Falling pieces are rendered in grayscale, hiding their true color
 * until they land. The board retains real colors — only the active
 * piece and next-piece preview are desaturated. The AI still knows
 * the real color, so this is a visual-only challenge.
 *
 * Exports: window.ChallengeEffects.Oz
 */

(function () {
    'use strict';

    const Oz = (() => {

        /**
         * Convert a hex color to its perceptual-luminance grayscale equivalent.
         * Uses ITU-R BT.601 weights (0.299 R, 0.587 G, 0.114 B).
         *
         * @param {string} color - Hex color string (#RGB or #RRGGBB)
         * @returns {string} Grayscale hex color
         */
        function toGrayscale(color) {
            const hex = color.replace('#', '');
            let r, g, b;

            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else {
                r = parseInt(hex.substring(0, 2), 16);
                g = parseInt(hex.substring(2, 4), 16);
                b = parseInt(hex.substring(4, 6), 16);
            }

            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            const gh = gray.toString(16).padStart(2, '0');
            return `#${gh}${gh}${gh}`;
        }

        return { toGrayscale };
    })();

    window.ChallengeEffects = window.ChallengeEffects || {};
    window.ChallengeEffects.Oz = Oz;
})();
