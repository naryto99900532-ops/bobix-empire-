/**
 * Функции для управления новостями
 */

let newsPosts = [];
let currentEditingPostId = null;
let currentUserRole = 'user';

/**
 * Инициализация функций новостей
 */
async function initializeNewsFunctions() {
    try {
        // Получаем роль текущего пользователя
        const { data: { user } } = await _supabase.auth.getUser();
        if (user) {
            const { data: profile } = await _supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
            
            if (profile) {
                currentUserRole = profile.role || 'user';
            }
        }
        
        // Загружаем новости
        await loadNewsPosts();
        
        // Настраиваем обработчики
        setupNewsEventHandlers();
        
    } catch (error) {
        console.error('Ошибка инициализации новостей:', error);
    }
}

/**
 * Настройка обработчиков событий для новостей
 */
function setupNewsEventHandlers() {
    // Форма создания/редактирования поста
    const createPostForm = document.getElementById('createPostForm');
    if (createPostForm) {
        createPostForm.addEventListener('submit', handleCreatePost);
    }
    
    // Кнопка удаления изображения
    const removeImageBtn = document.querySelector('.remove-image-btn');
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', clearImagePreview);
    }
}

/**
 * Загрузка новостей
 */
async function loadNewsPosts() {
    try {
        const newsContainer = document.getElementById('newsPosts');
        if (!newsContainer) return;
        
        newsContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Загрузка новостей...</p></div>';
        
        // Получаем новости
        const { data: posts, error } = await _supabase
            .from('news_posts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        newsPosts = posts || [];
        renderNewsPosts(newsPosts);
        
        // Показываем/скрываем кнопку "Выложить новость"
        updateCreateNewsButton();
        
    } catch (error) {
        console.error('Ошибка загрузки новостей:', error);
        document.getElementById('newsPosts').innerHTML = `
            <div class="error-message">
                <p>Ошибка загрузки новостей: ${error.message}</p>
                <button class="admin-btn" onclick="loadNewsPosts()">Повторить попытку</button>
            </div>
        `;
    }
}

/**
 * Обновление кнопки создания новости
 */
function updateCreateNewsButton() {
    const createButton = document.getElementById('createNewsBtn');
    const adminHeader = document.querySelector('.admin-controls-header');
    
    if (currentUserRole === 'admin' || currentUserRole === 'owner') {
        if (createButton) createButton.style.display = 'inline-block';
        if (adminHeader) adminHeader.style.display = 'flex';
    } else {
        if (createButton) createButton.style.display = 'none';
        if (adminHeader) adminHeader.style.display = 'none';
    }
}

/**
 * Отображение новостей
 */
function renderNewsPosts(posts) {
    const newsContainer = document.getElementById('newsPosts');
    if (!newsContainer) return;
    
    if (!posts || posts.length === 0) {
        newsContainer.innerHTML = `
            <div class="no-news-message">
                <div class="no-news-icon">
                    <i class="fas fa-newspaper"></i>
                </div>
                <h3>Новостей пока нет</h3>
                <p>Будьте первым, кто опубликует новость!</p>
                ${(currentUserRole === 'admin' || currentUserRole === 'owner') ? 
                    `<button class="admin-btn primary" onclick="openCreatePostModal()" style="margin-top: 15px;">
                        <i class="fas fa-plus-circle"></i> Создать первый пост
                    </button>` : ''
                }
            </div>
        `;
        return;
    }
    
    let html = '';
    
    posts.forEach(post => {
        const canEdit = currentUserRole === 'admin' || currentUserRole === 'owner';
        const editControls = canEdit ? `
            <div class="post-actions">
                <button class="post-action-btn edit" onclick="openEditPostModal('${post.id}')">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
                <button class="post-action-btn delete" onclick="deletePost('${post.id}')">
                    <i class="fas fa-trash-alt"></i> Удалить
                </button>
            </div>
        ` : '';
        
        // Форматируем дату
        const postDate = new Date(post.created_at);
        const formattedDate = postDate.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Обрезаем текст если слишком длинный
        const displayContent = post.content.length > 500 
            ? post.content.substring(0, 500) + '...' 
            : post.content;
        
        // HTML для изображения
        const imageHtml = post.image_url ? `
            <div class="post-image-container">
                <img src="${post.image_url}" alt="${escapeHtml(post.title)}" 
                     class="post-image" onclick="openImageModal('${post.image_url}', '${escapeHtml(post.title)}')">
            </div>
        ` : '';
        
        html += `
            <div class="news-post-card" id="post-${post.id}">
                <div class="post-header">
                    <div class="post-author">
                        <div class="author-avatar">
                            ${(post.author_name || 'A').substring(0, 2).toUpperCase()}
                        </div>
                        <div class="author-info">
                            <h4>${escapeHtml(post.author_name || 'Администратор')}</h4>
                            <div class="post-date">
                                <i class="fas fa-calendar"></i> ${formattedDate}
                                ${!post.is_published ? '<span class="draft-badge">Черновик</span>' : ''}
                            </div>
                        </div>
                    </div>
                    ${editControls}
                </div>
                
                <div class="post-content">
                    <h3 class="post-title">${escapeHtml(post.title)}</h3>
                    
                    ${imageHtml}
                    
                    <div class="post-text">
                        ${formatPostContent(displayContent)}
                    </div>
                    
                    ${post.content.length > 500 ? `
                        <button class="read-more-btn" onclick="openPostDetails('${post.id}')">
                            <i class="fas fa-book-open"></i> Читать полностью
                        </button>
                    ` : ''}
                    
                    <div class="post-stats">
                        <span class="stat-item">
                            <i class="fas fa-eye"></i> ${post.view_count || 0} просмотров
                        </span>
                        <span class="stat-item">
                            <i class="fas fa-clock"></i> ${formatTimeAgo(post.created_at)}
                        </span>
                    </div>
                </div>
            </div>
        `;
    });
    
    newsContainer.innerHTML = html;
}

/**
 * Форматирование содержимого поста
 */
function formatPostContent(content) {
    // Заменяем переносы строк на <br>
    let formatted = escapeHtml(content).replace(/\n/g, '<br>');
    
    // Обрабатываем ссылки
    formatted = formatted.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    return formatted;
}

/**
 * Форматирование времени назад
 */
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) {
        return 'только что';
    } else if (diffMins < 60) {
        return `${diffMins} мин. назад`;
    } else if (diffHours < 24) {
        return `${diffHours} ч. назад`;
    } else if (diffDays < 7) {
        return `${diffDays} дн. назад`;
    } else {
        return new Date(dateString).toLocaleDateString('ru-RU');
    }
}

