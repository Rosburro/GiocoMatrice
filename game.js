

/* ═══════════════════════════════════════════════════════════════
   GATTI NELLA MATRICE - Logica di gioco
   ═══════════════════════════════════════════════════════════════
   
   Struttura:
   1. Palette colori
   2. Stato del gioco
   3. Generazione griglia (regioni connesse)
   4. Risolutore (solve)
   5. Interazione utente (click, doppio click, drag)
   6. Verifica soluzione
   7. Gestione livelli e persistenza
   8. Inizializzazione
   ═══════════════════════════════════════════════════════════════ */


// ─────────────────────────────────────────────────────────────────
// 1. PALETTE COLORI (40 colori piacevoli e distinti)
// ─────────────────────────────────────────────────────────────────
// Ogni colore è un codice esadecimale.
// I colori sono stati scelti per essere visivamente distinti
// e gradevoli su sfondo scuro.
// ─────────────────────────────────────────────────────────────────

const PALETTE_COLORI = [
    "#E63946", // Rosso acceso
    "#F4A261", // Arancione caldo
    "#E9C46A", // Giallo dorato
    "#2A9D8F", // Verde acqua
    "#264653", // Blu notte
    "#6A4C93", // Viola
    "#1982C4", // Blu medio
    "#8AC926", // Verde lime
    "#FFCA3A", // Giallo brillante
    "#FF595E", // Rosso corallo
    "#6A0572", // Viola scuro
    "#48CAE4", // Blu cielo
    "#00A878", // Verde smeraldo
    "#F72585", // Rosa acceso
    "#7209B7", // Viola reale
    "#3A0CA3", // Blu profondo
    "#4CC9F0", // Azzurro chiaro
    "#F77F00", // Arancione scuro
    "#D62828", // Rosso rubino
    "#FCBF49", // Ambra
    "#EAE2B7", // Beige
    "#003049", // Blu navy
    "#588157", // Verde oliva
    "#3A5A40", // Verde bosco
    "#BC6C25", // Marrone terra
    "#256D85", // Blu petrolio
    "#7B2CBF", // Viola elettrico
    "#C77DFF", // Lavanda
    "#FF99C8", // Rosa pastello
    "#9BF6FF", // Ciano chiaro
    "#CAFFBF", // Verde menta
    "#FFCFD2", // Rosa confetto
    "#BDB2FF", // Lilla
    "#FFC6FF", // Magenta chiaro
    "#A0C4FF", // Azzurro polvere
    "#FDFFB6", // Giallo crema
    "#FFD6A5", // Pesca
    "#B9FBC0", // Verde chiaro
    "#80DEEA", // Turchese
    "#FF6B6B", // Rosso salmone
];


// ─────────────────────────────────────────────────────────────────
// 2. STATO DEL GIOCO
// ─────────────────────────────────────────────────────────────────
const stato = {
    difficolta: null,
    livello: 0,
    n: 0,
    griglia: [],
    soluzione: null,
    celleCorrette: new Set(),
    celleErrate: new Set(),
    celleMarcate: new Set(),
    dragAttivo: false,
    ultimoClick: null,
    cooldownCelle: new Map(),  // ← AGGIUNGI QUESTA RIGA: Map<"r,c", timestamp>
};

// Costante per il doppio click
const SOGLIA_DOPPIO_CLICK = 1500; // millisecondi


// ─────────────────────────────────────────────────────────────────
// 3. GENERAZIONE GRIGLIA CON REGIONI CONNESSE
// ─────────────────────────────────────────────────────────────────
// VINCOLO: tutte le celle dello stesso colore devono formare
// una regione connessa (adiacenti orizzontalmente o verticalmente).
// Una regione di una sola cella è valida (è connessa per definizione),
// ma quel colore non deve apparire altrove.
//
// ALGORITMO: Region Growing (crescita casuale delle regioni)
// 1. Piazza n "semi" (uno per colore) in celle casuali non adiacenti
// 2. Ad ogni passo, pesca una regione a caso tra quelle che possono
//    espandersi e la espande di una cella adiacente non assegnata
// 3. Ripeti finché tutte le celle sono assegnate
// Questo garantisce la connettività di ogni regione.
// ─────────────────────────────────────────────────────────────────

/**
 * Calcola la dimensione della griglia in base alla difficoltà.
 * Livello L → n = random(L, L+2)
 * @param {number} difficolta - Livello di difficoltà (4-30)
 * @returns {number} Dimensione n della griglia n×n
 */
function calcolaDimensione(difficolta) {
    const min = difficolta;
    const max = difficolta + 2;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pesca un sottoinsieme casuale di colori dalla palette.
 * @param {number} quantita - Numero di colori da pescare
 * @returns {string[]} Array di codici colore hex
 */
function pescaColori(quantita) {
    // Shuffle della palette (Fisher-Yates)
    const shuffled = [...PALETTE_COLORI];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, quantita);
}

/**
 * Verifica se una posizione è adiacente (4-direzioni) a una data cella.
 * @param {number} r1 - Riga 1
 * @param {number} c1 - Colonna 1
 * @param {number} r2 - Riga 2
 * @param {number} c2 - Colonna 2
 * @returns {boolean} True se adiacenti
 */
function sonoAdiacenti(r1, c1, r2, c2) {
    return (Math.abs(r1 - r2) + Math.abs(c1 - c2)) === 1;
}

/**
 * Ottiene le celle adiacenti (4-direzioni) a una posizione data.
 * @param {number} r - Riga
 * @param {number} c - Colonna
 * @param {number} n - Dimensione griglia
 * @returns {Array<[number, number]>} Array di [riga, colonna]
 */
