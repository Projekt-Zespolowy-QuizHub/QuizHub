import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rooms', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='QuestionPack',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('is_public', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='question_packs',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'db_table': 'question_packs'},
        ),
        migrations.CreateModel(
            name='CustomQuestion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('question_text', models.TextField()),
                ('answers', models.JSONField()),
                ('correct_index', models.IntegerField()),
                ('image_emoji', models.CharField(blank=True, max_length=10)),
                ('pack', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='questions',
                    to='rooms.questionpack',
                )),
            ],
            options={'db_table': 'custom_questions'},
        ),
        migrations.AddField(
            model_name='room',
            name='pack',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='rooms',
                to='rooms.questionpack',
            ),
        ),
    ]
