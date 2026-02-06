/**
 * Исправление проблем с Supabase Storage
 */

/**
 * Проверка и создание бакета для изображений
 */
async function checkAndCreateNewsBucket() {
    try {
        console.log('Проверка бакета news-images...');
        
        // Пробуем получить список бакетов
        const { data: buckets, error } = await _supabase.storage.listBuckets();
        
        if (error) {
            console.error('Ошибка получения бакетов:', error);
            return false;
        }
        
        // Проверяем существование бакета
        const newsBucketExists = buckets.some(bucket => bucket.name === 'news-images');
        
        if (!newsBucketExists) {
            console.log('Бакет news-images не найден, пытаюсь создать...');
            
            // Пробуем создать бакет
            const { data: newBucket, error: createError } = await _supabase.storage.createBucket('news-images', {
                public: true,
                fileSizeLimit: 52428800, // 50MB
                allowedMimeTypes: ['image/*']
            });
            
            if (createError) {
                console.error('Ошибка создания бакета:', createError);
                return false;
            }
            
            console.log('Бакет успешно создан:', newBucket);
            return true;
        }
        
        console.log('Бакет news-images существует');
        return true;
        
    } catch (error) {
        console.error('Критическая ошибка при проверке бакета:', error);
        return false;
    }
}

/**
 * Улучшенная загрузка изображения
 */
async function uploadImageToStorage(file) {
    try {
        console.log('Начало загрузки изображения:', file.name);
        
        // Проверяем бакет
        const bucketReady = await checkAndCreateNewsBucket();
        if (!bucketReady) {
            console.warn('Бакет не готов, используем временное решение');
            return await uploadImageFallback(file);
        }
        
        // Проверяем размер файла
        if (file.size > 10 * 1024 * 1024) { // 10MB максимум
            throw new Error('Файл слишком большой. Максимальный размер: 10MB');
        }
        
        // Проверяем тип файла
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            throw new Error('Неподдерживаемый тип файла. Используйте JPG, PNG, GIF или WebP');
        }
        
        // Создаем уникальное имя файла
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 10);
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `news_${timestamp}_${randomString}_${sanitizedName}`;
        
        console.log('Загрузка файла:', fileName);
        
        // Загружаем файл
        const { data, error } = await _supabase.storage
            .from('news-images')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type
            });
        
        if (error) {
            console.error('Ошибка загрузки в Storage:', error);
            
            // Пробуем без content-type
            const { data: retryData, error: retryError } = await _supabase.storage
                .from('news-images')
                .upload(fileName, file);
            
            if (retryError) {
                throw new Error(`Не удалось загрузить изображение: ${retryError.message}`);
            }
            
            data = retryData;
        }
        
        // Получаем публичный URL
        const { data: { publicUrl } } = _supabase.storage
            .from('news-images')
            .getPublicUrl(fileName);
        
        console.log('Изображение успешно загружено:', publicUrl);
        return publicUrl;
        
    } catch (error) {
        console.error('Ошибка при загрузке изображения:', error);
        
        // Пробуем альтернативный метод
        try {
            return await uploadImageFallback(file);
        } catch (fallbackError) {
            console.error('Альтернативный метод тоже не сработал:', fallbackError);
            throw error;
        }
    }
}

/**
 * Запасной метод загрузки (base64)
 */
async function uploadImageFallback(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            // Используем base64 как временное решение
            const base64Data = e.target.result;
            resolve(base64Data);
        };
        
        reader.onerror = function(error) {
            reject(new Error('Не удалось прочитать файл'));
        };
        
        reader.readAsDataURL(file);
    });
}

/**
 * Функция для загрузки фото в новость
 */
async function uploadNewsPhoto(file) {
    try {
        // Показываем прогресс
        const progressElement = document.getElementById('uploadProgress');
        if (progressElement) {
            progressElement.style.display = 'block';
            progressElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка изображения...';
        }
        
        // Загружаем изображение
        const imageUrl = await uploadImageToStorage(file);
        
        // Показываем успех
        if (progressElement) {
            progressElement.innerHTML = '<i class="fas fa-check-circle"></i> Изображение загружено!';
            setTimeout(() => {
                progressElement.style.display = 'none';
            }, 2000);
        }
        
        return imageUrl;
        
    } catch (error) {
        console.error('Ошибка загрузки фото:', error);
        
        // Показываем ошибку
        const progressElement = document.getElementById('uploadProgress');
        if (progressElement) {
            progressElement.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${error.message}`;
            progressElement.style.color = '#ff4444';
        }
        
        throw error;
    }
}

// Экспорт функций
if (typeof window !== 'undefined') {
    window.uploadNewsPhoto = uploadNewsPhoto;
    window.uploadImageToStorage = uploadImageToStorage;
    window.checkAndCreateNewsBucket = checkAndCreateNewsBucket;
}

// Проверяем бакет при загрузке
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(async () => {
        if (typeof _supabase !== 'undefined') {
            console.log('Проверка бакета для изображений...');
            await checkAndCreateNewsBucket();
        }
    }, 1000);
});
