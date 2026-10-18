from django.http import HttpResponse
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from fleet.access import role_of
from fleet.engine import months_between
from fleet.pdf_report import build_pdf
from fleet.reports import build_report


class ReportPdfView(APIView):
    """GET /api/reports/pdf/?from=YYYY-MM&to=YYYY-MM[&vehicle=<id>] -> downloadable PDF. Owner only."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if role_of(request.user) != "owner":
            raise PermissionDenied("Owner only.")
        start = request.query_params.get("from", "")
        end = request.query_params.get("to", "")
        if len(start) != 7 or len(end) != 7 or start > end:
            return Response({"detail": "Use from=YYYY-MM and to=YYYY-MM, with from before to."}, status=400)
        if len(months_between(start, end)) > 36:
            return Response({"detail": "Choose 36 months or fewer."}, status=400)
        vid = request.query_params.get("vehicle")
        vehicle_id = int(vid) if vid and vid.isdigit() else None
        data = build_report(request.user, start, end, vehicle_id)
        pdf = build_pdf(data)
        name = f"ripoti_{start}_{end}.pdf"
        resp = HttpResponse(pdf, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="{name}"'
        return resp
