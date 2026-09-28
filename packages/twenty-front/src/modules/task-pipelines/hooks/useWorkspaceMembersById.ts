import { useMemo } from 'react';

import { currentWorkspaceMembersState } from '@/auth/states/currentWorkspaceMembersState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export type TaskMemberInfo = {
  id: string;
  fullName: string;
  firstName: string;
  email: string | null;
  avatarUrl: string | null;
};

export const useWorkspaceMembersById = () => {
  const members = useAtomStateValue(currentWorkspaceMembersState);

  return useMemo(() => {
    const map = new Map<string, TaskMemberInfo>();

    for (const member of members) {
      const firstName = member.name?.firstName ?? '';
      const lastName = member.name?.lastName ?? '';
      const fullName = `${firstName} ${lastName}`.trim() || member.userEmail || '—';

      map.set(member.id, {
        id: member.id,
        fullName,
        firstName: firstName || fullName,
        email: member.userEmail ?? null,
        avatarUrl: member.avatarUrl ?? null,
      });
    }

    return map;
  }, [members]);
};
