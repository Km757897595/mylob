import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useUserGroupStore } from '@/store/userGroup/store';

import Layout from './index';

vi.mock('@/store/userGroup/store', () => ({
  selectActiveGroupDetail: vi.fn(),
  useUserGroupStore: vi.fn(),
}));
vi.mock('./Sidebar', () => ({
  default: () => null,
}));
vi.mock('./UgIdSync', () => ({
  default: () => null,
}));
vi.mock('./useGroupTopicLockCleanup', () => ({
  useGroupTopicLockCleanup: vi.fn(),
}));
vi.mock('@/hooks/useInitAgentConfig', () => ({
  useInitAgentConfig: vi.fn(),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    Outlet: () => null,
  };
});

describe('ug layout', () => {
  it('loads visible groups when entering the route', async () => {
    const fetchVisibleGroups = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useUserGroupStore).mockImplementation((selector: any) =>
      selector({
        activeGroupId: null,
        fetchVisibleGroups,
        myGroups: [],
      }),
    );

    render(<Layout />);

    await waitFor(() => expect(fetchVisibleGroups).toHaveBeenCalled());
  });
});
