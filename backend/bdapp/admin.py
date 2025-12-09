from django.contrib import admin

from django.contrib import admin

from .models import sequence_desc
from .models import sequence_tb
from .models import interpretation
from .models import algorithm


@admin.register(sequence_tb)
class SequenceTbAdmin(admin.ModelAdmin):
    # Определяем порядок полей в форме добавления
    fields = ('M_ID', 'Interp_ID', 'Alg_ID', 'update_date_sequence_tb')
    readonly_fields = ('update_date_sequence_tb',)

admin.site.register(sequence_desc)
admin.site.register(interpretation)
admin.site.register(algorithm)
