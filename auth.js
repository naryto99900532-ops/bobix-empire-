/**
 * Скрипт управления авторизацией и регистрацией
 * Использует Supabase для аутентификации
 */

// Получаем элементы DOM
const modal = document.getElementById('authModal');
const loginBtn = document.getElementById('loginBtn');
const toggleAuth = document.getElementById('toggleAuth');
const authForm = document.getElementById('authForm');
const regFields = document.querySelectorAll('.reg-field');
const authTitle = document.getElementById('authTitle');
const submitBtn = document.getElementById('submitBtn');
const authError = document.getElementById('authError');

// Флаги состояния
let isSignUp = false;

// Инициализация событий при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    initializeAuth();
});

/**
 * Инициализация системы авторизации
 */
function initializeAuth() {
    // Проверяем наличие необходимых элементов
    if (!modal || !toggleAuth || !authForm || !authTitle || !submitBtn) {
        console.error('Не найдены необходимые элементы для авторизации');
        return;
    }
    
    // Назначаем обработчики событий
    setupEventListeners();
    
    // Проверяем текущую сессию
    checkCurrentSession();
}

/**
 * Настройка обработчиков событий
 */
function setupEventListeners() {
    // Переключение между входом и регистрацией
    toggleAuth.addEventListener('click', handleToggleAuth);
    
    // Обработка отправки формы
    authForm.addEventListener('submit', handleAuthSubmit);
    
    // Закрытие модального окна при клике вне его
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeAuthModal();
        }
    });
    
    // Закрытие модального окна по Escape
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal.style.display === 'flex') {
            closeAuthModal();
        }
    });
}

/**
 * Переключение между режимами входа и регистрации
 */
function handleToggleAuth() {
    isSignUp = !isSignUp;
    
    // Обновляем текст элементов
    authTitle.innerText = isSignUp ? "Регистрация в Bobix Corporation" : "Вход в систему";
    submitBtn.innerText = isSignUp ? "Создать аккаунт" : "Войти";
    toggleAuth.innerText = isSignUp ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться";
    
    // Показываем/скрываем дополнительные поля для регистрации
    regFields.forEach(el => {
        el.style.display = isSignUp ? 'block' : 'none';
    });
    
    // Убираем required атрибуты при входе, добавляем при регистрации
    const usernameInput = document.getElementById('username');
    const confirmPassInput = document.getElementById('confirmPass');
    
    if (isSignUp) {
        if (usernameInput) usernameInput.required = true;
        if (confirmPassInput) confirmPassInput.required = true;
    } else {
        if (usernameInput) usernameInput.required = false;
        if (confirmPassInput) confirmPassInput.required = false;
    }
    
    // Очищаем сообщения об ошибках
    clearError();
    
    // Сбрасываем фокус на первое поле
    const firstInput = authForm.querySelector('input');
    if (firstInput) {
        firstInput.focus();
    }
}

/**
 * Обработка отправки формы авторизации
 * @param {Event} e - Событие отправки формы
 */
async function handleAuthSubmit(e) {
    e.preventDefault();
    
    // Показываем состояние загрузки
    setLoadingState(true);
    
    // Получаем значения полей
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const username = document.getElementById('username') ? document.getElementById('username').value.trim() : '';
    
    // Валидация полей
    if (!validateForm(email, password, username)) {
        setLoadingState(false);
        return;
    }
    
    try {
        if (isSignUp) {
            // Регистрация нового пользователя
            await handleSignUp(email, password, username);
        } else {
            // Вход существующего пользователя
            await handleSignIn(email, password);
        }
    } catch (error) {
        // Обработка неожиданных ошибок
        showError('Произошла непредвиденная ошибка. Попробуйте еще раз.');
        console.error('Ошибка аутентификации:', error);
        setLoadingState(false);
    }
}

/**
 * Валидация формы
 * @param {string} email - Email пользователя
 * @param {string} password - Пароль
 * @param {string} username - Имя пользователя (только для регистрации)
 * @returns {boolean} - Результат валидации
 */
