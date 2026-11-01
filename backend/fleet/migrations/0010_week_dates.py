from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("fleet", "0009_target_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="weeksetting",
            name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="weeksetting",
            name="end_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
