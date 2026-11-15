/**
 * Shared Curriculum AST, Bidirectional Pseudocode Parser/Formatter,
 * Closer-Inclusive Block Counter, and Deterministic Interpreter Runtime.
 *
 * Used by render_logo_svg.mjs, verify_puzzle_trace.mjs, and audit_curriculum_docs.mjs.
 */

export const MAX_STEPS = 10000;
export const MAX_CALL_DEPTH = 64;
export const DEFAULT_STEP_DISTANCE = 100;
export const DEFAULT_ARC_RADIUS = 50;
export const DEFAULT_ARC_ANGLE = 90;

export const PALETTE_COLOR_NAMES = [
  'black',
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'pink',
  'cyan',
  'orange',
  'white',
];

export const PALETTE_COLORS = {
  0: '#0f172a',
  black: '#0f172a',
  1: '#ef4444',
  red: '#ef4444',
  2: '#3b82f6',
  blue: '#3b82f6',
  3: '#10b981',
  green: '#10b981',
  4: '#f59e0b',
  amber: '#f59e0b',
  yellow: '#f59e0b',
  gold: '#f59e0b',
  5: '#8b5cf6',
  purple: '#8b5cf6',
  6: '#ec4899',
  pink: '#ec4899',
  7: '#06b6d4',
  cyan: '#06b6d4',
  8: '#f97316',
  orange: '#f97316',
  coral: '#f97316',
  9: '#ffffff',
  white: '#ffffff',
};

export const RANDOM_VIBRANT_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

const BOOLEAN_SENSORS = new Set([
  'insideCanvas',
  'pathAhead',
  'pathClearAhead',
  'pathLeft',
  'pathRight',
  'unvisitedAhead',
  'itemHere',
  'carryingItem',
  'atGoal',
  'cursorAtEdge',
  'hasNextItem',
  'itemDamaged',
  '$cellEmpty',
  'cellEmpty',
  '$pointerDown',
]);

const PARAM_SENSORS = new Set(['stationEmpty', 'hasItem', 'keyHeld']);

const SOCKET_TOKEN_MAP = {
  '●': '$p0',
  '▲': '$p1',
  '■': '$p2',
  '[Fn]': '$fn',
  'fn': '$fn',
};

/**
 * Resolve any color literal, index (0..9), or alias into a CSS hex color.
 */
export function resolveColorLiteral(color) {
  if (color === undefined || color === null) return '#0f172a';
  if (typeof color === 'number' && PALETTE_COLORS[color]) return PALETTE_COLORS[color];
  const s = String(color).trim();
  const lower = s.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(PALETTE_COLORS, lower)) {
    return PALETTE_COLORS[lower];
  }
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
  return '#0f172a';
}

/**
 * Normalize color token to canonical lowercase color name when possible.
 */
export function normalizeColorName(color) {
  if (color === undefined || color === null) return 'black';
  if (typeof color === 'number' && PALETTE_COLOR_NAMES[color]) {
    return PALETTE_COLOR_NAMES[color];
  }
  const s = String(color).trim().toLowerCase();
  if (s === 'amber' || s === 'gold') return 'yellow';
  if (s === 'coral') return 'orange';
  if (Object.prototype.hasOwnProperty.call(PALETTE_COLORS, s)) {
    return s;
  }
  const hex = s.toLowerCase();
  for (const name of PALETTE_COLOR_NAMES) {
    if (PALETTE_COLORS[name].toLowerCase() === hex) return name;
  }
  return String(color).trim();
}

/**
 * Deterministic 32-bit PRNG (Mulberry32) for static SVG / verification previews.
 */
export function createMulberry32(seed = 42) {
  let a = (Number(seed) || 42) >>> 0;
  return function nextRand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Closer-inclusive flat block count matching workspace slot-budget rules:
 * - LOOP / LOOP_START / WHILE: 2 + count(body)
 * - IF: 2 + count(then) + sum(elseIf: 1 + count(body)) + (Array.isArray(else) ? 1 + count(else) : 0)
 * - ON_EVENT with body: 2 + count(body)
 * - Other blocks: 1
 */
export function countFlatBlocks(blocks) {
  if (!Array.isArray(blocks)) return 0;
  let total = 0;
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    const op = String(b.op || b.type || '').toUpperCase();
    if (op === 'LOOP' || op === 'LOOP_START' || op === 'WHILE') {
      total += 2 + countFlatBlocks(b.body || []);
    } else if (op === 'IF') {
      total += 2 + countFlatBlocks(b.then || b.body || []);
      if (Array.isArray(b.elseIfs)) {
        for (const ei of b.elseIfs) {
          total += 1 + countFlatBlocks(ei?.body || []);
        }
      }
      if (Array.isArray(b.else)) {
        total += 1 + countFlatBlocks(b.else);
      }
    } else if (op === 'ON_EVENT' && Array.isArray(b.body)) {
      total += 2 + countFlatBlocks(b.body);
    } else {
      total += 1;
    }
  }
  return total;
}

/**
 * Compute closer-inclusive block counts across all non-empty scopes in a workspace map.
 */
export function countScopesFlatBlocks(scopes) {
  const byScope = {};
  let total = 0;
  for (const [k, v] of Object.entries(scopes || {})) {
    if (Array.isArray(v) && v.length > 0) {
      const c = countFlatBlocks(v);
      byScope[k] = c;
      total += c;
    }
  }
  return { byScope, total };
}

function normalizeScopeKey(rawKey) {
  const upper = String(rawKey || 'MAIN')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (upper === 'MAIN1') return 'MAIN_1';
  if (upper === 'MAIN2') return 'MAIN_2';
  if (upper === 'MAIN3') return 'MAIN_3';
  if (upper === 'MAIN4') return 'MAIN_4';
  return upper;
}

/**
 * Parse a single scalar token from pseudocode into JSON AST literal/symbol.
 */
function parseScalarToken(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  if (s === '∅' || s.toUpperCase() === 'CLEAR') return 'CLEAR';
  if (Object.prototype.hasOwnProperty.call(SOCKET_TOKEN_MAP, s)) {
    return SOCKET_TOKEN_MAP[s];
  }
  const bracketSensorMatch = s.match(/^(\$?[A-Za-z_][A-Za-z0-9_]*)\s*\[\s*([^\]]+)\s*\]$/);
  if (bracketSensorMatch) {
    return `${bracketSensorMatch[1]}[${bracketSensorMatch[2].trim()}]`;
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function splitCommaArgs(raw) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of raw) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}

function stripOuterParens(expr) {
  const s = expr.trim();
  if (!s.startsWith('(') || !s.endsWith(')')) return s;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0 && i < s.length - 1) return s;
    }
  }
  return stripOuterParens(s.slice(1, -1));
}

function splitTopLevelLogical(expr, keywordRegex) {
  const s = expr.trim();
  let depth = 0;
  let bracketDepth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (depth === 0 && bracketDepth === 0) {
      const sub = s.slice(i);
      const m = sub.match(keywordRegex);
      if (m) {
        return {
          left: s.slice(0, i).trim(),
          right: s.slice(i + m[0].length).trim(),
        };
      }
    }
  }
  return null;
}

