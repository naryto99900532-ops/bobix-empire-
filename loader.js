/**
 * Загрузчик для правильной инициализации функций
 */

// Ожидаем полной загрузки страницы
window.addEventListener('load', function() {
    console.log('=== ЗАГРУЗКА ПРИЛОЖЕНИЯ ===');
    
    // Проверяем загрузку всех необходимых функций
    const requiredFunctions = [
        'openCreatePostModal',
        'closeCreatePostModal',
        'loadNewsPosts',
        'loadPlayers',
        'loadTopPlayers',
        'loadAdministrators',
        'logout'
    ];
    
    console.log('Проверка функций:');
    requiredFunctions.forEach(funcName => {
        const exists = typeof window[funcName] === 'function';
        console.log(`  ${funcName}: ${exists ? '✓' : '✗'}`);
        
        if (!exists) {
            console.warn(`Функция ${funcName} не найдена!`);
        }
    });
    
    // Устанавливаем обработчики для кнопок
    setupButtonHandlers();
    
    // Инициализируем навигацию
    setupNavigation();
    
    console.log('=== ЗАГРУЗКА ЗАВЕРШЕНА ===');
});

/**
 * Настройка обработчиков для кнопок
 */
function setupButtonHandlers() {
    // Кнопка "Выложить новость"
    const createNewsBtn = document.getElementById('createNewsBtn');
    if (createNewsBtn) {
        createNewsBtn.onclick = function() {
            if (typeof window.openCreatePostModal === 'function') {
                window.openCreatePostModal();
            } else {
                console.error('openCreatePostModal не найдена');
                alert('Функция создания новости не загружена. Пожалуйста, обновите страницу (Ctrl+F5).');
            }
        };
        console.log('Обработчик для createNewsBtn установлен');
    }
    
    // Кнопка "Обновить" в новостях
    const refreshNewsBtn = document.querySelector('button[onclick*="loadNewsPosts"]');
    if (refreshNewsBtn) {
        refreshNewsBtn.onclick = function() {
            if (typeof window.loadNewsPosts === 'function') {
                window.loadNewsPosts();
            } else {
                location.reload();
            }
        };
    }
    
    // Кнопка выхода
    const logoutBtns = document.querySelectorAll('.logout-btn');
    logoutBtns.forEach(btn => {
        if (btn.onclick) return; // Если уже есть обработчик
        
        btn.onclick = function() {
            if (typeof window.logout === 'function') {
                window.logout();
            } else {
                window.location.href = 'index.html?logout=true';
            }
        };
    });
}

/**
 * Настройка навигации
 */
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const contentSections = document.querySelectorAll('.content-section');
    
    navItems.forEach(item => {
        // Удаляем старый обработчик если есть
        item.removeEventListener('click', handleNavClick);
        
        // Добавляем новый
        item.addEventListener('click', handleNavClick);
    });
    
    function handleNavClick(e) {
        e.preventDefault();
        
        // Удаляем активный класс у всех элементов
        navItems.forEach(nav => nav.classList.remove('active'));
        contentSections.forEach(section => section.classList.remove('active'));
        
        // Добавляем активный класс к выбранному элементу
        this.classList.add('active');
        
        // Показываем выбранную секцию
        const sectionId = this.getAttribute('data-section');
        const targetSection = document.getElementById(sectionId);
        
        if (targetSection) {
            targetSection.classList.add('active');
            
            // Загружаем данные для секции
            if (typeof loadSectionData === 'function') {
                loadSectionData(sectionId);
            } else {
                console.warn('Функция loadSectionData не найдена');
            }
        }
    }
}

/**
 * Показ уведомления (fallback)
 */
if (typeof showNotification !== 'function') {
    window.showNotification = function(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        alert(message);
    };
}

/**
 * Функция для загрузки новостей (fallback)
 */
if (typeof loadNewsPosts !== 'function') {
    window.loadNewsPosts = async function() {
        const newsContainer = document.getElementById('newsPosts');
        if (!newsContainer) return;
        
        newsContainer.innerHTML = `
            <div class="error-message">
                <p>Модуль новостей не загружен</p>
                <button class="admin-btn" onclick="location.reload()">Обновить страницу</button>
            </div>
        `;
    };
}

/**
 * Функция для открытия модального окна (fallback)
 */
if (typeof openCreatePostModal !== 'function') {
    window.openCreatePostModal = function() {
        alert('Для создания новостей необходимо обновить страницу (Ctrl+F5).');
        location.reload();
    };
}

/**
 * Функция для закрытия модального окна (fallback)
 */
if (typeof closeCreatePostModal !== 'function') {
    window.closeCreatePostModal = function() {
        const modal = document.getElementById('createPostModal');
        if (modal) {
            modal.style.display = 'none';
        }
    };
}
