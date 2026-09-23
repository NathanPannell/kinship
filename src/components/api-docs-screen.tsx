"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronRight, Copy, Eye, EyeOff, Play, ShieldCheck } from "lucide-react";
import styles from "./api-docs-screen.module.css";

type EndpointId = "suggestions" | "contacts" | "create" | "contact" | "update" | "interaction";
type Endpoint = { id: EndpointId; method: "GET" | "PATCH" | "POST"; path: string; title: string; description: string; response: string; writes?: boolean };
type Result = { status: number; statusText: string; body: string; url: string };
type TokenRecord = { id: string; name: string; token_prefix: string; created_at: string; revoked_at: string | null };

const endpoints: Endpoint[] = [
  { id: "suggestions", method: "GET", path: "/api/agent/suggestions", title: "Today’s suggestions", description: "Up to three contacts due today, plus upcoming contacts.", response: "200 · suggestions and upcoming arrays" },
  { id: "contacts", method: "GET", path: "/api/agent/contacts", title: "Search contacts", description: "Find contacts by name, company, or role and narrow by priority.", response: "200 · contacts array" },
  { id: "create", method: "POST", path: "/api/agent/contacts", title: "Create a contact", description: "Create a contact. Only the name is required, and names may be shared. Priority defaults to low and the follow-up cadence defaults to 60 days.", response: "201 · created contact", writes: true },
  { id: "contact", method: "GET", path: "/api/agent/contacts/{id}", title: "Contact details", description: "Get one contact and its 20 most recent interactions.", response: "200 · contact and interactions" },
  { id: "update", method: "PATCH", path: "/api/agent/contacts/{id}", title: "Update a contact", description: "Change contact details or follow-up preferences.", response: "200 · updated contact", writes: true },
  { id: "interaction", method: "POST", path: "/api/agent/interactions", title: "Record an interaction", description: "Log a touchpoint and recalculate the contact’s last contact date.", response: "201 · created interaction", writes: true },
];

const exampleUpdate = JSON.stringify({ priority: "high", cadence_days: 14 }, null, 2);
const exampleCreate = JSON.stringify({ name: "Ada Lovelace" }, null, 2);
const exampleInteraction = JSON.stringify({ contact_id: "", channel: "Email", note: "Followed up about the project." }, null, 2);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function responseLabel(result: Result) {
  if (result.status === 0) return "Request failed";
  return `${result.status} ${result.statusText}`.trim();
}

