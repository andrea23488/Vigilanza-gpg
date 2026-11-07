export const SHIP = { width: 36, height: 34 };
export const ENEMY = { width: 28, height: 28 };
export function clampShip(x, width) { return Math.max(0, Math.min(width - SHIP.width, x)); }
export function createGame(width) { return { shipX: clampShip(width / 2 - 18, width), bullets: [], enemies: [], lives: 3, score: 0, spawn: 0, fire: 0, serial: 0 }; }
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
export function advanceGame(game, dt, width, height, targetX, random = Math.random) {
  const next = { ...game, shipX: clampShip(targetX, width), serial: game.serial };
  if (game.lives <= 0) return next;
  const seconds = Math.max(0, Math.min(dt, 0.04));
  next.fire += seconds; next.spawn += seconds;
  const bullets = game.bullets.map(b => ({ ...b, previousY: b.y, y: b.y - seconds * 420 }));
  const enemies = game.enemies.map(e => ({ ...e, y: e.y + seconds * (66 + Math.min(80, game.score / 3)) }));
  if (next.fire >= 0.23) { next.fire %= 0.23; bullets.push({ id: ++next.serial, x: next.shipX + 16, y: height - SHIP.height - 24, previousY: height - SHIP.height - 24 }); }
  if (next.spawn >= Math.max(0.32, 0.85 - game.score / 1000)) { next.spawn = 0; enemies.push({ id: ++next.serial, x: 4 + random() * Math.max(0, width - ENEMY.width - 8), y: -ENEMY.height }); }
  const hitBullets = new Set(), hitEnemies = new Set();
  bullets.forEach(b => enemies.forEach(e => {
    if (!hitBullets.has(b.id) && !hitEnemies.has(e.id) && overlaps({ x: b.x, y: b.y, width: 4, height: b.previousY - b.y + 14 }, { ...e, ...ENEMY })) { hitBullets.add(b.id); hitEnemies.add(e.id); next.score += 10; }
  }));
  const ship = { x: next.shipX, y: height - SHIP.height - 10, ...SHIP };
  next.enemies = enemies.filter(e => {
    if (hitEnemies.has(e.id)) return false;
    if (e.y > height || overlaps({ ...e, ...ENEMY }, ship)) { next.lives = Math.max(0, next.lives - 1); return false; }
    return true;
  });
  next.bullets = bullets.filter(b => b.y > -14 && !hitBullets.has(b.id));
  return next;
}
