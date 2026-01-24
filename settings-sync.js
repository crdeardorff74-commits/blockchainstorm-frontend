/**
 * Settings Sync for BLOCKCHaiNSTORM
 * Saves and restores game settings locally and syncs to server for logged-in users
 */

// Check for token in URL (passed from main site) and store it
(function() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
        localStorage.setItem('oi_token', token);
        // Clean URL (remove token from address bar)
        params.delete('token');
        const newUrl = params.toString() 
            ? `${window.location.pathname}?${params}` 
            : window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        console.log('⚙️ Token received from main site');
    }
})();

const SettingsSync = {
    API_URL: 'https://official-intelligence-api.onrender.com',
    GAME_NAME: 'blockchainstorm',
    LOCAL_STORAGE_KEY: 'blockchainstorm_settings',
    
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
     * Save settings to localStorage (always available, no login required)
     */
    saveToLocalStorage(settings) {
        try {
            localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(settings));
            console.log('⚙️ Settings saved to localStorage');
        } catch (error) {
            console.error('⚙️ Failed to save to localStorage:', error);
        }
    },
    
    /**
     * Load settings from localStorage
     */
    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
            if (stored) {
                const settings = JSON.parse(stored);
                console.log('⚙️ Loaded settings from localStorage:', settings);
                return settings;
            }
        } catch (error) {
            console.error('⚙️ Failed to load from localStorage:', error);
        }
        return null;
    },
    
    /**
     * Get current settings from UI elements
     */
    getCurrentSettings() {
        const settings = {};
        
        // Checkboxes
        const checkboxes = [
            'stormEffectsToggle',
            'cameraOrientationToggle',
            'minimalistToggle',
            'vibrationToggle',
            'aiModeToggle',
            'introFullscreenCheckbox'
        ];
        
        checkboxes.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                settings[id] = elem.checked;
            }
        });
        
        // Select dropdowns
        const selects = [
            'musicSelect',
            'skillLevelSelect'
        ];
        
        selects.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                settings[id] = elem.value;
            }
        });
        
        // Sliders (static elements)
        const sliders = [
            'opacitySlider',
            'starSpeedSlider',
            'aiSpeedSlider'
        ];
        
        sliders.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                settings[id] = parseFloat(elem.value);
            }
        });
        
        // Dynamic volume sliders (created by game.js)
        const volumeSliders = [
            'musicVolumeSlider',
            'sfxVolumeSlider'
        ];
        
        volumeSliders.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                settings[id] = parseFloat(elem.value);
            }
        });
        
        // Audio mute states from localStorage (managed by audio.js)
        settings.musicMuted = localStorage.getItem('blockchainstorm_musicMuted') === 'true';
        settings.sfxMuted = localStorage.getItem('blockchainstorm_sfxMuted') === 'true';
        
        // Controls configuration
        if (typeof ControlsConfig !== 'undefined' && ControlsConfig.getBindings) {
            settings.controlBindings = ControlsConfig.getBindings();
        }
        
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
            'stormEffectsToggle', 
            'cameraOrientationToggle',
            'minimalistToggle',
            'vibrationToggle',
            'aiModeToggle',
            'introFullscreenCheckbox'
        ];
        
        checkboxes.forEach(id => {
            const elem = document.getElementById(id);
            if (elem && settings[id] !== undefined) {
                elem.checked = settings[id];
                // Trigger change event so game code responds
                elem.dispatchEvent(new Event('change'));
            }
        });
        
        // Apply select dropdowns
        const selects = [
            'musicSelect',
            'skillLevelSelect'
        ];
        
        selects.forEach(id => {
            const elem = document.getElementById(id);
            if (elem && settings[id] !== undefined) {
                elem.value = settings[id];
                // Trigger change event so game code responds
                elem.dispatchEvent(new Event('change'));
            }
        });
        
        // Sync intro and rules selects from their main counterparts
        if (settings.musicSelect !== undefined) {
            const introMusicSelect = document.getElementById('introMusicSelect');
            if (introMusicSelect) {
                introMusicSelect.value = settings.musicSelect;
            }
        }
        
        if (settings.skillLevelSelect !== undefined) {
            const introSkillSelect = document.getElementById('introSkillLevelSelect');
            const rulesSkillSelect = document.getElementById('rulesSkillLevelSelect');
            if (introSkillSelect) {
                introSkillSelect.value = settings.skillLevelSelect;
            }
            if (rulesSkillSelect) {
                rulesSkillSelect.value = settings.skillLevelSelect;
            }
        }
        
        // Apply sliders (static elements)
        const sliders = [
            'opacitySlider',
            'starSpeedSlider',
            'aiSpeedSlider'
        ];
        
        sliders.forEach(id => {
            const elem = document.getElementById(id);
            if (elem && settings[id] !== undefined) {
                elem.value = settings[id];
                // Trigger input event so game code responds
                elem.dispatchEvent(new Event('input'));
            }
        });
        
        // Apply volume settings via audio.js localStorage keys
        // These will be picked up when volume controls are created
        if (settings.musicVolumeSlider !== undefined) {
            localStorage.setItem('blockchainstorm_musicVolume', (settings.musicVolumeSlider / 100).toString());
        }
        if (settings.sfxVolumeSlider !== undefined) {
            localStorage.setItem('blockchainstorm_sfxVolume', (settings.sfxVolumeSlider / 100).toString());
        }
        if (settings.musicMuted !== undefined) {
            localStorage.setItem('blockchainstorm_musicMuted', settings.musicMuted.toString());
            // Also update audio system state if available
            if (typeof window.AudioSystem !== 'undefined' && window.AudioSystem.setMusicMuted) {
                window.AudioSystem.setMusicMuted(settings.musicMuted);
            }
            // Update mute button icon if it exists
            const musicMuteBtn = document.getElementById('musicMuteBtn');
            if (musicMuteBtn) {
                musicMuteBtn.textContent = settings.musicMuted ? '🔇' : '🔊';
                musicMuteBtn.style.color = settings.musicMuted ? '#ff6666' : '#aaa';
            }
        }
        if (settings.sfxMuted !== undefined) {
            localStorage.setItem('blockchainstorm_sfxMuted', settings.sfxMuted.toString());
            // Also update audio system state if available
            if (typeof window.AudioSystem !== 'undefined' && window.AudioSystem.setSfxMuted) {
                window.AudioSystem.setSfxMuted(settings.sfxMuted);
            }
            // Update mute button icon if it exists
            const sfxMuteBtn = document.getElementById('sfxMuteBtn');
            if (sfxMuteBtn) {
                sfxMuteBtn.textContent = settings.sfxMuted ? '🔇' : '🔊';
                sfxMuteBtn.style.color = settings.sfxMuted ? '#ff6666' : '#aaa';
            }
        }
        
        // Apply to dynamic volume sliders if they already exist
        const volumeSliders = [
            'musicVolumeSlider',
            'sfxVolumeSlider'
        ];
        
        volumeSliders.forEach(id => {
            const elem = document.getElementById(id);
            if (elem && settings[id] !== undefined) {
                elem.value = settings[id];
                elem.dispatchEvent(new Event('input'));
            }
        });
        
        // Apply controls configuration
        if (settings.controlBindings && typeof ControlsConfig !== 'undefined' && ControlsConfig.applyBindings) {
            ControlsConfig.applyBindings(settings.controlBindings);
        }
        
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
        
        const url = `${this.API_URL}/settings/${this.GAME_NAME}`;
        console.log('⚙️ Loading settings from:', url);
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });
            
            console.log('⚙️ Settings response status:', response.status);
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.log('⚙️ Token expired or invalid');
                    return null;
                }
                if (response.status === 404) {
                    // Endpoint might not be deployed yet - not an error
                    console.log('⚙️ Settings endpoint not available (404)');
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
     * Save settings (debounced) - always saves to localStorage, also to server if logged in
     */
    saveSettings() {
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
        
        // Always save to localStorage (works for all users)
        this.saveToLocalStorage(settings);
        
        // Also save to server if logged in
        if (!this.isLoggedIn()) {
            return;
        }
        
        const url = `${this.API_URL}/settings/${this.GAME_NAME}`;
        
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ settings, merge: false })
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.log('⚙️ Token expired during save');
                    return;
                }
                if (response.status === 404) {
                    console.log('⚙️ Settings endpoint not available');
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            console.log('⚙️ Settings saved to server');
            
        } catch (error) {
            console.error('⚙️ Failed to save settings to server:', error);
        }
    },
    
    /**
     * Initialize settings sync - call after DOM ready
     */
    async init() {
        console.log('⚙️ Initializing Settings Sync');
        const token = localStorage.getItem('oi_token');
        console.log('⚙️ Token exists:', !!token);
        console.log('⚙️ Logged in:', this.isLoggedIn());
        
        // First, load settings from localStorage (available for all users)
        const localSettings = this.loadFromLocalStorage();
        if (localSettings) {
            this.applySettings(localSettings);
        }
        
        // If logged in, also load from server (server settings take precedence)
        if (this.isLoggedIn()) {
            const serverSettings = await this.loadSettings();
            if (serverSettings && Object.keys(serverSettings).length > 0) {
                this.applySettings(serverSettings);
                // Also update localStorage with server settings
                this.saveToLocalStorage(serverSettings);
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
            'stormEffectsToggle',
            'cameraOrientationToggle',
            'minimalistToggle',
            'vibrationToggle',
            'aiModeToggle',
            'introFullscreenCheckbox'
        ];
        
        let attachedCount = 0;
        
        checkboxes.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                elem.addEventListener('change', () => {
                    console.log(`⚙️ Setting changed: ${id}`);
                    this.saveSettings();
                });
                attachedCount++;
            } else {
                console.warn(`⚙️ Element not found: ${id}`);
            }
        });
        
        // Select dropdowns (main settings)
        const selects = [
            'musicSelect',
            'skillLevelSelect'
        ];
        
        selects.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                elem.addEventListener('change', () => {
                    console.log(`⚙️ Setting changed: ${id}`);
                    this.saveSettings();
                });
                attachedCount++;
            } else {
                console.warn(`⚙️ Element not found: ${id}`);
            }
        });
        
        // Intro screen selects (sync to main and save)
        const introSelects = [
            { intro: 'introMusicSelect', main: 'musicSelect' },
            { intro: 'introSkillLevelSelect', main: 'skillLevelSelect' },
            { intro: 'rulesSkillLevelSelect', main: 'skillLevelSelect' }
        ];
        
        introSelects.forEach(({ intro, main }) => {
            const introElem = document.getElementById(intro);
            const mainElem = document.getElementById(main);
            if (introElem) {
                introElem.addEventListener('change', () => {
                    console.log(`⚙️ Setting changed: ${intro}`);
                    // Sync to main select
                    if (mainElem) {
                        mainElem.value = introElem.value;
                        mainElem.dispatchEvent(new Event('change'));
                    }
                    this.saveSettings();
                });
                attachedCount++;
            }
        });
        
        const sliders = [
            'opacitySlider',
            'starSpeedSlider',
            'aiSpeedSlider'
        ];
        
        sliders.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                elem.addEventListener('change', () => {
                    console.log(`⚙️ Setting changed: ${id}`);
                    this.saveSettings();
                });
                attachedCount++;
            } else {
                console.warn(`⚙️ Element not found: ${id}`);
            }
        });
        
        console.log(`⚙️ Attached listeners to ${attachedCount} settings elements`);
        
        // Set up observer for dynamic volume controls (created by game.js)
        this.observeVolumeControls();
    },
    
    /**
     * Watch for dynamically created volume controls
     */
    observeVolumeControls() {
        const checkAndAttach = () => {
            const volumeElements = [
                'musicVolumeSlider',
                'sfxVolumeSlider',
                'musicMuteBtn',
                'sfxMuteBtn'
            ];
            
            volumeElements.forEach(id => {
                const elem = document.getElementById(id);
                if (elem && !elem.hasAttribute('data-sync-attached')) {
                    elem.setAttribute('data-sync-attached', 'true');
                    // Buttons need 'click', sliders need 'change'
                    const eventType = id.includes('Btn') ? 'click' : 'change';
                    elem.addEventListener(eventType, () => {
                        console.log(`⚙️ Volume setting changed: ${id}`);
                        this.saveSettings();
                    });
                    // Also listen for input for real-time slider changes
                    if (id.includes('Slider')) {
                        elem.addEventListener('input', () => {
                            this.saveSettings();
                        });
                    }
                    console.log(`⚙️ Attached listener to dynamic element: ${id}`);
                }
            });
        };
        
        // Check immediately
        checkAndAttach();
        
        // Also observe DOM for when controls are created
        const observer = new MutationObserver(() => {
            checkAndAttach();
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SettingsSync.init());
} else {
    // DOM already loaded
    SettingsSync.init();
}