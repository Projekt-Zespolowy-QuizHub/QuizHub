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

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
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

  // Shop
  getShopItems: () =>
    apiFetch<Array<{
      id: number; name: string; description: string;
      item_type: string; price: number; emoji_icon: string;
      avatar_key: string | null; owned: boolean;
    }>>('/shop/'),
  buyShopItem: (item_id: number) =>
    apiFetch<{ message: string; coins: number }>('/shop/buy/', { method: 'POST', body: JSON.stringify({ item_id }) }),
  getCoins: () =>
    apiFetch<{ coins: number }>('/shop/coins/'),
};
