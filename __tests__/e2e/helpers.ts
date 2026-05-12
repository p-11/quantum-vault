import { expect, type Locator, type Page } from '@playwright/test';
import type { CurrencyCode } from '@/lib/currency';

import {
  DEFAULT_RECOVERY_BTC_ADDRESS,
  DEFAULT_RECOVERY_EVM_ADDRESS,
  installDeterministicRecoveryNetwork
} from './network-mocks';

export const TEST_USER_PASSWORD = 'Test12345678!';
export const TEST_RECOVERY_MNEMONIC =
  'abstract reform twelve inspire cry master vague skirt mention ill velvet nice limit input present old equip double best doctor decrease survey spray wife';
export const VALID_EVM_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

export const vaultLoadTimeoutMs = 20_000;
const vaultStoragePrefix = 'vault_';
const mnemonicWordPattern = /(?:^|\s)(?:0?[1-9]|1\d|2[0-4])[.)]?\s+([a-z]+)/g;
const wordsPerSeedRevealPage = 12;
const totalMnemonicWordCount = 24;
const defaultSecretPhraseTestId = 'secret-phrase';
const initialCreateWalletButtonName =
  /Create a Vault Account|Create a new wallet/i;
const initialRecoverWalletButtonName =
  /Recover a Vault Account|I already have one/i;

export const exportSecretPhraseTestId = 'export-secret-phrase';

export const settingsButtonName = {
  syncWallet: /^SYNC WALLET$/i,
  syncingWallet: /^SYNCING\.\.\.$/i,
  changeCurrency: /^CHANGE CURRENCY(?:\s+[A-Z]{3})?$/i,
  lockWallet: /^LOCK WALLET$/i,
  exportKeys: /^EXPORT KEYS$/i,
  deleteQuantumVault: /^DELETE QUANTUM VAULT$/i,
  lockNow: /^LOCK NOW$/i,
  back: /^BACK$/i,
  revealKeys: /^REVEAL KEYS$/i,
  copy: /^COPY$/i
};

const extractMnemonicWordsFromGridText = (textContent: string): string[] => {
  const words = [...textContent.matchAll(mnemonicWordPattern)].map(
    ([, word]) => word
  );

  if (!words.length) {
    throw new Error('Unable to parse recovery phrase words from reveal grid');
  }

  return words;
};

export const readRecoveryPhraseRevealPageWords = async ({
  page,
  secretPhraseTestId = defaultSecretPhraseTestId
}: {
  page: Page;
  secretPhraseTestId?: string;
}): Promise<string[]> => {
  const textContent = await page.getByTestId(secretPhraseTestId).innerText();
  return extractMnemonicWordsFromGridText(textContent);
};

export const expectSecretPhraseExcludesWords = async ({
  page,
  words,
  secretPhraseTestId = defaultSecretPhraseTestId
}: {
  page: Page;
  words: readonly string[];
  secretPhraseTestId?: string;
}): Promise<void> => {
  const textContent = await page.getByTestId(secretPhraseTestId).innerText();

  for (const word of words) {
    expect(textContent).not.toContain(word);
  }
};

export const expectRecoveryPhraseWordsNotRendered = async ({
  page,
  words,
  secretPhraseTestId = defaultSecretPhraseTestId
}: {
  page: Page;
  words: readonly string[];
  secretPhraseTestId?: string;
}): Promise<void> => {
  const secretPhraseLocator = page.getByTestId(secretPhraseTestId);
  const scopedText =
    (await secretPhraseLocator.count()) > 0
      ? await secretPhraseLocator.innerText()
      : await page.locator('body').innerText();

  for (const word of words) {
    expect(scopedText).not.toContain(word);
  }
};

