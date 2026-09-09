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

## v40.1 — La liste des dossiers restait vide

Le tableau de bord affichait bien la préparation enregistrée, avec le même
`#dossierList` et la même fonction `renderDossierList`. Le code et les données
étaient donc corrects : seule la page `dossiers.html` ne montrait rien.

Sa carte était placée dans `#pageHome`, dont l'affichage dépendait de trois
mécanismes concurrents : la classe `.active` posée par `goToPage`, la règle
`.page-panel{display:none}` d'`app.css`, et la feuille de portée de la page.
Une chaîne fragile pour un contenu qui n'a rien à voir avec les panneaux.

- La carte devient un enfant direct du `<main>`. La feuille de portée se réduit
  à masquer les quatre panneaux, et l'affichage de la liste ne dépend plus de
  rien d'autre.
- `initPageDossiers` remplit explicitement la liste dès que la carte est
  présente, sans passer par l'initialisation du tableau de bord.

## v41 — « Ouvrir » ne faisait rien

`openDossier` et `duplicateDossier` se terminaient encore par
`goToPage('pageFlight')`. Or le tableau de bord et `dossiers.html` masquent ce
panneau par CSS : la fonction le marquait « actif » sans qu'il devienne
visible. Le dossier était donc bien chargé — champs restaurés, pièces jointes
remises en place, bulletin rétabli — mais rien ne se voyait à l'écran.

La correction avait été faite en v36 puis perdue lors d'une régénération de
`app.js`. Les deux fonctions appellent désormais `allerAuFormulaire()`, comme
le bandeau de brouillon et `newFlight`.

`allerAuFormulaire()` teste la visibilité RÉELLE du panneau, pas sa présence
dans le DOM — il existe sur toutes les pages, c'est ce qui trompait le code
d'origine. Comportement vérifié dans les trois cas :

| situation | effet |
|---|---|
| formulaire masqué (tableau de bord, dossiers) | brouillon écrit, navigation vers `dossier.html` |
| formulaire visible (`dossier.html`) | bascule interne, pas de navigation |
| panneau absent | brouillon écrit, navigation |

L'écriture du brouillon avant navigation est indispensable : c'est elle qui
transporte le dossier restauré vers la page suivante.

## v41.1 — « Ouvrir » restait inerte

`openDossier` est asynchrone et son résultat n'était écouté nulle part :
`b.addEventListener('click', ()=>openDossier(id))`. Toute erreur dans la chaîne
rejetait une promesse sans destinataire — aucun message, aucune trace visible,
le bouton semblait simplement ne rien faire.

Trois points bloquaient potentiellement l'exécution avant la navigation :

1. **Les pièces jointes.** Trois `await` sur IndexedDB restauraient les cartes
   météo, le PIB et l'annexe. Un échec ou une écriture qui ne se résout pas
   arrêtait la fonction avant `allerAuFormulaire()`. Elles sont désormais dans
   un `try/catch` : leur échec est signalé en console sans interrompre.
2. **L'écriture du brouillon.** `writeDraft()` précède la navigation, et une
   exception l'empêchait. Protégée : mieux vaut arriver sur un formulaire
   incomplet que rester bloqué sans explication. Vérifié par simulation — avec
   un `writeDraft` qui lève, la navigation a bien lieu.
3. **Le silence.** Les deux boutons signalent maintenant leur échec dans
   `#dossierMsg`, et « Ouvrir » affiche « Ouverture… » pendant le traitement.

Si le problème persiste, le message d'erreur affiché sous la liste dira
précisément ce qui échoue.

## v42 — Bibliothèque de documents pilote

Licence, certificat médical, SEP, radiotéléphonie : ces pièces ne changent pas
d'un vol à l'autre. Les rattacher à un dossier obligerait à les réimporter à
chaque préparation. Elles vivent donc dans une bibliothèque permanente,
indépendante des dossiers.

- **Page « Dossiers enregistrés »** : carte « Mes documents pilote ». Import de
  PDF ou de photo, aperçu, renommage, suppression. Une case à cocher par
  document permet de choisir ceux qu'on joint.
- **Section Documents du dossier** : bouton « Ajouter les documents pilote ».
  Il prend les pièces cochées — toutes, si aucune sélection n'est faite depuis
  une autre page — et les joint au dossier en cours. La bibliothèque n'est pas
  modifiée : le dossier en reçoit une copie.
- **PDF imprimé** : les pages sont insérées avant l'annexe libre, sous
  l'intitulé « DOCUMENTS PILOTE ».
- **Sauvegarde** : la bibliothèque est incluse dans « Tout sauvegarder » et
  restaurée de façon additive, les documents déjà présents n'étant pas
  dupliqués. Sans cela elle aurait été la seule donnée non récupérable.

