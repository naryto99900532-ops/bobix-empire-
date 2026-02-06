/**
 * Удаление администратора (понижение до пользователя)
 */
async function removeAdmin(adminId) {
    if (!adminId) {
        showNotification('ID администратора не указан', 'error');
        return;
    }
    
    // Находим администратора
    const admin = usersData.find(u => u.id === adminId);
    if (!admin) {
        showNotification('Администратор не найден', 'error');
        return;
    }
    
    // Проверяем что не пытаемся удалить самого себя
    if (adminId === currentUser?.id) {
        showNotification('Вы не можете удалить себя', 'error');
        return;
    }
    
    // Проверяем что не пытаемся удалить владельца
    if (admin.role === 'owner') {
        showNotification('Нельзя удалить владельца', 'error');
        return;
    }
    
    if (!confirm(`Вы уверены, что хотите удалить администратора "${admin.username}"?`)) {
        return;
    }
    
    try {
        console.log('Попытка удаления администратора:', adminId);
        
        // Обновляем роль на 'user'
        const { data, error } = await _supabase
            .from('profiles')
            .update({ 
                role: 'user',
                updated_at: new Date().toISOString()
            })
            .eq('id', adminId)
            .select(); // Добавляем select для получения обновленных данных
        
        if (error) {
            console.error('Ошибка Supabase при удалении администратора:', error);
            
            // Проверяем конкретные ошибки
            if (error.message.includes('permission denied')) {
                throw new Error('У вас нет прав для удаления администраторов');
            } else if (error.message.includes('row-level security')) {
                throw new Error('Ошибка безопасности. Проверьте RLS политики в Supabase');
            } else {
                throw error;
            }
        }
        
        if (!data || data.length === 0) {
            throw new Error('Администратор не найден или уже удален');
        }
        
        console.log('Администратор успешно удален:', data[0]);
        
        showNotification(`Администратор "${admin.username}" удален!`, 'success');
        
        // Обновляем списки
        await loadAllUsers();
        await loadAdministrators();
        
    } catch (error) {
        console.error('Ошибка удаления администратора:', error);
        
        let errorMessage = 'Ошибка удаления администратора';
        if (error.message.includes('permission')) {
            errorMessage = 'У вас нет прав для удаления администраторов';
        } else if (error.message.includes('row-level security')) {
            errorMessage = 'Ошибка безопасности. Проверьте RLS политики в таблице profiles';
        } else {
            errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    }
}

/**
 * Улучшенная загрузка администраторов
 */
async function loadAdministrators() {
    try {
        const adminsList = document.getElementById('administratorsList');
        if (!adminsList) return;
        
        adminsList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Загрузка администраторов...</p></div>';
        
        // Получаем всех администраторов и владельца
        const { data: admins, error } = await _supabase
            .from('profiles')
            .select('*')
            .in('role', ['admin', 'owner'])
            .order('role', { ascending: false })
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Ошибка Supabase при загрузке администраторов:', error);
            
            // Пробуем альтернативный запрос
            const { data: allProfiles, error: allError } = await _supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (allError) throw allError;
            
            // Фильтруем локально
            const filteredAdmins = allProfiles.filter(p => p.role === 'admin' || p.role === 'owner');
            renderAdministrators(filteredAdmins);
            updateAdminStats(filteredAdmins);
            return;
        }
        
        renderAdministrators(admins || []);
        updateAdminStats(admins || []);
        
    } catch (error) {
        console.error('Ошибка загрузки администраторов:', error);
        document.getElementById('administratorsList').innerHTML = 
            `<div class="error-message">
                <p>Ошибка загрузки администраторов: ${error.message}</p>
                <button class="admin-btn" onclick="loadAdministrators()">Повторить попытку</button>
            </div>`;
    }
}

/**
 * Обновление статистики администраторов
 */
function updateAdminStats(admins) {
    if (!admins) {
        console.warn('Нет данных для статистики');
        return;
    }
    
    // Подсчитываем администраторов (без владельца)
    const adminCount = admins.filter(a => a.role === 'admin').length;
    const ownerCount = admins.filter(a => a.role === 'owner').length;
    const totalCount = admins.length;
    
    console.log('Статистика администраторов:', { adminCount, ownerCount, totalCount });
    
    // Обновляем элементы если они существуют
    const totalAdminsElement = document.getElementById('totalAdminsCount');
    const totalUsersElement = document.getElementById('totalUsersCount');
    const systemUptimeElement = document.getElementById('systemUptime');
    
    if (totalAdminsElement) {
        totalAdminsElement.textContent = adminCount;
        totalAdminsElement.style.color = adminCount > 0 ? 'var(--accent)' : '#ff4444';
    }
    
    if (totalUsersElement) {
        totalUsersElement.textContent = totalCount;
    }
    
    if (systemUptimeElement) {
        // Простая проверка стабильности системы
        const stability = totalCount > 0 ? '100%' : '0%';
        systemUptimeElement.textContent = stability;
        systemUptimeElement.style.color = totalCount > 0 ? '#2ecc71' : '#ff4444';
    }
    
    // Также обновляем статистику в админ панели
    updateAdminPanelStats(admins);
}

/**
 * Обновление статистики в админ панели
 */
function updateAdminPanelStats(admins) {
    const adminPanelStats = document.querySelector('#admin-panel .admin-stats');
    if (adminPanelStats) {
        const adminCount = admins.filter(a => a.role === 'admin').length;
        
        // Обновляем или создаем элементы статистики
        let statsHTML = `
            <h4><i class="fas fa-chart-pie"></i> Статистика системы</h4>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-user-tie"></i></div>
                    <div class="stat-info">
                        <div class="stat-value" id="panelAdminCount">${adminCount}</div>
                        <div class="stat-label">Администраторов</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-users"></i></div>
                    <div class="stat-info">
                        <div class="stat-value" id="panelTotalUsers">${admins.length}</div>
                        <div class="stat-label">Всего пользователей</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-shield-alt"></i></div>
                    <div class="stat-info">
                        <div class="stat-value" style="color: #2ecc71;">100%</div>
                        <div class="stat-label">Стабильность системы</div>
                    </div>
                </div>
            </div>
        `;
        
        adminPanelStats.innerHTML = statsHTML;
    }
}