/**
 * Открытие модального окна создания поста
 */
function openCreatePostModal() {
    if (currentUserRole !== 'admin' && currentUserRole !== 'owner') {
        showNotification('Только администраторы могут публиковать новости', 'error');
        return;
    }
    
    currentEditingPostId = null;
    
    // Сбрасываем форму
    document.getElementById('postTitle').value = '';
    document.getElementById('postContent').value = '';
    document.getElementById('postPublished').checked = true;
    clearImagePreview();
    
    // Показываем модальное окно
    document.getElementById('createPostModal').style.display = 'flex';
    document.getElementById('postTitle').focus();
}

/**
 * Закрытие модального окна создания поста
 */
function closeCreatePostModal() {
    document.getElementById('createPostModal').style.display = 'none';
    currentEditingPostId = null;
}

/**
 * Предпросмотр изображения
 */
function previewImage(event) {
    const input = event.target;
    const preview = document.getElementById('imagePreview');
    
    if (!input.files || !input.files[0]) {
        preview.innerHTML = '<p>Перетащите изображение или нажмите для выбора</p>';
        return;
    }
    
    const file = input.files[0];
    
    // Проверяем размер файла (максимум 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Изображение слишком большое. Максимальный размер - 5MB', 'error');
        input.value = '';
        preview.innerHTML = '<p>Перетащите изображение или нажмите для выбора</p>';
        return;
    }
    
    // Проверяем тип файла
    if (!file.type.match('image.*')) {
        showNotification('Пожалуйста, выберите изображение', 'error');
        input.value = '';
        preview.innerHTML = '<p>Перетащите изображение или нажмите для выбора</p>';
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        preview.innerHTML = `
            <div class="image-preview-content">
                <img src="${e.target.result}" alt="Предпросмотр">
                <div class="image-info">
                    <p><i class="fas fa-file"></i> ${file.name}</p>
                    <p><i class="fas fa-weight"></i> ${(file.size / 1024).toFixed(2)} KB</p>
                </div>
                <button type="button" class="remove-image-btn" onclick="clearImagePreview()">
                    <i class="fas fa-times"></i> Удалить
                </button>
            </div>
        `;
    };
    
    reader.readAsDataURL(file);
}

