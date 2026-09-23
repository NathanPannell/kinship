"use client";

import { useMemo, useRef, useState, type CSSProperties, type DragEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileUp, LockKeyhole, RefreshCw, Search, Upload, Users } from "lucide-react";
import { formatDate, initials } from "./crm-utils";
import { apiRequest } from "./crm-utils";
import {
  matchMessageDates,
  parseConnections,
  type OnboardingContact,
} from "./onboarding-parser";
import styles from "./onboarding-screen.module.css";

type Step = "connections" | "messages" | "selection" | "settings";
type PriorityValue = OnboardingContact["priority"];
type CadenceValue = OnboardingContact["cadence_days"];

const stepOrder: Step[] = ["connections", "messages", "selection", "settings"];
const stepLabels: Record<Step, string> = {
  connections: "Connections",
  messages: "Messages",
  selection: "Choose people",
  settings: "Set a rhythm",
};

const priorityOptions: { value: PriorityValue; label: string; position: number; tone: string }[] = [
  { value: "low", label: "Low", position: 0, tone: "low" },
  { value: "normal", label: "Normal", position: 1, tone: "normal" },
  { value: "high", label: "High", position: 2, tone: "high" },
];

const cadenceOptions: { value: CadenceValue; label: string; position: number }[] = [
  { value: 7, label: "7 days", position: 0 },
  { value: 15, label: "15 days", position: 1 },
  { value: 30, label: "30 days", position: 2 },
  { value: 60, label: "60 days", position: 3 },
];

const privacyCopy = "CSV files and message text stay in your browser. Only selected contacts, last contact dates, and preferences are saved when you finish.";

