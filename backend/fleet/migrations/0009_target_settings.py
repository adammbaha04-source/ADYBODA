import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fleet', '0008_return_week_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='vehicle',
            name='active_days',
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='vehicle',
            name='income_start',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='vehicle',
            name='income_end',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='WeekSetting',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('month', models.CharField(max_length=7)),
                ('week_number', models.PositiveSmallIntegerField()),
                ('active_days', models.JSONField(blank=True, null=True)),
                ('target', models.PositiveIntegerField(blank=True, null=True)),
                ('vehicle', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='week_settings', to='fleet.vehicle')),
            ],
            options={
                'unique_together': {('vehicle', 'month', 'week_number')},
            },
        ),
    ]
