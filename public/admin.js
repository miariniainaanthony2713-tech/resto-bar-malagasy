var socket = io();
var connectionStatus = document.getElementById('connection_status');

/* ── Token admin ── */
var ADMIN_TOKEN = sessionStorage.getItem('admin_token');
if (!ADMIN_TOKEN) { window.location.href = '/login.html'; }

function authFetch(url, options) {
  options = options || {};
  options.headers = options.headers || {};
  options.headers['x-admin-token'] = ADMIN_TOKEN;
  return fetch(url, options).then(function(r){
    if (r.status === 401) { window.location.href = '/login.html'; }
    return r;
  });
}

/* ══════════════════════════════════════════════
   NAVIGATION PAR ONGLETS
══════════════════════════════════════════════ */
document.querySelectorAll('.admin_tab').forEach(function(tab){
  tab.addEventListener('click', function(){
    document.querySelectorAll('.admin_tab').forEach(function(t){ t.classList.remove('active'); });
    document.querySelectorAll('.admin_panel').forEach(function(p){ p.classList.remove('active'); });
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
  });
});

/* ══════════════════════════════════════════════
   COMMANDES
══════════════════════════════════════════════ */
var ordersList = document.getElementById('orders_list');
var ordersBadge = document.getElementById('orders_badge');
var newOrderCount = 0;

var ORDER_STATUSES = [
  { value: 'nouvelle',      label: 'Nouvelle' },
  { value: 'en_preparation', label: 'En préparation' },
  { value: 'prete',         label: 'Prête' },
  { value: 'servie',        label: 'Servie' }
];

function formatTime(iso){
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function buildOrderCard(order){
  var card = document.createElement('div');
  card.className = 'order_card status-' + order.status;
  card.dataset.id = order.id;

  var itemsHtml = order.items.map(function(i){
    return '<li><span>' + i.quantity + ' × ' + i.name + '</span><span>' +
      (i.price * i.quantity).toLocaleString('fr-FR') + ' Ar</span></li>';
  }).join('');

  var options = ORDER_STATUSES.map(function(s){
    return '<option value="' + s.value + '"' + (s.value === order.status ? ' selected' : '') + '>' + s.label + '</option>';
  }).join('');

  var paymentHtml = order.payment
    ? '<p class="order_payment">💳 ' + order.payment.operator + ' · TXN : ' + order.payment.transactionId + '</p>'
    : '';

  card.innerHTML =
    '<div class="order_header">' +
      '<span>Table : ' + order.tableNumber + '</span>' +
      '<span class="order_time">' + formatTime(order.createdAt) + '</span>' +
    '</div>' +
    '<p class="order_customer">Client : ' + order.customerName + '</p>' +
    paymentHtml +
    '<ul class="order_items">' + itemsHtml + '</ul>' +
    '<p class="order_total">Total : ' + order.total.toLocaleString('fr-FR') + ' Ar</p>' +
    '<select class="order_status">' + options + '</select>';

  card.querySelector('.order_status').addEventListener('change', function(e){
    authFetch('/api/orders/' + order.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: e.target.value })
    });
  });
  return card;
}

function addOrUpdateOrder(order, prepend){
  var existing = ordersList.querySelector('[data-id="' + order.id + '"]');
  var emptyState = ordersList.querySelector('.empty_state');
  if (emptyState) emptyState.remove();
  var card = buildOrderCard(order);
  if (existing) { existing.replaceWith(card); }
  else if (prepend) { ordersList.insertBefore(card, ordersList.firstChild); }
  else { ordersList.appendChild(card); }
}

authFetch('/api/orders').then(function(r){ return r.json(); }).then(function(orders){
  orders.forEach(function(o){ addOrUpdateOrder(o, false); });
});

socket.on('new-order', function(order){
  addOrUpdateOrder(order, true);
  newOrderCount++;
  ordersBadge.textContent = newOrderCount;
});
socket.on('order-updated', function(order){ addOrUpdateOrder(order, false); });

