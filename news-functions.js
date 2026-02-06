/**
 * Функции для управления новостями
 */

let newsPosts = [];
let currentEditingPostId = null;

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
 * Отображение новостей
 */
function renderNewsPosts(posts) {
    const newsContainer = document.getElementById('newsPosts');
    if (!newsContainer) return;
    
    if (!posts || posts.length === 0) {
        newsContainer.innerHTML = `
            <div class="threshold-card">
                <h3><i class="fas fa-newspaper"></i> Новостей пока нет</h3>
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
        const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
        const canEdit = isAdmin || post.author_id === currentUser?.id;
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
        
        const imageHtml = post.image_url ? `
            <div class="post-image">
                <img src="${post.image_url}" alt="${escapeHtml(post.title)}" onclick="openImageModal('${post.image_url}', '${escapeHtml(post.title)}')">
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
                                <i class="fas fa-calendar"></i> ${formatPostDate(post.created_at)}
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
                        ${formatPostContent(post.content)}
                    </div>
                    
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
 * Форматирование даты поста
 */
function formatPostDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
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
    
    if (diffMins < 60) {
        return `${diffMins} мин. назад`;
    } else if (diffHours < 24) {
        return `${diffHours} ч. назад`;
    } else if (diffDays < 7) {
        return `${diffDays} дн. назад`;
    } else {
        return formatPostDate(dateString);
    }
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
 * Открытие модального окна создания поста
 */
function openCreatePostModal() {
    if (currentUserRole !== 'admin' && currentUserRole !== 'owner') {
        showNotification('Только администраторы могут публиковать новости', 'error');
        return;
    }
    
    currentEditingPostId = null;
    document.getElementById('createPostModal').style.display = 'flex';
    document.getElementById('postTitle').focus();
    clearImagePreview();
}

/**
 * Закрытие модального окна создания поста
 */
function closeCreatePostModal() {
    document.getElementById('createPostModal').style.display = 'none';
    document.getElementById('createPostForm').reset();
    clearImagePreview();
    currentEditingPostId = null;
}

/**
 * Предпросмотр изображения
 */
function previewImage(event) {
    const input = event.target;
    const preview = document.getElementById('imagePreview');
    
    if (!input.files || !input.files[0]) {
        preview.innerHTML = '<p>Предпросмотр изображения появится здесь</p>';
        return;
    }
    
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        preview.innerHTML = `
            <img src="${e.target.result}" alt="Предпросмотр">
            <div class="image-info">
                <p>${file.name}</p>
                <p>${(file.size / 1024).toFixed(2)} KB</p>
            </div>
            <button type="button" class="remove-image-btn" onclick="clearImagePreview()">
                <i class="fas fa-times"></i> Удалить
            </button>
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
        preview.innerHTML = '<p>Предпросмотр изображения появится здесь</p>';
    }
    
    if (input) {
        input.value = '';
    }
}

/**
 * Сохранение как черновика
 */
async function saveAsDraft() {
    await createOrUpdatePost(false);
}

/**
 * Обработка создания/обновления поста
 */
document.getElementById('createPostForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    await createOrUpdatePost(true);
});

/**
 * Создание или обновление поста
 */
async function createOrUpdatePost(isPublished = true) {
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const published = document.getElementById('postPublished').checked;
    const imageFile = document.getElementById('postImage').files[0];
    
    if (!title || !content) {
        showNotification('Заполните заголовок и содержание', 'error');
        return;
    }
    
    try {
        let imageUrl = null;
        
        // Загружаем изображение если есть
        if (imageFile) {
            imageUrl = await uploadImage(imageFile);
        }
        
        const postData = {
            title,
            content,
            author_id: currentUser.id,
            author_name: currentUser.user_metadata?.username || currentUser.email,
            is_published: isPublished && published,
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
        
        closeCreatePostModal();
        await loadNewsPosts();
        
    } catch (error) {
        console.error('Ошибка сохранения поста:', error);
        showNotification(`Ошибка сохранения поста: ${error.message}`, 'error');
    }
}

/**
 * Загрузка изображения
 */
async function uploadImage(file) {
    try {
        // Создаем уникальное имя файла
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const filePath = `news-images/${fileName}`;
        
        // Загружаем в Supabase Storage
        const { data, error } = await _supabase.storage
            .from('news-images')
            .upload(filePath, file);
        
        if (error) throw error;
        
        // Получаем публичный URL
        const { data: { publicUrl } } = _supabase.storage
            .from('news-images')
            .getPublicUrl(filePath);
        
        return publicUrl;
        
    } catch (error) {
        console.error('Ошибка загрузки изображения:', error);
        throw error;
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
        if (!post) return;
        
        currentEditingPostId = postId;
        
        // Заполняем форму
        document.getElementById('postTitle').value = post.title;
        document.getElementById('postContent').value = post.content;
        document.getElementById('postPublished').checked = post.is_published;
        
        // Показываем существующее изображение если есть
        const preview = document.getElementById('imagePreview');
        if (post.image_url) {
            preview.innerHTML = `
                <img src="${post.image_url}" alt="${escapeHtml(post.title)}">
                <div class="image-info">
                    <p>Существующее изображение</p>
                    <button type="button" class="remove-image-btn" onclick="clearImagePreview()">
                        <i class="fas fa-times"></i> Удалить
                    </button>
                </div>
            `;
        } else {
            clearImagePreview();
        }
        
        document.getElementById('createPostModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Ошибка открытия формы редактирования:', error);
        showNotification('Ошибка загрузки данных поста', 'error');
    }
}

/**
 * Удаление поста
 */
async function deletePost(postId) {
    if (!confirm('Вы уверены, что хотите удалить этот пост?')) {
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
 * Открытие изображения в полном размере
 */
function openImageModal(imageUrl, title) {
    const modalHTML = `
        <div class="modal" id="imageModal" style="display: flex;">
            <div class="modal-content" style="max-width: 90vw; max-height: 90vh; background: transparent;">
                <span class="close-modal" onclick="closeImageModal()" style="color: white; font-size: 30px; position: absolute; top: -40px; right: -10px;">&times;</span>
                <img src="${imageUrl}" alt="${escapeHtml(title)}" style="max-width: 100%; max-height: 80vh; border-radius: 10px;">
                <p style="color: white; text-align: center; margin-top: 10px;">${escapeHtml(title)}</p>
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

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Загружаем новости если находимся в разделе News
    if (window.location.hash === '#news' || document.getElementById('news').classList.contains('active')) {
        loadNewsPosts();
    }
});
