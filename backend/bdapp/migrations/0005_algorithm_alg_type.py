# Generated by Django 5.0.3 on 2024-11-28 11:28

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bdapp', '0004_algorithm_parameters_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='algorithm',
            name='alg_type',
            field=models.CharField(choices=[('Listing', 'Listing'), ('Rank', 'Rank'), ('Unrank', 'Unrank')], default='Listing', max_length=10),
        ),
    ]
