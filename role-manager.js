/**
 * Менеджер ролей для управления правами доступа
 * Улучшенная система проверки и назначения ролей
 */

// Глобальные переменные для состояния ролей
window.currentUserRole = 'user';
window.isRoleLoaded = false;
window.roleCheckAttempts = 0;
const MAX_ROLE_CHECK_ATTEMPTS = 5;

/**
 * Инициализация системы ролей
 */
window.initializeRoleSystem = async function() {
    console.log('=== ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ РОЛЕЙ ===');
    
    try {
        // Проверяем авторизацию
        const { data: { user }, error: authError } = await _supabase.auth.getUser();
        
        if (authError) {
            console.error('Ошибка проверки авторизации:', authError);
            return;
        }
        
        if (!user) {
            console.log('Пользователь не авторизован');
            window.currentUserRole = 'user';
            window.isRoleLoaded = true;
            updateUIByRole();
            return;
        }
        
        console.log('Пользователь авторизован:', user.email);
        
        // Проверяем и создаем профиль если нужно
        await ensureUserProfile(user);
        
        // Загружаем роль пользователя
        await loadUserRole(user.id);
        
        // Проверяем, является ли пользователь владельцем
        await checkAndSetOwnerRole(user);
        
        // Обновляем интерфейс
        updateUIByRole();
        
        window.isRoleLoaded = true;
        console.log('Система ролей инициализирована. Роль:', window.currentUserRole);
        
    } catch (error) {
        console.error('Критическая ошибка инициализации системы ролей:', error);
        // Устанавливаем роль по умолчанию
        window.currentUserRole = 'user';
        window.isRoleLoaded = true;
        updateUIByRole();
    }
};

/**
 * Проверка и создание профиля пользователя
 */
async function ensureUserProfile(user) {
    try {
        console.log('Проверка профиля пользователя...');
        
        const { data: profile, error } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
        
        if (error) {
            console.error('Ошибка проверки профиля:', error);
            throw error;
        }
        
        if (!profile) {
            console.log('Профиль не найден, создаем новый...');
            
            // Создаем профиль с данными пользователя
            const newProfile = {
                id: user.id,
                username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
                email: user.email,
                role: 'user',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                discord: user.user_metadata?.discord || null
            };
            
            const { error: insertError } = await _supabase
                .from('profiles')
                .insert([newProfile]);
            
            if (insertError) {
                console.error('Ошибка создания профиля:', insertError);
                // Пробуем упрощенный вариант
                await createSimplifiedProfile(user);
            } else {
                console.log('Профиль успешно создан');
            }
        } else {
            console.log('Профиль найден:', profile.username);
        }
        
    } catch (error) {
        console.error('Ошибка в ensureUserProfile:', error);
        // Пробуем создать упрощенный профиль
        await createSimplifiedProfile(user);
    }
}

/**
 * Создание упрощенного профиля
 */
async function createSimplifiedProfile(user) {
    try {
        const simpleProfile = {
            id: user.id,
            username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
            email: user.email,
            role: 'user'
        };
        
        const { error } = await _supabase
            .from('profiles')
            .upsert([simpleProfile], {
                onConflict: 'id'
            });
        
        if (error) {
            console.error('Упрощенный профиль тоже не создан:', error);
        } else {
            console.log('Упрощенный профиль создан');
        }
    } catch (error) {
        console.error('Критическая ошибка создания упрощенного профиля:', error);
    }
}

/**
 * Загрузка роли пользователя
 */
async function loadUserRole(userId) {
    try {
        console.log('Загрузка роли пользователя...');
        
        const { data: profile, error } = await _supabase
            .from('profiles')
            .select('role, username')
            .eq('id', userId)
            .maybeSingle();
        
        if (error) {
            console.error('Ошибка загрузки роли:', error);
            window.currentUserRole = 'user';
            return;
        }
        
        if (profile) {
            window.currentUserRole = profile.role || 'user';
            console.log('Роль загружена:', window.currentUserRole);
            
            // Обновляем отображение в интерфейсе
            updateUserDisplay(profile.username, window.currentUserRole);
        } else {
            console.log('Профиль не найден при загрузке роли');
            window.currentUserRole = 'user';
        }
        
    } catch (error) {
        console.error('Критическая ошибка загрузки роли:', error);
        window.currentUserRole = 'user';
    }
}

