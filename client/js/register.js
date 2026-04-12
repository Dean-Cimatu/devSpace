document.addEventListener('DOMContentLoaded', function () {
    const dobInput = document.getElementById('DateOfBirth');
    if (dobInput) {
        const today = new Date();
        dobInput.max = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate()).toISOString().split('T')[0];
        dobInput.min = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate()).toISOString().split('T')[0];
        dobInput.required = true;
    }

    const registerForm = document.querySelector('#registerForm form');
    if (registerForm) {
        registerForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const formData = {
                username:    document.getElementById('username').value,
                email:       document.getElementById('email').value,
                password:    document.getElementById('password').value,
                dateOfBirth: document.getElementById('DateOfBirth').value
            };

            const dob = new Date(formData.dateOfBirth);
            const today = new Date();
            if (!formData.dateOfBirth || isNaN(dob.getTime())) {
                displayMessage('Please enter a valid date of birth.', 'error'); return;
            }
            if (dob > today) {
                displayMessage('Date of birth cannot be in the future.', 'error'); return;
            }
            if (dob > new Date(today.getFullYear() - 13, today.getMonth(), today.getDate())) {
                displayMessage('You must be at least 13 years old to register.', 'error'); return;
            }

            const result = auth.register(formData);
            displayMessage(result.message, result.success ? 'success' : 'error');

            if (result.success) {
                registerForm.reset();
                setTimeout(() => { window.location.href = '/pages/login.html'; }, 2000);
            }
        });
    }
});

function displayMessage(message, type = 'info') {
    const existing = document.querySelector('.auth-message');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.className = `auth-message ${type}`;
    div.textContent = message;
    div.style.cssText = `
        padding: 10px 15px; margin: 10px 0; border-radius: 5px;
        font-family: 'Pickyside', monospace; font-weight: bold; text-align: center;
        ${type === 'success' ? 'background: rgba(0,128,0,0.8); color: white;' : ''}
        ${type === 'error'   ? 'background: rgba(220,20,60,0.8); color: white;' : ''}
        ${type === 'info'    ? 'background: rgba(70,130,180,0.8); color: white;' : ''}
    `;

    const form = document.querySelector('#registerForm');
    if (form) {
        form.insertBefore(div, form.firstChild);
        setTimeout(() => { if (div.parentNode) div.remove(); }, 5000);
    }
}
