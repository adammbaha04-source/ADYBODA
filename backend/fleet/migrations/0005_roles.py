from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("fleet", "0004_personalexpense"),
    ]

    operations = [
        migrations.AddField(model_name="return", name="confirmed_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="manualledgerentry", name="confirmed_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="paymentrecord", name="confirmed_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.CreateModel(
            name="Membership",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("manager", "Manager"), ("driver", "Driver")], max_length=10)),
                ("phone", models.CharField(blank=True, max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("business_owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="team", to=settings.AUTH_USER_MODEL)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="membership", to=settings.AUTH_USER_MODEL)),
                ("vehicles", models.ManyToManyField(blank=True, related_name="members", to="fleet.vehicle")),
            ],
        ),
    ]
