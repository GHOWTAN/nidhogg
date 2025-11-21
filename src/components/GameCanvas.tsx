import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Player, Stance, PlayerState, GameState, Platform, Projectile } from '../types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRAVITY,
  FRICTION,
  MOVE_SPEED,
  JUMP_FORCE,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  ROLL_HEIGHT,
  SWORD_LENGTH,
  SWORD_WIDTH,
  THROW_SPEED,
  ROLL_SPEED,
  DIVE_KICK_SPEED,
  SWORD_GRAVITY,
  COLORS,
  RESPAWN_TIME,
  WIN_SCREEN_INDEX
} from '../constants';
import { generateGameCommentary } from '../services/geminiService';

interface GameCanvasProps {
  onGameOver: (winner: 1 | 2, commentary: string) => void;
  gameMode: 'pvp' | 'cpu';
}

// Helper to create platforms based on screen index
const getLevelLayout = (screenIndex: number): Platform[] => {
    const platforms: Platform[] = [];
    
    // Base floor varies by screen
    if (screenIndex === 0) {
        // Center arena: Flat with a small raised dais
        platforms.push({ x: 0, y: 350, width: 800, height: 100 }); // Main Floor
        platforms.push({ x: 300, y: 280, width: 200, height: 20 }); // Dais
    } else if (Math.abs(screenIndex) === 1) {
        // Mid screens: Broken floor with a pit
        platforms.push({ x: 0, y: 350, width: 300, height: 100 }); // Left side
        platforms.push({ x: 500, y: 350, width: 300, height: 100 }); // Right side
        platforms.push({ x: 350, y: 250, width: 100, height: 20 }); // Floating platform over pit
    } else if (Math.abs(screenIndex) === 2) {
        // Final screens: Steps up to the "Nidhogg"
        platforms.push({ x: 0, y: 350, width: 800, height: 100 }); // Base
        platforms.push({ x: screenIndex > 0 ? 500 : 100, y: 250, width: 200, height: 20 }); // High ground
    }
    
    return platforms;
};

