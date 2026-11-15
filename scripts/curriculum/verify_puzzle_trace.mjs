#!/usr/bin/env node
/**
 * Multi-Environment Puzzle Trace Verifier (`grid`, `depot`, `switchyard`) & Grid ASCII Generator.
 *
 * Usage:
 *   node scripts/curriculum/verify_puzzle_trace.mjs <puzzle.json> [--ascii]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countScopesFlatBlocks,
  executeProgram,
  normalizeColorName,
  normalizeProgramSpec,
  resolveColorLiteral,
} from './lib/sim_core.mjs';

const FACING_VECTORS = {
  N: { dx: 0, dy: -1, left: 'W', right: 'E' },
  E: { dx: 1, dy: 0, left: 'N', right: 'S' },
  S: { dx: 0, dy: 1, left: 'E', right: 'W' },
  W: { dx: -1, dy: 0, left: 'S', right: 'N' },
};

function normalizeFacing(raw) {
  const s = String(raw || 'E').trim().toUpperCase();
  if (s === 'NORTH' || s === 'N') return 'N';
  if (s === 'EAST' || s === 'E') return 'E';
  if (s === 'SOUTH' || s === 'S') return 'S';
  if (s === 'WEST' || s === 'W') return 'W';
  return 'E';
}

function parseGridBarriers(rawBarriers = []) {
  const hEdges = new Set();
  const vEdges = new Set();
  for (const b of rawBarriers) {
    if (typeof b === 'string') {
      const m = b.trim().match(/^([HV])\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
      if (m) {
        const key = `${m[2]},${m[3]}`;
        if (m[1].toUpperCase() === 'H') hEdges.add(key);
        else vEdges.add(key);
      }
    } else if (b && typeof b === 'object') {
      const key = `${b.x},${b.y}`;
      if (String(b.type || '').toUpperCase() === 'H') hEdges.add(key);
      else vEdges.add(key);
    }
  }
  return { hEdges, vEdges };
}

/**
 * Render a standardized `+---+---+` ASCII map diagram from a Robot Grid variant spec.
 */
export function renderGridAscii(mapDef) {
  const width = Number(mapDef.width ?? 4);
  const height = Number(mapDef.height ?? 4);
  const { hEdges, vEdges } = parseGridBarriers(mapDef.barriers || mapDef.walls || []);
  const walkableSet = Array.isArray(mapDef.sharedWalkable)
    ? new Set(mapDef.sharedWalkable.map(([x, y]) => `${x},${y}`))
    : null;
  const startRaw = mapDef.startPose || mapDef.start || { x: 0, y: 0, facing: 'E' };
  const startFacing = normalizeFacing(startRaw.facing ?? startRaw.dir);

  const cellSymbol = (x, y) => {
    if (walkableSet && !walkableSet.has(`${x},${y}`)) return ' # ';
    if (startRaw.x === x && startRaw.y === y) return `R${startFacing} `;
    const flags = mapDef.flags || [];
    const flag = flags.find((f) => f.x === x && f.y === y);
    if (flag) return flag.isGoal ? ' G ' : `F${flag.order || 1} `;
    if (mapDef.goal && mapDef.goal.x === x && mapDef.goal.y === y) return ' G ';
    const water = (mapDef.water || []).find((w) => (Array.isArray(w) ? w[0] === x && w[1] === y : w.x === x && w.y === y));
    if (water) return ' ~ ';
    const dial = (mapDef.dials || []).find((d) => d.x === x && d.y === y);
    if (dial) return `D${dial.value}`.padEnd(3, ' ');
    const item = (mapDef.items || []).find((it) => it.x === x && it.y === y);
    if (item) {
      if (item.kind === 'key') return ' K ';
      if (item.kind === 'plank') return ' P ';
      if (item.kind === 'relic') return ' * ';
      return ' C ';
    }
    const sw = (mapDef.switches || []).find((s) => s.x === x && s.y === y);
    if (sw) return ' S ';
    return ' . ';
  };

  const rows = [];
  for (let y = 0; y < height; y++) {
    let hLine = '+';
    for (let x = 0; x < width; x++) {
      const solid = y === 0 || hEdges.has(`${x},${y}`);
      hLine += solid ? '---+' : '   +';
    }
    rows.push(hLine);

    let cellLine = '|';
    for (let x = 0; x < width; x++) {
      if (x > 0) cellLine += vEdges.has(`${x},${y}`) ? '|' : ' ';
      cellLine += cellSymbol(x, y);
    }
    cellLine += '|';
    rows.push(cellLine);
  }
  rows.push(`+${'---+'.repeat(width)}`);
  return rows.join('\n');
}

