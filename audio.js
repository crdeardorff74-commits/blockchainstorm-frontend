// Audio System Module for BLOCKCHaiNSTORM
// Handles all sound effects, music, and audio context management

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
    
    // Gentle 80s arp melody
    const melody = [
        { note: 330, duration: 0.3 }, { note: 294, duration: 0.3 },
        { note: 262, duration: 0.3 }, { note: 294, duration: 0.3 },
        { note: 330, duration: 0.4 }, { note: 392, duration: 0.4 }
    ];
    
    let melodyIndex = 0;
    let beat = 0;
    const beatInterval = 60000 / 100; // 100 BPM
    
    kickScheduler = setInterval(() => {
        // Simple kick pattern
        if (beat % 4 === 0) {
            playKick();
        }
        
        // Snare on 2 and 4
        if (beat % 4 === 2) {
            playSnare();
        }
        
        // Melody every 2 beats
        if (beat % 2 === 0) {
            const note = melody[melodyIndex % melody.length];
            playMelodyNote(note.note, note.duration);
            melodyIndex++;
        }
        
        // Gentle bass line
        if (beat % 8 === 0) {
            const bassNotes = [55, 65, 73, 65]; // A-C-D-C
            wobble.bass.frequency.value = bassNotes[(beat / 8) % bassNotes.length];
        }
        
        beat++;
    }, beatInterval);
}