Deux clés distinctes en IndexedDB : `pilotlib` pour la bibliothèque permanente,
`pilotdoc` pour ce qui est joint au dossier en cours. Effacer le dossier ne
touche pas à la bibliothèque.

## v43 — Impression du dossier

À l'écran l'aperçu était correct, mais l'impression sortait l'application
entière : menu latéral, bandeau, formulaire de saisie.

**Deux blocs `@media print` se contredisaient.** Le premier masquait
`.wrap > *`, le second — hérité d'une couche de correctifs — contenait
`.app-shell{display:block!important}` et réaffichait donc tout ce que le
premier venait de masquer. À spécificité égale, c'est le dernier qui gagne.

Le premier bloc était de toute façon périmé : il visait la structure
`.wrap > #pageFlight`, alors qu'elle est devenue
`.wrap > .app-shell > main > #pageFlight`. Masquer `.wrap > *` revenait à
masquer `.app-shell`, donc le dossier avec.

- Bloc hérité supprimé.
- Sélecteurs refaits pour la structure actuelle : les frères sont dégagés à
  chaque niveau, seule la chaîne menant au dossier reste visible. Sont
  explicitement masqués le menu, l'en-tête, le pied, les trois autres
  panneaux, la barre d'actions, les résultats et les cartes « dernière
  minute » et « correction de chargement ».
- Le bloc d'impression est désormais **en fin de fichier**, pour l'emporter
  sur toutes les couches de correctifs accumulées.

### En-tête et pied de page du navigateur

`@page` passe de `margin:12mm` à `margin:0`, la marge étant reportée en
`padding:12mm` sur chaque page du dossier. Chrome et Firefox n'ajoutent leur
titre de document et leur URL que lorsque la marge de page n'est pas nulle :
dans la plupart des cas ces mentions disparaissent. Si elles persistent, c'est
un réglage du navigateur, hors de portée du code — dans le dialogue
d'impression, décocher « En-têtes et pieds de page ».

## v44 — Entité simulateur

Une séance de simulateur était saisie comme un vol : il fallait lui inventer
des terrains, une immatriculation, un temps de vol. Ces valeurs remontaient
ensuite dans les colonnes « aéronef » de l'export EASA, où elles n'ont rien à
faire, et gonflaient les totaux d'expérience.

Le carnet EASA ne demande que trois informations pour la colonne 11
« Synthetic training devices » : date, type d'appareillage, durée de la séance.

- **Formulaire dédié.** Choisir « Simulator » comme type d'entrée masque tout
  ce qui relève du vol — terrains, horaires, avion, équipage, temps, opérations
  — et affiche un bloc de trois champs, plus une remarque libre (LPC, OPC,
  entraînement). Liste de types courants proposée : BITD, FNPT I/II, FTD 1/2,
  FFS A à D.
- **Données propres.** À l'enregistrement, tous les champs de vol sont vidés :
  aucune donnée résiduelle ne peut remonter dans l'export.
- **Export EASA.** Les colonnes 1 à 10 restent vides pour une séance, hormis la
  date et la mention SIMULATOR avec le type d'appareillage, afin que la ligne
  reste lisible en regard de la colonne 11. Les fonctions PIC, SIC et dual sont
  neutralisées.
- **Totaux séparés.** Le temps de simulateur ne compte plus dans le temps de
  vol ni dans les totaux PIC, SIC, nuit et IFR. Vérifié : deux vols de 1 h 30
  et 2 h plus une séance de 4 h donnent 03:30 de vol et 04:00 de simulateur.
- **Tableau à l'écran.** Une séance affiche un badge SIM au lieu de
  l'immatriculation, et sa durée est marquée « sess. ».

## v44.1 — Ligne du carnet pour une séance

Les colonnes du tableau décrivent un vol : départ, arrivée, immatriculation,
SE/ME, SP/MP, PIC, SIC, nuit, IFR. Une séance de simulateur n'en remplit
aucune, elle affichait donc une file de tirets et passait inaperçue.

Elle reçoit maintenant sa propre ligne : date, puis les six colonnes de vol
fusionnées en « Séance simulateur — <type d'appareillage> », la durée dans la
colonne Total, les cinq colonnes de fonction fusionnées en « Hors temps de
vol », et la remarque. Fond légèrement teinté pour la distinguer d'un vol.

Compte de colonnes vérifié dans les deux cas : 16 pour un vol comme pour une
séance, cellules et `colspan` additionnés.

## v45 — Export EASA refait sur le modèle officiel

