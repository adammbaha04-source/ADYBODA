from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("fleet", "0014_lostdays_note"),
    ]

    operations = [
        migrations.AddField(
            model_name="vehicle",
            name="debt_limit",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