function celleAdiacenti(r, c, n) {
    const adiacenti = [];
    if (r > 0) adiacenti.push([r - 1, c]);       // Sopra
    if (r < n - 1) adiacenti.push([r + 1, c]);   // Sotto
    if (c > 0) adiacenti.push([r, c - 1]);       // Sinistra
    if (c < n - 1) adiacenti.push([r, c + 1]);   // Destra
    return adiacenti;
}

/**
 * Piazza i semi (celle iniziali) per le regioni.
 * I semi non devono essere adiacenti tra loro per evitare
 * che una regione ne "inghiotta" un'altra troppo presto.
 * 
 * @param {number} n - Dimensione griglia
 * @param {number} numColori - Numero di regioni/semi da piazzare
 * @returns {Array<[number, number]>|null} Array di posizioni [r,c] oppure null se fallito
 */
function piazzaSemi(n, numColori) {
    const semi = [];
    const occupate = new Set();
    const maxTentativi = 200;

    for (let i = 0; i < numColori; i++) {
        let trovato = false;

        for (let tent = 0; tent < maxTentativi; tent++) {
            const r = Math.floor(Math.random() * n);
            const c = Math.floor(Math.random() * n);
            const chiave = `$${r},$${c}`;

            // La cella deve essere libera
            if (occupate.has(chiave)) continue;

            // Non deve essere adiacente ad un altro seme
            let adiacenteAAltro = false;
            for (const [sr, sc] of semi) {
                if (sonoAdiacenti(r, c, sr, sc)) {
                    adiacenteAAltro = true;
                    break;
                }
            }
            if (adiacenteAAltro) continue;

            // Posizione valida
            semi.push([r, c]);
            occupate.add(chiave);
            trovato = true;
            break;
        }

        if (!trovato) return null; // Non è possibile piazzare tutti i semi
    }

    return semi;
}

/**
 * Genera una griglia n×n con regioni connesse usando Region Growing.
 * 
 * ALGORITMO:
 * 1. Piazza n semi (uno per colore) in posizioni non adiacenti
 * 2. Mantiene una "frontiera" per ogni regione (celle libere adiacenti alla regione)
 * 3. Ad ogni passo:
 *    - Pesca una regione a caso tra quelle con frontiera non vuota
 *    - Espande quella regione di una cella dalla sua frontiera
 *    - Aggiorna le frontiere
 * 4. Se una regione non ha più celle adiacenti libere, viene "congelata"
 * 5. Se rimangono celle non assegnate e nessuna regione può espandersi,
 *    assegna le celle residue alla regione adiacente più piccola
 * 
 * @param {number} n - Dimensione griglia
 * @param {number} numColori - Numero di colori/regioni
 * @returns {string[][]|null} Matrice 2D di colori oppure null se fallito
 */
function generaGrigliaRegioniConnesse(n, numColori) {
    const colori = pescaColori(numColori);

    // ─── Step 1: Piazza i semi ───
    const semi = piazzaSemi(n, numColori);
    if (!semi) return null; // Impossibile piazzare i semi (griglia troppo piccola)

    // ─── Step 2: Inizializza strutture dati ───
    // griglia[i][j] = indice del colore (0..numColori-1) oppure -1 se non assegnata
    const griglia = Array.from({ length: n }, () => Array(n).fill(-1));

    // frontiere[k] = array di celle [r,c] adiacenti alla regione k, non ancora assegnate
    const frontiere = [];

    // Assegna i semi
    for (let k = 0; k < numColori; k++) {
        const [r, c] = semi[k];
        griglia[r][c] = k;
        frontiere[k] = [];
    }

    // ─── Step 3: Calcola frontiere iniziali ───
    function aggiornaFrontiere() {
        for (let k = 0; k < numColori; k++) {
            frontiere[k] = [];
        }
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (griglia[i][j] !== -1) continue; // Cella già assegnata
                // Controlla se ha un vicino assegnato
                const adiacenti = celleAdiacenti(i, j, n);
                for (const [ar, ac] of adiacenti) {
                    if (griglia[ar][ac] !== -1) {
                        frontiere[griglia[ar][ac]].push([i, j]);
                        break; // Basta un vicino per essere in frontiera
                    }
                }
            }
        }
    }

    aggiornaFrontiere();

    // ─── Step 4: Region Growing ───
    let celleAssegnate = numColori; // I semi sono già assegnati
    const totaleCelle = n * n;
    let stalli = 0; // Contatore stalli per evitare loop infiniti

    while (celleAssegnate < totaleCelle) {
        // Trova regioni con frontiera disponibile
        const regioniAttive = [];
        for (let k = 0; k < numColori; k++) {
            // Filtra frontiere: rimuovi celle già assegnate nel frattempo
            frontiere[k] = frontiere[k].filter(([r, c]) => griglia[r][c] === -1);
            if (frontiere[k].length > 0) {
                regioniAttive.push(k);
            }
        }

        if (regioniAttive.length === 0) {
            // Nessuna regione può espandersi: assegna le celle residue
            // alle regioni adiacenti (dovrebbero essere "isole" circondate)
            let assegnate = false;
            for (let i = 0; i < n && !assegnate; i++) {
                for (let j = 0; j < n && !assegnate; j++) {
                    if (griglia[i][j] !== -1) continue;
                    // Trova un vicino assegnato
                    const adiacenti = celleAdiacenti(i, j, n);
                    for (const [ar, ac] of adiacenti) {
                        if (griglia[ar][ac] !== -1) {
                            griglia[i][j] = griglia[ar][ac];
                            celleAssegnate++;
                            assegnate = true;
                            break;
                        }
                    }
                }
            }
            if (!assegnate) {
                stalli++;
                if (stalli > 100) break; // Sicurezza anti-loop
            }
            continue;
        }

        stalli = 0;

        // Pesca una regione a caso tra quelle attive
        // (con leggera preferenza per le regioni più piccole per equilibrio)
        const k = regioniAttive[Math.floor(Math.random() * regioniAttive.length)];

        // Pesca una cella dalla frontiera di quella regione
        const idx = Math.floor(Math.random() * frontiere[k].length);
        const [r, c] = frontiere[k][idx];

        // Assegna la cella alla regione
        if (griglia[r][c] === -1) {
            griglia[r][c] = k;
            celleAssegnate++;
        }

        // Ricicla la frontiera della regione k (rimuovi celle ora assegnate)
        frontiere[k] = frontiere[k].filter(([fr, fc]) => griglia[fr][fc] === -1);
    }

    // ─── Step 5: Verifica connettività ───
    // Ogni regione deve essere connessa (garantito dall'algoritmo,
    // ma verifichiamo per sicurezza)
    if (!verificaConnettivita(griglia, n, numColori)) {
        return null;
    }

    // ─── Step 6: Converti indici in colori esadecimali ───
    const grigliaColori = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => colori[griglia[i][j]])
    );

    return grigliaColori;
}

