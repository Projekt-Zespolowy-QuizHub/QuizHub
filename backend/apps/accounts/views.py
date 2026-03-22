from collections import defaultdict
from datetime import timedelta

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.core.cache import cache
from django.db import models
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiParameter, inline_serializer
from rest_framework import serializers as drf_serializers

from .serializers import RegisterSerializer, LoginSerializer, UserProfileSerializer, ClanListSerializer, ClanDetailSerializer, ClanInviteSerializer
from .models import UserProfile, Friendship, Achievement, UserAchievement, Challenge, Season, SeasonResult, Clan, ClanMembership, ClanInvite, DailyChallenge, UserChallengeProgress, ShopItem, UserItem, AVATAR_CHOICES, AVATAR_EMOJI
from .achievements import ensure_achievements_exist
from quizarena.throttles import AuthRateThrottle

CACHE_TTL_RANKING = 5 * 60   # 5 minut
CACHE_TTL_STATS = 2 * 60     # 2 minuty


# ─── Auth ─────────────────────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthRateThrottle]

    @extend_schema(
        summary='Rejestracja nowego użytkownika',
        description='Tworzy konto użytkownika i automatycznie go loguje. Email musi być unikalny, podobnie jak display_name.',
        request=RegisterSerializer,
        responses={
            201: inline_serializer('RegisterResponse', fields={
                'display_name': drf_serializers.CharField(),
                'email': drf_serializers.EmailField(),
            }),
            400: inline_serializer('RegisterError', fields={
                'email': drf_serializers.ListField(child=drf_serializers.CharField(), required=False),
                'display_name': drf_serializers.ListField(child=drf_serializers.CharField(), required=False),
            }),
        },
        tags=['auth'],
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.create_user(
            username=serializer.validated_data['email'],
            email=serializer.validated_data['email'],
            password=serializer.validated_data['password'],
        )
        profile = UserProfile.objects.create(
            user=user,
            display_name=serializer.validated_data['display_name'],
        )
        login(request, user)
        return Response({
            'display_name': profile.display_name,
            'email': user.email,
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthRateThrottle]

    @extend_schema(
        summary='Logowanie użytkownika',
        description='Uwierzytelnia użytkownika i tworzy sesję. Zwraca dane profilu po sukcesie.',
        request=LoginSerializer,
        responses={
            200: inline_serializer('LoginResponse', fields={
                'display_name': drf_serializers.CharField(),
                'email': drf_serializers.EmailField(),
            }),
            401: inline_serializer('LoginError', fields={'error': drf_serializers.CharField()}),
        },
        tags=['auth'],
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            username=serializer.validated_data['email'],
            password=serializer.validated_data['password'],
        )
        if not user:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        login(request, user)
        profile = user.profile
        return Response({'display_name': profile.display_name, 'email': user.email})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Wylogowanie użytkownika',
        description='Kończy sesję zalogowanego użytkownika.',
        request=None,
        responses={200: inline_serializer('LogoutResponse', fields={'message': drf_serializers.CharField()})},
        tags=['auth'],
    )
    def post(self, request):
        logout(request)
        return Response({'message': 'Logged out'})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Dane zalogowanego użytkownika',
        description='Zwraca profil aktualnie zalogowanego użytkownika.',
        responses={200: UserProfileSerializer},
        tags=['auth'],
    )
    def get(self, request):
        profile = request.user.profile
        today = timezone.now().date()
        if profile.last_daily_bonus != today:
            profile.coins += 20
            profile.last_daily_bonus = today
            profile.save(update_fields=['coins', 'last_daily_bonus'])
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data)


# ─── Rankings ─────────────────────────────────────────────────────────

class GlobalRankingView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        summary='Globalny ranking graczy',
        description='Top 50 graczy posortowanych według łącznego wyniku (total_score).',
        responses={200: inline_serializer('GlobalRankingItem', fields={
            'rank': drf_serializers.IntegerField(),
            'display_name': drf_serializers.CharField(),
            'total_score': drf_serializers.IntegerField(),
            'avatar': drf_serializers.CharField(),
        }, many=True)},
        tags=['rankings'],
    )
    def get(self, request):
        data = cache.get('ranking_global')
        if data is None:
            profiles = UserProfile.objects.order_by('-total_score')[:50]
            data = [
                {
                    'rank': i + 1,
                    'display_name': p.display_name,
                    'total_score': p.total_score,
                    'avatar': AVATAR_EMOJI.get(p.avatar, '🦊'),
                }
                for i, p in enumerate(profiles)
            ]
            cache.set('ranking_global', data, CACHE_TTL_RANKING)
        return Response(data)


class WeeklyRankingView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        summary='Tygodniowy ranking graczy',
        description='Top 50 graczy posortowanych według tygodniowego wyniku (weekly_score). Wyniki są resetowane co tydzień.',
        responses={200: inline_serializer('WeeklyRankingItem', fields={
            'rank': drf_serializers.IntegerField(),
            'display_name': drf_serializers.CharField(),
            'score': drf_serializers.IntegerField(),
            'avatar': drf_serializers.CharField(),
        }, many=True)},
        tags=['rankings'],
    )
    def get(self, request):
        data = cache.get('ranking_weekly')
        if data is None:
            profiles = UserProfile.objects.order_by('-weekly_score')[:50]
            data = [
                {
                    'rank': i + 1,
                    'display_name': p.display_name,
                    'score': p.weekly_score,
                    'avatar': AVATAR_EMOJI.get(p.avatar, '🦊'),
                }
                for i, p in enumerate(profiles)
            ]
            cache.set('ranking_weekly', data, CACHE_TTL_RANKING)
        return Response(data)


# ─── Friends ──────────────────────────────────────────────────────────

def _get_accepted_friendships(user):
    """Zwraca queryset zaakceptowanych przyjaźni dla użytkownika."""
    return Friendship.objects.filter(
        models.Q(from_user=user) | models.Q(to_user=user),
        status=Friendship.Status.ACCEPTED,
    )


def _get_friend_user_ids(user) -> set:
    """Zwraca zbiór ID użytkowników będących znajomymi danego użytkownika."""
    friendships = _get_accepted_friendships(user).values_list('from_user', 'to_user')
    ids = set()
    for from_id, to_id in friendships:
        ids.add(from_id)
        ids.add(to_id)
    return ids


