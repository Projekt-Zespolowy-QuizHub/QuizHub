# QuizHub — Pełny Plan Implementacji

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zaimplementować brakujące funkcjonalności QuizHub (auth, redesign UI wg Figmy, znajomi, rankingi, historia, gry publiczne, streak) na bazie istniejącego MVP.

**Architecture:** Django REST + Django Channels (backend) ↔ Next.js 14 (frontend). Auth oparty o sesje Django + token (DRF TokenAuthentication). WebSocket z AuthMiddlewareStack. Frontend przebudowany wg screenów z Figmy — gradient fioletowo-niebieski, żółte przyciski, karty z przezroczystym tłem.

**Tech Stack:** Django 5, DRF, Django Channels, Redis, Google Gemini 2.5 Flash, Next.js 14, React 18, TailwindCSS, TypeScript

---

## Stan obecny vs wymagania

### Backend — zaimplementowane ✅
- Modele: Room, Player, Question, Answer, UserProfile
- REST API: create room, join room, room detail, room history
- WebSocket: join, start_game, answer, game_over
- Game logic: punkty za poprawność + szybkość
- AI generator: Gemini 2.5 Flash z fallbackiem

### Backend — brakuje ❌
1. System autentykacji (register, login, logout, me)
2. Powiązanie UserProfile z grami (aktualizacja statystyk)
3. System znajomych (model, API)
4. Rankingi (globalny, tygodniowy, znajomych)
5. Historia gier per użytkownik
6. Streak system (mnożnik punktów)
7. Gry publiczne (cykliczne, automatyczne)

### Frontend — zaimplementowane ✅
- Home page (create/join — stary design)
- Lobby, Game, Results (stary design)
- WebSocket hook, API client

### Frontend — brakuje ❌
- Cały UI do przebudowy wg Figmy
- Nowe strony: Landing, Login, Register, Dashboard, Profile, Friends, History, Ranking, Public Game
- Nawigacja z auth (navbar z linkami zależnymi od stanu zalogowania)

---

## Chunk 1: System Autentykacji (Backend)

### Task 1: Endpointy auth — register, login, logout, me

**Files:**
- Create: `backend/apps/accounts/serializers.py`
- Create: `backend/apps/accounts/views.py`
- Create: `backend/apps/accounts/urls.py`
- Modify: `backend/quizarena/urls.py`
- Modify: `backend/quizarena/settings.py`
- Test: `backend/tests/test_auth.py` (już istnieje — zaktualizować)

- [ ] **Step 1: Zaktualizuj settings.py — dodaj TokenAuthentication**

W `backend/quizarena/settings.py` dodaj:
```python
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
}

INSTALLED_APPS = [
    # ... existing ...
    'rest_framework.authtoken',
]
```

- [ ] **Step 2: Utwórz serializers.py w accounts**

```python
# backend/apps/accounts/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6, write_only=True)
    display_name = serializers.CharField(max_length=30)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def validate_display_name(self, value):
        if UserProfile.objects.filter(display_name=value).exists():
            raise serializers.ValidationError("Display name already taken.")
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class UserProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = UserProfile
        fields = ['id', 'display_name', 'email', 'total_score', 'games_played', 'created_at']
```

- [ ] **Step 3: Utwórz views.py w accounts**

```python
# backend/apps/accounts/views.py
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .serializers import RegisterSerializer, LoginSerializer, UserProfileSerializer
from .models import UserProfile


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.create_user(
            username=serializer.validated_data['email'],
            email=serializer.validated_data['email'],
            password=serializer.validated_data['password'],
        )
        UserProfile.objects.create(
            user=user,
            display_name=serializer.validated_data['display_name'],
        )
        token = Token.objects.create(user=user)
        return Response({'token': token.key}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            username=serializer.validated_data['email'],
            password=serializer.validated_data['password'],
        )
        if not user:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.auth_token.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.userprofile
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data)
```

- [ ] **Step 4: Utwórz urls.py w accounts i podłącz do root urls**

```python
# backend/apps/accounts/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view()),
    path('login/', views.LoginView.as_view()),
    path('logout/', views.LogoutView.as_view()),
    path('me/', views.MeView.as_view()),
]
```

W `backend/quizarena/urls.py` dodaj:
```python
path('api/auth/', include('apps.accounts.urls')),
```

- [ ] **Step 5: Migracja dla authtoken**

```bash
cd backend && python manage.py migrate
```

- [ ] **Step 6: Uruchom testy auth**

```bash
cd backend && pytest tests/test_auth.py -v
```
Sprawdź czy przechodzą. Jeśli test_auth.py wymaga zmian — dostosuj do nowego API.

- [ ] **Step 7: Commit**

```bash
git add backend/apps/accounts/ backend/quizarena/urls.py backend/quizarena/settings.py
git commit -m "feat: add auth endpoints (register, login, logout, me)"
```

---

### Task 2: Powiązanie Player z User (opcjonalne dla zalogowanych)

**Files:**
- Modify: `backend/apps/rooms/models.py`
- Modify: `backend/apps/rooms/views.py`
- Modify: `backend/apps/rooms/consumers.py`

- [ ] **Step 1: Dodaj pole user do modelu Player**

W `backend/apps/rooms/models.py`, w modelu Player dodaj:
```python
user = models.ForeignKey(
    'auth.User', on_delete=models.SET_NULL, null=True, blank=True
)
```

- [ ] **Step 2: Migracja**

```bash
cd backend && python manage.py makemigrations rooms && python manage.py migrate
```

- [ ] **Step 3: Zaktualizuj views — przypisuj user do Player jeśli zalogowany**

W `CreateRoomView` i `JoinRoomView`, przy tworzeniu Player:
```python
player = Player.objects.create(
    room=room,
    nickname=nickname,
    is_host=True,  # or False for join
    user=request.user if request.user.is_authenticated else None,
)
```

