import { queryNamespace, sharedQueryKeys } from '@/lib/query-keys';

describe('sharedQueryKeys', () => {
  it('returns stable key values for repeated calls with identical input', () => {
    expect(sharedQueryKeys.all).toEqual(sharedQueryKeys.all);
    expect(
      sharedQueryKeys.assetPrice({
        currency: 'usd',
        assetSymbol: 'BTC'
      })
    ).toEqual(
      sharedQueryKeys.assetPrice({
        currency: 'usd',
        assetSymbol: 'BTC'
      })
    );
  });

  it('keeps the namespace rooted at quantum-vault', () => {
    expect(sharedQueryKeys.all).toEqual([queryNamespace]);
  });
});