Référence : le carnet professionnel LogTen fourni. Une page est un double
feuillet — moitié gauche (A) pour le vol sur aéronef, moitié droite (B) pour
les conditions, les fonctions et la colonne 11.

**Le point structurant** : une séance de simulateur laisse la moitié gauche
**entièrement vide**, ni date, ni terrains, ni aéronef, et n'apparaît que dans
la colonne 11. La version précédente y inscrivait « SIMULATOR » et la date,
ce qui ne correspond pas au carnet réglementaire.

- Moitié gauche portée à 16 colonnes conformes : date, départ (lieu + heure),
  arrivée (lieu + heure), aéronef (modèle + immatriculation), single-pilot
  (SE, ME), multi-pilot, temps total, nom du PIC, décollages et atterrissages
  jour et nuit. Un vol multi-pilote ne remplit plus SE ni ME.
- Moitié droite portée à 11 colonnes : nuit, IFR, P1, P1 u/s, co-pilote, dual,
  instructeur, puis date, type et durée de séance, puis remarques.
- Bandeau des numéros de rubrique 1 à 12, comme sur le carnet officiel.
- **Trois lignes de totaux** sur chaque moitié : total de la page, total des
  pages précédentes, total général — avec report d'une page à l'autre. Les
  cases sans valeur portent « --- ».
- Largeurs de colonnes déclarées en `<colgroup>` plutôt qu'en `nth-child`,
  illisible à seize colonnes.

Vérifications : comptage des colonnes ligne par ligne (16 et 11, en-têtes avec
`rowspan` et pieds avec `colspan` compris) et contrôle des totaux sur un jeu
mêlant un vol multi-pilote, un vol single-pilote et une séance — SE 01:06,
multi 00:56, total de vol 02:02 séance exclue, session 04:00.

## v46 — Graphiques d'expérience et TAF à l'accueil

**La carte « Historique » est remplacée par des graphiques d'heures de vol**,
alimentés par le carnet. Quatre chiffres clés — total, douze derniers mois,
temps commandant de bord avec sa part, temps de nuit et simulateur —, un
histogramme des heures mois par mois sur un an, et la répartition par type
d'appareil avec les cinq premiers puis un cumul « Autres ».

Tout est dessiné en HTML et CSS, sans bibliothèque : rien à charger au
démarrage, et le rendu suit le thème clair ou sombre sans traitement
particulier. Le tableau de bord se contente de LIRE le carnet, il n'y écrit
jamais.

Les séances de simulateur sont exclues des heures de vol, avec exactement la
même règle que dans le carnet — sans quoi les deux écrans afficheraient des
totaux différents. Les durées sont acceptées en `1:30` comme en `1,5`.

La liste des dossiers reste accessible : le bouton « Charger un vol » et la
page `dossiers.html` sont inchangés.

**Le TAF s'affiche sous l'aperçu météo.** Il n'était tout simplement pas
demandé : l'appel portait `taf=false`. Une seconde requête récupère la
prévision, en tolérant son absence — une prévision manquante ne doit pas priver
de l'observation. Le TAF est présenté brut, découpé à chaque groupe de
changement (BECMG, TEMPO, FM, PROB) pour rester lisible sans être réécrit.

## v48 — Formulaire du carnet allégé

- **Équipage réduit à trois rôles** : commandant de bord, copilote, commander.
  Les quatorze autres (relief, mécanicien navigant, observateurs, chef de
  cabine, personnel de cabine, instructeur, élève) sont retirés du formulaire
  mais **conservés en base** : un import LogTen peut les contenir, et
  l'enregistrement n'écrase que les trois champs affichés. Aucune donnée n'est
  perdue.
- **Une seule ligne d'approche**, plus un bouton « + Ajouter une approche »
  jusqu'à dix. À la réouverture d'un vol, autant de lignes que d'approches
  renseignées. Liste de types courants proposée (ILS, RNP, RNAV GNSS, VOR,
  NDB, LOC, visuelle, circling). Les lignes vides ne sont plus enregistrées.
- **Distance calculée automatiquement** dès que les deux terrains sont saisis :
  orthodromie, à partir des coordonnées de la base aérodromes de PréVol.
  Contrôles : LFFI → LFRE 48 NM, LFRS → LFRE 31 NM, LFRZ → LFRE 8 NM, et 0 NM
  pour un circuit local.

  Limite assumée : un terrain absent de la base laisse le champ libre et
  affiche « terrain inconnu ». Mieux vaut une distance à saisir qu'un chiffre
  inventé. Les terrains étrangers du carnet (EDDL, LOWW, LEPA…) ne sont pas
  dans la base : les ajouter depuis la page Aérodromes les rendra calculables.

## v49 — Verdict carburant et perfs séparées

