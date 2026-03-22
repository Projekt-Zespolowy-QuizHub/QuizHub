"""
Komenda zarządzania Django: seed_data
Wypełnia bazę danych przykładowymi danymi do demo i developmentu.
Idempotentna — można ją uruchamiać wielokrotnie bez duplikowania rekordów.

Użycie:
    python manage.py seed_data
    python manage.py seed_data --clear   # usuwa dane seed przed ponownym tworzeniem
"""

import random
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.achievements import ACHIEVEMENT_DEFINITIONS
from apps.accounts.models import Achievement, Friendship, UserAchievement, UserProfile
from apps.rooms.models import Answer, Player, Question, Room


# ---------------------------------------------------------------------------
# Dane testowe
# ---------------------------------------------------------------------------

USERS_DATA = [
    {"username": "alice_quiz",   "display_name": "AliceW",    "avatar": "fox",     "password": "testpass123"},
    {"username": "bob_builder",  "display_name": "BobB",      "avatar": "robot",   "password": "testpass123"},
    {"username": "charlie_c",    "display_name": "CharlieC",  "avatar": "wizard",  "password": "testpass123"},
    {"username": "diana_d",      "display_name": "DianaD",    "avatar": "unicorn", "password": "testpass123"},
    {"username": "evan_e",       "display_name": "EvanE",     "avatar": "dragon",  "password": "testpass123"},
]

# Używamy ACHIEVEMENT_DEFINITIONS z achievements.py jako jedynego źródła prawdy
ACHIEVEMENTS_DATA = ACHIEVEMENT_DEFINITIONS

CATEGORIES_POOL = [
    ["Historia", "Nauka"],
    ["Geografia", "Sport"],
    ["Kultura", "Film"],
    ["Muzyka", "Literatura"],
    ["Technologia", "Matematyka"],
    ["Historia", "Geografia"],
    ["Nauka", "Technologia"],
    ["Sport", "Kultura"],
    ["Film", "Muzyka"],
    ["Literatura", "Historia"],
]

# Przykładowe pytania — (treść, opcje, poprawna odpowiedź, wyjaśnienie)
SAMPLE_QUESTIONS = [
    (
        "Który pierwiastek chemiczny ma symbol Au?",
        ["Srebro", "Złoto", "Aluminium", "Żelazo"],
        "B",
        "Au pochodzi od łacińskiego słowa 'aurum' oznaczającego złoto.",
    ),
    (
        "W którym roku człowiek po raz pierwszy wylądował na Księżycu?",
        ["1965", "1967", "1969", "1971"],
        "C",
        "Apollo 11 wylądował na Księżycu 20 lipca 1969 roku.",
    ),
    (
        "Jaka jest stolica Australii?",
        ["Sydney", "Melbourne", "Brisbane", "Canberra"],
        "D",
        "Canberra jest stolicą Australii od 1913 roku.",
    ),
    (
        "Kto napisał 'Pana Tadeusza'?",
        ["Juliusz Słowacki", "Adam Mickiewicz", "Cyprian Norwid", "Zygmunt Krasiński"],
        "B",
        "'Pan Tadeusz' to epopeja narodowa autorstwa Adama Mickiewicza z 1834 roku.",
    ),
    (
        "Ile wynosi pierwiastek kwadratowy z 144?",
        ["11", "12", "13", "14"],
        "B",
        "√144 = 12, ponieważ 12 × 12 = 144.",
    ),
    (
        "Który kraj ma największą powierzchnię na świecie?",
        ["Chiny", "USA", "Kanada", "Rosja"],
        "D",
        "Rosja z powierzchnią ok. 17 mln km² jest największym krajem świata.",
    ),
    (
        "Jaki jest symbol chemiczny wody?",
        ["HO", "H2O", "OH2", "H2O2"],
        "B",
        "Woda to H2O — dwa atomy wodoru i jeden atom tlenu.",
    ),
    (
        "Kto namalował 'Monę Lisę'?",
        ["Michał Anioł", "Rafael", "Leonardo da Vinci", "Tycjan"],
        "C",
        "Mona Lisa została namalowana przez Leonarda da Vinci ok. 1503–1519.",
    ),
    (
        "Ile kości ma dorosły człowiek?",
        ["196", "206", "216", "226"],
        "B",
        "Dorosły człowiek ma 206 kości. Noworodki mają ich więcej (ok. 270).",
    ),
    (
        "Która planeta jest największa w Układzie Słonecznym?",
        ["Saturn", "Neptun", "Uran", "Jowisz"],
        "D",
        "Jowisz jest największą planetą — jego masa to ponad 2× masa wszystkich pozostałych planet razem.",
    ),
]