/* ══════════════════════════════════════════════
   MENU
══════════════════════════════════════════════ */
var menuList = document.getElementById('menu_list');
var menuFeedback = document.getElementById('menu_feedback');
var saveBtn = document.getElementById('save_item_btn');
var cancelBtn = document.getElementById('cancel_edit_btn');
var formTitle = document.getElementById('menu_form_title');
var editIdInput = document.getElementById('edit_id');
var itemCategory = document.getElementById('item_category');
var subcategoryGroup = document.getElementById('subcategory_group');
var imagePreview = document.getElementById('image_preview');

itemCategory.addEventListener('change', function(){
  subcategoryGroup.style.display = itemCategory.value === 'boissons' ? '' : 'none';
});

document.getElementById('item_image').addEventListener('change', function(e){
  var file = e.target.files[0];
  if (file){
    var reader = new FileReader();
    reader.onload = function(ev){
      imagePreview.src = ev.target.result;
      imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
});

function catLabel(item){
  var labels = { entrees:'Entrées', plats:'Plats', desserts:'Desserts' };
  if (item.category === 'boissons'){
    var sub = { alcoolisees:'Alcoolisées', softs:'Softs', locales:'Locales' };
    return 'Boissons · ' + (sub[item.subcategory] || item.subcategory);
  }
  return labels[item.category] || item.category;
}

function buildMenuCard(item){
  var card = document.createElement('div');
  card.className = 'menu_item_card';
  card.dataset.id = item.id;
  var imgSrc = item.image || 'placeholder-plat.svg';
  card.innerHTML =
    '<img src="' + imgSrc + '" alt="' + item.name + '" onerror="this.src=\'placeholder-plat.svg\'">' +
    '<p class="item_name">' + item.name + '</p>' +
    '<p class="item_price">' + item.price.toLocaleString('fr-FR') + ' Ar</p>' +
    '<p class="item_cat">' + catLabel(item) + '</p>' +
    '<div class="item_actions">' +
      '<button class="btn_edit">Modifier</button>' +
      '<button class="btn_delete">Supprimer</button>' +
    '</div>';

  card.querySelector('.btn_edit').addEventListener('click', function(){
    editIdInput.value = item.id;
    document.getElementById('item_name').value = item.name;
    document.getElementById('item_price').value = item.price;
    itemCategory.value = item.category;
    subcategoryGroup.style.display = item.category === 'boissons' ? '' : 'none';
    if (item.subcategory) document.getElementById('item_subcategory').value = item.subcategory;
    if (item.image){ imagePreview.src = item.image; imagePreview.style.display = 'block'; }
    formTitle.textContent = 'Modifier le plat';
    saveBtn.textContent = 'Enregistrer';
    cancelBtn.style.display = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  card.querySelector('.btn_delete').addEventListener('click', function(){
    if (!confirm('Supprimer "' + item.name + '" ?')) return;
    authFetch('/api/menu/' + item.id, { method: 'DELETE' }).then(function(r){ if(!r.ok) throw new Error(); });
  });
  return card;
}

function renderMenuAdmin(items){
  menuList.innerHTML = '';
  if (!items.length){
    menuList.innerHTML = '<p class="empty_state">Aucun article dans le menu.</p>';
    return;
  }
  items.forEach(function(item){ menuList.appendChild(buildMenuCard(item)); });
}

authFetch('/api/menu').then(function(r){ return r.json(); }).then(renderMenuAdmin);

function resetMenuForm(){
  editIdInput.value = '';
  document.getElementById('item_name').value = '';
  document.getElementById('item_price').value = '';
  document.getElementById('item_image').value = '';
  itemCategory.value = 'entrees';
  subcategoryGroup.style.display = 'none';
  imagePreview.style.display = 'none';
  formTitle.textContent = 'Ajouter un plat / boisson';
  saveBtn.textContent = 'Ajouter';
  cancelBtn.style.display = 'none';
  menuFeedback.textContent = '';
}

cancelBtn.addEventListener('click', resetMenuForm);

saveBtn.addEventListener('click', function(){
  var name  = document.getElementById('item_name').value.trim();
  var price = document.getElementById('item_price').value;
  var cat   = itemCategory.value;
  var sub   = cat === 'boissons' ? document.getElementById('item_subcategory').value : '';
  var file  = document.getElementById('item_image').files[0];
  var id    = editIdInput.value;

  if (!name || !price){
    menuFeedback.textContent = 'Nom et prix sont obligatoires.';
    menuFeedback.className = 'form_feedback error';
    return;
  }

  var formData = new FormData();
  formData.append('name', name);
  formData.append('price', price);
  formData.append('category', cat);
  formData.append('subcategory', sub);
  if (file) formData.append('image', file);

  var url    = id ? '/api/menu/' + id : '/api/menu';
  var method = id ? 'PATCH' : 'POST';

  menuFeedback.textContent = 'Enregistrement...';
  menuFeedback.className = 'form_feedback';
  saveBtn.disabled = true;

  authFetch(url, { method: method, body: formData })
    .then(function(r){ if(!r.ok) throw new Error(); return r.json(); })
    .then(function(){
      menuFeedback.textContent = id ? 'Plat modifié !' : 'Plat ajouté !';
      menuFeedback.className = 'form_feedback success';
      saveBtn.disabled = false;
      resetMenuForm();
    })
    .catch(function(){
      menuFeedback.textContent = 'Erreur lors de l\'enregistrement.';
      menuFeedback.className = 'form_feedback error';
      saveBtn.disabled = false;
    });
});

socket.on('menu-updated', function(items){ renderMenuAdmin(items); });

/* ══════════════════════════════════════════════
   RÉSERVATIONS
══════════════════════════════════════════════ */
var resList = document.getElementById('reservations_list');
var resBadge = document.getElementById('res_badge');
var newResCount = 0;

var RES_STATUSES = [
  { value: 'en_attente',  label: 'En attente' },
  { value: 'confirme',    label: 'Confirmée' },
  { value: 'annule',      label: 'Annulée' }
];

function buildResCard(r){
  var card = document.createElement('div');
  card.className = 'reservation_card status-' + r.status;
  card.dataset.id = r.id;

  var dateStr = new Date(r.date + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  var options = RES_STATUSES.map(function(s){
    return '<option value="' + s.value + '"' + (s.value === r.status ? ' selected' : '') + '>' + s.label + '</option>';
  }).join('');

  card.innerHTML =
    '<p class="res_name">' + r.name + '</p>' +
    '<p class="res_date">' + dateStr + '</p>' +
    '<p class="res_info">📧 ' + r.email + '</p>' +
    '<p class="res_info">📞 ' + r.phone + '</p>' +
    '<select class="res_status_select">' + options + '</select>';

  card.querySelector('.res_status_select').addEventListener('change', function(e){
    authFetch('/api/reservations/' + r.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: e.target.value })
    });
  });
  return card;
}

function addOrUpdateRes(r, prepend){
  var existing = resList.querySelector('[data-id="' + r.id + '"]');
  var emptyState = resList.querySelector('.empty_state');
  if (emptyState) emptyState.remove();
  var card = buildResCard(r);
  if (existing) { existing.replaceWith(card); }
  else if (prepend) { resList.insertBefore(card, resList.firstChild); }
  else { resList.appendChild(card); }
}

authFetch('/api/reservations').then(function(r){ return r.json(); }).then(function(list){
  list.forEach(function(r){ addOrUpdateRes(r, false); });
});

socket.on('new-reservation', function(r){
  addOrUpdateRes(r, true);
  newResCount++;
  resBadge.textContent = newResCount;
});
socket.on('reservation-updated', function(r){ addOrUpdateRes(r, false); });

/* ── Connexion ── */
socket.on('connect',    function(){ connectionStatus.textContent = 'En direct'; connectionStatus.classList.add('connected'); });
socket.on('disconnect', function(){ connectionStatus.textContent = 'Déconnecté'; connectionStatus.classList.remove('connected'); });
