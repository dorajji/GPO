from django.http import HttpResponse
from django.http import JsonResponse
from django.utils.timezone import localtime

from django.template import loader
from django.shortcuts import render
import psycopg2
import json

from bdapp.exceptions.ALG import AlgIsNotFoundException
from bdapp.exceptions.SolveException import SolveException
from bdapp.exceptions.Interpritation_Selector_ID import Interpritation_Selector_IDNotFoundException
from bdapp.exceptions.OEISID import OEIS_IDNotFoundException
from bdapp.exceptions.base import ApplicationException
from bdapp.models import sequence_desc
from bdapp.models import interpretation 
from bdapp.models import sequence_tb 
from bdapp.models import algorithm
from django.http import HttpResponseBadRequest
from threading import Timer
import asyncio
import pytz


def show(request): #Заглушка, чтобы загружать стартову страницу
    template = loader.get_template('index.html')
    context = {}
    rendered_page = template.render(context, request)
    return HttpResponse(rendered_page)

def check_date(request):
    try:
        # Получение времени последнего обновления из всех моделей
        sequence_desc_time = sequence_desc.objects.latest('update_date_sequence_desc').update_date_sequence_desc
        sequence_tb_time = sequence_tb.objects.latest('update_date_sequence_tb').update_date_sequence_tb
        interpretation_time = interpretation.objects.latest('update_date_interpretation').update_date_interpretation
        algorithm_time = algorithm.objects.latest('update_date_algorithm').update_date_algorithm

        # Находим максимальное время среди всех обновлений
        latest_time = max(sequence_desc_time, sequence_tb_time, interpretation_time, algorithm_time)
        latest_time_local = localtime(latest_time, timezone=pytz.timezone('Asia/Tomsk'))  # Преобразуем в локальное время

        return JsonResponse({
            'last_update': latest_time_local.strftime('%d-%m-%Y %H:%M:%S')
        })
    except Exception as e:
        print(e)
        return JsonResponse({'error': str(e)}, status=500)


def search_sequence(request): 
    try:
        list_seq = []
        oeis_id = request.GET.get('oeis_id')
        news = sequence_desc.objects.filter(OEIS_ID=oeis_id).first()
        if news:
            list_seq.append({
                'OEIS_ID': news.OEIS_ID,  
                'sequence_description' : news.sequence_description
               })
            return JsonResponse(list_seq, safe=False)
        else:
            raise OEIS_IDNotFoundException(oeis_id=oeis_id)

    except ApplicationException as exception:
        return HttpResponseBadRequest(content=exception.message)

def search_InterpSelect(request): 
    try:
        list_interp = []
        oeis_id = request.GET.get('oeis_id')
        news = sequence_desc.objects.filter(OEIS_ID=oeis_id)

        if news:
            m_id = news[0].M_ID
            sequence_records = sequence_tb.objects.filter(M_ID=m_id)

            for record in sequence_records:
                interpretation_instance = record.Interp_ID
                list_interp.append({
                    'Interp_ID': interpretation_instance.Interp_ID,  
                    'interpretation_name' : interpretation_instance.interpretation_name,
                    'interpretation_description' : interpretation_instance.interpretation_description
                })
            return JsonResponse(list_interp, safe=False)
        else:
            raise OEIS_IDNotFoundException(oeis_id=oeis_id)

    except ApplicationException as exception:
        return HttpResponseBadRequest(content=exception.message)
    
def search_SeqSelect(request):  
    data = list(sequence_desc.objects.values('OEIS_ID'))  
    return JsonResponse(data, safe=False)


def alg_Select(request):
    interp_id = request.GET.get('interp_id')  
    if not interp_id:
        return JsonResponse({"error": "interp_id is required"}, status=400)
    try:
        sequences = sequence_tb.objects.filter(Interp_ID=interp_id)
        algorithm_ids = []
        for seq in sequences:
            algorithmId = seq.Alg_ID.Alg_ID
            algorithm_ids.append(algorithmId)
        algorithms = algorithm.objects.filter(Alg_ID__in=algorithm_ids)
        algorithms_data = [
            {
                'Alg_ID': alg.Alg_ID,
                'alg_name': alg.alg_name,
            }
            for alg in algorithms
        ]
        return JsonResponse(algorithms_data, safe=False)
    except Exception as e:
        print(e)
        return JsonResponse({"error": str(e)}, status=500)

