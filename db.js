/**
 * Инициализация клиента Supabase
 * URL и ключ из настроек проекта
 */

// Константы для подключения к Supabase
const SUPABASE_URL = 'https://tstyjtgcisdelkkltyjo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdHlqdGdjaXNkZWxra2x0eWpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMzgwOTIsImV4cCI6MjA4NTgxNDA5Mn0.0LXZMPUx__gP9Vnk1D5vV8RfScO2YPKP43HojV_I76s';

// Создаем глобальный клиент Supabase
try {
    // Проверяем, существует ли уже клиент
    if (typeof window._supabase === 'undefined') {
        // Инициализируем клиент с настройками для лучшей совместимости
        window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false,
                storage: window.localStorage,
                storageKey: 'supabase.auth.token'
            },
            global: {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            }
        });
        
        console.log('Supabase клиент успешно инициализирован');
        
        // Проверяем подключение
        testSupabaseConnection();
    } else {
        console.log('Supabase клиент уже существует');
    }
} catch (error) {
    console.error('Критическая ошибка инициализации Supabase:', error);
    // Создаем заглушку для предотвращения ошибок
    window._supabase = {
        auth: {
            getUser: () => ({ data: { user: null }, error: new Error('Supabase не инициализирован') }),
            signInWithPassword: () => ({ data: null, error: new Error('Supabase не инициализирован') }),
            signUp: () => ({ data: null, error: new Error('Supabase не инициализирован') }),
            signOut: () => ({ error: new Error('Supabase не инициализирован') })
        },
        from: () => ({
            select: () => ({ data: null, error: new Error('Supabase не инициализирован') }),
            insert: () => ({ data: null, error: new Error('Supabase не инициализирован') }),
            update: () => ({ data: null, error: new Error('Supabase не инициализирован') }),
            delete: () => ({ data: null, error: new Error('Supabase не инициализирован') })
        }),
        storage: {
            from: () => ({
                upload: () => ({ data: null, error: new Error('Supabase не инициализирован') }),
                getPublicUrl: () => ({ data: { publicUrl: null }, error: new Error('Supabase не инициализирован') })
            })
        }
    };
}

/**
 * Тестирование подключения к Supabase
 */
async function testSupabaseConnection() {
    try {
        console.log('Тестирование подключения к Supabase...');
        
        // Простая проверка через получение текущего пользователя
        const { data: { user }, error } = await _supabase.auth.getUser();
        
        if (error) {
            console.warn('Предупреждение при проверке подключения:', error.message);
        } else {
            console.log('Подключение к Supabase успешно');
            if (user) {
                console.log('Текущий пользователь:', user.email);
            }
        }
    } catch (error) {
        console.error('Ошибка тестирования подключения:', error);
    }
}

/**
 * Универсальная функция для безопасного доступа к Supabase
 */
function getSupabaseClient() {
    if (typeof window._supabase === 'undefined') {
        console.error('Supabase клиент не инициализирован');
        return null;
    }
    return window._supabase;
}

// Экспортируем для использования в других файлах
if (typeof window !== 'undefined') {
    window.getSupabaseClient = getSupabaseClient;
    window.testSupabaseConnection = testSupabaseConnection;
}

// Проверяем инициализацию при загрузке
document.addEventListener('DOMContentLoaded', function() {
    console.log('db.js загружен, Supabase статус:', 
        typeof window._supabase !== 'undefined' ? '✓' : '✗');
    
    // Тестируем подключение через 2 секунды
    setTimeout(() => {
        if (typeof testSupabaseConnection === 'function') {
            testSupabaseConnection();
        }
    }, 2000);
});