export function ApiDocsScreen() {
  const inFlight = useRef(false);
  const [activeId, setActiveId] = useState<EndpointId>("suggestions");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [sort, setSort] = useState("");
  const [contactId, setContactId] = useState("");
  const [requestBody, setRequestBody] = useState(exampleUpdate);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [setupCopied, setSetupCopied] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [newToken, setNewToken] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);
  const [revokeId, setRevokeId] = useState("");
  const active = endpoints.find((item) => item.id === activeId)!;
  const needsId = activeId === "contact" || activeId === "update";
  const needsBody = active.writes;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/tokens", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load API tokens. Refresh the page to retry.");
        const data: { tokens: TokenRecord[] } = await response.json();
        setTokens(data.tokens);
      })
      .catch((caught) => { if (caught instanceof Error && caught.name !== "AbortError") setTokenError(caught.message); });
    return () => controller.abort();
  }, []);

  async function createToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (tokenBusy || newToken) return;
    const name = tokenName.trim();
    if (!name || name.length > 80) { setTokenError("Enter a name of 1 to 80 characters."); return; }
    setTokenBusy(true);
    setTokenError("");
    try {
      const response = await fetch("/api/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create token.");
      setTokens((current) => [data.record as TokenRecord, ...current]);
      setNewToken(data.token as string);
      setToken(data.token as string);
      setTokenName("");
    } catch (caught) { setTokenError(caught instanceof Error ? caught.message : "Could not create token."); }
    finally { setTokenBusy(false); }
  }

  async function revokeToken(id: string) {
    if (revokeId) return;
    setRevokeId(id);
    setTokenError("");
    try {
      const response = await fetch(`/api/tokens/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not revoke token.");
      setTokens((current) => current.map((item) => item.id === id ? { ...item, revoked_at: new Date().toISOString() } : item));
      if (newToken && tokens.some((item) => item.id === id && item.token_prefix === `${newToken.slice(0, 12)}…`)) {
        setNewToken(""); setToken("");
      }
    } catch (caught) { setTokenError(caught instanceof Error ? caught.message : "Could not revoke token."); }
    finally { setRevokeId(""); }
  }

  async function copyNewToken() {
    try {
      await navigator.clipboard.writeText(newToken);
      setSecretCopied(true);
      window.setTimeout(() => setSecretCopied(false), 1800);
    } catch { setTokenError("Could not copy token. Select and copy it manually."); }
  }

  function selectEndpoint(id: EndpointId) {
    setActiveId(id);
    setResult(null);
    setError("");
    if (id === "create") setRequestBody(exampleCreate);
    if (id === "update") setRequestBody(exampleUpdate);
    if (id === "interaction") setRequestBody(exampleInteraction);
  }

  function requestPath() {
    if (needsId) return `/api/agent/contacts/${encodeURIComponent(contactId.trim())}`;
    if (activeId === "contacts") {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (priority) params.set("priority", priority);
      if (overdue) params.set("overdue", "true");
      if (sort) params.set("sort", sort);
      return `${active.path}${params.size ? `?${params}` : ""}`;
    }
    return active.path;
  }

  async function runRequest() {
    if (inFlight.current) return;
    setResult(null);
    setError("");
    const bearer = token.trim();
    if (!bearer) { setError("Enter your agent API token to send this request."); return; }
    if (needsId && !uuidPattern.test(contactId.trim())) { setError("Enter a valid contact UUID."); return; }

    let body: string | undefined;
    if (needsBody) {
      try {
        const parsed: unknown = JSON.parse(requestBody);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        body = JSON.stringify(parsed);
      } catch { setError("Request body must be a JSON object."); return; }
    }

    const path = requestPath();
    inFlight.current = true;
    setLoading(true);
    try {
      const response = await fetch(path, {
        method: active.method,
        headers: { Authorization: `Bearer ${bearer}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body,
        cache: "no-store",
      });
      const raw = await response.text();
      let formatted = raw || "(empty response)";
      try { formatted = JSON.stringify(JSON.parse(raw), null, 2); } catch { /* Keep non-JSON response text. */ }
      setResult({ status: response.status, statusText: response.statusText, body: formatted, url: path });
    } catch (caught) {
      setResult({ status: 0, statusText: "", body: caught instanceof Error ? caught.message : "Network request failed.", url: path });
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  async function copySpecUrl() {
    try {
      await navigator.clipboard.writeText(new URL("/openapi.json", window.location.origin).href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }

  async function copyAgentSetup() {
    const base = window.location.origin;
    const instructions = `Use my Kinship CRM agent API at ${base}. Read the public OpenAPI 3.1 specification at ${base}/openapi.json for paths, parameters, and schemas. I will provide a named API token separately. Send it as Authorization: Bearer <token> on every /api/agent/* request. Start with GET /api/agent/suggestions to find who needs attention; use GET /api/agent/contacts to search, POST /api/agent/contacts to create a contact, GET /api/agent/contacts/{id} for details, PATCH /api/agent/contacts/{id} to update a contact, and POST /api/agent/interactions to record a touchpoint. Ask me before making changes or contacting anyone. This API does not send messages.`;
    try {
      await navigator.clipboard.writeText(instructions);
      setSetupCopied(true);
      window.setTimeout(() => setSetupCopied(false), 1800);
    } catch { setTokenError("Could not copy agent setup. Copy the details below manually."); }
  }

  return (
    <div className={styles.docs}>
      <header className={styles.header}>
        <div>
          <h1 className="page-title">Build with your relationships.</h1>
          <p className="page-subtitle">Read and update your Kinship data through the agent API. Explore each endpoint here, then use the same requests in your own tools.</p>
        </div>
        <a className={`button button-secondary ${styles.specLink}`} href="/openapi.json" target="_blank" rel="noreferrer">OpenAPI JSON <ArrowUpRight size={15} aria-hidden="true" /></a>
      </header>

      <section className={styles.tokenManagement} aria-labelledby="tokens-title">
        <div className={styles.sectionHead}><h2 id="tokens-title">API tokens</h2><span>Manage agent access</span></div>
        <p>Create a named token, copy it to your agent, and revoke it here whenever you need. Each token is shown once. Your agent uses it as a Bearer token with the endpoints below.</p>
        <form className={styles.createTokenForm} onSubmit={createToken}>
          <label htmlFor="token-name" className="field-label">Token name</label>
          <div className={styles.createTokenControls}><input id="token-name" className="input" value={tokenName} onChange={(event) => setTokenName(event.target.value)} maxLength={80} placeholder="For example, My assistant" autoComplete="off" disabled={tokenBusy || Boolean(newToken)} /><button type="submit" className="button button-primary" disabled={tokenBusy || Boolean(newToken)}>{tokenBusy ? "Creating…" : newToken ? "Save token first" : "Create token"}</button></div>
        </form>
        {newToken && <div className={styles.newToken} role="status"><strong>Copy this token now</strong><span>It will not be shown again after you leave this page.</span><div className={styles.newTokenValue}><code>{newToken}</code><button type="button" onClick={copyNewToken}>{secretCopied ? <Check size={15} /> : <Copy size={15} />}{secretCopied ? "Copied" : "Copy"}</button></div><button className={styles.dismissToken} type="button" onClick={() => setNewToken("")}>I’ve saved it</button></div>}
        {tokenError && <p className={styles.error} role="alert">{tokenError}</p>}
        {tokens.length > 0 && <div className={styles.tokenList} aria-label="Existing API tokens">{tokens.map((item) => <div className={styles.tokenRow} key={item.id}><div><strong>{item.name}</strong><span>{item.token_prefix} · Created {new Date(item.created_at).toLocaleDateString()}</span></div>{item.revoked_at ? <span className={styles.revoked}>Revoked</span> : <button type="button" disabled={revokeId === item.id} onClick={() => revokeToken(item.id)}>{revokeId === item.id ? "Revoking…" : "Revoke"}</button>}</div>)}</div>}
      </section>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="API endpoints">
          <h2>Endpoints</h2>
          <div className={styles.endpointList}>
            {endpoints.map((endpoint) => (
              <button key={endpoint.id} type="button" onClick={() => selectEndpoint(endpoint.id)} disabled={loading} className={`${styles.endpointButton} ${activeId === endpoint.id ? styles.selected : ""}`} aria-current={activeId === endpoint.id ? "true" : undefined}>
                <span className={`${styles.method} ${endpoint.writes ? styles.writeMethod : ""}`}>{endpoint.method}</span>
                <span>{endpoint.title}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className={styles.sidebarNote}><ShieldCheck size={17} aria-hidden="true" /><span>The API reads and updates your CRM. It never sends messages to contacts.</span></div>
        </aside>

        <div className={styles.main}>
          <section className={styles.intro} aria-labelledby="endpoint-title">
            <div className={styles.pathLine}><span className={`${styles.method} ${active.writes ? styles.writeMethod : ""}`}>{active.method}</span><code>{active.path}</code></div>
            <h2 id="endpoint-title">{active.title}</h2>
            <p>{active.description}</p>
            <div className={styles.endpointMeta}><span>Response</span><strong>{active.response}</strong></div>
          </section>

          <section className={styles.auth} aria-labelledby="auth-title">
            <div className={styles.sectionHead}><h2 id="auth-title">Authentication</h2><span>Bearer token</span></div>
            <p>Create a token above to try requests here. It stays in this tab and is sent only with requests you run. A missing, invalid, or revoked token returns 401.</p>
            <label htmlFor="agent-token" className="field-label">Agent API token</label>
            <div className={styles.tokenField}>
              <input id="agent-token" className="input" type={showToken ? "text" : "password"} value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste your token" autoComplete="off" spellCheck={false} />
              <button type="button" onClick={() => setShowToken((shown) => !shown)} aria-label={showToken ? "Hide token" : "Show token"} title={showToken ? "Hide token" : "Show token"}>{showToken ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
          </section>

          <section className={styles.playground} aria-labelledby="playground-title">
            <div className={styles.sectionHead}><h2 id="playground-title">Try this request</h2><span>Same origin</span></div>
            {activeId === "contacts" && <div className={styles.fields}>
              <label className={styles.field}>Search <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, company, or role" /></label>
              <label className={styles.field}>Priority <select className="select" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">Any priority</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
              <label className={styles.field}>Due status <select className="select" value={overdue ? "true" : ""} onChange={(event) => setOverdue(event.target.value === "true")}><option value="">All contacts</option><option value="true">Overdue only</option></select></label>
              <label className={styles.field}>Sort <select className="select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="">Last contacted</option><option value="next_due">Next due</option></select></label>
            </div>}
            {needsId && <label className={styles.field}>Contact ID <input className="input" value={contactId} onChange={(event) => setContactId(event.target.value)} placeholder="Contact UUID" spellCheck={false} /></label>}
            {needsBody && <label className={styles.field}>JSON body <textarea className={`${styles.bodyInput} textarea`} value={requestBody} onChange={(event) => setRequestBody(event.target.value)} spellCheck={false} rows={activeId === "interaction" ? 6 : 5} /></label>}
            {activeId === "create" && <p className={styles.fieldHint}>Only <code>name</code> is required. All other fields are optional. If omitted, priority defaults to low and <code>cadence_days</code> defaults to 60.</p>}
            {activeId === "interaction" && <p className={styles.fieldHint}>Replace the empty <code>contact_id</code> with a UUID from Search contacts.</p>}
            {active.writes && <p className={styles.writeNotice}>{activeId === "update" ? "This request saves changes to the selected contact." : activeId === "create" ? "This request adds a contact to your CRM." : "This request creates an interaction and updates the contact’s last contact date."}</p>}
            <div className={styles.requestFoot}><code>{active.method} {requestPath()}</code><button type="button" className="button button-primary" disabled={loading} onClick={runRequest}><Play size={14} fill="currentColor" aria-hidden="true" />{loading ? "Sending…" : activeId === "create" ? "Create contact" : active.writes ? "Send change" : "Send request"}</button></div>
            {error && <p className={styles.error} role="alert">{error}</p>}
          </section>

          <section className={styles.response} aria-labelledby="response-title">
            <div className={styles.sectionHead}><h2 id="response-title">Response</h2>{result && <span>Live result</span>}</div>
            {result ? <><div className={styles.responseStatus}><span className={result.status >= 200 && result.status < 300 ? styles.success : styles.failure}>{responseLabel(result)}</span><code>{result.url}</code></div><pre tabIndex={0}>{result.body}</pre></> : <div className={styles.responseEmpty}>Send a request to see the real status and response body here.</div>}
          </section>

          <section className={styles.reference} aria-labelledby="reference-title">
            <h2 id="reference-title">Use it outside Kinship</h2>
            <p>Give your agent the token, your Kinship base URL, and the public <code>/openapi.json</code> URL. The machine readable specification describes each path, parameter, request body, and response. Send <code>Authorization: Bearer &lt;token&gt;</code> with every agent API request. The token can access only this Kinship account, and you can revoke it above.</p>
            <p>For Meta Muse, create a token named for Muse and ask Muse to build a custom connector from the OpenAPI URL. Store the token as a bearer credential in Muse, then test with <code>GET /api/agent/suggestions</code>. Review write requests before allowing them.</p>
            <div className={styles.referenceActions}><a href="/openapi.json" target="_blank" rel="noreferrer">View OpenAPI specification <ArrowUpRight size={15} aria-hidden="true" /></a><a href="/connect/muse">Muse setup guide <ArrowUpRight size={15} aria-hidden="true" /></a><button type="button" onClick={copySpecUrl}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy spec URL"}</button><button type="button" onClick={copyAgentSetup}>{setupCopied ? <Check size={15} /> : <Copy size={15} />}{setupCopied ? "Copied" : "Copy agent setup"}</button></div>
          </section>
        </div>
      </div>
    </div>
  );
}
