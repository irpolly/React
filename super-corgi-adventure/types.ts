
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  GENERATING = 'GENERATING',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE'
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'grass' | 'stone' | 'cloud' | 'lava';
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  type: 'cat' | 'bat' | 'squirrel' | 'rat';
  patrolStart: number;
  patrolEnd: number;
  variant: number; // 0: Grey, 1: White, 2: Tuxedo, 3: Brown
  attackCooldown?: number; // For shooting enemies
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  type: 'nut';
}

export interface Collectible {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  collected: boolean;
  type: 'bone' | 'star';
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface LevelData {
  themeName: string;
  backgroundColor: string;
  groundColor: string;
  platforms: Omit<Platform, 'height'>[]; // Height is standardized
  enemies: { x: number; y: number; type: 'cat' | 'bat' | 'squirrel' | 'rat' }[];
  obstacles: { x: number; y: number; type: 'spike' }[];
  collectibles: { x: number; y: number }[];
  tennisBalls: { x: number; y: number }[];
  goal: { x: number; y: number };
}

export interface SpriteFrame {
  width: number;
  height: number;
  pixels: number[][]; // Color indices
}

export interface PhysicsConfig {
  gravity: number;
  friction: number;
  speed: number;
  jumpForce: number;
}
