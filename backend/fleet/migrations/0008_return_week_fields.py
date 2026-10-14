from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("fleet", "0007_business_name")]

    operations = [
        migrations.AddField(model_name="return", name="record_month", field=models.CharField(blank=True, max_length=7)),
        migrations.AddField(model_name="return", name="week_number", field=models.PositiveSmallIntegerField(blank=True, null=True)),
        migrations.AddField(model_name="return", name="period_start", field=models.DateField(blank=True, null=True)),
        migrations.AddField(model_name="return", name="period_end", field=models.DateField(blank=True, null=True)),
        migrations.AddField(model_name="return", name="note", field=models.CharField(blank=True, max_length=200)),
    ]
