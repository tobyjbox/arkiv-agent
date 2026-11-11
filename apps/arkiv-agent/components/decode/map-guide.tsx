"use client";

import { Info } from "lucide-react";
import { useRef } from "react";
import { BROKEN_COLOR, LINK_KINDS } from "./palette";

const color = (kind: string) => LINK_KINDS.find((k) => k.kind === kind)?.color ?? "#8590a6";
const Line = ({ c }: { c: string }) => <span className="mr-2 inline-block h-0.5 w-5 rounded align-middle" style={{ background: c }} aria-hidden />;
const Dot = ({ c, size = 10 }: { c: string; size?: number }) => <span className="mr-2 inline-block rounded-full align-middle" style={{ background: c, width: size, height: size }} aria-hidden />;

type Item = { mark?: React.ReactNode; what: string; means: string; why: string };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "What you see on the map", items: [
    { mark: <Dot c="#3ddcc5" size={14} />, what: "Large, darker balls with a ring", means: "One project each. The ball stands for the project itself, not for records, so it is a darker shade than the datasets around it. A project is every record that carries the same project label, or one wallet when there is no label. Bigger means more live records. Only the larger projects show their name; hover any ball for the rest.", why: "You see who is building on Arkiv, and how big each one is, without running a query." },
    { mark: <Dot c="#8590a6" size={7} />, what: "Small bright dots around a ball", means: "The project's datasets, where the records are. A dataset is a group of records with the same attribute names and types, like a table. A thin grey line ties each one to its project.", why: "Arkiv has no tables. This shows the tables builders made anyway." },
    { mark: <Line c={color("ref")} />, what: "Teal curved lines", means: "Record links. Records in one dataset hold the key of records in another, the way an order points at a customer. A thicker line means more links.", why: "Arkiv has no joins and no tool that shows these links. This is each project's data model, drawn for you." },
    { mark: <Dot c="#b6fff3" size={5} />, what: "Lights moving along a teal line", means: "The direction of the link: they travel from the records that point to the records pointed at. More lights means more links. They are not live traffic; nothing is being sent as you watch.", why: "You can tell which dataset depends on which." },
    { mark: <Line c={BROKEN_COLOR} />, what: "Red lines and red lights", means: "More than half of those links are broken: a live record points at one that has expired, was deleted, or never existed.", why: "Arkiv does not check links. This finds data that will fail when an app follows it." },
    { mark: <Line c={color("shape")} />, what: "Purple lines", means: "Two projects store records with exactly the same attributes.", why: "It reveals copies, forks, shared templates, and shapes worth turning into a standard." },
    { mark: <Line c={color("builder")} />, what: "Blue lines", means: "The same wallet writes for both projects.", why: "It shows which projects come from the same builder." },
    { what: "The soft glow and slow pulse", means: "Decoration only, so projects stand out against the dark. The stars in the background mean nothing.", why: "No information is carried by them." },
  ] },
  { title: "Colours", items: [
    { mark: <Dot c="#ff7a7a" />, what: "Colour by purpose", means: "Each project is coloured by what its data appears to be for, such as health, agents, or identity. It is a guess from the words in its attribute and dataset names. Grey means the names gave no clue. The key at the bottom of the map lists the colours.", why: "You can see what Arkiv is being used for, and which uses cluster together." },
    { mark: <Dot c="#f5b544" />, what: "Colour by privacy flags", means: "Projects are coloured by whether attribute names suggest personal data, such as contact details, health, location, government IDs or birth dates. Only names are read, never values.", why: "Everything on Arkiv is public. This points at data that may not belong in the open." },
    { what: "The colour key at the bottom of the map", means: "Every item in it is a switch. Click one to hide the projects of that colour, with their datasets, and click it again to bring them back. Mostly broken links hides the red lines. Show all switches everything back on.", why: "Clear away what you are not looking at, for example every project whose purpose is unclear." },
  ] },
  { title: "Controls on the map", items: [
    { what: "Record links, Same record shape, Shared wallet", means: "Switch each kind of line on or off.", why: "Look at one kind of relationship at a time." },
    { what: "Unlabelled wallets", means: "Also show wallets that write without a project label and link to nothing. They are hidden at first because there are many and each is tiny.", why: "See the long tail when you want it, without the clutter when you do not." },
    { what: "Live · block number", means: "The map re-reads the index about every 30 seconds and changes in place. The number is the chain block it reflects. Catching up means the indexer is working through blocks it missed; Paused means it is not running.", why: "You know how fresh the picture is." },
    { what: "Full screen, Hide pane", means: "Full screen shows only the map and the pane on the right. Hide pane gives the map the whole screen.", why: "Room to explore, or to present." },
    { what: "Drag, scroll, click empty space", means: "Drag turns the map, scroll zooms, and a click on empty space returns to the whole map. The map turns slowly by itself until you touch it.", why: "" },
  ] },
  { title: "Clicking things", items: [
    { what: "Click a project", means: "The camera flies to it, other projects' lines hide, and the pane on the right shows its guessed purpose with the evidence, how its records behave, its data model, what it shares with other projects, and its privacy flags.", why: "One project's whole story on one screen." },
    { what: "Click a dataset dot", means: "Its ten newest records appear in the air as cards, then fade. The pane becomes a table of all its live records, newest first.", why: "Go from the picture to the real data in one click." },
    { what: "Hover or click a line", means: "Hovering a teal, purple or blue line says which two things it joins, how many links it stands for and how many are broken. A click travels along it to the far end; click it again to come back.", why: "Follow a relationship from one project into another without searching for it." },
    { what: "Click a row in the table", means: "A window opens with the transaction that created the record, its owner, expiry, payload start, and every attribute with its type.", why: "Check any claim on this page against what is on chain." },
  ] },
  { title: "The rest of the page", items: [
    { what: "Five totals above the map", means: "Record links found, broken ones, links that cross wallets, record shapes shared between projects, and datasets with privacy flags.", why: "The headline findings before you explore." },
    { what: "Lists below the map", means: "Attribute names that many projects chose independently, shapes shared between projects, and every privacy flag.", why: "The same findings as the map, as lists you can read from top to bottom." },
  ] },
];

