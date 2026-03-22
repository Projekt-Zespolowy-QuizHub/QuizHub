from django.urls import path
from . import views

auth_urls = [
    path('register/', views.RegisterView.as_view()),
    path('login/', views.LoginView.as_view()),
    path('logout/', views.LogoutView.as_view()),
    path('me/', views.MeView.as_view()),
]

profile_urls = [
    path('stats/', views.UserStatsView.as_view()),
    path('history/', views.UserGameHistoryView.as_view()),
    path('achievements/', views.AchievementsView.as_view()),
    path('avatar/', views.UpdateAvatarView.as_view()),
]

friends_urls = [
    path('', views.FriendsListView.as_view()),
    path('search/', views.SearchUsersView.as_view()),
    path('request/', views.SendFriendRequestView.as_view()),
    path('pending/', views.PendingRequestsView.as_view()),
    path('respond/', views.RespondFriendRequestView.as_view()),
    path('challenge/', views.ChallengeFriendView.as_view()),
    path('challenge/respond/', views.ChallengeRespondView.as_view()),
]

clans_urls = [
    path('', views.ClanListView.as_view()),
    path('leaderboard/', views.ClanLeaderboardView.as_view()),
    path('invite/respond/', views.ClanRespondInviteView.as_view()),
    path('<int:pk>/', views.ClanDetailView.as_view()),
    path('<int:pk>/join/', views.ClanJoinView.as_view()),
    path('<int:pk>/leave/', views.ClanLeaveView.as_view()),
    path('<int:pk>/invite/', views.ClanInviteView.as_view()),
    path('<int:pk>/kick/', views.ClanKickView.as_view()),
]

challenges_urls = [
    path('', views.DailyChallengesView.as_view()),
    path('claim/', views.ClaimChallengeRewardView.as_view()),
]

shop_urls = [
    path('', views.ShopListView.as_view()),
    path('buy/', views.BuyItemView.as_view()),
    path('equip/', views.EquipItemView.as_view()),
    path('inventory/', views.UserInventoryView.as_view()),
    path('coins/', views.UserCoinsView.as_view()),
]
