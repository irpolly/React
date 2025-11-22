import React, { useRef, useEffect, useCallback } from 'react';
import { GameState, LevelData, Platform, Enemy, Collectible, Particle, SpriteFrame } from '../types';
import { PHYSICS, TILE_SIZE, WORLD_HEIGHT, PALETTE, CAT_VARIANTS, SPRITE_CORGI_IDLE, SPRITE_CORGI_RUN_1, SPRITE_CORGI_JUMP, SPRITE_CORGI_LEAP_UP, SPRITE_CORGI_LEAP_DOWN, SPRITE_CAT, SPRITE_CAT_WALK, SPRITE_BONE, SPRITE_DOGHOUSE, SPRITE_CORGI_BITE, SPRITE_HEART, SPRITE_TENNIS_BALL, SPRITE_SPIKE } from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  levelData: LevelData;
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  lives: number;
  setLives: React.Dispatch<React.SetStateAction<number>>;
}

const hexToRgba = (hex: string, alpha: number) => {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => {
        return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})` : hex;
};

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  setGameState,
  levelData,
  score,
  setScore,
  lives,
  setLives
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraX = useRef(0);

  // Game Objects Refs (Mutable state for game loop performance)
  const player = useRef({
    x: 100,
    y: 400,
    vx: 0,
    vy: 0,
    width: 55, // Updated for new longer sprite (22 * 2.5)
    height: 35, 
    grounded: false,
    facingRight: true,
    frameTimer: 0,
    invulnerableUntil: 0,
    isAttacking: false,
    attackCooldown: 0,
    attackTimer: 0
  });

  const keys = useRef<{ [key: string]: boolean }>({});
  const platforms = useRef<Platform[]>([]);
  const enemies = useRef<Enemy[]>([]);
  const collectibles = useRef<Collectible[]>([]);
  const tennisBalls = useRef<Collectible[]>([]); 
  const obstacles = useRef<{x: number, y: number, width: number, height: number}[]>([]);
  const particles = useRef<Particle[]>([]);
  const animationFrameId = useRef<number>(0);
  const goalRef = useRef({ x: 0, y: 0, width: 48, height: 48 });
  
  // Visual Depth Refs
  const bgLayers = useRef<{x: number, y: number, width: number, height: number, color: string, parallax: number}[]>([]);
  const fgLayers = useRef<{x: number, y: number, width: number, height: number, color: string, parallax: number}[]>([]);

  // Initialize Level
  useEffect(() => {
    if (gameState === GameState.PLAYING || gameState === GameState.MENU) {
        // Reset Player
        player.current = {
            x: 100,
            y: 400,
            vx: 0,
            vy: 0,
            width: 55,
            height: 35, 
            grounded: false,
            facingRight: true,
            frameTimer: 0,
            invulnerableUntil: 0,
            isAttacking: false,
            attackCooldown: 0,
            attackTimer: 0
        };

        // Map Level Data to Game Objects
        platforms.current = levelData.platforms.map(p => ({ 
            ...p, 
            height: TILE_SIZE 
        }));

        // Prepare enemies with robust ground snapping
        enemies.current = levelData.enemies.map((e, i) => {
            const width = 48; 
            const height = 42; 
            const centerX = e.x + width / 2;
            
            const groundPlat = platforms.current
                .filter(p => centerX >= p.x && centerX <= p.x + p.width && p.y >= e.y - 100) 
                .sort((a, b) => a.y - b.y)[0]; 
            
            const finalY = groundPlat ? groundPlat.y - height : e.y - height;

            return {
                id: `e-${i}`,
                x: e.x,
                y: finalY, 
                width: width,
                height: height,
                vx: 2,
                type: e.type,
                patrolStart: e.x - 100,
                patrolEnd: e.x + 100,
                variant: Math.floor(Math.random() * 4)
            };
        });

        collectibles.current = levelData.collectibles.map((c, i) => ({
            id: `c-${i}`,
            x: c.x,
            y: c.y,
            width: 24,
            height: 24,
            collected: false,
            type: 'bone'
        }));

        if (levelData.tennisBalls) {
            tennisBalls.current = levelData.tennisBalls.map((t, i) => ({
                id: `tb-${i}`,
                x: t.x,
                y: t.y,
                width: 24,
                height: 24,
                collected: false,
                type: 'star'
            }));
        } else {
            tennisBalls.current = [];
        }

        const providedObstacles = (levelData.obstacles || []).map(o => ({
            x: o.x,
            y: o.y - 48, 
            width: 48,
            height: 48
        }));

        const autoSpikes: {x: number, y: number, width: number, height: number}[] = [];
        levelData.platforms.forEach(plat => {
            const platCenter = plat.x + plat.width / 2;
            if (Math.abs(platCenter - 100) < 200) return; 
            if (levelData.goal && 
                levelData.goal.x > plat.x - 50 && levelData.goal.x < plat.x + plat.width + 50 &&
                Math.abs(levelData.goal.y - plat.y) < 50) return;

            const hasEnemy = levelData.enemies.some(e => 
                e.x > plat.x - 40 && e.x < plat.x + plat.width + 40 && Math.abs(e.y - plat.y) < 80
            );
            if (hasEnemy) return;

            const hasCollectible = levelData.collectibles.some(c =>
                c.x > plat.x - 20 && c.x < plat.x + plat.width + 20 && Math.abs(c.y - plat.y) < 50
            );
            if (hasCollectible) return;

            const hasObstacle = (levelData.obstacles || []).some(o =>
                o.x > plat.x - 20 && o.x < plat.x + plat.width + 20 && Math.abs(o.y - plat.y) < 50
            );
            if (hasObstacle) return;
            
            if (plat.width >= 60 && Math.random() < 0.25) {
                autoSpikes.push({
                    x: platCenter - 24, 
                    y: plat.y - 48,     
                    width: 48,
                    height: 48
                });
            }
        });

        obstacles.current = [...providedObstacles, ...autoSpikes];

        if (levelData.goal) {
            const goalHeight = SPRITE_DOGHOUSE.height * 3.0;
            const goalWidth = SPRITE_DOGHOUSE.width * 3.0;
            goalRef.current = {
                x: levelData.goal.x,
                y: levelData.goal.y - goalHeight,
                width: goalWidth, 
                height: goalHeight
            };
        } else {
             goalRef.current = { x: 0, y: 0, width: 0, height: 0 };
        }
        
        // Generate Background Layers
        const bgObjs = [];
        const fgObjs = [];
        const worldEnd = levelData.goal ? levelData.goal.x + 1000 : 5000;
        
        // Far Background (Parallax 0.2) - Lighter, faded mountains
        for (let i = -200; i < worldEnd; i += Math.random() * 300 + 200) {
            bgObjs.push({
                x: i,
                y: WORLD_HEIGHT - (Math.random() * 300 + 100),
                width: Math.random() * 400 + 200,
                height: 600,
                color: hexToRgba(levelData.groundColor, 0.3), // Faded
                parallax: 0.2
            });
        }

        // Mid Background (Parallax 0.5) - Slightly darker hills
        for (let i = -100; i < worldEnd; i += Math.random() * 200 + 150) {
            bgObjs.push({
                x: i,
                y: WORLD_HEIGHT - (Math.random() * 200 + 50),
                width: Math.random() * 300 + 100,
                height: 600,
                color: hexToRgba(levelData.groundColor, 0.5), // More visible
                parallax: 0.5
            });
        }
        bgLayers.current = bgObjs;

        // Foreground (Parallax 1.2) - Fast moving bushes/rocks
        for (let i = 0; i < worldEnd; i += Math.random() * 800 + 400) {
            fgObjs.push({
                x: i,
                y: WORLD_HEIGHT - (Math.random() * 30 + 20),
                width: Math.random() * 60 + 40,
                height: 60,
                color: hexToRgba('#1a1a1a', 0.3), // Dark silhouette
                parallax: 1.2
            });
        }
        fgLayers.current = fgObjs;

        particles.current = [];
        cameraX.current = 0;
    }
  }, [levelData, gameState]);


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
    sprite: SpriteFrame,
    x: number,
    y: number,
    scale: number,
    facingRight: boolean,
    paletteOverride?: Record<number, string>
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
            
            // Use override color if available, otherwise default palette
            const color = paletteOverride?.[colIndex] || PALETTE[colIndex];

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

  const createFirework = (x: number, y: number) => {
      const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      for(let i=0; i<20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 8 + 2;
          particles.current.push({
              id: Math.random().toString(),
              x, y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 2.0, 
              color,
              size: Math.random() * 4 + 2
          });
      }
  };

  const respawnPlayer = () => {
      player.current.x = 100;
      player.current.y = 400;
      player.current.vx = 0;
      player.current.vy = 0;
      cameraX.current = 0;
      setLives(prev => prev - 1);
  };

  const takeDamage = (fromX: number) => {
      const p = player.current;
      const now = Date.now();
      if (now > p.invulnerableUntil) {
          setLives(l => l - 1);
          p.invulnerableUntil = now + 2000; 
          p.vy = -5;
          p.vx = (p.x < fromX) ? -8 : 8;
          createExplosion(p.x, p.y, '#ECA758');
      }
  };

  // --- GAME LOOP ---
  const update = useCallback(() => {
    const now = Date.now();

    if (gameState === GameState.LEVEL_COMPLETE) {
        if (Math.random() < 0.05) { 
            const fx = cameraX.current + Math.random() * 800;
            const fy = Math.random() * 300 + 50;
            createFirework(fx, fy);
        }
        particles.current.forEach(pt => {
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.life -= 0.02;
            pt.vy += 0.1; 
        });
        particles.current = particles.current.filter(pt => pt.life > 0);
        return;
    }

    if (gameState !== GameState.PLAYING) return;
    
    const p = player.current;

    if (lives <= 0) {
        setGameState(GameState.GAME_OVER);
        return;
    }

    if (p.attackCooldown > 0) p.attackCooldown--;
    if (p.attackTimer > 0) p.attackTimer--;
    else p.isAttacking = false;

    if ((keys.current['KeyZ'] || keys.current['KeyK']) && p.attackCooldown <= 0) {
        p.isAttacking = true;
        p.attackTimer = 15; 
        p.attackCooldown = 30; 
    }

    if (keys.current['ArrowRight'] || keys.current['KeyD']) {
        if (p.vx < 6) p.vx += PHYSICS.speed;
        p.facingRight = true;
    } else if (keys.current['ArrowLeft'] || keys.current['KeyA']) {
        if (p.vx > -6) p.vx -= PHYSICS.speed;
        p.facingRight = false;
    } else {
        p.vx *= PHYSICS.friction;
    }

    p.x += p.vx;

    if (p.x < 0) { p.x = 0; p.vx = 0; }

    for (const plat of platforms.current) {
        if (
            p.x < plat.x + plat.width &&
            p.x + p.width > plat.x &&
            p.y < plat.y + plat.height &&
            p.y + p.height > plat.y
        ) {
            if (p.vx > 0) { 
                p.x = plat.x - p.width;
                p.vx = 0;
            } else if (p.vx < 0) {
                p.x = plat.x + plat.width;
                p.vx = 0;
            }
        }
    }

    const isJumpPressed = keys.current['Space'] || keys.current['ArrowUp'] || keys.current['KeyW'];
    if (isJumpPressed && p.grounded) {
        p.vy = PHYSICS.jumpForce;
        p.grounded = false;
        createExplosion(p.x + p.width/2, p.y + p.height, '#FFF');
    }
    
    if (!p.grounded && p.vy < 0 && !isJumpPressed) {
        p.vy *= 0.9;
    }

    p.vy += PHYSICS.gravity;
    p.y += p.vy;
    p.grounded = false; 

    for (const plat of platforms.current) {
        if (
            p.x < plat.x + plat.width &&
            p.x + p.width > plat.x &&
            p.y < plat.y + plat.height &&
            p.y + p.height > plat.y
        ) {
            if (p.vy > 0) {
                p.y = plat.y - p.height;
                p.vy = 0;
                p.grounded = true;
            } else if (p.vy < 0) {
                p.y = plat.y + plat.height;
                p.vy = 0;
            }
        }
    }

    enemies.current.forEach(enemy => {
        let nextX = enemy.x + enemy.vx;
        let shouldTurn = false;

        const hitWall = platforms.current.some(plat => 
            nextX < plat.x + plat.width &&
            nextX + enemy.width > plat.x &&
            enemy.y + 2 < plat.y + plat.height && 
            enemy.y + enemy.height - 2 > plat.y
        );

        if (hitWall) shouldTurn = true;

        if (!shouldTurn) {
            const lookAheadX = enemy.vx > 0 ? nextX + enemy.width : nextX;
            const lookAheadY = enemy.y + enemy.height + 4;

            const hasGround = platforms.current.some(plat => 
                lookAheadX >= plat.x &&
                lookAheadX <= plat.x + plat.width &&
                lookAheadY >= plat.y && 
                lookAheadY <= plat.y + plat.height
            );

            if (!hasGround) shouldTurn = true;
        }
        
        if (shouldTurn) {
            enemy.vx *= -1;
        } else {
            enemy.x = nextX;
        }

        let attackHit = false;
        if (p.isAttacking) {
            const range = 30;
            const attackX = p.facingRight ? p.x + p.width : p.x - range;
            const attackRect = { x: attackX, y: p.y, width: range, height: p.height };
            
            if (
                attackRect.x < enemy.x + enemy.width &&
                attackRect.x + attackRect.width > enemy.x &&
                attackRect.y < enemy.y + enemy.height &&
                attackRect.y + attackRect.height > enemy.y
            ) {
                attackHit = true;
            }
        }

        if (attackHit) {
             createExplosion(enemy.x, enemy.y, '#9CA3AF');
             enemies.current = enemies.current.filter(e => e.id !== enemy.id);
             setScore(prev => prev + 150);
        } else if (
            p.x < enemy.x + enemy.width &&
            p.x + p.width > enemy.x &&
            p.y < enemy.y + enemy.height &&
            p.y + p.height > enemy.y
        ) {
            if (p.vy > 0 && p.y + p.height - p.vy < enemy.y + enemy.height * 0.6) {
                createExplosion(enemy.x, enemy.y, '#9CA3AF');
                enemies.current = enemies.current.filter(e => e.id !== enemy.id);
                p.vy = -8; 
                setScore(prev => prev + 100);
            } else {
                takeDamage(enemy.x);
            }
        }
    });

    obstacles.current.forEach(obs => {
        if (
            p.x + 10 < obs.x + obs.width - 10 && 
            p.x + p.width - 10 > obs.x + 10 &&
            p.y + 10 < obs.y + obs.height &&
            p.y + p.height > obs.y + 10
        ) {
            takeDamage(obs.x);
        }
    });

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

    tennisBalls.current.forEach(tb => {
        if (!tb.collected &&
            p.x < tb.x + tb.width &&
            p.x + p.width > tb.x &&
            p.y < tb.y + tb.height &&
            p.y + p.height > tb.y
        ) {
            tb.collected = true;
            setLives(l => l + 1);
            setScore(prev => prev + 200);
            createExplosion(tb.x, tb.y, '#CCFF00');
        }
    });

    const g = goalRef.current;
    if (
        p.x < g.x + g.width &&
        p.x + p.width > g.x &&
        p.y < g.y + g.height &&
        p.y + p.height > g.y
    ) {
        setGameState(GameState.LEVEL_COMPLETE);
    }

    particles.current.forEach(pt => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= 0.05;
    });
    particles.current = particles.current.filter(pt => pt.life > 0);

    const targetCamX = p.x - 300; 
    cameraX.current += (targetCamX - cameraX.current) * 0.1;

    if (p.y > WORLD_HEIGHT + 100) {
        respawnPlayer();
    }

  }, [gameState, setGameState, setScore, setLives, lives, drawVoxelSprite]);


  // --- MAIN DRAW LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
        if (gameState === GameState.PLAYING || gameState === GameState.LEVEL_COMPLETE) update();

        // 1. Sky Gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, levelData.backgroundColor);
        gradient.addColorStop(1, '#e0f7fa'); // Fade to light cyan/white at bottom
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Background Layers (Parallax)
        const camX = Math.max(0, cameraX.current);
        
        // Far Layer
        bgLayers.current.forEach(bg => {
            // Simple Parallax Calc
            const x = bg.x - (camX * bg.parallax);
            // Optim: Only draw if on screen
            if (x + bg.width > 0 && x < canvas.width) {
                ctx.fillStyle = bg.color;
                // Draw stepped mountain/hill
                ctx.fillRect(x, bg.y, bg.width, bg.height);
                // Add a highlight edge
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(x, bg.y, 10, bg.height);
            }
        });

        ctx.save();
        ctx.translate(-camX, 0);

        // 3. Platforms (Main Layer)
        levelData.platforms.forEach(plat => {
            // Draw Deep Earth with Gradient for Depth
            const earthGrad = ctx.createLinearGradient(0, plat.y, 0, plat.y + 200);
            earthGrad.addColorStop(0, levelData.groundColor);
            earthGrad.addColorStop(1, 'rgba(0,0,0,0.8)'); // Fade to dark
            ctx.fillStyle = earthGrad;
            ctx.fillRect(plat.x, plat.y, plat.width, 200); 
            
            // Side/Shadow on right edge for blockiness
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(plat.x + plat.width - 8, plat.y, 8, 200);

            // Draw Top Layer
            ctx.fillStyle = plat.type === 'grass' ? '#4CAF50' : 
                            plat.type === 'stone' ? '#757575' : 
                            plat.type === 'lava' ? '#FF5722' : '#FFFFFF';
            ctx.fillRect(plat.x, plat.y, plat.width, 8);
            
            // Top Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(plat.x, plat.y, plat.width, 2);
        });
        
        // Draw Obstacles
        obstacles.current.forEach(o => {
            drawVoxelSprite(ctx, SPRITE_SPIKE, o.x, o.y, 3.0, true);
        });

        // Draw Collectibles
        collectibles.current.forEach(c => {
            if (c.collected) return;
            const bob = Math.sin(Date.now() / 200) * 5;
            drawVoxelSprite(ctx, SPRITE_BONE, c.x, c.y + bob, 3, true);
        });

        tennisBalls.current.forEach(tb => {
            if (tb.collected) return;
            const bob = Math.cos(Date.now() / 200) * 5;
            drawVoxelSprite(ctx, SPRITE_TENNIS_BALL, tb.x, tb.y + bob, 3, true);
        });

        const g = goalRef.current;
        drawVoxelSprite(ctx, SPRITE_DOGHOUSE, g.x, g.y, 3.0, true);

        enemies.current.forEach(e => {
            if (e.type === 'cat') {
              const isWalkingFrame = Math.floor(Date.now() / 150) % 2 === 0;
              const sprite = (Math.abs(e.vx) > 0 && isWalkingFrame) ? SPRITE_CAT_WALK : SPRITE_CAT;
              const variantPalette = CAT_VARIANTS[e.variant];
              drawVoxelSprite(ctx, sprite, e.x, e.y, 3.0, e.vx > 0, variantPalette);
            }
        });

        const p = player.current;
        p.frameTimer++;
        
        let drawPlayer = true;
        if (Date.now() < p.invulnerableUntil) {
            if (Math.floor(Date.now() / 100) % 2 === 0) drawPlayer = false;
        }

        if (gameState === GameState.PLAYING || gameState === GameState.LEVEL_COMPLETE || gameState === GameState.GAME_OVER) {
             if (drawPlayer) {
                let sprite = SPRITE_CORGI_IDLE;
                if (p.isAttacking) {
                    sprite = SPRITE_CORGI_BITE;
                } else if (!p.grounded) {
                    if (p.vy < -1) sprite = SPRITE_CORGI_LEAP_UP;
                    else if (p.vy > 1) sprite = SPRITE_CORGI_LEAP_DOWN;
                    else sprite = SPRITE_CORGI_JUMP; 
                } else if (Math.abs(p.vx) > 0.1 && Math.floor(p.frameTimer / 10) % 2 === 0) {
                    sprite = SPRITE_CORGI_RUN_1;
                }
                
                drawVoxelSprite(ctx, sprite, p.x, p.y, 2.5, p.facingRight);
            }
        }

        particles.current.forEach(pt => {
            ctx.globalAlpha = Math.max(0, pt.life);
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
            ctx.globalAlpha = 1.0;
        });

        ctx.restore();

        // 4. Foreground (Parallax 1.2) - Drawn on top of everything
        fgLayers.current.forEach(fg => {
             const x = fg.x - (camX * fg.parallax);
             if (x + fg.width > 0 && x < canvas.width) {
                 ctx.fillStyle = fg.color;
                 // Simple bush shape
                 ctx.beginPath();
                 ctx.arc(x + fg.width/2, fg.y + fg.height/2, fg.width/2, 0, Math.PI * 2);
                 ctx.fill();
             }
        });
        
        // HUD
        if (gameState === GameState.PLAYING) {
            for (let i = 0; i < lives; i++) {
                drawVoxelSprite(ctx, SPRITE_TENNIS_BALL, 760 - (i * 32), 20, 3.0, true);
            }
        }

        animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId.current);
  }, [gameState, update, levelData, drawVoxelSprite, lives]);

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
