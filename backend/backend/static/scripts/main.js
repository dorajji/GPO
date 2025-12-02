// Глобальная функция для поиска с главной страницы
window.executeSearchQueryMain = function() {
    console.log('executeSearchQueryMain called');
    const searchInput = document.querySelector('.find__input');
    if (!searchInput) {
        console.error('Search input not found');
        return;
    }
    const query = searchInput.value.trim();
    console.log('Query:', query);
    
    if (query) {
        // Сохраняем поисковый запрос в localStorage
        localStorage.setItem('savedSearchQuery', query);
        console.log('Query saved to localStorage:', query);
        
        // Перенаправляем на главную страницу
        window.location.href = '/home';
    } else {
        console.log('Empty query, redirecting to home');
        // Если запрос пустой, просто перенаправляем на главную
        window.location.href = '/home';
    }
};

// Initialize the document when DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Load the sequence list on the home page
  await loadSequenceList();
  await loadLastUpdate();
  
  // Extract OEIS ID, interpretation and algorithm from URL
  const urlParams = new URLSearchParams(window.location.search);
  const oeisId = urlParams.get('find');
  const interpretationName = urlParams.get('interp');
  const algName = urlParams.get('alg');
  
  if (oeisId) {
      // Загружаем последовательность и список интерпретаций
      await loadSequence(oeisId);
      await loadInterpretations(oeisId);
      
      if (interpretationName) {
          // Если указана интерпретация, выбираем её в селекторе
          const selector = document.querySelector('.main__header-select');
          for (let i = 0; i < selector.options.length; i++) {
              if (selector.options[i].text === interpretationName) {
                  selector.selectedIndex = i;
                  break;
              }
          }
          // Загружаем детали интерпретации и ждем загрузки
          await loadInterpretationsDetails(false); // Передаем false, чтобы предотвратить обновление URL
          
          // Если указан алгоритм, дожидаемся загрузки алгоритмов и выбираем нужный
          if (algName) {
              await loadAlgorithmsByInterpretation(false); // Передаем false, чтобы предотвратить обновление URL
              const selectorAlg = document.querySelector('.func-block__left-select');
              let found = false;
              for (let i = 0; i < selectorAlg.options.length; i++) {
                  if (selectorAlg.options[i].text === algName) {
                      selectorAlg.selectedIndex = i;
                      found = true;
                      break;
                  }
              }
              // Если алгоритм не найден, выбираем первый доступный
              if (!found && selectorAlg.options.length > 0) {
                  selectorAlg.selectedIndex = 0;
              }
              await loadAlgorithmDetails(false); // Передаем false, чтобы предотвратить обновление URL
          } else {
              await loadAlgorithmsByInterpretation();
          }
      } else {
          await loadAlgorithmsByInterpretation();
      }
  }

  // Set up event listeners
  setupEventListeners();
});

// Перенаправление на страницу 404
function redirectTo404() {
  try {
    window.location.replace('/404');
  } catch (e) {
    window.location.href = '/404';
  }
}

async function loadLastUpdate(){
    const footerText = document.querySelector('.footer__text');
    fetch("/checkDate")
        .then((response) => {
            if (!response.ok) {
                throw new Error("Failed to fetch last update time.");
            }
            return response.json();
        })
        .then((data) => {
            if (data.last_update) {
                footerText.textContent = `Последнее обновление: ${data.last_update}`;
            } else {
                footerText.textContent = "Не удалось получить время обновления.";
            }
        })
}

// Load the sequence list on the home page
async function loadSequenceList() {
  // Проверяем, есть ли сохраненный поисковый запрос
  const savedQuery = localStorage.getItem('savedSearchQuery');
  console.log('loadSequenceList called, savedQuery:', savedQuery);
  
  if (savedQuery) {
      console.log('Found saved query, executing search');
      // Если есть сохраненный запрос, выполняем поиск
      const searchInput = document.querySelector('.find__input');
      if (searchInput) {
          searchInput.value = savedQuery;
          console.log('Input value set to:', savedQuery);
          // Выполняем поиск
          if (typeof window.executeSearchQuery === 'function') {
              console.log('Calling executeSearchQuery');
              await window.executeSearchQuery();
          } else {
              console.error('executeSearchQuery function not found');
              // Попробуем вызвать функцию напрямую
              if (typeof executeSearchQuery === 'function') {
                  console.log('Calling executeSearchQuery directly');
                  await executeSearchQuery();
              } else {
                  console.error('executeSearchQuery not available in any form');
              }
          }
      } else {
          console.log('Search input not found');
      }
      // Удаляем сохраненный запрос после использования
      localStorage.removeItem('savedSearchQuery');
      return;
  }
  
  // Если нет сохраненного запроса, загружаем обычный список последовательностей
  // Но только если мы на главной странице
  const infoWrapper = document.querySelector('.home__find-href');
  if (!infoWrapper) {
      console.log('Not on home page, skipping sequence list loading');
      return;
  }
  
  try {
      const response = await fetch('/search_seq');
      if (response.ok) {
          const sequenceData = await response.json();
          
          infoWrapper.innerHTML = '';

          sequenceData.slice(-4).forEach(seq => {
              const a = document.createElement('a');
              a.classList.add('home__find-href-content');
              a.href = `/main?find=${seq.OEIS_ID}`;
              a.textContent = seq.OEIS_ID;
              infoWrapper.appendChild(a);
          });
      } else {
          console.error('Error loading sequences:', response.status);
      }
  } catch (error) {
      console.error('Error occurred while loading sequences:', error);
  }
}

