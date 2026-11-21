// Night Ledger — entry point: owns the canvas, the fixed-step loop, the
// screen state machine (title, play, caught, clear, over, win, paused) and
// the deterministic ?shot= scenes the screenshots are taken from.

import { STEP, VIEW_WIDTH, VIEW_HEIGHT, HUD_HEIGHT, SCORE } from './config.js';
import { Input } from './input.js';
import { SoundKit } from './audio.js';
import {
  World, EVENT_KEY, EVENT_SUSPICIOUS, EVENT_ALERT, EVENT_CAUGHT,
  EVENT_CLEARED, EVENT_COIN, EVENT_COIN_LAND, EVENT_STEP,
} from './world.js';
import {
  Renderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_CAUGHT, SCREEN_CLEAR,
  SCREEN_OVER, SCREEN_WIN, SCREEN_PAUSED,
} from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_WIDTH;
canvas.height = VIEW_HEIGHT;

const status = document.getElementById('status');
const sound = new SoundKit();
const renderer = new Renderer(ctx);
const world = new World();

let screen = SCREEN_TITLE;
let bannerClock = 0;

function toWorld(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT - HUD_HEIGHT,
  };
}

const input = new Input(canvas, toWorld);

function announce(text) {
  status.textContent = text;
}

function startRun() {
  world.loadLevel(0, true);
  world.score = 0;
  world.totalTime = 0;
  world.everDetected = false;
  screen = SCREEN_PLAY;
  announce('Floor one. Lift the keycard and reach the exit unseen.');
}

function handleEvents(events) {
  if (events & EVENT_STEP) sound.step(world.player.sneaking);
  if (events & EVENT_KEY) { sound.pickup(); announce('Keycard lifted. The exit stair is open.'); }
  if (events & EVENT_COIN) sound.coinThrow();
  if (events & EVENT_COIN_LAND) sound.coinLand();
  if (events & EVENT_SUSPICIOUS) sound.suspicious();
  if (events & EVENT_ALERT) { sound.alert(); announce('Spotted! Break their line of sight.'); }
  if (events & EVENT_CAUGHT) {
    sound.caught();
    if (world.covers <= 0) {
      screen = SCREEN_OVER;
      announce('Caught for the last time. Game over.');
    } else {
      screen = SCREEN_CAUGHT;
      bannerClock = 1.6;
      announce('Caught. Back to the shadows at the floor entrance.');
    }
  }
  if (events & EVENT_CLEARED) {
    sound.exitOpen();
    if (world.levelIndex >= 2) {
      world.score += world.coins * SCORE.coinUnused;
      screen = SCREEN_WIN;
      sound.win();
      announce('You escaped all three floors.');
    } else {
      screen = SCREEN_CLEAR;
      announce('Floor cleared.');
    }
  }
}

function stepGame(dt) {
  for (const action of input.takeActions()) {
    if (action === 'mute') ui.muted = sound.toggleMute();
    if (action === 'pause' && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
    else if (action === 'pause' && screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    if (action === 'restart' && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      world.loadLevel(world.levelIndex);
      screen = SCREEN_PLAY;
    }
    if (action === 'confirm') {
      sound.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startRun();
      else if (screen === SCREEN_CLEAR) {
        world.loadLevel(world.levelIndex + 1);
        screen = SCREEN_PLAY;
      }
    }
  }
  for (const click of input.takeClicks()) {
    sound.unlock();
    if (screen === SCREEN_PLAY) handleEvents(world.throwCoin(click));
  }
  if (screen === SCREEN_CAUGHT) {
    bannerClock -= dt;
    if (bannerClock <= 0) screen = SCREEN_PLAY;
    return;
  }
  if (screen !== SCREEN_PLAY) return;
  const move = input.vector();
  handleEvents(world.step(dt, move, input.sneaking));
}

const ui = { muted: false };

// --- deterministic screenshot scenes --------------------------------------
// Each scene builds a fresh world, walks the intruder along a scripted safe
// route with the real step function, and freezes a frame that shows the
// stealth systems at work. The seed only picks which scene variant runs.
function stageShot(name) {
  const fresh = new World();
  const walk = (world2, steps, move, sneak = false) => {
    for (let i = 0; i < steps; i += 1) world2.step(STEP, move, sneak);
  };
  if (name === 'sneak') {
    // Floor I: hugging the crates in moonshadow while a warden passes.
    walk(fresh, 150, { x: 1, y: 0 });
    walk(fresh, 190, { x: 0, y: 1 });
    walk(fresh, 120, { x: 1, y: 0 }, true);
    walk(fresh, 260, { x: 0, y: 0 }, true);
    return { world: fresh, screen: SCREEN_PLAY };
  }
  if (name === 'alarm') {
    // Floor II: caught in a cone at the stacks — meter climbing, warden alert.
    fresh.loadLevel(1);
    fresh.score = 1250;
    walk(fresh, 210, { x: 1, y: 0 });
    walk(fresh, 150, { x: 0, y: 1 });
    walk(fresh, 90, { x: 1, y: 0 });
    fresh.exposure = 0.62;
    return { world: fresh, screen: SCREEN_PLAY };
  }
  if (name === 'vault') {
    // Floor III: keycard in hand, coin thrown, exit open across the hall.
    fresh.loadLevel(2);
    fresh.score = 2900;
    fresh.hasKey = true;
    fresh.coins = 2;
    walk(fresh, 200, { x: 1, y: 0 }, true);
    walk(fresh, 140, { x: 0, y: 1 }, true);
    fresh.throwCoin({ x: fresh.player.x + 150, y: fresh.player.y - 60 });
    walk(fresh, 70, { x: 0, y: 0 }, true);
    return { world: fresh, screen: SCREEN_PLAY };
  }
  // 'start' and anything else: the title over floor I.
  walk(fresh, 200, { x: 0, y: 0 });
  return { world: fresh, screen: SCREEN_TITLE };
}

const params = new URLSearchParams(window.location.search);
if (params.has('shot')) {
  const staged = stageShot(params.get('shot'));
  renderer.draw(staged.world, staged.screen, ui);
  announce('Night Ledger screenshot scene.');
} else {
  let last = performance.now();
  let accumulator = 0;
  const frame = (now) => {
    accumulator += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (accumulator >= STEP) {
      stepGame(STEP);
      accumulator -= STEP;
    }
    renderer.draw(world, screen, ui);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