- [ ] **Step 4: Aktualizuj UserProfile po zakończeniu gry**

W `consumers.py`, w sekcji `game_over`, po wysłaniu leaderboardu:
```python
# Update user profiles
for player in players:
    if player.user_id:
        profile = player.user.userprofile
        profile.games_played += 1
        profile.total_score += player.score
        profile.save(update_fields=['games_played', 'total_score'])
```

- [ ] **Step 5: Commit**

```bash
git add backend/apps/rooms/
git commit -m "feat: link Player to User, update UserProfile stats after game"
```

---

## Chunk 2: Streak System & Ulepszenia Punktacji

### Task 3: System streaków

**Files:**
- Modify: `backend/apps/game/logic.py`
- Modify: `backend/apps/rooms/models.py`
- Modify: `backend/apps/rooms/consumers.py`
- Test: `backend/tests/test_scoring.py`

- [ ] **Step 1: Napisz testy dla streak systemu**

```python
# backend/tests/test_scoring.py
from apps.game.logic import calculate_points

def test_base_points_correct_answer():
    points = calculate_points(True, 15000, streak=0)
    assert points == 1000 + 250  # base + speed bonus

def test_streak_multiplier():
    points_streak_0 = calculate_points(True, 15000, streak=0)
    points_streak_3 = calculate_points(True, 15000, streak=3)
    assert points_streak_3 > points_streak_0

def test_wrong_answer_zero_points():
    assert calculate_points(False, 5000, streak=5) == 0

def test_streak_multiplier_caps():
    # streak multiplier max 2.0x at streak=5+
    p5 = calculate_points(True, 15000, streak=5)
    p10 = calculate_points(True, 15000, streak=10)
    assert p5 == p10
```

- [ ] **Step 2: Uruchom testy — powinny FAIL**

```bash
cd backend && pytest tests/test_scoring.py -v
```

- [ ] **Step 3: Zaktualizuj calculate_points w logic.py**

```python
# backend/apps/game/logic.py
BASE_POINTS = 1000
MAX_SPEED_BONUS = 500
TIME_LIMIT_MS = 30_000

STREAK_MULTIPLIERS = {
    0: 1.0,
    1: 1.0,
    2: 1.2,
    3: 1.4,
    4: 1.6,
    5: 2.0,  # max
}

def get_streak_multiplier(streak: int) -> float:
    return STREAK_MULTIPLIERS.get(min(streak, 5), 1.0)

def calculate_points(is_correct: bool, response_time_ms: int, streak: int = 0) -> int:
    if not is_correct:
        return 0
    clamped = min(response_time_ms, TIME_LIMIT_MS)
    speed_bonus = round(MAX_SPEED_BONUS * (1 - clamped / TIME_LIMIT_MS))
    base = BASE_POINTS + speed_bonus
    multiplier = get_streak_multiplier(streak)
    return round(base * multiplier)
```

- [ ] **Step 4: Uruchom testy — powinny PASS**

```bash
cd backend && pytest tests/test_scoring.py -v
```

- [ ] **Step 5: Dodaj streak tracking do Player**

W `backend/apps/rooms/models.py`, w Player:
```python
current_streak = models.IntegerField(default=0)
best_streak = models.IntegerField(default=0)
```

Migracja:
```bash
cd backend && python manage.py makemigrations rooms && python manage.py migrate
```

- [ ] **Step 6: Zaktualizuj consumer — tracking streak**

W `consumers.py`, w obsłudze odpowiedzi `answer`:
```python
player = await database_sync_to_async(Player.objects.get)(
    room=room, nickname=nickname
)

# Calculate with streak
points = calculate_points(is_correct, response_time_ms, player.current_streak)

# Update streak
if is_correct:
    player.current_streak += 1
    player.best_streak = max(player.best_streak, player.current_streak)
else:
    player.current_streak = 0

player.score += points
await database_sync_to_async(player.save)()
```

Dodaj streak info do `answer_result`:
```python
await self.send(text_data=json.dumps({
    'type': 'answer_result',
    'is_correct': is_correct,
    'correct_answer': question.correct_answer,
    'explanation': question.explanation,
    'points_earned': points,
    'total_score': player.score,
    'streak': player.current_streak,
}))
```

- [ ] **Step 7: Commit**

```bash
git add backend/apps/game/ backend/apps/rooms/ backend/tests/test_scoring.py
git commit -m "feat: add streak multiplier system to scoring"
```

---

## Chunk 3: System Znajomych (Backend)

### Task 4: Model i API znajomych

**Files:**
- Create: `backend/apps/accounts/models.py` (dodaj Friendship)
- Create: `backend/apps/accounts/views.py` (dodaj endpointy znajomych)
- Modify: `backend/apps/accounts/serializers.py`
- Modify: `backend/apps/accounts/urls.py`
- Test: `backend/tests/test_friends.py`

- [ ] **Step 1: Dodaj model Friendship**

W `backend/apps/accounts/models.py`:
```python
class Friendship(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending'
        ACCEPTED = 'accepted'

    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_requests')
    to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_requests')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('from_user', 'to_user')
```

- [ ] **Step 2: Migracja**

```bash
cd backend && python manage.py makemigrations accounts && python manage.py migrate
```

- [ ] **Step 3: Serializers dla znajomych**

```python
# dodaj do backend/apps/accounts/serializers.py

class FriendshipSerializer(serializers.ModelSerializer):
    from_user_display = serializers.CharField(source='from_user.userprofile.display_name', read_only=True)
    to_user_display = serializers.CharField(source='to_user.userprofile.display_name', read_only=True)

    class Meta:
        model = Friendship
        fields = ['id', 'from_user_display', 'to_user_display', 'status', 'created_at']


class SearchUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['id', 'display_name']
```

- [ ] **Step 4: Views dla znajomych**