// Load interpretations for a given OEIS ID
async function loadInterpretations(oeisId) {
  try {
      const response = await fetch(`/search_interp?oeis_id=${oeisId}`);
      if (!response.ok) {
          return redirectTo404();
      }
      const interpretations = await response.json();
      if (!Array.isArray(interpretations) || interpretations.length === 0) {
          return redirectTo404();
      }
          const selector = document.querySelector('.main__header-select');
          selector.innerHTML = '';
          const addedDescriptions = new Set();

          interpretations.forEach(interp => {
              if (!addedDescriptions.has(interp.interpretation_name)) {
                  const option = document.createElement('option');
                  option.textContent = interp.interpretation_name;
                  option.value = interp.endpoint;
                  selector.appendChild(option);
                  addedDescriptions.add(interp.interpretation_name);
              }
          });

          // Проверяем, есть ли параметр interp в URL
          const urlParams = new URLSearchParams(window.location.search);
          const interpretationName = urlParams.get('interp');
          
          if (interpretationName) {
              // Если есть параметр interp, выбираем соответствующую интерпретацию
              for (let i = 0; i < selector.options.length; i++) {
                  if (selector.options[i].text === interpretationName) {
                      selector.selectedIndex = i;
                      break;
                  }
              }
              // Если не нашли указанную интерпретацию — 404
              if (selector.selectedIndex === -1 || selector.options[selector.selectedIndex]?.text !== interpretationName) {
                  return redirectTo404();
              }
          } else if (selector.options.length > 0) {
              // Если параметра interp нет, выбираем первую интерпретацию
              selector.selectedIndex = 0;
          }
          
          // Загружаем детали выбранной интерпретации
          await loadInterpretationsDetails();
  } catch (error) {
      console.error('Error occurred while loading interpretations:', error);
  }
}

// Load sequence data for a given OEIS ID
async function loadSequence(oeisId) {
  try {
      const response = await fetch(`/search?oeis_id=${oeisId}`);
      if (!response.ok) {
          return redirectTo404();
      }
      const sequenceData = await response.json();
      if (!Array.isArray(sequenceData) || sequenceData.length === 0) {
          return redirectTo404();
      }
      const infoWrapper = document.querySelector('.info__block1');
      infoWrapper.innerHTML = `
              <div class="info__block1">${sequenceData[0].sequence_description}</div>
          `;
      await MathJax.typesetPromise([infoWrapper]);
  } catch (error) {
      console.error('Error occurred while loading sequence:', error);
  }
}

// Load interpretation details for the selected interpretation
async function loadInterpretationsDetails(updateUrl = true) {
  const selector = document.querySelector('.main__header-select');
  const interpretationName = selector.options[selector.selectedIndex]?.text;
  const oeisId = document.querySelector('.main__header-id')?.textContent.trim();

  if (!interpretationName || !oeisId) return;

  try {
      const response = await fetch(`/interp?interpretation_name=${interpretationName}`);
      if (response.ok) {
          const interpData = await response.json();
          
          // Отображаем данные интерпретации
          const infoWrapper = document.querySelector('.info__block2');
          infoWrapper.style.minHeight = infoWrapper.offsetHeight + 'px'; // Сохраняем текущую высоту
          infoWrapper.innerHTML = `
              <div style="display:none" class="for_interp_id">${interpData[0].id}</div>
              <div>${interpData[0].interpretation_description}</div>
          `;
          await MathJax.typesetPromise([infoWrapper]);
          
          // Загружаем алгоритмы для выбранной интерпретации
          await loadAlgorithmsByInterpretation(updateUrl);
          
          // Обновляем URL без перезагрузки страницы только если updateUrl = true
          if (updateUrl) {
              const urlParams = new URLSearchParams(window.location.search);
              const algName = urlParams.get('alg');
              let newUrl = `/main?find=${oeisId}&interp=${encodeURIComponent(interpretationName)}`;
              if (algName) {
                  newUrl += `&alg=${encodeURIComponent(algName)}`;
              }
              window.history.pushState({}, '', newUrl);
          }
      } else {
          console.error('Error loading interpretation details.');
      }
  } catch (error) {
      console.error('Error occurred while loading interpretation details:', error);
  }
}