/**
 * Verifica che ogni regione di colore sia connessa (4-direzioni).
 * Usa BFS per controllare che tutte le celle di un colore siano raggiungibili
 * partendo da una qualsiasi di esse.
 * 
 * @param {number[][]} griglia - Matrice 2D con indici di colore
 * @param {number} n - Dimensione griglia
 * @param {number} numColori - Numero di colori
 * @returns {boolean} True se tutte le regioni sono connesse
 */
function verificaConnettivita(griglia, n, numColori) {
    for (let k = 0; k < numColori; k++) {
        // Trova tutte le celle con questo colore
        const celle = [];
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++)
                if (griglia[i][j] === k) celle.push([i, j]);

        if (celle.length <= 1) continue; // 0 o 1 cella: connessa per definizione

        // BFS dalla prima cella
        const visitate = new Set();
        const coda = [celle[0]];
        visitate.add(`$${celle[0][0]},$${celle[0][1]}`);

        while (coda.length > 0) {
            const [r, c] = coda.shift();
            const adiacenti = celleAdiacenti(r, c, n);
            for (const [ar, ac] of adiacenti) {
                const chiave = `$${ar},$${ac}`;
                if (visitate.has(chiave)) continue;
                if (griglia[ar][ac] !== k) continue;
                visitate.add(chiave);
                coda.push([ar, ac]);
            }
        }

        // Se non tutte le celle del colore sono state raggiunte → non connessa
        if (visitate.size !== celle.length) return false;
    }
    return true;
}

/**
 * Genera una griglia completa con soluzione garantita.
 * Combina la generazione a regioni connesse con il solver.
 * Se il solver non trova soluzione, rigenera.
 * 
 * @param {number} n - Dimensione griglia
 * @param {number} numColori - Numero di colori (= n)
 * @returns {object} { griglia, soluzione }
 */
function generaGrigliaConSoluzione(n, numColori) {
    let tentativi = 0;
    const maxTentativi = 1000; // Più tentativi perché la generazione a regioni
                                // connesse può produrre griglie senza soluzione

    while (tentativi < maxTentativi) {
        tentativi++;

        // Genera griglia con regioni connesse
        const griglia = generaGrigliaRegioniConnesse(n, numColori);
        if (!griglia) continue; // Se la generazione fallisce, riprova

        // Verifica che il solver trovi una soluzione
        const soluzione = solve(griglia);
        if (soluzione) {
            return { griglia, soluzione };
        }
    }

    // ─── FALLBACK: generazione strutturata ───
    // Se dopo molti tentativi non si trova una griglia risolvibile,
    // costruiamo una griglia "ad hoc" che garantisce la soluzione
    // e poi la "mescoliamo" mantenendo la connettività.
    return generaGrigliaFallback(n, numColori);
}

/**
 * Fallback: genera una griglia con regioni connesse E soluzione garantita.
 * Strategia:
 * 1. Trova prima una configurazione valida di gatti (posizioni non adiacenti,
 *    una per riga e colonna)
 * 2. Assegna un colore diverso a ogni gatto
 * 3. Espandi le regioni a partire dalle celle dei gatti (region growing)
 * 4. Verifica che il solver confermi la soluzione
 * 
 * @param {number} n - Dimensione griglia
 * @param {number} numColori - Numero di colori
 * @returns {object} { griglia, soluzione }
 */
