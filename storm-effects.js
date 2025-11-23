// Storm Particle System Module
// Handles weather effects for different game modes

const StormEffects = (() => {
    // Storm particle arrays
    let stormParticles = [];
    let splashParticles = [];
    const MAX_STORM_PARTICLES = 800;
    
    // Settings reference (will be set by init)
    let stormEffectsToggle = null;
    let soundToggle = null;
    let audioContext = null;
    let gameMode = null;
    let gameRunning = false;
    let paused = false;
    let canvas = null;
    let ctx = null;
    let BLOCK_SIZE = 35;
    let ROWS = 20;
    let COLS = 10;
    let board = null;
    let isRandomBlock = null;
    
    function init(config) {
        stormEffectsToggle = config.stormEffectsToggle;
        soundToggle = config.soundToggle;
        audioContext = config.audioContext;
        canvas = config.canvas;
        ctx = config.ctx;
        board = config.board;
        isRandomBlock = config.isRandomBlock;
    }
    
    function updateGameState(state) {
        gameMode = state.gameMode;
        gameRunning = state.gameRunning;
        paused = state.paused;
        BLOCK_SIZE = state.BLOCK_SIZE;
        ROWS = state.ROWS;
        COLS = state.COLS;
    }
    
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
    
    function checkCollisionWithBlocks(x, y) {
        const gridX = Math.floor(x / BLOCK_SIZE);
        const gridY = Math.floor(y / BLOCK_SIZE);
        
        if (y >= canvas.height) {
            return { collision: true, y: canvas.height };
        }
        
        const nextGridY = Math.floor((y + BLOCK_SIZE * 0.1) / BLOCK_SIZE);
        if (nextGridY >= 0 && nextGridY < ROWS && gridX >= 0 && gridX < COLS) {
            if (board[nextGridY] && board[nextGridY][gridX]) {
                return { collision: true, y: nextGridY * BLOCK_SIZE };
            }
        }
        
        return { collision: false };
    }
    
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
    
    function playBloopSound() {
        if (!soundToggle.checked) return;
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.15);
        
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
    }
    
    function update() {
        if (!stormEffectsToggle.checked) {
            stormParticles = [];
            splashParticles = [];
            return;
        }
        
        if (stormParticles.length < MAX_STORM_PARTICLES && gameRunning && !paused) {
            let spawnChance = 0.3;
            if (gameMode === 'downpour') spawnChance = 2.0;
            else if (gameMode === 'hailstorm') spawnChance = 0.4;
            else if (gameMode === 'blizzard') spawnChance = 19.2;
            else if (gameMode === 'hurricane') spawnChance = 30.0;
            
            const numToSpawn = Math.floor(spawnChance);
            const fractionalChance = spawnChance - numToSpawn;
            
            for (let i = 0; i < numToSpawn; i++) {
                stormParticles.push(createStormParticle());
            }
            
            if (Math.random() < fractionalChance) {
                stormParticles.push(createStormParticle());
            }
        }
        
        stormParticles = stormParticles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            if (particle.type === 'hail' || particle.type === 'blizzard') {
                particle.rotation += particle.rotationSpeed;
            }
            
            if (particle.type === 'rain' && gameMode === 'downpour') {
                const collision = checkCollisionWithBlocks(particle.x, particle.y);
                if (collision.collision) {
                    createSplash(particle.x, collision.y, particle.size);
                    return false;
                }
            }
            
            if (particle.type === 'hail') {
                const collision = checkCollisionWithBlocks(particle.x, particle.y);
                if (collision.collision) {
                    splashParticles.push(createHailBounce(particle.x, collision.y, particle.size, particle.vy));
                    return false;
                }
            }
            
            return particle.y < canvas.height + 20 && particle.x > -20 && particle.x < canvas.width + 20;
        });
        
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
    }
    
    function draw() {
        if (!stormEffectsToggle.checked || (stormParticles.length === 0 && splashParticles.length === 0)) return;
        
        ctx.save();
        
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
                ctx.save();
                ctx.translate(particle.x, particle.y);
                ctx.rotate(particle.rotation);
                
                ctx.strokeStyle = particle.color;
                ctx.lineWidth = 1.5;
                ctx.lineCap = 'round';
                
                for (let i = 0; i < 6; i++) {
                    ctx.save();
                    ctx.rotate((Math.PI / 3) * i);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(particle.size * 1.5, 0);
                    ctx.stroke();
                    ctx.restore();
                }
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
    
    function reset() {
        stormParticles = [];
        splashParticles = [];
    }
    
    return {
        init,
        updateGameState,
        update,
        draw,
        reset
    };
})();
