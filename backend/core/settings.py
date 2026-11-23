from pathlib import Path
import os
import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.environ.get('DJANGO_DEBUG', '0') == '1'

_secret_key = os.environ.get('DJANGO_SECRET_KEY')
if not _secret_key:
    if DEBUG:
        _secret_key = 'dev-only-insecure-key-change-me'
    else:
        raise ImproperlyConfigured('DJANGO_SECRET_KEY is not set.')
SECRET_KEY = _secret_key

ALLOWED_HOSTS = [h for h in os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h]

INSTALLED_APPS = [
    'corsheaders',  # <--- MUHIMU KWA CORS
    'rest_framework',
    'rest_framework.authtoken',
    'fleet',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # <--- Lazima iwe juu kabisa
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# Database Configuration
DATABASES = {
    'default': dj_database_url.config(
        default='sqlite:///' + str(BASE_DIR / 'db.sqlite3'),
        conn_max_age=0,
        conn_health_checks=True,
    )
}
DATABASES['default']['DISABLE_SERVER_SIDE_CURSORS'] = True
DATABASES['default']['OPTIONS'] = {
    'connect_timeout': 10,
    'sslmode': 'require',
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # HSTS: browser itakumbuka kutumia https pekee kwa mwaka mzima.
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SESSION_COOKIE_HTTPONLY = True

# CORS: ni app yako tu (adyboda.pages.dev) inayoruhusiwa kuongea na API hii.
# Ukiongeza domain nyingine baadaye, iweke kwenye CORS_EXTRA_ORIGINS (Render > Environment), zitenganishe kwa koma.
CORS_ALLOWED_ORIGINS = [
    "https://adyboda.pages.dev",
    "http://localhost:5173",
] + [o.strip() for o in os.environ.get('CORS_EXTRA_ORIGINS', '').split(',') if o.strip()]
# Toleo la majaribio la Cloudflare (mfano abc123.adyboda.pages.dev)
CORS_ALLOWED_ORIGIN_REGEXES = [r"^https://[a-z0-9-]+\.adyboda\.pages\.dev$"]
# App inatumia Token kwenye header, haihitaji cookies, kwa hiyo credentials zimezimwa.
CORS_ALLOW_CREDENTIALS = False
# Frontend inatuma header ya Cache-Control, hivyo lazima iruhusiwe kwenye preflight
CORS_ALLOW_HEADERS = list(default_headers) + ["cache-control"]

CSRF_TRUSTED_ORIGINS = [
    "https://adybajaj-api.onrender.com",
    "https://adyboda.pages.dev",
]

REST_FRAMEWORK = {
    # Token pekee: bila cookies hakuna mlango wa CSRF kwenye API.
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": None,
    # Kinga dhidi ya kubahatisha nenosiri (login/register) na matumizi kupita kiasi.
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "30/min",
        "user": "600/min",
    },
}