const completeWordVerificationStep = async ({
  page,
  mnemonicWords
}: {
  page: Page;
  mnemonicWords: string[];
}): Promise<void> => {
  await expect(
    page.getByRole('heading', { name: 'Confirm your Recovery Phrase' })
  ).toBeVisible();

  const challengeLabels = page.locator('p', { hasText: /^Word #\d+$/ });
  const challengeCount = await challengeLabels.count();
  if (challengeCount === 0) {
    throw new Error('Word verification rendered without any challenges');
  }

  for (
    let challengeIndex = 0;
    challengeIndex < challengeCount;
    challengeIndex += 1
  ) {
    const challengeLabel = challengeLabels.nth(challengeIndex);
    const challengeText = await challengeLabel.innerText();
    const matchedPosition = challengeText.match(/Word #(\d+)/);
    if (!matchedPosition) {
      throw new Error(`Unable to parse challenge label: "${challengeText}"`);
    }

    const wordIndex = Number(matchedPosition[1]) - 1;
    const expectedWord = mnemonicWords[wordIndex];
    if (!expectedWord) {
      throw new Error(
        `Mnemonic word missing for challenge position ${wordIndex + 1}`
      );
    }

    const challengeContainer = challengeLabel.locator('xpath=..');
    await challengeContainer
      .getByRole('button', { name: expectedWord, exact: true })
      .click();
  }

  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
};

type WalletCreationBackupMode = 'skip' | 'verify';

export const installClipboardMock = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    let lastCopiedText = '';
    Object.defineProperty(window, '__lastCopiedText', {
      configurable: true,
      get: () => lastCopiedText
    });

    const clipboardMock = {
      writeText: async (value: string) => {
        lastCopiedText = value;
      },
      readText: async () => lastCopiedText
    };

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboardMock
    });
  });
};

export const readCopiedClipboardText = async (
  page: Page
): Promise<string | null> =>
  page.evaluate(() => {
    const copiedValue = Reflect.get(window, '__lastCopiedText');
    return typeof copiedValue === 'string' ? copiedValue : null;
  });

const clearLibQCWebStorage = async (page: Page): Promise<void> => {
  await page.evaluate((prefix: string) => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }, vaultStoragePrefix);
};

export const resetClientStorage = async (page: Page): Promise<void> => {
  await page.goto('/');
  await clearLibQCWebStorage(page);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
};

export const completeStartupOnboarding = async (page: Page): Promise<void> => {
  const onboardingHeading = page.getByRole('heading', {
    name: 'Sensible quantum security'
  });

  if (!(await onboardingHeading.isVisible())) {
    return;
  }

  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /^get started$/i }).click();

  const createButton = page.getByRole('button', {
    name: initialCreateWalletButtonName
  });
  const recoverButton = page.getByRole('button', {
    name: initialRecoverWalletButtonName
  });

  await expect
    .poll(async () => {
      const isCreateVisible = await createButton.isVisible();
      const isRecoverVisible = await recoverButton.isVisible();
      return isCreateVisible || isRecoverVisible;
    })
    .toBe(true);
};

const ensureInitialEntrySurface = async (page: Page): Promise<void> => {
  const createButton = page.getByRole('button', {
    name: initialCreateWalletButtonName
  });
  const recoverButton = page.getByRole('button', {
    name: initialRecoverWalletButtonName
  });
  const homeHeading = page.getByRole('heading', { name: 'Quantum Vault' });
  const unlockButton = page.getByRole('button', { name: 'Unlock' });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await createButton.isVisible()) || (await recoverButton.isVisible())) {
      return;
    }

    // If startup drifts into lock/home, re-establish a clean entry flow.
    if ((await homeHeading.isVisible()) || (await unlockButton.isVisible())) {
      await resetClientStorage(page);
    } else {
      await page.reload();
    }

    await completeStartupOnboarding(page);
  }

  await expect(createButton.or(recoverButton).first()).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
};

export const expectInitialEntryVisible = async (page: Page): Promise<void> => {
  await completeStartupOnboarding(page);

  const createButton = page.getByRole('button', {
    name: initialCreateWalletButtonName
  });
  const recoverButton = page.getByRole('button', {
    name: initialRecoverWalletButtonName
  });

  await expect(createButton.or(recoverButton).first()).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
};

export const expectUnifiedHomeSectionOrder = async (
  page: Page
): Promise<void> => {
  await expect(page.getByTestId('home-sections')).toBeVisible();

  const renderedSectionOrder = await page
    .locator('[data-testid^="home-section-"][data-status]')
    .evaluateAll(elements =>
      elements
        .map(element => element.getAttribute('data-status'))
        .filter((value): value is string => value !== null)
    );

  const expectedOrder = ['vulnerable', 'safe', 'withdrawn'].filter(status =>
    renderedSectionOrder.includes(status)
  );

  expect(renderedSectionOrder).toEqual(expectedOrder);
};

