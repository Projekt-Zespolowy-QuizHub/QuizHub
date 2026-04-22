from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from apps.accounts.models import Season, SeasonResult, UserProfile


class Command(BaseCommand):
    help = 'Zarządzanie sezonami: start | end'

    def add_arguments(self, parser):
        parser.add_argument('subcommand', choices=['start', 'end'])

    def handle(self, *args, **options):
        subcommand = options['subcommand']
        if subcommand == 'start':
            self._start_season()
        elif subcommand == 'end':
            self._end_season()

    @transaction.atomic
    def _start_season(self):
        # Deaktywuj aktywny sezon jeśli istnieje
        Season.objects.filter(is_active=True).update(is_active=False)

        last = Season.objects.order_by('-number').first()
        new_number = (last.number + 1) if last else 1
        today = timezone.now().date()
        season = Season.objects.create(
            number=new_number,
            name=f'Sezon {new_number}',
            start_date=today,
            end_date=today,  # placeholder — można zaktualizować ręcznie
            is_active=True,
        )
        self.stdout.write(self.style.SUCCESS(f'Sezon {season.name} uruchomiony (id={season.pk})'))

    @transaction.atomic
    def _end_season(self):
        season = Season.objects.filter(is_active=True).first()
        if not season:
            raise CommandError('Brak aktywnego sezonu')

        profiles = UserProfile.objects.select_related('user').order_by('-total_score')
        for rank, profile in enumerate(profiles, start=1):
            SeasonResult.objects.update_or_create(
                season=season,
                user=profile.user,
                defaults={
                    'final_rank': rank,
                    'total_score': profile.total_score,
                    'games_played': profile.games_played,
                    'wins': 0,
                },
            )

        season.is_active = False
        season.end_date = timezone.now().date()
        season.save()
        self.stdout.write(self.style.SUCCESS(f'Sezon {season.name} zakończony, wyniki zapisane'))
