/* Injecte le header et le panier dans toutes les pages */
var CURRENT_PAGE = document.body.dataset.page || '';

var headerHTML = `
<header>
  <div class="logo">
    <a href="/"><p><span>RESTO BAR</span> MALAGASY</p></a>
  </div>
  <ul class="nav_menu">
    <li><a href="/" class="${CURRENT_PAGE==='accueil'?'active':''}">Accueil</a></li>
    <li><a href="/menu.html" class="${CURRENT_PAGE==='menu'?'active':''}">Menu</a></li>
    <li><a href="/apropos.html" class="${CURRENT_PAGE==='apropos'?'active':''}">À Propos</a></li>
    <li><a href="/reservation.html" class="${CURRENT_PAGE==='reservation'?'active':''}">Réservation</a></li>
  </ul>
  <div class="cart_icon" id="cart_icon">🛒 <span id="cart_count">0</span></div>
  <div class="toggle_menu"></div>
</header>

<div class="cart_overlay" id="cart_overlay"></div>
<div class="cart_panel" id="cart_panel">
  <div id="step_cart" class="cart_step active">
    <div class="cart_header">
      <h3>Votre commande</h3>
      <span class="cart_close" id="cart_close">&times;</span>
    </div>
    <div id="cart_items" class="cart_items"></div>
    <p class="cart_total">Total : <span id="cart_total">0</span> Ar</p>
    <label>Votre nom</label>
    <input type="text" id="customer_name" placeholder="Votre nom">
    <label>Votre email (pour recevoir le ticket)</label>
    <input type="email" id="customer_email" placeholder="email@exemple.com">
    <label>Numéro de table</label>
    <input type="text" id="table_number" placeholder="Ex : Table 4">
    <button id="go_to_payment">Choisir le paiement →</button>
    <p id="order_feedback" class="order_feedback"></p>
  </div>
  <div id="step_payment" class="cart_step">
    <div class="cart_header">
      <span class="cart_back" id="back_to_cart">← Retour</span>
      <h3>Paiement</h3>
      <span class="cart_close cart_close_2">&times;</span>
    </div>
    <p class="payment_total_label">Montant à payer</p>
    <p class="payment_total_amount"><span id="payment_amount">0</span> Ar</p>
    <p class="payment_choose_label">Choisissez votre mode de paiement :</p>
    <div class="payment_operators">
      <button class="operator_btn active" data-operator="mvola"><span class="op_icon">📱</span><span>MVola</span></button>
      <button class="operator_btn" data-operator="orange"><span class="op_icon">🟠</span><span>Orange Money</span></button>
      <button class="operator_btn" data-operator="especes"><span class="op_icon">💵</span><span>Espèces</span></button>
    </div>
    <div class="payment_instructions" id="payment_instructions">
      <p class="instr_title">Comment payer avec <span id="op_name">MVola</span> :</p>
      <ol id="mobile_money_steps">
        <li>Composez <strong id="op_ussd">*111#</strong></li>
        <li>Choisissez "Envoyer de l'argent"</li>
        <li>Envoyez <strong><span id="instr_amount">0</span> Ar</strong> au numéro <strong id="op_number">034 XX XX XX</strong></li>
        <li>Gardez votre numéro de transaction</li>
      </ol>
      <div id="especes_instructions" style="display:none">
        <p style="font-size:13px;color:#555;line-height:1.7">Votre commande sera préparée et le paiement se fera <strong>en espèces</strong> directement à la livraison ou à la caisse.<br>Merci de préparer le montant exact.</p>
      </div>
      <div id="transaction_group">
        <label>Votre numéro de transaction</label>
        <input type="text" id="transaction_id" placeholder="Ex : TXN123456">
      </div>
    </div>
    <button id="submit_order">Confirmer la commande</button>
    <p id="payment_feedback" class="order_feedback"></p>
  </div>
  <div id="step_receipt" class="cart_step">
    <div class="receipt_header">
      <div class="receipt_check">✓</div>
      <h3>Commande confirmée !</h3>
      <p>Merci, votre commande est en cours de préparation.</p>
    </div>
    <div class="receipt_body" id="receipt_body">
      <div class="receipt_row"><span>Nom</span><span id="rcpt_name">—</span></div>
      <div class="receipt_row"><span>Table</span><span id="rcpt_table">—</span></div>
      <div class="receipt_row"><span>Paiement</span><span id="rcpt_operator">—</span></div>
      <div class="receipt_row"><span>Transaction</span><span id="rcpt_txn">—</span></div>
      <hr class="receipt_hr">
      <div id="rcpt_items" class="rcpt_items"></div>
      <hr class="receipt_hr">
      <div class="receipt_row receipt_total_row"><span>TOTAL</span><span id="rcpt_total">0 Ar</span></div>
      <p class="receipt_note">Le paiement sera vérifié par notre équipe. En cas de problème, contactez-nous au <strong>034 XX XX XX</strong>.</p>
    </div>
    <div class="receipt_actions">
      <button id="download_pdf_btn" class="receipt_btn_pdf">⬇ Télécharger le ticket PDF</button>
      <button id="send_email_btn" class="receipt_btn_email">✉ Recevoir par email</button>
    </div>
    <p id="email_ticket_feedback" class="order_feedback"></p>
    <button id="close_receipt">Fermer</button>
  </div>
</div>`;

document.body.insertAdjacentHTML('afterbegin', headerHTML);