// Load algorithms for a given interpretation ID
async function loadAlgorithmsByInterpretation(updateUrl = true) {
  const interpId = document.querySelector('.for_interp_id')?.textContent.trim();
  if (!interpId) return;
  try {
      const response = await fetch(`/alg?interp_id=${interpId}`);
      if (!response.ok) {
          return redirectTo404();
      }
      const algorithms = await response.json();
      if (!Array.isArray(algorithms) || algorithms.length === 0) {
          return redirectTo404();
      }
          const selector = document.querySelector('.func-block__left-select');
          selector.innerHTML = '';

          algorithms.forEach(alg => {
              const option = document.createElement('option');
              option.textContent = alg.alg_name;
              option.value = alg.Alg_ID;
              selector.appendChild(option);
          });

          // Проверяем, есть ли параметр alg в URL
          const urlParams = new URLSearchParams(window.location.search);
          const algName = urlParams.get('alg');
          
          if (algName) {
              // Если есть параметр alg, выбираем соответствующий алгоритм
              let found = false;
              for (let i = 0; i < selector.options.length; i++) {
                  if (selector.options[i].text === algName) {
                      selector.selectedIndex = i;
                      found = true;
                      break;
                  }
              }
              // Если не нашли указанный алгоритм, выбираем первый доступный
              if (!found && selector.options.length > 0) {
                  selector.selectedIndex = 0;
                  // Обновляем URL, убирая неверный параметр alg или заменяя его на первый доступный
                  if (updateUrl) {
                      const oeisId = urlParams.get('find');
                      const interpretationName = urlParams.get('interp');
                      const firstAlgName = selector.options[0].text;
                      const newUrl = `/main?find=${oeisId}&interp=${encodeURIComponent(interpretationName)}&alg=${encodeURIComponent(firstAlgName)}`;
                      window.history.pushState({}, '', newUrl);
                  }
              }
          } else if (selector.options.length > 0) {
              // Если параметра alg нет, выбираем первый алгоритм
              selector.selectedIndex = 0;
          }
          
          // Загружаем детали выбранного алгоритма
          await loadAlgorithmDetails(updateUrl);
  } catch (error) {
      console.error('Error occurred while loading algorithms:', error);
  }
}

