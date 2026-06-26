/* ── Menu responsive ── */
var small_menu = document.querySelector('.toggle_menu');
var nav_menu = document.querySelector('.nav_menu');
if (small_menu && nav_menu) {
  small_menu.onclick = function(){
    small_menu.classList.toggle('active');
    nav_menu.classList.toggle('responsive');
  };
}

/* ── Panier global (disponible sur toutes les pages) ── */
var cart = JSON.parse(sessionStorage.getItem('cart') || '[]');
var currentOperator = 'mvola';

var OPERATORS = {
  mvola:   { name: 'MVola',        ussd: '*111#', number: '034 XX XX XX', mobile: true },
  orange:  { name: 'Orange Money', ussd: '#144#', number: '032 XX XX XX', mobile: true },
  especes: { name: 'Espèces',      ussd: '',      number: '',              mobile: false }
};

var cartIcon    = document.getElementById('cart_icon');
var cartPanel   = document.getElementById('cart_panel');
var cartOverlay = document.getElementById('cart_overlay');
var cartCountEl = document.getElementById('cart_count');
var cartTotalEl = document.getElementById('cart_total');
var cartItemsEl = document.getElementById('cart_items');
var feedbackEl  = document.getElementById('order_feedback');

function saveCart(){ sessionStorage.setItem('cart', JSON.stringify(cart)); }