```python
# dodaj do backend/apps/accounts/views.py

class SearchUsersView(APIView):
    """GET /api/auth/users/search/?q=nick"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '')
        if len(query) < 2:
            return Response([])
        profiles = UserProfile.objects.filter(
            display_name__icontains=query
        ).exclude(user=request.user)[:10]
        return Response(SearchUserSerializer(profiles, many=True).data)


class FriendsListView(APIView):
    """GET /api/auth/friends/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        friendships = Friendship.objects.filter(
            (models.Q(from_user=request.user) | models.Q(to_user=request.user)),
            status=Friendship.Status.ACCEPTED,
        )
        friends = []
        for f in friendships:
            friend_user = f.to_user if f.from_user == request.user else f.from_user
            profile = friend_user.userprofile
            friends.append({
                'id': profile.id,
                'display_name': profile.display_name,
                'total_score': profile.total_score,
            })
        return Response(friends)


class SendFriendRequestView(APIView):
    """POST /api/auth/friends/request/ {user_id}"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            target_profile = UserProfile.objects.get(id=request.data.get('user_id'))
        except UserProfile.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)
        target_user = target_profile.user
        if target_user == request.user:
            return Response({'error': 'Cannot add yourself'}, status=400)
        if Friendship.objects.filter(
            models.Q(from_user=request.user, to_user=target_user) |
            models.Q(from_user=target_user, to_user=request.user)
        ).exists():
            return Response({'error': 'Request already exists'}, status=400)
        Friendship.objects.create(from_user=request.user, to_user=target_user)
        return Response({'message': 'Request sent'}, status=201)


class PendingRequestsView(APIView):
    """GET /api/auth/friends/pending/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pending = Friendship.objects.filter(
            to_user=request.user, status=Friendship.Status.PENDING
        )
        return Response(FriendshipSerializer(pending, many=True).data)


class RespondFriendRequestView(APIView):
    """POST /api/auth/friends/respond/ {request_id, action: accept|reject}"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            friendship = Friendship.objects.get(
                id=request.data.get('request_id'),
                to_user=request.user,
                status=Friendship.Status.PENDING,
            )
        except Friendship.DoesNotExist:
            return Response({'error': 'Request not found'}, status=404)
        action = request.data.get('action')
        if action == 'accept':
            friendship.status = Friendship.Status.ACCEPTED
            friendship.save()
            return Response({'message': 'Accepted'})
        else:
            friendship.delete()
            return Response({'message': 'Rejected'})
```

- [ ] **Step 5: URLs dla znajomych**

W `backend/apps/accounts/urls.py` dodaj:
```python
path('users/search/', views.SearchUsersView.as_view()),
path('friends/', views.FriendsListView.as_view()),
path('friends/request/', views.SendFriendRequestView.as_view()),
path('friends/pending/', views.PendingRequestsView.as_view()),
path('friends/respond/', views.RespondFriendRequestView.as_view()),
```

- [ ] **Step 6: Napisz testy**

```python
# backend/tests/test_friends.py
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.accounts.models import UserProfile, Friendship

@pytest.fixture
def user_a(db):
    user = User.objects.create_user('a@test.com', 'a@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='UserA')
    return user

@pytest.fixture
def user_b(db):
    user = User.objects.create_user('b@test.com', 'b@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='UserB')
    return user

def test_send_friend_request(user_a, user_b):
    client = APIClient()
    client.force_authenticate(user=user_a)
    profile_b = user_b.userprofile
    resp = client.post('/api/auth/friends/request/', {'user_id': profile_b.id})
    assert resp.status_code == 201
    assert Friendship.objects.filter(from_user=user_a, to_user=user_b).exists()

def test_accept_friend_request(user_a, user_b):
    Friendship.objects.create(from_user=user_a, to_user=user_b)
    client = APIClient()
    client.force_authenticate(user=user_b)
    fr = Friendship.objects.first()
    resp = client.post('/api/auth/friends/respond/', {'request_id': fr.id, 'action': 'accept'})
    assert resp.status_code == 200
    fr.refresh_from_db()
    assert fr.status == 'accepted'

def test_friends_list(user_a, user_b):
    Friendship.objects.create(from_user=user_a, to_user=user_b, status='accepted')
    client = APIClient()
    client.force_authenticate(user=user_a)
    resp = client.get('/api/auth/friends/')
    assert resp.status_code == 200
    assert len(resp.data) == 1
    assert resp.data[0]['display_name'] == 'UserB'
```

- [ ] **Step 7: Uruchom testy**

```bash
cd backend && pytest tests/test_friends.py -v
```

- [ ] **Step 8: Commit**

```bash
git add backend/apps/accounts/ backend/tests/test_friends.py
git commit -m "feat: add friends system (request, accept, reject, list, search)"
```

---

## Chunk 4: Rankingi i Historia (Backend)

### Task 5: Endpointy rankingów

**Files:**
- Create: `backend/apps/accounts/views.py` (dodaj ranking views)
- Modify: `backend/apps/accounts/urls.py`
- Modify: `backend/apps/accounts/models.py` (weekly score)

- [ ] **Step 1: Dodaj pole weekly_score do UserProfile**

```python
# w models.py UserProfile
weekly_score = models.IntegerField(default=0)
```

Migracja:
```bash
cd backend && python manage.py makemigrations accounts && python manage.py migrate
```

- [ ] **Step 2: Views rankingów**

