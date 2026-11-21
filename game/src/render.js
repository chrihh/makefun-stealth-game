// Night Ledger — all drawing. A moonlit archive drawn with flat shapes and
// soft gradients: flagstone floors, moonshadow pools, wooden crates and stone
// pillars as cover, wardens with swinging vision cones, and a HUD that keeps
// the objective, the detection meter and the score always in view.

import { TILE, COLS, ROWS, HUD_HEIGHT, VIEW_WIDTH, VIEW_HEIGHT, GUARD } from './config.js';
import { TILE_WALL, TILE_CRATE, TILE_PILLAR, TILE_SHADOW, TILE_EXIT } from './levels.js';
import { GUARD_ALERT, GUARD_SUSPICIOUS, GUARD_DISTRACTED, tileCentre } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';
export const SCREEN_PAUSED = 'paused';

const INK = '#e8e4d8';
const DIM = '#9aa3b2';

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  draw(world, screen, ui) {
    const { ctx } = this;
    ctx.save();
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.drawFloor(world);
    this.drawCones(world);
    this.drawKeyAndExit(world);
    this.drawDistraction(world);
    this.drawPlayer(world);
    this.drawGuards(world);
    this.drawHud(world, ui);
    if (screen === SCREEN_TITLE) this.drawTitle(world);
    if (screen === SCREEN_CAUGHT) this.drawBanner('CAUGHT', 'A warden has your coat. Your cover is blown — slip out and try the floor again.', '#e5534b');
    if (screen === SCREEN_CLEAR) this.drawBanner('FLOOR CLEARED', 'Down the stair, unseen or not — the next floor waits. Press Enter.', '#7ee787');
    if (screen === SCREEN_OVER) this.drawGameOver(world);
    if (screen === SCREEN_WIN) this.drawWin(world);
    if (screen === SCREEN_PAUSED) this.drawBanner('PAUSED', 'The archive holds its breath. Press P to go on.', '#d8b45a');
    ctx.restore();
  }

  drawFloor(world) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(0, HUD_HEIGHT);
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const tile = world.level.tiles[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (tile === TILE_WALL) {
          ctx.fillStyle = '#3a4152';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#4a5468';
          ctx.fillRect(x, y, TILE, 9);
          ctx.fillStyle = '#2c3242';
          ctx.fillRect(x + 4, y + 22, TILE - 8, 3);
          ctx.fillRect(x + 14, y + 36, TILE - 20, 3);
        } else {
          const shade = (row + col) % 2 === 0 ? '#1d222d' : '#202634';
          ctx.fillStyle = tile === TILE_SHADOW ? '#12161f' : shade;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = 'rgba(255,255,255,0.045)';
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
          if (tile === TILE_SHADOW) {
            ctx.fillStyle = 'rgba(140,170,255,0.10)';
            ctx.beginPath();
            ctx.ellipse(x + TILE / 2, y + TILE / 2, TILE * 0.42, TILE * 0.3, 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
          if (tile === TILE_CRATE) this.drawCrate(x, y);
          if (tile === TILE_PILLAR) this.drawPillar(x, y);
        }
      }
    }
    ctx.restore();
  }

  drawCrate(x, y) {
    const { ctx } = this;
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
    ctx.strokeStyle = '#54391d';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 7, y + 7, TILE - 14, TILE - 14);
    ctx.beginPath();
    ctx.moveTo(x + 7, y + 7);
    ctx.lineTo(x + TILE - 7, y + TILE - 7);
    ctx.moveTo(x + TILE - 7, y + 7);
    ctx.lineTo(x + 7, y + TILE - 7);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  drawPillar(x, y) {
    const { ctx } = this;
    ctx.fillStyle = '#59637a';
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE / 2, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#78839c';
    ctx.beginPath();
    ctx.arc(x + TILE / 2 - 4, y + TILE / 2 - 4, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCones(world) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(0, HUD_HEIGHT);
    for (const guard of world.guards) {
      // Rebuild the cone as a fan of rays so walls and cover cut it short.
      const range = GUARD.visionRange;
      const steps = 26;
      const seen = world.guardSees(guard) > 0;
      const alert = guard.state === GUARD_ALERT;
      const suspicious = guard.state === GUARD_SUSPICIOUS || guard.state === GUARD_DISTRACTED;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      for (let i = 0; i <= steps; i += 1) {
        const angle = guard.facing - GUARD.visionHalfAngle + (2 * GUARD.visionHalfAngle * i) / steps;
        let reach = range;
        for (let d = 12; d < range; d += 10) {
          if (world.pointSolid(guard.x + Math.cos(angle) * d, guard.y + Math.sin(angle) * d)) {
            reach = d;
            break;
          }
        }
        ctx.lineTo(guard.x + Math.cos(angle) * reach, guard.y + Math.sin(angle) * reach);
      }
      ctx.closePath();
      const gradient = ctx.createRadialGradient(guard.x, guard.y, 8, guard.x, guard.y, range);
      if (alert) {
        gradient.addColorStop(0, 'rgba(255,70,50,0.5)');
        gradient.addColorStop(1, 'rgba(255,70,50,0.06)');
      } else if (seen || suspicious) {
        gradient.addColorStop(0, 'rgba(255,176,66,0.48)');
        gradient.addColorStop(1, 'rgba(255,176,66,0.05)');
      } else {
        gradient.addColorStop(0, 'rgba(255,224,130,0.34)');
        gradient.addColorStop(1, 'rgba(255,224,130,0.03)');
      }
      ctx.fillStyle = gradient;
      ctx.fill();
    }
    ctx.restore();
  }

  drawKeyAndExit(world) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(0, HUD_HEIGHT);
    const exit = tileCentre(world.level.exit.col, world.level.exit.row);
    const open = world.hasKey;
    ctx.fillStyle = open ? '#1f4d2e' : '#233044';
    ctx.fillRect(exit.x - TILE / 2 + 4, exit.y - TILE / 2 + 4, TILE - 8, TILE - 8);
    ctx.strokeStyle = open ? '#7ee787' : '#54677f';
    ctx.lineWidth = 2;
    ctx.strokeRect(exit.x - TILE / 2 + 4, exit.y - TILE / 2 + 4, TILE - 8, TILE - 8);
    ctx.fillStyle = open ? '#b7f4c7' : '#7d8ea6';
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', exit.x, exit.y - 2);
    ctx.font = '10px Georgia, serif';
    ctx.fillText(open ? 'OPEN' : 'LOCKED', exit.x, exit.y + 12);
    ctx.lineWidth = 1;

    if (!world.hasKey) {
      const key = tileCentre(world.level.key.col, world.level.key.row);
      const bob = Math.sin(world.levelTime * 3) * 3;
      ctx.save();
      ctx.translate(key.x, key.y + bob);
      ctx.rotate(-0.5);
      ctx.fillStyle = '#e9c46a';
      ctx.fillRect(-11, -4, 17, 8);
      ctx.beginPath();
      ctx.arc(-14, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a6d1f';
      ctx.fillRect(2, 0, 3, 6);
      ctx.fillRect(6, 0, 3, 5);
      ctx.restore();
      ctx.fillStyle = 'rgba(233,196,106,0.9)';
      ctx.font = 'bold 9px Georgia, serif';
      ctx.fillText('KEYCARD', key.x, key.y + 22);
    }
    ctx.restore();
  }

  drawDistraction(world) {
    if (world.distraction === null) return;
    const { ctx } = this;
    ctx.save();
    ctx.translate(0, HUD_HEIGHT);
    const { x, y, left } = world.distraction;
    const pulse = 1 + Math.sin(world.levelTime * 10) * 0.15;
    ctx.strokeStyle = 'rgba(160,220,255,0.8)';
    ctx.beginPath();
    ctx.arc(x, y, 12 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#cfe9ff';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = DIM;
    ctx.font = '9px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${left.toFixed(0)}s`, x, y + 24);
    ctx.restore();
  }

  drawPlayer(world) {
    const { ctx } = this;
    const player = world.player;
    ctx.save();
    ctx.translate(0, HUD_HEIGHT);
    // A soft ring marks shadow-safety; a dashed ring marks sneaking.
    if (world.playerInShadow()) {
      ctx.strokeStyle = 'rgba(140,170,255,0.55)';
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.facing);
    ctx.fillStyle = '#101319';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2e7d5b';
    ctx.beginPath();
    ctx.arc(0, 0, player.sneaking ? 11 : 12.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2d5a0';
    ctx.beginPath();
    ctx.arc(3, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  drawGuards(world) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(0, HUD_HEIGHT);
    for (const guard of world.guards) {
      ctx.save();
      ctx.translate(guard.x, guard.y);
      ctx.rotate(guard.facing);
      ctx.fillStyle = '#1a1216';
      ctx.beginPath();
      ctx.moveTo(17, 0);
      ctx.lineTo(-11, -12);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-11, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = guard.state === GUARD_ALERT ? '#b3382e' : '#7a4a21';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8c39a';
      ctx.beginPath();
      ctx.arc(3, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(-2, -13, 9, 4);
      ctx.restore();
      // State mark above the head.
      ctx.textAlign = 'center';
      if (guard.state === GUARD_ALERT) {
        ctx.fillStyle = '#ff5a4d';
        ctx.font = 'bold 20px Georgia, serif';
        ctx.fillText('!', guard.x, guard.y - 22);
      } else if (guard.state === GUARD_SUSPICIOUS) {
        ctx.fillStyle = '#ffb042';
        ctx.font = 'bold 16px Georgia, serif';
        ctx.fillText('?', guard.x, guard.y - 22);
      } else if (guard.state === GUARD_DISTRACTED) {
        ctx.fillStyle = '#a0dcff';
        ctx.font = 'bold 13px Georgia, serif';
        ctx.fillText('♪', guard.x, guard.y - 22);
      }
    }
    ctx.restore();
  }

  drawHud(world, ui) {
    const { ctx } = this;
    ctx.fillStyle = '#11151d';
    ctx.fillRect(0, 0, VIEW_WIDTH, HUD_HEIGHT);
    ctx.fillStyle = '#2a3040';
    ctx.fillRect(0, HUD_HEIGHT - 2, VIEW_WIDTH, 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = 'bold 16px Georgia, serif';
    ctx.fillText(world.level.name, 14, 24);
    ctx.fillStyle = DIM;
    ctx.font = '12px Georgia, serif';
    ctx.fillText(world.hasKey ? 'Keycard in hand — reach the EXIT stair unseen.' : world.level.hint, 14, 44);

    // Detection meter.
    const meterX = 560;
    const meterY = 16;
    ctx.fillStyle = DIM;
    ctx.font = 'bold 11px Georgia, serif';
    ctx.fillText('DETECTION', meterX, meterY + 2);
    ctx.fillStyle = '#232936';
    ctx.fillRect(meterX, meterY + 7, 170, 12);
    const fill = world.exposure;
    ctx.fillStyle = fill >= 1 ? '#ff5a4d' : fill >= 0.34 ? '#ffb042' : '#7ee787';
    ctx.fillRect(meterX, meterY + 7, 170 * Math.min(1, fill), 12);
    ctx.strokeStyle = '#3c4457';
    ctx.strokeRect(meterX + 0.5, meterY + 7.5, 170, 12);

    ctx.textAlign = 'right';
    ctx.fillStyle = INK;
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillText(`Score ${world.score}`, VIEW_WIDTH - 14, 24);
    ctx.fillStyle = DIM;
    ctx.font = '12px Georgia, serif';
    const mm = String(Math.floor(world.totalTime / 60)).padStart(2, '0');
    const ss = String(Math.floor(world.totalTime % 60)).padStart(2, '0');
    ctx.fillText(`◷ ${mm}:${ss}   ● coins ${world.coins}   ♥ cover ${world.covers}${ui.muted ? '   🔇' : ''}`, VIEW_WIDTH - 14, 44);
    ctx.textAlign = 'left';
  }

  drawBanner(title, body, colour) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(5,7,11,0.72)';
    ctx.fillRect(0, HUD_HEIGHT, VIEW_WIDTH, VIEW_HEIGHT - HUD_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = colour;
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText(title, VIEW_WIDTH / 2, HUD_HEIGHT + 240);
    ctx.fillStyle = INK;
    ctx.font = '16px Georgia, serif';
    ctx.fillText(body, VIEW_WIDTH / 2, HUD_HEIGHT + 276);
    ctx.textAlign = 'left';
  }

  drawTitle(world) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(5,7,11,0.66)';
    ctx.fillRect(0, HUD_HEIGHT, VIEW_WIDTH, VIEW_HEIGHT - HUD_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e9c46a';
    ctx.font = 'bold 58px Georgia, serif';
    ctx.fillText('NIGHT LEDGER', VIEW_WIDTH / 2, HUD_HEIGHT + 150);
    ctx.fillStyle = INK;
    ctx.font = '18px Georgia, serif';
    ctx.fillText('A stealth burglary in the Meridian Archive, in three floors.', VIEW_WIDTH / 2, HUD_HEIGHT + 188);
    ctx.fillStyle = DIM;
    ctx.font = '15px Georgia, serif';
    const lines = [
      'WASD / arrows — move        SHIFT — sneak (slower, harder to see)',
      'Click — throw a coin to pull wardens away        Crates & pillars block sight',
      'Footsteps carry: walking close is heard. Stand in moonshadow to fade.',
      'Lift each floor’s brass keycard, reach the EXIT stair, and do not be caught.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW_WIDTH / 2, HUD_HEIGHT + 238 + i * 26));
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 19px Georgia, serif';
    ctx.fillText('Press Enter to slip inside', VIEW_WIDTH / 2, HUD_HEIGHT + 380);
    ctx.textAlign = 'left';
  }

  drawGameOver(world) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(5,7,11,0.78)';
    ctx.fillRect(0, HUD_HEIGHT, VIEW_WIDTH, VIEW_HEIGHT - HUD_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e5534b';
    ctx.font = 'bold 46px Georgia, serif';
    ctx.fillText('THE LEDGER CLOSES', VIEW_WIDTH / 2, HUD_HEIGHT + 220);
    ctx.fillStyle = INK;
    ctx.font = '17px Georgia, serif';
    ctx.fillText(`Caught for the last time on ${world.level.name}. Final score ${world.score}.`, VIEW_WIDTH / 2, HUD_HEIGHT + 262);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText('Press Enter to try the archive again', VIEW_WIDTH / 2, HUD_HEIGHT + 310);
    ctx.textAlign = 'left';
  }

  drawWin(world) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(5,7,11,0.74)';
    ctx.fillRect(0, HUD_HEIGHT, VIEW_WIDTH, VIEW_HEIGHT - HUD_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 48px Georgia, serif';
    ctx.fillText('OUT INTO THE NIGHT', VIEW_WIDTH / 2, HUD_HEIGHT + 190);
    ctx.fillStyle = INK;
    ctx.font = '18px Georgia, serif';
    ctx.fillText('All three floors emptied. The ledger never learns your name.', VIEW_WIDTH / 2, HUD_HEIGHT + 232);
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillStyle = '#e9c46a';
    const style = world.everDetected ? 'Seen, chased — and still gone.' : 'A perfect ghost: never once detected.';
    ctx.fillText(`Final score ${world.score}   •   ${style}`, VIEW_WIDTH / 2, HUD_HEIGHT + 276);
    ctx.fillStyle = DIM;
    ctx.font = '15px Georgia, serif';
    ctx.fillText(`Time ${Math.floor(world.totalTime / 60)}:${String(Math.floor(world.totalTime % 60)).padStart(2, '0')}  •  Cover left ${world.covers}  •  Coins left ${world.coins}`, VIEW_WIDTH / 2, HUD_HEIGHT + 308);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 17px Georgia, serif';
    ctx.fillText('Press Enter to run it again', VIEW_WIDTH / 2, HUD_HEIGHT + 356);
    ctx.textAlign = 'left';
  }
}