function runGridVariant(variant, programSpec, sharedConfig = {}) {
  const width = Number(variant.width ?? sharedConfig.width ?? 4);
  const height = Number(variant.height ?? sharedConfig.height ?? 4);
  const { hEdges, vEdges } = parseGridBarriers(
    variant.barriers || variant.walls || sharedConfig.barriers || []
  );
  const rawWalkable = variant.sharedWalkable ?? sharedConfig.sharedWalkable;
  const walkableSet = Array.isArray(rawWalkable)
    ? new Set(rawWalkable.map(([x, y]) => `${x},${y}`))
    : null;

  const startRaw = variant.startPose || variant.start || sharedConfig.startPose || { x: 0, y: 0, facing: 'E' };
  const robot = {
    x: Number(startRaw.x ?? 0),
    y: Number(startRaw.y ?? 0),
    facing: normalizeFacing(startRaw.facing ?? startRaw.dir),
  };

  const flags = (variant.flags || sharedConfig.flags || []).map((f) => ({
    ...f,
    collected: false,
  }));
  if (variant.goal && flags.length === 0) {
    flags.push({
      id: variant.goal.id || 'goal',
      x: variant.goal.x,
      y: variant.goal.y,
      isGoal: true,
      order: flags.length + 1,
      requiredSwitches: variant.goal.requiredSwitches,
      collected: false,
    });
  }

  const items = (variant.items || sharedConfig.items || []).map((it) => ({
    count: 1,
    ...it,
  }));
  const gates = (variant.gates || sharedConfig.gates || []).map((g) => ({
    open: false,
    ...g,
  }));
  const water = new Map();
  for (const w of variant.water || sharedConfig.water || []) {
    const wx = Array.isArray(w) ? w[0] : w.x;
    const wy = Array.isArray(w) ? w[1] : w.y;
    const bridged = Array.isArray(w) ? false : Boolean(w.bridged);
    water.set(`${wx},${wy}`, { x: wx, y: wy, bridged });
  }
  const switches = variant.switches || sharedConfig.switches || [];
  const dials = variant.dials || sharedConfig.dials || [];
  const beacons = variant.beacons || sharedConfig.beacons || [];
  const pedestals = variant.pedestals || sharedConfig.pedestals || [];

  const visited = new Set([`${robot.x},${robot.y}`]);
  const strictInteraction = Boolean(
    variant.strictInteractionCollision ?? sharedConfig.strictInteractionCollision
  );
  const requireAllItems = Boolean(
    variant.requireAllItemsCollected ?? sharedConfig.requireAllItemsCollected
  );
  const requireEmptyCarry = Boolean(
    variant.requireEmptyBackpackAtGoal ?? sharedConfig.requireEmptyBackpackAtGoal
  );

  let carryingItem = null;
  const trace = [];

  const isSwitchPressed = (sw) =>
    (robot.x === sw.x && robot.y === sw.y) ||
    items.some((it) => it.x === sw.x && it.y === sw.y && it.count > 0);

  const isGateOpen = (gate) => {
    if (gate.open) return true;
    if (gate.linkedSwitch) {
      const sw = switches.find((s) => s.id === gate.linkedSwitch);
      return Boolean(sw && isSwitchPressed(sw));
    }
    return false;
  };

  const canTraverseEdge = (fromX, fromY, toX, toY) => {
    if (toX < 0 || toX >= width || toY < 0 || toY >= height) return false;
    if (walkableSet && !walkableSet.has(`${toX},${toY}`)) return false;
    if (toX === fromX + 1 && vEdges.has(`${toX},${fromY}`)) return false;
    if (toX === fromX - 1 && vEdges.has(`${fromX},${fromY}`)) return false;
    if (toY === fromY + 1 && hEdges.has(`${fromX},${toY}`)) return false;
    if (toY === fromY - 1 && hEdges.has(`${fromX},${fromY}`)) return false;
    const wCell = water.get(`${toX},${toY}`);
    if (wCell && !wCell.bridged) return false;
    const gate = gates.find((g) => g.x === toX && g.y === toY);
    if (gate && !isGateOpen(gate)) return false;
    return true;
  };

  const canStepDir = (facing) => {
    const v = FACING_VECTORS[facing];
    return canTraverseEdge(robot.x, robot.y, robot.x + v.dx, robot.y + v.dy);
  };

  const aheadCell = () => {
    const v = FACING_VECTORS[robot.facing];
    return { x: robot.x + v.dx, y: robot.y + v.dy };
  };

  const allGoalPrereqsMet = (goalFlag) => {
    const uncollectedNonGoal = flags.some((f) => !f.isGoal && !f.collected);
    if (uncollectedNonGoal) return false;
    const reqSw = goalFlag?.requiredSwitches || variant.goal?.requiredSwitches || [];
    for (const swId of reqSw) {
      const sw = switches.find((s) => s.id === swId);
      if (!sw || !isSwitchPressed(sw)) return false;
    }
    for (const sw of switches) {
      if (sw.requiredForGoal && !isSwitchPressed(sw)) return false;
    }
    if (requireAllItems && items.some((it) => it.count > 0 && it.kind !== 'crate' && it.kind !== 'vault_core')) {
      return false;
    }
    if (requireEmptyCarry && carryingItem !== null) return false;
    return true;
  };

  const checkCollectFlag = () => {
    const orderedUncollected = flags
      .filter((f) => f.order > 0 && !f.collected && !f.isGoal)
      .sort((a, b) => a.order - b.order);
    for (const f of flags) {
      if (f.x !== robot.x || f.y !== robot.y || f.isGoal || f.collected) continue;
      if (f.order > 0) {
        if (orderedUncollected[0] && orderedUncollected[0].id === f.id) {
          f.collected = true;
        }
      } else {
        f.collected = true;
      }
    }
  };

  const { scopes, source } = normalizeProgramSpec(programSpec);
  const { runtime, execList } = executeProgram({
    scopes,
    initialVars: variant.initialVars ?? source.initialVars,
    tape: variant.tape ?? source.tape,
    envHooks: {
      resolveSensor(sensorName) {
        if (sensorName === '$tileDial' || sensorName === 'tileDial') {
          const d = dials.find((dl) => dl.x === robot.x && dl.y === robot.y);
          return d ? Number(d.value) : 0;
        }
        if (sensorName === 'tileColor') {
          const b = beacons.find((bc) => bc.x === robot.x && bc.y === robot.y);
          return b ? resolveColorLiteral(b.color) : '#0f172a';
        }
        return undefined;
      },
      evalSensor(cond) {
        const s = cond.sensor;
        if (s === 'pathAhead' || s === 'pathClearAhead') return canStepDir(robot.facing);
        if (s === 'pathLeft') return canStepDir(FACING_VECTORS[robot.facing].left);
        if (s === 'pathRight') return canStepDir(FACING_VECTORS[robot.facing].right);
        if (s === 'unvisitedAhead') {
          const ah = aheadCell();
          return canStepDir(robot.facing) && !visited.has(`${ah.x},${ah.y}`);
        }
        if (s === 'itemHere') {
          if (items.some((it) => it.x === robot.x && it.y === robot.y && it.count > 0)) return true;
          const ah = aheadCell();
          const wAhead = water.get(`${ah.x},${ah.y}`);
          return Boolean(wAhead && wAhead.bridged);
        }
        if (s === 'carryingItem') return carryingItem !== null;
        if (s === 'atGoal') {
          const g = flags.find((f) => f.isGoal && f.x === robot.x && f.y === robot.y);
          return Boolean(g && allGoalPrereqsMet(g));
        }
        if (s === 'tileColor') {
          const b = beacons.find((bc) => bc.x === robot.x && bc.y === robot.y);
          return Boolean(
            b && resolveColorLiteral(b.color) === resolveColorLiteral(cond.color)
          );
        }
        throw new Error(`Unsupported Robot Grid sensor: ${s}`);
      },
      execOp(op) {
        if (op === 'MOVE_FWD' || op === 'FORWARD') {
          const v = FACING_VECTORS[robot.facing];
          const nx = robot.x + v.dx;
          const ny = robot.y + v.dy;
          if (!canTraverseEdge(robot.x, robot.y, nx, ny)) {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `Wall/obstacle ahead at (${nx},${ny})`;
            return;
          }
          robot.x = nx;
          robot.y = ny;
          visited.add(`${robot.x},${robot.y}`);
          checkCollectFlag();
          trace.push({ op, pose: { ...robot } });
          return;
        }
        if (op === 'MOVE_BACK' || op === 'BACKWARD') {
          const v = FACING_VECTORS[robot.facing];
          const nx = robot.x - v.dx;
          const ny = robot.y - v.dy;
          if (!canTraverseEdge(robot.x, robot.y, nx, ny)) {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `Wall/obstacle behind at (${nx},${ny})`;
            return;
          }
          robot.x = nx;
          robot.y = ny;
          visited.add(`${robot.x},${robot.y}`);
          checkCollectFlag();
          trace.push({ op, pose: { ...robot } });
          return;
        }
        if (op === 'TURN_LEFT') {
          robot.facing = FACING_VECTORS[robot.facing].left;
          trace.push({ op, pose: { ...robot } });
          return;
        }
        if (op === 'TURN_RIGHT') {
          robot.facing = FACING_VECTORS[robot.facing].right;
          trace.push({ op, pose: { ...robot } });
          return;
        }
        if (op === 'PICK_UP') {
          if (carryingItem !== null) {
            if (strictInteraction) {
              runtime.status = 'COLLISION';
              runtime.errorDetail = `Shoulder gripper full during PICK_UP`;
            }
            return;
          }
          const idx = items.findIndex((it) => it.x === robot.x && it.y === robot.y && it.count > 0);
          if (idx >= 0) {
            const it = items[idx];
            carryingItem = { ...it, count: 1 };
            it.count -= 1;
            if (it.count <= 0) items.splice(idx, 1);
            trace.push({ op, carryingItem });
            return;
          }
          const ah = aheadCell();
          const wCell = water.get(`${ah.x},${ah.y}`);
          if (wCell && wCell.bridged) {
            wCell.bridged = false;
            carryingItem = { id: `plank_${ah.x}_${ah.y}`, kind: 'plank', count: 1 };
            trace.push({ op, retrievedPlank: ah });
            return;
          }
          if (strictInteraction) {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `Nothing to PICK_UP at (${robot.x},${robot.y})`;
          }
          return;
        }
        if (op === 'USE_DROP') {
          if (carryingItem === null) {
            if (strictInteraction) {
              runtime.status = 'COLLISION';
              runtime.errorDetail = `Empty gripper on USE_DROP`;
            }
            return;
          }
          if (carryingItem.kind === 'key') {
            const ah = aheadCell();
            const gate = gates.find((g) => g.x === ah.x && g.y === ah.y && !g.open);
            if (gate && (!gate.color || gate.color === carryingItem.color)) {
              gate.open = true;
              carryingItem = null;
              trace.push({ op, openedGate: ah });
              return;
            }
          } else if (carryingItem.kind === 'plank') {
            const ah = aheadCell();
            const wCell = water.get(`${ah.x},${ah.y}`);
            if (wCell && !wCell.bridged) {
              wCell.bridged = true;
              carryingItem = null;
              trace.push({ op, bridged: ah });
              return;
            }
          } else {
            const onPedestal = pedestals.some((p) => p.x === robot.x && p.y === robot.y);
            items.push({ ...carryingItem, x: robot.x, y: robot.y, count: 1, onPedestal });
            carryingItem = null;
            trace.push({ op, droppedAt: { x: robot.x, y: robot.y } });
            return;
          }
          if (strictInteraction) {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `Invalid USE_DROP target with ${carryingItem.kind}`;
          }
          return;
        }
        throw new Error(`Unsupported Robot Grid op: ${op}`);
      },
    },
  });

  execList(scopes.MAIN || [], 0, {}, 'main');

  const goalFlag = flags.find((f) => f.isGoal && f.x === robot.x && f.y === robot.y);
  const reachedGoal = Boolean(goalFlag && allGoalPrereqsMet(goalFlag));
  const status =
    runtime.status !== 'OK'
      ? runtime.status
      : reachedGoal
      ? 'SUCCESS'
      : 'FAIL';

  return {
    id: variant.id || 'default',
    status,
    errorDetail:
      runtime.errorDetail || (!reachedGoal && status === 'FAIL' ? `Ended at (${robot.x},${robot.y},${robot.facing})` : null),
    finalPose: robot,
    carryingItem,
    steps: runtime.steps,
    vars: { ...runtime.vars },
    traceLength: trace.length,
  };
}

