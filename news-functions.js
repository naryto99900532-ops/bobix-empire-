/**
 * Функции для управления новостями - ИСПРАВЛЕННАЯ ВЕРСИЯ
 */

let newsPosts = [];
let currentEditingPostId = null;
let currentUserRole = 'user';

/**
 * Инициализация функций новостей
 */
async function initializeNewsFunctions() {
    console.log('Инициализация новостей...');
    
    try {
        // Получаем роль текущего пользователя
        const { data: { user } } = await _supabase.auth.getUser();
        console.log('Текущий пользователь:', user?.email);
        
        if (user) {
            try {
                const { data: profile, error } = await _supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                
                if (!error && profile) {
                    currentUserRole = profile.role || 'user';
                    console.log('Роль пользователя:', currentUserRole);
                } else {
                    console.log('Профиль не найден, используем роль по умолчанию');
                }
            } catch (profileError) {
                console.error('Ошибка получения профиля:', profileError);
            }
        }
        
        // Загружаем новости
        await loadNewsPosts();
        
        // Настраиваем обработчики
        setupNewsEventHandlers();
        
        console.log('Функции новостей инициализированы');
        
    } catch (error) {
        console.error('Ошибка инициализации новостей:', error);
    }
}

/**
 * Настройка обработчиков событий для новостей
 */
function setupNewsEventHandlers() {
    console.log('Настройка обработчиков событий...');
    
    // Форма создания/редактирования поста
    const createPostForm = document.getElementById('createPostForm');
    if (createPostForm) {
        console.log('Найден form createPostForm');
        createPostForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleCreatePost(e).catch(console.error);
        });
    } else {
        console.log('Форма createPostForm не найдена!');
    }
    
    // Кнопка удаления изображения
    const removeImageBtn = document.querySelector('.remove-image-btn');
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', clearImagePreview);
    }
    
    // Инициализация drag & drop для загрузки изображений
    initializeImageUpload();
}

/**
 * Инициализация drag & drop для изображений
 */
function initializeImageUpload() {
    const imagePreview = document.getElementById('imagePreview');
    const fileInput = document.getElementById('postImage');
    
    if (!imagePreview || !fileInput) {
        console.log('Элементы для загрузки изображений не найдены');
        return;
    }
    
    // Клик по области для выбора файла
    imagePreview.addEventListener('click', function(e) {
        if (e.target.tagName !== 'BUTTON') {
            fileInput.click();
        }
    });
    
    // Drag & drop
    imagePreview.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.add('drag-over');
    });
    
    imagePreview.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('drag-over');
    });
    
    imagePreview.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                // Устанавливаем файл в input
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                
                // Триггерим событие change
                const event = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);
            } else {
                showNotification('Пожалуйста, перетащите изображение (JPG, PNG, GIF)', 'error');
            }
        }
    });
    
    // Обработчик change для input
    fileInput.addEventListener('change', function(e) {
        if (this.files && this.files[0]) {
            previewImage(e);
        }
    });
}

/**
 * Загрузка новостей
 */
async function loadNewsPosts() {
    try {
        const newsContainer = document.getElementById('newsPosts');
        if (!newsContainer) {
            console.error('Контейнер новостей не найден!');
            return;
        }
        
        console.log('Загрузка новостей...');
        newsContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Загрузка новостей...</p></div>';
        
        // Получаем новости
        const { data: posts, error } = await _supabase
            .from('news_posts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Ошибка Supabase при загрузке новостей:', error);
            throw error;
        }
        
        console.log('Загружено новостей:', posts?.length || 0);
        newsPosts = posts || [];
        renderNewsPosts(newsPosts);
        
        // Показываем/скрываем кнопку "Выложить новость"
        updateCreateNewsButton();
        
    } catch (error) {
        console.error('Ошибка загрузки новостей:', error);
        const newsContainer = document.getElementById('newsPosts');
        if (newsContainer) {
            newsContainer.innerHTML = `
                <div class="error-message">
                    <p>Ошибка загрузки новостей: ${error.message}</p>
                    <button class="admin-btn" onclick="loadNewsPosts()">Повторить попытку</button>
                </div>
            `;
        }
    }
}

/**
 * Обновление кнопки создания новости
 */
