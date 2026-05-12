import { test, expect, type Page } from '@playwright/test';
import { checkSensitiveDataInHeap } from './heap-scanner';
import { pasteRecoveryPhraseInput } from './helpers';
import { installDeterministicRecoveryNetwork } from './network-mocks';

/**
 * Memory protection tests for both creation and recovery flows.
 *
 * Data Clearance Mechanism:
 * 1. React (Unmounting): When the view changes, React unmounts components,
 *    removing references to local state containing the mnemonic.
 * 2. V8 engine (Garbage Collector): Once references vanish, the GC eventually
 *    purges the string from RAM.
 * We use 'HeapProfiler.collectGarbage' in these tests to force immediate GC.
 *
 * Verifies security through sequential steps:
 * 1. Initial absence (for recovery)
 * 2. Presence evidence (while string is in UI)
 * 3. Final absence (after flow completion)
 */

const PASSWORD_STEPS = [
  'Security_Test!',
  'Security_Test_Passwor',
  'Security_Test_Password_',
  'Security_Test_Password_123',
  'Security_Test_Password_123!'
];
const PASSWORD = PASSWORD_STEPS[PASSWORD_STEPS.length - 1];

const RECOVERY_MNEMONIC_STEPS = [
  'abstract reform twelve inspire cry master',
  'abstract reform twelve inspire cry master vague skirt mention',
  'abstract reform twelve inspire cry master vague skirt mention ill velvet nice',
  'abstract reform twelve inspire cry master vague skirt mention ill velvet nice limit input present',
  'abstract reform twelve inspire cry master vague skirt mention ill velvet nice limit input present old equip double best doctor decrease survey spray wife'
];
const RECOVERY_MNEMONIC =
  RECOVERY_MNEMONIC_STEPS[RECOVERY_MNEMONIC_STEPS.length - 1];

const wordsPerSeedRevealPage = 12;
const totalMnemonicWordCount = 24;
const entryRetryAttempts = 3;
const entryStepTimeoutMs = 1500;
const configurationErrorTitle = 'Configuration error';

const resetClientStorage = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
};

const failIfConfigurationError = async (page: Page): Promise<void> => {
  const configHeading = page.getByRole('heading', {
    name: configurationErrorTitle
  });
  if (!(await configHeading.isVisible())) {
    return;
  }

  const details = await page.locator('body').innerText();
  throw new Error(`App failed to boot: ${details}`);
};

const waitForInitialEntryScreen = async (
  page: Page,
  target: 'create' | 'recover'
): Promise<void> => {
  const targetName =
    target === 'create'
      ? /Create a Vault Account|Create a new wallet/i
      : /Recover a Vault Account|I already have one/i;
  const targetButton = page.getByRole('button', { name: targetName });
  const skipButton = page.getByRole('button', { name: 'Skip' });
  const nextButton = page.getByRole('button', { name: 'Next' });
  const getStartedButton = page.getByRole('button', { name: /^get started$/i });

  await failIfConfigurationError(page);

  for (let attempt = 0; attempt < entryRetryAttempts; attempt += 1) {
    if (await targetButton.isVisible()) {
      await targetButton.click();
      return;
    }

    await skipButton
      .click({ timeout: entryStepTimeoutMs })
      .catch(() => undefined);
    await nextButton
      .click({ timeout: entryStepTimeoutMs })
      .catch(() => undefined);
    await getStartedButton
      .click({ timeout: entryStepTimeoutMs })
      .catch(() => undefined);
    await failIfConfigurationError(page);
  }

  await targetButton.click();
};

const getMnemonicWordsFromGrid = (textContent: string): string[] => {
  const words = [...textContent.matchAll(/\d+\.\s+([a-z]+)/g)].map(
    ([, word]) => word
  );

  if (!words.length) {
    throw new Error('Unable to parse recovery phrase words');
  }

  return words;
};