/**
 * Очистка предпросмотра изображения
 */
function clearImagePreview() {
    const preview = document.getElementById('imagePreview');
    const input = document.getElementById('postImage');
    
    if (preview) {
        preview.innerHTML = '<p>Перетащите изображение или нажмите для выбора</p>';
    }
    
    if (input) {
        input.value = '';
    }
}

/**
 * Обработка создания/редактирования поста
 */
async function handleCreatePost(e) {
    e.preventDefault();
    
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const published = document.getElementById('postPublished').checked;
    const imageFile = document.getElementById('postImage').files[0];
    
    // Валидация
    if (!title || !content) {
        showNotification('Заполните заголовок и содержание', 'error');
        return;
    }
    
    if (title.length < 3) {
        showNotification('Заголовок должен содержать минимум 3 символа', 'error');
        return;
    }
    
    if (content.length < 10) {
        showNotification('Содержание должно содержать минимум 10 символов', 'error');
        return;
    }
    
    try {
        // Показываем состояние загрузки
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
        submitBtn.disabled = true;
        
        let imageUrl = null;
        
        // Загружаем изображение если есть
        if (imageFile) {
            imageUrl = await uploadImage(imageFile);
        }
        
        // Получаем данные текущего пользователя
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            throw new Error('Пользователь не найден');
        }
        
        const postData = {
            title,
            content,
            author_id: user.id,
            author_name: user.user_metadata?.username || user.email?.split('@')[0] || 'Администратор',
            is_published: published,
            updated_at: new Date().toISOString()
        };
        
        if (imageUrl) {
            postData.image_url = imageUrl;
        }
        
        let result;
        
        if (currentEditingPostId) {
            // Обновляем существующий пост
            result = await _supabase
                .from('news_posts')
                .update(postData)
                .eq('id', currentEditingPostId);
        } else {
            // Создаем новый пост
            postData.created_at = new Date().toISOString();
            postData.view_count = 0;
            result = await _supabase
                .from('news_posts')
                .insert([postData]);
        }
        
        const { error } = result;
        
        if (error) throw error;
        
        showNotification(
            currentEditingPostId ? 'Пост обновлен!' : 'Пост опубликован!',
            'success'
        );
        
        // Восстанавливаем кнопку
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        closeCreatePostModal();
        await loadNewsPosts();
        
    } catch (error) {
        console.error('Ошибка сохранения поста:', error);
        showNotification(`Ошибка сохранения поста: ${error.message}`, 'error');
        
        // Восстанавливаем кнопку при ошибке
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.innerHTML = currentEditingPostId ? 'Сохранить изменения' : 'Опубликовать';
        submitBtn.disabled = false;
    }
}

/**
 * Загрузка изображения в Supabase Storage
 */
