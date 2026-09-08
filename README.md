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

## État partagé entre les pages (v31)

Chaque page du menu est un document HTML distinct qui contient le même
formulaire, avec les mêmes identifiants. Naviguer d'une page à l'autre est donc
un rechargement complet : la mémoire de la page disparaît, seul le stockage
survit.

Le mécanisme de brouillon sert désormais d'état partagé :

- tous les champs du vol sont écrits dans `localStorage` à chaque frappe, et
  immédiatement sur `pagehide`, donc avant chaque changement de page ;
- à l'ouverture de n'importe quelle page, ils sont restaurés automatiquement,
  puis remis en cohérence dans l'ordre : avion appliqué en premier (il
  conditionne les tables et l'enveloppe), listes de pistes, verrouillages de
  surface, indications de vent ;
- l'identifiant du dossier ouvert est lui aussi stocké
  (`prevol_dossier_courant_v1`), sinon « Enregistrer » créerait une fiche par
  page visitée ;
- les pièces jointes et le bulletin météo étaient déjà partagés, en IndexedDB
  et en localStorage.

Le bandeau du tableau de bord ne demande plus quoi faire : la reprise est
automatique. Il indique le vol en cours et permet de repartir de zéro.

Attention : `restoreFlight` est appelé trois fois de suite dans la remise en
cohérence. C'est voulu — `applyAircraft` et `applyRunwayToFields` réécrivent
certains champs, il faut reposer les valeurs du pilote après chacun.

## Normalisation de la structure (v33)

Le balisage avait divergé page par page. État avant / après :

| | avant | après |
|---|---|---|
| variantes de `#pageFlight` | 6 | 1 (+2 pages volontairement enrichies) |
| variantes de `#pageHome` | 5 | 5 (non traité) |
| blocs `<style>` par page | 7 à 9 | 1 à 4 |
| numérotation des sections | deux « 04 », jusqu'à 08 ou 10 selon la page | 01 à 09 partout |

### Identifiants corrigés

- `sectionPerf` portait en réalité la section **Carburant** → `sectionFuel`
- `dossierEnvironmentLegacy` → `sectionEnvironment`, présent sur toutes les pages
- sections sans identifiant nommées : `sectionCartouche`, `sectionSafety`
- `altFuelSection` supprimé : le carburant de dégagement est un champ de la
  section 03 (`altFuelField`), plus une section 08 séparée

### Corrections de fond

- `index.html` déclarait `data-view="dossier"`, comme `dossier.html`, alors que
  leurs règles d'affichage sont opposées : l'un montre le tableau de bord,
  l'autre le formulaire. Devenu `data-view="dashboard"`.
- La barre d'onglets d'origine (`nav.tabs`, `aria-hidden="true"`) subsistait sur
  les douze pages, masquée par une règle CSS. Supprimée, ainsi que les blocs de
  style qui ne servaient qu'à la cacher.
- Six blocs de correctifs CSS identiques (`sidebar-scroll-fix`,
  `layout-footer-fix`, `button-layout-fix`, `premium-svg-icons`,
  `empty-placeholder-fix`, `multi-page-navigation`) étaient recopiés dans
  chaque page : remontés dans `app.css`, 69 blocs supprimés.
- Chaque section du dossier porte un lien vers sa page dédiée.

### Ce qui reste inline, volontairement

`prevol-page-scope` et les `page-filter-*` définissent quelle section chaque
page met en avant. Ils sont propres à chaque page. Ils pourraient devenir une
règle unique pilotée par `body[data-view]` dans `app.css` — c'est possible
maintenant que les identifiants de section sont stables et que le doublon
index/dossier est levé.

## Correctif v33.1 — pages Météo et NOTAM vides

La normalisation avait pris `dossier.html` comme référence pour `#pageFlight`.
Or les classes `wx-only` et `notam-only`, qui indiquent au filtre de chaque page
quels blocs afficher, n'existaient que sur les huit pages « vue ». En posant le
bloc de `dossier.html` partout, ces marqueurs ont disparu, et le filtre
`#sectionWeather > *{display:none}` n'avait donc plus rien à révéler.

Restaurés depuis la section Météo d'origine. Trois points corrigés en plus :

- le titre de la section est désormais dans `.section-title-row`, c'est ce
  conteneur, enfant direct, qui doit porter les marqueurs ;
- le bloc de récupération METAR ayant été déplacé dans `#sectionEnvironment`,
  la page Météo ne pouvait plus le voir : cette section lui est maintenant
  ouverte, filtrée sur `.wx-only` ;
- `wxFetchMsg` est marqué, sans quoi les messages d'erreur météo seraient
  restés invisibles sur la page dédiée.

## v34

