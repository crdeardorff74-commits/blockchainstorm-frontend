// Audio System Module for BLOCKCHaiNSTORM
// Handles all sound effects, music, and audio context management

(function() {
    // Initialize Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Music system state
let musicPlaying = false;
let musicInterval = null;
let bassOscillator = null;
let lfoOscillator = null;
let kickScheduler = null;

// Menu music state
let menuMusicPlaying = false;
let menuOscillators = [];

// Helper function to create wobble bass synth
function createWobbleBass() {
    // Create wobble bass synth
    const bass = audioContext.createOscillator();
    const bassGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    
    // Bass oscillator (sawtooth for dubstep sound)
    bass.type = 'sawtooth';
    bass.frequency.value = 55; // Low bass note
    
    // LFO for wobble effect
    lfo.type = 'sine';
    lfo.frequency.value = 4; // Wobble rate (4Hz)
    
    // Connect LFO to filter cutoff for wobble
    lfoGain.gain.value = 1000;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    
    // Filter settings
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 10;
    
    // Gain control
    bassGain.gain.value = 0.15;
    
    // Connect audio graph
    bass.connect(filter);
    filter.connect(bassGain);
    bassGain.connect(audioContext.destination);
    
    bass.start();
    lfo.start();
    
    return { bass, bassGain, filter, lfo };
}

// Drum sounds
function playKick() {
    const kick = audioContext.createOscillator();
    const kickGain = audioContext.createGain();
    
    kick.frequency.value = 150;
    kickGain.gain.value = 0.5;
    
    kick.connect(kickGain);
    kickGain.connect(audioContext.destination);
    
    kick.frequency.exponentialRampToValueAtTime(40, audioContext.currentTime + 0.1);
    kickGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    kick.start(audioContext.currentTime);
    kick.stop(audioContext.currentTime + 0.3);
}

function playSnare() {
    const snare = audioContext.createOscillator();
    const snareGain = audioContext.createGain();
    const noise = audioContext.createBufferSource();
    const noiseGain = audioContext.createGain();
    
    // Create noise buffer
    const bufferSize = audioContext.sampleRate * 0.1;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;
    
    snare.frequency.value = 200;
    snareGain.gain.value = 0.2;
    noiseGain.gain.value = 0.3;
    
    snare.connect(snareGain);
    snareGain.connect(audioContext.destination);
    noise.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    
    snareGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    snare.start(audioContext.currentTime);
    snare.stop(audioContext.currentTime + 0.1);
    noise.start(audioContext.currentTime);
    noise.stop(audioContext.currentTime + 0.1);
}

function playMelodyNote(freq, duration) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.value = 0.1;
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + duration);
}

// Main music controller
function startMusic(gameMode, musicToggle) {
    if (musicPlaying || !musicToggle.checked) return;
    musicPlaying = true;
    
    // Choose music based on game mode
    switch(gameMode) {
        case 'drizzle':
            startDrizzleMusic();
            break;
        case 'downpour':
            startDownpourMusic();
            break;
        case 'hailstorm':
            startHailstormMusic();
            break;
        case 'blizzard':
            startBlizzardMusic();
            break;
        case 'hurricane':
            startHurricaneMusic();
            break;
        default:
            startDownpourMusic();
    }
}

// DRIZZLE MODE - Slowest, chill 80s synth with light bass (100 BPM)
function startDrizzleMusic() {
    const wobble = createWobbleBass();
    bassOscillator = wobble;
    wobble.lfo.frequency.value = 2; // Slow wobble
    wobble.filter.frequency.value = 400; // Mellow filter
    
    // Multiple melody variations
    const melodyA = [
        { note: 330, duration: 0.3 }, { note: 294, duration: 0.3 },
        { note: 262, duration: 0.3 }, { note: 294, duration: 0.3 },
        { note: 330, duration: 0.4 }, { note: 392, duration: 0.4 }
    ];
    const melodyB = [
        { note: 392, duration: 0.3 }, { note: 349, duration: 0.3 },
        { note: 330, duration: 0.4 }, { note: 294, duration: 0.3 },
        { note: 262, duration: 0.5 }
    ];
    const melodyC = [
        { note: 294, duration: 0.4 }, { note: 330, duration: 0.3 },
        { note: 392, duration: 0.3 }, { note: 440, duration: 0.4 },
        { note: 392, duration: 0.3 }, { note: 330, duration: 0.4 }
    ];
    const melodyD = [
        { note: 262, duration: 0.5 }, { note: 330, duration: 0.3 },
        { note: 294, duration: 0.3 }, { note: 349, duration: 0.4 },
        { note: 330, duration: 0.5 }
    ];
    
    const melodies = [melodyA, melodyB, melodyC, melodyD];
    let currentMelody = melodyA;
    let melodyIndex = 0;
    let beat = 0;
    let section = 0;
    let measureInSection = 0;
    const beatInterval = 60000 / 100; // 100 BPM
    
    // Bass patterns
    const bassPatterns = [
        [55, 65, 73, 65],     // A-C-D-C
        [55, 55, 73, 82],     // A-A-D-E
        [65, 73, 82, 73],     // C-D-E-D
        [73, 65, 55, 65]      // D-C-A-C
    ];
    let currentBassPattern = bassPatterns[0];
    
    kickScheduler = setInterval(() => {
        // Section changes every 64 beats (16 bars)
        if (beat % 64 === 0 && beat > 0) {
            section++;
            currentMelody = melodies[section % melodies.length];
            currentBassPattern = bassPatterns[section % bassPatterns.length];
            // Subtle filter movement
            wobble.filter.frequency.value = 350 + (section % 3) * 75;
            wobble.lfo.frequency.value = 2 + (section % 2) * 0.5;
        }
        
        measureInSection = Math.floor((beat % 64) / 4);
        
        // Kick pattern with occasional variation
        if (beat % 4 === 0) {
            playKick();
        }
        // Add extra kick every 4th measure
        if (measureInSection % 4 === 3 && beat % 4 === 2) {
            playKick();
        }
        
        // Snare on 2 and 4, with fills
        if (beat % 4 === 2) {
            playSnare();
        }
        // Fill before section change
        if (beat % 64 >= 60 && beat % 2 === 0) {
            setTimeout(() => playSnare(), 150);
        }
        
        // Melody every 2 beats, skip occasionally for breathing room
        if (beat % 2 === 0 && !(measureInSection === 7 && beat % 8 >= 4)) {
            const note = currentMelody[melodyIndex % currentMelody.length];
            playMelodyNote(note.note, note.duration);
            melodyIndex++;
        }
        
        // Bass line with pattern variation
        if (beat % 8 === 0) {
            wobble.bass.frequency.value = currentBassPattern[(beat / 8) % currentBassPattern.length];
        }
        
        beat++;
    }, beatInterval);
}

