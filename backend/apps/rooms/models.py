import random
import string
from django.db import models


def generate_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


class QuestionPack(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey('auth.User', on_delete=models.CASCADE, related_name='question_packs')
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'question_packs'

    def __str__(self):
        return self.name


class CustomQuestion(models.Model):
    pack = models.ForeignKey(QuestionPack, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    answers = models.JSONField()       # lista 4 stringów
    correct_index = models.IntegerField()  # 0–3
    image_emoji = models.CharField(max_length=10, blank=True)

    class Meta:
        db_table = 'custom_questions'

    def __str__(self):
        return self.question_text[:60]


class Room(models.Model):
    class Status(models.TextChoices):
        LOBBY = 'lobby', 'Lobby'
        IN_PROGRESS = 'in_progress', 'W trakcie'
        FINISHED = 'finished', 'Zakończony'

    class GameMode(models.TextChoices):
        CLASSIC = 'classic', 'Klasyczny'
        DUEL = 'duel', 'Pojedynek'
        SURVIVAL = 'survival', 'Przetrwanie'

    code = models.CharField(max_length=6, unique=True, default=generate_room_code)
    categories = models.JSONField(default=list)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.LOBBY)
    total_rounds = models.IntegerField(default=10)
    current_round = models.IntegerField(default=0)
    is_public = models.BooleanField(default=False)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    pack = models.ForeignKey(QuestionPack, on_delete=models.SET_NULL, null=True, blank=True, related_name='rooms')
    game_mode = models.CharField(
        max_length=20,
        choices=GameMode.choices,
        default=GameMode.CLASSIC,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Room {self.code} ({self.status})"

    def is_joinable(self) -> bool:
        """Zwraca True jeśli pokój przyjmuje nowych graczy."""
        return self.status == self.Status.LOBBY

    class Meta:
        db_table = 'rooms'


class Player(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='players')
    user = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True)
    nickname = models.CharField(max_length=30)
    score = models.IntegerField(default=0)
    is_host = models.BooleanField(default=False)
    current_streak = models.IntegerField(default=0)
    best_streak = models.IntegerField(default=0)
    joined_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nickname} in {self.room.code}"

    class Meta:
        db_table = 'players'
        unique_together = ('room', 'nickname')


class Question(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='questions')
    round_number = models.IntegerField()
    content = models.TextField()
    options = models.JSONField()
    correct_answer = models.CharField(max_length=1)
    explanation = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'questions'


class Answer(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='answers')
    chosen_option = models.CharField(max_length=1)
    response_time_ms = models.IntegerField()
    points_earned = models.IntegerField(default=0)
    is_correct = models.BooleanField(default=False)
    streak_at_answer = models.IntegerField(default=0)
    multiplier_applied = models.FloatField(default=1.0)

    class Meta:
        db_table = 'answers'
        unique_together = ('player', 'question')


class PublicTournamentConfig(models.Model):
    """Singleton — konfiguracja automatycznych turniejów publicznych."""
    interval_minutes = models.IntegerField(default=30, help_text='Co ile minut tworzony jest nowy turniej publiczny')
    max_players = models.IntegerField(default=16, help_text='Maksymalna liczba graczy w turnieju publicznym')
    is_enabled = models.BooleanField(default=True, help_text='Czy scheduler automatycznie tworzy turnieje publiczne')

    class Meta:
        db_table = 'public_tournament_config'
        verbose_name = 'Konfiguracja turnieju publicznego'
        verbose_name_plural = 'Konfiguracja turniejów publicznych'

    def __str__(self):
        status = 'włączony' if self.is_enabled else 'wyłączony'
        return f'Turnieje publiczne ({status}, co {self.interval_minutes} min, max {self.max_players} graczy)'

    @classmethod
    def get(cls):
        """Zwraca singleton konfiguracji (tworzy jeśli nie istnieje)."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
