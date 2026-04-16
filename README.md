# CyberSentinel-LLM

Plateforme de cybersécurité avec détection d'anomalies, chat LLM local et **mode vocal** (STT + TTS neural).

**Stack :** Python 3.13 · FastAPI · SQLite · scikit-learn (IForest/LOF) · Ollama · Next.js 16 · Tailwind CSS · SSE

---

## Démarrage rapide

### Prérequis
- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.com/download) installé

### Backend

```bash
cd backend

# 1. Environnement virtuel
python -m venv .venv
source .venv/bin/activate          # ou: source ./venv.sh
pip install -r requirements.txt

# 2. Variables d'environnement (optionnel)
cp .env.example .env               # puis éditer si besoin

# 3. Lancer (Ollama + modèle téléchargés automatiquement)
bash start.sh
```

```bash
curl http://localhost:8000/health  # vérification
```

> **Modes :** `APP_ENV=dev bash start.sh` (défaut, reload activé) · `APP_ENV=final bash start.sh` (production)

### Frontend

```bash
cd frontend
cp .env.example .env.local         # ajuster NEXT_PUBLIC_API_BASE si besoin
npm install
bash start.sh                      # ou: npm run dev
```

Ouvrir http://localhost:3000

### (Optionnel) GeoIP pour la carte
Télécharger `GeoLite2-City.mmdb` depuis [MaxMind](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data) (compte gratuit) et le placer dans `backend/data/GeoLite2-City.mmdb`. `start.sh` le détecte automatiquement.

---

## Fonctionnalités

| Feature | Description |
|---|---|
| **Détection d'anomalies** | IsolationForest / LOF en temps réel sur les logs réseau |
| **Chat LLM** | Conversation persistante avec `qwen2.5:1.5b` via Ollama |
| **Mode vocal** | STT (Whisper base), TTS neural (Piper `fr_FR-upmc-medium`), VAD automatique |
| **RAG** | Contexte enrichi par les alertes/incidents en base |
| **GeoIP** | Localisation des IP sur carte OSM |
| **Démo** | Génération de logs SSH/réseau simulés |
| **Défense applicative** | Blocage IP, rate limiting |

---

## Mode vocal

Le mode vocal (bouton micro dans le chat) :
1. Détecte automatiquement la fin de parole (VAD)
2. Transcrit avec **Whisper `base`** (CPU, français)
3. Génère une réponse courte avec le LLM
4. Synthétise phrase par phrase avec **Piper TTS** (voix neurale naturelle)

Les modèles se téléchargent automatiquement au premier appel.

---

## Endpoints principaux

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Santé de l'API |
| POST | `/ingest/logs` | Ingérer des logs bruts |
| GET | `/alerts` | Liste des alertes |
| GET | `/stream/alerts` | Flux SSE temps réel |
| GET/POST | `/incidents` | Gestion des incidents |
| POST | `/llm/incidents/{id}/explain` | Explication LLM d'un incident |
| GET/POST | `/llm/conversations` | Conversations persistantes |
| GET | `/llm/conversations/{id}/stream` | Stream SSE de réponse LLM |
| POST | `/llm/transcribe` | Transcription audio (Whisper) |
| POST | `/llm/tts` | Synthèse vocale (Piper) |
| GET | `/map/points` | Points géolocalisés |
| GET | `/metrics/model` | Métriques du détecteur ML |
| POST | `/validation/alerts/{id}` | Labeling humain (vrai/faux positif) |

---

## Cycle d'apprentissage adaptatif

1. Détection non supervisée (IF/LOF) → alerte
2. Création d'incident (UI)
3. Explication LLM (interprétation humaine uniquement)
4. Validation humaine : `POST /validation/alerts/{id}?label=true_attack|false_positive`
5. Réentraînement offline : `cd backend && python -m scripts.retrain_offline`
6. Redéploiement : `export SCORE_THRESHOLD=<valeur>` + redémarrage

> Le LLM n'est jamais décideur — il explique seulement.

---

## Validation avant push

```bash
# Backend tests
cd backend && ./.venv/bin/python -m pytest -q

# Frontend lint + build
cd frontend && npm run lint && npm run build

# Vérifier git (aucun artefact runtime)
git status -sb
```

---

## Dépannage

| Symptôme | Solution |
|---|---|
| API ne démarre pas | `bash backend/start.sh` gère tout (venv, Ollama, modèle) |
| GeoIP manquant | Placer `GeoLite2-City.mmdb` dans `backend/data/` |
| LLM indisponible | Vérifier `ollama serve` + `OLLAMA_MODEL=qwen2.5:1.5b` |
| Pas de son en mode vocal | Vérifier que le navigateur a la permission micro ; les modèles Piper/Whisper se téléchargent au premier appel (~150 MB) |
| "window is not defined" | Relancer `npm run dev` (composant carte chargé dynamiquement) |
