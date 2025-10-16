from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static



urlpatterns = [
    path('ckeditor5/', include('django_ckeditor_5.urls')),
    path('admin/', admin.site.urls),
    path('', include('bdapp.urls', namespace = 'bdapp')),
]

# Обработчик для 404 страницы
handler404 = 'bdapp.views.not_found_view'

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
