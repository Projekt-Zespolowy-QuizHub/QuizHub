from django.db import migrations


SHOP_ITEMS = [
    # Ramki profilu
    {
        'name': 'Złota Ramka',
        'description': 'Elegancka złota ramka dla najlepszych graczy.',
        'item_type': 'profile_frame',
        'price': 100,
        'emoji_icon': '🖼️',
    },
    {
        'name': 'Gwiaździsta Ramka',
        'description': 'Lśniąca ramka pokryta gwiazdami.',
        'item_type': 'profile_frame',
        'price': 200,
        'emoji_icon': '🌟',
    },
    # Efekty confetti
    {
        'name': 'Fajerwerki',
        'description': 'Eksplozja fajerwerków przy wygranej.',
        'item_type': 'confetti_effect',
        'price': 150,
        'emoji_icon': '🎆',
    },
    {
        'name': 'Śnieżna Burza',
        'description': 'Delikatny opad śniegu po każdej grze.',
        'item_type': 'confetti_effect',
        'price': 300,
        'emoji_icon': '❄️',
    },
    # Tytuły
    {
        'name': 'Mistrz Quizów',
        'description': 'Zaszczytny tytuł dla prawdziwych mistrzów.',
        'item_type': 'title',
        'price': 500,
        'emoji_icon': '👑',
    },
    {
        'name': 'Wielki Mózg',
        'description': 'Tytuł dla tych, którzy wiedzą wszystko.',
        'item_type': 'title',
        'price': 250,
        'emoji_icon': '🧠',
    },
    {
        'name': 'Błyskawica',
        'description': 'Dla graczy, którzy odpowiadają błyskawicznie.',
        'item_type': 'title',
        'price': 350,
        'emoji_icon': '⚡',
    },
    # Dodatkowe ramki
    {
        'name': 'Ogniowa Ramka',
        'description': 'Płonąca ramka dla żarliwych graczy.',
        'item_type': 'profile_frame',
        'price': 400,
        'emoji_icon': '🔥',
    },
    # Dodatkowe efekty
    {
        'name': 'Konfetti Tęcza',
        'description': 'Kolorowe konfetti we wszystkich barwach tęczy.',
        'item_type': 'confetti_effect',
        'price': 200,
        'emoji_icon': '🌈',
    },
    # Dodatkowy tytuł
    {
        'name': 'Legenda',
        'description': 'Tylko dla największych legend QuizArena.',
        'item_type': 'title',
        'price': 1000,
        'emoji_icon': '🏆',
    },
]


def seed_shop_items(apps, schema_editor):
    ShopItem = apps.get_model('accounts', 'ShopItem')
    for item_data in SHOP_ITEMS:
        ShopItem.objects.get_or_create(
            name=item_data['name'],
            defaults=item_data,
        )


def remove_shop_items(apps, schema_editor):
    ShopItem = apps.get_model('accounts', 'ShopItem')
    names = [item['name'] for item in SHOP_ITEMS]
    ShopItem.objects.filter(name__in=names).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_shop_system'),
    ]

    operations = [
        migrations.RunPython(seed_shop_items, remove_shop_items),
    ]
