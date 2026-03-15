# CyberSentinel-LLM (PFE)

Stack: Python 3.11 (FastAPI), SQLite, scikit-learn (IF/LOF à venir), LLM local (Ollama), Next.js + Tailwind + react-leaflet, SSE, OSM.

## Quickstart

### Backend
1) Installer dépendances
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
Astuce: vous pouvez aussi activer rapidement la venv via:
```bash
source ./backend/venv.sh
```

2) (Option) GeoIP pour la carte
- Télécharger GeoLite2-City.mmdb (compte MaxMind gratuit)
- Placer le fichier dans `backend/data/GeoLite2-City.mmdb`
- `backend/start.sh` l'auto-détecte et exporte `GEOLITE2_CITY_DB` automatiquement.
- Sinon, vous pouvez exporter manuellement:
```bash
export GEOLITE2_CITY_DB=/chemin/absolu/vers/GeoLite2-City.mmdb
```
3) Lancer l’API (avec Ollama intégré automatiquement)
```bash
bash backend/start.sh
```
Notes:
- Le script démarre Ollama s’il n’est pas lancé et télécharge le modèle si nécessaire.
- Variables optionnelles avant lancement: `export OLLAMA_MODEL=llama3.2` et `export OLLAMA_BASE_URL=http://localhost:11434`.
4) Vérifier
```bash
curl http://localhost:8000/health
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Ouvrir http://localhost:3000

### Démo
- Page: http://localhost:3000/demo
- Boutons: Générer logs, Reset
- Carte affiche les points depuis `/map/points` (GeoIP best-effort)

### Pages utiles
- Alerts: http://localhost:3000/alerts (sélection → créer incident)
- Incident: http://localhost:3000/incidents/{id} (explication LLM)

### LLM réel (optionnel)
- Installer/lancer Ollama: https://ollama.com/download (start.sh le gère automatiquement s’il est présent)
- Télécharger un modèle léger: `ollama pull llama3.2` (start.sh le télécharge si absent)
- Variables optionnelles avant lancement (prises en compte par `bash backend/start.sh`):
```bash
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=llama3.2
```

## Endpoints principaux
- `GET /health`
- `POST /ingest/logs`
- `GET /alerts`
- `GET /incidents/{id}`
- `POST /incidents/from-alerts`
- `POST /llm/incidents/{id}/explain`
- `GET /stream/alerts` (SSE)
- `GET /map/points`
- `POST /demo/generate`, `POST /demo/reset`

## Dépannage
- L’API ne démarre pas → utiliser le point d’entrée unique: `bash backend/start.sh` (gère env Python, Ollama et modèle).
- GeoIP vide → vérifier le message de démarrage (`GeoIP enabled`) et le fichier `backend/data/GeoLite2-City.mmdb`.
- Erreur “window is not defined” → le composant carte est chargé dynamiquement; relancer `npm run dev` si nécessaire.
- LLM indisponible → installer/activer Ollama ou définir `OLLAMA_BASE_URL` et `OLLAMA_MODEL` avant `bash backend/start.sh`.

## État actuel
- Détection: heuristique simple (IF/LOF planifié)
- LLM: local via Ollama (avec fallback si indisponible)
- UI: Alerts/Incident/Demo fonctionnelles, carte OSM

## Structure documentaire
- Les documents de planification ont été regroupés dans `docs/planning/`.

## Cycle d’apprentissage adaptatif (contrôlé)

Objectif: démontrer un apprentissage progressif et contrôlé, pas une IA autonome incontrôlée.

### Pipeline
1. Détection non supervisée en temps réel (IF/LOF/hybride) → détection d’inconnu
2. Création d’alerte + incident (manuel via UI)
3. Explication LLM (interprétation humaine, jamais décision)
4. Validation humaine (attaque réelle / faux positif)
5. Stockage des features + décision humaine (labels)
6. Réentraînement offline périodique (script dédié)
7. Redéploiement du seuil/config entraîné

### Contraintes (sécurité)
- Pas d’auto-blocage irréversible
- Pas d’apprentissage « en ligne » dangereux
- Le LLM n’est jamais décideur, il explique seulement

### Labeling humain
- Endpoint: `POST /validation/alerts/{id}?label=true_attack|false_positive`
- Voir labels: `GET /validation/alerts/{id}`

### Métriques du modèle
- Endpoint: `GET /metrics/model`
- Retourne: `threshold`, `roc_auc`, `precision`, `recall`, `f1`, `samples`, `positives`, `negatives`
- Seuil de décision: `SCORE_THRESHOLD` (défaut 0.6)

### Entraînement offline (sélection de seuil)
- Script: `cd backend && python -m scripts.retrain_offline`
- Produit `model_config.json` avec `score_threshold` recommandé.
- Redéploiement:
  - `export SCORE_THRESHOLD=<valeur_recommandée>`
  - redémarrer le service FastAPI

### Sélection du détecteur
- `DETECTOR`: `iforest` | `lof` | `hybrid`
- `SCORE_THRESHOLD`: float 0–1 (défaut 0.6)