export const readHomeSectionStatusForAddress = async ({
  page,
  address
}: {
  page: Page;
  address: string;
}): Promise<string | null> => {
  const card = page
    .locator(`[data-testid="vault-card"][data-address="${address}"]`)
    .first();
  if ((await card.count()) === 0) {
    return null;
  }

  return card.evaluate(element => {
    const section = element.closest(
      '[data-testid^="home-section-"][data-status]'
    );
    if (!(section instanceof HTMLElement)) {
      return null;
    }
    return section.dataset.status ?? null;
  });
};

export const expectAddressToAppearInHomeSection = async ({
  page,
  address,
  status
}: {
  page: Page;
  address: string;
  status: 'vulnerable' | 'safe' | 'withdrawn';
}): Promise<void> => {
  await expect
    .poll(
      () =>
        readHomeSectionStatusForAddress({
          page,
          address
        }),
      { timeout: 30_000 }
    )
    .toBe(status);
};

export const expectHomeVisible = async (page: Page): Promise<void> => {
  await expect(
    page.getByRole('heading', { name: 'Quantum Vault' })
  ).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });

  await expect(page.getByTestId('settings-button')).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });

  await expect(page.getByRole('button', { name: 'Deposit' })).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });

  await expect(page.getByTestId('home-sections')).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
};

export const expectSettingsScreenVisible = async (
  page: Page
): Promise<void> => {
  await expect(page.getByText('Settings', { exact: true })).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });

  await expect(
    page
      .getByRole('button', { name: settingsButtonName.syncWallet })
      .or(page.getByRole('button', { name: settingsButtonName.syncingWallet }))
  ).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });

  await expect(
    page.getByRole('button', { name: settingsButtonName.changeCurrency })
  ).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
  await expect(
    page.getByRole('button', { name: settingsButtonName.exportKeys })
  ).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
  await expect(page.getByTestId('lock-wallet-button')).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
  await expect(
    page.getByRole('button', { name: settingsButtonName.deleteQuantumVault })
  ).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
};

export const openSettingsScreen = async (page: Page): Promise<void> => {
  await expectHomeVisible(page);
  await page.getByTestId('settings-button').click();
  await expectSettingsScreenVisible(page);
};

export const openSettingsSubScreen = async ({
  page,
  actionName,
  screenName
}: {
  page: Page;
  actionName: RegExp;
  screenName: string;
}): Promise<void> => {
  const action = page.getByRole('button', { name: actionName });
  await expect(action).toBeVisible({ timeout: vaultLoadTimeoutMs });
  await expect(action).toBeEnabled();
  await action.click({ force: true });
  await expect(page.getByRole('heading', { name: screenName })).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
};

export const clickActiveBackButton = async (page: Page): Promise<void> => {
  const backButton = page
    .getByTestId('back-button')
    .filter({ visible: true })
    .first();
  await expect(backButton).toBeVisible({ timeout: vaultLoadTimeoutMs });
  await backButton.click();
};

export const returnFromExportKeysToSettings = async (
  page: Page
): Promise<void> => {
  const isSettingsVisible = async (): Promise<boolean> =>
    page
      .getByRole('button', { name: settingsButtonName.exportKeys })
      .isVisible()
      .catch(() => false);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await isSettingsVisible()) {
      await expectSettingsScreenVisible(page);
      return;
    }

    const exportFlowTextBackButton = page
      .getByRole('button', { name: settingsButtonName.back })
      .filter({ visible: true })
      .first();
    const hasExportFlowTextBackButton = await exportFlowTextBackButton
      .isVisible()
      .catch(() => false);

    if (hasExportFlowTextBackButton) {
      await exportFlowTextBackButton.click();
    } else {
      const exportFlowBackButton = page.getByTestId(
        'export-recovery-phrase-back-button'
      );
      await expect(exportFlowBackButton).toBeVisible({
        timeout: vaultLoadTimeoutMs
      });
      await exportFlowBackButton.click();
    }

    const cancelConfirmation = page.getByRole('heading', {
      name: 'Stop export recovery phrase?'
    });
    if (await cancelConfirmation.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /^Yes$/i }).click();
    }
  }

  await expectSettingsScreenVisible(page);
};

