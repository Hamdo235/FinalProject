NB : C'est pas le template que j'ai demandé. Tout de même, cherche un template de PFE de l'université de Sorbonne et tu le synchronise dans ton repositories. 

# Plan du Projet
## CyberSentinel-LLM


## I. Introduction Générale

### 1.1 Contexte et justification
Avec l’augmentation constante des attaques informatiques, les administrateurs réseau sont confrontés à un volume important d’alertes techniques souvent difficiles à interpréter. Les systèmes classiques de détection d’intrusion produisent des logs complexes qui nécessitent une expertise avancée pour être compris. Ce projet vise à répondre à ce problème en proposant une plateforme d’assistance intelligente à la décision en cybersécurité.

### 1.2 Objectif du projet
L’objectif principal est de concevoir une plateforme capable de détecter des comportements anormaux dans des logs réseau, de les visualiser, puis de les expliquer en langage naturel afin d’aider l’administrateur à comprendre et analyser les incidents de sécurité.

### 1.3 Problématique
Comment exploiter l’intelligence artificielle pour détecter des anomalies réseau et rendre les alertes de sécurité compréhensibles pour un administrateur, tout en conservant l’humain comme décideur final ?

### 1.4 Hypothèses de la recherche
- Un modèle de machine learning non supervisé permet de détecter des comportements anormaux sans dépendre d’un dataset labellisé.
- Un modèle de langage peut améliorer la compréhension des alertes en fournissant des explications textuelles.
- Une interaction humaine est nécessaire pour garantir la fiabilité et la sécurité des décisions.

### 1.5 Positionnement du projet
Le projet se positionne comme une plateforme d’aide à la décision en cybersécurité, et non comme un système de protection automatique. Il combine détection, explicabilité et validation humaine.



## Chapitre 1 : Généralités sur la cybersécurité et les systèmes IDS/IPS

- Notions de cybersécurité
- Attaques réseau courantes
- Systèmes IDS et IPS
- Limites des approches traditionnelles
- Place de l’intelligence artificielle en cybersécurité



## Chapitre 2 : Étude de l’existant

- Présentation des outils IDS/IPS classiques
- Solutions de détection basées sur les signatures
- Solutions basées sur le machine learning
- Limites des solutions existantes
- Apports des modèles de langage (LLM) dans l’analyse de sécurité



## Chapitre 3 : Outils et technologies utilisés

- FastAPI pour le backend
- SQLite pour la persistance des données
- Machine Learning non supervisé (Isolation Forest, LOF)
- LLM local via Ollama
- GeoLite2 pour la géolocalisation IP
- Next.js et TailwindCSS pour le frontend
- SSE pour le temps réel



## Chapitre 4 : Conception et réalisation de la plateforme CyberSentinel-LLM

- Architecture globale du système
- Description du backend (API, endpoints, base de données)
- Processus de détection et de génération d’alertes
- Rôle du machine learning non supervisé
- Rôle du LLM dans l’explication et l’assistance
- Interface utilisateur et visualisation
- Mode démonstration et simulation contrôlée



## Chapitre 5 : Tests, démonstration et résultats

- Scénarios de démonstration
- Détection des anomalies simulées
- Visualisation des alertes et incidents
- Explications générées par le LLM
- Limites observées



## Conclusion et perspectives

- Bilan du projet
- Apports de la plateforme
- Limites actuelles
- Perspectives d’amélioration (modèle supervisé, intégration de nouvelles sources de logs, enrichissement de la démo)


## Annexe technique — État actuel (mise à jour 12/02/2026)

### Améliorations récentes (alignées code)
- SSE multi-clients (broadcast) : passage d’une queue unique à un fan-out par subscriber.
- SSE payload enrichi : l’event `alert.created` transporte `data` (alerte complète) pour éviter un refetch lourd côté frontend.
- Frontend SSE : support de `alert.created` + compatibilité `alert_created` si besoin.
- Carte GeoIP : endpoint `/map/points` optimisé en une requête (`JOIN + GROUP BY`) pour éviter le N+1.
- Démo : bouton “Stop” côté UI ne relance plus `/demo/generate` (la démo backend est one‑shot).
- Types API frontend : alignement des retours `demoGenerate` et `demoReset`.
- Badge LIVE sur `/alerts` : activation à la réception SSE.

### Points d’attention (toujours vrais)
- ML volontairement simple et orienté démo.
- Dépendance Ollama (LLM local) et modèle installé.
- GeoIP best‑effort (nécessite `GEOLITE2_CITY_DB`).
