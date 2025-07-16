// --- IndexedDB setup ---
let db;
const DB_NAME = "DaimaPayDB";
const STORE_NAME = "transactions";

const request = indexedDB.open(DB_NAME, 1);

request.onerror = (event) => {
    console.error("❌ IndexedDB error:", event.target.error);
    showNotification("Error opening local database. History might not be saved.", "error");
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
const phoneInput = document.getElementById('phone'); // Recipient number for airtime
const amountInput = document.getElementById('amount');
const payPhoneInput = document.getElementById('phone2'); // M-Pesa number for payment
const historyList = document.getElementById('historyList');

const API_BASE_URL = 'https://daimapayserver.onrender.com';

// --- Notification System (Ensure this function and its CSS are in your project) ---
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(notification);

    // Show and then hide
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', () => {
            notification.remove();
        });
    }, 4000); // Notification visible for 4 seconds
}

// --- Helper to normalize Safaricom numbers ---
function normalizePhoneNumber(phone) {
    let normalized = phone.trim();
    if (normalized.startsWith('+254')) {
        normalized = normalized.substring(1); // Remove '+'
    } else if (normalized.startsWith('0')) {
        normalized = '254' + normalized.substring(1);
    } else if (normalized.startsWith('7') && normalized.length === 9) { // Handles 7xxxxxxxxx
        normalized = '254' + normalized;
    }
    return normalized;
}

// --- Buy Form Handler ---
buyForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawRecipient = phoneInput.value.trim();
    const rawAmount = amountInput.value.trim();
    const rawCustomer = payPhoneInput.value.trim();

    if (!rawRecipient || !rawAmount || !rawCustomer) {
        showNotification('Please fill in all fields.', 'warning');
        return;
    }

    const recipientNumber = normalizePhoneNumber(rawRecipient);
    const customerNumber = normalizePhoneNumber(rawCustomer);
    const amount = parseFloat(rawAmount); // Ensure amount is a number here

    // Basic validation for numbers and amount
    if (isNaN(amount) || amount <= 0) {
        showNotification('Please enter a valid amount.', 'error');
        return;
    }
    if (!/^\d{12}$/.test(customerNumber) || !/^\d{12}$/.test(recipientNumber)) {
        showNotification('Please enter valid 10-digit phone numbers (e.g., 0712...).', 'error');
        return;
    }


    try {
        const res = await fetch(`${API_BASE_URL}/stk-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber: customerNumber, // This is the M-Pesa number initiating payment
                amount: amount,
                recipient: recipientNumber // This is the number receiving airtime
            }),
        });

        const data = await res.json();
        console.log('Server response:', data);

        if (res.ok) {
            showNotification('M-Pesa STK Push initiated successfully! Check your phone.', 'success');

            const tx = {
                transID: data.CheckoutRequestID || `local-${Date.now()}`,
                recipientPhone: recipientNumber,
                amount: amount, // 'amount' is already a number here
                status: 'PENDING',
                timestamp: new Date().toISOString(),
            };
            saveTransaction(tx);
            buyForm.reset();
        } else {
            console.error('STK Push Error:', data);
            showNotification(`Error: ${data.message || data.error || 'Server failed to initiate payment.'}`, 'error');
        }
    } catch (err) {
        console.error('Fetch error:', err);
        showNotification('Network error. Please check your internet connection and try again.', 'error');
    }
});

// --- Save to IndexedDB ---
function saveTransaction(tx) {
    if (!db) {
        console.error("IndexedDB not initialized. Cannot save transaction.");
        showNotification("Could not save transaction history. Please refresh.", "error");
        return;
    }
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put(tx);

    transaction.oncomplete = () => {
        console.log("✅ Transaction saved locally.");
        loadTransactions();
    };

    transaction.onerror = (event) => {
        console.error("❌ Error saving transaction:", event.target.error);
        showNotification("Failed to save transaction history locally.", "error");
    };
}

// --- Load from IndexedDB ---
function loadTransactions() {
    if (!db) {
        console.warn("IndexedDB not ready. Cannot load transactions.");
        // This block attempts to retry loading after DB is ready.
        // It's a bit redundant if request.onsuccess already calls loadTransactions,
        // but can help if loadTransactions is called prematurely from other parts.
        if (request.readyState === 'pending') {
            request.onsuccess = (event) => {
                db = event.target.result;
                loadTransactions();
            };
        }
        return;
    }
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
        let transactions = event.target.result;
        historyList.innerHTML = '';

        if (!transactions || transactions.length === 0) {
            historyList.innerHTML = '<p class="no-transactions">No local transactions yet. Make a top-up to see history!</p>';
            return;
        }

        transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        transactions.forEach(tx => {
            const card = document.createElement('div');
            card.className = 'transaction-card';

            // *** FIX APPLIED HERE ***
            // Ensure amount is a number before using toFixed
            const displayAmount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
            const formattedAmount = isNaN(displayAmount) ? 'N/A' : displayAmount.toFixed(2);


            card.innerHTML = `
                <h4>Transaction Details</h4>
                <p><strong>ID:</strong> ${tx.transID}</p>
                <p><strong>To:</strong> ${tx.recipientPhone}</p>
                <p><strong>Amount:</strong> KES ${formattedAmount}</p>
                <p><strong>Status:</strong> <span style="color: ${tx.status === 'SUCCESS' ? 'var(--green)' : tx.status === 'FAILED' ? '#c62828' : 'var(--gold)'}">${tx.status}</span></p>
                <small>${new Date(tx.timestamp).toLocaleString()}</small>
            `;
            historyList.appendChild(card);
        });
    };

    request.onerror = (event) => {
        console.error("❌ Error loading transactions:", event.target.error);
        showNotification("Failed to load transaction history.", "error");
    };
}
