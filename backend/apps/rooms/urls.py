from django.urls import path
from .views import (
    CreateRoomView, JoinRoomView, RoomDetailView, RoomHistoryView,
    RoomReplayView, NextPublicGameView,
    PublicTournamentConfigView, TriggerPublicTournamentView,
    NextPublicTournamentView,
    PackListView, PackCreateView, PackDetailView,
    PackQuestionCreateView, PackQuestionDetailView,
    TournamentListView, TournamentDetailView, TournamentJoinView, TournamentLeaveView,
)

urlpatterns = [
    path('rooms/', CreateRoomView.as_view(), name='create-room'),
    path('rooms/join/', JoinRoomView.as_view(), name='join-room'),
    path('rooms/public/next/', NextPublicGameView.as_view(), name='next-public-game'),
    path('rooms/<str:code>/', RoomDetailView.as_view(), name='room-detail'),
    path('rooms/<str:code>/history/', RoomHistoryView.as_view(), name='room-history'),
    path('rooms/<str:code>/replay/', RoomReplayView.as_view(), name='room-replay'),
    # Public tournaments (scheduler config)
    path('tournaments/config/', PublicTournamentConfigView.as_view(), name='tournament-config'),
    path('tournaments/trigger/', TriggerPublicTournamentView.as_view(), name='tournament-trigger'),
    path('tournaments/next-public/', NextPublicTournamentView.as_view(), name='next-public-tournament'),
    # User-created tournaments
    path('tournaments/', TournamentListView.as_view(), name='tournament-list'),
    path('tournaments/<int:pk>/', TournamentDetailView.as_view(), name='tournament-detail'),
    path('tournaments/<int:pk>/join/', TournamentJoinView.as_view(), name='tournament-join'),
    path('tournaments/<int:pk>/leave/', TournamentLeaveView.as_view(), name='tournament-leave'),
    # Question packs
    path('packs/', PackListView.as_view(), name='pack-list'),
    path('packs/create/', PackCreateView.as_view(), name='pack-create'),
    path('packs/<int:pk>/', PackDetailView.as_view(), name='pack-detail'),
    path('packs/<int:pk>/questions/', PackQuestionCreateView.as_view(), name='pack-question-create'),
    path('packs/<int:pk>/questions/<int:q_id>/', PackQuestionDetailView.as_view(), name='pack-question-detail'),
]