function generaGrigliaFallback(n, numColori) {
    const colori = pescaColori(numColori);

    // ─── Step 1: Trova una configurazione valida di gatti ───
    // Backtracking per piazzare n gatti: uno per riga, uno per colonna,
    // nessuno adiacente (8 direzioni)
    let configurazioneTrovata = false;
    let posizioniGatti = []; // [{r, c}, ...]
    const righeUsate = new Set();
    const colUsate = new Set();

    function posizionaGatti(indice) {
        if (indice === numColori) {
            configurazioneTrovata = true;
            return true;
        }

        // Genera candidate per la riga 'indice' in ordine casuale
        const riga = indice; // Un gatto per riga
        const candidate = [];
        for (let c = 0; c < n; c++) {
            if (colUsate.has(c)) continue;

            // Controlla adiacenza con gatti già piazzati (8 direzioni)
            let ok = true;
            for (const pos of posizioniGatti) {
                if (Math.abs(riga - pos.r) <= 1 && Math.abs(c - pos.c) <= 1) {
                    ok = false;
                    break;
                }
            }
            if (ok) candidate.push(c);
        }

        // Shuffle per casualità
        for (let i = candidate.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
        }

        for (const c of candidate) {
            posizioniGatti.push({ r: riga, c });
            colUsate.add(c);

            if (posizionaGatti(indice + 1)) return true;

            // Backtrack
            posizioniGatti.pop();
            colUsate.delete(c);
        }
        return false;
    }

    posizionaGatti(0);

    if (!configurazioneTrovata) {
        // Caso estremo: griglia troppo piccola per soluzione valida
        // Restituisci una griglia vuota (non dovrebbe mai succedere con n >= 4)
        const griglia = Array.from({ length: n }, () => Array(n).fill(colori[0]));
        return { griglia, soluzione: null };
    }

    // ─── Step 2: Crea griglia con regioni connesse a partire dai gatti ───
    // Ogni gatto è il "seme" della propria regione
    const griglia = Array.from({ length: n }, () => Array(n).fill(-1));

    // Piazza i gatti come semi
    for (let k = 0; k < numColori; k++) {
        griglia[posizioniGatti[k].r][posizioniGatti[k].c] = k;
    }

    // ─── Step 3: Region Growing dai semi ───
    // Usa la stessa logica di generaGrigliaRegioniConnesse
    const frontiere = [];
    for (let k = 0; k < numColori; k++) {
        frontiere[k] = [];
    }

    // Calcola frontiere iniziali
    function ricalcolaFrontiere() {
        for (let k = 0; k < numColori; k++) {
            frontiere[k] = [];
        }
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (griglia[i][j] !== -1) continue;
                const adiacenti = celleAdiacenti(i, j, n);
                for (const [ar, ac] of adiacenti) {
                    if (griglia[ar][ac] !== -1) {
                        frontiere[griglia[ar][ac]].push([i, j]);
                        break;
                    }
                }
            }
        }
    }

    ricalcolaFrontiere();

    let celleAssegnate = numColori;
    const totaleCelle = n * n;

    while (celleAssegnate < totaleCelle) {
        // Rimuovi celle già assegnate dalle frontiere
        for (let k = 0; k < numColori; k++) {
            frontiere[k] = frontiere[k].filter(([r, c]) => griglia[r][c] === -1);
        }

        const regioniAttive = [];
        for (let k = 0; k < numColori; k++) {
            if (frontiere[k].length > 0) regioniAttive.push(k);
        }

        if (regioniAttive.length === 0) {
            // Assegna celle residue a regioni adiacenti
            let assegnata = false;
            for (let i = 0; i < n && !assegnata; i++) {
                for (let j = 0; j < n && !assegnata; j++) {
                    if (griglia[i][j] !== -1) continue;
                    const adiacenti = celleAdiacenti(i, j, n);
                    for (const [ar, ac] of adiacenti) {
                        if (griglia[ar][ac] !== -1) {
                            griglia[i][j] = griglia[ar][ac];
                            celleAssegnate++;
                            assegnata = true;
                            break;
                        }
                    }
                }
            }
            if (!assegnata) break; // Anti-loop
            continue;
        }

        // Pesca regione a caso
        const k = regioniAttive[Math.floor(Math.random() * regioniAttive.length)];
        const idx = Math.floor(Math.random() * frontiere[k].length);
        const [r, c] = frontiere[k][idx];

        if (griglia[r][c] === -1) {
            griglia[r][c] = k;
            celleAssegnate++;
        }
    }

    // ─── Step 4: Converti indici in colori hex ───
    const grigliaColori = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => colori[griglia[i][j]])
    );

    // ─── Step 5: Verifica che il solver confermi la soluzione ───
    const soluzioneVerificata = solve(grigliaColori);

    if (soluzioneVerificata) {
        return { griglia: grigliaColori, soluzione: soluzioneVerificata };
    }

    // Se il solver non conferma, restituisci comunque la configurazione
    // dei gatti come soluzione (potrebbe esserci più di una soluzione,
    // ma la nostra è valida)
    const soluzione = posizioniGatti.map((pos, idx) => ({
        colore: colori[idx],
        r: pos.r,
        c: pos.c
    }));

    return { griglia: grigliaColori, soluzione };
}


// ─────────────────────────────────────────────────────────────────
// 4. RISOLUTORE (solve) - Algoritmo di backtracking con MRV
// ─────────────────────────────────────────────────────────────────

/**
 * Risolve la matrice trovando la posizione dei gatti.
 * Vincoli:
 * - Un gatto per colore
 * - Un gatto per riga e colonna
 * - Nessun gatto adiacente (8 direzioni)
 * 
 * Usa backtracking con MRV (Minimum Remaining Values) heuristic
 * e constraint propagation (riduzione domini).
 * 
 * @param {string[][]} mappa - Matrice 2D di colori (stringhe hex)
 * @returns {Array|null} Array di {colore, r, c} oppure null se nessuna soluzione
 */
