from django.urls import re_path
from . import consumers
from apps.accounts.consumers import NotificationConsumer

websocket_urlpatterns = [
    re_path(r'ws/room/(?P<room_code>\w+)/$', consumers.GameConsumer.as_asgi()),
    re_path(r'ws/notifications/$', NotificationConsumer.as_asgi()),
]
