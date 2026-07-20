// Histogram Module
// Handles color blob and score histogram visualization

const Histogram = (() => {
    // Canvas references (set by init)
    let canvas = null;
    let ctx = null;
    
    // External state (updated via updateConfig)
    let currentColorSet = [];
    let faceOpacity = 0.42;
    let minimalistMode = false;
    let speedBonusAverage = 1.0;
    let gameRunning = false;
    
    // Color histogram state
    let histogramBars = {};
    let histogramTargets = {};
    let histogramMaxScale = 10;
    let histogramDecayRate = 0.98;
    let histogramPauseFrames = {};
    
    // Score histogram state
    let scoreHistogramBar = 0;
    let scoreHistogramTarget = 0;
    let scoreHistogramMaxScale = 1000;
    let scoreHistogramPauseFrames = 0;
    
    // Speed bonus histogram state
    let speedBonusHistogramBar = 1.0;
    
    /**
     * Initialize the histogram system
     * @param {Object} config - Configuration object
     * @param {HTMLCanvasElement} config.canvas - The histogram canvas element
     * @param {string[]} config.colorSet - Array of colors to track
     */
    function init(config) {
        canvas = config.canvas;
        ctx = canvas.getContext('2d');
        currentColorSet = config.colorSet || [];
        
        // Initialize bars for all colors
        histogramBars = {};
        histogramTargets = {};
        histogramPauseFrames = {};
        currentColorSet.forEach(color => {
            histogramBars[color] = 0;
            histogramTargets[color] = 0;
            histogramPauseFrames[color] = 0;
        });
        histogramMaxScale = 10;
        
        // Initialize score histogram
        scoreHistogramBar = 0;
        scoreHistogramTarget = 0;
        scoreHistogramMaxScale = 1000;
        scoreHistogramPauseFrames = 0;
        
        // Size the canvas to fill the panel
        resizeCanvas();
    }
    
    /**
     * Resize canvas to fit container
     */
    function resizeCanvas() {
        if (!canvas) return;
        
        const rulesPanel = canvas.parentElement;
        if (!rulesPanel) return;
        
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = rulesPanel.clientWidth - 40;
        const displayHeight = rulesPanel.clientHeight - 20;
        
        // Set actual canvas size for high-DPI
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        
        // Scale canvas CSS size
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';
        
        // Scale context to account for DPI
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    
    /**
     * Update external state references
     * @param {Object} state - Current game state
     */
    function updateConfig(state) {
        if (state.colorSet !== undefined) currentColorSet = state.colorSet;
        if (state.faceOpacity !== undefined) faceOpacity = state.faceOpacity;
        if (state.minimalistMode !== undefined) minimalistMode = state.minimalistMode;
        if (state.speedBonusAverage !== undefined) speedBonusAverage = state.speedBonusAverage;
        if (state.gameRunning !== undefined) gameRunning = state.gameRunning;
    }
    
    /**
     * Update histogram target for a blob
     * @param {string} color - Hex color of the blob
     * @param {number} blobSize - Size of the blob
     */
    function updateWithBlob(color, blobSize) {
        histogramTargets[color] = blobSize;
        
        // Auto-adjust scale if needed
        if (blobSize > histogramMaxScale) {
            histogramMaxScale = Math.ceil(blobSize / 10) * 10;
        }
    }
    
    /**
     * Update score histogram target
     * @param {number} points - Points scored
     */
    function updateWithScore(points) {
        scoreHistogramTarget = points;
        
        // Auto-adjust scale if needed
        if (points > scoreHistogramMaxScale) {
            scoreHistogramMaxScale = Math.ceil(points / 1000) * 1000;
        }
    }
    
    /**
     * Animate histogram bars (call each frame)
     */
    function update() {
        // Animate color bars toward their targets
        Object.keys(histogramBars).forEach(color => {
            const target = histogramTargets[color];
            const current = histogramBars[color];
            
            if (current < target - 0.1) {
                // Spring up
                histogramBars[color] = Math.min(target, current + (target - current) * 0.15);
                histogramTargets[color] = Math.max(0, target * histogramDecayRate);
            } else if (current >= target - 0.1 && (!histogramPauseFrames[color] || histogramPauseFrames[color] < 30)) {
                // Pause at peak
                histogramPauseFrames[color] = (histogramPauseFrames[color] || 0) + 1;
            } else {
                // Decay with acceleration
                const framesSincePeak = (histogramPauseFrames[color] || 30) - 30;
                const acceleration = Math.min(0.06, framesSincePeak * 0.001);
                const currentDecayRate = histogramDecayRate - acceleration;
                
                histogramBars[color] = Math.max(0, current * currentDecayRate);
                histogramTargets[color] = Math.max(0, target * currentDecayRate);
                
                if (histogramBars[color] < 0.1) {
                    histogramPauseFrames[color] = 0;
                }
            }
        });
        
        // Animate score bar
        if (scoreHistogramBar < scoreHistogramTarget - 0.1) {
            scoreHistogramBar = Math.min(scoreHistogramTarget, scoreHistogramBar + (scoreHistogramTarget - scoreHistogramBar) * 0.15);
            scoreHistogramTarget = Math.max(0, scoreHistogramTarget * histogramDecayRate);
        } else if (scoreHistogramBar >= scoreHistogramTarget - 0.1 && scoreHistogramPauseFrames < 30) {
            scoreHistogramPauseFrames++;
        } else {
            const framesSincePeak = scoreHistogramPauseFrames - 30;
            const acceleration = Math.min(0.06, framesSincePeak * 0.001);
            const currentDecayRate = histogramDecayRate - acceleration;
            
            scoreHistogramBar = Math.max(0, scoreHistogramBar * currentDecayRate);
            scoreHistogramTarget = Math.max(0, scoreHistogramTarget * currentDecayRate);
            
            if (scoreHistogramBar < 0.1) {
                scoreHistogramPauseFrames = 0;
            }
        }
    }
    
    /**
     * Adjust color brightness
     */
    function adjustBrightness(color, factor) {
        if (!color || !color.startsWith('#')) {
            return color || '#808080';
        }
        
        const hex = color.replace('#', '');
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);
        
        if (isNaN(r) || isNaN(g) || isNaN(b)) {
            return '#808080';
        }
        
        r = Math.min(255, Math.max(0, Math.floor(r * factor)));
        g = Math.min(255, Math.max(0, Math.floor(g * factor)));
        b = Math.min(255, Math.max(0, Math.floor(b * factor)));
        
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * Draw the histogram (call each frame)
     */
    // Layout scale factor (updated each draw)
    let scaleFactor = 1;
    
    function draw() {
        if (!gameRunning || !canvas || canvas.style.display === 'none') return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Wide, short canvas (portrait's strip below the well): thin
        // horizontal bars with no tick annotations
        if (width > height) {
            drawHorizontalLayout(width, height);
            return;
        }

        // Scale factor: 1.0 at 200px+ width, proportionally smaller below
        const sf = Math.min(1, width / 200);
        scaleFactor = sf;
        // Vertical scale: shrink further when the canvas is short; tall
        // landscape panels keep sfV === sf
        const sfV = Math.min(sf, height / 300);
        const padding = Math.max(15, 40 * sf);
        const topPadding = Math.max(8, 40 * sfV);
        const bottomPadding = Math.max(8, 15 * sfV);

        // Reserve space for speed bonus bar at top
        const speedBonusBarHeight = Math.max(10, 16 * sfV);
        const speedBonusGap = Math.max(4, 10 * sfV);
        const mainHistogramStart = speedBonusBarHeight + speedBonusGap;

        const graphHeight = height - topPadding - bottomPadding - mainHistogramStart;

        // Reserve space for score histogram on the left
        const scoreBarWidth = Math.max(12, 24 * sf);
        const scoreBarPadding = Math.max(15, 40 * sf);
        const colorGraphStart = padding + scoreBarWidth + scoreBarPadding;
        const graphWidth = width - colorGraphStart - padding;

        // ========== SPEED BONUS BAR ==========
        drawSpeedBonusBar(width, padding, speedBonusBarHeight);

        // ========== SCORE HISTOGRAM ==========
        drawScoreHistogram(width, height, padding, bottomPadding, graphHeight, scoreBarWidth, scoreBarPadding);

        // ========== COLOR HISTOGRAM ==========
        drawColorHistogram(width, height, padding, bottomPadding, graphHeight, colorGraphStart, graphWidth);
    }

    /**
     * Horizontal layout for the portrait strip: speed bonus bar on top, then
     * one thin left-to-right bar per row (score first, then each color).
     * No tick marks or number annotations — the bars themselves are the story.
     */
    function drawHorizontalLayout(width, height) {
        const sf = Math.min(1, width / 200);
        scaleFactor = sf;

        // ========== SPEED BONUS BAR ==========
        const speedBonusBarHeight = Math.max(8, Math.min(16, Math.round(height * 0.14)));
        const sidePadding = Math.max(8, 15 * sf);
        drawSpeedBonusBar(width, sidePadding, speedBonusBarHeight);

        // ========== BAR ROWS (score + one per color) ==========
        const colors = Object.keys(histogramBars);
        const speedBarY = Math.max(4, 8 * sf); // mirrors barY in drawSpeedBonusBar
        const rowsTop = speedBarY + speedBonusBarHeight + Math.max(3, Math.round(height * 0.04));
        const bottomPadding = Math.max(2, Math.round(height * 0.03));
        const graphHeight = height - rowsTop - bottomPadding;
        const rowCount = colors.length + 1;
        if (graphHeight <= 0) return;

        const rowHeight = graphHeight / rowCount;
        const thickness = Math.max(3, Math.floor(rowHeight * 0.72));
        const rowY = (index) => rowsTop + index * rowHeight + (rowHeight - thickness) / 2;

        // One shared left edge: the Speed Bonus label (drawn at sidePadding
        // by drawSpeedBonusBar), the ₿ marker, and every bar all start at
        // the same x — no staggered indents
        const leftPad = sidePadding;
        const graphWidth = width - leftPad - sidePadding;
        if (graphWidth <= 0) return;

        // Score bar: silver face with gold edges, like the vertical layout
        if (scoreHistogramBar > 0) {
            const scoreLen = Math.max(thickness, (scoreHistogramBar / scoreHistogramMaxScale) * graphWidth);
            drawHorizontalBar(leftPad, rowY(0), scoreLen, thickness, '#FFD700', '#FAFAFA', 0.8);
        }

        // ₿ marker (gold, outlined like the vertical layout's symbol) —
        // drawn AFTER the score bar so it overlays its first pixels as a
        // badge; the black outline keeps it legible on the silver face
        const btcFontSize = Math.max(9, Math.min(16, Math.round(thickness * 1.6)));
        ctx.save();
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.font = `bold ${btcFontSize}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.strokeText('₿', leftPad, rowY(0) + thickness / 2);
        ctx.fillText('₿', leftPad, rowY(0) + thickness / 2);
        ctx.restore();

        // Color bars: always draw at least a nub so every color stays visible
        colors.forEach((color, index) => {
            const len = Math.max(thickness, (histogramBars[color] / histogramMaxScale) * graphWidth);
            drawHorizontalBar(leftPad, rowY(index + 1), len, thickness, color, color, faceOpacity);
        });
    }

    /**
     * One beveled horizontal bar — same edge treatment as the vertical bars,
     * with the bevel scaled down to the thin row height
     */
    function drawHorizontalBar(x, y, w, h, edgeBase, faceColor, faceAlpha) {
        const b = Math.max(2, Math.min(5, Math.round(h * 0.3)));

        // Main face
        ctx.save();
        ctx.globalAlpha = faceAlpha;
        ctx.fillStyle = faceColor;
        ctx.fillRect(x, y, w, h);
        ctx.restore();

        if (w <= b * 2 || h <= b * 2) return; // too small for bevels

        const topColor = adjustBrightness(edgeBase, 1.3);
        const leftColor = adjustBrightness(edgeBase, 1.15);
        const bottomColor = adjustBrightness(edgeBase, 0.7);
        const rightColor = adjustBrightness(edgeBase, 0.85);

        // Top edge
        const topGradient = ctx.createLinearGradient(x, y, x, y + b);
        topGradient.addColorStop(0, topColor);
        topGradient.addColorStop(1, adjustBrightness(topColor, 0.85));
        ctx.fillStyle = topGradient;
        ctx.fillRect(x, y, w, b);

        // Left edge
        const leftGradient = ctx.createLinearGradient(x, y, x + b, y);
        leftGradient.addColorStop(0, leftColor);
        leftGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
        ctx.fillStyle = leftGradient;
        ctx.fillRect(x, y, b, h);

        // Bottom edge
        const bottomGradient = ctx.createLinearGradient(x, y + h - b, x, y + h);
        bottomGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
        bottomGradient.addColorStop(1, bottomColor);
        ctx.fillStyle = bottomGradient;
        ctx.fillRect(x, y + h - b, w, b);

        // Right edge
        const rightGradient = ctx.createLinearGradient(x + w - b, y, x + w, y);
        rightGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
        rightGradient.addColorStop(1, rightColor);
        ctx.fillStyle = rightGradient;
        ctx.fillRect(x + w - b, y, b, h);

        // Corners
        drawBarCorners(x, y, w, h, b, topColor, leftColor, bottomColor, rightColor);
    }
    
    /**
     * Draw the speed bonus bar at the top
     */
    function drawSpeedBonusBar(width, padding, barHeight) {
        // Animate toward current average
        const animationSpeed = 0.05;
        speedBonusHistogramBar += (speedBonusAverage - speedBonusHistogramBar) * animationSpeed;
        
        const sf = scaleFactor;
        const barY = Math.max(4, 8 * sf);
        const fontSize = Math.max(8, Math.round(11 * sf));
        
        // Draw "Speed Bonus" label
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const labelX = padding;
        const labelY = barY + barHeight / 2;
        const speedBonusLabelText = typeof I18n !== 'undefined' ? I18n.t('misc.speedBonusLabel') : 'Speed Bonus';
        ctx.fillText(speedBonusLabelText, labelX, labelY);
        const labelWidth = ctx.measureText(speedBonusLabelText).width + 8 * sf;
        ctx.restore();
        
        // Bar dimensions
        const barStartX = padding + labelWidth;
        const barMaxWidth = width - barStartX - padding - 45 * sf;
        const barActualWidth = Math.max(0, (speedBonusHistogramBar / 2.0) * barMaxWidth);
        
        // Calculate color based on value
        let speedColor;
        if (speedBonusHistogramBar <= 1.0) {
            const t = speedBonusHistogramBar;
            const r = 255;
            const g = Math.floor(200 * t);
            const b = 0;
            speedColor = `rgb(${r}, ${g}, ${b})`;
        } else {
            const t = speedBonusHistogramBar - 1.0;
            const r = Math.floor(255 * (1 - t));
            const g = Math.floor(200 + 55 * t);
            const b = 0;
            speedColor = `rgb(${r}, ${g}, ${b})`;
        }
        
        // Draw bar with beveled edges (replicating color histogram approach exactly)
        const sb = Math.max(2, Math.round(4 * sf));
        if (barActualWidth > sb * 2) {
            // Convert RGB to hex for adjustBrightness
            function rgbToHex(r, g, b) {
                return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
            }
            
            // Parse speedColor to get RGB values
            const rgbMatch = speedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            const hexColor = rgbMatch ? rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])) : '#FFD700';
            
            // Edge colors
            const topColor = adjustBrightness(hexColor, 1.3);
            const leftColor = adjustBrightness(hexColor, 1.15);
            const bottomColor = adjustBrightness(hexColor, 0.7);
            const rightColor = adjustBrightness(hexColor, 0.85);
            
            // Main face
            ctx.save();
            ctx.globalAlpha = faceOpacity;
            ctx.fillStyle = hexColor;
            ctx.fillRect(barStartX, barY, barActualWidth, barHeight);
            ctx.restore();
            
            // Top edge
            const topGrad = ctx.createLinearGradient(barStartX, barY, barStartX, barY + sb);
            topGrad.addColorStop(0, topColor);
            topGrad.addColorStop(1, adjustBrightness(topColor, 0.85));
            ctx.fillStyle = topGrad;
            ctx.fillRect(barStartX, barY, barActualWidth, sb);
            
            // Left edge
            const leftGrad = ctx.createLinearGradient(barStartX, barY, barStartX + sb, barY);
            leftGrad.addColorStop(0, leftColor);
            leftGrad.addColorStop(1, adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = leftGrad;
            ctx.fillRect(barStartX, barY, sb, barHeight);
            
            // Bottom edge
            const bottomGrad = ctx.createLinearGradient(barStartX, barY + barHeight - sb, barStartX, barY + barHeight);
            bottomGrad.addColorStop(0, adjustBrightness(bottomColor, 1.15));
            bottomGrad.addColorStop(1, bottomColor);
            ctx.fillStyle = bottomGrad;
            ctx.fillRect(barStartX, barY + barHeight - sb, barActualWidth, sb);
            
            // Right edge
            const rightGrad = ctx.createLinearGradient(barStartX + barActualWidth - sb, barY, barStartX + barActualWidth, barY);
            rightGrad.addColorStop(0, adjustBrightness(rightColor, 1.15));
            rightGrad.addColorStop(1, rightColor);
            ctx.fillStyle = rightGrad;
            ctx.fillRect(barStartX + barActualWidth - sb, barY, sb, barHeight);
            
            // Corners
            drawBarCorners(barStartX, barY, barActualWidth, barHeight, sb, topColor, leftColor, bottomColor, rightColor);
        } else if (barActualWidth > 0) {
            // Bar too small for bevels, just draw simple filled rect
            ctx.save();
            ctx.globalAlpha = faceOpacity;
            ctx.fillStyle = speedColor;
            ctx.fillRect(barStartX, barY, barActualWidth, barHeight);
            ctx.restore();
        }
        
        // Draw value
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${speedBonusHistogramBar.toFixed(2)}x`, barStartX + barActualWidth + 4 * sf, labelY);
        ctx.restore();
    }
    
    /**
     * Draw the score (Bitcoin) histogram bar
     */
    function drawScoreHistogram(width, height, padding, bottomPadding, graphHeight, scoreBarWidth, scoreBarPadding) {
        const colorGraphStart = padding + scoreBarWidth + scoreBarPadding;
        const sf = scaleFactor;
        const tickFontSize = Math.max(7, Math.round(10 * sf));
        const btcFontSize = Math.max(12, Math.round(20 * sf));
        
        // Draw tick marks and labels (skip in minimalist mode)
        if (!minimalistMode) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = `${tickFontSize}px Arial`;
            ctx.textAlign = 'left';
            ctx.lineWidth = 1;
            
            const tickCount = 5;
            for (let i = 0; i <= tickCount; i++) {
                const value = (scoreHistogramMaxScale / tickCount) * i;
                const y = height - bottomPadding - (graphHeight / tickCount) * i;
                
                if (value > 0) {
                    const tickX = padding + scoreBarWidth + 2;
                    ctx.beginPath();
                    ctx.moveTo(tickX, y);
                    ctx.lineTo(tickX + 5, y);
                    ctx.stroke();
                    
                    // Format as Bitcoin
                    const btcValue = value / 10000000;
                    let labelText;
                    if (btcValue >= 1) {
                        labelText = '₿' + btcValue.toFixed(2);
                    } else if (btcValue >= 0.01) {
                        labelText = '₿' + btcValue.toFixed(3);
                    } else {
                        labelText = '₿' + btcValue.toFixed(4);
                    }
                    ctx.fillText(labelText, tickX + 7 * sf, y + 3);
                }
            }
        }
        
        // Draw gold bar (replicating color histogram approach exactly)
        if (scoreHistogramBar > 0) {
            const silverColor = '#FAFAFA';
            const goldColor = '#FFD700';
            const b = Math.max(3, Math.round(6 * sf));
            
            const minBarHeight = b * 2;
            const barHeight = Math.max(minBarHeight, (scoreHistogramBar / scoreHistogramMaxScale) * graphHeight);
            const x = padding;
            const y = height - bottomPadding - barHeight;
            
            // Edge colors (gold)
            const topGold = adjustBrightness(goldColor, 1.3);
            const leftGold = adjustBrightness(goldColor, 1.15);
            const bottomGold = adjustBrightness(goldColor, 0.7);
            const rightGold = adjustBrightness(goldColor, 0.85);
            
            // Main face (silver with 0.8 opacity)
            ctx.save();
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = silverColor;
            ctx.fillRect(x, y, scoreBarWidth, barHeight);
            ctx.restore();
            
            // Top edge (gold)
            const topGradient = ctx.createLinearGradient(x, y, x, y + b);
            topGradient.addColorStop(0, topGold);
            topGradient.addColorStop(1, adjustBrightness(topGold, 0.85));
            ctx.fillStyle = topGradient;
            ctx.fillRect(x, y, scoreBarWidth, b);
            
            // Left edge (gold)
            const leftGradient = ctx.createLinearGradient(x, y, x + b, y);
            leftGradient.addColorStop(0, leftGold);
            leftGradient.addColorStop(1, adjustBrightness(leftGold, 0.85));
            ctx.fillStyle = leftGradient;
            ctx.fillRect(x, y, b, barHeight);
            
            // Bottom edge (gold)
            const bottomGradient = ctx.createLinearGradient(x, y + barHeight - b, x, y + barHeight);
            bottomGradient.addColorStop(0, adjustBrightness(bottomGold, 1.15));
            bottomGradient.addColorStop(1, bottomGold);
            ctx.fillStyle = bottomGradient;
            ctx.fillRect(x, y + barHeight - b, scoreBarWidth, b);
            
            // Right edge (gold)
            const rightGradient = ctx.createLinearGradient(x + scoreBarWidth - b, y, x + scoreBarWidth, y);
            rightGradient.addColorStop(0, adjustBrightness(rightGold, 1.15));
            rightGradient.addColorStop(1, rightGold);
            ctx.fillStyle = rightGradient;
            ctx.fillRect(x + scoreBarWidth - b, y, b, barHeight);
            
            // Corners (gold)
            drawBarCorners(x, y, scoreBarWidth, barHeight, b, topGold, leftGold, bottomGold, rightGold);
            
            // Bitcoin symbol above bar (gold)
            const bitcoinY = y - 15 * sf;
            ctx.save();
            ctx.fillStyle = '#FFD700';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.font = `bold ${btcFontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const bitcoinX = x + scoreBarWidth / 2;
            ctx.strokeText('₿', bitcoinX, bitcoinY);
            ctx.fillText('₿', bitcoinX, bitcoinY);
            ctx.restore();
        } else {
            // No bar yet, show Bitcoin symbol at bottom
            ctx.save();
            ctx.fillStyle = '#FFD700';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.font = `bold ${btcFontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const bitcoinX = padding + scoreBarWidth / 2;
            const bitcoinY = height - bottomPadding - 10 * sf;
            ctx.strokeText('₿', bitcoinX, bitcoinY);
            ctx.fillText('₿', bitcoinX, bitcoinY);
            ctx.restore();
        }
    }
    
    /**
     * Draw the color histogram bars
     */
    function drawColorHistogram(width, height, padding, bottomPadding, graphHeight, colorGraphStart, graphWidth) {
        const colors = Object.keys(histogramBars);
        if (colors.length === 0) return;
        
        const sf = scaleFactor;
        const barWidth = graphWidth / colors.length;
        const barSpacing = barWidth * 0.15;
        const actualBarWidth = barWidth - barSpacing;
        const tickFontSize = Math.max(8, Math.round(12 * sf));
        
        // Draw tick marks on right side (skip in minimalist mode)
        if (!minimalistMode) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = `${tickFontSize}px Arial`;
            ctx.textAlign = 'left';
            ctx.lineWidth = 1;
            
            const tickCount = 5;
            for (let i = 0; i <= tickCount; i++) {
                const value = Math.round((histogramMaxScale / tickCount) * i);
                const y = height - bottomPadding - (graphHeight / tickCount) * i;
                
                if (value !== 0) {
                    ctx.beginPath();
                    ctx.moveTo(colorGraphStart + graphWidth, y);
                    ctx.lineTo(colorGraphStart + graphWidth + 5, y);
                    ctx.stroke();
                    ctx.fillText(value.toString(), colorGraphStart + graphWidth + 4 * sf, y + 4);
                }
            }
        }
        
        // Draw bars
        colors.forEach((color, index) => {
            const blockSize = Math.round(actualBarWidth);
            const b = Math.max(3, Math.round(7 * sf)); // Scaled bevel size
            
            const minBarHeight = b * 2;
            const barHeight = Math.round(Math.max(minBarHeight, (histogramBars[color] / histogramMaxScale) * graphHeight));
            const x = Math.round(colorGraphStart + index * barWidth + barSpacing / 2);
            const y = Math.round(height - bottomPadding - barHeight);
            
            // Edge colors
            const topColor = adjustBrightness(color, 1.3);
            const leftColor = adjustBrightness(color, 1.15);
            const bottomColor = adjustBrightness(color, 0.7);
            const rightColor = adjustBrightness(color, 0.85);
            
            // Main face
            ctx.save();
            ctx.globalAlpha = faceOpacity;
            ctx.fillStyle = color;
            ctx.fillRect(x, y, blockSize, barHeight);
            ctx.restore();
            
            // Top edge
            const topGradient = ctx.createLinearGradient(x, y, x, y + b);
            topGradient.addColorStop(0, topColor);
            topGradient.addColorStop(1, adjustBrightness(topColor, 0.85));
            ctx.fillStyle = topGradient;
            ctx.fillRect(x, y, blockSize, b);
            
            // Left edge
            const leftGradient = ctx.createLinearGradient(x, y, x + b, y);
            leftGradient.addColorStop(0, leftColor);
            leftGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = leftGradient;
            ctx.fillRect(x, y, b, barHeight);
            
            // Bottom edge
            const bottomGradient = ctx.createLinearGradient(x, y + barHeight - b, x, y + barHeight);
            bottomGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
            bottomGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = bottomGradient;
            ctx.fillRect(x, y + barHeight - b, blockSize, b);
            
            // Right edge
            const rightGradient = ctx.createLinearGradient(x + blockSize - b, y, x + blockSize, y);
            rightGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
            rightGradient.addColorStop(1, rightColor);
            ctx.fillStyle = rightGradient;
            ctx.fillRect(x + blockSize - b, y, b, barHeight);
            
            // Corners
            drawBarCorners(x, y, blockSize, barHeight, b, topColor, leftColor, bottomColor, rightColor);
        });
    }
    
    /**
     * Draw beveled corners for a bar (matching game piece rendering)
     */
    function drawBarCorners(x, y, blockSize, barHeight, b, topColor, leftColor, bottomColor, rightColor) {
        // Top-left corner - use vertical gradient for top triangle, horizontal for left triangle
        let grad = ctx.createLinearGradient(x, y, x, y + b);
        grad.addColorStop(0, topColor);
        grad.addColorStop(1, adjustBrightness(topColor, 0.85));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + b, y);
        ctx.lineTo(x + b, y + b);
        ctx.closePath();
        ctx.fill();
        
        grad = ctx.createLinearGradient(x, y, x + b, y);
        grad.addColorStop(0, leftColor);
        grad.addColorStop(1, adjustBrightness(leftColor, 0.85));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + b);
        ctx.lineTo(x + b, y + b);
        ctx.closePath();
        ctx.fill();
        
        // Top-right corner - use vertical gradient for top triangle, horizontal for right triangle
        grad = ctx.createLinearGradient(x + blockSize, y, x + blockSize, y + b);
        grad.addColorStop(0, topColor);
        grad.addColorStop(1, adjustBrightness(topColor, 0.85));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x + blockSize, y);
        ctx.lineTo(x + blockSize - b, y);
        ctx.lineTo(x + blockSize - b, y + b);
        ctx.closePath();
        ctx.fill();
        
        grad = ctx.createLinearGradient(x + blockSize - b, y, x + blockSize, y);
        grad.addColorStop(0, adjustBrightness(rightColor, 1.15));
        grad.addColorStop(1, rightColor);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x + blockSize, y);
        ctx.lineTo(x + blockSize, y + b);
        ctx.lineTo(x + blockSize - b, y + b);
        ctx.closePath();
        ctx.fill();
        
        // Bottom-left corner - use horizontal gradient for left triangle, vertical for bottom triangle
        grad = ctx.createLinearGradient(x, y + barHeight, x + b, y + barHeight);
        grad.addColorStop(0, leftColor);
        grad.addColorStop(1, adjustBrightness(leftColor, 0.85));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, y + barHeight);
        ctx.lineTo(x, y + barHeight - b);
        ctx.lineTo(x + b, y + barHeight - b);
        ctx.closePath();
        ctx.fill();
        
        grad = ctx.createLinearGradient(x, y + barHeight - b, x, y + barHeight);
        grad.addColorStop(0, adjustBrightness(bottomColor, 1.15));
        grad.addColorStop(1, bottomColor);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, y + barHeight);
        ctx.lineTo(x + b, y + barHeight);
        ctx.lineTo(x + b, y + barHeight - b);
        ctx.closePath();
        ctx.fill();
        
        // Bottom-right corner - use vertical gradient for bottom triangle, horizontal for right triangle
        grad = ctx.createLinearGradient(x + blockSize, y + barHeight - b, x + blockSize, y + barHeight);
        grad.addColorStop(0, adjustBrightness(bottomColor, 1.15));
        grad.addColorStop(1, bottomColor);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x + blockSize, y + barHeight);
        ctx.lineTo(x + blockSize - b, y + barHeight);
        ctx.lineTo(x + blockSize - b, y + barHeight - b);
        ctx.closePath();
        ctx.fill();
        
        grad = ctx.createLinearGradient(x + blockSize - b, y + barHeight, x + blockSize, y + barHeight);
        grad.addColorStop(0, adjustBrightness(rightColor, 1.15));
        grad.addColorStop(1, rightColor);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x + blockSize, y + barHeight);
        ctx.lineTo(x + blockSize, y + barHeight - b);
        ctx.lineTo(x + blockSize - b, y + barHeight - b);
        ctx.closePath();
        ctx.fill();
    }
    
    /**
     * Reset histogram state
     */
    function reset() {
        Object.keys(histogramBars).forEach(color => {
            histogramBars[color] = 0;
            histogramTargets[color] = 0;
            histogramPauseFrames[color] = 0;
        });
        histogramMaxScale = 10;
        
        scoreHistogramBar = 0;
        scoreHistogramTarget = 0;
        scoreHistogramMaxScale = 1000;
        scoreHistogramPauseFrames = 0;
        
        speedBonusHistogramBar = 1.0;
    }
    
    // Public API
    return {
        init,
        updateConfig,
        updateWithBlob,
        updateWithScore,
        update,
        draw,
        reset,
        resizeCanvas
    };
})();
