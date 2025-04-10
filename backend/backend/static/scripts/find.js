async function executeSearchQuery() {
    const query = document.querySelector('.find__input').value.trim();

    if (query) {
        // Проверяем, является ли запрос числовой последовательностью
        const isSequence = /^\d+(?:\s*,\s*\d+)*$/.test(query);
        
        if (isSequence) {
            // Если это числовая последовательность, перенаправляем на OEIS
            const searchSequence = query.replace(/\s+/g, '');
            const url = `https://oeis.org/search?q=${encodeURIComponent(searchSequence)}&language=russian&go=Поиск`;
            window.location.href = url;
            return;
        }

        try {
            const response = await fetch(`/search_seq?query=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error('Ошибка при выполнении запроса к серверу.');
            }
            
            const searchResults = await response.json();
            
            if (searchResults && searchResults.length > 0) {
                // Если найден хотя бы один результат
                if (searchResults.length === 1) {
                    // Если найден только один результат, переходим на его страницу
                    window.location.href = `/main?find=${encodeURIComponent(searchResults[0].OEIS_ID)}`;
                } else {
                    // Если найдено несколько результатов, показываем их список
                    displaySearchResults(searchResults);
                }
            } else {
                // Если результатов нет, показываем сообщение
                noResults();
            }
        } catch (error) {
            console.error('Произошла ошибка:', error);
            noResults();
        }
    } else {
        alert('Введите запрос для поиска.');
    }
}

function displaySearchResults(results) {
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
    
    results.forEach(result => {
        const listItem = document.createElement('li');
        listItem.className = 'search-results__item';
        
        const link = document.createElement('a');
        link.href = `/main?find=${encodeURIComponent(result.OEIS_ID)}`;
        
        // Формируем текст результата
        let resultText = `${result.OEIS_ID}`;
        if (result.sequence_name) {
            resultText += ` - ${result.sequence_name}`;
        }
        if (result.alg_name) {
            resultText += ` (${result.alg_name})`;
        }
        
        link.textContent = resultText;
        listItem.appendChild(link);
        resultsList.appendChild(listItem);
    });
    
    resultsContainer.appendChild(resultsList);
    
    // Удаляем предыдущие результаты поиска, если они есть
    const existingResults = document.querySelector('.search-results');
    if (existingResults) {
        existingResults.remove();
    }
    
    // Добавляем результаты после поля ввода
    const searchInput = document.querySelector('.find__input');
    searchInput.parentNode.insertBefore(resultsContainer, searchInput.nextSibling);
}

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
    const existingResults = document.querySelector('.search-results');
    if (existingResults) {
        existingResults.remove();
    }
    
    // Добавляем результаты после поля ввода
    const searchInput = document.querySelector('.find__input');
    searchInput.parentNode.insertBefore(resultsContainer, searchInput.nextSibling);
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
