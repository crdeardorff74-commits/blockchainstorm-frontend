// render-utils.js - Complete rendering utilities with full beveling implementation

const RenderUtils = {
    adjustBrightness(color, factor) {
    // Parse hex color
    const hex = color.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    
    // Adjust brightness
    r = Math.min(255, Math.max(0, Math.floor(r * factor)));
    g = Math.min(255, Math.max(0, Math.floor(g * factor)));
    b = Math.min(255, Math.max(0, Math.floor(b * factor)));
    
    // Convert back to hex
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    },

    drawSolidShape(ctx, positions, color, blockSize, useGold = false, faceOpacity = 1.0) {
    if (positions.length === 0) return;

    ctx.save();

    const posSet = new Set(positions.map(p => `${p[0]},${p[1]}`));
    const b = Math.floor(blockSize * 0.2);

    // Create edge colors from the base color - just the 5 colors total
    let topColor, leftColor, bottomColor, rightColor;
    
    if (useGold) {
        // Gold edges for spanning blobs
        topColor = '#FFD700';      // Gold
        leftColor = '#FFC700';     // Slightly darker gold
        bottomColor = '#DAA520';   // Goldenrod (darker)
        rightColor = '#B8860B';    // Dark goldenrod
    } else {
        // Create lighter shade for top and left (highlighted edges)
        const lightShade = RenderUtils.adjustBrightness(color, 1.3);
        const mediumLightShade = RenderUtils.adjustBrightness(color, 1.15);
        
        // Create darker shade for bottom and right (shadow edges)
        const darkShade = RenderUtils.adjustBrightness(color, 0.7);
        const mediumDarkShade = RenderUtils.adjustBrightness(color, 0.85);
        
        topColor = lightShade;
        leftColor = mediumLightShade;
        bottomColor = darkShade;
        rightColor = mediumDarkShade;
    }

    positions.forEach(([x, y]) => {
        const px = x * blockSize;
        const py = y * blockSize;

        const T = posSet.has(`${x},${y-1}`);
        const B = posSet.has(`${x},${y+1}`);
        const L = posSet.has(`${x-1},${y}`);
        const R = posSet.has(`${x+1},${y}`);
        const TL = posSet.has(`${x-1},${y-1}`);
        const TR = posSet.has(`${x+1},${y-1}`);
        const BL = posSet.has(`${x-1},${y+1}`);
        const BR = posSet.has(`${x+1},${y+1}`);

        // Draw main face with optional transparency
        const currentAlpha = ctx.globalAlpha;
        ctx.globalAlpha = currentAlpha * faceOpacity;
        ctx.fillStyle = color;
        ctx.fillRect(px, py, blockSize, blockSize);
        ctx.globalAlpha = currentAlpha;

        // Draw edges with gradients for depth
        if (!T) {
            // Top edge - gradient from lighter at top to darker at bottom
            const topGradient = ctx.createLinearGradient(px, py, px, py + b);
            topGradient.addColorStop(0, topColor);
            topGradient.addColorStop(1, RenderUtils.adjustBrightness(topColor, 0.85));
            ctx.fillStyle = topGradient;
            ctx.fillRect(px, py, blockSize, b);
        }
        if (!L) {
            // Left edge - gradient from lighter at left to darker at right
            const leftGradient = ctx.createLinearGradient(px, py, px + b, py);
            leftGradient.addColorStop(0, leftColor);
            leftGradient.addColorStop(1, RenderUtils.adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = leftGradient;
            ctx.fillRect(px, py, b, blockSize);
        }
        if (!B) {
            // Bottom edge - gradient from darker at top to even darker at bottom
            const bottomGradient = ctx.createLinearGradient(px, py + blockSize - b, px, py + blockSize);
            bottomGradient.addColorStop(0, RenderUtils.adjustBrightness(bottomColor, 1.15));
            bottomGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = bottomGradient;
            ctx.fillRect(px, py + blockSize - b, blockSize, b);
        }
        if (!R) {
            // Right edge - gradient from darker at left to even darker at right
            const rightGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize, py);
            rightGradient.addColorStop(0, RenderUtils.adjustBrightness(rightColor, 1.15));
            rightGradient.addColorStop(1, rightColor);
            ctx.fillStyle = rightGradient;
            ctx.fillRect(px + blockSize - b, py, b, blockSize);
        }

        // Outer corners - two triangles, one for each edge (with gradients)
        if (!T && !L) {
            // Top side triangle with gradient
            const topCornerGradient = ctx.createLinearGradient(px, py, px + b, py + b);
            topCornerGradient.addColorStop(0, topColor);
            topCornerGradient.addColorStop(1, RenderUtils.adjustBrightness(topColor, 0.85));
            ctx.fillStyle = topCornerGradient;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + b, py);
            ctx.lineTo(px + b, py + b);
            ctx.closePath();
            ctx.fill();
            // Left side triangle with gradient
            const leftCornerGradient = ctx.createLinearGradient(px, py, px + b, py + b);
            leftCornerGradient.addColorStop(0, leftColor);
            leftCornerGradient.addColorStop(1, RenderUtils.adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = leftCornerGradient;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px, py + b);
            ctx.lineTo(px + b, py + b);
            ctx.closePath();
            ctx.fill();
        }
        if (!T && !R) {
            // Top side triangle with gradient
            const topRightCornerGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize, py + b);
            topRightCornerGradient.addColorStop(0, RenderUtils.adjustBrightness(topColor, 0.85));
            topRightCornerGradient.addColorStop(1, topColor);
            ctx.fillStyle = topRightCornerGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py);
            ctx.lineTo(px + blockSize - b, py);
            ctx.lineTo(px + blockSize - b, py + b);
            ctx.closePath();
            ctx.fill();
            // Right side triangle with gradient
            const rightCornerGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize, py + b);
            rightCornerGradient.addColorStop(0, RenderUtils.adjustBrightness(rightColor, 1.15));
            rightCornerGradient.addColorStop(1, rightColor);
            ctx.fillStyle = rightCornerGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py);
            ctx.lineTo(px + blockSize, py + b);
            ctx.lineTo(px + blockSize - b, py + b);
            ctx.closePath();
            ctx.fill();
        }
        if (!B && !L) {
            // Left side triangle with gradient
            const leftBottomGradient = ctx.createLinearGradient(px, py + blockSize - b, px + b, py + blockSize);
            leftBottomGradient.addColorStop(0, leftColor);
            leftBottomGradient.addColorStop(1, RenderUtils.adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = leftBottomGradient;
            ctx.beginPath();
            ctx.moveTo(px, py + blockSize);
            ctx.lineTo(px, py + blockSize - b);
            ctx.lineTo(px + b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
            // Bottom side triangle with gradient
            const bottomLeftGradient = ctx.createLinearGradient(px, py + blockSize - b, px + b, py + blockSize);
            bottomLeftGradient.addColorStop(0, RenderUtils.adjustBrightness(bottomColor, 1.15));
            bottomLeftGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = bottomLeftGradient;
            ctx.beginPath();
            ctx.moveTo(px, py + blockSize);
            ctx.lineTo(px + b, py + blockSize);
            ctx.lineTo(px + b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
        }
        if (!B && !R) {
            // Bottom side triangle with gradient
            const bottomRightGradient = ctx.createLinearGradient(px + blockSize - b, py + blockSize - b, px + blockSize, py + blockSize);
            bottomRightGradient.addColorStop(0, RenderUtils.adjustBrightness(bottomColor, 1.15));
            bottomRightGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = bottomRightGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py + blockSize);
            ctx.lineTo(px + blockSize - b, py + blockSize);
            ctx.lineTo(px + blockSize - b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
            // Right side triangle with gradient
            const rightBottomGradient = ctx.createLinearGradient(px + blockSize - b, py + blockSize - b, px + blockSize, py + blockSize);
            rightBottomGradient.addColorStop(0, RenderUtils.adjustBrightness(rightColor, 1.15));
            rightBottomGradient.addColorStop(1, rightColor);
            ctx.fillStyle = rightBottomGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py + blockSize);
            ctx.lineTo(px + blockSize, py + blockSize - b);
            ctx.lineTo(px + blockSize - b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
        }

        // Inner corners - TWO triangles meeting at 45 degrees with edge colors and gradients
        if (T && L && !TL) {
            // First triangle uses leftColor with gradient
            const innerLeftGradient = ctx.createLinearGradient(px, py, px + b, py + b);
            innerLeftGradient.addColorStop(0, leftColor);
            innerLeftGradient.addColorStop(1, RenderUtils.adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = innerLeftGradient;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + b, py);
            ctx.lineTo(px + b, py + b);
            ctx.closePath();
            ctx.fill();
            
            // Second triangle uses topColor with gradient
            const innerTopGradient = ctx.createLinearGradient(px, py, px + b, py + b);
            innerTopGradient.addColorStop(0, topColor);
            innerTopGradient.addColorStop(1, RenderUtils.adjustBrightness(topColor, 0.85));
            ctx.fillStyle = innerTopGradient;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px, py + b);
            ctx.lineTo(px + b, py + b);
            ctx.closePath();
            ctx.fill();
        }
        if (T && R && !TR) {
            // First triangle uses rightColor with gradient
            const innerRightGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize, py + b);
            innerRightGradient.addColorStop(0, RenderUtils.adjustBrightness(rightColor, 1.15));
            innerRightGradient.addColorStop(1, rightColor);
            ctx.fillStyle = innerRightGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py);
            ctx.lineTo(px + blockSize - b, py);
            ctx.lineTo(px + blockSize - b, py + b);
            ctx.closePath();
            ctx.fill();
            
            // Second triangle uses topColor with gradient
            const innerTopRightGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize, py + b);
            innerTopRightGradient.addColorStop(0, RenderUtils.adjustBrightness(topColor, 0.85));
            innerTopRightGradient.addColorStop(1, topColor);
            ctx.fillStyle = innerTopRightGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py);
            ctx.lineTo(px + blockSize, py + b);
            ctx.lineTo(px + blockSize - b, py + b);
            ctx.closePath();
            ctx.fill();
        }
        if (B && L && !BL) {
            // First triangle uses bottomColor with gradient
            const innerBottomLeftGradient = ctx.createLinearGradient(px, py + blockSize - b, px + b, py + blockSize);
            innerBottomLeftGradient.addColorStop(0, RenderUtils.adjustBrightness(bottomColor, 1.15));
            innerBottomLeftGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = innerBottomLeftGradient;
            ctx.beginPath();
            ctx.moveTo(px, py + blockSize);
            ctx.lineTo(px, py + blockSize - b);
            ctx.lineTo(px + b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
            
            // Second triangle uses leftColor with gradient
            const innerLeftBottomGradient = ctx.createLinearGradient(px, py + blockSize - b, px + b, py + blockSize);
            innerLeftBottomGradient.addColorStop(0, leftColor);
            innerLeftBottomGradient.addColorStop(1, RenderUtils.adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = innerLeftBottomGradient;
            ctx.beginPath();
            ctx.moveTo(px, py + blockSize);
            ctx.lineTo(px + b, py + blockSize);
            ctx.lineTo(px + b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
        }
        if (B && R && !BR) {
            // First triangle uses bottomColor with gradient
            const innerBottomRightGradient = ctx.createLinearGradient(px + blockSize - b, py + blockSize - b, px + blockSize, py + blockSize);
            innerBottomRightGradient.addColorStop(0, RenderUtils.adjustBrightness(bottomColor, 1.15));
            innerBottomRightGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = innerBottomRightGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py + blockSize);
            ctx.lineTo(px + blockSize, py + blockSize - b);
            ctx.lineTo(px + blockSize - b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
            
            // Second triangle uses rightColor with gradient
            const innerRightBottomGradient = ctx.createLinearGradient(px + blockSize - b, py + blockSize - b, px + blockSize, py + blockSize);
            innerRightBottomGradient.addColorStop(0, RenderUtils.adjustBrightness(rightColor, 1.15));
            innerRightBottomGradient.addColorStop(1, rightColor);
            ctx.fillStyle = innerRightBottomGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py + blockSize);
            ctx.lineTo(px + blockSize - b, py + blockSize);
            ctx.lineTo(px + blockSize - b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
        }
    });

    ctx.restore();
    },

    // Helper functions for starfield/planet rendering
    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    },

    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, (num >> 8 & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    },

    formatAsBitcoin(points) {
        const btc = points / 10000000;
        return 'â‚¿' + btc.toFixed(4);
    }
};
