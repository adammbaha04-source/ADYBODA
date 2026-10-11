from rest_framework.routers import DefaultRouter
from fleet import views

router = DefaultRouter()
router.register("vehicles", views.VehicleViewSet, basename="vehicle")
router.register("driver-periods", views.DriverPeriodViewSet, basename="driver-period")
router.register("returns", views.ReturnViewSet, basename="return")
router.register("lost-days", views.LostDaysViewSet, basename="lost-days")
router.register("manual-entries", views.ManualLedgerViewSet, basename="manual-entry")
urlpatterns = router.urls