# ---------------------------------------------------------------------------
# Pomocniki
# ---------------------------------------------------------------------------

def _make_options_dict(options_list):
    """Zwraca słownik opcji {A: ..., B: ..., C: ..., D: ...} jako JSONField."""
    return {letter: text for letter, text in zip("ABCD", options_list)}


def _calc_points(is_correct, response_time_ms, streak):
    """Prosta symulacja kalkulacji punktów zgodna z logiką gry."""
    if not is_correct:
        return 0
    base = 1000
    time_bonus = max(0, 1000 - response_time_ms // 10)
    streak_multiplier = 1.0 + min(streak * 0.1, 0.5)
    return int((base + time_bonus) * streak_multiplier)


# ---------------------------------------------------------------------------
# Komenda
# ---------------------------------------------------------------------------

class Command(BaseCommand):
    help = "Wypełnia bazę danych przykładowymi danymi do demo i developmentu."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Usuń istniejące dane seed przed ponownym tworzeniem.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["clear"]:
            self._clear_seed_data()

        achievements = self._seed_achievements()
        users, profiles = self._seed_users()
        self._seed_friendships(users)
        rooms = self._seed_rooms(users, profiles)
        self._seed_achievements_for_users(users, achievements)
        self.stdout.write(self.style.SUCCESS("\nGotowe! Dane seed zostały wczytane pomyślnie."))

    # ------------------------------------------------------------------

    def _clear_seed_data(self):
        self.stdout.write("Czyszczenie istniejących danych seed...")
        usernames = [u["username"] for u in USERS_DATA]
        User.objects.filter(username__in=usernames).delete()
        self.stdout.write("  Usunięto użytkowników i powiązane dane.")

    # ------------------------------------------------------------------

    def _seed_achievements(self):
        self.stdout.write("\n[1/5] Osiągnięcia...")
        achievements = {}
        for data in ACHIEVEMENTS_DATA:
            obj, created = Achievement.objects.get_or_create(
                condition_type=data["condition_type"],
                defaults={
                    "name": data["name"],
                    "description": data["description"],
                    "icon": data["icon"],
                },
            )
            achievements[data["condition_type"]] = obj
            status = "utworzono" if created else "już istnieje"
            self.stdout.write(f"  {obj.icon} {obj.name} — {status}")
        return achievements

    # ------------------------------------------------------------------

    def _seed_users(self):
        self.stdout.write("\n[2/5] Użytkownicy i profile...")
        users = []
        profiles = []
        for i, data in enumerate(USERS_DATA):
            user, created = User.objects.get_or_create(
                username=data["username"],
                defaults={"email": f"{data['username']}@example.com"},
            )
            if created:
                user.set_password(data["password"])
                user.save()

            profile, _ = UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    "display_name": data["display_name"],
                    "avatar": data["avatar"],
                    "total_score": random.randint(500, 15000),
                    "weekly_score": random.randint(0, 3000),
                    "games_played": random.randint(1, 40),
                },
            )
            status = "utworzono" if created else "już istnieje"
            self.stdout.write(f"  {data['avatar']:10s} {profile.display_name} — {status}")
            users.append(user)
            profiles.append(profile)
        return users, profiles

    # ------------------------------------------------------------------

    def _seed_friendships(self, users):
        self.stdout.write("\n[3/5] Znajomości...")
        pairs = [
            (users[0], users[1], "accepted"),
            (users[0], users[2], "accepted"),
            (users[1], users[2], "accepted"),
            (users[3], users[0], "accepted"),
            (users[4], users[1], "pending"),
        ]
        for from_u, to_u, status in pairs:
            obj, created = Friendship.objects.get_or_create(
                from_user=from_u,
                to_user=to_u,
                defaults={"status": status},
            )
            s = "utworzono" if created else "już istnieje"
            self.stdout.write(f"  {from_u.username} → {to_u.username} ({obj.status}) — {s}")

    # ------------------------------------------------------------------

    def _seed_rooms(self, users, profiles):
        self.stdout.write("\n[4/5] Pokoje, gracze, pytania i odpowiedzi...")
        rooms = []
        for room_idx in range(10):
            categories = CATEGORIES_POOL[room_idx]
            # Idempotentność: identyfikujemy pokoje demo po specjalnym kodzie (RMxxx)
            demo_code = f"RM{room_idx:04d}"
            room, room_created = Room.objects.get_or_create(
                code=demo_code,
                defaults={
                    "categories": categories,
                    "status": Room.Status.FINISHED,
                    "total_rounds": 10,
                    "current_round": 10,
                    "is_public": room_idx % 2 == 0,
                },
            )
            rooms.append(room)

            if not room_created:
                self.stdout.write(f"  Pokój {demo_code} już istnieje — pomijam.")
                continue

            # Gracze w pokoju — 2-4 losowych użytkowników
            num_players = random.randint(2, min(4, len(users)))
            selected_users = random.sample(list(zip(users, profiles)), num_players)
            players = []
            for p_idx, (user, profile) in enumerate(selected_users):
                player = Player.objects.create(
                    room=room,
                    user=user,
                    nickname=profile.display_name,
                    is_host=(p_idx == 0),
                )
                players.append(player)

            # Pytania i odpowiedzi
            q_pool = random.sample(SAMPLE_QUESTIONS, 10)
            questions = []
            for round_num, (content, opts, correct, explanation) in enumerate(q_pool, start=1):
                q = Question.objects.create(
                    room=room,
                    round_number=round_num,
                    content=content,
                    options=_make_options_dict(opts),
                    correct_answer=correct,
                    explanation=explanation,
                )
                questions.append(q)

            # Symulacja odpowiedzi i punktów
            for player in players:
                streak = 0
                total = 0
                for q in questions:
                    is_correct = random.random() < 0.65
                    chosen = q.correct_answer if is_correct else random.choice(
                        [x for x in "ABCD" if x != q.correct_answer]
                    )
                    response_ms = random.randint(800, 9000)
                    streak = streak + 1 if is_correct else 0
                    multiplier = 1.0 + min(streak * 0.1, 0.5)
                    pts = _calc_points(is_correct, response_ms, streak)
                    total += pts
                    Answer.objects.create(
                        player=player,
                        question=q,
                        chosen_option=chosen,
                        response_time_ms=response_ms,
                        points_earned=pts,
                        is_correct=is_correct,
                        streak_at_answer=streak,
                        multiplier_applied=round(multiplier, 2),
                    )
                player.score = total
                player.best_streak = random.randint(0, 10)
                player.save()

            # Aktualizuj statystyki profili
            for user, profile in selected_users:
                profile.games_played = UserProfile.objects.get(pk=profile.pk).games_played + 1
                room_score = Player.objects.get(room=room, user=user).score
                profile.total_score = UserProfile.objects.get(pk=profile.pk).total_score + room_score
                profile.weekly_score = UserProfile.objects.get(pk=profile.pk).weekly_score + room_score
                profile.save()

            self.stdout.write(
                f"  Pokój {demo_code} [{', '.join(categories)}] — "
                f"{len(players)} graczy, 10 pytań — utworzono"
            )
        return rooms

    # ------------------------------------------------------------------

    def _seed_achievements_for_users(self, users, achievements):
        self.stdout.write("\n[5/5] Odblokowane osiągnięcia...")
        assignments = [
            (users[0], ["first_blood", "speed_demon", "rich"]),
            (users[1], ["first_blood", "perfect_round", "hot_streak_10"]),
            (users[2], ["first_blood", "hot_streak_10", "hot_streak_20"]),
            (users[3], ["first_blood", "comeback_king"]),
            (users[4], ["first_blood"]),
        ]
        for user, ach_types in assignments:
            for ach_type in ach_types:
                achievement = achievements.get(ach_type)
                if not achievement:
                    continue
                obj, created = UserAchievement.objects.get_or_create(
                    user=user,
                    achievement=achievement,
                )
                s = "odblokowano" if created else "już istnieje"
                self.stdout.write(
                    f"  {user.username:15s} + {achievement.icon} {achievement.name} — {s}"
                )
