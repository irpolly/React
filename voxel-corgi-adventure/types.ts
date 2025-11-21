export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  GENERATING = 'GENERATING'
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
  type: 'cat' | 'bat';
  patrolStart: number;
  patrolEnd: number;
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
  enemies: { x: number; y: number; type: 'cat' | 'bat' }[];
  collectibles: { x: number; y: number }[];
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