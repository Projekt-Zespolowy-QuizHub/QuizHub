from django.contrib import admin
from django.urls import path, include
from apps.accounts.urls import auth_urls, profile_urls, friends_urls, clans_urls, challenges_urls, shop_urls
from apps.accounts.views import (
    GlobalRankingView, WeeklyRankingView, FriendsRankingView,
    CurrentSeasonView, SeasonLeaderboardView, PastSeasonsView, UserSeasonHistoryView,
)
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include(auth_urls)),
    path('api/profile/', include(profile_urls)),
    path('api/friends/', include(friends_urls)),
    path('api/rankings/global/', GlobalRankingView.as_view()),
    path('api/rankings/weekly/', WeeklyRankingView.as_view()),
    path('api/rankings/friends/', FriendsRankingView.as_view()),
    path('api/seasons/current/', CurrentSeasonView.as_view(), name='season-current'),
    path('api/seasons/user/<int:user_id>/', UserSeasonHistoryView.as_view(), name='season-user-history'),
    path('api/seasons/<int:pk>/leaderboard/', SeasonLeaderboardView.as_view(), name='season-leaderboard'),
    path('api/seasons/', PastSeasonsView.as_view(), name='season-list'),
    path('api/clans/', include(clans_urls)),
    path('api/daily-challenges/', include(challenges_urls)),
    path('api/shop/', include(shop_urls)),
    path('api/', include('apps.rooms.urls')),
    # Dokumentacja API
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
