// Audio System
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

const AudioSystem = {
    musicPlaying: false,
    musicInterval: null,
    bassOscillator: null,
    lfoOscillator: null,
    kickScheduler: null,
    menuMusicPlaying: false,
    menuOscillators: [],
    
    playSound(frequency, duration, type = 'sine') {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    },
    
    playSoundEffect(effect) {
        const soundToggle = document.getElementById('soundToggle');
        if (!soundToggle.checked) return;
        
        switch(effect) {
            case 'move':
                this.playSound(200, 0.05);
                break;
            case 'rotate':
                this.playSound(300, 0.08);
                break;
            case 'drop':
                this.playSound(150, 0.1);
                break;
            case 'line':
                this.playCashRegister();
                break;
            case 'gold':
                this.playEnhancedCashRegister();
                break;
            case 'tsunami':
                this.playThunder();
                break;
            case 'gameover':
                this.playSound(200, 0.3);
                setTimeout(() => this.playSound(150, 0.5), 200);
                break;
            case 'alert':
                this.playSound(800, 0.2);
                break;
        }
    },
    
    playCashRegister() {
        this.playSound(120, 0.15, 'square');
        setTimeout(() => {
            this.playSound(1800, 0.15, 'sine');
            this.playSound(2200, 0.12, 'sine');
        }, 40);
        setTimeout(() => this.playSound(2400, 0.08, 'sine'), 60);
        setTimeout(() => {
            this.playSound(140, 0.1, 'sawtooth');
            this.playSound(160, 0.08, 'sawtooth');
        }, 100);
        setTimeout(() => this.playSound(130, 0.06, 'sawtooth'), 180);
    },
    
    playEnhancedCashRegister() {
        this.playSound(120, 0.18, 'square');
        setTimeout(() => {
            this.playSound(2000, 0.18, 'sine');
            this.playSound(2400, 0.15, 'sine');
        }, 40);
        setTimeout(() => {
            this.playSound(2600, 0.1, 'sine');
            this.playSound(2800, 0.08, 'sine');
        }, 60);
        setTimeout(() => {
            this.playSound(140, 0.12, 'sawtooth');
            this.playSound(160, 0.1, 'sawtooth');
        }, 100);
        setTimeout(() => this.playSound(130, 0.08, 'sawtooth'), 180);
    },
    
    playThunder() {
        const soundToggle = document.getElementById('soundToggle');
        if (!soundToggle.checked) return;
        
        const thunder = audioContext.createBufferSource();
        const thunderGain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        const bufferSize = audioContext.sampleRate * 2.5;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            const progress = i / bufferSize;
            let envelope = progress < 0.05 ? 1.0 : 1.0 - ((progress - 0.05) / 0.95);
            data[i] = (Math.random() * 2 - 1) * envelope;
        }
        thunder.buffer = buffer;
        
        filter.type = 'lowpass';
        filter.frequency.value = 250;
        filter.Q.value = 0.5;
        
        thunderGain.gain.value = 2.0;
        
        thunder.connect(filter);
        filter.connect(thunderGain);
        thunderGain.connect(audioContext.destination);
        
        thunder.start(audioContext.currentTime);
        
        setTimeout(() => {
            if (!soundToggle.checked) return;
            this.playSound(2000, 0.04, 'square');
            this.playSound(1500, 0.06, 'square');
        }, 10);
    },
    
    playEnhancedThunder() {
        const soundToggle = document.getElementById('soundToggle');
        if (!soundToggle.checked) return;
        
        const thunder = audioContext.createBufferSource();
        const thunderGain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        const bufferSize = audioContext.sampleRate * 4.0;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            const progress = i / bufferSize;
            let envelope = progress < 0.3 ? 1.0 : 1.0 - ((progress - 0.3) / 0.7);
            data[i] = (Math.random() * 2 - 1) * envelope;
        }
        thunder.buffer = buffer;
        
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        filter.Q.value = 0.7;
        
        thunderGain.gain.value = 2.5;
        
        thunder.connect(filter);
        filter.connect(thunderGain);
        thunderGain.connect(audioContext.destination);
        
        thunder.start(audioContext.currentTime);
        
        setTimeout(() => {
            if (!soundToggle.checked) return;
            this.playSound(2500, 0.04, 'square');
            this.playSound(2000, 0.06, 'square');
        }, 20);
        setTimeout(() => {
            if (!soundToggle.checked) return;
            this.playSound(2200, 0.05, 'square');
        }, 600);
        setTimeout(() => {
            if (!soundToggle.checked) return;
            this.playSound(1800, 0.06, 'square');
        }, 1200);
    },
    
    playBloopSound() {
        const soundToggle = document.getElementById('soundToggle');
        if (!soundToggle.checked) return;
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.15);
        
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
    }
};
// Export to global scope for cross-module access
window.AudioSystem = AudioSystem;
window.audioContext = audioContext;
