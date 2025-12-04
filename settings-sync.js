/**
 * Settings Sync for BLOCKCHaiNSTORM
 * Saves and restores game settings for logged-in users
 */

const SettingsSync = {
    API_URL: 'https://official-intelligence-api.onrender.com',
    GAME_NAME: 'blockchainstorm',
    
    // Debounce timer for saving
    saveTimeout: null,
    
    // Track if we've loaded settings this session
    settingsLoaded: false,
    
    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return !!localStorage.getItem('oi_token');
    },
    
    /**
     * Get auth headers
     */
    getAuthHeaders() {
        const token = localStorage.getItem('oi_token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    },
    
    /**
     * Get current settings from UI elements
     */
    getCurrentSettings() {
        const settings = {};
        
        // Checkboxes
        const checkboxes = [
            'musicToggle',
            'soundToggle', 
            'stormEffectsToggle',
            'cameraOrientationToggle',
            'trainingWheelsToggle'
        ];
        
        checkboxes.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                settings[id] = elem.checked;
            }
        });
        
        // Sliders
        const sliders = [
            'opacitySlider',
            'starSpeedSlider'
        ];
        
        sliders.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                settings[id] = parseFloat(elem.value);
            }
        });
        
        return settings;
    },
    
    /**
     * Apply settings to UI elements
     */
    applySettings(settings) {
        if (!settings || Object.keys(settings).length === 0) {
            console.log('⚙️ No saved settings to apply');
            return;
        }
        
        console.log('⚙️ Applying saved settings:', settings);
        
        // Apply checkboxes
        const checkboxes = [
            'musicToggle',
            'soundToggle',
            'stormEffectsToggle', 
            'cameraOrientationToggle',
            'trainingWheelsToggle'
        ];
        
        checkboxes.forEach(id => {
            const elem = document.getElementById(id);
            if (elem && settings[id] !== undefined) {
                elem.checked = settings[id];
                // Trigger change event so game code responds
                elem.dispatchEvent(new Event('change'));
            }
        });
        
        // Apply sliders
        const sliders = [
            'opacitySlider',
            'starSpeedSlider'
        ];
        
        sliders.forEach(id => {
            const elem = document.getElementById(id);
            if (elem && settings[id] !== undefined) {
                elem.value = settings[id];
                // Trigger input event so game code responds
                elem.dispatchEvent(new Event('input'));
            }
        });
        
        console.log('⚙️ Settings applied successfully');
    },
    
    /**
     * Load settings from server
     */
    async loadSettings() {
        if (!this.isLoggedIn()) {
            console.log('⚙️ Not logged in, skipping settings load');
            return null;
        }
        
        try {
            const response = await fetch(
                `${this.API_URL}/settings/${this.GAME_NAME}`,
                {
                    method: 'GET',
                    headers: this.getAuthHeaders()
                }
            );
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.log('⚙️ Token expired, clearing');
                    localStorage.removeItem('oi_token');
                    return null;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log('⚙️ Loaded settings from server:', data);
            
            this.settingsLoaded = true;
            return data.settings || {};
            
        } catch (error) {
            console.error('⚙️ Failed to load settings:', error);
            return null;
        }
    },
    
    /**
     * Save settings to server (debounced)
     */
    saveSettings() {
        if (!this.isLoggedIn()) {
            return;
        }
        
        // Debounce - wait 500ms after last change before saving
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this._doSave();
        }, 500);
    },
    
    /**
     * Actually perform the save
     */
    async _doSave() {
        const settings = this.getCurrentSettings();
        
        try {
            const response = await fetch(
                `${this.API_URL}/settings/${this.GAME_NAME}`,
                {
                    method: 'PUT',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({ settings, merge: false })
                }
            );
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.log('⚙️ Token expired during save');
                    localStorage.removeItem('oi_token');
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            console.log('⚙️ Settings saved to server');
            
        } catch (error) {
            console.error('⚙️ Failed to save settings:', error);
        }
    },
    
    /**
     * Initialize settings sync - call after DOM ready
     */
    async init() {
        console.log('⚙️ Initializing Settings Sync');
        
        // Load settings if logged in
        if (this.isLoggedIn()) {
            const savedSettings = await this.loadSettings();
            if (savedSettings) {
                this.applySettings(savedSettings);
            }
        }
        
        // Attach change listeners to all settings elements
        this.attachListeners();
        
        console.log('⚙️ Settings Sync initialized');
    },
    
    /**
     * Attach event listeners to settings controls
     */
    attachListeners() {
        const checkboxes = [
            'musicToggle',
            'soundToggle',
            'stormEffectsToggle',
            'cameraOrientationToggle',
            'trainingWheelsToggle'
        ];
        
        checkboxes.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                elem.addEventListener('change', () => this.saveSettings());
            }
        });
        
        const sliders = [
            'opacitySlider',
            'starSpeedSlider'
        ];
        
        sliders.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                // Use 'change' for final value (after release)
                elem.addEventListener('change', () => this.saveSettings());
            }
        });
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SettingsSync.init());
} else {
    // DOM already loaded
    SettingsSync.init();
}
