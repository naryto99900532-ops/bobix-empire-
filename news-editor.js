/**
 * Редактор новостей с улучшенным интерфейсом
 */

// Текущий файл изображения
let currentNewsImageFile = null;
let isUploading = false;

/**
 * Открытие редактора новостей
 */
function openNewsEditor() {
    console.log('Открытие редактора новостей');
    
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
    
    // Показываем модальное окно
    document.getElementById('newsEditorModal').style.display = 'flex';
    
    // Фокусируемся на заголовке
    setTimeout(() => {
        document.getElementById('newsTitle').focus();
    }, 100);
}

/**
 * Закрытие редактора новостей
 */
function closeNewsEditor() {
    if (isUploading) {
        if (!confirm('Идет загрузка изображения. Вы уверены, что хотите закрыть редактор?')) {
            return;
        }
    }
    
    document.getElementById('newsEditorModal').style.display = 'none';
    resetNewsEditor();
}

/**
 * Сброс редактора
 */
function resetNewsEditor() {
    document.getElementById('newsTitle').value = '';
    document.getElementById('newsContent').value = '';
    document.getElementById('newsPublished').checked = true;
    
    // Сбрасываем изображение
    removeNewsImage();
    
    // Скрываем индикатор загрузки
    document.getElementById('imageUploadProgress').style.display = 'none';
    
    currentNewsImageFile = null;
    isUploading = false;
}

/**
 * Обработка загрузки изображения
 */
function handleNewsImageUpload(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    
    // Проверка размера (максимум 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showNotification('Файл слишком большой. Максимальный размер: 10MB', 'error');
        input.value = '';
        return;
    }
    
    // Проверка типа
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showNotification('Неподдерживаемый тип файла. Используйте JPG, PNG, GIF или WebP', 'error');
        input.value = '';
        return;
    }
    
    currentNewsImageFile = file;
    
    // Показываем предпросмотр
    showImagePreview(file);
}

/**
 * Показ предпросмотра изображения
 */
function showImagePreview(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const previewContainer = document.getElementById('imagePreviewContainer');
        const preview = document.getElementById('newsImagePreview');
        const uploadBox = document.getElementById('imageUploadBox');
        
        // Скрываем бокс загрузки, показываем предпросмотр
        uploadBox.style.display = 'none';
        previewContainer.style.display = 'block';
        
        // Создаем изображение
        preview.innerHTML = `
            <img src="${e.target.result}" alt="Предпросмотр">
            <div class="image-info">
                <p><i class="fas fa-file"></i> ${file.name}</p>
                <p><i class="fas fa-weight"></i> ${(file.size / 1024).toFixed(2)} KB</p>
                <p><i class="fas fa-expand-alt"></i> Нажмите для увеличения</p>
            </div>
        `;
        
        // Добавляем обработчик для увеличения
        const img = preview.querySelector('img');
        if (img) {
            img.onclick = function() {
                openFullscreenImage(e.target.result, file.name);
            };
        }
    };
    
    reader.readAsDataURL(file);
}

/**
 * Удаление изображения
 */
function removeNewsImage() {
    const input = document.getElementById('newsImage');
    const previewContainer = document.getElementById('imagePreviewContainer');
    const uploadBox = document.getElementById('imageUploadBox');
    const progress = document.getElementById('imageUploadProgress');
    
    // Сбрасываем input
    if (input) input.value = '';
    
    // Скрываем предпросмотр, показываем бокс загрузки
    previewContainer.style.display = 'none';
    uploadBox.style.display = 'block';
    
    // Скрываем прогресс
    if (progress) progress.style.display = 'none';
    
    // Очищаем файл
    currentNewsImageFile = null;
    isUploading = false;
}

/**
 * Открытие изображения в полном размере
 */