/**
 * Parse a pseudocode boolean/comparison condition expression into canonical JSON AST.
 */
export function parseCondition(rawExpr) {
  const s = stripOuterParens(String(rawExpr || '').trim());
  if (!s) throw new Error('Empty condition expression');

  const orSplit = splitTopLevelLogical(s, /^(?:\s+OR\s+|\s*\|\|\s*)/i);
  if (orSplit && orSplit.left && orSplit.right) {
    return {
      op: 'OR',
      left: parseCondition(orSplit.left),
      right: parseCondition(orSplit.right),
    };
  }

  const andSplit = splitTopLevelLogical(s, /^(?:\s+AND\s+|\s*&&\s*)/i);
  if (andSplit && andSplit.left && andSplit.right) {
    return {
      op: 'AND',
      left: parseCondition(andSplit.left),
      right: parseCondition(andSplit.right),
    };
  }

  const notMatch = s.match(/^(?:NOT\s+|!\s*)(.+)$/i);
  if (notMatch) {
    return { op: 'NOT', expr: parseCondition(notMatch[1]) };
  }

  // Top-level binary comparison (outside parens/brackets)
  let depth = 0;
  let bracketDepth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (depth === 0 && bracketDepth === 0) {
      const cmpMatch = s.slice(i).match(/^(===|!==|==|!=|<=|>=|<|>)/);
      if (cmpMatch) {
        const leftStr = s.slice(0, i).trim();
        const rightStr = s.slice(i + cmpMatch[0].length).trim();
        if (leftStr && rightStr) {
          const operator =
            cmpMatch[1] === '===' ? '==' : cmpMatch[1] === '!==' ? '!=' : cmpMatch[1];
          return {
            op: 'CMP',
            operator,
            left: parseScalarToken(leftStr),
            right: parseScalarToken(rightStr),
          };
        }
      }
    }
  }

  // Parameterized sensor: stationEmpty [STACK_1] or keyHeld(LEFT)
  const paramSensorMatch = s.match(
    /^(\$?[A-Za-z_][A-Za-z0-9_]*)\s*(?:\[\s*([^\]]+)\s*\]|\(\s*([^)]+)\s*\))$/
  );
  if (paramSensorMatch) {
    const sensor = paramSensorMatch[1];
    const arg = (paramSensorMatch[2] ?? paramSensorMatch[3] ?? '').trim();
    if (sensor === 'keyHeld') return { op: 'SENSOR', sensor, key: arg };
    return { op: 'SENSOR', sensor, station: arg };
  }

  if (BOOLEAN_SENSORS.has(s) || PARAM_SENSORS.has(s) || /^[A-Za-z_$][A-Za-z0-9_]*$/.test(s)) {
    return { op: 'SENSOR', sensor: s };
  }

  throw new Error(`Unable to parse condition expression: "${rawExpr}"`);
}

function buildActionBlock(opRaw, argList, repeat) {
  const op = opRaw.toUpperCase();
  const args = argList.map((a) => parseScalarToken(a));
  const block = { op };

  switch (op) {
    case 'FORWARD':
    case 'MOVE_FWD':
    case 'BACKWARD':
    case 'MOVE_BACK':
      if (args.length > 0 && args[0] !== '') block.length = args[0];
      break;
    case 'TURN_LEFT':
    case 'TURN_RIGHT':
      if (args.length > 0 && args[0] !== '') block.angle = args[0];
      break;
    case 'ARC_LEFT':
    case 'ARC_RIGHT':
      if (args.length >= 1) block.radius = args[0];
      if (args.length >= 2) block.angle = args[1];
      break;
    case 'TELEPORT':
      if (args.length >= 1) block.x = args[0];
      if (args.length >= 2) block.y = args[1];
      if (args.length >= 3) block.heading = args[2];
      break;
    case 'SET_PEN_COLOR':
    case 'SET_LED_COLOR':
      if (args.length >= 1) {
        block.color = typeof args[0] === 'string' && !args[0].startsWith('$') && !/^[a-z]$/i.test(args[0])
          ? normalizeColorName(args[0])
          : args[0];
      }
      break;
    case 'SET_PEN_WIDTH':
      if (args.length >= 1) block.width = args[0];
      break;
    case 'PLAY_NOTE':
      if (args.length >= 1) block.pitch = args[0];
      if (args.length >= 2) block.duration = args[1];
      break;
    case 'SET_BEAT_DELAY':
      if (args.length >= 1) block.stepDelayMultiplier = args[0];
      break;
    case 'WAIT_BEAT':
    case 'WAIT':
      if (args.length >= 1) block.beats = args[0];
      break;
    case 'STAMP_PRESET':
      if (args.length >= 1) block.preset = args[0];
      break;
    case 'LIGHT_ROW':
      if (args.length >= 1) block.row = args[0];
      break;
    case 'LIGHT_COL':
      if (args.length >= 1) block.col = args[0];
      break;
    case 'LIGHT_PIXEL':
      if (args.length >= 1) block.x = args[0];
      if (args.length >= 2) block.y = args[1];
      break;
    case 'CURSOR_TURN':
      if (args.length >= 1) block.direction = String(args[0]).toUpperCase();
      break;
    case 'SWITCH_LEFT':
    case 'SWITCH_RIGHT':
      if (args.length >= 1) block.switchId = String(args[0]).toUpperCase();
      break;
    case 'DEPOT_MOVE_TO':
      if (args.length >= 1) block.station = args[0];
      break;
    case 'DEPOT_SEND_GATE':
      if (args.length >= 1) block.gate = String(args[0]).toUpperCase();
      break;
    case 'PICK_UP':
    case 'PLACE':
      if (args.length >= 1) block.station = args[0];
      break;
    case 'TAPE_SEEK':
      if (args.length >= 1) block.index = args[0];
      break;
    case 'TAPE_STEP':
      if (args.length >= 1) block.direction = String(args[0]).toUpperCase();
      break;
    case 'TAPE_WRITE':
      if (args.length >= 1) block.value = args[0];
      break;
    default:
      if (args.length === 1) block.value = args[0];
      else if (args.length > 1) block.args = args;
      break;
  }

  if (repeat !== undefined) {
    block.repeat = parseScalarToken(repeat);
  }
  return block;
}

/**
 * Parse canonical course-doc pseudocode into `{ scopes, signatures }`.
 */