function solve(mappa) {
    const n = mappa.length;
    const colori = [...new Set(mappa.flat().filter(c => c !== "-1" && c !== ""))];

    // Per ogni colore, raccogli tutte le posizioni possibili
    let domini = new Map();
    for (const colore of colori) {
        let pos = [];
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++)
                if (mappa[i][j] === colore) pos.push([i, j]);
        domini.set(colore, pos);
    }

    // Verifica che una soluzione sia ancora possibile
    function coerente(soluzioni) {
        const righeUsate = new Set();
        const colUsate = new Set();
        for (const [r, c] of soluzioni.values()) {
            if (righeUsate.has(r) || colUsate.has(c)) return false;
            righeUsate.add(r);
            colUsate.add(c);
        }
        // Controllo adiacenza (8 direzioni) tra tutte le coppie
        const arr = [...soluzioni.values()];
        for (let a = 0; a < arr.length; a++)
            for (let b = a + 1; b < arr.length; b++) {
                if (Math.abs(arr[a][0] - arr[b][0]) <= 1 &&
                    Math.abs(arr[a][1] - arr[b][1]) <= 1) return false;
            }
        return true;
    }

    // Riduci i domini in base alle soluzioni già assegnate
    function riduciDomini(domini, soluzioni) {
        let nuovo = new Map();
        for (const [colore, pos] of domini) {
            if (soluzioni.has(colore)) { nuovo.set(colore, [soluzioni.get(colore)]); continue; }
            let filtrate = pos.filter(([r, c]) => {
                for (const [r2, c2] of soluzioni.values()) {
                    if (r === r2 || c === c2) return false; // stessa riga/colonna
                    if (Math.abs(r - r2) <= 1 && Math.abs(c - c2) <= 1) return false; // adiacenza
                }
                return true;
            });
            nuovo.set(colore, filtrate);
        }
        return nuovo;
    }

    // Backtracking con MRV
    function backtrack(domini, soluzioni) {
        if (soluzioni.size === colori.length) return soluzioni;

        // Scegli il colore con dominio più piccolo (MRV heuristic)
        let coloreScelto = null, minLen = Infinity;
        for (const [colore, pos] of domini) {
            if (soluzioni.has(colore)) continue;
            if (pos.length === 0) return null; // dead end
            if (pos.length < minLen) { minLen = pos.length; coloreScelto = colore; }
        }

        for (const [r, c] of domini.get(coloreScelto)) {
            let nuoveSoluzioni = new Map(soluzioni);
            nuoveSoluzioni.set(coloreScelto, [r, c]);

            if (!coerente(nuoveSoluzioni)) continue;

            let nuoviDomini = riduciDomini(domini, nuoveSoluzioni);
            let risultato = backtrack(nuoviDomini, nuoveSoluzioni);
            if (risultato) return risultato;
        }
        return null; // backtrack
    }

    let soluzione = backtrack(domini, new Map());

    // Restituisci come array di {colore, r, c}
    if (!soluzione) return null;
    return [...soluzione.entries()].map(([colore, [r, c]]) => ({ colore, r, c }));
}

/**
 * Estrae la matrice di colori dalla tabella HTML.
 * @returns {string[][]} Matrice 2D con codici colore
 */
function creaMatrice() {
    let mappa = [];
    let tr = document.getElementById("matriceGioco").getElementsByTagName("tr");
    for (let i = 0; i < tr.length; i++) {
        let app = tr[i].getElementsByTagName("td");
        mappa.push([]);
        for (let j = 0; j < tr.length; j++) {
            mappa[i].push(app[j].style.backgroundColor);
        }
    }
    return mappa;
}

/**
 * Calcola la soluzione dalla tabella corrente.
 * @returns {Array} Array di [x, y] (colonna, riga)
 */
function calcolaRisultato() {
    let mappa = creaMatrice();
    let soluzione = solve(mappa);
    if (!soluzione) { console.log("Nessuna soluzione"); return []; }
    return soluzione.map(s => [s.c, s.r]); // [x, y]
}


// ─────────────────────────────────────────────────────────────────
// 5. RENDERING DELLA TABELLA
// ─────────────────────────────────────────────────────────────────
/**
 * Disegna la tabella HTML a partire dalla griglia di colori.
 * @param {string[][]} griglia - Matrice 2D di colori
 */
function disegnaTabella(griglia) {
    const tabella = document.getElementById("matriceGioco");
    tabella.innerHTML = ""; // Pulisci tabella esistente

    for (let i = 0; i < griglia.length; i++) {
        const tr = document.createElement("tr");

        for (let j = 0; j < griglia[i].length; j++) {
            const td = document.createElement("td");
            td.style.backgroundColor = griglia[i][j];
            td.dataset.riga = i;
            td.dataset.colonna = j;
            td.dataset.colore = griglia[i][j];
            td.textContent = ""; // Inizialmente vuota

            tr.appendChild(td);
        }

        tabella.appendChild(tr);
    }

    // Aggiungi classe per griglie grandi (celle più piccole)
    const contenitore = document.getElementById("schermata-gioco");
    if (griglia.length > 12) {
        contenitore.classList.add("griglia-grande");
    } else {
        contenitore.classList.remove("griglia-grande");
    }
}



// ─────────────────────────────────────────────────────────────────
// 6. INTERAZIONE UTENTE (Click, Doppio Click, Drag)
// ─────────────────────────────────────────────────────────────────

/**
 * Gestisce il click/tap su una cella.
 * Logica:
 * - Primo click: piazza "x" bianca
 * - Secondo click entro 1.5s sulla STESSA cella: tenta il gatto
 * - Secondo click dopo 1.5s sulla STESSA cella: rimuove "x"
 * 
 * @param {number} r - Riga
 * @param {number} c - Colonna
 * @param {HTMLElement} cell - Elemento TD cliccato
 */
function gestisciClick(r, c, cell) {
    const chiave = `$${r},$${c}`;
    const ora = Date.now();

    // Controlla se è un doppio click sulla stessa cella
    if (stato.ultimoClick &&
        stato.ultimoClick.r === r &&
        stato.ultimoClick.c === c &&
        (ora - stato.ultimoClick.timestamp) <= SOGLIA_DOPPIO_CLICK) {

        // DOPPIO CLICK: tenta di piazzare il gatto
        tentaGatto(r, c, cell);
        stato.ultimoClick = null; // Reset
        return;
    }

    // Singolo click: piazza o rimuovi "x"
    if (stato.celleCorrette.has(chiave)) return; // Non toccare celle già corrette
    if (stato.celleErrate.has(chiave)) return;   // Non toccare celle errate

    if (stato.celleMarcate.has(chiave)) {
        // Rimuovi "x"
        stato.celleMarcate.delete(chiave);
        cell.textContent = "";
    } else {
        // Piazza "x"
        stato.celleMarcate.add(chiave);
        cell.textContent = "✕";
        cell.style.color = "white";
    }

    // Salva timestamp per eventuale doppio click
    stato.ultimoClick = { r, c, timestamp: ora };
}

