// Storm Effects System
const StormEffects = {
    createStormParticle() {
        const canvas = document.getElementById('gameCanvas');
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
        
        if (!GameState.gameMode || GameState.gameMode === 'drizzle') {
            particle.type = 'rain';
            particle.vx = 0;
            particle.vy = Math.random() * 3 + 5;
            particle.size = Math.random() * 1 + 1;
            particle.opacity = Math.random() * 0.3 + 0.2;
            particle.color = `rgba(180, 200, 255, ${particle.opacity})`;
        } else if (GameState.gameMode === 'downpour') {
            particle.type = 'rain';
            particle.vx = 0;
            particle.vy = Math.random() * 6 + 12;
            particle.size = Math.random() * 1.5 + 1.5;
            particle.opacity = Math.random() * 0.4 + 0.3;
            particle.color = `rgba(180, 200, 255, ${particle.opacity})`;
        } else if (GameState.gameMode === 'hailstorm') {
            particle.type = 'hail';
            particle.vx = 0;
            particle.vy = Math.random() * 6 + 12;
            particle.size = Math.random() * 3 + 3;
            particle.opacity = Math.random() * 0.3 + 0.5;
            particle.rotation = Math.random() * Math.PI * 2;
            particle.rotationSpeed = (Math.random() - 0.5) * 0.3;
            particle.color = `rgba(200, 230, 255, ${particle.opacity})`;
        } else if (GameState.gameMode === 'blizzard') {
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
        } else if (GameState.gameMode === 'hurricane') {
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
    },
    
    createSplash(x, y, size) {
        const numDroplets = Math.floor(Math.random() * 3) + 3;
        for (let i = 0; i < numDroplets; i++) {
            const angle = Math.random() * Math.PI - Math.PI / 2;
            const speed = Math.random() * 2 + 1;
            GameState.splashParticles.push({
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
    },
    
    checkCollisionWithBlocks(x, y) {
        const canvas = document.getElementById('gameCanvas');
        const gridX = Math.floor(x / GameState.BLOCK_SIZE);
        const gridY = Math.floor(y / GameState.BLOCK_SIZE);
        
        if (y >= canvas.height) {
            return { collision: true, y: canvas.height };
        }
        
        const nextGridY = Math.floor((y + GameState.BLOCK_SIZE * 0.1) / GameState.BLOCK_SIZE);
        if (nextGridY >= 0 && nextGridY < GameState.ROWS && gridX >= 0 && gridX < GameState.COLS) {
            if (GameState.board[nextGridY] && GameState.board[nextGridY][gridX]) {
                return { collision: true, y: nextGridY * GameState.BLOCK_SIZE };
            }
        }
        
        return { collision: false };
    },
    
    createHailBounce(x, y, size, vy) {
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
    },
    
    updateStormParticles() {
        const stormEffectsToggle = document.getElementById('stormEffectsToggle');
        if (!stormEffectsToggle.checked) {
            GameState.stormParticles = [];
            GameState.splashParticles = [];
            return;
        }
        
        const canvas = document.getElementById('gameCanvas');
        
        if (GameState.stormParticles.length < GameState.MAX_STORM_PARTICLES && GameState.gameRunning && !GameState.paused) {
            let spawnChance = 0.3;
            if (GameState.gameMode === 'downpour') spawnChance = 2.0;
            else if (GameState.gameMode === 'hailstorm') spawnChance = 0.4;
            else if (GameState.gameMode === 'blizzard') spawnChance = 19.2;
            else if (GameState.gameMode === 'hurricane') spawnChance = 30.0;
            
            const numToSpawn = Math.floor(spawnChance);
            const fractionalChance = spawnChance - numToSpawn;
            
            for (let i = 0; i < numToSpawn; i++) {
                GameState.stormParticles.push(this.createStormParticle());
            }
            
            if (Math.random() < fractionalChance) {
                GameState.stormParticles.push(this.createStormParticle());
            }
        }
        
        GameState.stormParticles = GameState.stormParticles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            if (particle.type === 'hail' || particle.type === 'blizzard') {
                particle.rotation += particle.rotationSpeed;
            }
            
            if (particle.type === 'rain' && GameState.gameMode === 'downpour') {
                const collision = this.checkCollisionWithBlocks(particle.x, particle.y);
                if (collision.collision) {
                    this.createSplash(particle.x, collision.y, particle.size);
                    return false;
                }
            }
            
            if (particle.type === 'hail') {
                const collision = this.checkCollisionWithBlocks(particle.x, particle.y);
                if (collision.collision) {
                    GameState.splashParticles.push(this.createHailBounce(particle.x, collision.y, particle.size, particle.vy));
                    return false;
                }
            }
            
            return particle.y < canvas.height + 20 && particle.x > -20 && particle.x < canvas.width + 20;
        });
        
        GameState.splashParticles = GameState.splashParticles.filter(splash => {
            splash.x += splash.vx;
            splash.y += splash.vy;
            splash.vy += splash.gravity;
            
            if (splash.type === 'bouncing') {
                splash.rotation += splash.rotationSpeed;
                splash.life--;
                
                if (splash.vy > 0) {
                    const collision = this.checkCollisionWithBlocks(splash.x, splash.y);
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
};
