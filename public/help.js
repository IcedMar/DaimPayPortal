// help.js

document.addEventListener('DOMContentLoaded', () => {
  const helpForm = document.querySelector('.message');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const messageInput = document.getElementById('content');

  // Handle form submit
  helpForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const content = messageInput.value.trim();

    if (!email || !phone || !content) {
      alert('Please fill in all fields.');
      return;
    }

    console.log('✅ Message submitted:', { email, phone, content });

    // Example: You could POST to your backend like:
    // await fetch('/api/help-request', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ email, phone, content }),
    // });

    alert('Thank you! Your message has been sent. We will reach out soon.');

    // Optionally clear the form
    emailInput.value = '';
    phoneInput.value = '';
    messageInput.value = '';
  });
});
