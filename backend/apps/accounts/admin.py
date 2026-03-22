from django.contrib import admin
from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'user', 'total_score', 'games_played', 'created_at')
    search_fields = ('display_name', 'user__username')
