// Game State Management
const GameState = {
    // Board state
    board: [],
    isRandomBlock: [],
    fadingBlocks: [],
    
    // Pieces
    currentPiece: null,
    nextPiece: null,
    
    // Score and progress
    score: 0,
    lines: 0,
    level: 1,
    strikeCount: 0,
    tsunamiCount: 0,
    blackHoleCount: 0,
    
    // Game status
    gameRunning: false,
    paused: false,
    animatingLines: false,
    
    // Mode configuration
    gameMode: null,
    lastPlayedMode: null,
    hailstormEnabled: false,
    hailstormCounter: 0,
    currentColorSet: COLORS,
    
    // Timing
    dropCounter: 0,
    dropInterval: 1000,
    gameLoop: null,
    
    // Grid dimensions
    ROWS: 20,
    COLS: 10,
    BLOCK_SIZE: 35,
    
    // Visual settings
    faceOpacity: 0.42,
    
    // Developer mode
    developerMode: false,
    
    // Animation states
    lineAnimations: [],
    lightningEffects: [],
    triggeredTsunamis: new Set(),
    
    // Black hole state
    blackHoleActive: false,
    blackHoleAnimating: false,
    blackHoleCenterX: 0,
    blackHoleCenterY: 0,
    blackHoleBlocks: [],
    blackHoleStartTime: 0,
    blackHoleDuration: 2500,
    blackHoleShakeIntensity: 0,
    blackHoleInnerBlob: null,
    blackHoleOuterBlob: null,
    
    // Tsunami state
    tsunamiActive: false,
    tsunamiAnimating: false,
    tsunamiBlob: null,
    tsunamiBlocks: [],
    tsunamiPushedBlocks: [],
    tsunamiStartTime: 0,
    tsunamiDuration: 2000,
    tsunamiWobbleIntensity: 0,
    
    // Gravity state
    fallingBlocks: [],
    gravityAnimating: false,
    
    // Tornado state
    tornadoActive: false,
    tornadoY: 0,
    tornadoX: 0,
    tornadoRotation: 0,
    tornadoSpeed: 1.5,
    tornadoPickedBlob: null,
    tornadoState: 'descending',
    tornadoDropTargetX: 0,
    tornadoLiftStartY: 0,
    tornadoBlobRotation: 0,
    tornadoVerticalRotation: 0,
    tornadoOrbitStartTime: null,
    tornadoOrbitRadius: 0,
    tornadoOrbitAngle: 0,
    tornadoLiftHeight: 0,
    tornadoDropStartY: 0,
    tornadoFadeProgress: 0,
    tornadoSnakeVelocity: 0,
    tornadoSnakeDirection: 1,
    tornadoSnakeChangeCounter: 0,
    tornadoParticles: [],
    disintegrationParticles: [],
    
    // Storm particles
    stormParticles: [],
    splashParticles: [],
    MAX_STORM_PARTICLES: 800,
    
    // Histogram state
    histogramBars: {},
    histogramTargets: {},
    histogramMaxScale: 10,
    histogramDecayRate: 0.98,
    histogramPauseFrames: {},
    scoreHistogramBar: 0,
    scoreHistogramTarget: 0,
    scoreHistogramMaxScale: 1000,
    scoreHistogramPauseFrames: 0,
    
    initBoard() {
        this.board = Array(this.ROWS).fill().map(() => Array(this.COLS).fill(null));
        this.isRandomBlock = Array(this.ROWS).fill().map(() => Array(this.COLS).fill(false));
        this.fadingBlocks = Array(this.ROWS).fill().map(() => Array(this.COLS).fill(null));
    },
    
    reset() {
        this.initBoard();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.strikeCount = 0;
        this.tsunamiCount = 0;
        this.blackHoleCount = 0;
        this.lineAnimations = [];
        this.animatingLines = false;
        this.paused = false;
        this.hailstormCounter = 0;
        this.triggeredTsunamis.clear();
        this.stormParticles = [];
        this.splashParticles = [];
        
        // Reset all animation states
        this.tornadoActive = false;
        this.blackHoleActive = false;
        this.blackHoleAnimating = false;
        this.tsunamiActive = false;
        this.tsunamiAnimating = false;
        this.fallingBlocks = [];
        this.gravityAnimating = false;
        this.disintegrationParticles = [];
    }
};
// Export to global scope
window.GameState = GameState;
