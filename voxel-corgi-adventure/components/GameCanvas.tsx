import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, LevelData, Platform, Enemy, Collectible, Particle } from '../types';
import { PHYSICS, TILE_SIZE, WORLD_HEIGHT, PALETTE, SPRITE_CORGI_IDLE, SPRITE_CORGI_RUN_1, SPRITE_CORGI_JUMP, SPRITE_CAT, SPRITE_BONE } from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  levelData: LevelData;
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  setGameState,
  levelData,
  score,
  setScore
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraX = useRef(0);

  // Game Objects Refs (Mutable state for game loop performance)
  const player = useRef({
    x: 100,
    y: 400,
    vx: 0,
    vy: 0,
    width: 40,
    height: 34,
    grounded: false,
    facingRight: true,
    frameTimer: 0
  });

  const keys = useRef<{ [key: string]: boolean }>({});
  const platforms = useRef<Platform[]>([]);
  const enemies = useRef<Enemy[]>([]);
  const collectibles = useRef<Collectible[]>([]);
  const particles = useRef<Particle[]>([]);
  const animationFrameId = useRef<number>(0);

  // Initialize Level
  useEffect(() => {
    if (gameState === GameState.PLAYING || gameState === GameState.MENU) {
        // Reset Player
        player.current = {
            x: 100,
            y: 400,
            vx: 0,
            vy: 0,
            width: 40, // Scaled from sprite
            height: 34,
            grounded: false,
            facingRight: true,
            frameTimer: 0
        };

        // Map Level Data to Game Objects
        platforms.current = [
            // Ground floor
            { x: -200, y: 550, width: 4000, height: 200, type: 'grass' }, 
            ...levelData.platforms.map(p => ({ ...p, height: TILE_SIZE }))
        ];

        enemies.current = levelData.enemies.map((e, i) => ({
            id: `e-${i}`,
            x: e.x,
            y: e.y - 30, // Offset Y by height so they sit ON TOP of the platform, not inside it
            width: 36, // Adjusted for Cat Sprite
            height: 30,
            vx: 2,
            type: e.type,
            patrolStart: e.x - 100,
            patrolEnd: e.x + 100
        }));

        collectibles.current = levelData.collectibles.map((c, i) => ({
            id: `c-${i}`,
            x: c.x,
            y: c.y,
            width: 24,
            height: 24,
            collected: false,
            type: 'bone'
        }));
        
        particles.current = [];
        setScore(0);
        cameraX.current = 0;
    }
  }, [levelData, gameState, setScore]);


  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      if (e.code === 'Space' || e.code === 'ArrowUp') e.preventDefault();
      keys.current[e.code] = true; 
    };
    const handleKeyUp = (e: KeyboardEvent) => { 
      keys.current[e.code] = false; 
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);


  // --- RENDER HELPERS (Voxel Style) ---
  const drawVoxelSprite = useCallback((
    ctx: CanvasRenderingContext2D,
    sprite: typeof SPRITE_CORGI_IDLE,
    x: number,
    y: number,
    scale: number,
    facingRight: boolean
  ) => {
    ctx.save();
    const pixelSize = scale;
    
    // Calculate center for flipping
    const width = sprite.width * pixelSize;
    
    if (!facingRight) {
        ctx.translate(x + width, y);
        ctx.scale(-1, 1);
        ctx.translate(-x, -y);
    }

    sprite.pixels.forEach((row, rI) => {
        row.forEach((colIndex, cI) => {
            if (colIndex === 0) return; // Transparent
            
            const px = x + cI * pixelSize;
            const py = y + rI * pixelSize;
            const color = PALETTE[colIndex];

            // Main Face
            ctx.fillStyle = color;
            ctx.fillRect(px, py, pixelSize, pixelSize);

            // Voxel Depth Effect (Right and Bottom shadow)
            // Side Face (Right)
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(px + pixelSize - 2, py, 2, pixelSize);
            // Bottom Face
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(px, py + pixelSize - 2, pixelSize, 2);
        });
    });
    ctx.restore();
  }, []);


  const createExplosion = (x: number, y: number, color: string) => {
      for(let i=0; i<8; i++) {
          particles.current.push({
              id: Math.random().toString(),
              x, y,
              vx: (Math.random() - 0.5) * 10,
              vy: (Math.random() - 0.5) * 10,
              life: 1.0,
              color,
              size: Math.random() * 6 + 2
          });
      }
  };

  // --- GAME LOOP ---
  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;
    
    const p = player.current;

    // --- 1. INPUT & PHYSICS SETUP ---
    
    // X Movement
    if (keys.current['ArrowRight'] || keys.current['KeyD']) {
        if (p.vx < 6) p.vx += PHYSICS.speed;
        p.facingRight = true;
    } else if (keys.current['ArrowLeft'] || keys.current['KeyA']) {
        if (p.vx > -6) p.vx -= PHYSICS.speed;
        p.facingRight = false;
    } else {
        p.vx *= PHYSICS.friction;
    }

    // Jump Logic (Must happen before Position Update to ensure velocity isn't overwritten by collision immediately)
    const isJumpPressed = keys.current['Space'] || keys.current['ArrowUp'] || keys.current['KeyW'];
    if (isJumpPressed && p.grounded) {
        p.vy = PHYSICS.jumpForce;
        p.grounded = false;
        createExplosion(p.x + p.width/2, p.y + p.height, '#FFF');
    }
    // Variable Jump Height
    if (!p.grounded && p.vy < 0 && !isJumpPressed) {
        p.vy *= 0.9;
    }

    // --- 2. PHYSICS INTEGRATION ---

    // Apply X Velocity
    p.x += p.vx;

    // World Bounds (Left)
    if (p.x < 0) { p.x = 0; p.vx = 0; }

    // Apply Y Gravity & Velocity
    p.vy += PHYSICS.gravity;
    p.y += p.vy;

    // --- 3. COLLISION DETECTION ---
    p.grounded = false;
    
    for (const plat of platforms.current) {
        if (
            p.x < plat.x + plat.width &&
            p.x + p.width > plat.x &&
            p.y < plat.y + plat.height &&
            p.y + p.height > plat.y
        ) {
            // Collision detected. 
            // Determine direction.
            const dx = (p.x + p.width/2) - (plat.x + plat.width/2);
            const dy = (p.y + p.height/2) - (plat.y + plat.height/2);
            const width = (p.width + plat.width) / 2;
            const height = (p.height + plat.height) / 2;
            const crossWidth = width * dy;
            const crossHeight = height * dx;

            if (Math.abs(dx) <= width && Math.abs(dy) <= height) {
                if (crossWidth > crossHeight) {
                    if (crossWidth > -crossHeight) {
                        // Bottom collision
                        p.y = plat.y + plat.height;
                        p.vy = 0;
                    } else {
                        // Left collision
                        p.x = plat.x - p.width;
                        p.vx = 0;
                    }
                } else {
                    if (crossWidth > -crossHeight) {
                        // Right collision
                        p.x = plat.x + plat.width;
                        p.vx = 0;
                    } else {
                        // Top collision
                        p.y = plat.y - p.height;
                        p.vy = 0;
                        p.grounded = true;
                    }
                }
            }
        }
    }

    // --- 4. ENEMY LOGIC ---
    enemies.current.forEach(enemy => {
        let nextX = enemy.x + enemy.vx;
        let shouldTurn = false;

        // Check for Wall Collision
        // Added small buffer to Y check to prevent colliding with the floor the enemy is walking on
        const hitWall = platforms.current.some(plat => 
            nextX < plat.x + plat.width &&
            nextX + enemy.width > plat.x &&
            enemy.y + 2 < plat.y + plat.height && 
            enemy.y + enemy.height - 2 > plat.y
        );

        if (hitWall) {
            shouldTurn = true;
        }

        // Check for Ledges (Prevent falling off)
        if (!shouldTurn) {
            // Check the point directly ahead of feet
            const lookAheadX = enemy.vx > 0 ? nextX + enemy.width : nextX;
            const lookAheadY = enemy.y + enemy.height + 4; // Check slightly below

            const hasGround = platforms.current.some(plat => 
                lookAheadX >= plat.x &&
                lookAheadX <= plat.x + plat.width &&
                lookAheadY >= plat.y && 
                lookAheadY <= plat.y + plat.height
            );

            if (!hasGround) {
                shouldTurn = true;
            }
        }
        
        if (shouldTurn) {
            enemy.vx *= -1;
        } else {
            enemy.x = nextX;
        }

        // Player Collision
        if (
            p.x < enemy.x + enemy.width &&
            p.x + p.width > enemy.x &&
            p.y < enemy.y + enemy.height &&
            p.y + p.height > enemy.y
        ) {
            // Mario Stomp Check (falling downwards onto enemy)
            if (p.vy > 0 && p.y + p.height - p.vy < enemy.y + enemy.height * 0.6) {
                // Kill Enemy
                createExplosion(enemy.x, enemy.y, '#9CA3AF'); // Grey explosion for cat
                enemies.current = enemies.current.filter(e => e.id !== enemy.id);
                p.vy = -8; // Bounce
                setScore(prev => prev + 100);
            } else {
                // Kill Player
                setGameState(GameState.GAME_OVER);
                createExplosion(p.x, p.y, '#ECA758');
            }
        }
    });

    // --- 5. COLLECTIBLES ---
    collectibles.current.forEach(c => {
        if (!c.collected &&
            p.x < c.x + c.width &&
            p.x + p.width > c.x &&
            p.y < c.y + c.height &&
            p.y + p.height > c.y
        ) {
            c.collected = true;
            setScore(prev => prev + 50);
            createExplosion(c.x, c.y, '#F4F4F4');
        }
    });

    // --- 6. PARTICLES ---
    particles.current.forEach(pt => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= 0.05;
    });
    particles.current = particles.current.filter(pt => pt.life > 0);

    // --- 7. CAMERA ---
    // Smooth lerp
    const targetCamX = p.x - 300; // Keep player at roughly 300px form left
    cameraX.current += (targetCamX - cameraX.current) * 0.1;

    // Death by falling
    if (p.y > WORLD_HEIGHT + 100) {
        setGameState(GameState.GAME_OVER);
    }

  }, [gameState, setGameState, setScore, drawVoxelSprite]);


  // --- MAIN DRAW LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Animation Loop
    const render = () => {
        if (gameState === GameState.PLAYING) update();

        // Clear Background
        ctx.fillStyle = levelData.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        // Apply Camera
        // Clamp camera so it doesn't show left void
        const camX = Math.max(0, cameraX.current);
        ctx.translate(-camX, 0);

        // Draw Platforms
        levelData.platforms.forEach(plat => {
            // Simple voxel block
            ctx.fillStyle = levelData.groundColor;
            // Draw main block
            ctx.fillRect(plat.x, plat.y, plat.width, TILE_SIZE);
            // Top grass/detail
            ctx.fillStyle = plat.type === 'grass' ? '#4CAF50' : 
                            plat.type === 'stone' ? '#757575' : 
                            plat.type === 'lava' ? '#FF5722' : '#FFFFFF';
            ctx.fillRect(plat.x, plat.y, plat.width, 8);
        });
        
        // Draw Ground
        ctx.fillStyle = levelData.groundColor;
        ctx.fillRect(-200, 550, 4000, 200);
        ctx.fillStyle = '#4CAF50'; // Grass top
        ctx.fillRect(-200, 550, 4000, 10);


        // Draw Collectibles
        collectibles.current.forEach(c => {
            if (c.collected) return;
            // Bobbing animation
            const bob = Math.sin(Date.now() / 200) * 5;
            drawVoxelSprite(ctx, SPRITE_BONE, c.x, c.y + bob, 3, true);
        });

        // Draw Enemies
        enemies.current.forEach(e => {
            if (e.type === 'cat') {
              drawVoxelSprite(ctx, SPRITE_CAT, e.x, e.y, 3.0, e.vx > 0);
            }
        });

        // Draw Player
        const p = player.current;
        // Animate Sprite
        p.frameTimer++;
        
        let sprite = SPRITE_CORGI_IDLE;
        
        if (!p.grounded) {
            sprite = SPRITE_CORGI_JUMP;
        } else if (Math.abs(p.vx) > 0.1 && Math.floor(p.frameTimer / 10) % 2 === 0) {
            sprite = SPRITE_CORGI_RUN_1;
        }
        
        if (gameState === GameState.PLAYING || gameState === GameState.GAME_OVER) {
             drawVoxelSprite(ctx, sprite, p.x, p.y, 3.4, p.facingRight);
        }

        // Draw Particles
        particles.current.forEach(pt => {
            ctx.globalAlpha = pt.life;
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
            ctx.globalAlpha = 1.0;
        });

        ctx.restore();
        animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId.current);
  }, [gameState, update, levelData, drawVoxelSprite]);

  return (
    <canvas 
        ref={canvasRef} 
        width={800} 
        height={600} 
        className="w-full h-full object-cover image-pixelated"
        style={{ imageRendering: 'pixelated' }}
    />
  );
};