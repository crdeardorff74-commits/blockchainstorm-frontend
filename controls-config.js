/**
 * Controls Configuration Module for BLOCKCHaiNSTORM
 * Allows players to customize keyboard and gamepad controls
 */

const ControlsConfig = (() => {
    // Default keyboard bindings
    const DEFAULT_KEYBOARD = {
        moveLeft: ['ArrowLeft', '4'],
        moveRight: ['ArrowRight', '6'],
        softDrop: ['ArrowDown', '2'],
        hardDrop: [' ', '0', 'Insert'],
        rotateCW: ['ArrowUp', '8'],
        rotateCCW: ['5', 'Clear']
    };
    
    // Default gamepad bindings (button indices)
    const DEFAULT_GAMEPAD = {
        moveLeft: [14],      // D-Pad Left
        moveRight: [15],     // D-Pad Right
        softDrop: [13],      // D-Pad Down
        hardDrop: [6, 7, 12, 11],  // LT, RT, D-Up, R-Stick
        rotateCW: [1, 3],    // B, Y
        rotateCCW: [0, 2],   // A, X
        pause: [9],          // Start
        nextSong: [5],       // RB
        prevSong: [4]        // LB
    };
    
    // Action display names
    const ACTION_NAMES = {
        moveLeft: 'Move Left',
        moveRight: 'Move Right',
        softDrop: 'Soft Drop',
        hardDrop: 'Hard Drop',
        rotateCW: 'Rotate CW',
        rotateCCW: 'Rotate CCW',
        nextSong: 'Next Song',
        prevSong: 'Prev Song'
    };
    
    // Gamepad button names
    const GAMEPAD_BUTTON_NAMES = {
        0: 'A',
        1: 'B',
        2: 'X',
        3: 'Y',
        4: 'LB',
        5: 'RB',
        6: 'LT',
        7: 'RT',
        8: 'Back',
        9: 'Start',
        10: 'L3',
        11: 'R3',
        12: 'D-Up',
        13: 'D-Down',
        14: 'D-Left',
        15: 'D-Right'
    };
    
    // Current bindings
    let keyboardBindings = JSON.parse(JSON.stringify(DEFAULT_KEYBOARD));
    let gamepadBindings = JSON.parse(JSON.stringify(DEFAULT_GAMEPAD));
    let vibrationEnabled = true; // Gamepad vibration setting
    
    // UI state
    let isCapturing = false;
    let captureAction = null;
    let captureType = null; // 'keyboard' or 'gamepad'
    let captureCallback = null;
    let gamepadConnected = false;
    
    /**
     * Initialize the controls config system
     */
    function init() {
        // Load saved bindings from localStorage
        loadFromLocalStorage();
        
        // Listen for gamepad connection changes
        window.addEventListener('gamepadconnected', () => {
            gamepadConnected = true;
            updateGamepadUI();
        });
        
        window.addEventListener('gamepaddisconnected', () => {
            const gamepads = navigator.getGamepads();
            gamepadConnected = gamepads && Array.from(gamepads).some(gp => gp !== null);
            updateGamepadUI();
        });
        
        // Check if gamepad already connected
        try {
            const gamepads = navigator.getGamepads();
            gamepadConnected = gamepads && Array.from(gamepads).some(gp => gp !== null);
        } catch (e) {
            gamepadConnected = false;
        }
        
        console.log('🎮 Controls Config initialized');
    }
    
    /**
     * Load bindings from localStorage
     */
    function loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('controlsConfig');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.keyboard) {
                    keyboardBindings = { ...DEFAULT_KEYBOARD, ...parsed.keyboard };
                }
                if (parsed.gamepad) {
                    gamepadBindings = { ...DEFAULT_GAMEPAD, ...parsed.gamepad };
                }
                if (typeof parsed.vibrationEnabled === 'boolean') {
                    vibrationEnabled = parsed.vibrationEnabled;
                    // Sync with GamepadController
                    if (typeof GamepadController !== 'undefined') {
                        GamepadController.vibrationEnabled = vibrationEnabled;
                    }
                }
                console.log('🎮 Loaded controls from localStorage');
            }
        } catch (e) {
            console.warn('🎮 Failed to load controls from localStorage:', e);
        }
    }
    
    /**
     * Save bindings to localStorage
     */
    function saveToLocalStorage() {
        try {
            const data = {
                keyboard: keyboardBindings,
                gamepad: gamepadBindings,
                vibrationEnabled: vibrationEnabled
            };
            localStorage.setItem('controlsConfig', JSON.stringify(data));
            console.log('🎮 Saved controls to localStorage');
        } catch (e) {
            console.warn('🎮 Failed to save controls to localStorage:', e);
        }
    }
    
    /**
     * Get current bindings for settings sync
     */
    function getBindings() {
        return {
            keyboard: keyboardBindings,
            gamepad: gamepadBindings,
            vibrationEnabled: vibrationEnabled
        };
    }
    
    /**
     * Apply bindings from settings sync
     */
    function applyBindings(bindings) {
        if (bindings && bindings.keyboard) {
            keyboardBindings = { ...DEFAULT_KEYBOARD, ...bindings.keyboard };
        }
        if (bindings && bindings.gamepad) {
            gamepadBindings = { ...DEFAULT_GAMEPAD, ...bindings.gamepad };
        }
        if (bindings && typeof bindings.vibrationEnabled === 'boolean') {
            vibrationEnabled = bindings.vibrationEnabled;
            // Sync with GamepadController
            if (typeof GamepadController !== 'undefined') {
                GamepadController.vibrationEnabled = vibrationEnabled;
            }
        }
        saveToLocalStorage();
        updateUI();
    }
    
    /**
     * Check if a key is bound to an action
     */
    function getKeyboardAction(key) {
        for (const [action, keys] of Object.entries(keyboardBindings)) {
            if (keys.includes(key)) {
                return action;
            }
        }
        return null;
    }
    
    /**
     * Check if a gamepad button is bound to an action
     */
    function getGamepadAction(buttonIndex) {
        for (const [action, buttons] of Object.entries(gamepadBindings)) {
            if (buttons.includes(buttonIndex)) {
                return action;
            }
        }
        return null;
    }
    
    /**
     * Format key name for display
     */
    function formatKeyName(key) {
        const keyNames = {
            ' ': 'Space',
            'ArrowUp': '↑',
            'ArrowDown': '↓',
            'ArrowLeft': '←',
            'ArrowRight': '→',
            'Insert': 'Ins',
            'Clear': 'Clr'
        };
        return keyNames[key] || key;
    }
    
    /**
     * Format gamepad button for display
     */
    function formatGamepadButton(buttonIndex) {
        return GAMEPAD_BUTTON_NAMES[buttonIndex] || `Btn ${buttonIndex}`;
    }
    
    /**
     * Update the controls UI in settings
     */
    function updateUI() {
        const container = document.getElementById('controlsConfigContainer');
        if (!container) return;
        
        let html = '';
        
        // Show either gamepad OR keyboard controls, not both
        if (gamepadConnected) {
            // Build gamepad controls section (no extra header needed - parent has "Controls" title)
            html += '<div class="controls-section">';
            
            for (const [action, buttons] of Object.entries(gamepadBindings)) {
                if (action === 'pause') continue; // Pause is always Start
                const buttonDisplay = buttons.map(b => formatGamepadButton(b)).join(', ');
                html += `
                    <div class="control-binding-row">
                        <span class="control-action-name">${ACTION_NAMES[action]}</span>
                        <button class="control-binding-btn" data-action="${action}" data-type="gamepad">
                            ${buttonDisplay || 'None'}
                        </button>
                    </div>
                `;
            }
            
            html += '</div>';
            
            // Add vibration toggle for gamepad
            html += `
                <div class="controls-section" style="margin-top: 1.5vh;">
                    <div class="control-binding-row">
                        <span class="control-action-name">Vibration</span>
                        <div class="toggle-switch" style="width: 5vh; height: 2.6vh;">
                            <input type="checkbox" id="controlsVibrationToggle" ${vibrationEnabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Build keyboard controls section
            html += '<div class="controls-section"><div class="controls-section-title">⌨️ Keyboard</div>';
            
            for (const [action, keys] of Object.entries(keyboardBindings)) {
                if (action === 'pause') continue; // Pause is not configurable
                const keyDisplay = keys.map(k => formatKeyName(k)).join(', ');
                html += `
                    <div class="control-binding-row">
                        <span class="control-action-name">${ACTION_NAMES[action]}</span>
                        <button class="control-binding-btn" data-action="${action}" data-type="keyboard">
                            ${keyDisplay || 'None'}
                        </button>
                    </div>
                `;
            }
            
            html += '</div>';
        }
        
        // Reset button
        html += '<button class="controls-reset-btn" id="controlsResetBtn">Reset to Defaults</button>';
        
        container.innerHTML = html;
        
        // Attach event listeners
        attachButtonListeners();
    }
    
    /**
     * Update gamepad UI visibility
     */
    function updateGamepadUI() {
        updateUI();
    }
    
    /**
     * Attach click listeners to binding buttons
     */
    function attachButtonListeners() {
        const buttons = document.querySelectorAll('.control-binding-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                const type = btn.dataset.type;
                startCapture(action, type, btn);
            });
        });
        
        const resetBtn = document.getElementById('controlsResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetToDefaults);
        }
        
        // Vibration toggle listener
        const vibrationToggle = document.getElementById('controlsVibrationToggle');
        if (vibrationToggle) {
            vibrationToggle.addEventListener('change', () => {
                vibrationEnabled = vibrationToggle.checked;
                // Sync with GamepadController
                if (typeof GamepadController !== 'undefined') {
                    GamepadController.vibrationEnabled = vibrationEnabled;
                }
                // Sync with main settings vibration toggle
                const mainVibrationToggle = document.getElementById('vibrationToggle');
                if (mainVibrationToggle) {
                    mainVibrationToggle.checked = vibrationEnabled;
                }
                saveToLocalStorage();
                
                // Trigger settings sync save
                if (typeof SettingsSync !== 'undefined' && SettingsSync.saveSettings) {
                    SettingsSync.saveSettings();
                }
            });
        }
    }
    
    /**
     * Start capturing input for a binding
     */
    function startCapture(action, type, buttonElement) {
        if (isCapturing) {
            cancelCapture();
        }
        
        isCapturing = true;
        captureAction = action;
        captureType = type;
        
        // Update button appearance
        buttonElement.classList.add('capturing');
        buttonElement.textContent = type === 'keyboard' ? 'Press key...' : 'Press button...';
        
        if (type === 'keyboard') {
            // Capture next keypress
            captureCallback = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Ignore modifier keys alone
                if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
                    return;
                }
                
                // Ignore Escape (cancel) and P (pause key)
                if (e.key === 'Escape') {
                    cancelCapture();
                    return;
                }
                
                if (e.key === 'p' || e.key === 'P') {
                    // Can't rebind pause key
                    return;
                }
                
                finishCapture(e.key);
            };
            
            document.addEventListener('keydown', captureCallback, { capture: true });
        } else {
            // Capture gamepad button
            startGamepadCapture();
        }
    }
    
    /**
     * Start polling for gamepad button press
     */
    function startGamepadCapture() {
        const pollInterval = setInterval(() => {
            if (!isCapturing || captureType !== 'gamepad') {
                clearInterval(pollInterval);
                return;
            }
            
            try {
                const gamepads = navigator.getGamepads();
                if (!gamepads) return;
                
                for (const gp of gamepads) {
                    if (!gp) continue;
                    
                    for (let i = 0; i < gp.buttons.length; i++) {
                        if (gp.buttons[i].pressed) {
                            // Ignore Start button (9) - always pause
                            if (i === 9) continue;
                            
                            clearInterval(pollInterval);
                            finishCapture(i);
                            return;
                        }
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        }, 50);
        
        // Also allow keyboard Escape to cancel
        captureCallback = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                clearInterval(pollInterval);
                cancelCapture();
            }
        };
        document.addEventListener('keydown', captureCallback, { capture: true });
    }
    
    /**
     * Finish capturing and apply the new binding
     */
    function finishCapture(value) {
        if (!isCapturing) return;
        
        const action = captureAction;
        const type = captureType;
        
        // Remove the key/button from any other action first
        if (type === 'keyboard') {
            for (const [act, keys] of Object.entries(keyboardBindings)) {
                const idx = keys.indexOf(value);
                if (idx !== -1) {
                    keys.splice(idx, 1);
                }
            }
            // Add to the target action (replace existing bindings for simplicity)
            keyboardBindings[action] = [value];
        } else {
            for (const [act, buttons] of Object.entries(gamepadBindings)) {
                const idx = buttons.indexOf(value);
                if (idx !== -1) {
                    buttons.splice(idx, 1);
                }
            }
            // Add to the target action
            gamepadBindings[action] = [value];
        }
        
        // Cleanup and save
        cleanupCapture();
        saveToLocalStorage();
        
        // Trigger settings sync save
        if (typeof SettingsSync !== 'undefined' && SettingsSync.saveSettings) {
            SettingsSync.saveSettings();
        }
        
        updateUI();
    }
    
    /**
     * Cancel the current capture
     */
    function cancelCapture() {
        cleanupCapture();
        updateUI();
    }
    
    /**
     * Cleanup capture state
     */
    function cleanupCapture() {
        isCapturing = false;
        captureAction = null;
        captureType = null;
        
        if (captureCallback) {
            document.removeEventListener('keydown', captureCallback, { capture: true });
            captureCallback = null;
        }
        
        // Remove capturing class from all buttons
        const buttons = document.querySelectorAll('.control-binding-btn.capturing');
        buttons.forEach(btn => btn.classList.remove('capturing'));
    }
    
    /**
     * Reset all bindings to defaults
     */
    function resetToDefaults() {
        keyboardBindings = JSON.parse(JSON.stringify(DEFAULT_KEYBOARD));
        gamepadBindings = JSON.parse(JSON.stringify(DEFAULT_GAMEPAD));
        vibrationEnabled = true;
        
        // Sync with GamepadController
        if (typeof GamepadController !== 'undefined') {
            GamepadController.vibrationEnabled = vibrationEnabled;
        }
        
        saveToLocalStorage();
        
        // Trigger settings sync save
        if (typeof SettingsSync !== 'undefined' && SettingsSync.saveSettings) {
            SettingsSync.saveSettings();
        }
        
        updateUI();
        console.log('🎮 Controls reset to defaults');
    }
    
    /**
     * Check if gamepad is currently connected
     */
    function isGamepadConnected() {
        return gamepadConnected;
    }
    
    // Public API
    return {
        init,
        getBindings,
        applyBindings,
        getKeyboardAction,
        getGamepadAction,
        updateUI,
        isGamepadConnected,
        formatKeyName,
        formatGamepadButton,
        // Expose bindings for direct access
        get keyboard() { return keyboardBindings; },
        get gamepad() { return gamepadBindings; },
        get vibrationEnabled() { return vibrationEnabled; },
        set vibrationEnabled(val) { 
            vibrationEnabled = val;
            if (typeof GamepadController !== 'undefined') {
                GamepadController.vibrationEnabled = val;
            }
            saveToLocalStorage();
        }
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ControlsConfig.init());
} else {
    ControlsConfig.init();
}