function validateForm(email, password, username) {
    // Очищаем предыдущие ошибки
    clearError();
    
    // Проверка email
    if (!email) {
        showError('Пожалуйста, введите email');
        return false;
    }
    
    if (!isValidEmail(email)) {
        showError('Пожалуйста, введите корректный email');
        return false;
    }
    
    // Проверка пароля
    if (!password) {
        showError('Пожалуйста, введите пароль');
        return false;
    }
    
    if (password.length < 6) {
        showError('Пароль должен содержать минимум 6 символов');
        return false;
    }
    
    // Дополнительные проверки для регистрации
    if (isSignUp) {
        if (!username) {
            showError('Пожалуйста, введите никнейм');
            return false;
        }
        
        if (username.length < 3) {
            showError('Никнейм должен содержать минимум 3 символа');
            return false;
        }
        
        const confirmPass = document.getElementById('confirmPass').value;
        if (password !== confirmPass) {
            showError('Пароли не совпадают');
            return false;
        }
    }
    
    return true;
}

/**
 * Проверка валидности email
 * @param {string} email - Email для проверки
 * @returns {boolean} - Результат проверки
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Обработка регистрации нового пользователя
 * @param {string} email - Email пользователя
 * @param {string} password - Пароль
 * @param {string} username - Никнейм пользователя
 */
async function handleSignUp(email, password, username) {
    try {
        const { data, error } = await _supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username,
                    role: 'user', // Роль по умолчанию
                    created_at: new Date().toISOString()
                }
            }
        });
        
        if (error) {
            // Обработка ошибок регистрации
            if (error.message.includes('already registered')) {
                showError('Пользователь с таким email уже зарегистрирован');
            } else if (error.message.includes('password')) {
                showError('Пароль слишком слабый. Используйте более сложный пароль');
            } else {
                showError(error.message);
            }
            setLoadingState(false);
            return;
        }
        
        // Регистрация успешна
        showSuccess('Аккаунт успешно создан! Проверьте вашу почту для подтверждения.');
        
        // Переключаем на форму входа через 3 секунды
        setTimeout(() => {
            if (isSignUp) {
                handleToggleAuth();
            }
            setLoadingState(false);
        }, 3000);
        
    } catch (error) {
        showError('Ошибка при регистрации. Попробуйте еще раз.');
        setLoadingState(false);
    }
}

/**
 * Обработка входа пользователя
 * @param {string} email - Email пользователя
 * @param {string} password - Пароль
 */
async function handleSignIn(email, password) {
    try {
        setLoadingState(true);
        
        // Сначала очищаем возможные остатки старой сессии
        await clearAuthDataManually();
        
        // Задержка для гарантии очистки
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const { data, error } = await _supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            // Обработка ошибок входа
            let errorMessage = 'Ошибка при входе';
            
            if (error.message.includes('Invalid login credentials')) {
                errorMessage = 'Неверный email или пароль';
            } else if (error.message.includes('Email not confirmed')) {
                errorMessage = 'Пожалуйста, подтвердите ваш email перед входом';
            } else if (error.message.includes('rate limit')) {
                errorMessage = 'Слишком много попыток. Подождите 1 минуту';
            } else {
                errorMessage = error.message;
            }
            
            showError(errorMessage);
            setLoadingState(false);
            return;
        }
        
        // Вход успешен
        showSuccess('Вход выполнен успешно!');
        
        // Сохраняем флаг успешного входа в sessionStorage
        sessionStorage.setItem('login_success', 'true');
        
        // Перенаправляем на панель управления с параметром для избежания кэширования
        setTimeout(() => {
            window.location.href = 'management.html?login=' + Date.now();
        }, 1000);
        
    } catch (error) {
        console.error('Неожиданная ошибка при входе:', error);
        showError('Произошла непредвиденная ошибка. Попробуйте еще раз.');
        setLoadingState(false);
    }
}
/**
 * Проверка текущей сессии пользователя
 */
async function checkCurrentSession() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        
        if (user) {
            // Пользователь уже авторизован
            updateUIForLoggedInUser(user);
        }
    } catch (error) {
        console.error('Ошибка при проверке сессии:', error);
    }
}

/**
 * Обновление UI для авторизованного пользователя
 * @param {object} user - Данные пользователя
 */
function updateUIForLoggedInUser(user) {
    // Обновляем кнопки входа
    const loginButtons = document.querySelectorAll('#loginBtn, #mainLoginBtn');
    
    loginButtons.forEach(button => {
        if (button) {
            button.innerHTML = '<i class="fas fa-tachometer-alt"></i> ПАНЕЛЬ УПРАВЛЕНИЯ';
            button.onclick = () => window.location.href = 'management.html';
        }
    });
}

