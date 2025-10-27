from rest_framework import generics
from .serializers import RegisterSerializer, TelegramUserSerializer, TrainingChannelSerializer
from .models import TelegramUser, TrainingChannel
from django.contrib.auth.models import User
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .serializers import ProcessedUserSerializer
from django.db.models import Q, Count, Sum, Case, When, IntegerField
from django.db.models.functions import TruncDay, TruncHour
from django.utils import timezone



class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
        })

class TelegramUserCreateView(generics.CreateAPIView):
    queryset = TelegramUser.objects.all()
    serializer_class = TelegramUserSerializer

class TrainingChannelCreateView(generics.CreateAPIView):
    queryset = TrainingChannel.objects.all()
    serializer_class = TrainingChannelSerializer

class TrainingChannelListView(generics.ListAPIView):
    queryset = TrainingChannel.objects.all()
    serializer_class = TrainingChannelSerializer

class TrainingChannelDeleteView(generics.DestroyAPIView):
    queryset = TrainingChannel.objects.all()
    lookup_field = 'id'

class TrainingChannelToggleActiveView(APIView):
    def post(self, request, id):
        try:
            channel = TrainingChannel.objects.get(id=id)
            channel.is_active = not channel.is_active
            channel.save()
            return Response({"status": "ok", "is_active": channel.is_active})
        except TrainingChannel.DoesNotExist:
            return Response({"error": "Channel not found"}, status=404)
        

class ProcessedUsersListView(generics.ListAPIView):
    """
    GET /api/processed-users/
      ?only_processed=true|false    (по умолчанию true)
      &invite_status=pending|success|failed
      &message_status=pending|sent|failed
      &q=<строка поиска>
      &page=<номер>                 (если включена пагинация DRF)
      &ordering=field|-field        (по умолчанию -id)
    """
    serializer_class = ProcessedUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = TelegramUser.objects.filter(owner=self.request.user)

        only_processed = (self.request.GET.get("only_processed", "true").lower() != "false")
        if only_processed:
            qs = qs.filter(
                Q(invite_status__in=["success", "failed"]) |
                Q(message_status__in=["sent", "failed"])
            )

        inv = self.request.GET.get("invite_status")
        msg = self.request.GET.get("message_status")
        if inv:
            qs = qs.filter(invite_status=inv)
        if msg:
            qs = qs.filter(message_status=msg)

        q = self.request.GET.get("q")
        if q:
            qs = qs.filter(
                Q(username__icontains=q) |
                Q(name__icontains=q) |
                Q(phone__icontains=q) |
                Q(source_channel__icontains=q)
            )

        ordering = self.request.GET.get("ordering", "-id")
        return qs.order_by(ordering)
    

def _parse_dt(s):
    if not s: return None
    try:
        return timezone.make_aware(timezone.datetime.fromisoformat(s))
    except Exception:
        return None

def _apply_common_filters(qs, request):
    qs = qs.filter(owner=request.user)

    source = request.GET.get("source")
    if source:
        qs = qs.filter(source_channel=source)

    inv = request.GET.get("invite_status")
    if inv:
        qs = qs.filter(invite_status=inv)

    msg = request.GET.get("message_status")
    if msg:
        qs = qs.filter(message_status=msg)

    processed_by = request.GET.get("processed_by")
    if processed_by:
        qs = qs.filter(processed_by_id=processed_by)

    dt_from = _parse_dt(request.GET.get("from"))
    dt_to   = _parse_dt(request.GET.get("to"))

    only_processed = (request.GET.get("only_processed", "true").lower() != "false")
    date_field = "processed_at" if only_processed else "created_at"

    if dt_from:
        qs = qs.filter(**{f"{date_field}__gte": dt_from})
    if dt_to:
        qs = qs.filter(**{f"{date_field}__lte": dt_to})

    if only_processed:
        qs = qs.filter(
            Q(invite_status__in=["success", "failed"]) |
            Q(message_status__in=["sent", "failed"])
        )
    return qs


