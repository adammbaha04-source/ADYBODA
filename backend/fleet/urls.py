from django.urls import path
from rest_framework.routers import DefaultRouter
from fleet import views

router = DefaultRouter()
router.register("vehicles", views.VehicleViewSet, basename="vehicle")
router.register("driver-periods", views.DriverPeriodViewSet, basename="driver-period")
router.register("returns", views.ReturnViewSet, basename="return")
router.register("lost-days", views.LostDaysViewSet, basename="lost-days")
router.register("manual-entries", views.ManualLedgerViewSet, basename="manual-entry")
router.register("payment-records", views.PaymentRecordViewSet, basename="payment-record")
router.register("service-records", views.ServiceRecordViewSet, basename="service-record")
router.register("tyre-records", views.TyreRecordViewSet, basename="tyre-record")
router.register("insurance-records", views.InsuranceRecordViewSet, basename="insurance-record")
router.register("personal-expenses", views.PersonalExpenseViewSet, basename="personal-expense")
router.register("challenges", views.ChallengeViewSet, basename="challenge")
urlpatterns = router.urls + [path("expense-summary/", views.ExpenseSummaryView.as_view()), path("reports/", views.ReportView.as_view()), path("me/", views.MeProfileView.as_view()), path("challenges/", views.ChallengeViewSet.as_view({"get": "list", "post": "create"})), path("challenges/<int:pk>/solve/", views.ChallengeViewSet.as_view({"post": "solve"})), path("team/", views.TeamViewSet.as_view({"get": "list", "post": "create"})), path("team/<int:pk>/", views.TeamViewSet.as_view({"delete": "destroy"}))]
