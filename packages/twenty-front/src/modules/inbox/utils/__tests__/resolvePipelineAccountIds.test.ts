import { type InboxPipeline } from '@/inbox/types/InboxPipeline';
import { resolvePipelineAccountIds } from '@/inbox/utils/resolvePipelineAccountIds';

const accounts = [
  { id: 'gtm', handle: 'gtm@ptstax.com' },
  { id: 'it', handle: 'it@mithub.club' },
  { id: 'yeison-new', handle: 'yeisonb@ptsfinancialservices.com' },
];

const buildPipeline = (accountIds: string[]): InboxPipeline => ({
  id: 'p1',
  name: 'TEAM PIPELINE',
  onlyRules: [],
  excludeRules: [],
  accountIds,
  columns: [],
  cardColumns: {},
});

describe('resolvePipelineAccountIds', () => {
  it('uses every account when the pipeline has no explicit list', () => {
    expect(resolvePipelineAccountIds(buildPipeline([]), accounts)).toEqual({
      effectiveAccountIds: ['gtm', 'it', 'yeison-new'],
      staleAccountIds: [],
      suggestedAccounts: [],
    });
  });

  it('flags a reconnected mailbox and suggests the new account', () => {
    const result = resolvePipelineAccountIds(
      buildPipeline(['yeison-old', 'it', 'gtm']),
      accounts,
    );

    expect(result.effectiveAccountIds).toEqual(['it', 'gtm']);
    expect(result.staleAccountIds).toEqual(['yeison-old']);
    expect(result.suggestedAccounts.map((account) => account.id)).toEqual([
      'yeison-new',
    ]);
  });

  it('does not suggest accounts the user left out on purpose', () => {
    const result = resolvePipelineAccountIds(buildPipeline(['gtm']), accounts);

    expect(result.effectiveAccountIds).toEqual(['gtm']);
    expect(result.staleAccountIds).toEqual([]);
    expect(result.suggestedAccounts).toEqual([]);
  });
});