// DOWNPOUR MODE - Medium tempo, balanced synth/dubstep (120 BPM)
function startDownpourMusic() {
    const wobble = createWobbleBass();
    bassOscillator = wobble;
    wobble.lfo.frequency.value = 4; // Moderate wobble
    
    // Multiple melody patterns
    const melodyA = [
        { note: 330, duration: 0.25 }, { note: 294, duration: 0.2 },
        { note: 262, duration: 0.25 }, { note: 294, duration: 0.2 },
        { note: 330, duration: 0.3 }, { note: 392, duration: 0.3 },
        { note: 440, duration: 0.35 }
    ];
    const melodyB = [
        { note: 440, duration: 0.25 }, { note: 392, duration: 0.2 },
        { note: 349, duration: 0.25 }, { note: 330, duration: 0.3 },
        { note: 392, duration: 0.35 }
    ];
    const melodyC = [
        { note: 262, duration: 0.3 }, { note: 330, duration: 0.2 },
        { note: 392, duration: 0.25 }, { note: 440, duration: 0.25 },
        { note: 494, duration: 0.3 }, { note: 440, duration: 0.25 }
    ];
    const melodyD = [
        { note: 349, duration: 0.2 }, { note: 392, duration: 0.25 },
        { note: 330, duration: 0.2 }, { note: 294, duration: 0.3 },
        { note: 330, duration: 0.35 }, { note: 262, duration: 0.4 }
    ];
    
    const melodies = [melodyA, melodyB, melodyC, melodyD];
    let currentMelody = melodyA;
    let melodyIndex = 0;
    let beat = 0;
    let section = 0;
    let measureInSection = 0;
    const beatInterval = 60000 / 120; // 120 BPM
    
    // Bass patterns
    const bassPatterns = [
        [55, 73, 65, 55],
        [73, 82, 65, 55],
        [55, 55, 82, 73],
        [65, 73, 55, 82]
    ];
    let currentBassPattern = bassPatterns[0];
    
    // Wobble presets
    const wobblePresets = [
        { lfo: 4, filter: 700 },
        { lfo: 5, filter: 900 },
        { lfo: 6, filter: 800 },
        { lfo: 4, filter: 1000 }
    ];
    
    kickScheduler = setInterval(() => {
        // Section changes every 32 beats
        if (beat % 32 === 0) {
            section++;
            currentMelody = melodies[section % melodies.length];
            currentBassPattern = bassPatterns[section % bassPatterns.length];
            const preset = wobblePresets[section % wobblePresets.length];
            wobble.lfo.frequency.value = preset.lfo;
            wobble.filter.frequency.value = preset.filter;
        }
        
        measureInSection = Math.floor((beat % 32) / 4);
        
        // Varied kick patterns
        const kickVariation = section % 3;
        if (kickVariation === 0) {
            // Standard dubstep
            if (beat % 4 === 0 || beat % 4 === 2) playKick();
        } else if (kickVariation === 1) {
            // Syncopated
            if (beat % 4 === 0 || beat % 8 === 3) playKick();
        } else {
            // Four on floor with ghost
            if (beat % 4 === 0) playKick();
            if (beat % 8 === 6) setTimeout(() => playKick(), 100);
        }
        
        // Snare with variations
        if (beat % 4 === 1 || beat % 4 === 3) {
            playSnare();
        }
        // Build-up fills
        if (measureInSection === 7) {
            if (beat % 2 === 0) setTimeout(() => playSnare(), 125);
        }
        
        // Melody with occasional rests
        if (beat % 2 === 0 && measureInSection !== 4) {
            const note = currentMelody[melodyIndex % currentMelody.length];
            playMelodyNote(note.note, note.duration);
            melodyIndex++;
        }
        
        // Dynamic bass
        if (beat % 8 === 0) {
            wobble.bass.frequency.value = currentBassPattern[(beat / 8) % currentBassPattern.length];
        }
        
        beat++;
    }, beatInterval);
}

// HAILSTORM MODE - Fast, aggressive wobbles (140 BPM)
function startHailstormMusic() {
    const wobble = createWobbleBass();
    bassOscillator = wobble;
    wobble.lfo.frequency.value = 6; // Faster wobble
    
    const melodyA = [
        { note: 440, duration: 0.2 }, { note: 392, duration: 0.15 },
        { note: 349, duration: 0.2 }, { note: 330, duration: 0.15 },
        { note: 392, duration: 0.25 }, { note: 440, duration: 0.25 }
    ];
    const melodyB = [
        { note: 523, duration: 0.15 }, { note: 494, duration: 0.15 },
        { note: 440, duration: 0.2 }, { note: 392, duration: 0.2 },
        { note: 440, duration: 0.25 }
    ];
    const melodyC = [
        { note: 392, duration: 0.18 }, { note: 440, duration: 0.15 },
        { note: 494, duration: 0.18 }, { note: 523, duration: 0.2 },
        { note: 494, duration: 0.15 }, { note: 440, duration: 0.2 }
    ];
    const melodyD = [
        { note: 349, duration: 0.2 }, { note: 392, duration: 0.15 },
        { note: 330, duration: 0.18 }, { note: 294, duration: 0.2 },
        { note: 330, duration: 0.25 }, { note: 392, duration: 0.2 }
    ];
    const melodyBreak = [
        { note: 523, duration: 0.3 }, { note: 0, duration: 0.2 },
        { note: 440, duration: 0.3 }, { note: 0, duration: 0.2 }
    ];
    
    const melodies = [melodyA, melodyB, melodyC, melodyD];
    let currentMelody = melodyA;
    let melodyIndex = 0;
    let beat = 0;
    let section = 0;
    let measureInSection = 0;
    let isBreakdown = false;
    const beatInterval = 60000 / 140; // 140 BPM
    
    // More bass patterns
    const bassPatterns = [
        [55, 82, 73, 65],
        [73, 55, 82, 65],
        [55, 65, 55, 82],
        [82, 73, 65, 55]
    ];
    let currentBassPattern = bassPatterns[0];
    
    kickScheduler = setInterval(() => {
        // Section changes every 32 beats
        if (beat % 32 === 0) {
            section++;
            // Every 4th section is a breakdown
            isBreakdown = section % 4 === 3;
            
            if (isBreakdown) {
                currentMelody = melodyBreak;
                wobble.lfo.frequency.value = 3;
                wobble.filter.frequency.value = 500;
            } else {
                currentMelody = melodies[section % melodies.length];
                currentBassPattern = bassPatterns[section % bassPatterns.length];
                wobble.lfo.frequency.value = [6, 7, 8, 9][section % 4];
                wobble.filter.frequency.value = [800, 1000, 1200, 900][section % 4];
            }
        }
        
        measureInSection = Math.floor((beat % 32) / 4);
        
        // Kick pattern varies
        if (!isBreakdown) {
            if (beat % 4 === 0 || beat % 4 === 2) {
                playKick();
            }
            // Double kicks with variation
            if (beat % 16 === 7 || beat % 16 === 15) {
                setTimeout(() => playKick(), 100);
            }
            // Extra syncopation every other section
            if (section % 2 === 1 && beat % 8 === 5) {
                playKick();
            }
        } else {
            // Sparse kicks during breakdown
            if (beat % 8 === 0) playKick();
        }
        
        // Snare with fills
        if (!isBreakdown) {
            if (beat % 4 === 1 || beat % 4 === 3) {
                playSnare();
            }
            // Build-up fill
            if (measureInSection >= 6 && beat % 2 === 0) {
                setTimeout(() => playSnare(), 70);
            }
        } else {
            // Breakdown snare
            if (beat % 8 === 4) playSnare();
        }
        
        // Melody with dynamics
        if (beat % 1 === 0 && !isBreakdown) {
            const note = currentMelody[melodyIndex % currentMelody.length];
            if (note.note > 0) {
                playMelodyNote(note.note, note.duration);
            }
            melodyIndex++;
        } else if (isBreakdown && beat % 4 === 0) {
            const note = currentMelody[melodyIndex % currentMelody.length];
            if (note.note > 0) {
                playMelodyNote(note.note, note.duration * 1.5);
            }
            melodyIndex++;
        }
        
        // Bass movement
        if (beat % 4 === 0) {
            wobble.bass.frequency.value = currentBassPattern[(beat / 4) % currentBassPattern.length];
        }
        
        beat++;
    }, beatInterval);
}

