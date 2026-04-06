"""
Service RAG (Retrieval-Augmented Generation) basé sur ChromaDB + sentence-transformers.
Indexe une base MITRE ATT&CK simplifiée localement. CPU-only, ~384 MB RAM.
"""
import os
import logging
from threading import Lock
from typing import List, Dict
from ..core.settings import settings

logger = logging.getLogger(__name__)

# --- Chemin persistance ChromaDB ---
CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "chroma_db")
CHROMA_PERSIST_DIR = os.path.abspath(CHROMA_PERSIST_DIR)
COLLECTION_NAME = "mitre_attack"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# --- Flag d'initialisation (évite double init simultanée) ---
_is_initialized: bool = False

# --- Singletons ---
_collection = None
_embed_fn = None
_init_lock = Lock()

# --- Base MITRE ATT&CK simplifiée ---
MITRE_TECHNIQUES: List[Dict] = [
    {
        "id": "T1110.001",
        "name": "Password Guessing",
        "description": "L'attaquant tente de deviner les mots de passe de comptes valides par force brute, en essayant systématiquement des combinaisons via SSH, RDP ou autres services d'authentification.",
        "detection": "Surveiller les tentatives de connexion échouées répétées sur un même compte ou depuis une même IP. Alerter si plus de 5 échecs en moins de 60 secondes.",
        "mitigation": "Activer le verrouillage de compte après N échecs, utiliser MFA, bloquer les IP sources via fail2ban.",
        "severity": "high",
    },
    {
        "id": "T1110.003",
        "name": "Password Spraying",
        "description": "L'attaquant utilise un petit nombre de mots de passe communs contre un grand nombre de comptes pour éviter le verrouillage. Technique discrète car peu de tentatives par compte.",
        "detection": "Surveiller les échecs d'authentification distribués sur plusieurs comptes depuis une même source. Corréler les tentatives sur différents services.",
        "mitigation": "Politique de mots de passe complexes, MFA obligatoire, détection comportementale sur les authentifications.",
        "severity": "high",
    },
    {
        "id": "T1078",
        "name": "Valid Accounts",
        "description": "L'attaquant utilise des identifiants légitimes compromis (phishing, vol, achat) pour accéder aux systèmes sans déclencher d'alertes d'authentification.",
        "detection": "Analyser les anomalies comportementales : connexions depuis des géolocalisations inhabituelles, horaires atypiques, accès à des ressources inhabituelles.",
        "mitigation": "MFA, surveillance des comportements utilisateurs (UEBA), rotation régulière des mots de passe, audits des accès.",
        "severity": "high",
    },
    {
        "id": "T1021.004",
        "name": "SSH Remote Services",
        "description": "L'attaquant utilise SSH pour se déplacer latéralement entre machines internes après avoir obtenu un premier accès, en réutilisant des clés SSH ou des identifiants volés.",
        "detection": "Surveiller les connexions SSH entre machines internes, particulièrement depuis des serveurs qui ne font pas habituellement de SSH sortant.",
        "mitigation": "Restreindre SSH aux seuls hôtes nécessaires, utiliser des bastions SSH, désactiver l'authentification par mot de passe (clés uniquement).",
        "severity": "medium",
    },
    {
        "id": "T1059.004",
        "name": "Unix Shell",
        "description": "L'attaquant exécute des commandes malveillantes via un shell Unix (bash, sh, zsh) pour exécuter des scripts, télécharger des outils ou modifier la configuration système.",
        "detection": "Surveiller l'exécution de shells depuis des processus inhabituels (serveurs web, services). Logger les commandes exécutées via auditd.",
        "mitigation": "Restreindre les shells disponibles, utiliser AppArmor/SELinux, monitorer les processus enfants des services exposés.",
        "severity": "high",
    },
    {
        "id": "T1190",
        "name": "Exploit Public-Facing Application",
        "description": "L'attaquant exploite une vulnérabilité dans une application exposée sur Internet (SQL injection, RCE, buffer overflow) pour obtenir un accès initial.",
        "detection": "Surveiller les logs applicatifs pour des patterns d'exploitation (payloads malformés, réponses d'erreur inhabituelles). WAF et IDS sur les services exposés.",
        "mitigation": "Patcher régulièrement, WAF, validation stricte des entrées, segmentation réseau pour limiter l'impact post-exploitation.",
        "severity": "high",
    },
    {
        "id": "T1046",
        "name": "Network Service Discovery",
        "description": "L'attaquant scanne le réseau pour découvrir les services actifs, les ports ouverts et les versions logicielles afin de cartographier l'infrastructure cible.",
        "detection": "Détecter les scans de ports (nombreuses connexions vers différents ports en peu de temps). Alerter sur les outils comme nmap, masscan.",
        "mitigation": "Segmentation réseau, firewall restrictif, IDS avec détection de scans, honeypots pour détecter la reconnaissance.",
        "severity": "medium",
    },
    {
        "id": "T1595.001",
        "name": "Scanning IP Blocks",
        "description": "L'attaquant effectue une reconnaissance active en scannant des plages d'adresses IP entières pour identifier les hôtes actifs avant de cibler des victimes spécifiques.",
        "detection": "Surveiller les connexions entrantes depuis des sources qui tentent de joindre de nombreuses adresses. Analyser les logs firewall pour des patterns de scan.",
        "mitigation": "Bloquer les IP sources malveillantes via threat intelligence, limiter la surface d'exposition réseau.",
        "severity": "low",
    },
    {
        "id": "T1133",
        "name": "External Remote Services",
        "description": "L'attaquant exploite des services d'accès distant légitimes (VPN, RDP, Citrix) pour maintenir un accès persistant ou obtenir un accès initial.",
        "detection": "Surveiller les connexions VPN/RDP depuis des géolocalisations inhabituelles ou des horaires atypiques. Alerter sur les nouveaux appareils.",
        "mitigation": "MFA sur tous les accès distants, journalisation complète, politique de accès minimum, revue régulière des accès autorisés.",
        "severity": "high",
    },
    {
        "id": "T1071.001",
        "name": "Web Protocols",
        "description": "L'attaquant utilise HTTP/HTTPS pour les communications C2 (Command & Control), dissimulant le trafic malveillant dans le trafic web légitime.",
        "detection": "Analyser les patterns de trafic HTTP (beaconing régulier, user-agents inhabituels, communications vers des domaines récemment créés).",
        "mitigation": "Proxy web avec inspection TLS, filtrage DNS, threat intelligence sur les domaines C2 connus.",
        "severity": "high",
    },
    {
        "id": "T1048",
        "name": "Exfiltration Over Alternative Protocol",
        "description": "L'attaquant exfiltre des données via des protocoles alternatifs (DNS, ICMP, FTP) pour contourner les contrôles focalisés sur HTTP/HTTPS.",
        "detection": "Surveiller les volumes inhabituels de trafic DNS, ICMP ou FTP sortant. Alerter sur les requêtes DNS avec des sous-domaines de grande taille (DNS tunneling).",
        "mitigation": "Filtrage et inspection du trafic DNS, bloquer les protocoles non nécessaires en sortie, DLP sur les données sensibles.",
        "severity": "high",
    },
    {
        "id": "T1098",
        "name": "Account Manipulation",
        "description": "L'attaquant modifie des comptes existants pour maintenir l'accès ou escalader les privilèges : ajout de clés SSH, modification des groupes, changement de mots de passe.",
        "detection": "Surveiller les modifications de comptes (sudo, /etc/passwd, authorized_keys). Alerter sur les ajouts de groupes privilégiés.",
        "mitigation": "Journalisation des modifications de comptes, alertes en temps réel, revue régulière des accès privilégiés.",
        "severity": "high",
    },
    {
        "id": "T1136",
        "name": "Create Account",
        "description": "L'attaquant crée des comptes locaux ou de domaine pour maintenir un accès persistant, souvent avec des noms qui imitent des comptes légitimes.",
        "detection": "Surveiller la création de nouveaux comptes, particulièrement en dehors des procédures normales et des heures ouvrées.",
        "mitigation": "Alertes automatiques sur toute création de compte, processus d'approbation strict, audit régulier des comptes actifs.",
        "severity": "medium",
    },
    {
        "id": "T1070.003",
        "name": "Clear Command History",
        "description": "L'attaquant efface l'historique des commandes (bash_history, logs) pour couvrir ses traces et rendre la forensique plus difficile.",
        "detection": "Surveiller les commandes history -c, la suppression de ~/.bash_history, ou la modification de HISTFILE. Utiliser auditd pour logguer toutes les commandes.",
        "mitigation": "Centraliser les logs vers un SIEM distant, utiliser auditd avec règles immuables, configurer HISTFILE vers /dev/null est une anomalie à alerter.",
        "severity": "medium",
    },
    {
        "id": "T1562.001",
        "name": "Disable Security Tools",
        "description": "L'attaquant désactive ou modifie les outils de sécurité (antivirus, EDR, firewall, IDS) pour éviter la détection de ses activités malveillantes.",
        "detection": "Surveiller l'arrêt de services de sécurité (iptables, auditd, fail2ban). Alerter sur toute modification de la configuration du pare-feu.",
        "mitigation": "Protéger les processus de sécurité contre l'arrêt non autorisé, utiliser des agents EDR avec auto-protection, alertes en temps réel.",
        "severity": "high",
    },
]


