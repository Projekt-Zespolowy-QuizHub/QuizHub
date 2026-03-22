import time
from django.core.cache import cache
from rest_framework.throttling import SimpleRateThrottle


class AuthRateThrottle(SimpleRateThrottle):
    """5 requests/minute per IP — login i register (ochrona przed brute-force)."""

    scope = 'auth'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class WebSocketConnectThrottle:
    """
    10 prób połączenia WebSocket / minutę per IP.

    Użycie w consumers.py:
        throttle = WebSocketConnectThrottle()
        if not await throttle.is_allowed(self.scope):
            await self.close(code=4029)
            return
    """

    rate = 10
    period = 60  # sekundy

    async def is_allowed(self, scope) -> bool:
        client_ip = self._get_client_ip(scope)
        cache_key = f'ws_throttle_{client_ip}'
        now = time.time()

        history: list[float] = await cache.aget(cache_key, [])
        history = [t for t in history if now - t < self.period]

        if len(history) >= self.rate:
            return False

        history.append(now)
        await cache.aset(cache_key, history, self.period)
        return True

    @staticmethod
    def _get_client_ip(scope) -> str:
        headers = dict(scope.get('headers', []))
        forwarded_for = headers.get(b'x-forwarded-for', b'').decode()
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        client = scope.get('client')
        if client:
            return client[0]
        return 'unknown'