/**
 * Tenta di piazzare un gatto nella cella specificata.
 * Se corretto: mostra "o" bianca.
 * Se errato: mostra "✕" rossa.
 * @param {number} r - Riga
 * @param {number} c - Colonna
 * @param {HTMLElement} cell - Elemento TD
 */
function tentaGatto(r, c, cell) {
    const chiave = `$${r},$${c}`;
    const coloreCella = cell.dataset.colore;

    // Cerca se nella soluzione c'è un gatto in questa posizione con questo colore
    const gattoCorretto = stato.soluzione.find(
        s => s.r === r && s.c === c && s.colore === coloreCella
    );

    if (gattoCorretto) {
        // ✅ CORRETTO: piazza "o" bianca
        stato.celleCorrette.add(chiave);
        stato.celleMarcate.delete(chiave);
        stato.celleErrate.delete(chiave);
        cell.textContent = "●";
        cell.style.color = "white";
        cell.classList.add("corretto");
        cell.classList.remove("errore");

        // Rimuovi animazione dopo completamento
        setTimeout(() => cell.classList.remove("corretto"), 300);
    } else {
        // ❌ ERRATO: piazza "✕" rossa
        stato.celleErrate.add(chiave);
        stato.celleMarcate.delete(chiave);
        cell.textContent = "✕";
        cell.style.color = "#ef4444"; // Rosso
        cell.classList.add("errore");

        // Rimuovi animazione shake dopo completamento
        setTimeout(() => cell.classList.remove("errore"), 400);
    }

    // Controlla se il gioco è completo
    controllaVittoria();
}
/**
 * Gestisce il drag (mantieni premuto e scorri).
 * Piazza "x" bianca sulle celle attraversate, rimuove se già presente.
 * 
 * COOLDOWN: dopo ogni modifica su una cella, quella cella non può essere
 * modificata di nuovo per 500ms. Questo evita che i molteplici eventi
 * pointermove sulla stessa cella causino alternanza rapida "x"/"".
 * 
 * @param {number} r - Riga
 * @param {number} c - Colonna
 * @param {HTMLElement} cell - Elemento TD
 */
function gestisciDrag(r, c, cell) {
    const chiave = `${r},${c}`;
    const ora = Date.now();

    // Non modificare celle corrette o errate
    if (stato.celleCorrette.has(chiave)) return;
    if (stato.celleErrate.has(chiave)) return;

    // ─── COOLDOWN: verifica se è passato abbastanza tempo ───
    // Se l'ultima modifica su questa cella è avvenuta meno di 500ms fa,
    // ignora questa chiamata (la cella è in "raffreddamento")
    const ultimoCambio = stato.cooldownCelle.get(chiave) || 0;
    if (ora - ultimoCambio < 500) return;

    // Applica il cambio
    if (stato.celleMarcate.has(chiave)) {
        // Rimuovi "x"
        stato.celleMarcate.delete(chiave);
        cell.textContent = "";
    } else {
        // Piazza "x"
        stato.celleMarcate.add(chiave);
        cell.textContent = "✕";
        cell.style.color = "white";
    }

    // Registra il timestamp di questa modifica per il cooldown
    stato.cooldownCelle.set(chiave, ora);
}

/**
 * Inizializza tutti gli event listener per le interazioni.
 * Usa event delegation sulla tabella per performance.
 */
function inizializzaInterazioni() {
    const tabella = document.getElementById("matriceGioco");

    // Variabile per tracciare se durante il drag ci siamo spostati
    // su celle diverse da quella iniziale (per distinguere click da drag)
    let dragCellaIniziale = null;
    let dragSpostato = false;

    // --- Pointer Events (funzionano per mouse e touch) ---

    tabella.addEventListener("pointerdown", (e) => {
        const cell = e.target.closest("td");
        if (!cell) return;

        e.preventDefault(); // Previene scroll e selezione

        const r = parseInt(cell.dataset.riga);
        const c = parseInt(cell.dataset.colonna);

        // NON azzerare stato.ultimoClick qui!
        // Serve per il rilevamento del doppio click.
        // Viene gestito internamente in gestisciClick.

        stato.dragAttivo = true;
        dragCellaIniziale = { r, c };
        dragSpostato = false;

        // Gestisci come click (piazza x o rileva doppio click)
        gestisciClick(r, c, cell);
    });

    tabella.addEventListener("pointermove", (e) => {
        if (!stato.dragAttivo) return;

        const cell = e.target.closest("td");
        if (!cell) return;

        const r = parseInt(cell.dataset.riga);
        const c = parseInt(cell.dataset.colonna);

        // Se ci siamo spostati su una cella diversa da quella iniziale,
        // è un drag (non un doppio click)
        if (dragCellaIniziale && (r !== dragCellaIniziale.r || c !== dragCellaIniziale.c)) {
            dragSpostato = true;
        }

        // Solo se effettivamente ci siamo spostati, applica il drag
        if (dragSpostato) {
            gestisciDrag(r, c, cell);
        }
    });
    tabella.addEventListener("pointerup", () => {
        stato.dragAttivo = false;
        dragCellaIniziale = null;
        dragSpostato = false;
    });

    tabella.addEventListener("pointerleave", () => {
        stato.dragAttivo = false;
        dragCellaIniziale = null;
        dragSpostato = false;
    });

    // Impedisce il menu contestuale su long press (mobile)
    tabella.addEventListener("contextmenu", (e) => {
        e.preventDefault();
    });
}

