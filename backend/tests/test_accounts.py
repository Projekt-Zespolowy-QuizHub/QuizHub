import pytest
from django.contrib.auth.models import User
from django.db import IntegrityError
from apps.accounts.models import UserProfile


@pytest.mark.django_db
def test_create_profile():
    user = User.objects.create_user(username="testuser", password="testpass123")
    profile = UserProfile.objects.create(user=user, display_name="TestPlayer")
    assert profile.display_name == "TestPlayer"
    assert profile.total_score == 0
    assert profile.games_played == 0
    assert profile.created_at is not None


@pytest.mark.django_db
def test_display_name_unique():
    user1 = User.objects.create_user(username="user1", password="testpass123")
    user2 = User.objects.create_user(username="user2", password="testpass123")
    UserProfile.objects.create(user=user1, display_name="SameName")
    with pytest.raises(IntegrityError):
        UserProfile.objects.create(user=user2, display_name="SameName")
