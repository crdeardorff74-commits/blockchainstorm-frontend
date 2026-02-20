/**
 * Game Recorder Module for TaNTЯiS
 * Records human gameplay for analysis and playback
 * v2.0: Piece-relative timing - all events indexed by piece for perfect sync
 */
Logger.info("📹 Game Recorder v2.0 loaded - piece-relative timing for accurate replay");

const GameRecorder = (() => {
    const API_URL = AppConfig.GAME_API;
    
    // Recording state
    let recording = null;
    let isRecording = false;
    let currentPieceIndex = -1;
    let currentPieceSpawnTime = 0;
    
    /**
     * Start recording a new game session. Initializes internal recording state
     * with the provided configuration and begins capturing piece data.
     * @param {Object} config - Game configuration for this recording session.
     * @param {string} [config.gameVersion='unknown'] - Version identifier of the game build.
     * @param {string} [config.playerType='human'] - Player type, e.g. 'human' or 'ai'.
     * @param {string} [config.difficulty='drizzle'] - Difficulty setting for the game.
     * @param {string} [config.skillLevel='tempest'] - Skill level setting.
     * @param {string} [config.palette='classic'] - Color palette used.
     * @param {string} [config.mode='normal'] - Game mode identifier.
     * @param {string[]} [config.challenges=[]] - Active challenge mode identifiers.
     * @param {Object} [config.visualSettings={}] - Visual settings in effect.
     * @returns {boolean} Always returns true to indicate recording has started.
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
            fWordSongId: null,  // Which F Word song was used (if easter egg triggered)
            
            // Final stats (filled at end)
            finalStats: null
        };
        
        isRecording = true;
        currentPieceIndex = -1;
        currentPieceSpawnTime = 0;
        
        Logger.info('📹 Recording started (v2.0 piece-relative)');
        return true;
    }
    
    /**
     * Record the spawn of a new piece. Creates a new piece entry with a board
     * snapshot. Must be called before any inputs for that piece are recorded.
     * @param {Object} piece - The spawned piece object.
     * @param {string} piece.type - Single-character piece type identifier (e.g. 'I', 'T', 'O').
     * @param {string} piece.color - Color identifier for the piece.
     * @param {Array<Array<*>>} board - The current board state as a 2D array.
     * @returns {void}
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
     * Record a player input event. The timestamp is stored relative to the
     * current piece's spawn time for piece-relative replay accuracy.
     * @param {string} inputType - The type of input (e.g. 'left', 'right', 'rotate', 'hardDrop').
     * @param {Object} [data={}] - Additional data associated with the input event.
     * @returns {void}
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
     * Record the final placement of a piece when it locks into the board.
     * Optionally includes AI shadow evaluation data for human-vs-AI comparison.
     * @param {Object} piece - The piece that was placed.
     * @param {number} piece.x - Final x-coordinate of the piece.
     * @param {number} piece.y - Final y-coordinate of the piece.
     * @param {number} [piece.rotationIndex=0] - Final rotation state.
     * @param {Array<Array<*>>} board - The board state (unused directly, reserved for future use).
     * @param {Object} [moveData={}] - Metadata about how the piece was placed.
     * @param {boolean} [moveData.hardDrop] - Whether the piece was hard-dropped.
     * @param {number} [moveData.softDropDistance] - Number of rows soft-dropped.
     * @param {number} [moveData.rotations] - Number of rotations performed.
     * @param {number} [moveData.lateralMoves] - Number of lateral moves performed.
     * @param {number} [moveData.thinkTime] - Time in ms the player spent deciding.
     * @param {Object|null} [aiShadow=null] - AI shadow evaluation for comparison.
     * @param {Object} [aiShadow.chosen] - The AI's top-ranked placement.
     * @param {Array} [aiShadow.alternatives] - Alternative placements evaluated by the AI.
     * @returns {void}
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
     * Record AI decision metadata for the current piece, including the chosen
     * placement, alternatives considered, and danger assessment.
     * @param {Object} decisionMeta - AI decision details.
     * @param {Object} decisionMeta.chosen - The placement the AI selected.
     * @param {Array} [decisionMeta.alternatives] - Top alternative placements (up to 3 stored).
     * @param {number} [decisionMeta.scoreDifferential] - Score gap between best and second-best.
     * @param {string} [decisionMeta.dangerLevel] - Current danger assessment level.
     * @param {Object} [decisionMeta.gameState] - Snapshot of relevant game state metrics.
     * @returns {void}
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
     * Record a tornado spawn event, timestamped relative to the current piece.
     * @param {number} x - Column position where the tornado spawned.
     * @param {number} snakeDirection - Current snake movement direction.
     * @param {number} snakeChangeCounter - Counter tracking snake direction changes.
     * @returns {void}
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
     * Record a change in tornado movement direction.
     * @param {number} newDirection - The new direction value for the tornado.
     * @param {number} velocity - The tornado's current velocity.
     * @returns {void}
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
     * Record the column where a tornado drops its payload.
     * @param {number} targetX - The target column for the tornado drop.
     * @returns {void}
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
     * Record an earthquake event, including the crack path and shift type.
     * @param {Array<Object>} crackPath - Array of crack point objects describing the fissure.
     * @param {number} crackPath[].x - X-coordinate of the crack point.
     * @param {number} crackPath[].y - Y-coordinate of the crack point.
     * @param {string} crackPath[].edge - Edge identifier for the crack point.
     * @param {string} shiftType - The type of board shift caused by the earthquake.
     * @returns {void}
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
     * Record a volcano eruption event.
     * @param {number} column - The column where the volcano erupted.
     * @param {string} edgeType - The type of edge effect from the eruption.
     * @returns {void}
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
     * Record a lava projectile launched by a volcano.
     * @param {number} vx - Horizontal velocity of the projectile.
     * @param {number} vy - Vertical velocity of the projectile.
     * @returns {void}
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
     * Record a hail or gremlin block placement on the board.
     * Also exported as `recordGremlinBlock`.
     * @param {number} x - Column where the block was placed.
     * @param {number} y - Row where the block was placed.
     * @param {string} color - Color identifier of the placed block.
     * @returns {void}
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
     * Record a challenge-mode-specific event, timestamped relative to the current piece.
     * @param {string} eventType - The challenge event type identifier.
     * @param {Object} data - Event-specific payload data.
     * @returns {void}
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
     * Record a music track change during gameplay. Timestamp is relative to
     * the overall recording start time (not piece-relative).
     * @param {string} trackId - Unique identifier for the music track.
     * @param {string} trackName - Human-readable name of the track.
     * @returns {void}
     */
    function recordMusicTrack(trackId, trackName) {
        if (!isRecording || !recording) return;
        
        const timestamp = Date.now() - recording.startTime;
        
        recording.musicTracks.push({
            t: timestamp,
            trackId,
            trackName
        });
    }
    
    /**
     * Record which F Word easter egg song was selected during gameplay.
     * @param {string} songId - Identifier of the F Word song used.
     * @returns {void}
     */
    function recordFWordSong(songId) {
        if (!isRecording || !recording) return;
        recording.fWordSongId = songId;
        Logger.debug('📹 F Word song recorded:', songId);
    }
    
    /**
     * Get the recorded F Word song ID (for replay)
     */
    function getFWordSongId() {
        return recording?.fWordSongId || null;
    }
    
    /**
     * Record a special game event such as strikes or tsunamis, stored relative
     * to the current piece's spawn time.
     * @param {string} eventType - The event type identifier (e.g. 'strike', 'tsunami').
     * @param {Object} [data={}] - Additional event-specific data.
     * @returns {void}
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
     * Stop the current recording session and finalize it. Computes human-vs-AI
     * comparison statistics if shadow data is present, attaches final game
     * stats, and returns the complete recording object.
     * @param {Object} finalStats - Final game statistics at the time of game over.
     * @param {number} [finalStats.score=0] - Final score.
     * @param {number} [finalStats.lines=0] - Total lines cleared.
     * @param {number} [finalStats.level=1] - Final level reached.
     * @param {number} [finalStats.strikes=0] - Number of strikes received.
     * @param {number} [finalStats.tsunamis=0] - Number of tsunamis survived.
     * @param {number} [finalStats.blackHoles=0] - Number of black hole events.
     * @param {number} [finalStats.volcanoes=0] - Number of volcano eruptions.
     * @param {number} [finalStats.supermassiveBlackHoles=0] - Number of supermassive black holes.
     * @param {number} [finalStats.superVolcanoes=0] - Number of super volcano eruptions.
     * @param {Array<Array<*>>} [finalStats.board] - Final board state for snapshot.
     * @returns {Object|null} The complete recording object, or null if not recording.
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
            supermassiveBlackHoles: finalStats?.supermassiveBlackHoles || 0,
            superVolcanoes: finalStats?.superVolcanoes || 0,
            duration: Date.now() - recording.startTime,
            piecesPlaced: recording.pieceData.length,
            humanVsAI
        };
        
        Logger.info('📹 Recording stopped:', recording.pieceData.length, 'pieces,',
                    recording.finalStats.duration, 'ms');
        
        const result = recording;
        recording = null;
        currentPieceIndex = -1;
        
        return result;
    }
    
    /**
     * Submit a completed recording to the server via the game API.
     * Merges recording data with game metadata into a single payload.
     * @async
     * @param {Object} recordingData - The recording object returned by stopRecording().
     * @param {Object} [gameData={}] - Additional game metadata to include in the submission.
     * @param {string} [gameData.username='anonymous'] - Player username.
     * @param {string} [gameData.game='tantris'] - Game identifier.
     * @param {string} [gameData.playerType] - Player type override.
     * @param {string} [gameData.difficulty] - Difficulty override.
     * @param {string} [gameData.skillLevel] - Skill level override.
     * @param {string} [gameData.mode] - Game mode override.
     * @param {string[]} [gameData.challenges] - Active challenges override.
     * @param {number} [gameData.speedBonus=1.0] - Speed bonus multiplier.
     * @param {number} [gameData.durationSeconds] - Game duration in seconds.
     * @param {string} [gameData.endCause='game_over'] - Reason the game ended.
     * @param {string|null} [gameData.debugLog=null] - Optional debug log data.
     * @returns {Promise<{success: boolean, recordingId?: string, error?: string}>}
     *   Result object indicating success or failure with an optional recording ID or error message.
     */
    async function submitRecording(recordingData, gameData = {}) {
        // Guard against null/undefined recording data
        if (!recordingData) {
            Logger.error('📹 submitRecording called with null/undefined recordingData!');
            return { success: false, error: 'No recording data' };
        }
        
        try {
            const payload = {
                // From gameData
                username: gameData.username || 'anonymous',
                game: gameData.game || 'tantris',
                playerType: gameData.playerType || recordingData.playerType || 'human',
                difficulty: gameData.difficulty || recordingData.difficulty,
                skillLevel: gameData.skillLevel || recordingData.skillLevel || 'tempest',
                mode: gameData.mode || recordingData.mode || 'normal',
                challenges: gameData.challenges || recordingData.challenges || [],
                speedBonus: gameData.speedBonus || 1.0,
                durationSeconds: gameData.durationSeconds || Math.floor((recordingData.finalStats?.duration || 0) / 1000),
                endCause: gameData.endCause || 'game_over',
                debugLog: gameData.debugLog || null,
                gameVersion: recordingData.gameVersion || 'unknown',
                
                // Stats
                score: gameData.score || recordingData.finalStats?.score || 0,
                lines: gameData.lines || recordingData.finalStats?.lines || 0,
                level: gameData.level || recordingData.finalStats?.level || 1,
                strikes: gameData.strikes || recordingData.finalStats?.strikes || 0,
                tsunamis: gameData.tsunamis || recordingData.finalStats?.tsunamis || 0,
                blackholes: gameData.blackholes || recordingData.finalStats?.blackHoles || 0,
                volcanoes: gameData.volcanoes || recordingData.finalStats?.volcanoes || 0,
                supermassive_blackholes: gameData.supermassiveBlackHoles || recordingData.finalStats?.supermassiveBlackHoles || 0,
                super_volcanoes: gameData.superVolcanoes || recordingData.finalStats?.superVolcanoes || 0,
                
                // The actual recording data - server expects 'recording' key
                recording: recordingData
            };
            
            Logger.info('📹 Submitting recording to server...');
            Logger.debug('📹 Payload size:', JSON.stringify(payload).length, 'bytes');
            Logger.debug('📹 Recording has', recordingData.pieceData?.length || 0, 'pieces');
            
            const response = await apiFetch(`${API_URL}/recording`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                timeout: 15000,
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                Logger.info('📹 Recording submitted successfully, ID:', result.recording_id);
                return { success: true, recordingId: result.recording_id };
            } else {
                const errorText = await response.text();
                Logger.error('📹 Recording submission failed:', response.status, errorText);
                return { success: false, error: errorText };
            }
        } catch (error) {
            Logger.error('📹 Recording submission error:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Check whether a recording session is currently active.
     * @returns {boolean} True if currently recording, false otherwise.
     */
    function isActive() {
        return isRecording;
    }
    
    /**
     * Attach AI shadow evaluation data to a specific piece entry by its index.
     * Used when asynchronous AI evaluations complete after the current piece
     * index has already advanced.
     * @param {number} pieceIndex - Zero-based index into the pieceData array.
     * @param {Object} piece - The piece object for placement comparison.
     * @param {number} piece.x - The piece's final x-coordinate.
     * @param {number} [piece.rotationIndex=0] - The piece's final rotation state.
     * @param {Object} aiShadow - AI shadow evaluation result.
     * @param {Object} [aiShadow.chosen] - The AI's top-ranked placement choice.
     * @returns {void}
     */
    function addAIShadow(pieceIndex, piece, aiShadow) {
        if (!isRecording || !recording || pieceIndex < 0) return;
        const pieceEntry = recording.pieceData[pieceIndex];
        if (!pieceEntry || !aiShadow) return;
        
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
        
        if (aiShadow.chosen) {
            const piecePlacement = pieceEntry.placement;
            if (piecePlacement) {
                pieceEntry.aiShadow.scoreDiff = aiShadow.chosen.combinedScore || 0;
            }
        }
    }
    
    /**
     * Get the current in-progress recording object for inspection.
     * Returns null if no recording is active.
     * @returns {Object|null} The current recording object, or null.
     */
    function getRecording() {
        return recording;
    }
    
    /**
     * Get the zero-based index of the current piece being recorded.
     * Returns -1 if no piece has been spawned yet.
     * @returns {number} The current piece index, or -1 before any piece spawns.
     */
    function getCurrentPieceIndex() {
        return currentPieceIndex;
    }
    
    /**
     * Compress a 2D board array into a sparse list of non-null cells.
     * Each entry records the x, y coordinates and color of an occupied cell.
     * @param {Array<Array<*>>} board - The board state as a 2D array (rows x columns).
     * @returns {Array<{x: number, y: number, c: *}>} Sparse array of occupied cells.
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
        recordFWordSong,
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
        addAIShadow,
        getRecording,
        getCurrentPieceIndex,
        compressBoard
    };
})();

// Also expose on window — many modules use window.GameRecorder guards for optional recording
if (typeof window !== 'undefined') {
    window.GameRecorder = GameRecorder;
}
