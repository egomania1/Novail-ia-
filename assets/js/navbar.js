/*
/////////////////////////////////////////////////////////////
FICHIER: navbar.js
AUTEUR: Kelian
PROJET: NOVAIL IA - Cybersécurité automatisée
DATE: 2026
DESCRIPTION: Injection dynamique de la navbar commune
/////////////////////////////////////////////////////////////
*/

(function () {
    const NAV_HTML = `
        <nav class="navbar">
            <div class="nav-container">
                <ul class="nav-links">
                    <li><a href="page-noire.html" data-lang="home">Home</a></li>
                    <li><a href="solution.html" data-lang="solution">Solution</a></li>
                    <li><a href="features.html" data-lang="features">Features</a></li>
                    <li><a href="offers-vision.html" data-lang="offers-vision">Offers & Vision</a></li>
                    <li><a href="contact.html" data-lang="contact">Contact</a></li>
                </ul>
                <button id="language-toggle" class="language-button">FR</button>
            </div>
        </nav>
    `;

    // Injecter la navbar au début du body
    document.addEventListener('DOMContentLoaded', function () {
        document.body.insertAdjacentHTML('afterbegin', NAV_HTML);
    });
})();
