from django.contrib import admin
from .models import Room, Player, Question, Answer, PublicTournamentConfig

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['code', 'status', 'current_round', 'total_rounds', 'created_at']
    list_filter = ['status']

@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ['nickname', 'room', 'score', 'is_host']

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['room', 'round_number', 'content', 'correct_answer']

@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ['player', 'question', 'chosen_option', 'is_correct', 'points_earned']

@admin.register(PublicTournamentConfig)
class PublicTournamentConfigAdmin(admin.ModelAdmin):
    list_display = ['interval_minutes', 'max_players', 'is_enabled']

    def has_add_permission(self, request):
        # Singleton — zablokuj dodawanie jeśli rekord już istnieje
        return not PublicTournamentConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