async function uploadImage(file) {
    try {
        // Проверяем что storage bucket существует
        const { data: buckets, error: bucketsError } = await _supabase.storage.listBuckets();
        
        if (bucketsError) {
            console.error('Ошибка получения buckets:', bucketsError);
            throw new Error('Ошибка загрузки изображения');
        }
        
        // Ищем bucket для новостей
        let newsBucket = buckets.find(b => b.name === 'news-images');
        
        // Если bucket не существует, используем fallback
        if (!newsBucket) {
            console.warn('Bucket news-images не найден, используем публичный URL');
            return URL.createObjectURL(file); // Возвращаем локальный URL как fallback
        }
        
        // Создаем уникальное имя файла
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileExtension = file.name.split('.').pop();
        const fileName = `news_${timestamp}_${randomString}.${fileExtension}`;
        const filePath = `news-images/${fileName}`;
        
        // Загружаем файл
        const { data: uploadData, error: uploadError } = await _supabase.storage
            .from('news-images')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (uploadError) {
            console.error('Ошибка загрузки изображения:', uploadError);
            throw new Error('Не удалось загрузить изображение');
        }
        
        // Получаем публичный URL
        const { data: { publicUrl } } = _supabase.storage
            .from('news-images')
            .getPublicUrl(filePath);
        
        return publicUrl;
        
    } catch (error) {
        console.error('Ошибка загрузки изображения:', error);
        // Возвращаем локальный URL как fallback
        return URL.createObjectURL(file);
    }
}

/**
 * Открытие модального окна редактирования поста
 */
async function openEditPostModal(postId) {
    if (currentUserRole !== 'admin' && currentUserRole !== 'owner') {
        showNotification('Только администраторы могут редактировать новости', 'error');
        return;
    }
    
    try {
        const post = newsPosts.find(p => p.id === postId);
        if (!post) {
            showNotification('Пост не найден', 'error');
            return;
        }
        
        currentEditingPostId = postId;
        
        // Заполняем форму данными поста
        document.getElementById('postTitle').value = post.title;
        document.getElementById('postContent').value = post.content;
        document.getElementById('postPublished').checked = post.is_published;
        
        // Обновляем предпросмотр изображения если есть
        const preview = document.getElementById('imagePreview');
        if (post.image_url) {
            preview.innerHTML = `
                <div class="image-preview-content">
                    <img src="${post.image_url}" alt="${escapeHtml(post.title)}">
                    <div class="image-info">
                        <p><i class="fas fa-check-circle"></i> Используется текущее изображение</p>
                        <button type="button" class="remove-image-btn" onclick="clearImagePreview()">
                            <i class="fas fa-times"></i> Удалить
                        </button>
                    </div>
                </div>
            `;
        } else {
            clearImagePreview();
        }
        
        // Показываем модальное окно
        document.getElementById('createPostModal').style.display = 'flex';
        document.getElementById('postTitle').focus();
        
    } catch (error) {
        console.error('Ошибка открытия формы редактирования:', error);
        showNotification('Ошибка загрузки данных поста', 'error');
    }
}

/**
 * Удаление поста
 */
async function deletePost(postId) {
    if (!confirm('Вы уверены, что хотите удалить этот пост? Это действие нельзя отменить.')) {
        return;
    }
    
    try {
        const { error } = await _supabase
            .from('news_posts')
            .delete()
            .eq('id', postId);
        
        if (error) throw error;
        
        showNotification('Пост удален!', 'success');
        await loadNewsPosts();
        
    } catch (error) {
        console.error('Ошибка удаления поста:', error);
        showNotification('Ошибка удаления поста', 'error');
    }
}

/**
 * Открытие поста в полном размере
 */
