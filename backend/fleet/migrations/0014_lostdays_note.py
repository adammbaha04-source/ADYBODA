from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("fleet", "0013_tyre_retired_on"),
    ]

    operations = [
        migrations.AddField(
            model_name="lostdays",
            name="note",
            field=models.CharField(blank=True, default="", max_length=300),
        ),
    ]