export const openExportKeysPasswordGate = async (page: Page): Promise<void> => {
  await page
    .getByRole('button', { name: settingsButtonName.exportKeys })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Confirm Your Password' })
  ).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const currencyOptionLabels = {
  usd: 'US Dollar',
  eur: 'Euro',
  gbp: 'British Pound',
  jpy: 'Japanese Yen'
} satisfies Record<CurrencyCode, string>;

const currencyOptionName = (currencyCode: CurrencyCode): RegExp =>
  new RegExp(`\\b${escapeRegExp(currencyOptionLabels[currencyCode])}\\b`, 'i');

export const getCurrencyOption = (
  page: Page,
  currencyCode: CurrencyCode
): Locator =>
  page
    .getByRole('button', { name: currencyOptionName(currencyCode) })
    .or(page.getByRole('menuitem', { name: currencyOptionName(currencyCode) }))
    .first();

export const expectCurrencyOptionChecked = async ({
  page,
  currencyCode
}: {
  page: Page;
  currencyCode: CurrencyCode;
}): Promise<void> => {
  const option = getCurrencyOption(page, currencyCode);
  await expect(option).toBeVisible({ timeout: vaultLoadTimeoutMs });

  await expect
    .poll(async () => {
      const pressed = await option.getAttribute('aria-pressed');
      const dataSelected = await option.getAttribute('data-selected');
      const hasSelectedCheckmark = await option
        .getByTestId(`currency-selected-check-${currencyCode}`)
        .first()
        .isVisible()
        .catch(() => false);

      return (
        pressed === 'true' || dataSelected === 'true' || hasSelectedCheckmark
      );
    })
    .toBe(true);
};

export const navigateBackToHome = async (
  page: Page,
  { maxBackClicks = 6 }: { maxBackClicks?: number } = {}
): Promise<void> => {
  const homeSections = page.getByTestId('home-sections');

  for (let clickIndex = 0; clickIndex < maxBackClicks; clickIndex += 1) {
    const isHomeVisible = await homeSections.isVisible().catch(() => false);
    if (isHomeVisible) {
      break;
    }

    await page.getByTestId('back-button').click();
  }

  await expectHomeVisible(page);
};

export const receiveAccountOptionByAddress = (
  page: Page,
  address: string
): Locator =>
  page.locator(
    `[data-testid="receive-account-option"][data-address="${address}"]`
  );

export const receiveSelectedAddressByAddress = (
  page: Page,
  address: string
): Locator =>
  page.locator(
    `[data-testid="receive-selected-address"][data-address="${address}"]`
  );

export const unlockWalletIfPrompted = async (
  page: Page,
  password: string = TEST_USER_PASSWORD
): Promise<void> => {
  const unlockButton = page.getByRole('button', { name: 'Unlock' });
  const homeHeading = page.getByRole('heading', { name: 'Quantum Vault' });
  await expect(unlockButton.or(homeHeading).first()).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });

  if (!(await unlockButton.isVisible())) {
    return;
  }

  await page.getByLabel('Password', { exact: true }).fill(password);
  await unlockButton.click();
};

export const reloadAndUnlockIfNeeded = async (
  page: Page,
  password: string = TEST_USER_PASSWORD
): Promise<void> => {
  await page.reload();
  await unlockWalletIfPrompted(page, password);
};

