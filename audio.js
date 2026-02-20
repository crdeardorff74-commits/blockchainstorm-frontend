// Audio System Module for TaNTЯiS
// Handles all sound effects, music, and audio context management

const AudioSystem = (function() {

    // === AUDIO DEBUG LOGGER (collects in memory, no on-screen display) ===
    const _dbgLines = [];
    function _dbg(msg) {
        Logger.debug('🔊DBG: ' + msg);
        _dbgLines.push(new Date().toLocaleTimeString() + ' ' + msg);
        if (_dbgLines.length > 100) _dbgLines.shift();
    }
    function _getDbgLog() {
        return _dbgLines.join('\n');
    }

    // Initialize Web Audio API
    let audioContext;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        _dbg('audioContext created, state=' + audioContext.state);
        audioContext.addEventListener('statechange', () => _dbg('audioContext statechange → ' + audioContext.state));
    } catch (err) {
        Logger.error('🛡️ Failed to create AudioContext:', err);
        // Create a stub so the rest of the module doesn't crash
        audioContext = {
            state: 'closed',
            resume: () => Promise.resolve(),
            createGain: () => ({ gain: { value: 1 }, connect: () => {}, disconnect: () => {} }),
            createBufferSource: () => ({ connect: () => {}, start: () => {}, stop: () => {} }),
            destination: {},
            addEventListener: () => {}
        };
    }

    // Guard: block music playback until user has interacted.
    // iPad Safari auto-fires change events that call startMusic before any tap.
    let userHasInteracted = false;
    function markUserInteraction() {
        if (!userHasInteracted) {
            userHasInteracted = true;
            _dbg('userHasInteracted = true');
        }
    }
    // Listen for first interaction
    ['touchend', 'click', 'keydown'].forEach(evt => {
        document.addEventListener(evt, markUserInteraction, { once: false, capture: true });
    });

    // iPad detection - iPad Safari can't follow GitHub's 302 redirect chain
    // in Audio elements (error code 4) or fetch (CORS). Route through proxy.
    const _isIOSAudio = navigator.userAgent.includes('iPad') || navigator.userAgent.includes('iPhone') || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (_isIOSAudio) _dbg('iOS detected — using music proxy');

// Music system state
let musicPlaying = false;
let musicInterval = null;
let bassOscillator = null;
let lfoOscillator = null;
let kickScheduler = null;

// Menu music state
let menuMusicPlaying = false;
let menuOscillators = [];
let menuMusicElement = null; // MP3 element for menu music
let hasPlayedGame = false; // Track if a game has been completed
let gameInProgress = false; // Track if a game is currently running
let fullSongPlayedOnMenu = false; // Track if a full song has completed on main menu

// Music volume controls
let musicVolume = parseFloat(localStorage.getItem('tantris_musicVolume')) || 0.5;
let musicMuted = localStorage.getItem('tantris_musicMuted') === 'true';
let sfxVolume = parseFloat(localStorage.getItem('tantris_sfxVolume')) || 0.7;
let sfxMuted = localStorage.getItem('tantris_sfxMuted') === 'true';

// MP3 gameplay music - multiple tracks
// iPad Safari can't follow GitHub's 302 redirects, so route through game backend proxy
const GITHUB_MUSIC_URL = AppConfig.GITHUB_RELEASES + '/Music/';
const PROXY_MUSIC_URL = AppConfig.GAME_API + '/music/Music/';
const MUSIC_BASE_URL = _isIOSAudio ? PROXY_MUSIC_URL : GITHUB_MUSIC_URL;

// MP3 sound effects (hosted on GitHub Releases)
// iPad Safari can't follow GitHub's 302 redirects, so route through game backend proxy
const GITHUB_SFX_URL = AppConfig.GITHUB_RELEASES + '/SFX/';
const PROXY_SFX_URL = AppConfig.GAME_API + '/music/SFX/';
const SFX_BASE_URL = _isIOSAudio ? PROXY_SFX_URL : GITHUB_SFX_URL;

// Sound effect MP3s
const soundEffectFiles = {
    strike: SFX_BASE_URL + 'Strike.mp3',
    lineClear: SFX_BASE_URL + 'LineClear.mp3',
    tsunami: SFX_BASE_URL + 'Tsunami.mp3',
    banjo: SFX_BASE_URL + 'Banjo.mp3'
};

// Per-effect volume levels (0.0 to 1.0)
const soundEffectVolumes = {
    strike: 0.7,
    lineClear: 0.7,
    tsunami: 0.4,  // Quieter for tsunami
    banjo: 0.8     // UFO delivery sound
};

// Preloaded sound effect audio elements
let soundEffectElements = {};

// Initialize sound effect audio elements
function initSoundEffects() {
    Object.keys(soundEffectFiles).forEach(id => {
        const audio = new Audio(soundEffectFiles[id]);
        audio.volume = soundEffectVolumes[id] || 0.7;
        audio.preload = 'auto';
        soundEffectElements[id] = audio;
    });
    Logger.info('🔊 Initialized sound effect MP3s:', Object.keys(soundEffectFiles));
}

// Play an MP3 sound effect
function playMP3SoundEffect(effectId, soundToggle) {
    if (!soundToggle || !soundToggle.checked) return;
    if (sfxMuted) return;
    
    const audio = soundEffectElements[effectId];
    if (audio) {
        // Clone the audio to allow overlapping plays
        const clone = audio.cloneNode();
        clone.volume = (soundEffectVolumes[effectId] || 0.7) * sfxVolume;
        clone.play().catch(e => Logger.debug('Sound effect autoplay prevented:', e));
    }
}

// Play banjo sound effect while pausing music, resume when done (UFO easter egg)
function playBanjoWithMusicPause(soundToggle, onComplete = null) {
    if (!soundToggle || !soundToggle.checked) {
        if (onComplete) onComplete();
        return;
    }
    if (sfxMuted) {
        if (onComplete) onComplete();
        return;
    }
    
    const banjoAudio = soundEffectElements['banjo'];
    if (!banjoAudio) {
        if (onComplete) onComplete();
        return;
    }
    
    // Directly pause the current music track
    const wasPaused = musicPaused;
    let pausedAudioElement = null;
    
    if (!wasPaused) {
        // First try the tracked current playing track
        if (currentPlayingTrack && gameplayMusicElements[currentPlayingTrack]) {
            pausedAudioElement = gameplayMusicElements[currentPlayingTrack];
            pausedAudioElement.pause();
            musicPaused = true;
            Logger.debug('🎵 Paused gameplay music for banjo:', currentPlayingTrack);
        } else {
            // Fallback: find and pause any playing gameplay music element
            for (const [trackId, audio] of Object.entries(gameplayMusicElements)) {
                if (audio && !audio.paused) {
                    pausedAudioElement = audio;
                    pausedAudioElement.pause();
                    musicPaused = true;
                    Logger.debug('🎵 Paused playing audio (fallback) for banjo:', trackId);
                    break;
                }
            }
        }
        
        // Also check menu music
        if (!pausedAudioElement && menuMusicElement && !menuMusicElement.paused) {
            pausedAudioElement = menuMusicElement;
            pausedAudioElement.pause();
            musicPaused = true;
            Logger.debug('🎵 Paused menu music for banjo');
        }
    }
    
    // Clone and play banjo
    const clone = banjoAudio.cloneNode();
    clone.volume = (soundEffectVolumes['banjo'] || 0.8) * sfxVolume;
    
    // Track whether banjo completed (ended or failed) to prevent double-firing
    let banjoCompleted = false;
    
    function completeBanjo(source) {
        if (banjoCompleted) return;
        banjoCompleted = true;
        
        if (onComplete) {
            musicPaused = false;
            onComplete();
            Logger.debug('🎵 Banjo finished (' + source + '), running callback');
        } else if (!wasPaused && pausedAudioElement) {
            pausedAudioElement.play().catch(e => Logger.debug('Music resume prevented:', e));
            musicPaused = false;
            Logger.debug('🎵 Music resumed after banjo (' + source + ')');
        }
    }
    
    // When banjo finishes, either call the callback or resume music
    clone.onended = () => completeBanjo('ended');
    
    // Safety timeout: if banjo doesn't play within 4s (e.g. iOS load failure),
    // fire the callback anyway so the F Word song isn't stuck
    setTimeout(() => completeBanjo('timeout'), 4000);
    
    clone.play().catch(e => {
        Logger.debug('Banjo autoplay prevented:', e);
        completeBanjo('catch');
    });
    
    Logger.debug('🪕 Banjo playing, music paused');
}

// Initialize sound effects on load
initSoundEffects();

// Songs for during gameplay (non-Cascade songs)
const gameplaySongs = [
    // A
    { id: 'a_bent_horizon', name: 'A Bent Horizon', file: MUSIC_BASE_URL + 'A.Bent.Horizon.mp3' },
    { id: 'a_game_of_falling_blocks', name: 'A Game of Falling Blocks', file: MUSIC_BASE_URL + 'A.Game.of.Falling.Blocks.mp3' },
    { id: 'a_river_skips_through_it', name: 'A River Skips Through It', file: MUSIC_BASE_URL + 'A.River.Skips.Through.It.mp3' },
    // B
    { id: 'bide_your_time', name: 'Bide Your Time', file: MUSIC_BASE_URL + 'Bide.Your.Time.mp3' },
    { id: 'block_on_fire', name: 'Block on Fire', file: MUSIC_BASE_URL + 'Block.on.Fire.mp3' },
    { id: 'blood_rains_down', name: 'Blood Rains Down', file: MUSIC_BASE_URL + 'Blood.Rains.Down.mp3' },
    { id: 'buzz_light_beer', name: 'Buzz Light Beer', file: MUSIC_BASE_URL + 'Buzz.Light.Beer.mp3' },
    // C
    { id: 'canononymity', name: 'Canonymity', file: MUSIC_BASE_URL + 'Canonymity.mp3' },
    { id: 'canononymity_dubstep', name: 'Canonymity (Dubstep)', file: MUSIC_BASE_URL + 'Canonymity.Dubstep.mp3' },
    { id: 'canononymity_house', name: 'Canonymity (House)', file: MUSIC_BASE_URL + 'Canonymity.House.mp3' },
    { id: 'canononymity_martin_kermit', name: 'Canonymity (Martin/Kermit)', file: MUSIC_BASE_URL + 'Canonymity.Martin_Kermit.mp3' },
    { id: 'canononymity_orchestral', name: 'Canonymity (Orchestral)', file: MUSIC_BASE_URL + 'Canonymity.Orchestral.mp3' },
    { id: 'canononymity_piano', name: 'Canonymity (Piano)', file: MUSIC_BASE_URL + 'Canonymity.Piano.mp3' },
    { id: 'cascade_void_nervous', name: 'Cascade into the Void (Nervous Mix)', file: MUSIC_BASE_URL + 'Cascade.into.the.Void.Nervous.Mix.mp3' },
    { id: 'cascade', name: 'Cascade of Colored Bricks', file: MUSIC_BASE_URL + 'Cascade.of.Colored.Bricks.mp3' },
    { id: 'clearing_skies', name: 'Clearing Skies', file: MUSIC_BASE_URL + 'Clearing.Skies.mp3' },
    { id: 'cosmic_reggae', name: 'Cosmic Regae', file: MUSIC_BASE_URL + 'Cosmic.Regae.mp3' },
    { id: 'cosmic_reggae_reverb', name: 'Cosmic Regae Reverb', file: MUSIC_BASE_URL + 'Cosmic.Regae.Reverb.mp3' },
    { id: 'cosmic_sneeze', name: 'Cosmic Sneeze', file: MUSIC_BASE_URL + 'Cosmic.Sneeze.mp3' },
    // D
    { id: 'delayed_gravitation', name: 'Delayed Gravitation', file: MUSIC_BASE_URL + 'Delayed.Gravitation.mp3' },
    { id: 'do_you_want_a_score', name: 'Do You Want a Score', file: MUSIC_BASE_URL + 'Do.You.Want.a.Score.mp3' },
    { id: 'drizzling_echoes', name: 'Drizzling Echoes', file: MUSIC_BASE_URL + 'Drizzling.Echoes.mp3' },
    // E
    { id: 'electric_wind_gusts', name: 'Electric Wind Gusts', file: MUSIC_BASE_URL + 'Electric.Wind.Gusts.mp3' },
    { id: 'elemental_flow', name: 'Elemental Flow', file: MUSIC_BASE_URL + 'Elemental.Flow.mp3' },
    // F
    { id: 'fallin_down', name: "Fallin' Down", file: MUSIC_BASE_URL + 'Fallin.Down.mp3' },
    { id: 'falling_blocks', name: 'Falling Blocks Reactor', file: MUSIC_BASE_URL + 'Falling.Blocks.Reactor.mp3' },
    { id: 'falling_for_you', name: 'Falling for You', file: MUSIC_BASE_URL + 'Falling.for.You.mp3' },
    { id: 'falling_forever', name: 'Falling Forever', file: MUSIC_BASE_URL + 'Falling.Forever.mp3' },
    { id: 'falling_skies', name: 'Falling Skies', file: MUSIC_BASE_URL + 'Falling.Skies.mp3' },
    { id: 'falling_tide', name: 'Falling Tide', file: MUSIC_BASE_URL + 'Falling.Tide.mp3' },
    { id: 'fiddle_puddles', name: 'Fiddle Puddles', file: MUSIC_BASE_URL + 'Fiddle.Puddles.mp3' },
    { id: 'flood_me', name: 'Flood Me', file: MUSIC_BASE_URL + 'Flood.Me.mp3' },
    { id: 'forecast_calls_for_blocks', name: 'Forecast Calls for Blocks', file: MUSIC_BASE_URL + 'Forecast.Calls.for.Blocks.mp3' },
    { id: 'frolicking_among_the_ruins', name: 'Frolicking Among the Ruins', file: MUSIC_BASE_URL + 'Frolicking.Among.the.Ruins.mp3' },
    // G
    { id: 'get_some_tonight', name: 'Get Some Tonight', file: MUSIC_BASE_URL + 'Get.Some.Tonight.mp3' },
    { id: 'gin_and_tectonic', name: 'Gin & Tectonic', file: MUSIC_BASE_URL + 'Gin.Tectonic.mp3' },
    { id: 'gravitational', name: 'Gravitational', file: MUSIC_BASE_URL + 'Gravitational.mp3' },
    { id: 'gremlin_swell', name: 'Gremlin Swell', file: MUSIC_BASE_URL + 'Gremlin.Swell.mp3' },
    { id: 'gremlins_arcade', name: 'Gremlins Arcade', file: MUSIC_BASE_URL + 'Gremlins.Arcade.mp3' },
    // H
    { id: 'haunted_hailstones', name: 'Haunted Hailstones', file: MUSIC_BASE_URL + 'Haunted.Hailstones.mp3' },
    { id: 'hold_it_in', name: 'Hold It In', file: MUSIC_BASE_URL + 'Hold.It.In.mp3' },
    { id: 'hold_it', name: 'Hold It', file: MUSIC_BASE_URL + 'Hold.It.mp3' },
    { id: 'hold_off_for_me', name: 'Hold Off for Me', file: MUSIC_BASE_URL + 'Hold.Off.for.Me.mp3' },
    // J
    { id: 'joyful_odie', name: 'Joyful Odie', file: MUSIC_BASE_URL + 'Joyful.Odie.mp3' },
    { id: 'just_a_game', name: 'Just a Game', file: MUSIC_BASE_URL + 'Just.a.Game.mp3' },
    // L
    { id: 'lava_bells', name: 'Lava Bells', file: MUSIC_BASE_URL + 'Lava.Bells.mp3' },
    { id: 'lullaby_bye_bye', name: 'Lullaby Bye Bye', file: MUSIC_BASE_URL + 'Lullaby.Bye.Bye.mp3' },
    // M
    { id: 'meteor_shower', name: 'Meteor Shower', file: MUSIC_BASE_URL + 'Meteor.Shower.mp3' },
    { id: 'microcosmic', name: 'Microcosmic', file: MUSIC_BASE_URL + 'Microcosmic.mp3' },
    { id: 'midnight_mogwai', name: 'Midnight Mogwai', file: MUSIC_BASE_URL + 'Midnight.Mogwai.mp3' },
    { id: 'meet_cute', name: 'Meet Cute (When Claude Met Suno)', file: MUSIC_BASE_URL + 'Meet.Cute.When.Claude.Met.Suno.mp3' },
    { id: 'meet_cuter', name: 'Meet Cuter (When Claude Met Suno)', file: MUSIC_BASE_URL + 'Meet.Cuter.When.Claude.Met.Suno.mp3' },
    { id: 'meet_cutest', name: 'Meet Cutest (When Claude Met Suno)', file: MUSIC_BASE_URL + 'Meet.Cutest.When.Claude.Met.Suno.mp3' },
    // N
    { id: 'natural_disasters', name: 'Natural Disasters', file: MUSIC_BASE_URL + 'Natural.Disasters.mp3' },
    { id: 'natural_selection', name: 'Natural Selection', file: MUSIC_BASE_URL + 'Natural.Selection.mp3' },
    // P
    { id: 'perfect_storm', name: 'Perfect Storm', file: MUSIC_BASE_URL + 'Perfect.Storm.mp3' },
    { id: 'pity_puddles', name: 'Pity Puddles', file: MUSIC_BASE_URL + 'Pity.Puddles.mp3' },
    // R
    { id: 'rubber_and_glue', name: 'Rubber & Glue', file: MUSIC_BASE_URL + 'Rubber.Glue.mp3' },
    // S
    { id: 'slow_burn', name: 'Slow Burn', file: MUSIC_BASE_URL + 'Slow.Burn.mp3' },
    { id: 'solar_echoes', name: 'Solar Echoes', file: MUSIC_BASE_URL + 'Solar.Echoes.mp3' },
    { id: 'stacked_like_dolly', name: 'Stacked (Like Dolly)', file: MUSIC_BASE_URL + 'Stacked.Like.Dolly.mp3' },
    { id: 'stacked_like_loni', name: 'Stacked (Like Loni)', file: MUSIC_BASE_URL + 'Stacked.Like.Loni.mp3' },
    { id: 'stacked_like_pam', name: 'Stacked (Like Pam)', file: MUSIC_BASE_URL + 'Stacked.Like.Pam.mp3' },
    { id: 'stacked_like_sofia', name: 'Stacked (Like Sofia)', file: MUSIC_BASE_URL + 'Stacked.Like.Sofia.mp3' },
    { id: 'stilted_erosion', name: 'Stilted Erosion', file: MUSIC_BASE_URL + 'Stilted.Erosion.mp3' },
    { id: 'stuck_on_the_grid', name: 'Stuck on the Grid', file: MUSIC_BASE_URL + 'Stuck.on.the.Grid.mp3' },
    { id: 'symphonic_fog', name: 'Symphonic Fog', file: MUSIC_BASE_URL + 'Symphonic.Fog.mp3' },
    // T - TaNTЯiS Fever variants
    { id: 'tantris_fever_70s_rock', name: "TaNTЯiS Fever ('70s Rock)", file: MUSIC_BASE_URL + 'TaNT.iS.Fever.70s.Rock.mp3' },
    { id: 'tantris_fever_80s_eurobeat', name: "TaNTЯiS Fever ('80s Eurobeat)", file: MUSIC_BASE_URL + 'TaNT.iS.Fever.80s.Eurobeat.mp3' },
    { id: 'tantris_fever_80s_eurobeat_redux', name: "TaNTЯiS Fever ('80s Eurobeat Redux)", file: MUSIC_BASE_URL + 'TaNT.iS.Fever.80s.Eurobeat.Redux.mp3' },
    { id: 'tantris_fever_80s_hair_band', name: "TaNTЯiS Fever ('80s Hair Band)", file: MUSIC_BASE_URL + 'TaNT.iS.Fever.80s.Hair.Band.mp3' },
    { id: 'tantris_fever_80s_pop', name: "TaNTЯiS Fever ('80s Pop)", file: MUSIC_BASE_URL + 'TaNT.iS.Fever.80s.Pop.mp3' },
    { id: 'tantris_fever_90s_alternative', name: "TaNTЯiS Fever ('90s Alternative)", file: MUSIC_BASE_URL + 'TaNT.iS.Fever.90s.Alternative.mp3' },
    { id: 'tantris_fever_a_capella', name: 'TaNTЯiS Fever (A Capella)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.A.Capella.mp3' },
    { id: 'tantris_fever_a_capella_redux', name: 'TaNTЯiS Fever (A Capella Redux)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.A.Capella.Redux.mp3' },
    { id: 'tantris_fever_a_capella_redux_redux', name: 'TaNTЯiS Fever (A Capella Redux Redux)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.A.Capella.Redux.Redux.mp3' },
    { id: 'tantris_fever_barbershop', name: 'TaNTЯiS Fever (Barbershop Quartet)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Barbershop.Quartet.mp3' },
    { id: 'tantris_fever_blues', name: 'TaNTЯiS Fever (Blues)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Blues.mp3' },
    { id: 'tantris_fever_boy_band', name: 'TaNTЯiS Fever (Boy Band)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Boy.Band.mp3' },
    { id: 'tantris_fever_boy_band_redux', name: 'TaNTЯiS Fever (Boy Band Redux)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Boy.Band.Redux.mp3' },
    { id: 'tantris_fever_country', name: 'TaNTЯiS Fever (Country)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Country.mp3' },
    { id: 'tantris_fever_disco', name: 'TaNTЯiS Fever (Disco)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Disco.mp3' },
    { id: 'tantris_fever_gospel', name: 'TaNTЯiS Fever (Gospel)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Gospel.mp3' },
    { id: 'tantris_fever_heavy_metal', name: 'TaNTЯiS Fever (Heavy Metal)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Heavy.Metal.mp3' },
    { id: 'tantris_fever_instrumental_rap', name: 'TaNTЯiS Fever (Instrumental Rap)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Instrumental.Rap.mp3' },
    { id: 'tantris_fever_instrumental_rap_redux', name: 'TaNTЯiS Fever (Instrumental Rap Redux)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Instrumental.Rap.Redux.mp3' },
    { id: 'tantris_fever_instrumental_rap_redux_redux', name: 'TaNTЯiS Fever (Instrumental Rap Redux Redux)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Instrumental.Rap.Redux.Redux.mp3' },
    { id: 'tantris_fever_k_pop', name: 'TaNTЯiS Fever (K-pop)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.K-pop.mp3' },
    { id: 'tantris_fever_k_pop_redux', name: 'TaNTЯiS Fever (K-Pop Redux)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.K-Pop.Redux.mp3' },
    { id: 'tantris_fever_k_pop_redux_redux', name: 'TaNTЯiS Fever (K-Pop Redux Redux)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.K-Pop.Redux.Redux.mp3' },
    { id: 'tantris_fever', name: 'TaNTЯiS Fever', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.mp3' },
    { id: 'tantris_fever_piano', name: 'TaNTЯiS Fever (Piano)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Piano.mp3' },
    { id: 'tantris_fever_piano_redux', name: 'TaNTЯiS Fever (Piano Redux)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Piano.Redux.mp3' },
    { id: 'tantris_fever_piano_redux_redux', name: 'TaNTЯiS Fever (Piano Redux Redux)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Piano.Redux.Redux.mp3' },
    { id: 'tantris_fever_rap', name: 'TaNTЯiS Fever (Rap)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Rap.mp3' },
    { id: 'tantris_fever_rap_redux', name: 'TaNTЯiS Fever (Rap Redux)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Rap.Redux.mp3' },
    { id: 'tantris_fever_redux', name: 'TaNTЯiS Fever Redux', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Redux.mp3' },
    { id: 'tantris_fever_redux_redux', name: 'TaNTЯiS Fever Redux Redux', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Redux.Redux.mp3' },
    { id: 'tantris_fever_redux_redux_redux', name: 'TaNTЯiS Fever Redux Redux Redux', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Redux.Redux.Redux.mp3' },
    { id: 'tantris_fever_regae', name: 'TaNTЯiS Fever (Regae)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Regae.mp3' },
    { id: 'tantris_fever_regae_redux', name: 'TaNTЯiS Fever (Regae Redux)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Regae.Redux.mp3' },
    { id: 'tantris_fever_regae_redux_redux', name: 'TaNTЯiS Fever (Regae Redux Redux)', file: MUSIC_BASE_URL + 'TaNT.iS.Fever.Regae.Redux.Redux.mp3' },
    // T - TaNTЯiS other
    { id: 'tantris_on_my_hands', name: 'TaNTЯiS on My Hands', file: MUSIC_BASE_URL + 'TaNT.iS.on.My.Hands.mp3' },
    { id: 'tantris_on_my_hands_redux', name: 'TaNTЯiS on My Hands Redux', file: MUSIC_BASE_URL + 'TaNT.iS.on.My.Hands.Redux.mp3' },
    { id: 'tantrizz', name: 'TaNTЯiZZ', file: MUSIC_BASE_URL + 'TaNT.iZZ.mp3' },
    // T - Teeeerry
    { id: 'teeeerry', name: 'Teeeerry', file: MUSIC_BASE_URL + 'Teeeerry.mp3' },
    { id: 'teeeerry_redux', name: 'Teeeerry Redux', file: MUSIC_BASE_URL + 'Teeeerry.Redux.mp3' },
    { id: 'teeeerry_redux_redux', name: 'Teeeerry Redux Redux', file: MUSIC_BASE_URL + 'Teeeerry.Redux.Redux.mp3' },
    { id: 'teeeerry_redux_redux_redux', name: 'Teeeerry Redux Redux Redux', file: MUSIC_BASE_URL + 'Teeeerry.Redux.Redux.Redux.mp3' },
    // T - Other
    { id: 'tetrominoes_pentominoes', name: 'Tetrominoes & Pentominoes', file: MUSIC_BASE_URL + 'Tetrominoes.Pentominoes.mp3' },
    { id: 'the_call_of_tantris', name: 'The Call of TaNTЯiS', file: MUSIC_BASE_URL + 'The.Call.of.TaNT.iS.mp3' },
    { id: 'the_far_side_of_the_moooon', name: 'The Far Side (of the Moooon)', file: MUSIC_BASE_URL + 'The.Far.Side.of.the.Moooon.mp3' },
    { id: 'the_long_game', name: 'The Long Game', file: MUSIC_BASE_URL + 'The.Long.Game.mp3' },
    { id: 'the_longer_game', name: 'The Longer Game', file: MUSIC_BASE_URL + 'The.Longer.Game.mp3' },
    { id: 'the_pit_banjo', name: 'The Pit (Banjo Mix)', file: MUSIC_BASE_URL + 'The.Pit.Banjo.Mix.mp3' },
    { id: 'the_pit_horny', name: 'The Pit (Horny Mix)', file: MUSIC_BASE_URL + 'The.Pit.Horny.Mix.mp3' },
    { id: 'the_pit_house', name: 'The Pit (House Mix)', file: MUSIC_BASE_URL + 'The.Pit.House.Mix.mp3' },
    { id: 'the_pit_techno', name: 'The Pit (Techno Mix)', file: MUSIC_BASE_URL + 'The.Pit.Techno.Mix.mp3' },
    { id: 'three_ring_gravity', name: 'Three Ring Gravity', file: MUSIC_BASE_URL + 'Three.Ring.Gravity.mp3' },
    { id: 'trapeze_breeze', name: 'Trapeze Breeze', file: MUSIC_BASE_URL + 'Trapeze.Breeze.mp3' },
    // W
    { id: 'what_the_flock', name: 'What the Flock', file: MUSIC_BASE_URL + 'What.the.Flock.mp3' },
    { id: 'whistling_dewdrops', name: 'Whistling Dewdrops', file: MUSIC_BASE_URL + 'Whistling.Dewdrops.mp3' },
    { id: 'wind_fire', name: 'Wind & Fire', file: MUSIC_BASE_URL + 'Wind.Fire.mp3' },
    { id: 'wind_fire_soot', name: 'Wind & Fire & Soot', file: MUSIC_BASE_URL + 'Wind.Fire.Soot.mp3' },
    { id: 'wormholio', name: 'Wormholio', file: MUSIC_BASE_URL + 'Wormholio.mp3' }
];

// "Cascade into the Void" variations with lyrics - only played during end credits
const creditsSongs = [
    { id: 'cascade_void', name: 'Cascade into the Void', file: MUSIC_BASE_URL + 'Cascade.into.the.Void.mp3' },
    { id: 'cascade_void_acappella', name: 'Cascade into the Void (A Capella)', file: MUSIC_BASE_URL + 'Cascade.into.the.Void.A.Capella.mp3' },
    { id: 'cascade_void_bork', name: 'Cascade into the Void (Bork Bork Bork)', file: MUSIC_BASE_URL + 'Cascade.into.the.Void.Bork.Bork.Bork.mp3' },
    { id: 'cascade_void_dance', name: 'Cascade into the Void (Dance)', file: MUSIC_BASE_URL + 'Cascade.into.the.Void.Dance.mp3' },
    { id: 'cascade_void_eurobeat', name: 'Cascade into the Void (Eurobeat)', file: MUSIC_BASE_URL + 'Cascade.into.the.Void.Eurobeat.mp3' },
    { id: 'cascade_void_folk', name: 'Cascade into the Void (Folk)', file: MUSIC_BASE_URL + 'Cascade.into.the.Void.Folk.mp3' },
    { id: 'cascade_void_intense', name: 'Cascade into the Void (Intense)', file: MUSIC_BASE_URL + 'Cascade.into.the.Void.Intense.mp3' },
    { id: 'cascade_void_maxheadroom', name: 'Cascade into the Void (Max Headroom)', file: MUSIC_BASE_URL + 'Cascade.into.the.Void.Max.Headroom.mp3' }
];

// Intro music only (not in any shuffle)
const menuOnlySongs = [
    { id: 'cascade_void_intro', name: 'TaNTЯiS (Intro)', file: MUSIC_BASE_URL + 'TaNT.iS.mp3' }
];

// F Word songs - special easter egg songs delivered by UFO at 42 lines
const GITHUB_FWORD_URL = AppConfig.GITHUB_RELEASES + '/Music-F-Word/';
const PROXY_FWORD_URL = AppConfig.GAME_API + '/music/Music-F-Word/';
const F_WORD_BASE_URL = _isIOSAudio ? PROXY_FWORD_URL : GITHUB_FWORD_URL;
const fWordSongs = [];
for (let i = 1; i <= 20; i++) {
    fWordSongs.push({
        id: `f_word_${i}`,
        name: `F Word (${i})`,
        file: F_WORD_BASE_URL + `F.Word.${i}.mp3`
    });
}

// Override for next song (used by UFO easter egg)
let nextSongOverride = null;

// All songs combined for audio element initialization
const allSongs = [...gameplaySongs, ...creditsSongs, ...menuOnlySongs, ...fWordSongs];

let gameplayMusicElements = {};
let currentPlayingTrack = null;

// Persistent shuffle queues - saved to localStorage, persist across sessions
let gameplayShuffleQueue = [];
let creditsShuffleQueue = [];
let fWordShuffleQueue = [];
let lastPlayedGameplaySong = null;
let lastPlayedCreditsSong = null;

// localStorage keys for queue persistence
const GAMEPLAY_QUEUE_KEY = 'tantris_gameplayQueue';
const FWORD_QUEUE_KEY = 'tantris_fwordQueue';
const PURGED_SONGS_KEY = 'tantris_purgedSongs';

// Replay mode - play specific tracks in order instead of shuffle
let replayModeActive = false;
let replayTrackList = [];       // Array of {trackId, trackName} from recording
let replayTrackIndex = 0;       // Current position in replay track list

// Track recently played song families (base names before parentheses)
// This prevents variants of the same song from playing too close together
let recentlyPlayedFamilies = []; // Stores last 4 song families
const MIN_FAMILY_SEPARATION = 4; // At least 4 other songs between same-family songs

// Track song history for skip backwards functionality
let songHistory = []; // Songs played in order (most recent at end)
let forwardHistory = []; // Songs to return to when skipping forward after going back
const MAX_SONG_HISTORY = 20;

// Callback for when song changes (so game.js can update display)
let onSongChangeCallback = null;

// Callback for when pause state changes (so game.js can update button)
let onPauseStateChangeCallback = null;

function setOnSongChangeCallback(callback) {
    onSongChangeCallback = callback;
}

function setOnPauseStateChangeCallback(callback) {
    onPauseStateChangeCallback = callback;
}

// Notify listeners that pause state changed
function notifyPauseStateChange() {
    if (onPauseStateChangeCallback) {
        onPauseStateChangeCallback(musicPaused);
    }
}

// Notify listeners that song changed
function notifySongChange() {
    if (onSongChangeCallback) {
        onSongChangeCallback(getCurrentSongInfo());
    }
    // Update media session metadata for lock screens and media controls
    updateMediaSessionMetadata();
    updateMediaSessionState();
    
    // Record music track change for replay
    if (window.GameRecorder && window.GameRecorder.isActive()) {
        const songInfo = getCurrentSongInfo();
        if (songInfo) {
            window.GameRecorder.recordMusicTrack(songInfo.id, songInfo.name);
        }
    }
}

// Get current song information
function getCurrentSongInfo() {
    if (!currentPlayingTrack) {
        return null;
    }
    
    const song = allSongs.find(s => s.id === currentPlayingTrack);
    const audio = gameplayMusicElements[currentPlayingTrack];
    
    if (!song || !audio) {
        return null;
    }
    
    // Strip the parenthesized number from F Word songs for display
    // "F Word (3)" -> "F Word"
    let displayName = song.name;
    if (currentPlayingTrack.startsWith('f_word_')) {
        displayName = 'F Word';
    }
    
    return {
        id: currentPlayingTrack,
        name: displayName,
        duration: audio.duration || 0,
        currentTime: audio.currentTime || 0,
        file: song.file
    };
}

// Skip to next song (only works in shuffle mode)
// Insert the next F Word song from the shuffle queue (UFO easter egg)
function insertFWordSong() {
    // Get next song from F Word queue (refills when empty)
    if (fWordShuffleQueue.length === 0) {
        fWordShuffleQueue = shuffleArray(fWordSongs.map(s => s.id));
        Logger.debug('🛸 Refilled F Word queue:', fWordShuffleQueue.length, 'songs');
    }
    
    const songId = fWordShuffleQueue.pop();
    const selectedSong = fWordSongs.find(s => s.id === songId);
    
    // Save updated queue to storage
    saveQueuesToStorage();
    
    nextSongOverride = selectedSong;
    Logger.debug('🛸 F Word song queued:', selectedSong.name, '| Queue remaining:', fWordShuffleQueue.length);
    return selectedSong;
}

// Insert a specific F Word song by ID (for replay - doesn't affect queue)
function insertFWordSongById(songId) {
    const selectedSong = fWordSongs.find(s => s.id === songId);
    if (selectedSong) {
        nextSongOverride = selectedSong;
        Logger.debug('🛸 F Word song queued (replay):', selectedSong.name);
        return selectedSong;
    }
    // Fallback to queue if not found
    return insertFWordSong();
}

function skipToNextSong() {
    if (!musicPlaying || currentMusicSelection !== 'shuffle') {
        Logger.info('🎵 Skip next: Not in shuffle mode or not playing');
        return false;
    }

    // Stop current track
    if (currentPlayingTrack && gameplayMusicElements[currentPlayingTrack]) {
        const audio = gameplayMusicElements[currentPlayingTrack];
        audio.pause();
        audio.currentTime = 0;
    }
    
    // Add current song to history before switching
    if (currentPlayingTrack) {
        songHistory.push(currentPlayingTrack);
        if (songHistory.length > MAX_SONG_HISTORY) {
            songHistory.shift();
        }
    }
    
    // Check if we have songs in forward history (user went back, now going forward)
    if (forwardHistory.length > 0) {
        const nextSongId = forwardHistory.pop();
        let audio = gameplayMusicElements[nextSongId];
        const song = allSongs.find(s => s.id === nextSongId);
        
        if (!audio && song) {
            audio = new Audio();
            audio.volume = musicMuted ? 0 : musicVolume;
            audio.addEventListener('ended', onSongEnded);
            gameplayMusicElements[nextSongId] = audio;
        }
        
        if (audio && song) {
            musicPlaying = true;
            currentPlayingTrack = nextSongId;
            audio.loop = false;
            audio.src = song.file;
            audio.currentTime = 0;
            audio.play().catch(e => Logger.debug('Music autoplay prevented:', e));
            Logger.info('🎵 Returned forward to:', song.name);
            notifySongChange();
            return true;
        }
    }
    
    // Clear forward history when proceeding to new songs
    forwardHistory = [];
    
    musicPlaying = false;
    currentPlayingTrack = null;
    
    // Start next track
    if (currentMusicSelectElement) {
        startMusic(null, currentMusicSelectElement);
    }
    
    Logger.info('🎵 Skipped to next song');
    return true;
}

// Skip to previous song (only works in shuffle mode)
function skipToPreviousSong() {
    if (!musicPlaying || currentMusicSelection !== 'shuffle') {
        Logger.info('🎵 Skip prev: Not in shuffle mode or not playing');
        return false;
    }
    
    if (songHistory.length === 0) {
        Logger.info('🎵 Skip prev: No song history');
        return false;
    }
    
    // Stop current track and save to forward history
    if (currentPlayingTrack && gameplayMusicElements[currentPlayingTrack]) {
        const audio = gameplayMusicElements[currentPlayingTrack];
        audio.pause();
        audio.currentTime = 0;
        
        // Save current song to forward history so we can return to it
        forwardHistory.push(currentPlayingTrack);
    }
    
    // Get previous song from history
    const prevSongId = songHistory.pop();
    
    musicPlaying = false;
    currentPlayingTrack = null;
    
    // Play the previous song directly
    let audio = gameplayMusicElements[prevSongId];
    const song = allSongs.find(s => s.id === prevSongId);
    
    if (!audio && song) {
        audio = new Audio();
        audio.volume = musicMuted ? 0 : musicVolume;
        audio.addEventListener('ended', onSongEnded);
        gameplayMusicElements[prevSongId] = audio;
    }
    
    if (audio && song) {
        musicPlaying = true;
        currentPlayingTrack = prevSongId;
        audio.loop = false;
        audio.src = song.file;
        audio.currentTime = 0;
        audio.play().catch(e => Logger.debug('Music autoplay prevented:', e));
        Logger.info('🎵 Skipped back to:', song.name);
        notifySongChange();
    }
    
    return true;
}

// Check if there's a previous song in history
function hasPreviousSong() {
    return songHistory.length > 0 && currentMusicSelection === 'shuffle' && musicPlaying;
}

// Track if music is paused (vs stopped)
let musicPaused = false;

// Pause current music (gameplay or menu)
function pauseCurrentMusic() {
    if (musicPaused) return;
    
    // Pause gameplay music if playing
    if (currentPlayingTrack && gameplayMusicElements[currentPlayingTrack]) {
        const audio = gameplayMusicElements[currentPlayingTrack];
        audio.pause();
        musicPaused = true;
        updateMediaSessionState();
        notifyPauseStateChange();
        Logger.debug('🎵 Music paused');
        return true;
    }
    
    // Pause menu music if playing
    if (menuMusicElement && menuMusicPlaying) {
        menuMusicElement.pause();
        musicPaused = true;
        updateMediaSessionState();
        notifyPauseStateChange();
        Logger.debug('🎵 Menu music paused');
        return true;
    }
    
    return false;
}

// Resume paused music
function resumeCurrentMusic() {
    if (!musicPaused) return;
    
    // Resume gameplay music if it was playing
    if (currentPlayingTrack && gameplayMusicElements[currentPlayingTrack]) {
        const audio = gameplayMusicElements[currentPlayingTrack];
        audio.play().catch(e => Logger.debug('Music resume prevented:', e));
        musicPaused = false;
        updateMediaSessionState();
        notifyPauseStateChange();
        Logger.debug('🎵 Music resumed');
        return true;
    }
    
    // Resume menu music if it was playing
    if (menuMusicElement && menuMusicPlaying) {
        menuMusicElement.play().catch(e => Logger.debug('Menu music resume prevented:', e));
        musicPaused = false;
        updateMediaSessionState();
        notifyPauseStateChange();
        Logger.debug('🎵 Menu music resumed');
        return true;
    }
    
    return false;
}

// Toggle music pause state
function toggleMusicPause() {
    if (musicPaused) {
        resumeCurrentMusic();
        return false; // Now playing
    } else {
        pauseCurrentMusic();
        return true; // Now paused
    }
}

// Check if music is currently paused
function isMusicPaused() {
    return musicPaused;
}

// Media Session API for hardware media controls (earbuds, keyboards, etc.)
function setupMediaSession() {
    if (!('mediaSession' in navigator)) {
        Logger.info('🎵 Media Session API not supported');
        return;
    }
    
    // Set up action handlers for media controls
    navigator.mediaSession.setActionHandler('play', () => {
        if (musicPaused) {
            resumeCurrentMusic();
            updateMediaSessionState();
        }
    });
    
    navigator.mediaSession.setActionHandler('pause', () => {
        if (!musicPaused) {
            pauseCurrentMusic();
            updateMediaSessionState();
        }
    });
    
    // Some devices send 'playpause' toggle instead of separate play/pause
    try {
        navigator.mediaSession.setActionHandler('playpause', () => {
            toggleMusicPause();
            updateMediaSessionState();
        });
    } catch (e) {
        // playpause not supported on all browsers
    }
    
    // Skip controls
    try {
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            skipToNextSong();
        });
    } catch (e) {
        // nexttrack not supported
    }
    
    try {
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            skipToPreviousSong();
        });
    } catch (e) {
        // previoustrack not supported
    }
    
    // Handle seek requests from iOS Control Center / lock screen
    try {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            const audio = currentPlayingTrack && gameplayMusicElements[currentPlayingTrack];
            const menuAudio = menuMusicElement;
            const target = audio || menuAudio;
            if (target && details.seekTime != null) {
                target.currentTime = details.seekTime;
            }
        });
    } catch (e) {
        // seekto not supported
    }
    
    Logger.info('🎵 Media Session API initialized - earbud/media key controls enabled');
}

