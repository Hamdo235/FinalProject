# CyberSentinel-LLM — Rapport de Projet de Fin d’Études (vivant)

Note méthodologique (évolutive): ce document est mis à jour en continu pour refléter l’état réel du projet. Les sections sont complétées au fur et à mesure des validations techniques.

---

## I. Introduction Générale

### 1.1 Contexte et justification
La surface d’attaque des systèmes d’information ne cesse de croître, portée par l’hétérogénéité des réseaux, des applications et des usages. Les équipes SOC doivent analyser des volumes importants de journaux (SSH, DNS, NetFlow, etc.) pour détecter et prioriser les menaces. Les IDS/IPS classiques fournissent des alertes techniques, mais l’analyse contextuelle, l’explicabilité et l’aide à la décision restent des points de friction. Parallèlement, les modèles de langage (LLM) ont progressé et permettent désormais de synthétiser des informations complexes et de produire des explications utiles à l’humain.

### 1.2 Objectifs du projet
CyberSentinel-LLM vise à concevoir une plateforme de cybersécurité conversationnelle, pédagogique et fonctionnelle, qui:
- centralise des événements réseau et détecte des comportements anormaux;
- génère des explications compréhensibles et actionnables via un LLM local;
- propose des actions de neutralisation simples, validées par un humain (“human-in-the-loop”);
- fournit un score de confiance et une traçabilité des décisions;
- reste légère, explicable et démontrable en soutenance (contraintes PFE).

### 1.3 Problématique et question centrale
Comment concevoir une plateforme cyberdéfensive conversationnelle exploitant le raisonnement contextuel d’un LLM tout en maintenant précision opérationnelle, robustesse et confiance mesurable dans des environnements de menace dynamiques, avec une architecture simple et reproductible?

### 1.4 Hypothèses et choix techniques
Hypothèses:
- Un pipeline minimaliste peut couvrir un fil rouge SOC: ingestion → détection d’anomalies → explication LLM → validation d’action.
- Des algorithmes d’anomalie standards (Isolation Forest, LOF) suffisent pour un MVP explicable [11][12].
- Un LLM local, exécuté via Ollama, peut produire des explications utiles sans dépendance cloud [6].

Choix techniques (validés):
- Backend: Python 3.11 + FastAPI (API REST + SSE) [1]
- Détection: scikit-learn (IsolationForest) et PyOD/LOF [2][11][12]
- Base de données: SQLite (simplicité, portabilité)
- LLM local: Ollama (modèles 3B–7B quantisés) [6]
- Frontend: Next.js + TailwindCSS + shadcn/ui [4]
- Temps réel: Server-Sent Events (SSE) [7]
- Carte OSM (react-leaflet) avec points via `/map/points` (GeoIP basique)

### 1.5 Positionnement du projet
Le projet se positionne comme une preuve de concept pédagogique d’IDS/IR conversationnel, centrée sur l’explicabilité et la validation humaine, sans outillage “enterprise” lourd. L’accent est mis sur la clarté de l’architecture, la reproductibilité locale et la démonstration fiable.

---

## Chapitre 1 : Généralités sur les systèmes de détection et de réponse aux intrusions (version initiale)

### 1.1 Présentation des IDS / IPS
Les systèmes de détection d’intrusion (IDS) surveillent les événements pour identifier des activités malveillantes ou non conformes. Les systèmes de prévention d’intrusion (IPS) peuvent, en plus, bloquer ou interrompre ces activités. Historiquement, on distingue des approches par signatures (ex.: Snort, Suricata) et des approches comportementales/anomaliques [8][9][10]. Les signatures offrent une détection précise des menaces connues, tandis que les méthodes comportementales visent les menaces inédites.

### 1.2 Limites des approches classiques
- Dépendance aux signatures et retard face aux menaces inconnues.
- Grand volume d’alertes, bruit et faux positifs (triage coûteux).
- Manque d’explicabilité “métier” pour les analystes juniors.
- Contexte opérationnel fragmenté entre différents outils.

### 1.3 Apport du machine learning et des LLM en cybersécurité
Le machine learning, via des détecteurs d’anomalies (Isolation Forest, Local Outlier Factor), permet d’identifier des comportements rares sans connaissance préalable des signatures [11][12]. Les LLM, utilisés localement, peuvent transformer des alertes techniques en explications claires, proposer des hypothèses et des actions, et améliorer l’efficacité du triage. L’intégration “human-in-the-loop” conserve le contrôle et renforce la confiance. Cette combinaison vise un meilleur rapport signal/bruit et une meilleure traçabilité des décisions [1][2][6].

