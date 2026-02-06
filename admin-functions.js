/**
 * Функции для панели администратора и владельца
 */

let selectedUserId = null;

/**
 * Открытие модального окна добавления игрока
 */
function openAddPlayerModal() {
    // Проверяем права
    if (currentUserRole !== 'admin' && currentUserRole !== 'owner') {
        showNotification('У вас нет прав для добавления игроков', 'error');
        return;
    }
    
    document.getElementById('addPlayerModal').style.display = 'flex';
    document.getElementById('playerPseudonym').focus();
}

/**
 * Закрытие модального окна добавления игрока
 */
function closeAddPlayerModal() {
    document.getElementById('addPlayerModal').style.display = 'none';
    document.getElementById('addPlayerForm').reset();
}

/**
 * Обработка добавления нового игрока
 */
document.getElementById('addPlayerForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const pseudonym = document.getElementById('playerPseudonym').value.trim();
    const roblox = document.getElementById('playerRoblox').value.trim();
    const discord = document.getElementById('playerDiscord').value.trim();
    const score = parseInt(document.getElementById('playerScore').value) || 0;
    const description = document.getElementById('playerDescription').value.trim();
    
    // Валидация
    if (!pseudonym || !roblox || !discord) {
        showNotification('Заполните все обязательные поля', 'error');
        return;
    }
    
    // Проверяем Discord формат
    if (!isValidDiscord(discord)) {
        showNotification('Введите Discord в формате username#0000', 'error');
        return;
    }
    
    try {
        // Добавляем игрока в базу данных
        const { data, error } = await _supabase
            .from('players')
            .insert([
                {
                    nickname: pseudonym,
                    roblox_username: roblox,
                    discord: discord,
                    score: score,
                    description: description,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    created_by: currentUser.id
                }
            ]);
        
        if (error) {
            throw error;
        }
        
        showNotification('Игрок успешно добавлен!', 'success');
        closeAddPlayerModal();
        await loadPlayers();
        
    } catch (error) {
        console.error('Ошибка добавления игрока:', error);
        showNotification(`Ошибка добавления игрока: ${error.message}`, 'error');
    }
});

/**
 * Проверка формата Discord
 */
function isValidDiscord(discord) {
    // Простая проверка формата username#0000
    return discord.includes('#') && discord.split('#')[1]?.length === 4;
}

/**
 * Открытие модального окна добавления администратора
 */
function openAddAdminModal() {
    if (currentUserRole !== 'owner') {
        showNotification('Только владелец может добавлять администраторов', 'error');
        return;
    }
    
    document.getElementById('addAdminModal').style.display = 'flex';
    loadUsersForAdminModal();
}

/**
 * Закрытие модального окна добавления администратора
 */
function closeAddAdminModal() {
    document.getElementById('addAdminModal').style.display = 'none';
    selectedUserId = null;
}

/**
 * Загрузка пользователей для модального окна добавления администратора
 */
async function loadUsersForAdminModal() {
    try {
        const usersList = document.getElementById('usersListModal');
        usersList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Загрузка пользователей...</p></div>';
        
        // Получаем всех пользователей кроме владельца и текущих администраторов
        const { data: users, error } = await _supabase
            .from('profiles')
            .select('*')
            .neq('role', 'owner')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!users || users.length === 0) {
            usersList.innerHTML = '<div class="threshold-card"><p>Нет пользователей для назначения</p></div>';
            return;
        }
        
        renderUsersForAdminModal(users);
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        document.getElementById('usersListModal').innerHTML = 
            '<div class="error-message"><p>Ошибка загрузки пользователей</p></div>';
    }
}

/**
 * Отображение пользователей в модальном окне
 */
