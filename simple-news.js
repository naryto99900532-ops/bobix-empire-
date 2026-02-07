/**
 * Простые функции для управления новостями
 * Улучшенная версия с исправлением проблемы модального окна
 */

// Глобальные переменные
window.newsPosts = [];
window.currentUserRole = 'user';
window.newsInitialized = false;

/**
 * Инициализация новостей
 */
window.initializeNews = async function() {
    console.log('Инициализация новостей...');
    
    if (window.newsInitialized) {
        console.log('Новости уже инициализированы');
        return;
    }
    
    try {
        // Проверяем авторизацию
        const { data: { user } } = await _supabase.auth.getUser();
        if (user) {
            // Получаем роль
            const { data: profile } = await _supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
            
            if (profile) {
                window.currentUserRole = profile.role;
                console.log('Роль пользователя определена:', window.currentUserRole);
            }
        }
        
        // Загружаем новости
        await window.loadNewsPosts();
        
        window.newsInitialized = true;
        console.log('Новости успешно инициализированы');
        
        // Настраиваем обработчик для кнопки создания новости
        setupCreateNewsButton();
        
    } catch (error) {
        console.error('Ошибка инициализации новостей:', error);
        showNotification('Ошибка загрузки новостей', 'error');
    }
};

/**
 * Настройка кнопки создания новости
 */
function setupCreateNewsButton() {
    const createBtn = document.getElementById('createNewsBtn');
    if (createBtn) {
        console.log('Настройка обработчика для кнопки создания новости');
        
        // Удаляем старый обработчик, если есть
        createBtn.onclick = null;
        
        // Добавляем новый обработчик
        createBtn.onclick = function(event) {
            event.preventDefault();
            event.stopPropagation();
            
            console.log('Кнопка создания новости нажата');
            
            // Пробуем все доступные функции создания новости
            if (typeof window.openCreatePostModal === 'function') {
                console.log('Используем openCreatePostModal');
                window.openCreatePostModal();
            } else if (typeof window.openNewsEditor === 'function') {
                console.log('Используем openNewsEditor');
                window.openNewsEditor();
            } else if (typeof openNewsEditor === 'function') {
                console.log('Используем openNewsEditor (локальная)');
                openNewsEditor();
            } else {
                console.error('Функция создания новости не найдена!');
                alert('Функция создания новости не доступна. Пожалуйста, обновите страницу.');
            }
        };
        
        // Показываем кнопку для админов
        if (window.currentUserRole === 'admin' || window.currentUserRole === 'owner') {
            createBtn.style.display = 'inline-block';
        }
    } else {
        console.warn('Кнопка createNewsBtn не найдена');
    }
}

// В simple-news.js добавьте:
async function handleImageUpload(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    const preview = document.getElementById('imagePreview');
    const progress = document.getElementById('uploadProgress');
    
    // Показываем предпросмотр
    const reader = new FileReader();
    reader.onload = function(e) {
        preview.innerHTML = `
            <div class="image-preview-content">
                <img src="${e.target.result}" alt="Предпросмотр">
                <div class="image-info">
                    <p>${file.name} (${(file.size / 1024).toFixed(2)} KB)</p>
                    <button type="button" class="remove-image-btn" onclick="clearImagePreview()">
                        <i class="fas fa-times"></i> Удалить
                    </button>
                </div>
            </div>
        `;
    };
    reader.readAsDataURL(file);
    
    // Сохраняем файл для последующей загрузки
    window.currentImageFile = file;
}

function clearImagePreview() {
    const preview = document.getElementById('imagePreview');
    const input = document.getElementById('postImage');
    const progress = document.getElementById('uploadProgress');
    
    if (preview) {
        preview.innerHTML = `
            <p><i class="fas fa-cloud-upload-alt"></i> Перетащите изображение или нажмите для выбора</p>
            <small class="form-hint">Поддерживаемые форматы: JPG, PNG, GIF, WebP. Максимальный размер: 10MB</small>
        `;
    }
    
    if (input) input.value = '';
    if (progress) progress.style.display = 'none';
    
    delete window.currentImageFile;
}