// BLIZZARD MODE - Very fast, intense (160 BPM)
function startBlizzardMusic() {
    const wobble = createWobbleBass();
    bassOscillator = wobble;
    wobble.lfo.frequency.value = 8; // Very fast wobble
    
    const melodyA = [
        { note: 523, duration: 0.15 }, { note: 494, duration: 0.12 },
        { note: 440, duration: 0.15 }, { note: 392, duration: 0.12 },
        { note: 349, duration: 0.15 }, { note: 440, duration: 0.2 }
    ];
    const melodyB = [
        { note: 587, duration: 0.12 }, { note: 523, duration: 0.12 },
        { note: 494, duration: 0.15 }, { note: 440, duration: 0.15 },
        { note: 523, duration: 0.2 }
    ];
    const melodyC = [
        { note: 659, duration: 0.1 }, { note: 587, duration: 0.1 },
        { note: 523, duration: 0.12 }, { note: 494, duration: 0.12 },
        { note: 440, duration: 0.15 }, { note: 523, duration: 0.2 }
    ];
    const melodyD = [
        { note: 440, duration: 0.15 }, { note: 523, duration: 0.12 },
        { note: 587, duration: 0.15 }, { note: 523, duration: 0.12 },
        { note: 494, duration: 0.18 }
    ];
    const melodyE = [
        { note: 392, duration: 0.12 }, { note: 440, duration: 0.12 },
        { note: 494, duration: 0.15 }, { note: 523, duration: 0.15 },
        { note: 587, duration: 0.2 }, { note: 523, duration: 0.15 }
    ];
    const buildUp = [
        { note: 523, duration: 0.1 }, { note: 523, duration: 0.1 },
        { note: 587, duration: 0.1 }, { note: 587, duration: 0.1 },
        { note: 659, duration: 0.1 }, { note: 659, duration: 0.1 }
    ];
    
    const melodies = [melodyA, melodyB, melodyC, melodyD, melodyE];
    let currentMelody = melodyA;
    let melodyIndex = 0;
    let beat = 0;
    let section = 0;
    let measureInSection = 0;
    let isBuildUp = false;
    const beatInterval = 60000 / 160; // 160 BPM
    
    const bassPatterns = [
        [55, 82, 73, 65, 49, 73],
        [49, 55, 73, 82, 65, 55],
        [73, 65, 55, 82, 73, 49],
        [55, 73, 49, 82, 65, 73]
    ];
    let currentBassPattern = bassPatterns[0];
    
    kickScheduler = setInterval(() => {
        // Section changes every 32 beats
        if (beat % 32 === 0) {
            section++;
            // Build-up every 5th section
            isBuildUp = section % 5 === 4;
            
            if (isBuildUp) {
                currentMelody = buildUp;
                wobble.lfo.frequency.value = 12;
                wobble.filter.frequency.value = 1600;
            } else {
                currentMelody = melodies[section % melodies.length];
                currentBassPattern = bassPatterns[section % bassPatterns.length];
                wobble.lfo.frequency.value = [8, 10, 12, 9, 11][section % 5];
                wobble.filter.frequency.value = [1000, 1200, 1400, 1100, 1300][section % 5];
            }
        }
        
        measureInSection = Math.floor((beat % 32) / 4);
        
        // Complex kick pattern
        if (!isBuildUp) {
            if (beat % 4 === 0 || beat % 4 === 2) {
                playKick();
            }
            if (beat % 8 === 3 || beat % 8 === 7) {
                setTimeout(() => playKick(), 80);
            }
            // Random extra hits for chaos
            if (section % 3 === 2 && beat % 16 === 5) {
                playKick();
            }
        } else {
            // Build-up kick roll
            if (measureInSection < 4) {
                if (beat % 4 === 0) playKick();
            } else if (measureInSection < 6) {
                if (beat % 2 === 0) playKick();
            } else {
                playKick(); // Every beat
            }
        }
        
        // Snare with fills
        if (!isBuildUp) {
            if (beat % 4 === 1 || beat % 4 === 3) {
                playSnare();
            }
            // Extra snare hits
            if (measureInSection >= 6 && beat % 2 === 1) {
                setTimeout(() => playSnare(), 60);
            }
        } else {
            // Build-up snare roll
            if (measureInSection >= 6) {
                playSnare();
            } else if (beat % 4 === 2) {
                playSnare();
            }
        }
        
        // Rapid melody
        if (beat % 1 === 0) {
            const note = currentMelody[melodyIndex % currentMelody.length];
            playMelodyNote(note.note, note.duration);
            melodyIndex++;
        }
        
        // Rapid bass changes
        if (beat % 4 === 0) {
            wobble.bass.frequency.value = currentBassPattern[(beat / 4) % currentBassPattern.length];
        }
        
        beat++;
    }, beatInterval);
}

