/**
 * Редактор новостей с улучшенным интерфейсом
 * Обновленная версия для лучшей интеграции с другими файлами
 */

// Текущий файл изображения
let currentNewsImageFile = null;
let isUploading = false;

/**
 * Открытие редактора новостей (универсальная функция)
 */
window.openNewsEditor = async function() {
    console.log('Открытие редактора новостей (улучшенная версия)');
    
    try {
        // Проверяем права
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            showNotification('Пожалуйста, войдите в систему', 'error');
            return;
        }
        
        // Получаем роль
        const { data: profile } = await _supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        
        if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
            showNotification('Только администраторы могут создавать новости', 'error');
            return;
        }
        
        // Сбрасываем форму
        resetNewsEditor();
        
        // Пробуем разные ID модальных окон
        const modalIds = ['newsEditorModal', 'createPostModal'];
        let foundModal = null;
        
        for (const modalId of modalIds) {
            const modal = document.getElementById(modalId);
            if (modal) {
                foundModal = modal;
                console.log('Найдено модальное окно редактора:', modalId);
                break;
            }
        }
        
        if (foundModal) {
            // Показываем модальное окно
            foundModal.style.display = 'flex';
            
            // Фокусируемся на заголовке
            setTimeout(() => {
                const titleInput = document.getElementById('newsTitle') || document.getElementById('postTitle');
                if (titleInput) {
                    titleInput.focus();
                }
            }, 100);
        } else {
            console.error('Модальное окно редактора не найдено');
            // Используем универсальную функцию как fallback
            if (typeof window.openCreatePostModal === 'function') {
                window.openCreatePostModal();
            } else {
                alert('Редактор новостей не доступен');
            }
        }
        
    } catch (error) {
        console.error('Ошибка открытия редактора:', error);
        showNotification('Ошибка открытия редактора', 'error');
    }
};

/**
 * Закрытие редактора новостей
 */
window.closeNewsEditor = function() {
    console.log('Закрытие редактора новостей');
    
    if (isUploading) {
        if (!confirm('Идет загрузка изображения. Вы уверены, что хотите закрыть редактор?')) {
            return;
        }
    }
    
    // Закрываем все возможные модальные окна редактора
    const modalIds = ['newsEditorModal', 'createPostModal'];
    
    modalIds.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    });
    
    resetNewsEditor();
};

// Остальной код news-editor.js остается без изменений...
// [Вся остальная часть файла news-editor.js остается ТОЧНО такой же, как в предоставленном вами коде]
