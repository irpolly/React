import { PhysicsConfig, SpriteFrame, LevelData } from './types';

// --- Physics ---
export const PHYSICS: PhysicsConfig = {
  gravity: 0.6,
  friction: 0.8,
  speed: 0.5, // Acceleration
  jumpForce: -14,
};

export const TILE_SIZE = 32;
export const WORLD_HEIGHT = 600;

// --- Colors ---
// 0: Transparent
// 1: Primary Fur (Orange)
// 2: Secondary Fur (White)
// 3: Eye/Nose (Black)
// 4: Shadow/Detail (Darker Orange)
// 5: Pink (Tongue/Ears)
// 6: Green (Slime)
// 7: Dark Green (Slime Shadow)
// 8: Red (Enemy Eye)
// 9: Bone White
// 10: Bone Shadow
// 11: Grey (Cat)
// 12: Dark Grey (Cat Shadow)
export const PALETTE: Record<number, string> = {
  0: 'transparent',
  1: '#ECA758', // Corgi Orange
  2: '#FFFFFF', // White
  3: '#1F1F1F', // Black
  4: '#C68235', // Dark Orange
  5: '#FF9999', // Pink
  6: '#88D662', // Slime Green
  7: '#569E36', // Slime Dark
  8: '#D93F3F', // Red
  9: '#F4F4F4', // Bone
  10: '#D1D1D1', // Bone Shadow
  11: '#9CA3AF', // Cat Grey
  12: '#4B5563'  // Cat Dark Grey
};

// --- Sprites (Voxel Maps) ---

// 12x10 Grid
export const SPRITE_CORGI_IDLE: SpriteFrame = {
  width: 12,
  height: 10,
  pixels: [
    [0,0,0,0,1,4,1,0,0,0,0,0],
    [0,0,0,1,1,5,1,1,0,0,0,0],
    [0,0,0,1,3,1,3,1,0,0,0,0], // Eyes
    [0,0,1,1,2,3,2,1,1,0,0,0], // Nose
    [0,1,1,2,2,2,2,2,1,1,0,0],
    [1,1,2,2,2,2,2,2,2,1,0,4], // Tail
    [1,2,2,2,2,2,2,2,2,1,4,4],
    [1,1,2,2,2,2,2,2,1,1,0,0],
    [0,1,1,0,0,0,0,1,1,0,0,0], // Legs
    [0,1,1,0,0,0,0,1,1,0,0,0]
  ]
};

export const SPRITE_CORGI_RUN_1: SpriteFrame = {
  width: 12,
  height: 10,
  pixels: [
    [0,0,0,0,1,4,1,0,0,0,0,0],
    [0,0,0,1,1,5,1,1,0,0,0,0],
    [0,0,0,1,3,1,3,1,0,0,0,0],
    [0,0,1,1,2,3,2,1,1,0,0,0],
    [0,1,1,2,2,2,2,2,1,1,0,4],
    [1,1,2,2,2,2,2,2,2,1,4,4],
    [1,2,2,2,2,2,2,2,2,1,0,0],
    [1,1,2,2,2,2,2,2,1,1,0,0],
    [0,1,1,0,0,0,1,1,0,0,0,0], // Legs moving
    [0,0,0,0,0,0,1,1,0,0,0,0]
  ]
};

export const SPRITE_CORGI_JUMP: SpriteFrame = {
  width: 12,
  height: 10,
  pixels: [
    [0,0,0,0,1,4,1,0,0,0,0,0],
    [0,0,0,1,1,5,1,1,0,0,0,0],
    [0,0,0,1,3,1,3,1,0,0,0,0],
    [0,0,1,1,2,3,2,1,1,0,0,0],
    [0,1,1,2,2,2,2,2,1,1,0,4], // Tail slightly up
    [1,1,2,2,2,2,2,2,2,1,4,4],
    [1,2,2,2,2,2,2,2,2,1,0,0],
    [0,0,1,1,0,0,0,0,1,1,0,0], // Legs tucked up
    [0,0,1,1,0,0,0,0,1,1,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0]
  ]
};

export const SPRITE_CAT: SpriteFrame = {
  width: 12,
  height: 10,
  pixels: [
    [0,0,0,11,0,0,0,11,0,0,0,0], // Pointy ears
    [0,0,11,11,11,11,11,11,11,0,0,0],
    [0,0,11,3,11,11,11,3,11,0,0,0], // Eyes
    [0,11,11,11,5,11,5,11,11,0,0,0], // Nose
    [11,11,11,11,11,11,11,11,11,11,12,0], // Tail up
    [11,11,11,11,11,11,11,11,11,11,12,12],
    [0,11,11,11,11,11,11,11,11,11,0,0],
    [0,11,11,0,0,0,0,11,11,0,0,0], // Legs
    [0,11,11,0,0,0,0,11,11,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0]
  ]
};

export const SPRITE_BONE: SpriteFrame = {
  width: 8,
  height: 8,
  pixels: [
    [0,0,9,9,0,9,9,0],
    [0,9,9,9,9,9,9,9],
    [0,9,9,10,10,9,9,9],
    [0,0,9,9,9,9,0,0],
    [0,0,9,9,9,9,0,0],
    [0,9,9,10,10,9,9,9],
    [0,9,9,9,9,9,9,9],
    [0,0,9,9,0,9,9,0]
  ]
};

export const DEFAULT_LEVEL: LevelData = {
  themeName: "Sunny Meadows",
  backgroundColor: "#87CEEB",
  groundColor: "#654321",
  platforms: [
    { x: 300, y: 450, width: 150, type: "grass" },
    { x: 550, y: 350, width: 100, type: "stone" },
    { x: 750, y: 250, width: 200, type: "grass" },
    { x: 1000, y: 400, width: 100, type: "cloud" },
    { x: 1200, y: 300, width: 150, type: "stone" }
  ],
  enemies: [
    { x: 600, y: 350, type: "cat" },
    { x: 800, y: 250, type: "cat" }
  ],
  collectibles: [
    { x: 350, y: 400 },
    { x: 600, y: 300 },
    { x: 850, y: 200 },
    { x: 1250, y: 250 }
  ]
};