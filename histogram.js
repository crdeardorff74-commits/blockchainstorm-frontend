// histogram.js - Histogram visualization system

// Histogram functions
        function initHistogram() {
            // Initialize all bars to 0
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
            
            // Size the canvas to fill the entire panel
            const rulesPanel = histogramCanvas.parentElement;
            // Subtract padding from width (2vh padding on each side = ~4vh total in vw)
            histogramCanvas.width = rulesPanel.clientWidth - 40; // Account for padding
            histogramCanvas.height = rulesPanel.clientHeight - 40; // Account for padding
        }

        function updateHistogramWithBlob(color, blobSize) {
            // Set target height for this color bar
            histogramTargets[color] = blobSize;
            
            // Auto-adjust scale if needed
            if (blobSize > histogramMaxScale) {
                histogramMaxScale = Math.ceil(blobSize / 10) * 10; // Round up to nearest 10
            }
        }

        function updateHistogram() {
            // Animate color bars toward their targets
            Object.keys(histogramBars).forEach(color => {
                const target = histogramTargets[color];
                const current = histogramBars[color];
                
                if (current < target - 0.1) {
                    // Spring up to match 500ms line animation (slower spring)
                    histogramBars[color] = Math.min(target, current + (target - current) * 0.15);
                    // Start decaying target immediately, even while rising
                    histogramTargets[color] = Math.max(0, target * histogramDecayRate);
                } else if (current >= target - 0.1 && (!histogramPauseFrames[color] || histogramPauseFrames[color] < 30)) {
                    // Pause at peak for 30 frames (~0.5 seconds at 60fps)
                    histogramPauseFrames[color] = (histogramPauseFrames[color] || 0) + 1;
                } else {
                    // After pause, decay with gradually accelerating rate
                    const framesSincePeak = (histogramPauseFrames[color] || 30) - 30;
                    // Start at 0.98 and accelerate to 0.92 over 60 frames
                    const acceleration = Math.min(0.06, framesSincePeak * 0.001);
                    const currentDecayRate = histogramDecayRate - acceleration;
                    
                    histogramBars[color] = Math.max(0, current * currentDecayRate);
                    histogramTargets[color] = Math.max(0, target * currentDecayRate);
                    
                    // Reset pause counter when bar reaches near zero
                    if (histogramBars[color] < 0.1) {
                        histogramPauseFrames[color] = 0;
                    }
                }
            });
            
            // Animate score bar toward its target
            if (scoreHistogramBar < scoreHistogramTarget - 0.1) {
                // Spring up to match 500ms line animation (slower spring)
                scoreHistogramBar = Math.min(scoreHistogramTarget, scoreHistogramBar + (scoreHistogramTarget - scoreHistogramBar) * 0.15);
                // Start decaying target immediately, even while rising
                scoreHistogramTarget = Math.max(0, scoreHistogramTarget * histogramDecayRate);
            } else if (scoreHistogramBar >= scoreHistogramTarget - 0.1 && scoreHistogramPauseFrames < 30) {
                // Pause at peak for 30 frames (~0.5 seconds at 60fps)
                scoreHistogramPauseFrames++;
            } else {
                // After pause, decay with gradually accelerating rate
                const framesSincePeak = scoreHistogramPauseFrames - 30;
                // Start at 0.98 and accelerate to 0.92 over 60 frames
                const acceleration = Math.min(0.06, framesSincePeak * 0.001);
                const currentDecayRate = histogramDecayRate - acceleration;
                
                scoreHistogramBar = Math.max(0, scoreHistogramBar * currentDecayRate);
                scoreHistogramTarget = Math.max(0, scoreHistogramTarget * currentDecayRate);
                
                // Reset pause counter when bar reaches near zero
                if (scoreHistogramBar < 0.1) {
                    scoreHistogramPauseFrames = 0;
                }
            }
        }

        function drawHistogram() {
            if (!gameRunning || !histogramCanvas || histogramCanvas.style.display === 'none') return;
            
            const width = histogramCanvas.width;
            const height = histogramCanvas.height;
            const padding = 40;
            const graphHeight = height - padding * 2;
            
            // Reserve space for score histogram on the left
            const scoreBarWidth = 20; // Width for score histogram (narrow to match Bitcoin symbol)
            const scoreBarPadding = 40; // More space between score and color histograms for tick labels
            const colorGraphStart = padding + scoreBarWidth + scoreBarPadding;
            const graphWidth = width - colorGraphStart - padding;
            
            // Clear canvas with transparent background
            histogramCtx.clearRect(0, 0, width, height);
            
            // Draw tick marks and labels for SCORE HISTOGRAM on the left
            histogramCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            histogramCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            histogramCtx.font = '12px Arial';
            histogramCtx.textAlign = 'left'; // Changed to left-align
            histogramCtx.lineWidth = 1;
            
            const tickCount = 5;
            for (let i = 0; i <= tickCount; i++) {
                const value = Math.round((scoreHistogramMaxScale / tickCount) * i);
                const y = height - padding - (graphHeight / tickCount) * i;
                
                // Skip drawing tick mark and label for "0"
                if (value !== 0) {
                    // Tick mark (moved to the right, same 5px length)
                    histogramCtx.beginPath();
                    histogramCtx.moveTo(padding + 1, y);
                    histogramCtx.lineTo(padding + 6, y);
                    histogramCtx.stroke();
                    
                    // Label positioned to the right of tick mark (left-aligned now)
                    histogramCtx.fillText(value.toString(), padding + 8, y + 4);
                }
            }
            
            // Draw SCORE HISTOGRAM (Bitcoin bar on the left)
            if (scoreHistogramBar > 0) {
                const scoreBarHeight = Math.max(8, (scoreHistogramBar / scoreHistogramMaxScale) * graphHeight);
                const scoreX = padding;
                const scoreY = height - padding - scoreBarHeight;
                
                // Draw gold bar
                const goldColor = '#FFD700';
                const b = 4; // Smaller bevel size for narrower bar
                
                // Main face
                histogramCtx.save();
                histogramCtx.globalAlpha = faceOpacity;
                histogramCtx.fillStyle = goldColor;
                histogramCtx.fillRect(scoreX, scoreY, scoreBarWidth, scoreBarHeight);
                histogramCtx.restore();
                
                // Beveled edges for gold bar
                const topGold = '#FFED4E';
                const leftGold = '#FFDF00';
                const bottomGold = '#B8860B';
                const rightGold = '#DAA520';
                
                // Top edge
                const topGradient = histogramCtx.createLinearGradient(scoreX, scoreY, scoreX, scoreY + b);
                topGradient.addColorStop(0, topGold);
                topGradient.addColorStop(1, goldColor);
                histogramCtx.fillStyle = topGradient;
                histogramCtx.fillRect(scoreX, scoreY, scoreBarWidth, b);
                
                // Left edge
                const leftGradient = histogramCtx.createLinearGradient(scoreX, scoreY, scoreX + b, scoreY);
                leftGradient.addColorStop(0, leftGold);
                leftGradient.addColorStop(1, goldColor);
                histogramCtx.fillStyle = leftGradient;
                histogramCtx.fillRect(scoreX, scoreY, b, scoreBarHeight);
                
                // Bottom edge
                const bottomGradient = histogramCtx.createLinearGradient(scoreX, scoreY + scoreBarHeight - b, scoreX, scoreY + scoreBarHeight);
                bottomGradient.addColorStop(0, goldColor);
                bottomGradient.addColorStop(1, bottomGold);
                histogramCtx.fillStyle = bottomGradient;
                histogramCtx.fillRect(scoreX, scoreY + scoreBarHeight - b, scoreBarWidth, b);
                
                // Right edge
                const rightGradient = histogramCtx.createLinearGradient(scoreX + scoreBarWidth - b, scoreY, scoreX + scoreBarWidth, scoreY);
                rightGradient.addColorStop(0, goldColor);
                rightGradient.addColorStop(1, rightGold);
                histogramCtx.fillStyle = rightGradient;
                histogramCtx.fillRect(scoreX + scoreBarWidth - b, scoreY, b, scoreBarHeight);
                
                // Draw Bitcoin B on top of the bar
                const bitcoinY = scoreY - 15; // Position above the bar
                histogramCtx.save();
                histogramCtx.fillStyle = '#FFD700';
                histogramCtx.strokeStyle = '#000000';
                histogramCtx.lineWidth = 2;
                histogramCtx.font = 'bold 20px Arial';
                histogramCtx.textAlign = 'center';
                histogramCtx.textBaseline = 'middle';
                const bitcoinX = scoreX + scoreBarWidth / 2;
                histogramCtx.strokeText('₿', bitcoinX, bitcoinY);
                histogramCtx.fillText('₿', bitcoinX, bitcoinY);
                histogramCtx.restore();
            } else {
                // No bar yet, just show Bitcoin B at bottom
                histogramCtx.save();
                histogramCtx.fillStyle = '#FFD700';
                histogramCtx.strokeStyle = '#000000';
                histogramCtx.lineWidth = 2;
                histogramCtx.font = 'bold 20px Arial';
                histogramCtx.textAlign = 'center';
                histogramCtx.textBaseline = 'middle';
                const bitcoinX = padding + scoreBarWidth / 2;
                const bitcoinY = height - padding - 10;
                histogramCtx.strokeText('₿', bitcoinX, bitcoinY);
                histogramCtx.fillText('₿', bitcoinX, bitcoinY);
                histogramCtx.restore();
            }
            
            // Draw COLOR HISTOGRAM (existing bars)
            const colors = Object.keys(histogramBars);
            const barWidth = graphWidth / colors.length;
            const barSpacing = barWidth * 0.15;
            const actualBarWidth = barWidth - barSpacing;
            
            // Draw tick marks and labels on right side for color histogram
            histogramCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            histogramCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            histogramCtx.font = '12px Arial';
            histogramCtx.textAlign = 'left';
            histogramCtx.lineWidth = 1;
            
            for (let i = 0; i <= tickCount; i++) {
                const value = Math.round((histogramMaxScale / tickCount) * i);
                const y = height - padding - (graphHeight / tickCount) * i;
                
                // Skip drawing tick mark and label for "0"
                if (value !== 0) {
                    // Tick mark
                    histogramCtx.beginPath();
                    histogramCtx.moveTo(colorGraphStart + graphWidth, y);
                    histogramCtx.lineTo(colorGraphStart + graphWidth + 5, y);
                    histogramCtx.stroke();
                    
                    // Label
                    histogramCtx.fillText(value.toString(), colorGraphStart + graphWidth + 8, y + 4);
                }
            }
            
            // Draw beveled bars
            colors.forEach((color, index) => {
                const barHeight = Math.round(Math.max(8, (histogramBars[color] / histogramMaxScale) * graphHeight));
                // Round positions to prevent blur
                const x = Math.round(colorGraphStart + index * barWidth + barSpacing / 2);
                const y = Math.round(height - padding - barHeight);
                
                // Use exact same drawing logic as game pieces
                const blockSize = Math.round(actualBarWidth);
                // Use a larger bevel for histogram bars to match visual appearance of game pieces
                // Even though bars are narrower, we want bevels to be visible
                const b = Math.max(Math.floor(blockSize * 0.2), 6); // Minimum 6 pixels for visibility
                
                // Create edge colors (same as game pieces)
                const topColor = adjustBrightness(color, 1.3);
                const leftColor = adjustBrightness(color, 1.15);
                const bottomColor = adjustBrightness(color, 0.7);
                const rightColor = adjustBrightness(color, 0.85);
                
                // Draw main face with transparency (full block size like game pieces)
                histogramCtx.save();
                histogramCtx.globalAlpha = faceOpacity;
                histogramCtx.fillStyle = color;
                histogramCtx.fillRect(x, y, blockSize, barHeight);
                histogramCtx.restore();
                
                // Draw edges (full width/height like game pieces - always visible for standalone bars)
                // Top edge
                const topGradient = histogramCtx.createLinearGradient(x, y, x, y + b);
                topGradient.addColorStop(0, topColor);
                topGradient.addColorStop(1, adjustBrightness(topColor, 0.85));
                histogramCtx.fillStyle = topGradient;
                histogramCtx.fillRect(x, y, blockSize, b);
                
                // Left edge
                const leftGradient = histogramCtx.createLinearGradient(x, y, x + b, y);
                leftGradient.addColorStop(0, leftColor);
                leftGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
                histogramCtx.fillStyle = leftGradient;
                histogramCtx.fillRect(x, y, b, barHeight);
                
                // Bottom edge
                const bottomGradient = histogramCtx.createLinearGradient(x, y + barHeight - b, x, y + barHeight);
                bottomGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
                bottomGradient.addColorStop(1, bottomColor);
                histogramCtx.fillStyle = bottomGradient;
                histogramCtx.fillRect(x, y + barHeight - b, blockSize, b);
                
                // Right edge
                const rightGradient = histogramCtx.createLinearGradient(x + blockSize - b, y, x + blockSize, y);
                rightGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
                rightGradient.addColorStop(1, rightColor);
                histogramCtx.fillStyle = rightGradient;
                histogramCtx.fillRect(x + blockSize - b, y, b, barHeight);
                
                // Draw all four corners (always visible for standalone bars)
                // Top-left corner
                const topLeftTopGradient = histogramCtx.createLinearGradient(x, y, x + b, y + b);
                topLeftTopGradient.addColorStop(0, topColor);
                topLeftTopGradient.addColorStop(1, adjustBrightness(topColor, 0.85));
                histogramCtx.fillStyle = topLeftTopGradient;
                histogramCtx.beginPath();
                histogramCtx.moveTo(x, y);
                histogramCtx.lineTo(x + b, y);
                histogramCtx.lineTo(x + b, y + b);
                histogramCtx.closePath();
                histogramCtx.fill();
                
                const topLeftLeftGradient = histogramCtx.createLinearGradient(x, y, x + b, y + b);
                topLeftLeftGradient.addColorStop(0, leftColor);
                topLeftLeftGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
                histogramCtx.fillStyle = topLeftLeftGradient;
                histogramCtx.beginPath();
                histogramCtx.moveTo(x, y);
                histogramCtx.lineTo(x, y + b);
                histogramCtx.lineTo(x + b, y + b);
                histogramCtx.closePath();
                histogramCtx.fill();
                
                // Top-right corner
                const topRightTopGradient = histogramCtx.createLinearGradient(x + blockSize - b, y, x + blockSize, y + b);
                topRightTopGradient.addColorStop(0, adjustBrightness(topColor, 0.85));
                topRightTopGradient.addColorStop(1, topColor);
                histogramCtx.fillStyle = topRightTopGradient;
                histogramCtx.beginPath();
                histogramCtx.moveTo(x + blockSize, y);
                histogramCtx.lineTo(x + blockSize - b, y);
                histogramCtx.lineTo(x + blockSize - b, y + b);
                histogramCtx.closePath();
                histogramCtx.fill();
                
                const topRightRightGradient = histogramCtx.createLinearGradient(x + blockSize - b, y, x + blockSize, y + b);
                topRightRightGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
                topRightRightGradient.addColorStop(1, rightColor);
                histogramCtx.fillStyle = topRightRightGradient;
                histogramCtx.beginPath();
                histogramCtx.moveTo(x + blockSize, y);
                histogramCtx.lineTo(x + blockSize, y + b);
                histogramCtx.lineTo(x + blockSize - b, y + b);
                histogramCtx.closePath();
                histogramCtx.fill();
                
                // Bottom-left corner
                const bottomLeftLeftGradient = histogramCtx.createLinearGradient(x, y + barHeight - b, x + b, y + barHeight);
                bottomLeftLeftGradient.addColorStop(0, leftColor);
                bottomLeftLeftGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
                histogramCtx.fillStyle = bottomLeftLeftGradient;
                histogramCtx.beginPath();
                histogramCtx.moveTo(x, y + barHeight);
                histogramCtx.lineTo(x, y + barHeight - b);
                histogramCtx.lineTo(x + b, y + barHeight - b);
                histogramCtx.closePath();
                histogramCtx.fill();
                
                const bottomLeftBottomGradient = histogramCtx.createLinearGradient(x, y + barHeight - b, x + b, y + barHeight);
                bottomLeftBottomGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
                bottomLeftBottomGradient.addColorStop(1, bottomColor);
                histogramCtx.fillStyle = bottomLeftBottomGradient;
                histogramCtx.beginPath();
                histogramCtx.moveTo(x, y + barHeight);
                histogramCtx.lineTo(x + b, y + barHeight);
                histogramCtx.lineTo(x + b, y + barHeight - b);
                histogramCtx.closePath();
                histogramCtx.fill();
                
                // Bottom-right corner
                const bottomRightBottomGradient = histogramCtx.createLinearGradient(x + blockSize - b, y + barHeight - b, x + blockSize, y + barHeight);
                bottomRightBottomGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
                bottomRightBottomGradient.addColorStop(1, bottomColor);
                histogramCtx.fillStyle = bottomRightBottomGradient;
                histogramCtx.beginPath();
                histogramCtx.moveTo(x + blockSize, y + barHeight);
                histogramCtx.lineTo(x + blockSize - b, y + barHeight);
                histogramCtx.lineTo(x + blockSize - b, y + barHeight - b);
                histogramCtx.closePath();
                histogramCtx.fill();
                
                const bottomRightRightGradient = histogramCtx.createLinearGradient(x + blockSize - b, y + barHeight - b, x + blockSize, y + barHeight);
                bottomRightRightGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
                bottomRightRightGradient.addColorStop(1, rightColor);
                histogramCtx.fillStyle = bottomRightRightGradient;
                histogramCtx.beginPath();
                histogramCtx.moveTo(x + blockSize, y + barHeight);
                histogramCtx.lineTo(x + blockSize, y + barHeight - b);
                histogramCtx.lineTo(x + blockSize - b, y + barHeight - b);
                histogramCtx.closePath();
                histogramCtx.fill();
            });
        }