- **Effacement.** Chaque section du dossier reçoit un bouton « Effacer », et la
  barre d'actions du dossier complet un bouton « Effacer le dossier ». Les
  boutons sont injectés par `app.js`, pas écrits dans les douze pages : toute
  section ajoutée plus tard en hérite. Trois protections : les champs en
  lecture seule (paramètres de l'avion) sont épargnés, les champs de commodité
  `.noSave` aussi, et seuls les champs **visibles** sont vidés — sans quoi le
  bouton de la page NOTAM effacerait les champs météo du même bloc.
- **Aucun avion présélectionné.** L'initialisation le faisait déjà, mais
  `refreshAircraftSelect` reconstruisait la liste sans l'option « Choisir » et
  resélectionnait le premier appareil. Corrigé. Le calcul refuse désormais de
  s'exécuter sans avion avec un message explicite, au lieu d'échouer sur des
  champs vides.
- **Titres par page.** La section « 07 Météo & NOTAM » regroupe deux sujets
  dans le dossier complet. Sur les pages dédiées, elle s'intitule simplement
  « Météo » ou « NOTAM », sans numéro d'étape. Même principe pour les autres
  pages, via la table `TITRES_PAR_VUE`.
- Mention « Facultatif. Une fois renseigné… » retirée sous le champ dégagement.

## v35 — Carnet de vol intégré

`carnet-de-vol.html` était une page autonome : style et script inline, aucune
entrée dans le menu des autres pages, jeu de couleurs et polices distinct.

- Entrée « Carnet de vol » ajoutée au menu des douze pages, après « Dossier ».
  La liaison inverse existait déjà.
- Style et script sortis dans `carnet.css` et `carnet.js` : la page passe de
  45 Ko à 16 Ko et suit la même structure que les autres.
- Jetons visuels alignés sur `app.css` — même bleu, mêmes familles Barlow,
  mêmes angles — et script de thème ajouté, donc le carnet suit maintenant le
  réglage clair / sombre / automatique. Ses classes (`.app`, `.sidebar`,
  `.nav-item`) lui restent propres : elles ne portent pas les mêmes noms que
  celles des autres pages, et les fusionner demanderait une refonte du
  balisage.
- Ajouté au cache du service worker, donc consultable hors ligne.

Sa base de données est indépendante (`prevol.logbook.v2`) : aucune collision
avec le brouillon de dossier ni les dossiers enregistrés.

## v36

- **Carnet reconstruit sur la coquille commune.** Il portait sa propre barre
  latérale (`.nav-item`, icônes texte `⌂ ▤ ▥`) et n'avait pas de pied de page.
  Il utilise maintenant exactement le même `<aside>` que les autres pages,
  avec les icônes SVG et le pied. `carnet.css` a perdu ses règles de coquille,
  désormais fournies par `app.css` : 8,5 → 7,0 Ko.
- **`outils.html` supprimé**, entrée retirée du menu et du cache.
- **Carnet de vol placé sous NOTAM** dans le menu.
- **`dossiers.html`** : nouvelle page listant les dossiers enregistrés.
  « Charger un vol » et « Tout voir » y mènent désormais, au lieu d'ouvrir un
  formulaire vide.

### Pourquoi un dossier enregistré semblait perdu

Il ne l'était pas. `openDossier` restaurait bien les champs, puis appelait
`goToPage('pageFlight')`. Or le tableau de bord masque `#pageFlight` par CSS
(`prevol-page-scope`) : le panneau devenait « actif » mais restait invisible.
Rien ne se passait à l'écran.

Nouvelle fonction `allerAuFormulaire()` : elle teste la visibilité réelle du
panneau, pas sa simple présence dans le DOM — il existe sur toutes les pages.
Si le formulaire est affichable, on y bascule ; sinon on écrit le brouillon et
on rejoint `dossier.html`, l'état étant partagé. Utilisée par `openDossier`,
`newFlight` et le bandeau « Ouvrir le dossier », qui faisaient tous la même
erreur.

## Correctif v36.1 — TypeError au chargement

`app.js` accrochait 34 écouteurs au niveau racine sans vérifier l'existence de
l'élément :

    document.getElementById('rwyDepSel').addEventListener('change', …)

Tant que toutes les pages contenaient le formulaire complet, cela passait.
Depuis que le carnet de vol utilise la coquille commune sans embarquer les
panneaux du dossier, `rwyDepSel` n'y existe plus : TypeError à la ligne 1291,
**script interrompu au chargement**, donc menu, thème et carnet inertes.

Corrigé par un helper `on(id, evt, fn)` qui ne branche que ce qui existe, et
par le conditionnement des six appels d'initialisation du formulaire
(`toggleArrivalRunway`, `refreshWindHints`, `syncAllSurfaceLocks`,
`renderCartouche`, `refreshAlternateList`, `applyMetarEverywhere`) à la
présence de `#pageFlight`. Un accès direct à `arrRunwayIcao` a également été
protégé.

Vérifié par simulation du chargement dans deux DOM : l'un vide (page sans
formulaire), l'autre répondant à tout (page complète). Aucune erreur.

Règle pour la suite : dans `app.js`, utiliser `on(...)` plutôt que
`document.getElementById(...).addEventListener(...)`.

## v37 — Menu rétractable

Le menu occupait 234 px en permanence. Sur le carnet de vol, dont le tableau
compte seize colonnes, le contenu passait sous le menu.

Deux causes distinctes :

