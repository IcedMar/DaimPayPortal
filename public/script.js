// --- IndexedDB setup ---
let db;
const DB_NAME = "DaimaPayDB";
const STORE_NAME = "transactions"; // Local transaction history store

const request = indexedDB.open(DB_NAME, 1);

/**
 * Displays a non-intrusive notification to the user.
 * @param {string} message The message to display.
 * @param {'success'|'error'|'warning'} type The type of notification.
 * @param {number} duration How long the notification should be visible in milliseconds.
 */
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

    note.className = `notification ${type}`; // Reset classes and add type
    icon.textContent = icons[type] || '';
    text.textContent = message;
    note.classList.add('show');

    // Hide after duration
    setTimeout(() => {
        note.classList.remove('show');
    }, duration);
}

request.onerror = (event) => {
    console.error("❌ IndexedDB error:", event.target.error);
    showNotification('Local data storage error. Please clear browser cache.', 'error');
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log("✅ IndexedDB opened");
    loadTransactions(); // Load existing transactions on successful DB open
};

request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
        // keyPath should be 'CheckoutRequestID' to align with backend
        db.createObjectStore(STORE_NAME, { keyPath: "checkoutRequestID" });
        console.log("✅ IndexedDB object store created/upgraded");
    }
};

/**
 * Formats a phone number to the '254XXXXXXXXX' format.
 * @param {string} phone The raw phone number.
 * @returns {string} The formatted phone number.
 */
function formatTo254(phone) {
    let num = phone.trim().replace(/\s+/g, ''); // Remove spaces

    // Handle common prefixes
    if (num.startsWith('+254')) {
        return num.substring(1); // Remove '+' to get 254...
    }
    if (num.startsWith('07') || num.startsWith('01')) {
        return '254' + num.substring(1); // Replace leading '0' with '254'
    }
    // If it starts with 254 already, return as is
    if (num.startsWith('254')) {
        return num;
    }

    // Fallback for numbers like 7xxxxxxxxx (assuming it's a Kenyan number)
    // This might be risky if non-Kenyan numbers are expected.
    // For this app context (Kenya), it's probably acceptable.
    console.warn(`⚠️ Unusual phone number format detected: "${phone}". Attempting to prepend '254'.`);
    return '254' + num;
}


// --- DOM Elements ---
const buyForm = document.getElementById('buyForm');
const phoneInput = document.getElementById('phone');
const amountInput = document.getElementById('amount');
const payPhoneInput = document.getElementById('phone2');
const historyList = document.getElementById('historyList');

// Base URL for your backend API
const API_BASE_URL = 'https://daimapayserver.onrender.com';

// --- Form submission handler ---
buyForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawTopupNumber = phoneInput.value.trim();
    const amount = amountInput.value.trim();
    const rawMpesaNumber = payPhoneInput.value.trim();

    if (!rawTopupNumber || !amount || !rawMpesaNumber) {
        showNotification('Please fill in all fields!', 'warning');
        return;
    }

    // Basic amount validation
    if (parseFloat(amount) < 10) {
        showNotification('Minimum top-up amount is KES 10.', 'warning');
        return;
    }

    // Format both numbers to 254 for consistent backend processing
    const topupNumber = formatTo254(rawTopupNumber);
    const mpesaNumber = formatTo254(rawMpesaNumber);

    // Disable button and show loading state
    const submitButton = buyForm.querySelector('button[type="submit"]');
    submitButton.textContent = 'Processing...';
    submitButton.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topupNumber, amount, mpesaNumber }),
        });

        const data = await res.json();
        console.log('Server response:', data);

        if (res.ok) {
            showNotification('Payment initiated! Check your M-Pesa. Do not close the app.', 'success', 6000); // Longer duration for critical step

            // Store a PENDING transaction in IndexedDB
            const tx = {
                // Use CheckoutRequestID as the key for IndexedDB
                checkoutRequestID: data.CheckoutRequestID,
                topupNumber: topupNumber, // Consistent field name
                amount: amount,
                payerPhone: mpesaNumber, // Add payer's phone for local history
                status: 'PENDING',
                timestamp: new Date().toISOString(), // Client-side timestamp
            };
            saveTransaction(tx);
            buyForm.reset(); // Clear form after submission

        } else {
            showNotification(data.error || 'Server error. Please try again.', 'error');
        }
    } catch (err) {
        console.error('Fetch error:', err);
        showNotification('Network error. Please check your internet connection and try again.', 'error');
    } finally {
        // Re-enable button regardless of success or failure
        submitButton.textContent = 'Pay Now';
        submitButton.disabled = false;
    }
});

