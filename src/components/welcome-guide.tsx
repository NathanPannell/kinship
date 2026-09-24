"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, HeartHandshake, Link2 } from "./icons";
import styles from "./welcome-guide.module.css";

const steps = [
  {
    label: "Your circle",
    title: "Keep the people who matter close.",
    description: "Kinship is a home for your professional relationships. Keep each person's context, notes, and last conversation together, so the next hello feels personal.",
  },
  {
    label: "Bring people in",
    title: "Start with the connections you already have.",
    description: "Import a LinkedIn export, review the people you want to keep, and add anyone else by hand. Your circle starts with the relationships you choose.",
  },
  {
    label: "Stay in touch",
    title: "Make room for the next conversation.",
    description: "Kinship surfaces people to reconnect with based on your notes and cadence. You can also give an agent access to this same workspace with a token you control.",
  },
] as const;

export function WelcomeGuide({ name }: { name: string }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasChangedStep = useRef(false);
  const firstName = name.trim().split(/\s+/)[0] || "there";

  useEffect(() => {
    if (hasChangedStep.current) headingRef.current?.focus();
  }, [step]);

  function moveTo(nextStep: number) {
    hasChangedStep.current = true;
    setError("");
    setStep(nextStep);
  }

  async function complete() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/welcome/complete", { method: "POST" });
      if (!response.ok) throw new Error("We couldn't save your progress. Please try again.");
      window.location.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't save your progress. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <span className={styles.brand}><span className={styles.brandMark} aria-hidden="true"><HeartHandshake size={19} strokeWidth={1.8} /></span>Kinship</span>
        <button className={styles.skip} type="button" onClick={() => void complete()} disabled={saving}>Skip introduction <ArrowUpRight size={15} aria-hidden="true" /></button>
      </header>

      <main className={styles.main}>
        <div className={styles.left}>
          <p className={styles.welcome}>Welcome, {firstName}.</p>
          <p className={styles.lead}>A little more intention in every relationship.</p>
          <ol className={styles.progress} aria-label="Introduction progress">
            {steps.map((item, index) => (
              <li key={item.label} className={`${styles.progressItem} ${index === step ? styles.current : ""} ${index < step ? styles.done : ""}`} aria-current={index === step ? "step" : undefined}>
                <span className={styles.progressIndex} aria-hidden="true">{index < step ? <Check size={16} /> : String(index + 1).padStart(2, "0")}</span>
                <span>{item.label}</span>
              </li>
            ))}
          </ol>
          <p className={styles.leftNote}>You can change your circle and connect an agent whenever you are ready.</p>
        </div>

        <section className={styles.story} aria-labelledby="welcome-title">
          <div className={styles.storyInner}>
            <span className={styles.stepCount}>Step {step + 1} of {steps.length}</span>
            <h1 id="welcome-title" ref={headingRef} tabIndex={-1} className={styles.title}>{steps[step].title}</h1>
            <p className={styles.description}>{steps[step].description}</p>
            <div className={styles.diagram} aria-hidden="true">
              {step === 0 ? (
                <><span>Your people</span><span className={styles.connector} /><span>What matters</span><span className={styles.connector} /><strong>A thoughtful hello</strong></>
              ) : step === 1 ? (
                <><span>LinkedIn export</span><span className={styles.connector} /><span>Review your list</span><span className={styles.connector} /><strong>Your circle</strong></>
              ) : (
                <><span>Your notes</span><span className={styles.connector} /><span><Link2 size={15} />Kinship</span><span className={styles.connector} /><strong>Your agent</strong></>
              )}
            </div>
          </div>

          <div className={styles.actions}>
            {step > 0 ? <button className={styles.back} type="button" onClick={() => moveTo(step - 1)} disabled={saving}><ArrowLeft size={17} aria-hidden="true" />Back</button> : <span />}
            <div className={styles.actionEnd}>
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
              {step < steps.length - 1 ? (
                <button className={styles.next} type="button" onClick={() => moveTo(step + 1)}>Continue <ArrowUpRight size={17} aria-hidden="true" /></button>
              ) : (
                <button className={styles.next} type="button" onClick={() => void complete()} disabled={saving}>{saving ? "Opening Kinship…" : "Let's go"}<ArrowUpRight size={17} aria-hidden="true" /></button>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
