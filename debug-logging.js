// ===== DEBUG AND LOGGING MODULE =====
// Handles console log capture and debugging utilities

const LOG_QUEUE_MAX_SIZE = 1000;
let logQueue = [];

// Store original console.log
const originalConsoleLog = console.log;

// Override console.log to capture all logs
console.log = function(...args) {
    // Call original console.log
    originalConsoleLog.apply(console, args);
    
    // Format the log message
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const message = args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');
    
    // Add to queue
    logQueue.push(`[${timestamp}] ${message}`);
    
    // Maintain FIFO - remove oldest if over limit
    if (logQueue.length > LOG_QUEUE_MAX_SIZE) {
        logQueue.shift();
    }
};

// Function to copy logs to clipboard (CTRL+D)
function copyLogsToClipboard() {
    const logText = logQueue.join('\n');
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(logText).then(() => {
            originalConsoleLog('✅ Copied ' + logQueue.length + ' log entries to clipboard!');
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                padding: 20px 40px;
                background: rgba(0, 255, 0, 0.9);
                color: white;
                fontSize: 24px;
                font-weight: bold;
                border-radius: 10px;
                z-index: 10000;
            `;
            indicator.textContent = `📋 Copied ${logQueue.length} logs!`;
            document.body.appendChild(indicator);
            setTimeout(() => indicator.remove(), 2000);
        }).catch(err => {
            originalConsoleLog('❌ Failed to copy logs:', err);
            alert('Failed to copy logs to clipboard. Check console for details.');
        });
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = logText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            originalConsoleLog('✅ Copied ' + logQueue.length + ' log entries to clipboard (fallback method)!');
            alert(`📋 Copied ${logQueue.length} logs to clipboard!`);
        } catch (err) {
            originalConsoleLog('❌ Failed to copy logs:', err);
            alert('Failed to copy logs to clipboard.');
        }
        document.body.removeChild(textarea);
    }
}

// Function to capture canvas snapshot and copy to clipboard (CTRL+C)
function captureCanvasSnapshot() {
    try {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            originalConsoleLog('❌ Game canvas not found');
            return;
        }
        
        // Create a temporary canvas with black background
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Fill with black background
        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw the game canvas on top
        tempCtx.drawImage(canvas, 0, 0);
        
        // Convert temporary canvas to blob
        tempCanvas.toBlob((blob) => {
            if (!blob) {
                originalConsoleLog('❌ Failed to create canvas snapshot');
                return;
            }
            
            if (navigator.clipboard && navigator.clipboard.write) {
                const item = new ClipboardItem({ 'image/png': blob });
                navigator.clipboard.write([item]).then(() => {
                    originalConsoleLog('📸 Canvas snapshot copied to clipboard!');
                    
                    const indicator = document.createElement('div');
                    indicator.style.cssText = `
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        padding: 20px 40px;
                        background: rgba(0, 128, 255, 0.9);
                        color: white;
                        font-size: 24px;
                        font-weight: bold;
                        border-radius: 10px;
                        z-index: 10000;
                    `;
                    indicator.textContent = '📸 Screenshot copied!';
                    document.body.appendChild(indicator);
                    setTimeout(() => indicator.remove(), 2000);
                }).catch((err) => {
                    originalConsoleLog('❌ Failed to copy canvas snapshot:', err);
                });
            } else {
                originalConsoleLog('❌ Clipboard API not supported');
            }
        }, 'image/png');
    } catch (err) {
        originalConsoleLog('❌ Error capturing canvas snapshot:', err);
    }
}

// Export functions
window.GameDebug = {
    copyLogsToClipboard,
    captureCanvasSnapshot,
    getLogQueue: () => logQueue,
    clearLogs: () => { logQueue = []; },
    originalConsoleLog
};
