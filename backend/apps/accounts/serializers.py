from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, Clan, ClanMembership, ClanInvite, AVATAR_EMOJI


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6, write_only=True)
    display_name = serializers.CharField(max_length=30)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def validate_display_name(self, value):
        if UserProfile.objects.filter(display_name=value).exists():
            raise serializers.ValidationError("Display name already taken.")
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class UserProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = UserProfile
        fields = ['id', 'display_name', 'email', 'total_score', 'games_played', 'avatar', 'coins', 'created_at']


class ClanMemberSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source='user.profile.display_name', read_only=True)
    avatar = serializers.SerializerMethodField()
    total_score = serializers.IntegerField(source='user.profile.total_score', read_only=True)
    games_played = serializers.IntegerField(source='user.profile.games_played', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = ClanMembership
        fields = ['user_id', 'display_name', 'avatar', 'total_score', 'games_played', 'role', 'joined_at']

    def get_avatar(self, obj):
        key = obj.user.profile.avatar
        return AVATAR_EMOJI.get(key, '🦊')


class ClanListSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    leader = serializers.SerializerMethodField()
    total_score = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()

    class Meta:
        model = Clan
        fields = [
            'id', 'name', 'tag', 'avatar', 'description', 'is_open',
            'max_members', 'member_count', 'leader', 'total_score', 'is_member', 'created_at',
        ]

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_leader(self, obj):
        membership = obj.memberships.filter(role=ClanMembership.Role.LEADER).select_related('user__profile').first()
        return membership.user.profile.display_name if membership else ''

    def get_total_score(self, obj):
        return sum(m.user.profile.total_score for m in obj.memberships.select_related('user__profile').all())

    def get_is_member(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.memberships.filter(user=request.user).exists()


class ClanDetailSerializer(ClanListSerializer):
    members = ClanMemberSerializer(source='memberships', many=True, read_only=True)

    class Meta(ClanListSerializer.Meta):
        fields = ClanListSerializer.Meta.fields + ['members']


class ClanInviteSerializer(serializers.ModelSerializer):
    clan_name = serializers.CharField(source='clan.name', read_only=True)
    clan_tag = serializers.CharField(source='clan.tag', read_only=True)
    invited_by_name = serializers.CharField(source='invited_by.profile.display_name', read_only=True)

    class Meta:
        model = ClanInvite
        fields = ['id', 'clan', 'clan_name', 'clan_tag', 'invited_by_name', 'status', 'created_at']
