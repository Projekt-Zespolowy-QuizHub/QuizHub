import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('rooms', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Challenge',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(
                    choices=[('pending', 'Oczekuje'), ('accepted', 'Zaakceptowane'), ('declined', 'Odrzucone')],
                    default='pending',
                    max_length=10,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('from_user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sent_challenges',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('to_user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='received_challenges',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('room', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='challenges',
                    to='rooms.room',
                )),
            ],
            options={'db_table': 'challenges'},
        ),
    ]
