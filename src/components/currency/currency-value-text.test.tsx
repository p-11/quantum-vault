import { renderToStaticMarkup } from 'react-dom/server';

import { CurrencyValueText } from '@/components/currency/currency-value-text';

describe('CurrencyValueText', () => {
  it('mutes the currency sign and the fractional part but not the decimal separator', () => {
    const html = renderToStaticMarkup(
      <CurrencyValueText
        value={40}
        currency='usd'
        className='amount'
        mutedClassName='muted'
      />
    );

    expect(html).toContain('<span class="amount">');
    expect(html).toContain('<span class="muted">$</span>');
    expect(html).toContain('<span>40</span>');
    expect(html).toContain('<span>.</span>');
    expect(html).toContain('<span class="muted">00</span>');
    expect(html).not.toContain('<span class="muted">.</span>');
  });

  it('preserves locale order when the currency sign follows the amount', () => {
    const html = renderToStaticMarkup(
      <CurrencyValueText
        value={1234.56}
        currency='eur'
        className='amount'
        mutedClassName='muted'
      />
    );

    const groupIndex = html.indexOf('<span>.</span>');
    const decimalIndex = html.indexOf('<span>,</span>');
    const fractionIndex = html.indexOf('<span class="muted">56</span>');
    const currencyIndex = html.indexOf('<span class="muted">\u20ac</span>');

    expect(groupIndex).toBeGreaterThan(-1);
    expect(decimalIndex).toBeGreaterThan(groupIndex);
    expect(fractionIndex).toBeGreaterThan(decimalIndex);
    expect(currencyIndex).toBeGreaterThan(fractionIndex);
  });

  it('does not render fraction spans for currencies without minor units', () => {
    const html = renderToStaticMarkup(
      <CurrencyValueText
        value={1234}
        currency='jpy'
        className='amount'
        mutedClassName='muted'
      />
    );

    const currencyIndex = html.indexOf('<span class="muted">\uffe5</span>');
    const integerIndex = html.indexOf('<span>1</span>');

    expect(currencyIndex).toBeGreaterThan(-1);
    expect(integerIndex).toBeGreaterThan(currencyIndex);
    expect(html).not.toContain('<span class="muted">.</span>');
    expect(html).not.toContain('<span class="muted">00</span>');
  });

  it('renders threshold prefixes with muted styling', () => {
    const html = renderToStaticMarkup(
      <CurrencyValueText
        value={0.01}
        currency='usd'
        mutedClassName='muted'
        prefix='< '
      />
    );

    expect(html).toContain('<span class="muted">&lt; </span>');
    expect(html).toContain('<span>0</span>');
  });
});
