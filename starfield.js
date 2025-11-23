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
        
        // ============================================
        // DEVICE DETECTION & TABLET MODE SYSTEM
        // ============================================
        
        
                console.log('📱 Device detected:', deviceType);
                console.log('   Touch:', DeviceDetection.isTouch);
                console.log('   Mobile:', DeviceDetection.isMobile);
                console.log('   Tablet:', DeviceDetection.isTablet);
                
                // Enable tablet mode if mobile/tablet AND no controller
                this.updateMode();
            },
            
            updateMode() {
                // Enable if: (mobile OR tablet) AND no controller connected
                // OR manual override is active (for testing)
                const shouldEnable = this.manualOverride || 
                                   ((DeviceDetection.isMobile || DeviceDetection.isTablet) && 
                                    !GamepadController.connected);
                
                if (shouldEnable !== this.enabled) {
                    this.enabled = shouldEnable;
                    this.applyMode();
                    console.log('📱 Tablet mode:', this.enabled ? 'ENABLED' : 'DISABLED');
                }
            },
            
            applyMode() {
                const touchControls = document.getElementById('touchControls');
                const planetStats = document.getElementById('planetStats');
                const planetStatsLeft = document.getElementById('planetStatsLeft');
                const controls = document.querySelector('.controls');
                const pauseBtn = document.getElementById('pauseBtn');
                const settingsBtn = document.getElementById('settingsBtn');
                
                if (this.enabled) {
                    // Show touch controls in right panel
                    if (touchControls) touchControls.style.display = 'grid';
                    // Hide keyboard controls
                    if (controls) controls.style.display = 'none';
                    // Hide planet stats from right panel
                    if (planetStats) planetStats.style.display = 'none';
                    // Show planet stats in left panel
                    if (planetStatsLeft) planetStatsLeft.style.display = 'block';
                    // Show pause button (will be toggled by game state)
                    if (pauseBtn) pauseBtn.style.display = 'block';
                    // Hide settings button in tablet mode during gameplay
                    if (settingsBtn && !settingsBtn.classList.contains('hidden-during-play')) {
                        settingsBtn.style.display = 'none';
                    }
                } else {
                    // Hide touch controls
                    if (touchControls) touchControls.style.display = 'none';
                    // Show keyboard controls
                    if (controls) controls.style.display = 'block';
                    // Show planet stats in right panel (when active)
                    // Hide planet stats from left panel
                    if (planetStatsLeft) planetStatsLeft.style.display = 'none';
                    // Hide pause button
                    if (pauseBtn) pauseBtn.style.display = 'none';
                    // Show settings button in normal mode
                    if (settingsBtn) settingsBtn.style.display = 'block';
                }
            },
            
            toggle() {
                // Toggle manual override for testing
                this.manualOverride = !this.manualOverride;
                this.updateMode();
            }
        };
        
        // Initialize device detection
        DeviceDetection.detect();
        
        // ============================================
        // END DEVICE DETECTION & TABLET MODE
        // ============================================
        
        // Log capture system - FIFO queue for copying console logs
        // Press CTRL+D to copy all captured logs to clipboard
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