// Обновите функцию createPost
window.createPost = async function() {
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const published = document.getElementById('postPublished').checked;
    
    if (!title || !content) {
        alert('Заполните заголовок и содержание');
        return;
    }
    
    try {
        // Показываем загрузку
        const submitBtn = document.querySelector('#createPostForm button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
        submitBtn.disabled = true;
        
        // Загружаем изображение если есть
        let imageUrl = null;
        if (window.currentImageFile) {
            if (typeof uploadNewsPhoto === 'function') {
                imageUrl = await uploadNewsPhoto(window.currentImageFile);
            } else {
                // Альтернативный метод
                imageUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(window.currentImageFile);
                });
            }
        }
        
        // Получаем пользователя
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) throw new Error('Пользователь не найден');
        
        // Создаем пост
        const postData = {
            title,
            content,
            author_id: user.id,
            author_name: user.user_metadata?.username || user.email,
            is_published: published,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        if (imageUrl) {
            postData.image_url = imageUrl;
        }
        
        const { error } = await _supabase
            .from('news_posts')
            .insert([postData]);
        
        if (error) throw error;
        
        showNotification('Новость успешно создана!', 'success');
        window.closeCreatePostModal();
        await window.loadNewsPosts();
        
        // Восстанавливаем кнопку
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
    } catch (error) {
        console.error('Ошибка создания новости:', error);
        alert('Ошибка создания новости: ' + error.message);
        
        // Восстанавливаем кнопку
        const submitBtn = document.querySelector('#createPostForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = 'Опубликовать новость';
            submitBtn.disabled = false;
        }
    }
};
/**
 * Загрузка новостей
 */
window.loadNewsPosts = async function() {
    try {
        const container = document.getElementById('newsPosts');
        if (!container) {
            console.warn('Контейнер newsPosts не найден');
            return;
        }
        
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Загрузка новостей...</p></div>';
        
        const { data: posts, error } = await _supabase
            .from('news_posts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        window.newsPosts = posts || [];
        window.renderNewsPosts(window.newsPosts);
        
        // Настраиваем кнопку для админов после загрузки новостей
        setTimeout(setupCreateNewsButton, 100);
        
    } catch (error) {
        console.error('Ошибка загрузки новостей:', error);
        const container = document.getElementById('newsPosts');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <p>Ошибка загрузки новостей</p>
                    <button class="admin-btn" onclick="window.loadNewsPosts()">Повторить</button>
                </div>
            `;
        }
    }
};

/**
 * Отображение новостей
 */
window.renderNewsPosts = function(posts) {
    const container = document.getElementById('newsPosts');
    if (!container) return;
    
    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="no-news">
                <i class="fas fa-newspaper"></i>
                <h3>Новостей пока нет</h3>
                ${window.currentUserRole === 'admin' || window.currentUserRole === 'owner' ? 
                    '<button class="admin-btn primary" onclick="window.openCreatePostModal()">Создать первую новость</button>' : 
                    '<p>Следите за обновлениями!</p>'}
            </div>
        `;
        return;
    }
    
    let html = '';
    
    posts.forEach(post => {
        const date = new Date(post.created_at).toLocaleDateString('ru-RU');
        
        html += `
            <div class="news-item">
                <div class="news-header">
                    <h3>${escapeHtml(post.title)}</h3>
                    <span class="news-date">${date}</span>
                </div>
                ${post.image_url ? `<img src="${post.image_url}" alt="${escapeHtml(post.title)}" class="news-image">` : ''}
                <div class="news-content">${escapeHtml(post.content.substring(0, 200))}...</div>
                <div class="news-footer">
                    <span>Автор: ${escapeHtml(post.author_name || 'Администратор')}</span>
                    ${window.currentUserRole === 'admin' || window.currentUserRole === 'owner' ? `
                        <div class="news-actions">
                            <button class="btn-small" onclick="window.editPost('${post.id}')">Редактировать</button>
                            <button class="btn-small delete" onclick="window.deletePost('${post.id}')">Удалить</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
};

/**
 * УНИВЕРСАЛЬНАЯ функция открытия модального окна создания поста
 * Эта функция будет вызываться из разных мест
 */
window.openCreatePostModal = function() {
    console.log('Универсальная функция openCreatePostModal вызвана');
    
    if (window.currentUserRole !== 'admin' && window.currentUserRole !== 'owner') {
        alert('Только администраторы могут создавать новости');
        return;
    }
    
    // Пробуем найти разные модальные окна
    const modalIds = ['createPostModal', 'newsEditorModal'];
    let foundModal = null;
    
    for (const modalId of modalIds) {
        const modal = document.getElementById(modalId);
        if (modal) {
            foundModal = modal;
            console.log('Найдено модальное окно:', modalId);
            break;
        }
    }
    
    if (foundModal) {
        // Сбрасываем форму
        const titleInput = document.getElementById('postTitle') || document.getElementById('newsTitle');
        const contentInput = document.getElementById('postContent') || document.getElementById('newsContent');
        
        if (titleInput) titleInput.value = '';
        if (contentInput) contentInput.value = '';
        
        // Показываем модальное окно
        foundModal.style.display = 'flex';
        
        // Настраиваем обработчик закрытия
        const closeButtons = foundModal.querySelectorAll('.close-modal');
        closeButtons.forEach(btn => {
            btn.onclick = function() {
                foundModal.style.display = 'none';
            };
        });
        
        // Фокусируемся на заголовке
        setTimeout(() => {
            if (titleInput) titleInput.focus();
        }, 100);
        
    } else {
        console.error('Ни одно модальное окно не найдено!');
        alert('Модальное окно не найдено. Проверьте наличие элементов с ID: createPostModal или newsEditorModal');
    }
};

/**
 * Закрытие модального окна
 */
window.closeCreatePostModal = function() {
    console.log('Закрытие модального окна');
    
    // Пробуем закрыть все возможные модальные окна
    const modalIds = ['createPostModal', 'newsEditorModal'];
    
    modalIds.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal && modal.style.display === 'flex') {
            modal.style.display = 'none';
            console.log('Закрыто окно:', modalId);
        }
    });
};

