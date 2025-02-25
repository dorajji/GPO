// Initialize the document when DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Load the sequence list on the home page
  await loadSequenceList();
  await loadLastUpdate();
  

  // Extract OEIS ID and initialize data on the main page
  const oeisId = document.querySelector('.main__header-id')?.textContent.trim();
  if (oeisId) {
      await loadSequence(oeisId);
      await loadInterpretations(oeisId);
      await loadAlgorithmsByInterpretation();
  }

  // Set up event listeners
  setupEventListeners();
});

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
//     const lastUpdateDate = new Date().toLocaleDateString('ru-RU', {
//         year: 'numeric',
//         month: 'long',
//         day: 'numeric',
//     }
// ); 
    
}

// Load the sequence list on the home page
async function loadSequenceList() {
  try {
      const response = await fetch('/search_seq');
      if (response.ok) {
          const sequenceData = await response.json();
          const infoWrapper = document.querySelector('.home__find-href');
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
      if (response.ok) {
          const interpretations = await response.json();
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

          await loadInterpretationsDetails();
      } else {
          console.error('Error loading interpretations.');
      }
  } catch (error) {
      console.error('Error occurred while loading interpretations:', error);
  }
}

// Load sequence data for a given OEIS ID
async function loadSequence(oeisId) {
  try {
      const response = await fetch(`/search?oeis_id=${oeisId}`);
      if (response.ok) {
          const sequenceData = await response.json();
          const infoWrapper = document.querySelector('.info__block1');
          infoWrapper.innerHTML = `
              <div class="info__block1">${sequenceData[0].sequence_description}</div>
          `;
          await MathJax.typesetPromise([infoWrapper]);
      } else {
          console.error('Error loading sequence.');
      }
  } catch (error) {
      console.error('Error occurred while loading sequence:', error);
  }
}

// Load interpretation details for the selected interpretation
async function loadInterpretationsDetails() {
  const selector = document.querySelector('.main__header-select');
  const interpretationName = selector.options[selector.selectedIndex]?.text;

  try {
      const response = await fetch(`/interp?interpretation_name=${interpretationName}`);
      if (response.ok) {
          const interpData = await response.json();
          const infoWrapper = document.querySelector('.info__block2');
          infoWrapper.innerHTML = `
              <div style="display:none" class="for_interp_id">${interpData[0].id}</div>
              <div>${interpData[0].interpretation_description}</div>
          `;
          await MathJax.typesetPromise([infoWrapper]);
      } else {
          console.error('Error loading interpretation details.');
      }

      await loadAlgorithmsByInterpretation();
  } catch (error) {
      console.error('Error occurred while loading interpretation details:', error);
  }
}

// Load algorithms for a given interpretation ID
async function loadAlgorithmsByInterpretation() {
  const interpId = document.querySelector('.for_interp_id')?.textContent.trim();
  if (!interpId) return;
  try {
      const response = await fetch(`/alg?interp_id=${interpId}`);
      if (response.ok) {
          const algorithms = await response.json();
          const selector = document.querySelector('.func-block__left-select');
          selector.innerHTML = '';

          algorithms.forEach(alg => {
              const option = document.createElement('option');
              option.textContent = alg.alg_name;
              option.value = alg.Alg_ID;
              selector.appendChild(option);
          });

          await loadAlgorithmDetails();
      } else {
          console.error('Error loading algorithms.');
      }
  } catch (error) {
      console.error('Error occurred while loading algorithms:', error);
  }
}

// Load details for the selected algorithm
async function loadAlgorithmDetails() {
  const selector = document.querySelector('.func-block__left-select');
  const algName = selector.options[selector.selectedIndex]?.text;
  if (!algName) return;

  try {
      const response = await fetch(`/algDetails?algName=${algName}`);
      if (response.ok) {
          const algData = await response.json();
          const infoWrapper = document.querySelector('.func-block__right');
          const paramsWrapper = document.querySelector('.func-block__left-param');
          const funcWrapper = document.querySelector('.func-block__left-functional');

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
      } else {
          console.error('Error loading algorithm details.');
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
}
