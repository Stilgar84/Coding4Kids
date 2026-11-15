import { expect, Page } from '@playwright/test';

/**
 * Evaluates a rendered Grown-Up Math Check prompt (`"<int> + <int>"` or `"<int> × <int>"`).
 */
export function evaluateAdultMathPrompt(promptText: string): number {
  const match = promptText.trim().match(/^(\d+)\s*([+×x*])\s*(\d+)$/);
  if (!match) {
    throw new Error(`Unexpected adult-math-prompt format: "${promptText}"`);
  }
  const left = Number(match[1]);
  const op = match[2];
  const right = Number(match[3]);
  return op === '+' ? left + right : left * right;
}

/**
 * Solves the visible Grown-Up Math Check inside `SolutionModal` to unlock Tier 2 answers.
 */
export async function solveAdultMathGate(page: Page): Promise<number> {
  const promptEl = page.getByTestId('adult-math-prompt');
  await expect(promptEl).toBeVisible();
  const promptText = (await promptEl.innerText()).trim();
  const answer = evaluateAdultMathPrompt(promptText);
  await page.getByTestId('adult-math-input').fill(String(answer));
  await page.getByTestId('btn-adult-math-submit').click();
  await expect(page.getByTestId('adult-math-gate')).toHaveCount(0);
  return answer;
}