1. La grille `.app-shell` était déjà neutralisée par un `display:block
   !important` hérité d'un ancien correctif ; le décalage venait en réalité
   d'un `margin-left:234px !important` sur `.main-content`. Or le `<main>` du
   carnet ne porte pas cette classe : aucun décalage, d'où le chevauchement.
2. Deux règles forçaient la largeur du menu en `!important` (234 px, puis
   78 px sous 1050 px), ce qui aurait bloqué tout dépliage.

Le menu est maintenant un rail de 72 px qui se déplie à 250 px au survol. Il
est en position fixe et se déplie **par-dessus** le contenu : une expansion qui
repousserait la page ferait sauter la mise en page à chaque passage de souris.
La marge du contenu reste donc constante à 72 px.

`:focus-within` déplie aussi le menu, sinon la navigation au clavier se ferait
sur des libellés invisibles. Les libellés gardent `opacity` plutôt que
`display:none`, qui interdirait la transition et sortirait les liens du
parcours de tabulation.

Sous 761 px, rien ne change : le menu reste une barre horizontale, le survol
n'existant pas au doigt.

## v37.1 — Débordement du carnet

Le tableau du carnet porte `min-width:1250px` et vit dans `.table-wrap`, qui a
`overflow:auto`. Cela aurait dû suffire.

Le maillon fautif était `.container`. `.main-content` est en `display:flex`
(colonne), donc `.container` en est un élément flex — et un élément flex a
`min-width:auto` par défaut : il refuse de descendre sous la largeur de son
contenu. La contrainte de 1250 px remontait donc jusqu'à la page entière au
lieu d'être absorbée par le défilement du tableau.

`min-width:0` posé sur chaque maillon de la chaîne
(`main-content → container → table-card → table-wrap`) confine le défilement au
tableau seul.

Les deux grilles à colonnes fixes (`.stats` sur 6 colonnes, `.filters-grid` sur
6) passent de `1fr` à `minmax(0,1fr)` : sans cela chaque colonne conserve la
largeur de son contenu et pousse la page, même en dehors de tout tableau.


MODIFICATIONS DE CETTE VERSION
- Logo Air One Aero converti en blanc avec fond transparent.
- Logo conservé visible dans la sidebar déployée et repliée.
- Carnet de vol trié du plus récent au plus ancien.
- Le tri est réappliqué au chargement des données existantes et après les imports.


MODIFICATIONS DE CETTE VERSION
- Ajout de la colonne « Commentaire » dans la liste des vols.
- La colonne reprend les remarques/commentaires du vol.
- Boutons d'actions redimensionnés et icônes parfaitement centrées dans leurs cases.


MODIFICATIONS DE CETTE VERSION
- Bouton « Exporter EASA » réellement fonctionnel.
- Génération d'un rapport imprimable A4 paysage directement depuis les données du carnet.
- Rapport structuré en pages A/B avec 27 lignes par page, inspiré du modèle EASA-FCL fourni.
- Page de couverture avec période et totaux.
- Tri chronologique croissant pour le rapport EASA, tout en conservant l'affichage du carnet du plus récent au plus ancien.
- Les totaux sont recalculés à partir des données actuellement présentes dans le carnet.
- Le navigateur ouvre l'aperçu d'impression : choisir « Enregistrer au format PDF » pour obtenir le PDF.

ATTENTION : le rendu est une reproduction HTML imprimable du modèle fourni, pas une copie graphique pixel-perfect du PDF LogTen original.


MODIFICATION — MASSE & CENTRAGE EN TEMPS RÉEL
- Le diagramme de masse & centrage reste visible directement sous les données de masse.
- L'enveloppe est affichée même avant toute saisie.
- Les points décollage/atterrissage et les valeurs masse/CG sont recalculés automatiquement à chaque modification.
- Aucun clic sur « Calculer » n'est nécessaire pour visualiser l'effet du chargement.


MODIFICATION MENU
- Le lien de la page navigation.html est affiché comme « Vol » dans le menu latéral de toutes les pages.
- Le lien et le fonctionnement restent inchangés ; seul le libellé du menu est harmonisé.

## v40 — Page « Charger un vol »

`dossiers.html` avait été créée à partir de `notam.html` : sa liste de dossiers
était bien en place, mais l'en-tête de la page était resté celui d'origine,
« INFORMATIONS AÉRONAUTIQUES / NOTAM ». La page annonçait donc NOTAM au-dessus
d'une liste vide, d'où l'impression d'être arrivé sur la mauvaise page.

- En-tête corrigé : « MES DOSSIERS / Dossiers enregistrés ».
- Aucune entrée du menu n'était marquée active sur cette page. C'est désormais
  « Tableau de bord », d'où vient le bouton « Charger un vol ».
- Ajout d'un « Chargement des dossiers… » pendant la lecture d'IndexedDB, qui
  est asynchrone : la carte paraissait vide le temps de la réponse. Le message
  est effacé par `renderDossierList` dès l'arrivée des données, et remplacé par
  « Aucun dossier enregistré » s'il n'y en a pas.

Vérifié : `carnet-de-vol.html`, créée depuis la même page, n'a pas ce défaut —
elle n'a pas d'en-tête de site, son propre bandeau fait office de titre.