// HURRICANE MODE - Maximum chaos (180 BPM)
function startHurricaneMusic() {
    const wobble = createWobbleBass();
    bassOscillator = wobble;
    wobble.lfo.frequency.value = 12; // Insane wobble
    
    const melodyA = [
        { note: 659, duration: 0.1 }, { note: 587, duration: 0.1 },
        { note: 523, duration: 0.12 }, { note: 494, duration: 0.1 },
        { note: 440, duration: 0.12 }, { note: 523, duration: 0.15 }
    ];
    const melodyB = [
        { note: 784, duration: 0.08 }, { note: 659, duration: 0.1 },
        { note: 587, duration: 0.1 }, { note: 523, duration: 0.12 },
        { note: 659, duration: 0.15 }
    ];
    const melodyC = [
        { note: 880, duration: 0.08 }, { note: 784, duration: 0.08 },
        { note: 659, duration: 0.1 }, { note: 587, duration: 0.1 },
        { note: 523, duration: 0.12 }, { note: 659, duration: 0.15 }
    ];
    const melodyD = [
        { note: 587, duration: 0.1 }, { note: 659, duration: 0.08 },
        { note: 784, duration: 0.1 }, { note: 659, duration: 0.08 },
        { note: 587, duration: 0.12 }, { note: 523, duration: 0.12 }
    ];
    const melodyE = [
        { note: 523, duration: 0.1 }, { note: 587, duration: 0.1 },
        { note: 659, duration: 0.08 }, { note: 784, duration: 0.08 },
        { note: 880, duration: 0.12 }, { note: 784, duration: 0.1 }
    ];
    const dropMelody = [
        { note: 220, duration: 0.2 }, { note: 0, duration: 0.1 },
        { note: 220, duration: 0.15 }, { note: 262, duration: 0.15 }
    ];
    const riseMelody = [
        { note: 440, duration: 0.08 }, { note: 494, duration: 0.08 },
        { note: 523, duration: 0.08 }, { note: 587, duration: 0.08 },
        { note: 659, duration: 0.08 }, { note: 784, duration: 0.08 },
        { note: 880, duration: 0.1 }
    ];
    
    const melodies = [melodyA, melodyB, melodyC, melodyD, melodyE];
    let currentMelody = melodyA;
    let melodyIndex = 0;
    let beat = 0;
    let section = 0;
    let measureInSection = 0;
    let isDrop = false;
    let isRise = false;
    const beatInterval = 60000 / 180; // 180 BPM - EXTREME
    
    const bassPatterns = [
        [55, 82, 73, 65, 49, 73, 82, 55],
        [49, 55, 65, 82, 73, 55, 82, 65],
        [73, 82, 55, 49, 65, 73, 82, 55],
        [55, 49, 73, 82, 65, 55, 82, 73]
    ];
    let currentBassPattern = bassPatterns[0];
    
    kickScheduler = setInterval(() => {
        // Section changes every 32 beats
        if (beat % 32 === 0) {
            section++;
            // Drops and rises for dynamics
            isDrop = section % 6 === 4;
            isRise = section % 6 === 5;
            
            if (isDrop) {
                currentMelody = dropMelody;
                wobble.lfo.frequency.value = 6;
                wobble.filter.frequency.value = 600;
            } else if (isRise) {
                currentMelody = riseMelody;
                wobble.lfo.frequency.value = 20;
                wobble.filter.frequency.value = 2000;
            } else {
                currentMelody = melodies[section % melodies.length];
                currentBassPattern = bassPatterns[section % bassPatterns.length];
                wobble.lfo.frequency.value = [12, 14, 16, 18, 15][section % 5];
                wobble.filter.frequency.value = [1200, 1400, 1600, 1800, 1500][section % 5];
            }
        }
        
        measureInSection = Math.floor((beat % 32) / 4);
        
        // Kick patterns vary by section type
        if (isDrop) {
            // Sparse, heavy kicks during drop
            if (beat % 8 === 0) playKick();
            if (beat % 8 === 4) setTimeout(() => playKick(), 80);
        } else if (isRise) {
            // Accelerating kicks during rise
            if (measureInSection < 2) {
                if (beat % 4 === 0) playKick();
            } else if (measureInSection < 4) {
                if (beat % 2 === 0) playKick();
            } else if (measureInSection < 6) {
                playKick();
            } else {
                playKick();
                setTimeout(() => playKick(), 40);
            }
        } else {
            // Maximum kick intensity
            if (beat % 4 === 0 || beat % 4 === 2) {
                playKick();
            }
            if (beat % 4 === 1 || beat % 4 === 3) {
                setTimeout(() => playKick(), 60);
            }
            // Extra chaos kicks
            if (section % 3 === 0 && beat % 8 === 5) {
                playKick();
            }
        }
        
        // Snare patterns
        if (isDrop) {
            if (beat % 8 === 4) playSnare();
        } else if (isRise) {
            if (measureInSection >= 4) {
                playSnare();
            } else if (beat % 4 === 2) {
                playSnare();
            }
        } else {
            if (beat % 4 === 1 || beat % 4 === 3) {
                playSnare();
            }
            if (section % 2 === 1 && beat % 8 === 5) {
                setTimeout(() => playSnare(), 50);
            }
            // Fill before section change
            if (measureInSection === 7 && beat % 2 === 1) {
                setTimeout(() => playSnare(), 30);
            }
        }
        
        // Melody
        const note = currentMelody[melodyIndex % currentMelody.length];
        if (note.note > 0) {
            playMelodyNote(note.note, note.duration);
        }
        melodyIndex++;
        
        // Chaotic bass
        if (beat % 2 === 0) {
            wobble.bass.frequency.value = currentBassPattern[(beat / 2) % currentBassPattern.length];
        }
        
        beat++;
    }, beatInterval);
}

function stopMusic() {
    if (!musicPlaying) return;
    musicPlaying = false;
    
    if (kickScheduler) {
        clearInterval(kickScheduler);
        kickScheduler = null;
    }
    
    if (bassOscillator) {
        bassOscillator.bass.stop();
        bassOscillator.lfo.stop();
        bassOscillator = null;
    }
}

