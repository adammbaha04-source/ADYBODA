from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("fleet", "0006_profile_challenges")]

    operations = [
        migrations.AddField(model_name="userprofile", name="business_name", field=models.CharField(blank=True, max_length=120)),
    ]
