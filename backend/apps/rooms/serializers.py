from rest_framework import serializers
from .models import Room, Player, Question, Tournament, TournamentParticipant


class PlayerSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()

    def get_avatar(self, obj) -> str:
        from apps.accounts.models import AVATAR_EMOJI
        if obj.user_id and hasattr(obj, '_user_profile_avatar'):
            return AVATAR_EMOJI.get(obj._user_profile_avatar, '🦊')
        if obj.user:
            try:
                return AVATAR_EMOJI.get(obj.user.profile.avatar, '🦊')
            except Exception:
                pass
        return '🦊'

    class Meta:
        model = Player
        fields = ['id', 'nickname', 'score', 'is_host', 'avatar', 'current_streak', 'best_streak']


class RoomSerializer(serializers.ModelSerializer):
    players = PlayerSerializer(many=True, read_only=True)
    player_count = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = ['code', 'categories', 'status', 'total_rounds',
                  'current_round', 'players', 'player_count', 'created_at']

    def get_player_count(self, obj) -> int:
        return obj.players.count()


class CreateRoomSerializer(serializers.Serializer):
    host_nickname = serializers.CharField(max_length=30)
    categories = serializers.ListField(
        child=serializers.CharField(),
        min_length=0,
        max_length=3,
        default=list,
    )
    total_rounds = serializers.IntegerField(default=10, min_value=5, max_value=20)
    pack_id = serializers.IntegerField(required=False, allow_null=True)
    game_mode = serializers.ChoiceField(
        choices=['classic', 'duel', 'survival'],
        default='classic',
    )


class JoinRoomSerializer(serializers.Serializer):
    nickname = serializers.CharField(max_length=30)
    room_code = serializers.CharField(max_length=6)


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['round_number', 'content', 'options']
        # Uwaga: correct_answer celowo pominięty — nie wysyłamy go do frontu!


class LeaderboardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = ['nickname', 'score', 'is_host']


class TournamentSerializer(serializers.ModelSerializer):
    participant_count = serializers.SerializerMethodField()
    creator_name = serializers.CharField(source='creator.profile.display_name', read_only=True)
    is_participant = serializers.SerializerMethodField()

    class Meta:
        model = Tournament
        fields = [
            'id', 'name', 'description', 'icon', 'category', 'status',
            'start_date', 'end_date', 'max_participants', 'participant_count',
            'prize_coins', 'is_open', 'creator_name', 'is_participant', 'created_at',
        ]

    def get_participant_count(self, obj) -> int:
        if hasattr(obj, '_participant_count'):
            return obj._participant_count
        return obj.participants.count()

    def get_is_participant(self, obj) -> bool:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.participants.filter(user=request.user).exists()


class TournamentParticipantSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    display_name = serializers.CharField(source='user.profile.display_name', read_only=True)
    avatar = serializers.SerializerMethodField()
    rank = serializers.IntegerField(read_only=True)

    class Meta:
        model = TournamentParticipant
        fields = ['rank', 'user_id', 'display_name', 'avatar', 'score', 'games_played', 'joined_at']

    def get_avatar(self, obj) -> str:
        from apps.accounts.models import AVATAR_EMOJI
        try:
            return AVATAR_EMOJI.get(obj.user.profile.avatar, '🦊')
        except Exception:
            return '🦊'


class TournamentDetailSerializer(TournamentSerializer):
    participants = serializers.SerializerMethodField()

    class Meta(TournamentSerializer.Meta):
        fields = TournamentSerializer.Meta.fields + ['participants']

    def get_participants(self, obj):
        rows = obj.participants.select_related('user__profile').order_by('-score', 'joined_at')
        data = []
        for i, p in enumerate(rows):
            entry = TournamentParticipantSerializer(p, context=self.context).data
            entry['rank'] = i + 1
            data.append(entry)
        return data


class CreateTournamentSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80, min_length=3)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    icon = serializers.CharField(max_length=10, required=False, default='🏆')
    category = serializers.CharField(max_length=50)
    start_date = serializers.DateTimeField()
    end_date = serializers.DateTimeField()
    max_participants = serializers.IntegerField(min_value=2, max_value=256, default=32)
    prize_coins = serializers.IntegerField(min_value=0, default=0)
    is_open = serializers.BooleanField(default=True)

    def validate(self, data):
        if data['end_date'] <= data['start_date']:
            raise serializers.ValidationError({'end_date': 'Data zakończenia musi być po dacie startu.'})
        return data