// ─────────────────────────────────────────────────────────────────
// 7. VERIFICA SOLUZIONE E VITTORIA
// ─────────────────────────────────────────────────────────────────

/**
 * Verifica se il giocatore ha trovato la soluzione completa.
 * Il gioco è vinto quando tutti i gatti sono piazzati correttamente.
 */
function controllaVittoria() {
    if (!stato.soluzione) return;

    // Conta quanti gatti corretti sono stati piazzati
    const numCorretti = stato.celleCorrette.size;
    const numRichiesti = stato.soluzione.length;

    if (numCorretti === numRichiesti) {
        // 🎉 VITTORIA!
        setTimeout(() => {
            mostraModaleVittoria();
        }, 500);
    }
}

/**
 * Verifica manuale (pulsante "Verifica soluzione").
 * Controlla se le celle marcate con "x" corrispondono alla soluzione.
 */
function verificaManuale() {
    if (!stato.soluzione) return;

    // Estrai le posizioni corrette dalla soluzione
    const posizioniCorrette = new Set(
        stato.soluzione.map(s => `$${s.r},$${s.c}`)
    );

    // Controlla se tutte le celle corrette sono state trovate
    let tutteTrova = true;
    for (const chiave of posizioniCorrette) {
        if (!stato.celleCorrette.has(chiave)) {
            tutteTrova = false;
            break;
        }
    }

    if (tutteTrova) {
        mostraModaleVittoria();
    } else {
        mostraMessaggio(
            `Trovati $${stato.celleCorrette.size}/$${stato.soluzione.length} gatti. Continua così!`,
            "alert-info"
        );
    }
}

/**
 * Mostra il messaggio di vittoria e avanza al livello successivo.
 */
function mostraModaleVittoria() {
    stato.livello++;
    salvaLivello();

    const modale = document.getElementById("modale-vittoria");
    modale.showModal();
}

/**
 * Mostra un messaggio temporaneo sotto la griglia.
 * @param {string} testo - Testo del messaggio
 * @param {string} classe - Classe DaisyUI (alert-success, alert-error, alert-info)
 */
function mostraMessaggio(testo, classe = "alert-info") {
    const alert = document.getElementById("messaggio");
    const span = document.getElementById("messaggio-testo");

    alert.className = `alert mt-4 w-full max-w-md ${classe}`;
    span.textContent = testo;
    alert.classList.remove("hidden");

    // Auto-nascondi dopo 4 secondi
    setTimeout(() => {
        alert.classList.add("hidden");
    }, 4000);
}


// ─────────────────────────────────────────────────────────────────
// 8. FUNZIONI DI UTILITY
// ─────────────────────────────────────────────────────────────────
function pulisciTutto() {
    stato.celleCorrette.clear();
    stato.celleErrate.clear();
    stato.celleMarcate.clear();
    stato.cooldownCelle.clear();  // ← AGGIUNGI QUESTA RIGA
    stato.ultimoClick = null;

    const celle = document.querySelectorAll("#matriceGioco td");
    celle.forEach(cell => {
        cell.textContent = "";
        cell.className = "";
    });
}
/**
 * Mostra un suggerimento: evidenzia una cella della soluzione non ancora trovata.
 * L'evidenziazione dura 2 secondi.
 */
function mostraSuggerimento() {
    if (!stato.soluzione) return;

    // Trova un gatto non ancora trovato
    const nonTrovati = stato.soluzione.filter(
        s => !stato.celleCorrette.has(`${s.r},${s.c}`)
    );

    if (nonTrovati.length === 0) {
        mostraMessaggio("Hai già trovato tutti i gatti! 🎉", "alert-success");
        return;
    }

    // Scegli casualmente uno tra quelli non trovati
    const suggerimento = nonTrovati[Math.floor(Math.random() * nonTrovati.length)];

    // Ottieni la cella corrispondente
    const tabella = document.getElementById("matriceGioco");
    const cell = tabella.rows[suggerimento.r].cells[suggerimento.c];

    // Aggiungi classe di evidenziazione
    cell.classList.add("suggerimento");

    // Rimuovi dopo 2 secondi
    setTimeout(() => {
        cell.classList.remove("suggerimento");
    }, 2000);
}

/**
 * Genera una nuova griglia mantenendo la stessa difficoltà.
 * Azzera lo stato delle celle ma non il livello.
 */
function nuovaGriglia() {
    // Calcola la dimensione in base alla difficoltà
    stato.n = calcolaDimensione(stato.difficolta);

    // Il numero di colori = n (un gatto per colore, uno per riga/colonna)
    const numColori = stato.n;

    // Genera griglia con soluzione garantita
    const risultato = generaGrigliaConSoluzione(stato.n, numColori);
    stato.griglia = risultato.griglia;
    stato.soluzione = risultato.soluzione;

    // Resetta lo stato delle celle
    stato.celleCorrette.clear();
    stato.celleErrate.clear();
    stato.celleMarcate.clear();
    stato.ultimoClick = null;

    // Ridisegna la tabella
    disegnaTabella(stato.griglia);

    // Aggiorna info
    aggiornaInfo();
}


// ─────────────────────────────────────────────────────────────────
// 9. GESTIONE LIVELLI E PERSISTENZA (localStorage)
// ─────────────────────────────────────────────────────────────────

/**
 * Salva il livello corrente nel localStorage del browser.
 * Il dato persiste tra le sessioni (a meno che non si cancellino i dati del sito).
 */
function salvaLivello() {
    try {
        localStorage.setItem("gatti_matrice_livello", stato.livello.toString());
        localStorage.setItem("gatti_matrice_difficolta", stato.difficolta.toString());
    } catch (e) {
        // localStorage non disponibile (es. modalità privata)
        console.warn("Impossibile salvare il livello:", e);
    }
}

