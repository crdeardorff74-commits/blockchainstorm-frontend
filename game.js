// Starfield System - imported from starfield.js
// The StarfieldSystem module handles: Stars, Sun, Planets, Asteroid Belt, UFO

// Audio System - imported from audio.js
const { audioContext, startMusic, stopMusic, startMenuMusic, stopMenuMusic, playSoundEffect, playEnhancedThunder, playThunder, playVolcanoRumble, playEarthquakeRumble, playEarthquakeCrack, playTsunamiWhoosh, startTornadoWind, stopTornadoWind, playSmallExplosion } = window.AudioSystem;

// Game state variables (synced with StarfieldSystem)
let currentGameLevel = 1;
let gameRunning = false;
let cameraReversed = false;

// ============================================
// DEVICE DETECTION & TABLET MODE SYSTEM
// ============================================

const DeviceDetection = {
    isMobile: false,
    isTablet: false,
    isTouch: false,
    
    detect() {
        const ua = navigator.userAgent.toLowerCase();
        this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const width = window.innerWidth;
        
        // Tablet detection (iPad, Android tablets, etc.)
        if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
            this.isTablet = true;
            this.isMobile = false;
            return 'tablet';
        }
        
        // Phone detection
        if (/android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
            this.isTablet = false;
            this.isMobile = true;
            return 'phone';
        }
        
        // iPad with iPadOS 13+ (reports as desktop)
        if (navigator.userAgent.match(/Mac/) && navigator.maxTouchPoints && navigator.maxTouchPoints > 2) {
            this.isTablet = true;
            this.isMobile = false;
            return 'tablet';
        }
        
        // Fallback: Small touch screen = phone, larger = tablet
        if (this.isTouch) {
            if (width <= 768) {
                this.isMobile = true;
                this.isTablet = false;
                return 'phone';
            } else if (width <= 1024) {
                this.isTablet = true;
                this.isMobile = false;
                return 'tablet';
            }
        }
        
        return 'desktop';
    }
};

// Tablet Mode System
const TabletMode = {
    enabled: false,
    manualOverride: false, // For CTRL+T testing
    
    init() {
        const deviceType = DeviceDetection.detect();
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
        
        // Sync with StarfieldSystem
        if (typeof StarfieldSystem !== 'undefined') {
            StarfieldSystem.setTabletModeEnabled(this.enabled);
        }
        
        if (this.enabled) {
            // Add tablet-mode class to body for CSS styling
            document.body.classList.add('tablet-mode');
            // Show touch controls in right panel
            if (touchControls) touchControls.style.display = 'grid';
            // Hide keyboard controls
            if (controls) controls.style.display = 'none';
            // Hide planet stats from right panel
            if (planetStats) planetStats.style.display = 'none';
            // Hide planet stats from left panel on menu (shown during gameplay via toggleUIElements)
            if (planetStatsLeft) planetStatsLeft.style.display = 'none';
            // Hide pause button on menu (shown during gameplay via toggleUIElements)
            if (pauseBtn) pauseBtn.style.display = 'none';
            // Show settings button in tablet mode (visible on menu, hidden during gameplay via class)
            if (settingsBtn) settingsBtn.style.display = 'block';
        } else {
            // Remove tablet-mode class from body
            document.body.classList.remove('tablet-mode');
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
        
        // Recalculate panel positions for new width
        if (typeof updateCanvasSize === 'function') {
            updateCanvasSize();
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
const LOG_QUEUE_MAX_SIZE = 1000;
let logQueue = [];

// Override console.log to capture all logs
const originalConsoleLog = console.log;
console.log = function(...args) {
    // Call original console.log
    originalConsoleLog.apply(console, args);
    
    // Format the log message
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1); // Just time portion
    const message = args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');
    
    // Add to queue
    logQueue.push(`[${timestamp}] ${message}`);
    
    // Maintain FIFO - remove oldest if over limit
    if (logQueue.length > LOG_QUEUE_MAX_SIZE) {
        logQueue.shift();
    }
};

// Function to copy logs to clipboard
function copyLogsToClipboard() {
    const logText = logQueue.join('\n');
    
    // Try to copy using modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(logText).then(() => {
            originalConsoleLog('✅ Copied ' + logQueue.length + ' log entries to clipboard!');
            // Briefly show a visual indicator
            const indicator = document.createElement('div');
            indicator.style.position = 'fixed';
            indicator.style.top = '50%';
            indicator.style.left = '50%';
            indicator.style.transform = 'translate(-50%, -50%)';
            indicator.style.padding = '20px 40px';
            indicator.style.background = 'rgba(0, 255, 0, 0.9)';
            indicator.style.color = 'white';
            indicator.style.fontSize = '24px';
            indicator.style.fontWeight = 'bold';
            indicator.style.borderRadius = '10px';
            indicator.style.zIndex = '10000';
            indicator.textContent = `📋 Copied ${logQueue.length} logs!`;
            document.body.appendChild(indicator);
            setTimeout(() => indicator.remove(), 2000);
        }).catch(err => {
            originalConsoleLog('❌ Failed to copy logs:', err);
            alert('Failed to copy logs to clipboard. Check console for details.');
        });
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = logText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            originalConsoleLog('✅ Copied ' + logQueue.length + ' log entries to clipboard (fallback method)!');
            alert(`📋 Copied ${logQueue.length} logs to clipboard!`);
        } catch (err) {
            originalConsoleLog('❌ Failed to copy logs:', err);
            alert('Failed to copy logs to clipboard.');
        }
        document.body.removeChild(textarea);
    }
}

// Function to capture canvas snapshot and copy to clipboard
function captureCanvasSnapshot() {
    try {
        // Create a temporary canvas with black background
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Fill with black background
        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw the game canvas on top
        tempCtx.drawImage(canvas, 0, 0);
        
        // Convert temporary canvas to blob
        tempCanvas.toBlob((blob) => {
            if (!blob) {
                originalConsoleLog('❌ Failed to create canvas snapshot');
                return;
            }
            
            // Try to copy using modern Clipboard API
            if (navigator.clipboard && navigator.clipboard.write) {
                const item = new ClipboardItem({ 'image/png': blob });
                navigator.clipboard.write([item]).then(() => {
                    originalConsoleLog('📸 Canvas snapshot copied to clipboard!');
                    
                    // Show visual indicator
                    const indicator = document.createElement('div');
                    indicator.style.position = 'fixed';
                    indicator.style.top = '50%';
                    indicator.style.left = '50%';
                    indicator.style.transform = 'translate(-50%, -50%)';
                    indicator.style.padding = '20px 40px';
                    indicator.style.background = 'rgba(0, 128, 255, 0.9)';
                }).catch((err) => {
                    originalConsoleLog('❌ Failed to copy canvas snapshot:', err);
                });
            } else {
                originalConsoleLog('❌ Clipboard API not supported');
            }
        }, 'image/png');
    } catch (err) {
        originalConsoleLog('❌ Error capturing canvas snapshot:', err);
    }
}

// ============================================
// GAMEPAD CONTROLLER SYSTEM
// ============================================

const GamepadController = {
    enabled: false,
    connected: false,
    deadzone: 0.25,
    repeatDelay: 120, // ms between repeated directional inputs
    lastMoveTime: 0,
    buttonStates: {},
    
    // Button mappings (Standard Gamepad layout)
    buttons: {
        A: 0,           // A (Xbox) / Cross (PS) - Rotate clockwise
        B: 1,           // B (Xbox) / Circle (PS) - Rotate counter-clockwise
        X: 2,           // X (Xbox) / Square (PS) - (unused)
        Y: 3,           // Y (Xbox) / Triangle (PS) - Hard drop
        LB: 4,          // Left Bumper - Rotate counter-clockwise
        RB: 5,          // Right Bumper - Rotate clockwise
        LT: 6,          // Left Trigger
        RT: 7,          // Right Trigger
        BACK: 8,        // Back/Select - (unused)
        START: 9,       // Start/Options - Pause
        L_STICK: 10,    // Left Stick Click
        R_STICK: 11,    // Right Stick Click
        D_UP: 12,       // D-Pad Up
        D_DOWN: 13,     // D-Pad Down - Soft drop
        D_LEFT: 14,     // D-Pad Left - Move left
        D_RIGHT: 15     // D-Pad Right - Move right
    },
    
    init() {
        try {
            // Listen for controller connection
            window.addEventListener("gamepadconnected", (e) => {
                this.onConnect(e.gamepad);
            });
            
            // Listen for controller disconnection
            window.addEventListener("gamepaddisconnected", (e) => {
                this.onDisconnect(e.gamepad);
            });
            
            // Some browsers need polling to detect controllers
            this.startPolling();
        } catch (error) {
            // Silently fail if gamepad API not available or blocked by permissions
            console.log('Gamepad API not available');
            this.enabled = false;
        }
    },
    
    onConnect(gamepad) {
        console.log('🎮 Controller connected:', gamepad.id);
        console.log('   Buttons:', gamepad.buttons.length);
        console.log('   Axes:', gamepad.axes.length);
        
        this.connected = true;
        this.enabled = true;
        
        // Show notification to player
        this.showNotification('🎮 Controller Connected!', gamepad.id);
    },
    
    onDisconnect(gamepad) {
        console.log('🎮 Controller disconnected:', gamepad.id);
        
        // Check if any controllers still connected
        const gamepads = navigator.getGamepads();
        this.connected = gamepads && Array.from(gamepads).some(gp => gp !== null);
        
        if (!this.connected) {
            this.enabled = false;
            this.showNotification('🎮 Controller Disconnected', '');
        }
    },
    
    startPolling() {
        // Check for controllers periodically (some browsers don't fire events)
        setInterval(() => {
            if (!this.connected) {
                try {
                    const gamepads = navigator.getGamepads();
                    if (gamepads) {
                        for (let i = 0; i < gamepads.length; i++) {
                            if (gamepads[i] && !this.connected) {
                                this.onConnect(gamepads[i]);
                                break;
                            }
                        }
                    }
                } catch (error) {
                    // Silently fail if permissions error
                }
            }
        }, 1000); // Check every second
    },
    
    update() {
        if (!this.enabled || !this.connected) return;
        if (!gameRunning || paused) return;
        if (!currentPiece) return;
        
        try {
            const gamepads = navigator.getGamepads();
            if (!gamepads) return;
            
            // Use first connected controller
            const gp = gamepads[0];
            if (!gp) return;
            
            const now = Date.now();
            
            // === MOVEMENT (D-Pad or Left Stick) ===
            const leftPressed = this.isButtonPressed(gp, this.buttons.D_LEFT) || 
                               gp.axes[0] < -this.deadzone;
            const rightPressed = this.isButtonPressed(gp, this.buttons.D_RIGHT) || 
                                gp.axes[0] > this.deadzone;
            const downPressed = this.isButtonPressed(gp, this.buttons.D_DOWN) || 
                               gp.axes[1] > this.deadzone;
        
        // Apply movement with repeat delay
        if (now - this.lastMoveTime >= this.repeatDelay) {
            if (leftPressed) {
                if (!collides(currentPiece, -1, 0)) {
                    currentPiece.x--;
                    playSoundEffect('move', soundToggle);
                }
                this.lastMoveTime = now;
            } else if (rightPressed) {
                if (!collides(currentPiece, 1, 0)) {
                    currentPiece.x++;
                    playSoundEffect('move', soundToggle);
                }
                this.lastMoveTime = now;
            }
            
            if (downPressed) {
                if (!collides(currentPiece, 0, 1)) {
                    currentPiece.y++;
                    score += 1;
                    updateStats();
                }
                this.lastMoveTime = now;
            }
        }
        
        // === ROTATION ===
        // A button or Right Bumper - Rotate clockwise
        if (this.wasButtonJustPressed(gp, this.buttons.A) || 
            this.wasButtonJustPressed(gp, this.buttons.RB)) {
            rotatePiece();
        }
        
        // B button or Left Bumper - Rotate counter-clockwise
        if (this.wasButtonJustPressed(gp, this.buttons.B) || 
            this.wasButtonJustPressed(gp, this.buttons.LB)) {
            rotatePieceCounterClockwise();
        }
        
        // === HARD DROP ===
        // Y button - Hard drop
        if (this.wasButtonJustPressed(gp, this.buttons.Y)) {
            hardDrop();
        }
        
        // === PAUSE ===
        // Start button - Pause game
        if (this.wasButtonJustPressed(gp, this.buttons.START)) {
            togglePause();
        }
        } catch (error) {
            // Silently fail if permissions error or gamepad API blocked
        }
    },
    
    isButtonPressed(gamepad, buttonIndex) {
        return gamepad.buttons[buttonIndex] && gamepad.buttons[buttonIndex].pressed;
    },
    
    wasButtonJustPressed(gamepad, buttonIndex) {
        const pressed = this.isButtonPressed(gamepad, buttonIndex);
        const key = `btn_${buttonIndex}`;
        const wasPressed = this.buttonStates[key] || false;
        
        this.buttonStates[key] = pressed;
        
        // Return true only on the rising edge (button just pressed)
        return pressed && !wasPressed;
    },
    
    showNotification(title, subtitle) {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: rgba(0, 0, 0, 0.95);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            font-size: 18px;
            font-weight: bold;
            z-index: 10000;
            border: 2px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            max-width: 300px;
        `;
        
        notification.innerHTML = `
            <div style="margin-bottom: 5px;">${title}</div>
            ${subtitle ? `<div style="font-size: 12px; opacity: 0.7; font-weight: normal;">${subtitle}</div>` : ''}
            <div style="font-size: 11px; opacity: 0.6; margin-top: 8px; font-weight: normal;">
                D-Pad/Stick: Move • A/B: Rotate • Y: Drop • Start: Pause
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Fade in
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(50px)';
        notification.style.transition = 'all 0.3s ease-out';
        
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Fade out and remove
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(50px)';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    },
    
    getControllerType(gamepad) {
        const id = gamepad.id.toLowerCase();
        
        if (id.includes('xbox')) return 'Xbox';
        if (id.includes('playstation') || id.includes('dualshock') || id.includes('dualsense')) return 'PlayStation';
        if (id.includes('switch')) return 'Nintendo Switch';
        if (id.includes('stadia')) return 'Stadia';
        
        return 'Generic';
    }
};

// Initialize gamepad support
GamepadController.init();

// ============================================
// TOUCH CONTROLS EVENT HANDLERS
// ============================================

// Touch repeat settings (same as keyboard) - global for clearing on game start
const touchRepeat = {
    initialDelay: 200,  // 200ms before repeat starts
    repeatRate: 40,     // 40ms between repeats
    timers: new Map()   // Track active repeat timers
};

function initTouchControls() {
    const touchLeft = document.getElementById('touchLeft');
    const touchRight = document.getElementById('touchRight');
    const touchDown = document.getElementById('touchDown');
    const touchRotate = document.getElementById('touchRotate');
    const touchRotateCCW = document.getElementById('touchRotateCCW');
    const touchDrop = document.getElementById('touchDrop');
    const pauseBtn = document.getElementById('pauseBtn');
    
    if (!touchLeft) return; // Controls not in DOM yet
    
    // Helper to add repeating touch behavior (for directional buttons)
    const addRepeatingTouch = (element, action) => {
        if (!element) return;
        
        const startRepeat = (e) => {
            e.preventDefault();
            
            // Execute action immediately
            action();
            
            // Clear any existing timers for this element
            if (touchRepeat.timers.has(element)) {
                clearTimeout(touchRepeat.timers.get(element).initial);
                clearInterval(touchRepeat.timers.get(element).repeat);
            }
            
            // Start initial delay timer
            const initialTimer = setTimeout(() => {
                // Start repeat interval
                const repeatTimer = setInterval(() => {
                    if (!paused && currentPiece) {
                        action();
                    }
                }, touchRepeat.repeatRate);
                
                touchRepeat.timers.set(element, { 
                    initial: null, 
                    repeat: repeatTimer 
                });
            }, touchRepeat.initialDelay);
            
            touchRepeat.timers.set(element, { 
                initial: initialTimer, 
                repeat: null 
            });
        };
        
        const stopRepeat = (e) => {
            e.preventDefault();
            
            // Clear timers
            if (touchRepeat.timers.has(element)) {
                const timers = touchRepeat.timers.get(element);
                if (timers.initial) clearTimeout(timers.initial);
                if (timers.repeat) clearInterval(timers.repeat);
                touchRepeat.timers.delete(element);
            }
        };
        
        element.addEventListener('touchstart', startRepeat, { passive: false });
        element.addEventListener('touchend', stopRepeat, { passive: false });
        element.addEventListener('touchcancel', stopRepeat, { passive: false });
        
        // Also handle mouse for testing on desktop
        element.addEventListener('mousedown', startRepeat);
        element.addEventListener('mouseup', stopRepeat);
        element.addEventListener('mouseleave', stopRepeat);
    };
    
    // Helper for non-repeating buttons (rotation, hard drop, pause)
    const addTouchAndClick = (element, handler) => {
        if (!element) return;
        element.addEventListener('touchstart', handler, { passive: false });
        element.addEventListener('click', handler);
    };
    
    // Movement buttons with repeat
    addRepeatingTouch(touchLeft, () => {
        // Check if controls should be swapped (Stranger XOR Dyslexic)
        const strangerActive = challengeMode === 'stranger' || activeChallenges.has('stranger');
        const dyslexicActive = challengeMode === 'dyslexic' || activeChallenges.has('dyslexic');
        const shouldSwap = strangerActive !== dyslexicActive;
        const dir = shouldSwap ? 1 : -1;
        
        if (currentPiece && !collides(currentPiece, dir, 0)) {
            currentPiece.x += dir;
            playSoundEffect('move', soundToggle);
        }
    });
    
    addRepeatingTouch(touchRight, () => {
        // Check if controls should be swapped (Stranger XOR Dyslexic)
        const strangerActive = challengeMode === 'stranger' || activeChallenges.has('stranger');
        const dyslexicActive = challengeMode === 'dyslexic' || activeChallenges.has('dyslexic');
        const shouldSwap = strangerActive !== dyslexicActive;
        const dir = shouldSwap ? -1 : 1;
        
        if (currentPiece && !collides(currentPiece, dir, 0)) {
            currentPiece.x += dir;
            playSoundEffect('move', soundToggle);
        }
    });
    
    addRepeatingTouch(touchDown, () => {
        if (currentPiece && !collides(currentPiece, 0, 1)) {
            currentPiece.y++;
            score += 1;
            updateStats();
        }
    });
    
    // Rotation buttons (no repeat - one press = one rotation)
    addTouchAndClick(touchRotateCCW, (e) => {
        e.preventDefault();
        rotatePieceCounterClockwise();
    });
    
    addTouchAndClick(touchRotate, (e) => {
        e.preventDefault();
        rotatePiece();
    });
    
    // Hard drop (no repeat)
    addTouchAndClick(touchDrop, (e) => {
        e.preventDefault();
        hardDrop();
    });
    
    // Pause button (no repeat)
    addTouchAndClick(pauseBtn, (e) => {
        e.preventDefault();
        togglePause();
    });
    
    console.log('📱 Touch controls initialized with key repeat');
}

// Initialize tablet mode
try {
    TabletMode.init();
} catch (e) {
    console.error('TabletMode.init() error:', e);
}

// Initialize starfield system
try {
    if (typeof StarfieldSystem !== 'undefined') {
        StarfieldSystem.init();
    }
} catch (e) {
    console.error('StarfieldSystem.init() error:', e);
}
// Note: setSoundCallback is called after soundToggle is defined (line ~820)

// Initialize touch controls (will be shown/hidden by tablet mode)
try {
    initTouchControls();
} catch (e) {
    console.error('initTouchControls() error:', e);
}

// Update tablet mode when gamepad connects/disconnects
window.addEventListener("gamepadconnected", () => {
    setTimeout(() => TabletMode.updateMode(), 100);
});

window.addEventListener("gamepaddisconnected", () => {
    setTimeout(() => TabletMode.updateMode(), 100);
});

// ============================================
// END TOUCH CONTROLS
// ============================================

// ============================================
// END GAMEPAD CONTROLLER SYSTEM
// ============================================

// Listen for =/+ key to copy logs
document.addEventListener('keydown', (e) => {
    // CTRL+D to copy console logs to clipboard
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        copyLogsToClipboard();
    }
    
    // CTRL+T to toggle tablet mode (for testing)
    if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        TabletMode.toggle();
    }
});



// Game code
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
// Disable image smoothing for crisp pixels (prevents lines in fullscreen)
nextCtx.imageSmoothingEnabled = false;
nextCtx.webkitImageSmoothingEnabled = false;
nextCtx.mozImageSmoothingEnabled = false;
nextCtx.msImageSmoothingEnabled = false;

const histogramCanvas = document.getElementById('histogramCanvas');
const histogramCtx = histogramCanvas.getContext('2d');
const modeMenu = document.getElementById('modeMenu');
const modeButtons = document.querySelectorAll('.mode-button');
const gameOverDiv = document.getElementById('gameOver');
const playAgainBtn = document.getElementById('playAgainBtn');

// Pre-render blurred snowflakes for performance
const snowflakeBitmaps = [];
function createSnowflakeBitmaps() {
    const sizes = [5, 7.5, 10]; // Three different sizes (1/4 of original)
    const blurLevels = [1, 1.5, 2]; // Three blur levels
    
    sizes.forEach(size => {
        blurLevels.forEach(blur => {
            const tempCanvas = document.createElement('canvas');
            const tempSize = size + blur * 4; // Extra space for blur
            tempCanvas.width = tempSize;
            tempCanvas.height = tempSize;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Apply blur filter
            tempCtx.filter = `blur(${blur}px)`;
            
            // Draw snowflake at center
            tempCtx.save();
            tempCtx.translate(tempSize / 2, tempSize / 2);
            tempCtx.strokeStyle = 'rgba(240, 248, 255, 1)';
            tempCtx.lineWidth = 1.5;
            tempCtx.lineCap = 'round';
            
            // 6-pointed snowflake
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
createSnowflakeBitmaps();

// Dynamic canvas sizing based on viewport
let BLOCK_SIZE = 35;

function updateCanvasSize() {
    // Calculate block size based on viewport height
    // Target: canvas should be ~85vh tall for 20 rows (larger blocks)
    const targetHeight = window.innerHeight * 0.85;
    BLOCK_SIZE = Math.floor(targetHeight / ROWS);
    
    // Update main canvas
    canvas.width = COLS * BLOCK_SIZE;
    canvas.height = ROWS * BLOCK_SIZE;
    
    // Check if Thicker mode is active and adjust CSS dimensions
    const isThickerMode = challengeMode === 'thicker' || activeChallenges.has('thicker');
    if (isThickerMode) {
        // Set CSS dimensions to create actual layout space
        canvas.style.width = (canvas.width * 1.2) + 'px';
        canvas.style.height = (canvas.height * 0.667) + 'px';
    } else {
        // Reset to auto for normal modes
        canvas.style.width = '';
        canvas.style.height = '';
    }
    
    // Update next piece canvas to be responsive
    // Get the actual displayed size
    const nextDisplayWidth = 180; // Base size
    const nextDisplayHeight = 180;
    
    // Make canvas larger to accommodate the piece queue extending up and right
    const nextCanvasScale = 2.5;
    nextCanvas.width = nextDisplayWidth * nextCanvasScale;
    nextCanvas.height = nextDisplayHeight * nextCanvasScale;
    
    // Position canvas so visible area (lower-left) aligns with original position
    // Canvas extends up and to the right from there
    nextCanvas.style.width = (nextDisplayWidth * nextCanvasScale) + 'px';
    nextCanvas.style.height = (nextDisplayHeight * nextCanvasScale) + 'px';
    nextCanvas.style.position = 'absolute';
    nextCanvas.style.bottom = '0';
    nextCanvas.style.left = '0';
    
    // Update side panel positions based on canvas width
    const rulesPanel = document.querySelector('.rules-panel');
    const sidePanel = document.querySelector('.side-panel');
    
    // Use getBoundingClientRect to get the actual rendered size including CSS transforms
    const canvasRect = canvas.getBoundingClientRect();
    const canvasDisplayWidth = canvasRect.width;
    
    const viewportWidth = window.innerWidth;
    
    // Calculate panel width (22vw normal, 33vw tablet mode - 50% wider)
    const panelWidthPercent = TabletMode.enabled ? 0.33 : 0.22;
    const panelWidth = viewportWidth * panelWidthPercent;
    
    // Desired gap between canvas and panels (2.5vw for better spacing)
    const desiredGap = viewportWidth * 0.025;
    
    // Calculate how much space is available on each side
    const totalSpace = viewportWidth - canvasDisplayWidth;
    const spacePerSide = totalSpace / 2;
    
    // Calculate panel positions
    // Left panel: space on left side - panel width - gap
    const leftPanelLeft = spacePerSide - panelWidth - desiredGap;
    
    // Right panel: same as left (symmetric)
    const rightPanelRight = spacePerSide - panelWidth - desiredGap;
    
    // Position panels (but don't push them off screen)
    if (rulesPanel) {
        rulesPanel.style.left = Math.max(0, leftPanelLeft) + 'px';
    }
    
    if (sidePanel) {
        sidePanel.style.right = Math.max(0, rightPanelRight) + 'px';
    }
    
    // Redraw if game is running (but NOT during initialization)
    if (gameRunning && currentPiece) {
        drawBoard();
        if (currentPiece && currentPiece.shape) {
            if (hardDropping) {
                const pixelOffset = hardDropPixelY - (currentPiece.y * BLOCK_SIZE);
                drawPiece(currentPiece, ctx, 0, 0, pixelOffset);
            } else {
                drawPiece(currentPiece);
            }
        }
        if (nextPieceQueue.length > 0) {
            drawNextPiece();
        }
    }
    
    // Update vine overlays if in stranger mode
    if (typeof StarfieldSystem !== 'undefined' && StarfieldSystem.isStrangerMode && StarfieldSystem.isStrangerMode()) {
        StarfieldSystem.updateVineOverlayPosition(canvas);
        StarfieldSystem.updateVineOverlayPosition(nextCanvas);
    }
}

window.addEventListener('resize', updateCanvasSize);
window.updateCanvasSize = updateCanvasSize; // Expose for leaderboard positioning

// Also update on fullscreen change (resize may not fire on all browsers)
document.addEventListener('fullscreenchange', () => {
    setTimeout(updateCanvasSize, 100); // Small delay to let layout settle
});
document.addEventListener('webkitfullscreenchange', () => {
    setTimeout(updateCanvasSize, 100);
});

// Fullscreen cursor auto-hide functionality
let cursorHideTimeout = null;
const CURSOR_HIDE_DELAY = 2000; // Hide cursor after 2 seconds of inactivity

function showCursor() {
    document.body.style.cursor = 'auto';
    if (cursorHideTimeout) {
        clearTimeout(cursorHideTimeout);
    }
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        cursorHideTimeout = setTimeout(() => {
            document.body.style.cursor = 'none';
        }, CURSOR_HIDE_DELAY);
    }
}

function handleFullscreenCursor() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        // Entering fullscreen - start cursor hide timer
        showCursor();
    } else {
        // Exiting fullscreen - restore cursor
        if (cursorHideTimeout) {
            clearTimeout(cursorHideTimeout);
            cursorHideTimeout = null;
        }
        document.body.style.cursor = 'auto';
    }
}

document.addEventListener('fullscreenchange', handleFullscreenCursor);
document.addEventListener('webkitfullscreenchange', handleFullscreenCursor);
document.addEventListener('mousemove', showCursor);

const scoreDisplay = document.getElementById('score');
const linesDisplay = document.getElementById('lines');
const levelDisplay = document.getElementById('level');
const strikesDisplay = document.getElementById('strikes');
const tsunamisDisplay = document.getElementById('tsunamis');
const blackHolesDisplay = document.getElementById('blackholes');
const volcanoesDisplay = document.getElementById('volcanoes');
const finalScoreDisplay = document.getElementById('finalScore');
const finalStatsDisplay = document.getElementById('finalStats');
const planetStatsDiv = document.getElementById('planetStats');
const planetStatsContent = document.getElementById('planetStatsContent');
const soundToggle = document.getElementById('soundToggle');
const musicToggle = document.getElementById('musicToggle');
// trainingWheelsToggle removed - shadow is now standard (use Shadowless challenge for +4% bonus)
const stormEffectsToggle = document.getElementById('stormEffectsToggle');
const settingsBtn = document.getElementById('settingsBtn');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const opacitySlider = document.getElementById('opacitySlider');
const starSpeedSlider = document.getElementById('starSpeedSlider');
const minimalistToggle = document.getElementById('minimalistToggle');
const minimalistOption = document.getElementById('minimalistOption');
let minimalistMode = false;
let ROWS = 20;
let COLS = 10;

// Connect StarfieldSystem sound callback now that soundToggle is defined
StarfieldSystem.setSoundCallback(playSoundEffect, soundToggle);

// Developer mode (activated by center-clicking "Don't Panic!")
let developerMode = false;

// Game mode configuration
let gameMode = null;
let lastPlayedMode = null; // Track the last played mode for menu selection
let hailstormEnabled = false;
let hailstormCounter = 0;

const SHAPES = {
    I: [[1,1,1,1]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1]],
    S: [[0,1,1],[1,1,0]],
    Z: [[1,1,0],[0,1,1]],
    J: [[1,0,0],[1,1,1]],
    L: [[0,0,1],[1,1,1]]
};

// Extended shapes for Blizzard/Hurricane modes (5-block pieces)
const EXTENDED_SHAPES = {
    ...SHAPES,
    I5: [[1,1,1,1,1]],                    // 5-long I piece
    Plus: [[0,1,0],[1,1,1],[0,1,0]],      // Plus/cross shape
    W: [[1,0,0],[1,1,0],[0,1,1]],         // W shape
    U: [[1,0,1],[1,1,1]],                 // U shape
    P: [[1,1],[1,1],[1,0]],               // P shape (3 high)
    F: [[0,1,1],[1,1,0],[0,1,0]],         // F shape
    L5: [[1,0],[1,0],[1,0],[1,1]],        // L pentomino (4 high)
    N: [[0,1],[1,1],[1,0],[1,0]],         // N shape
    T5: [[1,1,1],[0,1,0],[0,1,0]],        // T pentomino (tall T)
    V: [[1,0,0],[1,0,0],[1,1,1]],         // V shape
    Y: [[0,1],[1,1],[0,1],[0,1]],         // Y shape
    Z5: [[1,1,0],[0,1,0],[0,1,1]]         // Z pentomino
};

// Blizzard shapes - moderate difficulty pentominoes
const BLIZZARD_SHAPES = {
    ...SHAPES,
    I5: [[1,1,1,1,1]],                    // 5-long I piece
    U: [[1,0,1],[1,1,1]],                 // U shape
    P: [[1,1],[1,1],[1,0]],               // P shape (3 high)
    L5: [[1,0],[1,0],[1,0],[1,1]],        // L pentomino (4 high)
    N: [[0,1],[1,1],[1,0],[1,0]],         // N shape
    T5: [[1,1,1],[0,1,0],[0,1,0]],        // T pentomino (tall T)
    V: [[1,0,0],[1,0,0],[1,1,1]]          // V shape
};

const COLORS = [
    '#FF6B6B', // Red (pastel)
    '#FFA07A', // Orange (pastel)
    '#F7DC6F', // Yellow (pastel)
    '#52B788', // Green (pastel)
    '#45B7D1', // Blue (pastel)
    '#85C1E2', // Light Blue/Indigo (pastel)
    '#BB8FCE', // Violet (pastel)
    '#FFB3D9'  // Pink (pastel)
];

// Optimized color subsets for maximum contrast
const COLOR_SETS = {
    // 4 colors: Red, Yellow, Green, Blue - maximally spread across color wheel
    4: ['#FF6B6B', '#F7DC6F', '#52B788', '#45B7D1'],
    // 5 colors: Red, Yellow, Green, Blue, Violet - skip adjacent colors
    5: ['#FF6B6B', '#F7DC6F', '#52B788', '#45B7D1', '#BB8FCE'],
    // 6 colors: Red, Orange, Yellow, Green, Blue, Violet - skip Light Blue (too close to Blue)
    6: ['#FF6B6B', '#FFA07A', '#F7DC6F', '#52B788', '#45B7D1', '#BB8FCE'],
    // 7 colors: Add Pink to 6-color set
    7: ['#FF6B6B', '#FFA07A', '#F7DC6F', '#52B788', '#45B7D1', '#BB8FCE', '#FFB3D9'],
    // 8 colors: All colors
    8: COLORS
};

let currentColorSet = COLORS; // Initialize after COLORS is defined

// Histogram variables
let histogramBars = {}; // Current height of each color bar
let histogramTargets = {}; // Target heights for animation
let histogramMaxScale = 10; // Maximum value on scale (auto-adjusts)
let histogramDecayRate = 0.98; // How fast bars fall back down (slower than before)
let histogramPauseFrames = {}; // Track pause frames at peak for each color

// Score histogram variables
let scoreHistogramBar = 0; // Current height of score bar
let scoreHistogramTarget = 0; // Target height for animation
let scoreHistogramMaxScale = 1000; // Maximum value on scale (auto-adjusts)
let scoreHistogramPauseFrames = 0; // Track pause frames at peak for score bar

// Storm Particle System
let stormParticles = [];
let liquidPools = []; // For Carrie/No Kings modes - pools that accumulate and drip
let frameCount = 0; // Frame counter for liquid pooling timing
const MAX_STORM_PARTICLES = 800; // Maximum number of particles at once (increased for hurricane deluge)
let splashParticles = []; // Separate array for splash effects

// Tornado System
let tornadoActive = false;
let tornadoY = 0; // Current Y position of tornado tip
let tornadoX = 0; // X position (center column)
let tornadoRotation = 0; // Rotation angle for visual effect
let tornadoSpeed = 1.5; // Pixels per frame descending (slowed to half)
let tornadoPickedBlob = null; // Blob currently being lifted
let tornadoState = 'descending'; // 'descending', 'lifting', 'carrying', 'dropping', 'dissipating'
let tornadoDropTargetX = 0; // Where to drop the blob
let tornadoLiftStartY = 0; // Where lift started
let tornadoBlobRotation = 0; // Rotation of the lifted blob
let tornadoVerticalRotation = 0; // Rotation around vertical axis (for 3D effect)
let tornadoOrbitStartTime = null; // When blob started orbiting
let tornadoOrbitRadius = 0; // Distance from tornado center
let tornadoOrbitAngle = 0; // Current angle around tornado
let tornadoLiftHeight = 0; // Current height of blob as it climbs
let tornadoDropStartY = 0; // Y position when dropping starts
let tornadoFadeProgress = 0; // 0 to 1 for dissipation animation
let tornadoSnakeVelocity = 0; // Current horizontal velocity
let tornadoSnakeDirection = 1; // 1 or -1
let tornadoSnakeChangeCounter = 0; // Frames until direction change
let tornadoParticles = []; // Swirling particles around tornado

let disintegrationParticles = []; // Particles for blob explosion

// Earthquake state
let earthquakeActive = false;
let earthquakePhase = 'shake'; // 'shake' (2s horizontal shake), 'crack', 'shift', 'done'
let earthquakeShakeProgress = 0;
let earthquakeShakeIntensity = 0; // Used for horizontal shaking throughout earthquake
let earthquakeCrack = []; // Array of {x, y, edge} points forming the crack
let earthquakeCrackProgress = 0;
let earthquakeCrackMap = new Map(); // Map of Y -> X position for fast lookup
let earthquakeShiftProgress = 0;
let earthquakeLeftBlocks = []; // Blocks on left side of crack
let earthquakeRightBlocks = []; // Blocks on right side of crack
let earthquakeShiftType = 'both'; // 'both', 'left', 'right' - determines which side(s) move

// Black Hole Animation System
let blackHoleActive = false;
let blackHoleAnimating = false;
let blackHoleCenterX = 0;
let blackHoleCenterY = 0;
let blackHoleBlocks = []; // Blocks to be sucked in: {x, y, color, distance, pulled}
let blackHoleStartTime = 0;
let blackHoleDuration = 2500; // 2.5 seconds for full animation
let blackHoleShakeIntensity = 0;
let blackHoleInnerBlob = null;
let blackHoleOuterBlob = null;

// Falling Blocks Animation System
let fallingBlocks = []; // Blocks that are animating falling: {x, y, targetY, color, progress, isRandom}
let gravityAnimating = false;

// Tsunami Animation System
let tsunamiActive = false;
let tsunamiAnimating = false;
let tsunamiBlob = null;
let tsunamiBlocks = []; // Blocks collapsing: {x, y, color, targetY, currentY, removed}
let tsunamiPushedBlocks = []; // Blocks above tsunami that get pushed up
let tsunamiStartTime = 0;
let tsunamiDuration = 2000; // 2 seconds
let tsunamiWobbleIntensity = 0;

// Volcano Animation System
let volcanoActive = false;
let volcanoAnimating = false;
let volcanoPhase = 'warming'; // 'warming' (vibration + color change), 'erupting' (projectiles)
let volcanoLavaBlob = null; // The blob that turned to lava
let volcanoLavaColor = '#FF4500'; // Intense glowing red-orange (OrangeRed)
let volcanoEruptionColumn = -1; // Which column to erupt through
let volcanoEdgeType = ''; // Which edge(s) the lava blob is against: 'left', 'right', 'bottom', or combinations
let volcanoProjectiles = []; // Lava blocks flying: {x, y, vx, vy, gravity, color, landed}
let volcanoStartTime = 0;
let volcanoWarmingDuration = 3000; // 3 seconds of warming/vibration before eruption
let volcanoEruptionDuration = 2000; // 2 seconds of eruption
let volcanoVibrateOffset = { x: 0, y: 0 }; // Current vibration offset for warming phase
let volcanoColorProgress = 0; // 0 to 1, tracks color transition during warming
let volcanoOriginalColor = null; // Store original color to transition from
let volcanoProjectilesSpawned = 0; // Track how many projectiles have been spawned
let volcanoTargetProjectiles = 0; // How many projectiles to spawn (matches blob size)


// Get pulsing lava color (oscillates between darker and brighter)
function getLavaColor() {
    // Pulse over 2 seconds (slower, more dramatic)
    const pulse = Math.sin(Date.now() / 1000) * 0.5 + 0.5; // 0.0 to 1.0
    
    // Base color: #FF4500 (255, 69, 0)
    const baseR = 255;
    const baseG = 69;
    const baseB = 0;
    
    // Oscillate between 70% and 130% brightness
    const minBrightness = 0.7;
    const maxBrightness = 1.3;
    const brightness = minBrightness + pulse * (maxBrightness - minBrightness);
    
    // Apply brightness
    const r = Math.min(255, Math.round(baseR * brightness));
    const g = Math.min(255, Math.round(baseG * brightness));
    const b = Math.min(255, Math.round(baseB * brightness));
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function triggerBlackHole(innerBlob, outerBlob) {
    // Calculate center of black hole (center of inner blob)
    const innerXs = innerBlob.positions.map(p => p[0]);
    const innerYs = innerBlob.positions.map(p => p[1]);
    blackHoleCenterX = (Math.min(...innerXs) + Math.max(...innerXs)) / 2;
    blackHoleCenterY = (Math.min(...innerYs) + Math.max(...innerYs)) / 2;
    
    // Store references
    blackHoleInnerBlob = innerBlob;
    blackHoleOuterBlob = outerBlob;
    
    // Remove inner blob from board immediately (we'll render it as dark vortex)
    innerBlob.positions.forEach(([x, y]) => {
        board[y][x] = null;
        isRandomBlock[y][x] = false;
        fadingBlocks[y][x] = null;
    });
    
    // Create list of all blocks to animate (only outer blob gets sucked in)
    blackHoleBlocks = [];
    
    // Add outer blob blocks (these get sucked in)
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
    
    // Sort by distance (farthest first)
    blackHoleBlocks.sort((a, b) => b.distance - a.distance);
    
    blackHoleActive = true;
    blackHoleAnimating = true;
    blackHoleStartTime = Date.now();
    blackHoleShakeIntensity = 8; // pixels
    
    // Add visual effect
    canvas.classList.add('blackhole-active');
    playEnhancedThunder(soundToggle);
}

function createDisintegrationExplosion(blob) {
    // Create particles for each block in the blob
    blob.positions.forEach(([x, y]) => {
        const blockCenterX = x * BLOCK_SIZE + BLOCK_SIZE / 2;
        const blockCenterY = y * BLOCK_SIZE + BLOCK_SIZE / 2;
        
        // Create 12-16 particles per block
        const particleCount = 12 + Math.floor(Math.random() * 5);
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.random() * Math.PI * 2);
            const speed = 2 + Math.random() * 4;
            const size = 3 + Math.random() * 5;
            
            disintegrationParticles.push({
                x: blockCenterX,
                y: blockCenterY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1, // Slight upward bias
                size: size,
                color: blob.color,
                opacity: 1,
                life: 1, // 0 to 1
                decay: 0.015 + Math.random() * 0.01,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3
            });
        }
    });
}

function updateDisintegrationParticles() {
    disintegrationParticles = disintegrationParticles.filter(p => {
        // Apply physics
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // Gravity
        p.vx *= 0.98; // Air resistance
        p.rotation += p.rotationSpeed;
        
        // Fade out
        p.life -= p.decay;
        p.opacity = p.life;
        
        return p.life > 0;
    });
}

function drawDisintegrationParticles() {
    disintegrationParticles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        
        // Draw as small square chunks
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        
        // Add some darker edge for depth
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
        
        ctx.restore();
    });
}

function updateBlackHoleAnimation() {
    if (!blackHoleAnimating) return;
    
    const elapsed = Date.now() - blackHoleStartTime;
    const progress = Math.min(elapsed / blackHoleDuration, 1);
    
    // Shake intensity decreases over time
    blackHoleShakeIntensity = 8 * (1 - progress * 0.5);
    
    // Update each block's animation state
    blackHoleBlocks.forEach((block, index) => {
        // Each block starts being pulled at different times
        const blockStartDelay = (index / blackHoleBlocks.length) * 0.7; // First 70% of animation
        const blockProgress = Math.max(0, Math.min(1, (progress - blockStartDelay) / 0.3)); // 30% duration per block
        
        if (blockProgress > 0 && !block.animating) {
            block.animating = true;
            block.startX = block.x;
            block.startY = block.y;
        }
        
        if (block.animating) {
            block.pullProgress = blockProgress;
            
            // Spiral path to center
            const spiralRotations = 2; // 2 full rotations as it spirals in
            const angle = blockProgress * Math.PI * 2 * spiralRotations;
            
            // Distance from center decreases
            const startDist = block.distance;
            const currentDist = startDist * (1 - blockProgress);
            
            // Calculate position (spiral inward)
            const centerX = blackHoleCenterX;
            const centerY = blackHoleCenterY;
            const dx = block.startX - centerX;
            const dy = block.startY - centerY;
            const startAngle = Math.atan2(dy, dx);
            
            block.currentX = centerX + Math.cos(startAngle + angle) * currentDist;
            block.currentY = centerY + Math.sin(startAngle + angle) * currentDist;
            
            // Scale decreases as it approaches center
            block.scale = 1 - blockProgress;
            
            // Rotation increases
            block.rotation = angle;
            
            // Remove from board once it reaches the center
            if (blockProgress >= 1 && !block.removed) {
                block.removed = true;
                if (board[block.y] && board[block.y][block.x]) {
                    board[block.y][block.x] = null;
                    isRandomBlock[block.y][block.x] = false;
                    fadingBlocks[block.y][block.x] = null;
                }
            }
        }
    });
    
    // Animation complete
    if (progress >= 1) {
        console.log('🕳️ Black hole animation complete');
        blackHoleAnimating = false;
        blackHoleActive = false;
        blackHoleShakeIntensity = 0;
        canvas.classList.remove('blackhole-active');
        
        console.log('🕳️ Black hole calling applyGravity()');
        // Apply gravity after black hole
        applyGravity();
        // Note: checkForSpecialFormations will be called after gravity animation completes
    }
}

function drawBlackHole() {
    if (!blackHoleActive) return;
    
    ctx.save();
    
    // Note: The vortex is now drawn BEHIND blocks in drawBoard()
    // Here we only draw the animating outer blocks (spiraling and shrinking)
    
    blackHoleBlocks.forEach(block => {
        if (block.animating && !block.removed && block.scale > 0.05) {
            ctx.save();
            
            const px = block.currentX * BLOCK_SIZE;
            const py = block.currentY * BLOCK_SIZE;
            const centerX = px + BLOCK_SIZE / 2;
            const centerY = py + BLOCK_SIZE / 2;
            
            // Translate to center, rotate and scale
            ctx.translate(centerX, centerY);
            ctx.rotate(block.rotation);
            ctx.scale(block.scale, block.scale);
            ctx.translate(-centerX, -centerY);
            
            // Fade as it approaches center
            ctx.globalAlpha = block.scale;
            
            // Draw the block
            drawSolidShape(ctx, [[block.currentX, block.currentY]], block.color, BLOCK_SIZE, false, getFaceOpacity());
            
            ctx.restore();
            
            // Add trailing particles
            if (Math.random() < 0.3 && block.pullProgress < 0.9) {
                disintegrationParticles.push({
                    x: px + BLOCK_SIZE / 2,
                    y: py + BLOCK_SIZE / 2,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    size: 2 + Math.random() * 3,
                    color: block.color,
                    opacity: 0.8,
                    life: 0.8,
                    decay: 0.03,
                    gravity: 0,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() - 0.5) * 0.3
                });
            }
        }
    });
    ctx.restore();
}

// ============================================
// VOLCANO SYSTEM
// ============================================

function triggerVolcano(lavaBlob, eruptionColumn, edgeType = 'bottom') {
    console.log('🌋 Volcano triggered! Starting warming phase...', 'Lava blob size:', lavaBlob.positions.length, 'Eruption column:', eruptionColumn, 'Edge:', edgeType);
    
    volcanoActive = true;
    volcanoAnimating = true;
    volcanoPhase = 'warming'; // Start with warming phase
    volcanoLavaBlob = lavaBlob;
    volcanoEruptionColumn = eruptionColumn;
    volcanoEdgeType = edgeType;
    volcanoStartTime = Date.now();
    volcanoProjectiles = [];
    volcanoVibrateOffset = { x: 0, y: 0 };
    volcanoColorProgress = 0;
    volcanoProjectilesSpawned = 0; // Reset counter
    volcanoTargetProjectiles = lavaBlob.positions.length; // Set target to blob size
    
    // Store the original color of the lava blob for gradual transition
    if (lavaBlob.positions.length > 0) {
        const [x, y] = lavaBlob.positions[0];
        volcanoOriginalColor = board[y][x];
    }
    
    // DON'T remove blocks yet - they stay on board during warming
    // They'll be removed when eruption phase starts
    
    // Play continuous rumble sound to indicate volcano is warming up
    playVolcanoRumble(soundToggle);
}

function updateVolcanoAnimation() {
    if (!volcanoAnimating) return;
    
    const elapsed = Date.now() - volcanoStartTime;
    
    if (volcanoPhase === 'warming') {
        // WARMING PHASE: Vibrate and gradually change color
        const warmingProgress = Math.min(elapsed / volcanoWarmingDuration, 1);
        volcanoColorProgress = warmingProgress;
        
        // Vibration gets more intense as it heats up
        const intensity = 2 + warmingProgress * 6; // 2 to 8 pixels
        const frequency = 0.02 + warmingProgress * 0.03; // Faster vibration over time
        volcanoVibrateOffset.x = Math.sin(Date.now() * frequency) * intensity;
        volcanoVibrateOffset.y = Math.cos(Date.now() * frequency * 1.3) * intensity;
        
        // When warming completes, transition to eruption phase
        if (warmingProgress >= 1) {
            console.log('🌋 Warming complete! Starting eruption...', 'Blob size:', volcanoLavaBlob.positions.length);
            volcanoPhase = 'erupting';
            volcanoStartTime = Date.now(); // Reset timer for eruption phase
            volcanoVibrateOffset = { x: 0, y: 0 }; // Stop vibrating
            
            // Clear the eruption column above lava (but keep lava blob visible)
            const colX = volcanoEruptionColumn;
            const lavaMaxY = Math.max(...volcanoLavaBlob.positions.map(p => p[1]));
            
            // Sort lava blob positions by Y (bottom to top) for sequential removal
            volcanoLavaBlob.positions.sort((a, b) => b[1] - a[1]); // Highest Y (bottom) first
            
            // Disintegrate blocks in eruption column above lava
            for (let y = 0; y < lavaMaxY; y++) {
                if (board[y] && board[y][colX]) {
                    // Create disintegration particles
                    for (let i = 0; i < 3; i++) {
                        disintegrationParticles.push({
                            x: colX * BLOCK_SIZE + Math.random() * BLOCK_SIZE,
                            y: y * BLOCK_SIZE + Math.random() * BLOCK_SIZE,
                            vx: (Math.random() - 0.5) * 4,
                            vy: (Math.random() - 0.5) * 4 - 2, // Slight upward bias
                            size: 2 + Math.random() * 4,
                            color: board[y][colX],
                            opacity: 1,
                            life: 1,
                            decay: 0.02,
                            gravity: 0.15,
                            rotation: Math.random() * Math.PI * 2,
                            rotationSpeed: (Math.random() - 0.5) * 0.2
                        });
                    }
                    board[y][colX] = null;
                    isRandomBlock[y][colX] = false;
                }
            }
            
            // Play explosion sound
            playSoundEffect('explosion', soundToggle);
        }
        
    } else if (volcanoPhase === 'erupting') {
        // ERUPTING PHASE: Spawn projectiles and update physics
        
        // Spawn projectiles at a fixed rate (one every 150ms) regardless of blob size
        const spawnInterval = 150; // ms between spawns
        const targetSpawnedByNow = Math.floor(elapsed / spawnInterval);
        
        // Spawn any missing projectiles (up to the total blob size)
        while (volcanoProjectilesSpawned < targetSpawnedByNow && volcanoProjectilesSpawned < volcanoTargetProjectiles) {
            spawnLavaProjectile();
            volcanoProjectilesSpawned++;
        }
        
        // Update projectiles
        volcanoProjectiles = volcanoProjectiles.filter(p => {
            // Check if projectile is sliding down a wall
            if (p.slidingWall) {
                // Store previous position for sweep collision
                const prevY = p.y;
                
                // Just fall straight down along the wall
                p.vy += p.gravity;
                p.y += p.vy;
                p.vx = 0; // No horizontal movement while sliding
                
                // Determine the grid column for this wall
                const wallGridX = p.slidingWall === 'left' ? 0 : COLS - 1;
                p.x = wallGridX * BLOCK_SIZE + BLOCK_SIZE / 2;
                
                // Check if we've hit bottom
                if (p.y >= ROWS * BLOCK_SIZE) {
                    // Find the lowest empty spot in the wall column
                    for (let y = ROWS - 1; y >= 0; y--) {
                        if (!board[y][wallGridX]) {
                            board[y][wallGridX] = volcanoLavaColor;
                            isRandomBlock[y][wallGridX] = false;
                            p.landed = true;
                            playSoundEffect('drop', soundToggle);
                            break;
                        }
                    }
                    return false;
                }
                
                // SWEEP COLLISION for wall sliding - check all rows passed through
                const prevGridY = Math.floor(prevY / BLOCK_SIZE);
                const currGridY = Math.floor(p.y / BLOCK_SIZE);
                
                for (let checkY = Math.max(0, prevGridY); checkY <= Math.min(ROWS - 1, currGridY); checkY++) {
                    if (board[checkY] && board[checkY][wallGridX]) {
                        // Found a block - land on top of it
                        const landY = checkY - 1;
                        if (landY >= 0 && !board[landY][wallGridX]) {
                            board[landY][wallGridX] = volcanoLavaColor;
                            isRandomBlock[landY][wallGridX] = false;
                            p.landed = true;
                            playSoundEffect('drop', soundToggle);
                            return false;
                        }
                    }
                }
                
                return true; // Keep sliding
            }
            
            // Normal projectile physics (not sliding)
            // Apply gravity
            p.vy += p.gravity;
            
            // Store previous position for sweep collision
            const prevY = p.y;
            
            // Update position
            p.x += p.vx;
            p.y += p.vy;
            
            // Check if projectile hit the left or right wall - start sliding
            if (p.x < BLOCK_SIZE / 2) {
                p.slidingWall = 'left';
                p.x = BLOCK_SIZE / 2;
                p.vx = 0;
                return true; // Continue to slide
            } else if (p.x > (COLS - 1) * BLOCK_SIZE + BLOCK_SIZE / 2) {
                p.slidingWall = 'right';
                p.x = (COLS - 1) * BLOCK_SIZE + BLOCK_SIZE / 2;
                p.vx = 0;
                return true; // Continue to slide
            }
            
            // Check if landed on board or bottom
            let gridX = Math.round(p.x / BLOCK_SIZE);
            const gridY = Math.round(p.y / BLOCK_SIZE);
            
            // Clamp gridX to valid columns
            gridX = Math.max(0, Math.min(COLS - 1, gridX));
            
            // Helper function to find ANY empty spot on the board (searches all columns)
            const findAnyEmptySpot = () => {
                // First try the target column
                for (let y = ROWS - 1; y >= 0; y--) {
                    if (!board[y][gridX]) {
                        return { x: gridX, y: y };
                    }
                }
                // If target column is full, search outward from it
                for (let offset = 1; offset < COLS; offset++) {
                    // Try left
                    const leftX = gridX - offset;
                    if (leftX >= 0) {
                        for (let y = ROWS - 1; y >= 0; y--) {
                            if (!board[y][leftX]) {
                                return { x: leftX, y: y };
                            }
                        }
                    }
                    // Try right
                    const rightX = gridX + offset;
                    if (rightX < COLS) {
                        for (let y = ROWS - 1; y >= 0; y--) {
                            if (!board[y][rightX]) {
                                return { x: rightX, y: y };
                            }
                        }
                    }
                }
                return null; // Board is completely full
            };
            
            // If below board, place it in an empty spot
            if (p.y >= ROWS * BLOCK_SIZE) {
                const spot = findAnyEmptySpot();
                if (spot) {
                    board[spot.y][spot.x] = volcanoLavaColor;
                    isRandomBlock[spot.y][spot.x] = false;
                    p.landed = true;
                    playSoundEffect('drop', soundToggle);
                }
                return false; // Remove projectile (landed or board full)
            }
            
            // SWEEP COLLISION: Check all grid cells between previous and current position
            // This prevents projectiles from passing through blocks when moving fast
            if (p.vy > 0 && gridX >= 0 && gridX < COLS) {
                const prevGridY = Math.floor(prevY / BLOCK_SIZE);
                const currGridY = Math.floor(p.y / BLOCK_SIZE);
                
                // Check each row the projectile passed through
                for (let checkY = Math.max(0, prevGridY); checkY <= Math.min(ROWS - 1, currGridY); checkY++) {
                    // Check if there's a block at this position
                    if (board[checkY] && board[checkY][gridX]) {
                        // Found a block - land on top of it (one row above)
                        const landY = checkY - 1;
                        if (landY >= 0 && !board[landY][gridX]) {
                            board[landY][gridX] = volcanoLavaColor;
                            isRandomBlock[landY][gridX] = false;
                            p.landed = true;
                            playSoundEffect('drop', soundToggle);
                            return false;
                        } else {
                            // Can't land there, find another spot
                            const spot = findAnyEmptySpot();
                            if (spot) {
                                board[spot.y][spot.x] = volcanoLavaColor;
                                isRandomBlock[spot.y][spot.x] = false;
                                p.landed = true;
                                playSoundEffect('drop', soundToggle);
                            }
                            return false;
                        }
                    }
                }
            }
            
            return true; // Keep projectile
        });
        
        // Eruption completes when all blocks have been ejected AND all projectiles have landed
        const allBlocksEjected = volcanoProjectilesSpawned >= volcanoTargetProjectiles;
        const allProjectilesLanded = volcanoProjectiles.length === 0;
        
        if (allBlocksEjected && allProjectilesLanded) {
            console.log('🌋 Volcano eruption complete, applying gravity');
            volcanoAnimating = false;
            volcanoActive = false;
            volcanoPhase = 'warming'; // Reset for next volcano
            applyGravity();
        }
    }
}

function spawnLavaProjectile() {
    if (!volcanoLavaBlob || volcanoEruptionColumn < 0) return;
    if (volcanoLavaBlob.positions.length === 0) return;
    
    // Get the bottom-most block from the lava blob (already sorted bottom-first)
    const [blockX, blockY] = volcanoLavaBlob.positions[0];
    
    // Remove this block from the board
    if (board[blockY] && board[blockY][blockX]) {
        board[blockY][blockX] = null;
        isRandomBlock[blockY][blockX] = false;
        if (fadingBlocks[blockY]) fadingBlocks[blockY][blockX] = null;
    }
    
    // Remove from positions array
    volcanoLavaBlob.positions.shift();
    
    // Find the top of the remaining lava in the eruption column for spawn point
    const lavaInColumn = volcanoLavaBlob.positions.filter(([x, y]) => x === volcanoEruptionColumn);
    let spawnY;
    if (lavaInColumn.length > 0) {
        const topY = Math.min(...lavaInColumn.map(p => p[1]));
        spawnY = topY * BLOCK_SIZE;
    } else {
        // Use the removed block's position
        spawnY = blockY * BLOCK_SIZE;
    }
    
    // Spawn from top of lava blob (or the eruption column)
    const spawnX = volcanoEruptionColumn * BLOCK_SIZE + BLOCK_SIZE / 2;
    
    // Determine horizontal direction based on which edge the volcano is against
    let direction;
    if (volcanoEdgeType.includes('left') && !volcanoEdgeType.includes('right')) {
        // Against left wall - shoot right only
        direction = 1;
    } else if (volcanoEdgeType.includes('right') && !volcanoEdgeType.includes('left')) {
        // Against right wall - shoot left only
        direction = -1;
    } else {
        // Against bottom only, or in a corner - random direction
        direction = Math.random() < 0.5 ? -1 : 1;
    }
    
    // Launch velocity - high arcing trajectories with lots of variation
    const vx = direction * (0.5 + Math.random() * 2.5); // 0.5-3 pixels/frame horizontal (narrower arcs)
    const vy = -(11 + Math.random() * 6); // -11 to -17 pixels/frame vertical (reduced from -16 to -26)
    
    volcanoProjectiles.push({
        x: spawnX,
        y: spawnY,
        vx: vx,
        vy: vy,
        gravity: 0.35, // Slightly higher gravity for nice arcs
        color: volcanoLavaColor,
        landed: false,
        slidingWall: null // null, 'left', or 'right' - when hitting a wall edge
    });
    
    console.log('🌋 Projectile spawned, remaining lava blocks:', volcanoLavaBlob.positions.length);
}

function drawVolcano() {
    if (!volcanoActive && !volcanoAnimating) return;
    
    ctx.save();
    
    if (volcanoPhase === 'warming') {
        // WARMING PHASE: Draw the lava blob vibrating and changing color
        if (!volcanoLavaBlob) return;
        
        // Interpolate between original color and lava color
        const progress = volcanoColorProgress;
        
        // Parse original color (assuming hex format #RRGGBB)
        let startColor = { r: 255, g: 100, b: 100 }; // Default reddish
        if (volcanoOriginalColor && volcanoOriginalColor.startsWith('#')) {
            const hex = volcanoOriginalColor.replace('#', '');
            // Use substring instead of deprecated substr
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            
            // Validate to prevent NaN
            if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                startColor = { r, g, b };
            }
        }
        
        // Parse lava color #FF4500
        const endColor = { r: 255, g: 69, b: 0 };
        
        // Interpolate with validation
        const currentR = Math.floor(startColor.r + (endColor.r - startColor.r) * progress);
        const currentG = Math.floor(startColor.g + (endColor.g - startColor.g) * progress);
        const currentB = Math.floor(startColor.b + (endColor.b - startColor.b) * progress);
        
        // Ensure no NaN values
        const validR = isNaN(currentR) ? 255 : Math.max(0, Math.min(255, currentR));
        const validG = isNaN(currentG) ? 100 : Math.max(0, Math.min(255, currentG));
        const validB = isNaN(currentB) ? 100 : Math.max(0, Math.min(255, currentB));
        
        // Convert to hex format (not rgb) so it works with adjustBrightness
        const currentColor = `#${validR.toString(16).padStart(2, '0')}${validG.toString(16).padStart(2, '0')}${validB.toString(16).padStart(2, '0')}`;

        
        // Apply vibration offset
        ctx.translate(volcanoVibrateOffset.x, volcanoVibrateOffset.y);
        
        // Draw the lava blob with gradually changing color
        const positions = volcanoLavaBlob.positions.map(([x, y]) => [x, y]);
        drawSolidShape(ctx, positions, currentColor, BLOCK_SIZE, false, getFaceOpacity(), false);
        
        // Add glow effect that intensifies as it heats up
        if (progress > 0.3) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = (progress - 0.3) * 0.6; // Fade in from 30% to 100%
            
            // Draw glowing halo around the blob
            positions.forEach(([x, y]) => {
                const gradient = ctx.createRadialGradient(
                    x * BLOCK_SIZE + BLOCK_SIZE / 2,
                    y * BLOCK_SIZE + BLOCK_SIZE / 2,
                    BLOCK_SIZE * 0.3,
                    x * BLOCK_SIZE + BLOCK_SIZE / 2,
                    y * BLOCK_SIZE + BLOCK_SIZE / 2,
                    BLOCK_SIZE * 1.2
                );
                gradient.addColorStop(0, currentColor);
                gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(
                    x * BLOCK_SIZE - BLOCK_SIZE * 0.2,
                    y * BLOCK_SIZE - BLOCK_SIZE * 0.2,
                    BLOCK_SIZE * 1.4,
                    BLOCK_SIZE * 1.4
                );
            });
            ctx.restore();
        }
        
        // Remove vibration translation
        ctx.translate(-volcanoVibrateOffset.x, -volcanoVibrateOffset.y);
        
    } else if (volcanoPhase === 'erupting') {
        // ERUPTING PHASE: Draw remaining lava blob and flying projectiles
        
        // Get current pulsing lava color
        const lavaColor = getLavaColor();
        
        // Draw remaining lava blob (deteriorating from bottom up)
        if (volcanoLavaBlob && volcanoLavaBlob.positions.length > 0) {
            const positions = volcanoLavaBlob.positions.map(([x, y]) => [x, y]);
            drawSolidShape(ctx, positions, lavaColor, BLOCK_SIZE, false, getFaceOpacity(), false);
            
            // Add glow effect
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.5;
            positions.forEach(([x, y]) => {
                const gradient = ctx.createRadialGradient(
                    x * BLOCK_SIZE + BLOCK_SIZE / 2,
                    y * BLOCK_SIZE + BLOCK_SIZE / 2,
                    BLOCK_SIZE * 0.3,
                    x * BLOCK_SIZE + BLOCK_SIZE / 2,
                    y * BLOCK_SIZE + BLOCK_SIZE / 2,
                    BLOCK_SIZE * 1.2
                );
                gradient.addColorStop(0, lavaColor);
                gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(
                    x * BLOCK_SIZE - BLOCK_SIZE * 0.2,
                    y * BLOCK_SIZE - BLOCK_SIZE * 0.2,
                    BLOCK_SIZE * 1.4,
                    BLOCK_SIZE * 1.4
                );
            });
            ctx.restore();
        }
        
        // Draw flying lava projectiles
        volcanoProjectiles.forEach(p => {
            const px = p.x - BLOCK_SIZE / 2;
            const py = p.y - BLOCK_SIZE / 2;
            
            // Trailing glow
            ctx.save();
            ctx.globalAlpha = 0.4;
            const gradient = ctx.createRadialGradient(
                p.x, p.y, 0,
                p.x, p.y, BLOCK_SIZE * 0.6
            );
            gradient.addColorStop(0, lavaColor);
            gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(px - BLOCK_SIZE * 0.2, py - BLOCK_SIZE * 0.2, BLOCK_SIZE * 1.4, BLOCK_SIZE * 1.4);
            ctx.restore();
            
            // Draw solid projectile
            ctx.globalAlpha = 1;
            ctx.fillStyle = lavaColor;
            ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
            
            // Bright center highlight (also pulse)
            const brightHex = lavaColor.replace('#', '');
            const r = Math.min(255, parseInt(brightHex.substring(0, 2), 16) + 40);
            const g = Math.min(255, parseInt(brightHex.substring(2, 4), 16) + 40);
            const b = Math.min(255, parseInt(brightHex.substring(4, 6), 16));
            const brightColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            
            ctx.fillStyle = brightColor;
            ctx.fillRect(px + BLOCK_SIZE * 0.25, py + BLOCK_SIZE * 0.25, BLOCK_SIZE * 0.5, BLOCK_SIZE * 0.5);
        });
    }
    
    ctx.restore();
}

function detectVolcanoes(blobs) {
    // Returns array of {lavaBlob, outerBlob, eruptionColumn, edgeType} where lavaBlob touches any edge and is enveloped
    const volcanoes = [];
    
    for (let i = 0; i < blobs.length; i++) {
        const inner = blobs[i];
        
        // Skip blobs that are already lava-colored (prevents chain reactions from landed lava)
        if (inner.color === volcanoLavaColor) continue;
        
        // Check if ANY block in the blob is touching an edge of the well
        const touchesBottom = inner.positions.some(([x, y]) => y === ROWS - 1);
        const touchesLeft = inner.positions.some(([x, y]) => x === 0);
        const touchesRight = inner.positions.some(([x, y]) => x === COLS - 1);
        const touchesEdge = touchesBottom || touchesLeft || touchesRight;
        
        if (!touchesEdge) continue; // Not touching any edge
        
        // Determine which edge(s) are touched for eruption direction
        let edgeType = '';
        if (touchesLeft) edgeType += 'left';
        if (touchesRight) edgeType += 'right';
        if (touchesBottom) edgeType += 'bottom';
        
        // Check if enveloped by another blob (with special volcano rules)
        for (let j = 0; j < blobs.length; j++) {
            if (i === j) continue;
            
            const outer = blobs[j];
            
            if (isBlobEnvelopedForVolcano(inner, outer, edgeType)) {
                // Found volcano! Choose random column from inner blob for eruption
                const innerColumns = [...new Set(inner.positions.map(p => p[0]))];
                const eruptionColumn = innerColumns[Math.floor(Math.random() * innerColumns.length)];
                
                volcanoes.push({
                    lavaBlob: inner,
                    outerBlob: outer,
                    eruptionColumn: eruptionColumn,
                    edgeType: edgeType
                });
                
                break; // One volcano per inner blob
            }
        }
    }
    
    return volcanoes;
}

function isBlobEnvelopedForVolcano(innerBlob, outerBlob, edgeType) {
    // Special envelopment check for volcano: allows specified edges to be well walls
    const outerSet = new Set(outerBlob.positions.map(p => `${p[0]},${p[1]}`));
    const innerSet = new Set(innerBlob.positions.map(p => `${p[0]},${p[1]}`));
    
    for (const [x, y] of innerBlob.positions) {
        const adjacents = [
            [x-1, y],   // left
            [x+1, y],   // right
            [x, y-1],   // top
            [x, y+1]    // bottom
        ];
        
        for (const [ax, ay] of adjacents) {
            const key = `${ax},${ay}`;
            
            // Special cases for volcano: edges touching well walls are allowed
            // Bottom edge touching well floor
            if (ay >= ROWS && edgeType.includes('bottom')) {
                continue; // Bottom edge touching well floor is allowed
            }
            
            // Left edge touching left wall
            if (ax < 0 && edgeType.includes('left')) {
                continue; // Left edge touching left wall is allowed
            }
            
            // Right edge touching right wall
            if (ax >= COLS && edgeType.includes('right')) {
                continue; // Right edge touching right wall is allowed
            }
            
            // If adjacent position is OUT OF BOUNDS and not an allowed edge, NOT enveloped
            if (ax < 0 || ax >= COLS || ay < 0 || ay >= ROWS) {
                return false;
            }
            
            // Adjacent is in bounds - check if it's part of outer or inner blob
            const isOuter = outerSet.has(key);
            const isInner = innerSet.has(key);
            
            // If it's neither outer nor inner, then inner is NOT enveloped
            if (!isOuter && !isInner) {
                return false;
            }
        }
    }
    
    // All adjacent cells (except allowed edges) are either outer blob or inner blob
    return true;
}

// ============================================
// END VOLCANO SYSTEM
// ============================================

function triggerTsunamiAnimation(blob) {
    tsunamiBlob = blob;
    tsunamiBlocks = [];
    
    // Find center Y and bounds of the blob
    const allY = blob.positions.map(p => p[1]);
    const centerY = (Math.min(...allY) + Math.max(...allY)) / 2;
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    
    // Store the original blob positions (integers)
    blob.positions.forEach(([x, y]) => {
        tsunamiBlocks.push({
            x: x,
            y: y,
            color: blob.color
        });
    });
    
    // Store blob info for animation
    tsunamiBlob.centerY = centerY;
    tsunamiBlob.minY = minY;
    tsunamiBlob.maxY = maxY;
    tsunamiBlob.originalHeight = maxY - minY + 1;
    
    // Find all blocks that need to be pushed up
    // A block needs to be pushed if there's ANY tsunami block below it in the same column
    // (because that tsunami block will expand upward and hit it)
    tsunamiPushedBlocks = [];
    
    // Create a set of tsunami positions for fast lookup
    const tsunamiPositions = new Set();
    blob.positions.forEach(([x, y]) => {
        tsunamiPositions.add(`${x},${y}`);
    });
    
    console.log('Tsunami color:', blob.color);
    console.log('Tsunami positions:', blob.positions.length, 'blocks');
    console.log('Analyzing which blocks have tsunami below them...');
    
    // Track which cells we've already processed
    const processed = Array(ROWS).fill(null).map(() => Array(COLS).fill(false));
    
    // Mark tsunami blocks as processed so we don't include them
    blob.positions.forEach(([x, y]) => {
        processed[y][x] = true;
    });
    
    // Find connected sections - normal flood fill, don't jump over tsunami
    function findConnectedSection(startX, startY, color) {
        const section = [];
        const stack = [[startX, startY]];
        const visited = new Set();
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${x},${y}`;
            
            if (visited.has(key)) continue;
            visited.add(key);
            
            // Check bounds
            if (y < 0 || y >= ROWS || x < 0 || x >= COLS) continue;
            if (!board[y] || board[y][x] === null) continue;
            
            // Skip tsunami blocks completely
            if (processed[y][x]) continue;
            
            // Only add blocks of matching color
            if (board[y][x] !== color) continue;
            
            // Mark as processed and add to section
            processed[y][x] = true;
            section.push({
                x: x,
                y: y,
                color: color,
                isRandom: isRandomBlock[y][x]
            });
            
            // Check adjacent cells
            stack.push([x + 1, y]);
            stack.push([x - 1, y]);
            stack.push([x, y + 1]);
            stack.push([x, y - 1]);
        }
        
        return section;
    }
    
    // Helper function: does this position have any tsunami block below it in the same column?
    function hasTsunamiBelowInColumn(x, y) {
        for (let checkY = y + 1; checkY < ROWS; checkY++) {
            if (tsunamiPositions.has(`${x},${checkY}`)) {
                return true;
            }
        }
        return false;
    }
    
    // Find all complete blobs that have tsunami below them
    console.log(`Searching all positions for blocks with tsunami below them...`);
    let cellsChecked = 0;
    let cellsWithBlocks = 0;
    let cellsNeedingPush = 0;
    
    const blobsToPush = [];
    
    // Search entire board for non-tsunami blocks
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            cellsChecked++;
            if (board[y] && board[y][x] !== null) {
                cellsWithBlocks++;
                
                if (!processed[y][x]) {
                    // Check if this block has tsunami below it
                    if (hasTsunamiBelowInColumn(x, y)) {
                        cellsNeedingPush++;
                        console.log(`  Found block at (${x}, ${y}), color: ${board[y][x]} - has tsunami below`);
                        
                        // Found a block that needs to be pushed - get its entire connected blob
                        const section = findConnectedSection(x, y, board[y][x]);
                    
                        if (section.length > 0) {
                            console.log(`  Found connected section with ${section.length} blocks, color: ${section[0].color}`);
                            
                            const tsunamiHeight = maxY - minY + 1;
                            console.log(`  Tsunami: minY=${minY}, maxY=${maxY}, height=${tsunamiHeight}`);
                            
                            let maxPushNeeded = 0;
                            let blocksNeedingPush = 0;
                            
                            section.forEach(block => {
                                if (hasTsunamiBelowInColumn(block.x, block.y)) {
                                    blocksNeedingPush++;
                                    
                                    let pushNeeded;
                                    
                                    // Find the topmost tsunami block in this column
                                    let topmostTsunamiY = maxY;
                                    for (let checkY = block.y + 1; checkY <= maxY; checkY++) {
                                        if (tsunamiPositions.has(`${block.x},${checkY}`)) {
                                            topmostTsunamiY = checkY;
                                            break;
                                        }
                                    }
                                    
                                    // Calculate the height of tsunami from the topmost block to the bottom
                                    const tsunamiHeightBelow = maxY - topmostTsunamiY + 1;
                                    
                                    // Block needs to be pushed by the height of tsunami below it
                                    // (because that section will expand upward by its own height)
                                    pushNeeded = tsunamiHeightBelow;
                                    
                                    maxPushNeeded = Math.max(maxPushNeeded, pushNeeded);
                                    console.log(`    Block at (${block.x},${block.y}): topmost tsunami at ${topmostTsunamiY}, height below=${tsunamiHeightBelow}, push=${pushNeeded}`);
                                }
                            });
                            
                            if (blocksNeedingPush > 0 && maxPushNeeded > 0) {
                                console.log(`  -> Lifting ENTIRE blob (${section.length} blocks) by ${maxPushNeeded} blocks`);
                                
                                const blocksToPush = section.map(block => ({
                                    x: block.x,
                                    y: block.y,
                                    color: block.color,
                                    isRandom: block.isRandom,
                                    tsunamiHeightBelow: maxPushNeeded
                                }));
                                
                                blobsToPush.push(blocksToPush);
                            } else {
                                console.log(`  -> Blob doesn't need pushing (maxPush=${maxPushNeeded})`);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Now push all blocks from all identified blobs
    blobsToPush.forEach(section => {
        section.forEach(block => {
            tsunamiPushedBlocks.push(block);
            // Remove from board temporarily
            board[block.y][block.x] = null;
            isRandomBlock[block.y][block.x] = false;
        });
    });
    
    console.log(`Checked ${cellsChecked} cells, found ${cellsWithBlocks} with blocks, ${cellsNeedingPush} need pushing`);
    console.log(`Total blocks to push: ${tsunamiPushedBlocks.length}`);
    
    // Remove tsunami blocks from board immediately (we'll animate them)
    blob.positions.forEach(([x, y]) => {
        board[y][x] = null;
        isRandomBlock[y][x] = false;
        fadingBlocks[y][x] = null;
    });
    
    tsunamiActive = true;
    tsunamiAnimating = true;
    tsunamiStartTime = Date.now();
    tsunamiWobbleIntensity = 6; // pixels of vertical wobble
    tsunamiDuration = 2500; // Longer duration for surge + collapse
    
    // Visual effects
    canvas.classList.add('tsunami-active');
    playSoundEffect('gold', soundToggle);
    const avgY = blob.positions.reduce((s, p) => s + p[1], 0) / blob.positions.length;
    triggerTsunami(avgY * BLOCK_SIZE);
}

function updateTsunamiAnimation() {
    if (!tsunamiAnimating) return;
    
    const elapsed = Date.now() - tsunamiStartTime;
    const progress = Math.min(elapsed / tsunamiDuration, 1);
    
    // Wobble intensity decreases over time
    tsunamiWobbleIntensity = 6 * (1 - progress * 0.5);
    
    // Two phases: surge (0-0.4) and collapse (0.4-1.0)
    const surgePhaseEnd = 0.4;
    
    if (progress <= surgePhaseEnd) {
        // SURGE PHASE: expand upward to 2x height
        const surgeProgress = progress / surgePhaseEnd; // 0 to 1
        const easeProgress = 1 - Math.pow(1 - surgeProgress, 2); // Ease out quad
        tsunamiBlob.currentScale = 1 + easeProgress; // 1.0 to 2.0
        
        // Calculate push distance for blocks above
        // Blocks need to be pushed by exactly the expansion amount
        const maxPush = tsunamiBlob.originalHeight * BLOCK_SIZE;
        tsunamiBlob.pushDistance = easeProgress * maxPush;
        
        if (Math.random() < 0.01) { // Log occasionally to avoid spam
            console.log(`Surge: scale=${tsunamiBlob.currentScale.toFixed(2)}, pushDistance=${tsunamiBlob.pushDistance.toFixed(1)}px (${(tsunamiBlob.pushDistance/BLOCK_SIZE).toFixed(1)} blocks)`);
        }
    } else {
        // COLLAPSE PHASE: shrink downward from top to bottom (scale down from bottom anchor)
        const collapseProgress = (progress - surgePhaseEnd) / (1 - surgePhaseEnd); // 0 to 1
        const easeProgress = Math.pow(collapseProgress, 2); // Ease in quad
        tsunamiBlob.currentScale = 2 - easeProgress * 2; // 2.0 to 0.0
        
        // Blocks fall back smoothly as tsunami collapses
        const maxPush = tsunamiBlob.originalHeight * BLOCK_SIZE;
        tsunamiBlob.pushDistance = maxPush * (1 - easeProgress);
    }
    
    // Animation complete
    if (progress >= 1) {
        tsunamiAnimating = false;
        tsunamiActive = false;
        tsunamiWobbleIntensity = 0;
        canvas.classList.remove('tsunami-active');
        
        // Put pushed blocks back on board at their original positions
        // They will then fall naturally with gravity (potentially reconnecting with other blocks)
        console.log('=== TSUNAMI COMPLETE - PLACING BLOCKS BACK ===');
        let placedCount = 0;
        let skippedCount = 0;
        
        tsunamiPushedBlocks.forEach(block => {
            // Place block back at its original position
            if (block.y >= 0 && block.y < ROWS && board[block.y] && board[block.y][block.x] === null) {
                board[block.y][block.x] = block.color;
                isRandomBlock[block.y][block.x] = block.isRandom || false;
                placedCount++;
                console.log(`  Placed block at (${block.x}, ${block.y}), color: ${block.color}`);
            } else {
                skippedCount++;
                console.log(`  SKIPPED block at (${block.x}, ${block.y}) - position occupied or invalid`);
            }
        });
        
        console.log(`Placed ${placedCount} blocks, skipped ${skippedCount} blocks`);
        
        // Clear tsunami data AFTER placing blocks to avoid flicker
        tsunamiPushedBlocks = [];
        tsunamiBlob = null;
        tsunamiBlocks = [];
        
        // Apply multi-pass gravity to let everything settle
        // This will cause the pushed blocks to fall properly through multiple passes
        applyGravity();
        // Note: checkForSpecialFormations will be called after gravity animation completes
    }
}

function drawTsunami() {
    if (!tsunamiActive || !tsunamiAnimating || !tsunamiBlob) return;
    
    const elapsed = Date.now() - tsunamiStartTime;
    const progress = Math.min(elapsed / tsunamiDuration, 1);
    
    const currentScale = tsunamiBlob.currentScale || 1;
    const pushDistance = tsunamiBlob.pushDistance || 0;
    
    ctx.save();
    
    // Draw pushed blocks as connected sections
    // Group blocks by color to draw connected sections together
    ctx.globalAlpha = 1;
    
    // Group pushed blocks by color
    const blocksByColor = {};
    tsunamiPushedBlocks.forEach(block => {
        if (!blocksByColor[block.color]) {
            blocksByColor[block.color] = [];
        }
        blocksByColor[block.color].push(block);
    });
    
    // Draw each color group as potentially multiple connected sections
    Object.entries(blocksByColor).forEach(([color, blocks]) => {
        // For each color, group by push amount, then find connected components within each push group
        const byPushAmount = {};
        blocks.forEach(block => {
            const key = block.tsunamiHeightBelow || 0;
            if (!byPushAmount[key]) {
                byPushAmount[key] = [];
            }
            byPushAmount[key].push(block);
        });
        
        // For each push-amount group, find connected components and draw each separately
        Object.entries(byPushAmount).forEach(([pushAmount, groupBlocks]) => {
            const visited = new Set();
            
            groupBlocks.forEach(startBlock => {
                const key = `${startBlock.x},${startBlock.y}`;
                if (visited.has(key)) return;
                
                // Find all blocks connected to this one via flood fill
                const connectedSection = [];
                const stack = [startBlock];
                
                while (stack.length > 0) {
                    const block = stack.pop();
                    const blockKey = `${block.x},${block.y}`;
                    
                    if (visited.has(blockKey)) continue;
                    visited.add(blockKey);
                    connectedSection.push(block);
                    
                    // Find adjacent blocks in the same push group
                    groupBlocks.forEach(other => {
                        const otherKey = `${other.x},${other.y}`;
                        if (visited.has(otherKey)) return;
                        
                        const dx = Math.abs(other.x - block.x);
                        const dy = Math.abs(other.y - block.y);
                        
                        if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
                            stack.push(other);
                        }
                    });
                }
                
                // Draw this connected section (normal rendering, not gold)
                if (connectedSection.length > 0) {
                    const positions = connectedSection.map(block => {
                        const individualPush = (block.tsunamiHeightBelow || 0) * BLOCK_SIZE;
                        const progressMultiplier = pushDistance / (tsunamiBlob.originalHeight * BLOCK_SIZE);
                        const adjustedPush = individualPush * progressMultiplier;
                        const pushedY = block.y - adjustedPush / BLOCK_SIZE;
                        return [block.x, pushedY];
                    });
                    
                    drawSolidShape(ctx, positions, color, BLOCK_SIZE, false, getFaceOpacity());
                }
            });
        });
    });
    
    // Calculate the anchor point (BOTTOM of blob - surge upward from bottom)
    const bottomPixelY = tsunamiBlob.maxY * BLOCK_SIZE + BLOCK_SIZE; // Bottom edge of blob
    
    // Apply transform to scale upward from bottom
    ctx.translate(0, bottomPixelY);
    ctx.scale(1, currentScale);
    ctx.translate(0, -bottomPixelY);
    
    // Fade during collapse phase only (after 40% progress)
    const surgePhaseEnd = 0.4;
    if (progress > surgePhaseEnd) {
        const collapseProgress = (progress - surgePhaseEnd) / (1 - surgePhaseEnd);
        const alpha = 1 - collapseProgress * 0.7;
        ctx.globalAlpha = Math.max(0.3, alpha);
    } else {
        ctx.globalAlpha = 1;
    }
    
    // Draw tsunami blob as a solid shape with gold edges
    const positions = tsunamiBlocks.map(block => [block.x, block.y]);
    drawSolidShape(ctx, positions, tsunamiBlob.color, BLOCK_SIZE, true, getFaceOpacity());
    
    ctx.restore();
    
    // Add trailing particles during collapse
    if (Math.random() < 0.2 && progress > surgePhaseEnd) {
        const randomBlock = tsunamiBlocks[Math.floor(Math.random() * tsunamiBlocks.length)];
        if (randomBlock) {
            const px = randomBlock.x * BLOCK_SIZE;
            const py = randomBlock.y * BLOCK_SIZE;
            const bottomPixelY = tsunamiBlob.maxY * BLOCK_SIZE + BLOCK_SIZE;
            const transformedY = bottomPixelY + (py + BLOCK_SIZE / 2 - bottomPixelY) * currentScale;
            
            disintegrationParticles.push({
                x: px + BLOCK_SIZE / 2 + (Math.random() - 0.5) * BLOCK_SIZE,
                y: transformedY,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 2,
                size: 2 + Math.random() * 3,
                color: tsunamiBlob.color,
                opacity: 0.6,
                life: 0.6,
                decay: 0.04,
                gravity: 0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3
            });
        }
    }
}

function spawnTornado() {
    if (tornadoActive || !gameRunning || paused) return;
    
    tornadoActive = true;
    tornadoY = 0;
    // Start at a random X position
    tornadoX = (Math.random() * (COLS - 2) + 1) * BLOCK_SIZE + BLOCK_SIZE / 2;
    tornadoRotation = 0;
    tornadoState = 'descending';
    tornadoPickedBlob = null;
    tornadoParticles = [];
    tornadoDropTargetX = 0;
    tornadoBlobRotation = 0;
    tornadoVerticalRotation = 0;
    tornadoSnakeVelocity = 0;
    tornadoSnakeDirection = Math.random() < 0.5 ? 1 : -1;
    tornadoSnakeChangeCounter = Math.floor(Math.random() * 30 + 20); // Change every 20-50 frames
    tornadoOrbitStartTime = null;
    tornadoOrbitRadius = 0;
    tornadoOrbitAngle = 0;
    tornadoLiftHeight = 0;
    tornadoDropStartY = 0;
    tornadoFadeProgress = 0;
    
    // Create initial swirling particles
    for (let i = 0; i < 50; i++) {
        const angle = (i / 50) * Math.PI * 2;
        const radius = 20 + Math.random() * 30;
        tornadoParticles.push({
            angle: angle,
            radius: radius,
            speed: 0.1 + Math.random() * 0.1,
            opacity: 0.3 + Math.random() * 0.4
        });
    }
    
    startTornadoWind(soundToggle); // Start continuous wind sound
    console.log('🌪️ Tornado spawned!');
}

// Calculate drop interval based on number of lines cleared
function calculateDropInterval(linesCleared) {
    return Math.max(20, 1000 - (linesCleared * 8.1));
}

// Developer mode function: Advance to next planet
function advanceToNextPlanet() {
    console.log('advanceToNextPlanet called, gameRunning:', gameRunning, 'paused:', paused);
    if (!gameRunning || paused) return;
    
    const planets = StarfieldSystem.getPlanets();
    console.log('Current level:', level, 'Planets:', planets);
    
    // Find the next planet level
    const currentPlanet = planets.find(p => p.level === level);
    const nextPlanet = planets.find(p => p.level > level);
    
    console.log('Current planet:', currentPlanet, 'Next planet:', nextPlanet);
    
    if (nextPlanet) {
        // Advance to next planet's level
        level = nextPlanet.level;
        currentGameLevel = level; StarfieldSystem.setCurrentGameLevel(level);
        lines = (level - 1) * 11; // Update lines to match level
        dropInterval = calculateDropInterval(lines);
        updateStats();
        console.log(`🪐 Advanced to ${nextPlanet.name} (Level ${level})`);
    } else {
        console.log('Already at the last planet!');
    }
}

// Earthquake effect
function spawnEarthquake() {
    if (earthquakeActive || !gameRunning || paused) return;
    
    // Check if there's enough of a stack (tallest block must be above row 15, i.e., row 0-15)
    let tallestRow = ROWS;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] !== null) {
                tallestRow = Math.min(tallestRow, y);
                break;
            }
        }
        if (tallestRow < ROWS) break;
    }
    
    // If tallest block is in bottom 4 rows (rows 16-19), don't trigger
    if (tallestRow >= ROWS - 4) {
        console.log('🚫 Not enough stack height for earthquake (tallest row:', tallestRow, ')');
        return;
    }
    
    console.log('🌍 Earthquake triggered! Tallest row:', tallestRow);
    earthquakeActive = true;
    earthquakePhase = 'shake'; // Start with shaking, crack appears after delay
    earthquakeShakeProgress = 0;
    earthquakeShakeIntensity = 6; // Horizontal shaking intensity
    earthquakeCrack = [];
    earthquakeCrackMap.clear();
    earthquakeCrackProgress = 0;
    earthquakeShiftProgress = 0;
    earthquakeLeftBlocks = [];
    earthquakeRightBlocks = [];
    
    // Crack will be generated after shake delay completes
    
    // Play continuous rumble sound to indicate earthquake starting
    playEarthquakeRumble(soundToggle);
}

function updateTornado() {
    if (!tornadoActive) return;
    
    tornadoRotation += 0.2; // Spin the tornado
    
    // Update particle positions (spiral)
    tornadoParticles.forEach(p => {
        p.angle += p.speed;
    });
    
    if (tornadoState === 'descending') {
        tornadoY += tornadoSpeed;
        
        // Subtle random snaking - more natural drift
        tornadoSnakeChangeCounter--;
        
        if (tornadoSnakeChangeCounter <= 0) {
            // Randomly change direction
            if (Math.random() < 0.3) {
                tornadoSnakeDirection *= -1;
            }
            tornadoSnakeChangeCounter = Math.floor(Math.random() * 30 + 20);
        }
        
        // Gradually accelerate/decelerate in current direction
        const maxSpeed = 1.5; // Much more subtle max speed
        tornadoSnakeVelocity += tornadoSnakeDirection * 0.05;
        tornadoSnakeVelocity = Math.max(-maxSpeed, Math.min(maxSpeed, tornadoSnakeVelocity));
        
        // Apply velocity with some damping
        tornadoX += tornadoSnakeVelocity;
        tornadoSnakeVelocity *= 0.98; // Gentle damping
        
        // Soft bounce off walls instead of hard clamp
        if (tornadoX < BLOCK_SIZE * 1.5) {
            tornadoSnakeDirection = 1;
            tornadoSnakeVelocity = 0.5;
        } else if (tornadoX > canvas.width - BLOCK_SIZE * 1.5) {
            tornadoSnakeDirection = -1;
            tornadoSnakeVelocity = -0.5;
        }
        
        // Keep within bounds
        tornadoX = Math.max(BLOCK_SIZE, Math.min(canvas.width - BLOCK_SIZE, tornadoX));
        
        // Check if tornado touched a blob or bottom
        const tornadoRow = Math.floor(tornadoY / BLOCK_SIZE);
        const tornadoCol = Math.floor(tornadoX / BLOCK_SIZE);
        
        // Check if hit bottom
        if (tornadoRow >= ROWS) {
            // Touched bottom - TOUCHDOWN BONUS!
            score *= 2;
            updateStats();
            canvas.classList.add('touchdown-active');
            playSoundEffect('gold', soundToggle);
            setTimeout(() => canvas.classList.remove('touchdown-active'), 1000);
            tornadoActive = false;
            stopTornadoWind(); // Stop the wind sound
            return;
        }
        
        // Check if hit a blob
        if (tornadoRow >= 0 && tornadoRow < ROWS && tornadoCol >= 0 && tornadoCol < COLS) {
            const cell = board[tornadoRow][tornadoCol];
            if (cell !== null) {
                // Hit a blob! Find the full blob
                const blobs = getAllBlobs();
                const hitBlob = blobs.find(b => 
                    b.positions.some(([x, y]) => x === tornadoCol && y === tornadoRow)
                );
                
                if (hitBlob) {
                    // Check if blob can be lifted (not locked by other blobs)
                    if (canLiftBlob(hitBlob)) {
                        // Pick it up!
                        tornadoPickedBlob = {
                            color: hitBlob.color,
                            positions: hitBlob.positions.map(([x, y]) => [x, y]) // Clone positions
                        };
                        tornadoLiftStartY = tornadoY;
                        tornadoBlobRotation = 0;
                        tornadoVerticalRotation = 0;
                        tornadoDropStartY = 0;
                        
                        // Remove blob from board
                        hitBlob.positions.forEach(([x, y]) => {
                            board[y][x] = null;
                            isRandomBlock[y][x] = false;
                            fadingBlocks[y][x] = null;
                        });
                        
                        tornadoState = 'lifting';
                        playSoundEffect('rotate', soundToggle); // Pickup sound
                    } else {
                        // Disintegrate it (no points) - create explosion!
                        createDisintegrationExplosion(hitBlob);
                        
                        hitBlob.positions.forEach(([x, y]) => {
                            board[y][x] = null;
                            isRandomBlock[y][x] = false;
                            fadingBlocks[y][x] = null;
                        });
                        playSmallExplosion(soundToggle); // Explosion sound for destroyed blob
                        
                        // Apply gravity after removing the blob
                        applyGravity();
                        
                        tornadoState = 'dissipating';
                        tornadoFadeProgress = 0;
                    }
                }
            }
        }
    } else if (tornadoState === 'lifting') {
        // Blob climbs up the tornado while orbiting around it
        
        // Initialize orbit tracking
        if (!tornadoOrbitStartTime) {
            tornadoOrbitStartTime = Date.now();
            tornadoOrbitRadius = 30; // Start close
            tornadoLiftHeight = tornadoY; // Start at pickup point
            tornadoVerticalRotation = 0;
        }
        
        const orbitTime = Date.now() - tornadoOrbitStartTime;
        const orbitDuration = 3000; // 3 seconds to climb and orbit
        const liftProgress = Math.min(orbitTime / orbitDuration, 1.0);
        
        // Blob climbs up the tornado from pickup point to top
        const targetHeight = canvas.height * 0.25; // Climb to 1/4 from top
        tornadoLiftHeight = tornadoY - (tornadoY - targetHeight) * liftProgress;
        
        // Gradually expand orbit radius as it climbs
        tornadoOrbitRadius = 30 + liftProgress * 40;
        
        // Orbit angle increases over time (multiple rotations during climb)
        tornadoOrbitAngle = (orbitTime / 1000) * Math.PI * 2; // Full rotation per second
        
        // Spin the blob as it orbits
        tornadoBlobRotation += 0.12;
        tornadoVerticalRotation += 0.08; // Spin around vertical axis too
        
        if (liftProgress >= 1.0) {
            // Reached top - fling free!
            tornadoState = 'carrying';
            // Pick random drop column INSIDE the well
            const blobWidth = Math.max(...tornadoPickedBlob.positions.map(p => p[0])) - 
                             Math.min(...tornadoPickedBlob.positions.map(p => p[0])) + 1;
            const maxDropCol = COLS - blobWidth;
            tornadoDropTargetX = Math.floor(Math.random() * maxDropCol + blobWidth / 2) * BLOCK_SIZE + BLOCK_SIZE / 2;
        }
    } else if (tornadoState === 'carrying') {
        // Blob flung free - moves to drop target while still orbiting (but orbit fades out)
        const dx = tornadoDropTargetX - tornadoX;
        tornadoBlobRotation += 0.12;
        tornadoVerticalRotation += 0.08;
        
        // Continue orbiting but fade it out
        if (!tornadoOrbitStartTime) tornadoOrbitStartTime = Date.now();
        const carryTime = Date.now() - tornadoOrbitStartTime;
        tornadoOrbitAngle = (carryTime / 1000) * Math.PI * 2;
        
        // Gradually reduce orbit radius (blob breaking free)
        tornadoOrbitRadius = Math.max(0, 70 - carryTime / 20);
        
        if (Math.abs(dx) > 5) {
            tornadoX += Math.sign(dx) * 5;
        } else {
            tornadoX = tornadoDropTargetX;
            tornadoState = 'dropping';
            tornadoOrbitRadius = 0; // Fully broken free
            tornadoDropStartY = tornadoLiftHeight; // Start falling from lift height
        }
    } else if (tornadoState === 'dropping') {
        // Blob breaks free from orbit and falls straight down
        // Start fall from the lift height, not from ground
        if (!tornadoDropStartY) {
            tornadoDropStartY = tornadoLiftHeight;
        }
        
        // Fall from lift height
        tornadoDropStartY += tornadoSpeed * 2;
        tornadoBlobRotation += 0.15;
        tornadoVerticalRotation += 0.1; // Spin around vertical axis
        
        // Reset orbit tracking
        tornadoOrbitAngle = 0;
        tornadoOrbitRadius = 0;
        
        // Find where to land the blob
        if (tornadoPickedBlob) {
            const dropCol = Math.floor(tornadoX / BLOCK_SIZE);
            const minY = Math.min(...tornadoPickedBlob.positions.map(p => p[1]));
            const currentBlobBottomY = Math.floor(tornadoDropStartY / BLOCK_SIZE) - minY;
            
            // Check if blob should land
            let shouldLand = false;
            
            // Check if hit bottom
            if (currentBlobBottomY + Math.max(...tornadoPickedBlob.positions.map(p => p[1])) >= ROWS) {
                shouldLand = true;
            } else {
                // Check if blob would collide with existing blocks
                for (const [bx, by] of tornadoPickedBlob.positions) {
                    const testY = currentBlobBottomY + by + 1;
                    if (testY >= 0 && testY < ROWS) {
                        const minBlobX = Math.min(...tornadoPickedBlob.positions.map(p => p[0]));
                        const testX = dropCol - minBlobX + bx;
                        if (testX >= 0 && testX < COLS && board[testY][testX]) {
                            shouldLand = true;
                            break;
                        }
                    }
                }
            }
            
            if (shouldLand) {
                // Drop the blob
                dropBlobAt(tornadoPickedBlob, dropCol);
                playSoundEffect('drop', soundToggle);
                
                // Check for line clears after dropping
                clearLines();
                
                tornadoPickedBlob = null;
                tornadoState = 'dissipating';
                tornadoFadeProgress = 0;
            }
        }
    } else if (tornadoState === 'dissipating') {
        // Tornado gradually gets thinner and disappears
        tornadoFadeProgress += 0.02; // Takes ~50 frames (about 0.8 seconds)
        
        if (tornadoFadeProgress >= 1.0) {
            tornadoActive = false;
            stopTornadoWind(); // Stop the wind sound
        }
    }
}

function canLiftBlob(blob) {
    // A blob can be lifted if NO OTHER blobs are resting on top of it
    // Check each block in the blob to see if there's a different blob directly above
    
    const blobSet = new Set(blob.positions.map(([x, y]) => `${x},${y}`));
    
    for (const [x, y] of blob.positions) {
        // Check the cell directly ABOVE this block
        if (y - 1 >= 0) {
            const cellAbove = board[y - 1][x];
            
            // If there's a block above...
            if (cellAbove !== null) {
                // Check if it's part of THIS blob
                const isSameBlob = blobSet.has(`${x},${y - 1}`);
                
                // If it's a DIFFERENT blob above, this blob is supporting it - LOCKED
                if (!isSameBlob) {
                    return false;
                }
            }
        }
    }
    
    // No different-colored blocks found resting on top - can lift!
    return true;
}

function dropBlobAt(blob, centerCol) {
    // Find the blob's bounding box
    const minX = Math.min(...blob.positions.map(p => p[0]));
    const maxX = Math.max(...blob.positions.map(p => p[0]));
    const minY = Math.min(...blob.positions.map(p => p[1]));
    const maxY = Math.max(...blob.positions.map(p => p[1]));
    const blobWidth = maxX - minX + 1;
    
    // Calculate offset to place blob at target column, ensuring it fits
    const blobCenterX = Math.floor((minX + maxX) / 2);
    let offsetX = centerCol - blobCenterX;
    
    // Clamp to ensure blob stays within bounds
    // Check left edge
    if (minX + offsetX < 0) {
        offsetX = -minX;
    }
    // Check right edge
    if (maxX + offsetX >= COLS) {
        offsetX = COLS - 1 - maxX;
    }
    
    // Find lowest valid Y position for the blob
    let finalY = ROWS - 1;
    for (let testY = ROWS - 1; testY >= 0; testY--) {
        let canPlace = true;
        for (const [bx, by] of blob.positions) {
            const newX = bx + offsetX;
            const newY = testY - (maxY - by);
            
            // Check bounds
            if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) {
                canPlace = false;
                break;
            }
            
            // Check collision with existing blocks
            if (board[newY][newX] !== null) {
                canPlace = false;
                break;
            }
        }
        
        if (canPlace) {
            finalY = testY;
            break;
        }
    }
    
    // Place the blob (with bounds check as safety)
    for (const [bx, by] of blob.positions) {
        const newX = bx + offsetX;
        const newY = finalY - (maxY - by);
        
        if (newX >= 0 && newX < COLS && newY >= 0 && newY < ROWS) {
            board[newY][newX] = blob.color;
            isRandomBlock[newY][newX] = false;
            fadingBlocks[newY][newX] = null;
        }
    }
}

function drawTornado() {
    if (!tornadoActive) return;
    
    ctx.save();
    
    const height = Math.max(5, tornadoY);
    
    // Apply dissipation fade - reduce all widths
    const fadeFactor = tornadoState === 'dissipating' ? (1 - tornadoFadeProgress) : 1.0;
    const topWidth = 100 * fadeFactor;  // Very wide top connected to clouds
    const midWidth = 18 * fadeFactor;   // Width after quick taper
    const bottomWidth = 8 * fadeFactor; // Gradually narrow at bottom
    
    // Smooth easing function for width taper - creates natural funnel curve
    const getWidth = (progress) => {
        // Use cubic ease-out for smooth, natural taper
        // Quick taper at top, gradual narrowing toward bottom
        const eased = 1 - Math.pow(1 - progress, 3);
        return topWidth - (topWidth - bottomWidth) * eased;
    };
    
    // First, draw the base tube shape WITH VERY SUBTLE BENDING
    // Also fade opacity during dissipation
    const baseOpacity = tornadoState === 'dissipating' ? 0.6 * (1 - tornadoFadeProgress * 0.5) : 0.6;
    ctx.globalAlpha = baseOpacity;
    
    // Brighter, more visible gradient (less shadow-like)
    const gradient = ctx.createLinearGradient(tornadoX, 0, tornadoX, height);
    gradient.addColorStop(0, '#9a9890');  // Light gray-tan top
    gradient.addColorStop(0.5, '#8a8880');  // Medium gray middle
    gradient.addColorStop(1, '#7a7870');    // Darker gray bottom
    
    // Draw left and right edges of tube with very subtle, slow writhing motion
    ctx.beginPath();
    
    // Left edge
    for (let y = 0; y <= height; y += 1) {
        const progress = y / height;
        
        // Smooth width calculation using cubic ease
        let width = getWidth(progress);
        
        // Smoothly narrow to half width in the last 15% for rounded tip
        if (progress > 0.85) {
            const tipProgress = (progress - 0.85) / 0.15;
            // Use quadratic easing for smoother transition
            const eased = tipProgress * tipProgress;
            width = width * (1 - eased * 0.5);
        }
        
        // Add VERY SUBTLE, SLOW writhing/bending
        const bend1 = Math.sin(tornadoRotation * 0.5 + progress * Math.PI * 0.8) * 4;
        const bend2 = Math.sin(tornadoRotation * 0.3 + progress * Math.PI * 1.2) * 2;
        const totalBend = bend1 + bend2;
        
        const x = tornadoX - width + totalBend;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    
    // Round the bottom tip with an arc (at half the normal bottom width)
    const bottomProgress = 1.0;
    const arcWidth = getWidth(bottomProgress) * 0.5;
    const bottomBend1 = Math.sin(tornadoRotation * 0.5 + bottomProgress * Math.PI * 0.8) * 4;
    const bottomBend2 = Math.sin(tornadoRotation * 0.3 + bottomProgress * Math.PI * 1.2) * 2;
    const bottomTotalBend = bottomBend1 + bottomBend2;
    const bottomCenterX = tornadoX + bottomTotalBend;
    
    // Draw arc from left to right at bottom (clockwise for convex curve)
    ctx.arc(bottomCenterX, height, arcWidth, Math.PI, 0, true);
    
    // Right edge (going back up)
    for (let y = height; y >= 0; y -= 1) {
        const progress = y / height;
        
        // Smooth width calculation using cubic ease
        let width = getWidth(progress);
        
        // Smoothly narrow to half width in the last 15% for rounded tip
        if (progress > 0.85) {
            const tipProgress = (progress - 0.85) / 0.15;
            // Use quadratic easing for smoother transition
            const eased = tipProgress * tipProgress;
            width = width * (1 - eased * 0.5);
        }
        
        // Same subtle writhing pattern
        const bend1 = Math.sin(tornadoRotation * 0.5 + progress * Math.PI * 0.8) * 4;
        const bend2 = Math.sin(tornadoRotation * 0.3 + progress * Math.PI * 1.2) * 2;
        const totalBend = bend1 + bend2;
        
        const x = tornadoX + width + totalBend;
        ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Now draw horizontal spiral bands that wrap around the writhing tube
    const bandOpacity = tornadoState === 'dissipating' ? 0.35 * (1 - tornadoFadeProgress * 0.5) : 0.35;
    ctx.globalAlpha = bandOpacity;
    const numBands = 20;
    
    for (let band = 0; band < numBands; band++) {
        const bandProgress = band / numBands;
        const bandY = bandProgress * height;
        const progress = bandY / height;
        
        // Get width at this height using smooth function
        const width = getWidth(progress);
        
        // Calculate center position with subtle bending
        const bend1 = Math.sin(tornadoRotation * 0.5 + progress * Math.PI * 0.8) * 4;
        const bend2 = Math.sin(tornadoRotation * 0.3 + progress * Math.PI * 1.2) * 2;
        const totalBend = bend1 + bend2;
        const centerX = tornadoX + totalBend;
        
        // Horizontal bands with slight wave for 3D effect
        const rotation = tornadoRotation + progress * Math.PI * 6;
        const wave = Math.sin(rotation) * width * 0.3;
        
        ctx.beginPath();
        // Draw ellipse to represent horizontal band wrapping around cylinder
        for (let angle = 0; angle <= Math.PI * 2; angle += 0.1) {
            const x = centerX + Math.cos(angle) * width;
            const y = bandY + Math.sin(angle) * (width * 0.15) + wave * Math.cos(angle);
            
            if (angle === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        
        // Alternate shading for visible bands
        const brightness = (Math.sin(rotation) + 1) / 2;
        ctx.strokeStyle = `rgba(60, 60, 58, ${brightness * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    // Add cylindrical shading - darker on left/right edges (following the bend)
    const shadingOpacity = tornadoState === 'dissipating' ? 0.25 * (1 - tornadoFadeProgress * 0.5) : 0.25;
    ctx.globalAlpha = shadingOpacity;
    for (let y = 0; y < height; y += 2) {
        const progress = y / height;
        
        // Use smooth width function
        const width = getWidth(progress);
        
        // Calculate bend at this height
        const bend1 = Math.sin(tornadoRotation * 0.5 + progress * Math.PI * 0.8) * 4;
        const bend2 = Math.sin(tornadoRotation * 0.3 + progress * Math.PI * 1.2) * 2;
        const totalBend = bend1 + bend2;
        const centerX = tornadoX + totalBend;
        
        // Left shadow
        const leftGrad = ctx.createLinearGradient(centerX - width, y, centerX - width * 0.3, y);
        leftGrad.addColorStop(0, '#000000');
        leftGrad.addColorStop(1, 'transparent');
        ctx.strokeStyle = leftGrad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - width, y);
        ctx.lineTo(centerX - width * 0.3, y);
        ctx.stroke();
        
        // Right shadow
        const rightGrad = ctx.createLinearGradient(centerX + width * 0.3, y, centerX + width, y);
        rightGrad.addColorStop(0, 'transparent');
        rightGrad.addColorStop(1, '#000000');
        ctx.strokeStyle = rightGrad;
        ctx.beginPath();
        ctx.moveTo(centerX + width * 0.3, y);
        ctx.lineTo(centerX + width, y);
        ctx.stroke();
    }
    
    // Draw swirling debris particles (following the bend)
    const particleOpacity = tornadoState === 'dissipating' ? 0.6 * (1 - tornadoFadeProgress) : 0.6;
    ctx.globalAlpha = particleOpacity;
    tornadoParticles.forEach(p => {
        const progress = p.y / height;
        
        // Use smooth width function for max radius
        const maxRadius = getWidth(progress);
        
        // Calculate bend at particle height
        const bend1 = Math.sin(tornadoRotation * 0.5 + progress * Math.PI * 0.8) * 4;
        const bend2 = Math.sin(tornadoRotation * 0.3 + progress * Math.PI * 1.2) * 2;
        const totalBend = bend1 + bend2;
        const centerX = tornadoX + totalBend;
        
        const spiralRadius = (p.radius / 50) * maxRadius * 0.8;
        const x = centerX + Math.cos(p.angle + tornadoRotation * 3) * spiralRadius;
        const y = p.y;
        
        ctx.fillStyle = p.radius > 30 ? '#5a5a58' : '#8a8a80';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, 2), 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Draw carried blob if lifting, carrying, or dropping
    if (tornadoPickedBlob && tornadoState !== 'descending') {
        const minX = Math.min(...tornadoPickedBlob.positions.map(p => p[0]));
        const maxX = Math.max(...tornadoPickedBlob.positions.map(p => p[0]));
        const minY = Math.min(...tornadoPickedBlob.positions.map(p => p[1]));
        const maxY = Math.max(...tornadoPickedBlob.positions.map(p => p[1]));
        const blobCenterX = (minX + maxX) / 2;
        const blobCenterY = (minY + maxY) / 2;
        
        // Calculate blob position based on state
        let blobDrawX, blobDrawY, blobAlpha;
        
        if (tornadoState === 'lifting') {
            // Blob climbs up tornado while orbiting
            const orbitX = Math.cos(tornadoOrbitAngle) * tornadoOrbitRadius;
            const orbitZ = Math.sin(tornadoOrbitAngle) * tornadoOrbitRadius; // Z depth
            
            blobDrawX = tornadoX + orbitX;
            blobDrawY = tornadoLiftHeight; // Climbs from pickup point to top
            
            // Fade blob when behind tornado (negative Z)
            blobAlpha = orbitZ < 0 ? 0.3 : 1.0;
        } else if (tornadoState === 'carrying') {
            // Blob flung free, orbit fading out
            const orbitX = Math.cos(tornadoOrbitAngle) * tornadoOrbitRadius;
            const orbitZ = Math.sin(tornadoOrbitAngle) * tornadoOrbitRadius;
            
            blobDrawX = tornadoX + orbitX;
            blobDrawY = tornadoLiftHeight; // Stay at top height
            
            blobAlpha = orbitZ < 0 ? 0.3 : 1.0;
        } else {
            // Dropping - falls straight down from lift height
            blobDrawX = tornadoX;
            blobDrawY = tornadoDropStartY;
            blobAlpha = 1.0;
        }
        
        ctx.save();
        
        // Apply 3D rotation effect around vertical axis using canvas scaling
        // This simulates the blob spinning in 3D space
        const scaleX = Math.cos(tornadoVerticalRotation); // Horizontal compression when rotating
        const adjustedAlpha = blobAlpha * (0.6 + Math.abs(scaleX) * 0.4); // Fade slightly when edge-on
        
        ctx.globalAlpha = adjustedAlpha;
        
        // Translate to blob center
        const centerPixelX = blobDrawX;
        const centerPixelY = blobDrawY;
        
        ctx.translate(centerPixelX, centerPixelY);
        
        // Apply 3D rotation by scaling X axis (simulates rotation around Y axis)
        ctx.scale(scaleX, 1);
        
        // Apply flat rotation
        ctx.rotate(tornadoBlobRotation);
        
        // Translate back
        ctx.translate(-centerPixelX, -centerPixelY);
        
        const positions = tornadoPickedBlob.positions.map(([bx, by]) => {
            const relX = (bx - blobCenterX);
            const relY = (by - blobCenterY);
            
            const screenX = Math.floor((blobDrawX / BLOCK_SIZE) + relX);
            const screenY = Math.floor((blobDrawY / BLOCK_SIZE) + relY);
            return [screenX, screenY];
        });
        
        drawSolidShape(ctx, positions, tornadoPickedBlob.color, BLOCK_SIZE, false, 0.9);
        
        ctx.restore();
    }
    
    ctx.restore();
}

function updateEarthquake() {
    if (!earthquakeActive) return;
    
    if (earthquakePhase === 'shake') {
        earthquakeShakeProgress++;
        
        // Shake horizontally for 120 frames (2 seconds at 60fps) before crack appears
        if (earthquakeShakeProgress >= 120) {
            earthquakePhase = 'crack';
            earthquakeShakeProgress = 0;
            
            // Generate the crack path from bottom to top
            generateEarthquakeCrack();
            
            // Play prolonged cracking sound as crack begins to form
            playEarthquakeCrack(soundToggle);
        }
    } else if (earthquakePhase === 'crack') {
        earthquakeCrackProgress += 0.05; // Very slow crack growth - 20 frames per segment
        
        // Crack animation completes when we've drawn the full crack
        if (earthquakeCrackProgress >= earthquakeCrack.length) {
            earthquakePhase = 'shift';
            earthquakeShiftProgress = 0;
            
            // Determine which blocks are on left vs right of crack
            splitBlocksByCrack();
        }
    } else if (earthquakePhase === 'shift') {
        earthquakeShiftProgress++;
        
        // Shift for 60 frames (doubled from 30)
        if (earthquakeShiftProgress >= 60) {
            console.log('🌍 Earthquake shift complete, applying changes to board');
            earthquakePhase = 'done';
            
            // Apply the shift to the board
            applyEarthquakeShift();
            
            console.log('🌍 Earthquake complete, applying gravity');
            // Check for line clears and apply gravity
            applyGravity();
            
            earthquakeActive = false;
            console.log('🌍 Earthquake finished, earthquakeActive = false');
        }
    }
}

function generateEarthquakeCrack() {
    // Find the bottom and top of the stack
    let bottomY = ROWS - 1;
    let topY = 0;
    
    for (let y = ROWS - 1; y >= 0; y--) {
        let hasBlock = board[y].some(cell => cell !== null);
        if (hasBlock) {
            bottomY = y;
            break;
        }
    }
    
    for (let y = 0; y < ROWS; y++) {
        let hasBlock = board[y].some(cell => cell !== null);
        if (hasBlock) {
            topY = y;
            break;
        }
    }
    
    // Find the left and right boundaries for each row
    const rowBounds = [];
    for (let y = topY; y <= bottomY; y++) {
        let leftmost = COLS;
        let rightmost = -1;
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] !== null) {
                leftmost = Math.min(leftmost, x);
                rightmost = Math.max(rightmost, x);
            }
        }
        rowBounds[y] = { left: leftmost, right: rightmost, hasBlocks: rightmost >= 0 };
    }
    
    // Start crack at middle column, at the bottom
    let currentX = Math.floor(COLS / 2);
    let currentY = bottomY;
    
    // Clamp starting position to be within the bottom row's blocks
    if (rowBounds[currentY].hasBlocks) {
        const { left, right } = rowBounds[currentY];
        const mid = Math.floor((left + right) / 2);
        // Position the crack to split the row roughly in half
        currentX = Math.max(left + 1, Math.min(right, mid));
    }
    
    earthquakeCrack = [];
    
    // Track the current direction tendency (-1 for left, 0 for straight, 1 for right)
    let currentDirection = 0;
    let rowsSinceLastChange = 0;
    
    // Move up from bottom to top, creating a jagged path
    while (currentY >= topY) {
        // Only add point if this row has blocks
        if (rowBounds[currentY].hasBlocks) {
            // Clamp currentX to be within this row's block boundaries
            const { left, right } = rowBounds[currentY];
            // Keep crack between blocks (at least 1 block on each side when possible)
            const minX = Math.max(1, left + 1);
            const maxX = Math.min(COLS - 1, right);
            currentX = Math.max(minX, Math.min(maxX, currentX));
            
            earthquakeCrack.push({x: currentX, y: currentY, edge: 'vertical'});
        }
        
        // Move up one row
        currentY--;
        if (currentY < topY) break;
        
        rowsSinceLastChange++;
        
        // Decision logic for crack movement
        if (currentDirection === 0) {
            // Currently going straight - 30% chance to start jogging
            if (Math.random() < 0.3) {
                currentDirection = Math.random() < 0.5 ? -1 : 1;
                rowsSinceLastChange = 0;
            }
        } else {
            // Currently jogging in a direction
            if (rowsSinceLastChange < 2) {
                // Keep going in same direction for at least 2 rows
            } else if (rowsSinceLastChange >= 4) {
                // After 4+ rows, likely to straighten out or change
                const rand = Math.random();
                if (rand < 0.4) {
                    currentDirection = 0; // Go straight
                    rowsSinceLastChange = 0;
                } else if (rand < 0.5) {
                    currentDirection *= -1; // Reverse direction
                    rowsSinceLastChange = 0;
                }
            } else {
                // 2-3 rows in: small chance to change
                if (Math.random() < 0.15) {
                    currentDirection = 0; // Go straight
                    rowsSinceLastChange = 0;
                }
            }
        }
        
        // Apply the direction (if not going straight)
        if (currentDirection !== 0 && rowBounds[currentY] && rowBounds[currentY].hasBlocks) {
            const newX = currentX + currentDirection;
            const { left, right } = rowBounds[currentY];
            const minX = Math.max(1, left + 1);
            const maxX = Math.min(COLS - 1, right);
            
            // Check if new position is within bounds
            if (newX >= minX && newX <= maxX) {
                currentX = newX;
            } else {
                // Hit boundary - reverse direction
                if (newX < minX) {
                    currentDirection = 1; // Force right
                } else {
                    currentDirection = -1; // Force left
                }
                rowsSinceLastChange = 0;
            }
        }
    }
    
    // Add final top point
    earthquakeCrack.push({x: currentX, y: topY, edge: 'vertical'});
    
    // Build crack position map for fast lookup during blob detection
    earthquakeCrackMap.clear();
    earthquakeCrack.forEach(pt => {
        earthquakeCrackMap.set(pt.y, pt.x);
    });
    
    console.log('🌍 Earthquake crack generated:', earthquakeCrack.length, 'points from y', bottomY, 'to', topY);
}

function splitBlocksByCrack() {
    earthquakeLeftBlocks = [];
    earthquakeRightBlocks = [];
    
    // Randomly decide shift type: 1/3 both sides, 1/3 left only, 1/3 right only
    const rand = Math.random();
    if (rand < 0.333) {
        earthquakeShiftType = 'both';
    } else if (rand < 0.666) {
        earthquakeShiftType = 'left';
    } else {
        earthquakeShiftType = 'right';
    }
    console.log('🌍 Earthquake shift type:', earthquakeShiftType);
    
    // Build a map of which column the crack is at for each row
    const crackPositions = new Map();
    earthquakeCrack.forEach(pt => {
        if (pt.edge === 'vertical') {
            // For vertical edges, the crack separates columns at x-1 (left) and x (right)
            if (!crackPositions.has(pt.y)) {
                crackPositions.set(pt.y, pt.x);
            }
        }
    });
    
    // For each row with blocks, split by crack position
    for (let y = 0; y < ROWS; y++) {
        // Find crack X position at this Y (default to middle if not found)
        const crackX = crackPositions.get(y) || Math.floor(COLS / 2);
        
        // Left side: columns 0 to crackX-1
        for (let x = 0; x < crackX; x++) {
            if (board[y][x] !== null) {
                earthquakeLeftBlocks.push({x, y, color: board[y][x]});
            }
        }
        
        // Right side: columns crackX to COLS-1
        for (let x = crackX; x < COLS; x++) {
            if (board[y][x] !== null) {
                earthquakeRightBlocks.push({x, y, color: board[y][x]});
            }
        }
    }
    
    console.log('🌍 Split blocks: Left:', earthquakeLeftBlocks.length, 'Right:', earthquakeRightBlocks.length);
}

function applyEarthquakeShift() {
    console.log('🌍 Applying earthquake shift... Type:', earthquakeShiftType);
    
    // Save the isRandomBlock state for blocks that will be moved
    const blockStates = new Map();
    earthquakeLeftBlocks.forEach(block => {
        const key = `${block.x},${block.y}`;
        blockStates.set(key, {
            isRandom: (isRandomBlock[block.y] && isRandomBlock[block.y][block.x]) || false
        });
    });
    earthquakeRightBlocks.forEach(block => {
        const key = `${block.x},${block.y}`;
        blockStates.set(key, {
            isRandom: (isRandomBlock[block.y] && isRandomBlock[block.y][block.x]) || false
        });
    });
    
    // Clear the board and isRandomBlock
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            board[y][x] = null;
            if (isRandomBlock[y]) {
                isRandomBlock[y][x] = false;
            }
        }
    }
    
    // Place left blocks - shift left only if shiftType is 'both' or 'left'
    earthquakeLeftBlocks.forEach(block => {
        const shiftLeft = (earthquakeShiftType === 'both' || earthquakeShiftType === 'left');
        const newX = shiftLeft ? block.x - 1 : block.x;
        if (newX >= 0) {
            board[block.y][newX] = block.color;
            const key = `${block.x},${block.y}`;
            const state = blockStates.get(key);
            if (state && state.isRandom) {
                isRandomBlock[block.y][newX] = true;
            }
        }
        // If newX < 0, block falls off the edge
    });
    
    // Place right blocks - shift right only if shiftType is 'both' or 'right'
    earthquakeRightBlocks.forEach(block => {
        const shiftRight = (earthquakeShiftType === 'both' || earthquakeShiftType === 'right');
        const newX = shiftRight ? block.x + 1 : block.x;
        if (newX < COLS) {
            board[block.y][newX] = block.color;
            const key = `${block.x},${block.y}`;
            const state = blockStates.get(key);
            if (state && state.isRandom) {
                isRandomBlock[block.y][newX] = true;
            }
        }
        // If newX >= COLS, block falls off the edge
    });
    
    console.log('🌍 Earthquake shift applied!');
}


function drawEarthquake() {
    if (!earthquakeActive) return;
    
    ctx.save();
    
    if (earthquakePhase === 'shake') {
        // During shake phase, just shake the screen - normal rendering happens in main loop
        // No special drawing needed here
    } else if (earthquakePhase === 'crack' || earthquakePhase === 'shift') {
        // Clear canvas and draw background (same as drawBoard)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(30, 60, 120, 0.25)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw storm particles behind gameplay
        drawStormParticles();
        
        if (earthquakePhase === 'crack') {
        // During crack phase, render as SEGMENTED BLOBS
        // The crack acts as a barrier, so blobs are split even if same color
        const blobs = getAllBlobsFromBoard(board);
        
        // Draw all blobs with their proper shapes (normal opacity)
        blobs.forEach(blob => {
            drawSolidShape(ctx, blob.positions, blob.color, BLOCK_SIZE, false, getFaceOpacity(), false);
        });
        
        // Draw dark edges along the crack boundaries
        // Only show edges where blobs are actually being separated
        const visibleSegments = Math.floor(earthquakeCrackProgress);
        
        if (visibleSegments > 0) {
            ctx.save();
            
            // Draw base dark crack
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            
            // Draw a single continuous crack line along the fault path
            // Draw one line AT the boundary, not on both sides
            
            for (let i = 0; i < visibleSegments && i < earthquakeCrack.length; i++) {
                const pt = earthquakeCrack[i];
                const y = pt.y;
                const crackX = pt.x;
                
                const leftX = crackX - 1;
                const rightX = crackX;
                
                // Check if there are blocks on either side
                const leftExists = leftX >= 0 && board[y] && board[y][leftX] !== null;
                const rightExists = rightX < COLS && board[y] && board[y][rightX] !== null;
                
                // Draw single vertical line at the crack boundary (between the two columns)
                if (leftExists || rightExists) {
                    // Draw base dark line exactly at the boundary between columns
                    const boundaryX = crackX * BLOCK_SIZE;
                    ctx.fillRect(boundaryX - 2.5, y * BLOCK_SIZE, 5, BLOCK_SIZE);
                }
                
                // Handle horizontal segments when the crack jogs
                if (i > 0) {
                    const prevPt = earthquakeCrack[i - 1];
                    if (prevPt.x !== pt.x) {
                        // The crack jogged horizontally
                        const prevY = prevPt.y;
                        const currY = pt.y;
                        const startX = prevPt.x;
                        const endX = pt.x;
                        
                        // Determine the span of the horizontal segment
                        // It should connect the two vertical segments
                        const minX = Math.min(startX, endX);
                        const maxX = Math.max(startX, endX);
                        
                        // Draw horizontal line at the boundary between rows
                        const boundaryY = currY * BLOCK_SIZE + BLOCK_SIZE; // Bottom edge of upper row
                        
                        // Only draw in the blocks BETWEEN the two vertical crack lines
                        // Start from minX, end before maxX (don't include the endpoint columns)
                        for (let jx = minX; jx < maxX; jx++) {
                            const blockAbove = board[currY] && board[currY][jx] !== null;
                            const blockBelow = board[prevY] && board[prevY][jx] !== null;
                            
                            if (blockAbove || blockBelow) {
                                const blockX = jx * BLOCK_SIZE;
                                ctx.fillRect(blockX, boundaryY - 2.5, BLOCK_SIZE, 5);
                            }
                        }
                    }
                }
            }
            
            // Now add random red lava/magma streaks inside the crack!
            ctx.globalCompositeOperation = 'lighten'; // Makes reds glow over black
            
            for (let i = 0; i < visibleSegments && i < earthquakeCrack.length; i++) {
                const pt = earthquakeCrack[i];
                const y = pt.y;
                const crackX = pt.x;
                const boundaryX = crackX * BLOCK_SIZE;
                
                // Only draw red lava where blocks actually exist
                const leftX = crackX - 1;
                const rightX = crackX;
                const leftExists = leftX >= 0 && board[y] && board[y][leftX] !== null;
                const rightExists = rightX < COLS && board[y] && board[y][rightX] !== null;
                
                // Random chance of lava streak in this segment (70% chance - MORE RED!)
                // But ONLY if there are blocks on at least one side
                if ((leftExists || rightExists) && Math.random() < 0.7) {
                    // Varying red colors for lava effect - brighter and more intense
                    const redIntensity = 200 + Math.floor(Math.random() * 55); // 200-255 (brighter!)
                    const orangeShift = Math.floor(Math.random() * 120); // 0-120 for orange tint
                    const alpha = 0.6 + Math.random() * 0.4; // 0.6-1.0 transparency (more opaque)
                    
                    ctx.fillStyle = `rgba(${redIntensity}, ${orangeShift}, 0, ${alpha})`;
                    
                    // Random height for this streak (partial or full block height)
                    const streakHeight = BLOCK_SIZE * (0.3 + Math.random() * 0.7);
                    const streakY = y * BLOCK_SIZE + Math.random() * (BLOCK_SIZE - streakHeight);
                    
                    // Draw red streak - now THICKER (3px instead of 1.5px)
                    ctx.fillRect(boundaryX - 1.5, streakY, 3, streakHeight);
                    
                    // Sometimes add a glow effect (30% of streaks - increased from 20%)
                    if (Math.random() < 0.3) {
                        ctx.shadowBlur = 6;
                        ctx.shadowColor = '#FF4500';
                        ctx.fillRect(boundaryX - 1.5, streakY, 3, streakHeight);
                        ctx.shadowBlur = 0;
                    }
                }
            }
            
            ctx.globalCompositeOperation = 'source-over'; // Reset to normal blending
            ctx.restore();
        }
    } else if (earthquakePhase === 'shift') {
        // During shift, physically separate the blobs with SMOOTH interpolation
        const shiftProgress = earthquakeShiftProgress / 60; // 0 to 1 (doubled duration)
        
        // Calculate shift amounts based on shift type
        const leftShiftAmount = (earthquakeShiftType === 'both' || earthquakeShiftType === 'left') ? -shiftProgress * BLOCK_SIZE : 0;
        const rightShiftAmount = (earthquakeShiftType === 'both' || earthquakeShiftType === 'right') ? shiftProgress * BLOCK_SIZE : 0;
        
        // Draw left blobs - shift them smoothly to the left (if applicable)
        ctx.save();
        ctx.translate(leftShiftAmount, 0);
        const leftBlobs = [];
        const visited = new Set();
        
        // Build blobs only from left side blocks
        earthquakeLeftBlocks.forEach(block => {
            const key = `${block.x},${block.y}`;
            if (!visited.has(key)) {
                const blob = [];
                const stack = [block];
                const leftSet = new Set(earthquakeLeftBlocks.map(b => `${b.x},${b.y}`));
                
                while (stack.length > 0) {
                    const curr = stack.pop();
                    const currKey = `${curr.x},${curr.y}`;
                    if (visited.has(currKey)) continue;
                    if (!leftSet.has(currKey)) continue;
                    if (board[curr.y][curr.x] !== block.color) continue;
                    
                    visited.add(currKey);
                    blob.push([curr.x, curr.y]);
                    
                    // Add neighbors
                    stack.push({x: curr.x + 1, y: curr.y, color: block.color});
                    stack.push({x: curr.x - 1, y: curr.y, color: block.color});
                    stack.push({x: curr.x, y: curr.y + 1, color: block.color});
                    stack.push({x: curr.x, y: curr.y - 1, color: block.color});
                }
                
                if (blob.length > 0) {
                    leftBlobs.push({positions: blob, color: block.color});
                }
            }
        });
        
        leftBlobs.forEach(blob => {
            drawSolidShape(ctx, blob.positions, blob.color, BLOCK_SIZE, false, getFaceOpacity(), false);
        });
        ctx.restore();
        
        // Draw right blobs - shift them smoothly to the right (if applicable)
        ctx.save();
        ctx.translate(rightShiftAmount, 0);
        const rightBlobs = [];
        visited.clear();
        
        // Build blobs only from right side blocks
        earthquakeRightBlocks.forEach(block => {
            const key = `${block.x},${block.y}`;
            if (!visited.has(key)) {
                const blob = [];
                const stack = [block];
                const rightSet = new Set(earthquakeRightBlocks.map(b => `${b.x},${b.y}`));
                
                while (stack.length > 0) {
                    const curr = stack.pop();
                    const currKey = `${curr.x},${curr.y}`;
                    if (visited.has(currKey)) continue;
                    if (!rightSet.has(currKey)) continue;
                    if (board[curr.y][curr.x] !== block.color) continue;
                    
                    visited.add(currKey);
                    blob.push([curr.x, curr.y]);
                    
                    // Add neighbors
                    stack.push({x: curr.x + 1, y: curr.y, color: block.color});
                    stack.push({x: curr.x - 1, y: curr.y, color: block.color});
                    stack.push({x: curr.x, y: curr.y + 1, color: block.color});
                    stack.push({x: curr.x, y: curr.y - 1, color: block.color});
                }
                
                if (blob.length > 0) {
                    rightBlobs.push({positions: blob, color: block.color});
                }
            }
        });
        
        rightBlobs.forEach(blob => {
            drawSolidShape(ctx, blob.positions, blob.color, BLOCK_SIZE, false, getFaceOpacity(), false);
        });
        ctx.restore();
        }
    }
    
    ctx.restore();
}

// Helper to check if crack separates two horizontally adjacent cells
function isCrackBetween(x1, y1, x2, y2) {
    // Only check horizontal adjacency (crack is vertical)
    if (y1 !== y2) return false;
    if (Math.abs(x2 - x1) !== 1) return false;
    
    // During earthquake CRACK phase, check if crack separates these cells
    if (earthquakeActive && earthquakePhase === 'crack' && earthquakeCrack.length > 0) {
        const y = y1;
        
        // Check if this row is within the visible crack progress
        // The crack grows from bottom to top, so we need to find if this Y 
        // is covered by the visible portion
        const visibleCrackLength = Math.floor(earthquakeCrackProgress);
        
        // Check if any visible crack point is at this Y level
        let crackX = null;
        for (let i = 0; i < visibleCrackLength && i < earthquakeCrack.length; i++) {
            const pt = earthquakeCrack[i];
            if (pt.y === y) {
                crackX = pt.x;
                break;
            }
        }
        
        if (crackX !== null) {
            // The crack at position X separates column X-1 (left) from column X (right)
            // Check if x1 and x2 are on opposite sides of the crack
            const leftX = Math.min(x1, x2);
            const rightX = Math.max(x1, x2);
            
            // If leftX is < crackX and rightX is >= crackX, they're separated
            if (leftX < crackX && rightX >= crackX) {
                return true;
            }
        }
    }
    
    return false;
}

// Helper to get blobs from a specific board state
function getAllBlobsFromBoard(boardState, compoundMarkers = null) {
    const visited = Array(ROWS).fill(null).map(() => Array(COLS).fill(false));
    const blobs = [];
    
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (boardState[y][x] !== null && !visited[y][x]) {
                const color = boardState[y][x];
                const blob = [];
                
                // Get compound marker for this starting position (if any)
                const startMarker = compoundMarkers ? compoundMarkers.get(`${x},${y}`) : null;
                
                // Flood fill to find connected blocks of same color
                // BUT respect the crack as a barrier AND compound blob boundaries
                const stack = [[x, y]];
                while (stack.length > 0) {
                    const [cx, cy] = stack.pop();
                    
                    if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) continue;
                    if (visited[cy][cx] || boardState[cy][cx] !== color) continue;
                    
                    // If compound markers exist, enforce marker boundaries
                    if (compoundMarkers) {
                        const cellMarker = compoundMarkers.get(`${cx},${cy}`);
                        // Blocks can only merge if they have the SAME marker state:
                        // - Both have the same non-null marker, OR
                        // - Both have no marker (null/undefined)
                        if (startMarker !== cellMarker) continue;
                    }
                    
                    visited[cy][cx] = true;
                    blob.push([cx, cy]);
                    
                    // Check 4 adjacent cells, but don't cross the crack
                    const neighbors = [
                        [cx + 1, cy],
                        [cx - 1, cy],
                        [cx, cy + 1],
                        [cx, cy - 1]
                    ];
                    
                    for (const [nx, ny] of neighbors) {
                        // Don't add neighbor if crack separates it from current cell
                        if (!isCrackBetween(cx, cy, nx, ny)) {
                            stack.push([nx, ny]);
                        }
                    }
                }
                
                if (blob.length > 0) {
                    blobs.push({ color, positions: blob });
                }
            }
        }
    }
    
    return blobs;
}

function areInterlocked(blob1, blob2) {
    // Check if blob1 wraps around blob2 (or vice versa) in any shared column
    // True interlocking means one blob has blocks both above and below the other
    // in the same column, creating a physical dependency
    
    console.log(`      🔍 Checking interlocking: ${blob1.color} (${blob1.positions.length} blocks) vs ${blob2.color} (${blob2.positions.length} blocks)`);
    
    // Get column spans for each blob
    const cols1 = new Set(blob1.positions.map(p => p[0]));
    const cols2 = new Set(blob2.positions.map(p => p[0]));
    
    // Find columns where both blobs exist
    const sharedCols = [...cols1].filter(c => cols2.has(c));
    
    if (sharedCols.length === 0) {
        console.log(`      ❌ No shared columns - cannot be interlocked`);
        return false; // No overlap in columns
    }
    
    console.log(`      ✓ Shared columns: [${sharedCols.join(', ')}]`);
    
    for (const col of sharedCols) {
        // Get Y positions for each blob in this column
        const ys1 = blob1.positions.filter(p => p[0] === col).map(p => p[1]).sort((a, b) => a - b);
        const ys2 = blob2.positions.filter(p => p[0] === col).map(p => p[1]).sort((a, b) => a - b);
        
        if (ys1.length > 0 && ys2.length > 0) {
            const min1 = ys1[0];
            const max1 = ys1[ys1.length - 1];
            const min2 = ys2[0];
            const max2 = ys2[ys2.length - 1];
            
            console.log(`      📊 Column ${col}: blob1 Y-range [${min1}-${max1}], blob2 Y-range [${min2}-${max2}]`);
            
            // Check if blob1 wraps around blob2 in this column
            // (blob1 has blocks both above and below blob2)
            if (min1 < min2 && max1 > max2) {
                console.log(`    🔗 Interlocked: ${blob1.color} wraps around ${blob2.color} in column ${col}`);
                return true;
            }
            
            // Check if blob2 wraps around blob1 in this column
            if (min2 < min1 && max2 > max1) {
                console.log(`    🔗 Interlocked: ${blob2.color} wraps around ${blob1.color} in column ${col}`);
                return true;
            }
        }
    }
    
    console.log(`      ❌ Shared columns but no wrapping pattern - not interlocked`);
    return false;
}

function mergeInterlockedBlobs(blobs) {
    // Merge blobs that are interlocked into combined units
    const merged = [];
    const used = new Set();
    
    for (let i = 0; i < blobs.length; i++) {
        if (used.has(i)) continue;
        
        let combinedBlob = {
            colors: [blobs[i].color],
            positions: [...blobs[i].positions],
            isCompound: false
        };
        
        // Check if this blob is interlocked with any other blob
        for (let j = i + 1; j < blobs.length; j++) {
            if (used.has(j)) continue;
            
            if (areInterlocked(
                { color: combinedBlob.colors[0], positions: combinedBlob.positions },
                blobs[j]
            )) {
                // Merge blob j into our combined blob
                combinedBlob.positions.push(...blobs[j].positions);
                combinedBlob.colors.push(blobs[j].color);
                combinedBlob.isCompound = true;
                used.add(j);
                console.log(`  🔀 Merging interlocked blobs: ${combinedBlob.colors.join(' + ')}`);
            }
        }
        
        // Use the first color as the primary color (for display purposes)
        combinedBlob.color = combinedBlob.colors[0];
        merged.push(combinedBlob);
        used.add(i);
    }
    
    return merged;
}


function createStormParticle() {
    const particle = {
        x: Math.random() * canvas.width,
        y: -10, // Start above canvas
        vx: 0,
        vy: 0,
        size: 2,
        opacity: 0.7,
        type: 'rain', // 'rain', 'hail', 'snow', 'wind'
        rotation: 0,
        rotationSpeed: 0,
        color: 'rgba(255, 255, 255, 0.7)'
    };
    
    // Check for special challenge modes first (Carrie and No Kings)
    const isCarrieMode = challengeMode === 'carrie' || activeChallenges.has('carrie') || soRandomCurrentMode === 'carrie';
    const isNoKingsMode = challengeMode === 'nokings' || activeChallenges.has('nokings') || soRandomCurrentMode === 'nokings';
    
    if (isCarrieMode || isNoKingsMode) {
        // Special liquid rain that will drip down the stack
        particle.type = 'liquid';
        particle.vx = 0;
        particle.vy = Math.random() * 6 + 8; // Medium-fast falling
        particle.size = Math.random() * 4 + 4; // Much bigger drops (4-8 instead of 2-4)
        particle.opacity = Math.random() * 0.3 + 0.5; // Slightly less opaque for performance
        
        // Determine color based on mode (or mix if both active)
        if (isCarrieMode && isNoKingsMode) {
            // Both modes - alternate between blood and brown - 90% opaque
            particle.liquidType = Math.random() < 0.5 ? 'blood' : 'brown';
            particle.color = particle.liquidType === 'blood' ? 
                'rgba(180, 0, 0, 0.9)' : 
                'rgba(101, 67, 33, 0.9)';
        } else if (isCarrieMode) {
            particle.liquidType = 'blood';
            particle.color = 'rgba(180, 0, 0, 0.9)'; // Dark red - 90% opaque
        } else {
            particle.liquidType = 'brown';
            particle.color = 'rgba(101, 67, 33, 0.9)'; // Brown - 90% opaque
        }
        
        return particle;
    }
    
    // Configure particle based on game mode
    if (!gameMode || gameMode === 'drizzle') {
        // Light rain - simple drops falling straight down
        particle.type = 'rain';
        particle.vx = 0;
        particle.vy = Math.random() * 3 + 5; // 5-8 speed (increased from 4-6)
        particle.size = Math.random() * 1 + 1; // Small drops
        particle.opacity = Math.random() * 0.3 + 0.2;
        particle.color = `rgba(180, 200, 255, ${particle.opacity})`;
    } else if (gameMode === 'downpour') {
        // Heavy rain - thicker drops, faster, with splashes
        particle.type = 'rain';
        particle.vx = 0;
        particle.vy = Math.random() * 6 + 12; // 12-18 speed (DOUBLED from 6-9)
        particle.size = Math.random() * 1.5 + 1.5; // Bigger drops
        particle.opacity = Math.random() * 0.4 + 0.3;
        particle.color = `rgba(180, 200, 255, ${particle.opacity})`;
    } else if (gameMode === 'hailstorm') {
        // Hail - solid ice chunks falling straight down VERY FAST
        particle.type = 'hail';
        particle.vx = 0; // Straight down, no horizontal drift
        particle.vy = Math.random() * 6 + 12; // 12-18 speed (VERY heavy and fast)
        particle.size = Math.random() * 3 + 3; // 3-6 size (solid chunks)
        particle.opacity = Math.random() * 0.3 + 0.5; // More opaque
        particle.rotation = Math.random() * Math.PI * 2;
        particle.rotationSpeed = (Math.random() - 0.5) * 0.3; // Even faster rotation
        particle.color = `rgba(200, 230, 255, ${particle.opacity})`;
    } else if (gameMode === 'blizzard') {
        // Intense blizzard - heavy diagonal snow/wind whipping across entire well
        particle.type = 'blizzard';
        
        // Assign random pre-rendered snowflake bitmap
        particle.snowflakeBitmap = snowflakeBitmaps[Math.floor(Math.random() * snowflakeBitmaps.length)];
        
        // Spawn from left side or top to cover entire well
        if (Math.random() < 0.7) {
            // Spawn from left side (70% of time)
            particle.x = -20;
            particle.y = Math.random() * canvas.height;
        } else {
            // Spawn from top (30% of time)
            particle.x = Math.random() * canvas.width;
            particle.y = -20;
        }
        
        particle.vx = Math.random() * 7 + 9; // Very strong horizontal wind (9-16) - EVEN FASTER
        particle.vy = Math.random() * 4 + 2; // Some vertical (2-6)
        particle.size = Math.random() * 3.5 + 1.5; // Larger flakes
        particle.opacity = Math.random() * 0.6 + 0.4;
        particle.rotation = Math.random() * Math.PI * 2;
        particle.rotationSpeed = (Math.random() - 0.5) * 0.12;
        particle.color = `rgba(240, 248, 255, ${particle.opacity})`;
    } else if (gameMode === 'hurricane') {
        // Hurricane - extreme horizontal wall of rain
        particle.type = 'hurricane';
        
        // Spawn from left side or top to cover entire well
        if (Math.random() < 0.8) {
            // Spawn from left side (80% of time)
            particle.x = -20;
            particle.y = Math.random() * canvas.height;
        } else {
            // Spawn from top-left area (20% of time)
            particle.x = Math.random() * (canvas.width * 0.3);
            particle.y = -20;
        }
        
        particle.vx = Math.random() * 16 + 28; // INSANELY fast horizontal (28-44) - DOUBLED
        particle.vy = Math.random() * 1 + 0.5; // Minimal vertical, no fluttering (0.5-1.5)
        particle.size = Math.random() * 2.5 + 1.5;
        particle.opacity = Math.random() * 0.5 + 0.4;
        particle.color = `rgba(220, 240, 255, ${particle.opacity})`;
    }
    
    return particle;
}

function createSplash(x, y, size) {
    // Create splash particles that radiate outward
    const numDroplets = Math.floor(Math.random() * 3) + 3; // 3-5 droplets
    for (let i = 0; i < numDroplets; i++) {
        const angle = Math.random() * Math.PI - Math.PI / 2; // Upward hemisphere
        const speed = Math.random() * 2 + 1;
        splashParticles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2, // Initial upward velocity
            gravity: 0.2,
            size: size * 0.5,
            opacity: 0.6,
            life: 15, // Frames to live
            maxLife: 15
        });
    }
}

function checkCollisionWithBlocks(x, y) {
    // Check if position collides with any block or bottom of well
    const gridX = Math.floor(x / BLOCK_SIZE);
    const gridY = Math.floor(y / BLOCK_SIZE);
    
    // Check bottom of well - trigger at the actual bottom
    if (y >= canvas.height) {
        return { collision: true, y: canvas.height };
    }
    
    // Check if there's a block at the next position down
    const nextGridY = Math.floor((y + BLOCK_SIZE * 0.1) / BLOCK_SIZE);
    if (nextGridY >= 0 && nextGridY < ROWS && gridX >= 0 && gridX < COLS) {
        if (board[nextGridY] && board[nextGridY][gridX]) {
            // Hit the top of this block
            return { collision: true, y: nextGridY * BLOCK_SIZE };
        }
    }
    
    return { collision: false };
}

function createHailBounce(x, y, size, vy) {
    // Create a bouncing hail particle
    return {
        x: x,
        y: y,
        vx: 0,
        vy: -Math.abs(vy) * 0.5, // Bounce up at half the impact velocity
        gravity: 0.3,
        size: size,
        opacity: 0.7,
        bounces: 0,
        maxBounces: 2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.15,
        type: 'bouncing',
        life: 60, // Frames to live
        color: `rgba(220, 240, 255, 0.8)`
    };
}

function createLiquidDrip(x, y, liquidType, color) {
    // Find the TOP surface of the stack at this X position
    const blockX = Math.floor(x / BLOCK_SIZE);
    if (blockX < 0 || blockX >= COLS) return;
    
    // Find the topmost block in this column
    let topBlockY = -1;
    for (let checkY = 0; checkY < ROWS; checkY++) {
        if (board[checkY] && board[checkY][blockX]) {
            topBlockY = checkY;
            break; // Found the top block
        }
    }
    
    // If no blocks found, don't create pool in mid-air
    if (topBlockY === -1) {
        return; // No surface to pool on
    }
    
    // Convert to pixel coordinates (top of the block)
    const poolY = topBlockY * BLOCK_SIZE;
    const poolX = blockX * BLOCK_SIZE + BLOCK_SIZE / 2;
    
    // Check for existing pool at this location
    let foundPool = false;
    for (let pool of liquidPools) {
        if (pool.blockX === blockX && pool.blockY === topBlockY) {
            // Add to existing pool at same location
            pool.volume = Math.min(pool.volume + 2, 25); // Cap volume
            pool.lastAddedFrame = frameCount;
            foundPool = true;
            break;
        }
    }
    
    if (!foundPool) {
        // Determine max pools based on active modes
        const isCarrieMode = challengeMode === 'carrie' || activeChallenges.has('carrie') || soRandomCurrentMode === 'carrie';
        const isNoKingsMode = challengeMode === 'nokings' || activeChallenges.has('nokings') || soRandomCurrentMode === 'nokings';
        const maxPools = (isCarrieMode && isNoKingsMode) ? 60 : 30; // Double max pools when both active
        
        if (liquidPools.length < maxPools) {
            // Create new pool on the top surface
            liquidPools.push({
                blockX: blockX,
                blockY: topBlockY,
                x: poolX,
                y: poolY,
                volume: 4,
                color: color,
                liquidType: liquidType,
                opacity: 0.9, // 90% opaque
                dripping: false,
                dripStreaks: [], // Multiple drip streams
                lastAddedFrame: frameCount,
                age: 0
            });
        }
    }
}

function updateLiquidPoolsAfterGravity() {
    // Called after blocks fall to update liquid pool positions
    liquidPools = liquidPools.filter(pool => {
        // Check if the block the pool was on still exists
        if (pool.blockY >= 0 && pool.blockY < ROWS) {
            // Find the new top block in this column
            let newTopBlockY = -1;
            for (let checkY = 0; checkY < ROWS; checkY++) {
                if (board[checkY] && board[checkY][pool.blockX]) {
                    newTopBlockY = checkY;
                    break;
                }
            }
            
            if (newTopBlockY === -1) {
                // No blocks in this column anymore, remove pool
                return false;
            }
            
            // Calculate how much the pool moved
            const poolShift = (newTopBlockY - pool.blockY) * BLOCK_SIZE;
            
            // Update pool position to new block top
            pool.blockY = newTopBlockY;
            pool.y = newTopBlockY * BLOCK_SIZE;
            
            // Shift drip streaks by the same amount (don't reset them)
            // This keeps drips flowing naturally when blocks fall
            if (poolShift !== 0) {
                pool.dripStreaks.forEach(streak => {
                    streak.y += poolShift;
                });
            }
            
            return true;
        } else {
            // Pool was in invalid position, remove it
            return false;
        }
    });
}

function updateDrippingLiquids() {
    liquidPools = liquidPools.filter(pool => {
        pool.age++;
        
        // Slowly evaporate old pools
        if (frameCount - pool.lastAddedFrame > 250) {
            pool.volume -= 0.015;
            pool.opacity = Math.max(0, pool.opacity - 0.0003);
        }
        
        // Start dripping when pool is large enough
        if (pool.volume > 3) {
            pool.dripping = true;
            
            // Create multiple drip streams for FULL coverage
            if (pool.dripStreaks.length === 0) {
                // Create wider, more numerous streams
                const numStreaks = Math.min(5, Math.floor(pool.volume / 4) + 2);
                for (let i = 0; i < numStreaks; i++) {
                    const spacing = BLOCK_SIZE / (numStreaks + 1);
                    pool.dripStreaks.push({
                        offsetX: -BLOCK_SIZE/2 + spacing * (i + 1),
                        y: pool.y + 5,
                        width: Math.random() * 8 + 6, // Much wider streams
                        speed: Math.random() * 0.4 + 0.5,
                        wobble: Math.random() * Math.PI
                    });
                }
            }
        }
        
        // Update drip streams
        if (pool.dripping) {
            pool.dripStreaks.forEach(streak => {
                streak.y += streak.speed;
                // Slight movement for organic look
                streak.wobble += 0.02;
                
                // Reset drip if it goes too far
                if (streak.y > canvas.height) {
                    streak.y = pool.y + 5;
                }
            });
            
            pool.volume -= 0.008;
            
            // Stop dripping if volume too low
            if (pool.volume < 1) {
                pool.dripping = false;
                pool.dripStreaks = [];
            }
        }
        
        // Remove depleted pools
        return pool.volume > 0 && pool.opacity > 0;
    });
}

function drawDrippingLiquids() {
    if (liquidPools.length === 0) return;
    
    ctx.save();
    
    liquidPools.forEach(pool => {
        // Use 90% opacity for all pool rendering
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = pool.color;
        
        // Draw pool as irregular blob shape (non-rectangular)
        const poolWidth = Math.min(BLOCK_SIZE, Math.sqrt(pool.volume) * 7);
        const poolHeight = Math.min(10, Math.sqrt(pool.volume) * 2.5);
        
        // Organic pool shape using quadratic curves
        ctx.beginPath();
        
        // Top edge - wavy
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
        
        // Bottom edge - slightly curved
        ctx.lineTo(pool.x + poolWidth/2, pool.y + poolHeight/2);
        ctx.quadraticCurveTo(
            pool.x, pool.y + poolHeight,
            pool.x - poolWidth/2, pool.y + poolHeight/2
        );
        
        ctx.closePath();
        ctx.fill();
        
        // Draw drip streams for MAXIMUM coverage
        if (pool.dripping && pool.dripStreaks.length > 0) {
            pool.dripStreaks.forEach(streak => {
                // 90% opaque for better look
                ctx.globalAlpha = 0.9;
                ctx.fillStyle = pool.color;
                
                const wobbleX = Math.sin(streak.wobble) * 2;
                
                // Calculate drop dimensions (teardrop shape) - 150% bigger
                const dropWidth = streak.width * 0.6 * 1.5;  // Width at widest point (150% bigger)
                const dropHeight = streak.width * 1.2 * 1.5; // Height (taller than wide, 150% bigger)
                
                // Stream tapers from pool width down to drop top width
                const streamStartWidth = streak.width;
                const streamEndWidth = dropWidth * 0.4; // Narrow top of drop
                const streamLength = streak.y - pool.y;
                
                // Draw tapering stream with organic wavy edges
                ctx.beginPath();
                
                // Left side - tapering down
                ctx.moveTo(pool.x + streak.offsetX - streamStartWidth/2, pool.y);
                
                const segments = Math.max(5, Math.floor(streamLength / 15));
                for (let i = 1; i <= segments; i++) {
                    const progress = i / segments;
                    const segY = pool.y + streamLength * progress;
                    const currentWidth = streamStartWidth + (streamEndWidth - streamStartWidth) * progress;
                    const wave = Math.sin(i * 0.5 + streak.wobble) * 2;
                    ctx.lineTo(pool.x + streak.offsetX - currentWidth/2 + wave + wobbleX, segY);
                }
                
                // Connect to top of drop
                ctx.lineTo(pool.x + streak.offsetX + wobbleX, streak.y);
                
                // Right side - back up with taper
                for (let i = segments; i >= 0; i--) {
                    const progress = i / segments;
                    const segY = pool.y + streamLength * progress;
                    const currentWidth = streamStartWidth + (streamEndWidth - streamStartWidth) * progress;
                    const wave = Math.sin(i * 0.5 + streak.wobble + Math.PI) * 2;
                    ctx.lineTo(pool.x + streak.offsetX + currentWidth/2 + wave + wobbleX, segY);
                }
                
                ctx.closePath();
                ctx.fill();
                
                // Draw teardrop-shaped bulb (matching mockup)
                // Pointed at top, rounded and wider at bottom
                const dropCenterX = pool.x + streak.offsetX + wobbleX;
                // Move drop up by 1/3 of its height to overlap with streak
                const dropTopY = streak.y - (dropHeight / 3);
                const dropBottomY = dropTopY + dropHeight * 0.7; // Bottom of drop
                
                ctx.beginPath();
                
                // Start at pointed top
                ctx.moveTo(dropCenterX, dropTopY);
                
                // Right curve - gets wider as it goes down
                ctx.bezierCurveTo(
                    dropCenterX + dropWidth * 0.15, dropTopY + dropHeight * 0.15,  // Narrow near top
                    dropCenterX + dropWidth * 0.5, dropTopY + dropHeight * 0.5,    // Widest point
                    dropCenterX, dropBottomY  // Bottom center (rounded)
                );
                
                // Left curve - symmetric
                ctx.bezierCurveTo(
                    dropCenterX - dropWidth * 0.5, dropTopY + dropHeight * 0.5,    // Widest point
                    dropCenterX - dropWidth * 0.15, dropTopY + dropHeight * 0.15,  // Narrow near top
                    dropCenterX, dropTopY  // Back to pointed top
                );
                
                ctx.closePath();
                ctx.fill();
            });
        }
    });
    
    ctx.restore();
}

function updateStormParticles() {
    if (!stormEffectsToggle.checked) {
        stormParticles = [];
        splashParticles = [];
        return;
    }
    
    // Add new particles if below max
    if (stormParticles.length < MAX_STORM_PARTICLES && gameRunning && !paused) {
        // Check for special liquid modes first
        const isCarrieMode = challengeMode === 'carrie' || activeChallenges.has('carrie') || soRandomCurrentMode === 'carrie';
        const isNoKingsMode = challengeMode === 'nokings' || activeChallenges.has('nokings') || soRandomCurrentMode === 'nokings';
        
        // Spawn rate varies by mode
        let spawnChance = 0.3;
        
        // Double spawn rate for liquid modes
        if (isCarrieMode || isNoKingsMode) {
            spawnChance = 1.6; // Base rate for one liquid mode
            if (isCarrieMode && isNoKingsMode) {
                spawnChance = 3.2; // TRUE DOUBLE when both modes active (1.6 × 2)
            }
        } else if (gameMode === 'downpour') spawnChance = 2.0; // DOUBLED AGAIN - 2 particles per frame
        else if (gameMode === 'hailstorm') spawnChance = 0.4;
        else if (gameMode === 'blizzard') spawnChance = 28.8; // 150% increase - spawns ~29 particles per frame!
        else if (gameMode === 'hurricane') spawnChance = 30.0; // EXTREME wall of rain - 30 particles per frame!
        
        // Handle spawn rates > 1 (spawn multiple particles per frame)
        const numToSpawn = Math.floor(spawnChance);
        const fractionalChance = spawnChance - numToSpawn;
        
        for (let i = 0; i < numToSpawn; i++) {
            stormParticles.push(createStormParticle());
        }
        
        if (Math.random() < fractionalChance) {
            stormParticles.push(createStormParticle());
        }
    }
    
    // Update existing particles
    stormParticles = stormParticles.filter(particle => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Rotation for hail and blizzard
        if (particle.type === 'hail' || particle.type === 'blizzard') {
            particle.rotation += particle.rotationSpeed;
        }
        
        // Check for collision and splash (only for rain types in downpour mode)
        if (particle.type === 'rain' && gameMode === 'downpour') {
            const collision = checkCollisionWithBlocks(particle.x, particle.y);
            if (collision.collision) {
                createSplash(particle.x, collision.y, particle.size);
                return false; // Remove particle
            }
        }
        
        // Check for collision and bounce (for hail)
        if (particle.type === 'hail') {
            const collision = checkCollisionWithBlocks(particle.x, particle.y);
            if (collision.collision) {
                // Create bouncing hail
                splashParticles.push(createHailBounce(particle.x, collision.y, particle.size, particle.vy));
                return false; // Remove falling particle
            }
        }
        
        // Check for collision and create drips (for liquid types - Carrie/No Kings)
        if (particle.type === 'liquid') {
            const collision = checkCollisionWithBlocks(particle.x, particle.y);
            if (collision.collision) {
                // Create dripping liquid that will run down the stack
                createLiquidDrip(particle.x, collision.y, particle.liquidType, particle.color);
                return false; // Remove particle
            }
        }
        
        // Remove if off screen
        return particle.y < canvas.height + 20 && particle.x > -20 && particle.x < canvas.width + 20;
    });
    
    // Update splash/bounce particles
    splashParticles = splashParticles.filter(splash => {
        splash.x += splash.vx;
        splash.y += splash.vy;
        splash.vy += splash.gravity; // Apply gravity
        
        // Handle bouncing hail
        if (splash.type === 'bouncing') {
            splash.rotation += splash.rotationSpeed;
            splash.life--;
            
            // Check for another bounce
            if (splash.vy > 0) { // Moving downward
                const collision = checkCollisionWithBlocks(splash.x, splash.y);
                if (collision.collision && splash.bounces < splash.maxBounces) {
                    splash.vy = -Math.abs(splash.vy) * 0.4; // Weaker bounce
                    splash.y = collision.y; // Position at collision point
                    splash.bounces++;
                }
            }
            
            return splash.life > 0 && splash.y < canvas.height + 20;
        } else {
            // Regular splash droplets
            splash.life--;
            splash.opacity = (splash.life / splash.maxLife) * 0.6;
            return splash.life > 0;
        }
    });
}

function drawStormParticles() {
    if (!stormEffectsToggle.checked || (stormParticles.length === 0 && splashParticles.length === 0)) return;
    
    ctx.save();
    
    // Draw main storm particles
    stormParticles.forEach(particle => {
        ctx.globalAlpha = particle.opacity;
        
        if (particle.type === 'rain') {
            // Rain drops - simple streaks falling straight down
            ctx.strokeStyle = particle.color;
            ctx.lineWidth = particle.size;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(particle.x, particle.y - particle.vy * 2); // Streak based on velocity
            ctx.stroke();
        } else if (particle.type === 'liquid') {
            // Liquid drops (blood/brown) - teardrop shaped
            ctx.fillStyle = particle.color;
            ctx.save();
            ctx.translate(particle.x, particle.y);
            
            // Draw teardrop shape
            ctx.beginPath();
            // Top point
            ctx.moveTo(0, -particle.size * 1.5);
            // Curve down to rounded bottom
            ctx.quadraticCurveTo(-particle.size * 0.7, 0, 0, particle.size);
            ctx.quadraticCurveTo(particle.size * 0.7, 0, 0, -particle.size * 1.5);
            ctx.fill();
            
            // Add a trailing streak
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
            // Solid ice chunks - irregular polygons with shine
            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation);
            
            // Draw irregular chunk shape
            ctx.fillStyle = particle.color;
            ctx.strokeStyle = `rgba(255, 255, 255, ${particle.opacity})`;
            ctx.lineWidth = 1;
            
            // Irregular polygon (5-7 sides)
            const sides = 5 + Math.floor(Math.random() * 3);
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
                const angle = (Math.PI * 2 / sides) * i;
                const radius = particle.size * (0.8 + Math.random() * 0.4); // Irregular
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Add highlight for icy shine
            ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity * 0.5})`;
            ctx.beginPath();
            ctx.arc(-particle.size * 0.2, -particle.size * 0.2, particle.size * 0.3, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        } else if (particle.type === 'blizzard') {
            // Heavy blowing snow - use pre-rendered blurred bitmap
            if (!particle.snowflakeBitmap) return; // Safety check
            
            ctx.save();
            // Use opacity with safety check
            const opacity = (typeof particle.opacity === 'number' && !isNaN(particle.opacity)) ? particle.opacity : 1;
            ctx.globalAlpha = opacity;
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation);
            
            // Draw the pre-rendered snowflake bitmap
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
            // Nearly horizontal rain streaks - pure horizontal motion
            ctx.strokeStyle = particle.color;
            ctx.lineWidth = particle.size;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            // Long horizontal streak based on velocity, minimal vertical component
            ctx.lineTo(particle.x - particle.vx * 3, particle.y - particle.vy * 0.5);
            ctx.stroke();
        }
    });
    
    // Draw splash particles
    splashParticles.forEach(splash => {
        ctx.globalAlpha = splash.opacity;
        
        if (splash.type === 'bouncing') {
            // Bouncing hail chunks
            ctx.save();
            ctx.translate(splash.x, splash.y);
            ctx.rotate(splash.rotation);
            
            ctx.fillStyle = splash.color;
            ctx.strokeStyle = `rgba(255, 255, 255, ${splash.opacity})`;
            ctx.lineWidth = 1;
            
            // Irregular polygon
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
            
            // Highlight
            ctx.fillStyle = `rgba(255, 255, 255, ${splash.opacity * 0.5})`;
            ctx.beginPath();
            ctx.arc(-splash.size * 0.2, -splash.size * 0.2, splash.size * 0.3, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        } else {
            // Regular splash droplets
            ctx.fillStyle = 'rgba(180, 220, 255, 1)';
            ctx.beginPath();
            ctx.arc(splash.x, splash.y, splash.size, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    
    ctx.restore();
}

let board = [];
let isRandomBlock = []; // Track which blocks are random hailstorm blocks
let isLatticeBlock = []; // Track which blocks are pre-filled lattice blocks (immune to gravity until absorbed)
let fadingBlocks = []; // Track blocks that are fading in with their opacity and scale
let currentPiece = null;
let nextPieceQueue = []; // Queue of next 4 pieces
const NEXT_PIECE_COUNT = 4; // Number of pieces to show in preview

// Helper function to get next piece from queue (for backwards compatibility)
function getNextPiece() {
    return nextPieceQueue.length > 0 ? nextPieceQueue[0] : null;
}

// Helper function to consume next piece and add new one to queue
function consumeNextPiece() {
    const piece = nextPieceQueue.shift();
    // Add new piece to end of queue
    nextPieceQueue.push(createPiece());
    return piece;
}

// Helper function to initialize the piece queue
function initPieceQueue() {
    nextPieceQueue = [];
    for (let i = 0; i < NEXT_PIECE_COUNT; i++) {
        nextPieceQueue.push(createPiece());
    }
}
let score = 0;
let lines = 0;
let level = 1;

// Custom key repeat system - overrides browser's default repeat behavior
const customKeyRepeat = {
    keys: new Map(),      // Track which keys are pressed
    timers: new Map(),    // Track repeat timers
    initialDelay: 200,    // 200ms before repeat starts
    repeatRate: 40        // 40ms between repeats
};

// Shadow (training wheels) is now standard - no penalty
// Shadowless challenge mode adds 4% bonus instead
function applyTrainingWheelsPenalty(points) {
    return points; // No longer applies a penalty
}

// Helper function to calculate challenge mode multiplier based on difficulty
function getChallengeModeMultiplier() {
    if (challengeMode === 'normal') {
        return 1.0; // No bonus
    } else if (challengeMode === 'combo') {
        // Variable bonus per challenge based on difficulty
        const challengeBonuses = {
            'stranger': 0.07,     // 7%
            'dyslexic': 0.06,     // 6%
            'phantom': 0.07,      // 7%
            'gremlins': 0.06,     // 6%
            'rubber': 0.05,       // 5%
            'oz': 0.05,           // 5%
            'lattice': 0.05,      // 5%
            'yesand': 0.05,       // 5%
            'sixseven': 0.04,     // 4%
            'longago': 0.04,      // 4%
            'comingsoon': 0.04,   // 4%
            'thinner': 0.04,      // 4%
            'mercurial': 0.04,    // 4%
            'shadowless': 0.04,   // 4%
            'thicker': 0.03,      // 3%
            'carrie': 0.03,       // 3%
            'nokings': 0.03,      // 3%
            'nervous': 0.02       // 2%
        };
        
        let totalBonus = 0;
        activeChallenges.forEach(challenge => {
            totalBonus += challengeBonuses[challenge] || 0.05; // Default 5% if not found
        });
        
        return 1.0 + totalBonus;
    } else {
        // Single challenge mode - use specific bonus
        const singleChallengeBonuses = {
            'stranger': 0.07,
            'dyslexic': 0.06,
            'phantom': 0.07,
            'gremlins': 0.06,
            'rubber': 0.05,
            'oz': 0.05,
            'lattice': 0.05,
            'yesand': 0.05,
            'sixseven': 0.04,
            'longago': 0.04,
            'comingsoon': 0.04,
            'thinner': 0.04,
            'mercurial': 0.04,
            'shadowless': 0.04,
            'thicker': 0.03,
            'carrie': 0.03,
            'nokings': 0.03,
            'nervous': 0.02,
            'sorandom': 0.05  // So Random gets 5% as it varies
        };
        
        return 1.0 + (singleChallengeBonuses[challengeMode] || 0.05);
    }
}

// Helper function to apply all score modifiers (Training Wheels penalty + Challenge multiplier)
function applyScoreModifiers(points) {
    // First apply Training Wheels penalty if active
    let modifiedPoints = applyTrainingWheelsPenalty(points);
    
    // Then apply challenge mode multiplier
    modifiedPoints = Math.floor(modifiedPoints * getChallengeModeMultiplier());
    
    return modifiedPoints;
}

// Special event counters for leaderboard
let strikeCount = 0;
let tsunamiCount = 0;
let blackHoleCount = 0;
let volcanoCount = 0;

// Challenge modes
let challengeMode = 'normal'; // 'normal', 'stranger', 'phantom', 'rubber', 'oz', 'thinner', 'thicker', 'nervous', 'combo'
let activeChallenges = new Set(); // For combo mode
let phantomTimeout = null; // Timer for phantom fade
let phantomOpacity = 1.0; // Current opacity of the stack in phantom mode
let phantomFadeInterval = null; // Interval for smooth fading
let bouncingPieces = []; // Track pieces currently bouncing
let nervousVibrateOffset = 0; // Current Y offset for nervous mode vibration

// Six Seven mode variables
let sixSevenCounter = 0; // Tracks lines cleared in Six Seven mode
let sixSevenNextTarget = 0; // When to spawn next giant piece (6 or 7)
let sixSevenNextSize = 0; // Size of next giant piece (6 or 7)

// Gremlins mode variables
let gremlinsCounter = 0; // Tracks lines cleared for gremlin spawning
let gremlinsNextTarget = 0; // When to trigger next gremlin event
let gremlinFadingBlocks = []; // Track blocks being removed by gremlins: [{x, y, opacity, delay}]
let gremlinsPendingRemoval = false; // Flag to prevent removal right after line clear

// So Random mode variables
let soRandomCurrentMode = 'normal'; // Current active challenge in So Random mode
let soRandomAvailableModes = ['stranger', 'dyslexic', 'phantom', 'rubber', 'oz', 'thinner', 'thicker', 'nervous', 'carrie', 'nokings', 'longago', 'comingsoon', 'sixseven', 'gremlins', 'lattice', 'yesand', 'mercurial']; // Modes that can be randomly chosen

// Mercurial mode variables
let mercurialTimer = 0; // Time since last color change
let mercurialInterval = 0; // Current interval before next change (2-4 seconds)

// gameRunning is declared in starfield section
let paused = false; StarfieldSystem.setPaused(false);
let justPaused = false; // Flag to prevent immediate unpause from tap handler

// Toggle pause state
function togglePause() {
    if (!gameRunning) return;
    
    const settingsBtn = document.getElementById('settingsBtn');
    const musicToggle = document.getElementById('musicToggle');
    const pauseBtn = document.getElementById('pauseBtn');
    
    if (paused) {
        // Unpause
        paused = false;
        StarfieldSystem.setPaused(false);
        if (settingsBtn) settingsBtn.classList.add('hidden-during-play');
        // Show pause button again (only in tablet mode)
        if (pauseBtn && TabletMode.enabled) pauseBtn.style.display = 'block';
        if (musicToggle && musicToggle.checked) {
            startMusic(gameMode, musicToggle);
        }
    } else {
        // Pause
        captureCanvasSnapshot();
        paused = true;
        justPaused = true;
        setTimeout(() => { justPaused = false; }, 300); // Prevent immediate unpause
        StarfieldSystem.setPaused(true);
        if (settingsBtn) settingsBtn.classList.remove('hidden-during-play');
        // Hide pause button while paused
        if (pauseBtn) pauseBtn.style.display = 'none';
        stopMusic();
    }
}

let faceOpacity = 0.42; // Default 42% opacity - the answer to life, the universe, and everything!
let wasPausedBeforeSettings = false;
var gameLoop = null;
let dropCounter = 0;
let dropInterval = 1000;
let animatingLines = false;
let pendingLineCheck = false; // Flag to trigger another clearLines check after current animation
let lineAnimations = [];
let lightningEffects = [];
let triggeredTsunamis = new Set(); // Track tsunamis that have already triggered

function initBoard() {
    board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
    isRandomBlock = Array(ROWS).fill().map(() => Array(COLS).fill(false));
    isLatticeBlock = Array(ROWS).fill().map(() => Array(COLS).fill(false));
    fadingBlocks = Array(ROWS).fill().map(() => Array(COLS).fill(null));
}

function getFaceOpacity() {
    return faceOpacity;
}

function randomColor() {
    return currentColorSet[Math.floor(Math.random() * currentColorSet.length)];
}

function createPiece() {
    let shapeSet;
    let type;
    
    if (gameMode === 'blizzard' || gameMode === 'hurricane') {
        // 75% tetrominoes, 25% pentominoes
        const tetrominoKeys = Object.keys(SHAPES); // Standard 4-block pieces
        const fullShapeSet = gameMode === 'blizzard' ? BLIZZARD_SHAPES : EXTENDED_SHAPES;
        const pentominoKeys = Object.keys(fullShapeSet).filter(k => !SHAPES[k]); // Only 5-block pieces
        
        if (Math.random() < 0.75) {
            // Pick a tetromino
            type = tetrominoKeys[Math.floor(Math.random() * tetrominoKeys.length)];
            shapeSet = SHAPES;
        } else {
            // Pick a pentomino
            type = pentominoKeys[Math.floor(Math.random() * pentominoKeys.length)];
            shapeSet = fullShapeSet;
        }
    } else {
        shapeSet = SHAPES; // Standard 4-block shapes only
        const shapes = Object.keys(shapeSet);
        type = shapes[Math.floor(Math.random() * shapes.length)];
    }
    
    return {
        shape: shapeSet[type],
        type: type,
        color: randomColor(),
        x: Math.floor(COLS / 2) - Math.floor(shapeSet[type][0].length / 2),
        y: -1
    };
}

// Hexomino shapes (6 blocks) - verified block counts
const HEXOMINO_SHAPES = [
    { name: 'I6', shape: [[1,1,1,1,1,1]] },                           // 6 in a row
    { name: 'Rect', shape: [[1,1,1],[1,1,1]] },                       // 2x3 rectangle
    { name: 'L6', shape: [[1,0,0],[1,0,0],[1,0,0],[1,1,1]] },         // L shape (4 tall)
    { name: 'J6', shape: [[0,0,1],[0,0,1],[0,0,1],[1,1,1]] },         // J shape (mirror L)
    { name: 'T6', shape: [[1,1,1,1],[0,1,0,0],[0,1,0,0]] },           // T with wide top
    { name: 'Plus6', shape: [[0,1,0],[1,1,1],[0,1,0],[0,1,0]] },      // Plus with stem
    { name: 'Y6', shape: [[0,1],[1,1],[0,1],[0,1],[0,1]] },           // Y shape
    { name: 'P6', shape: [[1,1],[1,1],[1,0],[1,0]] },                 // P shape tall
    { name: 'S6', shape: [[0,1,1],[0,1,0],[0,1,0],[1,1,0]] },         // S extended
    { name: 'C6', shape: [[1,1],[1,0],[1,0],[1,1]] },                 // C/U open shape
    { name: 'Z6', shape: [[1,1,0,0],[0,1,0,0],[0,1,1,1]] },           // Z extended
    { name: 'W6', shape: [[1,0,0],[1,1,0],[0,1,1],[0,0,1]] }          // W/stairs shape
];

// Heptomino shapes (7 blocks) - verified block counts
const HEPTOMINO_SHAPES = [
    { name: 'I7', shape: [[1,1,1,1,1,1,1]] },                         // 7 in a row
    { name: 'L7', shape: [[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,1,1]] }, // L shape (5 tall)
    { name: 'J7', shape: [[0,0,1],[0,0,1],[0,0,1],[0,0,1],[1,1,1]] }, // J shape (mirror L)
    { name: 'T7', shape: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0]] },     // T with wide top
    { name: 'Plus7', shape: [[0,1,0],[0,1,0],[1,1,1],[0,1,0],[0,1,0]] }, // Plus symmetric
    { name: 'Y7', shape: [[0,1],[0,1],[1,1],[0,1],[0,1],[0,1]] },     // Y shape tall
    { name: 'U7', shape: [[1,0,1],[1,0,1],[1,1,1]] },                 // U shape
    { name: 'P7', shape: [[1,1],[1,1],[1,0],[1,0],[1,0]] },           // P shape tall
    { name: 'S7', shape: [[0,0,1,1],[0,0,1,0],[0,1,1,0],[1,1,0,0]] }, // S extended
    { name: 'W7', shape: [[1,0,0],[1,1,0],[0,1,0],[0,1,1],[0,0,1]] }, // W/stairs
    { name: 'F7', shape: [[0,1,1],[0,1,0],[1,1,0],[0,1,0],[0,1,0]] }, // F shape
    { name: 'H7', shape: [[1,0,1],[1,1,1],[1,0,1]] }          // H shape (3 tall)
];

function createGiantPiece(segmentCount) {
    // Create various configurations of 6-7 segment pieces
    // These will be larger and need to fit centered in the Next Piece window
    const color = randomColor();
    let shapeData;
    
    if (segmentCount === 6) {
        shapeData = HEXOMINO_SHAPES[Math.floor(Math.random() * HEXOMINO_SHAPES.length)];
    } else {
        shapeData = HEPTOMINO_SHAPES[Math.floor(Math.random() * HEPTOMINO_SHAPES.length)];
    }
    
    return {
        shape: shapeData.shape,
        type: 'giant' + segmentCount,
        color: color,
        x: Math.floor(COLS / 2) - Math.floor(shapeData.shape[0].length / 2),
        y: -1
    };
}

function createRandomHailBlock() {
    // Find the topmost player-placed block (not random blocks)
    let topFilledRow = ROWS - 1;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] && !isRandomBlock[y][x]) {
                topFilledRow = y;
                break;
            }
        }
        if (topFilledRow < ROWS - 1) break;
    }
    
    // Calculate the range: up to 4 rows above the highest player block
    const minY = Math.max(0, topFilledRow - 4);
    const maxY = topFilledRow;
    
    if (minY >= ROWS || maxY < 0) return; // Invalid range
    
    // Randomly choose a row within the valid range
    const y = Math.floor(Math.random() * (maxY - minY + 1)) + minY;
    
    // Randomly choose a column
    const x = Math.floor(Math.random() * COLS);
    const color = randomColor();
    
    // Place it directly on the board if the space is empty
    if (board[y] && !board[y][x]) {
        board[y][x] = color;
        isRandomBlock[y][x] = true; // Mark as random block
        fadingBlocks[y][x] = { opacity: 0.01, scale: 0.15 }; // Start small and nearly invisible
    }
}

function removeRandomBlocks() {
    // Gremlins mode: Schedule a gremlin attack after a delay
    // The block will be selected AFTER the delay (when it actually starts fading)
    
    // Random delay between 1-2 seconds (60-120 frames at 60fps)
    const delayFrames = Math.floor(60 + Math.random() * 60);
    
    // Add a pending gremlin attack (no x/y yet - will be picked after delay)
    gremlinFadingBlocks.push({
        x: -1,  // Placeholder - will be selected after delay
        y: -1,  // Placeholder - will be selected after delay
        opacity: 1.0,
        delay: delayFrames,
        color: null,  // Will be set when block is selected
        pending: true  // Flag to indicate this needs block selection
    });
}

function updateGremlinFadingBlocks() {
    // Update all gremlin fading blocks
    for (let i = gremlinFadingBlocks.length - 1; i >= 0; i--) {
        const gremlin = gremlinFadingBlocks[i];
        
        // Handle delay countdown
        if (gremlin.delay > 0) {
            gremlin.delay--;
            // When delay reaches 0 and this is a pending gremlin, pick a block NOW
            if (gremlin.delay === 0 && gremlin.pending) {
                // Find all filled positions NOW (after the delay)
                const filledPositions = [];
                for (let y = 0; y < ROWS; y++) {
                    for (let x = 0; x < COLS; x++) {
                        if (board[y][x]) {
                            filledPositions.push([x, y]);
                        }
                    }
                }
                
                // If no blocks exist, abort silently (no sound)
                if (filledPositions.length === 0) {
                    gremlinFadingBlocks.splice(i, 1);
                    continue;
                }
                
                // Pick ONE random block from existing stack
                const index = Math.floor(Math.random() * filledPositions.length);
                const [x, y] = filledPositions[index];
                
                // Update gremlin with actual position and color
                gremlin.x = x;
                gremlin.y = y;
                gremlin.color = board[y][x];
                gremlin.pending = false;
                
                // Play sound now that we have a real target
                playGremlinGiggle();
            }
            continue;
        }
        
        // Skip if still pending (shouldn't happen, but safety check)
        if (gremlin.pending) {
            gremlinFadingBlocks.splice(i, 1);
            continue;
        }
        
        // At this point, delay is 0 and we have a real block - fade it
        // Fade out slowly (over ~60 frames / 1 second)
        gremlin.opacity -= 0.017; // ~60 frames to fade completely
        
        // When fully faded, remove from board and list
        if (gremlin.opacity <= 0) {
            board[gremlin.y][gremlin.x] = null;
            isRandomBlock[gremlin.y][gremlin.x] = false;
            fadingBlocks[gremlin.y][gremlin.x] = null;
            gremlinFadingBlocks.splice(i, 1);
            
            // Apply gravity after block is removed
            applyGravity();
        }
    }
}

function switchSoRandomMode() {
    // So Random mode: Switch to a different random challenge
    // First, remove all CSS-based challenge effects
    document.documentElement.classList.remove('stranger-mode');
    StarfieldSystem.setStrangerMode(false);
    StarfieldSystem.removeVineOverlay();
    canvas.classList.remove('thinner-mode', 'thicker-mode', 'longago-mode', 'comingsoon-mode', 'nervous-active');
    
    // Reset canvas size in case we're coming from Thicker mode
    updateCanvasSize();
    
    // Pick a random mode from available modes
    const newMode = soRandomAvailableModes[Math.floor(Math.random() * soRandomAvailableModes.length)];
    soRandomCurrentMode = newMode;
    
    console.log(`🎲 So Random switched to: ${newMode}`);
    
    // Apply visual effects for CSS-based modes
    if (newMode === 'stranger') {
        document.documentElement.classList.add('stranger-mode');
        StarfieldSystem.setStrangerMode(true);
        StarfieldSystem.createVineOverlay(canvas);
        StarfieldSystem.createVineOverlay(nextCanvas);
    } else {
        StarfieldSystem.removeVineOverlay();
    }
    if (newMode === 'thinner') {
        canvas.classList.add('thinner-mode');
    }
    if (newMode === 'thicker') {
        canvas.classList.add('thicker-mode');
        updateCanvasSize(); // Resize canvas for Thicker mode
    }
    if (newMode === 'longago') {
        canvas.classList.add('longago-mode');
        // Need to update after transform is applied
        setTimeout(() => updateCanvasSize(), 0);
    }
    if (newMode === 'comingsoon') {
        canvas.classList.add('comingsoon-mode');
        // Need to update after transform is applied
        setTimeout(() => updateCanvasSize(), 0);
    }
    
    // Reset mode-specific counters
    if (newMode === 'sixseven') {
        sixSevenCounter = 0;
        sixSevenNextTarget = Math.random() < 0.5 ? 6 : 7;
        sixSevenNextSize = sixSevenNextTarget;
    }
    if (newMode === 'gremlins') {
        gremlinsCounter = 0;
        gremlinsNextTarget = 1 + Math.random() * 2;
    }
}

function playBloopSound() {
    if (!soundToggle.checked) return;
    
    // Create a "bloop" sound - descending pitch with round tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Start at higher pitch and descend
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.15);
    
    oscillator.type = 'sine'; // Round, bloop-like tone
    
    // Quick attack and decay
    gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
}

function playGremlinGiggle() {
    if (!soundToggle.checked) return;
    
    // Create a mischievous gremlin giggle sound
    // High-pitched, warbling, playful evil laugh
    
    // First giggle note - ascending pitch
    setTimeout(() => {
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);
        
        osc1.frequency.setValueAtTime(800, audioContext.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.08);
        osc1.type = 'square';
        
        gain1.gain.setValueAtTime(0.15, audioContext.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
        
        osc1.start(audioContext.currentTime);
        osc1.stop(audioContext.currentTime + 0.08);
    }, 0);
    
    // Second giggle note - higher
    setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        
        osc2.frequency.setValueAtTime(1000, audioContext.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(1400, audioContext.currentTime + 0.08);
        osc2.type = 'square';
        
        gain2.gain.setValueAtTime(0.18, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
        
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.08);
    }, 90);
    
    // Third giggle note - descending
    setTimeout(() => {
        const osc3 = audioContext.createOscillator();
        const gain3 = audioContext.createGain();
        osc3.connect(gain3);
        gain3.connect(audioContext.destination);
        
        osc3.frequency.setValueAtTime(1300, audioContext.currentTime);
        osc3.frequency.exponentialRampToValueAtTime(900, audioContext.currentTime + 0.10);
        osc3.type = 'square';
        
        gain3.gain.setValueAtTime(0.16, audioContext.currentTime);
        gain3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.10);
        
        osc3.start(audioContext.currentTime);
        osc3.stop(audioContext.currentTime + 0.10);
    }, 180);
}

function updateFadingBlocks() {
    // Animate fading blocks
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const fade = fadingBlocks[y][x];
            if (fade && fade.scale < 1) {
                fade.opacity += 0.04; // Fade faster - reaches 1.0 in ~25 frames
                fade.scale += 0.03;   // Grow faster - reaches 1.0 in ~28 frames (continues growing after opacity is full)
                
                if (fade.scale >= 1) {
                    fade.opacity = 1;
                    fade.scale = 1;
                    fadingBlocks[y][x] = null; // Done fading
                    playBloopSound(); // Play sound when fully grown
                } else if (fade.opacity > 1) {
                    fade.opacity = 1; // Cap opacity at 1.0
                }
            }
        }
    }
}

function adjustBrightness(color, factor) {
    // Handle non-hex colors (like rgb() strings) by returning them unchanged
    if (!color || !color.startsWith('#')) {
        console.warn('adjustBrightness received non-hex color:', color);
        return color || '#808080'; // Return gray as fallback
    }
    
    // Parse hex color
    const hex = color.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    
    // Validate parsed values
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        console.warn('adjustBrightness failed to parse color:', color);
        return '#808080'; // Return gray as fallback
    }
    
    // Adjust brightness
    r = Math.min(255, Math.max(0, Math.floor(r * factor)));
    g = Math.min(255, Math.max(0, Math.floor(g * factor)));
    b = Math.min(255, Math.max(0, Math.floor(b * factor)));
    
    // Convert back to hex
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function drawSolidShape(ctx, positions, color, blockSize = BLOCK_SIZE, useGold = false, faceOpacity = 1.0, useSilver = false) {
    if (positions.length === 0) return;
    
    if (useGold) {
        console.log(`✨ Drawing blob with GOLD edges! positions=${positions.length}, color=${color}`);
    }
    // Silver edges for hail blocks - logging removed to reduce console spam

    ctx.save();

    // Round Y positions for adjacency checking to handle fractional positions during animations
    // This prevents segmentation when blocks are pushed to fractional Y coordinates
    const posSet = new Set(positions.map(p => `${p[0]},${Math.round(p[1])}`));
    const b = Math.floor(blockSize * 0.2);

    // Create edge colors from the base color - just the 5 colors total
    // Parse the base color and create lighter/darker versions
    const baseColor = color;
    
    let topColor, leftColor, bottomColor, rightColor;
    
    if (useSilver) {
        // Silver edges for random hail blocks
        topColor = '#E8E8E8';      // Light silver
        leftColor = '#D3D3D3';     // Silver
        bottomColor = '#A9A9A9';   // Dark gray
        rightColor = '#808080';    // Gray
    } else if (useGold) {
        // Gold edges for spanning blobs
        topColor = '#FFD700';      // Gold
        leftColor = '#FFC700';     // Slightly darker gold
        bottomColor = '#DAA520';   // Goldenrod (darker)
        rightColor = '#B8860B';    // Dark goldenrod
    } else {
        // Create lighter shade for top and left (highlighted edges)
        const lightShade = adjustBrightness(color, 1.3);
        const mediumLightShade = adjustBrightness(color, 1.15);
        
        // Create darker shade for bottom and right (shadow edges)
        const darkShade = adjustBrightness(color, 0.7);
        const mediumDarkShade = adjustBrightness(color, 0.85);
        
        topColor = lightShade;
        leftColor = mediumLightShade;
        bottomColor = darkShade;
        rightColor = mediumDarkShade;
    }

    positions.forEach(([x, y]) => {
        const px = x * blockSize;
        const py = y * blockSize;

        // Round y for adjacency checks to match posSet keys (handles fractional positions)
        const ry = Math.round(y);
        const T = posSet.has(`${x},${ry-1}`);
        const B = posSet.has(`${x},${ry+1}`);
        const L = posSet.has(`${x-1},${ry}`);
        const R = posSet.has(`${x+1},${ry}`);
        const TL = posSet.has(`${x-1},${ry-1}`);
        const TR = posSet.has(`${x+1},${ry-1}`);
        const BL = posSet.has(`${x-1},${ry+1}`);
        const BR = posSet.has(`${x+1},${ry+1}`);

        // Draw main face with optional transparency
        // Multiply faceOpacity with the current globalAlpha (for fade effects)
        const currentAlpha = ctx.globalAlpha;
        ctx.globalAlpha = currentAlpha * faceOpacity;
        ctx.fillStyle = color;
        ctx.fillRect(px, py, blockSize, blockSize);
        ctx.globalAlpha = currentAlpha; // Restore to parent's alpha

        // Draw edges with gradients for depth
        // IMPORTANT: Edge rectangles only exclude corner areas when those corners will be drawn
        // This prevents both gaps (when corners aren't drawn) and overlaps (when they are)
        if (!T) {
            // Top edge - only exclude corners if they'll actually be drawn
            const topGradient = ctx.createLinearGradient(px, py, px, py + b);
            topGradient.addColorStop(0, topColor);
            topGradient.addColorStop(1, adjustBrightness(topColor, 0.85));
            ctx.fillStyle = topGradient;
            // Adjust start and width based on whether corner triangles will be drawn
            const leftCornerExists = !L;  // Top-left outer corner exists if left edge is exposed
            const rightCornerExists = !R; // Top-right outer corner exists if right edge is exposed
            const startX = leftCornerExists ? px + b : px;
            const width = blockSize - (leftCornerExists ? b : 0) - (rightCornerExists ? b : 0);
            ctx.fillRect(startX, py, width, b);
        }
        if (!L) {
            // Left edge - only exclude corners if they'll actually be drawn
            const leftGradient = ctx.createLinearGradient(px, py, px + b, py);
            leftGradient.addColorStop(0, leftColor);
            leftGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = leftGradient;
            const topCornerExists = !T;    // Top-left outer corner exists if top edge is exposed
            const bottomCornerExists = !B; // Bottom-left outer corner exists if bottom edge is exposed
            const startY = topCornerExists ? py + b : py;
            const height = blockSize - (topCornerExists ? b : 0) - (bottomCornerExists ? b : 0);
            ctx.fillRect(px, startY, b, height);
        }
        if (!B) {
            // Bottom edge - only exclude corners if they'll actually be drawn
            const bottomGradient = ctx.createLinearGradient(px, py + blockSize - b, px, py + blockSize);
            bottomGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
            bottomGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = bottomGradient;
            const leftCornerExists = !L;  // Bottom-left outer corner exists if left edge is exposed
            const rightCornerExists = !R; // Bottom-right outer corner exists if right edge is exposed
            const startX = leftCornerExists ? px + b : px;
            const width = blockSize - (leftCornerExists ? b : 0) - (rightCornerExists ? b : 0);
            ctx.fillRect(startX, py + blockSize - b, width, b);
        }
        if (!R) {
            // Right edge - only exclude corners if they'll actually be drawn
            const rightGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize, py);
            rightGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
            rightGradient.addColorStop(1, rightColor);
            ctx.fillStyle = rightGradient;
            const topCornerExists = !T;    // Top-right outer corner exists if top edge is exposed
            const bottomCornerExists = !B; // Bottom-right outer corner exists if bottom edge is exposed
            const startY = topCornerExists ? py + b : py;
            const height = blockSize - (topCornerExists ? b : 0) - (bottomCornerExists ? b : 0);
            ctx.fillRect(px + blockSize - b, startY, b, height);
        }

        // Outer corners - two triangles, one for each edge (with gradients)
        if (!T && !L) {
            // Top side triangle - matches top edge gradient exactly
            const topCornerGradient = ctx.createLinearGradient(px, py, px, py + b);
            topCornerGradient.addColorStop(0, topColor);
            topCornerGradient.addColorStop(1, adjustBrightness(topColor, 0.85));
            ctx.fillStyle = topCornerGradient;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + b, py);
            ctx.lineTo(px + b, py + b);
            ctx.closePath();
            ctx.fill();
            // Left side triangle - matches left edge gradient exactly
            const leftCornerGradient = ctx.createLinearGradient(px, py, px + b, py);
            leftCornerGradient.addColorStop(0, leftColor);
            leftCornerGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = leftCornerGradient;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px, py + b);
            ctx.lineTo(px + b, py + b);
            ctx.closePath();
            ctx.fill();
        }
        if (!T && !R) {
            // Top side triangle - matches top edge gradient exactly
            const topRightCornerGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize - b, py + b);
            topRightCornerGradient.addColorStop(0, topColor);
            topRightCornerGradient.addColorStop(1, adjustBrightness(topColor, 0.85));
            ctx.fillStyle = topRightCornerGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py);
            ctx.lineTo(px + blockSize - b, py);
            ctx.lineTo(px + blockSize - b, py + b);
            ctx.closePath();
            ctx.fill();
            // Right side triangle - matches right edge gradient exactly
            const rightCornerGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize, py);
            rightCornerGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
            rightCornerGradient.addColorStop(1, rightColor);
            ctx.fillStyle = rightCornerGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py);
            ctx.lineTo(px + blockSize, py + b);
            ctx.lineTo(px + blockSize - b, py + b);
            ctx.closePath();
            ctx.fill();
        }
        if (!B && !L) {
            // Left side triangle - matches left edge gradient exactly
            const leftBottomGradient = ctx.createLinearGradient(px, py + blockSize - b, px + b, py + blockSize - b);
            leftBottomGradient.addColorStop(0, leftColor);
            leftBottomGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = leftBottomGradient;
            ctx.beginPath();
            ctx.moveTo(px, py + blockSize);
            ctx.lineTo(px, py + blockSize - b);
            ctx.lineTo(px + b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
            // Bottom side triangle - matches bottom edge gradient exactly
            const bottomLeftGradient = ctx.createLinearGradient(px, py + blockSize - b, px, py + blockSize);
            bottomLeftGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
            bottomLeftGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = bottomLeftGradient;
            ctx.beginPath();
            ctx.moveTo(px, py + blockSize);
            ctx.lineTo(px + b, py + blockSize);
            ctx.lineTo(px + b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
        }
        if (!B && !R) {
            // Bottom side triangle - matches bottom edge gradient exactly
            const bottomRightGradient = ctx.createLinearGradient(px + blockSize - b, py + blockSize - b, px + blockSize - b, py + blockSize);
            bottomRightGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
            bottomRightGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = bottomRightGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py + blockSize);
            ctx.lineTo(px + blockSize - b, py + blockSize);
            ctx.lineTo(px + blockSize - b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
            // Right side triangle - matches right edge gradient exactly
            const rightBottomGradient = ctx.createLinearGradient(px + blockSize - b, py + blockSize - b, px + blockSize, py + blockSize - b);
            rightBottomGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
            rightBottomGradient.addColorStop(1, rightColor);
            ctx.fillStyle = rightBottomGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py + blockSize);
            ctx.lineTo(px + blockSize, py + blockSize - b);
            ctx.lineTo(px + blockSize - b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
        }

        // Inner corners - TWO triangles meeting at 45 degrees with edge colors and gradients
        if (T && L && !TL) {
            // Left-facing triangle - matches left edge gradient exactly  
            const innerLeftGradient = ctx.createLinearGradient(px, py, px + b, py);
            innerLeftGradient.addColorStop(0, leftColor);
            innerLeftGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = innerLeftGradient;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + b, py);
            ctx.lineTo(px + b, py + b);
            ctx.closePath();
            ctx.fill();
            
            // Top-facing triangle - matches top edge gradient exactly
            const innerTopGradient = ctx.createLinearGradient(px, py, px, py + b);
            innerTopGradient.addColorStop(0, topColor);
            innerTopGradient.addColorStop(1, adjustBrightness(topColor, 0.85));
            ctx.fillStyle = innerTopGradient;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px, py + b);
            ctx.lineTo(px + b, py + b);
            ctx.closePath();
            ctx.fill();
        }
        if (T && R && !TR) {
            // Right-facing triangle - matches right edge gradient exactly
            const innerRightGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize, py);
            innerRightGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
            innerRightGradient.addColorStop(1, rightColor);
            ctx.fillStyle = innerRightGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py);
            ctx.lineTo(px + blockSize - b, py);
            ctx.lineTo(px + blockSize - b, py + b);
            ctx.closePath();
            ctx.fill();
            
            // Top-facing triangle - matches top edge gradient exactly
            const innerTopRightGradient = ctx.createLinearGradient(px + blockSize - b, py, px + blockSize - b, py + b);
            innerTopRightGradient.addColorStop(0, topColor);
            innerTopRightGradient.addColorStop(1, adjustBrightness(topColor, 0.85));
            ctx.fillStyle = innerTopRightGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py);
            ctx.lineTo(px + blockSize, py + b);
            ctx.lineTo(px + blockSize - b, py + b);
            ctx.closePath();
            ctx.fill();
        }
        if (B && L && !BL) {
            // Bottom-facing triangle - matches bottom edge gradient exactly
            const innerBottomLeftGradient = ctx.createLinearGradient(px, py + blockSize - b, px, py + blockSize);
            innerBottomLeftGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
            innerBottomLeftGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = innerBottomLeftGradient;
            ctx.beginPath();
            ctx.moveTo(px, py + blockSize);
            ctx.lineTo(px, py + blockSize - b);
            ctx.lineTo(px + b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
            
            // Left-facing triangle - matches left edge gradient exactly
            const innerLeftBottomGradient = ctx.createLinearGradient(px, py + blockSize - b, px + b, py + blockSize - b);
            innerLeftBottomGradient.addColorStop(0, leftColor);
            innerLeftBottomGradient.addColorStop(1, adjustBrightness(leftColor, 0.85));
            ctx.fillStyle = innerLeftBottomGradient;
            ctx.beginPath();
            ctx.moveTo(px, py + blockSize);
            ctx.lineTo(px + b, py + blockSize);
            ctx.lineTo(px + b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
        }
        if (B && R && !BR) {
            // Bottom-facing triangle - matches bottom edge gradient exactly
            const innerBottomRightGradient = ctx.createLinearGradient(px + blockSize - b, py + blockSize - b, px + blockSize - b, py + blockSize);
            innerBottomRightGradient.addColorStop(0, adjustBrightness(bottomColor, 1.15));
            innerBottomRightGradient.addColorStop(1, bottomColor);
            ctx.fillStyle = innerBottomRightGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py + blockSize);
            ctx.lineTo(px + blockSize, py + blockSize - b);
            ctx.lineTo(px + blockSize - b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
            
            // Right-facing triangle - matches right edge gradient exactly
            const innerRightBottomGradient = ctx.createLinearGradient(px + blockSize - b, py + blockSize - b, px + blockSize, py + blockSize - b);
            innerRightBottomGradient.addColorStop(0, adjustBrightness(rightColor, 1.15));
            innerRightBottomGradient.addColorStop(1, rightColor);
            ctx.fillStyle = innerRightBottomGradient;
            ctx.beginPath();
            ctx.moveTo(px + blockSize, py + blockSize);
            ctx.lineTo(px + blockSize - b, py + blockSize);
            ctx.lineTo(px + blockSize - b, py + blockSize - b);
            ctx.closePath();
            ctx.fill();
        }
    });

    ctx.restore();
}

function findBlob(x, y, color, visited = new Set()) {
    const key = `${x},${y}`;
    if (visited.has(key) || x < 0 || x >= COLS || y < 0 || y >= ROWS) return [];
    if (!board[y][x] || board[y][x] !== color) return [];

    visited.add(key);
    let blob = [[x, y]];

    blob = blob.concat(findBlob(x + 1, y, color, visited));
    blob = blob.concat(findBlob(x - 1, y, color, visited));
    blob = blob.concat(findBlob(x, y + 1, color, visited));
    blob = blob.concat(findBlob(x, y - 1, color, visited));

    return blob;
}

function getAllBlobs() {
    // Validate board exists and is properly initialized
    if (!board || !Array.isArray(board) || board.length === 0) {
        return [];
    }
    
    const visited = new Set();
    const blobs = [];

    for (let y = 0; y < ROWS; y++) {
        // Validate this row exists
        if (!board[y] || !Array.isArray(board[y])) continue;
        
        for (let x = 0; x < COLS; x++) {
            const key = `${x},${y}`;
            if (!visited.has(key) && board[y][x]) {
                const blob = findBlob(x, y, board[y][x], visited);
                if (blob.length > 0) {
                    blobs.push({ positions: blob, color: board[y][x] });
                }
            }
        }
    }

    return blobs;
}

function detectBlackHoles(blobs) {
    // Returns array of {outerBlob, innerBlob} pairs where outer envelops inner
    const blackHoles = [];
    
    for (let i = 0; i < blobs.length; i++) {
        for (let j = 0; j < blobs.length; j++) {
            if (i === j) continue;
            
            const outer = blobs[i];
            const inner = blobs[j];
            
            // Check if inner blob is completely surrounded by outer blob
            if (isBlobEnveloped(inner, outer)) {
                blackHoles.push({
                    outerBlob: outer,
                    innerBlob: inner
                });
            }
        }
    }
    
    return blackHoles;
}

function isBlobEnveloped(innerBlob, outerBlob) {
    // Create a set of outer blob positions for fast lookup
    const outerSet = new Set(outerBlob.positions.map(p => `${p[0]},${p[1]}`));
    const innerSet = new Set(innerBlob.positions.map(p => `${p[0]},${p[1]}`));
    
    // For each block in inner blob, check if ALL 8 adjacent positions (including diagonals)
    // are either part of outer blob OR part of inner blob
    // If ANY adjacent is out of bounds OR empty space, it's NOT enveloped
    for (const [x, y] of innerBlob.positions) {
        const adjacents = [
            [x-1, y],     // left
            [x+1, y],     // right
            [x, y-1],     // top
            [x, y+1],     // bottom
            [x-1, y-1],   // top-left corner
            [x+1, y-1],   // top-right corner
            [x-1, y+1],   // bottom-left corner
            [x+1, y+1]    // bottom-right corner
        ];
        
        for (const [ax, ay] of adjacents) {
            const key = `${ax},${ay}`;
            
            // If adjacent position is OUT OF BOUNDS, inner blob is NOT enveloped
            // (it's touching a wall/edge)
            if (ax < 0 || ax >= COLS || ay < 0 || ay >= ROWS) {
                return false;
            }
            
            // Adjacent is in bounds - check if it's part of outer or inner blob
            const isOuter = outerSet.has(key);
            const isInner = innerSet.has(key);
            
            // If it's neither outer nor inner, then inner is NOT enveloped
            if (!isOuter && !isInner) {
                return false;
            }
        }
    }
    
    // All adjacent cells (including diagonals) are either outer blob or inner blob, 
    // and none touch the walls - it's truly enveloped!
    return true;
}

function drawCanvasBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!minimalistMode) {
        ctx.fillStyle = 'rgba(30, 60, 120, 0.25)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawBoard() {
    // Fully clear the canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Then draw the background (matching CSS background transparency) - skip in minimalist mode
    if (!minimalistMode) {
        ctx.fillStyle = 'rgba(30, 60, 120, 0.25)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Draw storm particles BEFORE blocks (behind gameplay)
    drawStormParticles();
    
    // If game is paused, skip drawing the stack (but still draw background effects above)
    if (paused) {
        return;
    }
    
    // Draw black hole vortex BEHIND the blocks
    if (blackHoleActive && blackHoleInnerBlob) {
        const centerPixelX = blackHoleCenterX * BLOCK_SIZE + BLOCK_SIZE / 2;
        const centerPixelY = blackHoleCenterY * BLOCK_SIZE + BLOCK_SIZE / 2;
        
        const elapsed = Date.now() - blackHoleStartTime;
        const pulse = Math.sin(elapsed / 200) * 0.15 + 0.85; // Pulsating effect
        
        // Calculate bounds of inner blob to determine vortex size
        const innerXs = blackHoleInnerBlob.positions.map(p => p[0]);
        const innerYs = blackHoleInnerBlob.positions.map(p => p[1]);
        const minX = Math.min(...innerXs);
        const maxX = Math.max(...innerXs);
        const minY = Math.min(...innerYs);
        const maxY = Math.max(...innerYs);
        const blobWidth = (maxX - minX + 1) * BLOCK_SIZE;
        const blobHeight = (maxY - minY + 1) * BLOCK_SIZE;
        const maxRadius = Math.max(blobWidth, blobHeight) * 0.8;
        
        ctx.save();
        
        // Draw large radial gradient vortex (behind blocks)
        const gradient = ctx.createRadialGradient(
            centerPixelX, centerPixelY, 0,
            centerPixelX, centerPixelY, maxRadius
        );
        gradient.addColorStop(0, '#000000');      // Pure black center
        gradient.addColorStop(0.3, '#0a0010');    // Very dark purple
        gradient.addColorStop(0.5, '#1a0033');    // Dark purple
        gradient.addColorStop(0.7, '#4b0082');    // Indigo
        gradient.addColorStop(0.85, '#8b00ff');   // Bright purple
        gradient.addColorStop(1, 'rgba(139, 0, 255, 0)'); // Transparent purple edge
        
        ctx.fillStyle = gradient;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(centerPixelX, centerPixelY, maxRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Add rotating swirl effect
        const swirl = (elapsed / 100) % (Math.PI * 2);
        ctx.globalAlpha = 0.4 * pulse;
        ctx.strokeStyle = '#8b00ff';
        ctx.lineWidth = 3;
        
        // Draw multiple spiral arms
        for (let arm = 0; arm < 3; arm++) {
            ctx.beginPath();
            const armOffset = (Math.PI * 2 / 3) * arm;
            for (let i = 0; i < 50; i++) {
                const progress = i / 50;
                const angle = swirl + armOffset + progress * Math.PI * 4;
                const radius = progress * maxRadius * 0.7;
                const x = centerPixelX + Math.cos(angle) * radius;
                const y = centerPixelY + Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        // Add inner glow ring
        ctx.globalAlpha = 0.6 * pulse;
        ctx.strokeStyle = '#4b0082';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(centerPixelX, centerPixelY, maxRadius * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }

    // Create a set of falling block positions to skip during board rendering
    const fallingBlockSet = new Set();
    if (gravityAnimating) {
        fallingBlocks.forEach(fb => {
            fallingBlockSet.add(`${fb.x},${fb.targetY}`);
        });
    }

    const blobs = getAllBlobs();
    
    // Apply phantom mode opacity to the stack (not the current piece)
    const isPhantomMode = challengeMode === 'phantom' || activeChallenges.has('phantom') || soRandomCurrentMode === 'phantom';
    if (isPhantomMode) {
        ctx.save();
        ctx.globalAlpha = phantomOpacity;
    }
    
    blobs.forEach(blob => {
        // Validate blob has positions array with valid entries
        if (!blob || !blob.positions || !Array.isArray(blob.positions) || blob.positions.length === 0) {
            return;
        }
        
        // Additional validation: ensure all positions are valid arrays
        let validPositions = blob.positions.filter(p => Array.isArray(p) && p.length >= 2);
        if (validPositions.length === 0) {
            return;
        }
        
        // Filter out positions that are currently falling (to avoid duplicates)
        if (gravityAnimating) {
            validPositions = validPositions.filter(p => !fallingBlockSet.has(`${p[0]},${p[1]}`));
            if (validPositions.length === 0) {
                return;
            }
        }
        
        // Separate random hail blocks, lattice blocks, and normal blocks
        const randomBlockPositions = [];
        const latticeBlockPositions = [];
        const normalBlockPositions = [];
        
        validPositions.forEach(([x, y]) => {
            if (isRandomBlock[y] && isRandomBlock[y][x]) {
                randomBlockPositions.push([x, y]);
            } else if (isLatticeBlock[y] && isLatticeBlock[y][x]) {
                latticeBlockPositions.push([x, y]);
            } else {
                normalBlockPositions.push([x, y]);
            }
        });
        
        // Check if any blocks in this blob are fading - find minimum opacity and collect fading blocks
        let minFadeOpacity = 1.0;
        const fadingBlocksInBlob = [];
        for (const pos of validPositions) {
            const [x, y] = pos;
            const fade = fadingBlocks[y] && fadingBlocks[y][x];
            if (fade && fade.opacity < 1) {
                minFadeOpacity = Math.min(minFadeOpacity, fade.opacity);
                fadingBlocksInBlob.push({ x, y, fade });
            }
        }
        
        // Check if blob spans from left edge (x=0) to right edge (x=COLS-1)
        const minX = Math.min(...validPositions.map(p => p[0]));
        const maxX = Math.max(...validPositions.map(p => p[0]));
        const spansWidth = (minX === 0 && maxX === COLS - 1);
        
        if (spansWidth) {
            console.log(`🌊 TSUNAMI BLOB DETECTED! minX=${minX}, maxX=${maxX}, COLS=${COLS}, color=${blob.color}, size=${validPositions.length}`);
        }
        
        // Note: Gold border is drawn for spanning blobs, but actual tsunami
        // triggering is handled by checkForSpecialFormations()
        
        // If there are fading blocks, we need to handle them specially to avoid overlap artifacts
        if (fadingBlocksInBlob.length > 0) {
            // Draw non-fading normal blocks first
            const nonFadingNormalPositions = normalBlockPositions.filter(p => {
                const [x, y] = p;
                const fade = fadingBlocks[y] && fadingBlocks[y][x];
                return !fade || fade.opacity >= 1;
            });
            if (nonFadingNormalPositions.length > 0) {
                const displayColor = blob.color === volcanoLavaColor ? getLavaColor() : blob.color;
                
                // Check if any of these blocks are being removed by gremlins
                const gremlinAffectedBlocks = [];
                const normalGremlinBlocks = [];
                
                nonFadingNormalPositions.forEach(([x, y]) => {
                    const gremlin = gremlinFadingBlocks.find(g => g.x === x && g.y === y);
                    if (gremlin && gremlin.delay === 0) {
                        gremlinAffectedBlocks.push({ pos: [x, y], opacity: gremlin.opacity });
                    } else {
                        normalGremlinBlocks.push([x, y]);
                    }
                });
                
                // Draw normal blocks (not affected by gremlins)
                if (normalGremlinBlocks.length > 0) {
                    drawSolidShape(ctx, normalGremlinBlocks, displayColor, BLOCK_SIZE, spansWidth, getFaceOpacity(), false);
                }
                
                // Draw gremlin-affected blocks with fading opacity
                gremlinAffectedBlocks.forEach(({ pos, opacity }) => {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    drawSolidShape(ctx, [pos], displayColor, BLOCK_SIZE, spansWidth, getFaceOpacity(), false);
                    ctx.restore();
                });
            }
            
            // Draw non-fading random hail blocks with silver
            const nonFadingRandomPositions = randomBlockPositions.filter(p => {
                const [x, y] = p;
                const fade = fadingBlocks[y] && fadingBlocks[y][x];
                return !fade || fade.opacity >= 1;
            });
            if (nonFadingRandomPositions.length > 0) {
                const displayColor = blob.color === volcanoLavaColor ? getLavaColor() : blob.color;
                
                // Check if any of these blocks are being removed by gremlins
                const gremlinAffectedRandomBlocks = [];
                const normalRandomBlocks = [];
                
                nonFadingRandomPositions.forEach(([x, y]) => {
                    const gremlin = gremlinFadingBlocks.find(g => g.x === x && g.y === y);
                    if (gremlin && gremlin.delay === 0) {
                        gremlinAffectedRandomBlocks.push({ pos: [x, y], opacity: gremlin.opacity });
                    } else {
                        normalRandomBlocks.push([x, y]);
                    }
                });
                
                // Draw normal random blocks (not affected by gremlins)
                if (normalRandomBlocks.length > 0) {
                    drawSolidShape(ctx, normalRandomBlocks, displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                }
                
                // Draw gremlin-affected random blocks with fading opacity
                gremlinAffectedRandomBlocks.forEach(({ pos, opacity }) => {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    drawSolidShape(ctx, [pos], displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                    ctx.restore();
                });
            }
            
            // Draw non-fading lattice blocks with silver
            const nonFadingLatticePositions = latticeBlockPositions.filter(p => {
                const [x, y] = p;
                const fade = fadingBlocks[y] && fadingBlocks[y][x];
                return !fade || fade.opacity >= 1;
            });
            if (nonFadingLatticePositions.length > 0) {
                const displayColor = blob.color === volcanoLavaColor ? getLavaColor() : blob.color;
                
                // Check if any of these blocks are being removed by gremlins
                const gremlinAffectedLatticeBlocks = [];
                const normalLatticeBlocks = [];
                
                nonFadingLatticePositions.forEach(([x, y]) => {
                    const gremlin = gremlinFadingBlocks.find(g => g.x === x && g.y === y);
                    if (gremlin && gremlin.delay === 0) {
                        gremlinAffectedLatticeBlocks.push({ pos: [x, y], opacity: gremlin.opacity });
                    } else {
                        normalLatticeBlocks.push([x, y]);
                    }
                });
                
                // Draw normal lattice blocks (not affected by gremlins)
                if (normalLatticeBlocks.length > 0) {
                    drawSolidShape(ctx, normalLatticeBlocks, displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                }
                
                // Draw gremlin-affected lattice blocks with fading opacity
                gremlinAffectedLatticeBlocks.forEach(({ pos, opacity }) => {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    drawSolidShape(ctx, [pos], displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                    ctx.restore();
                });
            }
            
            // Group fading blocks by opacity level to draw them as merged shapes (avoids overlap artifacts)
            const fadingBlocksByOpacity = new Map();
            fadingBlocksInBlob.forEach(({x, y, fade}) => {
                // Round opacity to avoid too many groups
                const opacityKey = Math.round(fade.opacity * 20) / 20; // Round to nearest 0.05
                const scaleKey = Math.round(fade.scale * 20) / 20;
                const key = `${opacityKey}_${scaleKey}`;
                
                if (!fadingBlocksByOpacity.has(key)) {
                    fadingBlocksByOpacity.set(key, {
                        opacity: fade.opacity,
                        scale: fade.scale,
                        positions: []
                    });
                }
                fadingBlocksByOpacity.get(key).positions.push([x, y]);
            });
            
            // Draw each group of fading blocks as a single merged shape
            fadingBlocksByOpacity.forEach(group => {
                ctx.save();
                ctx.globalAlpha = group.opacity;
                
                if (Math.abs(group.scale - 1.0) > 0.01) {
                    // Apply scaling for the entire group
                    const centerX = group.positions.reduce((sum, p) => sum + p[0], 0) / group.positions.length;
                    const centerY = group.positions.reduce((sum, p) => sum + p[1], 0) / group.positions.length;
                    const scaleCenterX = (centerX + 0.5) * BLOCK_SIZE;
                    const scaleCenterY = (centerY + 0.5) * BLOCK_SIZE;
                    
                    ctx.translate(scaleCenterX, scaleCenterY);
                    ctx.scale(group.scale, group.scale);
                    ctx.translate(-scaleCenterX, -scaleCenterY);
                }
                
                // Separate positions into normal, random, and lattice blocks
                const normalPositions = [];
                const randomPositions = [];
                const latticePositions = [];
                group.positions.forEach(([x, y]) => {
                    if (isRandomBlock[y] && isRandomBlock[y][x]) {
                        randomPositions.push([x, y]);
                    } else if (isLatticeBlock[y] && isLatticeBlock[y][x]) {
                        latticePositions.push([x, y]);
                    } else {
                        normalPositions.push([x, y]);
                    }
                });
                
                // Draw as merged shapes to avoid overlap artifacts
                const displayColor = blob.color === volcanoLavaColor ? getLavaColor() : blob.color;
                if (normalPositions.length > 0) {
                    drawSolidShape(ctx, normalPositions, displayColor, BLOCK_SIZE, false, getFaceOpacity(), false);
                }
                if (randomPositions.length > 0) {
                    drawSolidShape(ctx, randomPositions, displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                }
                if (latticePositions.length > 0) {
                    drawSolidShape(ctx, latticePositions, displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                }
                
                ctx.restore();
            });
        } else {
            // No fading blocks
            // Draw normal blocks
            if (normalBlockPositions.length > 0) {
                const displayColor = blob.color === volcanoLavaColor ? getLavaColor() : blob.color;
                
                // Check if any blocks are being removed by gremlins
                const gremlinAffectedBlocks = [];
                const normalGremlinBlocks = [];
                
                normalBlockPositions.forEach(([x, y]) => {
                    const gremlin = gremlinFadingBlocks.find(g => g.x === x && g.y === y);
                    if (gremlin && gremlin.delay === 0) {
                        gremlinAffectedBlocks.push({ pos: [x, y], opacity: gremlin.opacity });
                    } else {
                        normalGremlinBlocks.push([x, y]);
                    }
                });
                
                // Draw normal blocks (not affected by gremlins)
                if (normalGremlinBlocks.length > 0) {
                    drawSolidShape(ctx, normalGremlinBlocks, displayColor, BLOCK_SIZE, spansWidth, getFaceOpacity(), false);
                }
                
                // Draw gremlin-affected blocks with fading opacity
                gremlinAffectedBlocks.forEach(({ pos, opacity }) => {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    drawSolidShape(ctx, [pos], displayColor, BLOCK_SIZE, spansWidth, getFaceOpacity(), false);
                    ctx.restore();
                });
            }
            // Draw random hail blocks with silver
            if (randomBlockPositions.length > 0) {
                const displayColor = blob.color === volcanoLavaColor ? getLavaColor() : blob.color;
                
                // Check if any blocks are being removed by gremlins
                const gremlinAffectedRandomBlocks = [];
                const normalRandomBlocks = [];
                
                randomBlockPositions.forEach(([x, y]) => {
                    const gremlin = gremlinFadingBlocks.find(g => g.x === x && g.y === y);
                    if (gremlin && gremlin.delay === 0) {
                        gremlinAffectedRandomBlocks.push({ pos: [x, y], opacity: gremlin.opacity });
                    } else {
                        normalRandomBlocks.push([x, y]);
                    }
                });
                
                // Draw normal random blocks (not affected by gremlins)
                if (normalRandomBlocks.length > 0) {
                    drawSolidShape(ctx, normalRandomBlocks, displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                }
                
                // Draw gremlin-affected random blocks with fading opacity
                gremlinAffectedRandomBlocks.forEach(({ pos, opacity }) => {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    drawSolidShape(ctx, [pos], displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                    ctx.restore();
                });
            }
            // Draw lattice blocks with silver
            if (latticeBlockPositions.length > 0) {
                const displayColor = blob.color === volcanoLavaColor ? getLavaColor() : blob.color;
                
                // Check if any blocks are being removed by gremlins
                const gremlinAffectedLatticeBlocks = [];
                const normalLatticeBlocks = [];
                
                latticeBlockPositions.forEach(([x, y]) => {
                    const gremlin = gremlinFadingBlocks.find(g => g.x === x && g.y === y);
                    if (gremlin && gremlin.delay === 0) {
                        gremlinAffectedLatticeBlocks.push({ pos: [x, y], opacity: gremlin.opacity });
                    } else {
                        normalLatticeBlocks.push([x, y]);
                    }
                });
                
                // Draw normal lattice blocks (not affected by gremlins)
                if (normalLatticeBlocks.length > 0) {
                    drawSolidShape(ctx, normalLatticeBlocks, displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                }
                
                // Draw gremlin-affected lattice blocks with fading opacity
                gremlinAffectedLatticeBlocks.forEach(({ pos, opacity }) => {
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    drawSolidShape(ctx, [pos], displayColor, BLOCK_SIZE, false, getFaceOpacity(), true);
                    ctx.restore();
                });
            }
        }
    });
    
    // Restore context if phantom mode was applied
    if (isPhantomMode) {
        ctx.restore();
    }

    // Draw lightning effects
    if (lightningEffects.length > 0) {
        console.log(`🌩️ Drawing ${lightningEffects.length} lightning effects`);
    }
    lightningEffects = lightningEffects.filter(lightning => {
        const elapsed = Date.now() - lightning.startTime;
        const progress = elapsed / lightning.duration;
        
        if (progress >= 1) return false;
        
        console.log(`⚡ Rendering lightning at x=${lightning.x}, segments=${lightning.segments.length}, progress=${progress.toFixed(2)}`);
        
        const baseAlpha = 1 - progress;
        
        // Check if Stranger mode is active for red lightning
        const strangerActive = challengeMode === 'stranger' || activeChallenges.has('stranger');
        const glowColor = strangerActive ? '#FF0000' : '#00FFFF';
        const innerGlowColor = strangerActive ? '#FF8888' : '#88FFFF';
        const coreColor = '#FFFFFF';
        
        // Draw outer glow layers (multiple passes for more intense glow)
        ctx.save();
        
        // Outermost glow - wide and soft
        ctx.globalAlpha = baseAlpha * 0.15;
        ctx.strokeStyle = glowColor;
        ctx.shadowBlur = 60;
        ctx.shadowColor = glowColor;
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.moveTo(lightning.x, 0);
        for (let i = 0; i < lightning.segments.length; i++) {
            ctx.lineTo(lightning.segments[i].x, lightning.segments[i].y);
        }
        ctx.stroke();
        lightning.branches.forEach(branch => {
            ctx.beginPath();
            ctx.moveTo(branch.startX, branch.startY);
            for (let i = 0; i < branch.segments.length; i++) {
                ctx.lineTo(branch.segments[i].x, branch.segments[i].y);
            }
            ctx.stroke();
        });
        
        // Middle glow
        ctx.globalAlpha = baseAlpha * 0.3;
        ctx.shadowBlur = 35;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(lightning.x, 0);
        for (let i = 0; i < lightning.segments.length; i++) {
            ctx.lineTo(lightning.segments[i].x, lightning.segments[i].y);
        }
        ctx.stroke();
        lightning.branches.forEach(branch => {
            ctx.beginPath();
            ctx.moveTo(branch.startX, branch.startY);
            for (let i = 0; i < branch.segments.length; i++) {
                ctx.lineTo(branch.segments[i].x, branch.segments[i].y);
            }
            ctx.stroke();
        });
        
        // Inner glow
        ctx.globalAlpha = baseAlpha * 0.5;
        ctx.strokeStyle = innerGlowColor;
        ctx.shadowBlur = 20;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(lightning.x, 0);
        for (let i = 0; i < lightning.segments.length; i++) {
            ctx.lineTo(lightning.segments[i].x, lightning.segments[i].y);
        }
        ctx.stroke();
        lightning.branches.forEach(branch => {
            ctx.beginPath();
            ctx.moveTo(branch.startX, branch.startY);
            for (let i = 0; i < branch.segments.length; i++) {
                ctx.lineTo(branch.segments[i].x, branch.segments[i].y);
            }
            ctx.stroke();
        });
        
        // Main bolt (bright white core)
        ctx.globalAlpha = baseAlpha;
        ctx.strokeStyle = coreColor;
        ctx.shadowBlur = 15;
        ctx.shadowColor = coreColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(lightning.x, 0);
        for (let i = 0; i < lightning.segments.length; i++) {
            ctx.lineTo(lightning.segments[i].x, lightning.segments[i].y);
        }
        ctx.stroke();
        
        // Branch bolts (thinner white core)
        ctx.lineWidth = 2;
        lightning.branches.forEach(branch => {
            ctx.beginPath();
            ctx.moveTo(branch.startX, branch.startY);
            for (let i = 0; i < branch.segments.length; i++) {
                ctx.lineTo(branch.segments[i].x, branch.segments[i].y);
            }
            ctx.stroke();
        });
        
        ctx.restore();
        
        return true;
    });

    lineAnimations.forEach(anim => {
        anim.cells.forEach(cell => {
            if (!cell.removed) {
                ctx.globalAlpha = cell.alpha;
                drawSolidShape(ctx, [[cell.x, cell.y]], cell.color);
                ctx.globalAlpha = 1;
            }
        });
    });
}

function triggerTsunami(targetY) {
    // Add golden border effect
    canvas.classList.add('tsunami-active');
    
    // Multiple lightning strikes for tsunami!
    const numStrikes = 5 + Math.floor(Math.random() * 3); // 5-7 strikes
    
    for (let i = 0; i < numStrikes; i++) {
        setTimeout(() => {
            triggerLightning(targetY + (Math.random() - 0.5) * 100);
        }, i * 150); // Stagger the strikes
    }
    
    // Wet, whooshy wave sound for tsunami
    playTsunamiWhoosh(soundToggle);
    
    // Remove golden border after all strikes complete and a brief delay
    setTimeout(() => {
        canvas.classList.remove('tsunami-active');
    }, numStrikes * 150 + 1000); // After all strikes plus 1 second
}

function triggerLightning(targetY) {
    // Find the actual top of the stack (highest row with any blocks)
    let stackTopY = ROWS * BLOCK_SIZE; // Default to bottom if no blocks
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y] && board[y][x]) {
                stackTopY = y * BLOCK_SIZE;
                break;
            }
        }
        if (stackTopY < ROWS * BLOCK_SIZE) break;
    }
    
    // Lightning should reach at least to the stack top, or the provided targetY, whichever is lower on screen
    const effectiveTargetY = Math.max(stackTopY, Math.min(targetY, ROWS * BLOCK_SIZE));
    
    console.log(`⚡🌩️ triggerLightning called! targetY=${targetY}, stackTopY=${stackTopY}, effectiveTargetY=${effectiveTargetY}`);
    
    // Single lightning strike (used for Strike bonus and as part of Tsunami)
    const centerX = canvas.width / 2 + (Math.random() - 0.5) * 150; // More horizontal spread
    const segments = [];
    let currentX = centerX;
    let currentY = 0;
    
    // Create jagged main lightning path - more dramatic with more segments
    while (currentY < effectiveTargetY) {
        currentY += 15 + Math.random() * 25; // Smaller steps = more jagged
        currentX += (Math.random() - 0.5) * 60; // More horizontal variation
        currentX = Math.max(20, Math.min(canvas.width - 20, currentX));
        segments.push({ x: currentX, y: Math.min(currentY, effectiveTargetY) });
    }
    
    // Create branch bolts - more of them for drama
    const branches = [];
    const numBranches = 4 + Math.floor(Math.random() * 4); // 4-7 branches
    
    for (let b = 0; b < numBranches; b++) {
        // Pick a random point on the main bolt to branch from
        const branchPoint = Math.floor(Math.random() * (segments.length - 2)) + 1;
        const startX = segments[branchPoint].x;
        const startY = segments[branchPoint].y;
        
        const branchSegments = [];
        let branchX = startX;
        let branchY = startY;
        const branchLength = 60 + Math.random() * 120; // Longer branches
        const branchDirection = (Math.random() > 0.5) ? 1 : -1; // Left or right
        
        while (branchY < startY + branchLength && branchY < canvas.height) {
            branchY += 12 + Math.random() * 20;
            branchX += branchDirection * (8 + Math.random() * 25);
            branchX = Math.max(10, Math.min(canvas.width - 10, branchX));
            branchSegments.push({ x: branchX, y: branchY });
        }
        
        branches.push({
            startX: startX,
            startY: startY,
            segments: branchSegments
        });
    }
    
    const lightningObj = {
        x: centerX,
        targetY: effectiveTargetY,
        segments: segments,
        branches: branches,
        startTime: Date.now(),
        duration: 600 // Slightly longer duration
    };
    
    lightningEffects.push(lightningObj);
    console.log(`⚡ Lightning object created and added to array. Array length: ${lightningEffects.length}, segments: ${segments.length}, branches: ${branches.length}`);
    
    // Play dramatic thunder crack
    playEnhancedThunder(soundToggle);
}

function drawPiece(piece, context = ctx, offsetX = 0, offsetY = 0, pixelOffsetY = 0) {
    if (!piece || !piece.shape || piece.shape.length === 0) return;
    
    const positions = [];
    piece.shape.forEach((row, y) => {
        if (row) {
            row.forEach((value, x) => {
                if (value) {
                    // Use fractional Y position for smooth rendering
                    const yPos = piece.y + y + offsetY + (pixelOffsetY / BLOCK_SIZE);
                    positions.push([piece.x + x + offsetX, yPos]);
                }
            });
        }
    });
    
    // Check if Oz mode is active (grayscale until landing)
    const isOzMode = challengeMode === 'oz' || activeChallenges.has('oz') || soRandomCurrentMode === 'oz';
    const displayColor = isOzMode ? colorToGrayscale(piece.color) : piece.color;
    
    drawSolidShape(context, positions, displayColor, BLOCK_SIZE, false, getFaceOpacity());
}

// Helper function to convert color to grayscale
function colorToGrayscale(color) {
    // Parse hex color
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Calculate luminance (weighted grayscale)
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    
    // Return as hex
    const grayHex = gray.toString(16).padStart(2, '0');
    return `#${grayHex}${grayHex}${grayHex}`;
}

function drawNextPiece() {
    // Save and restore image smoothing state
    const wasSmoothing = nextCtx.imageSmoothingEnabled;
    nextCtx.imageSmoothingEnabled = false;
    
    // Fully clear the canvas first
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    // The visible area is the lower-left portion (original 180x180 size)
    const visibleWidth = 180;
    const visibleHeight = 180;
    const visibleX = 0;
    const visibleY = nextCanvas.height - visibleHeight;
    
    // No background fill needed - wrapper provides the background

    // Draw pieces from back to front (furthest first, so closest renders on top)
    for (let i = nextPieceQueue.length - 1; i >= 0; i--) {
        const piece = nextPieceQueue[i];
        if (!piece || !piece.shape || piece.shape.length === 0 || !piece.shape[0]) continue;
        
        // Calculate scale based on position in queue (1.0 for first, smaller for others)
        // Pieces get progressively smaller as they go back
        const scale = 1.0 - (i * 0.18); // 1.0, 0.82, 0.64, 0.46
        
        // Calculate offset - pieces move up and to the right as they go back
        const offsetX = i * visibleWidth * 0.42;  // Shift right
        const offsetY = -i * visibleHeight * 0.24; // Shift up
        
        // Calculate opacity - pieces fade as they go back
        const opacity = 1.0 - (i * 0.15); // 1.0, 0.85, 0.70, 0.55
        
        // Calculate the actual size of the piece in blocks
        const pieceWidth = piece.shape[0].length;
        const pieceHeight = piece.shape.length;
        
        // For giant pieces (6-7 segments), scale down to fit
        const isGiantPiece = piece.type && piece.type.startsWith('giant');
        const gridSize = isGiantPiece ? 7 : 5;
        
        // Calculate block size based on VISIBLE area size, grid, and perspective scale
        const baseBlockSize = Math.floor(Math.min(visibleWidth, visibleHeight) / gridSize);
        const nextBlockSize = Math.floor(baseBlockSize * scale);
        
        // Calculate the total pixel size of the piece
        const pieceTotalWidth = pieceWidth * nextBlockSize;
        const pieceTotalHeight = pieceHeight * nextBlockSize;
        
        // Position first piece centered in visible area (lower-left of canvas)
        // Others offset up and to the right from there
        const baseCenterX = visibleX + (visibleWidth - pieceWidth * baseBlockSize) / 2;
        const baseCenterY = visibleY + (visibleHeight - pieceHeight * baseBlockSize) / 2;
        
        const pixelOffsetX = Math.floor(baseCenterX + offsetX + (pieceWidth * baseBlockSize - pieceTotalWidth) / 2);
        const pixelOffsetY = Math.floor(baseCenterY + offsetY + (pieceHeight * baseBlockSize - pieceTotalHeight) / 2);
        
        // Save context state and translate to position the piece
        nextCtx.save();
        nextCtx.globalAlpha = opacity;
        nextCtx.translate(pixelOffsetX, pixelOffsetY);
        
        // Collect all positions for the piece
        const positions = [];
        piece.shape.forEach((row, y) => {
            if (row) {
                row.forEach((value, x) => {
                    if (value) {
                        positions.push([x, y]);
                    }
                });
            }
        });
        
        // Draw as a single connected shape
        drawSolidShape(nextCtx, positions, piece.color, nextBlockSize, false, getFaceOpacity() * opacity);
        
        // Restore context state
        nextCtx.restore();
    }
    
    // Restore smoothing state
    nextCtx.imageSmoothingEnabled = wasSmoothing;
}

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
    
    // Draw tick marks and labels for SCORE HISTOGRAM on the left (skip in minimalist mode)
    if (!minimalistMode) {
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
    
    // Draw tick marks and labels on right side for color histogram (skip in minimalist mode)
    if (!minimalistMode) {
        histogramCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        histogramCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        histogramCtx.font = '12px Arial';
        histogramCtx.textAlign = 'left';
        histogramCtx.lineWidth = 1;
        
        const tickCount = 5;
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

function collides(piece, offsetX = 0, offsetY = 0) {
    if (!piece || !piece.shape) return true;
    
    return piece.shape.some((row, y) => {
        return row.some((value, x) => {
            if (value) {
                const newX = piece.x + x + offsetX;
                const newY = piece.y + y + offsetY;
                return newX < 0 || newX >= COLS || newY >= ROWS ||
                       (newY >= 0 && board[newY][newX]);
            }
            return false;
        });
    });
}

function getShadowYPosition(piece) {
    if (!piece || !piece.shape) return piece.y;
    
    let shadowY = piece.y;
    // Keep moving down until we hit something
    while (!collides(piece, 0, shadowY - piece.y + 1)) {
        shadowY++;
    }
    return shadowY;
}

function drawShadowPiece(piece) {
    if (!piece || !piece.shape || piece.shape.length === 0) return;
    
    // Check for shadowless challenge mode - shadow is standard, only hide if shadowless active
    const isShadowless = challengeMode === 'shadowless' || activeChallenges.has('shadowless');
    if (isShadowless) return;
    
    const shadowY = getShadowYPosition(piece);
    
    // Don't draw shadow if it's in the same position as the current piece
    if (shadowY === piece.y) return;
    
    // Draw simple solid shadow blocks with very low opacity
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#FFFFFF';
    
    piece.shape.forEach((row, y) => {
        if (row) {
            row.forEach((value, x) => {
                if (value) {
                    const px = (piece.x + x) * BLOCK_SIZE;
                    const py = (shadowY + y) * BLOCK_SIZE;
                    ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
                }
            });
        }
    });
    
    // Draw border only on outer edges with slightly higher opacity (lighter gray)
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    
    piece.shape.forEach((row, y) => {
        if (row) {
            row.forEach((value, x) => {
                if (value) {
                    const px = (piece.x + x) * BLOCK_SIZE;
                    const py = (shadowY + y) * BLOCK_SIZE;
                    
                    // Check adjacent blocks to determine outer edges
                    const hasTop = y > 0 && row && piece.shape[y-1] && piece.shape[y-1][x];
                    const hasBottom = y < piece.shape.length - 1 && piece.shape[y+1] && piece.shape[y+1][x];
                    const hasLeft = x > 0 && row[x-1];
                    const hasRight = x < row.length - 1 && row[x+1];
                    
                    // Draw only outer edges
                    ctx.beginPath();
                    if (!hasTop) {
                        ctx.moveTo(px, py);
                        ctx.lineTo(px + BLOCK_SIZE, py);
                    }
                    if (!hasBottom) {
                        ctx.moveTo(px, py + BLOCK_SIZE);
                        ctx.lineTo(px + BLOCK_SIZE, py + BLOCK_SIZE);
                    }
                    if (!hasLeft) {
                        ctx.moveTo(px, py);
                        ctx.lineTo(px, py + BLOCK_SIZE);
                    }
                    if (!hasRight) {
                        ctx.moveTo(px + BLOCK_SIZE, py);
                        ctx.lineTo(px + BLOCK_SIZE, py + BLOCK_SIZE);
                    }
                    ctx.stroke();
                }
            });
        }
    });
    
    ctx.restore();
}

function mergePiece() {
    if (!currentPiece || !currentPiece.shape) return;
    
    // Check for Rubber & Glue mode (either standalone or in combo)
    const isRubberMode = challengeMode === 'rubber' || activeChallenges.has('rubber') || soRandomCurrentMode === 'rubber';
    
    if (isRubberMode) {
        // First check if this placement would trigger special events
        // If so, don't bounce regardless of color touching
        if (wouldTriggerSpecialEvent(currentPiece)) {
            console.log('🎯 Special event detected - piece will stick (no bounce)');
            // Fall through to normal merge
        } else {
            // Check if piece touches any same-colored blob ("glue")
            let touchesSameColor = false;
            currentPiece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        const boardY = currentPiece.y + y;
                        const boardX = currentPiece.x + x;
                        if (boardY >= 0) {
                            // Check adjacent cells for same color
                            const checkPositions = [
                                [boardX - 1, boardY], [boardX + 1, boardY],
                                [boardX, boardY - 1], [boardX, boardY + 1]
                            ];
                            for (let [checkX, checkY] of checkPositions) {
                                if (checkX >= 0 && checkX < COLS && checkY >= 0 && checkY < ROWS) {
                                    if (board[checkY][checkX] === currentPiece.color) {
                                        touchesSameColor = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (touchesSameColor) return;
                });
            });
            
            // If doesn't touch same color and won't trigger events, BOUNCE! ("rubber")
            if (!touchesSameColor) {
                triggerBouncePiece();
                return; // Don't merge the piece
            }
        }
    }
    
    // Normal merge
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const boardY = currentPiece.y + y;
                const boardX = currentPiece.x + x;
                if (boardY >= 0) {
                    board[boardY][boardX] = currentPiece.color;
                    isRandomBlock[boardY][boardX] = false; // Mark as player-placed
                    isLatticeBlock[boardY][boardX] = false; // Player-placed blocks are not lattice blocks
                }
            }
        });
    });
    
    // Yes, And... mode: Spawn random limbs after piece lands
    const isYesAndMode = challengeMode === 'yesand' || activeChallenges.has('yesand') || soRandomCurrentMode === 'yesand';
    if (isYesAndMode) {
        spawnYesAndLimbs(currentPiece);
    }
    
    // Trigger Phantom mode fade (either standalone or in combo)
    const isPhantomMode = challengeMode === 'phantom' || activeChallenges.has('phantom') || soRandomCurrentMode === 'phantom';
    if (isPhantomMode) {
        triggerPhantomFade();
    }
}

// ============================================
// CHALLENGE MODE FUNCTIONS
// ============================================

function spawnYesAndLimbs(piece) {
    // Yes, And... mode: Spawn random limb(s) adjacent to the piece or its blob
    
    // First, find the blob that this piece is now part of
    const blobs = getAllBlobs();
    let targetBlob = null;
    
    // Find which blob contains any of the piece's blocks
    for (const blob of blobs) {
        const containsPieceBlock = blob.positions.some(([bx, by]) => {
            return piece.shape.some((row, y) => {
                return row.some((value, x) => {
                    if (!value) return false;
                    const boardY = piece.y + y;
                    const boardX = piece.x + x;
                    return boardX === bx && boardY === by;
                });
            });
        });
        
        if (containsPieceBlock) {
            targetBlob = blob;
            break;
        }
    }
    
    if (!targetBlob || targetBlob.positions.length === 0) return;
    
    // Find all available spaces adjacent to the blob
    const adjacentSpaces = [];
    const checkedSpaces = new Set();
    
    for (const [bx, by] of targetBlob.positions) {
        // Check all 4 directions (up, down, left, right)
        const directions = [
            [0, -1],  // up
            [0, 1],   // down
            [-1, 0],  // left
            [1, 0]    // right
        ];
        
        for (const [dx, dy] of directions) {
            const adjX = bx + dx;
            const adjY = by + dy;
            const key = `${adjX},${adjY}`;
            
            // Check if space is valid, empty, and not already checked
            if (adjX >= 0 && adjX < COLS && 
                adjY >= 0 && adjY < ROWS && 
                board[adjY][adjX] === null &&
                !checkedSpaces.has(key)) {
                
                adjacentSpaces.push([adjX, adjY]);
                checkedSpaces.add(key);
            }
        }
    }
    
    // If no adjacent spaces available, do nothing
    if (adjacentSpaces.length === 0) {
        console.log('🎭 Yes, And... found no available spaces for limbs');
        return;
    }
    
    // Spawn 1 random limb with fade-in animation
    const numLimbs = 1;
    const spawnedLimbs = [];
    
    for (let i = 0; i < numLimbs && adjacentSpaces.length > 0; i++) {
        // Pick a random available space
        const randomIndex = Math.floor(Math.random() * adjacentSpaces.length);
        const [limbX, limbY] = adjacentSpaces.splice(randomIndex, 1)[0];
        
        // Place the limb on the board with fade-in animation
        board[limbY][limbX] = targetBlob.color;
        isRandomBlock[limbY][limbX] = false;
        fadingBlocks[limbY][limbX] = { opacity: 0.01, scale: 0.15 }; // Start small and nearly invisible
        spawnedLimbs.push([limbX, limbY]);
    }
    
    console.log(`🎭 Yes, And... spawned ${spawnedLimbs.length} limb(s) at:`, spawnedLimbs);
}

function wouldTriggerSpecialEvent(piece) {
    // Temporarily place the piece on a copy of the board to check for events
    const testBoard = board.map(row => [...row]);
    
    // Place piece on test board
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const boardY = piece.y + y;
                const boardX = piece.x + x;
                if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
                    testBoard[boardY][boardX] = piece.color;
                }
            }
        });
    });
    
    // Check for completed lines
    for (let y = 0; y < ROWS; y++) {
        if (testBoard[y] && testBoard[y].every(cell => cell !== null)) {
            console.log('🚫 Bounce prevented: Would complete line at row ' + y);
            return true; // Would complete a line
        }
    }
    
    // Check for tsunamis (blob spanning full width)
    const blobs = getAllBlobsFromBoard(testBoard);
    for (const blob of blobs) {
        const xPositions = blob.positions.map(p => p[0]);
        const uniqueX = [...new Set(xPositions)];
        if (uniqueX.length === COLS) {
            console.log('🚫 Bounce prevented: Would trigger tsunami');
            return true; // Would trigger tsunami
        }
    }
    
    // Check for black holes (one blob enveloping another)
    const blackHoles = detectBlackHoles(blobs);
    if (blackHoles.length > 0) {
        console.log('🚫 Bounce prevented: Would trigger black hole');
        return true; // Would trigger black hole
    }
    
    // Check for volcanoes (L-shaped lava blob) - DISABLED: isLShape function not defined
    // const lavaBlobs = blobs.filter(b => b.color === volcanoLavaColor);
    // for (const lavaBlob of lavaBlobs) {
    //     if (isLShape(lavaBlob)) {
    //         console.log('🚫 Bounce prevented: Would trigger volcano');
    //         return true; // Would trigger volcano
    //     }
    // }
    
    return false; // No special events would trigger
}

function triggerBouncePiece() {
    console.log('🏀 BOUNCE! Piece doesn\'t touch same color');
    
    // Analyze what the piece is landing on
    const landingAnalysis = analyzeLandingSurface(currentPiece);
    console.log('📊 Landing analysis:', landingAnalysis);
    
    // Calculate bounce parameters based on landing surface
    const blobSize = landingAnalysis.totalSupportBlocks;
    const overhangLeft = landingAnalysis.overhangLeft;
    const overhangRight = landingAnalysis.overhangRight;
    
    // Bounce height proportional to blob size (more support = higher bounce)
    // REDUCED BY HALF for more reasonable bouncing
    const baseVelocity = -0.4;  // Halved from -0.8
    const sizeMultiplier = Math.sqrt(blobSize) * 0.15; // Halved from 0.3
    const bounceVy = baseVelocity - sizeMultiplier;
    
    // Horizontal velocity based on overhang
    // More overhang = more horizontal movement
    let bounceVx = 0;
    if (overhangLeft > 0 && overhangRight === 0) {
        // Piece overhangs on left, bounce left
        bounceVx = -0.1 * overhangLeft;  // Halved from -0.2
    } else if (overhangRight > 0 && overhangLeft === 0) {
        // Piece overhangs on right, bounce right  
        bounceVx = 0.1 * overhangRight;  // Halved from 0.2
    } else if (overhangLeft > 0 && overhangRight > 0) {
        // Overhangs both sides, bounce based on which is larger
        const netOverhang = overhangRight - overhangLeft;
        bounceVx = 0.075 * netOverhang;  // Halved from 0.15
    }
    // No overhang = straight up
    
    console.log(`🎯 Bounce physics: height=${(-bounceVy).toFixed(2)} (from ${blobSize} blocks), horizontal=${bounceVx.toFixed(2)}`);
    
    // Store current piece data with calculated physics
    const bouncePiece = {
        shape: currentPiece.shape,
        color: currentPiece.color,
        x: currentPiece.x,
        y: currentPiece.y,
        vy: bounceVy,
        vx: bounceVx,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 4, // Slower spin
        gravity: 0.08, // Lower gravity for gentler bounce
        bounceCount: 0,
        maxBounces: blobSize > 10 ? 2 : 1 // More bounces for bigger blobs
    };
    
    bouncingPieces.push(bouncePiece);
    playSoundEffect('drop', soundToggle); // Play bounce sound
    
    // Current piece will be removed, spawn a new one
    currentPiece = null;
}

function analyzeLandingSurface(piece) {
    // Analyze what blocks are directly under the piece
    const analysis = {
        totalSupportBlocks: 0,
        overhangLeft: 0,
        overhangRight: 0,
        supportingColors: new Set()
    };
    
    // Find all piece positions
    const piecePositions = [];
    let minX = Infinity, maxX = -Infinity;
    
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const boardX = piece.x + x;
                const boardY = piece.y + y;
                piecePositions.push({x: boardX, y: boardY});
                minX = Math.min(minX, boardX);
                maxX = Math.max(maxX, boardX);
            }
        });
    });
    
    // Check what's supporting each block
    const supportMap = new Map(); // x position -> has support
    
    for (let x = minX; x <= maxX; x++) {
        supportMap.set(x, false);
    }
    
    piecePositions.forEach(pos => {
        // Check what's directly below this block
        const below = pos.y + 1;
        
        if (below >= ROWS) {
            // At bottom of well
            supportMap.set(pos.x, true);
            analysis.totalSupportBlocks++;
        } else if (below >= 0 && pos.x >= 0 && pos.x < COLS && board[below][pos.x]) {
            // Supported by a block
            supportMap.set(pos.x, true);
            analysis.totalSupportBlocks++;
            analysis.supportingColors.add(board[below][pos.x]);
            
            // Count all connected blocks of the supporting blob
            const supportBlob = getConnectedBlob(pos.x, below, board[below][pos.x]);
            analysis.totalSupportBlocks += Math.floor(supportBlob.size / 2); // Partial credit for blob size
        }
    });
    
    // Calculate overhangs
    for (let x = minX; x <= maxX; x++) {
        const hasBlock = piecePositions.some(p => p.x === x);
        const hasSupport = supportMap.get(x);
        
        if (hasBlock && !hasSupport) {
            if (x < (minX + maxX) / 2) {
                analysis.overhangLeft++;
            } else {
                analysis.overhangRight++;
            }
        }
    }
    
    // Minimum 1 support block to avoid divide by zero
    analysis.totalSupportBlocks = Math.max(1, analysis.totalSupportBlocks);
    
    return analysis;
}

function getConnectedBlob(startX, startY, color) {
    // Quick flood fill to find connected blob size
    const visited = new Set();
    const stack = [[startX, startY]];
    
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const key = `${x},${y}`;
        
        if (visited.has(key)) continue;
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
        if (board[y][x] !== color) continue;
        
        visited.add(key);
        
        // Add adjacent cells
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    return visited;
}

function updateBouncingPieces() {
    bouncingPieces = bouncingPieces.filter(piece => {
        // Store old position for rollback if needed
        const oldX = piece.x;
        const oldY = piece.y;
        
        // Apply gravity
        piece.vy += piece.gravity;
        piece.y += piece.vy;
        piece.x += piece.vx;
        piece.rotation += piece.rotationSpeed;
        
        // Check horizontal bounds and prevent wall clipping
        let minX = Infinity, maxX = -Infinity;
        piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    const boardX = piece.x + x;
                    minX = Math.min(minX, boardX);
                    maxX = Math.max(maxX, boardX);
                }
            });
        });
        
        // Keep piece within bounds
        if (minX < 0) {
            piece.x -= minX; // Shift right
            piece.vx = Math.abs(piece.vx) * 0.5; // Bounce off left wall
        } else if (maxX >= COLS) {
            piece.x -= (maxX - COLS + 1); // Shift left
            piece.vx = -Math.abs(piece.vx) * 0.5; // Bounce off right wall
        }
        
        // Check if landed
        if (piece.vy > 0) { // Moving down
            const landed = checkBounceCollision(piece);
            if (landed) {
                // Snap to grid position for clean landing
                piece.y = Math.floor(piece.y);
                piece.x = Math.round(piece.x);
                
                piece.bounceCount++;
                
                if (piece.bounceCount >= piece.maxBounces) {
                    // Final landing - validate position before merging
                    if (isValidBouncePosition(piece)) {
                        mergeBouncingPiece(piece);
                    } else {
                        // Try to find a nearby valid position
                        if (!findValidLandingPosition(piece)) {
                            console.log('⚠️ Bounce piece could not find valid landing - removing');
                        }
                    }
                    return false; // Remove from bouncing array
                } else {
                    // Bounce again (smaller bounce)
                    piece.vy = -0.8; // Much smaller second bounce
                    piece.vx = (Math.random() - 0.5) * 0.1;
                    piece.rotationSpeed = (Math.random() - 0.5) * 3;
                    playSoundEffect('drop', soundToggle);
                }
            }
        }
        
        // Remove if off screen
        if (piece.y > ROWS + 5) return false;
        
        return true; // Keep bouncing
    });
}

function checkBounceCollision(piece) {
    // Check if any block of the piece would collide with the board or bottom
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x]) {
                const boardY = Math.floor(piece.y + y);
                const boardX = Math.floor(piece.x + x);
                
                // Check if hit bottom of well
                if (boardY >= ROWS - 1) {
                    return true;
                }
                
                // Check if there's a block directly below this position
                if (boardY >= -1 && boardY < ROWS - 1 && boardX >= 0 && boardX < COLS) {
                    // Only check below if we're in a valid row
                    if (boardY + 1 >= 0 && boardY + 1 < ROWS) {
                        if (board[boardY + 1][boardX]) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    return false;
}

function isValidBouncePosition(piece) {
    // Check if the piece can actually be placed at its current position
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x]) {
                const boardY = Math.floor(piece.y + y);
                const boardX = Math.floor(piece.x + x);
                
                // Check bounds
                if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
                    return false;
                }
                
                // Check for overlap with existing pieces (allow negative Y for pieces at top)
                if (boardY >= 0 && board[boardY][boardX]) {
                    return false;
                }
            }
        }
    }
    return true;
}

function findValidLandingPosition(piece) {
    // Try to find a nearby valid position by moving the piece slightly
    const originalX = piece.x;
    const originalY = piece.y;
    
    // First, try to move piece down to rest on something
    while (piece.y < ROWS && !checkBounceCollision(piece)) {
        piece.y += 0.5;
    }
    
    // Back up one step if we went through something
    if (piece.y > originalY) {
        piece.y = Math.floor(piece.y);
    }
    
    // Try small horizontal adjustments if needed
    for (let xOffset = 0; xOffset <= 2; xOffset++) {
        for (let xDir of [1, -1]) {
            if (xOffset === 0 && xDir === -1) continue; // Skip duplicate center check
            
            piece.x = originalX + (xOffset * xDir);
            
            // Make sure piece is within bounds
            let minX = Infinity, maxX = -Infinity;
            piece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        const boardX = piece.x + x;
                        minX = Math.min(minX, boardX);
                        maxX = Math.max(maxX, boardX);
                    }
                });
            });
            
            if (minX >= 0 && maxX < COLS && isValidBouncePosition(piece)) {
                mergeBouncingPiece(piece);
                return true;
            }
        }
    }
    
    // Couldn't find valid position
    piece.x = originalX;
    piece.y = originalY;
    return false;
}

function mergeBouncingPiece(piece) {
    console.log('🎯 Merging bouncing piece with shape:', piece.shape);
    
    // Store original shape and position
    const originalShape = piece.shape;
    const originalBlockCount = originalShape.flat().filter(v => v).length;
    
    let shape = originalShape;
    let finalX = Math.round(piece.x);
    let finalY = Math.round(piece.y);
    
    console.log(`Initial landing position: x=${finalX}, y=${finalY}`);
    
    // First, ensure piece is within horizontal bounds
    let pieceWidth = shape[0].length;
    let pieceHeight = shape.length;
    
    // Check left bound
    if (finalX < 0) {
        finalX = 0;
        console.log(`Adjusted X from left wall collision to ${finalX}`);
    }
    
    // Check right bound
    if (finalX + pieceWidth > COLS) {
        finalX = COLS - pieceWidth;
        console.log(`Adjusted X from right wall collision to ${finalX}`);
    }
    
    // Find a valid landing position where no blocks overlap
    let validY = finalY;
    let searchUp = true;
    let searchDistance = 0;
    const maxSearchDistance = 10;  // Increased from 5
    let foundValidPosition = false;
    
    while (searchDistance < maxSearchDistance) {
        let canPlace = true;
        
        // Check if all blocks can be placed at this position
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    const boardX = finalX + x;
                    const boardY = validY + y;
                    
                    // Check bounds
                    if (boardX < 0 || boardX >= COLS || boardY < 0 || boardY >= ROWS) {
                        canPlace = false;
                        break;
                    }
                    
                    // Check for overlap
                    if (board[boardY][boardX]) {
                        canPlace = false;
                        break;
                    }
                }
            }
            if (!canPlace) break;
        }
        
        if (canPlace) {
            finalY = validY;
            foundValidPosition = true;
            console.log(`Found valid position at y=${finalY}`);
            break;
        }
        
        // Alternate searching up and down
        searchDistance++;
        if (searchUp) {
            validY = finalY - searchDistance;
        } else {
            validY = finalY + searchDistance;
        }
        searchUp = !searchUp;
    }
    
    // If we couldn't find a valid position, force place at top of screen
    if (!foundValidPosition) {
        console.log('⚠️ No valid position found, placing at top of well');
        finalY = 0;
        
        // Clear any overlapping blocks to ensure piece can be placed
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    const boardX = finalX + x;
                    const boardY = finalY + y;
                    if (boardX >= 0 && boardX < COLS && boardY >= 0 && boardY < ROWS) {
                        if (board[boardY][boardX]) {
                            console.log(`Clearing overlap at (${boardX}, ${boardY})`);
                            board[boardY][boardX] = null;
                        }
                    }
                }
            }
        }
    }
    
    // Place the piece at the valid position
    console.log(`Final placement position: x=${finalX}, y=${finalY}`);
    
    let placedBlocks = 0;
    let totalBlocksInShape = 0;
    
    // Count total blocks in shape
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                totalBlocksInShape++;
            }
        }
    }
    
    // Place all blocks
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                const boardX = finalX + x;
                const boardY = finalY + y;
                
                if (boardX >= 0 && boardX < COLS && boardY >= 0 && boardY < ROWS) {
                    board[boardY][boardX] = piece.color;  // Always place, even if something is there
                    isRandomBlock[boardY][boardX] = false;
                    placedBlocks++;
                } else {
                    console.log(`⚠️ Block at (${boardX}, ${boardY}) is out of bounds`);
                }
            }
        }
    }
    
    console.log(`📦 Placed ${placedBlocks}/${totalBlocksInShape} blocks`);
    
    if (placedBlocks !== totalBlocksInShape) {
        console.error(`⚠️ WARNING: Could not place all blocks! Only ${placedBlocks} of ${totalBlocksInShape}`);
    }
    
    console.log('🎯 Bouncing piece landed and merged');
    
    // Yes, And... mode: Spawn random limbs after bounced piece lands
    const isYesAndMode = challengeMode === 'yesand' || activeChallenges.has('yesand') || soRandomCurrentMode === 'yesand';
    if (isYesAndMode) {
        // Create a temporary piece object for spawnYesAndLimbs
        const landedPiece = {
            shape: shape,
            x: finalX,
            y: finalY,
            color: piece.color
        };
        spawnYesAndLimbs(landedPiece);
    }
    
    // CRITICAL: Apply gravity to ensure no floating pieces
    // Use the full gravity system instead of just local gravity
    console.log('🌍 Applying gravity after bounce landing...');
    applyGravity();
    
    // Check for special formations after gravity settles
    // These will be checked after gravity animation completes
}

function rotateShape(shape) {
    const rows = shape.length;
    const cols = shape[0].length;
    const rotated = Array(cols).fill().map(() => Array(rows).fill(0));
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            rotated[x][rows - 1 - y] = shape[y][x];
        }
    }
    return rotated;
}


function applyLocalGravityToBounced(pieceColor) {
    console.log('🌍 Applying gravity check to bounced piece blocks...');
    
    // Find all blocks of the piece color that might be floating
    let blocksToCheck = [];
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] === pieceColor) {
                blocksToCheck.push({x, y, color: pieceColor});
            }
        }
    }
    
    // Keep dropping blocks until they all rest on something
    let changesMade = true;
    let passes = 0;
    
    while (changesMade && passes < 20) { // Safety limit
        changesMade = false;
        passes++;
        
        // Check each block from bottom to top
        blocksToCheck.sort((a, b) => b.y - a.y);
        
        for (let block of blocksToCheck) {
            // Skip if this block no longer exists at this position
            if (board[block.y][block.x] !== block.color) continue;
            
            // Check if this block can fall
            let canFall = true;
            
            // Can't fall if at bottom
            if (block.y >= ROWS - 1) {
                canFall = false;
            } 
            // Can't fall if there's something directly below
            else if (board[block.y + 1][block.x] !== null) {
                canFall = false;
            }
            
            if (canFall) {
                // Move block down
                board[block.y + 1][block.x] = block.color;
                board[block.y][block.x] = null;
                
                // Update isRandomBlock array too
                isRandomBlock[block.y + 1][block.x] = isRandomBlock[block.y][block.x];
                isRandomBlock[block.y][block.x] = false;
                
                // Update block position for next pass
                block.y++;
                changesMade = true;
                
                console.log(`  ⬇️ Dropped ${block.color} block from row ${block.y - 1} to ${block.y}`);
            }
        }
    }
    
    if (passes > 1) {
        console.log(`  ✅ Gravity applied in ${passes} passes`);
    }
}

function drawBouncingPieces() {
    bouncingPieces.forEach(piece => {
        ctx.save();
        
        // Use rounded positions for consistent block rendering
        const renderX = Math.round(piece.x);
        const renderY = Math.round(piece.y);
        
        // Calculate center of the piece shape
        const shapeWidth = piece.shape[0].length;
        const shapeHeight = piece.shape.length;
        const centerX = renderX + shapeWidth / 2;
        const centerY = renderY + shapeHeight / 2;
        
        // Translate to center for rotation
        ctx.translate(centerX * BLOCK_SIZE, centerY * BLOCK_SIZE);
        
        // Apply rotation
        ctx.rotate(piece.rotation * Math.PI / 180);
        
        // Translate back
        ctx.translate(-centerX * BLOCK_SIZE, -centerY * BLOCK_SIZE);
        
        // Convert piece shape to positions array for drawSolidShape
        const positions = [];
        piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    positions.push([renderX + x, renderY + y]);
                }
            });
        });
        
        // Draw the piece with proper 3D beveling
        ctx.globalAlpha = 0.95;
        drawSolidShape(ctx, positions, piece.color, BLOCK_SIZE, false, getFaceOpacity());
        
        ctx.restore();
    });
}

function triggerPhantomFade() {
    // Clear any existing fade
    if (phantomFadeInterval) {
        clearInterval(phantomFadeInterval);
        phantomFadeInterval = null;
    }
    
    // Make stack fully visible instantly
    phantomOpacity = 1.0;
    
    // Start fading after a brief delay
    setTimeout(() => {
        // Fade from 1.0 to 0.0 over 0.5 seconds (500ms)
        const fadeStartTime = Date.now();
        const fadeDuration = 500; // Changed from 3000ms to 500ms
        
        phantomFadeInterval = setInterval(() => {
            const elapsed = Date.now() - fadeStartTime;
            const progress = Math.min(elapsed / fadeDuration, 1);
            
            // Ease out: starts fast, slows down
            phantomOpacity = 1.0 - progress;
            
            if (progress >= 1) {
                clearInterval(phantomFadeInterval);
                phantomFadeInterval = null;
                phantomOpacity = 0;
            }
        }, 16); // ~60fps
    }, 10);
}

// ============================================
// END CHALLENGE MODE FUNCTIONS
// ============================================

function animateClearLines(completedRows) {
    const animation = { cells: [], startTime: Date.now(), duration: 500 };

    completedRows.forEach(row => {
        const centerX = COLS / 2;
        for (let x = 0; x < COLS; x++) {
            if (board[row][x]) {
                animation.cells.push({
                    x: x,
                    y: row,
                    color: board[row][x],
                    distance: Math.abs(x - centerX),
                    removed: false,
                    alpha: 1
                });
            }
        }
    });

    animation.cells.sort((a, b) => a.distance - b.distance);
    lineAnimations.push(animation);
    return animation;
}

function updateLineAnimations() {
    const now = Date.now();
    lineAnimations = lineAnimations.filter(anim => {
        const elapsed = now - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1);

        anim.cells.forEach((cell, index) => {
            const cellProgress = Math.max(0, progress - (index / anim.cells.length) * 0.5) * 2;
            if (cellProgress >= 1) {
                cell.removed = true;
            } else {
                cell.alpha = 1 - cellProgress;
            }
        });

        return progress < 1;
    });
}

function checkForSpecialFormations() {
    // Check for special formations immediately after piece placement
    // Priority: Volcano > Black Hole > Tsunami
    
    const allBlobs = getAllBlobs();
    let foundVolcano = false;
    let foundTsunami = false;
    let foundBlackHole = false;
    let volcanoData = [];
    let tsunamiBlobs = [];
    let blackHoleData = [];
    
    // Check for Volcanoes (blob at bottom completely enveloped by another)
    // Skip if a volcano is already active to prevent duplicate counting
    if (!volcanoActive) {
        const volcanoes = detectVolcanoes(allBlobs);
        if (volcanoes.length > 0) {
            foundVolcano = true;
            volcanoData = volcanoes;
        }
    }
    
    // Check for Black Holes (one blob enveloping another of different color)
    // Skip if a black hole is already active to prevent duplicate counting
    if (!foundVolcano && !blackHoleActive) {
        const blackHoles = detectBlackHoles(allBlobs);
        if (blackHoles.length > 0) {
            foundBlackHole = true;
            blackHoleData = blackHoles;
        }
    }
    
    // Check for Tsunamis (blobs spanning full width)
    // Skip if a tsunami is already animating to prevent duplicate counting
    if (!foundVolcano && !foundBlackHole && !tsunamiAnimating) {
        allBlobs.forEach(blob => {
            const minX = Math.min(...blob.positions.map(p => p[0]));
            const maxX = Math.max(...blob.positions.map(p => p[0]));
            const spansWidth = (minX === 0 && maxX === COLS - 1);
            if (spansWidth) {
                foundTsunami = true;
                tsunamiBlobs.push(blob);
            }
        });
    }
    
    // If we found special formations, trigger them immediately
    // Priority: Volcano > Black Hole > Tsunami
    if (foundVolcano) {
        // Trigger volcano animation for the first one
        const v = volcanoData[0];
        
        // Start the volcano warming phase
        // (Column clearing will happen when warming transitions to eruption)
        triggerVolcano(v.lavaBlob, v.eruptionColumn, v.edgeType);
        volcanoCount++;
        
        // Score calculation - VOLCANO SCORING:
        // Inner lava blob: size³ × 500
        // Outer surrounding blob: No points (just the trigger)
        const lavaSize = v.lavaBlob.positions.length;
        const lavaPoints = lavaSize * lavaSize * lavaSize * 500;
        
        const finalVolcanoScore = applyScoreModifiers(lavaPoints * level);
        score += finalVolcanoScore;
        
        // Update histogram only for lava blob
        updateHistogramWithBlob(volcanoLavaColor, lavaSize);
        scoreHistogramTarget = finalVolcanoScore;
        if (finalVolcanoScore > scoreHistogramMaxScale) {
            scoreHistogramMaxScale = Math.ceil(finalVolcanoScore / 1000) * 1000;
        }
        
        updateStats();
        
    } else if (foundBlackHole) {
            // Trigger black hole animation for the first one
            const bh = blackHoleData[0];
            triggerBlackHole(bh.innerBlob, bh.outerBlob);
            blackHoleCount++;
            
            // Score calculation - BLACK HOLE SCORING:
            // Inner blob (black hole core): size³ × 800
            // Outer blob (sucked in): size³ × 800
            // Both blobs score equally at 800× multiplier (hardest achievement!)
            const outerSize = bh.outerBlob.positions.length;
            const innerSize = bh.innerBlob.positions.length;
            const innerPoints = innerSize * innerSize * innerSize * 800;
            const outerPoints = outerSize * outerSize * outerSize * 800;
            const blackHolePoints = innerPoints + outerPoints;
            
            const finalBlackHoleScore = applyScoreModifiers(blackHolePoints * level);
            score += finalBlackHoleScore;
            
            // Update histograms
            updateHistogramWithBlob(bh.outerBlob.color, outerSize);
            updateHistogramWithBlob(bh.innerBlob.color, innerSize);
            scoreHistogramTarget = finalBlackHoleScore;
            if (finalBlackHoleScore > scoreHistogramMaxScale) {
                scoreHistogramMaxScale = Math.ceil(finalBlackHoleScore / 1000) * 1000;
            }
            
            updateStats();
            
        } else if (foundTsunami) {
            // Trigger tsunami animation for the first one
            const blob = tsunamiBlobs[0];
            
            // Trigger visual effects (lightning and border)
            const avgY = blob.positions.reduce((sum, p) => sum + p[1], 0) / blob.positions.length;
            triggerTsunami(avgY * BLOCK_SIZE);
            
            // Trigger the actual clearing animation
            triggerTsunamiAnimation(blob);
            tsunamiCount++;
            
            // Score calculation - TSUNAMI SCORING:
            // Points = (blob size)³ × 200
            const blobSize = blob.positions.length;
            let tsunamiPoints = blobSize * blobSize * blobSize * 200;
            const finalTsunamiScore = applyScoreModifiers(tsunamiPoints * level);
            score += finalTsunamiScore;
            
            // Update histograms
            updateHistogramWithBlob(blob.color, blobSize);
            scoreHistogramTarget = finalTsunamiScore;
            if (finalTsunamiScore > scoreHistogramMaxScale) {
                scoreHistogramMaxScale = Math.ceil(finalTsunamiScore / 1000) * 1000;
            }
            
            updateStats();
        }
}

// ============================================================================
// BLOCKCHAINSTORM - COMPLETE GRAVITY SYSTEM (V2 - REWRITE)
// ============================================================================
// Algorithm:
// 1. Create phantom board
// 2. Identify all blobs with unique IDs and starting positions
// 3. Detect interlocking (blobs that wrap around each other in columns)
// 4. Phase 1: Move compound (interlocked) blobs together
// 5. Phase 2: Move individual blobs independently
// 6. Record journey destinations
// 7. Animate from start to destination
// ============================================================================

/**
 * STEP 1: Create a complete copy of the board
 */
function createPhantomBoard(sourceBoard, sourceIsRandom, sourceIsLattice) {
    console.log('📋 STEP 1: Creating phantom board...');
    
    const phantom = {
        board: sourceBoard.map(row => [...row]),
        isRandom: sourceIsRandom.map(row => row ? [...row] : Array(COLS).fill(false)),
        isLattice: sourceIsLattice.map(row => row ? [...row] : Array(COLS).fill(false))
    };
    
    // Count non-null blocks
    let blockCount = 0;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (phantom.board[y][x] !== null) blockCount++;
        }
    }
    
    console.log(`  ✓ Phantom board created with ${blockCount} blocks`);
    return phantom;
}

/**
 * STEP 2: Identify every unique color blob on the phantom board
 * Returns array of blob objects with unique IDs
 */
function identifyAllBlobs(phantom) {
    console.log('\n📋 STEP 2: Identifying all blobs...');
    
    const visited = Array(ROWS).fill(null).map(() => Array(COLS).fill(false));
    const blobs = [];
    let blobIdCounter = 0;
    
    // Flood fill to find connected same-color blocks
    function floodFill(startX, startY, color) {
        const positions = [];
        const stack = [[startX, startY]];
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            
            // Bounds check
            if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
            
            // Already visited or different color
            if (visited[y][x] || phantom.board[y][x] !== color) continue;
            
            visited[y][x] = true;
            positions.push({x, y});
            
            // Check all 4 directions
            stack.push([x + 1, y]);
            stack.push([x - 1, y]);
            stack.push([x, y + 1]);
            stack.push([x, y - 1]);
        }
        
        return positions;
    }
    
    // Scan the board for unvisited blocks
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (!visited[y][x] && phantom.board[y][x] !== null) {
                const color = phantom.board[y][x];
                const positions = floodFill(x, y, color);
                
                if (positions.length > 0) {
                    // Filter out lattice-only blobs
                    const hasNonLattice = positions.some(pos => 
                        !phantom.isLattice[pos.y] || !phantom.isLattice[pos.y][pos.x]
                    );
                    
                    // Filter out random/hailstorm blocks
                    const nonRandomPositions = positions.filter(pos =>
                        !phantom.isRandom[pos.y] || !phantom.isRandom[pos.y][pos.x]
                    );
                    
                    if (hasNonLattice && nonRandomPositions.length > 0) {
                        const blobId = `blob_${blobIdCounter++}`;
                        
                        // Store blob data
                        const blob = {
                            id: blobId,
                            color: color,
                            positions: nonRandomPositions,
                            startPositions: nonRandomPositions.map(p => ({...p})), // Deep copy for journey
                            isCompound: false,
                            compoundWith: []
                        };
                        
                        blobs.push(blob);
                        
                        const posStr = positions.length > 5 
                            ? positions.slice(0,3).map(p=>`(${p.x},${p.y})`).join(',')+'...' 
                            : positions.map(p=>`(${p.x},${p.y})`).join(',');
                        console.log(`  Blob ${blobId}: ${nonRandomPositions.length} blocks, color=${color}, positions=${posStr}`);
                    }
                }
            }
        }
    }
    
    console.log(`  ✓ Found ${blobs.length} unique blobs`);
    return blobs;
}

/**
 * STEP 3: Check for interlocking blobs
 * A blob interlocks with another if there exists a column where:
 * - This blob has blocks in that column
 * - Another blob has blocks BOTH above AND below this blob in that same column
 */
function detectInterlocking(blobs) {
    console.log('\n📋 STEP 3: Detecting interlocking blobs...');
    
    const compoundGroups = [];
    const blobInCompound = new Set();
    
    for (let i = 0; i < blobs.length; i++) {
        if (blobInCompound.has(blobs[i].id)) continue;
        
        const blobA = blobs[i];
        const interlocked = [blobA];
        blobInCompound.add(blobA.id);
        
        // Get all columns this blob occupies
        const columnsA = new Map();
        blobA.positions.forEach(pos => {
            if (!columnsA.has(pos.x)) columnsA.set(pos.x, []);
            columnsA.get(pos.x).push(pos.y);
        });
        
        // Check each other blob
        for (let j = 0; j < blobs.length; j++) {
            if (i === j || blobInCompound.has(blobs[j].id)) continue;
            
            const blobB = blobs[j];
            let isInterlocked = false;
            
            // Get all columns blobB occupies
            const columnsB = new Map();
            blobB.positions.forEach(pos => {
                if (!columnsB.has(pos.x)) columnsB.set(pos.x, []);
                columnsB.get(pos.x).push(pos.y);
            });
            
            // Check BOTH directions for interlocking
            // Direction 1: Does blobB wrap around blobA?
            for (let [colX, rowsA] of columnsA) {
                const minYA = Math.min(...rowsA);
                const maxYA = Math.max(...rowsA);
                
                // Get blobB's positions in this same column
                const rowsB = blobB.positions
                    .filter(pos => pos.x === colX)
                    .map(pos => pos.y);
                
                if (rowsB.length > 0) {
                    const minYB = Math.min(...rowsB);
                    const maxYB = Math.max(...rowsB);
                    
                    // Check if blobB wraps around blobA in this column
                    const bWrapsA = minYB < minYA && maxYB > maxYA;
                    
                    if (bWrapsA) {
                        isInterlocked = true;
                        console.log(`  🔗 Interlocking detected: ${blobB.id} wraps around ${blobA.id} in column ${colX}`);
                        console.log(`     ${blobA.id} rows: ${minYA}-${maxYA}, ${blobB.id} rows: ${minYB}-${maxYB}`);
                        break;
                    }
                }
            }
            
            // Direction 2: Does blobA wrap around blobB?
            if (!isInterlocked) {
                for (let [colX, rowsB] of columnsB) {
                    const minYB = Math.min(...rowsB);
                    const maxYB = Math.max(...rowsB);
                    
                    // Get blobA's positions in this same column
                    const rowsA = blobA.positions
                        .filter(pos => pos.x === colX)
                        .map(pos => pos.y);
                    
                    if (rowsA.length > 0) {
                        const minYA = Math.min(...rowsA);
                        const maxYA = Math.max(...rowsA);
                        
                        // Check if blobA wraps around blobB in this column
                        const aWrapsB = minYA < minYB && maxYA > maxYB;
                        
                        if (aWrapsB) {
                            isInterlocked = true;
                            console.log(`  🔗 Interlocking detected: ${blobA.id} wraps around ${blobB.id} in column ${colX}`);
                            console.log(`     ${blobA.id} rows: ${minYA}-${maxYA}, ${blobB.id} rows: ${minYB}-${maxYB}`);
                            break;
                        }
                    }
                }
            }
            
            if (isInterlocked) {
                interlocked.push(blobB);
                blobInCompound.add(blobB.id);
            }
        }
        
        if (interlocked.length > 1) {
            // Mark all blobs in this group as compound
            interlocked.forEach(blob => {
                blob.isCompound = true;
                blob.compoundWith = interlocked.filter(b => b.id !== blob.id).map(b => b.id);
            });
            
            compoundGroups.push(interlocked);
            console.log(`  ✓ Compound group created: ${interlocked.map(b => b.id).join(' + ')}`);
        }
    }
    
    console.log(`  ✓ Found ${compoundGroups.length} compound blob groups`);
    return compoundGroups;
}

/**
 * Calculate how far a set of blocks can fall
 * Returns the minimum fall distance across all columns
 */
function calculateFallDistance(positions, phantom) {
    let minFall = ROWS;
    
    // Group positions by column and find the lowest block in each
    const columnBottoms = new Map();
    positions.forEach(pos => {
        if (!columnBottoms.has(pos.x) || pos.y > columnBottoms.get(pos.x)) {
            columnBottoms.set(pos.x, pos.y);
        }
    });
    
    // Check each column
    for (let [x, bottomY] of columnBottoms) {
        let fall = 0;
        
        // Count empty spaces below
        for (let y = bottomY + 1; y < ROWS; y++) {
            // Check if this position is part of our blob (blob wraps around)
            const isOurBlock = positions.some(p => p.x === x && p.y === y);
            
            if (isOurBlock) {
                // Skip - this is part of our own blob
                continue;
            }
            
            if (phantom.board[y][x] !== null) {
                // Hit an obstacle
                break;
            }
            
            fall++;
        }
        
        minFall = Math.min(minFall, fall);
    }
    
    return minFall;
}

/**
 * Move a blob on the phantom board
 */
function moveBlob(blob, fallDistance, phantom) {
    // Remove from current positions
    blob.positions.forEach(pos => {
        phantom.board[pos.y][pos.x] = null;
        phantom.isRandom[pos.y][pos.x] = false;
        phantom.isLattice[pos.y][pos.x] = false;
    });
    
    // Move to new positions
    const newPositions = [];
    blob.positions.forEach(pos => {
        const newPos = {x: pos.x, y: pos.y + fallDistance};
        newPositions.push(newPos);
        phantom.board[newPos.y][newPos.x] = blob.color;
    });
    
    blob.positions = newPositions;
}

/**
 * STEP 4: Phase 1 - Move compound blobs together
 */
function runPhase1(blobs, compoundGroups, phantom) {
    console.log('\n📋 STEP 4: PHASE 1 - Moving compound blobs together...');
    
    let pass = 0;
    let somethingMoved = true;
    
    while (somethingMoved && pass < 100) {
        pass++;
        somethingMoved = false;
        
        console.log(`\n  🔄 Phase 1 Pass ${pass}:`);
        
        // Sort blobs from bottom to top
        const sortedBlobs = [...blobs].sort((a, b) => {
            const maxYA = Math.max(...a.positions.map(p => p.y));
            const maxYB = Math.max(...b.positions.map(p => p.y));
            return maxYB - maxYA; // Bottom first
        });
        
        // Track which blobs we've already processed as part of a compound
        const processed = new Set();
        
        sortedBlobs.forEach((blob, index) => {
            if (processed.has(blob.id)) return;
            
            if (blob.isCompound) {
                // Get all blobs in this compound
                const compoundBlobs = blobs.filter(b => 
                    b.id === blob.id || (blob.compoundWith && blob.compoundWith.includes(b.id))
                );
                
                // Mark as processed
                compoundBlobs.forEach(b => processed.add(b.id));
                
                // Combine all positions
                const allPositions = [];
                compoundBlobs.forEach(b => allPositions.push(...b.positions));
                
                // Calculate fall distance for the compound unit
                const fall = calculateFallDistance(allPositions, phantom);
                
                if (fall > 0) {
                    somethingMoved = true;
                    const blobIds = compoundBlobs.map(b => b.id).join('+');
                    console.log(`    Compound (${blobIds}): Falling ${fall} rows together (${allPositions.length} blocks)`);
                    
                    // Move all blobs in the compound together
                    compoundBlobs.forEach(b => moveBlob(b, fall, phantom));
                }
            } else {
                // Individual blob
                processed.add(blob.id);
                const fall = calculateFallDistance(blob.positions, phantom);
                
                if (fall > 0) {
                    somethingMoved = true;
                    console.log(`    Blob ${blob.id}: Falling ${fall} rows (${blob.positions.length} blocks)`);
                    moveBlob(blob, fall, phantom);
                }
            }
        });
    }
    
    console.log(`  ✓ Phase 1 complete after ${pass} passes`);
}

/**
 * STEP 5: Phase 2 - Move individual blobs independently
 */
function runPhase2(blobs, phantom) {
    console.log('\n📋 STEP 5: PHASE 2 - Moving individual blobs independently...');
    
    let pass = 0;
    let somethingMoved = true;
    
    while (somethingMoved && pass < 100) {
        pass++;
        somethingMoved = false;
        
        console.log(`\n  🔄 Phase 2 Pass ${pass}:`);
        
        // Sort blobs from bottom to top
        const sortedBlobs = [...blobs].sort((a, b) => {
            const maxYA = Math.max(...a.positions.map(p => p.y));
            const maxYB = Math.max(...b.positions.map(p => p.y));
            return maxYB - maxYA; // Bottom first
        });
        
        sortedBlobs.forEach((blob, index) => {
            // In Phase 2, ignore compound status - treat each blob individually
            const fall = calculateFallDistance(blob.positions, phantom);
            
            if (fall > 0) {
                somethingMoved = true;
                console.log(`    Blob ${blob.id}: Falling ${fall} more rows (${blob.positions.length} blocks)`);
                moveBlob(blob, fall, phantom);
            }
        });
    }
    
    console.log(`  ✓ Phase 2 complete after ${pass} passes`);
}

/**
 * STEP 6: Record journey destinations
 */
function recordJourneys(blobs) {
    console.log('\n📋 STEP 6: Recording journey destinations...');
    
    blobs.forEach(blob => {
        const startY = Math.min(...blob.startPositions.map(p => p.y));
        const endY = Math.min(...blob.positions.map(p => p.y));
        const distance = endY - startY;
        
        console.log(`  Journey ${blob.id}: Start Y=${startY}, End Y=${endY}, Distance=${distance} rows`);
    });
    
    console.log(`  ✓ Recorded ${blobs.length} journey destinations`);
}

/**
 * STEP 7: Create animation data
 */
function createAnimations(blobs) {
    console.log('\n📋 STEP 7: Creating animation data...');
    
    const animations = [];
    
    blobs.forEach(blob => {
        // Only animate blobs that actually moved
        const startY = blob.startPositions[0].y;
        const endY = blob.positions[0].y;
        const distance = endY - startY;
        
        if (distance > 0) {
            animations.push({
                blobId: blob.id,
                color: blob.color,
                startPositions: blob.startPositions,
                endPositions: blob.positions,
                distance: distance
            });
        }
    });
    
    console.log(`  ✓ Created ${animations.length} animations`);
    return animations;
}

/**
 * Start the gravity animation
 */
function startGravityAnimation(animations) {
    console.log('🎬 Starting gravity animation...');
    
    // Clear blocks from their original positions on the real board
    animations.forEach(anim => {
        anim.startPositions.forEach(pos => {
            board[pos.y][pos.x] = null;
            isRandomBlock[pos.y][pos.x] = false;
            isLatticeBlock[pos.y][pos.x] = false;
        });
    });
    
    // Set up falling blocks for animation
    fallingBlocks = [];
    animations.forEach(anim => {
        anim.startPositions.forEach((startPos, idx) => {
            const endPos = anim.endPositions[idx];
            
            fallingBlocks.push({
                x: startPos.x,
                startY: startPos.y,
                currentY: startPos.y * BLOCK_SIZE,
                targetY: endPos.y,
                targetYPixels: endPos.y * BLOCK_SIZE,
                color: anim.color,
                velocity: 0,
                done: false,
                blobId: anim.blobId,
                isRandom: false
            });
        });
    });
    
    gravityAnimating = true;
    console.log(`  ✓ Animation started with ${fallingBlocks.length} falling blocks`);
}

/**
 * MAIN GRAVITY FUNCTION - REPLACES runTwoPhaseGravity()
 */
function runTwoPhaseGravity() {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 GRAVITY SYSTEM V2 - COMPLETE REWRITE');
    console.log('═══════════════════════════════════════════════════════════');
    
    fallingBlocks = [];
    gravityAnimating = false; // Will be set to true if there are animations
    
    // STEP 1: Create phantom board
    const phantom = createPhantomBoard(board, isRandomBlock, isLatticeBlock);
    
    // STEP 2: Identify all blobs with unique IDs
    const blobs = identifyAllBlobs(phantom);
    
    if (blobs.length === 0) {
        console.log('✓ No blobs to move - gravity complete');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Update liquid pools even if no gravity
        updateLiquidPoolsAfterGravity();
        
        // Check for special formations
        checkForSpecialFormations();
        
        // Check for line clears
        clearLines();
        return;
    }
    
    // STEP 3: Detect interlocking
    const compoundGroups = detectInterlocking(blobs);
    
    // STEP 4: Phase 1 - Compound blobs move together
    runPhase1(blobs, compoundGroups, phantom);
    
    // STEP 5: Phase 2 - Individual blobs move independently
    runPhase2(blobs, phantom);
    
    // STEP 6: Record journey destinations
    recordJourneys(blobs);
    
    // STEP 7: Create animations
    const animations = createAnimations(blobs);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`✓ GRAVITY SIMULATION COMPLETE`);
    console.log(`  Total blobs: ${blobs.length}`);
    console.log(`  Compound groups: ${compoundGroups.length}`);
    console.log(`  Animations: ${animations.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Start the animation
    if (animations.length > 0) {
        startGravityAnimation(animations);
    } else {
        // No animations, so update board immediately
        gravityAnimating = false;
        
        // Update liquid pools
        updateLiquidPoolsAfterGravity();
        
        // Check for special formations
        checkForSpecialFormations();
        
        // Check for line clears
        clearLines();
    }
}

function applyGravity() {
    // This function is called by tsunamis, black holes, and volcanoes
    // It now uses the shared two-phase gravity system
    runTwoPhaseGravity();
}
    
function updateFallingBlocks() {
    if (!gravityAnimating || fallingBlocks.length === 0) return;
    
    // Use consistent gravity (Mercury level = 0.38x Earth) regardless of current planet
    // This prevents confusing fast cascades on high-gravity planets like the Sun
    const gravityMultiplier = 0.38; // Mercury/Mars gravity
    
    // Base gravity and velocity for Earth (gravity = 1.0)
    const baseGravity = 0.45;
    const baseMaxVelocity = 4.5;
    
    // Scale gravity and terminal velocity by the fixed gravity multiplier
    // BUT enforce a minimum gravity floor so animations don't take forever
    const minGravity = 0.8; // Minimum gravity to keep animations reasonable
    const minMaxVelocity = 8.0; // Minimum max velocity
    const gravity = Math.max(baseGravity * gravityMultiplier, minGravity);
    const maxVelocity = Math.max(baseMaxVelocity * gravityMultiplier, minMaxVelocity);
    
    let allDone = true;
    
    // Debug logging
    if (fallingBlocks.length > 0 && fallingBlocks[0].velocity < 1) {
        console.log(`Falling: blocks=${fallingBlocks.length}, gravity=${gravity.toFixed(2)} (${gravityMultiplier}x Earth), velocity=${fallingBlocks[0].velocity.toFixed(2)}, currentY=${fallingBlocks[0].currentY.toFixed(1)}, targetY=${fallingBlocks[0].targetYPixels}`);
    }
    
    fallingBlocks.forEach(block => {
        if (block.done) return;
        
        // Apply gravity
        block.velocity = Math.min(block.velocity + gravity, maxVelocity);
        block.currentY += block.velocity;
        
        // Check if reached target
        if (block.currentY >= block.targetYPixels) {
            block.currentY = block.targetYPixels;
            block.done = true;
            // DON'T place on board yet - wait until ALL blocks are done
        } else {
            allDone = false;
        }
    });
    
    // Animation complete - NOW place ALL blocks at once
    if (allDone) {
        // Place all landed blocks on the board simultaneously
        fallingBlocks.forEach(block => {
            board[block.targetY][block.x] = block.color;
            isRandomBlock[block.targetY][block.x] = block.isRandom;
        });
        
        // Update liquid pools after blocks have fallen
        updateLiquidPoolsAfterGravity();
        
        gravityAnimating = false;
        fallingBlocks = [];
        
        // Check for black holes and tsunamis after gravity settles
        checkForSpecialFormations();
        
        // DON'T call applyGravity here - the multi-pass simulation already handled everything!
        // Just check for line clears
        clearLines();
    }
}

function drawFallingBlocks() {
    if (!gravityAnimating || fallingBlocks.length === 0) return;
    
    ctx.save();
    
    // Apply phantom mode opacity to falling blocks too
    const isPhantomMode = challengeMode === 'phantom' || activeChallenges.has('phantom') || soRandomCurrentMode === 'phantom';
    if (isPhantomMode) {
        ctx.globalAlpha = phantomOpacity;
    }
    
    // Group blocks by blobId and color to draw them as connected shapes
    const blobGroups = {};
    fallingBlocks.forEach(block => {
        // Draw ALL blocks in the fallingBlocks array, even if done
        // They'll be removed from the array when animation fully completes
        const key = `${block.blobId}_${block.color}`;
        if (!blobGroups[key]) {
            blobGroups[key] = {
                color: block.color,
                blocks: [],
                velocity: block.velocity,
                originalPositions: [] // Store original relative positions
            };
        }
        blobGroups[key].blocks.push(block);
    });
    
    // Draw each blob group as a connected shape
    Object.values(blobGroups).forEach(group => {
        // Calculate the Y offset based on the current animation progress
        // Find the top block (smallest startY) to use as reference
        const topBlock = group.blocks.reduce((top, b) => 
            b.startY < top.startY ? b : top, group.blocks[0]);
        
        // Calculate how far the top block has fallen (in pixels)
        const yOffset = topBlock.currentY - (topBlock.startY * BLOCK_SIZE);
        
        // Maintain each block's original relative position while applying the fall offset
        const positions = group.blocks.map(b => {
            const relativeY = b.startY + (yOffset / BLOCK_SIZE);
            return [b.x, relativeY];
        });
        
        // Check if any blocks are random hail blocks
        const hasRandomBlocks = group.blocks.some(b => b.isRandom);
        
        // Use pulsing color for lava blocks
        const displayColor = group.color === volcanoLavaColor ? getLavaColor() : group.color;
        
        // Draw main blob
        // In phantom mode, parent context already has opacity set
        if (!isPhantomMode) {
            ctx.globalAlpha = 1;
        }
        drawSolidShape(ctx, positions, displayColor, BLOCK_SIZE, false, getFaceOpacity(), hasRandomBlocks);
        
        // Add slight motion blur trail for fast-moving blobs
        if (group.velocity > 3) { // Velocity is now in pixels per frame
            ctx.globalAlpha = 0.3;
            const trailYOffset = yOffset - group.velocity * 0.3;
            const trailPositions = group.blocks.map(b => {
                const relativeY = b.startY + (trailYOffset / BLOCK_SIZE);
                return [b.x, relativeY];
            });
            drawSolidShape(ctx, trailPositions, displayColor, BLOCK_SIZE, false, getFaceOpacity(), hasRandomBlocks);
        }
    });
    
    ctx.restore();
}

function clearLines() {
    // CRITICAL: Don't check for line clears while blocks are falling!
    // The multi-pass simulation already calculated everything, so we must
    // wait for all blocks to land before checking for new clears
    if (gravityAnimating) {
        console.log('⏸️ Skipping clearLines - blocks still falling');
        return;
    }
    
    // Don't clear lines during earthquake - let the earthquake finish first
    if (earthquakeActive) {
        console.log('⏸️ Skipping clearLines - earthquake in progress');
        return;
    }
    
    // Don't start a new line clear while one is already animating
    // This prevents race conditions when tornado drops pieces during line clears
    // Set a flag to check again after the current animation completes
    if (animatingLines) {
        console.log('⏸️ Deferring clearLines - line animation in progress');
        pendingLineCheck = true;
        return;
    }
    
    const blobsBefore = getAllBlobs();
    const completedRows = [];
    
    for (let y = ROWS - 1; y >= 0; y--) {
        // Defensive check: ensure row exists and is valid
        if (board[y] && Array.isArray(board[y]) && board[y].length === COLS) {
            // Check if all cells in this row are filled (non-null)
            let isComplete = true;
            for (let x = 0; x < COLS; x++) {
                if (board[y][x] === null || board[y][x] === undefined) {
                    isComplete = false;
                    break;
                }
            }
            if (isComplete) {
                completedRows.push(y);
            }
        }
    }

    if (completedRows.length > 0) {
        animatingLines = true;
        
        // Pre-calculate which effects to play (before clearing rows)
        const blobsBeforeForCheck = getAllBlobs();
        let willHaveGoldBlob = false;
        let willHaveBlackHole = false;
        let tsunamiBlobs = []; // Track which blobs are tsunamis
        let blackHoleBlobs = []; // Track black hole pairs
        
        // Detect black holes first (one blob enveloping another)
        const blackHoles = detectBlackHoles(blobsBeforeForCheck);
        blackHoles.forEach(bh => {
            // Only count as black hole if inner blob has blocks in completed rows
            const innerBlocksInRows = bh.innerBlob.positions.filter(pos => completedRows.includes(pos[1])).length;
            if (innerBlocksInRows > 0) {
                willHaveBlackHole = true;
                blackHoleBlobs.push(bh);
            }
        });
        
        // Check if any blob spans the width (tsunamis)
        blobsBeforeForCheck.forEach(blob => {
            const blocksInRows = blob.positions.filter(pos => completedRows.includes(pos[1])).length;
            if (blocksInRows === 0) return;
            
            const minX = Math.min(...blob.positions.map(p => p[0]));
            const maxX = Math.max(...blob.positions.map(p => p[0]));
            const spansWidth = (minX === 0 && maxX === COLS - 1);
            if (spansWidth) {
                willHaveGoldBlob = true;
                tsunamiBlobs.push(blob);
            }
        });
        
        const isStrike = completedRows.length >= 4;
        
        // Play appropriate sound/effect immediately as animation starts
        // Priority: Strike > Black Hole > Tsunami > Normal
        if (isStrike) {
            triggerLightning(300); // Single strike for 4 lines
            strikeCount++;
        } else if (willHaveBlackHole) {
            // Black hole takes priority - purple/dark effect
            canvas.classList.add('blackhole-active');
            playEnhancedThunder(soundToggle); // Dramatic sound
            setTimeout(() => {
                canvas.classList.remove('blackhole-active');
            }, 1000);
        } else if (willHaveGoldBlob) {
            // Add golden border during tsunami blob clearing
            canvas.classList.add('tsunami-active');
            playSoundEffect('gold', soundToggle);
            // Remove border after animation
            setTimeout(() => {
                canvas.classList.remove('tsunami-active');
            }, 1000);
        } else {
            playSoundEffect('line', soundToggle);
        }
        
        // Calculate histogram and score updates immediately (before animation completes)
        let pointsEarned = 0;
        let hadGoldBlob = false;
        let hadBlackHole = false;
        
        // Process BLACK HOLES first (highest priority)
        blackHoleBlobs.forEach(bh => {
            const innerSize = bh.innerBlob.positions.length;
            const outerSize = bh.outerBlob.positions.length;
            
            // Update histograms
            updateHistogramWithBlob(bh.innerBlob.color, innerSize);
            updateHistogramWithBlob(bh.outerBlob.color, outerSize);
            
            // BLACK HOLE SCORING:
            // Inner blob (black hole core): size³ × 100 × 2
            // Outer blob (sucked in): size³ × 100
            const innerPoints = innerSize * innerSize * innerSize * 100 * 2;
            const outerPoints = outerSize * outerSize * outerSize * 100;
            
            pointsEarned += innerPoints + outerPoints;
            hadBlackHole = true;
            
            // Remove ALL blocks from both blobs
            bh.innerBlob.positions.forEach(([bx, by]) => {
                board[by][bx] = null;
                isRandomBlock[by][bx] = false;
                fadingBlocks[by][bx] = null;
            });
            bh.outerBlob.positions.forEach(([bx, by]) => {
                board[by][bx] = null;
                isRandomBlock[by][bx] = false;
                fadingBlocks[by][bx] = null;
            });
        });
        
        // Count how many lava segments are in the completed rows
        // Each lava segment doubles the entire line clear score
        let lavaSegmentCount = 0;
        blobsBefore.forEach(beforeBlob => {
            if (beforeBlob.color === volcanoLavaColor) {
                const blocksInCompletedRows = beforeBlob.positions.filter(pos => completedRows.includes(pos[1])).length;
                if (blocksInCompletedRows > 0) {
                    lavaSegmentCount++;
                }
            }
        });
        
        // Process remaining blobs (excluding black hole blobs)
        blobsBefore.forEach(beforeBlob => {
            // Skip if this blob was part of a black hole
            // Compare by color and positions, not object reference
            const isBlackHoleBlob = blackHoleBlobs.some(bh => {
                const matchesInner = bh.innerBlob.color === beforeBlob.color &&
                    bh.innerBlob.positions.length === beforeBlob.positions.length &&
                    bh.innerBlob.positions.every(([x, y]) => 
                        beforeBlob.positions.some(([bx, by]) => bx === x && by === y)
                    );
                const matchesOuter = bh.outerBlob.color === beforeBlob.color &&
                    bh.outerBlob.positions.length === beforeBlob.positions.length &&
                    bh.outerBlob.positions.every(([x, y]) => 
                        beforeBlob.positions.some(([bx, by]) => bx === x && by === y)
                    );
                return matchesInner || matchesOuter;
            });
            if (isBlackHoleBlob) return;
            
            const beforeSize = beforeBlob.positions.length;
            
            // Check if this blob spanned the width
            const minX = Math.min(...beforeBlob.positions.map(p => p[0]));
            const maxX = Math.max(...beforeBlob.positions.map(p => p[0]));
            const wasSpanning = (minX === 0 && maxX === COLS - 1);
            
            // Check how many blocks are in completed rows
            let blocksInCompletedRows = beforeBlob.positions.filter(pos => completedRows.includes(pos[1])).length;
            
            if (blocksInCompletedRows > 0) {
                // Update histogram with blob size being cleared
                updateHistogramWithBlob(beforeBlob.color, beforeSize);
                
                let blobPoints;
                
                if (wasSpanning) {
                    // TSUNAMI: Clear entire blob and score ALL blocks
                    // Points = (original blob size)³ × 200
                    blobPoints = beforeSize * beforeSize * beforeSize * 200;
                    hadGoldBlob = true;
                    
                    // Mark ALL blocks in tsunami blob for removal
                    beforeBlob.positions.forEach(([bx, by]) => {
                        board[by][bx] = null;
                        isRandomBlock[by][bx] = false;
                        fadingBlocks[by][bx] = null;
                    });
                } else {
                    // Normal blob: Only score blocks in completed rows
                    // Points = (original blob size)² × blocks removed × 100
                    // (Lava multiplier applied to entire line clear later)
                    blobPoints = beforeSize * beforeSize * blocksInCompletedRows * 100;
                }
                
                pointsEarned += blobPoints;
            }
        });
        
        // Apply lava multiplier to entire line clear
        // Each lava segment doubles the score (1 segment = 2x, 2 segments = 4x, 3 segments = 8x, etc.)
        if (lavaSegmentCount > 0) {
            const lavaMultiplier = Math.pow(2, lavaSegmentCount);
            pointsEarned *= lavaMultiplier;
            console.log(`🌋 Lava multiplier: ${lavaSegmentCount} segments = ${lavaMultiplier}x points!`);
        }
        
        // Apply strike bonus
        if (isStrike) {
            pointsEarned *= 2;
        }
        
        const scoreIncrease = applyScoreModifiers(pointsEarned * level);
        score += scoreIncrease;
        
        // Update score histogram immediately
        scoreHistogramTarget = scoreIncrease;
        if (scoreIncrease > scoreHistogramMaxScale) {
            scoreHistogramMaxScale = Math.ceil(scoreIncrease / 1000) * 1000; // Round up to nearest 1000
        }
        
        lines += completedRows.length;
        
        // Check for 42 lines easter egg
        if (lines === 42 && !StarfieldSystem.isUFOActive()) {
            StarfieldSystem.triggerUFO();
        }
        
        // If UFO is active and lines changed from 42, make it leave
        if (StarfieldSystem.isUFOActive() && lines !== 42) {
            StarfieldSystem.departUFO();
        }
        
        // Update Six Seven counter
        const isSixSevenMode = challengeMode === 'sixseven' || activeChallenges.has('sixseven') || soRandomCurrentMode === 'sixseven';
        if (isSixSevenMode) {
            sixSevenCounter += completedRows.length;
        }
        
        // Update Gremlins counter
        const isGremlinsMode = challengeMode === 'gremlins' || activeChallenges.has('gremlins') || soRandomCurrentMode === 'gremlins';
        if (isGremlinsMode) {
            gremlinsCounter += completedRows.length;
        }
        
        const oldLevel = level;
        level = Math.min(11, Math.floor(lines / 11) + 1); // Spinal Tap tribute - this one goes to 11!
        currentGameLevel = level; StarfieldSystem.setCurrentGameLevel(level); // Update starfield journey
        dropInterval = calculateDropInterval(lines);
        
        // So Random mode: Switch challenge at each level
        if (challengeMode === 'sorandom' && oldLevel !== level) {
            switchSoRandomMode();
        }
        
        // Spinal Tap tribute - this one goes to 11!
        if (oldLevel < 11 && level >= 11) {
            console.log("🎸 This one goes to 11! 🎸");
        }
        
        updateStats();
        
        // Animate cleared lines PLUS all special blob blocks
        const cellsToAnimate = [];
        
        // Add completed row cells
        completedRows.forEach(row => {
            const centerX = COLS / 2;
            for (let x = 0; x < COLS; x++) {
                if (board[row][x]) {
                    cellsToAnimate.push({
                        x: x,
                        y: row,
                        color: board[row][x],
                        distance: Math.abs(x - centerX),
                        removed: false,
                        alpha: 1
                    });
                }
            }
        });
        
        // Add ALL black hole blob cells (both inner and outer)
        blackHoleBlobs.forEach(bh => {
            const centerX = COLS / 2;
            const centerRow = completedRows[0] || 10;
            
            // Animate inner blob (black hole core) with special marker
            bh.innerBlob.positions.forEach(([bx, by]) => {
                if (!completedRows.includes(by)) {
                    cellsToAnimate.push({
                        x: bx,
                        y: by,
                        color: bh.innerBlob.color,
                        distance: Math.abs(bx - centerX) + Math.abs(by - centerRow) * 0.3,
                        removed: false,
                        alpha: 1,
                        isBlackHole: true
                    });
                }
            });
            
            // Animate outer blob (sucked into black hole)
            bh.outerBlob.positions.forEach(([bx, by]) => {
                if (!completedRows.includes(by)) {
                    cellsToAnimate.push({
                        x: bx,
                        y: by,
                        color: bh.outerBlob.color,
                        distance: Math.abs(bx - centerX) + Math.abs(by - centerRow) * 0.3,
                        removed: false,
                        alpha: 1,
                        isBlackHole: true
                    });
                }
            });
        });
        
        // Add ALL tsunami blob cells (even those not in completed rows)
        tsunamiBlobs.forEach(blob => {
            blob.positions.forEach(([bx, by]) => {
                // Only add if not already in completedRows or black hole
                const alreadyAdded = cellsToAnimate.some(c => c.x === bx && c.y === by);
                if (!completedRows.includes(by) && !alreadyAdded) {
                    const centerX = COLS / 2;
                    cellsToAnimate.push({
                        x: bx,
                        y: by,
                        color: blob.color,
                        distance: Math.abs(bx - centerX) + Math.abs(by - (completedRows[0] || 10)) * 0.5,
                        removed: false,
                        alpha: 1,
                        isTsunami: true
                    });
                }
            });
        });
        
        // Create animation with all cells
        const animation = { 
            cells: cellsToAnimate, 
            startTime: Date.now(), 
            duration: 500 
        };
        animation.cells.sort((a, b) => a.distance - b.distance);
        lineAnimations.push(animation);

        setTimeout(() => {
            const sortedRows = completedRows.sort((a, b) => b - a);
            
            console.log(`🎯 Clearing ${sortedRows.length} rows`);
            
            // FIRST: Clear the completed row blocks
            sortedRows.forEach(row => {
                for (let x = 0; x < COLS; x++) {
                    board[row][x] = null;
                    isRandomBlock[row][x] = false;
                    isLatticeBlock[row][x] = false;
                    fadingBlocks[row][x] = null;
                }
            });
            
            // SECOND: Adjust liquidPools for cleared rows
            // Remove pools that were on cleared rows
            liquidPools = liquidPools.filter(pool => {
                return !sortedRows.includes(pool.blockY);
            });
            
            // Shift down pools that were above the cleared rows
            // sortedRows is sorted high to low (bottom to top)
            const numRowsCleared = sortedRows.length;
            liquidPools.forEach(pool => {
                // Count how many cleared rows were below this pool
                const rowsBelowPool = sortedRows.filter(row => row > pool.blockY).length;
                if (rowsBelowPool > 0) {
                    // Shift the pool down by the number of rows cleared below it
                    const shiftAmount = rowsBelowPool * BLOCK_SIZE;
                    pool.blockY += rowsBelowPool;
                    pool.y = pool.blockY * BLOCK_SIZE;
                    
                    // Also shift drip streaks down by the same amount
                    pool.dripStreaks.forEach(streak => {
                        streak.y += shiftAmount;
                    });
                }
            });
            
            // Use the shared two-phase gravity system
            runTwoPhaseGravity();

            animatingLines = false;
            
            // Check if another clearLines was requested during the animation
            // (e.g., tornado dropped a piece that completed a line)
            if (pendingLineCheck) {
                pendingLineCheck = false;
                console.log('🔄 Processing deferred line check');
                clearLines();
                return; // Don't spawn weather events if we're doing another clear
            }
            
            // Check for tornado/earthquake with difficulty-based probability
            // Wait 1 second after lines clear, then check probability
            setTimeout(() => {
                if (!gameRunning || paused) return;
                
                // Determine probability based on difficulty level
                let eventProbability = 0;
                switch(gameMode) {
                    case 'drizzle': eventProbability = 0.04; break; // 4%
                    case 'downpour': eventProbability = 0.08; break; // 8%
                    case 'hailstorm': eventProbability = 0.12; break; // 12%
                    case 'blizzard': eventProbability = 0.16; break; // 16%
                    case 'hurricane': eventProbability = 0.20; break; // 20%
                }
                
                // Check if event should occur
                if (Math.random() < eventProbability) {
                    // 66% tornado, 34% earthquake
                    if (Math.random() < 0.66) {
                        spawnTornado();
                    } else {
                        spawnEarthquake();
                    }
                }
            }, 1000);
        }, 500);
    }
}

function rotatePiece() {
    if (!currentPiece || !currentPiece.shape || !Array.isArray(currentPiece.shape) || currentPiece.shape.length === 0) return;
    if (!currentPiece.shape[0] || !Array.isArray(currentPiece.shape[0]) || currentPiece.shape[0].length === 0) return;
    // Prevent rotation during earthquake shift phase
    if (earthquakeActive && earthquakePhase === 'shift') return;
    
    // Additional validation: check if all rows exist and have content
    if (!currentPiece.shape.every(row => row && Array.isArray(row) && row.length > 0)) return;
    
    // Check if piece is about to lock (would collide if moved down)
    const aboutToLock = collides(currentPiece, 0, 1);
    
    try {
        const rotated = currentPiece.shape[0].map((_, i) =>
            currentPiece.shape.map(row => row[i]).reverse()
        );
        const previous = currentPiece.shape;
        const originalX = currentPiece.x;
        currentPiece.shape = rotated;
        
        // Wall kick: try original position, then shift left/right up to 2 spaces
        const kicks = [0, -1, 1, -2, 2];
        let rotationSuccessful = false;
        
        for (const kick of kicks) {
            currentPiece.x = originalX + kick;
            if (!collides(currentPiece)) {
                rotationSuccessful = true;
                playSoundEffect('rotate', soundToggle);
                // Reset lock delay if piece was about to lock
                if (aboutToLock) {
                    dropCounter = 0;
                }
                break;
            }
        }
        
        if (!rotationSuccessful) {
            currentPiece.shape = previous;
            currentPiece.x = originalX;
        }
    } catch (error) {
        // Silently fail and keep the current rotation
    }
}

function rotatePieceCounterClockwise() {
    if (!currentPiece || !currentPiece.shape || !Array.isArray(currentPiece.shape) || currentPiece.shape.length === 0) return;
    if (!currentPiece.shape[0] || !Array.isArray(currentPiece.shape[0]) || currentPiece.shape[0].length === 0) return;
    // Prevent rotation during earthquake shift phase
    if (earthquakeActive && earthquakePhase === 'shift') return;
    
    // Additional validation: check if all rows exist and have content
    if (!currentPiece.shape.every(row => row && Array.isArray(row) && row.length > 0)) return;
    
    // Check if piece is about to lock (would collide if moved down)
    const aboutToLock = collides(currentPiece, 0, 1);
    
    try {
        // Counter-clockwise is the opposite of clockwise
        // Clockwise: transpose then reverse each row
        // Counter-clockwise: reverse each row then transpose
        const reversed = currentPiece.shape.map(row => [...row].reverse());
        const rotated = reversed[0].map((_, i) =>
            reversed.map(row => row[i])
        );
        const previous = currentPiece.shape;
        const originalX = currentPiece.x;
        currentPiece.shape = rotated;
        
        // Wall kick: try original position, then shift left/right up to 2 spaces
        const kicks = [0, -1, 1, -2, 2];
        let rotationSuccessful = false;
        
        for (const kick of kicks) {
            currentPiece.x = originalX + kick;
            if (!collides(currentPiece)) {
                rotationSuccessful = true;
                playSoundEffect('rotate', soundToggle);
                // Reset lock delay if piece was about to lock
                if (aboutToLock) {
                    dropCounter = 0;
                }
                break;
            }
        }
        
        if (!rotationSuccessful) {
            currentPiece.shape = previous;
            currentPiece.x = originalX;
        }
    } catch (error) {
        // Silently fail and keep the current rotation
    }
}

function movePiece(dir) {
    if (!currentPiece) return;
    // Prevent movement during earthquake shift phase
    if (earthquakeActive && earthquakePhase === 'shift') return;
    
    // Check if piece is about to lock (would collide if moved down)
    const aboutToLock = collides(currentPiece, 0, 1);
    
    // Check if controls should be swapped (Stranger XOR Dyslexic)
    const strangerActive = challengeMode === 'stranger' || activeChallenges.has('stranger');
    const dyslexicActive = challengeMode === 'dyslexic' || activeChallenges.has('dyslexic');
    const shouldSwap = strangerActive !== dyslexicActive; // XOR: swap if exactly one is active
    
    const actualDir = shouldSwap ? -dir : dir;
    
    currentPiece.x += actualDir;
    if (collides(currentPiece)) {
        currentPiece.x -= actualDir;
    } else {
        playSoundEffect('move', soundToggle);
        // Reset lock delay if piece was about to lock
        if (aboutToLock) {
            dropCounter = 0;
        }
    }
}

function dropPiece() {
    if (animatingLines || gravityAnimating || !currentPiece || !currentPiece.shape) return;
    // Prevent dropping during earthquake shift phase
    if (earthquakeActive && earthquakePhase === 'shift') return;
    
    currentPiece.y++;
    if (collides(currentPiece)) {
        currentPiece.y--;
        
        // Check if any block of the piece extends beyond the top of the well
        const extendsAboveTop = currentPiece.shape.some((row, dy) => {
            return row.some((value, dx) => {
                if (value) {
                    const blockY = currentPiece.y + dy;
                    return blockY < 0;
                }
                return false;
            });
        });
        
        if (extendsAboveTop) {
            gameOver();
            return;
        }
        
        // Check if piece at current position still overlaps with existing blocks
        // This can happen if the piece spawned in an invalid position
        if (collides(currentPiece)) {
            gameOver();
            return;
        }
        
        playSoundEffect('drop', soundToggle);
        mergePiece();
        
        // Check for Tsunamis and Black Holes IMMEDIATELY after piece placement
        checkForSpecialFormations();
        
        clearLines();
        
        if (nextPieceQueue.length > 0 && nextPieceQueue[0] && nextPieceQueue[0].shape) {
            // Spawn the next piece from queue
            currentPiece = nextPieceQueue.shift();
            
            // Mercurial mode: Reset timer for new piece
            mercurialTimer = 0;
            mercurialInterval = 2000 + Math.random() * 2000; // New random interval 2-4 seconds
            
            // Check if Six Seven mode should spawn a giant piece
            const isSixSevenMode = challengeMode === 'sixseven' || activeChallenges.has('sixseven') || soRandomCurrentMode === 'sixseven';
            if (isSixSevenMode && sixSevenCounter >= sixSevenNextTarget && sixSevenNextSize > 0) {
                // Create giant piece and add to end of queue
                nextPieceQueue.push(createGiantPiece(sixSevenNextSize));
                // Reset counter and set next target (random 6 or 7 lines)
                sixSevenCounter = 0;
                sixSevenNextTarget = Math.random() < 0.5 ? 6 : 7;
                sixSevenNextSize = sixSevenNextTarget;
            } else {
                // Create normal piece and add to end of queue
                nextPieceQueue.push(createPiece());
            }
            
            drawNextPiece();
            
            // Gremlins mode: Add or remove random blocks (50/50 chance)
            // Gremlins mode: Add or remove random blocks (50/50 chance)
            const isGremlinsMode = challengeMode === 'gremlins' || activeChallenges.has('gremlins') || soRandomCurrentMode === 'gremlins';
            if (isGremlinsMode && gremlinsCounter >= gremlinsNextTarget) {
                // 50% chance to add, 50% chance to remove
                if (Math.random() < 0.5) {
                    createRandomHailBlock(); // Add a block
                } else {
                    removeRandomBlocks(); // Remove a block
                }
                gremlinsCounter = 0;
                // Set next target (average once every 4 lines, randomized)
                gremlinsNextTarget = 1 + Math.random() * 2; // Between 1 and 3 lines (twice as frequent)
            }
        } else {
            gameOver();
        }
    }
}

// Hard drop animation state
let hardDropping = false;
let hardDropVelocity = 0;
let hardDropPixelY = 0; // Track pixel position for smooth visual animation
let hardDropStartY = 0; // Grid Y position when hard drop started

function hardDrop() {
    if (animatingLines || gravityAnimating || !currentPiece || hardDropping) return;
    // Prevent hard drop during earthquake shift phase
    if (earthquakeActive && earthquakePhase === 'shift') return;
    
    // Start animated drop
    hardDropping = true;
    hardDropVelocity = 0;
    hardDropStartY = currentPiece.y;
    hardDropPixelY = currentPiece.y * BLOCK_SIZE; // Start at current position in pixels
    
    playSoundEffect('move', soundToggle); // Initial sound
}

function updateHardDrop() {
    if (!hardDropping || !currentPiece) return;
    
    // Fast hard drop speed
    const hardDropAcceleration = 50;
    const hardDropMaxVelocity = 500;
    
    // Apply acceleration
    hardDropVelocity = Math.min(hardDropVelocity + hardDropAcceleration, hardDropMaxVelocity);
    
    // Update pixel position
    hardDropPixelY += hardDropVelocity;
    
    // Calculate the target grid Y based on pixel position
    const targetGridY = Math.floor(hardDropPixelY / BLOCK_SIZE);
    
    // Move piece grid position to catch up with visual position (for collision detection)
    while (currentPiece.y < targetGridY) {
        if (!collides(currentPiece, 0, 1)) {
            currentPiece.y++;
        } else {
            // Hit something - stop hard drop and place piece
            hardDropping = false;
            hardDropVelocity = 0;
            hardDropPixelY = 0;
            dropPiece();
            return;
        }
    }
    
    // Check if we've hit something at the current position
    if (collides(currentPiece, 0, 1)) {
        // Snap visual to final grid position
        hardDropPixelY = currentPiece.y * BLOCK_SIZE;
        hardDropping = false;
        hardDropVelocity = 0;
        dropPiece();
    }
}

function formatAsBitcoin(points) {
    // Convert points to Bitcoin, divide by 10000 to trim last 4 digits
    const btc = points / 10000000;
    return '₿' + btc.toFixed(4);
}

function updateStats() {
    scoreDisplay.textContent = formatAsBitcoin(score);
    linesDisplay.textContent = lines;
    levelDisplay.textContent = level;
    strikesDisplay.textContent = strikeCount;
    tsunamisDisplay.textContent = tsunamiCount;
    blackHolesDisplay.textContent = blackHoleCount;
    volcanoesDisplay.textContent = volcanoCount;
}

// Show planet statistics

// Toggle visibility of instructions, controls, and settings button
function toggleUIElements(show) {
    const rulesInstructions = document.querySelector('.rules-instructions');
    const histogramCanvas = document.getElementById('histogramCanvas');
    const leaderboardContent = document.getElementById('leaderboardContent');
    const controls = document.querySelector('.controls');
    const settingsBtn = document.getElementById('settingsBtn');
    const nextPieceSection = document.getElementById('nextPieceSection');
    const titles = document.querySelectorAll('.title');
    const pauseBtn = document.getElementById('pauseBtn');
    const planetStatsLeft = document.getElementById('planetStatsLeft');
    
    // Check if leaderboard is currently visible
    const leaderboardVisible = leaderboardContent && leaderboardContent.style.display !== 'none';
    
    if (show) {
        // Show instructions and controls, hide histogram, show title
        // But only show instructions if leaderboard is not visible
        if (!leaderboardVisible) {
            rulesInstructions.style.display = 'block';
        }
        controls.classList.remove('hidden-during-play');
        settingsBtn.classList.remove('hidden-during-play');
        histogramCanvas.style.display = 'none';
        titles.forEach(title => title.style.display = '');
        
        // Hide tablet mode gameplay elements on menu
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (planetStatsLeft) planetStatsLeft.style.display = 'none';
    } else {
        // Hide instructions and controls, show histogram, hide title
        rulesInstructions.style.display = 'none';
        // Also hide leaderboard when game starts
        if (leaderboardContent) leaderboardContent.style.display = 'none';
        controls.classList.add('hidden-during-play');
        settingsBtn.classList.add('hidden-during-play');
        histogramCanvas.style.display = 'block';
        titles.forEach(title => title.style.display = 'none');
        
        // Show tablet mode gameplay elements during game
        if (TabletMode.enabled) {
            if (pauseBtn) pauseBtn.style.display = 'block';
            if (planetStatsLeft) planetStatsLeft.style.display = 'block';
        }
    }
}

async function gameOver() {
    gameRunning = false; StarfieldSystem.setGameRunning(false);
    document.body.classList.remove('game-running');
    cancelAnimationFrame(gameLoop);
    stopMusic();
    playSoundEffect('gameover', soundToggle);
    StarfieldSystem.hidePlanetStats();
    
    // Clear all touch repeat timers
    touchRepeat.timers.forEach((timerObj, element) => {
        if (timerObj.initial) clearTimeout(timerObj.initial);
        if (timerObj.repeat) clearInterval(timerObj.repeat);
    });
    touchRepeat.timers.clear();
    
    finalScoreDisplay.textContent = `Final Score: ${formatAsBitcoin(score)}`;
    
    // Display special event statistics
    let statsHTML = `Lines: ${lines} | Level: ${level}<br>`;
    if (strikeCount > 0 || tsunamiCount > 0 || volcanoCount > 0 || blackHoleCount > 0) {
        statsHTML += '<br>';
        if (strikeCount > 0) statsHTML += `⚡ Strikes: ${strikeCount}<br>`;
        if (tsunamiCount > 0) statsHTML += `🌊 Tsunamis: ${tsunamiCount}<br>`;
        if (volcanoCount > 0) statsHTML += `🌋 Volcanoes: ${volcanoCount}<br>`;
        if (blackHoleCount > 0) statsHTML += `🕳️ Black Holes: ${blackHoleCount}<br>`;
    }
    finalStatsDisplay.innerHTML = statsHTML;
    
    toggleUIElements(true);
    
    // Determine if this is a challenge mode game
    const isChallenge = challengeMode !== 'normal';
    
    // Build list of active challenges
    let challengesList = [];
    if (isChallenge) {
        if (challengeMode === 'combo') {
            // Combo mode - list all active challenges
            challengesList = Array.from(activeChallenges);
        } else if (challengeMode === 'sorandom') {
            // So Random mode - just mark as "sorandom"
            challengesList = ['sorandom'];
        } else {
            // Single challenge mode
            challengesList = [challengeMode];
        }
    }
    
    // Prepare score data for submission
    const scoreData = {
        game: 'blockchainstorm',
        gameTitle: window.GAME_TITLE || 'BLOCKCHaiNSTOЯM',
        difficulty: gameMode,
        mode: isChallenge ? 'challenge' : 'normal',
        score: score,
        lines: lines,
        level: level,
        strikes: strikeCount,
        tsunamis: tsunamiCount,
        blackholes: blackHoleCount,
        volcanoes: volcanoCount || 0,
        duration: Math.floor((Date.now() - gameStartTime) / 1000),
        challengeType: isChallenge ? challengeMode : null, // Track main challenge mode
        challenges: challengesList // Track all active challenges
    };
    
    
    // Check if score makes top 20
    console.log('Checking if score makes top 20...');
    const isTopTen = window.leaderboard ? await window.leaderboard.checkIfTopTen(gameMode, score, scoreData.mode) : false;
    console.log('Is top twenty:', isTopTen);
    
    if (isTopTen && window.leaderboard) {
        // DON'T show game over div - go straight to name prompt
        console.log('Score is top 20! Showing name entry prompt...');
        gameOverDiv.style.display = 'none';
        window.leaderboard.promptForName(scoreData);
    } else {
        // Score didn't make top 20, show game over div and leaderboard
        console.log('Score did not make top 20, displaying game over and leaderboard');
        gameOverDiv.style.display = 'block';
        if (window.leaderboard) {
            await window.leaderboard.displayLeaderboard(gameMode, score, scoreData.mode);
            // Send notification for non-high-score game completion
            window.leaderboard.notifyGameCompletion(scoreData);
        }
    }
}

function update(time = 0) {
    if (!gameRunning) return;

    const deltaTime = time - (update.lastTime || 0);
    update.lastTime = time;
    
    // Update hard drop animation
    if (!paused && hardDropping) {
        updateHardDrop();
    }
    
    // Don't drop pieces during black hole or tsunami animation or hard drop or earthquake shift or gravity
    const earthquakeShiftActive = earthquakeActive && earthquakePhase === 'shift';
    if (!paused && !animatingLines && !gravityAnimating && !blackHoleAnimating && !tsunamiAnimating && !hardDropping && !earthquakeShiftActive && currentPiece) {
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            dropPiece();
            dropCounter = 0;
        }
    }
    
    // If current piece is null (bounced away), spawn new piece
    if (!paused && !currentPiece && nextPieceQueue.length > 0 && bouncingPieces.length > 0) {
        currentPiece = nextPieceQueue.shift();
        
        // Mercurial mode: Reset timer for new piece
        mercurialTimer = 0;
        mercurialInterval = 2000 + Math.random() * 2000; // New random interval 2-4 seconds
        
        // Check if Six Seven mode should spawn a giant piece
        const isSixSevenMode = challengeMode === 'sixseven' || activeChallenges.has('sixseven') || soRandomCurrentMode === 'sixseven';
        if (isSixSevenMode && sixSevenCounter >= sixSevenNextTarget && sixSevenNextSize > 0) {
            nextPieceQueue.push(createGiantPiece(sixSevenNextSize));
            sixSevenCounter = 0;
            sixSevenNextTarget = Math.random() < 0.5 ? 6 : 7;
            sixSevenNextSize = sixSevenNextTarget;
        } else {
            nextPieceQueue.push(createPiece());
        }
        
        drawNextPiece();
    }

    updateLineAnimations();
    if (!paused) {
        frameCount++; // Increment frame counter for liquid pooling timing
        
        // Mercurial mode: Change piece color every 2-4 seconds
        const isMercurialMode = challengeMode === 'mercurial' || activeChallenges.has('mercurial') || soRandomCurrentMode === 'mercurial';
        if (isMercurialMode && currentPiece && !hardDropping) {
            mercurialTimer += deltaTime;
            if (mercurialTimer >= mercurialInterval) {
                // Change the current piece's color to a random new color
                currentPiece.color = randomColor();
                // Set next interval (2-4 seconds in milliseconds)
                mercurialInterval = 2000 + Math.random() * 2000;
                mercurialTimer = 0;
                // Optional: play a subtle sound effect
                playSoundEffect('rotate', soundToggle);
            }
        }
        
        updateFadingBlocks();
        updateGremlinFadingBlocks(); // Update gremlin fading blocks
        updateStormParticles();
        updateDrippingLiquids(); // Update dripping liquids for Carrie/No Kings
        updateTornado(); // Update tornado
        StarfieldSystem.updateUFO(); // Update UFO animation (42 lines easter egg)
        updateEarthquake(); // Update earthquake
        updateDisintegrationParticles(); // Update explosion particles
        updateBlackHoleAnimation(); // Update black hole animation
        updateTsunamiAnimation(); // Update tsunami animation
        updateVolcanoAnimation(); // Update volcano animation
        updateFallingBlocks(); // Update falling blocks from gravity
        updateBouncingPieces(); // Update bouncing pieces (Rubber & Glue mode)
        GamepadController.update(); // Update gamepad controller input
    }
    
    // Apply horizontal earthquake shake during shake, crack and shift phases
    if (earthquakeActive && (earthquakePhase === 'shake' || earthquakePhase === 'crack' || earthquakePhase === 'shift')) {
        const shakeX = (Math.random() - 0.5) * earthquakeShakeIntensity * 2;
        ctx.save();
        ctx.translate(shakeX, 0);
    }
    
    // Apply screen shake during black hole
    if (blackHoleAnimating && blackHoleShakeIntensity > 0) {
        const shakeX = (Math.random() - 0.5) * blackHoleShakeIntensity;
        const shakeY = (Math.random() - 0.5) * blackHoleShakeIntensity;
        if (!earthquakeActive) {
            ctx.save();
        }
        ctx.translate(shakeX, shakeY);
    }
    
    // Apply vertical wobble during tsunami
    if (tsunamiAnimating && tsunamiWobbleIntensity > 0) {
        const wobbleY = Math.sin(Date.now() / 100) * tsunamiWobbleIntensity;
        if (!blackHoleAnimating && !earthquakeActive) { // Don't double-save if black hole or earthquake is also active
            ctx.save();
        }
        ctx.translate(0, wobbleY);
    }
    
    // Apply nervous mode vibration (constant random vertical shake)
    const isNervousMode = challengeMode === 'nervous' || activeChallenges.has('nervous') || soRandomCurrentMode === 'nervous';
    
    // Apply or remove nervous shake CSS class to canvas
    if (isNervousMode && !paused) {
        canvas.classList.add('nervous-active');
    } else {
        canvas.classList.remove('nervous-active');
    }
    
    // No longer need canvas translation for nervous mode
    
    // Draw board and blocks
    if (earthquakeActive && earthquakePhase === 'shift') {
        // During shift, earthquake handles all rendering
        drawEarthquake();
    } else if (earthquakeActive && earthquakePhase === 'crack') {
        // During crack, earthquake draws board + dark seams
        drawEarthquake();
    } else {
        // Normal rendering (including shake phase)
        drawBoard();
        drawFallingBlocks();
    }
    
    drawTsunami(); // Draw tsunami collapsing blocks
    drawVolcano(); // Draw volcano lava and projectiles
    drawTornado(); // Draw tornado on top of board
    drawDisintegrationParticles(); // Draw explosion particles on top
    drawBouncingPieces(); // Draw bouncing pieces (Rubber & Glue mode)
    if (currentPiece && currentPiece.shape) {
        drawShadowPiece(currentPiece);
        // During hard drop, use smooth pixel-based rendering
        if (hardDropping) {
            const pixelOffset = hardDropPixelY - (currentPiece.y * BLOCK_SIZE);
            drawPiece(currentPiece, ctx, 0, 0, pixelOffset);
        } else {
            drawPiece(currentPiece);
        }
    }
    
    // Draw dripping liquids ON TOP of everything (obscuring the stack)
    drawDrippingLiquids();
    
    // Remove tsunami wobble transform
    if (tsunamiAnimating && tsunamiWobbleIntensity > 0) {
        if (!blackHoleAnimating && !earthquakeActive) { // Only restore if we saved (not both active)
            ctx.restore();
        }
    }
    
    // No longer need to restore for nervous mode - using CSS animation instead
    
    // Remove black hole shake transform
    if (blackHoleAnimating && blackHoleShakeIntensity > 0) {
        if (!earthquakeActive) {
            ctx.restore();
        }
    }
    
    // Remove earthquake shake transform
    if (earthquakeActive && (earthquakePhase === 'shake' || earthquakePhase === 'crack' || earthquakePhase === 'shift')) {
        ctx.restore();
    }
    
    // Update and draw histogram
    if (!paused) {
        updateHistogram();
    }
    drawHistogram();
    
    // Draw pause indicator
    if (paused) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText('PAUSED', canvas.width / 2, canvas.height / 2);
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
        ctx.restore();
    }

    gameLoop = requestAnimationFrame(update);
}

function startGame(mode) {
    // Hide leaderboard if it was shown
    if (window.leaderboard && window.leaderboard.hideLeaderboard) {
        window.leaderboard.hideLeaderboard();
    }
    
			gameStartTime = Date.now(); 
    gameMode = mode;
    lastPlayedMode = mode; // Remember this mode for next time
    
    // CRITICAL: Clear the canvas immediately to remove any leftover rendering
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // If in developer mode, turn off music
    if (developerMode && musicToggle.checked) {
        musicToggle.checked = false;
        musicToggle.dispatchEvent(new Event('change'));
        console.log('🔇 Developer Mode: Music disabled');
    }
    
    // Clean up any active canvas classes
    canvas.classList.remove('nervous-active', 'tsunami-active', 'blackhole-active', 'touchdown-active');
    
    // Configure game based on mode
    switch(mode) {
        case 'drizzle':
            // Easier mode - 4 colors (max contrast)
            COLS = 10;
            hailstormEnabled = false;
            dropInterval = 1000;
            currentColorSet = COLOR_SETS[4];
            break;
        case 'downpour':
            // Standard mode - 6 colors (max contrast)
            COLS = 10;
            hailstormEnabled = false;
            dropInterval = 1000;
            currentColorSet = COLOR_SETS[6];
            break;
        case 'hailstorm':
            // 8 colors - all colors
            COLS = 10;
            hailstormEnabled = false;
            dropInterval = 1000;
            currentColorSet = COLOR_SETS[8];
            break;
        case 'blizzard':
            // 12 wide + 5-block pieces - 5 colors (max contrast)
            COLS = 12;
            hailstormEnabled = false;
            dropInterval = 1000;
            currentColorSet = COLOR_SETS[5];
            break;
        case 'hurricane':
            // 12 wide + 5-block pieces - 7 colors (max contrast)
            COLS = 12;
            hailstormEnabled = false;
            dropInterval = 1000;
            currentColorSet = COLOR_SETS[7];
            break;
    }
    
    // Update canvas size for the selected mode
    updateCanvasSize();
    
    // Clear any existing pieces before initializing board
    currentPiece = null;
    nextPieceQueue = [];
    
    // CRITICAL: Reset challenge modes to prevent carryover
    console.log('🎮 Starting new game - Before reset:');
    console.log('  challengeMode:', challengeMode);
    console.log('  activeChallenges:', Array.from(activeChallenges));
    
    // Challenge mode is already set by the combo modal via applyChallengeMode
    // The challengeMode and activeChallenges are already correct
    const selectedChallenge = challengeMode;
    console.log('  Selected challenge:', selectedChallenge);
    
    // Only clear activeChallenges if NOT in combo mode
    // In combo mode, the challenges were already set by the combo modal
    if (selectedChallenge !== 'combo') {
        activeChallenges.clear();
    }
    
    // CRITICAL: Clear any keyboard state from previous game
    console.log('⌨️  Clearing keyboard state');
    console.log('  Keys pressed before clear:', Array.from(customKeyRepeat.keys.keys()));
    console.log('  hardDropping before clear:', hardDropping);
    
    // Clear hard drop state
    hardDropping = false;
    hardDropVelocity = 0;
    hardDropPixelY = 0;
    hardDropStartY = 0;
    
    // Clear all pressed keys
    customKeyRepeat.keys.clear();
    
    // Clear and cancel all keyboard timers
    customKeyRepeat.timers.forEach((timer, key) => {
        clearInterval(timer);
        clearTimeout(timer);
    });
    customKeyRepeat.timers.clear();
    
    // Clear all touch repeat timers
    touchRepeat.timers.forEach((timerObj, element) => {
        if (timerObj.initial) clearTimeout(timerObj.initial);
        if (timerObj.repeat) clearInterval(timerObj.repeat);
    });
    touchRepeat.timers.clear();
    
    console.log('  Keys pressed after clear:', Array.from(customKeyRepeat.keys.keys()));
    
    console.log('🎮 After reset:');
    console.log('  challengeMode:', challengeMode);
    console.log('  activeChallenges:', Array.from(activeChallenges));
    
    initBoard();
    
    // Explicitly clear the board arrays again to be absolutely sure
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            board[y][x] = null;
            isRandomBlock[y][x] = false;
            isLatticeBlock[y][x] = false;
            fadingBlocks[y][x] = null;
        }
    }
    
    // Debug: Count how many blocks are on the board
    let blockCount = 0;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] !== null) blockCount++;
        }
    }
    console.log('🧹 Board cleared - block count:', blockCount);
    
    score = 0;
    lines = 0;
    level = 1;
    strikeCount = 0;
    tsunamiCount = 0;
    blackHoleCount = 0;
    gameStartTime = Date.now(); // Track game duration
    volcanoCount = 0;
    currentGameLevel = 1; StarfieldSystem.setCurrentGameLevel(1); // Reset starfield journey
    StarfieldSystem.reset(); // Reset all starfield state (planets, asteroids, journey)
    lineAnimations = [];
    animatingLines = false;
    pendingLineCheck = false;
    paused = false; StarfieldSystem.setPaused(false);
    hailstormCounter = 0;
    triggeredTsunamis.clear();
    
    // Reset tornado state
    tornadoActive = false;
    stopTornadoWind(); // Make sure wind sound stops
    tornadoState = 'descending';
    tornadoY = 0;
    tornadoX = 0;
    tornadoSpeed = 8;
    tornadoCol = 0;
    
    tornadoRow = 0;
    tornadoRotation = 0;
    tornadoPickedBlob = null;
    tornadoLiftStartY = 0;
    tornadoLiftHeight = 0;
    tornadoOrbitAngle = 0;
    tornadoOrbitRadius = 0;
    tornadoOrbitStartTime = 0;
    tornadoBlobRotation = 0;
    tornadoVerticalRotation = 0;
    tornadoDropTargetX = 0;
    tornadoDropStartY = 0;
    
    // Reset earthquake state
    earthquakeActive = false;
    earthquakePhase = 'shake'; // Reset to shake phase
    earthquakeShakeProgress = 0;
    earthquakeCrack = [];
    earthquakeCrackMap.clear();
    earthquakeCrackProgress = 0;
    earthquakeShiftProgress = 0;
    earthquakeLeftBlocks = [];
    earthquakeRightBlocks = [];
    tornadoFadeProgress = 0;
    tornadoParticles = [];
    
    // Reset black hole state
    blackHoleActive = false;
    blackHoleAnimating = false;
    blackHoleBlocks = [];
    blackHoleShakeIntensity = 0;
    blackHoleInnerBlob = null;
    blackHoleOuterBlob = null;
    
    // Reset falling blocks state
    fallingBlocks = [];
    gravityAnimating = false;
    
    // Reset tsunami state
    tsunamiActive = false;
    tsunamiAnimating = false;
    tsunamiBlob = null;
    tsunamiBlocks = [];
    tsunamiPushedBlocks = [];
    tsunamiWobbleIntensity = 0;
    
    // Reset volcano state
    volcanoActive = false;
    volcanoAnimating = false;
    volcanoLavaBlob = null;
    volcanoEruptionColumn = -1;
    volcanoProjectiles = [];
    
    // Hide planet stats
    StarfieldSystem.hidePlanetStats();
    
    // Show Sun stats at level 1
    const planets = StarfieldSystem.getPlanets();
    const sun = planets.find(p => p.isSun);
    if (sun) {
        StarfieldSystem.showPlanetStats(sun);
    }
    
    initHistogram(); // Initialize histogram for current color set
    stormParticles = []; // Clear storm particles
    splashParticles = []; // Clear splash particles
    liquidPools = []; // Clear blood/poo rain effects
    updateStats();
    
    // Initialize new Challenge mode variables
    sixSevenCounter = 0;
    sixSevenNextTarget = Math.random() < 0.5 ? 6 : 7;
    sixSevenNextSize = sixSevenNextTarget;
    
    gremlinsCounter = 0;
    gremlinsNextTarget = 1 + Math.random() * 2; // Between 1 and 3 lines (twice as frequent)
    gremlinFadingBlocks = []; // Clear any fading gremlin blocks
    
    soRandomCurrentMode = 'normal';
    
    // Mercurial mode: Initialize color change timer
    mercurialTimer = 0;
    mercurialInterval = 2000 + Math.random() * 2000; // Start with 2-4 seconds
    
    // Lattice mode: Pre-fill bottom half with random blocks
    const isLatticeMode = challengeMode === 'lattice' || activeChallenges.has('lattice');
    console.log('🧱 Lattice check:');
    console.log('  isLatticeMode:', isLatticeMode);
    console.log('  challengeMode === "lattice":', challengeMode === 'lattice');
    console.log('  activeChallenges.has("lattice"):', activeChallenges.has('lattice'));
    
    if (isLatticeMode) {
        console.log('⚠️ LATTICE MODE ACTIVE - Filling bottom half with blocks!');
        const halfRows = Math.floor(ROWS / 2);
        // Average 4 blocks per line
        for (let y = halfRows; y < ROWS; y++) {
            const blocksThisLine = Math.floor(Math.random() * 3) + 3; // 3-5 blocks per line
            const positions = [];
            
            // Generate random positions for this line
            while (positions.length < blocksThisLine) {
                const x = Math.floor(Math.random() * COLS);
                if (!positions.includes(x)) {
                    positions.push(x);
                }
            }
            
            // Place blocks and mark them as lattice blocks
            positions.forEach(x => {
                board[y][x] = randomColor();
                isRandomBlock[y][x] = false; // Not marked as random hail blocks
                isLatticeBlock[y][x] = true; // Mark as lattice block (immune to gravity)
            });
        }
    }
    
    // So Random mode: Start with a random challenge
    if (challengeMode === 'sorandom') {
        switchSoRandomMode();
    }
    
    currentPiece = createPiece();
    // Initialize the next piece queue with 4 pieces
    nextPieceQueue = [];
    for (let i = 0; i < NEXT_PIECE_COUNT; i++) {
        nextPieceQueue.push(createPiece());
    }
    drawNextPiece();
    
    gameRunning = true; StarfieldSystem.setGameRunning(true);
    document.body.classList.add('game-running');
    document.body.classList.add('game-started');
    gameOverDiv.style.display = 'none';
    modeMenu.classList.add('hidden');
    toggleUIElements(false); // Hide UI elements when game starts
    stopMenuMusic();
    startMusic(gameMode, musicToggle);
    update();
}

// Comprehensive keyboard handler
document.addEventListener('keydown', e => {
    // F11, PageUp, PageDown - Toggle fullscreen (anytime)
    if (e.key === 'F11' || e.key === 'PageUp' || e.key === 'PageDown') {
        e.preventDefault();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen().catch(err => {
                    // Silently handle fullscreen errors (permissions, etc.)
                });
            }
        }
        return;
    }
    
    // GAME CONTROLS - Only when game is running
    if (gameRunning) {
        // If paused, any key (except F11/PageUp/PageDown) unpauses
        if (paused) {
            e.preventDefault();
            paused = false; StarfieldSystem.setPaused(false);
            settingsBtn.classList.add('hidden-during-play');
            // Show pause button again (only in tablet mode)
            const pauseBtn = document.getElementById('pauseBtn');
            if (pauseBtn && TabletMode.enabled) pauseBtn.style.display = 'block';
            if (musicToggle.checked) {
                startMusic(gameMode, musicToggle);
            }
            return;
        }
        
        // Handle pause with P, Pause, or Break keys
        if (e.key === 'p' || e.key === 'P' || e.key === 'Pause' || e.key === 'Break') {
            e.preventDefault();
            
            // Capture snapshot before pausing
            captureCanvasSnapshot();
            
            paused = true; StarfieldSystem.setPaused(true);
            justPaused = true;
            setTimeout(() => { justPaused = false; }, 300);
            settingsBtn.classList.remove('hidden-during-play');
            // Hide pause button while paused
            const pauseBtn = document.getElementById('pauseBtn');
            if (pauseBtn) pauseBtn.style.display = 'none';
            stopMusic(); // stopMusic() already checks internally if music is playing
            return;
        }
        
        // SHIFT key - Spawn tornado (developer mode only)
        if (e.key === 'Shift' && developerMode) {
            e.preventDefault();
            spawnTornado();
            return;
        }
        
        // TAB key - Advance to next planet (developer mode only)
        if (e.key === 'Tab' && developerMode) {
            e.preventDefault();
            advanceToNextPlanet();
            return;
        }
        
        // TILDE/BACKTICK key - Spawn earthquake (developer mode only)
        if ((e.key === '`' || e.key === '~') && developerMode) {
            e.preventDefault();
            spawnEarthquake();
            return;
        }
        
        // U key - Trigger UFO (developer mode only)
        if ((e.key === 'u' || e.key === 'U') && developerMode) {
            e.preventDefault();
            StarfieldSystem.triggerUFO();
            return;
        }
        
        // Backspace key - Trigger lightning (developer mode only)
        if (e.key === 'Backspace' && developerMode) {
            e.preventDefault();
            triggerLightning(300);
            return;
        }
        
        if (paused || !currentPiece) return;

        // Custom key repeat system - ignore browser's repeat events entirely
        if (e.repeat) {
            e.preventDefault();
            return; // Ignore all browser repeat events
        }
        
        // Handle game control keys with custom repeat
        const gameControlKeys = {
            'ArrowLeft': () => movePiece(-1),
            'ArrowRight': () => movePiece(1),
            'ArrowDown': () => dropPiece(),
            'ArrowUp': () => rotatePiece(),
            '4': () => movePiece(-1),
            '6': () => movePiece(1),
            '2': () => dropPiece(),
            '5': () => rotatePieceCounterClockwise(),
            'Clear': () => rotatePieceCounterClockwise(),
            '8': () => rotatePiece(),
            '0': () => hardDrop(),
            'Insert': () => hardDrop()
        };
        
        // Check if this is a game control key
        if (gameControlKeys[e.key] && !customKeyRepeat.keys.has(e.key)) {
            // Mark key as pressed
            customKeyRepeat.keys.set(e.key, true);
            
            // Execute action immediately on first press
            gameControlKeys[e.key]();
            
            // Set up initial delay before repeating
            const initialTimer = setTimeout(() => {
                // Start repeating at specified rate
                const repeatTimer = setInterval(() => {
                    if (customKeyRepeat.keys.has(e.key) && !paused && currentPiece) {
                        gameControlKeys[e.key]();
                    } else {
                        clearInterval(repeatTimer);
                        customKeyRepeat.timers.delete(e.key);
                    }
                }, customKeyRepeat.repeatRate);
                
                customKeyRepeat.timers.set(e.key, repeatTimer);
            }, customKeyRepeat.initialDelay);
            
            customKeyRepeat.timers.set(e.key + '_init', initialTimer);
        }

        // Handle spacebar separately (no repeat needed for hard drop)
        if (e.key === ' ') {
            e.preventDefault();
            if (!customKeyRepeat.keys.has(' ')) {
                customKeyRepeat.keys.set(' ', true);
                hardDrop();
            }
        }

        return;
    }
    
    // MENU NAVIGATION - When mode menu is visible
    // Capture menu state at start of handler (before other handlers might change it)
    const menuWasVisible = !modeMenu.classList.contains('hidden');
    if (menuWasVisible) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedModeIndex = (selectedModeIndex - 1 + modeButtonsArray.length) % modeButtonsArray.length;
            updateSelectedMode();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedModeIndex = (selectedModeIndex + 1) % modeButtonsArray.length;
            updateSelectedMode();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const mode = modeButtonsArray[selectedModeIndex].getAttribute('data-mode');
            startGame(mode);
        }
        return;
    }
    
    // GAME OVER - Enter to play again
    if (gameOverDiv.style.display === 'block') {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopImmediatePropagation(); // Prevent other handlers from also processing this
            playAgainBtn.click();
        }
    }
});

// Keyup handler to clear custom repeat state and timers
document.addEventListener('keyup', e => {
    // Clear state for this key
    customKeyRepeat.keys.delete(e.key);
    
    // Clear any active timers for this key
    if (customKeyRepeat.timers.has(e.key)) {
        clearInterval(customKeyRepeat.timers.get(e.key));
        customKeyRepeat.timers.delete(e.key);
    }
    if (customKeyRepeat.timers.has(e.key + '_init')) {
        clearTimeout(customKeyRepeat.timers.get(e.key + '_init'));
        customKeyRepeat.timers.delete(e.key + '_init');
    }
});

// Mode selection handlers
modeButtons.forEach(button => {
    button.addEventListener('click', () => {
        const mode = button.getAttribute('data-mode');
        startGame(mode);
    });
});

// Keyboard navigation setup for mode menu
let selectedModeIndex = 0;
const modeButtonsArray = Array.from(modeButtons);

function updateSelectedMode() {
    modeButtonsArray.forEach((btn, index) => {
        if (index === selectedModeIndex) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
    
    // Update leaderboard to match selected mode if visible
    const leaderboardContent = document.getElementById('leaderboardContent');
    if (leaderboardContent && leaderboardContent.style.display !== 'none' && window.leaderboard) {
        const selectedMode = modeButtonsArray[selectedModeIndex].getAttribute('data-mode');
        const gameMode = challengeMode !== 'normal' ? 'challenge' : 'normal';
        window.leaderboard.displayLeaderboard(selectedMode, null, gameMode);
    }
}

// Initialize first button as selected
updateSelectedMode();

playAgainBtn.addEventListener('click', () => {
    gameOverDiv.style.display = 'none';
    modeMenu.classList.remove('hidden');
    document.body.classList.remove('game-started');
    toggleUIElements(true); // Show UI elements when returning to menu
    
    // Hide planet stats
    StarfieldSystem.hidePlanetStats();
    const planetStats = document.getElementById('planetStats');
    const planetStatsLeft = document.getElementById('planetStatsLeft');
    if (planetStats) planetStats.style.display = 'none';
    if (planetStatsLeft) planetStatsLeft.style.display = 'none';
    
    // Clear pieces from previous game
    currentPiece = null;
    nextPieceQueue = [];
    
    // Reset canvas to standard width in case we were in Blizzard/Hurricane
    COLS = 10;
    updateCanvasSize();
    
    // CRITICAL: Clear the canvas to remove any leftover rendering
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Initialize empty board
    initBoard();
    
    // Explicitly clear ALL board arrays to ensure no leftover pieces
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            board[y][x] = null;
            isRandomBlock[y][x] = false;
            isLatticeBlock[y][x] = false;
            fadingBlocks[y][x] = null;
        }
    }
    
    // Don't call drawBoard() here - it draws the semi-transparent background
    // The canvas has already been cleared above, leave it transparent for menu
    startMenuMusic(musicToggle);
    // Select the last played mode
    if (lastPlayedMode) {
        const modeIndex = modeButtonsArray.findIndex(btn => btn.getAttribute('data-mode') === lastPlayedMode);
        if (modeIndex !== -1) {
            selectedModeIndex = modeIndex;
        } else {
            selectedModeIndex = 0;
        }
    } else {
        selectedModeIndex = 0;
    }
    updateSelectedMode();
});

// Settings popup handlers
settingsBtn.addEventListener('click', () => {
    wasPausedBeforeSettings = paused;
    if (gameRunning && !paused) {
        // Capture snapshot before pausing
        captureCanvasSnapshot();
        
        paused = true; StarfieldSystem.setPaused(true);
        justPaused = true;
        setTimeout(() => { justPaused = false; }, 300);
        // Hide pause button while settings is open
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) pauseBtn.style.display = 'none';
        // Don't toggle UI - keep histogram visible
        stopMusic(); // stopMusic() already checks internally if music is playing
    }
    settingsOverlay.style.display = 'flex';
});

settingsCloseBtn.addEventListener('click', () => {
    settingsOverlay.style.display = 'none';
    if (gameRunning && !wasPausedBeforeSettings) {
        paused = false; StarfieldSystem.setPaused(false);
        // Show pause button again (only in tablet mode)
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn && TabletMode.enabled) pauseBtn.style.display = 'block';
        // Don't toggle UI - keep histogram visible
        if (musicToggle.checked) {
            startMusic(gameMode, musicToggle);
        }
    }
});

// Close settings when clicking outside the popup
settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) {
        settingsCloseBtn.click();
    }
});

opacitySlider.addEventListener('input', (e) => {
    faceOpacity = parseFloat(e.target.value) / 100; // Convert 0-100 to 0-1
});

cameraOrientationToggle.addEventListener('change', (e) => {
    cameraReversed = e.target.checked;
    StarfieldSystem.setCameraReversed(cameraReversed);
    // Reset planet animations when camera changes
    StarfieldSystem.setPlanetAnimations({});
});

starSpeedSlider.addEventListener('input', (e) => {
    const speed = parseFloat(e.target.value);
    if (speed === 0) {
        // Turn stars off completely at minimum
        if (StarfieldSystem.setStarsEnabled) {
            StarfieldSystem.setStarsEnabled(false);
        }
    } else {
        // Turn stars on and set speed
        if (StarfieldSystem.setStarsEnabled) {
            StarfieldSystem.setStarsEnabled(true);
        }
        StarfieldSystem.setStarSpeed(speed);
    }
});

// Minimalist mode toggle (Developer only)
minimalistToggle.addEventListener('change', (e) => {
    minimalistMode = e.target.checked;
    applyMinimalistMode();
    StarfieldSystem.setMinimalistMode(minimalistMode);
});

function applyMinimalistMode() {
    if (minimalistMode) {
        document.body.classList.add('minimalist-mode');
    } else {
        document.body.classList.remove('minimalist-mode');
    }
    // Redraw canvas background with new transparency
    drawCanvasBackground();
    if (gameRunning) {
        drawBoard();
    }
}

musicToggle.addEventListener('change', (e) => {
    if (!e.target.checked) {
        stopMusic();
        stopMenuMusic();
    } else if (e.target.checked) {
        // When turning music on, start appropriate music
        // The start functions already check if music is already playing
        if (gameRunning) {
            startMusic(gameMode, musicToggle);
        } else {
            startMenuMusic(musicToggle);
        }
    }
});

// Challenge mode handlers
const challengeSelectBtn = document.getElementById('challengeSelectBtn');
const comboModalOverlay = document.getElementById('comboModalOverlay');
const comboApplyBtn = document.getElementById('comboApplyBtn');
const comboCancelBtn = document.getElementById('comboCancelBtn');
const comboStranger = document.getElementById('comboStranger');
const comboDyslexic = document.getElementById('comboDyslexic');
const comboPhantom = document.getElementById('comboPhantom');
const comboRubber = document.getElementById('comboRubber');
const comboOz = document.getElementById('comboOz');
const comboThinner = document.getElementById('comboThinner');
const comboThicker = document.getElementById('comboThicker');
const comboNervous = document.getElementById('comboNervous');
const comboCarrie = document.getElementById('comboCarrie');
const comboNokings = document.getElementById('comboNokings');
const comboLongAgo = document.getElementById('comboLongAgo');
const comboComingSoon = document.getElementById('comboComingSoon');
const comboSixSeven = document.getElementById('comboSixSeven');
const comboGremlins = document.getElementById('comboGremlins');
const comboLattice = document.getElementById('comboLattice');
const comboYesAnd = document.getElementById('comboYesAnd');
const comboMercurial = document.getElementById('comboMercurial');
const comboShadowless = document.getElementById('comboShadowless');
const comboBonusPercent = document.getElementById('comboBonusPercent');

// Function to update combo bonus display
function updateComboBonusDisplay() {
    // Define bonus percentages for each challenge based on difficulty
    const challengeBonuses = {
        'stranger': 7,     // Upside down
        'dyslexic': 6,     // Reversed controls
        'phantom': 7,      // Invisible stack
        'gremlins': 6,     // Random disappearing blocks
        'rubber': 5,       // Bouncing pieces
        'oz': 5,           // Grayscale until landing
        'lattice': 5,      // Pre-filled blocks
        'yesand': 5,       // Random extra blocks
        'mercurial': 4,    // Color-shifting pieces
        'sixseven': 4,     // Occasional giant pieces
        'longago': 4,      // Perspective distortion
        'comingsoon': 4,   // Reverse perspective
        'thinner': 4,      // Visual compression
        'shadowless': 4,   // No shadow guide
        'thicker': 3,      // Wider well (easier)
        'carrie': 3,       // Visual distraction
        'nokings': 3,      // Visual distraction
        'nervous': 2       // Minor vibration - lowest difficulty
    };
    
    // Map checkboxes to their challenge types
    const checkboxMap = [
        { checkbox: comboStranger, type: 'stranger' },
        { checkbox: comboDyslexic, type: 'dyslexic' },
        { checkbox: comboPhantom, type: 'phantom' },
        { checkbox: comboRubber, type: 'rubber' },
        { checkbox: comboOz, type: 'oz' },
        { checkbox: comboThinner, type: 'thinner' },
        { checkbox: comboThicker, type: 'thicker' },
        { checkbox: comboCarrie, type: 'carrie' },
        { checkbox: comboNokings, type: 'nokings' },
        { checkbox: comboLongAgo, type: 'longago' },
        { checkbox: comboComingSoon, type: 'comingsoon' },
        { checkbox: comboNervous, type: 'nervous' },
        { checkbox: comboSixSeven, type: 'sixseven' },
        { checkbox: comboGremlins, type: 'gremlins' },
        { checkbox: comboLattice, type: 'lattice' },
        { checkbox: comboYesAnd, type: 'yesand' },
        { checkbox: comboMercurial, type: 'mercurial' },
        { checkbox: comboShadowless, type: 'shadowless' }
    ].filter(item => item.checkbox); // Filter out null checkboxes
    
    // Calculate total bonus
    let totalBonus = 0;
    checkboxMap.forEach(item => {
        if (item.checkbox.checked) {
            totalBonus += challengeBonuses[item.type];
        }
    });
    
    comboBonusPercent.textContent = totalBonus + '%';
}

// Add change listeners to all combo checkboxes to update bonus display
[comboStranger, comboDyslexic, comboPhantom, comboRubber, comboOz,
 comboThinner, comboThicker, comboCarrie, comboNokings,
 comboLongAgo, comboComingSoon, comboNervous, comboSixSeven, comboGremlins,
 comboLattice, comboYesAnd, comboMercurial, comboShadowless].filter(cb => cb).forEach(checkbox => {
    checkbox.addEventListener('change', updateComboBonusDisplay);
});

// Mutual exclusivity: Long Ago and Coming Soon cannot both be selected
comboLongAgo.addEventListener('change', (e) => {
    if (e.target.checked && comboComingSoon.checked) {
        comboComingSoon.checked = false;
    }
    updateComboBonusDisplay();
});

comboComingSoon.addEventListener('change', (e) => {
    if (e.target.checked && comboLongAgo.checked) {
        comboLongAgo.checked = false;
    }
    updateComboBonusDisplay();
});

// Mutual exclusivity: Thinner and Thicker cannot both be selected
comboThinner.addEventListener('change', (e) => {
    if (e.target.checked && comboThicker.checked) {
        comboThicker.checked = false;
    }
    updateComboBonusDisplay();
});

comboThicker.addEventListener('change', (e) => {
    if (e.target.checked && comboThinner.checked) {
        comboThinner.checked = false;
    }
    updateComboBonusDisplay();
});

// Helper function to populate combo modal checkboxes
function populateComboModal() {
    comboStranger.checked = activeChallenges.has('stranger');
    comboDyslexic.checked = activeChallenges.has('dyslexic');
    comboPhantom.checked = activeChallenges.has('phantom');
    comboRubber.checked = activeChallenges.has('rubber');
    comboOz.checked = activeChallenges.has('oz');
    comboThinner.checked = activeChallenges.has('thinner');
    comboThicker.checked = activeChallenges.has('thicker');
    comboNervous.checked = activeChallenges.has('nervous');
    comboCarrie.checked = activeChallenges.has('carrie');
    comboNokings.checked = activeChallenges.has('nokings');
    comboLongAgo.checked = activeChallenges.has('longago');
    comboComingSoon.checked = activeChallenges.has('comingsoon');
    comboSixSeven.checked = activeChallenges.has('sixseven');
    comboGremlins.checked = activeChallenges.has('gremlins');
    comboLattice.checked = activeChallenges.has('lattice');
    comboYesAnd.checked = activeChallenges.has('yesand');
    if (comboMercurial) comboMercurial.checked = activeChallenges.has('mercurial');
    if (comboShadowless) comboShadowless.checked = activeChallenges.has('shadowless');
    updateComboBonusDisplay();
}

// Challenge display names for the button label
const challengeDisplayNames = {
    'normal': 'Normal',
    'stranger': 'Stranger',
    'dyslexic': 'Dyslexic',
    'phantom': 'Phantom',
    'rubber': 'Rubber & Glue',
    'oz': 'Oz',
    'thinner': 'Thinner',
    'thicker': 'Thicker',
    'carrie': 'Carrie',
    'nokings': 'No Kings',
    'longago': 'Long Ago...',
    'comingsoon': 'Coming Soon...',
    'nervous': 'Nervous',
    'sixseven': 'Six Seven',
    'gremlins': 'Gremlins',
    'lattice': 'Lattice',
    'yesand': 'Yes, And...',
    'mercurial': 'Mercurial',
    'sorandom': 'So Random',
    'combo': 'Combo'
};

// Function to update the button label based on current selection
function updateChallengeButtonLabel() {
    if (challengeMode === 'normal' && activeChallenges.size === 0) {
        challengeSelectBtn.textContent = 'Normal';
    } else if (challengeMode === 'combo' || activeChallenges.size > 1) {
        // Show count of challenges
        const names = Array.from(activeChallenges).map(c => challengeDisplayNames[c] || c);
        if (names.length <= 2) {
            challengeSelectBtn.textContent = names.join(' + ');
        } else {
            challengeSelectBtn.textContent = `${names.length} Challenges`;
        }
    } else if (activeChallenges.size === 1) {
        const mode = Array.from(activeChallenges)[0];
        challengeSelectBtn.textContent = challengeDisplayNames[mode] || mode;
    } else {
        challengeSelectBtn.textContent = challengeDisplayNames[challengeMode] || challengeMode;
    }
}

// Button click opens the combo modal
challengeSelectBtn.addEventListener('click', () => {
    populateComboModal();
    comboModalOverlay.style.display = 'flex';
});

comboApplyBtn.addEventListener('click', () => {
    // Collect selected challenges
    activeChallenges.clear();
    if (comboStranger.checked) activeChallenges.add('stranger');
    if (comboDyslexic.checked) activeChallenges.add('dyslexic');
    if (comboPhantom.checked) activeChallenges.add('phantom');
    if (comboRubber.checked) activeChallenges.add('rubber');
    if (comboOz.checked) activeChallenges.add('oz');
    if (comboThinner.checked) activeChallenges.add('thinner');
    if (comboThicker.checked) activeChallenges.add('thicker');
    if (comboNervous.checked) activeChallenges.add('nervous');
    if (comboCarrie.checked) activeChallenges.add('carrie');
    if (comboNokings.checked) activeChallenges.add('nokings');
    if (comboLongAgo.checked) activeChallenges.add('longago');
    if (comboComingSoon.checked) activeChallenges.add('comingsoon');
    if (comboSixSeven.checked) activeChallenges.add('sixseven');
    if (comboGremlins.checked) activeChallenges.add('gremlins');
    if (comboLattice.checked) activeChallenges.add('lattice');
    if (comboYesAnd.checked) activeChallenges.add('yesand');
    if (comboMercurial && comboMercurial.checked) activeChallenges.add('mercurial');
    if (comboShadowless && comboShadowless.checked) activeChallenges.add('shadowless');
    
    // Determine challenge mode based on selection count
    if (activeChallenges.size === 0) {
        challengeMode = 'normal';
    } else if (activeChallenges.size === 1) {
        challengeMode = Array.from(activeChallenges)[0];
    } else {
        challengeMode = 'combo';
    }
    
    applyChallengeMode(challengeMode);
    updateChallengeButtonLabel();
    comboModalOverlay.style.display = 'none';
    
    // Refresh leaderboard to show correct mode
    const leaderboardContent = document.getElementById('leaderboardContent');
    if (leaderboardContent && leaderboardContent.style.display !== 'none' && window.leaderboard) {
        const selectedMode = modeButtonsArray[selectedModeIndex].getAttribute('data-mode');
        const gameMode = challengeMode !== 'normal' ? 'challenge' : 'normal';
        window.leaderboard.displayLeaderboard(selectedMode, null, gameMode);
    }
    
    console.log('🎯 Challenges applied:', challengeMode, Array.from(activeChallenges));
});

comboCancelBtn.addEventListener('click', () => {
    comboModalOverlay.style.display = 'none';
    
    // Refresh leaderboard to match current mode
    const leaderboardContent = document.getElementById('leaderboardContent');
    if (leaderboardContent && leaderboardContent.style.display !== 'none' && window.leaderboard) {
        const selectedMode = modeButtonsArray[selectedModeIndex].getAttribute('data-mode');
        const gameMode = challengeMode !== 'normal' ? 'challenge' : 'normal';
        window.leaderboard.displayLeaderboard(selectedMode, null, gameMode);
    }
});

// Close combo modal when clicking outside
comboModalOverlay.addEventListener('click', (e) => {
    if (e.target === comboModalOverlay) {
        comboCancelBtn.click();
    }
});

function applyChallengeMode(mode) {
    // Remove all challenge effects first
    document.documentElement.classList.remove('stranger-mode');
    StarfieldSystem.setStrangerMode(false);
    StarfieldSystem.removeVineOverlay();
    canvas.classList.remove('thinner-mode', 'thicker-mode', 'longago-mode', 'comingsoon-mode', 'nervous-active');
    
    bouncingPieces = [];
    if (phantomFadeInterval) {
        clearInterval(phantomFadeInterval);
        phantomFadeInterval = null;
    }
    phantomOpacity = 1.0; // Reset to visible
    nervousVibrateOffset = 0; // Reset vibration
    liquidPools = []; // Clear blood/poo rain effects
    
    // Clear activeChallenges if not in combo mode
    if (mode !== 'combo') {
        activeChallenges.clear();
    }
    
    challengeMode = mode;
    
    // Apply effects based on mode
    if (mode === 'stranger' || activeChallenges.has('stranger')) {
        document.documentElement.classList.add('stranger-mode');
        StarfieldSystem.setStrangerMode(true);
        StarfieldSystem.createVineOverlay(canvas);
        StarfieldSystem.createVineOverlay(nextCanvas);
        console.log('🙃 STRANGER MODE: Upside-down activated!');
    }
    
    if (mode === 'phantom' || activeChallenges.has('phantom')) {
        phantomOpacity = 0; // Start invisible
        console.log('👻 PHANTOM MODE: Invisible stack activated!');
    }
    
    if (mode === 'rubber' || activeChallenges.has('rubber')) {
        console.log('🏀 RUBBER & GLUE MODE: Bouncing activated!');
    }
    
    if (mode === 'oz' || activeChallenges.has('oz')) {
        console.log('🌈 OZ MODE: Grayscale until landing activated!');
    }
    
    if (mode === 'thinner' || activeChallenges.has('thinner')) {
        canvas.classList.add('thinner-mode');
        console.log('📏 THINNER MODE: Skinny well activated!');
    }
    
    if (mode === 'thicker' || activeChallenges.has('thicker')) {
        canvas.classList.add('thicker-mode');
        console.log('📐 THICKER MODE: Wide well activated!');
        // updateCanvasSize will be called at the end of this function
    }
    
    if (mode === 'nervous' || activeChallenges.has('nervous')) {
        console.log('😰 NERVOUS MODE: Vibrating well activated!');
    }
    
    if (mode === 'sixseven' || activeChallenges.has('sixseven')) {
        console.log('6️⃣7️⃣ SIX SEVEN MODE: Giant pieces activated!');
    }
    
    if (mode === 'gremlins' || activeChallenges.has('gremlins')) {
        console.log('👹 GREMLINS MODE: Random disappearing activated!');
    }
    
    if (mode === 'lattice' || activeChallenges.has('lattice')) {
        console.log('🔲 LATTICE MODE: Pre-filled blocks activated!');
    }
    
    if (mode === 'longago' || activeChallenges.has('longago')) {
        canvas.classList.add('longago-mode');
        console.log('⭐ LONG AGO MODE: Star Wars perspective activated!');
        // Need to update after transform is applied
        setTimeout(() => updateCanvasSize(), 0);
    }
    
    if (mode === 'comingsoon' || activeChallenges.has('comingsoon')) {
        canvas.classList.add('comingsoon-mode');
        console.log('🔮 COMING SOON MODE: Reverse perspective activated!');
        // Need to update after transform is applied
        setTimeout(() => updateCanvasSize(), 0);
    }
    
    if (mode === 'sorandom') {
        console.log('🎲 SO RANDOM MODE: Random challenge switching activated!');
    }
    
    if (mode === 'normal') {
        console.log('✅ NORMAL MODE: All challenges disabled');
    }
    
    // Update canvas size after all challenge modes are applied
    // This ensures Thicker mode dimensions are properly set/reset
    updateCanvasSize();
}

// Initialize canvas size
updateCanvasSize();
drawBoard();
// Ensure canvas has background even on menu
drawCanvasBackground();

// Initialize UI elements to show state (settings button visible, etc.)
toggleUIElements(true);

// Handle start overlay - required for audio autoplay
const startOverlay = document.getElementById('startOverlay');

// Apply pulse animation only to "Don't Panic!"
const dontPanicText = document.getElementById('dontPanicText');
if (dontPanicText) {
    dontPanicText.style.animation = 'pulse 2s ease-in-out infinite';

    // Center-click (mouse wheel button) or right-click on "Don't Panic!" to activate developer mode
    dontPanicText.addEventListener('mousedown', (e) => {
        if (e.button === 1 || e.button === 2) { // Middle mouse button or right-click
            e.preventDefault();
            developerMode = !developerMode;
            // Visual feedback
            dontPanicText.style.color = developerMode ? '#FFD700' : '';
            console.log(developerMode ? 
                '🛠️ Developer Mode ACTIVATED - Music will be disabled when starting games' : 
                '👤 Developer Mode DEACTIVATED');
            
            // Immediately turn off music if developer mode is activated
            if (developerMode && musicToggle.checked) {
                musicToggle.checked = false;
                musicToggle.dispatchEvent(new Event('change'));
                console.log('🔇 Developer Mode: Music disabled');
            }
        }
    });

    // Prevent context menu on "Don't Panic!" text
    dontPanicText.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

// Anagram Easter Egg System
const anagrams = [
    "MISERY YOU REAP",
    "PURE SMOKE",
    "RUSE POEM",
    "PIOUS MAKER",
    "RISKY POEM",
    "SPARE ME",
    "ERASE",
    "POSER"
];

let unusedAnagrams = [...anagrams]; // Track which anagrams haven't been used yet
let anagramTimers = { first: null, second: null };
let anagramTriggered = false;
let isAnimating = false; // Prevent overlapping animations

function getNextAnagram() {
    // If we've used all anagrams, reset the pool
    if (unusedAnagrams.length === 0) {
        unusedAnagrams = [...anagrams];
    }
    
    // Pick a random one from unused pool
    const randomIndex = Math.floor(Math.random() * unusedAnagrams.length);
    const chosen = unusedAnagrams[randomIndex];
    
    // Remove it from unused pool
    unusedAnagrams.splice(randomIndex, 1);
    
    return chosen;
}

function startAnagramTimers() {
    // Anagram animation disabled - intro screen now uses button-based UI
    return;
}

function resetToClickAnywhere() {
    // Anagram animation disabled - intro screen now uses button-based UI
    return;
}

function cancelAnagramTimers() {
    anagramTriggered = true;
    if (anagramTimers.first) clearTimeout(anagramTimers.first);
    if (anagramTimers.second) clearTimeout(anagramTimers.second);
}

function animateToAnagram() {
    // Guard: clickMessage element no longer exists in new UI
    const clickMessage = document.getElementById('clickMessage');
    if (!clickMessage) return;
    
    isAnimating = true;
    const originalText = "YOU'RE OKAY, PROMISE...";
    const targetAnagram = getNextAnagram(); // Get next unused anagram
    
    // Stop the pulse animation
    clickMessage.style.animation = 'none';
    
    // Create temporary measuring element
    const tempMeasure = document.createElement('span');
    tempMeasure.style.cssText = 'position: absolute; visibility: hidden; font-size: 32px; font-weight: bold; font-family: Arial, sans-serif; white-space: pre;';
    document.body.appendChild(tempMeasure);
    
    // Measure each character's width
    const measureWidth = (char) => {
        tempMeasure.textContent = char;
        return tempMeasure.offsetWidth;
    };
    
    // Calculate positions for original text
    const originalPositions = [];
    let x = 0;
    for (let i = 0; i < originalText.length; i++) {
        const char = originalText[i];
        const width = measureWidth(char);
        originalPositions.push({ char, x, width });
        x += width;
    }
    
    // Center original text
    const originalWidth = x;
    originalPositions.forEach(pos => pos.x -= originalWidth / 2);
    
    // Calculate positions for target text
    const targetPositions = [];
    x = 0;
    for (let i = 0; i < targetAnagram.length; i++) {
        const char = targetAnagram[i];
        const width = measureWidth(char);
        targetPositions.push({ char, x, width });
        x += width;
    }
    
    // Center target text
    const targetWidth = x;
    targetPositions.forEach(pos => pos.x -= targetWidth / 2);
    
    document.body.removeChild(tempMeasure);
    
    // Create letter mapping
    const letterMapping = [];
    const usedOriginalIndices = new Set();
    const unusedIndices = new Set();
    
    for (let targetIdx = 0; targetIdx < targetAnagram.length; targetIdx++) {
        const targetChar = targetAnagram[targetIdx];
        
        for (let origIdx = 0; origIdx < originalText.length; origIdx++) {
            if (usedOriginalIndices.has(origIdx)) continue;
            
            const origChar = originalText[origIdx];
            // ONLY match if characters are exactly the same (case insensitive)
            // Don't match different punctuation/symbols
            const matches = origChar.toUpperCase() === targetChar.toUpperCase();
            
            if (matches) {
                letterMapping.push({
                    fromIdx: origIdx,
                    toIdx: targetIdx,
                    fromX: originalPositions[origIdx].x,
                    toX: targetPositions[targetIdx].x,
                    origChar: originalText[origIdx],
                    targetChar: targetChar,
                    needsChange: originalText[origIdx] !== targetChar
                });
                usedOriginalIndices.add(origIdx);
                break;
            }
        }
    }
    
    // Mark unused letters (apostrophe, comma, periods will be here)
    for (let i = 0; i < originalText.length; i++) {
        if (!usedOriginalIndices.has(i)) {
            unusedIndices.add(i);
        }
    }
    
    // Clear and rebuild with positioned letters
    clickMessage.innerHTML = '';
    
    // Start with opacity 0 for fade in
    clickMessage.style.opacity = '0';
    
    // Create letter spans at EXACT original positions
    const letterSpans = [];
    
    for (let i = 0; i < originalText.length; i++) {
        const span = document.createElement('span');
        span.textContent = originalText[i];
        span.style.cssText = `
            position: absolute;
            left: 50%;
            top: 0;
            transform: translateX(${originalPositions[i].x}px);
            transition: none;
            opacity: 1;
            white-space: pre;
        `;
        clickMessage.appendChild(span);
        letterSpans.push(span);
    }
    
    // Force reflow
    letterSpans[0].offsetHeight;
    
    // Fade in the letters to 50% opacity (2 seconds)
    setTimeout(() => {
        clickMessage.style.transition = 'opacity 2s ease-in';
        clickMessage.style.opacity = '0.5';
        
        // Add class to enable middle finger cursor for clickable text
        clickMessage.classList.add('anagram-active');
    }, 50);
    
    // Enable SLOW transitions for letters AFTER fade in starts
    setTimeout(() => {
        letterSpans.forEach(span => {
            span.style.transition = 'all 1.5s ease-in-out';
        });
    }, 100);
    
    // INITIAL PAUSE: Random 6-7 seconds before any animation
    const initialPause = 6000 + Math.random() * 1000;
    
    // PHASE 1: Fade out unused letters including apostrophe (600ms)
    setTimeout(() => {
        unusedIndices.forEach(idx => {
            letterSpans[idx].style.opacity = '0';
        });
    }, initialPause + 300);
    
    // PHASE 2: Shift ALL remaining letters to their final X positions (SLOW - 1.5s)
    setTimeout(() => {
        letterMapping.forEach(map => {
            const span = letterSpans[map.fromIdx];
            span.style.transform = `translateX(${map.toX}px)`;
        });
    }, initialPause + 1100);
    
    // PHASE 3: Animate only letters that need to change character
    let delay = initialPause + 2900; // After pause + fade + shift
    
    letterMapping.forEach((map, mapIdx) => {
        // Skip if letter doesn't need to change
        if (!map.needsChange) {
            return;
        }
        
        // Animate character change
        setTimeout(() => {
            const movingSpan = letterSpans[map.fromIdx];
            const isSpace = !/[A-Z]/i.test(map.targetChar);
            
            // Step 1: Drop DOWN
            movingSpan.style.transform = `translateX(${map.toX}px) translateY(80px)`;
            movingSpan.style.zIndex = `${1000 + mapIdx}`;
            
            // Step 2: Change character while down
            setTimeout(() => {
                movingSpan.textContent = map.targetChar;
                if (isSpace) {
                    movingSpan.style.opacity = '0';
                }
            }, 500);
            
            // Step 3: Rise back UP
            setTimeout(() => {
                movingSpan.style.transform = `translateX(${map.toX}px) translateY(0)`;
            }, 600);
            
        }, delay);
        
        delay += 800; // 800ms per letter that needs to change
    });
    
    // Animation complete - letters are already in final position, don't touch them!
    const totalDuration = delay + 600;
    setTimeout(() => {
        // Don't replace innerHTML - letters are already positioned correctly
        // Just ensure opacity stays at 50%
        clickMessage.style.opacity = '0.5';
        
        // Class already added when YOU'RE OKAY first appeared
        
        // Wait 5 seconds, then start the cycle over
        setTimeout(() => {
            if (!anagramTriggered) {
                resetToClickAnywhere();
            }
        }, 5000);
    }, totalDuration);
}

// Initialize "Click anywhere..." to 50% opacity (legacy - element may not exist)
const clickMessage = document.getElementById('clickMessage');
if (clickMessage) {
    clickMessage.style.opacity = '0.5';

    // Check if on phone - show different message
    if (DeviceDetection.isMobile) {
        clickMessage.innerHTML = 'This game requires a full-size screen.<br><br>Please visit on a tablet or computer.';
        clickMessage.style.fontSize = '1.5em';
        clickMessage.style.lineHeight = '1.5';
    }

    // Add click event to clickMessage to open YouTube link (only when anagram is active)
    clickMessage.addEventListener('click', (e) => {
        // Only open link if anagram is active
        if (clickMessage.classList.contains('anagram-active')) {
            e.stopPropagation(); // Prevent the overlay click from firing
            window.open('https://www.youtube.com/watch?v=NaFd8ucHLuo', '_blank');
        }
    });
}

// Handle mobile devices with intro controls
if (DeviceDetection.isMobile) {
    const introControls = document.getElementById('introControls');
    const dontPanicText = document.getElementById('dontPanicText');
    if (introControls) {
        introControls.innerHTML = '<p style="color: white; font-size: 1.2em; text-align: center; padding: 20px;">This game requires a full-size screen.<br><br>Please visit on a tablet or computer.</p>';
    }
    if (dontPanicText) {
        dontPanicText.style.display = 'none';
    }
}

// Start timers when page loads (only if not on phone)
if (!DeviceDetection.isMobile) {
    startAnagramTimers();
}

if (startOverlay) {
    // Get intro screen elements
    const startGameBtn = document.getElementById('startGameBtn');
    const introFullscreenCheckbox = document.getElementById('introFullscreenCheckbox');
    const introMusicCheckbox = document.getElementById('introMusicCheckbox');
    const introSoundCheckbox = document.getElementById('introSoundCheckbox');
    const introLoginBtn = document.getElementById('introLoginBtn');
    
    // Sync intro toggles with settings toggles on load
    if (introMusicCheckbox && musicToggle) {
        introMusicCheckbox.checked = musicToggle.checked;
        introMusicCheckbox.addEventListener('change', () => {
            musicToggle.checked = introMusicCheckbox.checked;
            musicToggle.dispatchEvent(new Event('change'));
        });
    }
    if (introSoundCheckbox && soundToggle) {
        introSoundCheckbox.checked = soundToggle.checked;
        introSoundCheckbox.addEventListener('change', () => {
            soundToggle.checked = introSoundCheckbox.checked;
            soundToggle.dispatchEvent(new Event('change'));
        });
    }
    
    // Check login status and show/hide login button
    function checkIntroLoginStatus() {
        // Check if user is logged in via oi_token (from auth.js)
        const isLoggedIn = !!localStorage.getItem('oi_token');
        if (introLoginBtn) {
            introLoginBtn.classList.toggle('hidden', isLoggedIn);
        }
    }
    checkIntroLoginStatus();
    
    // Login button handler - use auth.js showLoginModal
    if (introLoginBtn) {
        introLoginBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof showLoginModal === 'function') {
                showLoginModal();
            } else {
                // Fallback if auth.js not loaded
                window.location.href = 'https://official-intelligence.art/?login=1';
            }
        });
    }
    
    // Start Game button handler
    function dismissIntroScreen() {
        cancelAnagramTimers();
        // Resume audio context (required by browsers)
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        // Request full-screen mode if toggle is checked
        if (introFullscreenCheckbox && introFullscreenCheckbox.checked) {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen().catch(err => {
                    // Silently handle fullscreen errors (permissions, etc.)
                });
            } else if (elem.webkitRequestFullscreen) { // Safari
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) { // IE11
                elem.msRequestFullscreen();
            }
        }
        // Remove overlay
        startOverlay.style.display = 'none';
        // Start menu music (only if music is enabled)
        if (musicToggle.checked) {
            startMenuMusic(musicToggle);
        }
    }
    
    if (startGameBtn) {
        startGameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dismissIntroScreen();
        });
    }

    // Add touchstart for iOS Safari for the start button
    if (startGameBtn) {
        startGameBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dismissIntroScreen();
        }, { passive: false });
    }
}

// Also allow keyboard to start the game (Enter or Space)
document.addEventListener('keydown', (e) => {
    if (startOverlay && startOverlay.style.display !== 'none') {
        // Only start on Enter or Space key
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const startGameBtn = document.getElementById('startGameBtn');
            if (startGameBtn) {
                startGameBtn.click();
            }
        }
    }
}, { once: true });

// Initialize high score system
console.log(`🏆 ${window.GAME_TITLE || 'BLOCKCHaiNSTORM'} High Score System Initialized`);
console.log('💡 To test high score prompt in console, type: testHighScore(1000000)');
console.log('📊 Leaderboard uses server if available, falls back to local storage');

// Tap anywhere to unpause (for tablet mode)
let unpauseHandled = false;
const handleUnpauseTap = (e) => {
    if (!gameRunning || !paused || justPaused) return;
    if (unpauseHandled) return;
    
    // Don't unpause if clicking on settings button, settings overlay, or pause button
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const pauseBtn = document.getElementById('pauseBtn');
    
    if (settingsBtn && settingsBtn.contains(e.target)) return;
    if (settingsOverlay && settingsOverlay.contains(e.target)) return;
    if (settingsOverlay && settingsOverlay.style.display === 'flex') return;
    if (pauseBtn && pauseBtn.contains(e.target)) return;
    
    // Prevent double-firing from both touchend and click
    unpauseHandled = true;
    setTimeout(() => { unpauseHandled = false; }, 300);
    
    // Unpause
    togglePause();
};

document.addEventListener('click', handleUnpauseTap);
document.addEventListener('touchend', handleUnpauseTap);