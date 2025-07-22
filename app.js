// --- Data Model ---
// Structure: [{ id, name, children: [folders], cards: [{ id, question, answer }] }]
const STORAGE_KEY = 'flashcards_data';
const TIMER_KEY = 'flashcards_timer';
let data = [];
let timerDuration = 5; // seconds

// --- Utility Functions ---
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function loadData() {
  const d = localStorage.getItem(STORAGE_KEY);
  data = d ? JSON.parse(d) : [];
}
function saveTimer() {
  localStorage.setItem(TIMER_KEY, timerDuration);
}
function loadTimer() {
  const t = localStorage.getItem(TIMER_KEY);
  timerDuration = t ? parseInt(t) : 5;
}
function genId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

// --- App State ---
let currentPath = [];
let flashcardQueue = [];
let flashcardIndex = 0;
let timer = null;
let timeLeft = 0;
let showAnswer = false;

// --- Rendering ---
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'header';
  header.innerHTML = `<h2>Flashcards</h2>`;
  app.appendChild(header);

  // Settings
  const settings = document.createElement('div');
  settings.className = 'settings';
  settings.innerHTML = `
    <label>Timer (seconds): <input type="number" min="1" max="60" value="${timerDuration}" id="timer-input" style="width:60px;"></label>
    <button class="button" id="save-timer">Save</button>
  `;
  app.appendChild(settings);
  document.getElementById('save-timer').onclick = () => {
    const val = parseInt(document.getElementById('timer-input').value);
    if (!isNaN(val) && val > 0) {
      timerDuration = val;
      saveTimer();
      render();
    }
  };

  // Breadcrumbs
  const crumbs = document.createElement('div');
  crumbs.style.marginBottom = '8px';
  crumbs.innerHTML = currentPath.length === 0 ? '<b>Root</b>' :
    '<span class="button" style="background:#eee;color:#1976d2;" id="crumb-root">Root</span>' +
    currentPath.map((p, i) =>
      ` &gt; <span class="button" style="background:#eee;color:#1976d2;" data-crumb="${i}">${p.name}</span>`
    ).join('');
  app.appendChild(crumbs);
  if (currentPath.length > 0) {
    document.getElementById('crumb-root').onclick = () => {
      currentPath = [];
      render();
    };
    crumbs.querySelectorAll('[data-crumb]').forEach(el => {
      el.onclick = () => {
        const idx = parseInt(el.getAttribute('data-crumb'));
        currentPath = currentPath.slice(0, idx + 1);
        render();
      };
    });
  }

  // Get current folder
  let folder = { children: data, cards: [] };
  for (const p of currentPath) {
    folder = folder.children.find(f => f.id === p.id);
  }

  // Folders
  const folderList = document.createElement('ul');
  folderList.className = 'folder-list';
  folder.children.forEach(f => {
    const li = document.createElement('li');
    li.className = 'folder';
    li.innerHTML = `
      <span class="folder-name">${f.name}</span>
      <span>
        <button class="button" data-open="${f.id}">Open</button>
        <button class="button" data-del="${f.id}" style="background:#d32f2f;">Delete</button>
      </span>
    `;
    folderList.appendChild(li);
  });
  app.appendChild(folderList);
  folderList.querySelectorAll('[data-open]').forEach(btn => {
    btn.onclick = () => {
      const f = folder.children.find(x => x.id === btn.getAttribute('data-open'));
      currentPath.push({ id: f.id, name: f.name });
      render();
    };
  });
  folderList.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = () => {
      folder.children = folder.children.filter(x => x.id !== btn.getAttribute('data-del'));
      saveData();
      render();
    };
  });

  // Add Folder
  const addFolder = document.createElement('div');
  addFolder.className = 'input-group';
  addFolder.innerHTML = `
    <input type="text" id="new-folder" placeholder="Add folder (subject/chapter)">
    <button class="button" id="add-folder">Add</button>
  `;
  app.appendChild(addFolder);
  document.getElementById('add-folder').onclick = () => {
    const val = document.getElementById('new-folder').value.trim();
    if (val) {
      folder.children.push({ id: genId(), name: val, children: [], cards: [] });
      saveData();
      render();
    }
  };

  // Cards
  const cardList = document.createElement('ul');
  cardList.className = 'card-list';
  folder.cards.forEach(c => {
    const li = document.createElement('li');
    li.className = 'card';
    li.innerHTML = `
      <span class="question">${c.question}</span>
      <span>
        <button class="button" data-edit="${c.id}">Edit</button>
        <button class="button" data-delc="${c.id}" style="background:#d32f2f;">Delete</button>
      </span>
    `;
    cardList.appendChild(li);
  });
  app.appendChild(cardList);
  cardList.querySelectorAll('[data-delc]').forEach(btn => {
    btn.onclick = () => {
      folder.cards = folder.cards.filter(x => x.id !== btn.getAttribute('data-delc'));
      saveData();
      render();
    };
  });
  cardList.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = () => {
      const c = folder.cards.find(x => x.id === btn.getAttribute('data-edit'));
      showCardEditor(folder, c);
    };
  });

  // Add Card
  const addCard = document.createElement('div');
  addCard.className = 'input-group';
  addCard.innerHTML = `
    <input type="text" id="new-q" placeholder="Question">
    <input type="text" id="new-a" placeholder="Answer">
    <button class="button" id="add-card">Add</button>
  `;
  app.appendChild(addCard);
  document.getElementById('add-card').onclick = () => {
    const q = document.getElementById('new-q').value.trim();
    const a = document.getElementById('new-a').value.trim();
    if (q && a) {
      folder.cards.push({ id: genId(), question: q, answer: a });
      saveData();
      render();
    }
  };

  // Start Flashcards
  if (folder.cards.length > 0) {
    const startBtn = document.createElement('button');
    startBtn.className = 'button';
    startBtn.style.marginTop = '12px';
    startBtn.textContent = 'Start Flashcards';
    startBtn.onclick = () => startFlashcards(folder.cards);
    app.appendChild(startBtn);
  }
}