class SearchUsersView(APIView):
    """GET /api/auth/users/search/?q=nick"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Wyszukiwanie użytkowników',
        description='Wyszukuje użytkowników po display_name (minimum 2 znaki). Wyklucza aktualnie zalogowanego użytkownika.',
        parameters=[OpenApiParameter('q', str, OpenApiParameter.QUERY, description='Fragment nazwy użytkownika (min. 2 znaki)')],
        responses={200: inline_serializer('UserSearchResult', fields={
            'id': drf_serializers.IntegerField(),
            'display_name': drf_serializers.CharField(),
        }, many=True)},
        tags=['friends'],
    )
    def get(self, request):
        query = request.query_params.get('q', '')
        if len(query) < 2:
            return Response([])
        profiles = UserProfile.objects.filter(
            display_name__icontains=query
        ).exclude(user=request.user)[:10]

        flat_friend_ids: set[int] = set()
        for from_id, to_id in Friendship.objects.filter(
            models.Q(from_user=request.user) | models.Q(to_user=request.user),
            status=Friendship.Status.ACCEPTED,
        ).values_list('from_user_id', 'to_user_id'):
            flat_friend_ids.add(from_id)
            flat_friend_ids.add(to_id)
        flat_friend_ids.discard(request.user.id)

        return Response([
            {
                'id': p.id,
                'display_name': p.display_name,
                'is_friend': p.user_id in flat_friend_ids,
            }
            for p in profiles
        ])


class FriendsListView(APIView):
    """GET /api/auth/friends/"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Lista znajomych',
        description='Zwraca listę zaakceptowanych znajomych zalogowanego użytkownika.',
        responses={200: inline_serializer('FriendItem', fields={
            'id': drf_serializers.IntegerField(),
            'display_name': drf_serializers.CharField(),
            'total_score': drf_serializers.IntegerField(),
        }, many=True)},
        tags=['friends'],
    )
    def get(self, request):
        friendships = _get_accepted_friendships(request.user)
        friends = []
        for f in friendships:
            friend_user = f.to_user if f.from_user == request.user else f.from_user
            profile = friend_user.profile
            friends.append({
                'id': profile.id,
                'display_name': profile.display_name,
                'total_score': profile.total_score,
            })
        return Response(friends)


class SendFriendRequestView(APIView):
    """POST /api/auth/friends/request/ {user_id}"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Wyślij zaproszenie do znajomych',
        description='Wysyła zaproszenie do znajomych do użytkownika o podanym user_id (ID profilu).',
        request=inline_serializer('FriendRequestBody', fields={'user_id': drf_serializers.IntegerField()}),
        responses={
            201: inline_serializer('FriendRequestSent', fields={'message': drf_serializers.CharField()}),
            400: inline_serializer('FriendRequestError', fields={'error': drf_serializers.CharField()}),
            404: inline_serializer('FriendRequestNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['friends'],
    )
    def post(self, request):
        try:
            target_profile = UserProfile.objects.get(id=request.data.get('user_id'))
        except UserProfile.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        target_user = target_profile.user
        if target_user == request.user:
            return Response({'error': 'Cannot add yourself'}, status=status.HTTP_400_BAD_REQUEST)
        if Friendship.objects.filter(
            models.Q(from_user=request.user, to_user=target_user) |
            models.Q(from_user=target_user, to_user=request.user)
        ).exists():
            return Response({'error': 'Request already exists'}, status=status.HTTP_400_BAD_REQUEST)
        Friendship.objects.create(from_user=request.user, to_user=target_user)
        return Response({'message': 'Request sent'}, status=status.HTTP_201_CREATED)


class PendingRequestsView(APIView):
    """GET /api/auth/friends/pending/"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Oczekujące zaproszenia do znajomych',
        description='Zwraca listę oczekujących zaproszeń do znajomych skierowanych do zalogowanego użytkownika.',
        responses={200: inline_serializer('PendingRequest', fields={
            'id': drf_serializers.IntegerField(),
            'from_display_name': drf_serializers.CharField(),
        }, many=True)},
        tags=['friends'],
    )
    def get(self, request):
        pending = Friendship.objects.filter(
            to_user=request.user, status=Friendship.Status.PENDING
        ).select_related('from_user__profile')
        return Response([
            {
                'id': f.id,
                'from_display_name': f.from_user.profile.display_name,
            }
            for f in pending
        ])


class RespondFriendRequestView(APIView):
    """POST /api/auth/friends/respond/ {request_id, action: accept|reject}"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Odpowiedz na zaproszenie do znajomych',
        description='Akceptuje lub odrzuca zaproszenie do znajomych. action: "accept" lub "reject".',
        request=inline_serializer('FriendRespondBody', fields={
            'request_id': drf_serializers.IntegerField(),
            'action': drf_serializers.ChoiceField(choices=['accept', 'reject']),
        }),
        responses={
            200: inline_serializer('FriendRespondResult', fields={'message': drf_serializers.CharField()}),
            404: inline_serializer('FriendRespondNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['friends'],
    )
    def post(self, request):
        try:
            friendship = Friendship.objects.get(
                id=request.data.get('request_id'),
                to_user=request.user,
                status=Friendship.Status.PENDING,
            )
        except Friendship.DoesNotExist:
            return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)
        if request.data.get('action') == 'accept':
            friendship.status = Friendship.Status.ACCEPTED
            friendship.save()
            return Response({'message': 'Accepted'})
        friendship.delete()
        return Response({'message': 'Rejected'})


class FriendsRankingView(APIView):
    """GET /api/rankings/friends/"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Ranking znajomych',
        description='Ranking graczy spośród znajomych zalogowanego użytkownika (włącznie z nim samym), posortowany po total_score.',
        responses={200: inline_serializer('FriendsRankingItem', fields={
            'rank': drf_serializers.IntegerField(),
            'display_name': drf_serializers.CharField(),
            'total_score': drf_serializers.IntegerField(),
            'avatar': drf_serializers.CharField(),
        }, many=True)},
        tags=['rankings'],
    )
    def get(self, request):
        user_ids = _get_friend_user_ids(request.user)
        user_ids.add(request.user.id)
        profiles = UserProfile.objects.filter(user_id__in=user_ids).order_by('-total_score')
        data = [
            {
                'rank': i + 1,
                'display_name': p.display_name,
                'total_score': p.total_score,
                'avatar': AVATAR_EMOJI.get(p.avatar, '🦊'),
            }
            for i, p in enumerate(profiles)
        ]
        return Response(data)


# ─── History & Stats ──────────────────────────────────────────────────

