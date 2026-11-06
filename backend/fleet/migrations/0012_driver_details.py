from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("fleet", "0011_week_note"),
    ]

    operations = [
        migrations.AddField(
            model_name="driverperiod",
            name="email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AddField(
            model_name="driverperiod",
            name="residence",
            field=models.CharField(blank=True, default="", max_length=160),
        ),
        migrations.AddField(
            model_name="driverperiod",
            name="guarantor_name",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="driverperiod",
            name="guarantor_phone",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="driverperiod",
            name="reason",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
    ]
