import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

vi.mock('@project-eleven/libqc', () => ({
  formatUnits: () => '0',
  isNativeAsset: () => false
}));

import { AlertBanner } from './alert-banner';

describe('AlertBanner', () => {
  it('renders dismiss button test id when dismiss is enabled', () => {
    const html = renderToStaticMarkup(
      <AlertBanner
        tone='warning'
        title='Syncing'
        lines={[{ id: 'line', text: 'In progress' }]}
        onDismiss={() => {}}
        dismissButtonTestId='dismiss-test-id'
      />
    );

    expect(html).toContain('data-testid="dismiss-test-id"');
  });

  it('does not render dismiss button without onDismiss', () => {
    const html = renderToStaticMarkup(
      <AlertBanner
        tone='warning'
        title='Syncing'
        lines={[{ id: 'line', text: 'In progress' }]}
        dismissButtonTestId='dismiss-test-id'
      />
    );

    expect(html).not.toContain('data-testid="dismiss-test-id"');
  });
});
