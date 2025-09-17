from django.http import HttpResponse
from django.http import JsonResponse
from django.utils.timezone import localtime

from django.template import loader
from django.shortcuts import render
import psycopg2
import json
from django.db.models import Q

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
    query = request.GET.get('query', '').strip()
    
    # Если запрос пустой
    if not query:
        sequences = sequence_desc.objects.all()[:10]
        return JsonResponse([{
            'OEIS_ID': seq.OEIS_ID,
            'sequence_name': seq.sequence_name
        } for seq in sequences], safe=False)

    # Проверяем, является ли запрос OEIS ID
    import re
    oeis_pattern = re.compile(r'^[ABab]?\d{1,6}$', re.IGNORECASE)
    is_oeis_id = oeis_pattern.match(query)

    if is_oeis_id:
        # Нормализуем запрос для поиска
        normalized_query = query.upper()
        if not normalized_query.startswith('A') and not normalized_query.startswith('B'):
            normalized_query = 'A' + normalized_query

        # Сначала ищем точное совпадение
        sequences = sequence_desc.objects.filter(
            Q(OEIS_ID__iexact=normalized_query)
        )

        # Если найдено точное совпадение и это был OEIS ID запрос, сразу возвращаем результат
        if is_oeis_id and sequences.exists():
            results = []
            for seq in sequences:
                result_item = {
                    'OEIS_ID': seq.OEIS_ID,
                    'sequence_name': seq.sequence_name,
                    'matches': [] # В этом случае совпадения не отображаются под ссылкой
                }

                results.append(result_item)

            return JsonResponse(results, safe=False)

        # Если не нашли по точному совпадению ИЛИ это не был OEIS ID запрос, продолжаем поиск
        if not sequences.exists() or not is_oeis_id:
            # Вместо startswith используем icontains для поиска подстроки в OEIS_ID (только если это был OEIS ID запрос)
            if is_oeis_id:
                 sequences = sequence_desc.objects.filter(
                     Q(OEIS_ID__icontains=normalized_query)
                 )
            # Если это не был OEIS ID запрос, sequences уже содержит результаты поиска по имени/описанию

    else:
        # Если это не OEIS ID, ищем по другим полям
        sequences = sequence_desc.objects.filter(
            Q(sequence_name__icontains=query) |
            Q(sequence_description__icontains=query)
        )

    # Поиск по числовой последовательности
    if query.replace(',', '').replace(' ', '').isdigit():
        sequences_from_numbers = sequence_desc.objects.filter(
            Q(sequence_name__icontains=query) |
            Q(sequence_description__icontains=query)
        )
        sequences = sequences | sequences_from_numbers

    # Поиск по интерпретациям
    interpretations = interpretation.objects.filter(
        Q(interpretation_name__icontains=query) |
        Q(interpretation_description__icontains=query)
    )
    
    # Поиск по алгоритмам
    algorithms = algorithm.objects.filter(
        Q(alg_name__icontains=query) |
        Q(field_description__icontains=query) |
        Q(alg_code__icontains=query)
    )

    results = []
    seen_combinations = set()  # Для отслеживания уникальных комбинаций

    # Обрабатываем найденные интерпретации
    for interp in interpretations:
        # Находим все связанные последовательности через sequence_tb
        sequence_records = sequence_tb.objects.filter(Interp_ID=interp)
        
        for seq_record in sequence_records:
            sequence = seq_record.M_ID  # Получаем связанную последовательность
            
            # Создаем ключ для проверки уникальности
            combination_key = (sequence.OEIS_ID, 'interpretation', interp.Interp_ID)
            if combination_key in seen_combinations:
                continue
            seen_combinations.add(combination_key)

            # Формируем результат для этой интерпретации
            result = {
                'OEIS_ID': sequence.OEIS_ID,
                'sequence_name': sequence.sequence_name,
                'interpretation_name': interp.interpretation_name,
                'matches': []
            }

            # Добавляем совпадения в последовательности
            if query.lower() in sequence.sequence_name.lower():
                result['matches'].append({
                    'type': 'sequence_name',
                    'text': sequence.sequence_name
                })
            if query.lower() in sequence.sequence_description.lower():
                description = sequence.sequence_description.lower()
                query_lower = query.lower()
                start = description.find(query_lower)
                if start != -1:
                    context_start = max(0, start - 50)
                    context_end = min(len(description), start + len(query) + 50)
                    context = sequence.sequence_description[context_start:context_end]
                    if context_start > 0:
                        context = '...' + context
                    if context_end < len(description):
                        context = context + '...'
                    result['matches'].append({
                        'type': 'sequence_description',
                        'text': context
                    })

            # Добавляем совпадения в интерпретации
            if query.lower() in interp.interpretation_name.lower():
                result['matches'].append({
                    'type': 'interpretation_name',
                    'text': interp.interpretation_name
                })
            if query.lower() in interp.interpretation_description.lower():
                description = interp.interpretation_description.lower()
                query_lower = query.lower()
                start = description.find(query_lower)
                if start != -1:
                    context_start = max(0, start - 50)
                    context_end = min(len(description), start + len(query) + 50)
                    context = interp.interpretation_description[context_start:context_end]
                    if context_start > 0:
                        context = '...' + context
                    if context_end < len(description):
                        context = context + '...'
                    result['matches'].append({
                        'type': 'interpretation_description',
                        'text': context
                    })

            results.append(result)

    # Обрабатываем найденные алгоритмы
    for alg in algorithms:
        # Находим все связанные последовательности через sequence_tb
        sequence_records = sequence_tb.objects.filter(Alg_ID=alg)
        
        for seq_record in sequence_records:
            sequence = seq_record.M_ID  # Получаем связанную последовательность
            interp = seq_record.Interp_ID  # Получаем связанную интерпретацию
            
            # Создаем ключ для проверки уникальности
            combination_key = (sequence.OEIS_ID, 'algorithm', alg.Alg_ID)
            if combination_key in seen_combinations:
                continue
            seen_combinations.add(combination_key)

            # Формируем результат для этого алгоритма
            result = {
                'OEIS_ID': sequence.OEIS_ID,
                'sequence_name': sequence.sequence_name,
                'algorithm_name': alg.alg_name,
                'interpretation_name': interp.interpretation_name,  # Добавляем название интерпретации
                'matches': []
            }

            # Добавляем совпадения в последовательности
            if query.lower() in sequence.sequence_name.lower():
                result['matches'].append({
                    'type': 'sequence_name',
                    'text': sequence.sequence_name
                })
            if query.lower() in sequence.sequence_description.lower():
                description = sequence.sequence_description.lower()
                query_lower = query.lower()
                start = description.find(query_lower)
                if start != -1:
                    context_start = max(0, start - 50)
                    context_end = min(len(description), start + len(query) + 50)
                    context = sequence.sequence_description[context_start:context_end]
                    if context_start > 0:
                        context = '...' + context
                    if context_end < len(description):
                        context = context + '...'
                    result['matches'].append({
                        'type': 'sequence_description',
                        'text': context
                    })

            # Добавляем совпадения в алгоритме
            if query.lower() in alg.alg_name.lower():
                result['matches'].append({
                    'type': 'algorithm_name',
                    'text': alg.alg_name
                })
            if query.lower() in alg.field_description.lower():
                description = alg.field_description.lower()
                query_lower = query.lower()
                start = description.find(query_lower)
                if start != -1:
                    context_start = max(0, start - 50)
                    context_end = min(len(description), start + len(query) + 50)
                    context = alg.field_description[context_start:context_end]
                    if context_start > 0:
                        context = '...' + context
                    if context_end < len(description):
                        context = context + '...'
                    result['matches'].append({
                        'type': 'algorithm_description',
                        'text': context
                    })

            results.append(result)

    # Добавляем последовательности, найденные по OEIS ID, в результирующий список
    oeis_id_results = []
    for seq in sequences:
         oeis_id_results.append({
             'OEIS_ID': seq.OEIS_ID,
             'sequence_name': seq.sequence_name,
             'matches': [] # Совпадения будут добавлены позже, если они есть в других полях
         })

    # Очищаем 'sequences', чтобы не обрабатывать их повторно как запасной вариант
    sequences = []

    # Теперь добавляем результаты из поиска OEIS ID в общий список results
    # Убедимся, что не добавляем дубликаты, если они уже были найдены через интерпретации/алгоритмы
    for oeis_result in oeis_id_results:
        is_duplicate = any(res['OEIS_ID'] == oeis_result['OEIS_ID'] for res in results)
        if not is_duplicate:
            results.append(oeis_result)

    # Поиск по последовательностям (если нет результатов в интерпретациях и алгоритмах)
    if not results and not is_oeis_id:
        sequences = sequence_desc.objects.filter(
            Q(sequence_name__icontains=query) |
            Q(sequence_description__icontains=query)
        )

        for seq in sequences:
            result = {
                'OEIS_ID': seq.OEIS_ID,
                'sequence_name': seq.sequence_name,
                'matches': []
            }

            if query.lower() in seq.sequence_name.lower():
                result['matches'].append({
                    'type': 'sequence_name',
                    'text': seq.sequence_name
                })
            if query.lower() in seq.sequence_description.lower():
                description = seq.sequence_description.lower()
                query_lower = query.lower()
                start = description.find(query_lower)
                if start != -1:
                    context_start = max(0, start - 50)
                    context_end = min(len(description), start + len(query) + 50)
                    context = seq.sequence_description[context_start:context_end]
                    if context_start > 0:
                        context = '...' + context
                    if context_end < len(description):
                        context = context + '...'
                    result['matches'].append({
                        'type': 'sequence_description',
                        'text': context
                    })

            results.append(result)

    return JsonResponse(results, safe=False)


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

# Страница 404 с сохранением шапки и подвала
def not_found_view(request, exception=None):
    return render(request, '404.html', status=404)