import random
from datetime import date
from django.core.management.base import BaseCommand
from apps.accounts.models import DailyChallenge


CHALLENGE_POOL = [
    {
        'description': 'Zagraj 3 gry',
        'challenge_type': 'play_games',
        'target_value': 3,
        'coin_reward': 30,
    },
    {
        'description': 'Zagraj 5 gier',
        'challenge_type': 'play_games',
        'target_value': 5,
        'coin_reward': 50,
    },
    {
        'description': 'Wygraj 2 gry',
        'challenge_type': 'win_games',
        'target_value': 2,
        'coin_reward': 50,
    },
    {
        'description': 'Wygraj 3 gry',
        'challenge_type': 'win_games',
        'target_value': 3,
        'coin_reward': 70,
    },
    {
        'description': 'Zdobądź streak 5',
        'challenge_type': 'streak',
        'target_value': 5,
        'coin_reward': 40,
    },
    {
        'description': 'Zdobądź streak 10',
        'challenge_type': 'streak',
        'target_value': 10,
        'coin_reward': 60,
    },
    {
        'description': 'Odpowiedz poprawnie na 20 pytań',
        'challenge_type': 'correct_answers',
        'target_value': 20,
        'coin_reward': 35,
    },
    {
        'description': 'Odpowiedz poprawnie na 30 pytań',
        'challenge_type': 'correct_answers',
        'target_value': 30,
        'coin_reward': 50,
    },
    {
        'description': 'Przeżyj 10 rund',
        'challenge_type': 'survival_rounds',
        'target_value': 10,
        'coin_reward': 60,
    },
    {
        'description': 'Przeżyj 15 rund',
        'challenge_type': 'survival_rounds',
        'target_value': 15,
        'coin_reward': 80,
    },
]


class Command(BaseCommand):
    help = 'Generuje 3 losowe wyzwania dzienne na dzisiaj (jeśli jeszcze nie istnieją)'

    def handle(self, *args, **options):
        today = date.today()
        existing_count = DailyChallenge.objects.filter(date=today).count()

        if existing_count >= 3:
            self.stdout.write(
                self.style.SUCCESS(f'Wyzwania na {today} już istnieją ({existing_count} szt.) — pominięto.')
            )
            return

        chosen = random.sample(CHALLENGE_POOL, 3)
        for challenge_data in chosen:
            DailyChallenge.objects.create(date=today, **challenge_data)

        self.stdout.write(self.style.SUCCESS(f'Utworzono 3 wyzwania dzienne na {today}.'))
