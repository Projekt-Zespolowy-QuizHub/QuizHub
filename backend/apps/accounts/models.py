from django.db import models
from django.contrib.auth.models import User


AVATAR_CHOICES = [
    ('fox', '🦊'),
    ('wolf', '🐺'),
    ('lion', '🦁'),
    ('tiger', '🐯'),
    ('bear', '🐻'),
    ('raccoon', '🦝'),
    ('frog', '🐸'),
    ('penguin', '🐧'),
    ('owl', '🦉'),
    ('butterfly', '🦋'),
    ('dragon', '🐉'),
    ('unicorn', '🦄'),
    ('octopus', '🐙'),
    ('shark', '🦈'),
    ('turtle', '🐢'),
    ('cat', '🐱'),
    ('robot', '🤖'),
    ('alien', '👾'),
    ('ninja', '🥷'),
    ('wizard', '🧙'),
]

AVATAR_EMOJI = dict(AVATAR_CHOICES)


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=30, unique=True)
    total_score = models.IntegerField(default=0)
    weekly_score = models.IntegerField(default=0)
    games_played = models.IntegerField(default=0)
    avatar = models.CharField(max_length=20, choices=AVATAR_CHOICES, default='fox')
    coins = models.IntegerField(default=0)
    last_daily_bonus = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_profiles'

    def __str__(self):
        return self.display_name


class Friendship(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Oczekuje'
        ACCEPTED = 'accepted', 'Zaakceptowane'

    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_requests')
    to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_requests')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'friendships'
        unique_together = ('from_user', 'to_user')

    def __str__(self):
        return f"{self.from_user} -> {self.to_user} ({self.status})"


class Achievement(models.Model):
    class ConditionType(models.TextChoices):
        FIRST_BLOOD = 'first_blood', 'First Blood'
        PERFECT_ROUND = 'perfect_round', 'Perfect Round'
        HOT_STREAK_10 = 'hot_streak_10', 'On Fire'
        HOT_STREAK_20 = 'hot_streak_20', 'Unstoppable'
        HOT_STREAK_50 = 'hot_streak_50', 'Legendary'
        VETERAN = 'veteran', 'Veteran'
        ADDICT = 'addict', 'Addict'
        NO_LIFER = 'no_lifer', 'No-Lifer'
        SOCIAL_BUTTERFLY = 'social_butterfly', 'Social Butterfly'
        SPEED_DEMON = 'speed_demon', 'Speed Demon'
        LIGHTNING = 'lightning', 'Lightning'
        COMEBACK_KING = 'comeback_king', 'Comeback King'
        FLAWLESS_VICTORY = 'flawless_victory', 'Flawless Victory'
        RICH = 'rich', 'Rich'
        WHALE = 'whale', 'Whale'
        COLLECTOR = 'collector', 'Collector'
        TOURNAMENT_CHAMPION = 'tournament_champion', 'Tournament Champion'
        CLAN_LEADER = 'clan_leader', 'Clan Leader'
        SURVIVOR = 'survivor', 'Survivor'
        DUELIST = 'duelist', 'Duelist'

    name = models.CharField(max_length=50)
    description = models.TextField()
    icon = models.CharField(max_length=10)
    condition_type = models.CharField(max_length=30, choices=ConditionType.choices, unique=True)

    class Meta:
        db_table = 'achievements'

    def __str__(self):
        return self.name


class UserAchievement(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='achievements')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name='user_achievements')
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_achievements'
        unique_together = ('user', 'achievement')

    def __str__(self):
        return f"{self.user} - {self.achievement.name}"


class Clan(models.Model):
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    tag = models.CharField(max_length=5, unique=True)
    avatar = models.CharField(max_length=10, default='🛡️')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_clans')
    is_open = models.BooleanField(default=True)
    max_members = models.IntegerField(default=20)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'clans'

    def __str__(self):
        return f"[{self.tag}] {self.name}"


class ClanMembership(models.Model):
    class Role(models.TextChoices):
        LEADER = 'leader', 'Lider'
        OFFICER = 'officer', 'Oficer'
        MEMBER = 'member', 'Członek'

    clan = models.ForeignKey(Clan, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='clan_membership')
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'clan_memberships'
        unique_together = ('clan', 'user')

    def __str__(self):
        return f"{self.user} in [{self.clan.tag}] as {self.role}"


