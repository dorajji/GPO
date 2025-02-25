async function executeSearchQuery() {
    const query = document.querySelector('.find__input').value.trim();

    if (query) {
        try {
            const response = await fetch(`/search_seq`);
            if (!response.ok) {
                throw new Error('Ошибка при выполнении запроса к серверу.');
            }
            
            const sequenceData = await response.json();
            const exists = sequenceData.some(seq => seq.OEIS_ID === query);

            if (exists) {
                window.location.href = `/main?find=${encodeURIComponent(query)}`;
            } else {
                alert('OEIS_ID не найден в базе данных.');
            }
        } catch (error) {
            console.error('Произошла ошибка:', error);
            alert('Не удалось проверить OEIS_ID. Попробуйте позже.');
        }
    } else {
        alert('Введите запрос для поиска.');
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
