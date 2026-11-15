export interface AdultMathChallenge {
  a: number;
  b: number;
  op: '+' | '×';
  prompt: string;
  answer: number;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 0.999999999999;
  return value;
}

function randomInt(rng: () => number, min: number, max: number): number {
  const unit = clampUnit(rng());
  return Math.floor(unit * (max - min + 1)) + min;
}

function buildTwoDigitAddition(rng: () => number): AdultMathChallenge {
  let a = randomInt(rng, 24, 97);
  let b = randomInt(rng, 15, 89);

  // Prefer pairs whose ones digits carry (>= 10), using bounded retries so degenerate RNGs never loop.
  for (let attempt = 0; attempt < 12 && (a % 10) + (b % 10) < 10; attempt++) {
    a = randomInt(rng, 24, 97);
    b = randomInt(rng, 15, 89);
  }

  if ((a % 10) + (b % 10) < 10) {
    if (a % 10 === 0) {
      a += 1;
    }
    const neededOnes = 10 - (a % 10);
    b = Math.floor(b / 10) * 10 + neededOnes;
    if (b < 15) {
      b += 10;
    }
  }

  return {
    a,
    b,
    op: '+',
    prompt: `${a} + ${b}`,
    answer: a + b,
  };
}

function buildThreeDigitAddition(rng: () => number): AdultMathChallenge {
  const a = randomInt(rng, 115, 685);
  const b = randomInt(rng, 27, 285);
  return {
    a,
    b,
    op: '+',
    prompt: `${a} + ${b}`,
    answer: a + b,
  };
}

function buildTwoByOneMultiplication(rng: () => number): AdultMathChallenge {
  const a = randomInt(rng, 12, 48);
  const b = randomInt(rng, 3, 9);
  return {
    a,
    b,
    op: '×',
    prompt: `${a} × ${b}`,
    answer: a * b,
  };
}

/**
 * Generates a short arithmetic gate challenge suitable for parents/teachers (and beyond early K-2 learners).
 * Chooses equally among 2-digit addition with carry, 3-digit addition, and 2x1-digit multiplication.
 */
export function generateAdultMathChallenge(rng: () => number = Math.random): AdultMathChallenge {
  const category = Math.floor(clampUnit(rng()) * 3);
  if (category === 0) {
    return buildTwoDigitAddition(rng);
  }
  if (category === 1) {
    return buildThreeDigitAddition(rng);
  }
  return buildTwoByOneMultiplication(rng);
}

/**
 * Validates user input against an adult math challenge (trimmed digits only, exact integer match).
 */
export function verifyAdultMathAnswer(challenge: AdultMathChallenge, rawInput: string): boolean {
  if (typeof rawInput !== 'string') return false;
  const trimmed = rawInput.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  return Number(trimmed) === challenge.answer;
}
