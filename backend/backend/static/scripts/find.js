async function executeSearchQuery() {
    const query = document.querySelector('.find__input').value.trim();

    if (query) {
        // Проверяем, является ли запрос числовой последовательностью
        const isSequence = /^\d+(?:\s*,\s*\d+)*$/.test(query);
        // Строгая проверка на полный OEIS ID
        const isOEIS = /^[ABab]?\d{1,6}$/i.test(query);
        // Нестрогая проверка на потенциальный частичный OEIS ID (цифры с опциональной A/B)
        const isPotentialPartialOEIS = /^[ABab]?\d+$/i.test(query) || /^\d+$/.test(query);
        
        if (isSequence) {
            // Если это числовая последовательность, перенаправляем на OEIS
            const searchSequence = query.replace(/\s+/g, '');
            const url = `https://oeis.org/search?q=${encodeURIComponent(searchSequence)}&language=russian&go=Поиск`;
            window.location.href = url;
            return;
        }
        
        // Если запрос выглядит как полный OEIS ID (строгий формат)
        if (isOEIS) {
            try {
                // Попытка найти точное совпадение OEIS ID через search_SeqSelect
                let searchQueryForLookup = query.toUpperCase();
                if (!searchQueryForLookup.startsWith('A') && !searchQueryForLookup.startsWith('B')) {
                    searchQueryForLookup = 'A' + searchQueryForLookup;
                }
                const lookupResponse = await fetch(`/search_SeqSelect?query=${encodeURIComponent(searchQueryForLookup)}`);

                if (!lookupResponse.ok) {
                     throw new Error('Ошибка при выполнении запроса к эндпоинту search_SeqSelect.');
                }

                const lookupResults = await lookupResponse.json();

                // Если найдено ровно одно совпадение, считаем это точным совпадением OEIS ID
                if (lookupResults && lookupResults.length === 1) {
                     // Перенаправляем на страницу конкретной последовательности
                     window.location.href = `/main?find=${encodeURIComponent(lookupResults[0].OEIS_ID)}`;
                     return;
                } else {
                    // Если не найдено точное совпадение, но запрос был в строгом OEIS формате,
                    // переходим к общему поиску без фрагментов текста.
                    // Выполняется ниже после этого блока if(isOEIS).
                     console.log(`Не найдено точное совпадение для OEIS ID: ${query}. Выполнение общего поиска.`);
                }

            } catch (error) {
                 console.error('Произошла ошибка при поиске точного OEIS ID:', error);
                 // В случае ошибки при поиске точного ID, также переходим к общему поиску.
            }
        }
        
        // Если запрос выглядит как потенциальный частичный OEIS ID ИЛИ
        // если запрос был в строгом OEIS формате, но не дал точного совпадения:
        if (isPotentialPartialOEIS || (isOEIS && (!lookupResults || lookupResults.length !== 1))) {
             try {
                // Используем общий поиск для частичных совпадений OEIS ID или для OEIS ID без точного совпадения
                const response = await fetch(`/search_seq?query=${encodeURIComponent(query)}`);
                if (!response.ok) {
                    throw new Error('Ошибка при выполнении запроса к серверу.');
                }

                const searchResults = await response.json();

                // Если найден ровно один результат, перенаправляем на страницу последовательности
                if (searchResults && searchResults.length === 1) {
                     window.location.href = `/main?find=${encodeURIComponent(searchResults[0].OEIS_ID)}`;
                     return; // Важно выйти из функции после перенаправления
                } else if (searchResults && searchResults.length > 0) {
                    // Если найдено несколько результатов, отображаем их без фрагментов текста
                    displaySearchResults(searchResults, query, true);
                } else {
                    // Если результатов нет
                    noResults();
                }
            } catch (error) {
                console.error('Произошла ошибка при выполнении общего поиска:', error);
                noResults();
            }
            return; // Важно выйти из функции после обработки этого случая
        }

        // Обычный текстовый поиск (если не подошел ни один из вышеуказанных случаев)
        try {
            const response = await fetch(`/search_seq?query=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error('Ошибка при выполнении запроса к серверу.');
            }
            
            const searchResults = await response.json();
            
            if (searchResults && searchResults.length > 0) {
                displaySearchResults(searchResults, query); // Обычный поиск, фрагменты текста будут показаны
            } else {
                noResults();
            }
        } catch (error) {
            console.error('Произошла ошибка:', error);
            noResults();
        }
    } else {
        // Создаем контейнер для сообщения об ошибке
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'search-results';
        
        // Создаем заголовок
        const header = document.createElement('h3');
        header.textContent = 'Результаты поиска:';
        resultsContainer.appendChild(header);
        
        // Создаем сообщение об ошибке
        const errorMessage = document.createElement('div');
        errorMessage.className = 'search-results__error';
        errorMessage.textContent = 'Введите запрос для поиска!';
        
        resultsContainer.appendChild(errorMessage);
        
        // Удаляем предыдущие результаты поиска, если они есть
        const resultsRoot = document.getElementById('search-results-container');
        resultsRoot.innerHTML = '';
        resultsRoot.appendChild(resultsContainer);
    }
}

function displaySearchResults(results, searchQuery, isOEISSearch = false) {
    // Скрываем блок с гиперссылками
    const hrefBlock = document.querySelector('.home__find-href');
    if (hrefBlock) hrefBlock.style.display = 'none';

    // Создаем контейнер для результатов поиска
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'search-results';
    
    // Создаем заголовок
    const header = document.createElement('h3');
    header.textContent = 'Результаты поиска:';
    resultsContainer.appendChild(header);

    // Функция для создания блока результатов определенного типа
    function createResultsBlock(type, results) {
        if (results.length === 0) return null;

        const block = document.createElement('div');
        block.className = 'search-results__block';
        
        const blockHeader = document.createElement('h4');
        blockHeader.className = 'search-results__block-header';
        blockHeader.textContent = getBlockTitle(type);
        block.appendChild(blockHeader);

        const resultsList = document.createElement('ul');
        resultsList.className = 'search-results__list';

        results.forEach(result => {
            const listItem = document.createElement('li');
            listItem.className = 'search-results__item';
            const resultContent = document.createElement('div');
            resultContent.className = 'search-result__content';
            // Ссылка: OEIS_ID
            const linkLine = document.createElement('div');
            linkLine.className = 'search-result__link-block';
            const link = document.createElement('a');
            link.href = `/main?find=${encodeURIComponent(result.OEIS_ID)}`;
            link.textContent = `${result.OEIS_ID}`;
            link.className = 'search-result__link';
            linkLine.appendChild(link);

            // Определяем основное название: всегда пытаемся взять название алгоритма
            let mainNameText = '';
            if (result.algorithm_name) {
                mainNameText = result.algorithm_name;
            } else if (result.sequence_name) { // Если алгоритма нет, можно показать название последовательности как запасной вариант?
                 mainNameText = result.sequence_name;
            }

            if (mainNameText) {
                const nameSpan = document.createElement('span');
                nameSpan.className = 'search-result__sequence-name';
                nameSpan.textContent = ': ' + mainNameText;
                linkLine.appendChild(nameSpan);
            }

            // Добавляем название интерпретации и/или алгоритма в скобках на основе типов совпадений в result.matches
            const matchedTypesInResult = result.matches.map(match => match.type);
            let extraInfo = [];

            // Добавляем название интерпретации только если совпадение было в поле интерпретации для этого результата
            if (matchedTypesInResult.some(type => type === 'interpretation_name' || type === 'interpretation_description') && result.interpretation_name) {
                extraInfo.push(result.interpretation_name);
            }

            // Добавляем название алгоритма только если совпадение было в поле алгоритма для этого результата
            if (matchedTypesInResult.some(type => type === 'algorithm_name' || type === 'algorithm_description') && result.algorithm_name) {
                 extraInfo.push(result.algorithm_name);
            }

            if (extraInfo.length > 0) {
                const extraInfoSpan = document.createElement('span');
                extraInfoSpan.className = 'search-result__extra-info';
                extraInfoSpan.textContent = ' (' + extraInfo.join(', ') + ')';
                linkLine.appendChild(extraInfoSpan);
            }

            resultContent.appendChild(linkLine);
            
            // Показываем совпадения только если это не поиск по OEIS ID
            if (!isOEISSearch) {
                const relevantMatches = result.matches.filter(match => 
                    (type === 'sequence' && (match.type === 'sequence_name' || match.type === 'sequence_description')) ||
                    (type === 'interpretation' && (match.type === 'interpretation_name' || match.type === 'interpretation_description')) ||
                    (type === 'algorithm' && (match.type === 'algorithm_name' || match.type === 'algorithm_description'))
                );
                if (relevantMatches.length > 0) {
                    const matchesContainer = document.createElement('div');
                    matchesContainer.className = 'search-result__matches';
                    relevantMatches.forEach(match => {
                        const matchItem = document.createElement('div');
                        matchItem.className = 'search-result__match';
                        const matchType = document.createElement('span');
                        matchType.className = 'search-result__match-type';
                        matchType.textContent = getMatchTypeLabel(match.type);
                        matchItem.appendChild(matchType);
                        const matchText = document.createElement('span');
                        matchText.className = 'search-result__match-text';
                        let cleanText = extractCleanText(match.text);
                        let snippet = cleanText;
                        if (typeof searchQuery === 'string' && searchQuery.length > 0) {
                            snippet = extractContextSnippet(cleanText, searchQuery, 100);
                        }
                        matchText.textContent = snippet;
                        matchItem.appendChild(matchText);
                        matchesContainer.appendChild(matchItem);
                    });
                    resultContent.appendChild(matchesContainer);
                }
            }
            listItem.appendChild(resultContent);
            resultsList.appendChild(listItem);
        });
        block.appendChild(resultsList);
        return block;
    }

    // Добавляем блоки результатов в порядке: последовательность, интерпретация, алгоритм
    const sequenceBlock = createResultsBlock('sequence', results);
    if (sequenceBlock) resultsContainer.appendChild(sequenceBlock);

    // Добавляем блоки интерпретации и алгоритма только если это не поиск по OEIS ID
    if (!isOEISSearch) {
        const interpBlock = createResultsBlock('interpretation', results);
        if (interpBlock) resultsContainer.appendChild(interpBlock);

        const algBlock = createResultsBlock('algorithm', results);
        if (algBlock) resultsContainer.appendChild(algBlock);
    }
    
    // Удаляем предыдущие результаты поиска, если они есть
    const resultsRoot = document.getElementById('search-results-container');
    resultsRoot.innerHTML = '';
    resultsRoot.appendChild(resultsContainer);
}

function getBlockTitle(type) {
    const titles = {
        'sequence': 'Числовая последовательность',
        'interpretation': 'Комбинаторная интерпретация',
        'algorithm': 'Описание алгоритма'
    };
    return titles[type] || '';
}

function getMatchTypeLabel(type) {
    const labels = {
        'sequence_name': 'Название: ',
        'sequence_description': 'Описание: ',
        'algorithm_name': 'Алгоритм: ',
        'algorithm_description': 'Описание алгоритма: ',
        'interpretation_name': 'Интерпретация: ',
        'interpretation_description': 'Описание интерпретации: '
    };
    return labels[type] || '';
}

// Обновляем стили для результатов поиска
const style = document.createElement('style');
style.textContent = `
    .search-results {
        margin-top: 10px;
        padding: 15px;
        background: #fff;
        border-radius: 5px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        margin-left: auto;
        margin-right: auto;
    }
    
    .main__header-search-box {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .main__header-search-input {
        flex: 1;
        height: 40px;
        padding: 0 15px;
        border: 2px solid #3B388D;
        border-radius: 5px;
        font-size: 16px;
    }

    .main__header-search-button {
        height: 40px;
        padding: 0 20px;
        background-color: #3B388D;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
        white-space: nowrap;
    }

    .main__header-search-button:hover {
        background-color: #2e2c74;
    }
    
    .search-results__block {
        margin-bottom: 20px;
    }
    
    .search-results__block:last-child {
        margin-bottom: 0;
    }
    
    .search-results__block-header {
        margin: 0 0 10px 0;
        padding-bottom: 5px;
        border-bottom: 2px solid #eee;
        color: #333;
    }
    
    .search-results__list {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    
    .search-results__item {
        padding: 10px;
        border-bottom: 1px solid #eee;
    }
    
    .search-results__item:last-child {
        border-bottom: none;
    }
    
    .search-result__content {
        display: flex;
        flex-direction: column;
        gap: 5px;
        justify-content: flex-start;
        justify-items: flex-start;
    }
    
    .search-result__link {
        font-weight: bold;
        color: #0066cc;
        text-decoration: none;
    }
    
    .search-result__link:hover {
        text-decoration: underline;
    }
    
    .search-result__sequence-name {
        color: #666;
    }
    
    .search-result__matches {
        margin-top: 5px;
        padding-left: 15px;
    }
    
    .search-result__match {
        margin: 5px 0;
        padding: 5px;
        background-color: #f8f9fa;
        border-radius: 3px;
    }
    
    .search-result__match-type {
        font-weight: bold;
        color: #333;
    }
    
    .search-result__match-text {
        color: #666;
        display: block;
        margin-top: 3px;
        white-space: pre-wrap;
    }
        
    h3{
        margin-top: 0;
        margin-bottom: 0;
    }
    
    .search-results__error {
        padding: 15px;
        margin: 10px 0;
        background-color: #fff3f3;
        border: 1px solid #ffcdd2;
        border-radius: 4px;
        color: #d32f2f;
        font-size: 16px;
        text-align: center;
    }
`;
document.head.appendChild(style);

function noResults() {
    // Создаем контейнер для результатов поиска
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'search-results';
    
    // Создаем заголовок
    const header = document.createElement('h3');
    header.textContent = 'Результаты поиска:';
    resultsContainer.appendChild(header);
    
    // Создаем список результатов
    const resultsList = document.createElement('ul');
    resultsList.className = 'search-results__list';
    
    // Создаем элемент списка с сообщением
    const listItem = document.createElement('li');
    listItem.className = 'search-results__item search-results__item--no-results';
    
    const messageText = document.createElement('p');
    messageText.textContent = 'По вашему запросу ничего не найдено. Попробуйте поискать по:';
    
    const suggestionsList = document.createElement('ul');
    suggestionsList.className = 'search-results__suggestions';
    
    const suggestions = [
        'OEIS ID (например, A000045)',
        'Числовой последовательности (например: 1,2,3,4)',
        'Названию алгоритма'
    ];
    
    suggestions.forEach(suggestion => {
        const suggestionItem = document.createElement('li');
        suggestionItem.textContent = suggestion;
        suggestionsList.appendChild(suggestionItem);
    });
    
    listItem.appendChild(messageText);
    listItem.appendChild(suggestionsList);
    resultsList.appendChild(listItem);
    resultsContainer.appendChild(resultsList);

    // Удаляем предыдущие результаты поиска, если они есть
    const resultsRoot = document.getElementById('search-results-container');
    resultsRoot.innerHTML = '';
    resultsRoot.appendChild(resultsContainer);

    // Показываем блок с гиперссылками под результатами
    const hrefBlock = document.querySelector('.home__find-href');
    if (hrefBlock) {
        hrefBlock.style.display = '';
        // Вставляем после блока результатов
        if (resultsRoot.nextSibling !== hrefBlock) {
            resultsRoot.parentNode.insertBefore(hrefBlock, resultsRoot.nextSibling);
        }
    }
}

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}


// Получаем значение параметра "find"
const searchQuery = getQueryParam('find');
const headerNameElement = document.querySelector('.main__header-id');
const errorMessageElement = document.getElementById('.error-message');

if (searchQuery) {
    // Отображаем найденный запрос
    headerNameElement.textContent = searchQuery;
    headerNameElement.href = `https://oeis.org/${searchQuery}`;
} else {
    // Показываем сообщение об ошибке, если параметра нет
    errorMessageElement.style.display = 'block';
    errorMessageElement.textContent = 'Запрос не найден.';
}

function extractCleanText(html) {
    // Удаляем все style="..." и style='...'
    let text = html.replace(/style="[^"]*"/gi, '');
    text = text.replace(/style='[^']*'/gi, '');

    text = text.replace(/\\\(/g, '');
    text = text.replace(/\\\)/g, '');

    // Декодируем математические символы
    text = text.replace(/\\geq/g, '≥');
    text = text.replace(/\\leq/g, '≤');
    text = text.replace(/\\neq/g, '≠');

    // Удаляем все теги <...> (даже если они незакрыты)
    for (let i = 0; i < 3; i++) {
        text = text.replace(/<[^>]*>/g, '');
        text = text.replace(/^[^>]*>/, '');
    }
    // Декодируем спецсимволы
    const div = document.createElement('div');
    div.innerHTML = text;
    text = div.textContent || div.innerText || '';
    return text.trim();
}

// Функция для получения расширенного фрагмента вокруг найденного запроса
function extractContextSnippet(text, query, contextLen = 100) {
    if (!query) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return text;
    const start = Math.max(0, idx - contextLen);
    const end = Math.min(text.length, idx + query.length + contextLen);
    let snippet = text.substring(start, end);
    if (start > 0) snippet = '…' + snippet;
    if (end < text.length) snippet = snippet + '…';
    return snippet;
}
