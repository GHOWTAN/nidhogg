import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import UIOverlay from './components/UIOverlay';

const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  const [winCommentary, setWinCommentary] = useState("");
  const [gameKey, setGameKey] = useState(0); // Used to force remount for full reset
  const [gameMode, setGameMode] = useState<'pvp' | 'cpu'>('pvp');

  const handleGameOver = (winnerId: 1 | 2, commentary: string) => {
    setWinner(winnerId);
    setWinCommentary(commentary);
    setGameOver(true);
  };

  const restartGame = () => {
    setGameOver(false);
    setWinner(null);
    setGameKey(prev => prev + 1);
  };

  const handleStart = (mode: 'pvp' | 'cpu') => {
      setGameMode(mode);
      setGameStarted(true);
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="relative">
        {/* We mount GameCanvas only when started to ensure focus and init */}
        {gameStarted && (
           <GameCanvas 
             key={gameKey} 
             onGameOver={handleGameOver} 
             gameMode={gameMode}
           />
        )}
        
        {/* Placeholder for when game hasn't started to keep layout size */}
        {!gameStarted && (
             <div className="w-[800px] h-[450px] bg-black border-4 border-gray-800 flex items-center justify-center">
                 <p className="text-gray-700 font-mono">ARENA CLOSED</p>
             </div>
        )}

        <UIOverlay 
            gameStarted={gameStarted} 
            onStart={handleStart} 
            gameOver={gameOver}
            winner={winner}
            winCommentary={winCommentary}
            onRestart={restartGame}
        />
      </div>
    </div>
  );
};

export default App;