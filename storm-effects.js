// Storm Particle System Module for BLOCKCHaiNSTORM
// Handles all weather visual effects: rain, hail, snow, hurricane winds, and challenge liquids
// This is purely cosmetic - can be toggled off without affecting gameplay

const StormEffects = (() => {
    // Particle arrays
    let stormParticles = [];
    let splashParticles = [];
    let liquidPools = []; // For Carrie/No Kings modes
    const MAX_STORM_PARTICLES = 800;
    
    // Pre-rendered snowflake bitmaps for blizzard mode
    let snowflakeBitmaps = [];
    
    // References to game state (set via init/updateGameState)
    let canvas = null;
    let ctx = null;
    let board = null;
    let stormEffectsToggle = null;
    let gameMode = null;
    let challengeMode = null;
    let activeChallenges = null;
    let soRandomCurrentMode = null;
    let gameRunning = false;
    let paused = false;
    let BLOCK_SIZE = 35;
    let ROWS = 20;
    let COLS = 10;
    
    /**
     * Initialize the storm effects system
     */
    function init(config) {
        canvas = config.canvas;
        ctx = config.ctx;
        board = config.board;
        stormEffectsToggle = config.stormEffectsToggle;
        
        // Create pre-rendered snowflake bitmaps
        createSnowflakeBitmaps();
        
        console.log('🌧️ Storm Effects module initialized');
    }
    
    /**
     * Update game state references (call when state changes)
     */
    function updateGameState(state) {
        if (state.gameMode !== undefined) gameMode = state.gameMode;
        if (state.challengeMode !== undefined) challengeMode = state.challengeMode;
        if (state.activeChallenges !== undefined) activeChallenges = state.activeChallenges;
        if (state.soRandomCurrentMode !== undefined) soRandomCurrentMode = state.soRandomCurrentMode;
        if (state.gameRunning !== undefined) gameRunning = state.gameRunning;
        if (state.paused !== undefined) paused = state.paused;
        if (state.BLOCK_SIZE !== undefined) BLOCK_SIZE = state.BLOCK_SIZE;
        if (state.ROWS !== undefined) ROWS = state.ROWS;
        if (state.COLS !== undefined) COLS = state.COLS;
        if (state.board !== undefined) board = state.board;
    }
    
    /**
     * Create pre-rendered snowflake bitmaps for blizzard mode performance
     */
    function createSnowflakeBitmaps() {
        snowflakeBitmaps = [];
        const sizes = [5, 7.5, 10];
        const blurLevels = [1, 1.5, 2];
        
        sizes.forEach(size => {
            blurLevels.forEach(blur => {
                const tempCanvas = document.createElement('canvas');
                const tempSize = size + blur * 4;
                tempCanvas.width = tempSize;
                tempCanvas.height = tempSize;
                const tempCtx = tempCanvas.getContext('2d');
                
                tempCtx.filter = `blur(${blur}px)`;
                tempCtx.save();
                tempCtx.translate(tempSize / 2, tempSize / 2);
                tempCtx.strokeStyle = 'rgba(240, 248, 255, 1)';
                tempCtx.lineWidth = 1.5;
                tempCtx.lineCap = 'round';
                
                for (let i = 0; i < 6; i++) {
                    tempCtx.save();
                    tempCtx.rotate((Math.PI / 3) * i);
                    tempCtx.beginPath();
                    tempCtx.moveTo(0, 0);
                    tempCtx.lineTo(size / 2, 0);
                    tempCtx.stroke();
                    tempCtx.restore();
                }
                tempCtx.restore();
                
                snowflakeBitmaps.push({
                    canvas: tempCanvas,
                    size: tempSize
                });
            });
        });
    }
    
    /**
     * Check if Carrie mode is active
     */
    function isCarrieMode() {
        return challengeMode === 'carrie' || 
               (activeChallenges && activeChallenges.has('carrie')) || 
               soRandomCurrentMode === 'carrie';
    }
    
    /**
     * Check if No Kings mode is active
     */
    function isNoKingsMode() {
        return challengeMode === 'nokings' || 
               (activeChallenges && activeChallenges.has('nokings')) || 
               soRandomCurrentMode === 'nokings';
    }
    
    /**
     * Create a new storm particle based on current game mode
     */
    function createStormParticle() {
        const particle = {
            x: Math.random() * canvas.width,
            y: -10,
            vx: 0,
            vy: 0,
            size: 2,
            opacity: 0.7,
            type: 'rain',
            rotation: 0,
            rotationSpeed: 0,
            color: 'rgba(255, 255, 255, 0.7)'
        };
        
        // Check for special challenge modes first
        const carrieActive = isCarrieMode();
        const noKingsActive = isNoKingsMode();
        
        if (carrieActive || noKingsActive) {
            particle.type = 'liquid';
            particle.vx = 0;
            particle.vy = Math.random() * 6 + 8;
            particle.size = Math.random() * 4 + 4;
            particle.opacity = Math.random() * 0.3 + 0.5;
            
            if (carrieActive && noKingsActive) {
                particle.liquidType = Math.random() < 0.5 ? 'blood' : 'brown';
                particle.color = particle.liquidType === 'blood' ? 
                    'rgba(180, 0, 0, 0.9)' : 'rgba(101, 67, 33, 0.9)';
            } else if (carrieActive) {
                particle.liquidType = 'blood';
                particle.color = 'rgba(180, 0, 0, 0.9)';
            } else {
                particle.liquidType = 'brown';
                particle.color = 'rgba(101, 67, 33, 0.9)';
            }
            return particle;
        }
        
        // Configure based on game mode
        if (!gameMode || gameMode === 'drizzle') {
            particle.type = 'rain';
            particle.vx = 0;
            particle.vy = Math.random() * 3 + 5;
            particle.size = Math.random() * 1 + 1;
            particle.opacity = Math.random() * 0.3 + 0.2;
            particle.color = `rgba(180, 200, 255, ${particle.opacity})`;
        } else if (gameMode === 'downpour') {
            particle.type = 'rain';
            particle.vx = 0;
            particle.vy = Math.random() * 6 + 12;
            particle.size = Math.random() * 1.5 + 1.5;
            particle.opacity = Math.random() * 0.4 + 0.3;
            particle.color = `rgba(180, 200, 255, ${particle.opacity})`;
        } else if (gameMode === 'hailstorm') {
            particle.type = 'hail';
            particle.vx = 0;
            particle.vy = Math.random() * 6 + 12;
            particle.size = Math.random() * 3 + 3;
            particle.opacity = Math.random() * 0.3 + 0.5;
            particle.rotation = Math.random() * Math.PI * 2;
            particle.rotationSpeed = (Math.random() - 0.5) * 0.3;
            particle.color = `rgba(200, 230, 255, ${particle.opacity})`;
        } else if (gameMode === 'blizzard') {
            particle.type = 'blizzard';
            particle.snowflakeBitmap = snowflakeBitmaps[Math.floor(Math.random() * snowflakeBitmaps.length)];
            
            if (Math.random() < 0.7) {
                particle.x = -20;
                particle.y = Math.random() * canvas.height;
            } else {
                particle.x = Math.random() * canvas.width;
                particle.y = -20;
            }
            
            particle.vx = Math.random() * 7 + 9;
            particle.vy = Math.random() * 4 + 2;
            particle.size = Math.random() * 3.5 + 1.5;
            particle.opacity = Math.random() * 0.6 + 0.4;
            particle.rotation = Math.random() * Math.PI * 2;
            particle.rotationSpeed = (Math.random() - 0.5) * 0.12;
            particle.color = `rgba(240, 248, 255, ${particle.opacity})`;
        } else if (gameMode === 'hurricane') {
            particle.type = 'hurricane';
            
            if (Math.random() < 0.8) {
                particle.x = -20;
                particle.y = Math.random() * canvas.height;
            } else {
                particle.x = Math.random() * (canvas.width * 0.3);
                particle.y = -20;
            }
            
            particle.vx = Math.random() * 16 + 28;
            particle.vy = Math.random() * 1 + 0.5;
            particle.size = Math.random() * 2.5 + 1.5;
            particle.opacity = Math.random() * 0.5 + 0.4;
            particle.color = `rgba(220, 240, 255, ${particle.opacity})`;
        }
        
        return particle;
    }
    
    /**
     * Create splash particles when rain hits blocks
     */
    function createSplash(x, y, size) {
        const numDroplets = Math.floor(Math.random() * 3) + 3;
        for (let i = 0; i < numDroplets; i++) {
            const angle = Math.random() * Math.PI - Math.PI / 2;
            const speed = Math.random() * 2 + 1;
            splashParticles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                gravity: 0.2,
                size: size * 0.5,
                opacity: 0.6,
                life: 15,
                maxLife: 15
            });
        }
    }
    
    /**
     * Check collision with blocks or bottom of well
     */
    function checkCollisionWithBlocks(x, y) {
        const gridX = Math.floor(x / BLOCK_SIZE);
        const gridY = Math.floor(y / BLOCK_SIZE);
        
        if (y >= canvas.height) {
            return { collision: true, y: canvas.height };
        }
        
        const nextGridY = Math.floor((y + BLOCK_SIZE * 0.1) / BLOCK_SIZE);
        if (nextGridY >= 0 && nextGridY < ROWS && gridX >= 0 && gridX < COLS) {
            if (board && board[nextGridY] && board[nextGridY][gridX]) {
                return { collision: true, y: nextGridY * BLOCK_SIZE };
            }
        }
        
        return { collision: false };
    }
    
    /**
     * Create bouncing hail particle
     */
    function createHailBounce(x, y, size, vy) {
        return {
            x: x,
            y: y,
            vx: 0,
            vy: -Math.abs(vy) * 0.5,
            gravity: 0.3,
            size: size,
            opacity: 0.7,
            bounces: 0,
            maxBounces: 2,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.15,
            type: 'bouncing',
            life: 60,
            color: `rgba(220, 240, 255, 0.8)`
        };
    }
    
    /**
     * Create liquid drip pool when blood/brown liquid hits blocks
     */
    function createLiquidDrip(x, y, liquidType, color) {
        const blockX = Math.floor(x / BLOCK_SIZE);
        if (blockX < 0 || blockX >= COLS) return;
        
        let topBlockY = -1;
        for (let checkY = 0; checkY < ROWS; checkY++) {
            if (board && board[checkY] && board[checkY][blockX]) {
                topBlockY = checkY;
                break;
            }
        }
        
        if (topBlockY === -1) return;
        
        const blockCenterX = blockX * BLOCK_SIZE + BLOCK_SIZE / 2;
        const blockTopY = topBlockY * BLOCK_SIZE;
        
        for (let pool of liquidPools) {
            if (pool.blockX === blockX && pool.blockY === topBlockY) {
                pool.volume += 0.8;
                pool.opacity = Math.min(1.0, pool.opacity + 0.05);
                return;
            }
        }
        
        const maxPools = 30;
        if (liquidPools.length < maxPools) {
            const poolColor = liquidType === 'blood' ? 'rgba(150, 0, 0, 0.9)' : 'rgba(80, 50, 25, 0.9)';
            liquidPools.push({
                x: blockCenterX,
                y: blockTopY,
                blockX: blockX,
                blockY: topBlockY,
                volume: 1.5,
                dripping: false,
                dripStreaks: [],
                liquidType: liquidType,
                color: poolColor,
                opacity: 0.9,
                age: 0
            });
        }
    }
    
    /**
     * Update liquid pools after gravity moves blocks
     */
    function updateLiquidPoolsAfterGravity() {
        liquidPools = liquidPools.filter(pool => {
            if (!board || !board[pool.blockY] || !board[pool.blockY][pool.blockX]) {
                return false;
            }
            return true;
        });
    }
    
    /**
     * Update dripping liquid pools animation
     */
    function updateDrippingLiquids() {
        liquidPools = liquidPools.filter(pool => {
            pool.age++;
            
            if (!pool.dripping) {
                pool.volume -= 0.015;
                pool.opacity = Math.max(0, pool.opacity - 0.0003);
            }
            
            if (pool.volume > 3) {
                pool.dripping = true;
                
                if (pool.dripStreaks.length === 0) {
                    const numStreaks = Math.min(5, Math.floor(pool.volume / 4) + 2);
                    for (let i = 0; i < numStreaks; i++) {
                        const spacing = BLOCK_SIZE / (numStreaks + 1);
                        pool.dripStreaks.push({
                            offsetX: -BLOCK_SIZE/2 + spacing * (i + 1),
                            y: pool.y + 5,
                            width: Math.random() * 8 + 6,
                            speed: Math.random() * 0.4 + 0.5,
                            wobble: Math.random() * Math.PI
                        });
                    }
                }
            }
            
            if (pool.dripping) {
                pool.dripStreaks.forEach(streak => {
                    streak.y += streak.speed;
                    streak.wobble += 0.02;
                    
                    if (streak.y > canvas.height) {
                        streak.y = pool.y + 5;
                    }
                });
                
                pool.volume -= 0.008;
                
                if (pool.volume < 1) {
                    pool.dripping = false;
                    pool.dripStreaks = [];
                }
            }
            
            return pool.volume > 0 && pool.opacity > 0;
        });
    }
    
    /**
     * Draw dripping liquid pools
     */
    function drawDrippingLiquids() {
        if (liquidPools.length === 0) return;
        
        ctx.save();
        
        liquidPools.forEach(pool => {
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = pool.color;
            
            const poolWidth = Math.min(BLOCK_SIZE, Math.sqrt(pool.volume) * 7);
            const poolHeight = Math.min(10, Math.sqrt(pool.volume) * 2.5);
            
            ctx.beginPath();
            ctx.moveTo(pool.x - poolWidth/2, pool.y);
            const wave1 = Math.sin(pool.age * 0.03) * 2;
            const wave2 = Math.cos(pool.age * 0.04) * 1.5;
            
            ctx.quadraticCurveTo(
                pool.x - poolWidth/4, pool.y - wave1,
                pool.x, pool.y - poolHeight/2
            );
            ctx.quadraticCurveTo(
                pool.x + poolWidth/4, pool.y - wave2,
                pool.x + poolWidth/2, pool.y
            );
            ctx.lineTo(pool.x + poolWidth/2, pool.y + poolHeight/2);
            ctx.quadraticCurveTo(
                pool.x, pool.y + poolHeight,
                pool.x - poolWidth/2, pool.y + poolHeight/2
            );
            ctx.closePath();
            ctx.fill();
            
            if (pool.dripping && pool.dripStreaks.length > 0) {
                pool.dripStreaks.forEach(streak => {
                    ctx.globalAlpha = 0.9;
                    ctx.fillStyle = pool.color;
                    
                    const wobbleX = Math.sin(streak.wobble) * 2;
                    const dropWidth = streak.width * 0.6 * 1.5;
                    const dropHeight = streak.width * 1.2 * 1.5;
                    const streamStartWidth = streak.width;
                    const streamEndWidth = dropWidth * 0.4;
                    const streamLength = streak.y - pool.y;
                    
                    ctx.beginPath();
                    ctx.moveTo(pool.x + streak.offsetX - streamStartWidth/2, pool.y);
                    
                    const segments = Math.max(5, Math.floor(streamLength / 15));
                    for (let i = 1; i <= segments; i++) {
                        const progress = i / segments;
                        const segY = pool.y + streamLength * progress;
                        const currentWidth = streamStartWidth + (streamEndWidth - streamStartWidth) * progress;
                        const wave = Math.sin(i * 0.5 + streak.wobble) * 2;
                        ctx.lineTo(pool.x + streak.offsetX - currentWidth/2 + wave + wobbleX, segY);
                    }
                    
                    ctx.lineTo(pool.x + streak.offsetX + wobbleX, streak.y);
                    
                    for (let i = segments; i >= 0; i--) {
                        const progress = i / segments;
                        const segY = pool.y + streamLength * progress;
                        const currentWidth = streamStartWidth + (streamEndWidth - streamStartWidth) * progress;
                        const wave = Math.sin(i * 0.5 + streak.wobble + Math.PI) * 2;
                        ctx.lineTo(pool.x + streak.offsetX + currentWidth/2 + wave + wobbleX, segY);
                    }
                    
                    ctx.closePath();
                    ctx.fill();
                    
                    // Draw teardrop
                    const dropCenterX = pool.x + streak.offsetX + wobbleX;
                    const dropTopY = streak.y - (dropHeight / 3);
                    const dropBottomY = dropTopY + dropHeight * 0.7;
                    
                    ctx.beginPath();
                    ctx.moveTo(dropCenterX, dropTopY);
                    ctx.bezierCurveTo(
                        dropCenterX + dropWidth * 0.15, dropTopY + dropHeight * 0.15,
                        dropCenterX + dropWidth * 0.5, dropTopY + dropHeight * 0.5,
                        dropCenterX, dropBottomY
                    );
                    ctx.bezierCurveTo(
                        dropCenterX - dropWidth * 0.5, dropTopY + dropHeight * 0.5,
                        dropCenterX - dropWidth * 0.15, dropTopY + dropHeight * 0.15,
                        dropCenterX, dropTopY
                    );
                    ctx.closePath();
                    ctx.fill();
                });
            }
        });
        
        ctx.restore();
    }
    
    /**
     * Adjust liquid pools when lines are cleared
     */
    function adjustPoolsForClearedRows(sortedRows) {
        // Remove pools on cleared rows
        liquidPools = liquidPools.filter(pool => {
            return !sortedRows.includes(pool.blockY);
        });
        
        // Shift down pools above cleared rows
        liquidPools.forEach(pool => {
            const rowsBelowPool = sortedRows.filter(row => row > pool.blockY).length;
            if (rowsBelowPool > 0) {
                const shiftAmount = rowsBelowPool * BLOCK_SIZE;
                pool.blockY += rowsBelowPool;
                pool.y = pool.blockY * BLOCK_SIZE;
                
                pool.dripStreaks.forEach(streak => {
                    streak.y += shiftAmount;
                });
            }
        });
    }
    
    /**
     * Main update function - call every frame
     */
    function update() {
        if (!stormEffectsToggle || !stormEffectsToggle.checked) {
            stormParticles = [];
            splashParticles = [];
            return;
        }
        
        // Spawn new particles
        if (stormParticles.length < MAX_STORM_PARTICLES && gameRunning && !paused) {
            const carrieActive = isCarrieMode();
            const noKingsActive = isNoKingsMode();
            
            let spawnChance = 0.3;
            
            if (carrieActive || noKingsActive) {
                spawnChance = 1.6;
                if (carrieActive && noKingsActive) {
                    spawnChance = 3.2;
                }
            } else if (gameMode === 'downpour') {
                spawnChance = 2.0;
            } else if (gameMode === 'hailstorm') {
                spawnChance = 0.4;
            } else if (gameMode === 'blizzard') {
                spawnChance = 19.2;
            } else if (gameMode === 'hurricane') {
                spawnChance = 30.0;
            }
            
            const numToSpawn = Math.floor(spawnChance);
            const fractionalChance = spawnChance - numToSpawn;
            
            for (let i = 0; i < numToSpawn; i++) {
                stormParticles.push(createStormParticle());
            }
            
            if (Math.random() < fractionalChance) {
                stormParticles.push(createStormParticle());
            }
        }
        
        // Update particles
        stormParticles = stormParticles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            if (particle.type === 'hail' || particle.type === 'blizzard') {
                particle.rotation += particle.rotationSpeed;
            }
            
            // Rain splash in downpour
            if (particle.type === 'rain' && gameMode === 'downpour') {
                const collision = checkCollisionWithBlocks(particle.x, particle.y);
                if (collision.collision) {
                    createSplash(particle.x, collision.y, particle.size);
                    return false;
                }
            }
            
            // Hail bounce
            if (particle.type === 'hail') {
                const collision = checkCollisionWithBlocks(particle.x, particle.y);
                if (collision.collision) {
                    splashParticles.push(createHailBounce(particle.x, collision.y, particle.size, particle.vy));
                    return false;
                }
            }
            
            // Liquid drip
            if (particle.type === 'liquid') {
                const collision = checkCollisionWithBlocks(particle.x, particle.y);
                if (collision.collision) {
                    createLiquidDrip(particle.x, collision.y, particle.liquidType, particle.color);
                    return false;
                }
            }
            
            return particle.y < canvas.height + 20 && particle.x > -20 && particle.x < canvas.width + 20;
        });
        
        // Update splash/bounce particles
        splashParticles = splashParticles.filter(splash => {
            splash.x += splash.vx;
            splash.y += splash.vy;
            splash.vy += splash.gravity;
            
            if (splash.type === 'bouncing') {
                splash.rotation += splash.rotationSpeed;
                splash.life--;
                
                if (splash.vy > 0) {
                    const collision = checkCollisionWithBlocks(splash.x, splash.y);
                    if (collision.collision && splash.bounces < splash.maxBounces) {
                        splash.vy = -Math.abs(splash.vy) * 0.4;
                        splash.y = collision.y;
                        splash.bounces++;
                    }
                }
                
                return splash.life > 0 && splash.y < canvas.height + 20;
            } else {
                splash.life--;
                splash.opacity = (splash.life / splash.maxLife) * 0.6;
                return splash.life > 0;
            }
        });
        
        // Update liquid pools
        updateDrippingLiquids();
    }
    
    /**
     * Main draw function - call every frame after update
     * Draws storm particles (rain, hail, snow, wind) BEHIND gameplay
     * Note: Call drawLiquidsOnTop() separately AFTER drawing game elements
     */
    function draw() {
        if (!stormEffectsToggle || !stormEffectsToggle.checked) return;
        
        // Storm particles only - dripping liquids drawn separately via drawLiquidsOnTop()
        if (stormParticles.length === 0 && splashParticles.length === 0) return;
        
        ctx.save();
        
        // Draw storm particles
        stormParticles.forEach(particle => {
            ctx.globalAlpha = particle.opacity;
            
            if (particle.type === 'rain') {
                ctx.strokeStyle = particle.color;
                ctx.lineWidth = particle.size;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(particle.x, particle.y);
                ctx.lineTo(particle.x, particle.y - particle.vy * 2);
                ctx.stroke();
            } else if (particle.type === 'liquid') {
                ctx.fillStyle = particle.color;
                ctx.save();
                ctx.translate(particle.x, particle.y);
                
                ctx.beginPath();
                ctx.moveTo(0, -particle.size * 1.5);
                ctx.quadraticCurveTo(-particle.size * 0.7, 0, 0, particle.size);
                ctx.quadraticCurveTo(particle.size * 0.7, 0, 0, -particle.size * 1.5);
                ctx.fill();
                
                ctx.globalAlpha = particle.opacity * 0.3;
                ctx.strokeStyle = particle.color;
                ctx.lineWidth = particle.size * 0.5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(0, -particle.size * 1.5);
                ctx.lineTo(0, -particle.size * 1.5 - particle.vy * 2);
                ctx.stroke();
                
                ctx.restore();
            } else if (particle.type === 'hail') {
                ctx.save();
                ctx.translate(particle.x, particle.y);
                ctx.rotate(particle.rotation);
                
                ctx.fillStyle = particle.color;
                ctx.strokeStyle = `rgba(255, 255, 255, ${particle.opacity})`;
                ctx.lineWidth = 1;
                
                const sides = 5 + Math.floor(Math.random() * 3);
                ctx.beginPath();
                for (let i = 0; i < sides; i++) {
                    const angle = (Math.PI * 2 / sides) * i;
                    const radius = particle.size * (0.8 + Math.random() * 0.4);
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity * 0.5})`;
                ctx.beginPath();
                ctx.arc(-particle.size * 0.2, -particle.size * 0.2, particle.size * 0.3, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            } else if (particle.type === 'blizzard') {
                if (!particle.snowflakeBitmap) return;
                
                ctx.save();
                const opacity = (typeof particle.opacity === 'number' && !isNaN(particle.opacity)) ? particle.opacity : 1;
                ctx.globalAlpha = opacity;
                ctx.translate(particle.x, particle.y);
                ctx.rotate(particle.rotation);
                
                const bitmap = particle.snowflakeBitmap;
                ctx.drawImage(
                    bitmap.canvas,
                    -bitmap.size / 2,
                    -bitmap.size / 2,
                    bitmap.size,
                    bitmap.size
                );
                
                ctx.restore();
            } else if (particle.type === 'hurricane') {
                ctx.strokeStyle = particle.color;
                ctx.lineWidth = particle.size;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(particle.x, particle.y);
                ctx.lineTo(particle.x - particle.vx * 3, particle.y - particle.vy * 0.5);
                ctx.stroke();
            }
        });
        
        // Draw splash/bounce particles
        splashParticles.forEach(splash => {
            ctx.globalAlpha = splash.opacity;
            
            if (splash.type === 'bouncing') {
                ctx.save();
                ctx.translate(splash.x, splash.y);
                ctx.rotate(splash.rotation);
                
                ctx.fillStyle = splash.color;
                ctx.strokeStyle = `rgba(255, 255, 255, ${splash.opacity})`;
                ctx.lineWidth = 1;
                
                const sides = 5 + Math.floor(Math.random() * 3);
                ctx.beginPath();
                for (let i = 0; i < sides; i++) {
                    const angle = (Math.PI * 2 / sides) * i;
                    const radius = splash.size * (0.8 + Math.random() * 0.4);
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                ctx.fillStyle = `rgba(255, 255, 255, ${splash.opacity * 0.5})`;
                ctx.beginPath();
                ctx.arc(-splash.size * 0.2, -splash.size * 0.2, splash.size * 0.3, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            } else {
                ctx.fillStyle = 'rgba(180, 220, 255, 1)';
                ctx.beginPath();
                ctx.arc(splash.x, splash.y, splash.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        ctx.restore();
    }
    
    /**
     * Reset all storm effects (call on game start/end)
     */
    function reset() {
        stormParticles = [];
        splashParticles = [];
        liquidPools = [];
    }
    
    /**
     * Draw dripping liquids ON TOP of game elements
     * Call this AFTER drawing the game board and pieces
     */
    function drawLiquidsOnTop() {
        drawDrippingLiquids();
    }
    
    /**
     * Get current particle counts (for debugging)
     */
    function getStats() {
        return {
            stormParticles: stormParticles.length,
            splashParticles: splashParticles.length,
            liquidPools: liquidPools.length
        };
    }
    
    // Public API
    return {
        init,
        updateGameState,
        update,
        draw,
        drawLiquidsOnTop,
        reset,
        adjustPoolsForClearedRows,
        updateLiquidPoolsAfterGravity,
        getStats
    };
})();

// Export for use in game.js
if (typeof window !== 'undefined') {
    window.StormEffects = StormEffects;
}
