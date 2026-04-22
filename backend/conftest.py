import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    """Czyści cache przed każdym testem, żeby throttle nie blokował testów."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def channel_layers(settings):
    """Override channel layer with in-memory backend for tests."""
    settings.CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        }
    }
