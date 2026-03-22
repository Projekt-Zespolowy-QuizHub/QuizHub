from django.db import migrations, models


PREMIUM_AVATARS = [
    {'key': 'lion',      'emoji': '🦁', 'name': 'Lew',        'price': 150},
    {'key': 'tiger',     'emoji': '🐯', 'name': 'Tygrys',     'price': 150},
    {'key': 'raccoon',   'emoji': '🦝', 'name': 'Szop',       'price': 200},
    {'key': 'frog',      'emoji': '🐸', 'name': 'Żaba',       'price': 150},
    {'key': 'penguin',   'emoji': '🐧', 'name': 'Pingwin',    'price': 200},
    {'key': 'owl',       'emoji': '🦉', 'name': 'Sowa',       'price': 250},
    {'key': 'butterfly', 'emoji': '🦋', 'name': 'Motyl',      'price': 250},
    {'key': 'dragon',    'emoji': '🐉', 'name': 'Smok',       'price': 500},
    {'key': 'unicorn',   'emoji': '🦄', 'name': 'Jednorożec', 'price': 500},
    {'key': 'octopus',   'emoji': '🐙', 'name': 'Ośmiornica', 'price': 300},
    {'key': 'shark',     'emoji': '🦈', 'name': 'Rekin',      'price': 300},
    {'key': 'turtle',    'emoji': '🐢', 'name': 'Żółw',       'price': 200},
    {'key': 'robot',     'emoji': '🤖', 'name': 'Robot',      'price': 350},
    {'key': 'alien',     'emoji': '👾', 'name': 'Kosmita',    'price': 400},
    {'key': 'ninja',     'emoji': '🥷', 'name': 'Ninja',      'price': 400},
    {'key': 'wizard',    'emoji': '🧙', 'name': 'Czarodziej', 'price': 600},
]


def seed_avatar_items(apps, schema_editor):
    ShopItem = apps.get_model('accounts', 'ShopItem')
    for av in PREMIUM_AVATARS:
        ShopItem.objects.get_or_create(
            avatar_key=av['key'],
            item_type='avatar',
            defaults={
                'name': av['name'],
                'description': f'Premium avatar: {av["name"]} {av["emoji"]}',
                'price': av['price'],
                'emoji_icon': av['emoji'],
                'is_active': True,
            },
        )


def remove_avatar_items(apps, schema_editor):
    ShopItem = apps.get_model('accounts', 'ShopItem')
    keys = [av['key'] for av in PREMIUM_AVATARS]
    ShopItem.objects.filter(item_type='avatar', avatar_key__in=keys).delete()


def cleanup_old_achievements(apps, schema_editor):
    Achievement = apps.get_model('accounts', 'Achievement')
    # Usuń hot_streak_5 — za łatwy
    Achievement.objects.filter(condition_type='hot_streak_5').delete()


def restore_old_achievements(apps, schema_editor):
    Achievement = apps.get_model('accounts', 'Achievement')
    Achievement.objects.get_or_create(
        condition_type='hot_streak_5',
        defaults={
            'name': 'Hot Streak 5',
            'description': 'Uzyskaj serię 5 poprawnych odpowiedzi.',
            'icon': '🔥',
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_seed_shop_items'),
    ]

    operations = [
        # Schemat: dodaj avatar_key do ShopItem i nowe ConditionType
        migrations.AddField(
            model_name='shopitem',
            name='avatar_key',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AlterField(
            model_name='shopitem',
            name='item_type',
            field=models.CharField(
                choices=[
                    ('profile_frame', 'Ramka profilu'),
                    ('confetti_effect', 'Efekt confetti'),
                    ('title', 'Tytuł'),
                    ('avatar', 'Avatar'),
                ],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='achievement',
            name='condition_type',
            field=models.CharField(
                choices=[
                    ('first_blood', 'First Blood'),
                    ('perfect_round', 'Perfect Round'),
                    ('hot_streak_10', 'On Fire'),
                    ('hot_streak_20', 'Unstoppable'),
                    ('hot_streak_50', 'Legendary'),
                    ('veteran', 'Veteran'),
                    ('addict', 'Addict'),
                    ('no_lifer', 'No-Lifer'),
                    ('social_butterfly', 'Social Butterfly'),
                    ('speed_demon', 'Speed Demon'),
                    ('lightning', 'Lightning'),
                    ('comeback_king', 'Comeback King'),
                    ('flawless_victory', 'Flawless Victory'),
                    ('rich', 'Rich'),
                    ('whale', 'Whale'),
                    ('collector', 'Collector'),
                    ('tournament_champion', 'Tournament Champion'),
                    ('clan_leader', 'Clan Leader'),
                    ('survivor', 'Survivor'),
                    ('duelist', 'Duelist'),
                ],
                max_length=30,
                unique=True,
            ),
        ),
        # Dane: usuń hot_streak_5, dodaj avatar ShopItems
        migrations.RunPython(cleanup_old_achievements, restore_old_achievements),
        migrations.RunPython(seed_avatar_items, remove_avatar_items),
    ]
