// Rendering Utilities
const RenderUtils = {
    adjustBrightness(color, factor) {
        const hex = color.replace('#', '');
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);
        
        r = Math.min(255, Math.max(0, Math.floor(r * factor)));
        g = Math.min(255, Math.max(0, Math.floor(g * factor)));
        b = Math.min(255, Math.max(0, Math.floor(b * factor)));
        
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    },
    
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
    
    drawSolidShape(ctx, positions, color, blockSize, useGold = false, faceOpacity = 1.0) {
        if (positions.length === 0) return;

        ctx.save();

        const posSet = new Set(positions.map(p => `${p[0]},${p[1]}`));
        const b = Math.floor(blockSize * 0.2);

        let topColor, leftColor, bottomColor, rightColor;
        
        if (useGold) {
            topColor = '#FFD700';
            leftColor = '#FFC700';
            bottomColor = '#DAA520';
            rightColor = '#B8860B';
        } else {
            topColor = this.adjustBrightness(color, 1.3);
            leftColor = this.adjustBrightness(color, 1.15);
            bottomColor = this.adjustBrightness(color, 0.7);
            rightColor = this.adjustBrightness(color, 0.85);
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

            // Draw main face
            const currentAlpha = ctx.globalAlpha;
            ctx.globalAlpha = currentAlpha * faceOpacity;
            ctx.fillStyle = color;
            ctx.fillRect(px, py, blockSize, blockSize);
            ctx.globalAlpha = currentAlpha;

            // Draw edges (simplified for brevity - see full implementation for gradients)
            if (!T) {
                const topGradient = ctx.createLinearGradient(px, py, px, py + b);
                topGradient.addColorStop(0, topColor);
                topGradient.addColorStop(1, this.adjustBrightness(topColor, 0.85));
                ctx.fillStyle = topGradient;
                ctx.fillRect(px, py, blockSize, b);
            }
            if (!L) {
                const leftGradient = ctx.createLinearGradient(px, py, px + b, py);
                leftGradient.addColorStop(0, leftColor);
                leftGradient.addColorStop(1, this.adjustBrightness(leftColor, 0.85));
                ctx.fillStyle = leftGradient;
                ctx.fillRect(px, py, b, blockSize);
            }
            if (!B) {
                const bottomGradient = ctx.createLinearGradient(px, py + blockSize - b, px, py + blockSize);
                bottomGradient.addColorStop(0, this.adjustBrightness(bottomColor, 1.15));
                bottomGradient.addColorStop(1, bottomColor);
                ctx.fillStyle = bottomGradient;
                ctx.fillRect(px, py + blockSize - b, blockSize, b);
            }
            if (!R) {
                const rightGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize, py);
                rightGradient.addColorStop(0, this.adjustBrightness(rightColor, 1.15));
                rightGradient.addColorStop(1, rightColor);
                ctx.fillStyle = rightGradient;
                ctx.fillRect(px + blockSize - b, py, b, blockSize);
            }

            // Draw corners (outer and inner - full implementation omitted for brevity)
        });

        ctx.restore();
    },
    
    formatAsBitcoin(points) {
        const btc = points / 10000000;
        return '₿' + btc.toFixed(4);
    }
};