class UserGameHistoryView(APIView):
    """GET /api/auth/history/"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Historia gier użytkownika',
        description='Zwraca ostatnie 50 zakończonych gier zalogowanego użytkownika z wynikami i pozycją w rankingu.',
        responses={200: inline_serializer('GameHistoryItem', fields={
            'date': drf_serializers.DateTimeField(),
            'categories': drf_serializers.ListField(child=drf_serializers.CharField()),
            'score': drf_serializers.IntegerField(),
            'rank': drf_serializers.IntegerField(),
            'room_code': drf_serializers.CharField(),
        }, many=True)},
        tags=['profile'],
    )
    def get(self, request):
        from apps.rooms.models import Player, Room
        players = Player.objects.filter(
            user=request.user
        ).select_related('room').order_by('-room__created_at')
        history = []
        for p in players[:50]:
            room = p.room
            if room.status != Room.Status.FINISHED:
                continue
            rank = Player.objects.filter(room=room, score__gt=p.score).count() + 1
            history.append({
                'date': room.created_at.isoformat(),
                'categories': room.categories,
                'score': p.score,
                'rank': rank,
                'room_code': room.code,
            })
        return Response(history)


# ─── Stats helpers ────────────────────────────────────────────────────

def _compute_answer_stats(all_answers: list) -> tuple[int, int, float]:
    """Zwraca (total, correct, avg_response_time_ms)."""
    total = len(all_answers)
    correct = sum(1 for a in all_answers if a.is_correct)
    avg_time = (sum(a.response_time_ms for a in all_answers) / total) if total else 0.0
    return total, correct, avg_time


def _compute_wins(finished_players: list, room_ids: list) -> int:
    """Oblicza liczbę zwycięstw (gracz miał najwyższy wynik w pokoju)."""
    from apps.rooms.models import Player
    if not room_ids:
        return 0
    room_max: dict = {}
    for row in Player.objects.filter(room_id__in=room_ids).values('room_id', 'score'):
        rid = row['room_id']
        if rid not in room_max or row['score'] > room_max[rid]:
            room_max[rid] = row['score']
    return sum(
        1 for p in finished_players
        if room_max.get(p.room_id, -1) == p.score
    )


def _compute_category_accuracy(finished_players: list, all_answers: list) -> list:
    """Zwraca dokładność odpowiedzi per kategoria, posortowaną wg liczby odpowiedzi."""
    answers_by_player = defaultdict(list)
    for a in all_answers:
        answers_by_player[a.player_id].append(a)

    category_stats = defaultdict(lambda: {'correct': 0, 'total': 0})
    for player in finished_players:
        if not player.room.categories:
            continue
        pas = answers_by_player.get(player.id, [])
        for cat in player.room.categories:
            category_stats[cat]['total'] += len(pas)
            category_stats[cat]['correct'] += sum(1 for a in pas if a.is_correct)

    return sorted(
        [
            {
                'category': cat,
                'accuracy': round(d['correct'] / d['total'] * 100, 1) if d['total'] else 0,
                'total_answers': d['total'],
            }
            for cat, d in category_stats.items()
            if d['total'] > 0
        ],
        key=lambda x: x['total_answers'],
        reverse=True,
    )


def _compute_games_per_day(finished_players: list) -> dict:
    """Zwraca mapę date→liczba_gier dla ostatnich 90 dni."""
    ninety_days_ago = timezone.now() - timedelta(days=90)
    games_per_day: dict = {}
    for p in finished_players:
        if p.room.created_at >= ninety_days_ago:
            date_str = p.room.created_at.strftime('%Y-%m-%d')
            games_per_day[date_str] = games_per_day.get(date_str, 0) + 1
    return games_per_day


def _compute_performance_trend(finished_players: list) -> list:
    """Zwraca wyniki ostatnich 10 gier (od najstarszej)."""
    recent = sorted(finished_players, key=lambda p: p.room.created_at, reverse=True)[:10]
    return [
        {'date': p.room.created_at.strftime('%Y-%m-%d'), 'score': p.score}
        for p in reversed(recent)
    ]


class UserStatsView(APIView):
    """GET /api/profile/stats/"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Statystyki użytkownika',
        description=(
            'Zwraca szczegółowe statystyki zalogowanego użytkownika: liczbę gier, zwycięstwa, '
            'procent poprawnych odpowiedzi, średni czas odpowiedzi, dokładność per kategoria, '
            'aktywność w ostatnich 90 dniach i trend wyników z ostatnich 10 gier.'
        ),
        responses={200: inline_serializer('UserStats', fields={
            'display_name': drf_serializers.CharField(),
            'games_played': drf_serializers.IntegerField(),
            'total_score': drf_serializers.IntegerField(),
            'wins': drf_serializers.IntegerField(),
            'win_rate': drf_serializers.FloatField(),
            'correct_percentage': drf_serializers.FloatField(),
            'avg_response_time_ms': drf_serializers.IntegerField(),
            'best_streak': drf_serializers.IntegerField(),
            'category_accuracy': drf_serializers.ListField(child=drf_serializers.DictField()),
            'games_per_day': drf_serializers.DictField(),
            'performance_trend': drf_serializers.ListField(child=drf_serializers.DictField()),
        })},
        tags=['profile'],
    )
    def get(self, request):
        from apps.rooms.models import Player, Answer, Room

        cache_key = f'user_stats_{request.user.id}'
        data = cache.get(cache_key)
        if data is not None:
            return Response(data)

        profile = request.user.profile

        finished_players = list(
            Player.objects.filter(
                user=request.user,
                room__status=Room.Status.FINISHED,
            ).select_related('room')
        )

        player_ids = [p.id for p in finished_players]
        all_answers = list(Answer.objects.filter(player_id__in=player_ids)) if player_ids else []
        room_ids = list({p.room_id for p in finished_players})

        total_answers, correct_answers, avg_time = _compute_answer_stats(all_answers)
        wins = _compute_wins(finished_players, room_ids)
        best_streak = max((p.best_streak for p in finished_players), default=0)
        games_played = len(finished_players)

        data = {
            'display_name': profile.display_name,
            'games_played': games_played,
            'total_score': profile.total_score,
            'wins': wins,
            'win_rate': round(wins / games_played * 100, 1) if games_played else 0,
            'correct_percentage': round(correct_answers / total_answers * 100, 1) if total_answers else 0,
            'avg_response_time_ms': round(avg_time),
            'best_streak': best_streak,
            'category_accuracy': _compute_category_accuracy(finished_players, all_answers),
            'games_per_day': _compute_games_per_day(finished_players),
            'performance_trend': _compute_performance_trend(finished_players),
        }
        cache.set(cache_key, data, CACHE_TTL_STATS)
        return Response(data)


# ─── Achievements ──────────────────────────────────────────────────────

