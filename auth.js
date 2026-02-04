const modal = document.getElementById('authModal');
const loginBtn = document.getElementById('loginBtn');
const toggleAuth = document.getElementById('toggleAuth');
const authForm = document.getElementById('authForm');
const regFields = document.querySelectorAll('.reg-field');
let isSignUp = false;

if(loginBtn) loginBtn.onclick = () => modal.style.display = 'flex';

toggleAuth.onclick = () => {
    isSignUp = !isSignUp;
    document.getElementById('authTitle').innerText = isSignUp ? "Регистрация" : "Вход";
    document.getElementById('submitBtn').innerText = isSignUp ? "Создать" : "Войти";
    regFields.forEach(el => el.style.display = isSignUp ? 'block' : 'none');
};

authForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;

    if (isSignUp) {
        if (password !== document.getElementById('confirmPass').value) return alert("Пароли не совпадают!");
        const { error } = await _supabase.auth.signUp({ email, password, options: { data: { username } } });
        if (error) alert(error.message); else alert("Успех! Теперь войдите.");
    } else {
        const { error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message); else window.location.href = 'dashboard.html';
    }
};