// Load details for the selected algorithm
async function loadAlgorithmDetails(updateUrl = true) {
  const selector = document.querySelector('.func-block__left-select');
  const algName = selector.options[selector.selectedIndex]?.text;
  if (!algName) return;

  try {
      const response = await fetch(`/algDetails?algName=${algName}`);
      if (!response.ok) {
          return redirectTo404();
      }
      const algData = await response.json();
      if (!Array.isArray(algData) || algData.length === 0) {
          return redirectTo404();
      }
          const infoWrapper = document.querySelector('.func-block__right');
          const paramsWrapper = document.querySelector('.func-block__left-param');
          const funcWrapper = document.querySelector('.func-block__left-functional');

          // Сохраняем текущие высоты блоков
          infoWrapper.style.minHeight = infoWrapper.offsetHeight + 'px';
          paramsWrapper.style.minHeight = paramsWrapper.offsetHeight + 'px';
          funcWrapper.style.minHeight = funcWrapper.offsetHeight + 'px';
          
          infoWrapper.innerHTML = `
              <div class="func-block__right-name">${algData[0].field_name}</div>
              <div class="func-block__right-desc">${algData[0].field_description}</div>
          `;
          
          paramsWrapper.innerHTML = '';
          funcWrapper.innerHTML = '';
          await MathJax.typesetPromise([infoWrapper]);
          
          const params = algData[0].parameters_name.split(',').map(param => param.trim());
          params.forEach(param => {
              const div = document.createElement('div');
              div.textContent = `${param} = `;
              div.style.fontStyle='italic';

              const input = document.createElement('input');
              input.type = 'number';
              input.classList.add('func-block__left-param-input');
              div.appendChild(input);

              paramsWrapper.appendChild(div);
          });

          if (algData[0].alg_type === 'Rank') {
              const objectDiv = document.createElement('div');
              objectDiv.textContent = 'Комбинаторный объект';
              const objectInput = document.createElement('input');
              objectInput.type = 'text';
              objectInput.classList.add('func-block__left-param-input1', 'func-block__left-param-input--wd500');
              funcWrapper.append(objectDiv, objectInput);
          } else if (algData[0].alg_type === 'Unrank') {
              const rankDiv = document.createElement('div');
              rankDiv.textContent = 'Ранг комбинаторного объекта';
              const rankInput = document.createElement('input');
              rankInput.type = 'number';
              rankInput.classList.add('func-block__left-param-input2');
              funcWrapper.append(rankDiv, rankInput);
          }

          funcWrapper.insertBefore(paramsWrapper, funcWrapper.firstChild);
          
          // Обновляем URL без перезагрузки страницы только если updateUrl = true
          if (updateUrl) {
              const urlParams = new URLSearchParams(window.location.search);
              const oeisId = urlParams.get('find');
              const interpretationName = urlParams.get('interp');
              
              let newUrl = `/main?find=${oeisId}`;
              if (interpretationName) {
                  newUrl += `&interp=${encodeURIComponent(interpretationName)}`;
              }
              newUrl += `&alg=${encodeURIComponent(algName)}`;
              window.history.pushState({}, '', newUrl);
          }
  } catch (error) {
      console.error('Error occurred while loading algorithm details:', error);
  }
}

// Solve the selected algorithm with provided parameters
async function solve() {
  const selector = document.querySelector('.func-block__left-select');
  const algName = selector.options[selector.selectedIndex]?.text;
  if (!algName) return;

  try {
      const response = await fetch(`/algDetails?algName=${algName}`);
      const algData = await response.json();
      const algId = algData[0].Alg_ID;

      const params = {};
      document.querySelectorAll('.func-block__left-param-input').forEach((input, index) => {
          params[`param${index + 1}`] = input.value;
      });

      document.querySelectorAll('.func-block__left-param-input1').forEach(input => {
          params['combObject'] = input.value;
      });

      document.querySelectorAll('.func-block__left-param-input2').forEach(input => {
          params['Rank'] = input.value;
      });

      const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
      const solveResponse = await fetch('/solve', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': csrfToken
          },
          body: JSON.stringify({ params, alg_id: algId })
      });

      if (solveResponse.ok) {
          const result = await solveResponse.json();
          document.querySelector('.func-block__left-main_textarea').textContent = result;
      } else {
          throw new Error('Error solving the algorithm.');
      }
  } catch (error) {
      console.error('Error occurred while solving:', error);
      document.querySelector('.func-block__left-main_textarea').textContent = 'Ошибка вычислений';
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('find').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
          event.preventDefault();
          executeSearchQuery();
      }
  });

  document.querySelector('.main__header-select').addEventListener('change', loadInterpretationsDetails);

  const selectorAlg = document.querySelector('.func-block__left-select');
  selectorAlg.addEventListener('change', () => {
      loadAlgorithmDetails();
      document.querySelector('.func-block__left-main_textarea').innerHTML = '';
  });

  // Обработчик для кнопки "Назад" в браузере
  window.addEventListener('popstate', async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const oeisId = urlParams.get('find');
      const interpretationName = urlParams.get('interp');
      const algName = urlParams.get('alg');

      if (oeisId) {
          await loadSequence(oeisId);
          await loadInterpretations(oeisId);
          
          if (interpretationName) {
              const selector = document.querySelector('.main__header-select');
              for (let i = 0; i < selector.options.length; i++) {
                  if (selector.options[i].text === interpretationName) {
                      selector.selectedIndex = i;
                      break;
                  }
              }
              await loadInterpretationsDetails();
          }
          
          if (algName) {
              const selectorAlg = document.querySelector('.func-block__left-select');
              let found = false;
              for (let i = 0; i < selectorAlg.options.length; i++) {
                  if (selectorAlg.options[i].text === algName) {
                      selectorAlg.selectedIndex = i;
                      found = true;
                      break;
                  }
              }
              // Если алгоритм не найден, выбираем первый доступный
              if (!found && selectorAlg.options.length > 0) {
                  selectorAlg.selectedIndex = 0;
              }
              await loadAlgorithmDetails();
          }
      }
  });
}