export const createWalletAndOpenHome = async ({
  page,
  withDeterministicNetwork = true,
  backupMode = 'skip'
}: {
  page: Page;
  withDeterministicNetwork?: boolean;
  backupMode?: WalletCreationBackupMode;
}): Promise<void> => {
  if (withDeterministicNetwork) {
    await installDeterministicRecoveryNetwork({ page });
  }

  await resetClientStorage(page);
  await completeStartupOnboarding(page);
  await ensureInitialEntrySurface(page);

  const createButton = page.getByRole('button', {
    name: initialCreateWalletButtonName
  });
  await expect(createButton).toBeVisible({ timeout: vaultLoadTimeoutMs });
  await createButton.click();
  await page.getByLabel('Password', { exact: true }).fill(TEST_USER_PASSWORD);
  await page.getByLabel('Confirm Password').fill(TEST_USER_PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();

  if (backupMode === 'verify') {
    await page.getByRole('button', { name: 'Reveal Recovery Phrase' }).click();
    await expect(
      page.getByRole('button', { name: 'Click to Reveal' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Click to Reveal' }).click();

    const firstPageWords = await readRecoveryPhraseRevealPageWords({ page });
    expect(firstPageWords).toHaveLength(wordsPerSeedRevealPage);

    await page.getByRole('button', { name: 'Hide Phrase' }).click();
    await expectSecretPhraseExcludesWords({
      page,
      words: firstPageWords
    });
    await page.getByRole('button', { name: 'Click to Reveal' }).click();

    await page.getByRole('button', { name: 'Next' }).click();

    const secondPageWords = await readRecoveryPhraseRevealPageWords({ page });
    expect(secondPageWords).toHaveLength(wordsPerSeedRevealPage);

    const mnemonicWords = [...firstPageWords, ...secondPageWords];
    expect(mnemonicWords).toHaveLength(totalMnemonicWordCount);

    await page.getByRole('button', { name: 'I Wrote It Down' }).click();
    await page.getByRole('button', { name: 'Confirm Now' }).click();

    await completeWordVerificationStep({ page, mnemonicWords });
  } else {
    // Prefer deterministic fast path for smoke stability.
    const skipBackupButton = page.getByTestId('wallet-creation-skip-backup');
    const canSkipBackup = await skipBackupButton
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (canSkipBackup) {
      await skipBackupButton.click();
    } else {
      await page
        .getByRole('button', { name: 'Reveal Recovery Phrase' })
        .click();
      await expect(
        page.getByRole('button', { name: 'Click to Reveal' })
      ).toBeVisible();
      await page.getByRole('button', { name: 'Click to Reveal' }).click();

      const nextButton = page.getByRole('button', { name: 'Next' });
      if (await nextButton.isVisible()) {
        await nextButton.click();
      }

      await page.getByRole('button', { name: 'I Wrote It Down' }).click();

      const doThisLaterButton = page.getByRole('button', {
        name: /Do This Later/i
      });
      if (await doThisLaterButton.isVisible()) {
        await doThisLaterButton.click();
      }
    }
  }

  const openVaultButton = page.getByTestId('open-vault');
  const canOpenVault = await openVaultButton
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (canOpenVault) {
    await openVaultButton.click();
  }

  await expectHomeVisible(page);
};

const openRecoveryStart = async (page: Page): Promise<void> => {
  const recoveryButton = page.getByRole('button', {
    name: initialRecoverWalletButtonName
  });
  const phraseInput = page.getByTestId('recovery-phrase-word-input');

  await expect(recoveryButton).toBeVisible({ timeout: vaultLoadTimeoutMs });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await phraseInput.isVisible()) {
      return;
    }

    await recoveryButton.click();
    const didOpenRecovery = await phraseInput
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (didOpenRecovery) {
      return;
    }
  }

  await expect(phraseInput).toBeVisible({ timeout: vaultLoadTimeoutMs });
};

export const pasteRecoveryPhraseInput = async ({
  page,
  phrase
}: {
  page: Page;
  phrase: string;
}): Promise<void> => {
  const expectedCounterText = `${totalMnemonicWordCount}/${totalMnemonicWordCount}`;
  const counter = page.getByTestId('recovery-phrase-counter');
  const isPhraseComplete = async (): Promise<boolean> =>
    counter
      .innerText()
      .then(text => text.trim() === expectedCounterText)
      .catch(() => false);

  const input = page.getByTestId('recovery-phrase-word-input');
  await input.click();
  await input.evaluate((element, payload) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text', payload);
    clipboardData.setData('text/plain', payload);
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData
    });
    element.dispatchEvent(event);
  }, phrase);

  const didPaste = await expect
    .poll(isPhraseComplete, { timeout: 1000 })
    .toBe(true)
    .then(() => true)
    .catch(() => false);

  if (!didPaste) {
    await input.fill(`${phrase} `);
  }

  const didFill = await expect
    .poll(isPhraseComplete, { timeout: 1000 })
    .toBe(true)
    .then(() => true)
    .catch(() => false);

  if (!didFill) {
    await input.pressSequentially(`${phrase} `);
  }

  await expect(counter).toHaveText(expectedCounterText);
};