class ProcessedUsersStatsView(APIView):
    """
    GET /api/processed-users/stats/
      ?from=2025-10-01T00:00  &to=2025-10-25T23:59
      &source=@foo           &processed_by=12
      &invite_status=...     &message_status=...
      &only_processed=true   (по умолчанию)
    Возвращает: totals + matrix (invite×message) + by_source (топ источников).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        base = _apply_common_filters(TelegramUser.objects.all(), request)

        # Totals по статусам
        invite_counts = dict(base.values("invite_status").annotate(c=Count("id")).values_list("invite_status", "c"))
        message_counts = dict(base.values("message_status").annotate(c=Count("id")).values_list("message_status", "c"))
        failed_total = (invite_counts.get("failed", 0) + message_counts.get("failed", 0))

        # Матрица invite×message
        matrix_rows = base.values("invite_status", "message_status").annotate(c=Count("id"))
        matrix = {"pending":{}, "success":{}, "failed":{}}
        for row in matrix_rows:
            i, m, c = row["invite_status"], row["message_status"], row["c"]
            matrix.setdefault(i, {})[m] = c

        # Топ источников
        by_source_rows = base.values("source_channel").annotate(
            total=Count("id"),
            success=Sum(Case(When(invite_status="success", then=1), default=0, output_field=IntegerField())),
            sent=Sum(Case(When(message_status="sent", then=1), default=0, output_field=IntegerField())),
            failed=Sum(Case(
                When(invite_status="failed", then=1),
                When(message_status="failed", then=1),
                default=0, output_field=IntegerField()
            )),
        ).order_by("-total")[:20]
        by_source = []
        for r in by_source_rows:
            total = r["total"] or 0
            cr = ( (r["sent"] or 0) / total ) if total else 0
            by_source.append({
                "source_channel": r["source_channel"],
                "total": total,
                "sent": r["sent"] or 0,
                "success": r["success"] or 0,
                "failed": r["failed"] or 0,
                "cr": round(cr, 4),
            })

        return Response({
            "total": base.count(),
            "invite": {
                "pending": invite_counts.get("pending", 0),
                "success": invite_counts.get("success", 0),
                "failed": invite_counts.get("failed", 0),
            },
            "message": {
                "pending": message_counts.get("pending", 0),
                "sent": message_counts.get("sent", 0),
                "failed": message_counts.get("failed", 0),
            },
            "failed": failed_total,
            "matrix": matrix,
            "by_source": by_source,
        })
    

class ProcessedUsersTimeSeriesView(APIView):
    """
    GET /api/processed-users/stats/timeseries/
      ?from=...&to=...&group_by=hour|day (default=day)
      + те же фильтры, что в stats (source, processed_by, only_processed...)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        group_by = request.GET.get("group_by", "day")
        trunc = TruncHour if group_by == "hour" else TruncDay

        base = _apply_common_filters(TelegramUser.objects.all(), request)

        # Готовим 5 серий по своим временным полям
        def agg(qs, field, extra_filter=None):
            qs2 = qs
            if extra_filter:
                qs2 = qs2.filter(**extra_filter)
            return qs2.exclude(**{f"{field}__isnull": True}).annotate(ts=trunc(field)).values("ts").annotate(
                c=Count("id")
            ).values("ts", "c")

        s_inv_succ = agg(base, "invite_changed_at",  {"invite_status":"success"})
        s_inv_fail = agg(base, "invite_changed_at",  {"invite_status":"failed"})
        s_msg_sent = agg(base, "message_changed_at", {"message_status":"sent"})
        s_msg_fail = agg(base, "message_changed_at", {"message_status":"failed"})
        s_processed = agg(base, "processed_at")

        # Сводим в одну шкалу
        bucket = {}
        for q in (s_inv_succ, s_inv_fail, s_msg_sent, s_msg_fail, s_processed):
            for row in q:
                ts = row["ts"]
                key = ts.isoformat()
                d = bucket.setdefault(key, {"ts": key, "invite_success":0,"invite_failed":0,"message_sent":0,"message_failed":0,"processed":0})
                # определяем по ссылке набора
        for row in s_inv_succ:   bucket[row["ts"].isoformat()]["invite_success"] += row["c"]
        for row in s_inv_fail:    bucket[row["ts"].isoformat()]["invite_failed"]  += row["c"]
        for row in s_msg_sent:    bucket[row["ts"].isoformat()]["message_sent"]   += row["c"]
        for row in s_msg_fail:    bucket[row["ts"].isoformat()]["message_failed"] += row["c"]
        for row in s_processed:   bucket[row["ts"].isoformat()]["processed"]      += row["c"]

        points = sorted(bucket.values(), key=lambda x: x["ts"])
        return Response({ "group_by": group_by, "points": points })


class ProcessedUsersTopSourcesView(APIView):
    """
    GET /api/processed-users/stats/top-sources/
      ?from=&to=&limit=20&order=-cr|-total|-sent|...
      + те же фильтры (only_processed, processed_by...)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        base = _apply_common_filters(TelegramUser.objects.all(), request)

        rows = base.values("source_channel").annotate(
            total=Count("id"),
            success=Sum(Case(When(invite_status="success", then=1), default=0, output_field=IntegerField())),
            sent=Sum(Case(When(message_status="sent", then=1), default=0, output_field=IntegerField())),
            failed=Sum(Case(
                When(invite_status="failed", then=1),
                When(message_status="failed", then=1),
                default=0, output_field=IntegerField()
            )),
        )

        order = request.GET.get("order", "-total")
        if order.lstrip("-") in {"total","success","sent","failed"}:
            rows = rows.order_by(order)
        else:
            rows = rows.order_by("-total")

        limit = int(request.GET.get("limit", 20))
        rows = rows[:max(1, min(limit, 200))]

        results = []
        for r in rows:
            total = r["total"] or 0
            cr = ((r["sent"] or 0) / total) if total else 0
            results.append({
                "source_channel": r["source_channel"],
                "total": total,
                "sent": r["sent"] or 0,
                "success": r["success"] or 0,
                "failed": r["failed"] or 0,
                "cr": round(cr, 4),
            })
        return Response({"results": results})


class ProcessedUsersTopAccountsView(APIView):
    """
    GET /api/processed-users/stats/top-accounts/
      ?from=&to=&limit=20&order=-total
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        base = _apply_common_filters(TelegramUser.objects.exclude(processed_by__isnull=True), request)

        rows = base.values("processed_by_id").annotate(
            total=Count("id"),
            sent=Sum(Case(When(message_status="sent", then=1), default=0, output_field=IntegerField())),
            success=Sum(Case(When(invite_status="success", then=1), default=0, output_field=IntegerField())),
            failed=Sum(Case(
                When(invite_status="failed", then=1),
                When(message_status="failed", then=1),
                default=0, output_field=IntegerField()
            )),
        ).order_by("-total")[:50]

        results = [{
            "account_id": r["processed_by_id"],
            "total": r["total"] or 0,
            "sent": r["sent"] or 0,
            "success": r["success"] or 0,
            "failed": r["failed"] or 0,
        } for r in rows]

        return Response({"results": results})
