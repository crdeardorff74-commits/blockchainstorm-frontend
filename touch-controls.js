/**
 * touch-controls.js - Device Detection, Swipe Gestures, Touch Controls & Tablet Mode
 *                     for TaNTЯiS
 *
 * Handles:
 *   - DeviceDetection: phone/tablet/desktop identification
 *   - detectOS(): returns 'iOS', 'Android', 'Windows', 'macOS', 'Linux', 'Other'
 *   - SwipeControls: gesture-based movement/rotation/drop on mobile
 *   - TabletMode: UI layout switching for touch devices
 *   - touchRepeat: key-repeat emulation for on-screen buttons
 *   - initTouchControls(): binds on-screen button events
 *
 * Game globals (currentPiece, movePiece, etc.) are referenced inside event
 * handlers that only fire after game.js has loaded, so this file can be
 * loaded before game.js. Init calls remain in game.js.
 *
 * Exports: DeviceDetection, detectOS, SwipeControls,
 *          TabletMode, touchRepeat, initTouchControls
 */

const { DeviceDetection, detectOS, SwipeControls, TabletMode, touchRepeat, initTouchControls } = (function() {

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

function detectOS() {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 2)) return 'iOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/Win/i.test(ua)) return 'Windows';
    if (/Mac/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Other';
}

// Tablet Mode System
// ============================================
// SWIPE GESTURE CONTROLS
// ============================================
const SwipeControls = {
    enabled: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    tracking: false,
    moveThreshold: 20,      // Min px to register a swipe
    tapThreshold: 12,        // Max px movement for a tap
    tapTimeMax: 250,         // Max ms for a tap
    hardDropSpeed: 800,      // Min px/sec for hard drop
    softDropInterval: null,
    lastMoveX: 0,            // Track cumulative horizontal movement
    movedColumns: 0,         // How many columns we've moved this gesture
    
    _onTouchStart: null,
    _onTouchMove: null,
    _onTouchEnd: null,
    _onTouchCancel: null,
    
    enable() {
        if (this.enabled) return;
        this.enabled = true;
        
        this._onTouchStart = this.handleStart.bind(this);
        this._onTouchMove = this.handleMove.bind(this);
        this._onTouchEnd = this.handleEnd.bind(this);
        this._onTouchCancel = this.handleCancel.bind(this);
        
        document.addEventListener('touchstart', this._onTouchStart, { passive: false });
        document.addEventListener('touchmove', this._onTouchMove, { passive: false });
        document.addEventListener('touchend', this._onTouchEnd, { passive: false });
        document.addEventListener('touchcancel', this._onTouchCancel, { passive: false });
        
        Logger.info('👆 Swipe gesture controls enabled');
    },
    
    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        
        document.removeEventListener('touchstart', this._onTouchStart);
        document.removeEventListener('touchmove', this._onTouchMove);
        document.removeEventListener('touchend', this._onTouchEnd);
        document.removeEventListener('touchcancel', this._onTouchCancel);
        
        this.stopSoftDrop();
        Logger.debug('👆 Swipe gesture controls disabled');
    },
    
    getSwapDir() {
        // Check if controls should be swapped (Stranger XOR Dyslexic)
        const strangerActive = typeof challengeMode !== 'undefined' && 
            (challengeMode === 'stranger' || (typeof activeChallenges !== 'undefined' && activeChallenges.has('stranger')));
        const dyslexicActive = typeof challengeMode !== 'undefined' && 
            (challengeMode === 'dyslexic' || (typeof activeChallenges !== 'undefined' && activeChallenges.has('dyslexic')));
        return strangerActive !== dyslexicActive ? -1 : 1;
    },
    
    handleStart(e) {
        if (typeof isPaused !== 'undefined' && isPaused) return;
        if (typeof gameRunning !== 'undefined' && !gameRunning) return;
        
        // Ignore touches on interactive UI elements (buttons, sliders, inputs, selects, overlays)
        const tag = e.target.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'LABEL' || tag === 'A') return;
        if (e.target.closest('.settings-panel, .start-overlay, .name-entry-overlay, #gameOver, .leaderboard-overlay')) return;
        
        e.preventDefault();
        const touch = e.touches[0];
        this.startX = touch.clientX;
        this.startY = touch.clientY;
        this.startTime = Date.now();
        this.tracking = true;
        this.lastMoveX = touch.clientX;
        this.movedColumns = 0;
    },
    
    handleMove(e) {
        if (!this.tracking) return;
        if (typeof isPaused !== 'undefined' && isPaused) return;
        if (typeof currentPiece === 'undefined' || !currentPiece) return;
        if (typeof hardDropping !== 'undefined' && hardDropping) return;
        
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - this.lastMoveX;
        const dy = touch.clientY - this.startY;
        
        // Horizontal movement: move piece per column-width of movement
        // But not while soft-dropping — prevent accidental sideways moves
        const colWidth = typeof BLOCK_SIZE !== 'undefined' ? BLOCK_SIZE : 30;
        if (Math.abs(dx) >= colWidth && !this.softDropInterval) {
            const columns = Math.floor(Math.abs(dx) / colWidth);
            const rawDir = dx > 0 ? 1 : -1;  // Don't pre-swap - movePiece handles it
            
            for (let i = 0; i < columns; i++) {
                const prevX = currentPiece.x;
                movePiece(rawDir);
                if (currentPiece.x !== prevX) {
                    this.movedColumns++;
                }
            }
            this.lastMoveX = touch.clientX;
        }
        
        // Vertical: if swiping down significantly, start soft drop
        if (dy > this.moveThreshold * 2 && !this.softDropInterval) {
            this.startSoftDrop();
        }
    },
    
    handleEnd(e) {
        if (!this.tracking) return;
        this.tracking = false;
        
        if (typeof isPaused !== 'undefined' && isPaused) return;
        if (typeof currentPiece === 'undefined' || !currentPiece) return;
        
        e.preventDefault();
        const touch = e.changedTouches[0];
        const dx = touch.clientX - this.startX;
        const dy = touch.clientY - this.startY;
        const elapsed = Date.now() - this.startTime;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        this.stopSoftDrop();
        
        // Tap = rotate
        if (dist < this.tapThreshold && elapsed < this.tapTimeMax && this.movedColumns === 0) {
            // Tap on left half of screen = rotate CCW, right half = rotate CW
            const screenMidX = window.innerWidth / 2;
            if (touch.clientX < screenMidX * 0.8) {
                rotatePieceCounterClockwise();
            } else {
                rotatePiece();
            }
            return;
        }
        
        // Fast downward swipe = hard drop
        if (dy > this.moveThreshold && this.movedColumns < 2) {
            if (typeof hardDropping !== 'undefined' && hardDropping) return;
            const speed = (dy / elapsed) * 1000; // px/sec
            if (speed > this.hardDropSpeed) {
                hardDrop();
                return;
            }
        }
    },
    
    handleCancel(e) {
        this.tracking = false;
        this.stopSoftDrop();
    },
    
    startSoftDrop() {
        if (this.softDropInterval) return;
        this.softDropInterval = setInterval(() => {
            if (typeof currentPiece !== 'undefined' && currentPiece && !collides(currentPiece, 0, 1)) {
                currentPiece.y++;
                if (typeof updateStats === 'function') updateStats();
                // Record soft drop for replay
                if (window.GameRecorder && window.GameRecorder.isActive()) {
                    window.GameRecorder.recordInput('softDrop', {
                        x: currentPiece.x,
                        y: currentPiece.y,
                        rotation: currentPiece.rotationIndex || 0
                    });
                }
            }
        }, 50);
    },
    
    stopSoftDrop() {
        if (this.softDropInterval) {
            clearInterval(this.softDropInterval);
            this.softDropInterval = null;
        }
    }
};

