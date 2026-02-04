async function checkRole() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) { window.location.href = 'index.html'; return; }

    let { data: profile } = await _supabase.from('profiles').select('role').eq('id', user.id).single();

    if (profile.role === 'admin' || profile.role === 'owner') {
        document.getElementById('adminBtn').style.display = 'block';
    }
    if (profile.role === 'owner') {
        document.getElementById('ownerBtn').style.display = 'block';
    }
}

function loadSection(name) {
    const content = document.getElementById('mainContent');
    if(name === 'players') content.innerHTML = '<h2>Clan Players</h2><p>Список игроков загружается...</p>';
    if(name === 'admin') content.innerHTML = '<h2>Admin Panel</h2><p>Здесь вы можете редактировать игроков.</p>';
    if(name === 'owner') content.innerHTML = '<h2>Owner Panel</h2><p>Здесь вы управляете правами админов.</p>';
}

checkRole();