export function parsePseudocode(sourceText) {
  const scopes = { MAIN: [] };
  const signatures = {};
  let currentScope = 'MAIN';
  let stack = [];

  const appendToCurrent = (block) => {
    if (stack.length === 0) {
      if (!scopes[currentScope]) scopes[currentScope] = [];
      scopes[currentScope].push(block);
      return;
    }
    const top = stack[stack.length - 1];
    if (top.op === 'IF') {
      if (top._branch === 'then') top.then.push(block);
      else if (top._branch === 'else') top.else.push(block);
      else top.elseIfs[top._branch].body.push(block);
    } else {
      top.body.push(block);
    }
  };

  const lines = String(sourceText || '').split(/\r?\n/);
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    let line = lines[lineIdx].trim();
    if (!line) continue;

    // 1. Scope header line (supports "// MAIN", "MAIN (8 flat blocks):", "// F1(●, ▲) (2 flat blocks)", "// F1 — Desc")
    const headerMatch = line.match(
      /^(?:\/\/\s*)?(MAIN(?:\s*[_\s]?\d)?|F[1-3])(?:\s*\(([^)]*)\))?(?:\s*\(\s*\d+\s*flat\s*blocks?\s*\))?(?:\s*(?::|[—–-])\s*.*|\s*$)/i
    );
    if (headerMatch) {
      const candidateKey = normalizeScopeKey(headerMatch[1]);
      const parenText = (headerMatch[2] || '').trim();
      const looksLikeScopeHeader =
        line.startsWith('//') ||
        line.endsWith(':') ||
        /^(MAIN(?:\s*[_\s]?\d)?|F[1-3])(?:\s*\([^)]*\))?(?:\s*\(\s*\d+\s*flat\s*blocks?\s*\))?\s*:?\s*$/i.test(
          line
        );
      if (looksLikeScopeHeader) {
        if (stack.length > 0) {
          throw new Error(`Unclosed control block in ${currentScope} before ${candidateKey}`);
        }
        currentScope = candidateKey;
        if (!scopes[currentScope]) scopes[currentScope] = [];
        if (
          parenText &&
          !/flat\s*blocks?|^\d+\s*blocks?/i.test(parenText)
        ) {
          signatures[currentScope] = splitCommaArgs(parenText).map(parseScalarToken);
        }
        continue;
      }
    }

    // Strip comments and optional list item numbering ("1. ", "2. ")
    line = line.replace(/\/\/.*$/, '').trim();
    line = line.replace(/^\d+\.\s+/, '').trim();
    if (!line) continue;

    // 2. Control structure closers & branches
    if (/^(?:End\s+Loop|LOOP_END)$/i.test(line)) {
      const top = stack.pop();
      if (!top || top.op !== 'LOOP_START') {
        throw new Error(`Unexpected "${line}" on line ${lineIdx + 1}`);
      }
      appendToCurrent(top);
      continue;
    }

    if (/^(?:End\s+While|END_WHILE)$/i.test(line)) {
      const top = stack.pop();
      if (!top || top.op !== 'WHILE') {
        throw new Error(`Unexpected "${line}" on line ${lineIdx + 1}`);
      }
      appendToCurrent(top);
      continue;
    }

    const elseIfMatch = line.match(
      /^(?:Else\s+If|ELSE_IF)\s*(?:\((.+)\)|\[(.+)\])\s*$/i
    );
    if (elseIfMatch) {
      const top = stack[stack.length - 1];
      if (!top || top.op !== 'IF') {
        throw new Error(`Unexpected "${line}" outside IF on line ${lineIdx + 1}`);
      }
      const cond = parseCondition(elseIfMatch[1] ?? elseIfMatch[2]);
      top.elseIfs.push({ cond, body: [] });
      top._branch = top.elseIfs.length - 1;
      continue;
    }

    if (/^ELSE$/i.test(line)) {
      const top = stack[stack.length - 1];
      if (!top || top.op !== 'IF') {
        throw new Error(`Unexpected "${line}" outside IF on line ${lineIdx + 1}`);
      }
      top.else = [];
      top._branch = 'else';
      continue;
    }

    if (/^(?:End\s+If|END_IF)$/i.test(line)) {
      const top = stack.pop();
      if (!top || top.op !== 'IF') {
        throw new Error(`Unexpected "${line}" on line ${lineIdx + 1}`);
      }
      const cleaned = { op: 'IF', cond: top.cond, then: top.then };
      if (top.elseIfs.length > 0) cleaned.elseIfs = top.elseIfs;
      if (Array.isArray(top.else)) cleaned.else = top.else;
      appendToCurrent(cleaned);
      continue;
    }

    // 3. Control structure openers
    const loopMatch = line.match(
      /^(?:Loop|LOOP_START)\s*(?:\[\s*[×x]?\s*([^\]]+)\s*\]|\(\s*[×x]?\s*([^)]+)\s*\)|[×x]\s*(\S+))$/i
    );
    if (loopMatch) {
      const rawCount = (loopMatch[1] ?? loopMatch[2] ?? loopMatch[3]).trim();
      stack.push({ op: 'LOOP_START', count: parseScalarToken(rawCount), body: [] });
      continue;
    }

    const whileMatch = line.match(/^(?:While|WHILE)\s*(?:\((.+)\)|\[(.+)\])$/i);
    if (whileMatch) {
      const cond = parseCondition(whileMatch[1] ?? whileMatch[2]);
      stack.push({ op: 'WHILE', cond, body: [] });
      continue;
    }

    const ifMatch = line.match(/^(?:If|IF)\s*(?:\((.+)\)|\[(.+)\])$/i);
    if (ifMatch) {
      const cond = parseCondition(ifMatch[1] ?? ifMatch[2]);
      stack.push({
        op: 'IF',
        cond,
        then: [],
        elseIfs: [],
        else: undefined,
        _branch: 'then',
      });
      continue;
    }

    // 4. Placeholder (? or PLACEHOLDER [cat])
    if (line === '?' || /^PLACEHOLDER$/i.test(line)) {
      appendToCurrent({ op: 'PLACEHOLDER' });
      continue;
    }
    const phMatch = line.match(/^PLACEHOLDER\s*(?:\[\s*([^\]]+)\s*\]|\(\s*([^)]+)\s*\))$/i);
    if (phMatch) {
      appendToCurrent({
        op: 'PLACEHOLDER',
        hintCategory: (phMatch[1] ?? phMatch[2]).trim(),
      });
      continue;
    }

    // 5. Concurrency, Events & Return statements
    const onEventMatch = line.match(
      /^On\s+(Tap|Key)\s*(?:\[\s*([^\]]+)\s*\])?\s*(?:->|→)\s*(\S+)$/i
    );
    if (onEventMatch) {
      const block = {
        op: 'ON_EVENT',
        event: onEventMatch[1].toUpperCase(),
        fn: onEventMatch[3].trim().toUpperCase(),
      };
      if (onEventMatch[2]) block.key = onEventMatch[2].trim().toUpperCase();
      appendToCurrent(block);
      continue;
    }

    const forkMatch = line.match(
      /^(?:Fork|FORK)\s+(?:\[\s*([^\]]+)\s*\]|([A-Za-z0-9_]+))(?:\(([^)]*)\))?$/i
    );
    if (forkMatch) {
      const fn = (forkMatch[1] ?? forkMatch[2]).trim().toUpperCase();
      const args = forkMatch[3] ? splitCommaArgs(forkMatch[3]).map(parseScalarToken) : [];
      const block = { op: 'FORK', fn };
      if (args.length > 0) block.args = args;
      appendToCurrent(block);
      continue;
    }

    if (/^(?:Join|JOIN)$/i.test(line)) {
      appendToCurrent({ op: 'JOIN' });
      continue;
    }

    if (/^(?:Barrier|SYNC_BARRIER)$/i.test(line)) {
      appendToCurrent({ op: 'SYNC_BARRIER' });
      continue;
    }

    const lockMatch = line.match(/^(Lock|Unlock|LOCK|UNLOCK)\s*\[\s*([^\]]+)\s*\]$/i);
    if (lockMatch) {
      appendToCurrent({
        op: lockMatch[1].toUpperCase(),
        lock: parseScalarToken(lockMatch[2]),
      });
      continue;
    }

    const sendMatch = line.match(/^(?:Send|SEND)\s*\[\s*([^,\]]+)\s*,\s*([^\]]+)\s*\]$/i);
    if (sendMatch) {
      appendToCurrent({
        op: 'SEND',
        channel: parseScalarToken(sendMatch[1]),
        value: parseScalarToken(sendMatch[2]),
      });
      continue;
    }

    const returnMatch = line.match(/^(?:Return|RETURN)(?:\s*\[\s*([^\]]+)\s*\])?$/i);
    if (returnMatch) {
      const block = { op: 'RETURN' };
      if (returnMatch[1] !== undefined) block.value = parseScalarToken(returnMatch[1]);
      appendToCurrent(block);
      continue;
    }

    // 6. Call statement ("Call F1", "Call F1(a, 50)", "CALL_FN [F1]", "Call [Fn](a)")
    const callMatch = line.match(
      /^(?:Call|CALL|CALL_FN)\s+(?:(\[Fn\]|\$fn)|\[\s*([^\]]+)\s*\]|([A-Za-z_][A-Za-z0-9_]*))(?:\(([^)]*)\))?$/i
    );
    if (callMatch) {
      const fnRaw = callMatch[1] ? '$fn' : callMatch[2] ?? callMatch[3];
      const fn = fnRaw === '$fn' ? '$fn' : fnRaw.trim().toUpperCase();
      const args = callMatch[4] ? splitCommaArgs(callMatch[4]).map(parseScalarToken) : [];
      const block = { op: 'CALL_FN', fn };
      if (args.length > 0) block.args = args;
      appendToCurrent(block);
      continue;
    }

    // 7. Variable arithmetic & assignment ("a = a + 12", "b = $recv [red]", "a = $tileDial")
    const varOpMatch = line.match(
      /^([a-z])\s*=\s*(\S+(?:\s*\[[^\]]+\])?)\s*([+\-*/%])\s*(\S+(?:\s*\[[^\]]+\])?)$/i
    );
    if (varOpMatch) {
      appendToCurrent({
        op: 'VAR_OP',
        target: varOpMatch[1].toLowerCase(),
        operator: varOpMatch[3],
        left: parseScalarToken(varOpMatch[2]),
        right: parseScalarToken(varOpMatch[4]),
      });
      continue;
    }

    const recvAssignMatch = line.match(
      /^([a-z])\s*=\s*\$recv\s*\[\s*([^\]]+)\s*\]$/i
    );
    if (recvAssignMatch) {
      appendToCurrent({
        op: 'VAR_ASSIGN',
        var: recvAssignMatch[1].toLowerCase(),
        value: { op: '$recv', channel: parseScalarToken(recvAssignMatch[2]) },
      });
      continue;
    }

    const varAssignMatch = line.match(/^([a-z])\s*=\s*(.+)$/i);
    if (varAssignMatch) {
      appendToCurrent({
        op: 'VAR_ASSIGN',
        var: varAssignMatch[1].toLowerCase(),
        value: parseScalarToken(varAssignMatch[2]),
      });
      continue;
    }

    // 8. Generic Action Opcode with optional [args] and optional [×repeat]
    const actionMatch = line.match(
      /^([A-Z][A-Z0-9_]*)(?:\s*\[\s*([^\]]+)\s*\])?(?:\s*\[\s*[×x]\s*([^\]]+)\s*\])?$/i
    );
    if (actionMatch) {
      const argList = actionMatch[2] ? splitCommaArgs(actionMatch[2]) : [];
      appendToCurrent(buildActionBlock(actionMatch[1], argList, actionMatch[3]));
      continue;
    }

    throw new Error(`Unrecognized pseudocode line ${lineIdx + 1}: "${line}"`);
  }

  if (stack.length > 0) {
    throw new Error(`Unclosed control block (${stack[stack.length - 1].op}) in ${currentScope}`);
  }

  return { scopes, signatures };
}