const TabletMode = {
    enabled: false,
    manualOverride: false, // For CTRL+T testing
    
    init() {
        const deviceType = DeviceDetection.detect();
        Logger.debug('📱 Device detected:', deviceType);
        Logger.debug('   Touch:', DeviceDetection.isTouch);
        Logger.debug('   Mobile:', DeviceDetection.isMobile);
        Logger.debug('   Tablet:', DeviceDetection.isTablet);
        
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
            Logger.info('📱 Tablet mode:', this.enabled ? 'ENABLED' : 'DISABLED');
        }
    },
    
    applyMode() {
        const touchControls = document.getElementById('touchControls');
        const planetStats = document.getElementById('planetStats');
        const planetStatsLeft = document.getElementById('planetStatsLeft');
        const controls = document.querySelector('.controls');
        const pauseBtn = document.getElementById('pauseBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        const gestureGuide = document.getElementById('gestureGuide');
        
        // Sync with StarfieldSystem
        if (typeof StarfieldSystem !== 'undefined') {
            StarfieldSystem.setTabletModeEnabled(this.enabled);
        }
        
        // Phones use swipe gestures, tablets use button controls
        const useGestures = this.enabled && (DeviceDetection.isMobile || DeviceDetection.isTablet);
        
        if (this.enabled) {
            // Add tablet-mode class to body for CSS styling
            document.body.classList.add('tablet-mode');
            // Hide keyboard controls
            if (controls) controls.style.display = 'none';
            
            if (useGestures) {
                // Phone/tablet: hide button controls, show gesture guide, enable swipe
                if (touchControls) touchControls.style.display = 'none';
                if (gestureGuide) gestureGuide.style.display = 'block';
                SwipeControls.enable();
            } else {
                // Manual override (desktop testing): show button controls
                if (touchControls) touchControls.style.display = 'grid';
                if (gestureGuide) gestureGuide.style.display = 'none';
            }
            
            // Hide planet stats from right panel
            if (planetStats) planetStats.style.display = 'none';
            // Hide planet stats from left panel on menu
            if (planetStatsLeft) planetStatsLeft.style.display = 'none';
            // Hide pause button on menu
            if (pauseBtn) pauseBtn.style.display = 'none';
            // Show settings button
            if (settingsBtn) settingsBtn.style.display = 'block';
        } else {
            // Remove tablet-mode class from body
            document.body.classList.remove('tablet-mode');
            // Hide touch controls
            if (touchControls) touchControls.style.display = 'none';
            if (gestureGuide) gestureGuide.style.display = 'none';
            // Show keyboard controls
            if (controls) controls.style.display = 'block';
            // Hide planet stats from left panel
            if (planetStatsLeft) planetStatsLeft.style.display = 'none';
            // Hide pause button
            if (pauseBtn) pauseBtn.style.display = 'none';
            // Show settings button
            if (settingsBtn) settingsBtn.style.display = 'block';
            SwipeControls.disable();
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
        movePiece(-1);
    });
    
    addRepeatingTouch(touchRight, () => {
        movePiece(1);
    });
    
    addRepeatingTouch(touchDown, () => {
        if (currentPiece && !collides(currentPiece, 0, 1)) {
            currentPiece.y++;
            updateStats();
            // Record soft drop for replay
            if (window.GameRecorder && window.GameRecorder.isActive()) {
                window.GameRecorder.recordInput('softDrop', {
                    x: currentPiece.x,
                    y: currentPiece.y,
                    rotation: currentPiece.rotationIndex || 0
                });
            }
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
    
    Logger.info('📱 Touch controls initialized with key repeat');
}

return { DeviceDetection, detectOS, SwipeControls, TabletMode, touchRepeat, initTouchControls };

})(); // end touch-controls IIFE