Sections évolutives: ce chapitre sera enrichi lors de l’implémentation (exemples concrets, métriques, limites observées sur les données de démo).

---

## Conclusion et perspectives (brouillon — à compléter au fur et à mesure)
Une conclusion structurée sera rédigée après la mise en place du MVP (détection + explication LLM + validation) et enrichie lors des tests et de la préparation de la soutenance (métriques, limites, perspectives réalistes).

---

## Chapitre 4 : Conception, réalisation et déploiement de la plateforme (en cours)

### 4.1 Architecture globale
Architecture simple et pédagogique organisée en modules: Ingestion → Détection (heuristique initiale) → Persistance SQLite → API REST/SSE → UI Next.js. LLM local (Ollama) prévu pour explication des incidents. Les décisions restent validées par l’humain.

### 4.2 Backend (détection ML, API, SSE)
- Base FastAPI opérationnelle avec endpoints: `/health`, `/ingest/logs`, `/alerts`, `/incidents` (création d’incident à partir d’alertes), et flux SSE `/stream/alerts`.
- Persistance: SQLite via SQLModel/SQLAlchemy (tables: `alerts`, `incidents`).
- Détection (v0.2): intégration d’une IsolationForest (scikit‑learn) avec extraction de features simples (type source, statut échec, heure, fréquence d’échecs IP sur 60 min). Repli heuristique si pas assez de données d’entraînement. Le score [0..1] est mappé à une sévérité (low/medium/high). LOF reste planifié [2][11][12].
- SSE: publication d’événements `alert.created` côté serveur pour la mise à jour en temps réel de l’UI [7].

### 4.3 Frontend (visualisation, carte, incidents)
- Next.js opérationnel. Navbar simple (Accueil | Alerts | Demo).
- Alerts (/alerts): liste des alertes (SSE côté backend prêt), sélection et création d’incident.
- Incident (/incidents/{id}): détail + bouton “Demander explication LLM” (stub actif; Ollama activable) [6].
- Demo (/demo): carte monde (react-leaflet + OSM) affichant les IP enrichies; boutons “Générer logs” et “Reset” pour scénariser la démo.
- UI minimale, claire, orientée soutenance (statuts, scores, navigation).

### 4.4 Intégration du LLM (explication, aide à la décision)
- Choix arrêté: Ollama (local). Service d’explication implémenté (endpoint: `POST /llm/incidents/{id}/explain`) avec traçage (`llm_traces`) et mise à jour du champ `confidence` de l’incident. Les prompts incluent consignes d’explicabilité et un score de confiance borné [6].

### 4.5 Mode démonstration
- Génération: endpoint `POST /demo/generate` (ajoute plusieurs événements SSH, avec enrichissement GeoIP best-effort si la base GeoLite2 est fournie) [14].
- Reset: endpoint `POST /demo/reset` (réinitialise alerts/incidents/llm_traces/enrichissements).
- Carte: `GET /map/points` renvoie les points (ip, country, lat, lon, count) affichés sur /demo.
- Fil rouge démontré: génération → détection heuristique (score) → alertes → création d’incident → explication LLM (stub, Ollama activable) → visualisation géographique.
- État réel: détection ML (IsolationForest/LOF) et inférence LLM réelle via Ollama planifiées à l’étape suivante; la version actuelle utilise une heuristique simple et un stub LLM pour garantir une démo fiable.

Note: Cette section sera enrichie à chaque incrément (modèles IF/LOF, GeoIP, UI en temps réel, et évaluation).

---

## Guide de la plateforme (pages UI)

Objectif: permettre à une personne externe de comprendre rapidement chaque page, ce qu’elle affiche, et quelles données l’alimentent.

### Page Accueil (/)
- But: page d’entrée et de navigation.
- Contenu: présentation rapide + accès aux pages clés.

### Page Dashboard (/dashboard)
- But: vue d’ensemble “SOC-like” en temps réel.
- Données (sources):
  - Alertes: `GET /alerts`
  - Incidents: `GET /incidents` (liste) et/ou agrégations côté UI
  - Flux temps réel: `GET /stream/alerts` (SSE)
  - Carte: `GET /map/points`
  - Métriques modèle: `GET /metrics/model`
