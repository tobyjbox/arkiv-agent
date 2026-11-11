"use client";

import type { RecordDetail } from "@arkiv-agent/db";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { formatCount } from "../../lib/format";

const EXPLORER = "https://tiramisu.explorer.arkiv.network";
const glmOf = (wei: string) => (Number(wei) / 1e18).toPrecision(4);

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 border-t border-border-subtle py-1.5 first:border-t-0">
      <dt className="caption text-text-tertiary">{label}</dt>
      <dd className="mono-sm break-all">{children}</dd>
    </div>
  );
}
const Tx = ({ hash }: { hash: string }) => <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">{hash}</a>;

/**
 * A window with everything the index holds about one record: the record, its attributes with types,
 * the transaction that created it, and later changes. Text from the chain is rendered as text.
 */
export function RecordDialog({ recordKey, onClose }: { recordKey: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<RecordDetail | null>(null);
  const [hasFailed, setFailed] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
    const stop = new AbortController();
    fetch(`/api/records/${recordKey}`, { cache: "no-store", signal: stop.signal })
      .then((r) => (r.ok ? (r.json() as Promise<RecordDetail>) : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => { if (!stop.signal.aborted) setFailed(true); });
    return () => stop.abort();
  }, [recordKey]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes a modal dialog natively; the click is for the backdrop only.
    <dialog ref={dialog} onClose={onClose} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }} aria-labelledby="record-title"
      className="m-auto max-h-[86vh] w-[min(760px,calc(100vw-32px))] overflow-y-auto rounded-md border border-border-default bg-surface p-0 text-text-primary shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <div className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="record-title" className="text-[16px] font-semibold">Record</h2>
            <p className="mono-sm break-all text-text-secondary">{recordKey}</p>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} className="caption shrink-0 rounded-full border border-border-default px-3 py-1 text-text-secondary hover:text-text-primary">Close</button>
        </div>
        {hasFailed ? <p className="text-text-secondary">This record could not be read from the index.</p> : !data ? <p className="text-text-secondary" aria-busy="true">Reading the record…</p> : (
          <>
            <section>
              <h3 className="label text-text-tertiary">Create transaction</h3>
              <dl className="mt-1">
                <Row label="Transaction"><Tx hash={data.createdTx} /></Row>
                <Row label="Block">{formatCount(data.createdAtBlock)}</Row>
                <Row label="Position in it">operation {data.createdOp}</Row>
                <Row label="Sent by">{data.createFee?.sender ?? data.creator}</Row>
                {data.createFee ? (
                  <>
                    <Row label="Fee">{glmOf(data.createFee.feeWei)} GLM</Row>
                    <Row label="Gas">{formatCount(data.createFee.gasUsed)} used at {formatCount(Number(data.createFee.gasPriceWei))} wei</Row>
                    <Row label="Calldata">{formatCount(data.createFee.calldataBytes)} bytes</Row>
                    <Row label="Records in it">{formatCount(data.createFee.creates)} created, {formatCount(data.createFee.updates)} updated</Row>
                  </>
                ) : <Row label="Fee and gas"><span className="font-sans text-text-secondary">Not sampled for this transaction. The explorer link above has them.</span></Row>}
              </dl>
            </section>
            <section>
              <h3 className="label text-text-tertiary">Record</h3>
              <dl className="mt-1">
                <Row label="Status">{data.status}</Row>
                <Row label="Owner">{data.owner}</Row>
                <Row label="Creator">{data.creator}</Row>
                <Row label="Expires at block">{formatCount(data.expiresAt)}</Row>
                <Row label="Last change">block {formatCount(data.updatedAtBlock)}</Row>
                {data.deletedAtBlock !== null && <Row label="Deleted at block">{formatCount(data.deletedAtBlock)}</Row>}
                <Row label="Content type">{data.contentType ?? "none"}</Row>
                <Row label="Payload">{data.payloadBytes === null ? "unknown size" : `${formatCount(data.payloadBytes)} bytes`}</Row>
              </dl>
              {data.payloadPreview && <pre className="mono-sm mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-raised p-3" aria-label="Start of the payload">{data.payloadPreview}</pre>}
              {data.payloadPreview && <p className="caption mt-1 text-text-tertiary">The index keeps the first 256 bytes of a payload.</p>}
            </section>
            <section>
              <h3 className="label text-text-tertiary">Attributes ({data.attributes.length})</h3>
              <dl className="mt-1">
                {data.attributes.map((a) => <Row key={a.name} label={`${a.name} · ${a.type}`}>{a.value}</Row>)}
              </dl>
            </section>
            {data.patches.length > 0 && (
              <section>
                <h3 className="label text-text-tertiary">Later changes ({data.patches.length})</h3>
                <dl className="mt-1">{data.patches.map((p) => <Row key={`${p.tx}-${p.op}`} label={`Block ${formatCount(p.block)}`}><Tx hash={p.tx} /></Row>)}</dl>
              </section>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
