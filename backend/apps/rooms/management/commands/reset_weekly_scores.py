from django.core.management.base import BaseCommand
from apps.accounts.models import UserProfile


class Command(BaseCommand):
    help = 'Resetuje tygodniowe wyniki wszystkich uzytkownikow'

    def handle(self, *args, **options):
        count = UserProfile.objects.filter(weekly_score__gt=0).update(weekly_score=0)
        self.stdout.write(self.style.SUCCESS(
            f'Zresetowano weekly_score dla {count} uzytkownikow'
        ))
