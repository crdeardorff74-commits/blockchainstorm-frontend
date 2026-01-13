/**
 * Game Recorder Module for TaNTЯiS / BLOCKCHaiNSTORM
 * Records human gameplay for analysis
 * Similar structure to AI recording but captures human decisions
 */
console.log("📹 Game Recorder v1.0 loaded");

const GameRecorder = (() => {
    const API_URL = 'https://blockchainstorm.onrender.com/api';
    
    // Recording state
    let recording = null;
    let isRecording = false;
    let lastBoardState = null;
    let lastPiece = null;
    let framesSinceLastCapture = 0;
    const CAPTURE_INTERVAL = 30; // Capture board state every N frames
    
    /**
     * Start recording a new game
     */
    function startRecording(config) {
        recording = {
            version: '1.0',
            gameVersion: config.gameVersion || 'unknown',
            startTime: Date.now(),
            playerType: 'human',
            difficulty: config.difficulty || 'drizzle',
            skillLevel: config.skillLevel || 'tempest',
            mode: config.mode || 'normal',
            challenges: config.challenges || [],
            speedBonus: config.speedBonus || 1.0,
            
            // Game events
            moves: [],          // Every piece placement
            events: [],         // Special events (strikes, tsunamis, etc.)
            keyframes: [],      // Periodic board snapshots
            
            // Final stats (filled at end)
            finalStats: null
        };
        
        isRecording = true;
        lastBoardState = null;
        lastPiece = null;
        framesSinceLastCapture = 0;
        
        console.log('📹 Recording started');
        return true;
    }
    
    /**
     * Record a piece placement
     */
    function recordMove(piece, board, moveData = {}) {
        if (!isRecording || !recording) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        // Compress piece data
        const pieceData = {
            t: timestamp,
            type: piece.type || getPieceType(piece.shape),
            x: piece.x,
            y: piece.y,
            rot: piece.rotationIndex || 0,
            color: piece.color
        };
        
        // Add optional move metadata
        if (moveData.hardDrop) pieceData.hd = true;
        if (moveData.softDropDistance) pieceData.sd = moveData.softDropDistance;
        if (moveData.rotations) pieceData.rots = moveData.rotations;
        if (moveData.lateralMoves) pieceData.lat = moveData.lateralMoves;
        if (moveData.thinkTime) pieceData.tt = moveData.thinkTime;
        
        recording.moves.push(pieceData);
    }
    
    /**
     * Record a game event (line clear, strike, etc.)
     */
    function recordEvent(eventType, data = {}) {
        if (!isRecording || !recording) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        recording.events.push({
            t: timestamp,
            type: eventType,
            ...data
        });
    }
    
    /**
     * Capture periodic board state (call from game loop)
     */
    function captureFrame(board) {
        if (!isRecording || !recording) return;
        
        framesSinceLastCapture++;
        
        if (framesSinceLastCapture >= CAPTURE_INTERVAL) {
            framesSinceLastCapture = 0;
            
            const timestamp = Date.now() - recording.startTime;
            const compressed = compressBoard(board);
            
            // Only save if board changed significantly
            if (boardChanged(compressed, lastBoardState)) {
                recording.keyframes.push({
                    t: timestamp,
                    board: compressed
                });
                lastBoardState = compressed;
            }
        }
    }
    
    /**
     * Stop recording and finalize
     */
    function stopRecording(finalStats) {
        if (!isRecording || !recording) return null;
        
        isRecording = false;
        
        recording.finalStats = {
            score: finalStats.score || 0,
            lines: finalStats.lines || 0,
            level: finalStats.level || 1,
            strikes: finalStats.strikes || 0,
            tsunamis: finalStats.tsunamis || 0,
            blackholes: finalStats.blackholes || 0,
            volcanoes: finalStats.volcanoes || 0,
            duration: Date.now() - recording.startTime,
            totalMoves: recording.moves.length,
            endCause: finalStats.endCause || 'game_over'
        };
        
        // Add final board state
        if (finalStats.board) {
            recording.finalBoard = compressBoard(finalStats.board);
        }
        
        console.log(`📹 Recording stopped: ${recording.moves.length} moves, ${recording.events.length} events`);
        
        const result = recording;
        recording = null;
        return result;
    }
    
    /**
     * Submit recording to server
     */
    async function submitRecording(recordingData, gameData = {}) {
        if (!recordingData) {
            console.log('📹 No recording to submit');
            return null;
        }
        
        try {
            const token = localStorage.getItem('oi_token');
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const payload = {
                recording: recordingData,
                username: gameData.username || 'Anonymous',
                sessionId: gameData.sessionId || getSessionId(),
                game: gameData.game || 'blockchainstorm',
                playerType: recordingData.playerType || 'human',
                difficulty: recordingData.difficulty,
                skillLevel: recordingData.skillLevel,
                mode: recordingData.mode,
                challenges: recordingData.challenges,
                speedBonus: recordingData.speedBonus,
                score: recordingData.finalStats?.score || 0,
                lines: recordingData.finalStats?.lines || 0,
                level: recordingData.finalStats?.level || 1,
                strikes: recordingData.finalStats?.strikes || 0,
                tsunamis: recordingData.finalStats?.tsunamis || 0,
                blackholes: recordingData.finalStats?.blackholes || 0,
                volcanoes: recordingData.finalStats?.volcanoes || 0,
                durationSeconds: Math.floor((recordingData.finalStats?.duration || 0) / 1000),
                gameVersion: recordingData.gameVersion,
                endCause: recordingData.finalStats?.endCause || 'game_over'
            };
            
            const response = await fetch(`${API_URL}/recording`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`📹 Recording submitted: ID ${result.recording_id}`);
                return result;
            } else {
                const error = await response.json();
                console.error('📹 Recording submission failed:', error);
                return null;
            }
        } catch (e) {
            console.error('📹 Recording submission error:', e);
            return null;
        }
    }
    
    /**
     * Download recording as JSON file (for debugging/manual analysis)
     */
    function downloadRecording(recordingData) {
        if (!recordingData) return;
        
        const filename = `game_${recordingData.playerType}_${recordingData.difficulty}_${Date.now()}.json`;
        const blob = new Blob([JSON.stringify(recordingData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
        console.log(`📹 Recording downloaded: ${filename}`);
    }
    
    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    
    function compressBoard(board) {
        if (!board) return [];
        
        const compressed = [];
        for (let y = 0; y < board.length; y++) {
            for (let x = 0; x < board[y].length; x++) {
                if (board[y][x]) {
                    compressed.push({ x, y, c: board[y][x] });
                }
            }
        }
        return compressed;
    }
    
    function boardChanged(newBoard, oldBoard) {
        if (!oldBoard) return true;
        if (newBoard.length !== oldBoard.length) return true;
        
        // Simple comparison - could be optimized
        const newSet = new Set(newBoard.map(b => `${b.x},${b.y}`));
        const oldSet = new Set(oldBoard.map(b => `${b.x},${b.y}`));
        
        if (newSet.size !== oldSet.size) return true;
        for (const item of newSet) {
            if (!oldSet.has(item)) return true;
        }
        return false;
    }
    
    function getPieceType(shape) {
        if (!shape) return '?';
        const h = shape.length;
        const w = shape[0]?.length || 0;
        
        // Basic shape detection
        if (h === 1 && w === 4) return 'I';
        if (h === 2 && w === 2) return 'O';
        if (h === 2 && w === 3) {
            // Could be T, L, J, S, Z
            const topFilled = shape[0].filter(v => v).length;
            const botFilled = shape[1].filter(v => v).length;
            if (topFilled === 3) return 'T';
            if (botFilled === 3) return 'L';
            return 'S';
        }
        return '?';
    }
    
    function getSessionId() {
        let sessionId = sessionStorage.getItem('game_session_id');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('game_session_id', sessionId);
        }
        return sessionId;
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    
    return {
        startRecording,
        recordMove,
        recordEvent,
        captureFrame,
        stopRecording,
        submitRecording,
        downloadRecording,
        isActive: () => isRecording
    };
})();

// Make available globally
window.GameRecorder = GameRecorder;
