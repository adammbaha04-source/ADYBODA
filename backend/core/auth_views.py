from rest_framework.authtoken.views import ObtainAuthToken

from core.throttles import LoginThrottle


class LoginView(ObtainAuthToken):
    """Kuingia (token). Sasa ina kikomo cha majaribio kwa kila IP."""
    throttle_classes = [LoginThrottle]
