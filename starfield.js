// ============================================
// STARFIELD MODULE - Space Background System
// ============================================
// Handles: Stars, Sun, Planets, Asteroid Belt, UFO

const StarfieldSystem = (function() {
    // Canvas and context
    const starfieldCanvas = document.getElementById('starfield');
    const starfieldCtx = starfieldCanvas.getContext('2d');
    
    // Stars configuration
    const stars = [];
    const numStars = 400;
    let starSpeed = 1;
    const maxDepth = 1000;
    let centerX, centerY;
    
    // UFO animation state for 42 lines easter egg
    let ufoActive = false;
    let ufoX = 0;
    let ufoY = 0;
    let ufoTargetX = 0;
    let ufoTargetY = 0;
    let ufoPhase = 'entering';
    let ufoCircleAngle = 0;
    let ufoCircleRadius = 60;
    let ufoEntryEdge = 'left';
    let ufoExitEdge = 'right';
    let ufoSpeed = 4;
    let ufoCircleTime = 0;
    let ufoBeamOpacity = 0;
    
    // Solar system data
    const planets = [
        {
            name: 'Sun', level: 1, color: '#FFD700', size: 0, distance: 0,
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b4/The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg',
            gravity: 28.0, tempMin: 5500, tempMax: 5500, moons: 0,
            dayLength: '25 Earth days', yearLength: 'N/A',
            funFact: 'Our star, 99.86% of solar system mass',
            isSun: true
        },
        { 
            name: 'Mercury', level: 2, color: '#8C7853', size: 8, distance: 5, 
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Mercury_in_true_color.jpg',
            gravity: 0.38, tempMin: -173, tempMax: 427, moons: 0, 
            dayLength: '59 Earth days', yearLength: '88 Earth days',
            funFact: 'Smallest planet, closest to the Sun'
        },
        { 
            name: 'Venus', level: 3, color: '#FFC649', size: 18, distance: 10, 
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Venus-real_color.jpg',
            gravity: 0.91, tempMin: 462, tempMax: 462, moons: 0,
            dayLength: '243 Earth days', yearLength: '225 Earth days',
            funFact: 'Hottest planet, spins backwards'
        },
        { 
            name: 'Earth', level: 4, color: '#4169E1', size: 18, distance: 15, 
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/97/The_Earth_seen_from_Apollo_17.jpg',
            gravity: 1.0, tempMin: -88, tempMax: 58, moons: 1,
            dayLength: '24 hours', yearLength: '365 days',
            funFact: 'The only known planet with life'
        },
        { 
            name: 'Mars', level: 5, color: '#CD5C5C', size: 12, distance: 20, 
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/02/OSIRIS_Mars_true_color.jpg',
            gravity: 0.38, tempMin: -153, tempMax: 20, moons: 2,
            dayLength: '24.6 hours', yearLength: '687 Earth days',
            funFact: 'The Red Planet, has water ice'
        },
        { 
            name: 'Asteroid Belt', level: 6, isAsteroidBelt: true,
            funFact: 'Rocky remnants between Mars and Jupiter'
        },
        { 
            name: 'Jupiter', level: 7, color: '#DAA520', size: 35, distance: 25, 
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Jupiter_and_its_shrunken_Great_Red_Spot.jpg',
            gravity: 2.53, tempMin: -145, tempMax: -145, moons: 95,
            dayLength: '10 hours', yearLength: '12 Earth years',
            funFact: 'Largest planet, Great Red Spot storm'
        },
        { 
            name: 'Saturn', level: 8, color: '#F4A460', size: 30, distance: 30, hasRings: true,
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Saturn_during_Equinox.jpg',
            gravity: 1.07, tempMin: -178, tempMax: -178, moons: 146,
            dayLength: '10.7 hours', yearLength: '29 Earth years',
            funFact: 'Famous rings made of ice and rock'
        },
        { 
            name: 'Uranus', level: 9, color: '#4FD0E0', size: 22, distance: 35, 
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Uranus2.jpg',
            gravity: 0.89, tempMin: -224, tempMax: -224, moons: 28,
            dayLength: '17 hours', yearLength: '84 Earth years',
            funFact: 'Rotates on its side, blue methane'
        },
        { 
            name: 'Neptune', level: 10, color: '#4169E1', size: 21, distance: 40, 
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Neptune_-_Voyager_2_%2829347980845%29_flatten_crop.jpg',
            gravity: 1.14, tempMin: -214, tempMax: -214, moons: 16,
            dayLength: '16 hours', yearLength: '165 Earth years',
            funFact: 'Farthest planet, fastest winds'
        },
        { 
            name: 'Pluto', level: 11, color: '#B8947D', size: 6, distance: 45, 
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Pluto_in_True_Color_-_High-Res.jpg',
            gravity: 0.06, tempMin: -233, tempMax: -223, moons: 5,
            dayLength: '6.4 Earth days', yearLength: '248 Earth years',
            funFact: 'Dwarf planet with a heart shape'
        }
    ];
    
    // Planet images
    const planetImages = {};
    let imagesLoaded = 0;
    
    // Load planet images
    planets.forEach(planet => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            planetImages[planet.name] = img;
            imagesLoaded++;
        };
        img.onerror = () => {
            imagesLoaded++;
        };
        img.src = planet.imageUrl;
    });
    
    // Sun image
    const sunImage = new Image();
    sunImage.crossOrigin = 'anonymous';
    sunImage.onload = () => { console.log('Sun image loaded'); };
    sunImage.onerror = () => { console.log('Sun image failed to load, using procedural'); };
    sunImage.src = 'https://upload.wikimedia.org/wikipedia/commons/b/b4/The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg';
    
    // Planet/asteroid animation state
    let planetAnimations = {};
    let asteroidBeltActive = false;
    let asteroidBeltShown = false;
    let asteroidBeltProgress = 0;
    let asteroids = [];
    
    // State controlled by game
    let currentGameLevel = 1;
    let journeyProgress = 0;
    let gameRunning = false;
    let paused = false;
    let cameraReversed = false;
    
    // Planet stats DOM references
    let planetStatsDiv = null;
    let planetStatsContent = null;
    let tabletModeEnabled = false;
    
    // Sound callback
    let playSoundEffectCallback = null;
    let soundToggleRef = null;
    
    // ============================================
    // STAR FUNCTIONS
    // ============================================
    
    function createStar() {
        return {
            x: (Math.random() - 0.5) * 2000,
            y: (Math.random() - 0.5) * 2000,
            z: Math.random() * maxDepth
        };
    }
    
    function resizeStarfield() {
        starfieldCanvas.width = window.innerWidth * 1.1;
        starfieldCanvas.height = window.innerHeight * 1.1;
        centerX = starfieldCanvas.width / 2;
        centerY = starfieldCanvas.height / 2;
        
        stars.length = 0;
        for (let i = 0; i < numStars; i++) {
            stars.push(createStar());
        }
    }
    
    // ============================================
    // COLOR HELPER FUNCTIONS
    // ============================================
    
    function lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }
    
    function darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, (num >> 8 & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }
    
    // ============================================
    // SUN DRAWING
    // ============================================
    
    function drawSun() {
        const maxJourney = 3920 * 2;
        const journeyRatio = Math.min(1, journeyProgress / maxJourney);
        const easedRatio = 1 - Math.pow(1 - journeyRatio, 2);
        const rawSize = 800 - (easedRatio * 796);
        const sunSize = Math.max(4, rawSize);
        
        const morphStart = 8;
        const morphEnd = 4;
        let morphToWhite = 0;
        if (sunSize <= morphStart) {
            morphToWhite = (morphStart - sunSize) / (morphStart - morphEnd);
            morphToWhite = Math.max(0, Math.min(1, morphToWhite));
        }
        
        const colorTransitionStart = 4;
        let transitionProgress = 0;
        if (sunSize <= colorTransitionStart) {
            transitionProgress = 1.0;
        }
        
        const r = Math.floor(255);
        const g = Math.floor(200 + (55 * transitionProgress));
        const b = Math.floor(100 * transitionProgress);
        
        if (sunSize > 4 && sunImage.complete && sunImage.naturalHeight !== 0) {
            starfieldCtx.save();
            starfieldCtx.beginPath();
            starfieldCtx.arc(centerX, centerY, sunSize, 0, Math.PI * 2);
            starfieldCtx.clip();
            
            starfieldCtx.drawImage(
                sunImage,
                centerX - sunSize,
                centerY - sunSize,
                sunSize * 2,
                sunSize * 2
            );
            
            starfieldCtx.restore();
            
            if (morphToWhite > 0) {
                starfieldCtx.save();
                starfieldCtx.globalAlpha = morphToWhite;
                starfieldCtx.fillStyle = '#FFFFFF';
                starfieldCtx.beginPath();
                starfieldCtx.arc(centerX, centerY, sunSize, 0, Math.PI * 2);
                starfieldCtx.fill();
                starfieldCtx.restore();
            }
            
            const glowGradient = starfieldCtx.createRadialGradient(
                centerX, centerY, sunSize,
                centerX, centerY, sunSize * 1.8
            );
            const glowAlpha = 0.4 * (1 - transitionProgress * 0.5) * (1 - morphToWhite * 0.5);
            glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
            glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            
            starfieldCtx.fillStyle = glowGradient;
            starfieldCtx.beginPath();
            starfieldCtx.arc(centerX, centerY, sunSize * 1.8, 0, Math.PI * 2);
            starfieldCtx.fill();
        } else {
            if (sunSize <= 4) {
                starfieldCtx.fillStyle = '#FFFFFF';
                starfieldCtx.beginPath();
                starfieldCtx.arc(centerX, centerY, sunSize, 0, Math.PI * 2);
                starfieldCtx.fill();
                
                const starGlow = starfieldCtx.createRadialGradient(
                    centerX, centerY, 0,
                    centerX, centerY, sunSize * 3
                );
                starGlow.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
                starGlow.addColorStop(0.3, 'rgba(255, 255, 255, 0.3)');
                starGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                starfieldCtx.fillStyle = starGlow;
                starfieldCtx.beginPath();
                starfieldCtx.arc(centerX, centerY, sunSize * 3, 0, Math.PI * 2);
                starfieldCtx.fill();
            } else {
                const glowGradient = starfieldCtx.createRadialGradient(
                    centerX, centerY, sunSize,
                    centerX, centerY, sunSize * 1.8
                );
                const glowAlpha = 0.6 * (1 - transitionProgress * 0.5);
                glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
                glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                
                starfieldCtx.fillStyle = glowGradient;
                starfieldCtx.beginPath();
                starfieldCtx.arc(centerX, centerY, sunSize * 1.8, 0, Math.PI * 2);
                starfieldCtx.fill();
                
                const bodyGradient = starfieldCtx.createRadialGradient(
                    centerX - sunSize * 0.3, centerY - sunSize * 0.3, sunSize * 0.1,
                    centerX, centerY, sunSize
                );
                
                const centerR = 255;
                const centerG = Math.floor(250 - (transitionProgress * 5));
                const centerB = Math.floor(205 + (transitionProgress * 50));
                
                bodyGradient.addColorStop(0, `rgb(${centerR}, ${centerG}, ${centerB})`);
                bodyGradient.addColorStop(0.5, `rgb(${r}, ${g}, ${Math.floor(b * 0.5)})`);
                bodyGradient.addColorStop(1, `rgb(${Math.floor(r * 0.95)}, ${Math.floor(g * 0.9)}, ${Math.floor(b * 0.3)})`);
                
                starfieldCtx.fillStyle = bodyGradient;
                starfieldCtx.beginPath();
                starfieldCtx.arc(centerX, centerY, sunSize, 0, Math.PI * 2);
                starfieldCtx.fill();
            }
        }
    }
    
    // ============================================
    // PLANET DRAWING
    // ============================================
    
    function drawPlanet(planet, position) {
        const x = centerX + position.x;
        const y = centerY + position.y;
        
        if (planetImages[planet.name]) {
            const img = planetImages[planet.name];
            
            starfieldCtx.save();
            starfieldCtx.beginPath();
            starfieldCtx.arc(x, y, planet.size, 0, Math.PI * 2);
            starfieldCtx.clip();
            
            starfieldCtx.drawImage(
                img,
                x - planet.size,
                y - planet.size,
                planet.size * 2,
                planet.size * 2
            );
            
            starfieldCtx.restore();
            
            const shadingGradient = starfieldCtx.createRadialGradient(
                x - planet.size * 0.3, y - planet.size * 0.3, planet.size * 0.1,
                x, y, planet.size
            );
            shadingGradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
            shadingGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
            shadingGradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
            
            starfieldCtx.fillStyle = shadingGradient;
            starfieldCtx.beginPath();
            starfieldCtx.arc(x, y, planet.size, 0, Math.PI * 2);
            starfieldCtx.fill();
        } else {
            if (planet.name === 'Earth') {
                const earthGradient = starfieldCtx.createRadialGradient(
                    x - planet.size * 0.3, y - planet.size * 0.3, planet.size * 0.1,
                    x, y, planet.size
                );
                earthGradient.addColorStop(0, '#87CEEB');
                earthGradient.addColorStop(0.7, '#4169E1');
                earthGradient.addColorStop(1, '#191970');
                starfieldCtx.fillStyle = earthGradient;
                starfieldCtx.beginPath();
                starfieldCtx.arc(x, y, planet.size, 0, Math.PI * 2);
                starfieldCtx.fill();
                
                starfieldCtx.fillStyle = '#228B22';
                starfieldCtx.globalAlpha = 1.0;
                
                starfieldCtx.beginPath();
                starfieldCtx.ellipse(x + planet.size * 0.2, y - planet.size * 0.1, planet.size * 0.35, planet.size * 0.25, 0.5, 0, Math.PI * 2);
                starfieldCtx.fill();
                
                starfieldCtx.beginPath();
                starfieldCtx.ellipse(x - planet.size * 0.3, y + planet.size * 0.2, planet.size * 0.2, planet.size * 0.15, -0.3, 0, Math.PI * 2);
                starfieldCtx.fill();
                
                starfieldCtx.fillStyle = '#FFFFFF';
                starfieldCtx.beginPath();
                starfieldCtx.arc(x, y - planet.size * 0.75, planet.size * 0.25, 0, Math.PI * 2);
                starfieldCtx.fill();
                starfieldCtx.beginPath();
                starfieldCtx.arc(x + planet.size * 0.4, y - planet.size * 0.25, planet.size * 0.15, 0, Math.PI * 2);
                starfieldCtx.fill();
                
                starfieldCtx.globalAlpha = 1.0;
            } else {
                const bodyGradient = starfieldCtx.createRadialGradient(
                    x - planet.size * 0.3, y - planet.size * 0.3, planet.size * 0.1,
                    x, y, planet.size
                );
                
                bodyGradient.addColorStop(0, lightenColor(planet.color, 40));
                bodyGradient.addColorStop(0.5, planet.color);
                bodyGradient.addColorStop(1, darkenColor(planet.color, 40));
                
                starfieldCtx.fillStyle = bodyGradient;
                starfieldCtx.beginPath();
                starfieldCtx.arc(x, y, planet.size, 0, Math.PI * 2);
                starfieldCtx.fill();
            }
        }
        
        if (planet.hasRings) {
            starfieldCtx.globalAlpha = 1.0;
            starfieldCtx.strokeStyle = '#D4A76A';
            starfieldCtx.lineWidth = planet.size * 0.15;
            starfieldCtx.beginPath();
            starfieldCtx.ellipse(x, y, planet.size * 1.8, planet.size * 0.4, 0, 0, Math.PI * 2);
            starfieldCtx.stroke();
            
            starfieldCtx.strokeStyle = '#8B7355';
            starfieldCtx.lineWidth = planet.size * 0.08;
            starfieldCtx.beginPath();
            starfieldCtx.ellipse(x, y, planet.size * 1.6, planet.size * 0.35, 0, 0, Math.PI * 2);
            starfieldCtx.stroke();
            starfieldCtx.globalAlpha = 1.0;
        }
    }
    
    // ============================================
    // ASTEROID FUNCTIONS
    // ============================================
    
    function generateAsteroids() {
        asteroids = [];
        const numAsteroids = 120;
        
        for (let i = 0; i < numAsteroids; i++) {
            const sizeCategory = Math.random();
            let baseSize;
            if (sizeCategory < 0.1) baseSize = 40 + Math.random() * 40;
            else if (sizeCategory < 0.3) baseSize = 20 + Math.random() * 20;
            else if (sizeCategory < 0.6) baseSize = 10 + Math.random() * 10;
            else baseSize = 3 + Math.random() * 7;
            
            const startY = (Math.random() - 0.5) * starfieldCanvas.height * 1.5;
            
            const startX = cameraReversed 
                ? -starfieldCanvas.width * 0.6 - (Math.random() * starfieldCanvas.width * 2)
                : starfieldCanvas.width * 0.6 + (Math.random() * starfieldCanvas.width * 2);
            
            const rotation = Math.random() * Math.PI * 2;
            const rotationSpeed = (Math.random() - 0.5) * 0.02;
            const speed = 2 + Math.random() * 3;
            
            const numPoints = 8 + Math.floor(Math.random() * 3);
            const shape = [];
            for (let j = 0; j < numPoints; j++) {
                const angle = (j / numPoints) * Math.PI * 2;
                const radius = baseSize * (0.7 + Math.random() * 0.3);
                shape.push({ angle, radius });
            }
            
            const colorChoices = [
                '#8B8680', '#A8A39D', '#756F68', '#9B9489', '#6B6560',
                '#8C8273', '#A39E93', '#7A7568', '#918B7F', '#6E6962'
            ];
            const color = colorChoices[Math.floor(Math.random() * colorChoices.length)];
            
            asteroids.push({
                x: startX,
                y: startY,
                baseSize,
                rotation,
                rotationSpeed,
                speed,
                shape,
                color,
                depth: Math.random()
            });
        }
    }
    
    function drawAsteroid(asteroid, scale) {
        const size = asteroid.baseSize * scale;
        if (size < 0.5) return;
        
        starfieldCtx.save();
        starfieldCtx.translate(centerX + asteroid.x, centerY + asteroid.y);
        starfieldCtx.rotate(asteroid.rotation);
        
        starfieldCtx.beginPath();
        
        for (let i = 0; i < asteroid.shape.length; i++) {
            const prevPoint = asteroid.shape[(i - 1 + asteroid.shape.length) % asteroid.shape.length];
            const currentPoint = asteroid.shape[i];
            const nextPoint = asteroid.shape[(i + 1) % asteroid.shape.length];
            
            const prevX = Math.cos(prevPoint.angle) * prevPoint.radius * scale;
            const prevY = Math.sin(prevPoint.angle) * prevPoint.radius * scale;
            const currentX = Math.cos(currentPoint.angle) * currentPoint.radius * scale;
            const currentY = Math.sin(currentPoint.angle) * currentPoint.radius * scale;
            const nextX = Math.cos(nextPoint.angle) * nextPoint.radius * scale;
            const nextY = Math.sin(nextPoint.angle) * nextPoint.radius * scale;
            
            const t = 0.35;
            
            if (i === 0) {
                const startX = prevX * t + currentX * (1 - t);
                const startY = prevY * t + currentY * (1 - t);
                starfieldCtx.moveTo(startX, startY);
            }
            
            const endX = currentX * (1 - t) + nextX * t;
            const endY = currentY * (1 - t) + nextY * t;
            
            starfieldCtx.quadraticCurveTo(currentX, currentY, endX, endY);
        }
        
        starfieldCtx.closePath();
        
        const layers = 16;
        
        for (let layer = layers; layer >= 0; layer--) {
            const layerProgress = layer / layers;
            const layerScale = 0.3 + (layerProgress * 0.7);
            const offsetX = -size * 0.2 * (1 - layerProgress);
            const offsetY = -size * 0.2 * (1 - layerProgress);
            
            starfieldCtx.beginPath();
            for (let i = 0; i < asteroid.shape.length; i++) {
                const prevPoint = asteroid.shape[(i - 1 + asteroid.shape.length) % asteroid.shape.length];
                const currentPoint = asteroid.shape[i];
                const nextPoint = asteroid.shape[(i + 1) % asteroid.shape.length];
                
                const prevX = Math.cos(prevPoint.angle) * prevPoint.radius * scale * layerScale + offsetX;
                const prevY = Math.sin(prevPoint.angle) * prevPoint.radius * scale * layerScale + offsetY;
                const currentX = Math.cos(currentPoint.angle) * currentPoint.radius * scale * layerScale + offsetX;
                const currentY = Math.sin(currentPoint.angle) * currentPoint.radius * scale * layerScale + offsetY;
                const nextX = Math.cos(nextPoint.angle) * nextPoint.radius * scale * layerScale + offsetX;
                const nextY = Math.sin(nextPoint.angle) * nextPoint.radius * scale * layerScale + offsetY;
                
                const t = 0.35;
                
                if (i === 0) {
                    const startX = prevX * t + currentX * (1 - t);
                    const startY = prevY * t + currentY * (1 - t);
                    starfieldCtx.moveTo(startX, startY);
                }
                
                const endX = currentX * (1 - t) + nextX * t;
                const endY = currentY * (1 - t) + nextY * t;
                
                starfieldCtx.quadraticCurveTo(currentX, currentY, endX, endY);
            }
            starfieldCtx.closePath();
            
            const r = Math.round(125 - layerProgress * 50);
            const g = Math.round(120 - layerProgress * 49);
            const b = Math.round(115 - layerProgress * 48);
            
            starfieldCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            starfieldCtx.fill();
        }
        
        starfieldCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        starfieldCtx.lineWidth = 0.5;
        starfieldCtx.stroke();
        
        starfieldCtx.restore();
    }
    
    // ============================================
    // UFO FUNCTIONS
    // ============================================
    
    function triggerUFO() {
        if (ufoActive) return;
        
        ufoActive = true;
        ufoPhase = 'entering';
        ufoCircleTime = 0;
        ufoCircleAngle = 0;
        ufoBeamOpacity = 0;
        
        const linesDisplay = document.getElementById('lines');
        if (!linesDisplay) {
            console.error('Could not find lines display element');
            return;
        }
        const linesRect = linesDisplay.getBoundingClientRect();
        
        const scaleFactor = 1.1;
        ufoTargetX = (linesRect.left + linesRect.width / 2) * scaleFactor;
        ufoTargetY = (linesRect.top + linesRect.height / 2) * scaleFactor;
        
        console.log(`UFO Target: X=${ufoTargetX}, Y=${ufoTargetY}, Element text="${linesDisplay.textContent}"`);
        
        const edges = ['left', 'right', 'top', 'bottom'];
        ufoEntryEdge = edges[Math.floor(Math.random() * edges.length)];
        do {
            ufoExitEdge = edges[Math.floor(Math.random() * edges.length)];
        } while (ufoExitEdge === ufoEntryEdge);
        
        switch(ufoEntryEdge) {
            case 'left':
                ufoX = -100;
                ufoY = ufoTargetY;
                break;
            case 'right':
                ufoX = starfieldCanvas.width + 100;
                ufoY = ufoTargetY;
                break;
            case 'top':
                ufoX = ufoTargetX;
                ufoY = -100;
                break;
            case 'bottom':
                ufoX = ufoTargetX;
                ufoY = starfieldCanvas.height + 100;
                break;
        }
        
        console.log('🛸 UFO ACTIVATED! The answer to everything is being celebrated!');
        if (playSoundEffectCallback && soundToggleRef) {
            playSoundEffectCallback('special', soundToggleRef);
        }
    }
    
    function updateUFO() {
        if (!ufoActive) return;
        
        switch(ufoPhase) {
            case 'entering':
                const dx = ufoTargetX - ufoX;
                const dy = ufoTargetY - ufoY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > ufoCircleRadius) {
                    ufoX += (dx / dist) * ufoSpeed;
                    ufoY += (dy / dist) * ufoSpeed;
                } else {
                    const currentDx = ufoX - ufoTargetX;
                    const currentDy = ufoY - ufoTargetY;
                    ufoCircleAngle = Math.atan2(currentDy, currentDx);
                    
                    ufoPhase = 'circling';
                    ufoCircleTime = 0;
                }
                break;
                
            case 'circling':
                ufoCircleAngle += 0.05;
                ufoCircleTime++;
                
                const radiusOscillation = Math.sin(ufoCircleAngle * 2) * 10;
                const currentRadius = ufoCircleRadius + radiusOscillation;
                
                ufoX = ufoTargetX + Math.cos(ufoCircleAngle) * currentRadius;
                ufoY = ufoTargetY + Math.sin(ufoCircleAngle) * currentRadius;
                
                ufoBeamOpacity = Math.sin(ufoCircleTime * 0.1) * 0.3 + 0.5;
                
                if (ufoCircleAngle > Math.PI * 6) {
                    ufoPhase = 'exiting';
                    ufoBeamOpacity = 0;
                }
                break;
                
            case 'exiting':
                let exitTargetX, exitTargetY;
                switch(ufoExitEdge) {
                    case 'left':
                        exitTargetX = -100;
                        exitTargetY = ufoY;
                        break;
                    case 'right':
                        exitTargetX = starfieldCanvas.width + 100;
                        exitTargetY = ufoY;
                        break;
                    case 'top':
                        exitTargetX = ufoX;
                        exitTargetY = -100;
                        break;
                    case 'bottom':
                        exitTargetX = ufoX;
                        exitTargetY = starfieldCanvas.height + 100;
                        break;
                }
                
                const exitDx = exitTargetX - ufoX;
                const exitDy = exitTargetY - ufoY;
                const exitDist = Math.sqrt(exitDx * exitDx + exitDy * exitDy);
                
                if (exitDist > 10) {
                    ufoX += (exitDx / exitDist) * ufoSpeed * 1.5;
                    ufoY += (exitDy / exitDist) * ufoSpeed * 1.5;
                } else {
                    ufoActive = false;
                    console.log('🛸 UFO has departed after celebrating the ultimate answer!');
                }
                break;
        }
    }
    
    function drawUFO() {
        if (!ufoActive) return;
        
        starfieldCtx.save();
        
        if (ufoPhase === 'circling' && ufoBeamOpacity > 0) {
            starfieldCtx.save();
            starfieldCtx.globalAlpha = ufoBeamOpacity;
            
            const gradient = starfieldCtx.createLinearGradient(ufoX, ufoY, ufoTargetX, ufoTargetY);
            gradient.addColorStop(0, 'rgba(100, 255, 100, 0.8)');
            gradient.addColorStop(1, 'rgba(100, 255, 100, 0)');
            
            starfieldCtx.beginPath();
            starfieldCtx.moveTo(ufoX - 20, ufoY);
            starfieldCtx.lineTo(ufoX + 20, ufoY);
            starfieldCtx.lineTo(ufoTargetX + 10, ufoTargetY + 10);
            starfieldCtx.lineTo(ufoTargetX - 10, ufoTargetY + 10);
            starfieldCtx.closePath();
            starfieldCtx.fillStyle = gradient;
            starfieldCtx.fill();
            
            starfieldCtx.restore();
        }
        
        const wobble = Math.sin(Date.now() * 0.01) * 2;
        
        starfieldCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        starfieldCtx.beginPath();
        starfieldCtx.ellipse(ufoX, ufoY + 25, 35, 8, 0, 0, Math.PI * 2);
        starfieldCtx.fill();
        
        const bottomGradient = starfieldCtx.createRadialGradient(ufoX, ufoY + 5, 0, ufoX, ufoY + 5, 30);
        bottomGradient.addColorStop(0, '#445566');
        bottomGradient.addColorStop(0.7, '#223344');
        bottomGradient.addColorStop(1, '#112233');
        
        starfieldCtx.fillStyle = bottomGradient;
        starfieldCtx.beginPath();
        starfieldCtx.ellipse(ufoX, ufoY + 5 + wobble, 30, 10, 0, 0, Math.PI * 2);
        starfieldCtx.fill();
        
        const domeGradient = starfieldCtx.createRadialGradient(ufoX, ufoY - 5, 0, ufoX, ufoY, 20);
        domeGradient.addColorStop(0, 'rgba(150, 200, 255, 0.8)');
        domeGradient.addColorStop(0.5, 'rgba(100, 150, 255, 0.6)');
        domeGradient.addColorStop(1, 'rgba(50, 100, 200, 0.4)');
        
        starfieldCtx.fillStyle = domeGradient;
        starfieldCtx.beginPath();
        starfieldCtx.ellipse(ufoX, ufoY - 5 + wobble, 20, 15, 0, Math.PI, Math.PI * 2);
        starfieldCtx.fill();
        
        const lightPhase = Date.now() * 0.005;
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i / 8) + lightPhase;
            const lightX = ufoX + Math.cos(angle) * 25;
            const lightY = ufoY + 5 + Math.sin(angle) * 8 + wobble;
            
            starfieldCtx.fillStyle = `rgba(100, 255, 100, ${0.3 + Math.sin(lightPhase + i) * 0.3})`;
            starfieldCtx.beginPath();
            starfieldCtx.arc(lightX, lightY, 5, 0, Math.PI * 2);
            starfieldCtx.fill();
            
            starfieldCtx.fillStyle = `rgba(200, 255, 200, ${0.5 + Math.sin(lightPhase + i) * 0.5})`;
            starfieldCtx.beginPath();
            starfieldCtx.arc(lightX, lightY, 2, 0, Math.PI * 2);
            starfieldCtx.fill();
        }
        
        starfieldCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        starfieldCtx.beginPath();
        starfieldCtx.ellipse(ufoX - 5, ufoY - 10 + wobble, 8, 5, -Math.PI / 6, 0, Math.PI * 2);
        starfieldCtx.fill();
        
        starfieldCtx.restore();
    }
    
    // ============================================
    // PLANET STATS UI
    // ============================================
    
    function showPlanetStats(planet) {
        setTimeout(() => {
            console.log('Showing planet stats for:', planet.name);
            
            if (!planetStatsDiv || !planetStatsContent) {
                planetStatsDiv = document.getElementById('planetStats');
                planetStatsContent = document.getElementById('planetStatsContent');
            }
            
            let html = '';
            
            if (planet.isSun) {
                html = `
                    <div style="font-weight: bold; font-size: 1.55vh; margin-bottom: 0.7vh; color: ${planet.color};">
                        ${planet.name}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.35vh 1.1vw; line-height: 1.5; color: rgba(255,255,255,0.9); font-size: 1.15vh;">
                        <div><strong>Gravity:</strong> <span style="color: #FFD700; font-weight: bold;">${planet.gravity}×</span> Earth</div>
                        <div><strong>Day:</strong> ${planet.dayLength}</div>
                        <div><strong>Temperature:</strong> ${planet.tempMin}°C</div>
                        <div><strong>Type:</strong> G-type star</div>
                        <div><strong>Radius:</strong> 696,000 km</div>
                    </div>
                    <div style="margin-top: 0.55vh; font-style: italic; color: rgba(255,255,255,0.7); font-size: 1.05vh;">
                        ${planet.funFact}
                    </div>
                `;
            } else if (planet.isAsteroidBelt) {
                html = `
                    <div style="font-weight: bold; font-size: 1.55vh; margin-bottom: 0.7vh; color: #9B9489;">
                        ${planet.name}
                    </div>
                    <div style="line-height: 1.5; color: rgba(255,255,255,0.9);">
                        <div style="font-style: italic; color: rgba(255,255,255,0.8); font-size: 1.05vh;">
                            ${planet.funFact}
                        </div>
                    </div>
                `;
            } else {
                html = `
                    <div style="font-weight: bold; font-size: 1.55vh; margin-bottom: 0.7vh; color: ${planet.color};">
                        ${planet.name}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.35vh 1.1vw; line-height: 1.5; color: rgba(255,255,255,0.9); font-size: 1.15vh;">
                        <div><strong>Gravity:</strong> <span style="color: #FFD700; font-weight: bold;">${planet.gravity}×</span> Earth</div>
                        <div><strong>Day:</strong> ${planet.dayLength}</div>
                        <div><strong>Temperature:</strong> ${planet.tempMin === planet.tempMax ? planet.tempMin : planet.tempMin + ' to ' + planet.tempMax}°C</div>
                        <div><strong>Year:</strong> ${planet.yearLength}</div>
                        <div><strong>Moons:</strong> ${planet.moons}</div>
                    </div>
                    <div style="margin-top: 0.55vh; font-style: italic; color: rgba(255,255,255,0.7); font-size: 1.05vh;">
                        ${planet.funFact}
                    </div>
                `;
            }
            
            if (planetStatsContent) {
                planetStatsContent.innerHTML = html;
            }
            
            const planetStatsLeftContent = document.getElementById('planetStatsLeftContent');
            if (planetStatsLeftContent) {
                planetStatsLeftContent.innerHTML = html;
            }
            
            if (tabletModeEnabled) {
                const planetStatsLeft = document.getElementById('planetStatsLeft');
                if (planetStatsLeft) {
                    planetStatsLeft.style.display = 'block';
                }
            } else if (planetStatsDiv) {
                planetStatsDiv.style.display = 'block';
            }
        }, 3000);
    }
    
    function hidePlanetStats() {
        if (planetStatsDiv) {
            planetStatsDiv.style.display = 'none';
        }
        const planetStatsLeft = document.getElementById('planetStatsLeft');
        if (planetStatsLeft) {
            planetStatsLeft.style.display = 'none';
        }
    }
    
    // ============================================
    // MAIN ANIMATION LOOP
    // ============================================
    
    function animateStarfield() {
        starfieldCtx.fillStyle = '#000';
        starfieldCtx.fillRect(0, 0, starfieldCanvas.width, starfieldCanvas.height);
        
        // Draw sun in background
        if (gameRunning && !cameraReversed) {
            drawSun();
            if (!paused) {
                journeyProgress += 2;
            }
        } else if (gameRunning && !paused) {
            journeyProgress += 2;
        }
        
        // Draw planets
        if (gameRunning) {
            planets.forEach((planet, index) => {
                if (planet.isAsteroidBelt) {
                    if (currentGameLevel >= planet.level && !asteroidBeltShown) {
                        asteroidBeltActive = true;
                        asteroidBeltShown = true;
                        asteroidBeltProgress = 0;
                        generateAsteroids();
                        showPlanetStats(planet);
                    }
                    return;
                }
                
                if (currentGameLevel >= planet.level && !planetAnimations[planet.name]) {
                    showPlanetStats(planet);
                    
                    if (cameraReversed) {
                        planetAnimations[planet.name] = {
                            progress: 0,
                            startX: 0,
                            startY: 0,
                            targetX: (index % 2 === 0 ? -1 : 1) * (starfieldCanvas.width * 0.6 + 200),
                            targetY: ((index % 4) - 1.5) * 100
                        };
                    } else {
                        planetAnimations[planet.name] = {
                            progress: 0,
                            startX: (index % 2 === 0 ? -1 : 1) * (starfieldCanvas.width * 0.65 + 200),
                            startY: ((index % 4) - 1.5) * 100
                        };
                    }
                }
                
                const anim = planetAnimations[planet.name];
                if (anim !== undefined) {
                    const progress = anim.progress;
                    
                    if (progress < 3000) {
                        if (cameraReversed) {
                            const moveProgress = progress / 3000;
                            const easedProgress = Math.pow(moveProgress, 1.8);
                            const scaleProgress = Math.pow(moveProgress, 1.5);
                            const scale = Math.max(0.1, scaleProgress * 15);
                            const driftX = anim.targetX * easedProgress;
                            const driftY = anim.targetY * easedProgress;
                            
                            const actualSize = Math.max(1, planet.size * scale);
                            const scaledPlanet = { ...planet, size: actualSize };
                            drawPlanet(scaledPlanet, { x: driftX, y: driftY });
                        } else {
                            const moveProgress = progress / 3000;
                            const easedProgress = 1 - Math.pow(1 - moveProgress, 3);
                            const scaleProgress = 1 - Math.pow(1 - moveProgress, 2.5);
                            const scale = Math.max(0.01, 15 - (scaleProgress * 15));
                            const driftX = anim.startX * (1 - easedProgress * 0.98);
                            const driftY = anim.startY * (1 - easedProgress * 0.98);
                            
                            const actualSize = Math.max(1, planet.size * scale);
                            const scaledPlanet = { ...planet, size: actualSize };
                            drawPlanet(scaledPlanet, { x: driftX, y: driftY });
                        }
                        
                        if (!paused) {
                            anim.progress++;
                        }
                        
                        if (anim.progress >= 3000) {
                            hidePlanetStats();
                        }
                    }
                }
            });
            
            // Draw asteroid belt
            if (asteroidBeltActive) {
                const duration = 1500;
                let allOffScreen = true;
                
                asteroids.forEach(asteroid => {
                    if (!paused) {
                        if (cameraReversed) {
                            asteroid.x += asteroid.speed * (1 + asteroid.depth * 0.5);
                        } else {
                            asteroid.x -= asteroid.speed * (1 + asteroid.depth * 0.5);
                        }
                        asteroid.rotation += asteroid.rotationSpeed;
                    }
                    
                    if (cameraReversed) {
                        if (asteroid.x < starfieldCanvas.width * 0.6) {
                            allOffScreen = false;
                        }
                    } else {
                        if (asteroid.x > -starfieldCanvas.width * 0.6) {
                            allOffScreen = false;
                        }
                    }
                    
                    const progress = Math.min(asteroidBeltProgress / duration, 1);
                    const scale = cameraReversed 
                        ? 0.5 + progress * 1.5
                        : 2 - progress * 1.5;
                    
                    if (asteroid.x > -starfieldCanvas.width * 0.6 && 
                        asteroid.x < starfieldCanvas.width * 0.6) {
                        drawAsteroid(asteroid, scale);
                    }
                });
                
                if (!paused) {
                    asteroidBeltProgress++;
                }
                
                if (asteroidBeltProgress >= duration) {
                    hidePlanetStats();
                }
                
                if (allOffScreen) {
                    asteroidBeltActive = false;
                }
            }
        }
        
        // Draw stars
        stars.forEach(star => {
            if (cameraReversed) {
                star.z -= starSpeed;
                if (star.z <= 0) {
                    star.x = (Math.random() - 0.5) * 2000;
                    star.y = (Math.random() - 0.5) * 2000;
                    star.z = maxDepth;
                }
            } else {
                star.z += starSpeed;
                if (star.z >= maxDepth) {
                    star.x = (Math.random() - 0.5) * 2000;
                    star.y = (Math.random() - 0.5) * 2000;
                    star.z = 1;
                }
            }
            
            const k = 128 / star.z;
            const px = star.x * k + centerX;
            const py = star.y * k + centerY;
            
            if (px >= 0 && px <= starfieldCanvas.width && 
                py >= 0 && py <= starfieldCanvas.height) {
                
                const size = (1 - star.z / maxDepth) * 2;
                const opacity = 1 - star.z / maxDepth;
                
                starfieldCtx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                starfieldCtx.beginPath();
                starfieldCtx.arc(px, py, size, 0, Math.PI * 2);
                starfieldCtx.fill();
                
                if (cameraReversed) {
                    if (star.z < 300) {
                        const k2 = 128 / (star.z + starSpeed * 2);
                        const px2 = star.x * k2 + centerX;
                        const py2 = star.y * k2 + centerY;
                        
                        starfieldCtx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
                        starfieldCtx.lineWidth = size / 2;
                        starfieldCtx.beginPath();
                        starfieldCtx.moveTo(px, py);
                        starfieldCtx.lineTo(px2, py2);
                        starfieldCtx.stroke();
                    }
                } else {
                    if (star.z < 300) {
                        const k2 = 128 / (star.z - starSpeed * 2);
                        const px2 = star.x * k2 + centerX;
                        const py2 = star.y * k2 + centerY;
                        
                        starfieldCtx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
                        starfieldCtx.lineWidth = size / 2;
                        starfieldCtx.beginPath();
                        starfieldCtx.moveTo(px, py);
                        starfieldCtx.lineTo(px2, py2);
                        starfieldCtx.stroke();
                    }
                }
            }
        });
        
        // Draw UFO
        drawUFO();
        
        requestAnimationFrame(animateStarfield);
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    function init() {
        planetStatsDiv = document.getElementById('planetStats');
        planetStatsContent = document.getElementById('planetStatsContent');
        resizeStarfield();
        window.addEventListener('resize', resizeStarfield);
        animateStarfield();
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        init: init,
        
        // State setters
        setGameRunning: (val) => { gameRunning = val; },
        setPaused: (val) => { paused = val; },
        setCameraReversed: (val) => { cameraReversed = val; },
        setCurrentGameLevel: (val) => { currentGameLevel = val; },
        setTabletModeEnabled: (val) => { tabletModeEnabled = val; },
        setStarSpeed: (val) => { starSpeed = val; },
        
        // Sound callback
        setSoundCallback: (callback, toggle) => {
            playSoundEffectCallback = callback;
            soundToggleRef = toggle;
        },
        
        // State getters
        getGameRunning: () => gameRunning,
        getPaused: () => paused,
        getCameraReversed: () => cameraReversed,
        getCurrentGameLevel: () => currentGameLevel,
        getJourneyProgress: () => journeyProgress,
        
        // UFO functions
        triggerUFO: triggerUFO,
        updateUFO: updateUFO,
        
        // Planet stats functions
        showPlanetStats: showPlanetStats,
        hidePlanetStats: hidePlanetStats,
        
        // Reset function for new game
        reset: () => {
            currentGameLevel = 1;
            journeyProgress = 0;
            planetAnimations = {};
            asteroidBeltActive = false;
            asteroidBeltShown = false;
            asteroidBeltProgress = 0;
            asteroids = [];
            ufoActive = false;
        },
        
        // Access to planets data (for developer mode)
        getPlanets: () => planets,
        getPlanetAnimations: () => planetAnimations,
        setPlanetAnimations: (val) => { planetAnimations = val; },
        
        // Canvas access (if needed externally)
        getCanvas: () => starfieldCanvas,
        getContext: () => starfieldCtx
    };
})();

// Export for use as module
if (typeof window !== 'undefined') {
    window.StarfieldSystem = StarfieldSystem;
}