// Atmospheric menu music - Stranger Things inspired synth theme
function startMenuMusic(musicToggle) {
    if (menuMusicPlaying || !musicToggle.checked) return;
    menuMusicPlaying = true;
    
    // Create the signature arpeggiated synth line
    function playArpNote(frequency, startTime, duration = 0.15) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        osc.type = 'sawtooth';
        osc.frequency.value = frequency;
        
        filter.type = 'lowpass';
        filter.frequency.value = 1200;
        filter.Q.value = 5;
        
        // Quick attack, gradual decay
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.12, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
        
        return { osc, gain };
    }
    
    // Create deep bass drone
    function createBassDrone() {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        osc.type = 'triangle';
        osc.frequency.value = 55; // A1
        
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        filter.Q.value = 2;
        
        gain.gain.value = 0;
        gain.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 1);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.start();
        return { osc, gain, filter };
    }
    
    // Create atmospheric pad with slow filter modulation
    function createAtmosphericPad() {
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        const lfo = audioContext.createOscillator();
        const lfoGain = audioContext.createGain();
        
        osc1.type = 'sawtooth';
        osc1.frequency.value = 110; // A2
        osc2.type = 'sawtooth';
        osc2.frequency.value = 110.5; // Slightly detuned for thickness
        
        filter.type = 'lowpass';
        filter.frequency.value = 600;
        filter.Q.value = 8;
        
        lfo.frequency.value = 0.2;
        lfoGain.gain.value = 400;
        
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        
        gain.gain.value = 0;
        gain.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 2);
        
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        
        osc1.start();
        osc2.start();
        lfo.start();
        
        return { osc1, osc2, gain, filter, lfo };
    }
    
    // Stranger Things style arpeggio pattern (minor key)
    // Using A minor scale with some chromatic passing tones
    const arpPattern = [
        [220, 264, 330, 264],      // Am chord (A C E C)
        [220, 262, 330, 262],      // Am with slight variation
        [174.61, 220, 262, 220],   // F major (F A C A) 
        [196, 246.94, 294, 246.94] // G major (G B D B)
    ];
    
    let patternIndex = 0;
    let noteIndex = 0;
    const noteInterval = 200; // 200ms between notes (faster than previous)
    const patternChangeInterval = 3200; // Change pattern every 3.2 seconds
    
    // Start bass drone
    const bassDrone = createBassDrone();
    menuOscillators.push(bassDrone);
    
    // Start atmospheric pad
    const pad = createAtmosphericPad();
    menuOscillators.push(pad);
    
    // Arpeggio sequencer
    const arpInterval = setInterval(() => {
        if (!menuMusicPlaying) {
            clearInterval(arpInterval);
            return;
        }
        
        const currentPattern = arpPattern[patternIndex];
        const freq = currentPattern[noteIndex % currentPattern.length];
        const now = audioContext.currentTime;
        
        playArpNote(freq, now, 0.18);
        
        noteIndex++;
        
        // Change chord pattern periodically
        if (noteIndex % 16 === 0) {
            patternIndex = (patternIndex + 1) % arpPattern.length;
            
            // Update bass drone to match root note
            const rootFreqs = [55, 55, 43.65, 49]; // A1, A1, F1, G1
            bassDrone.osc.frequency.exponentialRampToValueAtTime(
                rootFreqs[patternIndex], 
                now + 0.5
            );
        }
    }, noteInterval);
    
    menuOscillators.push({ interval: arpInterval });
    
    // Add occasional low synth stabs for tension
    const stabInterval = setInterval(() => {
        if (!menuMusicPlaying) {
            clearInterval(stabInterval);
            return;
        }
        
        const now = audioContext.currentTime;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.type = 'square';
        osc.frequency.value = 27.5; // A0 - very deep
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1);
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.start(now);
        osc.stop(now + 1);
        
    }, 8000); // Every 8 seconds
    
    menuOscillators.push({ interval: stabInterval });
}

function stopMenuMusic() {
    if (!menuMusicPlaying) return;
    menuMusicPlaying = false;
    
    menuOscillators.forEach(item => {
        try {
            if (item.interval) {
                clearInterval(item.interval);
            }
            if (item.osc) {
                item.osc.stop();
            }
            if (item.osc1) {
                item.osc1.stop();
            }
            if (item.osc2) {
                item.osc2.stop();
            }
            if (item.lfo) {
                item.lfo.stop();
            }
        } catch(e) {}
    });
    
    menuOscillators = [];
}

// Basic sound generator
function playSound(frequency, duration, type = 'sine') {
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
}

// Enhanced thunder for tsunami events
// Dramatic thunder for lightning strikes (the original sustained rumble)
function playEnhancedThunder(soundToggle) {
    if (!soundToggle.checked) return;
    
    // Create longer, more powerful rumbling thunder
    const thunder = audioContext.createBufferSource();
    const thunderGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    // Create a 4 second noise buffer
    const bufferSize = audioContext.sampleRate * 4.0;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        const progress = i / bufferSize;
        let envelope;
        
        // Start at full volume immediately, sustained rumble
        if (progress < 0.3) {
            envelope = 1.0; // Long sustain
        } else {
            // Gradual decay
            envelope = 1.0 - ((progress - 0.3) / 0.7);
        }
        
        // Apply envelope to noise
        data[i] = (Math.random() * 2 - 1) * envelope;
    }
    thunder.buffer = buffer;
    
    // Low-pass filter for deep rumble
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    filter.Q.value = 0.7;
    
    thunderGain.gain.value = 2.5;
    
    thunder.connect(filter);
    filter.connect(thunderGain);
    thunderGain.connect(audioContext.destination);
    
    thunder.start(audioContext.currentTime);
    
    // Multiple cracks throughout
    setTimeout(() => {
        if (!soundToggle.checked) return;
        playSound(2500, 0.04, 'square');
        playSound(2000, 0.06, 'square');
    }, 20);
    
    setTimeout(() => {
        if (!soundToggle.checked) return;
        playSound(2200, 0.05, 'square');
    }, 600);
    
    setTimeout(() => {
        if (!soundToggle.checked) return;
        playSound(1800, 0.06, 'square');
    }, 1200);
}

// Wet, whooshy tsunami/wave sound
function playTsunamiWhoosh(soundToggle) {
    if (!soundToggle.checked) return;
    
    // Create a 3 second whooshing wave sound
    const whoosh = audioContext.createBufferSource();
    const whooshGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const highFilter = audioContext.createBiquadFilter();
    
    const duration = 3.0;
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        const progress = i / bufferSize;
        const time = progress * duration;
        
        // Wave-like envelope: builds up, crashes, then recedes
        let envelope;
        if (time < 0.5) {
            // Building wave - rising whoosh
            envelope = Math.pow(time / 0.5, 2) * 0.7;
        } else if (time < 1.0) {
            // Wave crash - peak intensity
            envelope = 0.7 + 0.3 * Math.sin((time - 0.5) * Math.PI);
        } else if (time < 1.5) {
            // Impact and splash
            envelope = 1.0 * Math.exp(-(time - 1.0) * 2);
        } else {
            // Water receding - gentle fade with bubbling
            const recedeProgress = (time - 1.5) / 1.5;
            envelope = 0.4 * Math.exp(-recedeProgress * 2) * (1 + 0.3 * Math.sin(time * 20));
        }
        
        // Combine noise with some tonal elements for "wetness"
        const noise = Math.random() * 2 - 1;
        // Add some low frequency rumble for the wave mass
        const waveRumble = Math.sin(time * 15 * Math.PI) * 0.2;
        // Add higher frequency splashing sounds
        const splash = Math.sin(time * 80 * Math.PI + Math.random() * 0.5) * 0.15;
        
        data[i] = (noise * 0.65 + waveRumble + splash) * envelope;
    }
    
    whoosh.buffer = buffer;
    
    // Band-pass filtering for watery sound
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, audioContext.currentTime);
    filter.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 0.5); // Opens up during crash
    filter.frequency.linearRampToValueAtTime(400, audioContext.currentTime + 1.5); // Closes as wave recedes
    filter.Q.value = 1.5;
    
    // High shelf to add some "spray" brightness
    highFilter.type = 'highshelf';
    highFilter.frequency.value = 2000;
    highFilter.gain.setValueAtTime(-5, audioContext.currentTime);
    highFilter.gain.linearRampToValueAtTime(3, audioContext.currentTime + 0.8); // Brighten during splash
    highFilter.gain.linearRampToValueAtTime(-3, audioContext.currentTime + 2.0);
    
    whooshGain.gain.setValueAtTime(0.5, audioContext.currentTime);
    whooshGain.gain.linearRampToValueAtTime(2.5, audioContext.currentTime + 0.8); // Build to crash
    whooshGain.gain.linearRampToValueAtTime(1.5, audioContext.currentTime + 1.5);
    whooshGain.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + duration);
    
    whoosh.connect(filter);
    filter.connect(highFilter);
    highFilter.connect(whooshGain);
    whooshGain.connect(audioContext.destination);
    
    whoosh.start(audioContext.currentTime);
    whoosh.stop(audioContext.currentTime + duration);
    
    // Add some discrete water splash sounds
    setTimeout(() => {
        if (!soundToggle.checked) return;
        // Splash impact
        playSound(150, 0.15, 'sine');
        playSound(200, 0.12, 'triangle');
    }, 800);
    
    setTimeout(() => {
        if (!soundToggle.checked) return;
        // Secondary splash
        playSound(180, 0.1, 'sine');
    }, 1100);
    
    setTimeout(() => {
        if (!soundToggle.checked) return;
        // Bubbling
        playSound(400, 0.08, 'sine');
        playSound(500, 0.06, 'sine');
    }, 1400);
}

