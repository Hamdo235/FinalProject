#!/usr/bin/env python3
"""
Télécharge les techniques MITRE ATT&CK Enterprise depuis GitHub
et génère backend/data/mitre_techniques.json pour le service RAG.

Usage :
    python scripts/fetch_mitre.py
    python scripts/fetch_mitre.py --force   # re-télécharge même si le fichier existe déjà
"""
import json
import os
import sys
import urllib.request
import urllib.error
import argparse

STIX_URL = (
    "https://raw.githubusercontent.com/mitre/cti/master/"
    "enterprise-attack/enterprise-attack.json"
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_PATH = os.path.abspath(os.path.join(DATA_DIR, "mitre_techniques.json"))

# Sévérité estimée par tactique MITRE
_TACTIC_SEVERITY = {
    "reconnaissance":      "low",
    "resource-development":"low",
    "initial-access":      "high",
    "execution":           "high",
    "persistence":         "medium",
    "privilege-escalation":"high",
    "defense-evasion":     "high",
    "credential-access":   "high",
    "discovery":           "medium",
    "lateral-movement":    "high",
    "collection":          "medium",
    "command-and-control": "high",
    "exfiltration":        "high",
    "impact":              "high",
}

# Mitigation générique par tactique (en français)
_TACTIC_MITIGATION = {
    "reconnaissance":
        "Réduire la surface d'exposition publique, surveiller les scans entrants, utiliser des honeypots.",
    "resource-development":
        "Threat intelligence, surveiller l'usurpation de domaines et la création d'infrastructures malveillantes.",
    "initial-access":
        "MFA sur tous les points d'entrée, principe du moindre privilège, segmentation réseau, patcher régulièrement.",
    "execution":
        "Whitelisting applicatif, politique d'exécution restrictive, monitoring des processus suspects.",
    "persistence":
        "Surveiller les modifications de démarrage, tâches planifiées, services système et clés de registre.",
    "privilege-escalation":
        "Restreindre les droits sudo, surveiller les élévations de privilèges, appliquer les correctifs de sécurité.",
    "defense-evasion":
        "SIEM avec détection d'anomalies, intégrité des fichiers de logs, EDR résistant à la manipulation.",
    "credential-access":
        "MFA, coffre-fort de mots de passe, rotation des secrets, détecter les accès inhabituels aux credentials.",
    "discovery":
        "Segmentation réseau, honeypots, surveiller les scans et requêtes de découverte internes.",
    "lateral-movement":
        "Zero Trust, micro-segmentation, surveiller les connexions inter-hôtes inhabituelles.",
    "collection":
        "DLP, chiffrement des données sensibles, surveiller les accès inhabituels aux fichiers critiques.",
    "command-and-control":
        "Proxy web avec inspection TLS, filtrage DNS, threat intelligence sur les domaines C2 connus.",
    "exfiltration":
        "DLP, limiter les protocoles sortants, surveiller les volumes de transfert inhabituels.",
    "impact":
        "Sauvegardes hors-ligne régulières, plans de reprise, surveiller les suppressions et chiffrements massifs.",
}


def _get_technique_id(obj: dict) -> str | None:
    for ref in obj.get("external_references", []):
        if ref.get("source_name") == "mitre-attack":
            eid = ref.get("external_id", "")
            if eid.startswith("T"):
                return eid
    return None


def _get_tactic(obj: dict) -> str:
    for phase in obj.get("kill_chain_phases", []):
        if phase.get("kill_chain_name") == "mitre-attack":
            return phase.get("phase_name", "unknown")
    return "unknown"


def _clean(text: str, max_len: int) -> str:
    if not text:
        return ""
    text = " ".join(text.split())
    return text[:max_len] + ("…" if len(text) > max_len else "")


def parse_techniques(stix_bundle: dict) -> list[dict]:
    techniques = []
    seen_ids: set[str] = set()

    for obj in stix_bundle.get("objects", []):
        if obj.get("type") != "attack-pattern":
            continue
        if obj.get("revoked") or obj.get("x_mitre_deprecated"):
            continue

        tid = _get_technique_id(obj)
        if not tid or tid in seen_ids:
            continue
        seen_ids.add(tid)

        tactic = _get_tactic(obj)
        detection_raw = obj.get("x_mitre_detection") or ""
        description_raw = obj.get("description") or ""

        techniques.append({
            "id":          tid,
            "name":        obj.get("name", ""),
            "description": _clean(description_raw, 600),
            "detection":   _clean(detection_raw, 500) or
                           "Surveiller les comportements anormaux associés à cette technique.",
            "mitigation":  _TACTIC_MITIGATION.get(
                               tactic,
                               "Appliquer les bonnes pratiques de sécurité, surveiller les comportements anormaux."
                           ),
            "severity":    _TACTIC_SEVERITY.get(tactic, "medium"),
            "tactic":      tactic,
        })

    techniques.sort(key=lambda t: t["id"])
    return techniques


def main() -> None:
    parser = argparse.ArgumentParser(description="Télécharge les techniques MITRE ATT&CK.")
    parser.add_argument("--force", action="store_true",
                        help="Re-télécharge même si le fichier existe déjà.")
    args = parser.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)

    if os.path.exists(OUTPUT_PATH) and not args.force:
        with open(OUTPUT_PATH, encoding="utf-8") as f:
            existing = json.load(f)
        print(f"[fetch_mitre] Fichier existant : {len(existing)} techniques dans {OUTPUT_PATH}")
        print("[fetch_mitre] Utilisez --force pour re-télécharger.")
        sys.exit(0)

    print(f"[fetch_mitre] Téléchargement depuis {STIX_URL} …")
    try:
        with urllib.request.urlopen(STIX_URL, timeout=60) as resp:
            raw = resp.read()
    except urllib.error.URLError as exc:
        print(f"[fetch_mitre] ERREUR réseau : {exc}")
        sys.exit(1)

    print("[fetch_mitre] Parsing du bundle STIX…")
    bundle = json.loads(raw)
    techniques = parse_techniques(bundle)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(techniques, f, ensure_ascii=False, indent=2)

    print(f"[fetch_mitre] {len(techniques)} techniques sauvegardées → {OUTPUT_PATH}")
    print("[fetch_mitre] Redémarre le backend pour re-indexer ChromaDB automatiquement.")


if __name__ == "__main__":
    main()
