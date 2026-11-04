from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("fleet", "0010_week_dates"),
    ]

    operations = [
        migrations.AddField(
            model_name="weeksetting",
            name="note",
            field=models.CharField(max_length=300, blank=True, default=""),
        ),
    ]
