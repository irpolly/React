import React, { useState, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameState, LevelData } from './types';
import { DEFAULT_LEVEL } from './constants';
import { generateLevel } from './services/geminiService';
import { Loader2, Play, Skull, Wand2, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [levelData, setLevelData] = useState<LevelData>(DEFAULT_LEVEL);
  const [prompt, setPrompt] = useState("A spooky graveyard with floating islands");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGameState(GameState.GENERATING);
    
    const newLevel = await generateLevel(prompt);
    setLevelData(newLevel);
    setIsGenerating(false);
    setGameState(GameState.MENU);
  };

  const startGame = () => {
    setGameState(GameState.PLAYING);
  };

  return (
    <div className="relative w-full h-screen flex items-center justify-center bg-neutral-900 text-white overflow-hidden select-none">
      
      {/* Game Container */}
      <div className="relative w-full max-w-[800px] aspect-[4/3] bg-black rounded-xl shadow-2xl overflow-hidden border-4 border-neutral-700">
        <GameCanvas 
            gameState={gameState} 
            setGameState={setGameState} 
            levelData={levelData}
            score={score}
            setScore={setScore}
        />

        {/* UI Overlay: HUD */}
        {gameState === GameState.PLAYING && (
            <div className="absolute top-4 left-4 flex gap-4 font-pixel text-xl text-white drop-shadow-md pointer-events-none">
                <div className="bg-black/50 px-3 py-1 rounded">SCORE: {score}</div>
            </div>
        )}

        {/* UI Overlay: Menu */}
        {gameState === GameState.MENU && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 z-10">
                <h1 className="font-pixel text-4xl md:text-5xl text-yellow-400 mb-2 text-center leading-tight">
                    VOXEL CORGI<br/><span className="text-white text-2xl">ADVENTURE</span>
                </h1>
                <p className="text-neutral-400 mb-8 font-sans text-center max-w-md">
                    Use Arrow Keys or WASD to Move. Space to Jump. Collect bones and stomp slimes!
                </p>

                <button 
                    onClick={startGame}
                    className="group relative px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-pixel text-lg rounded shadow-[0px_4px_0px_0px_rgba(20,83,45,1)] active:shadow-none active:translate-y-1 transition-all flex items-center gap-2 mb-8"
                >
                    <Play className="w-6 h-6 fill-current" />
                    PLAY GAME
                </button>

                <div className="w-full max-w-md bg-neutral-800/80 p-4 rounded-lg border border-neutral-700">
                    <div className="flex items-center gap-2 mb-2 text-sm text-neutral-300 font-semibold">
                        <Wand2 className="w-4 h-4 text-purple-400" />
                        AI LEVEL GENERATOR
                    </div>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe a level..."
                            className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                        />
                        <button 
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center min-w-[100px]"
                        >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : "GENERATE"}
                        </button>
                    </div>
                    <p className="text-xs text-neutral-500 mt-2">
                        Powered by Gemini. Try "Ice Kingdom" or "Volcano Base".
                    </p>
                </div>
            </div>
        )}

        {/* UI Overlay: Generating */}
        {gameState === GameState.GENERATING && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-20">
                <Loader2 className="w-16 h-16 text-purple-500 animate-spin mb-4" />
                <h2 className="font-pixel text-2xl text-white">BUILDING WORLD...</h2>
                <p className="text-neutral-400 mt-2">Constructing platforms and summoning slimes</p>
            </div>
        )}

        {/* UI Overlay: Game Over */}
        {gameState === GameState.GAME_OVER && (
            <div className="absolute inset-0 bg-red-900/90 backdrop-blur-md flex flex-col items-center justify-center z-20 text-center">
                <Skull className="w-24 h-24 text-red-300 mb-4 animate-bounce" />
                <h2 className="font-pixel text-4xl text-white mb-2">GAME OVER</h2>
                <p className="font-pixel text-xl text-yellow-300 mb-8">FINAL SCORE: {score}</p>
                
                <div className="flex gap-4">
                    <button 
                        onClick={() => setGameState(GameState.MENU)}
                        className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded border border-neutral-600 transition-colors"
                    >
                        MAIN MENU
                    </button>
                    <button 
                        onClick={startGame}
                        className="px-6 py-3 bg-white text-black hover:bg-gray-200 font-bold rounded shadow-lg flex items-center gap-2 transition-colors"
                    >
                        <RefreshCw className="w-5 h-5" />
                        TRY AGAIN
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* Footer / Controls Hint */}
      <div className="absolute bottom-4 text-neutral-500 text-xs">
         React + Canvas + Gemini API • Voxel Corgi Engine v1.0
      </div>
    </div>
  );
};

export default App;