function DropZone({
  inputRef,
  title,
  description,
  busy,
  onFile,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  title: string;
  description: string;
  busy: boolean;
  onFile: (file: File | undefined) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    onFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const dropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  };

  return (
    <div
      className={`${styles.dropZone} ${dragging ? styles.dropZoneActive : ""} ${busy ? styles.dropZoneBusy : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={dropFile}
      aria-busy={busy}
    >
      <input
        ref={inputRef}
        className={styles.fileInput}
        type="file"
        accept=".csv,text/csv"
        tabIndex={-1}
        aria-label={title}
        disabled={busy}
        onChange={(event) => acceptFile(event.currentTarget.files?.[0])}
      />
      <div className={styles.uploadGlyph} aria-hidden="true">
        {busy ? <RefreshCw className={styles.spin} size={21} /> : <Upload size={21} />}
      </div>
      <strong className={styles.dropTitle}>{busy ? "Reading your file..." : title}</strong>
      <span className={styles.dropDescription}>{description}</span>
      <button
        className="button button-secondary"
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? "Please wait" : "Choose CSV"}
      </button>
      <span className={styles.dropHint}>CSV files only</span>
    </div>
  );
}

function ChoiceGroup<T extends string | number>({
  label,
  name,
  options,
  selected,
  onChange,
  group,
}: {
  label: string;
  name: string;
  options: { value: T; label: string; tone?: string }[];
  selected: T | null;
  onChange: (value: T) => void;
  group: "priority" | "cadence";
}) {
  return (
    <fieldset className={styles.bulkGroup}>
      <legend>{label}</legend>
      <div className={`${styles.choiceRow} ${group === "cadence" ? styles.cadenceChoices : ""}`}>
        {options.map((option) => (
          <label
            key={option.value}
            className={`${styles.choice} ${selected === option.value ? styles.choiceSelected : ""}`}
            data-tone={option.tone}
            data-cadence={group === "cadence" ? String(option.value) : undefined}
          >
            <input
              className={styles.choiceInput}
              type="radio"
              name={name}
              value={String(option.value)}
              checked={selected === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SliderSetting({
  contact,
  kind,
  value,
  onChange,
}: {
  contact: OnboardingContact;
  kind: "priority" | "cadence";
  value: number;
  onChange: (value: number) => void;
}) {
  const isPriority = kind === "priority";
  const options = isPriority ? priorityOptions : cadenceOptions;
  const selected = options[value];
  const color = isPriority
    ? `var(--priority-${selected.value})`
    : `var(--cadence-${selected.value})`;
  const max = options.length - 1;
  const progress = `${(value / max) * 100}%`;
  const fill = isPriority
    ? "linear-gradient(90deg, #4e8969 0%, #d3a743 52%, #be594e 100%)"
    : "linear-gradient(90deg, #d6e8f5 0%, #a8c8e1 34%, #638eb5 67%, #294c72 100%)";

  return (
    <div className={styles.sliderSetting}>
      <div className={styles.sliderTitle}>
        <label htmlFor={`${kind}-${contact.id}`}>{isPriority ? "Priority" : "How often"}</label>
        <span className={isPriority ? styles[`priorityText_${selected.value}`] : styles[`cadenceText_${selected.value}`]}>
          {isPriority ? selected.label : `Every ${selected.label}`}
        </span>
      </div>
      <input
        id={`${kind}-${contact.id}`}
        className={`${styles.range} ${isPriority ? styles.priorityRange : styles.cadenceRange}`}
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        aria-label={`${isPriority ? "Priority" : "Contact reminder frequency"} for ${contact.name}`}
        aria-valuetext={isPriority ? selected.label : `Every ${selected.label}`}
        style={{ "--range-color": color, "--range-track": fill, "--range-progress": progress } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className={`${styles.rangeTicks} ${isPriority ? styles.priorityTicks : styles.cadenceTicks}`} aria-hidden="true">
        {options.map((option) => (
          <span key={option.value} data-tone={"tone" in option ? option.tone : undefined} data-cadence={isPriority ? undefined : String(option.value)}>
            {option.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function priorityIndex(priority: PriorityValue) {
  return priorityOptions.findIndex((option) => option.value === priority);
}

function cadenceIndex(cadence: CadenceValue) {
  return cadenceOptions.findIndex((option) => option.value === cadence);
}

export function OnboardingScreen() {
  const router = useRouter();
  const connectionInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("connections");
  const [contacts, setContacts] = useState<OnboardingContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [connectionFileName, setConnectionFileName] = useState("");
  const [messageFileName, setMessageFileName] = useState("");
  const [messageCount, setMessageCount] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<"connections" | "messages" | "commit" | null>(null);
  const [error, setError] = useState("");

  const currentStepIndex = stepOrder.indexOf(step);
  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedIds.has(contact.id)),
    [contacts, selectedIds],
  );
  const selectedPeopleLabel = `${selectedContacts.length} ${selectedContacts.length === 1 ? "person" : "people"}`;
  const filteredContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return contacts;
    return contacts.filter((contact) =>
      [contact.name, contact.company, contact.role, contact.email]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [contacts, query]);

  const allPriority = selectedContacts.length > 0 && selectedContacts.every((contact) => contact.priority === selectedContacts[0].priority)
    ? selectedContacts[0].priority
    : null;
  const allCadence = selectedContacts.length > 0 && selectedContacts.every((contact) => contact.cadence_days === selectedContacts[0].cadence_days)
    ? selectedContacts[0].cadence_days
    : null;

  const handleConnectionsFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!file.name.toLocaleLowerCase().endsWith(".csv")) {
      setError("Choose the CSV file from your LinkedIn connections export.");
      return;
    }
    setBusy("connections");
    try {
      const parsed = await parseConnections(file);
      if (parsed.length === 0) {
        throw new Error("No connections with names were found in this file. Choose your LinkedIn Connections CSV.");
      }
      setContacts(parsed);
      setSelectedIds(new Set());
      setConnectionFileName(file.name);
      setMessageFileName("");
      setMessageCount(0);
      setMatchedCount(0);
      setStep("messages");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not read this connections CSV.");
    } finally {
      setBusy(null);
    }
  };

  const handleMessagesFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!file.name.toLocaleLowerCase().endsWith(".csv")) {
      setError("Choose the CSV file from your LinkedIn messages export.");
      return;
    }
    setBusy("messages");
    try {
      const result = await matchMessageDates(file, contacts.map((contact) => ({ ...contact, last_contacted_at: null })));
      setContacts(result.contacts);
      setMessageFileName(file.name);
      setMessageCount(result.messageCount);
      setMatchedCount(result.matchedCount);
      setStep("selection");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not read this messages CSV.");
    } finally {
      setBusy(null);
    }
  };

  const updateContact = (id: string, change: Partial<Pick<OnboardingContact, "priority" | "cadence_days">>) => {
    setContacts((current) => current.map((contact) => contact.id === id ? { ...contact, ...change } : contact));
  };

  const updateSelectedContacts = (change: Partial<Pick<OnboardingContact, "priority" | "cadence_days">>) => {
    setContacts((current) => current.map((contact) => selectedIds.has(contact.id) ? { ...contact, ...change } : contact));
  };

  const toggleContact = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const commitOnboarding = async () => {
    if (selectedContacts.length === 0) return;
    setError("");
    setBusy("commit");
    const payload = {
      contacts: selectedContacts.map(({ name, company, role, linkedin_url, email, last_contacted_at, priority, cadence_days }) => ({
        name,
        company,
        role,
        linkedin_url,
        email,
        last_contacted_at,
        priority,
        cadence_days,
      })),
    };
    try {
      await apiRequest<{ created?: number }>("/api/onboarding/commit", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.replace("/people");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your people could not be saved. Try again.");
      setBusy(null);
    }
  };

  return (
    <div className={styles.onboarding}>
      <header className={styles.intro}>
        <h1>{step === "connections" ? "Start with your circle." : step === "messages" ? "Add your message history." : step === "selection" ? "Choose who to keep close." : "Set a rhythm that feels right."}</h1>
        <p>
          {step === "connections" && "Bring over the people you already know, then decide who belongs in your personal CRM."}
          {step === "messages" && "Use your LinkedIn messages to show when you last spoke. The message text stays on this device."}
          {step === "selection" && "Your complete connection list is here. Pick everyone you want to keep in touch with."}
          {step === "settings" && "Choose a priority and a reminder pace for your selected people. You can change these any time."}
        </p>
      </header>

      <nav className={styles.progress} aria-label="Onboarding steps">
        {stepOrder.map((item, index) => {
          const complete = index < currentStepIndex;
          const current = index === currentStepIndex;
          return (
            <button
              key={item}
              type="button"
              className={`${styles.progressStep} ${current ? styles.progressCurrent : ""} ${complete ? styles.progressComplete : ""}`}
              onClick={() => complete && setStep(item)}
              disabled={!complete}
              aria-current={current ? "step" : undefined}
              aria-label={`${index + 1}. ${stepLabels[item]}${complete ? ", complete. Go back to this step" : current ? ", current step" : ""}`}
            >
              <span className={styles.stepMark}>{complete ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
              <span>{stepLabels[item]}</span>
            </button>
          );
        })}
      </nav>

      <div className={styles.privacyNote} role="note">
        <LockKeyhole size={16} aria-hidden="true" />
        <p>{privacyCopy}</p>
      </div>

      {error ? <div className={styles.errorNotice} role="alert">{error}</div> : null}

      {step === "connections" ? (
        <section className={styles.stage} aria-labelledby="connections-heading">
          <div className={styles.stageHead}>
            <div>
              <h2 id="connections-heading">Your LinkedIn connections</h2>
              <p>Choose the Connections CSV from your LinkedIn data download.</p>
            </div>
            <span className={styles.fileStep}>First file</span>
          </div>
          <DropZone
            inputRef={connectionInputRef}
            title="Drop your connections CSV here"
            description="Names, profile links, roles and companies are read in this browser."
            busy={busy === "connections"}
            onFile={(file) => void handleConnectionsFile(file)}
          />
          {connectionFileName ? <p className={styles.fileName}><FileUp size={15} aria-hidden="true" />{connectionFileName}</p> : null}
          <p className={styles.stageFoot}>Your original export is never uploaded.</p>
        </section>
      ) : null}

      {step === "messages" ? (
        <section className={styles.stage} aria-labelledby="messages-heading">
          <div className={styles.stageHead}>
            <div>
              <h2 id="messages-heading">Your LinkedIn messages</h2>
              <p>Choose the messages CSV from the same LinkedIn data download.</p>
            </div>
            <span className={styles.fileStep}>Second file</span>
          </div>
          <DropZone
            inputRef={messageInputRef}
            title="Drop your messages CSV here"
            description="Message dates are matched to people by LinkedIn profile link or a unique full name."
            busy={busy === "messages"}
            onFile={(file) => void handleMessagesFile(file)}
          />
          {messageFileName ? <p className={styles.fileName}><FileUp size={15} aria-hidden="true" />{messageFileName}</p> : null}
          <div className={styles.inlineActions}>
            <button className="button button-quiet" type="button" onClick={() => setStep("connections")}>
              <ArrowLeft size={15} aria-hidden="true" />Back to connections
            </button>
          </div>
          <p className={styles.stageFoot}>Messages are read here to find dates only. Their text is not saved.</p>
        </section>
      ) : null}

      {step === "selection" ? (
        <section className={styles.stage} aria-labelledby="selection-heading">
          <div className={styles.stageHead}>
            <div>
              <h2 id="selection-heading">Choose the people to track</h2>
              <p>{contacts.length} {contacts.length === 1 ? "connection" : "connections"}, with last-contact dates from your message history.</p>
            </div>
            <div className={styles.countBadge}><strong>{selectedContacts.length}</strong><span>selected</span></div>
          </div>

          <div className={styles.matchSummary} role="status">
            <span className={styles.matchDot} aria-hidden="true" />
            <p>
              {messageCount > 0
                ? `Found ${matchedCount} ${matchedCount === 1 ? "contact" : "contacts"} with a matching date across ${messageCount.toLocaleString()} ${messageCount === 1 ? "message" : "messages"}.`
                : "No message dates matched. You can still choose people and start their history in Kinship."}
            </p>
            <button className={styles.textAction} type="button" onClick={() => setStep("messages")}>Change messages file</button>
          </div>

          <div className={styles.selectionTools}>
            <label className={styles.searchBox}>
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Search connections</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a person or company" />
            </label>
            <div className={styles.selectionActions}>
              <button className={styles.textAction} type="button" onClick={() => setSelectedIds(new Set(contacts.map((contact) => contact.id)))}>
                Select all {contacts.length}
              </button>
              <span aria-hidden="true">·</span>
              <button className={styles.textAction} type="button" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
            </div>
          </div>

          <div className={styles.peopleList} role="group" aria-label="Connections to track">
            {filteredContacts.length === 0 ? (
              <div className={styles.noMatches}><Users size={19} aria-hidden="true" /><span>No connections match that search.</span></div>
            ) : filteredContacts.map((contact) => (
              <div className={styles.personRow} key={contact.id}>
                <label className={styles.personPick}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(contact.id)}
                    onChange={() => toggleContact(contact.id)}
                    aria-label={`Track ${contact.name}`}
                  />
                  <span className={styles.personAvatar} aria-hidden="true">{initials(contact.name)}</span>
                  <span className={styles.personCopy}>
                    <strong>{contact.name}</strong>
                    <span>{[contact.role, contact.company].filter(Boolean).join(" · ") || "No role or company listed"}</span>
                    {contact.email ? <small>{contact.email}</small> : null}
                  </span>
                </label>
                <span className={styles.lastContact}>
                  <small>Last contact</small>
                  <time dateTime={contact.last_contacted_at ?? undefined}>
                    {contact.last_contacted_at ? formatDate(contact.last_contacted_at) : "No message history"}
                  </time>
                </span>
              </div>
            ))}
          </div>

          <p className={styles.linkedinNote}>LinkedIn does not provide connection photos or locations through its supported API. Add them later from each person’s page.</p>

          <div className={styles.stageActions}>
            <button className="button button-quiet" type="button" onClick={() => setStep("messages")}>
              <ArrowLeft size={15} aria-hidden="true" />Back
            </button>
            <button className="button button-primary" type="button" onClick={() => setStep("settings")} disabled={selectedContacts.length === 0}>
              Set preferences for {selectedContacts.length} {selectedContacts.length === 1 ? "person" : "people"}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {step === "settings" ? (
        <section className={styles.stage} aria-labelledby="settings-heading">
          <div className={styles.stageHead}>
            <div>
              <h2 id="settings-heading">Set priorities and reminders</h2>
              <p>{selectedPeopleLabel} selected. Start with one setting for everyone, then fine-tune each person.</p>
            </div>
            <span className={styles.countBadge}><strong>{selectedContacts.length}</strong><span>{selectedContacts.length === 1 ? "person" : "people"}</span></span>
          </div>

          <div className={styles.bulkSettings}>
            <div className={styles.bulkHeading}>
              <div>
                <h3>Apply to everyone</h3>
                <p>Choose a starting point for all {selectedPeopleLabel}.</p>
              </div>
              <span className={styles.bulkHint}>You can adjust each person below</span>
            </div>
            <div className={styles.bulkGroups}>
              <ChoiceGroup
                label="Priority for all"
                name="bulk-priority"
                group="priority"
                options={priorityOptions}
                selected={allPriority}
                onChange={(priority) => updateSelectedContacts({ priority })}
              />
              <ChoiceGroup
                label="Reminder for all"
                name="bulk-cadence"
                group="cadence"
                options={cadenceOptions}
                selected={allCadence}
                onChange={(cadence_days) => updateSelectedContacts({ cadence_days })}
              />
            </div>
          </div>

          <div className={styles.settingsHeading}>
            <h3>Fine-tune each person</h3>
            <span>{selectedPeopleLabel}</span>
          </div>
          <div className={styles.settingsList}>
            {selectedContacts.map((contact) => (
              <article className={styles.settingsPerson} key={contact.id}>
                <div className={styles.settingsPersonHead}>
                  <span className={styles.personAvatar} aria-hidden="true">{initials(contact.name)}</span>
                  <span className={styles.personCopy}>
                    <strong>{contact.name}</strong>
                    <span>{[contact.role, contact.company].filter(Boolean).join(" · ") || "No role or company listed"}</span>
                  </span>
                  <span className={styles.settingLastContact}>
                    {contact.last_contacted_at ? `Last in touch ${formatDate(contact.last_contacted_at)}` : "No message history"}
                  </span>
                </div>
                <div className={styles.personSliders}>
                  <SliderSetting
                    contact={contact}
                    kind="priority"
                    value={priorityIndex(contact.priority)}
                    onChange={(index) => updateContact(contact.id, { priority: priorityOptions[index].value })}
                  />
                  <SliderSetting
                    contact={contact}
                    kind="cadence"
                    value={cadenceIndex(contact.cadence_days)}
                    onChange={(index) => updateContact(contact.id, { cadence_days: cadenceOptions[index].value })}
                  />
                </div>
              </article>
            ))}
          </div>

          <div className={styles.finishNote}>
            <LockKeyhole size={15} aria-hidden="true" />
            <span>{privacyCopy}</span>
          </div>
          <div className={styles.stageActions}>
            <button className="button button-quiet" type="button" onClick={() => setStep("selection")} disabled={busy === "commit"}>
              <ArrowLeft size={15} aria-hidden="true" />Back to people
            </button>
            <button className="button button-primary" type="button" onClick={() => void commitOnboarding()} disabled={busy === "commit" || selectedContacts.length === 0}>
              {busy === "commit" ? <><RefreshCw size={15} className={styles.spin} aria-hidden="true" />Saving people...</> : <>Save {selectedPeopleLabel} and continue<ArrowRight size={15} aria-hidden="true" /></>}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
