from django.contrib import admin

from django.contrib import admin

from .models import sequence_desc
from .models import sequence_tb
from .models import interpretation
from .models import algorithm

admin.site.register(sequence_desc)
admin.site.register(interpretation)
admin.site.register(algorithm)
admin.site.register(sequence_tb)