class AchievementsView(APIView):
    """GET /api/profile/achievements/"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Osiągnięcia użytkownika',
        description='Zwraca listę wszystkich osiągnięć wraz z informacją, które zostały odblokowane przez zalogowanego użytkownika.',
        responses={200: inline_serializer('AchievementItem', fields={
            'condition_type': drf_serializers.CharField(),
            'name': drf_serializers.CharField(),
            'description': drf_serializers.CharField(),
            'icon': drf_serializers.CharField(),
            'unlocked': drf_serializers.BooleanField(),
            'unlocked_at': drf_serializers.DateTimeField(allow_null=True),
        }, many=True)},
        tags=['profile'],
    )
    def get(self, request):
        ensure_achievements_exist()
        all_achievements = Achievement.objects.all().order_by('condition_type')
        unlocked_map = {
            ua.achievement_id: ua.unlocked_at
            for ua in UserAchievement.objects.filter(user=request.user).select_related('achievement')
        }
        result = [
            {
                'condition_type': a.condition_type,
                'name': a.name,
                'description': a.description,
                'icon': a.icon,
                'unlocked': a.id in unlocked_map,
                'unlocked_at': unlocked_map[a.id].isoformat() if a.id in unlocked_map else None,
            }
            for a in all_achievements
        ]
        return Response(result)


# ─── Avatar ────────────────────────────────────────────────────────────

class UpdateAvatarView(APIView):
    """PATCH /api/profile/avatar/"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Zmień avatar użytkownika',
        description='Aktualizuje avatar zalogowanego użytkownika. Dostępne klucze avatarów można sprawdzić w modelu UserProfile.',
        request=inline_serializer('UpdateAvatarBody', fields={'avatar': drf_serializers.CharField()}),
        responses={
            200: inline_serializer('UpdateAvatarResponse', fields={'avatar': drf_serializers.CharField()}),
            400: inline_serializer('UpdateAvatarError', fields={'error': drf_serializers.CharField()}),
        },
        tags=['profile'],
    )
    def patch(self, request):
        avatar = request.data.get('avatar')
        valid_keys = [k for k, _ in AVATAR_CHOICES]
        if avatar not in valid_keys:
            return Response({'error': 'Invalid avatar'}, status=status.HTTP_400_BAD_REQUEST)
        profile = request.user.profile
        profile.avatar = avatar
        profile.save()
        return Response({'avatar': avatar})


# ─── Challenges ────────────────────────────────────────────────────────

