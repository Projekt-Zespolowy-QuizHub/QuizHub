from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """Session auth bez wymuszania CSRF — bezpieczne bo API jest proxowane przez Next.js (same-origin)."""

    def enforce_csrf(self, request):
        return  # Skip CSRF check
