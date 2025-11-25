// ============================================
// SPECIAL EFFECTS MODULE
// ============================================
// Handles: Black Hole, Volcano, Tsunami, Tornado, Earthquake

const SpecialEffects = (function() {
    // ============================================
    // TORNADO STATE
    // ============================================
    let tornadoActive = false;
    let tornadoY = 0;
    let tornadoX = 0;
    let tornadoRotation = 0;
    let tornadoSpeed = 1.5;
    let tornadoPickedBlob = null;
    let tornadoState = 'descending';
    let tornadoDropTargetX = 0;
    let tornadoLiftStartY = 0;
    let tornadoBlobRotation = 0;
    let tornadoVerticalRotation = 0;
    let tornadoOrbitStartTime = null;
    let tornadoOrbitRadius = 0;
    let tornadoOrbitAngle = 0;
    let tornadoLiftHeight = 0;
    let tornadoDropStartY = 0;
    let tornadoFadeProgress = 0;
    let tornadoSnakeVelocity = 0;
    let tornadoSnakeDirection = 1;
    let tornadoSnakeChangeCounter = 0;
    let tornadoParticles = [];
    
    let disintegrationParticles = [];
    
    // ============================================
    // EARTHQUAKE STATE
    // ============================================
    let earthquakeActive = false;
    let earthquakePhase = 'shake';
    let earthquakeShakeProgress = 0;
    let earthquakeShakeIntensity = 0;
    let earthquakeCrack = [];
    let earthquakeCrackProgress = 0;
    let earthquakeCrackMap = new Map();
    let earthquakeShiftProgress = 0;
    let earthquakeLeftBlocks = [];
    let earthquakeRightBlocks = [];
    
    // ============================================
    // BLACK HOLE STATE
    // ============================================
    let blackHoleActive = false;
    let blackHoleAnimating = false;
    let blackHoleCenterX = 0;
    let blackHoleCenterY = 0;
    let blackHoleBlocks = [];
    let blackHoleStartTime = 0;
    let blackHoleDuration = 2500;
    let blackHoleShakeIntensity = 0;
    let blackHoleInnerBlob = null;
    let blackHoleOuterBlob = null;
    
    // ============================================
    // TSUNAMI STATE
    // ============================================
    let tsunamiActive = false;
    let tsunamiAnimating = false;
    let tsunamiBlob = null;
    let tsunamiBlocks = [];
    let tsunamiPushedBlocks = [];
    let tsunamiStartTime = 0;
    let tsunamiDuration = 2000;
    let tsunamiWobbleIntensity = 0;
    
    // ============================================
    // VOLCANO STATE
    // ============================================
    let volcanoActive = false;
    let volcanoAnimating = false;
    let volcanoPhase = 'warming';
    let volcanoLavaBlob = null;
    let volcanoLavaColor = '#FF4500';
    let volcanoEruptionColumn = -1;
    let volcanoEdgeType = '';
    let volcanoProjectiles = [];
    let volcanoStartTime = 0;
    let volcanoWarmingDuration = 3000;
    let volcanoEruptionDuration = 2000;
    let volcanoVibrateOffset = { x: 0, y: 0 };
    let volcanoColorProgress = 0;
    let volcanoOriginalColor = null;
    let volcanoProjectilesSpawned = 0;
    let volcanoTargetProjectiles = 0;
    
    // ============================================
    // DEPENDENCIES (injected from game.js)
    // ============================================
    let deps = {
        board: null,
        isRandomBlock: null,
        fadingBlocks: null,
        isLattice: null,
        canvas: null,
        ctx: null,
        BLOCK_SIZE: 35,
        ROWS: 20,
        COLS: 10,
        getAllBlobs: null,
        findBlob: null,
        drawSolidShape: null,
        getFaceOpacity: null,
        runTwoPhaseGravity: null,
        playSoundEffect: null,
        playEnhancedThunder: null,
        playThunder: null,
        soundToggle: null,
        getGameRunning: null,
        getPaused: null
    };
    
    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    
    function getLavaColor() {
        const pulse = Math.sin(Date.now() / 1000) * 0.5 + 0.5;
        const baseR = 255, baseG = 69, baseB = 0;
        const minBrightness = 0.7, maxBrightness = 1.3;
        const brightness = minBrightness + pulse * (maxBrightness - minBrightness);
        const r = Math.min(255, Math.round(baseR * brightness));
        const g = Math.min(255, Math.round(baseG * brightness));
        const b = Math.min(255, Math.round(baseB * brightness));
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    // ============================================
    // BLACK HOLE SYSTEM
    // ============================================
    
    function triggerBlackHole(innerBlob, outerBlob) {
        const innerXs = innerBlob.positions.map(p => p[0]);
        const innerYs = innerBlob.positions.map(p => p[1]);
        blackHoleCenterX = (Math.min(...innerXs) + Math.max(...innerXs)) / 2;
        blackHoleCenterY = (Math.min(...innerYs) + Math.max(...innerYs)) / 2;
        
        blackHoleInnerBlob = innerBlob;
        blackHoleOuterBlob = outerBlob;
        
        innerBlob.positions.forEach(([x, y]) => {
            deps.board[y][x] = null;
            deps.isRandomBlock[y][x] = false;
            deps.fadingBlocks[y][x] = null;
        });
        
        blackHoleBlocks = [];
        outerBlob.positions.forEach(([x, y]) => {
            const dx = x - blackHoleCenterX;
            const dy = y - blackHoleCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            blackHoleBlocks.push({
                x, y,
                color: outerBlob.color,
                distance,
                isInner: false,
                animating: false,
                removed: false,
                pullProgress: 0,
                currentX: x,
                currentY: y,
                startX: x,
                startY: y,
                scale: 1,
                rotation: 0
            });
        });
        
        blackHoleBlocks.sort((a, b) => b.distance - a.distance);
        
        blackHoleActive = true;
        blackHoleAnimating = true;
        blackHoleStartTime = Date.now();
        blackHoleShakeIntensity = 8;
        
        deps.canvas.classList.add('blackhole-active');
        deps.playEnhancedThunder(deps.soundToggle);
    }
    
    function createDisintegrationExplosion(blob) {
        blob.positions.forEach(([x, y]) => {
            const blockCenterX = x * deps.BLOCK_SIZE + deps.BLOCK_SIZE / 2;
            const blockCenterY = y * deps.BLOCK_SIZE + deps.BLOCK_SIZE / 2;
            
            const numParticles = 12 + Math.floor(Math.random() * 5);
            for (let i = 0; i < numParticles; i++) {
                const angle = (Math.PI * 2 * i / numParticles) + (Math.random() - 0.5) * 0.5;
                const speed = 3 + Math.random() * 5;
                const size = 2 + Math.random() * 4;
                
                disintegrationParticles.push({
                    x: blockCenterX,
                    y: blockCenterY,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: size,
                    color: blob.color,
                    alpha: 1.0,
                    decay: 0.015 + Math.random() * 0.01,
                    gravity: 0.15,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() - 0.5) * 0.3
                });
            }
        });
    }
    
    function updateDisintegrationParticles() {
        for (let i = disintegrationParticles.length - 1; i >= 0; i--) {
            const p = disintegrationParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.rotation += p.rotationSpeed;
            p.alpha -= p.decay;
            
            if (p.alpha <= 0) {
                disintegrationParticles.splice(i, 1);
            }
        }
    }
    
    function drawDisintegrationParticles() {
        if (disintegrationParticles.length === 0) return;
        
        const ctx = deps.ctx;
        ctx.save();
        
        disintegrationParticles.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        });
        
        ctx.restore();
    }
    
    function updateBlackHoleAnimation() {
        if (!blackHoleAnimating) return;
        
        const elapsed = Date.now() - blackHoleStartTime;
        const progress = Math.min(elapsed / blackHoleDuration, 1);
        
        blackHoleShakeIntensity = 8 * (1 - progress * 0.5);
        
        const blocksToStart = Math.floor(progress * blackHoleBlocks.length * 1.5);
        blackHoleBlocks.forEach((block, i) => {
            if (i < blocksToStart && !block.animating && !block.removed) {
                block.animating = true;
            }
            
            if (block.animating && !block.removed) {
                block.pullProgress += 0.02;
                
                const pullEase = 1 - Math.pow(1 - block.pullProgress, 3);
                block.currentX = block.startX + (blackHoleCenterX - block.startX) * pullEase;
                block.currentY = block.startY + (blackHoleCenterY - block.startY) * pullEase;
                block.scale = Math.max(0.1, 1 - pullEase * 0.9);
                block.rotation += 0.1 * pullEase;
                
                if (block.pullProgress >= 1) {
                    block.removed = true;
                    deps.board[block.y][block.x] = null;
                    deps.isRandomBlock[block.y][block.x] = false;
                    deps.fadingBlocks[block.y][block.x] = null;
                }
            }
        });
        
        if (progress >= 1 && blackHoleBlocks.every(b => b.removed)) {
            blackHoleAnimating = false;
            blackHoleActive = false;
            blackHoleShakeIntensity = 0;
            deps.canvas.classList.remove('blackhole-active');
            
            createDisintegrationExplosion(blackHoleOuterBlob);
            
            deps.runTwoPhaseGravity();
        }
    }
    
    function drawBlackHole() {
        if (!blackHoleActive) return;
        
        const ctx = deps.ctx;
        const BLOCK_SIZE = deps.BLOCK_SIZE;
        
        ctx.save();
        
        const centerPixelX = blackHoleCenterX * BLOCK_SIZE + BLOCK_SIZE / 2;
        const centerPixelY = blackHoleCenterY * BLOCK_SIZE + BLOCK_SIZE / 2;
        
        const elapsed = Date.now() - blackHoleStartTime;
        const progress = Math.min(elapsed / blackHoleDuration, 1);
        const vortexSize = BLOCK_SIZE * (1.5 + progress);
        
        const vortexGradient = ctx.createRadialGradient(
            centerPixelX, centerPixelY, 0,
            centerPixelX, centerPixelY, vortexSize
        );
        vortexGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        vortexGradient.addColorStop(0.3, 'rgba(20, 0, 40, 0.9)');
        vortexGradient.addColorStop(0.6, 'rgba(60, 0, 120, 0.5)');
        vortexGradient.addColorStop(1, 'rgba(100, 0, 200, 0)');
        
        ctx.fillStyle = vortexGradient;
        ctx.beginPath();
        ctx.arc(centerPixelX, centerPixelY, vortexSize, 0, Math.PI * 2);
        ctx.fill();
        
        const spiralTime = Date.now() / 200;
        ctx.strokeStyle = 'rgba(150, 50, 255, 0.5)';
        ctx.lineWidth = 2;
        for (let arm = 0; arm < 3; arm++) {
            ctx.beginPath();
            for (let i = 0; i < 50; i++) {
                const angle = (i / 50) * Math.PI * 4 + spiralTime + (arm * Math.PI * 2 / 3);
                const radius = (i / 50) * vortexSize;
                const x = centerPixelX + Math.cos(angle) * radius;
                const y = centerPixelY + Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        blackHoleBlocks.forEach(block => {
            if (block.animating && !block.removed) {
                const pixelX = block.currentX * BLOCK_SIZE;
                const pixelY = block.currentY * BLOCK_SIZE;
                const size = BLOCK_SIZE * block.scale;
                
                ctx.save();
                ctx.translate(pixelX + size / 2, pixelY + size / 2);
                ctx.rotate(block.rotation);
                ctx.globalAlpha = block.scale;
                ctx.fillStyle = block.color;
                ctx.fillRect(-size / 2, -size / 2, size, size);
                ctx.restore();
            }
        });
        
        if (Math.random() < 0.3) {
            const angle = Math.random() * Math.PI * 2;
            const dist = vortexSize + Math.random() * 20;
            disintegrationParticles.push({
                x: centerPixelX + Math.cos(angle) * dist,
                y: centerPixelY + Math.sin(angle) * dist,
                vx: -Math.cos(angle) * 2,
                vy: -Math.sin(angle) * 2,
                size: 2 + Math.random() * 3,
                color: `hsl(${270 + Math.random() * 30}, 100%, ${50 + Math.random() * 30}%)`,
                alpha: 0.8,
                decay: 0.04,
                gravity: 0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3
            });
        }
        
        ctx.restore();
    }
    
    // ============================================
    // VOLCANO SYSTEM
    // ============================================
    
    function triggerVolcano(lavaBlob, eruptionColumn, edgeType = 'bottom') {
        console.log('🌋 Volcano triggered!', 'Lava blob size:', lavaBlob.positions.length);
        
        volcanoActive = true;
        volcanoAnimating = true;
        volcanoPhase = 'warming';
        volcanoLavaBlob = lavaBlob;
        volcanoEruptionColumn = eruptionColumn;
        volcanoEdgeType = edgeType;
        volcanoStartTime = Date.now();
        volcanoProjectiles = [];
        volcanoVibrateOffset = { x: 0, y: 0 };
        volcanoColorProgress = 0;
        volcanoOriginalColor = lavaBlob.color;
        volcanoProjectilesSpawned = 0;
        volcanoTargetProjectiles = lavaBlob.positions.length;
        
        deps.playSoundEffect('thunder', deps.soundToggle);
    }
    
    function updateVolcanoAnimation() {
        if (!volcanoAnimating) return;
        
        const elapsed = Date.now() - volcanoStartTime;
        
        if (volcanoPhase === 'warming') {
            const warmProgress = Math.min(elapsed / volcanoWarmingDuration, 1);
            volcanoColorProgress = warmProgress;
            
            const intensity = warmProgress * 6;
            volcanoVibrateOffset = {
                x: (Math.random() - 0.5) * intensity,
                y: (Math.random() - 0.5) * intensity
            };
            
            if (warmProgress >= 1) {
                volcanoPhase = 'erupting';
                volcanoStartTime = Date.now();
                
                volcanoLavaBlob.positions.forEach(([x, y]) => {
                    deps.board[y][x] = volcanoLavaColor;
                });
                
                deps.playEnhancedThunder(deps.soundToggle);
            }
        } else if (volcanoPhase === 'erupting') {
            const eruptProgress = Math.min((elapsed) / volcanoEruptionDuration, 1);
            
            const intensity = (1 - eruptProgress) * 10;
            volcanoVibrateOffset = {
                x: (Math.random() - 0.5) * intensity,
                y: (Math.random() - 0.5) * intensity
            };
            
            const projectilesToSpawn = Math.floor(eruptProgress * volcanoTargetProjectiles);
            while (volcanoProjectilesSpawned < projectilesToSpawn && volcanoProjectilesSpawned < volcanoTargetProjectiles) {
                spawnLavaProjectile();
                volcanoProjectilesSpawned++;
            }
            
            volcanoProjectiles.forEach(proj => {
                if (!proj.landed) {
                    proj.vy += proj.gravity;
                    proj.x += proj.vx;
                    proj.y += proj.vy;
                    proj.rotation += proj.rotationSpeed;
                    
                    const gridX = Math.floor(proj.x / deps.BLOCK_SIZE);
                    const gridY = Math.floor(proj.y / deps.BLOCK_SIZE);
                    
                    if (gridY >= deps.ROWS || gridY >= 0 && gridX >= 0 && gridX < deps.COLS && deps.board[gridY] && deps.board[gridY][gridX] !== null) {
                        proj.landed = true;
                        
                        let landY = gridY - 1;
                        while (landY >= 0 && deps.board[landY] && deps.board[landY][gridX] !== null) {
                            landY--;
                        }
                        
                        if (landY >= 0 && gridX >= 0 && gridX < deps.COLS) {
                            deps.board[landY][gridX] = volcanoLavaColor;
                        }
                    }
                    
                    if (proj.x < -deps.BLOCK_SIZE || proj.x > deps.canvas.width + deps.BLOCK_SIZE) {
                        proj.landed = true;
                    }
                }
            });
            
            if (eruptProgress >= 1 && volcanoProjectiles.every(p => p.landed)) {
                volcanoLavaBlob.positions.forEach(([x, y]) => {
                    deps.board[y][x] = null;
                    deps.isRandomBlock[y][x] = false;
                });
                
                volcanoAnimating = false;
                volcanoActive = false;
                volcanoPhase = 'warming';
                volcanoVibrateOffset = { x: 0, y: 0 };
                
                deps.runTwoPhaseGravity();
            }
        }
    }
    
    function spawnLavaProjectile() {
        if (!volcanoLavaBlob || volcanoLavaBlob.positions.length === 0) return;
        
        const randomPos = volcanoLavaBlob.positions[Math.floor(Math.random() * volcanoLavaBlob.positions.length)];
        const startX = randomPos[0] * deps.BLOCK_SIZE + deps.BLOCK_SIZE / 2;
        const startY = randomPos[1] * deps.BLOCK_SIZE;
        
        let vx = (Math.random() - 0.5) * 8;
        let vy = -8 - Math.random() * 6;
        
        if (volcanoEdgeType.includes('left')) {
            vx = 3 + Math.random() * 5;
        } else if (volcanoEdgeType.includes('right')) {
            vx = -3 - Math.random() * 5;
        }
        
        volcanoProjectiles.push({
            x: startX,
            y: startY,
            vx: vx,
            vy: vy,
            gravity: 0.3,
            color: volcanoLavaColor,
            size: deps.BLOCK_SIZE * 0.8,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2,
            landed: false
        });
    }
    
    function drawVolcano() {
        if (!volcanoActive) return;
        
        const ctx = deps.ctx;
        const BLOCK_SIZE = deps.BLOCK_SIZE;
        
        ctx.save();
        
        if (volcanoPhase === 'warming' && volcanoLavaBlob) {
            const r1 = parseInt(volcanoOriginalColor.slice(1, 3), 16);
            const g1 = parseInt(volcanoOriginalColor.slice(3, 5), 16);
            const b1 = parseInt(volcanoOriginalColor.slice(5, 7), 16);
            
            const r2 = 255, g2 = 69, b2 = 0;
            
            const r = Math.round(r1 + (r2 - r1) * volcanoColorProgress);
            const g = Math.round(g1 + (g2 - g1) * volcanoColorProgress);
            const b = Math.round(b1 + (b2 - b1) * volcanoColorProgress);
            
            const transitionColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            
            ctx.save();
            ctx.translate(volcanoVibrateOffset.x, volcanoVibrateOffset.y);
            
            const positions = volcanoLavaBlob.positions.map(([x, y]) => [x, y]);
            deps.drawSolidShape(ctx, positions, transitionColor, BLOCK_SIZE, false, deps.getFaceOpacity());
            
            ctx.restore();
        }
        
        if (volcanoPhase === 'erupting') {
            ctx.save();
            ctx.translate(volcanoVibrateOffset.x, volcanoVibrateOffset.y);
            
            if (volcanoLavaBlob) {
                const positions = volcanoLavaBlob.positions.map(([x, y]) => [x, y]);
                deps.drawSolidShape(ctx, positions, getLavaColor(), BLOCK_SIZE, false, deps.getFaceOpacity());
            }
            
            ctx.restore();
            
            volcanoProjectiles.forEach(proj => {
                if (!proj.landed) {
                    ctx.save();
                    ctx.translate(proj.x, proj.y);
                    ctx.rotate(proj.rotation);
                    
                    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, proj.size / 2);
                    gradient.addColorStop(0, '#FFFF00');
                    gradient.addColorStop(0.3, getLavaColor());
                    gradient.addColorStop(1, '#8B0000');
                    
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(0, 0, proj.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.restore();
                }
            });
        }
        
        ctx.restore();
    }
    
    function detectVolcanoes(blobs) {
        const validVolcanoes = [];
        
        for (const outerBlob of blobs) {
            for (const innerBlob of blobs) {
                if (outerBlob === innerBlob) continue;
                if (outerBlob.color === innerBlob.color) continue;
                
                const result = isBlobEnvelopedForVolcano(innerBlob, outerBlob, '');
                if (result.enveloped) {
                    validVolcanoes.push({
                        lavaBlob: innerBlob,
                        surroundingBlob: outerBlob,
                        eruptionColumn: result.eruptionColumn,
                        edgeType: result.edgeType
                    });
                }
            }
        }
        
        return validVolcanoes;
    }
    
    function isBlobEnvelopedForVolcano(innerBlob, outerBlob, edgeType) {
        const innerSet = new Set(innerBlob.positions.map(p => `${p[0]},${p[1]}`));
        const outerSet = new Set(outerBlob.positions.map(p => `${p[0]},${p[1]}`));
        
        let touchesLeft = false, touchesRight = false, touchesBottom = false;
        let eruptionColumn = -1;
        
        for (const [x, y] of innerBlob.positions) {
            if (x === 0) touchesLeft = true;
            if (x === deps.COLS - 1) touchesRight = true;
            if (y === deps.ROWS - 1) touchesBottom = true;
        }
        
        if (!touchesLeft && !touchesRight && !touchesBottom) {
            return { enveloped: false };
        }
        
        let detectedEdgeType = '';
        if (touchesBottom) detectedEdgeType = 'bottom';
        else if (touchesLeft) detectedEdgeType = 'left';
        else if (touchesRight) detectedEdgeType = 'right';
        
        const innerXs = innerBlob.positions.map(p => p[0]);
        eruptionColumn = Math.floor((Math.min(...innerXs) + Math.max(...innerXs)) / 2);
        
        for (const [x, y] of innerBlob.positions) {
            const neighbors = [
                [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
            ];
            
            for (const [nx, ny] of neighbors) {
                if (innerSet.has(`${nx},${ny}`)) continue;
                
                if (nx < 0 && touchesLeft) continue;
                if (nx >= deps.COLS && touchesRight) continue;
                if (ny >= deps.ROWS && touchesBottom) continue;
                
                if (ny < 0) continue;
                
                if (!outerSet.has(`${nx},${ny}`)) {
                    return { enveloped: false };
                }
            }
        }
        
        return { enveloped: true, eruptionColumn, edgeType: detectedEdgeType };
    }
    
    // ============================================
    // TSUNAMI SYSTEM
    // ============================================
    
    function triggerTsunamiAnimation(blob) {
        tsunamiBlob = blob;
        tsunamiBlocks = [];
        
        const allY = blob.positions.map(p => p[1]);
        const centerY = (Math.min(...allY) + Math.max(...allY)) / 2;
        const minY = Math.min(...allY);
        const maxY = Math.max(...allY);
        
        blob.positions.forEach(([x, y]) => {
            tsunamiBlocks.push({
                x: x,
                y: y,
                color: blob.color,
                originalY: y,
                currentY: y * deps.BLOCK_SIZE,
                targetY: centerY * deps.BLOCK_SIZE,
                removed: false,
                collapsing: true
            });
            deps.board[y][x] = null;
            deps.isRandomBlock[y][x] = false;
        });
        
        tsunamiPushedBlocks = [];
        for (let checkY = minY - 1; checkY >= 0; checkY--) {
            for (let checkX = 0; checkX < deps.COLS; checkX++) {
                if (deps.board[checkY][checkX] !== null) {
                    const blobAbove = deps.findBlob(checkX, checkY, deps.board[checkY][checkX]);
                    if (blobAbove) {
                        blobAbove.positions.forEach(([bx, by]) => {
                            if (!tsunamiPushedBlocks.find(b => b.x === bx && b.y === by)) {
                                tsunamiPushedBlocks.push({
                                    x: bx,
                                    y: by,
                                    color: deps.board[by][bx],
                                    currentY: by * deps.BLOCK_SIZE,
                                    originalY: by,
                                    pushAmount: 0
                                });
                            }
                        });
                    }
                }
            }
        }
        
        tsunamiActive = true;
        tsunamiAnimating = true;
        tsunamiStartTime = Date.now();
        tsunamiWobbleIntensity = 5;
        
        deps.canvas.classList.add('tsunami-active');
        deps.playEnhancedThunder(deps.soundToggle);
    }
    
    function updateTsunamiAnimation() {
        if (!tsunamiAnimating) return;
        
        const elapsed = Date.now() - tsunamiStartTime;
        const progress = Math.min(elapsed / tsunamiDuration, 1);
        
        tsunamiWobbleIntensity = 5 * (1 - progress);
        
        tsunamiBlocks.forEach(block => {
            if (block.collapsing) {
                const startY = block.originalY * deps.BLOCK_SIZE;
                const ease = 1 - Math.pow(1 - progress, 2);
                block.currentY = startY + (block.targetY - startY) * ease;
            }
        });
        
        const pushHeight = deps.BLOCK_SIZE * 0.5 * Math.sin(progress * Math.PI);
        tsunamiPushedBlocks.forEach(block => {
            block.pushAmount = pushHeight;
            block.currentY = block.originalY * deps.BLOCK_SIZE - pushHeight;
        });
        
        if (progress >= 1) {
            tsunamiAnimating = false;
            tsunamiActive = false;
            tsunamiWobbleIntensity = 0;
            deps.canvas.classList.remove('tsunami-active');
            
            createTsunamiExplosion();
            
            deps.runTwoPhaseGravity();
        }
    }
    
    function drawTsunami() {
        if (!tsunamiActive) return;
        
        const ctx = deps.ctx;
        const BLOCK_SIZE = deps.BLOCK_SIZE;
        
        ctx.save();
        
        const wobbleX = (Math.random() - 0.5) * tsunamiWobbleIntensity;
        const wobbleY = (Math.random() - 0.5) * tsunamiWobbleIntensity;
        ctx.translate(wobbleX, wobbleY);
        
        tsunamiPushedBlocks.forEach(block => {
            const positions = [[block.x, block.currentY / BLOCK_SIZE]];
            deps.drawSolidShape(ctx, positions, block.color, BLOCK_SIZE, false, deps.getFaceOpacity());
        });
        
        const positions = tsunamiBlocks.map(block => [block.x, block.currentY / BLOCK_SIZE]);
        if (positions.length > 0) {
            deps.drawSolidShape(ctx, positions, tsunamiBlob.color, BLOCK_SIZE, true, deps.getFaceOpacity());
        }
        
        ctx.restore();
    }
    
    function createTsunamiExplosion() {
        tsunamiBlocks.forEach(block => {
            const blockCenterX = block.x * deps.BLOCK_SIZE + deps.BLOCK_SIZE / 2;
            const blockCenterY = block.currentY + deps.BLOCK_SIZE / 2;
            
            const numParticles = 8 + Math.floor(Math.random() * 5);
            for (let i = 0; i < numParticles; i++) {
                const angle = (Math.PI * 2 * i / numParticles) + (Math.random() - 0.5) * 0.5;
                const speed = 2 + Math.random() * 4;
                
                disintegrationParticles.push({
                    x: blockCenterX,
                    y: blockCenterY,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: 3 + Math.random() * 3,
                    color: '#FFD700',
                    alpha: 1.0,
                    decay: 0.04,
                    gravity: 0,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() - 0.5) * 0.3
                });
            }
        });
    }
    
    function triggerTsunami(targetY) {
        const blobs = deps.getAllBlobs();
        
        for (const blob of blobs) {
            const blobYs = blob.positions.map(p => p[1]);
            if (blobYs.includes(targetY)) {
                if (blob.positions.length >= 6) {
                    triggerTsunamiAnimation(blob);
                    return true;
                }
            }
        }
        return false;
    }
    
    function triggerLightning(targetY) {
        return triggerTsunami(targetY);
    }
    
    // ============================================
    // TORNADO SYSTEM
    // ============================================
    
    function spawnTornado() {
        if (tornadoActive || !deps.getGameRunning() || deps.getPaused()) return;
        
        tornadoActive = true;
        tornadoY = 0;
        tornadoX = (Math.random() * (deps.COLS - 2) + 1) * deps.BLOCK_SIZE + deps.BLOCK_SIZE / 2;
        tornadoRotation = 0;
        tornadoState = 'descending';
        tornadoPickedBlob = null;
        tornadoParticles = [];
        tornadoDropTargetX = 0;
        tornadoLiftStartY = 0;
        tornadoBlobRotation = 0;
        tornadoVerticalRotation = 0;
        tornadoOrbitStartTime = null;
        tornadoOrbitRadius = 0;
        tornadoOrbitAngle = 0;
        tornadoLiftHeight = 0;
        tornadoDropStartY = 0;
        tornadoFadeProgress = 0;
        tornadoSnakeVelocity = 0;
        tornadoSnakeDirection = Math.random() < 0.5 ? -1 : 1;
        tornadoSnakeChangeCounter = 60 + Math.random() * 60;
        
        deps.playSoundEffect('thunder', deps.soundToggle);
        console.log('🌪️ Tornado spawned!');
    }
    
    function updateTornado() {
        if (!tornadoActive) return;
        
        const BLOCK_SIZE = deps.BLOCK_SIZE;
        const COLS = deps.COLS;
        const canvasHeight = deps.canvas.height;
        
        tornadoRotation += 0.15;
        
        // Snake movement
        tornadoSnakeChangeCounter--;
        if (tornadoSnakeChangeCounter <= 0) {
            tornadoSnakeDirection *= -1;
            tornadoSnakeChangeCounter = 60 + Math.random() * 60;
        }
        
        const targetVelocity = tornadoSnakeDirection * 1.5;
        tornadoSnakeVelocity += (targetVelocity - tornadoSnakeVelocity) * 0.05;
        tornadoX += tornadoSnakeVelocity;
        
        const minX = BLOCK_SIZE * 1.5;
        const maxX = COLS * BLOCK_SIZE - BLOCK_SIZE * 1.5;
        if (tornadoX < minX) {
            tornadoX = minX;
            tornadoSnakeDirection = 1;
        } else if (tornadoX > maxX) {
            tornadoX = maxX;
            tornadoSnakeDirection = -1;
        }
        
        // Spawn particles
        if (Math.random() < 0.3) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 20 + Math.random() * 30;
            tornadoParticles.push({
                x: tornadoX + Math.cos(angle) * radius,
                y: tornadoY + Math.random() * 100,
                angle: angle,
                radius: radius,
                speed: 0.1 + Math.random() * 0.1,
                size: 2 + Math.random() * 3,
                alpha: 0.5 + Math.random() * 0.3
            });
        }
        
        // Update particles
        for (let i = tornadoParticles.length - 1; i >= 0; i--) {
            const p = tornadoParticles[i];
            p.angle += p.speed;
            p.y -= 1;
            p.alpha -= 0.01;
            if (p.alpha <= 0 || p.y < tornadoY - 150) {
                tornadoParticles.splice(i, 1);
            }
        }
        
        switch (tornadoState) {
            case 'descending':
                tornadoY += tornadoSpeed;
                
                const gridY = Math.floor(tornadoY / BLOCK_SIZE);
                const gridX = Math.floor(tornadoX / BLOCK_SIZE);
                
                if (gridY < deps.ROWS && gridX >= 0 && gridX < COLS) {
                    for (let checkY = gridY; checkY < deps.ROWS; checkY++) {
                        if (deps.board[checkY][gridX] !== null) {
                            const blob = deps.findBlob(gridX, checkY, deps.board[checkY][gridX]);
                            if (blob && canLiftBlob(blob)) {
                                tornadoPickedBlob = blob;
                                tornadoState = 'lifting';
                                tornadoLiftStartY = tornadoY;
                                tornadoBlobRotation = 0;
                                tornadoVerticalRotation = 0;
                                tornadoOrbitStartTime = Date.now();
                                tornadoOrbitAngle = 0;
                                tornadoOrbitRadius = 10;
                                tornadoLiftHeight = 0;
                                
                                blob.positions.forEach(([x, y]) => {
                                    deps.board[y][x] = null;
                                    deps.isRandomBlock[y][x] = false;
                                });
                                
                                console.log('🌪️ Picked up blob:', blob.color, 'size:', blob.positions.length);
                                break;
                            }
                        }
                    }
                }
                
                if (tornadoY > canvasHeight) {
                    tornadoState = 'dissipating';
                    tornadoFadeProgress = 0;
                }
                break;
                
            case 'lifting':
                tornadoLiftHeight += 2;
                tornadoOrbitAngle += 0.1;
                tornadoOrbitRadius = Math.min(40, tornadoOrbitRadius + 0.5);
                tornadoBlobRotation += 0.05;
                tornadoVerticalRotation += 0.08;
                
                if (tornadoLiftHeight > 150) {
                    tornadoState = 'carrying';
                    
                    let targetCol;
                    const currentCol = Math.floor(tornadoX / BLOCK_SIZE);
                    do {
                        targetCol = Math.floor(Math.random() * COLS);
                    } while (Math.abs(targetCol - currentCol) < 2);
                    
                    tornadoDropTargetX = targetCol * BLOCK_SIZE + BLOCK_SIZE / 2;
                }
                break;
                
            case 'carrying':
                tornadoOrbitAngle += 0.1;
                tornadoBlobRotation += 0.05;
                tornadoVerticalRotation += 0.08;
                
                const dx = tornadoDropTargetX - tornadoX;
                tornadoX += dx * 0.02;
                
                if (Math.abs(dx) < 5) {
                    tornadoState = 'dropping';
                    tornadoDropStartY = tornadoY - tornadoLiftHeight;
                }
                break;
                
            case 'dropping':
                tornadoLiftHeight -= 4;
                tornadoBlobRotation *= 0.95;
                tornadoVerticalRotation *= 0.95;
                tornadoOrbitRadius *= 0.95;
                
                if (tornadoLiftHeight <= 0) {
                    const dropCol = Math.floor(tornadoX / BLOCK_SIZE);
                    dropBlobAt(tornadoPickedBlob, dropCol);
                    tornadoPickedBlob = null;
                    tornadoState = 'dissipating';
                    tornadoFadeProgress = 0;
                }
                break;
                
            case 'dissipating':
                tornadoFadeProgress += 0.02;
                if (tornadoFadeProgress >= 1) {
                    tornadoActive = false;
                    tornadoParticles = [];
                    console.log('🌪️ Tornado dissipated');
                    
                    deps.runTwoPhaseGravity();
                }
                break;
        }
    }
    
    function canLiftBlob(blob) {
        if (blob.positions.length < 3 || blob.positions.length > 12) return false;
        
        const xs = blob.positions.map(p => p[0]);
        const ys = blob.positions.map(p => p[1]);
        const width = Math.max(...xs) - Math.min(...xs) + 1;
        const height = Math.max(...ys) - Math.min(...ys) + 1;
        
        if (width > 4 || height > 4) return false;
        
        return true;
    }
    
    function dropBlobAt(blob, centerCol) {
        if (!blob) return;
        
        const xs = blob.positions.map(p => p[0]);
        const ys = blob.positions.map(p => p[1]);
        const blobMinX = Math.min(...xs);
        const blobMaxX = Math.max(...xs);
        const blobMinY = Math.min(...ys);
        const blobWidth = blobMaxX - blobMinX + 1;
        
        let targetStartCol = centerCol - Math.floor(blobWidth / 2);
        targetStartCol = Math.max(0, Math.min(deps.COLS - blobWidth, targetStartCol));
        
        const offsetX = targetStartCol - blobMinX;
        
        let highestLanding = deps.ROWS;
        for (const [x, y] of blob.positions) {
            const newX = x + offsetX;
            for (let checkY = 0; checkY < deps.ROWS; checkY++) {
                if (deps.board[checkY][newX] !== null) {
                    highestLanding = Math.min(highestLanding, checkY);
                    break;
                }
            }
        }
        
        const blobHeight = Math.max(...ys) - blobMinY + 1;
        const targetY = highestLanding - blobHeight;
        const offsetY = targetY - blobMinY;
        
        blob.positions.forEach(([x, y]) => {
            const newX = x + offsetX;
            const newY = y + offsetY;
            if (newY >= 0 && newY < deps.ROWS && newX >= 0 && newX < deps.COLS) {
                deps.board[newY][newX] = blob.color;
            }
        });
        
        console.log('🌪️ Dropped blob at column', centerCol);
    }
    
    function drawTornado() {
        if (!tornadoActive) return;
        
        const ctx = deps.ctx;
        const BLOCK_SIZE = deps.BLOCK_SIZE;
        
        ctx.save();
        
        const fadeAlpha = tornadoState === 'dissipating' ? 1 - tornadoFadeProgress : 1;
        ctx.globalAlpha = fadeAlpha;
        
        // Draw funnel
        const funnelHeight = 150;
        const topWidth = 60;
        const bottomWidth = 15;
        
        ctx.save();
        ctx.translate(tornadoX, tornadoY);
        
        for (let i = 0; i < 20; i++) {
            const y = -i * (funnelHeight / 20);
            const progress = i / 20;
            const width = bottomWidth + (topWidth - bottomWidth) * progress;
            const wobble = Math.sin(tornadoRotation + i * 0.3) * (5 + progress * 10);
            
            ctx.beginPath();
            ctx.strokeStyle = `rgba(180, 180, 180, ${0.3 - progress * 0.15})`;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.moveTo(wobble, y);
            ctx.lineTo(wobble, y - funnelHeight / 20);
            ctx.stroke();
        }
        
        // Spiral lines
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.4)';
        ctx.lineWidth = 2;
        for (let spiral = 0; spiral < 3; spiral++) {
            ctx.beginPath();
            for (let i = 0; i <= 30; i++) {
                const progress = i / 30;
                const y = -progress * funnelHeight;
                const radius = (bottomWidth / 2) + ((topWidth - bottomWidth) / 2) * progress;
                const angle = tornadoRotation + progress * Math.PI * 4 + (spiral * Math.PI * 2 / 3);
                const x = Math.cos(angle) * radius;
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Draw particles
        tornadoParticles.forEach(p => {
            const x = tornadoX + Math.cos(p.angle) * p.radius;
            ctx.fillStyle = `rgba(200, 200, 200, ${p.alpha * fadeAlpha})`;
            ctx.beginPath();
            ctx.arc(x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Draw carried blob
        if (tornadoPickedBlob && (tornadoState === 'lifting' || tornadoState === 'carrying' || tornadoState === 'dropping')) {
            ctx.save();
            
            const blobCenterY = tornadoY - tornadoLiftHeight;
            const orbitX = tornadoX + Math.cos(tornadoOrbitAngle) * tornadoOrbitRadius;
            const orbitY = blobCenterY + Math.sin(tornadoOrbitAngle) * (tornadoOrbitRadius * 0.3);
            
            ctx.translate(orbitX, orbitY);
            ctx.rotate(tornadoBlobRotation);
            
            const scale = 0.8 + Math.sin(tornadoVerticalRotation) * 0.1;
            ctx.scale(scale, 1);
            
            const xs = tornadoPickedBlob.positions.map(p => p[0]);
            const ys = tornadoPickedBlob.positions.map(p => p[1]);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
            const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
            
            const positions = tornadoPickedBlob.positions.map(([x, y]) => {
                const relX = x - centerX;
                const relY = y - centerY;
                const screenX = relX;
                const screenY = relY;
                return [screenX, screenY];
            });
            
            deps.drawSolidShape(ctx, positions, tornadoPickedBlob.color, BLOCK_SIZE, false, 0.9);
            
            ctx.restore();
        }
        
        ctx.restore();
    }
    
    // ============================================
    // EARTHQUAKE SYSTEM
    // ============================================
    
    function spawnEarthquake() {
        if (earthquakeActive || !deps.getGameRunning() || deps.getPaused()) return;
        
        let tallestRow = deps.ROWS;
        for (let y = 0; y < deps.ROWS; y++) {
            for (let x = 0; x < deps.COLS; x++) {
                if (deps.board[y][x] !== null) {
                    tallestRow = Math.min(tallestRow, y);
                    break;
                }
            }
            if (tallestRow < deps.ROWS) break;
        }
        
        if (tallestRow >= deps.ROWS - 4) {
            console.log('🚫 Not enough stack height for earthquake');
            return;
        }
        
        earthquakeActive = true;
        earthquakePhase = 'shake';
        earthquakeShakeProgress = 0;
        earthquakeShakeIntensity = 0;
        earthquakeCrack = [];
        earthquakeCrackProgress = 0;
        earthquakeCrackMap.clear();
        earthquakeShiftProgress = 0;
        earthquakeLeftBlocks = [];
        earthquakeRightBlocks = [];
        
        deps.playThunder(deps.soundToggle);
        console.log('🌍 Earthquake started!');
    }
    
    function updateEarthquake() {
        if (!earthquakeActive) return;
        
        if (earthquakePhase === 'shake') {
            earthquakeShakeProgress++;
            
            if (earthquakeShakeProgress >= 120) {
                earthquakePhase = 'crack';
                earthquakeShakeProgress = 0;
                generateEarthquakeCrack();
                deps.playThunder(deps.soundToggle);
            }
            
            earthquakeShakeIntensity = Math.sin(earthquakeShakeProgress * 0.3) * 6;
        } else if (earthquakePhase === 'crack') {
            earthquakeCrackProgress += 0.5;
            earthquakeShakeIntensity = Math.sin(Date.now() * 0.02) * 3;
            
            if (earthquakeCrackProgress >= earthquakeCrack.length) {
                earthquakePhase = 'shift';
                earthquakeShiftProgress = 0;
                splitBlocksByCrack();
                deps.playSoundEffect('thunder', deps.soundToggle);
            }
        } else if (earthquakePhase === 'shift') {
            earthquakeShiftProgress += 0.02;
            earthquakeShakeIntensity = Math.sin(Date.now() * 0.02) * (2 - earthquakeShiftProgress * 2);
            
            if (earthquakeShiftProgress >= 1) {
                applyEarthquakeShift();
                earthquakeActive = false;
                earthquakePhase = 'shake';
                earthquakeShakeIntensity = 0;
                earthquakeCrack = [];
                earthquakeCrackMap.clear();
                console.log('🌍 Earthquake finished!');
                
                deps.runTwoPhaseGravity();
            }
        }
    }
    
    function generateEarthquakeCrack() {
        earthquakeCrack = [];
        earthquakeCrackMap.clear();
        
        let currentX = Math.floor(deps.COLS / 2);
        if (Math.random() < 0.5) {
            currentX += Math.floor(Math.random() * 3) - 1;
        }
        
        for (let y = deps.ROWS - 1; y >= 0; y--) {
            earthquakeCrack.push({ x: currentX, y: y });
            earthquakeCrackMap.set(y, currentX);
            
            if (Math.random() < 0.3 && y > 0) {
                const shift = Math.random() < 0.5 ? -1 : 1;
                const newX = currentX + shift;
                if (newX >= 1 && newX < deps.COLS) {
                    currentX = newX;
                }
            }
        }
    }
    
    function splitBlocksByCrack() {
        earthquakeLeftBlocks = [];
        earthquakeRightBlocks = [];
        
        for (let y = 0; y < deps.ROWS; y++) {
            const crackX = earthquakeCrackMap.get(y) || Math.floor(deps.COLS / 2);
            
            for (let x = 0; x < deps.COLS; x++) {
                if (deps.board[y][x] !== null) {
                    const block = {
                        x: x,
                        y: y,
                        color: deps.board[y][x],
                        isRandom: deps.isRandomBlock[y][x],
                        isLattice: deps.isLattice ? deps.isLattice[y][x] : false
                    };
                    
                    if (x < crackX) {
                        earthquakeLeftBlocks.push(block);
                    } else {
                        earthquakeRightBlocks.push(block);
                    }
                }
            }
        }
    }
    
    function applyEarthquakeShift() {
        for (let y = 0; y < deps.ROWS; y++) {
            for (let x = 0; x < deps.COLS; x++) {
                deps.board[y][x] = null;
                deps.isRandomBlock[y][x] = false;
                if (deps.isLattice) deps.isLattice[y][x] = false;
            }
        }
        
        earthquakeLeftBlocks.forEach(block => {
            const newX = block.x - 1;
            if (newX >= 0 && newX < deps.COLS) {
                deps.board[block.y][newX] = block.color;
                deps.isRandomBlock[block.y][newX] = block.isRandom;
                if (deps.isLattice) deps.isLattice[block.y][newX] = block.isLattice;
            }
        });
        
        earthquakeRightBlocks.forEach(block => {
            const newX = block.x + 1;
            if (newX >= 0 && newX < deps.COLS) {
                deps.board[block.y][newX] = block.color;
                deps.isRandomBlock[block.y][newX] = block.isRandom;
                if (deps.isLattice) deps.isLattice[block.y][newX] = block.isLattice;
            }
        });
    }
    
    function drawEarthquake() {
        if (!earthquakeActive) return;
        
        const ctx = deps.ctx;
        const BLOCK_SIZE = deps.BLOCK_SIZE;
        
        ctx.save();
        
        if (earthquakePhase === 'crack' || earthquakePhase === 'shift') {
            const visibleSegments = Math.floor(earthquakeCrackProgress);
            
            if (visibleSegments > 0) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                
                for (let i = 0; i < visibleSegments && i < earthquakeCrack.length; i++) {
                    const pt = earthquakeCrack[i];
                    const crackX = pt.x * BLOCK_SIZE;
                    ctx.fillRect(crackX - 2, pt.y * BLOCK_SIZE, 4, BLOCK_SIZE);
                    
                    // Draw lava glow
                    const glowIntensity = 0.3 + Math.sin(Date.now() * 0.01 + i * 0.5) * 0.2;
                    ctx.fillStyle = `rgba(255, 100, 0, ${glowIntensity})`;
                    ctx.fillRect(crackX - 3, pt.y * BLOCK_SIZE, 6, BLOCK_SIZE);
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                }
            }
        }
        
        if (earthquakePhase === 'shift') {
            const shiftAmount = earthquakeShiftProgress * BLOCK_SIZE;
            
            ctx.save();
            ctx.translate(-shiftAmount, 0);
            earthquakeLeftBlocks.forEach(block => {
                const positions = [[block.x, block.y]];
                deps.drawSolidShape(ctx, positions, block.color, BLOCK_SIZE, false, deps.getFaceOpacity(), block.isRandom);
            });
            ctx.restore();
            
            ctx.save();
            ctx.translate(shiftAmount, 0);
            earthquakeRightBlocks.forEach(block => {
                const positions = [[block.x, block.y]];
                deps.drawSolidShape(ctx, positions, block.color, BLOCK_SIZE, false, deps.getFaceOpacity(), block.isRandom);
            });
            ctx.restore();
        }
        
        ctx.restore();
    }
    
    function isCrackBetween(x1, y1, x2, y2) {
        if (y1 !== y2) return false;
        
        const crackX = earthquakeCrackMap.get(y1);
        if (crackX === undefined) return false;
        
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        
        return crackX > minX && crackX <= maxX;
    }
    
    // ============================================
    // BLOB ANALYSIS FOR EARTHQUAKE
    // ============================================
    
    function getAllBlobsFromBoard(boardState, compoundMarkers = null) {
        const visited = new Set();
        const blobs = [];
        
        for (let y = 0; y < deps.ROWS; y++) {
            for (let x = 0; x < deps.COLS; x++) {
                const key = `${x},${y}`;
                if (visited.has(key)) continue;
                if (boardState[y][x] === null) continue;
                
                const color = boardState[y][x];
                const blob = {
                    color: color,
                    positions: [],
                    isCompound: compoundMarkers ? compoundMarkers[y][x] : false
                };
                
                const stack = [[x, y]];
                while (stack.length > 0) {
                    const [cx, cy] = stack.pop();
                    const ckey = `${cx},${cy}`;
                    
                    if (visited.has(ckey)) continue;
                    if (cx < 0 || cx >= deps.COLS || cy < 0 || cy >= deps.ROWS) continue;
                    if (boardState[cy][cx] !== color) continue;
                    
                    if (isCrackBetween(x, y, cx, cy)) continue;
                    
                    visited.add(ckey);
                    blob.positions.push([cx, cy]);
                    
                    stack.push([cx - 1, cy]);
                    stack.push([cx + 1, cy]);
                    stack.push([cx, cy - 1]);
                    stack.push([cx, cy + 1]);
                }
                
                if (blob.positions.length > 0) {
                    blobs.push(blob);
                }
            }
        }
        
        return blobs;
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    function init(dependencies) {
        Object.assign(deps, dependencies);
    }
    
    function reset() {
        // Reset all state
        tornadoActive = false;
        tornadoPickedBlob = null;
        tornadoParticles = [];
        
        earthquakeActive = false;
        earthquakePhase = 'shake';
        earthquakeCrack = [];
        earthquakeCrackMap.clear();
        earthquakeLeftBlocks = [];
        earthquakeRightBlocks = [];
        
        blackHoleActive = false;
        blackHoleAnimating = false;
        blackHoleBlocks = [];
        
        tsunamiActive = false;
        tsunamiAnimating = false;
        tsunamiBlocks = [];
        tsunamiPushedBlocks = [];
        
        volcanoActive = false;
        volcanoAnimating = false;
        volcanoProjectiles = [];
        
        disintegrationParticles = [];
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        init: init,
        reset: reset,
        
        // State getters
        isBlackHoleAnimating: () => blackHoleAnimating,
        isBlackHoleActive: () => blackHoleActive,
        isTsunamiAnimating: () => tsunamiAnimating,
        isTsunamiActive: () => tsunamiActive,
        isVolcanoAnimating: () => volcanoAnimating,
        isVolcanoActive: () => volcanoActive,
        isTornadoActive: () => tornadoActive,
        isEarthquakeActive: () => earthquakeActive,
        getEarthquakePhase: () => earthquakePhase,
        getBlackHoleShakeIntensity: () => blackHoleShakeIntensity,
        getTsunamiWobbleIntensity: () => tsunamiWobbleIntensity,
        getEarthquakeShakeIntensity: () => earthquakeShakeIntensity,
        getVolcanoVibrateOffset: () => volcanoVibrateOffset,
        getVolcanoLavaColor: () => volcanoLavaColor,
        getLavaColor: getLavaColor,
        
        // Black hole state for external rendering
        getBlackHoleInnerBlob: () => blackHoleInnerBlob,
        getBlackHoleCenterX: () => blackHoleCenterX,
        getBlackHoleCenterY: () => blackHoleCenterY,
        getBlackHoleStartTime: () => blackHoleStartTime,
        
        // Black Hole
        triggerBlackHole: triggerBlackHole,
        updateBlackHoleAnimation: updateBlackHoleAnimation,
        drawBlackHole: drawBlackHole,
        
        // Disintegration particles
        updateDisintegrationParticles: updateDisintegrationParticles,
        drawDisintegrationParticles: drawDisintegrationParticles,
        
        // Volcano
        triggerVolcano: triggerVolcano,
        updateVolcanoAnimation: updateVolcanoAnimation,
        drawVolcano: drawVolcano,
        detectVolcanoes: detectVolcanoes,
        
        // Tsunami
        triggerTsunamiAnimation: triggerTsunamiAnimation,
        updateTsunamiAnimation: updateTsunamiAnimation,
        drawTsunami: drawTsunami,
        triggerTsunami: triggerTsunami,
        triggerLightning: triggerLightning,
        
        // Tornado
        spawnTornado: spawnTornado,
        updateTornado: updateTornado,
        drawTornado: drawTornado,
        
        // Earthquake
        spawnEarthquake: spawnEarthquake,
        updateEarthquake: updateEarthquake,
        drawEarthquake: drawEarthquake,
        getAllBlobsFromBoard: getAllBlobsFromBoard,
        isCrackBetween: isCrackBetween
    };
})();

// Export for use as module
if (typeof window !== 'undefined') {
    window.SpecialEffects = SpecialEffects;
}