// Update Media Session metadata with current song info
function updateMediaSessionMetadata() {
    if (!('mediaSession' in navigator)) return;
    
    const songInfo = getCurrentSongInfo();
    if (songInfo) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: songInfo.name,
            artist: 'TaNTЯiS',
            album: 'Game Soundtrack'
        });
    }
}

// Update Media Session playback state
function updateMediaSessionState() {
    if (!('mediaSession' in navigator)) return;
    
    if (musicPaused) {
        navigator.mediaSession.playbackState = 'paused';
    } else if (musicPlaying || menuMusicPlaying) {
        navigator.mediaSession.playbackState = 'playing';
    } else {
        navigator.mediaSession.playbackState = 'none';
    }
}

// Initialize Media Session on load
setupMediaSession();

// Extract the "family" (base name) of a song - the part before any parentheses
// e.g., "The Pit (Techno Mix)" -> "The Pit"
// e.g., "Cascade into the Void (Nervous Mix)" -> "Cascade into the Void"
// e.g., "Falling Blocks Reactor" -> "Falling Blocks Reactor"
function getSongFamily(songName) {
    const parenIndex = songName.indexOf('(');
    if (parenIndex > 0) {
        return songName.substring(0, parenIndex).trim();
    }
    return songName;
}

// Get the song name from an id
function getSongNameById(songId, songList) {
    const song = songList.find(s => s.id === songId);
    return song ? song.name : songId;
}

