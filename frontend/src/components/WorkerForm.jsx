import { useState } from "react";
import { createWorker } from "../api/workers";

/**
 * @param {{ onCreated: () => void }} props
 */
export default function WorkerForm({ onCreated }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [percentage, setPercentage] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createWorker({ name, email, percentage: parseFloat(percentage) });
      setName("");
      setEmail("");
      setPercentage("");
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="worker-form" onSubmit={handleSubmit}>
      <input
        type="text"
        className="form-input"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        type="email"
        className="form-input"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="number"
        className="form-input form-input-short"
        placeholder="% (e.g. 70)"
        min="0.01"
        max="100"
        step="0.01"
        value={percentage}
        onChange={(e) => setPercentage(e.target.value)}
        required
      />
      <button type="submit" className="btn" disabled={submitting}>
        {submitting ? "Creating…" : "Add Worker"}
      </button>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
