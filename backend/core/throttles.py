from rest_framework.throttling import AnonRateThrottle


class LoginThrottle(AnonRateThrottle):
    """Majaribio ya kuingia: kikomo kwa kila IP (kiwango kiko kwenye settings: 'login')."""
    scope = "login"


class RegisterThrottle(AnonRateThrottle):
    """Usajili wa owner mpya: kikomo kwa kila IP (kiwango kiko kwenye settings: 'register')."""
    scope = "register"