function getDepotItemValue(item) {
  if (item === undefined || item === null) return undefined;
  if (typeof item === 'number') return item;
  if (typeof item === 'object' && item.value !== undefined) return Number(item.value);
  return undefined;
}

function getDepotItemColor(item) {
  if (item === undefined || item === null) return undefined;
  if (typeof item === 'string') return normalizeColorName(item);
  if (typeof item === 'object' && item.color !== undefined) return normalizeColorName(item.color);
  return undefined;
}

function resolveStationId(raw, vars) {
  if (typeof raw === 'number' || (typeof raw === 'string' && /^[a-z]$/i.test(raw.trim()))) {
    const idx = typeof raw === 'number' ? raw : Number(vars[raw.trim().toLowerCase()] ?? 0);
    if (idx === 1) return 'STACK_1';
    if (idx === 2) return 'STACK_2';
    if (idx === 3) return 'STACK_3';
    return `INVALID_${idx}`;
  }
  const s = String(raw || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (s === 'STACK1' || s === '1') return 'STACK_1';
  if (s === 'STACK2' || s === '2') return 'STACK_2';
  if (s === 'STACK3' || s === '3') return 'STACK_3';
  if (s === 'OUT') return 'OUTPUT';
  return s;
}

function runDepotVariant(variant, programSpec, sharedConfig = {}) {
  const stacks = (variant.stacks ?? sharedConfig.stacks ?? [[], [], []]).map((st) => [...st]);
  const queue = [...(variant.queue ?? sharedConfig.queue ?? [])];
  const inputQueue = [...(variant.inputQueue ?? sharedConfig.inputQueue ?? [])];
  const output = [...(variant.output ?? [])];
  const accept = [];
  const reject = [];

  let workerStation = resolveStationId(variant.workerStation ?? sharedConfig.workerStation ?? 'STACK_1', {});
  let clawItem = variant.clawItem ?? null;
  const enforceHanoi = Boolean(variant.enforceHanoiRule ?? sharedConfig.enforceHanoiRule);

  const peekStationTop = (stId) => {
    if (stId === 'STACK_1') return stacks[0][stacks[0].length - 1];
    if (stId === 'STACK_2') return stacks[1][stacks[1].length - 1];
    if (stId === 'STACK_3') return stacks[2][stacks[2].length - 1];
    if (stId === 'QUEUE') return queue[0];
    if (stId === 'INPUT') return inputQueue[0];
    return undefined;
  };

  const isStationEmpty = (stId) => {
    if (stId === 'STACK_1') return stacks[0].length === 0;
    if (stId === 'STACK_2') return stacks[1].length === 0;
    if (stId === 'STACK_3') return stacks[2].length === 0;
    if (stId === 'QUEUE') return queue.length === 0;
    if (stId === 'INPUT') return inputQueue.length === 0;
    return true;
  };

  const popStation = (stId) => {
    if (stId === 'STACK_1') return stacks[0].pop();
    if (stId === 'STACK_2') return stacks[1].pop();
    if (stId === 'STACK_3') return stacks[2].pop();
    if (stId === 'QUEUE') return queue.shift();
    if (stId === 'INPUT') return inputQueue.shift();
    return undefined;
  };

  const pushStation = (stId, item) => {
    if (stId === 'STACK_1') return stacks[0].push(item);
    if (stId === 'STACK_2') return stacks[1].push(item);
    if (stId === 'STACK_3') return stacks[2].push(item);
    if (stId === 'QUEUE') return queue.push(item);
    if (stId === 'OUTPUT') return output.push(item);
    return -1;
  };

  const { scopes, source } = normalizeProgramSpec(programSpec);
  const { runtime, execList } = executeProgram({
    scopes,
    initialVars: variant.initialVars ?? source.initialVars,
    tape: variant.tape ?? sharedConfig.tape ?? source.tape,
    envHooks: {
      resolveSensor(sensorName, { vars }) {
        if (sensorName === '$heldValue') {
          const v = getDepotItemValue(clawItem);
          return v === undefined ? 'TYPE_ERROR' : v;
        }
        if (sensorName === '$heldColor') {
          const c = getDepotItemColor(clawItem);
          return c === undefined ? 'TYPE_ERROR' : resolveColorLiteral(c);
        }
        const topValMatch = sensorName.match(/^\$topValue(?:\[([^\]]+)\])?$/);
        if (topValMatch) {
          const st = topValMatch[1] ? resolveStationId(topValMatch[1], vars) : workerStation;
          const v = getDepotItemValue(peekStationTop(st));
          return v === undefined ? 'TYPE_ERROR' : v;
        }
        const topColMatch = sensorName.match(/^\$topColor(?:\[([^\]]+)\])?$/);
        if (topColMatch) {
          const st = topColMatch[1] ? resolveStationId(topColMatch[1], vars) : workerStation;
          const c = getDepotItemColor(peekStationTop(st));
          return c === undefined ? 'TYPE_ERROR' : resolveColorLiteral(c);
        }
        return undefined;
      },
      evalSensor(cond, { vars }) {
        const s = cond.sensor;
        if (s === 'stationEmpty') {
          const st = resolveStationId(cond.station || workerStation, vars);
          return isStationEmpty(st);
        }
        if (s === 'hasItem') {
          if (cond.station) {
            return !isStationEmpty(resolveStationId(cond.station, vars));
          }
          return clawItem !== null;
        }
        if (s === 'carryingItem') return clawItem !== null;
        throw new Error(`Unsupported Depot sensor: ${s}`);
      },
      execOp(op, block, { resolveRawValue, vars }) {
        if (op === 'DEPOT_MOVE_TO') {
          const targetRaw = resolveRawValue(block.station ?? block.target ?? block.value);
          const st = resolveStationId(targetRaw, vars);
          if (st.startsWith('INVALID_')) {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `Station index out of range (${st})`;
            return;
          }
          workerStation = st;
          return;
        }
        if (op === 'DEPOT_GRAB' || op === 'PICK_UP') {
          const st = block.station ? resolveStationId(resolveRawValue(block.station), vars) : workerStation;
          if (clawItem !== null) {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `Claw full on ${op}`;
            return;
          }
          if (isStationEmpty(st)) {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `Empty station ${st} on ${op}`;
            return;
          }
          clawItem = popStation(st);
          return;
        }
        if (op === 'DEPOT_PLACE' || op === 'PLACE') {
          const st = block.station ? resolveStationId(resolveRawValue(block.station), vars) : workerStation;
          if (clawItem === null) {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `Empty claw on ${op}`;
            return;
          }
          if (st === 'INPUT') {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `Cannot place onto one-way INPUT dispenser`;
            return;
          }
          if (enforceHanoi && ['STACK_1', 'STACK_2', 'STACK_3'].includes(st) && !isStationEmpty(st)) {
            const heldVal = getDepotItemValue(clawItem) ?? 0;
            const topVal = getDepotItemValue(peekStationTop(st)) ?? 0;
            if (heldVal > topVal) {
              runtime.status = 'COLLISION';
              runtime.errorDetail = `Hanoi rule violated: ${heldVal} > ${topVal} on ${st}`;
              return;
            }
          }
          pushStation(st, clawItem);
          clawItem = null;
          return;
        }
        if (op === 'DEPOT_SEND_OUT' || op === 'DEPOT_SEND_GATE') {
          if (clawItem === null) {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `Empty claw on ${op}`;
            return;
          }
          const gate = String(block.gate || 'OUT').toUpperCase();
          if (gate === 'ACCEPT') accept.push(clawItem);
          else if (gate === 'REJECT') reject.push(clawItem);
          else output.push(clawItem);
          clawItem = null;
          return;
        }
        throw new Error(`Unsupported Depot op: ${op}`);
      },
    },
  });

  execList(scopes.MAIN || [], 0, {}, 'main');

  let matched = runtime.status === 'OK' && clawItem === null;
  let mismatchReason = null;

  if (matched && variant.targetStacks) {
    if (JSON.stringify(stacks) !== JSON.stringify(variant.targetStacks)) {
      matched = false;
      mismatchReason = `Stacks mismatch: got ${JSON.stringify(stacks)}, expected ${JSON.stringify(
        variant.targetStacks
      )}`;
    }
  }
  if (matched && variant.targetOutput) {
    if (JSON.stringify(output) !== JSON.stringify(variant.targetOutput)) {
      matched = false;
      mismatchReason = `Output mismatch: got ${JSON.stringify(output)}, expected ${JSON.stringify(
        variant.targetOutput
      )}`;
    }
  }
  if (matched && variant.expectedVerdict) {
    const got = accept.length > 0 ? 'ACCEPT' : reject.length > 0 ? 'REJECT' : 'NONE';
    if (got !== String(variant.expectedVerdict).toUpperCase()) {
      matched = false;
      mismatchReason = `Verdict mismatch: got ${got}, expected ${variant.expectedVerdict}`;
    }
  }
  if (matched && variant.targetTapeCells) {
    for (const [cellIdx, expected] of Object.entries(variant.targetTapeCells)) {
      if (runtime.tape.cells[cellIdx] !== expected) {
        matched = false;
        mismatchReason = `Tape[${cellIdx}] = ${runtime.tape.cells[cellIdx]}, expected ${expected}`;
        break;
      }
    }
  }

  return {
    id: variant.id || 'default',
    status: runtime.status !== 'OK' ? runtime.status : matched ? 'SUCCESS' : 'FAIL',
    errorDetail: runtime.errorDetail || mismatchReason,
    stacks,
    queue,
    output,
    accept,
    reject,
    steps: runtime.steps,
  };
}