export const recoverWalletAndOpenHome = async ({
  page,
  mnemonic = TEST_RECOVERY_MNEMONIC,
  withDeterministicNetwork = true
}: {
  page: Page;
  mnemonic?: string;
  withDeterministicNetwork?: boolean;
}): Promise<void> => {
  if (withDeterministicNetwork) {
    await installDeterministicRecoveryNetwork({ page });
  }

  await resetClientStorage(page);
  await completeStartupOnboarding(page);
  await ensureInitialEntrySurface(page);
  await openRecoveryStart(page);

  await pasteRecoveryPhraseInput({ page, phrase: mnemonic });

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Password', { exact: true }).fill(TEST_USER_PASSWORD);
  await page.getByLabel('Confirm Password').fill(TEST_USER_PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expectHomeVisible(page);

  await expect(
    page
      .locator(
        `[data-testid="vault-card"][data-address="${DEFAULT_RECOVERY_EVM_ADDRESS}"]`
      )
      .first()
  ).toBeVisible({ timeout: vaultLoadTimeoutMs });

  await expect(
    page
      .locator(
        `[data-testid="vault-card"][data-address="${DEFAULT_RECOVERY_BTC_ADDRESS}"]`
      )
      .first()
  ).toBeVisible({ timeout: vaultLoadTimeoutMs });
};

export const expectCopiedToClipboardToast = async (
  page: Page
): Promise<void> => {
  await expect(
    page
      .locator('[data-sonner-toast]')
      .filter({ hasText: 'Copied to clipboard.' })
      .first()
  ).toBeVisible();
};

const visualRegressionStyleTagId = 'e2e-visual-regression-style';

export const prepareVisualRegressionCapture = async (
  page: Page
): Promise<void> => {
  await page.evaluate(tagId => {
    if (document.getElementById(tagId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = tagId;
    style.textContent = `
      *,
      *::before,
      *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }

      [data-sonner-toast] {
        opacity: 0 !important;
        pointer-events: none !important;
      }

      [data-testid='export-secret-phrase'] {
        color: transparent !important;
      }
    `;
    document.head.append(style);
  }, visualRegressionStyleTagId);
};

export const expectRootScreenshot = async ({
  page,
  name
}: {
  page: Page;
  name: string;
}): Promise<void> => {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  await expect(page.locator('#root')).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css'
  });
};

export const openReceiveScreen = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Deposit' }).click();
  await expect(page.getByTestId('receive-screen')).toBeVisible();
  await expect(page.getByText('Select receiving network')).toBeVisible();
};

type VaultAddressPrefix = '0x' | 'bc1';
type WithdrawButtonExpectation = 'visible' | 'hidden';

const openVaultDetailByAddressPrefix = async ({
  page,
  address,
  addressPrefix,
  withdrawButtonExpectation = 'visible'
}: {
  page: Page;
  address?: string;
  addressPrefix: VaultAddressPrefix;
  withdrawButtonExpectation?: WithdrawButtonExpectation;
}): Promise<void> => {
  const vaultCardSelector =
    address === undefined
      ? `[data-testid="vault-card"][data-address^="${addressPrefix}"]`
      : `[data-testid="vault-card"][data-address="${address}"]`;

  await expectHomeVisible(page);

  const backButton = page.getByTestId('vault-detail-back-button');
  const copyButton = page.getByTestId('vault-detail-copy-address-button');
  const withdrawButton = page.getByTestId('vault-detail-withdraw-button');
  const detailVisibilityProbeTimeoutMs = Math.max(
    1000,
    Math.floor(vaultLoadTimeoutMs / 4)
  );
  const maxOpenAttempts = 3;

  const assertWithdrawButtonExpectation = async (): Promise<void> => {
    if (withdrawButtonExpectation === 'visible') {
      await expect(withdrawButton).toBeVisible({
        timeout: vaultLoadTimeoutMs
      });
      return;
    }
    await expect(withdrawButton).toBeHidden({ timeout: vaultLoadTimeoutMs });
  };

  for (let attempt = 0; attempt < maxOpenAttempts; attempt += 1) {
    const vaultCard = page.locator(vaultCardSelector).first();
    await expect(vaultCard).toBeVisible({ timeout: vaultLoadTimeoutMs });
    await vaultCard.click();

    const isDetailVisible = await backButton
      .waitFor({
        state: 'visible',
        timeout: detailVisibilityProbeTimeoutMs
      })
      .then(() => true)
      .catch(() => false);

    if (isDetailVisible) {
      await expect(copyButton).toBeVisible({ timeout: vaultLoadTimeoutMs });
      await assertWithdrawButtonExpectation();
      return;
    }

    await expectHomeVisible(page);
  }

  await expect(backButton).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
  await expect(copyButton).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
  await assertWithdrawButtonExpectation();
};

