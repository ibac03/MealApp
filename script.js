// script.js

document.getElementById('mealForm').addEventListener('submit', generateMealPlan);

async function generateMealPlan(event) {
  event.preventDefault();

  // inputs
  const age            = Number(document.getElementById('age').value);
  const weight         = Number(document.getElementById('weight').value);
  const height         = Number(document.getElementById('height').value);
  const gender         = document.getElementById('gender').value;
  const activityLevel  = Number(document.getElementById('activityLevel').value);
  const numOfMeals     = Number(document.getElementById('numOfMeals').value);
  const cuisineTypeRaw = document.getElementById('cuisineType').value || '';
  const cuisineType    = cuisineTypeRaw.trim().toLowerCase(); // ensure lowercase
  const dietPreference = document.getElementById('dietPreference').value || '';
  const healthSpec     = document.getElementById('healthSpec').value || '';

  // calories -> start with ±200 window
  const bmr = gender === 'male'
    ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
    : 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;

  const calories = Math.round(bmr * activityLevel);
  let calMin = Math.max(0, calories - 200);
  let calMax = calories + 200;

  const needed = numOfMeals * 7;

  // try to fetch enough recipes with *cuisine kept as long as possible*
  let recipes = [];
  let relaxed = [];

  // 1) all filters as requested
  recipes = await fetchPaged({ diet: dietPreference, health: healthSpec, cuisineType, calMin, calMax, needed });

  // 2) widen calories first (keep cuisine)
  if (recipes.length < needed) {
    relaxed.push('Calories ±600');
    calMin = Math.max(0, calories - 600);
    calMax = calories + 600;
    recipes = await fillMore(recipes, { diet: dietPreference, health: healthSpec, cuisineType, calMin, calMax, needed });
  }

  // 3) drop diet (keep cuisine + health)
  if (recipes.length < needed && dietPreference) {
    relaxed.push('Diet');
    recipes = await fillMore(recipes, { diet: '', health: healthSpec, cuisineType, calMin, calMax, needed });
  }

  // 4) drop health (keep cuisine)
  if (recipes.length < needed && healthSpec) {
    relaxed.push('Health');
    recipes = await fillMore(recipes, { diet: '', health: '', cuisineType, calMin, calMax, needed });
  }

  // 5) only now drop cuisine
  if (recipes.length < needed && cuisineType) {
    relaxed.push('Cuisine');
    recipes = await fillMore(recipes, { diet: '', health: '', cuisineType: '', calMin, calMax, needed });
  }

  if (recipes.length === 0) {
    showNoResults({ cuisineType, dietPreference, healthSpec, calMin, calMax });
    return;
  }

  recipes = shuffle(recipes).slice(0, needed);
  displayMealPlan(recipes, numOfMeals, relaxed);
}

// --- helpers ---

const APP_ID  = '260d5ad0';
const APP_KEY = '658daaf58d39bc58cdd60a9c1c9e03ab';

async function fetchPaged({ diet, health, cuisineType, calMin, calMax, needed }) {
  const params = new URLSearchParams({
    type: 'public',
    app_id: APP_ID,
    app_key: APP_KEY,
    calories: `${calMin}-${calMax}`,
    from: '0',
    to: String(Math.max(needed, 20)),
  });
  if (diet)        params.append('diet', diet);
  if (health)      params.append('health', health);
  if (cuisineType) params.append('cuisineType', cuisineType);

  let nextUrl = `https://api.edamam.com/api/recipes/v2?${params.toString()}`;
  const out = [];

  while (out.length < needed && nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) break;
    const json = await res.json();
    out.push(...json.hits.map(h => h.recipe));
    nextUrl = json._links?.next?.href || null;
  }
  return out;
}

async function fillMore(current, opts) {
  const more = await fetchPaged(opts);
  const seen = new Set(current.map(r => r.uri));
  return current.concat(more.filter(r => !seen.has(r.uri)));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function displayMealPlan(meals, numOfMeals, relaxed = []) {
  const container = document.getElementById('mealPlanDisplay');
  container.innerHTML = '';

  if (relaxed.length) {
    const note = document.createElement('div');
    note.className = 'no-results';
    note.setAttribute('role', 'status');
    note.setAttribute('aria-live', 'polite');
    note.innerHTML = `<small>Not enough recipes for the exact filters. Relaxed: <b>${relaxed.join(', ')}</b>.</small>`;
    container.appendChild(note);
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  // header
  const headerRow = document.createElement('tr');
  days.forEach(day => {
    const th = document.createElement('th');
    th.textContent = day;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // rows
  for (let i = 0; i < numOfMeals; i++) {
    const row = document.createElement('tr');
    for (let j = 0; j < 7; j++) {
      const cell = document.createElement('td');
      const idx = i * 7 + j;
      if (meals[idx]) {
        const m = meals[idx];
        cell.innerHTML = `
          <h3>${m.label}</h3>
          <img src="${m.image}" alt="${m.label}" style="width:100%;max-width:200px;">
          <br><a href="${m.url}" target="_blank">View Recipe</a>
        `;
      }
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  container.appendChild(table);
}

function showNoResults({ cuisineType, dietPreference, healthSpec, calMin, calMax }) {
  const container = document.getElementById('mealPlanDisplay');
  container.innerHTML = '';

  const note = document.createElement('div');
  note.className = 'no-results';
  note.setAttribute('role', 'status');
  note.setAttribute('aria-live', 'polite');
  note.innerHTML = `
    <strong>No recipes found</strong> for this combination.<br>
    <small>
      Cuisine: <b>${cuisineType || 'Any'}</b>,
      Diet: <b>${dietPreference || 'Any'}</b>,
      Health: <b>${healthSpec || 'Any'}</b>,
      Calories: <b>${calMin}-${calMax}</b>
    </small>
    <ul>
      <li>Try a different cuisine or remove it.</li>
      <li>Try a wider calorie range.</li>
      <li>Relax diet/health filters.</li>
    </ul>
  `;
  container.appendChild(note);
}

document.getElementById('themeToggle').addEventListener('change', () => {
  document.body.classList.toggle('dark-mode');
});
