// Blob Detection and Analysis
const BlobDetection = {
    findBlob(x, y, color, visited = new Set()) {
        const key = `${x},${y}`;
        if (visited.has(key) || x < 0 || x >= GameState.COLS || y < 0 || y >= GameState.ROWS) return [];
        if (!GameState.board[y][x] || GameState.board[y][x] !== color) return [];

        visited.add(key);
        let blob = [[x, y]];

        blob = blob.concat(this.findBlob(x + 1, y, color, visited));
        blob = blob.concat(this.findBlob(x - 1, y, color, visited));
        blob = blob.concat(this.findBlob(x, y + 1, color, visited));
        blob = blob.concat(this.findBlob(x, y - 1, color, visited));

        return blob;
    },

    getAllBlobs() {
        if (!GameState.board || !Array.isArray(GameState.board) || GameState.board.length === 0) {
            return [];
        }
        
        const visited = new Set();
        const blobs = [];

        for (let y = 0; y < GameState.ROWS; y++) {
            if (!GameState.board[y] || !Array.isArray(GameState.board[y])) continue;
            
            for (let x = 0; x < GameState.COLS; x++) {
                const key = `${x},${y}`;
                if (!visited.has(key) && GameState.board[y][x]) {
                    const blob = this.findBlob(x, y, GameState.board[y][x], visited);
                    if (blob.length > 0) {
                        blobs.push({ positions: blob, color: GameState.board[y][x] });
                    }
                }
            }
        }

        return blobs;
    },
    
    isBlobEnveloped(innerBlob, outerBlob) {
        const outerSet = new Set(outerBlob.positions.map(p => `${p[0]},${p[1]}`));
        const innerSet = new Set(innerBlob.positions.map(p => `${p[0]},${p[1]}`));
        
        for (const [x, y] of innerBlob.positions) {
            const adjacents = [
                [x-1, y], [x+1, y], [x, y-1], [x, y+1]
            ];
            
            for (const [ax, ay] of adjacents) {
                const key = `${ax},${ay}`;
                
                if (ax < 0 || ax >= GameState.COLS || ay < 0 || ay >= GameState.ROWS) {
                    return false;
                }
                
                const isOuter = outerSet.has(key);
                const isInner = innerSet.has(key);
                
                if (!isOuter && !isInner) {
                    return false;
                }
            }
        }
        
        return true;
    },
    
    detectBlackHoles(blobs) {
        const blackHoles = [];
        
        for (let i = 0; i < blobs.length; i++) {
            for (let j = 0; j < blobs.length; j++) {
                if (i === j) continue;
                
                const outer = blobs[i];
                const inner = blobs[j];
                
                if (this.isBlobEnveloped(inner, outer)) {
                    blackHoles.push({
                        outerBlob: outer,
                        innerBlob: inner
                    });
                }
            }
        }
        
        return blackHoles;
    }
};