export type OpenVaultDetailInput = {
  address?: string;
  withdrawButtonExpectation?: WithdrawButtonExpectation;
};

export const openEthereumVaultDetail = async (
  page: Page,
  input: OpenVaultDetailInput = {}
): Promise<void> =>
  openVaultDetailByAddressPrefix({
    page,
    ...input,
    addressPrefix: '0x'
  });

export const openBitcoinVaultDetail = async (
  page: Page,
  input: OpenVaultDetailInput = {}
): Promise<void> =>
  openVaultDetailByAddressPrefix({
    page,
    ...input,
    addressPrefix: 'bc1'
  });

type WithdrawFlowPath = 'manual' | 'suggested';

export const openWithdrawFlowStep = async ({
  page,
  path
}: {
  page: Page;
  path: WithdrawFlowPath;
}): Promise<void> => {
  const stepLocatorById: Record<
    'warning' | 'suggestion' | 'destination' | 'review',
    Locator
  > = {
    warning: page.getByTestId('withdraw-step-warning'),
    suggestion: page.getByTestId('withdraw-suggestion-step'),
    destination: page.getByTestId('withdraw-step-destination'),
    review: page.getByTestId('withdraw-step-review')
  };
  const waitForFirstVisibleStep = async (
    stepIds: ReadonlyArray<'warning' | 'suggestion' | 'destination' | 'review'>
  ): Promise<'warning' | 'suggestion' | 'destination' | 'review'> => {
    try {
      return await Promise.any(
        stepIds.map(stepId =>
          stepLocatorById[stepId]
            .waitFor({ state: 'visible', timeout: vaultLoadTimeoutMs })
            .then(() => stepId)
        )
      );
    } catch {
      throw new Error(
        `Timed out waiting for withdraw step (${stepIds.join(', ')})`
      );
    }
  };

  await page.getByTestId('vault-detail-withdraw-button').click();

  const initialStep = await waitForFirstVisibleStep([
    'warning',
    'suggestion',
    'destination'
  ]);
  if (initialStep === 'warning') {
    await page
      .locator('[data-testid="continue-button"][data-step="warning"]')
      .click();
  }

  const nextStep =
    initialStep === 'warning'
      ? await waitForFirstVisibleStep(['suggestion', 'destination'])
      : initialStep;
  if (path === 'suggested') {
    if (nextStep !== 'suggestion') {
      throw new Error(
        'Expected withdraw suggestion step to be visible for suggested path'
      );
    }
    await page.getByTestId('withdraw-suggestion-yes-button').click();
    await expect(stepLocatorById.review).toBeVisible({
      timeout: vaultLoadTimeoutMs
    });
    return;
  }
  if (nextStep === 'suggestion') {
    await page.getByTestId('withdraw-suggestion-no-button').click();
  }
  await expect(stepLocatorById.destination).toBeVisible({
    timeout: vaultLoadTimeoutMs
  });
};

export const openWithdrawDestinationStep = async (
  page: Page
): Promise<void> => {
  await openWithdrawFlowStep({ page, path: 'manual' });
};

export type WithdrawOutcome = 'success' | 'error';

export const waitForWithdrawOutcome = async ({
  page
}: {
  page: Page;
}): Promise<WithdrawOutcome> => {
  const startedAt = Date.now();
  const timeoutMs = 30_000;
  const withdrawnLifecycleKind = 'withdrawn';

  while (Date.now() - startedAt <= timeoutMs) {
    const lifecycleBanner = page.getByTestId('vault-lifecycle-banner');
    if (
      (await lifecycleBanner.isVisible()) &&
      (await lifecycleBanner.getAttribute('data-lifecycle-kind')) ===
        withdrawnLifecycleKind
    ) {
      return 'success';
    }
    if (
      await page.getByTestId('withdraw-error-back-to-vault-button').isVisible()
    ) {
      return 'error';
    }
    await page.waitForTimeout(250);
  }

  throw new Error('Timed out waiting for withdraw outcome');
};

