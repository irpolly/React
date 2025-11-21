
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
// 12: Dark Grey (Cat Shadow/Stripes)
// 13: Light Grey (Cat Belly/Paws)
// 14: Darkest Grey (Cat Details)
// 15: Tennis Ball Yellow
// 16: Spike Silver
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
  12: '#4B5563', // Cat Dark Grey
  13: '#E5E7EB', // Cat Light Grey
  14: '#374151', // Cat Darkest
  15: '#CCFF00', // Tennis Ball
  16: '#94A3B8'  // Spike Silver
};

// --- CAT PALETTE VARIANTS ---
// Maps standard cat indices (11, 12, 13, 14) to new colors
export const CAT_VARIANTS: Record<number, Record<number, string>> = {
    0: {}, // Default Grey (Uses PALETTE)
    1: { // White Cat
        11: '#FFFFFF', // Body -> White
        12: '#E5E7EB', // Stripes -> Light Grey
        13: '#FFFFFF', // Belly -> White
        14: '#9CA3AF'  // Details -> Grey
    },
    2: { // Tuxedo (Black & White)
        11: '#1F1F1F', // Body -> Black
        12: '#374151', // Stripes -> Dark Grey
        13: '#FFFFFF', // Belly -> White
        14: '#000000'  // Details -> Pure Black
    },
    3: { // Brown & Black (Tortie/Tabby)
        11: '#8B4513', // Body -> SaddleBrown
        12: '#3E1C05', // Stripes -> Dark Bean
        13: '#D2B48C', // Belly -> Tan
        14: '#1F1F1F'  // Details -> Black
    }
};

// --- Sprites (Voxel Maps) ---

// Updated Corgi Sprites (22x14 Grid) - Straight Back
export const SPRITE_CORGI_IDLE: SpriteFrame = {
  width: 22,
  height: 14,
  pixels: [
    [0,0,0,0,0,0,0,0,0,0,0,1,5,0,2,5,0,0,0,0,0,0], // Ears
    [0,0,0,0,0,0,0,0,0,0,1,1,5,0,2,2,5,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,2,2,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,2,0,0,0,0], // Head top
    [0,0,0,0,0,0,0,0,0,0,1,1,1,3,1,2,2,2,3,0,0,0], // Eye, Snout, Nose
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,1,1,2,2,2,0,0,0,0,0,0], // Neck - Straightened connection
    [0,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,0,0,0,0,0,0], // Long Body - Flat Top
    [0,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,0,0,0,0,0,0], // Body
    [0,1,1,1,1,1,1,1,1,1,1,1,1,2,2,0,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,2,2,0,0,0,0,0,0,0],
    [0,1,1,0,0,0,0,0,0,0,0,1,1,2,2,0,0,0,0,0,0,0], // Legs
    [0,2,2,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,0], // Paws
    [0,2,2,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,0]
  ]
};

export const SPRITE_CORGI_RUN_1: SpriteFrame = {
  width: 22,
  height: 14,
  pixels: [
    [0,0,0,0,0,0,0,0,0,0,0,1,5,0,2,5,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,5,0,2,2,5,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,2,2,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,2,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,3,1,2,2,2,3,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,1,1,2,2,2,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,2,2,0,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,2,2,0,0,0,0,0,0,0],
    [0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0], // Legs Moved
    [0,0,0,2,2,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0],
    [0,0,0,2,2,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0]
  ]
};

// Neutral / Peak Jump (Tucked)
export const SPRITE_CORGI_JUMP: SpriteFrame = {
  width: 22,
  height: 14,
  pixels: [
    [0,0,0,0,0,0,0,0,0,0,0,1,5,0,2,5,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,5,0,2,2,5,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,2,2,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,2,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,3,1,2,2,2,3,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,1,1,2,2,2,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,2,2,0,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,2,2,0,0,0,0,0,0,0],
    [0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0], // Tucked legs
    [0,0,2,2,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  ]
};

// Angled Up Jump (Head high, butt low)
export const SPRITE_CORGI_LEAP_UP: SpriteFrame = {
  width: 22,
  height: 16, // Taller to accommodate angle
  pixels: [
    [0,0,0,0,0,0,0,0,0,0,0,0,1,5,0,2,5,0,0,0,0,0], // Head moved up 2
    [0,0,0,0,0,0,0,0,0,0,0,1,1,5,0,2,2,5,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,2,2,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,2,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,1,1,1,3,1,2,2,2,3,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,0,0,0],
    [0,0,0,0,0,0,1,1,1,1,1,1,1,1,2,2,2,0,0,0,0,0], // Neck connection
    [0,0,0,1,1,1,1,1,1,1,1,1,1,1,2,2,2,0,0,0,0,0], // Body angled
    [0,0,1,1,1,1,1,1,1,1,1,1,1,2,2,2,