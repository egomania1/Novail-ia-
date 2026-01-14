// Passwordle Component - Version avec système d'étapes multiples
class PasswordleGame {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Passwordle container not found');
            return;
        }
        
        // Liste des mots à deviner dans l'ordre
        this.words = ['BATEAU', 'AVIONS', 'LAMPES', 'LIVRES', 'ORANGE', 'NUAGES'];
        this.finalPassword = 'BALLON'; // Mot de passe final
        
        // Options par défaut
        this.options = {
            maxAttempts: options.maxAttempts || 6,
            title: options.title || 'NOVAIL Passwordle',
            winText: options.winText || 'Access Granted!',
            failText: options.failText || 'Access Denied',
            revealTitle: options.revealTitle || 'Word: ',
            redirectUrl: options.redirectUrl || '#',
            openRedirectInNewTab: options.openRedirectInNewTab || false,
            correctColor: options.correctColor || '#6aaa64',
            presentColor: options.presentColor || '#c9b458',
            absentColor: options.absentColor || '#787c7e',
            emptyColor: options.emptyColor || 'rgba(255, 255, 255, 0.1)',
            textColor: options.textColor || '#ffffff',
            backgroundColor: options.backgroundColor || 'transparent'
        };
        
        this.currentWordIndex = 0; // Index du mot courant
        this.answer = this.words[this.currentWordIndex]; // Mot à deviner actuel
        this.guesses = [];
        this.current = '';
        this.status = 'playing'; // 'playing', 'success', 'fail'
        this.error = '';
        
        // Afficher les informations dans la console
        console.log('=== PASSWORDLE MULTI-ÉTAPES ===');
        console.log('Mots à deviner:', this.words);
        console.log('Mot de passe final:', this.finalPassword);
        console.log('Mot courant:', this.answer);
        console.log('===============================');
        
        this.init();
    }
    
    init() {
        this.render();
        this.setupEventListeners();
        this.focusInput();
    }
    
    setupEventListeners() {
        // Écouter les touches du clavier
        document.addEventListener('keydown', (e) => {
            if (this.status !== 'playing') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (this.guesses.length >= this.options.maxAttempts) return;
            
            if (e.key === 'Backspace') {
                if (this.current.length > 0) {
                    this.current = this.current.slice(0, -1);
                    this.error = '';
                    this.render();
                }
            } else if (/^[a-zA-Z]$/.test(e.key)) {
                if (this.current.length < this.answer.length) {
                    this.current = this.current + e.key.toUpperCase();
                    this.error = '';
                    this.render();
                }
            } else if (e.key === 'Enter') {
                if (this.current.length === this.answer.length) {
                    this.submitGuess();
                }
            }
        });
        
        // Attacher les écouteurs d'événements aux cases après le rendu
        setTimeout(() => {
            this.attachCellClickListeners();
        }, 0);
    }
    
    // Méthode pour attacher les écouteurs d'événements aux cases
    attachCellClickListeners() {
        const cells = document.querySelectorAll('[data-cell-position]');
        cells.forEach(cell => {
            // Supprimer les écouteurs existants
            const newCell = cell.cloneNode(true);
            cell.parentNode.replaceChild(newCell, cell);
            
            // Ajouter le nouvel écouteur
            newCell.addEventListener('click', (e) => {
                const position = parseInt(e.currentTarget.getAttribute('data-cell-position'));
                const rowIndex = parseInt(e.currentTarget.getAttribute('data-row-index'));
                
                // Ne permettre le clic que sur la ligne actuelle
                if (rowIndex === this.guesses.length && this.status === 'playing') {
                    this.handleEmptyCellClick(position);
                }
            });
        });
    }
    
    focusInput() {
        // Focus sur le conteneur pour capturer les événements clavier
        this.container.tabIndex = -1;
        this.container.focus();
    }
    
    // Méthode pour gérer les clics sur les cases vides
    handleEmptyCellClick(position) {
        if (this.status !== 'playing') return;
        if (this.guesses.length >= this.options.maxAttempts) return;
        
        // Vérifier si on clique sur la ligne actuelle
        const currentRow = this.guesses.length;
        
        // On ne peut cliquer que sur les cases de la ligne actuelle
        if (position === this.current.length && this.current.length < this.answer.length) {
            // Ajouter directement la lettre 'A' à la position spécifiée
            this.addLetterAtPosition('A', position);
        }
    }
    
    // Méthode pour ajouter une lettre à une position spécifique
    addLetterAtPosition(letter, position) {
        if (this.status !== 'playing') return;
        if (this.guesses.length >= this.options.maxAttempts) return;
        
        // Vérifier que la position correspond à la longueur actuelle du mot
        if (this.current.length === position && this.current.length < this.answer.length) {
            this.current = this.current + letter.toUpperCase();
            this.error = '';
            this.render();
            
            // Réattacher les écouteurs d'événements après le rendu
            setTimeout(() => {
                this.attachCellClickListeners();
            }, 0);
        }
    }
    
    // Méthode pour gérer les clics sur le clavier virtuel
    handleKeyboardClick(letter) {
        if (this.status !== 'playing') return;
        if (this.guesses.length >= this.options.maxAttempts) return;
        
        if (letter === 'BACKSPACE') {
            if (this.current.length > 0) {
                this.current = this.current.slice(0, -1);
                this.error = '';
                this.render();
                
                // Réattacher les écouteurs d'événements après le rendu
                setTimeout(() => {
                    this.attachCellClickListeners();
                }, 0);
            }
        } else if (letter === 'ENTER') {
            if (this.current.length === this.answer.length) {
                this.submitGuess();
            }
        } else if (/^[a-zA-Z]$/.test(letter) && this.current.length < this.answer.length) {
            this.current = this.current + letter.toUpperCase();
            this.error = '';
            this.render();
            
            // Réattacher les écouteurs d'événements après le rendu
            setTimeout(() => {
                this.attachCellClickListeners();
            }, 0);
        }
    }
    
    submitGuess() {
        // DEBUG: Afficher le mot saisi et le mot attendu
        console.log('=== TENTATIVE ===');
        console.log('Mot saisi:', this.current);
        console.log('Mot attendu:', this.answer);
        console.log('Étape:', (this.currentWordIndex + 1) + '/' + this.words.length);
        console.log('Test égalité:', this.current === this.answer);
        
        if (this.current === this.answer) {
            this.guesses.push(this.current);
            
            // Passer à l'étape suivante
            this.currentWordIndex++;
            
            if (this.currentWordIndex >= this.words.length) {
                // Toutes les étapes sont complétées
                this.status = 'success';
                console.log('TOUTES LES ÉTAPES TERMINÉES - ACCÈS AUTORISÉ !');
            } else {
                // Passer au mot suivant
                this.answer = this.words[this.currentWordIndex];
                this.guesses = []; // Réinitialiser les tentatives pour le nouveau mot
                this.current = '';
                console.log('PASSAGE À L\'ÉTAPE SUIVANTE:', this.answer);
            }
            
            this.render();
            
            // Réattacher les écouteurs d'événements après le rendu
            setTimeout(() => {
                this.attachCellClickListeners();
            }, 0);
            
            // Redirection si succès final
            if (this.status === 'success') {
                setTimeout(() => {
                    if (this.options.redirectUrl !== '#') {
                        if (this.options.openRedirectInNewTab) {
                            window.open(this.options.redirectUrl, '_blank');
                        } else {
                            window.location.href = this.options.redirectUrl;
                        }
                    }
                }, 800);
            }
        } else {
            this.guesses.push(this.current);
            this.error = '';
            
            if (this.guesses.length >= this.options.maxAttempts) {
                this.status = 'fail';
            }
            
            this.current = '';
            this.render();
            
            // Réattacher les écouteurs d'événements après le rendu
            setTimeout(() => {
                this.attachCellClickListeners();
            }, 0);
        }
    }
    
    getLetterStatuses(guess, answer) {
        // Adapter à la longueur du mot courant
        const result = Array(answer.length).fill('absent');
        const answerArr = answer.split('');
        const guessArr = guess.split('');
        const used = Array(answer.length).fill(false);
        
        // Marquer les lettres correctes (bonne lettre, bonne position)
        for (let i = 0; i < answer.length; i++) {
            if (guessArr[i] === answerArr[i]) {
                result[i] = 'correct';
                used[i] = true;
            }
        }
        
        // Marquer les lettres présentes mais mal placées
        for (let i = 0; i < answer.length; i++) {
            if (result[i] === 'correct') continue;
            for (let j = 0; j < answer.length; j++) {
                if (!used[j] && guessArr[i] === answerArr[j]) {
                    result[i] = 'present';
                    used[j] = true;
                    break;
                }
            }
        }
        
        return result;
    }
    
    reset() {
        this.currentWordIndex = 0;
        this.answer = this.words[this.currentWordIndex];
        this.guesses = [];
        this.current = '';
        this.status = 'playing';
        this.error = '';
        this.render();
        this.focusInput();
        
        // Réattacher les écouteurs d'événements après le rendu
        setTimeout(() => {
            this.attachCellClickListeners();
        }, 0);
    }
    
    // Méthode pour générer le clavier virtuel
    generateKeyboard() {
        const rows = [
            ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
            ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
        ];
        
        let keyboardHtml = '<div style="margin-top: 20px; width: 100%; max-width: 300px;">';
        
        rows.forEach(row => {
            keyboardHtml += '<div style="display: flex; justify-content: center; gap: 4px; margin-bottom: 6px;">';
            
            row.forEach(key => {
                let keyStyle = '';
                let keyContent = key;
                
                if (key === 'ENTER') {
                    keyStyle = 'width: 60px; font-size: 10px;';
                    keyContent = 'ENTER';
                } else if (key === 'BACKSPACE') {
                    keyStyle = 'width: 60px; font-size: 10px;';
                    keyContent = '⌫';
                } else {
                    keyStyle = 'width: 24px;';
                }
                
                keyboardHtml += `
                    <button onclick="handlePasswordleKeyboardClick('${key}')" style="
                        ${keyStyle}
                        height: 30px;
                        background: rgba(128, 128, 128, 0.3);
                        color: white;
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    ">
                        ${keyContent}
                    </button>
                `;
            });
            
            keyboardHtml += '</div>';
        });
        
        keyboardHtml += '</div>';
        return keyboardHtml;
    }
    
    render() {
        // Créer les lignes pour le mot courant
        const rows = [];
        for (let i = 0; i < this.options.maxAttempts; i++) {
            if (i < this.guesses.length) {
                const guess = this.guesses[i];
                const statuses = this.getLetterStatuses(guess, this.answer);
                rows.push({ guess, statuses, submitted: true, rowIndex: i });
            } else if (i === this.guesses.length && this.status === 'playing') {
                rows.push({ 
                    guess: this.current.padEnd(this.answer.length, ' '),
                    statuses: Array(this.answer.length).fill('empty'),
                    submitted: false,
                    rowIndex: i
                });
            } else {
                rows.push({ 
                    guess: ' '.repeat(this.answer.length),
                    statuses: Array(this.answer.length).fill('empty'),
                    submitted: false,
                    rowIndex: i
                });
            }
        }
        
        // Couleurs
        const colorMap = {
            correct: this.options.correctColor,
            present: this.options.presentColor,
            absent: this.options.absentColor,
            empty: this.options.emptyColor
        };
        
        // Générer le HTML
        let html = `
            <div style="
                background: ${this.options.backgroundColor};
                color: ${this.options.textColor};
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                padding: 24px;
                min-width: 350px;
                min-height: 450px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
                position: relative;
                width: 100%;
                box-sizing: border-box;
                height: auto;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            ">
                <div style="
                    font-weight: 700;
                    font-size: 20px;
                    margin-bottom: 32px;
                ">
                    ${this.options.title}
                </div>
                
                <div style="
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    width: 100%;
                    max-width: 360px;
                    align-items: center;
                ">
        `;
        
        // Ajouter les indices visuels
        html += `
            <div style="
                font-size: 14px;
                color: rgba(255, 255, 255, 0.8);
                text-align: center;
                margin-bottom: 15px;
                padding: 10px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            ">
                <strong>Step ${this.currentWordIndex + 1}/${this.words.length}</strong><br>
                Word to find: <strong>${this.answer}</strong><br>
                ${this.currentWordIndex < this.words.length - 1 ? 
                  `Final password: ${this.finalPassword}` : 
                  `<span style="color: #6aaa64;">Last step - Final password: ${this.finalPassword}</span>`}
            </div>
        `;
        
        // Ajouter les lignes - cases avec lettres visibles
        rows.forEach((row, i) => {
            html += `<div style="display: flex; gap: 6px;">`;
            
            row.guess.split('').forEach((ch, j) => {
                // Calculer la position de la cellule
                const position = j;
                
                // Cases avec lettres visibles
                const isSubmitted = row.submitted;
                const bgColor = isSubmitted ? colorMap[row.statuses[j]] : 'rgba(128, 128, 128, 0.3)';
                const borderColor = isSubmitted ? 
                                  (row.statuses[j] === 'empty' ? 'rgba(255, 255, 255, 0.2)' : 'none') : 
                                  'rgba(128, 128, 128, 0.5)';
                // Rendre les lettres visibles
                const displayChar = ch.trim() !== '' ? ch : (isSubmitted ? '' : '');
                const textColor = this.options.textColor;
                
                // Ajouter un ID unique pour chaque case
                const cellId = `cell-${i}-${j}`;
                
                // Seulement la ligne actuelle est cliquable
                const isCurrentRow = (i === this.guesses.length);
                const isClickable = (!isSubmitted && isCurrentRow && position === this.current.length && this.status === 'playing');
                
                // Ajouter des attributs data pour identifier la position et la ligne
                const dataAttrs = isClickable ? `data-cell-position="${position}" data-row-index="${i}"` : '';
                
                html += `
                    <div id="${cellId}" ${dataAttrs} style="
                        width: 48px;
                        height: 48px;
                        background: ${bgColor};
                        color: ${textColor};
                        border-radius: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 28px;
                        font-weight: 700;
                        text-transform: uppercase;
                        border: ${borderColor ? `1.5px solid ${borderColor}` : 'none'};
                        cursor: ${isClickable ? 'pointer' : (isSubmitted ? 'default' : 'not-allowed')};
                        ${isClickable ? 'box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);' : ''}
                    ">
                        ${displayChar}
                    </div>
                `;
            });
            
            html += `</div>`;
        });
        
        // Message de succès ou d'échec
        if (this.status === 'success') {
            html += `
                <div style="
                    color: ${colorMap.correct};
                    font-weight: 700;
                    margin-top: 12px;
                    text-align: center;
                ">
                    ${this.options.winText}<br>
                    <span style="font-size: 16px;">Mot de passe : ${this.finalPassword}</span>
                </div>
            `;
        } else if (this.status === 'fail') {
            html += `
                <div style="
                    color: ${colorMap.absent};
                    font-weight: 700;
                    margin-top: 12px;
                    text-align: center;
                ">
                    ${this.options.failText}<br>
                    ${this.options.revealTitle}${this.answer}
                </div>
                
                <button id="reset-button" style="
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 8px;
                    margin-top: 12px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: #ffffff;
                ">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 4v6h6"></path>
                        <path d="M3.51 9a9 9 0 1 0 2.13-3.36L1 10"></path>
                    </svg>
                </button>
            `;
        }
        
        // Message d'erreur
        if (this.error) {
            html += `
                <div style="
                    color: #ff6b6b;
                    margin-top: 8px;
                ">
                    ${this.error}
                </div>
            `;
        }
        
        // Instructions
        if (this.status === 'playing') {
            html += `
                <div style="
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.7);
                    margin-top: 8px;
                    text-align: center;
                ">
                    Find the word "${this.answer}"<br>
                    Remaining attempts: ${this.options.maxAttempts - this.guesses.length}<br>
                    <span style="font-size: 11px;">Green: Correct letter/correct position | Yellow: Letter present | Gray: Letter absent</span>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        
        // Ajouter l'événement pour le bouton reset
        if (this.status === 'fail') {
            const resetButton = document.getElementById('reset-button');
            if (resetButton) {
                resetButton.addEventListener('click', () => this.reset());
            }
        }
        
        // Ajouter le clavier virtuel si le jeu est en cours
        if (this.status === 'playing') {
            const keyboardHtml = this.generateKeyboard();
            this.container.innerHTML += keyboardHtml;
        }
        
        // Stocker une référence à cette instance pour y accéder depuis les fonctions globales
        window.currentPasswordleGame = this;
    }
}

// Fonction globale pour gérer les clics sur les cases
function handlePasswordleCellClick(position) {
    if (window.currentPasswordleGame) {
        window.currentPasswordleGame.handleEmptyCellClick(position);
    }
}

// Fonction globale pour gérer les clics sur le clavier virtuel
function handlePasswordleKeyboardClick(letter) {
    if (window.currentPasswordleGame) {
        window.currentPasswordleGame.handleKeyboardClick(letter);
    }
}

// Initialiser automatiquement le jeu si un conteneur existe
document.addEventListener('DOMContentLoaded', function() {
    const passwordleContainer = document.getElementById('passwordle-container');
    if (passwordleContainer) {
        new PasswordleGame('passwordle-container', {
            maxAttempts: 6,
            title: 'NOVAIL Passwordle',
            winText: 'Access Granted!',
            failText: 'Access Denied',
            revealTitle: 'Word: ',
            redirectUrl: '#',
            openRedirectInNewTab: false,
            correctColor: '#6aaa64',
            presentColor: '#c9b458',
            absentColor: '#787c7e',
            emptyColor: 'rgba(255, 255, 255, 0.1)',
            textColor: '#ffffff',
            backgroundColor: 'transparent'
        });
    }
});