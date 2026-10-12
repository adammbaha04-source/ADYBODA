from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("fleet", "0003_records"),
    ]

    operations = [
        migrations.CreateModel(
            name="PersonalExpense",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("day", models.DateField()),
                ("category", models.CharField(choices=[("binafsi", "Binafsi"), ("chakula", "Chakula"), ("ofisi", "Ofisi"), ("mgonjwa", "Mgonjwa"), ("hospitali", "Hospitali"), ("michango", "Michango"), ("vocha", "Vocha"), ("umeme", "Umeme"), ("maji", "Maji"), ("mavazi", "Mavazi"), ("mengineyo", "Mengineyo"), ("makato", "Makato")], max_length=20)),
                ("amount", models.PositiveIntegerField(default=0)),
                ("note", models.CharField(blank=True, max_length=200)),
                ("makato_type", models.CharField(blank=True, max_length=20)),
                ("transaction_amount", models.PositiveIntegerField(blank=True, null=True)),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="personal_expenses", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["day", "id"]},
        ),
    ]
