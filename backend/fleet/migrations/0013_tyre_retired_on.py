from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("fleet", "0012_driver_details"),
    ]

    operations = [
        migrations.AddField(
            model_name="tyrerecord",
            name="retired_on",
            field=models.DateField(blank=True, null=True),
        ),
    ]