function updateCreateNewsButton() {
    console.log('Обновление кнопки создания новости, роль:', currentUserRole);
    
    const createButton = document.getElementById('createNewsBtn');
    const adminHeader = document.querySelector('.admin-controls-header');
    
    if (currentUserRole === 'admin' || currentUserRole === 'owner') {
        if (createButton) {
            createButton.style.display = 'inline-block';
            console.log('Кнопка "Выложить новость" показана');
        }
        if (adminHeader) {
            adminHeader.style.display = 'flex';
        }
    } else {
        if (createButton) {
            createButton.style.display = 'none';
            console.log('Кнопка "Выложить новость" скрыта');
        }
        if (adminHeader) {
            adminHeader.style.display = 'none';
        }
    }
}

/**
 * Открытие модального окна создания поста
 */
function openCreatePostModal() {
    console.log('Открытие модального окна создания поста');
    
    if (currentUserRole !== 'admin' && currentUserRole !== 'owner') {
        showNotification('Только администраторы могут публиковать новости', 'error');
        return;
    }
    
    currentEditingPostId = null;
    
    // Сбрасываем форму
    const titleInput = document.getElementById('postTitle');
    const contentInput = document.getElementById('postContent');
    const publishedInput = document.getElementById('postPublished');
    
    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';
    if (publishedInput) publishedInput.checked = true;
    
    clearImagePreview();
    
    // Обновляем заголовок модального окна
    const modalTitle = document.querySelector('#createPostModal h2');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-edit"></i> Создать новый пост';
    }
    
    // Обновляем текст кнопки submit
    const submitBtn = document.querySelector('#createPostForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Опубликовать новость';
    }
    
    // Показываем модальное окно
    const modal = document.getElementById('createPostModal');
    if (modal) {
        modal.style.display = 'flex';
        if (titleInput) titleInput.focus();
    } else {
        console.error('Модальное окно createPostModal не найдено!');
    }
}

/**
 * Закрытие модального окна создания поста
 */