// Realistic thunder effect
function playThunder(soundToggle) {
    if (!soundToggle.checked) return;
    
    // Create realistic thunder: sharp crack followed by deep rumbling decay
    const thunder = audioContext.createBufferSource();
    const thunderGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    // Create a 7 second thunder (first half of typical 14-15 second thunder)
    const bufferSize = audioContext.sampleRate * 7;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        const progress = i / bufferSize;
        const time = progress * 7; // Time in seconds
        let envelope = 0;
        
        // Phase 1: Sharp crack (0-0.05s) - very loud, bright
        if (time < 0.05) {
            envelope = 1.0;
            // Add bright high-frequency content for the crack
            data[i] = (Math.random() * 2 - 1) * envelope;
        }
        // Phase 2: Initial impact (0.05-0.3s) - loud rumble starts
        else if (time < 0.3) {
            envelope = 0.95 - (time - 0.05) * 0.2; // Decay from 0.95 to 0.9
            // Mix of frequencies
            data[i] = (Math.random() * 2 - 1) * envelope;
        }
        // Phase 3: Main rumble (0.3-4s) - sustained deep rumbling
        else if (time < 4) {
            const rumbleProgress = (time - 0.3) / 3.7;
            envelope = 0.9 * Math.exp(-rumbleProgress * 1.2); // Exponential decay
            // Lower frequency rumble
            const rumble = Math.random() * 2 - 1;
            data[i] = rumble * envelope;
        }
        // Phase 4: Fade out (4-7s) - gentle tail
        else {
            const fadeProgress = (time - 4) / 3;
            envelope = 0.3 * Math.exp(-fadeProgress * 2.5); // Faster exponential decay
            data[i] = (Math.random() * 2 - 1) * envelope;
        }
    }
    
    thunder.buffer = buffer;
    
    // Multi-stage filtering for realistic thunder spectrum
    // Start with broader spectrum, narrow to deep bass
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, audioContext.currentTime); // Start with crack
    filter.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3); // Drop to rumble
    filter.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 4); // Drop further
    filter.Q.value = 0.7;
    
    // Volume envelope with fade out
    thunderGain.gain.setValueAtTime(2.2, audioContext.currentTime); // Loud start
    thunderGain.gain.setValueAtTime(2.2, audioContext.currentTime + 4); // Hold
    thunderGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 7); // Fade out
    
    thunder.connect(filter);
    filter.connect(thunderGain);
    thunderGain.connect(audioContext.destination);
    
    thunder.start(audioContext.currentTime);
    thunder.stop(audioContext.currentTime + 7); // Stop after 7 seconds
    
    // Add bright crack layer at the very beginning
    setTimeout(() => {
        if (!soundToggle.checked) return;
        // Sharp, bright crack
        playSound(2200, 0.03, 'square');
        setTimeout(() => playSound(1800, 0.04, 'square'), 15);
        setTimeout(() => playSound(1400, 0.05, 'square'), 30);
    }, 5);
}

// Continuous volcano rumble for warming phase (3 seconds)
function playVolcanoRumble(soundToggle) {
    if (!soundToggle.checked) return;
    
    // Create a 3.5 second continuous rumble that builds in intensity
    const rumble = audioContext.createBufferSource();
    const rumbleGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    const duration = 3.5;
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        const progress = i / bufferSize;
        const time = progress * duration;
        
        // Envelope: starts low, builds up over time
        // Simulates magma pressure building
        const buildUp = 0.3 + progress * 0.7; // 0.3 to 1.0
        
        // Add some pulsing/throbbing (like magma churning)
        const pulse = 1 + 0.3 * Math.sin(time * 4 * Math.PI); // Slow throb
        const fastPulse = 1 + 0.15 * Math.sin(time * 12 * Math.PI); // Faster tremor
        
        // Base rumble noise
        const noise = Math.random() * 2 - 1;
        
        // Add low frequency sine wave for deep bass presence
        const bassFreq = 30 + progress * 20; // 30Hz to 50Hz, rising
        const bass = Math.sin(time * bassFreq * 2 * Math.PI) * 0.4;
        
        // Combine
        const envelope = buildUp * pulse * fastPulse;
        data[i] = (noise * 0.6 + bass) * envelope;
    }
    
    rumble.buffer = buffer;
    
    // Low-pass filter for deep, earth-shaking rumble
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(80, audioContext.currentTime);
    filter.frequency.linearRampToValueAtTime(150, audioContext.currentTime + duration); // Opens up as it builds
    filter.Q.value = 1.0;
    
    // Volume builds over time
    rumbleGain.gain.setValueAtTime(1.5, audioContext.currentTime);
    rumbleGain.gain.linearRampToValueAtTime(2.5, audioContext.currentTime + duration * 0.8);
    rumbleGain.gain.linearRampToValueAtTime(1.0, audioContext.currentTime + duration); // Slight dip before eruption
    
    rumble.connect(filter);
    filter.connect(rumbleGain);
    rumbleGain.connect(audioContext.destination);
    
    rumble.start(audioContext.currentTime);
    rumble.stop(audioContext.currentTime + duration);
}