const GameCanvas: React.FC<GameCanvasProps> = ({ onGameOver, gameMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const keysPressed = useRef<Set<string>>(new Set());
  const [commentary, setCommentary] = useState<string>("PRESS SPACE TO START");
  
  // AI Internal State
  const aiState = useRef({
      reactionTimer: 0,
      changeStanceTimer: 0,
      desiredStance: Stance.MID,
      jumpCooldown: 0,
  });

  // Game State
  const gameState = useRef<GameState>({
    screen: 0,
    lastWinner: null,
    gameOver: false,
    winner: null,
    commentary: "",
    particles: [],
    projectiles: [],
    platforms: getLevelLayout(0),
    shake: 0,
    players: [
      {
        id: 1,
        x: 100,
        y: 200,
        vx: 0,
        vy: 0,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        stance: Stance.MID,
        state: PlayerState.IDLE,
        facing: 1,
        attackCooldown: 0,
        respawnTimer: 0,
        score: 0,
        color: COLORS.P1,
        hasSword: true,
        invincibleTimer: 0
      },
      {
        id: 2,
        x: CANVAS_WIDTH - 100 - PLAYER_WIDTH,
        y: 200,
        vx: 0,
        vy: 0,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        stance: Stance.MID,
        state: PlayerState.IDLE,
        facing: -1,
        attackCooldown: 0,
        respawnTimer: 0,
        score: 0,
        color: COLORS.P2,
        hasSword: true,
        invincibleTimer: 0
      }
    ]
  });

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- CORE LOGIC HELPERS ---

  const spawnParticles = (x: number, y: number, color: string, count: number, speedMult: number = 1) => {
    for (let i = 0; i < count; i++) {
      gameState.current.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10 * speedMult,
        vy: (Math.random() - 0.5) * 10 * speedMult,
        life: 30 + Math.random() * 20,
        color: color,
        size: Math.random() * 4 + 2
      });
    }
  };

  const dropSword = (x: number, y: number, facing: number, ownerId: 1 | 2) => {
      gameState.current.projectiles.push({
          id: Math.random().toString(),
          x: x,
          y: y,
          vx: facing * 2 + (Math.random() - 0.5) * 2,
          vy: -5,
          width: SWORD_LENGTH,
          height: SWORD_WIDTH,
          rotation: Math.random() * 360,
          state: 'FLYING',
          ownerId
      });
  };

  const triggerShake = (amount: number) => {
      gameState.current.shake = amount;
  };

  const killPlayer = (victim: Player, killerId: 1 | 2 | null, cause: 'stab' | 'pit') => {
      if (victim.state === PlayerState.DEAD || victim.state === PlayerState.RESPAWNING) return;
      
      victim.state = PlayerState.DEAD;
      spawnParticles(victim.x, victim.y, victim.color === COLORS.P1 ? COLORS.BLOOD_P1 : COLORS.BLOOD_P2, 40, 1.5);
      triggerShake(10);

      if (victim.hasSword) {
          victim.hasSword = false;
          dropSword(victim.x, victim.y, victim.facing, victim.id);
      }

      const winnerId = victim.id === 1 ? 2 : 1;
      gameState.current.lastWinner = winnerId;
      
      victim.state = PlayerState.RESPAWNING;
      victim.respawnTimer = RESPAWN_TIME;
      
      if (cause === 'stab') {
        const killerColor = winnerId === 1 ? 'Yellow' : 'Orange';
        generateGameCommentary('kill', killerColor).then(text => setCommentary(text));
      } else {
        setCommentary("WATCH YOUR STEP!");
      }
  };

  const changeScreen = async (direction: 1 | -1, playerId: 1 | 2) => {
    const state = gameState.current;
    const nextScreen = state.screen + direction;
    
    if (Math.abs(nextScreen) >= WIN_SCREEN_INDEX) {
        state.gameOver = true;
        state.winner = playerId;
        const winText = await generateGameCommentary('win', playerId === 1 ? 'Yellow' : 'Orange');
        onGameOver(playerId, winText);
        return;
    }

    state.screen = nextScreen;
    state.platforms = getLevelLayout(nextScreen);
    
    // Remove all projectiles on screen change
    state.projectiles = [];

    // Reset positions based on entry side
    const p1 = state.players[0];
    const p2 = state.players[1];
    
    if (playerId === 1) {
        p1.x = 20;
        p2.x = CANVAS_WIDTH - 100;
    } else {
        p2.x = CANVAS_WIDTH - 50;
        p1.x = 80;
    }
    
    // Put them in air to avoid getting stuck in floor changes
    p1.y = 100;
    p2.y = 100;
    p1.vx = 0; p2.vx = 0;
    p1.vy = 0; p2.vy = 0;

    const advanceText = await generateGameCommentary('screen_change', playerId === 1 ? 'Yellow' : 'Orange');
    setCommentary(advanceText);
  };

  // --- AI CONTROLLER ---
  const updateAI = (me: Player, opponent: Player, state: GameState) => {
      const inputs = { up: false, down: false, left: false, right: false, jump: false, attack: false };
      const ai = aiState.current;
      
      if (me.state === PlayerState.DEAD || me.state === PlayerState.RESPAWNING) return inputs;

      const dx = opponent.x - me.x;
      const dist = Math.abs(dx);

      const iAmWinner = state.lastWinner === 2;
      const opponentIsAlive = opponent.state !== PlayerState.DEAD && opponent.state !== PlayerState.RESPAWNING;
      
      let targetX = opponent.x;
      
      // Decide Priority
      let mode: 'ATTACK' | 'RUN' | 'RETRIEVE' = 'ATTACK';
      
      if (!me.hasSword) mode = 'RETRIEVE';
      else if (iAmWinner) {
          // If I'm winning, try to run, but fight if opponent is in front
          if (!opponentIsAlive || (opponent.x > me.x)) {
              mode = 'RUN'; // Run Left (P2 Goal)
          } else {
              mode = 'ATTACK'; // Clear path
          }
      }
      
      // Sword Logic
      if (mode === 'RETRIEVE') {
          let closestDist = 9999;
          let closestSword: Projectile | null = null;
          state.projectiles.forEach(p => {
              if (p.state === 'GROUNDED') {
                  const d = Math.abs(p.x - me.x);
                  if (d < closestDist) {
                      closestDist = d;
                      closestSword = p;
                  }
              }
          });
          
          if (closestSword) {
              targetX = closestSword.x;
              if (Math.abs(me.x - closestSword.x) < 20) {
                  inputs.down = true; // Pickup
              }
          } else {
              // No swords? Punch or Run
              if (dist < 50) mode = 'ATTACK';
              else targetX = opponent.x > me.x ? 0 : CANVAS_WIDTH; 
          }
      } else if (mode === 'RUN') {
          targetX = -200; // Goal is Left for P2
      } else if (mode === 'ATTACK') {
          targetX = opponent.x + (opponent.facing === 1 ? 60 : -60);
      }

      // Movement X
      if (Math.abs(targetX - me.x) > 10) {
          if (targetX < me.x) inputs.left = true;
          else inputs.right = true;
      }

      // Pit / Jump Logic
      if (ai.jumpCooldown > 0) ai.jumpCooldown--;
      
      // 1. Jump Pits
      if (Math.abs(state.screen) === 1) {
          const nearingGapLeft = (me.x < 320 && me.x > 280 && me.vx > 0); // Approaching from left
          const nearingGapRight = (me.x > 480 && me.x < 520 && me.vx < 0); // Approaching from right
          const onCenter = me.x > 350 && me.x < 450;
          
          if ((nearingGapLeft || nearingGapRight || onCenter) && ai.jumpCooldown === 0) {
              inputs.jump = true;
              ai.jumpCooldown = 20;
          }
      }
      
      // 2. Jump over opponent attacks (rarely)
      if (opponent.state === PlayerState.ATTACKING && opponent.stance === Stance.LOW && dist < 100 && ai.jumpCooldown === 0) {
          if (Math.random() < 0.3) inputs.jump = true;
      }

      // Combat Logic
      if (mode === 'ATTACK' && opponentIsAlive) {
          ai.reactionTimer++;
          
          // Change stance periodically or reactively
          if (ai.reactionTimer > 15) {
              ai.reactionTimer = 0;
              
              // 80% chance to block correctly
              if (opponent.state === PlayerState.ATTACKING && Math.random() < 0.8) {
                  ai.desiredStance = opponent.stance;
              } else {
                  // Random stance
                  const r = Math.random();
                  if (r < 0.33) ai.desiredStance = Stance.HIGH;
                  else if (r < 0.66) ai.desiredStance = Stance.MID;
                  else ai.desiredStance = Stance.LOW;
              }
          }
          
          if (ai.desiredStance === Stance.HIGH) inputs.up = true;
          else if (ai.desiredStance === Stance.LOW) inputs.down = true;

          // Attack Trigger
          if (dist < 90) {
              if (Math.random() < 0.08) inputs.attack = true;
              
              // If opponent is running away, throw sword?
              if (dist > 150 && me.hasSword && Math.random() < 0.01) {
                  inputs.up = true;
                  inputs.attack = true; // Throw
              }
          }
      }

      return inputs;
  };

  // --- MAIN LOOP ---

  const updatePhysics = () => {
    const state = gameState.current;
    if (state.gameOver) return;

    // Shake Decay
    if (state.shake > 0) state.shake *= 0.9;
    if (state.shake < 0.5) state.shake = 0;

    // Determine Inputs for Both Players
    const keys = keysPressed.current;
    
    // Player 1 Controls (Always Human)
    const p1Inputs = {
        up: keys.has('KeyW'),
        down: keys.has('KeyS'),
        left: keys.has('KeyA'),
        right: keys.has('KeyD'),
        jump: keys.has('KeyG'),
        attack: keys.has('KeyF')
    };

    // Player 2 Controls (Human or CPU)
    let p2Inputs;
    if (gameMode === 'cpu') {
        p2Inputs = updateAI(state.players[1], state.players[0], state);
    } else {
        p2Inputs = {
            up: keys.has('ArrowUp'),
            down: keys.has('ArrowDown'),
            left: keys.has('ArrowLeft'),
            right: keys.has('ArrowRight'),
            jump: keys.has('Period'), // .
            attack: keys.has('Comma') // ,
        };
    }

    const allInputs = [p1Inputs, p2Inputs];

    // Players Loop
    state.players.forEach((p, index) => {
      const input = allInputs[index];
      const opponent = state.players[index === 0 ? 1 : 0];

      // --- RESPAWN LOGIC ---
      if (p.state === PlayerState.DEAD || p.state === PlayerState.RESPAWNING) {
        if (p.respawnTimer > 0) {
          p.respawnTimer--;
        } else {
            // Respawn
            p.state = PlayerState.IDLE;
            p.y = -50; 
            p.vy = 0;
            p.hasSword = true;
            p.invincibleTimer = 60; // 1 second invincibility
            
            // Strategic Respawn
            if (state.lastWinner === 1) {
                 // P1 is pushing right. P2 spawns ahead (Right side)
                 p.x = Math.min(opponent.x + 300, CANVAS_WIDTH - 100);
            } else if (state.lastWinner === 2) {
                // P2 is pushing left. P1 spawns ahead (Left side)
                p.x = Math.max(opponent.x - 300, 100);
            } else {
                // Tie/Start
                p.x = p.id === 1 ? 100 : CANVAS_WIDTH - 100;
            }
        }
        if (p.state === PlayerState.RESPAWNING) return;
      }

      // --- CONTROLS ---
      const { up, down, left, right, jump, attack } = input;

      // Ground Detection
      let onGround = false;
      let platformY = 9999;
      
      // Check platforms
      state.platforms.forEach(plat => {
          if (p.x + p.width > plat.x && p.x < plat.x + plat.width) {
              // Check if feet are near top of platform and falling
              if (p.y + p.height >= plat.y && p.y + p.height <= plat.y + 20 && p.vy >= 0) {
                  onGround = true;
                  platformY = plat.y;
              }
          }
      });

      // --- STATE MANAGEMENT ---
      if (p.invincibleTimer > 0) p.invincibleTimer--;

      // Stance Control
      if (up) p.stance = Stance.HIGH;
      else if (down) p.stance = Stance.LOW;
      else p.stance = Stance.MID;

      // Movement & Friction
      if (p.state !== PlayerState.ROLLING && p.state !== PlayerState.DIVE_KICKING) {
          if (left) {
              p.vx -= 1;
              p.facing = -1;
          }
          if (right) {
              p.vx += 1;
              p.facing = 1;
          }
          p.vx *= FRICTION;
          
          // Jump
          if (jump && onGround) {
              p.vy = JUMP_FORCE;
              onGround = false;
          }
      }

      // Roll: Grounded + Down + Jump
      if (onGround && down && jump && p.state !== PlayerState.ROLLING) {
          p.state = PlayerState.ROLLING;
          p.vx = p.facing * ROLL_SPEED;
          p.y += (PLAYER_HEIGHT - ROLL_HEIGHT); // Duck down
      }
      
      // End Roll
      if (p.state === PlayerState.ROLLING) {
          p.vx = p.facing * ROLL_SPEED; // Constant speed
          if (Math.abs(p.vx) < 1 || !onGround) p.state = PlayerState.IDLE;
      }

      // Attack
      if (attack && p.attackCooldown === 0) {
          if (up && p.hasSword) {
              // THROW SWORD
              p.hasSword = false;
              p.attackCooldown = 30;
              state.projectiles.push({
                  id: Math.random().toString(),
                  x: p.x + (p.facing === 1 ? p.width : -SWORD_LENGTH),
                  y: p.y + 20,
                  vx: p.facing * THROW_SPEED,
                  vy: -2,
                  width: SWORD_LENGTH,
                  height: SWORD_WIDTH,
                  rotation: 0,
                  state: 'FLYING',
                  ownerId: p.id
              });
          } else if (!onGround && down) {
              // DIVE KICK
              p.state = PlayerState.DIVE_KICKING;
              p.vx = p.facing * DIVE_KICK_SPEED;
              p.vy = DIVE_KICK_SPEED; 
          } else if (p.hasSword) {
              // STANDARD STAB
              p.state = PlayerState.ATTACKING;
              p.attackCooldown = 20;
              p.vx += p.facing * 8; // Lunge
          } else {
              // PUNCH
               p.state = PlayerState.ATTACKING;
               p.attackCooldown = 15;
               p.vx += p.facing * 5;
          }
      }

      if (p.attackCooldown > 0) p.attackCooldown--;
      if (p.state === PlayerState.ATTACKING && p.attackCooldown < 10) p.state = PlayerState.IDLE;

      // Dive Kick End
      if (p.state === PlayerState.DIVE_KICKING && onGround) {
          p.state = PlayerState.IDLE;
          spawnParticles(p.x + p.width/2, p.y + p.height, '#FFF', 5);
          triggerShake(2);
      }

      // --- PHYSICS APPLY ---
      p.x += p.vx;
      p.y += p.vy;
      p.vy += GRAVITY;

      // Ground Collision Check
      if (onGround && p.vy >= 0) {
        p.y = platformY - p.height;
        p.vy = 0;
        
        // Reset Roll State
        if (p.state === PlayerState.ROLLING) {
            if (!down && Math.random() > 0.9) { 
                 p.state = PlayerState.IDLE;
                 p.y -= (PLAYER_HEIGHT - ROLL_HEIGHT);
            }
        }
      }

      // Pickup Sword
      if (!p.hasSword && down && onGround) {
          const swordIdx = state.projectiles.findIndex(proj => 
              proj.state === 'GROUNDED' && 
              Math.abs((proj.x) - (p.x + p.width/2)) < 30 &&
              Math.abs(proj.y - (p.y + p.height)) < 30
          );
          if (swordIdx !== -1) {
              state.projectiles.splice(swordIdx, 1);
              p.hasSword = true;
          }
      }

      // Pit Death
      if (p.y > CANVAS_HEIGHT + 50) {
          killPlayer(p, opponent.id, 'pit');
      }

      // Screen Boundaries
      if (p.x < -20) {
          if (p.id === 2 && state.lastWinner === 2) changeScreen(-1, 2);
          else p.x = -20;
      }
      if (p.x > CANVAS_WIDTH - p.width + 20) {
          if (p.id === 1 && state.lastWinner === 1) changeScreen(1, 1);
          else p.x = CANVAS_WIDTH - p.width + 20;
      }
    });

    // --- COMBAT INTERACTIONS ---
    const p1 = state.players[0];
    const p2 = state.players[1];

    if (p1.state !== PlayerState.DEAD && p2.state !== PlayerState.DEAD && p1.state !== PlayerState.RESPAWNING && p2.state !== PlayerState.RESPAWNING) {
        const dist = Math.abs((p1.x + p1.width/2) - (p2.x + p2.width/2));
        if (dist < 80) { 
             checkCombat(p1, p2);
             checkCombat(p2, p1);
        }
    }

    // --- PROJECTILES ---
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const proj = state.projectiles[i];
        
        if (proj.state === 'FLYING') {
            proj.x += proj.vx;
            proj.y += proj.vy;
            proj.vy += SWORD_GRAVITY;
            proj.rotation += 20;

            // Hit Players
            state.players.forEach(p => {
                if (p.state === PlayerState.DEAD || p.state === PlayerState.RESPAWNING) return;
                if (proj.ownerId === p.id && Math.abs(proj.vx) > 5) return; // Don't hit self immediately
                
                // Collision
                if (proj.x > p.x && proj.x < p.x + p.width && proj.y > p.y && proj.y < p.y + p.height) {
                    if (p.hasSword && p.state !== PlayerState.ROLLING) {
                         // Deflect logic
                         killPlayer(p, proj.ownerId === 1 ? 1 : 2, 'stab');
                         proj.vx *= -0.5;
                         proj.state = 'GROUNDED';
                    } else if (p.state === PlayerState.ROLLING) {
                        // Dodge
                    } else {
                        killPlayer(p, proj.ownerId === 1 ? 1 : 2, 'stab');
                        proj.vx *= -0.5;
                        proj.state = 'GROUNDED';
                    }
                }
            });

            // Hit Platforms
            state.platforms.forEach(plat => {
                 if (proj.x > plat.x && proj.x < plat.x + plat.width && proj.y > plat.y && proj.y < plat.y + plat.height) {
                     proj.state = 'GROUNDED';
                     proj.y = plat.y - 5;
                     proj.vx = 0;
                     proj.vy = 0;
                     proj.rotation = 45;
                 }
            });
            
            // Pit Check
            if (proj.y > CANVAS_HEIGHT) {
                state.projectiles.splice(i, 1);
            }

        }
    }

    // Particles Update
    state.particles.forEach((part, i) => {
        part.x += part.vx;
        part.y += part.vy;
        part.life--;
        if (part.life <= 0) state.particles.splice(i, 1);
    });
  };

  const checkCombat = (attacker: Player, defender: Player) => {
      if (attacker.state === PlayerState.ATTACKING && attacker.attackCooldown > 10) {
          
          // Define attack height based on visual arm position
          // High: ~10px from top, Mid: ~22px from top, Low: ~42px from top
          const attackY = attacker.y + (attacker.stance === Stance.HIGH ? 10 : attacker.stance === Stance.MID ? 22 : 42);
          
          // Defender visual stance ranges
          // const defendYStart = defender.y + (defender.stance === Stance.HIGH ? 0 : defender.stance === Stance.MID ? 20 : 40);
          
          // Are faces roughly towards each other?
          const facingOpponent = (attacker.x < defender.x && attacker.facing === 1) || (attacker.x > defender.x && attacker.facing === -1);
          
          if (facingOpponent) {
              // Check Block
              let blocked = false;
              if (defender.hasSword && defender.state !== PlayerState.ROLLING && defender.state !== PlayerState.ATTACKING) {
                  if (defender.stance === attacker.stance) blocked = true;
              }

              if (blocked) {
                   // Spark effect
                   spawnParticles(defender.x + defender.width/2, attackY, '#FFFFFF', 5);
                   triggerShake(2);
                   // Knockback
                   attacker.vx = -attacker.facing * 10;
                   defender.vx = defender.facing * 5;
                   attacker.state = PlayerState.IDLE; // Interrupt attack
              } else {
                  // HIT!
                  if (defender.invincibleTimer === 0) {
                      killPlayer(defender, attacker.id, 'stab');
                  }
              }
          }
      }
      
      // Dive Kick Hit Check
      if (attacker.state === PlayerState.DIVE_KICKING) {
          if (attacker.x + attacker.width > defender.x && attacker.x < defender.x + defender.width) {
               if (attacker.y + attacker.height > defender.y && attacker.y < defender.y + defender.height) {
                   if (defender.stance === Stance.HIGH && defender.hasSword) {
                       // Countered by sword up!
                       killPlayer(attacker, defender.id, 'stab');
                   } else {
                       killPlayer(defender, attacker.id, 'stab');
                   }
               }
          }
      }
  };

  const drawPlayerSprite = (ctx: CanvasRenderingContext2D, p: Player) => {
      const cx = p.x + p.width / 2;
      const feetY = p.y + p.height;

      // 1. Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(cx, feetY, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;

      // --- ROLLING (Ball) ---
      if (p.state === PlayerState.ROLLING) {
          ctx.beginPath();
          ctx.arc(cx, p.y + p.height - 15, 15, 0, Math.PI * 2);
          ctx.fill();
          return;
      }

      // --- DIVE KICK (Flying Horizontal) ---
      if (p.state === PlayerState.DIVE_KICKING) {
          ctx.save();
          ctx.translate(cx, p.y + 20);
          ctx.rotate(p.facing * Math.PI / 4);
          ctx.fillRect(-10, -10, 20, 20); // Body box
          ctx.fillRect(5 * p.facing, 0, 15, 5); // Leg
          ctx.restore();
          return;
      }

      // --- STANDARD SPRITE ---
      const isMoving = Math.abs(p.vx) > 0.5;
      const time = Date.now() / 100;
      const bounce = isMoving ? Math.sin(time * 1.5) * 2 : 0;

      // Head
      const headSize = 12;
      const headY = p.y + bounce;
      ctx.fillRect(cx - headSize/2, headY, headSize, headSize);
      
      // Eye
      ctx.fillStyle = '#000';
      ctx.fillRect(cx + (p.facing * 3), headY + 4, 2, 2);
      ctx.fillStyle = p.color;

      // Torso
      const torsoW = 8;
      const torsoH = 24;
      const torsoY = headY + headSize;
      ctx.fillRect(cx - torsoW/2, torsoY, torsoW, torsoH);

      // Legs
      const legH = 24;
      const legY = torsoY + torsoH;
      
      ctx.lineWidth = 4;
      
      if (isMoving) {
          const stride = Math.sin(time * 1.5) * 10;
          
          // Back Leg
          ctx.beginPath();
          ctx.moveTo(cx, legY);
          ctx.lineTo(cx - stride, legY + legH);
          ctx.stroke();
          
          // Front Leg
          ctx.beginPath();
          ctx.moveTo(cx, legY);
          ctx.lineTo(cx + stride, legY + legH);
          ctx.stroke();
      } else {
          // Standing
          ctx.beginPath();
          ctx.moveTo(cx - 3, legY);
          ctx.lineTo(cx - 3, legY + legH);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(cx + 3, legY);
          ctx.lineTo(cx + 3, legY + legH);
          ctx.stroke();
      }

      // Arms & Sword
      // Determine Hand Height based on Stance
      let handY = torsoY + 10; // Mid (approx +22 from top)
      if (p.stance === Stance.HIGH) handY = torsoY - 2; // High (approx +10)
      if (p.stance === Stance.LOW) handY = torsoY + 20; // Low (approx +42)

      const shoulderY = torsoY + 4;
      const handX = cx + (p.facing * 15);

      // Draw Arm (Shoulder to Hand)
      ctx.beginPath();
      ctx.moveTo(cx, shoulderY);
      ctx.lineTo(handX, handY);
      ctx.stroke();

      // Draw Sword
      if (p.hasSword) {
          ctx.fillStyle = '#FFF';
          
          let reach = 0;
          if (p.state === PlayerState.ATTACKING) {
              reach = 20 * p.facing;
          }

          const swordX = handX + reach;
          
          // Blade
          ctx.fillRect(p.facing === 1 ? swordX : swordX - SWORD_LENGTH, handY - 2, SWORD_LENGTH, 4);
          
          // Hilt
          ctx.fillStyle = '#666';
          ctx.fillRect(p.facing === 1 ? swordX - 4 : swordX + SWORD_LENGTH - 4, handY - 4, 8, 8);
      }
  };

  const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const state = gameState.current;

      // Clear
      ctx.fillStyle = COLORS.BG;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Shake
      ctx.save();
      if (state.shake > 0) {
          ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      }

      // Draw Background / Platforms
      ctx.fillStyle = COLORS.PLATFORM;
      state.platforms.forEach(p => {
          ctx.fillRect(p.x, p.y, p.width, p.height);
          // Highlight top edge
          ctx.fillStyle = '#888';
          ctx.fillRect(p.x, p.y, p.width, 4);
          ctx.fillStyle = COLORS.PLATFORM;
      });

      // Draw UI Text (Background)
      ctx.font = '20px "Press Start 2P"';
      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.fillText(`SCREEN ${state.screen}`, CANVAS_WIDTH / 2, 50);
      
      // Draw Arrow indicating winner flow
      if (state.lastWinner) {
          const winnerColor = state.lastWinner === 1 ? COLORS.P1 : COLORS.P2;
          ctx.fillStyle = winnerColor;
          ctx.globalAlpha = 0.2;
          const arrowX = state.lastWinner === 1 ? CANVAS_WIDTH - 100 : 100;
          ctx.beginPath();
          ctx.moveTo(arrowX, 100);
          ctx.lineTo(arrowX + (state.lastWinner === 1 ? 50 : -50), 150);
          ctx.lineTo(arrowX, 200);
          ctx.fill();
          ctx.globalAlpha = 1.0;
      }

      // Draw Particles
      state.particles.forEach(p => {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
      });

      // Draw Projectiles (Swords)
      state.projectiles.forEach(p => {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation * Math.PI / 180);
          ctx.fillStyle = '#FFF'; // Blade
          ctx.fillRect(-p.width/2, -p.height/2, p.width, p.height);
          ctx.fillStyle = p.ownerId === 1 ? COLORS.P1 : COLORS.P2; // Hilt
          ctx.fillRect(-p.width/2 - 5, -p.height/2 - 2, 10, p.height + 4);
          ctx.restore();
      });

      // Draw Players with Sprite Function
      state.players.forEach(p => {
          if (p.state === PlayerState.DEAD) return;
          if (p.state === PlayerState.RESPAWNING) return;
          if (p.invincibleTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) return; // Blink

          drawPlayerSprite(ctx, p);
      });

      // Commentary Overlay
      if (commentary) {
          ctx.fillStyle = '#FFF';
          ctx.font = '16px "Press Start 2P"';
          ctx.textAlign = 'center';
          ctx.fillText(commentary, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 20);
      }

      ctx.restore();
  };

  const loop = () => {
      updatePhysics();
      draw();
      requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
      requestRef.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(requestRef.current);
  }, [gameMode]); // Restart loop if mode changes

  return (
    <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT} 
        className="border-4 border-gray-700 bg-black shadow-2xl rounded-sm w-full max-w-[800px]"
    />
  );
};

export default GameCanvas;