**Bloc « Calcul carburant » sous la section 03 du dossier.** Trajet, minimum
réglementaire, autonomie et marge, plus un verdict GO/NOGO chiffré : « il
manque 12,2 L pour atteindre le minimum réglementaire ». Il se met à jour
pendant la saisie, sans attendre « Calculer » — c'est la décision la plus
structurante de la préparation, elle n'a pas à être en bas de page.

Il réutilise `computeFuel()`, le calcul du dossier, et non une copie : deux
implémentations finiraient par diverger et afficher deux verdicts différents.
La page Carburant garde son propre bloc, le nouveau y est masqué.

**La feuille de résultats sépare départ et arrivée.** Tout était rangé sous le
titre de la piste de départ, atterrissage compris — trompeur dès que l'arrivée
est sur un autre terrain ou une autre piste. Deux blocs désormais :

- Départ : terrain, piste, TODA, distance de décollage, marges TODA et ASDA,
  altitude densité, écart ISA, rose des vents du départ ;
- Arrivée : terrain, piste, LDA, distance d'atterrissage, marge, altitude
  densité d'arrivée, masse à l'atterrissage, rose des vents de l'arrivée avec
  le vent d'atterrissage s'il a été saisi séparément.

Le dossier imprimé, lui, avait déjà ses deux sections.

## v49.1 — Bordures de tableau à l'impression

Les traits horizontaux des tableaux sortaient, les verticaux et le cadre
extérieur non.

Cause : les bordures étaient déclarées en `1px`. À l'impression, un pixel vaut
environ 0,26 mm. Les traits verticaux tombent alors sous le seuil de rendu de
certains moteurs PDF et disparaissent, tandis que les horizontaux survivent en
s'alignant sur une rangée de pixels — d'où l'asymétrie observée.

Les bordures du dossier sont désormais exprimées en millimètres, indépendantes
de la résolution : 0,2 mm pour les cellules, 0,35 mm pour le cadre du tableau,
0,25 mm pour les encadrés. `print-color-adjust:exact` est ajouté sur les
en-têtes et encadrés pour que leurs aplats soient imprimés et non traités comme
décor.

Les marges ne sont pas en cause : `@page` reste à zéro — c'est ce qui évite
l'en-tête et le pied de page du navigateur — et le contenu garde 12 mm de
retrait, soit 186 mm utiles sur une A4.

Le bloc d'impression a été replacé en fin de fichier : des règles ajoutées
depuis la v43 s'étaient intercalées après lui.

## v49.2 — Hauteurs de lignes du dossier imprimé

Les blocs du tableau des minima n'avaient pas tous la même hauteur : ceux qui
portaient un METAR étaient plus hauts que les blocs vides, et les lignes à
remplir à la main ne s'alignaient plus.

Même cause que les bordures de la v49.1 : les hauteurs étaient déclarées en
pixels. Un pixel ne vaut rien de fixe à l'impression, et la hauteur d'une
cellule n'est qu'un minimum — un contenu plus grand la dépasse.

Converties en millimètres : 3,6 mm pour les lignes à remplir, 6 mm pour celles
du tableau des minima, 114 mm pour le cadre des menaces, 40 mm pour l'encadré
libre. La cellule METAR passe de 6,5 pt interligne 1,35 à 6 pt interligne 1,25 :
cinq lignes occupent 13,2 mm, contre 18 mm disponibles dans le bloc. Le METAR
ne peut donc plus faire grandir son bloc.

Contrôle du balisage : les vingt-et-un tableaux du dossier ont un nombre de
colonnes constant sur toutes leurs lignes, fusions comprises.

## v50 — Schéma de centrage dans le dossier

Le diagramme d'enveloppe en direct existait déjà et fonctionnait, mais son
balisage n'était présent que sur `masse-centrage.html`. Il est repris tel quel
sous la section 02 des douze pages qui portent le formulaire.

Rien à réécrire côté logique : `refreshLiveMassBalance` s'accroche déjà aux
quinze champs concernés — avion, masses, bras de levier, carburant, temps de
vol — et `initLiveMassBalance` ne s'exécute que si la carte est présente.

Trois cas où le redessin manquait, la restauration des champs se faisant par
programme sans émettre d'événement `input` :

- après restauration du brouillon en changeant de page ;
- au changement d'avion depuis la section 01 ;
- après un effacement de section.

`renderFuelLive` souffrait des mêmes trous, corrigés en même temps.

Contrôle : sur le dossier F-GTPD du 17/09, le calcul en direct donne 800 kg et
384 mm au décollage, 777 kg et 362 mm à l'atterrissage — identiques au dossier
imprimé.