// Continuous earthquake rumble (shorter than volcano, more shaky)
function playEarthquakeRumble(soundToggle) {
    if (!soundToggle.checked) return;
    
    // Create a 2.5 second rumble with shaking character
    const rumble = audioContext.createBufferSource();
    const rumbleGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    const duration = 2.5;
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        const progress = i / bufferSize;
        const time = progress * duration;
        
        // Envelope: quick attack, sustain, then fade
        let envelope;
        if (time < 0.1) {
            envelope = time / 0.1; // Quick ramp up
        } else if (time < 1.8) {
            envelope = 1.0; // Sustain
        } else {
            envelope = 1.0 - ((time - 1.8) / 0.7); // Fade out
        }
        
        // Add shaking/rattling modulation
        const shake = 1 + 0.2 * Math.sin(time * 25 * Math.PI); // Fast shake
        const rattle = 1 + 0.1 * Math.sin(time * 60 * Math.PI); // Higher freq rattle
        
        // Base rumble noise
        const noise = Math.random() * 2 - 1;
        
        // Very low frequency component for ground shake feel
        const groundShake = Math.sin(time * 20 * Math.PI) * 0.3;
        
        data[i] = (noise * 0.5 + groundShake) * envelope * shake * rattle;
    }
    
    rumble.buffer = buffer;
    
    // Very low-pass for deep, earth-shaking rumble
    filter.type = 'lowpass';
    filter.frequency.value = 120;
    filter.Q.value = 1.2;
    
    rumbleGain.gain.setValueAtTime(3.5, audioContext.currentTime); // Louder
    
    rumble.connect(filter);
    filter.connect(rumbleGain);
    rumbleGain.connect(audioContext.destination);
    
    rumble.start(audioContext.currentTime);
    rumble.stop(audioContext.currentTime + duration);
}

// Prolonged cracking/splitting sound for earthquake crack forming
// Similar to the rumble but with added crunchiness
function playEarthquakeCrack(soundToggle) {
    if (!soundToggle.checked) return;
    
    // Create a 2.5 second rumble with crunchy texture
    const crack = audioContext.createBufferSource();
    const crackGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    const duration = 2.5;
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        const progress = i / bufferSize;
        const time = progress * duration;
        
        // Envelope: quick attack, sustain, then fade (same as rumble)
        let envelope;
        if (time < 0.1) {
            envelope = time / 0.1;
        } else if (time < 1.8) {
            envelope = 1.0;
        } else {
            envelope = 1.0 - ((time - 1.8) / 0.7);
        }
        
        // Shaking/rattling modulation (same as rumble)
        const shake = 1 + 0.2 * Math.sin(time * 25 * Math.PI);
        const rattle = 1 + 0.1 * Math.sin(time * 60 * Math.PI);
        
        // Base rumble noise
        const noise = Math.random() * 2 - 1;
        
        // Ground shake (same as rumble)
        const groundShake = Math.sin(time * 20 * Math.PI) * 0.3;
        
        // Add subtle crunchiness - occasional micro-cracks
        const crunch = (Math.random() < 0.02) ? (Math.random() - 0.5) * 0.4 : 0;
        
        data[i] = (noise * 0.5 + groundShake + crunch) * envelope * shake * rattle;
    }
    
    crack.buffer = buffer;
    
    // Low-pass for deep rumble (same as earthquake rumble)
    filter.type = 'lowpass';
    filter.frequency.value = 150; // Slightly higher than pure rumble to let crunch through
    filter.Q.value = 1.0;
    
    crackGain.gain.setValueAtTime(3.5, audioContext.currentTime); // Same volume as rumble
    
    crack.connect(filter);
    filter.connect(crackGain);
    crackGain.connect(audioContext.destination);
    
    crack.start(audioContext.currentTime);
    crack.stop(audioContext.currentTime + duration);
}

// Main sound effects dispatcher
function playSoundEffect(effect, soundToggle) {
    if (!soundToggle.checked) return;
    
    switch(effect) {
        case 'move':
            playSound(200, 0.05);
            break;
        case 'rotate':
            playSound(300, 0.08);
            break;
        case 'drop':
            playSound(150, 0.1);
            break;
        case 'line':
            // Realistic cash register "cha-ching" sound
            // Phase 1: Mechanical "CHA" - drawer release mechanism (percussive thunk)
            playSound(80, 0.12, 'square');  // Deep mechanical thunk
            setTimeout(() => playSound(95, 0.10, 'square'), 15);
            
            // Phase 2: Metal rattle as drawer starts moving
            setTimeout(() => {
                playSound(220, 0.08, 'sawtooth');
                playSound(280, 0.06, 'sawtooth');
            }, 45);
            
            // Phase 3: Bell "CHING!" - the iconic high bell ring
            setTimeout(() => {
                // Primary bell tone (fundamental)
                playSound(2400, 0.18, 'sine');
                // Bell harmonics for richness
                playSound(2900, 0.14, 'sine');
                playSound(3200, 0.10, 'sine');
            }, 80);
            
            // Phase 4: Bell resonance and shimmer
            setTimeout(() => {
                playSound(3600, 0.08, 'sine');
                playSound(2600, 0.06, 'sine');
            }, 110);
            
            // Phase 5: Drawer sliding open (gentle rumble with metallic quality)
            setTimeout(() => {
                playSound(150, 0.09, 'sawtooth');
                playSound(170, 0.07, 'sawtooth');
            }, 150);
            
            // Final mechanical settling
            setTimeout(() => {
                playSound(140, 0.05, 'sawtooth');
            }, 220);
            break;
        case 'gold':
            // Enhanced "cha-ching" for special events (louder, brighter)
            // Phase 1: Stronger mechanical thunk
            playSound(75, 0.15, 'square');
            setTimeout(() => playSound(90, 0.13, 'square'), 15);
            
            // Phase 2: Louder metal rattle
            setTimeout(() => {
                playSound(240, 0.10, 'sawtooth');
                playSound(300, 0.08, 'sawtooth');
            }, 45);
            
            // Phase 3: BRIGHTER bell ring for gold
            setTimeout(() => {
                playSound(2600, 0.22, 'sine');  // Higher and louder
                playSound(3100, 0.18, 'sine');
                playSound(3500, 0.14, 'sine');
            }, 80);
            
            // Phase 4: Extra shimmer for gold
            setTimeout(() => {
                playSound(3900, 0.12, 'sine');
                playSound(4200, 0.10, 'sine');
                playSound(2800, 0.08, 'sine');
            }, 110);
            
            // Phase 5: Drawer sliding
            setTimeout(() => {
                playSound(155, 0.11, 'sawtooth');
                playSound(180, 0.09, 'sawtooth');
            }, 150);
            
            setTimeout(() => {
                playSound(145, 0.07, 'sawtooth');
            }, 220);
            break;
        case 'chaching':
            // Authentic cash register sound
            // Initial mechanical "chunk" of the drawer unlocking
            playSound(120, 0.15, 'square');
            
            // Bell "ding!" - the classic register bell (short, sharp)
            setTimeout(() => {
                playSound(1800, 0.15, 'sine');
                playSound(2200, 0.12, 'sine');
            }, 40);
            
            // Bell overtones/resonance
            setTimeout(() => {
                playSound(2400, 0.08, 'sine');
            }, 60);
            
            // Drawer sliding open (mechanical rumble)
            setTimeout(() => {
                playSound(140, 0.1, 'sawtooth');
                playSound(160, 0.08, 'sawtooth');
            }, 100);
            
            setTimeout(() => {
                playSound(130, 0.06, 'sawtooth');
            }, 180);
            break;
        case 'tsunami':
            playThunder(soundToggle);
            break;
        case 'rumble':
            // Deep, sustained rumbling sound for volcano warming and earthquake
            // Low frequency oscillating bass with subtle variations
            
            // Layer 1: Very deep bass rumble (sub-bass)
            playSound(40, 0.3, 'sine');
            playSound(45, 0.28, 'sine');
            
            // Layer 2: Low frequency throbbing
            setTimeout(() => {
                playSound(60, 0.25, 'sawtooth');
                playSound(55, 0.23, 'sawtooth');
            }, 50);
            
            // Layer 3: Mid-low rumble for texture
            setTimeout(() => {
                playSound(80, 0.2, 'triangle');
                playSound(75, 0.18, 'triangle');
            }, 100);
            
            // Layer 4: Subtle high-frequency rattle (like rocks grinding)
            setTimeout(() => {
                playSound(200, 0.1, 'sawtooth');
            }, 150);
            
            setTimeout(() => {
                playSound(180, 0.08, 'sawtooth');
            }, 200);
            break;
        case 'explosion':
            // Powerful explosion sound for volcano eruption
            // Deep bass boom followed by crackling
            playSound(50, 0.3, 'sine');
            playSound(45, 0.35, 'sine');
            
            setTimeout(() => {
                playSound(80, 0.2, 'square');
                playSound(100, 0.18, 'sawtooth');
            }, 50);
            
            setTimeout(() => {
                playSound(150, 0.15, 'sawtooth');
                playSound(200, 0.12, 'sawtooth');
            }, 100);
            
            setTimeout(() => {
                playSound(120, 0.1, 'square');
            }, 150);
            break;
        case 'alert':
            // UFO/Alert sound
            playSound(800, 0.15, 'sine');
            setTimeout(() => playSound(600, 0.15, 'sine'), 100);
            setTimeout(() => playSound(400, 0.15, 'sine'), 200);
            break;
        case 'special':
            // Special event sound (used for UFO)
            playSound(1200, 0.1, 'sine');
            setTimeout(() => playSound(1400, 0.1, 'sine'), 50);
            setTimeout(() => playSound(1600, 0.15, 'sine'), 100);
            break;
        case 'gameover':
            playSound(200, 0.3);
            setTimeout(() => playSound(150, 0.5), 200);
            break;
    }
}

