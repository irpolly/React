
import React, { useRef, useEffect, useCallback } from 'react';
import { GameState, LevelData, Platform, Enemy, Collectible, Particle } from '../types';
import { PHYSICS, TILE_SIZE, WORLD_HEIGHT, PALETTE, SPRITE_CORGI_IDLE, SPRITE_CORGI_RUN_1, SPRITE_CORGI_JUMP, SPRITE_CORGI_LEAP_UP, SPRITE_CORGI_LEAP_DOWN, SPRITE_CAT, SPRITE_CAT_WALK, SPRITE_BONE, SPRITE_DOGHOUSE, SPRITE_CORGI_BITE, SPRITE_HEART, SPRITE_TENNIS_BALL, SPRITE_SPIKE } from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  levelData: LevelData;
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  lives: number;
  setLives: React.Dispatch<React.SetStateAction<number>>;
}

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
  const tennisBalls = useRef<Collectible[]>([]); // Reusing Collectible interface
  const obstacles = useRef<{x: number, y: number, width: number, height: number}[]>([]);
  const particles = useRef<Particle[]>([]);
  const animationFrameId = useRef<number>(0);
  const goalRef = useRef({ x: 0, y: 0, width: 48, height: 48 });

  // Initialize Level
  useEffect(() => {
    if (gameState === GameState.PLAYING || gameState === GameState.MENU) {
        // Reset Player (but don't fully reset physics if checking lives, handled in respawn logic)
        player.current = {
            x: 100,
            y: 400,
            vx: 0,
            vy: 0,
            width: 55, // Updated width
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
            height: TILE_SIZE // Platforms are always at least 1 tile high for collision
        }));

        enemies.current = levelData.enemies.map((e, i) => ({
            id: `e-${i}`,
            x: e.x,
            y: e.y - 42, // Offset Y by height (14*3) so they sit ON TOP of the platform
            width: 48, // 16 * 3.0 scale
            height: 42, // 14 * 3.0 scale
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

        if (levelData.tennisBalls) {
            tennisBalls.current = levelData.tennisBalls.map((t, i) => ({
                id: `tb-${i}`,
                x: t.x,
                y: t.y,
                width: 24,
                height: 24,
                collected: false,
                type: 'star' // Placeholder type, visuals handled by renderer
            }));
        } else {
            tennisBalls.current = [];
        }

        // Load provided obstacles (usually ground spikes)
        const providedObstacles = (levelData.obstacles || []).map(o => ({
            x: o.x,
            y: o.y - 48, // Sit on top of surface (16*3 = 48). Input o.y is the surface Y.
            width: 48,
            height: 48
        }));

        // Procedurally add spikes to empty platforms
        const autoSpikes: {x: number, y: number, width: number, height: number}[] = [];
        levelData.platforms.forEach(plat => {
            const platCenter = plat.x + plat.width / 2;

            // 1. Check if near Start
            if (Math.abs(platCenter - 100) < 200) return; 

            // 2. Check if Goal is on this platform
            if (levelData.goal && 
                levelData.goal.x > plat.x - 50 && levelData.goal.x < plat.x + plat.width + 50 &&
                Math.abs(levelData.goal.y - plat.y) < 50) return;

            // 3. Check Enemies
            const hasEnemy = levelData.enemies.some(e => 
                e.x > plat.x - 40 && e.x < plat.x + plat.width + 40 && Math.abs(e.y - plat.y) < 80
            );
            if (hasEnemy) return;

            // 4. Check Collectibles
            const hasCollectible = levelData.collectibles.some(c =>
                c.x > plat.x - 20 && c.x < plat.x + plat.width + 20 && Math.abs(c.y - plat.y) < 50
            );
            if (hasCollectible) return;

            // 5. Check Existing Obstacles
            const hasObstacle = (levelData.obstacles || []).some(o =>
                o.x > plat.x - 20 && o.x < plat.x + plat.width + 20 && Math.abs(o.y - plat.y) < 50
            );
            if (hasObstacle) return;
            
            // Platform is empty, add spike if it's wide enough (Reduced probability)
            if (plat.width >= 60 && Math.random() < 0.25) {
                autoSpikes.push({
                    x: platCenter - 24, // Center the 48px spike
                    y: plat.y - 48,     // Sit on top of platform
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
                y: levelData.goal.y - goalHeight, // Adjust to sit on ground
                width: goalWidth, 
                height: goalHeight
            };
        } else {
            // Fallback goal if not provided
             goalRef.current = { x: 0, y: 0, width: 0, height: 0 };
        }
        
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
              life: 2.0, // Longer life for fireworks
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
          p.invulnerableUntil = now + 2000; // 2s invulnerability
          // Knockback
          p.vy = -5;
          p.vx = (p.x < fromX) ? -8 : 8;
          createExplosion(p.x, p.y, '#ECA758');
      }
  };

  // --- GAME LOOP ---
  const update = useCallback(() => {
    const now = Date.now();

    // --- FIREWORKS (Level Complete) ---
    if (gameState === GameState.LEVEL_COMPLETE) {
        if (Math.random() < 0.05) { // 5% chance per frame
            const fx = cameraX.current + Math.random() * 800;
            const fy = Math.random() * 300 + 50;
            createFirework(fx, fy);
        }
        // Still update particles
        particles.current.forEach(pt => {
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.life -= 0.02;
            pt.vy += 0.1; // Gravity for particles
        });
        particles.current = particles.current.filter(pt => pt.life > 0);
        return;
    }

    if (gameState !== GameState.PLAYING) return;
    
    const p = player.current;

    // Death Check (Lives)
    if (lives <= 0) {
        setGameState(GameState.GAME_OVER);
        return;
    }

    // --- 0. ATTACK INPUT ---
    if (p.attackCooldown > 0) p.attackCooldown--;
    if (p.attackTimer > 0) p.attackTimer--;
    else p.isAttacking = false;

    if ((keys.current['KeyZ'] || keys.current['KeyK']) && p.attackCooldown <= 0) {
        p.isAttacking = true;
        p.attackTimer = 15; // Attack lasts 15 frames
        p.attackCooldown = 30; // Cooldown
    }

    // --- 1. INPUT & HORIZONTAL MOVEMENT ---
    
    // Acceleration
    if (keys.current['ArrowRight'] || keys.current['KeyD']) {
        if (p.vx < 6) p.vx += PHYSICS.speed;
        p.facingRight = true;
    } else if (keys.current['ArrowLeft'] || keys.current['KeyA']) {
        if (p.vx > -6) p.vx -= PHYSICS.speed;
        p.facingRight = false;
    } else {
        p.vx *= PHYSICS.friction;
    }

    // Apply X Velocity
    p.x += p.vx;

    // World Bounds (Left)
    if (p.x < 0) { p.x = 0; p.vx = 0; }

    // --- 2. X-AXIS COLLISION ---
    for (const plat of platforms.current) {
        if (
            p.x < plat.x + plat.width &&
            p.x + p.width > plat.x &&
            p.y < plat.y + plat.height &&
            p.y + p.height > plat.y
        ) {
            // Horizontal collision
            // Determine direction based on velocity/centers
            if (p.vx > 0) { 
                // Moving right, hit left side
                p.x = plat.x - p.width;
                p.vx = 0;
            } else if (p.vx < 0) {
                // Moving left, hit right side
                p.x = plat.x + plat.width;
                p.vx = 0;
            }
        }
    }

    // --- 3. VERTICAL MOVEMENT & GRAVITY ---

    // Jump Input
    const isJumpPressed = keys.current['Space'] || keys.current['ArrowUp'] || keys.current['KeyW'];
    if (isJumpPressed && p.grounded) {
        p.vy = PHYSICS.jumpForce;
        p.grounded = false;
        createExplosion(p.x + p.width/2, p.y + p.height, '#FFF');
    }
    
    // Variable Jump Height Cutoff
    if (!p.grounded && p.vy < 0 && !isJumpPressed) {
        p.vy *= 0.9;
    }

    // Apply Gravity
    p.vy += PHYSICS.gravity;
    
    // Apply Y Velocity
    p.y += p.vy;
    p.grounded = false; // Assume falling until collision proves otherwise

    // --- 4. Y-AXIS COLLISION ---
    for (const plat of platforms.current) {
        if (
            p.x < plat.x + plat.width &&
            p.x + p.width > plat.x &&
            p.y < plat.y + plat.height &&
            p.y + p.height > plat.y
        ) {
            // Vertical collision
            if (p.vy > 0) {
                // Falling down, hit top
                p.y = plat.y - p.height;
                p.vy = 0;
                p.grounded = true;
            } else if (p.vy < 0) {
                // Jumping up, hit bottom
                p.y = plat.y + plat.height;
                p.vy = 0;
            }
        }
    }

    // --- 5. ENEMY LOGIC ---
    enemies.current.forEach(enemy => {
        let nextX = enemy.x + enemy.vx;
        let shouldTurn = false;

        // Check for Wall Collision
        const hitWall = platforms.current.some(plat => 
            nextX < plat.x + plat.width &&
            nextX + enemy.width > plat.x &&
            enemy.y + 2 < plat.y + plat.height && 
            enemy.y + enemy.height - 2 > plat.y
        );

        if (hitWall) shouldTurn = true;

        // Check for Ledges (Prevent falling off)
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

        // ATTACK HITBOX CALCULATION
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


        // COLLISION WITH PLAYER
        if (attackHit) {
             // Killed by Bite
             createExplosion(enemy.x, enemy.y, '#9CA3AF');
             enemies.current = enemies.current.filter(e => e.id !== enemy.id);
             setScore(prev => prev + 150);
        } else if (
            p.x < enemy.x + enemy.width &&
            p.x + p.width > enemy.x &&
            p.y < enemy.y + enemy.height &&
            p.y + p.height > enemy.y
        ) {
            // Mario Stomp Check
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

    // --- 6. OBSTACLES (Spikes) ---
    obstacles.current.forEach(obs => {
        if (
            p.x + 10 < obs.x + obs.width - 10 && // Tighter hitbox for spikes
            p.x + p.width - 10 > obs.x + 10 &&
            p.y + 10 < obs.y + obs.height &&
            p.y + p.height > obs.y + 10
        ) {
            // Spikes always hurt
            takeDamage(obs.x);
        }
    });

    // --- 7. COLLECTIBLES & GOAL ---
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

    // Tennis Balls (Extra Life)
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

    // Goal Check
    const g = goalRef.current;
    if (
        p.x < g.x + g.width &&
        p.x + p.width > g.x &&
        p.y < g.y + g.height &&
        p.y + p.height > g.y
    ) {
        setGameState(GameState.LEVEL_COMPLETE);
    }

    // --- 8. PARTICLES ---
    particles.current.forEach(pt => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= 0.05;
    });
    particles.current = particles.current.filter(pt => pt.life > 0);

    // --- 9. CAMERA ---
    const targetCamX = p.x - 300; 
    cameraX.current += (targetCamX - cameraX.current) * 0.1;

    // Death by falling
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

    // Animation Loop
    const render = () => {
        // If playing or level complete (for fireworks), run update
        if (gameState === GameState.PLAYING || gameState === GameState.LEVEL_COMPLETE) update();

        // Clear Background
        ctx.fillStyle = levelData.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        // Apply Camera
        const camX = Math.max(0, cameraX.current);
        ctx.translate(-camX, 0);

        // Draw Platforms
        levelData.platforms.forEach(plat => {
            // Fill solid color for "earth"
            ctx.fillStyle = levelData.groundColor;
            ctx.fillRect(plat.x, plat.y, plat.width, 200); // Extend deep for ground feel
            
            // Draw Top Layer
            ctx.fillStyle = plat.type === 'grass' ? '#4CAF50' : 
                            plat.type === 'stone' ? '#757575' : 
                            plat.type === 'lava' ? '#FF5722' : '#FFFFFF';
            ctx.fillRect(plat.x, plat.y, plat.width, 8);
        });
        
        // Note: Hardcoded ground render removed. Ground is now composed of platforms.

        // Draw Obstacles (Spikes)
        obstacles.current.forEach(o => {
            drawVoxelSprite(ctx, SPRITE_SPIKE, o.x, o.y, 3.0, true);
        });

        // Draw Collectibles
        collectibles.current.forEach(c => {
            if (c.collected) return;
            const bob = Math.sin(Date.now() / 200) * 5;
            drawVoxelSprite(ctx, SPRITE_BONE, c.x, c.y + bob, 3, true);
        });

        // Draw Tennis Balls (Extra Life)
        tennisBalls.current.forEach(tb => {
            if (tb.collected) return;
            const bob = Math.cos(Date.now() / 200) * 5;
            drawVoxelSprite(ctx, SPRITE_TENNIS_BALL, tb.x, tb.y + bob, 3, true);
        });

        // Draw Goal
        const g = goalRef.current;
        drawVoxelSprite(ctx, SPRITE_DOGHOUSE, g.x, g.y, 3.0, true);

        // Draw Enemies
        enemies.current.forEach(e => {
            if (e.type === 'cat') {
              // Walking animation
              const isWalkingFrame = Math.floor(Date.now() / 150) % 2 === 0;
              const sprite = (Math.abs(e.vx) > 0 && isWalkingFrame) ? SPRITE_CAT_WALK : SPRITE_CAT;
              drawVoxelSprite(ctx, sprite, e.x, e.y, 3.0, e.vx > 0);
            }
        });

        // Draw Player
        const p = player.current;
        p.frameTimer++;
        
        // Check Invulnerability Flashing
        let drawPlayer = true;
        if (Date.now() < p.invulnerableUntil) {
            if (Math.floor(Date.now() / 100) % 2 === 0) drawPlayer = false;
        }

        // Draw player only if playing or completing level
        if (gameState === GameState.PLAYING || gameState === GameState.LEVEL_COMPLETE || gameState === GameState.GAME_OVER) {
             if (drawPlayer) {
                let sprite = SPRITE_CORGI_IDLE;
                if (p.isAttacking) {
                    sprite = SPRITE_CORGI_BITE;
                } else if (!p.grounded) {
                    // Angled Leap Logic
                    if (p.vy < -1) sprite = SPRITE_CORGI_LEAP_UP;
                    else if (p.vy > 1) sprite = SPRITE_CORGI_LEAP_DOWN;
                    else sprite = SPRITE_CORGI_JUMP; // Neutral air
                } else if (Math.abs(p.vx) > 0.1 && Math.floor(p.frameTimer / 10) % 2 === 0) {
                    sprite = SPRITE_CORGI_RUN_1;
                }
                
                drawVoxelSprite(ctx, sprite, p.x, p.y, 2.5, p.facingRight);
            }
        }

        // Draw Particles
        particles.current.forEach(pt => {
            ctx.globalAlpha = Math.max(0, pt.life);
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
            ctx.globalAlpha = 1.0;
        });

        ctx.restore();
        
        // Draw HUD (Lives - Now Tennis Balls)
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