// --- Save transaction to IndexedDB ---
/**
 * Saves or updates a transaction record in IndexedDB.
 * @param {Object} tx The transaction object to save.
 */
function saveTransaction(tx) {
    // Ensure db is available
    if (!db) {
        console.error("IndexedDB not ready. Cannot save transaction.");
        showNotification("Local history not saving. DB not ready.", "error");
        return;
    }

    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    // Use put() for both adding new and updating existing records
    store.put(tx);

    transaction.oncomplete = () => {
        console.log("✅ Transaction saved/updated locally:", tx.checkoutRequestID);
        loadTransactions(); // Reload history to show the new/updated transaction
    };

    transaction.onerror = (event) => {
        console.error("❌ Error saving transaction to IndexedDB:", event.target.error);
        showNotification("Failed to save transaction locally.", "error");
    };
}

// --- Load and display transactions from IndexedDB ---
function loadTransactions() {
    if (!db) {
        console.warn("IndexedDB not ready. Cannot load transactions.");
        return;
    }
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    // Get all records
    const request = store.getAll();

    request.onsuccess = (event) => {
        const transactions = event.target.result;
        historyList.innerHTML = ''; // Clear current list

        if (!transactions.length) {
            historyList.innerHTML = '<p class="no-transactions">No local transactions yet. Initiate a top-up to see history!</p>';
            return;
        }

        // Sort by timestamp descending (newest first)
        transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        transactions.forEach(tx => {
            const card = document.createElement('div');
            card.className = 'transaction-card'; // Use the consistent class from style.css
            // Add a class based on status for visual feedback
            if (tx.status === 'COMPLETED') {
                card.classList.add('status-completed');
            } else if (tx.status.startsWith('FAILED')) {
                card.classList.add('status-failed');
            } else {
                card.classList.add('status-pending');
            }

            // Display CheckoutRequestID as "Reference ID" for clarity
            card.innerHTML = `
                <h4>Airtime Top-Up</h4>
                <p><strong>Reference ID:</strong> ${tx.checkoutRequestID || 'N/A'}</p>
                <p><strong>To:</strong> ${tx.topupNumber}</p>
                <p><strong>Amount:</strong> KES ${tx.amount}</p>
                <p><strong>Status:</strong> <span class="transaction-status">${tx.status}</span></p>
                <p><small>${new Date(tx.timestamp).toLocaleString()}</small></p>
            `;
            historyList.appendChild(card);
        });
    };

    request.onerror = (event) => {
        console.error("❌ Error loading transactions from IndexedDB:", event.target.error);
        showNotification("Failed to load local transaction history.", "error");
    };
}

// --- Polling for transaction status (Simple example, can be improved) ---
// This is a basic example. For real-time updates, WebSockets are better.
// This will poll ALL pending transactions every X seconds.
async function pollTransactionStatuses() {
    if (!db) return;

    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = async (event) => {
        const transactions = event.target.result;
        const pendingTransactions = transactions.filter(tx => tx.status === 'PENDING');

        for (const tx of pendingTransactions) {
            try {
                // You'll need to ADD this endpoint to your server.js
                const res = await fetch(`${API_BASE_URL}/transaction-status/${tx.checkoutRequestID}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.status && data.status !== 'PENDING') {
                        // Update local IndexedDB with new status and backend timestamp
                        const updatedTx = {
                            ...tx, 
                            status: data.status,
                            timestamp: data.completedAt || data.createdAt || tx.timestamp, 
                            mpesaReceiptNumber: data.mpesaReceiptNumber
                        };
                        saveTransaction(updatedTx); // This will also call loadTransactions()
                        console.log(`✅ Status updated for ${tx.checkoutRequestID}: ${data.status}`);
                    }
                } else {
                    console.warn(`Could not get status for ${tx.checkoutRequestID}: ${res.status} ${res.statusText}`);
                }
            } catch (err) {
                console.error(`Error polling status for ${tx.checkoutRequestID}:`, err);
            }
        }
    };
}

// Start polling every 10 seconds (adjust as needed)
setInterval(pollTransactionStatuses, 10000); // Uncomment this line to enable polling
// NOTE: You need to add a `/transaction-status/:id` endpoint to your server.js first!
