export enum Stance {
  HIGH = 0,
  MID = 1,
  LOW = 2
}

export enum PlayerState {
  IDLE,
  RUNNING,
  JUMPING,
  ATTACKING,
  ROLLING,
  DIVE_KICKING,
  DEAD,
  RESPAWNING,
  VICTORY
}

export interface Platform {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Projectile {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    width: number;
    height: number;
    rotation: number;
    state: 'FLYING' | 'GROUNDED';
    ownerId: 1 | 2;
}

export interface Player {
  id: 1 | 2;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  stance: Stance;
  state: PlayerState;
  facing: 1 | -1; // 1 right, -1 left
  attackCooldown: number;
  respawnTimer: number;
  score: number;
  color: string;
  hasSword: boolean;
  invincibleTimer: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface GameState {
  screen: number; // -2 to 2
  lastWinner: 1 | 2 | null;
  players: [Player, Player];
  particles: Particle[];
  projectiles: Projectile[];
  platforms: Platform[];
  gameOver: boolean;
  winner: 1 | 2 | null;
  commentary: string;
  shake: number; // Screen shake intensity
}
