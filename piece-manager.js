// Piece Management
const PieceManager = {
    randomColor() {
        return GameState.currentColorSet[Math.floor(Math.random() * GameState.currentColorSet.length)];
    },

    createPiece() {
        const shapeSet = (GameState.gameMode === 'blizzard' || GameState.gameMode === 'hurricane') ? EXTENDED_SHAPES : SHAPES;
        const shapes = Object.keys(shapeSet);
        const type = shapes[Math.floor(Math.random() * shapes.length)];
        return {
            shape: shapeSet[type],
            type: type,
            color: this.randomColor(),
            x: Math.floor(GameState.COLS / 2) - Math.floor(shapeSet[type][0].length / 2),
            y: -1
        };
    },
    
    collides(piece, offsetX = 0, offsetY = 0) {
        if (!piece || !piece.shape) return true;
        
        return piece.shape.some((row, y) => {
            return row.some((value, x) => {
                if (value) {
                    const newX = piece.x + x + offsetX;
                    const newY = piece.y + y + offsetY;
                    return newX < 0 || newX >= GameState.COLS || newY >= GameState.ROWS ||
                           (newY >= 0 && GameState.board[newY][newX]);
                }
                return false;
            });
        });
    },
    
    rotatePiece(piece) {
        if (!piece || !piece.shape || !Array.isArray(piece.shape) || piece.shape.length === 0) return;
        if (!piece.shape[0] || !Array.isArray(piece.shape[0]) || piece.shape[0].length === 0) return;
        if (!piece.shape.every(row => row && Array.isArray(row) && row.length > 0)) return;
        
        try {
            const rotated = piece.shape[0].map((_, i) =>
                piece.shape.map(row => row[i]).reverse()
            );
            const previous = piece.shape;
            piece.shape = rotated;
            
            if (this.collides(piece)) {
                piece.shape = previous;
            } else {
                AudioSystem.playSoundEffect('rotate');
            }
        } catch (error) {
            // Silently fail
        }
    },

    rotatePieceCounterClockwise(piece) {
        if (!piece || !piece.shape || !Array.isArray(piece.shape) || piece.shape.length === 0) return;
        if (!piece.shape[0] || !Array.isArray(piece.shape[0]) || piece.shape[0].length === 0) return;
        if (!piece.shape.every(row => row && Array.isArray(row) && row.length > 0)) return;
        
        try {
            const reversed = piece.shape.map(row => [...row].reverse());
            const rotated = reversed[0].map((_, i) =>
                reversed.map(row => row[i])
            );
            const previous = piece.shape;
            piece.shape = rotated;
            
            if (this.collides(piece)) {
                piece.shape = previous;
            } else {
                AudioSystem.playSoundEffect('rotate');
            }
        } catch (error) {
            // Silently fail
        }
    },

    movePiece(piece, dir) {
        if (!piece) return;
        piece.x += dir;
        if (this.collides(piece)) {
            piece.x -= dir;
        } else {
            AudioSystem.playSoundEffect('move');
        }
    },

    mergePiece(piece) {
        if (!piece || !piece.shape) return;
        
        piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    const boardY = piece.y + y;
                    const boardX = piece.x + x;
                    if (boardY >= 0) {
                        GameState.board[boardY][boardX] = piece.color;
                        GameState.isRandomBlock[boardY][boardX] = false;
                    }
                }
            });
        });
    },
    
    getShadowYPosition(piece) {
        if (!piece || !piece.shape) return piece.y;
        
        let shadowY = piece.y;
        while (!this.collides(piece, 0, shadowY - piece.y + 1)) {
            shadowY++;
        }
        return shadowY;
    }
};