async function openPostDetails(postId) {
    try {
        const post = newsPosts.find(p => p.id === postId);
        if (!post) return;
        
        // Увеличиваем счетчик просмотров
        await _supabase
            .from('news_posts')
            .update({ 
                view_count: (post.view_count || 0) + 1,
                updated_at: new Date().toISOString()
            })
            .eq('id', postId);
        
        // Создаем модальное окно для полного просмотра
        const modalHTML = `
            <div class="modal" id="postDetailsModal" style="display: flex;">
                <div class="modal-content" style="max-width: 800px; max-height: 90vh;">
                    <span class="close-modal" onclick="closePostDetailsModal()">&times;</span>
                    
                    <div class="post-details-header">
                        <div class="post-author">
                            <div class="author-avatar">
                                ${(post.author_name || 'A').substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h4>${escapeHtml(post.author_name || 'Администратор')}</h4>
                                <div class="post-date">
                                    <i class="fas fa-calendar"></i> ${new Date(post.created_at).toLocaleDateString('ru-RU', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <h2 class="post-details-title">${escapeHtml(post.title)}</h2>
                    
                    ${post.image_url ? `
                        <div class="post-details-image">
                            <img src="${post.image_url}" alt="${escapeHtml(post.title)}" 
                                 onclick="openImageModal('${post.image_url}', '${escapeHtml(post.title)}')">
                        </div>
                    ` : ''}
                    
                    <div class="post-details-content">
                        ${formatPostContent(post.content)}
                    </div>
                    
                    <div class="post-details-stats">
                        <span class="stat-item">
                            <i class="fas fa-eye"></i> ${(post.view_count || 0) + 1} просмотров
                        </span>
                        <span class="stat-item">
                            <i class="fas fa-clock"></i> ${formatTimeAgo(post.created_at)}
                        </span>
                    </div>
                </div>
            </div>
        `;
        
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
    } catch (error) {
        console.error('Ошибка открытия деталей поста:', error);
        showNotification('Ошибка загрузки поста', 'error');
    }
}

/**
 * Закрытие модального окна деталей поста
 */
function closePostDetailsModal() {
    const modal = document.getElementById('postDetailsModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Открытие изображения в полном размере
 */
function openImageModal(imageUrl, title) {
    const modalHTML = `
        <div class="modal" id="imageModal" style="display: flex; background: rgba(0,0,0,0.95);">
            <div class="modal-content" style="background: transparent; border: none; box-shadow: none; max-width: 95vw; max-height: 95vh;">
                <span class="close-modal" onclick="closeImageModal()" style="color: white; font-size: 40px; position: fixed; top: 20px; right: 30px; z-index: 10001;">&times;</span>
                <div style="display: flex; justify-content: center; align-items: center; height: 100%;">
                    <img src="${imageUrl}" alt="${escapeHtml(title)}" style="max-width: 100%; max-height: 90vh; border-radius: 10px; box-shadow: 0 0 30px rgba(0,0,0,0.5);">
                </div>
                <p style="color: white; text-align: center; margin-top: 20px; font-size: 1.2rem;">${escapeHtml(title)}</p>
            </div>
        </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
}

/**
 * Закрытие модального окна изображения
 */
function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Экранирование HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    initializeNewsFunctions();
    
    // Drag and drop для загрузки изображений
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) {
        imagePreview.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.style.borderColor = 'var(--accent)';
            this.style.background = 'rgba(255, 215, 0, 0.05)';
        });
        
        imagePreview.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.style.borderColor = '';
            this.style.background = '';
        });
        
        imagePreview.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.borderColor = '';
            this.style.background = '';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type.match('image.*')) {
                    const input = document.getElementById('postImage');
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    input.files = dataTransfer.files;
                    
                    // Триггерим событие change
                    const event = new Event('change', { bubbles: true });
                    input.dispatchEvent(event);
                } else {
                    showNotification('Пожалуйста, перетащите изображение', 'error');
                }
            }
        });
        
        // Клик для выбора файла
        imagePreview.addEventListener('click', function() {
            document.getElementById('postImage').click();
        });
    }
});

// Экспорт функций для глобального использования
if (typeof window !== 'undefined') {
    window.openCreatePostModal = openCreatePostModal;
    window.closeCreatePostModal = closeCreatePostModal;
    window.previewImage = previewImage;
    window.clearImagePreview = clearImagePreview;
    window.openEditPostModal = openEditPostModal;
    window.deletePost = deletePost;
    window.openPostDetails = openPostDetails;
    window.closePostDetailsModal = closePostDetailsModal;
    window.openImageModal = openImageModal;
    window.closeImageModal = closeImageModal;
    window.loadNewsPosts = loadNewsPosts;
}