function runSwitchyardVariant(variant, programSpec, sharedConfig = {}) {
  const stream = (variant.stream ?? sharedConfig.stream ?? []).map((item) =>
    typeof item === 'number' ? { weight: item, icon: 'Crate', color: 'blue', damaged: false } : { ...item }
  );
  const switchCount = Number(variant.switchCount ?? sharedConfig.switchCount ?? 1);
  const switches = {
    A: 'LEFT',
    B: 'LEFT',
    ...(sharedConfig.initialSwitches || {}),
    ...(variant.initialSwitches || {}),
  };
  const dockCount = switchCount === 0 ? 1 : switchCount === 1 ? 2 : 3;
  const docks = Array.from({ length: dockCount }, () => []);
  const dockQuotas = [...(variant.dockQuotas ?? variant.quotas ?? sharedConfig.dockQuotas ?? [])];
  const scrapped = [];
  let cursor = 0;

  const activeDockIndex = () => {
    if (switchCount === 0) return 0;
    if (switchCount === 1) return switches.A === 'LEFT' ? 0 : 1;
    return switches.A === 'LEFT' ? 0 : switches.B === 'LEFT' ? 1 : 2;
  };

  const currentItem = () => (cursor < stream.length ? stream[cursor] : null);
  const scrapRule = variant.scrapRule ?? sharedConfig.scrapRule ?? 'itemDamaged';

  const { scopes, source } = normalizeProgramSpec(programSpec);
  const { runtime, execList } = executeProgram({
    scopes,
    initialVars: variant.initialVars ?? source.initialVars,
    tape: variant.tape ?? source.tape,
    envHooks: {
      resolveSensor(sensorName) {
        const curr = currentItem();
        if (sensorName === 'itemColor') return curr ? resolveColorLiteral(curr.color) : '#0f172a';
        if (sensorName === 'itemIcon') return curr ? String(curr.icon || 'Crate') : '';
        if (sensorName === '$itemWeight') return curr ? Number(curr.weight ?? 0) : 0;
        const dcMatch = sensorName.match(/^\$dockCount\[([^\]]+)\]$/);
        if (dcMatch) {
          const rawIdx = dcMatch[1].toUpperCase();
          const idx = rawIdx === 'A' ? 0 : rawIdx === 'B' ? 1 : rawIdx === 'C' ? 2 : Number(rawIdx);
          return (docks[idx] || []).length;
        }
        const dqMatch = sensorName.match(/^\$dockQuota\[([^\]]+)\]$/);
        if (dqMatch) {
          const rawIdx = dqMatch[1].toUpperCase();
          const idx = rawIdx === 'A' ? 0 : rawIdx === 'B' ? 1 : rawIdx === 'C' ? 2 : Number(rawIdx);
          return Number(dockQuotas[idx] ?? 0);
        }
        return undefined;
      },
      evalSensor(cond) {
        const s = cond.sensor;
        if (s === 'hasNextItem') return cursor < stream.length;
        if (s === 'itemDamaged') return Boolean(currentItem()?.damaged);
        throw new Error(`Unsupported Switchyard sensor: ${s}`);
      },
      execOp(op, block) {
        if (op === 'SWITCH_LEFT') {
          const id = String(block.switchId || 'A').toUpperCase();
          switches[id] = 'LEFT';
          return;
        }
        if (op === 'SWITCH_RIGHT') {
          const id = String(block.switchId || 'A').toUpperCase();
          switches[id] = 'RIGHT';
          return;
        }
        if (op === 'SEND_NEXT') {
          const item = currentItem();
          if (!item) {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `SEND_NEXT on empty scanner`;
            return;
          }
          const dIdx = activeDockIndex();
          docks[dIdx].push(item);
          cursor += 1;
          return;
        }
        if (op === 'SCRAP_ITEM') {
          const item = currentItem();
          if (!item) {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `SCRAP_ITEM on empty scanner`;
            return;
          }
          const allowed =
            scrapRule === 'always' ||
            Boolean(item.damaged) ||
            (typeof scrapRule === 'object' &&
              scrapRule.maxWeight !== undefined &&
              Number(item.weight ?? 0) > Number(scrapRule.maxWeight));
          if (!allowed) {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `Scrapped valid non-hazard item: ${JSON.stringify(item)}`;
            return;
          }
          scrapped.push(item);
          cursor += 1;
          return;
        }
        throw new Error(`Unsupported Switchyard op: ${op}`);
      },
    },
  });

  execList(scopes.MAIN || [], 0, {}, 'main');

  let matched = runtime.status === 'OK' && cursor === stream.length;
  let mismatchReason = cursor !== stream.length ? `${stream.length - cursor} cars stranded in feeder` : null;

  const expectedDocks = variant.expectedDocks || (variant.expectedLeft || variant.expectedRight ? [variant.expectedLeft, variant.expectedRight].filter(Boolean) : null);
  if (matched && expectedDocks) {
    for (let i = 0; i < expectedDocks.length; i++) {
      if (JSON.stringify(docks[i]) !== JSON.stringify(expectedDocks[i])) {
        matched = false;
        mismatchReason = `Dock ${i} mismatch: got ${JSON.stringify(docks[i])}, expected ${JSON.stringify(
          expectedDocks[i]
        )}`;
        break;
      }
    }
  }

  const dockRules = variant.dockRules || sharedConfig.dockRules;
  if (matched && Array.isArray(dockRules)) {
    for (let i = 0; i < dockRules.length; i++) {
      const rule = dockRules[i];
      const delivered = docks[i] || [];
      if (rule.rejectDamaged !== false && delivered.some((c) => c.damaged)) {
        matched = false;
        mismatchReason = `Damaged car delivered to Dock ${i}`;
        break;
      }
      if (rule.acceptIcons && delivered.some((c) => !rule.acceptIcons.includes(c.icon))) {
        matched = false;
        mismatchReason = `Unexpected icon delivered to Dock ${i}`;
        break;
      }
      if (rule.acceptColors && delivered.some((c) => !rule.acceptColors.includes(c.color))) {
        matched = false;
        mismatchReason = `Unexpected color delivered to Dock ${i}`;
        break;
      }
      if (rule.maxWeight !== undefined && delivered.some((c) => Number(c.weight ?? 0) > rule.maxWeight)) {
        matched = false;
        mismatchReason = `Overweight car in Dock ${i}`;
        break;
      }
      if (rule.exactCount !== undefined && delivered.length !== rule.exactCount) {
        matched = false;
        mismatchReason = `Dock ${i} count ${delivered.length} !== ${rule.exactCount}`;
        break;
      }
    }
  }

  return {
    id: variant.id || 'default',
    status: runtime.status !== 'OK' ? runtime.status : matched ? 'SUCCESS' : 'FAIL',
    errorDetail: runtime.errorDetail || mismatchReason,
    docks,
    scrapped,
    steps: runtime.steps,
  };
}

