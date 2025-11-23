// starfield.js - Starfield background and solar system journey

// Starfield background - flying through space effect
        const starfieldCanvas = document.getElementById('starfield');
        const starfieldCtx = starfieldCanvas.getContext('2d');
        
        // Create stars with 3D coordinates
        const stars = [];
        const numStars = 400;
        let starSpeed = 1; // Slowed down from 2 to 1 (50% slower)
        const maxDepth = 1000;
        let centerX, centerY;
        
        // Variables that will be set by other modules
        let cameraReversed = false;
        let planetAnimations = {};
        let asteroidBeltActive = false;
        let asteroidBeltProgress = 0;
        let asteroidBeltShown = false;
        let asteroids = [];
        
        // UFO animation state for 42 lines easter egg
        let ufoActive = false;
        let ufoX = 0;
        let ufoY = 0;
        let ufoTargetX = 0;
        let ufoTargetY = 0;
        let ufoPhase = 'entering'; // 'entering', 'circling', 'exiting'
        let ufoCircleAngle = 0;
        let ufoCircleRadius = 60;
        let ufoEntryEdge = 'left'; // which edge it enters from
        let ufoExitEdge = 'right'; // which edge it exits from
        let ufoSpeed = 4;
        let ufoCircleTime = 0;
        let ufoBeamOpacity = 0;
        
        // Solar system data - planets appear at specific levels
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
        
        // Load planet images
        const planetImages = {};
        let imagesLoaded = 0;
        planets.forEach(planet => {
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Try to enable CORS
            img.onload = () => {
                planetImages[planet.name] = img;
                imagesLoaded++;
            };
            img.onerror = () => {
                imagesLoaded++;
            };
            img.src = planet.imageUrl;
        });
        
        // Note: Asteroid rendering is now fully procedural (no images needed)
        
        // These will be updated by the game code
        let currentGameLevel = 1; // Track current game level
        let journeyProgress = 0; // Distance traveled from sun
        let gameRunning = false; // Will be set by game
        let paused = false; // Will be set by game
        
        function createStar() {
            return {
                x: (Math.random() - 0.5) * 2000,
                y: (Math.random() - 0.5) * 2000,
                z: Math.random() * maxDepth
            };
        }
        
        function resizeStarfield() {
            // Make canvas slightly larger than viewport to ensure full coverage
            starfieldCanvas.width = window.innerWidth * 1.1;
            starfieldCanvas.height = window.innerHeight * 1.1;
            centerX = starfieldCanvas.width / 2;
            centerY = starfieldCanvas.height / 2;
            
            // Recreate stars to ensure proper coverage of new viewport
            stars.length = 0;
            for (let i = 0; i < numStars; i++) {
                stars.push(createStar());
            }
        }
        
        resizeStarfield();
        window.addEventListener('resize', resizeStarfield);
        
        function drawSun() {
            // Sun transitions from large orange disk to small white star
            // Calculate size with easing - slows down as it gets smaller
            const maxJourney = 3920 * 2; // Journey distance to reach minimum size (doubled for half speed)
            const journeyRatio = Math.min(1, journeyProgress / maxJourney);
            
            // Apply easing - quadratic ease-out (fast at first, slow at end)
            const easedRatio = 1 - Math.pow(1 - journeyRatio, 2);
            
            const rawSize = 800 - (easedRatio * 796); // 800 down to 4 (doubled again from 400)
            const sunSize = Math.max(4, rawSize);
            
            // Calculate morph progress between image and white star
            // Start morphing when sun gets very small (between 8 and 4 pixels)
            const morphStart = 8;
            const morphEnd = 4;
            let morphToWhite = 0;
            if (sunSize <= morphStart) {
                morphToWhite = (morphStart - sunSize) / (morphStart - morphEnd);
                morphToWhite = Math.max(0, Math.min(1, morphToWhite)); // Clamp 0-1
            }
            
            // Calculate distance progress for color transition
            // Only transition to white when sun is VERY small (3-4 pixels)
            // Stay yellow/orange until then
            const transitionStart = 800; // Size where we start (full size - doubled to 800)
            const transitionEnd = 4; // Size where transition completes (minimum size)
            const colorTransitionStart = 4; // Only start color shift at 4 pixels!
            
            // Color stays orange/yellow until sun reaches 4 pixels, then transitions to white
            let transitionProgress = 0;
            if (sunSize <= colorTransitionStart) {
                // Transition from 4 pixels to minimum
                transitionProgress = 1.0; // Snap to white when at or below 4 pixels
            }
            
            // Transition from orange to white as distance increases
            // Close: orange/yellow, Far: pure white
            const r = Math.floor(255);
            const g = Math.floor(200 + (55 * transitionProgress)); // 200 -> 255
            const b = Math.floor(100 * transitionProgress); // 0 -> 100 (slight blue tint when far)
            
            if (sunSize > 4 && sunImage.complete && sunImage.naturalHeight !== 0) {
                // Draw sun image
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
                
                // If we're in morph range, blend with white
                if (morphToWhite > 0) {
                    starfieldCtx.save();
                    starfieldCtx.globalAlpha = morphToWhite;
                    starfieldCtx.fillStyle = '#FFFFFF';
                    starfieldCtx.beginPath();
                    starfieldCtx.arc(centerX, centerY, sunSize, 0, Math.PI * 2);
                    starfieldCtx.fill();
                    starfieldCtx.restore();
                }
                
                // Outer glow - transitions from orange to white
                const glowGradient = starfieldCtx.createRadialGradient(
                    centerX, centerY, sunSize,
                    centerX, centerY, sunSize * 1.8
                );
                const glowAlpha = 0.4 * (1 - transitionProgress * 0.5) * (1 - morphToWhite * 0.5); // Fade glow as it morphs
                glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
                glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                
                starfieldCtx.fillStyle = glowGradient;
                starfieldCtx.beginPath();
                starfieldCtx.arc(centerX, centerY, sunSize * 1.8, 0, Math.PI * 2);
                starfieldCtx.fill();
            } else {
                // When tiny, draw as bright white star
                if (sunSize <= 4) {
                    // Small bright star - pure white, only when truly tiny
                    starfieldCtx.fillStyle = '#FFFFFF';
                    starfieldCtx.beginPath();
                    starfieldCtx.arc(centerX, centerY, sunSize, 0, Math.PI * 2);
                    starfieldCtx.fill();
                    
                    // Bright glow around the star
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
                    // Medium size - procedural sun with color transition
                    // Outer glow
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
                    
                    // Sun body - gradient based on distance
                    const bodyGradient = starfieldCtx.createRadialGradient(
                        centerX - sunSize * 0.3, centerY - sunSize * 0.3, sunSize * 0.1,
                        centerX, centerY, sunSize
                    );
                    
                    // Color transitions from yellow/orange to white
                    const centerR = 255;
                    const centerG = Math.floor(250 - (transitionProgress * 5)); // Bright yellow -> white
                    const centerB = Math.floor(205 + (transitionProgress * 50)); // Yellow -> white
                    
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
        
        function drawPlanet(planet, position) {
            const x = centerX + position.x;
            const y = centerY + position.y;
            
            // Try to use loaded image first
            if (planetImages[planet.name]) {
                const img = planetImages[planet.name];
                
                // Draw image as a circle
                starfieldCtx.save();
                starfieldCtx.beginPath();
                starfieldCtx.arc(x, y, planet.size, 0, Math.PI * 2);
                starfieldCtx.clip();
                
                // Draw the image to fill the circle
                starfieldCtx.drawImage(
                    img,
                    x - planet.size,
                    y - planet.size,
                    planet.size * 2,
                    planet.size * 2
                );
                
                starfieldCtx.restore();
                
                // Add subtle shading for 3D effect
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
                // Fallback to procedural rendering
                // Special rendering for Earth - simple blue with green/white
                if (planet.name === 'Earth') {
                    // Base ocean sphere
                    const earthGradient = starfieldCtx.createRadialGradient(
                        x - planet.size * 0.3, y - planet.size * 0.3, planet.size * 0.1,
                        x, y, planet.size
                    );
                    earthGradient.addColorStop(0, '#87CEEB'); // Sky blue
                    earthGradient.addColorStop(0.7, '#4169E1'); // Royal blue
                    earthGradient.addColorStop(1, '#191970'); // Midnight blue
                    starfieldCtx.fillStyle = earthGradient;
                    starfieldCtx.beginPath();
                    starfieldCtx.arc(x, y, planet.size, 0, Math.PI * 2);
                    starfieldCtx.fill();
                    
                    // Simple land masses
                    starfieldCtx.fillStyle = '#228B22';
                    starfieldCtx.globalAlpha = 1.0;
                    
                    starfieldCtx.beginPath();
                    starfieldCtx.ellipse(x + planet.size * 0.2, y - planet.size * 0.1, planet.size * 0.35, planet.size * 0.25, 0.5, 0, Math.PI * 2);
                    starfieldCtx.fill();
                    
                    starfieldCtx.beginPath();
                    starfieldCtx.ellipse(x - planet.size * 0.3, y + planet.size * 0.2, planet.size * 0.2, planet.size * 0.15, -0.3, 0, Math.PI * 2);
                    starfieldCtx.fill();
                    
                    // Ice caps
                    starfieldCtx.fillStyle = '#FFFFFF';
                    starfieldCtx.beginPath();
                    starfieldCtx.arc(x, y - planet.size * 0.75, planet.size * 0.25, 0, Math.PI * 2);
                    starfieldCtx.fill();
                    starfieldCtx.beginPath();
                    starfieldCtx.arc(x + planet.size * 0.4, y - planet.size * 0.25, planet.size * 0.15, 0, Math.PI * 2);
                    starfieldCtx.fill();
                    
                    starfieldCtx.globalAlpha = 1.0;
                } else {
                    // Standard gradient rendering
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
            
            // Saturn's rings (always drawn procedurally)
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
        
        // Generate random asteroids for the belt
        function generateAsteroids() {
            asteroids = [];
            const numAsteroids = 120; // Increased for dense asteroid belt effect
            
            for (let i = 0; i < numAsteroids; i++) {
                // Random size - mix of large, medium, and small
                const sizeCategory = Math.random();
                let baseSize;
                if (sizeCategory < 0.1) baseSize = 40 + Math.random() * 40; // 10% very large
                else if (sizeCategory < 0.3) baseSize = 20 + Math.random() * 20; // 20% large
                else if (sizeCategory < 0.6) baseSize = 10 + Math.random() * 10; // 30% medium
                else baseSize = 3 + Math.random() * 7; // 40% small
                
                // Vertical spread across screen
                const startY = (Math.random() - 0.5) * starfieldCanvas.height * 1.5;
                
                // Stagger start positions for continuous flow
                // In reverse mode, start on left; normal mode, start on right
                const startX = cameraReversed 
                    ? -starfieldCanvas.width * 0.6 - (Math.random() * starfieldCanvas.width * 2)
                    : starfieldCanvas.width * 0.6 + (Math.random() * starfieldCanvas.width * 2);
                
                // Random rotation and speed
                const rotation = Math.random() * Math.PI * 2;
                const rotationSpeed = (Math.random() - 0.5) * 0.02;
                const speed = 2 + Math.random() * 3; // Horizontal speed
                
                // Create irregular shape (8-10 points for simpler, chunkier look)
                const numPoints = 8 + Math.floor(Math.random() * 3);
                const shape = [];
                for (let j = 0; j < numPoints; j++) {
                    const angle = (j / numPoints) * Math.PI * 2;
                    const radius = baseSize * (0.7 + Math.random() * 0.3); // Less variation for smoother outline
                    shape.push({ angle, radius });
                }
                
                // Gray-brown colors like the reference image
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
                    depth: Math.random() // For parallax
                });
            }
        }
        
        function drawAsteroid(asteroid, scale) {
            const size = asteroid.baseSize * scale;
            if (size < 0.5) return; // Too small to render
            
            starfieldCtx.save();
            starfieldCtx.translate(centerX + asteroid.x, centerY + asteroid.y);
            starfieldCtx.rotate(asteroid.rotation);
            
            // Draw irregular asteroid shape with moderate rounding
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
                
                // Calculate positions along edges
                const t = 0.35; // How far from vertex to start curve (0.35 = 35% from vertex)
                
                if (i === 0) {
                    // Start position
                    const startX = prevX * t + currentX * (1 - t);
                    const startY = prevY * t + currentY * (1 - t);
                    starfieldCtx.moveTo(startX, startY);
                }
                
                // End position for this curve
                const endX = currentX * (1 - t) + nextX * t;
                const endY = currentY * (1 - t) + nextY * t;
                
                // Draw curve through the vertex point
                starfieldCtx.quadraticCurveTo(currentX, currentY, endX, endY);
            }
            
            starfieldCtx.closePath();
            
            // Draw multiple layers of the asteroid shape at different scales and colors
            // This creates a gradient that follows the irregular shape
            const layers = 16; // More layers = smoother gradient
            
            for (let layer = layers; layer >= 0; layer--) {
                const layerProgress = layer / layers;
                const layerScale = 0.3 + (layerProgress * 0.7); // Scale from 30% to 100%
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
                
                // Smaller range - from medium-light (center) to darker (edges)
                const r = Math.round(125 - layerProgress * 50); // 125 to 75
                const g = Math.round(120 - layerProgress * 49); // 120 to 71
                const b = Math.round(115 - layerProgress * 48); // 115 to 67
                
                starfieldCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                starfieldCtx.fill();
            }
            
            // Add subtle edge highlight
            starfieldCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            starfieldCtx.lineWidth = 0.5;
            starfieldCtx.stroke();
            
            starfieldCtx.restore();
        }
        
        // Helper functions for planet shading
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
        
        function animateStarfield() {
            starfieldCtx.fillStyle = '#000';
            starfieldCtx.fillRect(0, 0, starfieldCanvas.width, starfieldCanvas.height);
            
            // Draw sun in background (only when game is running and camera is facing sun)
            if (gameRunning && !cameraReversed) {
                drawSun();
                if (!paused) {
                    journeyProgress += 2; // Move away from sun only when not paused
                }
            } else if (gameRunning && !paused) {
                journeyProgress += 2; // Still track progress even if sun not visible
            }
            
            // Draw planets that have been unlocked by level progression
            if (gameRunning) {
                planets.forEach((planet, index) => {
                    // Handle Asteroid Belt specially
                    if (planet.isAsteroidBelt) {
                        if (currentGameLevel >= planet.level && !asteroidBeltShown) {
                            asteroidBeltActive = true;
                            asteroidBeltShown = true; // Mark as shown
                            asteroidBeltProgress = 0;
                            generateAsteroids();
                            showPlanetStats(planet);
                        }
                        return; // Skip normal planet rendering
                    }
                    
                    // Start planet animation when level is reached
                    if (currentGameLevel >= planet.level && !planetAnimations[planet.name]) {
                        // Show planet stats when it appears
                        showPlanetStats(planet);
                        
                        if (cameraReversed) {
                            // Reversed: start small at center
                            planetAnimations[planet.name] = {
                                progress: 0,
                                startX: 0,
                                startY: 0,
                                targetX: (index % 2 === 0 ? -1 : 1) * (starfieldCanvas.width * 0.6 + 200),
                                targetY: ((index % 4) - 1.5) * 100
                            };
                        } else {
                            // Normal: start large at edge (original behavior)
                            planetAnimations[planet.name] = {
                                progress: 0,
                                startX: (index % 2 === 0 ? -1 : 1) * (starfieldCanvas.width * 0.65 + 200),
                                startY: ((index % 4) - 1.5) * 100
                            };
                        }
                    }
                    
                    // Animate planet if it's active
                    const anim = planetAnimations[planet.name];
                    if (anim !== undefined) {
                        const progress = anim.progress;
                        
                        if (progress < 3000) {
                            if (cameraReversed) {
                                // Reversed camera: start tiny at center, grow and move to edge
                                // Start visible immediately but grow slowly
                                const moveProgress = progress / 3000;
                                // Gentler ease - visible immediately, steady slow growth, speeds up at end
                                const easedProgress = Math.pow(moveProgress, 1.8); // Gentle ease
                                const scaleProgress = Math.pow(moveProgress, 1.5); // Even gentler - visible sooner
                                // Start at 0.1 scale (visible dot) and grow to 15
                                const scale = Math.max(0.1, scaleProgress * 15); // Start at 0.1 instead of 0.01
                                const driftX = anim.targetX * easedProgress;
                                const driftY = anim.targetY * easedProgress;
                                
                                const actualSize = Math.max(1, planet.size * scale);
                                const scaledPlanet = {
                                    ...planet,
                                    size: actualSize
                                };
                                drawPlanet(scaledPlanet, { x: driftX, y: driftY });
                            } else {
                                // Normal camera: start large at edge, shrink and move to center (ORIGINAL)
                                const moveProgress = progress / 3000;
                                // Slower start: use cubic ease-out for very gentle beginning
                                const easedProgress = 1 - Math.pow(1 - moveProgress, 3); // Slower at start, faster at end
                                const scaleProgress = 1 - Math.pow(1 - moveProgress, 2.5); // Ease-in-out for shrinking (slows at end)
                                const scale = Math.max(0.01, 15 - (scaleProgress * 15));
                                const driftX = anim.startX * (1 - easedProgress * 0.98);
                                const driftY = anim.startY * (1 - easedProgress * 0.98);
                                
                                const actualSize = Math.max(1, planet.size * scale);
                                const scaledPlanet = {
                                    ...planet,
                                    size: actualSize
                                };
                                drawPlanet(scaledPlanet, { x: driftX, y: driftY });
                            }
                            
                            if (!paused) {
                                anim.progress++;
                            }
                            
                            // Hide planet stats when animation completes
                            if (anim.progress >= 3000) {
                                hidePlanetStats();
                            }
                        }
                    }
                });
                
                // Draw and animate asteroid belt
                if (asteroidBeltActive) {
                    const duration = 1500; // Animation duration for scaling
                    
                    // Continue animating until all asteroids are off screen
                    let allOffScreen = true;
                    
                    // Update and draw each asteroid
                    asteroids.forEach(asteroid => {
                        // Move based on camera direction
                        if (!paused) {
                            if (cameraReversed) {
                                // Reverse mode: move right (left to right)
                                asteroid.x += asteroid.speed * (1 + asteroid.depth * 0.5); // Parallax
                            } else {
                                // Normal mode: move left (right to left)
                                asteroid.x -= asteroid.speed * (1 + asteroid.depth * 0.5); // Parallax
                            }
                            asteroid.rotation += asteroid.rotationSpeed;
                        }
                        
                        // Check if any asteroid is still visible (depends on direction)
                        if (cameraReversed) {
                            if (asteroid.x < starfieldCanvas.width * 0.6) {
                                allOffScreen = false;
                            }
                        } else {
                            if (asteroid.x > -starfieldCanvas.width * 0.6) {
                                allOffScreen = false;
                            }
                        }
                        
                        // Scale based on progress
                        const progress = Math.min(asteroidBeltProgress / duration, 1);
                        const scale = cameraReversed 
                            ? 0.5 + progress * 1.5  // Reverse: start small (0.5), grow to large (2.0)
                            : 2 - progress * 1.5;   // Normal: start large (2.0), shrink to small (0.5)
                        
                        // Only draw if on screen
                        if (asteroid.x > -starfieldCanvas.width * 0.6 && 
                            asteroid.x < starfieldCanvas.width * 0.6) {
                            drawAsteroid(asteroid, scale);
                        }
                    });
                    
                    if (!paused) {
                        asteroidBeltProgress++;
                    }
                    
                    // Hide stats when animation completes (scale animation done)
                    if (asteroidBeltProgress >= duration) {
                        hidePlanetStats();
                    }
                    
                    // Deactivate when all asteroids are off screen
                    if (allOffScreen) {
                        asteroidBeltActive = false;
                    }
                }
            }
            
            // Draw stars
            stars.forEach(star => {
                if (cameraReversed) {
                    // Reversed camera: stars move toward us (sun behind)
                    star.z -= starSpeed;
                    
                    // Reset star if it passes viewer
                    if (star.z <= 0) {
                        star.x = (Math.random() - 0.5) * 2000;
                        star.y = (Math.random() - 0.5) * 2000;
                        star.z = maxDepth;
                    }
                } else {
                    // Normal camera: stars move away from us (facing sun)
                    star.z += starSpeed;
                    
                    // Reset star if it gets too far
                    if (star.z >= maxDepth) {
                        star.x = (Math.random() - 0.5) * 2000;
                        star.y = (Math.random() - 0.5) * 2000;
                        star.z = 1;
                    }
                }
                
                // Project 3D coordinates to 2D screen
                const k = 128 / star.z;
                const px = star.x * k + centerX;
                const py = star.y * k + centerY;
                
                // Only draw if on screen
                if (px >= 0 && px <= starfieldCanvas.width && 
                    py >= 0 && py <= starfieldCanvas.height) {
                    
                    // Size and brightness based on depth (closer = bigger and brighter)
                    const size = (1 - star.z / maxDepth) * 2;
                    const opacity = 1 - star.z / maxDepth;
                    
                    starfieldCtx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                    starfieldCtx.beginPath();
                    starfieldCtx.arc(px, py, size, 0, Math.PI * 2);
                    starfieldCtx.fill();
                    
                    // Draw motion trail
                    if (cameraReversed) {
                        // Reversed: trails for stars closer to viewer (moving toward us)
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
                        // Normal: trails for stars closer to center (moving away from us)
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
            
            // Draw UFO on the starfield (visible across entire background)
            drawUFO();
            
            requestAnimationFrame(animateStarfield);
        }
        
        animateStarfield();
        
        // UFO Easter Egg Function - stub for now
        function drawUFO() {
            // UFO easter egg not yet implemented in modular version
            // This prevents the ReferenceError
        }
        
        // Placeholder functions - these should be defined in game-core.js or UI module
        function showPlanetStats(planet) {
            // This will be overridden by the actual implementation
            console.log('Planet stats:', planet.name);
        }
        
        function hidePlanetStats() {
            // This will be overridden by the actual implementation
        }
