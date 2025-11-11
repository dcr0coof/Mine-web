// 游戏配置
const DIFFICULTIES = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard: { rows: 16, cols: 30, mines: 99 }
};

// 游戏状态
let gameState = {
    board: [],
    revealed: [],
    flagged: [],
    mines: [],
    gameOver: false,
    gameWon: false,
    firstClick: true,
    timer: 0,
    timerInterval: null
};

let currentDifficulty = 'medium';

// DOM 元素
const gameBoard = document.getElementById('gameBoard');
const mineCountEl = document.getElementById('mineCount');
const timerEl = document.getElementById('timer');
const restartBtn = document.getElementById('restartBtn');
const difficultySelect = document.getElementById('difficulty');
const gameStatusEl = document.getElementById('gameStatus');

// 初始化游戏
function initGame() {
    const config = DIFFICULTIES[currentDifficulty];
    
    // 重置游戏状态
    gameState = {
        board: [],
        revealed: new Set(),
        flagged: new Set(),
        mines: [],
        gameOver: false,
        gameWon: false,
        firstClick: true,
        timer: 0,
        timerInterval: null
    };
    
    // 创建空棋盘
    gameState.board = Array(config.rows).fill(null).map(() => 
        Array(config.cols).fill(0)
    );
    
    // 清空状态显示
    gameStatusEl.textContent = '';
    gameStatusEl.className = 'game-status';
    
    // 更新UI
    updateMineCount();
    updateTimer();
    renderBoard();
    
    // 停止之前的计时器
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
}

// 生成雷区（在第一次点击后）
function generateMines(excludeRow, excludeCol) {
    const config = DIFFICULTIES[currentDifficulty];
    const totalCells = config.rows * config.cols;
    const mines = [];
    
    // 生成雷的位置（排除第一次点击的位置及其周围）
    const excludeSet = new Set();
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = excludeRow + dr;
            const c = excludeCol + dc;
            if (r >= 0 && r < config.rows && c >= 0 && c < config.cols) {
                excludeSet.add(`${r},${c}`);
            }
        }
    }
    
    while (mines.length < config.mines) {
        const row = Math.floor(Math.random() * config.rows);
        const col = Math.floor(Math.random() * config.cols);
        const key = `${row},${col}`;
        
        if (!excludeSet.has(key) && !mines.some(m => m[0] === row && m[1] === col)) {
            mines.push([row, col]);
            gameState.board[row][col] = -1; // -1 表示雷
        }
    }
    
    gameState.mines = mines;
    
    // 计算每个格子的数字
    for (let row = 0; row < config.rows; row++) {
        for (let col = 0; col < config.cols; col++) {
            if (gameState.board[row][col] !== -1) {
                gameState.board[row][col] = countAdjacentMines(row, col);
            }
        }
    }
}

// 计算周围雷的数量
function countAdjacentMines(row, col) {
    const config = DIFFICULTIES[currentDifficulty];
    let count = 0;
    
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            
            const r = row + dr;
            const c = col + dc;
            
            if (r >= 0 && r < config.rows && c >= 0 && c < config.cols) {
                if (gameState.board[r][c] === -1) {
                    count++;
                }
            }
        }
    }
    
    return count;
}

// 渲染棋盘
function renderBoard() {
    const config = DIFFICULTIES[currentDifficulty];
    gameBoard.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;
    gameBoard.innerHTML = '';
    
    for (let row = 0; row < config.rows; row++) {
        for (let col = 0; col < config.cols; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            const cellKey = `${row},${col}`;
            const isRevealed = gameState.revealed.has(cellKey);
            const isFlagged = gameState.flagged.has(cellKey);
            
            if (isRevealed) {
                cell.classList.add('revealed');
                const value = gameState.board[row][col];
                if (value === -1) {
                    cell.classList.add('mine');
                } else if (value > 0) {
                    cell.classList.add(`number-${value}`);
                    cell.textContent = value;
                }
            } else if (isFlagged) {
                cell.classList.add('flagged');
            }
            
            // 事件监听
            cell.addEventListener('click', () => handleCellClick(row, col));
            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                handleCellRightClick(row, col);
            });
            
            gameBoard.appendChild(cell);
        }
    }
}

