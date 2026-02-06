/**
 * Простые функции для управления новостями
 */

// Глобальные переменные
window.newsPosts = [];
window.currentUserRole = 'user';

/**
 * Инициализация новостей
 */
window.initializeNews = async function() {
    console.log('Инициализация новостей...');
    
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
            }
        }
        
        // Загружаем новости
        await window.loadNewsPosts();
        
    } catch (error) {
        console.error('Ошибка инициализации новостей:', error);
    }
};
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
        if (!container) return;
        
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Загрузка новостей...</p></div>';
        
        const { data: posts, error } = await _supabase
            .from('news_posts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        window.newsPosts = posts || [];
        window.renderNewsPosts(window.newsPosts);
        
        // Показываем кнопку для админов
        if (window.currentUserRole === 'admin' || window.currentUserRole === 'owner') {
            const btn = document.getElementById('createNewsBtn');
            const header = document.querySelector('.admin-controls-header');
            if (btn) btn.style.display = 'inline-block';
            if (header) header.style.display = 'flex';
        }
        
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
 * Открытие модального окна создания поста
 */
window.openCreatePostModal = function() {
    console.log('Открытие окна создания новости');
    
    if (window.currentUserRole !== 'admin' && window.currentUserRole !== 'owner') {
        alert('Только администраторы могут создавать новости');
        return;
    }
    
    const modal = document.getElementById('createPostModal');
    if (modal) {
        // Сбрасываем форму
        document.getElementById('postTitle').value = '';
        document.getElementById('postContent').value = '';
        document.getElementById('postImage').value = '';
        document.getElementById('postPublished').checked = true;
        
        // Показываем модальное окно
        modal.style.display = 'flex';
        
        // Настраиваем форму
        const form = document.getElementById('createPostForm');
        if (form) {
            form.onsubmit = function(e) {
                e.preventDefault();
                window.createPost();
            };
        }
    } else {
        alert('Модальное окно не найдено');
    }
};

/**
 * Закрытие модального окна
 */
window.closeCreatePostModal = function() {
    const modal = document.getElementById('createPostModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

/**
 * Создание нового поста
 */
window.createPost = async function() {
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const published = document.getElementById('postPublished').checked;
    const imageFile = document.getElementById('postImage').files[0];
    
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    if (typeof _supabase !== 'undefined') {
        window.initializeNews();
    } else {
        console.error('Supabase не загружен');
    }
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