def _build_document(t: Dict) -> str:
    """Construit le texte d'embedding pour une technique MITRE."""
    return (
        f"{t['id']} {t['name']}. "
        f"{t['description']} "
        f"Détection: {t['detection']} "
        f"Mitigation: {t['mitigation']}"
    )


def initialize() -> None:
    """
    Initialise ChromaDB et indexe les techniques MITRE ATT&CK.
    Appel idempotent : ne réindexe pas si la collection existe déjà.
    Ne doit PAS être appelé en même temps qu'une inférence Ollama.
    """
    global _is_initialized, _collection, _embed_fn

    with _init_lock:
        if _is_initialized:
            return

        logger.info("[RAG] Initialisation du service RAG...")

        try:
            import chromadb
            from chromadb.utils import embedding_functions

            # Embedding function (sentence-transformers, CPU-only)
            _embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=EMBEDDING_MODEL,
                device="cpu",
            )

            # Client ChromaDB persistant
            client = chromadb.PersistentClient(
                path=CHROMA_PERSIST_DIR,
                settings=chromadb.Settings(anonymized_telemetry=False),
            )

            # Récupérer ou créer la collection
            _collection = client.get_or_create_collection(
                name=COLLECTION_NAME,
                embedding_function=_embed_fn,
                metadata={"hnsw:space": "cosine"},
            )

            # Indexer seulement si la collection est vide
            if _collection.count() == 0:
                logger.info("[RAG] Indexation de %d techniques MITRE ATT&CK...", len(MITRE_TECHNIQUES))
                documents = [_build_document(t) for t in MITRE_TECHNIQUES]
                ids = [t["id"] for t in MITRE_TECHNIQUES]
                metadatas = [
                    {
                        "id": t["id"],
                        "name": t["name"],
                        "detection": t["detection"],
                        "mitigation": t["mitigation"],
                        "severity": t["severity"],
                    }
                    for t in MITRE_TECHNIQUES
                ]
                _collection.add(documents=documents, ids=ids, metadatas=metadatas)
                logger.info("[RAG] Indexation terminée (%d techniques).", len(MITRE_TECHNIQUES))
            else:
                logger.info("[RAG] Collection existante (%d documents). Pas de réindexation.", _collection.count())

            _is_initialized = True
            logger.info("[RAG] Service RAG prêt.")

        except Exception as exc:
            logger.error("[RAG] Échec de l'initialisation : %s", exc)
            # Ne pas crasher le démarrage — le service fonctionnera en mode dégradé
            _is_initialized = False