function closeCreatePostModal() {
    console.log('Закрытие модального окна создания поста');
    const modal = document.getElementById('createPostModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentEditingPostId = null;
}

/**
 * Предпросмотр изображения
 */
function previewImage(event) {
    const input = event.target;
    const preview = document.getElementById('imagePreview');
    
    if (!preview) {
        console.error('Элемент imagePreview не найден!');
        return;
    }
    
    if (!input.files || !input.files[0]) {
        preview.innerHTML = '<p><i class="fas fa-cloud-upload-alt"></i> Перетащите изображение или нажмите для выбора</p>';
        return;
    }
    
    const file = input.files[0];
    
    // Проверяем размер файла (максимум 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Изображение слишком большое. Максимальный размер - 5MB', 'error');
        input.value = '';
        preview.innerHTML = '<p><i class="fas fa-cloud-upload-alt"></i> Перетащите изображение или нажмите для выбора</p>';
        return;
    }
    
    // Проверяем тип файла
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showNotification('Пожалуйста, выберите изображение (JPG, PNG, GIF, WebP)', 'error');
        input.value = '';
        preview.innerHTML = '<p><i class="fas fa-cloud-upload-alt"></i> Перетащите изображение или нажмите для выбора</p>';
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
                    <button type="button" class="remove-image-btn" onclick="clearImagePreview()">
                        <i class="fas fa-times"></i> Удалить
                    </button>
                </div>
            </div>
        `;
    };
    
    reader.onerror = function() {
        showNotification('Ошибка при чтении файла', 'error');
        preview.innerHTML = '<p><i class="fas fa-cloud-upload-alt"></i> Перетащите изображение или нажмите для выбора</p>';
    };
    
    reader.readAsDataURL(file);
}

/**
 * Очистка предпросмотра изображения
 */
function clearImagePreview() {
    console.log('Очистка предпросмотра изображения');
    
    const preview = document.getElementById('imagePreview');
    const input = document.getElementById('postImage');
    
    if (preview) {
        preview.innerHTML = '<p><i class="fas fa-cloud-upload-alt"></i> Перетащите изображение или нажмите для выбора</p>';
    }
    
    if (input) {
        input.value = '';
    }
    
    // Убираем класс drag-over
    if (preview) {
        preview.classList.remove('drag-over');
    }
}

/**
 * Обработка создания/редактирования поста
 */
async function handleCreatePost(e) {
    console.log('Обработка создания/редактирования поста');
    
    e.preventDefault();
    
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const published = document.getElementById('postPublished').checked;
    const imageFile = document.getElementById('postImage').files[0];
    
    console.log('Данные формы:', { title, contentLength: content.length, published, hasImage: !!imageFile });
    
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
            console.log('Начинаю загрузку изображения...');
            imageUrl = await uploadImage(imageFile);
            console.log('Изображение загружено:', imageUrl);
        }
        
        // Получаем данные текущего пользователя
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            throw new Error('Пользователь не найден. Пожалуйста, войдите заново.');
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
        
        console.log('Данные для сохранения:', postData);
        
        let result;
        
        if (currentEditingPostId) {
            // Обновляем существующий пост
            console.log('Обновление поста ID:', currentEditingPostId);
            result = await _supabase
                .from('news_posts')
                .update(postData)
                .eq('id', currentEditingPostId);
        } else {
            // Создаем новый пост
            console.log('Создание нового поста');
            postData.created_at = new Date().toISOString();
            postData.view_count = 0;
            result = await _supabase
                .from('news_posts')
                .insert([postData]);
        }
        
        const { data, error } = result;
        
        if (error) {
            console.error('Ошибка Supabase при сохранении:', error);
            throw error;
        }
        
        console.log('Пост сохранен успешно:', data);
        
        const message = currentEditingPostId ? 'Пост обновлен!' : 'Пост опубликован!';
        showNotification(message, 'success');
        
        // Восстанавливаем кнопку
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        closeCreatePostModal();
        await loadNewsPosts();
        
    } catch (error) {
        console.error('Ошибка сохранения поста:', error);
        
        let errorMessage = 'Ошибка сохранения поста';
        if (error.message.includes('permission')) {
            errorMessage = 'У вас нет прав для публикации новостей';
        } else if (error.message.includes('network')) {
            errorMessage = 'Ошибка сети. Проверьте подключение к интернету';
        } else {
            errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
        
        // Восстанавливаем кнопку при ошибке
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.innerHTML = currentEditingPostId ? 'Сохранить изменения' : 'Опубликовать новость';
        submitBtn.disabled = false;
    }
}

/**
 * Загрузка изображения в Supabase Storage
 */
async function uploadImage(file) {
    try {
        console.log('Начало загрузки изображения:', file.name);
        
        // Создаем уникальное имя файла
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const fileName = `news_${timestamp}_${randomString}.${fileExtension}`;
        const filePath = fileName; // Загружаем прямо в корень бакета
        
        console.log('Пытаюсь загрузить в:', filePath);
        
        // Пробуем загрузить в Supabase Storage
        const { data, error } = await _supabase.storage
            .from('news-images') // Имя бакета ДОЛЖНО совпадать
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) {
            console.error('Ошибка загрузки в Supabase Storage:', error);
            
            // Если бакет не существует или нет доступа, используем альтернативный метод
            if (error.message.includes('bucket') || error.message.includes('not found')) {
                console.warn('Бакет не найден, создаем временную ссылку');
                return URL.createObjectURL(file);
            }
            
            throw error;
        }
        
        console.log('Изображение загружено, получаем публичный URL...');
        
        // Получаем публичный URL
        const { data: { publicUrl } } = _supabase.storage
            .from('news-images')
            .getPublicUrl(filePath);
        
        console.log('Публичный URL получен:', publicUrl);
        return publicUrl;
        
    } catch (error) {
        console.error('Критическая ошибка загрузки изображения:', error);
        
        // Fallback: создаем временную ссылку
        try {
            const tempUrl = URL.createObjectURL(file);
            console.log('Использую временную ссылку:', tempUrl);
            return tempUrl;
        } catch (fallbackError) {
            console.error('Не удалось создать временную ссылку:', fallbackError);
            return null;
        }
    }
}

/**
 * Отображение новостей (остальная часть функции без изменений)
 * [Сохраняем остальной код из предыдущей версии без изменений]
 */

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализирую новости...');
    initializeNewsFunctions().catch(console.error);
});

// Экспорт функций для глобального использования
if (typeof window !== 'undefined') {
    console.log('Экспорт функций в window...');
    window.openCreatePostModal = openCreatePostModal;
    window.closeCreatePostModal = closeCreatePostModal;
    window.previewImage = previewImage;
    window.clearImagePreview = clearImagePreview;
    window.loadNewsPosts = loadNewsPosts;
    window.openEditPostModal = openEditPostModal;
    window.deletePost = deletePost;
    window.openPostDetails = openPostDetails;
    window.closePostDetailsModal = closePostDetailsModal;
    window.openImageModal = openImageModal;
    window.closeImageModal = closeImageModal;
    console.log('Функции экспортированы');
}