function openFullscreenImage(src, filename) {
    const modalHTML = `
        <div class="modal" id="fullscreenImageModal" style="display: flex; background: rgba(0,0,0,0.95);">
            <div class="modal-content" style="background: transparent; border: none; box-shadow: none; max-width: 95vw; max-height: 95vh; padding: 0;">
                <span class="close-modal" onclick="closeFullscreenImage()" 
                      style="color: white; font-size: 40px; position: fixed; top: 20px; right: 30px; z-index: 10001; cursor: pointer;">&times;</span>
                <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
                    <img src="${src}" alt="${filename}" 
                         style="max-width: 100%; max-height: 90vh; object-fit: contain; border-radius: 5px;">
                </div>
                <p style="color: white; text-align: center; margin-top: 10px; font-size: 1rem; position: absolute; bottom: 20px; left: 0; right: 0;">
                    ${filename}
                </p>
            </div>
        </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
}

/**
 * Закрытие полноэкранного изображения
 */
function closeFullscreenImage() {
    const modal = document.getElementById('fullscreenImageModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Вставка текста в поле редактора
 */
function insertTextAtCursor(text) {
    const textarea = document.getElementById('newsContent');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    // Вставляем текст
    textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
    
    // Устанавливаем курсор после вставленного текста
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
    
    // Триггерим событие input
    textarea.dispatchEvent(new Event('input'));
}

/**
 * Сохранение новости
 */
async function saveNews(isDraft = false) {
    const title = document.getElementById('newsTitle').value.trim();
    const content = document.getElementById('newsContent').value.trim();
    const published = isDraft ? false : document.getElementById('newsPublished').checked;
    
    // Валидация
    if (!title) {
        showNotification('Введите заголовок новости', 'error');
        return false;
    }
    
    if (!content) {
        showNotification('Введите содержание новости', 'error');
        return false;
    }
    
    if (title.length < 3) {
        showNotification('Заголовок должен содержать минимум 3 символа', 'error');
        return false;
    }
    
    if (content.length < 10) {
        showNotification('Содержание должно содержать минимум 10 символов', 'error');
        return false;
    }
    
    try {
        // Показываем загрузку
        const submitBtn = document.querySelector('#newsEditorForm button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
        submitBtn.disabled = true;
        
        // Загружаем изображение если есть
        let imageUrl = null;
        if (currentNewsImageFile) {
            imageUrl = await uploadNewsImage(currentNewsImageFile);
        }
        
        // Получаем данные пользователя
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            throw new Error('Пользователь не найден');
        }
        
        const newsData = {
            title,
            content,
            author_id: user.id,
            author_name: user.user_metadata?.username || user.email?.split('@')[0] || 'Администратор',
            is_published: published,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            view_count: 0
        };
        
        if (imageUrl) {
            newsData.image_url = imageUrl;
        }
        
        // Сохраняем в базу
        const { error } = await _supabase
            .from('news_posts')
            .insert([newsData]);
        
        if (error) throw error;
        
        // Показываем уведомление
        const message = isDraft ? 'Черновик сохранен!' : 'Новость опубликована!';
        showNotification(message, 'success');
        
        // Закрываем редактор
        closeNewsEditor();
        
        // Обновляем список новостей
        if (typeof loadNewsPosts === 'function') {
            await loadNewsPosts();
        }
        
        return true;
        
    } catch (error) {
        console.error('Ошибка сохранения новости:', error);
        
        let errorMessage = 'Ошибка сохранения новости';
        if (error.message.includes('permission')) {
            errorMessage = 'У вас нет прав для публикации новостей';
        } else if (error.message.includes('network')) {
            errorMessage = 'Ошибка сети. Проверьте подключение';
        } else {
            errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
        
        // Восстанавливаем кнопку
        const submitBtn = document.querySelector('#newsEditorForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Опубликовать новость';
            submitBtn.disabled = false;
        }
        
        return false;
    }
}

/**
 * Загрузка изображения новости
 */
async function uploadNewsImage(file) {
    return new Promise(async (resolve, reject) => {
        try {
            isUploading = true;
            
            // Показываем прогресс
            const progressContainer = document.getElementById('imageUploadProgress');
            const progressFill = progressContainer.querySelector('.progress-fill');
            const progressText = progressContainer.querySelector('.progress-text span');
            
            progressContainer.style.display = 'block';
            progressFill.style.width = '0%';
            progressText.textContent = '0';
            
            // Симуляция прогресса (в реальности нужно использовать XMLHttpRequest или fetch с отслеживанием прогресса)
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                progressFill.style.width = progress + '%';
                progressText.textContent = progress;
                
                if (progress >= 100) {
                    clearInterval(interval);
                }
            }, 100);
            
            // Загружаем в Supabase Storage
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 10);
            const fileName = `news_${timestamp}_${randomString}.${file.name.split('.').pop()}`;
            
            const { data, error } = await _supabase.storage
                .from('news-images')
                .upload(fileName, file);
            
            clearInterval(interval);
            isUploading = false;
            
            if (error) {
                progressContainer.style.display = 'none';
                reject(new Error('Ошибка загрузки изображения: ' + error.message));
                return;
            }
            
            // Получаем публичный URL
            const { data: { publicUrl } } = _supabase.storage
                .from('news-images')
                .getPublicUrl(fileName);
            
            // Завершаем прогресс
            progressFill.style.width = '100%';
            progressText.textContent = '100';
            
            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 1000);
            
            resolve(publicUrl);
            
        } catch (error) {
            isUploading = false;
            reject(error);
        }
    });
}

/**
 * Сохранение как черновика
 */
function saveNewsAsDraft() {
    saveNews(true);
}

/**
 * Обработка отправки формы
 */
document.getElementById('newsEditorForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    saveNews(false);
});

// Экспорт функций
if (typeof window !== 'undefined') {
    window.openNewsEditor = openNewsEditor;
    window.closeNewsEditor = closeNewsEditor;
    window.handleNewsImageUpload = handleNewsImageUpload;
    window.removeNewsImage = removeNewsImage;
    window.insertTextAtCursor = insertTextAtCursor;
    window.saveNewsAsDraft = saveNewsAsDraft;
    window.openFullscreenImage = openFullscreenImage;
    window.closeFullscreenImage = closeFullscreenImage;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Настраиваем drag and drop для загрузки изображений
    const uploadBox = document.getElementById('imageUploadBox');
    if (uploadBox) {
        uploadBox.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.style.borderColor = 'var(--accent)';
            this.style.background = 'rgba(255, 215, 0, 0.1)';
        });
        
        uploadBox.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.style.borderColor = '';
            this.style.background = '';
        });
        
        uploadBox.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.style.borderColor = '';
            this.style.background = '';
            
            if (e.dataTransfer.files.length) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('image/')) {
                    const input = document.getElementById('newsImage');
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    input.files = dataTransfer.files;
                    
                    const event = new Event('change', { bubbles: true });
                    input.dispatchEvent(event);
                }
            }
        });
    }
});