def _maybe_lazy_initialize() -> None:
    if not settings.rag_enabled:
        return
    if settings.rag_init_mode.strip().lower() != "lazy":
        return
    if _is_initialized:
        return
    initialize()


def retrieve_context(alert_text: str, k: int = 3) -> str:
    """
    Recherche sémantique dans ChromaDB.
    Retourne les k techniques MITRE les plus pertinentes formatées en texte.
    """
    _maybe_lazy_initialize()
    if not _is_initialized or _collection is None:
        return "Contexte MITRE ATT&CK non disponible (RAG non initialisé)."

    try:
        results = _collection.query(
            query_texts=[alert_text],
            n_results=min(k, _collection.count()),
            include=["documents", "metadatas", "distances"],
        )

        lines = []
        metadatas = results.get("metadatas", [[]])[0]
        documents = results.get("documents", [[]])[0]

        for i, (meta, doc) in enumerate(zip(metadatas, documents), start=1):
            lines.append(
                f"Technique MITRE pertinente {i}: {meta['id']} - {meta['name']}\n"
                f"Description: {doc}\n"
                f"Détection: {meta['detection']}\n"
                f"Mitigation: {meta['mitigation']}\n"
                f"Sévérité: {meta['severity']}"
            )

        return "\n---\n".join(lines) if lines else "Aucune technique MITRE trouvée."

    except Exception as exc:
        logger.error("[RAG] Erreur retrieve_context : %s", exc)
        return "Erreur lors de la récupération du contexte MITRE."


def get_rag_relevance_score(alert_text: str) -> float:
    """
    Retourne le score de similarité cosinus de la meilleure correspondance.
    ChromaDB retourne des distances cosinus [0, 2] → on convertit en similarité [0, 1].
    """
    _maybe_lazy_initialize()
    if not _is_initialized or _collection is None:
        return 0.0

    try:
        results = _collection.query(
            query_texts=[alert_text],
            n_results=1,
            include=["distances"],
        )
        distances = results.get("distances", [[]])[0]
        if not distances:
            return 0.0
        # distance cosinus ∈ [0, 2] → similarité = 1 - (distance / 2)
        similarity = max(0.0, min(1.0, 1.0 - (distances[0] / 2.0)))
        return round(similarity, 4)

    except Exception as exc:
        logger.error("[RAG] Erreur get_rag_relevance_score : %s", exc)
        return 0.0
