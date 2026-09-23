import { type InboxPipeline } from '@/inbox/types/InboxPipeline';

type AccountLike = { id: string; handle: string };

export type ResolvedPipelineAccounts<Account extends AccountLike> = {
  // Lo que el tablero realmente consulta.
  effectiveAccountIds: string[];
  // Ids guardados en el pipeline que ya no son cuentas del usuario. Pasa al
  // reconectar un buzón: Twenty crea un connectedAccount nuevo con otro id y
  // el pipeline se queda apuntando al viejo, sin error y sin correos.
  staleAccountIds: string[];
  // Cuentas vivas que el pipeline no incluye. Solo se sugieren cuando hay ids
  // viejos: sin esa señal, dejarlas fuera fue una decisión del usuario.
  suggestedAccounts: Account[];
};

export const resolvePipelineAccountIds = <Account extends AccountLike>(
  pipeline: InboxPipeline,
  accounts: Account[],
): ResolvedPipelineAccounts<Account> => {
  const allAccountIds = accounts.map((account) => account.id);

  // Lista vacía = "todas mis cuentas": nunca queda desactualizada.
  if (pipeline.accountIds.length === 0) {
    return {
      effectiveAccountIds: allAccountIds,
      staleAccountIds: [],
      suggestedAccounts: [],
    };
  }

  const liveAccountIds = new Set(allAccountIds);
  const effectiveAccountIds = pipeline.accountIds.filter((accountId) =>
    liveAccountIds.has(accountId),
  );
  const staleAccountIds = pipeline.accountIds.filter(
    (accountId) => !liveAccountIds.has(accountId),
  );

  const suggestedAccounts =
    staleAccountIds.length > 0
      ? accounts.filter((account) => !effectiveAccountIds.includes(account.id))
      : [];

  return { effectiveAccountIds, staleAccountIds, suggestedAccounts };
};