// Continuous tornado wind sound - returns stop function
let tornadoWindSource = null;
let tornadoWindGain = null;
let tornadoWindFading = false;

function startTornadoWind(soundToggle) {
    if (!soundToggle.checked) return;
    if (tornadoWindSource) return; // Already playing
    
    tornadoWindFading = false;
    
    // Create continuous wind noise
    tornadoWindSource = audioContext.createBufferSource();
    tornadoWindGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const highFilter = audioContext.createBiquadFilter();
    
    // Create a looping noise buffer (4 seconds for smoother loop)
    const duration = 4.0;
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        // Just pure filtered noise - no modulation for constant sound
        const noise = Math.random() * 2 - 1;
        data[i] = noise;
    }
    
    tornadoWindSource.buffer = buffer;
    tornadoWindSource.loop = true;
    
    // Low-pass filter for very soft sound
    filter.type = 'lowpass';
    filter.frequency.value = 350;
    filter.Q.value = 0.1;
    
    // High-pass to remove low rumble
    highFilter.type = 'highpass';
    highFilter.frequency.value = 280;
    highFilter.Q.value = 0.1;
    
    // Very low volume for maximum subtlety
    tornadoWindGain.gain.setValueAtTime(0, audioContext.currentTime);
    tornadoWindGain.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 1.0);
    
    tornadoWindSource.connect(filter);
    filter.connect(highFilter);
    highFilter.connect(tornadoWindGain);
    tornadoWindGain.connect(audioContext.destination);
    
    tornadoWindSource.start(audioContext.currentTime);
}

function stopTornadoWind() {
    if (tornadoWindFading) return; // Already fading
    if (!tornadoWindSource || !tornadoWindGain) return;
    
    tornadoWindFading = true;
    
    // Get current gain value and fade from there
    const currentGain = tornadoWindGain.gain.value;
    tornadoWindGain.gain.cancelScheduledValues(audioContext.currentTime);
    tornadoWindGain.gain.setValueAtTime(currentGain, audioContext.currentTime);
    tornadoWindGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1.5);
    
    // Store references before clearing
    const sourceToStop = tornadoWindSource;
    
    // Stop after fade completes
    setTimeout(() => {
        try {
            sourceToStop.stop();
        } catch (e) {
            // Already stopped
        }
        tornadoWindSource = null;
        tornadoWindGain = null;
        tornadoWindFading = false;
    }, 1600);
}

// Low rumble/crumble sound for tornado destroying blobs
function playSmallExplosion(soundToggle) {
    if (!soundToggle.checked) return;
    
    // Create a sustained low crumbling sound
    const crumble = audioContext.createBufferSource();
    const crumbleGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    const duration = 1.8;
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        const progress = i / bufferSize;
        const time = progress * duration;
        
        // Gradual envelope with long fade out
        let envelope;
        if (time < 0.1) {
            envelope = time / 0.1; // Quick attack
        } else if (time < 0.5) {
            envelope = 1.0; // Sustain
        } else {
            envelope = Math.exp(-(time - 0.5) * 1.5); // Long gradual fade
        }
        
        // Base low rumble noise
        const noise = Math.random() * 2 - 1;
        
        // Low frequency rumble components
        const rumble1 = Math.sin(time * 30 * Math.PI) * 0.3;
        const rumble2 = Math.sin(time * 45 * Math.PI) * 0.2;
        const rumble3 = Math.sin(time * 20 * Math.PI) * 0.25;
        
        // Subtle crunch texture
        const crunch = (Math.random() < 0.03) ? (Math.random() - 0.5) * 0.3 : 0;
        
        // Ground shake feel
        const shake = 1 + 0.15 * Math.sin(time * 18 * Math.PI);
        
        data[i] = (noise * 0.4 + rumble1 + rumble2 + rumble3 + crunch) * envelope * shake;
    }
    
    crumble.buffer = buffer;
    
    // Low-pass for deep rumble
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    filter.Q.value = 0.8;
    
    crumbleGain.gain.setValueAtTime(2.5, audioContext.currentTime);
    
    crumble.connect(filter);
    filter.connect(crumbleGain);
    crumbleGain.connect(audioContext.destination);
    
    crumble.start(audioContext.currentTime);
    crumble.stop(audioContext.currentTime + duration);
}

    // Export all public functions for use in main game
    window.AudioSystem = {
        audioContext,
        startMusic,
        stopMusic,
        startMenuMusic,
        stopMenuMusic,
        playSoundEffect,
        playEnhancedThunder,
        playThunder,
        playVolcanoRumble,
        playEarthquakeRumble,
        playEarthquakeCrack,
        playTsunamiWhoosh,
        startTornadoWind,
        stopTornadoWind,
        playSmallExplosion
    };
})(); // End IIFE