```python
# dodaj do backend/apps/accounts/views.py

class GlobalRankingView(APIView):
    """GET /api/rankings/global/"""
    permission_classes = [AllowAny]

    def get(self, request):
        profiles = UserProfile.objects.order_by('-total_score')[:50]
        data = [
            {'rank': i+1, 'display_name': p.display_name, 'total_score': p.total_score}
            for i, p in enumerate(profiles)
        ]
        return Response(data)


class WeeklyRankingView(APIView):
    """GET /api/rankings/weekly/"""
    permission_classes = [AllowAny]

    def get(self, request):
        profiles = UserProfile.objects.order_by('-weekly_score')[:50]
        data = [
            {'rank': i+1, 'display_name': p.display_name, 'score': p.weekly_score}
            for i, p in enumerate(profiles)
        ]
        return Response(data)


class FriendsRankingView(APIView):
    """GET /api/rankings/friends/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        friend_ids = Friendship.objects.filter(
            (models.Q(from_user=request.user) | models.Q(to_user=request.user)),
            status=Friendship.Status.ACCEPTED,
        ).values_list('from_user', 'to_user')
        user_ids = set()
        for f, t in friend_ids:
            user_ids.add(f)
            user_ids.add(t)
        user_ids.add(request.user.id)
        profiles = UserProfile.objects.filter(user_id__in=user_ids).order_by('-total_score')
        data = [
            {'rank': i+1, 'display_name': p.display_name, 'total_score': p.total_score}
            for i, p in enumerate(profiles)
        ]
        return Response(data)
```

- [ ] **Step 3: URLs rankingów**

Nowy plik lub w root urls:
```python
# backend/quizarena/urls.py — dodaj
path('api/rankings/global/', accounts_views.GlobalRankingView.as_view()),
path('api/rankings/weekly/', accounts_views.WeeklyRankingView.as_view()),
path('api/rankings/friends/', accounts_views.FriendsRankingView.as_view()),
```

- [ ] **Step 4: Zaktualizuj consumer — dodaj weekly_score**

W `consumers.py`, przy aktualizacji UserProfile po game_over:
```python
profile.weekly_score += player.score
```

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add ranking endpoints (global, weekly, friends)"
```

---

### Task 6: Historia gier per użytkownik

**Files:**
- Modify: `backend/apps/accounts/views.py`
- Modify: `backend/apps/accounts/urls.py`

- [ ] **Step 1: View historii gier użytkownika**

```python
# dodaj do backend/apps/accounts/views.py

class UserGameHistoryView(APIView):
    """GET /api/auth/history/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.rooms.models import Player, Room
        players = Player.objects.filter(user=request.user).select_related('room').order_by('-room__created_at')
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
```

- [ ] **Step 2: View statystyk użytkownika**

```python
class UserStatsView(APIView):
    """GET /api/auth/stats/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.rooms.models import Player, Answer
        profile = request.user.userprofile
        players = Player.objects.filter(user=request.user)
        answers = Answer.objects.filter(player__in=players)
        total_answers = answers.count()
        correct_answers = answers.filter(is_correct=True).count()
        avg_time = answers.aggregate(avg=models.Avg('response_time_ms'))['avg']
        best_streak = players.aggregate(best=models.Max('best_streak'))['best'] or 0

        return Response({
            'display_name': profile.display_name,
            'games_played': profile.games_played,
            'total_score': profile.total_score,
            'correct_percentage': round(correct_answers / total_answers * 100, 1) if total_answers else 0,
            'avg_response_time_ms': round(avg_time) if avg_time else 0,
            'best_streak': best_streak,
        })
```

- [ ] **Step 3: URLs**

W `backend/apps/accounts/urls.py`:
```python
path('history/', views.UserGameHistoryView.as_view()),
path('stats/', views.UserStatsView.as_view()),
```

- [ ] **Step 4: Commit**

```bash
git add backend/apps/accounts/
git commit -m "feat: add user game history and stats endpoints"
```

---

## Chunk 5: Gry Publiczne (Backend)

### Task 7: System gier publicznych

**Files:**
- Modify: `backend/apps/rooms/models.py` (dodaj is_public, scheduled_at)
- Create: `backend/apps/rooms/management/commands/create_public_game.py`
- Modify: `backend/apps/rooms/views.py` (endpoint do listowania/dołączania)
- Modify: `backend/apps/rooms/urls.py`

- [ ] **Step 1: Rozszerz model Room**

```python
# dodaj do Room model
is_public = models.BooleanField(default=False)
scheduled_at = models.DateTimeField(null=True, blank=True)
```

Migracja:
```bash
cd backend && python manage.py makemigrations rooms && python manage.py migrate
```

- [ ] **Step 2: Management command do tworzenia gier publicznych**

```python
# backend/apps/rooms/management/commands/create_public_game.py
import random
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.rooms.models import Room

CATEGORIES = ['Historia', 'Nauka', 'Geografia', 'Film', 'Gaming', 'Muzyka', 'Sport', 'Technologia']

class Command(BaseCommand):
    def handle(self, *args, **options):
        scheduled = timezone.now() + timedelta(minutes=5)
        categories = random.sample(CATEGORIES, 3)
        room = Room.objects.create(
            categories=categories,
            is_public=True,
            scheduled_at=scheduled,
            total_rounds=10,
        )
        self.stdout.write(f'Created public game {room.code} at {scheduled}')
```

- [ ] **Step 3: Endpoint — następna gra publiczna**

```python
# dodaj do backend/apps/rooms/views.py

class NextPublicGameView(APIView):
    """GET /api/rooms/public/next/"""
    def get(self, request):
        from django.utils import timezone
        game = Room.objects.filter(
            is_public=True,
            status=Room.Status.LOBBY,
            scheduled_at__gt=timezone.now(),
        ).order_by('scheduled_at').first()
        if not game:
            return Response({'message': 'No upcoming public game'}, status=404)
        return Response({
            'code': game.code,
            'categories': game.categories,
            'scheduled_at': game.scheduled_at.isoformat(),
            'player_count': game.players.count(),
        })
