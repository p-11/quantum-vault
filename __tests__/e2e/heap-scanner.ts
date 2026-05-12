import { expect, type Page } from '@playwright/test';

/**
 * Helper to check for sensitive data and its partial combinations in the browser's heap.
 */
type CheckSensitiveDataInHeapInput = {
  page: Page;
  sensitiveDataSteps: readonly (string | Uint8Array)[];
  expectPresent: boolean;
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const parseSnapshotStrings = (snapshotData: string): string[] => {
  const parsed = JSON.parse(snapshotData);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid heap snapshot payload: expected object');
  }

  const strings = Reflect.get(parsed, 'strings');
  if (!isStringArray(strings)) {
    throw new Error('Invalid heap snapshot payload: expected strings array');
  }

  return strings;
};

export async function checkSensitiveDataInHeap({
  page,
  sensitiveDataSteps,
  expectPresent
}: CheckSensitiveDataInHeapInput): Promise<void> {
  const dataToSearch = sensitiveDataSteps.map(step =>
    typeof step === 'string' ? step : new TextDecoder().decode(step)
  );

  const client = await page.context().newCDPSession(page);
  try {
    await client.send('HeapProfiler.enable');
    await client.send('HeapProfiler.collectGarbage');
    await client.send('HeapProfiler.collectGarbage');

    let snapshotData = '';
    client.on('HeapProfiler.addHeapSnapshotChunk', params => {
      snapshotData += params.chunk;
    });

    await client.send('HeapProfiler.takeHeapSnapshot', {
      reportProgress: false
    });

    const snapshotStrings = parseSnapshotStrings(snapshotData);
    const foundItems = snapshotStrings.filter(snapshotString =>
      dataToSearch.some(step => snapshotString.includes(step))
    );
    const found = foundItems.length > 0;

    if (expectPresent) {
      expect(found).toBe(true);
      return;
    }

    expect(found).toBe(false);
  } finally {
    await client.detach();
  }
}
