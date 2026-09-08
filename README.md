# PréVol — v30.1

Application de préparation de vol (PWA). Hébergement : GitHub Pages.

## Structure

Le JavaScript et le CSS, auparavant recopiés dans chacune des douze pages,
sont maintenant dans deux fichiers partagés :

- `app.js`  — toute la logique de l'application (une seule source)
- `app.css` — toute la mise en forme (une seule source)

Chaque page HTML ne contient plus que son propre balisage, le menu, et un
petit script en tête qui applique le thème avant le premier affichage.
`page-carburant.js` porte le code propre à la page Carburant.

Toute correction de logique se fait désormais dans `app.js` uniquement.

## Météo

`app.js` essaie trois points d'entrée dans l'ordre :

1. `/api/wx` — le relais Cloudflare (`_worker.js`), qui ne fonctionne que si
   le site est servi par Cloudflare Pages ;
2. `https://aviationweather.gov/api/data/metar` — appel direct ;
3. `https://aviationweather.gov/cgi-bin/data/metar.php` — point d'entrée de secours.

Le premier qui répond est retenu pour la session. Sur GitHub Pages, le point 1
échoue silencieusement et l'appel direct prend le relais.

`_worker.js` et `_headers` sont conservés : ils sont ignorés par GitHub Pages
et redeviendraient actifs en cas de retour sur Cloudflare Pages.

## Service worker

`sw.js` met en cache les douze pages individuellement. La version précédente
ne gardait qu'`index.html` et la servait pour toutes les navigations : hors
ligne, chaque page affichait le tableau de bord.

Incrémenter `CACHE_VERSION` à chaque modification de `app.js` ou `app.css`.

## Fonctions reconnectées (v30.1)

La refonte visuelle avait supprimé des éléments que `app.js` cherchait encore.
Croisement des 145 identifiants attendus par le script avec le balisage de
chaque page : quatre manquaient partout, tous reconnectés.

- `draftBanner` / `draftBannerInfo` / `draftResume` / `draftDiscard` — le
  brouillon était toujours enregistré à chaque frappe, mais plus aucun bandeau
  ne proposait de le reprendre : la saisie était donc perdue en silence.
  Bandeau réinséré en tête du tableau de bord des douze pages.
- `netDot` / `netStatusLabel` — état en ligne / hors ligne, replacé en pied de
  menu avec le numéro de version.

Corrigé également : la rose des vents pointait vers l'extérieur, indiquant la
direction vers laquelle le vent souffle au lieu de sa provenance — une erreur
de 180° sur la lecture du travers. La flèche part maintenant du bord et pointe
vers le centre, et l'axe de piste porte son numéro.

`a-propos.html` ne possède pas les cartes du tableau de bord (sauvegarde,
stockage, thème, liste des dossiers). C'est volontaire, et sans effet : toutes
les fonctions concernées vérifient la présence de leur élément avant d'agir.