function formatScalarToken(v) {
  if (v === '$p0') return '●';
  if (v === '$p1') return '▲';
  if (v === '$p2') return '■';
  if (v === '$fn') return '[Fn]';
  if (v === 'CLEAR') return 'CLEAR';
  if (v && typeof v === 'object' && v.op === '$recv') {
    return `$recv [${formatScalarToken(v.channel)}]`;
  }
  return String(v);
}

/**
 * Format a JSON AST condition object into canonical readable pseudocode.
 */
export function formatCondition(cond) {
  if (typeof cond === 'boolean') return String(cond);
  if (typeof cond === 'string') return cond;
  if (!cond || typeof cond !== 'object') return String(cond);

  if (cond.sensor) {
    if (cond.station) return `${cond.sensor} [${cond.station}]`;
    if (cond.key) return `${cond.sensor} [${cond.key}]`;
    return cond.sensor;
  }

  const op = String(cond.op || cond.operator || '').toUpperCase();
  if (op === 'NOT') {
    const inner = cond.expr ?? cond.arg ?? cond.child ?? cond.left;
    const innerText = formatCondition(inner);
    const needsParens = inner && (inner.op === 'AND' || inner.op === 'OR' || inner.op === 'CMP');
    return needsParens ? `NOT (${innerText})` : `NOT ${innerText}`;
  }
  if (op === 'AND' || op === '&&') {
    return `${formatCondition(cond.left)} AND ${formatCondition(cond.right)}`;
  }
  if (op === 'OR' || op === '||') {
    return `${formatCondition(cond.left)} OR ${formatCondition(cond.right)}`;
  }
  const cmpOp = op === 'CMP' ? String(cond.operator || cond.cmp || '==') : String(cond.op || '==');
  return `${formatScalarToken(cond.left)} ${cmpOp} ${formatScalarToken(cond.right)}`;
}

