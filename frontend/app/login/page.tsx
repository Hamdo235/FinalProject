"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Radar, Eye, EyeOff, AlertCircle, ArrowRight, Lock, User, UserPlus, Shield, Mail, Phone, Briefcase } from "lucide-react";
import { login, register } from "@/components/layout/AuthProvider";

type Mode = "signin" | "signup";
type FocusField = "user" | "pass" | "confirm" | "email" | "phone" | null;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode]           = React.useState<Mode>("signin");
  const [username, setUsername]   = React.useState("");
  const [password, setPassword]   = React.useState("");
  const [confirm,  setConfirm]    = React.useState("");
  const [email,    setEmail]      = React.useState("");
  const [phone,    setPhone]      = React.useState("");
  const [role,     setRole]       = React.useState("Analyste SOC");
  const [showPass, setShowPass]   = React.useState(false);
  const [focused,  setFocused]    = React.useState<FocusField>(null);
  const [error,    setError]      = React.useState("");
  const [loading,  setLoading]    = React.useState(false);
  const [welcome,  setWelcome]    = React.useState<string | null>(null);

  function switchMode(m: Mode) {
    setMode(m); setError("");
    setUsername(""); setPassword(""); setConfirm("");
    setEmail(""); setPhone(""); setRole("Analyste SOC");
  }

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("cs_users");
      const users = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(users) || users.length === 0) setMode("signup");
    } catch {}
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "signup") {
      if (password !== confirm) {
        setError("Les mots de passe ne correspondent pas.");
        return;
      }
      const res = register(username.trim(), password, { email, phone, role });
      if (!res.ok) { setError(res.error ?? "Erreur d'inscription."); return; }
      setWelcome(username.trim());
      setTimeout(() => router.replace("/"), 2400);
      return;
    }

    // Sign in
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    const ok = login(username.trim(), password);
    if (!ok) {
      setError("Identifiants incorrects. Vérifiez votre accès SOC.");
      setLoading(false);
      return;
    }
    setLoading(false);
    setWelcome(username.trim());
    setTimeout(() => router.replace("/"), 2400);
  }

  /* ── Welcome splash ── */
  if (welcome !== null) {
    return (
      <div className="login-root">
        <div className="login-bg-grid" />
        <div className="login-bg-glow-tl" />
        <div className="login-bg-glow-br" />
        <div className="login-welcome-splash">
          <div className="login-welcome-inner">
            <div className="login-welcome-shield">
              <Shield className="h-[38px] w-[38px] text-white" />
            </div>
            <p className="login-welcome-hi">Bonjour,</p>
            <p className="login-welcome-name">{welcome}</p>
            <p className="login-welcome-sub">Chargement du tableau de bord SOC…</p>
            <div className="login-welcome-bar">
              <div className="login-welcome-bar-fill" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isSignup = mode === "signup";

  return (
    <div className="login-root">
      {/* ── Animated background ── */}
      <div className="login-bg-grid" />
      <div className="login-bg-glow-tl" />
      <div className="login-bg-glow-br" />

      {/* ── Floating particles ── */}
      {[...Array(14)].map((_, i) => (
        <div key={i} className="login-particle" style={{
          left:              `${6 + (i * 7.1) % 90}%`,
          top:               `${5 + (i * 13.7) % 88}%`,
          animationDelay:    `${(i * 0.8) % 6}s`,
          animationDuration: `${6 + (i * 1.3) % 8}s`,
          width:             `${2 + (i % 3)}px`,
          height:            `${2 + (i % 3)}px`,
          opacity:           0.15 + (i % 4) * 0.08,
        }} />
      ))}

      <div className="login-layout">

        {/* ══════════════ LEFT — Decorative ══════════════ */}
        <div className="login-left">
          <div className="radar-wrap">
            <svg viewBox="0 0 320 320" className="radar-svg">
              {[40, 80, 120, 160].map((r) => (
                <circle key={r} cx="160" cy="160" r={r}
                  fill="none" stroke="rgba(91,138,110,0.15)" strokeWidth="1" />
              ))}
              <line x1="160" y1="0"   x2="160" y2="320" stroke="rgba(91,138,110,0.08)" strokeWidth="1" />
              <line x1="0"   y1="160" x2="320" y2="160" stroke="rgba(91,138,110,0.08)" strokeWidth="1" />
              <defs>
                <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#6FB894" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#6FB894" stopOpacity="0"    />
                </radialGradient>
                <mask id="sweepMask">
                  <path d="M160 160 L160 0 A160 160 0 0 1 317 213 Z" fill="white" />
                </mask>
              </defs>
              <circle cx="160" cy="160" r="160" fill="url(#sweepGrad)" mask="url(#sweepMask)"
                className="radar-sweep" />
              <circle cx="220" cy="100" r="3" fill="#6FB894" className="blip blip-1" />
              <circle cx="100" cy="195" r="2" fill="#6BA3C9" className="blip blip-2" />
              <circle cx="190" cy="215" r="2.5" fill="#6FB894" className="blip blip-3" />
              <circle cx="130" cy="110" r="2" fill="#E0B83A" className="blip blip-4" />
              <circle cx="160" cy="160" r="4" fill="#6FB894" style={{ filter: "drop-shadow(0 0 6px rgba(91,138,110,0.6))" }} />
            </svg>
          </div>

          <div className="login-brand">
            <h2 className="login-brand-title">
              Bienvenue sur <span>CyberSentinel‑LLM</span>
            </h2>
            <p className="login-brand-desc">
              Une solution de détection et de réponse aux intrusions réseau,
              alliant analyse comportementale avancée, raisonnement intelligent
              et réponse adaptative en temps réel.
            </p>
            <div className="login-brand-features">
              {[
                "Analyse comportementale multi-modèles",
                "Raisonnement contextuel et suggestions intelligentes",
                "Réponse adaptative avec supervision humaine",
                "Visualisation géographique des menaces actives",
              ].map((f) => (
                <div key={f} className="login-brand-feature">
                  <span className="login-brand-dot" />
                  {f}
                </div>
              ))}
            </div>
            <div className="login-brand-badge">
              <span className="dot-live" />
              Projet de Fin d&apos;Études — Master Informatique
            </div>
          </div>
        </div>

        {/* ══════════════ RIGHT — Card ══════════════ */}
        <div className="login-right">
          <div className="login-card">

            {/* Header */}
            <div className="login-card-header">
              <div className="login-logo-wrap">
                <div className="login-logo">
                  <Radar className="h-[22px] w-[22px] text-white" />
                </div>
                <div className="login-logo-pulse" />
              </div>
              <h1 className="login-title">
                CyberSentinel<span className="login-title-dim">‑LLM</span>
              </h1>
              <p className="login-subtitle">
                {isSignup ? "Créer un compte analyste" : "Plateforme SOC — accès sécurisé"}
              </p>
            </div>

            {/* Mode tabs */}
            <div className="login-tabs">
              <button
                type="button"
                className={`login-tab ${!isSignup ? "active" : ""}`}
                onClick={() => switchMode("signin")}
              >
                <Lock className="h-[13px] w-[13px]" />
                Connexion
              </button>
              <button
                type="button"
                className={`login-tab ${isSignup ? "active" : ""}`}
                onClick={() => switchMode("signup")}
              >
                <UserPlus className="h-[13px] w-[13px]" />
                Inscription
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="login-form">

              {/* Username */}
              <div className={`login-field ${focused === "user" ? "focused" : ""}`}>
                <label className="login-label">Identifiant</label>
                <div className="login-input-wrap">
                  <User className="login-input-icon h-[15px] w-[15px]" />
                  <input
                    type="text"
                    autoComplete="username"
                    placeholder={isSignup ? "Choisir un identifiant" : "Votre identifiant"}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setFocused("user")}
                    onBlur={() => setFocused(null)}
                    className="login-input"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className={`login-field ${focused === "pass" ? "focused" : ""}`}>
                <label className="login-label">Mot de passe</label>
                <div className="login-input-wrap">
                  <Lock className="login-input-icon h-[15px] w-[15px]" />
                  <input
                    type={showPass ? "text" : "password"}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused("pass")}
                    onBlur={() => setFocused(null)}
                    className="login-input"
                    required
                  />
                  <button type="button" onClick={() => setShowPass((v) => !v)}
                    className="login-eye-btn" tabIndex={-1}>
                    {showPass
                      ? <EyeOff className="h-[15px] w-[15px]" />
                      : <Eye    className="h-[15px] w-[15px]" />}
                  </button>
                </div>
              </div>

              {/* Confirm password (signup only) */}
              {isSignup && (
                <div className={`login-field ${focused === "confirm" ? "focused" : ""}`}>
                  <label className="login-label">Confirmer le mot de passe</label>
                  <div className="login-input-wrap">
                    <Lock className="login-input-icon h-[15px] w-[15px]" />
                    <input
                      type={showPass ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••••••"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onFocus={() => setFocused("confirm")}
                      onBlur={() => setFocused(null)}
                      className="login-input"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email (signup only) */}
              {isSignup && (
                <div className={`login-field ${focused === "email" ? "focused" : ""}`}>
                  <label className="login-label">Adresse e-mail <span className="text-text-muted font-normal">(optionnel)</span></label>
                  <div className="login-input-wrap">
                    <Mail className="login-input-icon h-[15px] w-[15px]" />
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="analyste@soc.fr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                      className="login-input"
                    />
                  </div>
                </div>
              )}

              {/* Phone (signup only) */}
              {isSignup && (
                <div className={`login-field ${focused === "phone" ? "focused" : ""}`}>
                  <label className="login-label">Numéro de téléphone <span className="text-text-muted font-normal">(optionnel)</span></label>
                  <div className="login-input-wrap">
                    <Phone className="login-input-icon h-[15px] w-[15px]" />
                    <input
                      type="tel"
                      autoComplete="tel"
                      placeholder="+33 6 12 34 56 78"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onFocus={() => setFocused("phone")}
                      onBlur={() => setFocused(null)}
                      className="login-input"
                    />
                  </div>
                </div>
              )}

              {/* Role (signup only) */}
              {isSignup && (
                <div className="login-field">
                  <label className="login-label">Rôle dans l&apos;équipe</label>
                  <div className="login-input-wrap">
                    <Briefcase className="login-input-icon h-[15px] w-[15px]" />
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="login-input cursor-pointer"
                    >
                      <option value="Analyste SOC">Analyste SOC</option>
                      <option value="Analyste SOC Senior">Analyste SOC Senior</option>
                      <option value="Ingénieur Sécurité">Ingénieur Sécurité</option>
                      <option value="Manager SOC">Manager SOC</option>
                      <option value="Threat Hunter">Threat Hunter</option>
                      <option value="Administrateur">Administrateur</option>
                      <option value="Auditeur">Auditeur</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="login-error">
                  <AlertCircle className="h-[14px] w-[14px] shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading} className="login-btn">
                {loading ? (
                  <span className="login-btn-loading">
                    <span className="login-spinner" />
                    {isSignup ? "Création du compte…" : "Authentification…"}
                  </span>
                ) : (
                  <span className="login-btn-label">
                    {isSignup ? "Créer mon compte" : "Accéder au SOC"}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </button>
            </form>

            {/* Toggle link */}
            <p className="login-toggle-link">
              {isSignup ? (
                <>
                  Vous avez déjà un compte ?{" "}
                  <button type="button" onClick={() => switchMode("signin")} className="login-link-btn">
                    Se connecter
                  </button>
                </>
              ) : (
                <>
                  Vous êtes nouveau ?{" "}
                  <button type="button" onClick={() => switchMode("signup")} className="login-link-btn">
                    S&apos;enregistrer
                  </button>
                </>
              )}
            </p>


            <div className="login-scanline" />
          </div>
        </div>
      </div>
    </div>
  );
}