```

- [ ] **Step 4: URL**

```python
# w backend/apps/rooms/urls.py
path('public/next/', views.NextPublicGameView.as_view()),
```

- [ ] **Step 5: Zaktualizuj consumer — auto-start gry publicznej**

W `consumers.py`, dodaj logikę: jeśli `room.is_public` i `timezone.now() >= room.scheduled_at`, automatycznie wystartuj grę (nie wymagaj host start_game).

- [ ] **Step 6: Commit**

```bash
git add backend/apps/rooms/
git commit -m "feat: add public game system with scheduled games"
```

---

## Chunk 6: Frontend — Redesign wg Figmy

### Wspólny design system (z Figmy)

- **Tło:** gradient `bg-gradient-to-br from-purple-700 via-purple-600 to-blue-500`
- **Karty:** `bg-white/10 backdrop-blur-sm rounded-xl`
- **Przyciski główne:** `bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-300`
- **Navbar:** przezroczysty, logo "QuizHub" po lewej (żółty), linki po prawej (białe)
- **Avatary:** żółte kółka z inicjałem
- **Tabele:** przezroczyste tło, białe teksty

### Task 8: Layout i nawigacja

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Create: `frontend/src/components/Navbar.tsx`
- Create: `frontend/src/lib/auth.tsx` (auth context)
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Auth context**

```typescript
// frontend/src/lib/auth.tsx
'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';

