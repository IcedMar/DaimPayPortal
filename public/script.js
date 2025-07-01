// --- IndexedDB setup ---
let db;
const DB_NAME = "DaimaPayDB";
const STORE_NAME = "transactions";

const request = indexedDB.open(DB_NAME, 1);

function showNotification(message, type = 'success', duration = 3500) {
  const note = document.getElementById('notification');
  const icon = note.querySelector('i');
  const text = note.querySelector('span');

  // Icons per type
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️'
  };

  note.className = `notification ${type}`;
  icon.textContent = icons[type] || '';
  text.textContent = message;
  note.classList.add('show');

  setTimeout(() => {
    note.classList.remove('show');
  }, duration);
}

request.onerror = (event) => {
  console.error("❌ IndexedDB error:", event.target.error);
};

request.onsuccess = (event) => {
  db = event.target.result;
  console.log("✅ IndexedDB opened");
  loadTransactions();
};

request.onupgradeneeded = (event) => {
  db = event.target.result;
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    db.createObjectStore(STORE_NAME, { keyPath: "transID" });
  }
};

function formatTo254(phone) {
  let num = phone.trim().replace(/\s+/g, '');

  if (num.startsWith('+')) {
    num = num.substring(1);
  }

  if (num.startsWith('00')) {
    num = num.substring(2);
  }

  if (num.startsWith('0')) {
    num = '254' + num.substring(1);
  }

  if (num.startsWith('2547') || num.startsWith('2541')) {
    return num;
  }

  console.warn(`⚠️ Unusual format: ${phone} -> ${num}`);
  return num;
}

// --- Form handling ---
const buyForm = document.getElementById('buyForm');
const phoneInput = document.getElementById('phone');
const amountInput = document.getElementById('amount');
const payPhoneInput = document.getElementById('phone2');
const historyList = document.getElementById('historyList');

const API_BASE_URL = 'https://daimapayserver.onrender.com'; 

buyForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const rawTopupNumber = phoneInput.value.trim();
  const amount = amountInput.value.trim();
  const rawMpesaNumber = payPhoneInput.value.trim();

  if (!rawTopupNumber || !amount || !rawMpesaNumber) {
  showNotification('Fill all fields!', 'warning');
  return;
  }

  // ✅ Format both numbers to 254
  const topupNumber = formatTo254(rawTopupNumber);
  const mpesaNumber = formatTo254(rawMpesaNumber);

  console.log('Formatted:', { topupNumber, mpesaNumber });

  try {
    const res = await fetch(`${API_BASE_URL}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topupNumber, amount, mpesaNumber }),
    });

    const data = await res.json();
    console.log('Server response:', data);

    if (res.ok) {
      showNotification('Payment initiated! Check your M-Pesa.', 'success');
      const tx = {
        transID: data.transID || `local-${Date.now()}`,
        recipientPhone: topupNumber,
        amount: amount,
        status: 'PENDING',
        timestamp: new Date().toISOString(),
      };
      saveTransaction(tx);
      buyForm.reset();
    } else {
      showNotification(data.error || 'Server failed. Try again.', 'error');
    }
  } catch (err) {
    console.error(err);
   showNotification('Network error. Please try again.', 'error');
  }
});

// --- Save to IndexedDB ---
function saveTransaction(tx) {
  const transaction = db.transaction([STORE_NAME], "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  store.put(tx);

  transaction.oncomplete = () => {
    console.log("✅ Transaction saved locally.");
    loadTransactions();
  };
}

// --- Load from IndexedDB ---
function loadTransactions() {
  if (!db) return;
  const transaction = db.transaction([STORE_NAME], "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();

  request.onsuccess = (event) => {
    const transactions = event.target.result;
    historyList.innerHTML = '';
    if (!transactions.length) {
      historyList.innerHTML = '<p>No local transactions yet.</p>';
      return;
    }
    transactions.reverse().forEach(tx => {
      const card = document.createElement('div');
      card.className = 'tx-card';
      card.innerHTML = `
        <strong>ID:</strong> ${tx.transID}<br>
        <strong>To:</strong> ${tx.recipientPhone}<br>
        <strong>Amount:</strong> KES ${tx.amount}<br>
        <strong>Status:</strong> ${tx.status}<br>
        <small>${new Date(tx.timestamp).toLocaleString()}</small>
      `;
      historyList.appendChild(card);
    });
  };
}