class ClanInvite(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Oczekuje'
        ACCEPTED = 'accepted', 'Zaakceptowane'
        REJECTED = 'rejected', 'Odrzucone'

    clan = models.ForeignKey(Clan, on_delete=models.CASCADE, related_name='invites')
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_clan_invites')
    invited_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_clan_invites')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'clan_invites'

    def __str__(self):
        return f"{self.invited_by} → {self.invited_user} ({self.clan.tag}, {self.status})"


class Challenge(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Oczekuje'
        ACCEPTED = 'accepted', 'Zaakceptowane'
        DECLINED = 'declined', 'Odrzucone'

    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_challenges')
    to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_challenges')
    room = models.ForeignKey('rooms.Room', on_delete=models.CASCADE, related_name='challenges')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'challenges'

    def __str__(self):
        return f"{self.from_user} → {self.to_user} ({self.status})"


class Season(models.Model):
    number = models.IntegerField(unique=True)
    name = models.CharField(max_length=50)  # np. "Sezon 1"
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)

    class Meta:
        db_table = 'seasons'
        ordering = ['-number']

    def __str__(self):
        return self.name


class SeasonResult(models.Model):
    season = models.ForeignKey(Season, on_delete=models.CASCADE, related_name='results')
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, related_name='season_results')
    final_rank = models.IntegerField()
    total_score = models.IntegerField()
    games_played = models.IntegerField()
    wins = models.IntegerField(default=0)

    class Meta:
        db_table = 'season_results'
        unique_together = ('season', 'user')
        ordering = ['final_rank']

    def __str__(self):
        return f"{self.user} - {self.season.name} - rank {self.final_rank}"


class ShopItem(models.Model):
    class ItemType(models.TextChoices):
        PROFILE_FRAME = 'profile_frame', 'Ramka profilu'
        CONFETTI_EFFECT = 'confetti_effect', 'Efekt confetti'
        TITLE = 'title', 'Tytuł'
        AVATAR = 'avatar', 'Avatar'

    name = models.CharField(max_length=50)
    description = models.TextField()
    item_type = models.CharField(max_length=20, choices=ItemType.choices)
    price = models.IntegerField()
    emoji_icon = models.CharField(max_length=10)
    avatar_key = models.CharField(max_length=20, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'shop_items'

    def __str__(self):
        return f"{self.name} ({self.item_type})"


class UserItem(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shop_items')
    item = models.ForeignKey(ShopItem, on_delete=models.CASCADE, related_name='owners')
    purchased_at = models.DateTimeField(auto_now_add=True)
    is_equipped = models.BooleanField(default=False)

    class Meta:
        db_table = 'user_items'
        unique_together = ('user', 'item')

    def __str__(self):
        return f"{self.user} — {self.item.name}"


class DailyChallenge(models.Model):
    class ChallengeType(models.TextChoices):
        PLAY_GAMES = 'play_games', 'Zagraj gier'
        WIN_GAMES = 'win_games', 'Wygraj gier'
        CORRECT_ANSWERS = 'correct_answers', 'Poprawnych odpowiedzi'
        STREAK = 'streak', 'Streak'
        SURVIVAL_ROUNDS = 'survival_rounds', 'Przeżyj rund'

    description = models.CharField(max_length=200)
    challenge_type = models.CharField(max_length=20, choices=ChallengeType.choices)
    target_value = models.IntegerField()
    coin_reward = models.IntegerField()
    date = models.DateField()

    class Meta:
        db_table = 'daily_challenges'

    def __str__(self):
        return f"{self.date} — {self.description}"


class UserChallengeProgress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='challenge_progress')
    challenge = models.ForeignKey(DailyChallenge, on_delete=models.CASCADE, related_name='user_progress')
    current_value = models.IntegerField(default=0)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    reward_claimed = models.BooleanField(default=False)

    class Meta:
        db_table = 'user_challenge_progress'
        unique_together = ('user', 'challenge')

    def __str__(self):
        return f"{self.user} — {self.challenge.description} ({self.current_value}/{self.challenge.target_value})"