interface User {
  id: number;
  display_name: string;
  email: string;
  total_score: number;
  games_played: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('token');
    if (saved) {
      setToken(saved);
      fetchUser(saved);
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchUser(t: string) {
    try {
      const res = await fetch(`${api.baseUrl}/api/auth/me/`, {
        headers: { Authorization: `Token ${t}` },
      });
      if (res.ok) {
        setUser(await res.json());
        setToken(t);
      } else {
        localStorage.removeItem('token');
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${api.baseUrl}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    const data = await res.json();
    localStorage.setItem('token', data.token);
    setToken(data.token);
    await fetchUser(data.token);
  }

  async function register(email: string, password: string, displayName: string) {
    const res = await fetch(`${api.baseUrl}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(JSON.stringify(err));
    }
    const data = await res.json();
    localStorage.setItem('token', data.token);
    setToken(data.token);
    await fetchUser(data.token);
  }

  function logout() {
    if (token) {
      fetch(`${api.baseUrl}/api/auth/logout/`, {
        method: 'POST',
        headers: { Authorization: `Token ${token}` },
      });
    }
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
```

- [ ] **Step 2: Navbar component**

```typescript
// frontend/src/components/Navbar.tsx
'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="flex items-center justify-between px-8 py-4">
      <Link href="/" className="text-yellow-400 font-bold text-xl">QuizHub</Link>
      <div className="flex gap-6 text-white text-sm">
        {user ? (
          <>
            <Link href="/dashboard" className="hover:text-yellow-400">Dashboard</Link>
            <Link href="/profile" className="hover:text-yellow-400">Profil</Link>
            <Link href="/friends" className="hover:text-yellow-400">Znajomi</Link>
            <Link href="/ranking" className="hover:text-yellow-400">Ranking</Link>
            <Link href="/history" className="hover:text-yellow-400">Historia</Link>
            <button onClick={logout} className="hover:text-yellow-400">Wyloguj</button>
          </>
        ) : (
          <>
            <Link href="/login" className="hover:text-yellow-400">Logowanie</Link>
            <Link href="/register" className="hover:text-yellow-400">Rejestracja</Link>
          </>
        )}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Zaktualizuj layout.tsx**

```typescript
// frontend/src/app/layout.tsx
import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata = { title: 'QuizHub', description: 'Quiz Multiplayer' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className={`${inter.className} min-h-screen bg-gradient-to-br from-purple-700 via-purple-600 to-blue-500`}>
        <AuthProvider>
          <Navbar />
          <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: add auth context, navbar, and layout redesign"
```

---

### Task 9: Landing page

**Files:**
- Modify: `frontend/src/app/page.tsx`

Wg Figmy: tytuł "Quiz Multiplayer", podtytuł, dwa przyciski: "Zagraj teraz" (żółty) i "Dowiedz się więcej" (biały outline).

- [ ] **Step 1: Przepisz page.tsx**

```typescript
// frontend/src/app/page.tsx
'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
      <h1 className="text-5xl font-bold text-white mb-4">Quiz Multiplayer</h1>
      <p className="text-white/70 mb-8">Rywalizuj ze znajomymi w quizach generowanych przez AI</p>
      <div className="flex gap-4">
        <Link
          href={user ? '/dashboard' : '/login'}
          className="bg-yellow-400 text-black font-bold px-8 py-3 rounded-lg hover:bg-yellow-300 transition"
        >
          Zagraj teraz
        </Link>
        <a href="#about" className="border border-white text-white px-8 py-3 rounded-lg hover:bg-white/10 transition">
          Dowiedz się więcej
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: redesign landing page per Figma"
```

---

### Task 10: Login & Register pages

**Files:**
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/app/register/page.tsx`

- [ ] **Step 1: Login page**

Wg Figmy: karta z tytułem "Logowanie", inputy Email i Hasło, żółty przycisk "Zaloguj się", link do rejestracji.

```typescript
// frontend/src/app/login/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch {
      setError('Nieprawidłowy email lub hasło');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center items-center min-h-[70vh]">
      <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-sm rounded-xl p-8 w-full max-w-sm">
        <h2 className="text-2xl font-bold text-yellow-400 mb-6">Logowanie</h2>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <label className="block text-white/70 text-sm mb-1">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          className="w-full bg-white rounded-lg px-4 py-2 text-black mb-4" required />
        <label className="block text-white/70 text-sm mb-1">Hasło</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full bg-white rounded-lg px-4 py-2 text-black mb-6" required />
        <button type="submit" disabled={loading}
          className="bg-yellow-400 text-black font-bold px-6 py-2 rounded-lg hover:bg-yellow-300 w-full disabled:opacity-50">
          Zaloguj się
        </button>
        <p className="text-white/50 text-sm mt-4">
          Nie masz konta? <Link href="/register" className="text-yellow-400 hover:underline">Rejestracja</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Register page**

Wg Figmy: karta "Utwórz konto", inputy: Nick, Email, Hasło, Powtórz hasło, żółty przycisk "Zarejestruj się".

```typescript
// frontend/src/app/register/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== password2) { setError('Hasła nie są identyczne'); return; }
    setLoading(true);
    try {
      await register(email, password, displayName);
      router.push('/dashboard');
    } catch (err: any) {
      setError('Błąd rejestracji — sprawdź dane');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center items-center min-h-[70vh]">
      <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-sm rounded-xl p-8 w-full max-w-sm">
        <h2 className="text-2xl font-bold text-yellow-400 mb-6">Utwórz konto</h2>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <label className="block text-white/70 text-sm mb-1">Nick użytkownika</label>
        <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
          placeholder="Twój nick" className="w-full bg-white rounded-lg px-4 py-2 text-black mb-4" required />
        <label className="block text-white/70 text-sm mb-1">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="twoj@email.com" className="w-full bg-white rounded-lg px-4 py-2 text-black mb-4" required />
        <label className="block text-white/70 text-sm mb-1">Hasło</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Hasło" className="w-full bg-white rounded-lg px-4 py-2 text-black mb-4" required minLength={6} />
        <label className="block text-white/70 text-sm mb-1">Powtórz hasło</label>
        <input type="password" value={password2} onChange={e => setPassword2(e.target.value)}
          placeholder="Powtórz hasło" className="w-full bg-white rounded-lg px-4 py-2 text-black mb-6" required />
        <button type="submit" disabled={loading}
          className="bg-yellow-400 text-black font-bold px-6 py-2 rounded-lg hover:bg-yellow-300 w-full disabled:opacity-50">
          Zarejestruj się
        </button>
        <p className="text-white/50 text-sm mt-4">
          Masz już konto? <Link href="/login" className="text-yellow-400 hover:underline">Zaloguj się</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/login/ frontend/src/app/register/
git commit -m "feat: add login and register pages per Figma"
```

---

### Task 11: Dashboard

**Files:**
- Create: `frontend/src/app/dashboard/page.tsx`

Wg Figmy: tytuł "Dashboard", 3 karty (Utwórz grę, Dołącz do gry, Gra publiczna) z żółtymi przyciskami.

- [ ] **Step 1: Dashboard page**

```typescript
// frontend/src/app/dashboard/page.tsx
'use client';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <h3 className="text-white font-bold text-lg mb-2">🎮 Utwórz grę</h3>
          <p className="text-white/50 text-sm mb-4">Stwórz prywatny pokój i zaproś znajomych</p>
          <Link href="/create" className="inline-block bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg hover:bg-yellow-300 text-sm">
            Start
          </Link>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <h3 className="text-white font-bold text-lg mb-2">🎯 Dołącz do gry</h3>
          <p className="text-white/50 text-sm mb-4">Wpisz kod pokoju</p>
          <Link href="/join" className="inline-block bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg hover:bg-yellow-300 text-sm">
            Dołącz
          </Link>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <h3 className="text-white font-bold text-lg mb-2">🌍 Gra publiczna</h3>
          <p className="text-white/50 text-sm mb-4">Dołącz do cyklicznej gry</p>
          <Link href="/public" className="inline-block bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg hover:bg-yellow-300 text-sm">
            Zagraj
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/dashboard/
git commit -m "feat: add dashboard page per Figma"
```

---

### Task 12: Create game & Join game pages

**Files:**
- Create: `frontend/src/app/create/page.tsx`
- Create: `frontend/src/app/join/page.tsx`

- [ ] **Step 1: Create game page**

Wg Figmy: "Utwórz prywatną grę", input tekstowy na kategorię + przycisk dodaj (+), lista kategorii (max 3), przycisk "Utwórz pokój".

```typescript
// frontend/src/app/create/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function CreateGamePage() {
  const [categoryInput, setCategoryInput] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  function addCategory() {
    const cat = categoryInput.trim();
    if (!cat || categories.length >= 3) return;
    if (categories.includes(cat)) return;
    setCategories([...categories, cat]);
    setCategoryInput('');
  }

  function removeCategory(idx: number) {
    setCategories(categories.filter((_, i) => i !== idx));
  }

  async function handleCreate() {
    if (categories.length === 0) { setError('Dodaj przynajmniej 1 kategorię'); return; }
    setLoading(true);
    try {
      const res = await api.createRoom(user?.display_name || 'Host', categories);
      router.push(`/room/${res.room_code}/lobby`);
    } catch {
      setError('Błąd tworzenia pokoju');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-yellow-400 mb-6 text-center">Utwórz prywatną grę</h1>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <label className="text-white text-sm font-bold block mb-1">Kategorie</label>
          <p className="text-white/50 text-xs mb-3">Dodaj maksymalnie 3 kategorie pytań</p>
          <div className="flex gap-2 mb-4">
            <input type="text" value={categoryInput} onChange={e => setCategoryInput(e.target.value)}
              placeholder="Kategoria..."
              className="flex-1 bg-white/20 rounded-lg px-4 py-2 text-white placeholder-white/40"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCategory())}
              disabled={categories.length >= 3} />
            <button onClick={addCategory} disabled={categories.length >= 3}
              className="bg-yellow-400 text-black font-bold w-10 h-10 rounded-full hover:bg-yellow-300 disabled:opacity-50">+</button>
          </div>
          {categories.map((cat, i) => (
            <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2 mb-2">
              <span className="text-white">{cat}</span>
              <button onClick={() => removeCategory(i)} className="text-red-400 hover:text-red-300">✕</button>
            </div>
          ))}
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <button onClick={handleCreate} disabled={loading}
            className="mt-4 bg-yellow-400 text-black font-bold px-6 py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-50">
            Utwórz pokój
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Join game page**

Wg Figmy: "Dołącz do gry", input na kod pokoju, przycisk "Dołącz".

```typescript
// frontend/src/app/join/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function JoinGamePage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.joinRoom(code.toUpperCase(), user?.display_name || 'Player');
      router.push(`/room/${code.toUpperCase()}/lobby`);
    } catch {
      setError('Nie znaleziono pokoju lub jest pełny');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <form onSubmit={handleJoin} className="bg-white/10 backdrop-blur-sm rounded-xl p-8 w-full max-w-sm">
        <h2 className="text-2xl font-bold text-yellow-400 mb-6">Dołącz do gry</h2>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <input type="text" value={code} onChange={e => setCode(e.target.value)}
          placeholder="Kod pokoju" maxLength={6}
          className="w-full bg-white rounded-lg px-4 py-2 text-black mb-4 uppercase" required />
        <button type="submit" disabled={loading}
          className="bg-yellow-400 text-black font-bold px-6 py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-50">
          Dołącz
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/create/ frontend/src/app/join/
git commit -m "feat: add create game and join game pages per Figma"
```

---

### Task 13: Lobby redesign

**Files:**
- Modify: `frontend/src/app/room/[code]/lobby/page.tsx`

Wg Figmy: "Lobby gry", karta z kodem pokoju, lista graczy z avatarami, przycisk "Start gry" (żółty).

- [ ] **Step 1: Przepisz lobby page wg Figmy**

Kluczowe elementy:
- Sekcja z kodem pokoju (duży, widoczny)
- Lista graczy z żółtymi avatarami (inicjał)
- Przycisk "Start gry" (tylko host)
- Gradient tło, karty bg-white/10

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/room/
git commit -m "feat: redesign lobby page per Figma"
```

---

### Task 14: Game page redesign

**Files:**
- Modify: `frontend/src/app/room/[code]/game/page.tsx`

Wg Figmy: "Pytanie X / Y", treść pytania, 4 kolorowe przyciski odpowiedzi (czerwony, niebieski, zielony, pomarańczowy — styl Kahoot).

- [ ] **Step 1: Przepisz game page wg Figmy**

Kluczowe zmiany:
- 4 odpowiedzi w gridzie 2x2 z różnymi kolorami:
  - A: `bg-red-500`
  - B: `bg-blue-500`
  - C: `bg-green-500`
  - D: `bg-orange-500`
- Streak info widoczny przy odpowiedzi
- Timer bardziej subtelny

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/room/
git commit -m "feat: redesign game page with Kahoot-style colored answers"
```

---

### Task 15: Game results page

**Files:**
- Modify: `frontend/src/app/room/[code]/results/page.tsx`

Wg Figmy: "Twój wynik", duża liczba punktów, miejsce, poprawne odpowiedzi, przycisk "Powrót do dashboard".

- [ ] **Step 1: Przepisz results page wg Figmy**

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/room/
git commit -m "feat: redesign game results page per Figma"
```

---

### Task 16: Profile page

**Files:**
- Create: `frontend/src/app/profile/page.tsx`

Wg Figmy: "Profil", avatar z inicjałem + nick + punkty, sekcja Statystyki (Rozegrane gry, Najlepszy streak, Średni czas odpowiedzi).

- [ ] **Step 1: Profile page**

```typescript
// frontend/src/app/profile/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';

interface Stats {
  display_name: string;
  games_played: number;
  total_score: number;
  correct_percentage: number;
  avg_response_time_ms: number;
  best_streak: number;
}

export default function ProfilePage() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/stats/`, {
      headers: { Authorization: `Token ${token}` },
    })
      .then(r => r.json())
      .then(setStats);
  }, [token]);

  if (!user) return <p className="text-white">Zaloguj się, aby zobaczyć profil.</p>;

  const initial = user.display_name.charAt(0).toUpperCase();

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Profil</h1>
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-black font-bold text-xl">
          {initial}
        </div>
        <div>
          <p className="text-white font-bold text-lg">{user.display_name}</p>
          <p className="text-white/50 text-sm">Punkty: {user.total_score}</p>
        </div>
      </div>
      {stats && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <h3 className="text-white font-bold mb-4">Statystyki</h3>
          <p className="text-white/70">Rozegrane gry: {stats.games_played}</p>
          <p className="text-white/70">Najlepszy streak: {stats.best_streak}</p>
          <p className="text-white/70">Średni czas odpowiedzi: {(stats.avg_response_time_ms / 1000).toFixed(1)}s</p>
          <p className="text-white/70">Poprawne odpowiedzi: {stats.correct_percentage}%</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/profile/
git commit -m "feat: add profile page with stats per Figma"
```

---

### Task 17: Friends page

**Files:**
- Create: `frontend/src/app/friends/page.tsx`

Wg Figmy: "Znajomi", input wyszukiwania + przycisk "Szukaj", lista znajomych z avatarami.

- [ ] **Step 1: Friends page z wyszukiwaniem i listą**

Implementuj:
- Input szukania → `GET /api/auth/users/search/?q=...`
- Wyniki z przyciskiem "Dodaj"
- Lista znajomych → `GET /api/auth/friends/`
- Pending requests → `GET /api/auth/friends/pending/` z przyciskami akceptuj/odrzuć

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/friends/
git commit -m "feat: add friends page with search and friend list per Figma"
```

---

### Task 18: History page

**Files:**
- Create: `frontend/src/app/history/page.tsx`

Wg Figmy: "Historia gier", tabela z kolumnami: Data, Kategoria, Punkty, Miejsce.

- [ ] **Step 1: History page**

```typescript
// frontend/src/app/history/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';

interface GameRecord {
  date: string;
  categories: string[];
  score: number;
  rank: number;
  room_code: string;
}

export default function HistoryPage() {
  const { token } = useAuth();
  const [history, setHistory] = useState<GameRecord[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/history/`, {
      headers: { Authorization: `Token ${token}` },
    })
      .then(r => r.json())
      .then(setHistory);
  }, [token]);

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Historia gier</h1>
      <div className="bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden">
        <table className="w-full text-white">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-white/70 text-sm">Data</th>
              <th className="text-left p-4 text-white/70 text-sm">Kategorie</th>
              <th className="text-left p-4 text-white/70 text-sm">Punkty</th>
              <th className="text-left p-4 text-white/70 text-sm">Miejsce</th>
            </tr>
          </thead>
          <tbody>
            {history.map((g, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-4 text-sm">{new Date(g.date).toLocaleDateString('pl-PL')}</td>
                <td className="p-4 text-sm">{g.categories.join(', ')}</td>
                <td className="p-4 text-sm">{g.score}</td>
                <td className="p-4 text-sm">{g.rank}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length === 0 && <p className="text-white/50 text-center py-8">Brak historii gier</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/history/
git commit -m "feat: add game history page per Figma"
```

---

### Task 19: Ranking page

**Files:**
- Create: `frontend/src/app/ranking/page.tsx`

Wg Figmy: "Ranking globalny", tabela: Miejsce, Gracz, Punkty. Tabs: Globalny, Tygodniowy, Znajomych.

- [ ] **Step 1: Ranking page z tabami**

```typescript
// frontend/src/app/ranking/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';

type Tab = 'global' | 'weekly' | 'friends';

interface RankEntry {
  rank: number;
  display_name: string;
  total_score?: number;
  score?: number;
}

export default function RankingPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('global');
  const [data, setData] = useState<RankEntry[]>([]);

  useEffect(() => {
    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/rankings/${tab}/`;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Token ${token}`;
    fetch(url, { headers }).then(r => r.json()).then(setData).catch(() => setData([]));
  }, [tab, token]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'global', label: 'Globalny' },
    { key: 'weekly', label: 'Tygodniowy' },
    { key: 'friends', label: 'Znajomych' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">Ranking</h1>
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
              tab === t.key ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white hover:bg-white/20'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden">
        <table className="w-full text-white">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-white/70 text-sm">Miejsce</th>
              <th className="text-left p-4 text-white/70 text-sm">Gracz</th>
              <th className="text-left p-4 text-white/70 text-sm">Punkty</th>
            </tr>
          </thead>
          <tbody>
            {data.map(entry => (
              <tr key={entry.rank} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-4 text-sm">{entry.rank}</td>
                <td className="p-4 text-sm">{entry.display_name}</td>
                <td className="p-4 text-sm">{entry.total_score ?? entry.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && <p className="text-white/50 text-center py-8">Brak danych</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/ranking/
git commit -m "feat: add ranking page with tabs per Figma"
```

---

### Task 20: Public game page

**Files:**
- Create: `frontend/src/app/public/page.tsx`

Wg Figmy: "Gra publiczna", tekst "Następna gra rozpocznie się za:", duży countdown timer (MM:SS), przycisk "Dołącz do gry".

- [ ] **Step 1: Public game page z countdown**

```typescript
// frontend/src/app/public/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function PublicGamePage() {
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [timeLeft, setTimeLeft] = useState('--:--');
  const { user, token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/rooms/public/next/`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setScheduledAt(data.scheduled_at);
          setCode(data.code);
        }
      });
  }, []);

  useEffect(() => {
    if (!scheduledAt) return;
    const interval = setInterval(() => {
      const diff = new Date(scheduledAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('00:00'); clearInterval(interval); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [scheduledAt]);

  async function handleJoin() {
    if (!code || !user) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    await fetch(`${baseUrl}/api/rooms/join/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Token ${token}` } : {}) },
      body: JSON.stringify({ room_code: code, nickname: user.display_name }),
    });
    router.push(`/room/${code}/lobby`);
  }

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-10 text-center max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-2">Gra publiczna</h1>
        <p className="text-white/60 text-sm mb-6">Następna gra rozpocznie się za:</p>
        <p className="text-6xl font-bold text-white mb-4 font-mono">{timeLeft}</p>
        <p className="text-white/50 text-sm mb-6">Kategorie zostaną wylosowane automatycznie</p>
        {code ? (
          <button onClick={handleJoin}
            className="bg-yellow-400 text-black font-bold px-8 py-3 rounded-lg hover:bg-yellow-300">
            Dołącz do gry
          </button>
        ) : (
          <p className="text-white/50">Brak zaplanowanych gier publicznych</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/public/
git commit -m "feat: add public game page with countdown per Figma"
```

---

## Chunk 7: Aktualizacja API client i integracja auth

### Task 21: Zaktualizuj api.ts — dodaj auth headers

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Dodaj auth support do api.ts**

Zaktualizuj `apiFetch` żeby przyjmował opcjonalny token i dodawał header `Authorization: Token ...`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add auth token support to API client"
```

---

## Podsumowanie kolejności implementacji

| # | Chunk | Zależności | Estymacja |
|---|-------|-----------|-----------|
| 1 | Auth backend (Task 1-2) | brak | — |
| 2 | Streak system (Task 3) | brak | — |
| 3 | System znajomych backend (Task 4) | Chunk 1 | — |
| 4 | Rankingi + Historia backend (Task 5-6) | Chunk 1, 3 | — |
| 5 | Gry publiczne backend (Task 7) | brak | — |
| 6 | Frontend redesign (Task 8-20) | Chunk 1 (auth) | — |
| 7 | Integracja API client (Task 21) | Chunk 1, 6 | — |

**Niezależne chunki do równoległej pracy:**
- Chunk 1 + Chunk 2 + Chunk 5 (mogą być robione jednocześnie)
- Chunk 3 + Chunk 4 (po Chunk 1)
- Chunk 6 + Chunk 7 (po Chunk 1)
