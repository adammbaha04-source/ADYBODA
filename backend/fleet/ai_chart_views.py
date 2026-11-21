from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from fleet.ai_service import ask_adyboda


class ChartView(APIView):
    """POST /api/ai/chart/ {"question": "..."}. Database tools are read-only and role-scoped."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        question = request.data.get("question")
        if not isinstance(question, str) or not question.strip():
            return Response({"detail": "Andika swali kwanza."}, status=status.HTTP_400_BAD_REQUEST)
        if len(question) > 2000:
            return Response({"detail": "Swali ni refu sana. Punguza hadi herufi 2,000."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return Response(ask_adyboda(request.user, question.strip()))
        except Exception as exc:
            from rest_framework.exceptions import APIException
            if isinstance(exc, APIException):
                return Response({"detail": str(exc.detail)}, status=exc.status_code)
            print("ADYBODA_AI_ERROR", type(exc).__name__, str(exc)[:300], flush=True)
            return Response({"detail": "Hitilafu imetokea wakati wa uchambuzi. Jaribu tena."}, status= status.HTTP_502_BAD_GATEWAY)
