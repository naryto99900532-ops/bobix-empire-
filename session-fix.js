/**
 * Файл для исправления проблем с сессиями Supabase
 */

// Глобальная переменная для отслеживания попыток входа
let loginAttempts = 0;
const MAX_LOGIN_ATTEMPTS = 3;

/**
 * Проверка и восстановление сессии
 */
async function checkAndFixSession() {
    try {
        // Получаем текущего пользователя
        const { data: { user }, error } = await _supabase.auth.getUser();
        
        if (error) {
            console.log('Ошибка получения пользователя:', error);
            await clearAllAuthData();
            return null;
        }
        
        if (user) {
            console.log('Пользователь найден:', user.email);
            return user;
        }
        
        return null;
        
    } catch (error) {
        console.error('Критическая ошибка проверки сессии:', error);
        await clearAllAuthData();
        return null;
    }
}

/**
 * Полная очистка данных аутентификации
 */
async function clearAllAuthData() {
    console.log('Очистка данных аутентификации...');
    
    // Список ключей для удаления
    const keysToRemove = [
        'supabase.auth.token',
        'sb-tstyjtgcisdelkkltyjo-auth-token',
        'sb-tstyjtgcisdelkkltyjo-auth-token.1',
        'sb-tstyjtgcisdelkkltyjo-auth-token.2'
    ];
    
    // Удаляем ключи из localStorage
    keysToRemove.forEach(key => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.log(`Не удалось удалить ${key}:`, e);
        }
    });
    
    // Очищаем sessionStorage
    try {
        sessionStorage.clear();
    } catch (e) {
        console.log('Ошибка очистки sessionStorage:', e);
    }
    
    // Очищаем cookies связанные с аутентификацией
    try {
        document.cookie.split(";").forEach(function(c) {
            const cookieName = c.split("=")[0].trim();
            if (cookieName.includes('supabase') || cookieName.includes('sb-')) {
                document.cookie = cookieName + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            }
        });
    } catch (e) {
        console.log('Ошибка очистки cookies:', e);
    }
    
    console.log('Данные аутентификации очищены');
}

/**
 * Форсированный вход с очисткой кэша
 */
async function forcedLogin(email, password) {
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        showNotification('Слишком много попыток. Подождите 5 минут.', 'error');
        return null;
    }
    
    loginAttempts++;
    
    try {
        // Сначала очищаем все данные
        await clearAllAuthData();
        
        // Ждем немного для гарантии очистки
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Пробуем войти
        const { data, error } = await _supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            console.error('Ошибка при форсированном входе:', error);
            
            // Если ошибка связана с сессией, пробуем альтернативный метод
            if (error.message.includes('session') || error.message.includes('token')) {
                return await alternativeLoginMethod(email, password);
            }
            
            throw error;
        }
        
        // Сбрасываем счетчик попыток при успешном входе
        loginAttempts = 0;
        
        return data;
        
    } catch (error) {
        console.error('Критическая ошибка при форсированном входе:', error);
        return null;
    }
}

/**
 * Альтернативный метод входа
 */
async function alternativeLoginMethod(email, password) {
    console.log('Попытка альтернативного метода входа...');
    
    try {
        // Создаем новый клиент Supabase
        const tempSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            }
        });
        
        const { data, error } = await tempSupabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        // Переносим токен в основной клиент
        if (data.session) {
            await _supabase.auth.setSession(data.session);
        }
        
        return data;
        
    } catch (error) {
        console.error('Альтернативный метод тоже не сработал:', error);
        return null;
    }
}

/**
 * Обработка входа с автоматическим исправлением
 */
async function smartLogin(email, password) {
    try {
        setLoadingState(true);
        
        // Пробуем обычный вход
        const { data: normalData, error: normalError } = await _supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (!normalError && normalData) {
            // Обычный вход успешен
            showSuccess('Вход выполнен успешно!');
            setTimeout(() => {
                window.location.href = 'management.html?login=' + Date.now();
            }, 1000);
            return;
        }
        
        // Если обычный вход не сработал, пробуем форсированный
        console.log('Обычный вход не сработал, пробуем форсированный...');
        const forcedData = await forcedLogin(email, password);
        
        if (forcedData) {
            showSuccess('Вход выполнен успешно!');
            setTimeout(() => {
                window.location.href = 'management.html?login=' + Date.now();
            }, 1000);
        } else {
            // Если и форсированный не сработал
            if (normalError.message.includes('Invalid login credentials')) {
                showError('Неверный email или пароль');
            } else {
                showError('Ошибка входа. Попробуйте очистить кэш браузера (Ctrl+F5)');
            }
            setLoadingState(false);
        }
        
    } catch (error) {
        console.error('Неожиданная ошибка при входе:', error);
        showError('Произошла непредвиденная ошибка. Попробуйте еще раз.');
        setLoadingState(false);
    }
}

// Обновляем обработчик входа в auth.js
document.addEventListener('DOMContentLoaded', function() {
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            
            if (isSignUp) {
                // Регистрация
                const username = document.getElementById('username').value.trim();
                const confirmPass = document.getElementById('confirmPass').value;
                
                if (!validateForm(email, password, username, confirmPass)) {
                    return;
                }
                
                await handleSignUp(email, password, username);
            } else {
                // Вход - используем умный вход
                if (!email || !password) {
                    showError('Заполните все поля');
                    return;
                }
                
                await smartLogin(email, password);
            }
        });
    }
    
    // Проверяем сессию при загрузке
    checkAndFixSession();
});
