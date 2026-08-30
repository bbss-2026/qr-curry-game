// ============================================================
// ボードカレーバトル 専用ファイル
// ============================================================
// 【開発方針】（story.jsと同じ方針）
// ・本体（game.js）には手を加えず、このファイルの中だけで開発を進める
//   （唯一の例外：本編に3か所だけ追加した window.startExternalBoardBattle フックと、
//   done()/step()のisBoardBattle分岐。いずれも既存の挙動には一切影響しない追加のみ）。
// ・カレー画像判定（getCurryType/getCurryImage）・カレーストック（curryStock）・
//   戦闘エンジン（startExternalBoardBattle経由でlaunchVsCutIn以下一式）は、
//   すべてgame.js側の既存グローバルをそのまま利用する（再実装・二重管理はしない）。
// ・game.html側の変更は、このファイルを読み込む<script>タグ1行のみで完結させる。
//   入り口ボタン等のDOM要素は、すべてこのファイルからJSで動的に追加する。
// ・game.js・story.jsより後に読み込まれる前提（applyBookBattleLift等はstory.js側の定義）。
// ・このファイル内のDOM ID・CSSクラス名はすべて「bb」プレフィックスを付け、
//   本体の巨大なgame.htmlに既存のID・クラス名と絶対に衝突しないようにしている。
// ・カレー駒の見た目には絵文字を一切使用しない（本編と同じgetCurryImageのみを使用）。
// ・戦闘は「PCと対戦」の戦闘エンジンをstartExternalBoardBattle経由でそのまま起動する。
//   iframeや別ウィンドウは使わず、本体と同じ1つのJS実行環境の中で直接関数を呼ぶため、
//   タイトル画面・タブ切り替え・戦闘画面の表示状態など、本体側の状態にそのまま乗る形になる
//   （＝別ドキュメントを無理に起動するときに起きていた諸問題が構造的に発生しない）。
// ============================================================
(function () {

// ------------------------------------------------------------
// 0. スタイル注入（#bbRoot配下にのみ影響する。グローバルセレクタ(*、body等)は使わない）
// ------------------------------------------------------------
const BB_STYLE = `
#bbRoot, #bbRoot * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
#bbRoot {
    position: fixed; inset: 0; z-index: 9000; display: none; flex-direction: column;
    background: #2b1a0e; color: #efdeb1;
    font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
    overscroll-behavior: none; user-select: none;
}
#bbAppRoot { max-width: 720px; margin: 0 auto; width: 100%; height: 100%; position: relative; overflow: hidden; }

/* 地図アプリのように：盤面（#bbBoardWrap）は画面いっぱいに自由にパン・ズームでき、
   ヘッダー／行動順アイコン／メッセージウインドウは常に固定位置に浮かせて重ねて表示する。 */
#bbTopOverlay { position: absolute; top: 0; left: 0; right: 0; z-index: 25; display: flex; flex-direction: column; }

#bbHeaderBar {
    background: rgba(66,0,0,0.92); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;
    border-bottom: 2px solid #b88742; flex-shrink: 0;
}
#bbHeaderBar h1 { font-size: 14px; margin: 0; letter-spacing: 0.05em; color: #efdeb1; }
#bbHeaderBar .bb-header-right { display: flex; align-items: center; gap: 8px; }
.bb-devBadge { font-size: 10px; background: #b88742; color: #420000; padding: 2px 8px; border-radius: 10px; font-weight: bold; }
.bb-closeBtn { background: none; border: 1px solid #b88742; color: #efdeb1; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; }

#bbTurnQueueBar {
    display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: rgba(58,36,19,0.88);
    border-bottom: 1px solid rgba(107,74,38,0.8); overflow-x: auto; min-height: 62px; flex-shrink: 0;
    box-shadow: 0 6px 12px rgba(0,0,0,0.25);
}
.bb-turnIcon {
    width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0; position: relative;
    border: 2px solid #888; background: #efdeb1; opacity: 0.85; overflow: hidden;
    transition: transform 0.15s ease;
}
.bb-turnIcon img { width: 100%; height: 100%; object-fit: cover; display: block; }
.bb-turnIcon.bb-team-player { border-color: #3498db; }
.bb-turnIcon.bb-team-enemy { border-color: #e74c3c; }
.bb-turnIcon.bb-current { width: 52px; height: 52px; opacity: 1; transform: scale(1.05); box-shadow: 0 0 12px rgba(255,255,255,0.6); }

/* 盤面は#bbAppRoot全体に敷き詰め、ヘッダー等の下にも回り込ませる（地図アプリのタイル層と同じ考え方）。
   ネイティブのスクロール（overflow:auto）は使わず、pointer/wheelイベントで自前のパン・ズームを実装する。 */
#bbBoardWrap { position: absolute; inset: 0; overflow: hidden; touch-action: none; background: #2b1a0e; }
#bbBoardSvg { width: 100%; height: 100%; display: block; }
.bb-board-edge { stroke: #6b4a26; stroke-width: 2; }
.bb-board-node-circle { fill: #efdeb1; stroke: #6b4a26; stroke-width: 3; cursor: default; }
.bb-board-node-circle.bb-flag-tile { fill: #f5e9c8; stroke: #b88742; stroke-width: 4; }
.bb-board-node-circle.bb-selectable { stroke: #2ecc71; stroke-width: 4; cursor: pointer; }
.bb-board-node-circle.bb-movable { stroke: #f1c40f; stroke-width: 4; cursor: pointer; }
.bb-board-node-circle.bb-occupied-player { stroke: #3498db; }
.bb-board-node-circle.bb-occupied-enemy { stroke: #e74c3c; }
.bb-active-ring {
    fill: none; stroke: #ffe066; stroke-width: 4; opacity: 0.9;
    transform-box: fill-box; transform-origin: center;
    animation: bbActivePulse 0.9s ease-out infinite;
}
@keyframes bbActivePulse {
    0%   { transform: scale(1);   opacity: 0.9; }
    100% { transform: scale(1.45);opacity: 0; }
}
.bb-board-node-circle.bb-active-turn { stroke: #ffe066; stroke-width: 5; }
.bb-board-hp-bg { fill: #222; }
.bb-board-hp-fill { fill: #2ecc71; }

#bbBottomPanel {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 25;
    background: rgba(58,36,19,0.94); border-top: 2px solid #b88742; padding: 12px;
    max-height: 46vh; overflow-y: auto; box-shadow: 0 -6px 14px rgba(0,0,0,0.3);
}
#bbBottomPanel h2 { font-size: 13px; margin: 0 0 8px 0; color: #f5c469; }
#bbBudgetLine { font-size: 12px; margin-bottom: 8px; }
#bbBudgetLine.bb-over { color: #e74c3c; font-weight: bold; }
#bbRosterList { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; max-height: 160px; overflow-y: auto; }
.bb-rosterCard {
    width: 78px; background: #2b1a0e; border: 2px solid #6b4a26; border-radius: 8px; padding: 6px 4px;
    text-align: center; cursor: pointer; font-size: 10px;
}
.bb-rosterCard.bb-picked { border-color: #2ecc71; background: #1f3a1f; }
.bb-rosterCard .bb-rcVisual { width: 40px; height: 40px; margin: 0 auto; border-radius: 50%; overflow: hidden; background: #efdeb1; }
.bb-rosterCard .bb-rcVisual img { width: 100%; height: 100%; object-fit: cover; display: block; }
.bb-rosterCard .bb-rcName { font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.bb-rosterCard .bb-rcStats { font-size: 8px; color: #b88742; margin-top: 2px; }
#bbPlaceHint { font-size: 11px; color: #b88742; margin-bottom: 8px; line-height: 1.5; }
.bb-actionBtn {
    background: #b88742; color: #efdeb1; border: none; border-radius: 6px; padding: 10px 20px;
    font-weight: bold; font-size: 13px; cursor: pointer; margin-right: 8px; margin-top: 4px;
}
.bb-actionBtn:disabled { background: #6b4a26; color: #8a7250; cursor: not-allowed; }
.bb-actionBtn.bb-secondary { background: #5a3d20; }
#bbBattleLog {
    background: #1c1108; border: 1px solid #6b4a26; border-radius: 6px; padding: 8px; font-size: 11px;
    max-height: 90px; overflow-y: auto; margin-bottom: 8px; line-height: 1.6; white-space: pre-wrap;
}
#bbResultOverlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 9010;
}
#bbResultBox { background: #efdeb1; color: #420000; border-radius: 12px; padding: 30px 40px; text-align: center; }
#bbResultBox h2 { font-size: 24px; margin: 0 0 12px 0; }

/* 盤面バトル中に起動する本編の戦闘画面：咖喱図書館用の背景（applyBookBattleLiftが敷く
   currylibrary_bg.png）ではなく、盤面（#bbRoot）がうっすら透けて見える半透明オーバーレイにする。
   story.js側の #battleArena.book-battle-lift ルールは、咖喱図書館を開いたタイミングで
   後から<style>が追加されるため、CSS挿入順に頼ると負けることがある。挿入順に関係なく必ず
   優先されるよう、book-battle-lift自体も含めて2クラス指定にし、詳細度そのものを上回らせる。 */
#battleArena.book-battle-lift.bb-arena-overlay {
    background: rgba(20,12,6,0.55) !important;
}
.battle-stage.bb-battle-bg {
    background: rgba(10,10,10,0.32) !important;
    border: 1px solid rgba(241,196,15,0.25) !important;
    box-shadow: 0 20px 50px rgba(0,0,0,0.4) !important;
}
/* 戦闘中は盤面に触れられないよう、画面全体を覆う黒いブロック用オーバーレイを敷く。
   #bbRoot（z-index:9000）より前面、本編の戦闘画面（book-battle-liftでz-index:10050）より
   背面に置くことで、戦闘カード幅（max-width:500px）の外側（左右の余白）も含めて
   画面全体のタップを塞ぐ。カード自体は#battleArenaが最前面のまま表示される。 */
#bbBattleBlockOverlay {
    position: fixed; inset: 0; z-index: 9500; background: rgba(0,0,0,0.45); display: none;
}
/* 盤面パン・ズームの自動追従（行動順が来た駒をセンターへ）だけ滑らかにアニメーションさせる。
   ユーザー自身のドラッグ・ピンチ操作中はこのクラスを付けない＝指の動きに1:1で追従させる。 */
#bbViewportG.bb-view-animated { transition: transform 0.35s ease; }

#bbLauncherBtn {
    position: fixed; right: 14px; bottom: 88px; z-index: 8000; display: none; align-items: center; gap: 6px;
    background: #b88742; color: #efdeb1; border: none; border-radius: 24px;
    padding: 10px 16px; font-size: 13px; font-weight: bold; cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
}
`;

// ------------------------------------------------------------
// 1. 盤面トポロジー
//    行ごとのマス数： 1-2-3-2-3-2-3-2-3-2-1（全11行・計24マス）
//    5本の固定列（列0〜4、列2が中央）を使い、
//      ・旗の行（行0=敵旗／行10=自陣旗）は列2のみ
//      ・「外側」行（行2,4,6,8）は列0,2,4
//      ・「内側」行（行1,3,5,7,9）は列1,3
//    道（辺）は「縦（同じ列で2行離れたマス同士）」と
//    「斜め（隣接する行・隣接する列同士）」のみで、
//    同じ行内の横方向のつながりは一切作りません。
// ------------------------------------------------------------
const BB_ROWS_DEF = [
    [2],       // row0  敵陣旗
    [1, 3],    // row1
    [0, 2, 4], // row2
    [1, 3],    // row3
    [0, 2, 4], // row4
    [1, 3],    // row5
    [0, 2, 4], // row6
    [1, 3],    // row7
    [0, 2, 4], // row8
    [1, 3],    // row9
    [2]        // row10 自陣旗
];
const BB_ROW_TOP = 0;
const BB_ROW_BOTTOM = BB_ROWS_DEF.length - 1; // 10
const BB_ENEMY_DEPLOY_ROWS = [1, 2];   // 敵旗から2行以内（2+3=5マス＝最大5体とぴったり一致）
const BB_PLAYER_DEPLOY_ROWS = [8, 9];  // 自陣旗から2行以内（3+2=5マス＝最大5体とぴったり一致）

const BB_COL_X = [60, 195, 300, 405, 540]; // 5列のx座標（列2が中央＝旗の列）
const BB_BOARD_WIDTH = 600;
const BB_ROW_Y_TOP = 60;
const BB_ROW_Y_GAP = 78;
const BB_NODE_R = 28;

const BB_STAT_BUDGET = 2500;
const BB_MAX_UNITS = 5;

let bbNodes = [];   // {id,row,col,x,y,neighbors:[id...]}
let bbNodesById = {};

function bbBuildBoard() {
    bbNodes = [];
    let id = 0;
    BB_ROWS_DEF.forEach((cols, rowIdx) => {
        cols.forEach(col => {
            bbNodes.push({
                id: id, row: rowIdx, col: col,
                x: BB_COL_X[col], y: BB_ROW_Y_TOP + rowIdx * BB_ROW_Y_GAP,
                neighbors: []
            });
            id++;
        });
    });
    bbNodesById = {};
    bbNodes.forEach(n => { bbNodesById[n.id] = n; });
    bbBuildEdges();
}

function bbFindNode(row, col) {
    return bbNodes.find(n => n.row === row && n.col === col) || null;
}

function bbBuildEdges() {
    const connect = (a, b) => {
        if (!a || !b) return;
        if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
        if (!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
    };
    bbNodes.forEach(n => {
        // 縦：同じ列で2行下のマス（間の行にはこの列のマスが無いため）
        connect(n, bbFindNode(n.row + 2, n.col));
        // 斜め：1行下の隣接列（横方向の接続はここでは作らない）
        connect(n, bbFindNode(n.row + 1, n.col - 1));
        connect(n, bbFindNode(n.row + 1, n.col + 1));
    });
}

function bbGetFlagNodeId(team) {
    const row = (team === 'player') ? BB_ROW_BOTTOM : BB_ROW_TOP;
    const n = bbFindNode(row, 2);
    return n ? n.id : null;
}

function bbGetDeployRows(team) {
    return team === 'player' ? BB_PLAYER_DEPLOY_ROWS : BB_ENEMY_DEPLOY_ROWS;
}

// ------------------------------------------------------------
// 2. カレー ↔ ユニット
//    カレー画像の判定（getCurryType/getCurryImage）は本編game.js側の
//    既存グローバル関数をそのまま呼び出す（このファイルでは再定義しない）。
// ------------------------------------------------------------
let bbUnitSeq = 1;
function bbMakeUnit(curry, team) {
    const hp = Math.max(1, curry.hp || 1);
    return {
        uid: bbUnitSeq++,
        name: curry.name || 'カレー',
        hp: hp, maxHp: hp,
        atk: curry.atk || 0, def: curry.def || 0, spd: curry.spd || 0,
        team: team,
        nodeId: null,
        delay: bbComputeDelay(curry.spd || 0),
        raw: curry
    };
}
function bbComputeDelay(spd) {
    const s = Math.max(0, spd || 0);
    return Math.round(100000 / (s + 200)); // ゼロ除算防止：+200なのでspd=0でも安全
}
function bbStatTotal(c) { return (c.hp || 0) + (c.atk || 0) + (c.def || 0) + (c.spd || 0); }

// ------------------------------------------------------------
// 3. 実際のカレーストックを読み込む
//    本編と同じ実行環境で動いているため、curryStock（game.js側のグローバル）を
//    直接参照できる。localStorageの再パースは不要（常に最新の状態と一致する）。
// ------------------------------------------------------------
function bbLoadRealCurryStock() {
    try {
        return (typeof curryStock !== 'undefined' && Array.isArray(curryStock))
            ? curryStock.filter(c => !c.isDelivering)
            : [];
    } catch (e) {
        console.warn('[ボードバトル] カレーストックの読み込みに失敗:', e);
        return [];
    }
}

// 敵カレーの生成：宅配カレーのダミーキャラ生成（generateRandomCurryFromPool/buildCurryFromMaterials）と
// 全く同じ、本編の実際の調理ロジックをそのまま流用する。食材の組み合わせ次第で特殊カレー
// （毒・マルゲリータ・ホームラン等）も同じ条件判定でそのまま出現する。
const BB_DEBUG_RANDOM_CURRY_NAMES = ['野生のカレー', '謎のカレー', '見習いのカレー', '放浪カレー', '名もなきカレー', '荒野のカレー', '古の一皿', '通りすがりのカレー'];
function bbGenerateDebugCurry(targetTotalHint) {
    if (typeof generateRandomCurryFromPool === 'function' &&
        (typeof getHighIngredientPool === 'function' || typeof getMidIngredientPool === 'function')) {
        try {
            const pool = (typeof getHighIngredientPool === 'function') ? getHighIngredientPool()
                : getMidIngredientPool();
            if (pool && pool.length > 0) {
                // includeSpice=trueにすることでスパイスも抽選対象にし、特殊カレーが出る幅を広げる。
                return generateRandomCurryFromPool(pool, true);
            }
        } catch (e) {
            console.warn('[ボードバトル] 実際の調理ロジックでの敵カレー生成に失敗。簡易生成にフォールバックします', e);
        }
    }
    // フォールバック：本編の調理関数が見つからない場合のみ、従来の簡易ランダム生成を使う。
    const total = targetTotalHint || (300 + Math.floor(Math.random() * 300));
    const weights = [Math.random(), Math.random(), Math.random(), Math.random()];
    const wsum = weights.reduce((a, b) => a + b, 0);
    const hp = Math.max(20, Math.round(total * weights[0] / wsum));
    const atk = Math.max(10, Math.round(total * weights[1] / wsum));
    const def = Math.max(10, Math.round(total * weights[2] / wsum));
    const spd = Math.max(5, Math.round(total * weights[3] / wsum));
    const curryTypeVal = (typeof getCurryType === 'function') ? getCurryType(hp, atk, def, spd) : 'balance';
    return {
        name: BB_DEBUG_RANDOM_CURRY_NAMES[Math.floor(Math.random() * BB_DEBUG_RANDOM_CURRY_NAMES.length)],
        hp, atk, def, spd,
        curryType: curryTypeVal
    };
}
function bbGenerateDebugEnemyTeam() {
    // ステータス予算2500を超えないよう、実際の調理ロジックで1体ずつ生成しては足していく
    // （食材の組み合わせ由来のステータスは狙って割り振れないため、事前配分ではなく詰め込み式にする）。
    const team = [];
    let remaining = BB_STAT_BUDGET;
    let attempts = 0;
    while (team.length < BB_MAX_UNITS && attempts < 50 && (team.length === 0 || remaining > 150)) {
        attempts++;
        const curry = bbGenerateDebugCurry();
        const total = bbStatTotal(curry);
        if (total <= remaining || team.length === 0) {
            team.push(curry);
            remaining -= total;
        }
    }
    return team;
}
function bbGetCurryImg(curry) {
    return (typeof getCurryImage === 'function') ? getCurryImage(curry) : '';
}

// ------------------------------------------------------------
// 4. ゲーム状態
// ------------------------------------------------------------
const bbState = {
    phase: 'placement', // 'placement' | 'battle' | 'result'
    playerPool: [],      // 配置候補（実カレーストック）
    enemyPool: [],        // デバッグ生成された敵候補
    selectedPoolIndex: null,
    units: [],            // 盤面に配置された全ユニット（player/enemy混在。行動順は下記の通り完全に統一されたタイムラインで管理）
    activeUnit: null,
    battleLogLines: []
};

function bbInit() {
    bbBuildBoard();
    bbState.phase = 'placement';
    bbState.playerPool = bbLoadRealCurryStock();
    bbState.enemyPool = bbGenerateDebugEnemyTeam();
    bbState.selectedPoolIndex = null;
    bbState.units = [];
    bbState.activeUnit = null;
    bbState.battleLogLines = [];
    document.getElementById('bbPlacementPanel').style.display = 'block';
    document.getElementById('bbBattlePanel').style.display = 'none';
    document.getElementById('bbBattleLog').innerHTML = '';
    // 前回の勝敗結果ポップアップが残ったままにならないよう、開く・再スタートのたびに必ず隠す
    // （「DEFEATのまま閉じずに再度開いた」不具合の対策）。
    document.getElementById('bbResultOverlay').style.display = 'none';
    bbRenderBoard();
    bbRenderPlacementPanel();
    bbFitView();
}

// ------------------------------------------------------------
// 4.5. 盤面のパン・ズーム（地図アプリのように自由に動かせる）
//    #bbBoardWrapは画面全体に敷き詰められた固定領域で、ネイティブのスクロールは使わない。
//    盤面の内容（辺・ノード・駒）は<g id="bbViewportG">の中に描画し、その要素へ
//    transform: translate(x,y) scale(s) を直接適用してパン・ズームを実現する。
//    ヘッダー／行動順バー／メッセージウインドウは別レイヤー（position:absolute）で
//    常に画面上の同じ位置に固定表示され、この変形の影響を受けない。
// ------------------------------------------------------------
const BB_MIN_SCALE = 0.5, BB_MAX_SCALE = 3;
let bbView = { x: 0, y: 0, scale: 1 };
const bbPointers = new Map(); // pointerId -> {x,y}（#bbBoardWrap基準の座標）
let bbDragLast = null;   // 1本指パンの直前座標
let bbPinchLast = null;  // 2本指ピンチの直前状態 {dist,cx,cy}
let bbGestureMoved = 0;  // このジェスチャー中に動いた量（クリックか否かの判定用）

function bbBoardTotalHeight() {
    return BB_ROW_Y_TOP + (BB_ROWS_DEF.length - 1) * BB_ROW_Y_GAP + 60;
}

function bbSyncSvgSize(w, h) {
    const svg = document.getElementById('bbBoardSvg');
    if (!svg) return;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
}

function bbApplyView() {
    const g = document.getElementById('bbViewportG');
    if (g) g.setAttribute('transform', `translate(${bbView.x},${bbView.y}) scale(${bbView.scale})`);
}

// 行動順が回ってきた駒を画面中央へ自動的に移動させる（ズーム倍率は変えない）。
// ユーザーの手動パン・ピンチ操作とは違い、ここだけは滑らかにスクロールさせる。
// bb-view-animatedクラスの付与とtransform変更を同じフレームで行うと、ブラウザが
// 「変化前」の状態を描画する前に「変化後」へ飛んでしまい、トランジションが効かず
// 瞬間移動に見えてしまう（駒移動アニメーションで踏んだのと同じ問題）。そのため
// クラス付与→強制リフロー→次のフレームでtransform変更、の順にする。
function bbCenterOnNode(nodeId) {
    const node = bbNodesById[nodeId];
    const wrap = document.getElementById('bbBoardWrap');
    const g = document.getElementById('bbViewportG');
    if (!node || !wrap || !g) return;
    const wrapW = wrap.clientWidth || 360;
    const wrapH = wrap.clientHeight || 600;
    const targetX = wrapW / 2 - node.x * bbView.scale;
    const targetY = wrapH / 2 - node.y * bbView.scale;
    g.classList.add('bb-view-animated');
    requestAnimationFrame(() => {
        void g.getBoundingClientRect(); // 強制リフローで現在位置を確定させる
        requestAnimationFrame(() => {
            bbView.x = targetX;
            bbView.y = targetY;
            bbApplyView();
        });
    });
    setTimeout(() => { g.classList.remove('bb-view-animated'); }, 420);
}

// 盤面全体が画面にちょうど収まるよう、初期のパン位置・ズームを計算する（開始・リスタート時に実行）。
function bbFitView() {
    const wrap = document.getElementById('bbBoardWrap');
    if (!wrap) return;
    const wrapW = wrap.clientWidth || 360;
    const wrapH = wrap.clientHeight || 600;
    bbSyncSvgSize(wrapW, wrapH);
    const totalHeight = bbBoardTotalHeight();
    const fitScale = Math.max(BB_MIN_SCALE, Math.min(BB_MAX_SCALE,
        Math.min(wrapW / BB_BOARD_WIDTH, wrapH / totalHeight) * 0.92));
    bbView.scale = fitScale;
    bbView.x = (wrapW - BB_BOARD_WIDTH * fitScale) / 2;
    bbView.y = (wrapH - totalHeight * fitScale) / 2;
    bbApplyView();
}

function bbGetWrapPoint(evt) {
    const wrap = document.getElementById('bbBoardWrap');
    const rect = wrap.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

function bbComputePinch(pts) {
    const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
    return { dist: Math.hypot(dx, dy), cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2 };
}

function bbZoomAt(px, py, factor) {
    const newScale = Math.min(BB_MAX_SCALE, Math.max(BB_MIN_SCALE, bbView.scale * factor));
    const actualFactor = newScale / bbView.scale;
    bbView.x = px - (px - bbView.x) * actualFactor;
    bbView.y = py - (py - bbView.y) * actualFactor;
    bbView.scale = newScale;
    bbApplyView();
}

function bbOnPointerDown(evt) {
    const wrap = document.getElementById('bbBoardWrap');
    if (wrap.setPointerCapture) { try { wrap.setPointerCapture(evt.pointerId); } catch (e) {} }
    bbPointers.set(evt.pointerId, bbGetWrapPoint(evt));
    bbGestureMoved = 0;
    if (bbPointers.size === 1) {
        bbDragLast = bbGetWrapPoint(evt);
        bbPinchLast = null;
    } else if (bbPointers.size === 2) {
        bbPinchLast = bbComputePinch(Array.from(bbPointers.values()));
        bbDragLast = null;
    }
}
function bbOnPointerMove(evt) {
    if (!bbPointers.has(evt.pointerId)) return;
    bbPointers.set(evt.pointerId, bbGetWrapPoint(evt));
    if (bbPointers.size === 1 && bbDragLast) {
        const p = bbGetWrapPoint(evt);
        const dx = p.x - bbDragLast.x, dy = p.y - bbDragLast.y;
        bbGestureMoved += Math.hypot(dx, dy);
        bbView.x += dx; bbView.y += dy;
        bbDragLast = p;
        bbApplyView();
    } else if (bbPointers.size === 2) {
        const pts = Array.from(bbPointers.values());
        const now = bbComputePinch(pts);
        if (bbPinchLast && bbPinchLast.dist > 0) {
            bbZoomAt(now.cx, now.cy, now.dist / bbPinchLast.dist);
            bbGestureMoved += Math.abs(now.dist - bbPinchLast.dist);
        }
        bbPinchLast = now;
    }
}
function bbOnPointerUpOrCancel(evt) {
    bbPointers.delete(evt.pointerId);
    if (bbPointers.size === 1) {
        bbDragLast = Array.from(bbPointers.values())[0] || null;
        bbPinchLast = null;
    } else if (bbPointers.size === 0) {
        bbDragLast = null; bbPinchLast = null;
    }
}
function bbOnWheel(evt) {
    evt.preventDefault();
    const p = bbGetWrapPoint(evt);
    const factor = evt.deltaY < 0 ? 1.12 : (1 / 1.12);
    bbZoomAt(p.x, p.y, factor);
}
// パン・ピンチでそれなりに動いた後のclickは、ノードのタップ操作として扱わない
// （地図アプリで指を滑らせただけなのに、下にあった場所を誤ってタップ判定しないのと同じ）。
function bbOnBoardClickCapture(evt) {
    if (bbGestureMoved > 8) {
        evt.stopPropagation();
        evt.preventDefault();
    }
    bbGestureMoved = 0;
}

// ------------------------------------------------------------
// 5. 盤面描画
// ------------------------------------------------------------
function bbFlagMarkup(x, y, color) {
    let s = `<line x1="${x}" y1="${y - 16}" x2="${x}" y2="${y + 14}" stroke="${color}" stroke-width="3"></line>`;
    s += `<path d="M ${x} ${y - 16} L ${x + 16} ${y - 10} L ${x} ${y - 4} Z" fill="${color}"></path>`;
    return s;
}

function bbRenderBoard() {
    const viewportG = document.getElementById('bbViewportG');
    if (!viewportG) return;
    let html = '';
    // 辺（縦・斜めのみ。横方向の辺は存在しない）
    bbNodes.forEach(n => {
        n.neighbors.forEach(nid => {
            if (nid > n.id) {
                const o = bbNodesById[nid];
                html += `<line class="bb-board-edge" x1="${n.x}" y1="${n.y}" x2="${o.x}" y2="${o.y}"></line>`;
            }
        });
    });
    // ノード
    bbNodes.forEach(n => {
        const isFlag = (n.row === BB_ROW_TOP || n.row === BB_ROW_BOTTOM);
        // 移動アニメーション中のユニットは、通常描画では一旦隠す（浮動スプライト側で表示する）
        const unit = bbState.units.find(u => u.nodeId === n.id && !u._animating);
        const isActive = !!(bbState.activeUnit && bbState.activeUnit.nodeId === n.id && bbState.activeUnit.hp > 0 && !bbState.activeUnit._animating);
        let cls = 'bb-board-node-circle';
        if (isFlag) cls += ' bb-flag-tile';
        if (unit) cls += (unit.team === 'player') ? ' bb-occupied-player' : ' bb-occupied-enemy';
        if (n.highlight === 'selectable') cls += ' bb-selectable';
        if (n.highlight === 'movable') cls += ' bb-movable';
        if (isActive) cls += ' bb-active-turn';
        html += `<g onclick="window.__bbOnNodeClick(${n.id})">`;
        if (isActive) {
            html += `<circle class="bb-active-ring" cx="${n.x}" cy="${n.y}" r="${BB_NODE_R + 4}"></circle>`;
        }
        html += `<circle class="${cls}" cx="${n.x}" cy="${n.y}" r="${BB_NODE_R}"></circle>`;
        if (isFlag && !unit) {
            html += bbFlagMarkup(n.x, n.y, n.row === BB_ROW_TOP ? '#e74c3c' : '#3498db');
        }
        if (unit) {
            const clipId = `bbClip${n.id}`;
            const r2 = BB_NODE_R - 4;
            html += `<defs><clipPath id="${clipId}"><circle cx="${n.x}" cy="${n.y}" r="${r2}"></circle></clipPath></defs>`;
            html += `<image href="${bbGetCurryImg(unit.raw)}" x="${n.x - r2}" y="${n.y - r2}" width="${r2 * 2}" height="${r2 * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"></image>`;
            const pct = Math.max(0, unit.hp / unit.maxHp);
            const barW = BB_NODE_R * 1.6;
            html += `<rect class="bb-board-hp-bg" x="${n.x - barW / 2}" y="${n.y + BB_NODE_R + 4}" width="${barW}" height="5" rx="2"></rect>`;
            html += `<rect class="bb-board-hp-fill" x="${n.x - barW / 2}" y="${n.y + BB_NODE_R + 4}" width="${barW * pct}" height="5" rx="2"></rect>`;
        }
        html += `</g>`;
    });
    viewportG.innerHTML = html;
}
function bbEsc(s) { return String(s == null ? '' : s); }

// ------------------------------------------------------------
// 6. 配置フェーズ
// ------------------------------------------------------------
function bbRenderPlacementPanel() {
    const list = document.getElementById('bbRosterList');
    list.innerHTML = bbState.playerPool.map((c, idx) => {
        const picked = bbState.units.some(u => u.team === 'player' && u.raw === c);
        return `<div class="bb-rosterCard${picked ? ' bb-picked' : ''}" onclick="window.__bbOnPickPoolCurry(${idx})">
            <div class="bb-rcVisual"><img src="${bbGetCurryImg(c)}" alt=""></div>
            <div class="bb-rcName">${bbEsc(c.name || 'カレー')}</div>
            <div class="bb-rcStats">HP${c.hp||0} ATK${c.atk||0}<br>DEF${c.def||0} SPD${c.spd||0}</div>
        </div>`;
    }).join('') || '<div style="font-size:11px;color:#b88742;">カレーストックにカレーがありません。カレーを調理してから開いてください。</div>';
    bbUpdateBudgetLine();
    bbHighlightDeployTiles();
    bbRenderBoard();
}

function bbUpdateBudgetLine() {
    const placed = bbState.units.filter(u => u.team === 'player');
    const total = placed.reduce((sum, u) => sum + bbStatTotal(u.raw), 0);
    const el = document.getElementById('bbBudgetLine');
    el.textContent = `合計ステータス: ${total} / ${BB_STAT_BUDGET}　配置数: ${placed.length} / ${BB_MAX_UNITS}`;
    el.classList.toggle('bb-over', total > BB_STAT_BUDGET);
    document.getElementById('bbBtnStartBattle').disabled = !(placed.length > 0 && total <= BB_STAT_BUDGET);
}

function bbHighlightDeployTiles() {
    bbNodes.forEach(n => { n.highlight = null; });
    if (bbState.selectedPoolIndex !== null) {
        const deployRows = bbGetDeployRows('player');
        bbNodes.forEach(n => {
            if (deployRows.includes(n.row) && !bbState.units.some(u => u.nodeId === n.id)) {
                n.highlight = 'selectable';
            }
        });
    }
}

function bbOnPickPoolCurry(idx) {
    if (bbState.phase !== 'placement') return;
    const already = bbState.units.find(u => u.team === 'player' && u.raw === bbState.playerPool[idx]);
    if (already) {
        // 選び直し＝配置取り消し
        bbState.units = bbState.units.filter(u => u !== already);
        bbState.selectedPoolIndex = null;
        bbRenderPlacementPanel();
        return;
    }
    const placed = bbState.units.filter(u => u.team === 'player');
    if (placed.length >= BB_MAX_UNITS) {
        alert('配置できるのは最大5体までです。');
        return;
    }
    bbState.selectedPoolIndex = idx;
    bbHighlightDeployTiles();
    bbRenderBoard();
}

function bbOnNodeClick(nodeId) {
    if (bbState.phase === 'placement') {
        if (bbState.selectedPoolIndex === null) return;
        const node = bbNodesById[nodeId];
        if (node.highlight !== 'selectable') return;
        const curry = bbState.playerPool[bbState.selectedPoolIndex];
        const total = bbState.units.filter(u => u.team === 'player').reduce((s, u) => s + bbStatTotal(u.raw), 0) + bbStatTotal(curry);
        if (total > BB_STAT_BUDGET) {
            alert('ステータス合計が2500を超えるため配置できません。');
            return;
        }
        const unit = bbMakeUnit(curry, 'player');
        unit.nodeId = nodeId;
        bbState.units.push(unit);
        bbState.selectedPoolIndex = null;
        bbRenderPlacementPanel();
        return;
    }
    if (bbState.phase === 'battle') {
        bbOnBattleNodeClick(nodeId);
    }
}

function bbOnRegenerateEnemyClick() {
    bbState.enemyPool = bbGenerateDebugEnemyTeam();
    bbAppendLog('敵編成を再生成しました（デバッグ）。');
}

function bbOnStartBattleClick() {
    // 敵チームを自動配置（敵配置マスにランダムに割り当て）
    const enemyDeployNodes = bbNodes.filter(n => bbGetDeployRows('enemy').includes(n.row));
    bbShuffleArray(enemyDeployNodes);
    let idx = 0;
    bbState.enemyPool.slice(0, BB_MAX_UNITS).forEach(curry => {
        if (idx >= enemyDeployNodes.length) return;
        const unit = bbMakeUnit(curry, 'enemy');
        unit.nodeId = enemyDeployNodes[idx].id;
        bbState.units.push(unit);
        idx++;
    });
    bbNodes.forEach(n => { n.highlight = null; });
    bbState.phase = 'battle';
    document.getElementById('bbPlacementPanel').style.display = 'none';
    document.getElementById('bbBattlePanel').style.display = 'block';
    bbRenderBoard();
    bbAppendLog('戦闘開始！');
    bbScheduleNextTurn();
}
function bbShuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }

// ------------------------------------------------------------
// 7. ATB行動順エンジン
//    ディレイ値 = round(100000 / (SPD+200))。全員から毎ステップ1ずつ減らし、
//    0になった駒（複数なら元SPDが高い方、それも同じならランダム）に行動権を渡す。
//    ★敵味方の区別は一切なく、bbState.units全員（プレイヤー・敵混在）を同じ
//    1本のタイムラインで比較しているため、「敵ターン／味方ターン」という
//    フェーズ分けそのものが存在しません（bbPickNextActorが唯一の判定ロジック）。
// ------------------------------------------------------------
function bbPickNextActor() {
    const alive = bbState.units.filter(u => u.hp > 0); // ← teamによる絞り込みは行わない＝敵味方混在の1本のタイムライン
    if (alive.length === 0) return null;
    let minDelay = Math.min(...alive.map(u => u.delay));
    alive.forEach(u => { u.delay -= minDelay; });
    let candidates = alive.filter(u => u.delay <= 0);
    if (candidates.length > 1) {
        const maxSpd = Math.max(...candidates.map(u => u.spd));
        const topSpd = candidates.filter(u => u.spd === maxSpd);
        candidates = [topSpd[Math.floor(Math.random() * topSpd.length)]];
    }
    return candidates[0] || alive[0];
}

function bbScheduleNextTurn() {
    if (bbState.phase !== 'battle') return;
    const winner = bbCheckWinCondition();
    if (winner) { bbEndBattle(winner); return; }
    const actor = bbPickNextActor();
    if (!actor) return;
    bbState.activeUnit = actor;
    bbRenderTurnQueuePreview();
    bbRenderBoard(); // ← アクティブな駒のノードを光らせるため再描画
    bbCenterOnNode(actor.nodeId); // 行動順が回ってきた駒を画面中央へ自動的に移動
    if (actor.team === 'player') {
        bbHighlightMovableTiles(actor);
        bbSetBattleStatus(`${actor.name} の番です。移動先のマスをタップしてください。`);
    } else {
        bbSetBattleStatus(`${actor.name}（敵）が行動中…`);
        setTimeout(() => { bbPerformEnemyTurn(actor); }, 500);
    }
}

function bbRenderTurnQueuePreview() {
    // 表示専用の簡易プレビュー：現在のdelay状態からこの先の順番を軽くシミュレートする
    // （敵味方を分けず、同じ1本のタイムラインとしてそのまま並べる）
    const bar = document.getElementById('bbTurnQueueBar');
    const sim = bbState.units.filter(u => u.hp > 0).map(u => ({ u, delay: u.delay }));
    const order = [];
    for (let step = 0; step < 8 && sim.length > 0; step++) {
        const minD = Math.min(...sim.map(s => s.delay));
        sim.forEach(s => s.delay -= minD);
        let ready = sim.filter(s => s.delay <= 0);
        ready.sort((a, b) => b.u.spd - a.u.spd);
        const chosen = ready[0];
        if (!chosen) break;
        order.push(chosen.u);
        chosen.delay = bbComputeDelay(chosen.u.spd);
    }
    bar.innerHTML = order.map((u, i) => {
        const cls = `bb-turnIcon bb-team-${u.team}${i === 0 ? ' bb-current' : ''}`;
        return `<div class="${cls}" title="${bbEsc(u.name)}"><img src="${bbGetCurryImg(u.raw)}" alt=""></div>`;
    }).join('');
}

// ------------------------------------------------------------
// 8. 移動・戦闘
// ------------------------------------------------------------
function bbHighlightMovableTiles(unit) {
    bbNodes.forEach(n => { n.highlight = null; });
    const node = bbNodesById[unit.nodeId];
    node.neighbors.forEach(nid => {
        const target = bbNodesById[nid];
        const occupant = bbState.units.find(u => u.nodeId === nid && u.hp > 0);
        if (!occupant || occupant.team !== unit.team) {
            target.highlight = 'movable';
        }
    });
    bbRenderBoard();
}

function bbGetMovableNeighbors(unit) {
    const node = bbNodesById[unit.nodeId];
    return node.neighbors.filter(nid => {
        const occupant = bbState.units.find(u => u.nodeId === nid && u.hp > 0);
        return !occupant || occupant.team !== unit.team;
    });
}

function bbOnBattleNodeClick(nodeId) {
    const actor = bbState.activeUnit;
    if (!actor || actor.team !== 'player') return;
    const node = bbNodesById[nodeId];
    if (node.highlight !== 'movable') return;
    bbMoveUnitTo(actor, nodeId);
}

// ------------------------------------------------------------
// 移動スライドアニメーション
//    bbRenderBoard()は毎回SVGを丸ごと作り直すため、そのままではDOM要素が毎回
//    作り直されてしまいCSSトランジションが効かない。そこで移動中だけは対象
//    ユニットを通常描画から隠し（bbRenderBoard側の!u._animating条件）、代わりに
//    同じSVG座標系の上に浮動スプライトを重ねる。x/y/cx/cy等のSVG座標属性を
//    直接CSSトランジションさせるのはブラウザによって効かないことがあるため、
//    <g>でラップしてCSSの transform:translate() をトランジションさせる
//    （transformは各ブラウザで最も確実にアニメーションする）。
// ------------------------------------------------------------
const BB_MOVE_ANIM_MS = 380;
function bbAnimateUnitMove(unit, fromNodeId, toNodeId, onComplete) {
    const fromNode = bbNodesById[fromNodeId];
    const toNode = bbNodesById[toNodeId];
    if (!fromNode || !toNode || fromNodeId === toNodeId) { onComplete(); return; }
    // 盤面のパン・ズーム変形を一緒に受けるよう、浮動スプライトは#bbViewportGの中に追加する
    // （#bbBoardSvg直下に置くと変形が反映されず、パン・ズーム後にずれた位置へ移動してしまう）。
    const viewportG = document.getElementById('bbViewportG');
    const ns = 'http://www.w3.org/2000/svg';
    const r2 = BB_NODE_R - 4;

    unit._animating = true;
    bbRenderBoard();

    const clipId = `bbAnimClip${unit.uid}_${Date.now()}`;
    const defs = document.createElementNS(ns, 'defs');
    const clipPath = document.createElementNS(ns, 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipCircle = document.createElementNS(ns, 'circle');
    clipCircle.setAttribute('cx', fromNode.x);
    clipCircle.setAttribute('cy', fromNode.y);
    clipCircle.setAttribute('r', r2);
    clipPath.appendChild(clipCircle);
    defs.appendChild(clipPath);
    viewportG.appendChild(defs);

    const g = document.createElementNS(ns, 'g');
    g.style.transition = `transform ${BB_MOVE_ANIM_MS}ms ease`;
    g.style.transform = 'translate(0px, 0px)';

    const img = document.createElementNS(ns, 'image');
    img.setAttribute('href', bbGetCurryImg(unit.raw));
    img.setAttribute('x', fromNode.x - r2);
    img.setAttribute('y', fromNode.y - r2);
    img.setAttribute('width', r2 * 2);
    img.setAttribute('height', r2 * 2);
    img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    img.setAttribute('clip-path', `url(#${clipId})`);
    g.appendChild(img);
    viewportG.appendChild(g);

    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    // 初期状態（translate(0,0)）が実際に描画されてから動かさないとトランジションが
    // 発火しないため、強制リフロー＋1フレーム待ってから移動先へのtransformへ切り替える。
    requestAnimationFrame(() => {
        void g.getBoundingClientRect();
        requestAnimationFrame(() => {
            g.style.transform = `translate(${dx}px, ${dy}px)`;
        });
    });

    setTimeout(() => {
        if (viewportG.contains(g)) viewportG.removeChild(g);
        if (viewportG.contains(defs)) viewportG.removeChild(defs);
        unit._animating = false;
        onComplete();
    }, BB_MOVE_ANIM_MS + 60);
}

function bbMoveUnitTo(unit, nodeId) {
    const defender = bbState.units.find(u => u.nodeId === nodeId && u.hp > 0 && u.team !== unit.team);
    const fromNodeId = unit.nodeId;
    bbNodes.forEach(n => { n.highlight = null; });
    if (defender) {
        bbAppendLog(`${unit.name} が ${defender.name} に攻撃！`);
        // 攻撃側の駒を相手のマスまで滑らせ、重なった（ぶつかった）ところで戦闘画面へ切り替える
        bbAnimateUnitMove(unit, fromNodeId, nodeId, function () {
            bbResolveBattle(unit, defender, nodeId);
        });
    } else {
        bbAnimateUnitMove(unit, fromNodeId, nodeId, function () {
            unit.nodeId = nodeId;
            bbAppendLog(`${unit.name} が移動した。`);
            unit.delay = bbComputeDelay(unit.spd);
            bbRenderBoard();
            setTimeout(bbScheduleNextTurn, 500);
        });
    }
}

function bbPerformEnemyTurn(unit) {
    const moves = bbGetMovableNeighbors(unit);
    if (moves.length === 0) {
        bbAppendLog(`${unit.name}（敵）は動けずパス。`);
        unit.delay = bbComputeDelay(unit.spd);
        setTimeout(bbScheduleNextTurn, 400);
        return;
    }
    // AI：自陣の旗（プレイヤー旗）を奪うことを最優先に動く。攻撃はあくまで前進の結果でしかない。
    const flagNodeId = bbGetFlagNodeId('player');
    let chosen;
    if (moves.includes(flagNodeId)) {
        // 旗のマスへ直接進めるなら、それが最優先（そのターンで勝利）。
        chosen = flagNodeId;
    } else {
        const targetNode = bbNodesById[flagNodeId];
        let bestDist = Infinity;
        let bestMoves = [];
        moves.forEach(nid => {
            const d = bbDist(bbNodesById[nid], targetNode);
            if (d < bestDist - 0.01) { bestDist = d; bestMoves = [nid]; }
            else if (Math.abs(d - bestDist) <= 0.01) { bestMoves.push(nid); }
        });
        // 旗への距離が同着の場合のみ、進路を塞ぐ敵（プレイヤー）がいるマスを優先して排除する。
        const blockerMove = bestMoves.find(nid => bbState.units.some(u => u.nodeId === nid && u.hp > 0 && u.team !== unit.team));
        chosen = (blockerMove !== undefined) ? blockerMove : bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }
    bbMoveUnitTo(unit, chosen);
}
function bbDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// ------------------------------------------------------------
// 9. 戦闘解決 ＋ 戦闘画面
//    本編に追加したwindow.startExternalBoardBattle(...)を直接呼び出す。これにより
//    「PCと対戦」と全く同じ戦闘エンジン（launchVsCutIn→startBattleScene→step→done）が
//    そのまま動作し、特殊カレー技・演出・音まで含めて本物の戦闘画面が表示される。
//    このファイルは本編game.htmlと同じ実行環境（同じ<script>群のグローバルスコープ）で
//    動いているため、iframeや別ウィンドウを介する必要が一切なく、
//    startExternalBoardBattle/getCurryImage/curryStockなどを直接呼び出せる。
//    カレーストックの経済・報酬・実績・クエスト進行には本編側（done()の
//    isBoardBattle分岐）で一切触れないようにしてあるため、ボードカレーバトルの
//    駒は勝敗にかかわらず消費されない。
// ------------------------------------------------------------
function bbResolveBattle(mover, defender, targetNodeId) {
    const playerUnit = mover.team === 'player' ? mover : defender;
    const enemyUnit = mover.team === 'player' ? defender : mover;

    bbSetBattleStatus('戦闘画面を起動中…');
    const myCurrySnapshot = Object.assign({}, playerUnit.raw, { hp: playerUnit.hp });
    const oppCurrySnapshot = Object.assign({}, enemyUnit.raw, { hp: enemyUnit.hp, name: enemyUnit.name });

    if (typeof startExternalBoardBattle !== 'function') {
        console.error('[ボードバトル] startExternalBoardBattleが見つかりません（本編game.jsの反映が必要です）');
        bbSetBattleStatus('戦闘エンジンが見つかりません。game.jsの更新が必要です。');
        return;
    }

    // 本編の戦闘画面（vsCutIn/battleArena）はapplyBookBattleLift()により盤面（#bbRoot）より
    // 前面（z-index）へ持ち上がるので、#bbRoot自体は非表示にしない。代わりに#battleArenaへ
    // 半透明の専用背景クラスを付け、盤面が透けて見えるオーバーレイ表示にする
    // （通常のCSS z-index重なりだけで解決するため、表示/非表示の切り替えは不要）。
    const arenaEl = document.getElementById('battleArena');
    if (arenaEl) arenaEl.classList.add('bb-arena-overlay');
    // 戦闘カード（最大幅500px）の外側も含め、盤面に一切触れられないよう画面全体を覆う。
    const blockOverlayEl = document.getElementById('bbBattleBlockOverlay');
    if (blockOverlayEl) blockOverlayEl.style.display = 'block';

    startExternalBoardBattle(myCurrySnapshot, oppCurrySnapshot, function (didPlayerWin, remainingPlayerHp, remainingOppHp) {
        if (arenaEl) arenaEl.classList.remove('bb-arena-overlay');
        if (blockOverlayEl) blockOverlayEl.style.display = 'none';
        playerUnit.hp = remainingPlayerHp;
        enemyUnit.hp = remainingOppHp;
        const moverIsPlayer = (mover.team === 'player');
        const moverWon = moverIsPlayer ? didPlayerWin : !didPlayerWin;
        const winner = moverWon ? mover : defender;
        const loser = moverWon ? defender : mover;
        bbAppendLog(`${loser.name} は力尽きた。${winner.name} の勝ち（残HP ${winner.hp}/${winner.maxHp}）`);
        bbState.units = bbState.units.filter(u => u !== loser);
        // 勝った駒は、衝突アニメーションで既に見た目上そのマスへ来ているので、
        // ここでは位置を確定させるだけでよい（再度スライドさせる必要はない）。
        if (moverWon) mover.nodeId = targetNodeId;
        mover.delay = bbComputeDelay(mover.spd);
        bbRenderBoard();
        setTimeout(bbScheduleNextTurn, 500);
    });
}

function bbCheckWinCondition() {
    const playerUnits = bbState.units.filter(u => u.team === 'player' && u.hp > 0);
    const enemyUnits = bbState.units.filter(u => u.team === 'enemy' && u.hp > 0);
    if (enemyUnits.length === 0) return 'player';
    if (playerUnits.length === 0) return 'enemy';
    const playerOnEnemyFlag = playerUnits.some(u => u.nodeId === bbGetFlagNodeId('enemy'));
    if (playerOnEnemyFlag) return 'player';
    const enemyOnPlayerFlag = enemyUnits.some(u => u.nodeId === bbGetFlagNodeId('player'));
    if (enemyOnPlayerFlag) return 'enemy';
    return null;
}

function bbEndBattle(winner) {
    bbState.phase = 'result';
    bbState.activeUnit = null;
    document.getElementById('bbResultOverlay').style.display = 'flex';
    document.getElementById('bbResultTitle').textContent = winner === 'player' ? 'VICTORY' : 'DEFEAT';
    document.getElementById('bbResultDesc').textContent = winner === 'player' ? '敵の旗を奪う、または全滅させました！' : '自陣の旗を奪われる、または全滅しました…';
}

// ------------------------------------------------------------
// 10. ログ・ステータス表示
// ------------------------------------------------------------
function bbAppendLog(text) {
    bbState.battleLogLines.push(text);
    const el = document.getElementById('bbBattleLog');
    el.textContent = bbState.battleLogLines.slice(-30).join('\n');
    el.scrollTop = el.scrollHeight;
}
function bbSetBattleStatus(text) {
    const el = document.getElementById('bbBattleStatusLine');
    if (el) el.textContent = text;
}

// ------------------------------------------------------------
// 11. 開閉・入り口ボタン
// ------------------------------------------------------------
function bbOpen() {
    document.getElementById('bbRoot').style.display = 'flex';
    bbInit();
}
function bbClose() {
    document.getElementById('bbRoot').style.display = 'none';
}
function bbRestart() {
    document.getElementById('bbResultOverlay').style.display = 'none';
    bbInit();
}

// ------------------------------------------------------------
// 12. DOM注入（起動時に一度だけ実行。#pageTop等の状態には依存しない）
// ------------------------------------------------------------
function bbInjectDom() {
    const styleEl = document.createElement('style');
    styleEl.id = 'bbStyle';
    styleEl.textContent = BB_STYLE;
    document.head.appendChild(styleEl);

    const rootDiv = document.createElement('div');
    rootDiv.id = 'bbRoot';
    rootDiv.innerHTML = `
        <div id="bbAppRoot">
            <div id="bbBoardWrap">
                <svg id="bbBoardSvg" viewBox="0 0 600 900"><g id="bbViewportG"></g></svg>
            </div>
            <div id="bbTopOverlay">
                <div id="bbHeaderBar">
                    <h1>ボードカレーバトル</h1>
                    <div class="bb-header-right">
                        <span class="bb-devBadge">開発版</span>
                        <button class="bb-closeBtn" onclick="window.__bbClose()">✕ 閉じる</button>
                    </div>
                </div>
                <div id="bbTurnQueueBar"></div>
            </div>
            <div id="bbBottomPanel">
                <div id="bbPlacementPanel">
                    <h2>配置フェーズ（自陣の旗から2列以内・ステータス合計2500まで・最大5体）</h2>
                    <div id="bbBudgetLine">合計ステータス: 0 / 2500　配置数: 0 / 5</div>
                    <div id="bbPlaceHint">下のカレーをタップして選択 → 盤面の自陣側（青枠）マスをタップして配置します。</div>
                    <div id="bbRosterList"></div>
                    <button class="bb-actionBtn" id="bbBtnStartBattle" disabled onclick="window.__bbOnStartBattleClick()">戦闘開始</button>
                    <button class="bb-actionBtn bb-secondary" onclick="window.__bbOnRegenerateEnemyClick()">敵編成を再生成（デバッグ）</button>
                </div>
                <div id="bbBattlePanel" style="display:none;">
                    <h2 id="bbBattleStatusLine">戦闘中…</h2>
                    <div id="bbBattleLog"></div>
                </div>
            </div>
        </div>
        <div id="bbResultOverlay">
            <div id="bbResultBox">
                <h2 id="bbResultTitle">VICTORY</h2>
                <div id="bbResultDesc" style="font-size:13px; margin-bottom:16px;"></div>
                <button class="bb-actionBtn" onclick="window.__bbRestart()">もう一度</button>
                <button class="bb-actionBtn bb-secondary" onclick="window.__bbClose()">閉じる</button>
            </div>
        </div>
        <div id="bbBattleBlockOverlay"></div>
    `;
    document.body.appendChild(rootDiv);

    // 盤面のパン・ズーム操作の配線（マウスのドラッグ・ホイールと、指1本でのパン・
    // 指2本でのピンチズームをPointer Eventsで統一的に扱う）。
    const bbWrapEl = document.getElementById('bbBoardWrap');
    bbWrapEl.addEventListener('pointerdown', bbOnPointerDown);
    bbWrapEl.addEventListener('pointermove', bbOnPointerMove);
    bbWrapEl.addEventListener('pointerup', bbOnPointerUpOrCancel);
    bbWrapEl.addEventListener('pointercancel', bbOnPointerUpOrCancel);
    bbWrapEl.addEventListener('pointerleave', bbOnPointerUpOrCancel);
    bbWrapEl.addEventListener('wheel', bbOnWheel, { passive: false });
    bbWrapEl.addEventListener('click', bbOnBoardClickCapture, true);
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('resize', function () {
            if (document.getElementById('bbRoot').style.display !== 'none') bbFitView();
        });
    }

    const launcherBtn = document.createElement('button');
    launcherBtn.id = 'bbLauncherBtn';
    launcherBtn.textContent = '🎲 ボードバトル（開発中）';
    launcherBtn.onclick = bbOpen;
    document.body.appendChild(launcherBtn);

    // 本人のデバッグモードが有効な間だけ入り口ボタンを表示する（フェスデバッグパネルと同じ判定方法）。
    // isDebugModeはgame.js側の読み込み・Firebase同期タイミングに依存するため、ポーリングで反映する。
    setInterval(function () {
        const shouldShow = (typeof isDebugMode !== 'undefined' && !!isDebugMode);
        launcherBtn.style.display = shouldShow ? 'flex' : 'none';
    }, 1000);
}

// インラインonclick属性から呼べるよう、必要な関数だけを明示的にwindowへ公開する
// （このファイル全体はIIFEで閉じているため、windowへ代入しない限りグローバルには出ない）。
window.__bbOnNodeClick = bbOnNodeClick;
window.__bbOnPickPoolCurry = bbOnPickPoolCurry;
window.__bbOnStartBattleClick = bbOnStartBattleClick;
window.__bbOnRegenerateEnemyClick = bbOnRegenerateEnemyClick;
window.__bbClose = bbClose;
window.__bbRestart = bbRestart;
window.openBoardBattle = bbOpen; // 将来、他の場所（正式な入り口ボタン等）から開けるように

bbInjectDom();

})();
