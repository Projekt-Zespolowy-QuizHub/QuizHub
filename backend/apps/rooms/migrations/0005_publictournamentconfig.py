from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rooms', '0004_answer_streak_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='PublicTournamentConfig',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('interval_minutes', models.IntegerField(default=30, help_text='Co ile minut tworzony jest nowy turniej publiczny')),
                ('max_players', models.IntegerField(default=16, help_text='Maksymalna liczba graczy w turnieju publicznym')),
                ('is_enabled', models.BooleanField(default=True, help_text='Czy scheduler automatycznie tworzy turnieje publiczne')),
            ],
            options={
                'verbose_name': 'Konfiguracja turnieju publicznego',
                'verbose_name_plural': 'Konfiguracja turniejów publicznych',
                'db_table': 'public_tournament_config',
            },
        ),
    ]