/**
 * Carica il livello salvato dal localStorage.
 * @returns {number|null} Il livello salvato oppure null se non presente
 */
function caricaLivello() {
    try {
        const val = localStorage.getItem("gatti_matrice_livello");
        return val !== null ? parseInt(val, 10) : null;
    } catch (e) {
        return null;
    }
}

/**
 * Carica la difficoltà salvata dal localStorage.
 * @returns {number|null} La difficoltà salvata oppure null
 */
function caricaDifficolta() {
    try {
        const val = localStorage.getItem("gatti_matrice_difficolta");
        return val !== null ? parseInt(val, 10) : null;
    } catch (e) {
        return null;
    }
}


// ─────────────────────────────────────────────────────────────────
// 10. AGGIORNAMENTO INTERFACCIA
// ─────────────────────────────────────────────────────────────────

/**
 * Aggiorna i pannelli informativi sopra la griglia.
 */
function aggiornaInfo() {
    document.getElementById("info-livello").textContent = stato.livello;
    document.getElementById("info-griglia").textContent = `${stato.n}×${stato.n}`;
    document.getElementById("info-colori").textContent = stato.n;
}

/**
 * Aggiorna il badge della difficoltà in alto a destra.
 */
function aggiornaBadgeDifficolta() {
    const badge = document.getElementById("difficolta-badge");
    const valore = document.getElementById("difficolta-valore");

    if (stato.difficolta !== null) {
        badge.classList.remove("hidden");
        valore.textContent = stato.difficolta;
    } else {
        badge.classList.add("hidden");
    }
}

/**
 * Popola il menu a tendina della difficoltà (da 4 a 30).
 */
function popolaSelectDifficolta() {
    const select = document.getElementById("select-difficolta");
    select.innerHTML = ""; // Pulisci opzioni esistenti

    for (let i = 4; i <= 30; i++) {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = `Livello ${i} (griglia ${i}-${i + 2})`;

        // Valore predefinito: livello 4
        if (i === 4) option.selected = true;

        select.appendChild(option);
    }
}


// ─────────────────────────────────────────────────────────────────
// 11. FLUSSO DI GIOCO (Transizioni tra schermate)
// ─────────────────────────────────────────────────────────────────

/**
 * Avvia il gioco con la difficoltà e il livello selezionati.
 * Nasconde la schermata iniziale e mostra quella di gioco.
 */
function avviaGioco() {
    // Leggi la difficoltà selezionata
    const select = document.getElementById("select-difficolta");
    stato.difficolta = parseInt(select.value, 10);

    // Leggi il livello iniziale (se prima partita)
    const inputLivello = document.getElementById("input-livello-iniziale");
    const livelloIniziale = parseInt(inputLivello.value, 10);
    stato.livello = isNaN(livelloIniziale) || livelloIniziale < 0 ? 0 : livelloIniziale;

    // Salva in localStorage
    salvaLivello();

    // Nascondi schermata iniziale, mostra schermata gioco
    document.getElementById("schermata-iniziale").classList.add("hidden");
    const schermataGioco = document.getElementById("schermata-gioco");
    schermataGioco.classList.remove("hidden");
    schermataGioco.classList.add("flex");

    // Aggiorna badge difficoltà
    aggiornaBadgeDifficolta();

    // Genera la prima griglia
    nuovaGriglia();
}

/**
 * Passa al livello successivo dopo la vittoria.
 * Chiude il modale e genera una nuova griglia.
 */
function prossimoLivello() {
    // Chiudi il modale
    const modale = document.getElementById("modale-vittoria");
    modale.close();

    // Salva il nuovo livello
    salvaLivello();

    // Genera nuova griglia
    nuovaGriglia();
}


// ─────────────────────────────────────────────────────────────────
// 12. INIZIALIZZAZIONE (Esecuzione all'avvio della pagina)
// ─────────────────────────────────────────────────────────────────

/**
 * Funzione principale di inizializzazione.
 * Viene chiamata quando il DOM è completamente caricato.
 */
function inizializza() {
    // Popola il menu a tendina della difficoltà
    popolaSelectDifficolta();

    // Controlla se c'è un livello salvato (partita precedente)
    const livelloSalvato = caricaLivello();
    const difficoltaSalvata = caricaDifficolta();

    if (livelloSalvato !== null && livelloSalvato > 0) {
        // C'è una partita precedente: precompila il campo input
        document.getElementById("input-livello-iniziale").value = livelloSalvato;
    }

    if (difficoltaSalvata !== null) {
        // Preseleziona la difficoltà usata in precedenza
        document.getElementById("select-difficolta").value = difficoltaSalvata;
    }

    // ─── Event Listeners per i pulsanti ───

    // Pulsante "Inizia a giocare"
    document.getElementById("btn-inizia").addEventListener("click", avviaGioco);

    // Pulsante "Verifica soluzione"
    document.getElementById("btn-verifica").addEventListener("click", verificaManuale);

    // Pulsante "Pulisci tutto"
    document.getElementById("btn-pulisci").addEventListener("click", pulisciTutto);

    // Pulsante "Suggerimento"
    document.getElementById("btn-suggerimento").addEventListener("click", mostraSuggerimento);

    // Pulsante "Nuova griglia"
    document.getElementById("btn-nuova").addEventListener("click", nuovaGriglia);

    // Pulsante "Prossimo livello" nel modale vittoria
    document.getElementById("btn-prossimo-livello").addEventListener("click", prossimoLivello);

    // Inizializza le interazioni con la tabella (delegazione eventi)
    inizializzaInterazioni();
}

// Avvia tutto quando il DOM è pronto
document.addEventListener("DOMContentLoaded", inizializza);