def alg_SelectDetails(request):
    algName = request.GET.get('algName') 
    if not algName:
        return JsonResponse({"error": "В селекторе ничего не заполнено"}, status=400)
    
    try:
        news = algorithm.objects.filter(alg_name=algName)  
        algorithms_list = [
            {
                'Alg_ID': alg.Alg_ID,
                'alg_type': alg.alg_type,
                'alg_name': alg.alg_name,
                'number_of_parameters': alg.number_of_parameters,
                'parameters_name': alg.parameters_name,
                'field_name' : alg.field_name,
                'field_description' : alg.field_description,
                'alg_code' : alg.alg_code,
            }
            for alg in news
        ]

        return JsonResponse(algorithms_list, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)   

def interp_Select(request): 
    try:
        interpretation_name = request.GET.get('interpretation_name')  
        news = interpretation.objects.filter(interpretation_name=interpretation_name)  

        if news.exists():  
            interpretations_list = [
                {
                    'id': interp.Interp_ID,
                    'interpretation_description' : interp.interpretation_description
                }
                for interp in news
            ]
            return JsonResponse(interpretations_list, safe=False)  
        else:
            raise Interpritation_Selector_IDNotFoundException(interpretation_id="")
    except ApplicationException as exception:
        return HttpResponseBadRequest(content=exception.message)
    
import asyncio
from django.http import JsonResponse
from asgiref.sync import sync_to_async
import json

async def execute_with_timeout(code, params, number_of_params, alg_type):
    try:
        globals_dict = globals()
        exec(code, globals_dict)  

        n = int(params.get('param1')) if params.get('param1') else None
        k = int(params.get('param2')) if params.get('param2') else None
        m = int(params.get('param3')) if params.get('param3') else None
        combObject = params.get('combObject') if params.get('combObject') else None
        rank = int(params.get('Rank')) if params.get('Rank') else None
        if alg_type == 'Listing':
            if number_of_params == 1:
                result = await asyncio.to_thread(globals_dict['Start'], n)
            elif number_of_params == 2:
                result = await asyncio.to_thread(globals_dict['Start'], n, k)
            elif number_of_params == 3:
                result = await asyncio.to_thread(globals_dict['Start'], n, k, m)
        elif alg_type == 'Rank':
            if number_of_params == 1:
                result = await asyncio.to_thread(globals_dict['Start'], n, combObject)
            elif number_of_params == 2:
                result = await asyncio.to_thread(globals_dict['Start'], n, k, combObject)
            elif number_of_params == 3:
                result = await asyncio.to_thread(globals_dict['Start'], n, k, m, combObject)
        elif alg_type == 'Unrank':
            if number_of_params == 1:
                result = await asyncio.to_thread(globals_dict['Start'], n, rank)
            elif number_of_params == 2:
                result = await asyncio.to_thread(globals_dict['Start'], n, k, rank)
            elif number_of_params == 3:
                result = await asyncio.to_thread(globals_dict['Start'], n, k, m, rank)
        else:
            result = 'Некорректное количество параметров'
        return result
    except Exception as e:
        return f"Ошибка выполнения: {str(e)}"


async def solve(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)

            alg_id = data.get('alg_id')
            params = data.get('params')
            
            news = await sync_to_async(list)(algorithm.objects.filter(Alg_ID=alg_id))
            if news:
                alg_code = news[0].alg_code
                number_of_params = news[0].number_of_parameters
                alg_type = news[0].alg_type
                try:
                    result = await asyncio.wait_for(
                        execute_with_timeout(alg_code, params, number_of_params, alg_type),
                        timeout=20
                    )
                    return JsonResponse(result, safe=False)
                except asyncio.TimeoutError:
                    return JsonResponse(
                        'Превышено время ожидания вычисления. Попробуйте уменьшить параметры.',
                        safe=False,
                    )
            else:
                return JsonResponse('Код не найден', safe=False)
        except Exception as e:
            return JsonResponse(
                f"Произошла ошибка: {str(e)}", safe=False, status=500
            )
    else:
        return JsonResponse({'error': 'Only POST requests are allowed'}, status=405)


def main_view(request):
    return render(request, 'main.html')
