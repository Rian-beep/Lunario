"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Info } from "./info";
export function NumberField({
  label,
  value,
  onChange,
  unit,
  min = -Infinity,
  max = Infinity,
  step = "any",
  help,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  help?: string;
}) {
  const id = useId(),
    [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const invalid =
    draft.trim() === "" ||
    !Number.isFinite(Number(draft)) ||
    Number(draft) < min ||
    Number(draft) > max;
  return (
    <label className="number-field" htmlFor={id}>
      <span>
        {label}
        <Info label={label} extra={help} />
      </span>
      <div>
        <Input
          id={id}
          type="number"
          value={draft}
          min={Number.isFinite(min) ? min : undefined}
          max={Number.isFinite(max) ? max : undefined}
          step={step}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(e) => {
            const s = e.target.value;
            setDraft(s);
            const n = Number(s);
            if (s.trim() !== "" && Number.isFinite(n) && n >= min && n <= max)
              onChange(n);
          }}
        />
        {unit && <span>{unit}</span>}
      </div>
      {invalid && (
        <small id={`${id}-error`}>
          Enter a value{Number.isFinite(min) ? ` ≥ ${min}` : ""}
          {Number.isFinite(max) ? ` and ≤ ${max}` : ""}. Results retain the last
          valid input.
        </small>
      )}
    </label>
  );
}
export function Metric({
  label,
  value,
  unit,
  sphere,
  detail,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sphere?: ReactNode;
  detail?: string;
}) {
  return (
    <div className="metric">
      <div className="metric-label">
        {label}
        <Info label={label} />
      </div>
      <div className="metric-value">
        {value === "Unknown" ? <><span aria-hidden="true" className="metric-unknown">—</span><span className="sr-only">Unknown; required source coverage is unavailable</span></> : <>{value}<span>{unit}</span></>}
      </div>
      {sphere !== undefined && (
        <div className="sphere-value">
          Smooth sphere <strong>{sphere}</strong>
        </div>
      )}
      {detail && <p>{detail}</p>}
    </div>
  );
}
export function Section({
  title,
  children,
  detail,
}: {
  title: string;
  children?: ReactNode;
  detail?: string;
}) {
  return (
    <section className="inspector-section">
      {title && <h3>{title}</h3>}
      {detail && <p className="muted">{detail}</p>}
      {children}
    </section>
  );
}
export const number = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n)
    ? "Unknown"
    : n.toLocaleString("en-GB", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
