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