export const completeExternalEthereumWithdraw = async ({
  page,
  destinationAddress = VALID_EVM_ADDRESS,
  onRetry
}: {
  page: Page;
  destinationAddress?: string;
  onRetry(): Promise<void>;
}): Promise<void> => {
  let hasSuccessfulWithdrawal = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await openWithdrawDestinationStep(page);
    await page
      .getByTestId('destination-address-input')
      .fill(destinationAddress);
    await page
      .locator('[data-testid="continue-button"][data-step="destination"]')
      .click();

    await expect(page.getByTestId('confirm-withdraw-button')).toHaveText(
      'CONFIRM WITHDRAWAL'
    );
    await expect(page.getByTestId('confirm-withdraw-button')).toBeEnabled();
    await page.getByTestId('confirm-withdraw-button').click();

    const outcome = await waitForWithdrawOutcome({ page });
    if (outcome === 'success') {
      hasSuccessfulWithdrawal = true;
      break;
    }

    const backToVaultButton = page.getByTestId(
      'withdraw-error-back-to-vault-button'
    );
    if (!(await backToVaultButton.isVisible())) {
      break;
    }

    await backToVaultButton.click();
    await expect(
      page.getByTestId('vault-detail-withdraw-button')
    ).toBeVisible();
    await onRetry();
  }

  expect(hasSuccessfulWithdrawal).toBe(true);
};

export const getPrimaryEthereumAddress = async (
  page: Page
): Promise<string> => {
  const address = await page
    .locator('[data-testid="vault-card"][data-address^="0x"]')
    .first()
    .getAttribute('data-address');

  if (!address) {
    throw new Error('Primary Ethereum address not found');
  }

  return address;
};

export const getPrimaryBitcoinAddress = async (page: Page): Promise<string> => {
  const address = await page
    .locator('[data-testid="vault-card"][data-address^="bc1"]')
    .first()
    .getAttribute('data-address');

  if (!address) {
    throw new Error('Primary Bitcoin address not found');
  }

  return address;
};

const parseEnvOrigin = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const localBitcoinApiOrigins = [
  'http://127.0.0.1:3001',
  'http://localhost:3001'
] as const;

export const installDeterministicBitcoinReadMocks = async (
  page: Page,
  {
    fundedTxoCount = 0,
    fundedTxoSum = 0,
    spentTxoCount = 0,
    spentTxoSum = 0,
    txCount = 0
  }: {
    fundedTxoCount?: number;
    fundedTxoSum?: number;
    spentTxoCount?: number;
    spentTxoSum?: number;
    txCount?: number;
  } = {}
): Promise<void> => {
  const bitcoinOrigins = new Set<string>([
    'https://blockstream.info',
    ...localBitcoinApiOrigins
  ]);
  const envBitcoinOrigin = parseEnvOrigin(process.env.VITE_BITCOIN_API_URL);
  if (envBitcoinOrigin) {
    bitcoinOrigins.add(envBitcoinOrigin);
  }

  for (const origin of bitcoinOrigins) {
    await page.route(`${origin}/**`, async route => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }

      const pathname = new URL(route.request().url()).pathname;
      if (!pathname.includes('/address/') && !pathname.includes('/txs')) {
        await route.fallback();
        return;
      }

      if (pathname.endsWith('/txs')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
        return;
      }

      const requestedAddress = pathname.split('/').at(-1);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          address: requestedAddress,
          chain_stats: {
            funded_txo_count: fundedTxoCount,
            funded_txo_sum: fundedTxoSum,
            spent_txo_count: spentTxoCount,
            spent_txo_sum: spentTxoSum,
            tx_count: txCount
          },
          mempool_stats: {
            funded_txo_count: 0,
            funded_txo_sum: 0,
            spent_txo_count: 0,
            spent_txo_sum: 0,
            tx_count: 0
          }
        })
      });
    });
  }
};