/**
 * Verify a puzzle spec (env, slotCap, partialHelp, and referenceSolution across all variants).
 */
export function verifyPuzzleSpec(spec) {
  const env = String(spec.env || 'grid').toLowerCase();
  const variants = Array.isArray(spec.variants) && spec.variants.length > 0 ? spec.variants : [spec.world || {}];

  const refSpec = spec.referenceSolution || { scopes: spec.scopes || { MAIN: spec.MAIN || [] } };
  const refNorm = normalizeProgramSpec(refSpec);
  const blockCounts = countScopesFlatBlocks(refNorm.scopes);

  const runner =
    env === 'grid'
      ? runGridVariant
      : env === 'depot'
      ? runDepotVariant
      : env === 'switchyard'
      ? runSwitchyardVariant
      : null;

  if (!runner) throw new Error(`Unsupported puzzle verification env: ${env}`);

  const variantResults = variants.map((v) => runner(v, refSpec, spec));
  const allPassed = variantResults.every((r) => r.status === 'SUCCESS');

  let slotCapOk = true;
  if (spec.slotCap) {
    const maxTotal = typeof spec.slotCap === 'number' ? spec.slotCap : spec.slotCap.maxTotal;
    if (maxTotal !== undefined && blockCounts.total > maxTotal) slotCapOk = false;
    if (spec.slotCap.perScope) {
      for (const [k, limit] of Object.entries(spec.slotCap.perScope)) {
        if ((blockCounts.byScope[k] || 0) > limit) slotCapOk = false;
      }
    }
  }

  let partialHelpStatus = null;
  if (spec.partialHelp) {
    const partialRes = runner(variants[0], spec.partialHelp, spec);
    partialHelpStatus = partialRes.status;
  }

  return {
    id: spec.id || 'puzzle',
    env,
    blockCounts,
    slotCapOk,
    partialHelpStatus,
    allPassed: allPassed && slotCapOk,
    variants: variantResults,
  };
}

function runCli() {
  const args = process.argv.slice(2);
  const showAscii = args.includes('--ascii');
  const specPath = args.find((a) => !a.startsWith('--'));
  if (!specPath) {
    console.error('Usage: node scripts/curriculum/verify_puzzle_trace.mjs <puzzle.json> [--ascii]');
    process.exit(1);
  }
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8').replace(/^\uFEFF/, ''));
  const report = verifyPuzzleSpec(spec);

  if (showAscii && String(spec.env || 'grid').toLowerCase() === 'grid') {
    const variants = Array.isArray(spec.variants) && spec.variants.length > 0 ? spec.variants : [spec.world || {}];
    variants.forEach((v, idx) => {
      console.log(`--- Variant ${v.id || idx + 1} ---`);
      console.log(renderGridAscii({ ...spec, ...v }));
    });
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.allPassed) {
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runCli();
}
