from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_friendship'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='avatar',
            field=models.CharField(default='fox', max_length=20),
        ),
        migrations.CreateModel(
            name='Achievement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50)),
                ('description', models.TextField()),
                ('icon', models.CharField(max_length=10)),
                ('condition_type', models.CharField(
                    max_length=30,
                    choices=[
                        ('first_blood', 'First Blood'),
                        ('perfect_round', 'Perfect Round'),
                        ('hot_streak_5', 'Hot Streak 5'),
                        ('hot_streak_10', 'Hot Streak 10'),
                        ('hot_streak_20', 'Hot Streak 20'),
                        ('veteran', 'Veteran'),
                        ('addict', 'Addict'),
                        ('social_butterfly', 'Social Butterfly'),
                        ('speed_demon', 'Speed Demon'),
                        ('comeback_king', 'Comeback King'),
                    ],
                    unique=True,
                )),
            ],
            options={'db_table': 'achievements'},
        ),
        migrations.CreateModel(
            name='UserAchievement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('unlocked_at', models.DateTimeField(auto_now_add=True)),
                ('achievement', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='user_achievements',
                    to='accounts.achievement',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='achievements',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'user_achievements',
                'unique_together': {('user', 'achievement')},
            },
        ),
    ]