// 处理左键点击
function handleCellClick(row, col) {
    if (gameState.gameOver || gameState.gameWon) return;
    
    const cellKey = `${row},${col}`;
    
    // 如果已标记或已揭示，忽略
    if (gameState.flagged.has(cellKey) || gameState.revealed.has(cellKey)) {
        return;
    }
    
    // 第一次点击时生成雷区
    if (gameState.firstClick) {
        generateMines(row, col);
        gameState.firstClick = false;
        startTimer();
    }
    
    // 揭示格子
    revealCell(row, col);
    
    // 检查游戏状态
    checkGameState();
}

// 处理右键点击（标记）
function handleCellRightClick(row, col) {
    if (gameState.gameOver || gameState.gameWon) return;
    
    const cellKey = `${row},${col}`;
    
    // 如果已揭示，忽略
    if (gameState.revealed.has(cellKey)) {
        return;
    }
    
    // 切换标记状态
    if (gameState.flagged.has(cellKey)) {
        gameState.flagged.delete(cellKey);
    } else {
        gameState.flagged.add(cellKey);
    }
    
    updateMineCount();
    renderBoard();
}

// 揭示格子
function revealCell(row, col) {
    const config = DIFFICULTIES[currentDifficulty];
    const cellKey = `${row},${col}`;
    
    // 边界检查
    if (row < 0 || row >= config.rows || col < 0 || col >= config.cols) {
        return;
    }
    
    // 如果已揭示或已标记，返回
    if (gameState.revealed.has(cellKey) || gameState.flagged.has(cellKey)) {
        return;
    }
    
    // 添加到已揭示集合
    gameState.revealed.add(cellKey);
    
    // 如果是雷，游戏结束
    if (gameState.board[row][col] === -1) {
        gameState.gameOver = true;
        revealAllMines();
        stopTimer();
        gameStatusEl.textContent = '💥 游戏失败！';
        gameStatusEl.className = 'game-status lose';
        return;
    }
    
    // 如果是0，递归揭示周围格子
    if (gameState.board[row][col] === 0) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                revealCell(row + dr, col + dc);
            }
        }
    }
    
    renderBoard();
}

// 揭示所有雷
function revealAllMines() {
    gameState.mines.forEach(([row, col]) => {
        const cellKey = `${row},${col}`;
        if (!gameState.flagged.has(cellKey)) {
            gameState.revealed.add(cellKey);
        }
    });
    renderBoard();
}

// 检查游戏状态
function checkGameState() {
    const config = DIFFICULTIES[currentDifficulty];
    const totalCells = config.rows * config.cols;
    const revealedCount = gameState.revealed.size;
    
    // 如果揭示的格子数 = 总格子数 - 雷数，则获胜
    if (revealedCount === totalCells - config.mines) {
        gameState.gameWon = true;
        stopTimer();
        gameStatusEl.textContent = '🎉 恭喜获胜！';
        gameStatusEl.className = 'game-status win';
        
        // 标记所有雷
        gameState.mines.forEach(([row, col]) => {
            const cellKey = `${row},${col}`;
            if (!gameState.flagged.has(cellKey)) {
                gameState.flagged.add(cellKey);
            }
        });
        updateMineCount();
        renderBoard();
    }
}

// 更新剩余雷数显示
function updateMineCount() {
    const config = DIFFICULTIES[currentDifficulty];
    const flaggedCount = gameState.flagged.size;
    const remaining = config.mines - flaggedCount;
    mineCountEl.textContent = remaining;
}

// 开始计时器
function startTimer() {
    gameState.timer = 0;
    updateTimer();
    gameState.timerInterval = setInterval(() => {
        gameState.timer++;
        updateTimer();
    }, 1000);
}

// 停止计时器
function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

// 更新计时器显示
function updateTimer() {
    timerEl.textContent = gameState.timer;
}

// 重新开始游戏
restartBtn.addEventListener('click', () => {
    stopTimer();
    initGame();
});

// 难度切换
difficultySelect.addEventListener('change', (e) => {
    currentDifficulty = e.target.value;
    stopTimer();
    initGame();
});

// 初始化游戏
initGame();