function showStep(id){
  document.querySelectorAll('.cart_step').forEach(function(s){ s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
}
function openCart(){
  if (!cartPanel) return;
  cartPanel.classList.add('open');
  cartOverlay.classList.add('open');
  showStep('step_cart');
}
function closeCart(){
  if (!cartPanel) return;
  cartPanel.classList.remove('open');
  cartOverlay.classList.remove('open');
}

if (cartIcon) cartIcon.onclick = openCart;
if (cartOverlay) cartOverlay.onclick = closeCart;
var cartClose = document.getElementById('cart_close');
if (cartClose) cartClose.onclick = closeCart;
document.querySelectorAll('.cart_close_2').forEach(function(el){ el.onclick = closeCart; });
var backToCart = document.getElementById('back_to_cart');
if (backToCart) backToCart.onclick = function(){ showStep('step_cart'); };
var closeReceipt = document.getElementById('close_receipt');
if (closeReceipt) closeReceipt.onclick = function(){
  closeCart();
  setTimeout(function(){ showStep('step_cart'); }, 400);
};

function getTotal(){ return cart.reduce(function(s,i){ return s + i.price*i.qty; }, 0); }

function renderCart(){
  if (!cartItemsEl) return;
  cartItemsEl.innerHTML = '';
  var count = 0;
  if (cart.length === 0){
    cartItemsEl.innerHTML = '<p class="cart_empty">Votre panier est vide.</p>';
  }
  cart.forEach(function(item, index){
    count += item.qty;
    var row = document.createElement('div');
    row.className = 'cart_item';
    row.innerHTML =
      '<span class="cart_item_name">' + item.name + '</span>' +
      '<div class="cart_item_qty">' +
        '<button class="qty_btn" data-action="dec" data-index="' + index + '">-</button>' +
        '<span>' + item.qty + '</span>' +
        '<button class="qty_btn" data-action="inc" data-index="' + index + '">+</button>' +
      '</div>' +
      '<span class="cart_item_price">' + (item.price*item.qty).toLocaleString('fr-FR') + ' Ar</span>';
    cartItemsEl.appendChild(row);
  });
  cartItemsEl.querySelectorAll('.qty_btn').forEach(function(btn){
    btn.onclick = function(){
      var i = parseInt(btn.dataset.index, 10);
      if (btn.dataset.action === 'inc') { cart[i].qty++; }
      else { cart[i].qty--; if (cart[i].qty <= 0) cart.splice(i, 1); }
      saveCart(); renderCart();
    };
  });
  if (cartTotalEl) cartTotalEl.textContent = getTotal().toLocaleString('fr-FR');
  if (cartCountEl) cartCountEl.textContent = count;
}

function addToCart(name, price){
  var existing = cart.find(function(i){ return i.name === name; });
  if (existing){ existing.qty++; } else { cart.push({ name: name, price: price, qty: 1 }); }
  saveCart(); renderCart(); openCart();
}

/* ── Opérateurs de paiement ── */
document.querySelectorAll('.operator_btn').forEach(function(btn){
  btn.addEventListener('click', function(){
    document.querySelectorAll('.operator_btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    currentOperator = btn.dataset.operator;
    updateOperatorUI();
  });
});

function updateOperatorUI(){
  var op = OPERATORS[currentOperator];
  var opName = document.getElementById('op_name');
  var opUssd = document.getElementById('op_ussd');
  var opNumber = document.getElementById('op_number');
  var instrAmount = document.getElementById('instr_amount');
  var paymentAmount = document.getElementById('payment_amount');
  var mobileSteps = document.getElementById('mobile_money_steps');
  var especesInstr = document.getElementById('especes_instructions');
  var txnGroup = document.getElementById('transaction_group');

  if (opName) opName.textContent = op.name;
  if (opUssd) opUssd.textContent = op.ussd;
  if (opNumber) opNumber.textContent = op.number;
  if (instrAmount) instrAmount.textContent = getTotal().toLocaleString('fr-FR');
  if (paymentAmount) paymentAmount.textContent = getTotal().toLocaleString('fr-FR');

  if (op.mobile) {
    if (mobileSteps) mobileSteps.style.display = '';
    if (especesInstr) especesInstr.style.display = 'none';
    if (txnGroup) txnGroup.style.display = '';
  } else {
    if (mobileSteps) mobileSteps.style.display = 'none';
    if (especesInstr) especesInstr.style.display = '';
    if (txnGroup) txnGroup.style.display = 'none';
  }
}

var goToPayment = document.getElementById('go_to_payment');
if (goToPayment) goToPayment.onclick = function(){
  if (cart.length === 0){
    if(feedbackEl){ feedbackEl.textContent = 'Votre panier est vide.'; feedbackEl.className = 'order_feedback error'; }
    return;
  }
  if (!document.getElementById('customer_name').value.trim()){
    if(feedbackEl){ feedbackEl.textContent = 'Veuillez entrer votre nom.'; feedbackEl.className = 'order_feedback error'; }
    return;
  }
  if(feedbackEl) feedbackEl.textContent = '';
  updateOperatorUI();
  showStep('step_payment');
};

var submitOrder = document.getElementById('submit_order');
if (submitOrder) submitOrder.onclick = function(){
  var txn = document.getElementById('transaction_id') ? document.getElementById('transaction_id').value.trim() : '';
  var payFeedback = document.getElementById('payment_feedback');
  var op = OPERATORS[currentOperator];

  if (op.mobile && !txn){
    if(payFeedback){ payFeedback.textContent = 'Veuillez entrer votre numéro de transaction.'; payFeedback.className = 'order_feedback error'; }
    return;
  }
  var customerName  = document.getElementById('customer_name').value;
  var customerEmail = document.getElementById('customer_email') ? document.getElementById('customer_email').value.trim() : '';
  var tableNumber   = document.getElementById('table_number').value;
  var total = getTotal();
  var order = {
    customerName: customerName,
    customerEmail: customerEmail,
    tableNumber: tableNumber,
    payment: { operator: op.name, transactionId: op.mobile ? txn : 'Espèces' },
    items: cart.map(function(item){ return { name: item.name, price: item.price, quantity: item.qty }; })
  };
  if(payFeedback){ payFeedback.textContent = 'Envoi en cours...'; payFeedback.className = 'order_feedback'; }
  submitOrder.disabled = true;
  fetch('/api/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order)
  })
  .then(function(res){ if(!res.ok) throw new Error(); return res.json(); })
  .then(function(savedOrder){
    /* Remplir le reçu */
    document.getElementById('rcpt_name').textContent     = customerName || '—';
    document.getElementById('rcpt_table').textContent    = tableNumber  || '—';
    document.getElementById('rcpt_operator').textContent = op.name;
    var rcptTxn = document.getElementById('rcpt_txn');
    if (rcptTxn) rcptTxn.textContent = op.mobile ? txn : 'Paiement à la caisse';
    document.getElementById('rcpt_total').textContent = total.toLocaleString('fr-FR') + ' Ar';
    var rcptItems = document.getElementById('rcpt_items');
    rcptItems.innerHTML = '';
    order.items.forEach(function(item){
      var row = document.createElement('div');
      row.className = 'receipt_row';
      row.innerHTML = '<span>' + item.quantity + ' × ' + item.name + '</span><span>' + (item.price*item.quantity).toLocaleString('fr-FR') + ' Ar</span>';
      rcptItems.appendChild(row);
    });

    /* Sauvegarder les données de commande pour PDF/email */
    window._lastOrder = { order: order, total: total, op: op, txn: txn };

    /* Réinitialiser */
    cart = []; saveCart(); renderCart();
    document.getElementById('customer_name').value  = '';
    document.getElementById('customer_email').value = '';
    document.getElementById('table_number').value   = '';
    if(document.getElementById('transaction_id')) document.getElementById('transaction_id').value = '';
    submitOrder.disabled = false;
    if(payFeedback) payFeedback.textContent = '';
    showStep('step_receipt');

    /* Envoyer email automatiquement si email fourni */
    if (customerEmail) {
      fetch('/api/orders/' + savedOrder.id + '/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(function(){});
    }
  })
  .catch(function(){
    if(payFeedback){ payFeedback.textContent = 'Erreur. Réessayez.'; payFeedback.className = 'order_feedback error'; }
    submitOrder.disabled = false;
  });
};

/* ── Télécharger le ticket en PDF ── */
document.addEventListener('click', function(e){
  if (e.target && e.target.id === 'download_pdf_btn'){
    generatePDF();
  }
  if (e.target && e.target.id === 'send_email_btn'){
    sendTicketEmail();
  }
});

function generatePDF(){
  if (!window._lastOrder) return;
  var o = window._lastOrder;
  var date = new Date().toLocaleDateString('fr-FR', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });

  var itemsRows = o.order.items.map(function(item){
    return '<tr><td style="padding:6px 0;border-bottom:1px dashed #eee">' + item.quantity + ' × ' + item.name + '</td><td style="text-align:right;padding:6px 0;border-bottom:1px dashed #eee">' + (item.price*item.quantity).toLocaleString('fr-FR') + ' Ar</td></tr>';
  }).join('');

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ticket Resto Bar Malagasy</title></head><body style="font-family:sans-serif;max-width:400px;margin:auto;padding:20px;color:#1A1A1A">' +
    '<div style="text-align:center;margin-bottom:20px">' +
      '<h2 style="color:#FF6B00;margin:0">RESTO BAR</h2>' +
      '<h3 style="margin:4px 0">MALAGASY</h3>' +
      '<p style="color:#999;font-size:12px;margin:4px 0">Antananarivo, Madagascar</p>' +
      '<p style="color:#999;font-size:12px;margin:4px 0">' + date + '</p>' +
    '</div>' +
    '<hr style="border:none;border-top:2px dashed #FF6B00;margin:16px 0">' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>' + itemsRows + '</tbody></table>' +
    '<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:15px;margin-top:12px;padding-top:8px;border-top:2px solid #1A1A1A">' +
      '<span>TOTAL</span><span style="color:#FF6B00">' + o.total.toLocaleString('fr-FR') + ' Ar</span>' +
    '</div>' +
    '<hr style="border:none;border-top:2px dashed #FF6B00;margin:16px 0">' +
    '<div style="font-size:12px;color:#555">' +
      '<p><strong>Client :</strong> ' + (o.order.customerName || '—') + '</p>' +
      '<p><strong>Table :</strong> ' + (o.order.tableNumber || '—') + '</p>' +
      '<p><strong>Paiement :</strong> ' + o.op.name + '</p>' +
      (o.op.mobile ? '<p><strong>Transaction :</strong> ' + o.txn + '</p>' : '<p><strong>Paiement à la caisse</strong></p>') +
    '</div>' +
    '<p style="text-align:center;font-size:11px;color:#999;margin-top:20px">Merci de votre visite ! 🍽️</p>' +
    '</body></html>';

  var win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(function(){ win.print(); }, 500);
}

function sendTicketEmail(){
  if (!window._lastOrder) return;
  var emailFeedback = document.getElementById('email_ticket_feedback');
  var email = prompt('Entrez votre adresse email pour recevoir le ticket :');
  if (!email || !email.includes('@')) {
    if(emailFeedback){ emailFeedback.textContent = 'Email invalide.'; emailFeedback.className = 'order_feedback error'; }
    return;
  }
  if(emailFeedback){ emailFeedback.textContent = 'Envoi en cours...'; emailFeedback.className = 'order_feedback'; }
  fetch('/api/send-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, order: window._lastOrder.order, total: window._lastOrder.total })
  })
  .then(function(r){ if(!r.ok) throw new Error(); return r.json(); })
  .then(function(){
    if(emailFeedback){ emailFeedback.textContent = 'Ticket envoyé à ' + email + ' !'; emailFeedback.className = 'order_feedback success'; }
  })
  .catch(function(){
    if(emailFeedback){ emailFeedback.textContent = 'Erreur envoi email. Réessayez.'; emailFeedback.className = 'order_feedback error'; }
  });
}

renderCart();
