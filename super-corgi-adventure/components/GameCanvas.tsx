
import React, { useRef, useEffect, useCallback } from 'react';
import { GameState, LevelData, Platform, Enemy, Collectible, Particle, SpriteFrame, Projectile } from '../types';
import { PHYSICS, TILE_SIZE, WORLD_HEIGHT, PALETTE, CAT_VARIANTS, SPRITE_CORGI_IDLE, SPRITE_CORGI_RUN_1, SPRITE_CORGI_JUMP, SPRITE_CORGI_LEAP_UP, SPRITE_CORGI_LEAP_DOWN, SPRITE_CAT, SPRITE_CAT_WALK, SPRITE_BONE, SPRITE_DOGHOUSE, SPRITE_CORGI_ATK_1, SPRITE_CORGI_ATK_2, SPRITE_HEART, SPRITE_TENNIS_BALL, SPRITE_SPIKE, SPRITE_SQUIRREL, SPRITE_SQUIRREL_IDLE_1, SPRITE_SQUIRREL_IDLE_2, SPRITE_SQUIRREL_SHOOT, SPRITE_NUT, SPRITE_RAT, SPRITE_BAT, SPRITE_BEAR_WALK_1, SPRITE_BEAR_WALK_2, SPRITE_BEAR_ATTACK } from '../constants';

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

  // Game Objects Refs
  const player = useRef({
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
    attackTimer: 0,
    checkpointX: 100,
    checkpointY: 400
  });

  const keys = useRef<{ [key: string]: boolean }>({});
  const platforms = useRef<Platform[]>([]);
  const enemies = useRef<Enemy[]>([]);
  const projectiles = useRef<Projectile[]>([]);
  const collectibles = useRef<Collectible[]>([]);
  const tennisBalls = useRef<Collectible[]>([]); 
  const obstacles = useRef<{x: number, y: number, width: number, height: number}[]>([]);
  const particles = useRef<Particle[]>([]);
  const animationFrameId = useRef<number>(0);
  const goalRef = useRef({ x: 0, y: 0, width: 48, height: 48 });
  
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
            attackTimer: 0,
            checkpointX: 100,
            checkpointY: 400
        };

        platforms.current = levelData.platforms.map(p => ({ 
            ...p, 
            height: TILE_SIZE 
        }));

        enemies.current = levelData.enemies.map((e, i) => {
            let width = 48;
            let height = 42;
            let vx = 2;
            let hp = 1;
            let maxHp = 1;

            if (e.type === 'squirrel') {
                width = SPRITE_SQUIRREL.width * 2.0;
                height = SPRITE_SQUIRREL.height * 2.0;
                vx = 0;
            } else if (e.type === 'rat') {
                width = SPRITE_RAT.width * 3.0; 
                height = SPRITE_RAT.height * 3.0; 
                vx = 4; 
            } else if (e.type === 'bat') {
                width = SPRITE_BAT.width * 3.0; 
                height = SPRITE_BAT.height * 3.0; 
                vx = 3; 
            } else if (e.type === 'bear') {
                width = SPRITE_BEAR_WALK_1.width * 3.0; // 96px
                height = SPRITE_BEAR_WALK_1.height * 3.0; // 96px
                vx = 1; // Slow start
                hp = 25; // Boss Health (Buffed)
                maxHp = 25;
            }
            
            const centerX = e.x + width / 2;
            let finalY = e.y - height;

            // Snap ground enemies
            if (e.type !== 'bat') {
                const groundPlat = platforms.current
                    .filter(p => centerX >= p.x && centerX <= p.x + p.width && p.y >= e.y - 100) 
                    .sort((a, b) => a.y - b.y)[0]; 
                
                if (groundPlat) finalY = groundPlat.y - height;
            }

            return {
                id: `e-${i}`,
                x: e.x,
                y: finalY, 
                width: width,
                height: height,
                vx: vx, 
                type: e.type,
                patrolStart: e.x - 100,
                patrolEnd: e.x + 100,
                variant: Math.floor(Math.random() * 4),
                attackCooldown: Math.random() * 200,
                hp,
                maxHp,
                hitTimer: 0
            };
        });

        projectiles.current = [];

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

        obstacles.current = [...providedObstacles];

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
        
        const bgObjs = [];
        const fgObjs = [];
        const worldEnd = levelData.goal ? levelData.goal.x + 1000 : 5000;
        
        for (let i = -200; i < worldEnd; i += Math.random() * 300 + 200) {
            bgObjs.push({
                x: i,
                y: WORLD_HEIGHT - (Math.random() * 300 + 100),
                width: Math.random() * 400 + 200,
                height: 600,
                color: hexToRgba(levelData.groundColor, 0.3), 
                parallax: 0.2
            });
        }

        for (let i = -100; i < worldEnd; i += Math.random() * 200 + 150) {
            bgObjs.push({
                x: i,
                y: WORLD_HEIGHT - (Math.random() * 200 + 50),
                width: Math.random() * 300 + 100,
                height: 600,
                color: hexToRgba(levelData.groundColor, 0.5), 
                parallax: 0.5
            });
        }
        bgLayers.current = bgObjs;

        for (let i = 0; i < worldEnd; i += Math.random() * 800 + 400) {
            fgObjs.push({
                x: i,
                y: WORLD_HEIGHT - (Math.random() * 3 + 20),
                width: Math.random() * 60 + 40,
                height: 60,
                color: hexToRgba('#1a1a1a', 0.3),
                parallax: 1.2
            });
        }
        fgLayers.current = fgObjs;

        particles.current = [];
        cameraX.current = 0;
    }
  }, [levelData, gameState]);


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


  const drawVoxelSprite = useCallback((
    ctx: CanvasRenderingContext2D,
    sprite: SpriteFrame,
    x: number,
    y: number,
    scale: number,
    facingRight: boolean,
    paletteOverride?: Record<number, string>,
    hitFlash?: boolean
  ) => {
    ctx.save();
    const pixelSize = scale;
    const width = sprite.width * pixelSize;
    
    if (!facingRight) {
        ctx.translate(x + width, y);
        ctx.scale(-1, 1);
        ctx.translate(-x, -y);
    }

    sprite.pixels.forEach((row, rI) => {
        row.forEach((colIndex, cI) => {
            if (colIndex === 0) return;
            
            const px = x + cI * pixelSize;
            const py = y + rI * pixelSize;
            
            let color = paletteOverride?.[colIndex] || PALETTE[colIndex];
            if (hitFlash) color = '#FFFFFF'; // Flash white when hit

            ctx.fillStyle = color;
            ctx.fillRect(px, py, pixelSize, pixelSize);

            if (!hitFlash) {
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(px + pixelSize - 2, py, 2, pixelSize);
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.fillRect(px, py + pixelSize - 2, pixelSize, 2);
            }
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
      const p = player.current;
      p.x = p.checkpointX;
      p.y = p.checkpointY;
      p.vx = 0;
      p.vy = 0;
      cameraX.current = Math.max(0, p.x - 300);
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

  // --- DAMAGE ENEMY HELPER ---
  const damageEnemy = (enemy: Enemy) => {
      if (enemy.hp !== undefined && enemy.hp > 1) {
          enemy.hp--;
          enemy.hitTimer = 10; // Flash for 10 frames
          createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#FFF');
          setScore(prev => prev + 50);
          
          // Knockback player if hitting a boss
          if (enemy.type === 'bear') {
              const p = player.current;
              p.vx = p.x < enemy.x + enemy.width/2 ? -10 : 10;
              p.vy = -6; // Default recoil, overridden by stomp logic if stomping
          }
      } else {
          createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#9CA3AF');
          enemies.current = enemies.current.filter(e => e.id !== enemy.id);
          setScore(prev => prev + (enemy.type === 'bear' ? 1000 : 150));
      }
  };

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

                // Checkpoint Logic
                if (plat.type !== 'lava') {
                    p.checkpointX = p.x;
                    p.checkpointY = p.y;
                }

            } else if (p.vy < 0) {
                p.y = plat.y + plat.height;
                p.vy = 0;
            }
        }
    }

    // --- ENEMY LOGIC ---
    enemies.current.forEach(enemy => {
        if (enemy.hitTimer && enemy.hitTimer > 0) enemy.hitTimer--;

        // Squirrel Logic
        if (enemy.type === 'squirrel') {
             const dx = p.x - enemy.x;
             const dy = (p.y + p.height / 2) - (enemy.y + 20); 
             const dist = Math.sqrt(dx * dx + dy * dy);
             
             if (enemy.attackCooldown !== undefined && enemy.attackCooldown > 0) {
                 enemy.attackCooldown--;
             } else {
                 if (dist < 700) { 
                     const projSpeed = 9; 
                     const gravity = 0.2; 
                     const timeToTarget = Math.abs(dx) / projSpeed; 
                     
                     let vy = (dy - 0.5 * gravity * timeToTarget * timeToTarget) / timeToTarget;
                     if (vy < -12) vy = -12; 
                     if (vy > 2) vy = 2; 

                     const vx = dx > 0 ? projSpeed : -projSpeed;

                     projectiles.current.push({
                         id: Math.random().toString(),
                         x: enemy.x + (dx > 0 ? enemy.width - 10 : 10), 
                         y: enemy.y + 25, 
                         vx: vx, 
                         vy: vy, 
                         width: 30, 
                         height: 30,
                         type: 'nut'
                     });
                     enemy.attackCooldown = 90 + Math.random() * 60;
                 }
             }
        }

        // Bat Logic
        if (enemy.type === 'bat') {
             enemy.x += enemy.vx;
             enemy.y += Math.sin(Date.now() / 200) * 2; 
             if (enemy.x > enemy.patrolEnd || enemy.x < enemy.patrolStart) {
                 enemy.vx *= -1;
             }
        }

        // Bear Logic (Boss)
        if (enemy.type === 'bear') {
            const dx = p.x - enemy.x;
            const dist = Math.abs(dx);
            
            // Aggro Speed calculation
            let speed = 1.0;
            if (dist < 300) speed = 4.5; // Charge!
            if (dist < 60) speed = 0;    // Stop to attack

            // Direction logic: face player
            const desiredDir = Math.sign(dx);

            // Calculate potential movement
            let nextX = enemy.x + desiredDir * speed;
            let moving = true;
            
            // Wall Check
            const hitWall = platforms.current.some(plat => 
                nextX < plat.x + plat.width &&
                nextX + enemy.width > plat.x &&
                enemy.y + 10 < plat.y + plat.height && 
                enemy.y + enemy.height - 10 > plat.y
            );

            if (hitWall) {
                moving = false; // Stop at wall
            } else {
                // Ledge/Ground Check
                const centerX = nextX + enemy.width / 2;
                const hasGround = platforms.current.some(plat => 
                    centerX >= plat.x && 
                    centerX <= plat.x + plat.width &&
                    enemy.y + enemy.height >= plat.y - 5 && 
                    enemy.y + enemy.height <= plat.y + 25 // Tolerance
                );
                
                if (!hasGround) {
                    // Check if just falling (gap) vs walking off edge
                    // For Boss, we generally don't want to walk off edges unless following player down
                    // Simple check: stop at edge
                    moving = false;
                }
            }

            if (moving) {
                enemy.x = nextX;
                enemy.vx = desiredDir * speed; // Store for animation/sprite flip
            } else {
                // Don't move X, but keep facing player direction for sprite
                enemy.vx = (dx > 0 ? 0.01 : -0.01); 
            }

            // Gravity/Y-Axis Logic
            let grounded = false;
            for (const plat of platforms.current) {
                const cx = enemy.x + enemy.width/2;
                 if (
                    cx >= plat.x && 
                    cx <= plat.x + plat.width &&
                    enemy.y + enemy.height >= plat.y - 5 && 
                    enemy.y + enemy.height <= plat.y + 25
                 ) {
                    if (enemy.y + enemy.height > plat.y) {
                        enemy.y = plat.y - enemy.height; // Snap up
                    }
                    grounded = true;
                    break;
                 }
            }

            if (!grounded) {
                enemy.y += 5; // Gravity
            }
        }

        // Cat/Rat Logic
        if (enemy.type === 'cat' || enemy.type === 'rat') {
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
        }

        // Collision with Player
        let attackHit = false;
        if (p.isAttacking) {
            const range = 40; // Increased range slightly
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
             damageEnemy(enemy);
        } else if (
            p.x < enemy.x + enemy.width &&
            p.x + p.width > enemy.x &&
            p.y < enemy.y + enemy.height &&
            p.y + p.height > enemy.y
        ) {
            // STOMP CHECK
            // For bear, be more generous (0.8) so if player is anywhere above the 'ankles' it counts as a stomp if falling
            const stompThreshold = enemy.type === 'bear' ? 0.85 : 0.6;

            if (p.vy > 0 && p.y + p.height - p.vy < enemy.y + enemy.height * stompThreshold) {
                damageEnemy(enemy);
                p.vy = -12; // Override recoil with a high jump/bounce
            } else {
                takeDamage(enemy.x);
            }
        }
    });

    projectiles.current.forEach((proj, idx) => {
        proj.x += proj.vx;
        proj.y += proj.vy;
        proj.vy += 0.2; 

        if (
            p.x < proj.x + proj.width &&
            p.x + p.width > proj.x &&
            p.y < proj.y + proj.height &&
            p.y + p.height > proj.y
        ) {
             takeDamage(proj.x);
             projectiles.current.splice(idx, 1);
             createExplosion(proj.x, proj.y, '#8B4513');
             return;
        }

        const hitGround = platforms.current.some(plat => 
            proj.x < plat.x + plat.width &&
            proj.x + proj.width > plat.x &&
            proj.y < plat.y + plat.height &&
            proj.y + proj.height > plat.y
        );

        if (hitGround || proj.y > WORLD_HEIGHT) {
            projectiles.current.splice(idx, 1);
             if (hitGround) createExplosion(proj.x, proj.y, '#8B4513');
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
    // Check if Boss is Active
    const bossAlive = enemies.current.some(e => e.type === 'bear');
    
    if (
        p.x < g.x + g.width &&
        p.x + p.width > g.x &&
        p.y < g.y + g.height &&
        p.y + p.height > g.y
    ) {
        if (bossAlive) {
            // Locked!
            if (p.vx > 0) p.x -= 5;
        } else {
            setGameState(GameState.LEVEL_COMPLETE);
        }
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

        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, levelData.backgroundColor);
        gradient.addColorStop(1, levelData.themeName.includes("Under") ? '#000000' : '#e0f7fa'); 
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const camX = Math.max(0, cameraX.current);
        
        bgLayers.current.forEach(bg => {
            const x = bg.x - (camX * bg.parallax);
            if (x + bg.width > 0 && x < canvas.width) {
                ctx.fillStyle = bg.color;
                ctx.fillRect(x, bg.y, bg.width, bg.height);
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(x, bg.y, 10, bg.height);
            }
        });

        ctx.save();
        ctx.translate(-camX, 0);

        levelData.platforms.forEach(plat => {
            const earthGrad = ctx.createLinearGradient(0, plat.y, 0, plat.y + 200);
            earthGrad.addColorStop(0, levelData.groundColor);
            earthGrad.addColorStop(1, 'rgba(0,0,0,0.8)'); 
            ctx.fillStyle = earthGrad;
            ctx.fillRect(plat.x, plat.y, plat.width, 200); 
            
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(plat.x + plat.width - 8, plat.y, 8, 200);

            ctx.fillStyle = plat.type === 'grass' ? '#4CAF50' : 
                            plat.type === 'stone' ? '#757575' : 
                            plat.type === 'lava' ? '#FF5722' : '#FFFFFF';
            ctx.fillRect(plat.x, plat.y, plat.width, 8);
            
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(plat.x, plat.y, plat.width, 2);
        });
        
        obstacles.current.forEach(o => {
            drawVoxelSprite(ctx, SPRITE_SPIKE, o.x, o.y, 3.0, true);
        });

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
        
        // DRAW BOSS LOCK
        const bossAlive = enemies.current.some(e => e.type === 'bear');
        if (bossAlive) {
            const lockX = g.x + g.width / 2 - 12;
            const lockY = g.y + g.height / 2;
            
            // Draw Padlock Icon (Simple rects)
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(lockX, lockY, 24, 20); // Body
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(lockX + 12, lockY, 8, Math.PI, 0);
            ctx.stroke();
            
            // Draw Keyhole
            ctx.fillStyle = '#300';
            ctx.fillRect(lockX + 10, lockY + 8, 4, 8);

            // Floating Text
            ctx.font = '16px "Press Start 2P"';
            ctx.fillStyle = '#FFF';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 4;
            ctx.strokeText("DEFEAT BOSS", g.x - 30, g.y - 20);
            ctx.fillText("DEFEAT BOSS", g.x - 30, g.y - 20);
        }

        const p = player.current;

        enemies.current.forEach(e => {
            if (e.type === 'cat') {
              const isWalkingFrame = Math.floor(Date.now() / 150) % 2 === 0;
              const sprite = (Math.abs(e.vx) > 0 && isWalkingFrame) ? SPRITE_CAT_WALK : SPRITE_CAT;
              const variantPalette = CAT_VARIANTS[e.variant];
              drawVoxelSprite(ctx, sprite, e.x, e.y, 3.0, e.vx > 0, variantPalette, e.hitTimer > 0);
            } else if (e.type === 'rat') {
                const isWalkingFrame = Math.floor(Date.now() / 100) % 2 === 0; 
                drawVoxelSprite(ctx, SPRITE_RAT, e.x, e.y + (isWalkingFrame ? -2 : 0), 3.0, e.vx > 0, undefined, e.hitTimer > 0);
            } else if (e.type === 'bat') {
                const isFlap = Math.floor(Date.now() / 100) % 2 === 0;
                drawVoxelSprite(ctx, SPRITE_BAT, e.x, e.y + (isFlap ? -4 : 0), 3.0, e.vx > 0, undefined, e.hitTimer > 0);
            } else if (e.type === 'squirrel') {
                const facingPlayer = p.x > e.x;
                let sprite = SPRITE_SQUIRREL_IDLE_1;
                if (e.attackCooldown && e.attackCooldown > (90 + 40)) { 
                    sprite = SPRITE_SQUIRREL_SHOOT;
                } else {
                    const isFrame2 = Math.floor(Date.now() / 300) % 2 === 0;
                    sprite = isFrame2 ? SPRITE_SQUIRREL_IDLE_2 : SPRITE_SQUIRREL_IDLE_1;
                }
                drawVoxelSprite(ctx, sprite, e.x, e.y, 2.0, facingPlayer, undefined, e.hitTimer > 0);
            } else if (e.type === 'bear') {
                const dx = p.x - e.x;
                const facingPlayer = dx > 0;
                const dist = Math.abs(dx);
                let sprite = SPRITE_BEAR_WALK_1;
                
                if (dist < 60) {
                     sprite = SPRITE_BEAR_ATTACK;
                } else {
                     const isFrame2 = Math.floor(Date.now() / 200) % 2 === 0;
                     sprite = isFrame2 ? SPRITE_BEAR_WALK_2 : SPRITE_BEAR_WALK_1;
                }
                // Scale 3.0 for boss size
                drawVoxelSprite(ctx, sprite, e.x, e.y, 3.0, facingPlayer, undefined, e.hitTimer > 0);
            }
        });

        projectiles.current.forEach(proj => {
            drawVoxelSprite(ctx, SPRITE_NUT, proj.x, proj.y, 3.0, true);
        });

        p.frameTimer++;
        
        let drawPlayer = true;
        if (Date.now() < p.invulnerableUntil) {
            if (Math.floor(Date.now() / 100) % 2 === 0) drawPlayer = false;
        }

        if (gameState === GameState.PLAYING || gameState === GameState.LEVEL_COMPLETE || gameState === GameState.GAME_OVER) {
             if (drawPlayer) {
                let sprite = SPRITE_CORGI_IDLE;
                let xOffset = 0;

                if (p.isAttacking) {
                    // BITE ANIMATION
                    if (p.attackTimer > 7) {
                        sprite = SPRITE_CORGI_ATK_1; // Mouth Open
                        xOffset = p.facingRight ? 4 : -4; // Lunge forward visual
                    } else {
                        sprite = SPRITE_CORGI_ATK_2; // Chomp
                    }
                } else if (!p.grounded) {
                    if (p.vy < -1) sprite = SPRITE_CORGI_LEAP_UP;
                    else if (p.vy > 1) sprite = SPRITE_CORGI_LEAP_DOWN;
                    else sprite = SPRITE_CORGI_JUMP; 
                } else if (Math.abs(p.vx) > 0.1 && Math.floor(p.frameTimer / 10) % 2 === 0) {
                    sprite = SPRITE_CORGI_RUN_1;
                }
                
                drawVoxelSprite(ctx, sprite, p.x + xOffset, p.y, 2.5, p.facingRight);
            }
        }

        particles.current.forEach(pt => {
            ctx.globalAlpha = Math.max(0, pt.life);
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
            ctx.globalAlpha = 1.0;
        });

        ctx.restore();

        fgLayers.current.forEach(fg => {
             const x = fg.x - (camX * fg.parallax);
             if (x + fg.width > 0 && x < canvas.width) {
                 ctx.fillStyle = fg.color;
                 ctx.beginPath();
                 ctx.arc(x + fg.width/2, fg.y + fg.height/2, fg.width/2, 0, Math.PI * 2);
                 ctx.fill();
             }
        });
        
        // UI: BOSS BAR
        const activeBoss = enemies.current.find(e => e.type === 'bear' && Math.abs(e.x - p.x) < 800);
        if (gameState === GameState.PLAYING && activeBoss && activeBoss.hp !== undefined && activeBoss.maxHp !== undefined) {
            const barW = 400;
            const barH = 20;
            const barX = (canvas.width - barW) / 2;
            const barY = canvas.height - 50;
            const pct = activeBoss.hp / activeBoss.maxHp;
            
            ctx.fillStyle = '#000';
            ctx.fillRect(barX - 4, barY - 4, barW + 8, barH + 8);
            ctx.fillStyle = '#500';
            ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = '#F00';
            ctx.fillRect(barX, barY, barW * pct, barH);
            
            ctx.fillStyle = '#FFF';
            ctx.font = '16px "Press Start 2P"';
            ctx.fillText("ANGRY BEAR", barX, barY - 10);
        }

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
