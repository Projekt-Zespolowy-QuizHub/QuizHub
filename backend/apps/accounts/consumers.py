import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer dla powiadomień użytkownika (wyzwania, itp.).
    Ścieżka: ws://host/ws/notifications/
    Wymaga uwierzytelnienia.
    """

    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        self.group_name = f'user_notifications_{user.id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info('Notifications WS connect: user=%s', user.id)

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        # Klient nie wysyła nic — tylko odbiera powiadomienia
        pass

    # ─── Group message handlers ───────────────────────────────────────

    async def challenge_received(self, event):
        await self.send(json.dumps({
            'type': 'challenge_received',
            'challenge_id': event['challenge_id'],
            'room_code': event['room_code'],
            'from_display_name': event['from_display_name'],
        }))

    async def challenge_cancelled(self, event):
        await self.send(json.dumps({
            'type': 'challenge_cancelled',
            'challenge_id': event['challenge_id'],
        }))

    async def friend_request_received(self, event):
        await self.send(json.dumps({
            'type': 'friend_request_received',
            'request_id': event['request_id'],
            'from_display_name': event['from_display_name'],
            'from_user_id': event['from_user_id'],
        }))

    async def friend_request_accepted(self, event):
        await self.send(json.dumps({
            'type': 'friend_request_accepted',
            'by_display_name': event['by_display_name'],
        }))