// Fisher-Yates shuffle helper
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Initialize shuffle queues at load time - load from localStorage or create new
function initShuffleQueues() {
    // Try to load gameplay queue from localStorage
    const savedGameplayQueue = localStorage.getItem(GAMEPLAY_QUEUE_KEY);
    if (savedGameplayQueue) {
        try {
            gameplayShuffleQueue = JSON.parse(savedGameplayQueue);
            // Validate that saved IDs are still valid songs
            gameplayShuffleQueue = gameplayShuffleQueue.filter(id => 
                gameplaySongs.some(s => s.id === id)
            );
            Logger.debug('🎵 Loaded gameplay queue from storage:', gameplayShuffleQueue.length, 'songs remaining');
        } catch (e) {
            Logger.warn('🎵 Failed to parse saved gameplay queue, creating new');
            gameplayShuffleQueue = shuffleArray(gameplaySongs.map(s => s.id));
        }
    } else {
        gameplayShuffleQueue = shuffleArray(gameplaySongs.map(s => s.id));
        // First-ever player: put Meet Cute last (queue pops from end, so last = first played)
        const mcIdx = gameplayShuffleQueue.indexOf('meet_cute');
        if (mcIdx >= 0 && mcIdx < gameplayShuffleQueue.length - 1) {
            gameplayShuffleQueue.splice(mcIdx, 1);
            gameplayShuffleQueue.push('meet_cute');
        }
        Logger.debug('🎵 Created new gameplay shuffle queue (first time - Meet Cute first)');
    }
    
    // Try to load F Word queue from localStorage
    const savedFWordQueue = localStorage.getItem(FWORD_QUEUE_KEY);
    if (savedFWordQueue) {
        try {
            fWordShuffleQueue = JSON.parse(savedFWordQueue);
            // Validate that saved IDs are still valid songs
            fWordShuffleQueue = fWordShuffleQueue.filter(id => 
                fWordSongs.some(s => s.id === id)
            );
            Logger.debug('🛸 Loaded F Word queue from storage:', fWordShuffleQueue.length, 'songs remaining');
        } catch (e) {
            Logger.warn('🛸 Failed to parse saved F Word queue, creating new');
            fWordShuffleQueue = shuffleArray(fWordSongs.map(s => s.id));
        }
    } else {
        fWordShuffleQueue = shuffleArray(fWordSongs.map(s => s.id));
        Logger.debug('🛸 Created new F Word shuffle queue');
    }
    
    // Credits queue doesn't need persistence (only used during end credits)
    creditsShuffleQueue = shuffleArray(creditsSongs.map(s => s.id));
    
    // Save initial queues
    saveQueuesToStorage();
    
    Logger.debug('🎵 Gameplay queue:', gameplayShuffleQueue.length, 'songs');
    Logger.debug('🛸 F Word queue:', fWordShuffleQueue.length, 'songs');
}

