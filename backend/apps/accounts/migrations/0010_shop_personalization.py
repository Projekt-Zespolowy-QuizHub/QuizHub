from django.db import migrations, models
from django.utils.text import slugify


AVATAR_ITEMS = [
    {'code': 'fox', 'name': 'Lis', 'description': 'Startowy avatar każdego gracza.', 'item_type': 'avatar', 'price': 0, 'emoji_icon': '🦊'},
    {'code': 'wolf', 'name': 'Wilk', 'description': 'Szybki i czujny kompan quizowych starć.', 'item_type': 'avatar', 'price': 120, 'emoji_icon': '🐺'},
    {'code': 'lion', 'name': 'Lew', 'description': 'Król quizowej sawanny.', 'item_type': 'avatar', 'price': 150, 'emoji_icon': '🦁'},
    {'code': 'tiger', 'name': 'Tygrys', 'description': 'Drapieżny styl dla pewnych odpowiedzi.', 'item_type': 'avatar', 'price': 170, 'emoji_icon': '🐯'},
    {'code': 'bear', 'name': 'Niedźwiedź', 'description': 'Mocny wybór dla wytrwałych graczy.', 'item_type': 'avatar', 'price': 180, 'emoji_icon': '🐻'},
    {'code': 'raccoon', 'name': 'Szop', 'description': 'Sprytny avatar dla łowców punktów.', 'item_type': 'avatar', 'price': 140, 'emoji_icon': '🦝'},
    {'code': 'frog', 'name': 'Żaba', 'description': 'Skoczny klasyk do szybkich quizów.', 'item_type': 'avatar', 'price': 110, 'emoji_icon': '🐸'},
    {'code': 'penguin', 'name': 'Pingwin', 'description': 'Chłodna głowa pod presją czasu.', 'item_type': 'avatar', 'price': 130, 'emoji_icon': '🐧'},
    {'code': 'owl', 'name': 'Sowa', 'description': 'Mądry wybór dla strategów.', 'item_type': 'avatar', 'price': 160, 'emoji_icon': '🦉'},
    {'code': 'butterfly', 'name': 'Motyl', 'description': 'Lekki, kolorowy styl.', 'item_type': 'avatar', 'price': 125, 'emoji_icon': '🦋'},
    {'code': 'dragon', 'name': 'Smok', 'description': 'Legendarny avatar dla dominujących graczy.', 'item_type': 'avatar', 'price': 200, 'emoji_icon': '🐉'},
    {'code': 'unicorn', 'name': 'Jednorożec', 'description': 'Magiczny akcent dla wyjątkowych wyników.', 'item_type': 'avatar', 'price': 220, 'emoji_icon': '🦄'},
    {'code': 'octopus', 'name': 'Ośmiornica', 'description': 'Wiele ramion, wiele poprawnych odpowiedzi.', 'item_type': 'avatar', 'price': 145, 'emoji_icon': '🐙'},
    {'code': 'shark', 'name': 'Rekin', 'description': 'Nie odpuszcza żadnej rundy.', 'item_type': 'avatar', 'price': 190, 'emoji_icon': '🦈'},
    {'code': 'turtle', 'name': 'Żółw', 'description': 'Spokojny styl dla cierpliwych graczy.', 'item_type': 'avatar', 'price': 115, 'emoji_icon': '🐢'},
    {'code': 'cat', 'name': 'Kot', 'description': 'Zwinny i zawsze gotowy do kolejnej rundy.', 'item_type': 'avatar', 'price': 135, 'emoji_icon': '🐱'},
    {'code': 'robot', 'name': 'Robot', 'description': 'Techniczna precyzja w każdym pytaniu.', 'item_type': 'avatar', 'price': 210, 'emoji_icon': '🤖'},
    {'code': 'alien', 'name': 'Kosmita', 'description': 'Nieziemski wygląd dla ambitnych.', 'item_type': 'avatar', 'price': 240, 'emoji_icon': '👽'},
    {'code': 'ninja', 'name': 'Ninja', 'description': 'Cichy zabójca rankingów.', 'item_type': 'avatar', 'price': 260, 'emoji_icon': '🥷'},
    {'code': 'wizard', 'name': 'Czarodziej', 'description': 'Magia wiedzy zamknięta w jednym avatarze.', 'item_type': 'avatar', 'price': 230, 'emoji_icon': '🧙'},
]