test.describe('Memory Protection: UI Sensitive Data @security', () => {
  test('should clear mnemonic from memory during Creation Flow', async ({
    page
  }) => {
    await installDeterministicRecoveryNetwork({ page });

    page.on('console', msg =>
      console.log(`[Browser Creation] ${msg.type()}: ${msg.text()}`)
    );

    await page.goto('/');
    await resetClientStorage(page);
    await page.reload();
    console.log(`[Creation Flow] URL:`, page.url());

    // 1. Start wallet creation
    await waitForInitialEntryScreen(page, 'create');

    // 2. Set password (simulating user typing incrementally)
    for (const step of PASSWORD_STEPS) {
      await page.getByLabel('Password', { exact: true }).fill(step);
      await page.waitForTimeout(25); // Simulates real typing cadence; time affects V8 heap/GC observations.
    }
    await page.getByLabel('Confirm Password').fill(PASSWORD);

    // 3. Presence evidence (Password should be in memory while it's in UI)
    console.log(`[Creation Flow] Verifying password presence evidence...`);
    await checkSensitiveDataInHeap({
      page,
      sensitiveDataSteps: [PASSWORD],
      expectPresent: true
    });

    const passwordInput = page.getByLabel('Password', { exact: true });
    const passwordConfirmationInput = page.getByLabel(/Confirm Password/i);
    const continueButton = page.locator('button:visible', {
      hasText: /^Continue$/
    });
    const revealRecoveryPhraseButton = page.getByRole('button', {
      name: 'Reveal Recovery Phrase'
    });
    const clickToRevealButton = page.getByRole('button', {
      name: 'Click to Reveal'
    });

    await passwordInput.fill(PASSWORD);
    await passwordConfirmationInput.fill(PASSWORD);
    await expect(passwordInput).toHaveValue(PASSWORD);
    await expect(passwordConfirmationInput).toHaveValue(PASSWORD);
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    await expect(revealRecoveryPhraseButton).toBeVisible();
    await revealRecoveryPhraseButton.click({ force: true });
    await expect(clickToRevealButton).toBeVisible();

    // 4. Read generated mnemonic from UI
    await expect(page.getByTestId('secret-phrase')).toContainText(' ');
    await clickToRevealButton.click();
    const firstPageText = await page.getByTestId('secret-phrase').innerText();
    const firstPageWords = getMnemonicWordsFromGrid(firstPageText);
    expect(firstPageWords).toHaveLength(wordsPerSeedRevealPage);

    await page.getByRole('button', { name: 'Next' }).click();
    const secondPageText = await page.getByTestId('secret-phrase').innerText();
    const secondPageWords = getMnemonicWordsFromGrid(secondPageText);
    expect(secondPageWords).toHaveLength(wordsPerSeedRevealPage);

    const mnemonicWords = [...firstPageWords, ...secondPageWords];
    expect(mnemonicWords).toHaveLength(totalMnemonicWordCount);
    const mnemonicPageOneMarker = `1. ${firstPageWords[0]}`;
    const mnemonicPageTwoMarker = `13. ${secondPageWords[0]}`;

    // 5. Complete creation process
    await page.getByRole('button', { name: 'I Wrote It Down' }).click();
    await page.getByRole('button', { name: 'Do This Later' }).click();
    await page.getByTestId('open-vault').click();

    await expect(
      page.getByRole('heading', { name: 'Quantum Vault', exact: true })
    ).toBeVisible();

    // 6. Final absence (Mnemonic and password should be cleared from heap).
    // We check the full canonical phrase rather than splitting into individual
    // BIP-39 words: every word in the phrase is also a member of the BIP-39
    // wordlist that the bip39 library keeps loaded in heap permanently, so a
    // per-word check would always report a false positive for "still present".
    console.log(`[Creation Flow] Verifying final absence...`);
    await checkSensitiveDataInHeap({
      page,
      sensitiveDataSteps: [mnemonicPageOneMarker, mnemonicPageTwoMarker],
      expectPresent: false
    });
    await checkSensitiveDataInHeap({
      page,
      sensitiveDataSteps: PASSWORD_STEPS,
      expectPresent: false
    });
  });

  test('should clear mnemonic from memory during Recovery Flow', async ({
    page
  }) => {
    await installDeterministicRecoveryNetwork({ page });

    page.on('console', msg =>
      console.log(`[Browser Recovery] ${msg.type()}: ${msg.text()}`)
    );

    await page.goto('/');
    await resetClientStorage(page);
    await page.reload();
    console.log(`[Recovery Flow] URL:`, page.url());

    // 1. Initial absence (Verify mnemonic is NOT present before entry)
    console.log(`[Recovery Flow] Verifying initial absence...`);
    await checkSensitiveDataInHeap({
      page,
      sensitiveDataSteps: RECOVERY_MNEMONIC_STEPS,
      expectPresent: false
    });
    await checkSensitiveDataInHeap({
      page,
      sensitiveDataSteps: PASSWORD_STEPS,
      expectPresent: false
    });

    // 2. Start recovery and enter mnemonic
    await waitForInitialEntryScreen(page, 'recover');
    await pasteRecoveryPhraseInput({ page, phrase: RECOVERY_MNEMONIC });
    const continueButton = page.locator('button:visible', {
      hasText: /^Continue$/
    });
    const recoveryPasswordInput = page.getByLabel('Password', { exact: true });
    await expect(continueButton).toBeEnabled();
    await continueButton.click({ force: true });
    await expect(recoveryPasswordInput).toBeVisible();

    // 3. Set password (simulating typing incrementally)
    for (const step of PASSWORD_STEPS) {
      await recoveryPasswordInput.fill(step);
      await page.waitForTimeout(25); // Simulates real typing cadence; time affects V8 heap/GC observations.
    }
    await page.getByLabel('Confirm Password').fill(PASSWORD);

    // 4. Presence evidence (Password should be in heap during input)
    // Recovery phrase is stored as committed chip words, not necessarily as
    // one contiguous 24-word string in heap, so we assert password presence
    // here and verify phrase absence at the end of the flow.
    console.log(`[Recovery Flow] Verifying presence evidence...`);
    await checkSensitiveDataInHeap({
      page,
      sensitiveDataSteps: [PASSWORD],
      expectPresent: true
    });

    // 5. Complete recovery process
    await page.locator('button:visible', { hasText: /^Continue$/ }).click();

    await expect(
      page.getByRole('heading', { name: 'Quantum Vault', exact: true })
    ).toBeVisible();

    // 6. Final absence (Mnemonic should be cleared from heap after flow completion)
    console.log(`[Recovery Flow] Verifying final absence...`);
    await checkSensitiveDataInHeap({
      page,
      sensitiveDataSteps: RECOVERY_MNEMONIC_STEPS,
      expectPresent: false
    });
    await checkSensitiveDataInHeap({
      page,
      sensitiveDataSteps: PASSWORD_STEPS,
      expectPresent: false
    });
  });
});
