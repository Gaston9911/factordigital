import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
// En Vercel, agregá estas dos variables de entorno:
//   VITE_SUPABASE_URL      → la URL de tu proyecto Supabase
//   VITE_SUPABASE_ANON_KEY → la anon/public key de tu proyecto
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ─── ANTHROPIC API ────────────────────────────────────────────────────────────
// En Vercel, agregá: VITE_ANTHROPIC_API_KEY
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

// ─── STEPS ───────────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: "nombre",
    pregunta: "¿Cómo se llama tu negocio?",
    tipo: "text",
    placeholder: "Ej: Clínica Dental Torres, Agencia Bloom...",
    icono: "🏢",
  },
  {
    id: "sector",
    pregunta: "¿En qué sector opera tu negocio?",
    tipo: "opciones",
    opciones: ["Salud & Clínicas", "E-commerce", "Agencia / Consultoría", "Restaurante / Hostelería", "Educación", "Bienes Raíces", "Otro"],
    icono: "🏭",
  },
  {
    id: "empleados",
    pregunta: "¿Cuántas personas trabajan contigo?",
    tipo: "opciones",
    opciones: ["Solo yo", "2–5 personas", "6–20 personas", "Más de 20"],
    icono: "👥",
  },
  {
    id: "dolor",
    pregunta: (sector) => sector === "Salud & Clínicas"
      ? "¿Qué tarea te consume MÁS tiempo con tus pacientes?"
      : "¿Qué tarea te consume MÁS tiempo cada semana?",
    tipo: "opciones",
    opciones: (sector) => sector === "Salud & Clínicas"
      ? ["Agendar y confirmar turnos", "Responder consultas por WhatsApp", "Hacer seguimiento post-consulta", "Gestionar recordatorios de citas", "Emitir presupuestos y facturas"]
      : ["Responder mensajes y emails", "Agendar citas o reuniones", "Crear reportes y seguimiento", "Publicar en redes sociales", "Gestionar facturas y pagos"],
    icono: "⏳",
  },
  {
    id: "horas",
    pregunta: "¿Cuántas horas a la semana pierdes en esa tarea?",
    tipo: "opciones",
    opciones: ["1–3 horas", "4–7 horas", "8–15 horas", "Más de 15 horas"],
    icono: "📊",
  },
  {
    id: "herramientas",
    pregunta: "¿Qué herramientas usas hoy en tu negocio?",
    tipo: "multi",
    opciones: ["WhatsApp Business", "Google Sheets", "Notion", "Instagram/TikTok", "Shopify/WooCommerce", "CRM propio", "Ninguna en especial"],
    icono: "🛠️",
  },
  {
    id: "meta",
    pregunta: "¿Cuál es tu mayor meta para los próximos 6 meses?",
    tipo: "opciones",
    opciones: ["Conseguir más clientes", "Trabajar menos horas", "Escalar sin contratar más gente", "Automatizar procesos internos"],
    icono: "🎯",
  },
  {
    id: "contacto",
    pregunta: "¿A dónde te envío tu plan de automatización?",
    subtitulo: "Tu diagnóstico + las 3 acciones concretas para empezar esta semana.",
    tipo: "contacto",
    icono: "📩",
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function calcularScore(data) {
  let score = 0;
  const h = Array.isArray(data.herramientas) ? data.herramientas : [];
  if (data.horas === "Más de 15 horas") score += 3;
  else if (data.horas === "8–15 horas") score += 2;
  else if (data.horas === "4–7 horas") score += 1;
  if (h.includes("WhatsApp Business")) score += 2;
  if (h.length >= 3) score += 1;
  if (h.includes("Ninguna en especial")) score -= 1;
  if (data.empleados === "6–20 personas" || data.empleados === "Más de 20") score += 2;
  if (data.meta === "Automatizar procesos internos") score += 1;
  return score >= 5 ? "🔥 LEAD CALIENTE" : score >= 3 ? "⚡ LEAD TIBIO" : "🌱 LEAD FRÍO";
}

function calcularCosto(data) {
  const m = { "1–3 horas": 2, "4–7 horas": 5.5, "8–15 horas": 11, "Más de 15 horas": 18 };
  const h = m[data.horas] || 5;
  const v = data.empleados === "Solo yo" ? 30 : data.empleados === "2–5 personas" ? 25 : 20;
  return Math.round(h * 4.3 * v);
}

function buildPrompt(data) {
  const tools = Array.isArray(data.herramientas) ? data.herramientas.join(", ") : data.herramientas;
  return `Eres un consultor experto en automatizaciones con IA para negocios latinoamericanos. Estilo directo, específico y ligeramente confrontativo.

NEGOCIO:
- Nombre: ${data.nombre}
- Sector: ${data.sector}
- Equipo: ${data.empleados}
- Tarea que más tiempo consume: ${data.dolor}
- Horas perdidas/semana: ${data.horas}
- Herramientas: ${tools}
- Meta: ${data.meta}

REGLAS: Usá "${data.nombre}" al menos una vez. Números concretos. Que el usuario piense "necesito resolver esto YA". Nada genérico. NO menciones el costo mensual.

ESTRUCTURA EXACTA:

🔍 EL PROBLEMA REAL
[2 oraciones brutalmente específicas para ${data.sector} sobre "${data.dolor}"]

⚡ LO QUE PODÉS AUTOMATIZAR ESTA SEMANA
[3 automatizaciones concretas usando ${tools}. Una por línea con emoji. Implementables en 48–72hs.]

🚀 QUÉ CAMBIA EN 30 DÍAS
[2 oraciones con números: horas recuperadas, % de mejora, impacto real.]

⚠️ POR QUÉ ESPERAR SALE MÁS CARO
[1 oración confrontativa sobre el costo de no actuar.]

Máximo 220 palabras. Sin intro ni cierre.`;
}

// Diagnóstico mock para previsualizar sin API key
function buildMock(data) {
  return `🔍 EL PROBLEMA REAL
En ${data.nombre || "tu negocio"}, cada semana se pierden horas valiosas en "${data.dolor || "tareas repetitivas"}" que ningún cliente ve pero que te están costando tiempo y plata real. Mientras vos hacés eso manualmente, tu competencia ya lo automatizó.

⚡ LO QUE PODÉS AUTOMATIZAR ESTA SEMANA
🤖 Respuestas automáticas a las consultas más frecuentes vía WhatsApp Business
📅 Confirmación y recordatorio de citas sin intervención humana
📊 Reporte semanal generado automáticamente desde tus datos existentes

🚀 QUÉ CAMBIA EN 30 DÍAS
Recuperás entre 8 y 12 horas semanales que hoy tirás en tareas repetitivas, lo que equivale a liberar un 30% de tu capacidad operativa. Ese tiempo se convierte en más clientes atendidos o en vos desconectándote los fines de semana.

⚠️ POR QUÉ ESPERAR SALE MÁS CARO
Cada semana que no automatizás es otra semana pagando con tu tiempo lo que una IA haría gratis las 24 horas.

---
⚠️ Este es un diagnóstico de EJEMPLO — en producción (Vercel + tu API key) Claude genera uno 100% personalizado para tu negocio.`;
}

// ─── GUARDAR LEAD EN SUPABASE ─────────────────────────────────────────────────
async function guardarLead(data, score, costo, diagnostico) {
  if (!supabase) return; // sin config, silencioso
  try {
    await supabase.from("leads").insert({
      nombre_negocio: data.nombre,
      sector: data.sector,
      empleados: data.empleados,
      dolor_principal: data.dolor,
      horas_perdidas: data.horas,
      herramientas: Array.isArray(data.herramientas) ? data.herramientas.join(", ") : data.herramientas,
      meta: data.meta,
      contacto_nombre: data.contacto?.nombre,
      contacto_info: data.contacto?.contacto,
      lead_score: score,
      costo_mensual_estimado: costo,
      diagnostico_generado: diagnostico,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("Supabase error:", e);
  }
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function LeadMagnet() {
  const [paso, setPaso] = useState(-1);
  const [respuestas, setRespuestas] = useState({});
  const [seleccionActual, setSeleccionActual] = useState(null);
  const [multiSel, setMultiSel] = useState([]);
  const [textVal, setTextVal] = useState("");
  const [contactoVal, setContactoVal] = useState({ nombre: "", contacto: "" });
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [streamText, setStreamText] = useState("");
  const [leadScore, setLeadScore] = useState(null);
  const [costoMensual, setCostoMensual] = useState(null);
  const inputRef = useRef(null);
  const totalSteps = STEPS.length;

  useEffect(() => {
    if (paso >= 0 && paso < totalSteps) {
      setSeleccionActual(null);
      setMultiSel([]);
      setTextVal("");
    }
  }, [paso]);

  useEffect(() => {
    if (STEPS[paso]?.tipo === "text" && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [paso]);

  const getSector = () => respuestas.sector || "";
  const getOpciones = (s) => typeof s.opciones === "function" ? s.opciones(getSector()) : s.opciones || [];
  const getPregunta = (s) => typeof s.pregunta === "function" ? s.pregunta(getSector()) : s.pregunta;

  const puedeAvanzar = () => {
    const step = STEPS[paso];
    if (!step) return false;
    if (step.tipo === "text") return textVal.trim().length > 1;
    if (step.tipo === "multi") return multiSel.length > 0;
    if (step.tipo === "contacto") return contactoVal.nombre.trim().length > 1 && contactoVal.contacto.trim().length > 3;
    return seleccionActual !== null;
  };

  const guardarYAvanzar = () => {
    const step = STEPS[paso];
    const valor = step.tipo === "text" ? textVal
      : step.tipo === "multi" ? multiSel
      : step.tipo === "contacto" ? contactoVal
      : seleccionActual;
    if (!valor || (Array.isArray(valor) && valor.length === 0)) return;
    const nuevas = { ...respuestas, [step.id]: valor };
    setRespuestas(nuevas);
    if (paso + 1 < totalSteps) {
      setPaso(paso + 1);
    } else {
      const score = calcularScore(nuevas);
      const costo = calcularCosto(nuevas);
      setLeadScore(score);
      setCostoMensual(costo);
      generarResultado(nuevas, score, costo);
    }
  };

  const generarResultado = async (data, score, costo) => {
    setGenerando(true);
    setPaso(totalSteps);

    // Si no hay API key (artifact / preview), usamos mock
    if (!ANTHROPIC_KEY) {
      await new Promise(r => setTimeout(r, 800));
      const mock = buildMock(data);
      // Simula streaming del mock
      let i = 0;
      const interval = setInterval(() => {
        i += 12;
        setStreamText(mock.slice(0, i));
        if (i >= mock.length) {
          clearInterval(interval);
          setStreamText(mock);
          setResultado(mock);
          setGenerando(false);
          guardarLead(data, score, costo, mock);
        }
      }, 18);
      return;
    }

    // Producción: llamada real a Anthropic
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          stream: true,
          messages: [{ role: "user", content: buildPrompt(data) }],
        }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n").filter(l => l.startsWith("data: "))) {
          const s = line.replace("data: ", "").trim();
          if (s === "[DONE]") continue;
          try { const d = JSON.parse(s).delta?.text || ""; full += d; setStreamText(full); } catch {}
        }
      }
      setResultado(full);
      guardarLead(data, score, costo, full);
    } catch {
      const err = "⚠️ Error al generar el diagnóstico. Por favor intenta de nuevo.";
      setResultado(err);
    } finally {
      setGenerando(false);
    }
  };

  const formatResultado = (text) => text.split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: "0.5rem" }} />;
    if (line.startsWith("---")) return <hr key={i} style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.07)", margin: "1rem 0" }} />;
    if (/^[🔍⚡🚀⚠️]/.test(line)) return (
      <h3 key={i} style={{ color: "#00FF94", fontFamily: "'Space Mono',monospace", fontSize: "0.75rem", letterSpacing: "0.07em", marginTop: "1.3rem", marginBottom: "0.45rem" }}>{line}</h3>
    );
    return <p key={i} style={{ color: line.startsWith("⚠️ Este es") ? "#5A6A7A" : "#C8D6E5", fontSize: line.startsWith("⚠️ Este es") ? "0.78rem" : "0.875rem", lineHeight: 1.75, fontFamily: "'DM Sans',sans-serif", margin: 0 }}>{line}</p>;
  });

  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "0.9rem 1.1rem", color: "#fff", fontSize: "0.95rem", fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" };
  const fonts = <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet" />;
  const css = <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes blink{50%{opacity:0}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>;

  const reset = () => { setPaso(-1); setRespuestas({}); setResultado(null); setStreamText(""); setLeadScore(null); setCostoMensual(null); setContactoVal({ nombre: "", contacto: "" }); };

  // ── LANDING ───────────────────────────────────────────────────────────────
  if (paso === -1) return (
    <div style={{ minHeight: "100vh", background: "#040D1A", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "'DM Sans',sans-serif" }}>
      {fonts}{css}
      <div style={{ maxWidth: "540px", width: "100%", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "rgba(0,255,148,0.07)", border: "1px solid rgba(0,255,148,0.2)", borderRadius: "999px", padding: "0.4rem 1.2rem", marginBottom: "1.8rem" }}>
          <span style={{ color: "#00FF94", fontFamily: "'Space Mono',monospace", fontSize: "0.68rem", letterSpacing: "0.15em" }}>DIAGNÓSTICO GRATUITO · 2 MINUTOS</span>
        </div>
        <h1 style={{ fontFamily: "'Space Mono',monospace", color: "#fff", fontSize: "clamp(1.7rem,5vw,2.6rem)", lineHeight: 1.15, fontWeight: 700, marginBottom: "1.2rem" }}>
          Descubrí cuánto dinero<br /><span style={{ color: "#00FF94" }}>estás dejando sobre la mesa</span><br />cada semana
        </h1>
        <p style={{ color: "#7A8FA6", fontSize: "0.97rem", lineHeight: 1.7, marginBottom: "2.5rem" }}>
          7 preguntas sobre tu negocio → te mostramos exactamente qué automatizar para recuperar tiempo y dinero esta misma semana.
        </p>
        <button onClick={() => setPaso(0)}
          style={{ background: "#00FF94", color: "#040D1A", border: "none", borderRadius: "8px", padding: "1rem 2.5rem", fontSize: "0.95rem", fontWeight: 700, fontFamily: "'Space Mono',monospace", cursor: "pointer", letterSpacing: "0.05em", boxShadow: "0 0 40px rgba(0,255,148,0.25)", transition: "transform 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
          QUIERO VER MI DIAGNÓSTICO →
        </button>
        <p style={{ color: "#1A2A3C", fontSize: "0.7rem", marginTop: "1.2rem", fontFamily: "'Space Mono',monospace" }}>Sin tarjeta · Sin spam · 100% personalizado</p>
      </div>
    </div>
  );

  // ── RESULTADO ─────────────────────────────────────────────────────────────
  if (paso === totalSteps) {
    const primerNombre = (respuestas.contacto?.nombre || "").split(" ")[0];
    const costo = costoMensual || calcularCosto(respuestas);
    const score = leadScore || calcularScore(respuestas);
    const isHot = score.includes("CALIENTE");

    return (
      <div style={{ minHeight: "100vh", background: "#040D1A", padding: "2rem", fontFamily: "'DM Sans',sans-serif" }}>
        {fonts}{css}
        <div style={{ maxWidth: "660px", margin: "0 auto", paddingTop: "2rem" }}>

          {generando && !streamText && (
            <div style={{ textAlign: "center", paddingTop: "5rem" }}>
              <div style={{ width: "44px", height: "44px", border: "3px solid rgba(0,255,148,0.12)", borderTop: "3px solid #00FF94", borderRadius: "50%", margin: "0 auto 1.5rem", animation: "spin 0.85s linear infinite" }} />
              <p style={{ color: "#00FF94", fontFamily: "'Space Mono',monospace", fontSize: "0.73rem", letterSpacing: "0.12em" }}>ANALIZANDO {respuestas.nombre?.toUpperCase()}...</p>
            </div>
          )}

          {streamText && (
            <div style={{ animation: "fadeUp 0.4s ease" }}>
              <div style={{ marginBottom: "1.6rem" }}>
                <div style={{ display: "inline-block", background: "rgba(0,255,148,0.07)", border: "1px solid rgba(0,255,148,0.18)", borderRadius: "999px", padding: "0.35rem 1.1rem", marginBottom: "1rem" }}>
                  <span style={{ color: "#00FF94", fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.15em" }}>DIAGNÓSTICO · {respuestas.sector?.toUpperCase()}</span>
                </div>
                <h2 style={{ fontFamily: "'Space Mono',monospace", color: "#fff", fontSize: "clamp(1rem,3vw,1.45rem)", marginBottom: "0.25rem" }}>{respuestas.nombre}</h2>
                <p style={{ color: "#2A3A4C", fontFamily: "'Space Mono',monospace", fontSize: "0.62rem" }}>{respuestas.empleados} · {score}</p>
              </div>

              {/* Costo en rojo */}
              <div style={{ background: "rgba(255,60,60,0.06)", border: "1px solid rgba(255,60,60,0.22)", borderRadius: "12px", padding: "1.2rem 1.4rem", marginBottom: "1.4rem", display: "flex", alignItems: "center", gap: "1.1rem" }}>
                <span style={{ fontSize: "1.7rem", flexShrink: 0 }}>💸</span>
                <div>
                  <p style={{ color: "#FF6B6B", fontFamily: "'Space Mono',monospace", fontSize: "0.63rem", letterSpacing: "0.1em", marginBottom: "0.2rem" }}>COSTO ESTIMADO DE NO AUTOMATIZAR</p>
                  <p style={{ color: "#FF4040", fontSize: "1.45rem", fontWeight: 700, fontFamily: "'Space Mono',monospace", margin: 0 }}>
                    ~${costo.toLocaleString()} <span style={{ fontSize: "0.78rem", color: "#FF6B6B", fontWeight: 400 }}>USD/mes</span>
                  </p>
                  <p style={{ color: "#5A3535", fontSize: "0.73rem", fontFamily: "'DM Sans',sans-serif", margin: "0.2rem 0 0" }}>{respuestas.horas} semanales × valor estimado de tu hora</p>
                </div>
              </div>

              {/* Diagnóstico */}
              <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "1.7rem", marginBottom: "1.4rem" }}>
                {formatResultado(streamText)}
                {generando && <span style={{ color: "#00FF94", animation: "blink 1s step-end infinite", fontFamily: "monospace" }}>▊</span>}
              </div>

              {/* CTA */}
              {resultado && (
                <div style={{ background: isHot ? "linear-gradient(135deg,rgba(0,255,148,0.09),rgba(0,255,148,0.03))" : "rgba(255,255,255,0.025)", border: `1px solid ${isHot ? "rgba(0,255,148,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius: "16px", padding: "1.7rem", textAlign: "center", marginBottom: "0.9rem" }}>
                  {isHot && (
                    <div style={{ display: "inline-block", background: "rgba(0,255,148,0.07)", border: "1px solid rgba(0,255,148,0.18)", borderRadius: "999px", padding: "0.3rem 1rem", marginBottom: "1rem" }}>
                      <span style={{ color: "#00FF94", fontFamily: "'Space Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.12em" }}>🔥 ALTA PRIORIDAD · CASO IDEAL</span>
                    </div>
                  )}
                  <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", fontFamily: "'Space Mono',monospace", lineHeight: 1.4 }}>
                    {primerNombre ? `${primerNombre}, ¿querés` : "¿Querés"} recuperar esas horas esta semana?
                  </h3>
                  <p style={{ color: "#7A8FA6", fontSize: "0.83rem", marginBottom: "1.4rem", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.6 }}>
                    Agendamos 30 minutos. Te mostramos el sistema exacto para tu negocio — o no te cobramos nada.
                  </p>
                  <button
                    onClick={() => window.open("https://wa.me/549XXXXXXXXX", "_blank")}
                    style={{ background: "#00FF94", color: "#040D1A", border: "none", borderRadius: "8px", padding: "1rem 1.5rem", fontSize: "0.82rem", fontWeight: 700, fontFamily: "'Space Mono',monospace", cursor: "pointer", letterSpacing: "0.04em", width: "100%", boxShadow: "0 0 28px rgba(0,255,148,0.28)", marginBottom: "0.6rem", transition: "transform 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                    DEJAR DE PERDER ${costo.toLocaleString()} AL MES →
                  </button>
                  <button
                    onClick={() => window.open("https://calendly.com/TU_LINK", "_blank")}
                    style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "8px", padding: "0.75rem 1.5rem", fontSize: "0.75rem", fontFamily: "'Space Mono',monospace", cursor: "pointer", letterSpacing: "0.04em", width: "100%", color: "#5A6A7A" }}>
                    VER CÓMO AUTOMATIZAR MI NEGOCIO →
                  </button>
                  <p style={{ color: "#1A2A3C", fontSize: "0.65rem", marginTop: "0.8rem", fontFamily: "'Space Mono',monospace" }}>
                    Sin compromiso · Diagnóstico enviado a {respuestas.contacto?.contacto}
                  </p>
                </div>
              )}

              {resultado && (
                <button onClick={reset} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.06)", color: "#2A3A4C", borderRadius: "8px", padding: "0.7rem", fontSize: "0.68rem", fontFamily: "'Space Mono',monospace", cursor: "pointer", width: "100%" }}>
                  ← Empezar de nuevo
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── PREGUNTAS ─────────────────────────────────────────────────────────────
  const step = STEPS[paso];
  const opciones = getOpciones(step);
  const pregunta = getPregunta(step);
  const progresoW = Math.round((paso / totalSteps) * 100);

  return (
    <div style={{ minHeight: "100vh", background: "#040D1A", padding: "2rem", fontFamily: "'DM Sans',sans-serif" }}>
      {fonts}{css}
      <div style={{ maxWidth: "560px", margin: "0 auto", paddingTop: "2rem", animation: "fadeUp 0.3s ease" }}>

        {/* Progreso */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "3rem" }}>
          <div style={{ flex: 1, height: "2px", background: "rgba(255,255,255,0.05)", borderRadius: "999px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progresoW}%`, background: "#00FF94", borderRadius: "999px", transition: "width 0.5s cubic-bezier(.4,0,.2,1)" }} />
          </div>
          <span style={{ color: "#1A2A3C", fontFamily: "'Space Mono',monospace", fontSize: "0.6rem", whiteSpace: "nowrap" }}>{paso + 1}/{totalSteps}</span>
        </div>

        {/* Pregunta */}
        <div style={{ marginBottom: "2.4rem" }}>
          <span style={{ fontSize: "1.9rem", display: "block", marginBottom: "0.85rem" }}>{step.icono}</span>
          <h2 style={{ fontFamily: "'Space Mono',monospace", color: "#fff", fontSize: "clamp(1rem,3vw,1.38rem)", lineHeight: 1.4, marginBottom: step.subtitulo ? "0.6rem" : 0 }}>{pregunta}</h2>
          {step.subtitulo && <p style={{ color: "#7A8FA6", fontSize: "0.85rem", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.6 }}>{step.subtitulo}</p>}
        </div>

        {step.tipo === "text" && (
          <input ref={inputRef} type="text" value={textVal}
            onChange={e => setTextVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && puedeAvanzar() && guardarYAvanzar()}
            placeholder={step.placeholder} style={inputStyle}
            onFocus={e => e.target.style.border = "1px solid rgba(0,255,148,0.45)"}
            onBlur={e => e.target.style.border = "1px solid rgba(255,255,255,0.12)"} />
        )}

        {step.tipo === "opciones" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {opciones.map(op => (
              <button key={op} onClick={() => setSeleccionActual(op)} style={{
                background: seleccionActual === op ? "rgba(0,255,148,0.09)" : "rgba(255,255,255,0.025)",
                border: seleccionActual === op ? "1px solid rgba(0,255,148,0.5)" : "1px solid rgba(255,255,255,0.07)",
                borderRadius: "10px", padding: "0.85rem 1.1rem",
                color: seleccionActual === op ? "#00FF94" : "#C8D6E5",
                fontSize: "0.88rem", fontFamily: "'DM Sans',sans-serif", cursor: "pointer",
                textAlign: "left", transition: "all 0.15s",
              }}>{seleccionActual === op ? "✓ " : ""}{op}</button>
            ))}
          </div>
        )}

        {step.tipo === "multi" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <p style={{ color: "#1A2A3C", fontFamily: "'Space Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.1em", marginBottom: "0.2rem" }}>SELECCIONA TODAS LAS QUE APLIQUEN</p>
            {opciones.map(op => {
              const sel = multiSel.includes(op);
              return (
                <button key={op} onClick={() => setMultiSel(sel ? multiSel.filter(x => x !== op) : [...multiSel, op])} style={{
                  background: sel ? "rgba(0,255,148,0.09)" : "rgba(255,255,255,0.025)",
                  border: sel ? "1px solid rgba(0,255,148,0.5)" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "10px", padding: "0.85rem 1.1rem",
                  color: sel ? "#00FF94" : "#C8D6E5",
                  fontSize: "0.88rem", fontFamily: "'DM Sans',sans-serif", cursor: "pointer",
                  textAlign: "left", transition: "all 0.15s",
                }}>{sel ? "✓ " : ""}{op}</button>
              );
            })}
          </div>
        )}

        {step.tipo === "contacto" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div>
              <label style={{ color: "#5A6A7A", fontFamily: "'Space Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.1em", display: "block", marginBottom: "0.4rem" }}>TU NOMBRE</label>
              <input type="text" value={contactoVal.nombre}
                onChange={e => setContactoVal(v => ({ ...v, nombre: e.target.value }))}
                placeholder="¿Cómo te llaman?" style={inputStyle}
                onFocus={e => e.target.style.border = "1px solid rgba(0,255,148,0.45)"}
                onBlur={e => e.target.style.border = "1px solid rgba(255,255,255,0.12)"} />
            </div>
            <div>
              <label style={{ color: "#5A6A7A", fontFamily: "'Space Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.1em", display: "block", marginBottom: "0.4rem" }}>WHATSAPP O EMAIL</label>
              <input type="text" value={contactoVal.contacto}
                onChange={e => setContactoVal(v => ({ ...v, contacto: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && puedeAvanzar() && guardarYAvanzar()}
                placeholder="+54 9 11 ... o tu@email.com" style={inputStyle}
                onFocus={e => e.target.style.border = "1px solid rgba(0,255,148,0.45)"}
                onBlur={e => e.target.style.border = "1px solid rgba(255,255,255,0.12)"} />
            </div>
            <p style={{ color: "#1A2A3C", fontSize: "0.68rem", fontFamily: "'Space Mono',monospace" }}>🔒 Sin spam. Solo para enviarte el plan.</p>
          </div>
        )}

        {/* Navegación */}
        <div style={{ marginTop: "2rem", display: "flex", gap: "0.75rem" }}>
          {paso > 0 && (
            <button onClick={() => setPaso(paso - 1)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "0.9rem 1.1rem", color: "#2A3A4C", fontFamily: "'Space Mono',monospace", fontSize: "0.75rem", cursor: "pointer" }}>←</button>
          )}
          <button onClick={guardarYAvanzar} disabled={!puedeAvanzar()} style={{
            flex: 1, background: puedeAvanzar() ? "#00FF94" : "rgba(255,255,255,0.04)",
            color: puedeAvanzar() ? "#040D1A" : "#1A2A3C", border: "none", borderRadius: "8px",
            padding: "1rem", fontSize: "0.8rem", fontWeight: 700, fontFamily: "'Space Mono',monospace",
            cursor: puedeAvanzar() ? "pointer" : "not-allowed", letterSpacing: "0.05em",
            transition: "all 0.2s", boxShadow: puedeAvanzar() ? "0 0 22px rgba(0,255,148,0.2)" : "none",
          }}>
            {paso === totalSteps - 1 ? "VER MI DIAGNÓSTICO →" : "CONTINUAR →"}
          </button>
        </div>
      </div>
    </div>
  );
}