function formatActionArgs(block) {
  const op = String(block.op || block.type || '').toUpperCase();
  const repeatSuffix = block.repeat !== undefined ? ` [×${formatScalarToken(block.repeat)}]` : '';

  if (op === 'CALL' || op === 'CALL_FN' || op === 'FORK') {
    const prefix = op === 'FORK' ? 'Fork' : 'Call';
    const fnLabel = block.fn === '$fn' ? '[Fn]' : block.fn;
    const argStr =
      Array.isArray(block.args) && block.args.length > 0
        ? `(${block.args.map(formatScalarToken).join(', ')})`
        : '';
    return `${prefix} ${fnLabel}${argStr}`;
  }
  if (op === 'VAR_ASSIGN' || op === 'SET_VAR' || op === 'ASSIGN') {
    const name = block.var || block.target || block.name;
    return `${name} = ${formatScalarToken(block.value)}`;
  }
  if (op === 'VAR_OP') {
    return `${block.target || block.var} = ${formatScalarToken(block.left)} ${block.operator || '+'} ${formatScalarToken(block.right)}`;
  }
  if (op === 'PLACEHOLDER') {
    return block.hintCategory ? `PLACEHOLDER [${block.hintCategory}]` : '?';
  }
  if (op === 'ON_EVENT') {
    const keyPart = block.key ? ` [${block.key}]` : '';
    const ev = block.event === 'KEY' ? 'Key' : 'Tap';
    return `On ${ev}${keyPart} -> ${block.fn}`;
  }
  if (op === 'JOIN') return 'Join';
  if (op === 'SYNC_BARRIER') return 'Barrier';
  if (op === 'LOCK' || op === 'UNLOCK') {
    const kw = op === 'LOCK' ? 'Lock' : 'Unlock';
    return `${kw} [${formatScalarToken(block.lock ?? block.channel ?? block.color ?? 'red')}]`;
  }
  if (op === 'SEND') {
    return `Send [${formatScalarToken(block.channel)}, ${formatScalarToken(block.value)}]`;
  }
  if (op === 'RETURN') {
    return block.value !== undefined ? `Return [${formatScalarToken(block.value)}]` : 'Return';
  }

  let args = [];
  if (block.length !== undefined) args = [block.length];
  else if (block.distance !== undefined) args = [block.distance];
  else if (block.radius !== undefined && block.angle !== undefined) args = [block.radius, block.angle];
  else if (block.angle !== undefined) args = [block.angle];
  else if (block.x !== undefined && block.y !== undefined && block.heading !== undefined) {
    args = [block.x, block.y, block.heading];
  } else if (block.x !== undefined && block.y !== undefined) args = [block.x, block.y];
  else if (block.color !== undefined) args = [block.color];
  else if (block.width !== undefined) args = [block.width];
  else if (block.pitch !== undefined && block.duration !== undefined) args = [block.pitch, block.duration];
  else if (block.pitch !== undefined) args = [block.pitch];
  else if (block.stepDelayMultiplier !== undefined) args = [block.stepDelayMultiplier];
  else if (block.beats !== undefined) args = [block.beats];
  else if (block.preset !== undefined) args = [block.preset];
  else if (block.row !== undefined) args = [block.row];
  else if (block.col !== undefined) args = [block.col];
  else if (block.switchId !== undefined) args = [block.switchId];
  else if (block.station !== undefined) args = [block.station];
  else if (block.gate !== undefined) args = [block.gate];
  else if (block.index !== undefined) args = [block.index];
  else if (block.direction !== undefined) args = [block.direction];
  else if (block.value !== undefined) args = [block.value];
  else if (Array.isArray(block.args) && block.args.length > 0) args = block.args;

  const argStr = args.length > 0 ? ` [${args.map(formatScalarToken).join(', ')}]` : '';
  return `${op}${argStr}${repeatSuffix}`;
}

function formatBlockList(blocks, indent = 0) {
  const pad = '  '.repeat(indent);
  const out = [];
  for (const b of blocks || []) {
    if (!b || typeof b !== 'object') continue;
    const op = String(b.op || b.type || '').toUpperCase();
    if (op === 'LOOP' || op === 'LOOP_START') {
      out.push(`${pad}Loop [${formatScalarToken(b.count ?? b.repeat ?? 1)}]`);
      out.push(...formatBlockList(b.body || [], indent + 1));
      out.push(`${pad}End Loop`);
    } else if (op === 'WHILE') {
      out.push(`${pad}While (${formatCondition(b.cond)})`);
      out.push(...formatBlockList(b.body || [], indent + 1));
      out.push(`${pad}End While`);
    } else if (op === 'IF') {
      out.push(`${pad}If (${formatCondition(b.cond)})`);
      out.push(...formatBlockList(b.then || b.body || [], indent + 1));
      if (Array.isArray(b.elseIfs)) {
        for (const ei of b.elseIfs) {
          out.push(`${pad}Else If (${formatCondition(ei.cond)})`);
          out.push(...formatBlockList(ei.body || [], indent + 1));
        }
      }
      if (Array.isArray(b.else)) {
        out.push(`${pad}Else`);
        out.push(...formatBlockList(b.else, indent + 1));
      }
      out.push(`${pad}End If`);
    } else {
      out.push(`${pad}${formatActionArgs(b)}`);
    }
  }
  return out;
}

/**
 * Format JSON AST `{ MAIN, F1, ... }` scopes into canonical indented pseudocode.
 */
export function formatPseudocode(scopes, signatures = {}) {
  const keys = Object.keys(scopes || {}).filter((k) => Array.isArray(scopes[k]));
  const sections = [];
  for (const key of keys) {
    const blocks = scopes[key];
    if (blocks.length === 0 && key !== 'MAIN') continue;
    const flatCount = countFlatBlocks(blocks);
    const sig = Array.isArray(signatures[key]) && signatures[key].length > 0
      ? `(${signatures[key].map(formatScalarToken).join(', ')})`
      : '';
    const lines = [
      `// ${key}${sig} (${flatCount} flat block${flatCount === 1 ? '' : 's'})`,
      ...formatBlockList(blocks, 0),
    ];
    sections.push(lines.join('\n'));
  }
  return sections.join('\n\n');
}

/**
 * Normalize either JSON AST or pseudocode string into `{ scopes, source }` options.
 */
export function normalizeProgramSpec(input) {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return normalizeProgramSpec(JSON.parse(trimmed));
    }
    const { scopes, signatures } = parsePseudocode(trimmed);
    return { scopes, signatures, source: {} };
  }

  const raw = input || {};
  const source = Array.isArray(raw.frames) && raw.frames.length > 0 ? raw.frames[0] : raw;
  const rawScopes = source.scopes || {
    MAIN: source.MAIN || source.main || [],
    F1: source.F1 || source.f1 || [],
    F2: source.F2 || source.f2 || [],
    F3: source.F3 || source.f3 || [],
    ...(source.MAIN_1 || source.main_1 ? { MAIN_1: source.MAIN_1 || source.main_1 } : {}),
    ...(source.MAIN_2 || source.main_2 ? { MAIN_2: source.MAIN_2 || source.main_2 } : {}),
    ...(source.MAIN_3 || source.main_3 ? { MAIN_3: source.MAIN_3 || source.main_3 } : {}),
    ...(source.MAIN_4 || source.main_4 ? { MAIN_4: source.MAIN_4 || source.main_4 } : {}),
  };

  const normalizedScopes = {};
  for (const [k, v] of Object.entries(rawScopes)) {
    if (Array.isArray(v)) normalizedScopes[normalizeScopeKey(k)] = v;
  }
  if (!normalizedScopes.MAIN && !normalizedScopes.MAIN_1) {
    normalizedScopes.MAIN = [];
  }

  return { scopes: normalizedScopes, signatures: raw.signatures || {}, source };
}

