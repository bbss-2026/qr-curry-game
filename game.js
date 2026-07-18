
// ============================================================
// 画面内デバッグエラーパネル（デバッグモード中のみ表示）
// PC/Macが無くてもiPhone本体だけでJSエラーの中身を確認できるようにするための仕組み。
// window.onerrorとunhandledrejection（Promiseのcatch漏れ含む）の両方を拾う。
// ============================================================
(function() {
    function isDebugModeNow() { return localStorage.getItem('qr_debug_mode') === '1'; }
    function showDebugErrorPanel(text) {
        if (!isDebugModeNow()) return;
        try {
            let panel = document.getElementById('debugErrorPanel');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'debugErrorPanel';
                panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:100002;background:rgba(0,0,0,0.92);color:#7CFC7C;font-size:10px;line-height:1.5;padding:8px 10px;max-height:35vh;overflow-y:auto;font-family:monospace;white-space:pre-wrap;word-break:break-all;';
                const closeBtn = document.createElement('div');
                closeBtn.innerText = '✕ 閉じる';
                closeBtn.style.cssText = 'color:#fff;text-align:right;font-weight:bold;cursor:pointer;margin-bottom:4px;';
                closeBtn.onclick = function() { panel.style.display = 'none'; };
                panel.appendChild(closeBtn);
                document.body.appendChild(panel);
            }
            panel.style.display = 'block';
            const line = document.createElement('div');
            line.style.cssText = 'border-top:1px solid #333;padding-top:4px;margin-top:4px;';
            line.innerText = '[' + new Date().toLocaleTimeString('ja-JP') + '] ' + text;
            panel.appendChild(line);
        } catch(e) { /* noop */ }
    }
    window.addEventListener('error', function(ev) {
        showDebugErrorPanel('JSエラー: ' + (ev.message || '') + '\n@ ' + (ev.filename || '') + ':' + (ev.lineno || '') + ':' + (ev.colno || ''));
    });
    window.addEventListener('unhandledrejection', function(ev) {
        let msg = '';
        try { msg = ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason); } catch(e) { msg = '(詳細取得不可)'; }
        showDebugErrorPanel('未処理のPromiseエラー: ' + msg);
    });
    window.__showDebugErrorPanel = showDebugErrorPanel; // 他の箇所から手動でログを出したい場合用
})();

// 全アイコンリスト（番号順）
const ALL_ICON_LIST = ["myimageicon/mayimage01.png","myimageicon/mayimage02.png","myimageicon/mayimage03.png","myimageicon/mayimage04.png","myimageicon/mayimage05.png","myimageicon/mayimage06.png"];
// 解放済みアイコン（初期は01〜03）
// 古い形式（フォルダなしのファイル名のみ）を新しい形式（myimageicon/付き）に変換する
function migrateIconPath(filename) {
    if(!filename) return filename;
    if(filename.indexOf('/') !== -1) return filename; // 既に新形式（フォルダ付き）ならそのまま
    if(/^mayimage0[1-9]\.png$/.test(filename)) return 'myimageicon/' + filename;
    return filename;
}

function getUnlockedIcons() {
    const saved = localStorage.getItem("unlockedIcons");
    if(saved) {
        const list = JSON.parse(saved).map(migrateIconPath);
        return list;
    }
    return ["myimageicon/mayimage01.png","myimageicon/mayimage02.png","myimageicon/mayimage03.png"];
}
function saveUnlockedIcons(list) {
    localStorage.setItem("unlockedIcons", JSON.stringify(list));
}
function unlockIcon(filename) {
    const list = getUnlockedIcons();
    if (!list.includes(filename)) {
        list.push(filename);
        saveUnlockedIcons(list);
        return true; // 新規解放
    }
    return false;
}

let currentIconFile = migrateIconPath(localStorage.getItem("selectedPlayerIcon")) || "myimageicon/mayimage01.png";

function togglePlayerIcon() {
    showIconSelectModal();
}

function showIconGetOverlay(iconSrc, subText) {
    const overlay = document.getElementById('iconGetOverlay');
    const img = document.getElementById('iconGetImg');
    const sub = document.getElementById('iconGetSubText');
    if(!overlay || !img) return;
    img.src = iconSrc;
    if(sub) sub.innerText = subText || 'くじの気まぐれ';
    // アニメーションをリセットして再生
    img.style.animation = 'none';
    img.offsetHeight; // reflow
    img.style.animation = 'iconPop 0.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards';
    setTimeout(() => { img.style.animation = 'iconPop 0.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards, iconShine 1.5s 0.6s infinite'; }, 0);
    overlay.style.display = 'flex';
    playSoundEffect('syakiin.mp3');
}

function closeIconGetOverlay() {
    const overlay = document.getElementById('iconGetOverlay');
    if(overlay) overlay.style.display = 'none';
}

function showCoinGetOverlay(amount) {
    const overlay = document.getElementById('coinGetOverlay');
    const amountEl = document.getElementById('coinGetAmountText');
    if(!overlay) return;
    if(amountEl) amountEl.innerText = `+${amount || 1}枚`;
    const img = overlay.querySelector('.coin-get-img');
    if(img) {
        img.style.animation = 'none';
        img.offsetHeight;
        img.style.animation = 'iconPop 0.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards';
        setTimeout(() => { img.style.animation = 'iconPop 0.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards, coinShine 1.5s 0.6s infinite'; }, 0);
    }
    overlay.style.display = 'flex';
    playSoundEffect('syakiin.mp3');
}

function closeCoinGetOverlay() {
    const overlay = document.getElementById('coinGetOverlay');
    if(overlay) overlay.style.display = 'none';
}

function getCookCondition() {
    try { return JSON.parse(localStorage.getItem('qr_cook_condition') || '{}'); } catch(e) { return {}; }
}
function saveCookCondition(cond) {
    localStorage.setItem('qr_cook_condition', JSON.stringify(cond));
}

function showCookConditionModal() {
    const cond = getCookCondition();
    const stats = cond.stats || [];
    const msg = '<div style="font-size:12px;color:#420000;margin-bottom:10px;">優先ステータス（複数可・未選択でランダム）</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:14px;">'
        + ['HP','ATK','DEF','SPD'].map(s =>
            `<label style="display:flex;align-items:center;gap:4px;padding:8px 12px;background:#f5e9c8;border:1px solid #b88742;border-radius:4px;font-size:13px;font-weight:bold;color:#420000;cursor:pointer;">`
            + `<input type="checkbox" id="condChk${s}" ${stats.includes(s.toLowerCase())?'checked':''} style="width:16px;height:16px;">${s}`
            + `</label>`
        ).join('')
        + '</div>'
        + '<div style="font-size:12px;color:#420000;margin-bottom:8px;font-weight:bold;">除外する食材</div>'
        + '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:4px;">'
        + [
            { id:'condExcLock',    label:'ロック食材',  key:'excludeLocked',  def:true },
            { id:'condExcMid',     label:'中級食材',    key:'excludeMid',     def:false },
            { id:'condExcHigh',    label:'高級食材',    key:'excludeHigh',    def:false },
            { id:'condExcSpecial', label:'特殊食材',    key:'excludeSpecial', def:false },
          ].map(o =>
            `<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#420000;cursor:pointer;">`
            + `<input type="checkbox" id="${o.id}" ${(cond[o.key]??o.def)?'checked':''} style="width:16px;height:16px;">${o.label}`
            + `</label>`
          ).join('')
        + '</div>';
    showCustomConfirm('⚙️ 条件選択', msg, function() {
        const newCond = {
            stats: ['HP','ATK','DEF','SPD'].filter(s => { const c = document.getElementById('condChk'+s); return c && c.checked; }).map(s => s.toLowerCase()),
            excludeLocked:  !!(document.getElementById('condExcLock')    && document.getElementById('condExcLock').checked),
            excludeMid:     !!(document.getElementById('condExcMid')     && document.getElementById('condExcMid').checked),
            excludeHigh:    !!(document.getElementById('condExcHigh')    && document.getElementById('condExcHigh').checked),
            excludeSpecial: !!(document.getElementById('condExcSpecial') && document.getElementById('condExcSpecial').checked),
        };
        saveCookCondition(newCond);
        showCustomAlert('✅ 保存しました', '条件を保存しました。「おすすめセット」を押すとこの条件で選択します。');
    });
}

// おすすめセット共通ヘルパー：同じ食材が所持数を超えて複数枠にセットされないよう、
// 優先度に合った候補食材を「所持数分だけ複製した山」から重複なしで最大3つ引く（フェス外・フェス共通で使用）
function pickRecommendedIngredients(availNames, invObj, priorityStats) {
    let candidateNames = availNames;
    if(priorityStats.length > 0) {
        const scoreOf = function(d) { let s=0; priorityStats.forEach(function(st){ s += d[st]||0; }); return s; };
        const sorted = availNames.slice().sort(function(a,b){ return scoreOf(masterIngredients[b]) - scoreOf(masterIngredients[a]); });
        candidateNames = sorted.slice(0, Math.min(5, sorted.length));
    }
    const pool = [];
    candidateNames.forEach(function(n) {
        const cnt = Math.min(invObj[n] || 0, 3);
        for(let i = 0; i < cnt; i++) pool.push(n);
    });
    const picks = [];
    for(let i = 0; i < 3 && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        picks.push(pool[idx]);
        pool.splice(idx, 1);
    }
    return picks;
}
function applyRecommendedSet() {
    const cond = getCookCondition();
    const priorityStats = cond.stats || [];
    const excludeLocked  = cond.excludeLocked  ?? true;
    const excludeMid     = cond.excludeMid     ?? false;
    const excludeHigh    = cond.excludeHigh    ?? false;
    const excludeSpecial = cond.excludeSpecial ?? false;

    const availIngredients = Object.keys(masterIngredients).filter(k => {
        if((inventory[k]||0) <= 0) return false;
        if(excludeLocked  && lockedItems[k]) return false;
        const shop = masterIngredients[k].shop || 0;
        if(excludeMid     && shop === 1) return false;
        if(excludeHigh    && shop === 2) return false;
        if(excludeSpecial && shop < 0)  return false;
        return true;
    });
    const availSpices = Object.keys(masterSpices).filter(k => {
        if((inventory[k]||0) <= 0) return false;
        if(excludeLocked && lockedItems[k]) return false;
        const shop = masterSpices[k].shop || 0;
        if(excludeMid     && shop === 1) return false;
        if(excludeHigh    && shop === 2) return false;
        return true;
    });

    if(availIngredients.length === 0) { showCustomAlert('⚠️ 食材不足', '条件に合う食材の在庫がありません。'); return; }

    let picks = pickRecommendedIngredients(availIngredients, inventory, priorityStats);

    let bestSpice = '';
    if(availSpices.length > 0) {
        if(priorityStats.length > 0) {
            const match = availSpices.filter(k => priorityStats.includes(masterSpices[k].mul));
            bestSpice = match.length > 0
                ? match.sort((a,b) => masterSpices[b].val - masterSpices[a].val)[0]
                : availSpices[Math.floor(Math.random() * availSpices.length)];
        } else {
            bestSpice = availSpices[Math.floor(Math.random() * availSpices.length)];
        }
    }

    document.getElementById("ingredient1").value = picks[0] || "";
    document.getElementById("ingredient2").value = picks[1] || "";
    document.getElementById("ingredient3").value = picks[2] || "";
    document.getElementById("spice").value = bestSpice;
    [1,2,3].forEach(n => updateIngredientHint(n));
    updateSpiceHint();
    syncCookSelectionFromHiddenSelects();
}

function showIconSelectModal() {
    const allIcons = getUnlockedIcons();
    let gridHTML = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:4px;">';
    allIcons.forEach(icon => {
        const isSel = icon === currentIconFile;
        gridHTML += `<div onclick="selectPlayerIcon('${icon}')" style="cursor:pointer;text-align:center;padding:6px;border-radius:6px;border:2px solid ${isSel?'#b88742':'#e0d0b0'};background:${isSel?'#fff8ee':'transparent'};">
            <img src="${icon}" style="width:64px;height:64px;border-radius:4px;object-fit:cover;display:block;margin:0 auto;">
        </div>`;
    });
    // 実績10個達成で食材アイコンも選択肢に追加（サムネイル1個、タップで一覧へ）
    if(unlockedFoodIconFeature) {
        const isFoodSel = !ALL_ICON_LIST.includes(currentIconFile) && currentIconFile !== '' && isFoodIconPath(currentIconFile);
        const thumbIcon = isFoodSel ? currentIconFile : getAnyDiscoveredItemIcon();
        if(thumbIcon) {
            gridHTML += `<div onclick="showFoodIconSelectModal()" style="cursor:pointer;text-align:center;padding:6px;border-radius:6px;border:2px solid ${isFoodSel?'#b88742':'#e0d0b0'};background:${isFoodSel?'#fff8ee':'transparent'};">
                <img src="${thumbIcon}" style="width:64px;height:64px;border-radius:4px;object-fit:cover;display:block;margin:0 auto;">
                <div style="font-size:9px;color:#888;margin-top:2px;">食材から選ぶ</div>
            </div>`;
        }
    }
    gridHTML += '</div>';
    showCustomAlert('アイコン選択', gridHTML);
}

// ===== ベース・食器選択 =====
function updateTablewareBaseUI() {
    const bEl = document.getElementById('baseSelectLabel');
    const tEl = document.getElementById('tablewareSelectLabel');
    if (bEl) bEl.innerText = selectedBase;
    if (tEl) tEl.innerText = selectedTableware;
    // フェス：仲間パネルのベース/食器表示も同じ選択状態で更新（フェス外と共通の所有物・選択状態）
    const fbEl = document.getElementById('festBaseSelectLabel');
    const ftEl = document.getElementById('festTablewareSelectLabel');
    if (fbEl) fbEl.innerText = selectedBase;
    if (ftEl) ftEl.innerText = selectedTableware;
    if (typeof festActivePanel !== 'undefined' && festActivePanel === 'ally') renderFestAllyUI(); // ストックカレーのステータス表示（+/-）を再計算
}
function showBaseSelectModal() {
    const owned = getUnlockedBase();
    if (owned.length <= 1) {
        showCustomAlert('ベース', '今は「白米」しか持っていません。');
        return;
    }
    let html = '<div style="display:flex;flex-direction:column;gap:8px;">';
    owned.forEach(name => {
        const isSel = name === selectedBase;
        const info = BASE_LIST[name] || { desc: '' };
        html += `<div onclick="selectBase('${name}')" style="cursor:pointer;padding:10px;border-radius:6px;border:2px solid ${isSel?'#b88742':'#e0d0b0'};background:${isSel?'#fff8ee':'transparent'};text-align:left;">
            <div style="font-weight:bold;font-size:13px;color:#420000;">${name}${isSel?'（選択中）':''}</div>
            <div style="font-size:11px;color:#888;margin-top:2px;">${info.desc}</div>
        </div>`;
    });
    html += '</div>';
    showCustomAlert('ベースを選ぶ', html);
}
function selectBase(name) {
    if (!getUnlockedBase().includes(name)) return;
    selectedBase = name;
    document.getElementById('customModal').style.display = 'none';
    updateTablewareBaseUI();
    saveGame();
}
function showTablewareSelectModal() {
    const owned = getUnlockedTableware();
    if (owned.length <= 1) {
        showCustomAlert('食器', '今は「白い皿」しか持っていません。\nショップで他の食器を購入すると選べるようになります。');
        return;
    }
    let html = '<div style="display:flex;flex-direction:column;gap:8px;">';
    owned.forEach(name => {
        const isSel = name === selectedTableware;
        const info = TABLEWARE_LIST[name] || { desc: '' };
        html += `<div onclick="selectTableware('${name}')" style="cursor:pointer;padding:10px;border-radius:6px;border:2px solid ${isSel?'#b88742':'#e0d0b0'};background:${isSel?'#fff8ee':'transparent'};text-align:left;">
            <div style="font-weight:bold;font-size:13px;color:#420000;">${name}${isSel?'（選択中）':''}</div>
            <div style="font-size:11px;color:#888;margin-top:2px;">${info.desc}</div>
        </div>`;
    });
    html += '</div>';
    showCustomAlert('食器を選ぶ', html);
}
function selectTableware(name) {
    if (!getUnlockedTableware().includes(name)) return;
    selectedTableware = name;
    document.getElementById('customModal').style.display = 'none';
    updateTablewareBaseUI();
    saveGame();
}
// バトル用のカレーオブジェクトに食器補正を適用したコピーを返す（元のcurryStockオブジェクトは変更しない）
function applyTablewareModifiers(curry) {
    if (!curry) return curry;
    const info = TABLEWARE_LIST[selectedTableware];
    if (!info) return curry;
    const modified = Object.assign({}, curry);
    modified.hp  = Math.max(1, (modified.hp  || 0) + (info.hp  || 0));
    modified.atk = Math.max(0, (modified.atk || 0) + (info.atk || 0));
    modified.def = Math.max(0, (modified.def || 0) + (info.def || 0));
    modified.spd = Math.max(0, (modified.spd || 0) + (info.spd || 0));
    return modified;
}

// 食材・スパイスアイコンがプレイヤーアイコンとして使われているか判定
function isFoodIconPath(path) {
    if(!path) return false;
    const allFoodIcons = [...Object.values(masterIngredients), ...Object.values(masterSpices)].map(d => d.icon);
    return allFoodIcons.includes(path);
}

// 入手済みの食材・スパイスの中から1つアイコンパスを返す（サムネイル初期表示用）
function getAnyDiscoveredItemIcon() {
    const discoveredNames = Object.keys(discoveredItems).filter(k => discoveredItems[k]);
    for(const name of discoveredNames) {
        const data = masterIngredients[name] || masterSpices[name];
        if(data && data.icon) return data.icon;
    }
    return null;
}

// 入手済みの食材・スパイスアイコン一覧を表示し、選んでプレイヤーアイコンに設定する
function showFoodIconSelectModal() {
    const discoveredNames = Object.keys(discoveredItems).filter(k => discoveredItems[k]);
    if(discoveredNames.length === 0) {
        showCustomAlert('⚠️ まだありません', 'まだ入手済みの食材・スパイスがありません。');
        return;
    }
    let gridHTML = '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:4px;max-height:50vh;overflow-y:auto;">';
    discoveredNames.forEach(name => {
        const data = masterIngredients[name] || masterSpices[name];
        if(!data || !data.icon) return;
        const isSel = data.icon === currentIconFile;
        gridHTML += `<div onclick="selectFoodIconAsPlayerIcon('${data.icon}')" style="cursor:pointer;text-align:center;padding:4px;border-radius:6px;border:2px solid ${isSel?'#b88742':'#e0d0b0'};background:${isSel?'#fff8ee':'transparent'};">
            <img src="${data.icon}" style="width:36px;height:36px;object-fit:contain;display:block;margin:0 auto;">
        </div>`;
    });
    gridHTML += '</div>';
    showCustomAlert('食材・スパイスアイコンから選ぶ', gridHTML);
}

function selectFoodIconAsPlayerIcon(iconPath) {
    selectPlayerIcon(iconPath);
}

function selectPlayerIcon(icon) {
    currentIconFile = icon;
    const img = document.getElementById("playerIconImg");
    if(img) { img.src = icon; const gi = ALL_ICON_LIST.indexOf(icon)+1; img.setAttribute("data-index", gi > 0 ? gi : ''); }
    localStorage.setItem("selectedPlayerIcon", icon);
    saveGame();
    document.getElementById("customModal").style.display = "none";
}
function setupLoadedIconUI() {
    const img = document.getElementById("playerIconImg");
    // 解放済みに含まれているか確認（食材アイコンが選ばれている場合はそのまま許可）
    const unlocked = getUnlockedIcons();
    if (!unlocked.includes(currentIconFile) && !isFoodIconPath(currentIconFile)) {
        currentIconFile = unlocked[0];
        localStorage.setItem("selectedPlayerIcon", currentIconFile);
    }
    if(img && currentIconFile) {
        img.src = currentIconFile;
        const globalIdx = ALL_ICON_LIST.indexOf(currentIconFile) + 1;
        img.setAttribute("data-index", globalIdx > 0 ? globalIdx : 1);
    }
}
const firebaseConfig = {
    apiKey: "AIzaSyCEbiyOxye1Eo7gzyZBwGxEHcjPX5WommM",
    authDomain: "curry-battle.firebaseapp.com",
    databaseURL: "https://curry-battle-default-rtdb.firebaseio.com",
    projectId: "curry-battle",
    storageBucket: "curry-battle.firebasestorage.app",
    messagingSenderId: "14364879746",
    appId: "1:14364879746:web:b8ad99677e66027b013d9b"
};
let database = null;
if(firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    // App Check: このゲーム画面を経由しない外部スクリプト・API直叩きからの不正な書き込みを防ぐため、
    // reCAPTCHA v3による「正規のWebアプリからのリクエストか」の検証を有効化する。
    // ※ RECAPTCHA_V3_SITE_KEY は Firebase Console → Project Settings → App Check →
    //   「ウェブアプリを登録」→ プロバイダに reCAPTCHA v3 を選択すると発行されるサイトキーに置き換える。
    // ※ ここでサイトキーを設定するだけでは何も強制されない。Console側のApp Check設定で
    //   Realtime Databaseを「Enforce」にするまでは、監視（モニタリング）のみで動作は変わらない。
    if (typeof firebase.appCheck === 'function') {
        try {
            firebase.appCheck().activate('6LcGjE0tAAAAAKpaazekUnb-1SRjYY0cKJ4Aeg-3', true);
        } catch(e) { console.error('App Check activate failed:', e); }
    }
    database = firebase.database();
}

// ============================================================
// Firebase匿名認証（セキュリティルール強化対応）
// このブラウザ専用のUIDを発行し、players/{playerId}/uid にひも付けることで、
// 「自分のIDのデータは自分（このUID）だけが書き込める」というルールをサーバー側で強制できるようにする。
// ============================================================
let currentUid = null;
let _authReadyPromise = null;
// クラウド同期が使えない状態（認証失敗など）を、本人にその場で気づいてもらうための警告バナー。
// Firebaseへの書き込みは一切使わない（純粋なDOM操作のみ）ので、認証が失敗している状況でも必ず表示できる。
function showCloudSyncWarningBanner() {
    if (document.getElementById('cloudSyncWarningBanner')) return;
    try {
        const el = document.createElement('div');
        el.id = 'cloudSyncWarningBanner';
        el.className = 'fixedTopBanner';
        el.style.cssText = 'position:fixed;left:0;right:0;z-index:100000;background:#c0392b;color:#fff;font-size:12px;padding:8px 12px;text-align:center;line-height:1.6;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
        el.innerHTML = '⚠️ クラウド同期に接続できていません。進行状況が保存されない可能性があります。<br>アプリ内ブラウザ（LINE・Instagram等）やプライベートブラウズを使っている場合は、通常のブラウザで開き直してください。'
            + ' <span style="text-decoration:underline;cursor:pointer;font-weight:bold;" onclick="document.getElementById(\'cloudSyncWarningBanner\').style.display=\'none\';restackTopBanners();">✕閉じる</span>';
        document.body.insertBefore(el, document.body.firstChild);
        restackTopBanners();
    } catch(e) { /* noop */ }
}

// 画面上部に複数の固定バナー（クラウド同期警告・iframe埋め込み案内等）が同時に出ても
// 重ならないよう、表示中のものだけ上から順にtopをずらして積み重ねる。
function restackTopBanners() {
    try {
        let offset = 0;
        document.querySelectorAll('.fixedTopBanner').forEach(function(b) {
            if (b.style.display === 'none') return;
            b.style.top = offset + 'px';
            offset += b.offsetHeight;
        });
    } catch(e) { /* noop */ }
}

// このページが外部サイトにiframeで埋め込まれて開かれている場合、サードパーティiframe内では
// ブラウザのプライバシー保護機能によりFirebase認証の永続化が不安定になりやすく、
// クラウド同期が実質できないまま気づかれずに進行状況が消えるリスクがある。
// そのため、埋め込み表示を検知したら公式ページで開き直す導線を案内する（エラーではなく単なる案内として表示）。
function showIframeEmbedNotice() {
    if (window.self === window.top) return; // 通常表示（埋め込みでない）なら何もしない
    if (document.getElementById('iframeEmbedNotice')) return;
    try {
        const el = document.createElement('div');
        el.id = 'iframeEmbedNotice';
        el.className = 'fixedTopBanner';
        el.style.cssText = 'position:fixed;left:0;right:0;z-index:99999;background:#b88742;color:#fff;font-size:12px;padding:8px 12px;text-align:center;line-height:1.6;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
        // sandbox属性付きiframe（allow-popups・allow-top-navigation無し）だと、window.open()も
        // <a target="_blank">での遷移も一切ブロックされ、iframe内から新しいタブ・ウィンドウを
        // 開かせる手段がブラウザレベルで存在しないケースがある（PLiCyの埋め込みで実際に確認済み）。
        // その場合でもクリップボードへのコピーはナビゲーション扱いではないため通ることが多いので、
        // 「URLをコピーして自分でブラウザに貼り付けてもらう」ことを主導線にする。
        const officialUrl = location.href;
        el.innerHTML = '🔗 このページは埋め込み表示で開かれています。進行状況を確実に保存するには公式ページで開くのがおすすめです。'
            + ' <span id="iframeEmbedCopyBtn" style="text-decoration:underline;cursor:pointer;font-weight:bold;" onclick="copyOfficialUrlForIframe(\'' + officialUrl + '\', this)">URLをコピー</span>'
            + ' <span style="text-decoration:underline;cursor:pointer;font-weight:bold;margin-left:6px;" onclick="document.getElementById(\'iframeEmbedNotice\').style.display=\'none\';restackTopBanners();">✕閉じる</span>'
            + '<br><span style="font-size:10px;opacity:0.9;">コピーしたURLを、通常のブラウザ（Safari/Chrome等）のアドレス欄に貼り付けて開いてください</span>'
            + '<br><span id="iframeEmbedNoticeUrlText" style="font-size:10px;opacity:0.9;word-break:break-all;user-select:all;-webkit-user-select:all;">' + officialUrl + '</span>';
        document.body.insertBefore(el, document.body.firstChild);
        restackTopBanners();
    } catch(e) { /* noop */ }
}

// クリップボードへのコピーは「ページ遷移」ではないため、window.open()やaタグでの遷移が
// ブロックされるsandbox化iframe内でも動作することが多い。Clipboard APIが使えない・失敗する
// 環境向けに、古いexecCommand方式→それも失敗したらURLテキストを選択状態にする、の順にフォールバックする。
function copyOfficialUrlForIframe(url, btnEl) {
    function showCopied() {
        if (!btnEl) return;
        const orig = btnEl.innerText;
        btnEl.innerText = 'コピーしました！';
        setTimeout(function(){ btnEl.innerText = orig; }, 2500);
    }
    function selectUrlTextFallback() {
        try {
            const span = document.getElementById('iframeEmbedNoticeUrlText');
            if (span && window.getSelection) {
                const range = document.createRange();
                range.selectNodeContents(span);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        } catch(e) { /* noop */ }
    }
    function legacyCopyFallback() {
        try {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus(); ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            if (ok) showCopied(); else selectUrlTextFallback();
        } catch(e) { selectUrlTextFallback(); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(showCopied).catch(legacyCopyFallback);
    } else {
        legacyCopyFallback();
    }
}

function ensureFirebaseAuth() {
    if (_authReadyPromise) return _authReadyPromise;
    _authReadyPromise = new Promise(function(resolve) {
        if (!database || typeof firebase === 'undefined' || !firebase.auth) { resolve(null); return; }
        let resolved = false;
        firebase.auth().onAuthStateChanged(function(user) {
            if (user && !resolved) {
                resolved = true;
                currentUid = user.uid;
                resolve(currentUid);
            }
        });
        function trySignIn() {
            firebase.auth().signInAnonymously().catch(function(e) {
                if (!resolved) {
                    resolved = true;
                    if (typeof logSyncEvent === 'function') logSyncEvent('authSignInFailed', e && e.message);
                    resolve(null);
                }
            });
        }
        // SafariのプライベートブラウズやITP、一部のアプリ内ブラウザではIndexedDBによる認証状態の
        // 永続化（LOCAL）が失敗することがあり、その場合そのままだとsignInAnonymously自体が
        // 失敗・停止してしまうことがある。LOCALがダメならSESSION、それもダメならNONEの順に
        // フォールバックし、「その場のプレイでは最低限クラウド同期できる」状態を目指す。
        function fallbackPersistenceChain() {
            try {
                firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(trySignIn).catch(function() {
                    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION).then(trySignIn).catch(function() {
                        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.NONE).then(trySignIn).catch(trySignIn);
                    });
                });
            } catch(e) { trySignIn(); }
        }
        fallbackPersistenceChain();
        // 認証が長時間終わらない場合は諦めて先に進む（ゲーム進行自体を止めないための保険）
        setTimeout(function() {
            if (!resolved) {
                resolved = true;
                if (typeof logSyncEvent === 'function') logSyncEvent('authTimeout', '');
                resolve(null);
            }
        }, 8000);
    });
    return _authReadyPromise;
}
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration) {
    if(battleAborted || isMuted) return;
    try {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = type; osc.frequency.value = freq; osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}
// ===== BGM・特殊効果音管理 =====
let battleBGM = null;
function playBattleBGM(src) {
    if(isMuted) return;
    stopBattleBGM();
    battleBGM = new Audio(src);
    battleBGM.loop = true;
    battleBGM.volume = 0.2;
    battleBGM.play().catch(e => console.log("BGM play error:", e));
}
function stopBattleBGM() {
    if(battleBGM) { battleBGM.pause(); battleBGM.currentTime = 0; battleBGM = null; }
}
// Audio オブジェクトプール（大量生成によるブラウザ上限問題を防ぐ）
const _sePool = {};
const _SE_POOL_SIZE = 4; // 同じ音は最大4つまで同時再生

function playSoundEffect(src) {
    if(isMuted) return;
    if(!_sePool[src]) {
        _sePool[src] = { pool: [], idx: 0 };
        for(let i = 0; i < _SE_POOL_SIZE; i++) {
            const a = new Audio(src);
            a.volume = 0.7;
            _sePool[src].pool.push(a);
        }
    }
    const entry = _sePool[src];
    const se = entry.pool[entry.idx];
    entry.idx = (entry.idx + 1) % _SE_POOL_SIZE;
    se.currentTime = 0;
    se.volume = 0.7;
    se.play().catch(() => {});
}
// ===== ここまで =====
function playAttackSound() { playSoundEffect('punch.mp3'); }

// アイテム名からSVGアイコンHTMLを生成（サイズ指定可）
function itemIconHTML(name, size) {
    size = size || '28px';
    const data = masterIngredients[name] || masterSpices[name];
    if(data && data.icon) {
        return `<img src="${data.icon}" style="width:${size};height:${size};object-fit:contain;vertical-align:middle;" alt="${name}" title="${name}">`;
    }
    return `<span style="font-size:${size};" title="${name}">${data ? data.emoji : ''}</span>`;
}

// 食材リスト+スパイスからアイコン列を生成
function curryIconsHTML(materials, spice, size) {
    size = size || '24px';
    let html = '';
    if(Array.isArray(materials)) {
        materials.forEach(m => { if(m && m !== 'なし') html += itemIconHTML(m, size); });
    }
    if(spice) html += itemIconHTML(spice, size);
    return html;
}
function playStatusFlash(type) {
    // type: 'poison' or 'illusion'
    const el = document.getElementById('statusFlashOverlay');
    if(!el) return;
    el.className = 'status-flash-overlay ' + type + '-flash';
    el.style.transition = 'opacity 0.3s';
    el.style.opacity = '1';
    setTimeout(() => {
        el.style.opacity = '0.6';
        setTimeout(() => {
            el.style.opacity = '1';
            setTimeout(() => {
                el.style.opacity = '0';
                setTimeout(() => { el.className = 'status-flash-overlay'; }, 400);
            }, 400);
        }, 300);
    }, 500);
}
function playDamageSound() { playTone(100, 'sawtooth', 0.2); }
function playPoisonSound() { playTone(180, 'sine', 0.3); setTimeout(() => playTone(150, 'sine', 0.3), 100); }
function playWinSound() { playTone(523.25, 'square', 0.1); setTimeout(() => playTone(659.25, 'square', 0.1), 80); setTimeout(() => playTone(783.99, 'square', 0.8), 160); }
function playVsSound() { playTone(293.66, 'sawtooth', 0.15); setTimeout(() => playTone(220, 'sawtooth', 0.15), 150); setTimeout(() => playTone(440, 'sawtooth', 0.4), 300); }
function play開運Sound() { playTone(880, 'square', 0.1); setTimeout(() => playTone(1320, 'square', 0.1), 60); setTimeout(() => playTone(1760, 'square', 0.3), 120); }
function playGoldSound() { playTone(987.77, 'sine', 0.1); setTimeout(() => playTone(1318.51, 'sine', 0.1), 50); setTimeout(() => playTone(1975.53, 'sine', 0.4), 100); }
function playCriticalSound() { playTone(880, 'square', 0.1); setTimeout(() => playTone(1320, 'square', 0.1), 60); setTimeout(() => playTone(1760, 'square', 0.3), 120); }
// ===== Lv機能 =====
const MAX_LV = 10;
// 各レベルに上がるために必要な経験値（Lv1→2, Lv2→3, ... Lv9→10）
const LV_EXP_TABLE = { 2:50, 3:100, 4:100, 5:150, 6:150, 7:200, 8:200, 9:200, 10:200 };

// 累計EXPからレベルを算出するための累計テーブルを構築
function buildCumulativeExpTable() {
    const table = { 1: 0 };
    let cum = 0;
    for (let lv = 2; lv <= MAX_LV; lv++) {
        cum += LV_EXP_TABLE[lv];
        table[lv] = cum;
    }
    return table;
}
const CUM_EXP_TABLE = buildCumulativeExpTable();

function calcLv(exp) {
    let lv = 1;
    for (let l = MAX_LV; l >= 1; l--) {
        if (exp >= CUM_EXP_TABLE[l]) { lv = l; break; }
    }
    return Math.min(MAX_LV, lv);
}
function expForNextLv(exp) {
    const lv = calcLv(exp);
    if (lv >= MAX_LV) return null; // 上限
    const nextBorder = CUM_EXP_TABLE[lv + 1];
    return nextBorder - exp;
}
function expCurrentInLv(exp) {
    const lv = calcLv(exp);
    if (lv >= MAX_LV) return getLvExpNeed(MAX_LV);
    return exp - CUM_EXP_TABLE[lv];
}
function getLvExpNeed(lv) {
    // lvからlv+1に必要な経験値（表示用）。MAX_LVの場合は最後の必要値を返す
    if (lv >= MAX_LV) return LV_EXP_TABLE[MAX_LV] || 200;
    return LV_EXP_TABLE[lv + 1];
}
function updateLvDisplay() {
    const lv = calcLv(playerEXP);
    const inLvExp = expCurrentInLv(playerEXP);
    const need = getLvExpNeed(lv);
    const lvEl = document.getElementById("headerLv");
    const barEl = document.getElementById("headerEXPBar");
    if (lvEl) lvEl.innerText = `Lv.${lv}`;
    if (barEl) {
        if (lv >= MAX_LV) {
            barEl.innerText = `EXP:MAX`;
        } else {
            barEl.innerText = `EXP:${inLvExp}/${need}`;
        }
    }
}

// Lvごとの解放アイコン定義
const LV_UNLOCK_ICONS = { 2: "myimageicon/mayimage04.png", 3: "myimageicon/mayimage05.png", 4: "myimageicon/mayimage06.png", 7: "myimageicon/mayimage08.png", 9: "myimageicon/mayimage09.png" };

function getLvUpReward(lv) {
    if (lv === 5) return { type: 'stock', limit: 8 };
    if (lv === 10) return { type: 'stock', limit: 10 };
    if (lv >= 6 && lv <= 9) return { type: 'ticket' };
    if (lv >= 2 && lv <= 4) return { type: 'items' };
    return null;
}

function grantLvUpReward(lv) {
    const reward = getLvUpReward(lv);
    let resultLines = [];

    if (reward && reward.type === 'stock') {
        localStorage.setItem('qr_curry_stock_limit', String(reward.limit));
        resultLines.push(`🍛 カレーストック上限が<b>${reward.limit}個</b>に拡張されました！`);
    }
    if (reward && reward.type === 'ticket') {
        packTicket = (packTicket || 0) + 1;
        resultLines.push('🎟️ パック券を<b>1枚</b>入手しました！');
    }
    if (reward && reward.type === 'items') {
        const ingPool = Object.keys(masterIngredients).filter(k => !["金箔","赤パプリカ","黄パプリカ"].includes(k) && isIngredientAvailable(k));
        const spcPool = Object.keys(masterSpices).filter(k => k !== "マンゴーチャツネ" && k !== "サフラン" && isIngredientAvailable(k));
        const allPool = [...ingPool, ...spcPool];
        let picked = [];
        for (let i = 0; i < 5; i++) {
            const item = allPool[Math.floor(Math.random() * allPool.length)];
            picked.push(item);
            inventory[item] = (inventory[item] || 0) + 1;
            discoveredItems[item] = true;
        }
        const lines = picked.map(p => {
            const d = masterIngredients[p] || masterSpices[p];
            const ico = d && d.icon ? `<img src="${d.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">` : '';
            return `${ico} ${p}`;
        }).join('　');
        resultLines.push(`🎁 ランダム5種入手！<br><b>${lines}</b>`);
    }

    // アイコン解放チェック
    if (LV_UNLOCK_ICONS[lv]) {
        const unlocked = unlockIcon(LV_UNLOCK_ICONS[lv]);
        if (unlocked) {
            resultLines.push(`🖼️ プレイヤーアイコンが1つ解放されました！`);
            // 派手演出（レベルアップモーダルの後に表示）
            setTimeout(() => showIconGetOverlay(LV_UNLOCK_ICONS[lv], 'レベルアップ報酬'), 1500);
        }
    }

    return resultLines.join('<br>');
}

function checkLvUp(oldExp, newExp) {
    const oldLv = calcLv(oldExp);
    const newLv = calcLv(newExp);
    if (newLv > oldLv) {
        // レベルアップした！
        let rewardText = grantLvUpReward(newLv);
        saveGame(); updateFridgeUI(); updateCookSelects();
        const limitMsg = newLv >= MAX_LV ? '<br>🏆 <b>最大レベルに到達！</b>' : '';
        showCustomAlert(
            `🎉 LEVEL UP!! Lv.${newLv}`,
            `<div style="font-size:20px; color:#f1c40f; font-weight:bold; margin-bottom:8px;">★ Lv.${oldLv} → Lv.${newLv} ★</div>${rewardText}${limitMsg}`,
            null
        );
        playLvUpSound();
        return true;
    }
    return false;
}

function playLvUpSound() {
    playTone(523.25, 'square', 0.08);
    setTimeout(() => playTone(659.25, 'square', 0.08), 80);
    setTimeout(() => playTone(783.99, 'square', 0.08), 160);
    setTimeout(() => playTone(1046.50, 'square', 0.5), 240);
}

function getCurryStockLimit() {
    const saved = localStorage.getItem('qr_curry_stock_limit');
    if (saved) return parseInt(saved, 10);
    return calcLv(playerEXP) >= 5 ? 8 : 5;
}
// ===== Lv機能ここまで =====

function showCustomAlert(title, message, onOk, sellCallback, itemName) {
    document.getElementById("customModal").style.display = "none";
    document.getElementById("modalTitle").innerHTML = title;
    document.getElementById("modalMessage").innerHTML = message;
    const btnGroup = document.getElementById("modalBtnGroup");
    btnGroup.innerHTML = "";
    if(sellCallback && itemName && (inventory[itemName] > 0)) {
        const sellBtn = document.createElement("button");
        sellBtn.className = "modal-btn modal-btn-sell";
        const displayPrice = (typeof getSellPrice === 'function') ? getSellPrice(itemName) : 15;
        sellBtn.innerText = `💸 1個売却 (+${displayPrice}G)`;
        sellBtn.onclick = function() {
            document.getElementById("customModal").style.display = "none";
            sellCallback(itemName);
        };
        btnGroup.appendChild(sellBtn);
    }
    const okBtn = document.createElement("button");
    okBtn.className = "modal-btn modal-btn-ok";
    okBtn.innerText = "閉じる";
    okBtn.onclick = function() { document.getElementById("customModal").style.display = "none"; if(onOk) onOk(); };
    btnGroup.appendChild(okBtn);
    document.getElementById("customModal").style.display = "flex";
}
function showCustomConfirm(title, message, onConfirm, onCancel) {
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalMessage").innerHTML = message;
    const btnGroup = document.getElementById("modalBtnGroup");
    btnGroup.innerHTML = "";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "modal-btn modal-btn-cancel";
    cancelBtn.innerText = "キャンセル";
    cancelBtn.onclick = function() { document.getElementById("customModal").style.display = "none"; if(onCancel) onCancel(); };
    const okBtn = document.createElement("button");
    okBtn.className = "modal-btn modal-btn-ok";
    okBtn.innerText = "確定する";
    okBtn.onclick = function() { document.getElementById("customModal").style.display = "none"; if(onConfirm) onConfirm(); };
    btnGroup.appendChild(cancelBtn); btnGroup.appendChild(okBtn);
    document.getElementById("customModal").style.display = "flex";
}
const masterIngredients = {
    "牛肉": { hp: 120, atk: 40, def: 30, spd: 10, emoji: "🥩", icon: "foods_icon/item_04.svg", shop: 0, desc: "ジューシーで旨味あふれる高級なお肉。HPが大きく上昇する万能なメイン食材！" },
    "牛タン": { hp: 100, atk: 40, def: 55, spd: 15, emoji: "👅", icon: "foods_icon/item_05.svg", shop: 1, desc: "コリコリとした歯ごたえが自慢。肉の中でも抜群のDEFを誇る硬さが武器。" },
    "牛すじ": { hp: 150, atk: 20, def: 50, spd: 5, emoji: "🍢", icon: "foods_icon/item_06.svg", shop: 0, desc: "煮込むことでプルプルになる部位。圧倒的なDEFを誇る、耐久カレーの必須具材。" },
    "チキン": { hp: 90, atk: 45, def: 20, spd: 30, emoji: "🍗", icon: "foods_icon/item_07.svg", shop: 0, desc: "ヘルシーな鶏肉。SPDとATKが優秀。" },
    "唐揚げ": { hp: 80, atk: 60, def: 15, spd: 20, emoji: "💥", icon: "foods_icon/item_42.svg", shop: 0, desc: "カラッと揚がったお肉。最大のATK上昇量を誇る攻撃的具材！" },
    "トンカツ": { hp: 110, atk: 55, def: 35, spd: 10, emoji: "🐷", icon: "foods_icon/item_08.svg", shop: 0, desc: "サクサクの豚カツ。高い攻撃力と防御力を合わせ持つ。" },
    "ウインナー": { hp: 85, atk: 40, def: 25, spd: 25, emoji: "🌭", icon: "foods_icon/item_11.svg", shop: 0, desc: "パリッと弾けるジューシーなソーセージ。攻守のバランスが良い。" },
    "ナス": { hp: 55, atk: 15, def: 30, spd: 15, emoji: "🍆", icon: "foods_icon/item_09.svg", shop: 0, desc: "油とスパイスをよく吸う野菜。組み合わせ次第では『毒カレー』に変貌することも…？" },
    "トマト": { hp: 60, atk: 20, def: 15, spd: 20, emoji: "🍅", icon: "foods_icon/item_41.svg", shop: 0, desc: "爽やかな酸味を加える。程よいスピード感を生み出す。" },
    "レンコン": { hp: 45, atk: 20, def: 40, spd: 10, emoji: "🕸️", icon: "foods_icon/item_02.svg", shop: 0, desc: "シャキシャキした食感。DEFを補強してくれる。" },
    "ジャガイモ": { hp: 50, atk: 5, def: 20, spd: 2, emoji: "🥔", icon: "foods_icon/item_10.svg", shop: 0, desc: "ドロっとしたコクとHPを与えるが、重いのでSPDが落ちる。" },
    "ピーマン": { hp: 55, atk: 20, def: 25, spd: 20, emoji: "🫑", icon: "foods_icon/item_14.svg", shop: 0, desc: "ほろ苦い緑のピーマン。キレのあるスピードと平均的な守備力。" },
    "赤パプリカ": { hp: 65, atk: 35, def: 25, spd: 35, emoji: "🔴", icon: "foods_icon/item_15.svg", shop: -1, desc: "赤いQRからしか出現しない完熟パプリカ。攻撃力と素早さを誇る！" },
    "黄パプリカ": { hp: 85, atk: 25, def: 40, spd: 25, emoji: "🟡", icon: "foods_icon/item_16.svg", shop: -1, desc: "黄色いQRからしか出現しない完熟パプリカ。抜群のHPと防御力！" },
    "レーズン": { hp: 15, atk: 20, def: 5, spd: 25, emoji: "🍇", icon: "foods_icon/item_12.svg", shop: 0, desc: "甘酸っぱい隠し味。高いスピードをもたらすが耐久は低い。" },
    "玉ねぎ": { hp: 60, atk: 20, def: 20, spd: 20, emoji: "🧅", icon: "foods_icon/item_13.svg", shop: 0, desc: "すべてのステータスを等しく成長させる。" },
    "にんじん": { hp: 55, atk: 8, def: 18, spd: 8, emoji: "🥕", icon: "foods_icon/item_18.svg", shop: 0, desc: "カレーにまろやかな耐久力をもたらす。" },
    "サバ": { hp: 70, atk: 35, def: 15, spd: 55, emoji: "🐟", icon: "foods_icon/item_33.svg", shop: 0, desc: "群れで素早く泳ぐ回遊魚。抜群のSPDを誇る食材。" },
    "オクラ": { hp: 65, atk: 25, def: 35, spd: 25, emoji: "🫛", icon: "foods_icon/item_01.svg", shop: 0, desc: "刻むことで粘り気が出る野菜。DEFを高める盾となる。" },
    "大根": { hp: 70, atk: 10, def: 35, spd: 5, emoji: "🫚", icon: "foods_icon/item_17.svg", shop: 0, desc: "味が染み込む和の食材。HPの底上げと防衛能力。" },
    "マッシュルーム": { hp: 55, atk: 30, def: 15, spd: 25, emoji: "🍄", icon: "foods_icon/item_22.svg", shop: 0, desc: "帝国を脅かす幻のキノコ。攻撃と素早さが伸びる。" },
    "ひよこ豆": { hp: 75, atk: 20, def: 30, spd: 15, emoji: "🫘", icon: "foods_icon/item_21.svg", shop: 0, desc: "地味ながらカレーに安定した硬さを提供する。" },
    "金箔": { hp: 100, atk: 50, def: 50, spd: 50, emoji: "✨", icon: "foods_icon/item_39.svg", shop: -2, desc: "マハラジャに勝利した者のみが手にできる伝説の超アイテム。" },
    "チーズ": { hp: 70, atk: 20, def: 30, spd: 10, emoji: "🧀", icon: "foods_icon/item_23.svg", shop: 0, desc: "濃厚なコクがカレーに深みをもたらす。HPとDEFを底上げする安定食材。" },
    "イカ": { hp: 45, atk: 40, def: 10, spd: 55, emoji: "🦑", icon: "foods_icon/item_19.svg", shop: 0, desc: "軟体で俊敏な動き。SPDに優れた海の食材。" },
    "小エビ": { hp: 35, atk: 30, def: 10, spd: 60, emoji: "🦐", icon: "foods_icon/item_20.svg", shop: 0, desc: "小ぶりで軽く、跳ねるように素早い。海鮮の中でも最速の食材。" },
    "ホタテ": { hp: 100, atk: 35, def: 55, spd: 20, emoji: "🫧", icon: "foods_icon/item_36.svg", shop: 1, desc: "甘みと旨味が抜群の貝柱。殻に守られた高いHPとDEFが自慢の中級食材。" },
    "ツナ": { hp: 60, atk: 30, def: 15, spd: 55, emoji: "🐠", icon: "foods_icon/item_24.svg", shop: 0, desc: "缶詰でもしっかりコクが出る万能食材。回遊魚らしい優れたSPDを持つ。" },
    // ===== レア食材（QRスキャン低確率入手） =====
    "フルーツトマト":     { hp: 80, atk: 26, def: 20, spd: 8,  emoji: "🍅", icon: "foods_icon/item_54.svg", shop: -3, desc: "完熟トマトの上位品種。旨みが凝縮されたプレミアム食材。" },
    "メークイン":         { hp: 70, atk: 15, def: 35, spd: 3,  emoji: "🥔", icon: "foods_icon/item_55.svg", shop: -3, desc: "滑らかな食感の高品質じゃがいも。煮崩れしにくく濃厚な味わい。" },
    "金時にんじん":       { hp: 75, atk: 10, def: 25, spd: 40, emoji: "🥕", icon: "foods_icon/item_56.svg", shop: -3, desc: "鮮やかな赤みと甘みが特徴の希少品種。素早さを大幅に高める。" },
    "聖護院大根":         { hp: 95, atk: 13, def: 48, spd: 25, emoji: "🫚", icon: "foods_icon/item_57.svg", shop: -3, desc: "京都が誇る丸大根の最高品種。驚異の防御力と高いHPを誇る。" },
    "シャインマスカット": { hp: 45, atk: 50, def: 7,  spd: 38, emoji: "🍇", icon: "foods_icon/item_58.svg", shop: -3, desc: "種なし皮ごと食べられる幻のぶどう。攻撃力と速度が大幅に跳ね上がる。" },
    "新玉ねぎ":           { hp: 80, atk: 32, def: 32, spd: 32, emoji: "🧅", icon: "foods_icon/item_59.svg", shop: -3, desc: "みずみずしい春限定の玉ねぎ。全ステータスが均衡よく大幅アップ。" },
    "クルマエビ":         { hp: 48, atk: 40, def: 40, spd: 80, emoji: "🦐", icon: "foods_icon/item_60.svg", shop: -3, desc: "高級エビの代名詞。弾丸のような速度と堅固な守りを兼ね備える。" },
    "本マグロ":           { hp: 90, atk: 45, def: 20, spd: 65, emoji: "🐠", icon: "foods_icon/item_61.svg", shop: -3, desc: "クロマグロの最高峰。圧倒的な攻撃力とHPを兼ね備える最高級食材。" },
    "合鴨": { hp: 105, atk: 62, def: 38, spd: 25, emoji: "🦆", icon: "foods_icon/item_40.svg", shop: 1, desc: "上品な脂とコクを持つ鴨肉。あらゆるステータスを高水準で兼ね備える中級肉食材の傑作。" },
    "牡蠣": { hp: 110, atk: 25, def: 70, spd: 15, emoji: "🦪", icon: "foods_icon/item_38.svg", shop: 1, desc: "海のミルクと称される濃厚な旨味。殻のように固く、HPとDEFを強化する守備型食材。" },
    "キャビア": { hp: 50, atk: 90, def: 15, spd: 45, emoji: "🫀", icon: "foods_icon/item_30.svg", shop: 2, desc: "世界三大珍味、最高級の魚卵。凝縮された旨味が圧倒的なATKに変わる、超攻撃型の最高級食材。" },
    "オマール海老": { hp: 95, atk: 55, def: 70, spd: 25, emoji: "🦞", icon: "foods_icon/item_28.svg", shop: 2, desc: "王者の風格を持つ海老の王様。硬い殻に守られたDEFと、王者にふさわしいATKを兼ね備える。" },
    "ズワイガニ": { hp: 110, atk: 30, def: 80, spd: 15, emoji: "🦀", icon: "foods_icon/item_27.svg", shop: 2, desc: "甲殻の王。硬い殻に身を包んだ、圧倒的なDEFを誇る最強の盾食材。" },
    "タマゴ": { hp: 65, atk: 20, def: 15, spd: 15, emoji: "🥚", icon: "foods_icon/item_43.svg", shop: 0, desc: "レンチン玉子撃破で解放された食材。優しい味でバランスの良い具材。" },
    "うずら卵": { hp: 35, atk: 10, def: 10, spd: 40, emoji: "🐣", icon: "foods_icon/item_44.svg", shop: 0, desc: "レンチン玉子撃破で解放された食材。小さくて軽く、すばしっこい一品。" },
    "りんご": { hp: 55, atk: 15, def: 20, spd: 30, emoji: "🍎", icon: "foods_icon/item_45.svg", shop: 0, desc: "カレー天使ぴゃぁ撃破で解放された食材。甘酸っぱい爽やかな具材。" },
    "バナナ": { hp: 50, atk: 15, def: 30, spd: 30, emoji: "🍌", icon: "foods_icon/item_46.svg", shop: 0, desc: "カレー天使ぴゃぁ撃破で解放された食材。優しい甘さでDEFも頼れる一品。" },
    "ハラペーニョ": { hp: 45, atk: 55, def: 15, spd: 25, emoji: "🌶️", icon: "foods_icon/item_47.svg", shop: 0, desc: "悪ガキサタン君撃破で解放された食材。刺激的な辛さで一点突破のATK特化。" },
    "パクチー": { hp: 35, atk: 45, def: 15, spd: 30, emoji: "🌿", icon: "foods_icon/item_48.svg", shop: 0, desc: "悪ガキサタン君撃破で解放された食材。クセが強く好みが分かれる俊敏な香草。" },
    "フォアグラ": { hp: 100, atk: 75, def: 40, spd: 20, emoji: "🍖", icon: "foods_icon/item_49.svg", shop: 2, desc: "世界三大珍味の一つ。濃厚でリッチな味わいが、高いHPとATKに変わる。" },
    "トリュフ": { hp: 65, atk: 80, def: 35, spd: 50, emoji: "🍄‍🟫", icon: "foods_icon/item_50.svg", shop: 2, desc: "世界三大珍味の一つ。少量でも圧倒的な香りを放つ、ATK特化の高級食材。" },
    "ココナッツ": { hp: 90, atk: 35, def: 45, spd: 35, emoji: "🥥", icon: "foods_icon/item_51.svg", shop: 1, desc: "南国育ちのトロピカルな実。バランスの良いステータスを持つ中級食材。" },
    "アスパラガス": { hp: 70, atk: 45, def: 35, spd: 45, emoji: "🥒", icon: "foods_icon/item_52.svg", shop: 1, desc: "すっと伸びるシャキシャキの食感。バットのような形でホームランにも一役買う。" }
};
const masterSpices = {
    "ターメリック":     { mul: "hp",  val: 1.3, name: "黄金の",   emoji: "💛", icon: "foods_icon/item_03.svg", shop: 0, desc: "カレーの黄色を決定づける。HPを1.3倍にする！" },
    "クミン":           { mul: "def", val: 1.4, name: "薫る",     emoji: "🤎", icon: "foods_icon/item_31.svg", shop: 0, desc: "芳香を放ち、全体のDEFを1.4倍に跳ね上げる。" },
    "コリアンダー":     { mul: "hp",  val: 1.2, name: "爽やか緑の", emoji: "💚", icon: "foods_icon/item_25.svg", shop: 0, desc: "爽やかな風味を持ち、HPを1.2倍にする。" },
    "カルダモン":       { mul: "spd", val: 1.5, name: "気高き",   emoji: "🌱", icon: "foods_icon/item_29.svg", shop: 0, desc: "スパイスの女王。SPDを1.5倍にする大人気種。" },
    "シナモン":         { mul: "spd", val: 1.3, name: "甘美な",   emoji: "🪵", icon: "foods_icon/item_26.svg", shop: 0, desc: "甘くエキゾチックな香りの樹皮。SPDを1.3倍にする。" },
    "クローブ":         { mul: "def", val: 1.3, name: "深遠なる", emoji: "📌", icon: "foods_icon/item_32.svg", shop: 0, desc: "しびれるような刺激的な香り。DEFを1.3倍にする！" },
    "ブラックペッパー": { mul: "atk", val: 1.3, name: "刺激の",   emoji: "🖤", icon: "foods_icon/item_35.svg", shop: 0, desc: "シャープな辛味がATKを1.3倍にする。" },
    "チリパウダー":     { mul: "atk", val: 1.3, name: "爆炎の",   emoji: "❤️", icon: "foods_icon/item_34.svg", shop: 0, desc: "燃え盛るような激辛スパイス。ATKを1.3倍に！" },
    "サフラン":         { mul: "atk", val: 1.2, mul2: "spd", val2: 1.3, name: "黄金香る", emoji: "🌼", icon: "foods_icon/item_53.svg", shop: 1, desc: "世界最高額のスパイス。ATKを1.2倍、SPDを1.3倍に引き上げる、珍しい二重効果！" },
    "マンゴーチャツネ": { mul: "hp",  val: 1.5, name: "甘熟の",   emoji: "🥭", icon: "foods_icon/item_37.svg", shop: 2, desc: "甘くトロピカルなインド伝来の秘伝ソース。HPを驚異の1.5倍に引き上げる！" }
};
// 大富豪マハラジャ：戦闘開始時に5段階の強さから均等な確率(各20%)でランダム抽選される（見た目は固定）
// Lv1=魔術師レオン相当(最弱) 〜 Lv5=宮廷カレー長を上回る(最強)
const MAHARAJA_LEVELS = [
    { hp: 180, atk: 65, def: 15, spd: 35 },
    { hp: 222, atk: 71, def: 26, spd: 36 },
    { hp: 265, atk: 78, def: 38, spd: 38 },
    { hp: 308, atk: 84, def: 49, spd: 39 },
    { hp: 376, atk: 94, def: 67, spd: 41 },
];
function rollMaharajaStats() {
    const idx = Math.floor(Math.random() * MAHARAJA_LEVELS.length);
    // レベル(1〜5)も一緒に返す。撃破時の報酬（金箔の個数・G）をレベル別に出し分けるため。
    return Object.assign({ level: idx + 1 }, MAHARAJA_LEVELS[idx]);
}
// 大富豪マハラジャ撃破時の報酬（レベル別）
const MAHARAJA_REWARDS = {
    1: { gold: 1, g: 100 },
    2: { gold: 1, g: 150 },
    3: { gold: 1, g: 200 },
    4: { gold: 2, g: 200 },
    5: { gold: 2, g: 300 },
};
const botOpponents = [
    { name: "見習い料理人タカシ", curryName: "ベジマイルドカレー", emoji: "🥦🥔🥕", image: "botimage/bot01.png", hp: 130, atk: 25, def: 20, spd: 15, expBonus: 5, foodCategory: "vegetable" },
    { name: "魔術師レオン", curryName: "爆炎のW唐揚げ激辛", emoji: "💥💥❤️", image: "botimage/bot02.png", hp: 180, atk: 65, def: 15, spd: 35, expBonus: 10, foodCategory: "meat" },
    { name: "ガンコ親父", curryName: "極厚トンカツ重量級", emoji: "🐷🥩🧅", image: "botimage/bot03.png", hp: 280, atk: 55, def: 45, spd: 5, expBonus: 15, foodCategory: "meat" },
    { name: "宮廷カレー長", curryName: "至高 of シーフード贅沢", emoji: "🐟✨🐚", image: "botimage/bot04.png", hp: 350, atk: 90, def: 60, spd: 40, expBonus: 20, foodCategory: "seafood" }
];
const hardBotOpponents = [
    { name: "イカ星人グニョグニョ", curryName: "イカスミ幻惑カレー", emoji: "🌀🦑🌀", image: "botimage/bot06.png", hp: 250, atk: 95, def: 50, spd: 60, expBonus: 25, specialEffect: "illusion", foodCategory: "seafood" },
    { name: "種まき婆ちゃん", curryName: "懐かしの豆蟹カレー", emoji: "🌱🫘🦀", image: "botimage/bot07.png", hp: 250, atk: 80, def: 140, spd: 15, expBonus: 25, specialEffect: "seed", foodCategory: "seafood" },
    { name: "毒舌料理人ミスズ", curryName: "激辛毒毒カレー", emoji: "☠️🌶️☠️", image: "botimage/bot09.png", hp: 360, atk: 90, def: 65, spd: 35, expBonus: 30, specialEffect: "poison", foodCategory: null },
    { name: "ドラゴン料理長", curryName: "炎獄ドラゴンカレー", emoji: "🐲🐉🔥", image: "botimage/bot08.png", hp: 400, atk: 100, def: 60, spd: 20, expBonus: 30, specialEffect: "breath", foodCategory: "meat" }
];
// タッグ戦専用の新規Bot3体
const tagBattleExtraBots = [
    { name: "カレー天使ぴゃぁ", curryName: "甘口お子様カレー", emoji: "✨💖✨", image: "botimage/bot10.png", hp: 210, atk: 50, def: 40, spd: 75, expBonus: 20, specialEffect: "angel", foodCategory: "fruit" },
    { name: "悪ガキサタン君", curryName: "いたずらカレー", emoji: "✨👿✨", image: "botimage/bot11.png", hp: 320, atk: 110, def: 55, spd: 45, expBonus: 20, specialEffect: "brat", isWanpaku: true, isHomerun: true, foodCategory: "meat" },
    { name: "レンチン玉子", curryName: "ゆで玉子カレー〜この熱さ君に届け〜", emoji: "🔥🥚🔥", image: "botimage/bot12.png", hp: 280, atk: 30, def: 130, spd: 10, expBonus: 20, specialEffect: "chin", foodCategory: null }
];
// タッグ戦の敵候補（既存8体＋新規2体、マハラジャは除外）
const tagBattleBotPool = [...botOpponents, ...hardBotOpponents, ...tagBattleExtraBots];
let inventory = {}; let scanHistory = {};
let playerG = 0; let playerEXP = 0; let packTicket = 0; let spicyCoin = 0;

// ===== バトルカレーフェス 専用state（Phase1：データ基盤） =====
// フェス中のみ使う専用の所持食材・スパイス・ストックカレーは、通常プレイの冷蔵庫/ストックとは完全に別管理。
// ビンゴ・図鑑（discoveredItems）・実績の集計対象には一切含めない。
const FEST_ENTRY_FEE = 600; // フェス参加費（G）
let festActive = false;          // フェス進行中フラグ
let festFP = 0;                  // フェス専用通貨
let festInventory = {};          // フェス専用食材 { 食材名: 個数 }
let festSpiceInventory = {};     // フェス専用スパイス { スパイス名: 個数 }
let festCurryStock = [];         // フェス専用ストックカレー
let festExpSpice = 0;            // 経験スパイス所持数
let festHealSpice = 0;           // 回復スパイス所持数
let festSpicySpice = 0;          // 辛味スパイス所持数
let festWinStreak = 0;           // 連勝数（フェス開始からの通算勝利数）
let festSetIndex = 1;            // 現在のセット番号（1開始。敵強化倍率 = 1 + 0.10×(N-1) の元になる）
let festHiredAllyName = null;    // 現在雇用中の仲間bot名（未雇用はnull）
let festAllyHp = null;           // 雇用中の仲間の現在HP（戦闘をまたいで持ち越し。フェス再開始時に全回復）
let festHireCandidates = [];     // 今回のフェスで雇用可能な仲間候補（討伐済みのbotから抽選で3体。フェス開始時に確定）
let festGlobalMaxStreak = 0;     // 全プレイヤーを通じた最高連勝記録のローカルキャッシュ（Firebase festGlobalRecord/maxStreakを表示用に保持）

// ===== Phase3：フェス対戦ループ用state =====
let festBattlePhase = 1;         // 現在セット内の進行度（1〜3=雑魚戦、4=ボス戦）
let festActiveCurryIdx = -1;     // 現在出撃中のストックカレーのインデックス（-1=未出撃）
let festAccumulatedReward = 0;   // 勝利のたびに積み上がるG報酬（敗北・撤退時にまとめてplayerGへ付与）
let festBattleEnemies = [];      // 現在の戦闘の敵配列（各要素にcurHp/maxHp/atk/def/spd/level/statusAtkDown等を持たせる）
let festMatchNeedsReroll = true; // trueの間だけopenFestMatchModal()で対戦相手を再抽選する（×で閉じて開き直しただけでは再抽選しない）
let festSpicyBuffActive = false; // 辛味スパイス使用中フラグ（次の戦闘1回のみ味方ATK+40、重複不可）
let festBattleTurnCount = 0;     // 現在の戦闘のターン数（ボス「総帥の一撃」の3ターンごと発動判定に使用）
let festBattleInProgress = false;// 戦闘画面表示中フラグ（trueの間はナビ操作を封じる）
// festPlayerAtkDownActive/festAllyAtkDownActiveは、duration未設定の「戦闘中ずっと効く」永続ATKダウン技用の予備フラグ
// （現状「のほほんオーラ」「減点だ！」はどちらもduration:5の時限式に統一済みのため、今のところ使用されていない）。
let festPlayerAtkDownActive = false;
let festAllyAtkDownActive = false;
let festPlayerAtkDownTurns = 0;      // 「のほほんオーラ」「減点だ！」等、時限式ATKダウンの残りターン数（0=効果なし。再発動で5にリセット＝重ねがけで延長しない）
let festAllyAtkDownTurns = 0;        // 同上、仲間側
let festAllySkillUsedThisBattle = {}; // 「1バトル1回のみ」系の仲間特技（タカシ「栄養満点ベジスープ」等）の使用済みフラグ。キー：仲間名。戦闘開始時にリセット
let festPlayerPoisoned = false;      // 「焦げ跡の術」でカレー側が毒状態か（戦闘またぎでは持続しない）
let festAllyPoisoned = false;        // 同上、仲間側
let festCurrySeaHealUsed = false;    // 海鮮カレー（isSeafood）の1回きり自動回復を使用済みか（戦闘開始時にリセット）
let festCurryFluffyCategory = null;  // ふわとろオム／世界三大珍味（isFluffyOmelette・isTriCaviar）の軽減対象系統（meat/seafood/vegetable/fruit）。戦闘開始時に抽選、持っていなければnull
// 🥚ふわとろオム／👑世界三大珍味：フェス戦用の系統ラベル定義（タッグ戦のFLUFFY_CATEGORY_LABEL_Tと同内容）
const FEST_FLUFFY_CATEGORY_LABEL = { meat: '肉系', seafood: '海鮮系', vegetable: '野菜系', fruit: '果実系' };
const FEST_FLUFFY_CATEGORY_KEYS = Object.keys(FEST_FLUFFY_CATEGORY_LABEL);
// ふわとろバリアの演出（効果音は呼び出し側で再生済み、ここではリング演出のみ）。タッグ戦のtriggerTagFluffyBarrierEffectと同じ仕組み
function triggerFestFluffyBarrierEffect(side, idx) {
    const zone = document.getElementById((side === 'enemy' ? 'festEnemyCard' : 'festPlayerCard') + idx);
    if(!zone) return;
    const barrier = document.createElement('div');
    barrier.className = 'fluffy-barrier-ring';
    zone.style.position = zone.style.position || 'relative';
    zone.appendChild(barrier);
    setTimeout(function() { if(barrier.parentNode) barrier.parentNode.removeChild(barrier); }, 900);
}
let festPlayerIlluded = false;       // 「墨吐き幻惑」でカレー側が幻惑状態か（戦闘またぎでは持続しない）
let festAllyIlluded = false;         // 同上、仲間側

// 仲間bot定義（雇用費・基本ステータス・初期レベル）。初期レベルは、タカシの成長曲線
// 合計=190+10×(Lv-1) に各botの基本合計ステータスを当てはめて算出したもの（設計書2-4参照）。
// specialEffect：PCと対戦（初級・中級）の同名Botと同じ特技をそのまま流用（無印はPC戦でも特技なし）
// 各初期レベルは指定値に変更。ステータスは「そのキャラを旧初期レベルまで上げると旧ステータスに一致する」よう逆算して調整済み
// foodCategoryはPC対戦の同名Bot定義（botOpponents/hardBotOpponents）の値をそのまま踏襲（見習い=vegetable, レオン/ガンコ/ドラゴン=meat, 宮廷/イカ/婆ちゃん=seafood, ミスズ=なし）
// skill：レベルアップで覚える特技（levelReq以上で発動抽選の対象になる。既存プレイヤーで既にlevelReq以上の人は
// 保存済みレベルから毎回判定するため、追加対応なしでそのまま「習得済み」になる）。演出画像はbattle/配下に
// ユーザー側で用意予定（未配置の間は壊れた画像表示のままでOK）。
const FEST_ALLY_DEFS = [
    { name:'見習い料理人タカシ',     cost:3,  hp:130, atk:25,  def:20,  spd:15, initLevel:1,  image:'botimage/bot01.png', foodCategory:'vegetable',
      skill:{ name:'栄養満点ベジスープ', levelReq:10, chance:0.50, type:'healLowestHp', once:true, sound:'healing.mp3', animImg:'battle/bt_takashi.png',
        desc:'自分or味方でHPが少ない方の最大HPの20%+100回復（HPが75%以下のキャラがいる時のみ発動抽選・1バトル1回のみ）' } },
    { name:'魔術師レオン',           cost:10, hp:137, atk:50,  def:11,  spd:27, initLevel:5,  image:'botimage/bot02.png', foodCategory:'meat',
      skill:{ name:'念力ボール', levelReq:10, chance:0.25, type:'fixedDamage', value:80, sound:'breath.mp3', animImg:'battle/bt_reon.png',
        desc:'固定80ダメージ（DEF・ATKダウンの影響を受けない）' } },
    { name:'ガンコ親父',             cost:15, hp:164, atk:32,  def:26,  spd:3,  initLevel:5,  image:'botimage/bot03.png', foodCategory:'meat',
      skill:{ name:'頑固割り拳', levelReq:10, chance:0.25, type:'attackPlusDefDown', defDownPct:0.30, maxStacks:2, duration:5, sound:'sound/gankowari.mp3', animImg:'battle/bt_ganko.png',
        desc:'通常攻撃+DEF30%ダウン（2回まで重ねがけで最大60%ダウン・効果は5ターン）' } },
    { name:'宮廷カレー長',           cost:20, hp:181, atk:47,  def:31,  spd:21, initLevel:10, image:'botimage/bot04.png', foodCategory:'seafood',
      skill:{ name:'宮廷流水花麗', levelReq:15, chance:0.20, type:'halfDamageSkipTurn', sound:'sound/ryusuikarei.mp3', animImg:'battle/bt_kyutei.png',
        desc:'ダメージ0.5倍+ダメージを受けた敵は次の行動を1回休み' } },
    { name:'イカ星人グニョグニョ',   cost:30, hp:179, atk:68,  def:36,  spd:43, initLevel:15, image:'botimage/bot06.png', specialEffect:'illusion', foodCategory:'seafood' },
    { name:'種まき婆ちゃん',         cost:30, hp:168, atk:54,  def:94,  spd:10, initLevel:15, image:'botimage/bot07.png', specialEffect:'seed', foodCategory:'seafood' },
    { name:'ドラゴン料理長',         cost:40, hp:262, atk:66,  def:39,  spd:13, initLevel:20, image:'botimage/bot08.png', specialEffect:'breath', foodCategory:'meat' },
    { name:'毒舌料理人ミスズ',       cost:40, hp:249, atk:62,  def:45,  spd:24, initLevel:20, image:'botimage/bot09.png', specialEffect:'poison', foodCategory:null },
];

// フェス専用の敵キャラ（設計書3-3の弱体化版数値）。既存タッグ戦のBotは使い回さない。
// ★画像はfest/配下にユーザー側で用意予定（未配置の間は壊れた画像表示のままでOK）。
// skill: レベル(=セット番号)がlevelReq以上で発動抽選の対象になる簡易スキル（設計書3-4）。
// curryName：フェス外・タッグ戦のbotOpponents同様に敵ごとのカレー名。curryIcon：食材アイコン画像（スパイスは使わず、masterIngredientsの具材アイコンから選定）。
// そのアイコンの食材が属する系統（INGREDIENT_CATEGORY）を、そのままcategoryフィールドとして設定し、ふわとろバリア・ラタトゥイユ等の属性判定に実際に使用する。
const FEST_ZAKO_DEFS = [
    { name:'見習いカレー忍者',   hp:113, atk:30, def:19, spd:34, image:'botimage/bot13.png', category:'vegetable',
      curryName:'忍者秘伝の毒ナスカレー', curryIcon:'foods_icon/item_09.svg',
      skill:{ name:'焦げ跡の術', levelReq:3, chance:0.25, type:'poison', desc:'25%で相手を毒状態にする' } },
    { name:'カレー番犬モグ',     hp:165, atk:38, def:45, spd:15, image:'botimage/bot14.png', category:'meat',
      curryName:'番犬のガブッと唐揚げカレー', curryIcon:'foods_icon/item_42.svg',
      skill:{ name:'がぶ噛み', levelReq:3, chance:0.20, type:'doubleDamage', desc:'20%でダメージ2倍' } },
    { name:'屋台のカレー精霊',   hp:120, atk:45, def:15, spd:38, image:'botimage/bot15.png', category:'meat',
      curryName:'屋台のウインナーカレー', curryIcon:'foods_icon/item_11.svg',
      skill:{ name:'連続突撃', levelReq:3, chance:0.20, type:'extraTurn', desc:'20%でもう一度攻撃' } },
    { name:'ずんぐりスパイス樽', hp:135, atk:34, def:30, spd:26, image:'botimage/bot16.png',
      curryName:'大樽のハラペーニョ爆弾カレー', curryIcon:'foods_icon/item_47.svg', // ハラペーニョはINGREDIENT_CATEGORY未該当のため、この敵は「その他系」（category未設定）のまま
      skill:{ name:'スパイス爆発', levelReq:3, chance:0.20, type:'bonusDamage', desc:'20%でダメージ1.5倍' } },
    { name:'韋駄天ライスくん',   hp:105, atk:26, def:23, spd:41, image:'botimage/bot17.png', category:'vegetable',
      curryName:'韋駄天にんじんカレー', curryIcon:'foods_icon/item_18.svg',
      skill:{ name:'目にも止まらぬ', levelReq:3, chance:1.0, type:'critUp', desc:'常時会心率+15%' } },
    // 追加雑魚敵3種（ユーザー承認済み）。画像はbotimage/bot21〜23.png・演出はbattle/bt-bot21〜23.png想定（未配置の間は壊れた画像表示のままでOK）
    { name:'げそまきタコ助',     hp:118, atk:33, def:20, spd:36, image:'botimage/bot21.png', category:'seafood',
      curryName:'たっぷり隅々墨々黒カレー', curryIcon:'foods_icon/item_19.svg',
      skill:{ name:'墨吐き幻惑', levelReq:3, chance:0.25, type:'illusion', desc:'25%で相手を幻惑状態にする（攻撃をたまに外すようになる）' } },
    { name:'陽だまり野菜のご隠居', hp:195, atk:22, def:52, spd:11, image:'botimage/bot22.png', category:'vegetable', meatResistant:true,
      curryName:'縁側でぽかぽか大根カレー', curryIcon:'foods_icon/item_17.svg',
      skill:{ name:'のほほんオーラ', levelReq:3, chance:0.25, type:'atkDown', duration:5, desc:'25%で相手のATKを5ターンダウンさせる（重ねがけしても5ターンにリセットされるのみ）' } },
    { name:'種吹きメロンボーイ', hp:110, atk:28, def:18, spd:33, image:'botimage/bot23.png', category:'fruit',
      curryName:'たねとばしメロンカレー', curryIcon:'foods_icon/item_12.svg', // 果物系ながらメロン食材が存在しないため、種を連想させるレーズンを採用
      skill:{ name:'種連続発射', levelReq:3, chance:0.25, type:'seedAttack', desc:'25%で種を連続発射する（多段攻撃）' } },
];
const FEST_BOSS_DEFS = [
    { name:'カレー審査員長ジャッジ', hp:248, atk:44, def:39, spd:17, image:'botimage/bot18.png', category:'seafood',
      curryName:'審査員厳選キャビアカレー', curryIcon:'foods_icon/item_30.svg',
      skill:{ name:'減点だ！', levelReq:6, chance:0.30, type:'atkDown', duration:5, desc:'30%で相手のATKを5ターンダウンさせる（重ねがけしても5ターンにリセットされるのみ）' } },
    { name:'伝説の屋台マスター',     hp:275, atk:52, def:41, spd:19, image:'botimage/bot19.png', category:'vegetable',
      curryName:'伝説の飴色玉ねぎカレー', curryIcon:'foods_icon/item_13.svg',
      skill:{ name:'秘伝のスパイス', levelReq:6, chance:1.0, type:'selfHealLowHp', desc:'HPが50%を切ると1回だけ自分のHPを回復' } },
    { name:'カレーフェス総帥',       hp:330, atk:61, def:44, spd:22, image:'botimage/bot20.png', category:'meat',
      curryName:'覇者の極上牛肉カレー', curryIcon:'foods_icon/item_04.svg',
      skill:{ name:'総帥の一撃', levelReq:6, chance:1.0, type:'periodicCrit', desc:'3ターンに1回、必ず会心が出る' } },
];
const FEST_ALLY_LEVEL_CAP = 50;
const FEST_ALLY_POINTS_PER_LEVEL = 10;
// レベルアップに必要な経験値（そのレベルに上がるための消費量）
function festExpNeededForLevel(lv) {
    if(lv <= 5) return 2;
    if(lv <= 10) return 5;
    if(lv <= 20) return 10;
    if(lv <= 30) return 15;
    return 20; // Lv31〜50
}
function getFestAllyDef(name) { return FEST_ALLY_DEFS.find(function(b){ return b.name === name; }) || null; }
// 特技を日本語ラベルに変換（仲間パネル表示用）。specialEffect（常時発動系）とskill（レベルアップで習得する系）の両方に対応する。
function getFestAllySpecialLabel(def) {
    if(!def) return '特になし';
    const parts = [];
    switch(def.specialEffect) {
        case 'illusion': parts.push('幻惑（敵をたまに攻撃ミスにする）'); break;
        case 'seed': parts.push('種連続発射（多段攻撃）'); break;
        case 'breath': parts.push('熱々ブレス（敵全体にDEF無視ダメージ）'); break;
        case 'poison': parts.push('毒（敵に継続ダメージ）'); break;
    }
    if(def.skill) {
        const progress = getFestAllyProgress(def.name);
        const unlocked = progress.level >= def.skill.levelReq;
        parts.push(def.skill.name + '（Lv.' + def.skill.levelReq + '習得・' + (unlocked ? '習得済み' : '未習得') + '）');
    }
    return parts.length ? parts.join(' / ') : '特になし';
}
// 現在のレベル・経験値（永続データ。未登録なら初期レベルを返す）
function getFestAllyProgress(name) {
    const def = getFestAllyDef(name);
    if(!def) return { level:1, exp:0 };
    const s = getStats();
    const stored = s.festAllyLevels && s.festAllyLevels[name];
    return stored ? { level: stored.level, exp: stored.exp } : { level: def.initLevel, exp: 0 };
}
// 現在のレベルに応じたステータス（基本値＋(現在Lv−初期Lv)×10ポイントを基本比率で配分）
function getFestAllyCurrentStats(name) {
    const def = getFestAllyDef(name);
    if(!def) return null;
    const progress = getFestAllyProgress(name);
    const total = def.hp + def.atk + def.def + def.spd;
    const addPoints = FEST_ALLY_POINTS_PER_LEVEL * Math.max(0, progress.level - def.initLevel);
    const ratio = { hp: def.hp/total, atk: def.atk/total, def: def.def/total, spd: def.spd/total };
    return {
        name: def.name,
        level: progress.level,
        hp: def.hp + Math.round(addPoints * ratio.hp),
        atk: def.atk + Math.round(addPoints * ratio.atk),
        def: def.def + Math.round(addPoints * ratio.def),
        spd: def.spd + Math.round(addPoints * ratio.spd),
    };
}

// 仲間の雇用候補を抽選する：初級・中級（マハラジャ除く）で討伐済みのbotの中からランダムに最大3体。
// フェス開始時に一度だけ確定し、そのフェスの間は変わらない。
function rollFestHireCandidates() {
    const s = getStats();
    const defeated = (s.defeatedBots || []).concat(s.defeatedHardBots || []);
    const eligible = FEST_ALLY_DEFS.map(function(d){ return d.name; }).filter(function(name){ return defeated.includes(name); });
    // シャッフルして先頭3体を採用
    for(let i = eligible.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = eligible[i]; eligible[i] = eligible[j]; eligible[j] = tmp;
    }
    return eligible.slice(0, 3);
}

// ===== フェス進行中の一時state保存（端末ローカルのみ。クラウド同期はしない） =====
// フェス中に途中でページを閉じても再開できるように、進行中stateだけlocalStorageに保存する。
// フェス自体はビンゴ・図鑑等に影響を与えない専用領域という設計方針のため、あえてクラウド同期対象には含めない。
function saveFestState() {
    if(!festActive) { localStorage.removeItem('qr_fest_session'); return; }
    const session = {
        festActive, festFP, festInventory, festSpiceInventory, festCurryStock,
        festExpSpice, festHealSpice, festSpicySpice, festWinStreak, festSetIndex,
        festHiredAllyName, festAllyHp, festHireCandidates,
        festBattlePhase, festActiveCurryIdx, festAccumulatedReward, festSpicyBuffActive
    };
    localStorage.setItem('qr_fest_session', JSON.stringify(session));
}
function loadFestState() {
    const raw = localStorage.getItem('qr_fest_session');
    if(!raw) return;
    try {
        const session = JSON.parse(raw);
        if(!session || !session.festActive) return;
        festActive = true;
        festFP = session.festFP || 0;
        festInventory = session.festInventory || {};
        festSpiceInventory = session.festSpiceInventory || {};
        festCurryStock = session.festCurryStock || [];
        festExpSpice = session.festExpSpice || 0;
        festHealSpice = session.festHealSpice || 0;
        festSpicySpice = session.festSpicySpice || 0;
        festWinStreak = session.festWinStreak || 0;
        festSetIndex = session.festSetIndex || 1;
        festHiredAllyName = session.festHiredAllyName || null;
        festAllyHp = (typeof session.festAllyHp === 'number') ? session.festAllyHp : null;
        festHireCandidates = session.festHireCandidates || [];
        festBattlePhase = session.festBattlePhase || 1;
        festActiveCurryIdx = (typeof session.festActiveCurryIdx === 'number') ? session.festActiveCurryIdx : -1;
        festAccumulatedReward = session.festAccumulatedReward || 0;
        festSpicyBuffActive = !!session.festSpicyBuffActive;
        ensureFestCurryHp(); // 旧バージョンで保存されたcurHp未設定のカレーを補完（出撃直後の誤敗北バグ対策）
    } catch(e) { /* 壊れていれば無視して通常起動 */ }
}

// ===== フェス開始・終了 =====
function enterCurryFest() {
    if(festActive) { showFestScreen(); return; }
    showCustomConfirm('🎪 バトルカレーフェス',
        `参加費として <b>${FEST_ENTRY_FEE}G</b> を消費してフェスを開始します。<br>（現在の所持金: ${playerG}G）<br><br>フェス専用の食材・スパイス・カレーストックを使って連戦に挑みます。敗北するとフェスは終了し、連勝数に応じた報酬（G）を通常プレイに持ち帰れます。`,
        function() {
            if(playerG < FEST_ENTRY_FEE) { showCustomAlert('⚠️ 資金不足', `フェス参加には${FEST_ENTRY_FEE}G必要です。`); return; }
            playerG -= FEST_ENTRY_FEE;
            const gEl = document.getElementById('globalG'); if(gEl) gEl.innerText = playerG;
            saveGame();
            startNewFestRun();
        }
    );
}
// FP80・初期食材3つ・スパイス1つを実際に付与する（呼び出し元で通知表示とセットで使うこと）
function grantFestStarterItems() {
    festFP = 80;
    const normalIngredients = Object.keys(masterIngredients).filter(function(n){ return masterIngredients[n].shop === 0; });
    const normalSpices = Object.keys(masterSpices).filter(function(n){ return masterSpices[n].shop === 0; });
    const gotIngredients = [];
    for(let i = 0; i < 3; i++) {
        const pick = normalIngredients[Math.floor(Math.random() * normalIngredients.length)];
        festInventory[pick] = (festInventory[pick] || 0) + 1;
        gotIngredients.push(pick);
    }
    let gotSpice = null;
    if(normalSpices.length) {
        gotSpice = normalSpices[Math.floor(Math.random() * normalSpices.length)];
        festSpiceInventory[gotSpice] = (festSpiceInventory[gotSpice] || 0) + 1;
    }
    return { ingredients: gotIngredients, spice: gotSpice };
}
// フェス画面に入った後に支給品を付与し、通知で知らせる（最初から所持している見た目にしない）
function showFestStarterGrantNotice() {
    const got = grantFestStarterItems();
    saveFestState();
    updateFestStatusBar();
    if(festActivePanel === 'cook') renderFestCookUI();
    else if(festActivePanel === 'ally') renderFestAllyUI();
    const itemHtml = got.ingredients.map(function(n){
        const d = masterIngredients[n];
        const img = d && d.icon ? `<img src="${d.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">` : (d ? d.emoji : '');
        return img + n;
    }).join('、');
    let spiceHtml = 'なし';
    if(got.spice) {
        const d = masterSpices[got.spice];
        const img = d && d.icon ? `<img src="${d.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">` : (d ? d.emoji : '');
        spiceHtml = img + got.spice;
    }
    playWinSound();
    showCustomAlert('🎪 フェス開始！支給品', `<b>FP +80</b><br><br>食材：${itemHtml}<br>スパイス：${spiceHtml}`);
}
function startNewFestRun() {
    updateStats(function(s) { s.festJoinCount = (s.festJoinCount || 0) + 1; }); // フェス参加回数を永続記録
    // アナリティクスの「⚔️バトル」にも参加回数として集計する（対戦数ではなく、フェスに参加した回数）
    incrementGlobalStat('battle/festJoin');
    festActive = true;
    festFP = 0;
    festInventory = {};
    festSpiceInventory = {};
    festCurryStock = [];
    festExpSpice = 0; festHealSpice = 0; festSpicySpice = 0;
    festWinStreak = 0;
    festSetIndex = 1;
    festHiredAllyName = null;
    festAllyHp = null;
    festHireCandidates = rollFestHireCandidates(); // 雇用候補3体をフェス開始時に確定
    festCookSelectedIngredients = [];
    festCookSelectedSpice = "";
    festBattlePhase = 1;
    festActiveCurryIdx = -1;
    festAccumulatedReward = 0;
    festSpicyBuffActive = false;
    festBattleEnemies = [];
    festMatchNeedsReroll = true;
    festBattleTurnCount = 0;
    festBattleInProgress = false;
    saveFestState();
    showFestScreen();
    setTimeout(showFestStarterGrantNotice, 300); // 画面表示後に支給品を通知付きで付与
}
// フェスを終える直前に必ず通す関門：経験値スパイスが残っていて仲間が雇用中なら、
// 「フェスを終了すると経験値スパイスも失われます。全て使いますか？」と確認してから実際の終了処理(proceed)を呼ぶ。
// 余っていない/仲間がいない場合は確認なしで即座にproceed()する。
let festExpSpiceFinalCallback = null;
function maybePromptFestExpSpiceBeforeEnd(proceed) {
    if(festExpSpice > 0 && festHiredAllyName) {
        const msgEl = document.getElementById('festExpSpiceFinalMessage');
        if(msgEl) msgEl.innerText = 'フェスを終了すると経験値スパイスも失われます。' + festHiredAllyName + 'に全て使いますか？（残り' + festExpSpice + '個）';
        festExpSpiceFinalCallback = proceed;
        const overlay = document.getElementById('festExpSpiceFinalOverlay');
        if(overlay) overlay.style.display = 'flex';
    } else {
        proceed();
    }
}
function declineFestExpSpiceFinal() {
    const overlay = document.getElementById('festExpSpiceFinalOverlay');
    if(overlay) overlay.style.display = 'none';
    const cb = festExpSpiceFinalCallback;
    festExpSpiceFinalCallback = null;
    if(cb) cb();
}
function confirmFestExpSpiceFinal() {
    const overlay = document.getElementById('festExpSpiceFinalOverlay');
    if(overlay) overlay.style.display = 'none';
    // 経験値スパイスを全て雇用中の仲間に使う（レベルキャップ50まで）
    const allyName = festHiredAllyName;
    const beforeStats = getFestAllyCurrentStats(allyName);
    const progress = getFestAllyProgress(allyName);
    const beforeLevel = progress.level;
    let level = progress.level, exp = progress.exp;
    while(festExpSpice > 0 && level < FEST_ALLY_LEVEL_CAP) {
        festExpSpice -= 1;
        exp += 1;
        while(level < FEST_ALLY_LEVEL_CAP) {
            const need = festExpNeededForLevel(level + 1);
            if(exp < need) break;
            exp -= need;
            level += 1;
        }
    }
    if(level >= FEST_ALLY_LEVEL_CAP) { level = FEST_ALLY_LEVEL_CAP; exp = 0; }
    updateStats(function(s) {
        if(!s.festAllyLevels) s.festAllyLevels = {};
        s.festAllyLevels[allyName] = { level: level, exp: exp };
    });
    const cb = festExpSpiceFinalCallback;
    festExpSpiceFinalCallback = null;
    if(level > beforeLevel) {
        const afterStats = getFestAllyCurrentStats(allyName);
        showCustomAlert('✨ レベルアップ！', allyName + 'は Lv.' + beforeLevel + ' → Lv.' + level + ' になった！' + festStatDiffHtml(beforeStats, afterStats) + festSkillLearnedHtml(allyName, beforeLevel, level), function() { if(cb) cb(); });
    } else {
        if(cb) cb();
    }
}
// 撤退＝その時点でフェスを終える。これまでに確保したG（festAccumulatedReward）をここで受け取る。
function retreatFromFest() {
    const msg = festBattleInProgress
        ? 'ここでフェスを終えて対戦タブに戻ります。<br>戦闘中のデータは破棄されますが、これまでに確保した <span style="color:#2ecc71;">' + festAccumulatedReward + ' G</span> は受け取れます。'
        : 'ここでフェスを終えて対戦タブに戻ります。<br>これまでに確保した <span style="color:#2ecc71;">' + festAccumulatedReward + ' G</span> を受け取ります。';
    showCustomConfirm('🚩 撤退', msg, function() {
        maybePromptFestExpSpiceBeforeEnd(function() {
            playerG += festAccumulatedReward;
            saveGame();
            festActive = false;
            festBattleInProgress = false;
            stopBattleBGM();
            localStorage.removeItem('qr_fest_session');
            // 調理でセットしていた食材・スパイスは撤退時にクリアし、次回入場時に残らないようにする
            festCookSelectedIngredients = [];
            festCookSelectedSpice = "";
            hideFestScreen();
        });
    });
}
function showFestScreen() {
    document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
    document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
    const page = document.getElementById('pageFest');
    if(page) page.classList.add('active');
    setFestStatusBarVisible(true);
    updateFestStatusBar();
    // 前回、戦闘画面を表示したまま撤退・終了していた場合に備え、バトル画面表示状態を必ずリセットする
    // （これが無いと、再入場時にショップ/調理/仲間タブが消えたまま前回のバトル画面が残る不具合が起きる）
    festBattleInProgress = false;
    const battlePanel = document.getElementById('festBattlePanel');
    if(battlePanel) battlePanel.style.display = 'none';
    const navRow = document.getElementById('festNavRow');
    if(navRow) navRow.style.display = 'flex';
    const matchScreen = document.getElementById('festMatchFullscreen');
    if(matchScreen) matchScreen.classList.remove('active');
    showFestPanel(festActivePanel || 'cook');
    hideQuestGuideChar(); // フェス中は右下の案内人を非表示
    const cm = document.getElementById('customModal');
    if(cm) cm.classList.add('fest-theme'); // フェス中は共有アラート（くじ結果・購入完了等）もフェス配色にする
    fetchFestGlobalRecord();
}
// 全プレイヤーを通じた最高連勝記録を取得して表示する（Firebase festGlobalRecord/maxStreak）
function fetchFestGlobalRecord() {
    const el = document.getElementById('festGlobalRecordStreak');
    if(!database) return;
    database.ref('festGlobalRecord/maxStreak').once('value').then(function(snap) {
        festGlobalMaxStreak = snap.val() || 0;
        if(el) el.innerText = festGlobalMaxStreak;
    }).catch(function() { /* 通信失敗時はローカルキャッシュ(0)のまま表示 */ });
}
// 自分の連勝数が記録を上回っていれば全プレイヤー最高記録を更新する。
// 現状フェスの対戦ループ（Phase3）が未実装のためfestWinStreakは常に0だが、
// 実装後はfestWinStreakが増えるたびに呼び出せばそのまま機能する想定。
// 開発・検証用の管理者3キャラ（自キャラID.txt参照）。全プレイヤー最高連勝記録の対象から除外する
const FEST_ADMIN_EXCLUDED_IDS = ['BC-MXB6JXKB', 'BC-ZQ34WFEU', 'BC-GJPGTMTN'];
function updateFestGlobalRecordIfHigher() {
    if(!database) return;
    if(FEST_ADMIN_EXCLUDED_IDS.includes(playerId)) return; // 管理者キャラの記録は全プレイヤー最高記録に反映しない
    if(festWinStreak <= festGlobalMaxStreak) return;
    database.ref('festGlobalRecord/maxStreak').set(festWinStreak).then(function() {
        festGlobalMaxStreak = festWinStreak;
        const el = document.getElementById('festGlobalRecordStreak');
        if(el) el.innerText = festGlobalMaxStreak;
    }).catch(function() { /* 更新失敗時は次回同期時に再試行される */ });
}
// 自分の連勝数の自己ベストを更新し、20連勝到達で報酬アイコンを解放する（プレイヤーごとにqr_statsへ永続保存）
function festUpdatePersonalBestAndIconUnlock() {
    updateStats(function(s) {
        if(!s.festBestStreak || festWinStreak > s.festBestStreak) s.festBestStreak = festWinStreak;
    });
    if(festWinStreak >= 20) {
        const unlocked = unlockIcon('myimageicon/mayimage11.png');
        if(unlocked) {
            setTimeout(function(){ showIconGetOverlay('myimageicon/mayimage11.png', 'フェス20連勝報酬'); }, 1500);
        }
    }
}
function hideFestScreen() {
    setFestStatusBarVisible(false);
    switchTab('battle', document.querySelector('.tab-btn[onclick*="battle"]'));
    showBattleGuideChar(); // フェス終了・撤退で対戦タブに戻るので案内人を再表示
    hideFestCookStatPreview();
    const cm = document.getElementById('customModal');
    if(cm) cm.classList.remove('fest-theme');
}
// フェス中はメインタブ・通常の資金表示欄を非表示にし、フェス専用ヘッダーに切り替える
function setFestStatusBarVisible(isFest) {
    const tabMenu = document.querySelector('.tab-menu');
    const statusBarWrap = document.querySelector('.status-bar-wrap');
    if(tabMenu) tabMenu.style.display = isFest ? 'none' : 'flex';
    if(statusBarWrap) statusBarWrap.style.display = isFest ? 'none' : 'block';
}
function updateFestStatusBar() {
    const setEl = function(id, val) { const el = document.getElementById(id); if(el) el.innerText = val; };
    setEl('festHeaderPlayerName', playerName || '名無しの料理人');
    setEl('festHeaderFP', festFP);
    setEl('festHeaderExpSpice', festExpSpice);
    setEl('festHeaderHealSpice', festHealSpice);
    setEl('festHeaderSpicySpice', festSpicySpice);
    setEl('festHeaderStreak', festWinStreak);
    updateFestGlobalRecordIfHigher();
    updateFestProgressPotRow();
}

// セット内の進行状況インジケーター：銀ポット3つ（雑魚戦1〜3）＋金ポット1つ（ボス戦）を並べ、
// 現在の戦闘（festBattlePhase：1〜3=雑魚戦、4=ボス戦）に応じてプレイヤーアイコンを該当ポットの上に、
// 下半分がポットの陰に隠れる形で重ねて表示する（ポットからポットへ進んでいく見た目にする）
function updateFestProgressPotRow() {
    const row = document.getElementById('festProgressPotRow');
    const icon = document.getElementById('festProgressPlayerIcon');
    if(!row || !icon) return;
    // ポットの進行表示は対戦画面のみに表示する（ショップ／調理／仲間／マッチング画面では非表示）
    if(!festActive || !festBattleInProgress) { row.style.display = 'none'; return; }
    row.style.display = 'flex';
    icon.src = currentIconFile;
    const activeIdx = Math.min(3, Math.max(0, festBattlePhase - 1));
    const slot = document.getElementById('festPotSlot' + activeIdx);
    if(!slot) return;
    // display切替直後はサイズが取得できないことがあるため、描画反映後（次フレーム）に位置計算する
    requestAnimationFrame(function() {
        const rowRect = row.getBoundingClientRect();
        const slotRect = slot.getBoundingClientRect();
        if(rowRect.width === 0 || slotRect.width === 0) return;
        const potWidth = slotRect.width;
        const iconWidth = Math.round(potWidth * 0.62);
        const centerX = (slotRect.left - rowRect.left) + potWidth / 2;
        icon.style.width = iconWidth + 'px';
        icon.style.height = iconWidth + 'px';
        icon.style.left = Math.round(centerX - iconWidth / 2) + 'px';
        icon.style.top = Math.round((slotRect.top - rowRect.top) - iconWidth * 0.72) + 'px';
        icon.style.display = 'block';
    });
}

// ===== フェス画面：ナビ（ショップ／調理／仲間／進む） =====
let festActivePanel = 'cook';
function showFestPanel(name) {
    if(festBattleInProgress) return; // 戦闘中はナビ操作を封じる
    if(name === 'shop') { openFestShopModal(); return; }
    festActivePanel = name;
    document.querySelectorAll('.fest-nav-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.panel === name); });
    const cookPanel = document.getElementById('festCookPanel');
    const allyPanel = document.getElementById('festAllyPanel');
    if(cookPanel) cookPanel.style.display = (name === 'cook') ? 'block' : 'none';
    if(allyPanel) allyPanel.style.display = (name === 'ally') ? 'block' : 'none';
    if(name === 'cook') { renderFestCookUI(); } else { hideFestCookStatPreview(); }
    if(name === 'ally') renderFestAllyUI();
}

// ===== Phase3：フェス対戦ループ =====
// 現在出撃可能（curHp>0）な最初のストックカレーのインデックスを返す（無ければ-1）
function getFestActiveCurryIndex() {
    ensureFestCurryHp();
    for(let i = 0; i < festCurryStock.length; i++) {
        const c = festCurryStock[i];
        if(c.curHp > 0) return i;
    }
    return -1;
}
// curHp未設定の（旧バージョンで調理・保存された）ストックカレーに、hpを初期値として補完する。
// これが無いと curry.curHp が undefined のままとなり、「curry.curHp > 0」判定が常にfalseになって
// 出撃直後に敗北扱いになってしまう（実際に発生した不具合の原因）。
function ensureFestCurryHp() {
    festCurryStock.forEach(function(c) {
        if(typeof c.curHp !== 'number') c.curHp = c.hp;
    });
}
// フェスの自分のカレーにも、フェス外で選択中の食器（selectedTableware）の補正をそのまま適用する（ベースは現状効果なし）
function festCurryStatWithTableware(baseVal, statKey) {
    const info = TABLEWARE_LIST[selectedTableware];
    const mod = info ? (info[statKey] || 0) : 0;
    return Math.max(0, baseVal + mod);
}
function getFestEnemyMultiplier(setIndex) { return 1 + 0.10 * (setIndex - 1); }
function makeFestEnemyInstance(def, mult, level, isBoss) {
    const maxHp = Math.max(1, Math.round(def.hp * mult));
    return {
        name: def.name, image: def.image, isBoss: isBoss, level: level, category: def.category || null,
        curryName: def.curryName || '', curryIcon: def.curryIcon || '',
        meatResistant: def.meatResistant || false,
        maxHp: maxHp, curHp: maxHp,
        atk: Math.round(def.atk * mult), def: Math.round(def.def * mult), spd: Math.round(def.spd * mult),
        skill: def.skill, turnsActed: 0, selfHealUsed: false, statusAtkDown: false,
        isPoisoned: false, poisonLevel: 0, isIlluded: false,
        // ガンコ親父「頑固割り拳」用：DEFダウンの重ねがけ段階・残りターン数・skipNextTurnは宮廷カレー長「宮廷流水花麗」で1ターン休みにする時のフラグ
        defDownStacks: 0, defDownTurns: 0, skipNextTurn: false
    };
}
function buildFestBattleEnemies() {
    const mult = getFestEnemyMultiplier(festSetIndex);
    const level = festSetIndex;
    if(festBattlePhase <= 3) {
        const pool = FEST_ZAKO_DEFS.slice();
        const picks = [];
        for(let i = 0; i < 2 && pool.length > 0; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            picks.push(pool.splice(idx, 1)[0]);
        }
        return picks.map(function(def) { return makeFestEnemyInstance(def, mult, level, false); });
    } else {
        const def = FEST_BOSS_DEFS[(festSetIndex - 1) % FEST_BOSS_DEFS.length];
        return [makeFestEnemyInstance(def, mult, level, true)];
    }
}
function proceedFestForward() {
    if(festBattleInProgress) return;
    ensureFestCurryHp();
    if(getFestActiveCurryIndex() === -1) {
        showCustomAlert('⚠️ 出撃できるカレーがありません', 'HPが残っているストックカレーがありません。調理してから進んでください。');
        return;
    }
    openFestMatchModal();
}

// ===== フェスバトル マッチング画面（タッグ戦マッチングと同じ流れ：対戦相手を確定→出撃カレーを選択） =====
function openFestMatchModal() {
    if(festBattleInProgress) return;
    ensureFestCurryHp();
    if(getFestActiveCurryIndex() === -1) {
        showCustomAlert('⚠️ 出撃できるカレーがありません', 'HPが残っているストックカレーがありません。調理してから進んでください。');
        return;
    }
    // 対戦相手をここで確定し、マッチング画面のプレビューと実際のバトルで同じ相手になるようにする。
    // ×で閉じて開き直した場合は再抽選せず、同じ相手のままにする（festMatchNeedsRerollがfalseの間は据え置き）
    if(festMatchNeedsReroll || festBattleEnemies.length === 0) {
        festBattleEnemies = buildFestBattleEnemies();
        festMatchNeedsReroll = false;
    }
    renderFestMatchEnemyList();
    populateFestMatchCurrySelect();
    renderFestMatchAllyInfo();
    updateFestProgressPotRow();

    document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
    document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
    document.getElementById('festMatchFullscreen').classList.add('active');
    hideQuestGuideChar();

    const enemyWrap = document.getElementById('festMatchEnemyWrap');
    const playerWrap = document.getElementById('festMatchPlayerWrap');
    enemyWrap.classList.remove('slide-in');
    playerWrap.classList.remove('slide-in');
    setTimeout(function(){ enemyWrap.classList.add('slide-in'); }, 100);
    setTimeout(function(){ playerWrap.classList.add('slide-in'); }, 300);
}
function closeFestMatchModal() {
    document.getElementById('festMatchFullscreen').classList.remove('active');
    showFestScreen();
}
function renderFestMatchEnemyList() {
    const wrap = document.getElementById('festEnemyMatchList');
    if(!wrap) return;
    // タッグ戦のマッチング画面同様、カレー名の行を表示する（絵文字ではなく食材アイコン画像）
    wrap.innerHTML = festBattleEnemies.map(function(e) {
        const curryRow = e.curryName
            ? '<div class="tag-enemy-curry">' + (e.curryIcon ? '<img class="tag-enemy-curry-icon-img" src="' + e.curryIcon + '" alt="">' : '') + e.curryName + '</div>'
            : '';
        return '<div class="tag-match-enemy-card"><img class="tag-enemy-icon" src="' + e.image + '" alt="' + e.name + '">'
            + '<div class="tag-enemy-info"><div class="tag-enemy-name">' + e.name + ' Lv.' + e.level + (e.isBoss ? ' 👑' : '') + '</div>' + curryRow + '</div></div>';
    }).join('');
}
function populateFestMatchCurrySelect() {
    const sel = document.getElementById('festMatchCurrySelect');
    if(!sel) return;
    sel.innerHTML = '';
    festCurryStock.forEach(function(c, idx) {
        if(c.curHp <= 0) return;
        const opt = document.createElement('option');
        opt.value = idx;
        opt.innerText = c.name + '（HP' + c.curHp + '/' + c.hp + '）';
        sel.appendChild(opt);
    });
    updateFestMatchPreview();
}
function updateFestMatchPreview() {
    const sel = document.getElementById('festMatchCurrySelect');
    const statusBox = document.getElementById('festMatchCurryStatus');
    if(!sel || !statusBox) return;
    const idx = parseInt(sel.value, 10);
    const curry = festCurryStock[idx];
    if(curry) {
        statusBox.style.display = 'grid';
        statusBox.innerHTML = '<div>HP: ' + curry.curHp + '/' + curry.hp + '</div><div>ATK: ' + curry.atk + '</div><div>DEF: ' + curry.def + '</div><div>SPD: ' + curry.spd + '</div>';
    } else {
        statusBox.style.display = 'none';
    }
}
function renderFestMatchAllyInfo() {
    const box = document.getElementById('festMatchAllyInfo');
    if(!box) return;
    if(festHiredAllyName) {
        const stats = getFestAllyCurrentStats(festHiredAllyName);
        const hp = (festAllyHp === null) ? stats.hp : festAllyHp;
        box.innerHTML = festHiredAllyName + '（Lv.' + stats.level + '）HP: ' + Math.max(0, hp) + '/' + stats.hp;
    } else {
        box.innerText = '仲間は未雇用です';
    }
}
function confirmFestDeploy() {
    const sel = document.getElementById('festMatchCurrySelect');
    const idx = parseInt(sel.value, 10);
    if(isNaN(idx) || !festCurryStock[idx]) return;
    festActiveCurryIdx = idx;
    document.getElementById('festMatchFullscreen').classList.remove('active');
    document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
    document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
    const page = document.getElementById('pageFest');
    if(page) page.classList.add('active');
    startFestBattle();
}

// ===== Phase3：バトルラウンド処理（フェス外のタッグ戦バトル画面と同じ演出方式：カード表示・自動進行・速度切替） =====
let festBattleQueue = [];       // 現在のラウンドの残り行動キュー（SPD順。空になったら次ラウンドを組み直す）
let festBattleLogHistory = [];  // 戦闘ログの履歴（📜 戦闘ログボタンで一覧表示）
// フェスバトルのBGM。既存のplayBattleBGM/stopBattleBGM（全バトル共通）をそのまま利用する。
function festPlayBattleBgm(isZako) {
    playBattleBGM(isZako ? 'sound/fest-zako.mp3' : 'sound/fest-boss.mp3');
}
function festStopBattleBgm() { stopBattleBGM(); }

function startFestBattle() {
    // 対戦相手（festBattleEnemies）はマッチング画面（openFestMatchModal）で既に確定済みのため、ここでは再抽選しない
    festBattleTurnCount = 0;
    festBattleQueue = [];
    festBattleLogHistory = [];
    festBattleInProgress = true;
    // 味方側の一時ステータス異常（ボスの技でダウンした攻撃力・毒）は毎戦闘開始時にリセット
    festPlayerAtkDownActive = false;
    festAllyAtkDownActive = false;
    festPlayerAtkDownTurns = 0;
    festAllyAtkDownTurns = 0;
    festPlayerPoisoned = false;
    festAllyPoisoned = false;
    festPlayerIlluded = false;
    festAllyIlluded = false;
    document.getElementById('festCookPanel').style.display = 'none';
    document.getElementById('festAllyPanel').style.display = 'none';
    document.getElementById('festNavRow').style.display = 'none';
    hideFestCookStatPreview();
    document.querySelectorAll('.fest-nav-btn').forEach(function(b){ b.classList.remove('active'); });
    const battlePanel = document.getElementById('festBattlePanel');
    if(battlePanel) battlePanel.style.display = 'block';
    document.getElementById('festBattleResultArea').style.display = 'none';
    document.getElementById('festBattleDefeatArea').style.display = 'none';
    const overlay = document.getElementById('festBattleResultOverlay');
    if(overlay) overlay.style.display = 'none';
    document.getElementById('festBattleLog').innerHTML = '';
    const title = document.getElementById('festBattleTitle');
    if(title) title.style.display = 'none'; // セット数・雑魚戦の進捗表記は不要
    festInitBattleCards();
    updateFestProgressPotRow(); // 対戦画面に入ったのでポット進行表示を表示・更新する
    festPlayBattleBgm(festBattlePhase <= 3);
    festLogSet((festBattlePhase <= 3 ? '雑魚' : 'ボス') + 'が現れた！');
    festApplyAllySpecialOnBattleStart();
    festUpdateAllHpDisplays();
    setTimeout(festBattleAutoStep, battleDelay(700));
}
// カード（画像・名前）の初期表示を行う。HPバーは festUpdateAllHpDisplays() 側で毎アクション更新する。
function festInitBattleCards() {
    const curry = festCurryStock[festActiveCurryIdx];
    const allyStats = festHiredAllyName ? getFestAllyCurrentStats(festHiredAllyName) : null;
    if(allyStats && festAllyHp === null) festAllyHp = allyStats.hp;

    const isBossFight = festBattlePhase > 3; // ボス戦は画像上・情報下の縦積みレイアウト（画像150%拡大）
    [0,1].forEach(function(i) {
        const e = festBattleEnemies[i];
        const card = document.getElementById('festEnemyCard' + i);
        if(!card) return;
        if(!e) { card.style.display = 'none'; return; }
        card.style.display = '';
        card.classList.remove('ko');
        card.classList.toggle('fest-boss-card', isBossFight);
        const img = document.getElementById('festEnemyImg' + i);
        if(img) img.src = e.image;
        const nameEl = document.getElementById('festEnemyName' + i);
        if(nameEl) nameEl.innerText = e.name + ' Lv.' + e.level;
        const curryIconEl = document.getElementById('festEnemyCurryIcon' + i);
        const curryNameEl = document.getElementById('festEnemyCurryName' + i);
        if(curryIconEl) curryIconEl.src = e.curryIcon || '';
        if(curryNameEl) curryNameEl.innerText = e.curryName || '';
    });

    const card0 = document.getElementById('festPlayerCard0');
    if(card0) {
        card0.style.display = '';
        card0.classList.remove('ko');
        const n0 = document.getElementById('festPlayerName0');
        if(n0) n0.innerText = playerName;
        const c0 = document.getElementById('festPlayerCurryName0');
        if(c0) c0.innerText = curry ? curry.name : '（カレーなし）';
    }
    const card1 = document.getElementById('festPlayerCard1');
    if(card1) {
        if(allyStats) {
            card1.style.display = '';
            card1.classList.remove('ko');
            const n1 = document.getElementById('festPlayerName1');
            if(n1) n1.innerText = festHiredAllyName;
            const c1 = document.getElementById('festPlayerCurryName1');
            if(c1) c1.innerText = 'Lv.' + allyStats.level;
        } else {
            card1.style.display = 'none';
        }
    }
    festUpdateAllHpDisplays();
}
function festUpdateAllHpDisplays() {
    const curry = festCurryStock[festActiveCurryIdx];
    if(curry) {
        const pct = Math.max(0, curry.curHp / curry.hp * 100);
        const bar = document.getElementById('festPlayerHpBar0');
        const text = document.getElementById('festPlayerHpText0');
        const card = document.getElementById('festPlayerCard0');
        if(bar) { bar.style.width = pct + '%'; bar.classList.toggle('danger', pct <= 30); }
        if(text) text.innerText = 'HP: ' + Math.max(0, curry.curHp) + '/' + curry.hp;
        if(card) card.classList.toggle('ko', curry.curHp <= 0);
    }
    if(festHiredAllyName) {
        const stats = getFestAllyCurrentStats(festHiredAllyName);
        const hp = (festAllyHp === null) ? stats.hp : festAllyHp;
        const pct = Math.max(0, hp / stats.hp * 100);
        const bar = document.getElementById('festPlayerHpBar1');
        const text = document.getElementById('festPlayerHpText1');
        const card = document.getElementById('festPlayerCard1');
        if(bar) { bar.style.width = pct + '%'; bar.classList.toggle('danger', pct <= 30); }
        if(text) text.innerText = 'HP: ' + Math.max(0, hp) + '/' + stats.hp;
        if(card) card.classList.toggle('ko', hp <= 0);
    }
    festBattleEnemies.forEach(function(e, i) {
        const bar = document.getElementById('festEnemyHpBar' + i);
        const text = document.getElementById('festEnemyHpText' + i);
        const card = document.getElementById('festEnemyCard' + i);
        if(!bar || !text) return;
        const pct = Math.max(0, e.curHp / e.maxHp * 100);
        bar.style.width = pct + '%';
        bar.classList.toggle('danger', pct <= 30);
        text.innerText = 'HP: ' + Math.max(0, e.curHp) + '/' + e.maxHp;
        if(card) card.classList.toggle('ko', e.curHp <= 0);
    });
}
// フェス外のtagTriggerDamagePop()と同じ仕組みのダメージポップ演出（対象カードの位置に数値をポップさせる）
// Spicy Hit（会心＝color:'#ff4500'）の場合は、PCとの対戦（triggerEffect関数）と同じ
// 「Spicy Hit!!!!!!!!」文字演出・画面フラッシュ（flash-crit）・専用SE（spicyhit.mp3）を追加する
function festTriggerDamagePop(side, idx, value, color) {
    const pop = document.getElementById('festDamagePop');
    const stage = document.getElementById('festBattleStage');
    if(!pop || !stage) return;
    const targetEl = side === 'enemy' ? document.getElementById('festEnemyCard' + idx) : document.getElementById('festPlayerCard' + idx);
    if(!targetEl) return;
    const stageRect = stage.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    let topPos = targetRect.top - stageRect.top + 4;
    if(topPos < 50) topPos = 50;
    const isCrit = (color === '#ff4500');
    pop.style.left = (targetRect.left - stageRect.left + targetRect.width/2 - 20) + 'px';
    pop.style.top = topPos + 'px';
    pop.className = 'tag-damage-pop';
    if(isCrit) {
        pop.innerHTML = '<div class="crit-label">Spicy Hit!!!!!!!!</div><div class="crit-dmg">' + (value > 0 ? '' : '+') + Math.abs(value) + '</div>';
    } else {
        pop.innerText = (value > 0 ? '' : '+') + Math.abs(value);
    }
    pop.style.color = color || '#f1c40f';
    pop.style.display = 'block';
    pop.style.animation = 'none';
    void pop.offsetWidth;
    pop.style.animation = isCrit ? 'critPopUp 0.9s forwards' : 'popUp 0.7s forwards';
    setTimeout(function(){ pop.style.display = 'none'; }, isCrit ? 900 : 700);
    if(isCrit) {
        playSoundEffect('spicyhit.mp3');
        stage.classList.remove('flash-crit');
        void stage.offsetWidth;
        stage.classList.add('flash-crit');
        setTimeout(function(){ stage.classList.remove('flash-crit'); }, 350);
    }
    targetEl.style.transform = 'translateX(-4px)';
    setTimeout(function(){ targetEl.style.transform = 'translateX(4px)'; }, 60);
    setTimeout(function(){ targetEl.style.transform = ''; }, 120);
}
// フェス外のtagLogSet/tagLogAppendと同じ挙動：1アクションごとにログを上書きし、直前分は履歴に積む
function festLogSet(text) {
    const log = document.getElementById('festBattleLog');
    if(log) {
        if(log.innerHTML) festBattleLogHistory.push(log.innerHTML);
        log.innerHTML = text;
    }
}
function festLogAppend(text) {
    const log = document.getElementById('festBattleLog');
    if(log) log.innerHTML += (log.innerHTML ? '\n' : '') + text;
}
function showFestBattleLogHistory() {
    const cur = document.getElementById('festBattleLog');
    const allLogs = festBattleLogHistory.concat(cur ? [cur.innerHTML] : []);
    if(allLogs.length === 0) { showCustomAlert('📜 戦闘ログ', 'ログがありません。'); return; }
    const rows = allLogs.map(function(entry) {
        const lines = entry.split('\n').filter(function(l){ return l.trim() !== ''; }).join('<br>');
        return '<div style="padding:8px 0;border-bottom:1px solid #e0d0b0;font-size:12px;color:#420000;text-align:left;line-height:1.6;">' + lines + '</div>';
    }).join('');
    showCustomAlert('📜 戦闘ログ', '<div style="max-height:55vh;overflow-y:auto;text-align:left;">' + rows + '</div>');
}
function pickLivingFestEnemyWithIdx() {
    const aliveIdx = [];
    festBattleEnemies.forEach(function(e, i){ if(e.curHp > 0) aliveIdx.push(i); });
    if(aliveIdx.length === 0) return null;
    const idx = aliveIdx[Math.floor(Math.random() * aliveIdx.length)];
    return { enemy: festBattleEnemies[idx], idx: idx };
}
function applyFestDamageToPlayer(targetType, d, curry) {
    if(targetType === 'curry') { curry.curHp = Math.max(0, curry.curHp - d); }
    else { festAllyHp = Math.max(0, festAllyHp - d); }
}
function applyFestPoisonTick() {
    const curry = festCurryStock[festActiveCurryIdx];
    if(festPlayerPoisoned && curry && curry.curHp > 0) {
        curry.curHp = Math.max(0, curry.curHp - 10);
        festTriggerDamagePop('player', 0, 10, '#9b59b6');
        festLogSet('☠️ 毒のダメージ！ ' + playerName + 'に10ダメージ！');
        playSoundEffect('poison.mp3');
    }
    if(festAllyPoisoned && festHiredAllyName && festAllyHp > 0) {
        festAllyHp = Math.max(0, festAllyHp - 10);
        festTriggerDamagePop('player', 1, 10, '#9b59b6');
        festLogAppend('☠️ 毒のダメージ！ ' + festHiredAllyName + 'に10ダメージ！');
        playSoundEffect('poison.mp3');
    }
    // 仲間「毒舌料理人ミスズ」の特技で毒にかかった敵側の継続ダメージ（タッグ戦のtagExecuteTurnStartと同じ計算式）
    festBattleEnemies.forEach(function(e, idx) {
        if(e.isPoisoned && e.curHp > 0) {
            const d = Math.round(e.maxHp * 0.08 * (e.poisonLevel || 1));
            e.curHp = Math.max(0, e.curHp - d);
            festTriggerDamagePop('enemy', idx, d, '#9b59b6');
            festLogAppend('☠️ 毒のダメージ！ ' + e.name + 'に' + d + 'ダメージ！');
            playSoundEffect('poison.mp3');
        }
    });
    festUpdateAllHpDisplays();
}
// 時限式ATKダウン（のほほんオーラ等、skill.durationを持つ技）の残りターン数を1ラウンドごとに減らす。
// 0になったら元に戻る（重ねがけは延長ではなく残りターン数をskill.durationへ上書きするだけ＝festEnemyActAttack側で対応済み）
function festTickAtkDownTurns() {
    if(festPlayerAtkDownTurns > 0) {
        festPlayerAtkDownTurns--;
        if(festPlayerAtkDownTurns === 0) festLogAppend('📈 ' + playerName + 'のATKダウンが元に戻った！');
    }
    if(festAllyAtkDownTurns > 0) {
        festAllyAtkDownTurns--;
        if(festAllyAtkDownTurns === 0 && festHiredAllyName) festLogAppend('📈 ' + festHiredAllyName + 'のATKダウンが元に戻った！');
    }
}
// ガンコ親父「頑固割り拳」で敵に付与したDEFダウンの残りターンを毎ラウンド1減らし、0になったら元のDEFに戻す
function festTickEnemyDefDownTurns() {
    festBattleEnemies.forEach(function(e) {
        if(e.defDownTurns > 0) {
            e.defDownTurns--;
            if(e.defDownTurns === 0) {
                if(e.baseDefForDownCalc !== undefined) e.def = e.baseDefForDownCalc;
                e.defDownStacks = 0;
                festLogAppend('📈 ' + e.name + 'のDEFダウンが元に戻った！');
            }
        }
    });
}
// 戦闘開始時：自分のカレー（毒化／幻惑化）・雇用中の仲間（毒／幻惑の特技）それぞれについて、
// 該当する特性を持っていれば敵側のランダムな1体に状態異常を付与する（タッグ戦の開幕処理と同じ。各々個別に判定＝両方持っていれば2体にかかりうる）
function festApplyAllySpecialOnBattleStart() {
    [0,1].forEach(function(i) {
        const el = document.getElementById('festEnemyName' + i);
        if(el) el.classList.remove('name-poisoned', 'name-illuded');
        const pel = document.getElementById('festPlayerName' + i);
        if(pel) pel.classList.remove('name-poisoned', 'name-illuded');
    });
    festCurrySeaHealUsed = false; // 海鮮カレーの1回きり回復フラグを毎戦闘開始時にリセット
    festAllySkillUsedThisBattle = {}; // 「1バトル1回のみ」系の仲間特技の使用済みフラグを毎戦闘開始時にリセット
    const curry = festCurryStock[festActiveCurryIdx];
    // 🥚ふわとろオム／👑世界三大珍味：戦闘開始時に軽減対象の系統を抽選（タッグ戦と同じ考え方）
    festCurryFluffyCategory = (curry && curry.curHp > 0 && (curry.isFluffyOmelette || curry.isTriCaviar))
        ? FEST_FLUFFY_CATEGORY_KEYS[Math.floor(Math.random() * FEST_FLUFFY_CATEGORY_KEYS.length)]
        : null;
    if(festCurryFluffyCategory) {
        festLogAppend('🥚 ' + playerName + 'は' + getBarrierLabel(curry) + 'により' + FEST_FLUFFY_CATEGORY_LABEL[festCurryFluffyCategory] + 'からの攻撃を軽減する！');
        setTimeout(function() {
            playSoundEffect('healing.mp3');
            triggerFestFluffyBarrierEffect('player', 0);
        }, battleDelay(600));
    }
    if(curry && curry.curHp > 0 && curry.isPoison) festInflictBattleStartStatus('poison');
    if(curry && curry.curHp > 0 && curry.isIllusion) festInflictBattleStartStatus('illusion');
    // 戦闘不能（HP0）の仲間は特技を発動しない（festAllyHpがnullの場合は初期化前＝満タン扱いなので発動対象）
    const allyAlive = festHiredAllyName && (festAllyHp === null || festAllyHp > 0);
    const allyDef = allyAlive ? getFestAllyDef(festHiredAllyName) : null;
    if(allyDef && allyDef.specialEffect === 'poison') festInflictBattleStartStatus('poison');
    if(allyDef && allyDef.specialEffect === 'illusion') festInflictBattleStartStatus('illusion');
}
function festInflictBattleStartStatus(kind) {
    const pick = pickLivingFestEnemyWithIdx();
    if(!pick) return;
    const target = pick.enemy;
    if(kind === 'poison' && !target.isPoisoned) {
        target.isPoisoned = true;
        target.poisonLevel = 1;
        festLogAppend('☠️ ' + target.name + 'は毒にかかった！');
        setTimeout(function() {
            playSoundEffect('poison.mp3');
            const el = document.getElementById('festEnemyName' + pick.idx);
            if(el) el.classList.add('name-poisoned');
        }, battleDelay(300));
    } else if(kind === 'illusion' && !target.isIlluded) {
        target.isIlluded = true;
        festLogAppend('🌀 ' + target.name + 'は幻惑にかかった！');
        setTimeout(function() {
            playSoundEffect('sound/miss.mp3');
            const el = document.getElementById('festEnemyName' + pick.idx);
            if(el) el.classList.add('name-illuded');
        }, battleDelay(300));
    }
}
function festPlayerActAttack(unitType, curry, allyStats, callback) {
    const done = callback || function(){};
    if(unitType === 'ally') {
        const allyDef = getFestAllyDef(festHiredAllyName);
        if(allyDef && allyDef.specialEffect === 'seed' && Math.random() < 0.35) { festAllySeedAttack(allyStats, done); return; }
        if(allyDef && allyDef.specialEffect === 'breath' && Math.random() < 0.25) { festAllyBreathAttack(allyStats, done); return; }
        // レベルアップで習得する仲間特技（タカシ・レオン・ガンコ親父・宮廷カレー長）：levelReq到達済み・1バトル1回制限・使用条件を満たした上でchance抽選
        if(allyDef && allyDef.skill && allyStats.level >= allyDef.skill.levelReq
            && !(allyDef.skill.once && festAllySkillUsedThisBattle[allyDef.name])
            && festAllySkillConditionMet(allyDef) && Math.random() < allyDef.skill.chance) {
            festAllyUseNamedSkill(allyDef, allyStats, done);
            return;
        }
    }
    if(unitType === 'curry') {
        // ラタトゥイユカレー（isRatatouille）：自分のターンに毎回HPが少し回復する（タッグ戦と同じ）
        if(curry.isRatatouille && curry.curHp > 0) {
            const rataHeal = Math.round(curry.hp * 0.10);
            curry.curHp = Math.min(curry.hp, curry.curHp + rataHeal);
            festTriggerDamagePop('player', 0, -rataHeal, '#2ecc71');
            festLogAppend('☀️ 太陽の光を浴びてHP回復: ' + rataHeal);
            playSoundEffect('taiyou.mp3');
            festUpdateAllHpDisplays();
        }
        // 海鮮カレー（isSeafood）：HPが50%以下になった時に1回だけ自動回復する（タッグ戦と同じ。回復後も同ターンで通常攻撃を続ける）
        if(curry.isSeafood && !festCurrySeaHealUsed && curry.curHp <= Math.floor(curry.hp * 0.5)) {
            festCurrySeaHealUsed = true;
            const curSpd = festCurryStatWithTableware(curry.spd, 'spd');
            const aliveEnemySpd = festBattleEnemies.filter(function(e){ return e.curHp > 0; }).map(function(e){ return e.spd; });
            const avgEnemySpd = aliveEnemySpd.length ? aliveEnemySpd.reduce(function(a,b){ return a+b; },0)/aliveEnemySpd.length : 50;
            const healAmt = Math.round(curry.hp * (curSpd >= avgEnemySpd ? 0.4 : 0.3));
            curry.curHp = Math.min(curry.hp, curry.curHp + healAmt);
            festTriggerDamagePop('player', 0, -healAmt, '#2ecc71');
            festLogAppend('🌊 ' + playerName + 'は波の音に癒された。HP回復+' + healAmt);
            playSoundEffect('healing.mp3');
            festUpdateAllHpDisplays();
        }
        // 種連続発射カレー（isSeed）：35%で多段攻撃（仲間「種まき婆ちゃん」と同じ計算式・演出）
        if(curry.isSeed && Math.random() < 0.35) { festCurrySeedAttack(curry, done); return; }
        // 激辛グリーンカレー（isGreenCurry）：35%で敵全体に攻撃、反動で自分もダメージ（タッグ戦のヒリヒリクラッシュと同じ）
        if(curry.isGreenCurry && Math.random() < 0.35) { festCurryGreenAttack(curry, done); return; }
    }
    // 幻惑状態（敵「げそまきタコ助」の墨吐き幻惑で付与）：タッグ戦・敵側と同じミス判定
    if((unitType === 'curry' && festPlayerIlluded) || (unitType === 'ally' && festAllyIlluded)) {
        const mySpd = unitType === 'curry' ? festCurryStatWithTableware(curry.spd, 'spd') : allyStats.spd;
        const aliveEnemySpds = festBattleEnemies.filter(function(e){ return e.curHp > 0; }).map(function(e){ return e.spd; });
        const avgEnemySpd = aliveEnemySpds.length ? aliveEnemySpds.reduce(function(a,b){ return a+b; },0)/aliveEnemySpds.length : 50;
        if(Math.random() < getIllusionMissRate(mySpd, avgEnemySpd)) {
            playSoundEffect('sound/miss.mp3');
            festLogSet('💨 ' + (unitType === 'curry' ? playerName : festHiredAllyName) + 'は幻惑で攻撃が外れた！');
            done();
            return;
        }
    }
    // わんぱく／3匹のわんぱく兄弟（isWanpaku・isTonTonTon）：30%で攻撃が外れる（タッグ戦と同じ）
    if(unitType === 'curry' && (curry.isWanpaku || curry.isTonTonTon) && isWanpakuMiss()) {
        if(curry.isTonTonTon) playSoundEffect('pig2.mp3');
        playSoundEffect('sound/miss.mp3');
        festLogSet('💨 ' + playerName + 'のわんぱくが暴れすぎて攻撃が外れた！');
        done();
        return;
    }
    const pick = pickLivingFestEnemyWithIdx();
    if(!pick) { done(); return; }
    const target = pick.enemy;
    let atk, spd, name;
    if(unitType === 'curry') {
        atk = festCurryStatWithTableware(curry.atk, 'atk') * ((festPlayerAtkDownActive || festPlayerAtkDownTurns > 0) ? 0.7 : 1) + (festSpicyBuffActive ? 40 : 0);
        spd = festCurryStatWithTableware(curry.spd, 'spd'); name = playerName;
    } else {
        atk = allyStats.atk * ((festAllyAtkDownActive || festAllyAtkDownTurns > 0) ? 0.7 : 1) + (festSpicyBuffActive ? 40 : 0);
        spd = allyStats.spd; name = festHiredAllyName;
    }
    const isCrit = Math.random() < getCritRate(spd, target.spd);
    let d = isCrit ? Math.max(8, Math.round(atk)) : Math.max(8, Math.round(atk) - Math.floor(target.def/2));
    d = Math.round(d * (0.9 + Math.random()*0.2));
    // わんぱく／3匹のわんぱく兄弟（isWanpaku・isTonTonTon）：通常攻撃のダメージ幅が1.0〜1.5倍に増加（タッグ戦と同じ）
    if(unitType === 'curry' && (curry.isWanpaku || curry.isTonTonTon)) d = Math.round(d * getWanpakuDamageMultiplier());
    // 陽だまり野菜のご隠居（meatResistant）：肉系カレー／肉系仲間（レオン・ガンコ親父・ドラゴン料理長）からの攻撃を大幅軽減
    if(target.meatResistant && festIsAttackerMeatBased(unitType, curry)) d = Math.round(d * 0.2);
    target.curHp = Math.max(0, target.curHp - d);
    festTriggerDamagePop('enemy', pick.idx, d, isCrit ? '#ff4500' : '#f1c40f');
    festLogSet(isCrit ? ('🌶️ ' + name + ' の Spicy Hit!!!! ' + target.name + ' に ' + d + ' ダメージ！') : ('💥 ' + name + 'の攻撃！ ' + target.name + 'に' + d + 'ダメージ！'));
    playSoundEffect('punch.mp3');
    if(unitType === 'curry' && curry.isTonTonTon) playSoundEffect('pig2.mp3');
    festUpdateAllHpDisplays();
    // 🍎☠️毒りんご（isPoisonApple）：通常攻撃ヒット時50%で対象を毒状態にする／既に毒なら増幅
    if(unitType === 'curry' && curry.isPoisonApple && target.curHp > 0 && Math.random() < 0.5) {
        const enemyIdxForPoison = pick.idx;
        if(!target.isPoisoned) {
            target.isPoisoned = true; target.poisonLevel = 1;
            festLogAppend('☠️ ' + target.name + 'は毒にかかった！');
            setTimeout(function() {
                playSoundEffect('poison.mp3');
                const nm = document.getElementById('festEnemyName' + enemyIdxForPoison);
                if(nm) nm.classList.add('name-poisoned');
            }, battleDelay(300));
        } else if((target.poisonLevel || 1) < 6) {
            target.poisonLevel = (target.poisonLevel || 1) + 1;
            festLogAppend('☠️ 毒のダメージが増幅');
            setTimeout(function() { playSoundEffect('poison.mp3'); }, battleDelay(300));
        }
    }
    done();
}
// 激辛グリーンカレー（isGreenCurry）の特技：ヒリヒリクラッシュ（敵全員に攻撃、反動で自分の最大HP10%のダメージ。タッグ戦と同じ計算式）
function festCurryGreenAttack(curry, callback) {
    const done = callback || function(){};
    const aliveEnemies = festBattleEnemies.filter(function(e){ return e.curHp > 0; });
    if(aliveEnemies.length === 0) { done(); return; }
    playSoundEffect('hirihiri.mp3');
    const atk = festCurryStatWithTableware(curry.atk, 'atk') * ((festPlayerAtkDownActive || festPlayerAtkDownTurns > 0) ? 0.7 : 1) + (festSpicyBuffActive ? 40 : 0);
    const selfDmg = Math.round(curry.hp * 0.10);
    const hitTexts = [];
    const records = [];
    aliveEnemies.forEach(function(target) {
        let d = Math.max(8, Math.round(atk * (0.6 + Math.random()*0.4)) - Math.floor(target.def/2));
        target.curHp = Math.max(0, target.curHp - d);
        hitTexts.push(target.name + 'に' + d + 'ダメージ');
        records.push({ idx: festBattleEnemies.indexOf(target), d: d });
    });
    curry.curHp = Math.max(0, curry.curHp - selfDmg);
    festLogAppend('🌶️🔥 ' + playerName + 'のヒリヒリクラッシュ！全ての敵に攻撃！' + hitTexts.join(' / '));
    festLogAppend('🌶️ 反動で' + playerName + 'にも' + selfDmg + 'ダメージ！');
    festTriggerDamagePop('player', 0, selfDmg, '#e74c3c');
    records.forEach(function(rec, i) {
        setTimeout(function() {
            festTriggerDamagePop('enemy', rec.idx, rec.d, '#e74c3c');
            festUpdateAllHpDisplays();
        }, battleDelay(i * 150));
    });
    festUpdateAllHpDisplays();
    setTimeout(done, battleDelay(900));
}
// 攻撃側（自分のカレー or 雇用中の仲間）が肉系かどうかを判定（陽だまり野菜のご隠居のmeatResistant判定で使用）
function festIsAttackerMeatBased(unitType, curry) {
    if(unitType === 'curry') return isMeatBasedCurry(curry);
    const allyDef = getFestAllyDef(festHiredAllyName);
    return !!(allyDef && allyDef.foodCategory === 'meat');
}
// 自分のカレー（isSeed）の特技：種連続発射（タッグ戦の同フラグと同じ計算式・演出。演出はタッグ戦のplayTanemakiAnimationを共用）
function festCurrySeedAttack(curry, callback) {
    const done = callback || function(){};
    const aliveEnemies = festBattleEnemies.filter(function(e){ return e.curHp > 0; });
    if(aliveEnemies.length === 0) { done(); return; }
    // 自分のカレー本体の種連続発射：婆ちゃんBotとは別イラスト（タッグ戦のSEED_PLAYER_ALLY_CONFIGと同じ）。自分は味方側なのでbgもhomerun_bg.png
    playTanemakiAnimation(SEED_PLAYER_ALLY_CONFIG, false, function() {
        const avgEnemySpd = aliveEnemies.reduce(function(a,e){ return a + e.spd; }, 0) / aliveEnemies.length;
        const curSpd = festCurryStatWithTableware(curry.spd, 'spd');
        const atk = festCurryStatWithTableware(curry.atk, 'atk') * ((festPlayerAtkDownActive || festPlayerAtkDownTurns > 0) ? 0.7 : 1) + (festSpicyBuffActive ? 40 : 0);
        const hits = rollSeedHits(curSpd, avgEnemySpd);
        let total = 0;
        let spicyCount = 0;
        const records = [];
        for(let h = 0; h < hits; h++) {
            const pick = pickLivingFestEnemyWithIdx();
            if(!pick) break;
            let d = Math.max(2, Math.round(atk*0.4 - pick.enemy.def/4));
            d = Math.round(d * (0.9 + Math.random()*0.2));
            if(Math.random() < getCritRate(curSpd, avgEnemySpd)) { d = Math.round(d*2); spicyCount++; }
            // 陽だまり野菜のご隠居（meatResistant）：肉系カレーからの攻撃を大幅軽減
            if(pick.enemy.meatResistant && isMeatBasedCurry(curry)) d = Math.round(d * 0.2);
            pick.enemy.curHp = Math.max(0, pick.enemy.curHp - d);
            total += d;
            records.push({ idx: pick.idx, name: pick.enemy.name, d: d });
        }
        // ダメージポップ・ログの出方はタッグ戦の種連続発射と同じ（1発ずつ220ms間隔でポップ→最後に内訳を集計表示）
        festLogAppend('🌱 ' + playerName + 'の種連続発射 ' + hits + '連撃！' + (spicyCount > 0 ? (' 🌶️ SpicyHit×' + spicyCount + '！') : ''));
        playSoundEffect('machine-gun.mp3');
        records.forEach(function(r, i) {
            setTimeout(function() {
                festTriggerDamagePop('enemy', r.idx, r.d, '#f1c40f');
                festUpdateAllHpDisplays();
                if(i === records.length - 1) {
                    const summary = {};
                    records.forEach(function(rec) {
                        if(!summary[rec.idx]) summary[rec.idx] = { name: rec.name, count: 0, dmg: 0 };
                        summary[rec.idx].count++;
                        summary[rec.idx].dmg += rec.d;
                    });
                    const summaryText = Object.keys(summary).map(function(k){ return summary[k].name + 'に' + summary[k].count + '回(' + summary[k].dmg + 'ダメージ)'; }).join(' / ');
                    festLogAppend(summaryText + ' 合計: ' + total + ' ダメージ！');
                }
            }, battleDelay(i * 220));
        });
        setTimeout(done, battleDelay(records.length * 220 + 300));
    });
}
// 仲間「種まき婆ちゃん」の特技：種連続発射（タッグ戦の同名Botと同じ計算式・演出。演出はタッグ戦のplayTanemakiAnimationを共用）
function festAllySeedAttack(allyStats, callback) {
    const done = callback || function(){};
    const aliveEnemies = festBattleEnemies.filter(function(e){ return e.curHp > 0; });
    if(aliveEnemies.length === 0) { done(); return; }
    // 種まき婆ちゃんは味方（雇用中の仲間）として出るため、タッグ戦のTANEMAKI_TAG_ALLY_CONFIG（bgはhomerun_bg.png）を使う
    playTanemakiAnimation(TANEMAKI_TAG_ALLY_CONFIG, false, function() {
        const avgEnemySpd = aliveEnemies.reduce(function(a,e){ return a + e.spd; }, 0) / aliveEnemies.length;
        const hits = rollSeedHits(allyStats.spd, avgEnemySpd);
        let total = 0;
        let spicyCount = 0;
        const records = [];
        for(let h = 0; h < hits; h++) {
            const pick = pickLivingFestEnemyWithIdx();
            if(!pick) break;
            let d = Math.max(2, Math.round(allyStats.atk*0.4 - pick.enemy.def/4));
            d = Math.round(d * (0.9 + Math.random()*0.2));
            if(Math.random() < getCritRate(allyStats.spd, avgEnemySpd)) { d = Math.round(d*2); spicyCount++; }
            // 陽だまり野菜のご隠居（meatResistant）：肉系仲間からの攻撃を大幅軽減
            if(pick.enemy.meatResistant && festIsAttackerMeatBased('ally', null)) d = Math.round(d * 0.2);
            pick.enemy.curHp = Math.max(0, pick.enemy.curHp - d);
            total += d;
            records.push({ idx: pick.idx, name: pick.enemy.name, d: d });
        }
        festLogAppend('🌱 ' + festHiredAllyName + 'の種連続発射 ' + hits + '連撃！' + (spicyCount > 0 ? (' 🌶️ SpicyHit×' + spicyCount + '！') : ''));
        playSoundEffect('machine-gun.mp3');
        records.forEach(function(r, i) {
            setTimeout(function() {
                festTriggerDamagePop('enemy', r.idx, r.d, '#f1c40f');
                festUpdateAllHpDisplays();
                if(i === records.length - 1) {
                    const summary = {};
                    records.forEach(function(rec) {
                        if(!summary[rec.idx]) summary[rec.idx] = { name: rec.name, count: 0, dmg: 0 };
                        summary[rec.idx].count++;
                        summary[rec.idx].dmg += rec.d;
                    });
                    const summaryText = Object.keys(summary).map(function(k){ return summary[k].name + 'に' + summary[k].count + '回(' + summary[k].dmg + 'ダメージ)'; }).join(' / ');
                    festLogAppend(summaryText + ' 合計: ' + total + ' ダメージ！');
                }
            }, battleDelay(i * 220));
        });
        setTimeout(done, battleDelay(records.length * 220 + 300));
    });
}
// 仲間「ドラゴン料理長」の特技：熱々ブレス（タッグ戦の同名Botと同じ計算式・演出。敵全体にDEF無視固定ダメージ。演出はタッグ戦のplayTanemakiAnimationを共用）
function festAllyBreathAttack(allyStats, callback) {
    const done = callback || function(){};
    const aliveEnemies = festBattleEnemies.filter(function(e){ return e.curHp > 0; });
    if(aliveEnemies.length === 0) { done(); return; }
    // ドラゴン料理長は味方（雇用中の仲間）として出るため、タッグ戦のDRAGON_TAG_ALLY_CONFIG（bgはhomerun_bg.png）を使う
    playTanemakiAnimation(DRAGON_TAG_ALLY_CONFIG, false, function() {
        festBattleEnemies.forEach(function(e, idx) {
            if(e.curHp <= 0) return;
            // 陽だまり野菜のご隠居（meatResistant）：肉系仲間（ドラゴン料理長）からの攻撃を大幅軽減
            const bd = (e.meatResistant && festIsAttackerMeatBased('ally', null)) ? Math.round(40 * 0.2) : 40;
            e.curHp = Math.max(0, e.curHp - bd);
            festTriggerDamagePop('enemy', idx, bd, '#e74c3c');
        });
        festLogSet('🔥 ' + festHiredAllyName + 'の熱々ブレス！敵全体にDEF無視ダメージ！');
        playSoundEffect('breath.mp3');
        festUpdateAllHpDisplays();
        done();
    });
}
// レベルアップで習得する仲間特技の演出設定（キャラ画像はuser指定のbattle/bt_〇〇.png。仲間側なのでbgはhomerun_bg.png）
const TAKASHI_SKILL_ANIM_CONFIG = { charaImg:'battle/bt_takashi.png', chara2Img:null, bgImg:'battle/homerun_bg.png', charaTop:'55%', charaWidth:'60%', charaMaxScale:1.2 };
const REON_SKILL_ANIM_CONFIG    = { charaImg:'battle/bt_reon.png',    chara2Img:null, bgImg:'battle/homerun_bg.png', charaTop:'55%', charaWidth:'60%', charaMaxScale:1.2 };
const GANKO_SKILL_ANIM_CONFIG   = { charaImg:'battle/bt_ganko.png',   chara2Img:null, bgImg:'battle/homerun_bg.png', charaTop:'55%', charaWidth:'60%', charaMaxScale:1.2 };
const KYUTEI_SKILL_ANIM_CONFIG  = { charaImg:'battle/bt_kyutei.png',  chara2Img:null, bgImg:'battle/homerun_bg.png', charaTop:'55%', charaWidth:'60%', charaMaxScale:1.2 };
function festAllyNamedSkillAnimConfig(allyDef) {
    switch(allyDef.name) {
        case '見習い料理人タカシ': return TAKASHI_SKILL_ANIM_CONFIG;
        case '魔術師レオン': return REON_SKILL_ANIM_CONFIG;
        case 'ガンコ親父': return GANKO_SKILL_ANIM_CONFIG;
        case '宮廷カレー長': return KYUTEI_SKILL_ANIM_CONFIG;
        default: return TANEMAKI_TAG_ALLY_CONFIG;
    }
}
// レベルアップ習得技のうち、発動抽選そのものに前提条件があるものだけ判定する（それ以外はtrue＝chanceのみで発動判定）
function festAllySkillConditionMet(allyDef) {
    if(!allyDef || !allyDef.skill) return false;
    if(allyDef.skill.type === 'healLowestHp') {
        // タカシ「栄養満点ベジスープ」：自分（プレイヤーのカレー）or味方（仲間本人）でHPが75%以下のキャラがいる時のみ発動抽選の対象にする
        const curry = festCurryStock[festActiveCurryIdx];
        const curryPct = (curry && curry.hp > 0) ? curry.curHp / curry.hp : 1;
        const allyMaxHp = getFestAllyCurrentStats(festHiredAllyName).hp;
        const allyHp = (festAllyHp === null) ? allyMaxHp : festAllyHp;
        const allyPct = allyMaxHp > 0 ? allyHp / allyMaxHp : 1;
        return curryPct <= 0.75 || allyPct <= 0.75;
    }
    return true;
}
// レベルアップで習得した仲間特技（タカシ・レオン・ガンコ親父・宮廷カレー長）の効果本体
function festAllyUseNamedSkill(allyDef, allyStats, callback) {
    const done = callback || function(){};
    const skill = allyDef.skill;
    playTanemakiAnimation(festAllyNamedSkillAnimConfig(allyDef), false, function() {
        // 見習い料理人タカシ「栄養満点ベジスープ」：自分or味方でHPが少ない方（現在HPの生値で比較）の最大HPの20%+100回復
        if(skill.type === 'healLowestHp') {
            festAllySkillUsedThisBattle[allyDef.name] = true;
            const curry = festCurryStock[festActiveCurryIdx];
            const curryAlive = curry && curry.curHp > 0;
            const allyMaxHp = allyStats.hp;
            const allyAlive = festAllyHp > 0;
            const allyHp = (festAllyHp === null) ? allyMaxHp : festAllyHp;
            let healToAlly;
            if(curryAlive && allyAlive) healToAlly = allyHp < curry.curHp;
            else healToAlly = allyAlive;
            const targetMaxHp = healToAlly ? allyMaxHp : (curry ? curry.hp : 0);
            const healAmt = Math.round(targetMaxHp * 0.20) + 100;
            if(healToAlly) {
                festAllyHp = Math.min(allyMaxHp, allyHp + healAmt);
                festTriggerDamagePop('player', 1, -healAmt, '#2ecc71');
                festLogSet('🍲 ' + allyDef.name + 'の' + skill.name + '！ ' + festHiredAllyName + 'のHPが' + healAmt + '回復！');
            } else if(curry) {
                curry.curHp = Math.min(curry.hp, curry.curHp + healAmt);
                festTriggerDamagePop('player', 0, -healAmt, '#2ecc71');
                festLogSet('🍲 ' + allyDef.name + 'の' + skill.name + '！ ' + playerName + 'のHPが' + healAmt + '回復！');
            }
            playSoundEffect(skill.sound || 'healing.mp3');
            festUpdateAllHpDisplays();
            done();
            return;
        }
        // 魔術師レオン「念力ボール」：固定80ダメージ（ATK・DEF・ATKダウンを一切参照しない＝影響を受けない）
        if(skill.type === 'fixedDamage') {
            const pick = pickLivingFestEnemyWithIdx();
            if(!pick) { done(); return; }
            const target = pick.enemy;
            const d = skill.value;
            target.curHp = Math.max(0, target.curHp - d);
            festTriggerDamagePop('enemy', pick.idx, d, '#9b59b6');
            festLogSet('🔮 ' + festHiredAllyName + 'の' + skill.name + '！ ' + target.name + 'に固定' + d + 'ダメージ！');
            playSoundEffect(skill.sound || 'breath.mp3');
            festUpdateAllHpDisplays();
            done();
            return;
        }
        // ガンコ親父「頑固割り拳」：通常攻撃+DEF30%ダウン（2回まで重ねがけで最大60%、5ターンで解除）
        if(skill.type === 'attackPlusDefDown') {
            const pick = pickLivingFestEnemyWithIdx();
            if(!pick) { done(); return; }
            const target = pick.enemy;
            const atk = allyStats.atk * ((festAllyAtkDownActive || festAllyAtkDownTurns > 0) ? 0.7 : 1) + (festSpicyBuffActive ? 40 : 0);
            const isCrit = Math.random() < getCritRate(allyStats.spd, target.spd);
            let d = isCrit ? Math.max(8, Math.round(atk)) : Math.max(8, Math.round(atk) - Math.floor(target.def/2));
            d = Math.round(d * (0.9 + Math.random()*0.2));
            if(target.meatResistant && festIsAttackerMeatBased('ally', null)) d = Math.round(d * 0.2);
            target.curHp = Math.max(0, target.curHp - d);
            if(target.baseDefForDownCalc === undefined) target.baseDefForDownCalc = target.def;
            target.defDownStacks = Math.min(skill.maxStacks, (target.defDownStacks || 0) + 1);
            target.defDownTurns = skill.duration;
            target.def = Math.round(target.baseDefForDownCalc * (1 - skill.defDownPct * target.defDownStacks));
            festTriggerDamagePop('enemy', pick.idx, d, isCrit ? '#ff4500' : '#f1c40f');
            festLogSet((isCrit ? ('🌶️ ' + festHiredAllyName + ' の Spicy Hit!!!! ') : ('👊 ' + festHiredAllyName + 'の')) + skill.name + '！ ' + target.name + 'に' + d + 'ダメージ、DEFが' + Math.round(skill.defDownPct * target.defDownStacks * 100) + '%ダウン！');
            playSoundEffect(skill.sound || 'punch.mp3');
            festUpdateAllHpDisplays();
            done();
            return;
        }
        // 宮廷カレー長「宮廷流水花麗」：ダメージ0.5倍+ダメージを受けた敵は次の行動を1回休み
        if(skill.type === 'halfDamageSkipTurn') {
            const pick = pickLivingFestEnemyWithIdx();
            if(!pick) { done(); return; }
            const target = pick.enemy;
            const atk = allyStats.atk * ((festAllyAtkDownActive || festAllyAtkDownTurns > 0) ? 0.7 : 1) + (festSpicyBuffActive ? 40 : 0);
            const isCrit = Math.random() < getCritRate(allyStats.spd, target.spd);
            let d = isCrit ? Math.max(8, Math.round(atk)) : Math.max(8, Math.round(atk) - Math.floor(target.def/2));
            d = Math.round(d * 0.5);
            if(target.meatResistant && festIsAttackerMeatBased('ally', null)) d = Math.round(d * 0.2);
            target.curHp = Math.max(0, target.curHp - d);
            target.skipNextTurn = true;
            festTriggerDamagePop('enemy', pick.idx, d, isCrit ? '#ff4500' : '#3498db');
            festLogSet('💧 ' + festHiredAllyName + 'の' + skill.name + '！ ' + target.name + 'に' + d + 'ダメージ、次の行動を1回休み！');
            playSoundEffect(skill.sound || 'wave.mp3');
            festUpdateAllHpDisplays();
            done();
            return;
        }
        done();
    });
}
function festEnemyActAttackSimple(e, curry, allyStats) {
    const targets = [];
    if(curry && curry.curHp > 0) targets.push({ type:'curry', idx:0 });
    if(allyStats && festAllyHp > 0) targets.push({ type:'ally', idx:1 });
    if(targets.length === 0) return;
    const t = targets[Math.floor(Math.random() * targets.length)];
    const targetDef = t.type === 'curry' ? festCurryStatWithTableware(curry.def, 'def') : allyStats.def;
    const targetSpd = t.type === 'curry' ? festCurryStatWithTableware(curry.spd, 'spd') : allyStats.spd;
    const targetName = t.type === 'curry' ? playerName : festHiredAllyName;
    const isCrit = Math.random() < getCritRate(e.spd, targetSpd);
    let d = isCrit ? Math.max(8, e.atk) : Math.max(8, e.atk - Math.floor(targetDef/2));
    d = Math.round(d * (0.9 + Math.random()*0.2));
    // ラタトゥイユカレー（isRatatouille）：肉系カテゴリの敵からの攻撃を大幅軽減（タッグ戦のisMeatBasedCurryと同じ考え方）
    if(t.type === 'curry' && curry && curry.isRatatouille && e.category === 'meat') d = Math.round(d * 0.2);
    // 🥚ふわとろオム／👑世界三大珍味：抽選済みの系統と一致する敵からの攻撃を70%に軽減
    let festFluffyBlockedSimple = false;
    if(t.type === 'curry' && festCurryFluffyCategory && e.category === festCurryFluffyCategory) { d = Math.round(d * 0.7); festFluffyBlockedSimple = true; }
    applyFestDamageToPlayer(t.type, d, curry);
    festTriggerDamagePop('player', t.idx, d, isCrit ? '#ff4500' : '#e74c3c');
    festLogAppend(isCrit ? ('🌶️ ' + e.name + ' の Spicy Hit!!!! ' + targetName + ' に ' + d + ' ダメージ！') : ('💥 ' + e.name + 'の追撃！ ' + targetName + 'に' + d + 'ダメージ！'));
    if(festFluffyBlockedSimple) festLogAppend('🥚 ' + getBarrierLabel(curry) + 'により' + FEST_FLUFFY_CATEGORY_LABEL[festCurryFluffyCategory] + 'からの攻撃を軽減');
    playSoundEffect('punch.mp3');
    festUpdateAllHpDisplays();
}
// 敵スキル発動時の技演出設定を作る（タッグ戦のplayTanemakiAnimationを共用。キャラ画像は発動した敵自身の画像を使う）
function festEnemySkillAnimConfig(e) {
    // 技演出専用の高解像度イラスト（battle/bt-bot13〜20.png）を使う。カード用アイコン（botimage/botNN.png）と番号が対応。
    const charaImg = e.image.replace('botimage/bot', 'battle/bt-bot');
    return { charaImg: charaImg, chara2Img: null, bgImg: 'battle/homerun_bg2.png', charaTop: '55%', charaWidth: '55%', charaMaxScale: 1.2 };
}
function festEnemyActAttack(e, curry, allyStats, enemyIdx, callback) {
    const done = callback || function(){};
    // 宮廷カレー長「宮廷流水花麗」で付与されたskipNextTurn：この行動を消費して1回休みにする
    if(e.skipNextTurn) {
        e.skipNextTurn = false;
        festLogSet('💤 ' + e.name + 'は行動を1回休んだ！');
        done();
        return;
    }
    // 幻惑状態（仲間「イカ星人グニョグニョ」の特技／自分のカレーのisIllusionで付与）：タッグ戦と同じミス判定
    if(e.isIlluded) {
        const aliveSpds = [];
        if(curry && curry.curHp > 0) aliveSpds.push(curry.spd);
        if(allyStats && festAllyHp > 0) aliveSpds.push(allyStats.spd);
        const avgSpd = aliveSpds.length ? aliveSpds.reduce(function(a,b){ return a+b; },0)/aliveSpds.length : 50;
        if(Math.random() < getIllusionMissRate(e.spd, avgSpd)) {
            playSoundEffect('sound/miss.mp3');
            festLogSet('💨 ' + e.name + 'は幻惑で攻撃が外れた！');
            done();
            return;
        }
    }
    e.turnsActed = (e.turnsActed || 0) + 1;
    const skill = e.skill;
    const unlocked = skill && festSetIndex >= skill.levelReq;

    // ボス「秘伝のスパイス」：HPが50%未満になったら1回だけ、攻撃の代わりに発動（技演出あり）
    if(unlocked && skill.type === 'selfHealLowHp' && !e.selfHealUsed && e.curHp / e.maxHp < 0.5) {
        e.selfHealUsed = true;
        playTanemakiAnimation(festEnemySkillAnimConfig(e), false, function() {
            const healAmt = Math.round(e.maxHp * 0.25);
            e.curHp = Math.min(e.maxHp, e.curHp + healAmt);
            festTriggerDamagePop('enemy', enemyIdx, -healAmt, '#2ecc71');
            festLogSet('👑 ' + e.name + 'は「' + skill.name + '」でHPを' + healAmt + '回復した！');
            playSoundEffect('healing.mp3');
            festUpdateAllHpDisplays();
            done();
        });
        return;
    }

    // 種吹きメロンボーイ「種連続発射」：通常攻撃の代わりにプレイヤー側へ多段攻撃を放つ（技演出あり）
    if(unlocked && skill.type === 'seedAttack' && Math.random() < skill.chance) {
        festEnemySeedAttack(e, curry, allyStats, enemyIdx, done);
        return;
    }

    const targets = [];
    if(curry && curry.curHp > 0) targets.push({ type:'curry', idx:0 });
    if(allyStats && festAllyHp > 0) targets.push({ type:'ally', idx:1 });
    if(targets.length === 0) { done(); return; }
    const t = targets[Math.floor(Math.random() * targets.length)];
    const targetDef = t.type === 'curry' ? festCurryStatWithTableware(curry.def, 'def') : allyStats.def;
    const targetSpd = t.type === 'curry' ? festCurryStatWithTableware(curry.spd, 'spd') : allyStats.spd;
    const targetName = t.type === 'curry' ? playerName : festHiredAllyName;

    let critRate = getCritRate(e.spd, targetSpd);
    if(unlocked && skill.type === 'critUp') critRate += 0.15;
    let isCrit = Math.random() < critRate;
    // ボス「総帥の一撃」：このボスの3回目の行動ごとに必ず会心（技演出あり）
    const periodicCritProc = unlocked && skill.type === 'periodicCrit' && e.turnsActed % 3 === 0;
    if(periodicCritProc) isCrit = true;

    let d = isCrit ? Math.max(8, e.atk) : Math.max(8, e.atk - Math.floor(targetDef/2));
    d = Math.round(d * (0.9 + Math.random()*0.2));

    // 敵は1体につき技を1つしか持たないため同時発動はしない。発動する技があれば先に判定し、演出を挟んでから効果を解決する
    const doubleDamageProc = unlocked && skill.type === 'doubleDamage' && Math.random() < skill.chance;
    const bonusDamageProc  = unlocked && skill.type === 'bonusDamage'  && Math.random() < skill.chance;
    const poisonProc       = unlocked && skill.type === 'poison'       && Math.random() < skill.chance;
    const atkDownProc      = unlocked && skill.type === 'atkDown'      && Math.random() < skill.chance;
    const extraTurnProc    = unlocked && skill.type === 'extraTurn'    && Math.random() < skill.chance;
    const illusionProc     = unlocked && skill.type === 'illusion'     && Math.random() < skill.chance;
    const anySkillProc = doubleDamageProc || bonusDamageProc || poisonProc || atkDownProc || extraTurnProc || periodicCritProc || illusionProc;

    function resolveAttack() {
        let skillMsg = '';
        let homerunNegated = false;
        if(doubleDamageProc) { d = Math.round(d*2); skillMsg = '「' + skill.name + '」発動！ダメージ2倍！'; }
        if(bonusDamageProc) {
            // ホームランカレー（isHomerun）：「スパイス爆発」発動時のみ、一定確率で打ち返して無効化できる
            if(t.type === 'curry' && curry && curry.isHomerun && isHomerunReflect(festCurryStatWithTableware(curry.spd, 'spd'), e.spd)) {
                homerunNegated = true;
            } else {
                d = Math.round(d*1.5); skillMsg = '「' + skill.name + '」発動！ダメージ1.5倍！';
            }
        }
        if(homerunNegated) {
            playSoundEffect('sound/homerun.mp3');
            festLogSet('🏏 ホームラン！' + targetName + 'が「' + skill.name + '」を打ち返して無効化！');
            festUpdateAllHpDisplays();
            done();
            return;
        }
        // ラタトゥイユカレー（isRatatouille）：肉系カテゴリの敵からの攻撃を大幅軽減（タッグ戦のisMeatBasedCurryと同じ考え方）
        if(t.type === 'curry' && curry && curry.isRatatouille && e.category === 'meat') d = Math.round(d * 0.2);
        // 🥚ふわとろオム／👑世界三大珍味：抽選済みの系統と一致する敵からの攻撃を70%に軽減（タッグ戦のtagFluffyBlockedと同じ考え方）
        let festFluffyBlocked = false;
        if(t.type === 'curry' && festCurryFluffyCategory && e.category === festCurryFluffyCategory) { d = Math.round(d * 0.7); festFluffyBlocked = true; }
        applyFestDamageToPlayer(t.type, d, curry);
        festTriggerDamagePop('player', t.idx, d, isCrit ? '#ff4500' : '#e74c3c');
        festLogSet((isCrit ? ('🌶️ ' + e.name + ' の Spicy Hit!!!! ' + targetName + ' に ' + d + ' ダメージ！') : ('💥 ' + e.name + 'の攻撃！ ' + targetName + 'に' + d + 'ダメージ！')) + (skillMsg ? '（' + skillMsg + '）' : ''));
        if(festFluffyBlocked) festLogAppend('🥚 ' + getBarrierLabel(curry) + 'により' + FEST_FLUFFY_CATEGORY_LABEL[festCurryFluffyCategory] + 'からの攻撃を軽減');
        playSoundEffect('punch.mp3');
        festUpdateAllHpDisplays();

        if(poisonProc) {
            if(t.type === 'curry') festPlayerPoisoned = true; else festAllyPoisoned = true;
            festLogAppend('☠️ ' + targetName + 'は「' + skill.name + '」で毒状態になった！');
            const nameEl = document.getElementById('festPlayerName' + t.idx);
            if(nameEl) nameEl.classList.add('name-poisoned');
            playSoundEffect('poison.mp3');
        }
        if(atkDownProc) {
            if(skill.duration) {
                // 時限式ATKダウン（のほほんオーラ等）：重ねがけしても延長・重複はせず、残りターン数を常にskill.durationへ上書きするだけ
                if(t.type === 'curry') festPlayerAtkDownTurns = skill.duration; else festAllyAtkDownTurns = skill.duration;
                festLogAppend('📉 ' + targetName + 'は「' + skill.name + '」でATKが' + skill.duration + 'ターンダウンした！');
            } else {
                if(t.type === 'curry') festPlayerAtkDownActive = true; else festAllyAtkDownActive = true;
                festLogAppend('📉 ' + targetName + 'は「' + skill.name + '」でATKがダウンした！');
            }
        }
        if(illusionProc) {
            if(t.type === 'curry') festPlayerIlluded = true; else festAllyIlluded = true;
            festLogAppend('🌀 ' + targetName + 'は「' + skill.name + '」で幻惑状態になった！');
            const nameEl2 = document.getElementById('festPlayerName' + t.idx);
            if(nameEl2) nameEl2.classList.add('name-illuded');
            playSoundEffect('sound/miss.mp3');
        }
        if(extraTurnProc) {
            festLogAppend('💨 ' + e.name + 'は「' + skill.name + '」でもう一度攻撃する！');
            if(!checkFestBattleEndSilent()) festEnemyActAttackSimple(e, curry, allyStats);
        }
        done();
    }

    if(anySkillProc) {
        playTanemakiAnimation(festEnemySkillAnimConfig(e), false, resolveAttack);
    } else {
        resolveAttack();
    }
}
// 種吹きメロンボーイの特技：種連続発射（プレイヤー側を対象にした多段攻撃。自分のカレー／仲間の種連続発射と同じ計算式・演出）
function festEnemySeedAttack(e, curry, allyStats, enemyIdx, callback) {
    const done = callback || function(){};
    const targets = [];
    if(curry && curry.curHp > 0) targets.push({ type:'curry', idx:0 });
    if(allyStats && festAllyHp > 0) targets.push({ type:'ally', idx:1 });
    if(targets.length === 0) { done(); return; }
    playTanemakiAnimation(festEnemySkillAnimConfig(e), false, function() {
        const targetSpds = targets.map(function(t){ return t.type === 'curry' ? festCurryStatWithTableware(curry.spd, 'spd') : allyStats.spd; });
        const avgTargetSpd = targetSpds.reduce(function(a,b){ return a+b; },0) / targetSpds.length;
        const hits = rollSeedHits(e.spd, avgTargetSpd);
        let total = 0;
        let spicyCount = 0;
        const records = [];
        for(let h = 0; h < hits; h++) {
            const liveTargets = targets.filter(function(t){ return t.type === 'curry' ? (curry && curry.curHp > 0) : (festAllyHp > 0); });
            if(liveTargets.length === 0) break;
            const t = liveTargets[Math.floor(Math.random() * liveTargets.length)];
            const targetDef = t.type === 'curry' ? festCurryStatWithTableware(curry.def, 'def') : allyStats.def;
            let d = Math.max(2, Math.round(e.atk*0.4 - targetDef/4));
            d = Math.round(d * (0.9 + Math.random()*0.2));
            if(Math.random() < getCritRate(e.spd, avgTargetSpd)) { d = Math.round(d*2); spicyCount++; }
            // ラタトゥイユカレー（isRatatouille）：肉系カテゴリの敵からの攻撃を大幅軽減（種吹きメロンボーイは果物系のため対象外）
            if(t.type === 'curry' && curry && curry.isRatatouille && e.category === 'meat') d = Math.round(d * 0.2);
            // 🥚ふわとろオム／👑世界三大珍味：抽選済みの系統と一致する敵からの攻撃を70%に軽減
            if(t.type === 'curry' && festCurryFluffyCategory && e.category === festCurryFluffyCategory) d = Math.round(d * 0.7);
            applyFestDamageToPlayer(t.type, d, curry);
            total += d;
            records.push({ idx: t.idx, name: (t.type === 'curry' ? playerName : festHiredAllyName), d: d });
        }
        festLogAppend('🍈 ' + e.name + 'の種連続発射 ' + hits + '連撃！' + (spicyCount > 0 ? (' 🌶️ SpicyHit×' + spicyCount + '！') : ''));
        playSoundEffect('machine-gun.mp3');
        records.forEach(function(r, i) {
            setTimeout(function() {
                festTriggerDamagePop('player', r.idx, r.d, '#e74c3c');
                festUpdateAllHpDisplays();
                if(i === records.length - 1) {
                    const summary = {};
                    records.forEach(function(rec) {
                        if(!summary[rec.idx]) summary[rec.idx] = { name: rec.name, count: 0, dmg: 0 };
                        summary[rec.idx].count++;
                        summary[rec.idx].dmg += rec.d;
                    });
                    const summaryText = Object.keys(summary).map(function(k){ return summary[k].name + 'に' + summary[k].count + '回(' + summary[k].dmg + 'ダメージ)'; }).join(' / ');
                    festLogAppend(summaryText + ' 合計: ' + total + ' ダメージ！');
                }
            }, battleDelay(i * 220));
        });
        setTimeout(done, battleDelay(records.length * 220 + 300));
    });
}
// 追撃前チェック用（画面更新・勝敗確定はメインループ側でまとめて行うため、ここでは真偽だけ返す）
function checkFestBattleEndSilent() {
    const curry = festCurryStock[festActiveCurryIdx];
    const curryAlive = curry && curry.curHp > 0;
    const allyAlive = festHiredAllyName && festAllyHp > 0;
    const enemiesAlive = festBattleEnemies.some(function(e){ return e.curHp > 0; });
    return !enemiesAlive || (!curryAlive && !allyAlive && getFestActiveCurryIndex() === -1);
}
function checkFestBattleEnd() {
    let curry = festCurryStock[festActiveCurryIdx];
    // HPが0になったカレーはストック（festCurryStock）から消費して取り除く。生存カレーの並び順は維持する。
    const survivors = festCurryStock.filter(function(c){ return c.curHp > 0; });
    const stillHasCurrentCurry = curry && curry.curHp > 0 && survivors.indexOf(curry) !== -1;
    festCurryStock = survivors;
    if(stillHasCurrentCurry) {
        festActiveCurryIdx = festCurryStock.indexOf(curry);
    } else if(festCurryStock.length > 0) {
        // 出撃中のカレーが力尽きたが、他に出せるカレーがある→自動選択せず、プレイヤーに選ばせる（オートバトルを一時停止）
        festActiveCurryIdx = -1;
        curry = null;
        festUpdateAllHpDisplays();
        const allyAliveNow = festHiredAllyName && festAllyHp > 0;
        const enemiesAliveNow = festBattleEnemies.some(function(e){ return e.curHp > 0; });
        if(!enemiesAliveNow) { festBattleWin(); return true; }
        saveFestState();
        festPromptCurrySwap(function(){ festBattleAutoStep(); });
        return true;
    } else {
        festActiveCurryIdx = -1;
        curry = null;
    }
    const curryAlive = curry && curry.curHp > 0;
    const allyAlive = festHiredAllyName && festAllyHp > 0;
    const enemiesAlive = festBattleEnemies.some(function(e){ return e.curHp > 0; });
    festUpdateAllHpDisplays();
    if(!enemiesAlive) { festBattleWin(); return true; }
    if(!curryAlive && !allyAlive) { festBattleLoseRun(); return true; }
    return false;
}
// 出撃中カレーが力尽きた時、次に出すカレーをプレイヤーに選ばせるモーダル（choose後にcallbackでオートバトル再開）
let festCurrySwapCallback = null;
function festPromptCurrySwap(callback) {
    const list = document.getElementById('festCurrySwapList');
    if(list) {
        list.innerHTML = festCurryStock.map(function(c, idx) {
            return '<button class="btn-cook-sub" style="width:100%;" onclick="chooseFestCurrySwap(' + idx + ')">' + c.name + '（HP' + c.curHp + '/' + c.hp + '）</button>';
        }).join('');
    }
    const overlay = document.getElementById('festCurrySwapOverlay');
    if(overlay) overlay.style.display = 'flex';
    festCurrySwapCallback = callback;
}
function chooseFestCurrySwap(idx) {
    const curry = festCurryStock[idx];
    if(!curry) return;
    festActiveCurryIdx = idx;
    const overlay = document.getElementById('festCurrySwapOverlay');
    if(overlay) overlay.style.display = 'none';
    // 力尽きた前のカレーが受けていたデバフ（毒・幻惑・ATKダウン）は、新しく出撃するカレーには引き継がない
    festPlayerPoisoned = false;
    festPlayerIlluded = false;
    festPlayerAtkDownActive = false;
    festPlayerAtkDownTurns = 0;
    const nameEl0 = document.getElementById('festPlayerName0');
    if(nameEl0) nameEl0.classList.remove('name-poisoned', 'name-illuded');
    const n0 = document.getElementById('festPlayerCurryName0');
    if(n0) n0.innerText = curry.name;
    const card0 = document.getElementById('festPlayerCard0');
    if(card0) card0.classList.remove('ko');
    // 🥚ふわとろオム／👑世界三大珍味：交代後のカレー自身の特性で軽減対象の系統を改めて抽選し直す
    festCurryFluffyCategory = (curry.isFluffyOmelette || curry.isTriCaviar)
        ? FEST_FLUFFY_CATEGORY_KEYS[Math.floor(Math.random() * FEST_FLUFFY_CATEGORY_KEYS.length)]
        : null;
    if(festCurryFluffyCategory) {
        festLogAppend('🥚 ' + curry.name + 'は' + getBarrierLabel(curry) + 'により' + FEST_FLUFFY_CATEGORY_LABEL[festCurryFluffyCategory] + 'からの攻撃を軽減する！');
        setTimeout(function() { playSoundEffect('healing.mp3'); triggerFestFluffyBarrierEffect('player', 0); }, 500);
    }
    festLogAppend('🍛 ' + curry.name + 'が代わりに出撃した！');
    festUpdateAllHpDisplays();
    saveFestState();
    const cb = festCurrySwapCallback;
    festCurrySwapCallback = null;
    if(cb) cb();
}
function festBuildRoundQueue() {
    const curry = festCurryStock[festActiveCurryIdx];
    const allyStats = festHiredAllyName ? getFestAllyCurrentStats(festHiredAllyName) : null;
    if(allyStats && festAllyHp === null) festAllyHp = allyStats.hp;
    const combatants = [];
    if(curry && curry.curHp > 0) combatants.push({ side:'player', unit:'curry', spd: festCurryStatWithTableware(curry.spd, 'spd') });
    if(allyStats && festAllyHp > 0) combatants.push({ side:'player', unit:'ally', spd: allyStats.spd });
    festBattleEnemies.forEach(function(e, idx){ if(e.curHp > 0) combatants.push({ side:'enemy', idx: idx, spd: e.spd }); });
    // ネバネバ特技（カレーのisSticky）：タッグ戦と同じく初回ラウンドのみ自分側を強制的に先攻にする
    if(festBattleTurnCount === 1 && curry && curry.isSticky) {
        const playerSide = combatants.filter(function(c){ return c.side === 'player'; }).sort(function(a,b){ return b.spd - a.spd; });
        const enemySide = combatants.filter(function(c){ return c.side === 'enemy'; }).sort(function(a,b){ return b.spd - a.spd; });
        return playerSide.concat(enemySide);
    }
    combatants.sort(function(a,b){ return (b.spd - a.spd) || (Math.random()-0.5); });
    return combatants;
}
// タッグ戦のstep()同様、1体ずつ行動→delay→次、を自動で繰り返す（再生速度はbattleSpeedMultiplierを共用）
function festBattleAutoStep() {
    if(!festBattleInProgress) return;
    if(festBattleQueue.length === 0) {
        applyFestPoisonTick();
        festTickAtkDownTurns();
        festTickEnemyDefDownTurns();
        if(checkFestBattleEnd()) return;
        festBattleTurnCount++;
        festBattleQueue = festBuildRoundQueue();
        if(festBattleQueue.length === 0) return;
        setTimeout(festBattleAutoStep, battleDelay(500));
        return;
    }
    const actor = festBattleQueue.shift();
    const curry = festCurryStock[festActiveCurryIdx];
    const allyStats = festHiredAllyName ? getFestAllyCurrentStats(festHiredAllyName) : null;
    // 種連続発射・熱々ブレスはタッグ戦と同じ演出（playTanemakiAnimation）を挟むため非同期。
    // 演出完了後のコールバックで戦闘終了判定・保存・次ターン予約を行う。
    function afterAction() {
        // checkFestBattleEnd()内でHP0のカレーをストックから消費するため、必ずこの後にsaveFestState()する
        if(checkFestBattleEnd()) return;
        saveFestState();
        setTimeout(festBattleAutoStep, battleDelay(900));
    }
    if(actor.side === 'player') {
        if(actor.unit === 'curry' && curry && curry.curHp > 0) { festPlayerActAttack('curry', curry, allyStats, afterAction); return; }
        if(actor.unit === 'ally' && festAllyHp > 0) { festPlayerActAttack('ally', curry, allyStats, afterAction); return; }
        afterAction();
    } else {
        const e = festBattleEnemies[actor.idx];
        if(e && e.curHp > 0) { festEnemyActAttack(e, curry, allyStats, actor.idx, afterAction); return; }
        afterAction();
    }
}
// タッグ戦のtagBattleResultOverlay同様、勝敗が決まったら大きく結果を表示してから下の結果ボックスを開く
function festShowBattleResultOverlay(text, color, thenShowBox) {
    const overlay = document.getElementById('festBattleResultOverlay');
    const big = document.getElementById('festBattleResultBig');
    if(overlay && big) {
        big.innerText = text;
        big.style.color = color;
        overlay.style.display = 'flex';
        big.style.animation = 'none';
        void big.offsetWidth;
        big.style.animation = 'resultPop 0.4s ease-out';
    }
    setTimeout(function() {
        if(overlay) overlay.style.display = 'none';
        thenShowBox();
        scrollResultIntoView('festBattlePanel');
    }, battleDelay(1300));
}
function festBattleWin() {
    festBattleInProgress = false;
    festSpicyBuffActive = false;
    festPlayerPoisoned = false; festAllyPoisoned = false;
    festPlayerIlluded = false; festAllyIlluded = false;
    festStopBattleBgm();
    festWinStreak += 1; // 雑魚戦・ボス戦を問わず、1勝ごとに連勝数+1（報酬額の計算は引き続きセット数ベース）
    festUpdatePersonalBestAndIconUnlock();
    if(festBattlePhase <= 3) {
        festAccumulatedReward += festSetIndex * 10;
    } else {
        festAccumulatedReward += festSetIndex * 30;
        festExpSpice += 1;
        festFP += 10;
    }
    updateFestGlobalRecordIfHigher();
    saveFestState();
    updateFestStatusBar();
    playWinSound();
    festShowBattleResultOverlay('WIN!', '#2ecc71', function() {
        const resultText = document.getElementById('festBattleResultText');
        if(resultText) resultText.innerText = '';
        const healCountEl = document.getElementById('festBattleHealCount');
        const spicyCountEl = document.getElementById('festBattleSpicyCount');
        if(healCountEl) healCountEl.innerText = festHealSpice;
        if(spicyCountEl) spicyCountEl.innerText = festSpicySpice;
        // 次にfestBattleContinue()を押した時の遷移先（次の対戦 or 準備画面）に合わせてボタン表記を出し分ける
        const continueBtn = document.getElementById('festBattleContinueBtn');
        if(continueBtn) continueBtn.innerText = (festBattlePhase <= 3) ? '次の対戦へ進む' : '準備画面へ進む';
        document.getElementById('festBattleResultArea').style.display = 'block';
    });
}
function useFestHealSpiceInBattle() {
    if(festHealSpice <= 0) { showCustomAlert('⚠️ 回復スパイスがありません', 'フェスショップで購入してください。'); return; }
    const curry = festCurryStock[festActiveCurryIdx];
    const allyStats = festHiredAllyName ? getFestAllyCurrentStats(festHiredAllyName) : null;
    const curryAlive = curry && curry.curHp > 0;
    const allyAlive = allyStats && festAllyHp > 0;
    if(!curryAlive && !allyAlive) return;
    // カレー・仲間の両方が生存している場合はどちらを回復するか選ばせる（タッグ戦の操作感に合わせる）
    if(curryAlive && allyAlive) {
        const overlay = document.getElementById('festHealTargetOverlay');
        if(overlay) overlay.style.display = 'flex';
        return;
    }
    applyFestHealSpice(curryAlive ? 'curry' : 'ally');
}
function chooseFestHealTarget(type) {
    const overlay = document.getElementById('festHealTargetOverlay');
    if(overlay) overlay.style.display = 'none';
    applyFestHealSpice(type);
}
// キャンセル時は回復スパイスを一切消費せず、モーダルを閉じるだけ
function cancelFestHealTarget() {
    const overlay = document.getElementById('festHealTargetOverlay');
    if(overlay) overlay.style.display = 'none';
}
function applyFestHealSpice(type) {
    const curry = festCurryStock[festActiveCurryIdx];
    const allyStats = festHiredAllyName ? getFestAllyCurrentStats(festHiredAllyName) : null;
    festHealSpice -= 1;
    if(type === 'curry' && curry) {
        curry.curHp = curry.hp;
        festLogAppend('💊 回復スパイス使用：' + playerName + 'のHPが全回復した！');
    } else if(type === 'ally' && allyStats) {
        festAllyHp = allyStats.hp;
        festLogAppend('💊 回復スパイス使用：' + festHiredAllyName + 'のHPが全回復した！');
    }
    const healCountEl = document.getElementById('festBattleHealCount');
    if(healCountEl) healCountEl.innerText = festHealSpice;
    playSoundEffect('healing.mp3');
    saveFestState();
    updateFestStatusBar();
    festUpdateAllHpDisplays();
}
function useFestSpicySpiceInBattle() {
    if(festSpicySpice <= 0) { showCustomAlert('⚠️ 辛味スパイスがありません', 'フェスショップで購入してください。'); return; }
    if(festSpicyBuffActive) { showCustomAlert('⚠️ 使用済みです', '辛味スパイスの効果は次の戦闘までは重複できません。'); return; }
    festSpicySpice -= 1;
    festSpicyBuffActive = true;
    festLogAppend('🌶️ 辛味スパイス使用：次の戦闘、味方ATK+40！');
    const spicyCountEl = document.getElementById('festBattleSpicyCount');
    if(spicyCountEl) spicyCountEl.innerText = festSpicySpice;
    playSoundEffect('hirihiri.mp3');
    saveFestState();
    updateFestStatusBar();
}
function festBattleContinue() {
    document.getElementById('festBattleResultArea').style.display = 'none';
    if(festBattlePhase <= 3) {
        festBattlePhase += 1;
        festMatchNeedsReroll = true; // 次の雑魚戦/ボス戦は新しい相手を抽選する
        saveFestState();
        openFestMatchModal(); // 次の雑魚戦へ：改めてマッチング画面で出撃カレーを選び直せる
    } else {
        festSetIndex += 1;
        festBattlePhase = 1;
        festBattleEnemies = [];
        festMatchNeedsReroll = true;
        festHireCandidates = rollFestHireCandidates(); // 1セットクリアごとに雇用候補を再抽選
        saveFestState();
        returnToFestHubAfterBattle();
    }
}
function returnToFestHubAfterBattle() {
    const battlePanel = document.getElementById('festBattlePanel');
    if(battlePanel) battlePanel.style.display = 'none';
    document.getElementById('festNavRow').style.display = 'flex';
    showFestPanel(festActivePanel || 'cook');
    updateFestStatusBar();
}
function festBattleLoseRun() {
    festBattleInProgress = false;
    festSpicyBuffActive = false;
    festPlayerPoisoned = false; festAllyPoisoned = false;
    festPlayerIlluded = false; festAllyIlluded = false;
    festStopBattleBgm();
    document.getElementById('festBattleResultArea').style.display = 'none';
    const msg = '💥 出撃できるカレー・仲間が尽きました…\nここまでの記録：' + festWinStreak + '連勝\n確保していたG：' + festAccumulatedReward + 'G';
    festLogAppend('💥 出撃できるカレー・仲間が尽きた…フェス終了。');
    saveFestState();
    festShowBattleResultOverlay('LOSE...', '#e74c3c', function() {
        const el = document.getElementById('festBattleDefeatText');
        if(el) el.innerText = msg;
        const area = document.getElementById('festBattleDefeatArea');
        if(area) area.style.display = 'block';
    });
}
function finishFestByDefeat() {
    maybePromptFestExpSpiceBeforeEnd(function() {
        playerG += festAccumulatedReward;
        saveGame();
        festActive = false;
        localStorage.removeItem('qr_fest_session');
        festCookSelectedIngredients = [];
        festCookSelectedSpice = "";
        festBattleInProgress = false;
        const rewardTotal = festAccumulatedReward;
        hideFestScreen();
        showCustomAlert('🏁 フェス終了', '合計 <span style="color:#2ecc71;">' + rewardTotal + ' G</span> を受け取りました！（最高連勝：' + festWinStreak + '連勝）');
    });
}

// ===== フェス専用ショップ（食材くじ／スパイスくじ／10個パックくじ／回復スパイス／辛味スパイス） =====
const FEST_SHOP_COSTS = { normal:3, spice:3, pack:30, heal:10, spicy:10 };
function openFestShopModal() {
    updateFestShopButtons();
    const overlay = document.getElementById('festShopOverlay');
    if(overlay) overlay.style.display = 'flex';
}
function closeFestShopModal() {
    const overlay = document.getElementById('festShopOverlay');
    if(overlay) overlay.style.display = 'none';
}
function updateFestShopButtons() {
    const setDisabled = function(id, cost) { const el = document.getElementById(id); if(el) el.disabled = festFP < cost; };
    setDisabled('festBtnGachaNormal', FEST_SHOP_COSTS.normal);
    setDisabled('festBtnGachaSpice', FEST_SHOP_COSTS.spice);
    setDisabled('festBtnGachaPack', FEST_SHOP_COSTS.pack);
    setDisabled('festBtnHeal', FEST_SHOP_COSTS.heal);
    setDisabled('festBtnSpicy', FEST_SHOP_COSTS.spicy);
}
function buyFestShopItem(type) {
    const cost = FEST_SHOP_COSTS[type];
    if(festFP < cost) { showCustomAlert('⚠️ FP不足', 'FPが足りません。'); return; }
    if(type === 'normal') {
        const pool = Object.keys(masterIngredients).filter(function(n){ return masterIngredients[n].shop === 0; });
        const winner = pool[Math.floor(Math.random() * pool.length)];
        festFP -= cost; festInventory[winner] = (festInventory[winner]||0) + 1;
        const d = masterIngredients[winner];
        const img = d && d.icon ? `<img src="${d.icon}" style="width:1.5em;height:1.5em;vertical-align:middle;object-fit:contain;">` : (d ? d.emoji : '');
        playWinSound();
        showCustomAlert("くじ結果", `見事！${img}【${winner}】を引き当てた！`);
    } else if(type === 'spice') {
        const pool = Object.keys(masterSpices).filter(function(n){ return masterSpices[n].shop === 0; });
        const winner = pool[Math.floor(Math.random() * pool.length)];
        festFP -= cost; festSpiceInventory[winner] = (festSpiceInventory[winner]||0) + 1;
        const d = masterSpices[winner];
        const img = d && d.icon ? `<img src="${d.icon}" style="width:1.5em;height:1.5em;vertical-align:middle;object-fit:contain;">` : (d ? d.emoji : '');
        playWinSound();
        showCustomAlert("くじ結果", `見事！${img}【${winner}】を引き当てた！`);
    } else if(type === 'pack') {
        const normalIng = Object.keys(masterIngredients).filter(function(n){ return masterIngredients[n].shop === 0; });
        const normalSp = Object.keys(masterSpices).filter(function(n){ return masterSpices[n].shop === 0; });
        const higherIng = Object.keys(masterIngredients).filter(function(n){ return masterIngredients[n].shop === 1 || masterIngredients[n].shop === 2; });
        festFP -= cost;
        const rewards = [];
        for(let i=0;i<7;i++){ const n = normalIng[Math.floor(Math.random()*normalIng.length)]; festInventory[n]=(festInventory[n]||0)+1; rewards.push(n); }
        for(let i=0;i<2;i++){ const n = normalSp[Math.floor(Math.random()*normalSp.length)]; festSpiceInventory[n]=(festSpiceInventory[n]||0)+1; rewards.push(n); }
        if(higherIng.length){ const n = higherIng[Math.floor(Math.random()*higherIng.length)]; festInventory[n]=(festInventory[n]||0)+1; rewards.push(n); }
        let resultHTML = "<div style='text-align:left; max-height:220px; overflow-y:auto; background:#fff; padding:10px; border-radius:8px; border:1px solid #ddd; line-height:1.6;'>";
        rewards.forEach(function(name, idx) {
            const pd = masterIngredients[name] || masterSpices[name];
            const pImg = pd && pd.icon ? `<img src="${pd.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">` : (pd ? pd.emoji : '');
            resultHTML += (idx+1) + '. ' + pImg + ' <b>' + name + '</b><br>';
        });
        resultHTML += "</div>";
        playWinSound();
        showCustomAlert("🎉 豪華10個パック開封！", `以下の10個を手に入れた！<br><br>${resultHTML}`);
    } else if(type === 'heal') {
        festFP -= cost; festHealSpice++;
        playWinSound();
        showCustomAlert('🧂 購入完了', '回復スパイスを1つ手に入れた！');
    } else if(type === 'spicy') {
        festFP -= cost; festSpicySpice++;
        playWinSound();
        showCustomAlert('🌶️ 購入完了', '辛味スパイスを1つ手に入れた！');
    }
    saveFestState(); updateFestStatusBar(); updateFestShopButtons();
    if(festActivePanel === 'cook') renderFestCookUI();
    else if(festActivePanel === 'ally') renderFestAllyUI(); // 回復/経験値スパイス購入時、仲間パネルの所持数表記も即時反映
}

// ===== フェス専用 調理パネル（フェス内で入手した食材・スパイスのみ使用。システムはフェス外と同じ） =====
let festCookSelectedIngredients = [];
let festCookSelectedSpice = "";
let festCookActiveCategoryIdx = 0;
function getFestCookCategoryItems(catKey) {
    return Object.keys(masterIngredients).filter(function(n) {
        if((festInventory[n]||0) <= 0) return false;
        const cat = getIngredientCategory(n);
        return catKey === "other" ? !cat : cat === catKey;
    });
}
function renderFestCookUI() {
    renderFestCookSelectedSlots();
    renderFestCookCategoryTabs();
    renderFestCookCategoryPanels();
    renderFestCookSpicePanel();
    updateFestCookPreview();
}
// 調理完了直後の再描画専用：食材/スパイス欄は最新化するが、updateFestCookPreview()内の
// 「前回結果を消す」処理を通さないことで、表示したばかりの調理結果(festResultBox)を消さないようにする
function renderFestCookPanelsKeepResult() {
    renderFestCookSelectedSlots();
    renderFestCookCategoryTabs();
    renderFestCookCategoryPanels();
    renderFestCookSpicePanel();
    hideFestCookStatPreview();
}
// フェス外のupdateCookPreview()と同じ挙動：食材・スパイスの選択が変わるたびに
// （１）前回の調理結果表示（festResultBox）を消し、（２）右下に完成時ステータス予想を表示する。
function updateFestCookPreview() {
    const prevResultBox = document.getElementById("festResultBox");
    if(prevResultBox && prevResultBox.style.display !== "none") {
        prevResultBox.style.display = "none";
    }
    const fixedPanel = document.getElementById("festCookStatFixed");
    const i1 = festCookSelectedIngredients[0] || "";
    const i2 = festCookSelectedIngredients[1] || "";
    const i3 = festCookSelectedIngredients[2] || "";
    const sp = festCookSelectedSpice || "";
    if(!i1 && !i2 && !i3 && !sp) {
        if(fixedPanel) fixedPanel.style.display = "none";
        return;
    }
    let hp=0, atk=0, def=0, spd=0;
    [i1,i2,i3].forEach(function(name) {
        const d = masterIngredients[name];
        if(d) { hp+=d.hp; atk+=d.atk; def+=d.def; spd+=d.spd; }
    });
    if(sp && masterSpices[sp]) {
        const sd = masterSpices[sp];
        if(sd.mul === "hp") hp = Math.round(hp * sd.val);
        else if(sd.mul === "atk") atk = Math.round(atk * sd.val);
        else if(sd.mul === "def") def = Math.round(def * sd.val);
        else if(sd.mul === "spd") spd = Math.round(spd * sd.val);
        if(sd.mul2) {
            if(sd.mul2 === "hp") hp = Math.round(hp * sd.val2);
            else if(sd.mul2 === "atk") atk = Math.round(atk * sd.val2);
            else if(sd.mul2 === "def") def = Math.round(def * sd.val2);
            else if(sd.mul2 === "spd") spd = Math.round(spd * sd.val2);
        }
    }
    const fHP = document.getElementById("festFixedPreviewHP");
    const fATK = document.getElementById("festFixedPreviewATK");
    const fDEF = document.getElementById("festFixedPreviewDEF");
    const fSPD = document.getElementById("festFixedPreviewSPD");
    if(fHP) fHP.innerText = hp;
    if(fATK) fATK.innerText = atk;
    if(fDEF) fDEF.innerText = def;
    if(fSPD) fSPD.innerText = spd;
    if(fixedPanel) fixedPanel.style.display = "block";
}
function hideFestCookStatPreview() {
    const panel = document.getElementById('festCookStatFixed');
    if(panel) panel.style.display = 'none';
}
function renderFestCookSelectedSlots() {
    const wrap = document.getElementById("festCookSelectedSlots");
    if(!wrap) return;
    wrap.innerHTML = "";
    for(let i = 0; i < 3; i++) {
        const name = festCookSelectedIngredients[i];
        const box = document.createElement("div");
        box.style.cssText = "flex:1; min-height:96px; border:1px dashed #99aee3; border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4px; cursor:pointer; background:#ffffff;";
        if(name) {
            const d = masterIngredients[name];
            if(d && d.shop !== 0) { applyRarityBorder(box, d.shop, '#ffffff'); } else { box.style.border = "1px solid #99aee3"; }
            const statLine = d ? `<div style="font-size:11px;color:#454545;font-weight:bold;line-height:1.4;margin-top:2px;">HP+${d.hp} ATK+${d.atk}<br>DEF+${d.def} SPD+${d.spd}</div>` : '';
            box.innerHTML = (d && d.icon ? `<img src="${d.icon}" style="width:26px;height:26px;object-fit:contain;">` : '') + `<div style="font-size:10px;color:#454545;margin-top:1px;text-align:center;">${name}</div>` + statLine;
            box.onclick = function(){ festCookSelectedIngredients.splice(i,1); renderFestCookUI(); };
        } else {
            box.innerHTML = `<div style="font-size:22px;color:#accced;">＋</div>`;
        }
        wrap.appendChild(box);
    }
}
function renderFestCookCategoryTabs() {
    const wrap = document.getElementById("festIngredientCategoryTabs");
    if(!wrap) return;
    wrap.innerHTML = "";
    COOK_CATEGORY_DEFS.forEach(function(c, idx) {
        const btn = document.createElement("button");
        const active = idx === festCookActiveCategoryIdx;
        btn.style.cssText = `flex:1; height:32px; border:none; background:none; cursor:pointer; padding:0; min-width:0; overflow:hidden; opacity:${active?'1':'0.45'};`;
        btn.innerHTML = `<img src="${c.img}" style="width:100%; height:32px; object-fit:cover; display:block;">`;
        btn.onclick = function(){ festCookActiveCategoryIdx = idx; renderFestCookCategoryPanels(); renderFestCookCategoryTabs(); };
        wrap.appendChild(btn);
    });
}
function renderFestCookCategoryPanels() {
    const track = document.getElementById("festIngredientCategoryPanels");
    if(!track) return;
    track.innerHTML = "";
    track.style.transform = `translateX(-${festCookActiveCategoryIdx * 100}%)`;
    COOK_CATEGORY_DEFS.forEach(function(c) {
        const panel = document.createElement("div");
        panel.style.cssText = "flex:0 0 100%; max-height:280px; overflow-y:auto; padding:8px; box-sizing:border-box;";
        const items = getFestCookCategoryItems(c.key);
        if(items.length === 0) {
            const label = COOK_CATEGORY_LABEL_JA[c.key] || '';
            panel.innerHTML = `<div style="text-align:center;color:#454545;font-size:12px;padding:20px 0;">所持している${label}食材はありません</div>`;
        } else {
            const grid = document.createElement("div");
            grid.style.cssText = "display:grid; grid-template-columns:repeat(3,1fr); gap:8px;";
            items.forEach(function(name) {
                const d = masterIngredients[name];
                const have = festInventory[name] || 0;
                const usedCount = festCookSelectedIngredients.filter(function(x){ return x === name; }).length;
                const isFull = festCookSelectedIngredients.length >= 3;
                const disabled = usedCount >= have;
                const cell = document.createElement("div");
                cell.style.cssText = `text-align:center; padding:6px 2px; border-radius:6px; border:1px solid ${disabled?'#accced':'#99aee3'}; background:${disabled?'#ffffff':'#fff'}; opacity:${disabled?'0.5':'1'}; cursor:${disabled?'default':'pointer'};`;
                cell.innerHTML = (d && d.icon ? `<img src="${d.icon}" style="width:32px;height:32px;object-fit:contain;">` : '<div style="font-size:24px;">🍴</div>')
                    + `<div style="font-size:10px;color:#454545;margin-top:2px;">${name}</div>`
                    + `<div style="font-size:10px;color:#888;">所持:${have - usedCount}</div>`
                    + `<div style="font-size:10px;color:#aaa;">${d.hp}/${d.atk}/${d.def}/${d.spd}</div>`;
                if(!disabled && d && d.shop !== 0) applyRarityBorder(cell, d.shop, '#fff');
                if(!disabled) cell.onclick = function() {
                    if(isFull) { festCookSelectedIngredients[2] = name; } else { festCookSelectedIngredients.push(name); }
                    renderFestCookUI();
                };
                grid.appendChild(cell);
            });
            panel.appendChild(grid);
        }
        track.appendChild(panel);
    });
}
function renderFestCookSpicePanel() {
    const slotWrap = document.getElementById("festCookSelectedSpiceSlot");
    const panel = document.getElementById("festSpiceCategoryPanel");
    if(!slotWrap || !panel) return;
    slotWrap.innerHTML = "";
    const slotBox = document.createElement("div");
    slotBox.style.cssText = "flex:0 0 120px; min-height:80px; border:1px dashed #99aee3; border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4px; cursor:pointer; background:#ffffff;";
    if(festCookSelectedSpice) {
        const d = masterSpices[festCookSelectedSpice];
        if(d && d.shop !== 0) { applyRarityBorder(slotBox, d.shop, '#ffffff'); } else { slotBox.style.border = "1px solid #99aee3"; }
        const statLine = d ? `<div style="font-size:11px;color:#454545;font-weight:bold;margin-top:2px;">${formatSpiceEffectText(d)}</div>` : '';
        slotBox.innerHTML = (d && d.icon ? `<img src="${d.icon}" style="width:26px;height:26px;object-fit:contain;">` : '') + `<div style="font-size:10px;color:#454545;margin-top:1px;">${festCookSelectedSpice}</div>` + statLine;
        slotBox.onclick = function(){ festCookSelectedSpice = ""; renderFestCookUI(); };
    } else {
        slotBox.innerHTML = `<div style="font-size:20px;color:#accced;">＋</div>`;
    }
    slotWrap.appendChild(slotBox);

    panel.innerHTML = "";
    const spiceNames = Object.keys(masterSpices).filter(function(n){ return (festSpiceInventory[n]||0) > 0; });
    if(spiceNames.length === 0) {
        panel.innerHTML = `<div style="text-align:center;color:#454545;font-size:12px;padding:10px 0;">所持しているスパイスがありません</div>`;
        return;
    }
    const grid = document.createElement("div");
    grid.style.cssText = "display:grid; grid-template-columns:repeat(4,1fr); gap:8px; max-height:200px; overflow-y:auto;";
    spiceNames.forEach(function(name) {
        const d = masterSpices[name];
        const have = festSpiceInventory[name] || 0;
        const isSelected = festCookSelectedSpice === name;
        const cell = document.createElement("div");
        cell.style.cssText = `text-align:center; padding:6px 2px; border-radius:6px; border:${isSelected?'2px':'1px'} solid ${isSelected?'#454545':'#99aee3'}; background:${isSelected?'#ffe699':'#fff'}; cursor:pointer;`;
        cell.innerHTML = (d && d.icon ? `<img src="${d.icon}" style="width:32px;height:32px;object-fit:contain;">` : '<div style="font-size:24px;">🧂</div>')
            + `<div style="font-size:10px;color:#454545;margin-top:2px;">${name}</div>`
            + `<div style="font-size:10px;color:#888;">所持:${have}</div>`
            + `<div style="font-size:10px;color:#aaa;">${formatSpiceEffectText(d)}</div>`;
        cell.onclick = function(){ festCookSelectedSpice = name; renderFestCookUI(); };
        if(d && d.shop) applyRarityBorder(cell, d.shop, isSelected ? '#ffe699' : '#fff');
        grid.appendChild(cell);
    });
    panel.appendChild(grid);
}
function clearFestCookSelection() {
    festCookSelectedIngredients = []; festCookSelectedSpice = "";
    renderFestCookUI();
}
// フェス外のapplyRecommendedSet()と同じロジック（優先ステータス条件は共通設定を流用）をfestInventory/festSpiceInventory向けに適用
function festApplyRecommendedSet() {
    const cond = getCookCondition();
    const priorityStats = cond.stats || [];
    const excludeMid     = cond.excludeMid     ?? false;
    const excludeHigh    = cond.excludeHigh    ?? false;
    const excludeSpecial = cond.excludeSpecial ?? false;

    const availIngredients = Object.keys(masterIngredients).filter(function(k) {
        if((festInventory[k]||0) <= 0) return false;
        const shop = masterIngredients[k].shop || 0;
        if(excludeMid     && shop === 1) return false;
        if(excludeHigh    && shop === 2) return false;
        if(excludeSpecial && shop < 0)  return false;
        return true;
    });
    const availSpices = Object.keys(masterSpices).filter(function(k) {
        if((festSpiceInventory[k]||0) <= 0) return false;
        const shop = masterSpices[k].shop || 0;
        if(excludeMid  && shop === 1) return false;
        if(excludeHigh && shop === 2) return false;
        return true;
    });

    if(availIngredients.length === 0) { showCustomAlert('⚠️ 食材不足', '条件に合う食材の在庫がありません。'); return; }

    let picks = pickRecommendedIngredients(availIngredients, festInventory, priorityStats);

    let bestSpice = '';
    if(availSpices.length > 0) {
        if(priorityStats.length > 0) {
            const match = availSpices.filter(function(k){ return priorityStats.includes(masterSpices[k].mul); });
            bestSpice = match.length > 0
                ? match.sort(function(a,b){ return masterSpices[b].val - masterSpices[a].val; })[0]
                : availSpices[Math.floor(Math.random() * availSpices.length)];
        } else {
            bestSpice = availSpices[Math.floor(Math.random() * availSpices.length)];
        }
    }

    festCookSelectedIngredients = picks.filter(Boolean);
    festCookSelectedSpice = bestSpice || "";
    renderFestCookUI();
}
function festCookCurry() {
    const i1 = festCookSelectedIngredients[0] || "", i2 = festCookSelectedIngredients[1] || "", i3 = festCookSelectedIngredients[2] || "";
    const sp = festCookSelectedSpice || "";
    if(!i1 && !i2 && !i3) { showCustomAlert('⚠️ 食材未選択', '食材を1つ以上選んでください。'); return; }
    playCookingAnimation([i1,i2,i3], sp, function(){ festCookCurryFinish(i1,i2,i3,sp); }, 'festResultBox');
}
// フェス外のcookCurry()と同じ演出（結果ボックス・特殊効果フラッシュ・イラスト表示）をフェス専用DOM要素に対して行う
function festCookCurryFinish(i1,i2,i3,sp) {
    [i1,i2,i3].forEach(function(n){ if(n) festInventory[n]--; });
    if(sp) festSpiceInventory[sp]--;
    const newCurry = buildCurryFromMaterials([i1,i2,i3], sp);
    newCurry.curHp = newCurry.hp; // Phase3：戦闘をまたいでHPを持ち越すための現在HP（調理直後は満タン）
    const { name: cName, hp, atk, def, spd, isPoison, hasGold, isMargherita, isTonTonTon, isSeafood, isIllusion, isSticky, isSeed, isWanpaku, isRatatouille, isHomerun, isPoisonApple, isFluffyOmelette, isGreenCurry, isTriCaviar, isCritical, materials: acts } = newCurry;

    festCurryStock.push(newCurry);
    festCookSelectedIngredients = []; festCookSelectedSpice = "";
    saveFestState();

    const resultBox = document.getElementById("festResultBox");
    ['gold-box','wave-box','critical-box','poison-box','poisonapple-box','margherita-box','tonton-box','illusion-box','sticky-box','seed-box','wanpaku-box','ratatouille-box','homerun-box','fluffyomelette-box','greencurry-box','tricaviar-box'].forEach(c => resultBox.classList.remove(c));
    ['festGoldFlashText','festWaveFlashText','festCriticalFlashText','festPoisonFlashText','festPoisonappleFlashText','festMargheritaFlashText','festTontonFlashText','festIllusionFlashText','festStickyFlashText','festSeedFlashText','festWanpakuFlashText','festRatatouilleFlashText','festHomerunFlashText','festFluffyomeletteFlashText','festGreencurryFlashText','festTricaviarFlashText'].forEach(function(id){ const el=document.getElementById(id); if(el) el.style.display='none'; });

    if(hasGold) { resultBox.classList.add("gold-box"); document.getElementById("festGoldFlashText").style.display="block"; }
    if(isSeafood) { resultBox.classList.add("wave-box"); document.getElementById("festWaveFlashText").style.display="block"; }
    if(isCritical){ resultBox.classList.add("critical-box"); document.getElementById("festCriticalFlashText").style.display="block"; }

    if(isPoison) { resultBox.classList.add("poison-box"); document.getElementById("festPoisonFlashText").style.display="block";
        if(isPoisonApple) { const el=document.getElementById("festPoisonappleFlashText"); if(el) el.style.display="block"; resultBox.classList.add("poisonapple-box"); }
    }
    else if(isMargherita) { resultBox.classList.add("margherita-box"); document.getElementById("festMargheritaFlashText").style.display="block"; }
    else if(isTonTonTon) { resultBox.classList.add("tonton-box"); document.getElementById("festTontonFlashText").style.display="block"; }
    else if(isIllusion) { resultBox.classList.add("illusion-box"); document.getElementById("festIllusionFlashText").style.display="block"; }
    else if(isSticky) { resultBox.classList.add("sticky-box"); document.getElementById("festStickyFlashText").style.display="block"; }
    else if(isSeed) { resultBox.classList.add("seed-box"); document.getElementById("festSeedFlashText").style.display="block"; }
    else if(isWanpaku) { resultBox.classList.add("wanpaku-box"); document.getElementById("festWanpakuFlashText").style.display="block"; }
    else if(isRatatouille) { resultBox.classList.add("ratatouille-box"); document.getElementById("festRatatouilleFlashText").style.display="block"; }
    else if(isHomerun) { resultBox.classList.add("homerun-box"); document.getElementById("festHomerunFlashText").style.display="block"; }
    else if(isFluffyOmelette) { resultBox.classList.add("fluffyomelette-box"); const el=document.getElementById("festFluffyomeletteFlashText"); if(el) el.style.display="block"; }
    else if(isGreenCurry) { resultBox.classList.add("greencurry-box"); const el=document.getElementById("festGreencurryFlashText"); if(el) el.style.display="block"; }
    else if(isTriCaviar) { resultBox.classList.add("tricaviar-box"); const el=document.getElementById("festTricaviarFlashText"); if(el) el.style.display="block"; }

    const _resultSounds = function() {
        if(isTriCaviar)          { playSoundEffect('healing.mp3'); }
        else if(isFluffyOmelette){ playSoundEffect('healing.mp3'); }
        else if(isGreenCurry)    { playSoundEffect('hirihiri.mp3'); }
        else if(isPoison)        { playSoundEffect('poison.mp3'); }
        else if(isMargherita)    { playSoundEffect('sound/syakin.mp3'); }
        else if(isTonTonTon)     { playSoundEffect('pig2.mp3'); }
        else if(isRatatouille)   { playSoundEffect('sound/syakin.mp3'); }
        else if(isWanpaku)       { playSoundEffect('sound/syakin.mp3'); }
        else if(isHomerun)       { playSoundEffect('sound/syakin.mp3'); }
        else if(isSticky)        { playSoundEffect('sound/syakin.mp3'); }
        else if(isSeed)          { playSoundEffect('sound/syakin.mp3'); }
        else if(isIllusion)      { playSoundEffect('sound/syakin.mp3'); }
        else if(isSeafood)       { playSoundEffect('sound/syakin.mp3'); }
        else if(isCritical)      { playSoundEffect('sound/syakin.mp3'); }
        else if(hasGold)         { playSoundEffect('sound/kinpaku.mp3'); }
        else                     { playSoundEffect('sound/pirorin.mp3'); }
    };
    if(window.cookAnimActive) { window.pendingCookSound = _resultSounds; }
    else { _resultSounds(); }

    const curryImg = document.getElementById("festCurryVisualImg");
    curryImg.src = getCurryImage(newCurry); curryImg.style.display = "block";
    const cookIconsHTML = curryIconsHTML(acts, sp, '32px');
    document.getElementById("festCookResultIcons").innerHTML = cookIconsHTML;
    document.getElementById("festCurryName").innerText = cName;
    document.getElementById("festStatHP").innerText = hp;
    document.getElementById("festStatATK").innerText = atk;
    document.getElementById("festStatDEF").innerText = def;
    document.getElementById("festStatSPD").innerText = spd;
    resultBox.style.display = "block";

    renderFestCookPanelsKeepResult();
}

// ===== フェス専用 仲間パネル（ストックカレー表示・雇用中の仲間表示・雇用モーダル） =====
// ストックカレーをタップした時の詳細表示
// フェス外の冷蔵庫ストックカレー詳細（showStockCurryDetail）と同じ構成。宅配カレー設定・売却はフェスでは不要のため除外
function showFestCurryDetail(idx) {
    const c = festCurryStock[idx];
    if(!c) return;
    ensureFestCurryHp();
    const typeImg = getCurryImage(c);
    const typeLabel = CURRY_TYPE_LABELS[c.curryType] || 'バランス型';
    const iconsHtml = curryIconsHTML(c.materials, c.spice, '24px');
    const skills = getCurrySkills(c);
    let skillsHtml = '';
    if(skills.length > 0) {
        skillsHtml = skills.map(function(s){ return '<div style="margin-top:8px;"><b style="color:#ff998b;">' + s.name + '</b><br><span style="font-size:12px;">' + s.desc + '</span></div>'; }).join('');
    }
    const canHeal = c.curHp < c.hp;
    const healBtnHtml = '<div style="margin-top:10px;"><button class="btn-cook-sub" style="width:100%;' + (canHeal ? '' : ' opacity:0.5; cursor:not-allowed;') + '" ' + (canHeal ? '' : 'disabled') + ' onclick="useFestHealSpiceForCurry(' + idx + ')">回復スパイスを使う（' + festHealSpice + '）</button></div>';
    const html = '<img src="' + typeImg + '" style="width:90px;height:90px;object-fit:contain;display:block;margin:0 auto 10px;">'
        + '<div style="font-weight:bold;color:#ff998b;margin-bottom:4px;">' + typeLabel + '</div>'
        + '<div style="display:flex;justify-content:center;gap:4px;margin-bottom:8px;">' + iconsHtml + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px;font-weight:bold;color:#454545;margin-bottom:6px;">'
        + '<div>HP: ' + c.curHp + '/' + c.hp + '</div><div>ATK: ' + statDisplayWithTableware('atk', c.atk) + '</div><div>DEF: ' + statDisplayWithTableware('def', c.def) + '</div><div>SPD: ' + statDisplayWithTableware('spd', c.spd) + '</div>'
        + '</div>'
        + skillsHtml
        + healBtnHtml;
    showCustomAlert(c.name, html);
}
// 戦闘外：ストックカレー詳細から回復スパイスを使ってそのカレーのHPを全回復する
function useFestHealSpiceForCurry(idx) {
    if(festHealSpice <= 0) { showCustomAlert('⚠️ 回復スパイスがありません', 'フェスショップで購入してください。'); return; }
    const c = festCurryStock[idx];
    if(!c) return;
    if(c.curHp >= c.hp) { showCustomAlert('⚠️ HPは満タンです', c.name + 'のHPはすでに満タンです。'); return; }
    festHealSpice -= 1;
    c.curHp = c.hp;
    saveFestState();
    updateFestStatusBar();
    playSoundEffect('healing.mp3');
    const modal = document.getElementById('customModal');
    if(modal) modal.style.display = 'none';
    renderFestAllyUI(); // ストック一覧のHP表記も更新
    showFestCurryDetail(idx); // 回復後のHPを反映して詳細を再表示
}
function renderFestAllyUI() {
    ensureFestCurryHp();
    // ベース・食器はフェス外と共通の選択状態を表示（購入・切替はフェス外の既存モーダルをそのまま使う）
    const fbEl = document.getElementById('festBaseSelectLabel');
    const ftEl = document.getElementById('festTablewareSelectLabel');
    if(fbEl) fbEl.innerText = selectedBase;
    if(ftEl) ftEl.innerText = selectedTableware;
    const stockBox = document.getElementById('festCurryStockList');
    if(stockBox) {
        stockBox.innerHTML = festCurryStock.length === 0
            ? '<div style="color:#454545; font-size:12px; padding:8px 0;">所持しているカレーはありません</div>'
            : festCurryStock.map(function(c, idx){
                const typeImg = getCurryImage(c);
                return '<div onclick="showFestCurryDetail(' + idx + ')" style="flex:0 0 30%; background:#ffffff; border:1px solid #99aee3; border-radius:6px; padding:8px; text-align:center; font-size:11px; color:#454545; cursor:pointer;">'
                    + '<img src="' + typeImg + '" style="width:36px;height:36px;object-fit:contain;display:block;margin:0 auto 4px;">' + c.name
                    + '<div style="font-size:10px;color:#888;margin-top:2px;">HP' + c.curHp + '/' + c.hp + '</div></div>';
            }).join('');
    }
    const allyBox = document.getElementById('festAllyDisplay');
    if(allyBox) {
        if(festHiredAllyName) {
            const def = getFestAllyDef(festHiredAllyName);
            const stats = getFestAllyCurrentStats(festHiredAllyName);
            const progress = getFestAllyProgress(festHiredAllyName);
            const needExp = festExpNeededForLevel(Math.min(progress.level+1, FEST_ALLY_LEVEL_CAP));
            const curHp = (festAllyHp === null) ? stats.hp : festAllyHp;
            const isDead = curHp <= 0;
            const imgStyle = 'width:64px; height:64px; border-radius:50%; border:2px solid #99aee3; object-fit:cover; background:#fff;' + (isDead ? ' filter:grayscale(100%); opacity:0.6;' : '');
            const nameStyle = 'font-weight:bold; font-size:14px;' + (isDead ? ' color:#e74c3c;' : '');
            allyBox.innerHTML =
                '<div style="display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.85); border-radius:8px; padding:10px;">'
                + '<img src="' + (def ? def.image : '') + '" style="' + imgStyle + '">'
                + '<div style="text-align:left; font-size:12px; color:#454545; line-height:1.6;">'
                + '<div style="' + nameStyle + '">' + festHiredAllyName + (isDead ? '（戦闘不能）' : '') + '</div>'
                + 'Lv.' + progress.level + (progress.level < FEST_ALLY_LEVEL_CAP ? '(EXP' + progress.exp + '/' + needExp + ')' : '(カンスト)') + '<br>'
                + 'HP:' + curHp + '/' + stats.hp + ' ATK:' + stats.atk + ' DEF:' + stats.def + ' SPD:' + stats.spd + '<br>'
                + '特技：' + getFestAllySpecialLabel(def)
                + '</div></div>'
                + '<div style="display:flex; gap:8px; margin-top:8px;">'
                + '<button class="btn-cook-sub" style="flex:1;' + (isDead ? ' opacity:0.5; cursor:not-allowed;' : '') + '" ' + (isDead ? 'disabled' : '') + ' onclick="useFestHealSpiceOutsideBattle()">回復スパイスを使う（' + festHealSpice + '）</button>'
                + '<button class="btn-cook-sub" style="flex:1;" onclick="useFestExpSpiceOutsideBattle()">経験値スパイスを使う（' + festExpSpice + '）</button>'
                + '</div>';
        } else {
            allyBox.innerHTML = '<div style="color:#454545; font-size:12px; padding:8px 0; background:rgba(255,255,255,0.85); border-radius:8px;">仲間は未雇用です</div>';
        }
    }
}
// 戦闘外：仲間パネルから回復スパイスを使って雇用中の仲間のHPを全回復する
function useFestHealSpiceOutsideBattle() {
    if(festHealSpice <= 0) { showCustomAlert('⚠️ 回復スパイスがありません', 'フェスショップで購入してください。'); return; }
    if(!festHiredAllyName) { showCustomAlert('⚠️ 仲間が未雇用です', '先に仲間を雇用してください。'); return; }
    const stats = getFestAllyCurrentStats(festHiredAllyName);
    const curHp = (festAllyHp === null) ? stats.hp : festAllyHp;
    if(curHp <= 0) { showCustomAlert('⚠️ 回復できません', festHiredAllyName + 'は戦闘不能のため回復スパイスは使えません。'); return; }
    if(curHp >= stats.hp) { showCustomAlert('⚠️ HPは満タンです', festHiredAllyName + 'のHPはすでに満タンです。'); return; }
    festHealSpice -= 1;
    festAllyHp = stats.hp;
    saveFestState();
    updateFestStatusBar();
    renderFestAllyUI();
    playSoundEffect('healing.mp3');
    showCustomAlert('💊 回復スパイス使用', festHiredAllyName + 'のHPが全回復した！');
}
// 戦闘外：仲間パネルから経験値スパイスを使って雇用中の仲間に経験値を1付与する（レベルキャップ50まで）
// Before→Afterのステータス変化を「HP00→00 ATK00→00 DEF00→00 SPD00→00」の形でHTML化する共通ヘルパー
function festStatDiffHtml(beforeStats, afterStats) {
    return '<div style="text-align:left;font-size:13px;line-height:1.7;margin-top:6px;">'
        + 'HP: ' + beforeStats.hp + ' → ' + afterStats.hp + '<br>'
        + 'ATK: ' + beforeStats.atk + ' → ' + afterStats.atk + '<br>'
        + 'DEF: ' + beforeStats.def + ' → ' + afterStats.def + '<br>'
        + 'SPD: ' + beforeStats.spd + ' → ' + afterStats.spd
        + '</div>';
}
// レベルアップでbeforeLevel→afterLevelの間にskill.levelReqを跨いだ場合、「技を覚えた！」の一文をHTML化する（跨がなければ空文字）。
// 経験値スパイス一括使用時のような複数レベル一気上げでも、範囲判定なので取りこぼさない。
function festSkillLearnedHtml(allyName, beforeLevel, afterLevel) {
    const def = getFestAllyDef(allyName);
    if(!def || !def.skill) return '';
    if(def.skill.levelReq > beforeLevel && def.skill.levelReq <= afterLevel) {
        return '<div style="text-align:left;font-size:13px;color:#e67e22;font-weight:bold;margin-top:6px;">✨「' + def.skill.name + '」を覚えた！</div>';
    }
    return '';
}
function useFestExpSpiceOutsideBattle() {
    if(festExpSpice <= 0) { showCustomAlert('⚠️ 経験値スパイスがありません', 'ボスを撃破すると手に入ります。'); return; }
    if(!festHiredAllyName) { showCustomAlert('⚠️ 仲間が未雇用です', '先に仲間を雇用してください。'); return; }
    const progress = getFestAllyProgress(festHiredAllyName);
    if(progress.level >= FEST_ALLY_LEVEL_CAP) { showCustomAlert('⚠️ レベル上限です', festHiredAllyName + 'は既にカンストしています。'); return; }
    const beforeStats = getFestAllyCurrentStats(festHiredAllyName);
    const beforeLevel = progress.level;
    festExpSpice -= 1;
    let level = progress.level, exp = progress.exp + 1;
    let leveledUp = false;
    while(level < FEST_ALLY_LEVEL_CAP) {
        const need = festExpNeededForLevel(level + 1);
        if(exp < need) break;
        exp -= need;
        level += 1;
        leveledUp = true;
    }
    if(level >= FEST_ALLY_LEVEL_CAP) { level = FEST_ALLY_LEVEL_CAP; exp = 0; }
    updateStats(function(s) {
        if(!s.festAllyLevels) s.festAllyLevels = {};
        s.festAllyLevels[festHiredAllyName] = { level: level, exp: exp };
    });
    saveFestState();
    updateFestStatusBar();
    renderFestAllyUI();
    playSoundEffect('sound/pirorin.mp3');
    if(leveledUp) {
        const afterStats = getFestAllyCurrentStats(festHiredAllyName);
        playWinSound();
        showCustomAlert('✨ レベルアップ！', festHiredAllyName + 'は Lv.' + beforeLevel + ' → Lv.' + level + ' になった！' + festStatDiffHtml(beforeStats, afterStats) + festSkillLearnedHtml(festHiredAllyName, beforeLevel, level));
    }
}
// 雇用候補は「初級・中級（マハラジャ除く）で討伐済みのbotから抽選した3体」のみ（festHireCandidates、フェス開始時に確定）
function openFestHireModal() {
    const box = document.getElementById('festHireListArea');
    if(box) {
        if(festHireCandidates.length === 0) {
            box.innerHTML = '<div style="text-align:center; color:#454545; font-size:12px; padding:16px 0;">討伐済みのbotがいないため、今回雇える仲間はいません。<br>PC戦（初級・中級）で敵を倒してから挑戦してください。</div>';
        } else {
            box.innerHTML = festHireCandidates.map(function(name) {
                const def = getFestAllyDef(name);
                const stats = getFestAllyCurrentStats(name);
                const already = festHiredAllyName === name;
                return '<div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #accced;">'
                    + '<div style="flex:1; text-align:left; font-size:12px; color:#454545;">'
                    + '<b>' + name + '</b>（Lv' + stats.level + '）<br>'
                    + 'HP:' + stats.hp + ' ATK:' + stats.atk + ' DEF:' + stats.def + ' SPD:' + stats.spd
                    + '</div>'
                    + '<button class="modal-btn modal-btn-ok" style="flex:0 0 92px; white-space:nowrap;" ' + (already ? 'disabled' : '') + ' onclick="hireFestAlly(\'' + name + '\')">' + (already ? '雇用中' : def.cost + 'FPで雇う') + '</button>'
                    + '</div>';
            }).join('');
        }
    }
    const overlay = document.getElementById('festHireOverlay');
    if(overlay) overlay.style.display = 'flex';
}
function closeFestHireModal() {
    const overlay = document.getElementById('festHireOverlay');
    if(overlay) overlay.style.display = 'none';
}
function hireFestAlly(name) {
    const def = getFestAllyDef(name);
    if(!def) return;
    if(festFP < def.cost) { showCustomAlert('⚠️ FP不足', 'FPが足りません。'); return; }
    const doHire = function() {
        festFP -= def.cost;
        festHiredAllyName = name;
        festAllyHp = null; // 戦闘開始時に現在の最大HPで初期化（Phase3）
        saveFestState();
        updateFestStatusBar();
        closeFestHireModal();
        renderFestAllyUI();
        showCustomAlert('🤝 雇用完了', name + ' を仲間にしました！');
    };
    if(festHiredAllyName && festHiredAllyName !== name) {
        showCustomConfirm('🤝 仲間の入れ替え', '既に「' + festHiredAllyName + '」を雇用中です。「' + name + '」と入れ替えますか？', doHire);
    } else {
        doHire();
    }
}
let unlockedFoodIconFeature = (localStorage.getItem('qr_food_icon_unlocked') === '1'); // 実績10個達成で食材アイコンをプレイヤーアイコンに使えるようになる
// ボス撃破で解放される新食材の管理（解放するまでQR・くじ・ビンゴ等の抽選に出現しない）
const BOSS_UNLOCK_INGREDIENTS = {
    chinUnlocked: ["タマゴ", "うずら卵"],   // レンチン玉子撃破で解放
    angelUnlocked: ["りんご", "バナナ"],     // カレー天使ぴゃぁ撃破で解放
    bratUnlocked: ["ハラペーニョ", "パクチー"] // 悪ガキサタン君撃破で解放
};
// スパイシーコインと交換で解放される中級・高級食材（コインを使うまでくじ等に出現しない）
const COIN_UNLOCK_INGREDIENTS = {
    midUnlocked: ["ココナッツ", "アスパラガス", "サフラン"], // 中級食材交換で一括解放
    highUnlocked: ["フォアグラ", "トリュフ"] // 高級食材交換で一括解放
};
// ふわとろオムカレーの軽減対象判定用、食材の系統分類（該当なしの食材は含まれない）
const INGREDIENT_CATEGORY = {
    meat:      ["牛肉", "牛すじ", "チキン", "唐揚げ", "トンカツ", "ウインナー", "合鴨", "牛タン"],
    seafood:   ["サバ", "イカ", "小エビ", "ホタテ", "ツナ", "牡蠣", "キャビア", "オマール海老", "ズワイガニ", "クルマエビ", "本マグロ"],
    vegetable: ["ナス", "トマト", "レンコン", "ピーマン", "赤パプリカ", "黄パプリカ", "玉ねぎ", "にんじん", "大根", "マッシュルーム", "オクラ", "パクチー", "トリュフ", "アスパラガス",
                "フルーツトマト", "メークイン", "金時にんじん", "聖護院大根", "新玉ねぎ"],
    fruit:     ["りんご", "バナナ", "レーズン", "ココナッツ", "シャインマスカット"]
};
// 食材名から系統キー（meat/seafood/vegetable/fruit）を取得。該当なしならnull
function getIngredientCategory(name) {
    for(const cat in INGREDIENT_CATEGORY) {
        if(INGREDIENT_CATEGORY[cat].includes(name)) return cat;
    }
    return null;
}
// カレーの食材リストに、指定した系統（meat/seafood/vegetable/fruit）の食材が1つでも含まれているか
// Bot（curry.foodCategoryが直接設定されている場合）はそちらを優先的に参照する
// ふわとろオム／世界三大珍味、どちらのバリアかをカレーの種類に応じて返す
function getBarrierLabel(curry) {
    return curry && curry.isTriCaviar ? '三大珍味バリア' : 'ふわとろバリア';
}
function curryHasCategory(curry, categoryKey) {
    if(!curry || !categoryKey) return false;
    if(curry.foodCategory !== undefined) return curry.foodCategory === categoryKey;
    if(!curry.materials) return false;
    return curry.materials.some(m => getIngredientCategory(m) === categoryKey);
}
function getUnlockedBossIngredients() {
    let list = [];
    if(localStorage.getItem('qr_unlock_chin') === '1') list = list.concat(BOSS_UNLOCK_INGREDIENTS.chinUnlocked);
    if(localStorage.getItem('qr_unlock_angel') === '1') list = list.concat(BOSS_UNLOCK_INGREDIENTS.angelUnlocked);
    if(localStorage.getItem('qr_unlock_brat') === '1') list = list.concat(BOSS_UNLOCK_INGREDIENTS.bratUnlocked);
    return list;
}
// 食材が現在抽選対象として有効か（ボス解放食材・コイン交換食材は解放済みでなければ false）
// レア食材 ↔ 通常食材 対応表
const RARE_TO_NORMAL_MAP = {
    "フルーツトマト":"トマト", "メークイン":"ジャガイモ", "金時にんじん":"にんじん",
    "聖護院大根":"大根", "シャインマスカット":"レーズン", "新玉ねぎ":"玉ねぎ",
    "クルマエビ":"小エビ", "本マグロ":"ツナ"
};
const NORMAL_TO_RARE_MAP = Object.fromEntries(Object.entries(RARE_TO_NORMAL_MAP).map(([r,n])=>[n,r]));

function isIngredientAvailable(name) {
    if(masterIngredients[name] && masterIngredients[name].shop === -3) return true; // レア食材は常に表示
    const allBossIngredients = [...BOSS_UNLOCK_INGREDIENTS.chinUnlocked, ...BOSS_UNLOCK_INGREDIENTS.angelUnlocked, ...BOSS_UNLOCK_INGREDIENTS.bratUnlocked];
    if(allBossIngredients.includes(name)) return getUnlockedBossIngredients().includes(name);
    const allCoinIngredients = [...COIN_UNLOCK_INGREDIENTS.midUnlocked, ...COIN_UNLOCK_INGREDIENTS.highUnlocked];
    if(allCoinIngredients.includes(name)) return getUnlockedCoinIngredients().includes(name);
    return true;
}
// 現在スパイシーコインで解放済みの食材一覧
function getUnlockedCoinIngredients() {
    let list = [];
    if(localStorage.getItem('qr_unlock_coin_mid') === '1') list = list.concat(COIN_UNLOCK_INGREDIENTS.midUnlocked);
    if(localStorage.getItem('qr_unlock_coin_high') === '1') list = list.concat(COIN_UNLOCK_INGREDIENTS.highUnlocked);
    return list;
}
// ボス撃破時に呼び、未解放なら新規解放して通知する
function unlockBossIngredients(bossKey) {
    const storageKey = 'qr_unlock_' + bossKey;
    if(localStorage.getItem(storageKey) === '1') return; // 既に解放済み
    localStorage.setItem(storageKey, '1');
    const bossNames = { chin: 'レンチン玉子', angel: 'カレー天使ぴゃぁ', brat: '悪ガキサタン君' };
    const bossName = bossNames[bossKey] || '敵';
    showCustomAlert('🔓 食材解放', `${bossName}撃破により新たにQRスキャン食材が2種類解放された！`);
}
let curryStock = []; let selectedCurryIndex = -1;
// ===== ベース・食器（バトル用の装備枠。食器はステータス補正あり） =====
const BASE_LIST = {
    '白米': { hp: 0, atk: 0, def: 0, spd: 0, desc: '特に効果なし' }
};
const TABLEWARE_LIST = {
    '白い皿':       { hp: 0,  atk: 0,   def: 0,   spd: 0,  desc: '特に効果なし' },
    'アルマイト皿':   { hp: 0,  atk: -10, def: 20,  spd: 0,  desc: 'ATK-10 / DEF+20' },
    '温もりの木皿':   { hp: 0,  atk: 0,   def: -10, spd: 30, desc: 'DEF-10 / SPD+30' },
    'オーバルプレート': { hp: 0,  atk: 15,  def: -15, spd: 0,  desc: 'ATK+15 / DEF-15' },
    'ターリー皿':     { hp: 20, atk: -5,  def: -5,  spd: 0,  desc: 'HP+20 / ATK-5 / DEF-5' }
};
// ステータス表示に、装備中食器の補正を色付きで併記するヘルパー（例: "50" → "50+20"(青字)）。
// 補正が0の場合は数値のみを返す。宅配カレー・対戦相手のカレー等「自分の食器補正をかけるべきでない」表示には使わないこと。
function statDisplayWithTableware(statKey, baseVal) {
    const info = TABLEWARE_LIST[selectedTableware];
    const mod = info ? (info[statKey] || 0) : 0;
    if (!mod) return String(baseVal);
    const color = mod > 0 ? '#2980b9' : '#e74c3c';
    const sign = mod > 0 ? '+' : '';
    return `${baseVal}<span style="color:${color};">${sign}${mod}</span>`;
}
let selectedBase = '白米';
let selectedTableware = '白い皿';
let unlockAlumiteTableware = false;
let unlockWoodTableware = false;
let unlockOvalTableware = false;
let unlockThaliTableware = false;
// 所持している食器名の一覧（先頭はデフォルトの「白い皿」で常に所持）
function getUnlockedTableware() {
    const list = ['白い皿'];
    if (unlockAlumiteTableware) list.push('アルマイト皿');
    if (unlockWoodTableware) list.push('温もりの木皿');
    if (unlockOvalTableware) list.push('オーバルプレート');
    if (unlockThaliTableware) list.push('ターリー皿');
    return list;
}
function getUnlockedBase() {
    return ['白米']; // 現状ベースは1種類のみ（将来の追加に備えて関数化）
}
let playerName = "名無しの料理人";
let recipeBook = {}; let myRoomRef = null; let currentRoomId = null;
let postMessages = []; // ポスト（受信フォルダ）の手紙一覧。{id, subject, body, image, rewardPack, read, rewardClaimed, expireAt, expireMinutesAfterRead, createdAt}
// デフォルトで入っている手紙（初回プレイ時のみ投入）
const DEFAULT_POST_MESSAGES = [
    { id: 'default_01', subject: '運営からのお知らせ', body: 'このポストには運営からのお知らせや、イベント情報や報酬などが送られてきます。未読の手紙があるときは手紙マークが点滅しているので、忘れずにチェックしてください。\nまずはパック件2枚をプレゼントしますので、下の「受け取る」ボタンで受け取ってから、冷蔵庫で「10個パックくじ」引いてみましょう！', rewardPack: 2, image: null, read: false }
];
let cachedMyIconFile = "myimageicon/mayimage01.png";
let cachedOppIconFile = "myimageicon/mayimage01.png";
let isBotMatch = false; let activeBotData = null;
let isMuted = (localStorage.getItem('qr_muted') === '1');
let isDebugMode = (localStorage.getItem('qr_debug_mode') === '1');
// 管理者が不正の疑いがあるアカウントに設定するフラグ（players/{id}/analyticsExcluded）。
// trueの場合、以後このアカウントのプレイはアナリティクス（scan/cook/battle集計）に反映しない。
// ローカルストレージには保存しない＝端末初期化やlocalStorage削除では回避できない（毎回Firebaseから読み直す）。
let isAnalyticsExcluded = false;
let playerId = localStorage.getItem('qr_player_id') || '';
let playerSecretKey = localStorage.getItem('qr_secret_key') || '';
let battleAborted = false; // バトル強制終了フラグ
let battleLogHistory = []; // 戦闘ログ蓄積用

function updateBattleLog(logEl, text) {
    logEl.innerHTML = text;
    battleLogHistory.push(text.replace(/<br\s*\/?>/gi, "\n"));
}

function showBattleLogHistory() {
    if(battleLogHistory.length === 0) {
        showCustomAlert("📜 戦闘ログ", "ログがありません。");
        return;
    }
    const rows = battleLogHistory.map(function(entry, i) {
        const lines = entry.split("\n").filter(function(l){ return l.trim() !== ""; }).join("<br>");
        return '<div style="padding:8px 0;border-bottom:1px solid #e0d0b0;font-size:12px;color:#420000;text-align:left;line-height:1.6;">' + lines + '</div>';
    }).join('');
    showCustomAlert("📜 戦闘ログ", '<div style="max-height:55vh;overflow-y:auto;text-align:left;">' + rows + '</div>');
}
let onlineRole = 'host'; // 対人戦での自分の役割
let discoveredItems = {};
let lockedItems = {}; // 食材・スパイスのロック状態（ロックされた食材はランダム選択の抽選から除外される）
let cachedOpponentName = "";
let cachedOpponentCurry = null;
window.onload = function() { showIframeEmbedNotice(); setTimeout(enableGameStart, 5000); loadGame(); updateTablewareBaseUI(); updateCookSelects(); setupCookCategorySwipe(); refreshRecipeBookUI(); updateShopButtons(); listenToRooms(); updateMatchCurrySelects(); setupLoadedIconUI(); updateLvDisplay(); loadNotice(); initQuest(); loadTopNotice(); updateMuteIcon(); initCookAnimSetting(); initPlayerId(function(){ enableGameStart(); syncDebugModeToCloud(); }); loadEventEnabledStatus(); setupModalScrollLock(); setupGuideCharLongPress(); setupTutorialSwipe(); updateLunchtimeBanner(); setInterval(updateLunchtimeBanner, 60000); checkBingoNewCardNotification(); renderShopInfoList(); initTopLayout(); playIntroAnimation(); loadFestState(); };

function enableGameStart() {
    const btn = document.getElementById('btnGameStart');
    if(!btn) return;
    btn.disabled = false;
    btn.innerHTML = 'GAME START';
}

// admin.html「デバッグモード全解除」との連携用。
// クラウドにまだ記録が無ければローカルの現在値を初回同期し、既に記録があって
// ローカルと異なる場合はクラウド側（管理ツールでの変更）を優先してローカルに反映する。
// これにより、管理者が全解除ボタンを押すと、対象プレイヤーが次にこのゲームを開いた時に
// 実際にデバッグモードがOFFになる。
function syncDebugModeToCloud() {
    if(!database || !playerId) return;
    database.ref('players/' + playerId + '/debugMode').once('value').then(function(snap){
        const cloudVal = snap.val();
        if(cloudVal === null || cloudVal === undefined) {
            database.ref('players/' + playerId + '/debugMode').set(!!isDebugMode);
        } else if(cloudVal !== isDebugMode) {
            isDebugMode = !!cloudVal;
            localStorage.setItem('qr_debug_mode', isDebugMode ? '1' : '0');
        }
    }).catch(function(){ /* 通信エラー時は何もしない */ });
}

// モーダル表示中は背後のページスクロールをロック
const TAB_ORDER = ['quest', 'scan', 'fridge', 'cook', 'battle'];

function setupSwipeTabSwitch() {
    const gameUI = document.getElementById('gameUI');
    if(!gameUI) return;
    let startX = 0, startY = 0, tracking = false;

    gameUI.addEventListener('touchstart', function(e) {
        if(e.touches.length !== 1) return;
        // バトル中・モーダル表示中はスワイプ無効
        const arena = document.getElementById('battleArena');
        const modal = document.getElementById('customModal');
        if(arena && arena.style.display === 'block') return;
        if(modal && modal.style.display === 'flex') return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        tracking = true;
    }, { passive: true });

    gameUI.addEventListener('touchend', function(e) {
        if(!tracking) return;
        tracking = false;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = endX - startX;
        const diffY = endY - startY;
        // 横移動が縦移動より十分大きく、かつ一定距離以上動いた場合のみスワイプとみなす
        if(Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
            const activeBtn = document.querySelector('.tab-btn.active');
            if(!activeBtn) return;
            const activeTabMatch = activeBtn.getAttribute('onclick').match(/switchTab\('(\w+)'/);
            if(!activeTabMatch) return;
            const currentTab = activeTabMatch[1];
            const currentIdx = TAB_ORDER.indexOf(currentTab);
            if(currentIdx === -1) return;
            let nextIdx;
            if(diffX < 0) nextIdx = currentIdx + 1; // 左にスワイプ→次のタブ
            else nextIdx = currentIdx - 1; // 右にスワイプ→前のタブ
            if(nextIdx < 0 || nextIdx >= TAB_ORDER.length) return;
            const nextTab = TAB_ORDER[nextIdx];
            const nextBtn = document.querySelector('[onclick*="switchTab(\'' + nextTab + '\'"]');
            if(nextBtn) switchTab(nextTab, nextBtn);
        }
    }, { passive: true });
}

function setupModalScrollLock() {
    const modal = document.getElementById('customModal');
    if(!modal) return;
    const observer = new MutationObserver(function() {
        const isOpen = modal.style.display === 'flex';
        document.body.classList.toggle('modal-open', isOpen);
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
}
function gameStart() {
    if (window.__integrityFlagged) {
        simulateFailedGameStart();
        return;
    }
    // 初回のみオンボーディング（名前入力→音声確認→チュートリアル自動遷移）を行う。
    // admin.htmlの「初期プレイヤー化」デバッグフラグがONの場合は、
    // 既にオンボーディング済みのブラウザでも強制的にオンボーディングをやり直させる（テスト用）。
    const forceNewPlayer = localStorage.getItem('qr_debug_new_player') === '1';
    if(forceNewPlayer || localStorage.getItem('qr_onboarding_done') !== '1') {
        showOnboardingNameModal();
        return; // モーダルの流れの最後でproceedGameStartまたはtutorial.htmlへの遷移を行う
    }
    proceedGameStart();
}

// syncSeal不一致を検知したアカウント向けの抑止。特別なエラーや演出は一切出さず、
// 既存の「Loading...」表示のままランダムな時間（毎回同じ長さだと不自然なため）待たせた後、
// 静かにボタンを元に戻すだけにする。本人には通信不調で読み込みに失敗したようにしか見えない。
function simulateFailedGameStart() {
    const btn = document.getElementById('btnGameStart');
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-loading-spinner"></span>Loading...';
    const delay = 7000 + Math.floor(Math.random() * 6000);
    setTimeout(function(){
        btn.disabled = false;
        btn.innerHTML = 'GAME START';
    }, delay);
}

// ===== オンボーディング：① 名前入力 =====
function showOnboardingNameModal() {
    const msg = '<div style="font-size:14px;color:#420000;margin-bottom:14px;line-height:1.6;">まずは料理人の名前を決めてください！</div>'
        + '<input type="text" id="onboardingNameInput" placeholder="料理人の名前を入力" maxlength="12" style="width:100%;padding:10px;border:1px solid #b88742;border-radius:4px;font-size:16px;box-sizing:border-box;background:#f5e9c8;color:#420000;margin-bottom:14px;">'
        + '<button onclick="confirmOnboardingName()" style="width:100%;padding:12px;background:#b88742;color:#efdeb1;border:none;border-radius:4px;font-weight:bold;font-size:14px;cursor:pointer;">次へ</button>';
    document.getElementById("modalTitle").innerHTML = "👤 名前を決めよう";
    document.getElementById("modalMessage").innerHTML = msg;
    document.getElementById("modalBtnGroup").innerHTML = '';
    document.getElementById("customModal").style.display = "flex";
}

function confirmOnboardingName() {
    const inp = document.getElementById('onboardingNameInput');
    let val = inp ? inp.value.trim() : '';
    if(!val) val = "名無しの料理人";
    playerName = val;
    document.getElementById("headerPlayerName").innerText = val;
    const nameTabInput = document.getElementById("playerNameInput");
    if(nameTabInput) nameTabInput.value = val;
    saveGame();
    if (database && playerId) { database.ref('players/' + playerId + '/name').set(val); }
    showSoundCheckModal();
}

// ===== オンボーディング：② 音声について =====
function showSoundCheckModal() {
    const msg = '<div style="font-size:14px;color:#420000;margin-bottom:16px;line-height:1.6;">このゲームは音ありを推奨しています。<br>今、音を出しても大丈夫ですか？</div>'
        + '<div style="display:flex;gap:10px;">'
        + '<button onclick="confirmSoundOn()" style="flex:1;padding:12px;background:#b88742;color:#efdeb1;border:none;border-radius:4px;font-weight:bold;font-size:14px;cursor:pointer;">大丈夫！</button>'
        + '<button onclick="confirmSoundOff()" style="flex:1;padding:12px;background:#420000;color:#efdeb1;border:none;border-radius:4px;font-weight:bold;font-size:14px;cursor:pointer;">ミュートにする</button>'
        + '</div>';
    document.getElementById("modalTitle").innerHTML = "🔊 音声について";
    document.getElementById("modalMessage").innerHTML = msg;
    document.getElementById("modalBtnGroup").innerHTML = '';
    document.getElementById("customModal").style.display = "flex";
}

function confirmSoundOn() {
    isMuted = false;
    localStorage.setItem('qr_muted', '0');
    updateMuteIcon();
    finishOnboardingAndMaybeTutorial();
}

function confirmSoundOff() {
    isMuted = true;
    localStorage.setItem('qr_muted', '1');
    updateMuteIcon();
    finishOnboardingAndMaybeTutorial();
}

// ===== オンボーディング：③ 初回のみ確認なしでチュートリアルへ自動遷移 =====
// 既存プレイヤー（このアップデート以前から遊んでいた人）を誤ってチュートリアルに
// 送らないよう、①qr_onboarding_doneフラグを主判定、②実際のプレイ履歴が
// 1つでも残っていれば既存プレイヤー扱いにする安全策、の二重チェックで判定する。
// admin.htmlの「初期プレイヤー化」デバッグフラグ(qr_debug_new_player)がONの場合は、
// このブラウザの実際の進行状況に関わらず常に新規プレイヤーとして扱う（テスト用）。
function isExistingPlayerForTutorial() {
    if (localStorage.getItem('qr_debug_new_player') === '1') return false;
    if (localStorage.getItem('qr_onboarding_done') === '1') return true;
    // 注意：qr_curry_pnameは判定材料にしない。オンボーディング中のconfirmOnboardingName()が
    // 名前確定と同時にsaveGame()を呼ぶため、この判定に来る時点では新規プレイヤーでも
    // 既に名前が保存済みになっており、誤って既存プレイヤー扱いされてしまうため。
    try {
        const inv = JSON.parse(localStorage.getItem('qr_curry_inv') || '{}');
        if (Object.keys(inv).some(k => inv[k] > 0)) return true;
    } catch (e) {}
    try {
        const stock = JSON.parse(localStorage.getItem('qr_curry_stock') || '[]');
        if (stock.length > 0) return true;
    } catch (e) {}
    try {
        const recipes = JSON.parse(localStorage.getItem('qr_curry_recipes') || '{}');
        if (Object.keys(recipes).length > 0) return true;
    } catch (e) {}
    try {
        const history = JSON.parse(localStorage.getItem('qr_curry_history') || '{}');
        if (Object.keys(history).length > 0) return true;
    } catch (e) {}
    if (parseInt(localStorage.getItem('qr_curry_g') || '0', 10) > 0) return true;
    if (parseInt(localStorage.getItem('qr_curry_exp') || '0', 10) > 0) return true;
    if (parseInt(localStorage.getItem('qr_curry_ticket') || '0', 10) > 0) return true;
    return false;
}

function finishOnboardingAndMaybeTutorial() {
    const forceNewPlayer = localStorage.getItem('qr_debug_new_player') === '1';
    const alreadyExisting = isExistingPlayerForTutorial();
    const tutorialAlreadyDone = localStorage.getItem('tut_done') === '1';
    localStorage.setItem('qr_onboarding_done', '1');
    document.getElementById("customModal").style.display = "none";
    // 既存プレイヤー、またはチュートリアルを既に完了済みの場合は通常通りゲームへ
    // （「初期プレイヤー化」デバッグフラグがONの間はこの判定を無視して必ずチュートリアルへ）
    if (!forceNewPlayer && (alreadyExisting || tutorialAlreadyDone)) {
        proceedGameStart();
        return;
    }
    // 新規プレイヤーは確認なしで自動的にチュートリアルへ
    window.location.href = 'tutorial.html';
}

function proceedGameStart() {
    document.getElementById("pageTop").style.display = "none";
    document.getElementById("gameUI").style.display = "block";
    updateFridgeUI();
    // アクセスカウント（デバッグモード中はカウントしない、同IDの同日重複はカウントしない）
    recordPlayerAccess();
    // フェス中にトップ画面へ戻っていた場合：タブメニューを隠したままの状態（setFestStatusBarVisible(true)）が
    // 残るとタブが消えて操作不能になるため、通常タブに切り替えず必ずフェス画面へ復帰させる
    if(festActive) {
        showFestScreen();
        loadNotice();
        onGameStartShowPost();
        return;
    }
    // プレイヤータブをアクティブに（GAME STARTの初期タブ）
    const playerTab = document.querySelector('[onclick*="quest"]');
    const playerPage = document.getElementById("pageQuest");
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    if(playerTab) playerTab.classList.add("active");
    if(playerPage) playerPage.classList.add("active");
    updateFridgeUI();
    loadNotice();
    showQuestGuideChar();
    onGameStartShowPost();
}

function goToTop() {
    // バトル中は無効
    const arena = document.getElementById("battleArena");
    if(arena && arena.style.display === "block") return;
    const tagArena = document.getElementById("tagBattleArena");
    if(tagArena && tagArena.style.display === "block") return;
    if(festBattleInProgress) return; // フェスの戦闘中も同様に無効
    // 初期画面を表示
    hideCookStatPreview();
    const pageTop = document.getElementById("pageTop");
    pageTop.style.display = "flex";
    document.getElementById("gameUI").style.display = "none";
    const postBtn = document.getElementById("postBtn");
    if(postBtn) postBtn.style.display = "none";
    // ボタン・お知らせを確実に表示
    const btn = pageTop.querySelector(".btn-gamestart");
    if(btn) btn.style.display = "block";
    // お知らせを再取得して表示
    loadTopNotice();
    hideQuestGuideChar();
}

const DEFAULT_TOP_INFO_TEXT = "プレイデータはブラウザごとに記憶されるので、同じ環境でプレイしないと続きから遊べません！\nLINEやX、Instagramでアクセスしてきた人はChromeやSafariなどブラウザで開き直してからプレイするのをオススメします！\nまた、プレイされているブラウザのキャッシュや履歴の削除によりデータが消える可能性があります。\nキャラクターIDを控え、定期的にバックアップコードを発行し、メモなどにコピペ保存してください。\nお手数おかけして申し訳ありません...";

function loadTopNotice() {
    if(!database) return;
    database.ref("notice").once("value").then(function(snap) {
        const text = snap.val() || "";
        const box = document.getElementById("topNoticeBox");
        if(!box) return;
        if(text) {
            box.innerHTML = text.replace(/\n/g, "<br>");
            box.style.display = "block";
        } else {
            box.style.display = "none";
        }
    });
    database.ref("topInfoText").once("value").then(function(snap) {
        const val = snap.val();
        const text = (val === null || val === undefined) ? DEFAULT_TOP_INFO_TEXT : val;
        const box = document.getElementById("topInfoTextBox");
        if(!box) return;
        if(text) {
            box.innerHTML = text.replace(/\n/g, "<br>");
            box.style.display = "block";
        } else {
            box.style.display = "none";
        }
    });
}

// ===== バトル技演出アニメーション（共通） =====
// config: { bgImg, chara1Img, chara2Img, soundOpen, soundHit }
function playBattleSkillAnimation(config, callback) {
    var overlay  = document.getElementById('battleSkillOverlay');
    var bgImg    = document.getElementById('battleSkillBgImg');
    var charaImg = document.getElementById('battleSkillCharaImg');
    var bgWrap   = document.getElementById('battleSkillBgWrap');
    if(!overlay) { if(callback) callback(); return; }

    var played = false; // 二重起動防止フラグ

    bgImg.onload  = null;
    bgImg.onerror = null;
    bgImg.src     = config.bgImg     || '';
    charaImg.src  = config.chara1Img || '';
    charaImg.style.transition = 'none';
    charaImg.style.transform  = 'translate(-50%,-50%) scale(1)';
    bgWrap.style.transition = 'none';
    bgWrap.style.clipPath   = 'inset(50% 0 50% 0)'; // 全体を隠す
    overlay.style.opacity   = '1';
    overlay.style.transition = '';
    overlay.style.display   = 'none'; // 画像ロードまで非表示
    window.battleSkillAnimBusy = true;

    function startAnim() {
        if(played) return;
        played = true;
        bgImg.onload  = null;
        bgImg.onerror = null;

        overlay.style.display = 'block'; // アニメーション開始と同時に表示

        // clip-pathの最終値（上下20%ずつ隠す＝中央60%を表示）
        var toPct = 20;

        playSoundEffect(config.soundOpen || 'sound/battlese.mp3');

        // JSアニメーションループでclip-pathを開く（CSSトランジションより確実）
        var animStart = null;
        var animDur   = 500;
        (function animFrame(ts) {
            if(!animStart) animStart = ts;
            var prog  = Math.min((ts - animStart) / animDur, 1);
            var ease  = 1 - Math.pow(1 - prog, 2); // ease-out quad
            var cur   = 50 + (toPct - 50) * ease;
            bgWrap.style.clipPath = 'inset(' + cur.toFixed(2) + '% 0 ' + cur.toFixed(2) + '% 0)';
            if(prog < 1) { requestAnimationFrame(animFrame); }
        })(performance.now());

        requestAnimationFrame(function(){ requestAnimationFrame(function(){

            // カレーが揺れながら少し拡大
            setTimeout(function(){
                charaImg.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
                charaImg.style.transform  = 'translate(-50%,-50%) scale(1.15) rotate(-2deg)';
            }, 200);
            setTimeout(function(){
                charaImg.style.transition = 'transform 0.25s ease';
                charaImg.style.transform  = 'translate(-50%,-50%) scale(1.08) rotate(1deg)';
            }, 550);

            // chara1→chara2 差し替え
            setTimeout(function(){
                charaImg.src = config.chara2Img || config.chara1Img;
                charaImg.style.transition = 'none';
                charaImg.style.transform  = 'translate(-50%,-50%) scale(1.08) rotate(1deg)';
            }, 680);

            // chara2 がダイナミックに拡大＋傾く
            setTimeout(function(){
                charaImg.style.transition = 'transform 0.42s cubic-bezier(0.22,1,0.36,1)';
                charaImg.style.transform  = 'translate(-50%,-50%) scale(2.0) rotate(-5deg)';
            }, 700);

            // 効果音②
            setTimeout(function(){ playSoundEffect(config.soundHit || 'sound/homerun.mp3'); }, 1000);

            // シェイク
            setTimeout(function(){
                charaImg.style.transition = 'transform 0.1s ease';
                charaImg.style.transform  = 'translate(-50%,-50%) scale(1.55) rotate(6deg)';
            }, 1040);
            setTimeout(function(){
                charaImg.style.transition = 'transform 0.12s ease';
                charaImg.style.transform  = 'translate(-50%,-50%) scale(1.58) rotate(-3deg)';
            }, 1160);

            // フェードアウト
            setTimeout(function(){
                overlay.style.transition = 'opacity 0.3s ease';
                overlay.style.opacity = '0';
            }, 1380);

            // 完了
            setTimeout(function(){
                overlay.style.display    = 'none';
                overlay.style.opacity    = '1';
                overlay.style.transition = '';
                bgWrap.style.transition  = 'none';
                bgWrap.style.clipPath    = 'inset(50% 0 50% 0)';
                window.battleSkillAnimBusy = false;
                if(callback) callback();
            }, 1700);
        }); });
    }

    if(bgImg.complete && bgImg.naturalWidth > 0) { startAnim(); }
    else { bgImg.onload = startAnim; bgImg.onerror = startAnim; }
}


// ホームラン演出設定
const HOMERUN_ANIM_CONFIG = {
    bgImg:     'battle/homerun_bg.png',
    chara1Img: 'battle/homerun_chara1.png',
    chara2Img: 'battle/homerun_chara2.png',
    soundOpen: 'sound/battlese.mp3',
    soundHit:  'sound/homerun.mp3'
};

// サタン君用（差し替えなし・bg2使用）
const HOMERUN_ANIM_CONFIG_SATAN = {
    bgImg:     'battle/homerun_bg2.png',
    chara1Img: 'battle/homerun_chara3.png',
    chara2Img: 'battle/homerun_chara3.png',
    soundOpen: 'sound/battlese.mp3',
    soundHit:  'sound/homerun.mp3'
};

// 敵（ルーム戦対戦相手）のホームラン演出（bg2使用）
const HOMERUN_ANIM_CONFIG_ENEMY = {
    bgImg:     'battle/homerun_bg2.png',
    chara1Img: 'battle/homerun_chara1.png',
    chara2Img: 'battle/homerun_chara2.png',
    soundOpen: 'sound/battlese.mp3',
    soundHit:  'sound/homerun.mp3'
};
// プレイヤー（味方）の種連射演出設定
const SEED_PLAYER_ALLY_CONFIG = {
    charaImg: 'battle/taneren_chara1.png', chara2Img: 'battle/taneren_chara2.png',
    bgImg: 'battle/homerun_bg.png',
    charaTop: '80%', charaWidth: '60%', charaMaxScale: 1.2
};
// ルーム戦で敵が使う種連射演出設定（bg2）
const SEED_PLAYER_ENEMY_CONFIG = {
    charaImg: 'battle/taneren_chara1.png', chara2Img: 'battle/taneren_chara2.png',
    bgImg: 'battle/homerun_bg2.png',
    charaTop: '80%', charaWidth: '60%', charaMaxScale: 1.2
};
// 種連射の割り込みホームラン設定を返す
function getSeedInterruptConfig(reflectorName, isRoomBattle) {
    if(reflectorName && reflectorName.includes('サタン')) return HOMERUN_ANIM_CONFIG_SATAN;
    if(isRoomBattle) return HOMERUN_ANIM_CONFIG_ENEMY;
    return HOMERUN_ANIM_CONFIG;
}

// タッグ戦用設定（敵側：bg2、味方側：bg）
const TANEMAKI_TAG_ENEMY_CONFIG = { charaImg:'battle/bt_tanemaki1.png', chara2Img:null, bgImg:'battle/homerun_bg2.png', charaTop:'55%', charaWidth:'60%', charaMaxScale:1.2, interruptConfig:HOMERUN_ANIM_CONFIG };
const TANEMAKI_TAG_ALLY_CONFIG  = { charaImg:'battle/bt_tanemaki1.png', chara2Img:null, bgImg:'battle/homerun_bg.png',  charaTop:'55%', charaWidth:'60%', charaMaxScale:1.2 };
const DRAGON_TAG_ENEMY_CONFIG   = { charaImg:'battle/bt_dragon.png',    chara2Img:null, bgImg:'battle/homerun_bg2.png', charaTop:'52%', charaWidth:'70%', charaMaxScale:1.15, interruptConfig:HOMERUN_ANIM_CONFIG };
const DRAGON_TAG_ALLY_CONFIG    = { charaImg:'battle/bt_dragon.png',    chara2Img:null, bgImg:'battle/homerun_bg.png',  charaTop:'52%', charaWidth:'70%', charaMaxScale:1.15 };

// タッグ味方側種連射の設定を返す（婆ちゃんかどうかで変える）
function getTagAllySeedConfig(actorName, interruptCfg) {
    const base = (actorName && actorName.includes('婆')) ? TANEMAKI_TAG_ALLY_CONFIG : SEED_PLAYER_ALLY_CONFIG;
    return Object.assign({}, base, { interruptConfig: interruptCfg });
}

function getHomerunConfig(actorName) {
    return (actorName && actorName.includes('サタン')) ? HOMERUN_ANIM_CONFIG_SATAN : HOMERUN_ANIM_CONFIG;
}

// 種まき婆ちゃん・ドラゴン料理長などBot特殊技演出
// config: { charaImg, charaTop（縦位置%）, charaWidth（幅%）, charaMaxScale（最大拡大率）}
function playTanemakiAnimation(config, willInterrupt, callback) {
    var charaImgSrc   = config.charaImg;
    var chara2ImgSrc  = config.chara2Img   || null;
    var bgImgSrc      = config.bgImg        || 'battle/homerun_bg2.png';
    var charaTop      = config.charaTop     || '80%';
    var charaWidth    = config.charaWidth   || '60%';
    var charaMaxScale = config.charaMaxScale || 1.2;
    var interruptCfg  = config.interruptConfig || HOMERUN_ANIM_CONFIG;
    const overlay  = document.getElementById('battleSkillOverlay');
    const bgImg    = document.getElementById('battleSkillBgImg');
    const charaImg = document.getElementById('battleSkillCharaImg');
    const bgWrap   = document.getElementById('battleSkillBgWrap');
    if(!overlay) { callback(); return; }

    var played = false;
    bgImg.onload = null; bgImg.onerror = null;
    bgImg.src    = bgImgSrc;
    charaImg.src = charaImgSrc;
    charaImg.style.top   = charaTop;
    charaImg.style.width = charaWidth;
    charaImg.style.transition = 'none';
    charaImg.style.transform  = 'translate(-50%,-50%) scale(1)';
    bgWrap.style.transition   = 'none';
    bgWrap.style.clipPath     = 'inset(50% 0 50% 0)';
    overlay.style.opacity     = '1';
    overlay.style.transition  = '';
    overlay.style.display     = 'none';
    window.battleSkillAnimBusy = true;

    function startAnim() {
        if(played) return;
        played = true;
        bgImg.onload = null; bgImg.onerror = null;
        overlay.style.display = 'block';

        playSoundEffect('sound/battlese.mp3');

        // マスクを開くJSアニメーション
        var toPct = 20;
        var t0 = performance.now();
        (function frame(ts) {
            var prog = Math.min((ts - t0) / 500, 1);
            var ease = 1 - Math.pow(1 - prog, 2);
            var cur  = 50 + (toPct - 50) * ease;
            bgWrap.style.clipPath = 'inset(' + cur.toFixed(2) + '% 0 ' + cur.toFixed(2) + '% 0)';
            if(prog < 1) requestAnimationFrame(frame);
        })(t0);

        setTimeout(function(){
            charaImg.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
            charaImg.style.transform  = 'translate(-50%,-50%) scale(' + charaMaxScale + ')';
        }, 200);
        setTimeout(function(){
            charaImg.style.transition = 'transform 0.2s ease';
            charaImg.style.transform  = 'translate(-50%,-50%) scale(' + (charaMaxScale * 0.92).toFixed(2) + ') rotate(-3deg)';
        }, 580);
        // chara1→chara2 差し替え（設定あれば）
        if(chara2ImgSrc) {
            setTimeout(function(){
                charaImg.src = chara2ImgSrc;
                charaImg.style.transition = 'none';
                charaImg.style.transform  = 'translate(-50%,-50%) scale(' + (charaMaxScale * 0.92).toFixed(2) + ') rotate(-3deg)';
            }, 690);
        }

        if(willInterrupt) {
            // 800ms時点でoverlay2（ホームラン演出）がoverlay1の上に重なってくる
            setTimeout(function(){
                var o2   = document.getElementById('battleSkillOverlay2');
                var bg2  = document.getElementById('battleSkillBgImg2');
                var ch2  = document.getElementById('battleSkillCharaImg2');
                var bw2  = document.getElementById('battleSkillBgWrap2');

                bg2.src  = interruptCfg.bgImg || 'battle/homerun_bg.png';
                ch2.src  = interruptCfg.chara1Img || 'battle/homerun_chara1.png';
                ch2.style.transition = 'none';
                ch2.style.transform  = 'translate(-50%,-50%) scale(1)';
                bw2.style.clipPath   = 'inset(50% 0 50% 0)';
                o2.style.opacity     = '1';
                o2.style.transition  = '';
                o2.style.display     = 'block';

                // overlay2のマスクを開くJSアニメーション
                var t2 = performance.now();
                (function frame2(ts){
                    var prog = Math.min((ts - t2) / 400, 1);
                    var ease = 1 - Math.pow(1 - prog, 2);
                    bw2.style.clipPath = 'inset(' + (50 + (20 - 50) * ease).toFixed(2) + '% 0 ' + (50 + (20 - 50) * ease).toFixed(2) + '% 0)';
                    if(prog < 1) requestAnimationFrame(frame2);
                })(t2);

                // ホームランキャラ拡大
                setTimeout(function(){
                    ch2.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
                    ch2.style.transform  = 'translate(-50%,-50%) scale(2.0) rotate(-5deg)';
                }, 100);
                // カキーン！
                setTimeout(function(){ playSoundEffect('sound/homerun.mp3'); }, 300);
                // シェイク
                setTimeout(function(){
                    ch2.style.transition = 'transform 0.1s ease';
                    ch2.style.transform  = 'translate(-50%,-50%) scale(1.9) rotate(6deg)';
                }, 430);
                setTimeout(function(){
                    ch2.style.transition = 'transform 0.12s ease';
                    ch2.style.transform  = 'translate(-50%,-50%) scale(1.95) rotate(-3deg)';
                }, 550);
                // 両方フェードアウト
                setTimeout(function(){
                    overlay.style.transition = 'opacity 0.3s ease';
                    overlay.style.opacity    = '0';
                    o2.style.transition      = 'opacity 0.3s ease';
                    o2.style.opacity         = '0';
                }, 750);
                setTimeout(function(){
                    overlay.style.display = 'none'; overlay.style.opacity = '1'; overlay.style.transition = '';
                    bgWrap.style.clipPath  = 'inset(50% 0 50% 0)';
                    o2.style.display = 'none'; o2.style.opacity = '1'; o2.style.transition = '';
                    bw2.style.clipPath = 'inset(50% 0 50% 0)';
                    window.battleSkillAnimBusy = false;
                    callback();
                }, 1080);
            }, 800);
        } else {
            // 通常：種連射演出 → 完了後コールバック（実際のダメージはコールバック内で）
            setTimeout(function(){
                charaImg.style.transition = 'transform 0.25s ease';
                charaImg.style.transform  = 'translate(-50%,-50%) scale(1.15) rotate(3deg)';
            }, 800);
            setTimeout(function(){
                overlay.style.transition = 'opacity 0.3s ease';
                overlay.style.opacity    = '0';
            }, 1150);
            setTimeout(function(){
                overlay.style.display    = 'none';
                overlay.style.opacity    = '1';
                overlay.style.transition = '';
                bgWrap.style.clipPath    = 'inset(50% 0 50% 0)';
                window.battleSkillAnimBusy = false;
                callback();
            }, 1480);
        }
    }

    if(bgImg.complete && bgImg.naturalWidth > 0) { startAnim(); }
    else { bgImg.onload = startAnim; bgImg.onerror = startAnim; }
}
var introHasPlayed = false;

// bg.pngの実際の縦サイズからキャラ座標を動的に計算する
const TOP_CHARA_COORDS = [
    { topId:'topChara5', introId:'iChara5', x:50,  y:718 },
    { topId:'topChara4', introId:'iChara4', x:212, y:744 },
    { topId:'topChara1', introId:'iChara1', x:95,  y:626 },
    { topId:'topChara3', introId:'iChara3', x:430, y:673 },
    { topId:'topChara2', introId:'iChara2', x:272, y:654 },
];

function initTopLayout() {
    var bg = document.querySelector('#topImageArea .top-bg');
    if (!bg) return;
    function apply() {
        var bgW   = bg.naturalWidth;
        var bgH   = bg.naturalHeight;
        if (!bgW || !bgH) return;
        var area  = document.getElementById('topImageArea');
        var cntW  = area.offsetWidth;
        var cntH  = area.offsetHeight;
        // object-fit:cover の縮尺とクロップ量を計算
        var scale     = cntW / bgW;
        var bgHdisp   = bgH * scale;
        var cropTopPx = Math.max(0, (bgHdisp - cntH) / 2);
        TOP_CHARA_COORDS.forEach(function(c) {
            var leftPct = (c.x / bgW * 100).toFixed(2) + '%';
            var topPct  = ((c.y * scale - cropTopPx) / cntH * 100).toFixed(2) + '%';
            [document.getElementById(c.topId), document.getElementById(c.introId)].forEach(function(el) {
                if (!el) return;
                el.style.left = leftPct;
                el.style.top  = topPct;
                // 幅 = キャラPNGのnaturalWidth ÷ bgW（bg.pngと同じ縮尺率）
                function setW() { if (el.naturalWidth > 0) el.style.width = (el.naturalWidth / bgW * 100).toFixed(2) + '%'; }
                if (el.complete && el.naturalWidth > 0) { setW(); } else { el.onload = setW; }
            });
        });
    }
    if (bg.complete && bg.naturalHeight > 0) { apply(); }
    else { bg.onload = apply; }
}

function playIntroAnimation() {
    if (introHasPlayed) return;
    introHasPlayed = true;
    var overlay = document.getElementById('introOverlay');
    if (!overlay) return;

    // フェーズ2 (900ms)：bgStageを画像エリアへ縮める、ロゴを上へ
    setTimeout(function() {
        var target = document.getElementById('topImageArea');
        if (!target) return;
        var rect = target.getBoundingClientRect();
        var stage = document.getElementById('introBgStage');
        stage.style.transition = 'top 1.1s cubic-bezier(0.4,0,0.2,1),left 1.1s cubic-bezier(0.4,0,0.2,1),width 1.1s cubic-bezier(0.4,0,0.2,1),height 1.1s cubic-bezier(0.4,0,0.2,1),filter 1.1s ease,border-radius 1.1s ease';
        stage.style.top          = rect.top    + 'px';
        stage.style.left         = rect.left   + 'px';
        stage.style.width        = rect.width  + 'px';
        stage.style.height       = rect.height + 'px';
        stage.style.filter       = 'blur(0px) brightness(1)';
        stage.style.borderRadius = '8px';
        document.getElementById('iWhiteOverlay').style.opacity = '0';
        var logo = document.getElementById('introLogo');
        logo.style.top       = '24px';
        logo.style.transform = 'translateX(-50%)';
        logo.style.width     = '192px';
    }, 900);

    // フェーズ3 (2100ms~)：キャラクターをふわっと出現（黒マント→赤マント→女の子→芋→にんじん）
    ['iChara2','iChara1','iChara3','iChara4','iChara5'].forEach(function(id, i) {
        setTimeout(function() {
            var el = document.getElementById(id);
            if (el) el.classList.add('appear');
        }, 2100 + i * 260);
    });

    // フェーズ5 (4200ms)：オーバーレイをフェードアウト
    setTimeout(function() {
        var logo = document.getElementById('introLogo');
        if (logo) { logo.style.transition += ',opacity 0.4s ease'; logo.style.opacity = '0'; }
        overlay.classList.add('fade-out');
        setTimeout(function() { overlay.style.display = 'none'; }, 700);
    }, 4200);
}

function hideCookStatPreview() {
    const panel = document.getElementById('cookStatFixed');
    if(panel) panel.style.display = 'none';
    const guide = document.getElementById('questGuideChar');
    if(guide && guide.dataset.hiddenByCook === '1') {
        guide.dataset.hiddenByCook = '0';
        guide.style.display = guide.dataset.prevDisplay || '';
    }
}

function switchTab(tab, el) {
    const arena = document.getElementById("battleArena");
    // バトル中に別タブへ移動→強制終了（負け）
    if(arena && arena.style.display === "block") {
        const resultBox = document.getElementById("battleResultBox");
        const resultOverlay = document.getElementById("battleResultOverlay");
        const overlayShowing = resultOverlay && resultOverlay.style.display === "flex";
        const resultShowing = resultBox && resultBox.style.display !== "none";
        if(!overlayShowing && !resultShowing) {
            // バトル中（結果未表示）→強制負け
            if(!isBotMatch && currentRoomId && database) {
                database.ref('rooms/'+currentRoomId+'/forfeit').set(onlineRole);
            }
            forceForfeit();
            return;
        } else {
            // 結果表示済み or 勝敗オーバーレイ表示中→通常通りタブ切り替え
            endBattleScene();
        }
    }
    const tagArena = document.getElementById("tagBattleArena");
    if(tagArena && tagArena.style.display === "block") {
        const tagResultBox = document.getElementById("tagBattleResultBox");
        const tagResultOverlay = document.getElementById("tagBattleResultOverlay");
        const tagOverlayShowing = tagResultOverlay && tagResultOverlay.style.display === "flex";
        const tagResultShowing = tagResultBox && tagResultBox.style.display !== "none";
        if(!tagOverlayShowing && !tagResultShowing) {
            // タッグ戦中（結果未表示）→強制終了。勝敗に関わらず出撃カレーは消費する
            tagBattleAborted = true;
            if(tagBattleFighters && tagBattleFighters[0] && tagBattleFighters[0].curry) {
                const myIdx = curryStock.indexOf(tagBattleFighters[0].curry);
                if(myIdx !== -1) curryStock.splice(myIdx, 1);
                if(selectedCurryIndex >= curryStock.length) selectedCurryIndex = curryStock.length - 1;
                saveGame(); updateFridgeUI(); updateCookSelects(); updateMatchCurrySelects();
            }
            endTagBattleScene();
        } else {
            // 結果表示済み→通常通りタブ切り替え
            endTagBattleScene();
        }
    }
    if(tab !== 'cook') hideCookStatPreview();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const hp = document.getElementById('pageGuide'); if(hp) hp.classList.remove('active');
    if(el) el.classList.add('active');
    const targetPage = document.getElementById('page' + tab.charAt(0).toUpperCase() + tab.slice(1));
    if(targetPage) targetPage.classList.add('active');
    cancelScanning();
    if(tab === 'quest') { renderLoginBonus(); renderDailyQuest(); checkAndRenderAchievements(); renderShopInfoList(); showQuestGuideChar(); }
    else if(tab === 'fridge') { showFridgeGuideChar(); }
    else if(tab === 'cook') { showCookGuideChar(); }
    else if(tab === 'battle') { showBattleGuideChar(); }
    else { hideQuestGuideChar(); }
    if(tab === 'battle') { loadEventEnabledStatus(); }
    if(tab === 'cook') {
        // プルダウンがなしならヒントをクリア
        [1,2,3].forEach(n => { const sel = document.getElementById("ingredient"+n); if(sel && !sel.value) { const h = document.getElementById("statHint"+n); if(h) h.innerText=""; } });
        const spSel = document.getElementById("spice"); if(spSel && !spSel.value) { const hs = document.getElementById("statHintSpice"); if(hs) hs.innerText=""; }
        // 現在表示中のカテゴリに所持食材が無ければ、所持している食材がある別カテゴリを自動選択
        if(getCookCategoryItems(COOK_CATEGORY_DEFS[cookActiveCategoryIdx].key).length === 0) {
            const idx = COOK_CATEGORY_DEFS.findIndex(c => getCookCategoryItems(c.key).length > 0);
            if(idx !== -1 && idx !== cookActiveCategoryIdx) { cookActiveCategoryIdx = idx; renderCookPickerUI(); }
        }
    }
}

function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem('qr_muted', isMuted ? '1' : '0');
    if(isMuted && battleBGM) { battleBGM.pause(); }
    updateMuteIcon();
}

// システム・設定画面のボタンから直接オン/オフを指定する
function setMuteState(mute) {
    isMuted = mute;
    localStorage.setItem('qr_muted', isMuted ? '1' : '0');
    if(isMuted && battleBGM) { battleBGM.pause(); }
    updateMuteIcon();
}

function updateMuteIcon() {
    const icon = document.getElementById('muteIcon');
    if(icon) icon.src = isMuted ? 'sound-off.svg' : 'sound-on.svg';
    const onBtn = document.getElementById('settingsSoundOnBtn');
    const offBtn = document.getElementById('settingsSoundOffBtn');
    if(onBtn && offBtn) {
        onBtn.classList.toggle('active', !isMuted);
        offBtn.classList.toggle('active', isMuted);
    }
}

function setCookAnimSkip(skip) {
    localStorage.setItem('qr_skip_cook_anim', skip ? '1' : '0');
    const onBtn  = document.getElementById('cookAnimOnBtn');
    const offBtn = document.getElementById('cookAnimOffBtn');
    if(onBtn && offBtn) {
        onBtn.classList.toggle('active', !skip);
        offBtn.classList.toggle('active', skip);
    }
}
function initCookAnimSetting() {
    const skip = localStorage.getItem('qr_skip_cook_anim') === '1';
    setCookAnimSkip(skip);
}

let helpOpenedFromTop = false; // 「？」をトップ画面から開いたかどうかを記憶

function toggleHelp() {
    const guidePanel = document.getElementById('pageGuide');
    if(!guidePanel) return;
    const isShowing = guidePanel.classList.contains('active');
    if(isShowing) {
        // チュートリアルを閉じて、元いた場所に戻る
        guidePanel.classList.remove('active');
        if(helpOpenedFromTop) {
            // トップ画面から開いていた場合はトップ画面に戻す
            document.getElementById('gameUI').style.display = 'none';
            document.getElementById('pageTop').style.display = 'flex';
        } else {
            // ゲーム内（プレイヤータブ等）から開いていた場合はプレイヤータブに戻る
            const questTab = document.querySelector('[onclick*="quest"]');
            const questPage = document.getElementById('pageQuest');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            if(questTab) questTab.classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            if(questPage) questPage.classList.add('active');
            showQuestGuideChar();
        }
    } else {
        // バトル中は「？」を無効化（戦闘画面から抜けられなくなるのを防ぐ）
        const arena = document.getElementById('battleArena');
        const tagArena = document.getElementById('tagBattleArena');
        if((arena && arena.style.display === 'block') || (tagArena && tagArena.style.display === 'block')) {
            return;
        }
        // 今トップ画面にいるかどうかを記憶しておく
        const topPage = document.getElementById('pageTop');
        helpOpenedFromTop = !!(topPage && topPage.style.display !== 'none');
        if(helpOpenedFromTop) {
            // トップ画面からの場合：gameUIを表示状態にしてからチュートリアルを被せる
            topPage.style.display = 'none';
            document.getElementById('gameUI').style.display = 'block';
        }
        // 全タブ非表示にしてチュートリアルを表示（常に1ページ目から）
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        guidePanel.classList.add('active');
        hideQuestGuideChar();
        tutorialGoToPage(1);
    }
}

// ============================================================
// チュートリアル画像ビューアー
// ============================================================
const TUTORIAL_TOTAL_PAGES = 6;
let tutorialCurrentPage = 1;

function tutorialGoToPage(page) {
    if(page < 1) page = 1;
    if(page > TUTORIAL_TOTAL_PAGES) page = TUTORIAL_TOTAL_PAGES;
    tutorialCurrentPage = page;
    const img = document.getElementById('tutorialImage');
    if(img) img.src = 'tutorial/tutorial-' + String(page).padStart(2, '0') + '.png';
    const indicator = document.getElementById('tutorialPageIndicator');
    if(indicator) indicator.innerText = page + ' / ' + TUTORIAL_TOTAL_PAGES;
    const prevBtn = document.getElementById('tutorialPrevBtn');
    const nextBtn = document.getElementById('tutorialNextBtn');
    if(prevBtn) prevBtn.disabled = (page === 1);
    if(nextBtn) nextBtn.disabled = (page === TUTORIAL_TOTAL_PAGES);
    const wrap = document.getElementById('tutorialImageWrap');
    if(wrap) wrap.scrollTop = 0;
    tutorialRenderDots();
    if(page === TUTORIAL_TOTAL_PAGES) {
        updateStats(s => { s.tutorialCompleted = true; });
        checkAndRenderAchievements();
    }
}

function tutorialRenderDots() {
    const dotsWrap = document.getElementById('tutorialDots');
    if(!dotsWrap) return;
    dotsWrap.innerHTML = '';
    for(let i = 1; i <= TUTORIAL_TOTAL_PAGES; i++) {
        const dot = document.createElement('div');
        dot.className = 'tutorial-dot' + (i === tutorialCurrentPage ? ' active' : '');
        dot.onclick = function() { tutorialGoToPage(i); };
        dotsWrap.appendChild(dot);
    }
}

function tutorialGoPrev() { tutorialGoToPage(tutorialCurrentPage - 1); }
function tutorialGoNext() { tutorialGoToPage(tutorialCurrentPage + 1); }

function setupTutorialSwipe() {
    const wrap = document.getElementById('tutorialImageWrap');
    if(!wrap) return;
    let startX = 0, startY = 0, tracking = false;

    wrap.addEventListener('touchstart', function(e) {
        if(e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        tracking = true;
    }, { passive: true });

    wrap.addEventListener('touchend', function(e) {
        if(!tracking) return;
        tracking = false;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = endX - startX;
        const diffY = endY - startY;
        if(Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
            if(diffX < 0) tutorialGoNext();
            else tutorialGoPrev();
        }
    }, { passive: true });
}
function saveGame() {
    localStorage.setItem('qr_curry_inv', JSON.stringify(inventory));
    localStorage.setItem('qr_curry_history', JSON.stringify(scanHistory));
    localStorage.setItem('qr_curry_g', playerG);
    localStorage.setItem('qr_curry_exp', playerEXP);
    localStorage.setItem('qr_curry_ticket', packTicket);
    localStorage.setItem('qr_curry_spicycoin', spicyCoin);
    localStorage.setItem('qr_curry_pname', playerName);
    localStorage.setItem('qr_curry_recipes', JSON.stringify(recipeBook));
    localStorage.setItem('qr_curry_stock', JSON.stringify(curryStock));
    localStorage.setItem('qr_curry_discovered', JSON.stringify(discoveredItems));
    localStorage.setItem('qr_curry_locked', JSON.stringify(lockedItems));
    localStorage.setItem('qr_selected_base', selectedBase);
    localStorage.setItem('qr_selected_tableware', selectedTableware);
    localStorage.setItem('qr_unlock_alumite_tableware', unlockAlumiteTableware ? '1' : '0');
    localStorage.setItem('qr_unlock_wood_tableware', unlockWoodTableware ? '1' : '0');
    localStorage.setItem('qr_unlock_oval_tableware', unlockOvalTableware ? '1' : '0');
    localStorage.setItem('qr_unlock_thali_tableware', unlockThaliTableware ? '1' : '0');
    document.getElementById("globalG").innerText = playerG;
    document.getElementById("globalTicket").innerText = packTicket;
    document.getElementById("globalSpicyCoin").innerText = spicyCoin;
    updateShopButtons();
    updateLvDisplay();
    syncSaveDataToCloud();
}

// ===== 同期の失敗・異常検知をFirebaseに記録（不具合調査用） =====
// ユーザーからの不具合報告だけに頼らず、実際にどの環境でどんな頻度で同期異常が
// 起きているかを後から確認できるようにする。admin.htmlの「同期エラーログ」から閲覧可能。
function logSyncEvent(context, detail) {
    // Firebaseへの送信が失敗する状況（認証エラー等）でも本人が気づけるよう、
    // デバッグモード中は画面内エラーパネルにも同じ内容を必ず出す（Firebase書き込みの成否に関わらず）。
    if (typeof window.__showDebugErrorPanel === 'function') {
        window.__showDebugErrorPanel('syncEvent [' + context + ']: ' + (detail || ''));
    }
    if(!database) return;
    try {
        database.ref('syncErrors').push({
            playerId: playerId || '(unknown)',
            context: context,
            detail: detail || '',
            isIframe: (window.self !== window.top),
            referrer: document.referrer || '',
            userAgent: navigator.userAgent || '',
            timestamp: Date.now()
        }).catch(function(){ /* ログ自体の送信失敗は無視 */ });
    } catch(e) { /* noop */ }
}

// ===== クラウド同期（複数デバイス間でのセーブデータ同期） =====
function syncSaveDataToCloud() {
    if(!database || !playerId) return;
    try {
        const now = Date.now();
        const data = buildSaveDataObject();
        data.timestamp = now;
        // 送信が実際に成功したことを確認してから、ローカルの「自分が最後に更新した時刻」を確定させる。
        // （以前は送信完了を待たずに先に確定させていたが、ポータルサイトへの埋め込み等で
        // 書き込みが失敗した場合に、クラウド側が古いままなのにローカルだけ「最新」と思い込み、
        // 次回ロード時にcheckCloudSyncOnLoad()が誤って「別デバイスでの更新」と判定し、
        // 進行中のデータを古いクラウドデータで上書きしてしまう不具合があったため修正。）
        database.ref('players/' + playerId + '/savedata').set(data).then(function(){
            localStorage.setItem('qr_last_synced_ts', String(now));
            if (typeof window.__showDebugErrorPanel === 'function') {
                window.__showDebugErrorPanel('✅ クラウド同期 成功 (ts=' + now + ')');
            }
        }).catch(function(err){
            logSyncEvent('syncSaveDataToCloud_write_failed', err && err.message ? err.message : String(err));
        });
    } catch(e) {
        console.error('syncSaveDataToCloud error:', e); // クラウド同期の異常がゲーム本体の処理を止めないようにする
        if (typeof window.__showDebugErrorPanel === 'function') {
            window.__showDebugErrorPanel('syncSaveDataToCloud例外（送信前に失敗): ' + (e && e.message ? e.message : String(e)));
        }
    }
}

// syncSealと実際の数値が食い違っていないか確認する。ゲームクライアントを経由しない
// 直接書き込みでは、この値まで正しく再現するのは難しいという前提のチェック。
// syncSeal自体が存在しない（＝この機能より前のデータ、または一度も同期していない）場合は対象外にする。
// syncSeal（経済値4項目）・scanSeal（scanHistory・scanTotal）・festSeal（フェス自己ベスト・参加回数）の
// 3種類を確認する。いずれか存在しない（＝この機能より前のデータ、または一度も同期していない）場合は
// その項目だけ対象外にする。複数同時に不一致になった場合はreasonにカンマ区切りで全て記録する。
function checkSyncSealIntegrity(cloud) {
    if (!cloud) return;
    const mismatches = [];
    if (cloud.syncSeal !== undefined && cloud.syncSeal !== null) {
        const expected = computeSyncSeal(cloud.playerId || playerId, cloud.playerG, cloud.playerEXP, cloud.packTicket, cloud.spicyCoin);
        if (cloud.syncSeal !== expected) mismatches.push('economy');
    }
    if (cloud.scanSeal !== undefined && cloud.scanSeal !== null) {
        const cloudScanTotal = (cloud.stats && cloud.stats.scanTotal) || 0;
        const expectedScan = computeScanSeal(cloud.playerId || playerId, cloudScanTotal, cloud.scanHistory || {});
        if (cloud.scanSeal !== expectedScan) mismatches.push('scanHistory');
    }
    if (cloud.festSeal !== undefined && cloud.festSeal !== null) {
        const cloudFestBest = (cloud.stats && cloud.stats.festBestStreak) || 0;
        const cloudFestJoin = (cloud.stats && cloud.stats.festJoinCount) || 0;
        const expectedFest = computeFestSeal(cloud.playerId || playerId, cloudFestBest, cloudFestJoin);
        if (cloud.festSeal !== expectedFest) mismatches.push('fest');
    }
    if (mismatches.length > 0) {
        flagIntegrityMismatch(cloud.playerId || playerId, cloud.playerName, mismatches.join(','));
    }
}

// 直接改ざんの疑いを検知した場合の処理。
// 本人に気づかれないよう、エラー表示や特別な演出は一切出さない。
// ・管理者だけが読める場所に検知記録を残す（本人のクライアントからは読み取れない）
// ・以降のゲーム開始操作にだけ、通信不調に見える形の抑止をかける（simulateFailedGameStart参照）
// reason: 'economy'（syncSeal不一致）/ 'scanHistory'（scanSeal不一致）/ 'fest'（festSeal不一致）を
// カンマ区切りで組み合わせた文字列（例: 'economy,fest'）。複数不一致の場合は全て含まれる。
function flagIntegrityMismatch(pid, name, reason) {
    window.__integrityFlagged = true;
    if (database && pid) {
        try {
            database.ref('fraudAlerts/' + pid).push({
                name: name || '',
                detectedAt: Date.now(),
                reason: reason || 'economy'
            }).catch(function(){});
        } catch(e) { /* noop */ }
    }
}

function checkCloudSyncOnLoad() {
    if(!database || !playerId) return;
    database.ref('players/' + playerId + '/savedata').once('value').then(function(snap){
        const cloud = snap.val();
        if(!cloud) return;
        checkSyncSealIntegrity(cloud); // タイムスタンプの一致・不一致に関わらず毎回確認する
        if(!cloud.timestamp) return;
        const localTs = localStorage.getItem('qr_last_synced_ts');
        if(String(cloud.timestamp) === String(localTs)) return; // 自分が最後の更新者
        // 別デバイスでの更新を検知（誤検知調査のため発生状況を記録しておく）
        logSyncEvent('remoteUpdateApplied', 'cloudTs=' + cloud.timestamp + ' localTs=' + localTs);
        showCustomAlert("🔄 同期", "ダウンロードが完了しました。", function(){
            applySaveDataObject(cloud);
            localStorage.setItem('qr_last_synced_ts', String(cloud.timestamp));
            saveGameLocalOnly();
            updateFridgeUI(); updateCookSelects(); refreshRecipeBookUI();
            updateShopButtons(); updateMatchCurrySelects();
            setupLoadedIconUI(); updateLvDisplay(); initQuest();
            ensureDeliveryCurrySynced();
        });
    }).catch(function(err){
        logSyncEvent('checkCloudSyncOnLoad_read_failed', err && err.message ? err.message : String(err));
    });
}

// localStorageのみ更新（クラウドへの再送信はしない。同期取得直後の保存用）
function saveGameLocalOnly() {
    localStorage.setItem('qr_curry_inv', JSON.stringify(inventory));
    localStorage.setItem('qr_curry_history', JSON.stringify(scanHistory));
    localStorage.setItem('qr_curry_g', playerG);
    localStorage.setItem('qr_curry_exp', playerEXP);
    localStorage.setItem('qr_curry_ticket', packTicket);
    localStorage.setItem('qr_curry_spicycoin', spicyCoin);
    localStorage.setItem('qr_curry_pname', playerName);
    localStorage.setItem('qr_curry_recipes', JSON.stringify(recipeBook));
    localStorage.setItem('qr_curry_stock', JSON.stringify(curryStock));
    localStorage.setItem('qr_curry_discovered', JSON.stringify(discoveredItems));
    localStorage.setItem('qr_curry_locked', JSON.stringify(lockedItems));
    localStorage.setItem('qr_selected_base', selectedBase);
    localStorage.setItem('qr_selected_tableware', selectedTableware);
    localStorage.setItem('qr_unlock_alumite_tableware', unlockAlumiteTableware ? '1' : '0');
    localStorage.setItem('qr_unlock_wood_tableware', unlockWoodTableware ? '1' : '0');
    localStorage.setItem('qr_unlock_oval_tableware', unlockOvalTableware ? '1' : '0');
    localStorage.setItem('qr_unlock_thali_tableware', unlockThaliTableware ? '1' : '0');
    document.getElementById("globalG").innerText = playerG;
    document.getElementById("globalTicket").innerText = packTicket;
    document.getElementById("globalSpicyCoin").innerText = spicyCoin;
}
function generateSecretKey() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateRandomIdSuffix() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字(0,O,1,I)を除外
    let s = '';
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

function checkGiftQueue() {
    if(!database || !playerId) return;
    database.ref('giftQueue/' + playerId).once('value').then(function(snap){
        const gifts = snap.val();
        if(!gifts) return;
        const normalPool = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 0 && isIngredientAvailable(k));
        const midHighPool = Object.keys(masterIngredients).filter(k => (masterIngredients[k].shop === 1 || masterIngredients[k].shop === 2) && isIngredientAvailable(k));
        const spicePool = Object.keys(masterSpices).filter(k => k !== "マンゴーチャツネ" && k !== "サフラン" && isIngredientAvailable(k));
        let allItems = [];
        let totalGold = 0, totalTicket = 0, totalSpicyCoin = 0;
        Object.keys(gifts).forEach(function(giftKey){
            const g = gifts[giftKey];
            for(let i=0;i<(g.normalCount||0);i++){ const it=normalPool[Math.floor(Math.random()*normalPool.length)]; inventory[it]=(inventory[it]||0)+1; discoveredItems[it]=true; allItems.push(it); }
            for(let i=0;i<(g.midHighCount||0);i++){ if(midHighPool.length===0) break; const it=midHighPool[Math.floor(Math.random()*midHighPool.length)]; inventory[it]=(inventory[it]||0)+1; discoveredItems[it]=true; allItems.push(it); }
            for(let i=0;i<(g.spiceCount||0);i++){ const it=spicePool[Math.floor(Math.random()*spicePool.length)]; inventory[it]=(inventory[it]||0)+1; discoveredItems[it]=true; allItems.push(it); }
            totalGold += (g.gold||0); totalTicket += (g.ticket||0); totalSpicyCoin += (g.spicyCoin||0);
        });
        playerG += totalGold; packTicket += totalTicket; spicyCoin += totalSpicyCoin;
        saveGame(); updateFridgeUI(); updateCookSelects(); updateShopButtons();
        database.ref('giftQueue/' + playerId).remove();
        const itemsHtml = allItems.map(it=>{ const d=masterIngredients[it]||masterSpices[it]; const ico=d&&d.icon?`<img src="${d.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">`:''; return ico+it; }).join(' ');
        let msg = '';
        if(allItems.length) msg += `アイテム: ${itemsHtml}<br>`;
        if(totalGold) msg += `💰 +${totalGold}G<br>`;
        if(totalTicket) msg += `🎟️ +${totalTicket}枚<br>`;
        if(totalSpicyCoin) msg += `🌶️ +${totalSpicyCoin}枚`;
        showCustomAlert('🎁 プレゼントが届きました！', msg || '届きました！');
    });
}

// 管理ツールから配信される「お知らせ手紙」を受信する（個別宛・全員宛の両方）
// announceQueue/{playerId} : 個別宛（送信時に1件追加され、受信後削除）
// globalAnnouncements/{id} : 全員宛（共通の1件をみんなが参照。各プレイヤーは自分が見た最後のIDをlocalStorageで管理）
let announceListenerStarted = false;
// 管理ツールから配信される「お知らせ手紙」をリアルタイムで受信する（個別宛・全員宛の両方）
// announceQueue/{playerId} : 個別宛（送信時に1件追加され、受信後削除）
// globalAnnouncements/{id} : 全員宛（共通の1件をみんなが参照。各プレイヤーは自分が見た最後のIDをlocalStorageで管理）
function checkAnnouncements() {
    if(!database || !playerId || announceListenerStarted) return;
    announceListenerStarted = true;

    // 個別宛：リアルタイムで検知し、処理後にその要素だけ削除する
    const queueRef = database.ref('announceQueue/' + playerId);
    queueRef.on('child_added', function(childSnap){
        const a = childSnap.val();
        if(!a) return;
        addPostMessage(buildAnnouncementPostOpts(a, childSnap.key));
        queueRef.child(childSnap.key).remove();
    });

    // 全員宛：まず起動時点までの既存分を一括で既読化（重複防止）してから、それ以降の新規分だけリアルタイム検知する
    const globalRef = database.ref('globalAnnouncements');
    globalRef.once('value').then(function(snap){
        const items = snap.val();
        const lastSeen = localStorage.getItem('qr_last_global_announce') || '';
        let newestKey = lastSeen;
        if(items) {
            const keys = Object.keys(items).sort(); // pushキーは時系列順に並ぶ
            keys.forEach(function(key){
                if(key > lastSeen) {
                    addPostMessage(buildAnnouncementPostOpts(items[key], key));
                    newestKey = key;
                }
            });
        }
        if(newestKey !== lastSeen) localStorage.setItem('qr_last_global_announce', newestKey);
    }).then(function(){
        // 既存分の処理が完了した後だけ、新規追加分をリアルタイムで検知する（重複防止のため順序を保証）
        globalRef.on('child_added', function(childSnap){
            const lastSeen2 = localStorage.getItem('qr_last_global_announce') || '';
            if(childSnap.key <= lastSeen2) return; // 既に処理済みのものは無視
            const a = childSnap.val();
            if(!a) return;
            addPostMessage(buildAnnouncementPostOpts(a, childSnap.key));
            localStorage.setItem('qr_last_global_announce', childSnap.key);
        });
    }).catch(function(e){ console.error('checkAnnouncements error:', e); });

    // 誤送信の取り消し対応：revokedAnnouncementsに記録されたIDの手紙を、自分のポストから削除する
    const revokedRef = database.ref('revokedAnnouncements');
    revokedRef.once('value').then(function(snap){
        const revoked = snap.val();
        if(revoked) {
            removePostMessagesByAnnounceIds(Object.keys(revoked));
        }
    }).then(function(){
        revokedRef.on('child_added', function(childSnap){
            removePostMessagesByAnnounceIds([childSnap.key]);
        });
    }).catch(function(e){ console.error('revokedAnnouncements check error:', e); });
}
// 指定したannounceIdに該当する手紙を、自分のポスト（postMessages）から削除する
function removePostMessagesByAnnounceIds(ids) {
    if(!ids || ids.length === 0) return;
    const before = postMessages.length;
    postMessages = postMessages.filter(m => !m.announceId || !ids.includes(m.announceId));
    if(postMessages.length !== before) {
        savePostMessages();
        updatePostButtonUI();
        // 詳細画面やポスト一覧を開いている最中だった場合に備えて再描画する
        const listOverlay = document.getElementById('postListOverlay');
        if(listOverlay && listOverlay.style.display === 'flex') renderPostList();
        const detailOverlay = document.getElementById('postDetailOverlay');
        if(detailOverlay && detailOverlay.style.display === 'flex') {
            detailOverlay.style.display = 'none';
            showCustomAlert('📮 お知らせ', '表示中の手紙が運営により取り消されました。');
        }
    }
}
// お知らせデータ（管理ツールで作成）をaddPostMessage用のオプションに変換する
function buildAnnouncementPostOpts(a, announceId) {
    let body = a.body || '';
    let image = a.image || null;
    // 「QR画像をタップでスキャン」注釈付きの店舗紹介QRに対応（imageBottomがある場合はタップでスキャン扱いにする）
    return {
        announceId: announceId || null,
        subject: a.subject || 'お知らせ',
        body: body,
        image: image,
        imageBottom: a.imageBottom || null,
        imageBottomUrl: a.imageBottomUrl || null,
        imageBottom2: a.imageBottom2 || null,
        imageBottomUrl2: a.imageBottomUrl2 || null,
        shopQrAction: a.shopQrAction || null, // 'shop1' 等、タップ時に店舗QRスキャン相当の処理を呼ぶ識別子
        expireMinutesAfterRead: a.expireMinutesAfterRead || null,
        rewardPack: a.rewardPack || 0,
        rewardGold: a.rewardGold || 0,
        rewardSpicyCoin: a.rewardSpicyCoin || 0,
        rewardItems: a.rewardItems || []
    };
}

// 宅配カレーが他プレイヤーに使用された結果の報酬・食べ尽くされ通知をログイン時に処理
// 宅配カレー報酬は起動時・プレイ中ともにリアルタイム購読（startDeliveryRewardListener）で処理する。
// 購読開始時にchild_addedが既存データにも発火するため、起動時の一括チェックは別途行わない（重複処理防止）。
// 受け取ったdeliveryRewardQueueの内容を手紙にする共通処理（起動時チェック・リアルタイム購読の両方から呼ばれる）
function processDeliveryRewards(rewards) {
    const normalPool = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 0 && isIngredientAvailable(k));
    const midHighPool = Object.keys(masterIngredients).filter(k => (masterIngredients[k].shop === 1 || masterIngredients[k].shop === 2) && isIngredientAvailable(k));
    let totalGold = 0;
    let totalWinItems = [];
    let activeCurryImage = ''; // 報酬手紙に添付する画像（生きている宅配カレーの画像、複数あれば最後のもの）
    Object.keys(rewards).forEach(function(key){
        const r = rewards[key];
        // 完売（eatenUp）の通知・curryStockからの削除は別のリアルタイム購読（handleEatenUpEntry）が担当するため、ここでは活躍報告の集計のみ行う
        if(r.eatenUp) return;
        totalGold += (r.usedCount || 0) * 30;
        for(let i = 0; i < (r.winCount || 0); i++) {
            // 抽選結果だけ確定（在庫への加算は手紙を開封して受け取った時点で行う）
            const pool = [...normalPool, ...midHighPool];
            const it = pool[Math.floor(Math.random() * pool.length)];
            totalWinItems.push(it);
        }
        if(r.curryImage) activeCurryImage = r.curryImage;
    });

    // 「宅配カレー活躍報告」の手紙（報酬がある場合のみ。受け取りは手紙を開封した時点）
    if(totalGold > 0 || totalWinItems.length > 0) {
        addPostMessage({
            subject: '宅配カレー活躍報告',
            body: '宅配カレーが活躍しましたので報酬をお送りします！',
            image: activeCurryImage || null,
            rewardGold: totalGold,
            rewardItems: totalWinItems,
            expireMinutesAfterRead: 60
        });
    }
    saveGame(); updateFridgeUI(); updateCookSelects(); updateShopButtons(); updateMatchCurrySelects();
}
// 「宅配カレー完売報告」：1件のキューエントリ（eatenUp:true）を処理する。リアルタイム購読・ログイン時一括処理の両方から呼ばれる
function handleEatenUpEntry(r) {
    if(!r || !r.eatenUp || !r.curryName) return;
    // 食べ尽くされた宅配カレーを、自分のストックからも完全に削除する
    // （宅配カレーは常に最大1件のみ設定可能なため、isDeliveringフラグだけで一意に特定できる）
    curryStock = curryStock.filter(c => !c.isDelivering);
    if(selectedCurryIndex >= curryStock.length) selectedCurryIndex = curryStock.length - 1;
    addPostMessage({
        subject: '宅配カレー完売報告',
        body: `${r.curryName}は食べ尽くされてしまいました。\nまた設定しましょう！`,
        image: r.curryImage || null,
        expireMinutesAfterRead: 60
    });
    saveGame(); updateFridgeUI(); updateCookSelects(); updateShopButtons(); updateMatchCurrySelects();
}
// プレイ中（ブラウザを開いたまま）にも宅配カレー報酬を即座に検知するためのリアルタイム購読
let deliveryRewardListenerStarted = false;
// 宅配カレー報酬はログイン時にまとめて1回だけ手紙にする（プレイ中の連続通知を避けるためリアルタイム検知はしない）
function startDeliveryRewardListener() {
    if(!database || !playerId || deliveryRewardListenerStarted) return;
    deliveryRewardListenerStarted = true;
    const ref = database.ref('deliveryRewardQueue/' + playerId);

    // 「完売報告」はリアルタイムで検知し、1件ずつ即座に処理＋個別削除する（起動時に溜まっていた分にも発火する）
    ref.on('child_added', function(childSnap){
        const r = childSnap.val();
        if(r && r.eatenUp) {
            handleEatenUpEntry(r);
            ref.child(childSnap.key).remove();
        }
    });

    // 「活躍報告（報酬）」はログイン時に溜まっている分だけをまとめて1回処理する（プレイ中の連続通知を避けるため）
    ref.once('value').then(function(snap){
        const rewards = snap.val();
        if(rewards) {
            // eatenUpのエントリは上のリアルタイム購読が個別に処理するため、ここでは対象外にする
            const nonEatenUp = {};
            let hasNonEatenUp = false;
            Object.keys(rewards).forEach(function(key){
                if(!rewards[key].eatenUp) { nonEatenUp[key] = rewards[key]; hasNonEatenUp = true; }
            });
            if(hasNonEatenUp) processDeliveryRewards(nonEatenUp);
            // 処理済みの非eatenUpエントリだけ個別に削除（eatenUpエントリはリアルタイム購読側が削除するため触らない）
            const removals = Object.keys(nonEatenUp).map(key => ref.child(key).remove());
            return Promise.all(removals);
        }
    }).catch(function(e){ console.error('startDeliveryRewardListener error:', e); });
}

function initPlayerId(onReady) {
    if (!playerSecretKey) {
        playerSecretKey = generateSecretKey();
        localStorage.setItem('qr_secret_key', playerSecretKey);
    }
    if (!database) {
        // Firebase未接続の場合は認証をスキップしてローカルのみで処理
        initPlayerIdAfterAuth(onReady);
        return;
    }
    ensureFirebaseAuth().then(function() {
        if (!currentUid) showCloudSyncWarningBanner();
        initPlayerIdAfterAuth(onReady);
    });
}

function initPlayerIdAfterAuth(onReady) {
    if (playerId) {
        // 既にローカルにIDがあればそのまま表示
        updatePlayerIdDisplay();
        // Firebaseに登録済みか確認（未登録ならこの機会に登録、UID未紐付けならこの機会に紐付ける＝所有権の確定）
        if (database) {
            database.ref('players/' + playerId).once('value').then(function(snap) {
                if (!snap.exists()) {
                    database.ref('players/' + playerId).set({ secretKey: playerSecretKey, name: playerName, createdAt: Date.now(), uid: currentUid });
                } else {
                    const existing = snap.val() || {};
                    if (!existing.uid && currentUid) {
                        database.ref('players/' + playerId + '/uid').set(currentUid).catch(function(){});
                    }
                    isAnalyticsExcluded = !!existing.analyticsExcluded;
                    if (existing.forceRemoveDelivering) {
                        // 管理ツールからの強制削除指示：通知なしで配達中カレーを冷蔵庫から消す
                        curryStock = curryStock.filter(function(c){ return !c.isDelivering; });
                        if (selectedCurryIndex >= curryStock.length) selectedCurryIndex = curryStock.length - 1;
                        saveGame();
                        if (typeof updateFridgeUI === 'function') updateFridgeUI();
                        if (typeof updateCookSelects === 'function') updateCookSelects();
                        if (typeof updateMatchCurrySelects === 'function') updateMatchCurrySelects();
                        database.ref('players/' + playerId + '/forceRemoveDelivering').remove();
                        database.ref('deliveryCurries/' + playerId).remove();
                    }
                }
                ensureDeliveryCurrySynced(); // ローカルが宅配中なのにFirebase上に存在しない場合、再公開する（強制削除処理の後に実行し、再公開との競合を防ぐ）
            });
            checkGiftQueue();
            checkAnnouncements(); // 管理ツールから配信されたお知らせ手紙（個別・全員宛）を確認
            checkCloudSyncOnLoad(); // 別デバイスでの進行を検知したら同期確認
            startDeliveryRewardListener(); // 起動時・プレイ中ともにリアルタイムで宅配カレー報酬を検知する
        }
        if(onReady) onReady();
        return;
    }
    if (!database) {
        // Firebase未接続の場合はローカルのみでID発行（後で同期される可能性あり）
        playerId = 'BC-' + generateRandomIdSuffix();
        localStorage.setItem('qr_player_id', playerId);
        updatePlayerIdDisplay();
        if(onReady) onReady();
        return;
    }
    // 新規ID発行：重複しないIDを探して登録
    function tryAssign() {
        const candidate = 'BC-' + generateRandomIdSuffix();
        database.ref('players/' + candidate).once('value').then(function(snap) {
            if (snap.exists()) {
                tryAssign(); // 重複したら再試行（極めて低確率）
            } else {
                database.ref('players/' + candidate).set({ secretKey: playerSecretKey, name: playerName, createdAt: Date.now(), uid: currentUid }).then(function() {
                    playerId = candidate;
                    localStorage.setItem('qr_player_id', playerId);
                    updatePlayerIdDisplay();
                    // 新規プレイヤーには、これまで配信された「全員宛お知らせ」が届かないようにする
                    // （登録時点までの最新キーを既読扱いにしておく）
                    database.ref('globalAnnouncements').once('value').then(function(snap2){
                        const items = snap2.val();
                        if(items) {
                            const keys = Object.keys(items).sort();
                            if(keys.length > 0) localStorage.setItem('qr_last_global_announce', keys[keys.length - 1]);
                        }
                        if(onReady) onReady();
                    }).catch(function(){ if(onReady) onReady(); });
                }).catch(function() {
                    // Firebase書き込み失敗時はローカルのみでID発行
                    playerId = candidate;
                    localStorage.setItem('qr_player_id', playerId);
                    updatePlayerIdDisplay();
                    if(onReady) onReady();
                });
            }
        }).catch(function() {
            // Firebase通信エラー時はローカルのみでID発行
            playerId = candidate;
            localStorage.setItem('qr_player_id', playerId);
            updatePlayerIdDisplay();
            if(onReady) onReady();
        });
    }
    tryAssign();
}

function updatePlayerIdDisplay() {
    const el = document.getElementById('playerIdDisplay');
    if (el) el.innerText = 'ID: ' + (playerId || '発行中...');
}

function copyPlayerId() {
    if(!playerId) return;
    navigator.clipboard.writeText(playerId).then(function(){
        showCustomAlert('✅ コピー完了', 'プレイヤーIDをコピーしました！<br>' + playerId);
    }).catch(function(){
        showCustomAlert('❌ コピー失敗', 'お使いの環境ではコピーできませんでした。');
    });
}

function loadGame() {
    const savedInv = localStorage.getItem('qr_curry_inv');
    const savedHistory = localStorage.getItem('qr_curry_history');
    const savedG = localStorage.getItem('qr_curry_g');
    const savedEXP = localStorage.getItem('qr_curry_exp');
    const savedTicket = localStorage.getItem('qr_curry_ticket');
    const savedSpicyCoin = localStorage.getItem('qr_curry_spicycoin');
    const savedName = localStorage.getItem('qr_curry_pname');
    const savedRecipes = localStorage.getItem('qr_curry_recipes');
    const savedStock = localStorage.getItem('qr_curry_stock');
    const savedDiscovered = localStorage.getItem('qr_curry_discovered');
    const savedLocked = localStorage.getItem('qr_curry_locked');
    if (savedInv) {
        inventory = JSON.parse(savedInv);
    }
    Object.keys(masterIngredients).forEach(k => { if (inventory[k] === undefined) inventory[k] = 0; });
    Object.keys(masterSpices).forEach(k => { if (inventory[k] === undefined) inventory[k] = 0; });
    if (savedDiscovered) {
        discoveredItems = JSON.parse(savedDiscovered);
    } else {
        discoveredItems = {};
        Object.keys(inventory).forEach(k => { if(inventory[k] > 0) discoveredItems[k] = true; });
    }
    lockedItems = savedLocked ? JSON.parse(savedLocked) : {};
    if (savedHistory) scanHistory = JSON.parse(savedHistory);
    if (savedG) playerG = parseInt(savedG, 10);
    if (savedEXP) playerEXP = parseInt(savedEXP, 10);
    if (savedTicket !== null) packTicket = parseInt(savedTicket, 10);
    if (savedSpicyCoin !== null) spicyCoin = parseInt(savedSpicyCoin, 10);
    if (savedName) playerName = savedName;
    if (savedRecipes) recipeBook = JSON.parse(savedRecipes);
    if (savedStock) { curryStock = JSON.parse(savedStock); if (curryStock.length > 0) selectedCurryIndex = 0; }
    const savedBase = localStorage.getItem('qr_selected_base');
    const savedTableware = localStorage.getItem('qr_selected_tableware');
    if (savedBase) selectedBase = savedBase;
    if (savedTableware) selectedTableware = savedTableware;
    unlockAlumiteTableware = localStorage.getItem('qr_unlock_alumite_tableware') === '1';
    unlockWoodTableware = localStorage.getItem('qr_unlock_wood_tableware') === '1';
    unlockOvalTableware = localStorage.getItem('qr_unlock_oval_tableware') === '1';
    unlockThaliTableware = localStorage.getItem('qr_unlock_thali_tableware') === '1';
    const savedPost = localStorage.getItem('qr_post_messages');
    if(savedPost) {
        postMessages = JSON.parse(savedPost);
    } else {
        // 初回プレイ時のみデフォルト手紙を投入（添付特典は手紙を開いた時に受け取る）
        postMessages = JSON.parse(JSON.stringify(DEFAULT_POST_MESSAGES));
        const now = Date.now();
        postMessages.forEach(m => { m.createdAt = now; });
        localStorage.setItem('qr_post_messages', JSON.stringify(postMessages));
    }
    document.getElementById("playerNameInput").value = playerName;
    document.getElementById("headerPlayerName").innerText = playerName;
    document.getElementById("globalG").innerText = playerG;
    document.getElementById("globalTicket").innerText = packTicket;
    document.getElementById("globalSpicyCoin").innerText = spicyCoin;
    migrateBattleProgressionReset();
    updateBattleModeLocks();
}
// PC戦の段階解放システム導入時、既存プレイヤー全員を公平に「初級から順番」に統一するための1回限りのリセット処理
// （討伐順序が記録されていない既存データでは正しい進行度を復元できないため、安全に作り直す）
function migrateBattleProgressionReset() {
    if(localStorage.getItem('qr_battle_progression_migrated') === '1') return;
    const s = getStats();
    s.defeatedBots = [];
    s.defeatedHardBots = [];
    saveStats(s);
    localStorage.setItem('qr_battle_progression_migrated', '1');
}
// ===== ポスト（受信フォルダ）機能 =====
function savePostMessages() {
    localStorage.setItem('qr_post_messages', JSON.stringify(postMessages));
}
// 新しい手紙をポストに追加する共通関数
// opts: { subject, body, image, rewardPack, expireMinutesAfterRead }
function addPostMessage(opts) {
    postMessages.push({
        id: 'msg_' + Date.now() + '_' + Math.floor(Math.random()*10000),
        announceId: opts.announceId || null, // 管理ツールから配信された手紙の元ID（取り消し処理に使う）
        subject: opts.subject,
        body: opts.body,
        image: opts.image || null,
        imageBottom: opts.imageBottom || null,
        imageBottomUrl: opts.imageBottomUrl || null,
        imageBottom2: opts.imageBottom2 || null,
        imageBottomUrl2: opts.imageBottomUrl2 || null,
        rewardPack: opts.rewardPack || 0,
        rewardGold: opts.rewardGold || 0,
        rewardSpicyCoin: opts.rewardSpicyCoin || 0,
        rewardItems: opts.rewardItems || [],
        read: false,
        rewardClaimed: false,
        expireMinutesAfterRead: opts.expireMinutesAfterRead || null,
        createdAt: Date.now()
    });
    savePostMessages();
    updatePostButtonUI();
    // プレイ中（ゲーム画面が表示されている）なら、邪魔にならないトースト通知を出す
    const gameUI = document.getElementById('gameUI');
    if(gameUI && gameUI.style.display !== 'none') {
        showPostToast(opts.subject);
    }
}
// 画面上部に小さく件名を表示するトースト通知（LINE等の通知バナーのイメージ）
let postToastTimer = null;
function showPostToast(subject) {
    const toast = document.getElementById('postToast');
    const text = document.getElementById('postToastText');
    if(!toast || !text) return;
    text.innerText = subject;
    // 戦闘演出用のbattleAbortedフラグの影響を受けないよう、ここではミュート判定のみ行う
    if(!isMuted) {
        const se = new Audio('midoku.mp3');
        se.volume = 0.7;
        se.play().catch(e => console.log("SE play error:", e));
    }
    toast.style.display = 'block';
    toast.classList.remove('post-toast-show');
    void toast.offsetWidth; // reflowでアニメーションを再始動
    toast.classList.add('post-toast-show');
    if(postToastTimer) clearTimeout(postToastTimer);
    postToastTimer = setTimeout(() => { toast.style.display = 'none'; }, 4000);
}
// トースト通知をタップしたらそのままポストを開く
function onPostToastClick() {
    const toast = document.getElementById('postToast');
    if(toast) toast.style.display = 'none';
    if(postToastTimer) clearTimeout(postToastTimer);
    openPostScreen();
}
function getUnreadPostCount() {
    return postMessages.filter(m => !m.read).length;
}
// ポストボタンの表示・点滅状態を更新（未読があれば点滅）
function updatePostButtonUI() {
    const btn = document.getElementById('postBtn');
    const icon = document.getElementById('postIcon');
    if(!btn || !icon) return;
    const unread = getUnreadPostCount();
    if(unread > 0) {
        icon.src = 'letter02.svg';
        icon.classList.add('post-blink');
    } else {
        icon.src = 'letter01.svg';
        icon.classList.remove('post-blink');
    }
}
// ゲームスタート（トップ→プレイヤータブ切り替え）時に呼ぶ。ボタン表示＋未読通知
function onGameStartShowPost() {
    purgeExpiredPostMessages();
    const btn = document.getElementById('postBtn');
    if(btn) btn.style.display = 'flex';
    updatePostButtonUI();
    const unread = getUnreadPostCount();
    if(unread > 0) {
        playSoundEffect('midokuaruyo.mp3');
        showCustomAlert('Post', `未読のお知らせが${unread}件あります`);
    }
}
function openPostScreen() {
    purgeExpiredPostMessages();
    renderPostList();
    document.getElementById('postListOverlay').style.display = 'flex';
}
// 受信フォルダを開くタイミングで、期限切れの手紙（開封済みかつexpireAtを過ぎたもの）を削除する
function purgeExpiredPostMessages() {
    const now = Date.now();
    const before = postMessages.length;
    postMessages = postMessages.filter(m => !(m.expireAt && now >= m.expireAt));
    if(postMessages.length !== before) savePostMessages();
}
function closePostListScreen() {
    document.getElementById('postListOverlay').style.display = 'none';
}
// 手紙の届いた日付を「YYYY/MM/DD」形式で返す（createdAtがない古いデータはなしを返す）
function formatPostDate(timestamp) {
    if(!timestamp) return '';
    const d = new Date(timestamp);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())}`;
}
function renderPostList() {
    const area = document.getElementById('postListArea');
    if(!area) return;
    if(postMessages.length === 0) {
        area.innerHTML = '<div style="text-align:center;color:#b0a090;padding:20px 0;">ポストには何も入っていません</div>';
        return;
    }
    const hasAttachment = m => !m.rewardClaimed && ((m.rewardItems && m.rewardItems.length > 0) || m.rewardGold > 0 || m.rewardPack > 0 || m.rewardSpicyCoin > 0);
    area.innerHTML = [...postMessages].reverse().map(m => {
        const idx = postMessages.indexOf(m);
        const dateStr = formatPostDate(m.createdAt);
        const clipIcon = hasAttachment(m) ? `<span style="font-size:14px; margin-left:auto; padding-left:8px; flex-shrink:0;">📎</span>` : '';
        if(m.read) {
            return `<div onclick="openPostDetail(${idx})" style="padding:10px 8px; border-bottom:1px solid #e8d9b8; cursor:pointer; color:#b0a090; display:flex; align-items:center;">
                <span style="font-size:13px;">✉️ ${m.subject}</span>
                <span style="font-size:10px; color:#b0a090; margin-left:6px;">${dateStr}</span>
                ${clipIcon}
            </div>`;
        } else {
            return `<div onclick="openPostDetail(${idx})" style="padding:10px 8px; border-bottom:1px solid #e8d9b8; cursor:pointer; background:#fff8ee; display:flex; align-items:center;">
                <span style="font-size:14px; font-weight:bold; color:#420000;">📩 ${m.subject}</span>
                <span style="font-size:10px; color:#e74c3c; margin-left:6px;">●未読</span>
                <span style="font-size:10px; color:#b0a090; margin-left:6px;">${dateStr}</span>
                ${clipIcon}
            </div>`;
        }
    }).join('');
}
function openPostDetail(idx) {
    const m = postMessages[idx];
    if(!m) return;
    closePostListScreen();
    document.getElementById('postDetailSubject').innerText = m.subject;
    document.getElementById('postDetailDate').innerText = formatPostDate(m.createdAt);
    document.getElementById('postDetailBody').innerText = m.body;
    const imgArea = document.getElementById('postDetailImageArea');
    imgArea.innerHTML = m.image ? `<img src="${m.image}" style="max-width:160px; max-height:160px; object-fit:contain;">` : '';
    // 下部画像（店舗紹介QR等）：shopQrActionがあればタップでスキャン相当の処理を呼ぶ
    const bottomArea = document.getElementById('postDetailBottomImageArea');
    if(m.imageBottom || m.imageBottom2) {
        const makeImg = function(src, url) {
            const imgHtml = `<img src="${src}" style="width:${m.imageBottom2 ? '48%' : '160px'};height:auto;object-fit:contain;${url ? 'cursor:pointer;' : ''}">`;
            return url ? `<a href="${url}" target="_blank" rel="noopener">${imgHtml}</a>` : imgHtml;
        };
        let imgs = '';
        if(m.imageBottom) imgs += makeImg(m.imageBottom, m.imageBottomUrl || null);
        if(m.imageBottom2) imgs += makeImg(m.imageBottom2, m.imageBottomUrl2 || null);
        bottomArea.innerHTML = `<div style="display:flex;gap:8px;justify-content:center;align-items:flex-start;">${imgs}</div>`;
        bottomArea.style.display = 'block';
    } else {
        bottomArea.innerHTML = '';
        bottomArea.style.display = 'none';
    }
    // 既読化（開封時刻を起点に自動削除タイマーを確定させる）
    if(!m.read) {
        m.read = true;
        if(m.expireMinutesAfterRead) {
            m.expireAt = Date.now() + m.expireMinutesAfterRead * 60 * 1000;
        }
        savePostMessages();
        updatePostButtonUI();
    }
    renderPostDetailRewardArea(m, idx);
    renderPostDetailExpireNote(m);
    document.getElementById('postDetailOverlay').style.display = 'flex';
}
// 手紙内の店舗QR画像タップ時、実際のQRスキャンと同じ処理を呼ぶ（actionKeyで店舗を識別、現状は'shop1'のみ）
function runPostShopQrAction(actionKey) {
    if(actionKey === 'shop1') {
        // ポストの詳細画面を閉じ、QRタブに切り替えてからスキャン結果画面を表示する
        document.getElementById('postDetailOverlay').style.display = 'none';
        const scanTabBtn = document.querySelector('[onclick*="switchTab(\'scan\'"]');
        if(scanTabBtn) switchTab('scan', scanTabBtn);
        processShop1QR('hunger_is_the_best_spice_curry', 'hunger_is_the_best_spice_curry');
    }
}
// 添付特典エリア（受け取るボタン／受け取り済み表示）を描画する
function renderPostDetailRewardArea(m, idx) {
    const rewardArea = document.getElementById('postDetailRewardArea');
    if(!rewardArea) return;
    const hasReward = m.rewardPack || m.rewardGold || m.rewardSpicyCoin || (m.rewardItems && m.rewardItems.length > 0);
    if(!hasReward) { rewardArea.innerHTML = ''; return; }

    // 報酬内容のテキストを組み立て
    let parts = [];
    if(m.rewardPack) parts.push(`パック券${m.rewardPack}枚`);
    if(m.rewardGold) parts.push(`💰${m.rewardGold}G`);
    if(m.rewardSpicyCoin) parts.push(`🌶️${m.rewardSpicyCoin}枚`);
    if(m.rewardItems && m.rewardItems.length > 0) {
        const itemsHtml = m.rewardItems.map(it => {
            const d = masterIngredients[it];
            const ico = d && d.icon ? `<img src="${d.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">` : '';
            return ico + it;
        }).join(' ');
        parts.push(itemsHtml);
    }
    const rewardLabel = parts.join('　');

    if(m.rewardClaimed) {
        rewardArea.innerHTML = `🎁 添付特典：${rewardLabel}（受け取り済み）`;
    } else {
        rewardArea.innerHTML = `🎁 添付特典：${rewardLabel}　`
            + `<button onclick="claimPostReward(${idx})" style="padding:4px 12px; background:#e67e22; color:#fff; border:none; border-radius:4px; font-weight:bold; font-size:12px; cursor:pointer;">受け取る</button>`;
    }
}
// 自動削除予定の注意書きを「受信フォルダへ戻る」ボタンの下に表示
function renderPostDetailExpireNote(m) {
    const note = document.getElementById('postDetailExpireNote');
    if(!note) return;
    if(m.expireAt) {
        const d = new Date(m.expireAt);
        const pad = n => String(n).padStart(2, '0');
        note.innerText = `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())}/${pad(d.getHours())}:${pad(d.getMinutes())}に自動で削除されます。`;
    } else {
        note.innerText = '';
    }
}
// 添付特典を受け取るボタンの処理（パック券・宅配カレー報酬どちらも対応）
function claimPostReward(idx) {
    const m = postMessages[idx];
    if(!m || m.rewardClaimed) return;
    let receivedParts = [];
    if(m.rewardPack) {
        packTicket = (packTicket || 0) + m.rewardPack;
        const ticketEl = document.getElementById('globalTicket'); if(ticketEl) ticketEl.innerText = packTicket;
        receivedParts.push(`パック券${m.rewardPack}枚`);
    }
    if(m.rewardGold) {
        playerG += m.rewardGold;
        const goldEl = document.getElementById('globalG'); if(goldEl) goldEl.innerText = playerG;
        receivedParts.push(`💰${m.rewardGold}G`);
    }
    if(m.rewardSpicyCoin) {
        spicyCoin = (spicyCoin || 0) + m.rewardSpicyCoin;
        receivedParts.push(`🌶️${m.rewardSpicyCoin}枚`);
        setTimeout(() => showCoinGetOverlay(m.rewardSpicyCoin), 500);
    }
    if(m.rewardItems && m.rewardItems.length > 0) {
        m.rewardItems.forEach(it => {
            inventory[it] = (inventory[it] || 0) + 1;
            discoveredItems[it] = true;
        });
        receivedParts.push(`食材${m.rewardItems.length}個`);
        updateFridgeUI();
    }
    m.rewardClaimed = true;
    saveGame();
    savePostMessages();
    renderPostDetailRewardArea(m, idx);
    renderPostList(); // 📎マークを消す
    showCustomAlert('🎁 受け取り完了', `${receivedParts.join('　')}を受け取りました！`);
}
function closePostDetailScreen() {
    document.getElementById('postDetailOverlay').style.display = 'none';
    purgeExpiredPostMessages();
    renderPostList();
    document.getElementById('postListOverlay').style.display = 'flex';
}

function handleNameChange(val) {
    if(!val.trim()) val = "名無しの料理人";
    playerName = val;
    document.getElementById("headerPlayerName").innerText = val;
    saveGame();
    if (database && playerId) { database.ref('players/' + playerId + '/name').set(val); }
}
function clearSaveData() {
    showCustomConfirm("全初期化", "セーブデータをすべてリセットします。<br><br>このデバイスは新しいIDになり、これまでのIDとは別のキャラクターとして始まります。<br>（このIDを他のデバイスでも使っている場合、そちらのデータはそのまま残ります）<br><br>本当によろしいですか？", function() {
        localStorage.clear(); inventory = {}; scanHistory = {}; playerG = 0; playerEXP = 0; packTicket = 0; spicyCoin = 0; curryStock = []; playerName = "名無しの料理人"; recipeBook = {}; discoveredItems = {}; saveUnlockedIcons(["myimageicon/mayimage01.png","myimageicon/mayimage02.png","myimageicon/mayimage03.png"]); currentIconFile = "myimageicon/mayimage01.png"; localStorage.setItem("selectedPlayerIcon", "myimageicon/mayimage01.png");
        // このデバイスだけ新しいIDを発行（古いIDのクラウドデータには触れない。他デバイスを保護するため）
        playerId = ''; playerSecretKey = '';
        loadGame(); updateTablewareBaseUI(); updateFridgeUI(); updateCookSelects(); refreshRecipeBookUI(); updateShopButtons(); document.getElementById("resultBox").style.display = "none"; updateLvDisplay(); setupLoadedIconUI();
        initPlayerId(function() { saveGame(); }); // 新しいIDの発行が完了してからクラウド同期する
        goToTop(); // 初期化後は初期画面に戻す
    });
}
function loadNotice() {
    if(!database) return;
    database.ref('notice').once('value').then(function(snap) {
        var text = snap.val() || '';
        var box = document.getElementById("noticeBox");
        if(!box) return;
        if(text) {
            box.innerHTML = text.replace(/\n/g, '<br>');
            box.style.display = "block";
        } else {
            box.style.display = "none";
        }
    });
}

// ===================================================
// クエスト・実績システム
// ===================================================

// --- デイリークエスト定義 ---
const DAILY_QUESTS = [
    { id:'scan3',    text:'QRスキャンで3つのアイテムを入手する',  reward:100, type:'scan',    target:3 },
    { id:'bot_win',  text:'PCバトル（初級）で勝利する',           reward:100, type:'bot_win', target:1 },
    { id:'cook1',    text:'調理でカレーを作る',                   reward:100, type:'cook',    target:1 },
    { id:'hard_win', text:'PCバトル（中級）で勝利する',           reward:200, type:'hard_win',target:1 },
    { id:'special',  text:'調理で特殊カレーを作る',               reward:200, type:'special', target:1 },
    { id:'room_win', text:'ルームバトルで勝利する',               reward:300, type:'room_win',target:1 },
];

// --- 実績カテゴリ定義 ---
const ACHIEVEMENT_CATEGORIES = [
    { key:'basic',  label:'基本実績' },
    { key:'curry',  label:'カレー実績' },
    { key:'battle', label:'バトル実績' },
    { key:'other',  label:'その他の実績' },
];

// --- 実績定義 ---
const ACHIEVEMENTS = [
    // 基本実績
    { id:'scan_1',    cat:'basic', text:'QRをスキャンする',          desc:'QRを初めてスキャンする',                       reward:100, check: d => d.scanTotal >= 1 },
    { id:'scan_50',   cat:'basic', text:'QRを50回スキャンする',      desc:'QRを50回スキャンする',                         reward:100, check: d => d.scanTotal >= 50 },
    { id:'scan_100',  cat:'basic', text:'QRを100回スキャンする',     desc:'QRを100回スキャンする',                        reward:100, check: d => d.scanTotal >= 100 },
    { id:'scan_500',  cat:'basic', text:'QRを500回スキャンする',     desc:'QRを500回スキャンする',                        reward:100, check: d => d.scanTotal >= 500 },
    { id:'scan_1000', cat:'basic', text:'QRを1000回スキャンする',    desc:'QRを1000回スキャンする',                       reward:100, check: d => d.scanTotal >= 1000 },
    { id:'cook_1',    cat:'basic', text:'調理をする',                desc:'初めて調理でカレーを作る',                     reward:100, check: d => d.cookTotal >= 1 },
    { id:'cook_50',   cat:'basic', text:'調理を50回する',            desc:'調理でカレーを50回作る',                       reward:100, check: d => d.cookTotal >= 50 },
    { id:'cook_100',  cat:'basic', text:'調理を100回する',           desc:'調理でカレーを100回作る',                      reward:100, check: d => d.cookTotal >= 100 },
    { id:'cook_500',  cat:'basic', text:'調理を500回する',           desc:'調理でカレーを500回作る',                      reward:100, check: d => d.cookTotal >= 500 },
    { id:'cook_1000', cat:'basic', text:'調理を1000回する',          desc:'たくさん作ってくれてありがとう！',             reward:200, check: d => d.cookTotal >= 1000 },
    { id:'items_10',  cat:'basic', text:'アイテム10種類入手',        desc:'アイテム10種類入手する',                       reward:100, check: d => d.itemVariety >= 10 },
    { id:'items_20',  cat:'basic', text:'アイテム20種類入手',        desc:'アイテム20種類入手する',                       reward:100, check: d => d.itemVariety >= 20 },
    { id:'items_30',  cat:'basic', text:'アイテム30種類入手',        desc:'アイテム30種類入手する',                       reward:100, check: d => d.itemVariety >= 30 },
    { id:'items_40',  cat:'basic', text:'アイテム40種類入手',        desc:'アイテム40種類入手する',                       reward:100, check: d => d.itemVariety >= 40 },
    { id:'rare_item_1', cat:'basic', text:'レア食材入手',            desc:'レア食材を入手する',                           reward:100, check: d => !!d.gotRareItem },
    { id:'rare_item_5', cat:'basic', text:'レア食材5種類入手',       desc:'レア食材を5種類入手する',                      reward:100, check: d => (d.rareItemsObtained||[]).length >= 5 },

    // カレー実績
    { id:'poison_c',  cat:'curry', text:'毒毒しいカレー入手',        desc:'毒カレー完成おめでとう！',                     reward:100, check: d => d.gotPoison },
    { id:'illusion_c',cat:'curry', text:'惑わしちゃうカレー入手',   desc:'幻惑カレー完成おめでとう！',                   reward:100, check: d => d.gotIllusion },
    { id:'seed_c',    cat:'curry', text:'連続発射カレー入手',        desc:'種連続発射カレー完成おめでとう！',             reward:100, check: d => d.gotSeed },
    { id:'wanpaku_c', cat:'curry', text:'わんぱくで良いよね！',      desc:'わんぱくカレー完成おめでとう！',               reward:100, check: d => d.gotWanpaku },
    { id:'rata_c',    cat:'curry', text:'まるでラタトゥイユ！？',    desc:'ラタトゥイユカレー完成おめでとう！',           reward:100, check: d => d.gotRatatouille },
    { id:'homerun_c', cat:'curry', text:'目指せホームラン',          desc:'ホームランカレー完成おめでとう！',             reward:100, check: d => d.gotHomerun },
    { id:'marg_c',    cat:'curry', text:'それってまるでピザ！？',    desc:'マルゲリータカレー完成おめでとう！',           reward:100, check: d => d.gotMargherita },
    { id:'sea_c',     cat:'curry', text:'あれ？波の音が聞こえる',   desc:'海の幸カレー完成おめでとう！',                 reward:100, check: d => d.gotSeafood },
    { id:'tonton_c',  cat:'curry', text:'仲良し三兄弟！',            desc:'3匹のわんぱく兄弟完成おめでとう！',            reward:100, check: d => !!d.gotTonTonTon },
    { id:'poisonapple_c', cat:'curry', text:'魔女のお帽子？',        desc:'毒りんごカレー完成おめでとう！',               reward:100, check: d => !!d.gotPoisonApple },
    { id:'fluffyomelette_c', cat:'curry', text:'ふわっふわのオム',   desc:'ふわとろオムカレー完成おめでとう！',           reward:100, check: d => !!d.gotFluffyOmelette },
    { id:'greencurry_c', cat:'curry', text:'辛くてヒリヒリしちゃう', desc:'グリーンカレー完成おめでとう！',               reward:100, check: d => !!d.gotGreenCurry },
    { id:'tricaviar_c', cat:'curry', text:'珍味の王様！',            desc:'世界三大珍味カレー完成おめでとう！',           reward:100, check: d => !!d.gotTriCaviar },
    { id:'five_types', cat:'curry', text:'基本5タイプカレー入手',    desc:'基本カレー5つのイラストどれがお気に入り？',   reward:100, check: d => d.gotAllCurryTypes },

    // バトル実績
    { id:'bot_all',   cat:'battle', text:'PC戦(初級)撃破',            desc:'PCバトル(初級)で全キャラ撃破おめでとう！',     reward:100, check: d => d.botKills >= 4 },
    { id:'hard_all',  cat:'battle', text:'PC戦(中級)撃破',            desc:'PCバトル(中級)で全キャラ撃破おめでとう！',     reward:100, check: d => d.hardKills >= 4 },
    { id:'tag_all',   cat:'battle', text:'タッグ戦撃破',              desc:'タッグ戦で全キャラ撃破おめでとう！',           reward:200, check: d => d.botKills >= 4 && d.hardKills >= 4 && d.tagExtraKills >= 3 },
    { id:'maharaja',  cat:'battle', text:'富豪撃破',                  desc:'マハラジャ撃破おめでとう！',                   reward:100, check: d => d.maharajaKill >= 1 },
    { id:'win_100',   cat:'battle', text:'めっちゃ勝利する',          desc:'対戦で100勝おめでとう！',                      reward:100, check: d => d.totalWins >= 100 },
    { id:'event_join', cat:'battle', text:'イベントバトルに参加',     desc:'イベントバトルに参加ありがとう！',             reward:100, check: d => d.eventBattleJoined },
    { id:'poison_win', cat:'battle', text:'毒フィニッシャー',         desc:'毒ダメージでフィニッシュなんてさすが！',       reward:100, check: d => d.wonByPoison },
    { id:'seed_7hit',  cat:'battle', text:'種7連続発射',              desc:'SPD高くないと7回連射できないんだよ！',         reward:100, check: d => d.seedMaxHits >= 7 },
    { id:'draw_once',  cat:'battle', text:'引き分け！',               desc:'バトルで引き分けなんて珍しい！',               reward:100, check: d => !!d.gotDraw },

    // その他の実績
    { id:'double_bingo', cat:'other', text:'ダブルビンゴ！',          desc:'ダブルビンゴおめでとう！',                     reward:100, check: d => !!d.gotDoubleBingo },
    { id:'triple_bingo', cat:'other', text:'トリプルビンゴ！',        desc:'トリプルビンゴおめでとう！',                   reward:200, check: d => !!d.gotTripleBingo },
    { id:'bonus_qr',  cat:'other', text:'え、このQR、こんなに！？', desc:'アイテムが多めにもらえるQRを見つけたね！',     reward:100, check: d => d.gotBonusQR },
    { id:'tutorial_done', cat:'other', text:'詳細チュートリアル完了', desc:'チュートリアル完了おめでとう！',               reward:100, check: d => d.tutorialCompleted },
    { id:'guide_snooze', cat:'other', text:'案内人ちょっとあっち行って', desc:'案内人が長押しでしばらく出ないことによく気づいたね！', reward:100, check: d => d.guideCharSnoozed },
    { id:'achieve_10', cat:'other', text:'実績10個達成',             desc:'食材アイコンをキャラクターアイコンに解放！',   reward:0, rewardType:'unlockFoodIcon', isMetaAchievement:true, requiredCount:10 },
    { id:'achieve_20', cat:'other', text:'実績20個達成',             desc:'実績を20個達成おめでとう！',                   reward:0, rewardType:'spicyCoin', spicyCoinAmount:1, isMetaAchievement:true, requiredCount:20 },
];

// --- グローバル統計（Firebaseに全プレイヤー分集計） ---
function incrementGlobalStat(path) {
    if(!database || isDebugMode || isAnalyticsExcluded) return;
    database.ref('analytics/' + path).transaction(v => (v||0) + 1);
}

// --- 統計データ読み書き ---
function getStats() {
    const s = localStorage.getItem('qr_stats');
    return s ? JSON.parse(s) : {
        scanTotal:0, cookTotal:0, totalWins:0,
        botKills:0, hardKills:0, maharajaKill:0,
        itemVariety:0,
        gotPoison:false, gotIllusion:false, gotSeed:false,
        gotMargherita:false, gotSeafood:false, gotBonusQR:false,
        defeatedBots:[], defeatedHardBots:[], defeatedTagExtraBots:[], tagExtraKills:0,
        eventBattleJoined:false, wonByPoison:false, seedMaxHits:0,
        gotWanpaku:false, gotRatatouille:false, gotHomerun:false,
        tutorialCompleted:false, curryTypesObtained:[], gotAllCurryTypes:false,
        guideCharSnoozed:false,
        gotRareItem:false, rareItemsObtained:[],
        gotTonTonTon:false, gotPoisonApple:false, gotFluffyOmelette:false, gotGreenCurry:false, gotTriCaviar:false,
        gotDraw:false, gotDoubleBingo:false, gotTripleBingo:false,
        // バトルカレーフェス：参加回数・自己ベスト連勝数（フェスをまたいで永続）
        festJoinCount: 0, festBestStreak: 0,
        // バトルカレーフェス：仲間botのレベル・経験値（フェスをまたいで永続。初期値は設計書2-4の初期レベル）
        festAllyLevels: {
            '見習い料理人タカシ':   { level:1,  exp:0 },
            '魔術師レオン':         { level:5,  exp:0 },
            'ガンコ親父':           { level:5,  exp:0 },
            '宮廷カレー長':         { level:10, exp:0 },
            'イカ星人グニョグニョ': { level:15, exp:0 },
            '種まき婆ちゃん':       { level:15, exp:0 },
            'ドラゴン料理長':       { level:20, exp:0 },
            '毒舌料理人ミスズ':     { level:20, exp:0 }
        }
    };
}
function saveStats(s) { localStorage.setItem('qr_stats', JSON.stringify(s)); }

// ===== PC戦（初級・中級）の進行度管理 =====
// botOpponents/hardBotOpponentsの並び順＝解放順。defeatedBots/defeatedHardBotsの「個数」をそのまま進行度として扱う
// （ただし討伐順がズレるケース、例えば過去のランダム仕様でレオンを先に倒していた等を考慮し、
//  「配列の先頭から連続して討伐済みかどうか」で進行度を判定する。歯抜けがあれば、その手前で止める）
function getEasyProgress() {
    const s = getStats();
    const defeated = s.defeatedBots || [];
    let progress = 0;
    for(let i = 0; i < botOpponents.length; i++) {
        if(defeated.includes(botOpponents[i].name)) progress++;
        else break;
    }
    return progress; // 0〜4。4で初級クリア（通常仕様=5種抽選に移行）
}
function getHardProgress() {
    if(!isHardModeUnlocked()) return 0;
    const s = getStats();
    const defeated = s.defeatedHardBots || [];
    let progress = 0;
    for(let i = 0; i < hardBotOpponents.length; i++) {
        if(defeated.includes(hardBotOpponents[i].name)) progress++;
        else break;
    }
    return progress; // 0〜4。4で中級クリア（通常仕様=4種ランダム抽選に移行）
}
function isEasyCleared() { return getEasyProgress() >= botOpponents.length; }
function isHardCleared() { return getHardProgress() >= hardBotOpponents.length; }
// 中級モード自体が解放されているか（初級クリアが条件）
function isHardModeUnlocked() { return isEasyCleared(); }
// タッグ戦が解放されているか（中級クリアが条件）
function isTagModeUnlocked() { return isHardCleared(); }
// イベント戦（特盛りモンスター）が解放されているか（初級クリアが条件。ただし既に参加済みのプレイヤーは救済して解放済み扱いにする）
function isEventModeUnlocked() {
    const s = getStats();
    if(s.eventBattleJoined) return true;
    return isEasyCleared();
}


function getAchievements() {
    const a = localStorage.getItem('qr_achievements');
    return a ? JSON.parse(a) : {};
}
function saveAchievements(a) { localStorage.setItem('qr_achievements', JSON.stringify(a)); }

function getDailyData() {
    const today = getJSTDateString();
    const raw = localStorage.getItem('qr_daily');
    const d = raw ? JSON.parse(raw) : {};
    if(d.date !== today) {
        // 日をまたいだらリセット
        const pool = [...DAILY_QUESTS];
        const picked = pool[Math.floor(Math.random() * pool.length)];
        const fresh = { date: today, questId: picked.id, progress: 0, done: false };
        localStorage.setItem('qr_daily', JSON.stringify(fresh));
        return fresh;
    }
    return d;
}
function saveDailyData(d) { localStorage.setItem('qr_daily', JSON.stringify(d)); }

function getLoginData() {
    const raw = localStorage.getItem('qr_login');
    return raw ? JSON.parse(raw) : { lastDate:'', streak:0, claimed:false };
}
function saveLoginData(d) { localStorage.setItem('qr_login', JSON.stringify(d)); }

// --- 統計更新ヘルパー ---
function updateStats(fn) {
    const s = getStats();
    fn(s);
    // アイテム種類数を常に最新に
    s.itemVariety = Object.keys(discoveredItems).length;
    saveStats(s);
}

// --- ログインボーナス ---
function initQuest() {
    const today = getJSTDateString();
    const ld = getLoginData();
    const yesterday = getJSTDateString(new Date(getGameNow().getTime() - 86400000));
    if(ld.lastDate !== today) {
        const newStreak = (ld.lastDate === yesterday) ? ld.streak + 1 : 1;
        saveLoginData({ lastDate: today, streak: newStreak, claimed: false });
    }
    getDailyData(); // デイリー初期化
    renderLoginBonus();
    renderDailyQuest();
    checkAndRenderAchievements();
}

function renderLoginBonus() {
    const area = document.getElementById('loginBonusArea');
    if(!area) return;
    const ld = getLoginData();
    const streak = ld.streak;
    const claimed = ld.claimed;
    const is5th = streak > 0 && streak % 5 === 0;
    const rewardText = is5th ? 'ノーマルアイテム3個 ＋ パック券1枚' : 'ノーマルアイテム3個';
    area.innerHTML = `
        <div style="background:#fff8ee;border:1px solid #b88742;border-radius:4px;padding:14px;">
            <div style="font-size:12px;color:#b88742;margin-bottom:6px;">連続ログイン: <b style="color:#420000;">${streak}日</b>${is5th?'　🎉 5日達成！':''}</div>
            <div style="font-size:12px;color:#420000;margin-bottom:10px;">本日の報酬: ${rewardText}</div>
            <button onclick="claimLoginBonus()" ${claimed?'disabled':''} style="padding:8px 20px;background:${claimed?'#c9b090':'#b88742'};color:#efdeb1;border:none;border-radius:4px;font-weight:bold;font-size:13px;cursor:${claimed?'not-allowed':'pointer'};">${claimed?'受取済み':'受け取る'}</button>
        </div>`;
}

function claimLoginBonus() {
    const ld = getLoginData();
    if(ld.claimed) return;
    ld.claimed = true;
    saveLoginData(ld);
    // ノーマルアイテム3個
    const pool = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 0 && isIngredientAvailable(k));
    let items = [];
    for(let i=0;i<3;i++){
        const it = pool[Math.floor(Math.random()*pool.length)];
        inventory[it]=(inventory[it]||0)+1; discoveredItems[it]=true; items.push(it);
    }
    let msg = `ノーマルアイテム3個入手！<br>${items.map(i => {
        const d = masterIngredients[i];
        const ico = d && d.icon ? `<img src="${d.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">` : '';
        return ico + i;
    }).join('　')}`;
    // 5日ボーナス
    if(ld.streak > 0 && ld.streak % 5 === 0) {
        packTicket++; msg += '<br>🎉 パック券1枚ゲット！';
    }
    saveGame(); updateFridgeUI(); updateCookSelects();
    renderLoginBonus();
    showCustomAlert('🎁 ログインボーナス', msg);
}

// --- デイリークエスト ---
function renderDailyQuest() {
    const area = document.getElementById('dailyQuestArea');
    if(!area) return;
    const d = getDailyData();
    const q = DAILY_QUESTS.find(q => q.id === d.questId);
    if(!q) return;
    const pct = Math.min(100, Math.floor(d.progress / q.target * 100));
    area.innerHTML = `
        <div style="background:#fff8ee;border:1px solid #b88742;border-radius:4px;padding:14px;">
            <div style="font-size:13px;color:#420000;font-weight:bold;margin-bottom:6px;">${q.text}</div>
            <div style="font-size:12px;color:#b88742;margin-bottom:8px;">報酬: +${q.reward}G</div>
            <div style="background:#e8d9b8;border-radius:4px;height:8px;overflow:hidden;margin-bottom:6px;">
                <div style="background:${d.done?'#b88742':'#420000'};height:100%;width:${pct}%;transition:width 0.3s;"></div>
            </div>
            <div style="font-size:11px;color:#b88742;">${d.done?'✅ クリア済み！':d.progress+'/'+q.target}</div>
        </div>`;
}

function progressDailyQuest(type) {
    const d = getDailyData();
    if(d.done) return;
    const q = DAILY_QUESTS.find(q => q.id === d.questId);
    if(!q || q.type !== type) return;
    d.progress = Math.min(q.target, (d.progress||0) + 1);
    if(d.progress >= q.target && !d.done) {
        d.done = true;
        saveDailyData(d);
        playerG += q.reward;
        saveGame();
        renderDailyQuest();
        showCustomAlert('🎯 デイリークエスト達成！', `「${q.text}」<br>+${q.reward}G 獲得！`);
    } else {
        saveDailyData(d);
        renderDailyQuest();
    }
}

// --- 実績 ---
function checkAndRenderAchievements() {
    const area = document.getElementById('achievementsArea');
    if(!area) return;
    const stats = getStats();
    const achieved = getAchievements();
    let newlyAchieved = [];

    // 通常実績の判定（メタ実績=実績数トリガー型は対象外）
    ACHIEVEMENTS.forEach(a => {
        if(a.isMetaAchievement) return;
        if(!achieved[a.id] && a.check(stats)) {
            achieved[a.id] = true;
            newlyAchieved.push(a);
        }
    });

    // メタ実績の判定（他の実績の達成数をトリガーにする実績。自分自身はカウント対象に含めない）
    ACHIEVEMENTS.forEach(a => {
        if(!a.isMetaAchievement) return;
        if(achieved[a.id]) return;
        const otherAchievedCount = Object.keys(achieved).filter(id => achieved[id] && id !== a.id).length;
        if(otherAchievedCount >= a.requiredCount) {
            achieved[a.id] = true;
            newlyAchieved.push(a);
        }
    });

    if(newlyAchieved.length > 0) {
        saveAchievements(achieved);
        let totalGoldReward = 0;
        let specialRewardLines = [];
        newlyAchieved.forEach(a => {
            if(a.rewardType === 'spicyCoin') {
                spicyCoin += (a.spicyCoinAmount || 1);
                specialRewardLines.push(`🌶️ スパイシーコイン+${a.spicyCoinAmount || 1}`);
                setTimeout(() => showCoinGetOverlay(a.spicyCoinAmount || 1), 800);
            } else if(a.rewardType === 'unlockFoodIcon') {
                unlockedFoodIconFeature = true;
                localStorage.setItem('qr_food_icon_unlocked', '1');
                specialRewardLines.push(`🖼️ 食材アイコンをプレイヤーアイコンに設定できるようになりました！`);
            } else {
                totalGoldReward += (a.reward != null ? a.reward : 100);
            }
        });
        playerG += totalGoldReward;
        saveGame();
        const detail = newlyAchieved.map(a =>
            `<div style="margin-bottom:10px;"><b style="color:#420000;">🏆 ${a.text}</b><br><span style="font-size:12px;color:#5a3a1a;">${a.desc || ''}</span></div>`
        ).join('');
        let rewardSummary = [];
        if(totalGoldReward > 0) rewardSummary.push(`+${totalGoldReward}G`);
        rewardSummary = rewardSummary.concat(specialRewardLines);
        showCustomAlert('🏆 実績達成！', `${detail}<br>${rewardSummary.join('<br>')}`);
    }
    // 描画（カテゴリごとにグループ化し、クリックで開閉するアコーディオン形式）
    // 再描画のたびに開閉状態がリセットされないよう、現在開いているカテゴリを先に記録しておく
    const openCats = new Set();
    area.querySelectorAll('.achievement-cat-body.open').forEach(el => {
        if(el.dataset && el.dataset.cat) openCats.add(el.dataset.cat);
    });
    area.innerHTML = ACHIEVEMENT_CATEGORIES.map(cat => {
        const list = ACHIEVEMENTS.filter(a => a.cat === cat.key);
        const clearedCount = list.filter(a => achieved[a.id]).length;
        const totalCount = list.length;
        const pad2 = n => String(n).padStart(2, '0');
        const isOpen = openCats.has(cat.key);
        const itemsHtml = list.map(a => {
            const done = !!achieved[a.id];
            const clickAttr = done ? `onclick="showAchievementDesc('${a.id}')" style="cursor:pointer;"` : '';
            const rewardLabel = done
                ? (a.rewardType === 'spicyCoin' ? `+${a.spicyCoinAmount||1}🌶️` : (a.rewardType === 'unlockFoodIcon' ? '🖼️解放' : `+${a.reward != null ? a.reward : 100}G`))
                : '';
            return `<div ${clickAttr} style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #e8d9b8;${done?'cursor:pointer;':''}">
                <span style="font-size:16px;">${done?'🏆':'⬜'}</span>
                <span style="font-size:12px;color:${done?'#420000':'#b0a090'};">${a.text}</span>
                ${done?'<span style="margin-left:auto;font-size:11px;color:#b88742;">'+rewardLabel+'</span>':''}
            </div>`;
        }).join('');
        return `<div class="achievement-cat" style="margin-bottom:10px;border:1px solid #e8d9b8;border-radius:4px;overflow:hidden;">
            <div class="achievement-cat-header" onclick="toggleAchievementCat(this)" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#fff8ee;cursor:pointer;user-select:none;">
                <span style="font-size:12px;font-weight:bold;color:#420000;">${cat.label}</span>
                <span style="font-size:11px;color:#b88742;display:flex;align-items:center;gap:4px;">
                    ${pad2(clearedCount)}/${pad2(totalCount)}
                    <span class="achievement-cat-arrow" style="display:inline-block;font-size:10px;transition:transform 0.2s;transform:rotate(${isOpen?'180deg':'0deg'});">▼</span>
                </span>
            </div>
            <div class="achievement-cat-body${isOpen?' open':''}" data-cat="${cat.key}" style="display:${isOpen?'block':'none'};padding:0 12px 4px;">${itemsHtml}</div>
        </div>`;
    }).join('');
}

function toggleAchievementCat(headerEl) {
    const body = headerEl.nextElementSibling;
    const arrow = headerEl.querySelector('.achievement-cat-arrow');
    const isOpen = body.classList.contains('open');
    if(isOpen) {
        body.classList.remove('open');
        body.style.display = 'none';
        if(arrow) arrow.style.transform = 'rotate(0deg)';
    } else {
        body.classList.add('open');
        body.style.display = 'block';
        if(arrow) arrow.style.transform = 'rotate(180deg)';
    }
}

function showAchievementDesc(id) {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if(!a) return;
    showCustomAlert(`🏆 ${a.text}`, `<span style="font-size:13px;color:#5a3a1a;">${a.desc || ''}</span>`);
}

// =======================================================
// 統計更新のフック（各アクション後に呼ぶ）
// =======================================================

// QRスキャン成功時
function onQRScanned(isBonusQR) {
    updateStats(s => {
        s.scanTotal = (s.scanTotal||0) + 1;
        if(isBonusQR) s.gotBonusQR = true;
    });
    progressDailyQuest('scan');
    // グローバル集計
    incrementGlobalStat('scan/total');
    incrementGlobalStat(isBonusQR ? 'scan/bonus' : 'scan/normal');
}

// 調理完了時
function onCookDone(curry) {
    updateStats(s => {
        s.cookTotal = (s.cookTotal||0) + 1;
        if(curry.isPoison) s.gotPoison = true;
        if(curry.isIllusion) s.gotIllusion = true;
        if(curry.isSeed) s.gotSeed = true;
        if(curry.isMargherita) s.gotMargherita = true;
        if(curry.isSeafood) s.gotSeafood = true;
        if(curry.isWanpaku) s.gotWanpaku = true;
        if(curry.isRatatouille) s.gotRatatouille = true;
        if(curry.isHomerun) s.gotHomerun = true;
        if(curry.isTonTonTon) s.gotTonTonTon = true;
        if(curry.isPoisonApple) s.gotPoisonApple = true;
        if(curry.isFluffyOmelette) s.gotFluffyOmelette = true;
        if(curry.isGreenCurry) s.gotGreenCurry = true;
        if(curry.isTriCaviar) s.gotTriCaviar = true;
        if(curry.curryType) {
            if(!s.curryTypesObtained) s.curryTypesObtained = [];
            if(!s.curryTypesObtained.includes(curry.curryType)) s.curryTypesObtained.push(curry.curryType);
            const ALL_TYPES = ['hp','atk','def','spd','balance'];
            s.gotAllCurryTypes = ALL_TYPES.every(t => s.curryTypesObtained.includes(t));
        }
    });
    progressDailyQuest('cook');
    const isSpecial = curry.isPoison||curry.isIllusion||curry.isSeed||curry.isMargherita||curry.isSeafood||curry.isTonTonTon||curry.isSticky||curry.isWanpaku||curry.isRatatouille||curry.isHomerun||curry.isFluffyOmelette||curry.isGreenCurry||curry.isTriCaviar;
    if(isSpecial) progressDailyQuest('special');
    // グローバル集計
    incrementGlobalStat('cook/total');
    if(curry.isPoison && !curry.isPoisonApple) incrementGlobalStat('cook/poison');
    if(curry.isPoisonApple) incrementGlobalStat('cook/poisonapple');
    if(curry.isIllusion) incrementGlobalStat('cook/illusion');
    if(curry.isSeed) incrementGlobalStat('cook/seed');
    if(curry.isMargherita) incrementGlobalStat('cook/margherita');
    if(curry.isSeafood) incrementGlobalStat('cook/seafood');
    if(curry.isTonTonTon) incrementGlobalStat('cook/tonton');
    if(curry.isSticky) incrementGlobalStat('cook/sticky');
    if(curry.isWanpaku) incrementGlobalStat('cook/wanpaku');
    if(curry.isRatatouille) incrementGlobalStat('cook/ratatouille');
    if(curry.isHomerun) incrementGlobalStat('cook/homerun');
    if(curry.isFluffyOmelette) incrementGlobalStat('cook/fluffyomelette');
    if(curry.isGreenCurry) incrementGlobalStat('cook/greencurry');
    if(curry.isTriCaviar) incrementGlobalStat('cook/tricaviar');
    if(curry.hasGold) incrementGlobalStat('cook/gold');
    if(!isSpecial) incrementGlobalStat('cook/normal');
}

// バトル勝利時
function onBattleWin(type, botName) {
    // グローバル集計（バトル実施数として）
    if(type === 'bot') incrementGlobalStat('battle/bot');
    else if(type === 'hard') incrementGlobalStat('battle/hard');
    else if(type === 'room') incrementGlobalStat('battle/room');
    // 解放通知の判定用：更新前の状態を記録しておく
    const wasEasyCleared = isEasyCleared();
    const wasHardCleared = isHardCleared();
    updateStats(s => {
        s.totalWins = (s.totalWins||0) + 1;
        if(type === 'bot') {
            if(botName === '大富豪マハラジャ') { s.maharajaKill = (s.maharajaKill||0)+1; }
            else {
                if(!s.defeatedBots) s.defeatedBots=[];
                if(!s.defeatedBots.includes(botName)) s.defeatedBots.push(botName);
                s.botKills = s.defeatedBots.length;
            }
            progressDailyQuest('bot_win');
        } else if(type === 'hard') {
            if(!s.defeatedHardBots) s.defeatedHardBots=[];
            if(!s.defeatedHardBots.includes(botName)) s.defeatedHardBots.push(botName);
            s.hardKills = s.defeatedHardBots.length;
            progressDailyQuest('hard_win');
        } else if(type === 'room') {
            progressDailyQuest('room_win');
        }
    });
    // 新たに初級・中級がクリアされた瞬間だけ、解放通知を表示する
    if(!wasEasyCleared && isEasyCleared()) {
        updateBattleModeLocks();
        checkEventBannerVisibility();
        setTimeout(() => showCustomAlert('🎉 新しいモードが解放されました！', 'PCと対戦（中級）が解放されました！'), 1200);
    }
    if(!wasHardCleared && isHardCleared()) {
        updateBattleModeLocks();
        setTimeout(() => showCustomAlert('🎉 新しいモードが解放されました！', 'タッグ戦が解放されました！'), 1200);
    }
}

// ============================================================
// バックアップコード
// ============================================================
// ===== セーブデータの共通構築・適用（バックアップコード／クラウド同期で共用） =====
// Firebaseのキーは . # $ / [ ] や制御文字を使えない。scanHistoryはスキャンしたQRの
// 生テキストをそのままキーにしているため、想定外の文字（URLの記号・制御文字等）を含む
// QRを読み取ると、そのキーを含むsavedata全体の書き込みが以後ずっと失敗し続けてしまう
// （クラウド同期が完全に止まる）不具合があった。個別の禁止文字を都度置換するのではなく、
// 元の文字列を確定的にハッシュ化した「必ず安全な文字だけの文字列」に変換することで、
// QRの内容がどんなものであっても書き込みが失敗しないようにする。
// （ローカルの日次スキャン制限判定はscanHistory本体を見ているので影響しない）
function sanitizeFirebaseKey(key) {
    const str = String(key);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    const safePrefix = str.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);
    return 'k' + (safePrefix ? safePrefix + '_' : '') + Math.abs(hash).toString(36);
}
// 数値をかき混ぜるだけの軽い整合性チェック値。暗号学的な強度はないが、
// ゲームクライアントを一切経由せずsavedataを直接編集された場合、この値と
// 実際の数値の組み合わせが食い違うことを検知するために使う（syncSeal参照）。
function computeSyncSeal(pid, g, exp, ticket, coin) {
    const s = String(pid || '') + '|' + String(g || 0) + '|' + String(exp || 0) + '|' + String(ticket || 0) + '|' + String(coin || 0);
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h * 131 + s.charCodeAt(i)) >>> 0; }
    return h;
}
// scanHistory・stats.scanTotalの直接改ざん検知用（syncSealと同系統の軽量ハッシュ、不正検知範囲拡大_設計書.md参照）。
// キーを昇順ソートしてkey=value連結文字列を作ることで、日付だけ書き換えた場合はもちろん、
// キー自体を総入れ替えした場合（件数は同じでも中身が別物）も必ず検知できるようにする。
// scanHistoryObjはFirebaseキーとして保存される形（sanitizeFirebaseKey済みのキー）を渡すこと。
function computeScanSeal(pid, scanTotal, scanHistoryObj) {
    const keys = Object.keys(scanHistoryObj || {}).sort();
    const parts = keys.map(function(k) { return k + '=' + scanHistoryObj[k]; });
    const s = String(pid || '') + '|' + parts.join(',') + '|scanTotal=' + String(scanTotal || 0);
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h * 131 + s.charCodeAt(i)) >>> 0; }
    return h;
}
// フェスの個人記録（自己ベスト連勝数・参加回数）の直接改ざん検知用（syncSeal/scanSealと同系統の軽量ハッシュ）。
// 全プレイヤー最高連勝記録（festGlobalRecord/maxStreak）自体はFirebaseルール側の数値・単調増加チェックで
// 別途保護しているが、個人のfestBestStreak/festJoinCountはここでのみ守られる。
// 現状はUI非表示の内部記録だが、直接書き換えによる不正な自己ベスト偽装を検知しておく。
function computeFestSeal(pid, festBestStreak, festJoinCount) {
    const s = String(pid || '') + '|festBestStreak=' + String(festBestStreak || 0) + '|festJoinCount=' + String(festJoinCount || 0);
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h * 131 + s.charCodeAt(i)) >>> 0; }
    return h;
}

function buildSaveDataObject() {
    const safeScanHistory = {};
    Object.keys(scanHistory || {}).forEach(function(k) {
        safeScanHistory[sanitizeFirebaseKey(k)] = scanHistory[k];
    });
    const statsForSave = getStats();
    return {
        inventory, scanHistory: safeScanHistory, playerG, playerEXP, packTicket, spicyCoin,
        playerName, curryStock, recipeBook, discoveredItems, lockedItems,
        selectedBase, selectedTableware, unlockAlumiteTableware, unlockWoodTableware, unlockOvalTableware, unlockThaliTableware,
        selectedIcon: currentIconFile,
        unlockedIcons: getUnlockedIcons(),
        stats: statsForSave, // 不正対策のためオブジェクトとして送信（Firebaseルール側で項目ごとの増加量を検証できるようにする）
        achievements: localStorage.getItem('qr_achievements') || '{}',
        loginData: localStorage.getItem('qr_login') || '{}',
        dailyData: localStorage.getItem('qr_daily') || '{}',
        specialBonusClaimedVersion: localStorage.getItem('qr_special_bonus_claimed_version') || '0',
        bingoData: localStorage.getItem('qr_bingo') || '{}',
        icon07got: localStorage.getItem('qr_icon07_got') || '',
        foodIconUnlocked: localStorage.getItem('qr_food_icon_unlocked') || '0',
        unlockChin: localStorage.getItem('qr_unlock_chin') || '0',
        unlockAngel: localStorage.getItem('qr_unlock_angel') || '0',
        unlockBrat: localStorage.getItem('qr_unlock_brat') || '0',
        stockLimit: localStorage.getItem('qr_curry_stock_limit') || '',
        playerId: playerId || '',
        secretKey: playerSecretKey || '',
        syncSeal: computeSyncSeal(playerId, playerG, playerEXP, packTicket, spicyCoin),
        scanSeal: computeScanSeal(playerId, statsForSave.scanTotal, safeScanHistory),
        festSeal: computeFestSeal(playerId, statsForSave.festBestStreak, statsForSave.festJoinCount),
        ver: 4
    };
}

function applySaveDataObject(decoded) {
    inventory = decoded.inventory || {};
    scanHistory = decoded.scanHistory || {};
    playerG = decoded.playerG || 0;
    playerEXP = decoded.playerEXP || 0;
    packTicket = decoded.packTicket || 0;
    spicyCoin = decoded.spicyCoin || 0;
    playerName = decoded.playerName || '名無しの料理人';
    curryStock = decoded.curryStock || [];
    recipeBook = decoded.recipeBook || {};
    discoveredItems = decoded.discoveredItems || {};
    lockedItems = decoded.lockedItems || {};
    selectedBase = decoded.selectedBase || '白米';
    selectedTableware = decoded.selectedTableware || '白い皿';
    unlockAlumiteTableware = !!decoded.unlockAlumiteTableware;
    unlockWoodTableware = !!decoded.unlockWoodTableware;
    unlockOvalTableware = !!decoded.unlockOvalTableware;
    unlockThaliTableware = !!decoded.unlockThaliTableware;
    if (typeof updateTablewareBaseUI === 'function') updateTablewareBaseUI();
    currentIconFile = migrateIconPath(decoded.selectedIcon) || 'myimageicon/mayimage01.png';
    if(decoded.unlockedIcons) saveUnlockedIcons(decoded.unlockedIcons.map(migrateIconPath));
    if(decoded.stats) localStorage.setItem('qr_stats', typeof decoded.stats === 'string' ? decoded.stats : JSON.stringify(decoded.stats));
    if(decoded.achievements) localStorage.setItem('qr_achievements', decoded.achievements);
    if(decoded.loginData) localStorage.setItem('qr_login', decoded.loginData);
    else localStorage.removeItem('qr_login');
    if(decoded.dailyData) localStorage.setItem('qr_daily', decoded.dailyData);
    else localStorage.removeItem('qr_daily');
    if(decoded.specialBonusClaimedVersion !== undefined) localStorage.setItem('qr_special_bonus_claimed_version', decoded.specialBonusClaimedVersion);
    if(decoded.bingoData) localStorage.setItem('qr_bingo', decoded.bingoData);
    else localStorage.removeItem('qr_bingo');
    if(decoded.icon07got) localStorage.setItem('qr_icon07_got', decoded.icon07got);
    if(decoded.foodIconUnlocked) { localStorage.setItem('qr_food_icon_unlocked', decoded.foodIconUnlocked); unlockedFoodIconFeature = decoded.foodIconUnlocked === '1'; }
    if(decoded.unlockChin) localStorage.setItem('qr_unlock_chin', decoded.unlockChin);
    if(decoded.unlockAngel) localStorage.setItem('qr_unlock_angel', decoded.unlockAngel);
    if(decoded.unlockBrat) localStorage.setItem('qr_unlock_brat', decoded.unlockBrat);
    if(decoded.stockLimit) localStorage.setItem('qr_curry_stock_limit', decoded.stockLimit);
    else localStorage.removeItem('qr_curry_stock_limit');
    localStorage.setItem('selectedPlayerIcon', currentIconFile);
}

function generateBackupCode() {
    const saveData = buildSaveDataObject();
    return btoa(unescape(encodeURIComponent(JSON.stringify(saveData))));
}

// ===== パスワード設定（平文保存・運営確認用） =====
function showPasswordSetup() {
    if(!playerId) { showCustomAlert('⚠️ エラー', 'プレイヤーIDが未発行です。少し待ってから再度お試しください。'); return; }
    const msg = '<div style="font-size:13px;color:#420000;margin-bottom:10px;line-height:1.7;">'
        + '<span style="color:#e74c3c;font-weight:bold;">"パスワードは運営が見ることができます。他のパスワードとの使い回しや個人情報などの入力はおやめください。"</span>'
        + '</div>'
        + '<input type="text" id="pwSetupInput" placeholder="パスワードを入力" maxlength="20" style="width:100%;padding:10px;border:1px solid #b88742;border-radius:4px;font-size:16px;box-sizing:border-box;background:#f5e9c8;color:#420000;">';
    showCustomConfirm('🔒 パスワード設定', msg, function() {
        const inp = document.getElementById('pwSetupInput');
        const pw = inp ? inp.value.trim() : '';
        if(!pw) { showCustomAlert('❌ エラー', 'パスワードを入力してください。'); return; }
        if(!database) { showCustomAlert('❌ エラー', '通信に問題があり、パスワードを保存できませんでした。'); return; }
        database.ref('players/' + playerId + '/password').set(pw).then(function(){
            showCustomAlert('✅ 設定完了', 'パスワードを設定しました。');
        }).catch(function(){
            showCustomAlert('❌ 保存失敗', 'パスワードの保存に失敗しました。');
        });
    });
}

function showBackupCode() {
    const code = generateBackupCode();
    const msg = `<div style="margin-bottom:10px;font-size:12px;color:#420000;">このコードをコピーしてメモアプリなどに保存してください。<br>データが消えたときにこのコードで復元できます。</div>`
        + `<textarea id="backupCodeArea" style="width:100%;height:100px;font-size:16px;padding:8px;border:1px solid #b88742;border-radius:4px;box-sizing:border-box;background:#f5e9c8;color:#420000;resize:none;" readonly>${code}</textarea>`
        + `<button onclick="copyBackupCode()" style="width:100%;margin-top:8px;padding:8px;background:#b88742;color:#efdeb1;border:none;border-radius:4px;font-weight:bold;cursor:pointer;">📋 コピーする</button>`;
    showCustomAlert('🔑 バックアップコード', msg);
}

function copyBackupCode() {
    const ta = document.getElementById('backupCodeArea');
    if(!ta) return;
    ta.select(); ta.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(ta.value).then(() => {
        showCustomAlert('✅ コピー完了', 'バックアップコードをコピーしました！<br>メモアプリや安全な場所に保存してください。');
    }).catch(() => {
        // フォールバック
        document.execCommand('copy');
        showCustomAlert('✅ コピー完了', 'バックアップコードをコピーしました！');
    });
}

// ===== データ復元（選択モーダル） =====
function showDataRestoreOptions() {
    const msg = '<div style="font-size:13px;color:#420000;margin-bottom:16px;line-height:1.6;">復元方法を選んでください。</div>'
        + '<button onclick="closeModalThen(showIdPasswordRestore)" style="width:100%;margin-bottom:10px;padding:10px;background:#b88742;color:#efdeb1;border:none;border-radius:4px;font-weight:bold;font-size:13px;cursor:pointer;">🔑 IDとパスワードで復元</button>'
        + '<button onclick="closeModalThen(restoreFromBackupCode)" style="width:100%;padding:10px;background:#420000;color:#efdeb1;border:none;border-radius:4px;font-weight:bold;font-size:13px;cursor:pointer;">📋 バックアップコードで復元</button>';
    document.getElementById("modalTitle").innerText = "🔄 データ復元";
    document.getElementById("modalMessage").innerHTML = msg;
    document.getElementById("modalBtnGroup").innerHTML = '';
    document.getElementById("customModal").style.display = "flex";
}

function closeModalThen(fn) {
    document.getElementById("customModal").style.display = "none";
    setTimeout(fn, 200);
}

// ===== IDとパスワードで復元 =====
function showIdPasswordRestore() {
    const msg = '<div style="font-size:12px;color:#420000;margin-bottom:10px;">プレイヤーIDとパスワードを入力してください。<br>最新のデータで復元します。</div>'
        + '<input type="text" id="restoreIdInput" placeholder="プレイヤーID（例: BC-XXXXXXXX）" style="width:100%;margin-bottom:8px;padding:10px;border:1px solid #b88742;border-radius:4px;font-size:16px;box-sizing:border-box;background:#f5e9c8;color:#420000;">'
        + '<input type="text" id="restorePwInput" placeholder="パスワード" style="width:100%;padding:10px;border:1px solid #b88742;border-radius:4px;font-size:16px;box-sizing:border-box;background:#f5e9c8;color:#420000;">';
    showCustomConfirm('🔑 IDとパスワードで復元', msg, function() {
        const idInput = document.getElementById('restoreIdInput');
        const pwInput = document.getElementById('restorePwInput');
        const inputId = idInput ? idInput.value.trim() : '';
        const inputPw = pwInput ? pwInput.value.trim() : '';
        if(!inputId || !inputPw) { showCustomAlert('❌ エラー', 'IDとパスワードを両方入力してください。'); return; }
        if(!database) { showCustomAlert('❌ エラー', '通信に問題があり、復元できませんでした。'); return; }
        database.ref('players/' + inputId).once('value').then(function(snap){
            if(!snap.exists()) { showCustomAlert('❌ エラー', 'そのIDのプレイヤーは見つかりません。'); return; }
            const data = snap.val();
            if(!data.password) { showCustomAlert('❌ エラー', 'このIDにはパスワードが設定されていません。バックアップコードでの復元をお試しください。'); return; }
            if(data.password !== inputPw) { showCustomAlert('❌ エラー', 'パスワードが正しくありません。'); return; }
            // 認証成功：savedataを取得して復元
            database.ref('players/' + inputId + '/savedata').once('value').then(function(sdSnap){
                const cloud = sdSnap.val();
                if(!cloud) { showCustomAlert('❌ エラー', 'このIDにはまだセーブデータがありません。'); return; }
                playerId = inputId;
                playerSecretKey = data.secretKey || playerSecretKey;
                localStorage.setItem('qr_player_id', playerId);
                if(data.secretKey) localStorage.setItem('qr_secret_key', playerSecretKey);
                applySaveDataObject(cloud);
                if(cloud.timestamp) localStorage.setItem('qr_last_synced_ts', String(cloud.timestamp));
                updatePlayerIdDisplay();
                saveGameLocalOnly();
                updateFridgeUI(); updateCookSelects(); refreshRecipeBookUI();
                updateShopButtons(); updateMatchCurrySelects();
                setupLoadedIconUI(); updateLvDisplay(); initQuest();
                ensureDeliveryCurrySynced();
                showCustomAlert('✅ 復元完了', 'IDとパスワードでデータを復元しました！');
            });
        }).catch(function(){
            showCustomAlert('❌ エラー', '復元処理に失敗しました。');
        });
    });
}

function restoreFromBackupCode() {
    showCustomConfirm(
        '🔑 バックアップコードで復元',
        '<div style="margin-bottom:8px;font-size:12px;color:#420000;">バックアップコードを貼り付けてください。</div>'
        + '<textarea id="restoreCodeArea" style="width:100%;height:100px;font-size:16px;padding:8px;border:1px solid #b88742;border-radius:4px;box-sizing:border-box;background:#f5e9c8;color:#420000;resize:none;" placeholder="バックアップコードをここに貼り付け..."></textarea>',
        function() {
            const ta = document.getElementById('restoreCodeArea');
            if(!ta || !ta.value.trim()) { showCustomAlert('❌ エラー', 'コードを入力してください。'); return; }
            let decoded;
            try {
                decoded = JSON.parse(decodeURIComponent(escape(atob(ta.value.trim()))));
            } catch(e) {
                showCustomAlert('❌ 復元失敗', 'コードが正しくありません。コードを確認してください。');
                return;
            }
            // 別デバイス・ブラウザでの復元かどうかを判定
            const currentSecretKey = localStorage.getItem('qr_secret_key');
            const isDifferentDevice = decoded.secretKey && currentSecretKey && decoded.secretKey !== currentSecretKey;
            if (isDifferentDevice) {
                showCustomConfirm(
                    '⚠️ 別デバイスでの復元',
                    '<div style="font-size:13px;color:#420000;line-height:1.6;">別のデバイス・ブラウザで復元すると、同期にズレが発生する可能性があります。<br><br>できるだけ1つのデバイス・ブラウザでのプレイをおすすめします。<br><br>復元を続けますか？</div>',
                    function() { performBackupRestore(decoded); }
                );
            } else {
                performBackupRestore(decoded);
            }
        }
    );
}

function performBackupRestore(decoded) {
    applySaveDataObject(decoded);
    // プレイヤーID・シークレットキーの復元（ver2以降）
    if(decoded.playerId && decoded.secretKey) {
        playerId = decoded.playerId;
        playerSecretKey = decoded.secretKey;
        localStorage.setItem('qr_player_id', playerId);
        localStorage.setItem('qr_secret_key', playerSecretKey);
        updatePlayerIdDisplay();
        if(database) { database.ref('players/' + playerId).update({ secretKey: playerSecretKey, name: playerName }); }
    }
    saveGame();
    updateFridgeUI(); updateCookSelects(); refreshRecipeBookUI();
    updateShopButtons(); updateMatchCurrySelects();
    setupLoadedIconUI(); updateLvDisplay(); initQuest();

    // 復元直後、最新のクラウド上のセーブデータを取得して上書き（コード自体は古い可能性があるため）
    if(database && playerId) {
        database.ref('players/' + playerId + '/savedata').once('value').then(function(snap){
            const cloud = snap.val();
            if(cloud && cloud.timestamp) {
                applySaveDataObject(cloud);
                localStorage.setItem('qr_last_synced_ts', String(cloud.timestamp));
                saveGameLocalOnly();
                updateFridgeUI(); updateCookSelects(); refreshRecipeBookUI();
                updateShopButtons(); updateMatchCurrySelects();
                setupLoadedIconUI(); updateLvDisplay(); initQuest();
            }
            ensureDeliveryCurrySynced();
            showCustomAlert('✅ 復元完了', 'バックアップコードからデータを復元しました！');
        }).catch(function(){
            ensureDeliveryCurrySynced();
            showCustomAlert('✅ 復元完了', 'バックアップコードからデータを復元しました！');
        });
    } else {
        showCustomAlert('✅ 復元完了', 'バックアップコードからデータを復元しました！');
    }
}

function toggleAccordion(header) {
    var arrow = header.querySelector('.accordion-arrow');
    var body = header.nextElementSibling;
    var isOpen = body.classList.contains('open');
    document.querySelectorAll('.accordion-body').forEach(function(b) { b.classList.remove('open'); });
    document.querySelectorAll('.accordion-arrow').forEach(function(a) { a.classList.remove('open'); });
    if(!isOpen) { body.classList.add('open'); arrow.classList.add('open'); }
}

// ===== カレー店情報 =====
const CURRY_SHOPS = [
    {
        id: 'shop1',
        name: '空腹は最高のスパイスカレー',
        location: '兵庫県西宮市',
        photos: ['shop/shop-1-1.png', 'shop/shop-1-2.png'],
        desc: 'グルテンフリーで「美味しいが健康に」\n阪急夙川駅から東へ約10分\n阪急電車高架下≪阪急夙川サンらいふ≫',
        links: [{ label: 'Instagram', url: 'https://www.instagram.com/hunger_is_the_best_spice_curry/' }]
    },
    {
        id: 'shop2',
        name: 'Midnight Sun',
        location: '大阪市中央区',
        photos: ['shop/shop-2-1.png', 'shop/shop-2-2.png'],
        desc: '大阪の爽やかスパイスカレーとコーヒーのお店\n地下鉄堺筋線 堺筋本町駅 7番出口から徒歩約5分',
        links: [
            { label: 'Instagram', url: 'https://www.instagram.com/midnight_sun_curry_coffee/' },
            { label: 'X', url: 'https://x.com/midnightsun_mns' }
        ]
    },
    {
        id: 'shop3',
        name: 'らんらんルー',
        location: '大阪谷町六丁目',
        photos: ['shop/shop-3-1.png', 'shop/shop-3-2.png'],
        desc: '谷町六丁目駅4番出口から徒歩１分\n【究極のカレー準グランプリ(欧風カレー部門)】\n店内にあの有名RPGのフィギュアいっぱい！',
        links: [
            { label: 'Instagram', url: 'https://www.instagram.com/ranranru_curry/' },
            { label: 'X', url: 'https://x.com/ranranru_curry' }
        ]
    }
];

function renderShopInfoList() {
    const area = document.getElementById('shopInfoList');
    if(!area) return;
    area.innerHTML = CURRY_SHOPS.map(shop =>
        `<div onclick="openCurryShopInfoModal('${shop.id}')" style="display:flex; align-items:center; gap:10px; padding:10px 8px; border-bottom:1px solid #e8d8b0; cursor:pointer; background:transparent;" onmouseover="this.style.background='#f5e9c8'" onmouseout="this.style.background='transparent'">
            <img src="${shop.photos[0]}" style="width:48px; height:48px; border-radius:6px; object-fit:cover; flex-shrink:0;">
            <div style="flex:1; min-width:0;">
                <div style="font-size:13px; font-weight:bold; color:#420000;">${shop.name}</div>
                <div style="font-size:11px; color:#9a8060; margin-top:2px;">${shop.location}</div>
            </div>
            <span style="color:#b88742; font-size:12px; flex-shrink:0;">▶</span>
        </div>`
    ).join('');
}

function openCurryShopInfoModal(shopId) {
    const shop = CURRY_SHOPS.find(s => s.id === shopId);
    if(!shop) return;
    document.getElementById('curryShopInfoName').innerText = shop.name;
    document.getElementById('curryShopInfoLocation').innerText = '📍 ' + shop.location;
    document.getElementById('curryShopInfoPhotos').innerHTML = shop.photos
        .map(p => `<img src="${p}" style="width:48%; max-width:160px; border-radius:6px; object-fit:cover;">`)
        .join('');
    document.getElementById('curryShopInfoDesc').innerText = shop.desc;
    const linkBtns = (shop.links || [{ label: shop.linkLabel, url: shop.linkUrl }])
        .map(l => `<button onclick="window.open('${l.url}','_blank')" style="padding:10px 24px; background:#e67e22; color:#fff; border:none; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer; margin:0 4px;">${l.label}</button>`)
        .join('');
    document.getElementById('curryShopInfoLinkArea').innerHTML = linkBtns;
    document.getElementById('curryShopInfoOverlay').style.display = 'flex';
}

function closeCurryShopInfoModal() {
    document.getElementById('curryShopInfoOverlay').style.display = 'none';
}
// PC戦（中級）・タッグ戦のロック状態（解放前はグレーアウト＋タップで案内のみ）を更新する
function updateBattleModeLocks() {
    const hardUnlocked = isHardModeUnlocked();
    const tagUnlocked = isTagModeUnlocked();

    const btnHard = document.getElementById('btnBotHard');
    if(btnHard) {
        btnHard.classList.toggle('battle-mode-locked', !hardUnlocked);
        btnHard.onclick = hardUnlocked ? function(){ openBotProgressModal('hard'); } : function(){ showLockedModeAlert(); };
    }
    const btnTag = document.getElementById('btnTagBattle');
    if(btnTag) {
        btnTag.classList.toggle('battle-mode-locked', !tagUnlocked);
        btnTag.onclick = tagUnlocked ? function(){ startTagBattle(); } : function(){ showLockedModeAlert(); };
    }
    // タッグ戦未解放時にdisplay:noneで消すと、隣の「フェスとは？」がflexで左詰めされて
    // タッグ戦ボタンの下（本来の位置ではない場所）にずれてしまうため、
    // visibility:hiddenで見た目だけ消してレイアウト上の枠（flexの幅）は保持する。
    const tagInfoBtn = document.getElementById('btnTagBattleInfo');
    if(tagInfoBtn) tagInfoBtn.style.visibility = tagUnlocked ? 'visible' : 'hidden';
}
function showLockedModeAlert() {
    showCustomAlert('🔒 まだ解放されていません', 'このモードはまだ解放されていません。');
}
// カレーフェス本実装：enterCurryFest()（フェス専用stateの定義付近）に移行済み
function updateShopButtons() {
    const bNormal = document.getElementById("btnGachaNormal"); const bSpice = document.getElementById("btnGachaSpice");
    const bMid = document.getElementById("btnGachaMid"); const bHigh = document.getElementById("btnGachaHigh");
    const bPack = document.getElementById("btnGachaPack");
    if(bNormal) bNormal.disabled = playerG < 30; if(bSpice) bSpice.disabled = playerG < 30;
    if(bMid) bMid.disabled = playerG < 100; if(bHigh) bHigh.disabled = playerG < 300;
    if(bPack) bPack.disabled = packTicket < 1;
    const b10ren = document.getElementById("btnGacha10ren");
    if(b10ren) b10ren.disabled = playerG < 300;
}
// くじ選択モーダル（6種のくじボタンを1つの「くじを引く」ボタンから開く）
// ===== スパイシーコイン交換所 =====
// コイン1枚で中級または高級の新規食材（コイン交換限定）を一括解放する
// ===== ショップ =====
// 商品マスタ。今後も追加していく予定（priceType: 'gold' or 'coin'）
const SHOP_ITEMS = [
    {
        id: 'bingo_maru',
        name: 'BINGOの⭕️',
        desc: 'ビンゴの空いていないマスのどれかに⭕️をつけます。\n※購入後すぐに消費されます。\n手に入れたことのない食材マス「？」には適用されません。',
        priceType: 'gold', price: 200,
        oneTimeOnly: false
    },
    {
        id: 'tableware_alumite',
        name: 'アルマイト皿',
        desc: '購入すると「食器」に追加され、選べるようになります。\n選択中の効果: ATK-10 / DEF+20\n※購入は1回限りです。',
        priceType: 'gold', price: 500,
        oneTimeOnly: true, tablewareUnlock: 'アルマイト皿'
    },
    {
        id: 'tableware_wood',
        name: '温もりの木皿',
        desc: '購入すると「食器」に追加され、選べるようになります。\n選択中の効果: DEF-10 / SPD+30\n※購入は1回限りです。',
        priceType: 'gold', price: 500,
        oneTimeOnly: true, tablewareUnlock: '温もりの木皿'
    },
    {
        id: 'tableware_oval',
        name: 'オーバルプレート',
        desc: '購入すると「食器」に追加され、選べるようになります。\n選択中の効果: ATK+15 / DEF-15\n※購入は1回限りです。',
        priceType: 'gold', price: 2000,
        oneTimeOnly: true, tablewareUnlock: 'オーバルプレート'
    },
    {
        id: 'tableware_thali',
        name: 'ターリー皿',
        desc: '購入すると「食器」に追加され、選べるようになります。\n選択中の効果: HP+20 / ATK-5 / DEF-5\n※購入は1回限りです。',
        priceType: 'gold', price: 2000,
        oneTimeOnly: true, tablewareUnlock: 'ターリー皿'
    },
    {
        id: 'unlock_mid',
        name: '中級食材追加3種',
        desc: '中級食材くじに3種類追加されます。',
        priceType: 'coin', price: 1,
        oneTimeOnly: true, unlockKey: 'qr_unlock_coin_mid'
    },
    {
        id: 'unlock_high',
        name: '高級食材追加2種',
        desc: '高級食材くじに2種類追加されます。',
        priceType: 'coin', price: 1,
        oneTimeOnly: true, unlockKey: 'qr_unlock_coin_high'
    },
    {
        id: 'icon_carrot_potato',
        name: '人参ジャガイモアイコン',
        desc: 'プレイヤーアイコン',
        image: 'myimageicon/mayimage10.png',
        priceType: 'coin', price: 1,
        oneTimeOnly: true, iconFile: 'myimageicon/mayimage10.png'
    }
];
function openShopModal() {
    renderShopList();
    document.getElementById('shopListOverlay').style.display = 'flex';
}
function closeShopModal() {
    document.getElementById('shopListOverlay').style.display = 'none';
}
// 商品が購入済み（再購入不可）かどうかを判定する
function isShopItemPurchased(item) {
    if(!item.oneTimeOnly) return false;
    if(item.unlockKey) return localStorage.getItem(item.unlockKey) === '1';
    if(item.iconFile) return getUnlockedIcons().includes(item.iconFile);
    if(item.tablewareUnlock) return getUnlockedTableware().includes(item.tablewareUnlock);
    return false;
}
function renderShopList() {
    const area = document.getElementById('shopListArea');
    if(!area) return;
    area.innerHTML = SHOP_ITEMS.map((item, idx) => {
        const purchased = isShopItemPurchased(item);
        const priceLabel = item.priceType === 'gold' ? `${item.price}G` : `スパイシーコイン${item.price}枚`;
        return `<div onclick="${purchased ? '' : `openShopDetailModal(${idx})`}" style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:10px 8px; border-bottom:1px solid #e8d9b8; cursor:${purchased ? 'default' : 'pointer'}; ${purchased ? 'opacity:0.5;' : ''}">
            <span style="font-size:12px; font-weight:bold; color:#420000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}${purchased ? '（購入済み）' : ''}</span>
            <span style="font-size:11px; color:#9a6e30; font-weight:bold; white-space:nowrap; flex-shrink:0;">${priceLabel}</span>
        </div>`;
    }).join('');
}
let currentShopItemIdx = null;
function openShopDetailModal(idx) {
    const item = SHOP_ITEMS[idx];
    if(!item) return;
    currentShopItemIdx = idx;
    closeShopModal();
    document.getElementById('shopDetailName').innerText = item.name;
    const imgArea = document.getElementById('shopDetailImageArea');
    if(item.image) {
        imgArea.innerHTML = `<img src="${item.image}" style="width:80px;height:80px;object-fit:contain;border-radius:8px;border:2px solid #b88742;">`;
        imgArea.style.display = 'block';
    } else {
        imgArea.innerHTML = '';
        imgArea.style.display = 'none';
    }
    document.getElementById('shopDetailDesc').innerText = item.desc;
    const priceLabel = item.priceType === 'gold' ? `${item.price}G` : `スパイシーコイン${item.price}枚`;
    document.getElementById('shopDetailPrice').innerText = `価格: ${priceLabel}`;
    document.getElementById('shopDetailOverlay').style.display = 'flex';
}
function closeShopDetailModal() {
    document.getElementById('shopDetailOverlay').style.display = 'none';
    renderShopList();
    document.getElementById('shopListOverlay').style.display = 'flex';
}
function confirmShopPurchase() {
    const item = SHOP_ITEMS[currentShopItemIdx];
    if(!item) return;
    // 通貨チェック
    if(item.priceType === 'gold' && playerG < item.price) {
        showCustomAlert('⚠️ Gが足りません', `この商品の購入には${item.price}Gが必要です。`);
        return;
    }
    if(item.priceType === 'coin' && (spicyCoin || 0) < item.price) {
        showCustomAlert('⚠️ コインが足りません', `この商品の購入にはスパイシーコイン${item.price}枚が必要です。`);
        return;
    }
    // BINGOの⭕️専用：効果があるか事前チェック
    if(item.id === 'bingo_maru') {
        const target = findOpenableBingoCell();
        if(!target) {
            showCustomAlert('⚠️ 今購入しても効果がありません', '今開けられるビンゴのマスがありません。');
            return;
        }
    }
    // 購入処理
    if(item.priceType === 'gold') {
        playerG -= item.price;
        const goldEl = document.getElementById('globalG'); if(goldEl) goldEl.innerText = playerG;
    } else {
        spicyCoin -= item.price;
        const coinEl = document.getElementById('globalSpicyCoin'); if(coinEl) coinEl.innerText = spicyCoin;
    }
    if(item.id === 'bingo_maru') {
        const target = findOpenableBingoCell();
        document.getElementById('shopDetailOverlay').style.display = 'none';
        document.getElementById('shopListOverlay').style.display = 'none';
        onItemObtainedForBingo(target);
    } else if(item.oneTimeOnly && item.unlockKey) {
        localStorage.setItem(item.unlockKey, '1');
        updateFridgeUI();
    } else if(item.oneTimeOnly && item.iconFile) {
        unlockIcon(item.iconFile);
    } else if(item.oneTimeOnly && item.tablewareUnlock) {
        if(item.tablewareUnlock === 'アルマイト皿') unlockAlumiteTableware = true;
        else if(item.tablewareUnlock === '温もりの木皿') unlockWoodTableware = true;
        else if(item.tablewareUnlock === 'オーバルプレート') unlockOvalTableware = true;
        else if(item.tablewareUnlock === 'ターリー皿') unlockThaliTableware = true;
    }
    saveGame();
    if(item.id === 'bingo_maru') {
        // ビンゴ演出（最大3秒程度）を隠さないよう、アラートは演出終了後に表示する
        setTimeout(() => { showCustomAlert('✅ 購入完了', `${item.name}を購入しました！`); }, 3500);
    } else if(item.iconFile) {
        closeShopDetailModal();
        showCustomAlert('✅ 購入完了', `${item.name}を購入しました！`, () => {
            showIconGetOverlay(item.iconFile, 'ショップ購入');
        });
    } else {
        closeShopDetailModal();
        showCustomAlert('✅ 購入完了', `${item.name}を購入しました！`);
    }
}
// ビンゴの「まだ開いていない、かつ入手済み食材」のマスを1つランダムに探す
function findOpenableBingoCell() {
    const data = getBingoData();
    if(!data) return null;
    const candidates = data.cardItems.filter((itemName, idx) => !data.opened[idx] && discoveredItems[itemName]);
    if(candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
}
function openGachaSelectModal() {
    updateShopButtons();
    document.getElementById('gachaSelectOverlay').style.display = 'flex';
}
function closeGachaSelectModal() {
    document.getElementById('gachaSelectOverlay').style.display = 'none';
}
function buyGacha(type) {
    let cost = 30; if (type === 'mid') cost = 100; if (type === 'high') cost = 300;
    if (playerG < cost) return;
    playerG -= cost;
    let winner = ""; let emoji = "";
    if (type === 'normal') {
        const pool = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 0 && isIngredientAvailable(k));
        winner = pool[Math.floor(Math.random() * pool.length)]; emoji = masterIngredients[winner].emoji;
    } else if (type === 'spice') {
        const pool = Object.keys(masterSpices).filter(k => k !== "マンゴーチャツネ" && k !== "サフラン" && isIngredientAvailable(k));
        winner = pool[Math.floor(Math.random() * pool.length)]; emoji = masterSpices[winner].emoji;
    } else if (type === 'mid') {
        // 中級食材 + 中級スパイス(サフラン) を合わせたプール
        const ingPool = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 1 && isIngredientAvailable(k));
        const spcPool = isIngredientAvailable("サフラン") ? ["サフラン"] : [];
        const pool = [...ingPool, ...spcPool];
        winner = pool[Math.floor(Math.random() * pool.length)];
        emoji = masterIngredients[winner] ? masterIngredients[winner].emoji : masterSpices[winner].emoji;
    } else if (type === 'high') {
        // 最高級食材 + 最高級スパイス(マンゴーチャツネ) を合わせたプール
        const ingPool = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 2 && isIngredientAvailable(k));
        const spcPool = ["マンゴーチャツネ"];
        const pool = [...ingPool, ...spcPool];
        winner = pool[Math.floor(Math.random() * pool.length)];
        emoji = masterIngredients[winner] ? masterIngredients[winner].emoji : masterSpices[winner].emoji;
    }
    inventory[winner] = (inventory[winner] || 0) + 1; discoveredItems[winner] = true;
    const gachaItemData = masterIngredients[winner] || masterSpices[winner];
    const gachaIcon = gachaItemData && gachaItemData.icon;
    const gachaImg = gachaIcon ? `<img src="${gachaIcon}" style="width:1.5em;height:1.5em;vertical-align:middle;object-fit:contain;">` : emoji;
    playWinSound(); showCustomAlert("くじ結果", `見事！${gachaImg}【${winner}】を引き当てた！`);
    saveGame(); updateFridgeUI(); updateCookSelects();
}
function buyJurenGacha() {
    if(playerG < 300) { showCustomAlert("💸 ゴールド不足", "300G 必要です。"); return; }
    playerG -= 300;
    const normalPool = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 0 && isIngredientAvailable(k));
    const midPool = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 1 && isIngredientAvailable(k));
    const highPool = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 2 && isIngredientAvailable(k));
    // ノーマル食材10個
    let items = [];
    for(let i = 0; i < 10; i++) {
        const it = normalPool[Math.floor(Math.random() * normalPool.length)];
        inventory[it] = (inventory[it] || 0) + 1; discoveredItems[it] = true; items.push(it);
    }
    // おまけ抽選
    const iconGot = localStorage.getItem('qr_icon07_got') === '1';
    const r = Math.random();
    let bonusMsg = '';
    let bonusItem = null;
    if(!iconGot && r < 0.10) {
        // プレイヤーアイコン（1回きり）
        localStorage.setItem('qr_icon07_got', '1');
        const unlocked = getUnlockedIcons();
        if(!unlocked.includes('myimageicon/mayimage07.png')) { unlocked.push('myimageicon/mayimage07.png'); saveUnlockedIcons(unlocked); }
        setupLoadedIconUI();
        bonusMsg = '🎉 特別！新プレイヤーアイコン解放！';
        setTimeout(() => showIconGetOverlay('myimageicon/mayimage07.png', '10連くじの気まぐれ'), 300);
    } else {
        // アイコン取得済みの場合確率再計算
        const base = iconGot ? r : (r - 0.10) / 0.90;
        const normThresh = iconGot ? 0.70 : 0.60;
        if(base < normThresh) {
            bonusItem = normalPool[Math.floor(Math.random() * normalPool.length)];
            inventory[bonusItem] = (inventory[bonusItem] || 0) + 1; discoveredItems[bonusItem] = true;
            const d = masterIngredients[bonusItem]; const ico = d&&d.icon?`<img src="${d.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">`:'' ;
            bonusMsg = `おまけ: ${ico}${bonusItem} ×1`;
        } else if(base < normThresh + 0.10) {
            bonusItem = midPool[Math.floor(Math.random() * midPool.length)];
            inventory[bonusItem] = (inventory[bonusItem] || 0) + 1; discoveredItems[bonusItem] = true;
            const d = masterIngredients[bonusItem]; const ico = d&&d.icon?`<img src="${d.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">`:'' ;
            bonusMsg = `おまけ: ${ico}${bonusItem} ×1（中級）`;
        } else if(base < normThresh + 0.20) {
            bonusItem = highPool[Math.floor(Math.random() * highPool.length)];
            inventory[bonusItem] = (inventory[bonusItem] || 0) + 1; discoveredItems[bonusItem] = true;
            const d = masterIngredients[bonusItem]; const ico = d&&d.icon?`<img src="${d.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">`:'' ;
            bonusMsg = `おまけ: ${ico}${bonusItem} ×1（高級）`;
        } else {
            let bonus3 = [];
            for(let i = 0; i < 3; i++) {
                const it = normalPool[Math.floor(Math.random() * normalPool.length)];
                inventory[it] = (inventory[it] || 0) + 1; discoveredItems[it] = true; bonus3.push(it);
            }
            const b3html = bonus3.map(it => { const d=masterIngredients[it]; const ico=d&&d.icon?`<img src="${d.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">`:'' ; return ico+it; }).join(' ');
            bonusMsg = `おまけ: ${b3html} ×各1`;
        }
    }
    saveGame(); updateFridgeUI(); updateCookSelects(); updateShopButtons();
    const itemList = items.map(it => { const d=masterIngredients[it]; const ico=d&&d.icon?`<img src="${d.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">`:'' ; return ico+it; }).join(' ');
    playWinSound();
    showCustomAlert('10連くじ結果', `ノーマル食材10個入手！<br><div style="margin:8px 0;">${itemList}</div><br><b>${bonusMsg}</b>`);
}

function buyGachaPack() {
    if (packTicket < 1) return;
    packTicket--;
    let rewards = [];
    const normalPool = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 0 && isIngredientAvailable(k));
    for(let i=0; i<7; i++) {
        let item = normalPool[Math.floor(Math.random() * normalPool.length)]; rewards.push({ name: item, emoji: masterIngredients[item].emoji });
        inventory[item] = (inventory[item] || 0) + 1; discoveredItems[item] = true;
    }
    const spicePool = Object.keys(masterSpices).filter(k => k !== "マンゴーチャツネ" && k !== "サフラン" && isIngredientAvailable(k));
    for(let i=0; i<2; i++) {
        let item = spicePool[Math.floor(Math.random() * spicePool.length)]; rewards.push({ name: item, emoji: masterSpices[item].emoji });
        inventory[item] = (inventory[item] || 0) + 1; discoveredItems[item] = true;
    }
    let rarePool = Math.random() < 0.5 ? Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 1 && isIngredientAvailable(k)) : Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 2 && isIngredientAvailable(k));
    let rareItem = rarePool[Math.floor(Math.random() * rarePool.length)]; rewards.push({ name: rareItem, emoji: masterIngredients[rareItem].emoji });
    inventory[rareItem] = (inventory[rareItem] || 0) + 1; discoveredItems[rareItem] = true;
    let resultHTML = "<div style='text-align:left; max-height:220px; overflow-y:auto; background:#fff; padding:10px; border-radius:8px; border:1px solid #ddd; line-height:1.6;'>";
    rewards.forEach((r, idx) => {
        const pd = masterIngredients[r.name] || masterSpices[r.name];
        const pImg = pd && pd.icon ? `<img src="${pd.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">` : r.emoji;
        resultHTML += `${idx+1}. ${pImg} <b>${r.name}</b><br>`;
    });
    resultHTML += "</div>";
    playWinSound(); showCustomAlert("🎉 豪華10個パック開封！", `以下の10個を手に入れた！<br><br>${resultHTML}`);
    saveGame(); updateFridgeUI(); updateCookSelects();
}
function selectRandomIngredients() {
    const avail = Object.keys(masterIngredients).filter(n => (inventory[n] || 0) > 0 && !lockedItems[n]);
    const sps = Object.keys(masterSpices).filter(n => (inventory[n] || 0) > 0 && !lockedItems[n]);
    if (avail.length < 3 || sps.length < 1) { showCustomAlert("⚠️ 在庫不足", "具材3種・スパイス1種以上の在庫（ロック中を除く）が必要です！"); return; }
    let pool = [...avail];
    ["ingredient1", "ingredient2", "ingredient3"].forEach(id => { document.getElementById(id).value = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; });
    document.getElementById("spice").value = sps[Math.floor(Math.random() * sps.length)];
    [1,2,3].forEach(n => updateIngredientHint(n));
    updateSpiceHint();
    syncCookSelectionFromHiddenSelects();
}
// 隠しselectの値→新UIの選択状態（cookSelectedIngredients/cookSelectedSpice）に同期する
// ランダム選択・おすすめセット・お気に入りレシピ適用など、隠しselectを直接書き換える既存処理の後に呼ぶ
function syncCookSelectionFromHiddenSelects() {
    cookSelectedIngredients = [1,2,3].map(n => document.getElementById("ingredient"+n).value).filter(Boolean);
    cookSelectedSpice = document.getElementById("spice").value || "";
    renderCookPickerUI();
}
let video = document.createElement("video"); let canvasElement = document.getElementById("canvas"); let canvas = canvasElement.getContext("2d"); let localStream = null; let animationFrameId = null;
let lastTickTime = 0;
function startCamera() {
    document.getElementById("getBox").style.display = "none";
    // 解像度を高めに指定し、対応端末では連続オートフォーカスを有効にすることで、QRコードのピント合わせを改善する
    const constraints = {
        video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            advanced: [{ focusMode: "continuous" }]
        }
    };
    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
        localStream = stream; video.srcObject = stream; video.setAttribute("playsinline", true); video.play();
        canvasElement.style.display = "inline-block"; document.getElementById("statusMessage").style.display = "block"; document.getElementById("qrFocusHint").style.display = "block";
        document.getElementById("btnCancel").style.display = "inline-block"; document.getElementById("btnStartCamera").style.display = "none";
        lastTickTime = 0;
        requestAnimationFrame(tick);
        setupTapToFocus(stream);
        setTimeout(() => { canvasElement.scrollIntoView({ behavior: "smooth", block: "center" }); }, 150);
    }).catch(function(err) {
        // focusMode等の高度な制約に対応していない端末向けに、シンプルな制約でフォールバックする
        console.log("カメラ起動エラー（高度な制約）、フォールバックを試行:", err);
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function(stream) {
            localStream = stream; video.srcObject = stream; video.setAttribute("playsinline", true); video.play();
            canvasElement.style.display = "inline-block"; document.getElementById("statusMessage").style.display = "block"; document.getElementById("qrFocusHint").style.display = "block";
            document.getElementById("btnCancel").style.display = "inline-block"; document.getElementById("btnStartCamera").style.display = "none";
            lastTickTime = 0;
            requestAnimationFrame(tick);
            setupTapToFocus(stream);
            setTimeout(() => { canvasElement.scrollIntoView({ behavior: "smooth", block: "center" }); }, 150);
        }).catch(function(err2) {
            console.log("カメラ起動エラー:", err2);
            showCustomAlert("⚠️ カメラエラー", "カメラを起動できませんでした。ブラウザのカメラ権限設定をご確認ください。");
        });
    });
}
// 画面（canvas）をタップした時、対応端末ならカメラのオートフォーカスを再実行させる
// （ピントが合わずQRが読み取りにくい時に、タップで合わせ直せるようにする）
function setupTapToFocus(stream) {
    const track = stream.getVideoTracks()[0];
    if(!track) return;
    canvasElement.onclick = function() {
        if(typeof track.getCapabilities !== 'function') return; // 非対応端末は何もしない（エラーにしない）
        const capabilities = track.getCapabilities();
        if(capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
            track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function(e){ console.log('フォーカス再適用エラー:', e); });
        }
        // タップした位置を視覚的にフィードバック（ピント合わせを試みたことが分かるように一瞬枠を表示）
        showFocusTapIndicator();
    };
}
// タップ位置にピント調整中のフィードバック表示（簡易演出）
function showFocusTapIndicator() {
    const indicator = document.getElementById('qrFocusIndicator');
    if(!indicator) return;
    indicator.style.display = 'block';
    indicator.classList.remove('qr-focus-pulse');
    void indicator.offsetWidth;
    indicator.classList.add('qr-focus-pulse');
    setTimeout(() => { indicator.style.display = 'none'; }, 500);
}
function tick(timestamp) {
    if(timestamp - lastTickTime < 100) { animationFrameId = requestAnimationFrame(tick); return; }
    lastTickTime = timestamp;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvasElement.height = video.videoHeight; canvasElement.width = video.videoWidth; canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        var imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        var code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code) {
            let loc = code.location; let startX = Math.max(0, Math.floor(loc.topLeftCorner.x)); let startY = Math.max(0, Math.floor(loc.topLeftCorner.y));
            let w = Math.min(canvasElement.width - startX, Math.floor(loc.topRightCorner.x - loc.topLeftCorner.x));
            let h = Math.min(canvasElement.height - startY, Math.floor(loc.bottomLeftCorner.y - loc.topLeftCorner.y));
            let rSum = 0, gSum = 0, bSum = 0, pCount = 0;
            if(w > 10 && h > 10) {
                let qrImgData = canvas.getImageData(startX, startY, w, h).data;
                for(let i=0; i<qrImgData.length; i+=4) { rSum += qrImgData[i]; gSum += qrImgData[i+1]; bSum += qrImgData[i+2]; pCount++; }
            }
            let avgR = pCount > 0 ? rSum / pCount : 0; let avgG = pCount > 0 ? gSum / pCount : 0; let avgB = pCount > 0 ? bSum / pCount : 0;
            if(navigator.vibrate) navigator.vibrate(100);
            stopCamera(); canvasElement.style.display = "none"; processQRData(code.data, avgR, avgG, avgB); return;
        }
    }
    animationFrameId = requestAnimationFrame(tick);
}
function stopCamera() { if (animationFrameId) cancelAnimationFrame(animationFrameId); if (localStream) localStream.getTracks().forEach(track => track.stop()); document.getElementById("btnCancel").style.display = "none"; }
function cancelScanning() { stopCamera(); canvasElement.style.display = "none"; document.getElementById("statusMessage").style.display = "none"; document.getElementById("qrFocusHint").style.display = "none"; document.getElementById("btnStartCamera").style.display = "inline-block"; }
// 実店舗「空腹は最高のスパイスカレー」のSNSキーワードと、別窓で開くURLのマッピング
const SHOP1_KEYWORD_URLS = {
    "hunger_is_the_best_spice_curry": "https://www.instagram.com/hunger_is_the_best_spice_curry/",
    "hungerbestspice": "https://x.com/hungerbestspice"
};
const SHOP2_KEYWORD_URLS = {
    "midnight_sun_curry_coffee": "https://www.instagram.com/midnight_sun_curry_coffee/",
    "midnightsun_mns": "https://x.com/midnightsun_mns"
};
let currentShop1LinkUrl = '';
let pendingShopQR = null; // スキャン済みでSNSを開く待ちの店舗情報

function openShop1Link() {
    if(!currentShop1LinkUrl) return;
    let rewardMsg = null;
    if(pendingShopQR) {
        const pq = pendingShopQR;
        pendingShopQR = null;
        if(pq.shopId === 'shop1') rewardMsg = giveShop1Reward(pq.text);
        else if(pq.shopId === 'shop2') rewardMsg = giveShop2Reward(pq.text);
        else if(pq.shopId === 'shop3') rewardMsg = giveShop3Reward(pq.text);
    }
    window.open(currentShop1LinkUrl, '_blank');
    // SNSから戻ってきたときに報酬を確認できるよう通知表示
    if(rewardMsg) {
        setTimeout(() => showCustomAlert('🎁 報酬GET！', rewardMsg), 800);
    }
}

function giveShop1Reward(text) {
    const isFirstTime = localStorage.getItem('qr_shop1_scanned') !== '1';
    const today = getJSTDateString();
    const isFirstToday = scanHistory[text] !== today;
    scanHistory[text] = today;
    const rewardArea = document.getElementById("shopQrRewardArea");
    let rewardMsg = null;
    if(isFirstTime) {
        localStorage.setItem('qr_shop1_scanned', '1');
        spicyCoin = (spicyCoin || 0) + 1;
        rewardMsg = '🌶️ スパイシーコイン 1枚 GET！';
        if(rewardArea) rewardArea.innerHTML = `<div style="font-size:14px; font-weight:bold; color:#e67e22;">${rewardMsg}</div>`;
        const coinEl = document.getElementById('globalSpicyCoin'); if(coinEl) coinEl.innerText = spicyCoin;
        setTimeout(() => showCoinGetOverlay(1), 300);
    } else if(isFirstToday) {
        const normalItems = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 0 && isIngredientAvailable(k));
        let gained = [];
        for(let i = 0; i < 3; i++) {
            const it = normalItems[Math.floor(Math.random() * normalItems.length)];
            inventory[it] = (inventory[it] || 0) + 1;
            discoveredItems[it] = true;
            gained.push(it);
        }
        const itemsHtml = gained.map(it => {
            const d = masterIngredients[it];
            const ico = d && d.icon ? `<img src="${d.icon}" style="width:1.4em;height:1.4em;vertical-align:middle;object-fit:contain;">` : '';
            return `<span style="margin:0 4px;">${ico} ${it}</span>`;
        }).join('');
        rewardMsg = '食材 3個 GET！';
        if(rewardArea) rewardArea.innerHTML = `<div style="font-size:14px; font-weight:bold; color:#2ecc71;">食材GET！</div><div style="margin-top:4px;">${itemsHtml}</div>`;
    } else {
        if(rewardArea) rewardArea.innerHTML = '';
    }
    try { saveGame(); } catch(e) {}
    try { updateCookSelects(); } catch(e) {}
    return rewardMsg;
}

function giveShop2Reward(text) {
    const isFirstTime = localStorage.getItem('qr_shop2_scanned') !== '1';
    const today = getJSTDateString();
    const isFirstToday = scanHistory[text] !== today;
    scanHistory[text] = today;
    const rewardArea = document.getElementById("shopQrRewardArea");
    let rewardMsg = null;
    if(isFirstTime) {
        localStorage.setItem('qr_shop2_scanned', '1');
        packTicket = (packTicket || 0) + 1;
        rewardMsg = '🎫 パック券 1枚 GET！';
        if(rewardArea) rewardArea.innerHTML = `<div style="font-size:14px; font-weight:bold; color:#e67e22;">${rewardMsg}</div>`;
        const pkEl = document.getElementById('globalPackTicket'); if(pkEl) pkEl.innerText = packTicket;
    } else if(isFirstToday) {
        const normalItems = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 0 && isIngredientAvailable(k));
        let gained = [];
        for(let i = 0; i < 3; i++) {
            const it = normalItems[Math.floor(Math.random() * normalItems.length)];
            inventory[it] = (inventory[it] || 0) + 1;
            discoveredItems[it] = true;
            gained.push(it);
        }
        const itemsHtml = gained.map(it => {
            const d = masterIngredients[it];
            const ico = d && d.icon ? `<img src="${d.icon}" style="width:1.4em;height:1.4em;vertical-align:middle;object-fit:contain;">` : '';
            return `<span style="margin:0 4px;">${ico} ${it}</span>`;
        }).join('');
        rewardMsg = '食材 3個 GET！';
        if(rewardArea) rewardArea.innerHTML = `<div style="font-size:14px; font-weight:bold; color:#2ecc71;">食材GET！</div><div style="margin-top:4px;">${itemsHtml}</div>`;
    } else {
        if(rewardArea) rewardArea.innerHTML = '';
    }
    try { saveGame(); } catch(e) {}
    try { updateCookSelects(); } catch(e) {}
    return rewardMsg;
}

function resetScanner() { document.getElementById("getBox").style.display = "none"; startCamera(); }

// Midnight Sun 専用QR処理
const SHOP3_KEYWORD_URLS = {
    "instagram.com/ranranru_curry": "https://www.instagram.com/ranranru_curry/",
    "x.com/ranranru_curry":         "https://x.com/ranranru_curry"
};

function giveShop3Reward(text) {
    const isFirstTime = localStorage.getItem('qr_shop3_scanned') !== '1';
    const today = getJSTDateString();
    const isFirstToday = scanHistory[text] !== today;
    scanHistory[text] = today;
    const rewardArea = document.getElementById("shopQrRewardArea");
    let rewardMsg = null;
    if(isFirstTime) {
        localStorage.setItem('qr_shop3_scanned', '1');
        packTicket = (packTicket || 0) + 1;
        rewardMsg = '🎫 パック券 1枚 GET！';
        if(rewardArea) rewardArea.innerHTML = `<div style="font-size:14px; font-weight:bold; color:#e67e22;">${rewardMsg}</div>`;
        const pkEl = document.getElementById('globalPackTicket'); if(pkEl) pkEl.innerText = packTicket;
    } else if(isFirstToday) {
        const normalItems = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 0 && isIngredientAvailable(k));
        let gained = [];
        for(let i = 0; i < 3; i++) {
            const it = normalItems[Math.floor(Math.random() * normalItems.length)];
            inventory[it] = (inventory[it] || 0) + 1;
            discoveredItems[it] = true;
            gained.push(it);
        }
        const itemsHtml = gained.map(it => {
            const d = masterIngredients[it];
            const ico = d && d.icon ? `<img src="${d.icon}" style="width:1.4em;height:1.4em;vertical-align:middle;object-fit:contain;">` : '';
            return `<span style="margin:0 4px;">${ico} ${it}</span>`;
        }).join('');
        rewardMsg = '食材 3個 GET！';
        if(rewardArea) rewardArea.innerHTML = `<div style="font-size:14px; font-weight:bold; color:#2ecc71;">食材GET！</div><div style="margin-top:4px;">${itemsHtml}</div>`;
    } else {
        if(rewardArea) rewardArea.innerHTML = '';
    }
    try { saveGame(); } catch(e) {}
    try { updateCookSelects(); } catch(e) {}
    return rewardMsg;
}

function processShop3QR(text, matchedKeyword) {
    try {
        currentShop1LinkUrl = SHOP3_KEYWORD_URLS[matchedKeyword] || '';
        pendingShopQR = { shopId: 'shop3', text };
        document.getElementById("getBoxTitle").innerText = "店舗情報";
        document.getElementById("bonusBadge").style.display = "none";
        document.getElementById("getItemEmoji").style.display = "none";
        document.getElementById("getItemName").style.display = "none";
        document.getElementById("shopQrArea").style.display = "block";
        document.getElementById("shopQrShopName").innerText = 'らんらんルー';
        document.getElementById("shopQrLocation").innerText = '大阪谷町六丁目';
        document.getElementById("shopQrPhotos").innerHTML = '<img src="shop/shop-3-1.png" style="width:48%; max-width:160px; border-radius:6px; object-fit:cover;"><img src="shop/shop-3-2.png" style="width:48%; max-width:160px; border-radius:6px; object-fit:cover;">';
        document.getElementById("shopQrDesc").innerHTML = '谷町六丁目駅4番出口から徒歩１分<br>【究極のカレー準グランプリ(欧風カレー部門)】<br>店内にあの有名RPGのフィギュアいっぱい！';
        document.getElementById("shopQrOpenLinkBtn").style.display = 'inline-block';
        const _r3ft = localStorage.getItem('qr_shop3_scanned') !== '1';
        const _r3td = scanHistory[text] !== getJSTDateString();
        document.getElementById("shopQrRewardArea").innerHTML = (_r3ft || _r3td)
            ? `<div style="font-size:12px; color:#9a6e30; font-weight:bold; margin-top:4px;">📱 SNSを開くと報酬GET！</div>` : '';
        document.getElementById("getBox").style.display = "block";
    } catch(e) { console.error('processShop3QR error:', e); }
}
function processShop2QR(text, matchedKeyword) {
    try {
        document.getElementById("getBoxTitle").innerText = "店舗情報";
        document.getElementById("bonusBadge").style.display = "none";
        document.getElementById("getItemEmoji").style.display = "none";
        document.getElementById("getItemName").style.display = "none";
        document.getElementById("shopQrArea").style.display = "block";
        document.getElementById("shopQrShopName").innerText = 'Midnight Sun';
        document.getElementById("shopQrLocation").innerText = '大阪市中央区';
        document.getElementById("shopQrPhotos").innerHTML = '<img src="shop/shop-2-1.png" style="width:48%; max-width:160px; border-radius:6px; object-fit:cover;"><img src="shop/shop-2-2.png" style="width:48%; max-width:160px; border-radius:6px; object-fit:cover;">';
        document.getElementById("shopQrDesc").innerHTML = '大阪の爽やかスパイスカレーとコーヒーのお店<br>地下鉄堺筋線 堺筋本町駅 7番出口から徒歩約5分';
        document.getElementById("shopQrOpenLinkBtn").style.display = 'inline-block';
        const _r2ft = localStorage.getItem('qr_shop2_scanned') !== '1';
        const _r2td = scanHistory[text] !== getJSTDateString();
        document.getElementById("shopQrRewardArea").innerHTML = (_r2ft || _r2td)
            ? `<div style="font-size:12px; color:#9a6e30; font-weight:bold; margin-top:4px;">📱 SNSを開くと報酬GET！</div>` : '';
        document.getElementById("getBox").style.display = "block";
    } catch(e) { console.error('processShop2QR error:', e); }
}

// 実店舗「空腹は最高のスパイスカレー」専用QR処理
// 初回（永続）はスパイシーコイン1枚、2回目以降はノーマル素材3つ。同日複数回スキャン可（簡略表示）。
function processShop1QR(text, matchedKeyword) {
    try {
        currentShop1LinkUrl = SHOP1_KEYWORD_URLS[matchedKeyword] || '';
        pendingShopQR = { shopId: 'shop1', text };
        document.getElementById("getBoxTitle").innerText = "店舗情報";
        document.getElementById("bonusBadge").style.display = "none";
        document.getElementById("getItemEmoji").style.display = "none";
        document.getElementById("getItemName").style.display = "none";
        document.getElementById("shopQrArea").style.display = "block";
        document.getElementById("shopQrShopName").innerText = '空腹は最高のスパイスカレー';
        document.getElementById("shopQrLocation").innerText = '兵庫県西宮市';
        document.getElementById("shopQrPhotos").innerHTML = '<img src="shop/shop-1-1.png" style="width:48%; max-width:160px; border-radius:6px; object-fit:cover;"><img src="shop/shop-1-2.png" style="width:48%; max-width:160px; border-radius:6px; object-fit:cover;">';
        document.getElementById("shopQrDesc").innerHTML = 'グルテンフリーで「美味しいが健康に」<br>阪急夙川駅から東へ約10分<br>阪急電車高架下≪阪急夙川サンらいふ≫';
        document.getElementById("shopQrOpenLinkBtn").style.display = 'inline-block';
        const _r1ft = localStorage.getItem('qr_shop1_scanned') !== '1';
        const _r1td = scanHistory[text] !== getJSTDateString();
        document.getElementById("shopQrRewardArea").innerHTML = (_r1ft || _r1td)
            ? `<div style="font-size:12px; color:#9a6e30; font-weight:bold; margin-top:4px;">📱 SNSを開くと報酬GET！</div>` : '';
        document.getElementById("getBox").style.display = "block";
    } catch(e) { console.error('processShop1QR error:', e); }
}
function processQRData(text, r, g, b) {
    try {
        // 実店舗「空腹は最高のスパイスカレー」のSNS QR判定（許可済み・特別仕様）
        // QRの実データはURLエンコードされている場合があるため、デコードしてから判定する
        let decodedText = text;
        try { decodedText = decodeURIComponent(text); } catch(e) { /* デコード不可ならそのまま使う */ }
        const matchedShop1Keyword = Object.keys(SHOP1_KEYWORD_URLS).find(kw => text.includes(kw) || decodedText.includes(kw));
        const isShop1Qr = !!matchedShop1Keyword;
        if(isShop1Qr) {
            processShop1QR(text, matchedShop1Keyword);
            return;
        }
        const matchedShop2Keyword = Object.keys(SHOP2_KEYWORD_URLS).find(kw => text.includes(kw) || decodedText.includes(kw));
        if(matchedShop2Keyword) {
            processShop2QR(text, matchedShop2Keyword);
            return;
        }
        const matchedShop3Keyword = Object.keys(SHOP3_KEYWORD_URLS).find(kw => text.includes(kw) || decodedText.includes(kw));
        if(matchedShop3Keyword) {
            processShop3QR(text, matchedShop3Keyword);
            return;
        }
        const today = getJSTDateString();
        if (scanHistory[text] === today && localStorage.getItem('qr_ignore_scan_history') !== '1') { document.getElementById("getBoxTitle").innerText = "⚠️ 使用済み"; document.getElementById("shopQrArea").style.display = "none"; document.getElementById("getItemEmoji").style.display = "block"; document.getElementById("getItemName").style.display = "block"; document.getElementById("getItemEmoji").innerText = "🙅"; document.getElementById("getItemName").innerText = "本日はスキャン済みです！"; document.getElementById("bonusBadge").style.display = "none"; document.getElementById("getBox").style.display = "block"; return; }
        if (localStorage.getItem('qr_ignore_scan_history') !== '1') scanHistory[text] = today;
        const normalItems = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 0 && isIngredientAvailable(k));
        const allItems = [...normalItems, ...Object.keys(masterSpices).filter(k => k !== "マンゴーチャツネ" && k !== "サフラン" && isIngredientAvailable(k))];
        let sum = 0; for (let i = 0; i < text.length; i++) sum += text.charCodeAt(i);
        let itemName = allItems[sum % allItems.length];
        if (itemName === "ピーマン" || text.includes("pepper") || text.includes("paprika")) {
            let low = text.toLowerCase();
            if (r > 130 && g > 130 && b < 100 || low.includes("yellow")) itemName = "黄パプリカ";
            else if (r > 130 && g < 100 || low.includes("red")) itemName = "赤パプリカ";
            else itemName = "ピーマン";
        }
        // レア食材再抽選（通常食材が当選した場合、10%でレア版に変換）
        let isRareItem = false;
        if(masterIngredients[itemName] && NORMAL_TO_RARE_MAP[itemName]) {
            if(Math.random() < 0.10) {
                itemName = NORMAL_TO_RARE_MAP[itemName];
                isRareItem = true;
            }
        }
        let lowerText = text.toLowerCase();
        let addCount = 1;
        if (lowerText.includes("curry") || lowerText.includes("spice")) {
            addCount = 3;
            document.getElementById("bonusBadge").style.display = "block";
        } else {
            document.getElementById("bonusBadge").style.display = "none";
        }
        if (isLunchtime()) { addCount *= 2; }
        inventory[itemName] = (inventory[itemName] || 0) + addCount;
        discoveredItems[itemName] = true;

        const isSpice = masterSpices[itemName]; const emoji = isSpice ? masterSpices[itemName].emoji : masterIngredients[itemName].emoji;
        document.getElementById("shopQrArea").style.display = "none";
        document.getElementById("getItemEmoji").style.display = "block";
        document.getElementById("getItemName").style.display = "block";
        const qrItemData = masterIngredients[itemName] || masterSpices[itemName];
        const qrIcon = qrItemData && qrItemData.icon;
        document.getElementById("getItemEmoji").innerHTML = qrIcon ? `<img src="${qrIcon}" style="width:64px;height:64px;object-fit:contain;">` : emoji;
        if(isRareItem) {
            // レア食材GET演出
            playSoundEffect('sound/kinpaku.mp3');
            document.getElementById("getBoxTitle").innerHTML = `<span style="color:#c8a800;font-size:18px;">✨ レア食材GET！✨</span>`;
            document.getElementById("getItemName").innerHTML = `<span style="color:#c8a800;font-weight:bold;font-size:16px;">${itemName}</span> × ${addCount}つ`;
            document.getElementById("bonusBadge").style.display = "none";
        } else {
            document.getElementById("getBoxTitle").innerText = "🎉 食材ゲット！";
            document.getElementById("getItemName").innerText = `${itemName} × ${addCount}つ`;
        }
        document.getElementById("getBox").style.display = "block";

        try { saveGame(); } catch(e) { console.error('saveGame error:', e); }
        try { onQRScanned(addCount >= 3); } catch(e) { console.error('onQRScanned error:', e); }
        if(isRareItem) {
            try {
                updateStats(s => {
                    s.gotRareItem = true;
                    if(!s.rareItemsObtained) s.rareItemsObtained = [];
                    if(!s.rareItemsObtained.includes(itemName)) s.rareItemsObtained.push(itemName);
                });
                checkAndRenderAchievements();
            } catch(e) { console.error('rareItem stats error:', e); }
        }
        if(isRareItem && database) { try { database.ref('analytics/scan/rare').transaction(n=>(n||0)+1); } catch(e){} }
        try { updateCookSelects(); } catch(e) { console.error('updateCookSelects error:', e); }
        try { updateFridgeUI(); } catch(e) { console.error('updateFridgeUI error:', e); }
        try { onItemObtainedForBingo(itemName); } catch(e) { console.error('onItemObtainedForBingo error:', e); }
        // レア食材取得時は対応する通常食材もビンゴチェック
        if(isRareItem && RARE_TO_NORMAL_MAP[itemName]) {
            try { onItemObtainedForBingo(RARE_TO_NORMAL_MAP[itemName]); } catch(e) {}
        }
    } catch(e) {
        console.error('processQRData error:', e);
        // 想定外のエラーでも最低限のフィードバックを出す
        const box = document.getElementById("getBox");
        if(box) {
            document.getElementById("getBoxTitle").innerText = "⚠️ エラー";
            const shopArea = document.getElementById("shopQrArea"); if(shopArea) shopArea.style.display = "none";
            document.getElementById("getItemEmoji").style.display = "block";
            document.getElementById("getItemName").style.display = "block";
            document.getElementById("getItemEmoji").innerText = "❓";
            document.getElementById("getItemName").innerText = "読み取りに失敗しました。もう一度お試しください。";
            document.getElementById("bonusBadge").style.display = "none";
            box.style.display = "block";
        }
    }
}
// ===== レア度ボーダースタイル =====
function applyRarityBorder(el, shop, bgColor) {
    const bg = bgColor || '#fff8ee';
    if(shop === 1) {
        // 中級：銀グラデーション
        el.style.border = '3px solid transparent';
        el.style.background = `linear-gradient(${bg},${bg}) padding-box, linear-gradient(135deg,#888,#dde,#fff,#ccc,#888) border-box`;
    } else if(shop === 2) {
        // 高級：金グラデーション
        el.style.border = '3px solid transparent';
        el.style.background = `linear-gradient(${bg},${bg}) padding-box, linear-gradient(135deg,#a07820,#ffe066,#fff8c0,#d4af37,#a07820) border-box`;
    } else if(shop < 0) {
        // 特殊（赤パプリカ・黄パプリカ・金箔）
        el.style.border = '3px solid #4b6687';
    }
}

function updateFridgeUI() {
    const ingGrid = document.getElementById("fridgeIngredientsGrid");
    const spcGrid = document.getElementById("fridgeSpicesGrid");
    ingGrid.innerHTML = ""; spcGrid.innerHTML = "";
    updateFridgeCurryStockGrid();

    const ingSort = (document.getElementById("sortIngredients") || {}).value || "default";
    // 未解放（かつ未入手）のボス解放食材は「？」マスも含めて一切表示しない
    let ingKeys = Object.keys(masterIngredients).filter(k => discoveredItems[k] || isIngredientAvailable(k));
    // 図鑑登録済みを先に、未登録を後ろに固定
    const discovered = ingKeys.filter(k => discoveredItems[k]);
    const undiscovered = ingKeys.filter(k => !discoveredItems[k]);
    if (ingSort !== "default") {
        discovered.sort((a, b) => {
            if (ingSort === "count") return (inventory[b]||0) - (inventory[a]||0);
            if (ingSort === "rarity") {
                const ra = masterIngredients[a].shop < 0 ? 99 : (masterIngredients[a].shop || 0);
                const rb = masterIngredients[b].shop < 0 ? 99 : (masterIngredients[b].shop || 0);
                return rb - ra;
            }
            return masterIngredients[b][ingSort] - masterIngredients[a][ingSort];
        });
    }
    [...discovered, ...undiscovered].forEach(name => createFridgeCard(ingGrid, name, masterIngredients[name].emoji, false));

    const spcSort = (document.getElementById("sortSpices") || {}).value || "default";
    // 未解放（かつ未入手）のコイン交換限定スパイスは「？」マスも含めて一切表示しない
    let spcKeys = Object.keys(masterSpices).filter(k => discoveredItems[k] || isIngredientAvailable(k));
    const discSpc = spcKeys.filter(k => discoveredItems[k]);
    const undiscSpc = spcKeys.filter(k => !discoveredItems[k]);
    if (spcSort === "count") {
        discSpc.sort((a, b) => (inventory[b]||0) - (inventory[a]||0));
    } else if (spcSort === "rarity") {
        discSpc.sort((a, b) => (masterSpices[b].shop || 0) - (masterSpices[a].shop || 0));
    }
    [...discSpc, ...undiscSpc].forEach(name => createFridgeCard(spcGrid, name, masterSpices[name].emoji, true));

    updateMatchCurrySelects();
}
// 食材・スパイスのロック切り替え（ロック中はランダム選択の抽選から除外される）
function toggleItemLock(name) {
    lockedItems[name] = !lockedItems[name];
    saveGame();
    // モーダルは閉じず、ボタンのアイコンだけその場で切り替える
    const lockBtn = document.getElementById('itemLockBtnInModal');
    if(lockBtn) {
        const img = lockBtn.querySelector('img');
        if(img) img.src = lockedItems[name] ? 'lock.svg' : 'unlock.svg';
    }
}

function createFridgeCard(grid, name, emoji, isSpice) {
    const count = inventory[name] || 0;
    const isDiscovered = discoveredItems[name] || false;
    const itemDiv = document.createElement("div");
    if (isDiscovered) {
        if (count === 0) itemDiv.className = "fridge-item discovered zero-count";
        else itemDiv.className = "fridge-item discovered";
        const itemData2 = isSpice ? masterSpices[name] : masterIngredients[name];
        const iconSrc = itemData2 && itemData2.icon ? itemData2.icon : null;
        const emojiDisp = iconSrc ? `<img src="${iconSrc}" style="width:40px;height:40px;object-fit:contain;display:block;margin:0 auto;">` : `<span style="font-size:28px;">${emoji}</span>`;
        itemDiv.innerHTML = `<div class="fridge-emoji">${emojiDisp}</div><div>${name}</div><div>${count}個</div>`;
        // レア度ボーダー（食材・スパイス共通）
        if(itemData2) {
            const bg = count === 0 ? '#ede0c4' : '#fff8ee';
            applyRarityBorder(itemDiv, itemData2.shop, bg);
        }
        itemDiv.onclick = function() {
            const data = isSpice ? masterSpices[name] : masterIngredients[name];
            let info = isSpice ? `<br><span style="color:#e67e22; font-weight:bold;">📈 効果: ${data.mul === "hp" ? "HP" : data.mul === "atk" ? "攻撃" : data.mul === "def" ? "防御" : "素早さ"} ${data.val}倍！</span>` : `<br><span style="color:#2ecc71; font-weight:bold;">📊 HP:+${data.hp}/ATK:+${data.atk}/DEF:+${data.def}/SPD:+${data.spd}</span>`;
            const itemDataM = isSpice ? masterSpices[name] : masterIngredients[name];
            const iconM = itemDataM && itemDataM.icon ? `<img src="${itemDataM.icon}" style="width:80px;height:80px;object-fit:contain;display:block;margin:0 auto 8px;">` : '';
            const shop = itemDataM ? (itemDataM.shop || 0) : 0;
            const rarityMap = {
                0:  { label: 'ノーマル', color: '#888' },
                1:  { label: '中級',     color: '#a0a0a0' },
                2:  { label: '高級',     color: '#c8a800' },
            };
            const rarity = shop < 0
                ? `<span style="font-size:11px;color:#4b6687;font-weight:bold;">特殊</span>`
                : `<span style="font-size:11px;color:${(rarityMap[shop]||rarityMap[0]).color};font-weight:bold;">${(rarityMap[shop]||rarityMap[0]).label}</span>`;
            const isLocked = !!lockedItems[name];
            const lockBtnHtml = `<button class="item-lock-btn" id="itemLockBtnInModal" title="ロック切り替え"><img src="${isLocked ? 'lock.svg' : 'unlock.svg'}" alt=""></button>`;
            showCustomAlert(
                `${lockBtnHtml}${iconM}${name}<br>${rarity}`, 
                `${data.desc}<br><br><b>現在の所持数: <span style="color:#e74c3c;font-size:16px;">${count}</span> 個</b>${info}`, 
                null, sellItemAction, name
            );
            setTimeout(() => {
                const lockBtn = document.getElementById('itemLockBtnInModal');
                if(lockBtn) lockBtn.onclick = function(e) { e.stopPropagation(); toggleItemLock(name); };
            }, 0);
        };
    } else {
        itemDiv.className = "fridge-item";
        itemDiv.innerHTML = `<div class="fridge-emoji" style="font-size:28px;color:#c9b090;">？</div><div>？？？</div><div>0個</div>`;
    }
    grid.appendChild(itemDiv);
}
// カレーの特殊効果ごとの技名・説明文
const CURRY_SKILL_INFO = [
    { flag: 'isPoison',      name: '☠️ 毒化',         desc: '戦闘開始時に相手を毒状態にする。' },
    { flag: 'isIllusion',    name: '🌀 幻惑化',       desc: '戦闘開始時に敵を幻惑状態にする。' },
    { flag: 'isSeed',        name: '🌱 種連続発射',   desc: '40％の攻撃を複数回連続で行う。' },
    { flag: 'isMargherita',  name: '🍅 マルゲリータ', desc: '調理完成時に全ステ小UP。戦闘時は素敵な音楽が聞こえる。' },
    { flag: 'isTonTonTon',   name: '🐷 3匹のわんぱく兄弟', desc: '攻撃時にブー。さらに通常攻撃の上下の振り幅が大きくなり、ミスをすることも。' },
    { flag: 'isSeafood',     name: '🌊 海鮮',         desc: '波の音が聞こえる。そして癒される。' },
    { flag: 'hasGold',       name: '✨ 金箔',         desc: '調理完成時に全ステータスが強化。攻撃時に金が舞う。' },
    { flag: 'isWanpaku',     name: '🍛 わんぱく',     desc: '通常攻撃の上下の振り幅が大きくなり、ミスをすることも。' },
    { flag: 'isRatatouille', name: '☀️ ラタトゥイユ', desc: '毎ターン小回復。肉からの攻撃を小軽減' },
    { flag: 'isHomerun',     name: '🏏 ホームラン',   desc: '敵の技を打ち返して防ぐことがある。' },
    { flag: 'isPoisonApple', name: '🍎☠️ 毒りんご',  desc: '通常攻撃時50%で相手を毒状態にする。既に毒の相手には毒ダメージを増幅する。' },
    { flag: 'isFluffyOmelette', name: '🥚 ふわとろオム', desc: 'ランダムで選ばれたいずれかの系統からの攻撃を70%に軽減する。' },
    { flag: 'isGreenCurry',  name: '🟢 激辛グリーン', desc: '時々全ての敵に強力な一撃。反動で自分もダメージを受ける。' },
    { flag: 'isTriCaviar',  name: '👑 世界三大珍味', desc: 'ランダムで選ばれたいずれかの系統からの攻撃を70%に軽減する。さらに戦闘開始時の幻惑・毒を無効化する。' }
];
function getCurrySkills(curry) {
    return CURRY_SKILL_INFO.filter(s => {
        if(s.flag === 'isPoison' && curry.isPoisonApple) return false; // 毒りんごの場合は専用説明だけ表示し「毒化」は重複表示しない
        return curry[s.flag];
    });
}

function updateFridgeCurryStockGrid() {
    const grid = document.getElementById("fridgeCurryStockGrid");
    if(!grid) return;
    grid.innerHTML = "";
    if(!curryStock || curryStock.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#9a7a50;font-size:12px;padding:10px;">ストックカレーがありません。</div>';
        return;
    }
    curryStock.forEach((curry, idx) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "fridge-item discovered" + (curry.isDelivering ? " delivering" : "");
        const typeImg = getCurryImage(curry);
        const deliveringLabel = curry.isDelivering ? '<div class="delivering-label">Delivering...</div>' : '';
        itemDiv.innerHTML = `<div class="fridge-emoji"><img src="${typeImg}" style="width:40px;height:40px;object-fit:contain;display:block;margin:0 auto;"></div><div style="font-size:11px;line-height:1.3;">${curry.name}</div>${deliveringLabel}`;
        itemDiv.onclick = function() {
            const typeLabel = CURRY_TYPE_LABELS[curry.curryType] || 'バランス型';
            const iconsHtml = curryIconsHTML(curry.materials, curry.spice, '24px');
            const skills = getCurrySkills(curry);
            let skillsHtml = '';
            if(skills.length > 0) {
                skillsHtml = skills.map(s => `<div style="margin-top:8px;"><b style="color:#e67e22;">${s.name}</b><br><span style="font-size:12px;">${s.desc}</span></div>`).join('');
            }
            const deliveringNote = curry.isDelivering
                ? `<div style="margin-top:10px;padding:8px;background:#d4e8e0;border-radius:4px;font-size:12px;color:#2e8b6f;font-weight:bold;">🚚 現在宅配中です。対戦には使用できません。</div>`
                : '';
            const html = `<img src="${typeImg}" style="width:90px;height:90px;object-fit:contain;display:block;margin:0 auto 10px;">`
                + `<div style="font-weight:bold;color:#c0392b;margin-bottom:4px;">${typeLabel}</div>`
                + `<div style="display:flex;justify-content:center;gap:4px;margin-bottom:8px;">${iconsHtml}</div>`
                + `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px;font-weight:bold;color:#420000;margin-bottom:6px;">`
                + `<div>HP: ${statDisplayWithTableware('hp', curry.hp)}</div><div>ATK: ${statDisplayWithTableware('atk', curry.atk)}</div><div>DEF: ${statDisplayWithTableware('def', curry.def)}</div><div>SPD: ${statDisplayWithTableware('spd', curry.spd)}</div>`
                + `</div>`
                + skillsHtml
                + deliveringNote;
            showStockCurryDetail(curry.name, html, idx);
        };
        grid.appendChild(itemDiv);
    });
}

function showStockCurryDetail(title, message, idx) {
    document.getElementById("customModal").style.display = "none";
    document.getElementById("modalTitle").innerHTML = title;
    document.getElementById("modalMessage").innerHTML = message;
    const btnGroup = document.getElementById("modalBtnGroup");
    btnGroup.innerHTML = "";
    if(curryStock[idx] && !curryStock[idx].isDelivering) {
        const deliverBtn = document.createElement("button");
        deliverBtn.className = "modal-btn";
        deliverBtn.style.background = "#2e8b6f"; deliverBtn.style.color = "#fff";
        deliverBtn.innerText = `🚚 宅配カレーに設定`;
        deliverBtn.onclick = function() {
            document.getElementById("customModal").style.display = "none";
            confirmSetDeliveryCurry(idx);
        };
        btnGroup.appendChild(deliverBtn);

        const sellBtn = document.createElement("button");
        sellBtn.className = "modal-btn modal-btn-sell";
        sellBtn.innerText = `💸 売却 (+${STOCK_CURRY_SELL_PRICE}G)`;
        sellBtn.onclick = function() {
            document.getElementById("customModal").style.display = "none";
            sellStockCurry(idx);
        };
        btnGroup.appendChild(sellBtn);
    }
    const okBtn = document.createElement("button");
    okBtn.className = "modal-btn modal-btn-ok";
    okBtn.innerText = "閉じる";
    okBtn.onclick = function() { document.getElementById("customModal").style.display = "none"; };
    btnGroup.appendChild(okBtn);
    document.getElementById("customModal").style.display = "flex";
}

function confirmSetDeliveryCurry(idx) {
    if(!curryStock[idx]) return;
    const existingIdx = curryStock.findIndex(c => c.isDelivering);
    let msg = `「${curryStock[idx].name}」を宅配カレーに設定します。<br>設定すると、このカレーは対戦で使用できなくなります。<br>`;
    if(existingIdx !== -1 && existingIdx !== idx) {
        msg += `<br><span style="color:#e74c3c;font-weight:bold;">既に配達中の宅配カレー「${curryStock[existingIdx].name}」は消滅し、戻ってきません。</span><br>`;
    }
    msg += `<br>設定してよろしいですか？`;
    showCustomConfirm("🚚 宅配カレー設定", msg, function() {
        // 既に配達中だったカレーは戻らず完全に消滅する（先にindexを確定させてから削除）
        const oldDeliveringIdx = curryStock.findIndex(c => c.isDelivering);
        const newDeliveryCurryRef = curryStock[idx];
        if(oldDeliveringIdx !== -1 && oldDeliveringIdx !== idx) {
            curryStock.splice(oldDeliveringIdx, 1);
        }
        // 削除によってindexがずれる可能性があるため、参照で現在のindexを再特定
        const finalIdx = curryStock.indexOf(newDeliveryCurryRef);
        curryStock[finalIdx].isDelivering = true;
        publishDeliveryCurryToCloud(curryStock[finalIdx]);
        if(selectedCurryIndex === idx || (curryStock[selectedCurryIndex] && curryStock[selectedCurryIndex].isDelivering)) {
            selectedCurryIndex = curryStock.findIndex(c => !c.isDelivering);
        }
        saveGame(); updateFridgeUI(); updateCookSelects(); updateMatchCurrySelects();
        showCustomAlert("✅ 設定完了", `「${newDeliveryCurryRef.name}」を宅配カレーに設定しました。`);
    });
}

const STOCK_CURRY_SELL_PRICE = 50;
function sellStockCurry(idx) {
    if(!curryStock[idx]) return;
    curryStock.splice(idx, 1);
    if(selectedCurryIndex >= curryStock.length) selectedCurryIndex = curryStock.length - 1;
    playerG += STOCK_CURRY_SELL_PRICE;
    playTone(880, 'sine', 0.1);
    saveGame(); updateFridgeUI(); updateCookSelects(); updateMatchCurrySelects();
}

const sellPrices = { "金箔": 150, "赤パプリカ": 50, "黄パプリカ": 50 };
function getSellPrice(name) { return sellPrices[name] || 15; }
function sellItemAction(name) {
    if ((inventory[name] || 0) <= 0) return;
    inventory[name]--;
    const price = getSellPrice(name);
    playerG += price;
    playTone(880, 'sine', 0.1);
    saveGame(); updateFridgeUI(); updateCookSelects();
    showCustomAlert("💸 売却完了", `${name}を1個売却し、<span style="color:#2ecc71;">${price} G</span> を手に入れました！`, null, sellItemAction, name);
}
function refreshRecipeBookUI() {
    const area = document.getElementById("recipeBookArea");
    const keys = Object.keys(recipeBook);
    if(keys.length === 0) { area.innerHTML = "<div style='color:#7f8c8d; text-align:center;'>まだ履歴がありません。</div>"; updateFavRecipeSelect(); return; }

    // ソート選択UIを保存値に合わせる
    const sortSel = document.getElementById('sortRecipes');
    if(sortSel) sortSel.value = getRecipeSortOrder();

    area.innerHTML = "";
    getSortedRecipeKeys().forEach(k => {
        const r = recipeBook[k];
        const isFav = !!(r.fav);
        const row = document.createElement("div");
        row.className = "recipe-row";
        row.style.cssText = "display:flex; justify-content:space-between; align-items:center;";
        const spicePart = r.spice ? ` + 🌶️${r.spice}` : '';
        row.innerHTML = `
            <div style="flex:1; min-width:0;">
                <span>${curryIconsHTML(r.materials, r.spice, '20px') || r.visual}</span> <strong style="font-size:12px;">${r.name}</strong>
                <div style='font-size:10px; color:#7f8c8d;'>🧪:${r.materials.join('+')}${spicePart}</div>
            </div>
            <button class="recipe-star ${isFav ? 'active' : 'inactive'}" onclick="toggleFavRecipe('${k}')">${isFav ? '⭐' : '☆'}</button>`;
        area.appendChild(row);
    });
    updateFavRecipeSelect();
}

// ===== レシピソート =====
function getRecipeSortOrder() {
    return localStorage.getItem('qr_recipe_sort') || 'newest';
}

function onRecipeSortChange() {
    const sel = document.getElementById('sortRecipes');
    if(sel) localStorage.setItem('qr_recipe_sort', sel.value);
    refreshRecipeBookUI();
}

function getSortedRecipeKeys() {
    const keys = Object.keys(recipeBook); // 追加順（古い順）
    const sort = getRecipeSortOrder();
    if(sort === 'oldest') {
        return [...keys];
    } else if(sort === 'fav_newest') {
        return [...keys].sort((a, b) => {
            const favDiff = (recipeBook[b].fav ? 1 : 0) - (recipeBook[a].fav ? 1 : 0);
            if(favDiff !== 0) return favDiff;
            return keys.indexOf(b) - keys.indexOf(a); // 同グループ内は新しい順
        });
    } else if(sort === 'fav_oldest') {
        return [...keys].sort((a, b) => {
            const favDiff = (recipeBook[b].fav ? 1 : 0) - (recipeBook[a].fav ? 1 : 0);
            if(favDiff !== 0) return favDiff;
            return keys.indexOf(a) - keys.indexOf(b); // 同グループ内は古い順
        });
    } else {
        return [...keys].reverse(); // newest（デフォルト）
    }
}

function registerLastCookedAsFavorite() {
    const key = window.__lastCookedRecipeKey;
    if(!key || !recipeBook[key]) { showCustomAlert("⚠️ エラー", "対象のレシピが見つかりません。"); return; }
    if(recipeBook[key].fav) { showCustomAlert("⭐ お気に入り済み", "このレシピはすでにお気に入りに登録されています。"); return; }
    const favKeys = Object.keys(recipeBook).filter(k => recipeBook[k].fav);
    if(favKeys.length < 10) {
        recipeBook[key].fav = true;
        saveGame(); refreshRecipeBookUI();
        showCustomAlert("⭐ お気に入り登録完了", `「${recipeBook[key].name}」をお気に入りに登録しました！`);
        return;
    }
    // 10個すでに登録済み → 解除候補を選ばせる
    const options = favKeys.map(k => {
        const r = recipeBook[k];
        return `<option value="${k}">${r.name}</option>`;
    }).join('');
    const msg = `<div style="font-size:13px;color:#420000;margin-bottom:10px;">お気に入りは最大10個までです。<br>1つお気に入りを解除してください。</div>
        <select id="favReplaceSelect" style="width:100%;padding:8px;border:1px solid #b88742;border-radius:4px;background:#f5e9c8;color:#420000;font-size:16px;">
            <option value="">解除しない（登録しない）</option>
            ${options}
        </select>`;
    showCustomConfirm("⭐ お気に入り上限", msg, function() {
        const sel = document.getElementById("favReplaceSelect");
        const removeKey = sel ? sel.value : "";
        if(!removeKey) { return; } // 解除しない場合は何もしない
        recipeBook[removeKey].fav = false;
        recipeBook[key].fav = true;
        saveGame(); refreshRecipeBookUI();
        showCustomAlert("⭐ お気に入り更新完了", `「${recipeBook[removeKey].name}」を解除し、「${recipeBook[key].name}」を登録しました！`);
    });
}

function toggleFavRecipe(key) {
    if(!recipeBook[key]) return;
    const isFav = !!(recipeBook[key].fav);
    if(!isFav) {
        // お気に入り追加：上限10個チェック
        const favCount = Object.values(recipeBook).filter(r => r.fav).length;
        if(favCount >= 10) { showCustomAlert("⭐ お気に入り上限", "お気に入りは最大10個までです。先に他のお気に入りを解除してください。"); return; }
        recipeBook[key].fav = true;
    } else {
        recipeBook[key].fav = false;
    }
    saveGame(); refreshRecipeBookUI();
}

function updateFavRecipeSelect() {
    const sel = document.getElementById("favRecipeSelect");
    const area = document.getElementById("favRecipeArea");
    if(!sel) return;
    const allKeys = Object.keys(recipeBook); // 追加順（古い順）
    const favKeys = allKeys.filter(k => recipeBook[k].fav);
    if(favKeys.length === 0) { area.style.display = "none"; return; }
    area.style.display = "block";
    sel.innerHTML = '<option value="">⭐ お気に入りレシピから選択...</option>';

    // ソート設定に合わせてお気に入りを並べる（⭐系は全てfavなので新旧順のみ適用）
    const sort = getRecipeSortOrder();
    const sortedFavKeys = sort === 'oldest' || sort === 'fav_oldest'
        ? favKeys                    // 古い順
        : [...favKeys].reverse();    // 最新順（デフォルト・⭐最新順）

    sortedFavKeys.forEach(k => {
        const r = recipeBook[k];
        const opt = document.createElement("option");
        opt.value = k; opt.innerText = r.name;
        sel.appendChild(opt);
    });
}

function applyFavRecipe(key) {
    if(!key || !recipeBook[key]) return;
    const r = recipeBook[key];
    // materials = [食材1, 食材2, 食材3, スパイス] の順で保存されているが
    // keyが "食材+食材+スパイス" 形式なので materials から復元
    const mats = r.materials || [];
    // spiceプロパティ優先、なければmaterialsからmasterSpicesで検索
    const spiceName = r.spice || mats.find(m => masterSpices[m]);
    const ings = mats.filter(m => masterIngredients[m]);
    // 在庫チェック
    let missing = [];
    const needed = {};
    [...ings, ...(spiceName ? [spiceName] : [])].forEach(m => { needed[m] = (needed[m]||0)+1; });
    Object.keys(needed).forEach(m => { if((inventory[m]||0) < needed[m]) missing.push(m); });
    if(missing.length > 0) {
        showCustomAlert("⚠️ 在庫不足", `以下のアイテムが足りません：<br><b>${missing.join('、')}</b>`);
        document.getElementById("favRecipeSelect").value = "";
        return;
    }
    // ロック中の食材が含まれているか確認
    const lockedInRecipe = [...ings, ...(spiceName ? [spiceName] : [])].filter(m => lockedItems[m]);
    if(lockedInRecipe.length > 0) {
        showCustomConfirm(
            "🔒 ロック食材が含まれています",
            `「${lockedInRecipe.join('、')}」はロックされている食材ですが、使用しますか？<br><br>「確定する」=使用する　「キャンセル」=使用しない（❌になります）`,
            function() {
                finalizeFavRecipeApply(ings, spiceName, false);
                showCustomAlert("✅ 適用完了", "ロック食材もセットされました。");
            },
            function() {
                finalizeFavRecipeApply(ings, spiceName, true);
                showCustomAlert("✅ 適用完了", "ロック食材の代わりに❌（なし）にしました。");
            }
        );
        document.getElementById("favRecipeSelect").value = "";
        return;
    }
    finalizeFavRecipeApply(ings, spiceName, false);
    document.getElementById("favRecipeSelect").value = "";
}

// お気に入りレシピをプルダウンに反映する（excludeLockedがtrueの場合、ロック食材は空欄にする）
function finalizeFavRecipeApply(ings, spiceName, excludeLocked) {
    const ingIds = ["ingredient1","ingredient2","ingredient3"];
    ingIds.forEach((id,i) => {
        const m = ings[i] || "";
        const useVal = (excludeLocked && lockedItems[m]) ? "" : m;
        document.getElementById(id).value = useVal;
        updateIngredientHint(i+1);
    });
    const spiceUseVal = (excludeLocked && spiceName && lockedItems[spiceName]) ? "" : (spiceName || "");
    document.getElementById("spice").value = spiceUseVal;
    updateSpiceHint();
    syncCookSelectionFromHiddenSelects();
}

function pruneRecipeBook() {
    // お気に入り以外が20件を超えたら古いものから削除
    const favKeys = Object.keys(recipeBook).filter(k => recipeBook[k].fav);
    const normalKeys = Object.keys(recipeBook).filter(k => !recipeBook[k].fav);
    const MAX = 20;
    if(normalKeys.length > MAX) {
        // 古い順に削除（配列先頭が古い）
        normalKeys.slice(0, normalKeys.length - MAX).forEach(k => delete recipeBook[k]);
    }
}
function updateCookSelects() {
    ["ingredient1", "ingredient2", "ingredient3"].forEach(id => {
        const sel = document.getElementById(id); sel.innerHTML = "<option value=''>❌ （なし）</option>";
        Object.keys(masterIngredients).forEach(n => { if((inventory[n]||0)>0){ const o=document.createElement("option"); o.value=n; o.text=`${n} (所持数: ${inventory[n]}個)`; sel.appendChild(o); } });
    });
    const spSel = document.getElementById("spice"); spSel.innerHTML = "<option value=''>❌ （なし）</option>";
    Object.keys(masterSpices).forEach(n => { if((inventory[n]||0)>0){ const o=document.createElement("option"); o.value=n; o.text=`${n} (所持数: ${inventory[n]}個)`; spSel.appendChild(o); } });
    renderCookPickerUI();
}

// ===== 食材タップ選択UI（カテゴリタブ＋アイコングリッド） =====
let cookSelectedIngredients = []; // 最大3つ、文字列配列（重複可）
let cookSelectedSpice = "";
let cookActiveCategoryIdx = 0;
const COOK_CATEGORY_DEFS = [
    { key: "meat",      img: "baseui/cookfoods-01.png" },
    { key: "vegetable", img: "baseui/cookfoods-02.png" },
    { key: "seafood",   img: "baseui/cookfoods-03.png" },
    { key: "fruit",     img: "baseui/cookfoods-04.png" },
    { key: "other",     img: "baseui/cookfoods-05.png" }
];
const COOK_CATEGORY_LABEL_JA = { meat: '肉系', vegetable: '野菜系', seafood: '海鮮系', fruit: '果実系', other: 'その他' };
function getCookIngSortOrder() {
    return localStorage.getItem('qr_cook_ing_sort') || 'default';
}
function getCookCategoryItems(catKey) {
    let items = Object.keys(masterIngredients).filter(n => {
        if((inventory[n]||0) <= 0) return false;
        const cat = getIngredientCategory(n);
        return catKey === "other" ? !cat : cat === catKey;
    });
    const sort = getCookIngSortOrder();
    if(sort === 'hp')    items.sort((a,b) => masterIngredients[b].hp  - masterIngredients[a].hp);
    else if(sort === 'atk') items.sort((a,b) => masterIngredients[b].atk - masterIngredients[a].atk);
    else if(sort === 'def') items.sort((a,b) => masterIngredients[b].def - masterIngredients[a].def);
    else if(sort === 'spd') items.sort((a,b) => masterIngredients[b].spd - masterIngredients[a].spd);
    else if(sort === 'count') items.sort((a,b) => (inventory[b]||0) - (inventory[a]||0));
    else if(sort === 'rarity') items.sort((a,b) => {
        const ra = masterIngredients[a].shop < 0 ? 99 : (masterIngredients[a].shop || 0);
        const rb = masterIngredients[b].shop < 0 ? 99 : (masterIngredients[b].shop || 0);
        return rb - ra;
    });
    return items;
}
function renderCookPickerUI() {
    renderCookSelectedSlots();
    renderCookCategoryTabs();
    renderCookCategoryPanels();
    renderCookSpicePanel();
}
function renderCookSelectedSlots() {
    const wrap = document.getElementById("cookSelectedSlots");
    if(!wrap) return;
    wrap.innerHTML = "";
    for(let i = 0; i < 3; i++) {
        const name = cookSelectedIngredients[i];
        const box = document.createElement("div");
        box.style.cssText = "flex:1; min-height:96px; border:1px dashed #b88742; border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4px; cursor:pointer; background:#fffdf0;";
        if(name) {
            const d = masterIngredients[name];
            if(d && d.shop !== 0) {
                applyRarityBorder(box, d.shop, '#fffdf0');
            } else {
                box.style.border = "1px solid #b88742";
            }
            const statLine = d ? `<div style="font-size:11px;color:#5a3a1a;font-weight:bold;line-height:1.4;margin-top:2px;">HP+${d.hp} ATK+${d.atk}<br>DEF+${d.def} SPD+${d.spd}</div>` : '';
            box.innerHTML = (d && d.icon ? `<img src="${d.icon}" style="width:26px;height:26px;object-fit:contain;">` : '') + `<div style="font-size:10px;color:#420000;margin-top:1px;text-align:center;">${name}</div>` + statLine;
            box.onclick = () => { cookSelectedIngredients.splice(i,1); syncCookSelectionToHiddenSelects(); renderCookPickerUI(); };
        } else {
            box.innerHTML = `<div style="font-size:22px;color:#cbb088;">＋</div>`;
        }
        wrap.appendChild(box);
    }
}
function renderCookCategoryTabs() {
    const wrap = document.getElementById("ingredientCategoryTabs");
    if(!wrap) return;
    wrap.innerHTML = "";
    COOK_CATEGORY_DEFS.forEach((c, idx) => {
        const btn = document.createElement("button");
        const active = idx === cookActiveCategoryIdx;
        btn.style.cssText = `flex:1; height:32px; border:none; background:none; cursor:pointer; padding:0; min-width:0; overflow:hidden; opacity:${active?'1':'0.45'};`;
        btn.innerHTML = `<img src="${c.img}" style="width:100%; height:32px; object-fit:cover; display:block;">`;
        btn.onclick = () => { cookActiveCategoryIdx = idx; renderCookCategoryPanels(); renderCookCategoryTabs(); };
        wrap.appendChild(btn);
    });
    // ソート選択を保存値に合わせる
    const sortSel = document.getElementById('cookIngSort');
    if(sortSel) sortSel.value = getCookIngSortOrder();
}

function onCookIngSortChange() {
    const sel = document.getElementById('cookIngSort');
    if(sel) localStorage.setItem('qr_cook_ing_sort', sel.value);
    renderCookCategoryPanels();
}
function renderCookCategoryPanels() {
    const track = document.getElementById("ingredientCategoryPanels");
    if(!track) return;
    track.innerHTML = "";
    track.style.transform = `translateX(-${cookActiveCategoryIdx * 100}%)`;
    COOK_CATEGORY_DEFS.forEach(c => {
        const panel = document.createElement("div");
        panel.style.cssText = "flex:0 0 100%; max-height:280px; overflow-y:auto; padding:8px; box-sizing:border-box;";
        const items = getCookCategoryItems(c.key);
        if(items.length === 0) {
            const label = COOK_CATEGORY_LABEL_JA[c.key] || '';
            panel.innerHTML = `<div style="text-align:center;color:#b0a090;font-size:12px;padding:20px 0;">所持している${label}食材はありません</div>`;
        } else {
            const grid = document.createElement("div");
            grid.style.cssText = "display:grid; grid-template-columns:repeat(3,1fr); gap:8px;";
            items.forEach(name => {
                const d = masterIngredients[name];
                const have = inventory[name] || 0;
                const usedCount = cookSelectedIngredients.filter(x => x === name).length;
                const isFull = cookSelectedIngredients.length >= 3;
                const isOverLimit = usedCount >= have;
                const disabled = isOverLimit; // 所持数を超えた場合のみdisabled（フルでも押せる）
                const cell = document.createElement("div");
                cell.style.cssText = `text-align:center; padding:6px 2px; border-radius:6px; border:1px solid ${disabled?'#e0d0b0':'#b88742'}; background:${disabled?'#ece2cc':'#fff'}; opacity:${disabled?'0.5':'1'}; cursor:${disabled?'default':'pointer'};`;
                cell.innerHTML = (d && d.icon ? `<img src="${d.icon}" style="width:32px;height:32px;object-fit:contain;">` : '<div style="font-size:24px;">🍴</div>')
                    + `<div style="font-size:10px;color:#420000;margin-top:2px;">${name}</div>`
                    + `<div style="font-size:10px;color:#888;">所持:${have - usedCount}</div>`
                    + `<div style="font-size:10px;color:#aaa;">${d.hp}/${d.atk}/${d.def}/${d.spd}</div>`;
                // レア度ボーダー
                if(!disabled && d && d.shop !== 0) applyRarityBorder(cell, d.shop, '#fff');
                if(!disabled) cell.onclick = () => {
                    if(isFull) {
                        cookSelectedIngredients[2] = name; // 3つ目と入れ替え
                    } else {
                        cookSelectedIngredients.push(name);
                    }
                    syncCookSelectionToHiddenSelects(); renderCookPickerUI();
                };
                grid.appendChild(cell);
            });
            panel.appendChild(grid);
        }
        track.appendChild(panel);
    });
}
// スパイスの効果テキストを生成（サフラン等の2重効果スパイスにも対応）
function formatSpiceEffectText(d) {
    if(!d) return '';
    const statLabel = m => m === "hp" ? "HP" : m === "atk" ? "ATK" : m === "def" ? "DEF" : "SPD";
    let text = `${statLabel(d.mul)} ${d.val}倍`;
    if(d.mul2) text += ` / ${statLabel(d.mul2)} ${d.val2}倍`;
    return text;
}
function renderCookSpicePanel() {
    const slotWrap = document.getElementById("cookSelectedSpiceSlot");
    const panel = document.getElementById("spiceCategoryPanel");
    if(!slotWrap || !panel) return;
    slotWrap.innerHTML = "";
    const slotBox = document.createElement("div");
    slotBox.style.cssText = "flex:0 0 120px; min-height:80px; border:1px dashed #b88742; border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4px; cursor:pointer; background:#fffdf0;";
    if(cookSelectedSpice) {
        const d = masterSpices[cookSelectedSpice];
        if(d && d.shop !== 0) {
            applyRarityBorder(slotBox, d.shop, '#fffdf0');
        } else {
            slotBox.style.border = "1px solid #b88742";
        }
        const statLine = d ? `<div style="font-size:11px;color:#5a3a1a;font-weight:bold;margin-top:2px;">${formatSpiceEffectText(d)}</div>` : '';
        slotBox.innerHTML = (d && d.icon ? `<img src="${d.icon}" style="width:26px;height:26px;object-fit:contain;">` : '') + `<div style="font-size:10px;color:#420000;margin-top:1px;">${cookSelectedSpice}</div>` + statLine;
        slotBox.onclick = () => { cookSelectedSpice = ""; syncCookSelectionToHiddenSelects(); renderCookPickerUI(); };
    } else {
        slotBox.innerHTML = `<div style="font-size:20px;color:#cbb088;">＋</div>`;
    }
    slotWrap.appendChild(slotBox);

    panel.innerHTML = "";
    const spiceNames = Object.keys(masterSpices).filter(n => (inventory[n]||0) > 0);
    if(spiceNames.length === 0) {
        panel.innerHTML = `<div style="text-align:center;color:#b0a090;font-size:12px;padding:10px 0;">所持しているスパイスがありません</div>`;
        return;
    }
    const grid = document.createElement("div");
    grid.style.cssText = "display:grid; grid-template-columns:repeat(4,1fr); gap:8px; max-height:200px; overflow-y:auto;";
    spiceNames.forEach(name => {
        const d = masterSpices[name];
        const have = inventory[name] || 0;
        const isSelected = cookSelectedSpice === name;
        const cell = document.createElement("div");
        cell.style.cssText = `text-align:center; padding:6px 2px; border-radius:6px; border:${isSelected?'2px':'1px'} solid ${isSelected?'#420000':'#b88742'}; background:${isSelected?'#f5e9c8':'#fff'}; cursor:pointer;`;
        cell.innerHTML = (d && d.icon ? `<img src="${d.icon}" style="width:32px;height:32px;object-fit:contain;">` : '<div style="font-size:24px;">🧂</div>')
            + `<div style="font-size:10px;color:#420000;margin-top:2px;">${name}</div>`
            + `<div style="font-size:10px;color:#888;">所持:${have}</div>`
            + `<div style="font-size:10px;color:#aaa;">${formatSpiceEffectText(d)}</div>`;
        cell.onclick = () => { cookSelectedSpice = name; syncCookSelectionToHiddenSelects(); renderCookPickerUI(); };
        if(d && d.shop) applyRarityBorder(cell, d.shop, isSelected ? '#f5e9c8' : '#fff');
        grid.appendChild(cell);
    });
    panel.appendChild(grid);
}
// 新UIの選択結果を、既存ロジックが参照する隠しselectに反映する（互換性維持のため）
function syncCookSelectionToHiddenSelects() {
    [0,1,2].forEach(i => {
        const sel = document.getElementById("ingredient" + (i+1));
        if(sel) { sel.value = cookSelectedIngredients[i] || ""; }
    });
    const spSel = document.getElementById("spice");
    if(spSel) spSel.value = cookSelectedSpice || "";
    [1,2,3].forEach(n => updateIngredientHint(n));
    updateSpiceHint();
}
// クリアボタン
function clearCookSelection() {
    cookSelectedIngredients = [];
    cookSelectedSpice = "";
    syncCookSelectionToHiddenSelects();
    renderCookPickerUI();
}
// カテゴリパネルの横フリック対応
function setupCookCategorySwipe() {
    const wrap = document.getElementById("ingredientCategoryPanelsWrap");
    if(!wrap || wrap.dataset.swipeBound) return;
    wrap.dataset.swipeBound = "1";
    let startX = 0, startY = 0, swiping = false;
    wrap.addEventListener("touchstart", e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; swiping = true; }, { passive: true });
    wrap.addEventListener("touchend", e => {
        if(!swiping) return; swiping = false;
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if(Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
            if(dx < 0 && cookActiveCategoryIdx < COOK_CATEGORY_DEFS.length - 1) cookActiveCategoryIdx++;
            else if(dx > 0 && cookActiveCategoryIdx > 0) cookActiveCategoryIdx--;
            renderCookCategoryPanels(); renderCookCategoryTabs();
        }
    }, { passive: true });
}

function updateIngredientHint(num) {
    const val = document.getElementById("ingredient" + num).value;
    const el = document.getElementById("statHint" + num);
    if (el) {
        if (!val || !masterIngredients[val]) { el.innerText = ""; }
        else { const d = masterIngredients[val]; el.innerText = `HP+${d.hp} / ATK+${d.atk} / DEF+${d.def} / SPD+${d.spd}`; }
    }
    updateCookPreview();
}
function updateSpiceHint() {
    const val = document.getElementById("spice").value;
    const el = document.getElementById("statHintSpice");
    if (el) {
        if (!val || !masterSpices[val]) { el.innerText = ""; }
        else { const d = masterSpices[val]; el.innerText = formatSpiceEffectText(d); }
    }
    updateCookPreview();
}
function clearAllHints() {
    [1,2,3].forEach(n => { const el = document.getElementById("statHint"+n); if(el) el.innerText=""; });
    const es = document.getElementById("statHintSpice"); if(es) es.innerText="";
    cookSelectedIngredients = [];
    cookSelectedSpice = "";
    updateCookPreview();
}

function updateCookPreview() {
    // 食材・スパイス設定が変わったら前回の調理結果を非表示にする
    const prevResultBox = document.getElementById("resultBox");
    if(prevResultBox && prevResultBox.style.display !== "none") {
        prevResultBox.style.display = "none";
    }
    const i1 = document.getElementById("ingredient1").value;
    const i2 = document.getElementById("ingredient2").value;
    const i3 = document.getElementById("ingredient3").value;
    const sp = document.getElementById("spice").value;
    const fixedPanel = document.getElementById("cookStatFixed");
    const guideChar = document.getElementById("questGuideChar");
    if(!i1 && !i2 && !i3 && !sp) {
        // 何もセットされていない → 固定パネル非表示・案内人復帰
        if(fixedPanel) fixedPanel.style.display = "none";
        if(guideChar && guideChar.dataset.hiddenByCook === '1') {
            guideChar.dataset.hiddenByCook = '0';
            guideChar.style.display = guideChar.dataset.prevDisplay || '';
        }
        return;
    }
    let hp=0, atk=0, def=0, spd=0;
    [i1,i2,i3].forEach(name => {
        const d = masterIngredients[name];
        if(d) { hp+=d.hp; atk+=d.atk; def+=d.def; spd+=d.spd; }
    });
    if(sp && masterSpices[sp]) {
        const sd = masterSpices[sp];
        if(sd.mul === "hp") hp = Math.round(hp * sd.val);
        else if(sd.mul === "atk") atk = Math.round(atk * sd.val);
        else if(sd.mul === "def") def = Math.round(def * sd.val);
        else if(sd.mul === "spd") spd = Math.round(spd * sd.val);
        if(sd.mul2) {
            if(sd.mul2 === "hp") hp = Math.round(hp * sd.val2);
            else if(sd.mul2 === "atk") atk = Math.round(atk * sd.val2);
            else if(sd.mul2 === "def") def = Math.round(def * sd.val2);
            else if(sd.mul2 === "spd") spd = Math.round(spd * sd.val2);
        }
    }
    // 固定パネルを更新・表示
    const fHP = document.getElementById("fixedPreviewHP");
    const fATK = document.getElementById("fixedPreviewATK");
    const fDEF = document.getElementById("fixedPreviewDEF");
    const fSPD = document.getElementById("fixedPreviewSPD");
    if(fHP) fHP.innerText = hp;
    if(fATK) fATK.innerText = atk;
    if(fDEF) fDEF.innerText = def;
    if(fSPD) fSPD.innerText = spd;
    if(fixedPanel) fixedPanel.style.display = "block";
    // 案内人を隠す
    if(guideChar && guideChar.style.display !== "none" && guideChar.dataset.hiddenByCook !== '1') {
        guideChar.dataset.prevDisplay = guideChar.style.display;
        guideChar.dataset.hiddenByCook = '1';
        guideChar.style.display = "none";
    }
}
function checkCookStock() {
    const i1 = document.getElementById("ingredient1").value; const i2 = document.getElementById("ingredient2").value; const i3 = document.getElementById("ingredient3").value; const sp = document.getElementById("spice").value;
    if(!i1 && !i2 && !i3 && !sp) return;

    // 食材＋スパイス合計2つ以上必要
    const totalSelected = [i1,i2,i3].filter(Boolean).length + (sp ? 1 : 0);
    if(totalSelected < 2) {
        showCustomAlert("⚠️ 食材が足りません", "食材とスパイスを合わせて2つ以上セットしてください。");
        return;
    }

    // 同じ食材を複数箇所にセットしている場合、所持数が足りているか確認
    const ingredientCounts = {};
    [i1, i2, i3].forEach(name => { if(name) ingredientCounts[name] = (ingredientCounts[name]||0) + 1; });
    for(const name in ingredientCounts) {
        const needed = ingredientCounts[name];
        const have = inventory[name] || 0;
        if(needed > have) {
            showCustomAlert("⚠️ 食材が足りません", `「${name}」は${have}個しか持っていません。<br>同じ食材を${needed}箇所にセットすることはできません。`);
            return;
        }
    }

    const doCook = function() {
        playCookingAnimation([i1,i2,i3], sp, function(){ cookCurry(); });
    };
    if(curryStock.length >= getCurryStockLimit()) showCustomConfirm("⚠️ ストック満杯の警告", "新しく調理すると<span style='color:#e74c3c;'>【一番古いカレー】</span>が自動消去されますがよろしいですか？", doCook);
    else doCook();
}

function playCookingAnimation(ingredients, spice, callback, resultBoxId) {
    resultBoxId = resultBoxId || 'resultBox';
    const overlay = document.getElementById('cookingAnimation');
    const pot     = document.getElementById('cookingPot');
    const bg      = document.getElementById('cookingBg');
    if(!overlay || !pot) { callback(); return; }
    if(localStorage.getItem('qr_skip_cook_anim') === '1') { callback(); return; }

    window.cookAnimActive   = true;
    window.pendingCookSound = null;
    overlay.style.display   = 'block';
    overlay.style.opacity   = '1';
    overlay.style.transition = '';
    pot.style.animation = '';

    // タイマーIDを全て管理してスキップ時にキャンセル
    const timerIds = [];
    function addTimer(fn, delay) { const id = setTimeout(fn, delay); timerIds.push(id); return id; }

    // タップでスキップ
    function skipAnimation() {
        timerIds.forEach(id => clearTimeout(id));
        iconEls.forEach(function(el) { el.remove(); });
        pot.style.animation = '';
        overlay.style.display = 'none';
        overlay.style.opacity = '1';
        overlay.style.transition = '';
        overlay.removeEventListener('click', skipAnimation);
        window.cookAnimActive = false;
        callback();
        if(window.pendingCookSound) { window.pendingCookSound(); window.pendingCookSound = null; }
        setTimeout(function() {
            const rb = document.getElementById(resultBoxId);
            if(rb) rb.scrollIntoView({ behavior: 'instant', block: 'center' });
        }, 80);
    }
    overlay.addEventListener('click', skipAnimation);

    // 鍋の座標・サイズをbg.pngの実寸から計算（X222 Y444）
    function setupPot() {
        const bgW = bg.naturalWidth || 750;
        const bgH = bg.naturalHeight || 900;
        pot.style.left  = (222 / bgW * 100).toFixed(1) + '%';
        pot.style.top   = (444 / bgH * 100).toFixed(1) + '%';
        if(pot.naturalWidth > 0) pot.style.width = (pot.naturalWidth / bgW * 100).toFixed(1) + '%';
    }
    if(bg && bg.complete && bg.naturalHeight > 0) { setupPot(); }
    else if(bg) { bg.onload = setupPot; }

    const items = ingredients.filter(Boolean).concat(spice ? [spice] : []);
    const iconEls = [];
    const iconSize = 52, gap = 12;
    const totalW = items.length * (iconSize + gap) - gap;

    function getPotCenter() {
        const r = pot.getBoundingClientRect();
        return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.35 };
    }

    // フェーズ1：アイコンをぱぱっと表示
    items.forEach(function(name, i) {
        const el = document.createElement('div');
        el.className = 'cook-icon-el';
        const d = masterIngredients[name] || masterSpices[name];
        if(d && d.icon) el.innerHTML = `<img src="${d.icon}" style="width:36px;height:36px;object-fit:contain;">`;
        else if(d && d.emoji) el.innerHTML = `<span style="font-size:26px;">${d.emoji}</span>`;
        el.style.opacity = '0'; el.style.transform = 'scale(0)';
        document.body.appendChild(el);
        iconEls.push(el);
        addTimer(function() {
            const pc = getPotCenter();
            el.style.left = (pc.x - totalW / 2 + i * (iconSize + gap)) + 'px';
            el.style.top  = (pc.y - iconSize * 2.6) + 'px';
            requestAnimationFrame(function() { requestAnimationFrame(function() {
                el.style.transition = 'opacity 0.15s, transform 0.28s cubic-bezier(0.34,1.56,0.64,1)';
                el.style.opacity = '1'; el.style.transform = 'scale(1)';
            }); });
            playSoundEffect('intro/papa.mp3');
        }, i * 180);
    });

    // フェーズ2：鍋へ投げ込み
    const flyDelay = items.length * 180 + 350;
    items.forEach(function(_, i) {
        addTimer(function() {
            const el = iconEls[i];
            const er = el.getBoundingClientRect();
            const pc = getPotCenter();
            const dx = pc.x - (er.left + iconSize / 2);
            const dy = pc.y - (er.top  + iconSize / 2);
            el.style.transition = 'transform 0.42s cubic-bezier(0.4,0,0.8,0.6), opacity 0.2s 0.26s';
            el.style.transform  = `translate(${dx}px,${dy}px) scale(0.15)`;
            el.style.opacity    = '0';
            if(i === 0) playSoundEffect('intro/nageire.mp3');
        }, flyDelay + i * 110);
    });

    // フェーズ3：鍋カタカタ
    const shakeDelay = flyDelay + items.length * 110 + 220;
    addTimer(function() {
        pot.style.animation = 'potShake 0.12s ease-in-out 7';
        playSoundEffect('intro/cooking.mp3');
    }, shakeDelay);

    // フェーズ4：結果表示 → スクロール → フェードアウト → 音
    const showResultDelay = shakeDelay + 840;
    addTimer(function() {
        overlay.removeEventListener('click', skipAnimation);
        callback();
        addTimer(function() {
            const rb = document.getElementById(resultBoxId);
            if(rb) rb.scrollIntoView({ behavior: 'instant', block: 'center' });
        }, 80);
        addTimer(function() {
            overlay.style.transition = 'opacity 0.55s ease';
            overlay.style.opacity = '0';
            addTimer(function() {
                overlay.style.display = 'none';
                overlay.style.opacity = '1';
                overlay.style.transition = '';
                pot.style.animation = '';
                iconEls.forEach(function(el) { el.remove(); });
                window.cookAnimActive = false;
                if(window.pendingCookSound) { window.pendingCookSound(); window.pendingCookSound = null; }
            }, 580);
        }, 550);
    }, showResultDelay);
}
// カレーのステータス傾向から「型」を判定する（食材平均値で正規化してから比較）
// 平均値は食材データ全体(33種)の平均: HP≈70.6, ATK≈30.0, DEF≈25.2, SPD≈18.5
const CURRY_TYPE_BASELINE = { hp: 70.6, atk: 30.0, def: 25.2, spd: 18.5 };
function getCurryType(hp, atk, def, spd) {
    // 各ステータスを平均値で割って「相対的な強さ」に正規化
    const normalized = {
        hp: hp / CURRY_TYPE_BASELINE.hp,
        atk: atk / CURRY_TYPE_BASELINE.atk,
        def: def / CURRY_TYPE_BASELINE.def,
        spd: spd / CURRY_TYPE_BASELINE.spd
    };
    const entries = Object.entries(normalized); // [['hp',x],['atk',y],...]
    entries.sort((a,b) => b[1] - a[1]);
    const top = entries[0];
    const second = entries[1];
    // 最高値が2位より15%以上高ければその型、僅差ならバランス型
    if(top[1] >= second[1] * 1.15) {
        if(top[0] === 'hp') return 'hp';
        if(top[0] === 'atk') return 'atk';
        if(top[0] === 'def') return 'def';
        if(top[0] === 'spd') return 'spd';
    }
    return 'balance';
}
const CURRY_TYPE_IMAGES = {
    hp: 'currymonster/curry_hp.png',
    atk: 'currymonster/curry_atk.png',
    def: 'currymonster/curry_def.png',
    spd: 'currymonster/curry_spd.png',
    balance: 'currymonster/curry_balance.png'
};
const CURRY_TYPE_LABELS = { hp: '体力型', atk: '攻撃型', def: '防御型', spd: 'スピード型', balance: 'バランス型' };

// 特殊カレー専用イラスト（型判定より優先）
const CURRY_SPECIAL_IMAGES = {
    seafood:        'currymonster/curry_umi.png',
    poison:         'currymonster/curry_poison.png',
    homerun:        'currymonster/curry_homerun.png',
    seed:           'currymonster/curry_tane.png',
    tricaviar:      'currymonster/curry_3daichinmi.png',
    sticky:         'currymonster/curry_nebaneba.png',
    wanpaku:        'currymonster/curry_wanpaku.png',
    tonton:         'currymonster/curry_ton3.png',
    fluffyomelette: 'currymonster/curry_omu.png',
    greencurry:     'currymonster/curry_green.png',
    poisonapple:    'currymonster/curry_dokuringo.png',
    margherita:     'currymonster/curry_maruge.png',
    ratatouille:    'currymonster/curry_sun.png',
    illusion:       'currymonster/curry_genwaku.png'
};
function getCurryImage(curry) {
    if(!curry) return CURRY_TYPE_IMAGES.balance;
    if(curry.isSeafood)        return CURRY_SPECIAL_IMAGES.seafood;
    if(curry.isPoisonApple)    return CURRY_SPECIAL_IMAGES.poisonapple;
    if(curry.isPoison)         return CURRY_SPECIAL_IMAGES.poison;
    if(curry.isHomerun)        return CURRY_SPECIAL_IMAGES.homerun;
    if(curry.isSeed)           return CURRY_SPECIAL_IMAGES.seed;
    if(curry.isTriCaviar)      return CURRY_SPECIAL_IMAGES.tricaviar;
    if(curry.isSticky)         return CURRY_SPECIAL_IMAGES.sticky;
    if(curry.isTonTonTon)      return CURRY_SPECIAL_IMAGES.tonton;
    if(curry.isWanpaku)        return CURRY_SPECIAL_IMAGES.wanpaku;
    if(curry.isFluffyOmelette) return CURRY_SPECIAL_IMAGES.fluffyomelette;
    if(curry.isGreenCurry)     return CURRY_SPECIAL_IMAGES.greencurry;
    if(curry.isMargherita)     return CURRY_SPECIAL_IMAGES.margherita;
    if(curry.isRatatouille)    return CURRY_SPECIAL_IMAGES.ratatouille;
    if(curry.isIllusion)       return CURRY_SPECIAL_IMAGES.illusion;
    return CURRY_TYPE_IMAGES[curry.curryType] || CURRY_TYPE_IMAGES.balance;
}

// 在庫消費・DOM操作・実績更新を行わない、純粋なカレー生成ロジック（ダミーキャラ・宅配カレー生成等で共用）
function buildCurryFromMaterials(materialNames, spiceName) {
    const i1 = materialNames[0] || ""; const i2 = materialNames[1] || ""; const i3 = materialNames[2] || ""; const sp = spiceName || "";
    let hp = (i1?masterIngredients[i1].hp:0)+(i2?masterIngredients[i2].hp:0)+(i3?masterIngredients[i3].hp:0);
    let atk = (i1?masterIngredients[i1].atk:0)+(i2?masterIngredients[i2].atk:0)+(i3?masterIngredients[i3].atk:0);
    let def = (i1?masterIngredients[i1].def:0)+(i2?masterIngredients[i2].def:0)+(i3?masterIngredients[i3].def:0);
    let spd = (i1?masterIngredients[i1].spd:0)+(i2?masterIngredients[i2].spd:0)+(i3?masterIngredients[i3].spd:0);
    let prefix = ""; if(sp){ prefix=masterSpices[sp].name; let mul=masterSpices[sp].mul; let val=masterSpices[sp].val; if(mul==="hp")hp=Math.round(hp*val); if(mul==="atk")atk=Math.round(atk*val); if(mul==="def")def=Math.round(def*val); if(mul==="spd")spd=Math.round(spd*val);
        // サフラン等、2つ目のステータスも同時に上昇する特殊スパイス対応
        let mul2=masterSpices[sp].mul2; let val2=masterSpices[sp].val2;
        if(mul2){ if(mul2==="hp")hp=Math.round(hp*val2); if(mul2==="atk")atk=Math.round(atk*val2); if(mul2==="def")def=Math.round(def*val2); if(mul2==="spd")spd=Math.round(spd*val2); }
    }
    let acts = [i1,i2,i3].filter(Boolean); let cName = ""; let vis = "";
    let isPoison = false; let hasGold = acts.includes("金箔");
    let countNas = acts.filter(x => x === "ナス").length;
    let hasRaisin = acts.includes("レーズン") || acts.includes("シャインマスカット"); let hasSaba = acts.includes("サバ"); let hasTuna = acts.includes("ツナ") || acts.includes("本マグロ"); let hasDaikon = acts.includes("大根") || acts.includes("聖護院大根"); let hasPotato = acts.includes("ジャガイモ") || acts.includes("メークイン");
    let isMargherita = (acts.includes("トマト") || acts.includes("フルーツトマト")) && acts.includes("チーズ");
    let isTonTonTon = acts.filter(x => x === "トンカツ").length === 3;
    const SEAFOOD_LIST = ["サバ","イカ","小エビ","ホタテ","ツナ","牡蠣","キャビア","オマール海老","ズワイガニ","クルマエビ","本マグロ"];
    let isSeafood = acts.length === 3 && acts.every(x => SEAFOOD_LIST.includes(x));
    let isIllusion = acts.includes("イカ") && acts.includes("マッシュルーム");
    let isSticky = acts.includes("オクラ") && acts.includes("チーズ");
    const SEED_LIST = ["ピーマン","赤パプリカ","黄パプリカ","オクラ","トマト","ナス","レーズン","レンコン","フルーツトマト","シャインマスカット"];
    let seedCount = acts.filter(x => SEED_LIST.includes(x)).length;
    let isSeed = seedCount >= 2;
    const WANPAKU_LIST = ["牛肉","牛タン","牛すじ","チキン","唐揚げ","トンカツ","ウインナー","合鴨"];
    let wanpakuCount = acts.filter(x => WANPAKU_LIST.includes(x)).length;
    let isWanpaku = acts.length === 3 && wanpakuCount === 3;
    const RATATOUILLE_LIST = ["ナス","ピーマン","赤パプリカ","黄パプリカ","トマト","マッシュルーム","フルーツトマト"];
    let rataCount = acts.filter(x => RATATOUILLE_LIST.includes(x)).length;
    let rataUnique = new Set(acts.filter(x => RATATOUILLE_LIST.includes(x))).size;
    let isRatatouille = acts.length === 3 && rataCount === 3 && rataUnique === 3;
    const HOMERUN_LIST = ["レンコン","ウインナー","にんじん","大根","アスパラガス","金時にんじん","聖護院大根"];
    let homerunCount = acts.filter(x => HOMERUN_LIST.includes(x)).length;
    let isHomerun = homerunCount >= 2;
    // 🍎☠️毒りんご：りんご＋ハラペーニョ（毒系・最優先グループ）
    let isPoisonApple = acts.includes("りんご") && acts.includes("ハラペーニョ");
    // 🥚ふわとろオム：タマゴ＋（チーズ or うずら卵）
    let isFluffyOmelette = acts.includes("タマゴ") && (acts.includes("チーズ") || acts.includes("うずら卵"));
    // 👑世界三大珍味ざます！カレー：キャビア＋フォアグラ＋トリュフ
    let isTriCaviar = acts.includes("キャビア") && acts.includes("フォアグラ") && acts.includes("トリュフ");
    // 🟢激辛エスニック・グリーンカレー：ハラペーニョ＋（パクチー・ココナッツ・コリアンダーから合計2個以上、重複可）
    let pakuchiCount = acts.filter(x => x === "パクチー").length;
    let coconutCount = acts.filter(x => x === "ココナッツ").length;
    let hasCoriander = (sp === "コリアンダー");
    let greenPartnerCount = pakuchiCount + Math.min(coconutCount, 1) + (hasCoriander ? 1 : 0);
    let isGreenCurry = acts.includes("ハラペーニョ") && greenPartnerCount >= 2;
    if(acts.length===0){ cName=`${prefix}スパイススープ`; vis="🥣"; } else {
        if(isMargherita) {
            const others = acts.filter(x => x !== "トマト" && x !== "チーズ");
            let body = others.length > 0 ? others.map(x => x).join("") : "";
            cName = `${prefix}マルゲリータ${body ? body + "の" : ""}カレー`;
            vis = acts.map(x => masterIngredients[x].emoji).join("");
        } else if(isTonTonTon) {
            cName = "🐷3匹のわんぱく兄弟"; vis = "🐷🐷🐷";
        } else {
            let cnts={}; acts.forEach(x=>cnts[x]=(cnts[x]||0)+1); let body="";
            Object.keys(cnts).forEach(k=>{ if(cnts[k]===3)body+=`トリプル${k}`; else if(cnts[k]===2)body+=`W${k}`; else body+=k; });
            cName=`${prefix}${body}カレー`; vis=acts.map(x=>masterIngredients[x].emoji).join("");
            if(isSeafood) cName = `🌊${cName}🌊`;
        }
    }
    if(isMargherita) { hp=Math.round(hp*1.2); atk=Math.round(atk*1.2); def=Math.round(def*1.2); spd=Math.round(spd*1.2); }
    if(isGreenCurry) { hp=Math.round(hp*1.2); atk=Math.round(atk*1.2); def=Math.round(def*1.2); spd=Math.round(spd*1.2); }
    let poisonChosen = null;
    let poisonNasPartner = "";
    if(countNas >= 1 && hasRaisin) { poisonChosen = "poison_nas_partner"; poisonNasPartner = "レーズン"; }
    else if(countNas >= 1 && hasPotato) { poisonChosen = "poison_nas_partner"; poisonNasPartner = "ジャガイモ"; }
    else if((hasSaba || hasTuna) && countNas >= 1 && hasDaikon) poisonChosen = "poison_fish";
    else if(countNas >= 2) poisonChosen = "poison_nas2";
    else if(isPoisonApple) poisonChosen = "poison_apple";
    else if(isTonTonTon) poisonChosen = "tonton"; // 3匹のわんぱく兄弟：わんぱくと条件が重複するため毒同様に最優先扱いする
    else if(isTriCaviar) poisonChosen = "tricaviar"; // 世界三大珍味：3つの高級食材すべてを使う厳しい条件のため最優先扱いする
    let exclusiveCandidates = [];
    if(!poisonChosen) {
        if(isMargherita) exclusiveCandidates.push("margherita");
        if(isIllusion) exclusiveCandidates.push("illusion");
        if(isSticky) exclusiveCandidates.push("sticky");
        if(isSeed) exclusiveCandidates.push("seed");
        if(isWanpaku) exclusiveCandidates.push("wanpaku");
        if(isRatatouille) exclusiveCandidates.push("ratatouille");
        if(isHomerun) exclusiveCandidates.push("homerun");
        if(isFluffyOmelette) exclusiveCandidates.push("fluffyomelette");
        if(isGreenCurry) exclusiveCandidates.push("greencurry");
    }
    const chosen = poisonChosen || (exclusiveCandidates.length > 0 ? exclusiveCandidates[Math.floor(Math.random() * exclusiveCandidates.length)] : null);
    isPoison=false; isMargherita=false; isTonTonTon=false; isIllusion=false; isSticky=false; isSeed=false; isWanpaku=false; isRatatouille=false; isHomerun=false; isPoisonApple=false; isFluffyOmelette=false; isGreenCurry=false; isTriCaviar=false;
    if(chosen === "poison_nas_partner") { cName = `☠️瘴気漂う毒ナス${poisonNasPartner}`; isPoison = true; }
    else if(chosen === "poison_fish") { cName = "☠️デスフィッシュカレー"; isPoison = true; }
    else if(chosen === "poison_nas2") { cName = "☠️怨念のナス毒沼カレー"; isPoison = true; }
    else if(chosen === "poison_apple") {
        const extra = acts.filter(x => x !== "りんご" && x !== "ハラペーニョ");
        cName = `🍎☠️毒りんご${extra.length ? extra[0] : ""}カレー`;
        isPoison = true; isPoisonApple = true;
    }
    else if(chosen === "margherita") { isMargherita = true; }
    else if(chosen === "tonton") { isTonTonTon = true; }
    else if(chosen === "tricaviar") { cName = "👑世界三大珍味ざます！カレー👑"; isTriCaviar = true; }
    else if(chosen === "illusion") { cName = `🌀幻惑の${cName}`; isIllusion = true; }
    else if(chosen === "sticky") { cName = `💚ネバネバ${cName}`; isSticky = true; }
    else if(chosen === "seed") { cName = `🌱種連発${cName}`; isSeed = true; }
    else if(chosen === "wanpaku") { cName = `🍛わんぱく${acts.join("")}`; isWanpaku = true; }
    else if(chosen === "ratatouille") { cName = "☀️太陽のラタトゥイユカレー"; isRatatouille = true; }
    else if(chosen === "homerun") { cName = `🏏${cName.replace(/カレー$/, "")}ホームランカレー`; isHomerun = true; }
    else if(chosen === "fluffyomelette") {
        const extra = acts.filter(x => x !== "タマゴ" && x !== "チーズ" && x !== "うずら卵");
        cName = `🥚ふわとろオム${extra.length ? extra[0] : ""}カレー`;
        isFluffyOmelette = true;
    }
    else if(chosen === "greencurry") { cName = "🟢激辛エスニック・グリーンカレー"; isGreenCurry = true; }
    let isCritical = false;
    if(hasGold) { cName = `✨黄金仕立ての${cName}`; }
    if(!hasGold && !isSeafood && Math.random()<0.15){ cName=`💎至高の${cName}`; hp=Math.round(hp*1.4); atk=Math.round(atk*1.4); isCritical = true; }
    const curryType = getCurryType(hp, atk, def, spd);
    return { name: cName, visual: vis, hp: hp, atk: atk, def: def, spd: spd, isPoison, hasGold, isMargherita, isTonTonTon, isSeafood, isIllusion, isSticky, isSeed, isWanpaku, isRatatouille, isHomerun, isPoisonApple, isFluffyOmelette, isGreenCurry, isTriCaviar, isCritical, materials: acts.length ? acts : [], spice: sp || "", curryType: curryType };
}

// ランダムに食材プールから1〜3個選んでカレーを生成（ダミーキャラ・宅配カレー生成用）
function generateRandomCurryFromPool(ingredientPool, includeSpice) {
    const shuffled = [...ingredientPool].sort(() => Math.random() - 0.5);
    const materials = shuffled.slice(0, 3);
    let spice = "";
    if(includeSpice && Math.random() < 0.5) {
        const spicePool = Object.keys(masterSpices).filter(k => k !== "マンゴーチャツネ" && k !== "サフラン" && isIngredientAvailable(k));
        spice = spicePool[Math.floor(Math.random() * spicePool.length)];
    }
    return buildCurryFromMaterials(materials, spice);
}

// ============================================================
// ダミーキャラ（タッグ戦の宅配カレー抽選プール用、本物のプレイヤーが少ない場合の補充）
// ============================================================
function getNormalIngredientPool() { return Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 0 && isIngredientAvailable(k)); }
function getMidIngredientPool() { return Object.keys(masterIngredients).filter(k => (masterIngredients[k].shop === 0 && isIngredientAvailable(k)) || (masterIngredients[k].shop === 1 && isIngredientAvailable(k))); }
function getHighIngredientPool() { return Object.keys(masterIngredients).filter(k => (masterIngredients[k].shop === 0 && isIngredientAvailable(k)) || (masterIngredients[k].shop === 1 && isIngredientAvailable(k)) || (masterIngredients[k].shop === 2 && isIngredientAvailable(k))); }

// 「ノーマルカレー」（特殊効果なし）を確実に生成する
function generateGuaranteedNormalCurry(pool, maxRetry) {
    maxRetry = maxRetry || 30;
    for(let i = 0; i < maxRetry; i++) {
        const curry = generateRandomCurryFromPool(pool, false);
        if(!curry.isPoison && !curry.hasGold && !curry.isMargherita && !curry.isTonTonTon && !curry.isSeafood
            && !curry.isIllusion && !curry.isSticky && !curry.isSeed && !curry.isWanpaku && !curry.isRatatouille && !curry.isHomerun && !curry.isCritical) {
            return curry;
        }
    }
    // 確実に特殊効果が出ない3食材（金箔・海鮮系を避けたノーマル野菜のみ）でフォールバック
    return buildCurryFromMaterials(["玉ねぎ", "にんじん", "ジャガイモ"], "");
}
// 種連射カレーを確実に生成する
function generateGuaranteedSeedCurry(pool, maxRetry) {
    maxRetry = maxRetry || 50;
    const seedList = ["ピーマン","赤パプリカ","黄パプリカ","オクラ","トマト","ナス","レーズン","レンコン"];
    const seedPoolFiltered = pool.filter(x => seedList.includes(x));
    for(let i = 0; i < maxRetry; i++) {
        const usePool = seedPoolFiltered.length >= 2 ? seedPoolFiltered : pool;
        const curry = generateRandomCurryFromPool(usePool, false);
        if(curry.isSeed) return curry;
    }
    return buildCurryFromMaterials(["ピーマン", "トマト", "レンコン"], "");
}
// ホームランカレーを確実に生成する
function generateGuaranteedHomerunCurry(pool, maxRetry) {
    maxRetry = maxRetry || 50;
    const homerunList = ["レンコン","ウインナー","にんじん","大根"];
    const homerunPoolFiltered = pool.filter(x => homerunList.includes(x));
    for(let i = 0; i < maxRetry; i++) {
        const usePool = homerunPoolFiltered.length >= 2 ? homerunPoolFiltered : pool;
        const curry = generateRandomCurryFromPool(usePool, false);
        if(curry.isHomerun) return curry;
    }
    return buildCurryFromMaterials(["レンコン", "ウインナー", "玉ねぎ"], "");
}

// ダミーキャラ定義（固有ID付き、本物のプレイヤーには発行されない予約ID帯）
const DUMMY_CHARACTERS = [
    { id: "BC-DUMMY0001", name: "たま", icon: "myimageicon/mayimage02.png", curryGen: () => generateGuaranteedNormalCurry(getNormalIngredientPool()) },
    { id: "BC-DUMMY0002", name: "筋肉痛マン", icon: "myimageicon/mayimage01.png", curryGen: () => generateGuaranteedNormalCurry(getNormalIngredientPool()) },
    { id: "BC-DUMMY0003", name: "SPLASH!!!!!", icon: "myimageicon/mayimage05.png", curryGen: () => generateGuaranteedSeedCurry(getNormalIngredientPool()) },
    { id: "BC-DUMMY0004", name: "るねさん", icon: "myimageicon/mayimage03.png", curryGen: () => generateGuaranteedHomerunCurry(getNormalIngredientPool()) },
    { id: "BC-DUMMY0005", name: "忍者男爵", icon: "myimageicon/mayimage06.png", curryGen: () => generateGuaranteedNormalCurry(getMidIngredientPool()) },
    { id: "BC-DUMMY0006", name: "ああああ", icon: "myimageicon/mayimage01.png", curryGen: () => generateRandomCurryFromPool(getMidIngredientPool(), false) },
    { id: "BC-DUMMY0007", name: "銀次郎", icon: "myimageicon/mayimage04.png", curryGen: () => generateRandomCurryFromPool(getMidIngredientPool(), false) },
    { id: "BC-DUMMY0008", name: "aya.cake7", icon: "myimageicon/mayimage04.png", curryGen: () => generateRandomCurryFromPool(getHighIngredientPool(), false) },
    { id: "BC-DUMMY0009", name: "トニーボニーロッカー🦌", icon: "myimageicon/mayimage08.png", curryGen: () => generateRandomCurryFromPool(getHighIngredientPool(), false) },
    { id: "BC-DUMMY0010", name: "カレーガチ勢🍛", icon: "myimageicon/mayimage07.png", curryGen: () => generateRandomCurryFromPool(getHighIngredientPool(), false) }
];

// ダミーキャラ全員分の「現在の宅配カレー」を生成（タッグ戦マッチング時に毎回新規生成）
function generateDummyDeliveryPool() {
    return DUMMY_CHARACTERS.map(dummy => {
        const curry = dummy.curryGen();
        curry.isDelivering = true;
        return {
            playerId: dummy.id,
            playerName: dummy.name,
            playerIcon: dummy.icon,
            curry: curry,
            isDummy: true
        };
    });
}

// ============================================================
// 宅配カレーのクラウド公開・抽選・使用処理
// ============================================================
// ローカルの冷蔵庫に「宅配中」のカレーがあるのに、Firebase上のdeliveryCurriesに存在しない場合は再公開する。
// データ復元・クラウド同期等でcurryStockだけ復元され、Firebase側への再公開が漏れるケースの保険。
function ensureDeliveryCurrySynced() {
    if(!database || !playerId) return;
    const deliveringCurry = curryStock.find(c => c.isDelivering);
    if(!deliveringCurry) return;
    database.ref('deliveryCurries/' + playerId).once('value').then(function(snap){
        if(!snap.exists()) {
            publishDeliveryCurryToCloud(deliveringCurry);
        }
    }).catch(function(e){ console.error('ensureDeliveryCurrySynced error:', e); });
}

function publishDeliveryCurryToCloud(curry) {
    if(!database || !playerId) return;
    database.ref('deliveryCurries/' + playerId).set({
        playerName: playerName,
        playerIcon: currentIconFile,
        curry: curry,
        usedCount: 0,
        winCount: 0,
        createdAt: Date.now()
    }).catch(function(e){ console.error('publishDeliveryCurryToCloud error:', e); });
}

// 自分以外の本物プレイヤーの宅配カレーから最大20件取得し、その中からランダムで指定数を抽選
// 20件未満の場合はダミーキャラも候補に加える
function fetchTagDeliveryCandidates(count, callback) {
    if(!database) { callback(generateDummyDeliveryPool().slice(0, count)); return; }
    database.ref('deliveryCurries').limitToLast(50).once('value').then(function(snap){
        const data = snap.val() || {};
        let realCandidates = Object.keys(data)
            .filter(pid => pid !== playerId && data[pid] && data[pid].curry)
            .map(pid => ({
                playerId: pid,
                playerName: data[pid].playerName || '名無しの料理人',
                playerIcon: migrateIconPath(data[pid].playerIcon) || 'myimageicon/mayimage01.png',
                curry: data[pid].curry,
                isDummy: false
            }));
        let pool = realCandidates;
        if(realCandidates.length < 20) {
            pool = pool.concat(generateDummyDeliveryPool());
        }
        // ランダムにcount件抽選
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        callback(shuffled.slice(0, count));
    }).catch(function(){
        callback(generateDummyDeliveryPool().slice(0, count));
    });
}

// 宅配カレーが使用された結果を、その所有者の累計成績に反映（本物のプレイヤーのみ。ダミーは対象外）
function reportDeliveryCurryUsage(candidate, didWin) {
    if(!database || !candidate || candidate.isDummy) return;
    const ref = database.ref('deliveryCurries/' + candidate.playerId);
    ref.once('value').then(function(snap){
        const data = snap.val();
        if(!data) return; // 既に他の人に上書き・削除されている場合は何もしない
        const newUsedCount = (data.usedCount || 0) + 1;
        const isEatenUp = newUsedCount >= 5;
        // 先に公開データ（deliveryCurries）の更新・削除を完了させてから、報酬キューに積む
        // （順序を保証することで、削除に失敗した場合に報酬だけ先に届く不整合を防ぐ）
        const updateOrRemove = isEatenUp
            ? ref.remove()
            : ref.update({ usedCount: newUsedCount, winCount: (data.winCount || 0) + (didWin ? 1 : 0) });
        updateOrRemove.then(function(){
            return database.ref('deliveryRewardQueue/' + candidate.playerId).push({
                usedCount: 1, winCount: didWin ? 1 : 0, eatenUp: isEatenUp,
                curryName: data.curry ? data.curry.name : '',
                curryImage: data.curry ? getCurryImage(data.curry) : '',
                createdAt: Date.now(),
                senderUid: currentUid // 誰が報酬エントリを作成したかルール側で検証・追跡できるようにする（なりすまし防止）
            });
        }).catch(function(e){
            console.error('reportDeliveryCurryUsage update/remove error:', e);
        });
    }).catch(function(e){ console.error('reportDeliveryCurryUsage error:', e); });
}

function cookCurry() {
    const i1 = document.getElementById("ingredient1").value; const i2 = document.getElementById("ingredient2").value; const i3 = document.getElementById("ingredient3").value; const sp = document.getElementById("spice").value;
    if(i1) inventory[i1]--; if(i2) inventory[i2]--; if(i3) inventory[i3]--; if(sp) inventory[sp]--;
    // カレーの計算（強さ・特殊効果・名前）は共通関数に一本化。今後の新カレー追加はbuildCurryFromMaterialsだけ直せばよい
    const newCurry = buildCurryFromMaterials([i1, i2, i3], sp);
    const { name: cName, visual: vis, hp, atk, def, spd, isPoison, hasGold, isMargherita, isTonTonTon, isSeafood, isIllusion, isSticky, isSeed, isWanpaku, isRatatouille, isHomerun, isPoisonApple, isFluffyOmelette, isGreenCurry, isTriCaviar, isCritical, materials: acts } = newCurry;

    const rKey=[...acts, sp].filter(Boolean).sort().join("+");
    if(!recipeBook[rKey]) { recipeBook[rKey]={name:cName, visual:vis, materials:acts.length?acts:["なし"], spice:sp||""}; pruneRecipeBook(); }
    window.__lastCookedRecipeKey = rKey; // お気に入り登録ボタン用に直近のレシピキーを保持

    document.getElementById("resultBox").classList.remove("critical-box","poison-box","gold-box","margherita-box","tonton-box","wave-box","illusion-box","sticky-box","seed-box","wanpaku-box","ratatouille-box","homerun-box","poisonapple-box","fluffyomelette-box","greencurry-box");
    ["criticalFlashText","poisonFlashText","goldFlashText","margheritaFlashText","tontonFlashText","waveFlashText","illusionFlashText","stickyFlashText","seedFlashText","wanpakuFlashText","ratatouilleFlashText","homerunFlashText","poisonappleFlashText","fluffyomeletteFlashText","greencurryFlashText"].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display="none"; });

    // 重複OK演出：金箔・海鮮・会心
    // 前回の特殊演出をリセット
    const resultBox = document.getElementById("resultBox");
    ['gold-box','wave-box','critical-box','poison-box','poisonapple-box','margherita-box','tonton-box','illusion-box','sticky-box','seed-box','wanpaku-box','ratatouille-box','homerun-box','fluffyomelette-box','greencurry-box','tricaviar-box'].forEach(c => resultBox.classList.remove(c));
    ['goldFlashText','waveFlashText','criticalFlashText','poisonFlashText','poisonappleFlashText','margheritaFlashText','tontonFlashText','illusionFlashText','stickyFlashText','seedFlashText','wanpakuFlashText','ratatouilleFlashText','homerunFlashText','fluffyomeletteFlashText','greencurryFlashText','tricaviarFlashText'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });

    if(hasGold) { document.getElementById("resultBox").classList.add("gold-box"); document.getElementById("goldFlashText").style.display="block"; }
    if(isSeafood) { document.getElementById("resultBox").classList.add("wave-box"); document.getElementById("waveFlashText").style.display="block"; }
    if(isCritical){ document.getElementById("resultBox").classList.add("critical-box"); document.getElementById("criticalFlashText").style.display="block"; }

    // 排他特殊演出（buildCurryFromMaterialsで選ばれた1つのみtrueになっている）
    if(isPoison) { document.getElementById("resultBox").classList.add("poison-box"); document.getElementById("poisonFlashText").style.display="block";
        if(isPoisonApple) { const el=document.getElementById("poisonappleFlashText"); if(el) el.style.display="block"; document.getElementById("resultBox").classList.add("poisonapple-box"); }
    }
    else if(isMargherita) { document.getElementById("resultBox").classList.add("margherita-box"); document.getElementById("margheritaFlashText").style.display="block"; }
    else if(isTonTonTon) { document.getElementById("resultBox").classList.add("tonton-box"); document.getElementById("tontonFlashText").style.display="block"; }
    else if(isIllusion) { document.getElementById("resultBox").classList.add("illusion-box"); document.getElementById("illusionFlashText").style.display="block"; }
    else if(isSticky) { document.getElementById("resultBox").classList.add("sticky-box"); document.getElementById("stickyFlashText").style.display="block"; }
    else if(isSeed) { document.getElementById("resultBox").classList.add("seed-box"); document.getElementById("seedFlashText").style.display="block"; }
    else if(isWanpaku) { document.getElementById("resultBox").classList.add("wanpaku-box"); document.getElementById("wanpakuFlashText").style.display="block"; }
    else if(isRatatouille) { document.getElementById("resultBox").classList.add("ratatouille-box"); document.getElementById("ratatouilleFlashText").style.display="block"; }
    else if(isHomerun) { document.getElementById("resultBox").classList.add("homerun-box"); document.getElementById("homerunFlashText").style.display="block"; }
    else if(isFluffyOmelette) { document.getElementById("resultBox").classList.add("fluffyomelette-box"); const el=document.getElementById("fluffyomeletteFlashText"); if(el) el.style.display="block"; }
    else if(isGreenCurry) { document.getElementById("resultBox").classList.add("greencurry-box"); const el=document.getElementById("greencurryFlashText"); if(el) el.style.display="block"; }
    else if(isTriCaviar) { document.getElementById("resultBox").classList.add("tricaviar-box"); const el=document.getElementById("tricaviarFlashText"); if(el) el.style.display="block"; }

    // 効果音：調理アニメ中は背景フェード後に鳴らすために保留
    const _resultSounds = function() {
        // 優先度順に1音だけ鳴らす（特殊カレー > 会心 > 金箔 > 通常）
        if(isTriCaviar)          { playSoundEffect('healing.mp3'); }
        else if(isFluffyOmelette){ playSoundEffect('healing.mp3'); }
        else if(isGreenCurry)    { playSoundEffect('hirihiri.mp3'); }
        else if(isPoison)        { playSoundEffect('poison.mp3'); }
        else if(isMargherita)    { playSoundEffect('sound/syakin.mp3'); }
        else if(isTonTonTon)     { playSoundEffect('pig2.mp3'); }
        else if(isRatatouille)   { playSoundEffect('sound/syakin.mp3'); }
        else if(isWanpaku)       { playSoundEffect('sound/syakin.mp3'); }
        else if(isHomerun)       { playSoundEffect('sound/syakin.mp3'); }
        else if(isSticky)        { playSoundEffect('sound/syakin.mp3'); }
        else if(isSeed)          { playSoundEffect('sound/syakin.mp3'); }
        else if(isIllusion)      { playSoundEffect('sound/syakin.mp3'); }
        else if(isSeafood)       { playSoundEffect('sound/syakin.mp3'); }
        else if(isCritical)      { playSoundEffect('sound/syakin.mp3'); }
        else if(hasGold)         { playSoundEffect('sound/kinpaku.mp3'); }
        else                     { playSoundEffect('sound/pirorin.mp3'); }
    };
    if(window.cookAnimActive) { window.pendingCookSound = _resultSounds; }
    else { _resultSounds(); }

    if (curryStock.length >= getCurryStockLimit()) curryStock.shift();
    curryStock.push(newCurry); selectedCurryIndex = curryStock.length - 1;
    saveGame(); updateFridgeUI(); updateCookSelects(); refreshRecipeBookUI(); updateFavRecipeSelect(); clearAllHints();
    clearCookSelection();
    onCookDone(newCurry); // 実績・デイリー更新
    // カレー結果のイラスト表示（型別イラスト）＋食材アイコン
    const curryImg = document.getElementById("curryVisualImg");
    curryImg.src = getCurryImage(newCurry); curryImg.style.display = "block";
    const cookIconsHTML = curryIconsHTML(acts, sp, '32px');
    document.getElementById("cookResultIcons").innerHTML = cookIconsHTML || vis; document.getElementById("curryName").innerText=cName;
    document.getElementById("statHP").innerText=hp; document.getElementById("statATK").innerText=atk; document.getElementById("statDEF").innerText=def; document.getElementById("statSPD").innerText=spd;
    document.getElementById("resultBox").style.display="block";
}
function repopulateVsCurrySelector() {
    const select = document.getElementById("vsCurrySelect"); select.innerHTML = "";
    const usableStock = curryStock.filter(c => !c.isDelivering);
    if (!usableStock.length) { select.innerHTML = "<option value='-1'>❌ 出撃できるカレーがありません（調理して下さい）</option>"; selectedCurryIndex = -1; return; }
    curryStock.forEach((c, idx) => {
        if(c.isDelivering) return;
        let opt = document.createElement("option"); opt.value = idx;
        let m = c.isPoison ? "☠️ " : (c.hasGold ? "✨ " : "");
        opt.innerText = `[${idx+1}] ${m}${c.name}`;
        if (idx === selectedCurryIndex) opt.selected = true;
        select.appendChild(opt);
    });
    if(selectedCurryIndex === -1 || (curryStock[selectedCurryIndex] && curryStock[selectedCurryIndex].isDelivering)) {
        const firstUsableIdx = curryStock.findIndex(c => !c.isDelivering);
        selectedCurryIndex = firstUsableIdx;
    }
    syncVsSelection(selectedCurryIndex);
}
function syncVsSelection(idx) {
    selectedCurryIndex = parseInt(idx, 10);
    const c = curryStock[selectedCurryIndex];
    const statusEl = document.getElementById("vsCurryStatus");
    if(statusEl && c) {
        const iconsHTML = curryIconsHTML(c.materials, c.spice, '16px');
        statusEl.innerHTML = `${iconsHTML} HP:${statDisplayWithTableware('hp', c.hp)} / ATK:${statDisplayWithTableware('atk', c.atk)} / DEF:${statDisplayWithTableware('def', c.def)} / SPD:${statDisplayWithTableware('spd', c.spd)}`;
    } else if(statusEl) { statusEl.innerHTML = ""; }
}
function startBotBattle() {
    if (!hasUsableCurryForBattle()) { alertNoUsableCurry(); return; }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isBotMatch = true; currentRoomId = null;
    let oppCurryData = null; let bName = ""; let bVisual = ""; let bCurryEmoji = "🍛";
    if (Math.random() < 0.10) {
        bName = "大富豪マハラジャ"; bVisual = "botimage/bot05.png"; bCurryEmoji = "✨🥩✨";
        const maharajaStats = rollMaharajaStats();
        oppCurryData = { name: "マハラジャ超絢爛カレー", visual: bVisual, emoji: bCurryEmoji, hp: maharajaStats.hp, atk: maharajaStats.atk, def: maharajaStats.def, spd: maharajaStats.spd, isMaharaja: true, maharajaLevel: maharajaStats.level, isBotImage: true, foodCategory: null };
        activeBotData = { expBonus: 5, image: bVisual };
    } else {
        const bot = botOpponents[Math.floor(Math.random() * botOpponents.length)];
        bName = bot.name; bVisual = bot.image; bCurryEmoji = bot.emoji;
        oppCurryData = { name: rTrimHtml(bot.curryName), visual: bVisual, emoji: bCurryEmoji, hp: bot.hp, atk: bot.atk, def: bot.def, spd: bot.spd, isBotImage: true, foodCategory: bot.foodCategory };
        activeBotData = bot;
    }
    launchVsCutIn(bName, bVisual, oppCurryData);
}
// VSカットイン演出の開始（Bot対戦相手が確定した後、共通で呼ばれる）
function launchVsCutIn(bName, bVisual, oppCurryData) {
    cachedOpponentName = bName;
    cachedOpponentCurry = oppCurryData;
    const vs = document.getElementById("vsCutIn"); vs.style.display = "flex"; playVsSound();
    const vsInteractiveBot = vs ? vs.querySelector('.vs-interactive-area') : null;
    if(vsInteractiveBot) vsInteractiveBot.style.display = "block";
    document.getElementById("vsPlayerName").innerText = playerName;
    if (typeof repopulateVsCurrySelector === "function") repopulateVsCurrySelector();
    document.getElementById("vsEnemyName").innerText = bName;
    document.getElementById("vsEnemyVisual").innerHTML = `<img src="${bVisual}" alt="${bName}">`;
    document.getElementById("vsEnemyCurry").innerText = oppCurryData.name;
    document.getElementById("vsPlayerVisual").innerHTML = `<img src="${currentIconFile}" style="width:100px;height:100px;border-radius:50%;border:3px solid #e67e22;object-fit:cover;">`;
    setTimeout(() => { document.getElementById("vsPlayerSide").style.transform = "translateX(0)"; }, 100);
    setTimeout(() => { document.getElementById("vsEnemySide").style.transform = "translateX(0)"; }, 300);
    setTimeout(() => { document.getElementById("vsBadge").style.opacity = "1"; document.getElementById("vsBadge").style.scale = "1"; }, 600);
}

// ============================================================
// イベント：特盛りモンスターから街を守れ！
// ============================================================
const EVENT_MONSTER_DATA = { hp: 5000, atk: 120, def: 60, spd: 60, name: "浪花のカレーライスベイビー" };
let eventEnabled = false; // Firebaseから読み込むまでの仮値
let eventTotalDamageThisBattle = 0;

function loadEventEnabledStatus() {
    if(!database) { checkEventBannerVisibility(); return; }
    database.ref('events/tokumori001/enabled').once('value').then(function(snap){
        eventEnabled = (snap.val() === true);
        checkEventBannerVisibility();
    }).catch(function(){
        checkEventBannerVisibility();
    });
}

// ============================================================
// 時間関連デバッグ機能（デバッグモード中のみ仮想時刻を使用、一般プレイヤーには影響なし）
// ============================================================
function getGameNow() {
    if(isDebugMode) {
        const override = localStorage.getItem('qr_debug_time_override');
        if(override) {
            const overrideDate = new Date(override);
            if(!isNaN(overrideDate.getTime())) return overrideDate;
        }
    }
    return new Date();
}

// 日本時間（JST）基準のYYYY-MM-DD文字列を返す（デイリーリセット等の日付判定用）
// プレイヤーごとのアクセス記録（同ID・同日の重複カウントを防止）
function showDailyAccessDetail(day) {
    if(!database) return;
    database.ref('analytics/dailyAccess/' + day).once('value').then(function(snap){
        const data = snap.val() || {};
        const entries = Object.keys(data).map(function(pid){ return { pid: pid, name: data[pid].name || '名無し', ts: data[pid].ts || 0 }; });
        entries.sort(function(a,b){ return a.ts - b.ts; });
        let rows = '';
        if(entries.length === 0) { rows = '<div style="font-size:12px;color:#888;">データがありません。</div>'; }
        entries.forEach(function(e){
            rows += '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee;font-size:12px;">'
                + '<span>' + e.name + ' <span style="color:#999;">(' + e.pid + ')</span></span>'
                + '</div>';
        });
        showCustomAlert('📅 ' + day + ' のアクセス（' + entries.length + '人）',
            '<div style="text-align:left;max-height:55vh;overflow-y:auto;">' + rows + '</div>'
        );
    });
}

// ============================================================
// QR BINGO
// ============================================================
// 現在抽選に出してよいビンゴアイテム（ノーマル食材＋ノーマルスパイスを自動取得。ボス解放食材は解放済みでなければ除外）
// 食材くじ・QRスキャンと同じ「ノーマル」基準を使うことで、食材の等級を変更しても自動的に追従する
function getAvailableBingoItemPool() {
    const normalIngredients = getNormalIngredientPool();
    const normalSpices = Object.keys(masterSpices).filter(k => k !== "マンゴーチャツネ" && k !== "サフラン" && isIngredientAvailable(k));
    return [...normalIngredients, ...normalSpices];
}
// 4x4=16マスのライン定義（横4・縦4・斜め2＝10ライン）
const BINGO_LINES = [
    [0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15], // 横
    [0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15],  // 縦
    [0,5,10,15],[3,6,9,12]                          // 斜め
];

function getBingoData() {
    const d = localStorage.getItem('qr_bingo');
    return d ? JSON.parse(d) : null;
}
function saveBingoData(data) {
    localStorage.setItem('qr_bingo', JSON.stringify(data));
    saveGame();
}

function generateNewBingoCard() {
    const shuffled = [...getAvailableBingoItemPool()].sort(() => Math.random() - 0.5);
    const cardItems = shuffled.slice(0, 16);
    const opened = cardItems.map(() => false);
    const data = {
        cardItems, opened,
        completedLines: [],
        createdAt: Date.now(),
        watchedMovie: getBingoData() ? getBingoData().watchedMovie : false
    };
    saveBingoData(data);
    return data;
}

function openBingoModal() {
    let data = getBingoData();
    const isFirstTime = !data;
    if(!data) data = generateNewBingoCard();

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('bingoFullscreen').classList.add('active');
    hideQuestGuideChar();

    if(isFirstTime || !data.watchedMovie) {
        playBingoOpeningMovie(data);
    } else {
        document.getElementById('bingoMovieWrap').style.display = 'none';
        document.getElementById('bingoCardWrap').style.display = 'block';
        renderBingoCard(data, false);
    }
}

function closeBingoModal() {
    document.getElementById('bingoFullscreen').classList.remove('active');
    const video = document.getElementById('bingoMovieVideo');
    if(video) video.pause();
    // QRスキャンタブに戻る
    const scanTab = document.querySelector('[onclick*="scan"]');
    const scanPage = document.getElementById('pageScan');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if(scanTab) scanTab.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    if(scanPage) scanPage.classList.add('active');
    hideQuestGuideChar();
}

function playBingoOpeningMovie(data) {
    const wrap = document.getElementById('bingoMovieWrap');
    const video = document.getElementById('bingoMovieVideo');
    const body = document.querySelector('#bingoFullscreen .bingo-body');
    document.getElementById('bingoCardWrap').style.display = 'none';
    wrap.style.display = 'block';
    if(body) body.classList.add('movie-centered');
    video.muted = isMuted;
    video.currentTime = 0;
    let finished = false;
    function finishMovie() {
        if(finished) return;
        finished = true;
        wrap.style.display = 'none';
        if(body) body.classList.remove('movie-centered');
        video.pause();
        data.watchedMovie = true;
        saveBingoData(data);
        document.getElementById('bingoCardWrap').style.display = 'block';
        renderBingoCard(data, true);
    }
    video.onended = finishMovie;
    video.play().catch(() => finishMovie());
}

function replayBingoMovie() {
    const data = getBingoData();
    if(!data) return;
    playBingoOpeningMovie(data);
}

function renderBingoCellsInto(container, data, withFallAnimation, highlightIdx, newLineIndices) {
    container.innerHTML = '';
    const newLineCells = new Set();
    if(newLineIndices && newLineIndices.length) {
        newLineIndices.forEach(lineIdx => { BINGO_LINES[lineIdx].forEach(c => newLineCells.add(c)); });
    }
    data.cardItems.forEach((itemName, idx) => {
        const cell = document.createElement('div');
        cell.className = 'bingo-cell';
        if(withFallAnimation) {
            cell.classList.add('fall-in');
            cell.style.animationDelay = (idx * 60) + 'ms';
        }
        if(newLineCells.has(idx)) cell.classList.add('line-new');
        const inner = document.createElement('div');
        inner.className = 'bingo-cell-inner';
        const known = !!discoveredItems[itemName];
        if(known) {
            const itemData = masterIngredients[itemName] || masterSpices[itemName];
            const icon = itemData && itemData.icon;
            if(icon) inner.innerHTML = `<img src="${icon}" alt="">`;
            else inner.innerHTML = `<span style="font-size:28px;">${(itemData&&itemData.emoji)||'❓'}</span>`;
        } else {
            inner.innerHTML = '<span class="bingo-unknown">？</span>';
        }
        cell.appendChild(inner);
        if(data.opened[idx]) {
            const mark = document.createElement('div');
            mark.className = 'bingo-mark';
            if(idx === highlightIdx) {
                mark.innerHTML = '<div class="bingo-mark-circle bingo-mark-drop"></div>';
            } else {
                mark.innerHTML = '<div class="bingo-mark-circle"></div>';
            }
            cell.appendChild(mark);
        }
        container.appendChild(cell);
    });
}

function renderBingoCard(data, withFallAnimation) {
    const grid = document.getElementById('bingoGrid');
    renderBingoCellsInto(grid, data, withFallAnimation);
    highlightCompletedLines(data);
    updateBingoNewCardButton(data);
    if(withFallAnimation) {
        setTimeout(() => { playSoundEffect('dora.mp3'); }, 16 * 60 + 300);
    }
}

function highlightCompletedLines(data) {
    const cells = document.querySelectorAll('#bingoGrid .bingo-cell');
    data.completedLines.forEach(lineIdx => {
        BINGO_LINES[lineIdx].forEach(cellIdx => {
            if(cells[cellIdx]) cells[cellIdx].classList.add('line-complete');
        });
    });
}

function checkBingoNewCardNotification() {
    const data = getBingoData();
    if(!data) return;
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - data.createdAt;
    if(elapsed >= oneWeekMs) {
        // 発行可能になった通知は、このカード（createdAtを識別子にする）につき1回だけ送る
        const notifiedKey = 'qr_bingo_notified_' + data.createdAt;
        if(!localStorage.getItem(notifiedKey)) {
            localStorage.setItem(notifiedKey, '1');
            addPostMessage({
                subject: 'ビンゴカード発行のお知らせ',
                body: '新しいビンゴカードが発行可能になりました。',
                image: 'botimage/bot05.png',
                expireMinutesAfterRead: 1440
            });
        }
    }
}

function updateBingoNewCardButton(data) {
    const btn = document.getElementById('bingoNewCardBtn');
    const hint = document.getElementById('bingoNextCardHint');
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - data.createdAt;
    if(elapsed >= oneWeekMs) {
        btn.disabled = false;
        hint.innerText = '';
        checkBingoNewCardNotification();
    } else {
        btn.disabled = true;
        const remainMs = oneWeekMs - elapsed;
        const remainDays = Math.ceil(remainMs / (24*60*60*1000));
        hint.innerText = `次のカードまで あと${remainDays}日`;
    }
}

function confirmNewBingoCard() {
    const data = getBingoData();
    if(!data) return;
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    if(Date.now() - data.createdAt < oneWeekMs) return;
    showCustomConfirm('🆕 新しいカード', '今のビンゴカードの進行状況は無くなります。<br>新しいカードを受け取りますか？', function(){
        const newData = generateNewBingoCard();
        document.getElementById('bingoCardWrap').style.display = 'block';
        renderBingoCard(newData, true);
    });
}

function showBingoToast(text) {
    const toast = document.createElement('div');
    toast.className = 'bingo-toast';
    toast.innerHTML = text;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 350);
    }, 2200);
}

// QRスキャンでアイテム入手した際に呼ぶ：ビンゴカードに該当食材があれば開く
function showBingoPreview(data, highlightIdx, newLineIndices) {
    const overlay = document.getElementById('bingoPreviewOverlay');
    const grid = document.getElementById('bingoPreviewGrid');
    if(!overlay || !grid) return;
    const hasNewLine = newLineIndices && newLineIndices.length > 0;
    renderBingoCellsInto(grid, data, false, highlightIdx, newLineIndices);
    overlay.classList.add('show');
    if(highlightIdx !== undefined && highlightIdx !== null) {
        setTimeout(() => { playSoundEffect('masuaita.mp3'); }, 1000);
    }
    // ビンゴ列が揃った場合は表示時間を延ばし、目立つようにする
    const displayMs = hasNewLine ? 4200 : 3000;
    setTimeout(() => { overlay.classList.remove('show'); }, displayMs);
}

function onItemObtainedForBingo(itemName) {
    const data = getBingoData();
    if(!data) return;
    const idx = data.cardItems.indexOf(itemName);
    if(idx === -1 || data.opened[idx]) return;
    data.opened[idx] = true;

    // 新たに完成したラインを検出
    const newlyCompleted = [];
    BINGO_LINES.forEach((line, lineIdx) => {
        if(data.completedLines.includes(lineIdx)) return;
        if(line.every(cellIdx => data.opened[cellIdx])) newlyCompleted.push(lineIdx);
    });
    newlyCompleted.forEach(lineIdx => data.completedLines.push(lineIdx));

    const isCardComplete = data.opened.every(o => o);
    saveBingoData(data);

    // どのマスが開いたか・どの列が揃ったかを一瞬プレビュー表示（ビンゴモーダルを開かずに）
    showBingoPreview(data, idx, newlyCompleted);

    if(newlyCompleted.length > 0) {
        const reward = newlyCompleted.length * 100;
        playerG += reward;
        const lineWord = newlyCompleted.length > 1 ? `${newlyCompleted.length}列同時` : '1列';
        setTimeout(() => {
            playSoundEffect('omedeto.mp3');
            showBingoToast(`🎉 ビンゴ！${lineWord} +${reward}G`);
        }, 1600);
        if(newlyCompleted.length >= 2) {
            updateStats(s => {
                if(newlyCompleted.length >= 2) s.gotDoubleBingo = true;
                if(newlyCompleted.length >= 3) s.gotTripleBingo = true;
            });
            checkAndRenderAchievements();
        }
        if(data.completedLines.length >= 10 && !data.specialBonusGiven) {
            spicyCoin += 1;
            data.specialBonusGiven = true;
            saveBingoData(data);
            setTimeout(() => showBingoToast('コンプリート！スパイシーコイン+1'), 3000);
            setTimeout(() => showCoinGetOverlay(1), 3500);
        }
        saveGame();
    }
}

function recordPlayerAccess(retryCount) {
    if(isDebugMode || !database) return;
    retryCount = retryCount || 0;
    if(!playerId) {
        // IDがまだ発行中の場合は少し待って再試行（最大10回・5秒）
        if(retryCount < 10) setTimeout(() => recordPlayerAccess(retryCount + 1), 500);
        return;
    }
    const today = getJSTDateString();
    const ref = database.ref('analytics/dailyAccess/' + today + '/' + playerId);
    ref.once('value').then(function(snap){
        if(snap.exists()) return; // 同ID・同日はカウント済み
        ref.set({ name: playerName || '名無しの料理人', ts: Date.now() });
        database.ref('analytics/dailyAccessCount/' + today).transaction(v => (v||0) + 1);
    });
}

function getJSTDateString(baseDate) {
    const now = baseDate || getGameNow();
    // now.getTime()は既にUTC基準の絶対ミリ秒（タイムゾーン補正は不要）。そこにJSTのオフセット+9時間を加えるだけでよい。
    const jstMs = now.getTime() + 9 * 60 * 60000;
    const jst = new Date(jstMs);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(jst.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function setDebugTimeOverride(jstHour, jstMinute) {
    // 入力されたJST時刻（今日の日付）を、UTCエポックミリ秒から直接計算して保存
    const now = new Date();
    // now.getTime()は既にUTC基準の絶対ミリ秒（タイムゾーン補正は不要）
    const jstMsNow = now.getTime() + 9 * 60 * 60000; // 現在のJST時刻に相当するミリ秒
    const jstDateNow = new Date(jstMsNow);
    // JST上での「今日の年月日」はそのまま使い、時刻だけ指定値に変更（UTC関数で操作）
    const jstTargetMs = Date.UTC(
        jstDateNow.getUTCFullYear(), jstDateNow.getUTCMonth(), jstDateNow.getUTCDate(),
        jstHour, jstMinute, 0, 0
    );
    // JST時刻のミリ秒からUTC時刻に戻す（9時間引く）→ これが実際の絶対時刻（エポックミリ秒）
    const actualUtcMs = jstTargetMs - 9 * 60 * 60000;
    localStorage.setItem('qr_debug_time_override', new Date(actualUtcMs).toISOString());
}

function clearDebugTimeOverride() {
    localStorage.removeItem('qr_debug_time_override');
}

// ============================================================
// ランチタイムボーナス（日本時間11:30〜13:30、QR入手アイテム2倍）
// ============================================================
function isLunchtime() {
    const now = getGameNow();
    // now.getTime()は既にUTC基準の絶対ミリ秒（タイムゾーン補正は不要）。そこにJSTのオフセット+9時間を加えるだけでよい。
    const jstMs = now.getTime() + 9 * 60 * 60000;
    const jst = new Date(jstMs);
    const hour = jst.getUTCHours();
    const min = jst.getUTCMinutes();
    const totalMin = hour * 60 + min;
    return totalMin >= (11 * 60 + 30) && totalMin < (13 * 60 + 30);
}

// ============================================================
// クエストタブの案内人キャラクター（ランダム登場）
// ============================================================
const QUEST_GUIDE_IMAGES = [
    'annainin/con1-1.png',
    'annainin/con1-2.png',
    'annainin/con1-3.png',
    'annainin/con1-4.png',
    'annainin/con1-5.png'
];
const FRIDGE_GUIDE_IMAGES = [
    'annainin/con2-1.png',
    'annainin/con2-2.png',
    'annainin/con2-3.png',
    'annainin/con2-4.png',
    'annainin/con2-5.png'
];
const COOK_GUIDE_IMAGES = [
    'annainin/con3-1.png',
    'annainin/con3-2.png',
    'annainin/con3-3.png',
    'annainin/con3-4.png',
    'annainin/con3-5.png'
];
const BATTLE_GUIDE_IMAGES = [
    'annainin/con4-1.png',
    'annainin/con4-2.png',
    'annainin/con4-3.png',
    'annainin/con4-4.png',
    'annainin/con4-5.png'
];

function isGuideCharSnoozed() {
    const until = parseInt(localStorage.getItem('qr_guide_snooze_until') || '0', 10);
    return Date.now() < until;
}

function snoozeGuideChar() {
    const until = Date.now() + 30 * 60 * 1000; // 30分後まで非表示
    localStorage.setItem('qr_guide_snooze_until', String(until));
    const label = document.getElementById('questGuideSnoozeLabel');
    if(label) {
        label.style.display = 'block';
        setTimeout(() => { label.style.display = 'none'; }, 1500);
    }
    setTimeout(() => { hideQuestGuideChar(); }, 600);
    updateStats(s => { s.guideCharSnoozed = true; });
    checkAndRenderAchievements();
}

// 調理タブの案内人（con3-3.png）専用セリフ
const COOK_CHEF_LINES = [
    "毒と言えば紫だ!\nあと芽を取らないと危険なのもいるよな!",
    "幻惑はぴゃーって目眩しするか\n幻覚見せるっきゃないよな!",
    "種をたくさん入れろ!\nそしてたくさん撃て!",
    "幼い頃の心を忘れるな!\n好きなもの詰め合わせだ!",
    "彩豊かなラタトゥイユでだ!\n何が入ってる!？",
    "バッターボックスに立て!\nバットで撃ち返すんだ!",
    "もうあれとあれ入れたたらピザよ!\nピザも美味いよな!",
    "波の音聴きたきゃ\n波が似合う奴らを詰め込め!",
    "やっぱ3匹いないとな!\nワラと木とレンガだ!"
];

function setupGuideCharLongPress() {
    const wrap = document.getElementById('questGuideChar');
    if(!wrap) return;
    let pressTimer = null;
    let longPressed = false;

    // iOS/Androidで画像長押し時に出る「画像を保存」等のメニューを防止
    wrap.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    wrap.addEventListener('dragstart', function(e) { e.preventDefault(); });

    function isCookChefShowing() {
        const img = document.getElementById('questGuideImg');
        return img && img.getAttribute('src') === 'annainin/con3-3.png';
    }

    function showCookChefSpeech() {
        const bubble = document.getElementById('cookGuideSpeechBubble');
        if(!bubble) return;
        const line = COOK_CHEF_LINES[Math.floor(Math.random() * COOK_CHEF_LINES.length)];
        bubble.innerText = line;
        bubble.classList.add('show');
    }
    function hideCookChefSpeech() {
        const bubble = document.getElementById('cookGuideSpeechBubble');
        if(bubble) bubble.classList.remove('show');
    }

    function startPress(e) {
        longPressed = false;
        if(isCookChefShowing()) {
            showCookChefSpeech(); // 押している間は吹き出しを表示、長押しスヌーズは発動させない
            return;
        }
        pressTimer = setTimeout(() => {
            longPressed = true;
            snoozeGuideChar();
        }, 600); // 600ms長押しでスヌーズ
    }
    function cancelPress() {
        if(pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    }
    function handleTap() {
        if(isCookChefShowing()) {
            hideCookChefSpeech();
            hideQuestGuideChar(); // タップを離したら通常通り引っ込む
            return;
        }
        if(longPressed) { longPressed = false; return; } // 長押し直後のタップは無視
        hideQuestGuideChar();
    }

    wrap.addEventListener('touchstart', startPress, { passive: true });
    wrap.addEventListener('touchend', function() { cancelPress(); handleTap(); }, { passive: true });
    wrap.addEventListener('touchcancel', cancelPress, { passive: true });
    wrap.addEventListener('mousedown', startPress);
    wrap.addEventListener('mouseup', function() { cancelPress(); handleTap(); });
    wrap.addEventListener('mouseleave', function() { cancelPress(); hideCookChefSpeech(); });
}

function showGuideChar(imageSet) {
    if(isGuideCharSnoozed()) return; // 30分以内にスヌーズされていたら表示しない
    const wrap = document.getElementById('questGuideChar');
    const img = document.getElementById('questGuideImg');
    if(!wrap || !img) return;
    const pick = imageSet[Math.floor(Math.random() * imageSet.length)];

    if(wrap.classList.contains('show')) {
        // すでに表示中（別タブのキャラ）→ 先に引っ込めてから新しいキャラを出す
        wrap.classList.remove('show');
        setTimeout(() => {
            img.src = pick;
            wrap.style.display = 'block';
            void wrap.offsetWidth; // reflow強制
            requestAnimationFrame(() => { wrap.classList.add('show'); });
        }, 500);
    } else {
        // 非表示状態から新規に登場
        img.src = pick;
        wrap.style.display = 'block';
        wrap.classList.remove('show');
        void wrap.offsetWidth; // reflow強制
        requestAnimationFrame(() => { wrap.classList.add('show'); });
    }
}

function showQuestGuideChar() { showGuideChar(QUEST_GUIDE_IMAGES); }
function showFridgeGuideChar() { showGuideChar(FRIDGE_GUIDE_IMAGES); }
function showCookGuideChar() { showGuideChar(COOK_GUIDE_IMAGES); }
function showBattleGuideChar() { showGuideChar(BATTLE_GUIDE_IMAGES); }

function hideQuestGuideChar() {
    const wrap = document.getElementById('questGuideChar');
    if(!wrap) return;
    wrap.classList.remove('show');
    setTimeout(() => { wrap.style.display = 'none'; }, 500);
}

function updateLunchtimeBanner() {
    const banner = document.getElementById('lunchtimeBanner');
    if(!banner) return;
    banner.style.display = isLunchtime() ? 'block' : 'none';
}

function checkEventBannerVisibility() {
    const btn = document.getElementById('eventBannerBtn');
    const banner = document.getElementById('eventBannerImg');
    if(!btn || !banner) return;

    const unlocked = isEventModeUnlocked();
    const enabled = eventEnabled || isDebugMode;

    // 常に表示。未解放・終了時はグレーアウト（他の対戦ボタンと統一）
    btn.style.display = 'block';
    if(unlocked && enabled) {
        btn.classList.remove('battle-mode-locked');
        btn.onclick = function(){ startEventBattle(); };
    } else {
        btn.classList.add('battle-mode-locked');
        btn.onclick = unlocked
            ? function(){ showCustomAlert("⚠️ イベント終了", "このイベントは現在開催されていません。"); }
            : function(){ showLockedModeAlert(); };
    }

    const replayBtn = document.getElementById('eventReplayBtn');
    if(replayBtn) {
        const hasWatched = localStorage.getItem('qr_event_movie_watched') === '1';
        replayBtn.style.display = (unlocked && enabled && hasWatched) ? 'block' : 'none';
    }
    const infoBtn = document.getElementById('eventInfoBtn');
    if(infoBtn) infoBtn.style.display = (unlocked && enabled) ? 'block' : 'none';
}

function showEventInfo() {
    const msg = '<div style="text-align:left;font-size:13px;line-height:1.8;color:#420000;">'
        + '試験的にイベントを実施します！<br>'
        + '特盛りモンスターが街にやってきた！<br>'
        + 'みんなで協力して討伐しよう！<br><br>'
        + '特盛りモンスターは一人では倒せないくらい強いので、全プレイヤーでじわじわHPを削って行きましょう！<br><br>'
        + '勝っても負けても報酬で調理1回分のアイテム（食材3つとスパイス1つ）をお返しします！<br><br>'
        + 'イベント終了後に与えた総ダメージでランキング発表<br>'
        + '上位のプレイヤーには特典や報酬があるかも！？<br><br>'
        + '本来ならイベント期間や、報酬を先に発表すべきなのですが<br>'
        + '今回はテストイベントなのでまだ未定です！<br><br>'
        + 'みんなどしどしチャレンジしてみてね！'
        + '</div>';
    showCustomAlert('【特盛りモンスターから街を守れ！】', msg);
}

function showTagBattleInfo() {
    const msg = '<div style="text-align:left;font-size:13px;line-height:1.8;color:#420000;">'
        + '<b>【タッグ戦】</b><br>'
        + '2vs2のタッグ戦です。<br>'
        + 'マッチング画面で好きな宅配カレーを選択し、一緒に出撃しましょう！<br>'
        + '宅配カレーは全プレイヤーの宅配カレーからランダムで3つ表示されます。<br>'
        + '3つの宅配カレーを全部使い切ると再び3つ補充されます！<br><br>'
        + '<b>【宅配カレー】</b><br>'
        + '冷蔵庫でカレーストックの中から1つを宅配カレーに設定できます！<br>'
        + '宅配カレーに設定したカレーは対戦で使用することができなくなりますが、<br>'
        + '他のプレイヤーのタッグ戦で宅配カレーとして登場します！<br>'
        + '他のプレイヤーに宅配カレーが使われるとログイン時に報酬がもらえるよ！<br>'
        + '宅配カレーは5回使用されると食べ尽くされちゃうのでまた設定してね！'
        + '</div>';
    showCustomAlert('【タッグ戦・宅配カレーとは？】', msg);
}
function showFestInfo() {
    const msg = '<div style="text-align:left;font-size:13px;line-height:1.8;color:#420000;">'
        + '※まだまだバランス調整などありますので。突然の仕様変更などもございます。ご了承ください。<br><br>'
        + '参加料：600G<br><br>'
        + 'フェス専用の食材・カレーストックを使って連戦に挑むコンテンツです。<br>'
        + 'フェス内で入手した食材やカレーはフェス終了時に消滅します。<br><br>'
        + '<b>●フェス開始支給品：80FP、食材3つ、スパイス1つ</b><br>'
        + 'FPはフェス内での通過です。<br>'
        + 'FPはボスを倒しても10FP支給されます。<br><br>'
        + '<b>●ショップ</b><br>'
        + 'FPを使って食材などアイテムを入手できます。<br><br>'
        + '<b>●調理</b><br>'
        + 'フェス内で入手した食材を使って調理ができます。<br><br>'
        + '<b>●仲間</b><br>'
        + 'カレーの詳細確認、装備品の変更ができます。<br>'
        + '「仲間を雇う」で討伐済みのキャラクターを雇うことができます。<br>'
        + '経験スパイスを使用することで育成も可能です。<br>'
        + '仲間は1人しか雇えません。<br>'
        + '新しく仲間を雇った場合は入れ替えとなります。<br><br>'
        + '<b>●進む</b><br>'
        + 'バトルに進みます。<br>'
        + '通常戦3戦→ボス戦→準備画面を繰り返します。<br>'
        + '連戦が進むにつれ、敵が強くなりますが、報酬も多くなります。<br>'
        + 'フェスのバトルでは出撃カレーのHPが0になってもストックカレーがある場合は、次のカレーを出撃させることができます。<br><br>'
        + '<b>●フェス終了</b><br>'
        + '「撤退」または「敗北」するとフェス終了です。<br>'
        + '連勝数に応じた報酬が手に入ります。'
        + '</div>';
    showCustomAlert('【カレーフェスとは？】', msg);
}

function playEventMovie(onFinishCallback) {
    const overlay = document.getElementById('eventMovieOverlay');
    const video = document.getElementById('eventMovieVideo');
    if(!overlay || !video) { onFinishCallback(); return; }
    let finished = false;
    function finishOnce() {
        if(finished) return;
        finished = true;
        overlay.style.display = 'none';
        video.pause();
        video.currentTime = 0;
        video.onended = null;
        onFinishCallback();
    }
    video.muted = isMuted;
    video.currentTime = 0;
    overlay.style.display = 'flex';
    video.onended = finishOnce;
    window.__skipEventMovie = finishOnce;
    video.play().catch(() => { finishOnce(); });
}

function skipEventMovie() {
    if(window.__skipEventMovie) window.__skipEventMovie();
}

function replayEventMovie() {
    playEventMovie(() => {});
}

function startEventBattle() {
    if (!hasUsableCurryForBattle()) { alertNoUsableCurry(); return; }
    if (!eventEnabled && !isDebugMode) { showCustomAlert("⚠️ イベント終了", "このイベントは現在開催されていません。"); return; }
    if (!isEventModeUnlocked()) { showLockedModeAlert(); return; }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const hasWatched = localStorage.getItem('qr_event_movie_watched') === '1';
    if(!hasWatched) {
        playEventMovie(() => {
            localStorage.setItem('qr_event_movie_watched', '1');
            checkEventBannerVisibility();
            showEventVsScreen();
        });
    } else {
        showEventVsScreen();
    }
}

function showEventVsScreen() {
    isBotMatch = true; currentRoomId = null;
    eventTotalDamageThisBattle = 0;

    const oppCurryData = {
        name: "", visual: "", emoji: "",
        hp: EVENT_MONSTER_DATA.hp, atk: EVENT_MONSTER_DATA.atk, def: EVENT_MONSTER_DATA.def, spd: EVENT_MONSTER_DATA.spd,
        isEventBoss: true, isBotImage: false
    };
    activeBotData = { expBonus: 0, image: "" };
    cachedOpponentName = EVENT_MONSTER_DATA.name;
    cachedOpponentCurry = oppCurryData;

    const vs = document.getElementById("vsCutIn"); vs.style.display = "flex"; playVsSound();
    const vsInteractiveBot = vs ? vs.querySelector('.vs-interactive-area') : null;
    if(vsInteractiveBot) vsInteractiveBot.style.display = "block";
    document.getElementById("vsPlayerName").innerText = playerName;
    if (typeof repopulateVsCurrySelector === "function") repopulateVsCurrySelector();
    document.getElementById("vsEnemyName").innerText = EVENT_MONSTER_DATA.name;
    document.getElementById("vsEnemyVisual").innerHTML = `<div style="width:100%;height:100%;background:#111;border-radius:50%;display:flex;align-items:center;justify-content:center;"><span style="color:#e74c3c;font-size:48px;font-weight:bold;">？</span></div>`;
    document.getElementById("vsEnemyCurry").innerText = "";
    document.getElementById("vsPlayerVisual").innerHTML = `<img src="${currentIconFile}" style="width:100px;height:100px;border-radius:50%;border:3px solid #e67e22;object-fit:cover;">`;
    setTimeout(() => { document.getElementById("vsPlayerSide").style.transform = "translateX(0)"; }, 100);
    setTimeout(() => { document.getElementById("vsEnemySide").style.transform = "translateX(0)"; }, 300);
    setTimeout(() => { document.getElementById("vsBadge").style.opacity = "1"; document.getElementById("vsBadge").style.scale = "1"; }, 600);
}

// ============================================================
// タッグ戦
// ============================================================
let tagBattleEnemies = []; // 今回のタッグ戦の敵2人
let tagBattleDeliveryCandidates = []; // 宅配カレー選択肢（残り、最大3つ）
let tagBattleSelectedDeliveryIdx = -1; // 選択中の宅配カレーのインデックス（tagBattleDeliveryCandidates内）

// 宅配カレーの抽選プールをlocalStorageで永続管理（3つ使い切るまで再抽選しない）
function getTagDeliveryPool() {
    const d = localStorage.getItem('qr_tag_delivery_pool');
    if(!d) return null;
    const pool = JSON.parse(d);
    // 古い形式のアイコンパスが残っている場合に備えて変換する
    pool.forEach(cand => { if(cand.playerIcon) cand.playerIcon = migrateIconPath(cand.playerIcon); });
    return pool;
}
function saveTagDeliveryPool(pool) {
    localStorage.setItem('qr_tag_delivery_pool', JSON.stringify(pool));
}
function clearTagDeliveryPool() {
    localStorage.removeItem('qr_tag_delivery_pool');
}

function startTagBattle() {
    if (!hasUsableCurryForBattle()) { alertNoUsableCurry(); return; }
    if (!isTagModeUnlocked()) { showLockedModeAlert(); return; }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playVsSound();

    // 敵2人をランダム選出（重複なし）
    const shuffledBots = [...tagBattleBotPool].sort(() => Math.random() - 0.5);
    tagBattleEnemies = shuffledBots.slice(0, 2);

    tagBattleSelectedDeliveryIdx = -1;
    renderTagEnemyList();
    populateTagMyCurrySelect();
    document.getElementById('tagDeployBtn').disabled = true;
    document.getElementById('tagDeliveryList').innerHTML = '<div style="color:#999;font-size:12px;text-align:center;padding:10px;">宅配カレーを読み込み中...</div>';

    const enemyWrap = document.getElementById('tagMatchEnemyWrap');
    const playerWrap = document.getElementById('tagMatchPlayerWrap');
    enemyWrap.classList.remove('slide-in');
    playerWrap.classList.remove('slide-in');

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tagMatchFullscreen').classList.add('active');
    hideQuestGuideChar();

    setTimeout(() => { enemyWrap.classList.add('slide-in'); }, 100);
    setTimeout(() => { playerWrap.classList.add('slide-in'); }, 300);

    const existingPool = getTagDeliveryPool();
    if(existingPool && existingPool.length > 0) {
        // 既に抽選済みで未使用分が残っている場合はそれを使う（再抽選しない）
        tagBattleDeliveryCandidates = existingPool;
        renderTagDeliveryList();
    } else {
        fetchTagDeliveryCandidates(3, function(candidates) {
            tagBattleDeliveryCandidates = candidates;
            saveTagDeliveryPool(candidates);
            renderTagDeliveryList();
        });
    }
}

// ===== PC戦（初級・中級）進行状況モーダル =====
function openBotProgressModal(difficulty) {
    const isHard = difficulty === 'hard';
    const cleared = isHard ? isHardCleared() : isEasyCleared();
    // クリア済みなら進行状況モーダルを経由せず、今まで通り直接マッチング（通常仕様）を開始する
    if(cleared) {
        if(isHard) startHardBotBattle(); else startBotBattle();
        return;
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('botProgressFullscreen').classList.add('active');
    hideQuestGuideChar();
    renderBotProgressModal(difficulty);
}
function closeBotProgressModal() {
    document.getElementById('botProgressFullscreen').classList.remove('active');
    const battleTab = document.querySelector('[onclick*="battle"]');
    const battlePage = document.getElementById('pageBattle');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if(battleTab) battleTab.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    if(battlePage) battlePage.classList.add('active');
}
// 進行状況に応じた画面内容を組み立てる
function renderBotProgressModal(difficulty) {
    const isHard = difficulty === 'hard';
    const list = isHard ? hardBotOpponents : botOpponents;
    const progress = isHard ? getHardProgress() : getEasyProgress();
    const s = getStats();
    const defeatedList = isHard ? (s.defeatedHardBots || []) : (s.defeatedBots || []);

    document.getElementById('botProgressTitle').innerText = isHard ? 'PCと対戦（中級）' : 'PCと対戦（初級）';
    const body = document.getElementById('botProgressBody');

    if(!hasUsableCurryForBattle()) {
        body.innerHTML = '<div style="text-align:center; padding:30px 10px; color:#888; font-size:13px;">使用できるカレーがありません。<br>まずは冷蔵庫で食材を集めて調理しましょう。</div>';
        return;
    }

    let html = '';
    const currentBot = list[progress];
    html += `<div style="text-align:center; padding:10px;">`;
    html += `<div style="font-size:13px; color:#efdeb1; font-weight:bold; margin-bottom:10px;">挑戦中の相手</div>`;
    html += `<img src="${currentBot.image}" style="width:120px; height:120px; border-radius:50%; border:3px solid #b88742; object-fit:cover; background:#1a1a1a;">`;
    html += `<div style="font-size:15px; color:#efdeb1; font-weight:bold; margin:10px 0 4px 0;">${currentBot.name}</div>`;
    html += `<button class="tutorial-nav-btn" style="width:100%; margin-top:10px; background:#e67e22;" onclick="closeBotProgressModal(); launchSpecificBotBattle('${isHard ? 'hard' : 'easy'}', ${progress});">⚔️ 敵と対戦する</button>`;
    html += `</div>`;

    if(defeatedList.length > 0) {
        html += `<div style="border-top:1px solid #6b5a3f; margin-top:16px; padding-top:16px;">`;
        html += `<div style="font-size:13px; color:#efdeb1; font-weight:bold; margin-bottom:10px; text-align:center;">討伐済みの敵</div>`;
        html += `<div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-bottom:14px;">`;
        defeatedList.forEach(name => {
            const b = list.find(x => x.name === name);
            if(!b) return;
            html += `<div style="text-align:center; width:64px;"><img src="${b.image}" style="width:56px; height:56px; border-radius:50%; border:2px solid #b88742; object-fit:cover; background:#1a1a1a;"><div style="font-size:9px; color:#efdeb1; margin-top:2px; line-height:1.2;">${b.name}</div></div>`;
        });
        html += `</div>`;
        html += `<button class="tutorial-nav-btn" style="width:100%; background:#3498db;" onclick="closeBotProgressModal(); launchDefeatedBotBattle('${isHard ? 'hard' : 'easy'}');">討伐済みの敵と対戦</button>`;
        html += `</div>`;
    }

    body.innerHTML = html;
}
// 進行状況に応じて、特定のBot（list[index]）と対戦を開始する
function launchSpecificBotBattle(difficulty, index) {
    if (!hasUsableCurryForBattle()) { alertNoUsableCurry(); return; }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isBotMatch = true; currentRoomId = null;
    const isHard = difficulty === 'hard';
    const list = isHard ? hardBotOpponents : botOpponents;
    const bot = list[index];
    if(!bot) return;
    const oppCurryData = {
        name: isHard ? bot.curryName : rTrimHtml(bot.curryName), visual: bot.image, emoji: bot.emoji,
        hp: bot.hp, atk: bot.atk, def: bot.def, spd: bot.spd,
        isBotImage: true, isHardBot: isHard,
        isIllusion: bot.specialEffect === 'illusion',
        isSeed:     bot.specialEffect === 'seed',
        isBreath:   bot.specialEffect === 'breath',
        isPoison:   bot.specialEffect === 'poison',
        foodCategory: bot.foodCategory
    };
    activeBotData = bot;
    launchVsCutIn(bot.name, bot.image, oppCurryData);
}
// 討伐済みのBotリストからランダムに1体選んで対戦を開始する（「討伐済みの敵と対戦」ボタン用）
function launchDefeatedBotBattle(difficulty) {
    if (!hasUsableCurryForBattle()) { alertNoUsableCurry(); return; }
    const isHard = difficulty === 'hard';
    const list = isHard ? hardBotOpponents : botOpponents;
    const s = getStats();
    const defeatedNames = isHard ? (s.defeatedHardBots || []) : (s.defeatedBots || []);
    const candidates = list.filter(b => defeatedNames.includes(b.name));
    if(candidates.length === 0) return;
    const idx = list.indexOf(candidates[Math.floor(Math.random() * candidates.length)]);
    launchSpecificBotBattle(difficulty, idx);
}

function closeTagMatchModal() {
    document.getElementById('tagMatchFullscreen').classList.remove('active');
    const battleTab = document.querySelector('[onclick*="battle"]');
    const battlePage = document.getElementById('pageBattle');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if(battleTab) battleTab.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    if(battlePage) battlePage.classList.add('active');
}

function renderTagEnemyList() {
    const wrap = document.getElementById('tagEnemyList');
    wrap.innerHTML = '';
    tagBattleEnemies.forEach(bot => {
        const card = document.createElement('div');
        card.className = 'tag-match-enemy-card';
        card.innerHTML = `<img class="tag-enemy-icon" src="${bot.image}" alt="${bot.name}">`
            + `<div class="tag-enemy-info"><div class="tag-enemy-name">${bot.name}</div><div class="tag-enemy-curry">${bot.emoji || ''} ${bot.curryName}</div></div>`;
        wrap.appendChild(card);
    });
}

function populateTagMyCurrySelect() {
    const sel = document.getElementById('tagMyCurrySelect');
    sel.innerHTML = '';
    curryStock.forEach((c, idx) => {
        if(c.isDelivering) return;
        const opt = document.createElement('option');
        opt.value = idx; opt.innerText = c.name;
        sel.appendChild(opt);
    });
    updateTagMatchPreview();
}

function updateTagMatchPreview() {
    const sel = document.getElementById('tagMyCurrySelect');
    const statusBox = document.getElementById('tagMyCurryStatus');
    const idx = parseInt(sel.value, 10);
    const curry = curryStock[idx];
    if(curry) {
        statusBox.style.display = 'grid';
        statusBox.innerHTML = `<div>HP: ${statDisplayWithTableware('hp', curry.hp)}</div><div>ATK: ${statDisplayWithTableware('atk', curry.atk)}</div><div>DEF: ${statDisplayWithTableware('def', curry.def)}</div><div>SPD: ${statDisplayWithTableware('spd', curry.spd)}</div>`;
    } else {
        statusBox.style.display = 'none';
    }
    updateTagDeployButtonState();
}

function renderTagDeliveryList() {
    const wrap = document.getElementById('tagDeliveryList');
    wrap.innerHTML = '';
    if(tagBattleDeliveryCandidates.length === 0) {
        wrap.innerHTML = '<div style="color:#999;font-size:12px;text-align:center;padding:10px;">宅配カレーが見つかりませんでした。</div>';
        return;
    }
    tagBattleDeliveryCandidates.forEach((cand, idx) => {
        const card = document.createElement('div');
        card.className = 'tag-delivery-card';
        const curryImg = getCurryImage(cand.curry);
        card.innerHTML = `<img class="tag-delivery-icon" src="${cand.playerIcon}" alt="">`
            + `<img class="tag-delivery-curry-img" src="${curryImg}" alt="">`
            + `<div class="tag-delivery-info"><div class="tag-delivery-player">${cand.playerName}</div><div class="tag-delivery-curryname">${cand.curry.name}</div></div>`
            + `<button class="tag-delivery-detail-btn" onclick="event.stopPropagation();showTagDeliveryDetail(${idx})">詳細</button>`;
        card.onclick = function() { selectTagDeliveryCandidate(idx); };
        wrap.appendChild(card);
    });
}

function selectTagDeliveryCandidate(idx) {
    const cand = tagBattleDeliveryCandidates[idx];
    if(!cand) return;
    if(cand.isDummy) {
        // ダミーキャラの宅配カレーは常に存在するとみなしてよい
        finalizeTagDeliverySelection(idx);
        return;
    }
    if(!database) { finalizeTagDeliverySelection(idx); return; }
    database.ref('deliveryCurries/' + cand.playerId).once('value').then(function(snap){
        if(!snap.exists()) {
            // 先に誰かに食べられてしまった（上書き・食べ尽くされ）
            showCustomAlert("⚠️ 残念", "残念ながらこのカレーは先に誰かに食べられてしまったようだ。", function(){
                consumeTagDeliveryCandidate(idx);
            });
        } else {
            finalizeTagDeliverySelection(idx);
        }
    }).catch(function(){
        finalizeTagDeliverySelection(idx);
    });
}

function finalizeTagDeliverySelection(idx) {
    tagBattleSelectedDeliveryIdx = idx;
    document.querySelectorAll('#tagDeliveryList .tag-delivery-card').forEach((el, i) => {
        el.classList.toggle('selected', i === idx);
    });
    updateTagDeployButtonState();
}

// 食べられてしまった候補をプールから消費（消す）。3つ全部消費したら次回新規抽選になる
function consumeTagDeliveryCandidate(idx) {
    tagBattleDeliveryCandidates.splice(idx, 1);
    if(tagBattleDeliveryCandidates.length === 0) {
        clearTagDeliveryPool();
    } else {
        saveTagDeliveryPool(tagBattleDeliveryCandidates);
    }
    tagBattleSelectedDeliveryIdx = -1;
    renderTagDeliveryList();
    updateTagDeployButtonState();
}

function updateTagDeployButtonState() {
    const sel = document.getElementById('tagMyCurrySelect');
    const hasMyCurry = sel && sel.value !== '' && sel.options.length > 0;
    const hasDelivery = tagBattleSelectedDeliveryIdx !== -1;
    document.getElementById('tagDeployBtn').disabled = !(hasMyCurry && hasDelivery);
}

function showTagDeliveryDetail(idx) {
    const cand = tagBattleDeliveryCandidates[idx];
    if(!cand) return;
    const curry = cand.curry;
    const typeImg = getCurryImage(curry);
    const typeLabel = CURRY_TYPE_LABELS[curry.curryType] || 'バランス型';
    const iconsHtml = curryIconsHTML(curry.materials, curry.spice, '24px');
    const skills = getCurrySkills(curry);
    let skillsHtml = '';
    if(skills.length > 0) {
        skillsHtml = skills.map(s => `<div style="margin-top:8px;"><b style="color:#e67e22;">${s.name}</b><br><span style="font-size:12px;">${s.desc}</span></div>`).join('');
    }
    const html = `<img src="${cand.playerIcon}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid #b88742;display:block;margin:0 auto 6px;">`
        + `<div style="font-weight:bold;color:#420000;margin-bottom:2px;">${cand.playerName}</div>`
        + `<div style="font-size:10px;color:#999;margin-bottom:10px;">${cand.playerId}</div>`
        + `<img src="${typeImg}" style="width:80px;height:80px;object-fit:contain;display:block;margin:0 auto 10px;">`
        + `<div style="font-weight:bold;color:#c0392b;margin-bottom:4px;">${typeLabel}</div>`
        + `<div style="display:flex;justify-content:center;gap:4px;margin-bottom:8px;">${iconsHtml}</div>`
        + `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px;font-weight:bold;color:#420000;margin-bottom:6px;">`
        + `<div>HP: ${curry.hp}</div><div>ATK: ${curry.atk}</div><div>DEF: ${curry.def}</div><div>SPD: ${curry.spd}</div>`
        + `</div>`
        + skillsHtml;
    showCustomAlert(curry.name, html);
}

function confirmTagDeploy() {
    const myCurryIdx = parseInt(document.getElementById('tagMyCurrySelect').value, 10);
    const myCurry = curryStock[myCurryIdx];
    const deliveryCand = tagBattleDeliveryCandidates[tagBattleSelectedDeliveryIdx];
    if(!myCurry || !deliveryCand) return;
    // 出撃と同時に、選んだ宅配カレーをプールから消費（3つ使い切るまで再抽選しない仕様のため）
    consumeTagDeliveryCandidate(tagBattleSelectedDeliveryIdx);
    document.getElementById('tagMatchFullscreen').classList.remove('active');
    // タッグ戦アリーナはpageBattle内にあるため、対戦タブをアクティブにしてから表示する
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const battleTab = document.querySelector('[onclick*="battle"]');
    if(battleTab) battleTab.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const battlePage = document.getElementById('pageBattle');
    if(battlePage) battlePage.classList.add('active');
    // バトル開始処理
    if(typeof launchTagBattle === 'function') {
        launchTagBattle(myCurry, deliveryCand, tagBattleEnemies);
    }
}

// ============================================================
// タッグ戦バトル本体
// ============================================================
let tagBattleAborted = false;
let battleSpeedMultiplier = 1; // 1=通常速度、0.5=2倍速、0.25=4倍速（全バトル共通）
function tagDelay(ms) { return Math.round(ms * battleSpeedMultiplier); }
function battleDelay(ms) { return Math.round(ms * battleSpeedMultiplier); }
function setBattleSpeed(mult) {
    battleSpeedMultiplier = mult;
    const suffix = mult === 1 ? '1' : (mult === 0.5 ? '2' : '4');
    document.querySelectorAll('.tag-speed-btn').forEach(b => b.classList.remove('active'));
    const ids = ['tagSpeedBtn' + suffix, 'normalSpeedBtn' + suffix, 'settingsSpeedBtn' + suffix, 'festSpeedBtn' + suffix];
    ids.forEach(id => { const btn = document.getElementById(id); if(btn) btn.classList.add('active'); });
}
let tagBattleFighters = []; // [自分, 宅配カレー, 敵1, 敵2] の4要素
let tagStickyFirstSide = null; // ネバネバ効果でどちらが先攻になるか（'player' / 'enemy' / null）

// 対戦結果ボックスが画面内（ブラウザの操作バー等と重ならない範囲）に収まるよう自動スクロールする
function scrollResultIntoView(elementId) {
    const el = document.getElementById(elementId);
    if(!el) return;
    setTimeout(() => {
        const rect = el.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        // 結果ボックスの下端が画面下端から60px以上の余白を持つように調整
        const margin = 60;
        if(rect.bottom > viewportHeight - margin || rect.top < 0) {
            const scrollOffset = rect.bottom - (viewportHeight - margin);
            window.scrollBy({ top: scrollOffset, behavior: 'smooth' });
        }
    }, 100);
}

// Spicy Hit（会心＝color:'#ff4500'）の場合は、PCとの対戦（triggerEffect関数）と同じ
// 「Spicy Hit!!!!!!!!」文字演出・画面フラッシュ（flash-crit）・専用SE（spicyhit.mp3）を追加する
function tagTriggerDamagePop(targetSide, targetIdx, value, color) {
    const pop = document.getElementById('tagDamagePop');
    if(!pop) return;
    const targetEl = targetSide === 'enemy' ? document.getElementById('tagEnemyCard' + targetIdx) : document.getElementById('tagPlayerCard' + targetIdx);
    if(!targetEl) return;
    const stage = document.getElementById('tagBattleStage');
    const stageRect = stage.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    // ステージの外にはみ出さないよう、カード内側の上部に表示位置を収める（popUpアニメーションで最大45px上に動くため余裕を持たせる）
    let topPos = targetRect.top - stageRect.top + 4;
    if(topPos < 50) topPos = 50;
    const isCrit = (color === '#ff4500');
    pop.style.left = (targetRect.left - stageRect.left + targetRect.width/2 - 20) + 'px';
    pop.style.top = topPos + 'px';
    pop.className = 'tag-damage-pop';
    if(isCrit) {
        pop.innerHTML = '<div class="crit-label">Spicy Hit!!!!!!!!</div><div class="crit-dmg">' + (value > 0 ? '' : '+') + Math.abs(value) + '</div>';
    } else {
        pop.innerText = (value > 0 ? '' : '+') + Math.abs(value);
    }
    pop.style.color = color || '#f1c40f';
    pop.style.display = 'block';
    pop.style.animation = 'none';
    void pop.offsetWidth;
    pop.style.animation = isCrit ? 'critPopUp 0.9s forwards' : 'popUp 0.7s forwards';
    setTimeout(() => { pop.style.display = 'none'; }, isCrit ? 900 : 700);
    if(isCrit) {
        playSoundEffect('spicyhit.mp3');
        if(stage) {
            stage.classList.remove('flash-crit');
            void stage.offsetWidth;
            stage.classList.add('flash-crit');
            setTimeout(() => stage.classList.remove('flash-crit'), 350);
        }
    }
    targetEl.style.transform = 'translateX(-4px)';
    setTimeout(() => { targetEl.style.transform = 'translateX(4px)'; }, 60);
    setTimeout(() => { targetEl.style.transform = ''; }, 120);
}

function tagUpdateAllHpDisplays() {
    [0,1].forEach(i => {
        const f = tagBattleFighters[i]; // 自分側
        const bar = document.getElementById('tagPlayerHpBar' + i);
        const text = document.getElementById('tagPlayerHpText' + i);
        const card = document.getElementById('tagPlayerCard' + i);
        if(f && bar && text) {
            const pct = Math.max(0, f.hp / f.maxHp * 100);
            bar.style.width = pct + '%';
            bar.classList.toggle('danger', pct <= 30);
            text.innerText = 'HP: ' + Math.max(0, f.hp) + '/' + f.maxHp;
            if(card) card.classList.toggle('ko', f.hp <= 0);
        }
    });
    [0,1].forEach(i => {
        const f = tagBattleFighters[i+2]; // 敵側
        const bar = document.getElementById('tagEnemyHpBar' + i);
        const text = document.getElementById('tagEnemyHpText' + i);
        const card = document.getElementById('tagEnemyCard' + i);
        if(f && bar && text) {
            const pct = Math.max(0, f.hp / f.maxHp * 100);
            bar.style.width = pct + '%';
            bar.classList.toggle('danger', pct <= 30);
            text.innerText = 'HP: ' + Math.max(0, f.hp) + '/' + f.maxHp;
            if(card) card.classList.toggle('ko', f.hp <= 0);
        }
    });
}

// 既存の通常戦闘と同様、1アクションごとにログを上書きする（蓄積させない）
let tagBattleLogHistory = []; // タッグ戦の戦闘ログ蓄積用
function tagLogSet(text) {
    const log = document.getElementById('tagBattleLog');
    if(log) {
        // 直前のログ内容を履歴に保存してから新しい内容に切り替える
        if(log.innerHTML) tagBattleLogHistory.push(log.innerHTML);
        log.innerHTML = text;
    }
}
function tagLogAppend(text) {
    const log = document.getElementById('tagBattleLog');
    if(log) log.innerHTML += (log.innerHTML ? '\n' : '') + text;
}
function showTagBattleLogHistory() {
    const allLogs = tagBattleLogHistory.concat(document.getElementById('tagBattleLog') ? [document.getElementById('tagBattleLog').innerHTML] : []);
    if(allLogs.length === 0) {
        showCustomAlert("📜 戦闘ログ", "ログがありません。");
        return;
    }
    const rows = allLogs.map(function(entry) {
        const lines = entry.split("\n").filter(function(l){ return l.trim() !== ""; }).join("<br>");
        return '<div style="padding:8px 0;border-bottom:1px solid #e0d0b0;font-size:12px;color:#420000;text-align:left;line-height:1.6;">' + lines + '</div>';
    }).join('');
    showCustomAlert("📜 戦闘ログ", '<div style="max-height:55vh;overflow-y:auto;text-align:left;">' + rows + '</div>');
}

// 生存している敵（自分側 or 敵側）からランダムに1人選ぶ
function tagPickRandomAliveTarget(fighters) {
    const alive = fighters.filter(f => f.hp > 0);
    if(alive.length === 0) return null;
    return alive[Math.floor(Math.random() * alive.length)];
}

// 🥚ふわとろオム：タッグ戦全体で共有する系統ラベル定義（グローバル、各行動関数からも参照するため）
const FLUFFY_CATEGORY_LABEL_T = { meat: '肉系', seafood: '海鮮系', vegetable: '野菜系', fruit: '果実系' };
const FLUFFY_CATEGORY_KEYS_T = Object.keys(FLUFFY_CATEGORY_LABEL_T);

function launchTagBattle(myCurry, deliveryCand, enemies) {
    myCurry = applyTablewareModifiers(myCurry); // 食器補正を適用（タッグ戦もstartBattleSceneを経由しない独立ルートのため個別に適用）
    tagBattleAborted = false;
    tagBattleLogHistory = []; // 戦闘ログ履歴をリセット
    // 前回のバトルで付いた毒・幻惑の名前色クラスをリセット
    ['tagPlayerName0','tagPlayerName1','tagEnemyName0','tagEnemyName1'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.remove('name-poisoned', 'name-illuded');
    });
    // 前回のバトルでレンチン玉子が拡大したまま残っている可能性があるため、敵アイコンの見た目を確実にリセット
    ['tagEnemyImg0','tagEnemyImg1'].forEach(id => {
        const img = document.getElementById(id);
        if(img) { img.style.transform = ''; img.style.filter = ''; img.style.transition = ''; img.style.opacity = '1'; }
    });

    // 4ファイター構築
    const myFighter = {
        side: 'player', idx: 0, name: playerName, curry: myCurry,
        hp: myCurry.hp, maxHp: myCurry.hp, atk: myCurry.atk, def: myCurry.def, spd: myCurry.spd,
        isPoisoned: false, isIlluded: false, defBuffTurns: 0, poisonLevel: 0, fluffyCategory: null, isDelivery: false
    };
    const deliveryFighter = {
        side: 'player', idx: 1, name: deliveryCand.playerName, curry: deliveryCand.curry,
        hp: deliveryCand.curry.hp, maxHp: deliveryCand.curry.hp, atk: deliveryCand.curry.atk, def: deliveryCand.curry.def, spd: deliveryCand.curry.spd,
        isPoisoned: false, isIlluded: false, defBuffTurns: 0, poisonLevel: 0, fluffyCategory: null, isDelivery: true, deliveryCand: deliveryCand
    };
    const enemyFighters = enemies.map((bot, i) => ({
        side: 'enemy', idx: i, name: bot.name, bot: bot,
        hp: bot.hp, maxHp: bot.hp, atk: bot.atk, def: bot.def, spd: bot.spd,
        isPoisoned: false, isIlluded: false, defBuffTurns: 0, poisonLevel: 0, fluffyCategory: null,
        isWanpaku: !!bot.isWanpaku, isHomerun: !!bot.isHomerun, specialEffect: bot.specialEffect,
        chinCount: 0, isExploding: false
    }));
    tagBattleFighters = [myFighter, deliveryFighter, enemyFighters[0], enemyFighters[1]];

    // 戦闘開始時：毒・幻惑をランダムで敵1人に付与（自分側のカレーが該当効果を持っていれば）
    const myTeam = [myFighter, deliveryFighter];
    const enemyTeam = [enemyFighters[0], enemyFighters[1]];
    let openingLogs = [];

    // 🥚ふわとろオム／👑世界三大珍味：戦闘開始時に4人それぞれが軽減対象の系統を個別抽選（持っている人だけ）
    let fluffyOpeningQueue = []; // {fighter, category} の演出キュー
    [...myTeam, ...enemyTeam].forEach(f => {
        const hasFluffy = f.curry ? (f.curry.isFluffyOmelette || f.curry.isTriCaviar) : false; // 敵Botは現状これらを持たないため常にfalse
        if(hasFluffy) {
            f.fluffyCategory = FLUFFY_CATEGORY_KEYS_T[Math.floor(Math.random()*FLUFFY_CATEGORY_KEYS_T.length)];
            openingLogs.push(`🥚 ${f.name} は${getBarrierLabel(f.curry)}により${FLUFFY_CATEGORY_LABEL_T[f.fluffyCategory]}からの攻撃を軽減する！`);
            fluffyOpeningQueue.push(f);
        }
    });

    // 戦闘開始時：ネバネバ（isSticky）を持つチームが必ず先攻を取る
    tagStickyFirstSide = null;
    const myHasSticky = myTeam.some(f => f.curry && f.curry.isSticky);
    const enemyHasSticky = enemyTeam.some(f => f.specialEffect === 'sticky');
    if(myHasSticky && !enemyHasSticky) {
        tagStickyFirstSide = 'player';
        openingLogs.push(`💚 敵はネバネバにかかった！自分たちの先攻攻撃！`);
    } else if(enemyHasSticky && !myHasSticky) {
        tagStickyFirstSide = 'enemy';
        openingLogs.push(`💚 自分たちはネバネバにかかった！敵の先攻攻撃！`);
    }
    let statusFlashQueue = []; // 演出を順番に再生するためのキュー
    myTeam.forEach(f => {
        if(f.curry && f.curry.isPoison && !f.curry.isPoisonApple) {
            const target = tagPickRandomAliveTarget(enemyTeam);
            if(target && !target.isPoisoned) {
                if(target.curry && target.curry.isTriCaviar) {
                    openingLogs.push(`👑 ${target.name} は更に毒も効きませんのよ！`);
                } else {
                    target.isPoisoned = true;
                    target.poisonLevel = 1;
                    openingLogs.push(`☠️ ${target.name} は毒にかかった！`);
                    statusFlashQueue.push({ type: 'poison', el: document.getElementById('tagEnemyName' + target.idx) });
                }
            }
        }
        if(f.curry && f.curry.isIllusion) {
            const target = tagPickRandomAliveTarget(enemyTeam);
            if(target && !target.isIlluded) {
                if(target.curry && target.curry.isTriCaviar) {
                    openingLogs.push(`👑 ${target.name} は更に幻惑も効きませんのよ！`);
                } else {
                    target.isIlluded = true;
                    openingLogs.push(`🌀 ${target.name} は幻惑にかかった！`);
                    statusFlashQueue.push({ type: 'illusion', el: document.getElementById('tagEnemyName' + target.idx) });
                }
            }
        }
    });
    // 戦闘開始時：敵側（毒舌料理人ミスズ／イカ星人グニョグニョ）が自分側に毒・幻惑を付与
    enemyTeam.forEach(ef => {
        if(ef.specialEffect === 'poison') {
            const target = tagPickRandomAliveTarget(myTeam);
            if(target && !target.isPoisoned) {
                if(target.curry && target.curry.isTriCaviar) {
                    openingLogs.push(`👑 ${target.name} は更に毒も効きませんのよ！`);
                } else {
                    target.isPoisoned = true;
                    target.poisonLevel = 1;
                    openingLogs.push(`☠️ ${target.name} は毒にかかった！`);
                    statusFlashQueue.push({ type: 'poison', el: document.getElementById('tagPlayerName' + target.idx) });
                }
            }
        }
        if(ef.specialEffect === 'illusion') {
            const target = tagPickRandomAliveTarget(myTeam);
            if(target && !target.isIlluded) {
                if(target.curry && target.curry.isTriCaviar) {
                    openingLogs.push(`👑 ${target.name} は更に幻惑も効きませんのよ！`);
                } else {
                    target.isIlluded = true;
                    openingLogs.push(`🌀 ${target.name} は幻惑にかかった！`);
                    statusFlashQueue.push({ type: 'illusion', el: document.getElementById('tagPlayerName' + target.idx) });
                }
            }
        }
    });

    // バトル画面表示
    document.getElementById('tagBattleResultBox').style.display = 'none';
    const overlay = document.getElementById('tagBattleResultOverlay'); if(overlay) overlay.style.display = 'none';
    const setupEl = document.getElementById('battleSetup'); if(setupEl) setupEl.style.display = 'none';
    document.getElementById('tagBattleArena').style.display = 'block';
    document.getElementById('tagBattleLog').innerHTML = `⚔️ タッグ戦開始！`;
    openingLogs.forEach(l => tagLogAppend(l));
    // 毒・幻惑の演出（効果音・画面フラッシュ・名前の色変更）を順番に再生
    statusFlashQueue.forEach((item, i) => {
        setTimeout(() => {
            playSoundEffect(item.type === 'poison' ? 'poison.mp3' : 'genwaku.mp3');
            playStatusFlash(item.type);
            if(item.el) item.el.classList.add(item.type === 'poison' ? 'name-poisoned' : 'name-illuded');
        }, 600 + i * 500);
    });
    // ふわとろバリアの演出（効果音＋バリア演出、毒・幻惑の演出が終わった後に再生）
    fluffyOpeningQueue.forEach((f, i) => {
        setTimeout(() => {
            playSoundEffect('healing.mp3');
            triggerTagFluffyBarrierEffect(f.side, f.idx);
        }, 600 + statusFlashQueue.length * 500 + i * 700);
    });

    document.getElementById('tagPlayerName0').innerText = myFighter.name;
    document.getElementById('tagPlayerCurryName0').innerText = myCurry.name;
    document.getElementById('tagPlayerName1').innerText = deliveryFighter.name;
    document.getElementById('tagPlayerCurryName1').innerText = deliveryCand.curry.name;
    document.getElementById('tagEnemyName0').innerText = enemyFighters[0].name;
    document.getElementById('tagEnemyName1').innerText = enemyFighters[1].name;
    document.getElementById('tagEnemyCurryEmoji0').innerText = enemies[0].emoji || '🍛';
    document.getElementById('tagEnemyCurryEmoji1').innerText = enemies[1].emoji || '🍛';
    document.getElementById('tagEnemyCurryName0').innerText = enemies[0].curryName;
    document.getElementById('tagEnemyCurryName1').innerText = enemies[1].curryName;
    document.getElementById('tagEnemyImg0').src = enemies[0].image;
    document.getElementById('tagEnemyImg1').src = enemies[1].image;

    stopBattleBGM();
    const hasTriCaviarInTag  = myCurry.isTriCaviar    || deliveryCand.curry.isTriCaviar;
    const hasMargheritaInTag = myCurry.isMargherita   || deliveryCand.curry.isMargherita;
    const hasSeafoodInTag    = myCurry.isSeafood      || deliveryCand.curry.isSeafood;
    const tagBGM = hasTriCaviarInTag  ? 'Specialdinner.mp3'
                 : hasMargheritaInTag ? 'Guardare_il_cielo.mp3'
                 : hasSeafoodInTag    ? 'wave.mp3'
                 : 'Revenger.mp3';
    setTimeout(() => playBattleBGM(tagBGM), 200);

    tagUpdateAllHpDisplays();
    requestAnimationFrame(() => {
        const arena = document.getElementById('tagBattleArena');
        if(arena) arena.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // 行動順（SPD降順）を決めてターンループ開始
    let tagRound = 1;
    setTimeout(() => tagBattleStep(tagRound), 800);
}

// 1ラウンド = 生存している4人がSPD降順で1回ずつ行動する
function tagBattleStep(round) {
    if(tagBattleAborted) return;
    if(round > 50) {
        tagLogAppend(`💨 制限時間切れ！両者引き分けで終了！`);
        setTimeout(() => tagFinishBattle('draw'), tagDelay(600));
        return;
    }
    const myTeam = [tagBattleFighters[0], tagBattleFighters[1]];
    const enemyTeam = [tagBattleFighters[2], tagBattleFighters[3]];

    // 全滅判定（両方同時に全滅した場合は引き分け）
    const myAllDown = myTeam.every(f => f.hp <= 0);
    const enemyAllDown = enemyTeam.every(f => f.hp <= 0);
    if(myAllDown && enemyAllDown) { setTimeout(() => tagFinishBattle('draw'), tagDelay(400)); return; }
    if(myAllDown) { setTimeout(() => tagFinishBattle('lose'), tagDelay(400)); return; }
    if(enemyAllDown) { setTimeout(() => tagFinishBattle('win'), tagDelay(400)); return; }

    // 行動順（生存者のみ、SPD降順）。ただし初回ラウンドはネバネバ（isSticky）を持つチームが先攻
    let order = tagBattleFighters.filter(f => f.hp > 0).sort((a,b) => b.spd - a.spd);
    if(round === 1 && tagStickyFirstSide) {
        const myTeam2 = [tagBattleFighters[0], tagBattleFighters[1]].filter(f => f.hp > 0);
        const enemyTeam2 = [tagBattleFighters[2], tagBattleFighters[3]].filter(f => f.hp > 0);
        order = tagStickyFirstSide === 'player' ? [...myTeam2, ...enemyTeam2] : [...enemyTeam2, ...myTeam2];
    }
    tagRunActionQueue(order, 0, round);
}

function tagRunActionQueue(order, i, round) {
    if(tagBattleAborted) return;
    const myTeam = [tagBattleFighters[0], tagBattleFighters[1]];
    const enemyTeam = [tagBattleFighters[2], tagBattleFighters[3]];
    const myAllDown2 = myTeam.every(f => f.hp <= 0);
    const enemyAllDown2 = enemyTeam.every(f => f.hp <= 0);
    if(myAllDown2 && enemyAllDown2) { setTimeout(() => tagFinishBattle('draw'), tagDelay(400)); return; }
    if(myAllDown2) { setTimeout(() => tagFinishBattle('lose'), tagDelay(400)); return; }
    if(enemyAllDown2) { setTimeout(() => tagFinishBattle('win'), tagDelay(400)); return; }

    if(i >= order.length) {
        // このラウンド終了、次ラウンドへ
        setTimeout(() => tagBattleStep(round + 1), tagDelay(1200));
        return;
    }
    const actor = order[i];
    if(actor.hp <= 0) { tagRunActionQueue(order, i+1, round); return; } // ラウンド中に倒された場合スキップ

    // 各キャラの行動開始時にログをリセット（既存の通常戦闘と同様、蓄積させない）
    const turnIcon = actor.side === 'player' ? '🔥' : '⚠️';
    tagLogSet(`${turnIcon} ${actor.name} のターン！`);

    setTimeout(() => {
        tagExecuteTurnStart(actor, () => {
            if(actor.hp <= 0) { setTimeout(() => tagRunActionQueue(order, i+1, round), tagDelay(600)); return; } // 毒等で自滅
            tagExecuteAction(actor, myTeam, enemyTeam, () => {
                tagUpdateAllHpDisplays();
                setTimeout(() => tagRunActionQueue(order, i+1, round), tagDelay(1500));
            });
        });
    }, tagDelay(500));
}

// ターン開始時処理：毒ダメージ・カレー天使の天使のカレー粉ターン消費等
function tagExecuteTurnStart(actor, callback) {
    if(actor.isPoisoned) {
        const d = Math.round(actor.maxHp * 0.08 * (actor.poisonLevel || 1));
        actor.hp = Math.max(0, actor.hp - d);
        const side = actor.side === 'enemy' ? 'enemy' : 'player';
        tagTriggerDamagePop(side, actor.idx, d, '#9b59b6');
        tagLogAppend(`☠️ ${actor.name} は毒ダメージ: ${d}`);
        tagUpdateAllHpDisplays();
        if(actor.hp <= 0) { tagLogAppend(`💀 ${actor.name} は毒でダウン！`); setTimeout(callback, tagDelay(500)); return; }
    }
    setTimeout(callback, actor.isPoisoned ? tagDelay(400) : 0);
}

// 1キャラの行動を実行する（プレイヤー側カレー用。敵Bot側はtagExecuteEnemyActionで処理）
function tagExecuteAction(actor, myTeam, enemyTeam, callback) {
    const isMySide = actor.side === 'player';
    const opponentTeam = isMySide ? enemyTeam : myTeam;

    if(!isMySide) {
        tagExecuteEnemyAction(actor, myTeam, enemyTeam, callback);
        return;
    }

    const curry = actor.curry;
    // 海鮮カレー：HP50%以下で1回だけ回復（タッグ戦）
    if(curry.isSeafood && !actor.seaHealUsed && actor.hp <= Math.floor(actor.maxHp * 0.5)) {
        actor.seaHealUsed = true;
        const aliveEnemySpd = enemyTeam.filter(f => f.hp > 0).map(f => f.spd);
        const avgEnemySpd = aliveEnemySpd.length ? aliveEnemySpd.reduce((a,b)=>a+b,0)/aliveEnemySpd.length : 50;
        const seaHeal = Math.round(actor.maxHp * (actor.spd >= avgEnemySpd ? 0.4 : 0.3));
        actor.hp = Math.min(actor.maxHp, actor.hp + seaHeal);
        tagTriggerDamagePop('player', actor.idx, -seaHeal, '#2ecc71');
        tagLogAppend(`🌊 ${actor.name}は波の音に癒された。HP回復+${seaHeal}`);
        playSoundEffect('healing.mp3');
    }
    // 幻惑ミス判定
    if(actor.isIlluded) {
        const aliveEnemySpd = enemyTeam.filter(f => f.hp > 0).map(f => f.spd);
        const avgEnemySpd = aliveEnemySpd.length ? aliveEnemySpd.reduce((a,b)=>a+b,0)/aliveEnemySpd.length : 50;
        if(Math.random() < getIllusionMissRate(actor.spd, avgEnemySpd)) {
            playSoundEffect('sound/miss.mp3');
            tagLogAppend(`💨 ${actor.name} は幻惑で攻撃が外れた！`);
            callback(); return;
        }
    }
    // わんぱくミス判定
    if((curry.isWanpaku || curry.isTonTonTon) && isWanpakuMiss()) {
        if(curry.isTonTonTon) playSoundEffect('pig2.mp3');
        playSoundEffect('sound/miss.mp3');
        tagLogAppend(`💨 ${actor.name} のわんぱくが暴れすぎて攻撃が外れた！`);
        callback(); return;
    }
    // ラタトゥイユ：自分のターンにHP回復
    if(curry.isRatatouille) {
        const heal = Math.round(actor.maxHp * 0.10);
        actor.hp = Math.min(actor.maxHp, actor.hp + heal);
        tagTriggerDamagePop('player', actor.idx, -heal, '#2ecc71');
        tagLogAppend(`☀️ ${actor.name} は太陽の光を浴びてHP回復: ${heal}`);
        playSoundEffect('taiyou.mp3');
    }
    // 種連射：攻撃回数をランダムで敵に振り分け（SPD判定は敵2人の平均値）
    // ドラゴン料理長が宅配カレーとして参加：熱々ブレス
    // ※宅配カレーには種まき婆ちゃん・ドラゴン料理長は来ないため未使用
    if(curry.isSeed && Math.random() < 0.4) {
        const homerunFoe = enemyTeam.find(f => f.hp > 0 && f.isHomerun);
        const _willReflect = !!(homerunFoe && isHomerunReflect(homerunFoe.spd, actor.spd));
        const _interruptCfg = homerunFoe ? getHomerunConfig(homerunFoe.name) : HOMERUN_ANIM_CONFIG_ENEMY;
        const _seedCfg = Object.assign({}, SEED_PLAYER_ALLY_CONFIG, { interruptConfig: _interruptCfg });
        playTanemakiAnimation(_seedCfg, _willReflect, function(){
            if(_willReflect) {
                tagLogAppend(`🏏 ${homerunFoe.name} がホームラン！${actor.name} の種連続発射を打ち返して無効化！`);
                callback(); return;
            }
            const avgEnemySpd = (enemyTeam[0].spd + (enemyTeam[1] ? enemyTeam[1].spd : enemyTeam[0].spd)) / 2;
            const hits = rollSeedHits(actor.spd, avgEnemySpd);
            let total = 0;
            let hitRecords = [];
            let tagSeedSpicy = 0;
            for(let h = 0; h < hits; h++) {
                const target = tagPickRandomAliveTarget(enemyTeam);
                if(!target) break;
                let d = Math.max(2, Math.round(actor.atk*0.4 - target.def/4));
                d = Math.round(d * (0.9 + Math.random()*0.2));
                if(Math.random() < getCritRate(actor.spd, avgEnemySpd)) { d = Math.round(d*2); tagSeedSpicy++; }
                target.hp = Math.max(0, target.hp - d);
                total += d;
                hitRecords.push({ target, d });
            }
            tagLogAppend(`🌱 ${actor.name} の種連続発射 ${hits}連撃！`+(tagSeedSpicy>0?` 🌶️ SpicyHit×${tagSeedSpicy}！`:''));
            playSoundEffect('machine-gun.mp3');
            hitRecords.forEach((rec, i) => {
                setTimeout(() => {
                    tagTriggerDamagePop('enemy', rec.target.idx, rec.d, '#f1c40f');
                    tagUpdateAllHpDisplays();
                    if(i === hitRecords.length - 1) {
                        const summary = {};
                        hitRecords.forEach(r => {
                            if(!summary[r.target.idx]) summary[r.target.idx] = { name: r.target.name, count: 0, dmg: 0 };
                            summary[r.target.idx].count++;
                            summary[r.target.idx].dmg += r.d;
                        });
                        const summaryText = Object.values(summary).map(s => `${s.name}に${s.count}回(${s.dmg}ダメージ)`).join(' / ');
                        tagLogAppend(`${summaryText} 合計: ${total} ダメージ！`);
                    }
            }, tagDelay(i * 220));
        });
        setTimeout(callback, tagDelay(hitRecords.length * 220 + 300));
        }); // playTanemakiAnimation callback end
        return;
    }
    if(curry.isGreenCurry && Math.random() < 0.35) {
        // 🟢ヒリヒリクラッシュ：敵2人全員に攻撃。味方のホームラン持ちが1人いれば代表して判定し、成功すれば敵への攻撃は全体無効化。
        // ただし反動（自分の最大HP10%）はヒリヒリクラッシュ1回につき必ず1回発生する（打ち返されても変わらない）
        playSoundEffect('hirihiri.mp3');
        const selfDmg = Math.round(actor.maxHp * 0.10);
        const homerunFoeG = enemyTeam.find(f => f.hp > 0 && f.isHomerun);
        if(homerunFoeG && isHomerunReflect(homerunFoeG.spd, actor.spd)) {
            tagLogAppend(`🏏 ${homerunFoeG.name} がホームラン！${actor.name} のヒリヒリクラッシュを打ち返した！`);
            playBattleSkillAnimation(getHomerunConfig(homerunFoeG.name), function() {
                actor.hp = Math.max(0, actor.hp - selfDmg);
                tagLogAppend(`🌶️ 反動で${actor.name}にも${selfDmg}ダメージ！`);
                tagTriggerDamagePop(actor.side, actor.idx, selfDmg, '#e74c3c');
                triggerTagHirihiriEffect(actor.side, actor.idx);
                setTimeout(callback, tagDelay(700));
            });
            return;
        }
        const aliveEnemies = enemyTeam.filter(f => f.hp > 0);
        let hitTexts = [];
        aliveEnemies.forEach(target => {
            let d = Math.max(8, Math.round(actor.atk * (0.6 + Math.random()*0.4)) - Math.floor(target.def/2));
            target.hp = Math.max(0, target.hp - d);
            hitTexts.push(`${target.name}に${d}ダメージ`);
            tagTriggerDamagePop('enemy', target.idx, d, '#e74c3c');
        });
        actor.hp = Math.max(0, actor.hp - selfDmg);
        tagLogAppend(`🌶️🔥 ${actor.name} のヒリヒリクラッシュ！全ての敵に攻撃！${hitTexts.join(' / ')}`);
        tagLogAppend(`🌶️ 反動で${actor.name}にも${selfDmg}ダメージ！`);
        tagTriggerDamagePop(actor.side, actor.idx, selfDmg, '#e74c3c');
        setTimeout(()=>triggerTagHirihiriEffect(actor.side, actor.idx), 300);
        setTimeout(callback, tagDelay(900));
        return;
    }
    // 通常攻撃（わんぱくならダメージ倍率増加）
    const target = tagPickRandomAliveTarget(enemyTeam);
    if(!target) { callback(); return; }
    const isCrit = Math.random() < getCritRate(actor.spd, target.spd);
    let d = isCrit ? Math.max(8, actor.atk) : Math.max(8, actor.atk - Math.floor(target.def/2));
    d = Math.round(d * (0.9 + Math.random()*0.2));
    if(curry.isWanpaku || curry.isTonTonTon) d = Math.round(d * getWanpakuDamageMultiplier());
    if(target.curry && target.curry.isRatatouille && isMeatBasedCurry(curry)) d = Math.round(d * 0.2);
    let tagFluffyBlocked = false;
    if(target.fluffyCategory && curryHasCategory(curry, target.fluffyCategory)) { d = Math.round(d * 0.7); tagFluffyBlocked = true; }
    target.hp = Math.max(0, target.hp - d);
    tagTriggerDamagePop('enemy', target.idx, d, isCrit ? '#ff4500' : '#f1c40f');
    playSoundEffect('punch.mp3');
    if(curry.isTonTonTon) playSoundEffect('pig2.mp3');
    if(isCrit) tagLogAppend(`🌶️ ${actor.name} の Spicy Hit!!!! ${target.name} に ${d} ダメージ！`);
    else tagLogAppend(`💥 ${actor.name} の攻撃！ ${target.name} に ${d} ダメージ！`);
    if(tagFluffyBlocked) tagLogAppend(`🥚 ${getBarrierLabel(target.curry)}により${FLUFFY_CATEGORY_LABEL_T[target.fluffyCategory]}からの攻撃を軽減`);
    if(target.hp <= 0) tagLogAppend(`💀 ${target.name} はダウン！`);
    // 🍎☠️毒りんご：通常攻撃ヒット時50%で対象を毒状態にする／既に毒なら増幅（対象ごとに個別の毒レベルを持つ）
    if(curry.isPoisonApple && target.hp > 0 && Math.random() < 0.5) {
        if(!target.isPoisoned) {
            target.isPoisoned = true; target.poisonLevel = 1;
            tagLogAppend(`☠️ ${target.name} は毒にかかった！`);
            const nameEl = document.getElementById('tagEnemyName' + target.idx);
            setTimeout(() => { playSoundEffect('poison.mp3'); if(nameEl) nameEl.classList.add('name-poisoned'); }, tagDelay(300));
        } else if((target.poisonLevel || 1) < 6) {
            target.poisonLevel = (target.poisonLevel || 1) + 1;
            tagLogAppend(`☠️ 毒のダメージが増幅`);
            setTimeout(() => { playSoundEffect('poison.mp3'); }, tagDelay(300));
        }
    }
    callback();
}

function startHardBotBattle() {
    if (!hasUsableCurryForBattle()) { alertNoUsableCurry(); return; }
    if (!isHardModeUnlocked()) { showLockedModeAlert(); return; }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isBotMatch = true; currentRoomId = null;
    const bot = hardBotOpponents[Math.floor(Math.random() * hardBotOpponents.length)];
    const bName = bot.name; const bVisual = bot.image; const bCurryEmoji = bot.emoji;
    const oppCurryData = {
        name: bot.curryName, visual: bVisual, emoji: bCurryEmoji,
        hp: bot.hp, atk: bot.atk, def: bot.def, spd: bot.spd,
        isBotImage: true, isHardBot: true,
        // 特殊効果フラグ
        isIllusion: bot.specialEffect === 'illusion',
        isSeed:     bot.specialEffect === 'seed',
        isBreath:   bot.specialEffect === 'breath',
        isPoison:   bot.specialEffect === 'poison',
        foodCategory: bot.foodCategory
    };
    activeBotData = bot;
    launchVsCutIn(bName, bVisual, oppCurryData);
}

// タッグ戦：敵側（Bot）の行動
function tagExecuteEnemyAction(actor, myTeam, enemyTeam, callback) {
    tagExecuteEnemyActionImpl(actor, myTeam, enemyTeam, callback);
}
function tagExecuteEnemyActionImpl(actor, myTeam, enemyTeam, callback) {
    const bot = actor.bot;
    const effect = actor.specialEffect;
    // 幻惑ミス判定（敵が幻惑にかかっている場合）
    if(actor.isIlluded) {
        const aliveMySpd = myTeam.filter(f => f.hp > 0).map(f => f.spd);
        const avgMySpd = aliveMySpd.length ? aliveMySpd.reduce((a,b)=>a+b,0)/aliveMySpd.length : 50;
        if(Math.random() < getIllusionMissRate(actor.spd, avgMySpd)) {
            playSoundEffect('sound/miss.mp3');
            tagLogAppend(`💨 ${actor.name} は幻惑で攻撃が外れた！`);
            callback(); return;
        }
    }
    // わんぱくミス判定（敵がわんぱく持ちの場合）
    if(actor.isWanpaku && isWanpakuMiss()) {
        playSoundEffect('sound/miss.mp3');
        tagLogAppend(`💨 ${actor.name} のわんぱくが暴れすぎて攻撃が外れた！`);
        callback(); return;
    }

    // カレー天使ぴゃぁ専用ロジック
    if(effect === 'angel') {
        const r = Math.random();
        if(r < 0.40) {
            tagEnemyNormalAttack(actor, myTeam, callback);
        } else if(r < 0.70) {
            // 甘口スマイル：自分or味方でHPが少ない方の最大HPの10%+100回復（2人ともHP満タンなら代わりに通常攻撃）
            const aliveAllies = enemyTeam.filter(f => f.hp > 0);
            const healable = aliveAllies.filter(f => f.hp < f.maxHp);
            if(healable.length === 0) {
                tagEnemyNormalAttack(actor, myTeam, callback);
            } else {
                const target = healable.reduce((lowest, f) => (f.hp < lowest.hp ? f : lowest), healable[0]);
                const heal = Math.round(target.maxHp * 0.10) + 100;
                target.hp = Math.min(target.maxHp, target.hp + heal);
                tagTriggerDamagePop('enemy', target.idx, -heal, '#2ecc71');
                tagLogAppend(`💖 ${actor.name} の甘口スマイル！ ${target.name} のHPが ${heal} 回復！`);
                playSoundEffect('healing.mp3');
                callback();
            }
        } else {
            // 天使のカレー粉：自分と味方のDEFが3ターンの間1.5倍
            enemyTeam.forEach(f => { if(f.hp > 0) { f.defBuffTurns = 3; } });
            tagLogAppend(`✨ ${actor.name} の天使のカレー粉！ DEFが3ターンの間1.5倍に！`);
            playSoundEffect('healing.mp3');
            callback();
        }
        return;
    }

    // 悪ガキサタン君専用ロジック
    if(effect === 'brat') {
        const r = Math.random();
        if(r < 0.80) {
            tagEnemyNormalAttack(actor, myTeam, callback);
        } else {
            // ぼーっとする：自分の毒・幻惑を解除
            actor.isPoisoned = false; actor.isIlluded = false;
            const nameEl = document.getElementById('tagEnemyName' + actor.idx);
            if(nameEl) nameEl.classList.remove('name-poisoned', 'name-illuded');
            tagLogAppend(`😶 ${actor.name} はなんだか健康になった`);
            playSoundEffect('poincyo.mp3');
            callback();
        }
        return;
    }

    // レンチン玉子専用ロジック
    if(effect === 'chin') {
        const r = Math.random();
        if(r < 0.30) {
            tagEnemyNormalAttack(actor, myTeam, callback);
            return;
        }
        // レンジで加熱
        actor.chinCount = (actor.chinCount || 0) + 1;
        playSoundEffect('chin.mp3');
        tagLogAppend(`🔥 ${actor.name} は更にレンジで加熱された`);
        if(actor.chinCount >= 3) {
            // 3回目は同じターン内で続けて大爆発を発動（他キャラの行動を挟まない）。
            // ①加熱表示 → ②「大爆発」の巨大テキスト → ③結果テキスト、の3段階で表示する
            tagTriggerChinGrowEffect(actor, () => {
                actor.chinCount = 0;
                tagTriggerChinExplosionText(() => {
                    tagExecuteChinExplosion(actor, myTeam, callback);
                });
            });
        } else {
            tagTriggerChinGrowEffect(actor, callback);
        }
        return;
    }

    // 既存の通常Bot（毒・幻惑・種連射・熱々ブレス持ち）
    if(effect === 'breath' && Math.random() < 0.25) {
        const homerunAlly = myTeam.find(f => f.hp > 0 && f.curry && f.curry.isHomerun);
        const _wRBr = !!(homerunAlly && isHomerunReflect(homerunAlly.spd, actor.spd));
        playTanemakiAnimation(DRAGON_TAG_ENEMY_CONFIG, _wRBr, function(){
            if(_wRBr) {
                tagLogAppend(`🏏 ${homerunAlly.name} がホームラン！${actor.name} の熱々ブレスを打ち返して無効化！`);
                callback(); return;
            }
            myTeam.forEach(f => { if(f.hp <= 0) return; f.hp = Math.max(0, f.hp - 40); tagTriggerDamagePop('player', f.idx, 40, '#e74c3c'); });
            tagLogAppend(`🔥 ${actor.name} の熱々ブレス！両者にDEF無視40ダメージ！`);
            playSoundEffect('breath.mp3'); callback();
        });
        return;
    }
    if(effect === 'seed' && Math.random() < 0.35) {
        const homerunAlly2 = myTeam.find(f => f.hp > 0 && f.curry && f.curry.isHomerun);
        const _wRSd = !!(homerunAlly2 && isHomerunReflect(homerunAlly2.spd, actor.spd));
        playTanemakiAnimation(TANEMAKI_TAG_ENEMY_CONFIG, _wRSd, function(){
            if(_wRSd) {
                tagLogAppend(`🏏 ${homerunAlly2.name} がホームラン！${actor.name} の種連続発射を打ち返して無効化！`);
                callback(); return;
            }
            const avgMySpd = (myTeam[0].spd + (myTeam[1] ? myTeam[1].spd : myTeam[0].spd)) / 2;
            const hits = rollSeedHits(actor.spd, avgMySpd);
            let total = 0; let hitRecords2 = []; let tagSeedSpicy2 = 0;
            for(let h = 0; h < hits; h++) {
                const target = tagPickRandomAliveTarget(myTeam);
                if(!target) break;
                let d = Math.max(2, Math.round(actor.atk*0.4 - target.def/4));
                d = Math.round(d * (0.9 + Math.random()*0.2));
                if(Math.random() < getCritRate(actor.spd, avgMySpd)) { d = Math.round(d*2); tagSeedSpicy2++; }
                target.hp = Math.max(0, target.hp - d);
                total += d; hitRecords2.push({ target, d });
            }
            tagLogAppend(`🌱 ${actor.name} の種連続発射 ${hits}連撃！`+(tagSeedSpicy2>0?` 🌶️ SpicyHit×${tagSeedSpicy2}！`:''));
            playSoundEffect('machine-gun.mp3');
            hitRecords2.forEach((rec, i) => {
                setTimeout(() => {
                    tagTriggerDamagePop('player', rec.target.idx, rec.d, '#f1c40f');
                    tagUpdateAllHpDisplays();
                    if(i === hitRecords2.length - 1) {
                        const summary2 = {};
                        hitRecords2.forEach(r => { if(!summary2[r.target.idx]) summary2[r.target.idx]={name:r.target.name,count:0,dmg:0}; summary2[r.target.idx].count++; summary2[r.target.idx].dmg+=r.d; });
                        tagLogAppend(Object.values(summary2).map(s=>`${s.name}に${s.count}回(${s.dmg}ダメージ)`).join(' / ')+` 合計: ${total} ダメージ！`);
                    }
                }, tagDelay(i * 220));
            });
            setTimeout(callback, tagDelay(hitRecords2.length * 220 + 300));
        });
        return;
    }
    tagEnemyNormalAttack(actor, myTeam, callback);
}

function tagEnemyNormalAttack(actor, myTeam, callback) {
    const target = tagPickRandomAliveTarget(myTeam);
    if(!target) { callback(); return; }
    const isCrit = Math.random() < getCritRate(actor.spd, target.spd);
    let effectiveDef = target.def * (target.defBuffTurns > 0 ? 1.5 : 1);
    let d = isCrit ? Math.max(8, actor.atk) : Math.max(8, actor.atk - Math.floor(effectiveDef/2));
    d = Math.round(d * (0.9 + Math.random()*0.2));
    if(actor.isWanpaku) d = Math.round(d * getWanpakuDamageMultiplier());
    let tagFluffyBlockedEnemy = false;
    if(target.fluffyCategory && actor.bot && actor.bot.foodCategory === target.fluffyCategory) { d = Math.round(d * 0.7); tagFluffyBlockedEnemy = true; }
    target.hp = Math.max(0, target.hp - d);
    tagTriggerDamagePop('player', target.idx, d, isCrit ? '#ff4500' : '#f1c40f');
    if(isCrit) tagLogAppend(`🌶️ ${actor.name} の Spicy Hit!!!! ${target.name} に ${d} ダメージ！`);
    else tagLogAppend(`💥 ${actor.name} の攻撃！ ${target.name} に ${d} ダメージ！`);
    if(tagFluffyBlockedEnemy) tagLogAppend(`🥚 ${getBarrierLabel(target.curry)}により${FLUFFY_CATEGORY_LABEL_T[target.fluffyCategory]}からの攻撃を軽減`);
    if(target.hp <= 0) tagLogAppend(`💀 ${target.name} はダウン！`);
    playSoundEffect('punch.mp3');
    if(target.defBuffTurns > 0) target.defBuffTurns--;
    callback();
}

// レンチン玉子：大爆発（DEF無視で味方2人に200ダメージ、ホームランで打ち返し可能）
// レンチン玉子：「大爆発」の巨大テキストを一瞬表示する
function tagTriggerChinExplosionText(callback) {
    const wrap = document.getElementById('tagChinExplosionText');
    if(!wrap) { callback(); return; }
    wrap.style.display = 'flex';
    setTimeout(() => {
        wrap.style.display = 'none';
        callback();
    }, battleDelay(900));
}

function tagExecuteChinExplosion(actor, myTeam, callback) {
    const homerunAlly = myTeam.find(f => f.hp > 0 && f.curry && f.curry.isHomerun);
    if(homerunAlly && isHomerunReflect(homerunAlly.spd, actor.spd)) {
        tagLogSet(`🏏 ${homerunAlly.name} がホームラン！${actor.name} の大爆発を打ち返して無効化！`);
        playSoundEffect('daibakuha.mp3');
        playBattleSkillAnimation(HOMERUN_ANIM_CONFIG, function() {
            actor.hp = Math.max(0, actor.hp - 9999);
            tagTriggerDamagePop('enemy', actor.idx, 9999, '#e74c3c');
            tagLogAppend(`💀 ${actor.name} は自分の爆発でダウンした！`);
            tagTriggerChinExplosionEffect(actor, () => { callback(); });
        });
        return;
    }
    tagLogSet(`💥 ゆで卵はレンジで作らないで!!!!!!!!!!`);
    myTeam.forEach(f => {
        if(f.hp <= 0) return;
        f.hp = Math.max(0, f.hp - 200);
        tagTriggerDamagePop('player', f.idx, 200, '#e74c3c');
    });
    // レンチン玉子自身も大爆発のダメージで必ずダウンする
    actor.hp = Math.max(0, actor.hp - 9999);
    tagTriggerDamagePop('enemy', actor.idx, 9999, '#e74c3c');
    tagLogAppend(`💀 ${actor.name} は自分の爆発でダウンした！`);
    playSoundEffect('daibakuha.mp3');
    tagTriggerChinExplosionEffect(actor, callback);
}

// レンチン玉子：加熱するごとにアイコンが大きくなる演出
function tagTriggerChinGrowEffect(actor, callback) {
    const img = document.getElementById('tagEnemyImg' + actor.idx);
    if(img) {
        const scale = 1 + (actor.chinCount || 0) * 0.25;
        img.style.transition = 'transform 0.3s ease-out';
        img.style.transform = 'scale(' + scale + ')';
        img.style.filter = 'drop-shadow(0 0 ' + (4 + actor.chinCount * 3) + 'px #ff4500)';
    }
    setTimeout(callback, battleDelay(500));
}

// レンチン玉子：大爆発（画面上を高速で暴れまくって弾け飛ぶ派手な演出）。終了後は必ずレイアウトを元に戻す
function tagTriggerChinExplosionEffect(actor, callback) {
    const stage = document.getElementById('tagBattleStage');
    const originalImg = document.getElementById('tagEnemyImg' + actor.idx);
    if(!stage || !originalImg) { callback(); return; }

    const stageRect = stage.getBoundingClientRect();
    const imgRect = originalImg.getBoundingClientRect();

    // overflow:hiddenの制約を受けないよう、演出専用のコピー画像をstage直下にfixedで重ねる
    const flyingImg = originalImg.cloneNode(true);
    flyingImg.id = '';
    flyingImg.style.position = 'fixed';
    flyingImg.style.left = imgRect.left + 'px';
    flyingImg.style.top = imgRect.top + 'px';
    flyingImg.style.width = imgRect.width + 'px';
    flyingImg.style.height = imgRect.height + 'px';
    flyingImg.style.borderRadius = '50%';
    flyingImg.style.zIndex = '9500';
    flyingImg.style.transition = 'none';
    flyingImg.style.pointerEvents = 'none';
    document.body.appendChild(flyingImg);
    originalImg.style.opacity = '0';

    let frame = 0;
    const totalFrames = 10;
    const shakeInterval = setInterval(() => {
        frame++;
        const randX = stageRect.left + Math.random() * stageRect.width - imgRect.width/2;
        const randY = stageRect.top + Math.random() * stageRect.height - imgRect.height/2;
        const randRot = Math.random() * 720 - 360;
        const scale = 1.5 + Math.random() * 1.5;
        flyingImg.style.left = randX + 'px';
        flyingImg.style.top = randY + 'px';
        flyingImg.style.transform = `rotate(${randRot}deg) scale(${scale})`;
        if(frame >= totalFrames) {
            clearInterval(shakeInterval);
            // 弾け飛んで消える
            flyingImg.style.transition = 'transform 0.3s ease-in, opacity 0.3s ease-in, top 0.3s ease-in';
            flyingImg.style.top = (stageRect.top - 200) + 'px';
            flyingImg.style.transform = `rotate(1080deg) scale(0.1)`;
            flyingImg.style.opacity = '0';
            playSoundEffect('daibakuha.mp3');
            setTimeout(() => {
                // 演出用コピーを削除し、必ず元の表示状態に戻す
                if(flyingImg.parentNode) flyingImg.parentNode.removeChild(flyingImg);
                originalImg.style.opacity = '1';
                originalImg.style.transform = '';
                originalImg.style.filter = '';
                originalImg.style.transition = '';
                callback();
            }, battleDelay(400));
        }
    }, battleDelay(80));
}

function rTrimHtml(str) { return str.replace(/<\/?[^>]+(>|$)/g, ""); }

// タッグ戦の勝敗決定後の処理
function tagFinishBattle(result) {
    stopBattleBGM();
    // 戦闘終了時、レンチン玉子等で拡大したままになっている敵アイコンを確実に元のサイズへ戻す
    ['tagEnemyImg0','tagEnemyImg1'].forEach(id => {
        const img = document.getElementById(id);
        if(img) { img.style.transform = ''; img.style.filter = ''; img.style.transition = ''; img.style.opacity = '1'; }
    });
    const myFighter = tagBattleFighters[0];
    const deliveryFighter = tagBattleFighters[1];
    const enemy0 = tagBattleFighters[2];
    const enemy1 = tagBattleFighters[3];
    const isWin = result === 'win';

    const overlay = document.getElementById('tagBattleResultOverlay');
    const bigText = document.getElementById('tagBattleResultBig');
    const verdict = document.getElementById('tagBattleVerdict');
    const rewardText = document.getElementById('tagRewardText');

    let resultLabel = isWin ? '🏆 勝利!!' : (result === 'lose' ? '💀 敗北...' : '🤝 引き分け');
    let resultColor = isWin ? '#2ecc71' : (result === 'lose' ? '#ff4444' : '#f1c40f');

    if(overlay && bigText) {
        bigText.innerText = resultLabel; bigText.style.color = resultColor;
        overlay.style.display = 'flex';
        setTimeout(() => { overlay.style.display = 'none'; document.getElementById('tagBattleResultBox').style.display = 'block'; scrollResultIntoView('tagBattleResultBox'); }, 2000);
    } else {
        document.getElementById('tagBattleResultBox').style.display = 'block';
        scrollResultIntoView('tagBattleResultBox');
    }
    verdict.innerText = resultLabel; verdict.style.color = resultColor;

    // 宅配カレーの使用報告（所有者の累計成績に反映、5回で食べ尽くされ）
    if(deliveryFighter && deliveryFighter.deliveryCand) {
        reportDeliveryCurryUsage(deliveryFighter.deliveryCand, isWin);
    }

    if(isWin) {
        playWinSound();
        incrementGlobalStat('battle/tag');
        // タッグ戦で倒した敵2人の撃破統計を記録（初級・中級・タッグ専用キャラそれぞれ）
        updateStats(s => {
            [enemy0.bot, enemy1.bot].forEach(bot => {
                if(tagBattleExtraBots.includes(bot)) {
                    if(!s.defeatedTagExtraBots) s.defeatedTagExtraBots = [];
                    if(!s.defeatedTagExtraBots.includes(bot.name)) s.defeatedTagExtraBots.push(bot.name);
                    s.tagExtraKills = s.defeatedTagExtraBots.length;
                } else if(hardBotOpponents.includes(bot)) {
                    if(!s.defeatedHardBots) s.defeatedHardBots = [];
                    if(!s.defeatedHardBots.includes(bot.name)) s.defeatedHardBots.push(bot.name);
                    s.hardKills = s.defeatedHardBots.length;
                } else if(botOpponents.includes(bot)) {
                    if(!s.defeatedBots) s.defeatedBots = [];
                    if(!s.defeatedBots.includes(bot.name)) s.defeatedBots.push(bot.name);
                    s.botKills = s.defeatedBots.length;
                }
            });
        });
        // タッグ専用ボス（レンチン玉子・カレー天使ぴゃぁ・悪ガキサタン君）撃破による食材解放
        [enemy0.bot, enemy1.bot].forEach(bot => {
            if(bot.specialEffect === 'chin') unlockBossIngredients('chin');
            else if(bot.specialEffect === 'angel') unlockBossIngredients('angel');
            else if(bot.specialEffect === 'brat') unlockBossIngredients('brat');
        });
        const g = 60;
        const e = Math.round((enemy0.bot.expBonus + enemy1.bot.expBonus) / 2);
        // 報酬食材は敵2人分を合算
        const lootNames = [];
        [enemy0.bot, enemy1.bot].forEach(bot => {
            let dropPool;
            if(tagBattleExtraBots.includes(bot) || hardBotOpponents.includes(bot)) {
                const midPool = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 1 && isIngredientAvailable(k));
                const highPool = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 2 && isIngredientAvailable(k));
                dropPool = [...midPool, ...highPool];
            } else {
                dropPool = Object.keys(masterIngredients).filter(k => masterIngredients[k].shop === 0 && isIngredientAvailable(k));
            }
            const itm = dropPool[Math.floor(Math.random() * dropPool.length)];
            inventory[itm] = (inventory[itm] || 0) + 1;
            discoveredItems[itm] = true;
            lootNames.push(itm);
        });
        playerG += g;
        const oldExp = playerEXP; playerEXP += e;
        const lootHtml = lootNames.map(n => {
            const d = masterIngredients[n];
            const icon = d && d.icon ? `<img src="${d.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">` : '';
            return `${icon}${n}`;
        }).join(' / ');
        rewardText.innerHTML = `💰 +${g}G / ✨ +${e}EXP<br>${lootHtml}ゲット！`;
        setTimeout(() => checkLvUp(oldExp, playerEXP), 800);
        updateStats(s => { s.totalWins = (s.totalWins||0) + 1; });
    } else if(result === 'lose' || result === 'draw') {
        const oldExp = playerEXP; playerEXP += 2;
        rewardText.innerHTML = result === 'draw' ? `✨ +2EXP 引き分けでした。` : `✨ +2EXP どんまい！`;
        setTimeout(() => checkLvUp(oldExp, playerEXP), 800);
        if(result === 'draw') {
            updateStats(s => { s.gotDraw = true; });
            checkAndRenderAchievements();
        }
    }

    // 自分の出撃カレーを消費（通常戦闘と同様の仕様）
    const myIdx = curryStock.indexOf(myFighter.curry);
    if(myIdx !== -1) curryStock.splice(myIdx, 1);
    if(selectedCurryIndex >= curryStock.length) selectedCurryIndex = curryStock.length - 1;
    saveGame(); updateFridgeUI(); updateCookSelects(); updateMatchCurrySelects();
}

function endTagBattleScene() {
    stopBattleBGM();
    document.getElementById('tagBattleResultBox').style.display = 'none';
    document.getElementById('tagBattleArena').style.display = 'none';
    const setupEl = document.getElementById('battleSetup'); if(setupEl) setupEl.style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const battleTab = document.querySelector('[onclick*="battle"]');
    if(battleTab) battleTab.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('pageBattle').classList.add('active');
    showBattleGuideChar();
}


// Bot戦：出撃ボタンを押したとき
function confirmVsDeploy() {
    if (!isBotMatch) return; // 対人戦では使用しない
    if(selectedCurryIndex === -1 || !curryStock[selectedCurryIndex]) {
        showCustomAlert("⚠️ 出撃不可", "出撃させるカレーがありません。ストックを用意してください。");
        return;
    }
    const currentCurry = curryStock[selectedCurryIndex];
    document.getElementById("vsCutIn").style.display = "none";
    document.getElementById("vsPlayerSide").style.transform = "translateX(-100%)";
    document.getElementById("vsEnemySide").style.transform = "translateX(100%)";
    document.getElementById("vsBadge").style.opacity = "0";
    document.getElementById("vsBadge").style.scale = "3";
    if(cachedOpponentCurry && cachedOpponentCurry.isEventBoss) {
        startEventBattleScene(currentCurry);
    } else {
        startBattleScene(cachedOpponentName, cachedOpponentCurry, currentCurry);
    }
}

function abortMatchDeployment() {
    document.getElementById("vsCutIn").style.display = "none";
    document.getElementById("vsPlayerSide").style.transform = "translateX(-100%)";
    document.getElementById("vsEnemySide").style.transform = "translateX(100%)";
    document.getElementById("vsBadge").style.opacity = "0";
    document.getElementById("vsBadge").style.scale = "3";
    if(!isBotMatch && currentRoomId && myRoomRef) cancelMatchRoom();
}

function checkDatabase() { if(!database) { showCustomAlert("⚠️ 接続エラー", "リアルタイム対戦は利用できません。"); return false; } return true; }

function listenToRooms() {
    if(!database) return;
    database.ref('rooms').on('value', snap => {
        const rooms = snap.val();
        const area = document.getElementById("roomListArea");
        area.innerHTML = "";
        if(!rooms) { area.innerHTML = "募集中の部屋はありません。"; return; }
        Object.keys(rooms).forEach(id => {
            if(rooms[id].status !== "waiting") return;
            const card = document.createElement("div"); card.className = "room-card";
            const msg = rooms[id].message || "誰でも入室OK　お気軽に！";
            card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;width:100%;"><div style="flex:1;min-width:0;"><strong>👤 ${rooms[id].hostName}</strong><div style="font-size:11px;color:#b88742;margin-top:2px;">${msg}</div></div><button class="btn-sm btn-start" style="flex:none;width:80px;" onclick="joinMatchRoom('${id}',${rooms[id].hasPassword})">対戦する</button></div>`;
            area.appendChild(card);
        });
        if(!area.innerHTML) area.innerHTML = "募集中の部屋はありません。";
    });
}

function updateMatchCurrySelects() {
    const sel = document.getElementById("globalCurrySelect");
    if(!sel) return;
    sel.innerHTML = "";
    const usableStock = curryStock.filter(c => !c.isDelivering);
    if (!usableStock || usableStock.length === 0) {
        sel.innerHTML = "<option value='-1'>カレーを調理してください</option>";
        updateOnlineCurryStatus(-1);
    } else {
        curryStock.forEach((c, idx) => { if(c.isDelivering) return; const opt = document.createElement("option"); opt.value = idx; opt.innerText = c.name; sel.appendChild(opt); });
        updateOnlineCurryStatus(sel.value);
    }
    if(typeof checkEventBannerVisibility === "function") checkEventBannerVisibility();
}

// 対戦ボタンを押す前に、出撃可能なカレー（宅配中を除く）があるか確認する共通チェック
function hasUsableCurryForBattle() {
    return curryStock.some(c => !c.isDelivering);
}
function alertNoUsableCurry() {
    showCustomAlert("⚠️ カレーがありません", "カレーがありません。調理してください。");
}

function updateOnlineCurryStatus(idx) {
    const statusEl = document.getElementById("onlineCurryStatus");
    if(!statusEl) return;
    const idxN = parseInt(idx);
    if(isNaN(idxN) || idxN < 0 || !curryStock || !curryStock[idxN]) { statusEl.innerHTML = ""; return; }
    const c = curryStock[idxN];
    const iconsHTML = curryIconsHTML(c.materials, c.spice, '16px');
    statusEl.innerHTML = `${iconsHTML} HP:${statDisplayWithTableware('hp', c.hp)} / ATK:${statDisplayWithTableware('atk', c.atk)} / DEF:${statDisplayWithTableware('def', c.def)} / SPD:${statDisplayWithTableware('spd', c.spd)}`;
}

function createMatchRoom() {
    if(!checkDatabase()) return;
    const cIdx = document.getElementById("globalCurrySelect").value;
    if(cIdx == -1 || !curryStock[cIdx]) { alert("カレーを選択してください"); return; }
    isBotMatch = false;
    const selectedCurry = curryStock[cIdx];
    const pass = document.getElementById("createRoomPassword").value.trim();
    const rid = 'room_' + Math.random().toString(36).substr(2, 9);
    currentRoomId = rid;
    myRoomRef = database.ref('rooms/' + rid);
    const roomMessage = document.getElementById("createRoomMessage").value;
    myRoomRef.set({ hostUid: currentUid, hostName: playerName, hostCurry: selectedCurry, hostIcon: currentIconFile, guestName: "", guestCurry: null, guestIcon: "", status: "waiting", hasPassword: !!pass, password: pass, message: roomMessage });
    document.getElementById("lobbyArea").style.display = "none";
    document.getElementById("waitingArea").style.display = "block";
    myRoomRef.on('value', snap => {
        const data = snap.val();
        if(data && data.status === "ready") {
            myRoomRef.off('value');
            startOnlineBattle(data.hostName, data.hostCurry, data.guestName, data.guestCurry, "host", data.hostIcon, data.guestIcon);
        }
    });
}

function joinMatchRoom(rid, has) {
    if(!checkDatabase()) return;
    const cIdx = document.getElementById("globalCurrySelect").value;
    if(cIdx == -1) { alert("カレーを選択してください"); return; }
    const myCurry = curryStock[cIdx];
    if(has) {
        const pass = prompt("合言葉:");
        database.ref('rooms/' + rid).once('value').then(snap => {
            if(snap.val() && snap.val().password === pass) proceedJoin(rid, myCurry);
            else alert("合言葉エラー");
        });
    } else proceedJoin(rid, myCurry);
}

function proceedJoin(rid, myCurry) {
    const rRef = database.ref('rooms/' + rid);
    rRef.once('value').then(snap => {
        const roomData = snap.val();
        if(!roomData || roomData.status !== "waiting") return;
        currentRoomId = rid; // ゲスト側もroomIdを保持
        rRef.update({ guestUid: currentUid, guestName: playerName, guestCurry: myCurry, guestIcon: currentIconFile, status: "ready" }).then(() => {
            startOnlineBattle(roomData.hostName, roomData.hostCurry, playerName, myCurry, "guest", roomData.hostIcon, currentIconFile);
            // ルームデータの削除はホスト側のdone()に任せる（ゲストは削除しない）
        });
    });
}

function startOnlineBattle(hN, hC, gN, gC, role, hI, gI) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isBotMatch = false;
    onlineRole = role;
    const oppC = role === "host" ? gC : hC;
    const oppN = role === "host" ? gN : hN;
    cachedOpponentName = oppN; cachedOpponentCurry = oppC;
    const myC = role === "host" ? hC : gC;
    currentBattleCurry = myC;
    cachedMyIconFile = role === "host" ? (hI || "myimageicon/mayimage01.png") : (gI || "myimageicon/mayimage01.png");
    cachedOppIconFile = role === "host" ? (gI || "myimageicon/mayimage01.png") : (hI || "myimageicon/mayimage01.png");

    // VSカットイン表示
    const vs = document.getElementById("vsCutIn");
    if(vs) { vs.style.display = "flex"; vs.style.opacity = "1"; playVsSound(); }
    const vsInteractive = vs ? vs.querySelector('.vs-interactive-area') : null;
    if(vsInteractive) vsInteractive.style.display = "none";
    if(document.getElementById("vsPlayerName")) document.getElementById("vsPlayerName").innerText = playerName;
    if(document.getElementById("vsEnemyName")) document.getElementById("vsEnemyName").innerText = oppN;
    if(document.getElementById("vsEnemyCurry")) document.getElementById("vsEnemyCurry").innerText = oppC.name;
    const vsPlayerVisualArea = document.getElementById("vsPlayerVisual");
    const vsEnemyVisualArea = document.getElementById("vsEnemyVisual");
    if(vsPlayerVisualArea) vsPlayerVisualArea.innerHTML = `<img src="${cachedMyIconFile}" style="width:100px;height:100px;border-radius:50%;border:3px solid #e67e22;object-fit:cover;">`;
    if(vsEnemyVisualArea) vsEnemyVisualArea.innerHTML = `<img src="${cachedOppIconFile}" style="width:100px;height:100px;border-radius:50%;border:3px solid #3498db;object-fit:cover;">`;
    const pSide = document.getElementById("vsPlayerSide");
    const eSide = document.getElementById("vsEnemySide");
    const vBadge = document.getElementById("vsBadge");
    if(pSide) pSide.style.transform = "translateX(-100%)";
    if(eSide) eSide.style.transform = "translateX(100%)";
    setTimeout(() => { if(pSide) pSide.style.transform = "translateX(0)"; }, 100);
    setTimeout(() => { if(eSide) eSide.style.transform = "translateX(0)"; }, 300);
    setTimeout(() => { if(vBadge) { vBadge.style.opacity = "1"; vBadge.style.scale = "1"; } }, 600);

    // 3秒後にバトル開始
    setTimeout(() => {
        if(vs) vs.style.display = "none";
        document.getElementById("battleSetup").style.display = "none";
        document.getElementById("battleArena").style.display = "block";
        startBattleScene(oppN, oppC, myC);
    }, 3000);
}

// ===== SPD比率に応じた各種判定ヘルパー =====
function getCritRate(mySpd, oppSpd) {
    const ratio = mySpd / Math.max(1, oppSpd);
    if(ratio >= 10) return 0.30;
    if(ratio >= 5)  return 0.20;
    if(ratio >= 3)  return 0.15;
    if(ratio >= 2)  return 0.10;
    if(ratio >= 1.5) return 0.07;
    if(ratio >= 1)  return 0.05;
    return 0.03;
}
function getIllusionMissRate(mySpd, oppSpd) {
    // 自分が幻惑状態のとき、自分のSPDが相手以上なら30%ミス、未満なら50%ミス
    return mySpd >= oppSpd ? 0.30 : 0.50;
}
function getSeedHitsRange(mySpd, oppSpd) {
    const ratio = mySpd / Math.max(1, oppSpd);
    if(ratio >= 1.5) return { min: 4, max: 8 };
    if(ratio >= 1)   return { min: 3, max: 7 };
    return { min: 2, max: 6 };
}
// わんぱくカレー：通常攻撃ダメージ1〜2倍の振れ幅、20%でミス
function getWanpakuDamageMultiplier() { return 1 + Math.random() * 0.5; } // 1.0〜1.5
function isWanpakuMiss() { return Math.random() < 0.30; }

// ラタトゥイユカレー：肉系食材を使ったカレーからの通常攻撃を80%軽減（=ダメージ0.2倍）
const RATATOUILLE_GUARD_LIST = ["牛肉","牛タン","牛すじ","チキン","唐揚げ","トンカツ","ウインナー","合鴨"];
function isMeatBasedCurry(curry) {
    if(!curry || !curry.materials) return false;
    return curry.materials.some(m => RATATOUILLE_GUARD_LIST.includes(m));
}
// Bot戦で「肉系」とみなすBot名（魔術師レオン／ガンコ親父／ドラゴン料理長）
const RATATOUILLE_GUARD_BOT_NAMES = ["魔術師レオン","ガンコ親父","ドラゴン料理長","悪ガキサタン君"];
function isMeatBasedBot(botName) {
    return RATATOUILLE_GUARD_BOT_NAMES.some(n => botName && botName.includes(n));
}

// ホームランカレー：種連射・熱々ブレスを20%で打ち返し無効化
function isHomerunReflect(mySpd, oppSpd) {
    const ratio = mySpd / Math.max(1, oppSpd);
    const rate = ratio >= 1.5 ? 0.30 : ratio >= 1 ? 0.25 : 0.20;
    return Math.random() < rate;
}

function rollSeedHits(mySpd, oppSpd) {
    const r = getSeedHitsRange(mySpd, oppSpd);
    const hits = Math.floor(Math.random() * (r.max - r.min + 1)) + r.min;
    // 種連射の最大連撃数を記録（実績用）
    const s = getStats();
    if(hits > (s.seedMaxHits || 0)) { updateStats(st => { st.seedMaxHits = hits; }); }
    return hits;
}

// ===== バトル全ターン事前計算 =====
function calcAllBattleTurns(myC, oppC, oppN, myName) {
    let turns = [];
    let pHP = myC.hp, oHP = oppC.hp;
    // 毒りんご(isPoisonApple)は戦闘開始時には発動しない（通常攻撃ヒット時のみ）
    let isOP = !!myC.isPoison && !myC.isPoisonApple, isPP = !!oppC.isPoison && !oppC.isPoisonApple;
    let poisonLevelO = isOP ? 1 : 0; // oppC(相手)の毒レベル。1段階ごとに+8%、最大6（48%）
    let poisonLevelP = isPP ? 1 : 0; // myC(自分)の毒レベル
    let myIsIlluded = !!oppC.isIllusion, oppIsIlluded = !!myC.isIllusion;
    // 🥚ふわとろオム：戦闘開始時に軽減対象の系統を抽選（肉/海鮮/野菜/果実、該当なし食材は対象外）
    const FLUFFY_CATEGORY_LABEL = { meat: '肉系', seafood: '海鮮系', vegetable: '野菜系', fruit: '果実系' };
    const FLUFFY_CATEGORY_KEYS = Object.keys(FLUFFY_CATEGORY_LABEL);
    let myFluffyCategory = (myC.isFluffyOmelette || myC.isTriCaviar) ? FLUFFY_CATEGORY_KEYS[Math.floor(Math.random()*FLUFFY_CATEGORY_KEYS.length)] : null;
    let oppFluffyCategory = (oppC.isFluffyOmelette || oppC.isTriCaviar) ? FLUFFY_CATEGORY_KEYS[Math.floor(Math.random()*FLUFFY_CATEGORY_KEYS.length)] : null;
    let statusLines = [];
    const fluffyLabel = (c) => c.isTriCaviar ? '三大珍味バリア' : 'ふわとろバリア';
    if(myFluffyCategory) statusLines.push(`🥚 ${myName} は${fluffyLabel(myC)}により${FLUFFY_CATEGORY_LABEL[myFluffyCategory]}からの攻撃を軽減する！`);
    if(oppFluffyCategory) statusLines.push(`🥚 ${oppN} は${fluffyLabel(oppC)}により${FLUFFY_CATEGORY_LABEL[oppFluffyCategory]}からの攻撃を軽減する！`);
    // 👑世界三大珍味：戦闘開始時の幻惑・毒（毒りんごは除く）を無効化する
    if(myC.isTriCaviar) {
        if(isPP) { isPP = false; poisonLevelP = 0; statusLines.push(`👑 更に毒も効きませんのよ！`); }
        if(oppC.isIllusion) { statusLines.push(`👑 更に幻惑も効きませんのよ！`); }
    }
    if(oppC.isTriCaviar) {
        if(isOP) { isOP = false; poisonLevelO = 0; statusLines.push(`👑 更に毒も効きませんのよ！`); }
        if(myC.isIllusion) { statusLines.push(`👑 更に幻惑も効きませんのよ！`); }
    }
    if(isOP) statusLines.push(`☠️ ${oppN} は毒にかかった！毎ターン毒ダメージ！`);
    if(isPP) statusLines.push(`☠️ ${myName} は毒にかかった！毎ターン毒ダメージ！`);
    if(myC.isIllusion && !oppC.isTriCaviar) statusLines.push(`🌀 ${oppN} は幻惑にかかった！攻撃命中率ダウン！`);
    if(oppC.isIllusion && !myC.isTriCaviar) statusLines.push(`🌀 ${myName} は幻惑にかかった！攻撃命中率ダウン！`);
    let myTurn;
    if(myC.isSticky && !oppC.isSticky) { myTurn=true; statusLines.push(`💚 ${oppN} はネバネバにかかった！${myName} の先攻攻撃！`); }
    else if(oppC.isSticky && !myC.isSticky) { myTurn=false; statusLines.push(`💚 ${myName} はネバネバにかかった！${oppN} の先攻攻撃！`); }
    else myTurn = myC.spd >= oppC.spd;
    let seaHealUsed = false; // 海鮮カレーHP回復フラグ

    for(let round = 1; round <= 50; round++) {
        if(pHP <= 0 || oHP <= 0) break;
        let turn = { round, hostHP: pHP, guestHP: oHP, log: '', effects: [], statusLines: round===1 ? statusLines : [], actorIsHost: myTurn };
        if(myTurn) {
            turn.log = `{{TURNICON}} {{ACTOR}} のターン！`;
            // 海鮮カレー：HP50%以下で1回だけHP回復
            if(myC.isSeafood && !seaHealUsed && pHP <= Math.floor(myC.hp * 0.5)) {
                seaHealUsed = true;
                const seaHeal = Math.round(myC.hp * (myC.spd >= oppC.spd ? 0.4 : 0.3));
                pHP = Math.min(myC.hp, pHP + seaHeal);
                turn.log += `\n🌊 ${myName}は波の音に癒された。HP回復+${seaHeal}`;
                turn.effects.push({type:'player-heal', dmg:seaHeal, seaHeal:true});
            }
            if(myC.isRatatouille) { let heal=Math.round(myC.hp*0.10); pHP=Math.min(myC.hp,pHP+heal); turn.log+=`
☀️ 太陽の光を浴びてHP回復: ${heal}`; turn.effects.push({type:'player-heal',dmg:heal}); }
            if(isPP) { let d=Math.round(myC.hp*0.08*poisonLevelP); pHP=Math.max(0,pHP-d); turn.log+=`
☠️ 毒ダメージ: ${d}`; if(!turn.effects) turn.effects=[]; turn.effects.push({type:'player-poison',dmg:d}); if(pHP<=0){ turn.hostHP=pHP; turn.guestHP=oHP; turns.push(turn); break; } }
            if(myIsIlluded && Math.random() < getIllusionMissRate(myC.spd, oppC.spd)) {
                turn.log+=`
💨 幻惑で攻撃が外れた！`;
            } else if((myC.isWanpaku || myC.isTonTonTon) && isWanpakuMiss()) {
                turn.log+=`
💨 わんぱくが暴れすぎて攻撃が外れた！`;
            } else if(myC.isSeed && Math.random()<0.3) {
                const hits=rollSeedHits(myC.spd, oppC.spd); let seedDmgs=[]; let seedSpicy=0;
                for(let i=0;i<hits;i++){let sd=Math.max(2,Math.round(myC.atk*0.4-Math.floor(oppC.def/4)));sd=Math.round(sd*(0.9+Math.random()*0.2));if(Math.random()<getCritRate(myC.spd,oppC.spd)){sd=Math.round(sd*2);seedSpicy++;}seedDmgs.push(sd);oHP=Math.max(0,oHP-sd);}
                turn.log+=`\n🌱 種連続発射 ${hits}連撃！`+(seedSpicy>0?` 🌶️ SpicyHit×${seedSpicy}！`:'')+` 合計: ${seedDmgs.reduce((a,b)=>a+b,0)}`;
                seedDmgs.forEach(sd=>turn.effects.push({type:'enemy',dmg:sd,seed:true}));
            } else if(myC.isGreenCurry && Math.random()<0.35) {
                // 🟢ヒリヒリクラッシュ：相手がホームランを持っていれば打ち返されるが、反動は必ずくらう
                const selfDmg = Math.round(myC.hp * 0.10);
                pHP = Math.max(0, pHP - selfDmg);
                if(oppC.isHomerun && isHomerunReflect(oppC.spd, myC.spd)) {
                    turn.log+=`
🏏 ホームラン！{{ACTOR}}のヒリヒリクラッシュを打ち返した！`;
                    turn.log+=`
🌶️ 反動で{{ACTOR}}にも${selfDmg}ダメージ！`;
                    turn.effects.push({type:'homerun-reflect'});
                    turn.effects.push({type:'player-selfdmg',dmg:selfDmg});
                } else {
                    let d = Math.max(8, Math.round(myC.atk * (1.1 + Math.random()*0.4)) - Math.floor(oppC.def/2));
                    oHP = Math.max(0, oHP - d);
                    turn.log+=`
🌶️🔥 ヒリヒリクラッシュ！{{DMGLABEL}}: ${d}`;
                    turn.log+=`
🌶️ 反動で{{ACTOR}}にも${selfDmg}ダメージ！`;
                    turn.effects.push({type:'enemy-hirihiri',dmg:d});
                    turn.effects.push({type:'player-selfdmg',dmg:selfDmg});
                }
            } else {
                const isCrit = Math.random() < getCritRate(myC.spd, oppC.spd);
                let d = isCrit ? Math.max(8, myC.atk) : Math.max(8,myC.atk-Math.floor(oppC.def/2));
                d=Math.round(d*(0.9+Math.random()*0.2));
                if(myC.isWanpaku || myC.isTonTonTon) d=Math.round(d*getWanpakuDamageMultiplier());
                if(oppC.isRatatouille && isMeatBasedCurry(myC)) d=Math.round(d*0.2);
                let myFluffyBlocked = false;
                if(oppFluffyCategory && curryHasCategory(myC, oppFluffyCategory)) { d=Math.round(d*0.7); myFluffyBlocked = true; }
                oHP=Math.max(0,oHP-d);
                if(isCrit){turn.log+=`
🌶️ Spicy Hit!!!!!!!! {{DMGLABEL}}: ${d}`;turn.effects.push({type:'enemy-crit',dmg:d});}
                else if(myC.hasGold){turn.log+=`
🌟 金箔乱舞！{{DMGLABEL}}: ${d}`;turn.effects.push({type:'enemy-gold',dmg:d});}
                else{turn.log+=`
{{DMGLABEL}}: ${d}`;turn.effects.push({type:'enemy',dmg:d});}
                if(myFluffyBlocked) { turn.log+=`
🥚 ${getBarrierLabel(oppC)}により${FLUFFY_CATEGORY_LABEL[oppFluffyCategory]}からの攻撃を軽減`; }
                // 🍎☠️毒りんご：通常攻撃ヒット時50%で相手を毒状態にする／既に毒なら増幅
                if(myC.isPoisonApple && Math.random() < 0.5) {
                    if(!isOP) { isOP = true; poisonLevelO = 1; turn.log+=`
☠️ ${oppN} は毒にかかった！`; turn.effects.push({type:'poison-newly-enemy'}); }
                    else if(poisonLevelO < 6) { poisonLevelO++; turn.log+=`
☠️ 毒のダメージが増幅`; turn.effects.push({type:'poison-amplify-enemy'}); }
                }
            }
        } else {
            turn.log = `{{TURNICON}} {{ACTOR}} のターン！`;
            if(isOP) { let d=Math.round(oppC.hp*0.08*poisonLevelO);oHP=Math.max(0,oHP-d);turn.log+=`
☠️ 毒ダメージ: ${d}`; if(!turn.effects) turn.effects=[]; turn.effects.push({type:'enemy-poison',dmg:d}); if(oHP<=0){ turn.hostHP=pHP; turn.guestHP=oHP; turn.finishedByPoison=true; turns.push(turn); break; } }
            if(oppIsIlluded && Math.random() < getIllusionMissRate(oppC.spd, myC.spd)) {
                turn.log+=`
💨 幻惑で{{ACTOR}}の攻撃が外れた！`;
            } else if((oppC.isWanpaku || oppC.isTonTonTon) && isWanpakuMiss()) {
                turn.log+=`
💨 {{ACTOR}}のわんぱくが暴れすぎて攻撃が外れた！`;
            } else if(oppC.isSeed && Math.random()<0.3) {
                if(myC.isHomerun && isHomerunReflect(myC.spd, oppC.spd)) {
                    turn.log+=`
🏏 ホームラン！{{ACTOR}}の種連続発射を打ち返して無効化！`;
                    turn.effects.push({type:'homerun-reflect'});
                } else {
                    const hits=rollSeedHits(oppC.spd, myC.spd); let seedDmgs=[]; let seedSpicy2=0;
                    for(let i=0;i<hits;i++){let sd=Math.max(2,Math.round(oppC.atk*0.4-Math.floor(myC.def/4)));sd=Math.round(sd*(0.9+Math.random()*0.2));if(Math.random()<getCritRate(oppC.spd,myC.spd)){sd=Math.round(sd*2);seedSpicy2++;}seedDmgs.push(sd);pHP=Math.max(0,pHP-sd);}
                    turn.log+=`\n🌱 {{ACTOR}}の種連続発射 ${hits}連撃！`+(seedSpicy2>0?` 🌶️ SpicyHit×${seedSpicy2}！`:'')+` 合計: ${seedDmgs.reduce((a,b)=>a+b,0)}`;
                    seedDmgs.forEach(sd=>turn.effects.push({type:'player',dmg:sd,seed:true}));
                }
            } else if(oppC.isGreenCurry && Math.random()<0.35) {
                // 🟢ヒリヒリクラッシュ：自分がホームランを持っていれば打ち返せるが、相手の反動は必ず発生する
                const selfDmg = Math.round(oppC.hp * 0.10);
                oHP = Math.max(0, oHP - selfDmg);
                if(myC.isHomerun && isHomerunReflect(myC.spd, oppC.spd)) {
                    turn.log+=`
🏏 ホームラン！{{ACTOR}}のヒリヒリクラッシュを打ち返した！`;
                    turn.log+=`
🌶️ 反動で{{ACTOR}}にも${selfDmg}ダメージ！`;
                    turn.effects.push({type:'homerun-reflect'});
                    turn.effects.push({type:'enemy-selfdmg',dmg:selfDmg});
                } else {
                    let d = Math.max(8, Math.round(oppC.atk * (1.1 + Math.random()*0.4)) - Math.floor(myC.def/2));
                    pHP = Math.max(0, pHP - d);
                    turn.log+=`
🌶️🔥 {{ACTOR}}のヒリヒリクラッシュ！{{DMGLABEL}}: ${d}`;
                    turn.log+=`
🌶️ 反動で{{ACTOR}}にも${selfDmg}ダメージ！`;
                    turn.effects.push({type:'player-hirihiri',dmg:d});
                    turn.effects.push({type:'enemy-selfdmg',dmg:selfDmg});
                }
            } else {
                const isCrit = Math.random() < getCritRate(oppC.spd, myC.spd);
                let d = isCrit ? Math.max(8, oppC.atk) : Math.max(8,oppC.atk-Math.floor(myC.def/2));
                d=Math.round(d*(0.9+Math.random()*0.2));
                if(oppC.isWanpaku) d=Math.round(d*getWanpakuDamageMultiplier());
                if(myC.isRatatouille && isMeatBasedCurry(oppC)) d=Math.round(d*0.2);
                let oppFluffyBlocked = false;
                if(myFluffyCategory && curryHasCategory(oppC, myFluffyCategory)) { d=Math.round(d*0.7); oppFluffyBlocked = true; }
                pHP=Math.max(0,pHP-d);
                if(isCrit){turn.log+=`
🌶️ Spicy Hit!!!!!!!! {{DMGLABEL}}: ${d}`;turn.effects.push({type:'player-crit',dmg:d});}
                else{turn.log+=`
{{DMGLABEL}}: ${d}`;turn.effects.push({type:'player',dmg:d});}
                if(oppFluffyBlocked) { turn.log+=`
🥚 ${getBarrierLabel(myC)}により${FLUFFY_CATEGORY_LABEL[myFluffyCategory]}からの攻撃を軽減`; }
                // 🍎☠️毒りんご：通常攻撃ヒット時50%で相手を毒状態にする／既に毒なら増幅
                if(oppC.isPoisonApple && Math.random() < 0.5) {
                    if(!isPP) { isPP = true; poisonLevelP = 1; turn.log+=`
☠️ ${myName} は毒にかかった！`; turn.effects.push({type:'poison-newly-player'}); }
                    else if(poisonLevelP < 6) { poisonLevelP++; turn.log+=`
☠️ 毒のダメージが増幅`; turn.effects.push({type:'poison-amplify-player'}); }
                }
            }
        }
        // ターン終了時に必ず最新HPを確定（幻惑ミス含む全ケース対応）
        turn.hostHP = pHP;
        turn.guestHP = oHP;
        myTurn=!myTurn;
        turns.push(turn);
    }
    return turns;
}

// ===== ターンを順番に再生（ホスト・ゲスト共通）=====
function playBattleTurns(turns, myC, oppC, oppN, role) {
    const log = document.getElementById("battleLog");
    const isGuest = role === 'guest';
    let idx = 0;

    // 状態異常テキスト表示
    let openingDelay = 600; // 最初のターン開始までの待機時間（戦闘開始メッセージの表示時間を確保）
    if(turns.length > 0 && turns[0].statusLines && turns[0].statusLines.length > 0) {
        turns[0].statusLines.forEach(line => { log.innerHTML += '\n' + line; });
        // 戦闘開始メッセージも戦闘ログ履歴に残す
        battleLogHistory.push(turns[0].statusLines.join('\n'));
        const hasPoison = turns[0].statusLines.some(l => l.includes('毒にかかった'));
        const hasIllusion = turns[0].statusLines.some(l => l.includes('幻惑にかかった'));
        // 毒・幻惑演出（順番にゆっくり実行）
        let ptDelay = 800;
        turns[0].statusLines.forEach(line => {
            if(line.includes('毒にかかった')) {
                const targetIsPlayer = line.includes(isGuest ? oppN : playerName);
                const el = targetIsPlayer ? document.getElementById('oppOwnerText') : document.getElementById('pOwnerText');
                const d = ptDelay;
                setTimeout(()=>{ playSoundEffect('poison.mp3'); playStatusFlash('poison'); if(el) el.classList.add('name-poisoned'); }, d);
                ptDelay += 2000;
            }
            if(line.includes('幻惑にかかった')) {
                const targetIsPlayer = line.includes(isGuest ? oppN : playerName);
                const el = targetIsPlayer ? document.getElementById('oppOwnerText') : document.getElementById('pOwnerText');
                const d = ptDelay;
                setTimeout(()=>{ playSoundEffect('genwaku.mp3'); playStatusFlash('illusion'); if(el) el.classList.add('name-illuded'); }, d);
                ptDelay += 2000;
            }
            if(line.includes('ふわとろバリア')) {
                // 既存の毒・幻惑と同じ判定パターン（el = targetIsPlayer ? oppOwnerText : pOwnerText と同じ対応）
                const targetIsPlayer = line.includes(isGuest ? oppN : playerName);
                const zoneTarget = targetIsPlayer ? 'enemy' : 'player';
                const d = ptDelay;
                setTimeout(()=>{ playSoundEffect('healing.mp3'); triggerFluffyBarrierEffect(zoneTarget); }, d);
                ptDelay += 1800;
            }
        });
        openingDelay = ptDelay + 200; // 全ての開始演出が終わるまでログを残し、その後最初のターンへ
    }

    function playTurn() {
        if(idx >= turns.length) {
            const last = turns[turns.length-1];
            const myHP = isGuest ? last.guestHP : last.hostHP;
            const oppHP = isGuest ? last.hostHP : last.guestHP;
            // 毒で相手を倒した場合の実績（毒カレーを使っていた側=ホストでのみ記録）
            if(last.finishedByPoison && !isGuest) { window.__defeatedByPoison = true; }
            setTimeout(() => done(myHP, oppHP, myC, oppC), 800);
            return;
        }
        const turn = turns[idx++];
        const myHP = isGuest ? turn.guestHP : turn.hostHP;
        const oppHP = isGuest ? turn.hostHP : turn.guestHP;

        // プレースホルダーを各視点の名前に変換（ホストかゲストかで自分/相手が入れ替わる）
        // turn.actorIsHost: ホストが行動者か。isGuest: 自分がゲストか。
        // {{ACTOR}}は常に「ターンを取っている行動者」を指す。行動者が自分ならplayerName、相手ならoppN
        // {{DMGLABEL}}は行動者が自分なら「💥 ダメージ」、相手なら「😢 被弾ダメージ」
        // {{TURNICON}}は行動者が自分なら🔥、相手なら⚠️
        const isMyTurnNow = (turn.actorIsHost === !isGuest);
        let resolvedLog = turn.log
            .replace(/\{\{ACTOR\}\}/g, isMyTurnNow ? playerName : oppN)
            .replace(/\{\{DMGLABEL\}\}/g, isMyTurnNow ? '💥 ダメージ' : '😢 被弾ダメージ')
            .replace(/\{\{TURNICON\}\}/g, isMyTurnNow ? '🔥' : '⚠️');

        log.innerHTML = resolvedLog;
        if(resolvedLog.includes('💨')) playSoundEffect('sound/miss.mp3');
        // 種連射演出（オンライン/ルーム戦）
        // 自分がアクター→味方bg、相手がアクター→敵bg
        // ホームラン割り込みも：自分の種連射を相手が打ち返す→敵bgホームラン、相手の種連射を自分が打ち返す→味方bgホームラン
        if(resolvedLog.includes('🌱 種連続発射')) {
            const _actorIsMe = (turn.actorIsHost === (onlineRole === 'host'));
            const _seedCfg   = _actorIsMe ? SEED_PLAYER_ALLY_CONFIG : SEED_PLAYER_ENEMY_CONFIG;
            const _hasHR     = turn.effects.some(function(e){ return e.type === 'homerun-reflect'; });
            const _intrCfg   = _actorIsMe ? HOMERUN_ANIM_CONFIG_ENEMY : HOMERUN_ANIM_CONFIG;
            playTanemakiAnimation(Object.assign({}, _seedCfg, { interruptConfig: _intrCfg }), _hasHR, function(){});
        }
        battleLogHistory.push(resolvedLog.replace(/<br\s*\/?>/gi, '\n'));
        playTone(isMyTurnNow ? 440 : 330, 'triangle', 0.08);
        updateHP(myHP, oppHP, oppC.hp, myC.hp);

        const effects = turn.effects || [];
        const seedEffects = effects.filter(e => e.seed);
        const normalEffects = effects.filter(e => !e.seed);

        // 通常エフェクト
        normalEffects.forEach(e => {
            let ef = e.type;
            if(ef === 'homerun-reflect') {
                playBattleSkillAnimation(HOMERUN_ANIM_CONFIG, function(){});
                return;
            }
            if(ef === 'poison-amplify-enemy' || ef === 'poison-amplify-player') {
                if(isGuest) ef = (ef === 'poison-amplify-enemy') ? 'poison-amplify-player' : 'poison-amplify-enemy';
                playSoundEffect('poison.mp3');
                return;
            }
            if(ef === 'poison-newly-enemy' || ef === 'poison-newly-player') {
                if(isGuest) ef = (ef === 'poison-newly-enemy') ? 'poison-newly-player' : 'poison-newly-enemy';
                playSoundEffect('poison.mp3');
                const targetId = (ef === 'poison-newly-enemy') ? 'oppOwnerText' : 'pOwnerText';
                const el = document.getElementById(targetId);
                if(el) el.classList.add('name-poisoned');
                return;
            }
            if(ef === 'fluffy-barrier-enemy' || ef === 'fluffy-barrier-player') {
                if(isGuest) ef = (ef === 'fluffy-barrier-enemy') ? 'fluffy-barrier-player' : 'fluffy-barrier-enemy';
                playSoundEffect('healing.mp3');
                triggerFluffyBarrierEffect(ef === 'fluffy-barrier-enemy' ? 'enemy' : 'player');
                return;
            }
            if(isGuest) {
                if(ef === 'player') ef = 'enemy';
                else if(ef === 'enemy' || ef === 'enemy-gold') ef = 'player';
                else if(ef === 'player-poison') ef = 'enemy-poison';
                else if(ef === 'enemy-poison') ef = 'player-poison';
                else if(ef === 'player-crit') ef = 'enemy-crit';
                else if(ef === 'enemy-crit') ef = 'player-crit';
                else if(ef === 'player-heal') ef = 'enemy-heal';
                else if(ef === 'enemy-heal') ef = 'player-heal';
                else if(ef === 'player-hirihiri') ef = 'enemy-hirihiri';
                else if(ef === 'enemy-hirihiri') ef = 'player-hirihiri';
                else if(ef === 'player-selfdmg') ef = 'enemy-selfdmg';
                else if(ef === 'enemy-selfdmg') ef = 'player-selfdmg';
            }
            if(ef === 'enemy-hirihiri' || ef === 'player-hirihiri' || ef === 'enemy-selfdmg' || ef === 'player-selfdmg') {
                const isEnemySide = ef.startsWith('enemy');
                triggerHirihiriEffect(isEnemySide ? 'enemy' : 'player', e.dmg);
                if(ef.includes('hirihiri')) playSoundEffect('hirihiri.mp3');
                return;
            }
            triggerEffect(ef, e.dmg);
            if(ef.includes('heal')) { playSoundEffect(e.seaHeal ? 'healing.mp3' : 'taiyou.mp3'); return; }
            if(ef.includes('crit')) { /* spicyhit.mp3はtriggerEffect内で再生 */ }
            else if(ef === 'enemy-gold') { playGoldSound(); playSoundEffect('punch.mp3'); }
            else if(ef.includes('poison')) playSoundEffect('poison.mp3');
            else if(e.breath) playSoundEffect('breath.mp3');
            else if((isGuest ? myC : oppC).isTonTonTon && (ef === 'player'||ef==='player-crit')) playSoundEffect('pig1.mp3');
            else if((isGuest ? oppC : myC).isTonTonTon && (ef === 'enemy'||ef==='enemy-crit')) playSoundEffect('pig2.mp3');
            else playSoundEffect('punch.mp3');
        });

        // 種連射エフェクト（連射が終わってから次ターンへ）
        if(seedEffects.length > 0) {
            const totalSeedTime = seedEffects.length * 250;
            // machine-gun.mp3を少し遅らせて確実に再生
            setTimeout(() => { playSoundEffect('machine-gun.mp3'); }, 50);
            seedEffects.forEach((e, i) => {
                setTimeout(() => {
                    let ef = e.type;
                    if(isGuest) { if(ef === 'player') ef = 'enemy'; else if(ef === 'enemy') ef = 'player'; }
                    triggerEffect(ef, e.dmg);
                }, 100 + i * 250);
            });
            // 種連射が終わった後に次ターンへ
            setTimeout(playTurn, totalSeedTime + 900);
        } else {
            // 通常・幻惑ミス・何もなしすべて同じタイミングで次ターンへ
            setTimeout(playTurn, 1200);
        }
    }

    setTimeout(playTurn, openingDelay);
}

// ===== メインのバトル開始関数（Bot戦・対人戦共通）=====
let guestBattleRef = null;
// ===== イベント専用バトルシーン（既存battleArenaを流用、見た目だけevent-modeで上書き） =====
function startEventBattleScene(myC) {
    if(!database) { showCustomAlert("⚠️ 接続エラー", "イベントに参加できません。"); return; }
    // Firebaseから現在の共有HPを取得（なければ満タンで初期化）
    database.ref('events/tokumori001/currentHp').once('value').then(function(snap){
        let curHp = snap.val();
        if(curHp === null || curHp === undefined) curHp = EVENT_MONSTER_DATA.hp;
        curHp = Math.max(1, Math.min(EVENT_MONSTER_DATA.hp, curHp));
        launchEventBattle(myC, curHp);
    }).catch(function(){
        launchEventBattle(myC, EVENT_MONSTER_DATA.hp);
    });
}

function launchEventBattle(myC, startHp) {
    myC = applyTablewareModifiers(myC); // 食器補正を適用（startBattleSceneを経由しないイベント戦専用ルートのため個別に適用）
    hideQuestGuideChar(); // 対戦中は案内人を非表示
    window.__eventStartHp = startHp; // ランキング集計用に開始時HPを保持
    updateStats(s => { s.eventBattleJoined = true; });
    battleAborted = false;
    battleLogHistory = []; // 戦闘ログ蓄積をリセット
    if(guestBattleRef) { guestBattleRef.off(); guestBattleRef = null; }
    document.getElementById("battleResultBox").style.display = "none";
    const overlay2 = document.getElementById("battleResultOverlay"); if(overlay2) overlay2.style.display = "none";
    ["oppOwnerText","oHpText","pOwnerText","pHpText"].forEach(id => { const el=document.getElementById(id); if(el){ el.style.color=""; el.classList.remove("name-poisoned","name-illuded"); } });
    const pop = document.getElementById("damagePop"); pop.style.display="none"; pop.style.animation="none"; pop.innerText="0";

    document.getElementById("battleSetup").style.display = "none";
    document.getElementById("battleArena").style.display = "block";
    document.getElementById("battleStage").classList.add("event-mode");
    const bgWrap = document.getElementById("eventBgWrap");
    const bgImg = document.getElementById("eventBgImg");
    if(bgWrap && bgImg) { bgImg.src = "tokumori001.jpg"; bgWrap.style.display = "block"; }
    const evPlayerIcon = document.getElementById("eventPlayerIcon");
    if(evPlayerIcon) { evPlayerIcon.src = currentIconFile; evPlayerIcon.style.display = "block"; }

    requestAnimationFrame(() => {
        const arena = document.getElementById("battleArena");
        if(arena) arena.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.getElementById("pOwnerText").innerText = playerName;
    document.getElementById("playerCurryNameText").innerText = myC.name;
    const myMaterials = myC.materials, mySpice = myC.spice;
    const myIconsHtml = curryIconsHTML(myMaterials, mySpice, '22px');
    document.getElementById("pVisual").innerHTML = '';
    const pCurryIconsEl = document.getElementById("pCurryIcons");
    if(pCurryIconsEl) pCurryIconsEl.innerHTML = myIconsHtml || myC.visual || '';

    document.getElementById("oppCurryNameText").innerText = "";
    document.getElementById("oppCurryEmojiText").innerText = "";

    let pHP = myC.hp;
    let oHP = startHp;
    const oppC = { hp: EVENT_MONSTER_DATA.hp, atk: EVENT_MONSTER_DATA.atk, def: EVENT_MONSTER_DATA.def, spd: EVENT_MONSTER_DATA.spd, isEventBoss: true };
    let seaHealUsed = false; // 海鮮カレーHP回復フラグ

    // 怒りモード（HP50%以下）の状態管理
    let isEnraged = (oHP / oppC.hp) <= 0.5;

    function applyEnragedDisplay() {
        const nameEl = document.getElementById("oppOwnerText");
        if(nameEl) nameEl.innerText = EVENT_MONSTER_DATA.name + (isEnraged ? " 💢💢💢" : "");
        const barEl = document.getElementById("oWeightBar");
        if(barEl) { if(isEnraged) barEl.classList.add("event-enraged"); else barEl.classList.remove("event-enraged"); }
    }
    applyEnragedDisplay();

    // 🥚ふわとろオム／👑世界三大珍味：浪花のカレーライスベイビーは食材系統「該当なし」のため軽減は発生しないが、
    // バリアを張った演出・ログ表示自体は行う（意味はないが必ずバリアは張る）
    const FLUFFY_CATEGORY_LABEL_E = { meat: '肉系', seafood: '海鮮系', vegetable: '野菜系', fruit: '果実系' };
    const FLUFFY_CATEGORY_KEYS_E = Object.keys(FLUFFY_CATEGORY_LABEL_E);
    let myFluffyCategoryE = (myC.isFluffyOmelette || myC.isTriCaviar) ? FLUFFY_CATEGORY_KEYS_E[Math.floor(Math.random()*FLUFFY_CATEGORY_KEYS_E.length)] : null;

    updateHP(pHP, oHP, oppC.hp, myC.hp);
    const log = document.getElementById("battleLog"); log.innerHTML = `⚔️ ${EVENT_MONSTER_DATA.name}との決戦開始！`;
    if(myC.isPoison && !myC.isPoisonApple){ log.innerHTML += `\n☠️ ${EVENT_MONSTER_DATA.name} は毒にかかった！毎ターン毒ダメージ！`; }
    if(myC.isIllusion){ log.innerHTML += `\n🌀 ${EVENT_MONSTER_DATA.name} は幻惑にかかった！攻撃命中率ダウン！`; }
    if(myFluffyCategoryE){
        log.innerHTML += `\n🥚 ${playerName} は${getBarrierLabel(myC)}により${FLUFFY_CATEGORY_LABEL_E[myFluffyCategoryE]}からの攻撃を軽減する！`;
        setTimeout(()=>{ playSoundEffect('healing.mp3'); triggerFluffyBarrierEffect('player'); }, 900);
    }
    battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi, "\n"));

    stopBattleBGM();
    if(myC.isTriCaviar) setTimeout(()=>playBattleBGM("Specialdinner.mp3"),300);
    else setTimeout(()=>playBattleBGM(isEnraged ? "bossbgm2.mp3" : "bossbgm.mp3"),300);

    let isOppPoisoned = !!myC.isPoison && !myC.isPoisonApple; // 敵（モンスター）が毒状態か（イベント戦は毎ターン20〜40固定ダメージ）
    let eventPoisonLevel = isOppPoisoned ? 1 : 0; // 毒りんごによる増幅レベル（1段階+10、最大5段階で70〜90）
    let isOppIlluded = !!myC.isIllusion; // 敵（モンスター）が幻惑状態か（敵の攻撃がミスしやすくなる）
    let myTurn = myC.spd >= oppC.spd;
    let round = 1;

    // HP変化時に怒り状態をチェックし、変化があればBGM・表示・行動パターンを切り替える
    function checkEnragedTransition() {
        const nowEnraged = (oHP / oppC.hp) <= 0.5;
        if(nowEnraged !== isEnraged) {
            isEnraged = nowEnraged;
            applyEnragedDisplay();
            if(!myC.isTriCaviar) {
                stopBattleBGM();
                setTimeout(()=>playBattleBGM(isEnraged ? "bossbgm2.mp3" : "bossbgm.mp3"),200);
            }
        }
    }

    function eventStep(){
        if(battleAborted) return;
        if(pHP<=0){ eventBattleFinish(pHP, oHP, myC, false); return; }
        if(round>20){ eventBattleFinish(pHP, oHP, myC, false); return; }
        if(myTurn){
            log.innerHTML=`🔥 自分のターン！`;
            playTone(440,'triangle',0.08);
            // 海鮮カレー：HP50%以下で1回だけ回復
            if(myC.isSeafood && !seaHealUsed && pHP <= Math.floor(myC.hp * 0.5)) {
                seaHealUsed = true;
                const seaHeal = Math.round(myC.hp * (myC.spd >= oppC.spd ? 0.4 : 0.3));
                pHP = Math.min(myC.hp, pHP + seaHeal);
                log.innerHTML += `\n🌊 ${playerName}は波の音に癒された。HP回復+${seaHeal}`;
                playSoundEffect('healing.mp3');
                triggerEffect("player-heal", seaHeal);
                updateHP(pHP, oHP, oppC.hp, myC.hp);
            }
            if(myC.isRatatouille){ let heal=Math.round(myC.hp*0.10); pHP=Math.min(myC.hp,pHP+heal); log.innerHTML+=`\n☀️ 太陽の光を浴びてHP回復: ${heal}`; playSoundEffect('taiyou.mp3'); triggerEffect("player-heal",heal); updateHP(pHP,oHP,oppC.hp,myC.hp); }
            if((myC.isWanpaku || myC.isTonTonTon) && isWanpakuMiss()){
                if(myC.isTonTonTon) playSoundEffect('pig2.mp3');
                playSoundEffect('sound/miss.mp3');
                log.innerHTML+=`\n💨 わんぱくが暴れすぎて攻撃が外れた！`;
                setTimeout(()=>{ updateHP(pHP,oHP,oppC.hp,myC.hp); battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=false; round++; setTimeout(eventStep,battleDelay(1100)); },battleDelay(400));
            } else if(myC.isSeed && Math.random()<0.3){
                log.innerHTML+=`\n🌱 種連続発射！`;
                playTanemakiAnimation(SEED_PLAYER_ALLY_CONFIG, false, function(){
                    const hits=rollSeedHits(myC.spd, oppC.spd); let damages=[]; let spicyCount=0;
                    for(let i=0;i<hits;i++){ let sd=Math.max(2,Math.round(myC.atk*0.4-Math.floor(oppC.def/4))); sd=Math.round(sd*(0.9+Math.random()*0.2)); if(Math.random()<getCritRate(myC.spd,oppC.spd)){sd=Math.round(sd*2);spicyCount++;} damages.push(sd); oHP=Math.max(1,oHP-sd); eventTotalDamageThisBattle+=sd; }
                    log.innerHTML+=`\n🌱 種連続発射 ${hits}連撃！`+(spicyCount>0?` 🌶️ SpicyHit×${spicyCount}！`:'');
                    setTimeout(()=>playSoundEffect('machine-gun.mp3'),battleDelay(50));
                    damages.forEach((sd,i)=>{ setTimeout(()=>{
                        triggerEffect("enemy",sd);
                        if(i===damages.length-1){
                            log.innerHTML+=` 合計: ${damages.reduce((a,b)=>a+b,0)}`;
                            updateHP(pHP,oHP,oppC.hp,myC.hp);
                            checkEnragedTransition();
                            battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=false; round++; setTimeout(eventStep,battleDelay(1300));
                        }
                    },150+i*250); });
                });
                return;
            } else if(myC.isGreenCurry && Math.random()<0.35){
                // 🟢ヒリヒリクラッシュ：浪花のカレーライスベイビーはホームランを持たないため打ち返しは発生しない
                playSoundEffect('hirihiri.mp3');
                setTimeout(()=>{
                    const selfDmg = Math.round(myC.hp * 0.10);
                    pHP = Math.max(0, pHP - selfDmg);
                    let d = Math.max(8, Math.round(myC.atk * (1.1 + Math.random()*0.4)) - Math.floor(oppC.def/2));
                    oHP = Math.max(1, oHP - d);
                    eventTotalDamageThisBattle += d;
                    log.innerHTML+=`\n🌶️🔥 ヒリヒリクラッシュ！💥 ダメージ: ${d}`;
                    log.innerHTML+=`\n🌶️ 反動で${playerName}にも${selfDmg}ダメージ！`;
                    triggerHirihiriEffect('enemy', d);
                    setTimeout(()=>triggerHirihiriEffect('player', selfDmg), 200);
                    updateHP(pHP,oHP,oppC.hp,myC.hp);
                    checkEnragedTransition();
                    battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=false; round++; setTimeout(eventStep,battleDelay(1100));
                },battleDelay(400));
            } else {
                setTimeout(()=>{
                    const isCrit = Math.random() < getCritRate(myC.spd, oppC.spd);
                    let d = isCrit ? Math.max(8, myC.atk) : Math.max(8, myC.atk - Math.floor(oppC.def/2));
                    d = Math.round(d*(0.9+Math.random()*0.2));
                    if(myC.isWanpaku || myC.isTonTonTon) d=Math.round(d*getWanpakuDamageMultiplier());
                    oHP = Math.max(1, oHP - d); // 絶対0にならない
                    eventTotalDamageThisBattle += d; // 与えたダメージをそのまま積算（敵の回復で相殺されない）
                    playSoundEffect('punch.mp3');
                    if(isCrit){ log.innerHTML+=`\n🌶️ Spicy Hit!!!!!!!! 💥 ダメージ: ${d}`; triggerEffect("enemy-crit",d); }
                    else if(myC.hasGold){ log.innerHTML+=`\n🌟 金箔乱舞！💥 ダメージ: ${d}`; triggerEffect("enemy-gold",d); }
                    else { log.innerHTML+=`\n💥 ダメージ: ${d}`; triggerEffect("enemy",d); }
                    // 🍎☠️毒りんご：通常攻撃ヒット時50%でモンスターを毒状態にする／既に毒なら増幅（最大5段階＝70〜90）
                    if(myC.isPoisonApple && Math.random() < 0.5) {
                        if(!isOppPoisoned) { isOppPoisoned = true; eventPoisonLevel = 1; log.innerHTML+=`\n☠️ ${EVENT_MONSTER_DATA.name} は毒にかかった！`; setTimeout(()=>playSoundEffect('poison.mp3'),battleDelay(300)); }
                        else if(eventPoisonLevel < 6) { eventPoisonLevel++; log.innerHTML+=`\n☠️ 毒のダメージが増幅`; setTimeout(()=>playSoundEffect('poison.mp3'),battleDelay(300)); }
                    }
                    updateHP(pHP,oHP,oppC.hp,myC.hp);
                    checkEnragedTransition();
                    battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=false; round++; setTimeout(eventStep,battleDelay(1100));
                },battleDelay(400));
            }
        } else {
            log.innerHTML=`⚠️ ${EVENT_MONSTER_DATA.name} のターン！`;
            playTone(330,'triangle',0.08);
            if(isOppPoisoned){ let d=20+Math.floor(Math.random()*21)+(eventPoisonLevel-1)*10; oHP=Math.max(1,oHP-d); eventTotalDamageThisBattle+=d; log.innerHTML+=`\n☠️ 毒ダメージ: ${d}`; triggerEffect("enemy-poison",d); updateHP(pHP,oHP,oppC.hp,myC.hp); checkEnragedTransition(); }
            if(round>=20){
                setTimeout(()=>{
                    log.innerHTML+=`\n💨 なんでやねん乱舞！吹き飛ばされた！`;
                    playSoundEffect('ransya.mp3');
                    eventBattleFinish(pHP,oHP,myC,true);
                },battleDelay(400));
                return;
            }
            const er=Math.random();
            if(!isEnraged) {
                // ===== 通常モード：通常50% / 熱々ブレス20% / 五月雨突き20% / たこ焼き10% =====
                if(er<0.50){
                    if(isOppIlluded && Math.random() < getIllusionMissRate(oppC.spd, myC.spd)){
                        playSoundEffect('sound/miss.mp3');
                        log.innerHTML+=`\n💨 幻惑で${EVENT_MONSTER_DATA.name}の攻撃が外れた！`;
                        setTimeout(()=>{ updateHP(pHP,oHP,oppC.hp,myC.hp); battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1100)); },battleDelay(400));
                        return;
                    }
                    setTimeout(()=>{
                        const isCrit = Math.random() < getCritRate(oppC.spd, myC.spd);
                        let d = isCrit ? Math.max(8, oppC.atk) : Math.max(8, oppC.atk - Math.floor(myC.def/2));
                        d = Math.round(d*(0.9+Math.random()*0.2));
                        pHP = Math.max(0, pHP - d);
                        playSoundEffect('punch.mp3');
                        if(isCrit){ log.innerHTML+=`\n🌶️ Spicy Hit!!!!!!!! 💥 ダメージ: ${d}`; triggerEffect("player-crit",d); }
                        else { log.innerHTML+=`\n😢 被弾ダメージ: ${d}`; triggerEffect("player",d); }
                        updateHP(pHP,oHP,oppC.hp,myC.hp);
                        if(pHP<=0){ eventBattleFinish(pHP,oHP,myC,false); return; }
                        battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1100));
                    },battleDelay(400));
                } else if(er<0.70){
                    if(myC.isHomerun && isHomerunReflect(myC.spd, oppC.spd)){
                        log.innerHTML+=`\n🏏 ホームラン！熱々のカレーの雨を打ち返して無効化！`;
                        playBattleSkillAnimation(HOMERUN_ANIM_CONFIG, function(){ updateHP(pHP,oHP,oppC.hp,myC.hp); battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1100)); });
                        return;
                    } else {
                        setTimeout(()=>{
                            pHP=Math.max(0,pHP-80);
                            playSoundEffect('breath.mp3');
                            log.innerHTML+=`\n🔥 熱々のカレーの雨が街に降り注ぐ！DEF無視80ダメージ！`;
                            triggerEffect("player",80);
                            updateHP(pHP,oHP,oppC.hp,myC.hp);
                            if(pHP<=0){ eventBattleFinish(pHP,oHP,myC,false); return; }
                            battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1100));
                        },battleDelay(400));
                    }
                } else if(er<0.90){
                    if(myC.isHomerun && isHomerunReflect(myC.spd, oppC.spd)){
                        log.innerHTML+=`\n🏏 ホームラン！特大スプーンの五月雨突きを打ち返して無効化！`;
                        playBattleSkillAnimation(HOMERUN_ANIM_CONFIG, function(){ updateHP(pHP,oHP,oppC.hp,myC.hp); battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1100)); });
                        return;
                    }
                    const hits = rollSeedHits(oppC.spd, myC.spd);
                    let damages=[];
                    for(let i=0;i<hits;i++){ let sd=Math.max(2,Math.round(oppC.atk*0.4-Math.floor(myC.def/4))); sd=Math.round(sd*(0.9+Math.random()*0.2)); damages.push(sd); pHP=Math.max(0,pHP-sd); }
                    log.innerHTML+=`\n🥄 特大スプーンで五月雨突き！${hits}連撃！`;
                    setTimeout(()=>playSoundEffect('machine-gun.mp3'),battleDelay(50));
                    damages.forEach((sd,i)=>{ setTimeout(()=>{
                        triggerEffect("player",sd);
                        if(i===damages.length-1){
                            log.innerHTML+=` 合計: ${damages.reduce((a,b)=>a+b,0)}`;
                            updateHP(pHP,oHP,oppC.hp,myC.hp);
                            if(pHP<=0){ eventBattleFinish(pHP,oHP,myC,false); return; }
                            battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1300));
                        }
                    },150+i*250); });
                } else {
                    oHP=Math.min(oppC.hp, oHP+800);
                    setTimeout(()=>{
                        playSoundEffect('healing.mp3');
                        log.innerHTML+=`\n🐙 たこ焼きを食べた！HPが800回復！`;
                        updateHP(pHP,oHP,oppC.hp,myC.hp);
                        checkEnragedTransition();
                        battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1100));
                    },battleDelay(400));
                }
            } else {
                // ===== 怒りモード（HP50%以下）：通常25% / 怒りSpicyHit15% / 熱々ブレス20% / 五月雨突き20% / たこ焼き20% =====
                if(er<0.25){
                    if(isOppIlluded && Math.random() < getIllusionMissRate(oppC.spd, myC.spd)){
                        playSoundEffect('sound/miss.mp3');
                        log.innerHTML+=`\n💨 幻惑で${EVENT_MONSTER_DATA.name}の攻撃が外れた！`;
                        setTimeout(()=>{ updateHP(pHP,oHP,oppC.hp,myC.hp); battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1100)); },battleDelay(400));
                        return;
                    }
                    setTimeout(()=>{
                        const isCrit = Math.random() < getCritRate(oppC.spd, myC.spd);
                        let d = isCrit ? Math.max(8, oppC.atk) : Math.max(8, oppC.atk - Math.floor(myC.def/2));
                        d = Math.round(d*(0.9+Math.random()*0.2));
                        pHP = Math.max(0, pHP - d);
                        playSoundEffect('punch.mp3');
                        if(isCrit){ log.innerHTML+=`\n🌶️ Spicy Hit!!!!!!!! 💥 ダメージ: ${d}`; triggerEffect("player-crit",d); }
                        else { log.innerHTML+=`\n😢 被弾ダメージ: ${d}`; triggerEffect("player",d); }
                        updateHP(pHP,oHP,oppC.hp,myC.hp);
                        if(pHP<=0){ eventBattleFinish(pHP,oHP,myC,false); return; }
                        battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1100));
                    },battleDelay(400));
                } else if(er<0.40){
                    // 確定Spicy Hit：怒りのSpicy Hit!!!!!!!!!!!!!!!
                    setTimeout(()=>{
                        let d = Math.max(8, oppC.atk);
                        d = Math.round(d*(0.9+Math.random()*0.2));
                        pHP = Math.max(0, pHP - d);
                        playSoundEffect('punch.mp3');
                        log.innerHTML+=`\n🌶️ 怒りのSpicy Hit!!!!!!!!!!!!!!! 💥 ダメージ: ${d}`;
                        triggerEffect("player-crit",d);
                        updateHP(pHP,oHP,oppC.hp,myC.hp);
                        if(pHP<=0){ eventBattleFinish(pHP,oHP,myC,false); return; }
                        battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1100));
                    },battleDelay(400));
                } else if(er<0.60){
                    if(myC.isHomerun && isHomerunReflect(myC.spd, oppC.spd)){
                        log.innerHTML+=`\n🏏 ホームラン！熱々のカレーの雨を打ち返して無効化！`;
                        playBattleSkillAnimation(HOMERUN_ANIM_CONFIG, function(){ updateHP(pHP,oHP,oppC.hp,myC.hp); battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1100)); });
                        return;
                    } else {
                        setTimeout(()=>{
                            pHP=Math.max(0,pHP-80);
                            playSoundEffect('breath.mp3');
                            log.innerHTML+=`\n🔥 熱々のカレーの雨が街に降り注ぐ！DEF無視80ダメージ！`;
                            triggerEffect("player",80);
                            updateHP(pHP,oHP,oppC.hp,myC.hp);
                            if(pHP<=0){ eventBattleFinish(pHP,oHP,myC,false); return; }
                            battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1100));
                        },battleDelay(400));
                    }
                } else if(er<0.80){
                    if(myC.isHomerun && isHomerunReflect(myC.spd, oppC.spd)){
                        log.innerHTML+=`\n🏏 ホームラン！特大スプーンの五月雨突きを打ち返して無効化！`;
                        playBattleSkillAnimation(HOMERUN_ANIM_CONFIG, function(){ updateHP(pHP,oHP,oppC.hp,myC.hp); battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1100)); });
                        return;
                    }
                    const hits = rollSeedHits(oppC.spd, myC.spd);
                    let damages=[];
                    for(let i=0;i<hits;i++){ let sd=Math.max(2,Math.round(oppC.atk*0.4-Math.floor(myC.def/4))); sd=Math.round(sd*(0.9+Math.random()*0.2)); damages.push(sd); pHP=Math.max(0,pHP-sd); }
                    log.innerHTML+=`\n🥄 特大スプーンで五月雨突き！${hits}連撃！`;
                    setTimeout(()=>playSoundEffect('machine-gun.mp3'),battleDelay(50));
                    damages.forEach((sd,i)=>{ setTimeout(()=>{
                        triggerEffect("player",sd);
                        if(i===damages.length-1){
                            log.innerHTML+=` 合計: ${damages.reduce((a,b)=>a+b,0)}`;
                            updateHP(pHP,oHP,oppC.hp,myC.hp);
                            if(pHP<=0){ eventBattleFinish(pHP,oHP,myC,false); return; }
                            battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1300));
                        }
                    },150+i*250); });
                } else {
                    oHP=Math.min(oppC.hp, oHP+800);
                    setTimeout(()=>{
                        playSoundEffect('healing.mp3');
                        log.innerHTML+=`\n🐙 たこ焼きを食べた！HPが800回復！`;
                        updateHP(pHP,oHP,oppC.hp,myC.hp);
                        checkEnragedTransition();
                        battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(eventStep,battleDelay(1100));
                    },battleDelay(400));
                }
            }
        }
    }
    setTimeout(eventStep, myFluffyCategoryE ? 1300 : 600);
}

function eventBattleFinish(pHP, oHP, myC, wasBlownAway){
    battleAborted = true;
    stopBattleBGM();
    const stageEl = document.getElementById("battleStage");
    if(stageEl) stageEl.classList.remove("flash-red","flash-purple","flash-gold","flash-crit","animate-shake");

    // 共有HPをFirebaseに保存
    if(database){
        database.ref('events/tokumori001/currentHp').set(oHP);
        if(playerId) {
            database.ref('events/tokumori001/participants/'+playerId).set({ name: playerName, lastPlayed: Date.now() });
            // このバトルで実際に与えたダメージ量をランキング用に加算（敵の回復で相殺しない）
            if(eventTotalDamageThisBattle > 0) {
                database.ref('events/tokumori001/damages/'+playerId).transaction(function(cur){ return (cur||0) + eventTotalDamageThisBattle; });
            }
        }
    }

    const overlay=document.getElementById("battleResultOverlay"); const bigText=document.getElementById("battleResultBig");
    const verdictText = wasBlownAway ? "💨 吹き飛ばされた..." : "💀 敗北...";
    const verdictColor = wasBlownAway ? "#9b59b6" : "#ff4444";
    if(overlay&&bigText){ bigText.innerText=verdictText; bigText.style.color=verdictColor; bigText.style.fontSize = wasBlownAway ? "34px" : "52px"; overlay.style.display="flex"; setTimeout(()=>{ overlay.style.display="none"; document.getElementById("battleResultBox").style.display="block"; bigText.style.fontSize="52px"; scrollResultIntoView("battleResultBox"); },2000); }
    else { document.getElementById("battleResultBox").style.display="block"; scrollResultIntoView("battleResultBox"); }
    document.getElementById("pOwnerText").style.color="#ff4444"; document.getElementById("pHpText").style.color="#ff4444";

    const res=document.getElementById("battleVerdict"); const rew=document.getElementById("rewardText");
    res.innerText=verdictText; res.style.color=verdictColor;

    const normalPool=Object.keys(masterIngredients).filter(k=>masterIngredients[k].shop===0 && isIngredientAvailable(k));
    const spicePool=Object.keys(masterSpices).filter(k=>k!=="マンゴーチャツネ"&&k!=="サフラン"&&isIngredientAvailable(k));
    let gotItems=[];
    for(let i=0;i<3;i++){ const it=normalPool[Math.floor(Math.random()*normalPool.length)]; inventory[it]=(inventory[it]||0)+1; discoveredItems[it]=true; gotItems.push(it); }
    const spIt=spicePool[Math.floor(Math.random()*spicePool.length)]; inventory[spIt]=(inventory[spIt]||0)+1; discoveredItems[spIt]=true; gotItems.push(spIt);
    const itemsHtml=gotItems.map(it=>{ const d=masterIngredients[it]||masterSpices[it]; const ico=d&&d.icon?`<img src="${d.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">`:''; return ico+it; }).join(' ');
    rew.innerHTML=`報酬: ${itemsHtml}`;

    curryStock.splice(selectedCurryIndex,1); selectedCurryIndex=curryStock.length?0:-1;
    saveGame(); updateFridgeUI(); updateCookSelects(); updateShopButtons();
}

function endEventMode(){
    const stageEl = document.getElementById("battleStage");
    if(stageEl) stageEl.classList.remove("event-mode");
    const bgWrap = document.getElementById("eventBgWrap");
    if(bgWrap) bgWrap.style.display = "none";
    const evPlayerIcon = document.getElementById("eventPlayerIcon");
    if(evPlayerIcon) evPlayerIcon.style.display = "none";
}

function startBattleScene(oppN, oppC, myC) {
    // 食器補正を適用（元のcurryStock上の値は変更しない、この関数以降のバトル処理は全てこのコピーを参照する）
    myC = applyTablewareModifiers(myC);
    // バトル画面セットアップ
    hideQuestGuideChar(); // 対戦中は案内人を非表示
    battleAborted = false; // バトル開始時にリセット
    battleLogHistory = []; // 戦闘ログ蓄積をリセット
    // 古いリスナーが残っていれば解除（リスナー重複防止）
    if(guestBattleRef) { guestBattleRef.off(); guestBattleRef = null; }
    if(currentRoomId && database) { database.ref('rooms/'+currentRoomId+'/forfeit').off(); }
    document.getElementById("battleResultBox").style.display = "none";
    const overlay2 = document.getElementById("battleResultOverlay"); if(overlay2) overlay2.style.display = "none";
    ["oppOwnerText","oHpText","pOwnerText","pHpText"].forEach(id => { const el=document.getElementById(id); if(el){ el.style.color=""; el.classList.remove("name-poisoned","name-illuded"); } });
    const pop = document.getElementById("damagePop"); pop.style.display="none"; pop.style.animation="none"; pop.innerText="0";
    document.getElementById("battleSetup").style.display = "none";
    document.getElementById("battleArena").style.display = "block";
    // バトル画面が見えるようにスクロール
    requestAnimationFrame(() => {
        const arena = document.getElementById("battleArena");
        if(arena) arena.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("pOwnerText").innerText = playerName;
    document.getElementById("playerCurryNameText").innerText = myC.name;
    if (!isBotMatch) {
        // 対人戦：大きい円にはプレイヤーアイコン画像
        document.getElementById("pVisual").innerHTML = `<img src="${cachedMyIconFile}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;display:inline-block;border:2px solid #e67e22;vertical-align:middle;">`;
        // 自分の食材アイコンをpCurryIconsに表示
        const myOnlineIcons = curryIconsHTML(myC.materials, myC.spice, '22px');
        const pCurryEl = document.getElementById("pCurryIcons");
        if(pCurryEl) pCurryEl.innerHTML = myOnlineIcons || '';
        document.getElementById("oVisual").innerHTML = `<img src="${cachedOppIconFile}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`;
        // カレー名の上の小アイコンエリアに食材SVGを表示
        const oppCurryIcons = curryIconsHTML(oppC.materials, oppC.spice, '22px');
        if(oppCurryIcons) {
            document.getElementById("oppCurryEmojiText").innerHTML = oppCurryIcons;
        } else {
            // materials が無い場合はカレー名から絵文字を表示
            document.getElementById("oppCurryEmojiText").innerText = oppC.emoji || '';
        }
    } else {
        // Bot戦：自分のカレーアイコン（SVG）
        const myMaterials = curryStock[selectedCurryIndex] ? curryStock[selectedCurryIndex].materials : null;
        const mySpice = curryStock[selectedCurryIndex] ? curryStock[selectedCurryIndex].spice : null;
        const myIconsHtml = myMaterials ? curryIconsHTML(myMaterials, mySpice, '22px') : '';
        document.getElementById("pVisual").innerHTML = ''; // アイコンはpCurryIconsに表示
        const pCurryIconsEl = document.getElementById("pCurryIcons");
        if(pCurryIconsEl) pCurryIconsEl.innerHTML = myIconsHtml || myC.visual || '';
        if(oppC.isBotImage) {
            document.getElementById("oVisual").innerHTML = `<img src="${oppC.visual}" alt="${oppN}">`;
        } else {
            document.getElementById("oVisual").innerHTML = oppC.visual || "🍛";
        }
        document.getElementById("oppCurryEmojiText").innerText = oppC.emoji || '';
    }
    document.getElementById("oppOwnerText").innerText = oppN;
    document.getElementById("oppCurryNameText").innerText = oppC.name;
    let pHP = myC.hp; let oHP = oppC.hp; updateHP(pHP, oHP, oppC.hp, myC.hp);
    let seaHealUsed = false; // 海鮮カレーHP回復フラグ
    const log = document.getElementById("battleLog"); log.innerHTML = `⚔️ ${oppN} との決闘開始！
`;

    // BGM（特殊カレーBGMが優先、なければ強敵BGM）
    stopBattleBGM();
    if(myC.isTriCaviar || oppC.isTriCaviar) setTimeout(()=>playBattleBGM("Specialdinner.mp3"),300);
    else if(myC.isMargherita || oppC.isMargherita) setTimeout(()=>playBattleBGM("Guardare_il_cielo.mp3"),300);
    else if(myC.isSeafood || oppC.isSeafood) setTimeout(()=>playBattleBGM("wave.mp3"),300);
    else if(isBotMatch) setTimeout(()=>playBattleBGM("Revenger.mp3"),300);

    // バトル背景（PC戦のみ。初級/中級で背景画像を切り替える）
    const stageElForBg = document.getElementById("battleStage");
    if(stageElForBg) {
        stageElForBg.classList.remove("battle-bg-easy", "battle-bg-hard");
        if(isBotMatch) stageElForBg.classList.add(oppC.isHardBot ? "battle-bg-hard" : "battle-bg-easy");
    }

    if(!isBotMatch) {
        // 相手が離脱した場合の検知
        if(currentRoomId && database) {
            database.ref('rooms/'+currentRoomId+'/forfeit').on('value', function(snap) {
                const forfeiter = snap.val();
                if(!forfeiter) return;
                if(forfeiter !== onlineRole) {
                    // 相手が離脱→自分の勝ち
                    database.ref('rooms/'+currentRoomId+'/forfeit').off();
                    stopBattleBGM();
                    // 自分がホストの場合のみ対戦数カウント（ゲストが離脱した場合はここでカウント）
                    if(onlineRole === 'host') incrementGlobalStat('battle/room');
                    showCustomAlert("🏆 相手が離脱しました", "相手プレイヤーが離脱したため勝利扱いになりました！", function() {
                        const res = document.getElementById("battleVerdict");
                        const rew = document.getElementById("rewardText");
                        if(res) { res.innerText = "🏆 勝利（相手離脱）"; res.style.color = "#2ecc71"; }
                        playerG += 50; const oldEXP = playerEXP; playerEXP += 10;
                        if(rew) rew.innerHTML = "💰 +50G / ✨ +10EXP";
                        setTimeout(() => checkLvUp(oldEXP, playerEXP), 300);
                        curryStock.splice(selectedCurryIndex, 1); selectedCurryIndex = curryStock.length ? 0 : -1;
                        saveGame(); updateFridgeUI(); updateCookSelects(); updateMatchCurrySelects();
                        document.getElementById("battleResultBox").style.display = "block";
                        scrollResultIntoView("battleResultBox");
                        setTimeout(() => { database.ref('rooms/'+currentRoomId).remove(); currentRoomId=null; }, 2000);
                    });
                }
            });
        }
        if(onlineRole === 'host') {
            // ホスト：全ターン計算→Firebase書き込み→自分も再生
            const allTurns = calcAllBattleTurns(myC, oppC, oppN, playerName);
            const lastTurn = allTurns[allTurns.length-1];
            const roomResultWinner = lastTurn.hostHP > lastTurn.guestHP ? 'host' : (lastTurn.guestHP > lastTurn.hostHP ? 'guest' : 'draw');
            // turnsとresultを同時に書き込む
            database.ref('rooms/' + currentRoomId).update({
                turns: allTurns,
                battleResult: { winner: roomResultWinner }
            }).catch(e => {
                console.error("Firebase書き込みエラー:", e);
                showCustomAlert("⚠️ 通信エラー", "対戦相手への通信に失敗しました。");
            });
            playBattleTurns(allTurns, myC, oppC, oppN, 'host');
        } else {
            // ゲスト：Firebaseを監視してturnsが来たら再生
            let started = false;
            const turnsRefPath = database.ref('rooms/' + currentRoomId + '/turns');
            turnsRefPath.off(); // 念のため古いリスナーを解除してから新規登録
            guestBattleRef = turnsRefPath;
            guestBattleRef.on('value', snap => {
                if(started) return;
                const data = snap.val();
                if(!data || Object.keys(data).length === 0) return;
                started = true;
                guestBattleRef.off(); guestBattleRef = null;
                const turns = Object.values(data).sort((a,b)=>a.round-b.round);
                // Firebaseは配列をオブジェクトに変換するため正規化
                turns.forEach(t => {
                    if(t.effects && !Array.isArray(t.effects)) t.effects = Object.values(t.effects);
                    else if(!t.effects) t.effects = [];
                    if(t.statusLines && !Array.isArray(t.statusLines)) t.statusLines = Object.values(t.statusLines);
                    else if(!t.statusLines) t.statusLines = [];
                });
                playBattleTurns(turns, myC, oppC, oppN, 'guest');
            });
            setTimeout(() => {
                if(!started && guestBattleRef) {
                    guestBattleRef.off(); guestBattleRef = null;
                    log.innerHTML += '\n⚠️ 通信エラーが発生しました。';
                    showCustomAlert("⚠️ 通信エラー", "ホストとの通信に問題が発生しました。<br>バトルを終了します。", function() {
                        endBattleScene();
                        if(currentRoomId && database) { database.ref('rooms/'+currentRoomId).remove(); currentRoomId = null; }
                    });
                }
            }, 12000);
        }
        return;
    }

    // Bot戦：リアルタイムstep
    let isOP=!!myC.isPoison && !myC.isPoisonApple, isPP=!!oppC.isPoison && !oppC.isPoisonApple;
    let poisonLevelO = isOP ? 1 : 0; // oppC(相手)の毒レベル
    let poisonLevelP = isPP ? 1 : 0; // myC(自分)の毒レベル
    let myIsIlluded=!!oppC.isIllusion, oppIsIlluded=!!myC.isIllusion;
    // 👑世界三大珍味：戦闘開始時の幻惑・毒（毒りんごは除く）を無効化する
    let triCaviarBonusLogs = [];
    if(myC.isTriCaviar) {
        if(isPP) { isPP = false; poisonLevelP = 0; triCaviarBonusLogs.push(`👑 更に毒も効きませんのよ！`); }
        if(myIsIlluded) { myIsIlluded = false; triCaviarBonusLogs.push(`👑 更に幻惑も効きませんのよ！`); }
    }
    if(oppC.isTriCaviar) {
        if(isOP) { isOP = false; poisonLevelO = 0; triCaviarBonusLogs.push(`👑 更に毒も効きませんのよ！`); }
        if(oppIsIlluded) { oppIsIlluded = false; triCaviarBonusLogs.push(`👑 更に幻惑も効きませんのよ！`); }
    }
    // 🥚ふわとろオム：戦闘開始時に軽減対象の系統を抽選（肉/海鮮/野菜/果実）
    const FLUFFY_CATEGORY_LABEL_B = { meat: '肉系', seafood: '海鮮系', vegetable: '野菜系', fruit: '果実系' };
    const FLUFFY_CATEGORY_KEYS_B = Object.keys(FLUFFY_CATEGORY_LABEL_B);
    let myFluffyCategoryB = (myC.isFluffyOmelette || myC.isTriCaviar) ? FLUFFY_CATEGORY_KEYS_B[Math.floor(Math.random()*FLUFFY_CATEGORY_KEYS_B.length)] : null;
    let oppFluffyCategoryB = (oppC.isFluffyOmelette || oppC.isTriCaviar) ? FLUFFY_CATEGORY_KEYS_B[Math.floor(Math.random()*FLUFFY_CATEGORY_KEYS_B.length)] : null;
    let myTurn;
    if(myC.isSticky&&!oppC.isSticky){myTurn=true;log.innerHTML+=`
💚 ${oppN} はネバネバにかかった！${playerName} の先攻攻撃！`;}
    else if(oppC.isSticky&&!myC.isSticky){myTurn=false;log.innerHTML+=`
💚 ${playerName} はネバネバにかかった！${oppN} の先攻攻撃！`;}
    else{myTurn=myC.spd>=oppC.spd;}
    let round=1;

    // 毒・幻惑の初期演出（演出が終わってからバトル開始）
    let battleStartDelay = 300;
    if(isOP){
        log.innerHTML+=`\n☠️ ${oppN} は毒にかかった！毎ターン毒ダメージ！`;
        setTimeout(()=>{ playSoundEffect('poison.mp3'); playStatusFlash('poison'); document.getElementById('oppOwnerText').classList.add('name-poisoned'); }, battleStartDelay);
        battleStartDelay += 2200;
    }
    if(isPP){
        log.innerHTML+=`\n☠️ ${playerName} は毒にかかった！毎ターン毒ダメージ！`;
        setTimeout(()=>{ playSoundEffect('poison.mp3'); playStatusFlash('poison'); document.getElementById('pOwnerText').classList.add('name-poisoned'); }, battleStartDelay);
        battleStartDelay += 2200;
    }
    if(myIsIlluded){
        log.innerHTML+=`\n🌀 ${playerName} は幻惑にかかった！攻撃命中率ダウン！`;
        setTimeout(()=>{ playSoundEffect('genwaku.mp3'); playStatusFlash('illusion'); document.getElementById('pOwnerText').classList.add('name-illuded'); }, battleStartDelay);
        battleStartDelay += 2200;
    }
    if(oppIsIlluded){
        log.innerHTML+=`\n🌀 ${oppN} は幻惑にかかった！攻撃命中率ダウン！`;
        setTimeout(()=>{ playSoundEffect('genwaku.mp3'); playStatusFlash('illusion'); document.getElementById('oppOwnerText').classList.add('name-illuded'); }, battleStartDelay);
        battleStartDelay += 2200;
    }
    triCaviarBonusLogs.forEach(msg => { log.innerHTML+=`\n${msg}`; });
    if(myFluffyCategoryB){
        log.innerHTML+=`\n🥚 ${playerName} は${getBarrierLabel(myC)}により${FLUFFY_CATEGORY_LABEL_B[myFluffyCategoryB]}からの攻撃を軽減する！`;
        setTimeout(()=>{ playSoundEffect('healing.mp3'); triggerFluffyBarrierEffect('player'); }, battleStartDelay);
        battleStartDelay += 1200;
    }
    if(oppFluffyCategoryB){
        log.innerHTML+=`\n🥚 ${oppN} は${getBarrierLabel(oppC)}により${FLUFFY_CATEGORY_LABEL_B[oppFluffyCategoryB]}からの攻撃を軽減する！`;
        setTimeout(()=>{ playSoundEffect('healing.mp3'); triggerFluffyBarrierEffect('enemy'); }, battleStartDelay);
        battleStartDelay += 1200;
    }
    if(myC.isPoison || oppC.isPoison || myC.isIllusion || oppC.isIllusion || myFluffyCategoryB || oppFluffyCategoryB) {
        battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi, "\n"));
    }

    function step(){
        if(battleAborted) return;
        if(window.battleSkillAnimBusy) return; // アニメーション中は捨てる（リトライしない）
        if(pHP<=0||oHP<=0||round>50){setTimeout(()=>done(pHP,oHP,myC,oppC,false),battleDelay(800));return;}
        if(myTurn){
            log.innerHTML=`🔥 自分のターン！`;
            playTone(440,'triangle',0.08); // ターン表示音
            // 海鮮カレー：HP50%以下で1回だけ回復
            if(myC.isSeafood && !seaHealUsed && pHP <= Math.floor(myC.hp * 0.5)) {
                seaHealUsed = true;
                const seaHeal = Math.round(myC.hp * (myC.spd >= oppC.spd ? 0.4 : 0.3));
                pHP = Math.min(myC.hp, pHP + seaHeal);
                log.innerHTML += `\n🌊 ${playerName}は波の音に癒された。HP回復+${seaHeal}`;
                playSoundEffect('healing.mp3');
                triggerEffect("player-heal", seaHeal);
                updateHP(pHP, oHP, oppC.hp, myC.hp);
            }
            if(myC.isRatatouille){let heal=Math.round(myC.hp*0.10);pHP=Math.min(myC.hp,pHP+heal);log.innerHTML+=`\n☀️ 太陽の光を浴びてHP回復: ${heal}`;playSoundEffect('taiyou.mp3');triggerEffect("player-heal",heal);updateHP(pHP,oHP,oppC.hp,myC.hp);}
            if(isPP){let d=Math.round(myC.hp*0.08*poisonLevelP);pHP-=d;log.innerHTML+=`\n☠️ 毒ダメージ: ${d}`;triggerEffect("player-poison",d);updateHP(pHP,oHP,oppC.hp,myC.hp);if(pHP<=0){step();return;}}
            // 幻惑ミス（punch.mp3なし、SPD比較で50%/30%）／わんぱくミス（20%）
            if(myIsIlluded&&Math.random()<getIllusionMissRate(myC.spd,oppC.spd)){
                playSoundEffect('sound/miss.mp3');
                log.innerHTML+=`\n💨 幻惑で攻撃が外れた！`;
                setTimeout(()=>{updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=false;round++;setTimeout(step,battleDelay(1100));},battleDelay(400));
            } else if((myC.isWanpaku || myC.isTonTonTon) && isWanpakuMiss()){
                if(myC.isTonTonTon) playSoundEffect('pig2.mp3');
                playSoundEffect('sound/miss.mp3');
                log.innerHTML+=`\n💨 わんぱくが暴れすぎて攻撃が外れた！`;
                setTimeout(()=>{updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=false;round++;setTimeout(step,battleDelay(1100));},battleDelay(400));
            } else if(myC.isSeed&&Math.random()<0.3){
                const _willReflect = oppC.isHomerun && isHomerunReflect(oppC.spd, myC.spd);
                const _interruptCfg = getSeedInterruptConfig(oppN, !isBotMatch);
                log.innerHTML+=`\n🌱 種連続発射！`;
                playTanemakiAnimation(Object.assign({}, SEED_PLAYER_ALLY_CONFIG, { interruptConfig: _interruptCfg }), _willReflect, function(){
                    if(_willReflect){
                        log.innerHTML+=`\n🏏 ホームラン！種連続発射を打ち返して無効化！`;
                        updateHP(pHP,oHP,oppC.hp,myC.hp);
                        battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));
                        myTurn=false;round++;setTimeout(step,battleDelay(1100));
                    } else {
                        const hits=rollSeedHits(myC.spd,oppC.spd);let damages=[];let spicyCount=0;
                        for(let i=0;i<hits;i++){let sd=Math.max(2,Math.round(myC.atk*0.4-Math.floor(oppC.def/4)));sd=Math.round(sd*(0.9+Math.random()*0.2));if(Math.random()<getCritRate(myC.spd,oppC.spd)){sd=Math.round(sd*2);spicyCount++;}damages.push(sd);oHP=Math.max(0,oHP-sd);}
                        log.innerHTML+=`\n🌱 種連続発射 ${hits}連撃！`+(spicyCount>0?` 🌶️ SpicyHit×${spicyCount}！`:'');
                        setTimeout(()=>playSoundEffect('machine-gun.mp3'),50);
                        damages.forEach((sd,i)=>{setTimeout(()=>{triggerEffect("enemy",sd);if(i===damages.length-1){log.innerHTML+=` 合計: ${damages.reduce((a,b)=>a+b,0)}`;updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=false;round++;setTimeout(step,battleDelay(1300));}},battleDelay(150+i*250));});
                    }
                });
                return;
            } else if(myC.isGreenCurry&&Math.random()<0.35){
                // 🟢ヒリヒリクラッシュ：相手がホームランを持っていれば打ち返されるが、反動は必ずくらう
                playSoundEffect('hirihiri.mp3');
                setTimeout(()=>{
                    const selfDmg = Math.round(myC.hp * 0.10);
                    pHP = Math.max(0, pHP - selfDmg);
                    if(oppC.isHomerun && isHomerunReflect(oppC.spd, myC.spd)) {
                        log.innerHTML+=`\n🏏 ホームラン！${oppN} がヒリヒリクラッシュを打ち返した！`;
                        log.innerHTML+=`\n🌶️ 反動で${playerName}にも${selfDmg}ダメージ！`;
                        playBattleSkillAnimation(HOMERUN_ANIM_CONFIG, function(){
                            triggerHirihiriEffect('player', selfDmg);
                            updateHP(pHP,oHP,oppC.hp,myC.hp);
                            battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));
                            myTurn=false;round++;setTimeout(step,battleDelay(1100));
                        });
                        return;
                    } else {
                        let d = Math.max(8, Math.round(myC.atk * (1.1 + Math.random()*0.4)) - Math.floor(oppC.def/2));
                        oHP = Math.max(0, oHP - d);
                        log.innerHTML+=`\n🌶️🔥 ヒリヒリクラッシュ！💥 ダメージ: ${d}`;
                        log.innerHTML+=`\n🌶️ 反動で${playerName}にも${selfDmg}ダメージ！`;
                        triggerHirihiriEffect('enemy', d);
                        setTimeout(()=>triggerHirihiriEffect('player', selfDmg), 200);
                    }
                    updateHP(pHP,oHP,oppC.hp,myC.hp);
                    battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));
                    myTurn=false;round++;setTimeout(step,battleDelay(1100));
                },battleDelay(400));
            } else if(myC.isTonTonTon){
                playSoundEffect('pig2.mp3');
                setTimeout(()=>{const isCrit=Math.random()<getCritRate(myC.spd,oppC.spd);let d=isCrit?Math.max(8,myC.atk):Math.max(8,myC.atk-Math.floor(oppC.def/2));d=Math.round(d*(0.9+Math.random()*0.2));d=Math.round(d*getWanpakuDamageMultiplier());if(oppC.isRatatouille&&isMeatBasedCurry(myC))d=Math.round(d*0.2);if(oppFluffyCategoryB&&curryHasCategory(myC,oppFluffyCategoryB)){d=Math.round(d*0.7);}oHP=Math.max(0,oHP-d);playSoundEffect('punch.mp3');if(isCrit){log.innerHTML+=`\n🌶️ Spicy Hit!!!!!!!! 💥 ダメージ: ${d}`;triggerEffect("enemy-crit",d);}else{log.innerHTML+=`\n💥 ダメージ: ${d}`;triggerEffect("enemy",d);}if(oppFluffyCategoryB&&curryHasCategory(myC,oppFluffyCategoryB)){log.innerHTML+=`\n🥚 ${getBarrierLabel(oppC)}により${FLUFFY_CATEGORY_LABEL_B[oppFluffyCategoryB]}からの攻撃を軽減`;}if(myC.isPoisonApple&&Math.random()<0.5){if(!isOP){isOP=true;poisonLevelO=1;log.innerHTML+=`\n☠️ ${oppN} は毒にかかった！`;setTimeout(()=>{playSoundEffect('poison.mp3');const el=document.getElementById('oppOwnerText');if(el)el.classList.add('name-poisoned');},300);}else if(poisonLevelO<6){poisonLevelO++;log.innerHTML+=`\n☠️ 毒のダメージが増幅`;setTimeout(()=>playSoundEffect('poison.mp3'),300);}}updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=false;round++;setTimeout(step,battleDelay(1100));},battleDelay(400));
            } else if(oppC.isTonTonTon){
                playSoundEffect('pig1.mp3');
                setTimeout(()=>{const isCrit=Math.random()<getCritRate(myC.spd,oppC.spd);let d=isCrit?Math.max(8,myC.atk):Math.max(8,myC.atk-Math.floor(oppC.def/2));d=Math.round(d*(0.9+Math.random()*0.2));if(myC.isWanpaku)d=Math.round(d*getWanpakuDamageMultiplier());if(oppC.isRatatouille&&isMeatBasedCurry(myC))d=Math.round(d*0.2);if(oppFluffyCategoryB&&curryHasCategory(myC,oppFluffyCategoryB)){d=Math.round(d*0.7);}oHP=Math.max(0,oHP-d);playSoundEffect('punch.mp3');if(isCrit){log.innerHTML+=`\n🌶️ Spicy Hit!!!!!!!! 💥 ダメージ: ${d}`;triggerEffect("enemy-crit",d);}else{log.innerHTML+=`\n💥 ダメージ: ${d}`;triggerEffect("enemy",d);}if(oppFluffyCategoryB&&curryHasCategory(myC,oppFluffyCategoryB)){log.innerHTML+=`\n🥚 ${getBarrierLabel(oppC)}により${FLUFFY_CATEGORY_LABEL_B[oppFluffyCategoryB]}からの攻撃を軽減`;}if(myC.isPoisonApple&&Math.random()<0.5){if(!isOP){isOP=true;poisonLevelO=1;log.innerHTML+=`\n☠️ ${oppN} は毒にかかった！`;setTimeout(()=>{playSoundEffect('poison.mp3');const el=document.getElementById('oppOwnerText');if(el)el.classList.add('name-poisoned');},300);}else if(poisonLevelO<6){poisonLevelO++;log.innerHTML+=`\n☠️ 毒のダメージが増幅`;setTimeout(()=>playSoundEffect('poison.mp3'),300);}}updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=false;round++;setTimeout(step,battleDelay(1100));},battleDelay(400));
            } else if(myC.hasGold){
                playGoldSound();log.innerHTML+=`\n🌟 金箔乱舞！`;
                setTimeout(()=>{const isCrit=Math.random()<getCritRate(myC.spd,oppC.spd);let d=isCrit?Math.max(8,myC.atk):Math.max(8,myC.atk-Math.floor(oppC.def/2));d=Math.round(d*(0.9+Math.random()*0.2));if(myC.isWanpaku)d=Math.round(d*getWanpakuDamageMultiplier());if(oppC.isRatatouille&&isMeatBasedCurry(myC))d=Math.round(d*0.2);if(oppFluffyCategoryB&&curryHasCategory(myC,oppFluffyCategoryB)){d=Math.round(d*0.7);}oHP=Math.max(0,oHP-d);playSoundEffect('punch.mp3');if(isCrit){log.innerHTML+=`\n🌶️ Spicy Hit!!!!!!!! 💥 ダメージ: ${d}`;triggerEffect("enemy-crit",d);}else{log.innerHTML+=`\n💥 ダメージ: ${d}`;triggerEffect("enemy-gold",d);}if(oppFluffyCategoryB&&curryHasCategory(myC,oppFluffyCategoryB)){log.innerHTML+=`\n🥚 ${getBarrierLabel(oppC)}により${FLUFFY_CATEGORY_LABEL_B[oppFluffyCategoryB]}からの攻撃を軽減`;}if(myC.isPoisonApple&&Math.random()<0.5){if(!isOP){isOP=true;poisonLevelO=1;log.innerHTML+=`\n☠️ ${oppN} は毒にかかった！`;setTimeout(()=>{playSoundEffect('poison.mp3');const el=document.getElementById('oppOwnerText');if(el)el.classList.add('name-poisoned');},300);}else if(poisonLevelO<6){poisonLevelO++;log.innerHTML+=`\n☠️ 毒のダメージが増幅`;setTimeout(()=>playSoundEffect('poison.mp3'),300);}}updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=false;round++;setTimeout(step,battleDelay(1100));},battleDelay(400));
            } else {
                // 通常攻撃（ターン音は上で鳴らし済み、ダメージ時にpunch.mp3）
                setTimeout(()=>{const isCrit=Math.random()<getCritRate(myC.spd,oppC.spd);let d=isCrit?Math.max(8,myC.atk):Math.max(8,myC.atk-Math.floor(oppC.def/2));d=Math.round(d*(0.9+Math.random()*0.2));if(myC.isWanpaku)d=Math.round(d*getWanpakuDamageMultiplier());if(oppC.isRatatouille&&isMeatBasedCurry(myC))d=Math.round(d*0.2);if(oppFluffyCategoryB&&curryHasCategory(myC,oppFluffyCategoryB)){d=Math.round(d*0.7);}oHP=Math.max(0,oHP-d);playSoundEffect('punch.mp3');if(isCrit){log.innerHTML+=`\n🌶️ Spicy Hit!!!!!!!! 💥 ダメージ: ${d}`;triggerEffect("enemy-crit",d);}else{log.innerHTML+=`\n💥 ダメージ: ${d}`;triggerEffect("enemy",d);}if(oppFluffyCategoryB&&curryHasCategory(myC,oppFluffyCategoryB)){log.innerHTML+=`\n🥚 ${getBarrierLabel(oppC)}により${FLUFFY_CATEGORY_LABEL_B[oppFluffyCategoryB]}からの攻撃を軽減`;}if(myC.isPoisonApple&&Math.random()<0.5){if(!isOP){isOP=true;poisonLevelO=1;log.innerHTML+=`\n☠️ ${oppN} は毒にかかった！`;setTimeout(()=>{playSoundEffect('poison.mp3');const el=document.getElementById('oppOwnerText');if(el)el.classList.add('name-poisoned');},300);}else if(poisonLevelO<6){poisonLevelO++;log.innerHTML+=`\n☠️ 毒のダメージが増幅`;setTimeout(()=>playSoundEffect('poison.mp3'),300);}}updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=false;round++;setTimeout(step,battleDelay(1100));},battleDelay(400));
            }
        }else{
            log.innerHTML=`⚠️ 相手のターン！`;
            playTone(330,'triangle',0.08); // ターン表示音
            if(isOP){let d=Math.round(oppC.hp*0.08*poisonLevelO);oHP-=d;log.innerHTML+=`\n☠️ 毒ダメージ: ${d}`;triggerEffect("enemy-poison",d);updateHP(pHP,oHP,oppC.hp,myC.hp);if(oHP<=0){window.__defeatedByPoison=true;step();return;}}
            // 幻惑ミス（punch.mp3なし、SPD比較で50%/30%）／わんぱくミス（20%）
            if(oppIsIlluded&&Math.random()<getIllusionMissRate(oppC.spd,myC.spd)){
                playSoundEffect('sound/miss.mp3');
                log.innerHTML+=`\n💨 幻惑で相手の攻撃が外れた！`;
                setTimeout(()=>{updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=true;round++;setTimeout(step,battleDelay(1100));},battleDelay(400));
            } else if((oppC.isWanpaku || oppC.isTonTonTon)&&isWanpakuMiss()){
                if(oppC.isTonTonTon) playSoundEffect('pig1.mp3');
                playSoundEffect('sound/miss.mp3');
                log.innerHTML+=`\n💨 相手のわんぱくが暴れすぎて攻撃が外れた！`;
                setTimeout(()=>{updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=true;round++;setTimeout(step,battleDelay(1100));},battleDelay(400));
            } else if(oppC.isBreath&&Math.random()<(1/3)){
                // ドラゴン料理長は専用演出あり
                if(oppN === 'ドラゴン料理長') {
                    const willReflect = myC.isHomerun && isHomerunReflect(myC.spd, oppC.spd);
                    log.innerHTML += `\n🔥 ${oppN} の熱々ブレス！`;
                    playTanemakiAnimation({
                        charaImg: 'battle/bt_dragon.png',
                        charaTop: '52%',
                        charaWidth: '70%',
                        charaMaxScale: 1.15
                    }, willReflect, function(){
                        if(willReflect) {
                            log.innerHTML += `\n🏏 ホームラン！熱々ブレスを打ち返して無効化！`;
                            updateHP(pHP,oHP,oppC.hp,myC.hp);
                            battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));
                            myTurn=true; round++; setTimeout(step,battleDelay(1100));
                        } else {
                            pHP=Math.max(0,pHP-80);
                            log.innerHTML+=`\n🔥 熱々ブレス！DEF無視80ダメージ！`;
                            playSoundEffect('breath.mp3');
                            triggerEffect("player",80);
                            updateHP(pHP,oHP,oppC.hp,myC.hp);
                            battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));
                            myTurn=true; round++; setTimeout(step,battleDelay(1100));
                        }
                    });
                    return;
                }
                // ドラゴン料理長以外の熱々ブレス（演出なし・従来通り）
                if(myC.isHomerun&&isHomerunReflect(myC.spd,oppC.spd)){
                    log.innerHTML+=`\n🏏 ホームラン！熱々ブレスを打ち返して無効化！`;
                    playBattleSkillAnimation(HOMERUN_ANIM_CONFIG, function(){ updateHP(pHP,oHP,oppC.hp,myC.hp); battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(step,battleDelay(1100)); });
                    return;
                } else {
                    setTimeout(()=>{pHP=Math.max(0,pHP-80);log.innerHTML+=`\n🔥 熱々ブレス！DEF無視80ダメージ！`;playSoundEffect('breath.mp3');triggerEffect("player",80);updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=true;round++;setTimeout(step,battleDelay(1100));},battleDelay(400));
                }
            } else if(oppC.isSeed&&Math.random()<0.3){
                // 種まき婆ちゃんは専用演出あり
                if(oppN === '種まき婆ちゃん') {
                    const willReflect = myC.isHomerun && isHomerunReflect(myC.spd, oppC.spd);
                    log.innerHTML += `\n🌱 ${oppN} の種連続発射！`;
                    playTanemakiAnimation({
                        charaImg: 'battle/bt_tanemaki1.png',
                        charaTop: '55%',
                        charaWidth: '60%',
                        charaMaxScale: 1.2
                    }, willReflect, function(){
                        if(willReflect) {
                            // ホームランが割り込んで種連射を無効化
                            log.innerHTML += `\n🏏 ホームラン！種連続発射を打ち返して無効化！`;
                            updateHP(pHP,oHP,oppC.hp,myC.hp);
                            battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));
                            myTurn=true; round++; setTimeout(step,battleDelay(1100));
                        } else {
                            // 演出後に種連射ダメージ処理
                            const hits=rollSeedHits(oppC.spd,myC.spd);let damages=[];let spicyCount=0;
                            for(let i=0;i<hits;i++){let sd=Math.max(2,Math.round(oppC.atk*0.4-Math.floor(myC.def/4)));sd=Math.round(sd*(0.9+Math.random()*0.2));if(Math.random()<getCritRate(oppC.spd,myC.spd)){sd=Math.round(sd*2);spicyCount++;}damages.push(sd);pHP=Math.max(0,pHP-sd);}
                            log.innerHTML+=`\n🌱 種連続発射 ${hits}連撃！`+(spicyCount>0?` 🌶️ SpicyHit×${spicyCount}！`:'');
                            setTimeout(()=>playSoundEffect('machine-gun.mp3'),50);
                            damages.forEach((sd,i)=>{setTimeout(()=>{triggerEffect("player",sd);if(i===damages.length-1){log.innerHTML+=` 合計: ${damages.reduce((a,b)=>a+b,0)}`;updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=true;round++;setTimeout(step,battleDelay(1300));}},battleDelay(150+i*250));});
                        }
                    });
                    return;
                }
                // 種まき婆ちゃん以外の種連射（演出なし・従来通り）
                if(myC.isHomerun&&isHomerunReflect(myC.spd,oppC.spd)){
                    log.innerHTML+=`\n🏏 ホームラン！種連続発射を打ち返して無効化！`;
                    playBattleSkillAnimation(HOMERUN_ANIM_CONFIG, function(){ updateHP(pHP,oHP,oppC.hp,myC.hp); battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n")); myTurn=true; round++; setTimeout(step,battleDelay(1100)); });
                    return;
                } else {
                    const hits=rollSeedHits(oppC.spd,myC.spd);let damages=[];let spicyCount=0;
                    for(let i=0;i<hits;i++){let sd=Math.max(2,Math.round(oppC.atk*0.4-Math.floor(myC.def/4)));sd=Math.round(sd*(0.9+Math.random()*0.2));if(Math.random()<getCritRate(oppC.spd,myC.spd)){sd=Math.round(sd*2);spicyCount++;}damages.push(sd);pHP=Math.max(0,pHP-sd);}
                    log.innerHTML+=`\n🌱 相手の種連続発射 ${hits}連撃！`+(spicyCount>0?` 🌶️ SpicyHit×${spicyCount}！`:'');
                    setTimeout(()=>playSoundEffect('machine-gun.mp3'),50);
                    damages.forEach((sd,i)=>{setTimeout(()=>{triggerEffect("player",sd);if(i===damages.length-1){log.innerHTML+=` 合計: ${damages.reduce((a,b)=>a+b,0)}`;updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=true;round++;setTimeout(step,battleDelay(1300));}},battleDelay(150+i*250));});
                }
            } else if(oppC.isGreenCurry&&Math.random()<0.35){
                // 🟢ヒリヒリクラッシュ（敵側）：自分がホームランを持っていれば打ち返せるが、相手の反動は必ず発生する
                playSoundEffect('hirihiri.mp3');
                setTimeout(()=>{
                    const selfDmg = Math.round(oppC.hp * 0.10);
                    oHP = Math.max(0, oHP - selfDmg);
                    if(myC.isHomerun && isHomerunReflect(myC.spd, oppC.spd)) {
                        log.innerHTML+=`\n🏏 ホームラン！${playerName} がヒリヒリクラッシュを打ち返した！`;
                        log.innerHTML+=`\n🌶️ 反動で${oppN}にも${selfDmg}ダメージ！`;
                        playBattleSkillAnimation(HOMERUN_ANIM_CONFIG, function(){
                            triggerHirihiriEffect('enemy', selfDmg);
                            updateHP(pHP,oHP,oppC.hp,myC.hp);
                            battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));
                            myTurn=true;round++;setTimeout(step,battleDelay(1100));
                        });
                        return;
                    } else {
                        let d = Math.max(8, Math.round(oppC.atk * (1.1 + Math.random()*0.4)) - Math.floor(myC.def/2));
                        pHP = Math.max(0, pHP - d);
                        log.innerHTML+=`\n🌶️🔥 ${oppN}のヒリヒリクラッシュ！😢 被弾ダメージ: ${d}`;
                        log.innerHTML+=`\n🌶️ 反動で${oppN}にも${selfDmg}ダメージ！`;
                        triggerHirihiriEffect('player', d);
                        setTimeout(()=>triggerHirihiriEffect('enemy', selfDmg), 200);
                    }
                    updateHP(pHP,oHP,oppC.hp,myC.hp);
                    battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));
                    myTurn=true;round++;setTimeout(step,battleDelay(1100));
                },battleDelay(400));
            } else if(myC.isTonTonTon){
                playSoundEffect('pig1.mp3');
                setTimeout(()=>{const isCrit=Math.random()<getCritRate(oppC.spd,myC.spd);let d=isCrit?Math.max(8,oppC.atk):Math.max(8,oppC.atk-Math.floor(myC.def/2));d=Math.round(d*(0.9+Math.random()*0.2));if(oppC.isWanpaku)d=Math.round(d*getWanpakuDamageMultiplier());if(myC.isRatatouille&&(isMeatBasedCurry(oppC)||isMeatBasedBot(oppN)))d=Math.round(d*0.2);if(myFluffyCategoryB&&curryHasCategory(oppC,myFluffyCategoryB)){d=Math.round(d*0.7);}pHP=Math.max(0,pHP-d);playSoundEffect('punch.mp3');if(isCrit){log.innerHTML+=`\n🌶️ Spicy Hit!!!!!!!! 💥 ダメージ: ${d}`;triggerEffect("player-crit",d);}else{log.innerHTML+=`\n😢 被弾ダメージ: ${d}`;triggerEffect("player",d);}if(myFluffyCategoryB&&curryHasCategory(oppC,myFluffyCategoryB)){log.innerHTML+=`\n🥚 ${getBarrierLabel(myC)}により${FLUFFY_CATEGORY_LABEL_B[myFluffyCategoryB]}からの攻撃を軽減`;}if(oppC.isPoisonApple&&Math.random()<0.5){if(!isPP){isPP=true;poisonLevelP=1;log.innerHTML+=`\n☠️ ${playerName} は毒にかかった！`;setTimeout(()=>{playSoundEffect('poison.mp3');const el=document.getElementById('pOwnerText');if(el)el.classList.add('name-poisoned');},300);}else if(poisonLevelP<6){poisonLevelP++;log.innerHTML+=`\n☠️ 毒のダメージが増幅`;setTimeout(()=>playSoundEffect('poison.mp3'),300);}}updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=true;round++;setTimeout(step,battleDelay(1100));},battleDelay(400));
            } else if(oppC.isTonTonTon){
                playSoundEffect('pig2.mp3');
                setTimeout(()=>{const isCrit=Math.random()<getCritRate(oppC.spd,myC.spd);let d=isCrit?Math.max(8,oppC.atk):Math.max(8,oppC.atk-Math.floor(myC.def/2));d=Math.round(d*(0.9+Math.random()*0.2));d=Math.round(d*getWanpakuDamageMultiplier());if(myC.isRatatouille&&(isMeatBasedCurry(oppC)||isMeatBasedBot(oppN)))d=Math.round(d*0.2);if(myFluffyCategoryB&&curryHasCategory(oppC,myFluffyCategoryB)){d=Math.round(d*0.7);}pHP=Math.max(0,pHP-d);playSoundEffect('punch.mp3');if(isCrit){log.innerHTML+=`\n🌶️ Spicy Hit!!!!!!!! 💥 ダメージ: ${d}`;triggerEffect("player-crit",d);}else{log.innerHTML+=`\n😢 被弾ダメージ: ${d}`;triggerEffect("player",d);}if(myFluffyCategoryB&&curryHasCategory(oppC,myFluffyCategoryB)){log.innerHTML+=`\n🥚 ${getBarrierLabel(myC)}により${FLUFFY_CATEGORY_LABEL_B[myFluffyCategoryB]}からの攻撃を軽減`;}if(oppC.isPoisonApple&&Math.random()<0.5){if(!isPP){isPP=true;poisonLevelP=1;log.innerHTML+=`\n☠️ ${playerName} は毒にかかった！`;setTimeout(()=>{playSoundEffect('poison.mp3');const el=document.getElementById('pOwnerText');if(el)el.classList.add('name-poisoned');},300);}else if(poisonLevelP<6){poisonLevelP++;log.innerHTML+=`\n☠️ 毒のダメージが増幅`;setTimeout(()=>playSoundEffect('poison.mp3'),300);}}updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=true;round++;setTimeout(step,battleDelay(1100));},battleDelay(400));
            } else {
                // 通常攻撃
                setTimeout(()=>{const isCrit=Math.random()<getCritRate(oppC.spd,myC.spd);let d=isCrit?Math.max(8,oppC.atk):Math.max(8,oppC.atk-Math.floor(myC.def/2));d=Math.round(d*(0.9+Math.random()*0.2));if(oppC.isWanpaku)d=Math.round(d*getWanpakuDamageMultiplier());if(myC.isRatatouille&&(isMeatBasedCurry(oppC)||isMeatBasedBot(oppN)))d=Math.round(d*0.2);if(myFluffyCategoryB&&curryHasCategory(oppC,myFluffyCategoryB)){d=Math.round(d*0.7);}pHP=Math.max(0,pHP-d);playSoundEffect('punch.mp3');if(isCrit){log.innerHTML+=`\n🌶️ Spicy Hit!!!!!!!! 💥 ダメージ: ${d}`;triggerEffect("player-crit",d);}else{log.innerHTML+=`\n😢 被弾ダメージ: ${d}`;triggerEffect("player",d);}if(myFluffyCategoryB&&curryHasCategory(oppC,myFluffyCategoryB)){log.innerHTML+=`\n🥚 ${getBarrierLabel(myC)}により${FLUFFY_CATEGORY_LABEL_B[myFluffyCategoryB]}からの攻撃を軽減`;}if(oppC.isPoisonApple&&Math.random()<0.5){if(!isPP){isPP=true;poisonLevelP=1;log.innerHTML+=`\n☠️ ${playerName} は毒にかかった！`;setTimeout(()=>{playSoundEffect('poison.mp3');const el=document.getElementById('pOwnerText');if(el)el.classList.add('name-poisoned');},300);}else if(poisonLevelP<6){poisonLevelP++;log.innerHTML+=`\n☠️ 毒のダメージが増幅`;setTimeout(()=>playSoundEffect('poison.mp3'),300);}}updateHP(pHP,oHP,oppC.hp,myC.hp);battleLogHistory.push(log.innerHTML.replace(/<br\s*\/?>/gi,"\n"));myTurn=true;round++;setTimeout(step,battleDelay(1100));},battleDelay(400));
            }
        }
    }
    setTimeout(step, battleStartDelay);
}

// proceedToArena は後方互換のためstartBattleSceneに委譲
function proceedToArena(oppN, oppC, myC) { startBattleScene(oppN, oppC, myC); }

function cancelMatchRoom() {
    if(myRoomRef) { database.ref('rooms/'+currentRoomId).remove(); myRoomRef.off('value'); myRoomRef=null; }
    currentRoomId=null;
    document.getElementById("lobbyArea").style.display="block";
    document.getElementById("waitingArea").style.display="none";
}

window.addEventListener('beforeunload', function() {
    if(currentRoomId && myRoomRef && database) database.ref('rooms/'+currentRoomId).remove();
});
document.addEventListener('visibilitychange', function() {
    // 待機中の部屋削除のみ（バトル中の離脱検知はゲーム内タブ切り替えのみ対応）
    if(document.visibilityState==='hidden' && currentRoomId && myRoomRef && database) {
        if(document.getElementById("waitingArea") && document.getElementById("waitingArea").style.display!=="none")
            database.ref('rooms/'+currentRoomId).remove();
    }
});

function forceForfeit() {
    battleAborted = true; // step関数を即停止
    stopBattleBGM();
    // イベント戦闘中だった場合、現在の共有HPをFirebaseに保存
    const wasEventMode = document.getElementById("battleStage") && document.getElementById("battleStage").classList.contains("event-mode");
    if(wasEventMode && database) {
        const oHpTextEl = document.getElementById("oHpText");
        if(oHpTextEl) {
            const match = oHpTextEl.innerText.match(/HP:\s*(\d+)\//);
            if(match) {
                const curOHP = parseInt(match[1], 10);
                database.ref('events/tokumori001/currentHp').set(curOHP);
                if(playerId && eventTotalDamageThisBattle > 0) {
                    database.ref('events/tokumori001/damages/'+playerId).transaction(function(cur){ return (cur||0) + eventTotalDamageThisBattle; });
                }
            }
        }
        if(playerId) database.ref('events/tokumori001/participants/'+playerId).set({ name: playerName, lastPlayed: Date.now() });
    }
    // バトル画面を終了してアリーナから退場
    endBattleScene();
    // 負けメッセージをモーダルで表示
    const oldEXP = playerEXP; playerEXP += 1;
    curryStock.splice(selectedCurryIndex, 1); selectedCurryIndex = curryStock.length ? 0 : -1;
    saveGame(); updateFridgeUI(); updateCookSelects(); updateMatchCurrySelects();
    setTimeout(() => checkLvUp(oldEXP, playerEXP), 300);
    if(!isBotMatch && currentRoomId && database) {
        // 離脱した自分がホストならカウント（ゲストが離脱した場合はホスト側の相手離脱検知でカウントする）
        if(onlineRole === 'host') incrementGlobalStat('battle/room');
        setTimeout(() => { database.ref('rooms/'+currentRoomId).remove(); currentRoomId=null; }, 1000);
    }
    showCustomAlert("💀 敗北（離脱）", "バトル中にタブを切り替えたため負け扱いになりました。<br>✨ +1EXP");
}

function updateHP(p, o, om, pm) {
    document.getElementById("pHpText").innerText=`HP: ${p}/${pm}`; document.getElementById("oHpText").innerText=`HP: ${o}/${om}`;
    const oPct = Math.max(o > 0 ? 1 : 0, o/om*100); // イベントボス等で常に最低1%表示
    document.getElementById("pWeightBar").style.width=(p/pm*100)+"%"; document.getElementById("oWeightBar").style.width=oPct+"%";
}
// 🥚ふわとろオム：優しいバリアが広がる演出（target: 'enemy' or 'player'）
// 🟢激辛グリーンカレー：ヒリヒリクラッシュ・反動ダメージのビリビリ演出（ダメージ数値も表示）
function triggerHirihiriEffect(target, damage) {
    if(battleAborted) return;
    const pop = document.getElementById("damagePop");
    if(pop && damage != null) {
        pop.innerHTML = damage;
        pop.style.display = "block"; pop.style.animation = "none"; pop.className = "damage-pop";
        pop.offsetHeight;
        if(target === 'enemy') { pop.style.top="130px"; pop.style.left="25%"; }
        else { pop.style.top="240px"; pop.style.left="45%"; }
        pop.style.color = "#e74c3c";
        pop.style.animation = "popUp 0.6s forwards";
    }
    const zone = target === 'enemy' ? document.getElementById('enemyZone') : document.querySelector('.player-zone');
    if(zone) {
        zone.classList.add('hirihiri-shake');
        setTimeout(() => zone.classList.remove('hirihiri-shake'), 500);
    }
    const stage = document.getElementById("battleStage");
    if(stage) {
        stage.classList.add('flash-hirihiri');
        setTimeout(() => stage.classList.remove('flash-hirihiri'), 400);
    }
}

function triggerFluffyBarrierEffect(target) {
    const zone = target === 'enemy' ? document.getElementById('enemyZone') : document.querySelector('.player-zone');
    if(!zone) return;
    const barrier = document.createElement('div');
    barrier.className = 'fluffy-barrier-ring';
    zone.style.position = zone.style.position || 'relative';
    zone.appendChild(barrier);
    setTimeout(() => { if(barrier.parentNode) barrier.parentNode.removeChild(barrier); }, 900);
}

// タッグ戦専用：4人それぞれのカード(tagEnemyCard0/1, tagPlayerCard0/1)にバリア演出を出す
function triggerTagFluffyBarrierEffect(side, idx) {
    const zone = document.getElementById((side === 'enemy' ? 'tagEnemyCard' : 'tagPlayerCard') + idx);
    if(!zone) return;
    const barrier = document.createElement('div');
    barrier.className = 'fluffy-barrier-ring';
    zone.style.position = zone.style.position || 'relative';
    zone.appendChild(barrier);
    setTimeout(() => { if(barrier.parentNode) barrier.parentNode.removeChild(barrier); }, 900);
}

// タッグ戦専用：ヒリヒリクラッシュ・反動のビリビリ演出（自分側=player、戦場全体を軽く揺らす）
function triggerTagHirihiriEffect(side, idx) {
    const zone = idx != null ? document.getElementById((side === 'enemy' ? 'tagEnemyCard' : 'tagPlayerCard') + idx) : document.getElementById('tagBattleStage');
    if(!zone) return;
    zone.classList.add('hirihiri-shake');
    setTimeout(() => zone.classList.remove('hirihiri-shake'), 500);
    const stage = document.getElementById('tagBattleStage');
    if(stage) {
        stage.classList.add('flash-hirihiri');
        setTimeout(() => stage.classList.remove('flash-hirihiri'), 400);
    }
}

function triggerEffect(target, damage) {
    if(battleAborted) return; // バトル強制終了中は演出しない
    const isCritHit = (target === "enemy-crit" || target === "player-crit");
    const pop=document.getElementById("damagePop");
    pop.innerHTML = isCritHit ? `<div class="crit-label">Spicy Hit!!!!!!!!</div><div class="crit-dmg">${damage}</div>` : damage;
    pop.style.display="block"; pop.style.animation="none"; pop.className="damage-pop";
    pop.offsetHeight;
    // 前回のフラッシュ系クラスが残っていれば強制的にクリア（タイマー競合対策）
    const stageEl = document.getElementById("battleStage");
    if(stageEl) stageEl.classList.remove("flash-red","flash-purple","flash-gold","flash-crit");
    if(target==="enemy"||target==="enemy-gold"||target==="enemy-poison"||target==="enemy-crit"){
        document.getElementById("enemyZone").classList.add("animate-shake");
        pop.style.top="130px"; pop.style.left="25%";
        if(target==="enemy") pop.style.color="#f1c40f";
        else if(target==="enemy-gold"){pop.style.color="#fff"; document.getElementById("battleStage").classList.add("flash-gold"); setTimeout(()=>document.getElementById("battleStage").classList.remove("flash-gold"),200);}
        else if(target==="enemy-crit"){ pop.style.color="#ff4500"; document.getElementById("battleStage").classList.add("flash-crit"); setTimeout(()=>document.getElementById("battleStage").classList.remove("flash-crit"),350); }
        else pop.style.color="#9b59b6";
        pop.style.animation = isCritHit ? "critPopUp 0.9s forwards" : "popUp 0.6s forwards";
        if(isCritHit) playSoundEffect('spicyhit.mp3');
        setTimeout(()=>document.getElementById("enemyZone").classList.remove("animate-shake"),200);
    }else if(target==="player-heal"){
        pop.innerHTML = "+" + damage;
        pop.style.top="240px"; pop.style.left="45%";
        pop.style.color="#2ecc71";
        pop.style.animation = "popUp 0.6s forwards";
    }else if(target==="enemy-heal"){
        pop.innerHTML = "+" + damage;
        pop.style.top="130px"; pop.style.left="25%";
        pop.style.color="#2ecc71";
        pop.style.animation = "popUp 0.6s forwards";
    }else{
        document.getElementById("battleStage").classList.add(target==="player-poison"?"flash-purple":(isCritHit?"flash-crit":"flash-red"),"animate-shake");
        pop.style.top="240px"; pop.style.left="45%";
        pop.style.color=target==="player-poison"?"#9b59b6":(isCritHit?"#ff4500":"#ff4757");
        pop.style.animation = isCritHit ? "critPopUp 0.9s forwards" : "popUp 0.6s forwards";
        setTimeout(()=>document.getElementById("battleStage").classList.remove("flash-red","flash-purple","flash-crit","animate-shake"),isCritHit?350:200);
    }
}
function done(pHP, oHP, myC, oppC, wasBlownAway) {
    stopBattleBGM();
    // バトル終了時にフラッシュ系クラスを完全クリア（次バトルへの影響防止）
    const stageElDone = document.getElementById("battleStage");
    if(stageElDone) stageElDone.classList.remove("flash-red","flash-purple","flash-gold","flash-crit","animate-shake");

    const isWin = pHP > oHP;
    const isDraw = pHP === oHP;
    // 毒ダメージで勝利した実績
    if(isWin && window.__defeatedByPoison) {
        updateStats(s => { s.wonByPoison = true; });
        window.__defeatedByPoison = false;
    } else {
        window.__defeatedByPoison = false;
    }
    const overlay=document.getElementById("battleResultOverlay"); const bigText=document.getElementById("battleResultBig");
    const verdictBigText = isWin ? "🏆 勝利!!" : (isDraw ? "🤝 引き分け" : "💀 敗北...");
    const verdictBigColor = isWin ? "#2ecc71" : (isDraw ? "#f1c40f" : "#ff4444");
    if(overlay&&bigText){bigText.innerText=verdictBigText; bigText.style.color=verdictBigColor; overlay.style.display="flex"; setTimeout(()=>{overlay.style.display="none"; document.getElementById("battleResultBox").style.display="block"; scrollResultIntoView("battleResultBox");},2000);}
    else { document.getElementById("battleResultBox").style.display="block"; scrollResultIntoView("battleResultBox"); }
    if(isWin){document.getElementById("oppOwnerText").style.color="#ff4444"; document.getElementById("oHpText").style.color="#ff4444";}
    else if(!isDraw){document.getElementById("pOwnerText").style.color="#ff4444"; document.getElementById("pHpText").style.color="#ff4444";}
    const res=document.getElementById("battleVerdict"); const rew=document.getElementById("rewardText");
    if(isWin){
        playWinSound(); res.innerText="🏆 勝利 !!"; res.style.color="#2ecc71";
        let g=30,e=5,loot="";
        if(isBotMatch&&oppC.isMaharaja){
            const mReward = MAHARAJA_REWARDS[oppC.maharajaLevel] || MAHARAJA_REWARDS[3];
            g = mReward.g;
            inventory["金箔"]=(inventory["金箔"]||0)+mReward.gold;discoveredItems["金箔"]=true;
            loot=`<img src="foods_icon/item_39.svg" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">金箔×${mReward.gold}ゲット！`;
            onBattleWin('bot','大富豪マハラジャ');
        }
        else if(isBotMatch&&oppC.isHardBot){g=60;e=activeBotData.expBonus;
            // 中級・高級くじプールからランダム
            const midPool=Object.keys(masterIngredients).filter(k=>masterIngredients[k].shop===1&&isIngredientAvailable(k));
            const highPool=Object.keys(masterIngredients).filter(k=>masterIngredients[k].shop===2&&isIngredientAvailable(k));
            const combined=[...midPool,...highPool];
            const itm=combined[Math.floor(Math.random()*combined.length)];
            inventory[itm]=(inventory[itm]||0)+1;discoveredItems[itm]=true;
            const itmD2=masterIngredients[itm]||masterSpices[itm];
            const itmIco2=itmD2&&itmD2.icon?`<img src="${itmD2.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">`:'' ;
            loot=`${itmIco2}${itm}ゲット！`;
            onBattleWin('hard', activeBotData.name);}
        else if(isBotMatch){e=activeBotData.expBonus;let drp=Object.keys(masterIngredients).filter(k=>masterIngredients[k].shop===0 && isIngredientAvailable(k));let itm=drp[Math.floor(Math.random()*drp.length)];inventory[itm]=(inventory[itm]||0)+1;discoveredItems[itm]=true;
            const itmD=masterIngredients[itm];const itmIco=itmD&&itmD.icon?`<img src="${itmD.icon}" style="width:1.2em;height:1.2em;vertical-align:middle;object-fit:contain;">`:'' ;
            loot=`${itmIco}${itm}ゲット！`;
            onBattleWin('bot', activeBotData.name);}
        else{g=50;e=10; updateStats(s => { s.totalWins = (s.totalWins||0) + 1; }); progressDailyQuest('room_win'); if(onlineRole === 'host') incrementGlobalStat('battle/room');}
        playerG+=g; const oldEXP1=playerEXP; playerEXP+=e;
        rew.innerHTML=`💰 +${g}G / ✨ +${e}EXP<br>${loot}`;
        setTimeout(()=>checkLvUp(oldEXP1,playerEXP),800);
    }else if(isDraw){
        res.innerText="🤝 引き分け"; res.style.color="#f1c40f";
        const oldEXP3=playerEXP; playerEXP+=2;
        rew.innerHTML=`✨ +2EXP 引き分けでした。`;
        updateStats(s => { s.gotDraw = true; });
        checkAndRenderAchievements();
        // 引き分けもバトル実施数として集計
        if(isBotMatch && oppC.isHardBot) incrementGlobalStat('battle/hard');
        else if(isBotMatch) incrementGlobalStat('battle/bot');
        else if(onlineRole === 'host') incrementGlobalStat('battle/room');
        setTimeout(()=>checkLvUp(oldEXP3,playerEXP),800);
    }else{
        res.innerText="💀 敗北 ..."; res.style.color="#e74c3c";
        const oldEXP2=playerEXP; playerEXP+=1;
        rew.innerHTML=`✨ +1EXP どんまい！`;
        // 敗北時もバトル実施数として集計
        if(isBotMatch && oppC.isHardBot) incrementGlobalStat('battle/hard');
        else if(isBotMatch) incrementGlobalStat('battle/bot');
        else if(onlineRole === 'host') incrementGlobalStat('battle/room');
        setTimeout(()=>checkLvUp(oldEXP2,playerEXP),800);
    }
    curryStock.splice(selectedCurryIndex,1); selectedCurryIndex=curryStock.length?0:-1;
    saveGame(); updateFridgeUI(); updateCookSelects(); updateMatchCurrySelects();
    if(!isBotMatch&&currentRoomId&&onlineRole==='host'&&database){
        setTimeout(()=>{database.ref('rooms/'+currentRoomId).remove(); currentRoomId=null;},8000);
    }
    if(typeof updateMatchCurrySelects==="function") updateMatchCurrySelects();
}
function endBattleScene() {
    stopBattleBGM();
    if(guestBattleRef){guestBattleRef.off();guestBattleRef=null;}
    // forfeitリスナーも確実に解除（リスナー重複防止）
    if(currentRoomId && database) { database.ref('rooms/'+currentRoomId+'/forfeit').off(); }
    endEventMode(); // イベント専用見た目をリセット
    document.getElementById("battleResultBox").style.display="none";
    document.getElementById("battleSetup").style.display="block";
    document.getElementById("lobbyArea").style.display="block";
    document.getElementById("waitingArea").style.display="none";
    document.getElementById("battleArena").style.display="none";
    showBattleGuideChar(); // 対戦タブに戻ったので案内人を再表示
}