/** The (i) on the map: every mark, colour and control, what it means and why it is useful, in plain words. */
export function MapGuide() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} aria-label="What everything on this screen means" title="What everything on this screen means"
        className="caption flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border-default bg-overlay px-2.5 py-1 text-text-primary hover:bg-raised">
        <Info size={13} aria-hidden /> Guide
      </button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes a modal dialog natively; the click is for the backdrop only. */}
      <dialog ref={dialog} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }} aria-labelledby="guide-title"
        className="m-auto max-h-[86vh] w-[min(820px,calc(100vw-32px))] overflow-y-auto rounded-md border border-border-default bg-surface p-0 text-left text-text-primary shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop:bg-black/70 backdrop:backdrop-blur-sm">
        <div className="space-y-6 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="guide-title" className="text-[18px] font-semibold">How to read Arkiv-Decode</h2>
              <p className="mt-1 text-text-secondary">Arkiv stores records but has no tables, no joins and no picture of how data connects. This page works those out from attribute names, types and record keys, and draws them.</p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} className="caption shrink-0 rounded-full border border-border-default px-3 py-1 text-text-secondary hover:text-text-primary">Close</button>
          </div>
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="label text-text-tertiary">{g.title}</h3>
              <dl className="mt-1">
                {g.items.map((it) => (
                  <div key={it.what} className="border-t border-border-subtle py-2.5 first:border-t-0">
                    <dt className="font-medium">{it.mark}{it.what}</dt>
                    <dd className="mt-0.5 text-text-secondary">{it.means}</dd>
                    {it.why && <dd className="mt-0.5 text-text-secondary"><span className="text-accent">Why it helps:</span> {it.why}</dd>}
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
}
