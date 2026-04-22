import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.rooms.models import Room
from apps.rooms.constants import QUIZ_CATEGORIES


class Command(BaseCommand):
    help = 'Tworzy zaplanowana gre publiczna'

    def add_arguments(self, parser):
        parser.add_argument(
            '--minutes', type=int, default=5,
            help='Za ile minut ma sie rozpoczac gra (domyslnie 5)',
        )
        parser.add_argument(
            '--categories', type=int, default=3,
            help='Ile kategorii wylosowac (domyslnie 3)',
        )
        parser.add_argument(
            '--rounds', type=int, default=10,
            help='Liczba rund (domyslnie 10)',
        )

    def handle(self, *args, **options):
        minutes = options['minutes']
        num_categories = min(options['categories'], len(QUIZ_CATEGORIES))
        rounds = options['rounds']

        scheduled = timezone.now() + timedelta(minutes=minutes)
        categories = random.sample(QUIZ_CATEGORIES, num_categories)

        room = Room.objects.create(
            categories=categories,
            is_public=True,
            scheduled_at=scheduled,
            total_rounds=rounds,
        )

        self.stdout.write(self.style.SUCCESS(
            f'Utworzono gre publiczna {room.code} '
            f'| Kategorie: {", ".join(categories)} '
            f'| Start: {scheduled.strftime("%H:%M:%S")} '
            f'| Rundy: {rounds}'
        ))