POWERUP_ITEMS = [
    {'code': 'fifty_fifty', 'name': '50/50', 'description': 'Usuwa dwie błędne odpowiedzi.', 'item_type': 'powerup', 'price': 50, 'emoji_icon': '½'},
    {'code': 'extra_time', 'name': '+15 sekund', 'description': 'Dodaje 15 sekund do licznika rundy.', 'item_type': 'powerup', 'price': 75, 'emoji_icon': '⏱️'},
    {'code': 'double_points', 'name': 'x2 Punkty', 'description': 'Podwaja punkty za następną poprawną odpowiedź.', 'item_type': 'powerup', 'price': 100, 'emoji_icon': '✖️2️⃣'},
]

THEME_ITEMS = [
    {'code': 'default', 'name': 'Klasyczny', 'description': 'Domyślny motyw QuizHub.', 'item_type': 'theme', 'price': 0, 'emoji_icon': '🎨'},
    {'code': 'galaxy', 'name': 'Galaktyczny', 'description': 'Kosmiczny klimat pełen neonowych mgławic.', 'item_type': 'theme', 'price': 300, 'emoji_icon': '🌌'},
    {'code': 'ocean', 'name': 'Oceaniczny', 'description': 'Głębokie błękity i chłodny kontrast.', 'item_type': 'theme', 'price': 250, 'emoji_icon': '🌊'},
    {'code': 'forest', 'name': 'Leśny', 'description': 'Zgaszona zieleń i spokojna atmosfera.', 'item_type': 'theme', 'price': 200, 'emoji_icon': '🌲'},
]

LEGACY_CODES = {
    'Złota Ramka': 'legacy-gold-frame',
    'Gwiaździsta Ramka': 'legacy-star-frame',
    'Fajerwerki': 'legacy-fireworks',
    'Śnieżna Burza': 'legacy-snow-burst',
    'Mistrz Quizów': 'legacy-quiz-master',
    'Wielki Mózg': 'legacy-big-brain',
    'Błyskawica': 'legacy-lightning',
    'Ogniowa Ramka': 'legacy-fire-frame',
    'Konfetti Tęcza': 'legacy-rainbow-confetti',
    'Legenda': 'legacy-legend',
}


def _unique_legacy_code(item, used_codes):
    base = LEGACY_CODES.get(item.name) or f"legacy-{slugify(item.name) or item.pk}"
    candidate = base
    index = 2
    while candidate in used_codes:
        candidate = f'{base}-{index}'
        index += 1
    used_codes.add(candidate)
    return candidate


def seed_personalization_shop(apps, schema_editor):
    ShopItem = apps.get_model('accounts', 'ShopItem')

    used_codes = set(
        ShopItem.objects.exclude(code='').values_list('code', flat=True)
    )

    for item in ShopItem.objects.filter(code='').order_by('id'):
        item.code = _unique_legacy_code(item, used_codes)
        item.save(update_fields=['code'])

    for payload in AVATAR_ITEMS + POWERUP_ITEMS + THEME_ITEMS:
        ShopItem.objects.update_or_create(
            code=payload['code'],
            defaults={
                'name': payload['name'],
                'description': payload['description'],
                'item_type': payload['item_type'],
                'price': payload['price'],
                'emoji_icon': payload['emoji_icon'],
                'is_active': True,
            },
        )


def unseed_personalization_shop(apps, schema_editor):
    ShopItem = apps.get_model('accounts', 'ShopItem')
    codes = [item['code'] for item in AVATAR_ITEMS + POWERUP_ITEMS + THEME_ITEMS]
    ShopItem.objects.filter(code__in=codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_seed_shop_items'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='theme',
            field=models.CharField(default='default', max_length=20),
        ),
        migrations.AddField(
            model_name='shopitem',
            name='code',
            field=models.CharField(default='', max_length=50),
        ),
        migrations.AddField(
            model_name='useritem',
            name='quantity',
            field=models.IntegerField(default=1),
        ),
        migrations.AlterField(
            model_name='shopitem',
            name='item_type',
            field=models.CharField(
                choices=[
                    ('avatar', 'Avatar'),
                    ('powerup', 'Power-up'),
                    ('theme', 'Motyw'),
                    ('profile_frame', 'Ramka profilu'),
                    ('confetti_effect', 'Efekt confetti'),
                    ('title', 'Tytuł'),
                ],
                max_length=20,
            ),
        ),
        migrations.RunPython(seed_personalization_shop, unseed_personalization_shop),
        migrations.AlterField(
            model_name='shopitem',
            name='code',
            field=models.CharField(max_length=50, unique=True),
        ),
    ]
