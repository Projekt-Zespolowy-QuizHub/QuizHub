import pytest


@pytest.fixture
def channel_layers(settings):
    """Override channel layer with in-memory backend for tests."""
    settings.CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        }
    }
