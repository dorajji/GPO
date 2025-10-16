from django.urls import path, re_path
from django.conf import settings
from django.conf.urls.static import static
from . import views

app_name = 'bdapp'

urlpatterns = [
    path('', views.show),
    path('home', views.show),
    path('search', views.search_sequence),
    path('search_interp', views.search_InterpSelect),
    path('solve', views.solve),
    path('search_seq', views.search_SeqSelect),
    path('interp', views.interp_Select),
    path('alg', views.alg_Select),
    path('algDetails', views.alg_SelectDetails),
    path('checkDate', views.check_date),
    path('main', views.main_view, name='main'),
    path('404', views.not_found_view, name='not_found'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns.append(re_path(r'^.*$', views.not_found_view))