/**
 * Execute an environment-agnostic curriculum runtime against environment-specific hooks.
 */
export function executeProgram({
  scopes,
  initialVars,
  tape: initialTape,
  channels: initialChannels,
  previewInput = 1,
  previewFrame = 1,
  fps = 10,
  seed = 42,
  workerId = 'main',
  envHooks,
  initialRuntime,
}) {
  const vars = Object.create(null);
  for (let i = 0; i < 26; i++) {
    vars[String.fromCharCode(97 + i)] = 0;
  }
  if (initialVars && typeof initialVars === 'object') {
    for (const [k, v] of Object.entries(initialVars)) {
      vars[k.toLowerCase()] = v;
    }
  }

  let tape;
  if (Array.isArray(initialTape)) {
    const cells = {};
    initialTape.forEach((val, idx) => {
      if (val !== null && val !== undefined && val !== 'CLEAR' && val !== '∅') {
        cells[idx + 1] = val;
      }
    });
    tape = {
      length: Math.max(8, initialTape.length + 1),
      workerHeads: {},
      cells,
    };
  } else if (initialTape && typeof initialTape === 'object') {
    tape = {
      length: Number(initialTape.length ?? 8),
      workerHeads: { ...(initialTape.workerHeads || {}) },
      cells: { ...(initialTape.cells || {}) },
    };
  } else {
    tape = { length: 10000, workerHeads: {}, cells: {} };
  }
  if (tape.workerHeads[workerId] === undefined) {
    tape.workerHeads[workerId] = Number(initialTape?.headPos ?? 1);
  }

  const channels = initialChannels || Object.create(null);
  const nextRand = createMulberry32(seed);
  const runtime = initialRuntime || {
    status: 'OK',
    steps: 0,
    vars,
    tape,
    channels,
    callStack: [],
    pendingForks: [],
    errorDetail: null,
  };

  const getHead = (wId = workerId) => tape.workerHeads[wId] ?? 1;
  const setHead = (pos, wId = workerId) => {
    tape.workerHeads[wId] = pos;
  };

  function stepGuard() {
    runtime.steps += 1;
    if (runtime.steps > MAX_STEPS) {
      runtime.status = 'STEP_LIMIT';
      runtime.errorDetail = `Exceeded MAX_STEPS (${MAX_STEPS})`;
      return false;
    }
    return true;
  }

  function resolveRawValue(val, frameArgs = {}, wId = workerId) {
    if (val === undefined || val === null) return val;
    if (typeof val === 'object' && val.op === '$recv') {
      const ch = String(resolveRawValue(val.channel, frameArgs, wId)).toLowerCase();
      const q = channels[ch] || (channels[ch] = []);
      if (q.length === 0) {
        runtime.status = 'DEADLOCK';
        runtime.errorDetail = `Empty channel ${ch} on $recv`;
        return undefined;
      }
      return q.shift();
    }
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (typeof val === 'string') {
      const s = val.trim();
      if (s === '$p0' || s === '●') return frameArgs[0] ?? 0;
      if (s === '$p1' || s === '▲') return frameArgs[1] ?? 0;
      if (s === '$p2' || s === '■') return frameArgs[2] ?? 0;
      if (s === '$fn' || s === '[Fn]') return frameArgs.fn ?? 'F1';
      if (s === '$ret') return runtime.lastReturn ?? 0;
      if (s === '$input') return previewInput;
      if (s === '$frame') return previewFrame;
      if (s === '$time') return Number(((previewFrame - 1) / fps).toFixed(4));
      if (s === '$headPos') return getHead(wId);
      if (s === '$tapeLength') return tape.length;
      if (s === '$cellEmpty' || s === 'cellEmpty') {
        const h = getHead(wId);
        return tape.cells[h] === undefined ? 1 : 0;
      }
      if (s === '$cellValue') {
        const h = getHead(wId);
        const cell = tape.cells[h];
        if (typeof cell !== 'number') {
          runtime.status = 'TYPE_ERROR';
          runtime.errorDetail = `$cellValue on cell #${h} (${JSON.stringify(cell)})`;
          return undefined;
        }
        return cell;
      }
      if (s === '$cellColor') {
        const h = getHead(wId);
        const cell = tape.cells[h];
        if (typeof cell !== 'string') {
          runtime.status = 'TYPE_ERROR';
          runtime.errorDetail = `$cellColor on cell #${h} (${JSON.stringify(cell)})`;
          return undefined;
        }
        return resolveColorLiteral(cell);
      }
      if (s === '$randCoin' || s === 'coin') return nextRand() < 0.5 ? 0 : 1;
      if (s === '$randD4' || s === 'd4') return 1 + Math.floor(nextRand() * 4);
      if (s === '$randD6' || s === 'd6') return 1 + Math.floor(nextRand() * 6);
      if (s === '$randD8' || s === 'd8') return 1 + Math.floor(nextRand() * 8);
      if (s === '$randD20' || s === 'd20') return 1 + Math.floor(nextRand() * 20);
      if (s === '$rand01' || s === 'rand01') return nextRand();
      if (s === '$randomColor') {
        return RANDOM_VIBRANT_COLORS[Math.floor(nextRand() * RANDOM_VIBRANT_COLORS.length)];
      }
      if (envHooks?.resolveSensor) {
        const envRes = envHooks.resolveSensor(s, { vars, tape, workerId: wId, runtime });
        if (envRes !== undefined) {
          if (envRes === 'TYPE_ERROR') {
            runtime.status = 'TYPE_ERROR';
            runtime.errorDetail = `TYPE_ERROR reading sensor ${s}`;
            return undefined;
          }
          return envRes;
        }
      }
      if (/^[a-z]$/i.test(s)) {
        return vars[s.toLowerCase()] ?? 0;
      }
      if (Object.prototype.hasOwnProperty.call(vars, s)) return vars[s];
      if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);
      return s;
    }
    return val;
  }

  function resolveNumber(val, fallback = 0, frameArgs = {}, wId = workerId) {
    if (val === undefined || val === null) return fallback;
    const resolved = resolveRawValue(val, frameArgs, wId);
    if (runtime.status !== 'OK') return fallback;
    const n = Number(resolved);
    if (!Number.isFinite(n)) {
      runtime.status = 'TYPE_ERROR';
      runtime.errorDetail = `Expected numeric value, got ${JSON.stringify(val)} -> ${JSON.stringify(resolved)}`;
      return fallback;
    }
    return n;
  }

  function resolveColorParam(val, frameArgs = {}, wId = workerId) {
    if (val === undefined || val === null) return '#0f172a';
    const resolved = resolveRawValue(val, frameArgs, wId);
    if (runtime.status !== 'OK') return '#0f172a';
    if (typeof resolved === 'number' && !PALETTE_COLORS[resolved]) {
      runtime.status = 'TYPE_ERROR';
      runtime.errorDetail = `Expected color value, got number ${resolved}`;
      return '#0f172a';
    }
    return resolveColorLiteral(resolved);
  }

  function evalCondition(cond, frameArgs = {}, wId = workerId) {
    if (runtime.status !== 'OK') return false;
    if (typeof cond === 'boolean') return cond;
    if (typeof cond === 'string') {
      const c = cond.trim();
      if (c.startsWith('NOT ') || c.startsWith('!')) {
        return !evalCondition(c.replace(/^(?:NOT\s+|!\s*)/, ''), frameArgs, wId);
      }
      if (c === '$cellEmpty' || c === 'cellEmpty') {
        return tape.cells[getHead(wId)] === undefined;
      }
      if (envHooks?.evalSensor) {
        return Boolean(envHooks.evalSensor({ sensor: c }, { vars, tape, workerId: wId, runtime }));
      }
      throw new Error(`Unknown condition string: ${cond}`);
    }
    if (!cond || typeof cond !== 'object') {
      throw new Error(`Invalid condition: ${JSON.stringify(cond)}`);
    }
    if (cond.sensor) {
      if (cond.sensor === '$cellEmpty' || cond.sensor === 'cellEmpty') {
        return tape.cells[getHead(wId)] === undefined;
      }
      if (envHooks?.evalSensor) {
        return Boolean(envHooks.evalSensor(cond, { vars, tape, workerId: wId, runtime }));
      }
      throw new Error(`Unknown sensor condition: ${cond.sensor}`);
    }

    const op = String(cond.op || cond.operator || '').toUpperCase();
    if (op === 'NOT') {
      return !evalCondition(cond.expr ?? cond.arg ?? cond.child ?? cond.left, frameArgs, wId);
    }
    if (op === 'AND' || op === '&&') {
      return (
        evalCondition(cond.left, frameArgs, wId) &&
        evalCondition(cond.right, frameArgs, wId)
      );
    }
    if (op === 'OR' || op === '||') {
      return (
        evalCondition(cond.left, frameArgs, wId) ||
        evalCondition(cond.right, frameArgs, wId)
      );
    }

    const cmpOp =
      op === 'CMP' ? String(cond.operator || cond.cmp || '==').trim() : String(cond.op || '').trim();
    const lv = resolveRawValue(cond.left, frameArgs, wId);
    if (runtime.status !== 'OK') return false;
    const rv = resolveRawValue(cond.right, frameArgs, wId);
    if (runtime.status !== 'OK') return false;

    const lvColor =
      typeof lv === 'string' &&
      (lv.startsWith('#') || Object.prototype.hasOwnProperty.call(PALETTE_COLORS, lv.toLowerCase()));
    const rvColor =
      typeof rv === 'string' &&
      (rv.startsWith('#') || Object.prototype.hasOwnProperty.call(PALETTE_COLORS, rv.toLowerCase()));

    if (lvColor || rvColor) {
      if (cmpOp !== '==' && cmpOp !== '!=' && cmpOp !== '===' && cmpOp !== '!==') {
        runtime.status = 'TYPE_ERROR';
        runtime.errorDetail = `Cannot order color values with ${cmpOp}`;
        return false;
      }
      if (typeof lv === 'number' || typeof rv === 'number') {
        runtime.status = 'TYPE_ERROR';
        runtime.errorDetail = `Cross-type comparison (${lv} ${cmpOp} ${rv})`;
        return false;
      }
      const lc = resolveColorLiteral(lv).toLowerCase();
      const rc = resolveColorLiteral(rv).toLowerCase();
      return cmpOp === '==' || cmpOp === '===' ? lc === rc : lc !== rc;
    }

    if (typeof lv === 'string' && typeof rv === 'string' && (Number.isNaN(Number(lv)) || Number.isNaN(Number(rv)))) {
      if (cmpOp === '==' || cmpOp === '===') return lv.toLowerCase() === rv.toLowerCase();
      if (cmpOp === '!=' || cmpOp === '!==') return lv.toLowerCase() !== rv.toLowerCase();
    }

    const lNum = Number(lv);
    const rNum = Number(rv);
    if (Number.isNaN(lNum) || Number.isNaN(rNum)) {
      runtime.status = 'TYPE_ERROR';
      runtime.errorDetail = `Invalid comparison operands (${lv} ${cmpOp} ${rv})`;
      return false;
    }

    switch (cmpOp) {
      case '==':
      case '===':
        return Math.abs(lNum - rNum) < 1e-9;
      case '!=':
      case '!==':
        return Math.abs(lNum - rNum) >= 1e-9;
      case '<':
        return lNum < rNum;
      case '<=':
        return lNum <= rNum;
      case '>':
        return lNum > rNum;
      case '>=':
        return lNum >= rNum;
      default:
        throw new Error(`Unsupported comparison op: ${JSON.stringify(cond)}`);
    }
  }

  function execList(blocks, depth = 0, frameArgs = {}, wId = workerId) {
    if (!Array.isArray(blocks) || runtime.status !== 'OK') return false;

    for (const block of blocks) {
      if (runtime.status !== 'OK') return false;
      if (!block || typeof block !== 'object') continue;
      const op = String(block.op || block.type || '').toUpperCase();

      if (op === 'LOOP' || op === 'LOOP_START') {
        const count = Math.max(
          0,
          Math.trunc(resolveNumber(block.count ?? block.repeat ?? 1, 1, frameArgs, wId))
        );
        if (!stepGuard()) return false;
        for (let i = 0; i < count; i++) {
          const returned = execList(block.body || [], depth, frameArgs, wId);
          if (returned) return true;
          if (runtime.status !== 'OK') return false;
        }
        continue;
      }

      if (op === 'WHILE') {
        if (!stepGuard()) return false;
        while (runtime.status === 'OK' && evalCondition(block.cond, frameArgs, wId)) {
          const returned = execList(block.body || [], depth, frameArgs, wId);
          if (returned) return true;
          if (!stepGuard()) return false;
        }
        continue;
      }

      if (op === 'IF') {
        if (!stepGuard()) return false;
        if (evalCondition(block.cond, frameArgs, wId)) {
          const returned = execList(block.then || block.body || [], depth, frameArgs, wId);
          if (returned) return true;
        } else {
          let matched = false;
          if (Array.isArray(block.elseIfs)) {
            for (const ei of block.elseIfs) {
              if (evalCondition(ei.cond, frameArgs, wId)) {
                const returned = execList(ei.body || [], depth, frameArgs, wId);
                if (returned) return true;
                matched = true;
                break;
              }
            }
          }
          if (!matched && Array.isArray(block.else)) {
            const returned = execList(block.else, depth, frameArgs, wId);
            if (returned) return true;
          }
        }
        continue;
      }

      const repeats = Math.max(
        0,
        Math.trunc(block.repeat !== undefined ? resolveNumber(block.repeat, 1, frameArgs, wId) : 1)
      );

      for (let r = 0; r < repeats; r++) {
        if (runtime.status !== 'OK') return false;
        if (!stepGuard()) return false;

        if (op === 'PLACEHOLDER') {
          runtime.status = 'PAUSED_ON_PLACEHOLDER';
          return false;
        }

        if (op === 'RETURN') {
          if (block.value !== undefined) {
            runtime.lastReturn = resolveRawValue(block.value, frameArgs, wId);
          }
          return true;
        }

        if (op === 'VAR_ASSIGN' || op === 'SET_VAR' || op === 'ASSIGN') {
          const target = String(block.var || block.target || block.name || '').toLowerCase();
          if (!target) throw new Error(`Missing var name in ${JSON.stringify(block)}`);
          const resolved = resolveRawValue(block.value, frameArgs, wId);
          if (runtime.status !== 'OK') return false;
          if (
            typeof resolved === 'string' &&
            !resolved.startsWith('#') &&
            Object.prototype.hasOwnProperty.call(PALETTE_COLORS, resolved.toLowerCase())
          ) {
            vars[target] = PALETTE_COLORS[resolved.toLowerCase()];
          } else {
            vars[target] = resolved;
          }
          continue;
        }

        if (op === 'VAR_OP') {
          const target = String(block.target || block.var || '').toLowerCase();
          if (!target) throw new Error(`Missing target in VAR_OP: ${JSON.stringify(block)}`);
          const left = resolveNumber(block.left, 0, frameArgs, wId);
          const right = resolveNumber(block.right, 0, frameArgs, wId);
          if (runtime.status !== 'OK') return false;
          const operator = String(block.operator || block.opSymbol || '+').trim();
          if ((operator === '/' || operator === '%') && right === 0) {
            runtime.status = 'MATH_ERROR';
            runtime.errorDetail = `Division/modulo by zero`;
            return false;
          }
          if (operator === '+') vars[target] = left + right;
          else if (operator === '-') vars[target] = left - right;
          else if (operator === '*') vars[target] = left * right;
          else if (operator === '/') vars[target] = left / right;
          else if (operator === '%') vars[target] = left % right;
          else throw new Error(`Unsupported VAR_OP operator: ${operator}`);
          continue;
        }

        if (op === 'TAPE_SEEK') {
          const idx = Math.trunc(resolveNumber(block.index ?? block.value ?? 1, 1, frameArgs, wId));
          if (runtime.status !== 'OK') return false;
          if (idx < 1 || idx > tape.length) {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `TAPE_SEEK(${idx}) out of bounds 1..${tape.length}`;
            return false;
          }
          setHead(idx, wId);
          continue;
        }

        if (op === 'TAPE_STEP') {
          const dir = String(block.direction || block.dir || 'RIGHT').toUpperCase();
          const delta = dir === 'LEFT' || dir === 'BACKWARD' ? -1 : 1;
          const next = getHead(wId) + delta;
          if (next < 1 || next > tape.length) {
            runtime.status = 'COLLISION';
            runtime.errorDetail = `TAPE_STEP(${dir}) out of bounds from ${getHead(wId)}`;
            return false;
          }
          setHead(next, wId);
          continue;
        }

        if (op === 'TAPE_WRITE') {
          const rawVal = block.value;
          const h = getHead(wId);
          if (rawVal === null || rawVal === undefined || rawVal === 'CLEAR' || rawVal === '∅') {
            delete tape.cells[h];
          } else {
            const v = resolveRawValue(rawVal, frameArgs, wId);
            if (runtime.status !== 'OK') return false;
            tape.cells[h] = v;
          }
          continue;
        }

        if (op === 'SEND') {
          const ch = String(resolveRawValue(block.channel, frameArgs, wId)).toLowerCase();
          const v = resolveRawValue(block.value, frameArgs, wId);
          if (runtime.status !== 'OK') return false;
          (channels[ch] || (channels[ch] = [])).push(v);
          continue;
        }

        if (op === 'CALL' || op === 'CALL_FN') {
          let fnName = String(block.fn || block.target || block.scope || 'F1');
          if (fnName === '$fn' || fnName === '[Fn]') {
            fnName = String(frameArgs.fn || 'F1');
          }
          fnName = normalizeScopeKey(fnName);
          if (depth + 1 > MAX_CALL_DEPTH) {
            runtime.status = 'STACK_OVERFLOW';
            runtime.errorDetail = `Exceeded MAX_CALL_DEPTH (${MAX_CALL_DEPTH}) calling ${fnName}`;
            return false;
          }
          const target = scopes[fnName];
          if (!target) {
            throw new Error(`Missing helper scope: ${fnName}`);
          }
          const nextArgs = {};
          if (Array.isArray(block.args)) {
            block.args.forEach((a, idx) => {
              const resolvedArg = resolveRawValue(a, frameArgs, wId);
              if (typeof resolvedArg === 'string' && /^F[1-3]$/i.test(resolvedArg) && idx === 0 && !block.fnArgsOffset) {
                nextArgs.fn = resolvedArg.toUpperCase();
              }
              nextArgs[idx] = resolvedArg;
            });
          }
          execList(target, depth + 1, nextArgs, wId);
          continue;
        }

        if (op === 'FORK') {
          const fnName = normalizeScopeKey(block.fn || block.target || 'F1');
          if (depth + 1 > MAX_CALL_DEPTH) {
            runtime.status = 'STACK_OVERFLOW';
            runtime.errorDetail = `Exceeded MAX_CALL_DEPTH (${MAX_CALL_DEPTH}) forking ${fnName}`;
            return false;
          }
          const nextArgs = {};
          if (Array.isArray(block.args)) {
            block.args.forEach((a, idx) => {
              nextArgs[idx] = resolveRawValue(a, frameArgs, wId);
            });
          }
          if (envHooks?.onFork) {
            envHooks.onFork(fnName, nextArgs, { vars, tape, channels, workerId: wId, depth, execList });
          } else {
            execList(scopes[fnName] || [], depth + 1, nextArgs, `${wId}_fork_${runtime.steps}`);
          }
          continue;
        }

        if (op === 'JOIN' || op === 'SYNC_BARRIER' || op === 'LOCK' || op === 'UNLOCK' || op === 'WAIT' || op === 'SET_INSTANT') {
          continue;
        }

        if (envHooks?.execOp) {
          envHooks.execOp(op, block, {
            workerId: wId,
            resolveNumber: (v, fb = 0) => resolveNumber(v, fb, frameArgs, wId),
            resolveRawValue: (v) => resolveRawValue(v, frameArgs, wId),
            resolveColorParam: (v) => resolveColorParam(v, frameArgs, wId),
            vars,
            tape,
            runtime,
          });
        } else {
          throw new Error(`Unsupported opcode: ${op}`);
        }
      }
    }
    return false;
  }

  return {
    runtime,
    execList,
    evalCondition,
    resolveNumber,
    resolveRawValue,
    resolveColorParam,
  };
}