/**
 * Проверка и установка роли владельца
 */
async function checkAndSetOwnerRole(user) {
    try {
        console.log('Проверка роли владельца...');
        
        // Проверяем, есть ли вообще владельцы в системе
        const { data: owners, error } = await _supabase
            .from('profiles')
            .select('id, email')
            .eq('role', 'owner');
        
        if (error) {
            console.error('Ошибка проверки владельцев:', error);
            return;
        }
        
        console.log('Найдено владельцев:', owners?.length || 0);
        
        // Если владельцев нет, проверяем, должен ли этот пользователь быть владельцем
        if (!owners || owners.length === 0) {
            console.log('Владельцы не найдены, проверяем email...');
            
            // Проверяем специальные email для назначения владельцем
            const ownerEmails = [
                user.email, // Текущий пользователь
                'admin@bobix.com', // Админ email
                'owner@bobix.com'  // Владелец email
            ];
            
            // Если это первый пользователь или специальный email, делаем владельцем
            const { data: allUsers, error: countError } = await _supabase
                .from('profiles')
                .select('id', { count: 'exact' });
            
            if (!countError && allUsers && allUsers.length <= 1) {
                console.log('Первый пользователь, назначаем владельцем');
                await setUserAsOwner(user.id);
            } else if (ownerEmails.includes(user.email)) {
                console.log('Специальный email, назначаем владельцем');
                await setUserAsOwner(user.id);
            }
        } else {
            console.log('Владельцы уже существуют в системе');
        }
        
    } catch (error) {
        console.error('Ошибка в checkAndSetOwnerRole:', error);
    }
}

/**
 * Установка пользователя как владельца
 */
