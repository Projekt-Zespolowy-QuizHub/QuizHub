export interface CreateRoomPayload {
  host_nickname: string;
  categories: string[];
  total_rounds?: number;
  pack_id?: number;
  game_mode?: string;
}

export interface JoinRoomPayload {
  nickname: string;
  room_code: string;
}

export interface RoomData {
  code: string;
  categories: string[];
  status: 'lobby' | 'in_progress' | 'finished';
  total_rounds: number;
  current_round: number;
  player_count: number;
  players: { id: number; nickname: string; score: number; is_host: boolean; avatar?: string }[];
}

export interface UserProfile {
  id: number;
  display_name: string;
  email: string;
  total_score: number;
  games_played: number;
  avatar: string;
  theme: string;
  coins: number;
  created_at: string;
}

export interface Achievement {
  condition_type: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface CategoryAccuracy {
  category: string;
  accuracy: number;
  total_answers: number;
}

export interface TrendEntry {
  date: string;
  score: number;
}

export interface UserStats {
  display_name: string;
  games_played: number;
  total_score: number;
  wins: number;
  win_rate: number;
  correct_percentage: number;
  avg_response_time_ms: number;
  best_streak: number;
  category_accuracy: CategoryAccuracy[];
  games_per_day: Record<string, number>;
  performance_trend: TrendEntry[];
}

export interface RankEntry {
  rank: number;
  display_name: string;
  total_score?: number;
  score?: number;
  avatar?: string;
}

export interface GameHistoryEntry {
  date: string;
  categories: string[];
  score: number;
  rank: number;
  room_code: string;
}

export interface Friend {
  id: number;
  display_name: string;
  total_score: number;
}

export interface PendingRequest {
  id: number;
  from_display_name: string;
}

export interface SearchResult {
  id: number;
  display_name: string;
  is_friend?: boolean;
}

export interface PublicGame {
  code: string;
  categories: string[];
  scheduled_at: string;
  player_count: number;
}

export interface ReplayAnswer {
  nickname: string;
  chosen_option: string;
  is_correct: boolean;
  response_time_ms: number;
  points_earned: number;
}

export interface ReplayQuestion {
  round: number;
  content: string;
  options: string[];
  correct: string;
  explanation: string;
  fastest_nick: string | null;
  answers: ReplayAnswer[];
}

export interface ReplayData {
  room_code: string;
  questions: ReplayQuestion[];
}

export interface QuestionPack {
  id: number;
  name: string;
  description: string;
  is_public: boolean;
  question_count: number;
  is_mine: boolean;
}

export interface PackQuestion {
  id: number;
  question_text: string;
  answers: string[];
  correct_index: number;
  image_emoji: string;
}

export interface PackDetail {
  id: number;
  name: string;
  description: string;
  is_public: boolean;
  is_mine: boolean;
  questions: PackQuestion[];
}

export interface Clan {
  id: number;
  name: string;
  tag: string;
  avatar: string;
  description: string;
  is_open: boolean;
  max_members: number;
  member_count: number;
  leader: string;
  total_score: number;
  is_member: boolean;
  created_at: string;
  rank?: number;
}

export interface ClanMember {
  user_id: number;
  display_name: string;
  avatar: string;
  total_score: number;
  games_played: number;
  role: 'leader' | 'officer' | 'member';
  joined_at: string;
}

export interface ClanDetail extends Clan {
  members: ClanMember[];
}

export interface ClanLeaderboardEntry {
  rank: number;
  id: number;
  name: string;
  tag: string;
  avatar: string;
  total_score: number;
  member_count: number;
  leader: string;
}

export interface Tournament {
  id: number;
  name: string;
  icon: string;
  category: string;
  status: 'upcoming' | 'active' | 'finished';
  start_date: string;
  end_date: string;
  max_participants: number;
  participant_count: number;
  prize_coins: number;
  description: string;
  is_open: boolean;
  is_participant: boolean;
  creator_name: string;
  created_at: string;
}

export interface TournamentParticipant {
  rank: number;
  user_id: number;
  display_name: string;
  avatar: string;
  score: number;
  games_played: number;
  joined_at: string;
}

export interface ShopItem {
  id: number;
  code: string;
  name: string;
  description: string;
  item_type: string;
  price: number;
  emoji_icon: string;
  owned: boolean;
  quantity: number;
  is_equipped: boolean;
}

export interface InventoryItem {
  id: number;
  item_id: number;
  code: string;
  name: string;
  description: string;
  item_type: string;
  emoji_icon: string;
  purchased_at: string;
  is_equipped: boolean;
  quantity: number;
}

export interface TournamentDetail extends Tournament {
  participants: TournamentParticipant[];
}

function normalizeApiPath(path: string): string {
  if (path === '/') return '';
  return path.replace(/\/+(?=\?|$)/, '');
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${normalizeApiPath(path)}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Rooms
  createRoom: (payload: CreateRoomPayload) =>
    apiFetch<{ room_code: string }>('/rooms/', { method: 'POST', body: JSON.stringify(payload) }),
  joinRoom: (payload: JoinRoomPayload) =>
    apiFetch<{ room_code: string; player_id: number; nickname: string }>('/rooms/join/', { method: 'POST', body: JSON.stringify(payload) }),
  getRoom: (code: string) =>
    apiFetch<RoomData>(`/rooms/${code}/`),
  getRoomHistory: (code: string) =>
    apiFetch<any>(`/rooms/${code}/history/`),
  getRoomReplay: (code: string) =>
    apiFetch<ReplayData>(`/rooms/${code}/replay/`),
  getNextPublicGame: () =>
    apiFetch<PublicGame>('/rooms/public/next/'),

  // Auth
  register: (email: string, password: string, display_name: string) =>
    apiFetch<{ display_name: string; email: string }>('/auth/register/', { method: 'POST', body: JSON.stringify({ email, password, display_name }) }),
  login: (email: string, password: string) =>
    apiFetch<{ display_name: string; email: string }>('/auth/login/', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () =>
    apiFetch<{ message: string }>('/auth/logout/', { method: 'POST' }),
  me: () =>
    apiFetch<UserProfile>('/auth/me/'),
  // Profile
  getStats: () =>
    apiFetch<UserStats>('/profile/stats/'),
  getHistory: () =>
    apiFetch<GameHistoryEntry[]>('/profile/history/'),
  getAchievements: () =>
    apiFetch<Achievement[]>('/profile/achievements/'),
  updateAvatar: (avatar: string) =>
    apiFetch<{ avatar: string }>('/profile/avatar/', { method: 'PATCH', body: JSON.stringify({ avatar }) }),

  // Shop
  getShopItems: () =>
    apiFetch<ShopItem[]>('/shop/'),
  buyShopItem: (itemId: number) =>
    apiFetch<{ message: string; coins: number; quantity: number }>('/shop/buy/', {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId }),
    }),
  equipShopItem: (itemId: number) =>
    apiFetch<{ is_equipped: boolean; code?: string }>('/shop/equip/', {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId }),
    }),
  getShopInventory: () =>
    apiFetch<InventoryItem[]>('/shop/inventory/'),
  getShopCoins: () =>
    apiFetch<{ coins: number }>('/shop/coins/'),

  // Friends
  searchUsers: (q: string) =>
    apiFetch<SearchResult[]>(`/friends/search/?q=${encodeURIComponent(q)}`),
  getFriends: () =>
    apiFetch<Friend[]>('/friends/'),
  getPendingRequests: () =>
    apiFetch<PendingRequest[]>('/friends/pending/'),
  sendFriendRequest: (userId: number) =>
    apiFetch<{ message: string }>('/friends/request/', { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  respondFriendRequest: (requestId: number, action: 'accept' | 'reject') =>
    apiFetch<{ message: string }>('/friends/respond/', { method: 'POST', body: JSON.stringify({ request_id: requestId, action }) }),

  // Rankings
  getRankingGlobal: () =>
    apiFetch<RankEntry[]>('/rankings/global/'),
  getRankingWeekly: () =>
    apiFetch<RankEntry[]>('/rankings/weekly/'),
  getRankingFriends: () =>
    apiFetch<RankEntry[]>('/rankings/friends/'),

  // Challenges
  challengeFriend: (friend_profile_id: number, categories: string[], total_rounds?: number) =>
    apiFetch<{ challenge_id: number; room_code: string }>('/friends/challenge/', {
      method: 'POST',
      body: JSON.stringify({ friend_profile_id, categories, total_rounds }),
    }),
  respondChallenge: (challenge_id: number, action: 'accept' | 'decline') =>
    apiFetch<{ room_code?: string; message: string }>('/friends/challenge/respond/', {
      method: 'POST',
      body: JSON.stringify({ challenge_id, action }),
    }),

  // Question Packs
  getPacks: () =>
    apiFetch<QuestionPack[]>('/packs/'),
  createPack: (name: string, description: string, is_public: boolean) =>
    apiFetch<{ id: number; name: string }>('/packs/create/', {
      method: 'POST',
      body: JSON.stringify({ name, description, is_public }),
    }),
  getPack: (id: number) =>
    apiFetch<PackDetail>(`/packs/${id}/`),
  updatePack: (id: number, data: Partial<{ name: string; description: string; is_public: boolean }>) =>
    apiFetch<{ id: number; name: string }>(`/packs/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deletePack: (id: number) =>
    apiFetch<void>(`/packs/${id}/`, { method: 'DELETE' }),
  addQuestion: (packId: number, q: { question_text: string; answers: string[]; correct_index: number; image_emoji?: string }) =>
    apiFetch<PackQuestion>(`/packs/${packId}/questions/`, {
      method: 'POST',
      body: JSON.stringify(q),
    }),
  updateQuestion: (packId: number, qId: number, q: Partial<PackQuestion>) =>
    apiFetch<PackQuestion>(`/packs/${packId}/questions/${qId}/`, {
      method: 'PATCH',
      body: JSON.stringify(q),
    }),
  deleteQuestion: (packId: number, qId: number) =>
    apiFetch<void>(`/packs/${packId}/questions/${qId}/`, { method: 'DELETE' }),

  // Clans
  listClans: () =>
    apiFetch<Clan[]>('/clans/'),
  getClan: (id: number) =>
    apiFetch<ClanDetail>(`/clans/${id}/`),
  createClan: (payload: {
    name: string;
    tag: string;
    description?: string;
    avatar?: string;
    is_open?: boolean;
    max_members?: number;
  }) =>
    apiFetch<Clan>('/clans/', { method: 'POST', body: JSON.stringify(payload) }),
  joinClan: (id: number) =>
    apiFetch<{ message: string }>(`/clans/${id}/join/`, { method: 'POST' }),
  leaveClan: (id: number) =>
    apiFetch<{ message: string }>(`/clans/${id}/leave/`, { method: 'POST' }),
  inviteToClan: (id: number, userId: number) =>
    apiFetch<{ message: string }>(`/clans/${id}/invite/`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  kickFromClan: (id: number, userId: number) =>
    apiFetch<{ message: string }>(`/clans/${id}/kick/`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  respondClanInvite: (inviteId: number, action: 'accept' | 'reject') =>
    apiFetch<{ message: string }>('/clans/invite/respond/', {
      method: 'POST',
      body: JSON.stringify({ invite_id: inviteId, action }),
    }),
  getClanLeaderboard: () =>
    apiFetch<ClanLeaderboardEntry[]>('/clans/leaderboard/'),

  // Tournaments
  listTournaments: (status?: 'upcoming' | 'active' | 'finished') =>
    apiFetch<Tournament[]>(`/tournaments/${status ? `?status=${status}` : ''}`),
  getTournament: (id: number) =>
    apiFetch<TournamentDetail>(`/tournaments/${id}/`),
  createTournament: (payload: {
    name: string;
    category: string;
    start_date: string;
    end_date: string;
    max_participants: number;
    prize_coins?: number;
    description?: string;
    icon?: string;
    is_open?: boolean;
  }) =>
    apiFetch<Tournament>('/tournaments/', { method: 'POST', body: JSON.stringify(payload) }),
  joinTournament: (id: number) =>
    apiFetch<{ message: string }>(`/tournaments/${id}/join/`, { method: 'POST' }),
  leaveTournament: (id: number) =>
    apiFetch<{ message: string }>(`/tournaments/${id}/leave/`, { method: 'POST' }),
};