/**
 * Создание нового поста (альтернативная версия)
 */
window.createPostAlternative = async function() {
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const published = document.getElementById('postPublished').checked;
    const imageFile = document.getElementById('postImage')?.files[0];
    
    if (!title || !content) {
        alert('Заполните заголовок и содержание');
        return;
    }
    
    try {
        // Получаем пользователя
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) throw new Error('Пользователь не найден');
        
        let imageUrl = null;
        
        // Загружаем изображение если есть
        if (imageFile) {
            const timestamp = Date.now();
            const fileName = `news_${timestamp}.${imageFile.name.split('.').pop()}`;
            
            const { data, error } = await _supabase.storage
                .from('news-images')
                .upload(fileName, imageFile);
            
            if (!error) {
                const { data: { publicUrl } } = _supabase.storage
                    .from('news-images')
                    .getPublicUrl(fileName);
                imageUrl = publicUrl;
            }
        }
        
        // Создаем пост
        const postData = {
            title,
            content,
            author_id: user.id,
            author_name: user.user_metadata?.username || user.email,
            is_published: published,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        if (imageUrl) {
            postData.image_url = imageUrl;
        }
        
        const { error } = await _supabase
            .from('news_posts')
            .insert([postData]);
        
        if (error) throw error;
        
        alert('Новость успешно создана!');
        window.closeCreatePostModal();
        await window.loadNewsPosts();
        
    } catch (error) {
        console.error('Ошибка создания новости:', error);
        alert('Ошибка создания новости: ' + error.message);
    }
};

