from django.urls import path, re_path
from . import views

app_name = 'bdapp'

urlpatterns = [
    path('',views.show),
    path('home',views.show), # Дом
    path('search',views.search_sequence), # Поиск по OEIS ID
    path('search_interp',views.search_InterpSelect), 
    path('solve',views.solve),
    path('search_seq',views.search_SeqSelect),  #Для вывода списка последовательностей на стартовой странице
    path('interp',views.interp_Select),
    path('alg',views.alg_Select),
    path('algDetails',views.alg_SelectDetails),
    path('checkDate',views.check_date),
    path('main', views.main_view, name='main'),
    path('404', views.not_found_view, name='not_found'),
    # Catch-all for unknown paths to show branded 404 page even with DEBUG=True
    re_path(r'^.*$', views.not_found_view),
]
    