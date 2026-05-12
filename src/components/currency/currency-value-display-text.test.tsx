import { renderToStaticMarkup } from 'react-dom/server';

import { CurrencyValueDisplayText } from './currency-value-display-text';

describe('CurrencyValueDisplayText', () => {
  it('renders below-threshold values with muted prefix and currency parts', () => {
    const html = renderToStaticMarkup(
      <CurrencyValueDisplayText
        display={{ belowThreshold: 0.01 }}
        currency='usd'
        className='amount'
        mutedClassName='status'
      />
    );

    expect(html).toContain('<span class="status">&lt; </span>');
    expect(html).toContain('<span class="status">$</span>');
    expect(html).toContain('<span>.</span>');
    expect(html).toContain('<span class="status">01</span>');
  });

  it('renders EUR below-threshold values with decimal and currency symbol ordering', () => {
    const html = renderToStaticMarkup(
      <CurrencyValueDisplayText
        display={{ belowThreshold: 0.01 }}
        currency='eur'
        className='amount'
        mutedClassName='status'
      />
    );

    expect(html).toContain('<span class="status">&lt; </span>');
    expect(html).toContain('<span>,</span>');
    expect(html).toContain('<span class="status">01</span>');
    expect(html.indexOf('01</span>')).toBeLessThan(html.indexOf('€</span>'));
  });

  it('renders JPY below-threshold values without a fractional part', () => {
    const html = renderToStaticMarkup(
      <CurrencyValueDisplayText
        display={{ belowThreshold: 0.01 }}
        currency='jpy'
        className='amount'
        mutedClassName='status'
      />
    );
    const jpyCurrencyPart = new Intl.NumberFormat('ja-JP', {
      currency: 'JPY',
      style: 'currency'
    }).formatToParts(0.01);

    expect(jpyCurrencyPart.some(part => part.type === 'fraction')).toBe(false);
    expect(html).toContain('<span class="status">&lt; </span>');
    expect(html).not.toContain('<span class="status">01</span>');
  });

  it('renders unavailable values with the muted class applied to the dash', () => {
    const html = renderToStaticMarkup(
      <CurrencyValueDisplayText
        display={{ unavailable: true }}
        currency='usd'
        className='amount'
        mutedClassName='status'
      />
    );

    expect(html).toBe('<span class="amount status">\u2014</span>');
  });
});
