import React from 'react';
import { COLORS } from '../constants';

interface UIOverlayProps {
    gameStarted: boolean;
    onStart: (mode: 'pvp' | 'cpu') => void;
    gameOver: boolean;
    winner: 1 | 2 | null;
    winCommentary: string;
    onRestart: () => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ 
    gameStarted, 
    onStart, 
    gameOver, 
    winner, 
    winCommentary,
    onRestart 
}) => {
  if (!gameStarted) {
    return (
      <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white p-8 z-10 font-sans">
        <h1 className="text-6xl font-extrabold mb-2 text-yellow-500 tracking-tighter italic transform -skew-x-6">GLADIUS II</h1>
        <p className="text-xl text-gray-400 mb-8 tracking-widest uppercase">Hyper-Lethal Fencing</p>
        
        <div className="grid grid-cols-2 gap-16 mb-8 text-sm bg-gray-900/50 p-8 rounded-xl border border-gray-800">
          <div className="text-center">
            <h3 className="text-yellow-400 font-bold mb-4 text-lg border-b border-yellow-400/30 pb-2">PLAYER 1</h3>
            <div className="space-y-2 text-left pl-8">
                <p><span className="text-gray-400 w-24 inline-block">MOVE</span> <span className="font-mono text-white">WASD</span></p>
                <p><span className="text-gray-400 w-24 inline-block">JUMP</span> <span className="font-mono text-white">G</span></p>
                <p><span className="text-gray-400 w-24 inline-block">ATTACK</span> <span className="font-mono text-white">F</span></p>
                <div className="mt-4 pt-4 border-t border-gray-800">
                     <p className="text-xs text-gray-500 mb-1">ADVANCED:</p>
                     <p><span className="text-yellow-200">THROW</span> <span className="text-xs ml-2">UP + ATK</span></p>
                     <p><span className="text-yellow-200">ROLL</span> <span className="text-xs ml-2">DOWN + JUMP</span></p>
                     <p><span className="text-yellow-200">DIVE KICK</span> <span className="text-xs ml-2">AIR + DOWN + ATK</span></p>
                </div>
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-orange-500 font-bold mb-4 text-lg border-b border-orange-500/30 pb-2">PLAYER 2 / CPU</h3>
             <div className="space-y-2 text-left pl-8">
                <p><span className="text-gray-400 w-24 inline-block">MOVE</span> <span className="font-mono text-white">ARROWS</span></p>
                <p><span className="text-gray-400 w-24 inline-block">JUMP</span> <span className="font-mono text-white">.</span></p>
                <p><span className="text-gray-400 w-24 inline-block">ATTACK</span> <span className="font-mono text-white">,</span></p>
                <div className="mt-4 pt-4 border-t border-gray-800">
                     <p className="text-xs text-gray-500 mb-1">ADVANCED:</p>
                     <p><span className="text-orange-200">THROW</span> <span className="text-xs ml-2">UP + ATK</span></p>
                     <p><span className="text-orange-200">ROLL</span> <span className="text-xs ml-2">DOWN + JUMP</span></p>
                     <p><span className="text-orange-200">DIVE KICK</span> <span className="text-xs ml-2">AIR + DOWN + ATK</span></p>
                </div>
            </div>
          </div>
        </div>

        <div className="text-center space-y-1 text-gray-500 text-xs mb-6">
             <p>Match stance to block. Blocked attacks push you back.</p>
             <p>Pick up swords by pressing <span className="font-bold text-white">DOWN</span> over them.</p>
        </div>
        
        <div className="flex gap-6">
            <button 
              onClick={() => onStart('cpu')}
              className="px-8 py-4 bg-gray-800 text-white font-black text-xl hover:bg-orange-500 hover:scale-105 transition-all transform skew-x-[-10deg] border border-gray-600"
            >
              1 PLAYER
            </button>
            <button 
              onClick={() => onStart('pvp')}
              className="px-8 py-4 bg-white text-black font-black text-xl hover:bg-yellow-400 hover:scale-105 transition-all transform skew-x-[-10deg] shadow-lg shadow-yellow-900/20"
            >
              2 PLAYERS
            </button>
        </div>
      </div>
    );
  }

  if (gameOver && winner) {
    return (
      <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center text-white p-8 z-10 text-center animate-fade-in">
        <h2 
            className="text-8xl font-black mb-6 tracking-tighter"
            style={{ color: winner === 1 ? COLORS.P1 : COLORS.P2, textShadow: '0 0 20px rgba(255,255,255,0.3)' }}
        >
            {winner === 1 ? 'YELLOW' : 'ORANGE'} WINS
        </h2>
        <div className="max-w-lg bg-gray-900 p-8 border border-gray-700 rounded-lg mb-10 shadow-2xl">
            <p className="text-gray-400 text-xs uppercase mb-4 tracking-widest">The Serpent's Decree</p>
            <p className="text-2xl italic font-serif text-yellow-100 leading-relaxed">
                "{winCommentary}"
            </p>
        </div>
        <button 
          onClick={onRestart}
          className="px-8 py-4 bg-gray-800 hover:bg-white hover:text-black transition-all font-bold text-xl tracking-widest border border-gray-600 hover:border-white"
        >
          AGAIN
        </button>
      </div>
    );
  }

  return null;
};

export default UIOverlay;