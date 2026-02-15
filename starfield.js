// ============================================
// STARFIELD MODULE - Space Background System
// ============================================
// Handles: Stars, Sun, Planets, Asteroid Belt, UFO

const StarfieldSystem = (function() {
    // Canvas and context
    const starfieldCanvas = document.getElementById('starfield');
    const starfieldCtx = starfieldCanvas.getContext('2d');
    
    // Create separate UFO canvas for independent z-index control
    const ufoCanvas = document.createElement('canvas');
    ufoCanvas.id = 'ufoCanvas';
    ufoCanvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        min-height: 100%;
        z-index: 0;
        pointer-events: none;
        border: none;
        margin: 0;
        padding: 0;
        display: block;
        object-fit: fill;
    `;
    document.body.appendChild(ufoCanvas);
    const ufoCtx = ufoCanvas.getContext('2d');
    
    // Initialize UFO canvas size to match starfield
    ufoCanvas.width = window.innerWidth * 1.1;
    ufoCanvas.height = window.innerHeight * 1.1;
    
    // Stars configuration
    const stars = [];
    const numStars = 400;
    let starSpeed = 1;
    let starsEnabled = true;
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
    let ufoCompletedCircle = false; // Track if circle completed naturally (not departed early)
    let ufoSwoopTargetX = 0;
    let ufoSwoopTargetY = 0;
    let ufoSwoopCallback = null; // Callback when swoop completes
    let ufoZIndexBoosted = false; // Track if canvas z-index has been raised
    
    // Stranger Mode - Upside Down particles (ash/spore flakes)
    let strangerMode = false;
    const ashParticles = [];
    const numAshParticles = 150;
    
    // Initialize ash particles
    function initAshParticles() {
        ashParticles.length = 0;
        for (let i = 0; i < numAshParticles; i++) {
            ashParticles.push(createAshParticle(true));
        }
    }
    
    function createAshParticle(initialSpread = false) {
        // Use actual canvas dimensions
        const w = starfieldCanvas.width || 1920;
        const h = starfieldCanvas.height || 1080;
        
        return {
            x: initialSpread ? Math.random() * w : Math.random() * w,
            y: initialSpread ? Math.random() * h : -20 - Math.random() * 50,
            size: 2 + Math.random() * 4,  // Slightly larger, 2-6 pixels
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.002, // Even slower rotation
            driftX: (Math.random() - 0.5) * 0.08,  // Even more subtle horizontal drift
            driftY: 0.02 + Math.random() * 0.05,   // Much slower downward drift
            wobblePhase: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.005 + Math.random() * 0.01,
            opacity: 0.15 + Math.random() * 0.35,  // Semi-transparent
            // Irregular shape - random number of points
            points: Math.floor(3 + Math.random() * 4), // 3-6 points
            irregularity: []
        };
    }
    
    // Generate irregular shape points
    function generateIrregularShape(particle) {
        particle.irregularity = [];
        for (let i = 0; i < particle.points; i++) {
            particle.irregularity.push(0.5 + Math.random() * 0.5); // 50-100% of radius
        }
    }
    
    // Draw floating ash particles
    function drawAshParticles() {
        const w = starfieldCanvas.width;
        const h = starfieldCanvas.height;
        
        ashParticles.forEach(particle => {
            // Subtle wobble
            particle.wobblePhase += particle.wobbleSpeed;
            const wobbleX = Math.sin(particle.wobblePhase) * 0.15;
            
            // Very slow drift
            particle.x += particle.driftX + wobbleX;
            particle.y += particle.driftY;
            particle.rotation += particle.rotationSpeed;
            
            // Wrap around screen
            if (particle.y > h + 20) {
                particle.y = -20;
                particle.x = Math.random() * w;
            }
            if (particle.x < -20) particle.x = w + 20;
            if (particle.x > w + 20) particle.x = -20;
            
            // Generate shape if not done
            if (particle.irregularity.length === 0) {
                generateIrregularShape(particle);
            }
            
            // Draw irregular flake shape
            starfieldCtx.save();
            starfieldCtx.translate(particle.x, particle.y);
            starfieldCtx.rotate(particle.rotation);
            starfieldCtx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
            
            starfieldCtx.beginPath();
            for (let i = 0; i < particle.points; i++) {
                const angle = (i / particle.points) * Math.PI * 2;
                const radius = particle.size * particle.irregularity[i];
                const px = Math.cos(angle) * radius;
                const py = Math.sin(angle) * radius;
                if (i === 0) {
                    starfieldCtx.moveTo(px, py);
                } else {
                    starfieldCtx.lineTo(px, py);
                }
            }
            starfieldCtx.closePath();
            starfieldCtx.fill();
            
            starfieldCtx.restore();
        });
    }
    
    // Static vine rope wrapping around canvas edges - per-canvas cache
    const vineCanvasCache = new Map();
    
    function generateVineCache(width, height) {
        // Create offscreen canvas for static vines
        const cacheCanvas = document.createElement('canvas');
        cacheCanvas.width = width;
        cacheCanvas.height = height;
        const cacheCtx = cacheCanvas.getContext('2d');
        
        // Draw a rope that wraps around the entire perimeter ON the edge
        drawWrappingVineRope(cacheCtx, width, height);
        
        return cacheCanvas;
    }
    
    function drawWrappingVineRope(ctx, width, height) {
        // Vine colors - darker and more sinister with prominent red streaks
        const baseColor = 'rgba(10, 5, 3, 0.98)';         // Nearly black
        const darkColor = 'rgba(5, 2, 1, 0.98)';          // Almost pure black
        const accentColor = 'rgba(100, 15, 10, 0.9)';     // Brighter blood red
        const redHighlight = 'rgba(140, 20, 15, 0.85)';   // Even brighter red for highlights
        
        const ropeWidth = Math.min(width, height) * 0.025; // Thinner rope
        
        // Generate wavy path points around the perimeter - ON the edge (0 offset)
        const points = [];
        const segments = 80;
        const perimeter = 2 * width + 2 * height;
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const dist = t * perimeter;
            
            let x, y, normalX, normalY;
            
            if (dist < width) {
                // Top edge
                x = dist;
                y = 0;
                normalX = 0;
                normalY = 1;
            } else if (dist < width + height) {
                // Right edge
                x = width;
                y = dist - width;
                normalX = -1;
                normalY = 0;
            } else if (dist < 2 * width + height) {
                // Bottom edge
                x = width - (dist - width - height);
                y = height;
                normalX = 0;
                normalY = -1;
            } else {
                // Left edge
                x = 0;
                y = height - (dist - 2 * width - height);
                normalX = 1;
                normalY = 0;
            }
            
            // Subtle waviness along the edge
            const wave = Math.sin(i * 1.2) * (ropeWidth * 0.2);
            x += normalX * wave;
            y += normalY * wave;
            
            points.push({ x, y, normalX, normalY });
        }
        
        // Draw the main rope body
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Base rope layer
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = ropeWidth;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        
        // Draw twisted strand lines along the rope (creates rope texture)
        // More strands, with more reds
        const numStrands = 6;
        for (let strand = 0; strand < numStrands; strand++) {
            // More red strands than dark: pattern is dark, red, red highlight, dark, red, red highlight
            let strandColor;
            if (strand % 3 === 0) {
                strandColor = darkColor;
            } else if (strand % 3 === 1) {
                strandColor = accentColor;
            } else {
                strandColor = redHighlight;
            }
            ctx.strokeStyle = strandColor;
            ctx.lineWidth = ropeWidth * 0.15;
            
            ctx.beginPath();
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                // Spiral offset around the rope
                const spiralPhase = (i * 0.6) + (strand * Math.PI * 2 / numStrands);
                const spiralOffset = Math.sin(spiralPhase) * (ropeWidth * 0.35);
                
                const px = p.x + p.normalX * spiralOffset;
                const py = p.y + p.normalY * spiralOffset;
                
                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.stroke();
        }
        
        // Add some darker patches/shadows for depth
        ctx.strokeStyle = darkColor;
        ctx.lineWidth = ropeWidth * 0.3;
        for (let i = 10; i < points.length - 10; i += 15) {
            const startIdx = i;
            const endIdx = Math.min(i + 5, points.length - 1);
            ctx.beginPath();
            ctx.moveTo(points[startIdx].x, points[startIdx].y);
            for (let j = startIdx + 1; j <= endIdx; j++) {
                ctx.lineTo(points[j].x, points[j].y);
            }
            ctx.stroke();
        }
        
        // Add small tendrils/offshoots occasionally pointing inward
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = ropeWidth * 0.2;
        for (let i = 8; i < points.length - 8; i += 10) {
            if (Math.random() > 0.5) {
                const p = points[i];
                const tendrilLen = ropeWidth * (0.8 + Math.random() * 1.2);
                const tendrilAngle = Math.atan2(p.normalY, p.normalX) + (Math.random() - 0.5) * 0.5;
                
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                
                // Curvy tendril pointing inward
                const endX = p.x + Math.cos(tendrilAngle) * tendrilLen;
                const endY = p.y + Math.sin(tendrilAngle) * tendrilLen;
                
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        }
    }
    
    // Draw vines overlay from cache
    function drawVinesOverlay(targetCanvas, targetCtx) {
        const width = targetCanvas.width;
        const height = targetCanvas.height;
        const cacheKey = `${width}x${height}`;
        
        // Generate cache if not exists for this size
        if (!vineCanvasCache.has(cacheKey)) {
            vineCanvasCache.set(cacheKey, generateVineCache(width, height));
        }
        
        // Draw cached vines
        targetCtx.drawImage(vineCanvasCache.get(cacheKey), 0, 0);
    }
    
    // Create vine overlays that wrap AROUND target elements
    // Use a Map to track multiple overlays (e.g., game canvas and next piece canvas)
    const vineOverlays = new Map(); // Map<targetElement, {canvas, ctx, wrapper}>
    
    function createVineOverlay(targetElement) {
        // Remove existing overlay for this element if any
        removeVineOverlayFor(targetElement);
        
        // Create wrapper with position:relative to contain the overlay
        const wrapper = document.createElement('div');
        wrapper.className = 'vineWrapper';
        
        // For nextCanvas, preserve centering by using block display with auto margins
        const isNextCanvas = targetElement.id === 'nextCanvas';
        if (isNextCanvas) {
            wrapper.style.cssText = 'position: relative; display: block; margin-left: auto; margin-right: auto; width: fit-content;';
        } else {
            wrapper.style.cssText = 'position: relative; display: inline-block;';
        }
        
        // Insert wrapper before canvas, move canvas into wrapper
        targetElement.parentNode.insertBefore(wrapper, targetElement);
        wrapper.appendChild(targetElement);
        
        // Create overlay canvas
        const overlayCanvas = document.createElement('canvas');
        overlayCanvas.className = 'vineOverlay';
        overlayCanvas.style.cssText = `
            position: absolute;
            pointer-events: none;
            z-index: 100;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
        `;
        
        // Add overlay to wrapper (after canvas)
        wrapper.appendChild(overlayCanvas);
        const overlayCtx = overlayCanvas.getContext('2d');
        
        // Store in map
        vineOverlays.set(targetElement, {
            canvas: overlayCanvas,
            ctx: overlayCtx,
            wrapper: wrapper
        });
        
        // Position and draw after layout settles
        requestAnimationFrame(() => {
            positionAndDrawVinesFor(targetElement);
        });
        
        return overlayCanvas;
    }
    
    function positionAndDrawVinesFor(targetElement) {
        const overlay = vineOverlays.get(targetElement);
        if (!overlay) return;
        
        const { canvas: overlayCanvas, ctx: overlayCtx, wrapper } = overlay;
        const extend = 15;
        
        // Check for perspective modes on EITHER canvas or wrapper (we transfer them to wrapper)
        const hasLongAgo = targetElement.classList.contains('longago-mode') || wrapper.classList.contains('longago-mode');
        const hasComingSoon = targetElement.classList.contains('comingsoon-mode') || wrapper.classList.contains('comingsoon-mode');
        const hasThinner = targetElement.classList.contains('thinner-mode') || wrapper.classList.contains('thinner-mode');
        const hasThicker = targetElement.classList.contains('thicker-mode') || wrapper.classList.contains('thicker-mode');
        
        // Transfer perspective classes to wrapper (they'll be applied via CSS)
        wrapper.classList.toggle('longago-mode', hasLongAgo);
        wrapper.classList.toggle('comingsoon-mode', hasComingSoon);
        wrapper.classList.toggle('thinner-mode', hasThinner);
        wrapper.classList.toggle('thicker-mode', hasThicker);
        
        // For perspective modes, remove from canvas to avoid double-transform
        if (hasLongAgo || hasComingSoon) {
            targetElement.classList.remove('longago-mode', 'comingsoon-mode', 'thinner-mode', 'thicker-mode');
        }
        
        // Get the BASE size of the canvas (before transforms)
        const width = targetElement.width || targetElement.offsetWidth;
        const height = targetElement.height || targetElement.offsetHeight;
        
        // Set overlay size
        const overlayWidth = width + extend * 2;
        const overlayHeight = height + extend * 2;
        
        overlayCanvas.width = overlayWidth;
        overlayCanvas.height = overlayHeight;
        overlayCanvas.style.width = overlayWidth + 'px';
        overlayCanvas.style.height = overlayHeight + 'px';
        
        // Position overlay: canvas is at (0,0) in wrapper, so offset by -extend
        overlayCanvas.style.left = -extend + 'px';
        overlayCanvas.style.top = -extend + 'px';
        
        // Clear and draw
        overlayCtx.clearRect(0, 0, overlayWidth, overlayHeight);
        
        // Draw vines - the canvas edge is at 'extend' pixels from overlay edge
        drawWrappingRope(overlayCtx, extend, extend, width, height);
    }
    
    function removeVineOverlayFor(targetElement) {
        const overlay = vineOverlays.get(targetElement);
        if (!overlay) return;
        
        const { canvas: overlayCanvas, wrapper } = overlay;
        
        // Restore perspective classes to canvas from wrapper
        if (wrapper.classList.contains('longago-mode')) {
            targetElement.classList.add('longago-mode');
        }
        if (wrapper.classList.contains('comingsoon-mode')) {
            targetElement.classList.add('comingsoon-mode');
        }
        if (wrapper.classList.contains('thinner-mode')) {
            targetElement.classList.add('thinner-mode');
        }
        if (wrapper.classList.contains('thicker-mode')) {
            targetElement.classList.add('thicker-mode');
        }
        
        // Remove overlay canvas
        if (overlayCanvas && overlayCanvas.parentNode) {
            overlayCanvas.parentNode.removeChild(overlayCanvas);
        }
        
        // Unwrap the target element
        if (wrapper && wrapper.parentNode) {
            wrapper.parentNode.insertBefore(targetElement, wrapper);
            wrapper.parentNode.removeChild(wrapper);
        }
        
        vineOverlays.delete(targetElement);
    }
    
    function removeVineOverlay() {
        // Remove all vine overlays
        for (const targetElement of vineOverlays.keys()) {
            removeVineOverlayFor(targetElement);
        }
    }
    
    // Alias for compatibility
    function updateVineOverlayPosition(targetElement) {
        positionAndDrawVinesFor(targetElement);
    }
    
    function drawWrappingVineOverlay(targetElement) {
        positionAndDrawVinesFor(targetElement);
    }
    
    function drawWrappingRope(ctx, offsetX, offsetY, innerWidth, innerHeight) {
        const baseRopeWidth = Math.min(innerWidth, innerHeight) * 0.015;
        const coilFrequency = 0.18; // Less frequent coiling
        
        // Generate path points around the perimeter
        const points = [];
        const segments = 180;
        const perimeter = 2 * innerWidth + 2 * innerHeight;
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const dist = t * perimeter;
            
            let x, y, normalX, normalY;
            
            if (dist < innerWidth) {
                x = offsetX + dist;
                y = offsetY;
                normalX = 0;
                normalY = 1;
            } else if (dist < innerWidth + innerHeight) {
                x = offsetX + innerWidth;
                y = offsetY + (dist - innerWidth);
                normalX = -1;
                normalY = 0;
            } else if (dist < 2 * innerWidth + innerHeight) {
                x = offsetX + innerWidth - (dist - innerWidth - innerHeight);
                y = offsetY + innerHeight;
                normalX = 0;
                normalY = -1;
            } else {
                x = offsetX;
                y = offsetY + innerHeight - (dist - 2 * innerWidth - innerHeight);
                normalX = 1;
                normalY = 0;
            }
            
            const coilPhase = i * coilFrequency;
            const coilSin = Math.sin(coilPhase);
            
            // Much smaller offset - stays close to the edge
            const coilOffset = coilSin * baseRopeWidth * 0.25;
            x += normalX * coilOffset;
            y += normalY * coilOffset;
            
            const depth = (coilSin + 1) / 2;
            
            points.push({ x, y, normalX, normalY, coilSin, depth, idx: i });
        }
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Draw continuous rope with subtle shading
        for (let i = 1; i < points.length; i++) {
            const p = points[i];
            const prevP = points[i - 1];
            
            const r = Math.floor(15 + p.depth * 30);
            const g = Math.floor(8 + p.depth * 15);
            const b = Math.floor(5 + p.depth * 12);
            
            // Subtle width variation
            const width = baseRopeWidth * (0.85 + p.depth * 0.2);
            
            ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(prevP.x, prevP.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        }
        
        // Subtle red veins
        ctx.lineWidth = baseRopeWidth * 0.1;
        ctx.strokeStyle = 'rgba(60, 15, 10, 0.5)';
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (p.depth > 0.5) {
                const offset = Math.sin(i * 0.5) * baseRopeWidth * 0.15;
                const vx = p.x + p.normalX * offset;
                const vy = p.y + p.normalY * offset;
                if (!started) {
                    ctx.moveTo(vx, vy);
                    started = true;
                } else {
                    ctx.lineTo(vx, vy);
                }
            } else if (started) {
                ctx.stroke();
                ctx.beginPath();
                started = false;
            }
        }
        if (started) ctx.stroke();
        
        // Small tendrils
        ctx.strokeStyle = 'rgba(25, 12, 8, 0.6)';
        ctx.lineWidth = baseRopeWidth * 0.08;
        for (let i = 20; i < points.length - 20; i += 25) {
            const p = points[i];
            if (p.depth > 0.6) {
                const len = baseRopeWidth * (0.5 + Math.random() * 0.4);
                const angle = Math.atan2(p.normalY, p.normalX) + (Math.random() - 0.5) * 0.3;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(
                    p.x + Math.cos(angle) * len,
                    p.y + Math.sin(angle) * len
                );
                ctx.stroke();
            }
        }
    }
    
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
        if (!planet.imageUrl) {
            imagesLoaded++;
            return; // Skip planets without images (e.g., Asteroid Belt)
        }
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
    
    // Sun image (normal mode)
    const sunImage = new Image();
    sunImage.crossOrigin = 'anonymous';
    sunImage.onload = () => { console.log('Sun image loaded'); };
    sunImage.onerror = () => { console.log('Sun image failed to load, using procedural'); };
    sunImage.src = 'https://upload.wikimedia.org/wikipedia/commons/b/b4/The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg';
    
    // Alternate sun image (minimalist mode)
    const sunImageMinimalist = new Image();
    sunImageMinimalist.crossOrigin = 'anonymous';
    sunImageMinimalist.onload = () => { console.log('Minimalist sun image loaded'); };
    sunImageMinimalist.onerror = () => { console.log('Minimalist sun image failed to load'); };
    sunImageMinimalist.src = 'https://res.cloudinary.com/dzlhmwvlx/image/upload/v1764973199/gettyimages-1406174121_gjatmr.jpg';
    
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
    let minimalistMode = false;
    
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
        
        // Also resize UFO canvas
        ufoCanvas.width = starfieldCanvas.width;
        ufoCanvas.height = starfieldCanvas.height;
        
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
        const maxSunSize = Math.min(320, starfieldCanvas.height * 0.3);
        const rawSize = maxSunSize - (easedRatio * (maxSunSize - 4));
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
        
        // Normal sun colors (yellow/orange)
        const r = 255;
        const g = Math.floor(200 + (55 * transitionProgress));
        const b = Math.floor(100 * transitionProgress);
        
        // Apply darkening filter in stranger mode
        if (strangerMode) {
            starfieldCtx.save();
            starfieldCtx.globalAlpha = 0.4; // Dim to 40%
        }
        
        // Select sun image based on mode
        const activeSunImage = minimalistMode ? sunImageMinimalist : sunImage;
        
        if (sunSize > 4 && activeSunImage.complete && activeSunImage.naturalHeight !== 0) {
            starfieldCtx.save();
            starfieldCtx.beginPath();
            starfieldCtx.arc(centerX, centerY, sunSize, 0, Math.PI * 2);
            starfieldCtx.clip();
            
            starfieldCtx.drawImage(
                activeSunImage,
                centerX - sunSize,
                centerY - sunSize,
                sunSize * 2,
                sunSize * 2
            );
            
            starfieldCtx.restore();
            
            if (morphToWhite > 0) {
                starfieldCtx.save();
                starfieldCtx.globalAlpha = strangerMode ? morphToWhite * 0.4 : morphToWhite;
                starfieldCtx.fillStyle = '#FFFFFF';
                starfieldCtx.beginPath();
                starfieldCtx.arc(centerX, centerY, sunSize, 0, Math.PI * 2);
                starfieldCtx.fill();
                starfieldCtx.restore();
            }
            
            const glowGradient = starfieldCtx.createRadialGradient(
                centerX, centerY, sunSize,
                centerX, centerY, sunSize * 1.25
            );
            const glowAlpha = 0.2 * (1 - transitionProgress * 0.5) * (1 - morphToWhite * 0.5);
            glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
            glowGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${glowAlpha * 0.3})`);
            glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            
            starfieldCtx.fillStyle = glowGradient;
            starfieldCtx.beginPath();
            starfieldCtx.arc(centerX, centerY, sunSize * 1.25, 0, Math.PI * 2);
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
                    centerX, centerY, sunSize * 1.25
                );
                const glowAlpha = 0.3 * (1 - transitionProgress * 0.5);
                glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
                glowGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${glowAlpha * 0.3})`);
                glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                
                starfieldCtx.fillStyle = glowGradient;
                starfieldCtx.beginPath();
                starfieldCtx.arc(centerX, centerY, sunSize * 1.25, 0, Math.PI * 2);
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
        
        // Restore from stranger mode darkening
        if (strangerMode) {
            starfieldCtx.restore();
        }
    }
    
    // ============================================
    // PLANET DRAWING
    // ============================================
    
    function drawPlanet(planet, position) {
        const x = centerX + position.x;
        const y = centerY + position.y;
        
        // Apply darkening filter in stranger mode
        if (strangerMode) {
            starfieldCtx.save();
            starfieldCtx.globalAlpha = 0.4; // Dim to 40%
        }
        
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
            const planetColor = planet.color;
            
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
                starfieldCtx.globalAlpha = strangerMode ? 0.4 : 1.0;
                
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
                
                starfieldCtx.globalAlpha = strangerMode ? 0.4 : 1.0;
            } else {
                const bodyGradient = starfieldCtx.createRadialGradient(
                    x - planet.size * 0.3, y - planet.size * 0.3, planet.size * 0.1,
                    x, y, planet.size
                );
                
                bodyGradient.addColorStop(0, lightenColor(planetColor, 40));
                bodyGradient.addColorStop(0.5, planetColor);
                bodyGradient.addColorStop(1, darkenColor(planetColor, 40));
                
                starfieldCtx.fillStyle = bodyGradient;
                starfieldCtx.beginPath();
                starfieldCtx.arc(x, y, planet.size, 0, Math.PI * 2);
                starfieldCtx.fill();
            }
        }
        
        if (planet.hasRings) {
            starfieldCtx.globalAlpha = strangerMode ? 0.4 : 1.0;
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
        
        // Restore from stranger mode darkening
        if (strangerMode) {
            starfieldCtx.restore();
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
        ufoZIndexBoosted = false; // Start behind panels
        
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
                
                // After 2 circles, bring UFO to front (raise UFO canvas z-index)
                if (!ufoZIndexBoosted && ufoCircleAngle > Math.PI * 4) {
                    ufoCanvas.style.zIndex = '10';
                    ufoZIndexBoosted = true;
                    console.log('🛸 UFO now in front of panels');
                }
                
                if (ufoCircleAngle > Math.PI * 6) {
                    // Circle completed naturally - swoop to music info instead of exiting
                    ufoCompletedCircle = true;
                    ufoPhase = 'swooping';
                    ufoBeamOpacity = 0;
                    
                    // Find the songInfo element for swoop target
                    const songInfoEl = document.getElementById('songInfo');
                    if (songInfoEl && songInfoEl.style.display !== 'none') {
                        const songRect = songInfoEl.getBoundingClientRect();
                        ufoSwoopTargetX = songRect.left + songRect.width / 2;
                        ufoSwoopTargetY = songRect.top + songRect.height / 2;
                        console.log('🛸 UFO swooping to music info!');
                    } else {
                        // No music info visible, just exit normally
                        ufoPhase = 'exiting';
                        console.log('🛸 UFO exiting (no music info visible)');
                    }
                }
                break;
            
            case 'swooping':
                // Swoop down to the music info box
                const swoopDx = ufoSwoopTargetX - ufoX;
                const swoopDy = ufoSwoopTargetY - ufoY;
                const swoopDist = Math.sqrt(swoopDx * swoopDx + swoopDy * swoopDy);
                
                if (swoopDist > 15) {
                    // Move toward target at faster speed
                    ufoX += (swoopDx / swoopDist) * ufoSpeed * 2;
                    ufoY += (swoopDy / swoopDist) * ufoSpeed * 2;
                } else {
                    // Reached the music info - trigger callback and exit
                    console.log('🛸 UFO reached music info - delivering special song!');
                    if (ufoSwoopCallback) {
                        ufoSwoopCallback();
                    }
                    ufoPhase = 'exiting';
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
                    // Reset UFO canvas z-index back to normal
                    if (ufoZIndexBoosted) {
                        ufoCanvas.style.zIndex = '0';
                        ufoZIndexBoosted = false;
                    }
                    console.log('🛸 UFO has departed after celebrating the ultimate answer!');
                }
                break;
        }
    }
    
    // Force UFO to depart (when lines change from 42)
    function departUFO() {
        if (!ufoActive) return;
        ufoPhase = 'exiting';
        ufoBeamOpacity = 0;
        console.log('🛸 UFO departing early - lines changed from 42!');
    }
    
    function drawUFO() {
        // Clear UFO canvas
        ufoCtx.clearRect(0, 0, ufoCanvas.width, ufoCanvas.height);
        
        if (!ufoActive) return;
        
        ufoCtx.save();
        
        if (ufoPhase === 'circling' && ufoBeamOpacity > 0) {
            ufoCtx.save();
            ufoCtx.globalAlpha = ufoBeamOpacity;
            
            const gradient = ufoCtx.createLinearGradient(ufoX, ufoY, ufoTargetX, ufoTargetY);
            gradient.addColorStop(0, 'rgba(100, 255, 100, 0.8)');
            gradient.addColorStop(1, 'rgba(100, 255, 100, 0)');
            
            ufoCtx.beginPath();
            ufoCtx.moveTo(ufoX - 20, ufoY);
            ufoCtx.lineTo(ufoX + 20, ufoY);
            ufoCtx.lineTo(ufoTargetX + 10, ufoTargetY + 10);
            ufoCtx.lineTo(ufoTargetX - 10, ufoTargetY + 10);
            ufoCtx.closePath();
            ufoCtx.fillStyle = gradient;
            ufoCtx.fill();
            
            ufoCtx.restore();
        }
        
        const wobble = Math.sin(Date.now() * 0.01) * 2;
        
        ufoCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ufoCtx.beginPath();
        ufoCtx.ellipse(ufoX, ufoY + 25, 35, 8, 0, 0, Math.PI * 2);
        ufoCtx.fill();
        
        const bottomGradient = ufoCtx.createRadialGradient(ufoX, ufoY + 5, 0, ufoX, ufoY + 5, 30);
        bottomGradient.addColorStop(0, '#445566');
        bottomGradient.addColorStop(0.7, '#223344');
        bottomGradient.addColorStop(1, '#112233');
        
        ufoCtx.fillStyle = bottomGradient;
        ufoCtx.beginPath();
        ufoCtx.ellipse(ufoX, ufoY + 5 + wobble, 30, 10, 0, 0, Math.PI * 2);
        ufoCtx.fill();
        
        const domeGradient = ufoCtx.createRadialGradient(ufoX, ufoY - 5, 0, ufoX, ufoY, 20);
        domeGradient.addColorStop(0, 'rgba(150, 200, 255, 0.8)');
        domeGradient.addColorStop(0.5, 'rgba(100, 150, 255, 0.6)');
        domeGradient.addColorStop(1, 'rgba(50, 100, 200, 0.4)');
        
        ufoCtx.fillStyle = domeGradient;
        ufoCtx.beginPath();
        ufoCtx.ellipse(ufoX, ufoY - 5 + wobble, 20, 15, 0, Math.PI, Math.PI * 2);
        ufoCtx.fill();
        
        const lightPhase = Date.now() * 0.005;
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i / 8) + lightPhase;
            const lightX = ufoX + Math.cos(angle) * 25;
            const lightY = ufoY + 5 + Math.sin(angle) * 8 + wobble;
            
            ufoCtx.fillStyle = `rgba(100, 255, 100, ${0.3 + Math.sin(lightPhase + i) * 0.3})`;
            ufoCtx.beginPath();
            ufoCtx.arc(lightX, lightY, 5, 0, Math.PI * 2);
            ufoCtx.fill();
            
            ufoCtx.fillStyle = `rgba(200, 255, 200, ${0.5 + Math.sin(lightPhase + i) * 0.5})`;
            ufoCtx.beginPath();
            ufoCtx.arc(lightX, lightY, 2, 0, Math.PI * 2);
            ufoCtx.fill();
        }
        
        ufoCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ufoCtx.beginPath();
        ufoCtx.ellipse(ufoX - 5, ufoY - 10 + wobble, 8, 5, -Math.PI / 6, 0, Math.PI * 2);
        ufoCtx.fill();
        
        ufoCtx.restore();
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
            
            const _t = (key) => typeof I18n !== 'undefined' ? I18n.t(key) : key;
            
            let html = '';
            
            if (planet.isSun) {
                html = `
                    <div style="font-weight: 600; font-size: max(1.75vh, 9px); margin-bottom: 0.7vh; color: ${planet.color};">
                        ${planet.name}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.35vh 1.1vw; line-height: 1.5; color: #ccc; font-size: max(1.35vh, 8px);">
                        <div><strong style="color: #aaa;">${_t('planet.gravity')}</strong> <span style="color: #6eb5ff; font-weight: 600;">${planet.gravity}×</span> ${_t('planet.earth')}</div>
                        <div><strong style="color: #aaa;">${_t('planet.day')}</strong> ${planet.dayLength}</div>
                        <div><strong style="color: #aaa;">${_t('planet.temperature')}</strong> ${planet.tempMin}°C</div>
                        <div><strong style="color: #aaa;">${_t('planet.type')}</strong> ${_t('planet.gTypeStar')}</div>
                        <div><strong style="color: #aaa;">${_t('planet.radius')}</strong> 696,000 km</div>
                    </div>
                    <div style="margin-top: 0.55vh; font-style: italic; color: #888; font-size: max(1.2vh, 7px);">
                        ${planet.funFact}
                    </div>
                `;
            } else if (planet.isAsteroidBelt) {
                html = `
                    <div style="font-weight: 600; font-size: max(1.75vh, 9px); margin-bottom: 0.7vh; color: #9B9489;">
                        ${planet.name}
                    </div>
                    <div style="line-height: 1.5; color: #ccc;">
                        <div style="font-style: italic; color: #888; font-size: max(1.2vh, 7px);">
                            ${planet.funFact}
                        </div>
                    </div>
                `;
            } else {
                const tempDisplay = planet.tempMin === planet.tempMax ? planet.tempMin : planet.tempMin + ' ' + _t('planet.to') + ' ' + planet.tempMax;
                html = `
                    <div style="font-weight: 600; font-size: max(1.75vh, 9px); margin-bottom: 0.7vh; color: ${planet.color};">
                        ${planet.name}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.35vh 1.1vw; line-height: 1.5; color: #ccc; font-size: max(1.35vh, 8px);">
                        <div><strong style="color: #aaa;">${_t('planet.gravity')}</strong> <span style="color: #6eb5ff; font-weight: 600;">${planet.gravity}×</span> ${_t('planet.earth')}</div>
                        <div><strong style="color: #aaa;">${_t('planet.day')}</strong> ${planet.dayLength}</div>
                        <div><strong style="color: #aaa;">${_t('planet.temperature')}</strong> ${tempDisplay}°C</div>
                        <div><strong style="color: #aaa;">${_t('planet.year')}</strong> ${planet.yearLength}</div>
                        <div><strong style="color: #aaa;">${_t('planet.moons')}</strong> ${planet.moons}</div>
                    </div>
                    <div style="margin-top: 0.55vh; font-style: italic; color: #888; font-size: max(1.2vh, 7px);">
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
            
            // Always show planet stats in right panel
            if (planetStatsDiv) {
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
        // Normal black background for all modes
        starfieldCtx.fillStyle = '#000';
        starfieldCtx.fillRect(0, 0, starfieldCanvas.width, starfieldCanvas.height);
        
        // In Stranger mode, draw ash particles instead of stars
        if (strangerMode) {
            drawAshParticles();
            // Continue to draw sun/planets (they have invert filter applied)
        }
        
        // Draw sun in background (invert filter applied inside if strangerMode)
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
                
                // Global scale based on belt progress - whole belt shrinks/grows over time
                const progress = Math.min(asteroidBeltProgress / duration, 1);
                const globalBeltScale = cameraReversed 
                    ? 0.2 + progress * 0.8   // Reversed: starts small (0.2), grows to 1.0
                    : 1.0 - progress * 0.8;  // Normal: starts at 1.0, shrinks to 0.2
                
                // Calculate additional scale based on x position
                const getPositionScale = (asteroid) => {
                    const screenWidth = starfieldCanvas.width * 0.6;
                    if (cameraReversed) {
                        // Moving right (entering from left, exiting right)
                        const posProgress = (asteroid.x + screenWidth) / (screenWidth * 2);
                        return 0.5 + posProgress * 1.0; // 0.5 to 1.5
                    } else {
                        // Moving left (entering from right, exiting left)
                        const posProgress = (asteroid.x + screenWidth) / (screenWidth * 2);
                        return 0.5 + posProgress * 1.0; // 0.5 to 1.5
                    }
                };
                
                // Sort asteroids by combined scale for proper layering
                const sortedAsteroids = [...asteroids].sort((a, b) => {
                    const scaleA = getPositionScale(a) * (1 + a.depth * 0.3);
                    const scaleB = getPositionScale(b) * (1 + b.depth * 0.3);
                    // Draw smaller (further) asteroids first
                    return scaleA - scaleB;
                });
                
                sortedAsteroids.forEach(asteroid => {
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
                    
                    // Position-based scale (individual asteroid traveling across screen)
                    const positionScale = getPositionScale(asteroid);
                    
                    // Depth variation per asteroid
                    const depthVariation = 0.7 + asteroid.depth * 0.6; // 0.7 to 1.3
                    
                    // Combined scale: global belt distance * position * depth
                    const scale = globalBeltScale * positionScale * depthVariation;
                    
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
        
        // Draw stars (only if enabled and not in stranger mode)
        if (starsEnabled && !strangerMode) {
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
        }
        
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
        setStarsEnabled: (val) => { starsEnabled = val; },
        setMinimalistMode: (val) => { minimalistMode = val; },
        setStrangerMode: (val) => { 
            strangerMode = val; 
            if (val) {
                // Always reinitialize particles when entering stranger mode
                initAshParticles();
            }
            // Clear vine cache so it regenerates for each canvas
            vineCanvasCache.clear();
        },
        
        // Stranger mode vine drawing (for game canvas overlay)
        drawVinesOverlay: drawVinesOverlay,
        createVineOverlay: createVineOverlay,
        removeVineOverlay: removeVineOverlay,
        updateVineOverlayPosition: updateVineOverlayPosition,
        isStrangerMode: () => strangerMode,
        
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
        departUFO: departUFO,
        isUFOActive: () => ufoActive,
        setUFOSwoopCallback: (callback) => { ufoSwoopCallback = callback; },
        
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
            ufoCompletedCircle = false;
            // Reset UFO canvas z-index if it was raised
            if (ufoZIndexBoosted) {
                ufoCanvas.style.zIndex = '0';
                ufoZIndexBoosted = false;
            }
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