function renderUsersForAdminModal(users) {
    const usersList = document.getElementById('usersListModal');
    let html = '';
    
    users.forEach(user => {
        html += `
            <div class="user-item-modal" onclick="selectUserForAdmin('${user.id}')" id="user-${user.id}">
                <div class="user-avatar">${(user.username || 'U').substring(0, 2).toUpperCase()}</div>
                <div class="user-info">
                    <h4>${escapeHtml(user.username || 'Без имени')}</h4>
                    <p>${escapeHtml(user.email || 'Email не указан')}</p>
                    <p class="user-role-small">Текущая роль: ${getRoleDisplayName(user.role)}</p>
                </div>
                <button class="make-admin-btn" onclick="prepareMakeAdmin('${user.id}', '${escapeHtml(user.username || 'Пользователь')}')">
                    <i class="fas fa-user-shield"></i> Назначить
                </button>
            </div>
        `;
    });
    
    usersList.innerHTML = html;
}

/**
 * Фильтрация пользователей
 */
function filterUsers() {
    const searchTerm = document.getElementById('searchUsers').value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item-modal');
    
    userItems.forEach(item => {
        const userName = item.querySelector('h4').textContent.toLowerCase();
        const userEmail = item.querySelector('p').textContent.toLowerCase();
        
        if (userName.includes(searchTerm) || userEmail.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * Выбор пользователя для назначения администратором
 */
function selectUserForAdmin(userId) {
    // Снимаем выделение со всех пользователей
    document.querySelectorAll('.user-item-modal').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Выделяем выбранного пользователя
    const selectedItem = document.getElementById(`user-${userId}`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
        selectedUserId = userId;
    }
}

/**
 * Подготовка к назначению администратора
 */
function prepareMakeAdmin(userId, userName) {
    selectedUserId = userId;
    
    // Устанавливаем текст подтверждения
    document.getElementById('confirmAdminText').textContent = 
        `Вы собираетесь назначить пользователя "${userName}" администратором.`;
    
    // Показываем окно подтверждения
    closeAddAdminModal();
    document.getElementById('confirmAdminModal').style.display = 'flex';
}

/**
 * Закрытие окна подтверждения
 */
function closeConfirmAdminModal() {
    document.getElementById('confirmAdminModal').style.display = 'none';
    selectedUserId = null;
}

/**
 * Подтверждение назначения администратора
 */
async function confirmMakeAdmin() {
    if (!selectedUserId) {
        showNotification('Пользователь не выбран', 'error');
        return;
    }
    
    try {
        // Обновляем роль пользователя на 'admin'
        const { error } = await _supabase
            .from('profiles')
            .update({ 
                role: 'admin',
                updated_at: new Date().toISOString()
            })
            .eq('id', selectedUserId);
        
        if (error) throw error;
        
        showNotification('Пользователь успешно назначен администратором!', 'success');
        
        // Закрываем модальные окна
        closeConfirmAdminModal();
        
        // Обновляем списки
        await loadAdministrators();
        await loadUsersForAdminModal();
        
    } catch (error) {
        console.error('Ошибка назначения администратора:', error);
        showNotification(`Ошибка назначения администратора: ${error.message}`, 'error');
    }
}

/**
 * Загрузка списка администраторов
 */
async function loadAdministrators() {
    try {
        const adminsList = document.getElementById('administratorsList');
        adminsList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Загрузка администраторов...</p></div>';
        
        // Получаем всех администраторов и владельца
        const { data: admins, error } = await _supabase
            .from('profiles')
            .select('*')
            .in('role', ['admin', 'owner'])
            .order('role', { ascending: false })
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        renderAdministrators(admins || []);
        updateAdminStats(admins || []);
        
    } catch (error) {
        console.error('Ошибка загрузки администраторов:', error);
        document.getElementById('administratorsList').innerHTML = 
            '<div class="error-message"><p>Ошибка загрузки администраторов</p></div>';
    }
}

/**
 * Отображение списка администраторов
 */
function renderAdministrators(admins) {
    const adminsList = document.getElementById('administratorsList');
    
    if (!admins || admins.length === 0) {
        adminsList.innerHTML = '<div class="threshold-card"><p>Администраторы не найдены</p></div>';
        return;
    }
    
    let html = '';
    
    admins.forEach(admin => {
        const isOwner = admin.role === 'owner';
        const isCurrentUser = admin.id === currentUser?.id;
        
        html += `
            <div class="administrator-card ${isCurrentUser ? 'current-user' : ''}">
                <div class="admin-avatar" style="background: ${isOwner ? 'linear-gradient(45deg, #ffd700, #ffed4a)' : 'linear-gradient(45deg, #7289da, #99aab5)'}">
                    ${(admin.username || 'A').substring(0, 2).toUpperCase()}
                </div>
                <div class="admin-info">
                    <h4>${escapeHtml(admin.username || 'Без имени')}</h4>
                    <span class="admin-role">${isOwner ? '👑 Владелец' : '🛡️ Администратор'}</span>
                    <div class="admin-details">
                        <p><i class="fas fa-envelope"></i> ${escapeHtml(admin.email || 'Email не указан')}</p>
                        ${admin.discord ? `<p><i class="fab fa-discord"></i> ${escapeHtml(admin.discord)}</p>` : ''}
                        <p><i class="fas fa-calendar"></i> Назначен: ${new Date(admin.created_at).toLocaleDateString('ru-RU')}</p>
                    </div>
                </div>
                ${isOwner || isCurrentUser ? '' : `
                    <div class="admin-actions-card">
                        <button class="admin-btn" onclick="openEditAdminModal('${admin.id}')">
                            <i class="fas fa-edit"></i> Редактировать
                        </button>
                        <button class="admin-btn danger" onclick="removeAdmin('${admin.id}')">
                            <i class="fas fa-user-minus"></i> Удалить
                        </button>
                    </div>
                `}
            </div>
        `;
    });
    
    adminsList.innerHTML = html;
}

/**
 * Обновление статистики администраторов
 */
function updateAdminStats(admins) {
    if (!admins) return;
    
    const totalAdmins = admins.filter(a => a.role === 'admin').length;
    const totalUsers = admins.length;
    
    document.getElementById('totalAdminsCount').textContent = totalAdmins;
    document.getElementById('totalUsersCount').textContent = totalUsers;
}
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
/**
 * Удаление администратора (понижение до пользователя)
 */
async function removeAdmin(adminId) {
    if (!confirm('Вы уверены, что хотите удалить этого администратора?')) {
        return;
    }
    
    try {
        // Понижаем до роли 'user'
        const { error } = await _supabase
            .from('profiles')
            .update({ 
                role: 'user',
                updated_at: new Date().toISOString()
            })
            .eq('id', adminId);
        
        if (error) throw error;
        
        showNotification('Администратор успешно удален!', 'success');
        await loadAdministrators();
        
    } catch (error) {
        console.error('Ошибка удаления администратора:', error);
        showNotification(`Ошибка удаления администратора: ${error.message}`, 'error');
    }
}

/**
 * Редактирование администратора
 */
async function openEditAdminModal(adminId) {
    if (currentUserRole !== 'owner') {
        showNotification('Только владелец может редактировать администраторов', 'error');
        return;
    }
    
    try {
        // Получаем данные администратора
        const { data: admin, error } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', adminId)
            .single();
        
        if (error) throw error;
        
        // Создаем модальное окно редактирования
        const modalHTML = `
            <div class="modal" id="editAdminModal" style="display: flex;">
                <div class="modal-content">
                    <span class="close-modal" onclick="closeEditAdminModal()">&times;</span>
                    <h2><i class="fas fa-edit"></i> Редактирование администратора</h2>
                    <form id="editAdminForm">
                        <input type="hidden" id="editAdminId" value="${admin.id}">
                        <div class="form-group">
                            <label for="editAdminUsername"><i class="fas fa-user"></i> Имя пользователя</label>
                            <input type="text" id="editAdminUsername" class="edit-input" value="${escapeHtml(admin.username || '')}" required>
                        </div>
                        <div class="form-group">
                            <label for="editAdminEmail"><i class="fas fa-envelope"></i> Email</label>
                            <input type="email" id="editAdminEmail" class="edit-input" value="${escapeHtml(admin.email || '')}" required>
                        </div>
                        <div class="form-group">
                            <label for="editAdminDiscord"><i class="fab fa-discord"></i> Discord</label>
                            <input type="text" id="editAdminDiscord" class="edit-input" value="${escapeHtml(admin.discord || '')}" placeholder="Введите Discord">
                        </div>
                        <div class="admin-controls">
                            <button type="submit" class="admin-btn primary">
                                <i class="fas fa-save"></i> Сохранить изменения
                            </button>
                            <button type="button" class="admin-btn" onclick="closeEditAdminModal()">
                                <i class="fas fa-times"></i> Отмена
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        // Добавляем модальное окно в DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
        // Назначаем обработчик формы
        document.getElementById('editAdminForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            await updateAdminData(admin.id);
        });
        
    } catch (error) {
        console.error('Ошибка открытия формы редактирования:', error);
        showNotification('Ошибка загрузки данных администратора', 'error');
    }
}

/**
 * Закрытие окна редактирования администратора
 */
function closeEditAdminModal() {
    const modal = document.getElementById('editAdminModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Обновление данных администратора
 */
async function updateAdminData(adminId) {
    const username = document.getElementById('editAdminUsername').value.trim();
    const email = document.getElementById('editAdminEmail').value.trim();
    const discord = document.getElementById('editAdminDiscord').value.trim();
    
    if (!username || !email) {
        showNotification('Заполните обязательные поля', 'error');
        return;
    }
    
    try {
        const { error } = await _supabase
            .from('profiles')
            .update({
                username: username,
                email: email,
                discord: discord,
                updated_at: new Date().toISOString()
            })
            .eq('id', adminId);
        
        if (error) throw error;
        
        showNotification('Данные администратора обновлены!', 'success');
        closeEditAdminModal();
        await loadAdministrators();
        
    } catch (error) {
        console.error('Ошибка обновления администратора:', error);
        showNotification(`Ошибка обновления администратора: ${error.message}`, 'error');
    }
}

/**
 * Открытие деталей игрока
 */
function openPlayerDetails(playerId) {
    const player = playersData.find(p => p.id === playerId);
    if (!player) return;
    
    const detailsHTML = `
        <div class="player-details-item">
            <label><i class="fas fa-user-secret"></i> Псевдоним</label>
            <div class="value">${escapeHtml(player.nickname || 'Не указан')}</div>
        </div>
        <div class="player-details-item">
            <label><i class="fas fa-gamepad"></i> Roblox никнейм</label>
            <div class="value roblox">${escapeHtml(player.roblox_username || 'Не указан')}</div>
        </div>
        <div class="player-details-item">
            <label><i class="fab fa-discord"></i> Discord</label>
            <div class="value discord">${escapeHtml(player.discord || 'Не указан')}</div>
        </div>
        <div class="player-details-item">
            <label><i class="fas fa-star"></i> Счет</label>
            <div class="value">${player.score || 0}</div>
        </div>
        ${player.description ? `
        <div class="player-details-item">
            <label><i class="fas fa-file-alt"></i> Описание</label>
            <div class="value">${escapeHtml(player.description)}</div>
        </div>
        ` : ''}
        <div class="player-details-item">
            <label><i class="fas fa-calendar"></i> Добавлен</label>
            <div class="value">${new Date(player.created_at).toLocaleDateString('ru-RU')}</div>
        </div>
    `;
    
    document.getElementById('playerDetailsContent').innerHTML = detailsHTML;
    document.getElementById('playerDetailsModal').style.display = 'flex';
}

/**
 * Закрытие деталей игрока
 */
function closePlayerDetailsModal() {
    document.getElementById('playerDetailsModal').style.display = 'none';
}

/**
 * Обновление статистики Clan Players
 */
function updatePlayerStats() {
    const totalPlayers = playersData.length;
    const activePlayers = playersData.filter(p => p.score > 0).length;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newPlayers = playersData.filter(p => new Date(p.created_at) > oneWeekAgo).length;
    
    document.getElementById('totalPlayersCount').textContent = totalPlayers;
    document.getElementById('activePlayersCount').textContent = activePlayers;
    document.getElementById('newPlayersWeek').textContent = newPlayers;
}

/**
 * Обновление рендера Clan Players для отображения деталей
 */
function updatePlayersRender() {
    const playersList = document.getElementById('playersList');
    if (!playersList || !playersData.length) return;
    
    let html = '';
    
    playersData.forEach((player, index) => {
        const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
        const editButton = isAdmin ? `
            <button class="admin-btn" onclick="openEditPlayerModal('${player.id}')" style="margin-top: 10px;">
                <i class="fas fa-edit"></i> Редактировать
            </button>
        ` : '';
        
        html += `
            <div class="player-management-card player-card-with-details">
                <div class="player-rank">#${index + 1}</div>
                <div class="player-info">
                    <div class="player-avatar" onclick="openPlayerDetails('${player.id}')" style="cursor: pointer;">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <h3 class="player-name" style="cursor: pointer;" onclick="openPlayerDetails('${player.id}')">
                            ${escapeHtml(player.nickname || 'Без имени')}
                        </h3>
                        <p>Счет: <strong>${player.score || 0}</strong></p>
                    </div>
                </div>
                <div class="player-description">
                    ${escapeHtml(player.description || 'Описание отсутствует')}
                </div>
                
                <div class="player-details-hover">
                    <div class="detail-row">
                        <span class="detail-label">Roblox:</span>
                        <span class="detail-value roblox">${escapeHtml(player.roblox_username || 'Не указан')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Discord:</span>
                        <span class="detail-value discord">${escapeHtml(player.discord || 'Не указан')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Добавлен:</span>
                        <span class="detail-value">${new Date(player.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                </div>
                
                ${editButton}
            </div>
        `;
    });
    
    playersList.innerHTML = html;
    updatePlayerStats();
}

// Инициализация табов в модальном окне
document.addEventListener('DOMContentLoaded', function() {
    // Обработчики табов
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Снимаем активный класс со всех табов и контента
            document.querySelectorAll('.tab, .tab-content').forEach(item => {
                item.classList.remove('active');
            });
            
            // Добавляем активный класс к выбранному табу и контенту
            this.classList.add('active');
            document.getElementById(tabId + 'Tab').classList.add('active');
        });
    });
    
    // Форма нового администратора
    document.getElementById('newAdminForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('newAdminUsername').value.trim();
        const email = document.getElementById('newAdminEmail').value.trim();
        const discord = document.getElementById('newAdminDiscord').value.trim();
        
        if (!username || !email) {
            showNotification('Заполните обязательные поля', 'error');
            return;
        }
        
        // Создание нового администратора требует дополнительной логики
        showNotification('Функция создания нового администратора в разработке', 'info');
    });
});

// Экспортируем функции
if (typeof window !== 'undefined') {
    window.openAddPlayerModal = openAddPlayerModal;
    window.closeAddPlayerModal = closeAddPlayerModal;
    window.openAddAdminModal = openAddAdminModal;
    window.closeAddAdminModal = closeAddAdminModal;
    window.filterUsers = filterUsers;
    window.selectUserForAdmin = selectUserForAdmin;
    window.prepareMakeAdmin = prepareMakeAdmin;
    window.closeConfirmAdminModal = closeConfirmAdminModal;
    window.confirmMakeAdmin = confirmMakeAdmin;
    window.loadAdministrators = loadAdministrators;
    window.removeAdmin = removeAdmin;
    window.openEditAdminModal = openEditAdminModal;
    window.closeEditAdminModal = closeEditAdminModal;
    window.openPlayerDetails = openPlayerDetails;
    window.closePlayerDetailsModal = closePlayerDetailsModal;
}
/**
 * Сортировка игроков в топе
 */
let draggingPlayerId = null;

/**
 * Инициализация drag-and-drop для сортировки
 */
function initializePlayerSorting() {
    const playersList = document.getElementById('playersList');
    if (!playersList) return;
    
    playersList.addEventListener('dragstart', handleDragStart);
    playersList.addEventListener('dragover', handleDragOver);
    playersList.addEventListener('drop', handleDrop);
    playersList.addEventListener('dragend', handleDragEnd);
}

/**
 * Начало перетаскивания
 */
function handleDragStart(e) {
    if (!e.target.closest('.player-management-card')) return;
    
    const playerCard = e.target.closest('.player-management-card');
    draggingPlayerId = playerCard.dataset.playerId;
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggingPlayerId);
    
    playerCard.classList.add('dragging');
}

/**
 * Перетаскивание над элементом
 */
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const playerCard = e.target.closest('.player-management-card');
    if (playerCard && playerCard.dataset.playerId !== draggingPlayerId) {
        playerCard.classList.add('drag-over');
    }
}

/**
 * Сброс перетаскивания
 */
function handleDrop(e) {
    e.preventDefault();
    
    const playerCard = e.target.closest('.player-management-card');
    if (!playerCard || !draggingPlayerId) return;
    
    const targetPlayerId = playerCard.dataset.playerId;
    if (targetPlayerId === draggingPlayerId) return;
    
    // Меняем игроков местами
    swapPlayers(draggingPlayerId, targetPlayerId);
    
    // Убираем классы
    document.querySelectorAll('.player-management-card').forEach(card => {
        card.classList.remove('drag-over');
    });
}

/**
 * Конец перетаскивания
 */
function handleDragEnd(e) {
    document.querySelectorAll('.player-management-card').forEach(card => {
        card.classList.remove('dragging', 'drag-over');
    });
    draggingPlayerId = null;
}

/**
 * Меняем игроков местами
 */
async function swapPlayers(playerId1, playerId2) {
    if (currentUserRole !== 'admin' && currentUserRole !== 'owner') {
        showNotification('Только администраторы могут менять порядок игроков', 'error');
        return;
    }
    
    try {
        // Находим игроков
        const player1 = playersData.find(p => p.id === playerId1);
        const player2 = playersData.find(p => p.id === playerId2);
        
        if (!player1 || !player2) return;
        
        // Меняем их счета местами (или можно добавить поле 'position')
        const tempScore = player1.score;
        
        // Обновляем первого игрока
        const { error: error1 } = await _supabase
            .from('players')
            .update({ 
                score: player2.score,
                updated_at: new Date().toISOString()
            })
            .eq('id', playerId1);
        
        if (error1) throw error1;
        
        // Обновляем второго игрока
        const { error: error2 } = await _supabase
            .from('players')
            .update({ 
                score: tempScore,
                updated_at: new Date().toISOString()
            })
            .eq('id', playerId2);
        
        if (error2) throw error2;
        
        showNotification('Порядок игроков изменен!', 'success');
        
        // Обновляем список
        await loadPlayers();
        
    } catch (error) {
        console.error('Ошибка при изменении порядка:', error);
        showNotification('Ошибка при изменении порядка игроков', 'error');
    }
}

/**
 * Обновляем рендер игроков с поддержкой drag-and-drop
 */
function updatePlayersRender() {
    const playersList = document.getElementById('playersList');
    if (!playersList || !playersData.length) return;
    
    // Сортируем игроков по счету
    const sortedPlayers = [...playersData].sort((a, b) => (b.score || 0) - (a.score || 0));
    
    let html = '';
    
    sortedPlayers.forEach((player, index) => {
        const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
        const editButton = isAdmin ? `
            <button class="admin-btn" onclick="openEditPlayerModal('${player.id}')" style="margin-top: 10px;">
                <i class="fas fa-edit"></i> Редактировать
            </button>
        ` : '';
        
        // Кнопки для изменения позиции (только для админов)
        const positionControls = isAdmin ? `
            <div class="position-controls">
                <button class="position-btn up" onclick="movePlayerUp('${player.id}')" ${index === 0 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button class="position-btn down" onclick="movePlayerDown('${player.id}')" ${index === sortedPlayers.length - 1 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-down"></i>
                </button>
            </div>
        ` : '';
        
        html += `
            <div class="player-management-card player-card-with-details" 
                 data-player-id="${player.id}"
                 draggable="${isAdmin ? 'true' : 'false'}">
                
                ${positionControls}
                
                <div class="player-rank">#${index + 1}
                    ${isAdmin ? '<i class="fas fa-arrows-alt drag-handle"></i>' : ''}
                </div>
                
                <div class="player-info">
                    <div class="player-avatar" onclick="openPlayerDetails('${player.id}')" style="cursor: pointer;">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <h3 class="player-name" style="cursor: pointer;" onclick="openPlayerDetails('${player.id}')">
                            ${escapeHtml(player.nickname || 'Без имени')}
                        </h3>
                        <p>Счет: <strong>${player.score || 0}</strong></p>
                    </div>
                </div>
                
                <div class="player-description">
                    ${escapeHtml(player.description || 'Описание отсутствует')}
                </div>
                
                <div class="player-details-hover">
                    <div class="detail-row">
                        <span class="detail-label">Roblox:</span>
                        <span class="detail-value roblox">${escapeHtml(player.roblox_username || 'Не указан')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Discord:</span>
                        <span class="detail-value discord">${escapeHtml(player.discord || 'Не указан')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Добавлен:</span>
                        <span class="detail-value">${new Date(player.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                </div>
                
                ${editButton}
            </div>
        `;
    });
    
    playersList.innerHTML = html;
    updatePlayerStats();
    
    // Инициализируем drag-and-drop если пользователь админ
    if (currentUserRole === 'admin' || currentUserRole === 'owner') {
        initializePlayerSorting();
    }
}

/**
 * Переместить игрока вверх в рейтинге
 */
async function movePlayerUp(playerId) {
    await changePlayerPosition(playerId, 'up');
}

/**
 * Переместить игрока вниз в рейтинге
 */
async function movePlayerDown(playerId) {
    await changePlayerPosition(playerId, 'down');
}

/**
 * Изменить позицию игрока
 */
async function changePlayerPosition(playerId, direction) {
    if (currentUserRole !== 'admin' && currentUserRole !== 'owner') {
        showNotification('Только администраторы могут менять порядок игроков', 'error');
        return;
    }
    
    try {
        // Сортируем игроков по счету
        const sortedPlayers = [...playersData].sort((a, b) => (b.score || 0) - (a.score || 0));
        const currentIndex = sortedPlayers.findIndex(p => p.id === playerId);
        
        if (currentIndex === -1) return;
        
        let targetIndex;
        if (direction === 'up' && currentIndex > 0) {
            targetIndex = currentIndex - 1;
        } else if (direction === 'down' && currentIndex < sortedPlayers.length - 1) {
            targetIndex = currentIndex + 1;
        } else {
            return;
        }
        
        // Меняем счета местами
        const currentPlayer = sortedPlayers[currentIndex];
        const targetPlayer = sortedPlayers[targetIndex];
        
        const tempScore = currentPlayer.score;
        
        // Обновляем текущего игрока
        const { error: error1 } = await _supabase
            .from('players')
            .update({ 
                score: targetPlayer.score,
                updated_at: new Date().toISOString()
            })
            .eq('id', playerId);
        
        if (error1) throw error1;
        
        // Обновляем целевого игрока
        const { error: error2 } = await _supabase
            .from('players')
            .update({ 
                score: tempScore,
                updated_at: new Date().toISOString()
            })
            .eq('id', targetPlayer.id);
        
        if (error2) throw error2;
        
        showNotification('Позиция игрока изменена!', 'success');
        
        // Обновляем список
        await loadPlayers();
        
    } catch (error) {
        console.error('Ошибка при изменении позиции:', error);
        showNotification('Ошибка при изменении позиции игрока', 'error');
    }
}
