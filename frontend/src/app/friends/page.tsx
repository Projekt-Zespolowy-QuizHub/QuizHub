import { serverFetch } from '@/lib/serverApi';
import { Friend, PendingRequest } from '@/lib/api';
import FriendsClient from './FriendsClient';

export default async function FriendsPage() {
  const [friends, pending] = await Promise.all([
    serverFetch<Friend[]>('/friends/'),
    serverFetch<PendingRequest[]>('/friends/pending/'),
  ]);

  return (
    <FriendsClient
      initialFriends={friends ?? []}
      initialPending={pending ?? []}
    />
  );
}
