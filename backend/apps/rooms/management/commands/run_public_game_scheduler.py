import random
import time
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.rooms.models import Room, PublicTournamentConfig
from apps.rooms.constants import (
    QUIZ_CATEGORIES, MIN_SECONDS_BEFORE_NEXT_SLOT,
)


class Command(BaseCommand):
    help = 'Uruchamia scheduler gier publicznych'

    def handle(self, *args, **options):
        config = PublicTournamentConfig.get()
        self.stdout.write(self.style.SUCCESS(
            f'Scheduler gier publicznych uruchomiony (co {config.interval_minutes} min)'
        ))

        self._ensure_next_game()

        while True:
            self._ensure_next_game()
            self._start_scheduled_games()
            time.sleep(60)

    def _get_config(self):
        return PublicTournamentConfig.get()

    def _ensure_next_game(self):
        """Upewnij sie ze jest zaplanowana nastepna gra publiczna."""
        config = self._get_config()
        if not config.is_enabled:
            return

        now = timezone.now()

        upcoming = Room.objects.filter(
            is_public=True,
            status=Room.Status.LOBBY,
            scheduled_at__gt=now,
        ).exists()

        if upcoming:
            return

        next_slot = self._compute_next_slot(now, config.interval_minutes)
        categories = random.sample(QUIZ_CATEGORIES, 3)
        room = Room.objects.create(
            categories=categories,
            is_public=True,
            scheduled_at=next_slot,
            total_rounds=10,
        )
        self.stdout.write(self.style.SUCCESS(
            f'[{now.strftime("%H:%M:%S")}] Nowa gra publiczna {room.code} '
            f'| {", ".join(categories)} '
            f'| Start: {next_slot.strftime("%H:%M")}'
        ))

    @staticmethod
    def _compute_next_slot(now, interval_minutes: int):
        """Oblicza następny slot czasowy wyrównany do interwału."""
        if interval_minutes == 30:
            # Zachowaj poprzednie zachowanie: wyrównaj do :00 lub :30
            if now.minute < 30:
                next_slot = now.replace(minute=30, second=0, microsecond=0)
            else:
                next_slot = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        else:
            # Ogólny przypadek: zaokrąglij w górę do następnego wielokrotności interval_minutes
            minutes_since_epoch = int(now.timestamp() // 60)
            next_slot_minutes = ((minutes_since_epoch // interval_minutes) + 1) * interval_minutes
            next_slot = now.replace(second=0, microsecond=0) + timedelta(
                minutes=next_slot_minutes - minutes_since_epoch
            )

        if (next_slot - now).total_seconds() < MIN_SECONDS_BEFORE_NEXT_SLOT:
            next_slot += timedelta(minutes=interval_minutes)

        return next_slot

    def _start_scheduled_games(self):
        """Uruchom gry publiczne, których scheduled_at minął."""
        now = timezone.now()
        rooms = Room.objects.filter(
            is_public=True,
            status=Room.Status.LOBBY,
            scheduled_at__lte=now,
        )
        channel_layer = get_channel_layer()
        for room in rooms:
            if room.players.count() < 1:
                continue
            async_to_sync(channel_layer.group_send)(
                f'room_{room.code}',
                {'type': 'auto_start'},
            )
            self.stdout.write(self.style.SUCCESS(
                f'[{now.strftime("%H:%M:%S")}] Auto-start: {room.code} '
                f'({room.players.count()} graczy, scheduled: {room.scheduled_at.strftime("%H:%M")})'
            ))