function showCardEditor(folder, card) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const editor = document.createElement('div');
  editor.className = 'flashcard';
  editor.innerHTML = `
    <div style="margin-bottom:8px;">Edit Card</div>
    <input type="text" id="edit-q" value="${card.question}" style="margin-bottom:8px;">
    <input type="text" id="edit-a" value="${card.answer}" style="margin-bottom:8px;">
    <button class="button" id="save-edit">Save</button>
    <button class="button" id="cancel-edit" style="background:#d32f2f;">Cancel</button>
  `;
  app.appendChild(editor);
  document.getElementById('save-edit').onclick = () => {
    card.question = document.getElementById('edit-q').value.trim();
    card.answer = document.getElementById('edit-a').value.trim();
    saveData();
    render();
  };
  document.getElementById('cancel-edit').onclick = render;
}

function startFlashcards(cards) {
  flashcardQueue = [...cards];
  flashcardIndex = 0;
  showAnswer = false;
  showFlashcard();
}

function showFlashcard() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  if (flashcardIndex >= flashcardQueue.length) {
    const done = document.createElement('div');
    done.className = 'flashcard';
    done.innerHTML = '<b>Done! 🎉</b>';
    app.appendChild(done);
    const backBtn = document.createElement('button');
    backBtn.className = 'button';
    backBtn.textContent = 'Back';
    backBtn.onclick = render;
    app.appendChild(backBtn);
    return;
  }
  const card = flashcardQueue[flashcardIndex];
  const cardDiv = document.createElement('div');
  cardDiv.className = 'flashcard';
  cardDiv.innerHTML = `
    <div style="margin-bottom:8px;">${showAnswer ? 'Answer:' : 'Question:'}</div>
    <div style="font-size:1.3em;">${showAnswer ? card.answer : card.question}</div>
  `;
  app.appendChild(cardDiv);
  if (!showAnswer) {
    timeLeft = timerDuration;
    const timerDiv = document.createElement('div');
    timerDiv.className = 'timer';
    timerDiv.id = 'timer';
    timerDiv.textContent = `Time left: ${timeLeft}s`;
    app.appendChild(timerDiv);
    timer = setInterval(() => {
      timeLeft--;
      timerDiv.textContent = `Time left: ${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(timer);
        showAnswer = true;
        showFlashcard();
      }
    }, 1000);
    const showBtn = document.createElement('button');
    showBtn.className = 'button';
    showBtn.textContent = 'Show Answer';
    showBtn.onclick = () => {
      clearInterval(timer);
      showAnswer = true;
      showFlashcard();
    };
    app.appendChild(showBtn);
  } else {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'button';
    nextBtn.textContent = 'Next';
    nextBtn.onclick = () => {
      showAnswer = false;
      flashcardIndex++;
      showFlashcard();
    };
    app.appendChild(nextBtn);
  }
  const quitBtn = document.createElement('button');
  quitBtn.className = 'button';
  quitBtn.style.background = '#d32f2f';
  quitBtn.textContent = 'Quit';
  quitBtn.onclick = () => {
    if (timer) clearInterval(timer);
    render();
  };
  app.appendChild(quitBtn);
}

// --- Init ---
window.addEventListener('DOMContentLoaded', () => {
  loadData();
  loadTimer();
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
  }
}); 