class ChallengeFriendView(APIView):
    """POST /api/friends/challenge/ — wyzwij znajomego na 1v1"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Wyzwij znajomego',
        description='Tworzy pokój 1v1 i wysyła powiadomienie WS do znajomego. Znajomy może zaakceptować lub odrzucić wyzwanie.',
        request=inline_serializer('ChallengeBody', fields={
            'friend_profile_id': drf_serializers.IntegerField(),
            'categories': drf_serializers.ListField(child=drf_serializers.CharField()),
            'total_rounds': drf_serializers.IntegerField(required=False),
        }),
        responses={
            201: inline_serializer('ChallengeCreated', fields={
                'challenge_id': drf_serializers.IntegerField(),
                'room_code': drf_serializers.CharField(),
            }),
            400: inline_serializer('ChallengeError', fields={'error': drf_serializers.CharField()}),
            404: inline_serializer('ChallengeNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['friends'],
    )
    def post(self, request):
        from apps.rooms.models import Room, Player
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        try:
            target_profile = UserProfile.objects.select_related('user').get(
                id=request.data.get('friend_profile_id')
            )
        except UserProfile.DoesNotExist:
            return Response({'error': 'Użytkownik nie znaleziony'}, status=status.HTTP_404_NOT_FOUND)

        target_user = target_profile.user
        if target_user == request.user:
            return Response({'error': 'Nie możesz wyzwać siebie'}, status=status.HTTP_400_BAD_REQUEST)

        # Sprawdź czy są znajomymi
        if not Friendship.objects.filter(
            models.Q(from_user=request.user, to_user=target_user) |
            models.Q(from_user=target_user, to_user=request.user),
            status=Friendship.Status.ACCEPTED,
        ).exists():
            return Response({'error': 'To nie jest Twój znajomy'}, status=status.HTTP_400_BAD_REQUEST)

        # Sprawdź czy nie ma już oczekującego wyzwania
        if Challenge.objects.filter(
            from_user=request.user, to_user=target_user, status=Challenge.Status.PENDING
        ).exists():
            return Response({'error': 'Wyzwanie już wysłane'}, status=status.HTTP_400_BAD_REQUEST)

        categories = request.data.get('categories', ['Historia'])
        total_rounds = int(request.data.get('total_rounds', 10))
        total_rounds = max(5, min(20, total_rounds))

        room = Room.objects.create(categories=categories, total_rounds=total_rounds)
        Player.objects.create(
            room=room,
            nickname=request.user.profile.display_name,
            is_host=True,
            user=request.user,
        )

        challenge = Challenge.objects.create(
            from_user=request.user,
            to_user=target_user,
            room=room,
        )

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'user_notifications_{target_user.id}',
            {
                'type': 'challenge_received',
                'challenge_id': challenge.id,
                'room_code': room.code,
                'from_display_name': request.user.profile.display_name,
            },
        )

        return Response({'challenge_id': challenge.id, 'room_code': room.code}, status=status.HTTP_201_CREATED)


class ChallengeRespondView(APIView):
    """POST /api/friends/challenge/respond/ — odpowiedz na wyzwanie"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Odpowiedz na wyzwanie',
        description='Zaakceptuj lub odrzuć wyzwanie 1v1. Akceptacja tworzy gracza w pokoju i zwraca kod pokoju.',
        request=inline_serializer('ChallengeRespondBody', fields={
            'challenge_id': drf_serializers.IntegerField(),
            'action': drf_serializers.ChoiceField(choices=['accept', 'decline']),
        }),
        responses={
            200: inline_serializer('ChallengeRespondResult', fields={
                'room_code': drf_serializers.CharField(required=False),
                'message': drf_serializers.CharField(),
            }),
            404: inline_serializer('ChallengeRespondNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['friends'],
    )
    def post(self, request):
        from apps.rooms.models import Player

        try:
            challenge = Challenge.objects.select_related('room', 'from_user__profile').get(
                id=request.data.get('challenge_id'),
                to_user=request.user,
                status=Challenge.Status.PENDING,
            )
        except Challenge.DoesNotExist:
            return Response({'error': 'Wyzwanie nie znalezione'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')

        if action == 'accept':
            challenge.status = Challenge.Status.ACCEPTED
            challenge.save()
            nickname = request.user.profile.display_name
            Player.objects.get_or_create(
                room=challenge.room,
                nickname=nickname,
                defaults={'user': request.user},
            )
            return Response({'room_code': challenge.room.code, 'message': 'Zaakceptowano'})

        # decline
        challenge.status = Challenge.Status.DECLINED
        challenge.save()
        challenge.room.delete()
        return Response({'message': 'Odrzucono'})


# ─── Seasons ────────────────────────────────────────────────────────────

class CurrentSeasonView(APIView):
    """GET /api/seasons/current/ — aktualny sezon"""
    permission_classes = [AllowAny]

    def get(self, request):
        season = Season.objects.filter(is_active=True).first()
        if not season:
            return Response({'detail': 'Brak aktywnego sezonu'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'id': season.pk,
            'number': season.number,
            'name': season.name,
            'start_date': season.start_date.isoformat(),
            'end_date': season.end_date.isoformat(),
            'is_active': season.is_active,
        })


class SeasonLeaderboardView(APIView):
    """GET /api/seasons/<id>/leaderboard/ — leaderboard sezonu"""
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            season = Season.objects.get(pk=pk)
        except Season.DoesNotExist:
            return Response({'detail': 'Sezon nie istnieje'}, status=status.HTTP_404_NOT_FOUND)

        results = SeasonResult.objects.filter(season=season).select_related('user__profile').order_by('final_rank')
        return Response({
            'season': {'id': season.pk, 'name': season.name, 'number': season.number},
            'leaderboard': [
                {
                    'rank': r.final_rank,
                    'display_name': r.user.profile.display_name,
                    'total_score': r.total_score,
                    'games_played': r.games_played,
                    'wins': r.wins,
                }
                for r in results
            ],
        })


class PastSeasonsView(APIView):
    """GET /api/seasons/ — lista minionych sezonów"""
    permission_classes = [AllowAny]

    def get(self, request):
        seasons = Season.objects.filter(is_active=False).order_by('-number')
        return Response([
            {
                'id': s.pk,
                'number': s.number,
                'name': s.name,
                'start_date': s.start_date.isoformat(),
                'end_date': s.end_date.isoformat(),
            }
            for s in seasons
        ])


class UserSeasonHistoryView(APIView):
    """GET /api/seasons/user/<user_id>/ — historia sezonów użytkownika"""
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        results = SeasonResult.objects.filter(user_id=user_id).select_related('season').order_by('-season__number')
        return Response([
            {
                'season_id': r.season.pk,
                'season_name': r.season.name,
                'season_number': r.season.number,
                'final_rank': r.final_rank,
                'total_score': r.total_score,
                'games_played': r.games_played,
                'wins': r.wins,
            }
            for r in results
        ])


# ─── Clans ──────────────────────────────────────────────────────────────

def _get_user_clan_membership(user):
    """Zwraca ClanMembership użytkownika lub None."""
    return ClanMembership.objects.filter(user=user).select_related('clan').first()


class ClanListView(APIView):
    """GET /api/clans/ — lista klanów; POST — utwórz klan"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Lista klanów',
        description='Zwraca listę wszystkich klanów z liczbą członków, liderem i łącznym wynikiem.',
        responses={200: ClanListSerializer(many=True)},
        tags=['clans'],
    )
    def get(self, request):
        clans = Clan.objects.prefetch_related('memberships__user__profile').all()
        serializer = ClanListSerializer(clans, many=True, context={'request': request})
        data = serializer.data

        # Dodaj rank po posortowaniu po total_score
        sorted_data = sorted(data, key=lambda c: c['total_score'], reverse=True)
        for i, clan in enumerate(sorted_data):
            clan['rank'] = i + 1
        return Response(sorted_data)

    @extend_schema(
        summary='Utwórz klan',
        description='Tworzy nowy klan. Twórca zostaje automatycznie liderem. Użytkownik może należeć tylko do jednego klanu.',
        request=inline_serializer('ClanCreateBody', fields={
            'name': drf_serializers.CharField(),
            'tag': drf_serializers.CharField(),
            'description': drf_serializers.CharField(required=False),
            'avatar': drf_serializers.CharField(required=False),
            'is_open': drf_serializers.BooleanField(required=False),
            'max_members': drf_serializers.IntegerField(required=False),
        }),
        responses={
            201: ClanListSerializer,
            400: inline_serializer('ClanCreateError', fields={'error': drf_serializers.CharField()}),
        },
        tags=['clans'],
    )
    def post(self, request):
        if _get_user_clan_membership(request.user):
            return Response({'error': 'Już należysz do klanu'}, status=status.HTTP_400_BAD_REQUEST)

        name = request.data.get('name', '').strip()
        tag = request.data.get('tag', '').strip().upper()

        if not name or len(name) < 3:
            return Response({'error': 'Nazwa klanu musi mieć co najmniej 3 znaki'}, status=status.HTTP_400_BAD_REQUEST)
        if len(tag) < 2 or len(tag) > 5:
            return Response({'error': 'Tag musi mieć 2–5 znaków'}, status=status.HTTP_400_BAD_REQUEST)
        if Clan.objects.filter(name=name).exists():
            return Response({'error': 'Klan o tej nazwie już istnieje'}, status=status.HTTP_400_BAD_REQUEST)
        if Clan.objects.filter(tag=tag).exists():
            return Response({'error': 'Klan z tym tagiem już istnieje'}, status=status.HTTP_400_BAD_REQUEST)

        clan = Clan.objects.create(
            name=name,
            tag=tag,
            description=request.data.get('description', ''),
            avatar=request.data.get('avatar', '🛡️'),
            is_open=request.data.get('is_open', True),
            max_members=request.data.get('max_members', 20),
            created_by=request.user,
        )
        ClanMembership.objects.create(clan=clan, user=request.user, role=ClanMembership.Role.LEADER)

        serializer = ClanListSerializer(clan, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ClanDetailView(APIView):
    """GET /api/clans/<pk>/ — szczegóły klanu z listą członków"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Szczegóły klanu',
        description='Zwraca pełne informacje o klanie wraz z listą członków posortowaną po total_score.',
        responses={
            200: ClanDetailSerializer,
            404: inline_serializer('ClanNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['clans'],
    )
    def get(self, request, pk):
        try:
            clan = Clan.objects.prefetch_related('memberships__user__profile').get(pk=pk)
        except Clan.DoesNotExist:
            return Response({'error': 'Klan nie znaleziony'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ClanDetailSerializer(clan, context={'request': request})
        data = serializer.data

        # Dodaj rank klanu globalnie
        all_totals = [
            sum(m.user.profile.total_score for m in c.memberships.select_related('user__profile').all())
            for c in Clan.objects.prefetch_related('memberships__user__profile').all()
        ]
        clan_total = data['total_score']
        data['rank'] = sum(1 for t in all_totals if t > clan_total) + 1

        # Posortuj członków po total_score
        data['members'] = sorted(data['members'], key=lambda m: m['total_score'], reverse=True)
        return Response(data)


class ClanJoinView(APIView):
    """POST /api/clans/<pk>/join/ — dołącz do otwartego klanu"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Dołącz do klanu',
        description='Dołącza zalogowanego użytkownika do otwartego klanu. Użytkownik może należeć tylko do jednego klanu.',
        responses={
            200: inline_serializer('ClanJoinResult', fields={'message': drf_serializers.CharField()}),
            400: inline_serializer('ClanJoinError', fields={'error': drf_serializers.CharField()}),
            404: inline_serializer('ClanJoinNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['clans'],
    )
    def post(self, request, pk):
        try:
            clan = Clan.objects.prefetch_related('memberships').get(pk=pk)
        except Clan.DoesNotExist:
            return Response({'error': 'Klan nie znaleziony'}, status=status.HTTP_404_NOT_FOUND)

        if _get_user_clan_membership(request.user):
            return Response({'error': 'Już należysz do klanu'}, status=status.HTTP_400_BAD_REQUEST)
        if not clan.is_open:
            return Response({'error': 'Klan jest zamknięty — wymagane zaproszenie'}, status=status.HTTP_400_BAD_REQUEST)
        if clan.memberships.count() >= clan.max_members:
            return Response({'error': 'Klan jest pełny'}, status=status.HTTP_400_BAD_REQUEST)

        ClanMembership.objects.create(clan=clan, user=request.user, role=ClanMembership.Role.MEMBER)
        return Response({'message': f'Dołączyłeś do klanu {clan.name}'})


class ClanLeaveView(APIView):
    """POST /api/clans/<pk>/leave/ — opuść klan"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Opuść klan',
        description='Usuwa zalogowanego użytkownika z klanu. Lider nie może opuścić klanu, jeśli są inni członkowie — musi najpierw przekazać przywództwo lub rozwiązać klan.',
        responses={
            200: inline_serializer('ClanLeaveResult', fields={'message': drf_serializers.CharField()}),
            400: inline_serializer('ClanLeaveError', fields={'error': drf_serializers.CharField()}),
            404: inline_serializer('ClanLeaveNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['clans'],
    )
    def post(self, request, pk):
        try:
            membership = ClanMembership.objects.select_related('clan').get(clan_id=pk, user=request.user)
        except ClanMembership.DoesNotExist:
            return Response({'error': 'Nie należysz do tego klanu'}, status=status.HTTP_404_NOT_FOUND)

        clan = membership.clan
        if membership.role == ClanMembership.Role.LEADER:
            other_members = clan.memberships.exclude(user=request.user)
            if other_members.exists():
                return Response(
                    {'error': 'Jako lider nie możesz opuścić klanu z innymi członkami. Przekaż przywództwo lub wyrzuć wszystkich.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Lider jest jedynym członkiem — rozwiąż klan
            clan.delete()
            return Response({'message': 'Opuściłeś klan i klan został rozwiązany'})

        membership.delete()
        return Response({'message': f'Opuściłeś klan {clan.name}'})


class ClanInviteView(APIView):
    """POST /api/clans/<pk>/invite/ — zaproś użytkownika do klanu"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Zaproś do klanu',
        description='Wysyła zaproszenie do klanu. Dostępne tylko dla lidera i oficerów.',
        request=inline_serializer('ClanInviteBody', fields={'user_id': drf_serializers.IntegerField()}),
        responses={
            201: inline_serializer('ClanInviteSent', fields={'message': drf_serializers.CharField()}),
            400: inline_serializer('ClanInviteError', fields={'error': drf_serializers.CharField()}),
            403: inline_serializer('ClanInviteForbidden', fields={'error': drf_serializers.CharField()}),
            404: inline_serializer('ClanInviteNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['clans'],
    )
    def post(self, request, pk):
        try:
            clan = Clan.objects.prefetch_related('memberships').get(pk=pk)
        except Clan.DoesNotExist:
            return Response({'error': 'Klan nie znaleziony'}, status=status.HTTP_404_NOT_FOUND)

        try:
            my_membership = ClanMembership.objects.get(clan=clan, user=request.user)
        except ClanMembership.DoesNotExist:
            return Response({'error': 'Nie należysz do tego klanu'}, status=status.HTTP_403_FORBIDDEN)

        if my_membership.role == ClanMembership.Role.MEMBER:
            return Response({'error': 'Tylko lider lub oficer może zapraszać'}, status=status.HTTP_403_FORBIDDEN)

        try:
            target_profile = UserProfile.objects.select_related('user').get(id=request.data.get('user_id'))
        except UserProfile.DoesNotExist:
            return Response({'error': 'Użytkownik nie znaleziony'}, status=status.HTTP_404_NOT_FOUND)

        target_user = target_profile.user
        if clan.memberships.filter(user=target_user).exists():
            return Response({'error': 'Użytkownik już należy do klanu'}, status=status.HTTP_400_BAD_REQUEST)
        if ClanMembership.objects.filter(user=target_user).exists():
            return Response({'error': 'Użytkownik należy już do innego klanu'}, status=status.HTTP_400_BAD_REQUEST)
        if ClanInvite.objects.filter(clan=clan, invited_user=target_user, status=ClanInvite.Status.PENDING).exists():
            return Response({'error': 'Zaproszenie już wysłane'}, status=status.HTTP_400_BAD_REQUEST)
        if clan.memberships.count() >= clan.max_members:
            return Response({'error': 'Klan jest pełny'}, status=status.HTTP_400_BAD_REQUEST)

        ClanInvite.objects.create(clan=clan, invited_by=request.user, invited_user=target_user)
        return Response({'message': f'Zaproszenie wysłane do {target_profile.display_name}'}, status=status.HTTP_201_CREATED)


class ClanRespondInviteView(APIView):
    """POST /api/clans/invite/respond/ — akceptuj lub odrzuć zaproszenie"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Odpowiedz na zaproszenie do klanu',
        description='Akceptuje lub odrzuca zaproszenie do klanu. action: "accept" lub "reject".',
        request=inline_serializer('ClanRespondBody', fields={
            'invite_id': drf_serializers.IntegerField(),
            'action': drf_serializers.ChoiceField(choices=['accept', 'reject']),
        }),
        responses={
            200: inline_serializer('ClanRespondResult', fields={'message': drf_serializers.CharField()}),
            400: inline_serializer('ClanRespondError', fields={'error': drf_serializers.CharField()}),
            404: inline_serializer('ClanRespondNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['clans'],
    )
    def post(self, request):
        try:
            invite = ClanInvite.objects.select_related('clan').get(
                id=request.data.get('invite_id'),
                invited_user=request.user,
                status=ClanInvite.Status.PENDING,
            )
        except ClanInvite.DoesNotExist:
            return Response({'error': 'Zaproszenie nie znalezione'}, status=status.HTTP_404_NOT_FOUND)

        if request.data.get('action') == 'accept':
            if _get_user_clan_membership(request.user):
                return Response({'error': 'Już należysz do klanu'}, status=status.HTTP_400_BAD_REQUEST)
            clan = invite.clan
            if clan.memberships.count() >= clan.max_members:
                return Response({'error': 'Klan jest pełny'}, status=status.HTTP_400_BAD_REQUEST)
            invite.status = ClanInvite.Status.ACCEPTED
            invite.save()
            ClanMembership.objects.create(clan=clan, user=request.user, role=ClanMembership.Role.MEMBER)
            return Response({'message': f'Dołączyłeś do klanu {clan.name}'})

        invite.status = ClanInvite.Status.REJECTED
        invite.save()
        return Response({'message': 'Zaproszenie odrzucone'})


class ClanKickView(APIView):
    """POST /api/clans/<pk>/kick/ — wyrzuć członka klanu"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Wyrzuć członka klanu',
        description='Usuwa członka z klanu. Dostępne tylko dla lidera i oficerów. Oficer nie może wyrzucić lidera.',
        request=inline_serializer('ClanKickBody', fields={'user_id': drf_serializers.IntegerField()}),
        responses={
            200: inline_serializer('ClanKickResult', fields={'message': drf_serializers.CharField()}),
            400: inline_serializer('ClanKickError', fields={'error': drf_serializers.CharField()}),
            403: inline_serializer('ClanKickForbidden', fields={'error': drf_serializers.CharField()}),
            404: inline_serializer('ClanKickNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['clans'],
    )
    def post(self, request, pk):
        try:
            clan = Clan.objects.get(pk=pk)
        except Clan.DoesNotExist:
            return Response({'error': 'Klan nie znaleziony'}, status=status.HTTP_404_NOT_FOUND)

        try:
            my_membership = ClanMembership.objects.get(clan=clan, user=request.user)
        except ClanMembership.DoesNotExist:
            return Response({'error': 'Nie należysz do tego klanu'}, status=status.HTTP_403_FORBIDDEN)

        if my_membership.role == ClanMembership.Role.MEMBER:
            return Response({'error': 'Tylko lider lub oficer może wyrzucać członków'}, status=status.HTTP_403_FORBIDDEN)

        target_user_id = request.data.get('user_id')
        try:
            target_profile = UserProfile.objects.select_related('user').get(id=target_user_id)
        except UserProfile.DoesNotExist:
            return Response({'error': 'Użytkownik nie znaleziony'}, status=status.HTTP_404_NOT_FOUND)

        target_user = target_profile.user
        if target_user == request.user:
            return Response({'error': 'Nie możesz wyrzucić siebie — użyj opcji opuszczenia klanu'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_membership = ClanMembership.objects.get(clan=clan, user=target_user)
        except ClanMembership.DoesNotExist:
            return Response({'error': 'Ten użytkownik nie należy do klanu'}, status=status.HTTP_404_NOT_FOUND)

        if target_membership.role == ClanMembership.Role.LEADER:
            return Response({'error': 'Nie można wyrzucić lidera'}, status=status.HTTP_400_BAD_REQUEST)
        if my_membership.role == ClanMembership.Role.OFFICER and target_membership.role == ClanMembership.Role.OFFICER:
            return Response({'error': 'Oficer nie może wyrzucić innego oficera'}, status=status.HTTP_403_FORBIDDEN)

        target_membership.delete()
        return Response({'message': f'Użytkownik {target_profile.display_name} został wyrzucony z klanu'})


class ClanLeaderboardView(APIView):
    """GET /api/clans/leaderboard/ — ranking klanów"""
    permission_classes = [AllowAny]

    @extend_schema(
        summary='Ranking klanów',
        description='Zwraca top 50 klanów posortowanych według sumy total_score wszystkich członków.',
        responses={200: inline_serializer('ClanLeaderboardItem', fields={
            'rank': drf_serializers.IntegerField(),
            'id': drf_serializers.IntegerField(),
            'name': drf_serializers.CharField(),
            'tag': drf_serializers.CharField(),
            'avatar': drf_serializers.CharField(),
            'total_score': drf_serializers.IntegerField(),
            'member_count': drf_serializers.IntegerField(),
            'leader': drf_serializers.CharField(),
        }, many=True)},
        tags=['clans'],
    )
    def get(self, request):
        clans = Clan.objects.prefetch_related('memberships__user__profile').all()

        clan_data = []
        for clan in clans:
            memberships = list(clan.memberships.select_related('user__profile').all())
            total_score = sum(m.user.profile.total_score for m in memberships)
            leader_membership = next((m for m in memberships if m.role == ClanMembership.Role.LEADER), None)
            clan_data.append({
                'id': clan.id,
                'name': clan.name,
                'tag': clan.tag,
                'avatar': clan.avatar,
                'total_score': total_score,
                'member_count': len(memberships),
                'leader': leader_membership.user.profile.display_name if leader_membership else '',
            })

        clan_data.sort(key=lambda c: c['total_score'], reverse=True)
        for i, item in enumerate(clan_data[:50]):
            item['rank'] = i + 1

        return Response(clan_data[:50])


# ─── Daily Challenges ──────────────────────────────────────────────────

class DailyChallengesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import date
        today = date.today()
        challenges = DailyChallenge.objects.filter(date=today)

        progress_map = {
            p.challenge_id: p
            for p in UserChallengeProgress.objects.filter(
                user=request.user,
                challenge__date=today,
            )
        }

        result = []
        for ch in challenges:
            progress = progress_map.get(ch.id)
            result.append({
                'id': ch.id,
                'description': ch.description,
                'challenge_type': ch.challenge_type,
                'target_value': ch.target_value,
                'coin_reward': ch.coin_reward,
                'current_value': progress.current_value if progress else 0,
                'completed': progress.completed if progress else False,
                'reward_claimed': progress.reward_claimed if progress else False,
            })

        return Response(result)


class ClaimChallengeRewardView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        challenge_id = request.data.get('challenge_id')
        if not challenge_id:
            return Response({'error': 'Wymagane pole challenge_id.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            progress = UserChallengeProgress.objects.select_related('challenge').get(
                user=request.user,
                challenge_id=challenge_id,
            )
        except UserChallengeProgress.DoesNotExist:
            return Response({'error': 'Nie znaleziono postępu wyzwania.'}, status=status.HTTP_404_NOT_FOUND)

        if not progress.completed:
            return Response({'error': 'Wyzwanie nie zostało jeszcze ukończone.'}, status=status.HTTP_400_BAD_REQUEST)

        if progress.reward_claimed:
            return Response({'error': 'Nagroda została już odebrana.'}, status=status.HTTP_400_BAD_REQUEST)

        progress.reward_claimed = True
        progress.save()

        profile = request.user.profile
        profile.coins += progress.challenge.coin_reward
        profile.save()

        return Response({
            'coins_awarded': progress.challenge.coin_reward,
            'total_coins': profile.coins,
        })


# ─── Shop ──────────────────────────────────────────────────────────────

class ShopListView(APIView):
    """GET /api/shop/ — lista aktywnych przedmiotów sklepu"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Lista przedmiotów sklepu',
        description='Zwraca wszystkie aktywne przedmioty dostępne w sklepie.',
        responses={200: inline_serializer('ShopItemResponse', fields={
            'id': drf_serializers.IntegerField(),
            'name': drf_serializers.CharField(),
            'description': drf_serializers.CharField(),
            'item_type': drf_serializers.CharField(),
            'price': drf_serializers.IntegerField(),
            'emoji_icon': drf_serializers.CharField(),
        }, many=True)},
        tags=['shop'],
    )
    def get(self, request):
        items = ShopItem.objects.filter(is_active=True).order_by('item_type', 'price')
        owned_ids = set(
            UserItem.objects.filter(user=request.user).values_list('item_id', flat=True)
        )
        return Response([
            {
                'id': item.id,
                'name': item.name,
                'description': item.description,
                'item_type': item.item_type,
                'price': item.price,
                'emoji_icon': item.emoji_icon,
                'owned': item.id in owned_ids,
            }
            for item in items
        ])


class BuyItemView(APIView):
    """POST /api/shop/buy/ — kup przedmiot"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Kup przedmiot',
        description='Odejmuje monety i tworzy UserItem. Zwraca błąd jeśli przedmiot już posiadany lub za mało monet.',
        request=inline_serializer('BuyItemBody', fields={'item_id': drf_serializers.IntegerField()}),
        responses={
            200: inline_serializer('BuyItemResponse', fields={
                'message': drf_serializers.CharField(),
                'coins': drf_serializers.IntegerField(),
            }),
            400: inline_serializer('BuyItemError', fields={'error': drf_serializers.CharField()}),
            404: inline_serializer('BuyItemNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['shop'],
    )
    def post(self, request):
        item_id = request.data.get('item_id')
        try:
            item = ShopItem.objects.get(id=item_id, is_active=True)
        except ShopItem.DoesNotExist:
            return Response({'error': 'Przedmiot nie znaleziony'}, status=status.HTTP_404_NOT_FOUND)

        if UserItem.objects.filter(user=request.user, item=item).exists():
            return Response({'error': 'Posiadasz już ten przedmiot'}, status=status.HTTP_400_BAD_REQUEST)

        profile = request.user.profile
        if profile.coins < item.price:
            return Response({'error': 'Za mało monet'}, status=status.HTTP_400_BAD_REQUEST)

        profile.coins -= item.price
        profile.save(update_fields=['coins'])
        UserItem.objects.create(user=request.user, item=item)

        return Response({'message': f'Zakupiono {item.name}', 'coins': profile.coins})


class EquipItemView(APIView):
    """POST /api/shop/equip/ — załóż/zdejmij przedmiot"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Załóż/zdejmij przedmiot',
        description='Przełącza is_equipped. Tylko jeden przedmiot danego typu może być założony jednocześnie.',
        request=inline_serializer('EquipItemBody', fields={'item_id': drf_serializers.IntegerField()}),
        responses={
            200: inline_serializer('EquipItemResponse', fields={
                'is_equipped': drf_serializers.BooleanField(),
            }),
            404: inline_serializer('EquipItemNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['shop'],
    )
    def post(self, request):
        item_id = request.data.get('item_id')
        try:
            user_item = UserItem.objects.select_related('item').get(
                user=request.user, item_id=item_id
            )
        except UserItem.DoesNotExist:
            return Response({'error': 'Nie posiadasz tego przedmiotu'}, status=status.HTTP_404_NOT_FOUND)

        if not user_item.is_equipped:
            # Zdejmij inne przedmioty tego samego typu
            UserItem.objects.filter(
                user=request.user,
                item__item_type=user_item.item.item_type,
                is_equipped=True,
            ).update(is_equipped=False)
            user_item.is_equipped = True
        else:
            user_item.is_equipped = False

        user_item.save(update_fields=['is_equipped'])
        return Response({'is_equipped': user_item.is_equipped})


class UserInventoryView(APIView):
    """GET /api/shop/inventory/ — przedmioty gracza"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Ekwipunek gracza',
        description='Zwraca wszystkie zakupione przedmioty zalogowanego użytkownika.',
        responses={200: inline_serializer('InventoryItemResponse', fields={
            'id': drf_serializers.IntegerField(),
            'item_id': drf_serializers.IntegerField(),
            'name': drf_serializers.CharField(),
            'description': drf_serializers.CharField(),
            'item_type': drf_serializers.CharField(),
            'emoji_icon': drf_serializers.CharField(),
            'purchased_at': drf_serializers.DateTimeField(),
            'is_equipped': drf_serializers.BooleanField(),
        }, many=True)},
        tags=['shop'],
    )
    def get(self, request):
        user_items = UserItem.objects.filter(user=request.user).select_related('item').order_by('-purchased_at')
        return Response([
            {
                'id': ui.id,
                'item_id': ui.item.id,
                'name': ui.item.name,
                'description': ui.item.description,
                'item_type': ui.item.item_type,
                'emoji_icon': ui.item.emoji_icon,
                'purchased_at': ui.purchased_at.isoformat(),
                'is_equipped': ui.is_equipped,
            }
            for ui in user_items
        ])


class UserCoinsView(APIView):
    """GET /api/shop/coins/ — stan konta monet"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Stan monet gracza',
        description='Zwraca aktualny stan monet zalogowanego użytkownika.',
        responses={200: inline_serializer('CoinsResponse', fields={
            'coins': drf_serializers.IntegerField(),
        })},
        tags=['shop'],
    )
    def get(self, request):
        return Response({'coins': request.user.profile.coins})
