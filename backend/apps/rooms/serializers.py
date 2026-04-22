from rest_framework import serializers
from .models import Room, Player, Question


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
