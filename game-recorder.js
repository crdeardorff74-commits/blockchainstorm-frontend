/**
 * Game Recorder Module for TaNTЯiS / BLOCKCHaiNSTORM
 * Records human gameplay for analysis and playback
 * v2.0: Piece-relative timing - all events indexed by piece for perfect sync
 */
console.log("📹 Game Recorder v2.0 loaded - piece-relative timing for accurate replay");

const GameRecorder = (() => {
    const API_URL = 'https://blockchainstorm.onrender.com/api';
    
    // Recording state
    let recording = null;
    let isRecording = false;
    let currentPieceIndex = -1;
    let currentPieceSpawnTime = 0;
    
    /**
     * Start recording a new game
     */
    function startRecording(config) {
        recording = {
            version: '2.0',
            gameVersion: config.gameVersion || 'unknown',
            startTime: Date.now(),
            playerType: config.playerType || 'human',
            difficulty: config.difficulty || 'drizzle',
            skillLevel: config.skillLevel || 'tempest',
            palette: config.palette || 'classic',
            mode: config.mode || 'normal',
            challenges: config.challenges || [],
            visualSettings: config.visualSettings || {},
            
            // Piece-indexed data structure - each piece has its own events
            pieceData: [],
            
            // Global events (not piece-specific)
            musicTracks: [],
            
            // Final stats (filled at end)
            finalStats: null
        };
        
        isRecording = true;
        currentPieceIndex = -1;
        currentPieceSpawnTime = 0;
        
        console.log('📹 Recording started (v2.0 piece-relative)');
        return true;
    }
    
    /**
     * Called when a new piece spawns - creates a new piece entry
     * This MUST be called before any inputs for that piece are recorded
     */
    function recordPieceSpawn(piece, board) {
        if (!isRecording || !recording) return;
        
        currentPieceIndex++;
        currentPieceSpawnTime = Date.now();
        
        // Create new piece entry with board snapshot
        recording.pieceData.push({
            type: piece.type,
            color: piece.color,
            spawnTime: currentPieceSpawnTime - recording.startTime,
            boardSnapshot: compressBoard(board),
            inputs: [],
            randomEvents: [],
            placement: null,  // Filled when piece locks
            aiShadow: null    // For human vs AI comparison
        });
    }
    
    /**
     * Record a player input - time is relative to current piece spawn
     */
    function recordInput(inputType, data = {}) {
        if (!isRecording || !recording || currentPieceIndex < 0) return;
        
        const relativeTime = Date.now() - currentPieceSpawnTime;
        const pieceEntry = recording.pieceData[currentPieceIndex];
        
        if (pieceEntry) {
            pieceEntry.inputs.push({
                t: relativeTime,
                type: inputType,
                ...data
            });
        }
    }
    
    /**
     * Record a piece placement (when piece locks)
     */
    function recordMove(piece, board, moveData = {}, aiShadow = null) {
        if (!isRecording || !recording || currentPieceIndex < 0) return;
        
        const pieceEntry = recording.pieceData[currentPieceIndex];
        if (!pieceEntry) return;
        
        // Record final placement
        pieceEntry.placement = {
            x: piece.x,
            y: piece.y,
            rot: piece.rotationIndex || 0
        };
        
        // Add optional move metadata
        if (moveData.hardDrop) pieceEntry.placement.hd = true;
        if (moveData.softDropDistance) pieceEntry.placement.sd = moveData.softDropDistance;
        if (moveData.rotations) pieceEntry.placement.rots = moveData.rotations;
        if (moveData.lateralMoves) pieceEntry.placement.lat = moveData.lateralMoves;
        if (moveData.thinkTime) pieceEntry.placement.tt = moveData.thinkTime;
        
        // Add AI shadow evaluation if provided
        if (aiShadow) {
            pieceEntry.aiShadow = {
                chosen: {
                    x: aiShadow.chosen?.x,
                    y: aiShadow.chosen?.y,
                    rot: aiShadow.chosen?.rotation,
                    score: aiShadow.chosen?.combinedScore || aiShadow.chosen?.immediateScore,
                    class: aiShadow.chosen?.classification
                },
                match: (piece.x === aiShadow.chosen?.x && 
                       (piece.rotationIndex || 0) === aiShadow.chosen?.rotation)
            };
            
            // Calculate score difference
            if (aiShadow.alternatives) {
                const humanChoice = aiShadow.alternatives.find(alt => 
                    alt.x === piece.x && alt.rotation === (piece.rotationIndex || 0)
                );
                if (humanChoice) {
                    pieceEntry.aiShadow.humanScore = humanChoice.combinedScore || humanChoice.immediateScore;
                    pieceEntry.aiShadow.scoreDiff = (aiShadow.chosen?.combinedScore || aiShadow.chosen?.immediateScore) - 
                                                   (humanChoice.combinedScore || humanChoice.immediateScore);
                }
            }
        }
    }
    
    /**
     * Record AI decision metadata
     */
    function recordAIDecision(decisionMeta) {
        if (!isRecording || !recording || !decisionMeta || currentPieceIndex < 0) return;
        
        const pieceEntry = recording.pieceData[currentPieceIndex];
        if (!pieceEntry) return;
        
        pieceEntry.aiDecision = {
            chosen: decisionMeta.chosen,
            alts: decisionMeta.alternatives?.slice(0, 3) || [],
            diff: decisionMeta.scoreDifferential,
            danger: decisionMeta.dangerLevel,
            state: decisionMeta.gameState
        };
    }
    
    /**
     * Record tornado spawn - relative to current piece
     */
    function recordTornadoSpawn(x, snakeDirection, snakeChangeCounter) {
        if (!isRecording || !recording || currentPieceIndex < 0) return;
        
        const relativeTime = Date.now() - currentPieceSpawnTime;
        const pieceEntry = recording.pieceData[currentPieceIndex];
        
        if (pieceEntry) {
            pieceEntry.randomEvents.push({
                t: relativeTime,
                type: 'tornado_spawn',
                x,
                direction: snakeDirection,
                snakeChangeCounter
            });
        }
    }
    
    /**
     * Record tornado direction change
     */
    function recordTornadoDirection(newDirection, velocity) {
        if (!isRecording || !recording || currentPieceIndex < 0) return;
        
        const relativeTime = Date.now() - currentPieceSpawnTime;
        const pieceEntry = recording.pieceData[currentPieceIndex];
        
        if (pieceEntry) {
            pieceEntry.randomEvents.push({
                t: relativeTime,
                type: 'tornado_direction',
                direction: newDirection,
                velocity
            });
        }
    }
    
    /**
     * Record tornado drop position
     */
    function recordTornadoDrop(targetX) {
        if (!isRecording || !recording || currentPieceIndex < 0) return;
        
        const relativeTime = Date.now() - currentPieceSpawnTime;
        const pieceEntry = recording.pieceData[currentPieceIndex];
        
        if (pieceEntry) {
            pieceEntry.randomEvents.push({
                t: relativeTime,
                type: 'tornado_drop',
                targetX
            });
        }
    }
    
    /**
     * Record earthquake
     */
    function recordEarthquake(crackPath, shiftType) {
        if (!isRecording || !recording || currentPieceIndex < 0) return;
        
        const relativeTime = Date.now() - currentPieceSpawnTime;
        const pieceEntry = recording.pieceData[currentPieceIndex];
        
        if (pieceEntry) {
            pieceEntry.randomEvents.push({
                t: relativeTime,
                type: 'earthquake',
                crack: crackPath.map(pt => ({ x: pt.x, y: pt.y, edge: pt.edge })),
                shiftType
            });
        }
    }
    
    /**
     * Record volcano eruption
     */
    function recordVolcanoEruption(column, edgeType) {
        if (!isRecording || !recording || currentPieceIndex < 0) return;
        
        const relativeTime = Date.now() - currentPieceSpawnTime;
        const pieceEntry = recording.pieceData[currentPieceIndex];
        
        if (pieceEntry) {
            pieceEntry.randomEvents.push({
                t: relativeTime,
                type: 'volcano',
                column,
                edgeType
            });
        }
    }
    
    /**
     * Record lava projectile
     */
    function recordLavaProjectile(vx, vy) {
        if (!isRecording || !recording || currentPieceIndex < 0) return;
        
        const relativeTime = Date.now() - currentPieceSpawnTime;
        const pieceEntry = recording.pieceData[currentPieceIndex];
        
        if (pieceEntry) {
            pieceEntry.randomEvents.push({
                t: relativeTime,
                type: 'lava_projectile',
                vx, vy
            });
        }
    }
    
    /**
     * Record hail/gremlin block
     */
    function recordHailBlock(x, y, color) {
        if (!isRecording || !recording || currentPieceIndex < 0) return;
        
        const relativeTime = Date.now() - currentPieceSpawnTime;
        const pieceEntry = recording.pieceData[currentPieceIndex];
        
        if (pieceEntry) {
            pieceEntry.randomEvents.push({
                t: relativeTime,
                type: 'gremlin_block',
                x, y, color
            });
        }
    }
    
    /**
     * Record challenge mode event
     */
    function recordChallengeEvent(eventType, data) {
        if (!isRecording || !recording || currentPieceIndex < 0) return;
        
        const relativeTime = Date.now() - currentPieceSpawnTime;
        const pieceEntry = recording.pieceData[currentPieceIndex];
        
        if (pieceEntry) {
            pieceEntry.randomEvents.push({
                t: relativeTime,
                type: eventType,
                ...data
            });
        }
    }
    
    /**
     * Record a music track change
     */
    function recordMusicTrack(trackName) {
        if (!isRecording || !recording) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        recording.musicTracks.push({
            t: timestamp,
            trackName
        });
    }
    
    /**
     * Record special event (strikes, tsunamis, etc.)
     */
    function recordEvent(eventType, data = {}) {
        if (!isRecording || !recording || currentPieceIndex < 0) return;
        
        const relativeTime = Date.now() - currentPieceSpawnTime;
        const pieceEntry = recording.pieceData[currentPieceIndex];
        
        if (pieceEntry) {
            if (!pieceEntry.events) pieceEntry.events = [];
            pieceEntry.events.push({
                t: relativeTime,
                type: eventType,
                ...data
            });
        }
    }
    
    /**
     * Stop recording and finalize
     */
    function stopRecording(finalStats) {
        if (!isRecording || !recording) return null;
        
        isRecording = false;
        
        // Calculate human vs AI comparison stats if shadow data exists
        let humanVsAI = null;
        const piecesWithShadow = recording.pieceData.filter(p => p.aiShadow);
        if (piecesWithShadow.length > 0) {
            const matches = piecesWithShadow.filter(p => p.aiShadow.match).length;
            const scoreDiffs = piecesWithShadow.filter(p => p.aiShadow.scoreDiff !== undefined)
                                               .map(p => p.aiShadow.scoreDiff);
            const avgDiff = scoreDiffs.length > 0 ? 
                scoreDiffs.reduce((a, b) => a + b, 0) / scoreDiffs.length : 0;
            
            humanVsAI = {
                totalMoves: piecesWithShadow.length,
                matchingMoves: matches,
                matchRate: (matches / piecesWithShadow.length * 100).toFixed(1) + '%',
                avgScoreDiff: avgDiff.toFixed(0)
            };
        }
        
        // Add final board state
        if (finalStats && finalStats.board) {
            recording.finalBoard = compressBoard(finalStats.board);
        }
        
        recording.finalStats = {
            score: finalStats?.score || 0,
            lines: finalStats?.lines || 0,
            level: finalStats?.level || 1,
            strikes: finalStats?.strikes || 0,
            tsunamis: finalStats?.tsunamis || 0,
            blackHoles: finalStats?.blackHoles || 0,
            volcanoes: finalStats?.volcanoes || 0,
            duration: Date.now() - recording.startTime,
            piecesPlaced: recording.pieceData.length,
            humanVsAI
        };
        
        console.log('📹 Recording stopped:', recording.pieceData.length, 'pieces,', 
                    recording.finalStats.duration, 'ms');
        
        const result = recording;
        recording = null;
        currentPieceIndex = -1;
        
        return result;
    }
    
    /**
     * Submit recording to server
     */
    async function submitRecording(recordingData, gameData = {}) {
        try {
            const payload = {
                username: gameData.username || 'anonymous',
                difficulty: recordingData.difficulty,
                skill_level: recordingData.skillLevel,
                score: recordingData.finalStats?.score || 0,
                lines: recordingData.finalStats?.lines || 0,
                level: recordingData.finalStats?.level || 1,
                strikes: recordingData.finalStats?.strikes || 0,
                tsunamis: recordingData.finalStats?.tsunamis || 0,
                black_holes: recordingData.finalStats?.blackHoles || 0,
                volcanoes: recordingData.finalStats?.volcanoes || 0,
                is_ai: recordingData.playerType === 'ai',
                recording_data: recordingData
            };
            
            console.log('📹 Submitting recording to server...');
            
            const response = await fetch(`${API_URL}/recording`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('📹 Recording submitted successfully, ID:', result.recording_id);
                return { success: true, recordingId: result.recording_id };
            } else {
                const errorText = await response.text();
                console.error('📹 Recording submission failed:', response.status, errorText);
                return { success: false, error: errorText };
            }
        } catch (error) {
            console.error('📹 Recording submission error:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Check if currently recording
     */
    function isActive() {
        return isRecording;
    }
    
    /**
     * Get current recording (for inspection)
     */
    function getRecording() {
        return recording;
    }
    
    /**
     * Get current piece index
     */
    function getCurrentPieceIndex() {
        return currentPieceIndex;
    }
    
    /**
     * Compress board to array of non-null cells
     */
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
    
    // Utility function for piece type detection (fallback)
    function getPieceType(shape) {
        if (!shape) return '?';
        const h = shape.length;
        const w = shape[0]?.length || 0;
        
        if (h === 1 && w === 4) return 'I';
        if (h === 2 && w === 2) return 'O';
        if (h === 2 && w === 3) {
            const bottomRow = shape[1];
            if (bottomRow[0] && bottomRow[1] && !bottomRow[2]) return 'J';
            if (!bottomRow[0] && bottomRow[1] && bottomRow[2]) return 'L';
            if (bottomRow[0] && bottomRow[1] && bottomRow[2]) return 'T';
        }
        if (h === 2 && w === 3) {
            if (shape[0][0] && shape[0][1] && shape[1][1] && shape[1][2]) return 'S';
            if (shape[0][1] && shape[0][2] && shape[1][0] && shape[1][1]) return 'Z';
        }
        return '?';
    }
    
    // Export public interface
    return {
        startRecording,
        stopRecording,
        recordPieceSpawn,
        recordInput,
        recordMove,
        recordAIDecision,
        recordEvent,
        recordMusicTrack,
        recordTornadoSpawn,
        recordTornadoDirection,
        recordTornadoDrop,
        recordEarthquake,
        recordVolcanoEruption,
        recordLavaProjectile,
        recordHailBlock,
        recordGremlinBlock: recordHailBlock,
        recordChallengeEvent,
        submitRecording,
        isActive,
        getRecording,
        getCurrentPieceIndex,
        compressBoard
    };
})();

// Export for use as module
if (typeof window !== 'undefined') {
    window.GameRecorder = GameRecorder;
}