- Contenu (interprétation):
  - Cartes KPI: nombre d’alertes, alertes critiques, incidents ouverts, métriques de performance.
  - Graphiques: tendances temporelles (timeline) et répartition par sévérité.
  - Carte GeoIP: localisation approximative des IP (best-effort). Les filtres de sévérité permettent de ne visualiser qu’un sous-ensemble.

### Page Alertes (/alerts)
- But: liste opérationnelle des alertes détectées.
- Données: `GET /alerts` + mises à jour `GET /stream/alerts`.
- Actions: sélection d’alertes + création d’un incident (via `POST /incidents/from-alerts`).
- Remarque: les alertes peuvent être labellisées (vrai/faux positif) afin d’alimenter les métriques de qualité sur la page Modèle.

### Page Incidents (/incidents)
- But: regrouper et suivre les incidents (traitement humain).
- Données: `GET /incidents`.
- Contenu: cartes/liste d’incidents, statut (open/closed), confiance.

### Détail Incident (/incidents/{id})
- But: comprendre un incident et demander une explication.
- Données:
  - Détail: `GET /incidents/{id}`
  - Explication LLM: `POST /llm/incidents/{id}/explain`
- Interprétation: le texte LLM est explicatif (jamais une action automatique), accompagné d’un score de confiance.

### Page Démo (/demo)
- But: scénariser une soutenance (générer des logs et voir l’impact).
- Actions:
  - Générer des événements: `POST /demo/generate`
  - Reset de l’état: `POST /demo/reset`
- Données: `GET /map/points` pour la carte, et `GET /alerts` pour la liste.

### Page Modèle ML (/model)
- But: page pédagogique montrant l’état du module de détection et de ses métriques.
- Données: `GET /metrics/model`.
- Pourquoi certaines valeurs peuvent être “N/A”:
  - Les métriques (F1, précision, rappel) nécessitent des alertes labellisées (vrai/faux positif).
  - Tant que l’utilisateur n’a pas réalisé ce labellisation, la plateforme ne peut pas calculer une performance supervisée → valeurs affichées en N/A.
- Champs:
  - Modèle actif: renseigné via variable d’environnement (ex.: iforest/lof/hybrid) ou “heuristique” par défaut.
  - Seuil courant: valeur de seuil de score (si exposée par le backend).
  - Échantillons: nombre d’exemples considérés.
  - Labellisés: positifs + négatifs disponibles pour calculer des métriques.

### Page Chat (/chat)
- But: interface conversationnelle avec le LLM (aide à l’analyse).
- Remarque: le chat n’exécute pas d’actions automatiquement; il sert à expliquer, résumer et guider l’analyste.

---

## Références bibliographiques
[1] Sebastián Ramírez (tiangolo), FastAPI Documentation, 2018–, https://fastapi.tiangolo.com/

[2] Scikit-learn Developers, scikit-learn: Machine Learning in Python (Documentation), 2007–, https://scikit-learn.org/

[3] SQLAlchemy Authors, SQLAlchemy 2.x Documentation, https://docs.sqlalchemy.org/

[4] Vercel, Next.js Documentation, https://nextjs.org/docs

[5] Tailwind Labs, Tailwind CSS Documentation, https://tailwindcss.com/docs

[6] Ollama, Ollama Documentation, https://ollama.com/

[7] MDN Web Docs, Server-Sent Events (SSE), https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events

[8] Dorothy E. Denning, An Intrusion-Detection Model, IEEE Transactions on Software Engineering, 1987, https://doi.org/10.1109/TSE.1987.232894

[9] Snort Project, Snort IDS, https://www.snort.org/

[10] OISF, Suricata IDS/IPS/NSM, https://suricata.io/

[11] Breunig, M.M., Kriegel, H.-P., Ng, R.T., Sander, J., LOF: Identifying Density-Based Local Outliers, ACM SIGMOD, 2000, https://doi.org/10.1145/342009.335388

[12] Liu, F.T., Ting, K.M., Zhou, Z.-H., Isolation Forest, IEEE ICDM, 2008, https://doi.org/10.1109/ICDM.2008.17

[13] MITRE, ATT&CK Framework, https://attack.mitre.org/

[14] MaxMind, GeoLite2 Databases, https://dev.maxmind.com/geoip/geolite2-free-geolocation-data

[15] Leaflet, Leaflet Documentation, https://leafletjs.com/

[16] React-Leaflet, React-Leaflet Documentation, https://react-leaflet.js.org/