/**
 * Открытие модального окна авторизации
 */
function openAuthModal() {
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Сбрасываем форму
        authForm.reset();
        clearError();
        
        // Устанавливаем фокус на первое поле
        const firstInput = authForm.querySelector('input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
}

/**
 * Закрытие модального окна авторизации
 */
function closeAuthModal() {
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Сбрасываем форму
        authForm.reset();
        clearError();
        
        // Возвращаемся к режиму входа
        if (isSignUp) {
            handleToggleAuth();
        }
    }
}

/**
 * Показать сообщение об ошибке
 * @param {string} message - Текст ошибки
 */
function showError(message) {
    if (authError) {
        authError.textContent = message;
        authError.style.display = 'block';
        
        // Автоматически скрыть ошибку через 5 секунд
        setTimeout(() => {
            clearError();
        }, 5000);
    } else {
        alert(message);
    }
}

/**
 * Показать сообщение об успехе
 * @param {string} message - Текст сообщения
 */
function showSuccess(message) {
    if (authError) {
        authError.textContent = message;
        authError.style.color = '#00ff00';
        authError.style.borderColor = '#00ff00';
        authError.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
        authError.style.display = 'block';
    }
}

/**
 * Очистить сообщения об ошибках/успехе
 */
function clearError() {
    if (authError) {
        authError.textContent = '';
        authError.style.display = 'none';
        authError.style.color = '';
        authError.style.borderColor = '';
        authError.style.backgroundColor = '';
    }
}

/**
 * Установить состояние загрузки
 * @param {boolean} isLoading - Флаг загрузки
 */
function setLoadingState(isLoading) {
    if (submitBtn) {
        submitBtn.disabled = isLoading;
        submitBtn.innerHTML = isLoading 
            ? '<i class="fas fa-spinner fa-spin"></i> Загрузка...' 
            : (isSignUp ? "Создать аккаунт" : "Войти");
    }
}

/**
 * Выход из системы
 */
async function logout() {
    try {
        // Показываем состояние загрузки
        const logoutBtns = document.querySelectorAll('.logout-btn');
        logoutBtns.forEach(btn => {
            if (btn) {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Выход...';
                btn.disabled = true;
                
                // Восстанавливаем через 3 секунды если что-то пошло не так
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.disabled = false;
                }, 3000);
            }
        });
        
        // Полный выход из Supabase
        const { error } = await _supabase.auth.signOut();
        
        if (error) {
            console.error('Ошибка при выходе:', error);
            // Пробуем альтернативный метод
            await clearAuthDataManually();
        }
        
        // Очищаем все локальные данные
        await clearAllAuthData();
        
        // Принудительное перенаправление с параметром для избежания кэширования
        setTimeout(() => {
            window.location.href = 'index.html?logout=' + Date.now() + '&nocache=' + Math.random();
        }, 500);
        
    } catch (error) {
        console.error('Критическая ошибка при выходе:', error);
        // Все равно пытаемся перенаправить
        window.location.href = 'index.html?forceLogout=true';
    }
}

/**
 * Очистка всех данных аутентификации вручную
 */
async function clearAuthDataManually() {
    try {
        // Очищаем localStorage
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.includes('supabase') || key.includes('auth') || key.includes('sb-')) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        // Очищаем sessionStorage
        sessionStorage.clear();
        
        // Очищаем cookies
        document.cookie.split(";").forEach(function(c) {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        
    } catch (error) {
        console.error('Ошибка при ручной очистке данных:', error);
    }
}

/**
 * Полная очистка всех данных аутентификации
 */
async function clearAllAuthData() {
    // Очищаем localStorage
    localStorage.clear();
    
    // Очищаем sessionStorage
    sessionStorage.clear();
    
    // Сбрасываем состояние Supabase
    try {
        // Отправляем запрос на сервер для полного выхода
        await fetch('https://tstyjtgcisdelkkltyjo.supabase.co/auth/v1/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${_supabase.auth.session()?.access_token}`,
                'apikey': SUPABASE_KEY
            }
        });
    } catch (error) {
        // Игнорируем ошибки при logout запросе
    }
}