// Save queues to localStorage
function saveQueuesToStorage() {
    try {
        localStorage.setItem(GAMEPLAY_QUEUE_KEY, JSON.stringify(gameplayShuffleQueue));
        localStorage.setItem(FWORD_QUEUE_KEY, JSON.stringify(fWordShuffleQueue));
    } catch (e) {
        Logger.warn('🎵 Failed to save queues to storage:', e);
    }
}

// ============================================
// SONG PURGE SYSTEM
// ============================================
// Purged songs are stored as {songId: expirationTimestamp} where null = indefinite

// Load purged songs from localStorage
function loadPurgedSongs() {
    try {
        const saved = localStorage.getItem(PURGED_SONGS_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        Logger.warn('🎵 Failed to load purged songs:', e);
    }
    return {};
}

// Save purged songs to localStorage
function savePurgedSongs(purgedSongs) {
    try {
        localStorage.setItem(PURGED_SONGS_KEY, JSON.stringify(purgedSongs));
    } catch (e) {
        Logger.warn('🎵 Failed to save purged songs:', e);
    }
}

// Check if a song is currently purged
function isSongPurged(songId) {
    const purgedSongs = loadPurgedSongs();
    if (!purgedSongs[songId]) return false;
    
    const expiration = purgedSongs[songId];
    // null means indefinite purge
    if (expiration === null) return true;
    
    // Check if expired
    if (Date.now() > expiration) {
        // Expired - remove from purge list
        delete purgedSongs[songId];
        savePurgedSongs(purgedSongs);
        Logger.debug('🎵 Purge expired for:', songId);
        return false;
    }
    
    return true;
}

// Purge a song with optional duration
// duration: milliseconds, or null for indefinite
function purgeSong(songId, duration) {
    const purgedSongs = loadPurgedSongs();
    const expiration = duration ? Date.now() + duration : null;
    purgedSongs[songId] = expiration;
    savePurgedSongs(purgedSongs);
    
    // Also remove from the current queue so it won't play next
    const index = gameplayShuffleQueue.indexOf(songId);
    if (index > -1) {
        gameplayShuffleQueue.splice(index, 1);
        saveQueuesToStorage();
    }
    
    const song = allSongs.find(s => s.id === songId);
    const songName = song ? song.name : songId;
    if (duration === null) {
        Logger.debug('🚫 Purged indefinitely:', songName);
    } else {
        const days = Math.round(duration / (24 * 60 * 60 * 1000));
        Logger.debug(`🚫 Purged for ${days} days:`, songName);
    }
}

// Get all currently purged songs (with expiration info)
function getPurgedSongs() {
    const purgedSongs = loadPurgedSongs();
    const result = [];
    const now = Date.now();
    let changed = false;
    
    for (const [songId, expiration] of Object.entries(purgedSongs)) {
        // Skip expired purges
        if (expiration !== null && now > expiration) {
            delete purgedSongs[songId];
            changed = true;
            continue;
        }
        
        const song = allSongs.find(s => s.id === songId);
        result.push({
            songId,
            songName: song ? song.name : songId,
            expiration,
            isIndefinite: expiration === null
        });
    }
    
    if (changed) {
        savePurgedSongs(purgedSongs);
    }
    
    return result;
}

// Clear all purged songs
function clearAllPurgedSongs() {
    savePurgedSongs({});
    Logger.debug('🎵 Cleared all purged songs');
}

// Skip to next song with purge support
// purgeType: 'none', 'short' (1 week), 'long' (3 days), 'indefinite'
function skipToNextSongWithPurge(purgeType = 'none') {
    if (!musicPlaying || currentMusicSelection !== 'shuffle') {
        Logger.info('🎵 Skip next: Not in shuffle mode or not playing');
        return { skipped: false };
    }
    
    const skippedSongId = currentPlayingTrack;
    const skippedSong = skippedSongId ? allSongs.find(s => s.id === skippedSongId) : null;
    let purgeInfo = null;
    
    // Handle purge based on type
    if (skippedSongId && purgeType !== 'none') {
        const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
        const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
        
        switch (purgeType) {
            case 'short':
                // Skipped before 30 seconds - purge for 1 week
                purgeSong(skippedSongId, ONE_WEEK);
                purgeInfo = { duration: 'week', songName: skippedSong?.name };
                break;
            case 'long':
                // Skipped after 30 seconds - purge for 3 days
                purgeSong(skippedSongId, THREE_DAYS);
                purgeInfo = { duration: '3days', songName: skippedSong?.name };
                break;
            case 'indefinite':
                // Hold skip - purge indefinitely
                purgeSong(skippedSongId, null);
                purgeInfo = { duration: 'indefinite', songName: skippedSong?.name };
                break;
        }
    }
    
    // Now do the regular skip
    skipToNextSong();
    
    return { skipped: true, purgeInfo };
}

// Reset shuffle queue (for replay consistency)
function resetShuffleQueue() {
    gameplayShuffleQueue = shuffleArray(gameplaySongs.map(s => s.id));
    lastPlayedGameplaySong = null;
    saveQueuesToStorage();
    Logger.debug('🎵 Reset gameplay shuffle queue for replay');
}

// Set replay mode with specific track list from recording
function setReplayTracks(trackList) {
    replayModeActive = true;
    replayTrackList = trackList || [];
    replayTrackIndex = 0;
    nextSongOverride = null; // Clear any leftover queued F Word song
    Logger.debug('🎵 Replay mode enabled with', replayTrackList.length, 'tracks:', replayTrackList.map(t => t.trackName || t.trackId));
}

// Clear replay mode (return to normal shuffle)
function clearReplayTracks() {
    replayModeActive = false;
    replayTrackList = [];
    replayTrackIndex = 0;
    nextSongOverride = null; // Clear any queued F Word song
    Logger.debug('🎵 Replay mode disabled, returning to shuffle');
}

// Get next track from replay list (returns null if exhausted)
function getNextReplayTrack() {
    if (!replayModeActive || replayTrackIndex >= replayTrackList.length) {
        return null;
    }
    const track = replayTrackList[replayTrackIndex];
    replayTrackIndex++;
    Logger.debug('🎵 Replay track', replayTrackIndex, 'of', replayTrackList.length, ':', track.trackName || track.trackId);
    return track.trackId;
}

// Get next song from a shuffle queue (refills when empty, prevents immediate repeats and family clustering)
// Also filters out purged songs
function getNextFromQueue(queue, songList, queueName, lastPlayedRef) {
    // First, filter out any purged songs from the queue (for gameplay queue only)
    if (queueName === 'gameplay') {
        const beforeLength = queue.length;
        for (let i = queue.length - 1; i >= 0; i--) {
            if (isSongPurged(queue[i])) {
                queue.splice(i, 1);
            }
        }
        if (queue.length < beforeLength) {
            Logger.debug(`🎵 Filtered ${beforeLength - queue.length} purged songs from queue`);
            saveQueuesToStorage();
        }
    }
    
    if (queue.length === 0) {
        // Refill and reshuffle, excluding purged songs
        let newQueue = shuffleArray(songList.map(s => s.id));
        
        // Filter out purged songs when refilling (gameplay only)
        if (queueName === 'gameplay') {
            newQueue = newQueue.filter(id => !isSongPurged(id));
            if (newQueue.length === 0) {
                // All songs are purged! Clear purges and try again
                Logger.warn('🎵 All songs purged! Clearing purge list.');
                clearAllPurgedSongs();
                newQueue = shuffleArray(songList.map(s => s.id));
            }
        }
        
        // If the last played song is at the end of the new queue (will be popped first),
        // move it somewhere else to prevent immediate repeat
        const lastPlayed = queueName === 'gameplay' ? lastPlayedGameplaySong : lastPlayedCreditsSong;
        if (lastPlayed && newQueue.length > 1 && newQueue[newQueue.length - 1] === lastPlayed) {
            // Swap it with a random position that's not the last
            const swapIndex = Math.floor(Math.random() * (newQueue.length - 1));
            [newQueue[swapIndex], newQueue[newQueue.length - 1]] = [newQueue[newQueue.length - 1], newQueue[swapIndex]];
            Logger.debug(`🎵 Moved ${lastPlayed} away from top of queue to prevent repeat`);
        }
        
        queue.push(...newQueue);
        Logger.debug(`🎵 Refilled ${queueName} queue:`, [...queue]);
    }
    
    // Find a song that doesn't have a recently played family
    let selectedIndex = queue.length - 1; // Default to top of queue (will be popped)
    const candidateSongId = queue[selectedIndex];
    const candidateName = getSongNameById(candidateSongId, songList);
    const candidateFamily = getSongFamily(candidateName);
    
    // Check if this song's family was recently played
    if (recentlyPlayedFamilies.includes(candidateFamily)) {
        Logger.debug(`🎵 "${candidateName}" family "${candidateFamily}" was recently played, looking for alternative...`);
        
        // Search through queue for a song with a different family
        let foundAlternative = false;
        for (let i = queue.length - 2; i >= 0; i--) {
            const altSongId = queue[i];
            const altName = getSongNameById(altSongId, songList);
            const altFamily = getSongFamily(altName);
            
            if (!recentlyPlayedFamilies.includes(altFamily)) {
                // Found an alternative! Swap it to the top
                [queue[i], queue[selectedIndex]] = [queue[selectedIndex], queue[i]];
                Logger.debug(`🎵 Swapped to "${altName}" (family: "${altFamily}") to maintain separation`);
                foundAlternative = true;
                break;
            }
        }
        
        if (!foundAlternative) {
            Logger.debug(`🎵 No alternative found, playing "${candidateName}" anyway`);
        }
    }
    
    const song = queue.pop();
    const songName = getSongNameById(song, songList);
    const songFamily = getSongFamily(songName);
    
    // Track the family of what we just played
    recentlyPlayedFamilies.push(songFamily);
    // Keep only the last MIN_FAMILY_SEPARATION families
    if (recentlyPlayedFamilies.length > MIN_FAMILY_SEPARATION) {
        recentlyPlayedFamilies.shift();
    }
    Logger.debug(`🎵 Recently played families:`, [...recentlyPlayedFamilies]);
    
    // Track what we just played
    if (queueName === 'gameplay') {
        lastPlayedGameplaySong = song;
        // Save queue state to localStorage
        saveQueuesToStorage();
    } else {
        lastPlayedCreditsSong = song;
    }
    
    return song;
}

// Call init on load (function defined below in startMusic section)
initGameplayMusic();
initShuffleQueues();

// Get list of songs for UI (gameplay songs only, not credits variations)
function getSongList() {
    return gameplaySongs.map(s => ({ id: s.id, name: s.name }));
}

// Get all song lists for populating dropdowns
function getAllSongLists() {
    return {
        gameplay: gameplaySongs.map(s => ({ id: s.id, name: s.name })),
        credits: creditsSongs.map(s => ({ id: s.id, name: s.name })),
        menu: menuOnlySongs.map(s => ({ id: s.id, name: s.name }))
    };
}

// Mark that a game has been played (call from game.js on game over)
function setHasPlayedGame(value) {
    hasPlayedGame = value;
}

function setGameInProgress(value) {
    gameInProgress = value;
    // Reset the menu song tracking when a game starts
    if (value) {
        fullSongPlayedOnMenu = false;
    }
}

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

// Track current music selection for shuffle mode song-end handling
let currentMusicSelection = 'shuffle';
let currentMusicSelectElement = null;

// Main music controller - now uses MP3 tracks based on dropdown selection
function startMusic(gameMode, musicSelect) {
    _dbg('startMusic called, musicPlaying=' + musicPlaying + ', interacted=' + userHasInteracted);
    if (musicPlaying) { _dbg('startMusic: already playing, returning'); return; }
    if (!userHasInteracted) { _dbg('startMusic: no user interaction yet, blocking'); return; }
    
    // Set flag immediately to prevent race conditions with double-calls
    musicPlaying = true;
    
    // Store reference to select element for song-end handling
    currentMusicSelectElement = musicSelect;
    
    // Get the selected value from dropdown
    const selection = musicSelect.value || 'shuffle';
    currentMusicSelection = selection;
    
    // If "none" selected, don't play music
    if (selection === 'none') {
        musicPlaying = false;
        return;
    }
    
    let trackId;
    let song;
    
    // Check for UFO-delivered song override (works in both normal and replay mode)
    if (nextSongOverride) {
        trackId = nextSongOverride.id;
        song = nextSongOverride;
        nextSongOverride = null; // Clear after use
        Logger.debug('🛸 Playing UFO-delivered song:', song.name);
    } else if (replayModeActive && selection === 'shuffle') {
        // Replay mode: use tracks from recording in order
        trackId = getNextReplayTrack();
        if (trackId) {
            song = allSongs.find(s => s.id === trackId);
            if (!song) {
                Logger.warn('🎵 Replay track not found:', trackId, '- falling back to shuffle');
                trackId = getNextFromQueue(gameplayShuffleQueue, gameplaySongs, 'gameplay');
                song = allSongs.find(s => s.id === trackId);
            }
        } else {
            // Replay tracks exhausted, fall back to shuffle
            Logger.debug('🎵 Replay tracks exhausted, continuing with shuffle');
            trackId = getNextFromQueue(gameplayShuffleQueue, gameplaySongs, 'gameplay');
            song = allSongs.find(s => s.id === trackId);
        }
    } else if (selection === 'shuffle') {
        // Shuffle mode: use persistent queue (no repeats until all played)
        trackId = getNextFromQueue(gameplayShuffleQueue, gameplaySongs, 'gameplay');
        song = allSongs.find(s => s.id === trackId);
        Logger.debug('🎵 Playing from shuffle:', trackId, '| Queue remaining:', gameplayShuffleQueue.length, '| Queue:', [...gameplayShuffleQueue]);
    } else {
        // Use the specifically selected track
        trackId = selection;
        song = allSongs.find(s => s.id === trackId);
    }
    
    // Create audio element on-demand
    let audio = gameplayMusicElements[trackId];
    let isNewElement = false;
    if (!audio && song) {
        audio = new Audio();
        audio.volume = musicMuted ? 0 : musicVolume;
        isNewElement = true;
    }
    
    if (audio && song) {
        // Add previous song to history before switching
        if (currentPlayingTrack && currentPlayingTrack !== trackId) {
            songHistory.push(currentPlayingTrack);
            if (songHistory.length > MAX_SONG_HISTORY) {
                songHistory.shift();
            }
        }
        
        currentPlayingTrack = trackId;
        
        // In shuffle mode, don't loop - play next song when this one ends
        audio.loop = (selection !== 'shuffle');
        
        // Set up ended listener for new elements
        if (!gameplayMusicElements[trackId]) {
            audio.addEventListener('ended', onSongEnded);
        }
        
        // Store reference for control functions
        if (!gameplayMusicElements[trackId]) {
            gameplayMusicElements[trackId] = audio;
        }
        
        _dbg('startMusic: src=' + song.file.substring(song.file.lastIndexOf('/') + 1) + ', ctx=' + audioContext.state);
        audio.src = song.file;
        audio.currentTime = 0;
        const p = audio.play();
        if (p && p.then) {
            p.then(() => _dbg('startMusic: play() OK')).catch(e => {
                _dbg('startMusic: play() REJECTED: ' + e.name + ': ' + e.message);
            });
        }
        
        // Notify listeners of song change
        notifySongChange();
    } else {
        // Failed to find audio/song, reset flag
        musicPlaying = false;
    }
}

// Handle song ending in shuffle mode - play next song
function onSongEnded(event) {
    const audio = event.target;
    
    // Only handle if we're still playing music and in shuffle mode
    if (!musicPlaying || currentMusicSelection !== 'shuffle') return;
    
    Logger.debug('🎵 Song ended in shuffle mode, playing next track');
    
    // Check if we should insert an F Word song (main menu only, not during game or credits)
    if (!gameInProgress && !hasPlayedGame) {
        if (fullSongPlayedOnMenu) {
            // A full song has already played on the menu - 1/4 chance of F Word
            if (Math.random() < 0.25) {
                Logger.debug('🎲 F Word song chance triggered on main menu!');
                insertFWordSong();
            }
        } else {
            // Mark that a full song has now completed on the menu
            fullSongPlayedOnMenu = true;
            Logger.debug('🎵 First full song completed on main menu');
        }
    }
    
    // Add current song to history before switching
    if (currentPlayingTrack) {
        songHistory.push(currentPlayingTrack);
        if (songHistory.length > MAX_SONG_HISTORY) {
            songHistory.shift();
        }
    }
    
    // Clear forward history since we're progressing naturally
    forwardHistory = [];
    
    // Stop current track state
    musicPlaying = false;
    currentPlayingTrack = null;
    
    // Start next track
    if (currentMusicSelectElement) {
        startMusic(null, currentMusicSelectElement);
    }
}

// Initialize gameplay music - lazy mode.
// Audio elements are created on-demand in startMusic() when a track plays.
// Pre-creating 138 Audio elements overwhelms iPad Safari.
function initGameplayMusic() {
    Logger.info('🎵 Gameplay music initialized (lazy-load, ' + allSongs.length + ' tracks available)');
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
    _dbg('stopMusic called, musicPlaying=' + musicPlaying);
    if (!musicPlaying) return;
    musicPlaying = false;
    
    // Reset shuffle mode state
    currentMusicSelection = 'none';
    
    // Clear any queued F Word song override
    nextSongOverride = null;
    
    // Stop MP3 playback
    if (currentPlayingTrack && gameplayMusicElements[currentPlayingTrack]) {
        const audio = gameplayMusicElements[currentPlayingTrack];
        audio.pause();
        audio.currentTime = 0;
    }
    currentPlayingTrack = null;
    
    // Notify listeners that music stopped
    notifySongChange();
    
    // Legacy synth cleanup (keep for backwards compatibility)
    if (kickScheduler) {
        clearInterval(kickScheduler);
        kickScheduler = null;
    }
    
    if (bassOscillator) {
        try {
            bassOscillator.bass.stop();
            bassOscillator.lfo.stop();
        } catch(e) {}
        bassOscillator = null;
    }
}

// Atmospheric menu music - Stranger Things inspired synth theme
let currentMenuMusicSelect = null; // Store reference for credits song-end handling

function startMenuMusic(musicToggleOrSelect) {
    _dbg('startMenuMusic called, menuMusicPlaying=' + menuMusicPlaying + ', hasPlayedGame=' + hasPlayedGame);
    if (menuMusicPlaying) { _dbg('startMenuMusic: already playing, returning'); return; }
    
    // Store reference for song-end handling
    currentMenuMusicSelect = musicToggleOrSelect;
    
    // Check if music is enabled - handle both checkbox (legacy) and select element
    let musicEnabled = true;
    if (musicToggleOrSelect) {
        if (musicToggleOrSelect.type === 'checkbox') {
            musicEnabled = musicToggleOrSelect.checked;
        } else if (musicToggleOrSelect.tagName === 'SELECT') {
            musicEnabled = musicToggleOrSelect.value !== 'none';
            _dbg('startMenuMusic: select value=' + musicToggleOrSelect.value);
        }
    }
    if (!musicEnabled) { _dbg('startMenuMusic: music disabled, returning'); return; }
    
    menuMusicPlaying = true;
    
    // Choose track based on whether a game has been played
    let trackId;
    let song;
    
    if (hasPlayedGame) {
        // End credits: shuffle through all Cascade variations
        trackId = getNextFromQueue(creditsShuffleQueue, creditsSongs, 'credits');
        song = creditsSongs.find(s => s.id === trackId);
        Logger.info('🎵 Playing end credits:', trackId, '| Remaining in queue:', creditsShuffleQueue.length);
    } else {
        // Intro: play the intro song
        trackId = 'cascade_void_intro';
        song = menuOnlySongs.find(s => s.id === trackId);
    }
    _dbg('startMenuMusic: trackId=' + trackId + ', song found=' + !!song);
    
    // iPad Safari requires Audio elements to be created within user gesture handlers.
    // Pre-created elements are marked "tainted" and can never play.
    // So we always create fresh, passing URL to constructor, and play immediately.
    
    // Stop and discard any existing menu music element
    if (menuMusicElement) {
        menuMusicElement.pause();
        menuMusicElement.removeAttribute('src');
        menuMusicElement = null;
    }
    
    if (song) {
        // Stop and discard any existing menu music element
        if (menuMusicElement) {
            menuMusicElement.pause();
            menuMusicElement.removeAttribute('src');
            menuMusicElement = null;
        }
        
        _dbg('startMenuMusic: creating Audio for ' + song.file.substring(song.file.lastIndexOf('/') + 1));
        menuMusicElement = new Audio(song.file);
        menuMusicElement.volume = musicMuted ? 0 : musicVolume;
        menuMusicElement.loop = !hasPlayedGame;
        menuMusicElement.addEventListener('ended', onMenuMusicEnded);
        
        // Debug listeners
        menuMusicElement.addEventListener('playing', () => _dbg('menuMusic EVENT: playing'));
        menuMusicElement.addEventListener('pause', () => _dbg('menuMusic EVENT: pause'));
        menuMusicElement.addEventListener('error', () => _dbg('menuMusic EVENT: error code=' + (menuMusicElement.error ? menuMusicElement.error.code + ' msg=' + menuMusicElement.error.message : 'unknown')));
        menuMusicElement.addEventListener('canplay', () => _dbg('menuMusic EVENT: canplay'));
        
        _dbg('startMenuMusic: calling play()');
        const playPromise = menuMusicElement.play();
        if (playPromise && playPromise.then) {
            playPromise.then(() => {
                _dbg('startMenuMusic: play() RESOLVED OK');
            }).catch(e => {
                _dbg('startMenuMusic: play() REJECTED: ' + e.name + ': ' + e.message);
            });
        }
    } else {
        _dbg('startMenuMusic: no song found for trackId=' + trackId);
    }
}

// Handle credits music ending - play next song from credits queue
function onMenuMusicEnded() {
    // Only handle if we're playing credits music (hasPlayedGame is true)
    if (!menuMusicPlaying || !hasPlayedGame) return;
    
    Logger.debug('🎵 Credits song ended, playing next from queue');
    
    // Reset state and play next
    menuMusicPlaying = false;
    startMenuMusic(currentMenuMusicSelect);
}

function stopMenuMusic() {
    _dbg('stopMenuMusic called, menuMusicPlaying=' + menuMusicPlaying);
    if (!menuMusicPlaying) return;
    menuMusicPlaying = false;

    // Stop MP3 playback and fully clean up to prevent stale Audio elements
    if (menuMusicElement) {
        menuMusicElement.pause();
        menuMusicElement.removeEventListener('ended', onMenuMusicEnded);
        menuMusicElement.removeAttribute('src');
        menuMusicElement.load(); // Release network resources
        menuMusicElement = null;
    }
    
    // Legacy synth cleanup (keep for backwards compatibility)
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
    if (sfxMuted) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    const volume = 0.3 * sfxVolume;
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// Enhanced thunder for tsunami events
// Dramatic thunder for lightning strikes - now uses MP3
function playEnhancedThunder(soundToggle) {
    if (!soundToggle || !soundToggle.checked) return;
    
    // Use the Strike MP3 sound effect
    playMP3SoundEffect('strike', soundToggle);
}

// Wet, whooshy tsunami/wave sound - now uses MP3
function playTsunamiWhoosh(soundToggle) {
    if (!soundToggle || !soundToggle.checked) return;
    
    // Use the Tsunami MP3 sound effect
    playMP3SoundEffect('tsunami', soundToggle);
}

// Realistic thunder effect
function playThunder(soundToggle) {
    if (!soundToggle.checked) return;
    if (sfxMuted) return;
    
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
    if (sfxMuted) return;
    
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
    if (sfxMuted) return;
    
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
    if (sfxMuted) return;
    
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
    if (sfxMuted) return;
    
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
            // Line clear sound - now uses MP3
            playMP3SoundEffect('lineClear', soundToggle);
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
        case 'yesand':
            // Short "pop" sound for Yes, And... limb spawn
            playSound(600, 0.12, 'sine');
            setTimeout(() => playSound(800, 0.08, 'sine'), 30);
            setTimeout(() => playSound(500, 0.05, 'sine'), 60);
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
    if (sfxMuted) return;
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
    if (sfxMuted) return;
    
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

// ============================================
// VOLUME CONTROL FUNCTIONS
// ============================================

function setMusicVolume(volume) {
    musicVolume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('tantris_musicVolume', musicVolume.toString());
    applyMusicVolume();
}

function getMusicVolume() {
    return musicVolume;
}

function setMusicMuted(muted) {
    musicMuted = muted;
    localStorage.setItem('tantris_musicMuted', muted.toString());
    applyMusicVolume();
}

function isMusicMuted() {
    return musicMuted;
}

function toggleMusicMute() {
    setMusicMuted(!musicMuted);
    return musicMuted;
}

function applyMusicVolume() {
    const effectiveVolume = musicMuted ? 0 : musicVolume;
    
    // Apply to menu music
    if (menuMusicElement) {
        menuMusicElement.volume = effectiveVolume;
    }
    
    // Apply to all gameplay music elements
    Object.values(gameplayMusicElements).forEach(audio => {
        if (audio) {
            audio.volume = effectiveVolume;
        }
    });
}

function setSfxVolume(volume) {
    sfxVolume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('tantris_sfxVolume', sfxVolume.toString());
    applySfxVolume();
}

function getSfxVolume() {
    return sfxVolume;
}

function setSfxMuted(muted) {
    sfxMuted = muted;
    localStorage.setItem('tantris_sfxMuted', muted.toString());
}

function isSfxMuted() {
    return sfxMuted;
}

function toggleSfxMute() {
    setSfxMuted(!sfxMuted);
    return sfxMuted;
}

function applySfxVolume() {
    // Apply to preloaded sound effects
    Object.keys(soundEffectElements).forEach(id => {
        const audio = soundEffectElements[id];
        if (audio) {
            audio.volume = sfxMuted ? 0 : (soundEffectVolumes[id] || 0.7) * sfxVolume;
        }
    });
}

// Get effective SFX volume for a specific effect (used when playing)
function getEffectiveSfxVolume(effectId) {
    if (sfxMuted) return 0;
    return (soundEffectVolumes[effectId] || 0.7) * sfxVolume;
}

    // Public API
    return {
        audioContext,
        startMusic,
        stopMusic,
        startMenuMusic,
        stopMenuMusic,
        playSoundEffect,
        playMP3SoundEffect,
        playEnhancedThunder,
        playThunder,
        playVolcanoRumble,
        playEarthquakeRumble,
        playEarthquakeCrack,
        playTsunamiWhoosh,
        startTornadoWind,
        stopTornadoWind,
        playSmallExplosion,
        getSongList,
        getAllSongLists,
        setHasPlayedGame,
        setGameInProgress,
        gameplayMusicElements,
        skipToNextSong,
        skipToPreviousSong,
        hasPreviousSong,
        resetShuffleQueue,
        setReplayTracks,
        clearReplayTracks,
        pauseCurrentMusic,
        resumeCurrentMusic,
        toggleMusicPause,
        isMusicPaused,
        getCurrentSongInfo,
        setOnSongChangeCallback,
        setOnPauseStateChangeCallback,
        insertFWordSong,
        insertFWordSongById,
        playBanjoWithMusicPause,
        // Volume controls
        setMusicVolume,
        getMusicVolume,
        setMusicMuted,
        isMusicMuted,
        toggleMusicMute,
        setSfxVolume,
        getSfxVolume,
        setSfxMuted,
        isSfxMuted,
        toggleSfxMute,
        getEffectiveSfxVolume,
        // Purge controls
        skipToNextSongWithPurge,
        isSongPurged,
        getPurgedSongs,
        clearAllPurgedSongs,
        // Debug logger (temporary)
        _dbg,
        _getDbgLog,
        // User interaction gate
        markUserInteraction
    };
})(); // End IIFE