// DOWNPOUR MODE - Medium tempo, balanced synth/dubstep (120 BPM)
function startDownpourMusic() {
    const wobble = createWobbleBass();
    bassOscillator = wobble;
    wobble.lfo.frequency.value = 4; // Moderate wobble
    
    const melody = [
        { note: 330, duration: 0.25 }, { note: 294, duration: 0.2 },
        { note: 262, duration: 0.25 }, { note: 294, duration: 0.2 },
        { note: 330, duration: 0.3 }, { note: 392, duration: 0.3 },
        { note: 440, duration: 0.35 }
    ];
    
    let melodyIndex = 0;
    let beat = 0;
    let section = 0;
    const beatInterval = 60000 / 120; // 120 BPM
    
    kickScheduler = setInterval(() => {
        if (beat % 32 === 0) {
            section++;
            wobble.lfo.frequency.value = section % 2 === 0 ? 4 : 5;
            wobble.filter.frequency.value = section % 2 === 0 ? 700 : 900;
        }
        
        // Standard dubstep kick pattern
        if (beat % 4 === 0 || beat % 4 === 2) {
            playKick();
        }
        
        // Snare on 2 and 4
        if (beat % 4 === 1 || beat % 4 === 3) {
            playSnare();
        }
        
        // Active melody
        if (beat % 2 === 0) {
            const note = melody[melodyIndex % melody.length];
            playMelodyNote(note.note, note.duration);
            melodyIndex++;
        }
        
        // Dynamic bass
        if (beat % 8 === 0) {
            const bassNotes = [55, 73, 65, 55];
            wobble.bass.frequency.value = bassNotes[(beat / 8) % bassNotes.length];
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
    
    let currentMelody = melodyA;
    let melodyIndex = 0;
    let beat = 0;
    let section = 0;
    const beatInterval = 60000 / 140; // 140 BPM
    
    kickScheduler = setInterval(() => {
        if (beat % 32 === 0) {
            section++;
            currentMelody = section % 2 === 0 ? melodyA : melodyB;
            wobble.lfo.frequency.value = [6, 7, 8][section % 3];
            wobble.filter.frequency.value = [800, 1000, 1200][section % 3];
        }
        
        // More aggressive kick pattern
        if (beat % 4 === 0 || beat % 4 === 2) {
            playKick();
        }
        if (beat % 16 === 7) {
            setTimeout(() => playKick(), 100); // Double kick
        }
        
        // Snare
        if (beat % 4 === 1 || beat % 4 === 3) {
            playSnare();
        }
        
        // Fast melody
        if (beat % 1 === 0) {
            const note = currentMelody[melodyIndex % currentMelody.length];
            playMelodyNote(note.note, note.duration);
            melodyIndex++;
        }
        
        // Active bass movement
        if (beat % 4 === 0) {
            const bassNotes = [55, 82, 73, 65];
            wobble.bass.frequency.value = bassNotes[(beat / 4) % bassNotes.length];
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
    
    let currentMelody = melodyA;
    let melodyIndex = 0;
    let beat = 0;
    let section = 0;
    const beatInterval = 60000 / 160; // 160 BPM
    
    kickScheduler = setInterval(() => {
        if (beat % 32 === 0) {
            section++;
            if (section % 3 === 0) currentMelody = melodyA;
            else if (section % 3 === 1) currentMelody = melodyB;
            else currentMelody = melodyC;
            
            wobble.lfo.frequency.value = [8, 10, 12][section % 3];
            wobble.filter.frequency.value = [1000, 1200, 1400][section % 3];
        }
        
        // Complex kick pattern
        if (beat % 4 === 0 || beat % 4 === 2) {
            playKick();
        }
        if (beat % 8 === 3 || beat % 8 === 7) {
            setTimeout(() => playKick(), 80);
        }
        
        // Snare
        if (beat % 4 === 1 || beat % 4 === 3) {
            playSnare();
        }
        
        // Rapid melody
        if (beat % 1 === 0) {
            const note = currentMelody[melodyIndex % currentMelody.length];
            playMelodyNote(note.note, note.duration);
            melodyIndex++;
        }
        
        // Rapid bass changes
        if (beat % 4 === 0) {
            const bassNotes = [55, 82, 73, 65, 49, 73];
            wobble.bass.frequency.value = bassNotes[(beat / 4) % bassNotes.length];
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
    
    let currentMelody = melodyA;
    let melodyIndex = 0;
    let beat = 0;
    let section = 0;
    const beatInterval = 60000 / 180; // 180 BPM - EXTREME
    
    kickScheduler = setInterval(() => {
        if (beat % 32 === 0) {
            section++;
            if (section % 3 === 0) currentMelody = melodyA;
            else if (section % 3 === 1) currentMelody = melodyB;
            else currentMelody = melodyC;
            
            wobble.lfo.frequency.value = [12, 14, 16, 18][section % 4];
            wobble.filter.frequency.value = [1200, 1400, 1600, 1800][section % 4];
        }
        
        // Maximum kick intensity
        if (beat % 4 === 0 || beat % 4 === 2) {
            playKick();
        }
        if (beat % 4 === 1 || beat % 4 === 3) {
            setTimeout(() => playKick(), 60); // Frequent double kicks
        }
        
        // Rapid snare
        if (beat % 4 === 1 || beat % 4 === 3) {
            playSnare();
        }
        if (section % 2 === 1 && beat % 8 === 5) {
            setTimeout(() => playSnare(), 50);
        }
        
        // Ultra-fast melody
        const note = currentMelody[melodyIndex % currentMelody.length];
        playMelodyNote(note.note, note.duration);
        melodyIndex++;
        
        // Chaotic bass
        if (beat % 2 === 0) {
            const bassNotes = [55, 82, 73, 65, 49, 73, 82, 55];
            wobble.bass.frequency.value = bassNotes[(beat / 2) % bassNotes.length];
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
function playEnhancedThunder(soundToggle) {
    if (!soundToggle.checked) return;
    
    // Create longer, more powerful rumbling thunder for tsunami
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
    
    thunderGain.gain.value = 2.5; // Even louder for tsunami!
    
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

// Export all public functions for use in main game
window.AudioSystem = {
    audioContext,
    startMusic,
    stopMusic,
    startMenuMusic,
    stopMenuMusic,
    playSoundEffect,
    playEnhancedThunder,
    playThunder
};
