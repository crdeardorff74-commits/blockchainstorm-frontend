// ===== DEVICE DETECTION AND INPUT MODULE =====
// Handles device detection, touch controls, and gamepad support

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

// Gamepad Controller System
const GamepadController = {
    enabled: false,
    connected: false,
    gamepad: null,
    buttonStates: {},
    axisDeadzone: 0.3,
    lastUpdateTime: 0,
    repeatDelay: 150,
    repeatRate: 50,
    
    init() {
        window.addEventListener('gamepadconnected', (e) => this.onConnect(e));
        window.addEventListener('gamepaddisconnected', (e) => this.onDisconnect(e));
        this.checkForGamepads();
    },
    
    checkForGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                this.onConnect({ gamepad: gamepads[i] });
                break;
            }
        }
    },
    
    onConnect(event) {
        this.connected = true;
        this.gamepad = event.gamepad;
        console.log('🎮 Gamepad connected:', event.gamepad.id);
        TabletMode.updateMode();
    },
    
    onDisconnect(event) {
        if (this.gamepad && this.gamepad.index === event.gamepad.index) {
            this.connected = false;
            this.gamepad = null;
            console.log('🎮 Gamepad disconnected');
            TabletMode.updateMode();
        }
    },
    
    update(gameState, callbacks) {
        if (!this.connected || !this.enabled) return;
        
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        this.gamepad = gamepads[this.gamepad.index];
        
        if (!this.gamepad) return;
        
        const now = Date.now();
        
        // Button mappings (standard layout)
        const buttons = {
            A: 0,        // Rotate/Select
            B: 1,        // Back
            X: 2,        // Hold piece
            Y: 3,        // Hard drop
            LB: 4,
            RB: 5,
            LT: 6,
            RT: 7,
            SELECT: 8,   // Pause
            START: 9,    // Pause
            DPAD_UP: 12,
            DPAD_DOWN: 13,
            DPAD_LEFT: 14,
            DPAD_RIGHT: 15
        };
        
        // Check button states with debouncing
        Object.entries(buttons).forEach(([name, index]) => {
            if (this.gamepad.buttons[index]) {
                const pressed = this.gamepad.buttons[index].pressed;
                const prevState = this.buttonStates[name] || { pressed: false, lastTime: 0 };
                
                if (pressed && !prevState.pressed) {
                    // Button just pressed
                    this.handleButtonPress(name, gameState, callbacks);
                    this.buttonStates[name] = { pressed: true, lastTime: now };
                } else if (pressed && prevState.pressed) {
                    // Button held - check for repeat
                    const timeSincePress = now - prevState.lastTime;
                    if (timeSincePress > this.repeatDelay) {
                        if ((now - this.lastUpdateTime) > this.repeatRate) {
                            this.handleButtonPress(name, gameState, callbacks);
                            this.lastUpdateTime = now;
                        }
                    }
                } else if (!pressed) {
                    this.buttonStates[name] = { pressed: false, lastTime: now };
                }
            }
        });
        
        // Analog stick (left stick for movement)
        const xAxis = this.gamepad.axes[0];
        const yAxis = this.gamepad.axes[1];
        
        if (Math.abs(xAxis) > this.axisDeadzone) {
            if ((now - this.lastUpdateTime) > this.repeatRate) {
                if (xAxis < 0 && callbacks.moveLeft) callbacks.moveLeft();
                if (xAxis > 0 && callbacks.moveRight) callbacks.moveRight();
                this.lastUpdateTime = now;
            }
        }
        
        if (yAxis > this.axisDeadzone) {
            if ((now - this.lastUpdateTime) > this.repeatRate) {
                if (callbacks.softDrop) callbacks.softDrop();
                this.lastUpdateTime = now;
            }
        }
    },
    
    handleButtonPress(button, gameState, callbacks) {
        switch (button) {
            case 'A':
                if (callbacks.rotate) callbacks.rotate();
                break;
            case 'B':
                if (callbacks.rotateCounterClockwise) callbacks.rotateCounterClockwise();
                break;
            case 'X':
                if (callbacks.hold) callbacks.hold();
                break;
            case 'Y':
                if (callbacks.hardDrop) callbacks.hardDrop();
                break;
            case 'DPAD_LEFT':
                if (callbacks.moveLeft) callbacks.moveLeft();
                break;
            case 'DPAD_RIGHT':
                if (callbacks.moveRight) callbacks.moveRight();
                break;
            case 'DPAD_DOWN':
                if (callbacks.softDrop) callbacks.softDrop();
                break;
            case 'START':
            case 'SELECT':
                if (callbacks.pause) callbacks.pause();
                break;
        }
    }
};

// Initialize device detection
DeviceDetection.detect();
GamepadController.init();

// Export for use in other modules
window.GameInput = {
    DeviceDetection,
    TabletMode,
    GamepadController
};
