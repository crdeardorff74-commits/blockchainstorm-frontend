/**
 * Game Recorder Module for TaNTЯiS / BLOCKCHaiNSTORM
 * Records human gameplay for analysis and playback
 * Similar structure to AI recording but captures human decisions
 * v1.3: Added AI shadow mode - records what AI would do during human games
 */
console.log("📹 Game Recorder v1.3 loaded - AI shadow mode for human vs AI comparison");

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
            version: '1.2',
            gameVersion: config.gameVersion || 'unknown',
            startTime: Date.now(),
            playerType: config.playerType || 'human',
            difficulty: config.difficulty || 'drizzle',
            skillLevel: config.skillLevel || 'tempest',
            mode: config.mode || 'normal',
            challenges: config.challenges || [],
            speedBonus: config.speedBonus || 1.0,
            
            // Game events
            moves: [],          // Every piece placement
            pieces: [],         // Piece generation sequence (type, color)
            inputs: [],         // Player inputs for deterministic replay
            events: [],         // Special events (strikes, tsunamis, etc.)
            randomEvents: [],   // Random events for replay (tornadoes, earthquakes)
            keyframes: [],      // Periodic board snapshots
            musicTracks: [],    // Music track sequence for replay
            
            // AI decision metadata (only populated for AI games)
            aiDecisions: [],
            
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
     * Record a piece being generated (for replay)
     */
    function recordPieceGenerated(piece) {
        if (!isRecording || !recording) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        recording.pieces.push({
            t: timestamp,
            type: piece.type,
            color: piece.color
        });
    }
    
    /**
     * Record a player input for deterministic replay
     */
    function recordInput(inputType, data = {}) {
        if (!isRecording || !recording) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        recording.inputs.push({
            t: timestamp,
            type: inputType,
            ...data
        });
    }
    
    /**
     * Record a piece placement
     * For human games, aiShadow contains what the AI would have done
     */
    function recordMove(piece, board, moveData = {}, aiShadow = null) {
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
        
        // Add AI shadow evaluation if provided (what AI would have done)
        if (aiShadow) {
            pieceData.aiWouldDo = {
                x: aiShadow.chosen?.x,
                y: aiShadow.chosen?.y,
                rot: aiShadow.chosen?.rotation,
                score: aiShadow.chosen?.combinedScore || aiShadow.chosen?.immediateScore,
                class: aiShadow.chosen?.classification,
                // Did human match AI recommendation?
                match: (piece.x === aiShadow.chosen?.x && 
                       (piece.rotationIndex || 0) === aiShadow.chosen?.rotation)
            };
            
            // Calculate how the AI would have scored the human's actual move
            // This requires finding it in the alternatives
            if (aiShadow.alternatives) {
                const humanChoice = aiShadow.alternatives.find(alt => 
                    alt.x === piece.x && alt.rotation === (piece.rotationIndex || 0)
                );
                if (humanChoice) {
                    pieceData.humanScore = humanChoice.combinedScore || humanChoice.immediateScore;
                    pieceData.scoreDiff = (aiShadow.chosen?.combinedScore || aiShadow.chosen?.immediateScore) - 
                                         (humanChoice.combinedScore || humanChoice.immediateScore);
                }
            }
        }
        
        recording.moves.push(pieceData);
    }
    
    /**
     * Record AI decision metadata (why the AI made a particular move)
     */
    function recordAIDecision(decisionMeta) {
        if (!isRecording || !recording || !decisionMeta) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        // Compress the decision data
        const decision = {
            t: timestamp,
            chosen: decisionMeta.chosen,
            alts: decisionMeta.alternatives?.slice(0, 3) || [], // Top 3 alternatives
            diff: decisionMeta.scoreDifferential,
            board: decisionMeta.boardMetrics,
            look: decisionMeta.lookahead?.depth || 1,
            candidates: decisionMeta.candidatesEvaluated,
            skill: decisionMeta.skillLevel
        };
        
        recording.aiDecisions.push(decision);
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
    
    // ============================================
    // RANDOM EVENT RECORDING (for playback)
    // ============================================
    
    /**
     * Record tornado spawn with its random parameters
     */
    function recordTornadoSpawn(tornadoData) {
        if (!isRecording || !recording) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        recording.randomEvents.push({
            t: timestamp,
            type: 'tornado_spawn',
            x: tornadoData.x,
            snakeDirection: tornadoData.snakeDirection,
            snakeChangeCounter: tornadoData.snakeChangeCounter
        });
    }
    
    /**
     * Record tornado direction change
     */
    function recordTornadoDirectionChange(newDirection, newCounter) {
        if (!isRecording || !recording) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        recording.randomEvents.push({
            t: timestamp,
            type: 'tornado_direction',
            direction: newDirection,
            counter: newCounter
        });
    }
    
    /**
     * Record tornado drop target position
     */
    function recordTornadoDrop(targetX) {
        if (!isRecording || !recording) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        recording.randomEvents.push({
            t: timestamp,
            type: 'tornado_drop',
            targetX: targetX
        });
    }
    
    /**
     * Record earthquake crack path
     */
    function recordEarthquake(crackPath, shiftType) {
        if (!isRecording || !recording) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        recording.randomEvents.push({
            t: timestamp,
            type: 'earthquake',
            crack: crackPath.map(pt => ({ x: pt.x, y: pt.y })),
            shiftType: shiftType
        });
    }
    
    /**
     * Record volcano eruption column selection
     */
    function recordVolcanoEruption(column, edgeType) {
        if (!isRecording || !recording) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        recording.randomEvents.push({
            t: timestamp,
            type: 'volcano',
            column: column,
            edge: edgeType
        });
    }
    
    /**
     * Record random hail block spawn (for Hailstorm/Hurricane modes)
     */
    function recordHailBlock(x, y, color) {
        if (!isRecording || !recording) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        recording.randomEvents.push({
            t: timestamp,
            type: 'hail_block',
            x: x,
            y: y,
            color: color
        });
    }
    
    /**
     * Record challenge mode random events
     */
    function recordChallengeEvent(challengeType, data) {
        if (!isRecording || !recording) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        recording.randomEvents.push({
            t: timestamp,
            type: 'challenge_' + challengeType,
            ...data
        });
    }
    
    /**
     * Record music track change for replay
     */
    function recordMusicTrack(trackId, trackName) {
        if (!isRecording || !recording) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        recording.musicTracks.push({
            t: timestamp,
            trackId: trackId,
            trackName: trackName
        });
        
        console.log(`📹 Music track recorded: ${trackName} at ${timestamp}ms`);
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
        
        // Calculate human vs AI comparison stats if shadow data exists
        let humanVsAI = null;
        const movesWithShadow = recording.moves.filter(m => m.aiWouldDo);
        if (movesWithShadow.length > 0) {
            const matches = movesWithShadow.filter(m => m.aiWouldDo.match).length;
            const scoreDiffs = movesWithShadow.filter(m => m.scoreDiff !== undefined).map(m => m.scoreDiff);
            const avgDiff = scoreDiffs.length > 0 ? 
                scoreDiffs.reduce((a, b) => a + b, 0) / scoreDiffs.length : 0;
            
            // Classify moves: human better (negative diff), AI better (positive diff), same
            const humanBetter = scoreDiffs.filter(d => d < -5).length;
            const aiBetter = scoreDiffs.filter(d => d > 5).length;
            const similar = scoreDiffs.length - humanBetter - aiBetter;
            
            humanVsAI = {
                totalCompared: movesWithShadow.length,
                exactMatches: matches,
                matchRate: Math.round(matches / movesWithShadow.length * 100),
                avgScoreDiff: Math.round(avgDiff * 100) / 100,
                humanBetterCount: humanBetter,
                aiBetterCount: aiBetter,
                similarCount: similar
            };
        }
        
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
            totalPieces: recording.pieces.length,
            totalRandomEvents: recording.randomEvents.length,
            totalAIDecisions: recording.aiDecisions?.length || 0,
            endCause: finalStats.endCause || 'game_over',
            humanVsAI: humanVsAI
        };
        
        // Add final board state
        if (finalStats.board) {
            recording.finalBoard = compressBoard(finalStats.board);
        }
        
        const shadowInfo = humanVsAI ? `, ${humanVsAI.matchRate}% AI match rate` : '';
        console.log(`📹 Recording stopped: ${recording.moves.length} moves, ${recording.events.length} events, ${recording.randomEvents.length} random events, ${recording.aiDecisions?.length || 0} AI decisions, ${recording.pieces.length} pieces${shadowInfo}`);
        
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
            
            // Use gameData as overrides for recordingData fields
            const payload = {
                recording: recordingData,
                username: gameData.username || 'Anonymous',
                sessionId: gameData.sessionId || getSessionId(),
                game: gameData.game || 'blockchainstorm',
                playerType: gameData.playerType || recordingData.playerType || 'human',
                difficulty: gameData.difficulty || recordingData.difficulty,
                skillLevel: gameData.skillLevel || recordingData.skillLevel,
                mode: gameData.mode || recordingData.mode,
                challenges: gameData.challenges || recordingData.challenges,
                speedBonus: gameData.speedBonus || recordingData.speedBonus,
                score: gameData.score ?? recordingData.finalStats?.score ?? 0,
                lines: gameData.lines ?? recordingData.finalStats?.lines ?? 0,
                level: gameData.level ?? recordingData.finalStats?.level ?? 1,
                strikes: gameData.strikes ?? recordingData.finalStats?.strikes ?? 0,
                tsunamis: gameData.tsunamis ?? recordingData.finalStats?.tsunamis ?? 0,
                blackholes: gameData.blackholes ?? recordingData.finalStats?.blackholes ?? 0,
                volcanoes: gameData.volcanoes ?? recordingData.finalStats?.volcanoes ?? 0,
                durationSeconds: gameData.durationSeconds ?? Math.floor((recordingData.finalStats?.duration || 0) / 1000),
                gameVersion: recordingData.gameVersion,
                endCause: gameData.endCause || recordingData.finalStats?.endCause || 'game_over',
                debugLog: gameData.debugLog || null
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
        recordPieceGenerated,
        recordInput,
        recordMove,
        recordAIDecision,
        recordEvent,
        recordTornadoSpawn,
        recordTornadoDirectionChange,
        recordTornadoDrop,
        recordEarthquake,
        recordVolcanoEruption,
        recordHailBlock,
        recordGremlinBlock: recordHailBlock,  // Alias for renamed feature
        recordChallengeEvent,
        recordMusicTrack,
        captureFrame,
        stopRecording,
        submitRecording,
        downloadRecording,
        isActive: () => isRecording
    };
})();

// Make available globally
window.GameRecorder = GameRecorder;