async function setUserAsOwner(userId) {
    try {
        console.log('Назначение пользователя владельцем:', userId);
        
        const { error } = await _supabase
            .from('profiles')
            .update({ 
                role: 'owner',
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);
        
        if (error) {
            console.error('Ошибка назначения владельца:', error);
            
            // Пробуем альтернативный метод
            const { error: altError } = await _supabase
                .from('profiles')
                .update({ role: 'owner' })
                .eq('id', userId);
            
            if (altError) {
                console.error('Альтернативный метод тоже не сработал:', altError);
                return false;
            }
        }
        
        window.currentUserRole = 'owner';
        console.log('Пользователь назначен владельцем');
        return true;
        
    } catch (error) {
        console.error('Критическая ошибка setUserAsOwner:', error);
        return false;
    }
}

/**
 * Обновление отображения пользователя
 */
function updateUserDisplay(username, role) {
    try {
        const userNameElement = document.getElementById('userName');
        const userRoleElement = document.getElementById('userRole');
        const userAvatarElement = document.getElementById('userAvatar');
        
        if (userNameElement) {
            userNameElement.textContent = username || 'Пользователь';
        }
        
        if (userRoleElement) {
            userRoleElement.textContent = getRoleDisplayName(role);
        }
        
        if (userAvatarElement) {
            const initials = (username || 'BC').substring(0, 2).toUpperCase();
            userAvatarElement.textContent = initials;
        }
        
    } catch (error) {
        console.error('Ошибка обновления отображения пользователя:', error);
    }
}

/**
 * Получение отображаемого имени роли
 */
function getRoleDisplayName(role) {
    switch (role) {
        case 'owner': return '👑 Владелец';
        case 'admin': return '🛡️ Администратор';
        case 'user': return '👤 Пользователь';
        default: return '👤 Пользователь';
    }
}

/**
 * Обновление UI в зависимости от роли
 */
function updateUIByRole() {
    console.log('Обновление UI для роли:', window.currentUserRole);
    
    try {
        const adminElements = document.querySelectorAll('.admin-only');
        const ownerElements = document.querySelectorAll('.owner-only');
        const adminPanelNav = document.querySelector('[data-section="admin-panel"]');
        const ownerPanelNav = document.querySelector('[data-section="owner-panel"]');
        const administratorsNav = document.querySelector('[data-section="administrators"]');
        
        // Показываем/скрываем элементы в зависимости от роли
        if (window.currentUserRole === 'admin' || window.currentUserRole === 'owner') {
            adminElements.forEach(el => {
                if (el) el.style.display = 'block';
            });
            if (adminPanelNav) adminPanelNav.style.display = 'flex';
            if (administratorsNav) administratorsNav.style.display = 'flex';
        } else {
            adminElements.forEach(el => {
                if (el) el.style.display = 'none';
            });
            if (adminPanelNav) adminPanelNav.style.display = 'none';
            if (administratorsNav) administratorsNav.style.display = 'none';
        }
        
        if (window.currentUserRole === 'owner') {
            ownerElements.forEach(el => {
                if (el) el.style.display = 'block';
            });
            if (ownerPanelNav) ownerPanelNav.style.display = 'flex';
        } else {
            ownerElements.forEach(el => {
                if (el) el.style.display = 'none';
            });
            if (ownerPanelNav) ownerPanelNav.style.display = 'none';
        }
        
        // Обновляем кнопки в навигации
        updateNavigationButtons();
        
        console.log('UI обновлен для роли:', window.currentUserRole);
        
    } catch (error) {
        console.error('Ошибка обновления UI:', error);
    }
}

/**
 * Обновление кнопок в навигации
 */
function updateNavigationButtons() {
    try {
        // Кнопка создания новости
        const createNewsBtn = document.getElementById('createNewsBtn');
        if (createNewsBtn) {
            if (window.currentUserRole === 'admin' || window.currentUserRole === 'owner') {
                createNewsBtn.style.display = 'inline-block';
            } else {
                createNewsBtn.style.display = 'none';
            }
        }
        
        // Кнопки в админ панели
        const adminButtons = document.querySelectorAll('.admin-only');
        adminButtons.forEach(btn => {
            if (btn && (window.currentUserRole === 'admin' || window.currentUserRole === 'owner')) {
                btn.style.display = 'inline-block';
            } else if (btn) {
                btn.style.display = 'none';
            }
        });
        
    } catch (error) {
        console.error('Ошибка обновления кнопок навигации:', error);
    }
}

/**
 * Получение текущей роли пользователя
 */
window.getCurrentUserRole = function() {
    return window.currentUserRole;
};

/**
 * Проверка, является ли пользователь администратором
 */
window.isUserAdmin = function() {
    return window.currentUserRole === 'admin' || window.currentUserRole === 'owner';
};

/**
 * Проверка, является ли пользователь владельцем
 */
window.isUserOwner = function() {
    return window.currentUserRole === 'owner';
};

/**
 * Повторная проверка роли
 */
window.recheckUserRole = async function() {
    if (window.roleCheckAttempts >= MAX_ROLE_CHECK_ATTEMPTS) {
        console.warn('Превышено количество попыток проверки роли');
        return;
    }
    
    window.roleCheckAttempts++;
    console.log(`Повторная проверка роли (попытка ${window.roleCheckAttempts})`);
    
    await window.initializeRoleSystem();
};

/**
 * Принудительное назначение роли (только для разработки)
 */
window.forceSetRole = async function(role) {
    if (!role || !['user', 'admin', 'owner'].includes(role)) {
        console.error('Некорректная роль:', role);
        return false;
    }
    
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            console.error('Пользователь не авторизован');
            return false;
        }
        
        const { error } = await _supabase
            .from('profiles')
            .update({ role: role })
            .eq('id', user.id);
        
        if (error) {
            console.error('Ошибка принудительной установки роли:', error);
            return false;
        }
        
        window.currentUserRole = role;
        updateUIByRole();
        console.log('Роль принудительно установлена:', role);
        return true;
        
    } catch (error) {
        console.error('Критическая ошибка forceSetRole:', error);
        return false;
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    console.log('Менеджер ролей загружен');
    
    // Даем время на загрузку Supabase
    setTimeout(async () => {
        if (typeof _supabase !== 'undefined') {
            console.log('Supabase доступен, инициализируем систему ролей...');
            await window.initializeRoleSystem();
        } else {
            console.warn('Supabase не загружен, откладываем инициализацию ролей');
            // Пробуем еще раз через 2 секунды
            setTimeout(async () => {
                if (typeof _supabase !== 'undefined') {
                    await window.initializeRoleSystem();
                } else {
                    console.error('Supabase так и не загрузился');
                }
            }, 2000);
        }
    }, 1000);
});