/**
 * Экранирование HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Показать уведомление (fallback)
 */
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        alert(message);
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    console.log('simple-news.js загружен');
    
    // Даем время на загрузку других скриптов
    setTimeout(() => {
        if (typeof _supabase !== 'undefined') {
            console.log('Supabase доступен, инициализируем новости...');
            window.initializeNews();
        } else {
            console.warn('Supabase не загружен, откладываем инициализацию новостей');
            // Пробуем еще раз через 2 секунды
            setTimeout(() => {
                if (typeof _supabase !== 'undefined') {
                    window.initializeNews();
                } else {
                    console.error('Supabase так и не загрузился');
                }
            }, 2000);
        }
    }, 500);
});
// В simple-news.js добавьте эту функцию рендеринга:
function renderNewsPosts(posts) {
    const container = document.getElementById('newsPosts');
    if (!container) return;
    
    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="no-news-message">
                <div class="no-news-icon">
                    <i class="fas fa-newspaper"></i>
                </div>
                <h3>Новостей пока нет</h3>
                <p>Будьте первым, кто опубликует новость!</p>
                ${(currentUserRole === 'admin' || currentUserRole === 'owner') ? 
                    `<button class="admin-btn primary" onclick="openNewsEditor()" style="margin-top: 15px;">
                        <i class="fas fa-plus-circle"></i> Создать первую новость
                    </button>` : ''
                }
            </div>
        `;
        return;
    }
    
    let html = '';
    
    posts.forEach((post, index) => {
        const canEdit = currentUserRole === 'admin' || currentUserRole === 'owner';
        const editControls = canEdit ? `
            <div class="post-actions">
                <button class="post-action-btn edit" onclick="editNewsPost('${post.id}')">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
                <button class="post-action-btn delete" onclick="deleteNewsPost('${post.id}')">
                    <i class="fas fa-trash-alt"></i> Удалить
                </button>
            </div>
        ` : '';
        
        const date = new Date(post.created_at);
        const formattedDate = date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Обрезаем текст для предпросмотра
        const shortContent = post.content.length > 300 ? 
            post.content.substring(0, 300) + '...' : 
            post.content;
        
        // HTML для изображения
        const imageHtml = post.image_url ? `
            <div class="post-image-container" onclick="openFullscreenImage('${post.image_url}', '${escapeHtml(post.title)}')">
                <img src="${post.image_url}" alt="${escapeHtml(post.title)}">
                <div class="image-overlay">
                    <i class="fas fa-expand-alt"></i> Нажмите для увеличения
                </div>
            </div>
        ` : '';
        
        // Определяем нужно ли показывать кнопку "Читать далее"
        const showReadMore = post.content.length > 300;
        
        html += `
            <div class="news-post-card" id="news-post-${post.id}" data-expanded="false">
                <div class="post-header">
                    <h3 class="post-title">${escapeHtml(post.title)}</h3>
                    <div class="post-date">${formattedDate}</div>
                </div>
                
                ${imageHtml}
                
                <div class="post-content">
                    ${formatNewsContent(shortContent)}
                </div>
                
                ${showReadMore ? `
                    <div class="expand-toggle" onclick="toggleNewsExpand('${post.id}')">
                        <i class="fas fa-chevron-down"></i>
                        <span>Читать далее</span>
                    </div>
                ` : ''}
                
                <div class="post-footer">
                    <div class="post-author">
                        <div class="author-avatar">
                            ${(post.author_name || 'A').substring(0, 2).toUpperCase()}
                        </div>
                        <div class="author-info">
                            <h4>${escapeHtml(post.author_name || 'Администратор')}</h4>
                        </div>
                    </div>
                    
                    <div class="post-stats">
                        <span class="stat-item">
                            <i class="fas fa-eye"></i> ${post.view_count || 0}
                        </span>
                        <span class="stat-item">
                            <i class="fas fa-clock"></i> ${formatTimeAgo(post.created_at)}
                        </span>
                    </div>
                </div>
                
                ${editControls}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Форматирование контента новости
 */
function formatNewsContent(content) {
    if (!content) return '';
    
    // Заменяем переносы строк на <br>
    let formatted = escapeHtml(content).replace(/\n/g, '<br>');
    
    // Обрабатываем ссылки
    formatted = formatted.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Обрабатываем жирный текст **текст**
    formatted = formatted.replace(
        /\*\*(.*?)\*\*/g,
        '<strong>$1</strong>'
    );
    
    // Обрабатываем курсив *текст*
    formatted = formatted.replace(
        /\*(.*?)\*/g,
        '<em>$1</em>'
    );
    
    return formatted;
}

/**
 * Развернуть/свернуть новость
 */
function toggleNewsExpand(postId) {
    const postElement = document.getElementById(`news-post-${postId}`);
    if (!postElement) return;
    
    const isExpanded = postElement.getAttribute('data-expanded') === 'true';
    
    if (!isExpanded) {
        // Загружаем полный текст если нужно
        const post = newsPosts.find(p => p.id === postId);
        if (post && post.content.length > 300) {
            const contentElement = postElement.querySelector('.post-content');
            if (contentElement) {
                contentElement.innerHTML = formatNewsContent(post.content);
            }
        }
        
        postElement.classList.add('expanded');
        postElement.setAttribute('data-expanded', 'true');
        
        const toggleBtn = postElement.querySelector('.expand-toggle span');
        if (toggleBtn) {
            toggleBtn.textContent = 'Свернуть';
        }
        
        const toggleIcon = postElement.querySelector('.expand-toggle i');
        if (toggleIcon) {
            toggleIcon.style.transform = 'rotate(180deg)';
        }
    } else {
        postElement.classList.remove('expanded');
        postElement.setAttribute('data-expanded', 'false');
        
        const toggleBtn = postElement.querySelector('.expand-toggle span');
        if (toggleBtn) {
            toggleBtn.textContent = 'Читать далее';
        }
        
        const toggleIcon = postElement.querySelector('.expand-toggle i');
        if (toggleIcon) {
            toggleIcon.style.transform = 'rotate(0deg)';
        }
    }
}

/**
 * Форматирование времени (сколько прошло)
 */
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMinutes < 60) {
        return `${diffMinutes} мин. назад`;
    } else if (diffHours < 24) {
        return `${diffHours} ч. назад`;
    } else if (diffDays < 7) {
        return `${diffDays} дн. назад`;
    } else {
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    }
}

// Экспортируем дополнительные функции
if (typeof window !== 'undefined') {
    window.formatNewsContent = formatNewsContent;
    window.toggleNewsExpand = toggleNewsExpand;
    window.formatTimeAgo = formatTimeAgo;
}
