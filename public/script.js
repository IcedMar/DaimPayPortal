// --- IndexedDB setup ---
let db;
const DB_NAME = "DaimaPayDB";
const STORE_NAME = "transactions";

const request = indexedDB.open(DB_NAME, 1);

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

// --- Form handling ---
const buyForm = document.getElementById('buyForm');
const phoneInput = document.getElementById('phone');
const amountInput = document.getElementById('amount');
const payPhoneInput = document.getElementById('phone2');
const historyList = document.getElementById('historyList');

const API_BASE_URL = 'https://daimapayserver.onrender.com';

// --- Helper to normalize Safaricom numbers ---
function normalizePhoneNumber(phone) {
  let normalized = phone.trim();
  if (normalized.startsWith('+')) {
    normalized = normalized.slice(1); // Remove '+'
  }
  if (normalized.startsWith('07')) {
    normalized = '254' + normalized.slice(1);
  }
  return normalized;
}

//buy form handler
buyForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const rawRecipient = phoneInput.value.trim();
  const rawAmount = amountInput.value.trim();
  const rawCustomer = payPhoneInput.value.trim();

  if (!rawRecipient || !rawAmount || !rawCustomer) {
    alert('Fill all fields!');
    return;
  }

  const recipienNumber = normalizePhoneNumber(rawRecipient);
  const customerNumber = normalizePhoneNumber(rawCustomer);
  const amount = parseFloat(rawAmount)

  try {
    const res = await fetch(`${API_BASE_URL}/stk-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        phone_number: customerNumber,
        amount: amount,
        recipientNumber: recipientNumber 
      }),
    });

    const data = await res.json();
    console.log('Server response:', data);

    if (res.ok) {
      alert('Payment initiated! Check your M-Pesa.');
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
      alert(`Error: ${data.error || 'Server failed'}`);
    }
  } catch (err) {
    console.error(err);
    alert('Network error. Try again.');
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

